/**
 * Safe uploaded evidence project context factory
 * Creates complete project-like structures from uploaded evidence snapshots
 * to allow uploaded evidence to work as first-class context without crashing
 */

import type { ProjectEvidenceSnapshot } from './evidenceSnapshot';
import type { RegistryProject, TechniqueId } from '../data/demoProjectRegistry';
import type { DemoProject, JobType, ClaimStatus, ValidationState, Technique } from '../data/demoProjects';

/**
 * Create a safe RegistryProject-like object from uploaded evidence snapshot
 * Provides all required fields to prevent crashes in Agent/Notebook/Report
 */
export function createUploadedEvidenceRegistryProject(
  snapshot: ProjectEvidenceSnapshot
): RegistryProject {
  const uploadedId = snapshot.projectId || 'uploaded-evidence-temp';
  const uploadedName = snapshot.activeDataset?.fileName ?? snapshot.sampleIdentity ?? 'Uploaded Evidence';
  const uploadedTechniques = snapshot.availableTechniques as Technique[];
  const primaryTech = uploadedTechniques[0] ?? 'XRD';
  const primaryTechniqueId = primaryTech.toLowerCase() as TechniqueId;
  const graphData = snapshot.activeDataset?.dataPoints ?? [];
  const graphPeaks = snapshot.activeDataset?.detectedFeatures.map((feature) => ({
    position: feature.position,
    intensity: feature.intensity,
    label: feature.label,
  })) ?? [];
  const graphSource = {
    kind: 'graph' as const,
    type: primaryTechniqueId,
    xLabel: snapshot.activeDataset?.xLabel ?? 'Position',
    yLabel: snapshot.activeDataset?.yLabel ?? 'Intensity',
    data: graphData,
    peaks: graphPeaks,
  };

  // Create minimal but complete RawDemoProject
  const rawProject: DemoProject = {
    id: uploadedId,
    name: uploadedName,
    material: snapshot.sampleIdentity ?? 'Unknown material',
    objective: `Analyze uploaded ${primaryTech} evidence`,
    jobType: 'research' as JobType,
    techniques: uploadedTechniques,
    techniqueMetadata: uploadedTechniques.map((tech) => ({
      key: tech,
      label: tech,
      role: tech === 'XRD' ? 'Bulk phase' : tech === 'XPS' ? 'Surface state' : tech === 'FTIR' ? 'Bonding' : 'Vibrational',
      status: 'ready' as const,
      dataAvailable: true,
    })),
    evidenceSources: [],
    status: 'active',
    claimStatus: 'partial' as ClaimStatus,
    validationState: 'limited' as ValidationState,
    phase: 'Unknown',
    lastUpdated: new Date().toISOString(),
    createdDate: new Date().toISOString(),
    summary: `User-uploaded ${primaryTech} evidence from ${uploadedName}`,
    xrdPeaks: graphPeaks,
    evidence: snapshot.evidenceEntries.map((entry) => entry.support),
    validationGaps: snapshot.validationGaps ?? [],
    nextDecisions: [
      {
        id: 'uploaded-validation',
        label: 'Additional validation required for uploaded evidence',
        description: 'Review validation scope and attach to project if needed',
        urgency: 'medium' as const,
      },
    ],
    recommendations: ['Review validation scope and attach to project if needed'],
    reportReadiness: {
      notebookReady: true,
      exportReady: true,
      readinessPercent: 80,
      label: 'Ready (validation-limited)',
    },
    notebook: {
      title: `${uploadedName} Analysis`,
      pipeline: ['Upload', 'Parse', 'Feature extraction'],
      peakDetection: 'Completed',
      phaseIdentification: 'Limited (uploaded evidence)',
    },
    history: [],
    workspace: 'xrd',
  };

  // Create complete RegistryProject
  const registryProject: RegistryProject = {
    id: uploadedId,
    title: uploadedName,
    materialSystem: snapshot.sampleIdentity ?? 'Unknown',
    jobType: 'research',
    createdLabel: 'Uploaded',
    statusLabel: 'User evidence',
    claimStatus: 'validation_limited',
    reportReadiness: 80,
    validationGapCount: (snapshot.validationGaps?.length ?? 0) + 1,
    decisionPendingCount: 1,
    objective: `Analyze uploaded ${primaryTech} evidence`,
    context: {
      materialSystem: snapshot.sampleIdentity ?? 'Unknown',
      sampleDescription: `User-uploaded ${primaryTech} data from ${uploadedName}`,
      experimentalSetup: 'External upload',
      datasetSources: [uploadedName],
    },
    techniques: uploadedTechniques.map((tech) => ({
      id: tech.toLowerCase() as any,
      label: tech,
      role: tech === 'XRD' ? 'Bulk phase identification' : tech === 'XPS' ? 'Surface state analysis' : tech === 'FTIR' ? 'Bonding analysis' : 'Vibrational mode analysis',
      available: true,
      datasetLabel: uploadedName,
      description: `User-uploaded ${tech} data`,
      parameters: [],
    })),
    primaryTechnique: primaryTechniqueId,
    selectedTechniques: uploadedTechniques.map((tech) => tech.toLowerCase() as any),
    graphPreview: graphSource,
    workspaceGraphs: {
      [primaryTechniqueId]: graphSource,
    },
    evidenceSummary: `Uploaded ${primaryTech} evidence with ${snapshot.evidenceEntries?.length ?? 0} dataset(s)`,
    evidenceResults: [],
    crossTechniqueComparison: {
      agreementLevel: 'limited' as const,
      agreementSummary: 'Single-technique uploaded evidence',
      matrix: [],
      missingEvidence: ['Additional techniques needed for cross-validation'],
      validationGap: 'Multi-technique validation required',
      recommendedNextAction: 'Add additional techniques for cross-validation',
      references: [],
    },
    agentWorkflow: {
      trace: [],
      claimBoundary: {
        supported: [],
        validationLimited: ['Uploaded evidence requires validation'],
        cannotConclude: [],
        requiredNext: ['Additional validation required'],
      },
      nextDecisionLabel: 'Review validation scope',
    },
    notebook: {
      title: `${uploadedName} Analysis`,
      objective: `Analyze uploaded ${primaryTech} evidence`,
      evidenceBasis: [`Uploaded ${primaryTech} data`],
      interpretation: 'Uploaded evidence - validation pending',
      validationGap: 'Additional validation required',
      decision: 'Review and validate uploaded evidence',
      reportDraft: `User-uploaded ${primaryTech} evidence from ${uploadedName}`,
      missingReferences: ['Validation references needed'],
      claimStatus: 'validation_limited' as any,
      validationBoundary: 'Uploaded evidence remains validation-limited until attached to project',
    },
    experimentHistory: [],
    workflowPath: ['objective', 'evidence', 'gap'],
    _raw: rawProject,
  };

  return registryProject;
}

/**
 * Get safe project techniques from uploaded registry project
 */
export function getUploadedProjectTechniques(
  registryProject: RegistryProject
): Technique[] {
  return (registryProject._raw?.techniques ?? []) as Technique[];
}

/**
 * Check if a project ID indicates uploaded evidence context
 */
export function isUploadedEvidenceProjectId(projectId: string): boolean {
  return projectId === 'uploaded-evidence-temp' || projectId.startsWith('uploaded:');
}
