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

### 1.3 统一主体母版

所有 12 个分型的主体都必须遵循同一套母型定义,不能各自发散成不同物种或不同外形体系。  
这个主体不是人、不是动物、不是徽章,而是一个**半透明星云果冻状人格生命体**。

统一主体特征:

- **外轮廓**:柔软不规则水滴/星云团形,整体偏圆润,有一个轻微上扬的尖角或隆起,像被轻轻托起的宇宙软体。
- **材质**:半透明玻璃果冻 / 星云凝胶 / 柔性能量膜,边缘有蓝紫色折射和暖金高光。
- **内部**:深色宇宙内核,可见细密星尘、微小恒星点、柔和星轨线。
- **眼睛**:保留两枚小而温暖的椭圆光眼,这是人格体的情感锚点;眼睛只表达陪伴感和生命感,不要做夸张表情。
- **姿态**:悬浮、安静、轻微呼吸感;像科幻 AI companion,但不机械。
- **尺度**:主体占画面 55%~70%,不要小到像图标,也不要大到裁切边缘。
- **变化方式**:12 个分型不改变主体物种,只改变内部星系纹理、Core 亮度、Orbit 轨迹、Halo 开放度、Companion 伴星和 Pulse 微动态。

统一负向约束:

- 不要变成人形小人。
- 不要变成动物、宠物、史莱姆怪、吉祥物或卡通角色。
- 不要变成徽章、圆球、机器人、盔甲、NFT 头像。
- 不要去掉两枚暖光眼,但眼睛不能过大、过萌或有明显表情。

### 1.4 十二分型共用骨架

每个星系人格体由五个要素组成,缺一不可:

| 层级 | 英文 | 作用 | 视觉表达 |
| --- | --- | --- | --- |
| 核心星系 | Core | 主人格 | 中央的人格核心,决定基本形态、颜色和能量密度 |
| 外围轨道 | Orbit | 节奏感 | 环绕线、刻度、尾迹或双轨,表现进入节奏和掌控方式 |
| 光晕 | Halo | 安全感/开放度 | 外层能量膜的开合、厚薄、透明度,表现边界与开放程度 |
| 伴星 | Companion | 隐藏路线 | 解锁后的副型显影,可以是小卫星、透镜、玫瑰尘、星云碎片 |
| 微动态 | Pulse | 性格气质 | 脉冲方向、频率感、亮度呼吸,用于表达慢热、即燃、沉浸、同步等气质 |

这个结构的核心价值是:人格结果不是一张静态图,而是一个"活着的星系人格核心"。即使最终产出是静态 PNG,也要让画面看起来像某一帧空间生命体的定格。

### 1.5 硬约束(所有生成图必须满足)

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

### 4.0 母型元素拆解原则

- **主体母型定义**: 主体必须是一种半透明、柔软、悬浮的星云果冻生命体。轮廓像一团被轻轻托起的宇宙凝胶,整体偏圆润,不是标准水滴,不是几何体,不是对称形。
- **外轮廓拆解**: 顶部有一个轻微上扬的小尖角或小波峰;左右两侧有自然的不对称鼓起;下半身略带软塌感,像受重力影响但仍处于失重悬浮状态。
- **表层材质拆解**: 外膜是蓝紫到淡靛色的半透明玻璃凝胶,边缘有轻微折射,局部有暖金高光,质感介于果冻、薄玻璃和柔性能量膜之间。
- **内部结构拆解**: 内部不是塞满图案的实体,而是偏暗的宇宙空腔,能看到稀疏星点、轻雾状星尘、极细弱星轨和一枚小型种子光核。
- **面部锚点拆解**: 只保留两枚小而温暖的椭圆光眼,低情绪、低表演感,像安静注视你的 AI companion。不要嘴巴,不要眉毛,不要卡通表情。
- **环绕星系拆解**: 星系元素重点体现在主体外部,是 2 到 3 条不完全闭合的柔性星带、暖色微光尾迹、漂浮粒子群和局部小型旋迹,像在主体周围缓缓绕行。
- **优先级顺序**: 先对齐主体外轮廓和材质,再做眼睛和内部空腔,再补 Orbit/Halo,最后再加少量星系细节。
- **内部星系限制**: 不要把完整的大星系、巨大旋臂、巨型花朵、巨大光茧塞进人格体腹部。主体不是“装着星系的容器”,而是“自身带有星尘呼吸感的生命体”。
- **正确融合方式**: 星系元素更多体现在外部环绕、边缘折射、局部星尘、微弱轨道纹和很轻的核心光感上,内部只保留稀疏星点、弱星雾和一枚小型种子光核。

### 4.1 基础模板(填入 `{占位符}`)

```text
Create a premium 3D / 2.5D Galaxy Persona Entity.
The main subject must remain a soft translucent cosmic jelly-like soul body:
rounded irregular droplet/blob silhouette, slightly asymmetrical, softly lifted
upper crest, blue-violet glass-gel membrane, warm rim highlights, dark starfield
interior, and two small warm oval glowing eyes. The silhouette must feel alive,
slightly squishy, gently sagging, and quietly floating, with asymmetrical bulges
on the sides and lower body. Not a badge, not a coin, not a medallion, not a
mascot. Mature gender-neutral, soothing wellness-tech aesthetic, high-end sci-fi
companion feeling, no text, no logo.

Persona variant: {VARIANT_NAME}. It belongs to the broader persona family:
{PARENT_PERSONA_NAME}. This image should represent the specific variant,
not just the broad parent category.

Important composition rule:
the jelly soul body is the absolute hero.
Do not place a large spiral galaxy inside the body.
Do not place a huge central flower, giant cocoon, or giant glowing object in the belly.
Do not turn the body into a galaxy container.

Core: {CORE_SHAPE}, expressed as a small or medium internal energy structure,
kept subtle inside the dark starfield body, rendered with restrained glow,
sparse stardust, soft refraction, and palette of {PRIMARY_HEX}, {SECONDARY_HEX},
accented with {ACCENT_HEX}.

Orbit: {ORBIT_STRUCTURE}, preferably expressed as 2-3 elegant asymmetric
surrounding orbit ribbons or drifting galaxy traces around the outside of the body,
with soft warm swirl energy, floating stardust clusters, and partial passes in
front of and behind the body, not as rigid scientific atom rings.

Halo: {HALO_STRUCTURE}, hugging the membrane closely and supporting the feeling
of protection or openness without becoming a thick frame.

Companion: no hidden-route companion visible in the base asset.

Pulse: {PULSE_BEHAVIOR}.

Personality posture: {POSTURE_KEYWORD}.

Variant detail: {VARIANT_DETAIL}.

Galaxy reference: softened energy impression of {GALAXY_NAME}, used mainly in
surrounding orbit accents, membrane-edge refractions, sparse inner star dust,
and a faint internal seed-light. Do not render a full obvious galaxy inside the body.

Lighting: soft top-left key light, gentle ambient, studio product render.
Composition: centered floating jelly-like galaxy entity on a very subtle spatial
UI pedestal or light field, transparent background, cinematic but clean,
share-card ready.

Negative: no NFT aesthetic, no game armor, no cartoon, no human figure,
no animal, no robot, no explicit imagery, no adult product, no circular badge
frame, no coin rim, no thick medallion, no sphere-only shape, no perfect teardrop,
no large spiral inside the belly, no huge central flower, no rigid atom model,
no text, no watermark.
```

### 4.2 填充示例(soft_glow_safe_start · 安心起步型)

```text
Create a premium 3D / 2.5D Galaxy Persona Entity for soft_glow_safe_start, 安心起步型,
inspired by M33 Triangulum Galaxy.

a soft translucent cosmic jelly-like soul body, not a clean teardrop, not symmetrical,
not geometric. The silhouette should be rounded, irregular, slightly squishy,
softly sagging, with a small lifted crest on the upper right, and gentle asymmetrical
bulges on the sides and lower body. It should feel alive, soft, floating, and emotionally warm.

Material:
semi-transparent glass-gel membrane, blue-violet and lilac outer refraction,
warm golden highlights on the rim, dark starfield interior, two small warm oval glowing eyes.
Keep the eyes exactly small, quiet, calm, and companion-like. No mouth. No cartoon expression.

Important composition rule:
the jelly soul body is the absolute hero.
Do not place a large spiral galaxy inside the body.
Do not place a large flower, cocoon, or giant glowing object in the belly.
Do not make the body a container for a galaxy.

Galaxy integration:
use M33 only as subtle surrounding and embedded accents.
Add delicate warm apricot and champagne-gold galaxy particles, tiny orbiting stardust
clusters, and soft glowing spiral traces around the outside of the body, especially
near the shoulders, upper back, and lower side edges.
The galaxy feeling should be mostly external and surrounding, like gentle orbiting
cosmic ribbons and drifting luminous particles.
Inside the body, only keep sparse star dust and a very faint warm core glow,
not a visible full galaxy.

Core:
a small, protected, seed-like warm light near the lower center inside the jelly body,
abstract and minimal, not a literal flower or cocoon.

Orbit:
two or three elegant, soft, asymmetrical galaxy ribbons orbiting around the outside
of the jelly body, partially behind it and partially crossing near the outer membrane,
with warm swirling cosmic accents, tiny glowing dust clusters, and soft incomplete
spiral traces. These orbit lines should feel organic and atmospheric, not thin
scientific atom rings, not perfect circles.

Halo:
a close, soft, warm translucent halo hugging the outer membrane, subtle and protective,
low-pressure, almost like a breathing aura.

Companion: no hidden-route companion visible in the base asset.

Pulse:
very slow, gentle breathing glow. The pulse should softly travel from the small
inner seed-light into the membrane and into the surrounding orbiting dust,
like trust slowly expanding outward.

Mood:
safe first step, gentle protection, low-pressure beginning, being cared for,
body slowly learning to trust, healing, intimate, premium, gender-neutral.

Color palette:
base membrane stays blue-violet and transparent,
with subtle warm apricot, champagne-gold, and soft ivory galaxy accents inspired by M33.
Do not let the whole body turn orange or gold.

Lighting: soft top-left key light, gentle ambient, studio product render.
Composition: centered floating galaxy persona entity, dark background,
clean premium product-shot framing, generous breathing room around the body.

Negative: no NFT aesthetic, no game armor, no cartoon, no human figure,
no animal, no robot, no mascot, no explicit imagery, no adult product,
no circular badge frame, no coin rim, no thick medallion, no sphere-only shape,
no perfect teardrop shape, no symmetric blob, no large galaxy inside the body,
no huge belly spiral, no large central flower, no lotus, no scientific atom model,
no rigid circular rings, no text, no logo, no watermark.
```

## 5. 输出规格

- 星系人格体:12 张,每张 1024×1024 PNG,透明底
- 分享卡:1080×1350 (4:5),人格体居左或居上三分之一,右侧/下方留给文字叠加层
- App icon 变体:512×512,几何化简版(方向 B 的纹章降级方案,可后续单出)
- 文件命名:`persona-entity-{variant_code}.png`;隐藏路线合成变体 `persona-entity-{variant_code}-{hidden_code}.png`

## 6. 一致性验收清单

每张生成图在并入集合前,逐项核对:

- [ ] 不像圆形徽章、纪念币、头像框或 NFT 勋章
- [ ] 主体必须保持统一母型的半透明星云果冻生命体:柔软不规则水滴轮廓、蓝紫玻璃外膜、深色星空内核、两枚暖光椭圆眼
- [ ] 主体轮廓必须具备轻微上扬的顶部、侧边不对称鼓起和“软塌但悬浮”的生命体感,不能被生成成标准水滴或对称史莱姆
- [ ] Core 占整体视觉重心 35%~50%,外围 Orbit/Halo 有空间呼吸感
- [ ] 星系参考主要来自外部 Orbit/Halo/边缘折射,重点是“环绕方式”,不是“把整团星系塞进主体里”
- [ ] 内部只允许少量星尘、弱星雾和小型种子光核,不允许出现一整个大旋涡星系、巨型花状光核或明显腹部主视觉
- [ ] 无人形剪影、盔甲、卡通、NFT / 加密币视觉套路
- [ ] 两枚暖光眼保留,但不能变成夸张表情、萌宠眼或卡通脸
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
