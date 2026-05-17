# Safe Project Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce low-value code and artifact clutter in the project without changing core product behavior.

**Architecture:** Start with safe cleanup only: remove disposable artifacts, identify dead or duplicate paths, and extract repeated scraper patterns into clearer shared conventions where the change is mechanically safe. Avoid broad behavioral refactors in this phase.

**Tech Stack:** TypeScript, Node, scraper modules under `src/scraper`, DB scripts under `src/db`, docs and plans

---

### Task 1: Inventory low-risk cleanup targets

**Files:**
- Modify: `docs/superpowers/specs/2026-05-17-safe-project-cleanup-design.md`
- Test: none

- [ ] Enumerate disposable generated artifacts in `src/data`
- [ ] Enumerate obvious debug-only files like `src/debug_detail_dom.html`
- [ ] Enumerate duplicated scraper patterns safe to standardize later

### Task 2: Remove disposable artifacts and dead debug files

**Files:**
- Modify or delete: confirmed generated artifacts under `src/data`
- Delete: obviously dead debug-only files such as `src/debug_detail_dom.html`
- Test: `git status`, file existence checks

- [ ] Delete confirmed disposable files only
- [ ] Verify deleted paths are not referenced by runtime code
- [ ] Verify worktree stays coherent after deletion

### Task 3: Document duplicated scraper conventions

**Files:**
- Modify: `.agents/skills/shopify-official-scraper/SKILL.md`
- Test: manual read-through

- [ ] Consolidate repeatable official-site scraper conventions into the skill
- [ ] Add explicit notes on collection HTML + products.json + product .js fallback patterns
- [ ] Add notes on noisy HTML avoidance and source-currency handling

### Task 4: Identify next-phase structural refactor candidates

**Files:**
- Modify: `docs/superpowers/specs/2026-05-17-safe-project-cleanup-design.md`
- Test: none

- [ ] Capture which areas should move to phase 2
- [ ] Separate safe cleanup from higher-risk architectural changes
- [ ] Leave clear handoff notes for future refactors

### Task 5: Verify safe cleanup state

**Files:**
- Modify: none
- Test: `git status`, targeted `rg` checks

- [ ] Run `git status --short`
- [ ] Run targeted reference checks for deleted debug/artifact files
- [ ] Summarize exactly what was removed and what was intentionally left alone
