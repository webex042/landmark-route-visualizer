/* ===========================================================================
 * ANALYTICS + EXPORT
 * Every figure here is read off an actual SearchResult produced by the engine.
 * Nothing is estimated, rounded up for effect, or hard-coded.
 * ========================================================================= */

import { Graph, labelOf } from './graph';
import { SearchResult, formatDuration } from './searchEngine';
import { HeuristicKind, HEURISTIC_META } from './heuristics';

export interface MetricRow { label: string; value: string; hint?: string; accent?: string }

export function metricRows(g: Graph, r: SearchResult): MetricRow[] {
  const pathText = r.success ? r.path.map((id) => labelOf(g, id)).join(' → ') : '—';
  return [
    { label: 'Search outcome', value: r.success ? 'ROUTE FOUND' : 'NO ROUTE', accent: r.success ? '#72E6A1' : '#FF647C', hint: r.failureReason },
    { label: 'Total nodes', value: String(r.totalNodes), hint: 'Nodes in the graph.' },
    { label: 'Total edges', value: String(r.totalEdges), hint: 'Connections in the graph, counted once each.' },
    { label: 'Nodes visited', value: String(r.nodesVisited), hint: 'Removed from the frontier for examination, including the destination.' },
    { label: 'Nodes expanded', value: String(r.nodesExpanded), hint: 'Examined and had their neighbours generated. The destination is not expanded — the search stops there.' },
    { label: 'Nodes explored', value: String(r.nodesExplored), hint: 'Size of the explored set when the search ended.' },
    { label: 'Nodes generated', value: String(r.nodesGenerated), hint: 'Distinct nodes ever inserted into the frontier.' },
    { label: 'Heuristic evaluations', value: String(r.heuristicEvals), hint: 'Distinct h(n) computations; results are cached per node.' },
    { label: 'Execution time', value: formatDuration(r.executionTimeMs), hint: `Time for one run of the algorithm: the median of batched, untraced runs (${r.timingRuns} runs in total), measured identically for every heuristic.` },
    { label: 'Route', value: pathText, accent: '#72E6A1' },
    { label: 'Edges in route', value: r.success ? String(r.pathEdgeCount) : '—' },
    { label: 'Actual path cost  g', value: r.success ? String(r.pathCost) : '—', accent: '#FFB547', hint: 'Sum of the edge weights along the returned route. Accumulated cost never influenced the search.' },
    { label: 'Optimal cost (Dijkstra)', value: r.optimalCost === null ? '—' : String(r.optimalCost), accent: '#43D9E8', hint: 'Computed separately for reference only.' },
    {
      label: 'Route optimal?',
      value: r.isOptimal === null ? '—' : r.isOptimal ? 'YES' : `NO  (+${(r.pathCost - (r.optimalCost ?? 0)).toFixed(2)})`,
      accent: r.isOptimal ? '#72E6A1' : '#FF647C',
      hint: 'Greedy Best-First Search offers no optimality guarantee; this compares its route with the true shortest path.',
    },
  ];
}

/* ── Export ──────────────────────────────────────────────────────────────── */

function resultRecord(g: Graph, r: SearchResult) {
  return {
    heuristic: HEURISTIC_META[r.heuristicKind].name,
    evaluationFunction: 'f(n) = h(n)',
    success: r.success,
    failureReason: r.failureReason ?? null,
    route: r.path.map((id) => labelOf(g, id)),
    actualPathCost: r.success ? r.pathCost : null,
    edgesInRoute: r.success ? r.pathEdgeCount : null,
    optimalCost: r.optimalCost,
    optimalRoute: r.optimalPath.map((id) => labelOf(g, id)),
    routeIsOptimal: r.isOptimal,
    totalNodes: r.totalNodes,
    totalEdges: r.totalEdges,
    nodesVisited: r.nodesVisited,
    nodesExpanded: r.nodesExpanded,
    nodesExplored: r.nodesExplored,
    nodesGenerated: r.nodesGenerated,
    heuristicEvaluations: r.heuristicEvals,
    executionTimeMsPerRun: r.executionTimeMs,
    timingRunsSampled: r.timingRuns,
    algorithmSteps: r.steps.length,
  };
}

export function buildJSONExport(g: Graph, results: SearchResult[]) {
  return JSON.stringify({
    project: 'BEST FIRST SEARCH IN ROUTE FINDING WITH LANDMARK HEURISTIC VISUALIZATION',
    team: 'DEEP FORGE',
    institution: 'Birla Institute of Technology, Mesra',
    algorithm: 'Greedy Best-First Search',
    exportedAt: new Date().toISOString(),
    graph: {
      nodes: g.nodes.map((n) => ({ label: n.label, x: n.x, y: n.y })),
      edges: g.edges.map((e) => ({ from: labelOf(g, e.a), to: labelOf(g, e.b), weight: e.weight })),
      start: labelOf(g, g.startId),
      destination: labelOf(g, g.goalId),
      landmarks: g.landmarkIds.map((id) => labelOf(g, id)),
    },
    results: results.map((r) => resultRecord(g, r)),
  }, null, 2);
}

export function buildCSVExport(g: Graph, results: SearchResult[]): string {
  const cells = [
    'heuristic', 'success', 'route', 'actual_path_cost', 'edges_in_route',
    'optimal_cost', 'route_is_optimal', 'total_nodes', 'total_edges',
    'nodes_visited', 'nodes_expanded', 'nodes_explored', 'nodes_generated',
    'heuristic_evaluations', 'execution_time_ms_per_run', 'timing_runs_sampled',
  ];
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [cells.join(',')];
  for (const r of results) {
    const rec = resultRecord(g, r);
    lines.push([
      rec.heuristic, rec.success, rec.route.join(' > '), rec.actualPathCost ?? '', rec.edgesInRoute ?? '',
      rec.optimalCost ?? '', rec.routeIsOptimal ?? '', rec.totalNodes, rec.totalEdges,
      rec.nodesVisited, rec.nodesExpanded, rec.nodesExplored, rec.nodesGenerated,
      rec.heuristicEvaluations, rec.executionTimeMsPerRun, rec.timingRunsSampled,
    ].map(esc).join(','));
  }
  return lines.join('\n');
}

export function download(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export const stamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
