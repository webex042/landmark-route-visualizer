import { useMemo } from 'react';
import { useApp } from '../state/store';
import { labelOf, getNode } from '../lib/graph';
import { LandmarkTable } from '../lib/dijkstra';
import { landmarkBreakdown, euclideanEstimate, round2 } from '../lib/heuristics';
import { optimalPath } from '../lib/dijkstra';

/* ===========================================================================
 * LANDMARK HEURISTIC BREAKDOWN
 * Shows the full derivation of h(v,t) for one node: every landmark's two
 * precomputed distances, its individual estimate, which one wins, and how the
 * result compares with the true remaining distance.
 * ========================================================================= */

export default function LandmarkMath({ nodeId, compact = false }: { nodeId: string | null; compact?: boolean }) {
  const graph = useApp((s) => s.graph);

  const data = useMemo(() => {
    if (!nodeId || !graph.goalId) return null;
    const table = new LandmarkTable(graph, graph.landmarkIds);
    const bd = landmarkBreakdown(table, nodeId, graph.goalId);
    const v = getNode(graph, nodeId), t = getNode(graph, graph.goalId);
    const trueRemaining = optimalPath(graph, nodeId, graph.goalId)?.cost ?? null;
    return {
      bd,
      euclid: v && t ? euclideanEstimate(v, t) : null,
      trueRemaining,
    };
  }, [nodeId, graph]);

  if (!nodeId) return <p className="text-[12px] text-white/40">Select a node on the canvas to see how its heuristic value is derived.</p>;
  if (!graph.goalId) return <p className="text-[12px] text-amber/80">Assign a destination node first — the heuristic is always measured towards the destination.</p>;
  if (!data) return null;

  const { bd, euclid, trueRemaining } = data;
  const vLabel = labelOf(graph, nodeId);
  const tLabel = labelOf(graph, graph.goalId);
  const valid = bd.terms.filter((x) => x.valid);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="panel px-2.5 py-2">
          <div className="tlabel !text-[9px]">CURRENT NODE  v</div>
          <div className="tvalue text-[14px] text-cyan mt-0.5">{vLabel}</div>
        </div>
        <div className="panel px-2.5 py-2">
          <div className="tlabel !text-[9px]">DESTINATION  t</div>
          <div className="tvalue text-[14px] text-signal mt-0.5">{tLabel}</div>
        </div>
      </div>

      {!graph.landmarkIds.length ? (
        <div className="panel px-3 py-2.5" style={{ borderColor: '#FFB54744' }}>
          <p className="text-[12px] leading-relaxed text-amber/85">
            No landmarks are selected, so the landmark heuristic has no information to work with and returns h = 0 for every node.
            Switch to the SELECT tool, click a node, and press LANDMARK to add one.
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {bd.terms.map((term) => {
              const L = labelOf(graph, term.landmarkId);
              const chosen = term.valid && term.landmarkId === bd.chosenLandmarkId;
              return (
                <div key={term.landmarkId}
                  className="panel px-2.5 py-2.5 relative"
                  style={{ borderColor: chosen ? '#FFB54766' : term.valid ? undefined : '#FF647C44' }}>
                  {chosen && <div className="absolute left-0 top-0 h-full w-[2px] bg-amber" />}
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="tvalue text-[11px] text-violet tracking-[0.1em]">LANDMARK {L}</span>
                    {chosen && <span className="tvalue text-[9px] text-amber tracking-[0.14em]">SELECTED — TIGHTEST BOUND</span>}
                    {!term.valid && <span className="tvalue text-[9px] text-danger tracking-[0.14em]">IGNORED</span>}
                  </div>

                  {term.valid ? (
                    <div className="space-y-1">
                      <div className="flex justify-between tvalue text-[11px]">
                        <span className="text-white/45">d({L} → {vLabel})</span><span>{term.dLv}</span>
                      </div>
                      <div className="flex justify-between tvalue text-[11px]">
                        <span className="text-white/45">d({L} → {tLabel})</span><span>{term.dLt}</span>
                      </div>
                      <div className="flex justify-between tvalue text-[12px] pt-1.5 mt-1 border-t border-white/[0.07]">
                        <span className="text-white/60">h = |{term.dLt} − {term.dLv}|</span>
                        <span className="text-amber">{term.estimate}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11.5px] leading-snug text-white/45">
                      This landmark {term.reason}, so it yields no usable bound. It is skipped rather than contributing an infinite
                      or misleading value.
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="panel px-3 py-2.5 bg-black/40">
            <div className="tlabel !text-[9px] mb-1.5">COMBINED HEURISTIC</div>
            <div className="tvalue text-[12px] text-white/60 leading-relaxed">
              h({vLabel}, {tLabel}) = max {'{'}
              {valid.length ? valid.map((x) => x.estimate).join(', ') : '—'}
              {'}'}
            </div>
            <div className="tvalue text-[22px] text-amber mt-1.5">{bd.value}</div>
            {valid.length > 1 && (
              <p className="text-[11.5px] leading-snug text-white/45 mt-2">
                Each landmark gives a valid lower bound on the remaining distance. The largest of several lower bounds is still a
                lower bound — and the closest to the truth — so the maximum is taken rather than the average or the sum.
              </p>
            )}
          </div>

          {!compact && (
            <div className="panel px-3 py-2.5">
              <div className="tlabel !text-[9px] mb-2">HOW GOOD IS THIS ESTIMATE?</div>
              <div className="space-y-1">
                <div className="flex justify-between tvalue text-[11px]"><span className="text-white/45">Landmark estimate</span><span className="text-amber">{bd.value}</span></div>
                <div className="flex justify-between tvalue text-[11px]"><span className="text-white/45">Straight-line estimate</span><span className="text-cyan">{euclid ?? '—'}</span></div>
                <div className="flex justify-between tvalue text-[11px]"><span className="text-white/45">True remaining cost</span><span className="text-signal">{trueRemaining ?? 'unreachable'}</span></div>
                {trueRemaining !== null && (
                  <div className="flex justify-between tvalue text-[11px] pt-1.5 mt-1 border-t border-white/[0.07]">
                    <span className="text-white/60">Gap (true − landmark)</span>
                    <span>{round2(trueRemaining - bd.value)}</span>
                  </div>
                )}
              </div>
              {trueRemaining !== null && (
                <p className="text-[11.5px] leading-snug text-white/45 mt-2">
                  {bd.value <= trueRemaining + 1e-9
                    ? `The estimate never exceeds the true remaining cost, which is what makes it a valid lower bound. A smaller gap means a better-informed search.`
                    : `This estimate exceeds the true remaining cost, which can only happen on a directed or asymmetric graph — the bound assumes undirected edges.`}
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
