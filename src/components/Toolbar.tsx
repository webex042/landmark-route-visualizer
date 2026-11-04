import { useState } from 'react';
import {
  MousePointer2, PlusCircle, Link2, Eraser, ZoomIn, ZoomOut, Maximize2,
  Shuffle, RotateCcw, Trash2, Flag, MapPin, Diamond, Download, Upload,
} from 'lucide-react';
import { useApp, EditorMode } from '../state/store';
import { PRESETS } from '../lib/presets';
import { serialise, validateGraph } from '../lib/graph';
import { download, stamp } from '../lib/analytics';
import { Chip } from './ui';

const MODES: { id: EditorMode; label: string; icon: typeof MousePointer2; help: string }[] = [
  { id: 'inspect', label: 'SELECT', icon: MousePointer2, help: 'Click a node to inspect it, drag to move it, click an edge to edit its weight.' },
  { id: 'add-node', label: 'ADD NODE', icon: PlusCircle, help: 'Click anywhere on the canvas to place a new location.' },
  { id: 'connect', label: 'CONNECT', icon: Link2, help: 'Click two nodes to connect them. The weight defaults to the geometric cost and stays editable.' },
  { id: 'erase', label: 'DELETE', icon: Eraser, help: 'Click a node or an edge to remove it.' },
];

export default function Toolbar() {
  const s = useApp();
  const [n, setN] = useState(12);
  const [density, setDensity] = useState(0.55);
  const [lm, setLm] = useState(2);
  const v = validateGraph(s.graph);

  const importFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => s.importGraph(String(reader.result));
    reader.onerror = () => s.notify('error', 'That file could not be read.');
    reader.readAsText(file);
  };

  const activeHelp = MODES.find((m) => m.id === s.mode)?.help;

  return (
    <div className="space-y-3">
      {/* ── Modes ─────────────────────────────────────────────────────── */}
      <div>
        <div className="tlabel mb-2">EDITOR TOOL</div>
        <div className="grid grid-cols-2 gap-1.5">
          {MODES.map((m) => {
            const Icon = m.icon;
            return (
              <Chip key={m.id} active={s.mode === m.id} onClick={() => s.setMode(m.id)} title={m.help}>
                <Icon size={13} /> {m.label}
              </Chip>
            );
          })}
        </div>
        {activeHelp && <p className="mt-2 text-[11.5px] leading-snug text-white/45">{activeHelp}</p>}
        {s.mode === 'connect' && s.connectFromId && (
          <p className="mt-1.5 tvalue text-[10.5px] text-amber">FROM: {s.graph.nodes.find((x) => x.id === s.connectFromId)?.label} — now click the second node</p>
        )}
      </div>

      {/* ── Role assignment ───────────────────────────────────────────── */}
      <div className="hairline-t pt-3">
        <div className="tlabel mb-2">ASSIGN ROLE TO SELECTED NODE</div>
        {s.selectedNodeId ? (
          <div className="grid grid-cols-3 gap-1.5">
            <Chip active={s.graph.startId === s.selectedNodeId} onClick={() => s.assignStart(s.selectedNodeId!)}><MapPin size={12} /> START</Chip>
            <Chip active={s.graph.goalId === s.selectedNodeId} onClick={() => s.assignGoal(s.selectedNodeId!)}><Flag size={12} /> GOAL</Chip>
            <Chip active={s.graph.landmarkIds.includes(s.selectedNodeId)} onClick={() => s.flipLandmark(s.selectedNodeId!)}><Diamond size={12} /> LANDMARK</Chip>
          </div>
        ) : (
          <p className="text-[11.5px] text-white/40">No node selected. Click a node on the canvas first.</p>
        )}
      </div>

      {/* ── View controls ─────────────────────────────────────────────── */}
      <div className="hairline-t pt-3">
        <div className="tlabel mb-2">VIEW</div>
        <div className="flex flex-wrap gap-1.5">
          <Chip onClick={() => s.setView({ zoom: Math.min(3.2, s.view.zoom * 1.2) })} title="Zoom in"><ZoomIn size={13} /></Chip>
          <Chip onClick={() => s.setView({ zoom: Math.max(0.35, s.view.zoom / 1.2) })} title="Zoom out"><ZoomOut size={13} /></Chip>
          <Chip onClick={s.fitView} title="Fit graph to screen"><Maximize2 size={13} /> FIT</Chip>
          <span className="tvalue text-[10px] text-white/35 self-center ml-1">{(s.view.zoom * 100).toFixed(0)}%</span>
        </div>
      </div>

      {/* ── Layer toggles ─────────────────────────────────────────────── */}
      <div className="hairline-t pt-3">
        <div className="tlabel mb-2">LAYERS</div>
        <div className="grid grid-cols-2 gap-1.5">
          <Chip active={s.toggles.weights} onClick={() => s.toggle('weights')}>EDGE WEIGHTS</Chip>
          <Chip active={s.toggles.heuristics} onClick={() => s.toggle('heuristics')}>h / g LABELS</Chip>
          <Chip active={s.toggles.landmarks} onClick={() => s.toggle('landmarks')}>LANDMARKS</Chip>
          <Chip active={s.toggles.ids} onClick={() => s.toggle('ids')}>NODE IDS</Chip>
          <Chip active={s.toggles.grid} onClick={() => s.toggle('grid')}>GRID</Chip>
        </div>
      </div>

      {/* ── Environments ──────────────────────────────────────────────── */}
      <div className="hairline-t pt-3">
        <div className="tlabel mb-2">ENVIRONMENT</div>
        <div className="space-y-1.5">
          {PRESETS.map((p) => (
            <button key={p.key} onClick={() => s.loadPreset(p.key)}
              className={`w-full text-left px-2.5 py-2 border transition-colors ${s.presetKey === p.key ? 'border-cyan/50 bg-cyan/[0.07]' : 'border-white/[0.08] hover:border-white/20'}`}>
              <div className={`tvalue text-[11px] tracking-[0.1em] ${s.presetKey === p.key ? 'text-cyan' : 'text-white/75'}`}>{p.name.toUpperCase()}</div>
              <div className="text-[11px] leading-snug text-white/40 mt-1">{p.note}</div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Random generator ──────────────────────────────────────────── */}
      <div className="hairline-t pt-3">
        <div className="tlabel mb-2">RANDOM GRAPH</div>
        <label className="block mb-2">
          <span className="tlabel !text-[9px]">NODES — {n}</span>
          <input type="range" min={4} max={40} value={n} onChange={(e) => setN(+e.target.value)} className="mt-1.5" />
        </label>
        <label className="block mb-2">
          <span className="tlabel !text-[9px]">EXTRA EDGE DENSITY — {density.toFixed(2)}</span>
          <input type="range" min={0} max={1.4} step={0.05} value={density} onChange={(e) => setDensity(+e.target.value)} className="mt-1.5" />
        </label>
        <label className="block mb-2.5">
          <span className="tlabel !text-[9px]">LANDMARKS — {lm}</span>
          <input type="range" min={0} max={5} value={lm} onChange={(e) => setLm(+e.target.value)} className="mt-1.5" />
        </label>
        <button className="btn w-full justify-center" onClick={() => s.generateRandom(n, density, lm)}>
          <Shuffle size={13} /> GENERATE
        </button>
        <p className="mt-1.5 text-[11px] leading-snug text-white/40">Built from a spanning tree, so a route always exists before you edit it.</p>
      </div>

      {/* ── Graph file + reset ────────────────────────────────────────── */}
      <div className="hairline-t pt-3">
        <div className="tlabel mb-2">GRAPH FILE</div>
        <div className="grid grid-cols-2 gap-1.5">
          <Chip onClick={() => download(`deepforge-graph-${stamp()}.json`, serialise(s.graph), 'application/json')}><Download size={12} /> EXPORT</Chip>
          <label className="btn justify-center cursor-pointer">
            <Upload size={12} /> IMPORT
            <input type="file" accept="application/json,.json" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) importFile(f); e.currentTarget.value = ''; }} />
          </label>
          <Chip onClick={s.resetGraph}><RotateCcw size={12} /> RESET</Chip>
          <button className="btn btn-danger justify-center" onClick={s.clearGraph}><Trash2 size={12} /> CLEAR</button>
        </div>
      </div>

      {/* ── Validation ────────────────────────────────────────────────── */}
      {(v.errors.length > 0 || v.warnings.length > 0) && (
        <div className="hairline-t pt-3">
          <div className="tlabel mb-2">GRAPH STATUS</div>
          <ul className="space-y-1.5">
            {v.errors.map((e) => (
              <li key={e} className="text-[11.5px] leading-snug text-danger/90 flex gap-1.5"><span>■</span><span>{e}</span></li>
            ))}
            {v.warnings.map((w) => (
              <li key={w} className="text-[11.5px] leading-snug text-amber/80 flex gap-1.5"><span>▲</span><span>{w}</span></li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
