/**
 * Reasoning Engine — Deterministic Validation Test Harness
 *
 * Exercises the full 3-stage reasoning pipeline (Cross-Validation → Gap Analysis
 * → Decision Intelligence) across 5 curated scenarios with known expected outcomes.
 *
 * Usage: npx tsx scripts/runReasoningValidation.ts
 *
 * @module scripts/runReasoningValidation
 */

import { ReasoningEngine } from '../src/engines/reasoningEngine';
import type { UniversalEvidenceNode } from '../src/types/universalEvidence';
import type { Technique } from '../src/types/universalTechnique';
import type { ReasoningReport, MaterialSystem } from '../src/engines/reasoningEngine/types';
import * as fs from 'fs';
import * as path from 'path';

interface TestResult {
  scenarioName: string;
  scenarioId: number;
  report: ReasoningReport;
  assertions: AssertionResult[];
  allPassed: boolean;
  elapsedMs: number;
}

interface AssertionResult {
  label: string;
  passed: boolean;
  expected: string;
  actual: string;
}

function buildNode(
  id: string,
  technique: Technique,
  primaryAxis: number,
  axisUnit: string,
  value: number,
  valueUnit: string,
  label: string,
  meta?: Record<string, unknown>,
  opts?: { concept?: string; inferredCategory?: UniversalEvidenceNode['inferredCategory']; confidence?: UniversalEvidenceNode['confidence'] },
): UniversalEvidenceNode {
  return {
    id, technique, primaryAxis, primaryAxisUnit: axisUnit, value, valueUnit, label,
    concept: opts?.concept, inferredCategory: opts?.inferredCategory,
    confidence: opts?.confidence ?? 'high', role: 'primary',
    techniqueMetadata: meta ?? {},
    provenance: { datasetId: `VAL-${id}`, sampleName: `validation-${id}`, createdAt: '2026-05-29T00:00:00Z', engineVersion: '1.0.0' },
  };
}

function assertEq(label: string, actual: string, expected: string): AssertionResult {
  return { label, passed: actual === expected, expected, actual };
}
function assertContains(label: string, haystack: string, needle: string): AssertionResult {
  const passed = haystack.includes(needle);
  return { label, passed, expected: `contains "${needle}"`, actual: passed ? 'found' : 'not found' };
}
function assertGte(label: string, actual: number, threshold: number): AssertionResult {
  return { label, passed: actual >= threshold, expected: `>= ${threshold}`, actual: String(actual) };
}
function getGapCategories(report: ReasoningReport): string[] {
  return report.gapAnalysis.gaps.map((g) => g.category);
}
function getInconsistentCvIds(report: ReasoningReport): string[] {
  return report.crossValidation.correlations.filter((c) => c.status === 'inconsistent').map((c) => c.ruleId);
}
function getInsufficientDataCvIds(report: ReasoningReport): string[] {
  return report.crossValidation.correlations.filter((c) => c.status === 'insufficient_data').map((c) => c.ruleId);
}

// ── Scenario Builders ─────────────────────────────────────────────────

function buildScenario1(): Partial<Record<Technique, UniversalEvidenceNode[]>> {
  const xrd: UniversalEvidenceNode[] = [
    buildNode('s1-xrd-1', 'XRD', 25.3, 'deg2t', 100, 'counts', 'anatase (101)', { hkl: '101', dSpacing: 3.52, fwhm: 0.25, classification: 'sharp', crystalliteSize: 25, phaseLabel: 'Anatase', spaceGroup: 'I41/amd', crystalSystem: 'tetragonal' }),
    buildNode('s1-xrd-2', 'XRD', 37.8, 'deg2t', 45, 'counts', 'anatase (004)', { hkl: '004', dSpacing: 2.38, fwhm: 0.28, classification: 'sharp', phaseLabel: 'Anatase' }),
    buildNode('s1-xrd-3', 'XRD', 48.1, 'deg2t', 55, 'counts', 'anatase (200)', { hkl: '200', dSpacing: 1.89, fwhm: 0.32, classification: 'sharp', phaseLabel: 'Anatase' }),
    buildNode('s1-xrd-4', 'XRD', 53.9, 'deg2t', 30, 'counts', 'anatase (105)', { hkl: '105', dSpacing: 1.70, fwhm: 0.35, classification: 'sharp', phaseLabel: 'Anatase' }),
    buildNode('s1-xrd-5', 'XRD', 55.1, 'deg2t', 35, 'counts', 'anatase (211)', { hkl: '211', dSpacing: 1.67, fwhm: 0.36, classification: 'sharp', phaseLabel: 'Anatase' }),
    buildNode('s1-xrd-6', 'XRD', 62.7, 'deg2t', 25, 'counts', 'anatase (204)', { hkl: '204', dSpacing: 1.48, fwhm: 0.40, classification: 'sharp', phaseLabel: 'Anatase' }),
  ];
  const xps: UniversalEvidenceNode[] = [
    buildNode('s1-xps-1', 'XPS', 458.5, 'eV', 850, 'counts', 'Ti 2p3/2', { orbital: 'Ti 2p3/2', chemicalState: 'Ti4+', fwhm: 1.2, backgroundMethod: 'shirley' }),
    buildNode('s1-xps-2', 'XPS', 464.2, 'eV', 420, 'counts', 'Ti 2p1/2', { orbital: 'Ti 2p1/2', chemicalState: 'Ti4+', fwhm: 1.4, backgroundMethod: 'shirley' }),
    buildNode('s1-xps-3', 'XPS', 529.7, 'eV', 900, 'counts', 'O 1s lattice', { orbital: 'O 1s', chemicalState: 'lattice oxygen', fwhm: 1.1 }),
    buildNode('s1-xps-4', 'XPS', 531.4, 'eV', 350, 'counts', 'O 1s hydroxyl', { orbital: 'O 1s hydroxyl', chemicalState: 'hydroxyl', fwhm: 1.3 }),
  ];
  const ftir: UniversalEvidenceNode[] = [
    buildNode('s1-ftir-1', 'FTIR', 450, 'cm-1', 0.72, 'absorbance', 'Ti-O stretch', { vibrationalMode: 'Ti-O stretching', functionalGroup: 'metal oxide', bondingEnvironment: 'TiO6 octahedra', bandType: 'sharp', intensityCategory: 'strong' }),
    buildNode('s1-ftir-2', 'FTIR', 560, 'cm-1', 0.85, 'absorbance', 'Ti-O stretch', { vibrationalMode: 'Ti-O stretching', functionalGroup: 'metal oxide', bandType: 'sharp', intensityCategory: 'strong' }),
    buildNode('s1-ftir-3', 'FTIR', 1630, 'cm-1', 0.20, 'absorbance', 'O-H bend', { vibrationalMode: 'O-H bending', functionalGroup: 'hydroxyl', bandType: 'broad', intensityCategory: 'weak' }),
    buildNode('s1-ftir-4', 'FTIR', 3420, 'cm-1', 0.55, 'absorbance', 'O-H stretch', { vibrationalMode: 'O-H stretching', functionalGroup: 'hydroxyl', bandType: 'broad', intensityCategory: 'medium' }),
  ];
  const raman: UniversalEvidenceNode[] = [
    buildNode('s1-raman-1', 'Raman', 144, 'cm-1', 100, 'a.u.', 'anatase Eg(1)', { modeAssignment: 'Eg', symmetry: 'D4h', bandType: 'sharp', phononMode: 'Eg(1)' }),
    buildNode('s1-raman-2', 'Raman', 399, 'cm-1', 22, 'a.u.', 'anatase B1g', { modeAssignment: 'B1g', symmetry: 'D4h', bandType: 'sharp', phononMode: 'B1g' }),
    buildNode('s1-raman-3', 'Raman', 513, 'cm-1', 38, 'a.u.', 'anatase A1g+B1g', { modeAssignment: 'A1g+B1g', symmetry: 'D4h', bandType: 'sharp', phononMode: 'A1g+B1g' }),
    buildNode('s1-raman-4', 'Raman', 639, 'cm-1', 50, 'a.u.', 'anatase Eg(2)', { modeAssignment: 'Eg', symmetry: 'D4h', bandType: 'sharp', phononMode: 'Eg(2)' }),
  ];
  return { XRD: xrd, XPS: xps, FTIR: ftir, Raman: raman };
}

function buildScenario2(): Partial<Record<Technique, UniversalEvidenceNode[]>> {
  const s1 = buildScenario1();
  return { XRD: s1.XRD, FTIR: s1.FTIR, Raman: s1.Raman };
}

function buildScenario3(): Partial<Record<Technique, UniversalEvidenceNode[]>> {
  const s1 = buildScenario1();
  const raman: UniversalEvidenceNode[] = [
    buildNode('s3-raman-1', 'Raman', 143, 'cm-1', 55, 'a.u.', 'rutile B1g', { modeAssignment: 'B1g', symmetry: 'D4h', bandType: 'sharp', phononMode: 'B1g' }),
    buildNode('s3-raman-2', 'Raman', 235, 'cm-1', 12, 'a.u.', 'rutile multi-phonon', { modeAssignment: 'multi-phonon', symmetry: 'D4h', bandType: 'broad', phononMode: 'multi-phonon' }),
    buildNode('s3-raman-3', 'Raman', 447, 'cm-1', 45, 'a.u.', 'rutile Eg', { modeAssignment: 'Eg', symmetry: 'D4h', bandType: 'sharp', phononMode: 'Eg' }),
    buildNode('s3-raman-4', 'Raman', 612, 'cm-1', 100, 'a.u.', 'rutile A1g', { modeAssignment: 'A1g', symmetry: 'D4h', bandType: 'sharp', phononMode: 'A1g' }),
  ];
  return { XRD: s1.XRD, XPS: s1.XPS, FTIR: s1.FTIR, Raman: raman };
}

function buildScenario4(): Partial<Record<Technique, UniversalEvidenceNode[]>> {
  const s1 = buildScenario1();
  const xps: UniversalEvidenceNode[] = [
    buildNode('s4-xps-1', 'XPS', 456.8, 'eV', 800, 'counts', 'Ti 2p3/2 Ti3+', { orbital: 'Ti 2p3/2', chemicalState: 'Ti3+', fwhm: 1.5, backgroundMethod: 'shirley' }),
    buildNode('s4-xps-2', 'XPS', 462.5, 'eV', 400, 'counts', 'Ti 2p1/2 Ti3+', { orbital: 'Ti 2p1/2', chemicalState: 'Ti3+', fwhm: 1.7, backgroundMethod: 'shirley' }),
    buildNode('s4-xps-3', 'XPS', 529.7, 'eV', 850, 'counts', 'O 1s lattice', { orbital: 'O 1s', chemicalState: 'lattice oxygen', fwhm: 1.1 }),
  ];
  return { XRD: s1.XRD, XPS: xps, FTIR: s1.FTIR, Raman: s1.Raman };
}

function buildScenario5(): Partial<Record<Technique, UniversalEvidenceNode[]>> {
  const xrd: UniversalEvidenceNode[] = [
    buildNode('s5-xrd-1', 'XRD', 20.8, 'deg2t', 100, 'counts', 'LFP (101)', { hkl: '101', dSpacing: 4.27, fwhm: 0.30, classification: 'sharp', phaseLabel: 'LiFePO4', spaceGroup: 'Pnma', crystalSystem: 'orthorhombic' }),
    buildNode('s5-xrd-2', 'XRD', 25.6, 'deg2t', 40, 'counts', 'LFP (111)', { hkl: '111', dSpacing: 3.48, fwhm: 0.32, classification: 'sharp', phaseLabel: 'LiFePO4' }),
    buildNode('s5-xrd-3', 'XRD', 29.7, 'deg2t', 60, 'counts', 'LFP (020)', { hkl: '020', dSpacing: 3.00, fwhm: 0.28, classification: 'sharp', phaseLabel: 'LiFePO4' }),
    buildNode('s5-xrd-4', 'XRD', 32.2, 'deg2t', 35, 'counts', 'LFP (121)', { hkl: '121', dSpacing: 2.78, fwhm: 0.33, classification: 'sharp', phaseLabel: 'LiFePO4' }),
    buildNode('s5-xrd-5', 'XRD', 35.6, 'deg2t', 30, 'counts', 'LFP (011)', { hkl: '011', dSpacing: 2.52, fwhm: 0.35, classification: 'sharp', phaseLabel: 'LiFePO4' }),
  ];
  const xps: UniversalEvidenceNode[] = [
    buildNode('s5-xps-1', 'XPS', 710.5, 'eV', 800, 'counts', 'Fe 2p3/2', { orbital: 'Fe 2p3/2', chemicalState: 'Fe2+', fwhm: 2.0, backgroundMethod: 'shirley' }),
    buildNode('s5-xps-2', 'XPS', 724.0, 'eV', 400, 'counts', 'Fe 2p1/2', { orbital: 'Fe 2p1/2', chemicalState: 'Fe2+', fwhm: 2.2, backgroundMethod: 'shirley' }),
    buildNode('s5-xps-3', 'XPS', 531.0, 'eV', 600, 'counts', 'O 1s phosphate', { orbital: 'O 1s', chemicalState: 'phosphate oxygen', fwhm: 1.4 }),
    buildNode('s5-xps-4', 'XPS', 133.2, 'eV', 300, 'counts', 'P 2p', { orbital: 'P 2p', chemicalState: 'phosphate', fwhm: 1.3 }),
  ];
  const ftir: UniversalEvidenceNode[] = [
    buildNode('s5-ftir-1', 'FTIR', 947, 'cm-1', 0.65, 'absorbance', 'PO4 v1 symmetric stretch', { vibrationalMode: 'PO4 symmetric stretching', functionalGroup: 'phosphate', bondingEnvironment: 'PO4 tetrahedra', bandType: 'sharp', intensityCategory: 'strong' }),
    buildNode('s5-ftir-2', 'FTIR', 1045, 'cm-1', 0.90, 'absorbance', 'PO4 v3 asymmetric stretch', { vibrationalMode: 'PO4 asymmetric stretching', functionalGroup: 'phosphate', bandType: 'sharp', intensityCategory: 'strong' }),
    buildNode('s5-ftir-3', 'FTIR', 1095, 'cm-1', 0.75, 'absorbance', 'PO4 v3 asymmetric stretch', { vibrationalMode: 'PO4 asymmetric stretching', functionalGroup: 'phosphate', bandType: 'sharp', intensityCategory: 'strong' }),
    buildNode('s5-ftir-4', 'FTIR', 550, 'cm-1', 0.40, 'absorbance', 'PO4 v4 bending', { vibrationalMode: 'PO4 bending', functionalGroup: 'phosphate', bandType: 'sharp', intensityCategory: 'medium' }),
    buildNode('s5-ftir-5', 'FTIR', 635, 'cm-1', 0.30, 'absorbance', 'Fe-O stretch', { vibrationalMode: 'Fe-O stretching', functionalGroup: 'metal oxide', bandType: 'sharp', intensityCategory: 'medium' }),
  ];
  return { XRD: xrd, XPS: xps, FTIR: ftir };
}

// ── Scenario Runner ───────────────────────────────────────────────────

function runScenario(
  id: number, name: string, materialSystem: MaterialSystem,
  evidence: Partial<Record<Technique, UniversalEvidenceNode[]>>,
  expectedTechniques: Technique[],
  assertions: (report: ReasoningReport) => AssertionResult[],
): TestResult {
  const t0 = performance.now();
  const engine = new ReasoningEngine({
    materialSystem, expectedTechniques,
    highConfidenceThreshold: 0.85, mediumConfidenceThreshold: 0.65, lowConfidenceThreshold: 0.40,
  });
  engine.setSampleId(`VAL-SCENARIO-${id}`);
  engine.ingestAllEvidence(evidence);
  const report = engine.analyze();
  const elapsedMs = performance.now() - t0;
  const results = assertions(report);
  return { scenarioName: name, scenarioId: id, report, assertions: results, allPassed: results.every((r) => r.passed), elapsedMs };
}

// ── Main ──────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('===================================================================');
  console.log('  DIFARYX Reasoning Engine - Deterministic Validation Harness');
  console.log('===================================================================\n');

  const results: TestResult[] = [];

  // Scenario 1: Clean TiO2
  results.push(runScenario(1, 'Clean TiO2 (All 4 Techniques)', 'TiO2', buildScenario1(),
    ['XRD', 'XPS', 'FTIR', 'Raman'],
    (r) => [
      assertEq('Confidence level', r.decision.confidence.level, 'HIGH'),
      assertGte('Overall score', r.decision.confidence.overallScore, 0.65),
      assertEq('No contradiction gaps', getGapCategories(r).filter((c) => c === 'contradiction').length === 0 ? 'none' : 'present', 'none'),
      assertGte('Techniques analyzed', r.techniquesAnalyzed.length, 4),
      assertEq('Objective met (no recommendations needed)', r.decision.objectiveMet ? 'true' : 'false', 'true'),
    ],
  ));

  // Scenario 2: Missing XPS
  results.push(runScenario(2, 'Missing XPS (TiO2)', 'TiO2', buildScenario2(),
    ['XRD', 'XPS', 'FTIR', 'Raman'],
    (r) => {
      const cats = getGapCategories(r);
      const hasMissing = cats.includes('missing_technique');
      const hasInsuff = getInsufficientDataCvIds(r);
      return [
        assertContains('Missing technique gap', hasMissing ? 'present' : 'absent', 'present'),
        assertGte('Gap count >= 1', r.gapAnalysis.gaps.length, 1),
        assertGte('CV insufficient_data >= 1', hasInsuff.length, 1),
        assertContains('Recommendation addresses missing', r.decision.recommendations.some((rec) => rec.description.toLowerCase().includes('xps') || rec.description.toLowerCase().includes('missing') || rec.recommendedTechnique === 'XPS') ? 'yes' : 'no', 'yes'),
      ];
    },
  ));

  // Scenario 3: Phase Mismatch
  results.push(runScenario(3, 'Phase Mismatch (Rutile Raman on Anatase XRD)', 'TiO2', buildScenario3(),
    ['XRD', 'XPS', 'FTIR', 'Raman'],
    (r) => {
      const inconsistentIds = getInconsistentCvIds(r);
      const hasCv001 = inconsistentIds.includes('CV-001') || inconsistentIds.includes('CV-005');
      const hasContradiction = getGapCategories(r).includes('contradiction');
      return [
        assertContains('CV-001 or CV-005 inconsistent', hasCv001 ? 'yes' : 'no', 'yes'),
        assertContains('Contradiction gap present', hasContradiction ? 'yes' : 'no', 'yes'),
        assertGte('At least 1 gap', r.gapAnalysis.gaps.length, 1),
      ];
    },
  ));

  // Scenario 4: XPS Oxidation Anomaly
  results.push(runScenario(4, 'XPS Oxidation Anomaly (Ti3+ on Anatase)', 'TiO2', buildScenario4(),
    ['XRD', 'XPS', 'FTIR', 'Raman'],
    (r) => {
      const inconsistentIds = getInconsistentCvIds(r);
      const hasCv002 = inconsistentIds.includes('CV-002');
      const hasContradiction = getGapCategories(r).includes('contradiction');
      return [
        assertContains('CV-002 inconsistent (Ti3+ vs Anatase)', hasCv002 ? 'yes' : 'no', 'yes'),
        assertContains('Contradiction gap present', hasContradiction ? 'yes' : 'no', 'yes'),
        assertGte('At least 1 gap', r.gapAnalysis.gaps.length, 1),
      ];
    },
  ));

  // Scenario 5: LiFePO4
  results.push(runScenario(5, 'LiFePO4 Olivine (Non-TiO2 Energy Storage)', 'LiFePO4' as MaterialSystem, buildScenario5(),
    ['XRD', 'XPS', 'FTIR'],
    (r) => [
      assertEq('Material system', r.materialSystem as string, 'LiFePO4'),
      assertGte('Techniques analyzed', r.techniquesAnalyzed.length, 3),
      assertGte('Has decision', r.decision.recommendations.length > 0 ? 1 : 0, 1),
      assertContains('Report generated', r.reportId.length > 0 ? 'yes' : 'no', 'yes'),
    ],
  ));

  // ── Console Summary ─────────────────────────────────────────────────
  console.log('┌────┬──────────────────────────────────────────────────┬──────────┬──────────┬────────────┐');
  console.log('│ #  │ Scenario                                         │ Status   │ Score    │ Time (ms)  │');
  console.log('├────┼──────────────────────────────────────────────────┼──────────┼──────────┼────────────┤');
  for (const r of results) {
    const icon = r.allPassed ? 'PASS' : 'FAIL';
    const score = (r.report.decision.confidence.overallScore * 100).toFixed(1) + '%';
    const name = r.scenarioName.length > 50 ? r.scenarioName.slice(0, 47) + '...' : r.scenarioName;
    console.log(`│ ${String(r.scenarioId).padEnd(2)} │ ${name.padEnd(50)} │ ${icon.padEnd(8)} │ ${score.padEnd(8)} │ ${r.elapsedMs.toFixed(1).padStart(10)} │`);
  }
  console.log('└────┴──────────────────────────────────────────────────┴──────────┴──────────┴────────────┘');

  console.log('\n--- Assertion Details ---\n');
  for (const r of results) {
    console.log(`Scenario ${r.scenarioId}: ${r.scenarioName}`);
    for (const a of r.assertions) {
      const icon = a.passed ? '  PASS' : '  FAIL';
      console.log(`${icon} ${a.label} -- expected: ${a.expected}, actual: ${a.actual}`);
    }
    console.log();
  }

  const totalAssertions = results.reduce((s, r) => s + r.assertions.length, 0);
  const passedAssertions = results.reduce((s, r) => s + r.assertions.filter((a) => a.passed).length, 0);
  const allScenariosPassed = results.every((r) => r.allPassed);

  console.log(`Results: ${passedAssertions}/${totalAssertions} assertions passed, ${results.filter((r) => r.allPassed).length}/${results.length} scenarios passed.`);
  console.log(allScenariosPassed ? 'ALL SCENARIOS PASSED' : 'SOME SCENARIOS FAILED');

  // ── Generate Markdown Report ────────────────────────────────────────
  const reportMd = buildMarkdownReport(results, totalAssertions, passedAssertions);
  const reportPath = path.join(process.cwd(), 'UNIVERSAL_VALIDATION_REPORT.md');
  fs.writeFileSync(reportPath, reportMd, 'utf-8');
  console.log(`\nReport written to: ${reportPath}`);

  if (!allScenariosPassed) process.exit(1);
}

// ── Markdown Report Builder ───────────────────────────────────────────

function buildMarkdownReport(results: TestResult[], totalAssertions: number, passedAssertions: number): string {
  const L: string[] = [];
  const now = new Date().toISOString();

  L.push('# DIFARYX Reasoning Engine - Universal Validation Report');
  L.push('');
  L.push(`**Generated:** ${now}`);
  L.push(`**Engine Version:** 1.0.0`);
  L.push(`**Scenarios:** ${results.length}`);
  L.push(`**Assertions:** ${passedAssertions}/${totalAssertions} passed`);
  L.push(`**Overall:** ${results.every((r) => r.allPassed) ? 'ALL PASSED' : 'SOME FAILED'}`);
  L.push('');

  L.push('## Summary Matrix');
  L.push('');
  L.push('| # | Scenario | Material | Confidence | Level | Gaps | CV Inconsistent | Status |');
  L.push('|---|----------|----------|------------|-------|------|-----------------|--------|');
  for (const r of results) {
    const rep = r.report;
    const score = (rep.decision.confidence.overallScore * 100).toFixed(1) + '%';
    const level = rep.decision.confidence.level;
    const gapCount = rep.gapAnalysis.gaps.length;
    const inconsistentCvs = rep.crossValidation.correlations.filter((c) => c.status === 'inconsistent').map((c) => c.ruleId).join(', ') || '-';
    const status = r.allPassed ? 'PASS' : 'FAIL';
    L.push(`| ${r.scenarioId} | ${r.scenarioName} | ${rep.materialSystem} | ${score} | ${level} | ${gapCount} | ${inconsistentCvs} | ${status} |`);
  }
  L.push('');

  for (const r of results) {
    const rep = r.report;
    L.push('---');
    L.push('');
    L.push(`## Scenario ${r.scenarioId}: ${r.scenarioName}`);
    L.push('');
    L.push(`**Material System:** ${rep.materialSystem}`);
    L.push(`**Techniques Analyzed:** ${rep.techniquesAnalyzed.join(', ')}`);
    L.push(`**Processing Time:** ${r.elapsedMs.toFixed(1)} ms`);
    L.push('');

    L.push('### Confidence Score Breakdown');
    L.push('');
    L.push(`- **Overall Score:** ${(rep.decision.confidence.overallScore * 100).toFixed(1)}%`);
    L.push(`- **Level:** ${rep.decision.confidence.level}`);
    L.push(`- **Technique Coverage Factor:** ${(rep.decision.confidence.techniqueCoverageFactor * 100).toFixed(1)}%`);
    L.push(`- **Consistency Bonus:** ${rep.decision.confidence.consistencyBonus.toFixed(3)}`);
    L.push(`- **Claims Evaluated:** ${rep.decision.confidence.claimScores.length}`);
    L.push('');

    L.push('### Cross-Validation Correlation Matrix');
    L.push('');
    L.push('| Rule ID | Rule Name | Status | Confidence |');
    L.push('|---------|-----------|--------|------------|');
    for (const c of rep.crossValidation.correlations) {
      L.push(`| ${c.ruleId} | ${c.ruleName} | ${c.status} | ${(c.confidence * 100).toFixed(0)}% |`);
    }
    L.push('');

    L.push('### Gap Inventory');
    L.push('');
    if (rep.gapAnalysis.gaps.length === 0) {
      L.push('No gaps detected.');
    } else {
      L.push('| Gap ID | Category | Severity | Description |');
      L.push('|--------|----------|----------|-------------|');
      for (const g of rep.gapAnalysis.gaps) {
        const desc = g.description.length > 80 ? g.description.slice(0, 77) + '...' : g.description;
        L.push(`| ${g.gapId} | ${g.category} | ${g.severity} | ${desc} |`);
      }
    }
    L.push('');

    L.push('### Next-Step Recommendations');
    L.push('');
    for (const rec of rep.decision.recommendations) {
      L.push(`- **[${rec.priority}] ${rec.stepType}** (impact ${(rec.expectedConfidenceImpact * 100).toFixed(0)}%): ${rec.description}`);
    }
    L.push('');

    L.push('### Assertion Results');
    L.push('');
    for (const a of r.assertions) {
      const icon = a.passed ? 'PASS' : 'FAIL';
      L.push(`- **${icon}** ${a.label} -- expected: \`${a.expected}\`, actual: \`${a.actual}\``);
    }
    L.push('');
  }

  L.push('---');
  L.push('');
  L.push('## Appendix: Cross-Validation Rule Reference');
  L.push('');
  L.push('| ID | Rule Name | Techniques |');
  L.push('|----|-----------|------------|');
  L.push('| CV-001 | XRD Phase vs Raman Active Modes | XRD x Raman |');
  L.push('| CV-002 | XRD Phase vs XPS Ti4+ Binding Energy | XRD x XPS |');
  L.push('| CV-003 | XRD Crystallite Size vs Raman Broadening | XRD x Raman |');
  L.push('| CV-004 | XPS O 1s vs FTIR Ti-O Bands | XPS x FTIR |');
  L.push('| CV-005 | Raman Mode Ratio vs XRD Phase Fraction | Raman x XRD |');
  L.push('| CV-006 | FTIR Surface Species vs XPS Surface Oxidation | FTIR x XPS |');
  L.push('| CV-007 | XRD Amorphous vs Raman Disorder Bands | XRD x Raman |');
  L.push('| CV-008 | XPS Ti 2p Spin-Orbit Splitting | XPS |');
  L.push('| CV-009 | FTIR Carbonate vs XPS C 1s Contamination | FTIR x XPS |');
  L.push('| CV-010 | Raman Crystallinity vs XRD Peak Sharpness | Raman x XRD |');
  L.push('| CV-011 | XRD Phase Mixture vs FTIR Band Deconvolution | XRD x FTIR |');
  L.push('| CV-012 | Cross-Technique Contamination Detection | ALL |');
  L.push('');

  return L.join('\n');
}

main().catch((err) => { console.error('Fatal error:', err); process.exit(1); });