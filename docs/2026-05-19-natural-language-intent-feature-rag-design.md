# 自然语言匹配：Intent + Feature + Lightweight RAG 设计

## 背景

自然语言匹配已经从“提关键词”升级成了 `must / prefer / avoid` 意图结构：

- `must`：必须满足的条件，例如必须是吮吸类。
- `prefer`：优先满足的偏好，例如波形更多、噪音适中。
- `avoid`：明确不要的禁区，例如不要入体、不要 APP、不要情侣款。

这一步解决的是“听懂用户原话”的问题。接下来要进一步提高准确率，需要同时处理两个方向：

- Query 侧：更稳地理解用户到底在说什么。
- Product 侧：更稳地知道每个商品到底具备什么特征。

RAG 有价值，但不应该替代硬约束判断。它更适合补充商品证据，帮助重排和解释。

## 设计结论

推荐采用四层结构：

1. `Intent Parser`
2. `Product Feature Layer`
3. `Lightweight Retrieval Evidence`
4. `AI Rerank + Explanation`

核心原则：

- `must` 和 `avoid` 走可测的本地规则。
- 商品是否满足关键特征，优先来自标准化特征字段。
- RAG 只提供证据补充和召回辅助，不负责最终硬过滤。
- AI 负责细排和解释，不负责决定禁区是否可以被突破。

## 为什么不是先上纯 RAG

纯 RAG 能提升“找到相关商品”的能力，但它不擅长稳定处理高风险约束。

例如：

- 不要入体
- 不要 APP
- 不要情侣款
- 必须是吮吸类

这些条件一旦出错，用户会直接失去信任。它们应该由 `intent + feature` 的确定性逻辑处理。

RAG 更适合回答：

- 哪些商品文案里隐藏了“模式多”的证据？
- 哪些商品虽然 `tags` 不完整，但 raw description 里写了空气脉冲或 suction？
- AI 在解释推荐时可以引用哪一段商品证据？

## 目标架构

### 1. Intent Parser

入口：

- 用户原始自然语言描述

输出：

```ts
type RecommendationNaturalLanguageIntent = {
  rawQuery: string;
  must: {
    suctionProduct: boolean;
    externalOnly: boolean;
  };
  prefer: {
    strongSuction: boolean;
    morePatterns: boolean;
    moderateNoise: boolean;
    gentleIntensity: boolean;
  };
  avoid: {
    insertable: boolean;
    appOrRemote: boolean;
    couple: boolean;
    strongIntensity: boolean;
  };
};
```

职责：

- 识别用户到底必须要什么。
- 识别用户最好想要什么。
- 识别用户绝对不要什么。

不负责：

- 判断商品是否满足这些条件。
- 解释最终为什么推荐某个商品。

### 2. Product Feature Layer

目标是把商品端从“每次都扫 rawDescription”升级成稳定特征。

建议新增一个本地特征构建函数：

```ts
type RecommendationProductFeatures = {
  isSuctionLike: boolean;
  isInsertableLike: boolean;
  supportsAppOrRemote: boolean;
  isCoupleOriented: boolean;
  hasManyPatterns: boolean;
  hasStrongSuctionSignal: boolean;
  hasGentleSignal: boolean;
  hasStrongIntensitySignal: boolean;
  evidence: {
    suction?: string[];
    patterns?: string[];
    appOrRemote?: string[];
    couple?: string[];
    intensity?: string[];
  };
};
```

输入：

- `typeCode`
- `subtypeCode`
- `physicalForm`
- `gender`
- `tags`
- `rawDescription`
- `name / displayName / canonicalName`

职责：

- 统一处理商品侧同义词。
- 统一处理商品文案里的否定表达，例如“非 APP 控制”“不是吮吸类产品”。
- 为排序和解释提供可引用证据。

不负责：

- 判断用户意图。
- 调用 AI。

当前实现状态：

- `src/lib/recommendation-product-features.ts` 已提供运行时产品特征构建。
- 特征已包含 `evidence` snippets，用于解释“为什么判定为吮吸/多模式/远控/强刺激”等。
- `src/db/backfill-recommendation-product-features.ts` 已提供 DB backfill 流程，直接写入 `recommender_toys.recommendation_features` JSONB 字段，内容包含 `featureVersion + booleans + evidence`。

### 3. Candidate Filtering

输入：

- `intent`
- `productFeatures`
- 现有 `AnswerState`

处理策略：

- `must.suctionProduct`：只保留 `features.isSuctionLike === true`
- `must.externalOnly`：只保留 `physicalForm === "external"`
- `avoid.insertable`：排除 `features.isInsertableLike === true`
- `avoid.appOrRemote`：排除 `features.supportsAppOrRemote === true`
- `avoid.couple`：排除 `features.isCoupleOriented === true`

这里不使用 RAG 做判断。

## 4. Ranking

输入：

- 候选池
- `intent`
- `productFeatures`

处理策略：

- `prefer.strongSuction`：提升 `features.hasStrongSuctionSignal`
- `prefer.morePatterns`：提升 `features.hasManyPatterns`
- `prefer.moderateNoise`：提升 `maxDb <= 50`
- `prefer.gentleIntensity`：提升 `features.hasGentleSignal`，惩罚强刺激信号

排序可以继续保留当前结构化分数，只把自然语言偏好作为加权项。

## 5. Lightweight Retrieval Evidence

这层不是完整向量数据库的第一步，而是轻量证据检索。

建议先做本地 evidence selection：

- 从 `rawDescription` 中切出短句。
- 根据 `intent` 选择最相关的 1-3 条证据。
- 把证据放进 `matchSummary` 或 AI rerank prompt。

示例：

```ts
type RecommendationEvidenceSnippet = {
  productId: string;
  signal: "suction" | "patterns" | "noise" | "appOrRemote" | "couple" | "intensity";
  text: string;
  polarity: "positive" | "negative";
};
```

用途：

- 给结果页解释用。
- 给 AI rerank prompt 用。
- 后续可以替换成 embedding retrieval。

## 6. AI Rerank + Explanation

AI 应看到：

- 用户原话
- `intent`
- 候选商品结构化字段
- 商品标准化 features
- evidence snippets
- 本地排序分数

AI 不应该做：

- 把已经被 `must / avoid` 排除的商品重新拉回来。
- 覆盖硬约束。

AI 应该做：

- 在候选池里细排 Top 3。
- 用用户原话和商品证据生成更自然的理由。
- 解释 tradeoff，例如“这款模式更多，但吸力强度信号不如另一款明显”。

## 推荐落地顺序

### Phase 1：抽 Product Feature Layer

目标：

- 把 `isSuctionLikeProduct`、`hasAppOrRemoteSignal`、`hasCoupleSignal` 这类逻辑从候选池和排序里抽出来。

验收：

- 现有自然语言测试继续通过。
- 新增 feature builder 测试覆盖：
  - 正向吮吸
  - 否定吮吸
  - 非 APP 控制
  - APP 远控
  - 情侣共玩
  - 多模式
  - 强吸力

### Phase 2：让 Candidate Pool 和 Ranking 只吃 intent + features

目标：

- 候选池不再直接扫 raw text。
- 排序层不再重复同义词判断。

验收：

- `recommendation-candidate-pool.test.ts`
- `recommendation-eval.test.ts`
- `recommendation-natural-language-intent.test.ts`
- `recommendation-results.test.ts`

全部通过。

### Phase 3：增加 Evidence Snippets

目标：

- 每个自然语言命中理由都能引用商品端证据。

示例：

- 用户说“波形更多”
- 系统解释“这款文案里明确提到多模式、多档位、多频率”

验收：

- `matchSummary` 中出现更具体的证据型说明。
- 结果页自然语言叙事更像“你说了 X，这款满足 Y”，而不是泛泛说适配。

### Phase 4：再评估是否需要 Embedding RAG

只有当以下问题明显出现时再上 embedding：

- rawDescription 很长，规则证据选择经常漏。
- 商品同义词太多，手写规则维护成本过高。
- 需要跨商品做语义召回，而不是只在候选池内排序。

如果要上 embedding，建议只用于：

- 商品证据召回
- TopN 候选补充
- AI prompt evidence

不用于：

- 硬过滤
- 禁区判断
- 直接决定最终 Top 3

## 风险与边界

### 风险 1：规则越写越散

解决方式：

- 所有 query 侧表达进入 `recommendation-natural-language-intent.ts`
- 所有 product 侧表达进入 `recommendation-product-features.ts`

### 风险 2：AI 解释突破硬约束

解决方式：

- AI prompt 明确声明候选池已完成硬约束过滤。
- AI 只能从候选池选择，不允许输出候选池外商品。

### 风险 3：RAG 让系统变得不可测

解决方式：

- RAG 只输出 evidence。
- Filtering 和 ranking 仍由可测规则控制。

## 一句话总结

自然语言匹配的准确率提升，不应该从“让模型读更多内容”开始，而应该从“把用户意图和商品特征都结构化”开始。RAG 是后续证据层，不是硬约束层。
