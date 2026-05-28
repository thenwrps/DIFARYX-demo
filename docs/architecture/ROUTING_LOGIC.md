# DIFARYX Universal Routing Logic

> **Last updated:** 2026-05-27  
> **Module:** `src/engines/routerEngine/`  
> **Status:** Production-ready (11-technique universal router)

---

## Overview

The **Universal Scientific Analysis Router** is the central dispatch mechanism
of DIFARYX.  It receives a `RouterRequest` from any technique module or agent,
determines the correct handler, executes the requested evidence-stage, and
returns a `RouterResponse` containing the stage artifact and routing metadata.

Every routing decision is **immutable** — it is recorded in the
**Local Approval Preview Ledger** (`src/engines/stateMachine/ledger.ts`) for
full auditability and reproducibility.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                     RouterRequest                        │
│  { requestId, technique, researchObjective, rawData, … } │
└──────────────────────────┬──────────────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │   TechniqueValidator   │  ← isValidTechnique()
              └────────────┬───────────┘
                           │ valid?
                           ▼
              ┌────────────────────────┐
              │  HandlerResolutionService │
              │  (technique → handler)   │
              └────────────┬───────────┘
                           │
              ┌────────────┴───────────┐
              │                        │
              ▼                        ▼
   ┌─────────────────┐     ┌──────────────────┐
   │ TechniqueHandler │     │  GenericHandler   │
   │ (XRD, XPS, …)   │     │  (fallback)       │
   └────────┬────────┘     └────────┬──────────┘
            │                       │
            ▼                       ▼
     ┌────────────────────────────────────┐
     │        StageArtifact result         │
     └──────────────────┬─────────────────┘
                        │
                        ▼
     ┌────────────────────────────────────┐
     │  ApprovalLedger.append(Decision)   │
     └──────────────────┬─────────────────┘
                        │
                        ▼
            ┌────────────────────────┐
            │    RouterResponse      │
            │  { artifact, decision, │
            │    hasMoreStages, … }  │
            └────────────────────────┘
```

---

## 7-Stage Deterministic Workflow

Every technique module follows the same 7-stage pipeline:

| Stage | Name | Description |
|-------|------|-------------|
| 0 | **Dataset** | Ingest and validate raw data payload. |
| 1 | **Processing** | Baseline correction, smoothing, normalization. |
| 2 | **Feature Detection** | Peak finding, region-of-interest extraction. |
| 3 | **Interpretation** | Map features to scientific concepts. |
| 4 | **Comparison** | Cross-reference against reference databases. |
| 5 | **Gap Analysis** | Identify validation gaps and missing evidence. |
| 6 | **Decision** | Produce a deterministic conclusion. |

The router does **not** enforce a linear stage order — agents may request
stages out of order or repeat stages with updated parameters.  The
`EvidenceStage` type is defined in `src/types/universalResearchEvidence.ts`.

---

## Handler Resolution

The router uses a **two-tier resolution strategy**:

### Tier 1 — Technique-Specific Handler

If a `TechniqueHandler` is registered for the requested technique, it is
invoked directly.  Technique-specific handlers allow modules to override
any or all stages with domain-specific logic (e.g., XRD phase identification,
XPS curve fitting).

Registration is performed via `registerHandler()` in
`src/engines/routerEngine/handlers/index.ts`.

### Tier 2 — Generic Handler Fallback

If no technique-specific handler is registered, the router delegates to
`GenericHandler` (`src/engines/routerEngine/handlers/genericHandler.ts`).

The generic handler implements the full 7-stage pipeline using
technique-agnostic logic:

- **Stage 0 (Dataset):** Validates `RawDataPayload` structure and
  extracts primary-axis / value arrays.
- **Stage 1 (Processing):** Applies configurable baseline correction
  (polynomial, linear, or none), Savitzky-Golay smoothing, and
  min-max/z-score/area normalization.
- **Stage 2 (Feature Detection):** Derives detection sensitivity from
  `ProcessingConfig.detectionSensitivity` or defaults to 0.3.
- **Stages 3–6:** Produce deterministic placeholder artifacts that
  downstream engines (claim graph, fusion) can consume.

---

## Request Lifecycle

```
1. Caller constructs RouterRequest with:
     - requestId (UUIDv4)
     - technique (one of 11 Technique values)
     - researchObjective (free text)
     - sampleId
     - rawData (RawDataPayload)
     - startStage? (default: 'dataset')
     - processingConfig? (optional overrides)

2. Router validates technique via isValidTechnique().

3. Router resolves handler (technique-specific or generic).

4. Router emits router:request event → Ledger.

5. Router iterates stages from startStage to 'decision':
     a. Emit router:stage_start → Ledger.
     b. handler.processStage(stage, request, previousArtifacts)
     c. Emit router:stage_complete → Ledger.
     d. If parameter change detected, emit router:parameter_change → Ledger.

6. Router constructs RouterResponse:
     - artifact (StageArtifact union)
     - routingDecision (RoutingDecision metadata)
     - hasMoreStages / nextStage

7. Router returns RouterResponse to caller.
```

---

## Technique Registration Map

All 11 techniques are registered in `TECHNIQUE_REGISTRY`
(`src/types/universalTechnique.ts`):

| Technique | Domain | Active | Primary Unit |
|-----------|--------|--------|-------------|
| XRD | diffraction | ✅ | °2θ |
| XPS | spectroscopy | ✅ | eV |
| FTIR | spectroscopy | ✅ | cm⁻¹ |
| Raman | spectroscopy | ✅ | cm⁻¹ |
| XAS | spectroscopy | ✅ | eV |
| TEM | microscopy | ✅ | nm |
| BET | surface_analysis | ✅ | m²/g |
| TPD | surface_analysis | ✅ | °C |
| NMR | spectroscopy | 🔲 | ppm |
| SEM | microscopy | 🔲 | μm |
| XRF | spectroscopy | 🔲 | keV |

Inactive techniques are reserved for future modules.

---

## Cross-Technique Fusion Pipeline

After individual technique routes complete, results are fused via:

1. **Claim Graph** (`src/engines/claimGraph/`) — evidence-to-claim
   propagation with typed relations (supports / contradicts / qualifies /
   contextualizes).
2. **Fusion Engine** (`src/engines/fusionEngine/`) — resolves claim
   statuses across techniques and produces a `FusionResult`.
3. **State Machine** (`src/engines/stateMachine/`) — tracks workflow
   state transitions and records every decision in the ledger.

---

## Key Design Principles

1. **Deterministic** — same inputs always produce identical outputs.
2. **Immutable Ledger** — every routing decision is append-only.
3. **Technique-Agnostic Core** — the router never hardcodes technique
   knowledge; all domain logic lives in handlers.
4. **Single Source of Truth** — `Technique` type is defined once in
   `src/types/universalTechnique.ts` and re-exported everywhere.
5. **7-Stage Pipeline** — every module follows the same evidence stages
   for consistency and auditability.