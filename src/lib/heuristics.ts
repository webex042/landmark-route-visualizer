/* ===========================================================================
 * HEURISTIC ENGINE
 * Every heuristic is a function h(v) estimating the remaining cost from v to
 * the target. These are estimates only — they are NEVER mixed with, or
 * derived from, the accumulated path cost g(n).
 * ========================================================================= */

import { Graph, GraphNode, COST_SCALE, nodeMap } from './graph';
import { LandmarkTable } from './dijkstra';

export type HeuristicKind = 'zero' | 'euclidean' | 'landmark';

export const HEURISTIC_META: Record<HeuristicKind, {
  name: string; plain: string; oneLiner: string; short: string; color: string; blurb: string;
}> = {
  zero: {
    name: 'Zero Heuristic',
    plain: 'No guess at all',
    oneLiner: 'Every place looks equally good. The search wanders.',
    short: 'h = 0', color: '#FF647C',
    blurb: 'The guess is always zero, so nothing stands out and the search has no sense of direction. Worth seeing once: it shows how much the guess was really doing. Note this is not Dijkstra’s algorithm — greedy search never looks at the distance already travelled.',
  },
  euclidean: {
    name: 'Euclidean Heuristic',
    plain: 'Straight-line guess',
    oneLiner: 'As the crow flies. Ignores which roads exist.',
    short: 'straight line', color: '#43D9E8',
    blurb: 'Measures the direct distance to the destination, in a straight line. Quick and often helpful — but it cannot see the roads. A place just across a river looks close, even when the only bridge is thirty kilometres away.',
  },
  landmark: {
    name: 'Landmark Heuristic',
    plain: 'Landmark guess',
    oneLiner: 'Uses real road distances measured from fixed landmarks.',
    short: 'landmark', color: '#FFB547',
    blurb: 'Picks a few places as landmarks and measures the real road distance from each one to everywhere else, before the search starts. Comparing those two measurements gives a guess that already knows about rivers, detours and dead ends.',
  },
};

/** One landmark's contribution to the bound on h(v, t). */
export interface LandmarkTerm {
  landmarkId: string;
  dLv?: number;      // d(L, v)
  dLt?: number;      // d(L, t)
  estimate?: number; // |d(L,t) - d(L,v)|, only when both distances exist
  valid: boolean;
  reason?: string;
}

export interface HeuristicBreakdown {
  value: number;
  terms: LandmarkTerm[];
  chosenLandmarkId?: string;
}

/* ── Landmark heuristic ─────────────────────────────────────────────────── */

/** h_L(v,t) = |d(L,t) - d(L,v)|  — a valid lower bound on d(v,t) for an
 *  undirected weighted graph, by the triangle inequality.
 *  Multiple landmarks: h(v,t) = max over valid L, since the maximum of
 *  several lower bounds is itself a lower bound and is the tightest one.
 *  A landmark that cannot reach v or t yields no information and is skipped
 *  rather than contributing an infinite or misleading value. */
export function landmarkBreakdown(
  table: LandmarkTable, v: string, t: string,
): HeuristicBreakdown {
  const terms: LandmarkTerm[] = [];
  let value = 0;
  let chosenLandmarkId: string | undefined;

  for (const L of table.landmarks) {
    const dLv = table.distance(L, v);
    const dLt = table.distance(L, t);
    if (dLv === undefined || dLt === undefined) {
      terms.push({
        landmarkId: L, dLv, dLt, valid: false,
        reason: dLv === undefined && dLt === undefined
          ? 'reaches neither this node nor the destination'
          : dLv === undefined ? 'cannot reach this node' : 'cannot reach the destination',
      });
      continue;
    }
    const estimate = Math.abs(dLt - dLv);
    terms.push({ landmarkId: L, dLv, dLt, estimate, valid: true });
    if (estimate > value) { value = estimate; chosenLandmarkId = L; }
    else if (chosenLandmarkId === undefined) { chosenLandmarkId = L; }
  }
  return { value, terms, chosenLandmarkId };
}

/* ── Heuristic factory ──────────────────────────────────────────────────── */

export interface HeuristicFn {
  kind: HeuristicKind;
  /** Estimated remaining cost from `nodeId` to the target. */
  (nodeId: string): number;
}

export function makeHeuristic(
  kind: HeuristicKind, g: Graph, targetId: string, table?: LandmarkTable,
): HeuristicFn {
  const nodes = nodeMap(g);
  const target = nodes.get(targetId);
  let fn: (nodeId: string) => number;

  if (kind === 'zero') {
    fn = () => 0;
  } else if (kind === 'euclidean') {
    fn = (id: string) => {
      const n = nodes.get(id);
      if (!n || !target) return 0;
      return round2(Math.hypot(n.x - target.x, n.y - target.y) / COST_SCALE);
    };
  } else {
    const t = table ?? new LandmarkTable(g, g.landmarkIds);
    fn = (id: string) => round2(landmarkBreakdown(t, id, targetId).value);
  }
  const h = fn as HeuristicFn;
  h.kind = kind;
  return h;
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

/** Straight-line estimate for a single node, used by the explanation panels. */
export function euclideanEstimate(from: GraphNode, to: GraphNode): number {
  return round2(Math.hypot(from.x - to.x, from.y - to.y) / COST_SCALE);
}
