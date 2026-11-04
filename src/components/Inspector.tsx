import { useEffect, useState } from 'react';
import { Trash2, MapPin, Flag, Diamond } from 'lucide-react';
import { useApp, currentStep } from '../state/store';
import { labelOf, getNode, degree, edgeBetween } from '../lib/graph';
import { Chip } from './ui';
import LandmarkMath from './LandmarkMath';

/* ── Node details + rename + role assignment ────────────────────────────── */
export function NodeInspector() {
  const s = useApp();
  const id = s.inspectNodeId ?? s.selectedNodeId;
  const node = id ? getNode(s.graph, id) : undefined;
  const [draft, setDraft] = useState('');
  const step = currentStep(s);

  useEffect(() => { setDraft(node?.label ?? ''); }, [node?.id, node?.label]);

  if (!node) {
    return <p className="text-[12px] leading-relaxed text-white/45">Click any node on the canvas to inspect its coordinates, connections and heuristic derivation.</p>;
  }

  const isStart = s.graph.startId === node.id;
  const isGoal = s.graph.goalId === node.id;
  const isLandmark = s.graph.landmarkIds.includes(node.id);
  const inFrontier = step?.frontier.find((f) => f.nodeId === node.id);
  const isExplored = step?.explored.includes(node.id);
  const neighbours = s.graph.edges
    .filter((e) => e.a === node.id || e.b === node.id)
    .map((e) => ({ id: e.a === node.id ? e.b : e.a, weight: e.weight, edgeId: e.id }));

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="tlabel !text-[9px]">NODE</div>
          <div className="font-display text-[20px] leading-tight truncate">{node.label}</div>
        </div>
        <button className="btn btn-danger !px-2 !py-1.5" onClick={() => s.deleteNode(node.id)} aria-label={`Delete node ${node.label}`}>
          <Trash2 size={12} />
        </button>
      </div>

      <label className="block">
        <span className="tlabel !text-[9px]">RENAME</span>
        <div className="flex gap-1.5 mt-1.5">
          <input value={draft} maxLength={14} onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') s.rename(node.id, draft); }} aria-label="Node label" />
          <button className="btn" onClick={() => s.rename(node.id, draft)} disabled={!draft.trim() || draft === node.label}>SET</button>
        </div>
      </label>

      <div className="grid grid-cols-3 gap-1.5">
        <Chip active={isStart} onClick={() => s.assignStart(node.id)}><MapPin size={12} /> START</Chip>
        <Chip active={isGoal} onClick={() => s.assignGoal(node.id)}><Flag size={12} /> GOAL</Chip>
        <Chip active={isLandmark} onClick={() => s.flipLandmark(node.id)}><Diamond size={12} /> LM</Chip>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="panel px-2.5 py-1.5">
          <div className="tlabel !text-[9px]">COORDINATES</div>
          <div className="tvalue text-[11.5px] mt-0.5 text-cyan">{node.x}, {node.y}</div>
        </div>
        <div className="panel px-2.5 py-1.5">
          <div className="tlabel !text-[9px]">DEGREE</div>
          <div className="tvalue text-[11.5px] mt-0.5">{degree(s.graph, node.id)}</div>
        </div>
      </div>

      {step && (
        <div className="panel px-2.5 py-2">
          <div className="tlabel !text-[9px] mb-1">SEARCH STATE AT THIS STEP</div>
          <div className="tvalue text-[11.5px]" style={{ color: inFrontier ? '#F2DF6B' : isExplored ? '#A78BFA' : 'rgba(255,255,255,0.45)' }}>
            {inFrontier ? `IN FRONTIER — h ${inFrontier.h}, g ${inFrontier.g}` : isExplored ? 'EXPLORED' : 'NOT YET REACHED'}
          </div>
        </div>
      )}

      <div>
        <div className="tlabel !text-[9px] mb-1.5">CONNECTIONS</div>
        {neighbours.length === 0 ? (
          <p className="text-[11.5px] text-white/40">This node has no connections. Use the CONNECT tool to link it.</p>
        ) : (
          <div className="space-y-1">
            {neighbours.map((nb) => (
              <div key={nb.edgeId} className="flex items-center gap-2">
                <span className="tvalue text-[11px] flex-1 truncate text-white/70">→ {labelOf(s.graph, nb.id)}</span>
                <input type="number" min={0.1} step={0.1} value={nb.weight} className="!w-[72px] !py-1 !text-[11px]"
                  aria-label={`Weight of edge to ${labelOf(s.graph, nb.id)}`}
                  onChange={(e) => s.updateEdgeWeight(nb.edgeId, +e.target.value)} />
                <button className="btn btn-danger !px-1.5 !py-1" onClick={() => s.deleteEdge(nb.edgeId)}
                  aria-label={`Delete edge to ${labelOf(s.graph, nb.id)}`}><Trash2 size={11} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="hairline-t pt-3">
        <div className="tlabel !text-[9px] mb-2">LANDMARK HEURISTIC DERIVATION</div>
        <LandmarkMath nodeId={node.id} compact />
      </div>
    </div>
  );
}

/* ── Selected edge editor ───────────────────────────────────────────────── */
export function EdgeInspector() {
  const s = useApp();
  const edge = s.graph.edges.find((e) => e.id === s.selectedEdgeId);
  const [w, setW] = useState('');
  useEffect(() => { setW(edge ? String(edge.weight) : ''); }, [edge?.id, edge?.weight]);
  if (!edge) return null;

  return (
    <div className="space-y-2.5">
      <div className="tvalue text-[13px]">
        {labelOf(s.graph, edge.a)} <span className="text-white/35">↔</span> {labelOf(s.graph, edge.b)}
      </div>
      <label className="block">
        <span className="tlabel !text-[9px]">TRAVEL COST (EDGE WEIGHT)</span>
        <div className="flex gap-1.5 mt-1.5">
          <input type="number" min={0.1} step={0.1} value={w} onChange={(e) => setW(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') s.updateEdgeWeight(edge.id, +w); }} aria-label="Edge weight" />
          <button className="btn" onClick={() => s.updateEdgeWeight(edge.id, +w)}>SET</button>
        </div>
      </label>
      <p className="text-[11px] leading-snug text-white/40">
        Edge weights are travel costs. They are never used as heuristic values — the heuristic is always an estimate of the
        remaining distance to the destination.
      </p>
      <div className="flex gap-1.5">
        <button className="btn btn-danger" onClick={() => s.deleteEdge(edge.id)}><Trash2 size={12} /> DELETE EDGE</button>
        <button className="btn" onClick={() => s.selectEdge(null)}>CLOSE</button>
      </div>
    </div>
  );
}
