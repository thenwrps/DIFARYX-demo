import React from 'react';
import { Shield, CheckCircle2, AlertTriangle, Layers, Activity } from 'lucide-react';

interface ScientificConfidenceSummaryProps {
  claimStatus: string;
  readinessPercent: number;
  validationGaps: Array<{ severity: string }>;
  availableTechniques: string[];
  pendingTechniques: string[];
  className?: string;
  compact?: boolean;
}

export function getConfidenceLevel(claimStatus: string): 'HIGH' | 'MEDIUM-HIGH' | 'MEDIUM' | 'LOW' {
  const status = claimStatus?.toLowerCase() || '';
  if (status === 'supported_assignment' || status === 'strongly_supported' || status === 'report_ready') return 'HIGH';
  if (status === 'requires_validation' || status === 'supported') return 'MEDIUM-HIGH';
  if (status === 'validation_limited' || status === 'partial') return 'MEDIUM';
  return 'LOW';
}

export function getEvidenceStrengthQualifier(claimStatus: string): string {
  const status = claimStatus?.toLowerCase() || '';
  if (status === 'supported_assignment' || status === 'strongly_supported' || status === 'report_ready') return 'Strong Evidence';
  if (status === 'requires_validation' || status === 'supported') return 'Moderate Evidence';
  if (status === 'validation_limited' || status === 'partial') return 'Limited Evidence';
  return 'Weak Evidence';
}

export function ScientificConfidenceSummary({
  claimStatus,
  readinessPercent,
  validationGaps,
  availableTechniques,
  pendingTechniques,
  className = '',
  compact = false,
}: ScientificConfidenceSummaryProps) {
  const level = getConfidenceLevel(claimStatus);
  const criticalCount = validationGaps.filter((gap) => {
    const s = gap.severity?.toLowerCase();
    return s === 'critical';
  }).length;
  const highCount = validationGaps.filter((gap) => {
    const s = gap.severity?.toLowerCase();
    return s === 'high' || s === 'moderate' || s === 'major';
  }).length;
  const mediumCount = validationGaps.filter((gap) => {
    const s = gap.severity?.toLowerCase();
    return s === 'medium' || s === 'minor';
  }).length;
  const lowCount = validationGaps.filter((gap) => {
    const s = gap.severity?.toLowerCase();
    return s === 'low';
  }).length;

  const gapCount = validationGaps.length;
  const coverageAvailable = availableTechniques.length;
  const coverageTotal = availableTechniques.length + pendingTechniques.length;

  const levelColorClass = {
    HIGH: 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50',
    'MEDIUM-HIGH': 'text-cyan-700 bg-cyan-50 border-cyan-200 dark:bg-cyan-950/20 dark:text-cyan-400 dark:border-cyan-900/50',
    MEDIUM: 'text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/50',
    LOW: 'text-red-700 bg-red-50 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/50',
  }[level];

  if (compact) {
    return (
      <div className={`rounded-lg border p-2 bg-slate-50/40 border-slate-200/50 ${className}`}>
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1">
            <Shield size={11} className="text-slate-500 shrink-0" />
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Confidence</span>
          </div>
          <span className={`rounded px-1 py-0.5 text-[8px] font-bold border uppercase tracking-wider ${levelColorClass}`}>
            {level}
          </span>
        </div>
        <div className="mt-1 grid grid-cols-4 gap-1 text-[9px] font-semibold text-slate-700">
          <div>
            <span className="text-slate-400 block text-[8px] font-normal uppercase tracking-wider">Score</span>
            {readinessPercent}%
          </div>
          <div>
            <span className="text-slate-400 block text-[8px] font-normal uppercase tracking-wider">Cover</span>
            {coverageAvailable}/{coverageTotal}
          </div>
          <div>
            <span className="text-slate-400 block text-[8px] font-normal uppercase tracking-wider">Conflict</span>
            {criticalCount}
          </div>
          <div>
            <span className="text-slate-400 block text-[8px] font-normal uppercase tracking-wider">Gaps</span>
            <div className="flex flex-col">
              <span className="font-extrabold">{gapCount}</span>
              <span className="text-[7px] text-slate-400 font-medium whitespace-nowrap mt-0.5">
                C:{criticalCount} H:{highCount} M:{mediumCount} L:{lowCount}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border p-4 bg-white shadow-sm border-slate-200 ${className}`}>
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 mb-3">
        <div className="flex items-center gap-2">
          <Shield size={16} className="text-blue-600" />
          <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700">Scientific Confidence</h3>
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold border uppercase tracking-wider ${levelColorClass}`}>
          Level: {level}
        </span>
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
        <div className="rounded-lg border border-violet-100 bg-violet-50/20 p-2.5 flex flex-col justify-between min-h-[82px] dark:border-violet-900/20 dark:bg-violet-950/10">
          <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500 flex items-start gap-1">
            <Activity size={11} className="text-violet-500 shrink-0 mt-0.5 dark:text-violet-400" />
            <span className="leading-tight">Overall Score</span>
          </div>
          <span className="mt-1 text-lg font-extrabold text-violet-900 dark:text-violet-300">{readinessPercent}%</span>
        </div>

        <div className="rounded-lg border border-indigo-100 bg-indigo-50/20 p-2.5 flex flex-col justify-between min-h-[82px] dark:border-indigo-900/20 dark:bg-indigo-950/10">
          <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500 flex items-start gap-1">
            <Layers size={11} className="text-indigo-500 shrink-0 mt-0.5 dark:text-indigo-400" />
            <span className="leading-tight">Evidence Coverage</span>
          </div>
          <span className="mt-1 text-lg font-extrabold text-indigo-900 dark:text-indigo-300">{coverageAvailable}/{coverageTotal}</span>
        </div>

        <div className={`rounded-lg border p-2.5 flex flex-col justify-between min-h-[82px] ${
          criticalCount > 0
            ? 'border-red-100 bg-red-50/30 dark:border-red-900/30 dark:bg-red-950/10'
            : 'border-slate-100 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/20'
        }`}>
          <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500 flex items-start gap-1">
            <AlertTriangle size={11} className={`shrink-0 mt-0.5 ${criticalCount > 0 ? 'text-red-500 dark:text-red-400' : 'text-slate-400'}`} />
            <span className="leading-tight">Critical Contradictions</span>
          </div>
          <span className={`mt-1 text-lg font-extrabold ${criticalCount > 0 ? 'text-red-700 dark:text-red-400' : 'text-slate-800 dark:text-slate-300'}`}>{criticalCount}</span>
        </div>

        <div className={`rounded-lg border p-2.5 flex flex-col justify-between min-h-[82px] ${
          gapCount > 0
            ? 'border-amber-100 bg-amber-50/20 dark:border-amber-900/20 dark:bg-amber-950/10'
            : 'border-emerald-100 bg-emerald-50/20 dark:border-emerald-900/20 dark:bg-emerald-950/10'
        }`}>
          <div>
            <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500 flex items-start gap-1">
              <CheckCircle2 size={11} className={`shrink-0 mt-0.5 ${gapCount > 0 ? 'text-amber-500 dark:text-amber-400' : 'text-emerald-500 dark:text-emerald-400'}`} />
              <span className="leading-tight">Validation Gaps</span>
            </div>
            <span className={`mt-1 block text-lg font-extrabold ${gapCount > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-800 dark:text-emerald-300'}`}>{gapCount}</span>
          </div>
          {gapCount > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1 text-[8px] font-bold tracking-wider">
              <span className="rounded bg-red-50 px-1 py-0.5 text-red-600 dark:bg-red-950/20">C:{criticalCount}</span>
              <span className="rounded bg-amber-50 px-1 py-0.5 text-amber-600 dark:bg-amber-950/20">H:{highCount}</span>
              <span className="rounded bg-blue-50 px-1 py-0.5 text-blue-600 dark:bg-blue-950/20">M:{mediumCount}</span>
              <span className="rounded bg-emerald-50 px-1 py-0.5 text-emerald-600 dark:bg-emerald-950/20">L:{lowCount}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
