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

function fakeBank(perTopic, topics) {
  const bank = [];
  topics.forEach(t => { for (let i = 0; i < perTopic; i++)
    bank.push({ topic: t, difficulty: ['easy','medium','exam'][i%3], marks: 2, q: t+i, answer: '1', exp: 'x', isCoord: false }); });
  return bank;
}

H.test('assembleTeamBout: size = players*2 capped at 12, even per player', () => {
  const bank = fakeBank(10, ['A','B','C','D','E','F']);
  const b3 = H.ctx.assembleTeamBout(bank, 3, { seed: 1 });
  H.assert(b3.length === 6, '3 players -> 6, got ' + b3.length);
  const b5 = H.ctx.assembleTeamBout(bank, 5, { seed: 1 });
  H.assert(b5.length === 10, '5 players -> 10, got ' + b5.length);
  const b7 = H.ctx.assembleTeamBout(bank, 7, { seed: 1 }); // 14 -> cap 12 -> multiple of 7 <=12 = 7
  H.assert(b7.length === 7, '7 players -> 7, got ' + b7.length);
});

H.test('assembleTeamBout: shrinks to whole multiple when bank is small', () => {
  const bank = fakeBank(2, ['A']); // only 2 questions, 3 players -> can't give 1 each (need 3)
  const b3 = H.ctx.assembleTeamBout(bank, 3, { seed: 1 });
  H.assert(b3.length === 0, 'too-small bank -> empty, got ' + b3.length);
  const bank2 = fakeBank(3, ['A']); // 3 questions, 3 players -> 1 each = 3
  const b3b = H.ctx.assembleTeamBout(bank2, 3, { seed: 1 });
  H.assert(b3b.length === 3, '3 q / 3 players -> 3, got ' + b3b.length);
});

H.test('assembleTeamBout: deterministic for same seed, varied topics', () => {
  const bank = fakeBank(10, ['A','B','C','D','E','F']);
  const x = H.ctx.assembleTeamBout(bank, 4, { seed: 9 });
  const y = H.ctx.assembleTeamBout(bank, 4, { seed: 9 });
  H.assert(JSON.stringify(x) === JSON.stringify(y), 'not deterministic');
  const distinctTopics = new Set(x.map(q => q.topic)).size;
  H.assert(distinctTopics >= 4, 'should spread across topics, got ' + distinctTopics);
});

// ---- INSERT NEW TESTS ABOVE THIS LINE ----
H.run();
