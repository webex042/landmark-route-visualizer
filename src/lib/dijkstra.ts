/* ===========================================================================
 * DIJKSTRA — LANDMARK DISTANCE PREPROCESSOR
 * Single-source shortest paths over a weighted undirected graph. Used to
 * (a) precompute exact distances from every landmark, and
 * (b) compute the true optimal path cost for comparison against the route
 *     that Greedy Best-First Search actually returns.
 * ========================================================================= */

import { Graph, buildAdjacency } from './graph';
import { PriorityQueue } from './priorityQueue';

export interface DijkstraResult {
  dist: Map<string, number>;   // unreachable nodes are simply absent
  parent: Map<string, string>;
}

export function dijkstra(g: Graph, sourceId: string, adj = buildAdjacency(g)): DijkstraResult {
  const dist = new Map<string, number>();
  const parent = new Map<string, string>();
  const settled = new Set<string>();
  if (!adj.has(sourceId)) return { dist, parent };

  const pq = new PriorityQueue<string>();
  dist.set(sourceId, 0);
  pq.push(sourceId, 0, sourceId);

  while (!pq.isEmpty) {
    const { item: u, priority: d } = pq.pop()!;
    if (settled.has(u)) continue;      // stale heap entry
    settled.add(u);
    if (d > (dist.get(u) ?? Infinity)) continue;

    for (const { to, weight } of adj.get(u) ?? []) {
      const candidate = d + weight;
      if (candidate < (dist.get(to) ?? Infinity)) {
        dist.set(to, candidate);
        parent.set(to, u);
        pq.push(to, candidate, to);
      }
    }
  }
  return { dist, parent };
}

/** Reconstructs the optimal route, or null when the target is unreachable. */
export function optimalPath(g: Graph, sourceId: string, targetId: string): { path: string[]; cost: number } | null {
  const { dist, parent } = dijkstra(g, sourceId);
  if (!dist.has(targetId)) return null;
  const path: string[] = [];
  let cur: string | undefined = targetId;
  const guard = g.nodes.length + 1;
  for (let i = 0; cur && i <= guard; i++) {
    path.unshift(cur);
    if (cur === sourceId) break;
    cur = parent.get(cur);
  }
  if (path[0] !== sourceId) return null;
  return { path, cost: dist.get(targetId)! };
}

/* ── Landmark distance table ─────────────────────────────────────────────── */

/** Exact shortest-path distances from each landmark to every node.
 *  Because the graph is undirected, d(L, v) = d(v, L), so one Dijkstra run
 *  per landmark is enough. This is the preprocessing step of the ALT family
 *  of techniques (A*, Landmarks, Triangle inequality). */
export class LandmarkTable {
  readonly table = new Map<string, Map<string, number>>(); // landmarkId → nodeId → distance

  constructor(g: Graph, landmarkIds: string[]) {
    const adj = buildAdjacency(g);
    for (const L of landmarkIds) {
      if (!adj.has(L)) continue;
      this.table.set(L, dijkstra(g, L, adj).dist);
    }
  }

  get landmarks(): string[] { return [...this.table.keys()]; }

  /** d(L, v), or undefined when v is not reachable from the landmark. */
  distance(landmarkId: string, nodeId: string): number | undefined {
    return this.table.get(landmarkId)?.get(nodeId);
  }
}
