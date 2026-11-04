/* ===========================================================================
 * APPLICATION STATE
 * The store owns the graph, the editor, and the animation cursor. It calls
 * into the engine but the engine knows nothing about it.
 * ========================================================================= */

import { create } from 'zustand';
import {
  Graph, addNode, removeNode, moveNode, renameNode, connect, removeEdge,
  setEdgeWeight, setStart, setGoal, toggleLandmark, validateGraph, deserialise,
} from '../lib/graph';
import { PRESETS, defaultGraph, randomGraph } from '../lib/presets';
import { HeuristicKind, makeHeuristic } from '../lib/heuristics';
import { LandmarkTable } from '../lib/dijkstra';
import { search, compareAll, SearchResult, SearchStep } from '../lib/searchEngine';

export type EditorMode = 'inspect' | 'add-node' | 'connect' | 'erase';

export interface Toggles {
  weights: boolean; heuristics: boolean; landmarks: boolean; ids: boolean; grid: boolean;
}

export interface Viewport { zoom: number; x: number; y: number }

/** World-space rectangle the canvas maps onto the panel. */
export interface ViewBox { x: number; y: number; w: number; h: number }

const BASE_BOX: ViewBox = { x: 0, y: 0, w: 1080, h: 700 };
const FIT_PAD = 76;

/** Bounding box of the graph plus breathing room. Recomputed only when the
 *  graph is loaded, generated, imported or explicitly re-fitted — never while
 *  the user is editing, so the canvas does not rescale under their cursor. */
export function fitBoxFor(g: Graph): ViewBox {
  if (!g.nodes.length) return BASE_BOX;
  const xs = g.nodes.map((n) => n.x), ys = g.nodes.map((n) => n.y);
  const x = Math.min(...xs) - FIT_PAD, y = Math.min(...ys) - FIT_PAD;
  return {
    x, y,
    w: Math.max(260, Math.max(...xs) + FIT_PAD - x),
    h: Math.max(220, Math.max(...ys) + FIT_PAD - y),
  };
}

interface AppState {
  graph: Graph;
  presetKey: string;
  mode: EditorMode;
  heuristic: HeuristicKind;

  selectedNodeId: string | null;
  connectFromId: string | null;
  selectedEdgeId: string | null;
  inspectNodeId: string | null;

  toggles: Toggles;
  view: Viewport;
  viewBox: ViewBox;

  result: SearchResult | null;
  stepIndex: number;
  playing: boolean;
  speed: number; // steps per second
  comparison: Record<HeuristicKind, SearchResult> | null;

  notice: { kind: 'error' | 'info' | 'ok'; text: string } | null;

  /* graph editing */
  setGraph: (g: Graph) => void;
  loadPreset: (key: string) => void;
  generateRandom: (n: number, density: number, landmarks: number) => void;
  resetGraph: () => void;
  clearGraph: () => void;
  importGraph: (text: string) => void;

  addNodeAt: (x: number, y: number) => void;
  dragNode: (id: string, x: number, y: number) => void;
  deleteNode: (id: string) => void;
  rename: (id: string, label: string) => void;
  connectNodes: (a: string, b: string, weight?: number) => void;
  deleteEdge: (id: string) => void;
  updateEdgeWeight: (id: string, w: number) => void;
  assignStart: (id: string) => void;
  assignGoal: (id: string) => void;
  flipLandmark: (id: string) => void;

  /* editor */
  setMode: (m: EditorMode) => void;
  selectNode: (id: string | null) => void;
  selectEdge: (id: string | null) => void;
  setInspectNode: (id: string | null) => void;
  toggle: (key: keyof Toggles) => void;
  setView: (v: Partial<Viewport>) => void;
  fitView: () => void;

  /* execution */
  setHeuristic: (k: HeuristicKind) => void;
  runSearch: () => void;
  runComparison: () => void;
  play: () => void;
  pause: () => void;
  stepForward: () => void;
  stepBack: () => void;
  gotoStep: (i: number) => void;
  resetExecution: () => void;
  setSpeed: (s: number) => void;

  notify: (kind: 'error' | 'info' | 'ok', text: string) => void;
  clearNotice: () => void;
}

const DEFAULT_TOGGLES: Toggles = { weights: true, heuristics: true, landmarks: true, ids: true, grid: true };
const DEFAULT_VIEW: Viewport = { zoom: 1, x: 0, y: 0 };

/** Any structural change invalidates a recorded run — never show a trace that
 *  no longer matches the graph on screen. */
const invalidate = () => ({ result: null, stepIndex: 0, playing: false, comparison: null });

export const useApp = create<AppState>((set, get) => ({
  graph: defaultGraph(),
  presetKey: 'city',
  mode: 'inspect',
  heuristic: 'landmark',
  selectedNodeId: null,
  connectFromId: null,
  selectedEdgeId: null,
  inspectNodeId: null,
  toggles: DEFAULT_TOGGLES,
  view: DEFAULT_VIEW,
  viewBox: BASE_BOX,
  result: null,
  stepIndex: 0,
  playing: false,
  speed: 1.6,
  comparison: null,
  notice: null,

  setGraph: (g) => set({ graph: g, viewBox: fitBoxFor(g), ...invalidate() }),

  loadPreset: (key) => {
    const p = PRESETS.find((x) => x.key === key);
    if (!p) return;
    const g = p.make();
    set({ graph: g, viewBox: fitBoxFor(g), presetKey: key, ...invalidate(), selectedNodeId: null, connectFromId: null, selectedEdgeId: null, inspectNodeId: null, view: DEFAULT_VIEW, notice: { kind: 'info', text: `Loaded environment: ${p.name}` } });
  },

  generateRandom: (n, density, landmarks) => {
    const g = randomGraph(n, density, landmarks);
    return set({ graph: g, viewBox: fitBoxFor(g), presetKey: 'random', ...invalidate(), selectedNodeId: null, connectFromId: null, inspectNodeId: null, view: DEFAULT_VIEW, notice: { kind: 'info', text: `Generated a random connected graph with ${n} nodes.` } });
  },

  resetGraph: () => { get().loadPreset(get().presetKey === 'random' ? 'city' : get().presetKey); },

  clearGraph: () => set({ graph: { nodes: [], edges: [], startId: null, goalId: null, landmarkIds: [] }, viewBox: BASE_BOX, view: DEFAULT_VIEW, presetKey: 'custom', ...invalidate(), selectedNodeId: null, connectFromId: null, inspectNodeId: null, notice: { kind: 'info', text: 'Canvas cleared. Switch to ADD NODE and click to build a graph.' } }),

  importGraph: (text) => {
    const g = deserialise(text);
    if (!g) return set({ notice: { kind: 'error', text: 'That file could not be read as a graph.' } });
    set({ graph: g, viewBox: fitBoxFor(g), view: DEFAULT_VIEW, presetKey: 'custom', ...invalidate(), notice: { kind: 'ok', text: `Imported ${g.nodes.length} nodes and ${g.edges.length} edges.` } });
  },

  addNodeAt: (x, y) => set((s) => ({ graph: addNode(s.graph, Math.round(x), Math.round(y)), presetKey: 'custom', ...invalidate() })),

  dragNode: (id, x, y) => set((s) => ({ graph: moveNode(s.graph, id, Math.round(x), Math.round(y)) })),

  deleteNode: (id) => set((s) => ({
    graph: removeNode(s.graph, id), presetKey: 'custom', ...invalidate(),
    selectedNodeId: s.selectedNodeId === id ? null : s.selectedNodeId,
    inspectNodeId: s.inspectNodeId === id ? null : s.inspectNodeId,
    connectFromId: s.connectFromId === id ? null : s.connectFromId,
  })),

  rename: (id, label) => set((s) => ({ graph: renameNode(s.graph, id, label), ...invalidate() })),

  connectNodes: (a, b, weight) => {
    const { graph } = get();
    const { graph: next, error } = connect(graph, a, b, weight);
    if (error) return set({ notice: { kind: 'error', text: error }, connectFromId: null });
    set({ graph: next, presetKey: 'custom', ...invalidate(), connectFromId: null });
  },

  deleteEdge: (id) => set((s) => ({ graph: removeEdge(s.graph, id), presetKey: 'custom', ...invalidate(), selectedEdgeId: null })),

  updateEdgeWeight: (id, w) => {
    if (!(w > 0) || !Number.isFinite(w)) return set({ notice: { kind: 'error', text: 'Edge weight must be a number greater than zero.' } });
    set((s) => ({ graph: setEdgeWeight(s.graph, id, w), ...invalidate() }));
  },

  assignStart: (id) => set((s) => ({ graph: setStart(s.graph, id), ...invalidate() })),
  assignGoal: (id) => set((s) => ({ graph: setGoal(s.graph, id), ...invalidate() })),
  flipLandmark: (id) => set((s) => ({ graph: toggleLandmark(s.graph, id), ...invalidate() })),

  setMode: (m) => set({ mode: m, connectFromId: null, selectedEdgeId: null }),
  selectNode: (id) => set({ selectedNodeId: id, inspectNodeId: id ?? get().inspectNodeId }),
  selectEdge: (id) => set({ selectedEdgeId: id }),
  setInspectNode: (id) => set({ inspectNodeId: id }),
  toggle: (key) => set((s) => ({ toggles: { ...s.toggles, [key]: !s.toggles[key] } })),
  setView: (v) => set((s) => ({ view: { ...s.view, ...v } })),
  fitView: () => set((st) => ({ view: DEFAULT_VIEW, viewBox: fitBoxFor(st.graph) })),

  setHeuristic: (k) => set({ heuristic: k, ...invalidate() }),

  runSearch: () => {
    const { graph, heuristic } = get();
    const v = validateGraph(graph);
    if (!v.ok) return set({ notice: { kind: 'error', text: v.errors[0] } });
    const result = search(graph, heuristic);
    set({
      result, stepIndex: 0, playing: true,
      notice: result.success ? null : { kind: 'error', text: result.failureReason ?? 'No route found.' },
    });
  },

  runComparison: () => {
    const { graph } = get();
    const v = validateGraph(graph);
    if (!v.ok) return set({ notice: { kind: 'error', text: v.errors[0] } });
    set({ comparison: compareAll(graph), notice: { kind: 'ok', text: 'All three heuristics ran on this graph, start and destination.' } });
  },

  play: () => {
    const { result, stepIndex } = get();
    if (!result) return get().runSearch();
    if (stepIndex >= result.steps.length - 1) return set({ stepIndex: 0, playing: true });
    set({ playing: true });
  },
  pause: () => set({ playing: false }),
  stepForward: () => {
    const { result, stepIndex } = get();
    if (!result) return get().runSearch();
    set({ stepIndex: Math.min(stepIndex + 1, result.steps.length - 1), playing: false });
  },
  stepBack: () => set((s) => ({ stepIndex: Math.max(0, s.stepIndex - 1), playing: false })),
  gotoStep: (i) => set((s) => ({ stepIndex: s.result ? Math.max(0, Math.min(i, s.result.steps.length - 1)) : 0, playing: false })),
  resetExecution: () => set({ result: null, stepIndex: 0, playing: false }),
  setSpeed: (speed) => set({ speed }),

  notify: (kind, text) => set({ notice: { kind, text } }),
  clearNotice: () => set({ notice: null }),
}));

/* ── Derived selectors ───────────────────────────────────────────────────── */

export const currentStep = (s: AppState): SearchStep | null =>
  s.result ? s.result.steps[Math.min(s.stepIndex, s.result.steps.length - 1)] ?? null : null;

export type NodeVisual = 'start' | 'goal' | 'current' | 'frontier' | 'explored' | 'path' | 'idle';

export const NODE_COLORS: Record<NodeVisual, string> = {
  start: '#43D9E8', goal: '#72E6A1', current: '#FFB547', frontier: '#F2DF6B',
  explored: '#A78BFA', path: '#72E6A1', idle: '#8A95A3',
};

/** Visual state of every node at the current animation cursor. */
export function nodeVisuals(s: AppState): Map<string, NodeVisual> {
  const out = new Map<string, NodeVisual>();
  const step = currentStep(s);
  for (const n of s.graph.nodes) out.set(n.id, 'idle');
  if (step) {
    for (const id of step.explored) out.set(id, 'explored');
    for (const f of step.frontier) out.set(f.nodeId, 'frontier');
    if (step.path) for (const id of step.path) out.set(id, 'path');
    if (step.currentId && step.phase !== 'success') out.set(step.currentId, 'current');
  }
  if (s.graph.startId) out.set(s.graph.startId, step?.path?.includes(s.graph.startId) ? 'path' : 'start');
  if (s.graph.goalId && (!step || !step.path)) out.set(s.graph.goalId, 'goal');
  else if (s.graph.goalId) out.set(s.graph.goalId, 'path');
  return out;
}

/** h(n) for every node under the active heuristic, for the on-canvas labels. */
export function heuristicValues(graph: Graph, kind: HeuristicKind): Map<string, number> {
  const out = new Map<string, number>();
  if (!graph.goalId) return out;
  const table = kind === 'landmark' ? new LandmarkTable(graph, graph.landmarkIds) : undefined;
  const h = makeHeuristic(kind, graph, graph.goalId, table);
  for (const n of graph.nodes) out.set(n.id, h(n.id));
  return out;
}
