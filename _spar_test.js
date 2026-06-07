// Node test harness for the SPAR MODULE in index.html. No npm deps.
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const html = fs.readFileSync('index.html', 'utf8');

function extractBlock(start, end) {
  const a = html.indexOf(start);
  const b = html.indexOf(end);
  if (a < 0 || b < 0) throw new Error('SPAR markers not found in index.html');
  return html.slice(a + start.length, b);
}

// Extract the balanced object/array literal after a "const NAME = " marker (for SPAR_BANK / DATA).
function extractAssignment(name) {
  const marker = 'const ' + name + ' = ';
  const s = html.indexOf(marker);
  if (s < 0) throw new Error('Missing: ' + marker);
  const bb = html.slice(s + marker.length);
  let depth = 0, end = -1; const open = bb[0];
  const close = open === '[' ? ']' : '}';
  for (let i = 0; i < bb.length; i++) {
    if (bb[i] === open) depth++;
    else if (bb[i] === close) { depth--; if (depth === 0) { end = i; break; } }
  }
  return eval('(' + bb.slice(0, end + 1) + ')');
}

// Build a sandbox: pull in the pure SPAR functions only.
const sparSrc = extractBlock('// ===== SPAR MODULE START =====', '// ===== SPAR MODULE END =====');
const ctx = { console, Math, Date };
vm.createContext(ctx);
// Expose the pure functions to the test context.
vm.runInContext(
  sparSrc + '\n' +
  'globalThis.sparReadiness = typeof sparReadiness!=="undefined"?sparReadiness:undefined;' +
  'globalThis.assembleBout = typeof assembleBout!=="undefined"?assembleBout:undefined;' +
  'globalThis.boutTimeBudget = typeof boutTimeBudget!=="undefined"?boutTimeBudget:undefined;' +
  'globalThis.clockState = typeof clockState!=="undefined"?clockState:undefined;' +
  'globalThis.matchSparAnswer = typeof matchSparAnswer!=="undefined"?matchSparAnswer:undefined;',
  ctx
);

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

function run() {
  let pass = 0, fail = 0;
  for (const t of tests) {
    try { t.fn(); console.log('  PASS', t.name); pass++; }
    catch (e) { console.log('  FAIL', t.name, '\n        ', e.message); fail++; }
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

module.exports = { test, run, ctx, extractAssignment, assert };

// ================= TEST SUITE =================
const H = module.exports;
const DATA = H.extractAssignment('DATA');
const BANK = H.extractAssignment('SPAR_BANK');
const titles = new Set(DATA.maths.topics.map(t => t.title));

H.test('SPAR_BANK: every item is well-formed', () => {
  H.assert(Array.isArray(BANK) && BANK.length > 0, 'bank empty');
  for (const q of BANK) {
    H.assert(titles.has(q.topic), 'bad topic: ' + q.topic);
    H.assert(['easy','medium','exam'].includes(q.difficulty), 'bad difficulty: ' + q.difficulty);
    H.assert(Number.isInteger(q.marks) && q.marks > 0, 'bad marks on: ' + q.q);
    H.assert(q.q && q.exp && (q.answer !== undefined && q.answer !== ''), 'missing q/answer/exp: ' + q.q);
    if (q.isCoord) H.assert(Array.isArray(q.coordPair) && q.coordPair.length === 2, 'bad coordPair: ' + q.q);
  }
});

H.test('sparReadiness: known topics use stored %, unknown topics default low', () => {
  const topics = ['Transformations','Probability','Vectors'];
  const store = { maths: { scores: { t0: 58, t2: 90 } } };
  const r = H.ctx.sparReadiness(store, topics);
  H.assert(r['Transformations'] === 58, 'got ' + r['Transformations']);
  H.assert(r['Vectors'] === 90, 'got ' + r['Vectors']);
  H.assert(r['Probability'] === 0, 'unknown should be 0, got ' + r['Probability']);
});

// ---- INSERT NEW TESTS ABOVE THIS LINE ----
H.run();
