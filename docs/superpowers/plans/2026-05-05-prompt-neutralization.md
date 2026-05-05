# Prompt Neutralization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Neutralize high-risk and medium-risk model prompt wording in the approved file set without changing schema, classification logic, tags, or downstream behavior.

**Architecture:** Add regression coverage first at two levels: prompt-builder coverage for the recommendation service and static source-string coverage for scraper/front-end prompt files. Then do surgical string replacements in the approved prompt templates only, preserving JSON shapes, field names, and runtime branching. Finish with targeted test runs plus type-check verification.

**Tech Stack:** TypeScript, Node.js `node:test`, `tsx`, existing app/server scraper modules

---

## File Structure

- `src/server/app-ai-service.test.ts`
  - Existing behavioral tests for recommendation prompt building; extend it with assertions that the generated prompt text uses the new neutral role wording and no longer includes the retired role wording.
- `src/lib/prompt-neutralization.test.ts`
  - New source-level regression test that reads approved prompt-bearing files from disk and asserts banned wording is absent while required replacement wording is present.
- `src/server/app-ai-service.ts`
  - Replace the recommendation prompt role label with the approved neutral wording in both prompt builders.
- `src/App.tsx`
  - Keep the duplicated front-end prompt text aligned with the server prompt role wording.
- `src/scraper/svakom-official/crawler.ts`
  - Neutralize the OCR assistant role wording and `玩法` label.
- `src/scraper/svakom-official/cleaner.ts`
  - Neutralize cleaner role wording and replace display-only example tag text.
- `src/scraper/lovense-official/cleaner.ts`
  - Neutralize cleaner role wording and description-only category wording.
- `src/scraper/nomitang-official/cleaner.ts`
  - Neutralize cleaner role wording and description-only category wording.
- `src/scraper/wevibe-official/cleaner.ts`
  - Neutralize cleaner role wording and description-only category wording.
- `src/scraper/zalo-official/crawler.ts`
  - Neutralize the OCR assistant role wording and `玩法` label.
- `src/scraper/lelo/cleaner.ts`
  - Neutralize the device parsing role wording and display-only example tag text.

---

### Task 1: Add regression coverage for approved prompt wording

**Files:**
- Create: `src/lib/prompt-neutralization.test.ts`
- Modify: `src/server/app-ai-service.test.ts`
- Test: `src/server/app-ai-service.test.ts`, `src/lib/prompt-neutralization.test.ts`

- [ ] **Step 1: Write the failing test in `src/server/app-ai-service.test.ts`**

Add this test near the other prompt-focused service tests:

```ts

test("recommendation prompts use neutral role wording", async () => {
  const requests: ChatCompletionRequest[] = [];
  const service = createAppAiService({
    env: {
      QWEN_API_KEY: "qwen-key",
    } as NodeJS.ProcessEnv,
    chatCompletionRunner: async (request) => {
      requests.push(request);
      return JSON.stringify([{ id: "p-1", reason: "推荐理由" }]);
    },
  });

  await service.runRerank({
    answers: {
      tags: ["静音", "高伪装"],
      gender: "female",
      physicalForm: "external",
      motorType: "gentle",
      maxDb: 45,
      waterproof: 7,
      budget: [100, 300],
      appearance: "high_disguise",
    },
    rankedProducts: [
      createRankedProduct("p-1", {
        rawDescription: "低噪设计，适合安静环境。",
      }),
    ],
  });

  const prompt = requests[0]?.prompt || "";
  assert.match(prompt, /个人护理设备选品助手/);
  assert.doesNotMatch(prompt, /性健康装备选品专家/);
});
```

- [ ] **Step 2: Write the failing test in `src/lib/prompt-neutralization.test.ts`**

Create the new file with these source-string assertions:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

const approvedPromptFiles = [
  "src/App.tsx",
  "src/server/app-ai-service.ts",
  "src/scraper/svakom-official/crawler.ts",
  "src/scraper/svakom-official/cleaner.ts",
  "src/scraper/lovense-official/cleaner.ts",
  "src/scraper/nomitang-official/cleaner.ts",
  "src/scraper/wevibe-official/cleaner.ts",
  "src/scraper/zalo-official/crawler.ts",
  "src/scraper/lelo/cleaner.ts",
] as const;

test("approved prompt files no longer use retired high-risk wording", () => {
  for (const file of approvedPromptFiles) {
    const source = read(file);
    assert.doesNotMatch(source, /情趣用品详情图识别助手/);
    assert.doesNotMatch(source, /情趣商品数据清洗助手/);
    assert.doesNotMatch(source, /情趣电商品牌数据清洗助手/);
    assert.doesNotMatch(source, /情趣硬件参数的数据拆解机器人/);
    assert.doesNotMatch(source, /性健康装备选品专家/);
  }
});

test("approved prompt files contain the new neutral wording", () => {
  assert.match(read("src/server/app-ai-service.ts"), /个人护理设备选品助手/);
  assert.match(read("src/App.tsx"), /个人护理设备选品助手/);
  assert.match(read("src/scraper/svakom-official/crawler.ts"), /个人护理用品详情图识别助手/);
  assert.match(read("src/scraper/svakom-official/cleaner.ts"), /个人护理商品数据清洗助手/);
  assert.match(read("src/scraper/lovense-official/cleaner.ts"), /个人护理电商品牌数据清洗助手/);
  assert.match(read("src/scraper/nomitang-official/cleaner.ts"), /个人护理电商品牌数据清洗助手/);
  assert.match(read("src/scraper/wevibe-official/cleaner.ts"), /个人护理电商品牌数据清洗助手/);
  assert.match(read("src/scraper/zalo-official/crawler.ts"), /个人护理用品详情图识别助手/);
  assert.match(read("src/scraper/lelo/cleaner.ts"), /个人护理设备参数的数据拆解助手/);
});
```

- [ ] **Step 3: Run the tests to verify they fail for the expected wording**

Run:

```bash
node --import tsx --test src/server/app-ai-service.test.ts src/lib/prompt-neutralization.test.ts
```

Expected:
- FAIL because the old strings are still present in the prompt sources.
- The new assertions for `个人护理设备选品助手` and related neutral phrases should fail before code changes.

- [ ] **Step 4: Commit the red tests**

```bash
git add src/server/app-ai-service.test.ts src/lib/prompt-neutralization.test.ts
git commit -m "test: cover prompt neutralization wording"
```

---

### Task 2: Neutralize recommendation prompt role wording in the shared rerank flow

**Files:**
- Modify: `src/server/app-ai-service.ts`
- Modify: `src/App.tsx`
- Test: `src/server/app-ai-service.test.ts`

- [ ] **Step 1: Write the minimal implementation in `src/server/app-ai-service.ts`**

Replace the duplicated role string in both prompt builders:

```ts
return `
你是一个专业的个人护理设备选品助手。
当前候选池已经由结构化规则筛到较小范围。请你在这些候选商品中，重新挑选最匹配的前 3 名，并给出每个商品的推荐理由。
```

and:

```ts
return `
你是一个专业的个人护理设备选品助手。
Top 3 主推荐已经确定，请只补充两个结果区域：
```

- [ ] **Step 2: Keep the front-end duplicate prompt in `src/App.tsx` aligned**

Apply the same wording change in both front-end prompt templates:

```ts
const prompt = `
你是一个专业的个人护理设备选品助手。
当前候选池已经由结构化规则筛到较小范围。请你在这些候选商品中，重新挑选最匹配的前 3 名，并给出每个商品的推荐理由。
```

and:

```ts
const prompt = `
你是一个专业的个人护理设备选品助手。
Top 3 主推荐已经确定，请只补充两个结果区域：
```

- [ ] **Step 3: Run the targeted tests to verify the new role wording passes**

Run:

```bash
node --import tsx --test src/server/app-ai-service.test.ts src/lib/prompt-neutralization.test.ts
```

Expected:
- The new service-level prompt assertion passes.
- The static prompt-neutralization test still fails for scraper files not yet updated.

- [ ] **Step 4: Commit the shared prompt wording update**

```bash
git add src/server/app-ai-service.ts src/App.tsx src/server/app-ai-service.test.ts src/lib/prompt-neutralization.test.ts
git commit -m "refactor: neutralize recommendation prompt wording"
```

---

### Task 3: Neutralize approved scraper OCR and cleaner prompt wording

**Files:**
- Modify: `src/scraper/svakom-official/crawler.ts`
- Modify: `src/scraper/svakom-official/cleaner.ts`
- Modify: `src/scraper/lovense-official/cleaner.ts`
- Modify: `src/scraper/nomitang-official/cleaner.ts`
- Modify: `src/scraper/wevibe-official/cleaner.ts`
- Modify: `src/scraper/zalo-official/crawler.ts`
- Modify: `src/scraper/lelo/cleaner.ts`
- Test: `src/lib/prompt-neutralization.test.ts`

- [ ] **Step 1: Update the OCR prompt role labels and field labels**

In both crawler files, make these string replacements and nothing broader:

```ts
const TOY_DETAIL_OCR_PROMPT = `你是一个专业的个人护理用品详情图识别助手。你会收到同一款商品的一组长图详情页图片，请只提取图片中能明确看见或读出的商品信息。

请以中文结构化文本输出：
1. 产品名称/型号
2. 产品定位/使用方式
```

Apply this in:
- `src/scraper/svakom-official/crawler.ts`
- `src/scraper/zalo-official/crawler.ts`

- [ ] **Step 2: Update cleaner role wording and display-only example tags**

Apply these prompt-only replacements:

```ts
你是一个个人护理商品数据清洗助手。
```

```ts
"function_tags": ["防水", "定点刺激", "静音"]
```

```ts
你是一个个人护理设备参数的数据拆解助手。
```

In the brand cleaner prompts, apply these replacements while leaving schema keys untouched:

```ts
你是一个个人护理电商品牌数据清洗助手。
```

```ts
Lovense 官方站是混合商品池，可能是女性向、男性向、特定部位使用款、情侣共玩、互动机器或礼盒套装，请优先依据标题和页面分类提示判断。
```

```ts
若是礼盒/套装，也仍按个人护理器具商品理解，不要误判成非商品页面。
```

```ts
nomiTang 商品可能是女性向、男性向、特定部位使用款、情侣或护理品，请优先依据标题和正文特征判断。
```

```ts
We-Vibe 官方站是混合商品池，可能是女性向、男性向、情侣共玩或礼盒套装，请优先依据标题和页面分类提示判断。
```

Apply these in:
- `src/scraper/svakom-official/cleaner.ts`
- `src/scraper/lovense-official/cleaner.ts`
- `src/scraper/nomitang-official/cleaner.ts`
- `src/scraper/wevibe-official/cleaner.ts`
- `src/scraper/lelo/cleaner.ts`

- [ ] **Step 3: Run the wording regression test to verify all approved files are clean**

Run:

```bash
node --import tsx --test src/lib/prompt-neutralization.test.ts src/server/app-ai-service.test.ts
```

Expected:
- PASS for both test files.
- No banned prompt-role phrases remain in the approved file set.

- [ ] **Step 4: Commit the scraper prompt neutralization**

```bash
git add \
  src/scraper/svakom-official/crawler.ts \
  src/scraper/svakom-official/cleaner.ts \
  src/scraper/lovense-official/cleaner.ts \
  src/scraper/nomitang-official/cleaner.ts \
  src/scraper/wevibe-official/cleaner.ts \
  src/scraper/zalo-official/crawler.ts \
  src/scraper/lelo/cleaner.ts \
  src/lib/prompt-neutralization.test.ts

git commit -m "refactor: neutralize scraper prompt wording"
```

---

### Task 4: Run final verification and document residual scope

**Files:**
- Modify: none
- Test: `src/server/app-ai-service.test.ts`, `src/lib/prompt-neutralization.test.ts`

- [ ] **Step 1: Re-run the full targeted verification suite**

Run:

```bash
node --import tsx --test src/server/app-ai-service.test.ts src/lib/prompt-neutralization.test.ts
```

Expected:
- PASS
- No failures

- [ ] **Step 2: Run the repo type-check**

Run:

```bash
npx tsc --noEmit
```

Expected:
- PASS
- Exit code 0

- [ ] **Step 3: Inspect the final diff for scope discipline**

Run:

```bash
git diff -- src/App.tsx src/server/app-ai-service.ts src/server/app-ai-service.test.ts src/lib/prompt-neutralization.test.ts src/scraper/svakom-official/crawler.ts src/scraper/svakom-official/cleaner.ts src/scraper/lovense-official/cleaner.ts src/scraper/nomitang-official/cleaner.ts src/scraper/wevibe-official/cleaner.ts src/scraper/zalo-official/crawler.ts src/scraper/lelo/cleaner.ts
```

Expected:
- Only prompt wording and the new regression test file changed.
- No schema, branching, or field-name changes appear in the diff.

- [ ] **Step 4: Commit the verification checkpoint**

```bash
git add src/App.tsx src/server/app-ai-service.ts src/server/app-ai-service.test.ts src/lib/prompt-neutralization.test.ts src/scraper/svakom-official/crawler.ts src/scraper/svakom-official/cleaner.ts src/scraper/lovense-official/cleaner.ts src/scraper/nomitang-official/cleaner.ts src/scraper/wevibe-official/cleaner.ts src/scraper/zalo-official/crawler.ts src/scraper/lelo/cleaner.ts
git commit -m "chore: verify prompt neutralization changes"
```
