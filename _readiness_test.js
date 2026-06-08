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

// ---- INSERT NEW TESTS ABOVE THIS LINE ----
H.run();
