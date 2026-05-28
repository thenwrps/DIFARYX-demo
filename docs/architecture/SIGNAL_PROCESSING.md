# DIFARYX Signal Processing Mathematical Models

> **Last updated:** 2026-05-27  
> **Module:** `src/engines/routerEngine/handlers/genericHandler.ts`, `src/scientific/`  
> **Status:** Production-ready (11-technique universal signal processing)

---

## Overview

Every characterization module in DIFARYX processes raw measurement data
through a deterministic signal processing pipeline.  The mathematical
models below describe the algorithms used in each stage of the 7-stage
evidence workflow.

All processing is **parameter-logged** — every parameter change is recorded
in the Approval Ledger for full reproducibility.

---

## 1. Baseline Correction

### 1.1 Polynomial Baseline

Fits an *n*-th order polynomial to the raw signal and subtracts it,
isolating the signal of interest.

**Model:**

$$
B(x) = \sum_{k=0}^{n} a_k \, x^k
$$

$$
S_{\text{corrected}}(x) = S_{\text{raw}}(x) - B(x)
$$

Where:
- $S_{\text{raw}}(x)$ is the raw measurement signal
- $B(x)$ is the fitted polynomial baseline
- $a_k$ are the polynomial coefficients (least-squares fit)
- $n$ is the polynomial order (configurable, default depends on technique)

**Default Polynomial Orders:**

| Technique | Default Order | Rationale |
|-----------|--------------|-----------|
| XRD | 3 | Gentle curvature from air scatter and fluorescence. |
| XPS | 2 | Shirley background is approximately quadratic. |
| FTIR | 3 | Atmospheric CO₂ and H₂O absorption create curved baselines. |
| Raman | 2 | Fluorescence background is slowly varying. |
| XAS | 1 | Pre-edge and post-edge regions are approximately linear. |
| TEM | 0 | No baseline correction (image data). |
| BET | 0 | No baseline correction (isotherm data). |
| TPD | 2 | Desorption signal sits on a gently curved baseline. |
| NMR | 1 | Phasing and baseline roll are approximately linear. |
| SEM | 0 | No baseline correction (image data). |
| XRF | 2 | Compton scatter creates a curved background. |

**Logged Parameters:**

```
polynomial_order: int          // The order n used
coefficients: float[]          // The fitted a_k values
residual_rms: float            // RMS of (raw - baseline - corrected)
```

### 1.2 Linear Baseline

Special case of polynomial baseline with $n = 1$:

$$
B(x) = a_0 + a_1 x
$$

Used when the baseline drift is approximately linear across the
measurement range.

### 1.3 No Baseline

Pass-through mode.  $S_{\text{corrected}} = S_{\text{raw}}$.

Used for techniques where baseline correction is not applicable
(e.g., TEM images, BET isotherms).

---

## 2. Smoothing

### 2.1 Savitzky-Golay Filter

Fits a local polynomial of degree $p$ to a window of $2m + 1$ points
and evaluates the polynomial at the center point.

**Convolution coefficients:**

$$
S_{\text{smooth}}(x_i) = \sum_{k=-m}^{m} c_k \, S_{\text{corrected}}(x_{i+k})
$$

Where $c_k$ are the Savitzky-Golay convolution coefficients determined
by the polynomial degree $p$ and window half-width $m$.

**Default Parameters:**

| Technique | Window Size | Polynomial Degree |
|-----------|------------|-------------------|
| XRD | 5 | 2 |
| XPS | 7 | 3 |
| FTIR | 9 | 3 |
| Raman | 7 | 3 |
| XAS | 5 | 2 |
| TEM | 0 (none) | — |
| BET | 0 (none) | — |
| TPD | 7 | 3 |
| NMR | 5 | 2 |
| SEM | 0 (none) | — |
| XRF | 5 | 2 |

### 2.2 Moving Average

Simple unweighted average over a sliding window of size $w$:

$$
S_{\text{smooth}}(x_i) = \frac{1}{w} \sum_{k=0}^{w-1} S_{\text{corrected}}(x_{i+k})
$$

---

## 3. Normalization

### 3.1 Min-Max Normalization

Scales the signal to the range $[0, 1]$:

$$
S_{\text{norm}}(x) = \frac{S(x) - S_{\min}}{S_{\max} - S_{\min}}
$$

### 3.2 Z-Score Normalization

Centers and scales to zero mean, unit variance:

$$
S_{\text{norm}}(x) = \frac{S(x) - \mu}{\sigma}
$$

Where $\mu$ is the mean and $\sigma$ is the standard deviation.

### 3.3 Area Normalization

Normalizes so that the total area under the curve equals 1:

$$
S_{\text{norm}}(x) = \frac{S(x)}{\int S(x) \, dx}
$$

In discrete form:

$$
S_{\text{norm}}(x_i) = \frac{S(x_i)}{\sum_j S(x_j) \, \Delta x}
$$

### 3.4 No Normalization

Pass-through mode: $S_{\text{norm}} = S_{\text{smooth}}$.

---

## 4. Peak Detection (Feature Extraction)

### 4.1 Gaussian Peak Model

Many characterization signals exhibit peaks well-described by Gaussian
profiles:

$$
G(x) = A \exp\left(-\frac{(x - \mu)^2}{2\sigma^2}\right)
$$

Where:
- $A$ is the peak amplitude
- $\mu$ is the peak center (position)
- $\sigma$ is the peak width (standard deviation)

### 4.2 Lorentzian Peak Model

XRD and Raman peaks are often better described by Lorentzian profiles:

$$
L(x) = \frac{A}{1 + \left(\frac{x - \mu}{\gamma}\right)^2}
$$

Where:
- $A$ is the peak amplitude
- $\mu$ is the peak center
- $\gamma$ is the half-width at half-maximum (HWHM)

### 4.3 Pseudo-Voigt Profile

A weighted sum of Gaussian and Lorentzian profiles, commonly used in
XRD and XPS fitting:

$$
V(x) = \eta \, L(x) + (1 - \eta) \, G(x)
$$

Where $\eta \in [0, 1]$ is the mixing parameter (0 = pure Gaussian,
1 = pure Lorentzian).

### 4.4 Peak Detection Algorithm

The generic handler uses a **local maximum** approach with configurable
sensitivity:

```
For each point x_i in the smoothed signal:
  1. Find the local maximum within a sliding window of size w.
  2. Compute the prominence: amplitude above the local baseline.
  3. If prominence > sensitivity × max_amplitude:
       Mark as a detected peak.
  4. Record: position, intensity, width (FWHM).
```

**Detection Sensitivity:**

| Value | Behavior |
|-------|----------|
| 0.1 | Very sensitive — detects minor peaks. |
| 0.3 | Default — balanced detection. |
| 0.5 | Conservative — only major peaks. |
| 0.9 | Very conservative — only the strongest features. |

---

## 5. Technique-Specific Processing

### 5.1 XRD — Phase Identification

**Bragg's Law:**

$$
n\lambda = 2d \sin\theta
$$

Where:
- $n$ is the diffraction order (usually 1)
- $\lambda$ is the X-ray wavelength (Cu Kα = 1.5406 Å)
- $d$ is the interplanar spacing
- $\theta$ is the Bragg angle

**d-spacing from peak positions:**

$$
d = \frac{\lambda}{2 \sin\theta}
$$

**Miller Indices Assignment:**

For cubic systems: $d_{hkl} = \frac{a}{\sqrt{h^2 + k^2 + l^2}}$

Where $a$ is the lattice parameter and $(hkl)$ are Miller indices.

### 5.2 XPS — Chemical State Analysis

**Binding Energy:**

$$
E_B = h\nu - E_K - \phi
$$

Where:
- $E_B$ is the binding energy
- $h\nu$ is the X-ray photon energy
- $E_K$ is the kinetic energy of the emitted electron
- $\phi$ is the spectrometer work function

**Chemical Shift:**

$$
\Delta E_B = E_B(\text{compound}) - E_B(\text{element})
$$

Chemical shifts of 1–3 eV indicate changes in oxidation state.

### 5.3 FTIR — Vibrational Modes

**Wavenumber–Frequency Relationship:**

$$
\tilde{\nu} = \frac{1}{2\pi c} \sqrt{\frac{k}{\mu}}
$$

Where:
- $\tilde{\nu}$ is the wavenumber (cm⁻¹)
- $c$ is the speed of light
- $k$ is the force constant (bond strength)
- $\mu$ is the reduced mass of the vibrating atoms

**Reduced Mass:**

$$
\mu = \frac{m_1 m_2}{m_1 + m_2}
$$

### 5.4 Raman — Vibrational Fingerprint

**Raman Shift:**

$$
\Delta\tilde{\nu} = \tilde{\nu}_{\text{incident}} - \tilde{\nu}_{\text{scattered}}
$$

Raman shift is independent of the excitation wavelength and
characteristic of the molecular vibrational modes.

**Selection Rule:**

Raman-active modes require a change in polarizability during vibration:

$$
\left(\frac{\partial \alpha}{\partial Q}\right)_{Q=0} \neq 0
$$

Where $\alpha$ is the polarizability and $Q$ is the normal coordinate.

### 5.5 XAS — Local Coordination

**XANES Edge Energy:**

The absorption edge position shifts with oxidation state:

$$
\Delta E_{\text{edge}} \propto \Delta(\text{oxidation state})
$$

A shift of ~1–2 eV per unit change in oxidation state is typical for
transition metals.

**EXAFS Oscillation:**

$$
\chi(k) = \sum_j \frac{N_j S_0^2 f_j(k)}{k R_j^2} \exp\left(-\frac{2R_j}{\lambda(k)}\right) \exp(-2k^2\sigma_j^2) \sin[2kR_j + \phi_j(k)]
$$

Where:
- $k$ is the photoelectron wave vector
- $N_j$ is the coordination number of shell $j$
- $R_j$ is the interatomic distance
- $f_j(k)$ is the backscattering amplitude
- $\sigma_j^2$ is the Debye-Waller factor

---

## 6. Baseline Drift Simulation (Synthetic Data)

For the Synthetic Data Factory (Phase 3), realistic baseline drifts
are modeled as:

### 6.1 Polynomial Drift

$$
D(x) = \sum_{k=0}^{m} b_k x^k + \epsilon(x)
$$

Where $\epsilon(x) \sim \mathcal{N}(0, \sigma_{\text{noise}}^2)$ is
Gaussian noise.

### 6.2 Exponential Drift

$$
D(x) = b_0 + b_1 e^{-x/\tau} + \epsilon(x)
$$

Common in fluorescence backgrounds (Raman, FTIR).

### 6.3 Piecewise Linear Drift

$$
D(x) = \begin{cases}
a_1 x + c_1 & x \leq x_1 \\
a_2 x + c_2 & x_1 < x \leq x_2 \\
\vdots \\
a_n x + c_n & x > x_{n-1}
\end{cases}
$$

Used to model step changes in detector response.

---

## 7. Signal-to-Noise Ratio

The synthetic data factory controls SNR via:

$$
\text{SNR} = \frac{A_{\text{peak}}}{\sigma_{\text{noise}}}
$$

Typical SNR values by technique:

| Technique | Typical SNR | Notes |
|-----------|------------|-------|
| XRD | 50–200 | High-quality lab diffractometer. |
| XPS | 20–100 | Depends on acquisition time. |
| FTIR | 100–500 | ATR mode, 64 scans. |
| Raman | 10–100 | Depends on laser power and integration time. |
| XAS | 50–200 | Synchrotron source. |
| TEM | 10–50 | Image contrast dependent. |
| BET | 200–1000 | High-precision pressure sensors. |
| TPD | 20–100 | Mass spectrometer signal. |
| NMR | 50–200 | Depends on number of scans. |
| SEM | 50–200 | SE2/BSE detector. |
| XRF | 50–200 | Depends on counting time. |

---

## References

1. Savitzky, A.; Golay, M.J.E. *Anal. Chem.* **1964**, 36(8), 1627–1639.
2. Warren, B.E. *X-ray Diffraction*; Dover: 1990.
3. Shirley, D.A. *Phys. Rev. B* **1972**, 5(12), 4709.
4. Rehr, J.J.; Albers, R.C. *Rev. Mod. Phys.* **2000**, 72(3), 621.
5. Brunauer, S.; Emmett, P.H.; Teller, E. *J. Am. Chem. Soc.* **1938**, 60(2), 309–319.