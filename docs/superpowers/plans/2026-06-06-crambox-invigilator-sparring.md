# Spar with the Invigilator — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an adaptive, offline AI sparring mode to CramBox where an "Invigilator" hunts the student's weak topics and tests them under a marks-based bout timer, using an AI question bank baked into the HTML at build time.

**Architecture:** Everything lives in the single self-contained file `index.html` (then synced to `CramBox-Mathematics-4004.html`). No backend, no runtime API, no exposed key. New pure-logic functions (readiness, bout assembly, timer budget) are testable via Node scripts that extract code from the HTML — the same pattern the repo already uses in `_verify.py`. Grading reuses the existing `answersMatch` + `isCoord` coordinate logic.

**Tech Stack:** Vanilla JS in one HTML file, `localStorage` (key `crambox`), Node.js for the test/verification harness (no npm install — uses built-in `vm`/`fs`/`assert`). Deployed on Vercel (`zimsec-prep`).

---

## Key codebase facts the implementer must know

- **Store:** `getStore()` returns `JSON.parse(localStorage['crambox'] || '{}')`; `setStore(d)` writes it. Per-topic **best** score lives at `store.maths.scores['t'+idx]` as an integer percent, where `idx` is the index into `DATA.maths.topics[]`. `DATA.maths.topics[idx].title` is the canonical topic name.
- **XP/streak:** `addXP(amount, reason)` and `recordStreak()` already exist and update the home UI.
- **Navigation:** screens are `<div class="screen" id="...">`; switch with `history.push(screen); showScreen('id')`. `goBack()` pops `history`. The global `screen` holds the current id.
- **Answer matching (reuse, do NOT reinvent):**
  - `answersMatch(input, correct)` — handles text + numeric equivalence (entities, symbols, `090`==`90`).
  - Coordinate questions carry `isCoord:true` + `coordPair:[x,y]`; matched by extracting `value.match(/-?\d+/g)`.
- **Menu entry:** subject/mode cards are `<div class="subject-card" onclick="...">` (the Drill card is at `index.html:673`).
- **Two files must stay identical:** after all code changes, `CramBox-Mathematics-4004.html` is overwritten with `index.html` (verified by hash). This is already the repo convention.
- **Marker convention for tests:** all new sparring JS goes between the exact comment markers `// ===== SPAR MODULE START =====` and `// ===== SPAR MODULE END =====` so the Node harness can extract and `vm`-run it in isolation.

---

## File structure

| File | Responsibility | Action |
|---|---|---|
| `index.html` | All feature code (data, logic, screens, controller) inside the SPAR markers + 3 new screen `<div>`s + 1 menu card | Modify |
| `CramBox-Mathematics-4004.html` | WhatsApp distribution copy, byte-identical to `index.html` | Overwrite (final task) |
| `_spar_test.js` | Node test harness: extracts the SPAR MODULE block, `vm`-runs it with a stub `DATA`/`store`, asserts behaviour of the pure functions + bank integrity | Create |

All sparring **logic** is written as pure functions that take their inputs as arguments (store, bank, readiness map) so they can be unit-tested headlessly. The DOM controller calls those pure functions.

---

## Task 1: Node test harness

**Files:**
- Create: `_spar_test.js`

- [ ] **Step 1: Write the harness that extracts and runs the SPAR module**

Create `_spar_test.js`:

```js
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

// Extract the balanced object literal after a "const NAME = " marker (for SPAR_BANK).
function extractAssignment(name) {
  const marker = 'const ' + name + ' = ';
  const s = html.indexOf(marker);
  if (s < 0) throw new Error('Missing: ' + marker);
  const bb = html.slice(s + marker.length);
  let depth = 0, end = -1, open = bb[0];
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

// ---- tests are appended below by later tasks ----
module.exports = { test, run, ctx, extractAssignment, assert };

function run() {
  let pass = 0, fail = 0;
  for (const t of tests) {
    try { t.fn(); console.log('  PASS', t.name); pass++; }
    catch (e) { console.log('  FAIL', t.name, '\n        ', e.message); fail++; }
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
```

> Note: This task's harness references the SPAR markers and functions that later tasks create. It will only run green once Tasks 2–5 add those. That is expected for a test-first harness.

- [ ] **Step 2: Add the SPAR markers to index.html so extraction won't crash**

In `index.html`, immediately **after** the `const DATA = { ... };` block (after the closing `};` near `index.html:1743`), insert:

```js
// ===== SPAR MODULE START =====
// ===== SPAR MODULE END =====
```

- [ ] **Step 3: Run the harness to confirm it loads**

Run: `node -e "require('./_spar_test.js')"`
Expected: no output, exit 0 (markers found, empty module runs clean).

- [ ] **Step 4: Commit**

```bash
git add _spar_test.js index.html
git commit -m "test: add Node harness + SPAR module markers"
```

---

## Task 2: SPAR_BANK prototype (Transformations) + integrity test

**Files:**
- Modify: `index.html` (inside SPAR markers)
- Modify: `_spar_test.js`

- [ ] **Step 1: Write the failing bank-integrity test**

Append to `_spar_test.js` (before the final `run();` you will add in Step 5 of this task — for now add a temporary `run()` call at the very end while iterating, then remove it; the canonical runner call is added in Task 10):

```js
const { extractAssignment, assert } = module.exports;
const DATA = extractAssignment('DATA');
const BANK = extractAssignment('SPAR_BANK');
const titles = new Set(DATA.maths.topics.map(t => t.title));

module.exports.test('SPAR_BANK: every item is well-formed', () => {
  assert(Array.isArray(BANK) && BANK.length > 0, 'bank empty');
  for (const q of BANK) {
    assert(titles.has(q.topic), 'bad topic: ' + q.topic);
    assert(['easy','medium','exam'].includes(q.difficulty), 'bad difficulty: ' + q.difficulty);
    assert(Number.isInteger(q.marks) && q.marks > 0, 'bad marks on: ' + q.q);
    assert(q.q && q.exp && (q.answer !== undefined && q.answer !== ''), 'missing q/answer/exp: ' + q.q);
    if (q.isCoord) assert(Array.isArray(q.coordPair) && q.coordPair.length === 2, 'bad coordPair: ' + q.q);
  }
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node _spar_test.js`
Expected: FAIL with "Missing: const SPAR_BANK = " (bank doesn't exist yet).

- [ ] **Step 3: Add the prototype bank inside the SPAR markers**

Inside the SPAR markers in `index.html`, add a starter bank for **Transformations** only (topic title must exactly match `DATA.maths.topics[].title`). Use the same HTML-entity conventions as existing `practice[]`:

```js
const SPAR_BANK = [
  { topic:'Transformations', difficulty:'easy', marks:2, isCoord:true, coordPair:[5,-3],
    q:'Reflect the point (5, 3) in the x-axis. Give the image point.',
    answer:'(5, -3)', exp:'In the x-axis: (x, y) &#8594; (x, -y) = (5, -3)' },
  { topic:'Transformations', difficulty:'easy', marks:2, isCoord:true, coordPair:[-4,2],
    q:'Reflect the point (4, 2) in the y-axis. Give the image point.',
    answer:'(-4, 2)', exp:'In the y-axis: (x, y) &#8594; (-x, y) = (-4, 2)' },
  { topic:'Transformations', difficulty:'medium', marks:2, isCoord:true, coordPair:[-3,-7],
    q:'The point (3, 7) is rotated 180&#176; about the origin. State the image point.',
    answer:'(-3, -7)', exp:'180&#176; about O: (x, y) &#8594; (-x, -y) = (-3, -7)' },
  { topic:'Transformations', difficulty:'medium', marks:3, isCoord:true, coordPair:[6,1],
    q:'Translate the point (2, 4) by the vector (4 &nbsp;-3). Give the image point.',
    answer:'(6, 1)', exp:'(2+4, 4+(-3)) = (6, 1)' },
  { topic:'Transformations', difficulty:'exam', marks:3, isCoord:true, coordPair:[2,5],
    q:'A point P(5, 2) is reflected in the line y = x. Write down the coordinates of its image.',
    answer:'(2, 5)', exp:'Reflection in y = x swaps coordinates: (5, 2) &#8594; (2, 5)' },
  { topic:'Transformations', difficulty:'exam', marks:4, isCoord:true, coordPair:[-1,-6],
    q:'The point (1, 6) is first reflected in the y-axis, then in the x-axis. Give the final image point.',
    answer:'(-1, -6)', exp:'y-axis: (1,6)&#8594;(-1,6). Then x-axis: (-1,6)&#8594;(-1,-6).' },
  { topic:'Transformations', difficulty:'easy', marks:2, isCoord:true, coordPair:[0,-4],
    q:'Reflect the point (0, 4) in the x-axis. Give the image point.',
    answer:'(0, -4)', exp:'In the x-axis: (x, y) &#8594; (x, -y) = (0, -4)' },
  { topic:'Transformations', difficulty:'medium', marks:3, isCoord:true, coordPair:[-2,-1],
    q:'Translate the point (3, 2) by the vector (-5 &nbsp;-3). Give the image point.',
    answer:'(-2, -1)', exp:'(3+(-5), 2+(-3)) = (-2, -1)' }
];
```

- [ ] **Step 4: Run to verify it passes**

Run: `node _spar_test.js`
Expected: PASS "SPAR_BANK: every item is well-formed".

- [ ] **Step 5: Commit**

```bash
git add index.html _spar_test.js
git commit -m "feat: add SPAR_BANK prototype (Transformations) + integrity test"
```

---

## Task 3: Readiness model (`sparReadiness`)

**Files:**
- Modify: `index.html` (inside SPAR markers)
- Modify: `_spar_test.js`

- [ ] **Step 1: Write the failing test**

Append to `_spar_test.js`:

```js
module.exports.test('sparReadiness: maps stored topic scores to readiness, unknown = low', () => {
  const { sparReadiness } = require('vm') && global; // functions are on ctx via harness
});
```

Replace the line above with a real test that uses the harness `ctx`. Append instead:

```js
const H = module.exports;
H.test('sparReadiness: known topics use stored %, unknown topics default low', () => {
  const topics = ['Transformations','Probability','Vectors'];
  // store: best scores keyed t<idx>; idx matches order of `topics` passed in
  const store = { maths: { scores: { t0: 58, t2: 90 } } };
  const r = H.ctx.sparReadiness(store, topics);
  H.assert(r['Transformations'] === 58, 'got ' + r['Transformations']);
  H.assert(r['Vectors'] === 90, 'got ' + r['Vectors']);
  H.assert(r['Probability'] === 0, 'unknown should be 0, got ' + r['Probability']);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node _spar_test.js`
Expected: FAIL ("sparReadiness is not a function" / undefined).

- [ ] **Step 3: Implement `sparReadiness` inside the SPAR markers**

```js
// Readiness % per topic, derived from best practice scores already in the store.
// topicTitles: array of DATA.maths.topics[].title in index order. Unknown/untouched = 0 (probe early).
function sparReadiness(store, topicTitles) {
  const scores = (store && store.maths && store.maths.scores) || {};
  const out = {};
  topicTitles.forEach((title, idx) => {
    const v = scores['t' + idx];
    out[title] = (typeof v === 'number') ? v : 0;
  });
  return out;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node _spar_test.js`
Expected: PASS the readiness test (bank test still passes too).

- [ ] **Step 5: Commit**

```bash
git add index.html _spar_test.js
git commit -m "feat: add sparReadiness model + test"
```

---

## Task 4: Bout assembly (`assembleBout`)

**Files:**
- Modify: `index.html` (inside SPAR markers)
- Modify: `_spar_test.js`

- [ ] **Step 1: Write the failing test**

Append to `_spar_test.js`:

```js
H.test('assembleBout: weights toward weakest topics, respects mastery, deterministic', () => {
  const readiness = { Transformations: 20, Probability: 35, Vectors: 95 }; // Vectors mastered
  const bank = [];
  ['Transformations','Probability','Vectors'].forEach(t => {
    for (let i=0;i<6;i++) bank.push({ topic:t, difficulty:'easy', marks:2, q:t+i, answer:'1', exp:'x' });
  });
  const bout = H.ctx.assembleBout(readiness, bank, { size: 6, masteryThreshold: 80, seed: 1 });
  H.assert(bout.length === 6, 'size ' + bout.length);
  // No mastered-topic questions should appear (Vectors >= 80 and others available)
  H.assert(bout.every(q => q.topic !== 'Vectors'), 'mastered topic leaked in');
  // Majority (>=60%) drawn from the two weakest topics
  const weak = bout.filter(q => q.topic==='Transformations' || q.topic==='Probability').length;
  H.assert(weak >= 4, 'not weighted to weak topics: ' + weak);
  // Deterministic for same seed
  const bout2 = H.ctx.assembleBout(readiness, bank, { size: 6, masteryThreshold: 80, seed: 1 });
  H.assert(JSON.stringify(bout) === JSON.stringify(bout2), 'not deterministic');
});

H.test('assembleBout: all-mastered falls back to a mixed championship bout', () => {
  const readiness = { Transformations: 90, Probability: 95 };
  const bank = [];
  ['Transformations','Probability'].forEach(t => { for(let i=0;i<6;i++) bank.push({topic:t,difficulty:'exam',marks:3,q:t+i,answer:'1',exp:'x'}); });
  const bout = H.ctx.assembleBout(readiness, bank, { size: 6, masteryThreshold: 80, seed: 2 });
  H.assert(bout.length === 6, 'should still produce a bout');
});

H.test('assembleBout: shrinks gracefully when bank too small', () => {
  const readiness = { Transformations: 10 };
  const bank = [ {topic:'Transformations',difficulty:'easy',marks:2,q:'a',answer:'1',exp:'x'},
                 {topic:'Transformations',difficulty:'easy',marks:2,q:'b',answer:'1',exp:'x'} ];
  const bout = H.ctx.assembleBout(readiness, bank, { size: 6, masteryThreshold: 80, seed: 3 });
  H.assert(bout.length === 2, 'should shrink to available: ' + bout.length);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node _spar_test.js`
Expected: FAIL ("assembleBout is not a function").

- [ ] **Step 3: Implement `assembleBout` inside the SPAR markers**

```js
// Deterministic seeded RNG (mulberry32) so bouts are testable.
function _sparRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function _shuffleSeeded(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i],a[j]]=[a[j],a[i]]; }
  return a;
}

// Build a bout: ~70% from weakest non-mastered topics, ~30% from the rest.
// readiness: {title:0-100}. bank: SPAR_BANK array. opts: {size, masteryThreshold, seed}.
function assembleBout(readiness, bank, opts) {
  const size = opts.size || 6;
  const mastery = opts.masteryThreshold || 80;
  const rng = _sparRng(opts.seed || 1);

  // Rank topics weakest-first; deterministic tiebreak by title.
  const topics = Object.keys(readiness).sort((x, y) =>
    readiness[x] !== readiness[y] ? readiness[x] - readiness[y] : (x < y ? -1 : 1));

  let targetTopics = topics.filter(t => readiness[t] < mastery);
  let championship = false;
  if (targetTopics.length === 0) { targetTopics = topics; championship = true; } // all mastered

  const weakSet = new Set(targetTopics.slice(0, Math.max(2, Math.ceil(targetTopics.length / 2))));

  // Difficulty ladder: weaker topic -> easier first.
  const order = { easy: 0, medium: 1, exam: 2 };
  const pool = bank.filter(q => championship || readiness[q.topic] !== undefined);
  const fromWeak = _shuffleSeeded(pool.filter(q => weakSet.has(q.topic)), rng)
    .sort((a, b) => order[a.difficulty] - order[b.difficulty]);
  const fromRest = _shuffleSeeded(pool.filter(q => !weakSet.has(q.topic)), rng);

  const wantWeak = Math.round(size * 0.7);
  const bout = [];
  for (const q of fromWeak) { if (bout.length >= wantWeak) break; bout.push(q); }
  for (const q of fromRest) { if (bout.length >= size) break; bout.push(q); }
  // top up from anything left if still short
  if (bout.length < size) {
    for (const q of pool) { if (bout.length >= size) break; if (!bout.includes(q)) bout.push(q); }
  }
  return bout.slice(0, size);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node _spar_test.js`
Expected: PASS all three assembleBout tests.

- [ ] **Step 5: Commit**

```bash
git add index.html _spar_test.js
git commit -m "feat: add deterministic bout assembly + tests"
```

---

## Task 5: Timer budget (`boutTimeBudget`, `clockState`)

**Files:**
- Modify: `index.html` (inside SPAR markers)
- Modify: `_spar_test.js`

- [ ] **Step 1: Write the failing test**

Append to `_spar_test.js`:

```js
H.test('boutTimeBudget: marks * seconds-per-mark by intensity tier', () => {
  H.assert(H.ctx.boutTimeBudget(10, 0) === 600, 'tier0 = 60s/mark');
  H.assert(H.ctx.boutTimeBudget(10, 1) === 500, 'tier1 = 50s/mark');
  H.assert(H.ctx.boutTimeBudget(10, 2) === 400, 'tier2 = 40s/mark');
});
H.test('clockState: green normal, amber <=90s, red <=30s', () => {
  H.assert(H.ctx.clockState(120) === 'green');
  H.assert(H.ctx.clockState(90) === 'amber');
  H.assert(H.ctx.clockState(30) === 'red');
  H.assert(H.ctx.clockState(5) === 'red');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node _spar_test.js`
Expected: FAIL ("boutTimeBudget is not a function").

- [ ] **Step 3: Implement inside the SPAR markers**

```js
// Seconds-per-mark by intensity tier (tightens as the student sharpens).
const SPAR_SEC_PER_MARK = [60, 50, 40];
function boutTimeBudget(totalMarks, tier) {
  const spm = SPAR_SEC_PER_MARK[Math.min(tier || 0, SPAR_SEC_PER_MARK.length - 1)];
  return totalMarks * spm;
}
// Visual urgency for the countdown.
function clockState(secondsLeft) {
  if (secondsLeft <= 30) return 'red';
  if (secondsLeft <= 90) return 'amber';
  return 'green';
}
// Intensity tier derived from average readiness across targeted topics.
function sparIntensityTier(avgReadiness) {
  if (avgReadiness >= 75) return 2;
  if (avgReadiness >= 50) return 1;
  return 0;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node _spar_test.js`
Expected: PASS the timer tests.

- [ ] **Step 5: Commit**

```bash
git add index.html _spar_test.js
git commit -m "feat: add bout timer budget + clock urgency + intensity tier"
```

---

## Task 6: Shared answer matcher + store extension

**Files:**
- Modify: `index.html` (inside SPAR markers)
- Modify: `_spar_test.js`

- [ ] **Step 1: Write the failing test for `matchSparAnswer`**

Append to `_spar_test.js`. (We give the harness a stub `answersMatch` because the real one lives outside the SPAR markers; `matchSparAnswer` must work for coordinate questions without it, and delegate to `answersMatch` for the rest.)

```js
// Provide a stub answersMatch in the spar context for delegation tests.
H.ctx.answersMatch = (a, b) => String(a).replace(/\s/g,'').toLowerCase() === String(b).replace(/\s/g,'').toLowerCase();

H.test('matchSparAnswer: coordinate questions match via integer extraction', () => {
  const q = { isCoord: true, coordPair: [6, 1], answer: '(6, 1)' };
  H.assert(H.ctx.matchSparAnswer(q, '(6, 1)') === true);
  H.assert(H.ctx.matchSparAnswer(q, '6 1') === true);
  H.assert(H.ctx.matchSparAnswer(q, '6,1') === true);
  H.assert(H.ctx.matchSparAnswer(q, '1, 6') === false);
});
H.test('matchSparAnswer: non-coordinate delegates to answersMatch', () => {
  const q = { answer: '12' };
  H.assert(H.ctx.matchSparAnswer(q, ' 12 ') === true);
  H.assert(H.ctx.matchSparAnswer(q, '13') === false);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node _spar_test.js`
Expected: FAIL ("matchSparAnswer is not a function").

- [ ] **Step 3: Implement `matchSparAnswer` inside the SPAR markers**

```js
// Unified grader for spar questions. Coordinate questions are matched by integer
// extraction (mirrors the drill); everything else delegates to the existing answersMatch.
function matchSparAnswer(q, input) {
  if (q.isCoord) {
    const nums = (String(input).match(/-?\d+/g) || []).map(Number);
    return nums.length === 2 && nums[0] === q.coordPair[0] && nums[1] === q.coordPair[1];
  }
  return answersMatch(input, q.answer);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node _spar_test.js`
Expected: PASS both matcher tests.

- [ ] **Step 5: Add store helpers inside the SPAR markers (no separate unit test; covered by manual run in Task 8)**

```js
// Sparring store block lives under store.sparring; absent block = fresh start.
function getSparring() {
  const s = getStore();
  if (!s.sparring) s.sparring = { readiness: {}, bouts: [], intensityTier: 0 };
  return s.sparring;
}
function saveBoutResult(result) {
  const s = getStore();
  if (!s.sparring) s.sparring = { readiness: {}, bouts: [], intensityTier: 0 };
  s.sparring.bouts.push(result);
  if (s.sparring.bouts.length > 50) s.sparring.bouts = s.sparring.bouts.slice(-50);
  s.sparring.readiness = result.readinessAfter || s.sparring.readiness;
  s.sparring.intensityTier = result.intensityTier != null ? result.intensityTier : s.sparring.intensityTier;
  setStore(s);
}
```

> `getStore`/`setStore` exist outside the SPAR markers; in the live file they are in scope. The Node harness does not test these two functions (they touch `localStorage`); they are exercised manually in Task 8 Step 6.

- [ ] **Step 6: Run the full logic suite**

Run: `node _spar_test.js`
Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add index.html _spar_test.js
git commit -m "feat: add matchSparAnswer + sparring store helpers"
```

---

## Task 7: Sparring screens (HTML + CSS)

**Files:**
- Modify: `index.html` (add 3 screen `<div>`s near the other screens, ~`index.html:817`; add CSS in the `<style>` block)

- [ ] **Step 1: Add the three screens after the drill screen**

Insert after the `drillScreen` closing `</div>` (around `index.html:817`):

```html
<!-- ==================== SPAR: PRE-BOUT ==================== -->
<div class="screen" id="sparIntroScreen">
<div class="container">
  <div class="drill-q-card">
    <div class="q-num">The Invigilator</div>
    <p id="sparIntroLine" style="font-size:14px;color:var(--text);margin:10px 0">I've seen your record.</p>
    <div id="sparIntroFocus" style="font-size:13px;color:var(--text2);margin-bottom:6px"></div>
    <div id="sparIntroMeta" style="font-size:12px;color:var(--text2);margin-bottom:16px"></div>
    <button class="drill-check" style="width:100%" onclick="beginBout()">Begin</button>
  </div>
  <button class="submit-btn" onclick="goBack()" style="background:var(--bg2);color:var(--text);border:1px solid var(--border)">Not now</button>
</div>
</div>

<!-- ==================== SPAR: IN-BOUT ==================== -->
<div class="screen" id="sparScreen">
<div class="container">
  <div class="drill-counter">
    <span id="sparCount">Q1</span>
    <span class="drill-streak-badge spar-clock-green" id="sparClock">00:00</span>
    <span id="sparMarks">0 / 0 marks</span>
  </div>
  <div class="drill-q-card">
    <div class="q-num"><span id="sparTopicLabel"></span> <span id="sparMarkTag" style="color:var(--text2)"></span></div>
    <div class="drill-equation" id="sparQ" style="font-size:16px;line-height:1.5"></div>
    <div class="drill-input-row">
      <input type="text" class="drill-ans" id="sparAns" placeholder="?" autocomplete="off">
      <button class="drill-check" id="sparNextBtn" onclick="sparAdvance()">Next</button>
    </div>
    <div style="font-size:11px;color:var(--text2);margin-top:8px">The Invigilator is silent. No hints until the paper is done.</div>
  </div>
  <button class="submit-btn" onclick="endBout(true)" style="background:var(--bg2);color:var(--text);border:1px solid var(--border)">Hand in early</button>
</div>
</div>

<!-- ==================== SPAR: VERDICT ==================== -->
<div class="screen" id="sparVerdictScreen">
<div class="container">
  <div class="results-card">
    <div class="results-circle" id="sparVCircle"><span id="sparVPct">0%</span><small id="sparVMarks">0/0</small></div>
    <div class="results-msg" id="sparVerdictLine">The Invigilator considers...</div>
    <div class="results-det" id="sparReadinessBars" style="margin:14px 0;text-align:left"></div>
  </div>
  <div id="sparReview" style="margin-top:14px"></div>
  <button class="drill-check" style="width:100%;margin-top:14px" onclick="startSpar()">Spar again</button>
  <button class="submit-btn" onclick="goHome()" style="background:var(--bg2);color:var(--text);border:1px solid var(--border);margin-top:8px">Done</button>
</div>
</div>
```

- [ ] **Step 2: Add CSS for the clock states + readiness bars**

In the `<style>` block (near the drill styles), add:

```css
.spar-clock-green { background: var(--green-bg); color: var(--green); }
.spar-clock-amber { background: #4a3a00; color: var(--gold); }
.spar-clock-red   { background: var(--red-bg); color: var(--red); }
.spar-bar { margin:6px 0; }
.spar-bar-label { font-size:12px; color:var(--text2); display:flex; justify-content:space-between; }
.spar-bar-track { height:8px; background:var(--bg2); border-radius:4px; overflow:hidden; margin-top:3px; }
.spar-bar-fill { height:100%; background:var(--accent); transition:width .6s ease; }
.spar-review-item { background:var(--bg2); border:1px solid var(--border); border-radius:8px; padding:10px; margin-bottom:8px; font-size:13px; }
.spar-review-item .sr-q { color:var(--text); margin-bottom:4px; }
.spar-review-item .sr-exp { color:var(--text2); white-space:pre-wrap; }
.spar-review-item.sr-wrong { border-color:var(--red); }
```

- [ ] **Step 3: Verify the page still loads (manual)**

Run: open `index.html` in a browser. Expected: no console errors; existing screens unaffected (new screens are hidden until activated).

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: add Invigilator sparring screens + styles"
```

---

## Task 8: Bout runtime controller

**Files:**
- Modify: `index.html` (inside SPAR markers — controller functions that touch the DOM)

- [ ] **Step 1: Add the controller state + entry point inside the SPAR markers**

```js
let sparBout = [], sparIdx = 0, sparAnswers = [], sparDeadline = 0, sparTimerId = null, sparTier = 0;

function _sparTopicTitles() { return DATA.maths.topics.map(t => t.title); }

function startSpar() {
  const titles = _sparTopicTitles();
  const readiness = sparReadiness(getStore(), titles);
  // average readiness across targeted (non-mastered) topics -> intensity tier
  const vals = titles.map(t => readiness[t]);
  const avg = vals.reduce((a,b)=>a+b,0) / (vals.length || 1);
  sparTier = sparIntensityTier(avg);
  const seed = Date.now() & 0xffffffff;
  sparBout = assembleBout(readiness, SPAR_BANK, { size: 6, masteryThreshold: 80, seed });
  sparAnswers = [];
  sparIdx = 0;

  // Pre-bout intro
  const focusTopics = [...new Set(sparBout.map(q => q.topic))].slice(0, 3);
  document.getElementById('sparIntroLine').textContent =
    avg >= 75 ? "You're sharp. I'll make this harder." : "I've seen your record. Let's work on your gaps.";
  document.getElementById('sparIntroFocus').textContent = 'Today: ' + focusTopics.join(', ');
  const totalMarks = sparBout.reduce((a,q)=>a+q.marks,0);
  const budget = boutTimeBudget(totalMarks, sparTier);
  document.getElementById('sparIntroMeta').textContent =
    sparBout.length + ' questions · ' + totalMarks + ' marks · ' + Math.round(budget/60) + ' min';
  history.push(screen); showScreen('sparIntroScreen');
}
```

- [ ] **Step 2: Add bout start + question rendering + timer**

```js
function beginBout() {
  const totalMarks = sparBout.reduce((a,q)=>a+q.marks,0);
  const budget = boutTimeBudget(totalMarks, sparTier);
  sparDeadline = Date.now() + budget * 1000;
  history.push('homeScreen'); // verdict returns home, not back into the bout
  showScreen('sparScreen');
  renderSparQ();
  if (sparTimerId) clearInterval(sparTimerId);
  sparTimerId = setInterval(tickSparClock, 250);
  tickSparClock();
}

function tickSparClock() {
  const left = Math.max(0, Math.round((sparDeadline - Date.now()) / 1000));
  const clk = document.getElementById('sparClock');
  const mm = String(Math.floor(left/60)).padStart(2,'0');
  const ss = String(left%60).padStart(2,'0');
  clk.textContent = mm + ':' + ss;
  clk.className = 'drill-streak-badge spar-clock-' + clockState(left);
  if (left <= 0) { endBout(false); }
}

function renderSparQ() {
  const q = sparBout[sparIdx];
  document.getElementById('sparCount').textContent = 'Q' + (sparIdx+1) + ' / ' + sparBout.length;
  document.getElementById('sparTopicLabel').textContent = q.topic;
  document.getElementById('sparMarkTag').textContent = '[' + q.marks + ' marks]';
  document.getElementById('sparQ').innerHTML = q.q;
  const earned = sparAnswers.reduce((a,x)=>a + (x.correct ? x.marks : 0), 0);
  const totalSoFar = sparBout.reduce((a,x)=>a+x.marks,0);
  document.getElementById('sparMarks').textContent = earned + ' / ' + totalSoFar + ' marks';
  const inp = document.getElementById('sparAns');
  inp.value = ''; inp.disabled = false; inp.focus();
  document.getElementById('sparNextBtn').textContent = (sparIdx === sparBout.length - 1) ? 'Hand in' : 'Next';
}

function sparAdvance() {
  const q = sparBout[sparIdx];
  const val = document.getElementById('sparAns').value;
  const correct = val.trim() !== '' && matchSparAnswer(q, val);
  sparAnswers.push({ topic: q.topic, marks: q.marks, correct, given: val, q });
  sparIdx++;
  if (sparIdx >= sparBout.length) endBout(true);
  else renderSparQ();
}
```

- [ ] **Step 3: Add bout end + verdict rendering + readiness update**

```js
function _grade(pct) {
  if (pct >= 75) return 'A'; if (pct >= 60) return 'B'; if (pct >= 50) return 'C';
  if (pct >= 40) return 'D'; if (pct >= 30) return 'E'; return 'U';
}

function endBout(handedIn) {
  if (sparTimerId) { clearInterval(sparTimerId); sparTimerId = null; }
  // Any unanswered questions (early timer expiry) score 0.
  for (let i = sparAnswers.length; i < sparBout.length; i++) {
    const q = sparBout[i];
    sparAnswers.push({ topic: q.topic, marks: q.marks, correct: false, given: '', q });
  }
  const marksEarned = sparAnswers.reduce((a,x)=>a + (x.correct ? x.marks : 0), 0);
  const marksTotal = sparBout.reduce((a,x)=>a+x.marks,0);
  const correctCount = sparAnswers.filter(x=>x.correct).length;
  const pct = marksTotal ? Math.round(marksEarned/marksTotal*100) : 0;

  // Per-topic readiness nudge: blend old readiness with this bout's topic accuracy.
  const titles = _sparTopicTitles();
  const readiness = sparReadiness(getStore(), titles);
  const byTopic = {};
  sparAnswers.forEach(a => {
    if (!byTopic[a.topic]) byTopic[a.topic] = { e:0, t:0 };
    byTopic[a.topic].t += a.marks; if (a.correct) byTopic[a.topic].e += a.marks;
  });
  const readinessAfter = Object.assign({}, readiness);
  Object.keys(byTopic).forEach(t => {
    const boutPct = Math.round(byTopic[t].e / byTopic[t].t * 100);
    readinessAfter[t] = Math.round((readiness[t] * 0.6) + (boutPct * 0.4)); // weighted nudge
  });

  saveBoutResult({
    date: new Date().toISOString(), focusTopics: Object.keys(byTopic),
    score: correctCount, total: sparBout.length, marksEarned, marksTotal,
    beatClock: handedIn, readinessAfter, intensityTier: sparTier
  });
  if (marksEarned > 0) addXP(marksEarned * 4 + (handedIn ? 10 : 0), 'Sparring · ' + _grade(pct));
  recordStreak();

  renderVerdict(pct, marksEarned, marksTotal, correctCount, byTopic, readiness, readinessAfter);
}

function renderVerdict(pct, marksEarned, marksTotal, correctCount, byTopic, before, after) {
  document.getElementById('sparVPct').textContent = pct + '%';
  document.getElementById('sparVMarks').textContent = marksEarned + '/' + marksTotal;
  const grade = _grade(pct);
  document.getElementById('sparVerdictLine').textContent =
    correctCount + ' of ' + sparBout.length + ' — Grade ' + grade + '. ' +
    (pct >= 60 ? "I'm gaining respect for you." : "We go again.");

  // Readiness bars (topics tested this bout)
  const bars = document.getElementById('sparReadinessBars'); bars.innerHTML = '';
  Object.keys(byTopic).forEach(t => {
    const wrap = document.createElement('div'); wrap.className = 'spar-bar';
    wrap.innerHTML =
      '<div class="spar-bar-label"><span>' + t + '</span><span>' + (before[t]||0) + '% &#8594; ' + (after[t]||0) + '%</span></div>' +
      '<div class="spar-bar-track"><div class="spar-bar-fill" style="width:' + (before[t]||0) + '%"></div></div>';
    bars.appendChild(wrap);
    requestAnimationFrame(() => { wrap.querySelector('.spar-bar-fill').style.width = (after[t]||0) + '%'; });
  });

  // Worked solutions for misses
  const review = document.getElementById('sparReview'); review.innerHTML = '';
  sparAnswers.filter(a => !a.correct).forEach(a => {
    const div = document.createElement('div'); div.className = 'spar-review-item sr-wrong';
    div.innerHTML = '<div class="sr-q">' + a.q.q + '</div>' +
      '<div class="sr-exp"><strong>Answer:</strong> ' + a.q.answer + '\n' + a.q.exp + '</div>';
    review.appendChild(div);
  });
  showScreen('sparVerdictScreen');
}
```

- [ ] **Step 4: Allow Enter-to-advance on the answer box (match drill feel)**

Add inside the SPAR markers:

```js
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && screen === 'sparScreen') { e.preventDefault(); sparAdvance(); }
});
```

- [ ] **Step 5: Verify full logic suite still green**

Run: `node _spar_test.js`
Expected: all PASS (controller additions don't break extraction; pure functions unchanged).

- [ ] **Step 6: Manual smoke test in a browser**

Open `index.html`, in the console run `startSpar()`. Expected: intro screen names focus topics; **Begin** starts a 6-question bout with a counting-down clock that goes amber/red; answering and **Hand in** shows a verdict with grade, animated readiness bars, and worked solutions for misses. Reload and run `JSON.parse(localStorage.crambox).sparring` — expect a `bouts` entry.

- [ ] **Step 7: Commit**

```bash
git add index.html
git commit -m "feat: Invigilator bout controller (timer, grading, verdict, readiness)"
```

---

## Task 9: Menu entry point

**Files:**
- Modify: `index.html` (near the Drill card at `index.html:673`)

- [ ] **Step 1: Add the sparring card**

After the Drill `subject-card` (around `index.html:673`), add:

```html
<div class="subject-card" onclick="startSpar()" style="border-color:var(--red);margin-bottom:20px">
  <div class="subject-icon" style="color:var(--red)">⚔</div>
  <div class="subject-info">
    <h3>Spar with the Invigilator</h3>
    <p>Adaptive exam pressure. Targets your weak topics.</p>
  </div>
</div>
```

(Match the exact inner markup of the neighbouring `subject-card` if it differs; mirror its classes.)

- [ ] **Step 2: Manual check**

Open `index.html`. Expected: the new card appears on the home/subject area and launches the intro screen.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add Spar with the Invigilator menu entry"
```

---

## Task 10: Scale the AI question bank to all topics

**Files:**
- Modify: `index.html` (`SPAR_BANK`)
- Modify: `_spar_test.js` (finalise runner + coverage assertion)

- [ ] **Step 1: Add a coverage test (fails until the bank is filled)**

Append to `_spar_test.js`, then add the single canonical `module.exports.run()` call as the **last line of the file** (remove any temporary `run()` calls added earlier):

```js
H.test('SPAR_BANK: covers enough topics with a difficulty spread', () => {
  const byTopic = {};
  BANK.forEach(q => { (byTopic[q.topic] = byTopic[q.topic] || []).push(q.difficulty); });
  const covered = Object.keys(byTopic);
  H.assert(covered.length >= 12, 'too few topics covered: ' + covered.length);
  covered.forEach(t => H.assert(byTopic[t].length >= 4, t + ' has < 4 questions'));
});

module.exports.run();
```

- [ ] **Step 2: Run to verify it fails**

Run: `node _spar_test.js`
Expected: FAIL "too few topics covered" (only Transformations exists so far).

- [ ] **Step 3: Generate the bank with Claude (build-time, in-chat) and paste it in**

Working with Nash, generate exam-style questions for the priority topics (start with the highest-value O-Level topics, e.g. Solving Linear Equations, Fractions and Percentages, Mensuration/Area, Probability, Trigonometry, Indices, Standard Form, Variation, Algebraic manipulation, Sets, Vectors, plus Transformations). For each topic: **≥4 questions** spanning `easy`/`medium`/`exam`, each with correct `marks`, `answer`, and `exp`, matching the existing entity conventions. Append them to `SPAR_BANK`.

> Every generated item must pass the Task 2 integrity test. For numeric answers, re-derive the answer independently before pasting (extend the existing `_verify.py` SymPy pattern where practical).

- [ ] **Step 4: Run to verify it passes**

Run: `node _spar_test.js`
Expected: all PASS, including coverage.

- [ ] **Step 5: Commit**

```bash
git add index.html _spar_test.js
git commit -m "feat: scale SPAR_BANK across priority topics + coverage test"
```

---

## Task 11: Sync, offline verification, deploy

**Files:**
- Modify: `CramBox-Mathematics-4004.html` (overwrite)

- [ ] **Step 1: Re-run the full suite**

Run: `node _spar_test.js`
Expected: all PASS.

- [ ] **Step 2: Offline guarantee (manual)**

Open `index.html` with networking disabled (DevTools → Network → Offline). Complete a full bout. Expected: no network requests, feature works end-to-end.

- [ ] **Step 3: Sync the distribution copy and verify identical**

Run:
```bash
cp index.html CramBox-Mathematics-4004.html
md5sum index.html CramBox-Mathematics-4004.html
```
Expected: identical hashes.

- [ ] **Step 4: Commit**

```bash
git add index.html CramBox-Mathematics-4004.html _spar_test.js
git commit -m "chore: sync distribution copy with Invigilator sparring"
```

- [ ] **Step 5: Deploy (only when Nash approves going live)**

Run: `vercel --prod --yes`
Then smoke-check: `curl -s https://zimsec-prep.vercel.app | grep -o "Spar with the Invigilator"`
Expected: the string is present on the live site.

---

## Self-review (completed during authoring)

- **Spec coverage:** persona (Task 7/8 intro + verdict lines), readiness/Hunter brain (Task 3 + endBout nudge), baked-in bank (Tasks 2/10), bouts & 70/30 selection + mastery threshold + difficulty ladder + championship fallback + graceful shrink (Task 4), marks-based timer + amber/red + tightening tiers (Task 5), bout flow & verdict & worked solutions & readiness bars (Tasks 7/8), store extension + backward compat (Task 6), offline/no-API (whole design; verified Task 11 Step 2), cold start (Task 3 unknown=0 + Task 4 championship fallback), edge cases (Task 4 shrink/championship, Task 8 timer-expiry zero-fill), testing (Tasks 1–6, 10), future premium left out of scope (spec §13).
- **Placeholder scan:** no TBD/"handle edge cases" placeholders; all logic steps include code. The only intentionally human/AI step is Task 10 Step 3 (content generation), which is the build-time AI authoring the spec requires.
- **Type/name consistency:** `SPAR_BANK`, `sparReadiness(store, topicTitles)`, `assembleBout(readiness, bank, opts)`, `boutTimeBudget(totalMarks, tier)`, `clockState(secondsLeft)`, `sparIntensityTier`, `matchSparAnswer(q, input)`, `getSparring`/`saveBoutResult`, controller fns (`startSpar`/`beginBout`/`renderSparQ`/`sparAdvance`/`endBout`/`renderVerdict`) — names are consistent across tasks and tests.

## Open questions deferred to execution (from spec §15)

1. Readiness recency window — v1 uses stored **best** percent (`store.maths.scores`) as the proxy; revisit if it feels stale.
2. Bout size fixed at 6 for v1; a longer "mock paper" option can be added later.
3. Bout is forward-only in v1 (no revisiting answered questions).
4. Tier thresholds (avg readiness 50/75 → tiers 1/2) and difficulty ladder are first-pass; tune after playtesting.
5. Launch bank size: ≥4 per topic across ≥12 topics (Task 10 coverage test); expand over time.
