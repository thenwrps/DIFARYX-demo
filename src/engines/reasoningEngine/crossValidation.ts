/**
 * Reasoning Engine — Cross-Validation Logic (Stage 4)
 *
 * Implements 12 deterministic cross-correlation checks between XRD, XPS,
 * FTIR, and Raman evidence. Each check is a pure function that takes a
 * TechniqueEvidenceBundle and returns a CorrelationResult.
 *
 * @module reasoningEngine/crossValidation
 */

import type { UniversalEvidenceNode } from '../../types/universalEvidence';
import type { Technique } from '../../types/universalTechnique';
import type {
  TechniqueEvidenceBundle,
  CorrelationResult,
  CrossValidationReport,
  MaterialSystem,
} from './types';
import {
  CROSS_VALIDATION_RULES,
  ANATASE_XRD,
  RUTILE_XRD,
  ANATASE_RAMAN,
  RUTILE_RAMAN,
  TIO2_RAMAN_OVERLAP_ZONE,
  TI4_PLUS_XPS,
  TI3_PLUS_XPS,
  ANATASE_FTIR,
  RUTILE_FTIR,
  getRulesForMaterial,
} from './knowledgeBase';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate a deterministic timestamp. */
function now(): string {
  return new Date().toISOString();
}

/** Clamp a value to [0, 1]. */
function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/**
 * Find XRD evidence nodes from a bundle.
 */
function getXrdEvidence(bundle: TechniqueEvidenceBundle): UniversalEvidenceNode[] {
  return bundle.evidenceByTechnique['XRD'] ?? [];
}

/** Find XPS evidence nodes. */
function getXpsEvidence(bundle: TechniqueEvidenceBundle): UniversalEvidenceNode[] {
  return bundle.evidenceByTechnique['XPS'] ?? [];
}

/** Find FTIR evidence nodes. */
function getFtirEvidence(bundle: TechniqueEvidenceBundle): UniversalEvidenceNode[] {
  return bundle.evidenceByTechnique['FTIR'] ?? [];
}

/** Find Raman evidence nodes. */
function getRamanEvidence(bundle: TechniqueEvidenceBundle): UniversalEvidenceNode[] {
  return bundle.evidenceByTechnique['Raman'] ?? [];
}

/** Extract node IDs from an evidence array. */
function nodeIds(nodes: UniversalEvidenceNode[]): string[] {
  return nodes.map((n) => n.id);
}

/**
 * Match observed peaks/positions against a reference array within tolerance.
 * Returns the fraction of reference entries that have a match.
 */
function matchFraction<T extends { tolerance: number }>(
  observed: number[],
  references: ReadonlyArray<T>,
  getRefValue: (r: T) => number,
): { matched: number; total: number; fraction: number } {
  let matched = 0;
  const total = references.length;
  const used = new Set<number>();

  for (const ref of references) {
    const refVal = getRefValue(ref);
    for (let i = 0; i < observed.length; i++) {
      if (used.has(i)) continue;
      if (Math.abs(observed[i] - refVal) <= ref.tolerance) {
        matched++;
        used.add(i);
        break;
      }
    }
  }

  return { matched, total, fraction: total > 0 ? matched / total : 0 };
}

/**
 * Infer which TiO₂ phases are present from XRD evidence by checking
 * peak positions against reference patterns.
 */
function inferXrdPhases(
  xrdNodes: UniversalEvidenceNode[],
): { phases: string[]; anataseMatch: number; rutileMatch: number } {
  const positions = xrdNodes.map((n) => n.primaryAxis);

  const anataseRef = ANATASE_XRD.peaks;
  const rutileRef = RUTILE_XRD.peaks;

  const anResult = matchFraction(positions, anataseRef, (r) => r.twoTheta);
  const ruResult = matchFraction(positions, rutileRef, (r) => r.twoTheta);

  const phases: string[] = [];
  if (anResult.fraction >= 0.3) phases.push('anatase');
  if (ruResult.fraction >= 0.3) phases.push('rutile');
  if (phases.length === 0 && xrdNodes.length > 0) phases.push('unknown');
  if (xrdNodes.length === 0) phases.push('none');

  return { phases, anataseMatch: anResult.fraction, rutileMatch: ruResult.fraction };
}

/**
 * Infer which Raman phases are present by checking wavenumbers against
 * reference mode positions.
 */
function inferRamanPhases(
  ramanNodes: UniversalEvidenceNode[],
): { phases: string[]; anataseMatch: number; rutileMatch: number } {
  const positions = ramanNodes.map((n) => n.primaryAxis);

  const anResult = matchFraction(positions, ANATASE_RAMAN.modes, (r) => r.wavenumber ?? 0);
  const ruResult = matchFraction(positions, RUTILE_RAMAN.modes, (r) => r.wavenumber ?? 0);

  const phases: string[] = [];
  if (anResult.fraction >= 0.3) phases.push('anatase');
  if (ruResult.fraction >= 0.3) phases.push('rutile');
  if (phases.length === 0 && ramanNodes.length > 0) phases.push('unknown');
  if (ramanNodes.length === 0) phases.push('none');

  return { phases, anataseMatch: anResult.fraction, rutileMatch: ruResult.fraction };
}

/**
 * Detect Ti oxidation state from XPS evidence.
 */
function inferXpsOxidationState(
  xpsNodes: UniversalEvidenceNode[],
): { oxidationState: string | null; confidence: number; ti2p32BE: number | null } {
  // Look for Ti 2p3/2 evidence
  const ti2p32 = xpsNodes.find(
    (n) => {
      const meta = n.techniqueMetadata as Record<string, unknown> | undefined;
      return meta?.orbital === 'Ti 2p3/2' ||
        n.label.toLowerCase().includes('ti 2p3/2') ||
        n.label.toLowerCase().includes('ti2p3/2');
    },
  );

  if (!ti2p32) {
    // Try to find any Ti-related XPS node
    const tiNode = xpsNodes.find(
      (n) => n.label.toLowerCase().includes('ti') || n.primaryAxis >= 454 && n.primaryAxis <= 470,
    );
    if (!tiNode) return { oxidationState: null, confidence: 0, ti2p32BE: null };
    return { oxidationState: null, confidence: 0.3, ti2p32BE: tiNode.primaryAxis };
  }

  const be = ti2p32.primaryAxis;
  const distTi4 = Math.abs(be - TI4_PLUS_XPS.peaks[0].bindingEnergy);
  const distTi3 = Math.abs(be - TI3_PLUS_XPS.peaks[0].bindingEnergy);

  if (distTi4 <= 0.5) {
    return { oxidationState: 'Ti⁴⁺', confidence: clamp01(1 - distTi4 / 0.5), ti2p32BE: be };
  }
  if (distTi3 <= 0.5) {
    return { oxidationState: 'Ti³⁺', confidence: clamp01(1 - distTi3 / 0.5), ti2p32BE: be };
  }
  // Outside both — could be mixed
  if (distTi4 < distTi3) {
    return { oxidationState: 'Ti⁴⁺ (uncertain)', confidence: 0.3, ti2p32BE: be };
  }
  return { oxidationState: 'Ti³⁺ (uncertain)', confidence: 0.3, ti2p32BE: be };
}

// ---------------------------------------------------------------------------
// Individual Correlation Check Functions
// ---------------------------------------------------------------------------

/**
 * CV-001: XRD Phase ↔ Raman Active Modes
 *
 * Verifies that the crystal phase identified by XRD matches Raman phonon modes.
 * Anatase I41/amd → 6 modes (Eg 144 cm⁻¹ primary)
 * Rutile P42/mnm → 4 modes (A1g 612 cm⁻¹ primary)
 */
function checkXrdPhaseVsRamanModes(bundle: TechniqueEvidenceBundle): CorrelationResult {
  const rule = CROSS_VALIDATION_RULES.find((r) => r.id === 'CV-001')!;
  const xrd = getXrdEvidence(bundle);
  const raman = getRamanEvidence(bundle);

  if (xrd.length === 0 || raman.length === 0) {
    return {
      ruleId: rule.id,
      ruleName: rule.name,
      techniques: rule.techniques,
      materialSystem: bundle.materialSystem,
      status: 'insufficient_data',
      confidence: 0,
      weight: rule.weight,
      participatingEvidenceIds: [...nodeIds(xrd), ...nodeIds(raman)],
      reasoning: `Insufficient data: ${xrd.length === 0 ? 'no XRD peaks' : ''} ${raman.length === 0 ? 'no Raman modes' : ''}. Cannot perform phase-mode correlation.`,
      timestamp: now(),
    };
  }

  const xrdPhases = inferXrdPhases(xrd);
  const ramanPhases = inferRamanPhases(raman);

  const xrdSet = new Set(xrdPhases.phases);
  const ramanSet = new Set(ramanPhases.phases);

  // Check overlap
  const common = xrdPhases.phases.filter((p) => ramanSet.has(p));
  const onlyXrd = xrdPhases.phases.filter((p) => !ramanSet.has(p));
  const onlyRaman = ramanPhases.phases.filter((p) => !xrdSet.has(p));

  let status: CorrelationResult['status'];
  let confidence: number;
  let reasoning: string;

  if (common.length > 0 && onlyXrd.length === 0 && onlyRaman.length === 0) {
    status = 'consistent';
    confidence = Math.min(xrdPhases.anataseMatch + ramanPhases.anataseMatch, 2) / 2;
    reasoning = `XRD phase(s) [${xrdPhases.phases.join(', ')}] match Raman-detected phase(s) [${ramanPhases.phases.join(', ')}]. ` +
      `XRD anatase match: ${(xrdPhases.anataseMatch * 100).toFixed(0)}%, Raman anatase match: ${(ramanPhases.anataseMatch * 100).toFixed(0)}%.`;
  } else if (common.length > 0 && (onlyXrd.length > 0 || onlyRaman.length > 0)) {
    status = 'partially_consistent';
    confidence = 0.5;
    reasoning = `Partial agreement: common phases [${common.join(', ')}]. ` +
      `XRD-only: [${onlyXrd.join(', ')}], Raman-only: [${onlyRaman.join(', ')}]. ` +
      `This may indicate mixed-phase material or sensitivity differences between techniques.`;
  } else {
    status = 'inconsistent';
    confidence = 0.2;
    reasoning = `XRD identifies [${xrdPhases.phases.join(', ')}] but Raman identifies [${ramanPhases.phases.join(', ')}]. ` +
      `This contradiction may arise from different sampling depths, orientation effects, or laser-induced phase transformation. ` +
      `Note: Anatase Eg(144) and Rutile B1g(143) overlap — secondary modes (anatase 399/513/639 vs rutile 447/612) are needed for discrimination.`;
  }

  return {
    ruleId: rule.id,
    ruleName: rule.name,
    techniques: rule.techniques,
    materialSystem: bundle.materialSystem,
    status,
    confidence: clamp01(confidence),
    weight: rule.weight,
    participatingEvidenceIds: [...nodeIds(xrd), ...nodeIds(raman)],
    reasoning,
    details: {
      xrdPhases,
      ramanPhases,
      commonPhases: common,
      overlapZone: TIO2_RAMAN_OVERLAP_ZONE,
    },
    timestamp: now(),
  };
}

/**
 * CV-002: XRD Phase ↔ XPS Ti⁴⁺ Binding Energy
 *
 * Both anatase and rutile should show Ti⁴⁺. Ti³⁺ would indicate reduction.
 */
function checkXrdPhaseVsXpsTi4(bundle: TechniqueEvidenceBundle): CorrelationResult {
  const rule = CROSS_VALIDATION_RULES.find((r) => r.id === 'CV-002')!;
  const xrd = getXrdEvidence(bundle);
  const xps = getXpsEvidence(bundle);

  if (xrd.length === 0 || xps.length === 0) {
    return {
      ruleId: rule.id,
      ruleName: rule.name,
      techniques: rule.techniques,
      materialSystem: bundle.materialSystem,
      status: 'insufficient_data',
      confidence: 0,
      weight: rule.weight,
      participatingEvidenceIds: [...nodeIds(xrd), ...nodeIds(xps)],
      reasoning: `Insufficient data: ${xrd.length === 0 ? 'no XRD peaks' : ''} ${xps.length === 0 ? 'no XPS data' : ''}.`,
      timestamp: now(),
    };
  }

  const xrdPhases = inferXrdPhases(xrd);
  const xpsState = inferXpsOxidationState(xps);

  const hasTiO2Phase = xrdPhases.phases.includes('anatase') || xrdPhases.phases.includes('rutile');
  const isTi4 = xpsState.oxidationState?.startsWith('Ti⁴⁺') ?? false;
  const isTi3 = xpsState.oxidationState?.startsWith('Ti³⁺') ?? false;

  let status: CorrelationResult['status'];
  let confidence: number;
  let reasoning: string;

  if (hasTiO2Phase && isTi4) {
    status = 'consistent';
    confidence = xpsState.confidence;
    reasoning = `XRD identifies TiO₂ phase(s) [${xrdPhases.phases.join(', ')}] and XPS confirms Ti⁴⁺ at ${xpsState.ti2p32BE?.toFixed(1)} eV. ` +
      `Ti⁴⁺ 2p3/2 reference: ${TI4_PLUS_XPS.peaks[0].bindingEnergy} ± ${TI4_PLUS_XPS.peaks[0].tolerance} eV. Consistent.`;
  } else if (hasTiO2Phase && isTi3) {
    status = 'inconsistent';
    confidence = 0.15;
    reasoning = `CRITICAL: XRD identifies TiO₂ phase(s) [${xrdPhases.phases.join(', ')}] but XPS indicates Ti³⁺ at ${xpsState.ti2p32BE?.toFixed(1)} eV. ` +
      `TiO₂ should have Ti⁴⁺ (458.5 eV), not Ti³⁺ (456.8 eV). This suggests surface reduction, oxygen vacancies, or sample degradation.`;
  } else if (hasTiO2Phase && xpsState.oxidationState === null) {
    status = 'partially_consistent';
    confidence = 0.4;
    reasoning = `XRD identifies TiO₂ phase(s) but XPS Ti oxidation state could not be determined. ` +
      `Ti 2p region may be absent or below detection limit.`;
  } else if (!hasTiO2Phase && isTi4) {
    status = 'partially_consistent';
    confidence = 0.4;
    reasoning = `XPS shows Ti⁴⁺ but XRD does not clearly identify a TiO₂ phase. ` +
      `The material may be amorphous TiO₂ (no diffraction peaks) or a different Ti⁴⁺ compound.`;
  } else {
    status = 'insufficient_data';
    confidence = 0.2;
    reasoning = `Could not establish XRD phase ↔ XPS oxidation state correlation. ` +
      `XRD phases: [${xrdPhases.phases.join(', ')}], XPS state: ${xpsState.oxidationState ?? 'undetermined'}.`;
  }

  return {
    ruleId: rule.id,
    ruleName: rule.name,
    techniques: rule.techniques,
    materialSystem: bundle.materialSystem,
    status,
    confidence: clamp01(confidence),
    weight: rule.weight,
    participatingEvidenceIds: [...nodeIds(xrd), ...nodeIds(xps)],
    reasoning,
    details: { xrdPhases, xpsOxidation: xpsState },
    timestamp: now(),
  };
}

/**
 * CV-003: XRD Crystallite Size ↔ Raman Peak Broadening
 *
 * Scherrer size from XRD FWHM should correlate with Raman phonon confinement effects.
 */
function checkXrdCrystalliteSizeVsRamanBroadening(bundle: TechniqueEvidenceBundle): CorrelationResult {
  const rule = CROSS_VALIDATION_RULES.find((r) => r.id === 'CV-003')!;
  const xrd = getXrdEvidence(bundle);
  const raman = getRamanEvidence(bundle);

  if (xrd.length === 0 || raman.length === 0) {
    return {
      ruleId: rule.id, ruleName: rule.name, techniques: rule.techniques,
      materialSystem: bundle.materialSystem, status: 'insufficient_data', confidence: 0,
      weight: rule.weight, participatingEvidenceIds: [...nodeIds(xrd), ...nodeIds(raman)],
      reasoning: 'Insufficient data for crystallite size vs Raman broadening check.',
      timestamp: now(),
    };
  }

  // Look for crystallite size in XRD metadata
  const xrdWithSize = xrd.filter((n) => {
    const meta = n.techniqueMetadata as Record<string, unknown> | undefined;
    return meta?.crystalliteSize !== undefined;
  });

  const xrdWithFwhm = xrd.filter((n) => {
    const meta = n.techniqueMetadata as Record<string, unknown> | undefined;
    return meta?.fwhm !== undefined;
  });

  // Look for Raman peak width info
  const ramanWithFwhm = raman.filter((n) => {
    const meta = n.techniqueMetadata as Record<string, unknown> | undefined;
    return meta?.fwhm !== undefined;
  });

  if (xrdWithSize.length === 0 && xrdWithFwhm.length === 0) {
    return {
      ruleId: rule.id, ruleName: rule.name, techniques: rule.techniques,
      materialSystem: bundle.materialSystem, status: 'insufficient_data', confidence: 0.3,
      weight: rule.weight, participatingEvidenceIds: [...nodeIds(xrd), ...nodeIds(raman)],
      reasoning: 'No crystallite size or FWHM data available in XRD evidence. Cannot assess size-broadening correlation.',
      timestamp: now(),
    };
  }

  // If we have crystallite size, assess expected Raman broadening
  let avgSize = 0;
  if (xrdWithSize.length > 0) {
    const sizes = xrdWithSize.map((n) => (n.techniqueMetadata as Record<string, unknown>).crystalliteSize as number);
    avgSize = sizes.reduce((a, b) => a + b, 0) / sizes.length;
  }

  // Nanoparticles <10 nm show significant Raman broadening (asymmetric)
  // >20 nm: sharp Raman peaks expected
  const isNanocrystalline = avgSize > 0 && avgSize < 10;
  const ramanIsBroad = raman.length > 0 && ramanWithFwhm.length > 0
    ? ramanWithFwhm.some((n) => ((n.techniqueMetadata as Record<string, unknown>).fwhm as number) > 15)
    : false;

  let status: CorrelationResult['status'];
  let confidence: number;
  let reasoning: string;

  if (avgSize > 0) {
    if (isNanocrystalline && ramanIsBroad) {
      status = 'consistent';
      confidence = 0.8;
      reasoning = `XRD crystallite size ${avgSize.toFixed(1)} nm (nanocrystalline) is consistent with broad Raman peaks (phonon confinement effect). ` +
        `Particles <10 nm show asymmetric Raman broadening and peak downshift.`;
    } else if (!isNanocrystalline && !ramanIsBroad) {
      status = 'consistent';
      confidence = 0.85;
      reasoning = `XRD crystallite size ${avgSize.toFixed(1)} nm (well-crystallized) is consistent with sharp Raman peaks. ` +
        `Both techniques indicate good crystallinity.`;
    } else if (isNanocrystalline && !ramanIsBroad) {
      status = 'partially_consistent';
      confidence = 0.45;
      reasoning = `XRD shows nanocrystalline size (${avgSize.toFixed(1)} nm) but Raman peaks appear sharp. ` +
        `Possible explanations: Raman signal dominated by larger particles, or non-resonant conditions.`;
    } else {
      status = 'partially_consistent';
      confidence = 0.45;
      reasoning = `XRD indicates larger crystallites but Raman peaks are broad. ` +
        `May indicate structural disorder, strain, or defects not detectable by XRD.`;
    }
  } else {
    // Only FWHM available, no explicit size
    const avgFwhm = xrdWithFwhm.reduce((a, n) => a + ((n.techniqueMetadata as Record<string, unknown>).fwhm as number), 0) / xrdWithFwhm.length;
    status = 'partially_consistent';
    confidence = 0.5;
    reasoning = `XRD average FWHM: ${avgFwhm.toFixed(2)}°2θ. Raman broadening ${ramanIsBroad ? 'observed' : 'not observed'}. ` +
      `Qualitative correlation assessed without explicit crystallite size calculation.`;
  }

  return {
    ruleId: rule.id, ruleName: rule.name, techniques: rule.techniques,
    materialSystem: bundle.materialSystem, status, confidence: clamp01(confidence),
    weight: rule.weight, participatingEvidenceIds: [...nodeIds(xrd), ...nodeIds(raman)],
    reasoning, details: { avgCrystalliteSize: avgSize }, timestamp: now(),
  };
}

/**
 * CV-004: XPS O 1s ↔ FTIR Ti-O Bands
 *
 * Lattice oxygen at 529.7 eV should correlate with Ti-O stretching at 400-600 cm⁻¹.
 */
function checkXpsO1sVsFtirTiO(bundle: TechniqueEvidenceBundle): CorrelationResult {
  const rule = CROSS_VALIDATION_RULES.find((r) => r.id === 'CV-004')!;
  const xps = getXpsEvidence(bundle);
  const ftir = getFtirEvidence(bundle);

  if (xps.length === 0 || ftir.length === 0) {
    return {
      ruleId: rule.id, ruleName: rule.name, techniques: rule.techniques,
      materialSystem: bundle.materialSystem, status: 'insufficient_data', confidence: 0,
      weight: rule.weight, participatingEvidenceIds: [...nodeIds(xps), ...nodeIds(ftir)],
      reasoning: 'Insufficient data: XPS or FTIR evidence missing.',
      timestamp: now(),
    };
  }

  // Check for O 1s lattice oxygen in XPS
  const o1sLattice = xps.find((n) => {
    const meta = n.techniqueMetadata as Record<string, unknown> | undefined;
    return (meta?.orbital as string)?.includes('O 1s') && n.primaryAxis >= 529 && n.primaryAxis <= 530.5;
  });

  // Check for Ti-O bands in FTIR (400-600 cm⁻¹)
  const ftirTiO = ftir.filter((n) => {
    return n.primaryAxis >= 380 && n.primaryAxis <= 650;
  });

  const hasO1s = o1sLattice !== undefined;
  const hasTiO = ftirTiO.length > 0;

  let status: CorrelationResult['status'];
  let confidence: number;
  let reasoning: string;

  if (hasO1s && hasTiO) {
    status = 'consistent';
    confidence = 0.85;
    reasoning = `XPS O 1s lattice oxygen detected at ${o1sLattice!.primaryAxis.toFixed(1)} eV (ref: 529.7 eV). ` +
      `FTIR Ti-O stretching bands found at ${ftirTiO.map((n) => n.primaryAxis.toFixed(0)).join(', ')} cm⁻¹. ` +
      `Both confirm lattice oxygen in metal-oxide framework.`;
  } else if (hasO1s && !hasTiO) {
    status = 'partially_consistent';
    confidence = 0.4;
    reasoning = `XPS shows lattice oxygen (O 1s at ${o1sLattice!.primaryAxis.toFixed(1)} eV) but FTIR lacks Ti-O bands in 400-600 cm⁻¹ region. ` +
      `FTIR may have limited low-wavenumber range or Ti-O bands are very broad/weak.`;
  } else if (!hasO1s && hasTiO) {
    status = 'partially_consistent';
    confidence = 0.45;
    reasoning = `FTIR shows metal-oxygen bands but XPS O 1s lattice oxygen not clearly identified. ` +
      `O 1s region may show predominantly surface hydroxyl species.`;
  } else {
    status = 'insufficient_data';
    confidence = 0.2;
    reasoning = 'Neither XPS O 1s lattice oxygen nor FTIR Ti-O bands could be identified.';
  }

  return {
    ruleId: rule.id, ruleName: rule.name, techniques: rule.techniques,
    materialSystem: bundle.materialSystem, status, confidence: clamp01(confidence),
    weight: rule.weight, participatingEvidenceIds: [...nodeIds(xps), ...nodeIds(ftir)],
    reasoning, timestamp: now(),
  };
}

/**
 * CV-005: Raman Mode Ratio ↔ XRD Phase Fraction
 *
 * Quantitative anatase/rutile ratio from Raman vs XRD (Spurr-Myers).
 */
function checkRamanRatioVsXrdPhaseFraction(bundle: TechniqueEvidenceBundle): CorrelationResult {
  const rule = CROSS_VALIDATION_RULES.find((r) => r.id === 'CV-005')!;
  const xrd = getXrdEvidence(bundle);
  const raman = getRamanEvidence(bundle);

  if (xrd.length === 0 || raman.length === 0) {
    return {
      ruleId: rule.id, ruleName: rule.name, techniques: rule.techniques,
      materialSystem: bundle.materialSystem, status: 'insufficient_data', confidence: 0,
      weight: rule.weight, participatingEvidenceIds: [...nodeIds(xrd), ...nodeIds(raman)],
      reasoning: 'Insufficient data for phase fraction comparison.',
      timestamp: now(),
    };
  }

  const xrdPhases = inferXrdPhases(xrd);
  const ramanPhases = inferRamanPhases(raman);

  // Compute rough phase fraction estimates
  const xrdAnataseFrac = xrdPhases.anataseMatch;
  const xrdRutileFrac = xrdPhases.rutileMatch;
  const ramanAnataseFrac = ramanPhases.anataseMatch;
  const ramanRutileFrac = ramanPhases.rutileMatch;

  // Compare anatase fraction between techniques
  const anataseFracDiff = Math.abs(xrdAnataseFrac - ramanAnataseFrac);
  const rutileFracDiff = Math.abs(xrdRutileFrac - ramanRutileFrac);
  const avgDiff = (anataseFracDiff + rutileFracDiff) / 2;

  let status: CorrelationResult['status'];
  let confidence: number;
  let reasoning: string;

  if (avgDiff < 0.15) {
    status = 'consistent';
    confidence = clamp01(1 - avgDiff);
    reasoning = `Phase fractions are in good agreement. ` +
      `Anatase: XRD ${(xrdAnataseFrac * 100).toFixed(0)}% vs Raman ${(ramanAnataseFrac * 100).toFixed(0)}%. ` +
      `Rutile: XRD ${(xrdRutileFrac * 100).toFixed(0)}% vs Raman ${(ramanRutileFrac * 100).toFixed(0)}%.`;
  } else if (avgDiff < 0.35) {
    status = 'partially_consistent';
    confidence = clamp01(0.6 - avgDiff);
    reasoning = `Phase fractions show moderate disagreement. ` +
      `Anatase: XRD ${(xrdAnataseFrac * 100).toFixed(0)}% vs Raman ${(ramanAnataseFrac * 100).toFixed(0)}%. ` +
      `Discrepancy may arise from Raman's surface sensitivity vs XRD's bulk averaging, or orientation effects.`;
  } else {
    status = 'inconsistent';
    confidence = 0.2;
    reasoning = `Significant phase fraction disagreement. ` +
      `XRD anatase: ${(xrdAnataseFrac * 100).toFixed(0)}%, Raman anatase: ${(ramanAnataseFrac * 100).toFixed(0)}%. ` +
      `This warrants investigation — possible causes include heterogeneous phase distribution, ` +
      `Raman laser-induced phase transformation, or incorrect peak assignments.`;
  }

  return {
    ruleId: rule.id, ruleName: rule.name, techniques: rule.techniques,
    materialSystem: bundle.materialSystem, status, confidence: clamp01(confidence),
    weight: rule.weight, participatingEvidenceIds: [...nodeIds(xrd), ...nodeIds(raman)],
    reasoning,
    details: { xrdPhaseFractions: { anatase: xrdAnataseFrac, rutile: xrdRutileFrac }, ramanPhaseFractions: { anatase: ramanAnataseFrac, rutile: ramanRutileFrac } },
    timestamp: now(),
  };
}

/**
 * CV-006: FTIR Surface Species ↔ XPS Surface Oxidation
 *
 * FTIR OH bands should correlate with XPS O 1s hydroxyl component.
 */
function checkFtirSurfaceVsXpsSurface(bundle: TechniqueEvidenceBundle): CorrelationResult {
  const rule = CROSS_VALIDATION_RULES.find((r) => r.id === 'CV-006')!;
  const ftir = getFtirEvidence(bundle);
  const xps = getXpsEvidence(bundle);

  if (ftir.length === 0 || xps.length === 0) {
    return {
      ruleId: rule.id, ruleName: rule.name, techniques: rule.techniques,
      materialSystem: bundle.materialSystem, status: 'insufficient_data', confidence: 0,
      weight: rule.weight, participatingEvidenceIds: [...nodeIds(ftir), ...nodeIds(xps)],
      reasoning: 'Insufficient data: FTIR or XPS evidence missing.',
      timestamp: now(),
    };
  }

  // FTIR surface OH bands (3100-3600 cm⁻¹)
  const ftirOH = ftir.filter((n) => n.primaryAxis >= 3100 && n.primaryAxis <= 3600);
  // XPS O 1s hydroxyl (530.5-532.0 eV)
  const xpsOH = xps.filter((n) => {
    const meta = n.techniqueMetadata as Record<string, unknown> | undefined;
    return (meta?.orbital as string)?.includes('hydroxyl') || (n.primaryAxis >= 530.5 && n.primaryAxis <= 532.0);
  });

  const hasFtirOH = ftirOH.length > 0;
  const hasXpsOH = xpsOH.length > 0;

  let status: CorrelationResult['status'];
  let confidence: number;
  let reasoning: string;

  if (hasFtirOH && hasXpsOH) {
    status = 'consistent';
    confidence = 0.8;
    reasoning = `FTIR surface OH detected at ${ftirOH.map((n) => n.primaryAxis.toFixed(0)).join(', ')} cm⁻¹. ` +
      `XPS hydroxyl O 1s at ${xpsOH.map((n) => n.primaryAxis.toFixed(1)).join(', ')} eV. ` +
      `Surface hydroxyl species confirmed by both techniques.`;
  } else if (hasFtirOH && !hasXpsOH) {
    status = 'partially_consistent';
    confidence = 0.5;
    reasoning = `FTIR shows surface OH bands but XPS does not clearly resolve hydroxyl O 1s component. ` +
      `XPS O 1s may be dominated by lattice oxygen.`;
  } else if (!hasFtirOH && hasXpsOH) {
    status = 'partially_consistent';
    confidence = 0.5;
    reasoning = `XPS shows hydroxyl O 1s component but FTIR lacks clear OH stretching bands. ` +
      `FTIR signal may be weak or masked by other features.`;
  } else {
    status = 'consistent';
    confidence = 0.6;
    reasoning = `Both FTIR and XPS show no significant surface hydroxyl species. ` +
      `Sample surface may be relatively clean or dehydrated.`;
  }

  return {
    ruleId: rule.id, ruleName: rule.name, techniques: rule.techniques,
    materialSystem: bundle.materialSystem, status, confidence: clamp01(confidence),
    weight: rule.weight, participatingEvidenceIds: [...nodeIds(ftir), ...nodeIds(xps)],
    reasoning, timestamp: now(),
  };
}

/**
 * CV-007: XRD Amorphous Fraction ↔ Raman Disorder Bands
 *
 * Broad XRD background ↔ broad Raman features for amorphous content.
 */
function checkXrdAmorphousVsRamanDisorder(bundle: TechniqueEvidenceBundle): CorrelationResult {
  const rule = CROSS_VALIDATION_RULES.find((r) => r.id === 'CV-007')!;
  const xrd = getXrdEvidence(bundle);
  const raman = getRamanEvidence(bundle);

  if (xrd.length === 0 || raman.length === 0) {
    return {
      ruleId: rule.id, ruleName: rule.name, techniques: rule.techniques,
      materialSystem: bundle.materialSystem, status: 'insufficient_data', confidence: 0,
      weight: rule.weight, participatingEvidenceIds: [...nodeIds(xrd), ...nodeIds(raman)],
      reasoning: 'Insufficient data for amorphous content assessment.',
      timestamp: now(),
    };
  }

  // Check for amorphous indicator in XRD
  const xrdAmorphous = xrd.filter((n) => {
    const meta = n.techniqueMetadata as Record<string, unknown> | undefined;
    return (meta?.classification === 'broad') || n.inferredCategory === 'amorphous';
  });

  // Check for broad Raman bands (disorder)
  const ramanBroad = raman.filter((n) => {
    const meta = n.techniqueMetadata as Record<string, unknown> | undefined;
    return meta?.bandType === 'broad';
  });

  const xrdHasAmorphous = xrdAmorphous.length > 0;
  const ramanHasBroad = ramanBroad.length > 0;
  const ramanHasSharp = raman.filter((n) => {
    const meta = n.techniqueMetadata as Record<string, unknown> | undefined;
    return meta?.bandType === 'sharp';
  }).length > 0;

  let status: CorrelationResult['status'];
  let confidence: number;
  let reasoning: string;

  if (xrdHasAmorphous && ramanHasBroad) {
    status = 'consistent';
    confidence = 0.7;
    reasoning = `XRD shows broad features (${xrdAmorphous.length} broad peaks/humps) consistent with amorphous content. ` +
      `Raman shows broad bands (${ramanBroad.length}) indicating structural disorder. Both techniques agree on significant amorphous fraction.`;
  } else if (!xrdHasAmorphous && !ramanHasBroad) {
    status = 'consistent';
    confidence = 0.75;
    reasoning = 'Both XRD and Raman indicate well-crystallized material with no significant amorphous content.';
  } else if (xrdHasAmorphous && !ramanHasBroad) {
    status = 'partially_consistent';
    confidence = 0.45;
    reasoning = `XRD indicates amorphous content but Raman shows sharp bands. ` +
      `Raman may be sampling a more crystalline region (micro-Raman spatial selectivity).`;
  } else {
    status = 'partially_consistent';
    confidence = 0.45;
    reasoning = `Raman shows broad disorder bands but XRD peaks appear sharp. ` +
      `Raman may be detecting surface disorder or defects not visible in bulk XRD.`;
  }

  return {
    ruleId: rule.id, ruleName: rule.name, techniques: rule.techniques,
    materialSystem: bundle.materialSystem, status, confidence: clamp01(confidence),
    weight: rule.weight, participatingEvidenceIds: [...nodeIds(xrd), ...nodeIds(raman)],
    reasoning, timestamp: now(),
  };
}

/**
 * CV-008: XPS Ti 2p Spin-Orbit Splitting Validation
 *
 * Internal XPS consistency: Ti 2p3/2 and 2p1/2 separation should be 5.7 ± 0.3 eV.
 */
function checkXpsSpinOrbitSplitting(bundle: TechniqueEvidenceBundle): CorrelationResult {
  const rule = CROSS_VALIDATION_RULES.find((r) => r.id === 'CV-008')!;
  const xps = getXpsEvidence(bundle);

  if (xps.length === 0) {
    return {
      ruleId: rule.id, ruleName: rule.name, techniques: rule.techniques,
      materialSystem: bundle.materialSystem, status: 'insufficient_data', confidence: 0,
      weight: rule.weight, participatingEvidenceIds: nodeIds(xps),
      reasoning: 'No XPS data available for spin-orbit splitting validation.',
      timestamp: now(),
    };
  }

  // Find Ti 2p3/2 and Ti 2p1/2
  const ti2p32 = xps.find((n) => {
    const meta = n.techniqueMetadata as Record<string, unknown> | undefined;
    return (meta?.orbital as string)?.includes('2p3/2') || n.label.toLowerCase().includes('2p3/2');
  });
  const ti2p12 = xps.find((n) => {
    const meta = n.techniqueMetadata as Record<string, unknown> | undefined;
    return (meta?.orbital as string)?.includes('2p1/2') || n.label.toLowerCase().includes('2p1/2');
  });

  if (!ti2p32 || !ti2p12) {
    // Try to find by binding energy range
    const inRange = xps.filter((n) => n.primaryAxis >= 454 && n.primaryAxis <= 470);
    if (inRange.length >= 2) {
      const sorted = [...inRange].sort((a, b) => a.primaryAxis - b.primaryAxis);
      const splitting = sorted[sorted.length - 1].primaryAxis - sorted[0].primaryAxis;
      const expected = 5.7;
      const deviation = Math.abs(splitting - expected);

      if (deviation <= 0.3) {
        return {
          ruleId: rule.id, ruleName: rule.name, techniques: rule.techniques,
          materialSystem: bundle.materialSystem, status: 'consistent', confidence: clamp01(1 - deviation / 0.3),
          weight: rule.weight, participatingEvidenceIds: nodeIds(inRange),
          reasoning: `Ti 2p spin-orbit splitting: ${splitting.toFixed(2)} eV (expected: ${expected} ± 0.3 eV for Ti⁴⁺). Consistent.`,
          details: { splitting, expected, deviation },
          timestamp: now(),
        };
      } else {
        return {
          ruleId: rule.id, ruleName: rule.name, techniques: rule.techniques,
          materialSystem: bundle.materialSystem, status: 'partially_consistent', confidence: 0.4,
          weight: rule.weight, participatingEvidenceIds: nodeIds(inRange),
          reasoning: `Ti 2p spin-orbit splitting: ${splitting.toFixed(2)} eV deviates from expected ${expected} eV. ` +
            `May indicate mixed oxidation states, charging, or peak overlap.`,
          details: { splitting, expected, deviation },
          timestamp: now(),
        };
      }
    }

    return {
      ruleId: rule.id, ruleName: rule.name, techniques: rule.techniques,
      materialSystem: bundle.materialSystem, status: 'insufficient_data', confidence: 0.3,
      weight: rule.weight, participatingEvidenceIds: nodeIds(xps),
      reasoning: 'Could not identify both Ti 2p3/2 and Ti 2p1/2 peaks in XPS data.',
      timestamp: now(),
    };
  }

  const splitting = ti2p12.primaryAxis - ti2p32.primaryAxis;
  const expected = TI4_PLUS_XPS.peaks[0].spinOrbitSplitting ?? 5.7;
  const deviation = Math.abs(splitting - expected);

  let status: CorrelationResult['status'];
  let confidence: number;
  let reasoning: string;

  if (deviation <= 0.3) {
    status = 'consistent';
    confidence = clamp01(1 - deviation / 0.3);
    reasoning = `Ti 2p spin-orbit splitting: ${splitting.toFixed(2)} eV (Ti 2p3/2 at ${ti2p32.primaryAxis.toFixed(1)} eV, Ti 2p1/2 at ${ti2p12.primaryAxis.toFixed(1)} eV). ` +
      `Expected: ${expected} ± 0.3 eV for Ti⁴⁺. Consistent with Ti⁴⁺.`;
  } else if (deviation <= 0.6) {
    status = 'partially_consistent';
    confidence = 0.5;
    reasoning = `Ti 2p spin-orbit splitting: ${splitting.toFixed(2)} eV. ` +
      `Deviation of ${deviation.toFixed(2)} eV from expected ${expected} eV. ` +
      `May indicate mixed Ti³⁺/Ti⁴⁺ states or surface charging effects.`;
  } else {
    status = 'inconsistent';
    confidence = 0.2;
    reasoning = `Ti 2p spin-orbit splitting: ${splitting.toFixed(2)} eV is significantly outside expected range. ` +
      `Check for peak misassignment, charging, or interference from other elements.`;
  }

  return {
    ruleId: rule.id, ruleName: rule.name, techniques: rule.techniques,
    materialSystem: bundle.materialSystem, status, confidence: clamp01(confidence),
    weight: rule.weight, participatingEvidenceIds: [...nodeIds(xps)],
    reasoning, details: { splitting, expected, deviation, ti2p32BE: ti2p32.primaryAxis, ti2p12BE: ti2p12.primaryAxis },
    timestamp: now(),
  };
}

/**
 * CV-009: FTIR Carbonate ↔ XPS C 1s Contamination
 *
 * FTIR carbonate bands should correlate with XPS C 1s adventitious carbon.
 */
function checkFtirCarbonateVsXpsC1s(bundle: TechniqueEvidenceBundle): CorrelationResult {
  const rule = CROSS_VALIDATION_RULES.find((r) => r.id === 'CV-009')!;
  const ftir = getFtirEvidence(bundle);
  const xps = getXpsEvidence(bundle);

  if (ftir.length === 0 || xps.length === 0) {
    return {
      ruleId: rule.id, ruleName: rule.name, techniques: rule.techniques,
      materialSystem: bundle.materialSystem, status: 'insufficient_data', confidence: 0,
      weight: rule.weight, participatingEvidenceIds: [...nodeIds(ftir), ...nodeIds(xps)],
      reasoning: 'Insufficient data for contamination cross-check.',
      timestamp: now(),
    };
  }

  // FTIR carbonate bands: ~1380 and ~1630 cm⁻¹
  const ftirCarbonate = ftir.filter((n) =>
    (Math.abs(n.primaryAxis - 1380) <= 30) || (Math.abs(n.primaryAxis - 1630) <= 30),
  );

  // XPS C 1s: ~284.8 eV adventitious carbon, ~289.0 eV carbonate
  const xpsC1s = xps.filter((n) => n.primaryAxis >= 280 && n.primaryAxis <= 295);

  const hasFtirCarbonate = ftirCarbonate.length > 0;
  const hasXpsC1s = xpsC1s.length > 0;

  let status: CorrelationResult['status'];
  let confidence: number;
  let reasoning: string;

  if (hasFtirCarbonate && hasXpsC1s) {
    status = 'consistent';
    confidence = 0.7;
    reasoning = `FTIR shows carbonate bands at ${ftirCarbonate.map((n) => n.primaryAxis.toFixed(0)).join(', ')} cm⁻¹. ` +
      `XPS C 1s detected at ${xpsC1s.map((n) => n.primaryAxis.toFixed(1)).join(', ')} eV. ` +
      `Both techniques indicate surface carbon contamination.`;
  } else if (!hasFtirCarbonate && !hasXpsC1s) {
    status = 'consistent';
    confidence = 0.65;
    reasoning = 'No significant carbonate contamination detected by FTIR or XPS.';
  } else if (hasFtirCarbonate && !hasXpsC1s) {
    status = 'partially_consistent';
    confidence = 0.4;
    reasoning = 'FTIR shows carbonate bands but XPS C 1s not detected. Carbon may be below XPS detection limit.';
  } else {
    status = 'partially_consistent';
    confidence = 0.4;
    reasoning = 'XPS C 1s detected but no FTIR carbonate bands. Carbon species may not be carbonate (e.g., adventitious hydrocarbon only).';
  }

  return {
    ruleId: rule.id, ruleName: rule.name, techniques: rule.techniques,
    materialSystem: bundle.materialSystem, status, confidence: clamp01(confidence),
    weight: rule.weight, participatingEvidenceIds: [...nodeIds(ftir), ...nodeIds(xps)],
    reasoning, timestamp: now(),
  };
}

/**
 * CV-010: Raman Crystallinity ↔ XRD Peak Sharpness
 *
 * Sharp XRD peaks ↔ narrow Raman modes indicates good crystallinity.
 */
function checkRamanCrystallinityVsXrdSharpness(bundle: TechniqueEvidenceBundle): CorrelationResult {
  const rule = CROSS_VALIDATION_RULES.find((r) => r.id === 'CV-010')!;
  const xrd = getXrdEvidence(bundle);
  const raman = getRamanEvidence(bundle);

  if (xrd.length === 0 || raman.length === 0) {
    return {
      ruleId: rule.id, ruleName: rule.name, techniques: rule.techniques,
      materialSystem: bundle.materialSystem, status: 'insufficient_data', confidence: 0,
      weight: rule.weight, participatingEvidenceIds: [...nodeIds(xrd), ...nodeIds(raman)],
      reasoning: 'Insufficient data for crystallinity comparison.',
      timestamp: now(),
    };
  }

  // XRD sharpness: look at FWHM or classification
  const sharpXrd = xrd.filter((n) => {
    const meta = n.techniqueMetadata as Record<string, unknown> | undefined;
    return meta?.classification === 'sharp' || ((meta?.fwhm as number) !== undefined && (meta?.fwhm as number) < 0.3);
  });
  const broadXrd = xrd.filter((n) => {
    const meta = n.techniqueMetadata as Record<string, unknown> | undefined;
    return meta?.classification === 'broad' || ((meta?.fwhm as number) !== undefined && (meta?.fwhm as number) > 0.5);
  });

  // Raman sharpness
  const sharpRaman = raman.filter((n) => {
    const meta = n.techniqueMetadata as Record<string, unknown> | undefined;
    return meta?.bandType === 'sharp';
  });
  const broadRaman = raman.filter((n) => {
    const meta = n.techniqueMetadata as Record<string, unknown> | undefined;
    return meta?.bandType === 'broad';
  });

  const xrdCrystalline = sharpXrd.length > broadXrd.length;
  const ramanCrystalline = sharpRaman.length > broadRaman.length;

  let status: CorrelationResult['status'];
  let confidence: number;
  let reasoning: string;

  if (xrdCrystalline === ramanCrystalline) {
    status = 'consistent';
    confidence = 0.8;
    reasoning = xrdCrystalline
      ? 'Both XRD and Raman indicate well-crystallized material (sharp peaks/modes).'
      : 'Both XRD and Raman indicate poor crystallinity (broad features).';
  } else {
    status = 'partially_consistent';
    confidence = 0.45;
    reasoning = xrdCrystalline
      ? 'XRD shows sharp peaks (good crystallinity) but Raman shows broad bands. May indicate surface disorder or defects.'
      : 'Raman shows sharp modes but XRD peaks are broad. Raman may be sampling a more crystalline region.';
  }

  return {
    ruleId: rule.id, ruleName: rule.name, techniques: rule.techniques,
    materialSystem: bundle.materialSystem, status, confidence: clamp01(confidence),
    weight: rule.weight, participatingEvidenceIds: [...nodeIds(xrd), ...nodeIds(raman)],
    reasoning, timestamp: now(),
  };
}

/**
 * CV-011: XRD Phase Mixture ↔ FTIR Band Deconvolution
 *
 * If XRD shows anatase+rutile, FTIR should show bands from both phases.
 */
function checkXrdPhaseMixtureVsFtirBands(bundle: TechniqueEvidenceBundle): CorrelationResult {
  const rule = CROSS_VALIDATION_RULES.find((r) => r.id === 'CV-011')!;
  const xrd = getXrdEvidence(bundle);
  const ftir = getFtirEvidence(bundle);

  if (xrd.length === 0 || ftir.length === 0) {
    return {
      ruleId: rule.id, ruleName: rule.name, techniques: rule.techniques,
      materialSystem: bundle.materialSystem, status: 'insufficient_data', confidence: 0,
      weight: rule.weight, participatingEvidenceIds: [...nodeIds(xrd), ...nodeIds(ftir)],
      reasoning: 'Insufficient data for phase mixture vs FTIR band check.',
      timestamp: now(),
    };
  }

  const xrdPhases = inferXrdPhases(xrd);
  const isMixedPhase = xrdPhases.phases.includes('anatase') && xrdPhases.phases.includes('rutile');

  // Check FTIR for anatase-specific bands (~450, ~560 cm⁻¹)
  const ftirAnatase = ftir.filter((n) =>
    (Math.abs(n.primaryAxis - 450) <= 50) || (Math.abs(n.primaryAxis - 560) <= 50),
  );
  // Check FTIR for rutile-specific bands (~430, ~530 cm⁻¹)
  const ftirRutile = ftir.filter((n) =>
    (Math.abs(n.primaryAxis - 430) <= 40) || (Math.abs(n.primaryAxis - 530) <= 40),
  );

  // Note: anatase 450 and rutile 430 overlap — need to check carefully
  const ftirHasAnataseSignature = ftirAnatase.length > 0;
  const ftirHasRutileSignature = ftirRutile.length > 0;

  let status: CorrelationResult['status'];
  let confidence: number;
  let reasoning: string;

  if (isMixedPhase && ftirHasAnataseSignature && ftirHasRutileSignature) {
    status = 'consistent';
    confidence = 0.75;
    reasoning = `XRD identifies mixed anatase+rutile phase. FTIR shows both anatase bands (~450/560 cm⁻¹) and rutile bands (~430/530 cm⁻¹). Multi-phase consistency confirmed.`;
  } else if (isMixedPhase && (ftirHasAnataseSignature || ftirHasRutileSignature)) {
    status = 'partially_consistent';
    confidence = 0.5;
    reasoning = `XRD shows mixed phase but FTIR only partially supports this. ` +
      `Anatase FTIR bands ${ftirHasAnataseSignature ? 'present' : 'absent'}, rutile FTIR bands ${ftirHasRutileSignature ? 'present' : 'absent'}. ` +
      `FTIR bands in the Ti-O region are broad and may overlap.`;
  } else if (!isMixedPhase && ftirHasAnataseSignature && ftirHasRutileSignature) {
    status = 'partially_consistent';
    confidence = 0.45;
    reasoning = `XRD shows single phase [${xrdPhases.phases.join(', ')}] but FTIR has features from both anatase and rutile regions. ` +
      `FTIR broad bands in this region can be ambiguous.`;
  } else {
    status = 'consistent';
    confidence = 0.6;
    reasoning = `XRD phase [${xrdPhases.phases.join(', ')}] and FTIR band positions are mutually consistent. ` +
      `No contradictory evidence for multi-phase composition.`;
  }

  return {
    ruleId: rule.id, ruleName: rule.name, techniques: rule.techniques,
    materialSystem: bundle.materialSystem, status, confidence: clamp01(confidence),
    weight: rule.weight, participatingEvidenceIds: [...nodeIds(xrd), ...nodeIds(ftir)],
    reasoning, details: { xrdPhases: xrdPhases.phases, isMixedPhase, ftirAnatase: ftirAnatase.length, ftirRutile: ftirRutile.length },
    timestamp: now(),
  };
}

/**
 * CV-012: Overall Oxidation State Consistency (XPS + Raman)
 *
 * XPS Ti⁴⁺ should be consistent with Raman showing TiO₂ modes
 * (no Ti₂O₃ A2u mode at 243 cm⁻¹).
 */
function checkOxidationStateConsistency(bundle: TechniqueEvidenceBundle): CorrelationResult {
  const rule = CROSS_VALIDATION_RULES.find((r) => r.id === 'CV-012')!;
  const xps = getXpsEvidence(bundle);
  const raman = getRamanEvidence(bundle);

  if (xps.length === 0 || raman.length === 0) {
    return {
      ruleId: rule.id, ruleName: rule.name, techniques: rule.techniques,
      materialSystem: bundle.materialSystem, status: 'insufficient_data', confidence: 0,
      weight: rule.weight, participatingEvidenceIds: [...nodeIds(xps), ...nodeIds(raman)],
      reasoning: 'Insufficient data for oxidation state consistency check.',
      timestamp: now(),
    };
  }

  const xpsState = inferXpsOxidationState(xps);
  const ramanPhases = inferRamanPhases(raman);

  // Check for Ti₂O₃ marker mode at ~243 cm⁻¹
  const hasTi2O3Mode = raman.some((n) => Math.abs(n.primaryAxis - 243) <= 15);
  const hasTiO2Modes = ramanPhases.phases.includes('anatase') || ramanPhases.phases.includes('rutile');

  const xpsIsTi4 = xpsState.oxidationState?.startsWith('Ti⁴⁺') ?? false;
  const xpsIsTi3 = xpsState.oxidationState?.startsWith('Ti³⁺') ?? false;

  let status: CorrelationResult['status'];
  let confidence: number;
  let reasoning: string;

  if (xpsIsTi4 && hasTiO2Modes && !hasTi2O3Mode) {
    status = 'consistent';
    confidence = 0.9;
    reasoning = `XPS confirms Ti⁴⁺ (${xpsState.ti2p32BE?.toFixed(1)} eV). Raman shows TiO₂ modes consistent with anatase/rutile. ` +
      `No Ti₂O₃ A2u mode at 243 cm⁻¹ detected. Oxidation state is Ti⁴⁺ across both techniques.`;
  } else if (xpsIsTi4 && hasTi2O3Mode) {
    status = 'partially_consistent';
    confidence = 0.5;
    reasoning = `XPS indicates Ti⁴⁺ but Raman shows a feature near 243 cm⁻¹ (Ti₂O₃ A2u marker). ` +
      `Possible surface reduction under Raman laser or minor Ti³⁺ component below XPS detection limit.`;
  } else if (xpsIsTi3 && hasTiO2Modes) {
    status = 'inconsistent';
    confidence = 0.25;
    reasoning = `CRITICAL: XPS indicates Ti³⁺ but Raman shows TiO₂ modes (expected for Ti⁴⁺). ` +
      `This contradiction suggests either surface vs bulk heterogeneity (XPS is surface-sensitive, Raman probes deeper), ` +
      `or partial oxidation/reduction at the surface.`;
  } else if (xpsIsTi3 && !hasTiO2Modes) {
    status = 'consistent';
    confidence = 0.7;
    reasoning = `XPS indicates Ti³⁺ and Raman does not show clear TiO₂ modes. ` +
      `Consistent with reduced Ti₂O₃ or oxygen-deficient TiO₂₋ₓ.`;
  } else {
    status = 'insufficient_data';
    confidence = 0.3;
    reasoning = `Could not establish oxidation state consistency. ` +
      `XPS state: ${xpsState.oxidationState ?? 'undetermined'}, Raman phases: [${ramanPhases.phases.join(', ')}].`;
  }

  return {
    ruleId: rule.id, ruleName: rule.name, techniques: rule.techniques,
    materialSystem: bundle.materialSystem, status, confidence: clamp01(confidence),
    weight: rule.weight, participatingEvidenceIds: [...nodeIds(xps), ...nodeIds(raman)],
    reasoning,
    details: { xpsOxidation: xpsState, ramanPhases: ramanPhases.phases, hasTi2O3Mode, hasTiO2Modes },
    timestamp: now(),
  };
}

// ---------------------------------------------------------------------------
// Rule Dispatch Table
// ---------------------------------------------------------------------------

const RULE_DISPATCH: Record<string, (bundle: TechniqueEvidenceBundle) => CorrelationResult> = {
  'CV-001': checkXrdPhaseVsRamanModes,
  'CV-002': checkXrdPhaseVsXpsTi4,
  'CV-003': checkXrdCrystalliteSizeVsRamanBroadening,
  'CV-004': checkXpsO1sVsFtirTiO,
  'CV-005': checkRamanRatioVsXrdPhaseFraction,
  'CV-006': checkFtirSurfaceVsXpsSurface,
  'CV-007': checkXrdAmorphousVsRamanDisorder,
  'CV-008': checkXpsSpinOrbitSplitting,
  'CV-009': checkFtirCarbonateVsXpsC1s,
  'CV-010': checkRamanCrystallinityVsXrdSharpness,
  'CV-011': checkXrdPhaseMixtureVsFtirBands,
  'CV-012': checkOxidationStateConsistency,
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run all applicable cross-validation checks for the given evidence bundle.
 *
 * @param bundle - Assembled evidence from all available techniques.
 * @param materialSystem - Material system to apply rules for.
 * @returns Complete CrossValidationReport.
 */
export function runCrossValidation(
  bundle: TechniqueEvidenceBundle,
  materialSystem: MaterialSystem = 'TiO2',
): CrossValidationReport {
  const rules = getRulesForMaterial(materialSystem);
  const correlations: CorrelationResult[] = [];

  for (const rule of rules) {
    const fn = RULE_DISPATCH[rule.id];
    if (fn) {
      correlations.push(fn(bundle));
    }
  }

  const consistentCount = correlations.filter((c) => c.status === 'consistent').length;
  const inconsistentCount = correlations.filter((c) => c.status === 'inconsistent').length;
  const partiallyConsistentCount = correlations.filter((c) => c.status === 'partially_consistent').length;
  const insufficientDataCount = correlations.filter((c) => c.status === 'insufficient_data').length;

  return {
    rulesEvaluated: correlations.length,
    consistentCount,
    inconsistentCount,
    partiallyConsistentCount,
    insufficientDataCount,
    correlations,
    timestamp: now(),
  };
}