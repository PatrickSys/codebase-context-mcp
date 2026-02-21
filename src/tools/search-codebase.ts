/* eslint-disable @typescript-eslint/no-explicit-any */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { promises as fs } from 'fs';
import path from 'path';
import type { ToolContext, ToolResponse } from './types.js';
import { CodebaseSearcher } from '../core/search.js';
import { buildEvidenceLock } from '../preflight/evidence-lock.js';
import { shouldIncludePatternConflictCategory } from '../preflight/query-scope.js';
import {
  isComplementaryPatternCategory,
  isComplementaryPatternConflict,
  shouldSkipLegacyTestingFrameworkCategory
} from '../patterns/semantics.js';
import { assessSearchQuality } from '../core/search-quality.js';
import { IndexCorruptedError } from '../errors/index.js';
import { readMemoriesFile, withConfidence } from '../memory/store.js';
import { InternalFileGraph } from '../utils/usage-tracker.js';
import { RELATIONSHIPS_FILENAME } from '../constants/codebase-context.js';

export const definition: Tool = {
  name: 'search_codebase',
  description:
    'Search the indexed codebase. Returns ranked results and a searchQuality confidence summary. ' +
    'IMPORTANT: Pass the intent="edit"|"refactor"|"migrate" to get preflight: edit readiness check with evidence gating.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Natural language search query'
      },
      intent: {
        type: 'string',
        enum: ['explore', 'edit', 'refactor', 'migrate'],
        description:
          'Optional. Use "edit", "refactor", or "migrate" to get the full preflight card before making changes.'
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results to return (default: 5)',
        default: 5
      },
      includeSnippets: {
        type: 'boolean',
        description:
          'Include code snippets in results (default: false). If you need code, prefer read_file instead.',
        default: false
      },
      filters: {
        type: 'object',
        description: 'Optional filters',
        properties: {
          framework: {
            type: 'string',
            description: 'Filter by framework (angular, react, vue)'
          },
          language: {
            type: 'string',
            description: 'Filter by programming language'
          },
          componentType: {
            type: 'string',
            description: 'Filter by component type (component, service, directive, etc.)'
          },
          layer: {
            type: 'string',
            description:
              'Filter by architectural layer (presentation, business, data, state, core, shared)'
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Filter by tags'
          }
        }
      }
    },
    required: ['query']
  }
};

export async function handle(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolResponse> {
  const { query, limit, filters, intent, includeSnippets } = args as any;
  const queryStr = typeof query === 'string' ? query.trim() : '';

  if (!queryStr) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              status: 'error',
              errorCode: 'invalid_params',
              message: "Invalid params: 'query' is required and must be a non-empty string.",
              hint: "Provide a query like 'how are routes configured' or 'AlbumApiService'."
            },
            null,
            2
          )
        }
      ],
      isError: true
    };
  }

  if (ctx.indexState.status === 'indexing') {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              status: 'indexing',
              message: 'Index is still being built. Retry in a moment.',
              progress: ctx.indexState.indexer?.getProgress()
            },
            null,
            2
          )
        }
      ]
    };
  }

  if (ctx.indexState.status === 'error') {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              status: 'error',
              message: `Indexing failed: ${ctx.indexState.error}`
            },
            null,
            2
          )
        }
      ]
    };
  }

  const searcher = new CodebaseSearcher(ctx.rootPath);
  let results: any[];
  const searchProfile =
    intent && ['explore', 'edit', 'refactor', 'migrate'].includes(intent) ? intent : 'explore';

  try {
    results = await searcher.search(queryStr, limit || 5, filters, {
      profile: searchProfile
    });
  } catch (error) {
    if (error instanceof IndexCorruptedError) {
      console.error('[Auto-Heal] Index corrupted. Triggering full re-index...');

      await ctx.performIndexing();

      if (ctx.indexState.status === 'ready') {
        console.error('[Auto-Heal] Success. Retrying search...');
        const freshSearcher = new CodebaseSearcher(ctx.rootPath);
        try {
          results = await freshSearcher.search(queryStr, limit || 5, filters, {
            profile: searchProfile
          });
        } catch (retryError) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    status: 'error',
                    message: `Auto-heal retry failed: ${
                      retryError instanceof Error ? retryError.message : String(retryError)
                    }`
                  },
                  null,
                  2
                )
              }
            ]
          };
        }
      } else {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  status: 'error',
                  message: `Auto-heal failed: Indexing ended with status '${ctx.indexState.status}'`,
                  error: ctx.indexState.error
                },
                null,
                2
              )
            }
          ]
        };
      }
    } else {
      throw error; // Propagate unexpected errors
    }
  }

  // Load memories for keyword matching, enriched with confidence
  const allMemories = await readMemoriesFile(ctx.paths.memory);
  const allMemoriesWithConf = withConfidence(allMemories);

  const queryTerms = queryStr.toLowerCase().split(/\s+/).filter(Boolean);
  const relatedMemories = allMemoriesWithConf
    .filter((m) => {
      const searchText = `${m.memory} ${m.reason}`.toLowerCase();
      return queryTerms.some((term: string) => searchText.includes(term));
    })
    .sort((a, b) => b.effectiveConfidence - a.effectiveConfidence);

  // Load intelligence data for enrichment (all intents, not just preflight)
  let intelligence: any = null;
  try {
    const intelligenceContent = await fs.readFile(ctx.paths.intelligence, 'utf-8');
    intelligence = JSON.parse(intelligenceContent);
  } catch {
    /* graceful degradation — intelligence file may not exist yet */
  }

  // Load relationships sidecar (preferred over intelligence.internalFileGraph)
  let relationships: any = null;
  try {
    const relationshipsPath = path.join(
      path.dirname(ctx.paths.intelligence),
      RELATIONSHIPS_FILENAME
    );
    const relationshipsContent = await fs.readFile(relationshipsPath, 'utf-8');
    relationships = JSON.parse(relationshipsContent);
  } catch {
    /* graceful degradation — relationships sidecar may not exist yet */
  }

  // Helper to get imports graph from relationships sidecar (preferred) or intelligence
  function getImportsGraph(): Record<string, string[]> | null {
    if (relationships?.graph?.imports) {
      return relationships.graph.imports as Record<string, string[]>;
    }
    if (intelligence?.internalFileGraph?.imports) {
      return intelligence.internalFileGraph.imports as Record<string, string[]>;
    }
    return null;
  }

  function computeIndexConfidence(): 'fresh' | 'aging' | 'stale' {
    let confidence: 'fresh' | 'aging' | 'stale' = 'stale';
    if (intelligence?.generatedAt) {
      const indexAge = Date.now() - new Date(intelligence.generatedAt).getTime();
      const hoursOld = indexAge / (1000 * 60 * 60);
      if (hoursOld < 24) {
        confidence = 'fresh';
      } else if (hoursOld < 168) {
        confidence = 'aging';
      }
    }
    return confidence;
  }

  // Cheap impact breadth estimate from the import graph (used for risk assessment).
  function computeImpactCandidates(resultPaths: string[]): string[] {
    const impactCandidates: string[] = [];
    const allImports = getImportsGraph();
    if (!allImports) return impactCandidates;
    for (const [file, deps] of Object.entries(allImports)) {
      if (
        deps.some((dep: string) => resultPaths.some((rp) => dep.endsWith(rp) || rp.endsWith(dep)))
      ) {
        if (!resultPaths.some((rp) => file.endsWith(rp) || rp.endsWith(file))) {
          impactCandidates.push(file);
        }
      }
    }
    return impactCandidates;
  }

  // Build reverse import map from relationships sidecar (preferred) or intelligence graph
  const reverseImports = new Map<string, string[]>();
  const importsGraph = getImportsGraph();
  if (importsGraph) {
    for (const [file, deps] of Object.entries<string[]>(importsGraph)) {
      for (const dep of deps) {
        if (!reverseImports.has(dep)) reverseImports.set(dep, []);
        reverseImports.get(dep)!.push(file);
      }
    }
  }

  // Enrich a search result with relationship data
  function enrichResult(r: any): any | undefined {
    const rPath = r.filePath;

    // importedBy: files that import this result (reverse lookup)
    const importedBy: string[] = [];
    for (const [dep, importers] of reverseImports) {
      if (dep.endsWith(rPath) || rPath.endsWith(dep)) {
        importedBy.push(...importers);
      }
    }

    // imports: files this result depends on (forward lookup)
    const imports: string[] = [];
    if (importsGraph) {
      for (const [file, deps] of Object.entries<string[]>(importsGraph)) {
        if (file.endsWith(rPath) || rPath.endsWith(file)) {
          imports.push(...deps);
        }
      }
    }

    // testedIn: heuristic — same basename with .spec/.test extension
    const testedIn: string[] = [];
    const baseName = path.basename(rPath).replace(/\.[^.]+$/, '');
    if (importsGraph) {
      for (const file of Object.keys(importsGraph)) {
        const fileBase = path.basename(file);
        if (
          (fileBase.includes('.spec.') || fileBase.includes('.test.')) &&
          fileBase.startsWith(baseName)
        ) {
          testedIn.push(file);
        }
      }
    }

    // Only return if we have at least one piece of data
    if (importedBy.length === 0 && imports.length === 0 && testedIn.length === 0) {
      return undefined;
    }

    return {
      ...(importedBy.length > 0 && { importedBy }),
      ...(imports.length > 0 && { imports }),
      ...(testedIn.length > 0 && { testedIn })
    };
  }

  const searchQuality = assessSearchQuality(query, results);

  // Always-on edit preflight (lite): do not require intent and keep payload small.
  let editPreflight: any = undefined;
  if (intelligence && (!intent || intent === 'explore')) {
    try {
      const resultPaths = results.map((r) => r.filePath);
      const impactCandidates = computeImpactCandidates(resultPaths);

      let riskLevel: 'low' | 'medium' | 'high' = 'low';
      if (impactCandidates.length > 10) {
        riskLevel = 'high';
      } else if (impactCandidates.length > 3) {
        riskLevel = 'medium';
      }

      // Use existing pattern intelligence for evidenceLock scoring, but keep the output payload lite.
      const preferredPatternsForEvidence: Array<{ pattern: string; example?: string }> = [];
      const patterns = intelligence.patterns || {};
      for (const [_, data] of Object.entries<any>(patterns)) {
        if (data.primary) {
          const p = data.primary;
          if (p.trend === 'Rising' || p.trend === 'Stable') {
            preferredPatternsForEvidence.push({
              pattern: p.name,
              ...(p.canonicalExample && { example: p.canonicalExample.file })
            });
          }
        }
      }

      editPreflight = {
        mode: 'lite',
        riskLevel,
        confidence: computeIndexConfidence(),
        evidenceLock: buildEvidenceLock({
          results,
          preferredPatterns: preferredPatternsForEvidence.slice(0, 5),
          relatedMemories,
          failureWarnings: [],
          patternConflicts: [],
          searchQualityStatus: searchQuality.status
        })
      };
    } catch {
      // editPreflight is best-effort - never fail search over it
    }
  }

  // Compose preflight card for edit/refactor/migrate intents
  let preflight: any = undefined;
  const preflightIntents = ['edit', 'refactor', 'migrate'];
  if (intent && preflightIntents.includes(intent) && intelligence) {
    try {
      // --- Avoid / Prefer patterns ---
      const avoidPatterns: any[] = [];
      const preferredPatterns: any[] = [];
      const patterns = intelligence.patterns || {};
      for (const [category, data] of Object.entries<any>(patterns)) {
        // Primary pattern = preferred if Rising or Stable
        if (data.primary) {
          const p = data.primary;
          if (p.trend === 'Rising' || p.trend === 'Stable') {
            preferredPatterns.push({
              pattern: p.name,
              category,
              adoption: p.frequency,
              trend: p.trend,
              guidance: p.guidance,
              ...(p.canonicalExample && { example: p.canonicalExample.file })
            });
          }
        }
        // Also-detected patterns that are Declining = avoid
        if (data.alsoDetected) {
          for (const alt of data.alsoDetected) {
            if (alt.trend === 'Declining') {
              avoidPatterns.push({
                pattern: alt.name,
                category,
                adoption: alt.frequency,
                trend: 'Declining',
                guidance: alt.guidance
              });
            }
          }
        }
      }

      // --- Impact candidates (files importing the result files) ---
      const resultPaths = results.map((r) => r.filePath);
      const impactCandidates = computeImpactCandidates(resultPaths);

      // --- Risk level (based on circular deps + impact breadth) ---
      let riskLevel: 'low' | 'medium' | 'high' = 'low';
      let cycleCount = 0;
      const graphDataSource = relationships?.graph || intelligence?.internalFileGraph;
      if (graphDataSource) {
        try {
          const graph = InternalFileGraph.fromJSON(graphDataSource, ctx.rootPath);
          // Use directory prefixes as scope (not full file paths)
          // findCycles(scope) filters files by startsWith, so a full path would only match itself
          const scopes = new Set(
            resultPaths.map((rp) => {
              const lastSlash = rp.lastIndexOf('/');
              return lastSlash > 0 ? rp.substring(0, lastSlash + 1) : rp;
            })
          );
          for (const scope of scopes) {
            const cycles = graph.findCycles(scope);
            cycleCount += cycles.length;
          }
        } catch {
          // Graph reconstruction failed — skip cycle check
        }
      }
      if (cycleCount > 0 || impactCandidates.length > 10) {
        riskLevel = 'high';
      } else if (impactCandidates.length > 3) {
        riskLevel = 'medium';
      }

      // --- Golden files (exemplar code) ---
      const goldenFiles = (intelligence.goldenFiles || []).slice(0, 3).map((g: any) => ({
        file: g.file,
        score: g.score
      }));

      // --- Confidence (index freshness) ---
      const confidence = computeIndexConfidence();

      // --- Failure memories (1.5x relevance boost) ---
      const failureWarnings = relatedMemories
        .filter((m) => m.type === 'failure' && !m.stale)
        .map((m) => ({
          memory: m.memory,
          reason: m.reason,
          confidence: m.effectiveConfidence
        }))
        .slice(0, 3);

      const preferredPatternsForOutput = preferredPatterns.slice(0, 5);
      const avoidPatternsForOutput = avoidPatterns.slice(0, 5);

      // --- Pattern conflicts (split decisions within categories) ---
      const patternConflicts: Array<{
        category: string;
        primary: { name: string; adoption: string };
        alternative: { name: string; adoption: string };
      }> = [];
      const hasUnitTestFramework = Boolean((patterns as any).unitTestFramework?.primary);
      for (const [cat, data] of Object.entries<any>(patterns)) {
        if (shouldSkipLegacyTestingFrameworkCategory(cat, patterns as any)) continue;
        if (!shouldIncludePatternConflictCategory(cat, query)) continue;
        if (!data.primary || !data.alsoDetected?.length) continue;
        const primaryFreq = parseFloat(data.primary.frequency) || 100;
        if (primaryFreq >= 80) continue;
        for (const alt of data.alsoDetected) {
          const altFreq = parseFloat(alt.frequency) || 0;
          if (altFreq >= 20) {
            if (isComplementaryPatternConflict(cat, data.primary.name, alt.name)) continue;
            if (hasUnitTestFramework && cat === 'testingFramework') continue;
            patternConflicts.push({
              category: cat,
              primary: { name: data.primary.name, adoption: data.primary.frequency },
              alternative: { name: alt.name, adoption: alt.frequency }
            });
          }
        }
      }

      const evidenceLock = buildEvidenceLock({
        results,
        preferredPatterns: preferredPatternsForOutput,
        relatedMemories,
        failureWarnings,
        patternConflicts,
        searchQualityStatus: searchQuality.status
      });

      // Bump risk if there are active failure memories for this area
      if (failureWarnings.length > 0 && riskLevel === 'low') {
        riskLevel = 'medium';
      }

      // If evidence triangulation is weak, avoid claiming low risk
      if (evidenceLock.status === 'block' && riskLevel === 'low') {
        riskLevel = 'medium';
      }

      // If epistemic stress says abstain, bump risk
      if (evidenceLock.epistemicStress?.abstain && riskLevel === 'low') {
        riskLevel = 'medium';
      }

      preflight = {
        intent,
        riskLevel,
        confidence,
        evidenceLock,
        ...(preferredPatternsForOutput.length > 0 && {
          preferredPatterns: preferredPatternsForOutput
        }),
        ...(avoidPatternsForOutput.length > 0 && {
          avoidPatterns: avoidPatternsForOutput
        }),
        ...(goldenFiles.length > 0 && { goldenFiles }),
        ...(impactCandidates.length > 0 && {
          impactCandidates: impactCandidates.slice(0, 10)
        }),
        ...(cycleCount > 0 && { circularDependencies: cycleCount }),
        ...(failureWarnings.length > 0 && { failureWarnings })
      };
    } catch {
      // Preflight construction failed — skip preflight, don't fail the search
    }
  }

  // For edit/refactor/migrate: return full preflight card (risk, patterns, impact, etc.).
  // For explore or lite-only: return flattened { ready, reason }.
  let preflightPayload: { ready: boolean; reason?: string } | Record<string, unknown> | undefined;
  if (preflight) {
    const el = preflight.evidenceLock;
    // Full card per tool schema; add top-level ready/reason for backward compatibility
    preflightPayload = {
      ...preflight,
      ready: el?.readyToEdit ?? false,
      ...(el && !el.readyToEdit && el.nextAction && { reason: el.nextAction })
    };
  } else if (editPreflight) {
    const el = editPreflight.evidenceLock;
    preflightPayload = {
      ready: el?.readyToEdit ?? false,
      ...(el && !el.readyToEdit && el.nextAction && { reason: el.nextAction })
    };
  }

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            status: 'success',
            searchQuality: {
              status: searchQuality.status,
              confidence: searchQuality.confidence,
              ...(searchQuality.status === 'low_confidence' &&
                searchQuality.nextSteps?.[0] && {
                  hint: searchQuality.nextSteps[0]
                })
            },
            ...(preflightPayload && { preflight: preflightPayload }),
            results: results.map((r) => {
              const relationships = enrichResult(r);
              // Condensed relationships: importedBy count + hasTests flag
              const condensedRel = relationships
                ? {
                    ...(relationships.importedBy &&
                      relationships.importedBy.length > 0 && {
                        importedByCount: relationships.importedBy.length
                      }),
                    ...(relationships.testedIn &&
                      relationships.testedIn.length > 0 && { hasTests: true })
                  }
                : undefined;
              const hasCondensedRel = condensedRel && Object.keys(condensedRel).length > 0;

              return {
                file: `${r.filePath}:${r.startLine}-${r.endLine}`,
                summary: r.summary,
                score: Math.round(r.score * 100) / 100,
                ...(r.componentType && r.layer && { type: `${r.componentType}:${r.layer}` }),
                ...(r.trend && r.trend !== 'Stable' && { trend: r.trend }),
                ...(r.patternWarning && { patternWarning: r.patternWarning }),
                ...(hasCondensedRel && { relationships: condensedRel }),
                ...(includeSnippets && r.snippet && { snippet: r.snippet })
              };
            }),
            totalResults: results.length,
            ...(relatedMemories.length > 0 && {
              relatedMemories: relatedMemories
                .slice(0, 3)
                .map((m) => `${m.memory} (${m.effectiveConfidence})`)
            })
          },
          null,
          2
        )
      }
    ]
  };
}
