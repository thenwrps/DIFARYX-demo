/**
 * Reasoning Engine — Type Definitions
 *
 * Defines all analytical structures for cross-technique scientific
 * correlation, gap analysis, and decision intelligence.
 *
 * @module reasoningEngine/types
 */

import type { Technique } from '../../types/universalTechnique';
import type {
  UniversalEvidenceNode,
  ConfidenceLevel,
  SignalQuality,
} from '../../types/universalEvidence';

// ---------------------------------------------------------------------------
// Material System Types
// ---------------------------------------------------------------------------

/** Supported material systems for cross-validation rules. */
export type MaterialSystem = 'TiO2' | 'NiFe2O4' | 'ZnO' | 'Fe2O3' | 'generic';

/** Crystal phase identifier within a material system. */
export interface CrystalPhase {
  /** Phase name (e.g., 'anatase', 'rutile'). */
  name: string;
  /** Space group (e.g., 'I41/amd', 'P42/mnm'). */
  spaceGroup: string;
  /** Crystal system. */
  crystalSystem: string;
}

// ---------------------------------------------------------------------------
// Technique Evidence Bundle
// ---------------------------------------------------------------------------

/**
 * Groups UniversalEvidenceNode arrays by technique for a single sample.
 * The key is the Technique identifier; the value is the array of evidence
 * nodes produced by that technique's workspace.
 */
export interface TechniqueEvidenceBundle {
  /** Unique sample/material identifier. */
  sampleId: string;
  /** Material system (if determinable). */
  materialSystem?: MaterialSystem;
  /** Evidence nodes grouped by technique. */
  evidenceByTechnique: Partial<Record<Technique, UniversalEvidenceNode[]>>;
  /** ISO 8601 timestamp of bundle assembly. */
  assembledAt: string;
}

// ---------------------------------------------------------------------------
// Cross-Validation Correlation Types
// ---------------------------------------------------------------------------

/**
 * Pair of techniques involved in a correlation check.
 */
export type TechniquePair = readonly [Technique, Technique];

/**
 * Status of a single cross-correlation check.
 */
export type CorrelationStatus =
  | 'consistent'
  | 'partially_consistent'
  | 'inconsistent'
  | 'insufficient_data';

/**
 * Result of a single cross-validation correlation check.
 */
export interface CorrelationResult {
  /** Unique identifier for this correlation rule. */
  ruleId: string;
  /** Human-readable rule name. */
  ruleName: string;
  /** Techniques involved. */
  techniques: TechniquePair;
  /** Material system this rule applies to (if material-specific). */
  materialSystem?: MaterialSystem;
  /** Correlation status. */
  status: CorrelationStatus;
  /** Confidence in this correlation result [0.0, 1.0]. */
  confidence: number;
  /** Importance weight for overall scoring [0.0, 1.0]. */
  weight: number;
  /** Evidence node IDs that participated in this check. */
  participatingEvidenceIds: string[];
  /** Human-readable scientific reasoning explanation. */
  reasoning: string;
  /** Additional structured data (e.g., matched peak positions). */
  details?: Record<string, unknown>;
  /** ISO 8601 timestamp. */
  timestamp: string;
}

/**
 * Complete report from cross-validation stage.
 */
export interface CrossValidationReport {
  /** Total number of rules evaluated. */
  rulesEvaluated: number;
  /** Number of rules with 'consistent' status. */
  consistentCount: number;
  /** Number of rules with 'inconsistent' status. */
  inconsistentCount: number;
  /** Number of rules with 'partially_consistent' status. */
  partiallyConsistentCount: number;
  /** Number of rules with 'insufficient_data' status. */
  insufficientDataCount: number;
  /** All individual correlation results. */
  correlations: CorrelationResult[];
  /** ISO 8601 timestamp. */
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Gap Analysis Types (Stage 5)
// ---------------------------------------------------------------------------

/**
 * Severity of a validation gap.
 */
export type GapSeverity = 'critical' | 'high' | 'medium' | 'low';

/**
 * Category of validation gap.
 */
export type GapCategory =
  | 'contradiction'
  | 'missing_technique'
  | 'quantitative_mismatch'
  | 'ambiguity'
  | 'data_quality';

/**
 * A detected validation gap or inconsistency.
 */
export interface ValidationGap {
  /** Unique gap identifier. */
  gapId: string;
  /** Gap category. */
  category: GapCategory;
  /** Severity level. */
  severity: GapSeverity;
  /** Techniques involved in this gap. */
  techniques: Technique[];
  /** Material system (if applicable). */
  materialSystem?: MaterialSystem;
  /** Human-readable description of the gap. */
  description: string;
  /** Scientific interpretation of what this gap means. */
  interpretation: string;
  /** Which correlation rule IDs relate to this gap. */
  relatedCorrelationIds: string[];
  /** Recommended action to resolve this gap. */
  recommendation: string;
  /** ISO 8601 timestamp. */
  timestamp: string;
}

/**
 * Complete report from gap analysis stage.
 */
export interface GapAnalysisReport {
  /** Total gaps detected. */
  totalGaps: number;
  /** Gaps grouped by severity. */
  gapsBySeverity: Record<GapSeverity, number>;
  /** All detected gaps. */
  gaps: ValidationGap[];
  /** Whether any critical gaps were found. */
  hasCriticalGaps: boolean;
  /** ISO 8601 timestamp. */
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Decision Intelligence Types (Stage 6)
// ---------------------------------------------------------------------------

/**
 * Overall research confidence level.
 */
export type ResearchConfidenceLevel =
  | 'HIGH'
  | 'MEDIUM'
  | 'LOW'
  | 'CRITICAL';

/**
 * Per-claim confidence breakdown.
 */
export interface ClaimConfidence {
  /** Claim identifier (e.g., 'anatase_phase', 'Ti4+_oxidation'). */
  claimId: string;
  /** Human-readable claim description. */
  claimDescription: string;
  /** Confidence score for this claim [0.0, 1.0]. */
  score: number;
  /** Confidence level bucket. */
  level: ConfidenceLevel;
  /** Techniques that support this claim. */
  supportingTechniques: Technique[];
  /** Techniques that contradict this claim. */
  contradictingTechniques: Technique[];
  /** Weight used in overall calculation. */
  weight: number;
}

/**
 * Overall confidence score with full breakdown.
 */
export interface ConfidenceScore {
  /** Overall weighted confidence [0.0, 1.0]. */
  overallScore: number;
  /** Research confidence level bucket. */
  level: ResearchConfidenceLevel;
  /** Technique coverage factor [0.0, 1.0] — fraction of expected techniques present. */
  techniqueCoverageFactor: number;
  /** Consistency bonus multiplier [1.0, 1.2]. */
  consistencyBonus: number;
  /** Per-claim breakdown. */
  claimScores: ClaimConfidence[];
  /** Human-readable summary. */
  summary: string;
  /** ISO 8601 timestamp. */
  timestamp: string;
}

/**
 * Type of recommended next step.
 */
export type NextStepType =
  | 'characterization'
  | 'validation'
  | 'confirmation'
  | 'exploration';

/**
 * A recommended next characterization step.
 */
export interface NextStepRecommendation {
  /** Unique recommendation identifier. */
  recommendationId: string;
  /** Type of step. */
  stepType: NextStepType;
  /** Recommended technique to perform. */
  recommendedTechnique?: Technique;
  /** Human-readable description of the recommended action. */
  description: string;
  /** Scientific rationale for this recommendation. */
  rationale: string;
  /** Priority (1 = highest). */
  priority: number;
  /** Which gap this recommendation addresses. */
  addressesGapIds: string[];
  /** Expected impact on confidence if performed [0.0, 1.0]. */
  expectedConfidenceImpact: number;
  /** ISO 8601 timestamp. */
  timestamp: string;
}

/**
 * Complete decision report from Stage 6.
 */
export interface DecisionReport {
  /** Confidence score with breakdown. */
  confidence: ConfidenceScore;
  /** Recommended next steps (ordered by priority). */
  recommendations: NextStepRecommendation[];
  /** Whether the research objective is met (confidence >= HIGH threshold). */
  objectiveMet: boolean;
  /** Human-readable decision summary. */
  decisionSummary: string;
  /** ISO 8601 timestamp. */
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Full Reasoning Report
// ---------------------------------------------------------------------------

/**
 * Complete output of the Reasoning Engine pipeline.
 * Combines cross-validation (Stage 4), gap analysis (Stage 5),
 * and decision intelligence (Stage 6).
 */
export interface ReasoningReport {
  /** Unique report identifier. */
  reportId: string;
  /** Sample/material identifier. */
  sampleId: string;
  /** Material system analyzed. */
  materialSystem: MaterialSystem;
  /** Techniques that were available for analysis. */
  techniquesAnalyzed: Technique[];
  /** Stage 4: Cross-validation results. */
  crossValidation: CrossValidationReport;
  /** Stage 5: Gap analysis results. */
  gapAnalysis: GapAnalysisReport;
  /** Stage 6: Decision intelligence results. */
  decision: DecisionReport;
  /** ISO 8601 timestamp of report generation. */
  generatedAt: string;
  /** Engine version string. */
  engineVersion: string;
}

// ---------------------------------------------------------------------------
// Engine Configuration
// ---------------------------------------------------------------------------

/**
 * Configuration options for the ReasoningEngine.
 */
export interface ReasoningEngineOptions {
  /** Material system to apply rules for. Default: 'generic'. */
  materialSystem?: MaterialSystem;
  /** Minimum confidence threshold for HIGH level. Default: 0.85. */
  highConfidenceThreshold?: number;
  /** Minimum confidence threshold for MEDIUM level. Default: 0.65. */
  mediumConfidenceThreshold?: number;
  /** Minimum confidence threshold for LOW level. Default: 0.40. */
  lowConfidenceThreshold?: number;
  /** Maximum number of next-step recommendations to generate. Default: 5. */
  maxRecommendations?: number;
  /** Techniques expected for full analysis. Default: ['XRD', 'XPS', 'FTIR', 'Raman']. */
  expectedTechniques?: Technique[];
  /** Custom rule weights override. */
  ruleWeights?: Record<string, number>;
}
