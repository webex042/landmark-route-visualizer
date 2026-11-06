/* ===========================================================================
 * GRAPH DATA MODEL
 * Pure data structures + operations. No UI, no React, no side effects.
 * Graphs are WEIGHTED and UNDIRECTED (required by the landmark heuristic:
 * the triangle-inequality bound |d(L,t) - d(L,v)| assumes d(a,b) = d(b,a)).
 * ========================================================================= */

export interface GraphNode {
  id: string;
  label: string;
  x: number; // world-space coordinate
  y: number;
}

export interface GraphEdge {
  id: string;
  a: string; // endpoint node id
  b: string; // endpoint node id
  weight: number; // travel cost, strictly > 0
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  startId: string | null;
  goalId: string | null;
  landmarkIds: string[];
}

/** Pixels of world space per 1 unit of travel cost. Edge weights in the
 *  built-in environments are derived from geometry using this scale, which is
 *  what makes the Euclidean heuristic a meaningful (admissible) comparison. */
export const COST_SCALE = 10;

export const emptyGraph = (): Graph => ({
  nodes: [], edges: [], startId: null, goalId: null, landmarkIds: [],
});

/* ── Geometry ────────────────────────────────────────────────────────────── */

export function euclidean(a: GraphNode, b: GraphNode): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Geometric cost between two nodes, rounded to a clean integer weight. */
export function geometricWeight(a: GraphNode, b: GraphNode): number {
  return Math.max(1, Math.round(euclidean(a, b) / COST_SCALE));
}

/* ── Lookups ─────────────────────────────────────────────────────────────── */

export function nodeMap(g: Graph): Map<string, GraphNode> {
  return new Map(g.nodes.map((n) => [n.id, n]));
}

export function getNode(g: Graph, id: string): GraphNode | undefined {
  return g.nodes.find((n) => n.id === id);
}

export function labelOf(g: Graph, id: string | null | undefined): string {
  if (!id) return '—';
  return g.nodes.find((n) => n.id === id)?.label ?? id;
}

/** Adjacency list. Both directions are present (undirected graph).
 *  Parallel edges are collapsed to the cheapest one, which is the only one a
 *  shortest-path or route search could ever use. Self-loops are dropped. */
export interface Adjacent { to: string; weight: number; edgeId: string }

export function buildAdjacency(g: Graph): Map<string, Adjacent[]> {
  const adj = new Map<string, Adjacent[]>();
  for (const n of g.nodes) adj.set(n.id, []);
  const best = new Map<string, GraphEdge>();

  for (const e of g.edges) {
    if (e.a === e.b) continue;                       // self-loop: unusable
    if (!adj.has(e.a) || !adj.has(e.b)) continue;    // dangling endpoint
    if (!(e.weight > 0) || !Number.isFinite(e.weight)) continue;
    const key = e.a < e.b ? `${e.a}|${e.b}` : `${e.b}|${e.a}`;
    const prev = best.get(key);
    if (!prev || e.weight < prev.weight) best.set(key, e);
  }

  for (const e of best.values()) {
    adj.get(e.a)!.push({ to: e.b, weight: e.weight, edgeId: e.id });
    adj.get(e.b)!.push({ to: e.a, weight: e.weight, edgeId: e.id });
  }
  // Deterministic neighbour order → reproducible, explainable search traces.
  for (const list of adj.values()) list.sort((p, q) => (p.to < q.to ? -1 : p.to > q.to ? 1 : 0));
  return adj;
}

export function edgeBetween(g: Graph, a: string, b: string): GraphEdge | undefined {
  const matches = g.edges.filter((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a));
  if (!matches.length) return undefined;
  return matches.reduce((lo, e) => (e.weight < lo.weight ? e : lo));
}

export function degree(g: Graph, id: string): number {
  return buildAdjacency(g).get(id)?.length ?? 0;
}

/* ── Mutations (all return a new Graph; never mutate in place) ──────────── */

let seq = 0;
export const uid = (prefix: string) => `${prefix}${Date.now().toString(36)}${(seq++).toString(36)}`;

/** Next unused label in the sequence A..Z, A1..Z1, A2.. */
export function nextLabel(g: Graph): string {
  const used = new Set(g.nodes.map((n) => n.label));
  for (let round = 0; round < 50; round++) {
    for (let i = 0; i < 26; i++) {
      const label = String.fromCharCode(65 + i) + (round === 0 ? '' : String(round));
      if (!used.has(label)) return label;
    }
  }
  return `N${g.nodes.length + 1}`;
}

export function addNode(g: Graph, x: number, y: number, label?: string): Graph {
  const node: GraphNode = { id: uid('n'), label: label ?? nextLabel(g), x, y };
  const next = { ...g, nodes: [...g.nodes, node] };
  if (!next.startId) next.startId = node.id;
  else if (!next.goalId) next.goalId = node.id;
  return next;
}

export function removeNode(g: Graph, id: string): Graph {
  return {
    ...g,
    nodes: g.nodes.filter((n) => n.id !== id),
    edges: g.edges.filter((e) => e.a !== id && e.b !== id),
    startId: g.startId === id ? null : g.startId,
    goalId: g.goalId === id ? null : g.goalId,
    landmarkIds: g.landmarkIds.filter((l) => l !== id),
  };
}

export function moveNode(g: Graph, id: string, x: number, y: number): Graph {
  return { ...g, nodes: g.nodes.map((n) => (n.id === id ? { ...n, x, y } : n)) };
}

export function renameNode(g: Graph, id: string, label: string): Graph {
  const clean = label.trim().slice(0, 14);
  if (!clean) return g;
  return { ...g, nodes: g.nodes.map((n) => (n.id === id ? { ...n, label: clean } : n)) };
}

/** Connect two nodes. Rejects self-loops; an existing connection has its
 *  weight updated instead of adding a parallel edge. */
export function connect(g: Graph, a: string, b: string, weight?: number): { graph: Graph; error?: string } {
  if (a === b) return { graph: g, error: 'A node cannot be connected to itself.' };
  const na = getNode(g, a), nb = getNode(g, b);
  if (!na || !nb) return { graph: g, error: 'One of the selected nodes no longer exists.' };
  const w = weight && weight > 0 ? Math.round(weight * 100) / 100 : geometricWeight(na, nb);
  const existing = edgeBetween(g, a, b);
  if (existing) {
    return {
      graph: { ...g, edges: g.edges.map((e) => (e.id === existing.id ? { ...e, weight: w } : e)) },
      error: undefined,
    };
  }
  return { graph: { ...g, edges: [...g.edges, { id: uid('e'), a, b, weight: w }] } };
}

export function removeEdge(g: Graph, edgeId: string): Graph {
  return { ...g, edges: g.edges.filter((e) => e.id !== edgeId) };
}

export function setEdgeWeight(g: Graph, edgeId: string, weight: number): Graph {
  if (!(weight > 0) || !Number.isFinite(weight)) return g;
  const w = Math.round(weight * 100) / 100;
  return { ...g, edges: g.edges.map((e) => (e.id === edgeId ? { ...e, weight: w } : e)) };
}

export function setStart(g: Graph, id: string): Graph {
  return { ...g, startId: id, goalId: g.goalId === id ? null : g.goalId };
}

export function setGoal(g: Graph, id: string): Graph {
  return { ...g, goalId: id, startId: g.startId === id ? null : g.startId };
}

export function toggleLandmark(g: Graph, id: string): Graph {
  const has = g.landmarkIds.includes(id);
  return { ...g, landmarkIds: has ? g.landmarkIds.filter((l) => l !== id) : [...g.landmarkIds, id] };
}

/* ── Validation ──────────────────────────────────────────────────────────── */

export interface Validation { ok: boolean; errors: string[]; warnings: string[] }

export function validateGraph(g: Graph): Validation {
  const errors: string[] = [], warnings: string[] = [];
  if (g.nodes.length < 2) errors.push('You need at least two places on the map.');
  if (!g.startId) errors.push('No starting place chosen. Click a place, then press Start.');
  if (!g.goalId) errors.push('No destination chosen. Click a place, then press End.');
  if (g.startId && g.startId === g.goalId) errors.push('The start and the destination must be two different places.');
  if (g.edges.length === 0 && g.nodes.length >= 2) errors.push('There are no roads yet. Use Add road to join two places.');
  if (g.edges.some((e) => !(e.weight > 0))) errors.push('Every road must have a length greater than zero.');

  if (!g.landmarkIds.length) warnings.push('No landmarks chosen, so the landmark guess has nothing to work from and returns 0 everywhere.');
  if (g.startId && g.landmarkIds.includes(g.startId)) warnings.push('The starting place is also a landmark.');
  if (g.goalId && g.landmarkIds.includes(g.goalId)) {
    warnings.push('The destination is also a landmark, which makes every guess exact — an unusually easy case.');
  }
  const isolated = g.nodes.filter((n) => degree(g, n.id) === 0);
  if (isolated.length) warnings.push(`${isolated.length} place(s) have no roads at all: ${isolated.map((n) => n.label).join(', ')}.`);
  return { ok: errors.length === 0, errors, warnings };
}

/* ── Serialisation ───────────────────────────────────────────────────────── */

export function serialise(g: Graph): string {
  return JSON.stringify(g, null, 2);
}

export function deserialise(text: string): Graph | null {
  try {
    const raw = JSON.parse(text);
    if (!Array.isArray(raw?.nodes) || !Array.isArray(raw?.edges)) return null;
    const nodes: GraphNode[] = raw.nodes
      .filter((n: any) => typeof n?.id === 'string' && Number.isFinite(n?.x) && Number.isFinite(n?.y))
      .map((n: any) => ({ id: n.id, label: String(n.label ?? n.id).slice(0, 14), x: n.x, y: n.y }));
    const ids = new Set(nodes.map((n) => n.id));
    const edges: GraphEdge[] = raw.edges
      .filter((e: any) => ids.has(e?.a) && ids.has(e?.b) && e.weight > 0)
      .map((e: any) => ({ id: typeof e.id === 'string' ? e.id : uid('e'), a: e.a, b: e.b, weight: Number(e.weight) }));
    return {
      nodes, edges,
      startId: ids.has(raw.startId) ? raw.startId : nodes[0]?.id ?? null,
      goalId: ids.has(raw.goalId) ? raw.goalId : nodes[1]?.id ?? null,
      landmarkIds: Array.isArray(raw.landmarkIds) ? raw.landmarkIds.filter((l: any) => ids.has(l)) : [],
    };
  } catch {
    return null;
  }
}
