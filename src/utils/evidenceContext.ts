export type EvidenceContext =
  | {
      mode: 'uploaded';
      source: 'user_uploaded';
      sessionId: string;
      uploadId: string;
      technique: string;
      projectId?: string;
      datasetId?: string;
    }
  | {
      mode: 'project';
      projectId: string;
      datasetId?: string;
      technique: string;
    };

function normalizeSearchParams(searchParams?: URLSearchParams | string | null): URLSearchParams {
  if (searchParams instanceof URLSearchParams) return searchParams;
  if (typeof searchParams === 'string') return new URLSearchParams(searchParams);
  return new URLSearchParams();
}

function firstParam(params: URLSearchParams, names: string[]): string | null {
  for (const name of names) {
    const value = params.get(name);
    if (value) return value;
  }
  return null;
}

export function parseEvidenceContext(
  searchParams?: URLSearchParams | string | null,
  routeTechnique?: string | null,
): EvidenceContext | null {
  const params = normalizeSearchParams(searchParams);
  const source = params.get('source');
  const sessionId = firstParam(params, ['sessionId', 'analysisId', 'session']);
  const uploadId = firstParam(params, ['upload', 'uploadId', 'uploadedRunId', 'uploadedRun']);
  const technique = (routeTechnique || params.get('technique') || params.get('workspace') || 'xrd').toLowerCase();
  const projectId = firstParam(params, ['project', 'project_id']) ?? undefined;
  const datasetId = firstParam(params, ['dataset', 'datasetId']) ?? undefined;

  if (source === 'user_uploaded' && sessionId && uploadId) {
    return {
      mode: 'uploaded',
      source: 'user_uploaded',
      sessionId,
      uploadId,
      technique,
      projectId,
      datasetId,
    };
  }

  if (projectId) {
    return {
      mode: 'project',
      projectId,
      datasetId,
      technique,
    };
  }

  return null;
}

export function buildEvidenceContextQuery(ctx: EvidenceContext): string {
  const params = new URLSearchParams();

  if (ctx.mode === 'uploaded') {
    params.set('source', 'user_uploaded');
    params.set('sessionId', ctx.sessionId);
    params.set('upload', ctx.uploadId);
    params.set('technique', ctx.technique.toLowerCase());
    return params.toString();
  }

  params.set('project', ctx.projectId);
  if (ctx.datasetId) params.set('dataset', ctx.datasetId);
  params.set('technique', ctx.technique.toLowerCase());
  return params.toString();
}
