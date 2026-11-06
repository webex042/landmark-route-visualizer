import { useState, useRef, useLayoutEffect } from 'react';
import { motion } from 'framer-motion';
import { Sliders, Crosshair, ListTree, Code2, ChevronUp, ChevronDown, Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import GraphCanvas from '../components/GraphCanvas';
import Toolbar from '../components/Toolbar';
import { NodeInspector, EdgeInspector } from '../components/Inspector';
import { ExecutionControls, DecisionPanel, QueueStrip, Pseudocode, HeuristicPicker, AlgorithmPicker, RouteBanner } from '../components/Execution';
import { Panel, SectionHead, Metric, GraphLegend } from '../components/ui';
import { useApp } from '../state/store';
import { labelOf } from '../lib/graph';
import { HEURISTIC_META } from '../lib/heuristics';
import { formatDuration, ALGORITHM_META } from '../lib/searchEngine';

type Tab = 'controls' | 'inspect' | 'trace' | 'code';
const TABS: { id: Tab; label: string; icon: typeof Sliders }[] = [
  { id: 'controls', label: 'Set up', icon: Sliders },
  { id: 'inspect', label: 'Inspect', icon: Crosshair },
  { id: 'trace', label: 'Steps', icon: ListTree },
  { id: 'code', label: 'Code', icon: Code2 },
];

export default function Visualizer() {
  const s = useApp();
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
  const algo = ALGORITHM_META[s.algorithm];
  const bfs = s.algorithm === 'bfs';

  const headline = s.result
    ? s.result.success
      ? `Route found — ${s.result.path.map((id) => labelOf(s.graph, id)).join(' → ')}`
      : 'No route exists between these two places'
    : 'Ready — press Start the search';

  return (
    <div className="mx-auto max-w-[1600px] px-4 sm:px-6 py-10 md:py-14">
      <SectionHead index="03" kicker="TRY IT YOURSELF" title="Route Finding Visualizer"
        lead="Pick a start and a destination, then watch Breadth-First Search explore the map ring by ring — with the queue, the visited places and a plain sentence for every move. Switch to Best-First Search to see what a landmark guess changes." />

      {/* ── Status strip ───────────────────────────────────────────────── */}
      <div className="panel px-4 py-3.5 mb-3 flex flex-wrap items-center gap-x-7 gap-y-2.5">
        <div className="flex items-center gap-2.5">
          <span className="h-2 w-2 rounded-full shrink-0" style={{ background: s.result ? (s.result.success ? '#72E6A1' : '#FF647C') : '#FFB547' }} />
          <span className="text-[14px] text-ink1">{headline}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="tlabel">Algorithm</span>
          <span className="text-[14px]" style={{ color: algo.color }}>{algo.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="tlabel">Guess</span>
          <span className="text-[14px]" style={{ color: bfs ? 'var(--ink-4)' : meta.color }}>{bfs ? 'not used' : meta.plain}</span>
        </div>
        {s.result && (
          <>
            <div className="flex items-center gap-2">
              <span className="tlabel">Route length</span>
              <span className="tvalue text-[14px] text-signal">{s.result.success ? s.result.pathCost : '—'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="tlabel">Shortest possible</span>
              <span className="tvalue text-[14px] text-cyan">{s.result.optimalCost ?? '—'}</span>
            </div>
          </>
        )}
        <div className="ml-auto hidden sm:flex items-center gap-2">
          <span className="tlabel">Places</span><span className="tvalue text-[14px] text-ink1">{s.graph.nodes.length}</span>
          <span className="tlabel ml-3">Roads</span><span className="tvalue text-[14px] text-ink1">{s.graph.edges.length}</span>
        </div>
      </div>

      {/* ══ DESKTOP / TABLET LAYOUT ═══════════════════════════════════════ */}
      <div className="hidden md:grid gap-3 md:grid-cols-[1fr_340px] lg:grid-cols-[288px_1fr_372px] min-w-0-all">
        {/* left: editor */}
        <div className="hidden lg:block">
          <Panel title="Build the map" ticks className="h-full">
            <div className="max-h-[calc(100vh-200px)] overflow-y-auto scroll-tech pr-1">
              <Toolbar />
            </div>
          </Panel>
        </div>

        {/* centre: canvas + controls + the waiting list */}
        <div className="min-w-0 space-y-3">
          <Panel ticks dense className="overflow-hidden relative">
            <div className="h-[clamp(400px,58vh,660px)]">
              <GraphCanvas />
            </div>
            {bfs && s.toggles.heuristics && s.graph.landmarkIds.length > 0 && (
              <div className="absolute right-3 top-3 max-w-[300px] text-[12.5px] leading-snug text-ink3 px-3 py-2 rounded-[10px] bg-black/80 backdrop-blur pointer-events-none">
                <span className="text-cyan">ring</span> = roads from the start. Grey <span className="tvalue">guess</span> numbers are landmark
                estimates — shown for reference, not used by Breadth-First Search.
              </div>
            )}
            <div className="absolute left-3 bottom-3 text-[13.5px] text-ink4 pointer-events-none select-none hidden sm:block">
              Scroll to zoom · drag the background to move · drag a circle to reposition it
            </div>
          </Panel>

          <Panel title="Playback" ticks>
            <ExecutionControls />
          </Panel>

          <RouteBanner />

          {/* The waiting list sits directly beneath the map, because it is the
              thing the algorithm is actually reasoning about. */}
          <Panel title="What the algorithm is holding" ticks>
            <QueueStrip />
          </Panel>

          {/* tablet-only editor below canvas */}
          <div className="lg:hidden">
            <Panel title="Build the map" ticks>
              <Toolbar />
            </Panel>
          </div>
        </div>

        {/* right: what's happening */}
        <div className="space-y-3 min-w-0">
          <Panel title="Choose the algorithm" ticks><AlgorithmPicker /></Panel>
          <Panel title="What is happening right now" ticks>
            <DecisionPanel />
          </Panel>
          {s.selectedEdgeId && (
            <Panel title="The road you clicked" ticks><EdgeInspector /></Panel>
          )}
          <Panel title={bfs ? 'Landmarks and the guess' : 'How it guesses'} ticks><HeuristicPicker /></Panel>
          <Panel title="The place you clicked" ticks>
            <div className="max-h-[540px] overflow-y-auto scroll-tech pr-1"><NodeInspector /></div>
          </Panel>
        </div>

        {/* full-width lower row */}
        <div className="md:col-span-2 lg:col-span-3 grid gap-3 lg:grid-cols-[1fr_1fr]">
          <Panel title="The algorithm, line by line" ticks><Pseudocode /></Panel>
          <Panel title="What the colours mean" ticks>
            <GraphLegend />
            <p className="text-[13px] leading-relaxed text-ink3 mt-4 pt-3.5 hairline-t">
              A circle changes colour the moment its situation changes. Yellow means found but not yet checked, amber
              means being checked right now, purple means finished with. When the search succeeds, the whole route
              turns green.
            </p>
          </Panel>
        </div>

        {/* metrics */}
        {s.result && (
          <div className="md:col-span-2 lg:col-span-3 grid gap-3 grid-cols-2 lg:grid-cols-5">
            <Metric label="Places checked" value={s.result.nodesExpanded} accent="#A78BFA" sub="opened up and looked around" />
            <Metric label="Places found" value={s.result.nodesGenerated} accent="#F2DF6B" sub="ever put on the waiting list" />
            <Metric label="Guesses made" value={s.result.heuristicEvals} accent="#FFB547" sub="one per place, then reused" />
            <Metric label="Route length" value={s.result.success ? s.result.pathCost : '—'} accent="#72E6A1"
              sub={s.result.isOptimal === false ? `the shortest possible is ${s.result.optimalCost}` : s.result.isOptimal ? 'this is the shortest possible' : undefined} />
            <Metric label="Time taken" value={formatDuration(s.result.executionTimeMs)} accent="#43D9E8" sub={`median of ${s.result.timingRuns} runs`} />
          </div>
        )}
      </div>

      {/* ══ MOBILE LAYOUT — full-width canvas + bottom sheet ═════════════ */}
      <div className="md:hidden">
        <Panel ticks dense className="overflow-hidden">
          <div className="h-[44vh] min-h-[280px]"><GraphCanvas /></div>
        </Panel>

        {/* Execution controls stay in the page flow, so they are never hidden
            behind the sheet while it is collapsed. */}
        <div className="mt-2.5 panel px-3 py-3">
          <ExecutionControls compact />
        </div>

        <div className="mt-2.5"><RouteBanner /></div>

        <div className="mt-2.5 panel px-3 py-3">
          <QueueStrip />
        </div>

        <div className="mt-2.5 panel px-3 py-3">
          <div className="tlabel mb-2.5">What the colours mean</div>
          <GraphLegend compact />
        </div>

        {s.result && (
          <div className="mt-2.5 grid grid-cols-2 gap-2.5">
            <Metric label="Places checked" value={s.result.nodesExpanded} accent="#A78BFA" />
            <Metric label="Route length" value={s.result.success ? s.result.pathCost : '—'} accent="#72E6A1"
              sub={s.result.isOptimal === false ? `shortest is ${s.result.optimalCost}` : s.result.isOptimal ? 'shortest possible' : undefined} />
          </div>
        )}

        {/* Bottom sheet — collapsed by default so it never covers the controls */}
        <motion.div className="fixed inset-x-0 bottom-0 z-40 sheet overflow-hidden"
          initial={false}
          animate={{ y: sheetOpen ? 0 : `calc(100% - ${headH}px)` }}
          transition={{ type: 'spring', stiffness: 320, damping: 34 }}>
          <div ref={sheetHeadRef}>
            <div className="flex items-center gap-2 px-3 pt-3 pb-2">
              <button className="flex items-center gap-2 flex-1 min-w-0 text-left"
                onClick={() => setSheetOpen((o) => !o)} aria-expanded={sheetOpen}
                aria-label={sheetOpen ? 'Close the step panel' : 'Open the step panel'}>
                {sheetOpen ? <ChevronDown size={17} className="text-ink3 shrink-0" /> : <ChevronUp size={17} className="text-cyan shrink-0" />}
                <span className="tlabel truncate">Step details</span>
              </button>
              {s.result && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <button className="btn !px-2.5 !py-2" onClick={s.stepBack} disabled={s.stepIndex === 0} aria-label="Go back one step"><SkipBack size={14} /></button>
                  <button className="btn !px-2.5 !py-2" onClick={() => (s.playing ? s.pause() : s.play())} aria-label={s.playing ? 'Pause' : 'Play'}>
                    {s.playing ? <Pause size={14} /> : <Play size={14} />}
                  </button>
                  <button className="btn !px-2.5 !py-2" onClick={s.stepForward}
                    disabled={s.stepIndex >= (s.result.steps.length - 1)} aria-label="Go forward one step"><SkipForward size={14} /></button>
                </div>
              )}
            </div>

            <div className="flex gap-1.5 px-3 pb-2.5 overflow-x-auto scroll-tech">
              {TABS.map((t) => {
                const Icon = t.icon;
                return (
                  <button key={t.id} onClick={() => { setTab(t.id); setSheetOpen(true); }}
                    className={`btn !px-3 !py-2 shrink-0 ${tab === t.id && sheetOpen ? 'btn-active' : ''}`}>
                    <Icon size={13} /> {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="px-3 pb-7 max-h-[60vh] overflow-y-auto scroll-tech">
            {tab === 'controls' && (
              <div className="space-y-4">
                <AlgorithmPicker />
                <HeuristicPicker />
                <div className="hairline-t pt-3.5"><Toolbar /></div>
              </div>
            )}
            {tab === 'inspect' && (
              <div className="space-y-3">
                {s.selectedEdgeId && <div className="panel p-3"><EdgeInspector /></div>}
                <NodeInspector />
              </div>
            )}
            {tab === 'trace' && (
              <div className="space-y-4">
                <DecisionPanel />
                <div className="hairline-t pt-3.5"><Pseudocode /></div>
              </div>
            )}
            {tab === 'code' && <Pseudocode />}
          </div>
        </motion.div>

        {/* keeps the last of the page clear of the collapsed sheet */}
        <div style={{ height: headH + 16 }} aria-hidden />
      </div>

    </div>
  );
}
