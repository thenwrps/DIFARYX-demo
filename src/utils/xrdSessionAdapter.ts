import type {
  XrdWorkflowSession,
  XrdWorkflowRuntimeState,
  XrdWorkflowDatasetContext,
  XrdWorkflowProcessingState,
  XrdWorkflowEvidenceState,
  XrdWorkflowValidationState,
  XrdWorkflowPublicationState,
  XrdWorkflowScientificBoundaries,
  XrdWorkflowContractMetadata,
} from '../types/xrdWorkflowSession';
import type { XRDDatasetContext } from '../types/xrdDatasetContext';
import type { XRDBackendEvidenceRecord } from '../data/xrdBackendEvidence';

export interface BuildXrdSessionParams {
  sessionId?: string;
  projectId?: string;
  uploadedRunId?: string;
  fileName?: string;
  isProcessing?: boolean;
  activeStage?: string | null;
  isValidated7E4?: boolean;
  errorMessage?: string;
  datasetContext?: XRDDatasetContext | null;
  evidenceRecord?: XRDBackendEvidenceRecord | null;
}

/**
 * Maps legacy active stage strings to the new XrdWorkflowRuntimeState stage enums.
 */
function mapActiveStage(stage?: string | null): XrdWorkflowRuntimeState['activeStage'] {
  if (!stage) return undefined;
  switch (stage) {
    case 'baseline':
      return 'baseline';
    case 'smooth':
      return 'smoothing';
    case 'peak_detect':
      return 'peak_detection';
    case 'fit_peaks':
      return 'fitting';
    case 'match_ref':
      return 'reference_matching';
    case 'boundary':
      return 'handoff';
    default:
      return undefined;
  }
}

/**
 * Synthesizes a Canonical Session Schema (XrdWorkflowSession) from legacy XRD contexts and evidence.
 * Acts as a shadow layer / migration bridge without mutating any existing operational behavior.
 */
export function buildXrdWorkflowSession(params: BuildXrdSessionParams): XrdWorkflowSession {
  const {
    sessionId,
    projectId,
    uploadedRunId,
    fileName,
    isProcessing = false,
    activeStage,
    isValidated7E4 = false,
    errorMessage,
    datasetContext: legacyDatasetContext,
    evidenceRecord,
  } = params;

  // 1. Resolve session ID and timestamps
  const resolvedSessionId =
    sessionId ||
    evidenceRecord?.xrdWorkflowHandoffState?.handoffId ||
    uploadedRunId ||
    fileName ||
    `xrd-session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  const createdAt =
    evidenceRecord?.timestamp ||
    evidenceRecord?.xrdWorkflowHandoffState?.createdAt ||
    new Date().toISOString();
  
  const updatedAt = new Date().toISOString();

  // 2. Map Runtime State
  let status: XrdWorkflowRuntimeState['status'] = 'idle';
  if (errorMessage) {
    status = 'failed';
  } else if (isProcessing) {
    status = 'processing';
  } else if (evidenceRecord) {
    status = 'completed';
  }

  const runtime: XrdWorkflowRuntimeState = {
    status,
    activeStage: mapActiveStage(activeStage),
    startedAt: evidenceRecord?.xrdWorkflowHandoffState?.createdAt || evidenceRecord?.timestamp || undefined,
    completedAt: status === 'completed' ? (evidenceRecord?.timestamp || updatedAt) : undefined,
    errorMessage,
  };

  // 3. Map Dataset Context
  const contextSource = legacyDatasetContext || evidenceRecord?.datasetContextEcho || evidenceRecord?.xrdWorkflowHandoffState?.datasetContextEcho;
  let datasetContext: XrdWorkflowDatasetContext | undefined;

  if (contextSource) {
    datasetContext = {
      referenceSource:
        legacyDatasetContext?.referenceSource ||
        evidenceRecord?.datasetContextEcho?.reference_source ||
        evidenceRecord?.xrdWorkflowHandoffState?.datasetContextEcho?.reference_source ||
        undefined,
      referenceSetId:
        legacyDatasetContext?.referenceSetId ||
        evidenceRecord?.datasetContextEcho?.reference_set_id ||
        evidenceRecord?.xrdWorkflowHandoffState?.datasetContextEcho?.reference_set_id ||
        undefined,
      candidatePhaseIds:
        legacyDatasetContext?.candidatePhaseIds ||
        evidenceRecord?.datasetContextEcho?.candidate_phase_ids ||
        evidenceRecord?.xrdWorkflowHandoffState?.datasetContextEcho?.candidate_phase_ids ||
        undefined,
      matchMode:
        evidenceRecord?.processingProvenance?.processing_mode ||
        legacyDatasetContext?.identityConfidence ||
        undefined,
      localReferenceEnabled:
        evidenceRecord?.processingProvenance?.local_reference_enabled ??
        evidenceRecord?.processingProvenance?.received_local_reference ??
        undefined,
      parameterContractVersion:
        evidenceRecord?.processingProvenance?.parameter_contract_version ||
        undefined,
    };
  }

  // 4. Map Processing State
  let processing: XrdWorkflowProcessingState | undefined;
  if (evidenceRecord || legacyDatasetContext) {
    processing = {
      provenance: evidenceRecord?.processingProvenance || undefined,
      groupedParametersReceived: evidenceRecord?.processingProvenance?.received_grouped_parameters || false,
      processingMode: evidenceRecord?.processingProvenance?.processing_mode || undefined,
      qualityMetrics: evidenceRecord
        ? {
            detectedPeakCount: evidenceRecord.detectedPeakCount ?? 0,
            fittedPeakCount: evidenceRecord.fittedPeakCount ?? 0,
            snRatio: evidenceRecord.snRatio ?? 0,
            baselineDeviation: evidenceRecord.baselineDeviation ?? 0,
            peakResolution: evidenceRecord.peakResolution ?? null,
          }
        : undefined,
    };
  }

  // 5. Map Evidence State
  let evidence: XrdWorkflowEvidenceState | undefined;
  if (evidenceRecord) {
    const validationGaps: string[] = [];
    if (evidenceRecord.xrdWorkflowHandoffState?.validationGaps) {
      validationGaps.push(...evidenceRecord.xrdWorkflowHandoffState.validationGaps);
    } else {
      if (evidenceRecord.workflowScientificEvidence?.validationGaps) {
        validationGaps.push(...evidenceRecord.workflowScientificEvidence.validationGaps);
      }
      if (evidenceRecord.workflowReferenceMatchEvidence?.limitations) {
        validationGaps.push(...evidenceRecord.workflowReferenceMatchEvidence.limitations);
      }
      if (evidenceRecord.isPhaseMatched || evidenceRecord.workflowReferenceMatchEvidence) {
        const guardrails = [
          'This is not chemical identity confirmation.',
          'This is not phase purity confirmation.',
        ];
        for (const guardrail of guardrails) {
          if (!validationGaps.includes(guardrail)) {
            validationGaps.push(guardrail);
          }
        }
      }
    }

    evidence = {
      scientificEvidence: evidenceRecord.workflowScientificEvidence,
      referenceMatch: evidenceRecord.workflowReferenceMatchEvidence,
      phaseMatch: {
        isPhaseMatched: evidenceRecord.isPhaseMatched ?? false,
        primaryPhase: evidenceRecord.primaryPhase ?? null,
        matchedPeakCount: evidenceRecord.matchedPeakCount ?? 0,
        phaseSummary: evidenceRecord.phaseSummary ?? null,
      },
      validationGaps,
      limitations: evidenceRecord.workflowReferenceMatchEvidence?.limitations || [],
    };
  }

  // 6. Map Validation State
  const validation: XrdWorkflowValidationState = {
    isValidated7E4,
    validatedAt: isValidated7E4 ? (evidenceRecord?.timestamp || updatedAt) : undefined,
    approvedLocalReferenceId: undefined,
    validationStatus: isValidated7E4 ? 'validated' : 'pending',
  };

  // 7. Map Publication State
  const publication: XrdWorkflowPublicationState = {
    published: false,
    publishedAt: undefined,
    notebookReady: !!evidenceRecord,
    reportReady: !!evidenceRecord,
    agentReady: !!evidenceRecord,
  };

  // 8. Map Scientific Boundaries
  const boundaryLimitations = [
    'This is not chemical identity confirmation.',
    'This is not phase purity confirmation.',
  ];

  if (evidenceRecord?.workflowReferenceMatchEvidence?.limitations) {
    for (const limitation of evidenceRecord.workflowReferenceMatchEvidence.limitations) {
      if (!boundaryLimitations.includes(limitation)) {
        boundaryLimitations.push(limitation);
      }
    }
  }

  const scientificBoundaries: XrdWorkflowScientificBoundaries = {
    chemicalIdentityConfirmed: false,
    phasePurityConfirmed: false,
    candidateEvidenceOnly: true,
    requiresCompositionSensitiveEvidence: true,
    limitations: boundaryLimitations,
  };

  // 9. Map Contract Metadata
  const contract: XrdWorkflowContractMetadata = {
    schemaVersion: 'x7a',
    source: evidenceRecord ? 'legacy' : 'session',
    migratedFromLegacy: !!evidenceRecord,
  };

  return {
    sessionId: resolvedSessionId,
    projectId: projectId || evidenceRecord?.projectId,
    uploadedRunId: uploadedRunId || evidenceRecord?.uploadedRunId,
    fileName: fileName || evidenceRecord?.fileName,
    createdAt,
    updatedAt,
    runtime,
    datasetContext,
    processing,
    evidence,
    validation,
    publication,
    scientificBoundaries,
    contract,
    xrdWorkflowHandoffState: evidenceRecord?.xrdWorkflowHandoffState,
  };
}
