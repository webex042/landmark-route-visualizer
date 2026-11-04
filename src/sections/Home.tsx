import { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, BookOpen, Activity, Diamond, GitBranch, Gauge } from 'lucide-react';
import { SectionId } from '../components/Shell';

/* ── Animated hero network ──────────────────────────────────────────────── */
function HeroGraph() {
  const reduce = useReducedMotion();

  const { nodes, edges, route } = useMemo(() => {
    const nodes = [
      { x: 90, y: 300 }, { x: 215, y: 165 }, { x: 250, y: 420 }, { x: 370, y: 285 },
      { x: 420, y: 95 }, { x: 460, y: 495 }, { x: 560, y: 190 }, { x: 600, y: 370 },
      { x: 720, y: 110 }, { x: 745, y: 475 }, { x: 830, y: 265 }, { x: 950, y: 385 },
      { x: 990, y: 160 }, { x: 1080, y: 300 },
    ];
    const edges: [number, number][] = [
      [0, 1], [0, 2], [1, 3], [1, 4], [2, 3], [2, 5], [3, 6], [3, 7], [4, 6], [5, 7],
      [5, 9], [6, 8], [6, 10], [7, 10], [8, 10], [8, 12], [9, 11], [10, 11], [10, 12],
      [11, 13], [12, 13],
    ];
    const route = [0, 1, 3, 6, 10, 11, 13];
    return { nodes, edges, route };
  }, []);

  const routePath = route.map((i, k) => `${k === 0 ? 'M' : 'L'}${nodes[i].x} ${nodes[i].y}`).join(' ');

  return (
    <svg viewBox="0 0 1180 600" className="absolute inset-0 h-full w-full" aria-hidden
      preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id="heroGlow" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#43D9E8" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#43D9E8" stopOpacity="0" />
        </radialGradient>
        <filter id="heroBlur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>

      <rect width="1180" height="600" fill="url(#heroGlow)" />

      {edges.map(([a, b], i) => (
        <motion.line key={i}
          x1={nodes[a].x} y1={nodes[a].y} x2={nodes[b].x} y2={nodes[b].y}
          stroke="rgba(67,217,232,0.2)" strokeWidth="1"
          initial={reduce ? undefined : { pathLength: 0, opacity: 0 }}
          animate={reduce ? undefined : { pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.1, delay: 0.25 + i * 0.035, ease: 'easeOut' }}
        />
      ))}

      {/* traced route */}
      <path d={routePath} fill="none" stroke="#72E6A1" strokeWidth="5" opacity="0.25" filter="url(#heroBlur)" />
      <motion.path d={routePath} fill="none" stroke="#72E6A1" strokeWidth="1.8" strokeLinecap="round"
        initial={reduce ? undefined : { pathLength: 0 }}
        animate={reduce ? undefined : { pathLength: [0, 1, 1, 0] }}
        transition={{ duration: 7.5, times: [0, 0.42, 0.78, 1], repeat: Infinity, ease: 'easeInOut', delay: 1 }}
      />

      {nodes.map((n, i) => {
        const onRoute = route.includes(i);
        return (
          <motion.g key={i}
            initial={reduce ? undefined : { opacity: 0, scale: 0.4 }}
            animate={reduce ? undefined : { opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.1 + i * 0.05 }}
            style={{ transformOrigin: `${n.x}px ${n.y}px` }}>
            {onRoute && (
              <motion.circle cx={n.x} cy={n.y} r={10} fill="none" stroke="#72E6A1" strokeWidth="1"
                animate={reduce ? undefined : { r: [8, 17], opacity: [0.5, 0] }}
                transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.3 }} />
            )}
            <circle cx={n.x} cy={n.y} r={onRoute ? 5.5 : 4}
              fill={onRoute ? '#72E6A1' : 'rgba(67,217,232,0.5)'} />
          </motion.g>
        );
      })}
    </svg>
  );
}

const CAPABILITIES = [
  { icon: GitBranch, title: 'Editable graph', text: 'Place nodes, draw roads, set travel costs, drag the layout — every edit re-runs the real algorithm.' },
  { icon: Diamond, title: 'Landmark mathematics', text: 'Dijkstra preprocessing from each landmark, with the full |d(L,t) − d(L,v)| derivation shown node by node.' },
  { icon: Activity, title: 'Honest step trace', text: 'Full state snapshots mean Previous Step restores the real algorithm state, not a rewound animation.' },
  { icon: Gauge, title: 'Measured analytics', text: 'Expansions, heuristic evaluations and timings read straight off the execution — nothing is fabricated.' },
];

export default function Home({ go }: { go: (s: SectionId) => void }) {
  return (
    <div>
      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="relative min-h-[clamp(560px,84vh,780px)] flex items-center overflow-hidden">
        <div className="absolute inset-0 blueprint blueprint-fade opacity-70" aria-hidden />
        <div className="absolute inset-0" aria-hidden><HeroGraph /></div>
        <div className="absolute inset-0 bg-gradient-to-t from-obsidian via-obsidian/55 to-obsidian/80" aria-hidden />

        <div className="relative mx-auto max-w-[1600px] w-full px-4 sm:px-6 py-14">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}
            className="max-w-3xl">
            <div className="flex items-center gap-3 mb-5">
              <span className="tvalue text-[9.5px] text-cyan border border-cyan/35 px-2 py-1 tracking-[0.18em]">
                AI / INFORMED SEARCH
              </span>
              <span className="tlabel !text-[9px]">TEAM DEEP FORGE</span>
            </div>

            <h1 className="font-display text-[clamp(34px,8.5vw,80px)] leading-[0.95] tracking-[-0.045em]">
              INTELLIGENT<br />
              <span className="text-glow-amber text-amber">ROUTE FINDING.</span>
            </h1>

            <p className="mt-6 max-w-xl text-[14.5px] md:text-[16px] leading-relaxed text-white/60">
              Explore how heuristic-guided search algorithms discover intelligent routes through complex networks using
              landmark-based distance estimation.
            </p>

            <div className="mt-8 flex flex-wrap gap-2.5">
              <button className="btn btn-primary !px-5 !py-3" onClick={() => go('visualizer')}>
                EXPLORE VISUALIZER <ArrowRight size={14} />
              </button>
              <button className="btn !px-5 !py-3" onClick={() => go('theory')}>
                <BookOpen size={14} /> UNDERSTAND THE ALGORITHM
              </button>
            </div>
          </motion.div>

          {/* status panel */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.45 }}
            className="panel-glass ticks scan relative overflow-hidden mt-12 inline-block px-4 py-3.5 max-w-full">
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-7 gap-y-2.5">
              {[
                ['SYSTEM', 'NAVIGATION LAB', '#E7ECF2'],
                ['ALGORITHM', 'GREEDY BEST-FIRST SEARCH', '#FFB547'],
                ['HEURISTIC', 'LANDMARK-BASED', '#A78BFA'],
                ['STATUS', 'READY', '#72E6A1'],
              ].map(([k, v, c]) => (
                <div key={k}>
                  <dt className="tlabel !text-[8.5px]">{k}</dt>
                  <dd className="tvalue text-[10.5px] mt-1 tracking-[0.1em]" style={{ color: c }}>
                    {k === 'STATUS' && <span className="inline-block h-1.5 w-1.5 rounded-full bg-signal mr-1.5 align-middle animate-blink" />}
                    {v}
                  </dd>
                </div>
              ))}
            </dl>
          </motion.div>
        </div>

        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 tvalue text-[9px] tracking-[0.18em] text-white/30 hidden sm:block normal-case" aria-hidden>
          f(n) = h(n) &nbsp;·&nbsp; h(v,t) = max |d(L,t) − d(L,v)|
        </div>
      </section>

      {/* ── Capability strip ────────────────────────────────────────────── */}
      <section className="mx-auto max-w-[1600px] px-4 sm:px-6 py-14 md:py-20">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {CAPABILITIES.map((c, i) => {
            const Icon = c.icon;
            return (
              <motion.div key={c.title}
                initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.45, delay: i * 0.08 }}
                className="panel ticks p-4 group hover:border-cyan/30 transition-colors">
                <Icon size={17} className="text-cyan mb-3" />
                <h3 className="font-display text-[15px] mb-1.5">{c.title}</h3>
                <p className="text-[12.5px] leading-relaxed text-white/50">{c.text}</p>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ── The idea in one screen ──────────────────────────────────────── */}
      <section className="mx-auto max-w-[1600px] px-4 sm:px-6 pb-16 md:pb-24">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr] items-center min-w-0-all">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className="tlabel">THE CORE IDEA</span>
              <span className="h-px flex-1 bg-gradient-to-r from-white/15 to-transparent" />
            </div>
            <h2 className="font-display text-[clamp(24px,4.6vw,40px)] leading-[1.06] tracking-[-0.03em]">
              A search is only as clever<br />as its estimate.
            </h2>
            <p className="mt-5 text-[14px] leading-relaxed text-white/60">
              Greedy Best-First Search always expands whichever waiting node <em>looks</em> closest to the destination. That makes
              it fast, and occasionally wrong. Everything depends on the quality of the estimate it trusts.
            </p>
            <p className="mt-3.5 text-[14px] leading-relaxed text-white/60">
              Straight-line distance is the obvious estimate, but it cannot see the network: a location one kilometre away across a
              river may be thirty kilometres by road. A landmark heuristic measures real shortest-path distances from a handful of
              reference points, then uses the triangle inequality to bound what remains — so detours it has never travelled are
              already accounted for.
            </p>
            <button className="btn mt-7" onClick={() => go('landmark')}>
              OPEN THE LANDMARK LAB <ArrowRight size={13} />
            </button>
          </div>

          <div className="panel ticks p-5 md:p-7 bg-gradient-to-br from-charcoal/60 to-obsidian/80">
            <div className="tlabel mb-4">EVALUATION FUNCTION</div>
            <div className="tvalue text-[24px] md:text-[30px] text-amber mb-1">f(n) = h(n)</div>
            <p className="text-[12.5px] leading-relaxed text-white/50 mb-6">
              Only the estimate of what remains. The cost already paid, g(n), is tracked and reported but never influences the
              choice — that is the single decision which separates this algorithm from A*.
            </p>
            <div className="tlabel mb-4">LANDMARK BOUND</div>
            <div className="tvalue text-[16px] md:text-[19px] text-violet mb-1 break-words">h(v,t) = max<sub className="text-[11px]">L</sub> |d(L,t) − d(L,v)|</div>
            <p className="text-[12.5px] leading-relaxed text-white/50">
              Exact distances from each landmark L, precomputed with Dijkstra's algorithm. Each landmark contributes a valid lower
              bound; the largest of them is the tightest one.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
