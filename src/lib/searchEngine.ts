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

/* The same algorithm written the way it would be explained out loud. Line i
 * here means line i there, so one highlight drives both views and a beginner
 * can switch to the formal notation whenever they are ready for it. */
export const PSEUDOCODE_PLAIN: string[] = [
  'Make a waiting list. Best guess always comes out first.',
  'Put the start place on the waiting list.',
  'Make an empty "already checked" list.',
  'Keep going while the waiting list is not empty:',
  '    Take out the place with the smallest guess.',
  '    Is it the destination? Then we are done.',
  '    Mark it as already checked.',
  '    Look at each place connected to it:',
  '        If it is new (not checked, not waiting):',
  '            Remember we arrived here from this place,',
  '            and add it to the waiting list with its guess.',
  'Waiting list is empty — there is no route.',
];

/* Two algorithms share this engine and this snapshot format, so every panel
 * in the interface works with either one unchanged.
 *
 *   bfs  — Breadth-First Search. A plain first-in-first-out queue. It ignores
 *          road lengths and ignores the heuristic entirely, and finds the
 *          route using the FEWEST ROADS, which is not the same thing as the
 *          shortest route when roads differ in length.
 *   gbfs — Greedy Best-First Search. A priority queue ordered by h(n).
 */
export type Algorithm = 'bfs' | 'gbfs';

export const ALGORITHM_META: Record<Algorithm, {
  name: string; plain: string; oneLiner: string; usesHeuristic: boolean; color: string; blurb: string;
}> = {
  bfs: {
    name: 'Breadth-First Search',
    plain: 'Breadth-First Search',
    oneLiner: 'Checks everywhere one road away, then everywhere two roads away.',
    usesHeuristic: false,
    color: '#43D9E8',
    blurb: 'Explores the map in rings around the start: first every place one road away, then every place two roads away, and so on. It takes places strictly in the order they were found — first in, first out. It pays no attention to how long the roads are, and no attention to any guess about the destination. What it guarantees is the route using the fewest roads.',
  },
  gbfs: {
    name: 'Greedy Best-First Search',
    plain: 'Best-First Search',
    oneLiner: 'Always heads for whichever place looks closest to the destination.',
    usesHeuristic: true,
    color: '#FFB547',
    blurb: 'Instead of a plain queue, it keeps the waiting list sorted by a guess of how far each place is from the destination, and always takes the most promising one. That usually gets there much faster — but it can commit to an expensive route and never reconsider.',
  },
};

/* Breadth-First Search, in both notations. Line i here means line i there. */
export const PSEUDOCODE_BFS: string[] = [
  'queue ← FIFO queue',
  'enqueue(queue, start)',
  'visited ← { start }',
  'while queue is not empty do',
  '    n ← dequeue(queue)',
  '    if n = goal then return reconstruct(n)',
  '    mark n as explored',
  '    for each neighbour m of n do',
  '        if m ∉ visited then',
  '            parent[m] ← n',
  '            visited ← visited ∪ { m };  enqueue(queue, m)',
  'return failure',
];

export const PSEUDOCODE_BFS_PLAIN: string[] = [
  'Make a queue. First one in is the first one out.',
  'Put the starting place in the queue.',
  'Write the starting place on the "seen" list.',
  'Keep going while the queue is not empty:',
  '    Take the place at the front of the queue.',
  '    Is it the destination? Then we are done.',
  '    Mark it as checked.',
  '    Look at each place connected to it:',
  '        If we have not seen it before:',
  '            Remember we arrived here from this place,',
  '            and add it to the back of the queue.',
  'Queue is empty — there is no route.',
];

export type Phase = 'init' | 'select' | 'expand' | 'success' | 'failure';

export interface FrontierEntry {
  nodeId: string;
  h: number;            // guess of distance left — always 0 under Breadth-First
  parentId: string | null;
  g: number;            // real distance travelled so far
  depth: number;        // how many roads from the start
}

export interface NeighbourInfo {
  nodeId: string;
  h: number;
  weight: number;
  status: 'added' | 'already-in-frontier' | 'already-explored';
}

/** A complete, self-contained snapshot of the algorithm's state. */
export interface SearchStep {
  index: number;
  algorithm: Algorithm;
  phase: Phase;
  /** How many roads from the start the current place is. Drives the
   *  "ring N" commentary that makes Breadth-First Search legible. */
  depth: number;
  title: string;
  pseudocodeLines: number[];
  currentId: string | null;
  selectedId: string | null;
  frontier: FrontierEntry[];
  explored: string[];
  parents: Record<string, string>;
  gCost: Record<string, number>;
  neighbours: NeighbourInfo[];
  /** Short, simple English. One or two sentences — what a beginner reads. */
  decision: string;
  /** The precise, technical version for anyone who wants it. */
  detail: string;
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
  algorithm: Algorithm;
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
  /** Fewest roads any route could use. Breadth-First Search always matches
   *  this; it is the guarantee the algorithm actually makes. */
  fewestEdges: number | null;
  usesFewestEdges: boolean | null;
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
  const depthOf = new Map<string, number>([[startId, 0]]);
  const generated = new Set<string>([startId]);

  const steps: SearchStep[] = [];
  let iteration = 0;
  let nodesVisited = 0, nodesExpanded = 0;

  const frontierView = (): FrontierEntry[] =>
    frontier.toSortedArray().map((e) => ({
      nodeId: e.item, h: e.priority,
      parentId: parents.get(e.item) ?? null,
      g: gCost.get(e.item) ?? 0,
      depth: depthOf.get(e.item) ?? 0,
    }));

  const record = (s: Omit<SearchStep, 'index' | 'algorithm' | 'depth' | 'frontier' | 'explored' | 'parents' | 'gCost' | 'heuristicEvals' | 'iteration'>) => {
    if (!opts.trace) return;
    steps.push({
      ...s,
      index: steps.length,
      algorithm: 'gbfs',
      depth: s.currentId ? depthOf.get(s.currentId) ?? 0 : 0,
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
    title: 'Get ready to search',
    pseudocodeLines: [0, 1, 2],
    currentId: null, selectedId: null, neighbours: [],
    decision: `We start at ${label(startId)}. From here, the destination ${label(goalId)} looks about ${h0} away — that is only a guess, not a measurement. ${label(startId)} goes onto the waiting list. Nothing has been checked yet.`,
    detail: `The frontier is created as a priority queue ordered by h(n), and the start node ${label(startId)} is pushed with h(${label(startId)}) = ${h0}. The explored set begins empty. Because f(n) = h(n), the accumulated cost g(n) is recorded but takes no part in the ordering.`,
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
    const rivals = ranked.slice(1, 3).map((e) => `${label(e.nodeId)} (${e.h})`).join(' and ');
    const plainSelect = ranked.length === 1
      ? `${label(u)} is the only place left waiting, so we check it next.`
      : `Of the ${ranked.length} places waiting, ${label(u)} has the smallest guess — only ${popped.priority} left to go${rivals ? `, better than ${rivals}` : ''}. So we check ${label(u)} next.`;
    const detailSelect = ranked.length === 1
      ? `${label(u)} is the only entry in the frontier and is popped with h(${label(u)}) = ${popped.priority}.`
      : `The frontier holds ${ranked.length} entries; ${label(u)} is popped with the minimum h = ${popped.priority}. The comparison spans the entire frontier, not just the neighbours of the previously expanded node — which is why the search can jump to a completely different part of the graph.`;

    record({
      phase: 'select',
      title: `Pick the most promising place`,
      pseudocodeLines: [3, 4],
      currentId: u, selectedId: u, neighbours: [],
      decision: plainSelect,
      detail: detailSelect,
      activeEdgeIds: [], path: null, pathEdgeIds: [],
    });

    /* Goal test happens when a node is selected for expansion. */
    if (u === goalId) {
      const path = reconstruct(u);
      const edges = pathEdges(path);
      record({
        phase: 'success',
        title: 'We have arrived',
        pseudocodeLines: [5],
        currentId: u, selectedId: u, neighbours: [],
        decision: `${label(u)} is the destination, so we stop. Walking back through the places we came from gives the route: ${path.map(label).join(' → ')}. It is ${pathCostOf(path)} long in total. Careful: this is the first route found, not necessarily the shortest one.`,
        detail: `The goal test fires on selection, not on generation. The path is reconstructed by following parent pointers back to ${label(startId)}, giving an accumulated cost g = ${pathCostOf(path)}. Greedy Best-First Search returns the first route to the goal it selects and offers no optimality guarantee.`,
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
      depthOf.set(to, (depthOf.get(u) ?? 0) + 1);
      generated.add(to);
      frontier.push(to, hv, label(to));
      inFrontier.add(to);
      neighbours.push({ nodeId: to, h: hv, weight, status: 'added' });
    }

    const added = neighbours.filter((n) => n.status === 'added');
    const skipped = neighbours.filter((n) => n.status !== 'added');
    const bestAdded = added.length ? added.reduce((lo, n) => (n.h < lo.h ? n : lo)) : null;

    let decision: string;
    let detail: string;
    if (!neighbours.length) {
      decision = `${label(u)} is a dead end — no roads lead anywhere from here. We mark it as checked and move on to whatever else is waiting.`;
      detail = `${label(u)} has degree 0, so expansion generates nothing. It is added to the explored set and the loop continues with the remaining frontier.`;
    } else if (!added.length) {
      decision = `Every place connected to ${label(u)} has already been checked or is already waiting. Nothing new to add. ${label(u)} is now checked.`;
      detail = `All ${neighbours.length} neighbour(s) of ${label(u)} are in the explored set or already in the frontier, so no new nodes are generated. Re-adding them is what would make the search loop, so the membership test matters.`;
    } else {
      const list = added.map((n) => `${label(n.nodeId)} (looks ${n.h} away)`).join(', ');
      decision = `We look at the roads leading out of ${label(u)} and find ${added.length} new place${added.length === 1 ? '' : 's'}: ${list}. ${added.length === 1 ? 'It goes' : 'They go'} onto the waiting list. ${label(u)} is now marked as checked.${skipped.length ? ` ${skipped.map((n) => label(n.nodeId)).join(', ')} ${skipped.length === 1 ? 'was' : 'were'} skipped — already seen.` : ''}`;
      detail = `${label(u)} joins the explored set. ${added.length} neighbour(s) are generated and pushed with their heuristic values: ${added.map((n) => `${label(n.nodeId)} h = ${n.h}`).join(', ')}.${skipped.length ? ` ${skipped.map((n) => label(n.nodeId)).join(', ')} already explored or queued.` : ''}${bestAdded ? ` ${label(bestAdded.nodeId)} is the most promising new arrival, but it only wins the next round if no other frontier entry has a smaller h — including ones queued many steps ago.` : ''}`;
    }

    record({
      phase: 'expand',
      title: `Look around from ${label(u)}`,
      pseudocodeLines: [6, 7, 8, 9, 10],
      currentId: u, selectedId: null, neighbours,
      decision,
      detail,
      activeEdgeIds, path: null, pathEdgeIds: [],
    });
  }

  /* ── Failure ─────────────────────────────────────────────────────────── */
  record({
    phase: 'failure',
    title: 'There is no way through',
    pseudocodeLines: [11],
    currentId: null, selectedId: null, neighbours: [],
    decision: `The waiting list is empty and we never reached ${label(goalId)}. We have checked every place that can be reached from ${label(startId)}, so no road connects the two. The honest answer is: no route exists.`,
    detail: `The frontier emptied without the goal ever being selected. Every node in the connected component of ${label(startId)} is in the explored set, so ${label(goalId)} lies in a different component. The search reports failure rather than returning a partial or invented path.`,
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

/* ── Breadth-First Search ─────────────────────────────────────────────────
 *
 * A first-in-first-out queue, nothing more. The heuristic is never computed
 * and road lengths are never consulted when choosing — the only thing that
 * decides the order is when a place was first discovered. That produces the
 * characteristic "rings": every place one road from the start is checked
 * before any place two roads away.
 *
 * A place is marked as seen the moment it is discovered (not when it is
 * taken out), which is what stops it being queued twice.
 *
 * Snapshots use exactly the same shape as Best-First, so the map, queue
 * strip, explanation panel and Back button all work unchanged.
 * ----------------------------------------------------------------------- */

function runBFS(g: Graph, opts: RunOptions) {
  const startId = g.startId!, goalId = g.goalId!;
  const adj = buildAdjacency(g);
  const label = (id: string) => g.nodes.find((n) => n.id === id)?.label ?? id;

  const queue: string[] = [startId];
  let head = 0;                                 // index of the front of the queue
  const seen = new Set<string>([startId]);      // discovered — queued or done
  const explored = new Set<string>();
  const parents = new Map<string, string>();
  const gCost = new Map<string, number>([[startId, 0]]);
  const depthOf = new Map<string, number>([[startId, 0]]);

  const steps: SearchStep[] = [];
  let iteration = 0;
  let nodesVisited = 0, nodesExpanded = 0;

  /* Queue in true FIFO order: index 0 is the next one out. */
  const frontierView = (): FrontierEntry[] =>
    queue.slice(head).map((id) => ({
      nodeId: id, h: 0,
      parentId: parents.get(id) ?? null,
      g: gCost.get(id) ?? 0,
      depth: depthOf.get(id) ?? 0,
    }));

  const record = (st: Omit<SearchStep, 'index' | 'algorithm' | 'depth' | 'frontier' | 'explored' | 'parents' | 'gCost' | 'heuristicEvals' | 'iteration'>) => {
    if (!opts.trace) return;
    steps.push({
      ...st,
      index: steps.length,
      algorithm: 'bfs',
      depth: st.currentId ? depthOf.get(st.currentId) ?? 0 : 0,
      frontier: frontierView(),
      explored: [...explored],
      parents: Object.fromEntries(parents),
      gCost: Object.fromEntries(gCost),
      heuristicEvals: 0,
      iteration,
    });
  };

  const ring = (d: number) => (d === 0 ? 'the start itself' : d === 1 ? '1 road from the start' : `${d} roads from the start`);

  record({
    phase: 'init',
    title: 'Begin at the start',
    pseudocodeLines: [0, 1, 2],
    currentId: null, selectedId: null, neighbours: [],
    decision: `We begin at ${label(startId)}. It goes into the queue, and onto the "seen" list so we never add it twice. Breadth-First Search will now spread out from here one ring at a time.`,
    detail: `A FIFO queue is initialised with ${label(startId)}, which is also marked visited. No heuristic is evaluated and edge weights are not consulted for ordering — dequeue order is determined solely by discovery order.`,
    activeEdgeIds: [], path: null, pathEdgeIds: [],
  });

  const maxIterations = g.nodes.length * 4 + 16;

  while (head < queue.length) {
    if (iteration > maxIterations) break;
    iteration++;

    const before = queue.length - head;
    const u = queue[head++];
    nodesVisited++;
    const du = depthOf.get(u) ?? 0;

    record({
      phase: 'select',
      title: `Take the next place from the front of the queue`,
      pseudocodeLines: [3, 4],
      currentId: u, selectedId: u, neighbours: [],
      decision: before === 1
        ? `${label(u)} is the only place in the queue, so it comes out next. It is ${ring(du)}.`
        : `${label(u)} was put in the queue first, so it comes out first — that is the only rule. It is ${ring(du)}. ${before - 1} other place${before - 1 === 1 ? ' is' : 's are'} still waiting behind it.`,
      detail: `Dequeue ${label(u)} (depth ${du}). FIFO order guarantees every node at depth ${du} is dequeued before any node at depth ${du + 1}, which is why the search advances in level-order rings.`,
      activeEdgeIds: [], path: null, pathEdgeIds: [],
    });

    if (u === goalId) {
      const path: string[] = [];
      let cur: string | undefined = u;
      for (let i = 0; cur !== undefined && i <= g.nodes.length + 1; i++) {
        path.unshift(cur);
        if (cur === startId) break;
        cur = parents.get(cur);
      }
      const edges = pathEdgesOf(g, path);
      const cost = pathCostOf(g, path);
      record({
        phase: 'success',
        title: 'Destination reached',
        pseudocodeLines: [5],
        currentId: u, selectedId: u, neighbours: [],
        decision: `${label(u)} is the destination, so we stop. Following the "arrived from" notes backwards gives the route: ${path.map(label).join(' → ')}. It uses ${path.length - 1} road${path.length - 1 === 1 ? '' : 's'} — the fewest possible. Its total length is ${cost}, which may not be the shortest distance, because Breadth-First Search never looked at road lengths.`,
        detail: `Goal dequeued at depth ${du}. Because BFS expands in non-decreasing depth order, the reconstructed path has the minimum possible number of edges (${path.length - 1}). It is not guaranteed minimal in total weight (${cost}); that would require uniform-cost search or A*.`,
        activeEdgeIds: edges, path, pathEdgeIds: edges,
      });
      return { steps, success: true, path, pathEdgeIds: edges, pathCost: cost, heuristicEvals: 0, nodesVisited, nodesExpanded, nodesExplored: explored.size, nodesGenerated: seen.size };
    }

    explored.add(u);
    nodesExpanded++;

    const neighbours: NeighbourInfo[] = [];
    const activeEdgeIds: string[] = [];
    for (const { to, weight, edgeId } of adj.get(u) ?? []) {
      activeEdgeIds.push(edgeId);
      if (explored.has(to)) { neighbours.push({ nodeId: to, h: 0, weight, status: 'already-explored' }); continue; }
      if (seen.has(to)) { neighbours.push({ nodeId: to, h: 0, weight, status: 'already-in-frontier' }); continue; }
      seen.add(to);
      parents.set(to, u);
      gCost.set(to, round2((gCost.get(u) ?? 0) + weight));
      depthOf.set(to, du + 1);
      queue.push(to);
      neighbours.push({ nodeId: to, h: 0, weight, status: 'added' });
    }

    const added = neighbours.filter((n) => n.status === 'added');
    const skipped = neighbours.filter((n) => n.status !== 'added');
    let decision: string, detail: string;
    if (!neighbours.length) {
      decision = `${label(u)} is a dead end — no roads lead anywhere from here. We mark it as checked and carry on with the queue.`;
      detail = `${label(u)} has degree 0; nothing is enqueued.`;
    } else if (!added.length) {
      decision = `Every place next to ${label(u)} has already been seen, so nothing new joins the queue. ${label(u)} is now checked.`;
      detail = `All ${neighbours.length} neighbour(s) of ${label(u)} are already marked visited, so none are enqueued. The visited check is what prevents cycles.`;
    } else {
      decision = `We look at every road out of ${label(u)} and find ${added.length} new place${added.length === 1 ? '' : 's'}: ${added.map((n) => label(n.nodeId)).join(', ')}. ${added.length === 1 ? 'It joins' : 'They join'} the back of the queue — ${ring(du + 1)}. ${label(u)} is now checked.${skipped.length ? ` ${skipped.map((n) => label(n.nodeId)).join(', ')} ${skipped.length === 1 ? 'was' : 'were'} skipped — already seen.` : ''}`;
      detail = `${label(u)} is marked explored. Newly discovered neighbours ${added.map((n) => label(n.nodeId)).join(', ')} are marked visited and enqueued at depth ${du + 1}, behind everything already waiting — they will not be dequeued until every remaining depth-${du} node has been processed.`;
    }

    record({
      phase: 'expand',
      title: `Look at the places next to ${label(u)}`,
      pseudocodeLines: [6, 7, 8, 9, 10],
      currentId: u, selectedId: null, neighbours,
      decision, detail,
      activeEdgeIds, path: null, pathEdgeIds: [],
    });
  }

  record({
    phase: 'failure',
    title: 'There is no way through',
    pseudocodeLines: [11],
    currentId: null, selectedId: null, neighbours: [],
    decision: `The queue is empty and we never reached ${label(goalId)}. Every place that can be reached from ${label(startId)} has been checked, so no road connects the two. No route exists.`,
    detail: `The queue emptied without dequeuing the goal; ${label(goalId)} lies outside the connected component of ${label(startId)}.`,
    activeEdgeIds: [], path: null, pathEdgeIds: [],
  });

  return { steps, success: false, path: [] as string[], pathEdgeIds: [] as string[], pathCost: 0, heuristicEvals: 0, nodesVisited, nodesExpanded, nodesExplored: explored.size, nodesGenerated: seen.size };
}

function pathEdgesOf(g: Graph, path: string[]): string[] {
  const ids: string[] = [];
  for (let i = 0; i + 1 < path.length; i++) {
    const e = edgeBetween(g, path[i], path[i + 1]);
    if (e) ids.push(e.id);
  }
  return ids;
}

function pathCostOf(g: Graph, path: string[]): number {
  let total = 0;
  for (let i = 0; i + 1 < path.length; i++) total += edgeBetween(g, path[i], path[i + 1])?.weight ?? 0;
  return round2(total);
}

/** Fewest roads between two places, ignoring their lengths — the quantity
 *  Breadth-First Search is guaranteed to minimise. */
function fewestEdgesBetween(g: Graph, from: string, to: string): number | null {
  const adj = buildAdjacency(g);
  const dist = new Map<string, number>([[from, 0]]);
  const q = [from];
  for (let i = 0; i < q.length; i++) {
    const u = q[i];
    if (u === to) return dist.get(u)!;
    for (const { to: v } of adj.get(u) ?? []) {
      if (!dist.has(v)) { dist.set(v, dist.get(u)! + 1); q.push(v); }
    }
  }
  return null;
}

/* ── Timing: identical methodology for every algorithm ──────────────────── */

function timeRun(once: () => unknown): Timing {
  once(); // warm-up
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

/* ── Public entry point ──────────────────────────────────────────────────── */

/** Runs one search. `algorithm` defaults to Best-First so every existing
 *  caller (and the test suite) keeps its behaviour. */
export function search(g: Graph, kind: HeuristicKind, algorithm: Algorithm = 'gbfs'): SearchResult {
  const base: SearchResult = {
    steps: [], success: false, path: [], pathEdgeIds: [], pathCost: 0, pathEdgeCount: 0,
    algorithm, heuristicKind: kind, nodesVisited: 0, nodesExpanded: 0, nodesExplored: 0, nodesGenerated: 0,
    heuristicEvals: 0, executionTimeMs: 0, timingRuns: 0, totalNodes: g.nodes.length, totalEdges: g.edges.length,
    optimalCost: null, optimalPath: [], isOptimal: null, fewestEdges: null, usesFewestEdges: null,
  };

  if (!g.startId || !g.goalId || g.startId === g.goalId) {
    return { ...base, failureReason: 'A distinct start node and destination node are required.' };
  }
  if (!g.nodes.some((n) => n.id === g.startId) || !g.nodes.some((n) => n.id === g.goalId)) {
    return { ...base, failureReason: 'The start or destination node no longer exists in the graph.' };
  }

  const table = algorithm === 'gbfs' && kind === 'landmark' ? new LandmarkTable(g, g.landmarkIds) : undefined;
  const run = algorithm === 'bfs' ? runBFS(g, { trace: true }) : runGBFS(g, kind, { trace: true, table });
  const timing = algorithm === 'bfs'
    ? timeRun(() => runBFS(g, { trace: false }))
    : timeSearch(g, kind, table);
  const best = optimalPath(g, g.startId, g.goalId);
  const fewest = fewestEdgesBetween(g, g.startId, g.goalId);
  const edgeCount = Math.max(0, run.path.length - 1);

  return {
    ...base,
    steps: run.steps,
    success: run.success,
    path: run.path,
    pathEdgeIds: run.pathEdgeIds,
    pathCost: run.pathCost,
    pathEdgeCount: edgeCount,
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
    fewestEdges: fewest,
    usesFewestEdges: run.success && fewest !== null ? edgeCount === fewest : null,
    failureReason: run.success ? undefined : best
      ? 'The search exhausted its waiting list without selecting the destination.'
      : 'The destination is not reachable from the start node.',
  };
}

/** Runs all three heuristics under Best-First on the same graph, start and destination. */
export function compareAll(g: Graph): Record<HeuristicKind, SearchResult> {
  return { zero: search(g, 'zero'), euclidean: search(g, 'euclidean'), landmark: search(g, 'landmark') };
}

/** Breadth-First against landmark-guided Best-First, on the same map. */
export function compareAlgorithms(g: Graph): Record<Algorithm, SearchResult> {
  return { bfs: search(g, 'landmark', 'bfs'), gbfs: search(g, 'landmark', 'gbfs') };
}
