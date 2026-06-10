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
  ['topicReadiness','applyDecay','examReadiness','predictedGrade','studyNext','readinessRank','xpForReadinessLift','ZIMSEC_WEIGHTS','topicExamWeight','studyImpact']
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

H.test('examReadiness: overall = mean across ALL topics (untouched drags down)', () => {
  const topics = [{title:'A',marks:10},{title:'B',marks:10},{title:'C',marks:10}];
  const store = { maths:{scores:{t0:90}}, sparring:{readiness:{}}, drillMastery:{}, readiness:{touched:{}} };
  const now = Date.UTC(2026,0,20);
  const r = H.ctx.examReadiness(store, topics, now, null);
  H.assert(r.overall === 30, 'got ' + r.overall);
  H.assert(r.perTopic.length === 3);
  H.assert(r.perTopic[0].readiness === 90 && r.perTopic[1].readiness === 0);
});
H.test('studyNext: lowest readiness first, marks tiebreak', () => {
  const perTopic = [
    {idx:0,title:'A',readiness:20,marks:6},
    {idx:1,title:'B',readiness:20,marks:10},
    {idx:2,title:'C',readiness:80,marks:10}
  ];
  const top = H.ctx.studyNext(perTopic, 2);
  H.assert(top[0].title === 'B' && top[1].title === 'A', 'order ' + top.map(t=>t.title));
});
H.test('xpForReadinessLift: scales with gap, ~0 for re-grinding mastered', () => {
  H.assert(H.ctx.xpForReadinessLift(40, 60) > H.ctx.xpForReadinessLift(40, 45), 'bigger lift more xp');
  H.assert(H.ctx.xpForReadinessLift(85, 88) <= 2, 'mastered re-grind tiny');
  H.assert(H.ctx.xpForReadinessLift(60, 55) === 0, 'no negative xp');
});

H.test('topicExamWeight: freq*marks, neutral default for missing', () => {
  const w = { Algebra: { freq: 80, marks: 10, diff: 2 } };
  H.assert(H.ctx.topicExamWeight(w, 'Algebra') === 8, 'got ' + H.ctx.topicExamWeight(w,'Algebra')); // .8*10
  H.assert(H.ctx.topicExamWeight(w, 'Missing') === 3, 'neutral .5*6=3, got ' + H.ctx.topicExamWeight(w,'Missing'));
});
H.test('ZIMSEC_WEIGHTS: an object covering topics with freq/marks/diff', () => {
  const w = H.ctx.ZIMSEC_WEIGHTS;
  H.assert(w && typeof w === 'object', 'exists');
  const keys = Object.keys(w);
  H.assert(keys.length >= 30, 'covers most topics: ' + keys.length);
  const sample = w[keys[0]];
  H.assert(typeof sample.freq === 'number' && typeof sample.marks === 'number', 'well-formed');
});

H.test('examReadiness: weighted overall favours high-weight topics; no-weights = plain mean', () => {
  const topics = [{title:'A',marks:10},{title:'B',marks:10}];
  const store = { maths:{scores:{t0:90,t1:10}}, sparring:{readiness:{}}, drillMastery:{}, readiness:{touched:{}} };
  const now = Date.UTC(2026,0,20);
  const weights = { A:{freq:90,marks:10,diff:2}, B:{freq:20,marks:2,diff:1} };
  const rw = H.ctx.examReadiness(store, topics, now, null, weights);
  H.assert(rw.overall === 87, 'weighted got ' + rw.overall);            // pulled toward mastered high-weight A
  H.assert(typeof rw.perTopic[0].weight === 'number', 'perTopic carries weight');
  const rm = H.ctx.examReadiness(store, topics, now, null);             // no weights -> plain mean
  H.assert(rm.overall === 50, 'plain mean got ' + rm.overall);
});
H.test('studyImpact: weak high-weight beats weaker low-weight; mastered excluded; marksAtStake', () => {
  const perTopic = [
    {idx:0,title:'A',readiness:30,marks:10,weight:9},
    {idx:1,title:'B',readiness:20,marks:2,weight:0.4},
    {idx:2,title:'C',readiness:90,marks:10,weight:9}
  ];
  const top = H.ctx.studyImpact(perTopic, 3);
  H.assert(top.length === 2, 'mastered C excluded, got ' + top.length);
  H.assert(top[0].title === 'A', 'high-weight weak first, got ' + top[0].title);
  H.assert(top[0].marksAtStake === 7, 'A marks at stake = round(.7*10)=7, got ' + top[0].marksAtStake);
});

// ---- INSERT NEW TESTS ABOVE THIS LINE ----
H.run();
