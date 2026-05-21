/**
 * XRD Backend API Client
 *
 * Posts XRD signal data to the Python FastAPI backend for processing.
 * Returns normalized results suitable for frontend consumption.
 *
 * The backend endpoint is: POST /process
 * Base URL defaults to http://localhost:8000 and can be overridden
 * via the VITE_XRD_BACKEND_URL environment variable.
 */

import type {
  XRDProcessPayload,
  XRDProcessResponse,
  XRDNormalizedResult,
} from '../types/xrdBackend';

// ── Configuration ───────────────────────────────────────────────────

const DEFAULT_BASE_URL = 'http://localhost:8000';
const REQUEST_TIMEOUT_MS = 30_000;

function getBackendBaseUrl(): string {
  return import.meta.env.VITE_XRD_BACKEND_URL || DEFAULT_BASE_URL;
}

// ── Health check ────────────────────────────────────────────────────

export interface XRDHealthStatus {
  ok: boolean;
  status?: string;
  engine?: string;
  version?: string;
  error?: string;
}

export async function checkXrdBackendHealth(): Promise<XRDHealthStatus> {
  const baseUrl = getBackendBaseUrl();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5_000);

    const response = await fetch(`${baseUrl}/health`, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      return { ok: false, error: `HTTP ${response.status}` };
    }

    const data = await response.json();
    return {
      ok: true,
      status: data.status,
      engine: data.engine,
      version: data.version,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Connection failed',
    };
  }
}

// ── Normalization (exported for tests and UI) ───────────────────────

export function normalizeXrdBackendResponse(
  raw: XRDProcessResponse,
): XRDNormalizedResult {
  const phaseMatch = raw.phase_match;
  return {
    raw,
    detectedPeakCount: raw.detected_peaks?.length ?? 0,
    fittedPeakCount: raw.fitted_peaks?.length ?? 0,
    snRatio: raw.sn_ratio ?? 0,
    baselineDeviation: raw.baseline_deviation ?? 0,
    peakResolution: raw.peak_resolution ?? 'screening-grade',
    primaryPhase: phaseMatch?.primary_phase ?? null,
    matchedPeakCount: phaseMatch?.matched_peaks?.length ?? 0,
    phaseSummary: phaseMatch?.summary ?? null,
    yResidual: raw.y_residual ?? [],
    isPhaseMatched: !!phaseMatch,
  };
}

// ── Processing ──────────────────────────────────────────────────────

export interface ProcessXrdSignalOptions {
  /** Override backend base URL for this request only. */
  baseUrl?: string;
  /** Override request timeout in ms. */
  timeoutMs?: number;
}

export class XRDBackendError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'XRDBackendError';
  }
}

/**
 * Send XRD signal data to the backend for processing.
 *
 * @param payload - Two-theta (x) and intensity (y) arrays plus optional params
 * @param options - Optional overrides for base URL and timeout
 * @returns Normalized processing result
 * @throws XRDBackendError on network failure, timeout, or non-2xx response
 */
export async function processXrdSignal(
  payload: XRDProcessPayload,
  options?: ProcessXrdSignalOptions,
): Promise<XRDNormalizedResult> {
  const baseUrl = options?.baseUrl ?? getBackendBaseUrl();
  const timeoutMs = options?.timeoutMs ?? REQUEST_TIMEOUT_MS;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = `${baseUrl}/process`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        x: payload.x,
        y: payload.y,
        ...(payload.params ? { params: payload.params } : {}),
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let detail = `XRD backend returned HTTP ${response.status}`;
      try {
        const errBody = await response.json();
        if (errBody?.detail) {
          detail = errBody.detail;
        }
      } catch {
        // ignore parse failure
      }
      throw new XRDBackendError(detail, response.status);
    }

    const raw: XRDProcessResponse = await response.json();
    return normalizeXrdBackendResponse(raw);
  } catch (err) {
    clearTimeout(timeoutId);

    if (err instanceof XRDBackendError) {
      throw err;
    }

    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new XRDBackendError(
        `XRD backend request timed out after ${timeoutMs}ms`,
        undefined,
        err,
      );
    }

    throw new XRDBackendError(
      err instanceof Error ? err.message : 'Unknown XRD backend error',
      undefined,
      err,
    );
  }
}