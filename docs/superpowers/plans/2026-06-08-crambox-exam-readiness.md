# Exam Readiness Layer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a study-optimization layer that fuses existing signal into one honest per-topic readiness, a headline Exam Readiness % + predicted grade + mastered-count, "study next" guidance, gentle spaced-repetition decay, and re-aimed XP/rank/milestones — making students productive, not just engaged.

**Architecture:** All code lives in `index.html` (then synced to `CramBox-Mathematics-4004.html`). Pure-logic functions live behind `// ===== READINESS MODULE START/END =====` markers and are unit-tested headlessly via a Node `vm` harness (same pattern as `_spar_test.js`). A thin DOM layer renders a home hero card + per-topic tree bars + study-next, and `touchTopic` hooks record when each topic was last studied. Everything is offline, localStorage-only, no AI calls.

**Tech Stack:** Vanilla JS in one HTML file, `localStorage` (key `crambox`), Node.js (built-in `vm`/`fs`/`assert`) for tests. Deployed on Vercel.

---

## Key codebase facts the implementer must know

- **Store:** `getStore()` → `JSON.parse(localStorage['crambox']||'{}')`; `setStore(d)`. Per-topic best practice % at `store.maths.scores['t'+idx]` (idx into `DATA.maths.topics[]`). Invigilator readiness at `store.sparring.readiness[topicTitle]`. Drill mastery at `store.drillMastery[drillId] = {correct,total}` (drill ids differ from topic titles — map best-effort).
- **Topic identity:** `DATA.maths.topics[idx].title` is canonical; `.practice` is an array (count = marks source via `.marks`).
- **XP/rank:** `addXP(amount, reason)`; `getRank(xp)` currently maps XP→rank and is called in `addXP`, `updateHome`, share card. Streak via `recordStreak()`; `store.streak`, `store.activeDays`, `store.lastActive`.
- **Home render:** `updateHome()` (around `index.html:1094`) renders XP badge, streak, stats; the home screen container holds the streak bar, stats row, quick actions, mode cards. Exam countdown via `renderExamCountdown()` + `store.examDate` (if set).
- **Navigation:** `history.push(screen); showScreen('id')`; `openSubject('maths')` builds the curriculum tree (`openSubject`, ~`index.html:2230`), `openTopic(i,'lesson'|'practice')`.
- **Two files stay identical:** final task overwrites `CramBox-Mathematics-4004.html` with `index.html` (hash-verified).
- **Module marker convention:** new pure code between `// ===== READINESS MODULE START =====` and `// ===== READINESS MODULE END =====`. Any top-level DOM access in that block MUST be guarded with `if (typeof document !== 'undefined')` (the harness has no DOM — this bit us in the SPAR build).

---

## File structure

| File | Responsibility | Action |
|---|---|---|
| `index.html` | READINESS module (pure fns) + `touchTopic` hooks + home hero card + tree bars + study-next + re-aimed XP/rank/milestones + CSS | Modify |
| `CramBox-Mathematics-4004.html` | WhatsApp distribution copy, byte-identical | Overwrite (final task) |
| `_readiness_test.js` | Node harness: extracts READINESS module, asserts the pure functions | Create |

Pure functions are the testable core; DOM/store hooks are thin glue.

---

## Task 1: Node harness + module markers

**Files:** Create `_readiness_test.js`; Modify `index.html`.

- [ ] **Step 1: Add the markers to index.html**

Immediately **after** the `// ===== TEAM SPAR MODULE END =====` line in `index.html`, insert:

```js
// ===== READINESS MODULE START =====
// ===== READINESS MODULE END =====
```

- [ ] **Step 2: Create the harness**

Create `_readiness_test.js`:

```js
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
```

- [ ] **Step 3: Confirm it loads**

Run: `node _readiness_test.js`
Expected: `0 passed, 0 failed`, exit 0.

- [ ] **Step 4: Commit**

```bash
git add _readiness_test.js index.html
git commit -m "test: add readiness harness + module markers"
```

---

## Task 2: `predictedGrade` + `readinessRank`

**Files:** Modify `index.html` (READINESS markers) + `_readiness_test.js`.

- [ ] **Step 1: Add tests** (insert before the sentinel in `_readiness_test.js`):

```js
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
```

- [ ] **Step 2: Run → fail** (`predictedGrade is not a function`).
Run: `node _readiness_test.js`

- [ ] **Step 3: Implement** (inside READINESS markers):

```js
function predictedGrade(pct) {
  if (pct >= 75) return 'A'; if (pct >= 60) return 'B'; if (pct >= 50) return 'C';
  if (pct >= 40) return 'D'; if (pct >= 30) return 'E'; return 'U';
}
// Readiness-driven rank (replaces the XP-based source). Colours reuse CSS vars at render time.
function readinessRank(pct) {
  if (pct >= 85) return { name: 'Exam Ready', color: 'var(--green)', min: 85 };
  if (pct >= 70) return { name: 'Diamond',    color: 'var(--blue)',  min: 70 };
  if (pct >= 55) return { name: 'Gold',       color: 'var(--gold)',  min: 55 };
  if (pct >= 40) return { name: 'Silver',     color: '#aaa',         min: 40 };
  if (pct >= 20) return { name: 'Bronze',     color: '#cd7f32',      min: 20 };
  return { name: 'Beginner', color: 'var(--text2)', min: 0 };
}
```

- [ ] **Step 4: Run → pass.** Run: `node _readiness_test.js`
- [ ] **Step 5: Commit**

```bash
git add index.html _readiness_test.js
git commit -m "feat: predictedGrade + readinessRank + tests"
```

---

## Task 3: `topicReadiness` (signal blend)

**Files:** Modify `index.html` + `_readiness_test.js`.

- [ ] **Step 1: Add tests**:

```js
H.test('topicReadiness: single signal used directly', () => {
  const store = { maths: { scores: { t0: 80 } }, sparring: { readiness: {} }, drillMastery: {} };
  H.assert(H.ctx.topicReadiness(store, 0, 'Algebra') === 80, 'practice-only');
  const store2 = { maths:{scores:{}}, sparring:{ readiness:{ Algebra: 60 } }, drillMastery:{} };
  H.assert(H.ctx.topicReadiness(store2, 0, 'Algebra') === 60, 'spar-only');
});
H.test('topicReadiness: multi-signal renormalised weighted blend', () => {
  // practice 80 (w .4), spar 60 (w .4) -> renormalised .5/.5 -> 70
  const store = { maths:{scores:{t0:80}}, sparring:{readiness:{Algebra:60}}, drillMastery:{} };
  H.assert(H.ctx.topicReadiness(store, 0, 'Algebra') === 70, 'got ' + H.ctx.topicReadiness(store,0,'Algebra'));
});
H.test('topicReadiness: untouched topic = 0', () => {
  const store = { maths:{scores:{}}, sparring:{readiness:{}}, drillMastery:{} };
  H.assert(H.ctx.topicReadiness(store, 5, 'Vectors') === 0);
});
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement** (inside markers):

```js
// Base readiness for one topic: weighted average of whichever signals exist.
// Weights practice .4 / invigilator .4 / drill .2, renormalised over present signals.
function topicReadiness(store, idx, title, drillKey) {
  const out = [];
  const p = store && store.maths && store.maths.scores ? store.maths.scores['t' + idx] : undefined;
  if (typeof p === 'number') out.push([p, 0.4]);
  const s = store && store.sparring && store.sparring.readiness ? store.sparring.readiness[title] : undefined;
  if (typeof s === 'number') out.push([s, 0.4]);
  const dm = store && store.drillMastery && drillKey ? store.drillMastery[drillKey] : undefined;
  if (dm && dm.total > 0) out.push([Math.round(dm.correct / dm.total * 100), 0.2]);
  if (out.length === 0) return 0;
  const wsum = out.reduce((a, x) => a + x[1], 0);
  return Math.round(out.reduce((a, x) => a + x[0] * x[1], 0) / wsum);
}
```

- [ ] **Step 4: Run → pass.**
- [ ] **Step 5: Commit**

```bash
git add index.html _readiness_test.js
git commit -m "feat: topicReadiness signal blend + tests"
```

---

## Task 4: `applyDecay` (spaced repetition, exam-accelerating)

**Files:** Modify `index.html` + `_readiness_test.js`.

- [ ] **Step 1: Add tests**:

```js
const DAY = 86400000;
H.test('applyDecay: no decay within grace window', () => {
  const now = Date.UTC(2026,0,20), touched = now - 10*DAY;
  H.assert(H.ctx.applyDecay(80, touched, now, 999) === 80, 'within 14d grace');
});
H.test('applyDecay: linear decay after grace, floored at 50% base', () => {
  const now = Date.UTC(2026,0,20);
  const t24 = now - 24*DAY; // 10 days past grace -> ~10% off
  H.assert(H.ctx.applyDecay(80, t24, now, 999) === 70, 'got ' + H.ctx.applyDecay(80,t24,now,999));
  const tOld = now - 400*DAY; // floor
  H.assert(H.ctx.applyDecay(80, tOld, now, 999) === 40, 'floor 50% of 80');
});
H.test('applyDecay: accelerates near exam', () => {
  const now = Date.UTC(2026,0,20);
  const t = now - 10*DAY; // within normal grace, but final-stretch grace is 7d -> 3 days * 2%/day = 6 off
  const v = H.ctx.applyDecay(80, t, now, 14); // 14 days to exam
  H.assert(v === 74, 'got ' + v);
});
H.test('applyDecay: base 0 stays 0', () => {
  H.assert(H.ctx.applyDecay(0, Date.UTC(2026,0,1), Date.UTC(2026,0,20), 999) === 0);
});
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement** (inside markers):

```js
// Gentle, spaced-repetition decay. Near the exam (<=21 days) the grace shrinks and the rate doubles.
function applyDecay(base, lastTouched, now, daysToExam) {
  if (!base || !lastTouched) return base || 0;
  var finalStretch = (typeof daysToExam === 'number' && daysToExam <= 21);
  var grace = finalStretch ? 7 : 14;
  var rate = finalStretch ? 2 : 1; // % per day past grace
  var daysIdle = Math.floor((now - lastTouched) / 86400000);
  if (daysIdle <= grace) return base;
  var loss = (daysIdle - grace) * rate;
  var floor = Math.round(base * 0.5);
  return Math.max(floor, base - loss);
}
```

- [ ] **Step 4: Run → pass.**
- [ ] **Step 5: Commit**

```bash
git add index.html _readiness_test.js
git commit -m "feat: applyDecay spaced-repetition + tests"
```

---

## Task 5: `examReadiness` (roll-up) + `studyNext` + `xpForReadinessLift`

**Files:** Modify `index.html` + `_readiness_test.js`.

- [ ] **Step 1: Add tests**:

```js
H.test('examReadiness: overall = mean across ALL topics (untouched drags down)', () => {
  const topics = [{title:'A',marks:10},{title:'B',marks:10},{title:'C',marks:10}];
  const store = { maths:{scores:{t0:90}}, sparring:{readiness:{}}, drillMastery:{}, readiness:{touched:{}} };
  const now = Date.UTC(2026,0,20);
  const r = H.ctx.examReadiness(store, topics, now, null);
  // A=90, B=0, C=0 -> overall 30
  H.assert(r.overall === 30, 'got ' + r.overall);
  H.assert(r.perTopic.length === 3);
  H.assert(r.perTopic[0].readiness === 90 && r.perTopic[1].readiness === 0);
});
H.test('studyNext: lowest readiness first, marks tiebreak', () => {
  const perTopic = [
    {idx:0,title:'A',readiness:20,marks:6},
    {idx:1,title:'B',readiness:20,marks:10}, // tie on 20 -> more marks first
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
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement** (inside markers):

```js
// Roll up per-topic readiness (with decay) into the headline number + per-topic rows.
function examReadiness(store, topics, now, examDate) {
  var touched = (store && store.readiness && store.readiness.touched) || {};
  var daysToExam = examDate ? Math.ceil((examDate - now) / 86400000) : null;
  var perTopic = topics.map(function (t, i) {
    var base = topicReadiness(store, i, t.title, t.drillKey);
    var last = touched[t.title] ? Date.parse(touched[t.title]) : null;
    var r = last ? applyDecay(base, last, now, daysToExam) : base;
    return { idx: i, title: t.title, readiness: r, marks: t.marks || 0 };
  });
  var overall = perTopic.length
    ? Math.round(perTopic.reduce(function (a, x) { return a + x.readiness; }, 0) / perTopic.length)
    : 0;
  var mastered = perTopic.filter(function (x) { return x.readiness >= 80; }).length;
  return { perTopic: perTopic, overall: overall, mastered: mastered, total: perTopic.length };
}
// The N weakest topics, tie-broken by marks-available (more first), then order.
function studyNext(perTopic, n) {
  return perTopic.slice().sort(function (a, b) {
    return a.readiness - b.readiness || b.marks - a.marks || a.idx - b.idx;
  }).slice(0, n);
}
// Bonus XP scaled to the readiness gap closed; near-zero once a topic is mastered.
function xpForReadinessLift(before, after) {
  var lift = after - before;
  if (lift <= 0) return 0;
  var headroom = Math.max(0, 100 - before) / 100;   // less reward the higher you already are
  return Math.round(lift * headroom);
}
```

- [ ] **Step 4: Run → pass (all readiness tests).**
- [ ] **Step 5: Commit**

```bash
git add index.html _readiness_test.js
git commit -m "feat: examReadiness rollup + studyNext + xpForReadinessLift + tests"
```

---

## Task 6: `touchTopic` store hooks

**Files:** Modify `index.html` (READINESS markers + existing write functions).

- [ ] **Step 1: Add `touchTopic` inside the READINESS markers**

```js
// Record that a topic was studied now, and snapshot its readiness (for lift detection + decay base).
function touchTopic(title) {
  if (!title) return;
  var s = getStore();
  if (!s.readiness) s.readiness = { touched: {}, lastTopicReadiness: {}, overall: 0, milestonesSeen: [] };
  s.readiness.touched[title] = new Date().toISOString();
  setStore(s);
}
```

- [ ] **Step 2: Call it from the three study actions.**

In `saveScore(subj, idx, earned, total)` (practice), after it computes/saves, add before the final `recordStreak()`:
```js
  if (subj === 'maths' && DATA.maths.topics[idx]) touchTopic(DATA.maths.topics[idx].title);
```
In `endBout(...)` (Invigilator) `saveBoutResult` already runs; after it, add:
```js
  Object.keys(byTopic).forEach(function (t) { touchTopic(t); });
```
In the drill correct path (`checkDrill`, inside the `if (isCorrect)` block) add — only when the drill maps to a topic title via `drillTopic.name`:
```js
  if (typeof drillTopic !== 'undefined' && drillTopic && drillTopic.name) touchTopic(drillTopic.name);
```

- [ ] **Step 3: Manual check (browser console)**

Open `index.html`, run `touchTopic('Transformations'); JSON.parse(localStorage.crambox).readiness.touched`
Expected: an object with `Transformations` → today's ISO date.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: touchTopic hooks on practice/drill/spar"
```

---

## Task 7: Home hero "Exam Readiness" card (HTML + CSS + render)

**Files:** Modify `index.html`.

- [ ] **Step 1: Add the card markup** at the top of the home screen container (just inside `<div class="screen active" id="homeScreen"><div class="container">`, before the exam countdown):

```html
  <div class="readiness-hero" id="readinessHero" onclick="openReadiness()">
    <div class="rh-ring"><svg viewBox="0 0 120 120"><circle class="rh-track" cx="60" cy="60" r="52"/><circle class="rh-fill" id="rhFill" cx="60" cy="60" r="52"/></svg><div class="rh-pct"><span id="rhPct">0%</span><small id="rhGrade">U</small></div></div>
    <div class="rh-info">
      <div class="rh-title">Exam Readiness</div>
      <div class="rh-sub" id="rhSub">0 / 37 topics mastered</div>
      <div class="rh-coach" id="rhCoach">Take a session to find your starting point.</div>
      <div class="rh-next" id="rhNext"></div>
    </div>
  </div>
```

- [ ] **Step 2: Add CSS** (near the streak-bar styles):

```css
  .readiness-hero{display:flex;gap:16px;align-items:center;background:linear-gradient(135deg,var(--card),var(--card2));border:1px solid var(--border);border-radius:16px;padding:18px;margin-bottom:16px;cursor:pointer;transition:.15s}
  .readiness-hero:hover{border-color:var(--green)}
  .rh-ring{position:relative;width:96px;height:96px;flex-shrink:0}
  .rh-ring svg{width:96px;height:96px;transform:rotate(-90deg)}
  .rh-track{fill:none;stroke:var(--bg2);stroke-width:10}
  .rh-fill{fill:none;stroke:var(--green);stroke-width:10;stroke-linecap:round;stroke-dasharray:327;stroke-dashoffset:327;transition:stroke-dashoffset .8s ease}
  .rh-pct{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
  .rh-pct span{font-size:24px;font-weight:800;color:var(--text)}
  .rh-pct small{font-size:12px;font-weight:700;color:var(--gold)}
  .rh-info{flex:1;min-width:0}
  .rh-title{font-size:13px;color:var(--text2);text-transform:uppercase;letter-spacing:.5px;font-weight:700}
  .rh-sub{font-size:13px;color:var(--text2);margin-top:2px}
  .rh-coach{font-size:14px;color:var(--text);margin-top:6px}
  .rh-next{margin-top:8px;display:flex;gap:6px;flex-wrap:wrap}
  .rh-chip{font-size:11px;background:var(--red-bg);color:var(--red);border-radius:20px;padding:3px 10px;cursor:pointer}
  .rh-chip.amber{background:var(--gold-bg);color:var(--gold)}
```

- [ ] **Step 3: Add the render function + wire into `updateHome`.** Inside the READINESS markers (guard DOM):

```js
function renderReadinessHero() {
  if (typeof document === 'undefined') return;
  var el = document.getElementById('readinessHero'); if (!el) return;
  var store = getStore();
  var topics = DATA.maths.topics.map(function (t, i) {
    return { title: t.title, marks: (t.practice || []).reduce(function (a, q) { return a + (q.marks || 0); }, 0), drillKey: null };
  });
  var examDate = store.examDate ? Date.parse(store.examDate) : null;
  var r = examReadiness(store, topics, Date.now(), examDate);
  // persist overall for rank
  if (!store.readiness) store.readiness = { touched:{}, lastTopicReadiness:{}, overall:0, milestonesSeen:[] };
  store.readiness.overall = r.overall; setStore(store);

  document.getElementById('rhPct').textContent = r.overall + '%';
  document.getElementById('rhGrade').textContent = predictedGrade(r.overall);
  var circ = 327, off = circ - circ * r.overall / 100;
  document.getElementById('rhFill').style.strokeDashoffset = off;
  document.getElementById('rhSub').textContent = r.mastered + ' / ' + r.total + ' topics mastered';
  var grade = predictedGrade(r.overall);
  document.getElementById('rhCoach').textContent =
    r.overall === 0 ? 'Take a session to find your starting point.'
    : 'Tracking a ' + grade + ' — focus your weak topics to climb.';
  var next = studyNext(r.perTopic, 3).filter(function (t) { return t.readiness < 80; });
  var nx = document.getElementById('rhNext'); nx.innerHTML = '';
  next.forEach(function (t) {
    var c = document.createElement('span');
    c.className = 'rh-chip' + (t.readiness >= 40 ? ' amber' : '');
    c.textContent = t.title + ' ' + t.readiness + '%';
    c.onclick = function (e) { e.stopPropagation(); openTopic(t.idx, 'lesson'); };
    nx.appendChild(c);
  });
}
function openReadiness() { openSubject('maths'); } // v1: deep view = the curriculum tree with bars
```

Then in `updateHome()` (existing), add a call at the end: `renderReadinessHero();`

- [ ] **Step 4: Syntax check + manual render**

Run: `node -e "const fs=require('fs');const h=fs.readFileSync('index.html','utf8');const re=/<script>([\s\S]*?)<\/script>/g;let m,n=0,e=0;const{Script}=require('vm');while((m=re.exec(h))){n++;try{new Script(m[1])}catch(x){e++;console.log(x.message)}}console.log('errors',e)"`
Expected: `errors 0`. Then open `index.html`, activate, confirm the hero card shows a ring + grade + chips.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: home Exam Readiness hero card + render"
```

---

## Task 8: Per-topic readiness bars in the curriculum tree

**Files:** Modify `index.html` (`openSubject`).

- [ ] **Step 1: Compute readiness in `openSubject` and replace the `cs-best` score with a readiness bar.**

In `openSubject`, after `const scores = ...`, add:
```js
  const _topicsMeta = d.topics.map(function (t, i) { return { title: t.title, marks: (t.practice||[]).reduce(function(a,q){return a+(q.marks||0);},0), drillKey:null }; });
  const _rd = examReadiness(s, _topicsMeta, Date.now(), s.examDate ? Date.parse(s.examDate) : null);
```
Then, inside the `d.topics.forEach((t,i)=>{...})` loop, replace the `cs-best` span with a readiness pill + thin bar:
```js
    const rv = _rd.perTopic[i].readiness;
    const rcls = rv >= 80 ? 'r-strong' : rv >= 40 ? 'r-mid' : 'r-weak';
    const bestHtml = '<span class="cs-rd ' + rcls + '">' + rv + '%</span>';
```
…and use `bestHtml` where the old `${score!=null?'<span class="cs-best">'+score+'%</span>':''}` was.

- [ ] **Step 2: Add CSS**:

```css
  .cs-rd{font-size:12px;font-weight:700;flex-shrink:0;padding:2px 8px;border-radius:20px}
  .cs-rd.r-strong{background:var(--green-bg);color:var(--green)}
  .cs-rd.r-mid{background:var(--gold-bg);color:var(--gold)}
  .cs-rd.r-weak{background:var(--red-bg);color:var(--red)}
```

- [ ] **Step 3: Syntax check + manual**: open Maths → tree shows colour-coded readiness % per topic.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: per-topic readiness bars in curriculum tree"
```

---

## Task 9: Re-aim XP + rank + milestones

**Files:** Modify `index.html`.

- [ ] **Step 1: Drive rank from readiness.** In `updateHome()` and anywhere rank is shown on home, replace the XP-based rank read with readiness. Concretely, where home computes `getRank(s.xp||0)` for display, use:
```js
  var _ov = (s.readiness && s.readiness.overall) || 0;
  var rank = readinessRank(_ov);
```
(Leave `getRank`/XP intact for the XP badge; only the **rank label** reads from readiness.)

- [ ] **Step 2: Award lift XP + fire milestones after a practice session.** At the end of `submitPractice()` (after `saveScore`), add:
```js
  awardReadinessProgress(DATA[subject].topics[practiceTopicIdx].title);
```
Add the helper inside the READINESS markers (guard DOM for the confetti/popup calls — but it runs in browser only anyway):
```js
function awardReadinessProgress(title) {
  var store = getStore();
  if (!store.readiness) store.readiness = { touched:{}, lastTopicReadiness:{}, overall:0, milestonesSeen:[] };
  var topics = DATA.maths.topics.map(function (t, i) { return { title:t.title, marks:(t.practice||[]).reduce(function(a,q){return a+(q.marks||0);},0), drillKey:null }; });
  var idx = DATA.maths.topics.findIndex(function (t) { return t.title === title; });
  var before = (store.readiness.lastTopicReadiness && store.readiness.lastTopicReadiness[title]) || 0;
  var after = topicReadiness(store, idx, title, null);
  var bonus = xpForReadinessLift(before, after);
  if (bonus > 0 && typeof addXP === 'function') addXP(bonus, 'Readiness +' + (after - before) + '% ' + title);
  // milestone: topic crossed 80
  if (before < 80 && after >= 80 && store.readiness.milestonesSeen.indexOf(title + ':mastered') === -1) {
    store.readiness.milestonesSeen.push(title + ':mastered');
    if (typeof fireConfetti === 'function') fireConfetti();
    if (typeof showLevelUp === 'function') showLevelUp({ name: title + ' mastered!', color: 'var(--green)', next: null });
  }
  // milestone: overall crossed a grade boundary
  var r = examReadiness(store, topics, Date.now(), store.examDate ? Date.parse(store.examDate) : null);
  var key = 'grade:' + predictedGrade(r.overall);
  if (r.overall >= 60 && store.readiness.milestonesSeen.indexOf(key) === -1) {
    store.readiness.milestonesSeen.push(key);
    if (typeof fireConfetti === 'function') fireConfetti();
  }
  store.readiness.lastTopicReadiness[title] = after;
  store.readiness.overall = r.overall;
  setStore(store);
}
```

- [ ] **Step 3: Reframe the streak label only.** Where the home streak label renders (e.g. the `.streak-label` text), change the copy to `'readiness kept warm'` (display-only; mechanic unchanged).

- [ ] **Step 4: Syntax check + manual**: complete a practice topic → see a "Readiness +N%" XP popup; push a topic to ≥80 → confetti + "mastered" toast; home rank reads from readiness.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: re-aim XP/rank/milestones at readiness"
```

---

## Task 10: Full suite, browser smoke test, sync, deploy

**Files:** Modify `CramBox-Mathematics-4004.html`.

- [ ] **Step 1: Run all suites.** Run: `node _readiness_test.js` (all pass) and regression `node _spar_test.js`, `node _teamspar_test.js` (all pass).

- [ ] **Step 2: Browser smoke test (Playwright or manual).** Serve the file; in a page: set a license; simulate practice on one topic (or call `saveScore('maths',36,8,8); updateHome();`), then assert `#rhPct` > 0, the tree shows a coloured `.cs-rd`, and `studyNext` chips appear. Confirm no network requests (offline).

- [ ] **Step 3: Sync the distribution copy.** Run:
```bash
cp index.html CramBox-Mathematics-4004.html
md5sum index.html CramBox-Mathematics-4004.html
```
Expected: identical hashes.

- [ ] **Step 4: Commit.**
```bash
git add index.html CramBox-Mathematics-4004.html _readiness_test.js
git commit -m "chore: sync distribution copy with Exam Readiness layer"
```

- [ ] **Step 5: Deploy (on approval).** Run `vercel --prod --yes`; re-alias `crambox-prep.vercel.app` to the new deployment; smoke-test both URLs contain `Exam Readiness`.

---

## Self-review (completed during authoring)

- **Spec coverage:** three altitudes — overall %/grade/mastered (Task 5 `examReadiness` + Task 7 render); per-topic blend (Task 3); decay (Task 4); study-next (Task 5/7); touch hooks (Task 6); home hero (Task 7); tree bars (Task 8); re-aimed XP/rank/milestones (Task 9); decay floor + milestone-once guards (Tasks 4/9); new-user empty state (Task 7 coach copy); offline + localStorage (no network anywhere); testing (Tasks 1–5, 10).
- **Placeholder scan:** no TBD/"handle edge cases"; every logic step has code. Deferred tuning constants are explicit values, not placeholders.
- **Type/name consistency:** `topicReadiness(store,idx,title,drillKey)`, `applyDecay(base,lastTouched,now,daysToExam)`, `examReadiness(store,topics,now,examDate)→{perTopic:[{idx,title,readiness,marks}],overall,mastered,total}`, `predictedGrade(pct)`, `studyNext(perTopic,n)`, `readinessRank(pct)→{name,color,min}`, `xpForReadinessLift(before,after)`, `touchTopic(title)`, `renderReadinessHero`, `awardReadinessProgress(title)` — consistent across tasks/tests. DOM guards noted where pure module touches `document`.

## Open questions deferred to execution (from spec §11)

1. Blend weights / decay constants — first-pass values in code; tune after playtest.
2. Grade bands — provisional; adjust to real ZIMSEC boundaries if available.
3. Drill-id → topic mapping — v1 passes `drillKey:null` (drill omitted from blend) until a mapping table is added; practice + sparring already cover all 37 topics.
4. Hero card placement vs streak bar — v1 sits above the countdown; revisit visually.
