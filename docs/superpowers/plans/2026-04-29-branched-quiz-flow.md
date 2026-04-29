# Branched Quiz Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the quiz branch after the opening audience-selection question so female, male, and couple flows ask different follow-up questions and route into different recommendation weighting presets.

**Architecture:** Keep the existing app shell and quiz stepper, but replace the single filtered question list with explicit per-branch question flows. Preserve the current product schema, and layer branch-specific recommendation heuristics on top of the existing structured scoring model through answer patches and branch preference bonuses.

**Tech Stack:** React, TypeScript, Motion, Node test runner, Vite

---

### Task 1: Branch Question Flow

**Files:**
- Modify: `src/data/mock.ts`
- Test: `src/data/mock.test.ts`

- [ ] Add branch-aware question flow types and helpers.
- [ ] Define explicit `female`, `male`, and `unisex` question flows, with extra couple-only questions.
- [ ] Add tests that verify each audience gets the intended ordered flow and couple flow is longer.

### Task 2: Quiz Selection Pipeline

**Files:**
- Modify: `src/pages/QuizPage.tsx`
- Modify: `src/App.tsx`

- [ ] Allow question options to write both their primary field and any derived answer patch.
- [ ] Switch active-question lookup to the new branch helper.
- [ ] Ensure step progression still works when the flow length changes after the first answer.

### Task 3: Branch Score Routing

**Files:**
- Create: `src/lib/quiz-branching.ts`
- Test: `src/lib/quiz-branching.test.ts`
- Modify: `src/App.tsx`

- [ ] Add a tested helper that selects the correct score preset id for female, male, and couple flows.
- [ ] Add tested branch-specific preference bonus logic that can score extra answers without changing the product schema.
- [ ] Replace the old mixed fallback path in the app with the new couple branch routing.

### Task 4: Answer Model and Recommendation Payloads

**Files:**
- Modify: `src/data/mock.ts`
- Modify: `src/lib/recommendation-results.ts`
- Modify: `src/lib/result-recalibration.ts`

- [ ] Extend `AnswerState` with branch-specific fields needed by the new questions.
- [ ] Preserve existing shared fields for core filtering and ranking.
- [ ] Pass the richer answer model through downstream result payload types.

### Task 5: Verification

**Files:**
- Test: `src/data/mock.test.ts`
- Test: `src/lib/quiz-branching.test.ts`

- [ ] Run targeted tests for question-flow and preset routing.
- [ ] Run `npm run lint`.
- [ ] Run `npm run build`.
- [ ] Run `git diff --check`.
