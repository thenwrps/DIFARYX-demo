/**
 * TypeScript types for the XRD Python backend API.
 *
 * These mirror the Pydantic response schemas in `server/python/api/schemas.py`
 * but are kept permissive (index signatures, optional fields) so the frontend
 * won't break if the backend adds new fields.
 */

// ── Peak data ───────────────────────────────────────────────────────

export interface XRDDetectedPeak {
  position: number;
  intensity: number;
  index: number;
  prominence: number;
  fwhm: number;
  [key: string]: unknown;
}

export interface XRDFittedPeak {
  center: number;
  amplitude: number;
  fwhm: number;
  area: number;
  model_type: string;
  residual_rms: number;
  crystallite_size: number;
  [key: string]: unknown;
}

// ── Phase matching ──────────────────────────────────────────────────

export interface XRDReferenceMarker {
  hkl: string;
  d_spacing: number;
  position_2theta: number;
  relative_intensity: number;
  phase_label: string;
  [key: string]: unknown;
}

export interface XRDPeakMatch {
  measured_center: number;
  reference_marker: XRDReferenceMarker;
  delta_2theta: number;
  confidence: number;
  db_source: string;
  [key: string]: unknown;
}

export interface XRDPhaseMatch {
  primary_phase: string;
  matched_peaks: XRDPeakMatch[];
  db_source: string;
  catalog_id: string;
  summary: string;
  [key: string]: unknown;
}

// ── Full processing response ────────────────────────────────────────

export type XRDPeakResolution =
  | 'high-resolution'
  | 'publication-limited'
  | 'screening-grade'
  | string;

export interface XRDProcessResponse {
  x: number[];
  y_raw: number[];
  y_smoothed: number[];
  y_baseline: number[];
  y_corrected: number[];
  y_residual: number[];
  detected_peaks: XRDDetectedPeak[];
  fitted_peaks: XRDFittedPeak[];
  phase_match: XRDPhaseMatch | null;
  sn_ratio: number;
  baseline_deviation: number;
  peak_resolution: XRDPeakResolution;
  [key: string]: unknown;
}

export interface ScientificEvidenceObject {
  evidence_id: string;
  schema_version: string;
  skill_id: string;
  skill_label: string;
  technique: string;
  input_reference: string;
  processing_summary: string;
  scientific_observations: string[];
  claim_boundaries: string[];
  validation_gaps: string[];
  agent_ready_summary: string;
  raw_result: Record<string, unknown>;
  created_at: string;
  [key: string]: unknown;
}

export interface XRDSkillProcessResponse {
  legacy_result: XRDProcessResponse;
  evidence_object: ScientificEvidenceObject;
  [key: string]: unknown;
}

// ── Request payload ─────────────────────────────────────────────────

export interface XRDBaselineConfig {
  method?: string;
  poly_order?: number;
  half_window?: number;
}

export interface XRDProcessingParams {
  baseline?: XRDBaselineConfig;
  smoothing?: { method?: string; window_length?: number };
  fit_model?: { model_type?: string };
  database?: { reference_db?: string };
  wavelength?: number;
  theta_min?: number;
  theta_max?: number;
  peak_threshold?: number;
  min_prominence?: number;
}

export interface XRDProcessPayload {
  x: number[];
  y: number[];
  params?: XRDProcessingParams;
}

// ── Normalized frontend result ──────────────────────────────────────

export interface XRDNormalizedResult {
  raw: XRDProcessResponse;
  scientificEvidenceObject?: ScientificEvidenceObject;
  detectedPeakCount: number;
  fittedPeakCount: number;
  snRatio: number;
  baselineDeviation: number;
  peakResolution: XRDPeakResolution;
  primaryPhase: string | null;
  matchedPeakCount: number;
  phaseSummary: string | null;
  yResidual: number[];
  isPhaseMatched: boolean;
}
