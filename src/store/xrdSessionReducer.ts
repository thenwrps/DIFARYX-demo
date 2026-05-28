import type {
  XrdWorkflowSession,
  XrdWorkflowEvent,
  XrdWorkflowRuntimeState,
} from '../types/xrdWorkflowSession';

/**
 * Validates whether a state transition from current status to next status is permitted.
 * Rules:
 * - idle -> processing (Valid)
 * - processing -> processing / completed / failed / idle (Valid)
 * - completed -> processing / idle (Valid)
 * - failed -> processing / idle (Valid)
 */
export function isValidTransition(
  current: XrdWorkflowRuntimeState['status'],
  next: XrdWorkflowRuntimeState['status'],
): boolean {
  if (current === next) return true;
  switch (current) {
    case 'idle':
      return next === 'processing';
    case 'processing':
      return next === 'completed' || next === 'failed' || next === 'idle';
    case 'completed':
    case 'failed':
      return next === 'processing' || next === 'idle';
    default:
      return false;
  }
}

/**
 * Reducer for managing canonical session state machine.
 * Enforces business logic and transactional integrity.
 */
export function xrdSessionReducer(
  state: XrdWorkflowSession,
  event: XrdWorkflowEvent,
): XrdWorkflowSession {
  const currentStatus = state.runtime.status;
  const now = new Date().toISOString();

  switch (event.type) {
    case 'START_PROCESSING': {
      const nextStatus: XrdWorkflowRuntimeState['status'] = 'processing';
      if (!isValidTransition(currentStatus, nextStatus)) {
        console.warn(
          `[XrdWorkflowSession Reducer] Blocked invalid status transition: ${currentStatus} -> ${nextStatus} via START_PROCESSING`,
        );
        return state;
      }

      return {
        ...state,
        updatedAt: now,
        runtime: {
          ...state.runtime,
          status: nextStatus,
          activeStage: event.payload.stage,
          startedAt: state.runtime.startedAt || now,
          errorMessage: undefined,
        },
      };
    }

    case 'UPDATE_STAGE': {
      const nextStatus: XrdWorkflowRuntimeState['status'] = 'processing';
      if (!isValidTransition(currentStatus, nextStatus)) {
        console.warn(
          `[XrdWorkflowSession Reducer] Blocked invalid status transition: ${currentStatus} -> ${nextStatus} via UPDATE_STAGE`,
        );
        return state;
      }

      return {
        ...state,
        updatedAt: now,
        runtime: {
          ...state.runtime,
          status: nextStatus,
          activeStage: event.payload.stage,
        },
      };
    }

    case 'COMPLETE_PROCESSING': {
      const nextStatus: XrdWorkflowRuntimeState['status'] = 'completed';
      if (!isValidTransition(currentStatus, nextStatus)) {
        console.warn(
          `[XrdWorkflowSession Reducer] Blocked invalid status transition: ${currentStatus} -> ${nextStatus} via COMPLETE_PROCESSING`,
        );
        return state;
      }

      return {
        ...state,
        updatedAt: now,
        runtime: {
          ...state.runtime,
          status: nextStatus,
          completedAt: event.payload?.completedAt || now,
          errorMessage: undefined,
        },
        publication: state.publication
          ? {
              ...state.publication,
              notebookReady: true,
              reportReady: true,
              agentReady: true,
            }
          : {
              published: false,
              notebookReady: true,
              reportReady: true,
              agentReady: true,
            },
      };
    }

    case 'FAIL_PROCESSING': {
      const nextStatus: XrdWorkflowRuntimeState['status'] = 'failed';
      if (!isValidTransition(currentStatus, nextStatus)) {
        console.warn(
          `[XrdWorkflowSession Reducer] Blocked invalid status transition: ${currentStatus} -> ${nextStatus} via FAIL_PROCESSING`,
        );
        return state;
      }

      return {
        ...state,
        updatedAt: now,
        runtime: {
          ...state.runtime,
          status: nextStatus,
          errorMessage: event.payload.errorMessage,
          completedAt: undefined,
        },
      };
    }

    case 'FORCE_RESET_SESSION': {
      // Enforce reset to idle
      const nextStatus: XrdWorkflowRuntimeState['status'] = 'idle';
      
      return {
        ...state,
        sessionId: event.payload.newSessionId,
        createdAt: now,
        updatedAt: now,
        runtime: {
          status: nextStatus,
          activeStage: undefined,
          startedAt: undefined,
          completedAt: undefined,
          errorMessage: undefined,
        },
        validation: {
          isValidated7E4: false,
          validationStatus: 'pending',
        },
        publication: {
          published: false,
          notebookReady: false,
          reportReady: false,
          agentReady: false,
        },
      };
    }

    case 'SET_VALIDATION': {
      return {
        ...state,
        updatedAt: now,
        validation: {
          ...state.validation,
          isValidated7E4: event.payload.isValidated7E4,
          validatedAt: event.payload.isValidated7E4 ? now : undefined,
          validationStatus: event.payload.isValidated7E4 ? 'validated' : 'pending',
        },
      };
    }

    case 'APPEND_SCIENTIFIC_EVIDENCE': {
      if (currentStatus !== 'processing') {
        console.warn(
          `[XrdWorkflowSession Reducer] Blocked APPEND_SCIENTIFIC_EVIDENCE: System is in '${currentStatus}' status, but must be in 'processing' status.`,
        );
        return state;
      }
      
      const { scientificData } = event.payload;
      const scientificEvidence = scientificData?.workflowScientificEvidence || scientificData;
      const detectedPeakCount = scientificData?.detectedPeakCount ?? 0;
      const fittedPeakCount = scientificData?.fittedPeakCount ?? 0;
      const snRatio = scientificData?.snRatio ?? 0;
      const baselineDeviation = scientificData?.baselineDeviation ?? 0;
      const peakResolution = scientificData?.peakResolution ?? null;

      return {
        ...state,
        updatedAt: now,
        processing: state.processing
          ? {
              ...state.processing,
              qualityMetrics: {
                detectedPeakCount,
                fittedPeakCount,
                snRatio,
                baselineDeviation,
                peakResolution,
              },
            }
          : {
              groupedParametersReceived: false,
              qualityMetrics: {
                detectedPeakCount,
                fittedPeakCount,
                snRatio,
                baselineDeviation,
                peakResolution,
              },
            },
        evidence: {
          ...state.evidence,
          scientificEvidence,
        },
      };
    }

    case 'APPEND_REFERENCE_MATCH': {
      if (currentStatus !== 'processing') {
        console.warn(
          `[XrdWorkflowSession Reducer] Blocked APPEND_REFERENCE_MATCH: System is in '${currentStatus}' status, but must be in 'processing' status.`,
        );
        return state;
      }

      const { referenceData, phaseSummary } = event.payload;
      const existingLimitations = state.scientificBoundaries.limitations || [];
      const newLimitations = referenceData?.limitations || [];
      const limitations = [...existingLimitations];
      for (const lim of newLimitations) {
        if (!limitations.includes(lim)) {
          limitations.push(lim);
        }
      }

      return {
        ...state,
        updatedAt: now,
        evidence: {
          ...state.evidence,
          referenceMatch: referenceData,
          phaseMatch: phaseSummary,
          limitations: referenceData?.limitations || [],
        },
        scientificBoundaries: {
          ...state.scientificBoundaries,
          candidateEvidenceOnly: true,
          limitations,
        },
      };
    }

    case 'SET_VALIDATION_GAPS': {
      if (currentStatus !== 'processing') {
        console.warn(
          `[XrdWorkflowSession Reducer] Blocked SET_VALIDATION_GAPS: System is in '${currentStatus}' status, but must be in 'processing' status.`,
        );
        return state;
      }

      const { gaps } = event.payload;

      return {
        ...state,
        updatedAt: now,
        evidence: {
          ...state.evidence,
          validationGaps: gaps,
        },
      };
    }

    case 'PUBLISH_SESSION': {
      if (!state.evidence) {
        console.warn('[XrdWorkflowSession Reducer] Cannot publish session: No evidence to snapshot.');
        return state;
      }

      return {
        ...state,
        updatedAt: now,
        publication: state.publication
          ? {
              ...state.publication,
              published: true,
              publishedAt: now,
            }
          : {
              published: true,
              publishedAt: now,
              notebookReady: true,
              reportReady: true,
              agentReady: true,
            },
        publishedSnapshot: {
          versionTag: event.payload.versionTag,
          publishedAt: now,
          evidenceSnapshot: JSON.parse(JSON.stringify(state.evidence)),
        },
      };
    }

    case 'REVERT_TO_PUBLISHED': {
      if (!state.publishedSnapshot) {
        console.warn('[XrdWorkflowSession Reducer] Blocked REVERT_TO_PUBLISHED: No published snapshot exists.');
        return state;
      }

      return {
        ...state,
        updatedAt: now,
        evidence: JSON.parse(JSON.stringify(state.publishedSnapshot.evidenceSnapshot)),
        runtime: {
          ...state.runtime,
          status: 'completed',
          errorMessage: undefined,
        },
      };
    }

    case 'CREATE_SESSION': {
      return {
        ...state,
        projectId: event.payload.projectId || 'guest-sandbox',
        userName: event.payload.userName || 'Scientific Researcher',
        userEmail: event.payload.userEmail || 'Not Connected',
        organization: event.payload.organization || 'Independent Research / Affiliated Institution',
        userRole: event.payload.userRole,
        updatedAt: now,
      };
    }

    case 'LOAD_SESSION': {
      return {
        ...state,
        ...event.payload,
        projectId: event.payload.projectId || 'guest-sandbox',
        updatedAt: now,
      };
    }

    case 'UPDATE_USER_CONTEXT': {
      return {
        ...state,
        userName: event.payload.userName !== undefined ? event.payload.userName : state.userName,
        userEmail: event.payload.userEmail !== undefined ? event.payload.userEmail : state.userEmail,
        organization: event.payload.organization !== undefined ? event.payload.organization : state.organization,
        userRole: event.payload.userRole !== undefined ? event.payload.userRole : state.userRole,
        updatedAt: now,
      };
    }

    default:
      return state;
  }
}
