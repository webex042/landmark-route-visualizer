import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Diamond, Plus, X, Play, Lightbulb } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import GraphCanvas from '../components/GraphCanvas';
import LandmarkMath from '../components/LandmarkMath';
import { Panel, SectionHead, Formula, Callout, Chip, Metric } from '../components/ui';
import { useApp } from '../state/store';
import { labelOf, validateGraph } from '../lib/graph';
import { LandmarkTable, optimalPath } from '../lib/dijkstra';
import { landmarkBreakdown, euclideanEstimate, round2 } from '../lib/heuristics';
import { search } from '../lib/searchEngine';
import { getNode } from '../lib/graph';

/* ===========================================================================
 * LANDMARK HEURISTIC LABORATORY
 * Compare landmark configurations on the same graph, and inspect the exact
 * derivation of h(v,t) for any node.
 * ========================================================================= */

export default function LandmarkLab() {
  const s = useApp();
  const g = s.graph;
  const [configs, setConfigs] = useState<{ name: string; ids: string[] }[]>([]);

  const inspectId = s.inspectNodeId ?? s.selectedNodeId ?? g.startId;

  /* Quality of the current landmark set, measured against true distances. */
  const quality = useMemo(() => {
    if (!g.goalId || !g.nodes.length) return null;
    const table = new LandmarkTable(g, g.landmarkIds);
    const rows = g.nodes
      .filter((n) => n.id !== g.goalId)
      .map((n) => {
        const h = landmarkBreakdown(table, n.id, g.goalId!).value;
        const t = getNode(g, g.goalId!);
        const eu = t ? euclideanEstimate(n, t) : 0;
        const truth = optimalPath(g, n.id, g.goalId!)?.cost ?? null;
        return { label: n.label, landmark: h, euclidean: eu, truth };
      })
      .filter((r) => r.truth !== null) as { label: string; landmark: number; euclidean: number; truth: number }[];

    const avgGap = rows.length ? round2(rows.reduce((a, r) => a + (r.truth - r.landmark), 0) / rows.length) : 0;
    const avgGapEu = rows.length ? round2(rows.reduce((a, r) => a + (r.truth - r.euclidean), 0) / rows.length) : 0;
    const sharpness = rows.length ? round2((rows.reduce((a, r) => a + (r.truth ? r.landmark / r.truth : 1), 0) / rows.length) * 100) : 0;
    const euOver = rows.filter((r) => r.euclidean > r.truth + 1e-9).length;
    return { rows, avgGap, avgGapEu, sharpness, euOver };
  }, [g]);

  const run = useMemo(() => (validateGraph(g).ok ? search(g, 'landmark') : null), [g]);

  const saveConfig = () => {
    if (!g.landmarkIds.length) return s.notify('error', 'Select at least one landmark before saving a configuration.');
    const name = g.landmarkIds.map((id) => labelOf(g, id)).join(' + ');
    if (configs.some((c) => c.name === name)) return s.notify('info', 'That configuration is already saved.');
    setConfigs((c) => [...c, { name, ids: [...g.landmarkIds] }].slice(-6));
    s.notify('ok', `Saved configuration: ${name}`);
  };

  const comparison = useMemo(() => configs.map((c) => {
    const graph = { ...g, landmarkIds: c.ids };
    const r = search(graph, 'landmark');
    const table = new LandmarkTable(graph, c.ids);
    const gaps = graph.nodes
      .filter((n) => n.id !== graph.goalId)
      .map((n) => {
        const truth = optimalPath(graph, n.id, graph.goalId!)?.cost;
        if (truth === undefined) return null;
        return truth - landmarkBreakdown(table, n.id, graph.goalId!).value;
      })
      .filter((x): x is number => x !== null);
    return {
      name: c.name,
      count: c.ids.length,
      expanded: r.nodesExpanded,
      cost: r.success ? r.pathCost : null,
      optimal: r.isOptimal,
      avgGap: gaps.length ? round2(gaps.reduce((a, b) => a + b, 0) / gaps.length) : 0,
    };
  }), [configs, g]);

  return (
    <div className="mx-auto max-w-[1600px] px-4 sm:px-6 py-10 md:py-14">
      <SectionHead index="04" kicker="LANDMARK HEURISTIC LABORATORY" title="Where the estimate comes from"
        lead="A landmark is a reference node whose exact distance to everywhere else is computed in advance with Dijkstra's algorithm. Those distances bound the distance between any two nodes — without ever measuring it directly." />

      {/* ── The mathematics ────────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr] mb-10 min-w-0-all">
        <div>
          <Formula note="One landmark L. Valid because the graph is undirected, so d(a,b) = d(b,a).">
            h<sub className="text-[11px]">L</sub>(v,t) = | d(L,t) − d(L,v) |
          </Formula>
          <Formula note="Several landmarks. The maximum of valid lower bounds is still a lower bound — and the tightest one.">
            h(v,t) = max<sub className="text-[11px]">L</sub> | d(L,t) − d(L,v) |
          </Formula>
          <div className="grid gap-1.5 mt-4">
            {[
              ['v', 'the node being evaluated', '#43D9E8'],
              ['t', 'the destination', '#72E6A1'],
              ['L', 'a landmark node', '#A78BFA'],
              ['d(a,b)', 'exact shortest-path distance between a and b', '#FFB547'],
            ].map(([k, v, c]) => (
              <div key={k} className="flex items-start gap-3 px-3 py-1.5 panel">
                <span className="tvalue text-[12px] w-[58px] shrink-0" style={{ color: c }}>{k}</span>
                <span className="text-[12.5px] text-white/60">{v}</span>
              </div>
            ))}
          </div>
          <Callout tone="warn" title="TWO THINGS THIS DOES AND DOES NOT GUARANTEE">
            The landmark estimate never exceeds the true remaining distance, so it is an admissible lower bound under these
            undirected, non-negative-weight assumptions. That makes it a <em>good</em> heuristic — but it does not make Greedy
            Best-First Search optimal, because ranking by h alone still ignores the cost already paid. Only f(n) = g(n) + h(n)
            would give an optimality guarantee.
          </Callout>
          <Callout tone="info" title="UNREACHABLE PAIRS">
            If a landmark cannot reach v or cannot reach t, the difference is undefined. Such a landmark is skipped entirely
            rather than contributing an infinite value — you can see this happen by adding an isolated node and making it a
            landmark.
          </Callout>
        </div>

        <div>
          <Panel title="GRAPH — CLICK ANY NODE TO DERIVE ITS HEURISTIC" ticks dense className="overflow-hidden mb-3">
            <div className="h-[clamp(280px,40vh,420px)]"><GraphCanvas showSearchState={false} /></div>
          </Panel>
          <div className="flex flex-wrap gap-1.5">
            <Chip active={s.mode === 'inspect'} onClick={() => s.setMode('inspect')}>SELECT TOOL</Chip>
            {s.selectedNodeId && (
              <Chip active={g.landmarkIds.includes(s.selectedNodeId)} onClick={() => s.flipLandmark(s.selectedNodeId!)}>
                <Diamond size={12} /> TOGGLE LANDMARK ON {labelOf(g, s.selectedNodeId)}
              </Chip>
            )}
            <Chip onClick={saveConfig}><Plus size={12} /> SAVE THIS CONFIGURATION</Chip>
          </div>
        </div>
      </div>

      {/* ── Current landmark set + derivation ─────────────────────────── */}
      <div className="grid gap-3 lg:grid-cols-[320px_1fr_1fr] mb-10 min-w-0-all">
        <Panel title="LANDMARK SET" ticks>
          {g.landmarkIds.length === 0 ? (
            <p className="text-[12.5px] leading-relaxed text-amber/80">
              No landmarks selected. The landmark heuristic currently returns h = 0 for every node, which turns the search into an
              uninformed one. Click a node on the graph and press TOGGLE LANDMARK.
            </p>
          ) : (
            <div className="space-y-1.5">
              {g.landmarkIds.map((id) => (
                <div key={id} className="flex items-center gap-2 px-2.5 py-2 border border-violet/30 bg-violet/[0.06]">
                  <Diamond size={12} className="text-violet shrink-0" />
                  <span className="tvalue text-[11.5px] text-violet flex-1 truncate">{labelOf(g, id)}</span>
                  <button className="text-white/35 hover:text-danger" onClick={() => s.flipLandmark(id)}
                    aria-label={`Remove landmark ${labelOf(g, id)}`}><X size={13} /></button>
                </div>
              ))}
            </div>
          )}

          <div className="mt-3 pt-3 hairline-t">
            <div className="tlabel !text-[9px] mb-2">ADD A LANDMARK</div>
            <select value="" onChange={(e) => { if (e.target.value) s.flipLandmark(e.target.value); }} aria-label="Add landmark">
              <option value="">Select a node…</option>
              {g.nodes.filter((n) => !g.landmarkIds.includes(n.id)).map((n) => (
                <option key={n.id} value={n.id}>{n.label}</option>
              ))}
            </select>
          </div>

          {quality && (
            <div className="mt-3 pt-3 hairline-t space-y-1.5">
              <div className="tlabel !text-[9px] mb-1">SET QUALITY</div>
              <div className="flex justify-between tvalue text-[11px]"><span className="text-white/45">Avg gap — landmark</span><span className="text-amber">{quality.avgGap}</span></div>
              <div className="flex justify-between tvalue text-[11px]"><span className="text-white/45">Avg gap — straight line</span><span className="text-cyan">{quality.avgGapEu}</span></div>
              <div className="flex justify-between tvalue text-[11px]"><span className="text-white/45">Sharpness</span><span className="text-signal">{quality.sharpness}%</span></div>
              <p className="text-[11px] leading-snug text-white/40 mt-2">
                Gap is the average amount by which the estimate falls short of the true remaining cost — smaller is better
                informed. Sharpness is the estimate as a percentage of the truth; 100% would be a perfect heuristic.
              </p>
              {quality.euOver > 0 && (
                <p className="text-[11px] leading-snug text-danger/80 mt-1.5">
                  Straight-line distance overestimates the true cost at {quality.euOver} node(s) on this graph, so it is not a
                  valid lower bound here. The landmark bound never does.
                </p>
              )}
            </div>
          )}
        </Panel>

        <Panel title={`DERIVATION — ${inspectId ? labelOf(g, inspectId) : 'NO NODE SELECTED'}`} ticks>
          <LandmarkMath nodeId={inspectId ?? null} />
        </Panel>

        <Panel title="ESTIMATE vs TRUTH, EVERY NODE" ticks>
          {quality && quality.rows.length > 0 ? (
            <>
              <div className="h-[260px] -ml-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={quality.rows} margin={{ top: 4, right: 6, bottom: 2, left: -14 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.07)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: 'rgba(231,236,242,0.45)', fontSize: 9, fontFamily: 'JetBrains Mono' }}
                      interval={0} angle={-38} textAnchor="end" height={54} stroke="rgba(255,255,255,0.12)" />
                    <YAxis tick={{ fill: 'rgba(231,236,242,0.45)', fontSize: 9, fontFamily: 'JetBrains Mono' }} stroke="rgba(255,255,255,0.12)" />
                    <Tooltip contentStyle={{ background: 'rgba(9,11,15,0.95)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 2, fontFamily: 'JetBrains Mono', fontSize: 11 }} />
                    <Bar dataKey="truth" name="true remaining" fill="#72E6A1" fillOpacity={0.3} />
                    <Bar dataKey="landmark" name="landmark h" fill="#FFB547" />
                    <Bar dataKey="euclidean" name="straight line h" fill="#43D9E8" fillOpacity={0.75} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-[11.5px] leading-snug text-white/45 mt-2">
                Amber and cyan bars should never rise above the pale green one — that is the admissibility condition. The closer a
                bar sits to the green, the better informed that estimate is.
              </p>
            </>
          ) : (
            <p className="text-[12px] text-white/40">Assign a destination node to compare estimates against true distances.</p>
          )}
        </Panel>
      </div>

      {/* ── Configuration comparison ──────────────────────────────────── */}
      <Panel title="COMPARE LANDMARK CONFIGURATIONS" ticks>
        {configs.length === 0 ? (
          <div className="flex items-start gap-3">
            <Lightbulb size={16} className="text-amber mt-0.5 shrink-0" />
            <p className="text-[12.5px] leading-relaxed text-white/55 max-w-2xl">
              Choose a set of landmarks on the graph above, press <span className="tvalue text-amber">SAVE THIS CONFIGURATION</span>,
              then change the landmarks and save again. Each saved set is re-run on the same graph, start and destination, so the
              numbers are directly comparable. Try one landmark near the start, one near the destination, and one far off to the
              side — the differences are rarely what people expect.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto scroll-tech">
              <table className="w-full text-left border-collapse min-w-[560px]">
                <thead>
                  <tr className="hairline-b">
                    {['CONFIGURATION', 'LANDMARKS', 'NODES EXPANDED', 'ROUTE COST', 'OPTIMAL?', 'AVG GAP'].map((h) => (
                      <th key={h} className="tlabel !text-[8.5px] py-2 pr-3 font-normal">{h}</th>
                    ))}
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {comparison.map((c, i) => (
                    <tr key={c.name} className="border-b border-white/[0.05]">
                      <td className="tvalue text-[11.5px] py-2.5 pr-3 text-violet">{c.name}</td>
                      <td className="tvalue text-[11.5px] py-2.5 pr-3">{c.count}</td>
                      <td className="tvalue text-[11.5px] py-2.5 pr-3">{c.expanded}</td>
                      <td className="tvalue text-[11.5px] py-2.5 pr-3 text-signal">{c.cost ?? '—'}</td>
                      <td className="tvalue text-[11.5px] py-2.5 pr-3" style={{ color: c.optimal ? '#72E6A1' : '#FF647C' }}>
                        {c.optimal === null ? '—' : c.optimal ? 'YES' : 'NO'}
                      </td>
                      <td className="tvalue text-[11.5px] py-2.5 pr-3 text-amber">{c.avgGap}</td>
                      <td className="py-2.5">
                        <button className="btn !px-2 !py-1" onClick={() => setConfigs((cs) => cs.filter((_, j) => j !== i))} aria-label="Remove configuration">
                          <X size={11} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="h-[220px] -ml-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparison} margin={{ top: 4, right: 8, bottom: 2, left: -16 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.07)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: 'rgba(231,236,242,0.45)', fontSize: 9, fontFamily: 'JetBrains Mono' }} stroke="rgba(255,255,255,0.12)" />
                  <YAxis tick={{ fill: 'rgba(231,236,242,0.45)', fontSize: 9, fontFamily: 'JetBrains Mono' }} stroke="rgba(255,255,255,0.12)" />
                  <Tooltip contentStyle={{ background: 'rgba(9,11,15,0.95)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 2, fontFamily: 'JetBrains Mono', fontSize: 11 }} />
                  <Bar dataKey="expanded" name="nodes expanded">
                    {comparison.map((c, i) => <Cell key={i} fill={c.optimal ? '#72E6A1' : '#FFB547'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <button className="btn btn-danger" onClick={() => setConfigs([])}>CLEAR ALL CONFIGURATIONS</button>
          </div>
        )}
      </Panel>

      {run && (
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mt-3">
          <Metric label="LANDMARKS IN USE" value={g.landmarkIds.length} accent="#A78BFA" />
          <Metric label="NODES EXPANDED" value={run.nodesExpanded} accent="#FFB547" />
          <Metric label="ROUTE COST" value={run.success ? run.pathCost : '—'} accent="#72E6A1"
            sub={run.optimalCost !== null ? `optimal is ${run.optimalCost}` : undefined} />
          <Metric label="h(n) EVALUATIONS" value={run.heuristicEvals} accent="#43D9E8" />
        </div>
      )}
    </div>
  );
}
