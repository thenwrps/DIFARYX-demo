"""
General-Sample XRD Assessment.

Computes signal quality, crystallinity indicators, peak density,
dominant peak regions, unmatched peak counts, and interpretation mode
from XRD processing results and optional reference-match data.

This module is backend-only and does not modify any frontend files.
All claim language is bounded: no identity confirmation, no phase purity
confirmation.
"""

from __future__ import annotations

import logging
import math
from typing import Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# SNR thresholds for signal quality classification
_SNR_GOOD: float = 10.0
_SNR_MARGINAL: float = 3.0

# FWHM thresholds (degrees 2θ) for crystallinity classification.
# Sharp max raised to 0.8 to accommodate broadening from smoothing/detection.
_FWHM_SHARP_MAX: float = 0.8
_FWHM_BROAD_MIN: float = 1.5

# Peak-count thresholds
_MIN_PEAKS_CRYSTALLINE: int = 4
_MIN_PEAKS_MIXED: int = 2
_MIN_PEAKS_AMORPHOUS: int = 1

# 2θ band width for dominant peak region grouping (degrees)
_REGION_BAND_WIDTH: float = 10.0

# Default unmatched delta threshold (degrees 2θ)
DEFAULT_UNMATCHED_DELTA: float = 0.5


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def assess_general_sample(
    detected_peaks: list,
    fitted_peaks: list,
    sn_ratio: float,
    theta_min: float,
    theta_max: float,
    reference_match_v2: Optional[Dict] = None,
    unmatched_delta_threshold: float = DEFAULT_UNMATCHED_DELTA,
) -> Dict:
    """
    Compute a general-sample XRD assessment from processing results.

    Args:
        detected_peaks: List of DetectedPeak objects (or dicts with
                        'position', 'intensity', 'fwhm').
        fitted_peaks: List of FittedPeak objects (or dicts with
                      'center', 'amplitude', 'fwhm').
        sn_ratio: Signal-to-noise ratio from the processing engine.
        theta_min: Minimum 2θ of the measured range.
        theta_max: Maximum 2θ of the measured range.
        reference_match_v2: Optional v2 reference-match result dict.
        unmatched_delta_threshold: Max |Δ2θ| to consider a peak "matched"
                                    against reference lines.

    Returns:
        Dict with keys: signal_quality, crystallinity_indicator,
        peak_density, dominant_peak_regions, unmatched_peak_count,
        unmatched_peaks, interpretation_mode.
    """
    # ── Peak positions and FWHMs ───────────────────────────────────────────
    # Prefer fitted_peaks for positions/FWHM (model-derived, more accurate);
    # fall back to detected_peaks when no fits are available.
    peak_positions: List[float] = []
    peak_intensities: List[float] = []
    peak_fwhms: List[float] = []

    _used_fitted = False
    if fitted_peaks:
        for fp in fitted_peaks:
            center = _get_attr(fp, "center", 0.0)
            amplitude = _get_attr(fp, "amplitude", 0.0)
            fwhm = _get_attr(fp, "fwhm", 0.0)
            if center > 0:
                peak_positions.append(center)
                peak_intensities.append(amplitude)
                peak_fwhms.append(fwhm)
                _used_fitted = True

    if not _used_fitted:
        for dp in detected_peaks:
            pos = _get_attr(dp, "position", 0.0)
            inten = _get_attr(dp, "intensity", 0.0)
            fwhm = _get_attr(dp, "fwhm", 0.0)
            peak_positions.append(pos)
            peak_intensities.append(inten)
            peak_fwhms.append(fwhm)

    n_peaks = len(peak_positions)
    span = max(theta_max - theta_min, 1e-6)

    # ── Signal quality ─────────────────────────────────────────────────────
    if sn_ratio >= _SNR_GOOD and n_peaks >= _MIN_PEAKS_MIXED:
        signal_quality = "good"
    elif sn_ratio >= _SNR_MARGINAL and n_peaks >= 1:
        signal_quality = "marginal"
    else:
        signal_quality = "weak"

    # ── Crystallinity indicator ────────────────────────────────────────────
    n_sharp = sum(1 for f in peak_fwhms if f > 0 and f < _FWHM_SHARP_MAX)
    n_broad = sum(1 for f in peak_fwhms if f >= _FWHM_BROAD_MIN)

    if n_peaks < _MIN_PEAKS_MIXED or sn_ratio < _SNR_MARGINAL:
        crystallinity_indicator = "insufficient"
    elif n_sharp >= _MIN_PEAKS_CRYSTALLINE and n_broad == 0:
        crystallinity_indicator = "crystalline_like"
    elif n_broad >= _MIN_PEAKS_AMORPHOUS and n_sharp == 0:
        crystallinity_indicator = "amorphous_like"
    elif n_sharp >= _MIN_PEAKS_MIXED and n_broad >= _MIN_PEAKS_AMORPHOUS:
        crystallinity_indicator = "mixed"
    elif n_sharp >= _MIN_PEAKS_MIXED:
        crystallinity_indicator = "crystalline_like"
    elif n_broad >= _MIN_PEAKS_AMORPHOUS:
        crystallinity_indicator = "amorphous_like"
    else:
        crystallinity_indicator = "insufficient"

    # ── Peak density ───────────────────────────────────────────────────────
    peak_density = round(n_peaks / span, 4)

    # ── Dominant peak regions ──────────────────────────────────────────────
    dominant_peak_regions = _compute_dominant_regions(
        peak_positions, peak_intensities, peak_fwhms, theta_min, theta_max,
    )

    # ── Unmatched peaks ───────────────────────────────────────────────────
    unmatched_peaks, unmatched_count = _compute_unmatched_peaks(
        peak_positions, peak_intensities, reference_match_v2,
        unmatched_delta_threshold,
    )

    # ── Interpretation mode ───────────────────────────────────────────────
    interpretation_mode = _determine_interpretation_mode(
        signal_quality, crystallinity_indicator, n_peaks,
        reference_match_v2, unmatched_count,
    )

    return {
        "signal_quality": signal_quality,
        "crystallinity_indicator": crystallinity_indicator,
        "peak_density": peak_density,
        "dominant_peak_regions": dominant_peak_regions,
        "unmatched_peak_count": unmatched_count,
        "unmatched_peaks": unmatched_peaks,
        "interpretation_mode": interpretation_mode,
    }


def compute_claim_boundary(
    assessment: Dict,
    reference_match_v2: Optional[Dict] = None,
) -> Dict:
    """
    Compute backend-safe claim boundaries from the general-sample assessment.

    Always blocks identity confirmation and phase purity confirmation.

    Args:
        assessment: Output from assess_general_sample().
        reference_match_v2: Optional v2 reference-match result.

    Returns:
        Dict with keys: allowed_claims, blocked_claims,
        required_validation, limitations.
    """
    allowed: List[str] = []
    blocked: List[str] = [
        "chemical identity confirmation from XRD alone",
        "phase purity confirmation from XRD alone",
    ]
    required: List[str] = []
    limitations: List[str] = []

    signal_quality = assessment.get("signal_quality", "weak")
    crystallinity = assessment.get("crystallinity_indicator", "insufficient")
    interp_mode = assessment.get("interpretation_mode", "insufficient_data")
    unmatched_count = assessment.get("unmatched_peak_count", 0)

    # ── Allowed claims ─────────────────────────────────────────────────────
    # Always allowed: signal processing claims
    allowed.append("XRD signal processing and peak detection results")

    if signal_quality in ("good", "marginal"):
        allowed.append("crystallinity assessment (crystalline-like / amorphous-like / mixed)")

    if interp_mode == "phase_screening":
        allowed.append("reference-supported candidate phase screening")
        allowed.append("structure-family indication")
    elif interp_mode == "feature_only":
        allowed.append("feature-level diffraction indication only")
    else:
        # insufficient_data: only signal/feature inspection
        allowed.append("signal and feature inspection only")

    # ── Blocked claims (always) ────────────────────────────────────────────
    if interp_mode != "phase_screening":
        blocked.append("reference-supported phase identification")

    # ── Required validation ───────────────────────────────────────────────
    if interp_mode in ("phase_screening", "feature_only"):
        required.append("composition-sensitive technique (XPS, EDS, or XRF) for identity support")
        required.append("vibrational or molecular technique (FTIR or Raman) for bonding confirmation")

    if interp_mode == "phase_screening":
        required.append("TEM or SAED for nanoscale phase confirmation")

    if crystallinity in ("amorphous_like", "mixed"):
        required.append("TEM or HRTEM for local-order / nanocrystallinity verification")

    if signal_quality == "weak":
        required.append("repeat measurement with improved statistics")

    # ── Limitations ───────────────────────────────────────────────────────
    limitations.append("XRD matching is based on peak-position agreement only")

    if unmatched_count > 0:
        limitations.append(
            f"{unmatched_count} measured peak(s) are not explained by "
            f"top reference candidates; additional phases or artifacts may be present"
        )

    if signal_quality == "weak":
        limitations.append("weak signal limits interpretation reliability")

    if crystallinity == "insufficient":
        limitations.append("insufficient crystallinity evidence for meaningful phase screening")

    if crystallinity == "amorphous_like":
        limitations.append("broad amorphous features limit peak-position-based matching")

    return {
        "allowed_claims": allowed,
        "blocked_claims": blocked,
        "required_validation": required,
        "limitations": limitations,
    }


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _get_attr(obj, attr: str, default):
    """Get attribute from object or dict."""
    if isinstance(obj, dict):
        return obj.get(attr, default)
    return getattr(obj, attr, default)


def _compute_dominant_regions(
    positions: List[float],
    intensities: List[float],
    fwhms: List[float],
    theta_min: float,
    theta_max: float,
) -> List[Dict]:
    """
    Group peaks into 2θ bands and identify dominant regions.

    Returns list of dicts: {range_label, peak_count, character, representative_2theta}.
    """
    if not positions:
        return []

    # Create bands
    bands: Dict[int, List[int]] = {}  # band_idx -> list of peak indices
    for i, pos in enumerate(positions):
        band_idx = int(math.floor((pos - theta_min) / _REGION_BAND_WIDTH))
        if band_idx not in bands:
            bands[band_idx] = []
        bands[band_idx].append(i)

    regions: List[Dict] = []
    for band_idx in sorted(bands.keys()):
        peak_indices = bands[band_idx]
        band_start = theta_min + band_idx * _REGION_BAND_WIDTH
        band_end = band_start + _REGION_BAND_WIDTH

        # Character classification
        band_fwhms = [fwhms[i] for i in peak_indices if fwhms[i] > 0]
        n_sharp = sum(1 for f in band_fwhms if f < _FWHM_SHARP_MAX)
        n_broad = sum(1 for f in band_fwhms if f >= _FWHM_BROAD_MIN)

        if n_sharp > 0 and n_broad > 0:
            character = "mixed"
        elif n_broad > 0:
            character = "broad"
        else:
            character = "sharp"

        # Representative peak: highest intensity in band
        rep_idx = max(peak_indices, key=lambda i: intensities[i])
        rep_pos = positions[rep_idx]

        # Format label
        band_start_r = round(band_start, 0)
        band_end_r = round(band_end, 0)
        range_label = f"{int(band_start_r)}–{int(band_end_r)}°"

        regions.append({
            "range_label": range_label,
            "peak_count": len(peak_indices),
            "character": character,
            "representative_2theta": round(rep_pos, 2),
        })

    return regions


def _compute_unmatched_peaks(
    peak_positions: List[float],
    peak_intensities: List[float],
    reference_match_v2: Optional[Dict],
    delta_threshold: float,
) -> Tuple[List[Dict], int]:
    """
    Identify measured peaks not explained by top reference candidates.

    A peak is "unmatched" if no reference line from the primary candidate
    (or top-ranked candidate) falls within delta_threshold.

    Returns:
        Tuple of (list of unmatched peak dicts, unmatched_count).
    """
    if not reference_match_v2 or not peak_positions:
        # Without reference data, all peaks are unmatched
        unmatched = []
        for pos, inten in zip(peak_positions, peak_intensities):
            unmatched.append({
                "position_2theta": round(pos, 4),
                "intensity": round(inten, 4),
                "nearest_match_2theta": None,
                "delta_2theta": None,
            })
        return unmatched, len(unmatched)

    # Collect all reference lines from ranked candidates
    ref_lines: List[float] = []
    primary = reference_match_v2.get("primary_candidate")
    ranked = reference_match_v2.get("ranked_candidates", [])

    # Use all ranked candidates' reference peaks for coverage
    for candidate in ranked:
        for mp in candidate.get("matched_peaks", []):
            ref_pos = mp.get("reference_two_theta")
            if ref_pos is not None:
                ref_lines.append(ref_pos)

    if not ref_lines:
        # No reference lines available
        unmatched = []
        for pos, inten in zip(peak_positions, peak_intensities):
            unmatched.append({
                "position_2theta": round(pos, 4),
                "intensity": round(inten, 4),
                "nearest_match_2theta": None,
                "delta_2theta": None,
            })
        return unmatched, len(unmatched)

    unmatched = []
    for pos, inten in zip(peak_positions, peak_intensities):
        # Find nearest reference line
        best_delta = float("inf")
        best_ref = None
        for ref_pos in ref_lines:
            delta = abs(pos - ref_pos)
            if delta < best_delta:
                best_delta = delta
                best_ref = ref_pos

        if best_delta > delta_threshold:
            unmatched.append({
                "position_2theta": round(pos, 4),
                "intensity": round(inten, 4),
                "nearest_match_2theta": round(best_ref, 4) if best_ref is not None else None,
                "delta_2theta": round(best_delta, 4) if best_ref is not None else None,
            })

    return unmatched, len(unmatched)


def _determine_interpretation_mode(
    signal_quality: str,
    crystallinity: str,
    n_peaks: int,
    reference_match_v2: Optional[Dict],
    unmatched_count: int,
) -> str:
    """
    Determine the interpretation mode based on all assessment factors.

    Returns:
        One of: "phase_screening", "feature_only", "insufficient_data".
    """
    if signal_quality == "weak" or crystallinity == "insufficient":
        return "insufficient_data"

    if not reference_match_v2:
        # No reference data available
        if n_peaks >= _MIN_PEAKS_MIXED and signal_quality == "good":
            return "feature_only"
        return "insufficient_data"

    status = reference_match_v2.get("status", "")
    claim_level = reference_match_v2.get("claim_level", "none")
    primary = reference_match_v2.get("primary_candidate")

    # Strong candidate match
    if status in ("candidate_match", "candidate_screening") and primary:
        score = primary.get("score", 0.0)
        coverage = primary.get("coverage_ratio", 0.0)
        if score >= 0.5 and coverage >= 0.3:
            return "phase_screening"

    # Some feature support but weak
    if status == "candidate_match" or (primary and primary.get("matched_peak_count", 0) >= 1):
        return "feature_only"

    if claim_level == "weak_candidate":
        return "feature_only"

    # Fallback
    if n_peaks >= _MIN_PEAKS_MIXED and signal_quality in ("good", "marginal"):
        return "feature_only"

    return "insufficient_data"