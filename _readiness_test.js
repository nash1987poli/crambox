// Node harness for the READINESS MODULE in index.html. No npm deps.
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const html = fs.readFileSync('index.html', 'utf8');

function extractBlock(start, end) {
  const a = html.indexOf(start), b = html.indexOf(end);
  if (a < 0 || b < 0) throw new Error('READINESS markers not found');
  return html.slice(a + start.length, b);
}
const src = extractBlock('// ===== READINESS MODULE START =====', '// ===== READINESS MODULE END =====');
const ctx = { console, Math, Date };
vm.createContext(ctx);
vm.runInContext(
  src + '\n' +
  ['topicReadiness','applyDecay','examReadiness','predictedGrade','studyNext','readinessRank','xpForReadinessLift']
    .map(n => `globalThis.${n}=typeof ${n}!=="undefined"?${n}:undefined;`).join(''),
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
module.exports = { test, run, ctx, assert };
const H = module.exports;

H.test('predictedGrade: bands at boundaries', () => {
  H.assert(H.ctx.predictedGrade(75) === 'A');
  H.assert(H.ctx.predictedGrade(74) === 'B');
  H.assert(H.ctx.predictedGrade(60) === 'B');
  H.assert(H.ctx.predictedGrade(50) === 'C');
  H.assert(H.ctx.predictedGrade(40) === 'D');
  H.assert(H.ctx.predictedGrade(30) === 'E');
  H.assert(H.ctx.predictedGrade(29) === 'U');
});
H.test('readinessRank: maps % to rank name', () => {
  H.assert(H.ctx.readinessRank(0).name === 'Beginner');
  H.assert(H.ctx.readinessRank(100).name === 'Exam Ready');
  H.assert(typeof H.ctx.readinessRank(55).name === 'string');
});

H.test('topicReadiness: single signal used directly', () => {
  const store = { maths: { scores: { t0: 80 } }, sparring: { readiness: {} }, drillMastery: {} };
  H.assert(H.ctx.topicReadiness(store, 0, 'Algebra') === 80, 'practice-only');
  const store2 = { maths:{scores:{}}, sparring:{ readiness:{ Algebra: 60 } }, drillMastery:{} };
  H.assert(H.ctx.topicReadiness(store2, 0, 'Algebra') === 60, 'spar-only');
});
H.test('topicReadiness: multi-signal renormalised weighted blend', () => {
  const store = { maths:{scores:{t0:80}}, sparring:{readiness:{Algebra:60}}, drillMastery:{} };
  H.assert(H.ctx.topicReadiness(store, 0, 'Algebra') === 70, 'got ' + H.ctx.topicReadiness(store,0,'Algebra'));
});
H.test('topicReadiness: untouched topic = 0', () => {
  const store = { maths:{scores:{}}, sparring:{readiness:{}}, drillMastery:{} };
  H.assert(H.ctx.topicReadiness(store, 5, 'Vectors') === 0);
});

const DAY = 86400000;
H.test('applyDecay: no decay within grace window', () => {
  const now = Date.UTC(2026,0,20), touched = now - 10*DAY;
  H.assert(H.ctx.applyDecay(80, touched, now, 999) === 80, 'within 14d grace');
});
H.test('applyDecay: linear decay after grace, floored at 50% base', () => {
  const now = Date.UTC(2026,0,20);
  const t24 = now - 24*DAY;
  H.assert(H.ctx.applyDecay(80, t24, now, 999) === 70, 'got ' + H.ctx.applyDecay(80,t24,now,999));
  const tOld = now - 400*DAY;
  H.assert(H.ctx.applyDecay(80, tOld, now, 999) === 40, 'floor 50% of 80');
});
H.test('applyDecay: accelerates near exam', () => {
  const now = Date.UTC(2026,0,20);
  const t = now - 10*DAY;
  const v = H.ctx.applyDecay(80, t, now, 14);
  H.assert(v === 74, 'got ' + v);
});
H.test('applyDecay: base 0 stays 0', () => {
  H.assert(H.ctx.applyDecay(0, Date.UTC(2026,0,1), Date.UTC(2026,0,20), 999) === 0);
});

// ---- INSERT NEW TESTS ABOVE THIS LINE ----
H.run();
