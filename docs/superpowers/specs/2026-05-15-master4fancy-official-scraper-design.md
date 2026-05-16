# Master4Fancy Official Scraper Design

日期: 2026-05-15
目标: 为 `https://master4fancy.com/collections/inventory` 新增一套官方独立站抓取与清洗链路,并复用现有 Shopify scraper 模式写入 `products` 和 `recommender_toys`。

## 1. 范围

本次抓取范围固定为:

- 抓取玩具主商品
- 抓取相关配件
- 抓取服饰类商品
- 过滤明显弱相关周边和非核心商品

当前明确需要过滤的弱相关项包括:

- `play mat`
- `squishy` / `squishies`
- `lucky bag`
- 其他明显偏赠品、周边、解压类而非推荐库核心商品的条目

本次不做:

- 任意集合页全站爬取
- 复杂库存状态历史追踪
- 评论抓取
- 额外品牌级知识图谱扩展

## 2. 复用策略

采用现有 Shopify official scraper 模式,优先复用:

- `src/scraper/luxevibes-official/`
- `src/scraper/dame-official/`

原因:

- 已具备列表页 + 分页 + 详情页 + cleaner 的完整链路
- 已具备人民币价格换算逻辑
- 已具备 `rawDescription` 翻译缓存与持久化逻辑
- 已具备 `type_code` / `subtype_code` 分类与入库逻辑
- 已具备可观测日志与调试环境变量开关

## 3. 页面结构假设

已知页面入口:

- 列表页: `https://master4fancy.com/collections/inventory`

已知 DOM 约束:

- 列表区域: `#product-grid`
- 分页区域: `.pagination__list.list-unstyled`

设计要求:

- 抓取逻辑优先在 `#product-grid` 范围内解析商品
- 分页逻辑优先在 `.pagination__list.list-unstyled` 范围内解析页码
- 不强依赖单一卡片 class 名,保留“按商品链接兜底提取”的 fallback,避免主题换皮导致再次全 0

## 4. 数据流

### 4.1 crawler

新增目录:

- `src/scraper/master4fancy-official/crawler.ts`

输出 review buffer:

- `src/data/master4fancy-official-review-buffer.json`

抓取步骤:

1. 打开 `inventory` 列表页
2. 等待页面稳定并滚动加载列表
3. 从分页区域解析总页数
4. 逐页解析列表商品
5. 合并重复商品 URL
6. 进入详情页抓取商品详细信息
7. 生成 review buffer
8. 默认继续执行 cleaner,也支持显式跳过

列表字段:

- `sourceUrl`
- `name`
- `subtitle`
- `coverImage`
- `priceUsd`
- `originalPriceUsd`
- `priceCurrency`
- `categoryHints`
- `genderHint`
- `stock`
- `listPosition`

详情字段:

- `title`
- `subtitle`
- `metaTitle`
- `metaDescription`
- `priceUsd`
- `originalPriceUsd`
- `coverImage`
- `galleryImages`
- `manualUrls`
- `rawDescription`

### 4.2 cleaner

新增目录:

- `src/scraper/master4fancy-official/cleaner.ts`

输出 cleaned data:

- `src/data/master4fancy-official-cleaned-data.json`

处理步骤:

1. 读取 review buffer
2. 去重 canonical name
3. 翻译英文 `rawDescription`
4. 进行人民币价格换算
5. 推断材质、外观、物理形态、防水、功能标签
6. 分类 `type_code` / `subtype_code`
7. 写入 `products`
8. 同步到 `recommender_toys`

## 5. 过滤规则

需要增加 `Master4Fancy` 专属保留规则:

- 保留包含玩具核心信号的商品
- 保留常见配件信号商品
- 保留服饰/束带/穿戴辅助类商品
- 过滤明显周边/礼袋/软玩具类商品

### 5.1 保留词

示例保留信号:

- `dildo`
- `plug`
- `vibrator`
- `massager`
- `fantasy`
- `egg mold`
- `harness`
- `strap`
- `wear`
- `lingerie`
- `accessory`

### 5.2 过滤词

示例过滤信号:

- `play mat`
- `squishy`
- `squishies`
- `lucky bag`
- `sticker`
- `poster`
- `gift card`

最终逻辑遵循:

- 优先保留玩具/配件/服饰
- 对边界商品尽量保守过滤,避免污染推荐库

## 6. 运行体验

沿用 `luxevibes` 的可观测运行方式,避免脚本“像卡死”。

计划支持:

- 启动日志
- 列表分页进度
- 累计唯一商品数
- 详情页抓取进度
- review buffer 写入完成日志
- cleaner 是否执行日志

调试环境变量:

- `MASTER4FANCY_OFFICIAL_MAX_ITEMS`
- `MASTER4FANCY_OFFICIAL_SKIP_CLEANER`
- `MASTER4FANCY_OFFICIAL_VERBOSE`
- `MASTER4FANCY_OFFICIAL_LIST_SETTLE_MS`
- `MASTER4FANCY_OFFICIAL_PAGE_SETTLE_MS`
- `MASTER4FANCY_OFFICIAL_DETAIL_SETTLE_MS`
- `MASTER4FANCY_OFFICIAL_DETAIL_DELAY_MS`

## 7. 脚本入口

计划新增 `package.json` scripts:

- `scrape:master4fancy-official`
- `clean:master4fancy-official`

## 8. 测试策略

新增最小测试覆盖:

- URL canonicalization
- 列表页解析
- fallback 链接解析
- 过滤规则
- cleaner 的人民币换算
- cleaner 的分类输出
- runtime options 与 skip cleaner 开关

## 9. 风险与对应

风险 1: 列表主题结构不稳定

对应:

- 使用选择器范围 + fallback 链接解析双层兜底

风险 2: 商品页包含大量装饰文案,影响 `rawDescription`

对应:

- 仅提取主要内容区域
- 过滤推荐商品、评论、footer、重复 CTA

风险 3: 配件与周边边界模糊

对应:

- 先按明确过滤词做保守控制
- 需要时用 review buffer 做二次人工抽查

风险 4: 抓取耗时长

对应:

- 保留 `MAX_ITEMS`
- 保留可视化进度日志
- 支持跳过 cleaner 便于分段调试

## 10. 验收标准

满足以下条件视为完成:

- 能从 `inventory` 列表页抓到非 0 商品
- 分页可正常推进
- 能过滤明显周边项
- 能保留玩具 + 配件 + 服饰
- 能产出 review buffer
- 能产出 cleaned data
- 能成功跑测试与 `npm run lint`
