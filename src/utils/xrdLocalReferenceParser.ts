import type {
  XRDLocalReferenceParseResult,
  XRDLocalReferencePeak,
  XRDReferenceFileKind,
  XRDReferenceImportCapability,
  XRDReferenceImportDiagnostics,
  XRDReferenceImportStatus,
  XRDReferenceTextBinaryLikelihood,
} from '../types/xrdLocalReference';

const LOCAL_REFERENCE_BACKEND_WARNING = 'Local references are sent to backend matching only when explicitly enabled.';

const TEXT_PEAK_LIST_EXTENSIONS = new Set(['.csv', '.txt', '.xy', '.dat']);
const INSTRUMENT_NATIVE_EXTENSIONS = new Set(['.raw', '.ras', '.xrdml', '.brml', '.uxd']);
const CIF_EXTENSIONS = new Set(['.cif']);
const REFERENCE_CARD_EXTENSIONS = new Set(['.pdf', '.card', '.jcpds', '.xml']);

const TWO_THETA_COLUMNS = new Set(['two_theta', '2theta', '2_theta', 'twotheta', 'two-theta', 'position', 'angle']);
const RELATIVE_INTENSITY_COLUMNS = new Set(['relative_intensity', 'rel_intensity', 'rel-intensity', 'relativeintensity', 'intensity']);
const HKL_COLUMNS = new Set(['hkl', 'miller_index', 'miller_indices']);
const D_SPACING_COLUMNS = new Set(['d_spacing', 'd-spacing', 'dspacing', 'd']);

type ColumnKey = 'twoTheta' | 'relativeIntensity' | 'hkl' | 'dSpacing';
type ColumnIndexes = Partial<Record<ColumnKey, number>>;

interface ParseOptions {
  fileSizeBytes?: number;
}

interface FileDetection {
  extension?: string;
  sourceFileType?: XRDLocalReferenceParseResult['sourceFileType'];
  fileKind: XRDReferenceFileKind;
  detectedFormat?: string;
  textBinaryLikelihood: XRDReferenceTextBinaryLikelihood;
}

function getExtension(sourceFileName: string) {
  return sourceFileName.match(/\.[^.]+$/)?.[0]?.toLowerCase();
}

function isTextSourceFileType(extension: string | undefined): extension is XRDLocalReferenceParseResult['sourceFileType'] {
  return extension === '.csv' || extension === '.txt' || extension === '.xy' || extension === '.dat';
}

function getTextBinaryLikelihood(text: string): XRDReferenceTextBinaryLikelihood {
  if (!text) return 'unknown';
  if (text.includes('\u0000')) return 'likely_binary';

  const sample = text.slice(0, 4096);
  const controlCount = Array.from(sample).filter((char) => {
    const code = char.charCodeAt(0);
    return code < 32 && char !== '\n' && char !== '\r' && char !== '\t';
  }).length;
  const ratio = sample.length > 0 ? controlCount / sample.length : 0;
  if (ratio > 0.08) return 'likely_binary';
  if (ratio > 0.02) return 'mixed';
  return 'likely_text';
}

function detectReferenceFile(text: string, sourceFileName: string): FileDetection {
  const extension = getExtension(sourceFileName);
  const textBinaryLikelihood = getTextBinaryLikelihood(text);
  const lowerText = text.slice(0, 4096).toLowerCase();

  if (textBinaryLikelihood === 'likely_binary') {
    return {
      extension,
      fileKind: INSTRUMENT_NATIVE_EXTENSIONS.has(extension ?? '') ? 'instrument_native' : 'unknown_binary',
      detectedFormat: extension,
      textBinaryLikelihood,
    };
  }

  if (isTextSourceFileType(extension)) {
    const fileKind: XRDReferenceFileKind = lowerText.includes('_pd_phase_name') || lowerText.includes('data_')
      ? 'crystallographic_cif'
      : extension === '.xy' || extension === '.dat'
        ? 'exported_text_pattern'
        : 'text_peak_list';
    return {
      extension,
      sourceFileType: extension,
      fileKind,
      detectedFormat: extension,
      textBinaryLikelihood,
    };
  }

  if (INSTRUMENT_NATIVE_EXTENSIONS.has(extension ?? '')) {
    return { extension, fileKind: 'instrument_native', detectedFormat: extension, textBinaryLikelihood };
  }
  if (CIF_EXTENSIONS.has(extension ?? '') || lowerText.includes('_cell_length') || lowerText.includes('_pd_phase_name')) {
    return { extension, fileKind: 'crystallographic_cif', detectedFormat: extension ?? 'cif-like text', textBinaryLikelihood };
  }
  if (REFERENCE_CARD_EXTENSIONS.has(extension ?? '') || lowerText.includes('jcpds') || lowerText.includes('pdf-4')) {
    return { extension, fileKind: 'reference_database_card', detectedFormat: extension ?? 'reference-card text', textBinaryLikelihood };
  }

  return {
    extension,
    fileKind: textBinaryLikelihood === 'likely_text' || textBinaryLikelihood === 'mixed' ? 'unknown_text' : 'unknown_binary',
    detectedFormat: extension,
    textBinaryLikelihood,
  };
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

function buildValidation(peaks: XRDLocalReferencePeak[], errors: string[], additionalWarnings: string[]) {
  const hasTwoTheta = peaks.length > 0;
  const hasAtLeastThreePeaks = peaks.length >= 3;
  const hasRelativeIntensity = peaks.some((peak) => Number.isFinite(peak.relativeIntensity));
  const hasRequiredMetadata = false;
  const warnings: string[] = [];

  if (!hasRelativeIntensity) warnings.push('Missing relative intensity values.');
  if (!hasAtLeastThreePeaks) warnings.push('Fewer than 3 peaks were parsed.');
  if (!hasRequiredMetadata) warnings.push('Reference metadata was not supplied.');
  warnings.push(...additionalWarnings);
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

function buildCapability(
  status: XRDReferenceImportStatus,
  isEligibleForBackendMatching: boolean,
  notes: string[],
): XRDReferenceImportCapability {
  return {
    canPreview: status === 'parsed_preview' || status === 'partial_preview' || status === 'repaired_preview',
    canParsePeaks: status === 'parsed_preview' || status === 'partial_preview' || status === 'repaired_preview',
    requiresConverter: status === 'requires_converter',
    plannedConverter: status === 'requires_converter' || status === 'not_supported_yet',
    isEligibleForBackendMatching,
    notes,
  };
}

function buildResult(args: {
  sourceFileName: string;
  sourceFileType?: XRDLocalReferenceParseResult['sourceFileType'];
  fileSizeBytes?: number;
  detection: FileDetection;
  status: XRDReferenceImportStatus;
  peaks: XRDLocalReferencePeak[];
  parsedRowCount: number;
  ignoredRowCount: number;
  warnings: string[];
  errors: string[];
  capabilityNotes: string[];
  referenceLabel?: string;
}): XRDLocalReferenceParseResult {
  const isEligibleForBackendMatching = (
    (args.status === 'parsed_preview' || args.status === 'partial_preview' || args.status === 'repaired_preview')
    && args.peaks.length >= 3
    && args.errors.length === 0
  );
  const validation = buildValidation(args.peaks, args.errors, args.warnings);
  const diagnostics: XRDReferenceImportDiagnostics = {
    fileKind: args.detection.fileKind,
    ...(args.detection.detectedFormat ? { detectedFormat: args.detection.detectedFormat } : {}),
    ...(args.fileSizeBytes !== undefined ? { fileSizeBytes: args.fileSizeBytes } : {}),
    textBinaryLikelihood: args.detection.textBinaryLikelihood,
    parsedRowCount: args.parsedRowCount,
    ignoredRowCount: args.ignoredRowCount,
    warnings: validation.warnings,
    errors: validation.errors,
    isEligibleForBackendMatching,
  };
  const capability = buildCapability(args.status, isEligibleForBackendMatching, args.capabilityNotes);

  return {
    sourceFileName: args.sourceFileName,
    ...(args.sourceFileType ? { sourceFileType: args.sourceFileType } : {}),
    parsedAt: new Date().toISOString(),
    status: args.status,
    referenceLabel: args.referenceLabel ?? (args.sourceFileName.replace(/\.[^.]+$/, '') || undefined),
    elements: [],
    peaks: args.peaks,
    validation,
    fileKind: args.detection.fileKind,
    ...(args.detection.detectedFormat ? { detectedFormat: args.detection.detectedFormat } : {}),
    ...(args.fileSizeBytes !== undefined ? { fileSizeBytes: args.fileSizeBytes } : {}),
    textBinaryLikelihood: args.detection.textBinaryLikelihood,
    parsedRowCount: args.parsedRowCount,
    ignoredRowCount: args.ignoredRowCount,
    importDiagnostics: diagnostics,
    importCapability: capability,
    isEligibleForBackendMatching,
    backendAvailable: false,
    usedForMatching: false,
  };
}

function buildUnsupportedResult(
  text: string,
  sourceFileName: string,
  options: ParseOptions,
): XRDLocalReferenceParseResult {
  const detection = detectReferenceFile(text, sourceFileName);
  const isBinary = detection.textBinaryLikelihood === 'likely_binary';
  const status: XRDReferenceImportStatus = isBinary
    ? 'corrupted_file'
    : detection.fileKind === 'instrument_native' || detection.fileKind === 'crystallographic_cif' || detection.fileKind === 'reference_database_card'
      ? 'requires_converter'
      : 'unsupported_format';
  const errors = isBinary
    ? ['File appears to be binary or damaged and cannot be parsed as a text peak list.']
    : status === 'requires_converter'
      ? ['This reference file kind requires a converter before peak preview or matching.']
      : ['Unsupported reference file format for the current frontend parser.'];
  const notes = status === 'requires_converter'
    ? ['Planned converter path. Current backend matching uses parsed text peak lists only.']
    : ['No backend matching payload will be built from this import.'];

  return buildResult({
    sourceFileName,
    sourceFileType: detection.sourceFileType,
    fileSizeBytes: options.fileSizeBytes,
    detection,
    status,
    peaks: [],
    parsedRowCount: 0,
    ignoredRowCount: 0,
    warnings: [],
    errors,
    capabilityNotes: notes,
  });
}

export function parseXrdLocalReferenceText(
  text: string,
  sourceFileName: string,
  options: ParseOptions = {},
): XRDLocalReferenceParseResult {
  const detection = detectReferenceFile(text, sourceFileName);

  if (!detection.sourceFileType || detection.fileKind === 'crystallographic_cif' || detection.textBinaryLikelihood === 'likely_binary') {
    return buildUnsupportedResult(text, sourceFileName, options);
  }

  if (!text.trim()) {
    return buildResult({
      sourceFileName,
      sourceFileType: detection.sourceFileType,
      fileSizeBytes: options.fileSizeBytes,
      detection,
      status: 'parse_error',
      peaks: [],
      parsedRowCount: 0,
      ignoredRowCount: 0,
      warnings: [],
      errors: ['Unsupported or empty file.'],
      capabilityNotes: ['No backend matching payload will be built from an empty import.'],
    });
  }

  const contentLines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && !line.startsWith('//'));

  if (contentLines.length === 0) {
    return buildResult({
      sourceFileName,
      sourceFileType: detection.sourceFileType,
      fileSizeBytes: options.fileSizeBytes,
      detection,
      status: 'parse_error',
      peaks: [],
      parsedRowCount: 0,
      ignoredRowCount: 0,
      warnings: [],
      errors: ['Unsupported or empty file.'],
      capabilityNotes: ['No backend matching payload will be built from an empty import.'],
    });
  }

  const firstTokens = splitReferenceLine(contentLines[0]);
  const headerIndexes = buildHeaderIndexes(firstTokens);
  const hasHeader = headerIndexes.twoTheta !== undefined || parseFiniteNumber(firstTokens[0]) === undefined;
  const indexes = hasHeader ? headerIndexes : {};
  const dataLines = hasHeader ? contentLines.slice(1) : contentLines;
  const peaks = dataLines
    .map((line) => parsePeak(splitReferenceLine(line), indexes))
    .filter((peak): peak is XRDLocalReferencePeak => Boolean(peak));

  const ignoredRowCount = dataLines.length - peaks.length;
  const warnings: string[] = [];
  if (ignoredRowCount > 0 && peaks.length > 0) {
    warnings.push(`${ignoredRowCount} row${ignoredRowCount === 1 ? '' : 's'} could not be parsed and were ignored.`);
  }
  const errors = peaks.length === 0 ? ['No parsable 2theta values were found.'] : [];
  const status: XRDReferenceImportStatus = errors.length > 0
    ? 'parse_error'
    : ignoredRowCount > 0
      ? 'partial_preview'
      : 'parsed_preview';

  return buildResult({
    sourceFileName,
    sourceFileType: detection.sourceFileType,
    fileSizeBytes: options.fileSizeBytes,
    detection,
    status,
    peaks,
    parsedRowCount: peaks.length,
    ignoredRowCount,
    warnings,
    errors,
    capabilityNotes: [
      'Parsed text peak lists may be used for backend matching only when a saved draft is explicitly enabled.',
    ],
  });
}

export function createXrdLocalReferenceImportErrorResult(
  sourceFileName: string,
  errors: string[],
  options: ParseOptions = {},
): XRDLocalReferenceParseResult {
  const extension = getExtension(sourceFileName);
  const detection: FileDetection = {
    extension,
    ...(isTextSourceFileType(extension) ? { sourceFileType: extension } : {}),
    fileKind: 'unknown_text',
    detectedFormat: extension,
    textBinaryLikelihood: 'unknown',
  };

  return buildResult({
    sourceFileName,
    sourceFileType: detection.sourceFileType,
    fileSizeBytes: options.fileSizeBytes,
    detection,
    status: 'parse_error',
    peaks: [],
    parsedRowCount: 0,
    ignoredRowCount: 0,
    warnings: [],
    errors,
    capabilityNotes: ['No backend matching payload will be built from this import.'],
  });
}
