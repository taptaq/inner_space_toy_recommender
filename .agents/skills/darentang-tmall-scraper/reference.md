# 大人糖爬虫 — 参考

## 数据流

1. `TARGET_URL` 可以是店铺搜索列表，也可以是新版 `shop/view_shop.htm` 店铺首页货架流  
2. 列表页同时兼容两套结构：  
   - 旧版：`.J_TItems dl.item`  
   - 新版：`.product_shelf` / `[class*="ProductShelf"]` / `[class*="product_shelf"]` 下的 `[class*="cardContainer"]`  
3. 列表页收集商品卡片，保留 `listUrl` 和 `listPageUrl`  
4. 价格：整页列表截图 OCR 一次识别多商品 → 本地价格缓存 → 单项截图 OCR 兜底  
5. 详情：优先回到 `listPageUrl` 模拟点击商品卡片/图片，拿到可能带 `pisk` 的最终 `sourceUrl`；新版货架页必要时先移除 `.J_MIDDLEWARE_FRAME_WIDGET` 遮罩并对卡片 `force: true` 点击  
6. 详情页 `response` 监听里攒 `alicdn` 图 URL，并在控制台输出详情图片地址  
7. 滚动 → `tryRevealTmallParamTabs` → 再滚动  
8. 参数提取依次尝试：
   - `scrapeParamPairsFromIceContext`
   - `scrapeParamPairsInPage`
   - `extractParamPairsFromPageHtml(全文)`
   - `extractParamPairsFromLooseJsonText(全文)`
   - `extractParamPairsFromCompactText(document.body.innerText)`
9. 白名单键：`材质、品牌、产地、生产企业、分类、品名`  
10. 图够则 `orchestrateOCR`，否则 `textFallbackWithDeepSeek`  
11. `bufferData` → 对应品牌的 review buffer → `runCleaner()`；cleaner 会再从 `rawDescription` 本地抽取标签并合并模型标签

## 输出文件

- `src/data/review-buffer.json`：爬虫原始缓冲（路径以 `crawler.ts` 内 `BUFFER_PATH` 为准）
- `src/data/cleaned-data.json`：cleaner 输出的清洗后数据
- `src/data/darentang-list-price-cache.json`：列表价格 OCR 缓存；新品牌应改为 `<brand-slug>-list-price-cache.json`

## 入库字段来源

- `products.price` / `recommender_toys.price`：数字类型，来自 `item.price` 或 cleaner 的 `price_rmb` 兜底；不保留 `priceText`。
- `products.link`：使用 `item.sourceUrl`，用于前端跳转。
- `recommender_toys.brand`：固定写入品牌中文名。
- `recommender_toys.raw_description`：直接保存爬虫阶段合成后的 `rawDescription`，用于后续排查、复洗或前端调试。
- `recommender_toys.max_db`：玩具类可解析分贝；服饰、护理耗材、床品防护垫为 `null`。
- `recommender_toys.gender`：护理耗材如避孕套、润滑液固定 `unisex`；男用/飞机杯/男士等显式关键词优先矫正为 `male`，再结合分类与模型结果。
- `recommender_toys.tags` / `function_tags`：合并模型标签、本地 `rawDescription` 标签和默认分类标签，并过滤 `未提及`。
- 空 `name`：直接跳过，不入库。

## 数据库连接稳定性

- cleaner 里模型调用耗时较长，Postgres/PgBouncer 可能在 AI 等待期间关闭空闲连接，表现为 `Connection terminated unexpectedly`。
- 写入 `products` / `recommender_toys` 前应先做 `SELECT 1` 健康检查。
- 瞬断错误可 `$disconnect()` + `$connect()` 后重试 3 次；重试块要包住 `products` upsert 和 `recommender_toys` delete/create，避免只写入半条链路。

## 已验证可抓到的参数样例

对商品 `id=628616572066`，当前已验证能从紧凑文本参数区提取：

- `材质: 硅胶`
- `品牌: 大人糖`
- `品名: 小海豹`
- `产地: 中国大陆`
- `生产企业: 深圳市有幸科技有限公司`
- `分类: 变频跳蛋`

## 当前参数归一规则

- `材质 / 面料材质 / 材料` → `材质`
- `品名 / 商品名 / 商品名称 / 产品名称 / 医疗器械名称` → `品名`
- `生产企业 / 生产厂家 / 厂家 / 制造商 / 生产商 / 委托生产企业` → `生产企业`

## 为什么要保留 compact-text 解析

- 新版天猫参数区可能不是传统 `dl/tr/li` 结构。
- 页面正文里会出现两次以上 `参数信息`，前面的可能只是导航标签。
- `extractParamPairsFromCompactText` 会扫描所有参数区块，而不是只取第一次命中。

## rawDescription 标签补充规则

- cleaner 会优先从这些段落抽标签：`技术卖点`、`核心卖点`、`使用特性`、`动力规格`、`产品类型`、`款式结构`、`套装构成`、`规格信息`、`环境属性`。
- 品类判断不能只看整段 `rawDescription`；天猫 SKU 分类经常包含赠品/套餐，如 `润滑液`、`安全套`、`湿巾`。如果商品标题/规范名命中 `训练器`、`飞机杯`、`跳蛋`、`按摩器`、`震动棒` 等器具词，应优先按 `toy` 处理。
- 之后再按类别补默认标签：
  - `toy`：偏震动、吮吸、加热、遥控、APP、防水、静音等
  - `apparel`：偏服饰、套装、蕾丝、网纱
  - `care`：偏护理耗材、安全套、润滑液、水基、乳胶、超薄
  - `pad`：偏床品垫、防水、防渗、可水洗、便携
- 最终统一去重，并移除任何含 `未提及` 的标签。

## 小怪兽店铺页特例

- `https://xiaoguaishou.tmall.com/shop/view_shop.htm?...` 已验证不是传统 `.J_TItems` 搜索页，而是首页货架流。
- 实测滚动到底后约 `35` 个商品，并出现 `没有更多商品`。
- 首个货架卡片点击后可进入带动态参数的详情链接，因此不要只依赖静态 `a[href]`。

## 网易春风店铺页特例

- `https://wangyichunfeng.tmall.com/search.htm?...&search=y` 已验证是旧版 `.J_TItems dl.item` 店内搜索页，不是 `ProductShelf/cardContainer` 货架流。
- 实测主列表 1 页、约 `8` 个主商品；页面下方另有“本店内推荐”，抓取时应只取主列表，避免重复。
- 列表 DOM 里的详情链接点击后会补出带 `pisk` 的最终 URL，因此 `sourceUrl` 仍应以模拟点击落地结果为准。
- 旧搜索页正文隐藏文本里可直接解析 `itemId -> 数字价格` 映射，可优先于列表 OCR 使用；如失败再回退到整页/单项 OCR。

## 醉清风-谜姬店铺页特例

- `https://zuiqingfeng.tmall.com/category.htm?spm=a1z10.5-b-s.w4011-14956746985.1.52c11a13kjTwIT` 已验证是旧版天猫类目页，核心列表仍是 `.J_TItems dl.item`，不是 `ProductShelf/cardContainer` 货架流。
- 实测主列表首屏约 `68` 个商品，分页状态为 `1/40`；抓取时应沿用旧版列表翻页逻辑。
- 页面下方同样存在“本店内推荐”，抓取时应只取主列表区 `.J_TItems`，避免把推荐区商品重复带入。
- 列表 DOM 里的详情链接默认只有 `id/rn/abbucket`；后续如点击后补出更完整跳转参数，`sourceUrl` 仍应以模拟点击落地结果为准。

## 新增调试入口模板

1. 在 `src/scraper/darentang/` 添加 `debug-xxx.ts`  
2. `import 'dotenv/config'` + `chromium` + 与 crawler 一致的 Cookie/context 初始化（可抄 `debug-param-chain.ts`）  
3. 在根 `package.json` 的 `scripts` 增加 `"debug:xxx": "tsx -r dotenv/config src/scraper/darentang/debug-xxx.ts"`  
4. 在本 Skill 的「命令」表格补一行

## Playwright

- 浏览器由项目 `dependencies` 的 `playwright` 提供；首次运行若缺浏览器可执行 `npx playwright install chromium`。
