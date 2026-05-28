/**
 * Universal Technique Type — Single Source of Truth
 *
 * Defines the complete set of 11 characterization modules supported by
 * DIFARYX. This replaces the fragmented Technique types previously found
 * in fusionEngine/types.ts (4 techniques) and claimGraph/types.ts (7
 * techniques).
 *
 * Every engine, router, agent, and schema MUST import Technique from this
 * module to guarantee a unified vocabulary across the platform.
 *
 * @module universalTechnique
 */

// ---------------------------------------------------------------------------
// Core Technique Enum (11 modules)
// ---------------------------------------------------------------------------

/**
 * Complete set of characterization techniques supported by DIFARYX.
 *
 * Organized by measurement domain:
 * - **Diffraction**: XRD
 * - **Spectroscopy**: XPS, FTIR, Raman, XAS, NMR, XRF
 * - **Microscopy**: TEM, SEM
 * - **Surface/Adsorption**: BET, TPD
 */
export type Technique =
  | 'XRD'   // X-ray Diffraction
  | 'XPS'   // X-ray Photoelectron Spectroscopy
  | 'FTIR'  // Fourier-Transform Infrared Spectroscopy
  | 'Raman' // Raman Spectroscopy
  | 'XAS'   // X-ray Absorption Spectroscopy (XANES + EXAFS)
  | 'TEM'   // Transmission Electron Microscopy
  | 'BET'   // Brunauer–Emmet–Teller Surface Area Analysis
  | 'TPD'   // Temperature-Programmed Desorption
  | 'NMR'   // Nuclear Magnetic Resonance
  | 'SEM'   // Scanning Electron Microscopy
  | 'XRF';  // X-ray Fluorescence

// ---------------------------------------------------------------------------
// Technique Domain Classification
// ---------------------------------------------------------------------------

/** Measurement domain grouping for cross-technique reasoning. */
export type TechniqueDomain =
  | 'diffraction'
  | 'spectroscopy'
  | 'microscopy'
  | 'surface_analysis';

/** Maps each technique to its measurement domain. */
export const TECHNIQUE_DOMAIN: Record<Technique, TechniqueDomain> = {
  XRD:  'diffraction',
  XPS:  'spectroscopy',
  FTIR: 'spectroscopy',
  Raman:'spectroscopy',
  XAS:  'spectroscopy',
  NMR:  'spectroscopy',
  XRF:  'spectroscopy',
  TEM:  'microscopy',
  SEM:  'microscopy',
  BET:  'surface_analysis',
  TPD:  'surface_analysis',
};

// ---------------------------------------------------------------------------
// Technique Metadata
// ---------------------------------------------------------------------------

/** Human-readable metadata for each technique module. */
export interface TechniqueMetadata {
  /** Canonical technique identifier. */
  readonly technique: Technique;
  /** Short human-readable label. */
  readonly label: string;
  /** Measurement domain. */
  readonly domain: TechniqueDomain;
  /** Primary physical observable. */
  readonly observable: string;
  /** Standard unit for the primary axis. */
  readonly primaryUnit: string;
  /** Whether the technique is currently active in the router. */
  readonly active: boolean;
}

/** Registry of all 11 technique modules with metadata. */
export const TECHNIQUE_REGISTRY: ReadonlyMap<Technique, TechniqueMetadata> =
  new Map<Technique, TechniqueMetadata>([
    ['XRD', {
      technique: 'XRD',
      label: 'X-ray Diffraction',
      domain: 'diffraction',
      observable: 'crystal structure, phase identification, lattice parameters',
      primaryUnit: '°2θ',
      active: true,
    }],
    ['XPS', {
      technique: 'XPS',
      label: 'X-ray Photoelectron Spectroscopy',
      domain: 'spectroscopy',
      observable: 'elemental composition, oxidation states, chemical bonding',
      primaryUnit: 'eV',
      active: true,
    }],
    ['FTIR', {
      technique: 'FTIR',
      label: 'Fourier-Transform Infrared Spectroscopy',
      domain: 'spectroscopy',
      observable: 'functional groups, molecular vibrations, bonding environment',
      primaryUnit: 'cm⁻¹',
      active: true,
    }],
    ['Raman', {
      technique: 'Raman',
      label: 'Raman Spectroscopy',
      domain: 'spectroscopy',
      observable: 'vibrational modes, molecular symmetry, crystal phonons',
      primaryUnit: 'cm⁻¹',
      active: true,
    }],
    ['XAS', {
      technique: 'XAS',
      label: 'X-ray Absorption Spectroscopy',
      domain: 'spectroscopy',
      observable: 'oxidation state, local coordination, electronic structure',
      primaryUnit: 'eV',
      active: true,
    }],
    ['TEM', {
      technique: 'TEM',
      label: 'Transmission Electron Microscopy',
      domain: 'microscopy',
      observable: 'morphology, particle size, crystal structure (SAED)',
      primaryUnit: 'nm',
      active: true,
    }],
    ['BET', {
      technique: 'BET',
      label: 'Brunauer–Emmet–Teller Surface Area Analysis',
      domain: 'surface_analysis',
      observable: 'specific surface area, pore size distribution',
      primaryUnit: 'm²/g',
      active: true,
    }],
    ['TPD', {
      technique: 'TPD',
      label: 'Temperature-Programmed Desorption',
      domain: 'surface_analysis',
      observable: 'surface active sites, adsorption strength, desorption kinetics',
      primaryUnit: '°C',
      active: true,
    }],
    ['NMR', {
      technique: 'NMR',
      label: 'Nuclear Magnetic Resonance',
      domain: 'spectroscopy',
      observable: 'local atomic environment, molecular structure, dynamics',
      primaryUnit: 'ppm',
      active: false, // Planned for future module
    }],
    ['SEM', {
      technique: 'SEM',
      label: 'Scanning Electron Microscopy',
      domain: 'microscopy',
      observable: 'surface morphology, grain size, elemental mapping (EDS)',
      primaryUnit: 'μm',
      active: false, // Planned for future module
    }],
    ['XRF', {
      technique: 'XRF',
      label: 'X-ray Fluorescence',
      domain: 'spectroscopy',
      observable: 'elemental composition, trace element detection',
      primaryUnit: 'keV',
      active: false, // Planned for future module
    }],
  ]);

// ---------------------------------------------------------------------------
// Utility Functions
// ---------------------------------------------------------------------------

/**
 * Get all active techniques currently enabled in the router.
 *
 * @returns Array of active Technique identifiers.
 *
 * @example
 * ```ts
 * const active = getActiveTechniques();
 * // ['XRD', 'XPS', 'FTIR', 'Raman', 'XAS', 'TEM', 'BET', 'TPD']
 * ```
 */
export function getActiveTechniques(): Technique[] {
  return [...TECHNIQUE_REGISTRY.values()]
    .filter((m) => m.active)
    .map((m) => m.technique);
}

/**
 * Get metadata for a specific technique.
 *
 * @param technique - The technique identifier.
 * @returns TechniqueMetadata or undefined if not registered.
 */
export function getTechniqueMetadata(technique: Technique): TechniqueMetadata | undefined {
  return TECHNIQUE_REGISTRY.get(technique);
}

/**
 * Check if a string is a valid Technique identifier.
 *
 * @param value - String to validate.
 * @returns True if value is a registered Technique.
 */
export function isValidTechnique(value: string): value is Technique {
  return TECHNIQUE_REGISTRY.has(value as Technique);
}

/**
 * Get all techniques belonging to a specific measurement domain.
 *
 * @param domain - The domain to filter by.
 * @returns Array of techniques in the given domain.
 */
export function getTechniquesByDomain(domain: TechniqueDomain): Technique[] {
  return [...TECHNIQUE_REGISTRY.values()]
    .filter((m) => m.domain === domain)
    .map((m) => m.technique);
}

/** All 11 technique identifiers in canonical order. */
export const ALL_TECHNIQUES: readonly Technique[] = [
  'XRD', 'XPS', 'FTIR', 'Raman', 'XAS',
  'TEM', 'BET', 'TPD', 'NMR', 'SEM', 'XRF',
] as const;
