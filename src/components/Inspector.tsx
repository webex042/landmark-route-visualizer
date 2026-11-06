import { useEffect, useState } from 'react';
import { Trash2, MapPin, Flag, Diamond } from 'lucide-react';
import { useApp, currentStep } from '../state/store';
import { labelOf, getNode, degree } from '../lib/graph';
import { Chip } from './ui';
import LandmarkMath from './LandmarkMath';

/* ── Place details + rename + role assignment ───────────────────────────── */
export function NodeInspector() {
  const s = useApp();
  const id = s.inspectNodeId ?? s.selectedNodeId;
  const node = id ? getNode(s.graph, id) : undefined;
  const [draft, setDraft] = useState('');
  const step = currentStep(s);

  useEffect(() => { setDraft(node?.label ?? ''); }, [node?.id, node?.label]);

  if (!node) {
    return <p className="text-[13.5px] leading-relaxed text-ink3">Click any place on the map to see its roads, its distance guess, and exactly how that guess was worked out.</p>;
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
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[13px] text-ink4">Place</div>
          <div className="font-display text-[23px] leading-tight truncate">{node.label}</div>
        </div>
        <button className="btn btn-danger !px-3 !py-2 !min-h-[36px]" onClick={() => s.deleteNode(node.id)} aria-label={`Delete ${node.label}`}>
          <Trash2 size={13} />
        </button>
      </div>

      <label className="block">
        <span className="text-[13px] text-ink3">Rename it</span>
        <div className="flex gap-2 mt-2">
          <input value={draft} maxLength={14} onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') s.rename(node.id, draft); }} aria-label="Place name" />
          <button className="btn" onClick={() => s.rename(node.id, draft)} disabled={!draft.trim() || draft === node.label}>Save</button>
        </div>
      </label>

      <div className="grid grid-cols-3 gap-2">
        <Chip active={isStart} onClick={() => s.assignStart(node.id)}><MapPin size={13} /> Start</Chip>
        <Chip active={isGoal} onClick={() => s.assignGoal(node.id)}><Flag size={13} /> End</Chip>
        <Chip active={isLandmark} onClick={() => s.flipLandmark(node.id)}><Diamond size={13} /> Landmark</Chip>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="panel px-3.5 py-2.5">
          <div className="text-[13px] text-ink4">Position</div>
          <div className="tvalue text-[14px] mt-1">{node.x}, {node.y}</div>
        </div>
        <div className="panel px-3.5 py-2.5">
          <div className="text-[13px] text-ink4">Roads here</div>
          <div className="tvalue text-[14px] mt-1">{degree(s.graph, node.id)}</div>
        </div>
      </div>

      {step && (
        <div className="panel px-3.5 py-3">
          <div className="text-[13px] text-ink4 mb-1.5">Where this place stands right now</div>
          <div className="text-[14px]" style={{ color: inFrontier ? '#F2DF6B' : isExplored ? '#A78BFA' : 'var(--ink-3)' }}>
            {inFrontier
              ? `Waiting to be checked — looks ${inFrontier.h} from the destination, ${inFrontier.g} travelled to get here`
              : isExplored ? 'Already checked and finished with' : 'Not reached yet'}
          </div>
        </div>
      )}

      <div>
        <div className="text-[13px] text-ink3 mb-2">Roads leading out of here</div>
        {neighbours.length === 0 ? (
          <p className="text-[13px] text-ink4">No roads yet. Use “Add road” to connect it to somewhere.</p>
        ) : (
          <div className="space-y-2">
            {neighbours.map((nb) => (
              <div key={nb.edgeId} className="flex items-center gap-2.5">
                <span className="text-[13.5px] flex-1 truncate text-ink2">to {labelOf(s.graph, nb.id)}</span>
                <input type="number" min={0.1} step={0.1} value={nb.weight} className="!w-[82px] !py-1.5 !text-[13px]"
                  aria-label={`Length of the road to ${labelOf(s.graph, nb.id)}`}
                  onChange={(e) => s.updateEdgeWeight(nb.edgeId, +e.target.value)} />
                <button className="btn btn-danger !px-2.5 !py-1.5 !min-h-[32px]" onClick={() => s.deleteEdge(nb.edgeId)}
                  aria-label={`Delete the road to ${labelOf(s.graph, nb.id)}`}><Trash2 size={12} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="hairline-t pt-4">
        <div className="text-[13px] text-ink3 mb-3">How the guess for this place was worked out</div>
        <LandmarkMath nodeId={node.id} compact />
      </div>
    </div>
  );
}

/* ── Selected road editor ───────────────────────────────────────────────── */
export function EdgeInspector() {
  const s = useApp();
  const edge = s.graph.edges.find((e) => e.id === s.selectedEdgeId);
  const [w, setW] = useState('');
  useEffect(() => { setW(edge ? String(edge.weight) : ''); }, [edge?.id, edge?.weight]);
  if (!edge) return null;

  return (
    <div className="space-y-3">
      <div className="text-[15px]">
        {labelOf(s.graph, edge.a)} <span className="text-ink4">↔</span> {labelOf(s.graph, edge.b)}
      </div>
      <label className="block">
        <span className="text-[13px] text-ink3">How long is this road?</span>
        <div className="flex gap-2 mt-2">
          <input type="number" min={0.1} step={0.1} value={w} onChange={(e) => setW(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') s.updateEdgeWeight(edge.id, +w); }} aria-label="Road length" />
          <button className="btn" onClick={() => s.updateEdgeWeight(edge.id, +w)}>Save</button>
        </div>
      </label>
      <p className="text-[13px] leading-relaxed text-ink4">
        This is a real cost you pay by travelling. It is never used as the guess — the guess is always an estimate of
        what is still ahead. Mixing the two up is the most common mistake when learning this.
      </p>
      <div className="flex gap-2">
        <button className="btn btn-danger" onClick={() => s.deleteEdge(edge.id)}><Trash2 size={13} /> Delete road</button>
        <button className="btn" onClick={() => s.selectEdge(null)}>Close</button>
      </div>
    </div>
  );
}
