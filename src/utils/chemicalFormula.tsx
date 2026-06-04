import { formatChemicalFormula as formatUnicode, formatChemicalFormulasInText as formatTextUnicode } from './chemicalFormulaUnicode';

/**
 * Formats chemical formulas with proper subscripts and superscripts
 * using Unicode characters. Returns a string.
 */
export function formatChemicalFormula(input: string): string {
  // Use text-based formatting by default to prevent formatting numbers 
  // in non-formula strings (like filenames, e.g., '5-80_22min.txt')
  return formatTextUnicode(input);
}

/**
 * Formats all chemical formulas found in a text block.
 */
export function formatChemicalFormulasInText(text: string): string {
  return formatTextUnicode(text);
}
