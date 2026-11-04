import { Graph } from '../lib/graph';
import { SearchResult } from '../lib/searchEngine';
import { NODE_COLORS } from '../state/store';

/* Static snapshot of a finished run: which nodes were explored, which route
 * was returned. Used for the side-by-side heuristic comparison. */
export default function ResultMiniGraph({ graph, result, height = 180 }: {
  graph: Graph; result: SearchResult; height?: number;
}) {
  const last = result.steps[result.steps.length - 1];
  const explored = new Set(last?.explored ?? []);
  const frontier = new Set((last?.frontier ?? []).map((f) => f.nodeId));
  const path = new Set(result.path);
  const pathEdges = new Set(result.pathEdgeIds);
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));

  const xs = graph.nodes.map((n) => n.x), ys = graph.nodes.map((n) => n.y);
  const pad = 34;
  const minX = Math.min(...xs, 0) - pad, maxX = Math.max(...xs, 100) + pad;
  const minY = Math.min(...ys, 0) - pad, maxY = Math.max(...ys, 100) + pad;

  return (
    <svg viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`} style={{ height, width: '100%', display: 'block' }}
      role="img" aria-label={`Final state of the ${result.heuristicKind} heuristic run`}>
      {graph.edges.map((e) => {
        const a = byId.get(e.a), b = byId.get(e.b);
        if (!a || !b) return null;
        const on = pathEdges.has(e.id);
        return (
          <line key={e.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
            stroke={on ? '#72E6A1' : 'rgba(255,255,255,0.14)'} strokeWidth={on ? 4 : 1.4} strokeLinecap="round" />
        );
      })}
      {graph.nodes.map((n) => {
        const color = path.has(n.id) ? NODE_COLORS.path
          : explored.has(n.id) ? NODE_COLORS.explored
          : frontier.has(n.id) ? NODE_COLORS.frontier
          : 'rgba(80,90,102,0.9)';
        const isStart = graph.startId === n.id, isGoal = graph.goalId === n.id;
        return (
          <g key={n.id} transform={`translate(${n.x},${n.y})`}>
            {(isStart || isGoal) && <circle r={15} fill="none" stroke={isStart ? '#43D9E8' : '#72E6A1'} strokeWidth="2" />}
            {graph.landmarkIds.includes(n.id) && (
              <rect x={-17} y={-17} width={34} height={34} fill="none" stroke="#A78BFA" strokeWidth="1.6"
                strokeDasharray="5 4" transform="rotate(45)" />
            )}
            <circle r={9.5} fill={color} />
          </g>
        );
      })}
    </svg>
  );
}
