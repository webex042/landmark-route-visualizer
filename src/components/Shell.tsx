import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import { useApp } from '../state/store';

export const SECTIONS = [
  { id: 'home', label: 'HOME' },
  { id: 'theory', label: 'THEORY' },
  { id: 'visualizer', label: 'VISUALIZER' },
  { id: 'landmark', label: 'LANDMARK LAB' },
  { id: 'analytics', label: 'ANALYTICS' },
  { id: 'practice', label: 'PRACTICE' },
  { id: 'about', label: 'ABOUT' },
] as const;

export type SectionId = typeof SECTIONS[number]['id'];

/* ── Wordmark: typography only, no institutional logo ───────────────────── */
export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <span className="relative flex h-[26px] w-[3px] shrink-0 overflow-hidden">
        <span className="absolute inset-0 bg-gradient-to-b from-amber via-cyan to-transparent" />
      </span>
      <span className="flex flex-col leading-none min-w-0">
        <span className="font-display font-semibold tracking-[0.2em] text-[13px] text-white whitespace-nowrap">
          DEEP<span className="text-amber"> FORGE</span>
        </span>
        {!compact && (
          <span className="tlabel !text-[8px] !tracking-[0.16em] mt-[3px] truncate">NAVIGATION LAB</span>
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
      <header className={`fixed top-0 inset-x-0 z-50 transition-colors duration-300 ${scrolled ? 'bg-obsidian/88 backdrop-blur-xl border-b border-white/[0.07]' : 'bg-transparent border-b border-transparent'}`}>
        <div className="mx-auto max-w-[1600px] px-4 sm:px-6 h-[58px] flex items-center gap-4">
          <button onClick={() => go('home')} className="shrink-0" aria-label="DEEP FORGE Navigation Lab — home">
            <Wordmark />
          </button>

          <nav className="hidden lg:flex items-center gap-0.5 ml-4" aria-label="Sections">
            {SECTIONS.map((s) => (
              <button key={s.id} onClick={() => go(s.id)}
                aria-current={active === s.id ? 'page' : undefined}
                className={`relative px-2.5 py-2 tvalue text-[10.5px] tracking-[0.14em] transition-colors ${active === s.id ? 'text-cyan' : 'text-white/45 hover:text-white/80'}`}>
                {s.label}
                {active === s.id && <motion.span layoutId="navline" className="absolute left-2 right-2 -bottom-px h-[1.5px] bg-cyan" />}
              </button>
            ))}
          </nav>

          <div className="ml-auto hidden md:flex items-center gap-3 shrink-0">
            <span className="tlabel !text-[8.5px] !tracking-[0.14em] text-right leading-tight">
              BIRLA INSTITUTE OF TECHNOLOGY<br />MESRA
            </span>
            <span className="h-7 w-px bg-white/10" />
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-signal animate-blink" />
              <span className="tvalue text-[9px] text-signal tracking-[0.14em]">READY</span>
            </span>
          </div>

          <button className="lg:hidden ml-auto btn !px-2.5 !py-2" onClick={() => setOpen((o) => !o)}
            aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open}>
            {open ? <X size={15} /> : <Menu size={15} />}
          </button>
        </div>

        <AnimatePresence>
          {open && (
            <motion.nav
              initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22 }}
              className="lg:hidden overflow-hidden bg-obsidian/96 backdrop-blur-xl border-t border-white/[0.07]">
              <div className="px-4 py-2 grid grid-cols-2 gap-1">
                {SECTIONS.map((s) => (
                  <button key={s.id} onClick={() => { go(s.id); setOpen(false); }}
                    className={`text-left px-3 py-3 tvalue text-[11px] tracking-[0.14em] border border-white/[0.06] ${active === s.id ? 'text-cyan border-cyan/40 bg-cyan/[0.07]' : 'text-white/55'}`}>
                    {s.label}
                  </button>
                ))}
              </div>
              <div className="px-4 pb-3 pt-1 tlabel !text-[8.5px]">BIRLA INSTITUTE OF TECHNOLOGY, MESRA</div>
            </motion.nav>
          )}
        </AnimatePresence>
      </header>
      <div className="h-[58px]" aria-hidden />
    </>
  );
}

export function Footer({ go }: { go: (s: SectionId) => void }) {
  return (
    <footer className="mt-20 border-t border-white/[0.07] bg-graphite/40">
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6 py-10 grid gap-8 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Wordmark />
          <p className="mt-4 text-[12.5px] leading-relaxed text-white/45 max-w-sm">
            BEST FIRST SEARCH IN ROUTE FINDING WITH LANDMARK HEURISTIC VISUALIZATION
          </p>
          <p className="mt-3 tlabel !text-[9px] !tracking-[0.14em]">BIRLA INSTITUTE OF TECHNOLOGY, MESRA</p>
        </div>
        <div>
          <div className="tlabel mb-3">SECTIONS</div>
          <ul className="space-y-1.5">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <button onClick={() => go(s.id)} className="tvalue text-[11px] text-white/45 hover:text-cyan transition-colors tracking-[0.1em]">{s.label}</button>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="tlabel mb-3">SYSTEM</div>
          <dl className="space-y-1.5 tvalue text-[10.5px] text-white/45">
            <div className="flex justify-between gap-2"><dt>ALGORITHM</dt><dd className="text-white/70">GREEDY BEST-FIRST</dd></div>
            <div className="flex justify-between gap-2"><dt>EVALUATION</dt><dd className="text-amber">f(n) = h(n)</dd></div>
            <div className="flex justify-between gap-2"><dt>HEURISTIC</dt><dd className="text-white/70">LANDMARK / ALT</dd></div>
            <div className="flex justify-between gap-2"><dt>PREPROCESS</dt><dd className="text-white/70">DIJKSTRA</dd></div>
          </dl>
        </div>
      </div>
      <div className="border-t border-white/[0.06] px-4 sm:px-6 py-4 mx-auto max-w-[1600px] flex flex-wrap items-center justify-between gap-2">
        <span className="tlabel !text-[9px]">DEVELOPED BY TEAM DEEP FORGE | BIT MESRA</span>
        <span className="tvalue text-[9px] text-white/25 tracking-[0.14em]">AI / INFORMED SEARCH ALGORITHMS</span>
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
  const color = notice?.kind === 'error' ? '#FF647C' : notice?.kind === 'ok' ? '#72E6A1' : '#43D9E8';

  return (
    <AnimatePresence>
      {notice && (
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
          role="status" aria-live="polite"
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] panel-glass px-4 py-3 max-w-[min(92vw,560px)] flex items-start gap-2.5"
          style={{ borderColor: `${color}55` }}>
          <Icon size={15} style={{ color }} className="mt-px shrink-0" />
          <span className="text-[12.5px] leading-snug text-white/85">{notice.text}</span>
          <button onClick={clear} aria-label="Dismiss" className="ml-1 text-white/35 hover:text-white shrink-0"><X size={13} /></button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
