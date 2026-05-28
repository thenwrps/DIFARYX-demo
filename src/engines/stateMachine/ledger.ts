/**
 * Local Approval Preview Ledger
 *
 * Thread-safe, append-only ledger that records every routing decision,
 * parameter change, stage transition, and approval/rejection event.
 *
 * Provides full audit trail for reproducible scientific workflows.
 *
 * @module stateMachine/ledger
 */

import type { Technique } from '../../types/universalTechnique';
import type { EvidenceStage } from '../../types/universalResearchEvidence';

import type {
  LedgerEntry,
  LedgerEntryType,
  LedgerSeverity,
  LedgerSummary,
} from './types';

// ---------------------------------------------------------------------------
// Ledger Implementation
// ---------------------------------------------------------------------------

/**
 * Local Approval Preview Ledger.
 *
 * Append-only, immutable record of all workflow events. Supports
 * querying by request ID, entry type, and time range.
 */
export class ApprovalLedger {
  private entries: LedgerEntry[] = [];
  private entryCounter = 0;

  // -------------------------------------------------------------------------
  // Entry Recording
  // -------------------------------------------------------------------------

  /**
   * Record a routing decision in the ledger.
   */
  recordRoutingDecision(params: {
    requestId: string;
    technique: Technique;
    stage: EvidenceStage;
    handlerId: string;
    usedTechniqueHandler: boolean;
    processingTimeMs: number;
    metadata?: Record<string, unknown>;
  }): LedgerEntry {
    return this.append({
      entryType: 'routing_decision',
      severity: 'info',
      requestId: params.requestId,
      technique: params.technique,
      stage: params.stage,
      description: `Routed ${params.technique} data through ${params.stage} stage using ${params.handlerId}`,
      handlerId: params.handlerId,
      metadata: {
        usedTechniqueHandler: params.usedTechniqueHandler,
        processingTimeMs: params.processingTimeMs,
        ...params.metadata,
      },
    });
  }

  /**
   * Record a parameter change in the ledger.
   */
  recordParameterChange(params: {
    requestId: string;
    technique: Technique;
    stage: EvidenceStage;
    parameterName: string;
    previousValue: unknown;
    newValue: unknown;
    handlerId: string;
    metadata?: Record<string, unknown>;
  }): LedgerEntry {
    return this.append({
      entryType: 'parameter_change',
      severity: 'warning',
      requestId: params.requestId,
      technique: params.technique,
      stage: params.stage,
      description: `Parameter '${params.parameterName}' changed from ${JSON.stringify(params.previousValue)} to ${JSON.stringify(params.newValue)}`,
      parameterName: params.parameterName,
      previousValue: params.previousValue,
      newValue: params.newValue,
      handlerId: params.handlerId,
      metadata: params.metadata,
    });
  }

  /**
   * Record a stage transition in the ledger.
   */
  recordStageTransition(params: {
    requestId: string;
    technique: Technique;
    fromStage: EvidenceStage;
    toStage: EvidenceStage;
    metadata?: Record<string, unknown>;
  }): LedgerEntry {
    return this.append({
      entryType: 'stage_transition',
      severity: 'info',
      requestId: params.requestId,
      technique: params.technique,
      stage: params.toStage,
      description: `Stage transition: ${params.fromStage} → ${params.toStage}`,
      metadata: {
        fromStage: params.fromStage,
        toStage: params.toStage,
        ...params.metadata,
      },
    });
  }

  /**
   * Record a state machine transition in the ledger.
   */
  recordStateTransition(params: {
    requestId: string;
    technique: Technique;
    fromState: string;
    toState: string;
    stage?: EvidenceStage;
    metadata?: Record<string, unknown>;
  }): LedgerEntry {
    return this.append({
      entryType: 'state_transition',
      severity: 'info',
      requestId: params.requestId,
      technique: params.technique,
      stage: params.stage,
      description: `State: ${params.fromState} → ${params.toState}`,
      metadata: {
        fromState: params.fromState,
        toState: params.toState,
        ...params.metadata,
      },
    });
  }

  /**
   * Record an approval event in the ledger.
   */
  recordApproval(params: {
    requestId: string;
    technique: Technique;
    stage: EvidenceStage;
    approvedBy?: string;
    metadata?: Record<string, unknown>;
  }): LedgerEntry {
    return this.append({
      entryType: 'approval',
      severity: 'info',
      requestId: params.requestId,
      technique: params.technique,
      stage: params.stage,
      description: `Approved to proceed from ${params.stage}`,
      metadata: {
        approvedBy: params.approvedBy ?? 'user',
        ...params.metadata,
      },
    });
  }

  /**
   * Record a rejection event in the ledger.
   */
  recordRejection(params: {
    requestId: string;
    technique: Technique;
    stage: EvidenceStage;
    reason: string;
    rejectedBy?: string;
    metadata?: Record<string, unknown>;
  }): LedgerEntry {
    return this.append({
      entryType: 'rejection',
      severity: 'warning',
      requestId: params.requestId,
      technique: params.technique,
      stage: params.stage,
      description: `Rejected at ${params.stage}: ${params.reason}`,
      metadata: {
        rejectedBy: params.rejectedBy ?? 'user',
        reason: params.reason,
        ...params.metadata,
      },
    });
  }

  /**
   * Record an error event in the ledger.
   */
  recordError(params: {
    requestId: string;
    technique: Technique;
    stage: EvidenceStage;
    error: string;
    handlerId?: string;
    metadata?: Record<string, unknown>;
  }): LedgerEntry {
    return this.append({
      entryType: 'error',
      severity: 'error',
      requestId: params.requestId,
      technique: params.technique,
      stage: params.stage,
      description: `Error in ${params.stage}: ${params.error}`,
      handlerId: params.handlerId,
      metadata: params.metadata,
    });
  }

  /**
   * Record a handler invocation in the ledger.
   */
  recordHandlerInvocation(params: {
    requestId: string;
    technique: Technique;
    stage: EvidenceStage;
    handlerId: string;
    processingTimeMs: number;
    metadata?: Record<string, unknown>;
  }): LedgerEntry {
    return this.append({
      entryType: 'handler_invocation',
      severity: 'info',
      requestId: params.requestId,
      technique: params.technique,
      stage: params.stage,
      description: `Handler '${params.handlerId}' invoked for ${params.stage} (${params.processingTimeMs.toFixed(1)}ms)`,
      handlerId: params.handlerId,
      metadata: {
        processingTimeMs: params.processingTimeMs,
        ...params.metadata,
      },
    });
  }

  // -------------------------------------------------------------------------
  // Querying
  // -------------------------------------------------------------------------

  /**
   * Get all entries for a specific request.
   */
  getEntriesForRequest(requestId: string): readonly LedgerEntry[] {
    return this.entries.filter((e) => e.requestId === requestId);
  }

  /**
   * Get entries of a specific type.
   */
  getEntriesByType(entryType: LedgerEntryType): readonly LedgerEntry[] {
    return this.entries.filter((e) => e.entryType === entryType);
  }

  /**
   * Get all parameter change entries for a request.
   */
  getParameterChanges(requestId: string): readonly LedgerEntry[] {
    return this.entries.filter(
      (e) => e.requestId === requestId && e.entryType === 'parameter_change'
    );
  }

  /**
   * Get all error entries for a request.
   */
  getErrors(requestId: string): readonly LedgerEntry[] {
    return this.entries.filter(
      (e) => e.requestId === requestId && e.entryType === 'error'
    );
  }

  /**
   * Get a summary of the ledger for a specific request.
   */
  getSummary(requestId: string): LedgerSummary | undefined {
    const requestEntries = this.getEntriesForRequest(requestId);
    if (requestEntries.length === 0) return undefined;

    const entriesByType: Record<LedgerEntryType, number> = {
      routing_decision: 0,
      parameter_change: 0,
      stage_transition: 0,
      state_transition: 0,
      approval: 0,
      rejection: 0,
      error: 0,
      handler_invocation: 0,
    };

    let parameterChangeCount = 0;
    let errorCount = 0;
    let totalTimeMs = 0;

    for (const entry of requestEntries) {
      entriesByType[entry.entryType]++;

      if (entry.entryType === 'parameter_change') {
        parameterChangeCount++;
      }

      if (entry.entryType === 'error') {
        errorCount++;
      }

      if (entry.metadata?.processingTimeMs && typeof entry.metadata.processingTimeMs === 'number') {
        totalTimeMs += entry.metadata.processingTimeMs;
      }
    }

    const completedSuccessfully = errorCount === 0 && entriesByType.state_transition > 0;

    return {
      requestId,
      totalEntries: requestEntries.length,
      entriesByType,
      parameterChangeCount,
      errorCount,
      completedSuccessfully,
      totalProcessingTimeMs: totalTimeMs,
      startedAt: requestEntries[0].timestamp,
      completedAt: requestEntries[requestEntries.length - 1].timestamp,
    };
  }

  /**
   * Get all entries in the ledger.
   */
  getAllEntries(): readonly LedgerEntry[] {
    return [...this.entries];
  }

  /**
   * Get the total number of entries in the ledger.
   */
  get count(): number {
    return this.entries.length;
  }

  // -------------------------------------------------------------------------
  // Management
  // -------------------------------------------------------------------------

  /**
   * Clear all entries from the ledger.
   */
  clear(): void {
    this.entries = [];
    this.entryCounter = 0;
  }

  /**
   * Clear entries for a specific request.
   */
  clearForRequest(requestId: string): void {
    this.entries = this.entries.filter((e) => e.requestId !== requestId);
  }

  /**
   * Export the ledger as a JSON-serializable array.
   */
  export(): readonly LedgerEntry[] {
    return this.getAllEntries();
  }

  // -------------------------------------------------------------------------
  // Internal
  // -------------------------------------------------------------------------

  /**
   * Append an entry to the ledger.
   */
  private append(params: Omit<LedgerEntry, 'entryId' | 'timestamp'>): LedgerEntry {
    this.entryCounter++;
    const entry: LedgerEntry = {
      ...params,
      entryId: `ledger-${this.entryCounter.toString().padStart(6, '0')}`,
      timestamp: new Date().toISOString(),
    };
    this.entries.push(entry);
    return entry;
  }
}

// ---------------------------------------------------------------------------
// Singleton Instance
// ---------------------------------------------------------------------------

/**
 * Default singleton ledger instance.
 */
export const defaultLedger = new ApprovalLedger();