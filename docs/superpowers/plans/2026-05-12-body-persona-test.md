# Body Persona Test Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a paid `身体人格测试 + 隐藏偏好识别` flow on the results page, including deterministic scoring, free and unlocked reports, order/entitlement persistence, and archive linkage.

**Architecture:** Keep the persona engine deterministic and testable in shared frontend/server-safe TypeScript helpers, then persist sessions and unlock state through the existing Express + `pg` route/store pattern already used for recommendation sessions and feedback. On the UI side, keep the new experience attached to the existing results page so the unlock card, quiz, free summary, and full report all reuse current answer state, recommendation candidates, and login/archive flows.

**Tech Stack:** React 19, TypeScript, Express, PostgreSQL, `pg`, Node test runner, `tsx`, Tailwind CSS, Lucide React

---

### File Map

**Create:**
- `src/lib/body-persona.ts` — persona codes, hidden-route codes, quiz questions, scoring helpers, free-summary builder
- `src/lib/body-persona.test.ts` — deterministic scoring and free-summary coverage
- `src/lib/body-persona-report.ts` — full-report builder, hidden-route explanation helpers, persona candidate reranking
- `src/lib/body-persona-report.test.ts` — unlocked report and rerank coverage
- `src/lib/body-persona-api.ts` — browser helpers for session create, session read, order create, unlock confirm, unlock status
- `src/lib/body-persona-api.test.ts` — fetch payload and error handling coverage
- `src/server/body-persona-store.ts` — schema ensure + CRUD for sessions, orders, entitlements
- `src/server/body-persona-store.test.ts` — schema and persistence coverage
- `src/server/body-persona-report-service.ts` — optional AI enhancement wrapper with deterministic fallback
- `src/server/body-persona-report-service.test.ts` — fallback and AI response normalization coverage
- `src/server/body-persona-route.ts` — Express handlers for sessions, orders, confirm, unlock status
- `src/server/body-persona-route.test.ts` — route validation and state-transition coverage
- `src/components/BodyPersonaUnlockCard.tsx` — results-page teaser card for the feature
- `src/components/BodyPersonaUnlockCard.test.tsx` — unlock-card rendering and CTA coverage
- `src/components/BodyPersonaQuizDialog.tsx` — lightweight 6-8 question modal/dialog flow
- `src/components/BodyPersonaQuizDialog.test.tsx` — quiz stepping and completion coverage
- `src/components/BodyPersonaResultPanel.tsx` — free summary + unlocked report renderer
- `src/components/BodyPersonaResultPanel.test.tsx` — free vs unlocked display coverage

**Modify:**
- `src/server/app.ts` — register persona routes and ensure schema initialization
- `src/pages/ResultsPage.tsx` — mount unlock card, quiz dialog, result panel, unlock CTA, loading states
- `src/pages/ResultsPage.test.tsx` — cover new results-page sections and interaction points
- `src/App.tsx` — own persona state, call API helpers, coordinate quiz submission, unlock flow, archive payload inclusion
- `src/lib/user-recommendation-profile.ts` — add optional persona snapshot into saved profile payload
- `src/lib/user-recommendation-profile.test.ts` — verify payload carries persona snapshot when present
- `src/pages/ProfilesPage.tsx` — surface saved persona title/summary in archive view
- `src/pages/ProfilesPage.test.tsx` — cover archive rendering with persona snapshot

### Task 1: Add the deterministic persona engine

**Files:**
- Create: `src/lib/body-persona.ts`
- Create: `src/lib/body-persona.test.ts`
- Test: `src/lib/body-persona.test.ts`

- [ ] **Step 1: Write the failing scoring tests**

```ts
import assert from "node:assert/strict";
import test from "node:test";

import {
  BODY_PERSONA_QUESTIONS,
  resolveBodyPersonaResult,
} from "./body-persona.ts";

test("BODY_PERSONA_QUESTIONS exposes a compact six-dimension quiz", () => {
  assert.equal(BODY_PERSONA_QUESTIONS.length >= 6, true);
  assert.equal(BODY_PERSONA_QUESTIONS.every((question) => question.options.length >= 3), true);
});

test("resolveBodyPersonaResult returns a stable free summary for slow, private answers", () => {
  const result = resolveBodyPersonaResult({
    answers: {
      safety_need: "high",
      privacy_need: "high",
      pace_preference: "slow",
      sensory_preference: "layered",
      control_preference: "manual",
      relationship_preference: "solo",
    },
  });

  assert.equal(result.primaryPersonaCode, "starlit_guard");
  assert.equal(result.hiddenRouteCode, "daily_object");
  assert.equal(result.hiddenPowerGrade, "S");
  assert.match(result.freeSummary.title, /星幕型|隐秘安全感者/);
  assert.match(result.freeSummary.why, /隐私|慢热|安全感/);
});

test("resolveBodyPersonaResult returns a fast-start profile for direct answers", () => {
  const result = resolveBodyPersonaResult({
    answers: {
      safety_need: "low",
      privacy_need: "medium",
      pace_preference: "fast",
      sensory_preference: "direct",
      control_preference: "hybrid",
      relationship_preference: "solo",
    },
  });

  assert.equal(result.primaryPersonaCode, "comet_spark");
  assert.equal(result.hiddenPowerGrade === "S", false);
  assert.match(result.freeSummary.title, /彗火型|即时点燃者/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test src/lib/body-persona.test.ts`
Expected: FAIL because `src/lib/body-persona.ts` does not exist yet

- [ ] **Step 3: Implement the shared persona metadata and scoring helper**

```ts
const PERSONA_TITLES = {
  soft_glow: "微光型·慢热探索者",
  starlit_guard: "星幕型·隐秘安全感者",
  tidal_sync: "潮汐型·感官共振者",
  comet_spark: "彗火型·即时点燃者",
  ring_control: "星环型·节奏掌控者",
  twin_orbit: "双轨型·关系联动者",
} as const;

export const BODY_PERSONA_QUESTIONS = [
  {
    id: "safety_need",
    title: "刚进入体验前，你更在意什么？",
    options: [
      { value: "high", label: "先让我安心，再慢慢进入", weights: { starlit_guard: 3, soft_glow: 2 } },
      { value: "medium", label: "有点铺垫最好，但不用太久", weights: { tidal_sync: 2, ring_control: 2 } },
      { value: "low", label: "我更想快速进入状态", weights: { comet_spark: 3 } },
    ],
  },
  {
    id: "privacy_need",
    title: "对收纳和被看见这件事，你更像哪种？",
    options: [
      { value: "high", label: "最好低调到一眼看不出来", weights: { starlit_guard: 3 }, hidden: { route: "daily_object", power: 2 } },
      { value: "medium", label: "别太高调，顺手收起来就好", weights: { soft_glow: 1, ring_control: 1 }, hidden: { route: "pocket_ready", power: 1 } },
      { value: "low", label: "只要体验对，外观不是第一位", weights: { comet_spark: 1, tidal_sync: 1 } },
    ],
  },
  {
    id: "pace_preference",
    title: "更接近你的进入节奏的是？",
    options: [
      { value: "slow", label: "慢慢升温比较舒服", weights: { soft_glow: 3, starlit_guard: 2 } },
      { value: "balanced", label: "有铺垫，但不用太长", weights: { tidal_sync: 2, ring_control: 2 } },
      { value: "fast", label: "希望更快进入状态", weights: { comet_spark: 3 } },
    ],
  },
  {
    id: "sensory_preference",
    title: "你更喜欢哪种反馈风格？",
    options: [
      { value: "layered", label: "细腻、有层次、慢慢叠上来", weights: { tidal_sync: 3, soft_glow: 1 } },
      { value: "balanced", label: "均衡、稳定、有变化", weights: { ring_control: 2, twin_orbit: 1 } },
      { value: "direct", label: "直接、明确、别绕太久", weights: { comet_spark: 3 } },
    ],
  },
  {
    id: "control_preference",
    title: "你更喜欢怎样掌握过程？",
    options: [
      { value: "manual", label: "我想自己掌控节奏和切换", weights: { ring_control: 3, starlit_guard: 1 } },
      { value: "hybrid", label: "我想掌控大方向，细节交给产品也行", weights: { tidal_sync: 2, twin_orbit: 1 } },
      { value: "guided", label: "只要路线对，顺着走就好", weights: { comet_spark: 1, soft_glow: 1 } },
    ],
  },
  {
    id: "relationship_preference",
    title: "你更在意哪种使用氛围？",
    options: [
      { value: "solo", label: "我更偏单人、自我探索", weights: { soft_glow: 2, starlit_guard: 1 } },
      { value: "balanced", label: "单人和互动都可以", weights: { tidal_sync: 2, ring_control: 1 } },
      { value: "paired", label: "我更在意陪伴、同步和互动感", weights: { twin_orbit: 3 } },
    ],
  },
] as const;

export function resolveBodyPersonaResult({ answers }: { answers: Record<string, string> }) {
  const personaScores = {
    soft_glow: 0,
    starlit_guard: 0,
    tidal_sync: 0,
    comet_spark: 0,
    ring_control: 0,
    twin_orbit: 0,
  };

  let hiddenRouteScore = {
    zero_profile: 0,
    daily_object: 0,
    beauty_disguise: 0,
    pocket_ready: 0,
  };

  let hiddenPower = 0;

  for (const question of BODY_PERSONA_QUESTIONS) {
    const selected = question.options.find((option) => option.value === answers[question.id]);
    if (!selected) continue;
    for (const [code, score] of Object.entries(selected.weights)) {
      personaScores[code as keyof typeof personaScores] += score;
    }
    if (selected.hidden?.route) {
      hiddenRouteScore[selected.hidden.route as keyof typeof hiddenRouteScore] += selected.hidden.power;
      hiddenPower += selected.hidden.power;
    }
  }

  const rankedPersonas = Object.entries(personaScores).sort((a, b) => b[1] - a[1]);
  const primaryPersonaCode = rankedPersonas[0]?.[0] ?? "soft_glow";
  const secondaryPersonaCode = rankedPersonas[1]?.[0] ?? null;
  const hiddenRouteCode = Object.entries(hiddenRouteScore).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "pocket_ready";
  const hiddenPowerGrade = hiddenPower >= 5 ? "S" : hiddenPower >= 3 ? "A" : "B";
  const title = PERSONA_TITLES[primaryPersonaCode as keyof typeof PERSONA_TITLES] ?? PERSONA_TITLES.soft_glow;

  return {
    primaryPersonaCode,
    secondaryPersonaCode,
    hiddenRouteCode,
    hiddenPowerGrade,
    coLivingComfortGrade: hiddenPower >= 5 ? "high" : hiddenPower >= 3 ? "medium" : "low",
    freeSummary: {
      title,
      blurb:
        primaryPersonaCode === "starlit_guard"
          ? "你更在意低压力进入、隐私边界和不打扰自己的节奏。"
          : primaryPersonaCode === "comet_spark"
            ? "你更偏向反馈明确、进入更快、体验目标更清晰的路线。"
            : "你更适合先建立自己的节奏，再向更贴合的体验路线推进。",
      why:
        primaryPersonaCode === "starlit_guard"
          ? "你在隐私需求、慢热节奏和安全感维度得分更高。"
          : primaryPersonaCode === "comet_spark"
            ? "你在启动速度、直接反馈和低铺垫倾向上得分更高。"
            : "你的答案在节奏、层次和掌控感之间形成了稳定偏好。",
      hints: primaryPersonaCode === "starlit_guard"
        ? ["先看低存在感路线", "优先节奏温和、易收纳的产品"]
        : primaryPersonaCode === "comet_spark"
          ? ["优先看反馈直接路线", "更适合启动更快的产品"]
          : ["先看与你当前场景不冲突的路线", "把节奏匹配放在参数前面"],
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --import tsx --test src/lib/body-persona.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/body-persona.ts src/lib/body-persona.test.ts
git commit -m "feat: add body persona scoring engine"
```

### Task 2: Add unlocked-report and persona rerank helpers

**Files:**
- Create: `src/lib/body-persona-report.ts`
- Create: `src/lib/body-persona-report.test.ts`
- Test: `src/lib/body-persona-report.test.ts`

- [ ] **Step 1: Write the failing unlocked-report tests**

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { buildBodyPersonaFullReport } from "./body-persona-report.ts";

test("buildBodyPersonaFullReport promotes aligned low-profile products", () => {
  const report = buildBodyPersonaFullReport({
    persona: {
      primaryPersonaCode: "starlit_guard",
      hiddenRouteCode: "daily_object",
      hiddenPowerGrade: "S",
      coLivingComfortGrade: "high",
      freeSummary: {
        title: "星幕型·隐秘安全感者",
        blurb: "你更在意低压力进入。",
        why: "你在隐私与慢热维度更高。",
        hints: ["优先看低存在感路线"],
      },
    },
    candidatePool: [
      { id: "quiet-1", name: "Quiet Rose", score: 88, tags: ["高伪装", "静音"], typeCode: "external_vibe", appearance: "high_disguise", maxDb: 40 },
      { id: "loud-1", name: "Loud Wand", score: 92, tags: ["强刺激"], typeCode: "external_vibe", appearance: "normal", maxDb: 58 },
    ],
  });

  assert.equal(report.productPicks[0]?.id, "quiet-1");
  assert.match(report.hiddenRouteSummary, /日常器物型|隐藏力 S/);
  assert.equal(report.productPicks.length <= 5, true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test src/lib/body-persona-report.test.ts`
Expected: FAIL because `src/lib/body-persona-report.ts` does not exist yet

- [ ] **Step 3: Implement deterministic full-report generation**

```ts
function scorePersonaCandidate(personaCode: string, candidate: {
  appearance?: string | null;
  maxDb?: number | null;
  tags?: string[] | null;
  score: number;
}) {
  let boost = 0;

  if (personaCode === "starlit_guard") {
    if (candidate.appearance === "high_disguise") boost += 8;
    if ((candidate.maxDb ?? 99) <= 45) boost += 6;
    if ((candidate.tags ?? []).some((tag) => /伪装|静音|隐蔽/.test(tag))) boost += 6;
  }

  if (personaCode === "comet_spark") {
    if ((candidate.tags ?? []).some((tag) => /强刺激|直给|高能/.test(tag))) boost += 6;
  }

  return candidate.score + boost;
}

export function buildBodyPersonaFullReport({
  persona,
  candidatePool,
}: {
  persona: {
    primaryPersonaCode: string;
    hiddenRouteCode: string;
    hiddenPowerGrade: string;
    coLivingComfortGrade: string;
    freeSummary: {
      title: string;
      blurb: string;
      why: string;
      hints: string[];
    };
  };
  candidatePool: Array<{
    id: string;
    name: string;
    score: number;
    tags?: string[];
    typeCode?: string | null;
    appearance?: string | null;
    maxDb?: number | null;
  }>;
}) {
  const sorted = [...candidatePool]
    .map((candidate) => ({
      ...candidate,
      personaScore: scorePersonaCandidate(persona.primaryPersonaCode, candidate),
    }))
    .sort((a, b) => b.personaScore - a.personaScore)
    .slice(0, 5);

  return {
    title: persona.freeSummary.title,
    portrait: `${persona.freeSummary.blurb} 这意味着你更适合低压力但有边界感的体验路线。`,
    hiddenRouteSummary: `你的隐藏路线偏向${persona.hiddenRouteCode === "daily_object" ? "日常器物型" : "口袋随身型"}，隐藏力 ${persona.hiddenPowerGrade}，共居安心度 ${persona.coLivingComfortGrade === "high" ? "高" : "中" }。`,
    goodFits: ["更适合低存在感、易收纳、节奏可控的路线"],
    avoidNotes: ["暂不优先看高存在感、噪音更明显的路线"],
    productPicks: sorted,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --import tsx --test src/lib/body-persona-report.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/body-persona-report.ts src/lib/body-persona-report.test.ts
git commit -m "feat: add body persona full report builder"
```

### Task 3: Add server schema, order state, and unlock routes

**Files:**
- Create: `src/server/body-persona-store.ts`
- Create: `src/server/body-persona-store.test.ts`
- Create: `src/server/body-persona-report-service.ts`
- Create: `src/server/body-persona-report-service.test.ts`
- Create: `src/server/body-persona-route.ts`
- Create: `src/server/body-persona-route.test.ts`
- Modify: `src/server/app.ts`

- [ ] **Step 1: Write the failing store and route tests**

```ts
test("ensureBodyPersonaSchema creates session, order, and entitlement tables", async () => {
  const queries: string[] = [];
  const pool = {
    async query(sql: string) {
      queries.push(sql);
      return { rows: [] };
    },
  };

  await ensureBodyPersonaSchema(pool);

  const combinedSql = queries.join("\n");
  assert.match(combinedSql, /CREATE TABLE IF NOT EXISTS public\.body_persona_sessions/);
  assert.match(combinedSql, /CREATE TABLE IF NOT EXISTS public\.body_persona_unlock_orders/);
  assert.match(combinedSql, /CREATE TABLE IF NOT EXISTS public\.body_persona_unlock_entitlements/);
});

test("confirm unlock handler creates entitlement and returns unlocked report", async () => {
  const handler = createConfirmBodyPersonaUnlockHandler({
    store: {
      markOrderPaid: async () => ({ id: "order-1", personaSessionId: "session-1" }),
      createEntitlement: async () => ({ id: "ent-1" }),
      getSessionById: async () => ({ id: "session-1", fullReport: { title: "星幕型·隐秘安全感者" } }),
      saveFullReport: async () => undefined,
    },
    reportService: {
      enhanceUnlockedReport: async () => ({ title: "星幕型·隐秘安全感者" }),
    },
  });

  const response = createMockResponse();
  await handler(
    createMockRequest({
      params: { id: "order-1" },
      body: { confirmationToken: "dev-confirm" },
    }),
    response.response,
  );

  assert.equal(response.readStatusCode(), 200);
  assert.match(JSON.stringify(response.readJsonPayload()), /星幕型/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --import tsx --test src/server/body-persona-store.test.ts src/server/body-persona-report-service.test.ts src/server/body-persona-route.test.ts`
Expected: FAIL because the store, service, and route files do not exist yet

- [ ] **Step 3: Implement schema ensure and CRUD store**

```ts
export async function ensureBodyPersonaSchema(pool: Queryable) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.body_persona_sessions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      recommendation_session_id text,
      user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
      source_page_route text NOT NULL DEFAULT '/results',
      question_version text NOT NULL,
      scoring_version text NOT NULL,
      answers jsonb NOT NULL DEFAULT '{}'::jsonb,
      answer_path jsonb NOT NULL DEFAULT '[]'::jsonb,
      dimension_scores jsonb NOT NULL DEFAULT '{}'::jsonb,
      primary_persona_code text NOT NULL,
      secondary_persona_code text,
      hidden_route_code text,
      hidden_power_grade text,
      co_living_comfort_grade text,
      free_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
      full_report jsonb,
      status text NOT NULL DEFAULT 'completed_free',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.body_persona_unlock_orders (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      persona_session_id uuid NOT NULL REFERENCES public.body_persona_sessions(id) ON DELETE CASCADE,
      user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
      amount_cent integer NOT NULL DEFAULT 50,
      currency text NOT NULL DEFAULT 'CNY',
      channel text,
      merchant_order_no text UNIQUE,
      payment_provider text,
      status text NOT NULL DEFAULT 'pending',
      paid_at timestamptz,
      expired_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.body_persona_unlock_entitlements (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      persona_session_id uuid NOT NULL UNIQUE REFERENCES public.body_persona_sessions(id) ON DELETE CASCADE,
      order_id uuid REFERENCES public.body_persona_unlock_orders(id) ON DELETE SET NULL,
      user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
      unlocked_scope text NOT NULL DEFAULT 'full_report',
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}
```

- [ ] **Step 4: Implement the report service with deterministic fallback**

```ts
export function createBodyPersonaReportService({
  appAiService,
}: {
  appAiService: {
    runServerAiProxy: <T>(input: {
      prompt: string;
      temperature: number;
      emptyJson: string;
      logContext: string;
      maxTokens: number;
      providerTimeoutMs?: number;
    }) => Promise<{ data: T }>;
  };
}) {
  return {
    async enhanceUnlockedReport(input: {
      freeSummary: unknown;
      baseReport: ReturnType<typeof buildBodyPersonaFullReport>;
    }) {
      try {
        const result = await appAiService.runServerAiProxy<{
          portrait?: string;
          goodFits?: string[];
          avoidNotes?: string[];
        }>({
          prompt: `请基于以下结构化人格结果，润色中文，不改变结论：${JSON.stringify(input)}`,
          temperature: 0.1,
          emptyJson: "{}",
          logContext: "身体人格报告润色",
          maxTokens: 800,
        });

        return {
          ...input.baseReport,
          portrait: result.data.portrait || input.baseReport.portrait,
          goodFits: result.data.goodFits?.length ? result.data.goodFits : input.baseReport.goodFits,
          avoidNotes: result.data.avoidNotes?.length ? result.data.avoidNotes : input.baseReport.avoidNotes,
        };
      } catch {
        return input.baseReport;
      }
    },
  };
}
```

- [ ] **Step 5: Implement routes and mount them in `src/server/app.ts`**

```ts
app.post(
  "/api/body-persona/sessions",
  withLazyRouteHandler(ensureBodyPersonaRouteReady, getCreateBodyPersonaSessionHandler),
);

app.get(
  "/api/body-persona/sessions/:id",
  withLazyRouteHandler(ensureBodyPersonaRouteReady, getGetBodyPersonaSessionHandler),
);

app.post(
  "/api/body-persona/orders",
  withLazyRouteHandler(ensureBodyPersonaRouteReady, getCreateBodyPersonaOrderHandler),
);

app.post(
  "/api/body-persona/orders/:id/confirm",
  withLazyRouteHandler(ensureBodyPersonaRouteReady, getConfirmBodyPersonaUnlockHandler),
);

app.get(
  "/api/body-persona/sessions/:id/unlock-status",
  withLazyRouteHandler(ensureBodyPersonaRouteReady, getBodyPersonaUnlockStatusHandler),
);
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `node --import tsx --test src/server/body-persona-store.test.ts src/server/body-persona-report-service.test.ts src/server/body-persona-route.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/server/body-persona-store.ts src/server/body-persona-store.test.ts src/server/body-persona-report-service.ts src/server/body-persona-report-service.test.ts src/server/body-persona-route.ts src/server/body-persona-route.test.ts src/server/app.ts
git commit -m "feat: add body persona session and unlock routes"
```

### Task 4: Add client API helpers and recommendation-profile payload support

**Files:**
- Create: `src/lib/body-persona-api.ts`
- Create: `src/lib/body-persona-api.test.ts`
- Modify: `src/lib/user-recommendation-profile.ts`
- Modify: `src/lib/user-recommendation-profile.test.ts`

- [ ] **Step 1: Write the failing client-helper tests**

```ts
import assert from "node:assert/strict";
import test from "node:test";

import {
  createBodyPersonaSession,
  createBodyPersonaOrder,
  confirmBodyPersonaUnlock,
} from "./body-persona-api.ts";

test("createBodyPersonaSession posts the free result payload", async () => {
  let captured: { url: string; body: string } | null = null;
  const fetcher = async (url: string, init?: RequestInit) => {
    captured = { url, body: String(init?.body ?? "") };
    return new Response(JSON.stringify({ id: "persona-session-1" }), { status: 201 });
  };

  const result = await createBodyPersonaSession({
    payload: {
      recommendationSessionId: "rec-1",
      questionVersion: "body-persona-v1",
      scoringVersion: "body-persona-score-v1",
      answers: { safety_need: "high" },
      answerPath: [],
      candidatePool: [],
    },
    fetcher,
  });

  assert.equal(result.id, "persona-session-1");
  assert.equal(captured?.url, "/api/body-persona/sessions");
  assert.match(captured?.body ?? "", /body-persona-v1/);
});

test("createBodyPersonaOrder posts the 0.5 yuan unlock order", async () => {
  let captured: { url: string; body: string } | null = null;
  const fetcher = async (url: string, init?: RequestInit) => {
    captured = { url, body: String(init?.body ?? "") };
    return new Response(JSON.stringify({ id: "order-1" }), { status: 201 });
  };

  const result = await createBodyPersonaOrder({
    sessionId: "persona-session-1",
    amountCent: 50,
    fetcher,
  });

  assert.equal(result.id, "order-1");
  assert.equal(captured?.url, "/api/body-persona/orders");
  assert.match(captured?.body ?? "", /50/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --import tsx --test src/lib/body-persona-api.test.ts src/lib/user-recommendation-profile.test.ts`
Expected: FAIL because the API helper file does not exist and profile payload has no persona field yet

- [ ] **Step 3: Implement the browser API helpers**

```ts
export async function createBodyPersonaSession({
  payload,
  fetcher = fetch,
}: {
  payload: Record<string, unknown>;
  fetcher?: typeof fetch;
}) {
  const response = await fetcher("/api/body-persona/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("创建身体人格测试失败");
  }

  return (await response.json()) as { id: string };
}

export async function createBodyPersonaOrder({
  sessionId,
  amountCent,
  fetcher = fetch,
}: {
  sessionId: string;
  amountCent: number;
  fetcher?: typeof fetch;
}) {
  const response = await fetcher("/api/body-persona/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, amountCent }),
  });

  if (!response.ok) {
    throw new Error("创建身体人格解锁订单失败");
  }

  return (await response.json()) as { id: string };
}

export async function confirmBodyPersonaUnlock({
  orderId,
  confirmationToken = "dev-confirm",
  fetcher = fetch,
}: {
  orderId: string;
  confirmationToken?: string;
  fetcher?: typeof fetch;
}) {
  const response = await fetcher(`/api/body-persona/orders/${orderId}/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirmationToken }),
  });

  if (!response.ok) {
    throw new Error("解锁身体人格报告失败");
  }

  return (await response.json()) as {
    sessionId: string;
    fullReport: Record<string, unknown>;
  };
}
```

- [ ] **Step 4: Extend recommendation-profile payload with persona snapshot**

```ts
export type RecommendationProfilePayload = {
  createdAt: string;
  title: string;
  summary: string;
  topProductIds: string[];
  answers: AnswerState;
  topProducts: RecommendationProfileProduct[];
  backupProducts: RecommendationProfileProduct[];
  recommendationTips: string[];
  shoppingGuidance: string[];
  bodyPersona?: {
    sessionId: string;
    title: string;
    hiddenRouteSummary: string;
    unlocked: boolean;
  };
};
```

And update the builder call shape:

```ts
export function buildRecommendationProfilePayload({
  answers,
  topProducts,
  backupProducts,
  recommendationTips,
  shoppingGuidance,
  bodyPersona,
}: {
  answers: AnswerState;
  topProducts: RankedProduct[];
  backupProducts: BackupCandidate[];
  recommendationTips: string[];
  shoppingGuidance: string[];
  bodyPersona?: RecommendationProfilePayload["bodyPersona"];
}): RecommendationProfilePayload {
  // keep existing logic, then return bodyPersona when provided
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --import tsx --test src/lib/body-persona-api.test.ts src/lib/user-recommendation-profile.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/body-persona-api.ts src/lib/body-persona-api.test.ts src/lib/user-recommendation-profile.ts src/lib/user-recommendation-profile.test.ts
git commit -m "feat: add body persona client helpers"
```

### Task 5: Add the results-page unlock card, quiz dialog, and result panel

**Files:**
- Create: `src/components/BodyPersonaUnlockCard.tsx`
- Create: `src/components/BodyPersonaUnlockCard.test.tsx`
- Create: `src/components/BodyPersonaQuizDialog.tsx`
- Create: `src/components/BodyPersonaQuizDialog.test.tsx`
- Create: `src/components/BodyPersonaResultPanel.tsx`
- Create: `src/components/BodyPersonaResultPanel.test.tsx`
- Modify: `src/pages/ResultsPage.tsx`
- Modify: `src/pages/ResultsPage.test.tsx`

- [ ] **Step 1: Write the failing component tests**

```tsx
test("BodyPersonaUnlockCard renders the 0.5 yuan CTA", () => {
  const html = renderToStaticMarkup(
    <BodyPersonaUnlockCard
      onStart={() => undefined}
      isBusy={false}
      freeSummary={null}
    />,
  );

  assert.match(html, /身体人格测试/);
  assert.match(html, /0\.5 元/);
});

test("BodyPersonaResultPanel shows free summary before unlock", () => {
  const html = renderToStaticMarkup(
    <BodyPersonaResultPanel
      status="completed_free"
      freeSummary={{
        title: "星幕型·隐秘安全感者",
        blurb: "你更在意低压力进入。",
        why: "你在隐私与慢热维度更高。",
        hints: ["优先低存在感路线"],
      }}
      fullReport={null}
      onUnlock={() => undefined}
      isUnlocking={false}
    />,
  );

  assert.match(html, /星幕型·隐秘安全感者/);
  assert.match(html, /解锁完整身体人格报告/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --import tsx --test src/components/BodyPersonaUnlockCard.test.tsx src/components/BodyPersonaQuizDialog.test.tsx src/components/BodyPersonaResultPanel.test.tsx src/pages/ResultsPage.test.tsx`
Expected: FAIL because the components and page hooks do not exist yet

- [ ] **Step 3: Implement the three focused UI components**

```tsx
export function BodyPersonaUnlockCard({
  onStart,
  isBusy,
  freeSummary,
}: {
  onStart: () => void;
  isBusy: boolean;
  freeSummary: { title: string; blurb: string } | null;
}) {
  return (
    <section className="rounded-2xl border border-cyan-300/16 bg-cyan-300/[0.05] p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] tracking-[0.22em] text-cyan-200/65">身体人格测试</p>
          <h3 className="mt-2 text-lg text-white">看清你长期更适合哪类装备路线</h3>
          <p className="mt-2 text-sm text-slate-300">
            这次推荐回答你现在想要什么，身体人格会告诉你长期更适合什么节奏、隐私感和隐藏路线。
          </p>
        </div>
        <button
          type="button"
          onClick={onStart}
          disabled={isBusy}
          className="rounded-full border border-cyan-300/24 bg-cyan-300/12 px-4 py-2 text-xs text-cyan-50 disabled:opacity-60"
        >
          {freeSummary ? "重新测一次" : "开始测试"}
        </button>
      </div>
      <p className="mt-3 text-xs text-cyan-100/75">免费先看基础画像，完整报告 0.5 元解锁。</p>
    </section>
  );
}
```

- [ ] **Step 4: Mount the new blocks inside `ResultsPage.tsx`**

```tsx
<BodyPersonaUnlockCard
  onStart={onStartBodyPersona}
  isBusy={isStartingBodyPersona}
  freeSummary={bodyPersonaState?.freeSummary ?? null}
/>

{isBodyPersonaQuizOpen ? (
  <BodyPersonaQuizDialog
    questions={bodyPersonaQuestions}
    answers={bodyPersonaDraftAnswers}
    onClose={onCloseBodyPersonaQuiz}
    onChangeAnswer={onChangeBodyPersonaAnswer}
    onSubmit={onSubmitBodyPersonaQuiz}
    isSubmitting={isSubmittingBodyPersonaQuiz}
  />
) : null}

{bodyPersonaState ? (
  <BodyPersonaResultPanel
    status={bodyPersonaState.status}
    freeSummary={bodyPersonaState.freeSummary}
    fullReport={bodyPersonaState.fullReport}
    onUnlock={onUnlockBodyPersona}
    isUnlocking={isUnlockingBodyPersona}
  />
) : null}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --import tsx --test src/components/BodyPersonaUnlockCard.test.tsx src/components/BodyPersonaQuizDialog.test.tsx src/components/BodyPersonaResultPanel.test.tsx src/pages/ResultsPage.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/BodyPersonaUnlockCard.tsx src/components/BodyPersonaUnlockCard.test.tsx src/components/BodyPersonaQuizDialog.tsx src/components/BodyPersonaQuizDialog.test.tsx src/components/BodyPersonaResultPanel.tsx src/components/BodyPersonaResultPanel.test.tsx src/pages/ResultsPage.tsx src/pages/ResultsPage.test.tsx
git commit -m "feat: add body persona results page experience"
```

### Task 6: Wire app orchestration, unlock flow, and archive display

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/pages/ProfilesPage.tsx`
- Modify: `src/pages/ProfilesPage.test.tsx`

- [ ] **Step 1: Write the failing integration tests**

```tsx
test("saved recommendation profile includes unlocked body persona snapshot", () => {
  const payload = buildRecommendationProfilePayload({
    answers: { tags: [], gender: "female" } as never,
    topProducts: [],
    backupProducts: [],
    recommendationTips: [],
    shoppingGuidance: [],
    bodyPersona: {
      sessionId: "persona-1",
      title: "星幕型·隐秘安全感者",
      hiddenRouteSummary: "日常器物型，隐藏力 S，共居安心度 高",
      unlocked: true,
    },
  });

  assert.equal(payload.bodyPersona?.sessionId, "persona-1");
});

test("ProfilesPage shows saved body persona summary when present", () => {
  const html = renderToStaticMarkup(
    <ProfilesPage
      profiles={[
        {
          id: "profile-1",
          title: "Quiet Rose 等 1 个推荐",
          summary: "偏好：静音、伪装；推荐：Quiet Rose",
          topProductIds: ["quiet-1"],
          savedAt: new Date().toISOString(),
          payload: {
            createdAt: new Date().toISOString(),
            title: "Quiet Rose",
            summary: "推荐档案",
            topProductIds: ["quiet-1"],
            answers: { tags: [] },
            topProducts: [],
            backupProducts: [],
            recommendationTips: [],
            shoppingGuidance: [],
            bodyPersona: {
              sessionId: "persona-1",
              title: "星幕型·隐秘安全感者",
              hiddenRouteSummary: "日常器物型，隐藏力 S，共居安心度 高",
              unlocked: true,
            },
          },
        },
      ]}
      isLoading={false}
      error={null}
      userLabel="tester"
      onBack={() => undefined}
      onReload={() => undefined}
    />,
  );

  assert.match(html, /星幕型·隐秘安全感者/);
  assert.match(html, /隐藏力 S/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --import tsx --test src/pages/ProfilesPage.test.tsx`
Expected: FAIL because archive rendering does not know about `payload.bodyPersona`

- [ ] **Step 3: Add app-level state and API orchestration in `src/App.tsx`**

```ts
const [bodyPersonaState, setBodyPersonaState] = useState<{
  sessionId: string;
  status: "idle" | "completed_free" | "unlocking" | "unlocked";
  freeSummary: {
    title: string;
    blurb: string;
    why: string;
    hints: string[];
  } | null;
  fullReport: Record<string, unknown> | null;
} | null>(null);

async function handleSubmitBodyPersonaQuiz() {
  const personaResult = resolveBodyPersonaResult({ answers: bodyPersonaDraftAnswers });
  const candidatePool = [...topProducts, ...backupProducts].slice(0, 8);
  const fullReport = buildBodyPersonaFullReport({
    persona: personaResult,
    candidatePool,
  });

  const saved = await createBodyPersonaSession({
    payload: {
      recommendationSessionId,
      sourcePageRoute: "/results",
      questionVersion: "body-persona-v1",
      scoringVersion: "body-persona-score-v1",
      answers: bodyPersonaDraftAnswers,
      answerPath: [],
      candidatePool,
      ...personaResult,
      fullReport,
    },
  });

  setBodyPersonaState({
    sessionId: saved.id,
    status: "completed_free",
    freeSummary: personaResult.freeSummary,
    fullReport: null,
  });
}

async function handleUnlockBodyPersona() {
  if (!bodyPersonaState) return;
  const order = await createBodyPersonaOrder({ sessionId: bodyPersonaState.sessionId, amountCent: 50 });
  const unlocked = await confirmBodyPersonaUnlock({ orderId: order.id });
  setBodyPersonaState((current) =>
    current
      ? {
          ...current,
          status: "unlocked",
          fullReport: unlocked.fullReport,
        }
      : current,
  );
}
```

- [ ] **Step 4: Surface persona snapshot in `ProfilesPage.tsx`**

```tsx
{selectedProfile?.payload.bodyPersona ? (
  <div className="mt-4 rounded-2xl border border-cyan-300/14 bg-cyan-300/[0.05] p-4">
    <p className="text-[11px] tracking-[0.22em] text-cyan-200/65">身体人格快照</p>
    <h3 className="mt-2 text-base text-white">{selectedProfile.payload.bodyPersona.title}</h3>
    <p className="mt-2 text-sm text-slate-300">
      {selectedProfile.payload.bodyPersona.hiddenRouteSummary}
    </p>
  </div>
) : null}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --import tsx --test src/lib/user-recommendation-profile.test.ts src/pages/ProfilesPage.test.tsx`
Expected: PASS

- [ ] **Step 6: Run focused end-to-end regression tests**

Run: `node --import tsx --test src/lib/body-persona.test.ts src/lib/body-persona-report.test.ts src/lib/body-persona-api.test.ts src/server/body-persona-store.test.ts src/server/body-persona-report-service.test.ts src/server/body-persona-route.test.ts src/pages/ResultsPage.test.tsx src/pages/ProfilesPage.test.tsx src/lib/user-recommendation-profile.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx src/pages/ProfilesPage.tsx src/pages/ProfilesPage.test.tsx src/lib/user-recommendation-profile.ts src/lib/user-recommendation-profile.test.ts
git commit -m "feat: wire body persona unlock flow"
```

## Self-Review

### Spec coverage

- Results-page unlock card: Task 5
- Six-dimension deterministic quiz and free summary: Task 1
- Hidden-route and unlocked report generation: Task 2
- Session, order, entitlement persistence: Task 3
- Simulated 0.5-yuan unlock flow: Task 3 and Task 6
- Archive linkage after login/save: Task 4 and Task 6
- AI-only-for-rerender boundary with deterministic fallback: Task 3

No uncovered spec section remains for the first implementation slice.

### Placeholder scan

- No `TBD`, `TODO`, or “similar to previous task” shortcuts remain
- Each task names exact files
- Each test and command is explicit

### Type consistency

- Session status names: `completed_free`, `unlocking`, `unlocked`
- Persona snapshot property in saved profiles: `bodyPersona`
- Hidden-route summary property name stays `hiddenRouteSummary`
- Confirm route path stays `/api/body-persona/orders/:id/confirm`
