import assert from 'node:assert/strict';
import { Graph, addNode, connect, setStart, setGoal, toggleLandmark, validateGraph } from '../src/lib/graph.ts';
import { dijkstra, optimalPath, LandmarkTable } from '../src/lib/dijkstra.ts';
import { landmarkBreakdown, makeHeuristic } from '../src/lib/heuristics.ts';
import { search, compareAll } from '../src/lib/searchEngine.ts';
import { PRESETS } from '../src/lib/presets.ts';

console.log('================================================================');
console.log('DEEP FORGE — NAVIGATION LAB: ALGORITHM TEST SUITE');
console.log('================================================================\n');

let passedTests = 0;
let totalTests = 0;

function test(name: string, fn: () => void) {
  totalTests++;
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

// ── Test 1: Simple Graph Route Finding ──────────────────────────
test('1. Simple 3-node linear graph route finding', () => {
  let g: Graph = { nodes: [], edges: [], startId: null, goalId: null, landmarkIds: [] };
  g = addNode(g, 0, 0, 'A');
  g = addNode(g, 100, 0, 'B');
  g = addNode(g, 200, 0, 'C');
  const [a, b, c] = g.nodes.map((n) => n.id);
  g = connect(g, a, b, 10).graph;
  g = connect(g, b, c, 15).graph;
  g = setStart(g, a);
  g = setGoal(g, c);
  g = toggleLandmark(g, b);

  const res = search(g, 'landmark');
  assert.equal(res.success, true, 'Search should succeed');
  assert.deepEqual(res.path, [a, b, c], 'Path should be A -> B -> C');
  assert.equal(res.pathCost, 25, 'Path cost should be 25');
  assert.equal(res.isOptimal, true, 'Linear path is optimal');
  assert.equal(res.nodesVisited, 3, 'Visited A, B, C');
});

// ── Test 2: Complex Graph (City Route Network) ──────────────────
test('2. Complex graph with multiple routes and landmarks', () => {
  const cityPreset = PRESETS.find((p) => p.key === 'city')!;
  const g = cityPreset.make();
  assert(g.nodes.length >= 14, 'City network has 14 nodes');
  assert(g.edges.length >= 22, 'City network has 22 edges');
  assert(g.landmarkIds.length >= 2, 'City network has landmarks');

  const res = search(g, 'landmark');
  assert.equal(res.success, true, 'City search should find a route');
  assert(res.path.length > 2, 'Path has multiple hops');
  assert(res.pathCost > 0, 'Path cost is positive');
  assert(res.steps.length > 0, 'Step trace was generated');

  // Verify first and last nodes in path match start and goal
  assert.equal(res.path[0], g.startId);
  assert.equal(res.path[res.path.length - 1], g.goalId);
});

// ── Test 3: Multiple Landmarks & Heuristic Lower Bound ──────────
test('3. Multiple landmarks and triangle-inequality lower bound', () => {
  const g = PRESETS.find((p) => p.key === 'city')!.make();
  const table = new LandmarkTable(g, g.landmarkIds);
  assert.equal(table.landmarks.length, g.landmarkIds.length);

  // For every node v, check that h(v, t) <= true distance d(v, t)
  for (const node of g.nodes) {
    if (node.id === g.goalId) continue;
    const bd = landmarkBreakdown(table, node.id, g.goalId!);
    const opt = optimalPath(g, node.id, g.goalId!);
    if (opt) {
      assert(
        bd.value <= opt.cost + 1e-6,
        `Heuristic ${bd.value} exceeds true distance ${opt.cost} at node ${node.label}!`
      );
    }
  }
});

// ── Test 4: Disconnected Components & Unreachable Goal ──────────
test('4. Disconnected components and unreachable target handling', () => {
  let g: Graph = { nodes: [], edges: [], startId: null, goalId: null, landmarkIds: [] };
  g = addNode(g, 0, 0, 'IslandA1');
  g = addNode(g, 50, 50, 'IslandA2');
  g = addNode(g, 300, 300, 'IslandB1');
  g = addNode(g, 350, 350, 'IslandB2');
  const [a1, a2, b1, b2] = g.nodes.map((n) => n.id);
  g = connect(g, a1, a2, 5).graph;
  g = connect(g, b1, b2, 5).graph;
  g = setStart(g, a1);
  g = setGoal(g, b1);
  g = toggleLandmark(g, a2);

  const res = search(g, 'landmark');
  assert.equal(res.success, false, 'Search must report failure when destination is unreachable');
  assert.deepEqual(res.path, [], 'Path must be empty');
  assert.equal(res.pathCost, 0, 'Path cost must be 0');
  assert(res.failureReason?.includes('not reachable') || res.failureReason?.includes('exhausted'), 'Proper failure reason');
  assert(res.steps.length > 0, 'Recorded failure step in trace');
  assert.equal(res.steps[res.steps.length - 1].phase, 'failure');
});

// ── Test 5: Deterministic Tie-Breaking with Equal Heuristics ─────
test('5. Equal heuristic values and deterministic tie-breaking', () => {
  let g: Graph = { nodes: [], edges: [], startId: null, goalId: null, landmarkIds: [] };
  g = addNode(g, 0, 100, 'S');
  g = addNode(g, 100, 0, 'B'); // Same h
  g = addNode(g, 100, 200, 'A'); // Same h
  g = addNode(g, 200, 100, 'G');
  const [s, b, a, goal] = g.nodes.map((n) => n.id);
  g = connect(g, s, a, 10).graph;
  g = connect(g, s, b, 10).graph;
  g = connect(g, a, goal, 10).graph;
  g = connect(g, b, goal, 10).graph;
  g = setStart(g, s);
  g = setGoal(g, goal);

  // Run with zero heuristic where all h = 0
  const run1 = search(g, 'zero');
  const run2 = search(g, 'zero');

  assert.equal(run1.success, true);
  assert.equal(run2.success, true);
  assert.deepEqual(run1.path, run2.path, 'Tie-breaking must produce identical routes across runs');
  assert.deepEqual(run1.steps.map((st) => st.currentId), run2.steps.map((st) => st.currentId), 'Step trace must be 100% deterministic');
});

// ── Test 6: Validation & Start Node Equals Destination ───────────
test('6. Start node equals destination error handling', () => {
  let g: Graph = { nodes: [], edges: [], startId: null, goalId: null, landmarkIds: [] };
  g = addNode(g, 0, 0, 'SAME');
  g = addNode(g, 100, 100, 'OTHER');
  const [n1] = g.nodes.map((n) => n.id);
  g.startId = n1;
  g.goalId = n1;

  const v = validateGraph(g);
  assert.equal(v.ok, false, 'Validation must fail when start equals destination');
  assert(v.errors.some((e) => e.toLowerCase().includes('different')), 'Error message explains start and goal must differ');

  const res = search(g, 'landmark');
  assert.equal(res.success, false, 'Search engine rejects start == goal');
  assert(res.failureReason?.includes('distinct start node and destination'));
});

// ── Test 7: Greedy Trap Suboptimality Demonstration ─────────────
test('7. Greedy Trap proves GBFS f(n)=h(n) sub-optimality', () => {
  const trapPreset = PRESETS.find((p) => p.key === 'trap')!;
  const g = trapPreset.make();

  const res = search(g, 'landmark');
  assert.equal(res.success, true, 'Search finds a route');
  assert.equal(res.isOptimal, false, 'Greedy search is provably sub-optimal on this graph');
  assert.equal(res.pathCost, 11, 'Greedy route cost is 11');
  assert.equal(res.optimalCost, 3, 'True optimal cost is 3');
});

// ── Test 8: Unreachable Landmark Isolation ───────────────────────
test('8. Landmark unreachable from some nodes handled gracefully', () => {
  let g: Graph = { nodes: [], edges: [], startId: null, goalId: null, landmarkIds: [] };
  g = addNode(g, 0, 0, 'S');
  g = addNode(g, 100, 0, 'G');
  g = addNode(g, 500, 500, 'IsolatedLM'); // Disconnected landmark
  const [s, goal, isoLM] = g.nodes.map((n) => n.id);
  g = connect(g, s, goal, 10).graph;
  g = setStart(g, s);
  g = setGoal(g, goal);
  g = toggleLandmark(g, isoLM);

  const table = new LandmarkTable(g, g.landmarkIds);
  assert.equal(table.distance(isoLM, s), undefined, 'Distance to isolated landmark is undefined');

  const bd = landmarkBreakdown(table, s, goal);
  assert.equal(bd.value, 0, 'Heuristic falls back to 0 cleanly without NaN or Infinity');
  assert.equal(bd.terms[0].valid, false, 'Term marked invalid');

  const res = search(g, 'landmark');
  assert.equal(res.success, true, 'Search succeeds despite isolated landmark');
  assert.deepEqual(res.path, [s, goal]);
});

// ── Test 9: Comparison of All 3 Heuristics ───────────────────────
test('9. CompareAll executes Zero, Euclidean, and Landmark on same graph', () => {
  const g = PRESETS.find((p) => p.key === 'city')!.make();
  const cmp = compareAll(g);

  assert(cmp.zero !== undefined, 'Zero heuristic ran');
  assert(cmp.euclidean !== undefined, 'Euclidean heuristic ran');
  assert(cmp.landmark !== undefined, 'Landmark heuristic ran');

  assert.equal(cmp.zero.totalNodes, g.nodes.length);
  assert.equal(cmp.euclidean.totalNodes, g.nodes.length);
  assert.equal(cmp.landmark.totalNodes, g.nodes.length);

  assert(cmp.landmark.executionTimeMs >= 0, 'Execution time measured');
});

console.log('\n================================================================');
console.log(`RESULTS: ${passedTests} / ${totalTests} test suites passed.`);
console.log('================================================================\n');

if (passedTests === totalTests) {
  console.log('ALL ALGORITHM TESTS PASSED SUCCESSFULLY! ✓\n');
} else {
  process.exit(1);
}

