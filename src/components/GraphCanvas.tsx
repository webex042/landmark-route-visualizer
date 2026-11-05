import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { useApp, currentStep, nodeVisuals, heuristicValues, NODE_COLORS, NodeVisual } from '../state/store';
import { labelOf } from '../lib/graph';

const R = 13;

interface Props {
  height?: number;
  interactive?: boolean;
  compact?: boolean;
  /** When false the canvas ignores any recorded run and shows the plain graph
   *  with its roles — used where a stale trace would only confuse. */
  showSearchState?: boolean;
}

export default function GraphCanvas({ height, interactive = true, compact = false, showSearchState = true }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const s = useApp();
  const step = showSearchState ? currentStep(s) : null;
  const visuals = useMemo(
    () => (showSearchState ? nodeVisuals(s) : new Map(s.graph.nodes.map((n) => [n.id, 'idle' as const]))),
    [s.graph, s.result, s.stepIndex, showSearchState],
  );
  const hValues = useMemo(() => heuristicValues(s.graph, s.heuristic), [s.graph, s.heuristic]);

  const [drag, setDrag] = useState<{ id: string; moved: boolean } | null>(null);
  const [pan, setPan] = useState<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);
  const [hoverEdge, setHoverEdge] = useState<string | null>(null);

  /* The fitted viewBox is owned by the store, so it changes only on load,
   * generate, import or an explicit FIT — not while the user edits. */
  const vb = s.viewBox;

  /* ── Screen → world coordinate conversion (accounts for xMidYMid meet) ── */
  const toWorld = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const r = svg.getBoundingClientRect();
    const k = Math.min(r.width / vb.w, r.height / vb.h);
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
    if (s.mode === 'connect' && s.connectFromId) { /* keep rubber band alive */ }
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
      const svg = svgRef.current!;
      const r = svg.getBoundingClientRect();
      const k = Math.min(r.width / vb.w, r.height / vb.h);
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

  return (
    <svg
      ref={svgRef}
      className="graph-canvas w-full select-none"
      style={{ height: height ?? '100%', cursor: interactive ? cursor : 'default', display: 'block', background: '#090B0F' }}
      viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
      role="application"
      aria-label="Route finding graph canvas"
      onPointerDown={onBackgroundDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onWheel={onWheel}
    >
      <defs>
        <pattern id="gridFine" width="28" height="28" patternUnits="userSpaceOnUse">
          <path d="M28 0H0V28" fill="none" stroke="rgba(255,255,255,0.045)" strokeWidth="1" />
        </pattern>
        <pattern id="gridCoarse" width="140" height="140" patternUnits="userSpaceOnUse">
          <path d="M140 0H0V140" fill="none" stroke="rgba(67,217,232,0.085)" strokeWidth="1" />
        </pattern>
        <filter id="softGlow" x="-70%" y="-70%" width="240%" height="240%">
          <feGaussianBlur stdDeviation="5" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <marker id="arrowPath" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto">
          <path d="M0 0 L10 5 L0 10 z" fill="#72E6A1" />
        </marker>
      </defs>

      {s.toggles.grid && (
        <g>
          <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} fill="#090B0F" />
          <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} fill="url(#gridFine)" />
          <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} fill="url(#gridCoarse)" />
          {/* engineering measurement markings */}
          {Array.from({ length: Math.floor(vb.w / 140) }, (_, i) => {
            const gx = Math.ceil(vb.x / 140) * 140 + 140 * i;
            if (gx <= vb.x + 12 || gx >= vb.x + vb.w - 12) return null;
            return (
              <g key={`x${i}`} className="tvalue no-halo" fill="rgba(255,255,255,0.18)" fontSize="8">
                <text x={gx + 4} y={vb.y + 13}>{gx}</text>
                <line x1={gx} y1={vb.y} x2={gx} y2={vb.y + 6} stroke="rgba(67,217,232,0.35)" strokeWidth="1" />
              </g>
            );
          })}
          {Array.from({ length: Math.floor(vb.h / 140) }, (_, i) => {
            const gy = Math.ceil(vb.y / 140) * 140 + 140 * i;
            if (gy <= vb.y + 12 || gy >= vb.y + vb.h - 12) return null;
            return (
              <g key={`y${i}`} className="tvalue no-halo" fill="rgba(255,255,255,0.18)" fontSize="8">
                <text x={vb.x + 7} y={gy - 4}>{gy}</text>
                <line x1={vb.x} y1={gy} x2={vb.x + 6} y2={gy} stroke="rgba(67,217,232,0.35)" strokeWidth="1" />
              </g>
            );
          })}
        </g>
      )}

      <g transform={`translate(${s.view.x},${s.view.y}) scale(${s.view.zoom})`}>
        {/* ── Edges ──────────────────────────────────────────────────────── */}
        {s.graph.edges.map((e) => {
          const a = nodeById.get(e.a), b = nodeById.get(e.b);
          if (!a || !b) return null;
          const onPath = pathEdges.has(e.id);
          const active = activeEdges.has(e.id);
          const sel = s.selectedEdgeId === e.id;
          const hov = hoverEdge === e.id;
          const stroke = onPath ? '#72E6A1' : active ? '#43D9E8' : sel ? '#FFB547' : hov ? 'rgba(67,217,232,0.65)' : 'rgba(255,255,255,0.17)';
          const width = onPath ? 3.4 : active ? 2.2 : sel || hov ? 2 : 1.2;
          const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
          return (
            <g key={e.id}>
              <line
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke="transparent" strokeWidth={16} style={{ cursor: interactive ? 'pointer' : 'default' }}
                onPointerDown={(ev) => {
                  if (!interactive) return;
                  ev.stopPropagation();
                  if (s.mode === 'erase') s.deleteEdge(e.id); else s.selectEdge(sel ? null : e.id);
                }}
                onDoubleClick={(ev) => {
                  if (!interactive) return;
                  ev.stopPropagation();
                  const nextW = window.prompt(`Set weight for edge ${labelOf(s.graph, e.a)} ↔ ${labelOf(s.graph, e.b)}:`, String(e.weight));
                  if (nextW !== null) {
                    const val = parseFloat(nextW);
                    if (val > 0 && Number.isFinite(val)) s.updateEdgeWeight(e.id, Math.round(val * 100) / 100);
                  }
                }}
                onPointerEnter={() => setHoverEdge(e.id)}
                onPointerLeave={() => setHoverEdge((h) => (h === e.id ? null : h))}
              />
              <line
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={stroke} strokeWidth={width} strokeLinecap="round"
                filter={onPath || active ? 'url(#softGlow)' : undefined}
                strokeDasharray={active && !onPath ? '7 5' : undefined}
                className={active && !onPath ? 'animate-dash' : undefined}
                markerEnd={onPath ? 'url(#arrowPath)' : undefined}
                pointerEvents="none"
              />
              {s.toggles.weights && (
                <g pointerEvents="none">
                  <rect x={mx - 12} y={my - 8} width={24} height={15} rx={1.5}
                    fill="rgba(9,11,15,0.88)" stroke={onPath ? 'rgba(114,230,161,0.5)' : 'rgba(255,255,255,0.14)'} strokeWidth="1" />
                  <text x={mx} y={my + 3} textAnchor="middle" className="tvalue"
                    fontSize="9.5" fill={onPath ? '#A8F0C8' : 'rgba(231,236,242,0.72)'}>{e.weight}</text>
                </g>
              )}
            </g>
          );
        })}

        {/* ── Connect-mode rubber band ──────────────────────────────────── */}
        {fromNode && ghost && (
          <line x1={fromNode.x} y1={fromNode.y} x2={ghost.x} y2={ghost.y}
            stroke="#FFB547" strokeWidth="1.6" strokeDasharray="5 5" className="animate-dash" pointerEvents="none" />
        )}

        {/* ── Nodes ──────────────────────────────────────────────────────── */}
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

          return (
            <g key={n.id} transform={`translate(${n.x},${n.y})`}>
              {isLandmark && s.toggles.landmarks && (
                <g pointerEvents="none">
                  <rect x={-R - 8} y={-R - 8} width={(R + 8) * 2} height={(R + 8) * 2}
                    fill="none" stroke="#A78BFA" strokeWidth="1" strokeDasharray="4 4" transform="rotate(45)" opacity="0.75" />
                  <text x={0} y={-R - 15} textAnchor="middle" className="tvalue" fontSize="8"
                    fill="#C6B2FD" letterSpacing="1.4">LM</text>
                </g>
              )}
              {isCurrent && (
                <circle r={R} fill="none" stroke={color} strokeWidth="2" className="animate-pulseRing pulse-ring" pointerEvents="none" />
              )}
              {(isStart || isGoal) && (
                <circle r={R + 5.5} fill="none" stroke={isStart ? '#43D9E8' : '#72E6A1'} strokeWidth="1.3" opacity="0.85" pointerEvents="none" />
              )}
              {(selected || inspected || connectFrom) && (
                <rect x={-R - 11} y={-R - 11} width={(R + 11) * 2} height={(R + 11) * 2} fill="none"
                  stroke={connectFrom ? '#FFB547' : '#43D9E8'} strokeWidth="1" opacity="0.9" pointerEvents="none" />
              )}

              <circle r={R} fill={vis === 'idle' ? 'rgba(32,40,51,0.95)' : color}
                stroke={vis === 'idle' ? 'rgba(255,255,255,0.28)' : 'rgba(9,11,15,0.65)'} strokeWidth="1.4"
                filter={vis !== 'idle' ? 'url(#softGlow)' : undefined} pointerEvents="none" />

              {/* generous invisible hit area for touch */}
              <circle r={24} fill="transparent"
                tabIndex={interactive ? 0 : -1}
                role="button"
                aria-label={`Node ${n.label}${isStart ? ', start' : ''}${isGoal ? ', destination' : ''}${isLandmark ? ', landmark' : ''}${h !== undefined ? `, heuristic ${h}` : ''}`}
                style={{ cursor: interactive ? 'pointer' : 'default', outline: 'none' }}
                onPointerDown={(ev) => onNodeDown(ev, n.id)}
                onDoubleClick={(ev) => {
                  if (!interactive) return;
                  ev.stopPropagation();
                  const nextName = window.prompt(`Rename node "${n.label}" to:`, n.label);
                  if (nextName && nextName.trim()) s.rename(n.id, nextName.trim());
                }}
                onKeyDown={(ev) => {
                  if (!interactive) return;
                  if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); s.selectNode(n.id); s.setInspectNode(n.id); }
                }}
              />

              {s.toggles.ids && (
                <text x={0} y={R + 15} textAnchor="middle" className="tvalue" fontSize="10"
                  fill={vis === 'idle' ? 'rgba(231,236,242,0.6)' : color} letterSpacing="0.6" pointerEvents="none">{n.label}</text>
              )}
              {s.toggles.heuristics && h !== undefined && !compact && (
                <text x={R + 7} y={-R + 1} className="tvalue" fontSize="9.5" fill="#FFCE85" pointerEvents="none">h {h}</text>
              )}
              {g !== undefined && s.toggles.heuristics && !compact && (
                <text x={R + 7} y={-R + 12} className="tvalue" fontSize="9" fill="rgba(67,217,232,0.75)" pointerEvents="none">g {g}</text>
              )}
            </g>
          );
        })}
      </g>

      {/* ── Empty state ─────────────────────────────────────────────────── */}
      {s.graph.nodes.length === 0 && (
        <g pointerEvents="none">
          <text x={vb.x + vb.w / 2} y={vb.y + vb.h / 2 - 8} textAnchor="middle" className="tvalue" fontSize="15" fill="rgba(231,236,242,0.5)" letterSpacing="3">EMPTY WORKSPACE</text>
          <text x={vb.x + vb.w / 2} y={vb.y + vb.h / 2 + 18} textAnchor="middle" className="tvalue" fontSize="11" fill="rgba(231,236,242,0.3)" letterSpacing="1.5">SELECT “ADD NODE” AND CLICK TO PLACE LOCATIONS</text>
        </g>
      )}
    </svg>
  );
}
