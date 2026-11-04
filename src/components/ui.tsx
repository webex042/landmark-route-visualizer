import { ReactNode } from 'react';
import { motion } from 'framer-motion';

/* ── Panel ───────────────────────────────────────────────────────────────── */
export function Panel({ children, className = '', glass = false, ticks = false, title, right, dense = false }: {
  children: ReactNode; className?: string; glass?: boolean; ticks?: boolean;
  title?: string; right?: ReactNode; dense?: boolean;
}) {
  return (
    <section className={`${glass ? 'panel-glass' : 'panel'} ${ticks ? 'ticks' : ''} ${className}`}>
      {title && (
        <header className="flex items-center justify-between gap-3 px-3 py-2 hairline-b min-h-[36px]">
          <h3 className="tlabel !text-[10px] truncate">{title}</h3>
          {right}
        </header>
      )}
      <div className={dense ? '' : 'p-3'}>{children}</div>
    </section>
  );
}

/* ── Technical label / value pair ────────────────────────────────────────── */
export function Field({ label, value, accent, mono = true, hint }: {
  label: string; value: ReactNode; accent?: string; mono?: boolean; hint?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-[5px] border-b border-white/[0.05] last:border-0" title={hint}>
      <span className="tlabel shrink-0">{label}</span>
      <span className={`${mono ? 'tvalue' : ''} text-[12px] text-right`} style={{ color: accent ?? '#dde4ec' }}>{value}</span>
    </div>
  );
}

/* ── Metric card ─────────────────────────────────────────────────────────── */
export function Metric({ label, value, accent = '#43D9E8', sub, delay = 0 }: {
  label: string; value: ReactNode; accent?: string; sub?: string; delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
      transition={{ duration: 0.4, delay }}
      className="panel ticks px-3 py-3 relative overflow-hidden"
    >
      <div className="absolute left-0 top-0 h-full w-[2px]" style={{ background: accent, opacity: 0.8 }} />
      <div className="tlabel mb-1.5 pl-1">{label}</div>
      <div className="tvalue text-[19px] leading-none pl-1" style={{ color: accent }}>{value}</div>
      {sub && <div className="tlabel !text-[9px] !tracking-[0.1em] mt-1.5 pl-1 normal-case opacity-70">{sub}</div>}
    </motion.div>
  );
}

/* ── Section heading ─────────────────────────────────────────────────────── */
export function SectionHead({ index, kicker, title, lead }: { index: string; kicker: string; title: string; lead?: string }) {
  return (
    <div className="mb-8 md:mb-10">
      <div className="flex items-center gap-3 mb-3">
        <span className="tvalue text-[10px] text-cyan/80 border border-cyan/30 px-1.5 py-0.5">{index}</span>
        <span className="tlabel">{kicker}</span>
        <span className="h-px flex-1 bg-gradient-to-r from-white/15 to-transparent" />
      </div>
      <h2 className="font-display text-[26px] sm:text-[34px] md:text-[42px] leading-[1.05] tracking-[-0.03em]">{title}</h2>
      {lead && <p className="mt-3 max-w-3xl text-[14px] md:text-[15px] leading-relaxed text-white/60">{lead}</p>}
    </div>
  );
}

/* ── Toggle chip ─────────────────────────────────────────────────────────── */
export function Chip({ active, onClick, children, title, disabled }: {
  active?: boolean; onClick?: () => void; children: ReactNode; title?: string; disabled?: boolean;
}) {
  return (
    <button type="button" title={title} disabled={disabled} onClick={onClick}
      aria-pressed={active}
      className={`btn ${active ? 'btn-active' : ''}`}>
      {children}
    </button>
  );
}

/* ── Formula block ───────────────────────────────────────────────────────── */
export function Formula({ children, note }: { children: ReactNode; note?: string }) {
  return (
    <div className="panel px-4 py-3.5 my-3 bg-black/40">
      <div className="tvalue formula-text text-[13px] sm:text-[14px] md:text-[15px] text-amber text-center leading-relaxed">{children}</div>
      {note && <div className="tlabel !text-[9px] text-center mt-2 normal-case opacity-70">{note}</div>}
    </div>
  );
}

/* ── Legend swatch ───────────────────────────────────────────────────────── */
export function Swatch({ color, label, shape = 'circle' }: { color: string; label: string; shape?: 'circle' | 'diamond' | 'line' }) {
  return (
    <div className="flex items-center gap-2">
      {shape === 'line' ? (
        <span className="w-4 h-[3px] rounded-sm shrink-0" style={{ background: color }} />
      ) : (
        <span className="w-[11px] h-[11px] shrink-0" style={{ background: color, transform: shape === 'diamond' ? 'rotate(45deg)' : undefined, borderRadius: shape === 'circle' ? '50%' : 0 }} />
      )}
      <span className="tlabel !text-[9px] !tracking-[0.1em]">{label}</span>
    </div>
  );
}

/* ── Callout ─────────────────────────────────────────────────────────────── */
export function Callout({ tone = 'info', title, children }: { tone?: 'info' | 'warn' | 'good'; title?: string; children: ReactNode }) {
  const color = tone === 'warn' ? '#FFB547' : tone === 'good' ? '#72E6A1' : '#43D9E8';
  return (
    <div className="panel px-3.5 py-3 my-3 relative" style={{ borderColor: `${color}44` }}>
      <div className="absolute left-0 top-0 h-full w-[2px]" style={{ background: color, opacity: 0.75 }} />
      {title && <div className="tlabel mb-1.5" style={{ color }}>{title}</div>}
      <div className="text-[13px] leading-relaxed text-white/70">{children}</div>
    </div>
  );
}
