# DEEP FORGE — NAVIGATION LAB

**Best First Search in Route Finding with Landmark Heuristic Visualization**

Team DEEP FORGE · Birla Institute of Technology, Mesra
Artificial Intelligence / Informed Search Algorithms

An interactive laboratory for understanding how Greedy Best-First Search finds routes
through a weighted network, and where its landmark-based heuristic estimates come from.

---

## Running it

### Option A — the demo file (no setup, no internet)

Open **`dist-single/index.html`** by double-clicking it.

That one file contains the entire application: all JavaScript, CSS and fonts are inlined,
and it makes no network requests of any kind. It is the safest thing to run on a
presentation machine.

### Option B — the development server

```bash
npm install
npm run dev          # http://localhost:5173
```

### Other commands

```bash
npm run build         # production build        -> dist/
npm run build:single  # single self-contained HTML -> dist-single/index.html
npm run preview       # serve the production build
```

Requires Node.js 18 or newer.

---

## What is actually implemented

Every number displayed anywhere in the application is computed by the algorithm engine
from the graph currently on screen. There are no hard-coded results and no animations
that pretend to be computations.

| Concern | Implementation |
|---|---|
| Search | Greedy Best-First Search, `f(n) = h(n)` |
| Frontier | Binary min-heap priority queue, deterministic tie-breaking by node label |
| Landmark preprocessing | Dijkstra's algorithm from each landmark |
| Landmark heuristic | `h_L(v,t) = \|d(L,t) − d(L,v)\|`, combined as `max` over valid landmarks |
| Euclidean heuristic | Straight-line distance ÷ cost scale |
| Zero heuristic | `h = 0` (uninformed, tie-broken — *not* Dijkstra's algorithm) |
| Step history | A full state snapshot per step, so Previous Step restores real state |
| Optimal reference | Dijkstra, computed separately, shown only for comparison |

### The evaluation function

```
f(n) = h(n)
```

The accumulated path cost `g(n)` is tracked and reported so you can read the real price of
a route, but it never influences which node is selected. That is the single decision which
separates this algorithm from A* (`f = g + h`).

### The landmark bound

```
h_L(v,t) = | d(L,t) − d(L,v) |          one landmark
h(v,t)   = max over L of h_L(v,t)        several landmarks
```

Distances `d(L, ·)` are exact shortest-path distances precomputed with Dijkstra. The bound
follows from the triangle inequality and is valid because the graphs here are undirected
with non-negative weights. A landmark that cannot reach `v` or `t` yields no usable bound
and is skipped entirely, rather than contributing an infinite or misleading value.

### What this project does *not* claim

The landmark heuristic is an admissible lower bound. **Greedy Best-First Search is still
not guaranteed to return an optimal route**, and the application demonstrates that rather
than hiding it — load the *Greedy Trap* environment, where the heuristic is exact and the
search still returns a route costing 11 when one costing 3 exists. Only `f(n) = g(n) + h(n)`
would fix that.

---

## Project structure

```
src/
  lib/                     algorithm core — no React, no DOM
    graph.ts               immutable weighted undirected graph + validation
    priorityQueue.ts       binary min-heap, deterministic ordering
    dijkstra.ts            shortest paths + landmark distance table
    heuristics.ts          zero / Euclidean / landmark, with derivations
    searchEngine.ts        Greedy Best-First Search + full step snapshots
    presets.ts             built-in environments + random graph generator
    analytics.ts           measured metrics, CSV and JSON export
  state/store.ts           application state (Zustand)
  components/              canvas, toolbar, inspector, execution controls
  sections/                Home, Theory, Visualizer, Landmark Lab,
                           Analytics, Practice, About
```

The algorithm core is independent of the rendering layer: it takes a graph and returns a
trace. The animation controller only moves a cursor across that trace.

---

## The three built-in environments

| Environment | Why it exists |
|---|---|
| **City Route Network** | A congested bridge and a fast northern highway make travel cost diverge from straight-line distance. The landmark heuristic finds the optimal route (cost 90); straight-line distance is lured into a 136-cost detour. |
| **Campus Navigation** | A representative campus walking network. Sample coordinates and paths, not surveyed ones. |
| **Greedy Trap** | Six nodes, an exact heuristic, and a greedy route costing 11 against an optimal 3 — the clearest demonstration that `f(n) = h(n)` carries no optimality guarantee. |

Random graphs are generated from a spanning tree, so a route always exists before you edit it.

---

## Keyboard

| Key | Action |
|---|---|
| `Space` | Play / pause the search |
| `Shift` + `→` / `←` | Next / previous step |
| `Delete` / `Backspace` | Delete the selected node |
| Arrow keys | Nudge the selected node |
| `Tab` | Move between controls; nodes on the canvas are focusable |

Reduced-motion preferences are respected throughout.

---

## Correctness checks performed

- Returned routes are contiguous and start and end at the chosen nodes.
- Route cost never falls below the true optimum computed by Dijkstra.
- Landmark estimates are valid lower bounds at every node.
- Unreachable destinations report failure; no route is shown when none exists.
- Duplicate edges, self-loops, isolated nodes and empty landmark sets are handled explicitly.
- Traces are deterministic — the same graph always produces the same execution.
- Verified at 320 px, 390 px, 880 px and 1440 px with no horizontal overflow.

---

## Team

**Team Leader** — Prince Kumar — BTECH/15007/24

**Members**
- Shubham Kumar — BTECH/15015/24
- Mohit Raj — BTECH/15018/24
- Pranshu Ranjan — BTECH/15191/24

Developed by Team DEEP FORGE | BIT Mesra
