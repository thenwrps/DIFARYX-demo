/**
 * Universal Research Evidence — 7-Stage Deterministic Workflow Contract
 *
 * Defines the complete research evidence lifecycle that every technique
 * module MUST adhere to. This is the architectural backbone of DIFARYX:
 *
 *   Dataset → Processing → Features → Interpretation → Comparison →
 *   Gap Analysis → Decision
 *
 * Each stage produces a typed, immutable artifact. The Approval Ledger
 * (implemented in Phase 1.3) will log every transition between stages
 * for full reproducibility.
 *
 * @module universalResearchEvidence
 */

import type { Technique, TechniqueDomain } from './universalTechnique';
import type {
  UniversalEvidenceNode,
  ConfidenceLevel,
  SignalQuality,
  EvidenceProvenance,
} from './universalEvidence';

// ---------------------------------------------------------------------------
// Stage Enum
// ---------------------------------------------------------------------------

/**
 * The 7 deterministic stages of the DIFARYX research evidence workflow.
 *
 * Every characterization technique follows this exact pipeline.
 * Stages are sequential; no stage may be skipped.
 */
export type EvidenceStage =
  | 'dataset'         // Stage 0: Raw data ingestion & validation
  | 'processing'      // Stage 1: Signal processing (baseline, smoothing, normalization)
  | 'features'        // Stage 2: Feature detection (peaks, bands, edges, particles)
  | 'interpretation'  // Stage 3: Scientific interpretation (phase ID, assignments, fitting)
  | 'comparison'      // Stage 4: Cross-reference / cross-technique comparison
  | 'gap_analysis'    // Stage 5: Validation gap identification
  | 'decision';       // Stage 6: Next experiment recommendation / scientific decision

/** Ordered array of all stages for iteration. */
export const EVIDENCE_STAGES: readonly EvidenceStage[] = [
  'dataset',
  'processing',
  'features',
  'interpretation',
  'comparison',
  'gap_analysis',
  'decision',
] as const;

// ---------------------------------------------------------------------------
// Stage 0: Dataset
// ---------------------------------------------------------------------------

/**
 * Stage 0 — Raw dataset artifact.
 *
 * Captures the ingested data, its format, quality, and provenance.
 * This is the immutable starting point of every evidence chain.
 */
export interface DatasetArtifact {
  readonly stage: 'dataset';
  readonly technique: Technique;
  readonly domain: TechniqueDomain;

  /** Original file name or data source identifier. */
  readonly sourceName: string;

  /** MIME type or format descriptor (e.g., 'text/csv', 'application/json'). */
  readonly format: string;

  /** Number of data points ingested. */
  readonly pointCount: number;

  /** Primary axis range [min, max]. */
  readonly primaryAxisRange: readonly [number, number];

  /** Primary axis unit. */
  readonly primaryAxisUnit: string;

  /** Signal quality assessment. */
  readonly signalQuality: SignalQuality;

  /** SHA-256 hash of the raw dataset for integrity verification. */
  readonly dataHash: string;

  /** ISO 8601 timestamp of ingestion. */
  readonly ingestedAt: string;

  /** Any warnings generated during ingestion. */
  readonly warnings: readonly string[];
}

// ---------------------------------------------------------------------------
// Stage 1: Processing
// ---------------------------------------------------------------------------

/**
 * Stage 1 — Processing artifact.
 *
 * Records all signal processing steps applied to the raw dataset.
 * Each step is logged with its parameters for full reproducibility.
 */
export interface ProcessingArtifact {
  readonly stage: 'processing';
  readonly technique: Technique;

  /** Ordered list of processing steps applied. */
  readonly steps: readonly ProcessingStep[];

  /** Final processed data quality assessment. */
  readonly outputQuality: SignalQuality;

  /** SHA-256 hash of the processed dataset. */
  readonly processedDataHash: string;

  /** ISO 8601 timestamp of processing completion. */
  readonly processedAt: string;
}

/** A single signal processing step with its parameters. */
export interface ProcessingStep {
  /** Step identifier (e.g., 'baseline_correction', 'smoothing', 'normalization'). */
  readonly operation: string;

  /** Algorithm used (e.g., 'polynomial', 'savitzky_golay', 'min_max'). */
  readonly algorithm: string;

  /** Parameters applied (JSON-serializable). */
  readonly parameters: Record<string, unknown>;

  /** ISO 8601 timestamp when this step was executed. */
  readonly executedAt: string;

  /** Human-readable description of this step. */
  readonly description: string;
}

// ---------------------------------------------------------------------------
// Stage 2: Features
// ---------------------------------------------------------------------------

/**
 * Stage 2 — Feature detection artifact.
 *
 * Contains all detected features (peaks, bands, edges, particles, etc.)
 * as UniversalEvidenceNode instances.
 */
export interface FeaturesArtifact {
  readonly stage: 'features';
  readonly technique: Technique;

  /** All detected features as universal evidence nodes. */
  readonly features: readonly UniversalEvidenceNode[];

  /** Total number of features detected. */
  readonly featureCount: number;

  /** Detection algorithm used. */
  readonly detectionAlgorithm: string;

  /** Detection parameters. */
  readonly detectionParameters: Record<string, unknown>;

  /** ISO 8601 timestamp of feature detection. */
  readonly detectedAt: string;
}

// ---------------------------------------------------------------------------
// Stage 3: Interpretation
// ---------------------------------------------------------------------------

/**
 * Stage 3 — Scientific interpretation artifact.
 *
 * Maps detected features to scientific meaning: phase assignments,
 * chemical state identifications, functional group assignments, etc.
 */
export interface InterpretationArtifact {
  readonly stage: 'interpretation';
  readonly technique: Technique;

  /** Interpretations keyed by feature ID. */
  readonly interpretations: readonly FeatureInterpretation[];

  /** Reference database used for matching. */
  readonly referenceDatabase: string;

  /** Total number of features interpreted. */
  readonly interpretedCount: number;

  /** Confidence in the overall interpretation. */
  readonly overallConfidence: ConfidenceLevel;

  /** ISO 8601 timestamp of interpretation. */
  readonly interpretedAt: string;
}

/** Interpretation of a single feature. */
export interface FeatureInterpretation {
  /** ID of the feature being interpreted. */
  readonly featureId: string;

  /** Primary assignment (e.g., phase name, chemical state, functional group). */
  readonly assignment: string;

  /** Confidence in this specific interpretation. */
  readonly confidence: ConfidenceLevel;

  /** Supporting evidence or reasoning. */
  readonly reasoning: string;

  /** Reference entries that matched. */
  readonly references: readonly ReferenceMatch[];
}

/** A matched reference entry. */
export interface ReferenceMatch {
  /** Reference identifier (e.g., ICSD ID, RRUFF ID, NIST ID). */
  readonly referenceId: string;

  /** Reference name (e.g., 'Fe2O3 hematite', 'Si-O symmetric stretch'). */
  readonly name: string;

  /** Source database. */
  readonly database: string;

  /** Match score (0.0 – 1.0). */
  readonly matchScore: number;
}

// ---------------------------------------------------------------------------
// Stage 4: Comparison
// ---------------------------------------------------------------------------

/**
 * Stage 4 — Cross-reference / cross-technique comparison artifact.
 *
 * Compares current evidence against reference data, literature values,
 * or evidence from other techniques.
 */
export interface ComparisonArtifact {
  readonly stage: 'comparison';
  readonly technique: Technique;

  /** Type of comparison performed. */
  readonly comparisonType: 'reference_match' | 'cross_technique' | 'literature' | 'historical';

  /** Comparison results. */
  readonly results: readonly ComparisonResult[];

  /** Overall consistency assessment. */
  readonly consistencyScore: number;

  /** ISO 8601 timestamp of comparison. */
  readonly comparedAt: string;
}

/** A single comparison result. */
export interface ComparisonResult {
  /** What was compared. */
  readonly subject: string;

  /** What it was compared against. */
  readonly reference: string;

  /** Numeric difference or deviation. */
  readonly deviation: number;

  /** Unit of the deviation. */
  readonly deviationUnit: string;

  /** Whether the comparison is within acceptable tolerance. */
  readonly withinTolerance: boolean;

  /** Tolerance threshold used. */
  readonly toleranceThreshold: number;

  /** Interpretation of the deviation. */
  readonly interpretation: string;
}

// ---------------------------------------------------------------------------
// Stage 5: Gap Analysis
// ---------------------------------------------------------------------------

/**
 * Stage 5 — Validation gap analysis artifact.
 *
 * Identifies what evidence is missing or insufficient to reach a
 * confident scientific conclusion.
 */
export interface GapAnalysisArtifact {
  readonly stage: 'gap_analysis';
  readonly technique: Technique;

  /** Identified validation gaps. */
  readonly gaps: readonly ValidationGap[];

  /** Total number of gaps identified. */
  readonly gapCount: number;

  /** Whether all critical gaps have been addressed. */
  readonly criticalGapsResolved: boolean;

  /** ISO 8601 timestamp of gap analysis. */
  readonly analyzedAt: string;
}

/** A single validation gap. */
export interface ValidationGap {
  /** Unique gap identifier. */
  readonly gapId: string;

  /** Category of the gap. */
  readonly category: 'missing_technique' | 'insufficient_evidence' | 'ambiguous_result' | 'conflicting_data';

  /** Severity: critical gaps block decision-making. */
  readonly severity: 'critical' | 'major' | 'minor';

  /** Human-readable description of the gap. */
  readonly description: string;

  /** Recommended action to resolve this gap. */
  readonly recommendedAction: string;

  /** Technique(s) that could provide the missing evidence. */
  readonly suggestedTechniques: readonly Technique[];
}

// ---------------------------------------------------------------------------
// Stage 6: Decision
// ---------------------------------------------------------------------------

/**
 * Stage 6 — Scientific decision artifact.
 *
 * The final output of the deterministic workflow: either a scientific
 * conclusion with confidence, or a recommendation for the next experiment.
 */
export interface DecisionArtifact {
  readonly stage: 'decision';

  /** The scientific decision or recommendation. */
  readonly decision: string;

  /** Whether this is a final conclusion or next-step recommendation. */
  readonly decisionType: 'conclusion' | 'next_experiment';

  /** Confidence in the decision. */
  readonly confidence: ConfidenceLevel;

  /** Evidence summary supporting this decision. */
  readonly evidenceSummary: string;

  /** Caveats and limitations. */
  readonly caveats: readonly string[];

  /** Next experiment recommendation (if decisionType is 'next_experiment'). */
  readonly nextExperiment?: NextExperimentRecommendation;

  /** ISO 8601 timestamp of the decision. */
  readonly decidedAt: string;
}

/** Recommendation for the next experiment to run. */
export interface NextExperimentRecommendation {
  /** Recommended technique. */
  readonly technique: Technique;

  /** Rationale for choosing this technique. */
  readonly rationale: string;

  /** Suggested experimental parameters. */
  readonly suggestedParameters: Record<string, unknown>;

  /** Expected outcome and what it would resolve. */
  readonly expectedOutcome: string;

  /** Priority level. */
  readonly priority: 'high' | 'medium' | 'low';
}

// ---------------------------------------------------------------------------
// Complete Research Evidence (All 7 Stages)
// ---------------------------------------------------------------------------

/**
 * The complete Universal Research Evidence artifact.
 *
 * Aggregates all 7 stages into a single, immutable, reproducible
 * scientific record. Every technique module produces this artifact
 * at the end of its deterministic workflow.
 */
export interface UniversalResearchEvidence {
  /** Unique identifier for this evidence chain. */
  readonly id: string;

  /** Source technique. */
  readonly technique: Technique;

  /** Measurement domain. */
  readonly domain: TechniqueDomain;

  /** Research objective that initiated this workflow. */
  readonly researchObjective: string;

  /** Sample identifier. */
  readonly sampleId: string;

  /** Stage 0: Dataset. */
  readonly dataset: DatasetArtifact;

  /** Stage 1: Processing. */
  readonly processing: ProcessingArtifact;

  /** Stage 2: Features. */
  readonly features: FeaturesArtifact;

  /** Stage 3: Interpretation. */
  readonly interpretation: InterpretationArtifact;

  /** Stage 4: Comparison. */
  readonly comparison: ComparisonArtifact;

  /** Stage 5: Gap Analysis. */
  readonly gapAnalysis: GapAnalysisArtifact;

  /** Stage 6: Decision. */
  readonly decision: DecisionArtifact;

  /** Provenance for the entire evidence chain. */
  readonly provenance: EvidenceProvenance;

  /** SHA-256 hash of the entire evidence artifact for integrity. */
  readonly artifactHash: string;

  /** ISO 8601 timestamp of evidence chain creation. */
  readonly createdAt: string;
}