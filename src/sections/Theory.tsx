import { useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, SkipBack, SkipForward, RotateCcw, ArrowRight } from 'lucide-react';
import { Graph, GraphNode, GraphEdge, uid, labelOf } from '../lib/graph';
import { search } from '../lib/searchEngine';
import { HeuristicKind } from '../lib/heuristics';
import { SectionHead, Panel, Formula, Callout, Chip, Swatch } from '../components/ui';
import { NODE_COLORS, NodeVisual } from '../state/store';
import { SectionId } from '../components/Shell';

/* ===========================================================================
 * EMBEDDED MINI TRACE
 * A small self-contained demonstration. It runs the SAME engine as the main
 * workspace — the numbers and the decisions below are not scripted.
 * ========================================================================= */

function miniGraph(): Graph {
  const defs: [string, number, number][] = [
    ['S', 70, 150], ['A', 220, 72], ['D', 215, 245], ['B', 390, 60],
    ['E', 400, 250], ['C', 560, 115], ['G', 720, 160],
  ];
  const nodes: GraphNode[] = defs.map(([label, x, y]) => ({ id: `m_${label}`, label, x, y }));
  const by = new Map(nodes.map((n) => [n.label, n]));
  const es: [string, string, number][] = [
    ['S', 'A', 3], ['S', 'D', 4], ['A', 'B', 4], ['B', 'C', 4],
    ['C', 'G', 3], ['D', 'E', 5], ['E', 'G', 9],
  ];
  const edges: GraphEdge[] = es.map(([a, b, w]) => ({ id: uid('me'), a: by.get(a)!.id, b: by.get(b)!.id, weight: w }));
  return { nodes, edges, startId: by.get('S')!.id, goalId: by.get('G')!.id, landmarkIds: [by.get('D')!.id] };
}

function MiniTrace({ kind = 'euclidean' }: { kind?: HeuristicKind }) {
  const graph = useMemo(miniGraph, []);
  const result = useMemo(() => search(graph, kind), [graph, kind]);
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);

  const step = result.steps[Math.min(i, result.steps.length - 1)];
  const atEnd = i >= result.steps.length - 1;

  useEffect(() => {
    if (!playing) return;
    if (atEnd) { setPlaying(false); return; }
    const t = setTimeout(() => setI((v) => v + 1), 1250);
    return () => clearTimeout(t);
  }, [playing, i, atEnd]);

  const visuals = new Map<string, NodeVisual>();
  for (const n of graph.nodes) visuals.set(n.id, 'idle');
  for (const id of step.explored) visuals.set(id, 'explored');
  for (const f of step.frontier) visuals.set(f.nodeId, 'frontier');
  if (step.path) for (const id of step.path) visuals.set(id, 'path');
  if (step.currentId && step.phase !== 'success') visuals.set(step.currentId, 'current');
  if (!step.path) { visuals.set(graph.startId!, 'start'); visuals.set(graph.goalId!, 'goal'); }

  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  const pathEdges = new Set(step.pathEdgeIds);
  const activeEdges = new Set(step.activeEdgeIds);
  const hById = new Map(step.frontier.map((f) => [f.nodeId, f.h]));
  for (const nb of step.neighbours) hById.set(nb.nodeId, nb.h);

  return (
    <div className="space-y-3">
      <div className="panel ticks dense overflow-hidden">
        <svg viewBox="0 0 790 310" className="w-full block graph-canvas" style={{ height: 'clamp(200px,32vw,290px)' }} role="img"
          aria-label="Animated demonstration of Greedy Best-First Search on a seven-node graph">
          <defs>
            <filter id="mGlow" x="-70%" y="-70%" width="240%" height="240%">
              <feGaussianBlur stdDeviation="4" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          {graph.edges.map((e) => {
            const a = nodeById.get(e.a)!, b = nodeById.get(e.b)!;
            const onPath = pathEdges.has(e.id), act = activeEdges.has(e.id);
            return (
              <g key={e.id}>
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                  stroke={onPath ? '#72E6A1' : act ? '#43D9E8' : 'rgba(255,255,255,0.18)'}
                  strokeWidth={onPath ? 3.2 : act ? 2 : 1.2}
                  filter={onPath || act ? 'url(#mGlow)' : undefined}
                  strokeDasharray={act && !onPath ? '6 4' : undefined} className={act && !onPath ? 'animate-dash' : ''} />
                <g>
                  <rect x={(a.x + b.x) / 2 - 11} y={(a.y + b.y) / 2 - 8} width={22} height={15} rx={1.5}
                    fill="rgba(9,11,15,0.9)" stroke="rgba(255,255,255,0.14)" />
                  <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 + 3} textAnchor="middle" className="tvalue" fontSize="9"
                    fill="rgba(231,236,242,0.7)">{e.weight}</text>
                </g>
              </g>
            );
          })}
          {graph.nodes.map((n) => {
            const vis = visuals.get(n.id)!;
            const color = NODE_COLORS[vis];
            const h = hById.get(n.id);
            return (
              <g key={n.id} transform={`translate(${n.x},${n.y})`}>
                {vis === 'current' && <circle r={15} fill="none" stroke={color} strokeWidth="2" className="animate-pulseRing pulse-ring" />}
                <circle r={15} fill={vis === 'idle' ? 'rgba(32,40,51,0.95)' : color}
                  stroke="rgba(9,11,15,0.6)" strokeWidth="1.4" filter={vis !== 'idle' ? 'url(#mGlow)' : undefined} />
                <text y={4.5} textAnchor="middle" className="tvalue" fontSize="11.5"
                  fill={vis === 'idle' ? 'rgba(231,236,242,0.75)' : '#090B0F'} fontWeight="600">{n.label}</text>
                {h !== undefined && (
                  <text x={0} y={-23} textAnchor="middle" className="tvalue" fontSize="9.5" fill="#FFCE85">h {h}</text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <button className="btn btn-primary" onClick={() => { if (atEnd) { setI(0); setPlaying(true); } else setPlaying((p) => !p); }}>
          {playing ? <><Pause size={12} /> PAUSE</> : <><Play size={12} /> {atEnd ? 'REPLAY' : 'PLAY'}</>}
        </button>
        <button className="btn" onClick={() => { setPlaying(false); setI((v) => Math.max(0, v - 1)); }} disabled={i === 0}><SkipBack size={12} /> PREV</button>
        <button className="btn" onClick={() => { setPlaying(false); setI((v) => Math.min(result.steps.length - 1, v + 1)); }} disabled={atEnd}><SkipForward size={12} /> NEXT</button>
        <button className="btn" onClick={() => { setPlaying(false); setI(0); }}><RotateCcw size={12} /> RESET</button>
        <span className="tvalue text-[10px] text-white/40 ml-1">STEP {i + 1} / {result.steps.length}</span>
      </div>

      <div className="panel px-3 py-2.5 bg-black/30 min-h-[92px]">
        <div className="tlabel !text-[9px] mb-1.5 text-amber">{step.title.toUpperCase()}</div>
        <p className="text-[12.5px] leading-relaxed text-white/70">{step.decision}</p>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-2">
        <Swatch color={NODE_COLORS.start} label="START" />
        <Swatch color={NODE_COLORS.goal} label="GOAL" />
        <Swatch color={NODE_COLORS.current} label="CURRENT" />
        <Swatch color={NODE_COLORS.frontier} label="FRONTIER" />
        <Swatch color={NODE_COLORS.explored} label="EXPLORED" />
        <Swatch color="#72E6A1" label="FINAL ROUTE" shape="line" />
      </div>
    </div>
  );
}

/* ── Concept glossary ───────────────────────────────────────────────────── */
const CONCEPTS: { term: string; plain: string; detail: string }[] = [
  {
    term: 'AI search',
    plain: 'Finding a sequence of moves that gets you from where you are to where you want to be.',
    detail: 'The problem is described by states, the moves between them and a goal test. A search algorithm explores that space in some order; the whole art is choosing the order well.',
  },
  {
    term: 'Graph',
    plain: 'A set of places and the connections between them.',
    detail: 'In route finding the places are junctions, towns or rooms, and the connections are roads or corridors. Here every graph is undirected — a road can be travelled both ways — and weighted, meaning each connection has a travel cost.',
  },
  {
    term: 'Nodes and edges',
    plain: 'Nodes are the places; edges are the links between them.',
    detail: 'An edge carries a weight: the cost of travelling along it. Edge weights are costs you actually pay, never estimates. Confusing the two is the most common mistake when first implementing these algorithms.',
  },
  {
    term: 'Uninformed vs informed search',
    plain: 'Uninformed search has no idea where the goal is. Informed search has a hint.',
    detail: 'Breadth-first and depth-first search expand nodes in a fixed order, blind to the destination. An informed search consults an extra function that estimates how far each node still is from the goal — and spends its effort in the promising direction.',
  },
  {
    term: 'Heuristic function h(n)',
    plain: 'An educated guess at the remaining cost from node n to the destination.',
    detail: 'A good heuristic is cheap to compute and close to the truth. If it never overestimates the real remaining cost it is called admissible, which is what makes it a valid lower bound — the property landmark heuristics guarantee.',
  },
  {
    term: 'Frontier',
    plain: 'The waiting list: nodes that have been discovered but not yet examined.',
    detail: 'Here it is a priority queue ordered by h(n), so removing the most promising node is fast. Which nodes sit in the frontier, and in what order, is what distinguishes one search algorithm from another.',
  },
  {
    term: 'Explored set',
    plain: 'Everywhere the search has already finished examining.',
    detail: 'Keeping it prevents the search from re-examining a node and looping forever. Watch the explored set grow in the workspace: that is the real work the algorithm is doing.',
  },
  {
    term: 'Greedy Best-First Search',
    plain: 'Always examine whichever waiting node looks closest to the goal.',
    detail: 'It evaluates nodes with f(n) = h(n) and nothing else. That makes it fast and usually well-directed, but because it ignores the cost already paid it can commit to an expensive route and never reconsider.',
  },
];

const STEPS = [
  'Initialise the starting node and compute its heuristic value.',
  'Insert the starting node into the frontier.',
  'Select the frontier node having the lowest heuristic value.',
  'Check whether the selected node is the destination.',
  'If it is not, expand it: generate its unexplored neighbours.',
  'Update the frontier and record the parent of each newly generated node.',
  'Continue until the destination is selected, or the frontier becomes empty.',
  'Reconstruct the final route by following parent pointers back to the start.',
];

export default function Theory({ go }: { go: (s: SectionId) => void }) {
  const [open, setOpen] = useState<string | null>(CONCEPTS[0].term);

  return (
    <div className="mx-auto max-w-[1600px] px-4 sm:px-6 py-10 md:py-14">
      <SectionHead index="02" kicker="LEARN THE ALGORITHM" title="Greedy Best-First Search, from scratch"
        lead="No prior knowledge assumed. Start with the vocabulary, watch a real trace on a small network, then read the algorithm itself." />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.05fr] items-start min-w-0-all">
        {/* ── Glossary ──────────────────────────────────────────────────── */}
        <div className="space-y-2">
          <div className="tlabel mb-3">THE VOCABULARY</div>
          {CONCEPTS.map((c, idx) => {
            const isOpen = open === c.term;
            return (
              <div key={c.term} className="panel overflow-hidden">
                <button className="w-full text-left px-3 py-2.5 flex items-start gap-3"
                  onClick={() => setOpen(isOpen ? null : c.term)} aria-expanded={isOpen}>
                  <span className="tvalue text-[9.5px] text-cyan/60 mt-[3px] shrink-0">{String(idx + 1).padStart(2, '0')}</span>
                  <span className="flex-1 min-w-0">
                    <span className="font-display text-[14.5px] block">{c.term}</span>
                    <span className="text-[12.5px] leading-snug text-white/55 block mt-0.5">{c.plain}</span>
                  </span>
                  <span className="tvalue text-[13px] text-white/30 shrink-0">{isOpen ? '−' : '+'}</span>
                </button>
                {isOpen && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                    className="px-3 pb-3 overflow-hidden">
                    <p className="text-[12.5px] leading-relaxed text-white/65 pl-7 border-l border-cyan/20">{c.detail}</p>
                  </motion.div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Live demonstration ────────────────────────────────────────── */}
        <div>
          <div className="tlabel mb-3">A REAL TRACE ON A SMALL NETWORK</div>
          <MiniTrace kind="euclidean" />
          <Callout tone="info" title="WHAT TO WATCH">
            At each step the algorithm compares only the heuristic values of the nodes waiting in the frontier. The route
            <span className="tvalue text-amber"> S → A → B → C → G</span> wins not because it is cheapest, but because every node
            along it looked closest to G at the moment it was chosen.
          </Callout>
        </div>
      </div>

      {/* ── Evaluation function ─────────────────────────────────────────── */}
      <div className="mt-14 md:mt-20 grid gap-6 lg:grid-cols-[1fr_1fr] min-w-0-all">
        <div>
          <div className="tlabel mb-3">THE EVALUATION FUNCTION</div>
          <h3 className="font-display text-[clamp(20px,3.4vw,30px)] leading-tight tracking-[-0.025em]">
            One line decides everything.
          </h3>
          <Formula note="Greedy Best-First Search selects the frontier node with the smallest heuristic estimate.">
            f(n) = h(n)
          </Formula>
          <p className="text-[13.5px] leading-relaxed text-white/60">
            f(n) is the score used to rank the frontier. For greedy best-first search it is the heuristic alone. The accumulated
            cost g(n) — what has already been spent getting to n — is recorded so you can read the final price of a route, but it
            never enters the ranking.
          </p>

          <div className="mt-5 grid gap-2">
            {[
              ['g(n)', 'Actual accumulated path cost from the start to n. A fact, not a guess.', '#43D9E8'],
              ['h(n)', 'Estimated remaining cost from n to the destination. A guess, not a fact.', '#FFB547'],
              ['f(n) = h(n)', 'Greedy Best-First Search: rank by the estimate alone.', '#72E6A1'],
              ['f(n) = g(n) + h(n)', 'A* search — a different algorithm. Not what this project implements.', '#FF647C'],
            ].map(([k, v, c]) => (
              <div key={k} className="panel px-3 py-2 flex items-start gap-3">
                <span className="tvalue text-[11.5px] shrink-0 w-[108px]" style={{ color: c }}>{k}</span>
                <span className="text-[12.5px] leading-snug text-white/60">{v}</span>
              </div>
            ))}
          </div>

          <Callout tone="warn" title="THE HONEST CAVEAT">
            Greedy Best-First Search is not guaranteed to find the cheapest route, and it is not guaranteed to find a route at all
            on an infinite graph. On the finite graphs here it always terminates — but it may well hand you a longer route than
            necessary. The Analytics section measures exactly how much it loses.
          </Callout>
        </div>

        {/* ── The algorithm ─────────────────────────────────────────────── */}
        <div>
          <div className="tlabel mb-3">THE ALGORITHM, STEP BY STEP</div>
          <ol className="space-y-1.5">
            {STEPS.map((s, i) => (
              <motion.li key={s}
                initial={{ opacity: 0, x: -8 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
                transition={{ duration: 0.35, delay: i * 0.05 }}
                className="panel px-3 py-2.5 flex items-start gap-3">
                <span className="tvalue text-[10px] text-amber border border-amber/35 h-[22px] w-[22px] grid place-items-center shrink-0">{i + 1}</span>
                <span className="text-[13px] leading-snug text-white/70">{s}</span>
              </motion.li>
            ))}
          </ol>

          <div className="mt-6">
            <div className="tlabel mb-3">HOW LANDMARK ESTIMATION WORKS</div>
            <p className="text-[13.5px] leading-relaxed text-white/60">
              Pick a few nodes as landmarks. Before any search begins, run Dijkstra's algorithm from each one to learn its exact
              shortest-path distance to every other node. Those distances are then enough to bound the distance between any two
              nodes, using nothing but the triangle inequality.
            </p>
            <Formula note="Valid for undirected weighted graphs, where d(a,b) = d(b,a).">
              h<sub className="text-[11px]">L</sub>(v,t) = | d(L,t) − d(L,v) |
            </Formula>
            <p className="text-[13.5px] leading-relaxed text-white/60">
              Intuitively: if the landmark is 40 away from the destination and 12 away from where you stand, you cannot possibly
              reach the destination in fewer than 28 — any shorter route would contradict the landmark's own measured distances.
              With several landmarks, every one of them gives a bound, and the largest is the most informative.
            </p>
            <Formula note="The maximum of several valid lower bounds is itself a valid lower bound, and the tightest available.">
              h(v,t) = max<sub className="text-[11px]">L</sub> | d(L,t) − d(L,v) |
            </Formula>
            <button className="btn btn-primary mt-2" onClick={() => go('landmark')}>
              SEE THE MATHEMATICS LIVE <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </div>

      <div className="mt-14 panel-glass ticks p-5 md:p-7 text-center">
        <div className="tlabel mb-3">NEXT</div>
        <h3 className="font-display text-[clamp(19px,3.2vw,27px)] leading-tight tracking-[-0.02em] mb-4">
          Now run it yourself on a network you control.
        </h3>
        <div className="flex flex-wrap gap-2 justify-center">
          <button className="btn btn-primary" onClick={() => go('visualizer')}>OPEN THE VISUALIZER <ArrowRight size={13} /></button>
          <button className="btn" onClick={() => go('practice')}>TEST YOURSELF</button>
        </div>
      </div>
    </div>
  );
}
