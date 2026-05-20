# Raw Description 页面重爬清单

生成时间：2026-05-19

## 摘要

- 需要重新爬取页面的产品数：171
- 来源报告：`/var/folders/w0/p3hj4s052_gb26fqf2k6rm9r0000gn/T/raw-description-candidates-2026-05-19T05-13-56-757Z-needs-refetch.json`
- 说明：这些产品当前只有低置信度本地字段摘要，尚不建议直接写入 `raw_description`。
- 建议：按域名分批使用对应爬虫重抓详情页，再生成高置信 `raw_description`。

## 域名分布

- `detail.tmall.com`：88 条
- `lelo.com`：49 条
- `lovehoney.co.uk`：7 条
- `svakom.com`：7 条
- `getmaude.com`：5 条
- `us.satisfyer.com`：5 条
- `lovense.com`：4 条
- `we-vibe.com`：4 条
- `amazon.com`：2 条

## 重爬建议

- `detail.tmall.com`：优先用已有 Tmall scraper/cookie/详情页参数链重抓，不建议用通用 fetch。
- `lelo.com`：建议新增或复用官方站点抓取逻辑，优先抽取 JSON-LD、meta description 和产品详情模块。
- `lovehoney.co.uk`、`svakom.com`、`satisfyer`、`we-vibe`、`lovense`：优先走品牌官方/站点专用 crawler，通用 fetch 容易 403 或返回地区页。
- `amazon.com`：建议低优先级，页面结构和反爬不稳定，除非该商品没有其他官方来源。

## 产品清单

| # | 产品 | toyId | 域名 | 置信度 | 当前来源类型 |
|---:|---|---|---|---:|---|
| 1 | TIANI™ 3 | `f9a494c1-873b-4ce6-b164-b3ca46bf9c48` | `lelo.com` | 0.62 | `local_metadata_summary` |
| 2 | 小白盒吮吸 | `f77da84a-b102-4046-91df-2b49438b0e79` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 3 | Fleshlight X Lovehoney 男用 | `fbc68f6e-23f0-4600-9db0-695f67a664df` | `lovehoney.co.uk` | 0.62 | `local_metadata_summary` |
| 4 | 魔吻 | `f7ce2085-92a5-41d1-9282-050c3b0137d8` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 5 | 小羽毛 | `e8437ecb-f891-49d9-bbb3-e637e4c04342` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 6 | 小羊羔 | `eaba6373-2eec-4711-83e6-4232436ea7df` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 7 | 冰与火 | `edc642a7-4784-4879-9275-1ae166a4c14b` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 8 | 兔子月 | `e43c9337-cef7-4ec4-8c98-241daa7d9cf5` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 9 | BOBO吮吸 | `e5e6171b-cf93-44c6-980b-589615cbeb55` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 10 | SONA3 汐汐贝吮吸 | `e866ee0d-557d-43de-b469-72cdd0bd380b` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 11 | Domi2 | `e9cbf8b0-b9d2-4fb4-bbd4-c9c1586892d8` | `lovense.com` | 0.62 | `local_metadata_summary` |
| 12 | F1S V3 | `f14a6f39-9214-466a-90e7-992f8a34fe2a` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 13 | ELISE™ 2 | `e912b615-a842-4bd2-9192-078c52b2bd9a` | `lelo.com` | 0.62 | `local_metadata_summary` |
| 14 | lyla2 | `eac119bc-2b87-4542-b5ba-736243fd9abc` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 15 | Calla 马蹄莲 | `e4190049-f103-4ace-a9ef-b435dcbdebba` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 16 | 逗豆鸟 | `df70f9e0-76c5-4867-8a4e-4842e18c34e0` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 17 | 2026新款新娘制服性感免脱诱惑 内衣床上战袍大尺度趣味女睡衣 | `cf9fab81-bb82-4407-922d-e42466df9e8b` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 18 | ZEN日本禅 | `d426c336-c4b0-4b20-92ec-5e21d55dfe9d` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 19 | LELO Beads™ | `d669b4b6-84d4-4874-a2bb-7e551a495e27` | `lelo.com` | 0.62 | `local_metadata_summary` |
| 20 | SORAYA Wave™ | `d1546339-3ede-402f-bf8f-affe81d9fa59` | `lelo.com` | 0.62 | `local_metadata_summary` |
| 21 | Avery | `dd31b252-6058-40f9-9f55-e216ceca5a46` | `svakom.com` | 0.62 | `local_metadata_summary` |
| 22 | kisstoy迷路穿戴秒潮女用 入体 玩具 用品女生调小情 | `d3be60d1-8dc8-4e57-89d0-eb509f892909` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 23 | Pleasure Trip Silicone Rechargeable Wand （硅胶充电棒振动器） | `d3b5574e-5cb5-45c9-93ef-8d4b688f3f81` | `lovehoney.co.uk` | 0.62 | `local_metadata_summary` |
| 24 | SORAYA™ 2 | `dc171db1-2aa3-4519-bcce-6b96cb50315d` | `lelo.com` | 0.62 | `local_metadata_summary` |
| 25 | LILY™ 3 | `d5ae8782-21d7-4565-ac29-08d6759f9395` | `lelo.com` | 0.62 | `local_metadata_summary` |
| 26 | Lovehoney Rose Suction Stimulator（玫瑰型 吮吸器 | `d180250d-449b-4658-913f-ea555164ff59` | `lovehoney.co.uk` | 0.62 | `local_metadata_summary` |
| 27 | FIT 电动 （升级款） | `e1508c55-bd66-460e-a99f-65fcc5786733` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 28 | 二代（闻啼鸟/不羁夜灯）电动 | `cb9dbbef-c47d-4352-be01-e69404613947` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 29 | 主角 | `cc2e8d01-4a44-4c37-a953-dd18245fb787` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 30 | Mia3 米娅三代口红 | `c6e9dfc8-494b-4aea-b00a-b1695ea3225d` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 31 | INA Wave™ 2 | `c535bd2a-d4ff-4f62-8fbb-8a6b6b9d5002` | `lelo.com` | 0.62 | `local_metadata_summary` |
| 32 | SMART WAND™ 2 Medium | `bdbe6d1b-ed0a-4270-a05c-1ca25d7d8320` | `lelo.com` | 0.62 | `local_metadata_summary` |
| 33 | SONA™ 2 Travel | `ce6be44c-594e-4f7d-b265-07cd915e5def` | `lelo.com` | 0.62 | `local_metadata_summary` |
| 34 | LOKI Wave™ | `c6e6b48b-910f-4e9c-ba6b-74e56893e0d4` | `lelo.com` | 0.62 | `local_metadata_summary` |
| 35 | SIRI™ 2 | `c0bfcdfd-8482-4e00-af3f-3b9e81c30755` | `lelo.com` | 0.62 | `local_metadata_summary` |
| 36 | 机甲战神 | `c614d49f-d112-4545-870c-45e0fc691ddf` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 37 | SIRI™ 3 | `bd2cd489-ea69-43aa-9a07-7e7d3226f1d4` | `lelo.com` | 0.62 | `local_metadata_summary` |
| 38 | Mission Control | `bef79e90-3241-462a-bfa3-e43e0f351a83` | `us.satisfyer.com` | 0.62 | `local_metadata_summary` |
| 39 | 花与剑 | `b1ef1159-279d-4a1c-8f1d-463e20fc468c` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 40 | spot | `b49a5d5f-4589-4ff3-afe9-c9325d04eb7e` | `getmaude.com` | 0.62 | `local_metadata_summary` |
| 41 | Jive 2 | `bc3c7d75-38c1-4698-80a0-558a77f1e9e6` | `we-vibe.com` | 0.62 | `local_metadata_summary` |
| 42 | 浪花pro | `bb88aadc-f77a-4f56-bf21-190f5d325e9d` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 43 | petit果冻柔滑一次性按摩 | `af2357c0-8011-4fab-8c16-0d763e2b696a` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 44 | 小海豹 | `b96fd1ee-bb57-4e06-bc48-d297a76e8a50` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 45 | CiCi 2 | `b7f74fe4-cb05-4d78-bf4a-b5fc7cbb58a0` | `svakom.com` | 0.62 | `local_metadata_summary` |
| 46 | 绵绵 | `ac64b480-327e-4d25-99f5-9e84e144a7eb` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 47 | 灵与欲 | `ab61a96f-0ac5-4f6b-a194-effddb656074` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 48 | cc机吮吸 | `acb9ecd7-e508-44f1-a4fe-61f3a355a372` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 49 | 啵啵汪（ 吮吸器） | `b9fb09d6-75af-4432-bfd5-9dcc1aa1c1f5` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 50 | SONA™ | `ac28ce7b-083b-4c5b-9e00-58163e7f24d2` | `lelo.com` | 0.62 | `local_metadata_summary` |
| 51 | LIV™ 2 | `b4db4e86-b4fc-4b04-9cd5-44f9b3ab0d58` | `lelo.com` | 0.62 | `local_metadata_summary` |
| 52 | LILY™ 2 | `b88b5127-389c-4298-bde3-87a9e28e063b` | `lelo.com` | 0.62 | `local_metadata_summary` |
| 53 | ENIGMA Wave™ | `a9b426e5-e4f1-4ad8-9301-0f4a93898402` | `lelo.com` | 0.62 | `local_metadata_summary` |
| 54 | HEX™ Respect XL | `9492c3e9-2301-48f7-9f75-be6c961719ee` | `lelo.com` | 0.62 | `local_metadata_summary` |
| 55 | Spot On 1 | `a170a72c-ead5-4d2d-9623-d3575452245a` | `us.satisfyer.com` | 0.62 | `local_metadata_summary` |
| 56 | NEA™ 3 | `92ef3907-d7f3-4ea2-a0ac-094d6c48dc49` | `lelo.com` | 0.62 | `local_metadata_summary` |
| 57 | kiss涎 | `a6864d6a-c204-4b7d-8abb-2a7513648724` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 58 | Bess点潮笔 | `a30abbbf-f5d4-40a3-932f-d16af641e7b2` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 59 | TNH 3D手动 | `a71af007-04c5-4d19-ad2b-98472ff7834b` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 60 | 丫丫棒 | `a444f753-a885-432d-9c0a-c49b944c26a8` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 61 | LOKI™ | `9f05962e-4799-456d-a5cb-38cdd6599cca` | `lelo.com` | 0.62 | `local_metadata_summary` |
| 62 | 魔炮机 | `a671ba48-35c8-4a92-b68f-0041d35a3485` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 63 | SILA™ | `a634ca3b-26dd-48ad-9802-1c6f958c9759` | `lelo.com` | 0.62 | `local_metadata_summary` |
| 64 | Diamo 环 | `a0f62193-e028-4ae8-8ca3-7927cda8c213` | `lovense.com` | 0.62 | `local_metadata_summary` |
| 65 | Melt2 | `960c20af-59cc-4e34-afe0-07207618dacc` | `we-vibe.com` | 0.62 | `local_metadata_summary` |
| 66 | 大人糖她心之境香包衣柜持久香气家用室内衣橱随身香氛香薰挂件 | `9ba2d077-7bf3-4d81-9fa8-3f316ee66c4e` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 67 | spinner旋吸 | `9a98e548-2e34-431e-9c5e-cf7edef02e85` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 68 | Lovehoney Passion Pod 吮吸器 | `984cc5d5-19e1-4036-acec-d845ffb168cf` | `amazon.com` | 0.62 | `local_metadata_summary` |
| 69 | MIA™ 2 | `a5ce6df1-0848-4ad5-aca4-8e0e7973f19c` | `lelo.com` | 0.62 | `local_metadata_summary` |
| 70 | 颜与玉 2代 | `9a8efbcd-3555-4d4b-a87b-7fcd756099e2` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 71 | 鲸叹号 | `9b79d579-85fb-4c69-99e0-0fe87b17c2ef` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 72 | SMART WAND™ 2 Large | `8f069e53-5be8-4328-a1e0-5903aad66aca` | `lelo.com` | 0.62 | `local_metadata_summary` |
| 73 | Ella neo | `8be9d801-7eb0-4a70-9e3a-857f54f0d97c` | `svakom.com` | 0.62 | `local_metadata_summary` |
| 74 | tina | `8a7582e8-00b5-4a5f-b5e1-ca8a8d678f3f` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 75 | 岩石智能 训练器 | `83b75292-72fe-4ec0-9465-8ca4d04502d7` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 76 | 黑洞pro | `8630d31f-7693-4af7-93de-38402b8736cc` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 77 | SILA™ Cruise | `83d5857d-7528-4427-b0c5-0cfb608e2ddf` | `lelo.com` | 0.62 | `local_metadata_summary` |
| 78 | LELO DOT™ Travel | `8e465dbe-d7bd-4800-a3ae-6443939e6b7a` | `lelo.com` | 0.62 | `local_metadata_summary` |
| 79 | 全自动伸缩炮机 | `8f188dc2-bdc0-48d9-9507-8b18efd05faf` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 80 | 双生潮 | `8841f310-587c-4bdf-bf16-d7fdc05021a6` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 81 | ORA™ 3 | `8b27b439-e523-4557-bd99-8176ac683d18` | `lelo.com` | 0.62 | `local_metadata_summary` |
| 82 | ENIGMA™ Cruise | `8bad26db-a654-4a43-a35f-97e6c33358bd` | `lelo.com` | 0.62 | `local_metadata_summary` |
| 83 | Womanizer Pro40 震动器 | `8e9b0b7e-4eb5-4140-9521-711a16693e31` | `amazon.com` | 0.62 | `local_metadata_summary` |
| 84 | Perfect Pair 2 | `850503a6-b55e-4857-90b0-335535c60b58` | `us.satisfyer.com` | 0.62 | `local_metadata_summary` |
| 85 | 罗格小液晶av棒 | `921ae7fc-1799-4bb6-a2b5-6212324b1c1f` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 86 | F1S™ V2 | `6f730051-7f22-4924-9788-58ae22f1f978` | `lelo.com` | 0.62 | `local_metadata_summary` |
| 87 | King伸缩炮机 | `71c0711c-84d3-4f27-add1-a97ffdd40b67` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 88 | 王与妃 | `7f374db7-bfda-447c-934a-457bcf70dcfa` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 89 | TOC一次性小巧 | `6e5667d5-3896-4a83-9791-9f8df60684f9` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 90 | BRUNO™ | `6e5addf1-a63d-4ccc-887f-0bea50bfc1ac` | `lelo.com` | 0.62 | `local_metadata_summary` |
| 91 | SONA™ 2 | `709de86d-20ec-47d5-87f7-b73b7693937d` | `lelo.com` | 0.62 | `local_metadata_summary` |
| 92 | SONA™ 2 Cruise | `7d8656fc-8305-475f-9d25-97c5900cd8ca` | `lelo.com` | 0.62 | `local_metadata_summary` |
| 93 | 小雪人 | `7774bd98-7bf3-4ac5-8905-899f3df965ce` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 94 | 铆钉可开裆连体衣 内衣2026新款性感睡衣床上大尺度趣味女Z211 | `79addb99-0413-434f-aecf-bed8ee4cbd2f` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 95 | FLORA坐式 | `80313374-c8c3-4638-bd58-7a4fb7dd57bd` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 96 | 小白 | `7efe6044-4fb3-4c9f-bd8c-152789a4fecb` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 97 | MONA Wave™ | `786c9657-66ab-4b00-a886-a014a77545ac` | `lelo.com` | 0.62 | `local_metadata_summary` |
| 98 | kisstoy突突二代替换头+配件 | `69668b16-3ca1-4088-87c4-1ce4905be090` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 99 | SONA™ Cruise | `6d604496-a56d-47b0-8659-067c320d8b9c` | `lelo.com` | 0.62 | `local_metadata_summary` |
| 100 | LELO Smart Bead™ | `66b0d1a2-e520-423f-a380-95106f773d34` | `lelo.com` | 0.62 | `local_metadata_summary` |
| 101 | 小怪兽派对房趣电击av棒男用小扳手 按摩 榨精神器sm玩具 | `6c953d42-135b-4ddd-892e-4566032547c5` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 102 | TOR™ 2 | `62762bc9-d078-46e2-b0b1-7695fbf964ba` | `lelo.com` | 0.62 | `local_metadata_summary` |
| 103 | temp | `65eb7e87-69c4-43b1-9daa-5d23428b52d5` | `we-vibe.com` | 0.62 | `local_metadata_summary` |
| 104 | 秒潮五代polly | `575dd165-fa34-44ae-a341-1c54b14578b6` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 105 | 点点棒 | `639cdd1c-d538-4387-80cf-eaf1665903a2` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 106 | GEO球形包裹手动 | `6191ed7c-5eb4-46b5-8c5b-aae10cbf6c4a` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 107 | 小怪兽二代 | `57cdaa74-01f9-4eaa-a725-beb3e155aaa0` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 108 | Erica | `5e26a46f-bdc6-485f-902a-356061be05f2` | `svakom.com` | 0.62 | `local_metadata_summary` |
| 109 | ATH标准版真空吮吸 | `57c9b066-fdea-4755-94fc-8497319a0a6c` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 110 | 元系列2代 | `6036f9c4-33a8-4a5d-8a86-47fc11c3e309` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 111 | shine aloe润滑液 | `5eff5497-ebbd-4698-88b3-b402cffebfaf` | `getmaude.com` | 0.62 | `local_metadata_summary` |
| 112 | Edeny | `63a2e5e7-354c-4ebc-9085-f0d2f51f20a5` | `svakom.com` | 0.62 | `local_metadata_summary` |
| 113 | 拂悦 | `61b5c49c-b84b-48bf-b72b-b463627bbb19` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 114 | 手指糯米棒 | `665d3826-91d1-413d-8bdf-3f569165c9c1` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 115 | kistoyKATY女用品震动棒自慰器情趣按摩女性加温自卫慰可插入 | `53ca86b3-04e6-4fb8-9e7d-7ad228f30a25` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 116 | INA™ 3 | `4488271b-893e-45d7-9e1e-67b0dcfea2b0` | `lelo.com` | 0.62 | `local_metadata_summary` |
| 117 | 山海玄中录冰感润滑液油剂 男士用品 打人体仿真水基大瓶 | `440b56e5-d77b-46f6-95d5-b49184a86e6f` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 118 | Dual Embrace Pulsing Suction Dual Stimulator（脉动双效 吮吸 ） | `40210672-babd-42f3-906c-3b30ea362ad6` | `lovehoney.co.uk` | 0.62 | `local_metadata_summary` |
| 119 | LELO DOT™ | `5552ae3b-0f8e-47e5-971b-741391417406` | `lelo.com` | 0.62 | `local_metadata_summary` |
| 120 | LYLA™ 2 | `49ea18fd-5f25-4382-a84b-8fb324fd1ad0` | `lelo.com` | 0.62 | `local_metadata_summary` |
| 121 | 甜甜棒 | `4321cb96-2345-4268-9cd0-d966c67a4b7f` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 122 | Flip异次元Zero | `467f4be1-05e3-444a-89cc-4ed0012a161a` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 123 | 小皇冠点潮笔 | `477aa839-5697-4e96-85dc-2d4e6718528f` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 124 | 小怪兽一代 | `49e6c231-91c0-496b-ae6a-9ecc2b4149a9` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 125 | GIGI™ 2 | `4c571b01-16fc-4263-a016-ea19501ac9bd` | `lelo.com` | 0.62 | `local_metadata_summary` |
| 126 | 含羞抱春 | `523f1fef-d86d-4cd0-9f53-1da5807d5e3f` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 127 | 生命力 | `4d267a63-bbaf-4ef8-a843-dcbd7c2842c1` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 128 | G-Spot Wave 4 | `410642e5-b260-44aa-95c0-f3bb40663897` | `us.satisfyer.com` | 0.62 | `local_metadata_summary` |
| 129 | Vibe | `5635ea71-d313-473d-babc-6a883279d737` | `getmaude.com` | 0.62 | `local_metadata_summary` |
| 130 | kisstoy突突炮机自慰器女全自动收缩震动棒女性用品情趣玩具成人 | `3fd215a7-9728-4e4f-9055-0ebc222af92d` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 131 | Beatrice前戏震动器 | `3a017edf-b232-4ab2-8af1-bc35ffa8f477` | `svakom.com` | 0.62 | `local_metadata_summary` |
| 132 | LELO Beads™ Noir | `370b1e7f-2ac8-4150-955e-bc4ece6a2de7` | `lelo.com` | 0.62 | `local_metadata_summary` |
| 133 | 扣扣机 | `38a92c3b-2db5-47d5-a83a-57b3ced39497` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 134 | 蜜探 | `348c085d-26c2-4e19-b74a-6c3b4effc94f` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 135 | APIS 悦能环 | `3ed6c021-0706-4613-85bc-76481d92144b` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 136 | MONA™ 2 | `3d85ff32-b431-4e59-8f5f-19aca3e91660` | `lelo.com` | 0.62 | `local_metadata_summary` |
| 137 | HULA Beads™ | `2efed82a-02ba-4422-9115-da926c28dd59` | `lelo.com` | 0.62 | `local_metadata_summary` |
| 138 | band | `2dd3741c-1bec-44ff-b1dd-6ca1193a7735` | `getmaude.com` | 0.62 | `local_metadata_summary` |
| 139 | 自由 | `2fba9d9c-d229-43b5-a972-1b354315172c` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 140 | Burn No1亲密护理按摩油 | `3abe32f3-366e-4b46-aa63-bdd3c7056cc2` | `getmaude.com` | 0.62 | `local_metadata_summary` |
| 141 | kisstoy秒潮Tina3成人情趣用品电击震动棒炮机女性用自慰器玩具 | `2a9e4e01-e6fd-4166-bfb6-1abe665bd05e` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 142 | 小智蛋 | `2a274ce2-b476-4152-9256-ca41a5a600bb` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 143 | ENIGMA™ | `17374b6d-2312-49d1-8063-1aca89a3b7d0` | `lelo.com` | 0.62 | `local_metadata_summary` |
| 144 | stick口红式 | `1cec780e-28fc-4775-97fb-b0b4cf4fcd94` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 145 | Aya-组合式穿戴按摩器 | `1c106934-a7e8-47c9-9171-c9e3a2924a71` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 146 | Ambi震动器 | `1b280f78-f7e5-4898-b920-88024b8bcdd3` | `lovense.com` | 0.62 | `local_metadata_summary` |
| 147 | 小花蕾 | `19fbca51-4309-4bc6-bafb-a7c71b7df6d5` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 148 | 迷路穿戴 | `19933ccf-5f22-47d4-98b5-bde2ddaf0a60` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 149 | TOR 3代 环 | `1cd3b889-2ed0-4eb8-bd50-c7f979d5eaf5` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 150 | TIANI™ DUO | `2445a7fc-cdcd-4322-8ea1-9efb93edc80e` | `lelo.com` | 0.62 | `local_metadata_summary` |
| 151 | 大人糖水漫波 玩具 用品女性 入体 摇摆 | `1ddde562-fd43-4af2-9082-0af08caa1ca6` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 152 | Arcwave Zing男式免提振动器 | `2572e6ff-1de1-484a-94c6-4932f39fe27f` | `lovehoney.co.uk` | 0.62 | `local_metadata_summary` |
| 153 | Playful Four | `276341d2-e6a7-4e73-b252-a892d0463a47` | `us.satisfyer.com` | 0.62 | `local_metadata_summary` |
| 154 | 安可尼云顶啵啵 夹腿吮吸器 女性 用品遥控震动小玩具 | `28257ec4-4559-4040-89f7-0632a092af36` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 155 | Neo 2 pro | `2a7fe41e-43ad-451a-91ba-e74e27931c95` | `svakom.com` | 0.62 | `local_metadata_summary` |
| 156 | HEX™ Original | `11eacacd-6d84-40af-afeb-3bd634b16cc9` | `lelo.com` | 0.62 | `local_metadata_summary` |
| 157 | SORAYA Beads™ | `0dad3af0-f36f-49b2-ab0a-4bfe46209063` | `lelo.com` | 0.62 | `local_metadata_summary` |
| 158 | Fifty Shades of Greedy Girl（兔子振动器） | `083c31ac-163c-499a-86d4-4f7153049af0` | `lovehoney.co.uk` | 0.62 | `local_metadata_summary` |
| 159 | 白夜魔双 | `0b31a214-47ac-492c-84a3-16cd80fcb406` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 160 | Lush 器 | `04e0cf91-5ae7-4a1c-8b25-aa7f4b58aeb8` | `lovense.com` | 0.62 | `local_metadata_summary` |
| 161 | gigi3 G点按摩 | `15167ca3-c1a3-46e4-8b79-8a1793756c8f` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 162 | beads缩阴球 | `06d142f4-798a-421c-9062-6dbcc26bf164` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 163 | Moxie+ | `00eee713-381b-463f-a89e-4a6e371f1259` | `we-vibe.com` | 0.62 | `local_metadata_summary` |
| 164 | TIANI™Harmony | `14c364f2-6b1a-4811-be99-cd5010bf8ff0` | `lelo.com` | 0.62 | `local_metadata_summary` |
| 165 | Tiani Duo 夫妻共用体感遥控 | `034b7b8b-f181-4bcf-964c-976ea21fe475` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 166 | BILLY™ 2 | `0f734da1-4d0b-4d3b-9c29-cbdf8f15e311` | `lelo.com` | 0.62 | `local_metadata_summary` |
| 167 | IDA™ Wave | `0d7a8a31-3227-44a5-95e1-8bc6117b652f` | `lelo.com` | 0.62 | `local_metadata_summary` |
| 168 | 青媞 2.0 | `118eefd9-0fe3-4005-a65c-65ca4fc19ca0` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 169 | HUGO™ | `01530220-075e-4f6a-a513-e9868124df49` | `lelo.com` | 0.62 | `local_metadata_summary` |
| 170 | MORING系列 | `0d2b5847-9bf3-4466-802f-730c0d096de3` | `detail.tmall.com` | 0.62 | `local_metadata_summary` |
| 171 | Blowmotion 加热振动男性 | `0cc09609-1668-4406-b168-8496820a28be` | `lovehoney.co.uk` | 0.62 | `local_metadata_summary` |
