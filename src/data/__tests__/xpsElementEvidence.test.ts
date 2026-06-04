/**
 * Tests for XPS element-focused evidence: persistence, deterministic confidence
 * mapping, fusion adapter, XPS↔XRD contradiction generation, and evidence-first
 * wording (no positive-confirmation language).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  saveXpsElementEvidence,
  readLatestXpsElementEvidence,
  readXpsElementEvidenceForProject,
  isXpsElementEvidenceRecord,
  levelToConfidence,
} from '../xpsElementEvidence';
import type { XpsElementEvidence } from '../../agent/mcp/types';
import {
  xpsOxidationStatePeakInputs,
  normalizeOxidationAssignment,
  isReducedOrMixedState,
  detectXpsXrdOxidationContradiction,
} from '../../engines/fusionEngine/xpsOxidationEvidence';

function makeEvidence(overrides: Partial<XpsElementEvidence> = {}): XpsElementEvidence {
  return {
    selectedElement: 'Cu',
    candidateStates: [
      { label: 'Cu²⁺', confidence: 0.85, matchedPeaks: 2 },
      { label: 'Cu⁺', confidence: 0.6, matchedPeaks: 1 },
    ],
    satellitePresent: true,
    regionWindow: { min: 925, max: 965 },
    caveats: ['Surface-sensitive; complementary validation required.'],
    ...overrides,
  };
}

describe('levelToConfidence', () => {
  it('maps levels deterministically', () => {
    expect(levelToConfidence('high')).toBe(0.85);
    expect(levelToConfidence('medium')).toBe(0.6);
    expect(levelToConfidence('low')).toBe(0.35);
    expect(levelToConfidence('unknown')).toBe(0.35);
  });
});

// In-memory localStorage stub (test env has no DOM).
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

describe('xpsElementEvidence persistence', () => {
  beforeEach(() => {
    const storage = new MemoryStorage();
    vi.stubGlobal('window', { localStorage: storage });
    vi.stubGlobal('localStorage', storage);
  });

  it('saves and reads the latest evidence for a project', () => {
    const saved = saveXpsElementEvidence('proj-1', makeEvidence());
    expect(saved).not.toBeNull();
    expect(isXpsElementEvidenceRecord(saved)).toBe(true);

    const latest = readLatestXpsElementEvidence('proj-1');
    expect(latest?.element).toBe('Cu');
    expect(latest?.evidence.candidateStates).toHaveLength(2);
  });

  it('upserts by (projectId, element)', () => {
    saveXpsElementEvidence('proj-1', makeEvidence({ candidateStates: [{ label: 'Cu²⁺', confidence: 0.85, matchedPeaks: 2 }] }));
    saveXpsElementEvidence('proj-1', makeEvidence({ candidateStates: [{ label: 'Cu⁺', confidence: 0.35, matchedPeaks: 1 }] }));
    const cuRecords = readXpsElementEvidenceForProject('proj-1').filter((r) => r.element === 'Cu');
    expect(cuRecords).toHaveLength(1);
    expect(cuRecords[0].evidence.candidateStates[0].label).toBe('Cu⁺');
  });

  it('keeps separate records per element and isolates projects', () => {
    saveXpsElementEvidence('proj-1', makeEvidence({ selectedElement: 'Cu' }));
    saveXpsElementEvidence('proj-1', makeEvidence({ selectedElement: 'Fe' }));
    saveXpsElementEvidence('proj-2', makeEvidence({ selectedElement: 'Cu' }));
    expect(readXpsElementEvidenceForProject('proj-1')).toHaveLength(2);
    expect(readXpsElementEvidenceForProject('proj-2')).toHaveLength(1);
  });
});

describe('fusion adapter: oxidation-state peak inputs', () => {
  it('normalizes superscript labels to fusion-recognizable assignments', () => {
    expect(normalizeOxidationAssignment('Cu²⁺')).toBe('cu2+');
    expect(normalizeOxidationAssignment('Fe³⁺')).toBe('fe3+');
    expect(normalizeOxidationAssignment('Co(II/III)')).toContain('mixed');
  });

  it('flags reduced / mixed-valence states', () => {
    expect(isReducedOrMixedState('Cu⁺')).toBe(true);
    expect(isReducedOrMixedState('Co(II/III)')).toBe(true);
    expect(isReducedOrMixedState('Cu²⁺')).toBe(false);
  });

  it('converts candidate states into fusion-consumable peak inputs (oxidation-state)', () => {
    const peaks = xpsOxidationStatePeakInputs(makeEvidence());
    expect(peaks).toHaveLength(2);
    // Region-window midpoint used as representative binding energy.
    expect(peaks[0].position).toBe(945);
    expect(peaks[0].assignment).toBe('cu2+');
    expect(peaks[0].id).toContain('xps-oxidation-Cu');
  });
});

describe('XPS↔XRD oxidation-state contradiction', () => {
  it('flags a contradiction when reduced states conflict with a fully-oxidized XRD phase', () => {
    const result = detectXpsXrdOxidationContradiction(makeEvidence(), 'CuFe2O4 (spinel ferrite)');
    expect(result.hasContradiction).toBe(true);
    expect(result.conflictingStates).toContain('Cu⁺');
    expect(result.messages.length).toBeGreaterThan(0);
  });

  it('does not flag when all states are fully oxidized', () => {
    const evidence = makeEvidence({ candidateStates: [{ label: 'Cu²⁺', confidence: 0.85, matchedPeaks: 2 }] });
    expect(detectXpsXrdOxidationContradiction(evidence, 'CuFe2O4').hasContradiction).toBe(false);
  });

  it('does not flag when the XRD phase is not a defined oxide', () => {
    expect(detectXpsXrdOxidationContradiction(makeEvidence(), 'amorphous / unknown').hasContradiction).toBe(false);
  });
});

describe('evidence-first wording (no positive-confirmation language)', () => {
  it('contradiction messages avoid confirmed / proven / identified-as', () => {
    const result = detectXpsXrdOxidationContradiction(makeEvidence(), 'CuFe2O4');
    const joined = result.messages.join(' ').toLowerCase();
    expect(joined).not.toContain('confirmed');
    expect(joined).not.toContain('proven');
    expect(joined).not.toContain('identified as');
  });
});
