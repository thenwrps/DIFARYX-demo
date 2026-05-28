/**
 * Reasoning Engine — Scientific Knowledge Base
 *
 * Material-specific reference data and cross-validation rules.
 * Currently implements TiO₂ (Anatase/Rutile) as the primary case study.
 * All parameters are sourced from published crystallographic and spectroscopic
 * reference data.
 *
 * @module reasoningEngine/knowledgeBase
 */

import type { Technique } from '../../types/universalTechnique';
import type {
  MaterialSystem,
  CrystalPhase,
  TechniquePair,
} from './types';

// ---------------------------------------------------------------------------
// XRD Reference Data
// ---------------------------------------------------------------------------

/**
 * Known XRD peak position for a crystal phase.
 */
export interface XrdPeakReference {
  /** Miller indices (e.g., '101', '110'). */
  hkl: string;
  /** Expected 2θ position in degrees (Cu Kα, λ = 1.5406 Å). */
  twoTheta: number;
  /** Tolerance window in °2θ for matching. */
  tolerance: number;
  /** Relative intensity (0–100 scale, strongest = 100). */
  relativeIntensity: number;
  /** d-spacing in Ångströms. */
  dSpacing: number;
}

/**
 * Crystal phase XRD reference pattern.
 */
export interface XrdPhaseReference {
  /** Phase name. */
  phase: CrystalPhase;
  /** Reference XRD peaks sorted by relative intensity (descending). */
  peaks: readonly XrdPeakReference[];
  /** Space group number. */
  spaceGroupNumber: number;
}

// ---------------------------------------------------------------------------
// Raman Reference Data
// ---------------------------------------------------------------------------

/**
 * Known Raman-active vibrational mode.
 */
export interface RamanModeReference {
  /** Mode assignment (e.g., 'Eg', 'A1g', 'B1g'). */
  mode: string;
  /** Expected Raman shift in cm⁻¹. */
  wavenumber: number;
  /** Tolerance window in cm⁻¹ for matching. */
  tolerance: number;
  /** Relative intensity category. */
  intensity: 'very_strong' | 'strong' | 'medium' | 'weak';
  /** Whether this is a first-order mode. */
  firstOrder: boolean;
}

/**
 * Phase-specific Raman reference data.
 */
export interface RamanPhaseReference {
  /** Phase name. */
  phaseName: string;
  /** Raman-active modes. */
  modes: readonly RamanModeReference[];
  /** Space group symmetry label. */
  symmetryLabel: string;
  /** Total expected Raman-active modes. */
  totalModes: number;
}

// ---------------------------------------------------------------------------
// XPS Reference Data
// ---------------------------------------------------------------------------

/**
 * Known XPS binding energy reference.
 */
export interface XpsPeakReference {
  /** Core-level orbital (e.g., 'Ti 2p3/2'). */
  orbital: string;
  /** Expected binding energy in eV. */
  bindingEnergy: number;
  /** Tolerance window in eV. */
  tolerance: number;
  /** Chemical state assignment. */
  chemicalState: string;
  /** Spin-orbit splitting partner orbital (if applicable). */
  spinOrbitPartner?: string;
  /** Expected spin-orbit splitting energy in eV. */
  spinOrbitSplitting?: number;
}

/**
 * Material-specific XPS reference data.
 */
export interface XpsMaterialReference {
  /** Material formula. */
  material: string;
  /** Oxidation state being referenced. */
  oxidationState: string;
  /** XPS peak references. */
  peaks: readonly XpsPeakReference[];
}

// ---------------------------------------------------------------------------
// FTIR Reference Data
// ---------------------------------------------------------------------------

/**
 * Known FTIR absorption band reference.
 */
export interface FtirBandReference {
  /** Vibrational mode assignment. */
  vibrationalMode: string;
  /** Expected wavenumber center in cm⁻¹. */
  wavenumberCenter: number;
  /** Wavenumber range [min, max] in cm⁻¹. */
  wavenumberRange: readonly [number, number];
  /** Expected band shape. */
  bandType: 'sharp' | 'broad' | 'shoulder';
  /** Expected intensity. */
  intensity: 'strong' | 'medium' | 'weak';
  /** Functional group assignment. */
  functionalGroup: string;
}

/**
 * Material-specific FTIR reference data.
 */
export interface FtirMaterialReference {
  /** Material formula. */
  material: string;
  /** Phase (if phase-dependent). */
  phase?: string;
  /** IR absorption bands. */
  bands: readonly FtirBandReference[];
}

// ---------------------------------------------------------------------------
// Cross-Validation Rule Definition
// ---------------------------------------------------------------------------

/**
 * Definition of a cross-validation rule.
 */
export interface CrossValidationRule {
  /** Unique rule identifier. */
  id: string;
  /** Human-readable rule name. */
  name: string;
  /** Techniques involved. */
  techniques: TechniquePair;
  /** Material systems this rule applies to. */
  applicableMaterials: MaterialSystem[];
  /** Importance weight for scoring [0.0, 1.0]. */
  weight: number;
  /** Human-readable description of what this rule checks. */
  description: string;
}

// =========================================================================
// TiO₂ Anatase Reference Data
// =========================================================================

export const ANATASE_PHASE: CrystalPhase = {
  name: 'anatase',
  spaceGroup: 'I41/amd',
  crystalSystem: 'tetragonal',
};

export const ANATASE_XRD: XrdPhaseReference = {
  phase: ANATASE_PHASE,
  spaceGroupNumber: 141,
  peaks: [
    { hkl: '101', twoTheta: 25.28, tolerance: 0.15, relativeIntensity: 100, dSpacing: 3.52 },
    { hkl: '103', twoTheta: 36.95, tolerance: 0.15, relativeIntensity: 10, dSpacing: 2.43 },
    { hkl: '004', twoTheta: 37.80, tolerance: 0.15, relativeIntensity: 20, dSpacing: 2.38 },
    { hkl: '112', twoTheta: 38.57, tolerance: 0.15, relativeIntensity: 10, dSpacing: 2.33 },
    { hkl: '200', twoTheta: 48.05, tolerance: 0.15, relativeIntensity: 35, dSpacing: 1.89 },
    { hkl: '105', twoTheta: 53.89, tolerance: 0.15, relativeIntensity: 20, dSpacing: 1.70 },
    { hkl: '211', twoTheta: 55.06, tolerance: 0.15, relativeIntensity: 20, dSpacing: 1.67 },
    { hkl: '204', twoTheta: 62.69, tolerance: 0.15, relativeIntensity: 14, dSpacing: 1.48 },
    { hkl: '116', twoTheta: 68.76, tolerance: 0.15, relativeIntensity: 6, dSpacing: 1.36 },
    { hkl: '220', twoTheta: 70.31, tolerance: 0.15, relativeIntensity: 6, dSpacing: 1.34 },
    { hkl: '215', twoTheta: 75.03, tolerance: 0.15, relativeIntensity: 10, dSpacing: 1.27 },
  ],
} as const;

export const ANATASE_RAMAN: RamanPhaseReference = {
  phaseName: 'anatase',
  symmetryLabel: 'D4h (I41/amd)',
  totalModes: 6,
  modes: [
    { mode: 'Eg(1)', wavenumber: 144, tolerance: 5, intensity: 'very_strong', firstOrder: true },
    { mode: 'Eg(2)', wavenumber: 197, tolerance: 5, intensity: 'weak', firstOrder: true },
    { mode: 'B1g(1)', wavenumber: 399, tolerance: 8, intensity: 'medium', firstOrder: true },
    { mode: 'A1g', wavenumber: 513, tolerance: 8, intensity: 'medium', firstOrder: true },
    { mode: 'B1g(2)', wavenumber: 519, tolerance: 8, intensity: 'weak', firstOrder: true },
    { mode: 'Eg(3)', wavenumber: 639, tolerance: 8, intensity: 'strong', firstOrder: true },
  ],
} as const;

// =========================================================================
// TiO₂ Rutile Reference Data
// =========================================================================

export const RUTILE_PHASE: CrystalPhase = {
  name: 'rutile',
  spaceGroup: 'P42/mnm',
  crystalSystem: 'tetragonal',
};

export const RUTILE_XRD: XrdPhaseReference = {
  phase: RUTILE_PHASE,
  spaceGroupNumber: 136,
  peaks: [
    { hkl: '110', twoTheta: 27.45, tolerance: 0.15, relativeIntensity: 100, dSpacing: 3.25 },
    { hkl: '101', twoTheta: 36.09, tolerance: 0.15, relativeIntensity: 50, dSpacing: 2.49 },
    { hkl: '200', twoTheta: 39.19, tolerance: 0.15, relativeIntensity: 8, dSpacing: 2.30 },
    { hkl: '111', twoTheta: 41.23, tolerance: 0.15, relativeIntensity: 25, dSpacing: 2.19 },
    { hkl: '210', twoTheta: 44.05, tolerance: 0.15, relativeIntensity: 10, dSpacing: 2.05 },
    { hkl: '211', twoTheta: 54.32, tolerance: 0.15, relativeIntensity: 60, dSpacing: 1.69 },
    { hkl: '220', twoTheta: 56.64, tolerance: 0.15, relativeIntensity: 20, dSpacing: 1.62 },
    { hkl: '002', twoTheta: 62.75, tolerance: 0.15, relativeIntensity: 8, dSpacing: 1.48 },
    { hkl: '310', twoTheta: 64.04, tolerance: 0.15, relativeIntensity: 15, dSpacing: 1.45 },
    { hkl: '301', twoTheta: 69.01, tolerance: 0.15, relativeIntensity: 10, dSpacing: 1.36 },
    { hkl: '112', twoTheta: 69.79, tolerance: 0.15, relativeIntensity: 8, dSpacing: 1.35 },
  ],
} as const;

export const RUTILE_RAMAN: RamanPhaseReference = {
  phaseName: 'rutile',
  symmetryLabel: 'D4h (P42/mnm)',
  totalModes: 4,
  modes: [
    { mode: 'B1g', wavenumber: 143, tolerance: 5, intensity: 'weak', firstOrder: true },
    { mode: 'Eg', wavenumber: 447, tolerance: 8, intensity: 'strong', firstOrder: true },
    { mode: 'A1g', wavenumber: 612, tolerance: 8, intensity: 'strong', firstOrder: true },
    { mode: 'B2g', wavenumber: 825, tolerance: 15, intensity: 'weak', firstOrder: true },
  ],
} as const;

// Critical overlap region: Anatase Eg(1) at 144 vs Rutile B1g at 143 cm⁻¹
// This is the most ambiguous region in TiO₂ Raman analysis.
export const TIO2_RAMAN_OVERLAP_ZONE = {
  center: 143.5,
  halfWidth: 5,
  anataseMarker: 'Eg(1) at 144 cm⁻¹',
  rutileMarker: 'B1g at 143 cm⁻¹',
  discriminatingModes: {
    anataseSecondary: [399, 513, 639],   // B1g, A1g, Eg(3)
    rutileSecondary: [447, 612, 825],    // Eg, A1g, B2g
  },
} as const;

// =========================================================================
// TiO₂ XPS Reference Data
// =========================================================================

export const TI4_PLUS_XPS: XpsMaterialReference = {
  material: 'TiO2',
  oxidationState: 'Ti⁴⁺',
  peaks: [
    {
      orbital: 'Ti 2p3/2',
      bindingEnergy: 458.5,
      tolerance: 0.5,
      chemicalState: 'Ti⁴⁺',
      spinOrbitPartner: 'Ti 2p1/2',
      spinOrbitSplitting: 5.7,
    },
    {
      orbital: 'Ti 2p1/2',
      bindingEnergy: 464.2,
      tolerance: 0.5,
      chemicalState: 'Ti⁴⁺',
    },
    {
      orbital: 'O 1s (lattice)',
      bindingEnergy: 529.7,
      tolerance: 0.4,
      chemicalState: 'O²⁻ (lattice)',
    },
    {
      orbital: 'O 1s (hydroxyl)',
      bindingEnergy: 531.2,
      tolerance: 0.5,
      chemicalState: 'OH⁻ (surface)',
    },
    {
      orbital: 'Ti 3p',
      bindingEnergy: 37.5,
      tolerance: 1.0,
      chemicalState: 'Ti⁴⁺',
    },
  ],
} as const;

// Ti³⁺ reference for contradiction detection
export const TI3_PLUS_XPS: XpsMaterialReference = {
  material: 'Ti2O3',
  oxidationState: 'Ti³⁺',
  peaks: [
    {
      orbital: 'Ti 2p3/2',
      bindingEnergy: 456.8,
      tolerance: 0.5,
      chemicalState: 'Ti³⁺',
      spinOrbitPartner: 'Ti 2p1/2',
      spinOrbitSplitting: 5.6,
    },
    {
      orbital: 'Ti 2p1/2',
      bindingEnergy: 462.4,
      tolerance: 0.5,
      chemicalState: 'Ti³⁺',
    },
  ],
} as const;

// =========================================================================
// TiO₂ FTIR Reference Data
// =========================================================================

export const ANATASE_FTIR: FtirMaterialReference = {
  material: 'TiO2',
  phase: 'anatase',
  bands: [
    {
      vibrationalMode: 'Ti-O stretching',
      wavenumberCenter: 450,
      wavenumberRange: [400, 500],
      bandType: 'broad',
      intensity: 'strong',
      functionalGroup: 'Ti-O (lattice)',
    },
    {
      vibrationalMode: 'Ti-O-Ti bridging',
      wavenumberCenter: 560,
      wavenumberRange: [520, 620],
      bandType: 'broad',
      intensity: 'strong',
      functionalGroup: 'Ti-O-Ti',
    },
    {
      vibrationalMode: 'Ti-O-Ti asymmetric stretch',
      wavenumberCenter: 820,
      wavenumberRange: [750, 900],
      bandType: 'broad',
      intensity: 'medium',
      functionalGroup: 'Ti-O-Ti',
    },
    {
      vibrationalMode: 'O-H stretching (surface)',
      wavenumberCenter: 3400,
      wavenumberRange: [3100, 3600],
      bandType: 'broad',
      intensity: 'medium',
      functionalGroup: 'hydroxyl',
    },
    {
      vibrationalMode: 'H-O-H bending (adsorbed water)',
      wavenumberCenter: 1630,
      wavenumberRange: [1590, 1660],
      bandType: 'broad',
      intensity: 'weak',
      functionalGroup: 'water',
    },
  ],
} as const;

export const RUTILE_FTIR: FtirMaterialReference = {
  material: 'TiO2',
  phase: 'rutile',
  bands: [
    {
      vibrationalMode: 'Ti-O stretching',
      wavenumberCenter: 430,
      wavenumberRange: [380, 480],
      bandType: 'broad',
      intensity: 'strong',
      functionalGroup: 'Ti-O (lattice)',
    },
    {
      vibrationalMode: 'Ti-O-Ti stretching',
      wavenumberCenter: 530,
      wavenumberRange: [490, 580],
      bandType: 'broad',
      intensity: 'strong',
      functionalGroup: 'Ti-O-Ti',
    },
    {
      vibrationalMode: 'O-H stretching (surface)',
      wavenumberCenter: 3400,
      wavenumberRange: [3100, 3600],
      bandType: 'broad',
      intensity: 'medium',
      functionalGroup: 'hydroxyl',
    },
  ],
} as const;

// =========================================================================
// Cross-Validation Rules Registry
// =========================================================================

export const CROSS_VALIDATION_RULES: readonly CrossValidationRule[] = [
  {
    id: 'CV-001',
    name: 'XRD Phase ↔ Raman Active Modes',
    techniques: ['XRD', 'Raman'],
    applicableMaterials: ['TiO2', 'generic'],
    weight: 1.0,
    description: 'Verifies that the crystal phase identified by XRD matches the Raman-active phonon modes. Anatase I41/amd → 6 modes (Eg 144 cm⁻¹ primary); Rutile P42/mnm → 4 modes (A1g 612 cm⁻¹ primary).',
  },
  {
    id: 'CV-002',
    name: 'XRD Phase ↔ XPS Ti⁴⁺ Binding Energy',
    techniques: ['XRD', 'XPS'],
    applicableMaterials: ['TiO2', 'generic'],
    weight: 0.95,
    description: 'Confirms that the oxidation state from XPS (Ti 2p3/2 at 458.5 eV for Ti⁴⁺) is consistent with the crystallographic phase identified by XRD. Both anatase and rutile should show Ti⁴⁺.',
  },
  {
    id: 'CV-003',
    name: 'XRD Crystallite Size ↔ Raman Peak Broadening',
    techniques: ['XRD', 'Raman'],
    applicableMaterials: ['TiO2', 'generic'],
    weight: 0.7,
    description: 'Checks that Scherrer crystallite size from XRD peak broadening is consistent with Raman phonon confinement broadening. Nanoparticles <10 nm show asymmetric Raman peak broadening.',
  },
  {
    id: 'CV-004',
    name: 'XPS O 1s ↔ FTIR Ti-O Bands',
    techniques: ['XPS', 'FTIR'],
    applicableMaterials: ['TiO2', 'generic'],
    weight: 0.8,
    description: 'Verifies oxygen bonding consistency between XPS O 1s lattice oxygen at 529.7 eV and FTIR Ti-O stretching bands at 400–600 cm⁻¹.',
  },
  {
    id: 'CV-005',
    name: 'Raman Mode Ratio ↔ XRD Phase Fraction',
    techniques: ['Raman', 'XRD'],
    applicableMaterials: ['TiO2', 'generic'],
    weight: 0.85,
    description: 'Quantitative phase agreement: Raman intensity ratios of anatase Eg(144)/rutile Eg(447) should correlate with XRD-derived anatase/rutile phase fraction (Spurr-Myers method).',
  },
  {
    id: 'CV-006',
    name: 'FTIR Surface Species ↔ XPS Surface Oxidation',
    techniques: ['FTIR', 'XPS'],
    applicableMaterials: ['TiO2', 'generic'],
    weight: 0.75,
    description: 'Cross-checks surface chemistry: FTIR surface OH bands (3200–3600 cm⁻¹) should correlate with XPS O 1s hydroxyl component at 531.2 eV.',
  },
  {
    id: 'CV-007',
    name: 'XRD Amorphous Fraction ↔ Raman Disorder Bands',
    techniques: ['XRD', 'Raman'],
    applicableMaterials: ['TiO2', 'generic'],
    weight: 0.65,
    description: 'Amorphous content cross-check: broad XRD background hump should correlate with broad Raman disorder bands. Highly crystalline samples show sharp, well-resolved Raman peaks.',
  },
  {
    id: 'CV-008',
    name: 'XPS Ti 2p Spin-Orbit Splitting Validation',
    techniques: ['XPS', 'XPS'],
    applicableMaterials: ['TiO2', 'generic'],
    weight: 0.9,
    description: 'Internal XPS consistency: Ti 2p3/2 and Ti 2p1/2 separation should be 5.7 ± 0.3 eV for Ti⁴⁺. Deviation indicates mixed oxidation states or charging effects.',
  },
  {
    id: 'CV-009',
    name: 'FTIR Carbonate ↔ XPS C 1s Contamination',
    techniques: ['FTIR', 'XPS'],
    applicableMaterials: ['TiO2', 'generic'],
    weight: 0.5,
    description: 'Contamination cross-check: FTIR carbonate bands (1380, 1630 cm⁻¹) should correlate with XPS C 1s adventitious carbon at 284.8 eV and any carbonate component at 289.0 eV.',
  },
  {
    id: 'CV-010',
    name: 'Raman Crystallinity ↔ XRD Peak Sharpness',
    techniques: ['Raman', 'XRD'],
    applicableMaterials: ['TiO2', 'generic'],
    weight: 0.8,
    description: 'Overall crystallinity agreement: sharp XRD peaks (low FWHM) should correspond to narrow, well-resolved Raman modes. Broad XRD peaks indicate nanocrystallinity and Raman broadening.',
  },
  {
    id: 'CV-011',
    name: 'XRD Phase Mixture ↔ FTIR Band Deconvolution',
    techniques: ['XRD', 'FTIR'],
    applicableMaterials: ['TiO2', 'generic'],
    weight: 0.7,
    description: 'Multi-phase consistency: if XRD identifies anatase+rutile mixture, FTIR should show bands from both phases (anatase 450/560 cm⁻¹ + rutile 430/530 cm⁻¹).',
  },
  {
    id: 'CV-012',
    name: 'Overall Oxidation State Consistency',
    techniques: ['XPS', 'Raman'],
    applicableMaterials: ['TiO2', 'generic'],
    weight: 0.85,
    description: 'Cross-technique oxidation state validation: XPS Ti⁴⁺ assignment (458.5 eV) should be consistent with Raman showing TiO₂ modes (no Ti₂O₃ A2u mode at 243 cm⁻¹).',
  },
] as const;

// =========================================================================
// Gap Recommendation Templates
// =========================================================================

/**
 * Pre-defined next-step recommendations for common TiO₂ gaps.
 */
export const TIO2_RECOMMENDATIONS = {
  missingXps: {
    stepType: 'characterization' as const,
    recommendedTechnique: 'XPS' as Technique,
    description: 'Perform XPS Ti 2p analysis to confirm Ti⁴⁺ oxidation state and check for Ti³⁺ reduction.',
    rationale: 'XPS provides direct oxidation state evidence via Ti 2p3/2 binding energy (458.5 eV for Ti⁴⁺). Essential for confirming the electronic state matches the crystallographic phase.',
    expectedConfidenceImpact: 0.25,
  },
  missingFtir: {
    stepType: 'characterization' as const,
    recommendedTechnique: 'FTIR' as Technique,
    description: 'Collect FTIR spectrum in the 400–4000 cm⁻¹ range to identify Ti-O vibrational modes and surface species.',
    rationale: 'FTIR confirms metal-oxygen bonding environment (Ti-O at 400–600 cm⁻¹) and identifies surface hydroxyl groups critical for photocatalytic activity assessment.',
    expectedConfidenceImpact: 0.20,
  },
  missingRaman: {
    stepType: 'characterization' as const,
    recommendedTechnique: 'Raman' as Technique,
    description: 'Perform Raman spectroscopy with 532 nm excitation to fingerprint anatase vs rutile phases.',
    rationale: 'Raman provides unambiguous phase discrimination: anatase Eg at 144 cm⁻¹ vs rutile A1g at 612 cm⁻¹, resolving the overlap region around 143–144 cm⁻¹ with secondary modes.',
    expectedConfidenceImpact: 0.25,
  },
  missingXrd: {
    stepType: 'characterization' as const,
    recommendedTechnique: 'XRD' as Technique,
    description: 'Perform XRD analysis (Cu Kα, 20–80° 2θ) for crystallographic phase identification and crystallite size determination.',
    rationale: 'XRD provides definitive crystal structure identification: anatase (25.28° 101) vs rutile (27.45° 110). Scherrer analysis yields crystallite size from peak broadening.',
    expectedConfidenceImpact: 0.25,
  },
  xrdRamanMismatch: {
    stepType: 'validation' as const,
    recommendedTechnique: 'TEM' as Technique,
    description: 'Collect TEM/SAED images for direct crystallographic phase imaging to resolve XRD/Raman disagreement.',
    rationale: 'TEM-SAED provides real-space and reciprocal-space structural information at the individual particle level, resolving ensemble-averaged XRD/Raman discrepancies from mixed-phase samples.',
    expectedConfidenceImpact: 0.15,
  },
  oxidationStateConflict: {
    stepType: 'validation' as const,
    recommendedTechnique: 'XAS' as Technique,
    description: 'Perform Ti K-edge XANES analysis to independently confirm oxidation state via pre-edge feature shape and edge position.',
    rationale: 'XANES is element-specific and oxidation-state-sensitive. The Ti K-edge pre-edge feature at ~4968 eV shifts with oxidation state, providing independent confirmation of Ti³⁺ vs Ti⁴⁺.',
    expectedConfidenceImpact: 0.20,
  },
  bandGapVerification: {
    stepType: 'exploration' as const,
    recommendedTechnique: 'XPS' as Technique,
    description: 'Perform UV-Vis Diffuse Reflectance Spectroscopy (DRS) for band gap determination (3.2 eV anatase vs 3.0 eV rutile).',
    rationale: 'Band gap energy provides indirect phase identification: anatase Eg = 3.2 eV (direct) vs rutile Eg = 3.0 eV (indirect). Tauc plot analysis from DRS data yields quantitative phase discrimination.',
    expectedConfidenceImpact: 0.10,
  },
  amorphousContent: {
    stepType: 'exploration' as const,
    recommendedTechnique: 'TEM' as Technique,
    description: 'Run pair distribution function (PDF) analysis or high-temperature XRD to quantify amorphous fraction.',
    rationale: 'PDF analysis from total scattering data provides local structure information even in disordered/amorphous phases, enabling quantification of amorphous TiO₂ content.',
    expectedConfidenceImpact: 0.15,
  },
  surfaceChemistryGap: {
    stepType: 'characterization' as const,
    recommendedTechnique: 'FTIR' as Technique,
    description: 'Perform FTIR-ATR analysis for surface species identification and compare with XPS surface composition.',
    rationale: 'Combining FTIR vibrational information with XPS elemental/chemical state data provides a complete picture of surface chemistry including hydroxyl coverage, adsorbed species, and carbonate contamination.',
    expectedConfidenceImpact: 0.10,
  },
} as const;

// =========================================================================
// Utility Functions
// =========================================================================

/**
 * Get the XRD reference for a TiO₂ phase by name.
 */
export function getTiO2XrdPhase(phaseName: string): XrdPhaseReference | undefined {
  if (phaseName.toLowerCase() === 'anatase') return ANATASE_XRD;
  if (phaseName.toLowerCase() === 'rutile') return RUTILE_XRD;
  return undefined;
}

/**
 * Get the Raman reference for a TiO₂ phase by name.
 */
export function getTiO2RamanPhase(phaseName: string): RamanPhaseReference | undefined {
  if (phaseName.toLowerCase() === 'anatase') return ANATASE_RAMAN;
  if (phaseName.toLowerCase() === 'rutile') return RUTILE_RAMAN;
  return undefined;
}

/**
 * Get the FTIR reference for a TiO₂ phase by name.
 */
export function getTiO2FtirPhase(phaseName: string): FtirMaterialReference | undefined {
  if (phaseName.toLowerCase() === 'anatase') return ANATASE_FTIR;
  if (phaseName.toLowerCase() === 'rutile') return RUTILE_FTIR;
  return undefined;
}

/**
 * Get all cross-validation rules applicable to a material system.
 */
export function getRulesForMaterial(material: MaterialSystem): readonly CrossValidationRule[] {
  return CROSS_VALIDATION_RULES.filter(
    (r) => r.applicableMaterials.includes(material) || r.applicableMaterials.includes('generic'),
  );
}