import { useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, BookOpen } from 'lucide-react';
import { SectionId } from '../components/Shell';
import { ArrowLink } from '../components/ui';

/* ── Animated hero network ───────────────────────────────────────────────
 * Monochrome, like the reference: faint white connections with one route
 * tracing through in green. The colour is the exception that signals "this
 * is the algorithm at work".
 * ----------------------------------------------------------------------- */
function HeroGraph() {
  const reduce = useReducedMotion();
  const [hovered, setHovered] = useState<number | null>(null);

  const { nodes, edges, route } = useMemo(() => {
    const nodes = [
      { x: 90, y: 300, name: 'Southway' }, { x: 215, y: 165, name: 'North Arc' }, { x: 250, y: 420, name: 'Port' }, { x: 370, y: 285, name: 'Central' },
      { x: 420, y: 95, name: 'Peak' }, { x: 460, y: 495, name: 'Bay' }, { x: 560, y: 190, name: 'Fork' }, { x: 600, y: 370, name: 'Junction' },
      { x: 720, y: 110, name: 'Valley' }, { x: 745, y: 475, name: 'River' }, { x: 830, y: 265, name: 'Nexus' }, { x: 950, y: 385, name: 'Eastgate' },
      { x: 990, y: 160, name: 'Airport' }, { x: 1080, y: 300, name: 'Terminal' },
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
    <svg viewBox="0 0 1180 600" className="absolute inset-0 h-full w-full pointer-events-auto"
      preserveAspectRatio="xMidYMid slice">
      {edges.map(([a, b], i) => (
        <motion.line key={i}
          x1={nodes[a].x} y1={nodes[a].y} x2={nodes[b].x} y2={nodes[b].y}
          stroke="rgba(255,255,255,0.13)" strokeWidth="1"
          initial={reduce ? undefined : { pathLength: 0, opacity: 0 }}
          animate={reduce ? undefined : { pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.1, delay: 0.25 + i * 0.035, ease: 'easeOut' }}
        />
      ))}

      <path d={routePath} fill="none" stroke="rgba(114,230,161,0.16)" strokeWidth="6" />
      <motion.path d={routePath} fill="none" stroke="#72E6A1" strokeWidth="2" strokeLinecap="round"
        initial={reduce ? undefined : { pathLength: 0 }}
        animate={reduce ? undefined : { pathLength: [0, 1, 1, 0] }}
        transition={{ duration: 8, times: [0, 0.42, 0.78, 1], repeat: Infinity, ease: 'easeInOut', delay: 1 }}
      />

      {nodes.map((n, i) => {
        const onRoute = route.includes(i);
        const isHovered = hovered === i;
        return (
          <motion.g key={i}
            initial={reduce ? undefined : { opacity: 0, scale: 0.4 }}
            animate={reduce ? undefined : { opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: 0.1 + i * 0.05 }}
            className="cursor-pointer"
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            style={{ transformOrigin: `${n.x}px ${n.y}px` }}>
            <circle cx={n.x} cy={n.y} r={isHovered ? 7 : onRoute ? 5 : 3.5}
              fill={isHovered ? '#fff' : onRoute ? '#72E6A1' : 'rgba(255,255,255,0.4)'} />
            <circle cx={n.x} cy={n.y} r={22} fill="transparent" />
            {isHovered && (
              <g pointerEvents="none">
                <rect x={n.x - 52} y={n.y - 34} width={104} height={24} rx={6} fill="rgba(20,20,24,0.96)" stroke="rgba(255,255,255,0.14)" />
                <text x={n.x} y={n.y - 18} textAnchor="middle" fontSize="11.5" fill="#f4f5f7" fontFamily="Inter, sans-serif">
                  {n.name}
                </text>
              </g>
            )}
          </motion.g>
        );
      })}
    </svg>
  );
}

const CAPABILITIES = [
  {
    title: 'Watch it explore',
    text: 'Pick a start and a destination, then watch the queue, the visited places and the rings grow — one step at a time, with a sentence for every move.',
    to: 'visualizer' as SectionId, cta: 'Open the visualizer',
  },
  {
    title: 'Landmarks, worked out in full',
    text: 'See exactly where each distance guess comes from — every landmark measurement, and why one of them wins.',
    to: 'landmark' as SectionId, cta: 'Open the landmark lab',
  },
  {
    title: 'Step backwards, truthfully',
    text: 'The whole state is recorded at every step, so going back shows you the real earlier state — not a rewound animation.',
    to: 'theory' as SectionId, cta: 'See how it works',
  },
  {
    title: 'Breadth-First against the guess',
    text: 'Run both algorithms on the same map and compare: places checked, roads used, route length. All measured, nothing decorative.',
    to: 'analytics' as SectionId, cta: 'Compare them',
  },
];

export default function Home({ go }: { go: (s: SectionId) => void }) {
  return (
    <div>
      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="relative min-h-[clamp(580px,86vh,820px)] flex items-center overflow-hidden">
        <div className="absolute inset-0 blueprint blueprint-fade opacity-60" aria-hidden />
        <div className="absolute inset-0" aria-hidden><HeroGraph /></div>
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/70" aria-hidden />
        {/* The network is decoration; the words are the point. Fade the art
            out across the left half so nothing crosses the headline. */}
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/82 to-transparent sm:to-black/0" aria-hidden />

        <div className="relative mx-auto max-w-[1600px] w-full px-5 sm:px-8 py-16">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-3xl">
            <div className="flex items-center gap-3 mb-7">
              <span className="text-[13.5px] text-ink3 px-3 py-1.5 rounded-full bg-white/[0.06]">
                Artificial Intelligence · Informed Search
              </span>
              <span className="text-[13.5px] text-ink4">Team Deep Forge</span>
            </div>

            <h1 className="font-display text-[clamp(40px,8.5vw,86px)] leading-[0.98] tracking-[-0.04em] text-white">
              Find the route.<br />One ring at a time.
            </h1>

            <p className="mt-7 max-w-xl text-[17px] md:text-[19px] leading-relaxed text-ink3">
              Watch Breadth-First Search explore a map — checking every place one road away, then two, then three — until it
              reaches the destination. Then see how a landmark-based guess changes the search. Built for people who have
              never studied this before.
            </p>

            <div className="mt-9 flex flex-wrap gap-3">
              <button className="btn btn-primary btn-lg" onClick={() => go('visualizer')}>
                Try the visualizer <ArrowRight size={16} />
              </button>
              <button className="btn btn-lg" onClick={() => go('theory')}>
                <BookOpen size={16} /> Start from the beginning
              </button>
            </div>
          </motion.div>

          {/* Status row, in the reference's stat style. */}
          <motion.dl initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-16 grid grid-cols-2 sm:grid-cols-[auto_auto_auto_auto] gap-x-12 gap-y-6 max-w-4xl">
            {[
              ['Algorithm', 'Breadth-First Search'],
              ['Explores', 'Ring by ring'],
              ['Guess from', 'Landmarks'],
              ['Status', 'Ready'],
            ].map(([k, v], i) => (
              <div key={k}>
                <dt className="stat-label">{k}</dt>
                <dd className="text-[17px] md:text-[19px] font-medium text-white mt-1.5 tracking-[-0.02em] whitespace-nowrap">
                  {i === 3 && <span className="inline-block h-2 w-2 rounded-full bg-signal mr-2 align-middle" />}
                  {v}
                </dd>
              </div>
            ))}
          </motion.dl>
        </div>
      </section>

      {/* ── Capability grid: hairline cells, no cards ───────────────────── */}
      <section className="mx-auto max-w-[1600px] px-5 sm:px-8 py-16 md:py-24">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 border-t border-l border-white/[0.07]">
          {CAPABILITIES.map((c, i) => (
            <motion.div key={c.title}
              initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="border-r border-b border-white/[0.07] p-7 lg:p-8 flex flex-col">
              <h3 className="font-display text-[21px] leading-snug tracking-[-0.02em] mb-3">{c.title}</h3>
              <p className="text-[14.5px] leading-relaxed text-ink3 flex-1">{c.text}</p>
              <div className="mt-6">
                <ArrowLink onClick={() => go(c.to)}>{c.cta}</ArrowLink>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── The idea in one screen ──────────────────────────────────────── */}
      <section className="mx-auto max-w-[1600px] px-5 sm:px-8 pb-20 md:pb-28">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr] items-center min-w-0-all">
          <div>
            <div className="text-[13.5px] text-ink3 mb-5">The core idea</div>
            <h2 className="font-display text-[clamp(30px,5vw,52px)] leading-[1.04] tracking-[-0.035em]">
              Breadth first.<br />Then a better guess.
            </h2>
            <p className="mt-7 text-[16px] leading-relaxed text-ink3">
              Breadth-First Search is patient and thorough. It keeps a queue — first in, first out — and checks places in the
              exact order it found them. That guarantees the route with the fewest roads, but it spreads out in every
              direction, even away from the destination.
            </p>
            <p className="mt-4 text-[16px] leading-relaxed text-ink3">
              A landmark guess fixes the direction problem. Measure the real road distance from a few reference places
              first, and you can estimate how far anywhere is from the destination. Best-First Search uses that estimate to
              head straight for the goal. This site shows both — and is honest about what each one gets wrong.
            </p>
            <div className="mt-8">
              <ArrowLink onClick={() => go('landmark')}>See how a landmark guess is built</ArrowLink>
            </div>
          </div>

          <div className="panel p-7 md:p-9">
            <div className="stat-label">Breadth-First Search chooses by</div>
            <div className="tvalue text-[24px] md:text-[30px] text-white mt-3 mb-3 tracking-[-0.03em]">first in, first out</div>
            <p className="text-[14.5px] leading-relaxed text-ink3 mb-8">
              Whichever place has waited longest goes next. No guess, no road lengths — just the order places were found.
              That is why it explores in rings, and why it always finds the fewest roads.
            </p>
            <div className="h-px bg-white/[0.08] mb-8" />
            <div className="stat-label">Best-First Search chooses by the landmark guess</div>
            <div className="tvalue text-[18px] md:text-[21px] text-white mt-3 mb-3 break-words tracking-[-0.02em]">
              h(v,t) = max<sub className="text-[13.5px]">L</sub> |d(L,t) − d(L,v)|
            </div>
            <p className="text-[14.5px] leading-relaxed text-ink3">
              Exact road distances from each landmark, measured in advance with Dijkstra's algorithm. Every landmark gives
              a safe guess; the biggest of them is the most useful.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
