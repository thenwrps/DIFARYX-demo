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
