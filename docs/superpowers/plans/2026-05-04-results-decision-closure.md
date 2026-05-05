# Results Decision Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strengthen the results page so it feels like a decision guide instead of only a recommendation display.

**Architecture:** Extend the existing `ResultsPage` with one new summary block and one more structured next-step guidance block. Reuse current recommendation metadata and add small helper functions in `recommendation-results.ts` so the new UI is driven by consistent text generation instead of ad-hoc page strings.

**Tech Stack:** React, TypeScript, existing server-rendered page tests with `node:test` and `react-dom/server`

---

### Task 1: Add failing coverage for result decision-closure content

**Files:**
- Modify: `src/pages/ResultsPage.test.tsx`
- Test: `src/pages/ResultsPage.test.tsx`

- [ ] **Step 1: Write the failing test**

Add one server-render test that expects:

- a visible summary heading such as `为什么这条路线更适合你`
- a visible decision summary label such as `这次更适合先走`
- structured next-step groups including:
  - `下单前确认`
  - `收货后第一步`
  - `第一次开始时`

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test src/pages/ResultsPage.test.tsx`

Expected: FAIL because the new summary and grouped next-step content do not exist yet.

---

### Task 2: Implement minimal decision-summary helpers

**Files:**
- Modify: `src/lib/recommendation-results.ts`

- [ ] **Step 1: Add minimal helper functions**

Add one helper that builds a short route summary for the primary result and one helper that groups next-step guidance into:

- hesitation support
- pre-purchase checks
- first-receive / first-use steps

- [ ] **Step 2: Keep output deduped and concise**

Reuse existing answer signals and product fields where possible. Avoid introducing new persistence, API, or database changes.

---

### Task 3: Render the new result decision-closure blocks

**Files:**
- Modify: `src/pages/ResultsPage.tsx`

- [ ] **Step 1: Render the summary block near the primary recommendation**

Add a compact decision summary block that explains:

- why this route matches now
- what the user should prioritize next

- [ ] **Step 2: Upgrade next-step guidance into grouped sections**

Render grouped sections for:

- `如果还在犹豫`
- `下单前确认`
- `收货后第一步`
- `第一次开始时`

Only show groups that actually have content.

---

### Task 4: Verify and keep behavior stable

**Files:**
- Test: `src/pages/ResultsPage.test.tsx`

- [ ] **Step 1: Run the focused test file**

Run: `node --import tsx --test src/pages/ResultsPage.test.tsx`

Expected: PASS

- [ ] **Step 2: Run adjacent regression coverage**

Run: `node --import tsx --test src/lib/user-recommendation-profile.test.ts src/pages/ProfilesPage.test.tsx src/pages/HomePage.test.tsx`

Expected: PASS

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit`

Expected: PASS
