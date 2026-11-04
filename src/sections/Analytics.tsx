import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Play, FileJson, FileSpreadsheet, Scale } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, Cell,
} from 'recharts';
import { Panel, SectionHead, Metric, Callout, Chip } from '../components/ui';
import ResultMiniGraph from '../components/ResultMiniGraph';
import { useApp } from '../state/store';
import { labelOf, validateGraph } from '../lib/graph';
import { HEURISTIC_META, HeuristicKind } from '../lib/heuristics';
import { metricRows, buildCSVExport, buildJSONExport, download, stamp } from '../lib/analytics';
import { search, formatDuration } from '../lib/searchEngine';

const KINDS: HeuristicKind[] = ['zero', 'euclidean', 'landmark'];

const chartTooltip = {
  contentStyle: { background: 'rgba(9,11,15,0.96)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 2, fontFamily: 'JetBrains Mono', fontSize: 11 },
  labelStyle: { color: 'rgba(231,236,242,0.6)' },
};
const axisTick = { fill: 'rgba(231,236,242,0.45)', fontSize: 9, fontFamily: 'JetBrains Mono' };

export default function Analytics() {
  const s = useApp();
  const g = s.graph;
  const valid = validateGraph(g);
  const cmp = s.comparison;

  /* Single-run report for the heuristic currently selected in the workspace. */
  const single = useMemo(() => (valid.ok ? (s.result ?? search(g, s.heuristic)) : null), [g, s.heuristic, s.result, valid.ok]);

  const bars = useMemo(() => {
    if (!cmp) return [];
    return KINDS.map((k) => ({
      name: HEURISTIC_META[k].short,
      heuristic: HEURISTIC_META[k].name,
      color: HEURISTIC_META[k].color,
      expanded: cmp[k].nodesExpanded,
      generated: cmp[k].nodesGenerated,
      visited: cmp[k].nodesVisited,
      explored: cmp[k].nodesExplored,
      cost: cmp[k].success ? cmp[k].pathCost : 0,
      evals: cmp[k].heuristicEvals,
      time: cmp[k].executionTimeMs,
      optimal: cmp[k].isOptimal,
    }));
  }, [cmp]);

  /* Frontier size over time — shows how differently each heuristic searches. */
  const frontierSeries = useMemo(() => {
    if (!cmp) return [];
    const maxLen = Math.max(...KINDS.map((k) => cmp[k].steps.length));
    return Array.from({ length: maxLen }, (_, i) => {
      const row: Record<string, number | string> = { step: i + 1 };
      for (const k of KINDS) {
        const st = cmp[k].steps[i];
        if (st) row[k] = st.frontier.length;
      }
      return row;
    });
  }, [cmp]);

  const exportResults = cmp ? KINDS.map((k) => cmp[k]) : single ? [single] : [];

  return (
    <div className="mx-auto max-w-[1600px] px-4 sm:px-6 py-10 md:py-14">
      <SectionHead index="05" kicker="COMPARISON & PERFORMANCE" title="Heuristic Comparison Laboratory"
        lead="Run all three heuristics against the same graph, the same start and the same destination, then read what each one actually cost. Every figure is measured from a real execution — nothing on this page is illustrative." />

      {!valid.ok ? (
        <Panel title="GRAPH NOT READY" ticks>
          <ul className="space-y-1.5">
            {valid.errors.map((e) => <li key={e} className="text-[12.5px] text-danger/90">■ {e}</li>)}
          </ul>
          <p className="text-[12.5px] text-white/50 mt-3">Fix these in the Visualizer and come back.</p>
        </Panel>
      ) : (
        <>
          {/* ── Run controls ───────────────────────────────────────────── */}
          <div className="panel-glass px-3 py-3 mb-4 flex flex-wrap items-center gap-2">
            <button className="btn btn-primary" onClick={s.runComparison}>
              <Scale size={13} /> {cmp ? 'RE-RUN ALL THREE' : 'RUN ALL THREE HEURISTICS'}
            </button>
            <span className="tvalue text-[10px] text-white/45">
              GRAPH: {g.nodes.length} NODES / {g.edges.length} EDGES · {labelOf(g, g.startId)} → {labelOf(g, g.goalId)} · LANDMARKS: {g.landmarkIds.length || 'none'}
            </span>
            <div className="ml-auto flex gap-1.5">
              <Chip disabled={!exportResults.length} onClick={() => download(`deepforge-analytics-${stamp()}.csv`, buildCSVExport(g, exportResults), 'text/csv')}>
                <FileSpreadsheet size={12} /> CSV
              </Chip>
              <Chip disabled={!exportResults.length} onClick={() => download(`deepforge-analytics-${stamp()}.json`, buildJSONExport(g, exportResults), 'application/json')}>
                <FileJson size={12} /> JSON
              </Chip>
            </div>
          </div>

          {/* ── Comparison ─────────────────────────────────────────────── */}
          {cmp ? (
            <>
              <div className="grid gap-3 lg:grid-cols-3 mb-4 min-w-0-all">
                {KINDS.map((k, i) => {
                  const r = cmp[k], m = HEURISTIC_META[k];
                  return (
                    <motion.div key={k} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: i * 0.1 }}>
                      <Panel ticks dense className="h-full overflow-hidden">
                        <header className="px-3 py-2.5 hairline-b flex items-center gap-2">
                          <span className="h-2 w-2 shrink-0" style={{ background: m.color }} />
                          <span className="tvalue text-[11px] tracking-[0.1em]" style={{ color: m.color }}>{m.name.toUpperCase()}</span>
                          {r.isOptimal && <span className="tvalue text-[8.5px] text-signal border border-signal/40 px-1 py-0.5 ml-auto">OPTIMAL</span>}
                          {r.isOptimal === false && <span className="tvalue text-[8.5px] text-danger border border-danger/40 px-1 py-0.5 ml-auto">SUBOPTIMAL</span>}
                        </header>
                        <div className="bg-black/30 border-b border-white/[0.06]">
                          <ResultMiniGraph graph={g} result={r} height={170} />
                        </div>
                        <div className="p-3 space-y-1">
                          {[
                            ['ROUTE', r.success ? r.path.map((id) => labelOf(g, id)).join(' → ') : 'NO ROUTE', r.success ? '#72E6A1' : '#FF647C'],
                            ['PATH COST  g', r.success ? String(r.pathCost) : '—', '#72E6A1'],
                            ['NODES EXPANDED', String(r.nodesExpanded), '#A78BFA'],
                            ['NODES GENERATED', String(r.nodesGenerated), '#F2DF6B'],
                            ['h(n) EVALUATIONS', String(r.heuristicEvals), '#FFB547'],
                            ['EXECUTION TIME / RUN', formatDuration(r.executionTimeMs), '#43D9E8'],
                          ].map(([a, b, c]) => (
                            <div key={a} className="flex items-baseline justify-between gap-3 py-[3px] border-b border-white/[0.05] last:border-0">
                              <span className="tlabel !text-[8.5px] shrink-0">{a}</span>
                              <span className="tvalue text-[11px] text-right break-words" style={{ color: c }}>{b}</span>
                            </div>
                          ))}
                          <p className="text-[11.5px] leading-snug text-white/45 pt-2">{m.blurb}</p>
                        </div>
                      </Panel>
                    </motion.div>
                  );
                })}
              </div>

              <div className="grid gap-3 lg:grid-cols-2 mb-4 min-w-0-all">
                <Panel title="SEARCH EFFORT BY HEURISTIC" ticks>
                  <div className="h-[260px] -ml-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={bars} margin={{ top: 6, right: 8, bottom: 2, left: -14 }}>
                        <CartesianGrid stroke="rgba(255,255,255,0.07)" vertical={false} />
                        <XAxis dataKey="name" tick={axisTick} stroke="rgba(255,255,255,0.12)" />
                        <YAxis tick={axisTick} stroke="rgba(255,255,255,0.12)" />
                        <Tooltip {...chartTooltip} />
                        <Legend wrapperStyle={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: 'rgba(231,236,242,0.5)' }} />
                        <Bar dataKey="expanded" name="expanded" fill="#A78BFA" />
                        <Bar dataKey="generated" name="generated" fill="#F2DF6B" />
                        <Bar dataKey="evals" name="h(n) evals" fill="#FFB547" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-[11.5px] leading-snug text-white/45 mt-2">
                    Fewer expansions means the heuristic pointed the search in the right direction. A better-informed heuristic
                    normally does less work — but doing less work is not the same as finding a cheaper route.
                  </p>
                </Panel>

                <Panel title="ROUTE COST vs TRUE OPTIMUM" ticks>
                  <div className="h-[260px] -ml-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={bars} margin={{ top: 6, right: 8, bottom: 2, left: -14 }}>
                        <CartesianGrid stroke="rgba(255,255,255,0.07)" vertical={false} />
                        <XAxis dataKey="name" tick={axisTick} stroke="rgba(255,255,255,0.12)" />
                        <YAxis tick={axisTick} stroke="rgba(255,255,255,0.12)" />
                        <Tooltip {...chartTooltip} />
                        <Bar dataKey="cost" name="actual path cost">
                          {bars.map((b, i) => <Cell key={i} fill={b.optimal ? '#72E6A1' : '#FF647C'} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex items-center justify-between mt-2 tvalue text-[11px]">
                    <span className="text-white/45">TRUE OPTIMAL COST (DIJKSTRA)</span>
                    <span className="text-cyan">{cmp.landmark.optimalCost ?? '—'}</span>
                  </div>
                  <p className="text-[11.5px] leading-snug text-white/45 mt-1.5">
                    Green bars match the optimal cost; red bars are more expensive than necessary. The optimum is computed
                    separately with Dijkstra's algorithm purely as a reference — Greedy Best-First Search never sees it.
                  </p>
                </Panel>
              </div>

              <div className="grid gap-3 lg:grid-cols-[1.3fr_1fr] mb-4 min-w-0-all">
                <Panel title="FRONTIER SIZE OVER TIME" ticks>
                  <div className="h-[240px] -ml-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={frontierSeries} margin={{ top: 6, right: 10, bottom: 2, left: -16 }}>
                        <CartesianGrid stroke="rgba(255,255,255,0.07)" />
                        <XAxis dataKey="step" tick={axisTick} stroke="rgba(255,255,255,0.12)" />
                        <YAxis tick={axisTick} stroke="rgba(255,255,255,0.12)" allowDecimals={false} />
                        <Tooltip {...chartTooltip} />
                        <Legend wrapperStyle={{ fontFamily: 'JetBrains Mono', fontSize: 10 }} />
                        {KINDS.map((k) => (
                          <Line key={k} type="stepAfter" dataKey={k} name={HEURISTIC_META[k].name}
                            stroke={HEURISTIC_META[k].color} strokeWidth={1.8} dot={false} connectNulls={false} />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-[11.5px] leading-snug text-white/45 mt-2">
                    A heuristic that keeps the frontier small is making confident decisions. A flat, wide frontier means the
                    search is spreading out because nothing looks obviously better than anything else.
                  </p>
                </Panel>

                <Panel title="FULL COMPARISON TABLE" ticks>
                  <div className="overflow-x-auto scroll-tech">
                    <table className="w-full text-left border-collapse min-w-[400px]">
                      <thead>
                        <tr className="hairline-b">
                          <th className="tlabel !text-[8.5px] py-2 pr-3 font-normal">METRIC</th>
                          {KINDS.map((k) => (
                            <th key={k} className="tlabel !text-[8.5px] py-2 pr-3 font-normal" style={{ color: HEURISTIC_META[k].color }}>
                              {HEURISTIC_META[k].short.toUpperCase()}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {([
                          ['Route found', (r: typeof cmp.zero) => (r.success ? 'yes' : 'no')],
                          ['Path cost g', (r: typeof cmp.zero) => (r.success ? r.pathCost : '—')],
                          ['Edges in route', (r: typeof cmp.zero) => (r.success ? r.pathEdgeCount : '—')],
                          ['Optimal', (r: typeof cmp.zero) => (r.isOptimal === null ? '—' : r.isOptimal ? 'yes' : 'no')],
                          ['Nodes visited', (r: typeof cmp.zero) => r.nodesVisited],
                          ['Nodes expanded', (r: typeof cmp.zero) => r.nodesExpanded],
                          ['Nodes explored', (r: typeof cmp.zero) => r.nodesExplored],
                          ['Nodes generated', (r: typeof cmp.zero) => r.nodesGenerated],
                          ['h(n) evaluations', (r: typeof cmp.zero) => r.heuristicEvals],
                          ['Algorithm steps', (r: typeof cmp.zero) => r.steps.length],
                          ['Time per run', (r: typeof cmp.zero) => formatDuration(r.executionTimeMs)],
                          ['Timing runs sampled', (r: typeof cmp.zero) => r.timingRuns],
                        ] as const).map(([label, pick]) => (
                          <tr key={label} className="border-b border-white/[0.05]">
                            <td className="tlabel !text-[9px] py-2 pr-3 normal-case">{label}</td>
                            {KINDS.map((k) => (
                              <td key={k} className="tvalue text-[11px] py-2 pr-3">{String(pick(cmp[k]))}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Panel>
              </div>

              <Callout tone="warn" title="READING THESE NUMBERS HONESTLY">
                A zero heuristic in Greedy Best-First Search is <em>not</em> Dijkstra's algorithm: with h = 0 every frontier node
                scores the same and the order falls to deterministic tie-breaking, so it behaves like an uninformed search rather
                than a cost-optimal one. Straight-line distance is only a valid lower bound when travel cost is proportional to
                geometric distance — add a congestion penalty to any edge and it can start overestimating. And a heuristic that
                expands fewer nodes has not necessarily found a better route; compare the cost column, not just the effort column.
              </Callout>
            </>
          ) : (
            <Panel title="NO COMPARISON RUN YET" ticks>
              <p className="text-[13px] leading-relaxed text-white/55 max-w-2xl">
                Press <span className="tvalue text-amber">RUN ALL THREE HEURISTICS</span> above. Each one is executed on this exact
                graph with the same start and destination, and timed the same way — the median of seven untraced runs — so the
                comparison is fair.
              </p>
            </Panel>
          )}

          {/* ── Single-run report ─────────────────────────────────────── */}
          {single && (
            <div className="mt-8">
              <div className="flex items-center gap-3 mb-4">
                <span className="tlabel">SEARCH REPORT — {HEURISTIC_META[single.heuristicKind].name.toUpperCase()}</span>
                <span className="h-px flex-1 bg-gradient-to-r from-white/15 to-transparent" />
              </div>
              <div className="grid gap-3 grid-cols-2 lg:grid-cols-5 mb-3">
                <Metric label="NODES IN GRAPH" value={single.totalNodes} accent="#43D9E8" />
                <Metric label="EDGES IN GRAPH" value={single.totalEdges} accent="#43D9E8" />
                <Metric label="NODES EXPANDED" value={single.nodesExpanded} accent="#A78BFA" />
                <Metric label="PATH COST  g" value={single.success ? single.pathCost : '—'} accent="#72E6A1" />
                <Metric label="TIME PER RUN" value={formatDuration(single.executionTimeMs)} accent="#FFB547" />
              </div>
              <Panel title="EVERY MEASURED VALUE" ticks>
                <div className="grid sm:grid-cols-2 gap-x-6">
                  {metricRows(g, single).map((row) => (
                    <div key={row.label} className="flex items-baseline justify-between gap-3 py-[5px] border-b border-white/[0.05]" title={row.hint}>
                      <span className="tlabel shrink-0">{row.label}</span>
                      <span className="tvalue text-[11.5px] text-right break-words" style={{ color: row.accent ?? '#dde4ec' }}>{row.value}</span>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
          )}
        </>
      )}
    </div>
  );
}
