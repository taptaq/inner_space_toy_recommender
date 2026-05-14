# Body Persona Full Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the `0.5 元解锁` body persona experience into a login-gated, auto-opening `完整星系人格档案` flow with a richer data model, a dedicated full-report dialog, and stronger paid-value messaging.

**Architecture:** Keep the existing `free summary -> unlock order -> confirm unlock` backbone, but expand `BodyPersonaFullReport` into a richer contract shared by the deterministic report builder, the AI enhancement service, the Express unlock route, and the React UI. Replace the current inline unlocked section with a lightweight unlock panel plus a portal-backed full-report dialog that opens automatically after successful unlock and can be reopened later from the results page.

**Tech Stack:** React 19, TypeScript, Express, Postgres JSONB persistence, existing Supabase auth helpers, lucide-react, Node test runner with `tsx`.

---

## File Map

### Existing files to modify

- `src/lib/body-persona-report.ts`
  Expand the full report types and deterministic report generator.
- `src/lib/body-persona-report.test.ts`
  Add coverage for the richer full report structure and new deterministic fields.
- `src/server/body-persona-report-service.ts`
  Expand AI enhancement normalization to support the richer report fields.
- `src/server/body-persona-report-service.test.ts`
  Add tests for field merge behavior and fallback logic.
- `src/server/body-persona-route.ts`
  Normalize and persist the richer full report shape during session create and unlock confirm.
- `src/server/body-persona-route.test.ts`
  Add tests for unlock payload shape and report normalization.
- `src/lib/body-persona-api.ts`
  Expand API response typing for richer unlocked reports.
- `src/App.tsx`
  Add login-before-unlock gating, continue-after-login behavior, dialog open state, and auto-open after successful unlock.
- `src/pages/ResultsPage.tsx`
  Replace the current inline unlocked report usage with a slimmer unlock panel and a reopen entry point.
- `src/components/BodyPersonaResultPanel.tsx`
  Convert from “full report renderer” into “free summary + unlock CTA + reopen CTA” panel, or split its responsibilities if the task sequence chooses to shrink it.
- `src/pages/ResultsPage.test.tsx`
  Add coverage for unlock CTA copy and the reopened full-report entry point.

### New files to create

- `src/components/BodyPersonaFullReportDialog.tsx`
  Portal-backed full-report modal shown automatically after unlock and manually via reopen CTA.
- `src/components/BodyPersonaHeroCard.tsx`
  Hero stage for image placeholder, manifesto, subtitle, and persona tags.
- `src/components/BodyPersonaDimensionGrid.tsx`
  Grid of score cards for body persona dimension breakdown.
- `src/components/BodyPersonaHiddenRouteCard.tsx`
  Hidden-route explanation card with power grade and co-living comfort.
- `src/components/BodyPersonaRouteAdviceCard.tsx`
  Route summary, good fits, avoid notes, scene matches, pace advice, and parameter focus.
- `src/components/BodyPersonaProductMatchesCard.tsx`
  Category matches, product picks, and mismatch warnings.
- `src/components/BodyPersonaFullReportDialog.test.tsx`
  Rendering tests for the dialog hero, placeholder image state, and close actions.

---

### Task 1: Expand the full report contract and deterministic builder

**Files:**
- Modify: `src/lib/body-persona-report.ts`
- Test: `src/lib/body-persona-report.test.ts`

- [ ] **Step 1: Write the failing report-shape test**

Add this test case to `src/lib/body-persona-report.test.ts`:

```ts
test("buildBodyPersonaFullReport returns the richer full report contract", () => {
  const report = buildBodyPersonaFullReport({
    persona: {
      primaryPersonaCode: "starlit_guard",
      secondaryPersonaCode: "soft_glow",
      hiddenRouteCode: "daily_object",
      hiddenPowerGrade: "S",
      coLivingComfortGrade: "high",
      freeSummary: {
        title: "隐私安全型",
        blurb: "你更在意低压力进入、隐私边界和不打扰自己的节奏。",
        why: "你在隐私需求、慢热节奏和安全感维度得分更高。",
        hints: ["先看低存在感路线", "优先节奏温和、易收纳的产品"],
      },
    },
    candidatePool: [
      {
        id: "demo-1",
        name: "演示产品",
        score: 86,
        appearance: "high_disguise",
        maxDb: 38,
        tags: ["静音", "伪装"],
        typeCode: "external_vibe",
      },
    ],
  });

  assert.equal(report.personaName, "隐私安全型");
  assert.equal(report.secondaryPersonaName, "慢热探索型");
  assert.equal(report.hiddenRouteName, "日常器物型");
  assert.equal(report.personaImageAsset, null);
  assert.equal(report.dimensionBreakdown.length, 6);
  assert.equal(report.topCategoryMatches.length > 0, true);
  assert.equal(report.productPicks[0]?.reason.length > 0, true);
  assert.equal(report.parameterFocus.length > 0, true);
  assert.equal(report.sceneMatches.length > 0, true);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
node --import tsx --test src/lib/body-persona-report.test.ts
```

Expected: FAIL with missing properties such as `personaName`, `dimensionBreakdown`, or `topCategoryMatches`.

- [ ] **Step 3: Expand the type definitions and deterministic builder**

Update `src/lib/body-persona-report.ts` so it contains the richer type contract and deterministic builder structure:

```ts
export type BodyPersonaDimensionScore = {
  id:
    | "safety_boundary"
    | "pace_control"
    | "atmosphere_need"
    | "response_need"
    | "privacy_need"
    | "disguise_need";
  label: string;
  score: number;
  summary: string;
};

export type BodyPersonaCategoryMatch = {
  id: string;
  label: string;
  fitScore: number;
  reason: string;
};

export type BodyPersonaProductPick = BodyPersonaCandidate & {
  personaScore: number;
  reason: string;
  categoryLabel?: string;
};

export type BodyPersonaFullReport = {
  reportTitle: string;
  personaName: string;
  personaSubtitle: string;
  personaManifesto: string;
  personaImageAsset: string | null;
  primaryPersonaCode: BodyPersonaResult["primaryPersonaCode"];
  secondaryPersonaCode: BodyPersonaResult["secondaryPersonaCode"];
  secondaryPersonaName: string | null;
  hiddenRouteCode: BodyPersonaResult["hiddenRouteCode"];
  hiddenRouteName: string;
  hiddenPowerGrade: BodyPersonaResult["hiddenPowerGrade"];
  coLivingComfortGrade: BodyPersonaResult["coLivingComfortGrade"];
  portraitShort: string;
  portraitLong: string;
  whyYouAreThis: string;
  strengthTags: string[];
  growthTip: string;
  dimensionBreakdown: BodyPersonaDimensionScore[];
  hiddenRouteSummaryShort: string;
  hiddenRouteSummaryLong: string;
  disguisePreference: string;
  storagePreference: string;
  privacyNeedLevel: string;
  bestRouteSummary: string;
  goodFits: string[];
  avoidNotes: string[];
  sceneMatches: string[];
  paceAdvice: string[];
  parameterFocus: string[];
  topCategoryMatches: BodyPersonaCategoryMatch[];
  pickReasonSummary: string;
  mismatchWarnings: string[];
  productPicks: BodyPersonaProductPick[];
};
```

Inside the same file, add label maps and deterministic builders so `buildBodyPersonaFullReport` returns a complete object:

```ts
const PERSONA_DISPLAY_NAMES: Record<BodyPersonaResult["primaryPersonaCode"], string> = {
  soft_glow: "慢热探索型",
  starlit_guard: "隐私安全型",
  tidal_sync: "氛围感受型",
  comet_spark: "直接点燃型",
  ring_control: "节奏掌控型",
  twin_orbit: "互动共振型",
};

const HIDDEN_ROUTE_LABELS: Record<BodyPersonaResult["hiddenRouteCode"], string> = {
  zero_profile: "低存在感型",
  daily_object: "日常器物型",
  beauty_disguise: "精致伪装型",
  pocket_ready: "口袋随身型",
};

function buildDimensionBreakdown(persona: BodyPersonaResult): BodyPersonaDimensionScore[] {
  if (persona.primaryPersonaCode === "starlit_guard") {
    return [
      { id: "safety_boundary", label: "安全边界", score: 92, summary: "你需要先确认不会被打扰，身体才会放松。" },
      { id: "pace_control", label: "节奏掌控", score: 74, summary: "你偏好低压力进入，而不是被突然推快。" },
      { id: "atmosphere_need", label: "氛围需求", score: 46, summary: "你需要的是安稳氛围，不一定需要强氛围戏剧性。" },
      { id: "response_need", label: "回应需求", score: 35, summary: "你更先关注边界，而不是互动回应本身。" },
      { id: "privacy_need", label: "隐私需求", score: 95, summary: "你对暴露和打扰的敏感度很高。" },
      { id: "disguise_need", label: "伪装需求", score: 88, summary: "越像日常物件，你越容易长期安心使用。" },
    ];
  }

  return [
    { id: "safety_boundary", label: "安全边界", score: 70, summary: "你仍然在意舒服和边界，但不是唯一核心。" },
    { id: "pace_control", label: "节奏掌控", score: 68, summary: "你对节奏有稳定偏好。" },
    { id: "atmosphere_need", label: "氛围需求", score: 66, summary: "氛围会影响你的进入状态。" },
    { id: "response_need", label: "回应需求", score: 60, summary: "你会被反馈和回应放大体验。" },
    { id: "privacy_need", label: "隐私需求", score: 62, summary: "你需要适度的私密边界。" },
    { id: "disguise_need", label: "伪装需求", score: 58, summary: "你会考虑日常收纳和被看到时的压力。" },
  ];
}
```

Use those helpers in `buildBodyPersonaFullReport` to return a filled object, including:

```ts
return {
  reportTitle: `${persona.freeSummary.title} · 完整星系人格档案`,
  personaName: persona.freeSummary.title,
  personaSubtitle: `${PERSONA_DISPLAY_NAMES[persona.primaryPersonaCode]} · 星系人格档案`,
  personaManifesto: "你不是退缩，你只是更需要边界清晰的靠近方式。",
  personaImageAsset: null,
  primaryPersonaCode: persona.primaryPersonaCode,
  secondaryPersonaCode: persona.secondaryPersonaCode,
  secondaryPersonaName: persona.secondaryPersonaCode
    ? PERSONA_DISPLAY_NAMES[persona.secondaryPersonaCode]
    : null,
  hiddenRouteCode: persona.hiddenRouteCode,
  hiddenRouteName: HIDDEN_ROUTE_LABELS[persona.hiddenRouteCode],
  hiddenPowerGrade: persona.hiddenPowerGrade,
  coLivingComfortGrade: persona.coLivingComfortGrade,
  portraitShort: persona.freeSummary.blurb,
  portraitLong: `${persona.freeSummary.blurb} 你的身体会优先确认边界、安全感与进入节奏，再决定是否继续向更深的体验推进。`,
  whyYouAreThis: persona.freeSummary.why,
  strengthTags: ["边界清晰", "低压进入", "隐私优先"],
  growthTip: "先把环境安稳下来，再去追求更复杂的体验层次。",
  dimensionBreakdown: buildDimensionBreakdown(persona),
  hiddenRouteSummaryShort: `你的隐藏路线偏向${HIDDEN_ROUTE_LABELS[persona.hiddenRouteCode]}。`,
  hiddenRouteSummaryLong: `你不仅重视体验本身，也重视它如何被收纳、如何不打扰自己，以及在共居环境中是否足够安心。`,
  disguisePreference: "更偏好表面日常、存在感更低的外观。",
  storagePreference: "倾向优先选择易收纳、拿取成本更低的路线。",
  privacyNeedLevel: persona.hiddenPowerGrade === "S" ? "高" : persona.hiddenPowerGrade === "A" ? "中高" : "中",
  bestRouteSummary: "你长期更适合低存在感、节奏可控、易收纳的路线。",
  goodFits: ["优先看低存在感路线", "更适合节奏温和、可控的产品"],
  avoidNotes: ["暂不优先看高存在感路线", "暂不优先看噪音更明显的路线"],
  sceneMatches: ["同住环境", "夜间个人使用", "需要快速收纳的场景"],
  paceAdvice: ["先从低压进入", "先确认边界再逐步推进"],
  parameterFocus: ["优先看静音", "优先看收纳", "优先看清洁成本"],
  topCategoryMatches: [
    { id: "care_accessory", label: "低存在感路线", fitScore: 92, reason: "更符合你对边界与安心感的长期需求。" },
    { id: "external_vibe", label: "节奏温和路线", fitScore: 86, reason: "进入成本更低，更适合慢慢建立信任感。" },
  ],
  pickReasonSummary: "这些方向更贴近你长期对边界、安全感、存在感和收纳成本的综合要求。",
  mismatchWarnings: ["高存在感但难收纳的产品，短期可能新鲜，长期不一定适合你。"],
  productPicks: sorted.map((candidate) => ({
    ...candidate,
    reason: "它的存在感、噪音和收纳压力更符合你的人格路线。",
    categoryLabel: candidate.typeCode ?? "通用方向",
  })),
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
node --import tsx --test src/lib/body-persona-report.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/body-persona-report.ts src/lib/body-persona-report.test.ts
git commit -m "feat: expand body persona full report contract"
```

### Task 2: Expand backend report enhancement and route normalization

**Files:**
- Modify: `src/server/body-persona-report-service.ts`
- Modify: `src/server/body-persona-route.ts`
- Test: `src/server/body-persona-report-service.test.ts`
- Test: `src/server/body-persona-route.test.ts`

- [ ] **Step 1: Write failing tests for merge and unlock normalization**

Add this test to `src/server/body-persona-report-service.test.ts`:

```ts
test("enhanceUnlockedReport preserves deterministic report shape and merges richer fields", async () => {
  const service = createBodyPersonaReportService({
    appAiService: {
      async runServerAiProxy() {
        return {
          data: {
            portraitLong: "更完整的长版画像",
            personaManifesto: "你不是退缩，你只是更需要边界。",
            strengthTags: ["边界清晰", "低压进入", "隐私优先"],
            goodFits: ["优先看低存在感路线"],
            parameterFocus: ["优先看静音", "优先看收纳"],
          },
        };
      },
    },
  });

  const report = await service.enhanceUnlockedReport({
    freeSummary: {},
    baseReport: buildBodyPersonaFullReport({
      persona: demoPersona,
      candidatePool: [],
    }),
  });

  assert.equal(report.portraitLong, "更完整的长版画像");
  assert.equal(report.personaManifesto, "你不是退缩，你只是更需要边界。");
  assert.deepEqual(report.parameterFocus, ["优先看静音", "优先看收纳"]);
  assert.equal(report.hiddenRouteSummaryLong.length > 0, true);
});
```

Add this test to `src/server/body-persona-route.test.ts`:

```ts
test("confirm unlock returns expanded full report fields", async () => {
  const response = await handler(req, res);
  const report = response.body.report as Record<string, unknown>;

  assert.equal(typeof report.reportTitle, "string");
  assert.equal(typeof report.personaName, "string");
  assert.equal(Array.isArray(report.dimensionBreakdown), true);
  assert.equal(Array.isArray(report.topCategoryMatches), true);
  assert.equal(Array.isArray(report.parameterFocus), true);
});
```

- [ ] **Step 2: Run the backend tests to verify they fail**

Run:

```bash
node --import tsx --test src/server/body-persona-report-service.test.ts src/server/body-persona-route.test.ts
```

Expected: FAIL with missing report properties or unmerged field assertions.

- [ ] **Step 3: Expand AI enhancement typing and route normalization**

Update `src/server/body-persona-report-service.ts` to merge richer report fields:

```ts
type BodyPersonaAiEnhancement = {
  portraitLong?: string;
  personaManifesto?: string;
  whyYouAreThis?: string;
  strengthTags?: unknown;
  growthTip?: string;
  hiddenRouteSummaryLong?: string;
  goodFits?: unknown;
  avoidNotes?: unknown;
  sceneMatches?: unknown;
  paceAdvice?: unknown;
  parameterFocus?: unknown;
  pickReasonSummary?: string;
  mismatchWarnings?: unknown;
};
```

In the return object, merge each field conservatively:

```ts
return {
  ...input.baseReport,
  portraitLong: result.data.portraitLong || input.baseReport.portraitLong,
  personaManifesto:
    result.data.personaManifesto || input.baseReport.personaManifesto,
  whyYouAreThis: result.data.whyYouAreThis || input.baseReport.whyYouAreThis,
  strengthTags: normalizeReportStringArray(
    result.data.strengthTags,
    input.baseReport.strengthTags,
  ),
  growthTip: result.data.growthTip || input.baseReport.growthTip,
  hiddenRouteSummaryLong:
    result.data.hiddenRouteSummaryLong || input.baseReport.hiddenRouteSummaryLong,
  goodFits: normalizeReportStringArray(result.data.goodFits, input.baseReport.goodFits),
  avoidNotes: normalizeReportStringArray(result.data.avoidNotes, input.baseReport.avoidNotes),
  sceneMatches: normalizeReportStringArray(result.data.sceneMatches, input.baseReport.sceneMatches),
  paceAdvice: normalizeReportStringArray(result.data.paceAdvice, input.baseReport.paceAdvice),
  parameterFocus: normalizeReportStringArray(result.data.parameterFocus, input.baseReport.parameterFocus),
  pickReasonSummary:
    result.data.pickReasonSummary || input.baseReport.pickReasonSummary,
  mismatchWarnings: normalizeReportStringArray(
    result.data.mismatchWarnings,
    input.baseReport.mismatchWarnings,
  ),
};
```

Update `src/server/body-persona-route.ts` so `toBaseReport()` normalizes the expanded structure instead of only `title / portrait / hiddenRouteSummary / goodFits / avoidNotes / productPicks`.

- [ ] **Step 4: Run the backend tests to verify they pass**

Run:

```bash
node --import tsx --test src/server/body-persona-report-service.test.ts src/server/body-persona-route.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/body-persona-report-service.ts src/server/body-persona-report-service.test.ts src/server/body-persona-route.ts src/server/body-persona-route.test.ts
git commit -m "feat: normalize richer body persona report payloads"
```

### Task 3: Add login-before-unlock orchestration and richer API state

**Files:**
- Modify: `src/lib/body-persona-api.ts`
- Modify: `src/App.tsx`
- Test: `src/lib/body-persona-api.test.ts`
- Test: `src/pages/ResultsPage.test.tsx`

- [ ] **Step 1: Write failing tests for richer client typing and login-gated unlock copy**

Add this test to `src/lib/body-persona-api.test.ts`:

```ts
test("confirmBodyPersonaUnlock parses richer report payloads", async () => {
  const response = await confirmBodyPersonaUnlock({
    orderId: "order-1",
    fetcher: async () =>
      new Response(
        JSON.stringify({
          unlocked: true,
          report: {
            reportTitle: "完整档案",
            personaName: "隐私安全型",
            dimensionBreakdown: [],
            topCategoryMatches: [],
          },
        }),
      ),
  });

  assert.equal(response.unlocked, true);
  assert.equal((response.report as Record<string, unknown>).personaName, "隐私安全型");
});
```

Add this assertion to `src/pages/ResultsPage.test.tsx` against the free/unlocked body persona area:

```ts
assert.match(html, /登录后可解锁完整星系人格档案/);
assert.match(html, /登录并解锁完整档案|0.5 元解锁完整档案/);
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
node --import tsx --test src/lib/body-persona-api.test.ts src/pages/ResultsPage.test.tsx
```

Expected: FAIL because the new unlock copy and richer parsed fields do not exist yet.

- [ ] **Step 3: Implement login-before-unlock orchestration**

In `src/lib/body-persona-api.ts`, add richer report typing:

```ts
export type BodyPersonaUnlockApiResponse = {
  unlocked: boolean;
  order?: unknown;
  entitlement?: unknown;
  report: Record<string, unknown> & {
    reportTitle?: string;
    personaName?: string;
    personaSubtitle?: string;
    personaManifesto?: string;
    personaImageAsset?: string | null;
  };
};
```

In `src/App.tsx`, add state for the dialog and deferred unlock intent:

```ts
const [isBodyPersonaFullReportOpen, setIsBodyPersonaFullReportOpen] = useState(false);
const [shouldContinueBodyPersonaUnlockAfterAuth, setShouldContinueBodyPersonaUnlockAfterAuth] =
  useState(false);
```

Change `handleUnlockBodyPersona` so it gates on auth first:

```ts
const handleUnlockBodyPersona = async () => {
  if (!bodyPersonaState) return;

  if (!supabaseSession?.user?.id) {
    setShouldContinueBodyPersonaUnlockAfterAuth(true);
    setAuthStatusMessage("登录后可解锁完整星系人格档案");
    return;
  }

  // existing order + confirm logic stays here
};
```

After successful auth in the existing auth submit flow, continue the unlock once:

```ts
useEffect(() => {
  if (!supabaseSession?.user?.id || !shouldContinueBodyPersonaUnlockAfterAuth) {
    return;
  }

  setShouldContinueBodyPersonaUnlockAfterAuth(false);
  void handleUnlockBodyPersona();
}, [supabaseSession?.user?.id, shouldContinueBodyPersonaUnlockAfterAuth]);
```

After successful unlock, auto-open the full report dialog:

```ts
setBodyPersonaState((current) =>
  current
    ? {
        ...current,
        status: "unlocked",
        fullReport: unlocked.report,
      }
    : current,
);
setIsBodyPersonaFullReportOpen(true);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:

```bash
node --import tsx --test src/lib/body-persona-api.test.ts src/pages/ResultsPage.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/body-persona-api.ts src/lib/body-persona-api.test.ts src/App.tsx src/pages/ResultsPage.test.tsx
git commit -m "feat: gate body persona unlock behind auth"
```

### Task 4: Build the full report dialog and richer results presentation

**Files:**
- Create: `src/components/BodyPersonaFullReportDialog.tsx`
- Create: `src/components/BodyPersonaHeroCard.tsx`
- Create: `src/components/BodyPersonaDimensionGrid.tsx`
- Create: `src/components/BodyPersonaHiddenRouteCard.tsx`
- Create: `src/components/BodyPersonaRouteAdviceCard.tsx`
- Create: `src/components/BodyPersonaProductMatchesCard.tsx`
- Create: `src/components/BodyPersonaFullReportDialog.test.tsx`
- Modify: `src/components/BodyPersonaResultPanel.tsx`
- Modify: `src/pages/ResultsPage.tsx`

- [ ] **Step 1: Write the failing dialog rendering test**

Create `src/components/BodyPersonaFullReportDialog.test.tsx` with:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { BodyPersonaFullReportDialog } from "./BodyPersonaFullReportDialog.tsx";

test("BodyPersonaFullReportDialog renders hero, hidden route, and product matches", () => {
  const html = renderToStaticMarkup(
    <BodyPersonaFullReportDialog
      isOpen
      onClose={() => undefined}
      report={{
        reportTitle: "完整星系人格档案",
        personaName: "隐私安全型",
        personaSubtitle: "隐私安全型 · M104 草帽星系",
        personaManifesto: "你不是退缩，你只是更需要边界清晰的靠近方式。",
        personaImageAsset: null,
        primaryPersonaCode: "starlit_guard",
        secondaryPersonaCode: "soft_glow",
        secondaryPersonaName: "慢热探索型",
        hiddenRouteCode: "daily_object",
        hiddenRouteName: "日常器物型",
        hiddenPowerGrade: "S",
        coLivingComfortGrade: "high",
        portraitShort: "短描述",
        portraitLong: "长描述",
        whyYouAreThis: "形成原因",
        strengthTags: ["边界清晰"],
        growthTip: "成长建议",
        dimensionBreakdown: [
          { id: "privacy_need", label: "隐私需求", score: 95, summary: "很高" },
        ],
        hiddenRouteSummaryShort: "短隐藏路线",
        hiddenRouteSummaryLong: "长隐藏路线",
        disguisePreference: "更偏好伪装",
        storagePreference: "优先易收纳",
        privacyNeedLevel: "高",
        bestRouteSummary: "最适合路线",
        goodFits: ["低存在感路线"],
        avoidNotes: ["高存在感路线"],
        sceneMatches: ["同住环境"],
        paceAdvice: ["先低压进入"],
        parameterFocus: ["优先看静音"],
        topCategoryMatches: [
          { id: "external_vibe", label: "低存在感路线", fitScore: 92, reason: "更安心" },
        ],
        pickReasonSummary: "匹配原因总结",
        mismatchWarnings: ["别先看高噪音路线"],
        productPicks: [
          { id: "demo-1", name: "演示产品", score: 88, personaScore: 96, reason: "更适合你" },
        ],
      }}
    />,
  );

  assert.match(html, /完整星系人格档案/);
  assert.match(html, /隐私安全型 · M104 草帽星系/);
  assert.match(html, /日常器物型/);
  assert.match(html, /优先看静音/);
  assert.match(html, /演示产品/);
});
```

- [ ] **Step 2: Run the dialog test to verify it fails**

Run:

```bash
node --import tsx --test src/components/BodyPersonaFullReportDialog.test.tsx
```

Expected: FAIL because the component file does not exist yet.

- [ ] **Step 3: Implement the dialog and swap the result panel behavior**

Create `src/components/BodyPersonaFullReportDialog.tsx` with a portal-backed dialog shell:

```tsx
import { X, Sparkles } from "lucide-react";
import { createPortal } from "react-dom";

import type { BodyPersonaFullReport } from "../lib/body-persona-report.ts";
import { BodyPersonaHeroCard } from "./BodyPersonaHeroCard.tsx";
import { BodyPersonaDimensionGrid } from "./BodyPersonaDimensionGrid.tsx";
import { BodyPersonaHiddenRouteCard } from "./BodyPersonaHiddenRouteCard.tsx";
import { BodyPersonaRouteAdviceCard } from "./BodyPersonaRouteAdviceCard.tsx";
import { BodyPersonaProductMatchesCard } from "./BodyPersonaProductMatchesCard.tsx";

export function BodyPersonaFullReportDialog({
  isOpen,
  report,
  onClose,
}: {
  isOpen: boolean;
  report: BodyPersonaFullReport | null;
  onClose: () => void;
}) {
  if (!isOpen || !report) return null;

  const content = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950 px-3 py-2 sm:px-4 sm:py-2">
      <div className="relative flex h-[calc(100dvh-1rem)] w-full max-w-5xl flex-col overflow-hidden rounded-[1.5rem] border border-cyan-100/14 bg-slate-950 shadow-[0_24px_90px_rgba(8,47,73,0.34)]">
        <div className="shrink-0 border-b border-cyan-100/10 px-4 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] tracking-[0.24em] text-cyan-200/60">完整星系人格档案</p>
              <h2 className="mt-2 text-xl font-medium text-white">{report.reportTitle}</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.035] text-slate-300"
              aria-label="关闭完整星系人格档案"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          <div className="space-y-4">
            <BodyPersonaHeroCard report={report} />
            <BodyPersonaDimensionGrid report={report} />
            <BodyPersonaHiddenRouteCard report={report} />
            <BodyPersonaRouteAdviceCard report={report} />
            <BodyPersonaProductMatchesCard report={report} />
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document === "undefined" ? content : createPortal(content, document.body);
}
```

Shrink `src/components/BodyPersonaResultPanel.tsx` so it focuses on:

- free summary portrait
- unlock CTA copy
- `再次查看完整档案` button when unlocked

Wire `src/pages/ResultsPage.tsx` to render the new dialog with:

```tsx
<BodyPersonaFullReportDialog
  isOpen={isBodyPersonaFullReportOpen}
  report={normalizedFullReport}
  onClose={onCloseBodyPersonaFullReport ?? (() => undefined)}
/>
```

- [ ] **Step 4: Run the dialog and page tests to verify they pass**

Run:

```bash
node --import tsx --test src/components/BodyPersonaFullReportDialog.test.tsx src/pages/ResultsPage.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/BodyPersonaFullReportDialog.tsx src/components/BodyPersonaHeroCard.tsx src/components/BodyPersonaDimensionGrid.tsx src/components/BodyPersonaHiddenRouteCard.tsx src/components/BodyPersonaRouteAdviceCard.tsx src/components/BodyPersonaProductMatchesCard.tsx src/components/BodyPersonaFullReportDialog.test.tsx src/components/BodyPersonaResultPanel.tsx src/pages/ResultsPage.tsx src/pages/ResultsPage.test.tsx
git commit -m "feat: add body persona full report dialog"
```

### Task 5: Polish unlock messaging, placeholder artwork, and reopen flow

**Files:**
- Modify: `src/components/BodyPersonaResultPanel.tsx`
- Modify: `src/pages/ResultsPage.tsx`
- Test: `src/pages/ResultsPage.test.tsx`

- [ ] **Step 1: Write the failing unlock-copy test**

Add this assertion to `src/pages/ResultsPage.test.tsx`:

```ts
assert.match(html, /完整星系人格档案已锁定/);
assert.match(html, /0.5 元一次解锁，可随时回看/);
assert.match(html, /再次查看完整档案/);
```

- [ ] **Step 2: Run the page test to verify it fails**

Run:

```bash
node --import tsx --test src/pages/ResultsPage.test.tsx
```

Expected: FAIL because the new paid-value copy and reopen label are not both present yet.

- [ ] **Step 3: Implement the final copy and placeholder treatment**

In `src/components/BodyPersonaResultPanel.tsx`, update the locked-state copy to:

```tsx
<div className="flex items-center gap-2 text-cyan-100/84">
  <LockKeyhole className="h-3.5 w-3.5" />
  <p className="text-[11px] tracking-wide">完整星系人格档案已锁定</p>
</div>
<p className="mt-2 text-[13px] leading-6 text-slate-300">
  登录后可解锁你的主人格画像、隐藏路线、副人格倾向，以及长期更适合的体验路线与产品方向。
</p>
<p className="mt-2 text-[12px] leading-5 text-cyan-100/70">
  0.5 元一次解锁，可随时回看。
</p>
```

When unlocked, show a reopen button:

```tsx
<button
  type="button"
  onClick={() => void onOpenFullReport?.()}
  className="mt-4 inline-flex items-center justify-center rounded-full border border-cyan-300/22 bg-cyan-300/12 px-4 py-2 text-sm text-cyan-50"
>
  再次查看完整档案
</button>
```

In the hero card placeholder area, make missing artwork still feel intentional:

```tsx
<div className="relative min-h-56 overflow-hidden rounded-3xl border border-cyan-300/14 bg-[radial-gradient(circle_at_50%_20%,rgba(34,211,238,0.12),transparent_42%),linear-gradient(180deg,rgba(10,18,35,0.96),rgba(5,10,24,0.98))]">
  <div className="absolute inset-0 opacity-60 [background-image:linear-gradient(rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.06)_1px,transparent_1px)] [background-size:2.5rem_2.5rem]" />
  <div className="relative z-10 flex h-full min-h-56 items-center justify-center px-6 py-8">
    <div className="max-w-sm text-center">
      <p className="text-sm text-cyan-100/90">{report.personaName}</p>
      <p className="mt-2 text-[13px] leading-6 text-slate-300">星系人格画像素材稍后补上，当前先展示完整人格档案与长期路线建议。</p>
    </div>
  </div>
</div>
```

- [ ] **Step 4: Run the page test to verify it passes**

Run:

```bash
node --import tsx --test src/pages/ResultsPage.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/BodyPersonaResultPanel.tsx src/pages/ResultsPage.tsx src/pages/ResultsPage.test.tsx
git commit -m "feat: polish body persona unlock messaging"
```

## Self-Review

### Spec coverage

- `登录后解锁` is covered in Task 3.
- `支付成功后自动弹出完整人格弹窗` is covered in Task 3 and Task 4.
- `完整星系人格档案` richer schema is covered in Task 1 and Task 2.
- `画像优先、选品决策一起装进去` is covered in Task 4 and Task 5.
- `结果页再次查看完整档案入口` is covered in Task 4 and Task 5.

No uncovered requirements remain from `docs/superpowers/specs/2026-05-14-body-persona-full-report-design.md`.

### Placeholder scan

- No `TODO`, `TBD`, or “similar to previous task” placeholders remain.
- Every task includes exact files, test commands, and concrete code blocks.

### Type consistency

- `BodyPersonaFullReport` field names match across the plan: `reportTitle`, `personaName`, `personaSubtitle`, `personaManifesto`, `dimensionBreakdown`, `topCategoryMatches`, `pickReasonSummary`, `productPicks`.
- `isBodyPersonaFullReportOpen` is used consistently as the dialog open state.
- `shouldContinueBodyPersonaUnlockAfterAuth` is used consistently as the deferred unlock flag.
