/**
 * Universal State Machine — Barrel Export
 *
 * Single import point for the workflow state machine and approval ledger.
 *
 * @example
 * ```ts
 * import { WorkflowStateMachine, ApprovalLedger, defaultLedger } from '@/engines/stateMachine';
 * import type { WorkflowState, LedgerEntry } from '@/engines/stateMachine';
 * ```
 *
 * @module stateMachine
 */

// ---------------------------------------------------------------------------
// State Machine
// ---------------------------------------------------------------------------
export { WorkflowStateMachine, createStateMachine } from './stateMachine';
export type { WorkflowState, StateSnapshot } from './types';

// ---------------------------------------------------------------------------
// Ledger
// ---------------------------------------------------------------------------
export { ApprovalLedger, defaultLedger } from './ledger';
export type {
  LedgerEntry,
  LedgerEntryType,
  LedgerSeverity,
  LedgerSummary,
} from './types';