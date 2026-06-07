# CramBox — "Spar with the Invigilator" Design Spec

**Date:** 2026-06-06
**Status:** Awaiting user approval
**Owner:** Nash (Curious Inc)
**Applies to:** `index.html` / `CramBox-Mathematics-4004.html` (single self-contained file, deployed on Vercel as `zimsec-prep`)

---

## 1. Summary

Add an AI sparring mode to CramBox called **"Spar with the Invigilator."** The student faces an adaptive AI examiner (the Invigilator) that has quietly studied their record, **hunts the topics they keep dropping marks on**, and tests them under **real exam conditions** — exam-worded questions, mark allocations, and a marks-based bout timer that tightens as they get sharper.

It is **one mode**, not two: the *Invigilator* supplies the exam pressure and realism; the *Hunter brain* aims that pressure at the student's weak spots.

**One-line positioning:** *"Your invigilator knows where you're weak. Spar until they don't."*

---

## 2. Strategic context (why it's built this way)

CramBox's Blue Ocean edges are **(a) works offline / zero data** and **(b) micro-EcoCash price**. A *live* AI partner (calling Claude at runtime) would break both: it needs data every time, costs money per question, and — because CramBox is distributed as a shared WhatsApp file — would expose the product to API-cost abuse from non-buyers.

**Therefore the AI runs at build time, not runtime.** Claude pre-generates a tagged question bank that ships *inside* the HTML. The sparring experience is fully AI-authored but runs **offline at zero per-student cost**. This is a hard constraint, not a preference.

---

## 3. Goals

- Give students an adaptive, exam-pressure practice mode that targets their personal weaknesses.
- Reuse CramBox's existing data (per-topic scores) and feel (streaks, XP, worked solutions).
- Run **100% offline** with **no runtime API calls** and **no exposed API key**.
- Teach a real exam skill most students never practise: **time budgeting across a paper.**

## 4. Non-goals (YAGNI)

- **No live/runtime AI** in the core product (held as a future premium "Challenge Mode" — see §13).
- **No boxing/combat metaphor** (health bars, KO). Rejected in design: too arcade, unfair across mixed mark values.
- **No per-question timer** (rejected — see §8).
- **No new backend, accounts, or server** for this feature. Everything lives in the existing static file + localStorage.
- **No multi-subject scope yet** — Maths (4004) only, matching the current app.

---

## 5. Persona — The Invigilator

- **Tone:** silent, observant, fair-but-strict. Speaks rarely and briefly. In ZIMSEC/Commonwealth exam culture the invigilator is the person who *watches you write* — the persona leans on that "being observed under pressure" feeling.
- **Voice samples:**
  - Pre-bout: *"I've seen your record. Today we work on Transformations."*
  - Mid-bout: silence (no hints — see §8).
  - Post-bout: *"5 of 6. Grade B. I'm gaining respect for you."* / *"3 of 6. The clock beat you on Q4. We go again."*
- The Invigilator **gets stricter as the student improves** (tighter time budget — see §9), which reads as the persona "raising the bar."

---

## 6. Core concept model

Three pieces work together:

1. **Readiness model** — a per-topic % derived from the student's saved performance. The "Hunter brain."
2. **Question bank** — an AI-authored, tagged set of exam-style questions baked into the file.
3. **Bouts** — short timed "mini-papers" assembled from the bank, weighted toward weak topics.

### 6.1 Readiness model (the Hunter brain)

- **Source data:** CramBox already persists per-topic results via the store's `saveScore(subject, topicIdx, earned, total)`. Sparring derives a **readiness %** per topic from this history.
- **Definition (v1):** `readiness = round(100 * recentEarned / recentTotal)` over the student's most recent attempts on that topic, blended with sparring-bout results on that topic. Exact recency window and blend weight to be finalised in the implementation plan; v1 may simply use the latest stored ratio if recency tracking isn't yet available.
- **Cold start (no data yet):** topics with no history are treated as **unknown/low readiness** so the Invigilator probes them early to gather signal. A brand-new user's first bout is a **diagnostic spread** across many topics.
- **Storage:** readiness is *computed*, not a new source of truth — but a small `sparring` block is added to the store for bout history and per-topic readiness snapshots (see §10).

### 6.2 Question bank (the AI, baked in)

- A new data structure (working name `SPAR_BANK`) of AI-generated questions, **tagged** by:
  - `topic` (must match an existing `DATA.maths.topics[].title`)
  - `difficulty` (`easy` | `medium` | `exam`)
  - `marks` (integer)
  - `q` (exam-worded question text, same HTML-entity conventions as existing `practice[]`)
  - `answer` (canonical answer; supports numeric, coordinate-pair `isCoord`, and text/word answers — mirrors the patterns already in `practice[]` and the transformation drill)
  - `exp` (full worked solution)
- Generated by Claude **at build time** (in-chat with Nash), reviewed, then pasted into the file. Refreshable any time by re-running generation.
- Reuses the **existing answer-matching logic** (`answersMatch`, the `isCoord` coordinate branch) so no new grading engine is needed.

### 6.3 Bouts (the Invigilator's papers)

- A **bout** = a small set of questions (default **6**) assembled at the moment the student taps "Spar."
- **Selection rule:** ~70% of questions drawn from the student's **lowest-readiness topics**, ~30% from stronger topics (so it's challenging, not punishing). Once a topic crosses a **mastery threshold (~80%)**, it is dropped from selection and the next-weakest topic rotates in.
- **Difficulty laddering:** within a targeted topic, question difficulty rises as that topic's readiness rises (`easy → medium → exam`).

---

## 7. Bout flow (happy path)

1. Student opens **Spar with the Invigilator** from the main maths menu.
2. **Pre-bout card:** Invigilator names the focus ("Today we work on Transformations & Probability") and shows the bout size, total marks, and the time budget.
3. Student taps **Begin.** Timer starts (see §8).
4. Questions presented **one at a time**, each showing its **[N marks]** allocation, exam wording, and an answer box. **No hints, no per-question feedback** during the bout.
5. Student answers and advances. They may skip/return if time allows (implementation detail; v1 may be linear forward-only — to confirm in plan).
6. Bout ends when all questions are answered **or** the timer hits zero (unanswered = lost marks).
7. **Verdict screen:**
   - Grade verdict line from the Invigilator (e.g. *"5/6 — Grade B."*).
   - **Full worked solution for every missed question.**
   - **Readiness bars animate upward** on topics the student cleared; flat/down on topics they dropped.
   - XP awarded (reuse `addXP`), with a bonus for beating the clock with marks to spare.
8. Options: **Spar again** (fresh bout, re-targeted to the new weakest topics) or **Done**.

---

## 8. Timer design

- **Marks-based, whole-bout timer.** Budget ≈ **1 minute per mark** at base intensity (roughly ZIMSEC's real pace). A 12-mark bout → ~12 minutes.
- **Why whole-bout, not per-question:** a 4-mark question genuinely needs more time than a 2-mark one, so a fixed per-question clock is unfair and trains panic. A whole-bout budget mirrors the real exam and teaches **time budgeting** — itself a mark-saving skill.
- **Pressure spikes:** the clock turns **amber in the last 90s** and **red in the last 30s**.
- **No mid-bout hints** — the Invigilator is silent until the paper is done. Reinforces exam realism and forces independent recall.
- **Expiry:** when the timer hits zero, the bout auto-submits; unanswered questions score zero marks (exactly like the real exam).

## 9. Adaptive escalation

- As a student's overall sparring readiness climbs, the Invigilator **tightens the budget**: base **60s/mark → 50s/mark → 40s/mark** at defined readiness tiers (exact thresholds set in the plan).
- Difficulty of served questions also ladders up per topic (§6.3).
- Net effect: intensity ramps with skill, with **no per-question unfairness**. Reads narratively as the Invigilator "raising the bar."

---

## 10. Data model changes

### 10.1 New: `SPAR_BANK` (baked-in question bank)
Array of question objects (see §6.2 for fields). Lives alongside `DATA` in the file. Topics **must** map to existing `DATA.maths.topics[].title` strings.

### 10.2 Store additions (localStorage)
Extend the existing store object with a `sparring` block, e.g.:

```
sparring: {
  readiness: { "<topicTitle>": 0-100, ... },   // last computed snapshot per topic
  bouts: [ { date, focusTopics:[...], score, total, marksEarned, marksTotal, beatClock } ],
  intensityTier: 0 | 1 | 2                       // drives s/mark budget
}
```

- Persisted through the **existing store persistence layer** (same `getStore()`/save mechanism used today). No new storage system.
- Backward-compatible: absent `sparring` block is treated as a fresh start.

---

## 11. Integration with existing code

- **Reuses:**
  - `DATA.maths.topics[].title` as the canonical topic keys.
  - `saveScore` history / store for readiness derivation.
  - `answersMatch` + the `isCoord` coordinate-answer branch for grading (numeric, coordinate, and text answers all already supported).
  - `addXP`, streak/feedback visuals, worked-solution rendering patterns.
  - Screen/`history.push(screen)` navigation pattern and `showScreen` for the new sparring screens.
- **Adds:**
  - `SPAR_BANK` data block.
  - A readiness-computation function.
  - A bout-assembly function (selection + difficulty ladder + timer budget).
  - Sparring screens (pre-bout, in-bout, verdict) following existing markup/CSS conventions.
- **Distribution:** because everything is in the single file, the feature ships identically to the hosted `index.html` and the WhatsApp `CramBox-Mathematics-4004.html` copy (kept in sync, as today).

---

## 12. Edge cases & error handling

- **No history (cold start):** first bout is a diagnostic spread; unknown topics treated as low readiness.
- **Empty/insufficient bank for a topic:** selection falls back to the next-weakest topic with available questions; if the whole bank is too small, bout size shrinks gracefully rather than erroring.
- **All topics above mastery threshold:** Invigilator congratulates and serves a **mixed "championship" bout** at top difficulty/intensity instead of having nothing to target.
- **Timer expiry mid-answer:** current input is captured if present; remaining questions score zero.
- **Ties in readiness:** deterministic tiebreak (e.g. topic order in `DATA`) so behaviour is predictable/testable.
- **Corrupt/old store:** missing `sparring` block is recreated; never blocks app load.

---

## 13. Future / premium (explicitly out of scope for v1)

- **Live "Challenge Mode":** an optional online tier where a Vercel serverless function (same pattern as the X-Ray app's `/api` + `ANTHROPIC_API_KEY`) generates *truly live* sparring questions. Gated behind a higher price / separate activation code so cost is covered and the free shared file can't abuse the API. This is an **upsell**, never the core.
- **Diaspora-parent readiness report** (ties to the Blue Ocean "sell to the payer" move): a shareable readiness summary a parent abroad can see.

---

## 14. Testing approach

- **Bank integrity (build-time check, Node):** every `SPAR_BANK` item has a valid `topic` matching `DATA`, a positive `marks`, a non-empty `q`/`answer`/`exp`, and (for `isCoord`) a valid `coordPair`. Mirrors the existing `_verify.py` / Node audit harness already in the repo.
- **Answer-key correctness:** numeric/coordinate answers re-derived independently where possible (extend the existing SymPy + Node verification pattern).
- **Selection logic (unit):** given a synthetic readiness map, the bout pulls ~70% from weakest topics, respects the mastery threshold, and is deterministic under ties.
- **Timer budget (unit):** budget = marks × current s/mark tier; amber/red thresholds fire correctly; expiry auto-submits.
- **Cold start (unit):** zero-history user gets a diagnostic spread without errors.
- **Offline guarantee (manual):** load the file with networking disabled; full bout completes with no network requests.

---

## 15. Open questions (to resolve in the implementation plan)

1. Recency window + blend weight for the readiness formula (v1 may use latest stored ratio).
2. Default bout size (6) and whether the student can choose a longer "mock paper" bout.
3. Forward-only vs revisitable questions within a bout.
4. Exact readiness tiers that trigger the 60→50→40 s/mark tightening and the easy→medium→exam laddering.
5. Initial `SPAR_BANK` size per topic for launch (enough variety to avoid repeats within a few bouts).
