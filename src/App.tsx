import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Nav, Footer, NoticeBar, SectionId } from './components/Shell';
import { useAnimationClock } from './components/Execution';
import Home from './sections/Home';
import Theory from './sections/Theory';
import Visualizer from './sections/Visualizer';
import LandmarkLab from './sections/LandmarkLab';
import Analytics from './sections/Analytics';
import Practice from './sections/Practice';
import About from './sections/About';

const VALID: SectionId[] = ['home', 'theory', 'visualizer', 'landmark', 'analytics', 'practice', 'about'];

const fromHash = (): SectionId => {
  const h = window.location.hash.replace('#', '') as SectionId;
  return VALID.includes(h) ? h : 'home';
};

export default function App() {
  const [section, setSection] = useState<SectionId>(fromHash);
  useAnimationClock();

  const go = useCallback((s: SectionId) => {
    setSection(s);
    if (window.location.hash !== `#${s}`) window.history.pushState(null, '', `#${s}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const onPop = () => setSection(fromHash());
    window.addEventListener('popstate', onPop);
    window.addEventListener('hashchange', onPop);
    return () => { window.removeEventListener('popstate', onPop); window.removeEventListener('hashchange', onPop); };
  }, []);

  const views: Record<SectionId, ReactElement> = {
    home: <Home go={go} />,
    theory: <Theory go={go} />,
    visualizer: <Visualizer />,
    landmark: <LandmarkLab />,
    analytics: <Analytics />,
    practice: <Practice />,
    about: <About />,
  };

  return (
    <div className="min-h-screen flex flex-col">
      <a href="#main" className="skip-link btn">SKIP TO CONTENT</a>
      <Nav active={section} go={go} />
      <main id="main" className="flex-1">
        <AnimatePresence mode="wait">
          <motion.div key={section}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.26, ease: 'easeOut' }}>
            {views[section]}
          </motion.div>
        </AnimatePresence>
      </main>
      <Footer go={go} />
      <NoticeBar />
    </div>
  );
}
