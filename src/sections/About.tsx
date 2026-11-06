import { motion } from 'framer-motion';
import { Cpu, ShieldCheck } from 'lucide-react';
import { SectionHead, Panel, Callout, Formula } from '../components/ui';

const TEAM = {
  leader: { name: 'Prince Kumar', roll: 'BTECH/15007/24' },
  members: [
    { name: 'Shubham Kumar', roll: 'BTECH/15015/24' },
    { name: 'Mohit Raj', roll: 'BTECH/15018/24' },
    { name: 'Pranshu Ranjan', roll: 'BTECH/15191/24' },
  ],
};

const MODULES = [
  ['Graph data model', 'Immutable weighted undirected graph, adjacency construction, parallel-edge collapsing, validation.'],
  ['Graph editor', 'Pointer-driven node placement, dragging, connection, deletion, role assignment, import and export.'],
  ['Search engine', 'Breadth-First Search (FIFO queue) and Greedy Best-First Search (f(n) = h(n)), both recording a complete state snapshot at every step in the same format.'],
  ['Heuristic engine', 'Zero, Euclidean and landmark heuristics behind one interface, with per-node caching.'],
  ['Landmark preprocessor', 'Dijkstra from every landmark, producing the exact distance table the bound is built from.'],
  ['Priority queue', 'Binary min-heap with deterministic label tie-breaking, so every trace is reproducible.'],
  ['Animation controller', 'Drives the cursor across the recorded trace. It renders history; it never computes it.'],
  ['Execution history', 'Full snapshots, which is what lets Previous Step restore a real state rather than rewind pixels.'],
  ['Analytics engine', 'Counts, costs and timings derived from the execution, plus CSV and JSON export.'],
  ['Learning mode', 'Generates questions by running the engine on fresh graphs and reading off the answers.'],
];

const STACK = [
  ['React 19 + TypeScript', 'Typed components and a typed algorithm core.'],
  ['Vite', 'Build tooling and development server.'],
  ['Tailwind CSS + CSS variables', 'The DEEP FORGE design tokens and responsive layout system.'],
  ['Framer Motion', 'Entrance animations, step transitions, layout animation.'],
  ['SVG (hand-built renderer)', 'Full control over node states, edge tracing and touch interaction.'],
  ['Recharts', 'Comparison and analytics charts.'],
  ['Lucide React', 'Icon set.'],
  ['Zustand', 'Application state, kept strictly outside the algorithm modules.'],
];

export default function About() {
  return (
    <div className="mx-auto max-w-[1600px] px-4 sm:px-6 py-10 md:py-14">
      <SectionHead index="07" kicker="About" title="Deep Forge — Navigation Lab"
        lead="An interactive lab for understanding how Breadth-First Search finds a route across a map — and what changes when the search is given a landmark-based guess instead." />

      <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr] mb-12 min-w-0-all">
        <div>
          <Panel title="The project" ticks>
            <dl className="grid sm:grid-cols-2 gap-x-6">
              {[
                ['Title', 'BFS in Route Finding with Landmark Heuristic Visualization'],
                ['Team', 'Deep Forge'],
                ['Institution', 'Birla Institute of Technology, Mesra'],
                ['Category', 'Artificial Intelligence · Informed Search'],
                ['Algorithms', 'Breadth-First Search, compared with Greedy Best-First Search'],
                ['What makes it different', 'Landmark-based distance estimation, shown step by step'],
              ].map(([k, v]) => (
                <div key={k} className="py-2 border-b border-white/[0.06]">
                  <dt className="tlabel !text-[12.5px]">{k}</dt>
                  <dd className="text-[13px] leading-snug text-ink2 mt-1">{v}</dd>
                </div>
              ))}
            </dl>
          </Panel>

          <div className="mt-3">
            <Panel title="What we set out to do" ticks>
              <p className="text-[13.5px] leading-relaxed text-ink2">
                Someone who has never studied search algorithms should be able to pick two places on a map, watch Breadth-First
                Search explore it, and explain afterwards what the queue is, why visited places are skipped, why it spreads out
                ring by ring, where a landmark guess comes from — and why neither algorithm always finds the shortest route.
              </p>
              <p className="text-[13.5px] leading-relaxed text-ink2 mt-3">
                That ruled out a presentation website. Every number on every screen is produced by running the algorithm on the
                map currently in front of you. Nothing is hard-coded, no animation pretends to be a computation, and when the
                algorithm fails the interface says so rather than inventing a route.
              </p>
            </Panel>
          </div>
        </div>

        <div>
          <Panel title="The mathematics behind it" ticks>
            <Formula note="Breadth-First Search: whichever place has waited longest goes next. No guess, no road lengths.">first in, first out</Formula>
            <Formula note="Greedy Best-First Search ranks the waiting list by the guess alone.">f(n) = h(n)</Formula>
            <Formula note="Landmark bound for a single landmark L, valid on an undirected weighted graph.">
              h<sub className="text-[13.5px]">L</sub>(v,t) = | d(L,t) − d(L,v) |
            </Formula>
            <Formula note="Several landmarks: the tightest of the valid lower bounds.">
              h(v,t) = max<sub className="text-[13.5px]">L</sub> | d(L,t) − d(L,v) |
            </Formula>
            <p className="text-[13.5px] leading-relaxed text-ink3">
              Distances d(L, ·) are exact shortest-path distances precomputed with Dijkstra's algorithm — the preprocessing step
              that the ALT family of techniques is built on. Landmark–node pairs that are unreachable contribute nothing instead
              of an infinite value.
            </p>
          </Panel>

          <div className="mt-3">
            <Callout tone="warn" title="What this project claims, and what it does not">
              The landmark heuristic is an admissible lower bound under these assumptions. Greedy Best-First Search is still not
              guaranteed to return an optimal route, and the site demonstrates that failure rather than hiding it — the Greedy
              Trap environment has an exact heuristic and still returns a route costing 11 when one costing 3 exists. A zero
              heuristic here is an uninformed tie-broken search, not Dijkstra's algorithm.
            </Callout>
          </div>
        </div>
      </div>

      {/* ── Architecture ──────────────────────────────────────────────── */}
      <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr] mb-12 min-w-0-all">
        <Panel title="How the code is organised" ticks>
          <p className="text-[13.5px] leading-relaxed text-ink3 mb-3">
            The algorithm core has no knowledge of React, the DOM or the design system. It takes a graph and returns a trace,
            which makes it testable on its own and keeps the visualisation honest.
          </p>
          <div className="space-y-1.5">
            {MODULES.map(([name, desc], i) => (
              <motion.div key={name}
                initial={{ opacity: 0, x: -6 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
                transition={{ duration: 0.3, delay: i * 0.03 }}
                className="flex items-start gap-3 px-2.5 py-2 border border-white/[0.07]">
                <span className="tvalue text-[13px] text-cyan/60 mt-[3px] shrink-0">{String(i + 1).padStart(2, '0')}</span>
                <div className="min-w-0">
                  <div className="tvalue text-[13.5px] text-ink1 tracking-[0.06em]">{name.toUpperCase()}</div>
                  <div className="text-[13.5px] leading-snug text-ink3 mt-0.5">{desc}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </Panel>

        <div className="space-y-3">
          <Panel title="Built with" ticks>
            <div className="space-y-1.5">
              {STACK.map(([name, why]) => (
                <div key={name} className="flex items-start gap-2.5 py-1.5 border-b border-white/[0.05] last:border-0">
                  <Cpu size={12} className="text-cyan mt-1 shrink-0" />
                  <div className="min-w-0">
                    <div className="tvalue text-[13.5px] text-ink1">{name}</div>
                    <div className="text-[13.5px] leading-snug text-ink3 mt-0.5">{why}</div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="What we check for correctness" ticks>
            <ul className="space-y-2">
              {[
                'Breadth-First Search is checked on hundreds of random maps: it always returns the fewest-roads route and always explores ring by ring.',
                'Returned routes are verified to be contiguous and to start and end at the chosen nodes.',
                'Route costs are checked never to fall below the true optimum computed by Dijkstra.',
                'Landmark estimates are checked to be valid lower bounds at every node.',
                'Unreachable destinations report failure; no route is ever displayed when none exists.',
                'Duplicate edges, self-loops, isolated nodes and empty landmark sets are all handled explicitly.',
                'Traces are deterministic: the same graph always produces the same execution.',
              ].map((t) => (
                <li key={t} className="flex items-start gap-2.5">
                  <ShieldCheck size={13} className="text-signal mt-0.5 shrink-0" />
                  <span className="text-[13.5px] leading-snug text-ink3">{t}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>

      {/* ── Team ──────────────────────────────────────────────────────── */}
      <Panel title="Team Deep Forge" ticks>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="panel px-3 py-3 relative overflow-hidden">
            <div className="absolute left-0 top-0 h-full w-[2px] bg-amber" />
            <div className="tlabel !text-[12.5px] text-amber">Team leader</div>
            <div className="font-display text-[15px] mt-1.5">{TEAM.leader.name}</div>
            <div className="tvalue text-[13px] text-ink3 mt-1">{TEAM.leader.roll}</div>
          </div>
          {TEAM.members.map((m) => (
            <div key={m.roll} className="panel px-3 py-3">
              <div className="tlabel !text-[12.5px]">Team member</div>
              <div className="font-display text-[15px] mt-1.5">{m.name}</div>
              <div className="tvalue text-[13px] text-ink3 mt-1">{m.roll}</div>
            </div>
          ))}
        </div>
        <p className="tlabel !text-[12.5px] mt-4">Developed by Team Deep Forge · BIT Mesra</p>
      </Panel>
    </div>
  );
}
