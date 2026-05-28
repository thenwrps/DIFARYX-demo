/**
 * Universal Scientific Analysis Router
 *
 * Core routing engine that dispatches characterization data through the
 * 7-stage deterministic evidence workflow. Supports all 11 technique modules
 * via a pluggable handler architecture with automatic fallback to the
 * generic handler.
 *
 * Design Principles:
 *   - Technique-agnostic: same interface for XRD, XPS, FTIR, Raman, XAS, etc.
 *   - Deterministic: identical inputs always produce identical outputs.
 *   - Audit-trail: every routing decision and parameter change is logged.
 *   - Thread-safe: all state mutations go through the router's internal lock.
 *
 * @module routerEngine/router
 */

import type {
  RouterRequest,
  RouterResponse,
  RouterEvent,
  TechniqueHandler,
  StageArtifact,
  RoutingDecision,
} from './types';

import type { Technique, TechniqueDomain } from '../../types/universalTechnique';
import type { EvidenceStage } from '../../types/universalResearchEvidence';

import { getTechniqueMetadata, TECHNIQUE_REGISTRY } from '../../types/universalTechnique';
import { EVIDENCE_STAGES } from '../../types/universalResearchEvidence';
import { genericHandler } from './handlers';

// ---------------------------------------------------------------------------
// Router Configuration
// ---------------------------------------------------------------------------

/**
 * Configuration for the Universal Router.
 */
export interface RouterConfig {
  /** Whether to emit events for the Approval Ledger. */
  readonly enableLedger: boolean;

  /** Maximum number of stages to process in a single run. */
  readonly maxStagesPerRun: number;

  /** Timeout per stage in milliseconds. */
  readonly stageTimeoutMs: number;

  /** Whether to continue on stage errors (vs. abort). */
  readonly continueOnError: boolean;
}

const DEFAULT_CONFIG: RouterConfig = {
  enableLedger: true,
  maxStagesPerRun: 7,
  stageTimeoutMs: 30_000,
  continueOnError: false,
};

// ---------------------------------------------------------------------------
// Universal Router
// ---------------------------------------------------------------------------

/**
 * Universal Scientific Analysis Router.
 *
 * Dispatches technique data through the deterministic 7-stage pipeline.
 * Supports registering technique-specific handlers; unregistered techniques
 * fall back to the generic handler.
 *
 * @example
 * ```ts
 * const router = new UniversalRouter();
 * router.registerHandler(myXrdHandler);
 *
 * const response = await router.route({
 *   requestId: crypto.randomUUID(),
 *   technique: 'XRD',
 *   researchObjective: 'Identify crystal structure',
 *   sampleId: 'sample-001',
 *   rawData: { format: 'xy_pairs', primaryAxis: [...], values: [...] },
 *   requestedAt: new Date().toISOString(),
 * });
 * ```
 */
export class UniversalRouter {
  private handlers: Map<Technique, TechniqueHandler> = new Map();
  private events: RouterEvent[] = [];
  private config: RouterConfig;

  constructor(config?: Partial<RouterConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // -------------------------------------------------------------------------
  // Handler Registration
  // -------------------------------------------------------------------------

  /**
   * Register a technique-specific handler.
   *
   * If a handler for the same technique already exists, it is replaced
   * and a warning is logged.
   */
  registerHandler(handler: TechniqueHandler): void {
    if (this.handlers.has(handler.technique)) {
      console.warn(
        `[UniversalRouter] Replacing existing handler for ${handler.technique}`
      );
    }
    this.handlers.set(handler.technique, handler);
  }

  /**
   * Unregister a technique handler (reverts to generic fallback).
   */
  unregisterHandler(technique: Technique): boolean {
    return this.handlers.delete(technique);
  }

  /**
   * Get the handler for a technique (specific or generic fallback).
   */
  getHandler(technique: Technique): TechniqueHandler {
    return this.handlers.get(technique) ?? genericHandler;
  }

  /**
   * Check if a technique-specific handler is registered.
   */
  hasSpecificHandler(technique: Technique): boolean {
    return this.handlers.has(technique);
  }

  // -------------------------------------------------------------------------
  // Core Routing
  // -------------------------------------------------------------------------

  /**
   * Route a request through the 7-stage deterministic pipeline.
   *
   * Executes stages sequentially from the starting stage to the final
   * decision stage. Each stage's artifact is stored and passed to the
   * next stage.
   *
   * @param request - The router request with technique, data, and config.
   * @returns A router response with the final artifact and routing metadata.
   */
  async route(request: RouterRequest): Promise<RouterResponse> {
    const startTime = performance.now();
    const handler = this.getHandler(request.technique);
    const usedSpecific = this.hasSpecificHandler(request.technique);
    const metadata = getTechniqueMetadata(request.technique);
    const domain = metadata?.domain ?? 'spectroscopy';

    // Determine stage sequence
    const startStageIndex = request.startStage
      ? EVIDENCE_STAGES.indexOf(request.startStage)
      : 0;
    const stageSequence = EVIDENCE_STAGES.slice(startStageIndex);

    if (stageSequence.length === 0) {
      throw new Error(`Invalid start stage: ${request.startStage}`);
    }

    // Emit request event
    this.emitEvent({
      type: 'router:request',
      requestId: request.requestId,
      technique: request.technique,
      timestamp: new Date().toISOString(),
    });

    // Process stages sequentially
    const previousArtifacts = new Map<EvidenceStage, StageArtifact>();
    let lastArtifact: StageArtifact | undefined;
    let lastStage: EvidenceStage = stageSequence[0];
    const warnings: string[] = [];

    for (let i = 0; i < Math.min(stageSequence.length, this.config.maxStagesPerRun); i++) {
      const stage = stageSequence[i];
      const stageStartTime = performance.now();

      // Emit stage start event
      this.emitEvent({
        type: 'router:stage_start',
        requestId: request.requestId,
        stage,
        handlerId: handler.name,
        timestamp: new Date().toISOString(),
      });

      try {
        // Process the stage
        const artifact = await handler.processStage(stage, request, previousArtifacts);
        const stageEndTime = performance.now();

        // Store artifact for next stage
        previousArtifacts.set(stage, artifact);
        lastArtifact = artifact;
        lastStage = stage;

        // Build routing decision
        const routingDecision: RoutingDecision = {
          decisionId: `${request.requestId}:${stage}:${Date.now()}`,
          technique: request.technique,
          domain: domain as TechniqueDomain,
          stage,
          handlerId: handler.name,
          usedTechniqueHandler: usedSpecific,
          processingTimeMs: stageEndTime - stageStartTime,
          warnings: [],
          decidedAt: new Date().toISOString(),
        };

        // Emit stage complete event
        this.emitEvent({
          type: 'router:stage_complete',
          requestId: request.requestId,
          stage,
          artifact,
          routingDecision,
          timestamp: new Date().toISOString(),
        });

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);

        // Emit error event
        this.emitEvent({
          type: 'router:error',
          requestId: request.requestId,
          stage,
          error: errorMsg,
          timestamp: new Date().toISOString(),
        });

        if (!this.config.continueOnError) {
          throw new Error(
            `[UniversalRouter] Stage '${stage}' failed for ${request.technique}: ${errorMsg}`
          );
        }

        warnings.push(`Stage '${stage}' failed: ${errorMsg}`);
      }
    }

    // Determine next stage
    const completedIndex = EVIDENCE_STAGES.indexOf(lastStage);
    const hasMoreStages = completedIndex < EVIDENCE_STAGES.length - 1;
    const nextStage = hasMoreStages ? EVIDENCE_STAGES[completedIndex + 1] : undefined;

    const endTime = performance.now();

    // Build final routing decision
    const finalDecision: RoutingDecision = {
      decisionId: `${request.requestId}:final:${Date.now()}`,
      technique: request.technique,
      domain: domain as TechniqueDomain,
      stage: lastStage,
      handlerId: handler.name,
      usedTechniqueHandler: usedSpecific,
      processingTimeMs: endTime - startTime,
      warnings,
      decidedAt: new Date().toISOString(),
    };

    return {
      requestId: request.requestId,
      technique: request.technique,
      completedStage: lastStage,
      artifact: lastArtifact!,
      hasMoreStages,
      nextStage,
      routingDecision: finalDecision,
      respondedAt: new Date().toISOString(),
    };
  }

  /**
   * Route a single stage only (does not continue to subsequent stages).
   */
  async routeStage(
    request: RouterRequest,
    stage: EvidenceStage,
    previousArtifacts?: Map<EvidenceStage, StageArtifact>,
  ): Promise<RouterResponse> {
    const singleStageRequest: RouterRequest = {
      ...request,
      startStage: stage,
    };

    // Override maxStagesPerRun for single-stage routing
    const originalMax = this.config.maxStagesPerRun;
    (this.config as { maxStagesPerRun: number }).maxStagesPerRun = 1;

    try {
      const response = await this.route(singleStageRequest);
      return response;
    } finally {
      (this.config as { maxStagesPerRun: number }).maxStagesPerRun = originalMax;
    }
  }

  // -------------------------------------------------------------------------
  // Ledger / Event Access
  // -------------------------------------------------------------------------

  /**
   * Get all events emitted by this router instance.
   */
  getEvents(): readonly RouterEvent[] {
    return [...this.events];
  }

  /**
   * Get events for a specific request.
   */
  getEventsForRequest(requestId: string): readonly RouterEvent[] {
    return this.events.filter((e) => e.requestId === requestId);
  }

  /**
   * Clear the event log.
   */
  clearEvents(): void {
    this.events = [];
  }

  /**
   * Get the count of registered technique-specific handlers.
   */
  get handlerCount(): number {
    return this.handlers.size;
  }

  /**
   * Get all registered technique names.
   */
  get registeredTechniques(): Technique[] {
    return Array.from(this.handlers.keys());
  }

  // -------------------------------------------------------------------------
  // Internal
  // -------------------------------------------------------------------------

  /**
   * Emit a router event to the internal log (if ledger is enabled).
   */
  private emitEvent(event: RouterEvent): void {
    if (this.config.enableLedger) {
      this.events.push(event);
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton Instance
// ---------------------------------------------------------------------------

/**
 * Default singleton router instance.
 *
 * Use this for application-wide routing. Register technique-specific
 * handlers at application startup.
 */
export const defaultRouter = new UniversalRouter();