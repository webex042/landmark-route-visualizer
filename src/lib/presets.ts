/* ===========================================================================
 * PREDEFINED GRAPH ENVIRONMENTS + RANDOM GENERATOR
 * Edge weights are derived from the geometry (cost = distance / COST_SCALE),
 * which keeps the Euclidean heuristic a fair, admissible comparison baseline.
 * ========================================================================= */

import { Graph, GraphNode, GraphEdge, geometricWeight, uid } from './graph';

type Spec = {
  nodes: [string, number, number][];
  edges: [string, string, number?][];
  start: string;
  goal: string;
  landmarks: string[];
};

function build(spec: Spec): Graph {
  const nodes: GraphNode[] = spec.nodes.map(([label, x, y]) => ({ id: `n_${label.replace(/\W/g, '_')}`, label, x, y }));
  const byLabel = new Map(nodes.map((n) => [n.label, n]));
  const edges: GraphEdge[] = [];
  const seen = new Set<string>();

  for (const [a, b, w] of spec.edges) {
    const na = byLabel.get(a), nb = byLabel.get(b);
    if (!na || !nb || na.id === nb.id) continue;
    const key = na.id < nb.id ? `${na.id}|${nb.id}` : `${nb.id}|${na.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push({ id: uid('e'), a: na.id, b: nb.id, weight: w ?? geometricWeight(na, nb) });
  }
  return {
    nodes, edges,
    startId: byLabel.get(spec.start)?.id ?? nodes[0]?.id ?? null,
    goalId: byLabel.get(spec.goal)?.id ?? nodes[nodes.length - 1]?.id ?? null,
    landmarkIds: spec.landmarks.map((l) => byLabel.get(l)?.id).filter((x): x is string => !!x),
  };
}

/* ── 1. City Route Network ───────────────────────────────────────────────── */
/* Most roads cost what their length suggests, but three carry explicit travel
 * costs: the BRIDGEND → TERMINAL bridge is congested (52 against a geometric
 * 17) while RIDGE → ORCHARD → AIRPORT is a fast northern highway (9 each).
 * Travel cost is therefore NOT proportional to straight-line distance, which
 * is precisely the situation where geometric estimation misleads a search and
 * landmark distances — measured along the real network — do not. */
const CITY: Spec = {
  nodes: [
    ['CENTRAL', 120, 330], ['NORTHGATE', 210, 150], ['MILLSIDE', 330, 90],
    ['OLDTOWN', 300, 270], ['HARBOUR', 250, 460], ['SOUTHGATE', 400, 540],
    ['RIDGE', 470, 200], ['FOUNDRY', 520, 350], ['ORCHARD', 620, 120],
    ['RIVERSIDE', 700, 470], ['QUARRY', 760, 250], ['BRIDGEND', 830, 390],
    ['AIRPORT', 900, 180], ['TERMINAL', 930, 530],
  ],
  edges: [
    ['CENTRAL', 'NORTHGATE'], ['CENTRAL', 'OLDTOWN'], ['CENTRAL', 'HARBOUR'],
    ['NORTHGATE', 'MILLSIDE'], ['NORTHGATE', 'OLDTOWN'],
    ['MILLSIDE', 'RIDGE'], ['OLDTOWN', 'RIDGE'], ['OLDTOWN', 'FOUNDRY'],
    ['HARBOUR', 'SOUTHGATE'], ['HARBOUR', 'OLDTOWN'],
    ['SOUTHGATE', 'FOUNDRY'], ['SOUTHGATE', 'RIVERSIDE'],
    ['RIDGE', 'ORCHARD', 9], ['RIDGE', 'FOUNDRY'],
    ['FOUNDRY', 'QUARRY'], ['ORCHARD', 'QUARRY'], ['ORCHARD', 'AIRPORT', 9],
    ['QUARRY', 'AIRPORT'], ['QUARRY', 'BRIDGEND'],
    ['RIVERSIDE', 'BRIDGEND'], ['BRIDGEND', 'TERMINAL', 52], ['AIRPORT', 'TERMINAL'],
  ],
  start: 'CENTRAL', goal: 'TERMINAL', landmarks: ['MILLSIDE', 'SOUTHGATE'],
};

/* ── 2. Campus Navigation (representative sample layout) ─────────────────── */
const CAMPUS: Spec = {
  nodes: [
    ['MAIN GATE', 110, 470], ['ADMIN', 230, 380], ['AUDI', 180, 230],
    ['LIBRARY', 350, 250], ['LT COMPLEX', 360, 430], ['CSE DEPT', 500, 340],
    ['ECE DEPT', 520, 180], ['LAB BLOCK', 650, 260], ['CANTEEN', 480, 520],
    ['HOSTEL A', 680, 470], ['HOSTEL B', 790, 380], ['SPORTS', 620, 600],
    ['MED CENTRE', 860, 230], ['GUEST HSE', 900, 480],
  ],
  edges: [
    ['MAIN GATE', 'ADMIN'], ['MAIN GATE', 'AUDI'], ['ADMIN', 'AUDI'],
    ['ADMIN', 'LT COMPLEX'], ['ADMIN', 'LIBRARY'], ['AUDI', 'LIBRARY'],
    ['LIBRARY', 'CSE DEPT'], ['LIBRARY', 'ECE DEPT'], ['LT COMPLEX', 'CSE DEPT'],
    ['LT COMPLEX', 'CANTEEN'], ['CSE DEPT', 'LAB BLOCK'], ['CSE DEPT', 'CANTEEN'],
    ['ECE DEPT', 'LAB BLOCK'], ['LAB BLOCK', 'MED CENTRE'], ['LAB BLOCK', 'HOSTEL B'],
    ['CANTEEN', 'HOSTEL A'], ['CANTEEN', 'SPORTS'], ['HOSTEL A', 'HOSTEL B'],
    ['HOSTEL A', 'SPORTS'], ['HOSTEL B', 'GUEST HSE'], ['MED CENTRE', 'GUEST HSE'],
    ['SPORTS', 'GUEST HSE'],
  ],
  start: 'MAIN GATE', goal: 'GUEST HSE', landmarks: ['AUDI', 'SPORTS'],
};

/* ── 3. Greedy Trap — a graph where GBFS provably returns a worse route ── */
/* The landmark DEPOT sits one edge beyond the destination, which makes the
 * landmark heuristic EXACT for every node here: h(v) = d(v, G). Even so,
 * Greedy Best-First Search returns a route costing 11 when a route costing 3
 * exists — because it ranks nodes by remaining estimate alone and never looks
 * at the cost already paid to reach them. A perfect heuristic does not make
 * greedy search optimal; only f(n) = g(n) + h(n) would fix this. */
const TRAP: Spec = {
  nodes: [
    ['S', 120, 330], ['A', 430, 170], ['B', 400, 490],
    ['C', 680, 490], ['G', 830, 330], ['DEPOT', 960, 330],
  ],
  edges: [
    ['S', 'A', 10], ['A', 'G', 1],
    ['S', 'B', 1], ['B', 'C', 1], ['C', 'G', 1],
    ['G', 'DEPOT', 5],
  ],
  start: 'S', goal: 'G', landmarks: ['DEPOT'],
};

export interface PresetDef { key: string; name: string; note: string; make: () => Graph }

export const PRESETS: PresetDef[] = [
  { key: 'city', name: 'City Route Network', note: '14 locations, 22 roads. A congested bridge and a fast northern highway make travel cost diverge from straight-line distance: the landmark heuristic finds the optimal route here, straight-line distance does not.', make: () => build(CITY) },
  { key: 'campus', name: 'Campus Navigation', note: 'A representative campus walking network — sample coordinates and paths, not surveyed ones.', make: () => build(CAMPUS) },
  { key: 'trap', name: 'Greedy Trap (teaching case)', note: 'The heuristic here is exact, yet the greedy route costs 11 against an optimal 3 — the clearest demonstration of why f(n) = h(n) carries no optimality guarantee.', make: () => build(TRAP) },
];

export const defaultGraph = () => build(CITY);

/* ── 4. Random graph generator ───────────────────────────────────────────── */

/** Jittered-grid layout, connected by a minimum spanning tree (so a route
 *  always exists) plus a few short extra links to create genuine choices. */
export function randomGraph(nodeCount = 12, extraEdgeRatio = 0.55, landmarkCount = 2): Graph {
  const count = Math.max(3, Math.min(60, Math.round(nodeCount)));
  const cols = Math.ceil(Math.sqrt(count * 1.6));
  const rows = Math.ceil(count / cols);
  const cellW = 960 / cols, cellH = 560 / rows;

  const nodes: GraphNode[] = [];
  const slots: number[] = Array.from({ length: cols * rows }, (_, i) => i);
  for (let i = slots.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [slots[i], slots[j]] = [slots[j], slots[i]]; }

  for (let i = 0; i < count; i++) {
    const slot = slots[i];
    const cx = (slot % cols) * cellW + cellW / 2 + 60;
    const cy = Math.floor(slot / cols) * cellH + cellH / 2 + 60;
    nodes.push({
      id: uid('n'),
      label: String.fromCharCode(65 + (i % 26)) + (i >= 26 ? String(Math.floor(i / 26)) : ''),
      x: Math.round(cx + (Math.random() - 0.5) * cellW * 0.45),
      y: Math.round(cy + (Math.random() - 0.5) * cellH * 0.45),
    });
  }

  /* Prim's MST over Euclidean distance → guaranteed connectivity. */
  const edges: GraphEdge[] = [];
  const used = new Set<string>();
  const inTree = new Set<string>([nodes[0].id]);
  const key = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

  while (inTree.size < nodes.length) {
    let best: { a: GraphNode; b: GraphNode; d: number } | null = null;
    for (const a of nodes) {
      if (!inTree.has(a.id)) continue;
      for (const b of nodes) {
        if (inTree.has(b.id)) continue;
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (!best || d < best.d) best = { a, b, d };
      }
    }
    if (!best) break;
    edges.push({ id: uid('e'), a: best.a.id, b: best.b.id, weight: geometricWeight(best.a, best.b) });
    used.add(key(best.a.id, best.b.id));
    inTree.add(best.b.id);
  }

  /* Extra short links, nearest-neighbour first, to create real alternatives. */
  const candidates: { a: GraphNode; b: GraphNode; d: number }[] = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if (used.has(key(nodes[i].id, nodes[j].id))) continue;
      candidates.push({ a: nodes[i], b: nodes[j], d: Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y) });
    }
  }
  candidates.sort((p, q) => p.d - q.d);
  const extra = Math.round(nodes.length * extraEdgeRatio);
  for (const c of candidates.slice(0, Math.max(0, extra))) {
    edges.push({ id: uid('e'), a: c.a.id, b: c.b.id, weight: geometricWeight(c.a, c.b) });
    used.add(key(c.a.id, c.b.id));
  }

  /* Start and goal: the most distant pair among a sample, for an interesting run. */
  let start = nodes[0], goal = nodes[nodes.length - 1], bestD = -1;
  for (const a of nodes) for (const b of nodes) {
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    if (d > bestD) { bestD = d; start = a; goal = b; }
  }

  /* Landmarks: spread out, avoiding the start and the destination. */
  const pool = nodes.filter((n) => n.id !== start.id && n.id !== goal.id);
  const landmarkIds: string[] = [];
  for (let i = 0; i < Math.min(landmarkCount, pool.length); i++) {
    let pick = pool[0], score = -1;
    for (const n of pool) {
      if (landmarkIds.includes(n.id)) continue;
      const nearest = landmarkIds.length
        ? Math.min(...landmarkIds.map((id) => { const m = nodes.find((q) => q.id === id)!; return Math.hypot(m.x - n.x, m.y - n.y); }))
        : Math.hypot(n.x - start.x, n.y - start.y);
      if (nearest > score) { score = nearest; pick = n; }
    }
    landmarkIds.push(pick.id);
  }

  return { nodes, edges, startId: start.id, goalId: goal.id, landmarkIds };
}
