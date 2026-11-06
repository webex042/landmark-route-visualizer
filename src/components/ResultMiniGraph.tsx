import { Graph } from '../lib/graph';
import { SearchResult } from '../lib/searchEngine';
import { NODE_COLORS } from '../state/store';

/* Static snapshot of a finished run: which places were checked, which were
 * still waiting, and which route came back. Used for side-by-side
 * comparisons, so every place is named — a row of unlabelled dots cannot be
 * compared with anything. */
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
  const pad = 46;
  const minX = Math.min(...xs, 0) - pad, maxX = Math.max(...xs, 100) + pad;
  const minY = Math.min(...ys, 0) - pad, maxY = Math.max(...ys, 100) + pad;
  const w = maxX - minX;
  /* Sizes are written in on-screen pixels for a ~560px-wide card and scaled
     into the drawing, so labels stay legible whatever the map's extent. */
  const u = w / 560;
  const showNames = graph.nodes.length <= 24;

  return (
    <svg viewBox={`${minX} ${minY} ${w} ${maxY - minY}`} style={{ height, width: '100%', display: 'block' }}
      className="graph-canvas" role="img" aria-label={`Final state of the ${result.algorithm === 'bfs' ? 'Breadth-First' : 'Best-First'} run`}>
      {graph.edges.map((e) => {
        const a = byId.get(e.a), b = byId.get(e.b);
        if (!a || !b) return null;
        const on = pathEdges.has(e.id);
        return (
          <line key={e.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
            stroke={on ? '#72E6A1' : 'rgba(255,255,255,0.16)'} strokeWidth={on ? 5 * u : 1.5 * u} strokeLinecap="round" />
        );
      })}
      {graph.nodes.map((n) => {
        const color = path.has(n.id) ? NODE_COLORS.path
          : explored.has(n.id) ? NODE_COLORS.explored
          : frontier.has(n.id) ? NODE_COLORS.frontier
          : '#3A4350';
        const isStart = graph.startId === n.id, isGoal = graph.goalId === n.id;
        return (
          <g key={n.id} transform={`translate(${n.x},${n.y})`}>
            {(isStart || isGoal) && <circle r={15 * u} fill="none" stroke={isStart ? '#43D9E8' : '#72E6A1'} strokeWidth={2 * u} />}
            {graph.landmarkIds.includes(n.id) && (
              <rect x={-17 * u} y={-17 * u} width={34 * u} height={34 * u} fill="none" stroke="#A78BFA" strokeWidth={1.6 * u}
                strokeDasharray={`${5 * u} ${4 * u}`} transform="rotate(45)" />
            )}
            <circle r={9.5 * u} fill={color} />
            {showNames && (
              <text y={24 * u} textAnchor="middle" className="tvalue" fontSize={10.5 * u}
                fill={color === '#3A4350' ? 'rgba(244,245,247,0.5)' : color}>{n.label}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
