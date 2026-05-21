"""
XRD Pipeline Parameter Models (Pydantic v2)

Strictly validated parameter models for the DIFARYX XRD processing engine.
Enum values exactly match the frontend UI dropdowns defined in
src/data/techniqueWorkspaceContent.ts.

Frontend XRD parameter controls:
  - baselineMethod:      "Asymmetric LS" | "Polynomial" | "Rolling Ball" | "None"
  - smoothingMethod:     "Savitzky-Golay" | "Moving Average" | "None"
  - fitModel:            "Pseudo-Voigt" | "Gaussian" | "Lorentzian"
  - referenceDatabase:   "ICSD" | "PDF-4+" | "Local Reference"
  - smoothingWindow:     int (default 7, min 1, max 51, step 2)
  - peakThreshold:       float (default 0.12, min 0.01, max 1)
  - minimumProminence:   float (default 0.08, min 0, max 1)
  - twoThetaMin:         float (default 10)
  - twoThetaMax:         float (default 80)
  - wavelength:          float (default 1.5406)
"""

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, model_validator


# ============================================================================
# Enums — must match frontend dropdown options exactly
# ============================================================================


class BaselineMethod(str, Enum):
    """Baseline correction methods available in the XRD workspace UI."""
    ASYMMETRIC_LS = "Asymmetric LS"
    POLYNOMIAL = "Polynomial"
    ROLLING_BALL = "Rolling Ball"
    NONE = "None"


class SmoothingMethod(str, Enum):
    """Smoothing methods available in the XRD workspace UI."""
    SAVITZKY_GOLAY = "Savitzky-Golay"
    MOVING_AVERAGE = "Moving Average"
    NONE = "None"


class FitModelType(str, Enum):
    """Peak profile models available in the XRD workspace UI."""
    PSEUDO_VOIGT = "Pseudo-Voigt"
    GAUSSIAN = "Gaussian"
    LORENTZIAN = "Lorentzian"


class ReferenceDB(str, Enum):
    """Reference databases available in the XRD workspace UI."""
    ICSD = "ICSD"
    PDF4_PLUS = "PDF-4+"
    LOCAL_REFERENCE = "Local Reference"


# ============================================================================
# Sub-parameter models
# ============================================================================


class BaselineParams(BaseModel):
    """
    Baseline correction parameters.

    Attributes:
        method: Baseline correction algorithm.
            - "Asymmetric LS" → pybaselines asls()
            - "Polynomial"    → pybaselines modpoly()
            - "Rolling Ball"  → pybaselines rolling_ball()
            - "None"          → no baseline correction (passthrough)
        poly_order: Polynomial order for the Polynomial method (default 3).
        half_window: Half-window size for the Rolling Ball method (default 50).
    """
    model_config = {"frozen": True, "use_enum_values": True}

    method: BaselineMethod = Field(
        default=BaselineMethod.ASYMMETRIC_LS,
        description="Baseline correction method matching UI dropdown.",
    )
    poly_order: int = Field(
        default=3,
        ge=1,
        le=10,
        description="Polynomial order (used only when method is Polynomial).",
    )
    half_window: int = Field(
        default=50,
        ge=5,
        le=500,
        description="Half-window size (used only when method is Rolling Ball).",
    )


class SmoothingParams(BaseModel):
    """
    Smoothing parameters.

    Attributes:
        method: Smoothing algorithm.
            - "Savitzky-Golay"  → scipy.signal.savgol_filter()
            - "Moving Average"  → numpy.convolve() uniform kernel
            - "None"            → no smoothing (passthrough)
        window_length: Smoothing window length (must be odd, default 11).
    """
    model_config = {"frozen": True, "use_enum_values": True}

    method: SmoothingMethod = Field(
        default=SmoothingMethod.SAVITZKY_GOLAY,
        description="Smoothing method matching UI dropdown.",
    )
    window_length: int = Field(
        default=11,
        ge=3,
        le=51,
        description="Window length for smoothing (must be odd integer).",
    )

    @model_validator(mode="after")
    def _ensure_odd_window(self) -> "SmoothingParams":
        """Ensure window_length is odd; round up if even."""
        if self.method != SmoothingMethod.NONE and self.window_length % 2 == 0:
            # Pydantic frozen: use object.__setattr__ for validation adjustment
            object.__setattr__(self, "window_length", self.window_length + 1)
        return self


class FitModelParams(BaseModel):
    """
    Peak fitting model parameters.

    Attributes:
        model_type: Peak profile shape used by lmfit.
            - "Pseudo-Voigt" → lmfit PseudoVoigtModel
            - "Gaussian"     → lmfit GaussianModel
            - "Lorentzian"   → lmfit LorentzianModel
    """
    model_config = {"frozen": True, "use_enum_values": True}

    model_type: FitModelType = Field(
        default=FitModelType.PSEUDO_VOIGT,
        description="Peak profile model matching UI dropdown.",
    )


class DatabaseParams(BaseModel):
    """
    Reference database selection parameters.

    Attributes:
        reference_db: Which reference database to query.
            - "ICSD"             → Inorganic Crystal Structure Database
            - "PDF-4+"           → Powder Diffraction File 4+
            - "Local Reference"  → User-curated local reference set
    """
    model_config = {"frozen": True, "use_enum_values": True}

    reference_db: ReferenceDB = Field(
        default=ReferenceDB.ICSD,
        description="Reference database matching UI dropdown.",
    )


# ============================================================================
# Top-level pipeline configuration
# ============================================================================


class XRDPipelineConfig(BaseModel):
    """
    Complete XRD processing pipeline configuration.

    Combines all sub-parameter models with global acquisition parameters.
    Default values match the frontend UI defaults from techniqueWorkspaceContent.ts.

    Attributes:
        baseline:       Baseline correction parameters.
        smoothing:      Smoothing parameters.
        fit_model:      Peak fitting model parameters.
        database:       Reference database parameters.
        wavelength:     X-ray wavelength in Ångströms (Cu Kα₁ = 1.5406 Å).
        theta_min:      Minimum 2θ angle in degrees (default 10).
        theta_max:      Maximum 2θ angle in degrees (default 80).
        peak_threshold: Normalized intensity threshold for peak detection (0.01–1.0).
        min_prominence: Minimum peak prominence for detection (0–1.0).
    """
    model_config = {"frozen": True, "use_enum_values": True}

    baseline: BaselineParams = Field(
        default_factory=BaselineParams,
        description="Baseline correction configuration.",
    )
    smoothing: SmoothingParams = Field(
        default_factory=SmoothingParams,
        description="Smoothing configuration.",
    )
    fit_model: FitModelParams = Field(
        default_factory=FitModelParams,
        description="Peak fitting model configuration.",
    )
    database: DatabaseParams = Field(
        default_factory=DatabaseParams,
        description="Reference database configuration.",
    )
    wavelength: float = Field(
        default=1.5406,
        gt=0.0,
        lt=10.0,
        description="X-ray wavelength in Ångströms (Cu Kα₁ default).",
    )
    theta_min: float = Field(
        default=10.0,
        ge=0.0,
        le=180.0,
        description="Minimum 2θ angle for processing range.",
    )
    theta_max: float = Field(
        default=80.0,
        ge=0.0,
        le=180.0,
        description="Maximum 2θ angle for processing range.",
    )
    peak_threshold: float = Field(
        default=0.12,
        ge=0.01,
        le=1.0,
        description="Normalized intensity threshold for peak detection.",
    )
    min_prominence: float = Field(
        default=0.08,
        ge=0.0,
        le=1.0,
        description="Minimum peak prominence for detection.",
    )

    @model_validator(mode="after")
    def _validate_theta_range(self) -> "XRDPipelineConfig":
        """Ensure theta_min < theta_max."""
        if self.theta_min >= self.theta_max:
            raise ValueError(
                f"theta_min ({self.theta_min}) must be less than "
                f"theta_max ({self.theta_max})."
            )
        return self