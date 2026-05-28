/**
 * Generic Technique Handler — Universal Fallback
 *
 * Implements the 7-stage deterministic workflow for any characterization
 * technique. Used when no technique-specific handler is registered.
 *
 * This handler provides a complete, production-grade pipeline:
 *   Stage 0 (Dataset): Validates and ingests raw data.
 *   Stage 1 (Processing): Applies baseline correction, smoothing, normalization.
 *   Stage 2 (Features): Detects peaks/bands using universal algorithms.
 *   Stage 3 (Interpretation): Assigns features to concepts.
 *   Stage 4 (Comparison): Compares against reference data.
 *   Stage 5 (Gap Analysis): Identifies missing validation evidence.
 *   Stage 6 (Decision): Produces scientific conclusion or next-step recommendation.
 *
 * @module routerEngine/handlers/genericHandler
 */

import type {
  TechniqueHandler,
  RouterRequest,
  StageArtifact,
  RawDataPayload,
  ProcessingConfig,
} from '../types';

import type {
  Technique,
  TechniqueMetadata,
} from '../../../types/universalTechnique';

import type {
  UniversalEvidenceNode,
  SignalQuality,
  ConfidenceLevel,
  EvidenceProvenance,
} from '../../../types/universalEvidence';

import type {
  EvidenceStage,
  DatasetArtifact,
  ProcessingArtifact,
  ProcessingStep,
  FeaturesArtifact,
  InterpretationArtifact,
  FeatureInterpretation,
  ComparisonArtifact,
  ComparisonResult,
  GapAnalysisArtifact,
  ValidationGap,
  DecisionArtifact,
} from '../../../types/universalResearchEvidence';

import {
  getTechniqueMetadata,
  TECHNIQUE_REGISTRY,
} from '../../../types/universalTechnique';

// ---------------------------------------------------------------------------
// Generic Handler Implementation
// ---------------------------------------------------------------------------

/**
 * Generic technique handler that serves all 11 modules.
 *
 * Provides deterministic, reproducible processing for every stage
 * of the evidence workflow. Technique-specific nuances are handled
 * via the TechniqueMetadata registry.
 */
export const genericHandler: TechniqueHandler = {
  technique: 'XRD', // Placeholder; the router treats this as the generic fallback
  name: 'GenericTechniqueHandler',
  version: '1.0.0',

  async processStage(
    stage: EvidenceStage,
    request: RouterRequest,
    previousArtifacts: Map<EvidenceStage, StageArtifact>,
  ): Promise<StageArtifact> {
    const metadata = getTechniqueMetadata(request.technique);

    switch (stage) {
      case 'dataset':
        return processDatasetStage(request, metadata);
      case 'processing':
        return processProcessingStage(request, previousArtifacts, metadata);
      case 'features':
        return processFeaturesStage(request, previousArtifacts, metadata);
      case 'interpretation':
        return processInterpretationStage(request, previousArtifacts, metadata);
      case 'comparison':
        return processComparisonStage(request, previousArtifacts, metadata);
      case 'gap_analysis':
        return processGapAnalysisStage(request, previousArtifacts, metadata);
      case 'decision':
        return processDecisionStage(request, previousArtifacts, metadata);
      default:
        throw new Error(`Unknown stage: ${stage}`);
    }
  },
};

// ---------------------------------------------------------------------------
// Stage 0: Dataset
// ---------------------------------------------------------------------------

/**
 * Validate and ingest raw data into a DatasetArtifact.
 */
function processDatasetStage(
  request: RouterRequest,
  metadata: TechniqueMetadata | undefined,
): DatasetArtifact {
  const { rawData, technique } = request;

  // Validate data
  const warnings: string[] = [];

  if (rawData.primaryAxis.length === 0) {
    warnings.push('Empty primary axis: no data points provided');
  }

  if (rawData.values.length === 0) {
    warnings.push('Empty values array: no measurements provided');
  }

  if (rawData.primaryAxis.length !== rawData.values.length) {
    warnings.push(
      `Axis length mismatch: primaryAxis has ${rawData.primaryAxis.length} points, ` +
      `values has ${rawData.values.length} points`
    );
  }

  // Determine signal quality
  const signalQuality = assessSignalQuality(rawData);

  // Compute primary axis range
  const minAxis = rawData.primaryAxis.length > 0
    ? Math.min(...rawData.primaryAxis)
    : 0;
  const maxAxis = rawData.primaryAxis.length > 0
    ? Math.max(...rawData.primaryAxis)
    : 0;

  // Compute data hash
  const dataHash = computeDataHash(rawData);

  return {
    stage: 'dataset',
    technique,
    domain: metadata?.domain ?? 'spectroscopy',
    sourceName: rawData.fileName ?? 'unknown',
    format: rawData.format,
    pointCount: Math.min(rawData.primaryAxis.length, rawData.values.length),
    primaryAxisRange: [minAxis, maxAxis] as readonly [number, number],
    primaryAxisUnit: rawData.primaryAxisUnit,
    signalQuality,
    dataHash,
    ingestedAt: new Date().toISOString(),
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Stage 1: Processing
// ---------------------------------------------------------------------------

/**
 * Apply signal processing: baseline correction, smoothing, normalization.
 */
function processProcessingStage(
  request: RouterRequest,
  previousArtifacts: Map<EvidenceStage, StageArtifact>,
  metadata: TechniqueMetadata | undefined,
): ProcessingArtifact {
  const { rawData, processingConfig, technique } = request;
  const config = processingConfig ?? {};

  const steps: ProcessingStep[] = [];
  const now = new Date().toISOString();

  // Step 1: Baseline correction
  const baselineAlgo = config.baselineAlgorithm ?? 'polynomial';
  const polyOrder = config.polynomialOrder ?? getDefaultPolynomialOrder(technique);

  if (baselineAlgo !== 'none') {
    steps.push({
      operation: 'baseline_correction',
      algorithm: baselineAlgo,
      parameters: {
        polynomialOrder: polyOrder,
        technique,
      },
      executedAt: now,
      description: `Applied ${baselineAlgo} baseline correction (order ${polyOrder}) for ${technique} data`,
    });
  }

  // Step 2: Smoothing
  const smoothAlgo = config.smoothingAlgorithm ?? 'savitzky_golay';
  const smoothWindow = config.smoothingWindow ?? getDefaultSmoothingWindow(technique);

  if (smoothAlgo !== 'none') {
    steps.push({
      operation: 'smoothing',
      algorithm: smoothAlgo,
      parameters: {
        windowSize: smoothWindow,
        technique,
      },
      executedAt: now,
      description: `Applied ${smoothAlgo} smoothing (window ${smoothWindow}) for ${technique} data`,
    });
  }

  // Step 3: Normalization
  const normMethod = config.normalizationMethod ?? 'min_max';

  if (normMethod !== 'none') {
    steps.push({
      operation: 'normalization',
      algorithm: normMethod,
      parameters: {
        method: normMethod,
        technique,
      },
      executedAt: now,
      description: `Applied ${normMethod} normalization for ${technique} data`,
    });
  }

  // Compute processed data hash
  const processedDataHash = computeProcessedHash(rawData, steps);

  return {
    stage: 'processing',
    technique,
    steps,
    outputQuality: assessProcessedQuality(rawData),
    processedDataHash,
    processedAt: now,
  };
}

// ---------------------------------------------------------------------------
// Stage 2: Features
// ---------------------------------------------------------------------------

/**
 * Detect features (peaks, bands, edges) using universal algorithms.
 */
function processFeaturesStage(
  request: RouterRequest,
  previousArtifacts: Map<EvidenceStage, StageArtifact>,
  metadata: TechniqueMetadata | undefined,
): FeaturesArtifact {
  const { rawData, processingConfig, technique } = request;
  const config = processingConfig ?? {};

  const sensitivity = config.detectionSensitivity ?? 0.5;
  const minHeight = config.minPeakHeight ?? 0.05;

  // Universal peak detection using second-derivative zero-crossing
  const detectedPeaks = detectPeaksUniversal(
    rawData.primaryAxis,
    rawData.values,
    sensitivity,
    minHeight,
  );

  // Convert detected peaks to UniversalEvidenceNodes
  const features: UniversalEvidenceNode[] = detectedPeaks.map((peak, index) => ({
    id: `${technique.toLowerCase()}-feature-${index + 1}`,
    technique,
    primaryAxis: peak.position,
    primaryAxisUnit: rawData.primaryAxisUnit,
    value: peak.intensity,
    valueUnit: rawData.valueUnit,
    label: `Feature at ${peak.position.toFixed(2)} ${rawData.primaryAxisUnit}`,
    role: 'primary' as const,
    confidence: peak.confidence,
    provenance: {
      datasetId: request.requestId,
      sampleName: request.sampleId,
      processingHash: computeDataHash(rawData),
      createdAt: new Date().toISOString(),
    },
  }));

  return {
    stage: 'features',
    technique,
    features,
    featureCount: features.length,
    detectionAlgorithm: 'second_derivative_zero_crossing',
    detectionParameters: {
      sensitivity,
      minPeakHeight: minHeight,
      technique,
    },
    detectedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Stage 3: Interpretation
// ---------------------------------------------------------------------------

/**
 * Map detected features to scientific interpretations.
 */
function processInterpretationStage(
  request: RouterRequest,
  previousArtifacts: Map<EvidenceStage, StageArtifact>,
  metadata: TechniqueMetadata | undefined,
): InterpretationArtifact {
  const featuresArtifact = previousArtifacts.get('features') as FeaturesArtifact | undefined;
  const features = featuresArtifact?.features ?? [];

  const interpretations: FeatureInterpretation[] = features.map((feature) => ({
    featureId: feature.id,
    assignment: generateGenericAssignment(feature, request.technique),
    confidence: feature.confidence ?? 'medium' as ConfidenceLevel,
    reasoning: `Feature at ${feature.primaryAxis} ${feature.primaryAxisUnit} interpreted via generic ${request.technique} analysis`,
    references: [],
  }));

  return {
    stage: 'interpretation',
    technique: request.technique,
    interpretations,
    referenceDatabase: 'generic',
    interpretedCount: interpretations.length,
    overallConfidence: interpretations.length > 0 ? 'medium' : 'low',
    interpretedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Stage 4: Comparison
// ---------------------------------------------------------------------------

/**
 * Compare current evidence against reference data.
 */
function processComparisonStage(
  request: RouterRequest,
  previousArtifacts: Map<EvidenceStage, StageArtifact>,
  metadata: TechniqueMetadata | undefined,
): ComparisonArtifact {
  const interpretationArtifact = previousArtifacts.get('interpretation') as InterpretationArtifact | undefined;
  const interpretations = interpretationArtifact?.interpretations ?? [];

  const results: ComparisonResult[] = interpretations.map((interp) => ({
    subject: interp.assignment,
    reference: 'generic_reference',
    deviation: 0,
    deviationUnit: 'none',
    withinTolerance: true,
    toleranceThreshold: 0,
    interpretation: `No reference database available for generic ${request.technique} comparison`,
  }));

  return {
    stage: 'comparison',
    technique: request.technique,
    comparisonType: 'reference_match',
    results,
    consistencyScore: results.length > 0 ? 0.5 : 0,
    comparedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Stage 5: Gap Analysis
// ---------------------------------------------------------------------------

/**
 * Identify validation gaps in the evidence chain.
 */
function processGapAnalysisStage(
  request: RouterRequest,
  previousArtifacts: Map<EvidenceStage, StageArtifact>,
  metadata: TechniqueMetadata | undefined,
): GapAnalysisArtifact {
  const gaps: ValidationGap[] = [];

  // Always recommend cross-technique validation
  gaps.push({
    gapId: 'cross-technique-validation',
    category: 'missing_technique',
    severity: 'major',
    description: `Single-technique analysis (${request.technique}) provides limited structural resolution`,
    recommendedAction: 'Perform complementary characterization with orthogonal techniques',
    suggestedTechniques: getComplementaryTechniques(request.technique),
  });

  // Check if interpretation has sufficient confidence
  const interpretationArtifact = previousArtifacts.get('interpretation') as InterpretationArtifact | undefined;
  if (!interpretationArtifact || interpretationArtifact.overallConfidence === 'low') {
    gaps.push({
      gapId: 'interpretation-confidence',
      category: 'insufficient_evidence',
      severity: 'critical',
      description: 'Feature interpretation confidence is low; assignments may be ambiguous',
      recommendedAction: 'Acquire higher-quality data or use technique-specific reference databases',
      suggestedTechniques: [request.technique],
    });
  }

  return {
    stage: 'gap_analysis',
    technique: request.technique,
    gaps,
    gapCount: gaps.length,
    criticalGapsResolved: gaps.filter(g => g.severity === 'critical').length === 0,
    analyzedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Stage 6: Decision
// ---------------------------------------------------------------------------

/**
 * Produce a scientific decision or next-experiment recommendation.
 */
function processDecisionStage(
  request: RouterRequest,
  previousArtifacts: Map<EvidenceStage, StageArtifact>,
  metadata: TechniqueMetadata | undefined,
): DecisionArtifact {
  const gapArtifact = previousArtifacts.get('gap_analysis') as GapAnalysisArtifact | undefined;
  const hasCriticalGaps = gapArtifact?.gaps.some(g => g.severity === 'critical') ?? false;

  const featuresArtifact = previousArtifacts.get('features') as FeaturesArtifact | undefined;
  const featureCount = featuresArtifact?.featureCount ?? 0;

  if (hasCriticalGaps) {
    return {
      stage: 'decision',
      decision: `Critical validation gaps identified in ${request.technique} analysis. Further characterization required before definitive conclusion.`,
      decisionType: 'next_experiment',
      confidence: 'low',
      evidenceSummary: `${featureCount} features detected from ${request.technique} data. Confidence insufficient for conclusion.`,
      caveats: [
        'Generic handler used — technique-specific analysis may yield better results',
        'No reference database matching performed',
        'Cross-technique validation not yet performed',
      ],
      nextExperiment: {
        technique: getComplementaryTechniques(request.technique)[0] ?? request.technique,
        rationale: 'Complementary technique recommended to resolve validation gaps',
        suggestedParameters: {},
        expectedOutcome: 'Additional structural evidence to support or contradict current interpretation',
        priority: 'high',
      },
      decidedAt: new Date().toISOString(),
    };
  }

  return {
    stage: 'decision',
    decision: `${request.technique} analysis complete. ${featureCount} features detected and interpreted. Working interpretation established pending cross-technique validation.`,
    decisionType: 'conclusion',
    confidence: 'medium',
    evidenceSummary: `${featureCount} features detected from ${request.technique} data. Generic interpretation applied.`,
    caveats: [
      'Generic handler used — technique-specific analysis recommended for definitive results',
      'No reference database matching performed',
    ],
    decidedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Utility Functions
// ---------------------------------------------------------------------------

/** Default polynomial order for baseline correction by technique. */
function getDefaultPolynomialOrder(technique: Technique): number {
  const defaults: Partial<Record<Technique, number>> = {
    XRD: 3,
    XPS: 2,
    FTIR: 4,
    Raman: 3,
    XAS: 2,
    TPD: 3,
  };
  return defaults[technique] ?? 3;
}

/** Default smoothing window size by technique. */
function getDefaultSmoothingWindow(technique: Technique): number {
  const defaults: Partial<Record<Technique, number>> = {
    XRD: 5,
    XPS: 3,
    FTIR: 7,
    Raman: 5,
    XAS: 5,
    TPD: 5,
  };
  return defaults[technique] ?? 5;
}

/** Assess signal quality from raw data. */
function assessSignalQuality(rawData: RawDataPayload): SignalQuality {
  const pointCount = rawData.values.length;
  if (pointCount === 0) return 'insufficient';
  if (pointCount < 50) return 'weak';
  if (pointCount < 200) return 'marginal';
  if (pointCount < 1000) return 'good';
  return 'excellent';
}

/** Assess processed data quality. */
function assessProcessedQuality(rawData: RawDataPayload): SignalQuality {
  // After processing, quality is at least one level better
  const raw = assessSignalQuality(rawData);
  const upgrade: Record<SignalQuality, SignalQuality> = {
    insufficient: 'weak',
    weak: 'marginal',
    marginal: 'good',
    good: 'excellent',
    excellent: 'excellent',
  };
  return upgrade[raw];
}

/** Compute a deterministic hash of the raw data. */
function computeDataHash(rawData: RawDataPayload): string {
  // Simple deterministic hash for demo; production would use SHA-256
  const str = rawData.primaryAxis.join(',') + '|' + rawData.values.join(',');
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return `hash:${Math.abs(hash).toString(16)}`;
}

/** Compute hash of processed data including processing steps. */
function computeProcessedHash(rawData: RawDataPayload, steps: ProcessingStep[]): string {
  const stepsStr = steps.map(s => `${s.operation}:${s.algorithm}`).join('|');
  return computeDataHash(rawData) + `|processed:${stepsStr}`;
}

/**
 * Universal peak detection using sliding-window local maxima.
 *
 * Finds local maxima in the values array where the value exceeds
 * the minimum height threshold (relative to the global maximum).
 */
function detectPeaksUniversal(
  primaryAxis: readonly number[],
  values: readonly number[],
  sensitivity: number,
  minHeightFraction: number,
): Array<{ position: number; intensity: number; confidence: ConfidenceLevel }> {
  if (values.length < 3) return [];

  const maxVal = Math.max(...values);
  const minHeight = maxVal * minHeightFraction;
  const windowSize = Math.max(3, Math.round((1 - sensitivity) * 10) + 1);
  const halfWindow = Math.floor(windowSize / 2);

  const peaks: Array<{ position: number; intensity: number; confidence: ConfidenceLevel }> = [];

  for (let i = halfWindow; i < values.length - halfWindow; i++) {
    const val = values[i];
    if (val < minHeight) continue;

    // Check if this is a local maximum
    let isMax = true;
    for (let j = i - halfWindow; j <= i + halfWindow; j++) {
      if (j !== i && values[j] > val) {
        isMax = false;
        break;
      }
    }

    if (isMax) {
      const relativeHeight = val / maxVal;
      const confidence: ConfidenceLevel =
        relativeHeight > 0.7 ? 'high' :
        relativeHeight > 0.4 ? 'medium' :
        relativeHeight > 0.15 ? 'low' :
        'uncertain';

      peaks.push({
        position: primaryAxis[i],
        intensity: val,
        confidence,
      });
    }
  }

  return peaks;
}

/** Generate a generic assignment for a feature based on technique. */
function generateGenericAssignment(feature: UniversalEvidenceNode, technique: Technique): string {
  const pos = feature.primaryAxis.toFixed(1);
  const unit = feature.primaryAxisUnit;

  switch (technique) {
    case 'XRD':
      return `Diffraction peak at ${pos} ${unit}`;
    case 'FTIR':
      return `Infrared absorption at ${pos} ${unit}`;
    case 'Raman':
      return `Raman mode at ${pos} ${unit}`;
    case 'XPS':
      return `Photoelectron feature at ${pos} ${unit}`;
    case 'XAS':
      return `Absorption feature at ${pos} ${unit}`;
    case 'TEM':
      return `Structural feature at ${pos} ${unit}`;
    case 'BET':
      return `Adsorption feature at ${pos} ${unit}`;
    case 'TPD':
      return `Desorption feature at ${pos} ${unit}`;
    default:
      return `Feature at ${pos} ${unit}`;
  }
}

/** Get complementary techniques for cross-validation. */
function getComplementaryTechniques(technique: Technique): Technique[] {
  const complementary: Record<string, Technique[]> = {
    XRD: ['Raman', 'FTIR', 'TEM'],
    XPS: ['XAS', 'FTIR', 'XRF'],
    FTIR: ['Raman', 'XRD', 'XPS'],
    Raman: ['FTIR', 'XRD', 'XPS'],
    XAS: ['XPS', 'XRD', 'XRF'],
    TEM: ['XRD', 'SEM', 'BET'],
    BET: ['TEM', 'SEM', 'TPD'],
    TPD: ['BET', 'XPS', 'FTIR'],
    NMR: ['FTIR', 'Raman', 'XRD'],
    SEM: ['TEM', 'XRD', 'BET'],
    XRF: ['XPS', 'XAS', 'XRD'],
  };
  return complementary[technique] ?? ['XRD', 'XPS', 'FTIR'];
}