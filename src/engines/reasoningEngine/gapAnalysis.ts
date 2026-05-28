/**
 * Reasoning Engine — Gap Analysis (Stage 5)
 *
 * Analyses cross-validation results to identify validation gaps,
 * inconsistencies, missing techniques, quantitative mismatches,
 * and data quality issues. Produces a GapAnalysisReport.
 *
 * @module reasoningEngine/gapAnalysis
 */

import type { Technique } from '../../types/universalTechnique';
import type {
  TechniqueEvidenceBundle,
  CrossValidationReport,
  CorrelationResult,
  GapAnalysisReport,
  ValidationGap,
  GapSeverity,
  GapCategory,
  MaterialSystem,
} from './types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function now(): string {
  return new Date().toISOString();
}

function makeGapId(category: GapCategory, index: number): string {
  return `GAP-${category.toUpperCase().slice(0, 4)}-${String(index).padStart(3, '0')}`;
}

// ---------------------------------------------------------------------------
// Gap Detection Rules
// ---------------------------------------------------------------------------

/**
 * Detect missing techniques — if expected techniques have no evidence,
 * that is a gap of category 'missing_technique'.
 */
function detectMissingTechniques(
  bundle: TechniqueEvidenceBundle,
  expectedTechniques: Technique[],
): ValidationGap[] {
  const gaps: ValidationGap[] = [];
  const available = new Set(Object.keys(bundle.evidenceByTechnique) as Technique[]);

  for (const tech of expectedTechniques) {
    if (!available.has(tech)) {
      gaps.push({
        gapId: makeGapId('missing_technique', gaps.length),
        category: 'missing_technique',
        severity: tech === 'XRD' || tech === 'XPS' ? 'critical' : 'high',
        techniques: [tech],
        materialSystem: bundle.materialSystem,
        description: `${tech} data is missing from the evidence bundle. Cannot perform ${tech}-based cross-validation checks.`,
        interpretation: `Without ${tech} evidence, the reasoning engine cannot evaluate correlations that depend on ${tech}. This directly reduces research confidence and may leave key scientific claims unsupported.`,
        relatedCorrelationIds: [],
        recommendation: `Collect ${tech} data for this sample to enable full cross-technique validation.`,
        timestamp: now(),
      });
    }
  }

  return gaps;
}

/**
 * Detect contradictions from cross-validation correlation results.
 * A correlation with status 'inconsistent' is a contradiction gap.
 */
function detectContradictions(
  correlations: CorrelationResult[],
): ValidationGap[] {
  const gaps: ValidationGap[] = [];

  for (const corr of correlations) {
    if (corr.status !== 'inconsistent') continue;

    // Determine severity based on weight and confidence
    let severity: GapSeverity = 'medium';
    if (corr.weight >= 0.9) severity = 'critical';
    else if (corr.weight >= 0.7) severity = 'high';

    gaps.push({
      gapId: makeGapId('contradiction', gaps.length),
      category: 'contradiction',
      severity,
      techniques: [...corr.techniques] as Technique[],
      materialSystem: corr.materialSystem,
      description: `Contradiction detected: ${corr.ruleName}. ${corr.reasoning}`,
      interpretation: `The inconsistency between ${corr.techniques[0]} and ${corr.techniques[1]} evidence undermines the reliability of any scientific conclusion drawn from these techniques jointly. Resolution requires additional characterization or careful re-examination of the data.`,
      relatedCorrelationIds: [corr.ruleId],
      recommendation: generateContradictionRecommendation(corr),
      timestamp: now(),
    });
  }

  return gaps;
}

/**
 * Generate a specific recommendation for a contradiction based on the rule.
 */
function generateContradictionRecommendation(corr: CorrelationResult): string {
  switch (corr.ruleId) {
    case 'CV-001':
      return 'Perform TEM-SAED to independently determine crystal phase and resolve XRD/Raman disagreement. Check for laser-induced phase transformation during Raman measurement.';
    case 'CV-002':
      return 'Re-examine XPS for possible surface reduction or charging effects. Consider XANES for independent oxidation state confirmation.';
    case 'CV-005':
      return 'Repeat Raman mapping at lower laser power to avoid local heating. Use XRD Rietveld refinement for quantitative phase analysis.';
    case 'CV-008':
      return 'Check for sample charging in XPS. Re-calibrate binding energy scale using adventitious carbon (C 1s = 284.8 eV).';
    case 'CV-012':
      return 'Perform XANES at Ti K-edge for element-specific oxidation state determination. Raman laser may cause local reduction.';
    default:
      return `Review ${corr.techniques.join('/')} data quality and consider repeating measurements with improved experimental conditions.`;
  }
}

/**
 * Detect quantitative mismatches from 'partially_consistent' correlations.
 */
function detectQuantitativeMismatches(
  correlations: CorrelationResult[],
): ValidationGap[] {
  const gaps: ValidationGap[] = [];

  for (const corr of correlations) {
    if (corr.status !== 'partially_consistent') continue;

    // Only flag as quantitative mismatch if confidence is moderate
    if (corr.confidence >= 0.6) continue;

    gaps.push({
      gapId: makeGapId('quantitative_mismatch', gaps.length),
      category: 'quantitative_mismatch',
      severity: corr.weight >= 0.8 ? 'medium' : 'low',
      techniques: [...corr.techniques] as Technique[],
      materialSystem: corr.materialSystem,
      description: `Quantitative mismatch: ${corr.ruleName}. ${corr.reasoning}`,
      interpretation: `Partial agreement between ${corr.techniques[0]} and ${corr.techniques[1]} suggests the measurements are sampling different aspects of the material or have different sensitivities. Quantitative conclusions should be treated with caution.`,
      relatedCorrelationIds: [corr.ruleId],
      recommendation: `Improve measurement precision for ${corr.techniques.join(' and ')} to reduce quantitative uncertainty.`,
      timestamp: now(),
    });
  }

  return gaps;
}

/**
 * Detect data quality issues — evidence nodes with low signal quality.
 */
function detectDataQualityIssues(
  bundle: TechniqueEvidenceBundle,
): ValidationGap[] {
  const gaps: ValidationGap[] = [];
  const techniques = Object.keys(bundle.evidenceByTechnique) as Technique[];

  for (const tech of techniques) {
    const nodes = bundle.evidenceByTechnique[tech] ?? [];
    if (nodes.length === 0) continue;

    // Check for nodes with very low confidence
    const lowConfidence = nodes.filter((n) => typeof n.confidence === 'number' && n.confidence < 0.4);
    if (lowConfidence.length > nodes.length * 0.5) {
      gaps.push({
        gapId: makeGapId('data_quality', gaps.length),
        category: 'data_quality',
        severity: 'medium',
        techniques: [tech],
        materialSystem: bundle.materialSystem,
        description: `${tech} data has ${lowConfidence.length}/${nodes.length} evidence nodes with confidence < 0.4. Overall ${tech} data quality is questionable.`,
        interpretation: `Low-confidence ${tech} evidence may result from poor signal-to-noise, overlapping peaks, or measurement artifacts. Cross-validation checks involving ${tech} will have reduced reliability.`,
        relatedCorrelationIds: [],
        recommendation: `Re-collect ${tech} data with improved measurement parameters (longer acquisition time, better sample preparation, or optimized instrumental settings).`,
        timestamp: now(),
      });
    }
  }

  return gaps;
}

/**
 * Detect ambiguities — cases where multiple phases or states are equally
 * likely and cannot be distinguished by available techniques.
 */
function detectAmbiguities(
  correlations: CorrelationResult[],
  bundle: TechniqueEvidenceBundle,
): ValidationGap[] {
  const gaps: ValidationGap[] = [];

  // Check for the specific TiO₂ anatase/rutile ambiguity
  const cv001 = correlations.find((c) => c.ruleId === 'CV-001');
  if (cv001?.status === 'partially_consistent') {
    const details = cv001.details as Record<string, unknown> | undefined;
    const xrdPhases = details?.xrdPhases as { phases: string[]; anataseMatch: number; rutileMatch: number } | undefined;
    const ramanPhases = details?.ramanPhases as { phases: string[]; anataseMatch: number; rutileMatch: number } | undefined;

    // If both techniques show partial matches for multiple phases
    if (xrdPhases && ramanPhases) {
      const xrdMixed = xrdPhases.phases.includes('anatase') && xrdPhases.phases.includes('rutile');
      const ramanMixed = ramanPhases.phases.includes('anatase') && ramanPhases.phases.includes('rutile');

      if (xrdMixed || ramanMixed) {
        gaps.push({
          gapId: makeGapId('ambiguity', gaps.length),
          category: 'ambiguity',
          severity: 'medium',
          techniques: ['XRD', 'Raman'],
          materialSystem: bundle.materialSystem,
          description: `Phase ambiguity: Both anatase and rutile signatures detected. XRD anatase match ${(xrdPhases.anataseMatch * 100).toFixed(0)}%, rutile ${(xrdPhases.rutileMatch * 100).toFixed(0)}%. Raman anatase match ${(ramanPhases.anataseMatch * 100).toFixed(0)}%, rutile ${(ramanPhases.rutileMatch * 100).toFixed(0)}%.`,
          interpretation: `The presence of both anatase and rutile phases is common in TiO₂ synthesis. Quantification of the phase ratio is critical for applications (photocatalysis, coatings) where phase composition determines performance. The Raman overlap zone at 143–144 cm⁻¹ limits discrimination without secondary mode analysis.`,
          relatedCorrelationIds: ['CV-001', 'CV-005'],
          recommendation: 'Use Raman secondary modes (anatase 399/639 cm⁻¹, rutile 447/612 cm⁻¹) for phase ratio quantification. Apply Spurr-Myers equation to XRD (101)/(110) peak area ratio for independent phase fraction determination.',
          timestamp: now(),
        });
      }
    }
  }

  return gaps;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run gap analysis on the cross-validation report and evidence bundle.
 *
 * @param cvReport - Results from the cross-validation stage.
 * @param bundle - The original evidence bundle.
 * @param expectedTechniques - Techniques expected for full analysis.
 * @returns Complete GapAnalysisReport.
 */
export function runGapAnalysis(
  cvReport: CrossValidationReport,
  bundle: TechniqueEvidenceBundle,
  expectedTechniques: Technique[] = ['XRD', 'XPS', 'FTIR', 'Raman'],
): GapAnalysisReport {
  const allGaps: ValidationGap[] = [
    ...detectMissingTechniques(bundle, expectedTechniques),
    ...detectContradictions(cvReport.correlations),
    ...detectQuantitativeMismatches(cvReport.correlations),
    ...detectDataQualityIssues(bundle),
    ...detectAmbiguities(cvReport.correlations, bundle),
  ];

  // Deduplicate by ID (should not happen, but safety)
  const seen = new Set<string>();
  const gaps = allGaps.filter((g) => {
    if (seen.has(g.gapId)) return false;
    seen.add(g.gapId);
    return true;
  });

  const gapsBySeverity: Record<GapSeverity, number> = {
    critical: gaps.filter((g) => g.severity === 'critical').length,
    high: gaps.filter((g) => g.severity === 'high').length,
    medium: gaps.filter((g) => g.severity === 'medium').length,
    low: gaps.filter((g) => g.severity === 'low').length,
  };

  return {
    totalGaps: gaps.length,
    gapsBySeverity,
    gaps,
    hasCriticalGaps: gapsBySeverity.critical > 0,
    timestamp: now(),
  };
}