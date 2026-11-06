/* ===========================================================================
 * PLAIN-LANGUAGE VOCABULARY
 *
 * One place that decides how every technical term is worded for a beginner.
 * The textbook word is never hidden — it is shown as a quiet subtitle — but
 * the plain phrase is always what the eye lands on first.
 *
 *   frontier  →  "Waiting list"       (nodes we know about but haven't checked)
 *   explored  →  "Already checked"    (nodes we are finished with)
 *   expand    →  "Open up"            (look at a node's neighbours)
 *   h(n)      →  "Distance left (guess)"
 *   g(n)      →  "Travelled so far"
 *
 * Importing from here instead of typing strings in each component is what
 * keeps the wording identical on every screen.
 * ========================================================================= */

export interface Term {
  /** What a beginner reads. */
  plain: string;
  /** The textbook word, shown small underneath or in brackets. */
  technical: string;
  /** One short sentence, simple English. */
  meaning: string;
}

export const TERMS = {
  frontier: {
    plain: 'Waiting list',
    technical: 'frontier',
    meaning: 'Places we have found but have not checked yet.',
  },
  explored: {
    plain: 'Already checked',
    technical: 'explored set',
    meaning: 'Places we are finished with. We never check them twice.',
  },
  current: {
    plain: 'Checking now',
    technical: 'current node',
    meaning: 'The place the algorithm is looking at this step.',
  },
  start: {
    plain: 'Start',
    technical: 'start node',
    meaning: 'Where the journey begins.',
  },
  goal: {
    plain: 'Destination',
    technical: 'goal node',
    meaning: 'Where we are trying to get to.',
  },
  unvisited: {
    plain: 'Not found yet',
    technical: 'unvisited',
    meaning: 'Places the search has not reached at all.',
  },
  route: {
    plain: 'Final route',
    technical: 'solution path',
    meaning: 'The road the algorithm chose, from start to destination.',
  },
  landmark: {
    plain: 'Landmark',
    technical: 'landmark',
    meaning: 'A reference place we measured all the distances from in advance.',
  },
  h: {
    plain: 'Distance left',
    technical: 'h(n)',
    meaning: 'A guess at how far it still is to the destination.',
  },
  g: {
    plain: 'Travelled so far',
    technical: 'g(n)',
    meaning: 'The real distance already covered getting here.',
  },
  weight: {
    plain: 'Road length',
    technical: 'edge weight',
    meaning: 'What it costs to travel along one connection.',
  },
  expand: {
    plain: 'Open up',
    technical: 'expand',
    meaning: 'Look at everything connected to a place.',
  },
  node: {
    plain: 'Place',
    technical: 'node',
    meaning: 'One location on the map.',
  },
  edge: {
    plain: 'Road',
    technical: 'edge',
    meaning: 'A connection between two places.',
  },
} as const satisfies Record<string, Term>;

export type TermKey = keyof typeof TERMS;

/** "Waiting list" — the plain word on its own. */
export const say = (k: TermKey): string => TERMS[k].plain;

/** "Waiting list (frontier)" — for the first mention on a screen. */
export const sayBoth = (k: TermKey): string => `${TERMS[k].plain} (${TERMS[k].technical})`;

/* ── Step phases in plain English ────────────────────────────────────────── */

export const PHASE_PLAIN: Record<string, string> = {
  init: 'Getting ready',
  select: 'Choosing where to go',
  expand: 'Looking around',
  success: 'Arrived',
  failure: 'No way through',
};

/* ── Node states, as a beginner-facing legend ────────────────────────────── */

export interface LegendItem {
  key: string;
  color: string;
  plain: string;
  technical: string;
  hint: string;
  shape?: 'circle' | 'diamond' | 'line';
}

export const LEGEND: LegendItem[] = [
  { key: 'start', color: '#43D9E8', plain: 'Start', technical: 'start node', hint: 'Where we begin.' },
  { key: 'goal', color: '#72E6A1', plain: 'Destination', technical: 'goal node', hint: 'Where we want to reach.' },
  { key: 'current', color: '#FFB547', plain: 'Checking now', technical: 'current', hint: 'Being looked at this step.' },
  { key: 'frontier', color: '#F2DF6B', plain: 'Waiting to be checked', technical: 'frontier', hint: 'Found, but not checked yet.' },
  { key: 'explored', color: '#A78BFA', plain: 'Already checked', technical: 'explored', hint: 'Finished with. Never revisited.' },
  { key: 'idle', color: '#8A95A3', plain: 'Not found yet', technical: 'unvisited', hint: 'The search has not reached it.' },
  { key: 'path', color: '#72E6A1', plain: 'Final route', technical: 'path', hint: 'The road that was chosen.', shape: 'line' },
  { key: 'landmark', color: '#A78BFA', plain: 'Landmark', technical: 'landmark', hint: 'A measuring point for the guess.', shape: 'diamond' },
];
