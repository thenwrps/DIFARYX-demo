/**
 * Universal Router Engine — Barrel Export
 *
 * Single import point for the Universal Scientific Analysis Router.
 *
 * @example
 * ```ts
 * import { UniversalRouter, defaultRouter, genericHandler } from '@/engines/routerEngine';
 * import type { RouterRequest, RouterResponse } from '@/engines/routerEngine';
 * ```
 *
 * @module routerEngine
 */

// ---------------------------------------------------------------------------
// Core Router
// ---------------------------------------------------------------------------
export { UniversalRouter, defaultRouter } from './router';
export type { RouterConfig } from './router';

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------
export { genericHandler } from './handlers';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type {
  RouterRequest,
  RouterResponse,
  StageArtifact,
  RawDataPayload,
  ProcessingConfig,
  RoutingDecision,
  TechniqueHandler,
  RouterEvent,
  RouterRequestEvent,
  RouterStageStartEvent,
  RouterStageCompleteEvent,
  RouterErrorEvent,
  RouterParameterChangeEvent,
} from './types';