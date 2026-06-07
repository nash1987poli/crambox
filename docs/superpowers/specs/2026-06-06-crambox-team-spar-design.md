# CramBox — "Team Spar" (Offline Group Study) Design Spec

**Date:** 2026-06-06
**Status:** Awaiting user approval
**Owner:** Nash (Curious Inc)
**Applies to:** `index.html` / `CramBox-Mathematics-4004.html` (single self-contained offline file, deployed on Vercel as `zimsec-prep`)
**Related:** Reuses the bout engine from `2026-06-06-crambox-invigilator-sparring-design.md` (the solo "Spar with the Invigilator"). **This spec depends on that feature being implemented first** (it reuses `SPAR_BANK` and `matchSparAnswer`).

---

## 1. Summary

Add a **collaborative, offline group-study mode** called **Team Spar**. A study circle of **2–5 named players** shares one phone and works through a single bout **relay-style** — each player answers in turn, the **worked solution appears immediately** so the group learns together, and the session ends with a **ranked leaderboard** and an MVP.

Team Spar is the **opposite vibe** to the solo Invigilator: no silent timer, no exam pressure, no hidden solutions. It is built for *teaching each other*, which is how most Zimbabwean students actually study.

**Positioning:** *"Study together. One phone, the whole crew, learning out loud."*

---

## 2. Strategic context

- Group study is the dominant study mode in the target market; CramBox is currently solo/device-locked, which fights that grain. Team Spar makes the product fit how students really work.
- Must preserve CramBox's Blue Ocean: **fully offline, zero data, zero per-student cost.** No server, no live sync. Runs on the shared WhatsApp copy exactly like the rest of the app.
- It is a **growth surface** too: a fun group session is the moment a non-owner decides they want their own copy (feeds the future WhatsApp-challenge-card and squad-pricing features, which are **separate specs**, out of scope here).

---

## 3. Goals

- Let 2–5 students spar together on one phone, offline.
- Make it **collaborative**: immediate worked solutions; everyone learns each question.
- Reuse the baked-in `SPAR_BANK` and `matchSparAnswer` grader — no new content engine, no new grading logic.
- End on a satisfying, fair **leaderboard** with an MVP and a team grade.

## 4. Non-goals (YAGNI)

- **No live/network multiplayer**, no cross-device sync, no accounts.
- **No timer / exam pressure** in v1 (that's the solo Invigilator's job). May be offered later as an optional "Exam mode" toggle — explicitly deferred.
- **No weakness-targeting** — a group has no single readiness profile; bouts are a curated mixed spread.
- **No "remember last group" presets** in v1 (deferred enhancement).
- **No squad pricing / multi-device licensing** (separate spec, depends on the unlaunched payment system).
- **No WhatsApp challenge cards** (separate spec).
- **No persistence of group results / hall-of-fame** in v1 (a session is ephemeral; nothing half-saved on abandon).

---

## 5. User flow

### 5.1 Entry
A **Team Spar** card on the home/menu (next to "Spar with the Invigilator") opens the setup screen.

### 5.2 Setup screen
- Host adds **2–5 player names** (add/remove rows). Names are trimmed; a blank row defaults to `Player N`; duplicates are allowed (the group's choice).
- **Start** is disabled until at least **2** non-removed players exist.
- On Start, the bout is assembled and the relay begins.

### 5.3 Bout assembly (fair + mixed)
- **Bout size = players × 2** (so everyone answers exactly 2), **capped at 12**.
- If the bank can't supply that many across a good spread, size **shrinks down to the largest whole multiple of `playerCount`** that the bank supports (so turns stay even). Minimum 1 per player.
- Questions are a **curated mixed spread**: spread across as many distinct topics as possible and across difficulties (`easy`/`medium`/`exam`), deterministically shuffled. **No readiness/weakness input.**

### 5.4 The relay loop (per question)
1. **Pass interstitial:** a full-screen "Pass the phone to ▶ **NAME**" card with a single **Ready** button (prevents the previous answerer revealing the next question).
2. **Question card:** shows the current player's name, the question with its `[marks]`, and an answer box + **Check**.
3. **Immediate feedback:** Correct/Incorrect, then the **worked solution** (`exp`) is shown so the whole group sees the method.
4. **Running tally** under the card: each player with their ✓/total so far.
5. **Next** advances to the next player's pass interstitial (or to the leaderboard after the last question).

Turn order = setup order, rotating each question.

### 5.5 Leaderboard (finale)
- Players **ranked by marks earned**; tiebreak: more correct answers, then setup order.
- **MVP crown** on the top player; **team total** line ("Team: 11 / 16 — Grade B").
- Buttons: **Spar again (same group)** (re-assembles a fresh mixed bout, same names) · **New group** (back to setup) · **Done** (home).
- **XP:** a **small fixed award to the phone's owner per completed session** (not per question — prevents grinding). Suggested value 15 XP via the existing `addXP`. `recordStreak()` is called once.

---

## 6. Components & responsibilities

All code lives in `index.html` between dedicated markers `// ===== TEAM SPAR MODULE START =====` / `// ===== TEAM SPAR MODULE END =====` so the Node test harness can extract the pure functions (same pattern as the Invigilator's SPAR module).

| Unit | Type | Responsibility |
|---|---|---|
| `assembleTeamBout(bank, playerCount, opts)` | pure fn | Build a fair, mixed-spread bout; size = `min(playerCount*2, 12)` shrinking to a whole multiple of `playerCount`; deterministic via seed. |
| `teamLeaderboard(players, answers)` | pure fn | Compute per-player marks/correct, rank with tiebreaks, mark MVP, team totals + grade. |
| `_grade(pct)` | pure fn | Reused from the Invigilator module (A–U bands). |
| `matchSparAnswer(q, input)` | pure fn | **Reused** from the Invigilator module for grading. |
| Team controller (DOM) | impl | Setup screen, relay state machine (pass → answer → solution → next), leaderboard render. |
| 3 screens + CSS | markup | `teamSetupScreen`, `teamPassScreen` + `teamSparScreen`, `teamLeaderboardScreen`. |

**Dependency note:** `assembleTeamBout` and `teamLeaderboard` are the testable core. The controller is thin glue over them + reused grading/solution rendering.

---

## 7. Data model

- **No store schema changes.** Team Spar is **ephemeral** — all state lives in memory for the session:
  ```
  teamPlayers = [{ name }]
  teamBout    = [ <SPAR_BANK items> ]
  teamIdx     = 0
  teamAnswers = [ { player, topic, marks, correct, given } ]   // one per answered question
  ```
- The only store interaction is the end-of-session `addXP(15, 'Team Spar')` + `recordStreak()` on the host device. Absent/!corrupt store handling is already covered by existing `getStore`/`setStore`.

---

## 8. Edge cases & error handling

- **< 2 players:** Start disabled; helper text suggests solo Invigilator for one person.
- **> 5 players:** add-row disabled at 5.
- **Bank too small:** bout shrinks to the largest whole multiple of `playerCount` (≥1 each); if even 1-each is impossible (tiny bank), show a friendly "not enough questions yet" message and return to menu.
- **Blank/duplicate names:** blanks → `Player N`; duplicates allowed.
- **Abandon mid-bout:** back/home discards in-memory state; nothing persisted.
- **Empty answer on Check:** treated as incorrect for that player (consistent with solo spar), solution still shown (it's study mode).
- **Deterministic ties** in assembly and leaderboard via explicit tiebreaks (seed; then marks→correct→setup order).

---

## 9. Testing approach

Headless Node tests (extend `_spar_test.js` or a sibling `_teamspar_test.js`, same extraction pattern):

- **`assembleTeamBout` size & fairness:** size = `min(players*2, 12)`; always a whole multiple of `playerCount`; shrinks correctly when bank is small; deterministic for a fixed seed.
- **`assembleTeamBout` spread:** prefers distinct topics (no excessive repeats while variety is available).
- **`teamLeaderboard` correctness:** marks summed per player; ranking respects marks→correct→order tiebreaks; MVP = rank 1; team total/grade correct.
- **Reused grader sanity:** `matchSparAnswer` already covered by the Invigilator suite; add one team-context case.
- **Offline guarantee (manual):** complete a full team session with networking disabled; no network requests.
- **Distribution sync (manual/CI):** after build, `index.html` and `CramBox-Mathematics-4004.html` hashes match.

---

## 10. Open questions (deferred to the implementation plan)

1. Exact "mixed spread" rule (round-robin across topics by difficulty vs simple seeded shuffle with a max-per-topic cap). v1 may use seeded shuffle + a soft cap of 1–2 per topic while variety lasts.
2. Whether **Spar again (same group)** should avoid repeating questions from the immediately previous bout (nice-to-have; v1 may allow repeats).
3. Leaderboard visual flourish (confetti/MVP animation) — reuse existing confetti or keep minimal.
4. Future optional **"Exam mode" toggle** (timed, solutions-at-end) — parked.
