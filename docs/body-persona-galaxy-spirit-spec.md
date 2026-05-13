# 身体人格测试 · 星系人格体 设计规格 v2

> 本文档是 [body-persona-test-model-brief.md](body-persona-test-model-brief.md) 的视觉配套规格,用于指导 12 个星系人格体与 4 条隐藏路线伴星显影层的生成。
> 适用于 AI 生图、前端合成、品牌物料。

## 1. 设计总纲

### 1.1 名字与定位

- 产品名:星系人格体 (Galaxy Persona Entity)
- 产物形态:12 个空间人格核心 + 4 条隐藏路线伴星显影层 + 分享卡
- 设计意图:每个分型不是一枚徽章,而是一种由星系、轨道、能量结构组成的"内太空人格核心";用户不是领到一个图标,而是唤醒一个属于自己的星系人格体
- 参考气质:MBTI 小人的可分享性、Destiny 幽灵的 companion 感、Apple Vision Pro 的空间 UI、星际文明图腾、科幻 AI companion
- 结构原则:底层仍保留 6 个主画像,展示层扩展为 12 个星系人格体分型;隐藏路线作为付费解锁后的伴星/显影层

### 1.2 视觉语言锁定

- 主体:悬浮的 3D/2.5D 空间人格体,不是圆形徽章、纪念币或头像框
- 材质:半透明玻璃、星尘体积光、柔性能量膜、细金属轨道;表面可以有微弱折射和空间 UI 光线
- 结构:核心星系悬浮在中心,外围有轨道、光晕、伴星与微动态脉冲
- 构图:主体可落在一个极薄的空间基座或光阵上,但不要形成厚重奖章边框
- 光位:左上主光 + 柔和环境光 + 核心自发光,产品级打光
- 比例:人格体资产 1:1 透明底;分享卡 4:5
- 文字:人格体本体不带任何文字,所有文字由前端叠加在分享卡层

### 1.3 十二分型共用骨架

每个星系人格体由五个要素组成,缺一不可:

| 层级 | 英文 | 作用 | 视觉表达 |
| --- | --- | --- | --- |
| 核心星系 | Core | 主人格 | 中央的人格核心,决定基本形态、颜色和能量密度 |
| 外围轨道 | Orbit | 节奏感 | 环绕线、刻度、尾迹或双轨,表现进入节奏和掌控方式 |
| 光晕 | Halo | 安全感/开放度 | 外层能量膜的开合、厚薄、透明度,表现边界与开放程度 |
| 伴星 | Companion | 隐藏路线 | 解锁后的副型显影,可以是小卫星、透镜、玫瑰尘、星云碎片 |
| 微动态 | Pulse | 性格气质 | 脉冲方向、频率感、亮度呼吸,用于表达慢热、即燃、沉浸、同步等气质 |

这个结构的核心价值是:人格结果不是一张静态图,而是一个"活着的星系人格核心"。即使最终产出是静态 PNG,也要让画面看起来像某一帧空间生命体的定格。

### 1.4 硬约束(所有生成图必须满足)

- 不出现人形或身体轮廓
- 不出现任何具体成人产品
- 不出现卡通 / NFT / 游戏盔甲 / 廉价勋章感
- 不做成圆形纪念币、普通徽章、头像框或占卜水晶球
- 不带文字、水印、logo
- 性别中立,克制治愈

## 2. 六大主画像与十二个星系人格体分型

**生成目标**:实际生图对象为 12 个星系人格体分型,不是 6 个大类徽章,也不是 12 枚圆形徽章。  
6 个主画像只作为一级分类和统一视觉母题;每个主画像拆出 2 个分型,用于结果页、分享卡和用户收藏感。

### 2.0 分型总表

| 主画像 code | 主画像 | 分型 code | 分型名称 | 生成重点 |
| --- | --- | --- | --- | --- |
| `soft_glow` | 慢热探索型 | `soft_glow_safe_start` | 安心起步型 | 更强调安全入口、被照顾、身体先相信 |
| `soft_glow` | 慢热探索型 | `soft_glow_warm_atmosphere` | 氛围升温型 | 更强调慢慢进入、暖雾、氛围包裹 |
| `starlit_guard` | 隐私安全型 | `starlit_guard_low_profile` | 低存在感型 | 更强调隐身、安静、低可见度 |
| `starlit_guard` | 隐私安全型 | `starlit_guard_daily_disguise` | 日常伪装型 | 更强调普通表层、像日常器物、不尴尬 |
| `tidal_sync` | 氛围感受型 | `tidal_sync_layered_immersion` | 层次沉浸型 | 更强调多层涟漪、深度、被带入 |
| `tidal_sync` | 氛围感受型 | `tidal_sync_refined_sensory` | 精致感官型 | 更强调审美、细腻、漂亮但安全 |
| `comet_spark` | 即燃共鸣型 | `comet_spark_instant_feedback` | 即时反馈型 | 更强调清晰反馈、中心脉冲、立即知道 |
| `comet_spark` | 即燃共鸣型 | `comet_spark_efficient_confirm` | 高效确认型 | 更强调少试错、直达重点、明确路径 |
| `ring_control` | 节奏掌控型 | `ring_control_manual_mode` | 手动掌控型 | 更强调手动调节、刻度、切换 |
| `ring_control` | 节奏掌控型 | `ring_control_stable_tuning` | 稳定调节型 | 更强调稳定节奏、可预期、细调 |
| `twin_orbit` | 互动共振型 | `twin_orbit_companion_echo` | 陪伴回应型 | 更强调回应、陪伴、情绪被接住 |
| `twin_orbit` | 互动共振型 | `twin_orbit_dual_sync` | 双人同步型 | 更强调双轨同步、两点绕行、关系共振 |

### 2.1 慢热探索型 | M33 三角座

- **色板**:主 `#F4C8A1` 杏 / 副 `#E8D4B7` 沙 / 点缀 `#A67B5B` 暖铜
- **轨道金属**:香槟金哑光
- **核形**:半开的花苞状光茧,不对称,顶部有一道可见"启口缝"
- **姿态**:正在舒展,像第一次呼出那口气
- **外围轨道**:一圈缓缓外扩的光环
- **情绪词**:信任 / 舒展
- **材质记号**:六型中透明度最高,内雾偏暖

#### 2.1.1 soft_glow_safe_start · 安心起步型

- **结果宣言**:你不是慢,只是身体需要先相信它。
- **关键词**:安心 / 低压 / 被照顾
- **Core 差异**:光茧开口更小,像被柔软外壳保护着;中心光更稳定,不要明显外放
- **Orbit/Halo 差异**:外扩光环更靠近光核,像一个安全边界
- **分享卡气质**:温和、可靠、第一次也不紧张

#### 2.1.2 soft_glow_warm_atmosphere · 氛围升温型

- **结果宣言**:你适合被氛围慢慢带进去,而不是被突然推着走。
- **关键词**:暖雾 / 氛围 / 慢慢进入
- **Core 差异**:光茧开口更舒展,内部暖雾更明显
- **Orbit/Halo 差异**:外扩光环更松、更远,带一点柔软雾化拖尾
- **分享卡气质**:治愈、松弛、像一盏慢慢亮起的灯

### 2.2 隐私安全型 | M104 草帽

- **色板**:主 `#1E2A3A` 深靛 / 副 `#4A5568` 石青 / 点缀 `#C9A961` 柔金
- **轨道金属**:枪灰,内缘一线柔金
- **核形**:紧致的光珠,上方覆一道新月形帽檐
- **姿态**:蛰伏,帽檐前倾
- **外围轨道**:可视觉合拢的分段遮光环
- **情绪词**:边界 / 安稳
- **材质记号**:整体亮度最低,但内核是整组中最亮的一点
- **标志细节**:M104 的暗环直接化作帽檐

#### 2.2.1 starlit_guard_low_profile · 低存在感型

- **结果宣言**:你不是想消失,你只是需要不被打扰的入口。
- **关键词**:低调 / 安静 / 边界
- **Core 差异**:光珠更小、更集中,像藏在暗环深处
- **Orbit/Halo 差异**:分段遮光环更闭合,外层透明度更低
- **分享卡气质**:安静、克制、隐秘安全感强

#### 2.2.2 starlit_guard_daily_disguise · 日常伪装型

- **结果宣言**:你喜欢它看起来很日常,但只有你知道它的另一层用途。
- **关键词**:伪装 / 日常 / 不尴尬
- **Core 差异**:光珠外覆一层平滑透镜,像玻璃镇纸或日常小物的表面
- **Orbit/Halo 差异**:遮光环更平滑、更像器物轮廓,避免太神秘
- **分享卡气质**:表面普通、内里发光、被看见也安全

### 2.3 氛围感受型 | M51 涡状

- **色板**:主 `#7B6FB5` 薰衣紫 / 副 `#C4A5D8` 丁香灰 / 点缀 `#E8B4C6` 粉石英
- **轨道金属**:玫瑰金刷丝
- **核形**:双层嵌套的旋涡光体,同心
- **姿态**:被柔柔旋入中心
- **外围轨道**:三层错相位的涟漪
- **情绪词**:层次 / 沉浸
- **材质记号**:层次最多,可见多个深度平面
- **标志细节**:涟漪带微光渐变

#### 2.3.1 tidal_sync_layered_immersion · 层次沉浸型

- **结果宣言**:你会被层次慢慢卷进去,越细腻越容易沉浸。
- **关键词**:层次 / 沉浸 / 递进
- **Core 差异**:双层旋涡更深,内部有明显前后景
- **Orbit/Halo 差异**:三层涟漪错相位更明显,像多个节奏叠在一起
- **分享卡气质**:深度、缓慢、越看越有内容

#### 2.3.2 tidal_sync_refined_sensory · 精致感官型

- **结果宣言**:你不只在意强弱,也在意它是否漂亮、细腻、懂分寸。
- **关键词**:精致 / 细腻 / 审美
- **Core 差异**:旋涡边缘更像半透明宝石切面,粉石英点缀更明显
- **Orbit/Halo 差异**:涟漪更细、更像珠光纹理,减少大幅旋转感
- **分享卡气质**:漂亮但不张扬,有审美小彩蛋

### 2.4 直接点燃型 | M82 星暴

- **色板**:主 `#E86F4C` 珊瑚余烬 / 副 `#F4A560` 琥珀 / 点缀 `#FFD4A3` 淡金
- **轨道金属**:暖黄铜
- **核形**:下指的泪滴光核,尖端最亮
- **姿态**:冻结在"迸发前的一瞬",是蓄力不是爆炸
- **外围轨道**:一道短促上扬的尾焰
- **情绪词**:共鸣 / 即燃
- **材质记号**:内芯亮度最高,但外围轨道刻意克制,避免土味
- **标志细节**:核中横穿一道脉冲线
- **命名建议**:展示文案考虑改为"即燃共鸣型",让视觉和文案同步柔化

#### 2.4.1 comet_spark_instant_feedback · 即时反馈型

- **结果宣言**:你喜欢清楚的反馈,因为模糊才最消耗你。
- **关键词**:明确 / 即时 / 清晰
- **Core 差异**:泪滴尖端更亮,脉冲线更短、更集中
- **Orbit/Pulse 差异**:尾焰短促,像刚刚被点亮的反馈信号
- **分享卡气质**:干净、直接、有一点温热的启动感

#### 2.4.2 comet_spark_efficient_confirm · 高效确认型

- **结果宣言**:你不想浪费试错,你想更快确认什么真正适合自己。
- **关键词**:高效 / 少试错 / 直达重点
- **Core 差异**:泪滴光核更像一枚指向中心的导航标,尖端朝内收束
- **Orbit/Pulse 差异**:尾焰变成一条清晰路径线,不要做成爆炸
- **分享卡气质**:理性、利落、目标感强

### 2.5 节奏掌控型 | 车轮星系

- **色板**:主 `#2E8B8B` 碧青 / 副 `#5CB8B2` 海沫 / 点缀 `#E0E4E7` 白金
- **轨道金属**:白金刷丝,带细刻度
- **核形**:清亮光球,立于刻度环轮毂中央
- **姿态**:指挥者般的居中自持
- **外围轨道**:可旋的"节拍刻度环"
- **情绪词**:可控 / 自持
- **材质记号**:六型中机械精度最高,每一道刻度干净
- **标志细节**:环上有等距刻痕,但不出现数字

#### 2.5.1 ring_control_manual_mode · 手动掌控型

- **结果宣言**:你需要把节奏握在自己手里,这样身体才会放松。
- **关键词**:手动 / 切换 / 掌控
- **Core 差异**:中央光球更像可旋钮的轮毂,但不要出现真实按钮
- **Orbit/Pulse 差异**:刻度环更清晰,有 3 到 5 个无数字标记点
- **分享卡气质**:精准、理性、有控制台般的安心感

#### 2.5.2 ring_control_stable_tuning · 稳定调节型

- **结果宣言**:你不追求失控感,你更喜欢稳定地调到刚刚好。
- **关键词**:稳定 / 细调 / 可预期
- **Core 差异**:中央光球更圆润、更平衡,光强不突兀
- **Orbit/Pulse 差异**:刻度环更柔和,带细微渐变,像稳定波形
- **分享卡气质**:可靠、平衡、长期适配

### 2.6 互动共振型 | 触须星系

- **色板**:主 `#D4577A` 暖玫 / 副 `#F0B4B9` 粉珊瑚 / 点缀 `#E8C4A0` 桃金
- **轨道金属**:柔玫瑰金
- **核形**:两枚相互绕行的光点,之间一道细光链
- **姿态**:共舞中,两点同步绕轨
- **外围轨道**:光链本身即是"乐器"
- **情绪词**:回响 / 同步
- **材质记号**:对称构图,双焦点
- **标志细节**:光链中央有柔和脉冲渐变

#### 2.6.1 twin_orbit_companion_echo · 陪伴回应型

- **结果宣言**:你会被回应感放大,有人接住你时体验更容易打开。
- **关键词**:陪伴 / 回应 / 被接住
- **Core/Companion 差异**:两枚光点一大一小,距离更近,像正在回应
- **Orbit/Pulse 差异**:光链更柔,中央脉冲更像回声而不是拉扯
- **分享卡气质**:温柔、亲密、适合表达“有人在场”的安心

#### 2.6.2 twin_orbit_dual_sync · 双人同步型

- **结果宣言**:你更适合同步的节奏,关系里的共振会让感受变得更强。
- **关键词**:同步 / 双轨 / 共振
- **Core/Companion 差异**:两枚光点大小接近,呈稳定双轨绕行
- **Orbit/Pulse 差异**:光链更清晰,像一条可见的同步轨道
- **分享卡气质**:平衡、互动、双向牵引

## 3. 四条隐藏路线的伴星显影层

**核心原则**:隐藏路线不替换星系人格体分型,而是在已生成的人格体之上显影一个 Companion 伴星层,作为用户付费解锁后的"显影瞬间"——0.5 元的一个视觉爽点。

**工程建议**:12 个分型人格体用 AI 生成一次即可,隐藏路线伴星层用前端 CSS/Canvas 合成,避免让 AI 跑 12×4=48 张(既贵又难一致)。

### 3.1 zero_profile · 低存在感型 · 幽灵星系

- **Companion**:一枚近透明幽灵伴星,沿外层轨道若隐若现
- **显影**:一层近透明外壳,把人格体外圈 30%~40% 的不透明度降下来
- **效果**:人格体像"退入雾中"
- **轨道结构**:不变
- **星系背景**:色温降约 10%

### 3.2 daily_object · 日常伪装型 · 透镜星系

- **Companion**:一枚平滑透镜伴星,像悬浮玻璃镇纸
- **显影**:人格体正面加一层平滑的透镜表层
- **效果**:人格体"透过一层日常表层"被看到——上层是日用质感,下层是本来的光
- **轨道结构**:不变
- **星系背景**:饱和度降 20%

### 3.3 beauty_disguise · 精致伪装型 · 玫瑰星系 Arp 273

- **Companion**:一枚玫瑰尘伴星,带极细粉金尾迹
- **显影**:外围轨道点缀微小的珐琅玫瑰纹饰,内部光雾带淡粉尘
- **效果**:人格体"被装点"了——不是藏起来,是被审美加持
- **轨道结构**:内沿多出一道极细的粉金线
- **星系背景**:偏暖,玫瑰色偏移

### 3.4 pocket_ready · 随手收纳型 · 小麦哲伦星云

- **Companion**:一枚小麦哲伦星云式小伴星,像可被收进口袋的星云碎片
- **显影**:整体构图缩至 85%,周边散落松散的"星尘碎片"
- **效果**:人格体读出"紧凑 + 可收纳"的感觉
- **轨道结构**:稍微收紧,不要变成厚重外框
- **星系背景**:不变

## 4. AI 生图 Prompt 模板

### 4.1 基础模板(填入 `{占位符}`)

```text
A premium 3D / 2.5D Galaxy Persona Entity, a living inner-space personality core,
not a badge, not a coin, not a medallion, not a mascot. It is a floating spatial
entity made of galaxy matter, orbit lines, halo membranes, companion satellites,
and subtle energy pulses. Mature gender-neutral, soothing wellness-tech aesthetic,
high-end sci-fi companion feeling, no text, no logo.

Persona variant: {VARIANT_NAME}. It belongs to the broader persona family:
{PARENT_PERSONA_NAME}. This image should represent the specific variant,
not just the broad parent category.

Core: {CORE_SHAPE}, rendered as a semi-transparent galaxy core with glass-like
refraction, inner volumetric glow, stardust, and soft self-illumination,
palette of {PRIMARY_HEX}, {SECONDARY_HEX}, accented with {ACCENT_HEX}.

Orbit: {ORBIT_STRUCTURE}.

Halo: {HALO_STRUCTURE}.

Companion: no hidden-route companion visible in the base asset.

Pulse: {PULSE_BEHAVIOR}.

Personality posture: {POSTURE_KEYWORD}.

Variant detail: {VARIANT_DETAIL}.

Galaxy reference: softened energy impression of {GALAXY_NAME}, integrated into
the core and orbit structure, not used as a flat background image.

Lighting: soft top-left key light, gentle ambient, studio product render.
Composition: centered floating entity on a very subtle spatial UI pedestal or
light field, transparent background, cinematic but clean, share-card ready.

Negative: no NFT aesthetic, no game armor, no cartoon, no human figure,
no animal, no explicit imagery, no adult product, no circular badge frame,
no coin rim, no thick medallion, no text, no watermark.
```

### 4.2 填充示例(soft_glow_safe_start · 安心起步型)

```text
A premium 3D / 2.5D Galaxy Persona Entity, a living inner-space personality core,
not a badge, not a coin, not a medallion, not a mascot. It is a floating spatial
entity made of galaxy matter, orbit lines, halo membranes, companion satellites,
and subtle energy pulses. Mature gender-neutral, soothing wellness-tech aesthetic,
high-end sci-fi companion feeling, no text, no logo.

Persona variant: soft_glow_safe_start, 安心起步型. It belongs to the broader
persona family: 慢热探索型. This image should represent the specific variant,
not just the broad parent category.

Core: a half-open luminous cocoon, petal-like, slightly asymmetric, with a small
protected opening seam at the top, rendered as a semi-transparent galaxy core
with glass-like refraction, warm inner volumetric glow, stardust, and soft
self-illumination, palette of #F4C8A1, #E8D4B7, accented with #A67B5B.

Orbit: a close protective champagne-gold orbit line wrapping near the core,
like a soft safety boundary.

Halo: a warm translucent halo membrane, slightly closed, low-pressure, protective.

Companion: no hidden-route companion visible in the base asset.

Pulse: very slow breathing light, stable, not outwardly bursting.

Personality posture: gently held before fully unfurling, as if the body is
learning to trust.

Variant detail: the cocoon opening is smaller and safer than the broader
soft_glow family, the central light is stable, not outwardly bursting.

Galaxy reference: softened energy impression of M33 Triangulum galaxy,
integrated into the cocoon core and close orbit structure, not used as a flat
background image.

Lighting: soft top-left key light, gentle ambient, studio product render.
Composition: centered floating entity on a very subtle spatial UI pedestal or
light field, transparent background, cinematic but clean, share-card ready.

Negative: no NFT aesthetic, no game armor, no cartoon, no human figure,
no animal, no explicit imagery, no adult product, no circular badge frame,
no coin rim, no thick medallion, no text, no watermark.
```

## 5. 输出规格

- 星系人格体:12 张,每张 1024×1024 PNG,透明底
- 分享卡:1080×1350 (4:5),人格体居左或居上三分之一,右侧/下方留给文字叠加层
- App icon 变体:512×512,几何化简版(方向 B 的纹章降级方案,可后续单出)
- 文件命名:`persona-entity-{variant_code}.png`;隐藏路线合成变体 `persona-entity-{variant_code}-{hidden_code}.png`

## 6. 一致性验收清单

每张生成图在并入集合前,逐项核对:

- [ ] 不像圆形徽章、纪念币、头像框或 NFT 勋章
- [ ] Core 占整体视觉重心 35%~50%,外围 Orbit/Halo 有空间呼吸感
- [ ] 星系参考融入 Core/Orbit,不是平贴在背景上的星云图
- [ ] 无人形剪影、盔甲、卡通、NFT / 加密币视觉套路
- [ ] 色板在 ±10% 色相容差内
- [ ] 同一主画像下的两个分型能看出亲缘关系,但姿态和核心细节明显不同
- [ ] 整体明度让这张"属于同一套"——把 12 张并排,没有哪一张跳出来
- [ ] 如果做成动态图,微动态只体现 Pulse 呼吸、轨道轻移和伴星显影,不要大幅旋转或炫技

## 7. 落地优先级

1. 先锁定 12 张星系人格体基础资产(不含任何隐藏路线伴星)——这是用户真正会分享的身份主体
2. 4 条隐藏路线伴星显影用前端 CSS/Canvas 实现,不要让 AI 跑 12×4=48 张,贵且难一致
3. 设计分享卡模板,预留人格体舞台 + 主画像名 + 分型名 + 星系名 + 关键词 + 宣言 + 隐藏路线标签
4. 视需要,再单出 App icon 尺寸的纹章版(方向 B),用于小尺寸场景和未解锁占位态

## 8. 建议同步落地的一次文案微调

视觉方向定下之后,以下两个点顺手改会更协调:

- `comet_spark` 展示名:直接点燃型 → **即燃共鸣型**(与"迸发前一瞬"的视觉姿态呼应)
- `zero_profile` 展示名:无隐藏路线 → **低存在感型**(与"退入雾中"的叠加视觉呼应,且爽点更强)
- 结果结构建议新增展示层字段 `personaVariantCode`,用于承载 12 个星系人格体分型;底层 `primaryPersonaCode` 不动,避免破坏现有前后端数据结构
- 分享卡标题建议使用 `主画像 · 分型名`,例如 `慢热探索型 · 安心起步型`,让用户既能看懂大类,也能感到结果足够具体

code 不动,优先新增展示文案与分型字段,不破坏现有前后端数据结构。
