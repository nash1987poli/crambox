# Team Spar (Offline Group Study) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an offline, collaborative group-study mode where 2–5 named players relay through one shared bout on one phone, see worked solutions after every question, and finish on a ranked leaderboard.

**Architecture:** All code lives in `index.html` (then synced to `CramBox-Mathematics-4004.html`). It reuses the Invigilator SPAR module's baked-in `SPAR_BANK`, `matchSparAnswer`, and `_grade`. Two new pure functions (`assembleTeamBout`, `teamLeaderboard`) carry the logic and are unit-tested headlessly via a Node harness; a thin DOM controller relays turns. State is ephemeral (in-memory) — the only persistence is a fixed XP award per completed session.

**Tech Stack:** Vanilla JS in one HTML file, `localStorage` (existing `addXP`/`recordStreak`), Node.js (built-in `vm`/`fs`/`assert`) for tests. Deployed on Vercel (`zimsec-prep`).

---

## PREREQUISITE

**The "Spar with the Invigilator" plan must be implemented first** (`docs/superpowers/plans/2026-06-06-crambox-invigilator-sparring.md`). Team Spar reuses, from the `// ===== SPAR MODULE START/END =====` block:
- `const SPAR_BANK = [...]` — the baked-in AI question bank
- `function matchSparAnswer(q, input)` — the grader
- `function _grade(pct)` — A–U bands

If those do not exist yet, stop and build the Invigilator plan first. The Task 1 harness check below will fail fast if they're missing.

---

## Key codebase facts the implementer must know

- **Store/XP:** `addXP(amount, reason)` and `recordStreak()` already exist and update the home UI. No store schema changes in this feature.
- **Navigation:** screens are `<div class="screen" id="...">`; switch with `history.push(screen); showScreen('id')`. `goBack()` pops `history`; `goHome()` resets. Global `screen` holds the current id.
- **Reused grader:** `matchSparAnswer(q, input)` returns boolean; coordinate questions carry `isCoord:true`+`coordPair:[x,y]`, others use `answersMatch`.
- **Menu entry:** mode cards are `<div class="subject-card" onclick="...">` (the Invigilator card was added near `index.html:673`).
- **Two files stay identical:** final task overwrites `CramBox-Mathematics-4004.html` with `index.html` (hash-verified).
- **Marker convention for tests:** all new code goes between `// ===== TEAM SPAR MODULE START =====` and `// ===== TEAM SPAR MODULE END =====` so the Node harness can extract and `vm`-run the pure functions.

---

## File structure

| File | Responsibility | Action |
|---|---|---|
| `index.html` | Team Spar code inside TEAM SPAR markers + 4 screen `<div>`s + 1 menu card + CSS | Modify |
| `CramBox-Mathematics-4004.html` | WhatsApp distribution copy, byte-identical | Overwrite (final task) |
| `_teamspar_test.js` | Node harness: extracts TEAM SPAR + SPAR modules, asserts `assembleTeamBout` & `teamLeaderboard` | Create |

The two pure functions (`assembleTeamBout`, `teamLeaderboard`) are the testable core; the controller is thin glue over them plus reused grading/solution rendering.

---

## Task 1: Node test harness + module markers

**Files:**
- Create: `_teamspar_test.js`
- Modify: `index.html`

- [ ] **Step 1: Add the TEAM SPAR markers to index.html**

Immediately **after** the `// ===== SPAR MODULE END =====` line in `index.html`, insert:

```js
// ===== TEAM SPAR MODULE START =====
// ===== TEAM SPAR MODULE END =====
```

- [ ] **Step 2: Create the harness**

Create `_teamspar_test.js`:

```js
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
```

- [ ] **Step 3: Confirm the harness loads (and the prerequisite exists)**

Run: `node -e "require('./_teamspar_test.js')"`
Expected: no output, exit 0. If it throws "Missing: const SPAR_BANK" — the Invigilator plan isn't built yet; build it first.

- [ ] **Step 4: Commit**

```bash
git add _teamspar_test.js index.html
git commit -m "test: add Team Spar harness + module markers"
```

---

## Task 2: `assembleTeamBout` — fair, mixed, deterministic

**Files:**
- Modify: `index.html` (inside TEAM SPAR markers)
- Modify: `_teamspar_test.js`

- [ ] **Step 1: Write the failing tests**

Append to `_teamspar_test.js`:

```js
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
  const b7 = H.ctx.assembleTeamBout(bank, 7, { seed: 1 }); // 14 -> capped 12 -> nearest multiple of 7 <=12 = 7
  H.assert(b7.length === 7, '7 players -> 7 (multiple<=12), got ' + b7.length);
});

H.test('assembleTeamBout: shrinks to whole multiple when bank is small', () => {
  const bank = fakeBank(2, ['A']); // only 2 questions
  const b3 = H.ctx.assembleTeamBout(bank, 3, { seed: 1 }); // can't give 3 each; 1 each needs 3 but only 2 -> 0? must be >=1 each
  // With 2 questions and 3 players, even 1-each (=3) is impossible -> returns [] (caller shows "not enough").
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `node _teamspar_test.js`
Expected: FAIL ("assembleTeamBout is not a function").

- [ ] **Step 3: Implement inside the TEAM SPAR markers**

```js
// Deterministic seeded RNG (mulberry32) — bouts must be testable.
function _tsRng(seed) {
  let a = (seed || 1) >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function _tsShuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i],a[j]]=[a[j],a[i]]; }
  return a;
}

// Build a fair, mixed-spread group bout.
// size target = min(players*2, 12), shrunk to the largest whole multiple of `players`
// the bank can fill (>=1 each). Returns [] if even 1-each is impossible.
function assembleTeamBout(bank, players, opts) {
  opts = opts || {};
  const rng = _tsRng(opts.seed || 1);
  const cap = 12;
  let target = Math.min(players * 2, cap);
  target = Math.floor(target / players) * players; // whole multiple of players
  // shrink to what the bank can supply, keeping a whole multiple of players
  let size = Math.min(target, Math.floor(bank.length / players) * players);
  if (size < players) return []; // can't even give 1 each

  // Mixed spread: round-robin across distinct topics, soft cap so variety wins while it lasts.
  const byTopic = {};
  _tsShuffle(bank, rng).forEach(q => { (byTopic[q.topic] = byTopic[q.topic] || []).push(q); });
  const topics = _tsShuffle(Object.keys(byTopic), rng);
  const picked = [];
  let round = 0;
  while (picked.length < size) {
    let progressed = false;
    for (const t of topics) {
      if (picked.length >= size) break;
      if (byTopic[t][round]) { picked.push(byTopic[t][round]); progressed = true; }
    }
    if (!progressed) break; // exhausted
    round++;
  }
  return picked.slice(0, size);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node _teamspar_test.js`
Expected: PASS all three assembleTeamBout tests.

- [ ] **Step 5: Commit**

```bash
git add index.html _teamspar_test.js
git commit -m "feat: add assembleTeamBout (fair, mixed, deterministic) + tests"
```

---

## Task 3: `teamLeaderboard` — ranking, MVP, team grade

**Files:**
- Modify: `index.html` (inside TEAM SPAR markers)
- Modify: `_teamspar_test.js`

- [ ] **Step 1: Write the failing tests**

Append to `_teamspar_test.js`:

```js
H.test('teamLeaderboard: sums marks per player, ranks with tiebreaks, marks MVP', () => {
  const players = [{ name: 'Tariro' }, { name: 'Tendai' }, { name: 'Rufaro' }];
  const answers = [
    { player: 'Tariro', marks: 2, correct: true },
    { player: 'Tendai', marks: 3, correct: true },
    { player: 'Rufaro', marks: 2, correct: false },
    { player: 'Tariro', marks: 2, correct: true },
    { player: 'Tendai', marks: 2, correct: false },
    { player: 'Rufaro', marks: 3, correct: true },
  ];
  const lb = H.ctx.teamLeaderboard(players, answers);
  // Tariro: 4 marks (2 correct). Tendai: 3 marks (1 correct). Rufaro: 3 marks (1 correct).
  H.assert(lb.rows[0].name === 'Tariro' && lb.rows[0].marks === 4, 'Tariro should lead with 4');
  H.assert(lb.rows[0].isMVP === true, 'rank 1 is MVP');
  // Tie on 3 marks -> tiebreak correct count equal (1 each) -> setup order: Tendai before Rufaro
  H.assert(lb.rows[1].name === 'Tendai' && lb.rows[2].name === 'Rufaro', 'tiebreak by setup order');
  H.assert(lb.teamMarks === 10 && lb.teamPossible === 14, 'team totals');
  H.assert(typeof lb.teamGrade === 'string' && lb.teamGrade.length === 1, 'team grade letter');
});

H.test('teamLeaderboard: correct-count breaks marks ties before setup order', () => {
  const players = [{ name: 'A' }, { name: 'B' }];
  const answers = [
    { player: 'A', marks: 4, correct: true },                 // A: 4 marks, 1 correct
    { player: 'B', marks: 2, correct: true }, { player: 'B', marks: 2, correct: true }, // B: 4 marks, 2 correct
  ];
  const lb = H.ctx.teamLeaderboard(players, answers);
  H.assert(lb.rows[0].name === 'B', 'more correct answers wins the marks tie');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node _teamspar_test.js`
Expected: FAIL ("teamLeaderboard is not a function").

- [ ] **Step 3: Implement inside the TEAM SPAR markers**

```js
// Rank players by marks earned; tiebreak: more correct answers, then setup order.
// Returns { rows:[{name,marks,correct,isMVP}], teamMarks, teamPossible, teamPct, teamGrade }.
function teamLeaderboard(players, answers) {
  const order = {};
  players.forEach((p, i) => { order[p.name] = i; });
  const agg = {};
  players.forEach(p => { agg[p.name] = { name: p.name, marks: 0, correct: 0 }; });
  let teamMarks = 0, teamPossible = 0;
  answers.forEach(a => {
    teamPossible += a.marks;
    if (!agg[a.player]) agg[a.player] = { name: a.player, marks: 0, correct: 0 };
    if (a.correct) { agg[a.player].marks += a.marks; agg[a.player].correct += 1; teamMarks += a.marks; }
  });
  const rows = Object.values(agg).sort((x, y) =>
    y.marks - x.marks || y.correct - x.correct || order[x.name] - order[y.name]);
  rows.forEach((r, i) => { r.isMVP = (i === 0 && r.marks > 0); });
  const teamPct = teamPossible ? Math.round(teamMarks / teamPossible * 100) : 0;
  return { rows, teamMarks, teamPossible, teamPct, teamGrade: _grade(teamPct) };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node _teamspar_test.js`
Expected: PASS both leaderboard tests.

- [ ] **Step 5: Commit**

```bash
git add index.html _teamspar_test.js
git commit -m "feat: add teamLeaderboard ranking + tests"
```

---

## Task 4: Screens (HTML + CSS)

**Files:**
- Modify: `index.html` (add 4 screens near the spar screens; add CSS)

- [ ] **Step 1: Add the four screens**

Insert after the `sparVerdictScreen` closing `</div>` (from the Invigilator build):

```html
<!-- ==================== TEAM: SETUP ==================== -->
<div class="screen" id="teamSetupScreen">
<div class="container">
  <div class="drill-q-card">
    <div class="q-num">Team Spar</div>
    <p style="font-size:13px;color:var(--text2);margin:6px 0 12px">Study together — one phone, the whole crew. Add 2–5 names.</p>
    <div id="teamNameRows"></div>
    <button class="submit-btn" id="teamAddBtn" onclick="teamAddRow()" style="background:var(--bg2);color:var(--text);border:1px solid var(--border);margin-top:8px">+ Add player</button>
    <button class="drill-check" id="teamStartBtn" style="width:100%;margin-top:12px" onclick="teamStart()">Start</button>
    <p id="teamSetupHint" style="font-size:11px;color:var(--text2);margin-top:8px">Add at least 2 players. Studying alone? Use Spar with the Invigilator.</p>
  </div>
  <button class="submit-btn" onclick="goBack()" style="background:var(--bg2);color:var(--text);border:1px solid var(--border)">Back</button>
</div>
</div>

<!-- ==================== TEAM: PASS INTERSTITIAL ==================== -->
<div class="screen" id="teamPassScreen">
<div class="container">
  <div class="drill-q-card" style="text-align:center">
    <div class="q-num">Pass the phone</div>
    <div style="font-size:26px;color:var(--accent);margin:18px 0">▶ <span id="teamPassName">NAME</span></div>
    <div style="font-size:12px;color:var(--text2);margin-bottom:16px" id="teamPassProgress">Question 1 of 6</div>
    <button class="drill-check" style="width:100%" onclick="teamShowQ()">Ready</button>
  </div>
</div>
</div>

<!-- ==================== TEAM: QUESTION ==================== -->
<div class="screen" id="teamSparScreen">
<div class="container">
  <div class="drill-counter">
    <span id="teamCount">Q1 of 6</span>
    <span class="drill-streak-badge drill-streak-cold" id="teamCurrent">NAME</span>
    <span id="teamTeamScore">0 marks</span>
  </div>
  <div class="drill-q-card">
    <div class="q-num"><span id="teamTopicLabel"></span> <span id="teamMarkTag" style="color:var(--text2)"></span></div>
    <div class="drill-equation" id="teamQ" style="font-size:16px;line-height:1.5"></div>
    <div class="drill-input-row">
      <input type="text" class="drill-ans" id="teamAns" placeholder="?" autocomplete="off">
      <button class="drill-check" id="teamCheckBtn" onclick="teamCheck()">Check</button>
    </div>
    <div class="drill-feedback" id="teamFeedback"></div>
    <div class="drill-solution" id="teamSolution"></div>
    <div id="teamTally" style="font-size:12px;color:var(--text2);margin-top:10px"></div>
    <button class="drill-next" id="teamNextBtn" onclick="teamNext()" style="display:none">Next</button>
  </div>
</div>
</div>

<!-- ==================== TEAM: LEADERBOARD ==================== -->
<div class="screen" id="teamLeaderboardScreen">
<div class="container">
  <div class="results-card">
    <div class="results-msg" id="teamLbTitle">Team: 0/0 — Grade U</div>
    <div class="results-det" id="teamLbRows" style="margin-top:12px;text-align:left"></div>
  </div>
  <button class="drill-check" style="width:100%;margin-top:14px" onclick="teamPlayAgain()">Spar again (same group)</button>
  <button class="submit-btn" onclick="teamNewGroup()" style="background:var(--bg2);color:var(--text);border:1px solid var(--border);margin-top:8px">New group</button>
  <button class="submit-btn" onclick="goHome()" style="background:var(--bg2);color:var(--text);border:1px solid var(--border);margin-top:8px">Done</button>
</div>
</div>
```

- [ ] **Step 2: Add CSS for name rows + leaderboard**

In the `<style>` block:

```css
.team-name-row { display:flex; gap:8px; margin-bottom:8px; }
.team-name-row input { flex:1; padding:10px; border:1px solid var(--border); border-radius:8px; background:var(--bg2); color:var(--text); }
.team-name-row button { background:var(--red-bg); color:var(--red); border:none; border-radius:8px; padding:0 12px; cursor:pointer; }
.team-lb-row { display:flex; justify-content:space-between; align-items:center; padding:10px; background:var(--bg2); border:1px solid var(--border); border-radius:8px; margin-bottom:8px; }
.team-lb-row.mvp { border-color:var(--gold); background:var(--gold-bg); }
.team-lb-rank { color:var(--text2); width:24px; }
.team-lb-name { flex:1; color:var(--text); font-weight:600; }
.team-lb-marks { color:var(--accent); }
```

- [ ] **Step 3: Verify page still loads (manual)**

Open `index.html`. Expected: no console errors; new screens hidden until activated.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: add Team Spar screens + styles"
```

---

## Task 5: Setup controller (names 2–5)

**Files:**
- Modify: `index.html` (inside TEAM SPAR markers)

- [ ] **Step 1: Add setup state + render inside the TEAM SPAR markers**

```js
let teamPlayers = [], teamBout = [], teamIdx = 0, teamAnswers = [], teamSeed = 1;

function openTeamSetup() {
  if (!document.getElementById('teamNameRows').children.length) {
    teamRenderRows(['', '']); // start with 2 blank rows
  }
  teamUpdateSetupState();
  history.push(screen); showScreen('teamSetupScreen');
}

function teamRenderRows(names) {
  const wrap = document.getElementById('teamNameRows');
  wrap.innerHTML = '';
  names.forEach((n, i) => {
    const row = document.createElement('div'); row.className = 'team-name-row';
    row.innerHTML = '<input type="text" maxlength="14" placeholder="Player ' + (i+1) + '" value="' + n.replace(/"/g,'&quot;') + '" oninput="teamUpdateSetupState()">' +
      (names.length > 2 ? '<button onclick="teamRemoveRow(' + i + ')">✕</button>' : '');
    wrap.appendChild(row);
  });
}
function _teamCurrentNames() {
  return [...document.querySelectorAll('#teamNameRows input')].map(i => i.value);
}
function teamAddRow() {
  const names = _teamCurrentNames();
  if (names.length >= 5) return;
  names.push('');
  teamRenderRows(names); teamUpdateSetupState();
}
function teamRemoveRow(idx) {
  const names = _teamCurrentNames();
  if (names.length <= 2) return;
  names.splice(idx, 1);
  teamRenderRows(names); teamUpdateSetupState();
}
function teamUpdateSetupState() {
  const names = _teamCurrentNames();
  document.getElementById('teamAddBtn').style.display = names.length >= 5 ? 'none' : '';
  // Start enabled when >=2 rows exist (blanks become Player N).
  document.getElementById('teamStartBtn').disabled = names.length < 2;
}
```

- [ ] **Step 2: Manual check**

Open `index.html`, run `openTeamSetup()` in console. Expected: 2 rows, "+ Add player" up to 5, remove (✕) down to 2, Start enabled at ≥2.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: Team Spar setup controller (2-5 names)"
```

---

## Task 6: Relay controller (start → pass → answer → solution → next)

**Files:**
- Modify: `index.html` (inside TEAM SPAR markers)

- [ ] **Step 1: Add bout start (with not-enough-questions guard)**

```js
function teamStart() {
  const names = _teamCurrentNames().map((n, i) => ({ name: (n.trim() || ('Player ' + (i+1))) }));
  if (names.length < 2) return;
  teamPlayers = names;
  teamSeed = Date.now() & 0xffffffff;
  teamBout = assembleTeamBout(SPAR_BANK, teamPlayers.length, { seed: teamSeed });
  if (teamBout.length === 0) {
    alert('Not enough questions yet for ' + teamPlayers.length + ' players. Try fewer players.');
    return;
  }
  teamAnswers = [];
  teamIdx = 0;
  history.push('homeScreen'); // leaderboard returns home, not back into the bout
  teamGotoPass();
}

function _teamPlayerForIdx(i) { return teamPlayers[i % teamPlayers.length].name; }

function teamGotoPass() {
  document.getElementById('teamPassName').textContent = _teamPlayerForIdx(teamIdx);
  document.getElementById('teamPassProgress').textContent = 'Question ' + (teamIdx+1) + ' of ' + teamBout.length;
  showScreen('teamPassScreen');
}
```

- [ ] **Step 2: Add question render + check + next**

```js
function teamShowQ() {
  const q = teamBout[teamIdx];
  document.getElementById('teamCount').textContent = 'Q' + (teamIdx+1) + ' of ' + teamBout.length;
  document.getElementById('teamCurrent').textContent = _teamPlayerForIdx(teamIdx);
  document.getElementById('teamTopicLabel').textContent = q.topic;
  document.getElementById('teamMarkTag').textContent = '[' + q.marks + ' marks]';
  document.getElementById('teamQ').innerHTML = q.q;

  const inp = document.getElementById('teamAns');
  inp.value = ''; inp.disabled = false;
  document.getElementById('teamCheckBtn').style.display = '';
  document.getElementById('teamCheckBtn').disabled = false;
  document.getElementById('teamFeedback').className = 'drill-feedback'; document.getElementById('teamFeedback').style.display = 'none';
  document.getElementById('teamSolution').style.display = 'none';
  document.getElementById('teamNextBtn').style.display = 'none';
  document.getElementById('teamTally').innerHTML = '';
  teamRenderTeamScore();
  showScreen('teamSparScreen');
  inp.focus();
}

function teamRenderTeamScore() {
  const earned = teamAnswers.reduce((a,x)=>a + (x.correct ? x.marks : 0), 0);
  document.getElementById('teamTeamScore').textContent = earned + ' marks';
}

function teamCheck() {
  const q = teamBout[teamIdx];
  const val = document.getElementById('teamAns').value;
  const correct = val.trim() !== '' && matchSparAnswer(q, val);
  teamAnswers.push({ player: _teamPlayerForIdx(teamIdx), topic: q.topic, marks: q.marks, correct, given: val });

  const inp = document.getElementById('teamAns'); inp.disabled = true;
  document.getElementById('teamCheckBtn').style.display = 'none';
  const fb = document.getElementById('teamFeedback');
  fb.textContent = correct ? 'Correct!' : 'Not quite.';
  fb.className = 'drill-feedback show ' + (correct ? 'correct-fb' : 'wrong-fb');
  inp.style.borderColor = correct ? 'var(--green)' : 'var(--red)';
  inp.style.background = correct ? 'var(--green-bg)' : 'var(--red-bg)';

  // Collaborative: always show the worked solution.
  const sol = document.getElementById('teamSolution');
  sol.innerHTML = '<strong>Answer:</strong> ' + q.answer + '\n' + q.exp;
  sol.style.display = 'block';

  // Running tally per player.
  teamRenderTally();
  teamRenderTeamScore();
  document.getElementById('teamNextBtn').style.display = 'block';
  document.getElementById('teamNextBtn').textContent = (teamIdx === teamBout.length - 1) ? 'See results' : 'Next';
}

function teamRenderTally() {
  const byP = {};
  teamPlayers.forEach(p => byP[p.name] = { c: 0, t: 0 });
  teamAnswers.forEach(a => { if (!byP[a.player]) byP[a.player] = { c:0,t:0 }; byP[a.player].t++; if (a.correct) byP[a.player].c++; });
  document.getElementById('teamTally').innerHTML =
    teamPlayers.map(p => p.name + ' ' + '✓'.repeat(byP[p.name].c) + (byP[p.name].t - byP[p.name].c ? '·'.repeat(byP[p.name].t - byP[p.name].c) : '')).join('  ·  ');
}

function teamNext() {
  teamIdx++;
  if (teamIdx >= teamBout.length) teamFinish();
  else teamGotoPass();
}
```

- [ ] **Step 3: Manual smoke test**

Open `index.html`, run `openTeamSetup()`, add names, Start. Expected: pass screen → Ready → question → Check shows solution + tally → Next → pass to next name; repeats; last question button says "See results".

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: Team Spar relay controller (pass/answer/solution/next)"
```

---

## Task 7: Finish + leaderboard render + XP

**Files:**
- Modify: `index.html` (inside TEAM SPAR markers)

- [ ] **Step 1: Add finish + leaderboard render**

```js
function teamFinish() {
  const lb = teamLeaderboard(teamPlayers, teamAnswers);
  document.getElementById('teamLbTitle').textContent =
    'Team: ' + lb.teamMarks + '/' + lb.teamPossible + ' — Grade ' + lb.teamGrade;
  const wrap = document.getElementById('teamLbRows'); wrap.innerHTML = '';
  lb.rows.forEach((r, i) => {
    const div = document.createElement('div');
    div.className = 'team-lb-row' + (r.isMVP ? ' mvp' : '');
    div.innerHTML =
      '<span class="team-lb-rank">' + (i+1) + '</span>' +
      '<span class="team-lb-name">' + (r.isMVP ? '👑 ' : '') + r.name + '</span>' +
      '<span class="team-lb-marks">' + r.marks + ' marks · ' + r.correct + '✓</span>';
    wrap.appendChild(div);
  });
  // Fixed XP to the host per completed session (not per question — no grinding).
  addXP(15, 'Team Spar session');
  recordStreak();
  if (typeof fireConfetti === 'function') fireConfetti();
  showScreen('teamLeaderboardScreen');
}

function teamPlayAgain() {
  teamSeed = Date.now() & 0xffffffff;
  teamBout = assembleTeamBout(SPAR_BANK, teamPlayers.length, { seed: teamSeed });
  if (teamBout.length === 0) { goHome(); return; }
  teamAnswers = []; teamIdx = 0;
  teamGotoPass();
}
function teamNewGroup() {
  teamPlayers = []; teamAnswers = []; teamBout = []; teamIdx = 0;
  document.getElementById('teamNameRows').innerHTML = '';
  openTeamSetup();
}
```

- [ ] **Step 2: Manual check of the full loop**

Open `index.html`, run a full 2-player session to the leaderboard. Expected: ranked rows, 👑 on the top scorer, team grade line, +15 XP popup once, confetti. "Spar again" starts a fresh bout with the same names; "New group" returns to setup.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: Team Spar finish + leaderboard + session XP"
```

---

## Task 8: Menu entry point

**Files:**
- Modify: `index.html` (near the Invigilator card at ~`index.html:673`)

- [ ] **Step 1: Add the Team Spar card**

After the "Spar with the Invigilator" `subject-card`, add:

```html
<div class="subject-card" onclick="openTeamSetup()" style="border-color:var(--blue);margin-bottom:20px">
  <div class="subject-icon" style="color:var(--blue)">👥</div>
  <div class="subject-info">
    <h3>Team Spar</h3>
    <p>Study together. One phone, 2–5 players, learn out loud.</p>
  </div>
</div>
```

(Mirror the exact inner markup/classes of the neighbouring card if they differ.)

- [ ] **Step 2: Manual check**

Open `index.html`. Expected: the Team Spar card appears and opens the setup screen.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add Team Spar menu entry"
```

---

## Task 9: Full suite, offline check, sync, deploy

**Files:**
- Modify: `CramBox-Mathematics-4004.html` (overwrite)

- [ ] **Step 1: Run both test suites**

Run: `node _teamspar_test.js` and `node _spar_test.js`
Expected: all PASS.

- [ ] **Step 2: Offline guarantee (manual)**

Open `index.html` with networking disabled (DevTools → Network → Offline). Run a full team session. Expected: no network requests; works end-to-end.

- [ ] **Step 3: Sync distribution copy + verify identical**

Run:
```bash
cp index.html CramBox-Mathematics-4004.html
md5sum index.html CramBox-Mathematics-4004.html
```
Expected: identical hashes.

- [ ] **Step 4: Commit**

```bash
git add index.html CramBox-Mathematics-4004.html _teamspar_test.js
git commit -m "chore: sync distribution copy with Team Spar"
```

- [ ] **Step 5: Deploy (only when Nash approves going live)**

Run: `vercel --prod --yes`
Then: `curl -s https://zimsec-prep.vercel.app | grep -o "Team Spar"`
Expected: the string is present.

---

## Self-review (completed during authoring)

- **Spec coverage:** entry card (Task 8), setup 2–5 names + Start gating + Player-N defaults (Task 5), fair bout sizing players×2 cap 12 shrink-to-multiple + mixed spread + deterministic (Task 2), relay loop pass→answer→immediate solution→tally→next (Tasks 4/6), leaderboard marks→correct→order tiebreak + MVP + team grade (Tasks 3/7), fixed 15 XP per session + recordStreak (Task 7), no store schema change / ephemeral state (Task 5 state vars), reuse of `SPAR_BANK`/`matchSparAnswer`/`_grade` (Task 1 harness + Tasks 2/6/3), offline guarantee (Task 9 Step 2), edge cases — <2 disabled (Task 5), >5 add disabled (Task 5), bank-too-small empty→alert (Tasks 2/6), blank/duplicate names (Task 5/6), abandon discards (ephemeral), empty answer = incorrect + solution still shown (Task 6).
- **Placeholder scan:** no TBD/"handle edge cases" placeholders; every logic step has code. No content-generation step here (questions come from the already-built `SPAR_BANK`).
- **Type/name consistency:** `assembleTeamBout(bank, players, opts)`, `teamLeaderboard(players, answers)` → `{rows:[{name,marks,correct,isMVP}],teamMarks,teamPossible,teamPct,teamGrade}`, controller fns (`openTeamSetup`/`teamRenderRows`/`teamAddRow`/`teamRemoveRow`/`teamUpdateSetupState`/`teamStart`/`teamGotoPass`/`teamShowQ`/`teamCheck`/`teamRenderTally`/`teamRenderTeamScore`/`teamNext`/`teamFinish`/`teamPlayAgain`/`teamNewGroup`), state (`teamPlayers`/`teamBout`/`teamIdx`/`teamAnswers`/`teamSeed`) — consistent across tasks. `_grade`/`matchSparAnswer`/`SPAR_BANK`/`fireConfetti` are reused, not redefined.

## Open questions deferred to execution (from spec §10)

1. Mixed-spread rule: v1 uses seeded round-robin across topics (Task 2). Tune if variety feels off.
2. "Spar again" may repeat previous questions in v1 (acceptable).
3. Leaderboard flourish reuses existing `fireConfetti` if present (Task 7).
4. Optional timed "Exam mode" toggle — parked.
