/**
 * XRD Backend Evidence Persistence
 *
 * Stores the normalised result returned by the Python XRD backend so that
 * downstream surfaces – Agent Mode, Notebook, and Report – can consume it
 * without re-invoking the backend.
 *
 * Storage key convention:
 *   difaryx-local:xrd-backend-evidence
 *
 * Each record is keyed by (projectId, uploadedRunId | fileName) so that
 * multiple datasets can coexist. Only compact metadata is persisted to
 * stay well within localStorage limits.
 */

import type { XRDNormalizedResult } from '../types/xrdBackend';

// ── Storage key ─────────────────────────────────────────────────────

const XRD_BACKEND_EVIDENCE_KEY = 'difaryx-local:xrd-backend-evidence';

// ── Persisted shape ─────────────────────────────────────────────────

export interface XRDBackendEvidenceRecord {
  /** Project the evidence belongs to (or "__unassigned__" for quick-analysis). */
  projectId: string;
  /** Uploaded run id when available. */
  uploadedRunId?: string;
  /** Original file name when available. */
  fileName?: string;
  /** ISO-8601 timestamp of when the record was saved. */
  timestamp: string;

  // ── Compact backend result metadata ─────────────────────────────
  detectedPeakCount: number;
  fittedPeakCount: number;
  snRatio: number;
  baselineDeviation: number;
  peakResolution: XRDNormalizedResult['peakResolution'];
  primaryPhase: string | null;
  matchedPeakCount: number;
  phaseSummary: string | null;
  isPhaseMatched: boolean;
  /** Number of residual points available (full array excluded for size). */
  yResidualCount: number;
}

// ── Helpers ─────────────────────────────────────────────────────────

function canUseStorage(): boolean {
  try {
    return typeof window !== 'undefined' && window.localStorage !== undefined;
  } catch {
    return false;
  }
}

function readAll(): XRDBackendEvidenceRecord[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(XRD_BACKEND_EVIDENCE_KEY);
    return raw ? (JSON.parse(raw) as XRDBackendEvidenceRecord[]) : [];
  } catch {
    return [];
  }
}

function writeAll(records: XRDBackendEvidenceRecord[]): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(XRD_BACKEND_EVIDENCE_KEY, JSON.stringify(records));
  } catch {
    // Silently ignore quota errors.
  }
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Persist (or upsert) a normalised XRD backend result for later handoff.
 *
 * Returns the saved record.
 */
export function saveXrdBackendEvidenceResult(
  projectId: string | undefined | null,
  uploadedRunId: string | undefined | null,
  result: XRDNormalizedResult,
  fileName?: string,
): XRDBackendEvidenceRecord {
  const effectiveProjectId = projectId?.trim() || '__unassigned__';

  const record: XRDBackendEvidenceRecord = {
    projectId: effectiveProjectId,
    uploadedRunId: uploadedRunId ?? undefined,
    fileName,
    timestamp: new Date().toISOString(),
    detectedPeakCount: result.detectedPeakCount,
    fittedPeakCount: result.fittedPeakCount,
    snRatio: result.snRatio,
    baselineDeviation: result.baselineDeviation,
    peakResolution: result.peakResolution,
    primaryPhase: result.primaryPhase,
    matchedPeakCount: result.matchedPeakCount,
    phaseSummary: result.phaseSummary,
    isPhaseMatched: result.isPhaseMatched,
    yResidualCount: result.yResidual?.length ?? 0,
  };

  const existing = readAll();

  // Upsert: replace matching record by (projectId + uploadedRunId) or (projectId + fileName).
  const next = [
    ...existing.filter((item) => {
      if (item.projectId !== record.projectId) return true;
      if (record.uploadedRunId && item.uploadedRunId === record.uploadedRunId) return false;
      if (!record.uploadedRunId && record.fileName && item.fileName === record.fileName) return false;
      return true;
    }),
    record,
  ];

  writeAll(next);
  return record;
}

/**
 * Read the latest XRD backend evidence record for the given project/run pair.
 *
 * Pass `uploadedRunId` to match a specific uploaded run.
 * If omitted, returns the latest record for the project.
 */
export function readLatestXrdBackendEvidenceResult(
  projectId: string | undefined | null,
  uploadedRunId?: string | null,
): XRDBackendEvidenceRecord | null {
  const effectiveProjectId = projectId?.trim() || '__unassigned__';
  const records = readAll().filter((r) => r.projectId === effectiveProjectId);

  if (records.length === 0) return null;

  if (uploadedRunId) {
    const match = records.find((r) => r.uploadedRunId === uploadedRunId);
    return match ?? null;
  }

  // Return most-recent by timestamp.
  return records.sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
}

/**
 * Read all XRD backend evidence records for a project (may include
 * multiple datasets).
 */
export function readAllXrdBackendEvidenceResults(
  projectId: string | undefined | null,
): XRDBackendEvidenceRecord[] {
  const effectiveProjectId = projectId?.trim() || '__unassigned__';
  return readAll().filter((r) => r.projectId === effectiveProjectId);
}