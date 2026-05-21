"""
Reference Database Service.

Provides phase matching against reference XRD databases for the DIFARYX
XRD processing engine. Contains a realistic reference registry with
structural markers (2θ, I_rel, hkl) for common nanomaterial phases.

Supported databases (matching frontend UI dropdowns):
    - "ICSD"             → Inorganic Crystal Structure Database
    - "PDF-4+"           → Powder Diffraction File 4+
    - "Local Reference"  → User-curated local reference set

Phases in registry:
    - CuFe₂O₄  Spinel   (tetragonal/ cubic, JCPDS 34-0428 / ICSD-65363)
    - CoFe₂O₄  Spinel   (cubic Fd-3m, JCPDS 22-1086 / ICSD-15342)
    - Amorphous SBA-15   (broad SiO₂ humps at ~20–22° 2θ)
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Dict, List

from xrd_engine.services.xrd_engine import FittedPeak

logger = logging.getLogger(__name__)

# Tolerance for matching a measured peak to a reference marker (degrees 2θ)
DEFAULT_MATCH_TOLERANCE: float = 0.5


# ============================================================================
# Data classes
# ============================================================================


@dataclass(frozen=True)
class ReferenceMarker:
    """
    A single reference diffraction marker from a crystallographic database.

    Attributes:
        hkl:            Miller indices (e.g., "(311)").
        d_spacing:      Interplanar spacing in Ångströms.
        position_2theta: Expected 2θ position in degrees (Cu Kα).
        relative_intensity: Relative intensity on a 0–100 scale.
        phase_label:    Human-readable phase name (e.g., "CoFe2O4 Spinel").
    """
    hkl: str
    d_spacing: float
    position_2theta: float
    relative_intensity: float
    phase_label: str


@dataclass(frozen=True)
class PeakMatch:
    """
    Result of matching a measured peak against a reference marker.

    Attributes:
        measured_center:   Fitted 2θ position of the measured peak.
        reference_marker:  The closest matching reference marker.
        delta_2theta:      Difference (measured − reference) in degrees.
        confidence:        Match confidence score in [0, 1].
        db_source:         Which database the match came from.
    """
    measured_center: float
    reference_marker: ReferenceMarker
    delta_2theta: float
    confidence: float
    db_source: str


@dataclass
class PhaseMatchResult:
    """
    Aggregate result of phase matching for all detected peaks.

    Attributes:
        primary_phase:   Best-matching phase label.
        matched_peaks:   List of individual peak matches.
        db_source:       Database used for matching.
        catalog_id:      Catalog identifier (e.g., ICSD collection code).
        summary:         Human-readable match summary.
    """
    primary_phase: str
    matched_peaks: List[PeakMatch] = field(default_factory=list)
    db_source: str = ""
    catalog_id: str = ""
    summary: str = ""


# ============================================================================
# Reference registry — multi-phase marker library
# ============================================================================

# CuFe₂O₄ spinel (tetragonal / cubic, Cu Kα λ = 1.5406 Å)
# Reference: JCPDS 34-0428 / ICSD-65363
CUFE2O4_SPINEL_MARKERS: List[ReferenceMarker] = [
    ReferenceMarker(
        hkl="(111)",
        d_spacing=4.8500,
        position_2theta=18.33,
        relative_intensity=15.0,
        phase_label="CuFe2O4 Spinel",
    ),
    ReferenceMarker(
        hkl="(220)",
        d_spacing=2.9700,
        position_2theta=30.08,
        relative_intensity=30.0,
        phase_label="CuFe2O4 Spinel",
    ),
    ReferenceMarker(
        hkl="(311)",
        d_spacing=2.5350,
        position_2theta=35.45,
        relative_intensity=100.0,
        phase_label="CuFe2O4 Spinel",
    ),
    ReferenceMarker(
        hkl="(222)",
        d_spacing=2.4250,
        position_2theta=37.06,
        relative_intensity=10.0,
        phase_label="CuFe2O4 Spinel",
    ),
    ReferenceMarker(
        hkl="(400)",
        d_spacing=2.1000,
        position_2theta=43.18,
        relative_intensity=25.0,
        phase_label="CuFe2O4 Spinel",
    ),
    ReferenceMarker(
        hkl="(422)",
        d_spacing=1.7150,
        position_2theta=53.48,
        relative_intensity=12.0,
        phase_label="CuFe2O4 Spinel",
    ),
    ReferenceMarker(
        hkl="(511)",
        d_spacing=1.6160,
        position_2theta=56.98,
        relative_intensity=35.0,
        phase_label="CuFe2O4 Spinel",
    ),
    ReferenceMarker(
        hkl="(440)",
        d_spacing=1.4850,
        position_2theta=62.68,
        relative_intensity=45.0,
        phase_label="CuFe2O4 Spinel",
    ),
]

# CoFe₂O₄ spinel (cubic Fd-3m, Cu Kα λ = 1.5406 Å)
# Reference: JCPDS 22-1086 / ICSD-15342
# Slight lattice parameter shift vs CuFe₂O₄ (a=8.3919 Å vs ~8.44 Å)
COFE2O4_SPINEL_MARKERS: List[ReferenceMarker] = [
    ReferenceMarker(
        hkl="(111)",
        d_spacing=4.8430,
        position_2theta=18.37,
        relative_intensity=12.0,
        phase_label="CoFe2O4 Spinel",
    ),
    ReferenceMarker(
        hkl="(220)",
        d_spacing=2.9660,
        position_2theta=30.12,
        relative_intensity=30.0,
        phase_label="CoFe2O4 Spinel",
    ),
    ReferenceMarker(
        hkl="(311)",
        d_spacing=2.5320,
        position_2theta=35.48,
        relative_intensity=100.0,
        phase_label="CoFe2O4 Spinel",
    ),
    ReferenceMarker(
        hkl="(222)",
        d_spacing=2.4220,
        position_2theta=37.10,
        relative_intensity=8.0,
        phase_label="CoFe2O4 Spinel",
    ),
    ReferenceMarker(
        hkl="(400)",
        d_spacing=2.0970,
        position_2theta=43.12,
        relative_intensity=20.0,
        phase_label="CoFe2O4 Spinel",
    ),
    ReferenceMarker(
        hkl="(422)",
        d_spacing=1.7130,
        position_2theta=53.52,
        relative_intensity=10.0,
        phase_label="CoFe2O4 Spinel",
    ),
    ReferenceMarker(
        hkl="(511)",
        d_spacing=1.6140,
        position_2theta=57.02,
        relative_intensity=30.0,
        phase_label="CoFe2O4 Spinel",
    ),
    ReferenceMarker(
        hkl="(440)",
        d_spacing=1.4830,
        position_2theta=62.62,
        relative_intensity=40.0,
        phase_label="CoFe2O4 Spinel",
    ),
]

# Amorphous SBA-15 silica (mesoporous SiO₂)
# Broad humps characteristic of amorphous / low-order SiO₂ frameworks.
# hkl fields use descriptive labels since long-range order is absent.
SBA15_AMORPHOUS_MARKERS: List[ReferenceMarker] = [
    ReferenceMarker(
        hkl="(SiO₂ amorphous hump)",
        d_spacing=4.4400,
        position_2theta=20.00,
        relative_intensity=100.0,
        phase_label="SBA-15 Amorphous",
    ),
    ReferenceMarker(
        hkl="(SiO₂ amorphous shoulder)",
        d_spacing=4.0400,
        position_2theta=22.00,
        relative_intensity=70.0,
        phase_label="SBA-15 Amorphous",
    ),
    ReferenceMarker(
        hkl="(100 mesopore)",
        d_spacing=9.5000,
        position_2theta=9.30,
        relative_intensity=40.0,
        phase_label="SBA-15 Amorphous",
    ),
]

# Master registry: phase_label → list of markers
REFERENCE_REGISTRY: Dict[str, List[ReferenceMarker]] = {
    "CuFe2O4 Spinel": CUFE2O4_SPINEL_MARKERS,
    "CoFe2O4 Spinel": COFE2O4_SPINEL_MARKERS,
    "SBA-15 Amorphous": SBA15_AMORPHOUS_MARKERS,
}


# ============================================================================
# Database-specific metadata generators
# ============================================================================


def _get_db_metadata(db_type: str) -> dict:
    """
    Return database-specific metadata for a given reference source.

    Each database reports different catalog identifiers and formatting
    conventions to reflect real-world differences.

    Args:
        db_type: One of "ICSD", "PDF-4+", "Local Reference".

    Returns:
        Dictionary with keys: catalog_id, summary_template, confidence_scale.
    """
    if db_type == "ICSD":
        return {
            "catalog_id": "ICSD-15342",
            "summary_template": (
                "Matched against ICSD entries (15342 CoFe2O4 / 65363 CuFe2O4). "
                "{n_matched}/{n_total} markers above threshold."
            ),
            "confidence_scale": 1.0,
        }
    elif db_type == "PDF-4+":
        return {
            "catalog_id": "PDF-00-022-1086",
            "summary_template": (
                "Matched against PDF-4+ entries (00-022-1086 CoFe2O4, "
                "00-034-0428 CuFe2O4, broad SiO₂ SBA-15). "
                "{n_matched}/{n_total} markers above threshold."
            ),
            "confidence_scale": 0.95,
        }
    elif db_type == "Local Reference":
        return {
            "catalog_id": "LOCAL-MULTI-001",
            "summary_template": (
                "Matched against local reference library (spinel ferrites "
                "+ amorphous silica standards). "
                "{n_matched}/{n_total} markers above threshold."
            ),
            "confidence_scale": 0.85,
        }
    else:
        logger.warning("Unknown database type '%s'; using generic metadata.", db_type)
        return {
            "catalog_id": "UNKNOWN",
            "summary_template": "Matched against unknown database '{db_type}'. {n_matched}/{n_total} markers above threshold.",
            "confidence_scale": 0.5,
        }


# ============================================================================
# Peak matching service
# ============================================================================


def match_peaks(
    evidence_peaks: List[FittedPeak],
    db_type: str,
    tolerance: float = DEFAULT_MATCH_TOLERANCE,
) -> PhaseMatchResult:
    """
    Match fitted XRD peaks against reference database markers.

    Scans all phases in the reference registry and finds the closest marker
    within tolerance for each evidence peak. The phase with the most matched
    markers (weighted by confidence) is selected as the primary phase.

    Confidence scoring:
        proximity_score = 1.0 - (|Δ2θ| / tolerance)
        → 1.0 when Δ2θ = 0 (exact match)
        → 0.0 when |Δ2θ| = tolerance (edge of window)

    Args:
        evidence_peaks: Fitted peaks from the XRD processing engine.
        db_type: Reference database identifier
                 ("ICSD", "PDF-4+", or "Local Reference").
        tolerance: Maximum allowed |Δ2θ| for a match (default 0.5°).

    Returns:
        PhaseMatchResult with matched markers and metadata.
    """
    db_meta: dict = _get_db_metadata(db_type)
    confidence_scale: float = db_meta["confidence_scale"]

    # Flatten all markers from the registry into a single list,
    # keeping the phase_label attached to each marker.
    all_markers: List[ReferenceMarker] = []
    for phase_markers in REFERENCE_REGISTRY.values():
        all_markers.extend(phase_markers)

    matched: List[PeakMatch] = []

    for peak in evidence_peaks:
        best_marker: ReferenceMarker | None = None
        best_delta: float = float("inf")

        # Scan every marker across all phases
        for marker in all_markers:
            delta: float = abs(peak.center - marker.position_2theta)
            if delta < best_delta:
                best_delta = delta
                best_marker = marker

        if best_marker is not None and best_delta <= tolerance:
            # Confidence: purely position-based decay
            proximity_score: float = 1.0 - (best_delta / tolerance)
            proximity_score = max(0.0, min(1.0, proximity_score))

            # Apply database-specific confidence scaling
            confidence: float = round(
                max(0.0, min(1.0, proximity_score * confidence_scale)),
                4,
            )

            matched.append(
                PeakMatch(
                    measured_center=peak.center,
                    reference_marker=best_marker,
                    delta_2theta=round(peak.center - best_marker.position_2theta, 4),
                    confidence=confidence,
                    db_source=db_type,
                )
            )
            logger.debug(
                "Peak at %.2f° → %s %s (Δ=%.3f°, conf=%.3f)",
                peak.center,
                best_marker.phase_label,
                best_marker.hkl,
                best_delta,
                confidence,
            )
        else:
            logger.debug(
                "Peak at %.2f°: no reference match within %.2f° tolerance.",
                peak.center,
                tolerance,
            )

    # Determine primary phase: the phase with the highest total confidence
    primary_phase: str = "Unknown"
    if matched:
        phase_scores: Dict[str, float] = {}
        for pm in matched:
            label: str = pm.reference_marker.phase_label
            phase_scores[label] = phase_scores.get(label, 0.0) + pm.confidence
        primary_phase = max(phase_scores, key=phase_scores.get)  # type: ignore[arg-type]

    # Build summary
    n_matched: int = len(matched)
    n_total: int = len(evidence_peaks)
    summary_template: str = db_meta["summary_template"]
    summary: str = summary_template.format(
        n_matched=n_matched,
        n_total=n_total,
        db_type=db_type,
    )

    result = PhaseMatchResult(
        primary_phase=primary_phase,
        matched_peaks=matched,
        db_source=db_type,
        catalog_id=db_meta["catalog_id"],
        summary=summary,
    )

    logger.info(
        "Phase matching complete: %d/%d peaks matched to '%s' via %s.",
        n_matched,
        n_total,
        primary_phase,
        db_type,
    )

    return result