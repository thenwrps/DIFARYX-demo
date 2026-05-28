/**
 * Reasoning Engine — Decision Intelligence (Stage 6)
 *
 * Computes a composite Research Confidence Level from cross-validation
 * results and gap analysis, then generates next-step recommendations
 * to guide the researcher toward higher confidence.
 *
 * @module reasoningEngine/decisionIntelligence
 */

import type { Technique } from '../../types/universalTechnique';
import type {
  CrossValidationReport,
  GapAnalysisReport,
  ValidationGap,
  DecisionReport,
  NextStepRecommendation,
  ResearchConfidenceLevel,
  ConfidenceScore,
  TechniqueEvidenceBundle,
  MaterialSystem,
  NextStepType,
} from './types';
import { TIO2_RECOMMENDATIONS } from './knowledgeBase';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function now(): string {
  return new Date().toISOString();
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/**
 * Map a numeric confidence score to a ResearchConfidenceLevel.
 */
function toResearchLevel(score: number): ResearchConfidenceLevel {
  if (score >= 0.85) return 'HIGH';
  if (score >= 0.65) return 'MEDIUM';
  if (score >= 0.40) return 'LOW';
  return 'CRITICAL';
}

/**
 * Compute the number of techniques available in the bundle.
 */
function countTechniques(bundle: TechniqueEvidenceBundle): number {
  return Object.keys(bundle.evidenceByTechnique).filter(
    (k) => (bundle.evidenceByTechnique[k as Technique]?.length ?? 0) > 0,
  ).length;
}

// ---------------------------------------------------------------------------
// Confidence Scoring (Weighted Bayesian-like)
// ---------------------------------------------------------------------------

/**
 * Compute the weighted consistency score from cross-validation correlations.
 *
 * Formula:
 *   Σ(weight × statusScore) / Σ(weight)   (only for evaluated rules with data)
 *
 * Status scores:
 *   consistent           → 1.0
 *   partially_consistent → 0.5
 *   inconsistent         → 0.0
 *   insufficient_data    → excluded from denominator
 */
function computeConsistencyScore(cvReport: CrossValidationReport): number {
  const statusScore: Record<string, number> = {
    consistent: 1.0,
    partially_consistent: 0.5,
    inconsistent: 0.0,
  };

  let weightedSum = 0;
  let totalWeight = 0;

  for (const corr of cvReport.correlations) {
    if (corr.status === 'insufficient_data') continue;
    const score = statusScore[corr.status] ?? 0;
    weightedSum += corr.weight * score;
    totalWeight += corr.weight;
  }

  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

/**
 * Compute a penalty factor based on gap severity.
 *
 * Each gap severity has a penalty weight:
 *   critical → 0.15, high → 0.10, medium → 0.05, low → 0.02
 *
 * Penalty = min(1, sum of penalties)
 * Final score = consistencyScore × (1 - penalty)
 */
function computeGapPenalty(gapReport: GapAnalysisReport): number {
  const penaltyWeights: Record<string, number> = {
    critical: 0.15,
    high: 0.10,
    medium: 0.05,
    low: 0.02,
  };

  let totalPenalty = 0;
  for (const gap of gapReport.gaps) {
    totalPenalty += penaltyWeights[gap.severity] ?? 0.02;
  }

  return Math.min(1, totalPenalty);
}

/**
 * Compute technique coverage bonus.
 *
 * Having all 4 techniques → 1.0 (baseline).
 * Missing techniques reduce confidence multiplicatively.
 * Each missing technique applies a 0.85 factor.
 */
function computeCoverageFactor(bundle: TechniqueEvidenceBundle): number {
  const available = countTechniques(bundle);
  const total = 4; // XRD, XPS, FTIR, Raman
  const missing = total - available;
  return Math.pow(0.85, missing);
}

/**
 * Generate human-readable confidence summary.
 */
function generateConfidenceSummary(
  score: number,
  level: ResearchConfidenceLevel,
  techniqueCount: number,
  cvReport: CrossValidationReport,
  gapReport: GapAnalysisReport,
): string {
  const parts: string[] = [];

  parts.push(`Research Confidence: ${(score * 100).toFixed(1)}% (${level}).`);
  parts.push(
    `Based on ${techniqueCount}/4 techniques with ${cvReport.consistentCount} consistent, ` +
    `${cvReport.partiallyConsistentCount} partially consistent, and ${cvReport.inconsistentCount} ` +
    `inconsistent cross-validation checks.`,
  );

  if (gapReport.hasCriticalGaps) {
    parts.push(
      `WARNING: ${gapReport.gapsBySeverity.critical} critical validation gap(s) detected — confidence is limited.`,
    );
  }

  if (techniqueCount < 4) {
    parts.push(
      `Technique coverage is incomplete (${techniqueCount}/4). ` +
      `Collecting missing techniques would significantly improve confidence.`,
    );
  }

  switch (level) {
    case 'HIGH':
      parts.push('The evidence strongly supports the scientific conclusions. Material identity and properties are well-characterized.');
      break;
    case 'MEDIUM':
      parts.push('The evidence partially supports the conclusions but several validation gaps remain. Additional characterization recommended.');
      break;
    case 'LOW':
      parts.push('Significant gaps and/or inconsistencies exist. Conclusions should be considered preliminary until further validation.');
      break;
    case 'CRITICAL':
      parts.push('Insufficient or contradictory evidence. Material identity and properties cannot be reliably determined from current data alone.');
      break;
  }

  return parts.join(' ');
}

/**
 * Build the full ConfidenceScore object.
 */
function buildConfidenceScore(
  cvReport: CrossValidationReport,
  gapReport: GapAnalysisReport,
  bundle: TechniqueEvidenceBundle,
): ConfidenceScore {
  const consistencyScore = computeConsistencyScore(cvReport);
  const gapPenalty = computeGapPenalty(gapReport);
  const coverageFactor = computeCoverageFactor(bundle);

  const rawScore = consistencyScore * (1 - gapPenalty) * coverageFactor;
  const overallScore = clamp01(rawScore);
  const level = toResearchLevel(overallScore);

  const techniqueCount = countTechniques(bundle);

  // Consistency bonus: if all evaluated rules are consistent, apply a small bonus
  const evaluatedCorrelations = cvReport.correlations.filter(
    (c) => c.status !== 'insufficient_data',
  );
  const allConsistent = evaluatedCorrelations.length > 0 &&
    evaluatedCorrelations.every((c) => c.status === 'consistent');
  const consistencyBonus = allConsistent ? 1.1 : 1.0;

  // Build per-claim breakdown from correlations
  const claimScores = cvReport.correlations
    .filter((c) => c.status !== 'insufficient_data')
    .map((corr) => ({
      claimId: corr.ruleId,
      claimDescription: corr.ruleName,
      score: corr.confidence,
      level: corr.status === 'consistent'
        ? 'high' as const
        : corr.status === 'partially_consistent'
          ? 'medium' as const
          : 'low' as const,
      supportingTechniques: corr.status === 'consistent'
        ? [...corr.techniques] as Technique[]
        : [],
      contradictingTechniques: corr.status === 'inconsistent'
        ? [...corr.techniques] as Technique[]
        : [],
      weight: corr.weight,
    }));

  const summary = generateConfidenceSummary(
    overallScore, level, techniqueCount, cvReport, gapReport,
  );

  return {
    overallScore: Math.round(overallScore * 1000) / 1000,
    level,
    techniqueCoverageFactor: Math.round(coverageFactor * 1000) / 1000,
    consistencyBonus,
    claimScores,
    summary,
    timestamp: now(),
  };
}

// ---------------------------------------------------------------------------
// Next-Step Recommendation Engine
// ---------------------------------------------------------------------------

/**
 * Get a numeric priority value for sorting (lower = higher priority).
 */
function priorityValue(priority: string): number {
  const map: Record<string, number> = { critical: 1, high: 2, medium: 3, low: 4 };
  return map[priority] ?? 5;
}

/**
 * Get the pre-defined recommendation for a missing technique (TiO₂).
 */
function getRecommendationForMissingTechnique(
  technique: Technique,
  materialSystem: MaterialSystem,
  gapIds: string[],
): NextStepRecommendation | null {
  if (materialSystem !== 'TiO2') {
    return {
      recommendationId: `REC-MISSING-${technique}`,
      stepType: 'characterization' as NextStepType,
      recommendedTechnique: technique,
      description: `Perform ${technique} characterization on this sample.`,
      rationale: `${technique} data is required for complete cross-technique validation.`,
      priority: 1,
      addressesGapIds: gapIds,
      expectedConfidenceImpact: 0.20,
      timestamp: now(),
    };
  }

  const recMap: Record<string, { stepType: NextStepType; recommendedTechnique: Technique; description: string; rationale: string; expectedConfidenceImpact: number }> = {
    XPS: { ...TIO2_RECOMMENDATIONS.missingXps },
    FTIR: { ...TIO2_RECOMMENDATIONS.missingFtir },
    Raman: { ...TIO2_RECOMMENDATIONS.missingRaman },
    XRD: { ...TIO2_RECOMMENDATIONS.missingXrd },
  };

  const rec = recMap[technique];
  if (!rec) return null;

  return {
    recommendationId: `REC-MISSING-${technique}`,
    stepType: rec.stepType,
    recommendedTechnique: rec.recommendedTechnique,
    description: rec.description,
    rationale: rec.rationale,
    priority: 1,
    addressesGapIds: gapIds,
    expectedConfidenceImpact: rec.expectedConfidenceImpact,
    timestamp: now(),
  };
}

/**
 * Generate next-step recommendations based on identified gaps and
 * current evidence state.
 */
export function generateNextSteps(
  gapReport: GapAnalysisReport,
  cvReport: CrossValidationReport,
  bundle: TechniqueEvidenceBundle,
  materialSystem: MaterialSystem = 'TiO2',
  maxRecommendations: number = 5,
): NextStepRecommendation[] {
  const recommendations: NextStepRecommendation[] = [];
  const availableTechniques = new Set(
    Object.keys(bundle.evidenceByTechnique).filter(
      (k) => (bundle.evidenceByTechnique[k as Technique]?.length ?? 0) > 0,
    ) as Technique[],
  );

  // 1. Address missing techniques (highest priority)
  const missingGaps = gapReport.gaps.filter((g) => g.category === 'missing_technique');
  for (const gap of missingGaps) {
    const tech = gap.techniques[0];
    if (tech && !availableTechniques.has(tech)) {
      const rec = getRecommendationForMissingTechnique(tech, materialSystem, [gap.gapId]);
      if (rec) recommendations.push(rec);
    }
  }

  // 2. Address critical contradictions
  for (const gap of gapReport.gaps.filter(
    (g) => g.category === 'contradiction' && g.severity === 'critical',
  )) {
    recommendations.push({
      recommendationId: `REC-CONTRADICTION-${gap.gapId}`,
      stepType: 'validation',
      recommendedTechnique: gap.techniques[0],
      description: gap.recommendation,
      rationale: `Critical contradiction between ${gap.techniques.join(' and ')} must be resolved before conclusions can be trusted.`,
      priority: 2,
      addressesGapIds: [gap.gapId],
      expectedConfidenceImpact: 0.20,
      timestamp: now(),
    });
  }

  // 3. Address ambiguities
  for (const gap of gapReport.gaps.filter((g) => g.category === 'ambiguity')) {
    recommendations.push({
      recommendationId: `REC-AMBIGUITY-${gap.gapId}`,
      stepType: 'characterization',
      recommendedTechnique: 'Raman',
      description: gap.recommendation,
      rationale: 'Phase ambiguity requires additional characterization to quantify phase fractions accurately.',
      priority: 3,
      addressesGapIds: [gap.gapId],
      expectedConfidenceImpact: 0.15,
      timestamp: now(),
    });
  }

  // 4. Address high-severity gaps
  for (const gap of gapReport.gaps.filter(
    (g) =>
      g.severity === 'high' &&
      g.category !== 'missing_technique' &&
      g.category !== 'contradiction',
  )) {
    recommendations.push({
      recommendationId: `REC-HIGH-${gap.gapId}`,
      stepType: 'validation',
      recommendedTechnique: gap.techniques[0],
      description: gap.recommendation,
      rationale: gap.interpretation,
      priority: 3,
      addressesGapIds: [gap.gapId],
      expectedConfidenceImpact: 0.10,
      timestamp: now(),
    });
  }

  // 5. Address medium-severity quantitative mismatches
  for (const gap of gapReport.gaps.filter(
    (g) => g.severity === 'medium' && g.category === 'quantitative_mismatch',
  )) {
    recommendations.push({
      recommendationId: `REC-MEDIUM-${gap.gapId}`,
      stepType: 'exploration',
      recommendedTechnique: gap.techniques[0],
      description: gap.recommendation,
      rationale: gap.interpretation,
      priority: 4,
      addressesGapIds: [gap.gapId],
      expectedConfidenceImpact: 0.05,
      timestamp: now(),
    });
  }

  // 6. If confidence is still low and no recommendations, suggest TEM
  const confidence = buildConfidenceScore(cvReport, gapReport, bundle);
  if (confidence.overallScore < 0.5 && recommendations.length === 0) {
    recommendations.push({
      recommendationId: 'REC-GENERAL-IMPROVEMENT',
      stepType: 'exploration',
      recommendedTechnique: 'TEM',
      description: 'Perform TEM imaging and SAED for direct structural characterization at the nanoscale.',
      rationale: 'Current confidence is low. TEM provides complementary structural information that can validate or refute conclusions from XRD, Raman, XPS, and FTIR.',
      priority: 3,
      addressesGapIds: gapReport.gaps.map((g) => g.gapId),
      expectedConfidenceImpact: 0.15,
      timestamp: now(),
    });
  }

  // Sort by priority (lower number = higher priority)
  recommendations.sort((a, b) => a.priority - b.priority);

  // Limit to maxRecommendations
  return recommendations.slice(0, maxRecommendations);
}

// ---------------------------------------------------------------------------
// Full Decision Report
// ---------------------------------------------------------------------------

/**
 * Generate the complete decision report (Stage 6 result).
 *
 * @param cvReport - Cross-validation report from Stage 4.
 * @param gapReport - Gap analysis report from Stage 5.
 * @param bundle - Original evidence bundle.
 * @param materialSystem - Material system identifier.
 * @param maxRecommendations - Maximum number of recommendations.
 * @returns Complete DecisionReport.
 */
export function generateDecision(
  cvReport: CrossValidationReport,
  gapReport: GapAnalysisReport,
  bundle: TechniqueEvidenceBundle,
  materialSystem: MaterialSystem = 'TiO2',
  maxRecommendations: number = 5,
): DecisionReport {
  const confidence = buildConfidenceScore(cvReport, gapReport, bundle);
  const recommendations = generateNextSteps(
    gapReport, cvReport, bundle, materialSystem, maxRecommendations,
  );

  const objectiveMet = confidence.level === 'HIGH';

  // Generate decision summary
  const decisionSummary = generateDecisionSummary(confidence, gapReport, materialSystem);

  return {
    confidence,
    recommendations,
    objectiveMet,
    decisionSummary,
    timestamp: now(),
  };
}

/**
 * Generate a concise decision summary paragraph.
 */
function generateDecisionSummary(
  confidence: ConfidenceScore,
  gapReport: GapAnalysisReport,
  materialSystem: MaterialSystem,
): string {
  const parts: string[] = [];

  if (materialSystem === 'TiO2') {
    parts.push(
      `Cross-technique analysis of TiO₂ sample yields a research confidence of ${(confidence.overallScore * 100).toFixed(1)}% (${confidence.level}).`,
    );
  } else {
    parts.push(
      `Multi-technique analysis yields a research confidence of ${(confidence.overallScore * 100).toFixed(1)}% (${confidence.level}).`,
    );
  }

  if (confidence.level === 'HIGH') {
    parts.push('The research objective is met. Evidence strongly supports the material identity and property conclusions.');
  } else if (confidence.level === 'MEDIUM') {
    parts.push('The research objective is partially met. Additional characterization is recommended to reach HIGH confidence.');
  } else if (confidence.level === 'LOW') {
    parts.push('The research objective is not yet met. Significant validation gaps remain. Follow the recommended next steps to improve confidence.');
  } else {
    parts.push('The research objective cannot be met with current evidence. Critical gaps or contradictions must be resolved.');
  }

  if (gapReport.hasCriticalGaps) {
    parts.push(`${gapReport.gapsBySeverity.critical} critical gap(s) require immediate attention.`);
  }

  return parts.join(' ');
}