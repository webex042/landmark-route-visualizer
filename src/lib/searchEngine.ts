/* ===========================================================================
 * GREEDY BEST-FIRST SEARCH ENGINE
 *
 * Evaluation function:  f(n) = h(n)
 * The accumulated path cost g(n) is tracked and reported, but it NEVER
 * influences which node is selected — that is what makes this greedy
 * best-first search rather than A* (f = g + h) or Dijkstra (f = g).
 *
 * The engine is completely independent of the rendering layer. It returns an
 * immutable array of full state snapshots, so stepping backwards restores a
 * real algorithm state instead of rewinding an animation.
 * ========================================================================= */

import { Graph, buildAdjacency, edgeBetween } from './graph';
import { PriorityQueue } from './priorityQueue';
import { LandmarkTable, optimalPath } from './dijkstra';
import { HeuristicKind, makeHeuristic, round2 } from './heuristics';

/* ── Pseudocode shown next to the graph; indices are the highlight targets ── */
export const PSEUDOCODE: string[] = [
  'frontier ← priority queue ordered by h(n)',
  'push(frontier, start, h(start))',
  'explored ← ∅',
  'while frontier is not empty do',
  '    n ← pop node with smallest h(n)',
  '    if n = goal then return reconstruct(n)',
  '    add n to explored',
  '    for each neighbour m of n do',
  '        if m ∉ explored and m ∉ frontier then',
  '            parent[m] ← n',
  '            push(frontier, m, h(m))',
  'return failure',
];

export type Phase = 'init' | 'select' | 'expand' | 'success' | 'failure';

export interface FrontierEntry { nodeId: string; h: number; parentId: string | null; g: number }

export interface NeighbourInfo {
  nodeId: string;
  h: number;
  weight: number;
  status: 'added' | 'already-in-frontier' | 'already-explored';
}

/** A complete, self-contained snapshot of the algorithm's state. */
export interface SearchStep {
  index: number;
  phase: Phase;
  title: string;
  pseudocodeLines: number[];
  currentId: string | null;
  selectedId: string | null;
  frontier: FrontierEntry[];
  explored: string[];
  parents: Record<string, string>;
  gCost: Record<string, number>;
  neighbours: NeighbourInfo[];
  decision: string;
  activeEdgeIds: string[];
  path: string[] | null;
  pathEdgeIds: string[];
  heuristicEvals: number;
  iteration: number;
}

export interface SearchResult {
  steps: SearchStep[];
  success: boolean;
  path: string[];
  pathEdgeIds: string[];
  pathCost: number;
  pathEdgeCount: number;
  heuristicKind: HeuristicKind;
  nodesVisited: number;    // popped from the frontier (goal included)
  nodesExpanded: number;   // popped and had their neighbours generated
  nodesExplored: number;   // size of the explored set when the search ended
  nodesGenerated: number;  // distinct nodes ever inserted into the frontier
  heuristicEvals: number;
  executionTimeMs: number; // per-run median, see `timeSearch`
  timingRuns: number;      // how many untraced runs that median was taken over
  totalNodes: number;
  totalEdges: number;
  optimalCost: number | null;
  optimalPath: string[];
  isOptimal: boolean | null;
  failureReason?: string;
}

/* ── Core search ─────────────────────────────────────────────────────────── */

interface RunOptions { trace: boolean; table?: LandmarkTable }

function runGBFS(g: Graph, kind: HeuristicKind, opts: RunOptions) {
  const startId = g.startId!, goalId = g.goalId!;
  const adj = buildAdjacency(g);
  const label = (id: string) => g.nodes.find((n) => n.id === id)?.label ?? id;

  const table = opts.table ?? (kind === 'landmark' ? new LandmarkTable(g, g.landmarkIds) : undefined);
  const rawH = makeHeuristic(kind, g, goalId, table);
  let heuristicEvals = 0;
  const hCache = new Map<string, number>();
  const h = (id: string): number => {
    const cached = hCache.get(id);
    if (cached !== undefined) return cached;
    heuristicEvals++;
    const value = round2(rawH(id));
    hCache.set(id, value);
    return value;
  };

  const frontier = new PriorityQueue<string>();
  const inFrontier = new Set<string>();
  const explored = new Set<string>();
  const parents = new Map<string, string>();
  const gCost = new Map<string, number>([[startId, 0]]);
  const generated = new Set<string>([startId]);

  const steps: SearchStep[] = [];
  let iteration = 0;
  let nodesVisited = 0, nodesExpanded = 0;

  const frontierView = (): FrontierEntry[] =>
    frontier.toSortedArray().map((e) => ({
      nodeId: e.item, h: e.priority,
      parentId: parents.get(e.item) ?? null,
      g: gCost.get(e.item) ?? 0,
    }));

  const record = (s: Omit<SearchStep, 'index' | 'frontier' | 'explored' | 'parents' | 'gCost' | 'heuristicEvals' | 'iteration'>) => {
    if (!opts.trace) return;
    steps.push({
      ...s,
      index: steps.length,
      frontier: frontierView(),
      explored: [...explored],
      parents: Object.fromEntries(parents),
      gCost: Object.fromEntries(gCost),
      heuristicEvals,
      iteration,
    });
  };

  const reconstruct = (endId: string): string[] => {
    const path: string[] = [];
    let cur: string | undefined = endId;
    const guard = g.nodes.length + 1;
    for (let i = 0; cur !== undefined && i <= guard; i++) {
      path.unshift(cur);
      if (cur === startId) break;
      cur = parents.get(cur);
    }
    return path[0] === startId ? path : [];
  };

  const pathEdges = (path: string[]): string[] => {
    const ids: string[] = [];
    for (let i = 0; i + 1 < path.length; i++) {
      const e = edgeBetween(g, path[i], path[i + 1]);
      if (e) ids.push(e.id);
    }
    return ids;
  };

  const pathCostOf = (path: string[]): number => {
    let total = 0;
    for (let i = 0; i + 1 < path.length; i++) total += edgeBetween(g, path[i], path[i + 1])?.weight ?? 0;
    return round2(total);
  };

  /* ── Initialisation ──────────────────────────────────────────────────── */
  const h0 = h(startId);
  frontier.push(startId, h0, label(startId));
  inFrontier.add(startId);

  record({
    phase: 'init',
    title: 'Initialise the search',
    pseudocodeLines: [0, 1, 2],
    currentId: null, selectedId: null, neighbours: [],
    decision: `The frontier is created as a priority queue ordered by h(n), and the start node ${label(startId)} is inserted with h(${label(startId)}) = ${h0}. The explored set begins empty. Greedy Best-First Search will always take the frontier node with the smallest heuristic value, so no accumulated cost is stored for ordering purposes.`,
    activeEdgeIds: [], path: null, pathEdgeIds: [],
  });

  /* ── Main loop ───────────────────────────────────────────────────────── */
  const maxIterations = g.nodes.length * 4 + 16; // hard safety bound

  while (!frontier.isEmpty) {
    if (iteration > maxIterations) break; // unreachable in practice; guards against pathological input
    iteration++;

    const snapshotBefore = frontierView();
    const popped = frontier.pop()!;
    const u = popped.item;
    inFrontier.delete(u);
    nodesVisited++;

    const ranked = [...snapshotBefore].sort((a, b) => a.h - b.h || (label(a.nodeId) < label(b.nodeId) ? -1 : 1));
    const competitors = ranked.slice(1, 4)
      .map((e) => `${label(e.nodeId)} (h = ${e.h})`).join(', ');
    const selectReason = ranked.length === 1
      ? `${label(u)} is the only node in the frontier, so it is selected with h(${label(u)}) = ${popped.priority}.`
      : `Among the ${ranked.length} nodes in the frontier, ${label(u)} has the smallest heuristic value h = ${popped.priority}${competitors ? `, ahead of ${competitors}` : ''}. Note that the choice is made across the whole frontier, not only among the neighbours of the previous node.`;

    record({
      phase: 'select',
      title: `Select the most promising frontier node`,
      pseudocodeLines: [3, 4],
      currentId: u, selectedId: u, neighbours: [],
      decision: selectReason,
      activeEdgeIds: [], path: null, pathEdgeIds: [],
    });

    /* Goal test happens when a node is selected for expansion. */
    if (u === goalId) {
      const path = reconstruct(u);
      const edges = pathEdges(path);
      record({
        phase: 'success',
        title: 'Destination reached',
        pseudocodeLines: [5],
        currentId: u, selectedId: u, neighbours: [],
        decision: `${label(u)} is the destination, so the search stops and the route is rebuilt by following parent pointers back to ${label(startId)}: ${path.map(label).join(' → ')}. Its actual accumulated cost is g = ${pathCostOf(path)}. Greedy Best-First Search returns the first route it finds to the goal, which is not necessarily the cheapest one.`,
        activeEdgeIds: edges, path, pathEdgeIds: edges,
      });
      return { steps, success: true, path, pathEdgeIds: edges, pathCost: pathCostOf(path), heuristicEvals, nodesVisited, nodesExpanded, nodesExplored: explored.size, nodesGenerated: generated.size };
    }

    explored.add(u);
    nodesExpanded++;

    /* ── Expansion ─────────────────────────────────────────────────────── */
    const neighbours: NeighbourInfo[] = [];
    const activeEdgeIds: string[] = [];
    const gu = gCost.get(u) ?? 0;

    for (const { to, weight, edgeId } of adj.get(u) ?? []) {
      activeEdgeIds.push(edgeId);
      if (explored.has(to)) { neighbours.push({ nodeId: to, h: h(to), weight, status: 'already-explored' }); continue; }
      if (inFrontier.has(to)) { neighbours.push({ nodeId: to, h: h(to), weight, status: 'already-in-frontier' }); continue; }
      const hv = h(to);
      parents.set(to, u);
      gCost.set(to, round2(gu + weight));
      generated.add(to);
      frontier.push(to, hv, label(to));
      inFrontier.add(to);
      neighbours.push({ nodeId: to, h: hv, weight, status: 'added' });
    }

    const added = neighbours.filter((n) => n.status === 'added');
    const skipped = neighbours.filter((n) => n.status !== 'added');
    const bestAdded = added.length ? added.reduce((lo, n) => (n.h < lo.h ? n : lo)) : null;

    let decision: string;
    if (!neighbours.length) {
      decision = `${label(u)} has no connections, so nothing is added to the frontier. ${label(u)} moves into the explored set and the search continues with whatever remains in the frontier.`;
    } else if (!added.length) {
      decision = `All ${neighbours.length} neighbour(s) of ${label(u)} are already explored or already waiting in the frontier, so nothing new is generated. ${label(u)} joins the explored set.`;
    } else {
      decision = `${label(u)} is moved to the explored set and its ${added.length} new neighbour(s) enter the frontier with their heuristic values: ${added.map((n) => `${label(n.nodeId)} (h = ${n.h})`).join(', ')}.${skipped.length ? ` ${skipped.map((n) => label(n.nodeId)).join(', ')} ${skipped.length === 1 ? 'is' : 'are'} skipped as already explored or already queued.` : ''} ${bestAdded ? `${label(bestAdded.nodeId)} is the most promising of the new arrivals, but it only wins the next round if no other frontier node has a smaller h.` : ''}`;
    }

    record({
      phase: 'expand',
      title: `Expand ${label(u)}`,
      pseudocodeLines: [6, 7, 8, 9, 10],
      currentId: u, selectedId: null, neighbours,
      decision,
      activeEdgeIds, path: null, pathEdgeIds: [],
    });
  }

  /* ── Failure ─────────────────────────────────────────────────────────── */
  record({
    phase: 'failure',
    title: 'No route exists',
    pseudocodeLines: [11],
    currentId: null, selectedId: null, neighbours: [],
    decision: `The frontier is empty and the destination ${label(goalId)} was never selected. Every node reachable from ${label(startId)} has been explored, so no route connects the two — the search correctly reports failure rather than inventing a path.`,
    activeEdgeIds: [], path: null, pathEdgeIds: [],
  });

  return { steps, success: false, path: [] as string[], pathEdgeIds: [] as string[], pathCost: 0, heuristicEvals, nodesVisited, nodesExpanded, nodesExplored: explored.size, nodesGenerated: generated.size };
}

/* ── Timing: identical methodology for every heuristic ───────────────────── */

/** Browser clocks are coarse — a single run of a small search finishes well
 *  below their resolution and would be reported as 0.000 ms, which would be a
 *  fabricated-looking number. So the run is repeated until a batch takes long
 *  enough to measure honestly, and the per-run time is the median of several
 *  such batches divided by the batch size. The same procedure is applied to
 *  every heuristic, so the comparison stays fair.
 *  Snapshot recording is off throughout: this measures the algorithm, not the UI. */
export interface Timing { msPerRun: number; runs: number }

function timeSearch(g: Graph, kind: HeuristicKind, table?: LandmarkTable): Timing {
  const once = () => runGBFS(g, kind, { trace: false, table });
  once(); // warm-up: let the JIT settle before measuring

  const TARGET_MS = 4;
  let iters = 1;
  for (let guard = 0; guard < 22; guard++) {
    const t0 = performance.now();
    for (let i = 0; i < iters; i++) once();
    if (performance.now() - t0 >= TARGET_MS) break;
    iters *= 2;
  }

  const samples: number[] = [];
  for (let batch = 0; batch < 5; batch++) {
    const t0 = performance.now();
    for (let i = 0; i < iters; i++) once();
    samples.push((performance.now() - t0) / iters);
  }
  samples.sort((a, b) => a - b);
  return { msPerRun: samples[Math.floor(samples.length / 2)], runs: iters * 5 };
}

/** Human-readable duration that never collapses to a meaningless 0.000 ms. */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  if (ms >= 1) return `${ms.toFixed(2)} ms`;
  if (ms >= 0.001) return `${(ms * 1000).toFixed(1)} µs`;
  return `${Math.round(ms * 1e6)} ns`;
}

/* ── Public entry point ──────────────────────────────────────────────────── */

export function search(g: Graph, kind: HeuristicKind): SearchResult {
  const base: SearchResult = {
    steps: [], success: false, path: [], pathEdgeIds: [], pathCost: 0, pathEdgeCount: 0,
    heuristicKind: kind, nodesVisited: 0, nodesExpanded: 0, nodesExplored: 0, nodesGenerated: 0,
    heuristicEvals: 0, executionTimeMs: 0, timingRuns: 0, totalNodes: g.nodes.length, totalEdges: g.edges.length,
    optimalCost: null, optimalPath: [], isOptimal: null,
  };

  if (!g.startId || !g.goalId || g.startId === g.goalId) {
    return { ...base, failureReason: 'A distinct start node and destination node are required.' };
  }
  if (!g.nodes.some((n) => n.id === g.startId) || !g.nodes.some((n) => n.id === g.goalId)) {
    return { ...base, failureReason: 'The start or destination node no longer exists in the graph.' };
  }

  const table = kind === 'landmark' ? new LandmarkTable(g, g.landmarkIds) : undefined;
  const run = runGBFS(g, kind, { trace: true, table });
  const timing = timeSearch(g, kind, table);
  const best = optimalPath(g, g.startId, g.goalId);

  return {
    ...base,
    steps: run.steps,
    success: run.success,
    path: run.path,
    pathEdgeIds: run.pathEdgeIds,
    pathCost: run.pathCost,
    pathEdgeCount: Math.max(0, run.path.length - 1),
    nodesVisited: run.nodesVisited,
    nodesExpanded: run.nodesExpanded,
    nodesExplored: run.nodesExplored,
    nodesGenerated: run.nodesGenerated,
    heuristicEvals: run.heuristicEvals,
    executionTimeMs: timing.msPerRun,
    timingRuns: timing.runs,
    optimalCost: best?.cost ?? null,
    optimalPath: best?.path ?? [],
    isOptimal: run.success && best ? Math.abs(run.pathCost - best.cost) < 1e-9 : null,
    failureReason: run.success ? undefined : best
      ? 'Greedy Best-First Search exhausted the frontier without selecting the destination.'
      : 'The destination is not reachable from the start node.',
  };
}

/** Runs all three heuristics on the same graph, start and destination. */
export function compareAll(g: Graph): Record<HeuristicKind, SearchResult> {
  return { zero: search(g, 'zero'), euclidean: search(g, 'euclidean'), landmark: search(g, 'landmark') };
}
