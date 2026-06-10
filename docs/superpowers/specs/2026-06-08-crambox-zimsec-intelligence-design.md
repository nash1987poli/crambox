# CramBox — ZIMSEC Intelligence Engine Design Spec

**Date:** 2026-06-08
**Status:** Awaiting user review
**Owner:** Nash (Curious Inc)
**Applies to:** `index.html` / `CramBox-Mathematics-4004.html` (single offline file)
**Extends:** the READINESS module (`// ===== READINESS MODULE START/END =====`). Reuses `examReadiness`, `studyNext`, `predictedGrade`, the home hero card, and the curriculum tree.
**Guided by:** `docs/strategy/CRAMBOX-FIRST-PRINCIPLES.txt` and `CRAMBOX-MATHS-ENGINE-ARCHITECTURE.txt` (the ZIMSEC Intelligence Layer).

---

## 1. Summary

Make CramBox's readiness **honest about what the exam actually rewards.** Today every topic counts equally toward Exam Readiness %. The ZIMSEC Intelligence Engine adds a **baked-in per-topic exam-weight table** (frequency + typical marks + difficulty) derived from ZIMSEC papers, and feeds it into the readiness maths so that:

1. **Overall readiness is a weighted average** — mastering a high-frequency, high-mark topic moves the needle more than a rare one.
2. **"Study next" becomes "biggest win first"** — the recommendation ranks topics by *expected mark impact* (how weak × how much the exam rewards it), and shows the estimated marks at stake.

It adds **zero libraries** (~5 KB of data + math), preserving the tiny-offline-file moat.

**One line:** *"Get ready for the marks that actually come up."*

---

## 2. Goals
- Weight Exam Readiness % by each topic's real exam importance (frequency × marks).
- Rank recommendations by **expected mark impact**, not just lowest readiness.
- Surface exam importance to students ("🔥 high-frequency", "worth ~N marks").
- Stay offline, single-file, no new libraries; pure vanilla JS in the READINESS module.

## 3. Non-goals (YAGNI)
- No runtime past-paper parsing (weights are baked-in data, curated at build time).
- No new math libraries (MathJS/Nerdamer/KaTeX/Dexie explicitly excluded — protects file size).
- No change to how per-topic readiness itself is measured (that stays the §5 blend from the readiness layer).
- No "expected gain prediction" beyond a simple, defensible marks-at-stake estimate (avoids false precision).

---

## 4. The data: `ZIMSEC_WEIGHTS`

A baked-in object keyed by topic title, one entry per `DATA.maths.topics`:
```
ZIMSEC_WEIGHTS = {
  "<topicTitle>": { freq: 0-100, marks: <int>, diff: 1|2|3 }, ...
}
```
- **freq** — relative frequency the topic appears across ZIMSEC 4004/4075 papers (0–100 scale; higher = appears more often).
- **marks** — typical marks the topic carries in a paper.
- **diff** — difficulty band (1 easy, 2 medium, 3 hard).

> **Honesty note:** v1 values are *informed estimates* by the author, seeded from the 4075 specimen paper analysis + general O-Level frequency. They are explicitly flagged for the maths-expert reviewer to confirm. A `_zimsecVerified: false` marker ships until a human signs off. Wrong weights only mis-prioritise; they never produce wrong answers.

Missing topic ⇒ neutral default `{ freq: 50, marks: 6, diff: 2 }` (so the system degrades gracefully and an unlisted topic still participates).

---

## 5. The maths (pure functions, in the READINESS module)

### 5.1 `topicExamWeight(weights, title)`
Combine into one importance number: `weight = (freq/100) * marks`. (Difficulty is *displayed* but not multiplied into the weight in v1 — harder topics shouldn't silently inflate readiness contribution; they're surfaced as a tag.) Returns a positive number; uses the neutral default if the title is missing.

### 5.2 Weighted overall readiness — extend `examReadiness`
`examReadiness(store, topics, now, examDate, weights)` gains an optional `weights` arg:
- Each `perTopic` row also carries `weight` (from `topicExamWeight`).
- **overall** = `round( Σ(readiness_i × weight_i) / Σ(weight_i) )` when weights are supplied; falls back to the plain mean when `weights` is absent (backward-compatible with existing tests/callers).
- `mastered`/`total` unchanged.

### 5.3 Biggest-win recommendation — `studyImpact(perTopic, n)`
Replaces/augments `studyNext` ranking:
- Each topic's **impact** = `(100 - readiness)/100 × weight` → "how much exam reward is currently unrealised."
- Returns the top `n` by impact (desc), tie-broken by lower readiness then topic order.
- Each returned row includes `marksAtStake = round((100 - readiness)/100 × marks)` for the "worth ~N marks" copy.

---

## 6. UI changes (small, reuse existing surfaces)

- **Home hero coach line** → name the single biggest win:
  *"Biggest win: Mensuration — worth ~9 marks."*
- **Study-next chips** → ordered by impact (not raw weakness); each chip keeps `topic %`, high-impact ones get a 🔥.
- **Curriculum tree** → a small 🔥 indicator (or "HOT") next to high-frequency topics (freq ≥ a threshold), so students see which topics matter most even when browsing.
- No new screens.

---

## 7. Components (all inside the READINESS markers)

| Unit | Type | Responsibility |
|---|---|---|
| `ZIMSEC_WEIGHTS` | data | Per-topic freq/marks/diff (baked-in) |
| `topicExamWeight(weights, title)` | pure | freq×marks importance, neutral default |
| `examReadiness(..., weights)` | pure (extended) | Weighted overall + per-topic `weight` |
| `studyImpact(perTopic, n)` | pure | Top-n by expected mark impact + `marksAtStake` |
| hero/tree render updates | impl/DOM | Pass `ZIMSEC_WEIGHTS`, show biggest-win + 🔥 |

---

## 8. Edge cases
- **Weights absent (old callers/tests):** `examReadiness` falls back to plain mean; `studyImpact` degrades to weakness order (weight defaults). Backward-compatible.
- **All topics untouched:** impact ranks by weight alone (highest-value topics surfaced first) — correct "where to start."
- **Unlisted topic:** neutral default weight; never zero-divides.
- **Mastered topics (≥80):** low impact (small `100-readiness`), so they correctly drop out of recommendations.
- **Division by zero:** `Σweight` guarded; if 0, fall back to mean.

---

## 9. Testing (extend `_readiness_test.js`)
- `topicExamWeight`: freq×marks; neutral default for missing; positive.
- `examReadiness` weighted: high-weight mastered + low-weight weak → overall higher than the plain mean would give (proves weighting bites); absent-weights path still equals the old mean (regression).
- `studyImpact`: a weak high-weight topic outranks a slightly-weaker low-weight topic; `marksAtStake` computed; mastered topics rank last.
- Regression: existing readiness/spar/team suites still green.
- Browser: hero shows "Biggest win … worth ~N marks"; tree shows 🔥 on high-freq topics; offline (no network).

---

## 10. Open questions (deferred to plan/tuning)
1. Exact `ZIMSEC_WEIGHTS` numbers — author's estimates in v1; maths reviewer confirms; `_zimsecVerified` flips true after sign-off.
2. 🔥 threshold for "high-frequency" (start at freq ≥ 70).
3. Whether difficulty ever factors into weight (v1: display-only).
