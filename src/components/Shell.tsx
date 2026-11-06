import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import { useApp } from '../state/store';

export const SECTIONS = [
  { id: 'home', label: 'Home' },
  { id: 'theory', label: 'Learn' },
  { id: 'visualizer', label: 'Visualizer' },
  { id: 'landmark', label: 'Landmarks' },
  { id: 'analytics', label: 'Compare' },
  { id: 'practice', label: 'Practice' },
  { id: 'about', label: 'About' },
] as const;

export type SectionId = typeof SECTIONS[number]['id'];

/* ── Wordmark: typography only, no institutional logo ───────────────────── */
export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-[7px] bg-white">
        <span className="font-display text-[14px] font-bold leading-none text-black">D</span>
      </span>
      <span className="flex flex-col leading-none min-w-0">
        <span className="font-display font-semibold tracking-[-0.02em] text-[17px] text-white whitespace-nowrap">
          Deep Forge
        </span>
        {!compact && (
          <span className="text-[13.5px] text-ink4 mt-[3px] truncate">Navigation Lab</span>
        )}
      </span>
    </div>
  );
}

export function Nav({ active, go }: { active: SectionId; go: (s: SectionId) => void }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      <header className={`fixed top-0 inset-x-0 z-50 transition-colors duration-300 ${scrolled ? 'bg-black/80 backdrop-blur-xl border-b border-white/[0.07]' : 'bg-transparent border-b border-transparent'}`}>
        <div className="mx-auto max-w-[1600px] px-5 sm:px-8 h-[68px] flex items-center gap-5">
          <button onClick={() => go('home')} className="shrink-0" aria-label="Deep Forge Navigation Lab — home">
            <Wordmark />
          </button>

          <nav className="hidden lg:flex items-center gap-1 ml-6" aria-label="Sections">
            {SECTIONS.map((s) => (
              <button key={s.id} onClick={() => go(s.id)}
                aria-current={active === s.id ? 'page' : undefined}
                className={`px-3 py-2 text-[15px] font-medium rounded-[8px] transition-colors ${active === s.id ? 'text-white bg-white/[0.08]' : 'text-ink3 hover:text-white'}`}>
                {s.label}
              </button>
            ))}
          </nav>

          <div className="ml-auto hidden md:flex items-center gap-4 shrink-0">
            <span className="text-[13.5px] text-ink4 text-right leading-tight">
              Birla Institute of Technology<br />Mesra
            </span>
            <button className="btn btn-primary !py-2 !min-h-[36px]" onClick={() => go('visualizer')}>
              Open visualizer
            </button>
          </div>

          <button className="lg:hidden ml-auto btn !px-3 !py-2 !min-h-[38px]" onClick={() => setOpen((o) => !o)}
            aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open}>
            {open ? <X size={17} /> : <Menu size={17} />}
          </button>
        </div>

        <AnimatePresence>
          {open && (
            <motion.nav
              initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="lg:hidden overflow-hidden bg-black/96 backdrop-blur-xl border-t border-white/[0.07]">
              <div className="px-5 py-3 grid gap-1">
                {SECTIONS.map((s) => (
                  <button key={s.id} onClick={() => { go(s.id); setOpen(false); }}
                    className={`text-left px-3 py-3 text-[17px] font-medium rounded-[10px] ${active === s.id ? 'text-white bg-white/[0.08]' : 'text-ink3'}`}>
                    {s.label}
                  </button>
                ))}
              </div>
              <div className="px-5 pb-4 pt-1 text-[13.5px] text-ink4">Birla Institute of Technology, Mesra</div>
            </motion.nav>
          )}
        </AnimatePresence>
      </header>
      <div className="h-[68px]" aria-hidden />
    </>
  );
}

export function Footer({ go }: { go: (s: SectionId) => void }) {
  return (
    <footer className="mt-24 border-t border-white/[0.07]">
      <div className="mx-auto max-w-[1600px] px-5 sm:px-8 py-14 grid gap-10 md:grid-cols-[1.5fr_1fr_1fr]">
        <div>
          <Wordmark />
          <p className="mt-5 text-[15px] leading-relaxed text-ink3 max-w-sm">
            Best First Search in route finding, with landmark heuristic visualization.
          </p>
          <p className="mt-4 text-[13px] text-ink4">Birla Institute of Technology, Mesra</p>
        </div>
        <div>
          <div className="text-[13.5px] text-ink4 mb-4">Sections</div>
          <ul className="space-y-2.5">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <button onClick={() => go(s.id)} className="text-[15px] text-ink2 hover:text-white transition-colors">{s.label}</button>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="text-[13.5px] text-ink4 mb-4">Under the hood</div>
          <dl className="space-y-2.5 text-[14px]">
            {[
              ['Algorithm', 'Greedy Best-First'],
              ['Chooses by', 'f(n) = h(n)'],
              ['Guess', 'Landmark based'],
              ['Prepared with', "Dijkstra's algorithm"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3">
                <dt className="text-ink4">{k}</dt>
                <dd className="text-ink2 tvalue text-[13px]">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
      <div className="border-t border-white/[0.06] px-5 sm:px-8 py-5 mx-auto max-w-[1600px] flex flex-wrap items-center justify-between gap-2">
        <span className="text-[13px] text-ink4">Developed by Team Deep Forge · BIT Mesra</span>
        <span className="text-[13px] text-ink4">Artificial Intelligence · Informed Search</span>
      </div>
    </footer>
  );
}

/* ── Notices ─────────────────────────────────────────────────────────────── */
export function NoticeBar() {
  const notice = useApp((s) => s.notice);
  const clear = useApp((s) => s.clearNotice);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(clear, notice.kind === 'error' ? 7000 : 3800);
    return () => clearTimeout(t);
  }, [notice, clear]);

  const Icon = notice?.kind === 'error' ? AlertTriangle : notice?.kind === 'ok' ? CheckCircle2 : Info;
  const color = notice?.kind === 'error' ? '#FF647C' : notice?.kind === 'ok' ? '#72E6A1' : '#8FB4FF';

  return (
    <AnimatePresence>
      {notice && (
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
          role="status" aria-live="polite"
          className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[60] panel-glass px-4 py-3.5 max-w-[min(92vw,560px)] flex items-start gap-3">
          <Icon size={16} style={{ color }} className="mt-px shrink-0" />
          <span className="text-[14px] leading-snug text-ink1">{notice.text}</span>
          <button onClick={clear} aria-label="Dismiss" className="ml-1 text-ink4 hover:text-white shrink-0"><X size={14} /></button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
