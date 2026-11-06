import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { TERMS, TermKey, LEGEND } from '../lib/vocabulary';

/* ── Panel ───────────────────────────────────────────────────────────────
 * A soft rounded rectangle with a hairline edge and a sentence-case grey
 * caption, in the manner of the reference design.
 * ----------------------------------------------------------------------- */
export function Panel({ children, className = '', glass = false, ticks = false, title, subtitle, right, dense = false }: {
  children: ReactNode; className?: string; glass?: boolean; ticks?: boolean;
  title?: string; subtitle?: string; right?: ReactNode; dense?: boolean;
}) {
  return (
    <section className={`${glass ? 'panel-glass' : 'panel'} ${ticks ? 'ticks' : ''} ${className}`}>
      {title && (
        <header className="flex items-center justify-between gap-3 px-5 py-3.5 hairline-b min-h-[48px]">
          <div className="min-w-0">
            <h3 className="text-[15px] font-medium text-ink1 truncate">{title}</h3>
            {subtitle && <p className="text-[13px] leading-snug text-ink4 mt-0.5 truncate">{subtitle}</p>}
          </div>
          {right}
        </header>
      )}
      <div className={dense ? '' : 'p-5'}>{children}</div>
    </section>
  );
}

/* ── Label / value pair ──────────────────────────────────────────────────── */
export function Field({ label, value, accent, mono = true, hint }: {
  label: string; value: ReactNode; accent?: string; mono?: boolean; hint?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2 border-b border-white/[0.06] last:border-0" title={hint}>
      <span className="tlabel shrink-0">{label}</span>
      <span className={`${mono ? 'tvalue' : ''} text-[14px] text-right`} style={{ color: accent ?? 'var(--ink-1)' }}>{value}</span>
    </div>
  );
}

/* ── Stat ────────────────────────────────────────────────────────────────
 * Grey caption above a large value, exactly the pattern the reference uses
 * for its metrics row. No border, no bar, no card — just the two lines.
 * ----------------------------------------------------------------------- */
export function Metric({ label, value, accent, sub, delay = 0 }: {
  label: string; value: ReactNode; accent?: string; sub?: string; delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
      transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}
      className="panel px-5 py-4"
    >
      <div className="stat-label">{label}</div>
      <div className="stat-value tvalue mt-2" style={accent ? { color: accent } : undefined}>{value}</div>
      {sub && <div className="text-[13px] leading-snug mt-2 text-ink4">{sub}</div>}
    </motion.div>
  );
}

/* ── Section heading ─────────────────────────────────────────────────────
 * Large two-line heading on the left; optional meta and action pinned to its
 * baseline on the right, as in "Built on a community … | 27,685 Resources".
 * ----------------------------------------------------------------------- */
export function SectionHead({ index, kicker, title, lead, right }: {
  index: string; kicker: string; title: string; lead?: string; right?: ReactNode;
}) {
  return (
    <div className="mb-10 md:mb-14">
      <div className="flex items-center gap-3 mb-5">
        <span className="tvalue text-[13.5px] text-ink4">{index}</span>
        <span className="text-[13.5px] text-ink3">{kicker}</span>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <h2 className="font-display text-[32px] sm:text-[42px] md:text-[52px] leading-[1.04] tracking-[-0.035em] max-w-4xl">
          {title}
        </h2>
        {right}
      </div>
      {lead && <p className="mt-5 max-w-3xl text-[16px] leading-relaxed text-ink3">{lead}</p>}
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
      className={`btn !text-[13px] !px-3.5 !py-2 !min-h-[36px] ${active ? 'btn-active' : ''}`}>
      {children}
    </button>
  );
}

/* ── Arrow link, as used throughout the reference ("Security →") ─────────── */
export function ArrowLink({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <button onClick={onClick}
      className="group inline-flex items-center gap-2 text-[17px] font-medium text-ink1 hover:text-white transition-colors">
      {children}
      <ArrowRight size={17} className="transition-transform duration-200 group-hover:translate-x-1" />
    </button>
  );
}

/* ── Formula block ───────────────────────────────────────────────────────── */
export function Formula({ children, note }: { children: ReactNode; note?: string }) {
  return (
    <div className="panel px-5 py-5 my-4">
      <div className="tvalue formula-text text-[17px] sm:text-[19px] md:text-[21px] text-ink1 text-center leading-relaxed">{children}</div>
      {note && <div className="text-[13.5px] leading-snug text-center mt-3 text-ink3 max-w-xl mx-auto">{note}</div>}
    </div>
  );
}

/* ── Legend swatch ───────────────────────────────────────────────────────── */
export function Swatch({ color, label, shape = 'circle', hint }: {
  color: string; label: string; shape?: 'circle' | 'diamond' | 'line'; hint?: string;
}) {
  return (
    <div className="flex items-center gap-2.5" title={hint}>
      {shape === 'line' ? (
        <span className="w-5 h-[4px] rounded-full shrink-0" style={{ background: color }} />
      ) : (
        <span className="w-[13px] h-[13px] shrink-0" style={{ background: color, transform: shape === 'diamond' ? 'rotate(45deg)' : undefined, borderRadius: shape === 'circle' ? '50%' : 2 }} />
      )}
      <span className="text-[13.5px] leading-tight text-ink2">{label}</span>
    </div>
  );
}

/* ── Colour legend for the graph, in plain English ────────────────────────
 * One component so the Visualizer, the Theory demo and the Practice
 * questions all explain the colours with exactly the same words.
 * ----------------------------------------------------------------------- */
export function GraphLegend({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`flex flex-wrap ${compact ? 'gap-x-4 gap-y-2' : 'gap-x-6 gap-y-3'}`}>
      {LEGEND.map((l) => (
        <Swatch key={l.key} color={l.color} label={l.plain} shape={l.shape} hint={l.hint} />
      ))}
    </div>
  );
}

/* ── A plain-English name with its textbook term beneath ─────────────────── */
export function TermLabel({ term, accent }: { term: TermKey; accent?: string }) {
  const t = TERMS[term];
  return (
    <span className="inline-flex flex-col leading-none">
      <span className="term-plain" style={accent ? { color: accent } : undefined}>{t.plain}</span>
      <span className="term-tech mt-1.5">{t.technical}</span>
    </span>
  );
}

/* ── Callout ─────────────────────────────────────────────────────────────── */
export function Callout({ tone = 'info', title, children }: { tone?: 'info' | 'warn' | 'good'; title?: string; children: ReactNode }) {
  const color = tone === 'warn' ? '#FFB547' : tone === 'good' ? '#72E6A1' : '#8FB4FF';
  return (
    <div className="panel px-5 py-4 my-4">
      {title && (
        <div className="flex items-center gap-2.5 mb-2">
          <span className="h-2 w-2 rounded-full shrink-0" style={{ background: color }} />
          <span className="text-[14px] font-medium text-ink1">{title}</span>
        </div>
      )}
      <div className="text-[14.5px] leading-relaxed text-ink2">{children}</div>
    </div>
  );
}

/* ── "In plain words" note — the beginner's safety net ────────────────────
 * Sits within a few pixels of every formula, so the jargon is never more
 * than a glance away from its translation.
 * ----------------------------------------------------------------------- */
export function PlainNote({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 mt-3 px-4 py-3 rounded-[12px] bg-white/[0.04]">
      <span className="text-[13.5px] text-ink4 shrink-0 mt-[3px]">In plain words</span>
      <p className="text-[14px] leading-relaxed text-ink2">{children}</p>
    </div>
  );
}
