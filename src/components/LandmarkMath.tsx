import { useMemo } from 'react';
import { useApp } from '../state/store';
import { labelOf, getNode } from '../lib/graph';
import { LandmarkTable, optimalPath } from '../lib/dijkstra';
import { landmarkBreakdown, euclideanEstimate, round2 } from '../lib/heuristics';

/* ===========================================================================
 * HOW THE GUESS WAS WORKED OUT
 * Shows the full derivation of h(v,t) for one place: each landmark's two
 * measured distances, the guess it produces, which one wins, and how close
 * the winner is to the truth.
 * ========================================================================= */

export default function LandmarkMath({ nodeId, compact = false }: { nodeId: string | null; compact?: boolean }) {
  const graph = useApp((s) => s.graph);

  const data = useMemo(() => {
    if (!nodeId || !graph.goalId) return null;
    const table = new LandmarkTable(graph, graph.landmarkIds);
    const bd = landmarkBreakdown(table, nodeId, graph.goalId);
    const v = getNode(graph, nodeId), t = getNode(graph, graph.goalId);
    const trueRemaining = optimalPath(graph, nodeId, graph.goalId)?.cost ?? null;
    return { bd, euclid: v && t ? euclideanEstimate(v, t) : null, trueRemaining };
  }, [nodeId, graph]);

  if (!nodeId) return <p className="text-[13.5px] text-ink4">Pick a place on the map to see how its guess is built.</p>;
  if (!graph.goalId) return <p className="text-[13.5px] text-ink3">Choose a destination first — every guess is measured towards it.</p>;
  if (!data) return null;

  const { bd, euclid, trueRemaining } = data;
  const vLabel = labelOf(graph, nodeId);
  const tLabel = labelOf(graph, graph.goalId);
  const valid = bd.terms.filter((x) => x.valid);

  return (
    <div className="space-y-3.5">
      <div className="grid grid-cols-2 gap-3">
        <div className="panel px-3.5 py-3">
          <div className="text-[13px] text-ink4">From here</div>
          <div className="tvalue text-[16px] text-cyan mt-1">{vLabel}</div>
        </div>
        <div className="panel px-3.5 py-3">
          <div className="text-[13px] text-ink4">To the destination</div>
          <div className="tvalue text-[16px] text-signal mt-1">{tLabel}</div>
        </div>
      </div>

      {!graph.landmarkIds.length ? (
        <div className="panel px-4 py-3.5">
          <p className="text-[13.5px] leading-relaxed text-ink2">
            No landmarks have been chosen, so this method has nothing to measure from and guesses 0 everywhere. Switch to
            Select, click a place, and press Landmark to add one.
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-2.5">
            {bd.terms.map((term) => {
              const L = labelOf(graph, term.landmarkId);
              const chosen = term.valid && term.landmarkId === bd.chosenLandmarkId;
              return (
                <div key={term.landmarkId} className="panel px-3.5 py-3.5">
                  <div className="flex items-center justify-between gap-3 mb-2.5">
                    <span className="text-[14px] text-violet">Landmark {L}</span>
                    {chosen && <span className="text-[12.5px] text-amber">this one wins</span>}
                    {!term.valid && <span className="text-[12.5px] text-ink4">not usable</span>}
                  </div>

                  {term.valid ? (
                    <div className="space-y-2">
                      <div className="flex justify-between text-[13.5px]">
                        <span className="text-ink3">Road distance {L} → {vLabel}</span>
                        <span className="tvalue text-ink1">{term.dLv}</span>
                      </div>
                      <div className="flex justify-between text-[13.5px]">
                        <span className="text-ink3">Road distance {L} → {tLabel}</span>
                        <span className="tvalue text-ink1">{term.dLt}</span>
                      </div>
                      <div className="flex justify-between text-[14px] pt-2.5 mt-1 border-t border-white/[0.07]">
                        <span className="text-ink2">Difference: |{term.dLt} − {term.dLv}|</span>
                        <span className="tvalue text-amber">{term.estimate}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[13px] leading-snug text-ink4">
                      This landmark {term.reason === 'cannot reach this node' ? 'has no road to this place'
                        : term.reason === 'cannot reach the destination' ? 'has no road to the destination'
                        : 'cannot reach this place or the destination'}, so it cannot tell us anything. It is skipped
                      rather than being allowed to produce a nonsense number.
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="panel px-4 py-3.5">
            <div className="text-[13px] text-ink4 mb-2">The guess we use</div>
            <div className="tvalue text-[13.5px] text-ink3 leading-relaxed">
              biggest of {'{'}{valid.length ? valid.map((x) => x.estimate).join(', ') : '—'}{'}'}
            </div>
            <div className="tvalue text-[28px] text-amber mt-2">{bd.value}</div>
            {valid.length > 1 && (
              <p className="text-[13px] leading-relaxed text-ink3 mt-3">
                Each landmark gives a number the real distance cannot possibly be below. The biggest of those is still
                safe — and it is the closest to the truth — so we take the biggest rather than the average.
              </p>
            )}
          </div>

          {!compact && (
            <div className="panel px-4 py-3.5">
              <div className="text-[13px] text-ink4 mb-3">How good is this guess?</div>
              <div className="space-y-2">
                <div className="flex justify-between text-[13.5px]"><span className="text-ink3">Landmark guess</span><span className="tvalue text-amber">{bd.value}</span></div>
                <div className="flex justify-between text-[13.5px]"><span className="text-ink3">Straight-line guess</span><span className="tvalue text-cyan">{euclid ?? '—'}</span></div>
                <div className="flex justify-between text-[13.5px]"><span className="text-ink3">Actual distance left</span><span className="tvalue text-signal">{trueRemaining ?? 'no route'}</span></div>
                {trueRemaining !== null && (
                  <div className="flex justify-between text-[13.5px] pt-2.5 mt-1 border-t border-white/[0.07]">
                    <span className="text-ink2">How much it underestimates by</span>
                    <span className="tvalue text-ink1">{round2(trueRemaining - bd.value)}</span>
                  </div>
                )}
              </div>
              {trueRemaining !== null && (
                <p className="text-[13px] leading-relaxed text-ink3 mt-3">
                  {bd.value <= trueRemaining + 1e-9
                    ? 'The guess never claims the journey is shorter than it really is — that is what makes it safe to trust. The smaller the gap, the better the search is informed.'
                    : 'This guess is larger than the real distance left, which should not happen on a two-way map. Worth investigating.'}
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
