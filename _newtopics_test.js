// Independent verification of the 3 new topics in index.html. No npm deps, no libraries.
// Re-derives every answer from first principles (Euclid for HCF/LCM, the actual formulas)
// and cross-checks it against the content + samples the new drill generators.
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const html = fs.readFileSync('index.html', 'utf8');

// --- extract DATA ---
function extractAssignment(name) {
  const marker = 'const ' + name + ' = ';
  const s = html.indexOf(marker);
  if (s < 0) throw new Error('Missing: ' + marker);
  const bb = html.slice(s + marker.length);
  let d = 0, end = -1; const open = bb[0], close = open === '[' ? ']' : '}';
  for (let i = 0; i < bb.length; i++) { if (bb[i] === open) d++; else if (bb[i] === close) { d--; if (d === 0) { end = i; break; } } }
  return eval('(' + bb.slice(0, end + 1) + ')');
}
const DATA = extractAssignment('DATA');
const topics = DATA.maths.topics;
function topic(t) { const x = topics.find(z => z.title === t); if (!x) throw new Error('Topic missing: ' + t); return x; }

// independent helpers (re-derived, not read from content)
function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a; }
function lcm(a, b) { return a * b / gcd(a, b); }
function digits(s) { const m = String(s).replace(/&#?\w+;/g, '').match(/-?\d+/); return m ? parseInt(m[0], 10) : NaN; }
function ansText(q) { return q.type === 'mcq' ? q.opts[q.ans] : String(q.ans); }

let pass = 0, fail = 0;
function check(name, cond, detail) { if (cond) { pass++; } else { fail++; console.log('  FAIL', name, detail || ''); } }

// ===== Factors / HCF / LCM =====
const f = topic('Numbers: Factors, HCF & LCM').practice;
check('HCF(12,18)=6', digits(ansText(f[0])) === gcd(12, 18));
check('LCM(4,6)=12', digits(ansText(f[1])) === lcm(4, 6));
check('48 = 2^4 x 3', (2 ** 4 * 3) === 48 && f[2].ans === 1, 'opt index ' + f[2].ans);
check('HCF(24,36)=12', digits(ansText(f[3])) === gcd(24, 36));
check('LCM(24,36)=72', digits(ansText(f[4])) === lcm(24, 36));

// ===== Time & Measures =====
const t = topic('Time and Measures').practice;
check('2.5h = 150min', digits(ansText(t[0])) === 2.5 * 60);
check('2 days = 48h', digits(ansText(t[1])) === 2 * 24);
check('1500 -> 3:00 pm', /3:00\s*pm/i.test(ansText(t[2])), ansText(t[2]));
check('45+30 min -> 15 (minutes part, carry 1h)', digits(ansText(t[3])) === (45 + 30) % 60);

// ===== Money: Exchange & Hire Purchase =====
const m = topic('Money: Exchange Rates & Hire Purchase').practice;
check('5 USD @28 = 140 ZWL', digits(ansText(m[0])) === 5 * 28);
check('84 ZWL @28 = 3 USD', digits(ansText(m[1])) === 84 / 28);
check('HP 50 + 6x20 = 170', digits(ansText(m[2])) === 50 + 6 * 20);
check('HP extra 170-150 = 20', digits(ansText(m[3])) === 170 - 150);

// ===== Drill generators: sample + independent re-verify =====
const dsStart = html.indexOf('function randInt');
const dsEnd = html.indexOf('// DRILL SOUND EFFECTS', dsStart);
const ctx = { console, Math }; vm.createContext(ctx);
vm.runInContext(html.slice(dsStart, dsEnd) + '\nglobalThis.__D = DRILL_TOPICS;', ctx);
['hcflcm', 'timemeasures', 'moneyhp'].forEach(id => {
  const gen = ctx.__D.find(x => x.id === id);
  check('drill exists: ' + id, !!gen);
  if (!gen) return;
  let bad = 0;
  for (let i = 0; i < 3000; i++) {
    const q = gen.generate();
    // independent truth, NOT q._verify
    let truth;
    if (id === 'hcflcm') truth = q._isHCF ? gcd(q._a, q._b) : lcm(q._a, q._b);
    else if (id === 'timemeasures') truth = q._t === 0 ? q._v * 60 : q._v * 24;
    else truth = q._t === 0 ? q._usd * q._rate : q._dep + q._n * q._inst;
    if (!Number.isInteger(q.answer) || q.answer !== truth) bad++;
  }
  check('drill 3000 samples match independent truth: ' + id, bad === 0, bad + ' mismatches');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
