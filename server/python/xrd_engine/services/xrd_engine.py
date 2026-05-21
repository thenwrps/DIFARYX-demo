"""
XRD Signal Processing Engine.

Core scientific processing class for X-ray Diffraction data.
Dynamically routes processing based on Enum parameters from the frontend UI.

Dependencies:
    - numpy: Vectorized array operations
    - scipy.signal: Savitzky-Golay smoothing, peak detection
    - pybaselines: Advanced baseline correction (asls, modpoly, rolling_ball)
    - lmfit: Non-linear least-squares peak fitting (Gaussian, Lorentzian, Pseudo-Voigt)
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import List, Tuple

import numpy as np
import numpy.typing as npt
from scipy.signal import find_peaks, savgol_filter

from pybaselines import Baseline

from lmfit import Model
from lmfit.models import (
    GaussianModel,
    LorentzianModel,
    PseudoVoigtModel,
)

from xrd_engine.domain.models.xrd_params import (
    BaselineMethod,
    BaselineParams,
    FitModelParams,
    FitModelType,
    SmoothingMethod,
    SmoothingParams,
    XRDPipelineConfig,
)

logger = logging.getLogger(__name__)

# Type alias for numpy float arrays
NDArrayFloat = npt.NDArray[np.floating]


# ============================================================================
# Result data classes
# ============================================================================


@dataclass(frozen=True)
class DetectedPeak:
    """A single detected diffraction peak."""
    position: float          # 2θ in degrees
    intensity: float         # height after processing
    index: int               # index into the data array
    prominence: float = 0.0  # peak prominence
    fwhm: float = 0.0        # full width at half maximum (°2θ)


@dataclass(frozen=True)
class FittedPeak:
    """A peak refined by non-linear least-squares fitting."""
    center: float            # refined 2θ position
    amplitude: float         # fitted amplitude
    fwhm: float              # fitted FWHM
    area: float              # integrated area under the fitted profile
    model_type: str          # model used ("Pseudo-Voigt", "Gaussian", "Lorentzian")
    residual_rms: float = 0.0  # RMS residual of the fit
    crystallite_size: float = 0.0  # crystallite size in nm (Scherrer equation)


@dataclass
class ProcessingResult:
    """Complete output of an XRD processing pipeline run."""
    x: NDArrayFloat
    y_raw: NDArrayFloat
    y_smoothed: NDArrayFloat
    y_baseline: NDArrayFloat
    y_corrected: NDArrayFloat
    y_residual: NDArrayFloat = field(
        default_factory=lambda: np.array([], dtype=np.float64),
    )
    detected_peaks: List[DetectedPeak] = field(default_factory=list)
    fitted_peaks: List[FittedPeak] = field(default_factory=list)
    sn_ratio: float = 0.0
    baseline_deviation: float = 0.0
    peak_resolution: str = "screening-grade"


# ============================================================================
# XRD Signal Processor
# ============================================================================


class XRDSignalProcessor:
    """
    Dynamic XRD signal processor.

    Routes processing algorithms based on UI-selected parameters.
    All methods operate on numpy arrays for vectorized performance.

    Usage::

        processor = XRDSignalProcessor(config)
        result = processor.run(x_data, y_data)
    """

    def __init__(self, config: XRDPipelineConfig) -> None:
        """
        Initialize the processor with a pipeline configuration.

        Args:
            config: Validated XRD pipeline configuration.
        """
        self._config: XRDPipelineConfig = config

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def run(
        self,
        x: npt.ArrayLike,
        y: npt.ArrayLike,
    ) -> ProcessingResult:
        """
        Execute the full XRD processing pipeline.

        Steps:
            1. Baseline correction
            2. Smoothing
            3. Peak detection
            4. Peak fitting
            5. Residual computation

        Args:
            x: 2θ angle array (degrees).
            y: Intensity array (arbitrary units).

        Returns:
            ProcessingResult with all intermediate and final data.
        """
        x_arr: NDArrayFloat = np.asarray(x, dtype=np.float64)
        y_arr: NDArrayFloat = np.asarray(y, dtype=np.float64)

        # Validate array shapes
        if x_arr.ndim != 1 or y_arr.ndim != 1:
            raise ValueError("Input arrays x and y must be 1-dimensional.")
        if x_arr.shape[0] != y_arr.shape[0]:
            raise ValueError(
                f"x and y must have the same length "
                f"(got {x_arr.shape[0]} and {y_arr.shape[0]})."
            )

        # Step 1: Baseline correction
        y_baseline: NDArrayFloat = self._compute_baseline(y_arr)
        y_corrected: NDArrayFloat = np.maximum(y_arr - y_baseline, 0.0)

        # Step 2: Smoothing
        y_smoothed: NDArrayFloat = self._apply_smoothing(y_corrected)

        # Normalize to [0, 1] for peak detection consistency
        y_max: float = float(np.max(y_smoothed))
        if y_max > 0.0:
            y_normalized: NDArrayFloat = y_smoothed / y_max
        else:
            y_normalized = y_smoothed.copy()

        # Step 3: Peak detection
        detected: List[DetectedPeak] = self._detect_peaks(
            x_arr, y_normalized, y_smoothed,
        )

        # Step 4: Peak fitting
        fitted: List[FittedPeak] = self._fit_peaks(
            x_arr, y_smoothed, detected,
        )

        # Step 5: Compute fit residual (y_observed - y_fitted)
        y_residual: NDArrayFloat = self._compute_residual(
            x_arr, y_smoothed, fitted,
        )

        # Step 6: Compute reliability metrics
        sn_ratio, baseline_dev, peak_res = self._compute_reliability_metrics(
            y_arr, y_baseline, y_smoothed, y_residual, fitted,
        )

        return ProcessingResult(
            x=x_arr,
            y_raw=y_arr,
            y_smoothed=y_smoothed,
            y_baseline=y_baseline,
            y_corrected=y_corrected,
            y_residual=y_residual,
            detected_peaks=detected,
            fitted_peaks=fitted,
            sn_ratio=sn_ratio,
            baseline_deviation=baseline_dev,
            peak_resolution=peak_res,
        )

    # ------------------------------------------------------------------
    # Baseline correction
    # ------------------------------------------------------------------

    def _compute_baseline(self, y: NDArrayFloat) -> NDArrayFloat:
        """
        Estimate and return the spectral baseline.

        Dynamically selects the baseline correction algorithm based on
        the configuration's baseline method.

        Args:
            y: Raw intensity array.

        Returns:
            Baseline array (same shape as y).
        """
        method: str = self._config.baseline.method
        n: int = y.shape[0]

        if method == BaselineMethod.NONE:
            logger.debug("Baseline correction: None (passthrough)")
            return np.zeros(n, dtype=np.float64)

        try:
            bl = Baseline()

            if method == BaselineMethod.ASYMMETRIC_LS:
                logger.debug("Baseline correction: Asymmetric LS (asls)")
                baseline_arr, _ = bl.asls(y)
                return np.asarray(baseline_arr, dtype=np.float64)

            elif method == BaselineMethod.POLYNOMIAL:
                poly_order: int = self._config.baseline.poly_order
                logger.debug(
                    "Baseline correction: Polynomial (modpoly, order=%d)",
                    poly_order,
                )
                baseline_arr, _ = bl.modpoly(y, poly_order=poly_order)
                return np.asarray(baseline_arr, dtype=np.float64)

            elif method == BaselineMethod.ROLLING_BALL:
                half_window: int = self._config.baseline.half_window
                logger.debug(
                    "Baseline correction: Rolling Ball (half_window=%d)",
                    half_window,
                )
                baseline_arr, _ = bl.rolling_ball(y, half_window=half_window)
                return np.asarray(baseline_arr, dtype=np.float64)

            else:
                logger.warning(
                    "Unknown baseline method '%s'; falling back to None.", method,
                )
                return np.zeros(n, dtype=np.float64)

        except Exception as exc:
            logger.error(
                "Baseline correction failed for method '%s': %s. "
                "Returning zero baseline.",
                method,
                exc,
            )
            return np.zeros(n, dtype=np.float64)

    # ------------------------------------------------------------------
    # Smoothing
    # ------------------------------------------------------------------

    def _apply_smoothing(self, y: NDArrayFloat) -> NDArrayFloat:
        """
        Apply smoothing to the intensity array.

        Dynamically selects the smoothing algorithm based on
        the configuration's smoothing method.

        Args:
            y: Intensity array (after baseline correction).

        Returns:
            Smoothed intensity array.
        """
        method: str = self._config.smoothing.method

        if method == SmoothingMethod.NONE:
            logger.debug("Smoothing: None (passthrough)")
            return y.copy()

        window_length: int = self._config.smoothing.window_length

        # Ensure window_length does not exceed data length
        if window_length > y.shape[0]:
            window_length = y.shape[0] if y.shape[0] % 2 == 1 else y.shape[0] - 1
            logger.warning(
                "Smoothing window reduced to %d (data length constraint).",
                window_length,
            )

        if window_length < 3:
            logger.warning("Smoothing window too small (%d); returning raw.", window_length)
            return y.copy()

        try:
            if method == SmoothingMethod.SAVITZKY_GOLAY:
                logger.debug(
                    "Smoothing: Savitzky-Golay (window=%d, polyorder=3)",
                    window_length,
                )
                return savgol_filter(y, window_length=window_length, polyorder=3)

            elif method == SmoothingMethod.MOVING_AVERAGE:
                logger.debug(
                    "Smoothing: Moving Average (window=%d)",
                    window_length,
                )
                kernel: NDArrayFloat = np.ones(window_length, dtype=np.float64) / window_length
                smoothed: NDArrayFloat = np.convolve(y, kernel, mode="same")
                return smoothed

            else:
                logger.warning(
                    "Unknown smoothing method '%s'; falling back to None.", method,
                )
                return y.copy()

        except Exception as exc:
            logger.error(
                "Smoothing failed for method '%s': %s. Returning unsmoothed data.",
                method,
                exc,
            )
            return y.copy()

    # ------------------------------------------------------------------
    # Peak detection
    # ------------------------------------------------------------------

    def _detect_peaks(
        self,
        x: NDArrayFloat,
        y_normalized: NDArrayFloat,
        y_original: NDArrayFloat,
    ) -> List[DetectedPeak]:
        """
        Detect diffraction peaks in the smoothed, normalized pattern.

        Uses scipy.signal.find_peaks with prominence and threshold filters.
        Peaks outside the [theta_min, theta_max] range are excluded.

        Args:
            x: 2θ angle array.
            y_normalized: Normalized intensity array [0, 1].
            y_original: Original (non-normalized) smoothed intensity.

        Returns:
            List of DetectedPeak objects sorted by position.
        """
        theta_min: float = self._config.theta_min
        theta_max: float = self._config.theta_max
        threshold: float = self._config.peak_threshold
        prominence: float = self._config.min_prominence

        # Compute absolute height threshold from normalized threshold
        height_cutoff: float = threshold

        try:
            peak_indices, properties = find_peaks(
                y_normalized,
                height=height_cutoff,
                prominence=prominence,
                distance=5,  # minimum 5-point separation
            )
        except Exception as exc:
            logger.error("Peak detection failed: %s", exc)
            return []

        peaks: List[DetectedPeak] = []
        prominences = properties.get("prominences", np.zeros(len(peak_indices)))
        widths_dict = properties.get("widths", np.zeros(len(peak_indices)))

        for i, idx in enumerate(peak_indices):
            pos: float = float(x[idx])

            # Filter peaks outside the 2θ range
            if pos < theta_min or pos > theta_max:
                continue

            # Estimate FWHM from scipy's width measurement (in index units)
            # Convert to 2θ units using the x-axis spacing
            width_indices: float = float(widths_dict[i]) if i < len(widths_dict) else 0.0
            x_spacing: float = float(np.mean(np.diff(x))) if len(x) > 1 else 1.0
            fwhm_est: float = width_indices * x_spacing

            peaks.append(
                DetectedPeak(
                    position=pos,
                    intensity=float(y_original[idx]),
                    index=int(idx),
                    prominence=float(prominences[i]) if i < len(prominences) else 0.0,
                    fwhm=fwhm_est,
                )
            )

        # Sort by 2θ position
        peaks.sort(key=lambda p: p.position)
        logger.info("Detected %d peaks in range [%.1f, %.1f]°2θ.", len(peaks), theta_min, theta_max)
        return peaks

    # ------------------------------------------------------------------
    # Peak fitting
    # ------------------------------------------------------------------

    def _fit_peaks(
        self,
        x: NDArrayFloat,
        y: NDArrayFloat,
        detected_peaks: List[DetectedPeak],
    ) -> List[FittedPeak]:
        """
        Fit detected peaks using non-linear least-squares with lmfit.

        Performs local window fitting around each detected peak center.
        The model type is selected dynamically based on the configuration.

        Args:
            x: 2θ angle array.
            y: Smoothed intensity array (not normalized).
            detected_peaks: List of detected peaks to fit.

        Returns:
            List of FittedPeak objects with refined parameters.
        """
        if not detected_peaks:
            logger.info("No peaks to fit.")
            return []

        model_type: str = self._config.fit_model.model_type
        model_cls = self._resolve_model(model_type)

        if model_cls is None:
            logger.error("Could not resolve lmfit model for '%s'.", model_type)
            return []

        fitted_peaks: List[FittedPeak] = []
        n: int = len(x)
        x_spacing: float = float(np.mean(np.diff(x))) if n > 1 else 1.0

        for peak in detected_peaks:
            # Define a local window around the peak (±3× estimated FWHM)
            half_window_theta: float = max(peak.fwhm * 3.0, 5.0 * x_spacing)
            mask: NDArrayFloat = (
                (x >= peak.position - half_window_theta)
                & (x <= peak.position + half_window_theta)
            )

            x_local: NDArrayFloat = x[mask]
            y_local: NDArrayFloat = y[mask]

            if len(x_local) < 5:
                logger.warning(
                    "Insufficient points (%d) to fit peak at %.2f°. Skipping.",
                    len(x_local),
                    peak.position,
                )
                continue

            try:
                fitted = self._fit_single_peak(
                    x_local, y_local, peak, model_cls, model_type,
                )
                fitted_peaks.append(fitted)
            except Exception as exc:
                logger.warning(
                    "Fit failed for peak at %.2f°: %s",
                    peak.position,
                    exc,
                )

        logger.info(
            "Fitted %d / %d peaks using %s model.",
            len(fitted_peaks),
            len(detected_peaks),
            model_type,
        )
        return fitted_peaks

    def _fit_single_peak(
        self,
        x_local: NDArrayFloat,
        y_local: NDArrayFloat,
        peak: DetectedPeak,
        model_cls: type,
        model_type_str: str,
    ) -> FittedPeak:
        """
        Fit a single peak in a local window.

        Args:
            x_local: Local 2θ array.
            y_local: Local intensity array.
            peak: Detected peak metadata.
            model_cls: lmfit Model class to use.
            model_type_str: String label for the model type.

        Returns:
            FittedPeak with refined parameters.

        Raises:
            RuntimeError: If the fit does not converge.
        """
        # Create lmfit model instance
        model: Model = model_cls(prefix="peak_")

        # Set initial parameter guesses
        params = model.make_params()

        # Common initial guesses
        params["peak_center"].set(value=peak.position, min=x_local[0], max=x_local[-1])
        params["peak_amplitude"].set(value=max(peak.intensity, 1.0), min=0.0)
        params["peak_sigma"].set(
            value=max(peak.fwhm / 2.355, abs(x_local[1] - x_local[0])),
            min=abs(x_local[1] - x_local[0]) * 0.5,
        )

        # Pseudo-Voigt has an additional fraction parameter
        if model_type_str == FitModelType.PSEUDO_VOIGT:
            params["peak_fraction"].set(value=0.5, min=0.0, max=1.0)

        # Perform the fit
        result = model.fit(y_local, params, x=x_local)

        if not result.success:
            raise RuntimeError(
                f"lmfit did not converge: {result.message}"
            )

        # Extract fitted parameters
        center: float = float(result.params["peak_center"].value)
        amplitude: float = float(result.params["peak_amplitude"].value)
        sigma: float = abs(float(result.params["peak_sigma"].value))

        # Convert sigma to FWHM (model-dependent)
        if model_type_str == FitModelType.LORENTZIAN:
            # Lorentzian: FWHM = 2 * gamma (sigma is gamma in lmfit LorentzianModel)
            fwhm: float = 2.0 * sigma
        else:
            # Gaussian / Pseudo-Voigt: FWHM = 2.355 * sigma
            fwhm = 2.355 * sigma

        # Estimate integrated area
        # For Gaussian: area = amplitude * sigma * sqrt(2*pi)
        # For Lorentzian: area = amplitude * pi * gamma
        # For Pseudo-Voigt: approximate as Gaussian
        if model_type_str == FitModelType.LORENTZIAN:
            area: float = amplitude * np.pi * sigma
        else:
            area = amplitude * sigma * np.sqrt(2.0 * np.pi)

        # RMS residual
        residual_rms: float = float(np.sqrt(np.mean(result.residual ** 2)))

        # Scherrer equation: τ = (K * λ) / (β * cos(θ))
        # K = 0.94 (shape factor for spherical particles)
        # λ = wavelength converted from Å to nm (× 0.1)
        # β = FWHM in radians (from °2θ)
        # θ = half of peak center, in radians
        scherrer_K: float = 0.94
        wavelength_nm: float = self._config.wavelength * 0.1  # Å → nm

        beta: float = fwhm * (np.pi / 180.0) if fwhm > 0.0 else 0.0
        theta_rad: float = (center / 2.0) * (np.pi / 180.0)
        cos_theta: float = float(np.cos(theta_rad))

        denominator: float = beta * abs(cos_theta)
        crystallite_size: float = (
            (scherrer_K * wavelength_nm) / denominator
            if denominator > 1e-12
            else 0.0
        )

        return FittedPeak(
            center=center,
            amplitude=amplitude,
            fwhm=fwhm,
            area=area,
            model_type=model_type_str,
            residual_rms=residual_rms,
            crystallite_size=round(crystallite_size, 4),
        )

    # ------------------------------------------------------------------
    # Residual computation
    # ------------------------------------------------------------------

    def _compute_residual(
        self,
        x: NDArrayFloat,
        y_observed: NDArrayFloat,
        fitted_peaks: List[FittedPeak],
    ) -> NDArrayFloat:
        """
        Compute the full-length residual array (y_observed - y_fitted).

        Reconstructs each fitted peak's profile over the full x-array using
        the appropriate lmfit model and fitted parameters, then subtracts the
        sum of all profiles from the observed (smoothed) intensity.

        Args:
            x: Full 2θ angle array.
            y_observed: Smoothed intensity array (the observed signal).
            fitted_peaks: List of successfully fitted peaks.

        Returns:
            Residual array of same length as x. Returns zeros if no peaks fitted.
        """
        n: int = len(x)
        if not fitted_peaks:
            return np.zeros(n, dtype=np.float64)

        y_fitted_total: NDArrayFloat = np.zeros(n, dtype=np.float64)

        for fp in fitted_peaks:
            model_cls = self._resolve_model(fp.model_type)
            if model_cls is None:
                continue

            model: Model = model_cls(prefix="resid_")
            params = model.make_params()
            params["resid_center"].set(value=fp.center)
            params["resid_amplitude"].set(value=fp.amplitude)

            # Convert FWHM back to sigma for the model
            if fp.model_type == FitModelType.LORENTZIAN:
                # Lorentzian: FWHM = 2 * gamma → sigma = FWHM / 2
                sigma_val: float = fp.fwhm / 2.0
            else:
                # Gaussian / Pseudo-Voigt: FWHM = 2.355 * sigma
                sigma_val = fp.fwhm / 2.355

            params["resid_sigma"].set(value=max(sigma_val, 1e-10))

            if fp.model_type == FitModelType.PSEUDO_VOIGT:
                params["resid_fraction"].set(value=0.5)

            profile: NDArrayFloat = model.eval(params, x=x)
            y_fitted_total += profile

        residual: NDArrayFloat = y_observed - y_fitted_total
        return residual

    # ------------------------------------------------------------------
    # Reliability metrics
    # ------------------------------------------------------------------

    @staticmethod
    def _compute_reliability_metrics(
        y_raw: NDArrayFloat,
        y_baseline: NDArrayFloat,
        y_smoothed: NDArrayFloat,
        y_residual: NDArrayFloat,
        fitted_peaks: List[FittedPeak],
    ) -> Tuple[float, float, str]:
        """
        Compute spectral reliability metrics for the processed XRD data.

        Metrics:
            - S/N ratio: max(smoothed) / std(noise-floor residuals).
              The noise floor is estimated from residual values that fall
              below the median absolute residual (i.e., regions without peaks).
            - Baseline deviation: percentage of total raw intensity contributed
              by the baseline (∑y_baseline / ∑y_raw × 100).
            - Peak resolution: classification based on average FWHM of fitted peaks.

        Args:
            y_raw: Original raw intensity array.
            y_baseline: Estimated baseline array.
            y_smoothed: Smoothed intensity array.
            y_residual: Fit residual array (observed − fitted).
            fitted_peaks: List of successfully fitted peaks.

        Returns:
            Tuple of (sn_ratio, baseline_deviation, peak_resolution).
        """
        # --- S/N Ratio ---
        sn_ratio: float = 0.0
        if y_residual.size > 0:
            resid_abs: NDArrayFloat = np.abs(y_residual)
            # Use median absolute residual as noise-floor threshold
            # Points well below this are likely noise-only regions
            noise_threshold: float = float(np.median(resid_abs))
            noise_mask: NDArrayFloat = resid_abs <= noise_threshold
            noise_values: NDArrayFloat = y_residual[noise_mask]

            if noise_values.size > 1:
                noise_std: float = float(np.std(noise_values))
                max_intensity: float = float(np.max(y_smoothed))
                sn_ratio = (
                    round(max_intensity / noise_std, 2)
                    if noise_std > 1e-12
                    else 0.0
                )

        # --- Baseline Deviation ---
        sum_baseline: float = float(np.sum(y_baseline))
        sum_raw: float = float(np.sum(y_raw))
        baseline_deviation: float = (
            round((sum_baseline / sum_raw) * 100.0, 2)
            if sum_raw > 1e-12
            else 0.0
        )

        # --- Peak Resolution Status ---
        peak_resolution: str = "screening-grade"
        if fitted_peaks:
            avg_fwhm: float = float(np.mean([fp.fwhm for fp in fitted_peaks]))
            if avg_fwhm < 0.15:
                peak_resolution = "high-resolution"
            elif avg_fwhm <= 0.30:
                peak_resolution = "publication-limited"
            else:
                peak_resolution = "screening-grade"

        return sn_ratio, baseline_deviation, peak_resolution

    # ------------------------------------------------------------------
    # Model resolution
    # ------------------------------------------------------------------

    @staticmethod
    def _resolve_model(model_type: str) -> type | None:
        """
        Resolve the lmfit Model class from a FitModelType enum value.

        Args:
            model_type: One of "Pseudo-Voigt", "Gaussian", "Lorentzian".

        Returns:
            The corresponding lmfit Model class, or None if unknown.
        """
        model_map: dict[str, type] = {
            FitModelType.PSEUDO_VOIGT: PseudoVoigtModel,
            FitModelType.GAUSSIAN: GaussianModel,
            FitModelType.LORENTZIAN: LorentzianModel,
        }
        resolved = model_map.get(model_type)

        if resolved is None:
            # Graceful fallback: default to Gaussian
            logger.warning(
                "Unknown fit model '%s'; falling back to GaussianModel.",
                model_type,
            )
            return GaussianModel

        return resolved