# Natural Language Evidence And Backfill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add product-side evidence snippets, golden natural-language eval coverage, and a clear DB backfill boundary for recommendation features.

**Architecture:** Keep hard constraints local and deterministic. Extend `recommendation-product-features.ts` so every key boolean can carry short evidence snippets, then reuse those snippets in ranking/result copy and future backfill output.

**Tech Stack:** TypeScript, `node:test`, existing recommendation local ranking modules, Prisma-backed product data boundary.

---

### Task 1: Evidence Snippets In Product Features

**Files:**
- Modify: `src/lib/recommendation-product-features.ts`
- Modify: `src/lib/recommendation-product-features.test.ts`

- [ ] Add typed evidence snippets with `signal`, `text`, `polarity`, and `source`.
- [ ] Extract short snippets from names, tags, and raw descriptions.
- [ ] Preserve current boolean behavior for suction, app/remote, couple, patterns, and intensity.
- [ ] Verify with `npx tsx --test src/lib/recommendation-product-features.test.ts`.

### Task 2: Use Evidence In Recommendation Copy

**Files:**
- Modify: `src/lib/recommendation-local-ranking.ts`
- Modify: `src/lib/recommendation-results.ts`
- Modify: `src/lib/recommendation-results.test.ts`

- [ ] Add the strongest relevant evidence line to match summaries when natural-language intent is present.
- [ ] Keep result copy concise and avoid exposing raw noisy product descriptions.
- [ ] Verify with result and ranking tests.

### Task 3: Golden Natural-Language Eval Set

**Files:**
- Modify: `src/lib/recommendation-eval.test.ts`
- Optionally create: `src/lib/recommendation-natural-language-golden.test.ts`

- [ ] Add scenario checks for must/prefer/avoid combinations.
- [ ] Cover strong suction, more patterns, no insertable, no app, no couple, and gentle-but-suction requests.
- [ ] Verify eval tests pass.

### Task 4: Backfill Boundary

**Files:**
- Create: `src/db/backfill-recommendation-product-features.ts`
- Create: `src/db/backfill-recommendation-product-features.test.ts`
- Optionally update: `docs/2026-05-19-natural-language-intent-feature-rag-design.md`

- [ ] Build a pure serialization helper for product feature backfill payloads.
- [ ] Include `featureVersion`, booleans, and evidence snippets.
- [ ] Keep actual DB writes isolated so tests do not require network or credentials.

### Task 5: Verification

- [ ] Run product feature tests.
- [ ] Run natural-language intent tests.
- [ ] Run candidate pool tests.
- [ ] Run recommendation eval tests.
- [ ] Run recommendation results tests.
- [ ] Run `npx tsc --noEmit`.
