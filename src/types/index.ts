/**
 * Universal Type System — Barrel Export
 *
 * Single import point for all universal types, interfaces, and utilities.
 *
 * @example
 * ```ts
 * import type {
 *   Technique,
 *   UniversalEvidenceNode,
 *   UniversalResearchEvidence,
 * } from '@/types';
 * ```
 *
 * @module types
 */

// ---------------------------------------------------------------------------
// Universal Technique (11 modules)
// ---------------------------------------------------------------------------
export type {
  Technique,
  TechniqueDomain,
  TechniqueMetadata,
} from './universalTechnique';

export {
  TECHNIQUE_DOMAIN,
  TECHNIQUE_REGISTRY,
  getActiveTechniques,
  getTechniqueMetadata,
  isValidTechnique,
  getTechniquesByDomain,
} from './universalTechnique';

// ---------------------------------------------------------------------------
// Universal Evidence Node
// ---------------------------------------------------------------------------
export type {
  ConfidenceLevel,
  SignalQuality,
  EvidenceRole,
  UniversalEvidenceNode,
  XrdEvidenceMetadata,
  XpsEvidenceMetadata,
  FtirEvidenceMetadata,
  RamanEvidenceMetadata,
  XasEvidenceMetadata,
  TemEvidenceMetadata,
  BetEvidenceMetadata,
  TpdEvidenceMetadata,
  NmrEvidenceMetadata,
  SemEvidenceMetadata,
  XrfEvidenceMetadata,
  EvidenceProvenance,
  LegacyFusionEvidenceNode,
  LegacyClaimGraphEvidenceNode,
} from './universalEvidence';

export {
  adaptFromFusionEngine,
  adaptFromClaimGraph,
  toFusionEngineShape,
  toClaimGraphShape,
} from './universalEvidence';

// ---------------------------------------------------------------------------
// Universal Research Evidence (7-stage workflow)
// ---------------------------------------------------------------------------
export type {
  EvidenceStage,
  DatasetArtifact,
  ProcessingArtifact,
  ProcessingStep,
  FeaturesArtifact,
  InterpretationArtifact,
  FeatureInterpretation,
  ReferenceMatch,
  ComparisonArtifact,
  ComparisonResult,
  GapAnalysisArtifact,
  ValidationGap,
  DecisionArtifact,
  NextExperimentRecommendation,
  UniversalResearchEvidence,
} from './universalResearchEvidence';

export {
  EVIDENCE_STAGES,
} from './universalResearchEvidence';

// ---------------------------------------------------------------------------
// Approval Ledger & State Machine (re-exported after Phase 1.3)
// ---------------------------------------------------------------------------
// TODO: Re-export from './universalLedger' after Phase 1.3 implementation
// TODO: Re-export from './universalStateMachine' after Phase 1.3 implementation

// ---------------------------------------------------------------------------
// Legacy Type Re-exports (for backward compatibility during migration)
// ---------------------------------------------------------------------------
// These are intentionally NOT re-exported here. Legacy consumers should
// import directly from their original modules until migrated.