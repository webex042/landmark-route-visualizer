import { useCallback, useMemo, useRef, useState, useEffect, useLayoutEffect } from 'react';
import { useApp, currentStep, nodeVisuals, heuristicValues, ringDepths, NODE_COLORS, NodeVisual, ViewBox } from '../state/store';
import { labelOf } from '../lib/graph';

/* Nodes carry their own name now, so they have to be big enough to hold a
 * couple of characters legibly at a glance — and big enough to be a
 * comfortable touch target on a phone. */
const R = 19;

interface Props {
  height?: number;
  interactive?: boolean;
  compact?: boolean;
  /** When false the canvas ignores any recorded run and shows the plain graph
   *  with its roles — used where a stale trace would only confuse. */
  showSearchState?: boolean;
}

/** Grows the fitted box to the container's aspect ratio so the drawing fills
 *  the panel. Without this, SVG's `meet` letterboxes a wide graph inside a
 *  tall phone panel and the network shrinks into a thin band in the middle. */
function fitToAspect(box: ViewBox, w: number, h: number): ViewBox {
  if (!w || !h) return box;
  const target = w / h;
  const current = box.w / box.h;
  if (Math.abs(target - current) < 1e-4) return box;
  if (target > current) {
    const nw = box.h * target;
    return { x: box.x - (nw - box.w) / 2, y: box.y, w: nw, h: box.h };
  }
  const nh = box.w / target;
  return { x: box.x, y: box.y - (nh - box.h) / 2, w: box.w, h: nh };
}

export default function GraphCanvas({ height, interactive = true, compact = false, showSearchState = true }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const s = useApp();
  const step = showSearchState ? currentStep(s) : null;
  const visuals = useMemo(
    () => (showSearchState ? nodeVisuals(s) : new Map(s.graph.nodes.map((n) => [n.id, 'idle' as const]))),
    [s.graph, s.result, s.stepIndex, showSearchState],
  );
  const isBFS = s.algorithm === 'bfs';
  /* Under Breadth-First the guess is still worth showing — it is the
     project's landmark topic — but it plays no part in the search, so it is
     always the landmark guess and always drawn greyed-out. */
  const hValues = useMemo(() => heuristicValues(s.graph, isBFS ? 'landmark' : s.heuristic), [s.graph, s.heuristic, isBFS]);
  const rings = useMemo(() => ringDepths(s.graph, step), [s.graph, step]);

  const [drag, setDrag] = useState<{ id: string; moved: boolean } | null>(null);
  const [pan, setPan] = useState<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);
  const [hoverEdge, setHoverEdge] = useState<string | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  /* Track the rendered size so the viewBox can match it. */
  useLayoutEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setBox({ w: r.width, h: r.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* The fitted viewBox is owned by the store, so it changes only on load,
   * generate, import or an explicit FIT — not while the user edits. Here it
   * is only stretched to the panel's shape. */
  const vb = useMemo(() => fitToAspect(s.viewBox, box.w, box.h), [s.viewBox, box.w, box.h]);

  /* Scale factor: with an aspect-matched viewBox both axes share one scale. */
  const scale = box.w && vb.w ? box.w / vb.w : 1;

  /* ── Screen → world coordinate conversion ─────────────────────────────── */
  const toWorld = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const r = svg.getBoundingClientRect();
    const k = Math.min(r.width / vb.w, r.height / vb.h) || 1;
    const vx = vb.x + (clientX - r.left - (r.width - vb.w * k) / 2) / k;
    const vy = vb.y + (clientY - r.top - (r.height - vb.h * k) / 2) / k;
    return { x: (vx - s.view.x) / s.view.zoom, y: (vy - s.view.y) / s.view.zoom };
  }, [s.view, vb]);

  const nodeById = useMemo(() => new Map(s.graph.nodes.map((n) => [n.id, n])), [s.graph.nodes]);

  /* ── Pointer handling ──────────────────────────────────────────────────── */
  const onBackgroundDown = (e: React.PointerEvent) => {
    if (!interactive) return;
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const w = toWorld(e.clientX, e.clientY);
    if (s.mode === 'add-node') { s.addNodeAt(w.x, w.y); return; }
    s.selectEdge(null);
    setPan({ x: e.clientX, y: e.clientY, vx: s.view.x, vy: s.view.y });
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  };

  const onNodeDown = (e: React.PointerEvent, id: string) => {
    if (!interactive) return;
    e.stopPropagation();
    if (s.mode === 'erase') { s.deleteNode(id); return; }
    if (s.mode === 'connect') {
      if (!s.connectFromId) { useApp.setState({ connectFromId: id }); s.setInspectNode(id); }
      else if (s.connectFromId === id) { useApp.setState({ connectFromId: null }); }
      else s.connectNodes(s.connectFromId, id);
      return;
    }
    setDrag({ id, moved: false });
    s.selectNode(id);
    svgRef.current?.setPointerCapture?.(e.pointerId);
  };

  const onMove = (e: React.PointerEvent) => {
    if (!interactive) return;
    const w = toWorld(e.clientX, e.clientY);
    if (s.mode === 'connect' && s.connectFromId) setGhost(w);
    if (drag) {
      s.dragNode(drag.id, Math.round(w.x), Math.round(w.y));
      if (!drag.moved) setDrag({ ...drag, moved: true });
      return;
    }
    if (pan) {
      const k = scale || 1;
      s.setView({ x: pan.vx + (e.clientX - pan.x) / k, y: pan.vy + (e.clientY - pan.y) / k });
    }
  };

  const onUp = () => { setDrag(null); setPan(null); };

  const onWheel = (e: React.WheelEvent) => {
    if (!interactive) return;
    e.preventDefault();
    const w = toWorld(e.clientX, e.clientY);
    const next = Math.max(0.35, Math.min(3.2, s.view.zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
    s.setView({ zoom: next, x: s.view.x + (w.x * s.view.zoom - w.x * next), y: s.view.y + (w.y * s.view.zoom - w.y * next) });
  };

  /* ── Keyboard: delete / nudge the selected node ───────────────────────── */
  useEffect(() => {
    if (!interactive) return;
    const onKey = (e: KeyboardEvent) => {
      const id = s.selectedNodeId;
      const target = e.target as HTMLElement;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (!id) return;
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); s.deleteNode(id); return; }
      const nudge: Record<string, [number, number]> = { ArrowUp: [0, -8], ArrowDown: [0, 8], ArrowLeft: [-8, 0], ArrowRight: [8, 0] };
      const d = nudge[e.key];
      if (d) {
        const n = nodeById.get(id);
        if (n) { e.preventDefault(); s.dragNode(id, n.x + d[0], n.y + d[1]); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [interactive, s.selectedNodeId, nodeById]);

  const activeEdges = new Set(step?.activeEdgeIds ?? []);
  const pathEdges = new Set(step?.pathEdgeIds ?? []);
  const fromNode = s.connectFromId ? nodeById.get(s.connectFromId) : null;

  const cursor = s.mode === 'add-node' ? 'crosshair' : s.mode === 'erase' ? 'not-allowed' : s.mode === 'connect' ? 'cell' : drag ? 'grabbing' : 'grab';

  /* On-canvas type has to survive two separate shrinkings: the user's zoom,
     and the viewBox being mapped into a small panel. `k` is the second one.
     Dividing by both keeps a 12px label rendering at roughly 12 real pixels
     on a phone and on a desktop alike. */
  const z = s.view.zoom;
  const k = scale || 1;
  const fs = (px: number) => px / (z * Math.max(0.5, Math.min(1.15, k)));

  /* When the drawing is squeezed into a small panel there is simply not room
     for full place names, estimate chips and role captions at a readable
     size. Rather than shrink them into illegibility we drop to a compact
     representation: a legible badge inside each circle, details on tap. */
  const tight = k < 0.62;
  const showChips = s.toggles.heuristics && !compact && !tight;

  return (
    <svg
      ref={svgRef}
      className="graph-canvas w-full select-none"
      style={{ height: height ?? '100%', cursor: interactive ? cursor : 'default', display: 'block', background: '#090B0F' }}
      viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
      preserveAspectRatio="xMidYMid meet"
      role="application"
      aria-label="Route finding map. Each circle is a place, each line is a road."
      onPointerDown={onBackgroundDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onWheel={onWheel}
    >
      <defs>
        <pattern id="gridFine" width="32" height="32" patternUnits="userSpaceOnUse">
          <path d="M32 0H0V32" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
        </pattern>
        <pattern id="gridCoarse" width="160" height="160" patternUnits="userSpaceOnUse">
          <path d="M160 0H0V160" fill="none" stroke="rgba(67,217,232,0.07)" strokeWidth="1" />
        </pattern>
        <filter id="softGlow" x="-70%" y="-70%" width="240%" height="240%">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <marker id="arrowPath" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="4.5" markerHeight="4.5" orient="auto">
          <path d="M0 0 L10 5 L0 10 z" fill="#72E6A1" />
        </marker>
      </defs>

      {/* Background: always painted, so panning never reveals the page behind. */}
      <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} fill="#090B0F" />
      {s.toggles.grid && (
        <g pointerEvents="none">
          <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} fill="url(#gridFine)" />
          <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} fill="url(#gridCoarse)" />
        </g>
      )}

      <g transform={`translate(${s.view.x},${s.view.y}) scale(${s.view.zoom})`}>
        {/* ── Roads ──────────────────────────────────────────────────────── */}
        {s.graph.edges.map((e) => {
          const a = nodeById.get(e.a), b = nodeById.get(e.b);
          if (!a || !b) return null;
          const onPath = pathEdges.has(e.id);
          const active = activeEdges.has(e.id);
          const sel = s.selectedEdgeId === e.id;
          const hov = hoverEdge === e.id;
          const stroke = onPath ? '#72E6A1' : active ? '#43D9E8' : sel ? '#FFB547' : hov ? 'rgba(67,217,232,0.7)' : 'rgba(255,255,255,0.22)';
          const width = onPath ? 4.5 : active ? 3 : sel || hov ? 2.4 : 1.6;
          const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
          const wLabel = String(e.weight);
          const boxW = fs(Math.max(26, wLabel.length * 8.5 + 12));
          return (
            <g key={e.id}>
              <line
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke="transparent" strokeWidth={20} style={{ cursor: interactive ? 'pointer' : 'default' }}
                onPointerDown={(ev) => {
                  if (!interactive) return;
                  ev.stopPropagation();
                  if (s.mode === 'erase') s.deleteEdge(e.id); else s.selectEdge(sel ? null : e.id);
                }}
                onDoubleClick={(ev) => {
                  if (!interactive) return;
                  ev.stopPropagation();
                  const nextW = window.prompt(`How long is the road between ${labelOf(s.graph, e.a)} and ${labelOf(s.graph, e.b)}?`, String(e.weight));
                  if (nextW !== null) {
                    const val = parseFloat(nextW);
                    if (val > 0 && Number.isFinite(val)) s.updateEdgeWeight(e.id, Math.round(val * 100) / 100);
                  }
                }}
                onPointerEnter={() => setHoverEdge(e.id)}
                onPointerLeave={() => setHoverEdge((h) => (h === e.id ? null : h))}
              />
              <line
                className="edge-line"
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={stroke} strokeWidth={width} strokeLinecap="round"
                filter={onPath ? 'url(#softGlow)' : undefined}
                strokeDasharray={active && !onPath ? '9 6' : undefined}
                style={active && !onPath ? { animation: 'flowDash 1.1s linear infinite' } : undefined}
                markerEnd={onPath ? 'url(#arrowPath)' : undefined}
                pointerEvents="none"
              />
              {s.toggles.weights && (
                <g pointerEvents="none">
                  <rect x={mx - boxW / 2} y={my - fs(10)} width={boxW} height={fs(20)} rx={2}
                    fill="rgba(9,11,15,0.92)" stroke={onPath ? 'rgba(114,230,161,0.6)' : 'rgba(255,255,255,0.18)'} strokeWidth="1" />
                  <text x={mx} y={my + fs(4.5)} textAnchor="middle" className="tvalue no-halo"
                    fontSize={fs(12)} fontWeight="500" fill={onPath ? '#A8F0C8' : 'rgba(236,241,247,0.85)'}>{e.weight}</text>
                </g>
              )}
            </g>
          );
        })}

        {/* ── Connect-mode rubber band ──────────────────────────────────── */}
        {fromNode && ghost && (
          <line x1={fromNode.x} y1={fromNode.y} x2={ghost.x} y2={ghost.y}
            stroke="#FFB547" strokeWidth="2" strokeDasharray="7 6" className="animate-dash" pointerEvents="none" />
        )}

        {/* ── Places ─────────────────────────────────────────────────────── */}
        {s.graph.nodes.map((n) => {
          const vis: NodeVisual = visuals.get(n.id) ?? 'idle';
          const color = NODE_COLORS[vis];
          const isLandmark = s.graph.landmarkIds.includes(n.id);
          const isStart = s.graph.startId === n.id;
          const isGoal = s.graph.goalId === n.id;
          const isCurrent = vis === 'current';
          const selected = s.selectedNodeId === n.id;
          const inspected = s.inspectNodeId === n.id;
          const connectFrom = s.connectFromId === n.id;
          const h = hValues.get(n.id);
          const g = step?.gCost?.[n.id];

          /* A short label (A, B, S, G) reads best inside the circle. A real
             place name does not fit, so on a roomy canvas it goes underneath
             and the circle stays clean; on a cramped one it collapses to
             initials inside, which stay legible where a full name would not.
             "MAIN GATE" becomes MG rather than a blunt truncation. */
          const words = n.label.trim().split(/\s+/);
          const initials = words.length > 1
            ? words.slice(0, 2).map((w) => w[0]).join('')
            : n.label.slice(0, 2);
          const shortLabel = n.label.length <= 4;
          const insideText = shortLabel ? n.label : tight ? initials : null;
          const belowText = shortLabel || tight ? null : n.label;

          const filled = vis !== 'idle';
          const roleRing = isStart ? '#43D9E8' : isGoal ? '#72E6A1' : null;

          return (
            <g key={n.id} transform={`translate(${n.x},${n.y})`}>
              {isLandmark && s.toggles.landmarks && (
                <g pointerEvents="none">
                  <rect x={-R - 9} y={-R - 9} width={(R + 9) * 2} height={(R + 9) * 2}
                    fill="none" stroke="#A78BFA" strokeWidth="1.4" strokeDasharray="5 4" transform="rotate(45)" opacity="0.85" />
                </g>
              )}
              {isCurrent && (
                <circle r={R} fill="none" stroke={color} strokeWidth="2.5" className="animate-pulseRing pulse-ring" pointerEvents="none" />
              )}
              {roleRing && (
                <circle r={R + 6} fill="none" stroke={roleRing} strokeWidth="1.8" opacity="0.9" pointerEvents="none" />
              )}
              {(selected || inspected || connectFrom) && (
                <rect x={-R - 12} y={-R - 12} width={(R + 12) * 2} height={(R + 12) * 2} fill="none"
                  stroke={connectFrom ? '#FFB547' : '#43D9E8'} strokeWidth="1.4" opacity="0.95" pointerEvents="none" />
              )}

              <circle
                className="node-body"
                r={R}
                fill={filled ? color : '#28313E'}
                stroke={filled ? 'rgba(9,11,15,0.6)' : 'rgba(255,255,255,0.4)'}
                strokeWidth="1.8"
                filter={filled && vis !== 'frontier' ? 'url(#softGlow)' : undefined}
                pointerEvents="none"
              />

              {/* Dark glyph on a filled node, light on an untouched one, so
                  contrast holds in either state. */}
              {insideText && (
                <text y={fs(5)} textAnchor="middle" className="tvalue in-node"
                  fontSize={fs(14)} fontWeight="600"
                  fill={filled ? '#0A0D12' : 'rgba(236,241,247,0.92)'} pointerEvents="none">{insideText}</text>
              )}

              {/* generous invisible hit area for touch */}
              <circle r={Math.max(28, R + 10)} fill="transparent"
                tabIndex={interactive ? 0 : -1}
                role="button"
                aria-label={`${n.label}${isStart ? ', start' : ''}${isGoal ? ', destination' : ''}${isLandmark ? ', landmark' : ''}${h !== undefined ? `, estimated ${h} from the destination` : ''}`}
                style={{ cursor: interactive ? 'pointer' : 'default', outline: 'none' }}
                onPointerDown={(ev) => onNodeDown(ev, n.id)}
                onDoubleClick={(ev) => {
                  if (!interactive) return;
                  ev.stopPropagation();
                  const nextName = window.prompt(`Rename "${n.label}" to:`, n.label);
                  if (nextName && nextName.trim()) s.rename(n.id, nextName.trim());
                }}
                onKeyDown={(ev) => {
                  if (!interactive) return;
                  if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); s.selectNode(n.id); s.setInspectNode(n.id); }
                }}
              />

              {s.toggles.ids && belowText && (
                <text x={0} y={R + fs(17)} textAnchor="middle" className="tvalue"
                  fontSize={fs(12)} fontWeight="500"
                  fill={filled ? color : 'rgba(236,241,247,0.72)'} letterSpacing={fs(0.4)} pointerEvents="none">{belowText}</text>
              )}

              {/* Readable chips beside the node.
                  Best-First: the guess it ranks by, and distance so far.
                  Breadth-First: the ring (roads from the start) it is in,
                  plus the landmark guess, greyed and dashed — on show, but
                  visibly not part of the decision. */}
              {showChips && !isBFS && h !== undefined && (
                <g pointerEvents="none" transform={`translate(${R + fs(6)}, ${-R - fs(2)})`}>
                  <rect x={0} y={0} width={fs(62)} height={fs(18)} rx={fs(3)}
                    fill="rgba(0,0,0,0.92)" stroke="rgba(255,181,71,0.5)" strokeWidth={fs(1)} />
                  <text x={fs(5)} y={fs(13)} className="tvalue no-halo" fontSize={fs(11)} fill="#FFCE85">
                    {`${h} to go`}
                  </text>
                </g>
              )}
              {showChips && !isBFS && g !== undefined && (
                <g pointerEvents="none" transform={`translate(${R + fs(6)}, ${-R + fs(18)})`}>
                  <rect x={0} y={0} width={fs(62)} height={fs(18)} rx={fs(3)}
                    fill="rgba(0,0,0,0.92)" stroke="rgba(67,217,232,0.42)" strokeWidth={fs(1)} />
                  <text x={fs(5)} y={fs(13)} className="tvalue no-halo" fontSize={fs(11)} fill="#8FE4F0">
                    {`${g} so far`}
                  </text>
                </g>
              )}
              {showChips && isBFS && rings.has(n.id) && (
                <g pointerEvents="none" transform={`translate(${R + fs(6)}, ${-R - fs(2)})`}>
                  <rect x={0} y={0} width={fs(54)} height={fs(18)} rx={fs(9)}
                    fill="rgba(67,217,232,0.16)" stroke="rgba(67,217,232,0.6)" strokeWidth={fs(1)} />
                  <text x={fs(27)} y={fs(13)} textAnchor="middle" className="tvalue no-halo" fontSize={fs(11)} fill="#9FEFF8">
                    {`ring ${rings.get(n.id)}`}
                  </text>
                </g>
              )}
              {showChips && isBFS && h !== undefined && s.graph.landmarkIds.length > 0 && (
                <g pointerEvents="none" opacity={0.75}
                  transform={`translate(${R + fs(6)}, ${rings.has(n.id) ? -R + fs(18) : -R - fs(2)})`}>
                  <rect x={0} y={0} width={fs(66)} height={fs(18)} rx={fs(3)}
                    fill="rgba(0,0,0,0.85)" stroke="rgba(255,255,255,0.22)" strokeWidth={fs(1)} strokeDasharray={`${fs(3)} ${fs(2)}`} />
                  <text x={fs(5)} y={fs(13)} className="tvalue no-halo" fontSize={fs(10.5)} fill="rgba(244,245,247,0.55)">
                    {`guess ${h}`}
                  </text>
                </g>
              )}

              {!tight && isStart && (
                <text x={0} y={-R - fs(13)} textAnchor="middle" className="tvalue"
                  fontSize={fs(10.5)} fill="#43D9E8" letterSpacing={fs(1.2)} pointerEvents="none">START</text>
              )}
              {!tight && isGoal && (
                <text x={0} y={-R - fs(13)} textAnchor="middle" className="tvalue"
                  fontSize={fs(10.5)} fill="#72E6A1" letterSpacing={fs(1.2)} pointerEvents="none">DESTINATION</text>
              )}
              {!tight && isLandmark && s.toggles.landmarks && !isStart && !isGoal && (
                <text x={0} y={-R - fs(13)} textAnchor="middle" className="tvalue"
                  fontSize={fs(10.5)} fill="#C6B2FD" letterSpacing={fs(1.2)} pointerEvents="none">LANDMARK</text>
              )}
            </g>
          );
        })}
      </g>

      {/* ── Empty state ─────────────────────────────────────────────────── */}
      {s.graph.nodes.length === 0 && (
        <g pointerEvents="none">
          <text x={vb.x + vb.w / 2} y={vb.y + vb.h / 2 - 10} textAnchor="middle" className="tvalue" fontSize="19" fill="rgba(236,241,247,0.6)" letterSpacing="3">NOTHING HERE YET</text>
          <text x={vb.x + vb.w / 2} y={vb.y + vb.h / 2 + 22} textAnchor="middle" className="tvalue" fontSize="13" fill="rgba(236,241,247,0.4)" letterSpacing="1">CHOOSE “ADD PLACE”, THEN CLICK TO DROP ONE IN</text>
        </g>
      )}
    </svg>
  );
}
