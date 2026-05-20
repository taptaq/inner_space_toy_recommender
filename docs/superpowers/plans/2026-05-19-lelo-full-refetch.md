# LELO Full Refetch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the legacy LELO scraper to the modern official-site pipeline and rerun all LELO products so `raw_description`, `material`, `type_code`, and `subtype_code` are repopulated in `recommender_toys`.

**Architecture:** Keep the existing `src/scraper/lelo/` entrypoints, but swap in a dedicated LELO review buffer plus a modern cleaner modeled after the current official-site scrapers. The crawler owns discovery and detail extraction; the cleaner owns translation, inference, classification, cleaned JSON output, and DB writes.

**Tech Stack:** TypeScript, Node.js 20, `tsx`, `node:test`, Playwright, Prisma + PostgreSQL, shared raw-description translator, shared library product type classifier.

---

### Task 1: Lock LELO cleaner behavior with tests

**Files:**
- Create: `src/scraper/lelo/cleaner.test.ts`
- Modify: `src/scraper/lelo/cleaner.ts`

- [ ] **Step 1: Write the failing test**

Add tests that assert `buildNormalizedSpecs` returns normalized `material`, `type_code`, and `subtype_code` for representative LELO products, plus a test that canonical-name dedupe still works through the shared helper path.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test src/scraper/lelo/cleaner.test.ts`
Expected: FAIL because the current LELO cleaner does not export a modern `buildNormalizedSpecs` contract and does not match the new test expectations.

- [ ] **Step 3: Write minimal implementation**

Replace the old LELO cleaner with a modern implementation that exports `buildNormalizedSpecs`, shares helper functions with other official scrapers, and persists normalized LELO rows.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --import tsx --test src/scraper/lelo/cleaner.test.ts`
Expected: PASS

### Task 2: Upgrade the LELO crawler output contract

**Files:**
- Modify: `src/scraper/lelo/crawler.ts`
- Modify: `src/scraper/lelo/cleaner.ts`

- [ ] **Step 1: Add or adjust crawler-focused expectations**

Make sure the crawler writes a LELO-specific review buffer path, preserves source URL, name, cover image, gender hint, and richer detail text needed by the cleaner.

- [ ] **Step 2: Run a syntax-level verification**

Run: `node --import tsx --test src/scraper/lelo/cleaner.test.ts`
Expected: PASS, confirming the cleaner still matches the crawler payload contract used in tests.

- [ ] **Step 3: Implement crawler changes**

Modernize `src/scraper/lelo/crawler.ts` so it:

- writes to `src/data/lelo-review-buffer.json`
- removes the hard `50` item ceiling in favor of an env-controlled max
- extracts stronger detail text and normalized prices
- keeps the automatic cleaner handoff

- [ ] **Step 4: Run static verification**

Run: `npx tsc --noEmit`
Expected: PASS

### Task 3: Verify the full local code path before live rerun

**Files:**
- Modify: `src/scraper/lelo/cleaner.ts`
- Modify: `src/scraper/lelo/crawler.ts`
- Test: `src/scraper/lelo/cleaner.test.ts`

- [ ] **Step 1: Run targeted tests**

Run: `node --import tsx --test src/scraper/lelo/cleaner.test.ts src/db/backfill-item-type-code.test.ts`
Expected: PASS

- [ ] **Step 2: Fix any LELO-specific regressions**

Adjust only the LELO implementation or clearly related helpers if the targeted suite fails.

- [ ] **Step 3: Re-run targeted tests**

Run: `node --import tsx --test src/scraper/lelo/cleaner.test.ts src/db/backfill-item-type-code.test.ts`
Expected: PASS

### Task 4: Execute the live LELO full rerun and verify DB results

**Files:**
- Runtime only: `src/scraper/lelo/crawler.ts`

- [ ] **Step 1: Run the full LELO crawler**

Run: `node --import tsx src/scraper/lelo/crawler.ts`
Expected: crawler completes, writes `src/data/lelo-review-buffer.json`, then runs the cleaner and writes `src/data/lelo-cleaned-data.json`.

- [ ] **Step 2: Verify LELO database results**

Run a DB query that checks:

- total LELO rows
- LELO rows with empty `raw_description`
- a sample of LELO rows with `name`, `material`, `type_code`, `subtype_code`

Expected: LELO `raw_description` empties fall sharply from `62`, and sample rows show updated normalized fields.

- [ ] **Step 3: Record any residual gaps**

If a small number of LELO rows still have empty descriptions or `unknown` type classification, capture them for follow-up rather than silently ignoring them.
