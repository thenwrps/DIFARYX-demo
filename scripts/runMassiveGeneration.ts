#!/usr/bin/env node
/**
 * DIFARYX — Massive Synthetic Data Generation Loop (v2 Global Scale)
 *
 * Target: 364,000 high-fidelity scientific samples
 *   → 91,000 samples × 4 techniques
 *   → 2,000 – 10,000 data points per sample (10x resolution)
 *
 * Techniques: XRD | XPS | FTIR | Raman
 *
 * Features:
 *   • Resume capability — detects existing files and continues from where it left off
 *   • Disk space monitoring — pauses if D: drive drops below 10 GB
 *   • Fault-tolerant batch loop — errors logged, batch skipped, flow continues
 *   • Real-time throughput logging
 *   • STRICTLY D: drive only — zero C: drive writes
 *
 * Storage: D:/DIFARYX_Synthetic_Data/
 *
 * @module scripts/runMassiveGeneration
 */

import { mkdir, writeFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { statfsSync } from 'node:fs';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Technique =
  | 'XRD' | 'XPS' | 'FTIR' | 'Raman' | 'XAS'
  | 'TEM' | 'BET' | 'TPD' | 'NMR' | 'SEM' | 'XRF';

interface DataPoint { readonly x: number; readonly y: number; }

interface PeakDefinition {
  readonly center: number;
  readonly width: number;
  readonly amplitude: number;
  readonly eta?: number;
}

interface BaselineDefinition {
  readonly type: 'polynomial' | 'exponential' | 'linear' | 'none';
  readonly coefficients?: readonly number[];
}

interface TechniqueConfig {
  readonly technique: Technique;
  readonly xRange: readonly [number, number];
  readonly pointCount: number;
  readonly peaks: readonly PeakDefinition[];
  readonly baseline: BaselineDefinition;
  readonly snr: number;
  readonly xUnit: string;
  readonly yUnit: string;
}

interface SyntheticDataset {
  readonly id: string;
  readonly technique: Technique;
  readonly sampleId: string;
  readonly researchObjective: string;
  readonly points: readonly DataPoint[];
  readonly config: TechniqueConfig;
  readonly metadata: {
    readonly generatedAt: string;
    readonly peakCount: number;
    readonly snr: number;
    readonly baselineType: string;
    readonly pointCount: number;
  };
}

interface BatchManifest {
  readonly batchId: string;
  readonly generatedAt: string;
  readonly technique: Technique;
  readonly datasetCount: number;
  readonly outputDir: string;
  readonly files: readonly string[];
}

interface BatchResult {
  technique: Technique;
  batchIndex: number;
  count: number;
  elapsed: number;
  success: boolean;
  error?: string;
}

interface TechniqueSummary {
  technique: Technique;
  totalGenerated: number;
  totalFailed: number;
  batchesCompleted: number;
  batchesFailed: number;
  totalElapsed: number;
  preExistingCount: number;
}

// ---------------------------------------------------------------------------
// Signal Primitives
// ---------------------------------------------------------------------------

function gaussian(x: number, peak: PeakDefinition): number {
  return peak.amplitude * Math.exp(-0.5 * ((x - peak.center) / peak.width) ** 2);
}

function lorentzian(x: number, peak: PeakDefinition): number {
  return peak.amplitude / (1 + ((x - peak.center) / peak.width) ** 2);
}

function pseudoVoigt(x: number, peak: PeakDefinition): number {
  const eta = peak.eta ?? 0.28;
  return (1 - eta) * gaussian(x, peak) + eta * lorentzian(x, peak);
}

function polynomialBaseline(x: number, coefficients: readonly number[]): number {
  let y = 0;
  for (let k = 0; k < coefficients.length; k++) {
    y += coefficients[k] * x ** k;
  }
  return y;
}

function exponentialBaseline(x: number, b0: number, b1: number, tau: number, xMin: number): number {
  return b0 + b1 * Math.exp(-(x - xMin) / tau);
}

function sigmoidStep(x: number, center: number, steepness: number): number {
  return 1 / (1 + Math.exp(-steepness * (x - center)));
}

function logNormalPeak(x: number, center: number, sigma: number, amplitude: number): number {
  if (x <= 0) return 0;
  const ln = Math.log(x) - Math.log(center);
  return amplitude * Math.exp(-0.5 * (ln / sigma) ** 2);
}

function deterministicNoise(index: number, x: number, amplitude: number, seed = 0): number {
  const s = seed * 0.01;
  return amplitude * (
    0.5 * Math.sin((index + s) * 0.93 + x * 0.17) +
    0.3 * Math.sin((index + s) * 2.11 + 0.8) +
    0.2 * Math.cos((index + s) * 0.37 - x * 0.09)
  );
}

function computeNoiseAmplitude(peaks: readonly PeakDefinition[], snr: number): number {
  const maxAmp = Math.max(...peaks.map(p => p.amplitude), 1);
  return maxAmp / snr;
}

function generateStandardTrace(config: TechniqueConfig, seed = 0): DataPoint[] {
  const [xMin, xMax] = config.xRange;
  const noiseAmp = computeNoiseAmplitude(config.peaks, config.snr);

  return Array.from({ length: config.pointCount }, (_, i) => {
    const x = xMin + ((xMax - xMin) * i) / (config.pointCount - 1);

    let y = 0;
    switch (config.baseline.type) {
      case 'polynomial':
        y = polynomialBaseline(x, config.baseline.coefficients ?? [0]);
        break;
      case 'linear':
        y = polynomialBaseline(x, config.baseline.coefficients ?? [0, 0]);
        break;
      case 'exponential': {
        const [b0, b1, tau] = config.baseline.coefficients ?? [0, 0, 1];
        y = exponentialBaseline(x, b0, b1, tau, xMin);
        break;
      }
      case 'none':
      default:
        y = 0;
    }

    for (const peak of config.peaks) {
      y += pseudoVoigt(x, peak);
    }

    y += deterministicNoise(i, x, noiseAmp, seed);
    return { x, y: Math.max(y, 0) };
  });
}

/** BET isotherm — sigmoid + Langmuir-like shape */
function generateBETTrace(config: TechniqueConfig, seed = 0): DataPoint[] {
  const [xMin, xMax] = config.xRange;
  const noiseAmp = computeNoiseAmplitude(config.peaks, config.snr);

  return Array.from({ length: config.pointCount }, (_, i) => {
    const x = xMin + ((xMax - xMin) * i) / (config.pointCount - 1);

    let y = polynomialBaseline(x, config.baseline.coefficients ?? [0, 0]);

    // BET adsorption isotherm: V = Vm * C * p / ((p0 - p)(1 + (C-1)(p/p0)))
    const pOverP0 = x;
    const C = 150 + seed * 0.1; // BET constant varies with seed
    const Vm = 50 + (seed % 30);
    if (pOverP0 > 0 && pOverP0 < 0.999) {
      const betCore = Vm * C * pOverP0 / ((1 - pOverP0) * (1 + (C - 1) * pOverP0));
      y += betCore;
    }

    // Capillary condensation step
    y += 80 * sigmoidStep(x, 0.7 + (seed % 5) * 0.02, 30);

    for (const peak of config.peaks) {
      y += pseudoVoigt(x, peak);
    }

    y += deterministicNoise(i, x, noiseAmp, seed);
    return { x, y: Math.max(y, 0) };
  });
}

/** TEM particle size distribution — log-normal histogram peaks */
function generateTEMTrace(config: TechniqueConfig, seed = 0): DataPoint[] {
  const [xMin, xMax] = config.xRange;
  const noiseAmp = computeNoiseAmplitude(config.peaks, config.snr);

  return Array.from({ length: config.pointCount }, (_, i) => {
    const x = xMin + ((xMax - xMin) * i) / (config.pointCount - 1);

    let y = polynomialBaseline(x, config.baseline.coefficients ?? [0]);

    // Multiple log-normal particle populations
    y += logNormalPeak(x, 8 + (seed % 3), 0.35, 120);
    y += logNormalPeak(x, 25 + (seed % 7), 0.30, 60);
    y += logNormalPeak(x, 80 + (seed % 15), 0.25, 25);

    for (const peak of config.peaks) {
      y += pseudoVoigt(x, peak);
    }

    y += deterministicNoise(i, x, noiseAmp, seed);
    return { x, y: Math.max(y, 0) };
  });
}

/** TPD — multiple thermal desorption peaks */
function generateTPDTrace(config: TechniqueConfig, seed = 0): DataPoint[] {
  const [xMin, xMax] = config.xRange;
  const noiseAmp = computeNoiseAmplitude(config.peaks, config.snr);

  return Array.from({ length: config.pointCount }, (_, i) => {
    const x = xMin + ((xMax - xMin) * i) / (config.pointCount - 1);

    let y = polynomialBaseline(x, config.baseline.coefficients ?? [0]);

    // Desorption peaks at different temperatures (Redhead-like)
    const shift = (seed % 5) * 8;
    y += pseudoVoigt(x, { center: 120 + shift, width: 25, amplitude: 45, eta: 0.5 });
    y += pseudoVoigt(x, { center: 280 + shift, width: 40, amplitude: 80, eta: 0.45 });
    y += pseudoVoigt(x, { center: 450 + shift, width: 55, amplitude: 55, eta: 0.40 });
    y += pseudoVoigt(x, { center: 620 + shift * 0.5, width: 70, amplitude: 30, eta: 0.35 });

    for (const peak of config.peaks) {
      y += pseudoVoigt(x, peak);
    }

    y += deterministicNoise(i, x, noiseAmp, seed);
    return { x, y: Math.max(y, 0) };
  });
}

/** XRF — characteristic X-ray emission lines */
function generateXRFTrace(config: TechniqueConfig, seed = 0): DataPoint[] {
  const [xMin, xMax] = config.xRange;
  const noiseAmp = computeNoiseAmplitude(config.peaks, config.snr);

  return Array.from({ length: config.pointCount }, (_, i) => {
    const x = xMin + ((xMax - xMin) * i) / (config.pointCount - 1);

    let y = polynomialBaseline(x, config.baseline.coefficients ?? [0, 0, 0]);

    // Common XRF emission lines
    const eShift = (seed % 3) * 0.05;
    // Kα and Kβ lines for various elements
    y += pseudoVoigt(x, { center: 1.74 + eShift, width: 0.04, amplitude: 180, eta: 0.15 });  // Si Kα
    y += pseudoVoigt(x, { center: 2.31 + eShift, width: 0.05, amplitude: 220, eta: 0.15 });  // S Kα
    y += pseudoVoigt(x, { center: 3.69 + eShift, width: 0.06, amplitude: 350, eta: 0.15 });  // Ca Kα
    y += pseudoVoigt(x, { center: 4.01 + eShift, width: 0.06, amplitude: 120, eta: 0.15 });  // Ca Kβ
    y += pseudoVoigt(x, { center: 6.40 + eShift, width: 0.08, amplitude: 450, eta: 0.15 });  // Fe Kα
    y += pseudoVoigt(x, { center: 7.06 + eShift, width: 0.08, amplitude: 150, eta: 0.15 });  // Fe Kβ
    y += pseudoVoigt(x, { center: 8.05 + eShift, width: 0.09, amplitude: 280, eta: 0.15 });  // Cu Kα
    y += pseudoVoigt(x, { center: 8.91 + eShift, width: 0.10, amplitude: 200, eta: 0.15 });  // Zn Kα

    for (const peak of config.peaks) {
      y += pseudoVoigt(x, peak);
    }

    y += deterministicNoise(i, x, noiseAmp, seed);
    return { x, y: Math.max(y, 0) };
  });
}

/** SEM — surface height profile with grain-like features */
function generateSEMTrace(config: TechniqueConfig, seed = 0): DataPoint[] {
  const [xMin, xMax] = config.xRange;
  const noiseAmp = computeNoiseAmplitude(config.peaks, config.snr);

  return Array.from({ length: config.pointCount }, (_, i) => {
    const x = xMin + ((xMax - xMin) * i) / (config.pointCount - 1);

    let y = polynomialBaseline(x, config.baseline.coefficients ?? [0, 0]);

    // Multi-scale surface features (grains, steps, roughness)
    const s = seed * 0.1;
    y += 15 * Math.sin(x * 0.8 + s) * Math.exp(-0.02 * x);
    y += 8 * Math.sin(x * 2.5 + s * 1.3);
    y += 4 * Math.sin(x * 7.1 + s * 0.7);

    // Grain boundary steps
    y += 25 * sigmoidStep(x, 8 + (seed % 5), 5);
    y += 20 * sigmoidStep(x, 22 + (seed % 8), 4);
    y += 15 * sigmoidStep(x, 38 + (seed % 6), 6);

    for (const peak of config.peaks) {
      y += pseudoVoigt(x, peak);
    }

    y += deterministicNoise(i, x, noiseAmp, seed);
    return { x, y: Math.max(y, 0) };
  });
}

/** XAS — XANES/EXAFS with pre-edge, white line, and oscillations */
function generateXASTrace(config: TechniqueConfig, seed = 0): DataPoint[] {
  const [xMin, xMax] = config.xRange;
  const noiseAmp = computeNoiseAmplitude(config.peaks, config.snr);

  return Array.from({ length: config.pointCount }, (_, i) => {
    const x = xMin + ((xMax - xMin) * i) / (config.pointCount - 1);

    let y = polynomialBaseline(x, config.baseline.coefficients ?? [0, 0]);

    // Edge step (arctangent)
    const edgeCenter = 7112 + (seed % 4);
    y += 100 * (0.5 + Math.atan((x - edgeCenter) * 0.15) / Math.PI);

    // Pre-edge peak
    y += pseudoVoigt(x, { center: edgeCenter - 10, width: 1.5, amplitude: 12, eta: 0.3 });

    // White line (sharp resonance above edge)
    y += pseudoVoigt(x, { center: edgeCenter + 8, width: 2.0, amplitude: 180, eta: 0.2 });

    // EXAFS-like oscillations (decaying sinusoidal)
    const k = (x - edgeCenter) * 0.08;
    if (k > 0) {
      y += 30 * Math.exp(-k * 0.5) * Math.sin(k * 3.5 + seed * 0.3);
      y += 15 * Math.exp(-k * 0.4) * Math.sin(k * 7.0 + seed * 0.5);
    }

    for (const peak of config.peaks) {
      y += pseudoVoigt(x, peak);
    }

    y += deterministicNoise(i, x, noiseAmp, seed);
    return { x, y: Math.max(y, 0) };
  });
}

/** NMR — solid-state NMR with multiple sharp peaks */
function generateNMRTrace(config: TechniqueConfig, seed = 0): DataPoint[] {
  const [xMin, xMax] = config.xRange;
  const noiseAmp = computeNoiseAmplitude(config.peaks, config.snr);

  return Array.from({ length: config.pointCount }, (_, i) => {
    const x = xMin + ((xMax - xMin) * i) / (config.pointCount - 1);

    let y = polynomialBaseline(x, config.baseline.coefficients ?? [0, 0]);

    // Common NMR chemical shift peaks
    const s = seed * 0.5;
    y += pseudoVoigt(x, { center: 0.5 + s % 1, width: 0.15, amplitude: 30, eta: 0.1 });     // TMS ref
    y += pseudoVoigt(x, { center: 20 + s % 3, width: 0.3, amplitude: 55, eta: 0.1 });        // Alkyl
    y += pseudoVoigt(x, { center: 40 + s % 5, width: 0.4, amplitude: 40, eta: 0.1 });        // C-O
    y += pseudoVoigt(x, { center: 65 + s % 4, width: 0.5, amplitude: 65, eta: 0.15 });       // C=O
    y += pseudoVoigt(x, { center: 110 + s % 8, width: 0.6, amplitude: 45, eta: 0.1 });       // Aromatic
    y += pseudoVoigt(x, { center: 130 + s % 10, width: 0.8, amplitude: 35, eta: 0.15 });     // Aromatic C
    y += pseudoVoigt(x, { center: 170 + s % 6, width: 0.5, amplitude: 50, eta: 0.1 });       // Carboxyl

    for (const peak of config.peaks) {
      y += pseudoVoigt(x, peak);
    }

    y += deterministicNoise(i, x, noiseAmp, seed);
    return { x, y: Math.max(y, 0) };
  });
}

// ---------------------------------------------------------------------------
// Technique Configs — 10x Resolution (2,000 – 10,000 points per sample)
// ---------------------------------------------------------------------------

const TECHNIQUE_CONFIGS: Record<Technique, TechniqueConfig> = {
  XRD: {
    technique: 'XRD',
    xRange: [10, 80],
    pointCount: 5000,
    snr: 120,
    xUnit: '°2θ',
    yUnit: 'counts',
    baseline: { type: 'polynomial', coefficients: [8.2, -0.15, 0.003, -0.00002] },
    peaks: [
      { center: 18.3, width: 0.22, amplitude: 18, eta: 0.22 },
      { center: 30.1, width: 0.24, amplitude: 52, eta: 0.22 },
      { center: 35.5, width: 0.27, amplitude: 92, eta: 0.22 },
      { center: 37.1, width: 0.25, amplitude: 24, eta: 0.22 },
      { center: 43.2, width: 0.30, amplitude: 48, eta: 0.22 },
      { center: 53.6, width: 0.34, amplitude: 28, eta: 0.22 },
      { center: 57.1, width: 0.37, amplitude: 39, eta: 0.22 },
      { center: 62.7, width: 0.40, amplitude: 45, eta: 0.22 },
    ],
  },

  XPS: {
    technique: 'XPS',
    xRange: [525, 540],
    pointCount: 3000,
    snr: 60,
    xUnit: 'eV',
    yUnit: 'counts',
    baseline: { type: 'polynomial', coefficients: [120, -0.8, 0.005] },
    peaks: [
      { center: 529.5, width: 0.9, amplitude: 85, eta: 0.65 },
      { center: 531.2, width: 1.1, amplitude: 62, eta: 0.55 },
      { center: 532.8, width: 1.3, amplitude: 30, eta: 0.50 },
    ],
  },

  FTIR: {
    technique: 'FTIR',
    xRange: [400, 4000],
    pointCount: 8000,
    snr: 200,
    xUnit: 'cm⁻¹',
    yUnit: 'absorbance',
    baseline: { type: 'polynomial', coefficients: [0.08, -0.00004, 0.00000002] },
    peaks: [
      { center: 450, width: 25, amplitude: 0.72, eta: 0.30 },
      { center: 560, width: 30, amplitude: 0.85, eta: 0.30 },
      { center: 1050, width: 40, amplitude: 0.25, eta: 0.25 },
      { center: 1380, width: 35, amplitude: 0.32, eta: 0.28 },
      { center: 1630, width: 45, amplitude: 0.20, eta: 0.25 },
      { center: 3420, width: 180, amplitude: 0.55, eta: 0.40 },
    ],
  },

  Raman: {
    technique: 'Raman',
    xRange: [100, 1000],
    pointCount: 4000,
    snr: 50,
    xUnit: 'cm⁻¹',
    yUnit: 'intensity (a.u.)',
    baseline: { type: 'exponential', coefficients: [5, 80, 350] },
    peaks: [
      { center: 210, width: 12.7, amplitude: 20, eta: 0.35 },
      { center: 290, width: 14.1, amplitude: 32, eta: 0.35 },
      { center: 480, width: 16.5, amplitude: 75, eta: 0.30 },
      { center: 540, width: 15.0, amplitude: 22, eta: 0.35 },
      { center: 690, width: 18.8, amplitude: 100, eta: 0.30 },
    ],
  },

  XAS: {
    technique: 'XAS',
    xRange: [6900, 7200],
    pointCount: 5000,
    snr: 80,
    xUnit: 'eV',
    yUnit: 'absorption (a.u.)',
    baseline: { type: 'polynomial', coefficients: [0.5, 0.0001] },
    peaks: [
      { center: 7110, width: 1.5, amplitude: 12, eta: 0.30 },
      { center: 7120, width: 2.0, amplitude: 180, eta: 0.20 },
      { center: 7140, width: 3.0, amplitude: 30, eta: 0.35 },
      { center: 7170, width: 4.0, amplitude: 15, eta: 0.40 },
    ],
  },

  TEM: {
    technique: 'TEM',
    xRange: [0, 200],
    pointCount: 3000,
    snr: 100,
    xUnit: 'nm',
    yUnit: 'count density',
    baseline: { type: 'polynomial', coefficients: [2, -0.005] },
    peaks: [
      { center: 5, width: 1.2, amplitude: 15, eta: 0.25 },
      { center: 35, width: 2.5, amplitude: 8, eta: 0.25 },
      { center: 100, width: 4.0, amplitude: 4, eta: 0.30 },
    ],
  },

  BET: {
    technique: 'BET',
    xRange: [0.01, 0.99],
    pointCount: 4000,
    snr: 150,
    xUnit: 'P/P₀',
    yUnit: 'adsorbed volume (cm³/g)',
    baseline: { type: 'polynomial', coefficients: [1, 2] },
    peaks: [
      { center: 0.1, width: 0.08, amplitude: 5, eta: 0.30 },
      { center: 0.5, width: 0.10, amplitude: 3, eta: 0.25 },
    ],
  },

  TPD: {
    technique: 'TPD',
    xRange: [50, 800],
    pointCount: 5000,
    snr: 60,
    xUnit: '°C',
    yUnit: 'signal (a.u.)',
    baseline: { type: 'polynomial', coefficients: [2, -0.001] },
    peaks: [
      { center: 120, width: 20, amplitude: 10, eta: 0.35 },
      { center: 350, width: 30, amplitude: 6, eta: 0.30 },
      { center: 600, width: 40, amplitude: 3, eta: 0.35 },
    ],
  },

  NMR: {
    technique: 'NMR',
    xRange: [0, 200],
    pointCount: 6000,
    snr: 80,
    xUnit: 'ppm',
    yUnit: 'intensity (a.u.)',
    baseline: { type: 'polynomial', coefficients: [1, -0.002] },
    peaks: [
      { center: 10, width: 0.3, amplitude: 8, eta: 0.10 },
      { center: 50, width: 0.4, amplitude: 5, eta: 0.10 },
      { center: 120, width: 0.5, amplitude: 6, eta: 0.12 },
      { center: 175, width: 0.4, amplitude: 4, eta: 0.10 },
    ],
  },

  SEM: {
    technique: 'SEM',
    xRange: [0, 50],
    pointCount: 3000,
    snr: 100,
    xUnit: 'μm',
    yUnit: 'intensity (a.u.)',
    baseline: { type: 'polynomial', coefficients: [80, -0.5] },
    peaks: [
      { center: 5, width: 0.8, amplitude: 10, eta: 0.25 },
      { center: 20, width: 1.5, amplitude: 6, eta: 0.25 },
      { center: 40, width: 2.0, amplitude: 4, eta: 0.30 },
    ],
  },

  XRF: {
    technique: 'XRF',
    xRange: [0, 30],
    pointCount: 5000,
    snr: 100,
    xUnit: 'keV',
    yUnit: 'counts',
    baseline: { type: 'polynomial', coefficients: [10, -0.2, 0.005] },
    peaks: [
      { center: 1.74, width: 0.04, amplitude: 25, eta: 0.15 },
      { center: 6.40, width: 0.08, amplitude: 15, eta: 0.15 },
    ],
  },
};

// Map technique → trace generator function
const TRACE_GENERATORS: Record<Technique, (config: TechniqueConfig, seed: number) => DataPoint[]> = {
  XRD:   generateStandardTrace,
  XPS:   generateStandardTrace,
  FTIR:  generateStandardTrace,
  Raman: generateStandardTrace,
  XAS:   generateXASTrace,
  TEM:   generateTEMTrace,
  BET:   generateBETTrace,
  TPD:   generateTPDTrace,
  NMR:   generateNMRTrace,
  SEM:   generateSEMTrace,
  XRF:   generateXRFTrace,
};

// ---------------------------------------------------------------------------
// Runner Configuration
// ---------------------------------------------------------------------------

const OUTPUT_ROOT = 'D:/DIFARYX_Synthetic_Data';
const SAMPLES_PER_TECHNIQUE = 91_000;
const BATCH_SIZE = 1000;
const MIN_FREE_SPACE_GB = 10;
const RESEARCH_OBJECTIVE = 'Global-scale DIFARYX synthetic dataset — 1M+ high-fidelity scientific samples for validation pipeline';

// Execution order: 4 core evidence-linked techniques
const EXECUTION_ORDER: readonly Technique[] = [
  'XRD', 'XPS', 'FTIR', 'Raman',
];

const ALL_TECHNIQUES: readonly Technique[] = [
  'XRD', 'XPS', 'FTIR', 'Raman',
];

// ---------------------------------------------------------------------------
// Disk Space Monitor
// ---------------------------------------------------------------------------

function getFreeSpaceGB(): number {
  try {
    const s = statfsSync('D:/');
    return (s.bfree * s.bsize) / (1024 * 1024 * 1024);
  } catch {
    return Infinity; // If we can't check, don't block
  }
}

function checkDiskSpace(): { ok: boolean; freeGB: number } {
  const freeGB = getFreeSpaceGB();
  return { ok: freeGB >= MIN_FREE_SPACE_GB, freeGB };
}

// ---------------------------------------------------------------------------
// Resume Logic
// ---------------------------------------------------------------------------

async function countExistingDatasets(dir: string): Promise<number> {
  try {
    const files = await readdir(dir);
    return files.filter((f: string) => f.endsWith('.json') && !f.startsWith('manifest')).length;
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// File I/O Helpers
// ---------------------------------------------------------------------------

async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

/** Round to 4 decimal places — minifies numeric precision for storage savings. */
function R4(v: number): number {
  return Math.round(v * 10000) / 10000;
}

function datasetToJSON(dataset: SyntheticDataset): string {
  // Minified JSON — zero indentation, rounded floats
  const minified = {
    ...dataset,
    points: dataset.points.map(p => ({ x: R4(p.x), y: R4(p.y) })),
  };
  return JSON.stringify(minified);
}

// ---------------------------------------------------------------------------
// Dataset Generation
// ---------------------------------------------------------------------------

function generateSingle(technique: Technique, sampleId: string, seed: number, objective: string): SyntheticDataset {
  const config = TECHNIQUE_CONFIGS[technique];
  const generator = TRACE_GENERATORS[technique];
  const points = generator(config, seed);
  const id = `syn-${technique.toLowerCase()}-${sampleId}-${seed}`;

  return {
    id,
    technique,
    sampleId,
    researchObjective: objective,
    points,
    config,
    metadata: {
      generatedAt: new Date().toISOString(),
      peakCount: config.peaks.length,
      snr: config.snr,
      baselineType: config.baseline.type,
      pointCount: config.pointCount,
    },
  };
}

// ---------------------------------------------------------------------------
// Batch Execution
// ---------------------------------------------------------------------------

async function writeBatch(
  technique: Technique,
  batchIndex: number,
  startIdx: number,
  count: number,
): Promise<BatchResult> {
  const t0 = performance.now();

  try {
    // Check disk space before each batch
    const { ok, freeGB } = checkDiskSpace();
    if (!ok) {
      const msg = `⚠️  DISK SPACE WARNING: D: drive has only ${freeGB.toFixed(1)} GB free (threshold: ${MIN_FREE_SPACE_GB} GB). Pausing batch ${batchIndex + 1} for ${technique}.`;
      console.error(msg);
      throw new Error(msg);
    }

    const outDir = join(OUTPUT_ROOT, technique);
    await ensureDir(outDir);

    const datasets: SyntheticDataset[] = [];
    const filenames: string[] = [];

    for (let i = 0; i < count; i++) {
      const globalIdx = startIdx + i;
      const sampleId = `batch-${String(batchIndex + 1).padStart(3, '0')}-${String(i + 1).padStart(5, '0')}`;
      const seed = globalIdx * 137 + 7;
      const ds = generateSingle(technique, sampleId, seed, RESEARCH_OBJECTIVE);
      datasets.push(ds);
      filenames.push(`${ds.id}.json`);
    }

    // Write minified JSON files only (no CSV — saves 50% storage)
    const CHUNK = 200;
    for (let c = 0; c < datasets.length; c += CHUNK) {
      const chunk = datasets.slice(c, c + CHUNK);
      await Promise.all(
        chunk.map(ds =>
          writeFile(join(outDir, `${ds.id}.json`), datasetToJSON(ds), 'utf-8'),
        ),
      );
    }

    // Write batch manifest
    const batchId = `batch-${technique.toLowerCase()}-${String(batchIndex + 1).padStart(3, '0')}`;
    const manifest: BatchManifest = {
      batchId,
      generatedAt: new Date().toISOString(),
      technique,
      datasetCount: count,
      outputDir: outDir,
      files: filenames,
    };
    await writeFile(
      join(outDir, `manifest-${batchId}.json`),
      JSON.stringify(manifest, null, 2),
      'utf-8',
    );

    const elapsed = performance.now() - t0;
    const samplesPerSec = (count / (elapsed / 1000)).toFixed(1);
    console.log(
      `✅  Batch ${String(batchIndex + 1).padStart(3, '0')} complete: ` +
      `${count} ${technique} spectra written  ` +
      `[${(elapsed / 1000).toFixed(2)}s | ${samplesPerSec} samples/s | ` +
      `disk: ${checkDiskSpace().freeGB.toFixed(0)} GB free]`
    );

    return { technique, batchIndex, count, elapsed, success: true };
  } catch (err: any) {
    const elapsed = performance.now() - t0;
    const errorMsg = err?.message ?? String(err);
    console.error(
      `❌  Batch ${String(batchIndex + 1).padStart(3, '0')} FAILED for ${technique}: ${errorMsg}  ` +
      `[${(elapsed / 1000).toFixed(2)}s] — Skipping to next batch.`
    );
    return { technique, batchIndex, count, elapsed, success: false, error: errorMsg };
  }
}

// ---------------------------------------------------------------------------
// Technique Runner (with resume)
// ---------------------------------------------------------------------------

async function runTechnique(technique: Technique): Promise<TechniqueSummary> {
  const t0 = performance.now();
  const outDir = join(OUTPUT_ROOT, technique);
  await ensureDir(outDir);

  // Resume: count existing datasets
  const preExistingCount = await countExistingDatasets(outDir);
  const batchesAlreadyDone = Math.floor(preExistingCount / BATCH_SIZE);
  const remaining = SAMPLES_PER_TECHNIQUE - preExistingCount;

  console.log(`\n${'='.repeat(72)}`);
  console.log(`🔬  ${technique} — Target: ${SAMPLES_PER_TECHNIQUE.toLocaleString()} samples`);
  if (preExistingCount > 0) {
    console.log(`    📂  Found ${preExistingCount.toLocaleString()} existing datasets — resuming from batch ${batchesAlreadyDone + 1}`);
    console.log(`    📦  Remaining: ${remaining.toLocaleString()} samples`);
  }
  console.log(`${'='.repeat(72)}\n`);

  if (remaining <= 0) {
    console.log(`    ✅  ${technique} already complete (${preExistingCount.toLocaleString()} datasets). Skipping.`);
    return {
      technique,
      totalGenerated: 0,
      totalFailed: 0,
      batchesCompleted: 0,
      batchesFailed: 0,
      totalElapsed: 0,
      preExistingCount,
    };
  }

  const totalBatches = Math.ceil(SAMPLES_PER_TECHNIQUE / BATCH_SIZE);
  const results: BatchResult[] = [];

  for (let b = batchesAlreadyDone; b < totalBatches; b++) {
    // Check disk space before starting batch
    const { ok, freeGB } = checkDiskSpace();
    if (!ok) {
      console.error(`\n🛑  DISK SPACE CRITICAL: ${freeGB.toFixed(1)} GB free on D: (threshold ${MIN_FREE_SPACE_GB} GB)`);
      console.error(`    Stopping ${technique} generation. Re-run to resume from batch ${b + 1}.\n`);
      break;
    }

    const startIdx = b * BATCH_SIZE;
    const count = Math.min(BATCH_SIZE, SAMPLES_PER_TECHNIQUE - startIdx);

    const result = await writeBatch(technique, b, startIdx, count);
    results.push(result);
  }

  const totalElapsed = performance.now() - t0;
  const succeeded = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  return {
    technique,
    totalGenerated: succeeded.reduce((s, r) => s + r.count, 0),
    totalFailed: failed.reduce((s, r) => s + r.count, 0),
    batchesCompleted: succeeded.length,
    batchesFailed: failed.length,
    totalElapsed,
    preExistingCount,
  };
}

// ---------------------------------------------------------------------------
// Main Execution Loop
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const globalT0 = performance.now();
  const totalTarget = SAMPLES_PER_TECHNIQUE * ALL_TECHNIQUES.length;

  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════════════════╗');
  console.log('║        DIFARYX — Massive Synthetic Data Generation Loop               ║');
  console.log('║        4 Techniques: XRD | XPS | FTIR | Raman                        ║');
  console.log(`║        Target: ${totalTarget.toLocaleString().padStart(8)} high-fidelity samples                              ║`);
  console.log('║        Resolution: 2,000 – 10,000 points per sample (10x)              ║');
  console.log('║        Storage: D:/DIFARYX_Synthetic_Data/ (STRICTLY D: drive)         ║');
  console.log(`║        Disk space: ${getFreeSpaceGB().toFixed(0)} GB free (pause threshold: ${MIN_FREE_SPACE_GB} GB)              ║`);
  console.log('╚══════════════════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`  Execution order: ${EXECUTION_ORDER.join(' → ')}`);
  console.log('');

  await ensureDir(OUTPUT_ROOT);

  const summaries: TechniqueSummary[] = [];

  for (const technique of EXECUTION_ORDER) {
    const summary = await runTechnique(technique);
    summaries.push(summary);

    // Disk space check between techniques
    const { ok, freeGB } = checkDiskSpace();
    if (!ok) {
      console.error(`\n🛑  DISK SPACE CRITICAL after ${technique}: ${freeGB.toFixed(1)} GB free. Halting.`);
      break;
    }
  }

  // ---------------------------------------------------------------------------
  // Aggregate Production Manifest
  // ---------------------------------------------------------------------------

  const globalElapsed = performance.now() - globalT0;
  const totalGenerated = summaries.reduce((s, t) => s + t.totalGenerated, 0);
  const totalFailed = summaries.reduce((s, t) => s + t.totalFailed, 0);
  const totalPreExisting = summaries.reduce((s, t) => s + t.preExistingCount, 0);
  const totalBatchesOk = summaries.reduce((s, t) => s + t.batchesCompleted, 0);
  const totalBatchesFail = summaries.reduce((s, t) => s + t.batchesFailed, 0);

  const productionManifest = {
    runId: `run-${Date.now()}`,
    generatedAt: new Date().toISOString(),
    version: 'v2-global-scale',
    techniques: summaries.map(s => {
      const config = TECHNIQUE_CONFIGS[s.technique];
      return {
        technique: s.technique,
        targetSamples: SAMPLES_PER_TECHNIQUE,
        preExisting: s.preExistingCount,
        generatedThisRun: s.totalGenerated,
        totalNow: s.preExistingCount + s.totalGenerated,
        failedSamples: s.totalFailed,
        batchesCompleted: s.batchesCompleted,
        batchesFailed: s.batchesFailed,
        elapsedSeconds: +(s.totalElapsed / 1000).toFixed(2),
        pointCount: config.pointCount,
        snr: config.snr,
      };
    }),
    aggregate: {
      totalTargetSamples: totalTarget,
      totalPreExisting,
      totalGeneratedThisRun: totalGenerated,
      totalFailed,
      totalNow: totalPreExisting + totalGenerated,
      totalBatchesCompleted: totalBatchesOk,
      totalBatchesFailed: totalBatchesFail,
      totalElapsedSeconds: +(globalElapsed / 1000).toFixed(2),
      throughputSamplesPerSec: +(totalGenerated / (globalElapsed / 1000)).toFixed(1),
    },
    outputRoot: OUTPUT_ROOT,
    storagePolicy: 'STRICTLY D: drive only — zero C: drive writes',
    diskSpaceRemainingGB: +(getFreeSpaceGB()).toFixed(1),
  };

  await writeFile(
    join(OUTPUT_ROOT, 'production-manifest.json'),
    JSON.stringify(productionManifest, null, 2),
    'utf-8',
  );

  // ---------------------------------------------------------------------------
  // Final Report
  // ---------------------------------------------------------------------------

  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════════════════╗');
  console.log('║                    PRODUCTION RUN COMPLETE                             ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════╝');
  console.log('');

  for (const s of summaries) {
    const status = s.batchesFailed === 0 ? '✅' : '⚠️';
    const total = s.preExistingCount + s.totalGenerated;
    const complete = total >= SAMPLES_PER_TECHNIQUE;
    console.log(
      `  ${status}  ${s.technique.padEnd(6)} → ` +
      `${total.toLocaleString().padStart(6)} total ` +
      `(${s.preExistingCount.toLocaleString().padStart(6)} existing + ` +
      `${s.totalGenerated.toLocaleString().padStart(6)} new) | ` +
      `${s.batchesCompleted} batches | ` +
      `${s.batchesFailed} failed | ` +
      `${(s.totalElapsed / 1000).toFixed(1)}s` +
      (complete ? ' 🏁' : '')
    );
  }

  console.log('');
  console.log(`  📊  Pre-existing     : ${totalPreExisting.toLocaleString()}`);
  console.log(`  🆕  Generated (run)  : ${totalGenerated.toLocaleString()}`);
  console.log(`  📦  Total now        : ${(totalPreExisting + totalGenerated).toLocaleString()} / ${totalTarget.toLocaleString()}`);
  console.log(`  ❌  Failed (run)     : ${totalFailed.toLocaleString()}`);
  console.log(`  📦  Batches OK (run) : ${totalBatchesOk}`);
  console.log(`  💥  Batches failed   : ${totalBatchesFail}`);
  console.log(`  ⏱️   Total time       : ${(globalElapsed / 1000).toFixed(1)}s (${(globalElapsed / 60000).toFixed(1)} min)`);
  console.log(`  🚀  Throughput       : ${(totalGenerated / (globalElapsed / 1000)).toFixed(0)} samples/s`);
  console.log(`  💾  Disk remaining   : ${getFreeSpaceGB().toFixed(1)} GB`);
  console.log(`  📁  Output           : ${OUTPUT_ROOT}`);
  console.log(`  📋  Manifest         : ${join(OUTPUT_ROOT, 'production-manifest.json')}`);
  console.log('');
}

main().catch((err) => {
  console.error('\n💥  FATAL ERROR in production loop:', err);
  process.exit(1);
});