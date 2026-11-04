import { useState, useRef, useLayoutEffect } from 'react';
import { motion } from 'framer-motion';
import { Sliders, Crosshair, ListTree, Code2, ChevronUp, ChevronDown, Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import GraphCanvas from '../components/GraphCanvas';
import Toolbar from '../components/Toolbar';
import { NodeInspector, EdgeInspector } from '../components/Inspector';
import { ExecutionControls, DecisionPanel, FrontierPanel, Pseudocode, HeuristicPicker } from '../components/Execution';
import { Panel, SectionHead, Metric } from '../components/ui';
import { useApp, currentStep } from '../state/store';
import { labelOf } from '../lib/graph';
import { HEURISTIC_META } from '../lib/heuristics';
import { formatDuration } from '../lib/searchEngine';

type Tab = 'controls' | 'inspect' | 'trace' | 'code';
const TABS: { id: Tab; label: string; icon: typeof Sliders }[] = [
  { id: 'controls', label: 'CONTROLS', icon: Sliders },
  { id: 'inspect', label: 'INSPECT', icon: Crosshair },
  { id: 'trace', label: 'TRACE', icon: ListTree },
  { id: 'code', label: 'CODE', icon: Code2 },
];

export default function Visualizer() {
  const s = useApp();
  const step = currentStep(s);
  const [tab, setTab] = useState<Tab>('controls');
  const [sheetOpen, setSheetOpen] = useState(false);
  const sheetHeadRef = useRef<HTMLDivElement>(null);
  const [headH, setHeadH] = useState(88);

  /* Collapse exactly to the height of the handle + tab strip, so no content
     peeks out below the fold at any font size or device width. */
  useLayoutEffect(() => {
    const el = sheetHeadRef.current;
    if (!el) return;
    const measure = () => setHeadH(Math.ceil(el.getBoundingClientRect().height));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [s.result]);
  const meta = HEURISTIC_META[s.heuristic];

  const headline = s.result
    ? s.result.success
      ? `ROUTE: ${s.result.path.map((id) => labelOf(s.graph, id)).join(' → ')}`
      : 'NO ROUTE EXISTS'
    : 'IDLE — PRESS START SEARCH';

  return (
    <div className="mx-auto max-w-[1600px] px-4 sm:px-6 py-10 md:py-14">
      <SectionHead index="03" kicker="INTERACTIVE WORKSPACE" title="Route Finding Visualizer"
        lead="Build or edit the network, choose a heuristic, then watch Greedy Best-First Search run on it step by step. Every value on screen is computed by the algorithm engine from the graph as it currently stands." />

      {/* ── Status strip ───────────────────────────────────────────────── */}
      <div className="panel-glass px-3 py-2.5 mb-3 flex flex-wrap items-center gap-x-5 gap-y-2">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.result ? (s.result.success ? '#72E6A1' : '#FF647C') : '#FFB547' }} />
          <span className="tvalue text-[10.5px] tracking-[0.1em] text-white/80 truncate max-w-[52vw] sm:max-w-none">{headline}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="tlabel !text-[8.5px]">HEURISTIC</span>
          <span className="tvalue text-[10px]" style={{ color: meta.color }}>{meta.name.toUpperCase()}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="tlabel !text-[8.5px]">f(n)</span>
          <span className="tvalue text-[10px] text-amber">h(n)</span>
        </div>
        {s.result && (
          <>
            <div className="flex items-center gap-1.5">
              <span className="tlabel !text-[8.5px]">COST</span>
              <span className="tvalue text-[10px] text-signal">{s.result.success ? s.result.pathCost : '—'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="tlabel !text-[8.5px]">OPTIMAL</span>
              <span className="tvalue text-[10px] text-cyan">{s.result.optimalCost ?? '—'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="tlabel !text-[8.5px]">EXPANDED</span>
              <span className="tvalue text-[10px]">{s.result.nodesExpanded}</span>
            </div>
          </>
        )}
        <div className="ml-auto hidden sm:flex items-center gap-1.5">
          <span className="tlabel !text-[8.5px]">NODES</span><span className="tvalue text-[10px]">{s.graph.nodes.length}</span>
          <span className="tlabel !text-[8.5px] ml-2">EDGES</span><span className="tvalue text-[10px]">{s.graph.edges.length}</span>
        </div>
      </div>

      {/* ══ DESKTOP / TABLET LAYOUT ═══════════════════════════════════════ */}
      <div className="hidden md:grid gap-3 md:grid-cols-[1fr_320px] lg:grid-cols-[272px_1fr_332px] min-w-0-all">
        {/* left: editor */}
        <div className="hidden lg:block">
          <Panel title="GRAPH EDITOR" ticks className="h-full">
            <div className="max-h-[calc(100vh-200px)] overflow-y-auto scroll-tech pr-1">
              <Toolbar />
            </div>
          </Panel>
        </div>

        {/* centre: canvas */}
        <div className="min-w-0 space-y-3">
          <Panel ticks dense className="overflow-hidden relative">
            <div className="h-[clamp(380px,56vh,620px)]">
              <GraphCanvas />
            </div>
            <div className="absolute left-2.5 bottom-2.5 tlabel !text-[8px] pointer-events-none select-none">
              SCROLL TO ZOOM · DRAG CANVAS TO PAN · DRAG NODE TO MOVE
            </div>
          </Panel>

          <Panel title="EXECUTION CONTROL" ticks>
            <ExecutionControls />
          </Panel>

          {/* tablet-only editor below canvas */}
          <div className="lg:hidden">
            <Panel title="GRAPH EDITOR" ticks>
              <Toolbar />
            </Panel>
          </div>
        </div>

        {/* right: inspector column */}
        <div className="space-y-3 min-w-0">
          <Panel title="ALGORITHM INSPECTOR" ticks>
            <DecisionPanel />
          </Panel>
          {s.selectedEdgeId && (
            <Panel title="SELECTED EDGE" ticks><EdgeInspector /></Panel>
          )}
          <Panel title="HEURISTIC" ticks><HeuristicPicker /></Panel>
          <Panel title="NODE INSPECTOR" ticks>
            <div className="max-h-[520px] overflow-y-auto scroll-tech pr-1"><NodeInspector /></div>
          </Panel>
        </div>

        {/* full-width lower row */}
        <div className="md:col-span-2 lg:col-span-3 grid gap-3 lg:grid-cols-[1.35fr_1fr]">
          <Panel title="FRONTIER & EXPLORED SET" ticks><FrontierPanel /></Panel>
          <Panel title="PSEUDOCODE — LIVE EXECUTION" ticks><Pseudocode /></Panel>
        </div>

        {/* metrics */}
        {s.result && (
          <div className="md:col-span-2 lg:col-span-3 grid gap-3 grid-cols-2 lg:grid-cols-5">
            <Metric label="NODES EXPANDED" value={s.result.nodesExpanded} accent="#A78BFA" />
            <Metric label="NODES GENERATED" value={s.result.nodesGenerated} accent="#F2DF6B" />
            <Metric label="h(n) EVALUATIONS" value={s.result.heuristicEvals} accent="#FFB547" />
            <Metric label="PATH COST  g" value={s.result.success ? s.result.pathCost : '—'} accent="#72E6A1"
              sub={s.result.isOptimal === false ? `optimal is ${s.result.optimalCost}` : s.result.isOptimal ? 'this route is optimal' : undefined} />
            <Metric label="EXECUTION TIME" value={formatDuration(s.result.executionTimeMs)} accent="#43D9E8" sub={`per run · median of ${s.result.timingRuns} runs`} />
          </div>
        )}
      </div>

      {/* ══ MOBILE LAYOUT — full-width canvas + bottom sheet ═════════════ */}
      <div className="md:hidden">
        <Panel ticks dense className="overflow-hidden">
          <div className="h-[42vh] min-h-[260px]"><GraphCanvas /></div>
        </Panel>

        {/* Execution controls stay in the page flow, so they are never hidden
            behind the sheet while it is collapsed. */}
        <div className="mt-2 panel px-2.5 py-2.5">
          <ExecutionControls compact />
        </div>

        {s.result && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Metric label="EXPANDED" value={s.result.nodesExpanded} accent="#A78BFA" />
            <Metric label="PATH COST  g" value={s.result.success ? s.result.pathCost : '—'} accent="#72E6A1"
              sub={s.result.isOptimal === false ? `optimal is ${s.result.optimalCost}` : s.result.isOptimal ? 'optimal' : undefined} />
          </div>
        )}

        {/* Bottom sheet — collapsed by default so it never covers the controls */}
        <motion.div className="fixed inset-x-0 bottom-0 z-40 sheet overflow-hidden"
          initial={false}
          animate={{ y: sheetOpen ? 0 : `calc(100% - ${headH}px)` }}
          transition={{ type: 'spring', stiffness: 320, damping: 34 }}>
          <div ref={sheetHeadRef}>
          <div className="flex items-center gap-2 px-3 pt-2.5 pb-1.5">
            <button className="flex items-center gap-2 flex-1 min-w-0 text-left"
              onClick={() => setSheetOpen((o) => !o)} aria-expanded={sheetOpen}
              aria-label={sheetOpen ? 'Collapse algorithm inspector' : 'Expand algorithm inspector'}>
              {sheetOpen ? <ChevronDown size={15} className="text-white/50 shrink-0" /> : <ChevronUp size={15} className="text-cyan shrink-0" />}
              <span className="tlabel !text-[9px] truncate">ALGORITHM INSPECTOR</span>
            </button>
            {s.result && (
              <div className="flex items-center gap-1 shrink-0">
                <button className="btn !px-2 !py-1.5" onClick={s.stepBack} disabled={s.stepIndex === 0} aria-label="Previous step"><SkipBack size={12} /></button>
                <button className="btn !px-2 !py-1.5" onClick={() => (s.playing ? s.pause() : s.play())} aria-label={s.playing ? 'Pause' : 'Play'}>
                  {s.playing ? <Pause size={12} /> : <Play size={12} />}
                </button>
                <button className="btn !px-2 !py-1.5" onClick={s.stepForward}
                  disabled={s.stepIndex >= (s.result.steps.length - 1)} aria-label="Next step"><SkipForward size={12} /></button>
              </div>
            )}
          </div>

          <div className="flex gap-1 px-2 pb-2 overflow-x-auto scroll-tech">
            {TABS.map((t) => {
              const Icon = t.icon;
              return (
                <button key={t.id} onClick={() => { setTab(t.id); setSheetOpen(true); }}
                  className={`btn !px-2.5 !py-1.5 shrink-0 ${tab === t.id && sheetOpen ? 'btn-active' : ''}`}>
                  <Icon size={12} /> {t.label}
                </button>
              );
            })}
          </div>
          </div>

          <div className="px-3 pb-6 max-h-[58vh] overflow-y-auto scroll-tech">
            {tab === 'controls' && (
              <div className="space-y-4">
                <HeuristicPicker />
                <div className="hairline-t pt-3"><Toolbar /></div>
              </div>
            )}
            {tab === 'inspect' && (
              <div className="space-y-3">
                {s.selectedEdgeId && <div className="panel p-2.5"><EdgeInspector /></div>}
                <NodeInspector />
              </div>
            )}
            {tab === 'trace' && (
              <div className="space-y-4">
                <DecisionPanel />
                <div className="hairline-t pt-3"><FrontierPanel /></div>
                <div className="hairline-t pt-3"><Pseudocode /></div>
              </div>
            )}
            {tab === 'code' && <Pseudocode />}
          </div>
        </motion.div>

        {/* keeps the last of the page clear of the collapsed sheet */}
        <div style={{ height: headH + 14 }} aria-hidden />
      </div>

    </div>
  );
}
