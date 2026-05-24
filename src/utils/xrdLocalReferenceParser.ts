import type {
  XRDLocalReferenceParseResult,
  XRDLocalReferencePeak,
} from '../types/xrdLocalReference';

const LOCAL_REFERENCE_BACKEND_WARNING = 'Local references are not used for backend matching yet.';

const TWO_THETA_COLUMNS = new Set(['two_theta', '2theta', '2_theta', 'twotheta', 'two-theta', 'position', 'angle']);
const RELATIVE_INTENSITY_COLUMNS = new Set(['relative_intensity', 'rel_intensity', 'rel-intensity', 'relativeintensity', 'intensity']);
const HKL_COLUMNS = new Set(['hkl', 'miller_index', 'miller_indices']);
const D_SPACING_COLUMNS = new Set(['d_spacing', 'd-spacing', 'dspacing', 'd']);

type ColumnKey = 'twoTheta' | 'relativeIntensity' | 'hkl' | 'dSpacing';

type ColumnIndexes = Partial<Record<ColumnKey, number>>;

function getSourceFileType(sourceFileName: string): XRDLocalReferenceParseResult['sourceFileType'] {
  const extension = sourceFileName.match(/\.[^.]+$/)?.[0]?.toLowerCase();
  if (extension === '.csv' || extension === '.txt' || extension === '.xy' || extension === '.dat') {
    return extension;
  }
  return undefined;
}

function normalizeHeaderToken(token: string) {
  return token
    .trim()
    .replace(/^\uFEFF/, '')
    .replace(/^["']|["']$/g, '')
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[°()]/g, '');
}

function splitReferenceLine(line: string) {
  const trimmed = line.trim();
  if (trimmed.includes(',')) {
    return trimmed.split(',').map((token) => token.trim());
  }
  if (trimmed.includes('\t')) {
    return trimmed.split('\t').map((token) => token.trim());
  }
  return trimmed.split(/\s+/).map((token) => token.trim());
}

function getHeaderColumn(token: string): ColumnKey | null {
  const normalized = normalizeHeaderToken(token);
  if (TWO_THETA_COLUMNS.has(normalized)) return 'twoTheta';
  if (RELATIVE_INTENSITY_COLUMNS.has(normalized)) return 'relativeIntensity';
  if (HKL_COLUMNS.has(normalized)) return 'hkl';
  if (D_SPACING_COLUMNS.has(normalized)) return 'dSpacing';
  return null;
}

function buildHeaderIndexes(tokens: string[]) {
  return tokens.reduce<ColumnIndexes>((indexes, token, index) => {
    const column = getHeaderColumn(token);
    if (column && indexes[column] === undefined) {
      indexes[column] = index;
    }
    return indexes;
  }, {});
}

function parseFiniteNumber(value: string | undefined) {
  if (value === undefined) return undefined;
  const cleaned = value
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/[°]/g, '');
  if (!cleaned) return undefined;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function getStringValue(value: string | undefined) {
  const cleaned = value?.trim().replace(/^["']|["']$/g, '');
  return cleaned || undefined;
}

function parsePeak(tokens: string[], indexes: ColumnIndexes): XRDLocalReferencePeak | null {
  const twoTheta = parseFiniteNumber(tokens[indexes.twoTheta ?? 0]);
  if (twoTheta === undefined) return null;

  const relativeIntensityIndex = indexes.relativeIntensity ?? 1;
  const hklIndex = indexes.hkl ?? 2;
  const dSpacingIndex = indexes.dSpacing ?? 3;
  const relativeIntensity = parseFiniteNumber(tokens[relativeIntensityIndex]);
  const hkl = getStringValue(tokens[hklIndex]);
  const dSpacing = parseFiniteNumber(tokens[dSpacingIndex]);

  return {
    twoTheta,
    ...(relativeIntensity !== undefined ? { relativeIntensity } : {}),
    ...(hkl ? { hkl } : {}),
    ...(dSpacing !== undefined ? { dSpacing } : {}),
  };
}

function buildValidation(peaks: XRDLocalReferencePeak[], errors: string[]) {
  const hasTwoTheta = peaks.length > 0;
  const hasAtLeastThreePeaks = peaks.length >= 3;
  const hasRelativeIntensity = peaks.some((peak) => Number.isFinite(peak.relativeIntensity));
  const hasRequiredMetadata = false;
  const warnings: string[] = [];

  if (!hasRelativeIntensity) warnings.push('Missing relative intensity values.');
  if (!hasAtLeastThreePeaks) warnings.push('Fewer than 3 peaks were parsed.');
  if (!hasRequiredMetadata) warnings.push('Reference metadata was not supplied.');
  warnings.push(LOCAL_REFERENCE_BACKEND_WARNING);

  return {
    hasTwoTheta,
    hasAtLeastThreePeaks,
    hasRelativeIntensity,
    hasRequiredMetadata,
    warnings,
    errors,
  };
}

export function parseXrdLocalReferenceText(text: string, sourceFileName: string): XRDLocalReferenceParseResult {
  const parsedAt = new Date().toISOString();
  const sourceFileType = getSourceFileType(sourceFileName);
  const baseResult = {
    sourceFileName,
    ...(sourceFileType ? { sourceFileType } : {}),
    parsedAt,
    referenceLabel: sourceFileName.replace(/\.[^.]+$/, '') || undefined,
    elements: [],
    backendAvailable: false as const,
    usedForMatching: false as const,
  };

  if (!sourceFileType) {
    const errors = ['Unsupported file type. Accepted formats are .csv, .txt, .xy, and .dat.'];
    return {
      ...baseResult,
      status: 'parse_error',
      peaks: [],
      validation: buildValidation([], errors),
    };
  }

  if (!text.trim()) {
    const errors = ['Unsupported or empty file.'];
    return {
      ...baseResult,
      status: 'parse_error',
      peaks: [],
      validation: buildValidation([], errors),
    };
  }

  if (text.includes('\u0000')) {
    const errors = ['Binary file content is not supported for local reference preview.'];
    return {
      ...baseResult,
      status: 'parse_error',
      peaks: [],
      validation: buildValidation([], errors),
    };
  }

  const contentLines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && !line.startsWith('//'));

  if (contentLines.length === 0) {
    const errors = ['Unsupported or empty file.'];
    return {
      ...baseResult,
      status: 'parse_error',
      peaks: [],
      validation: buildValidation([], errors),
    };
  }

  const firstTokens = splitReferenceLine(contentLines[0]);
  const headerIndexes = buildHeaderIndexes(firstTokens);
  const hasHeader = headerIndexes.twoTheta !== undefined || parseFiniteNumber(firstTokens[0]) === undefined;
  const indexes = hasHeader ? headerIndexes : {};
  const dataLines = hasHeader ? contentLines.slice(1) : contentLines;
  const peaks = dataLines
    .map((line) => parsePeak(splitReferenceLine(line), indexes))
    .filter((peak): peak is XRDLocalReferencePeak => Boolean(peak));

  const errors = peaks.length === 0 ? ['No parsable 2theta values were found.'] : [];

  return {
    ...baseResult,
    status: errors.length > 0 ? 'parse_error' : 'parsed_preview',
    peaks,
    validation: buildValidation(peaks, errors),
  };
}
