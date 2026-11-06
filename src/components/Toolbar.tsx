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
  { id: 'inspect', label: 'Select', icon: MousePointer2, help: 'Click a place to see its details, drag it to move it, click a road to change how long it is.' },
  { id: 'add-node', label: 'Add place', icon: PlusCircle, help: 'Click anywhere on the map to drop in a new place.' },
  { id: 'connect', label: 'Add road', icon: Link2, help: 'Click two places to join them with a road. Its length is worked out from the distance, and you can change it afterwards.' },
  { id: 'erase', label: 'Delete', icon: Eraser, help: 'Click a place or a road to remove it.' },
];

/** A small heading inside the editor column. */
function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="hairline-t pt-4 first:border-0 first:pt-0">
      <div className="text-[13.5px] text-ink3 mb-2.5">{title}</div>
      {children}
    </div>
  );
}

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
    <div className="space-y-4">
      {/* ── Modes ─────────────────────────────────────────────────────── */}
      <Group title="What clicking does">
        <div className="grid grid-cols-2 gap-2">
          {MODES.map((m) => {
            const Icon = m.icon;
            return (
              <Chip key={m.id} active={s.mode === m.id} onClick={() => s.setMode(m.id)} title={m.help}>
                <Icon size={14} /> {m.label}
              </Chip>
            );
          })}
        </div>
        {activeHelp && <p className="mt-2.5 text-[13px] leading-snug text-ink4">{activeHelp}</p>}
        {s.mode === 'connect' && s.connectFromId && (
          <p className="mt-2 text-[13px] text-white">
            Starting from <span className="tvalue">{s.graph.nodes.find((x) => x.id === s.connectFromId)?.label}</span> — now click the other place.
          </p>
        )}
      </Group>

      {/* ── Role assignment ───────────────────────────────────────────── */}
      <Group title="Make the selected place…">
        {s.selectedNodeId ? (
          <div className="grid grid-cols-3 gap-2">
            <Chip active={s.graph.startId === s.selectedNodeId} onClick={() => s.assignStart(s.selectedNodeId!)}><MapPin size={13} /> Start</Chip>
            <Chip active={s.graph.goalId === s.selectedNodeId} onClick={() => s.assignGoal(s.selectedNodeId!)}><Flag size={13} /> End</Chip>
            <Chip active={s.graph.landmarkIds.includes(s.selectedNodeId)} onClick={() => s.flipLandmark(s.selectedNodeId!)}><Diamond size={13} /> Landmark</Chip>
          </div>
        ) : (
          <p className="text-[13px] text-ink4">Nothing selected. Click a place on the map first.</p>
        )}
      </Group>

      {/* ── View controls ─────────────────────────────────────────────── */}
      <Group title="View">
        <div className="flex flex-wrap gap-2">
          <Chip onClick={() => s.setView({ zoom: Math.min(3.2, s.view.zoom * 1.2) })} title="Zoom in"><ZoomIn size={14} /></Chip>
          <Chip onClick={() => s.setView({ zoom: Math.max(0.35, s.view.zoom / 1.2) })} title="Zoom out"><ZoomOut size={14} /></Chip>
          <Chip onClick={s.fitView} title="Fit the whole map on screen"><Maximize2 size={14} /> Fit</Chip>
          <span className="tvalue text-[13px] text-ink4 self-center ml-1">{(s.view.zoom * 100).toFixed(0)}%</span>
        </div>
      </Group>

      {/* ── Layer toggles ─────────────────────────────────────────────── */}
      <Group title="Show on the map">
        <div className="grid grid-cols-2 gap-2">
          <Chip active={s.toggles.weights} onClick={() => s.toggle('weights')}>Road lengths</Chip>
          <Chip active={s.toggles.heuristics} onClick={() => s.toggle('heuristics')}>Distance guesses</Chip>
          <Chip active={s.toggles.landmarks} onClick={() => s.toggle('landmarks')}>Landmarks</Chip>
          <Chip active={s.toggles.ids} onClick={() => s.toggle('ids')}>Place names</Chip>
          <Chip active={s.toggles.grid} onClick={() => s.toggle('grid')}>Grid</Chip>
        </div>
      </Group>

      {/* ── Environments ──────────────────────────────────────────────── */}
      <Group title="Ready-made maps">
        <div className="space-y-2">
          {PRESETS.map((p) => (
            <button key={p.key} onClick={() => s.loadPreset(p.key)}
              className={`w-full text-left px-3.5 py-3 rounded-[10px] transition-colors ${s.presetKey === p.key ? 'bg-white/[0.1]' : 'bg-white/[0.03] hover:bg-white/[0.07]'}`}>
              <div className={`text-[14px] font-medium ${s.presetKey === p.key ? 'text-white' : 'text-ink2'}`}>{p.name}</div>
              <div className="text-[13px] leading-snug text-ink4 mt-1">{p.note}</div>
            </button>
          ))}
        </div>
      </Group>

      {/* ── Random generator ──────────────────────────────────────────── */}
      <Group title="Build a random map">
        <label className="block mb-3">
          <span className="text-[13px] text-ink3">Places — {n}</span>
          <input type="range" min={4} max={40} value={n} onChange={(e) => setN(+e.target.value)} className="mt-2" />
        </label>
        <label className="block mb-3">
          <span className="text-[13px] text-ink3">Extra roads — {density.toFixed(2)}</span>
          <input type="range" min={0} max={1.4} step={0.05} value={density} onChange={(e) => setDensity(+e.target.value)} className="mt-2" />
        </label>
        <label className="block mb-3">
          <span className="text-[13px] text-ink3">Landmarks — {lm}</span>
          <input type="range" min={0} max={5} value={lm} onChange={(e) => setLm(+e.target.value)} className="mt-2" />
        </label>
        <button className="btn w-full" onClick={() => s.generateRandom(n, density, lm)}>
          <Shuffle size={14} /> Generate
        </button>
        <p className="mt-2 text-[13px] leading-snug text-ink4">Always fully connected, so a route exists before you start editing.</p>
      </Group>

      {/* ── Graph file + reset ────────────────────────────────────────── */}
      <Group title="Save and load">
        <div className="grid grid-cols-2 gap-2">
          <Chip onClick={() => download(`deepforge-map-${stamp()}.json`, serialise(s.graph), 'application/json')}><Download size={13} /> Save</Chip>
          <label className="btn !text-[13.5px] !px-3.5 !py-2 !min-h-[36px] cursor-pointer">
            <Upload size={13} /> Load
            <input type="file" accept="application/json,.json" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) importFile(f); e.currentTarget.value = ''; }} />
          </label>
          <Chip onClick={s.resetGraph}><RotateCcw size={13} /> Undo edits</Chip>
          <button className="btn btn-danger !text-[13.5px] !px-3.5 !py-2 !min-h-[36px]" onClick={s.clearGraph}><Trash2 size={13} /> Empty map</button>
        </div>
      </Group>

      {/* ── Validation ────────────────────────────────────────────────── */}
      {(v.errors.length > 0 || v.warnings.length > 0) && (
        <Group title="Before you can search">
          <ul className="space-y-2">
            {v.errors.map((e) => (
              <li key={e} className="text-[13px] leading-snug text-[#FF9FAC] flex gap-2.5">
                <span className="shrink-0 mt-[6px] h-1.5 w-1.5 rounded-full bg-danger" /><span>{e}</span>
              </li>
            ))}
            {v.warnings.map((w) => (
              <li key={w} className="text-[13px] leading-snug text-ink3 flex gap-2.5">
                <span className="shrink-0 mt-[6px] h-1.5 w-1.5 rounded-full bg-amber" /><span>{w}</span>
              </li>
            ))}
          </ul>
        </Group>
      )}
    </div>
  );
}
