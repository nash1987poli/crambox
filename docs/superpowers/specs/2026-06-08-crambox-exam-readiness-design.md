# CramBox — "Exam Readiness" Layer Design Spec

**Date:** 2026-06-08
**Status:** Awaiting user review
**Owner:** Nash (Curious Inc)
**Applies to:** `index.html` / `CramBox-Mathematics-4004.html` (single self-contained offline file, Vercel `zimsec-prep`)
**Related:** Reuses readiness data from the Invigilator (`sparring.readiness`) and the existing practice scores + drill mastery. Builds on, and re-aims, the existing gamification (XP, streaks, ranks).

---

## 1. Summary

Add a **Study Optimization / Exam Readiness** layer that turns CramBox from an app that *feels* productive into one that *makes* students productive. It fuses the signal already collected (practice best scores, Invigilator readiness, drill mastery) into **one honest readiness % per topic**, rolls that up into a headline **Exam Readiness %**, expresses it as a **predicted grade** and a **mastered-topics count**, and uses it to tell each student **exactly what to study next**. Crucially, it **re-aims the existing XP/streak rewards at closing the readiness gap**, so the game mechanics now pull toward real learning outcomes.

**One line:** *"Know exactly how ready you are, and exactly what to do next."*

---

## 2. Goals

- Give every student a single honest **Exam Readiness %** they can optimize toward.
- Show **per-topic mastery** at a glance (which topics are strong / shaky / untouched).
- Point students at their **weakest, highest-impact topics** ("study next").
- **Re-aim gamification** so XP, streaks, rank, and celebration reward *closing gaps*, not raw activity.
- Use **gentle spaced-repetition decay** to keep the score honest and pull students back to revise.
- Stay **100% offline**, single-file, localStorage-only.

## 3. Non-goals (YAGNI)

- No server, no accounts, no sync.
- No per-question exam-frequency weighting in v1 (all topics weighted equally; "highest-impact" = lowest readiness × marks-available, see §5.3 — kept simple).
- No new AI calls. Pure computation over existing data.
- No removal of existing gamification — it is *re-aimed*, not replaced.
- No multi-subject scope (Maths 4004 only).

---

## 4. The three altitudes (hero metric = a blend)

The headline is **one readiness data set viewed at three altitudes** — they never compete:

1. **Readiness % — the dial.** Syllabus-wide 0–100%. Moves every session; always a next % to chase.
2. **Predicted grade — the meaning.** The ZIMSEC band the % falls into (for the student *and* the parent).
3. **X / 37 mastered — the map.** Count of topics at mastery (≥ 80%). Concrete progress.

All three derive from the same per-topic readiness numbers (§5).

---

## 5. The engine

### 5.1 Per-topic readiness (0–100)
For each of the 37 `DATA.maths.topics`, fuse the signals that exist for it (keyed by topic index `i` / title `T`):
- **Practice best %** — `store.maths.scores['t'+i]`
- **Invigilator readiness** — `store.sparring.readiness[T]`
- **Drill mastery %** — `store.drillMastery[mappedId]` (`correct/total`), only where a drill id maps to the topic; otherwise omitted.

**Blend rule (v1):** the topic's *base* readiness is the **weighted average of whichever signals are present**, weights Practice 0.4 / Invigilator 0.4 / Drill 0.2 **renormalised over the signals that exist**. If none exist, base = 0 (untouched counts against you — honest coverage).

### 5.2 Decay (gentle, spaced-repetition, exam-accelerating)
- Each topic records a **`lastTouched`** date (updated whenever it is practiced, drilled, or sparred — see §7).
- Readiness shown = base, reduced by decay once a topic is untouched beyond a grace window:
  - **> 14 days untouched:** lose ~1% per day beyond day 14, **capped** so it never falls below ~50% of base (never tanks).
  - **Final stretch (≤ 21 days to exam):** decay rate accelerates (~2%/day) and the grace window shrinks to ~7 days, so "keep everything warm" pressure peaks at the right time.
- Decay is **always paired with a 1-tap refresh action** in the UI — it is a prompt, not a punishment.

### 5.3 Roll-ups
- **Overall Exam Readiness %** = mean of all 37 topics' (decayed) readiness. (Averaging over *all* topics means ignoring a topic correctly holds the score down.)
- **Predicted grade** = band the overall % falls into (provisional ZIMSEC-style bands, tunable): A ≥ 75, B ≥ 60, C ≥ 50, D ≥ 40, E ≥ 30, U < 30.
- **Mastered count** = number of topics with readiness ≥ 80.
- **Study next** = the 3 lowest-readiness topics, tie-broken by *marks available* in that topic (more marks first), then topic order. (Approximates "weakest, highest-impact.")

All of §5 is **pure functions** over a plain store object → headlessly testable.

---

## 6. UI

### 6.1 Home — the hero "Exam Readiness" card
A prominent card at the top of the home screen (above or replacing the streak bar's prime spot):
- Big **Readiness % gauge** (ring or bar) with the **predicted grade** beside it.
- **`X / 37 mastered`** sub-line and **days-to-exam** (reuse exam countdown).
- A one-line coach prompt: *"3 strong sessions from a B"* / *"Revise Transformations — biggest win."*
- A **"Study next ▶"** button → jumps to the top study-next topic's lesson/practice.

### 6.2 Curriculum tree — per-topic readiness bars
Reuse the existing tree (`cs-best` slot): each topic section shows a small **readiness bar + %** colour-coded — green (≥80 mastered), amber (40–79 shaky), red (<40 / untouched). A **↻ "refresh"** hint appears on topics that have decayed.

### 6.3 "Study Next" strip
On the home card and/or a small panel: the 3 target topics as tappable chips → open that topic.

### 6.4 Re-aimed gamification (visible)
- **XP:** bonus XP when a session *raises* a topic's readiness (scaled to the lift); reduced XP for re-grinding a mastered topic. Keep the existing XP popup.
- **Streak:** reframed copy — "readiness kept warm" — and protects against decay (a maintained streak slows decay slightly). Mechanic stays the same day-based streak; only framing + a small decay-dampener.
- **Milestones/confetti:** fire on readiness events — topic crosses 80 ("Mastered!"), overall crosses a grade boundary ("You're tracking a B!").
- **Rank:** `getRank` becomes driven by **overall readiness** (0–100 → Beginner…Exam Ready) instead of raw XP, so "Exam Ready" finally means exam-ready. (XP still accrues and shows; rank just reads from readiness.)

---

## 7. Data model (localStorage, additive)

Extend the store with a small, backward-compatible block:
```
readiness: {
  touched: { "<topicTitle>": "<ISO date>", ... },   // last time each topic was studied
  lastTopicReadiness: { "<topicTitle>": 0-100 },     // last computed snapshot (for lift detection + decay base)
  overall: 0-100,                                     // last computed headline
  milestonesSeen: [ "<topic>:mastered", "grade:B", ... ]  // so celebrations fire once
}
```
- **Touch hooks:** `saveScore` (practice), drill correct/finish, and `saveBoutResult` (Invigilator) each call a shared `touchTopic(title)` that sets `readiness.touched[title] = today` and updates `lastTopicReadiness`.
- Absent block ⇒ treated as fresh; never blocks app load. No schema change to existing fields.

---

## 8. Components (all inside `index.html`, behind `// ===== READINESS MODULE START/END =====` markers for headless testing)

| Unit | Type | Responsibility |
|---|---|---|
| `topicReadiness(store, i, title, opts)` | pure | Base blend of practice/sparring/drill for one topic |
| `applyDecay(base, lastTouched, now, daysToExam)` | pure | Gentle, exam-accelerating decay |
| `examReadiness(store, topics, now, examDate)` | pure | Per-topic array + overall % |
| `predictedGrade(pct)` | pure | % → A–U band |
| `studyNext(perTopic, topics, n)` | pure | Lowest readiness × marks-available, top n |
| `readinessRank(pct)` | pure | % → rank (replaces XP-based rank source) |
| `touchTopic(title)` | impl | Record lastTouched + snapshot (store write) |
| `xpForReadinessLift(before, after)` | pure | Bonus XP scaled to the gap closed |
| Home card + tree bars + study-next | impl/DOM | Render the layer |

---

## 9. Edge cases

- **Brand-new user (no data):** overall 0%, grade U, 0/37 — framed as "Let's find your starting point. Take a diagnostic." (links to a quick spread, e.g. an Invigilator bout). Never a dead end.
- **All untouched / partial:** untouched topics = 0 and pull the average down honestly; study-next surfaces them first.
- **Decay floor:** readiness never falls below 50% of base, and never below what an untouched-from-the-start topic would be.
- **Milestone double-fire:** guarded by `milestonesSeen`.
- **Drill id ↔ topic mapping missing:** drill simply omitted from that topic's blend (no error).
- **No exam date set:** decay uses the standard (non-accelerated) curve.
- **Corrupt/old store:** missing `readiness` block recreated; rank/readiness fall back to safe defaults.

---

## 10. Testing

Headless Node harness (same pattern as `_spar_test.js`), extracting the READINESS module:
- `topicReadiness`: single-signal, multi-signal weighting/renormalisation, untouched = 0.
- `applyDecay`: no decay within grace; linear decay after; floor respected; accelerated near exam.
- `examReadiness`: overall = mean across all topics; honest coverage (untouched drags it down).
- `predictedGrade` / `readinessRank`: correct bands at boundaries.
- `studyNext`: picks lowest readiness, marks-available tiebreak, deterministic.
- `xpForReadinessLift`: scales with the gap; ~0 for re-grinding mastered topics.
- **Manual/browser:** home card renders, tree bars colour-code, study-next navigates, a practice/spar session updates readiness + fires the right XP/milestone, offline (no network).

---

## 11. Open questions (deferred to plan)

1. Exact blend weights (0.4/0.4/0.2) and decay constants — first-pass; tune after playtest.
2. Grade bands — provisional; confirm against real ZIMSEC boundaries if available.
3. Drill-id → topic-title mapping table (build during implementation; omit unmapped).
4. Whether the home hero card replaces or sits above the existing streak bar (visual call during build).
