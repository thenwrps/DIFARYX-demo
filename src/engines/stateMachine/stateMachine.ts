/**
 * Universal Workflow State Machine
 *
 * Thread-safe state machine that enforces valid state transitions
 * for the 7-stage scientific evidence workflow. Every transition
 * is logged to the Approval Ledger.
 *
 * @module stateMachine/stateMachine
 */

import type { Technique } from '../../types/universalTechnique';
import type { EvidenceStage } from '../../types/universalResearchEvidence';

import type {
  WorkflowState,
  StateSnapshot,
} from './types';

import { VALID_TRANSITIONS } from './types';
import { ApprovalLedger, defaultLedger } from './ledger';

// ---------------------------------------------------------------------------
// State Machine Implementation
// ---------------------------------------------------------------------------

/**
 * Universal Workflow State Machine.
 *
 * Enforces valid state transitions and records every transition
 * in the Approval Ledger. Provides a complete audit trail of
 * the workflow lifecycle.
 *
 * @example
 * ```ts
 * const sm = new WorkflowStateMachine('req-001', 'XRD');
 * sm.transition('routing');        // idle → routing
 * sm.transition('stage_executing'); // routing → stage_executing
 * sm.transition('stage_complete');  // stage_executing → stage_complete
 * sm.transition('completed');       // stage_complete → completed
 * ```
 */
export class WorkflowStateMachine {
  private _state: WorkflowState = 'idle';
  private _currentStage: EvidenceStage | undefined;
  private _history: StateSnapshot[] = [];
  private _requestId: string;
  private _technique: Technique;
  private _ledger: ApprovalLedger;

  constructor(
    requestId: string,
    technique: Technique,
    ledger?: ApprovalLedger,
  ) {
    this._requestId = requestId;
    this._technique = technique;
    this._ledger = ledger ?? defaultLedger;

    // Record initial state
    this.recordSnapshot();
  }

  // -------------------------------------------------------------------------
  // State Access
  // -------------------------------------------------------------------------

  /** Current workflow state. */
  get state(): WorkflowState {
    return this._state;
  }

  /** Current stage being executed (if applicable). */
  get currentStage(): EvidenceStage | undefined {
    return this._currentStage;
  }

  /** Request ID. */
  get requestId(): string {
    return this._requestId;
  }

  /** Technique. */
  get technique(): Technique {
    return this._technique;
  }

  /** Full state history. */
  get history(): readonly StateSnapshot[] {
    return [...this._history];
  }

  /** Whether the workflow is in a terminal state. */
  get isTerminal(): boolean {
    return this._state === 'completed' || this._state === 'error';
  }

  /** Whether the workflow is awaiting approval. */
  get isAwaitingApproval(): boolean {
    return this._state === 'awaiting_approval';
  }

  // -------------------------------------------------------------------------
  // State Transitions
  // -------------------------------------------------------------------------

  /**
   * Attempt a state transition.
   *
   * @param targetState - The desired target state.
   * @param stage - The current stage (required for stage_executing/stage_complete).
   * @param context - Additional context for the snapshot.
   * @throws Error if the transition is invalid.
   * @returns The new state snapshot.
   */
  transition(
    targetState: WorkflowState,
    stage?: EvidenceStage,
    context?: Record<string, unknown>,
  ): StateSnapshot {
    const validTargets = VALID_TRANSITIONS[this._state];

    if (!validTargets.includes(targetState)) {
      throw new Error(
        `Invalid state transition: ${this._state} → ${targetState}. ` +
        `Valid targets: [${validTargets.join(', ')}]`
      );
    }

    // Validate stage presence for stage-specific states
    if (
      (targetState === 'stage_executing' || targetState === 'stage_complete') &&
      !stage
    ) {
      throw new Error(
        `Stage is required for transition to '${targetState}'`
      );
    }

    const previousState = this._state;

    // Update state
    this._state = targetState;
    if (stage) {
      this._currentStage = stage;
    }

    // Record in ledger
    this._ledger.recordStateTransition({
      requestId: this._requestId,
      technique: this._technique,
      fromState: previousState,
      toState: targetState,
      stage: stage ?? this._currentStage,
      metadata: context,
    });

    // Record snapshot
    return this.recordSnapshot(context);
  }

  /**
   * Transition to awaiting approval for a stage.
   */
  awaitApproval(stage: EvidenceStage): StateSnapshot {
    return this.transition('awaiting_approval', stage);
  }

  /**
   * Approve the current stage and proceed.
   */
  approve(context?: Record<string, unknown>): StateSnapshot {
    const stage = this._currentStage;
    if (!stage) {
      throw new Error('Cannot approve: no current stage');
    }

    this._ledger.recordApproval({
      requestId: this._requestId,
      technique: this._technique,
      stage,
      approvedBy: context?.approvedBy as string | undefined,
    });

    return this.transition('approved', stage, context);
  }

  /**
   * Reject the current stage.
   */
  reject(reason: string, context?: Record<string, unknown>): StateSnapshot {
    const stage = this._currentStage;
    if (!stage) {
      throw new Error('Cannot reject: no current stage');
    }

    this._ledger.recordRejection({
      requestId: this._requestId,
      technique: this._technique,
      stage,
      reason,
      rejectedBy: context?.rejectedBy as string | undefined,
    });

    return this.transition('rejected', stage, { reason, ...context });
  }

  /**
   * Start routing (idle → routing).
   */
  startRouting(context?: Record<string, unknown>): StateSnapshot {
    return this.transition('routing', undefined, context);
  }

  /**
   * Start executing a stage (routing|stage_complete|approved → stage_executing).
   */
  startStage(stage: EvidenceStage, context?: Record<string, unknown>): StateSnapshot {
    return this.transition('stage_executing', stage, context);
  }

  /**
   * Complete a stage (stage_executing → stage_complete).
   */
  completeStage(stage: EvidenceStage, context?: Record<string, unknown>): StateSnapshot {
    return this.transition('stage_complete', stage, context);
  }

  /**
   * Complete the entire workflow (stage_complete|approved → completed).
   */
  complete(context?: Record<string, unknown>): StateSnapshot {
    return this.transition('completed', undefined, context);
  }

  /**
   * Transition to error state from any state.
   */
  error(errorMessage: string, context?: Record<string, unknown>): StateSnapshot {
    const stage = this._currentStage;

    this._ledger.recordError({
      requestId: this._requestId,
      technique: this._technique,
      stage: stage ?? ('unknown' as EvidenceStage),
      error: errorMessage,
    });

    // Error transition is always valid (handled specially)
    const previousState = this._state;
    this._state = 'error';

    this._ledger.recordStateTransition({
      requestId: this._requestId,
      technique: this._technique,
      fromState: previousState,
      toState: 'error',
      stage,
      metadata: { error: errorMessage, ...context },
    });

    return this.recordSnapshot({ error: errorMessage, ...context });
  }

  /**
   * Reset the state machine to idle.
   */
  reset(): StateSnapshot {
    const previousState = this._state;
    this._state = 'idle';
    this._currentStage = undefined;

    this._ledger.recordStateTransition({
      requestId: this._requestId,
      technique: this._technique,
      fromState: previousState,
      toState: 'idle',
    });

    return this.recordSnapshot();
  }

  // -------------------------------------------------------------------------
  // Querying
  // -------------------------------------------------------------------------

  /**
   * Get the ledger summary for this workflow.
   */
  getLedgerSummary() {
    return this._ledger.getSummary(this._requestId);
  }

  /**
   * Get all ledger entries for this workflow.
   */
  getLedgerEntries() {
    return this._ledger.getEntriesForRequest(this._requestId);
  }

  /**
   * Get the number of state transitions.
   */
  get transitionCount(): number {
    return this._history.length - 1; // Subtract initial state
  }

  // -------------------------------------------------------------------------
  // Internal
  // -------------------------------------------------------------------------

  /**
   * Record a snapshot of the current state.
   */
  private recordSnapshot(context?: Record<string, unknown>): StateSnapshot {
    const snapshot: StateSnapshot = {
      state: this._state,
      requestId: this._requestId,
      technique: this._technique,
      currentStage: this._currentStage,
      timestamp: new Date().toISOString(),
      context,
    };
    this._history.push(snapshot);
    return snapshot;
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a new WorkflowStateMachine for a request.
 */
export function createStateMachine(
  requestId: string,
  technique: Technique,
  ledger?: ApprovalLedger,
): WorkflowStateMachine {
  return new WorkflowStateMachine(requestId, technique, ledger);
}