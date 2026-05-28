/**
 * Universal Router Engine — Type Definitions
 *
 * Defines the types for the technique-agnostic routing system that
 * dispatches evidence through the 7-stage deterministic workflow.
 *
 * @module routerEngine/types
 */

import type {
  Technique,
  TechniqueDomain,
} from '../../types/universalTechnique';

import type {
  UniversalEvidenceNode,
  ConfidenceLevel,
  SignalQuality,
} from '../../types/universalEvidence';

import type {
  EvidenceStage,
  UniversalResearchEvidence,
  DatasetArtifact,
  ProcessingArtifact,
  FeaturesArtifact,
  InterpretationArtifact,
  ComparisonArtifact,
  GapAnalysisArtifact,
  DecisionArtifact,
} from '../../types/universalResearchEvidence';

// ---------------------------------------------------------------------------
// Router Request / Response
// ---------------------------------------------------------------------------

/**
 * Input request to the Universal Router.
 *
 * Any technique module or agent submits this to initiate or continue
 * a deterministic evidence workflow.
 */
export interface RouterRequest {
  /** Unique request identifier (UUIDv4). */
  readonly requestId: string;

  /** Target technique module. */
  readonly technique: Technique;

  /** Research objective driving this analysis. */
  readonly researchObjective: string;

  /** Sample identifier. */
  readonly sampleId: string;

  /** Raw data payload (technique-specific format). */
  readonly rawData: RawDataPayload;

  /** Starting stage (defaults to 'dataset'). */
  readonly startStage?: EvidenceStage;

  /** Processing configuration overrides. */
  readonly processingConfig?: ProcessingConfig;

  /** ISO 8601 timestamp of request creation. */
  readonly requestedAt: string;
}

/**
 * Output response from the Universal Router.
 *
 * Contains the evidence artifact for the completed stage(s),
 * plus routing metadata.
 */
export interface RouterResponse {
  /** Original request ID. */
  readonly requestId: string;

  /** Technique that was routed. */
  readonly technique: Technique;

  /** Stage that was completed. */
  readonly completedStage: EvidenceStage;

  /** The evidence artifact produced by this stage. */
  readonly artifact: StageArtifact;

  /** Whether additional stages remain. */
  readonly hasMoreStages: boolean;

  /** Next stage to execute (if any). */
  readonly nextStage?: EvidenceStage;

  /** Routing decision metadata. */
  readonly routingDecision: RoutingDecision;

  /** ISO 8601 timestamp of response. */
  readonly respondedAt: string;
}

/**
 * Union of all possible stage artifacts.
 */
export type StageArtifact =
  | DatasetArtifact
  | ProcessingArtifact
  | FeaturesArtifact
  | InterpretationArtifact
  | ComparisonArtifact
  | GapAnalysisArtifact
  | DecisionArtifact;

// ---------------------------------------------------------------------------
// Raw Data Payload
// ---------------------------------------------------------------------------

/**
 * Technique-agnostic raw data payload.
 *
 * Each technique module provides its data in a normalized format
 * that the router can process uniformly.
 */
export interface RawDataPayload {
  /** Data format identifier. */
  readonly format: 'csv' | 'json' | 'xy_pairs' | 'spectrum_array';

  /** Primary axis values (2θ, wavenumber, binding energy, etc.). */
  readonly primaryAxis: readonly number[];

  /** Measurement values (intensity, counts, absorbance, etc.). */
  readonly values: readonly number[];

  /** Primary axis unit string. */
  readonly primaryAxisUnit: string;

  /** Measurement value unit string. */
  readonly valueUnit: string;

  /** Original file name (if applicable). */
  readonly fileName?: string;

  /** Additional metadata from the data source. */
  readonly metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Processing Configuration
// ---------------------------------------------------------------------------

/**
 * Technique-specific processing configuration.
 *
 * Allows callers to override default processing parameters.
 * Unspecified parameters use technique-specific defaults.
 */
export interface ProcessingConfig {
  /** Baseline correction algorithm. */
  readonly baselineAlgorithm?: 'polynomial' | 'linear' | 'none';

  /** Polynomial order for baseline correction (technique-dependent default). */
  readonly polynomialOrder?: number;

  /** Smoothing algorithm. */
  readonly smoothingAlgorithm?: 'savitzky_golay' | 'moving_average' | 'none';

  /** Smoothing window size. */
  readonly smoothingWindow?: number;

  /** Normalization method. */
  readonly normalizationMethod?: 'min_max' | 'z_score' | 'area' | 'none';

  /** Peak detection sensitivity (0.0–1.0). */
  readonly detectionSensitivity?: number;

  /** Minimum peak height threshold (relative to max). */
  readonly minPeakHeight?: number;

  /** Custom parameters for technique-specific processing. */
  readonly custom?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Routing Decision
// ---------------------------------------------------------------------------

/**
 * Metadata about how the router dispatched this request.
 *
 * Every routing decision is logged in the Approval Ledger for
 * full auditability.
 */
export interface RoutingDecision {
  /** Unique decision ID. */
  readonly decisionId: string;

  /** Technique that was routed. */
  readonly technique: Technique;

  /** Domain of the technique. */
  readonly domain: TechniqueDomain;

  /** Stage that was executed. */
  readonly stage: EvidenceStage;

  /** Handler that processed this stage. */
  readonly handlerId: string;

  /** Whether a technique-specific handler was used (vs. generic). */
  readonly usedTechniqueHandler: boolean;

  /** Processing time in milliseconds. */
  readonly processingTimeMs: number;

  /** Any routing warnings. */
  readonly warnings: readonly string[];

  /** ISO 8601 timestamp of the routing decision. */
  readonly decidedAt: string;
}

// ---------------------------------------------------------------------------
// Technique Handler Interface
// ---------------------------------------------------------------------------

/**
 * Interface that every technique-specific handler must implement.
 *
 * Handlers are registered with the router and invoked when a request
 * targets their technique. If no handler is registered for a technique,
 * the router falls back to the generic handler.
 *
 * Each handler implements the 7-stage pipeline for its technique.
 * Handlers may delegate to the generic handler for stages that don't
 * require technique-specific logic.
 */
export interface TechniqueHandler {
  /** The technique this handler serves. */
  readonly technique: Technique;

  /** Human-readable handler name. */
  readonly name: string;

  /** Handler version (semver). */
  readonly version: string;

  /**
   * Process a single stage of the evidence workflow.
   *
   * @param stage - The stage to process.
   * @param request - The original router request.
   * @param previousArtifacts - Artifacts from previously completed stages.
   * @returns The artifact for the completed stage.
   */
  processStage(
    stage: EvidenceStage,
    request: RouterRequest,
    previousArtifacts: Map<EvidenceStage, StageArtifact>,
  ): Promise<StageArtifact>;
}

// ---------------------------------------------------------------------------
// Router Event Types (for the Approval Ledger)
// ---------------------------------------------------------------------------

/**
 * Events emitted by the router for the Approval Ledger.
 */
export type RouterEvent =
  | RouterRequestEvent
  | RouterStageStartEvent
  | RouterStageCompleteEvent
  | RouterErrorEvent
  | RouterParameterChangeEvent;

export interface RouterRequestEvent {
  readonly type: 'router:request';
  readonly requestId: string;
  readonly technique: Technique;
  readonly timestamp: string;
}

export interface RouterStageStartEvent {
  readonly type: 'router:stage_start';
  readonly requestId: string;
  readonly stage: EvidenceStage;
  readonly handlerId: string;
  readonly timestamp: string;
}

export interface RouterStageCompleteEvent {
  readonly type: 'router:stage_complete';
  readonly requestId: string;
  readonly stage: EvidenceStage;
  readonly artifact: StageArtifact;
  readonly routingDecision: RoutingDecision;
  readonly timestamp: string;
}

export interface RouterErrorEvent {
  readonly type: 'router:error';
  readonly requestId: string;
  readonly stage: EvidenceStage;
  readonly error: string;
  readonly timestamp: string;
}

export interface RouterParameterChangeEvent {
  readonly type: 'router:parameter_change';
  readonly requestId: string;
  readonly stage: EvidenceStage;
  readonly parameter: string;
  readonly oldValue: unknown;
  readonly newValue: unknown;
  readonly timestamp: string;
}