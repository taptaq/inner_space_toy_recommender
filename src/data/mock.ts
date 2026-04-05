export type Product = {
  id: string;
  name: string;
  price: number;
  maxDb: number;
  waterproof: number; // IPX level
  appearance: 'high_disguise' | 'normal';
  physicalForm: 'external' | 'internal' | 'composite';
  motorType: 'gentle' | 'strong';
  imagePlaceholder: string;
};

export const products: Product[] = [
  { id: '1', name: '星云之吻 (Nebula Kiss)', price: 89, maxDb: 40, waterproof: 7, appearance: 'high_disguise', physicalForm: 'external', motorType: 'gentle', imagePlaceholder: 'bg-gradient-to-br from-cyan-900/40 to-blue-900/40' },
  { id: '2', name: '暗物质 (Dark Matter)', price: 150, maxDb: 50, waterproof: 6, appearance: 'normal', physicalForm: 'internal', motorType: 'strong', imagePlaceholder: 'bg-gradient-to-br from-purple-900/40 to-indigo-900/40' },
  { id: '3', name: '引力波 (Gravity Wave)', price: 280, maxDb: 42, waterproof: 8, appearance: 'normal', physicalForm: 'composite', motorType: 'gentle', imagePlaceholder: 'bg-gradient-to-br from-teal-900/40 to-cyan-900/40' },
  { id: '4', name: '微星 (Micro Star)', price: 60, maxDb: 35, waterproof: 5, appearance: 'high_disguise', physicalForm: 'external', motorType: 'gentle', imagePlaceholder: 'bg-gradient-to-br from-blue-800/40 to-indigo-800/40' },
  { id: '5', name: '脉冲星 (Pulsar)', price: 199, maxDb: 48, waterproof: 7, appearance: 'normal', physicalForm: 'internal', motorType: 'strong', imagePlaceholder: 'bg-gradient-to-br from-indigo-900/40 to-purple-900/40' },
  { id: '6', name: '双子星 (Gemini)', price: 350, maxDb: 44, waterproof: 7, appearance: 'normal', physicalForm: 'composite', motorType: 'strong', imagePlaceholder: 'bg-gradient-to-br from-cyan-800/40 to-teal-800/40' },
  { id: '7', name: '旅行者 (Voyager)', price: 120, maxDb: 40, waterproof: 7, appearance: 'high_disguise', physicalForm: 'internal', motorType: 'gentle', imagePlaceholder: 'bg-gradient-to-br from-blue-900/40 to-purple-900/40' },
  { id: '8', name: '黑洞 (Black Hole)', price: 450, maxDb: 55, waterproof: 8, appearance: 'normal', physicalForm: 'composite', motorType: 'strong', imagePlaceholder: 'bg-gradient-to-br from-gray-900/40 to-slate-800/40' },
  { id: '9', name: '彗星 (Comet)', price: 95, maxDb: 45, waterproof: 6, appearance: 'normal', physicalForm: 'external', motorType: 'strong', imagePlaceholder: 'bg-gradient-to-br from-teal-800/40 to-blue-800/40' },
  { id: '10', name: '极光 (Aurora)', price: 220, maxDb: 38, waterproof: 7, appearance: 'high_disguise', physicalForm: 'external', motorType: 'gentle', imagePlaceholder: 'bg-gradient-to-br from-cyan-700/40 to-indigo-900/40' },
  { id: '11', name: '超新星 (Supernova)', price: 320, maxDb: 52, waterproof: 7, appearance: 'normal', physicalForm: 'composite', motorType: 'strong', imagePlaceholder: 'bg-gradient-to-br from-fuchsia-900/40 to-purple-900/40' },
  { id: '12', name: '量子跃迁 (Quantum Leap)', price: 180, maxDb: 42, waterproof: 8, appearance: 'high_disguise', physicalForm: 'internal', motorType: 'gentle', imagePlaceholder: 'bg-gradient-to-br from-blue-700/40 to-cyan-800/40' },
  { id: '13', name: '星尘 (Stardust)', price: 75, maxDb: 38, waterproof: 6, appearance: 'high_disguise', physicalForm: 'external', motorType: 'gentle', imagePlaceholder: 'bg-gradient-to-br from-slate-700/40 to-gray-800/40' },
  { id: '14', name: '深空 (Deep Space)', price: 299, maxDb: 46, waterproof: 7, appearance: 'normal', physicalForm: 'internal', motorType: 'strong', imagePlaceholder: 'bg-gradient-to-br from-indigo-950/40 to-blue-950/40' },
  { id: '15', name: '天狼星 (Sirius)', price: 150, maxDb: 40, waterproof: 7, appearance: 'high_disguise', physicalForm: 'composite', motorType: 'gentle', imagePlaceholder: 'bg-gradient-to-br from-cyan-600/40 to-teal-800/40' },
];

export type AnswerState = {
  physicalForm?: 'external' | 'internal' | 'composite';
  motorType?: 'gentle' | 'strong';
  maxDb?: number;
  waterproof?: number;
  budget?: [number, number];
  appearance?: 'high_disguise' | 'normal';
  tags: string[];
};

export const questions = [
  {
    id: 'q1',
    title: '探索倾向',
    subtitle: '你更期待哪种维度的内太空漫游？（提示：期望的刺激部位）',
    field: 'physicalForm',
    options: [
      { label: '外部星环的碰触（仅在外部震动/吮吸，不进入体重）', value: 'external', tag: '外部震动/吮吸' },
      { label: '深入核心的探索（纯入体，适合寻求充实与饱满感）', value: 'internal', tag: '纯入体' },
      { label: '内外维度的共振（内外同时刺激的复合机型）', value: 'composite', tag: '复合机型' },
    ]
  },
  {
    id: 'q2',
    title: '经验与敏感度',
    subtitle: '你的感官接收器处于什么状态？（提示：自身对刺激的敏感程度）',
    field: 'motorType',
    options: [
      { label: '信号敏锐（敏感易痛或纯新手，适合温柔电机）', value: 'gentle', tag: '温柔型电机' },
      { label: '需要强力能量注入（有经验或耐受度高，需要强力震感）', value: 'strong', tag: '强力型多频段' },
    ]
  },
  {
    id: 'q3',
    title: '听觉隐蔽',
    subtitle: '你的内太空舱隔音效果如何？（提示：使用环境是否怕吵到别人）',
    field: 'maxDb',
    options: [
      { label: '舱壁较薄，需航行静音（合租或宿舍，要求设备极低噪音）', value: 45, tag: '< 45dB' },
      { label: '独立空间，无惧轰鸣（独居或隔音好，无需顾虑设备声音）', value: 100, tag: '无限制分贝' },
    ]
  },
  {
    id: 'q4',
    title: '清洁与维护',
    subtitle: '航行结束后的清理偏好？（提示：由于体液残留，是否需要深度水洗）',
    field: 'waterproof',
    options: [
      { label: '直接在水流中冲洗净化（可能在浴室使用，需全身强力防水）', value: 7, tag: '≥ IPX7 防水' },
      { label: '简单的表面擦拭即可（用专用湿巾擦拭表面即可，基础防水）', value: 6, tag: '基础防水' },
    ]
  },
  {
    id: 'q5',
    title: '能源预算',
    subtitle: '为这次探索准备了多少能量储备？（提示：心理预期的价格区间）',
    field: 'budget',
    options: [
      { label: '轻量级（100元以内的基础尝鲜）', value: [0, 100], tag: '入门级' },
      { label: '标准级（100-300元的进阶品质）', value: [100, 300], tag: '进阶级' },
      { label: '探索级（300元以上的旗舰体验）', value: [300, 10000], tag: '旗舰级' },
    ]
  },
  {
    id: 'q6',
    title: '视觉隐蔽',
    subtitle: '装备是否需要伪装形态？（提示：被室友或家人看到是否会社会性死亡）',
    field: 'appearance',
    options: [
      { label: '需要伪装（造型像口红、化妆盒等日常物品，绝对隐匿）', value: 'high_disguise', tag: '高伪装' },
      { label: '保持科技形态（藏得很严实或独居，造型夸张也无所谓）', value: 'normal', tag: '无伪装限制' },
    ]
  }
];
