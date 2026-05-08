# Vercel API Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move existing Express `/api/*` routes to a single-entry Vercel Function without changing frontend API paths.

**Architecture:** Extract the Express app and initialization flow into `src/server/app.ts`, keep `src/server/index.ts` as the local listener, and add `api/index.ts` plus `vercel.json` for production routing on Vercel.

**Tech Stack:** Vite, React, Express, TypeScript, PostgreSQL, Vercel Functions

---

### Task 1: Extract Shared Server App

**Files:**
- Create: `src/server/app.ts`
- Modify: `src/server/index.ts`
- Modify: `src/server/recommender-items-schema.ts`

- [ ] Move the current Express app construction, database pool, service creation, and route registration from `src/server/index.ts` into `src/server/app.ts`.
- [ ] Add an `ensureServerReady()` promise guard that runs schema setup once and can retry after failure.
- [ ] Update `ensureRecommenderItemsSchema()` to include `subtype_code` so request handling no longer runs `ALTER TABLE`.
- [ ] Reduce `src/server/index.ts` to a local-only bootstrap that awaits `ensureServerReady()` and then starts listening on port `3010`.

### Task 2: Add Vercel Function Entry

**Files:**
- Create: `api/index.ts`
- Create: `vercel.json`

- [ ] Add `api/index.ts` that awaits `ensureServerReady()` and forwards requests to the shared Express app.
- [ ] Add `vercel.json` to rewrite `/api/:path*` requests to `/api/index?path=:path*` so the function can restore the original Express pathname.

### Task 3: Verify Build and Type Safety

**Files:**
- No functional source changes unless verification uncovers breakage

- [ ] Run `npm run build` and fix any bundling issues introduced by the split.
- [ ] Run `npm run lint` and fix any type issues from the new server entrypoints.
- [ ] Confirm the working tree contains only the intended migration changes, then prepare the branch for push.
