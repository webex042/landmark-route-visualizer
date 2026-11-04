import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, SkipForward, SkipBack, RotateCcw, Search } from 'lucide-react';
import { useApp, currentStep, NODE_COLORS } from '../state/store';
import { labelOf } from '../lib/graph';
import { PSEUDOCODE } from '../lib/searchEngine';
import { HEURISTIC_META, HeuristicKind } from '../lib/heuristics';
import { Chip, Swatch } from './ui';

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

/* ── Heuristic selector ──────────────────────────────────────────────────── */
export function HeuristicPicker() {
  const s = useApp();
  return (
    <div>
      <div className="tlabel mb-2">HEURISTIC FUNCTION</div>
      <div className="grid gap-1.5">
        {(Object.keys(HEURISTIC_META) as HeuristicKind[]).map((k) => {
          const m = HEURISTIC_META[k];
          const active = s.heuristic === k;
          return (
            <button key={k} onClick={() => s.setHeuristic(k)}
              aria-pressed={active}
              className={`text-left px-2.5 py-2 border transition-colors ${active ? 'bg-white/[0.04]' : 'border-white/[0.08] hover:border-white/20'}`}
              style={{ borderColor: active ? `${m.color}88` : undefined }}>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 shrink-0" style={{ background: m.color, opacity: active ? 1 : 0.4 }} />
                <span className="tvalue text-[11px] tracking-[0.1em]" style={{ color: active ? m.color : 'rgba(255,255,255,0.72)' }}>
                  {m.name.toUpperCase()}
                </span>
              </div>
              {active && <p className="text-[11.5px] leading-snug text-white/50 mt-1.5">{m.blurb}</p>}
            </button>
          );
        })}
      </div>
    </div>
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

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {!s.result ? (
          <button className="btn btn-primary" onClick={s.runSearch}><Search size={13} /> START SEARCH</button>
        ) : (
          <>
            <button className="btn btn-primary" onClick={() => (s.playing ? s.pause() : s.play())}
              aria-label={s.playing ? 'Pause' : atEnd ? 'Replay' : 'Play'}>
              {s.playing ? <><Pause size={13} /> PAUSE</> : <><Play size={13} /> {atEnd ? 'REPLAY' : 'RESUME'}</>}
            </button>
            <button className="btn" onClick={s.stepBack} disabled={s.stepIndex === 0} aria-label="Previous step"><SkipBack size={13} /> PREV</button>
            <button className="btn" onClick={s.stepForward} disabled={atEnd} aria-label="Next step"><SkipForward size={13} /> NEXT</button>
            <button className="btn btn-danger" onClick={s.resetExecution} aria-label="Reset execution"><RotateCcw size={13} /> RESET</button>
          </>
        )}
      </div>

      {s.result && (
        <>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="tlabel !text-[9px]">STEP {s.stepIndex + 1} / {total}</span>
              <span className="tvalue text-[9.5px] text-white/40 uppercase tracking-[0.14em]">{step?.phase}</span>
            </div>
            <input type="range" min={0} max={Math.max(0, total - 1)} value={s.stepIndex}
              onChange={(e) => s.gotoStep(+e.target.value)} aria-label="Scrub through algorithm steps" />
            <div className="mt-1.5 h-[3px] bg-white/10 overflow-hidden">
              <motion.div className="h-full bg-cyan" animate={{ width: `${total > 1 ? (s.stepIndex / (total - 1)) * 100 : 0}%` }} transition={{ duration: 0.25 }} />
            </div>
          </div>

          <label className="block">
            <span className="tlabel !text-[9px]">SPEED — {s.speed.toFixed(1)} STEPS / SEC</span>
            <input type="range" min={0.4} max={8} step={0.2} value={s.speed} onChange={(e) => s.setSpeed(+e.target.value)} className="mt-1.5" />
          </label>
          <div className="flex gap-1.5">
            {[0.6, 1.6, 3, 6].map((v) => (
              <Chip key={v} active={Math.abs(s.speed - v) < 0.05} onClick={() => s.setSpeed(v)}>
                {v < 1 ? 'SLOW' : v < 2 ? 'NORMAL' : v < 4 ? 'FAST' : 'TURBO'}
              </Chip>
            ))}
          </div>
        </>
      )}

      {!compact && (
        <div className="hairline-t pt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5">
          <Swatch color={NODE_COLORS.start} label="START" />
          <Swatch color={NODE_COLORS.goal} label="DESTINATION" />
          <Swatch color={NODE_COLORS.current} label="CURRENT" />
          <Swatch color={NODE_COLORS.frontier} label="FRONTIER" />
          <Swatch color={NODE_COLORS.explored} label="EXPLORED" />
          <Swatch color={NODE_COLORS.idle} label="UNVISITED" />
          <Swatch color="#72E6A1" label="FINAL ROUTE" shape="line" />
          <Swatch color="#A78BFA" label="LANDMARK" shape="diamond" />
        </div>
      )}
    </div>
  );
}

/* ── Live decision / explanation panel ──────────────────────────────────── */
export function DecisionPanel() {
  const s = useApp();
  const step = currentStep(s);
  const g = s.graph;

  if (!step) {
    return (
      <div className="text-[12.5px] leading-relaxed text-white/45">
        Press <span className="tvalue text-amber">START SEARCH</span> to run Greedy Best-First Search on this graph. Every step
        below is produced by the real algorithm — nothing here is scripted.
      </div>
    );
  }

  const tone = step.phase === 'success' ? '#72E6A1' : step.phase === 'failure' ? '#FF647C' : step.phase === 'select' ? '#FFB547' : '#43D9E8';

  return (
    <div className="space-y-3">
      <AnimatePresence mode="wait">
        <motion.div key={step.index}
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}>
          <div className="flex items-center gap-2 mb-2">
            <span className="tvalue text-[9.5px] px-1.5 py-0.5 border" style={{ color: tone, borderColor: `${tone}66` }}>
              {step.phase.toUpperCase()}
            </span>
            <span className="tvalue text-[11px] text-white/80 tracking-[0.06em]">{step.title}</span>
          </div>

          {step.currentId && (
            <div className="grid grid-cols-2 gap-2 mb-2.5">
              <div className="panel px-2.5 py-1.5">
                <div className="tlabel !text-[9px]">CURRENT NODE</div>
                <div className="tvalue text-[13px] text-amber mt-0.5">{labelOf(g, step.currentId)}</div>
              </div>
              <div className="panel px-2.5 py-1.5">
                <div className="tlabel !text-[9px]">PARENT</div>
                <div className="tvalue text-[13px] text-white/70 mt-0.5">{labelOf(g, step.parents[step.currentId]) ?? '—'}</div>
              </div>
            </div>
          )}

          {step.neighbours.length > 0 && (
            <div className="mb-2.5">
              <div className="tlabel !text-[9px] mb-1.5">AVAILABLE NEIGHBOURS</div>
              <div className="space-y-1">
                {step.neighbours.map((nb) => (
                  <div key={nb.nodeId} className="flex items-center gap-2 text-[11.5px]">
                    <span className="tvalue w-16 shrink-0 truncate" style={{ color: nb.status === 'added' ? '#F2DF6B' : 'rgba(255,255,255,0.4)' }}>
                      {labelOf(g, nb.nodeId)}
                    </span>
                    <span className="tvalue text-amber w-14 shrink-0">h {nb.h}</span>
                    <span className="tvalue text-cyan/70 w-14 shrink-0">w {nb.weight}</span>
                    <span className="tlabel !text-[8.5px] !tracking-[0.1em] truncate">
                      {nb.status === 'added' ? 'ADDED TO FRONTIER' : nb.status === 'already-in-frontier' ? 'ALREADY QUEUED' : 'ALREADY EXPLORED'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="panel px-3 py-2.5 bg-black/35" style={{ borderColor: `${tone}33` }}>
            <div className="tlabel !text-[9px] mb-1.5" style={{ color: tone }}>DECISION</div>
            <p className="text-[12.5px] leading-relaxed text-white/75">{step.decision}</p>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* ── Frontier + explored lists ──────────────────────────────────────────── */
export function FrontierPanel() {
  const s = useApp();
  const step = currentStep(s);
  const g = s.graph;
  if (!step) return <p className="text-[12px] text-white/40">The frontier and explored set appear once the search starts.</p>;

  return (
    <div className="grid sm:grid-cols-2 gap-3">
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="tlabel !text-[9px]">FRONTIER (PRIORITY QUEUE)</span>
          <span className="tvalue text-[10px] text-white/40">{step.frontier.length}</span>
        </div>
        <div className="space-y-1 max-h-[190px] overflow-y-auto scroll-tech pr-1">
          {step.frontier.length === 0 && <div className="text-[11.5px] text-white/35">empty</div>}
          {step.frontier.map((f, i) => (
            <div key={f.nodeId}
              className="flex items-center gap-2 px-2 py-1.5 border"
              style={{ borderColor: i === 0 ? 'rgba(242,223,107,0.45)' : 'rgba(255,255,255,0.07)', background: i === 0 ? 'rgba(242,223,107,0.07)' : undefined }}>
              <span className="tvalue text-[9px] text-white/30 w-4">{i + 1}</span>
              <span className="tvalue text-[11.5px] flex-1 truncate" style={{ color: i === 0 ? '#F2DF6B' : 'rgba(255,255,255,0.75)' }}>{labelOf(g, f.nodeId)}</span>
              <span className="tvalue text-[11px] text-amber">h {f.h}</span>
              <span className="tvalue text-[10px] text-cyan/60">g {f.g}</span>
              <span className="tvalue text-[9.5px] text-white/30">← {labelOf(g, f.parentId)}</span>
            </div>
          ))}
        </div>
        {step.frontier.length > 0 && (
          <p className="text-[11px] leading-snug text-white/40 mt-1.5">
            Ordered by h(n) only. g is displayed for information — it plays no part in the ordering.
          </p>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="tlabel !text-[9px]">EXPLORED SET</span>
          <span className="tvalue text-[10px] text-white/40">{step.explored.length}</span>
        </div>
        <div className="flex flex-wrap gap-1 max-h-[190px] overflow-y-auto scroll-tech">
          {step.explored.length === 0 && <div className="text-[11.5px] text-white/35">empty</div>}
          {step.explored.map((id) => (
            <span key={id} className="tvalue text-[10.5px] px-1.5 py-1 border border-violet/35 text-violet bg-violet/[0.08]">{labelOf(g, id)}</span>
          ))}
        </div>
        <div className="mt-3 pt-2.5 hairline-t space-y-1">
          <div className="flex justify-between tvalue text-[10.5px]"><span className="text-white/45">ITERATION</span><span>{step.iteration}</span></div>
          <div className="flex justify-between tvalue text-[10.5px]"><span className="text-white/45">h(n) EVALUATIONS</span><span>{step.heuristicEvals}</span></div>
          <div className="flex justify-between tvalue text-[10.5px]"><span className="text-white/45">PROGRESS</span><span>{Math.round(((s.stepIndex + 1) / (s.result?.steps.length ?? 1)) * 100)}%</span></div>
        </div>
      </div>
    </div>
  );
}

/* ── Pseudocode with live line highlighting ─────────────────────────────── */
export function Pseudocode() {
  const s = useApp();
  const step = currentStep(s);
  const active = new Set(step?.pseudocodeLines ?? []);

  return (
    <div>
      <pre className="tvalue text-[11px] leading-[1.75] overflow-x-auto scroll-tech m-0">
        {PSEUDOCODE.map((line, i) => {
          const on = active.has(i);
          return (
            <div key={i}
              className="flex gap-2.5 px-1.5 -mx-1.5 transition-colors duration-200"
              style={{ background: on ? 'rgba(255,181,71,0.13)' : undefined, borderLeft: `2px solid ${on ? '#FFB547' : 'transparent'}` }}>
              <span className="text-white/25 select-none w-4 text-right shrink-0">{i + 1}</span>
              <span className="whitespace-pre" style={{ color: on ? '#FFD79A' : 'rgba(231,236,242,0.6)' }}>{line}</span>
            </div>
          );
        })}
      </pre>
      <p className="text-[11px] leading-snug text-white/40 mt-2 pt-2 hairline-t">
        The highlighted line is the one the engine is executing at this step. Note line 5: the goal test happens when a node is
        <em> selected</em>, not when it is first generated — which is why the destination can sit in the frontier for several steps.
      </p>
    </div>
  );
}
