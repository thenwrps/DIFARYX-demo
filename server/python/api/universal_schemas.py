"""
Universal Research Evidence Schemas — Pydantic v2

Defines the Universal Research Evidence format that ALL 11 characterization
modules must adhere to. This is the canonical backend data contract for the
DIFARYX scientific workflow intelligence system.

Every module follows the 7-stage deterministic workflow:
  Stage 0 (Dataset)       → DatasetArtifact
  Stage 1 (Processing)    → ProcessingArtifact
  Stage 2 (Features)      → FeaturesArtifact
  Stage 3 (Interpretation)→ InterpretationArtifact
  Stage 4 (Comparison)    → ComparisonArtifact
  Stage 5 (Gap Analysis)  → GapAnalysisArtifact
  Stage 6 (Decision)      → DecisionArtifact

Design Principles:
  - Technique-agnostic: same schema for XRD, XPS, FTIR, Raman, XAS, etc.
  - Pydantic v2 strict mode with frozen models for immutability.
  - Every artifact is self-contained and auditable.
  - Compatible with the TypeScript frontend UniversalResearchEvidence types.

Author: DIFARYX Core Team
Version: 2.0.0
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Literal, Optional, Tuple, Union

from pydantic import BaseModel, Field, field_validator, model_validator


# ============================================================================
# Technique Registry
# ============================================================================

class Technique(str, Enum):
    """All supported characterization techniques."""
    XRD = "XRD"
    XPS = "XPS"
    FTIR = "FTIR"
    RAMAN = "Raman"
    XAS = "XAS"
    TEM = "TEM"
    BET = "BET"
    TPD = "TPD"
    NMR = "NMR"
    SEM = "SEM"
    XRF = "XRF"


class TechniqueDomain(str, Enum):
    """Scientific domain categories."""
    DIFFRACTION = "diffraction"
    SPECTROSCOPY = "spectroscopy"
    MICROSCOPY = "microscopy"
    SURFACE = "surface"
    THERMAL = "thermal"
    POROSITY = "porosity"


class TechniqueAxisMapping(BaseModel):
    """Axis mapping for a specific technique."""
    primaryAxis: str = Field(description="Primary axis label (e.g., '2θ', 'B.E.', 'Raman Shift')")
    primaryAxisUnit: str = Field(description="Primary axis unit (e.g., '°', 'eV', 'cm⁻¹')")
    valueLabel: str = Field(description="Value axis label (e.g., 'Intensity', 'Counts')")
    valueUnit: str = Field(description="Value axis unit (e.g., 'a.u.', 'counts/s')")


class TechniqueMetadata(BaseModel):
    """Metadata for a registered technique."""
    name: str = Field(description="Technique name")
    domain: TechniqueDomain = Field(description="Scientific domain")
    defaultAxisMapping: TechniqueAxisMapping = Field(description="Default axis mapping")
    complementaryTechniques: List[Technique] = Field(
        default_factory=list,
        description="Techniques recommended for cross-validation",
    )


# Technique registry mapping
TECHNIQUE_REGISTRY: Dict[Technique, TechniqueMetadata] = {
    Technique.XRD: TechniqueMetadata(
        name="X-Ray Diffraction",
        domain=TechniqueDomain.DIFFRACTION,
        defaultAxisMapping=TechniqueAxisMapping(
            primaryAxis="2θ", primaryAxisUnit="°",
            valueLabel="Intensity", valueUnit="a.u.",
        ),
        complementaryTechniques=[Technique.RAMAN, Technique.FTIR, Technique.TEM],
    ),
    Technique.XPS: TechniqueMetadata(
        name="X-Ray Photoelectron Spectroscopy",
        domain=TechniqueDomain.SURFACE,
        defaultAxisMapping=TechniqueAxisMapping(
            primaryAxis="Binding Energy", primaryAxisUnit="eV",
            valueLabel="Intensity", valueUnit="counts/s",
        ),
        complementaryTechniques=[Technique.XAS, Technique.FTIR, Technique.XRF],
    ),
    Technique.FTIR: TechniqueMetadata(
        name="Fourier Transform Infrared Spectroscopy",
        domain=TechniqueDomain.SPECTROSCOPY,
        defaultAxisMapping=TechniqueAxisMapping(
            primaryAxis="Wavenumber", primaryAxisUnit="cm⁻¹",
            valueLabel="Transmittance", valueUnit="%",
        ),
        complementaryTechniques=[Technique.RAMAN, Technique.XRD, Technique.XPS],
    ),
    Technique.RAMAN: TechniqueMetadata(
        name="Raman Spectroscopy",
        domain=TechniqueDomain.SPECTROSCOPY,
        defaultAxisMapping=TechniqueAxisMapping(
            primaryAxis="Raman Shift", primaryAxisUnit="cm⁻¹",
            valueLabel="Intensity", valueUnit="a.u.",
        ),
        complementaryTechniques=[Technique.FTIR, Technique.XRD, Technique.XPS],
    ),
    Technique.XAS: TechniqueMetadata(
        name="X-Ray Absorption Spectroscopy",
        domain=TechniqueDomain.SPECTROSCOPY,
        defaultAxisMapping=TechniqueAxisMapping(
            primaryAxis="Energy", primaryAxisUnit="eV",
            valueLabel="Absorption", valueUnit="a.u.",
        ),
        complementaryTechniques=[Technique.XPS, Technique.XRD, Technique.XRF],
    ),
    Technique.TEM: TechniqueMetadata(
        name="Transmission Electron Microscopy",
        domain=TechniqueDomain.MICROSCOPY,
        defaultAxisMapping=TechniqueAxisMapping(
            primaryAxis="d-spacing", primaryAxisUnit="nm",
            valueLabel="Intensity", valueUnit="a.u.",
        ),
        complementaryTechniques=[Technique.XRD, Technique.SEM, Technique.BET],
    ),
    Technique.BET: TechniqueMetadata(
        name="Brunauer-Emmett-Teller Analysis",
        domain=TechniqueDomain.POROSITY,
        defaultAxisMapping=TechniqueAxisMapping(
            primaryAxis="P/P₀", primaryAxisUnit="",
            valueLabel="Volume adsorbed", valueUnit="cm³/g",
        ),
        complementaryTechniques=[Technique.TEM, Technique.SEM, Technique.TPD],
    ),
    Technique.TPD: TechniqueMetadata(
        name="Temperature Programmed Desorption",
        domain=TechniqueDomain.THERMAL,
        defaultAxisMapping=TechniqueAxisMapping(
            primaryAxis="Temperature", primaryAxisUnit="°C",
            valueLabel="Signal", valueUnit="a.u.",
        ),
        complementaryTechniques=[Technique.BET, Technique.XPS, Technique.FTIR],
    ),
    Technique.NMR: TechniqueMetadata(
        name="Nuclear Magnetic Resonance",
        domain=TechniqueDomain.SPECTROSCOPY,
        defaultAxisMapping=TechniqueAxisMapping(
            primaryAxis="Chemical Shift", primaryAxisUnit="ppm",
            valueLabel="Intensity", valueUnit="a.u.",
        ),
        complementaryTechniques=[Technique.FTIR, Technique.RAMAN, Technique.XRD],
    ),
    Technique.SEM: TechniqueMetadata(
        name="Scanning Electron Microscopy",
        domain=TechniqueDomain.MICROSCOPY,
        defaultAxisMapping=TechniqueAxisMapping(
            primaryAxis="Magnification", primaryAxisUnit="×",
            valueLabel="Signal", valueUnit="a.u.",
        ),
        complementaryTechniques=[Technique.TEM, Technique.XRD, Technique.BET],
    ),
    Technique.XRF: TechniqueMetadata(
        name="X-Ray Fluorescence",
        domain=TechniqueDomain.SPECTROSCOPY,
        defaultAxisMapping=TechniqueAxisMapping(
            primaryAxis="Energy", primaryAxisUnit="keV",
            valueLabel="Intensity", valueUnit="counts",
        ),
        complementaryTechniques=[Technique.XPS, Technique.XAS, Technique.XRD],
    ),
}


def get_technique_metadata(technique: Technique) -> Optional[TechniqueMetadata]:
    """Get metadata for a registered technique."""
    return TECHNIQUE_REGISTRY.get(technique)


# ============================================================================
# Common Enums
# ============================================================================

class SignalQuality(str, Enum):
    """Signal quality assessment."""
    EXCELLENT = "excellent"
    GOOD = "good"
    MARGINAL = "marginal"
    WEAK = "weak"
    INSUFFICIENT = "insufficient"


class ConfidenceLevel(str, Enum):
    """Confidence level for interpretations."""
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    UNCERTAIN = "uncertain"


class EvidenceStage(str, Enum):
    """The 7 stages of the deterministic evidence workflow."""
    DATASET = "dataset"
    PROCESSING = "processing"
    FEATURES = "features"
    INTERPRETATION = "interpretation"
    COMPARISON = "comparison"
    GAP_ANALYSIS = "gap_analysis"
    DECISION = "decision"


# Canonical stage sequence
EVIDENCE_STAGES: List[EvidenceStage] = [
    EvidenceStage.DATASET,
    EvidenceStage.PROCESSING,
    EvidenceStage.FEATURES,
    EvidenceStage.INTERPRETATION,
    EvidenceStage.COMPARISON,
    EvidenceStage.GAP_ANALYSIS,
    EvidenceStage.DECISION,
]


# ============================================================================
# Stage Artifacts
# ============================================================================

class EvidenceProvenance(BaseModel):
    """Provenance metadata for an evidence node."""
    datasetId: str = Field(description="ID of the source dataset")
    sampleName: Optional[str] = Field(default=None, description="Sample name")
    processingHash: Optional[str] = Field(default=None, description="Hash of processing parameters")
    createdAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    model_config = {"frozen": True}


class UniversalEvidenceNode(BaseModel):
    """
    Universal evidence node representing a detected feature.

    This is the fundamental unit of scientific evidence in DIFARYX,
    used across all 11 characterization modules.
    """
    id: str = Field(description="Unique identifier for this evidence node")
    technique: Technique = Field(description="Source technique")
    primaryAxis: float = Field(description="Position on the primary axis")
    primaryAxisUnit: str = Field(description="Unit of the primary axis")
    value: float = Field(description="Measurement value")
    valueUnit: str = Field(description="Unit of the value")
    label: str = Field(description="Human-readable label")
    role: Literal["primary", "secondary", "reference"] = Field(
        default="primary",
        description="Role of this evidence in the analysis",
    )
    confidence: Optional[ConfidenceLevel] = Field(default=None)
    provenance: Optional[EvidenceProvenance] = Field(default=None)

    model_config = {"frozen": True}


class ProcessingStep(BaseModel):
    """A single processing step applied to the data."""
    operation: str = Field(description="Operation name (e.g., 'baseline_correction')")
    algorithm: str = Field(description="Algorithm used")
    parameters: Dict[str, Any] = Field(default_factory=dict)
    executedAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    description: str = Field(description="Human-readable description")

    model_config = {"frozen": True}


class FeatureInterpretation(BaseModel):
    """Interpretation of a single detected feature."""
    featureId: str = Field(description="ID of the interpreted feature")
    assignment: str = Field(description="Scientific assignment (e.g., 'Si (111)')")
    confidence: ConfidenceLevel = Field(description="Confidence in this assignment")
    reasoning: str = Field(description="Reasoning for the assignment")
    references: List[str] = Field(default_factory=list, description="Reference citations")

    model_config = {"frozen": True}


class ValidationGap(BaseModel):
    """A validation gap identified in the evidence chain."""
    gapId: str = Field(description="Unique identifier for this gap")
    category: str = Field(description="Gap category")
    severity: Literal["critical", "major", "minor"] = Field(description="Severity level")
    description: str = Field(description="Human-readable description")
    recommendedAction: str = Field(description="Recommended action to resolve")
    suggestedTechniques: List[Technique] = Field(
        default_factory=list,
        description="Techniques that could resolve this gap",
    )

    model_config = {"frozen": True}


class ComparisonResult(BaseModel):
    """Result of comparing evidence against reference data."""
    subject: str = Field(description="Subject being compared")
    reference: str = Field(description="Reference used")
    deviation: float = Field(description="Deviation from reference")
    deviationUnit: str = Field(description="Unit of deviation")
    withinTolerance: bool = Field(description="Whether within tolerance")
    toleranceThreshold: float = Field(description="Tolerance threshold")
    interpretation: str = Field(description="Interpretation of comparison")

    model_config = {"frozen": True}


# ============================================================================
# Stage Artifact Models
# ============================================================================

class DatasetArtifact(BaseModel):
    """Stage 0: Validated and ingested raw data."""
    stage: Literal[EvidenceStage.DATASET] = Field(default=EvidenceStage.DATASET)
    technique: Technique
    domain: TechniqueDomain
    sourceName: str = Field(description="Source file or dataset name")
    format: str = Field(description="Data format (e.g., 'xy_pairs')")
    pointCount: int = Field(ge=0, description="Number of data points")
    primaryAxisRange: Tuple[float, float] = Field(description="[min, max] of primary axis")
    primaryAxisUnit: str = Field(description="Unit of primary axis")
    signalQuality: SignalQuality
    dataHash: str = Field(description="Deterministic hash of the data")
    ingestedAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    warnings: List[str] = Field(default_factory=list)

    model_config = {"frozen": True}


class ProcessingArtifact(BaseModel):
    """Stage 1: Processed data with all steps documented."""
    stage: Literal[EvidenceStage.PROCESSING] = Field(default=EvidenceStage.PROCESSING)
    technique: Technique
    steps: List[ProcessingStep] = Field(description="Processing steps applied")
    outputQuality: SignalQuality = Field(description="Quality after processing")
    processedDataHash: str = Field(description="Hash of processed data")
    processedAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    model_config = {"frozen": True}


class FeaturesArtifact(BaseModel):
    """Stage 2: Detected features (peaks, bands, edges)."""
    stage: Literal[EvidenceStage.FEATURES] = Field(default=EvidenceStage.FEATURES)
    technique: Technique
    features: List[UniversalEvidenceNode] = Field(description="Detected features")
    featureCount: int = Field(ge=0, description="Total features detected")
    detectionAlgorithm: str = Field(description="Detection algorithm used")
    detectionParameters: Dict[str, Any] = Field(default_factory=dict)
    detectedAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    model_config = {"frozen": True}


class InterpretationArtifact(BaseModel):
    """Stage 3: Feature interpretations and assignments."""
    stage: Literal[EvidenceStage.INTERPRETATION] = Field(default=EvidenceStage.INTERPRETATION)
    technique: Technique
    interpretations: List[FeatureInterpretation] = Field(description="Feature interpretations")
    referenceDatabase: str = Field(description="Reference database used")
    interpretedCount: int = Field(ge=0, description="Number of features interpreted")
    overallConfidence: ConfidenceLevel = Field(description="Overall confidence level")
    interpretedAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    model_config = {"frozen": True}


class ComparisonArtifact(BaseModel):
    """Stage 4: Reference comparison results."""
    stage: Literal[EvidenceStage.COMPARISON] = Field(default=EvidenceStage.COMPARISON)
    technique: Technique
    comparisonType: str = Field(description="Type of comparison performed")
    results: List[ComparisonResult] = Field(description="Comparison results")
    consistencyScore: float = Field(ge=0.0, le=1.0, description="Consistency score")
    comparedAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    model_config = {"frozen": True}


class GapAnalysisArtifact(BaseModel):
    """Stage 5: Validation gap analysis."""
    stage: Literal[EvidenceStage.GAP_ANALYSIS] = Field(default=EvidenceStage.GAP_ANALYSIS)
    technique: Technique
    gaps: List[ValidationGap] = Field(description="Identified validation gaps")
    gapCount: int = Field(ge=0, description="Total gaps identified")
    criticalGapsResolved: bool = Field(description="Whether all critical gaps are resolved")
    analyzedAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    model_config = {"frozen": True}


class NextExperimentRecommendation(BaseModel):
    """Recommendation for the next experiment."""
    technique: Technique = Field(description="Recommended technique")
    rationale: str = Field(description="Why this technique is recommended")
    suggestedParameters: Dict[str, Any] = Field(default_factory=dict)
    expectedOutcome: str = Field(description="Expected outcome of the experiment")
    priority: Literal["high", "medium", "low"] = Field(description="Priority level")

    model_config = {"frozen": True}


class DecisionArtifact(BaseModel):
    """Stage 6: Scientific decision or next-experiment recommendation."""
    stage: Literal[EvidenceStage.DECISION] = Field(default=EvidenceStage.DECISION)
    decision: str = Field(description="The decision or conclusion")
    decisionType: Literal["conclusion", "next_experiment", "inconclusive"] = Field(
        description="Type of decision"
    )
    confidence: ConfidenceLevel = Field(description="Confidence in the decision")
    evidenceSummary: str = Field(description="Summary of supporting evidence")
    caveats: List[str] = Field(default_factory=list, description="Known caveats")
    nextExperiment: Optional[NextExperimentRecommendation] = Field(
        default=None,
        description="Recommended next experiment (if applicable)",
    )
    decidedAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    model_config = {"frozen": True}


# ============================================================================
# Universal Research Evidence (aggregated)
# ============================================================================

class UniversalResearchEvidence(BaseModel):
    """
    Complete research evidence aggregating all 7 stages.

    This is the top-level container for a single technique analysis run.
    It is self-contained, auditable, and designed for cross-module fusion.
    """
    evidenceId: str = Field(description="Unique evidence identifier (UUIDv4)")
    schemaVersion: str = Field(default="2.0.0", description="Schema version")
    technique: Technique = Field(description="Source technique")
    researchObjective: str = Field(description="The research objective")
    sampleId: str = Field(description="Sample identifier")
    requestId: str = Field(description="Router request ID")

    # Stage artifacts (populated as the workflow progresses)
    dataset: Optional[DatasetArtifact] = None
    processing: Optional[ProcessingArtifact] = None
    features: Optional[FeaturesArtifact] = None
    interpretation: Optional[InterpretationArtifact] = None
    comparison: Optional[ComparisonArtifact] = None
    gapAnalysis: Optional[GapAnalysisArtifact] = None
    decision: Optional[DecisionArtifact] = None

    # Metadata
    createdAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    completedAt: Optional[str] = None
    totalTimeMs: Optional[float] = None

    @model_validator(mode="after")
    def _compute_completion(self) -> "UniversalResearchEvidence":
        """Set completedAt if all stages are present."""
        if all([
            self.dataset, self.processing, self.features,
            self.interpretation, self.comparison,
            self.gapAnalysis, self.decision,
        ]):
            if self.completedAt is None:
                object.__setattr__(self, "completedAt", datetime.now(timezone.utc).isoformat())
        return self

    @property
    def is_complete(self) -> bool:
        """Whether all 7 stages have been completed."""
        return all([
            self.dataset is not None,
            self.processing is not None,
            self.features is not None,
            self.interpretation is not None,
            self.comparison is not None,
            self.gapAnalysis is not None,
            self.decision is not None,
        ])

    @property
    def completed_stages(self) -> List[EvidenceStage]:
        """List of completed stages."""
        stages = []
        if self.dataset: stages.append(EvidenceStage.DATASET)
        if self.processing: stages.append(EvidenceStage.PROCESSING)
        if self.features: stages.append(EvidenceStage.FEATURES)
        if self.interpretation: stages.append(EvidenceStage.INTERPRETATION)
        if self.comparison: stages.append(EvidenceStage.COMPARISON)
        if self.gapAnalysis: stages.append(EvidenceStage.GAP_ANALYSIS)
        if self.decision: stages.append(EvidenceStage.DECISION)
        return stages

    @property
    def feature_count(self) -> int:
        """Total features detected."""
        return self.features.featureCount if self.features else 0

    @property
    def validation_gaps(self) -> List[ValidationGap]:
        """All identified validation gaps."""
        return self.gapAnalysis.gaps if self.gapAnalysis else []

    @property
    def has_critical_gaps(self) -> bool:
        """Whether there are unresolved critical gaps."""
        if not self.gapAnalysis:
            return True
        return not self.gapAnalysis.criticalGapsResolved

    model_config = {"frozen": True}


# ============================================================================
# Router Request/Response Schemas
# ============================================================================

class RawDataPayload(BaseModel):
    """Raw data payload for the router."""
    primaryAxis: List[float] = Field(description="Primary axis values")
    values: List[float] = Field(description="Measurement values")
    format: Literal["xy_pairs", "csv", "json"] = Field(default="xy_pairs")
    fileName: Optional[str] = Field(default=None)
    primaryAxisUnit: Optional[str] = Field(default=None)
    valueUnit: Optional[str] = Field(default=None)

    @model_validator(mode="after")
    def _validate_lengths(self) -> "RawDataPayload":
        if len(self.primaryAxis) != len(self.values):
            raise ValueError(
                f"Axis length mismatch: primaryAxis has {len(self.primaryAxis)} points, "
                f"values has {len(self.values)} points"
            )
        return self


class ProcessingConfig(BaseModel):
    """Processing configuration for the router."""
    baselineAlgorithm: Optional[str] = Field(default=None)
    polynomialOrder: Optional[int] = Field(default=None, ge=1, le=10)
    smoothingAlgorithm: Optional[str] = Field(default=None)
    smoothingWindow: Optional[int] = Field(default=None, ge=3, le=101)
    normalizationMethod: Optional[str] = Field(default=None)
    detectionSensitivity: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    minPeakHeight: Optional[float] = Field(default=None, ge=0.0, le=1.0)


class UniversalRouterRequest(BaseModel):
    """Universal router request schema."""
    requestId: str = Field(description="Unique request ID (UUIDv4)")
    technique: Technique = Field(description="Characterization technique")
    researchObjective: str = Field(description="The research objective")
    sampleId: str = Field(description="Sample identifier")
    rawData: RawDataPayload = Field(description="Raw data payload")
    processingConfig: Optional[ProcessingConfig] = Field(
        default=None,
        description="Processing configuration overrides",
    )
    startStage: Optional[EvidenceStage] = Field(
        default=None,
        description="Stage to start from (default: dataset)",
    )
    requestedAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class RoutingDecision(BaseModel):
    """Record of a routing decision."""
    decisionId: str = Field(description="Unique decision ID")
    technique: Technique
    domain: TechniqueDomain
    stage: EvidenceStage
    handlerId: str = Field(description="Handler that processed this stage")
    usedTechniqueHandler: bool = Field(description="Whether a technique-specific handler was used")
    processingTimeMs: float = Field(description="Processing time in milliseconds")
    warnings: List[str] = Field(default_factory=list)
    decidedAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class UniversalRouterResponse(BaseModel):
    """Universal router response schema."""
    requestId: str = Field(description="Original request ID")
    technique: Technique = Field(description="Technique processed")
    completedStage: EvidenceStage = Field(description="Last completed stage")
    artifact: Union[
        DatasetArtifact,
        ProcessingArtifact,
        FeaturesArtifact,
        InterpretationArtifact,
        ComparisonArtifact,
        GapAnalysisArtifact,
        DecisionArtifact,
    ] = Field(description="Stage artifact produced")
    hasMoreStages: bool = Field(description="Whether more stages remain")
    nextStage: Optional[EvidenceStage] = Field(default=None)
    routingDecision: RoutingDecision = Field(description="Routing decision metadata")
    respondedAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


# ============================================================================
# Multi-Technique Fusion Schemas
# ============================================================================

class ConsistencyCheck(BaseModel):
    """Result of a cross-technique consistency check."""
    checkId: str = Field(description="Unique check ID")
    techniques: List[Technique] = Field(description="Techniques involved")
    consistencyType: str = Field(description="Type of consistency check")
    isConsistent: bool = Field(description="Whether evidence is consistent")
    details: str = Field(description="Human-readable details")
    confidence: ConfidenceLevel = Field(description="Confidence in the check")


class CrossTechniqueValidation(BaseModel):
    """Cross-technique validation result."""
    validationId: str = Field(description="Unique validation ID")
    techniques: List[Technique] = Field(description="Techniques validated")
    consistencyChecks: List[ConsistencyCheck] = Field(description="Individual checks")
    overallConsistency: float = Field(ge=0.0, le=1.0, description="Overall consistency score")
    validatedAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class MultiTechniqueEvidence(BaseModel):
    """
    Multi-technique evidence combining results from multiple modules.

    This is the top-level container for cross-technique analysis,
    used by the /workspace/multi route.
    """
    fusionId: str = Field(description="Unique fusion ID")
    researchObjective: str = Field(description="The research objective")
    sampleId: str = Field(description="Sample identifier")
    techniques: List[Technique] = Field(description="Techniques included")
    evidence: List[UniversalResearchEvidence] = Field(description="Individual evidence objects")
    crossValidation: Optional[CrossTechniqueValidation] = Field(default=None)
    fusionSummary: str = Field(default="", description="Fused interpretation summary")
    createdAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    @property
    def all_techniques_complete(self) -> bool:
        """Whether all techniques have completed all 7 stages."""
        return all(e.is_complete for e in self.evidence)

    @property
    def total_features(self) -> int:
        """Total features across all techniques."""
        return sum(e.feature_count for e in self.evidence)

    @property
    def all_validation_gaps(self) -> List[ValidationGap]:
        """All validation gaps across all techniques."""
        gaps = []
        for e in self.evidence:
            gaps.extend(e.validation_gaps)
        return gaps


# ============================================================================
# Ledger Schemas
# ============================================================================

class LedgerEntryType(str, Enum):
    """Types of ledger entries."""
    ROUTING_DECISION = "routing_decision"
    PARAMETER_CHANGE = "parameter_change"
    STAGE_TRANSITION = "stage_transition"
    STATE_TRANSITION = "state_transition"
    APPROVAL = "approval"
    REJECTION = "rejection"
    ERROR = "error"
    HANDLER_INVOCATION = "handler_invocation"


class LedgerSeverity(str, Enum):
    """Severity of a ledger entry."""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class LedgerEntry(BaseModel):
    """A single entry in the Local Approval Preview Ledger."""
    entryId: str = Field(description="Unique entry identifier")
    entryType: LedgerEntryType = Field(description="Type of entry")
    severity: LedgerSeverity = Field(description="Severity level")
    requestId: str = Field(description="Request ID")
    technique: Technique = Field(description="Technique")
    stage: Optional[EvidenceStage] = Field(default=None, description="Stage")
    description: str = Field(description="Human-readable description")
    parameterName: Optional[str] = Field(default=None)
    previousValue: Optional[Any] = Field(default=None)
    newValue: Optional[Any] = Field(default=None)
    handlerId: Optional[str] = Field(default=None)
    metadata: Optional[Dict[str, Any]] = Field(default=None)
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    model_config = {"frozen": True}


# ============================================================================
# Workflow State Schemas
# ============================================================================

class WorkflowState(str, Enum):
    """Valid workflow states."""
    IDLE = "idle"
    ROUTING = "routing"
    STAGE_EXECUTING = "stage_executing"
    STAGE_COMPLETE = "stage_complete"
    AWAITING_APPROVAL = "awaiting_approval"
    APPROVED = "approved"
    REJECTED = "rejected"
    ERROR = "error"
    COMPLETED = "completed"


class StateSnapshot(BaseModel):
    """A snapshot of the workflow state machine."""
    state: WorkflowState = Field(description="Current state")
    requestId: str = Field(description="Request ID")
    technique: Technique = Field(description="Technique")
    currentStage: Optional[EvidenceStage] = Field(default=None)
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    context: Optional[Dict[str, Any]] = Field(default=None)


# ============================================================================
# Utility Functions
# ============================================================================

def compute_data_hash(data: List[float]) -> str:
    """Compute a deterministic SHA-256 hash of numeric data."""
    serialized = ",".join(f"{v:.8f}" for v in data)
    return hashlib.sha256(serialized.encode()).hexdigest()[:16]


def create_evidence_id() -> str:
    """Generate a unique evidence ID."""
    import uuid
    return f"ev-{uuid.uuid4().hex[:12]}"


def create_request_id() -> str:
    """Generate a unique request ID."""
    import uuid
    return f"req-{uuid.uuid4().hex[:12]}"