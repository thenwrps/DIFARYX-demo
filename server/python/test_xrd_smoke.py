"""
DIFARYX XRD Backend Smoke Test.

Tests the POST /process endpoint with:
  1. Valid XRD-like signal (CoFe2O4 spinel pattern)
  2. Weak / empty / invalid inputs (edge cases)

Verifies response fields:
  - y_residual (JSON-safe list)
  - sn_ratio (float)
  - baseline_deviation (float)
  - peak_resolution (str)
  - detected_peaks (list)
  - fitted_peaks (list)
  - phase_match (optional dict)

Run:
    python test_xrd_smoke.py
"""

import json
import math
import sys

from fastapi.testclient import TestClient

# Ensure server/python is on sys.path
import os
_HERE = os.path.dirname(os.path.abspath(__file__))
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)

from api.gateway import app

client = TestClient(app)

# ── Helpers ──────────────────────────────────────────────────────────────────

def generate_cofe2o4_xrd_pattern():
    """
    Generate a synthetic CoFe2O4 spinel XRD pattern.
    Simulates Cu Kα radiation (λ = 1.5406 Å).
    Returns (x, y) lists where x is 2θ and y is intensity.
    """
    import numpy as np

    # 2θ range: 10° to 80° with 0.02° step
    x = np.linspace(10.0, 80.0, 3501)

    # CoFe2O4 spinel peak positions (2θ) and relative intensities
    peaks = [
        (18.37, 12.0, 0.25),   # (111)
        (30.12, 30.0, 0.30),   # (220)
        (35.48, 100.0, 0.35),  # (311) - strongest
        (37.10, 8.0, 0.25),    # (222)
        (43.12, 20.0, 0.30),   # (400)
        (53.52, 10.0, 0.25),   # (422)
        (57.02, 30.0, 0.30),   # (511)
        (62.62, 40.0, 0.35),   # (440)
    ]

    y = np.zeros_like(x)

    for peak_pos, rel_intensity, fwhm in peaks:
        # Gaussian peak profile
        sigma = fwhm / 2.355
        y += rel_intensity * np.exp(-0.5 * ((x - peak_pos) / sigma) ** 2)

    # Add baseline
    baseline = 50.0 + 0.5 * (x - 10.0)
    y += baseline

    # Add noise
    np.random.seed(42)
    noise = np.random.normal(0, 1.5, size=len(x))
    y += noise

    # Ensure non-negative
    y = np.maximum(y, 0.0)

    return x.tolist(), y.tolist()


def generate_flat_signal():
    """Generate a flat (no-peak) signal."""
    import numpy as np
    x = np.linspace(10.0, 80.0, 1000)
    y = np.full_like(x, 100.0)  # constant intensity
    return x.tolist(), y.tolist()


def generate_noise_only():
    """Generate random noise with no discernible peaks."""
    import numpy as np
    np.random.seed(99)
    x = np.linspace(10.0, 80.0, 1000)
    y = np.random.uniform(0.0, 5.0, size=len(x))
    return x.tolist(), y.tolist()


# ── Test Results Tracking ────────────────────────────────────────────────────

results = []


def log_test(name, passed, details=""):
    status = "PASS" if passed else "FAIL"
    results.append((name, status, details))
    icon = "✅" if passed else "❌"
    print(f"  {icon} {name}" + (f" — {details}" if details else ""))


# ── Test 1: Valid XRD Signal ────────────────────────────────────────────────

def test_valid_xrd_signal():
    print("\n═══ Test 1: Valid CoFe2O4 XRD Signal ═══")
    x, y = generate_cofe2o4_xrd_pattern()

    payload = {
        "x": x,
        "y": y,
        "theta_min": 10.0,
        "theta_max": 80.0,
        "peak_threshold": 0.10,
        "min_prominence": 0.05,
    }

    resp = client.post("/process", json=payload)
    log_test("POST /process returns 200", resp.status_code == 200,
             f"status={resp.status_code}")

    if resp.status_code != 200:
        log_test("Response body", False, resp.text[:300])
        return

    data = resp.json()

    # y_residual is a JSON-safe list
    y_res = data.get("y_residual", None)
    log_test("y_residual is a list", isinstance(y_res, list),
             f"type={type(y_res).__name__}, len={len(y_res) if y_res else 'N/A'}")
    if y_res:
        all_finite = all(math.isfinite(v) for v in y_res)
        log_test("y_residual values are finite", all_finite,
                 "all values are finite numbers" if all_finite else "contains NaN/Inf")

    # sn_ratio
    sn = data.get("sn_ratio")
    log_test("sn_ratio is a float", isinstance(sn, (int, float)),
             f"value={sn}")

    # baseline_deviation
    bd = data.get("baseline_deviation")
    log_test("baseline_deviation is a float", isinstance(bd, (int, float)),
             f"value={bd}")

    # peak_resolution
    pr = data.get("peak_resolution")
    valid_pr = {"high-resolution", "publication-limited", "screening-grade"}
    log_test("peak_resolution is a valid string", pr in valid_pr,
             f"value='{pr}'")

    # detected_peaks
    det = data.get("detected_peaks", [])
    log_test("detected_peaks is a list", isinstance(det, list),
             f"count={len(det)}")
    if det:
        p = det[0]
        has_keys = all(k in p for k in ("position", "intensity", "index", "prominence", "fwhm"))
        log_test("detected peak has required fields", has_keys,
                 f"keys={list(p.keys())}")

    # fitted_peaks
    fit = data.get("fitted_peaks", [])
    log_test("fitted_peaks is a list", isinstance(fit, list),
             f"count={len(fit)}")
    if fit:
        fp = fit[0]
        has_keys = all(k in fp for k in ("center", "amplitude", "fwhm", "area", "model_type"))
        log_test("fitted peak has required fields", has_keys,
                 f"keys={list(fp.keys())}")

    # phase_match
    pm = data.get("phase_match")
    log_test("phase_match is present", pm is not None,
             f"type={type(pm).__name__}")
    if pm:
        log_test("phase_match.primary_phase is string",
                 isinstance(pm.get("primary_phase"), str),
                 f"value='{pm.get('primary_phase')}'")
        matched = pm.get("matched_peaks", [])
        log_test("phase_match.matched_peaks is list",
                 isinstance(matched, list),
                 f"count={len(matched)}")
        log_test("phase_match.summary is string",
                 isinstance(pm.get("summary"), str),
                 f"len={len(pm.get('summary', ''))}")

    # Verify JSON serializable (round-trip)
    try:
        json.dumps(data)
        log_test("Response is JSON-serializable", True)
    except Exception as e:
        log_test("Response is JSON-serializable", False, str(e))


# ── Test 2: Weak/Empty/Invalid Inputs ────────────────────────────────────────

def test_missing_xy():
    print("\n═══ Test 2a: Missing x and y ═══")
    payload = {"theta_min": 10.0, "theta_max": 80.0}
    resp = client.post("/process", json=payload)
    log_test("Missing x/y returns 400", resp.status_code == 400,
             f"status={resp.status_code}")


def test_mismatched_lengths():
    print("\n═══ Test 2b: Mismatched x and y lengths ═══")
    payload = {
        "x": [10.0, 11.0, 12.0, 13.0, 14.0, 15.0, 16.0, 17.0, 18.0, 19.0, 20.0],
        "y": [1.0, 2.0, 3.0, 4.0, 5.0],
    }
    resp = client.post("/process", json=payload)
    log_test("Mismatched lengths returns 400", resp.status_code == 400,
             f"status={resp.status_code}")


def test_too_few_points():
    print("\n═══ Test 2c: Too few data points ═══")
    payload = {
        "x": [10.0, 11.0, 12.0, 13.0, 14.0],
        "y": [1.0, 2.0, 3.0, 4.0, 5.0],
    }
    resp = client.post("/process", json=payload)
    log_test("Fewer than 10 points returns 400", resp.status_code == 400,
             f"status={resp.status_code}")


def test_flat_signal():
    print("\n═══ Test 2d: Flat signal (no peaks) ═══")
    x, y = generate_flat_signal()
    payload = {"x": x, "y": y}
    resp = client.post("/process", json=payload)
    log_test("Flat signal returns 200", resp.status_code == 200,
             f"status={resp.status_code}")

    if resp.status_code == 200:
        data = resp.json()
        det = data.get("detected_peaks", [])
        # Edge artifacts from smoothing/baseline subtraction can produce
        # a small number of spurious detections on a perfectly flat signal.
        log_test("Flat signal: few detected peaks (edge artifacts OK)", len(det) <= 5,
                 f"detected={len(det)}")
        log_test("Flat signal: y_residual is list",
                 isinstance(data.get("y_residual"), list))
        log_test("Flat signal: sn_ratio is numeric",
                 isinstance(data.get("sn_ratio"), (int, float)))


def test_noise_only():
    print("\n═══ Test 2e: Noise-only signal ═══")
    x, y = generate_noise_only()
    payload = {"x": x, "y": y}
    resp = client.post("/process", json=payload)
    log_test("Noise signal returns 200", resp.status_code == 200,
             f"status={resp.status_code}")

    if resp.status_code == 200:
        data = resp.json()
        log_test("Noise: y_residual is list",
                 isinstance(data.get("y_residual"), list))
        log_test("Noise: sn_ratio is numeric",
                 isinstance(data.get("sn_ratio"), (int, float)))
        log_test("Noise: peak_resolution is string",
                 isinstance(data.get("peak_resolution"), str))


def test_empty_arrays():
    print("\n═══ Test 2f: Empty arrays ═══")
    payload = {"x": [], "y": []}
    resp = client.post("/process", json=payload)
    log_test("Empty arrays returns 400", resp.status_code == 400,
             f"status={resp.status_code}")


def test_health_endpoint():
    print("\n═══ Test 2g: Health check ═══")
    resp = client.get("/health")
    log_test("GET /health returns 200", resp.status_code == 200,
             f"status={resp.status_code}")
    if resp.status_code == 200:
        data = resp.json()
        log_test("Health response has status='ok'", data.get("status") == "ok",
                 f"status='{data.get('status')}'")


# ── Main ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("╔══════════════════════════════════════════════════════╗")
    print("║  DIFARYX XRD Backend Smoke Test                    ║")
    print("╚══════════════════════════════════════════════════════╝")

    test_valid_xrd_signal()
    test_missing_xy()
    test_mismatched_lengths()
    test_too_few_points()
    test_flat_signal()
    test_noise_only()
    test_empty_arrays()
    test_health_endpoint()

    # Summary
    print("\n" + "═" * 56)
    total = len(results)
    passed = sum(1 for _, s, _ in results if s == "PASS")
    failed = sum(1 for _, s, _ in results if s == "FAIL")
    print(f"  Total: {total}  |  Passed: {passed}  |  Failed: {failed}")

    if failed > 0:
        print("\n  Failed tests:")
        for name, status, details in results:
            if status == "FAIL":
                print(f"    ❌ {name}: {details}")
        print()
        sys.exit(1)
    else:
        print("  ✅ All tests passed!\n")
        sys.exit(0)