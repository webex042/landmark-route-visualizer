import { useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileJson, FileSpreadsheet, Scale } from 'lucide-react';
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
import { search, formatDuration, ALGORITHM_META, Algorithm } from '../lib/searchEngine';

const KINDS: HeuristicKind[] = ['zero', 'euclidean', 'landmark'];

const chartCursor = { fill: 'rgba(255,255,255,0.05)' };
const chartTooltip = {
  contentStyle: { background: 'rgba(14,14,17,0.97)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 10, fontFamily: 'Inter, sans-serif', fontSize: 13, padding: '10px 12px' },
  labelStyle: { color: 'rgba(231,236,242,0.6)' },
};
const axisTick = { fill: 'rgba(231,236,242,0.45)', fontSize: 9, fontFamily: 'JetBrains Mono' };

export default function Analytics() {
  const s = useApp();
  const g = s.graph;
  const valid = validateGraph(g);
  const cmp = s.comparison;
  const algo = s.algoComparison;

  /* Single-run report for the heuristic currently selected in the workspace. */
  const single = useMemo(() => (valid.ok ? (s.result ?? search(g, s.heuristic)) : null), [g, s.heuristic, s.result, valid.ok]);

  useEffect(() => {
    if (!s.comparison && valid.ok) {
      s.runComparison();
    }
  }, [s.comparison, valid.ok]);

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
      <SectionHead index="05" kicker="Compare and measure" title="Breadth-First against the landmark guess"
        lead="The same map, the same start, the same destination. First, Breadth-First Search against Best-First Search with the landmark guess. Then, inside Best-First, three different ways of guessing. Every number is measured from a real run." />

      {!valid.ok ? (
        <Panel title="Not ready to search yet" ticks>
          <ul className="space-y-1.5">
            {valid.errors.map((e) => <li key={e} className="text-[13.5px] text-danger/90">■ {e}</li>)}
          </ul>
          <p className="text-[13.5px] text-ink3 mt-3">Fix these in the Visualizer and come back.</p>
        </Panel>
      ) : (
        <>
          {/* ── Run controls ───────────────────────────────────────────── */}
          <div className="panel-glass px-3 py-3 mb-4 flex flex-wrap items-center gap-2">
            <button className="btn btn-primary" onClick={s.runComparison}>
              <Scale size={14} /> {cmp ? 'Run them again' : 'Run all three'}
            </button>
            <span className="tvalue text-[13px] text-ink3">
              {g.nodes.length} places, {g.edges.length} roads · {labelOf(g, g.startId)} → {labelOf(g, g.goalId)} · {g.landmarkIds.length || 'no'} landmark{g.landmarkIds.length === 1 ? '' : 's'}
            </span>
            <div className="ml-auto flex gap-1.5">
              <Chip disabled={!exportResults.length} onClick={() => download(`deepforge-analytics-${stamp()}.csv`, buildCSVExport(g, exportResults), 'text/csv')}>
                <FileSpreadsheet size={13} /> CSV
              </Chip>
              <Chip disabled={!exportResults.length} onClick={() => download(`deepforge-analytics-${stamp()}.json`, buildJSONExport(g, exportResults), 'application/json')}>
                <FileJson size={13} /> JSON
              </Chip>
            </div>
          </div>

          {/* ── Comparison ─────────────────────────────────────────────── */}
          {algo && (
            <div className="mb-16">
              <div className="grid gap-3 lg:grid-cols-2 mb-4 min-w-0-all">
                {(['bfs', 'gbfs'] as Algorithm[]).map((a, i) => {
                  const r = algo[a], m = ALGORITHM_META[a];
                  return (
                    <motion.div key={a} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: i * 0.1 }}>
                      <Panel dense className="h-full overflow-hidden">
                        <header className="px-5 py-4 hairline-b flex items-center gap-2.5">
                          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: m.color }} />
                          <span className="text-[16px] font-medium text-white">{m.name}</span>
                          <span className="ml-auto text-[13px] text-ink4">{m.usesHeuristic ? 'follows the landmark guess' : 'follows the queue'}</span>
                        </header>
                        <div className="bg-black/40 border-b border-white/[0.06]">
                          <ResultMiniGraph graph={g} result={r} height={230} />
                        </div>
                        <div className="p-5">
                          <div className="stat-label">Route</div>
                          <div className="tvalue text-[14.5px] text-signal mt-1 break-words">
                            {r.success ? r.path.map((id) => labelOf(g, id)).join(' → ') : 'No route'}
                          </div>
                          <div className="grid grid-cols-3 gap-4 mt-5">
                            <div><div className="stat-label">Roads used</div><div className="stat-value tvalue mt-1">{r.success ? r.pathEdgeCount : '—'}</div></div>
                            <div><div className="stat-label">Route length</div><div className="stat-value tvalue mt-1">{r.success ? r.pathCost : '—'}</div></div>
                            <div><div className="stat-label">Places checked</div><div className="stat-value tvalue mt-1">{r.nodesExpanded}</div></div>
                          </div>
                          <div className="flex flex-wrap gap-2 mt-5">
                            {r.usesFewestEdges && <span className="text-[12.5px] px-2.5 py-1 rounded-full bg-cyan/[0.12] text-[#9FEFF8]">fewest roads possible</span>}
                            {r.isOptimal && <span className="text-[12.5px] px-2.5 py-1 rounded-full bg-signal/[0.12] text-signal">shortest distance possible</span>}
                            {r.isOptimal === false && <span className="text-[12.5px] px-2.5 py-1 rounded-full bg-white/[0.06] text-ink3">not the shortest distance</span>}
                          </div>
                        </div>
                      </Panel>
                    </motion.div>
                  );
                })}
              </div>
              <Callout tone="info" title="What this comparison shows">
                {algo.bfs.nodesExpanded > algo.gbfs.nodesExpanded
                  ? `Breadth-First Search checked ${algo.bfs.nodesExpanded} places; the landmark guess got there after checking only ${algo.gbfs.nodesExpanded}. That is what a good guess buys you: it stops the search spreading out in directions that lead nowhere. `
                  : `Here both searches did a similar amount of work (${algo.bfs.nodesExpanded} and ${algo.gbfs.nodesExpanded} places checked). `}
                {algo.bfs.isOptimal === false && algo.gbfs.isOptimal
                  ? `And the guess found the shorter route too — ${algo.gbfs.pathCost} against ${algo.bfs.pathCost}, because Breadth-First Search never looks at road lengths.`
                  : algo.bfs.isOptimal && algo.gbfs.isOptimal === false
                    ? `But Breadth-First found the shorter route this time — the guess led Best-First down a longer one.`
                    : `Try moving the start, the destination or the landmarks in the Visualizer and come back — the balance changes.`}
              </Callout>
              <div className="mt-16 mb-6">
                <div className="text-[14px] text-ink3 mb-3">Inside Best-First Search</div>
                <h3 className="font-display text-[clamp(24px,3.4vw,34px)] leading-tight tracking-[-0.03em]">Which guess works best?</h3>
              </div>
            </div>
          )}

          {cmp ? (
            <>
              <div className="grid gap-3 lg:grid-cols-3 mb-4 min-w-0-all">
                {KINDS.map((k, i) => {
                  const r = cmp[k], m = HEURISTIC_META[k];
                  return (
                    <motion.div key={k} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: i * 0.1 }}>
                      <Panel ticks dense className="h-full overflow-hidden">
                        <header className="px-3 py-2.5 hairline-b flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: m.color }} />
                          <span className="text-[15px] font-medium text-white">{m.plain}</span>
                          {r.isOptimal && <span className="text-[12.5px] px-2.5 py-1 rounded-full bg-signal/[0.12] text-signal ml-auto">shortest possible</span>}
                          {r.isOptimal === false && <span className="text-[12.5px] px-2.5 py-1 rounded-full bg-white/[0.06] text-ink3 ml-auto">longer than needed</span>}
                        </header>
                        <div className="bg-black/30 border-b border-white/[0.06]">
                          <ResultMiniGraph graph={g} result={r} height={210} />
                        </div>
                        <div className="p-3 space-y-1">
                          {[
                            ['Route', r.success ? r.path.map((id) => labelOf(g, id)).join(' → ') : 'No route', r.success ? '#72E6A1' : '#FF647C'],
                            ['Route length', r.success ? String(r.pathCost) : '—', '#72E6A1'],
                            ['Places checked', String(r.nodesExpanded), '#A78BFA'],
                            ['Places found', String(r.nodesGenerated), '#F2DF6B'],
                            ['Guesses made', String(r.heuristicEvals), '#FFB547'],
                            ['Time per run', formatDuration(r.executionTimeMs), '#43D9E8'],
                          ].map(([a, b, c]) => (
                            <div key={a} className="flex items-baseline justify-between gap-3 py-[3px] border-b border-white/[0.05] last:border-0">
                              <span className="tlabel !text-[12.5px] shrink-0">{a}</span>
                              <span className="tvalue text-[13.5px] text-right break-words" style={{ color: c }}>{b}</span>
                            </div>
                          ))}
                          <p className="text-[13.5px] leading-snug text-ink3 pt-2">{m.blurb}</p>
                        </div>
                      </Panel>
                    </motion.div>
                  );
                })}
              </div>

              <div className="grid gap-3 lg:grid-cols-2 mb-4 min-w-0-all">
                <Panel title="How much work each guess needed" ticks>
                  <div className="h-[260px] -ml-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={bars} margin={{ top: 6, right: 8, bottom: 2, left: -14 }}>
                        <CartesianGrid stroke="rgba(255,255,255,0.07)" vertical={false} />
                        <XAxis dataKey="name" tick={axisTick} stroke="rgba(255,255,255,0.12)" />
                        <YAxis tick={axisTick} stroke="rgba(255,255,255,0.12)" />
                        <Tooltip {...chartTooltip} cursor={chartCursor} />
                        <Legend wrapperStyle={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: 'rgba(231,236,242,0.5)' }} />
                        <Bar dataKey="expanded" name="places checked" fill="#A78BFA" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="generated" name="places found" fill="#F2DF6B" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="evals" name="guesses made" fill="#FFB547" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-[13.5px] leading-snug text-ink3 mt-2">
                    Fewer expansions means the heuristic pointed the search in the right direction. A better-informed heuristic
                    normally does less work — but doing less work is not the same as finding a cheaper route.
                  </p>
                </Panel>

                <Panel title="Route length against the best possible" ticks>
                  <div className="h-[260px] -ml-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={bars} margin={{ top: 6, right: 8, bottom: 2, left: -14 }}>
                        <CartesianGrid stroke="rgba(255,255,255,0.07)" vertical={false} />
                        <XAxis dataKey="name" tick={axisTick} stroke="rgba(255,255,255,0.12)" />
                        <YAxis tick={axisTick} stroke="rgba(255,255,255,0.12)" />
                        <Tooltip {...chartTooltip} cursor={chartCursor} />
                        <Bar dataKey="cost" name="route length" radius={[3, 3, 0, 0]}>
                          {bars.map((b, i) => <Cell key={i} fill={b.optimal ? '#72E6A1' : '#FF647C'} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex items-center justify-between mt-2 tvalue text-[13.5px]">
                    <span className="text-ink3">Shortest route that exists</span>
                    <span className="text-cyan">{cmp.landmark.optimalCost ?? '—'}</span>
                  </div>
                  <p className="text-[13.5px] leading-snug text-ink3 mt-1.5">
                    Green bars match the optimal cost; red bars are more expensive than necessary. The optimum is computed
                    separately with Dijkstra's algorithm purely as a reference — Greedy Best-First Search never sees it.
                  </p>
                </Panel>
              </div>

              <div className="grid gap-3 lg:grid-cols-[1.3fr_1fr] mb-4 min-w-0-all">
                <Panel title="How long the waiting list got" ticks>
                  <div className="h-[240px] -ml-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={frontierSeries} margin={{ top: 6, right: 10, bottom: 2, left: -16 }}>
                        <CartesianGrid stroke="rgba(255,255,255,0.07)" />
                        <XAxis dataKey="step" tick={axisTick} stroke="rgba(255,255,255,0.12)" />
                        <YAxis tick={axisTick} stroke="rgba(255,255,255,0.12)" allowDecimals={false} />
                        <Tooltip {...chartTooltip} cursor={chartCursor} />
                        <Legend wrapperStyle={{ fontFamily: 'JetBrains Mono', fontSize: 10 }} />
                        {KINDS.map((k) => (
                          <Line key={k} type="stepAfter" dataKey={k} name={HEURISTIC_META[k].name}
                            stroke={HEURISTIC_META[k].color} strokeWidth={1.8} dot={false} connectNulls={false} />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-[13.5px] leading-snug text-ink3 mt-2">
                    A heuristic that keeps the frontier small is making confident decisions. A flat, wide frontier means the
                    search is spreading out because nothing looks obviously better than anything else.
                  </p>
                </Panel>

                <Panel title="Side by side" ticks>
                  <div className="overflow-x-auto scroll-tech">
                    <table className="w-full text-left border-collapse min-w-[400px]">
                      <thead>
                        <tr className="hairline-b">
                          <th className="tlabel !text-[12.5px] py-2 pr-3 font-normal">METRIC</th>
                          {KINDS.map((k) => (
                            <th key={k} className="tlabel !text-[12.5px] py-2 pr-3 font-normal" style={{ color: HEURISTIC_META[k].color }}>
                              {HEURISTIC_META[k].plain}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {([
                          ['Found a route', (r: typeof cmp.zero) => (r.success ? 'yes' : 'no')],
                          ['Route length', (r: typeof cmp.zero) => (r.success ? r.pathCost : '—')],
                          ['Roads used', (r: typeof cmp.zero) => (r.success ? r.pathEdgeCount : '—')],
                          ['Shortest possible', (r: typeof cmp.zero) => (r.isOptimal === null ? '—' : r.isOptimal ? 'yes' : 'no')],
                          ['Places taken off the list', (r: typeof cmp.zero) => r.nodesVisited],
                          ['Places checked', (r: typeof cmp.zero) => r.nodesExpanded],
                          ['Places finished with', (r: typeof cmp.zero) => r.nodesExplored],
                          ['Places found', (r: typeof cmp.zero) => r.nodesGenerated],
                          ['Guesses made', (r: typeof cmp.zero) => r.heuristicEvals],
                          ['Steps taken', (r: typeof cmp.zero) => r.steps.length],
                          ['Time per run', (r: typeof cmp.zero) => formatDuration(r.executionTimeMs)],
                          ['Timing runs sampled', (r: typeof cmp.zero) => r.timingRuns],
                        ] as const).map(([label, pick]) => (
                          <tr key={label} className="border-b border-white/[0.05]">
                            <td className="tlabel !text-[12.5px] py-2 pr-3 normal-case">{label}</td>
                            {KINDS.map((k) => (
                              <td key={k} className="tvalue text-[13.5px] py-2 pr-3">{String(pick(cmp[k]))}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Panel>
              </div>

              <Callout tone="warn" title="Read these numbers honestly">
                A zero heuristic in Greedy Best-First Search is <em>not</em> Dijkstra's algorithm: with h = 0 every frontier node
                scores the same and the order falls to deterministic tie-breaking, so it behaves like an uninformed search rather
                than a cost-optimal one. Straight-line distance is only a valid lower bound when travel cost is proportional to
                geometric distance — add a congestion penalty to any edge and it can start overestimating. And a heuristic that
                expands fewer nodes has not necessarily found a better route; compare the cost column, not just the effort column.
              </Callout>
            </>
          ) : (
            <Panel title="Nothing compared yet" ticks>
              <p className="text-[13px] leading-relaxed text-ink3 max-w-2xl">
                Press <span className="text-white font-medium">Run all three</span> above. Each one is executed on this exact
                graph with the same start and destination, and timed the same way — the median of seven untraced runs — so the
                comparison is fair.
              </p>
            </Panel>
          )}

          {/* ── Single-run report ─────────────────────────────────────── */}
          {single && (
            <div className="mt-8">
              <div className="flex items-center gap-3 mb-4">
                <span className="tlabel">Full report — {HEURISTIC_META[single.heuristicKind].plain.toLowerCase()}</span>
                <span className="h-px flex-1 bg-gradient-to-r from-white/15 to-transparent" />
              </div>
              <div className="grid gap-3 grid-cols-2 lg:grid-cols-5 mb-3">
                <Metric label="Places on the map" value={single.totalNodes} accent="#43D9E8" />
                <Metric label="Roads on the map" value={single.totalEdges} accent="#43D9E8" />
                <Metric label="Places checked" value={single.nodesExpanded} accent="#A78BFA" />
                <Metric label="Route length" value={single.success ? single.pathCost : '—'} accent="#72E6A1" />
                <Metric label="Time per run" value={formatDuration(single.executionTimeMs)} accent="#FFB547" />
              </div>
              <Panel title="Every measured value" ticks>
                <div className="grid sm:grid-cols-2 gap-x-6">
                  {metricRows(g, single).map((row) => (
                    <div key={row.label} className="flex items-baseline justify-between gap-3 py-[5px] border-b border-white/[0.05]" title={row.hint}>
                      <span className="tlabel shrink-0">{row.label}</span>
                      <span className="tvalue text-[13.5px] text-right break-words" style={{ color: row.accent ?? '#dde4ec' }}>{row.value}</span>
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
