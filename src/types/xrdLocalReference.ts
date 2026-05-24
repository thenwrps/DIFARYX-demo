/**
 * XRD Local Reference Contract (Phase 7D.1)
 *
 * Frontend contract for uploaded/project-local reference metadata.
 * These are not yet used for backend matching in Phase 7D.1.
 * They remain informational placeholders only.
 */

export type XRDLocalReferenceSourceType = "uploaded_reference" | "project_local_reference";

export type XRDLocalReferenceValidationStatus =
  | "not_uploaded"
  | "uploaded_unvalidated"
  | "validated_for_project"
  | "not_supported_yet";

export interface XRDLocalReferencePeak {
  twoTheta: number;
  relativeIntensity?: number;
  hkl?: string;
  dSpacing?: number;
}

export type XRDLocalReferenceParseStatus =
  | "not_uploaded"
  | "parsed_preview"
  | "parse_error"
  | "not_supported_yet";

export interface XRDLocalReferenceValidation {
  hasTwoTheta: boolean;
  hasAtLeastThreePeaks: boolean;
  hasRelativeIntensity: boolean;
  hasRequiredMetadata: boolean;
  warnings: string[];
  errors: string[];
}

export interface XRDLocalReferenceParseResult {
  sourceFileName: string;
  sourceFileType?: ".csv" | ".txt" | ".xy" | ".dat";
  parsedAt: string;
  status: XRDLocalReferenceParseStatus;
  referenceLabel?: string;
  formula?: string;
  materialFamily?: string;
  elements: string[];
  peaks: XRDLocalReferencePeak[];
  validation: XRDLocalReferenceValidation;
  backendAvailable: false;
  usedForMatching: false;
}

export interface XRDLocalReferenceMetadata {
  id: string;
  label: string;
  sourceType: XRDLocalReferenceSourceType;
  sourceFileName?: string;
  formula?: string;
  materialFamily?: string;
  elements: string[];
  phaseLabel?: string;
  referencePeakCount?: number;
  validationStatus: XRDLocalReferenceValidationStatus;
  backendAvailable: false;
  notes: string[];
}

export function createEmptyXrdLocalReferenceParseResult(): XRDLocalReferenceParseResult {
  return {
    sourceFileName: "",
    parsedAt: new Date(0).toISOString(),
    status: "not_uploaded",
    elements: [],
    peaks: [],
    validation: {
      hasTwoTheta: false,
      hasAtLeastThreePeaks: false,
      hasRelativeIntensity: false,
      hasRequiredMetadata: false,
      warnings: [],
      errors: [],
    },
    backendAvailable: false,
    usedForMatching: false,
  };
}

export function getXrdLocalReferenceValidationStatusLabel(status: XRDLocalReferenceParseStatus): string {
  switch (status) {
    case "not_uploaded":
      return "Not uploaded";
    case "parsed_preview":
      return "Parsed preview";
    case "parse_error":
      return "Parse error";
    case "not_supported_yet":
      return "Backend matching not supported yet";
    default:
      return status;
  }
}

/**
 * Planned local reference registry entries (Phase 7D.1 placeholder).
 * These are not selectable for backend matching yet.
 */
export const PLANNED_XRD_LOCAL_REFERENCES: XRDLocalReferenceMetadata[] = [
  {
    id: "uploaded_reference_placeholder",
    label: "Uploaded Reference Pattern (Planned)",
    sourceType: "uploaded_reference",
    elements: [],
    validationStatus: "not_supported_yet",
    backendAvailable: false,
    notes: [
      "Uploaded local references are planned for a future phase.",
      "They are not used for backend matching yet.",
      "Current backend matching uses active curated reference sets only.",
    ],
  },
  {
    id: "project_local_reference_placeholder",
    label: "Project Local Reference Set (Planned)",
    sourceType: "project_local_reference",
    elements: [],
    validationStatus: "not_supported_yet",
    backendAvailable: false,
    notes: [
      "Project-local reference sets are planned for a future phase.",
      "They are not used for backend matching yet.",
      "Current backend matching uses active curated reference sets only.",
    ],
  },
];
