// Node harness for the TEAM SPAR MODULE in index.html. No npm deps.
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const html = fs.readFileSync('index.html', 'utf8');

function extractBlock(start, end) {
  const a = html.indexOf(start), b = html.indexOf(end);
  if (a < 0 || b < 0) throw new Error('Markers not found: ' + start);
  return html.slice(a + start.length, b);
}
function extractAssignment(name) {
  const marker = 'const ' + name + ' = ';
  const s = html.indexOf(marker);
  if (s < 0) throw new Error('Missing: ' + marker + ' (build the Invigilator plan first?)');
  const bb = html.slice(s + marker.length);
  let depth = 0, end = -1; const open = bb[0], close = open === '[' ? ']' : '}';
  for (let i = 0; i < bb.length; i++) {
    if (bb[i] === open) depth++;
    else if (bb[i] === close) { depth--; if (depth === 0) { end = i; break; } }
  }
  return eval('(' + bb.slice(0, end + 1) + ')');
}

// Pull in BOTH modules so reused helpers (_grade, matchSparAnswer) resolve.
const sparSrc = extractBlock('// ===== SPAR MODULE START =====', '// ===== SPAR MODULE END =====');
const teamSrc = extractBlock('// ===== TEAM SPAR MODULE START =====', '// ===== TEAM SPAR MODULE END =====');
const ctx = { console, Math, Date };
vm.createContext(ctx);
vm.runInContext(
  sparSrc + '\n' + teamSrc + '\n' +
  'globalThis.assembleTeamBout = typeof assembleTeamBout!=="undefined"?assembleTeamBout:undefined;' +
  'globalThis.teamLeaderboard = typeof teamLeaderboard!=="undefined"?teamLeaderboard:undefined;' +
  'globalThis._grade = typeof _grade!=="undefined"?_grade:undefined;' +
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

// ---- INSERT NEW TESTS ABOVE THIS LINE ----
H.run();
