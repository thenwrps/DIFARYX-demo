# DIFARYX API Specifications

> **Last updated:** 2026-05-27  
> **Modules:** `src/engines/routerEngine/`, `src/engines/stateMachine/`, `src/engines/fusionEngine/`, `src/engines/claimGraph/`, `server/python/api/`  
> **Status:** Production-ready (11-technique universal API surface)

---

## Overview

DIFARYX exposes two API surfaces:

1. **TypeScript Engine API** — the in-process routing, state machine, claim
   graph, and fusion engines consumed by the React frontend.
2. **Python Backend API** — the HTTP gateway for XRD-specific backend
   processing, reference database queries, and general sample assessment.

Both surfaces share the same **Universal Research Evidence** schema defined
in `server/python/api/universal_schemas.py` and mirrored in
`src/types/universalResearchEvidence.ts`.

---

## 1. TypeScript Engine API

### 1.1 Universal Router Engine

**Module:** `src/engines/routerEngine/`

#### `route(request: RouterRequest): Promise<RouterResponse>`

Dispatches a request through the 7-stage evidence pipeline.

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `requestId` | `string` (UUIDv4) | ✅ | Unique request identifier. |
| `technique` | `Technique` | ✅ | One of 11 registered techniques. |
| `researchObjective` | `string` | ✅ | Free-text research goal. |
| `sampleId` | `string` | ✅ | Sample identifier. |
| `rawData` | `RawDataPayload` | ✅ | Normalized data payload. |
| `startStage` | `EvidenceStage` | 🔲 | Default: `'dataset'`. |
| `processingConfig` | `ProcessingConfig` | 🔲 | Override defaults. |
| `requestedAt` | `string` (ISO 8601) | ✅ | Request creation timestamp. |

**Returns:** `RouterResponse`

| Field | Type | Description |
|-------|------|-------------|
| `requestId` | `string` | Original request ID. |
| `technique` | `Technique` | Technique that was routed. |
| `completedStage` | `EvidenceStage` | Stage that was completed. |
| `artifact` | `StageArtifact` | The produced artifact. |
| `hasMoreStages` | `boolean` | Whether additional stages remain. |
| `nextStage` | `EvidenceStage?` | Next stage to execute (if any). |
| `routingDecision` | `RoutingDecision` | Decision metadata. |
| `respondedAt` | `string` (ISO 8601) | Response timestamp. |

#### `registerHandler(handler: TechniqueHandler): void`

Registers a technique-specific handler with the router.

#### `getRegisteredTechniques(): Technique[]`

Returns all techniques with registered handlers.

---

### 1.2 State Machine & Approval Ledger

**Module:** `src/engines/stateMachine/`

#### `UniversalStateMachine`

Thread-safe state machine that tracks workflow execution.

```typescript
class UniversalStateMachine {
  getCurrentState(): StateSnapshot;
  transition(to: WorkflowState, context?: Record<string, unknown>): boolean;
  canTransition(to: WorkflowState): boolean;
}
```

**Workflow States:**

```
idle → routing → stage_executing → stage_complete → awaiting_approval
                                                          ↓
                                                     approved → stage_executing → completed
                                                          ↓
                                                     rejected → idle
```

#### `ApprovalLedger`

Append-only ledger recording every routing decision and parameter change.

```typescript
class ApprovalLedger {
  append(entry: Omit<LedgerEntry, 'entryId' | 'timestamp'>): LedgerEntry;
  getEntries(requestId: string): LedgerEntry[];
  getSummary(requestId: string): LedgerSummary;
  clear(): void;
}
```

**Ledger Entry Types:**

| Type | Description |
|------|-------------|
| `routing_decision` | Router dispatched a request to a handler. |
| `parameter_change` | A processing parameter was modified (e.g., polynomial order). |
| `stage_transition` | Workflow moved between evidence stages. |
| `state_transition` | Workflow state changed (idle → routing, etc.). |
| `approval` | Human or agent approved a stage result. |
| `rejection` | Human or agent rejected a stage result. |
| `error` | An error occurred during processing. |
| `handler_invocation` | A specific handler was invoked. |

---

### 1.3 Claim Graph Engine

**Module:** `src/engines/claimGraph/`

#### `buildClaimGraph(inputs: RawEvidenceInput[]): ClaimGraph`

Constructs a directed claim graph from raw evidence observations.

**Input:** Array of `RawEvidenceInput`:

```typescript
interface RawEvidenceInput {
  technique: Technique;
  peaks: Array<{
    id: string;
    position: number;
    intensity: number;
    label?: string;
    assignment?: string;
    hkl?: string;
  }>;
}
```

**Output:** `ClaimGraph`:

```typescript
interface ClaimGraph {
  evidence_nodes: EvidenceNode[];
  claim_nodes: ClaimNode[];
  relations: EvidenceRelation[];
}
```

**Relation Types:**

| Relation | Description |
|----------|-------------|
| `supports` | Evidence directly supports the claim. |
| `contradicts` | Evidence contradicts the claim. |
| `qualifies` | Evidence adds nuance. |
| `requires` | Claim requires this evidence. |
| `contextualizes` | Evidence provides context without direct support. |

#### `propagate(graph: ClaimGraph): PropagationResult[]`

Propagates evidence through the claim graph to determine claim statuses.

---

### 1.4 Fusion Engine

**Module:** `src/engines/fusionEngine/`

#### `fuseEvidence(input: FusionInput): FusionResult`

Resolves claim statuses across multiple techniques and produces a unified
conclusion.

**Input:** `FusionInput` containing an array of `EvidenceNode`s.

**Output:** `FusionResult`:

```typescript
interface FusionResult {
  conclusion: string;           // Human-readable conclusion
  basis: string[];              // Supporting evidence IDs
  crossTech: string;            // Cross-technique consistency statement
  limitations: string[];        // Known limitations
  decision: string;             // Deterministic decision
  reasoningTrace: ReasoningTraceItem[];  // Full reasoning chain
  highlightedEvidenceIds: string[];      // Key evidence IDs
}
```

---

## 2. Python Backend API

**Module:** `server/python/api/`

### 2.1 Gateway Endpoints

**Base URL:** `http://localhost:8000`

#### `POST /api/xrd/analyze`

Full XRD analysis pipeline.

**Request Body:**

```json
{
  "sample_id": "string",
  "two_theta": [20.0, 20.1, ...],
  "intensity": [100, 150, ...],
  "wavelength": 1.5406,
  "research_objective": "string"
}
```

**Response:** `UniversalResearchEvidence` JSON.

#### `POST /api/xrd/reference-db/search`

Search the XRD reference database.

**Request Body:**

```json
{
  "d_values": [2.52, 2.96, ...],
  "tolerance": 0.02,
  "max_results": 10
}
```

#### `POST /api/general/assess`

General sample assessment for non-XRD techniques.

**Request Body:**

```json
{
  "technique": "string",
  "data": { ... },
  "research_objective": "string"
}
```

---

## 3. Universal Research Evidence Schema

**Python:** `server/python/api/universal_schemas.py`  
**TypeScript:** `src/types/universalResearchEvidence.ts`

Every module produces a `UniversalResearchEvidence` object that adheres to
the 7-stage deterministic workflow:

```python
class UniversalResearchEvidence(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # Metadata
    evidence_id: str
    technique: TechniqueEnum
    sample_id: str
    research_objective: str
    created_at: datetime

    # Stage Artifacts
    dataset: DatasetArtifact
    processing: ProcessingArtifact
    features: FeaturesArtifact
    interpretation: InterpretationArtifact
    comparison: ComparisonArtifact
    gap_analysis: GapAnalysisArtifact
    decision: DecisionArtifact
```

All artifacts use **Pydantic v2** with strict validation:

```python
class ProcessingArtifact(BaseModel):
    model_config = ConfigDict(extra="forbid")
    baseline_corrected: list[float]
    smoothed: list[float]
    normalized: list[float]
    baseline_type: BaselineTypeEnum
    polynomial_order: int
    smoothing_window: int
    normalization_method: NormalizationMethodEnum
    parameters_changed: list[ParameterChangeRecord]
    timestamp: datetime
```

---

## 4. Data Flow Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                     Frontend (React)                          │
│                                                              │
│  TechniqueWorkspace → RouterEngine → TechniqueHandler        │
│       │                    │               │                 │
│       │                    ▼               ▼                 │
│       │            ApprovalLedger    StageArtifact           │
│       │                    │               │                 │
│       ▼                    ▼               ▼                 │
│  MultiTechWorkspace → ClaimGraph → FusionEngine              │
│                              │               │               │
│                              ▼               ▼               │
│                        PropagationResult  FusionResult       │
│                              │               │               │
│                              ▼               ▼               │
│                         NotebookLab ← Decision               │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                     Backend (Python)                          │
│                                                              │
│  FastAPI Gateway → XRD Engine → Reference DB                 │
│       │                                                       │
│       ▼                                                       │
│  General Assessment → UniversalResearchEvidence              │
└──────────────────────────────────────────────────────────────┘
```

---

## 5. Error Handling

| Error | HTTP Status | Description |
|-------|-------------|-------------|
| Invalid technique | 400 | Technique not in `Technique` union. |
| Missing raw data | 422 | Required fields missing from payload. |
| Handler not found | 501 | No handler registered and no generic fallback. |
| Processing failure | 500 | Internal error during stage execution. |

All errors are recorded in the Approval Ledger as `error` entries.