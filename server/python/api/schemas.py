"""
Pydantic schemas for the XRD Gateway API.

Defines request/response models for all REST endpoints.
Separate from domain models to allow API-specific serialization
while maintaining strict domain validation.
"""

from __future__ import annotations

from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# ============================================================================
# Enums (mirror domain enums for API contract)
# ============================================================================


class BaselineMethodAPI(str, Enum):
    ASYMMETRIC_LS = "Asymmetric LS"
    POLYNOMIAL = "Polynomial"
    ROLLING_BALL = "Rolling Ball"
    NONE = "None"


class SmoothingMethodAPI(str, Enum):
    SAVITZKY_GOLAY = "Savitzky-Golay"
    MOVING_AVERAGE = "Moving Average"
    NONE = "None"


class FitModelTypeAPI(str, Enum):
    PSEUDO_VOIGT = "Pseudo-Voigt"
    GAUSSIAN = "Gaussian"
    LORENTZIAN = "Lorentzian"


class ReferenceDBAPI(str, Enum):
    ICSD = "ICSD"
    PDF4_PLUS = "PDF-4+"
    LOCAL_REFERENCE = "Local Reference"


# ============================================================================
# Request schemas
# ============================================================================


class BaselineConfigAPI(BaseModel):
    """Baseline correction configuration for API requests."""
    method: BaselineMethodAPI = Field(
        default=BaselineMethodAPI.ASYMMETRIC_LS,
        description="Baseline correction method.",
    )
    poly_order: int = Field(default=3, ge=1, le=10)
    half_window: int = Field(default=50, ge=5, le=500)


class SmoothingConfigAPI(BaseModel):
    """Smoothing configuration for API requests."""
    method: SmoothingMethodAPI = Field(
        default=SmoothingMethodAPI.SAVITZKY_GOLAY,
        description="Smoothing method.",
    )
    window_length: int = Field(default=11, ge=3, le=51)


class FitModelConfigAPI(BaseModel):
    """Peak fitting model configuration for API requests."""
    model_type: FitModelTypeAPI = Field(
        default=FitModelTypeAPI.PSEUDO_VOIGT,
        description="Peak profile model.",
    )


class DatabaseConfigAPI(BaseModel):
    """Reference database selection for API requests."""
    reference_db: ReferenceDBAPI = Field(
        default=ReferenceDBAPI.ICSD,
        description="Reference database to query.",
    )


class XRDProcessRequest(BaseModel):
    """
    Full XRD processing pipeline request.

    All parameters are optional; omitted fields use sensible defaults.
    Raw data can be provided inline or uploaded as CSV.
    """
    x: Optional[List[float]] = Field(
        default=None,
        description="2θ angle array in degrees. Required if no CSV uploaded.",
    )
    y: Optional[List[float]] = Field(
        default=None,
        description="Intensity array (arbitrary units). Required if no CSV uploaded.",
    )
    baseline: BaselineConfigAPI = Field(
        default_factory=BaselineConfigAPI,
        description="Baseline correction configuration.",
    )
    smoothing: SmoothingConfigAPI = Field(
        default_factory=SmoothingConfigAPI,
        description="Smoothing configuration.",
    )
    fit_model: FitModelConfigAPI = Field(
        default_factory=FitModelConfigAPI,
        description="Peak fitting model configuration.",
    )
    database: DatabaseConfigAPI = Field(
        default_factory=DatabaseConfigAPI,
        description="Reference database configuration.",
    )
    wavelength: float = Field(default=1.5406, gt=0.0, lt=10.0)
    theta_min: float = Field(default=10.0, ge=0.0, le=180.0)
    theta_max: float = Field(default=80.0, ge=0.0, le=180.0)
    peak_threshold: float = Field(default=0.12, ge=0.01, le=1.0)
    min_prominence: float = Field(default=0.08, ge=0.0, le=1.0)


class MatchRequest(BaseModel):
    """
    Reference database matching request.

    Sends fitted peak data to the reference DB service for phase matching.
    """
    peaks: List[Dict[str, Any]] = Field(
        description=(
            "List of fitted peaks. Each must contain 'center', 'amplitude', "
            "and 'fwhm' keys."
        ),
    )
    reference_db: ReferenceDBAPI = Field(
        default=ReferenceDBAPI.ICSD,
        description="Reference database to query.",
    )
    tolerance: float = Field(
        default=0.5,
        gt=0.0,
        le=5.0,
        description="2θ matching tolerance in degrees.",
    )


# ============================================================================
# Response schemas
# ============================================================================


class DetectedPeakResponse(BaseModel):
    """Detected peak data in API response."""
    position: float = Field(description="2θ position in degrees.")
    intensity: float = Field(description="Peak intensity (processed).")
    index: int = Field(description="Index into data array.")
    prominence: float = Field(default=0.0)
    fwhm: float = Field(default=0.0, description="Estimated FWHM in °2θ.")


class FittedPeakResponse(BaseModel):
    """Fitted peak data in API response."""
    center: float = Field(description="Refined 2θ position in degrees.")
    amplitude: float = Field(description="Fitted amplitude.")
    fwhm: float = Field(description="Fitted FWHM in °2θ.")
    area: float = Field(description="Integrated area under fitted profile.")
    model_type: str = Field(description="Model used for fitting.")
    residual_rms: float = Field(default=0.0, description="RMS residual of fit.")
    crystallite_size: float = Field(
        default=0.0,
        description="Crystallite size in nm (Scherrer equation).",
    )


class ReferenceMarkerResponse(BaseModel):
    """Reference marker from a crystallographic database."""
    hkl: str
    d_spacing: float
    position_2theta: float
    relative_intensity: float
    phase_label: str


class PeakMatchResponse(BaseModel):
    """A single peak match result."""
    measured_center: float
    reference_marker: ReferenceMarkerResponse
    delta_2theta: float
    confidence: float
    db_source: str


class PhaseMatchResponse(BaseModel):
    """Aggregate phase matching result."""
    primary_phase: str
    matched_peaks: List[PeakMatchResponse] = Field(default_factory=list)
    db_source: str
    catalog_id: str
    summary: str


class XRDProcessResponse(BaseModel):
    """Full XRD processing pipeline response."""
    x: List[float] = Field(description="2θ angle array.")
    y_raw: List[float] = Field(description="Raw intensity array.")
    y_smoothed: List[float] = Field(description="Smoothed intensity array.")
    y_baseline: List[float] = Field(description="Estimated baseline.")
    y_corrected: List[float] = Field(description="Baseline-corrected intensity.")
    y_residual: List[float] = Field(
        default_factory=list,
        description="Fit residual array (y_observed - y_fitted).",
    )
    detected_peaks: List[DetectedPeakResponse] = Field(default_factory=list)
    fitted_peaks: List[FittedPeakResponse] = Field(default_factory=list)
    phase_match: Optional[PhaseMatchResponse] = Field(
        default=None,
        description="Phase matching result (if database specified).",
    )
    sn_ratio: float = Field(
        default=0.0,
        description="Signal-to-noise ratio (max smoothed / noise-floor std).",
    )
    baseline_deviation: float = Field(
        default=0.0,
        description="Baseline contribution as percentage of total raw intensity.",
    )
    peak_resolution: str = Field(
        default="screening-grade",
        description="Peak resolution classification: high-resolution | publication-limited | screening-grade.",
    )


class HealthResponse(BaseModel):
    """Health check response."""
    status: str = "ok"
    engine: str = "xrd"
    version: str = "1.0.0"


class ErrorResponse(BaseModel):
    """Standard error response."""
    detail: str
    error_type: Optional[str] = None


class ScienceSkill(BaseModel):
    """Metadata schema representing a registered Science Skill."""
    skill_id: str = Field(description="Unique string identifier for the skill.")
    skill_label: str = Field(description="Display label of the skill.")
    technique: str = Field(description="Associated experimental technique.")
    description: str = Field(description="Summary of the skill's purpose.")
    inputs: str = Field(description="Description of expected inputs.")
    outputs: str = Field(description="Description of generated outputs.")
    status: str = Field(description="Current status: active or inactive.")


class ScientificEvidenceObject(BaseModel):
    """Structured container representing skill-derived scientific evidence."""
    evidence_id: str = Field(description="UUIDv4 identifier for the evidence snapshot.")
    schema_version: str = Field(default="1.0.0", description="Schema version identifier.")
    skill_id: str = Field(description="ID of the executing skill.")
    skill_label: str = Field(description="Label of the executing skill.")
    technique: str = Field(description="Associated technique.")
    input_reference: str = Field(description="SHA-256 hash representation of the input dataset.")
    processing_summary: str = Field(description="Summary of active processing parameters.")
    scientific_observations: List[str] = Field(default_factory=list, description="List of peak details and phase indications.")
    claim_boundaries: List[str] = Field(default_factory=list, description="Validation constraints and limitations.")
    validation_gaps: List[str] = Field(default_factory=list, description="Open validation gaps or next steps.")
    agent_ready_summary: str = Field(description="LLM-optimized summary of findings.")
    raw_result: Dict[str, Any] = Field(description="JSON-safe dictionary of raw processor outputs.")
    created_at: str = Field(description="ISO UTC timestamp of creation.")


class XRDSkillProcessResponse(BaseModel):
    """Response model for the XRD Science Skill processing endpoint."""
    legacy_result: XRDProcessResponse = Field(description="Legacy XRD processor output.")
    evidence_object: ScientificEvidenceObject = Field(description="Validation-bounded scientific evidence object.")