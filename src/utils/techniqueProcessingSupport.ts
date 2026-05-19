/**
 * Technique Processing Support Status
 *
 * Defines what level of processing/reprocessing support exists for each technique.
 */

export type TechniqueProcessingSupportLevel =
  | 'fully_reprocessable'
  | 'provenance_only'
  | 'metadata_only';

export interface TechniqueProcessingSupport {
  level: TechniqueProcessingSupportLevel;
  label: string;
  canReprocess: boolean;
  description: string;
}

/**
 * Get processing support level for a technique
 */
export function getTechniqueProcessingSupport(
  technique: string,
): TechniqueProcessingSupport {
  const normalizedTechnique = technique.toUpperCase();

  switch (normalizedTechnique) {
    case 'XRD':
      return {
        level: 'fully_reprocessable',
        label: 'Fully reprocessable',
        canReprocess: true,
        description: 'XRD processing is fully wired with parameter support and result updates.',
      };

    case 'RAMAN':
      return {
        level: 'fully_reprocessable',
        label: 'Fully reprocessable',
        canReprocess: true,
        description: 'Raman processing is fully wired with parameter support and result updates.',
      };

    case 'XPS':
      return {
        level: 'fully_reprocessable',
        label: 'Fully reprocessable',
        canReprocess: true,
        description: 'XPS processing is fully wired with parameter support and result updates.',
      };

    case 'FTIR':
      return {
        level: 'fully_reprocessable',
        label: 'Fully reprocessable',
        canReprocess: true,
        description: 'FTIR processing is fully wired with parameter support and result updates.',
      };

    default:
      return {
        level: 'metadata_only',
        label: 'Metadata only',
        canReprocess: false,
        description: 'Technique is not yet supported for reprocessing.',
      };
  }
}

/**
 * Get support level badge class
 */
export function getSupportLevelBadgeClass(
  level: TechniqueProcessingSupportLevel,
): string {
  switch (level) {
    case 'fully_reprocessable':
      return 'bg-green-50 border-green-300 text-green-700';
    case 'provenance_only':
      return 'bg-amber-50 border-amber-300 text-amber-700';
    case 'metadata_only':
      return 'bg-slate-50 border-slate-300 text-slate-600';
  }
}

/**
 * Get validation limitation text for uploaded evidence
 */
export function getUploadedEvidenceValidationText(
  technique: string,
  support: TechniqueProcessingSupport,
): string {
  const techName = technique.toUpperCase();

  if (support.level === 'fully_reprocessable') {
    return `${techName} uploaded evidence is reprocessable with custom parameters; validation remains limited until complementary evidence and project-specific references are reviewed.`;
  }

  if (support.level === 'provenance_only') {
    return `${techName} processing adapter is pending; parameter provenance is preserved but automatic reprocessing is not yet available.`;
  }

  return `${techName} processing support is not yet implemented; evidence remains metadata-only.`;
}
