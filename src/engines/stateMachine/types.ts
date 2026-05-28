/**
 * Universal State Machine & Approval Ledger — Type Definitions
 *
 * Defines types for the thread-safe state machine that tracks every
 * routing decision and parameter change in the Local Approval Preview Ledger.
 *
 * @module stateMachine/types
 */

import type { Technique } from '../../types/universalTechnique';
import type { EvidenceStage } from '../../types/universalResearchEvidence';

// ---------------------------------------------------------------------------
// State Machine States
// ---------------------------------------------------------------------------

/**
 * Valid states for a workflow execution.
 */
export type WorkflowState =
  | 'idle'
  | 'routing'
  | 'stage_executing'
  | 'stage_complete'
  | 'awaiting_approval'
  | 'approved'
  | 'rejected'
  | 'error'
  | 'completed';

/**
 * Valid transitions between workflow states.
 */
export const VALID_TRANSITIONS: Record<WorkflowState, readonly WorkflowState[]> = {
  idle: ['routing'],
  routing: ['stage_executing', 'error'],
  stage_executing: ['stage_complete', 'awaiting_approval', 'error'],
  stage_complete: ['stage_executing', 'completed', 'awaiting_approval'],
  awaiting_approval: ['approved', 'rejected'],
  approved: ['stage_executing', 'completed'],
  rejected: ['idle', 'awaiting_approval'],
  error: ['idle', 'routing'],
  completed: ['idle'],
} as const;

// ---------------------------------------------------------------------------
// State Machine Entry
// ---------------------------------------------------------------------------

/**
 * A snapshot of the state machine at a point in time.
 */
export interface StateSnapshot {
  /** Current workflow state. */
  readonly state: WorkflowState;

  /** Request ID being processed. */
  readonly requestId: string;

  /** Technique being analyzed. */
  readonly technique: Technique;

  /** Current stage (if in stage_executing or stage_complete). */
  readonly currentStage?: EvidenceStage;

  /** Timestamp of this snapshot. */
  readonly timestamp: string;

  /** Additional context. */
  readonly context?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Ledger Entry Types
// ---------------------------------------------------------------------------

/**
 * Types of ledger entries.
 */
export type LedgerEntryType =
  | 'routing_decision'
  | 'parameter_change'
  | 'stage_transition'
  | 'state_transition'
  | 'approval'
  | 'rejection'
  | 'error'
  | 'handler_invocation';

/**
 * Severity of a ledger entry.
 */
export type LedgerSeverity = 'info' | 'warning' | 'error' | 'critical';

/**
 * A single entry in the Local Approval Preview Ledger.
 *
 * Every routing decision, parameter change, and state transition
 * is recorded as an immutable ledger entry.
 */
export interface LedgerEntry {
  /** Unique entry identifier. */
  readonly entryId: string;

  /** Type of ledger entry. */
  readonly entryType: LedgerEntryType;

  /** Severity level. */
  readonly severity: LedgerSeverity;

  /** Request ID this entry relates to. */
  readonly requestId: string;

  /** Technique being analyzed. */
  readonly technique: Technique;

  /** Stage this entry relates to (if applicable). */
  readonly stage?: EvidenceStage;

  /** Human-readable description. */
  readonly description: string;

  /** Parameter name (for parameter_change entries). */
  readonly parameterName?: string;

  /** Previous value (for parameter_change entries). */
  readonly previousValue?: unknown;

  /** New value (for parameter_change entries). */
  readonly newValue?: unknown;

  /** Handler that generated this entry. */
  readonly handlerId?: string;

  /** Additional structured data. */
  readonly metadata?: Record<string, unknown>;

  /** ISO 8601 timestamp. */
  readonly timestamp: string;
}

/**
 * Summary of a ledger for a single request.
 */
export interface LedgerSummary {
  /** Request ID. */
  readonly requestId: string;

  /** Total number of entries. */
  readonly totalEntries: number;

  /** Entries grouped by type. */
  readonly entriesByType: Record<LedgerEntryType, number>;

  /** Number of parameter changes. */
  readonly parameterChangeCount: number;

  /** Number of errors. */
  readonly errorCount: number;

  /** Whether the workflow completed successfully. */
  readonly completedSuccessfully: boolean;

  /** Total processing time across all stages (ms). */
  readonly totalProcessingTimeMs: number;

  /** ISO 8601 timestamp of first entry. */
  readonly startedAt: string;

  /** ISO 8601 timestamp of last entry. */
  readonly completedAt: string;
}