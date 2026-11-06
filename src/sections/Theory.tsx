import { useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, SkipBack, SkipForward, RotateCcw, ArrowRight } from 'lucide-react';
import { Graph, GraphNode, GraphEdge, uid, euclidean, COST_SCALE } from '../lib/graph';
import { search, PSEUDOCODE, PSEUDOCODE_PLAIN, PSEUDOCODE_BFS, PSEUDOCODE_BFS_PLAIN, Algorithm } from '../lib/searchEngine';
import { HeuristicKind } from '../lib/heuristics';
import { SectionHead, Formula, Callout, Chip, GraphLegend, PlainNote } from '../components/ui';
import { NODE_COLORS, NodeVisual } from '../state/store';
import { SectionId } from '../components/Shell';

/* ===========================================================================
 * EMBEDDED MINI TRACE
 * A small self-contained demonstration. It runs the SAME engine as the main
 * workspace — the numbers and the decisions below are not scripted.
 *
 * Geometry and cost are deliberately kept on the same scale here: every road
 * costs what its length suggests (cost = distance / 10, the project-wide
 * COST_SCALE), so a straight-line estimate is directly comparable with the
 * numbers printed on the roads. The single exception is A–B, which is marked
 * as a slow, congested road at 40. That one difference is what gives the
 * demonstration something worth watching: the greedy route looks best at
 * every individual step and still ends up the more expensive of the two.
 * ========================================================================= */

const CONGESTED_AB = 40;

/** Rounds a road's cost UP from its length. Rounding to nearest, as the main
 *  presets do, can shave a fraction off a road and leave the straight-line
 *  guess a hair above the true remaining cost — which would quietly make it
 *  inadmissible on this map, right where the text promises it never
 *  overestimates. Rounding up removes that edge case entirely. */
const roadCost = (a: GraphNode, b: GraphNode) => Math.max(1, Math.ceil(euclidean(a, b) / COST_SCALE));

function miniGraph(): Graph {
  const defs: [string, number, number][] = [
    ['S', 70, 150], ['A', 230, 60], ['D', 205, 265], ['B', 390, 60],
    ['E', 400, 250], ['C', 560, 115], ['G', 720, 160],
  ];
  const nodes: GraphNode[] = defs.map(([label, x, y]) => ({ id: `m_${label}`, label, x, y }));
  const by = new Map(nodes.map((n) => [n.label, n]));
  const pairs: [string, string][] = [
    ['S', 'A'], ['S', 'D'], ['A', 'B'], ['B', 'C'], ['C', 'G'], ['D', 'E'], ['E', 'G'],
  ];
  const edges: GraphEdge[] = pairs.map(([a, b]) => ({
    id: uid('me'),
    a: by.get(a)!.id,
    b: by.get(b)!.id,
    weight: a === 'A' && b === 'B' ? CONGESTED_AB : roadCost(by.get(a)!, by.get(b)!),
  }));
  return { nodes, edges, startId: by.get('S')!.id, goalId: by.get('G')!.id, landmarkIds: [by.get('D')!.id] };
}

function MiniTrace({ kind = 'euclidean', algorithm = 'gbfs' }: { kind?: HeuristicKind; algorithm?: Algorithm }) {
  const graph = useMemo(miniGraph, []);
  const result = useMemo(() => search(graph, kind, algorithm), [graph, kind, algorithm]);
  const bfs = algorithm === 'bfs';
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [plainCode, setPlainCode] = useState(true);

  const step = result.steps[Math.min(i, result.steps.length - 1)];
  const atEnd = i >= result.steps.length - 1;

  useEffect(() => {
    if (!playing) return;
    if (atEnd) { setPlaying(false); return; }
    const t = setTimeout(() => setI((v) => v + 1), 1600);
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
  const labelOfMini = (id: string | null) => (id ? nodeById.get(id)?.label ?? id : '—');
  const pathEdges = new Set(step.pathEdgeIds);
  const activeEdges = new Set(step.activeEdgeIds);
  const hById = new Map(step.frontier.map((f) => [f.nodeId, f.h]));
  const ringOf = new Map<string, number>([[graph.startId!, 0]]);
  for (const f of step.frontier) ringOf.set(f.nodeId, f.depth);
  for (let pass = 0; pass < graph.nodes.length; pass++) {
    for (const [child, parent] of Object.entries(step.parents)) {
      if (!ringOf.has(child) && ringOf.has(parent)) ringOf.set(child, ringOf.get(parent)! + 1);
    }
  }
  for (const nb of step.neighbours) hById.set(nb.nodeId, nb.h);

  const R = 21;
  const lines = bfs ? (plainCode ? PSEUDOCODE_BFS_PLAIN : PSEUDOCODE_BFS) : (plainCode ? PSEUDOCODE_PLAIN : PSEUDOCODE);

  return (
    <div className="space-y-3">
      <div className="panel ticks overflow-hidden">
        <svg viewBox="0 0 800 330" className="w-full block graph-canvas" style={{ height: 'clamp(240px,34vw,320px)' }} role="img"
          aria-label="Animated demonstration of Greedy Best-First Search on a seven-place map">
          <defs>
            <filter id="mGlow" x="-70%" y="-70%" width="240%" height="240%">
              <feGaussianBlur stdDeviation="4" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <marker id="mArrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="4.5" markerHeight="4.5" orient="auto">
              <path d="M0 0 L10 5 L0 10 z" fill="#72E6A1" />
            </marker>
          </defs>
          {graph.edges.map((e) => {
            const a = nodeById.get(e.a)!, b = nodeById.get(e.b)!;
            const onPath = pathEdges.has(e.id), act = activeEdges.has(e.id);
            const slow = e.weight === CONGESTED_AB;
            return (
              <g key={e.id}>
                <line className="edge-line" x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                  stroke={onPath ? '#72E6A1' : act ? '#43D9E8' : slow ? 'rgba(255,100,124,0.42)' : 'rgba(255,255,255,0.22)'}
                  strokeWidth={onPath ? 4.5 : act ? 3 : slow ? 2.6 : 1.6}
                  filter={onPath ? 'url(#mGlow)' : undefined}
                  markerEnd={onPath ? 'url(#mArrow)' : undefined}
                  strokeDasharray={act && !onPath ? '9 6' : undefined}
                  style={act && !onPath ? { animation: 'flowDash 1.1s linear infinite' } : undefined} />
                <g>
                  <rect x={(a.x + b.x) / 2 - 15} y={(a.y + b.y) / 2 - 11} width={30} height={22} rx={2}
                    fill="rgba(9,11,15,0.93)" stroke={slow ? 'rgba(255,100,124,0.55)' : 'rgba(255,255,255,0.2)'} />
                  <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 + 5} textAnchor="middle" className="tvalue no-halo" fontSize="13"
                    fill={slow ? '#FFAFBC' : 'rgba(236,241,247,0.86)'}>{e.weight}</text>
                </g>
              </g>
            );
          })}
          {graph.nodes.map((n) => {
            const vis = visuals.get(n.id)!;
            const color = NODE_COLORS[vis];
            const h = hById.get(n.id);
            const filled = vis !== 'idle';
            return (
              <g key={n.id} transform={`translate(${n.x},${n.y})`}>
                {vis === 'current' && <circle r={R} fill="none" stroke={color} strokeWidth="2.5" className="animate-pulseRing pulse-ring" />}
                <circle className="node-body" r={R} fill={filled ? color : '#28313E'}
                  stroke={filled ? 'rgba(9,11,15,0.6)' : 'rgba(255,255,255,0.4)'} strokeWidth="1.8"
                  filter={filled && vis !== 'frontier' ? 'url(#mGlow)' : undefined} />
                <text y={5.5} textAnchor="middle" className="tvalue in-node" fontSize="15"
                  fill={filled ? '#0A0D12' : 'rgba(236,241,247,0.92)'} fontWeight="600">{n.label}</text>
                {bfs && ringOf.has(n.id) && (
                  <text x={0} y={-R - 9} textAnchor="middle" className="tvalue" fontSize="12.5" fill="#9FEFF8">ring {ringOf.get(n.id)}</text>
                )}
                {!bfs && h !== undefined && (
                  <text x={0} y={-R - 9} textAnchor="middle" className="tvalue" fontSize="12.5" fill="#FFCE85">{h} to go</text>
                )}
                {n.id === graph.startId && <text x={0} y={R + 19} textAnchor="middle" className="tvalue" fontSize="11" fill="#43D9E8">START</text>}
                {n.id === graph.goalId && <text x={0} y={R + 19} textAnchor="middle" className="tvalue" fontSize="11" fill="#72E6A1">DESTINATION</text>}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button className="btn btn-primary" onClick={() => { if (atEnd) { setI(0); setPlaying(true); } else setPlaying((p) => !p); }}>
          {playing ? <><Pause size={15} /> Pause</> : <><Play size={15} /> {atEnd ? 'Play again' : 'Play'}</>}
        </button>
        <button className="btn" onClick={() => { setPlaying(false); setI((v) => Math.max(0, v - 1)); }} disabled={i === 0}><SkipBack size={15} /> Back</button>
        <button className="btn" onClick={() => { setPlaying(false); setI((v) => Math.min(result.steps.length - 1, v + 1)); }} disabled={atEnd}><SkipForward size={15} /> Next step</button>
        <button className="btn" onClick={() => { setPlaying(false); setI(0); }}><RotateCcw size={15} /> Reset</button>
        <span className="text-[14px] text-ink3 ml-1">Step {i + 1} of {result.steps.length}</span>
      </div>

      {/* The waiting list, as a row of cards. */}
      <div className="panel px-3.5 py-3">
        <div className="flex items-baseline gap-3 mb-2.5">
          <span className="text-[15px] font-medium text-ink1">{bfs ? 'Queue' : 'Waiting list'}</span>
          <span className="term-tech">{bfs ? 'first in, first out' : 'sorted by guess'}</span>
          <span className="text-[13px] text-ink4 ml-auto">{bfs ? 'front of the queue first →' : 'smallest guess first →'}</span>
        </div>
        {step.frontier.length === 0 ? (
          <span className="text-[13px] text-ink4">empty</span>
        ) : (
          <div className="flex flex-wrap gap-2">
            {step.frontier.map((f, idx) => (
              <span key={f.nodeId} className="tvalue text-[13.5px] px-3 py-1.5 rounded-[8px]"
                style={{
                  boxShadow: idx === 0 ? 'inset 0 0 0 1px rgba(242,223,107,0.6)' : 'inset 0 0 0 1px rgba(255,255,255,0.1)',
                  background: idx === 0 ? 'rgba(242,223,107,0.1)' : 'rgba(255,255,255,0.03)',
                  color: idx === 0 ? '#F2DF6B' : 'var(--ink-2)',
                }}>
                {labelOfMini(f.nodeId)}{' '}
                {bfs ? <span className="text-cyan">ring {f.depth}</span> : <span className="text-amber">{f.h} to go</span>}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="panel px-3.5 py-3.5 border-l-2" style={{ borderLeftColor: '#FFB547' }}>
        <div className="text-[14px] font-medium mb-2 text-amber">{step.title}</div>
        <p className="text-[15px] leading-relaxed text-ink1">{step.decision}</p>
      </div>

      <div className="panel px-3.5 py-3">
        <div className="flex items-center gap-2 mb-2.5">
          <Chip active={plainCode} onClick={() => setPlainCode(true)}>Plain English</Chip>
          <Chip active={!plainCode} onClick={() => setPlainCode(false)}>Pseudocode</Chip>
        </div>
        <pre className="tvalue text-[13.5px] leading-[1.75] overflow-x-auto scroll-tech m-0 max-h-[190px]">
          {lines.map((line, lineIdx) => {
            const isLineActive = step.pseudocodeLines.includes(lineIdx);
            return (
              <div key={lineIdx}
                className="flex gap-2.5 px-1.5 -mx-1.5 transition-colors duration-150"
                style={{
                  background: isLineActive ? 'rgba(255,181,71,0.16)' : undefined,
                  borderLeft: `3px solid ${isLineActive ? '#FFB547' : 'transparent'}`,
                  color: isLineActive ? '#FFD79A' : 'var(--ink-3)',
                }}>
                <span className="text-ink4 select-none w-4 text-right shrink-0">{lineIdx + 1}</span>
                <span className="whitespace-pre">{line}</span>
              </div>
            );
          })}
        </pre>
      </div>

      <GraphLegend compact />
    </div>
  );
}

/* ── Concept glossary — exactly the words a beginner meets on this site ── */
const CONCEPTS: { term: string; plain: string; detail: string }[] = [
  {
    term: 'Source',
    plain: 'Where the journey starts.',
    detail: 'Also called the start node. Every search begins here, with nothing else known yet.',
  },
  {
    term: 'Destination',
    plain: 'Where we want to reach.',
    detail: 'Also called the goal. The search stops the moment the destination is taken out of the queue.',
  },
  {
    term: 'Neighbour',
    plain: 'A place directly connected to another place by one road.',
    detail: 'When the search checks a place, it looks at all of its neighbours. On the map, neighbours are the places at the other end of each line touching a circle.',
  },
  {
    term: 'Queue',
    plain: 'Places waiting to be explored.',
    detail: 'A queue works like a line at a ticket counter: new places join at the back, and the next place to be checked always leaves from the front. First in, first out. That simple rule is the whole of Breadth-First Search.',
  },
  {
    term: 'Visited',
    plain: 'Places that have already been checked — or are already waiting.',
    detail: 'Breadth-First Search marks a place as visited the moment it finds it. A visited place is never added to the queue again, which is what stops the search walking round in circles.',
  },
  {
    term: 'Ring (level)',
    plain: 'How many roads away from the start a place is.',
    detail: 'The start is ring 0. Its neighbours are ring 1. Their new neighbours are ring 2. Breadth-First Search always finishes one ring completely before starting the next — which is why it is called "breadth" first.',
  },
  {
    term: 'Final path',
    plain: 'The route found from the start to the destination.',
    detail: 'Every time a place is found, the search notes which place it came from. When the destination is reached, following those notes backwards spells out the route.',
  },
  {
    term: 'Landmark',
    plain: 'A recognisable place used as a reference point for measuring.',
    detail: 'Before searching, we measure the real road distance from each landmark to every other place. Those measurements let us make a quick, safe guess of how far any place is from the destination. Breadth-First Search does not use this guess — Best-First Search does.',
  },
];

/* The six-step walkthrough, exactly as a student first meets Breadth-First. */
const BFS_STORY: { title: string; what: string; why: string }[] = [
  { title: 'Start at the source', what: 'The starting place goes into the queue and is marked as visited.', why: 'Every search needs somewhere to begin, and marking it now means we never come back to it.' },
  { title: 'Explore the neighbours', what: 'Take the place at the front of the queue and look at every place one road away.', why: 'Breadth-First Search checks everything close by before going any further.' },
  { title: 'Add new places to the queue', what: 'Any neighbour not seen before joins the back of the queue.', why: 'The queue stores the places waiting to be checked, in the order they were found.' },
  { title: 'Skip visited places', what: 'Neighbours already visited are ignored.', why: 'Visited places are not checked again — otherwise the search could loop forever.' },
  { title: 'Keep going, ring by ring', what: 'Repeat: front of the queue out, new neighbours in at the back.', why: 'Because of first-in-first-out, every place 1 road away is checked before any place 2 roads away.' },
  { title: 'Trace the final route', what: 'When the destination comes out of the queue, follow the "came from" notes back to the start.', why: 'That gives the route with the fewest roads. Not always the shortest distance — but always the fewest roads.' },
];

export default function Theory({ go }: { go: (s: SectionId) => void }) {
  const [open, setOpen] = useState<string | null>(CONCEPTS[3].term);

  return (
    <div className="mx-auto max-w-[1600px] px-5 sm:px-8 py-12 md:py-16">
      <SectionHead index="02" kicker="Learn it from scratch" title="How Breadth-First Search finds a route"
        lead="No background needed. Learn the eight words, watch a real search spread across a small map one ring at a time, then see what changes when the search is given a landmark-based guess." />

      {/* ── Part 1: Breadth-First Search ───────────────────────────────── */}
      <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr] items-start min-w-0-all">
        <div className="space-y-2">
          <div className="text-[14px] text-ink3 mb-3">The words you need — that is all of them</div>
          {CONCEPTS.map((c, idx) => {
            const isOpen = open === c.term;
            return (
              <div key={c.term} className="panel overflow-hidden">
                <button className="w-full text-left px-5 py-3.5 flex items-start gap-3.5"
                  onClick={() => setOpen(isOpen ? null : c.term)} aria-expanded={isOpen}>
                  <span className="tvalue text-[12px] text-ink4 mt-[5px] shrink-0">{String(idx + 1).padStart(2, '0')}</span>
                  <span className="flex-1 min-w-0">
                    <span className="font-display text-[17px] block leading-snug text-white">{c.term}</span>
                    <span className="text-[14px] leading-snug text-ink3 block mt-1">{c.plain}</span>
                  </span>
                  <span className="text-[18px] text-ink4 shrink-0 leading-none mt-1">{isOpen ? '−' : '+'}</span>
                </button>
                {isOpen && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                    className="px-5 pb-4 overflow-hidden">
                    <p className="text-[14px] leading-relaxed text-ink2 pl-[30px]">{c.detail}</p>
                  </motion.div>
                )}
              </div>
            );
          })}
        </div>

        <div>
          <div className="text-[14px] text-ink3 mb-3">Breadth-First Search, running for real on a seven-place map</div>
          <MiniTrace algorithm="bfs" />
        </div>
      </div>

      {/* ── The six steps ─────────────────────────────────────────────── */}
      <div className="mt-20 md:mt-28">
        <div className="text-[14px] text-ink3 mb-4">The whole of Breadth-First Search, in six steps</div>
        <h3 className="font-display text-[clamp(26px,4vw,40px)] leading-tight tracking-[-0.03em] max-w-3xl mb-10">
          Check everything one road away. Then everything two roads away. Then three.
        </h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 border-t border-l border-white/[0.07]">
          {BFS_STORY.map((st, i) => (
            <motion.div key={st.title}
              initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.45, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
              className="border-r border-b border-white/[0.07] p-6 lg:p-7">
              <div className="tvalue text-[13px] text-ink4">Step {i + 1}</div>
              <h4 className="font-display text-[19px] leading-snug tracking-[-0.02em] mt-2">{st.title}</h4>
              <p className="text-[14.5px] leading-relaxed text-ink2 mt-3">{st.what}</p>
              <p className="text-[14px] leading-relaxed text-ink3 mt-2.5"><span className="text-ink4">Why: </span>{st.why}</p>
            </motion.div>
          ))}
        </div>
        <Callout tone="info" title="What Breadth-First Search guarantees — and what it does not">
          It always finds the route with the <strong className="text-white font-medium">fewest roads</strong>. It does not
          look at how long each road is. On the City roads map, from CENTRAL to TERMINAL, it finds a 5-road route that is 133
          long — while a different 5-road route is only 90 long. To Breadth-First Search those two look identical, because
          it never reads the numbers on the roads.
        </Callout>
      </div>

      {/* ── Part 2: adding a guess ────────────────────────────────────── */}
      <div className="mt-20 md:mt-28 pt-16 hairline-t">
        <div className="text-[14px] text-ink3 mb-4">Part two — the landmark guess</div>
        <h3 className="font-display text-[clamp(26px,4vw,40px)] leading-tight tracking-[-0.03em] max-w-3xl">
          What if the search could guess which way the destination is?
        </h3>
        <p className="mt-5 max-w-3xl text-[16px] leading-relaxed text-ink3">
          Breadth-First Search spreads out evenly in every direction, even directions that lead away from the destination.
          Best-First Search swaps the plain queue for a list sorted by a guess of how far each place still is from the
          destination — and always goes to the most promising one next. The landmark guess is a particularly good one,
          because it is built from real road distances.
        </p>

        <div className="mt-10 grid gap-8 lg:grid-cols-[1.1fr_1fr] items-start min-w-0-all">
          <div>
            <div className="text-[14px] text-ink3 mb-3">Best-First Search on the same map</div>
            <MiniTrace kind="euclidean" algorithm="gbfs" />
            <Callout tone="warn" title="Watch what goes wrong here">
              It takes the top road, <span className="tvalue text-amber">S → A → B → C → G</span>, because at every single
              step that direction looked closest to the destination. But the road from A to B is slow — it costs 40, far more
              than its length suggests. The bottom road through D and E was never as attractive and is the cheaper journey.
              Best-First Search only ever asks “how far is left?”, never “how much have I already spent?”
            </Callout>
          </div>

          <div>
            <div className="text-[14px] text-ink3 mb-3">The two algorithms side by side</div>
            <div className="grid gap-2">
              {[
                ['Breadth-First Search', 'queue — first in, first out', 'Ignores the guess and road lengths. Finds the fewest roads.', '#43D9E8'],
                ['Best-First Search', 'list sorted by the guess, f(n) = h(n)', 'Follows the guess. Usually fast. Not guaranteed shortest.', '#FFB547'],
                ['Travelled so far', 'g(n)', 'Real distance already covered. Measured by adding up roads.', 'rgba(244,245,247,0.8)'],
                ['Distance left', 'h(n)', 'A guess at what is still ahead. Never measured — only estimated.', 'rgba(244,245,247,0.8)'],
              ].map(([plain, tech, v, c]) => (
                <div key={plain} className="panel px-5 py-3.5 flex items-start gap-4">
                  <span className="shrink-0 w-[168px]">
                    <span className="block text-[15px] leading-tight" style={{ color: c }}>{plain}</span>
                    <span className="term-tech block mt-1.5">{tech}</span>
                  </span>
                  <span className="text-[14px] leading-snug text-ink3">{v}</span>
                </div>
              ))}
            </div>

            <div className="mt-10">
              <div className="text-[14px] text-ink3 mb-3">Where the landmark guess comes from</div>
              <p className="text-[15px] leading-relaxed text-ink2">
                Pick a few places and call them landmarks. Before any search begins, measure the real road distance from each
                landmark to everywhere else. Those measurements alone put a floor under the distance between any two places.
              </p>
              <Formula note="One landmark L. The bars mean “ignore the minus sign”.">
                h<sub className="text-[12px]">L</sub>(v,t) = | d(L,t) − d(L,v) |
              </Formula>
              <PlainNote>
                If a landmark is 40 away from the destination and 12 away from where you stand, you cannot possibly reach the
                destination in less than 28 — any shorter route would contradict distances we have already measured. So 28 is a
                safe guess: never too big, and often close.
              </PlainNote>
              <Formula note="Several landmarks: take the biggest of the safe guesses.">
                h(v,t) = max<sub className="text-[12px]">L</sub> | d(L,t) − d(L,v) |
              </Formula>
              <button className="btn btn-primary mt-2" onClick={() => go('landmark')}>
                See the numbers live <ArrowRight size={15} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-20 panel p-8 md:p-12 text-center">
        <h3 className="font-display text-[clamp(24px,3.6vw,34px)] leading-tight tracking-[-0.03em] mb-6">
          Now run it yourself, on a map you control.
        </h3>
        <div className="flex flex-wrap gap-3 justify-center">
          <button className="btn btn-primary btn-lg" onClick={() => go('visualizer')}>Open the visualizer <ArrowRight size={16} /></button>
          <button className="btn btn-lg" onClick={() => go('practice')}>Test yourself</button>
        </div>
      </div>
    </div>
  );
}
