import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, SkipForward, SkipBack, RotateCcw, Search, ChevronRight, ArrowRight, Info } from 'lucide-react';
import { useApp, currentStep } from '../state/store';
import { labelOf } from '../lib/graph';
import {
  PSEUDOCODE, PSEUDOCODE_PLAIN, PSEUDOCODE_BFS, PSEUDOCODE_BFS_PLAIN, ALGORITHM_META, Algorithm,
} from '../lib/searchEngine';
import { HEURISTIC_META, HeuristicKind } from '../lib/heuristics';
import { PHASE_PLAIN } from '../lib/vocabulary';
import { Chip, GraphLegend } from './ui';

/* ── Animation ticker: advances the cursor while playing ─────────────────── */
export function useAnimationClock() {
  const playing = useApp((s) => s.playing);
  const speed = useApp((s) => s.speed);
  const stepIndex = useApp((s) => s.stepIndex);
  const result = useApp((s) => s.result);

  useEffect(() => {
    if (!playing || !result) return;
    if (stepIndex >= result.steps.length - 1) { useApp.setState({ playing: false }); return; }
    const id = setTimeout(() => useApp.setState({ stepIndex: stepIndex + 1 }), Math.max(90, 1000 / speed));
    return () => clearTimeout(id);
  }, [playing, speed, stepIndex, result]);
}

/* ── Which algorithm ─────────────────────────────────────────────────────── */
export function AlgorithmPicker() {
  const s = useApp();
  return (
    <div className="grid gap-2">
      {(Object.keys(ALGORITHM_META) as Algorithm[]).map((a) => {
        const m = ALGORITHM_META[a];
        const active = s.algorithm === a;
        return (
          <button key={a} onClick={() => s.setAlgorithm(a)} aria-pressed={active}
            className={`text-left px-4 py-3 rounded-[12px] transition-colors ${active ? 'bg-white/[0.08]' : 'bg-white/[0.025] hover:bg-white/[0.06]'}`}
            style={{ boxShadow: active ? `inset 0 0 0 1px ${m.color}80` : undefined }}>
            <div className="flex items-center gap-2.5">
              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: m.color, opacity: active ? 1 : 0.4 }} />
              <span className="text-[15px] font-medium" style={{ color: active ? '#fff' : 'var(--ink-2)' }}>{m.name}</span>
              <span className="ml-auto text-[12px] text-ink4">{m.usesHeuristic ? 'uses the guess' : 'no guess'}</span>
            </div>
            <p className="text-[13.5px] leading-snug text-ink3 mt-1.5 pl-5">{m.oneLiner}</p>
            {active && <p className="text-[13.5px] leading-relaxed text-ink2 mt-2.5 pl-5">{m.blurb}</p>}
          </button>
        );
      })}
    </div>
  );
}

/* ── Heuristic selector ──────────────────────────────────────────────────── */
export function HeuristicPicker() {
  const s = useApp();
  const bfs = s.algorithm === 'bfs';

  if (bfs) {
    return (
      <div>
        <div className="flex items-start gap-3 px-4 py-3.5 rounded-[12px] bg-white/[0.04]">
          <Info size={16} className="text-cyan shrink-0 mt-0.5" />
          <div>
            <p className="text-[14px] leading-relaxed text-ink1">Breadth-First Search does not use a guess.</p>
            <p className="text-[13.5px] leading-relaxed text-ink3 mt-1.5">
              It only follows the order of the queue. The grey <span className="tvalue">guess</span> numbers on the map are
              the landmark estimates, shown so you can see them — but they never change what Breadth-First Search does.
              Switch to Best-First Search to watch a guess take control.
            </p>
          </div>
        </div>
        <button className="btn w-full mt-3" onClick={() => s.setAlgorithm('gbfs')}>
          Try it with Best-First Search <ArrowRight size={15} />
        </button>
      </div>
    );
  }

  return (
    <div>
      <p className="text-[13.5px] leading-snug text-ink3 mb-3">
        Best-First Search ranks the waiting list by this guess and nothing else. Change it and the whole search changes.
      </p>
      <div className="grid gap-2">
        {(Object.keys(HEURISTIC_META) as HeuristicKind[]).map((k) => {
          const m = HEURISTIC_META[k];
          const active = s.heuristic === k;
          return (
            <button key={k} onClick={() => s.setHeuristic(k)} aria-pressed={active}
              className={`text-left px-4 py-3 rounded-[12px] transition-colors ${active ? 'bg-white/[0.08]' : 'bg-white/[0.025] hover:bg-white/[0.06]'}`}
              style={{ boxShadow: active ? `inset 0 0 0 1px ${m.color}80` : undefined }}>
              <div className="flex items-center gap-2.5">
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: m.color, opacity: active ? 1 : 0.4 }} />
                <span className="text-[14.5px]" style={{ color: active ? '#fff' : 'var(--ink-2)' }}>{m.plain}</span>
              </div>
              <p className="text-[13.5px] leading-snug text-ink3 mt-1 pl-5">{m.oneLiner}</p>
              {active && <p className="text-[13.5px] leading-relaxed text-ink2 mt-2 pl-5">{m.blurb}</p>}
            </button>
          );
        })}
      </div>
    </div>
  );
}


/* ── Start / destination / landmarks, chosen directly ─────────────────────
 * Clicking a place and then pressing a role button still works, but a
 * beginner should not have to discover that. Two plain drop-downs say
 * exactly what they do.
 * ----------------------------------------------------------------------- */
export function RoutePicker() {
  const s = useApp();
  const g = s.graph;
  const sorted = [...g.nodes].sort((a, b) => a.label.localeCompare(b.label));
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block">
        <span className="flex items-center gap-2 text-[13.5px] text-ink3 mb-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-cyan" /> Start — where the journey begins
        </span>
        <select value={g.startId ?? ''} onChange={(e) => e.target.value && s.assignStart(e.target.value)} aria-label="Starting place">
          {!g.startId && <option value="">Choose a place…</option>}
          {sorted.map((n) => <option key={n.id} value={n.id} disabled={n.id === g.goalId}>{n.label}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="flex items-center gap-2 text-[13.5px] text-ink3 mb-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-signal" /> Destination — where we want to reach
        </span>
        <select value={g.goalId ?? ''} onChange={(e) => e.target.value && s.assignGoal(e.target.value)} aria-label="Destination">
          {!g.goalId && <option value="">Choose a place…</option>}
          {sorted.map((n) => <option key={n.id} value={n.id} disabled={n.id === g.startId}>{n.label}</option>)}
        </select>
      </label>
      <div className="sm:col-span-2">
        <span className="flex items-center gap-2 text-[13.5px] text-ink3 mb-1.5">
          <span className="h-2.5 w-2.5 rotate-45 bg-violet" /> Landmarks — reference places for the distance guess
        </span>
        <div className="flex flex-wrap gap-1.5">
          {sorted.map((n) => {
            const on = g.landmarkIds.includes(n.id);
            return (
              <button key={n.id} onClick={() => s.flipLandmark(n.id)} aria-pressed={on}
                className={`tvalue text-[12.5px] px-2.5 py-1.5 rounded-[8px] transition-colors ${on ? 'bg-violet/[0.2] text-[#D4C6FF]' : 'bg-white/[0.04] text-ink3 hover:bg-white/[0.08]'}`}
                style={on ? { boxShadow: 'inset 0 0 0 1px rgba(167,139,250,0.6)' } : undefined}>
                {n.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── Final result banner — the end of the story ─────────────────────────── */
export function RouteBanner() {
  const s = useApp();
  const step = currentStep(s);
  const r = s.result;
  if (!r || !step || (step.phase !== 'success' && step.phase !== 'failure')) return null;
  const g = s.graph;

  if (step.phase === 'failure') {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-[14px] px-5 py-4" style={{ background: 'rgba(255,100,124,0.1)', boxShadow: 'inset 0 0 0 1px rgba(255,100,124,0.4)' }}>
        <div className="text-[15px] font-medium text-[#FFB3BF]">No route exists</div>
        <p className="text-[14px] text-ink2 mt-1">Every reachable place was checked and the destination was never found.</p>
      </motion.div>
    );
  }

  const bfs = r.algorithm === 'bfs';
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-[14px] px-5 py-4" style={{ background: 'rgba(114,230,161,0.08)', boxShadow: 'inset 0 0 0 1px rgba(114,230,161,0.4)' }}>
      <div className="text-[13.5px] text-signal">Final route</div>
      <div className="tvalue text-[16px] md:text-[18px] text-white mt-1.5 leading-snug break-words">
        {r.path.map((id) => labelOf(g, id)).join(' → ')}
      </div>
      <div className="flex flex-wrap gap-x-8 gap-y-3 mt-4">
        <div>
          <div className="stat-label">Roads used</div>
          <div className="tvalue text-[22px] font-semibold text-white mt-0.5">{r.pathEdgeCount}</div>
        </div>
        <div>
          <div className="stat-label">Total length</div>
          <div className="tvalue text-[22px] font-semibold text-white mt-0.5">{r.pathCost}</div>
        </div>
        <div>
          <div className="stat-label">Shortest length possible</div>
          <div className="tvalue text-[22px] font-semibold text-ink2 mt-0.5">{r.optimalCost ?? '—'}</div>
        </div>
      </div>
      <p className="text-[13.5px] leading-relaxed text-ink2 mt-3.5">
        {bfs
          ? r.isOptimal
            ? 'Breadth-First Search found the route with the fewest roads — and here that also happens to be the shortest.'
            : `Breadth-First Search found the route with the fewest roads (${r.pathEdgeCount}). But it never looked at road lengths, so it is not the shortest route — that one is ${r.optimalCost} long.`
          : r.isOptimal
            ? 'Best-First Search found the shortest route here. That is not guaranteed — it only followed the guess.'
            : `Best-First Search followed the guess and found a route ${r.pathCost} long. The shortest one is ${r.optimalCost} — it never checks.`}
      </p>
    </motion.div>
  );
}

/* ── Transport controls ──────────────────────────────────────────────────── */
export function ExecutionControls({ compact = false }: { compact?: boolean }) {
  const s = useApp();
  const step = currentStep(s);
  const total = s.result?.steps.length ?? 0;
  const atEnd = total > 0 && s.stepIndex >= total - 1;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      if (e.code === 'Space') { e.preventDefault(); s.playing ? s.pause() : s.play(); }
      else if (e.key === 'ArrowRight' && e.shiftKey) { e.preventDefault(); s.stepForward(); }
      else if (e.key === 'ArrowLeft' && e.shiftKey) { e.preventDefault(); s.stepBack(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [s.playing]);

  const SPEEDS: [number, string][] = [[0.6, 'Slow'], [1.6, 'Normal'], [3, 'Fast'], [6, 'Fastest']];

  return (
    <div className="space-y-4">
      {!s.result ? (
        <div className="pb-4 hairline-b"><RoutePicker /></div>
      ) : (
        <div className="text-[14px] text-ink3">
          From <span className="tvalue text-cyan">{labelOf(s.graph, s.graph.startId)}</span> to{' '}
          <span className="tvalue text-signal">{labelOf(s.graph, s.graph.goalId)}</span>
          {' '}· <button className="underline underline-offset-4 hover:text-white" onClick={s.resetExecution}>change</button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {!s.result ? (
          <button className="btn btn-primary btn-lg" onClick={s.runSearch}><Search size={16} /> Start the search</button>
        ) : (
          <>
            <button className="btn btn-primary btn-lg" onClick={() => (s.playing ? s.pause() : s.play())}
              aria-label={s.playing ? 'Pause' : atEnd ? 'Play again' : 'Play'}>
              {s.playing ? <><Pause size={16} /> Pause</> : <><Play size={16} /> {atEnd ? 'Play again' : 'Play'}</>}
            </button>
            <button className="btn btn-lg" onClick={s.stepBack} disabled={s.stepIndex === 0} aria-label="Go back one step"><SkipBack size={15} /> Back</button>
            <button className="btn btn-lg" onClick={s.stepForward} disabled={atEnd} aria-label="Go forward one step"><SkipForward size={15} /> Next step</button>
            <button className="btn btn-danger btn-lg" onClick={s.resetExecution} aria-label="Start over"><RotateCcw size={15} /> Start over</button>
          </>
        )}
      </div>

      {!s.result && (
        <p className="text-[14px] leading-relaxed text-ink3">
          Press the button and {ALGORITHM_META[s.algorithm].name} runs for real on the map — one step at a time, with a
          sentence explaining each move. You can pause and step backwards at any point.
        </p>
      )}

      {s.result && (
        <>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[14px] text-ink2">Step {s.stepIndex + 1} of {total}</span>
              <span className="text-[13.5px] text-ink3">{PHASE_PLAIN[step?.phase ?? ''] ?? ''}</span>
            </div>
            <input type="range" min={0} max={Math.max(0, total - 1)} value={s.stepIndex}
              onChange={(e) => s.gotoStep(+e.target.value)} aria-label="Jump to any step" />
          </div>

          <div>
            <div className="text-[14px] text-ink2 mb-2">Speed — {s.speed.toFixed(1)} steps per second</div>
            <input type="range" min={0.4} max={8} step={0.2} value={s.speed} onChange={(e) => s.setSpeed(+e.target.value)} aria-label="Animation speed" />
            <div className="flex flex-wrap gap-2 mt-3">
              {SPEEDS.map(([v, name]) => (
                <Chip key={v} active={Math.abs(s.speed - v) < 0.05} onClick={() => s.setSpeed(v)}>{name}</Chip>
              ))}
            </div>
          </div>
        </>
      )}

      {!compact && (
        <div className="hairline-t pt-4">
          <div className="text-[14px] text-ink2 mb-3">What the colours mean</div>
          <GraphLegend />
        </div>
      )}
    </div>
  );
}

/* ── The queue / waiting list, shown as a row of cards ──────────────────────
 * The single most important panel for a beginner: it makes visible the thing
 * the algorithm is actually reasoning about. The leftmost card always comes
 * out next — for Breadth-First because it arrived first, for Best-First
 * because its guess is smallest.
 * ------------------------------------------------------------------------ */
export function QueueStrip() {
  const s = useApp();
  const step = currentStep(s);
  const g = s.graph;
  const bfs = (step?.algorithm ?? s.algorithm) === 'bfs';

  const title = bfs ? 'Queue' : 'Waiting list';
  const tech = bfs ? 'first in, first out' : 'frontier · sorted by guess';

  if (!step) {
    return (
      <p className="text-[14px] leading-relaxed text-ink3">
        {bfs
          ? 'The queue appears here once the search starts. It holds the places waiting to be checked, in the order they were found.'
          : 'The waiting list appears here once the search starts. It holds every place found but not yet checked, smallest guess first.'}
      </p>
    );
  }

  const queue = step.frontier;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-[16px] font-medium text-ink1">{title}</span>
        <span className="text-[13px] text-ink4">{tech} · {queue.length} waiting</span>
        <span className="text-[13px] text-ink4 ml-auto">{bfs ? 'front of the queue is on the left' : 'smallest guess on the left'}</span>
      </div>

      {queue.length === 0 ? (
        <div className="text-[14px] text-ink3 px-4 py-5 rounded-[12px] bg-white/[0.03] text-center">
          The {bfs ? 'queue' : 'waiting list'} is empty.
        </div>
      ) : (
        <div className="flex items-stretch gap-2 overflow-x-auto scroll-tech pb-2">
          <AnimatePresence initial={false}>
            {queue.map((f, i) => {
              const next = i === 0;
              return (
                <motion.div key={f.nodeId}
                  layout
                  initial={{ opacity: 0, x: 18 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -18 }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                  className="shrink-0 px-3.5 py-3 rounded-[12px] min-w-[124px]"
                  style={{
                    background: next ? 'rgba(242,223,107,0.1)' : 'rgba(255,255,255,0.03)',
                    boxShadow: next ? 'inset 0 0 0 1px rgba(242,223,107,0.55)' : 'inset 0 0 0 1px rgba(255,255,255,0.08)',
                  }}>
                  <div className="text-[11.5px] h-[15px] tracking-[0.08em] text-amber">{next ? 'NEXT OUT' : `${i + 1}`}</div>
                  <div className="tvalue text-[15px] truncate mt-0.5" style={{ color: next ? '#F2DF6B' : 'var(--ink-1)' }}>
                    {labelOf(g, f.nodeId)}
                  </div>
                  {bfs ? (
                    <div className="tvalue text-[13.5px] text-cyan mt-2">ring {f.depth}</div>
                  ) : (
                    <div className="tvalue text-[13.5px] text-amber mt-2">{f.h} to go</div>
                  )}
                  <div className="text-[12.5px] text-ink4 mt-1 truncate">from {labelOf(g, f.parentId)}</div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      <p className="text-[13.5px] leading-relaxed text-ink3">
        {bfs
          ? <>Places join at the <span className="text-ink1">back</span> and leave from the <span className="text-ink1">front</span>, like a line at a ticket counter. That is all it takes to check every ring before moving to the next one.</>
          : <>Sorted by the <span className="text-amber">guess of distance left</span> only. The distance already travelled never affects the order — that is what makes this greedy.</>}
      </p>

      <div className="hairline-t pt-4">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-2.5">
          <span className="text-[16px] font-medium text-ink1">{bfs ? 'Visited' : 'Already checked'}</span>
          <span className="text-[13px] text-ink4">{step.explored.length} done</span>
        </div>
        {step.explored.length === 0 ? (
          <div className="text-[14px] text-ink4">Nothing checked yet.</div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {step.explored.map((id) => (
              <span key={id} className="tvalue text-[13.5px] px-2.5 py-1 rounded-[7px] text-violet bg-violet/[0.12]">
                {labelOf(g, id)}
              </span>
            ))}
          </div>
        )}
        <p className="text-[13.5px] leading-relaxed text-ink3 mt-2.5">
          Visited places are not checked again. That is what stops the search going round in circles.
        </p>
      </div>
    </div>
  );
}

/* Kept under the old name so existing imports keep working. */
export const FrontierPanel = QueueStrip;

/* ── Live explanation panel: what, why, and what next ──────────────────── */
export function DecisionPanel() {
  const s = useApp();
  const step = currentStep(s);
  const [showDetail, setShowDetail] = useState(false);
  const g = s.graph;

  if (!step) {
    return (
      <div className="text-[14.5px] leading-relaxed text-ink3">
        Press <span className="text-white font-medium">Start the search</span> and this panel will explain every step as it
        happens: what is happening, why, and what comes next. Nothing here is pre-written — it is produced by the algorithm
        as it runs.
      </div>
    );
  }

  const bfs = step.algorithm === 'bfs';
  const tone = step.phase === 'success' ? '#72E6A1' : step.phase === 'failure' ? '#FF647C' : step.phase === 'select' ? '#FFB547' : '#43D9E8';
  const nextStep = s.result?.steps[step.index + 1];

  return (
    <div className="space-y-3">
      <AnimatePresence mode="wait">
        <motion.div key={step.index}
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}>

          <div className="flex items-center gap-2.5 mb-3">
            <span className="tvalue text-[12px] px-2 py-1 rounded-[6px] whitespace-nowrap shrink-0" style={{ color: tone, background: `${tone}1f` }}>
              Step {step.index + 1}
            </span>
            <span className="text-[16px] leading-tight text-ink1 font-medium">{step.title}</span>
          </div>

          {/* What is happening — and why. The largest text in the panel. */}
          <div className="px-4 py-3.5 rounded-[12px]" style={{ background: 'rgba(255,255,255,0.035)', boxShadow: `inset 3px 0 0 ${tone}` }}>
            <p className="text-[15.5px] leading-relaxed text-ink1">{step.decision}</p>
          </div>

          {step.currentId && (
            <div className="grid grid-cols-2 gap-2.5 mt-3">
              <div className="panel px-3.5 py-2.5">
                <div className="stat-label">Checking now</div>
                <div className="tvalue text-[17px] text-amber mt-1">{labelOf(g, step.currentId)}</div>
              </div>
              <div className="panel px-3.5 py-2.5">
                <div className="stat-label">{bfs ? 'Ring' : 'Arrived from'}</div>
                <div className="tvalue text-[17px] text-ink1 mt-1">
                  {bfs ? `${step.depth} road${step.depth === 1 ? '' : 's'} out` : labelOf(g, step.parents[step.currentId]) ?? '—'}
                </div>
              </div>
            </div>
          )}

          {step.neighbours.length > 0 && (
            <div className="mt-3">
              <div className="text-[14px] text-ink2 mb-2">{bfs ? 'Neighbours — places one road away' : 'Roads leading out of here'}</div>
              <div className="space-y-1.5">
                {step.neighbours.map((nb) => {
                  const added = nb.status === 'added';
                  return (
                    <div key={nb.nodeId} className="px-3 py-2 rounded-[10px]"
                      style={{ background: added ? 'rgba(242,223,107,0.09)' : 'rgba(255,255,255,0.03)' }}>
                      <div className="flex items-baseline gap-2">
                        <ChevronRight size={13} className="shrink-0 translate-y-[2px]" style={{ color: added ? '#F2DF6B' : 'var(--ink-4)' }} />
                        <span className="tvalue text-[14px] flex-1 min-w-0 break-words" style={{ color: added ? '#F2DF6B' : 'var(--ink-2)' }}>
                          {labelOf(g, nb.nodeId)}
                        </span>
                        {!bfs && <span className="tvalue text-[13.5px] text-amber shrink-0">{nb.h} to go</span>}
                      </div>
                      <div className="text-[13px] text-ink4 mt-1 pl-[21px]">
                        {added
                          ? (bfs ? 'new — added to the back of the queue' : 'new — added to the waiting list')
                          : nb.status === 'already-in-frontier' ? 'already waiting — skipped' : 'already visited — skipped'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* What happens next — the third of the three questions. */}
          {nextStep && (
            <div className="mt-3 flex items-start gap-2.5 text-[14px] leading-snug">
              <span className="text-ink4 shrink-0">Next:</span>
              <span className="text-ink2">{nextStep.title}{nextStep.currentId && nextStep.phase === 'select' ? ` — ${labelOf(g, nextStep.currentId)}` : ''}.</span>
            </div>
          )}

          <button className="mt-3 text-[13.5px] text-ink3 hover:text-white underline underline-offset-4"
            onClick={() => setShowDetail((v) => !v)} aria-expanded={showDetail}>
            {showDetail ? 'Hide the technical version' : 'Show the technical version'}
          </button>
          {showDetail && (
            <p className="text-[13.5px] leading-relaxed text-ink3 mt-2 px-4 py-3 rounded-[10px] bg-white/[0.03]">
              {step.detail}
            </p>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* ── Pseudocode with live line highlighting ─────────────────────────────── */
export function Pseudocode() {
  const s = useApp();
  const step = currentStep(s);
  const active = new Set(step?.pseudocodeLines ?? []);
  const [plain, setPlain] = useState(true);
  const bfs = (step?.algorithm ?? s.algorithm) === 'bfs';
  const lines = bfs ? (plain ? PSEUDOCODE_BFS_PLAIN : PSEUDOCODE_BFS) : (plain ? PSEUDOCODE_PLAIN : PSEUDOCODE);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Chip active={plain} onClick={() => setPlain(true)}>Plain English</Chip>
        <Chip active={!plain} onClick={() => setPlain(false)}>Pseudocode</Chip>
        <span className="text-[13px] text-ink4 ml-auto">{ALGORITHM_META[bfs ? 'bfs' : 'gbfs'].name}</span>
      </div>
      <pre className="tvalue text-[13px] leading-[1.85] overflow-x-auto scroll-tech m-0">
        {lines.map((line, i) => {
          const on = active.has(i);
          return (
            <div key={i}
              className="flex gap-3 px-2 -mx-2 rounded-[4px] transition-colors duration-200"
              style={{ background: on ? 'rgba(255,181,71,0.14)' : undefined, boxShadow: on ? 'inset 3px 0 0 #FFB547' : undefined }}>
              <span className="text-ink4 select-none w-4 text-right shrink-0">{i + 1}</span>
              <span className="whitespace-pre" style={{ color: on ? '#FFD79A' : 'var(--ink-3)' }}>{line}</span>
            </div>
          );
        })}
      </pre>
      <p className="text-[13.5px] leading-relaxed text-ink3 mt-4 pt-4 hairline-t">
        The highlighted line is the one running right now. Watch line 6: we only ask “is this the destination?” when a
        place is <em>taken out</em> — not when it is first found. That is why the destination can sit
        waiting for a few steps before the search stops.
      </p>
    </div>
  );
}
