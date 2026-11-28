// 点点星球 v6 —— 每星球独立数值 / 星核共振 / 星尘连锁 / 独立成就
// 阅读顺序：1 配置 → 2 状态 → 3 计算 → 4 存档 → 5 天气时间
//          → 6 场景与点击（含连锁） → 7 列表与图鉴 → 8 购买/身份/跃迁
//          → 9 星核共振 → 10 成就 → 11 渲染 → 12 启动
(() => {
  'use strict';

  // 数字单位表：必须放在最前面，fmt() 在构建星球数据时就会被调用
  // 一直排到「极」，再往上用科学计数（双精度能表示到 1.8e308）
  const BIG_UNITS = [
    [1e48, '极'],
    [1e44, '载'],
    [1e40, '正'],
    [1e36, '涧'],
    [1e32, '沟'],
    [1e28, '穰'],
    [1e24, '秭'],
    [1e20, '垓'],
    [1e16, '京'],
    [1e12, '万亿']
  ];

  /* ===================== 1. 配置 ===================== */

  const SAVE_KEY = 'aiweb.clicker.v4';
  const SAVE_BAK = 'aiweb.clicker.v4.bak'; // 上一次的完整存档，主存档坏了能退回去
  const SAVE_BAD = 'aiweb.clicker.v4.broken'; // 解析失败的原始文本，留着人工抢救
  // 读档按顺序找，新版本永远不要改 SAVE_KEY，只往这个列表前面加
  const SAVE_KEYS = [
    'aiweb.clicker.v6',
    'aiweb.clicker.v5',
    'aiweb.clicker.v4',
    'aiweb.clicker.v3',
    'aiweb.clicker.v2',
    'aiweb.clicker.v1'
  ];
  const WX_KEY = 'aiweb.clicker.wx.v1';
  const CITY_KEY = 'aiweb.clicker.city.v1';
  const LOC_KEY = 'aiweb.clicker.loc.v1';
  const INTRO_KEY = 'aiweb.clicker.intro.v1';

  const AUTOSAVE_MS = 5000;
  const OFFLINE_CAP_MS = 12 * 3600 * 1000;
  const CRIT_MULTI = 3; // 暴击倍率
  const RANK_CLICK = 1.5; // 晋升后点击力乘多少
  const RANK_CPS = 0.25; // 晋升后自动产出加多少
  const CRIT_CAP = 0.35; // 暴击率上限
  const CLICK_LIMIT = 16; // 每秒最多算这么多次点击（防连点器）
  const CHAIN_WINDOW = 1500; // 连击窗口（毫秒）
  const RESO_MAX = 8; // 星核共振最高层数
  const RESO_STEP = 0.07; // 每层共振的全产出加成
  const RESO_DECAY_MS = 22000; // 多久没共振成功掉一层
  const WX_TTL = 8 * 60 * 1000; // 天气缓存有效期

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  // 每颗星球：gain 收益倍率；升级/资产/共振门槛/成就全部独立
  // kind: click 点击 / cps 每秒 / crit 暴击率 / mult 全部产出加成
  /* ===================== 1.5 星球数据 =====================
     十颗星球 × 9 个身份 × 10 项升级。每颗星球的「收益倍率」和
     「物价」一起翻倍，所以节奏一致，只换皮和绝对数字。
     ======================================================= */

  const RANK_SETS = [
    [
      { name: '拾尘者', icon: '🌫️' },
      { name: '星尘学徒', icon: '🌱' },
      { name: '街角名人', icon: '✨' },
      { name: '有车一族', icon: '🚗' },
      { name: '有房一族', icon: '🏠' },
      { name: '星际商人', icon: '💼' },
      { name: '星系名流', icon: '🌟' },
      { name: '月面巨富', icon: '💎' },
      { name: '星尘君王', icon: '👑' }
    ],
    [
      { name: '火花', icon: '🔥' },
      { name: '熔炉工', icon: '⚒️' },
      { name: '星火骑士', icon: '🐉' },
      { name: '火焰车神', icon: '🏎️' },
      { name: '熔岩豪宅主', icon: '🏡' },
      { name: '火山大亨', icon: '🌋' },
      { name: '星火之王', icon: '👑' },
      { name: '不灭薪王', icon: '♨️' },
      { name: '太阳领主', icon: '☀️' }
    ],
    [
      { name: '冰晶', icon: '❄️' },
      { name: '雪原旅人', icon: '🧊' },
      { name: '寒霜骑士', icon: '🗡️' },
      { name: '极光车手', icon: '🌌' },
      { name: '冰宫主人', icon: '🏰' },
      { name: '寒霜女皇', icon: '👸' },
      { name: '永夜守望', icon: '🌑' },
      { name: '极地星神', icon: '🧿' },
      { name: '永冻之主', icon: '🪙' }
    ],
    [
      { name: '孢子', icon: '🍃' },
      { name: '林间行者', icon: '🚶' },
      { name: '藤蔓术士', icon: '🌿' },
      { name: '兽群之主', icon: '🐾' },
      { name: '绿洲城主', icon: '🌳' },
      { name: '生命贤者', icon: '🧙' },
      { name: '世界树使', icon: '🌍' },
      { name: '森罗万象', icon: '🪷' },
      { name: '丛林星神', icon: '🐲' }
    ]
  ];

  const UP_NAMES = [
    [
      '星尘手指',
      '采集无人机',
      '幸运符',
      '星核反应堆',
      '引力透镜',
      '共鸣棱镜',
      '反物质引擎',
      '星尘矩阵',
      '恒星熔炉',
      '奇点反应堆'
    ],
    [
      '熔岩指尖',
      '火种无人机',
      '烈焰幸运符',
      '熔炉反应堆',
      '岩浆透镜',
      '火山共鸣',
      '等离子引擎',
      '烈焰矩阵',
      '恒星锻炉',
      '超新星核心'
    ],
    [
      '冰锥指尖',
      '霜翼无人机',
      '极光幸运符',
      '冰核反应堆',
      '寒冰透镜',
      '极光共鸣',
      '零度引擎',
      '霜蓝矩阵',
      '寒潮熔炉',
      '绝对零度核心'
    ],
    [
      '藤蔓指尖',
      '叶脉无人机',
      '生命幸运符',
      '生命树反应堆',
      '光合透镜',
      '翡翠共鸣',
      '年轮引擎',
      '翡翠矩阵',
      '世界树熔炉',
      '创世种子'
    ]
  ];

  // base 是本星球 need0 的比例；amount 是本档位每级加多少产出。
  // 全产出加成两档合计最多约 ×7，不再出现 ×100 的逆天倍率。
  const UP_TIERS = [
    { kind: 'click', amount: 1, base: 0.03, growth: 1.16, max: 600 },
    { kind: 'cps', amount: 1, base: 0.15, growth: 1.17, max: 2500 },
    { kind: 'crit', amount: 0.03, base: 0.8, growth: 3.0, max: 8 },
    { kind: 'cps', amount: 4, base: 3, growth: 1.18, max: 2500 },
    { kind: 'cps', amount: 20, base: 12, growth: 1.19, max: 2500 },
    { kind: 'mult', amount: 0.05, base: 45, growth: 1.42, max: 60 },
    { kind: 'cps', amount: 120, base: 160, growth: 1.2, max: 2500 },
    { kind: 'mult', amount: 0.08, base: 600, growth: 1.48, max: 40 },
    { kind: 'cps', amount: 700, base: 2200, growth: 1.21, max: 2500 },
    { kind: 'cps', amount: 4000, base: 8000, growth: 1.22, max: 2500 }
  ];

  const ASSET_SETS = [
    [
      { name: '小汽车', icon: '🚗', rep: 10 },
      { name: '跑车', icon: '🏎️', rep: 30 },
      { name: '公寓', icon: '🏢', rep: 60 },
      { name: '豪华跑车', icon: '🚙', rep: 120 },
      { name: '别墅', icon: '🏡', rep: 400 },
      { name: '星际豪宅', icon: '🛸', rep: 1500 },
      { name: '私人空间站', icon: '🛰️', rep: 4000 }
    ],
    [
      { name: '熔岩摩托', icon: '🏍️', rep: 10 },
      { name: '火焰跑车', icon: '🏎️', rep: 30 },
      { name: '熔岩公寓', icon: '🏢', rep: 60 },
      { name: '火山飞机', icon: '✈️', rep: 120 },
      { name: '岩浆别墅', icon: '🏡', rep: 400 },
      { name: '火山宫殿', icon: '🏰', rep: 1500 },
      { name: '恒星级熔炉', icon: '🌋', rep: 4000 }
    ],
    [
      { name: '冰原雪橇', icon: '🛷', rep: 10 },
      { name: '极光跑车', icon: '🚘', rep: 30 },
      { name: '冰晶公寓', icon: '🧊', rep: 60 },
      { name: '霜翼飞机', icon: '🛩️', rep: 120 },
      { name: '冰宫', icon: '🏰', rep: 400 },
      { name: '极光城堡', icon: '🌌', rep: 1500 },
      { name: '永冻方舟', icon: '🚢', rep: 4000 }
    ],
    [
      { name: '藤蔓滑板', icon: '🛹', rep: 10 },
      { name: '森林飞车', icon: '🚙', rep: 30 },
      { name: '树屋公寓', icon: '🌳', rep: 60 },
      { name: '翡翠飞船', icon: '🛸', rep: 120 },
      { name: '树冠圣殿', icon: '🏛️', rep: 400 },
      { name: '世界树宫殿', icon: '🌍', rep: 1500 },
      { name: '生命方舟', icon: '🌱', rep: 4000 }
    ]
  ];

  // 资产：买一件一个价，价格恒定不变，件数也不设上限（0 = 无限）。
  // 声望需求后期很大，靠「每件固定 +N 声望」慢慢买就行，不会卡在 10 件。
  const ASSET_COST_SHARE = [0.0001, 0.0004, 0.0009, 0.002, 0.004, 0.009, 0.02];
  const ASSET_REP_SHARE = [0.01, 0.02, 0.035, 0.055, 0.08, 0.11, 0.16];
  const ASSET_MAX = 0;
  // 声望门槛的形状（第 8 个身份归一为 1），再按星球的资产购买力缩放，
  // 这样每颗星球「要买多少资产」的比例一致，不会因为数值变小而买不起。
  const REP_SHAPE = [0, 0.0007, 0.003, 0.01, 0.03, 0.08, 0.2, 0.47, 1];
  const repNeed = (i, meta) =>
    Math.max(0, Math.round(0.04 * Math.pow(meta.ratio, 8) * REP_SHAPE[i]));
  const RESO_SETS = [
    [0, 0, 1, 1, 2, 2, 3, 4, 5],
    [0, 1, 1, 2, 2, 3, 4, 5, 6],
    [0, 1, 2, 2, 3, 4, 5, 6, 7],
    [0, 1, 2, 3, 3, 4, 5, 6, 8]
  ];
  // 宠物战力门槛：第 1 颗星球为 0，之后每颗星球的后期身份要用宠物战力
  const PET_NEED = [
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 30, 90, 240],
    [0, 0, 0, 0, 0, 180, 480, 960, 1800],
    [0, 0, 0, 0, 0, 540, 1500, 3600, 7200],
    [0, 0, 0, 0, 0, 960, 2500, 5400, 10800],
    [0, 0, 0, 0, 0, 1440, 3600, 7800, 15600]
  ];
  // 星章门槛：小游戏打出来的
  const BADGE_NEED = [
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 2, 3, 4],
    [0, 0, 0, 0, 0, 3, 5, 8, 12]
  ];

  /* ---- 第 5、6 颗星球：量子 / 虚空 ---- */
  RANK_SETS.push(
    [
      { name: '量子沫', icon: '⚛️' },
      { name: '观测者', icon: '🔭' },
      { name: '纠缠行者', icon: '🌀' },
      { name: '超导骑士', icon: '⚡' },
      { name: '虫洞领航', icon: '🕳️' },
      { name: '量子富豪', icon: '💠' },
      { name: '时空织者', icon: '🧵' },
      { name: '薛定谔之主', icon: '🐈' },
      { name: '量子之神', icon: '🌌' }
    ],
    [
      { name: '虚无', icon: '🕳️' },
      { name: '熵之信徒', icon: '🌫️' },
      { name: '寂静行者', icon: '👤' },
      { name: '暗物质君王', icon: '🖤' },
      { name: '黑洞领主', icon: '⚫' },
      { name: '维度吞噬者', icon: '🐙' },
      { name: '终焉守望', icon: '🕯️' },
      { name: '虚空主宰', icon: '👁️' },
      { name: '万有归零', icon: '♾️' }
    ]
  );
  UP_NAMES.push(
    [
      '量子指尖',
      '概率无人机',
      '纠缠幸运符',
      '量子反应堆',
      '观测透镜',
      '退相干棱镜',
      '虫洞引擎',
      '叠加矩阵',
      '时空熔炉',
      '量子奇点'
    ],
    [
      '虚空触须',
      '熵流无人机',
      '寂静幸运符',
      '虚无反应堆',
      '黑洞透镜',
      '终焉共鸣',
      '维度引擎',
      '虚空矩阵',
      '永恒熔炉',
      '归零核心'
    ]
  );
  ASSET_SETS.push(
    [
      { name: '量子滑板', icon: '🛹', rep: 10 },
      { name: '纠缠机车', icon: '🏍️', rep: 30 },
      { name: '叠加公寓', icon: '🏢', rep: 60 },
      { name: '概率飞机', icon: '✈️', rep: 120 },
      { name: '虫洞别墅', icon: '🏡', rep: 400 },
      { name: '时空城堡', icon: '🏰', rep: 1500 },
      { name: '量子方舟', icon: '🚀', rep: 4000 }
    ],
    [
      { name: '虚空浮舟', icon: '🛶', rep: 10 },
      { name: '熵流战车', icon: '🚙', rep: 30 },
      { name: '寂灭居所', icon: '⬛', rep: 60 },
      { name: '维度穿梭机', icon: '🛸', rep: 120 },
      { name: '黑洞宫殿', icon: '🏯', rep: 400 },
      { name: '终焉圣殿', icon: '⛩️', rep: 1500 },
      { name: '万有归零环', icon: '♾️', rep: 4000 }
    ]
  );
  /* ---- 第 7–10 颗星球：曜金 / 幻梦 / 时序 / 终焉（难度再往上加） ---- */
  RANK_SETS.push(
    [
      { name: '铜板', icon: '🪙' },
      { name: '钱袋', icon: '👝' },
      { name: '账房先生', icon: '🧮' },
      { name: '商号掌柜', icon: '🏪' },
      { name: '银行东家', icon: '🏦' },
      { name: '金库主人', icon: '🔐' },
      { name: '黄金公爵', icon: '👑' },
      { name: '财富之神', icon: '💎' },
      { name: '曜金之主', icon: '🌟' }
    ],
    [
      { name: '微梦', icon: '💭' },
      { name: '梦境旅人', icon: '🚶' },
      { name: '织梦者', icon: '🧵' },
      { name: '夜航人', icon: '⛵' },
      { name: '梦魇骑士', icon: '🐴' },
      { name: '浮世诗人', icon: '📜' },
      { name: '幻境领主', icon: '🏯' },
      { name: '千年梦主', icon: '🌸' },
      { name: '梦之尽头', icon: '🌙' }
    ],
    [
      { name: '秒针', icon: '⏱️' },
      { name: '滴漏', icon: '💧' },
      { name: '记时者', icon: '📆' },
      { name: '逆流者', icon: '🌊' },
      { name: '沙漏守卫', icon: '⏳' },
      { name: '时序学士', icon: '📚' },
      { name: '时间长河', icon: '🌌' },
      { name: '永恒钟摆', icon: '🕰️' },
      { name: '时间之主', icon: '🕛' }
    ],
    [
      { name: '微尘', icon: '✨' },
      { name: '余烬', icon: '🔥' },
      { name: '拾荒者', icon: '🧺' },
      { name: '边界行者', icon: '🚶' },
      { name: '归零信徒', icon: '🕯️' },
      { name: '寂静之王', icon: '🤫' },
      { name: '终末观测者', icon: '🔭' },
      { name: '万物终章', icon: '📖' },
      { name: '无始无终', icon: '♾️' }
    ]
  );
  UP_NAMES.push(
    [
      '铜币指尖',
      '金蚁无人机',
      '财运护符',
      '金库反应堆',
      '水晶透镜',
      '金脉共鸣',
      '熔金引擎',
      '黄金矩阵',
      '财富熔炉',
      '聚宝奇点'
    ],
    [
      '梦指尖',
      '浮梦无人机',
      '摇篮护符',
      '梦境反应堆',
      '月镜透镜',
      '夜歌共鸣',
      '幻影引擎',
      '梦境矩阵',
      '永眠熔炉',
      '梦核奇点'
    ],
    [
      '秒针指尖',
      '滴漏无人机',
      '沙漏护符',
      '时轮反应堆',
      '钟摆透镜',
      '逆流共鸣',
      '时序引擎',
      '时间矩阵',
      '永劫熔炉',
      '归零钟塔'
    ],
    [
      '余烬指尖',
      '灰烬无人机',
      '残页护符',
      '终结反应堆',
      '黑镜透镜',
      '静默共鸣',
      '终焉引擎',
      '终焉矩阵',
      '终末熔炉',
      '无始核心'
    ]
  );
  ASSET_SETS.push(
    [
      { name: '铜板袋', icon: '👝', rep: 10 },
      { name: '账房马车', icon: '🐎', rep: 30 },
      { name: '商号大楼', icon: '🏦', rep: 60 },
      { name: '私人飞机', icon: '✈️', rep: 120 },
      { name: '金库别墅', icon: '🏡', rep: 400 },
      { name: '黄金城堡', icon: '🏰', rep: 1500 },
      { name: '曜金浮岛', icon: '🏝️', rep: 4000 }
    ],
    [
      { name: '梦枕', icon: '🛏️', rep: 10 },
      { name: '夜航列车', icon: '🚂', rep: 30 },
      { name: '浮空楼阁', icon: '🏯', rep: 60 },
      { name: '梦境飞艇', icon: '🎈', rep: 120 },
      { name: '月下宫殿', icon: '🌛', rep: 400 },
      { name: '梦之圣殿', icon: '🕍', rep: 1500 },
      { name: '永梦方舟', icon: '⛵', rep: 4000 }
    ],
    [
      { name: '沙漏', icon: '⏳', rep: 10 },
      { name: '时轮单车', icon: '🚲', rep: 30 },
      { name: '钟塔公寓', icon: '🕰️', rep: 60 },
      { name: '逆流飞机', icon: '🛩️', rep: 120 },
      { name: '永时城堡', icon: '🏰', rep: 400 },
      { name: '时间圣殿', icon: '⛩️', rep: 1500 },
      { name: '纪元方舟', icon: '🚀', rep: 4000 }
    ],
    [
      { name: '纸船', icon: '⛵', rep: 10 },
      { name: '灰烬战车', icon: '🚙', rep: 30 },
      { name: '寂静小居', icon: '🏚️', rep: 60 },
      { name: '黑洞飞船', icon: '🛸', rep: 120 },
      { name: '终焉宫殿', icon: '🏯', rep: 400 },
      { name: '归零圣所', icon: '🕯️', rep: 1500 },
      { name: '无始之环', icon: '♾️', rep: 4000 }
    ]
  );
  RESO_SETS.push(
    [0, 1, 2, 3, 3, 4, 5, 6, 7],
    [0, 1, 2, 3, 4, 4, 5, 6, 7],
    [0, 1, 2, 3, 4, 5, 5, 6, 7],
    [0, 1, 2, 3, 4, 5, 6, 6, 7],
    [0, 1, 2, 3, 4, 5, 6, 7, 7],
    [0, 1, 2, 3, 4, 5, 6, 7, 8]
  );
  BADGE_NEED.push(
    [0, 0, 0, 0, 0, 4, 7, 10, 14],
    [0, 0, 0, 0, 0, 5, 9, 13, 18],
    [0, 0, 0, 0, 0, 5, 8, 12, 16],
    [0, 0, 0, 0, 0, 6, 9, 14, 18],
    [0, 0, 0, 0, 0, 6, 10, 15, 20],
    [0, 0, 0, 0, 0, 7, 11, 16, 22]
  );
  PET_NEED.push(
    [0, 0, 0, 0, 0, 1800, 4200, 9000, 18000],
    [0, 0, 0, 0, 0, 2100, 5000, 10500, 21000],
    [0, 0, 0, 0, 0, 2400, 5600, 12000, 24000],
    [0, 0, 0, 0, 0, 2700, 6300, 13500, 27000]
  );

  /* 十颗星球。三件事决定节奏：
     - need0 本星球第一个身份的星尘门槛（每颗星球数字都不同）
     - ratio 每升一个身份，门槛乘多少（越大越慢）
     - gain  内部物价与收入系数（不对外显示，只用来换算绝对值）
     目标：第 1 颗约 30 分钟，十颗全部约 25 小时（积极点击，不含挂机）。 */
  const WORLD_META = [
    { name: '月亮', emoji: '🌕', need0: 300, ratio: 3.22 },
    { name: '地球', emoji: '🌍', need0: 700, ratio: 3.74 },
    { name: '土星', emoji: '🪐', need0: 1600, ratio: 4.24 },
    { name: '太阳', emoji: '☀️', need0: 3600, ratio: 4.7 },
    { name: '中子星', emoji: '💫', need0: 8000, ratio: 5.1 },
    { name: '黑洞', emoji: '🕳️', need0: 18000, ratio: 5.45 },
    { name: '曜金星球', emoji: '💰', need0: 40000, ratio: 5.7 },
    { name: '幻梦星球', emoji: '🌙', need0: 90000, ratio: 5.9 },
    { name: '时序星球', emoji: '⏳', need0: 200000, ratio: 6.05 },
    { name: '终焉星球', emoji: '♾️', need0: 440000, ratio: 6.12 }
  ];

  // 第 i 个身份要的累计星尘：40 × ratio^i × 星球倍率
  const DUST_NEED = (i, meta) => Math.round(meta.need0 * Math.pow(meta.ratio, i));

  // 第 1 颗星球保持原样；后面每颗的身份门槛再乘以这个系数。
  // 只拉长身份线（星尘/声望/市值），升级价格和倍率都不动，所以玩起来不会更爽，只会更久。
  const RANK_SLOW = [1, 1.8, 2.25, 2.8, 3.5, 4.4, 5.5, 6.9, 8.6, 10.7];
  const slowOf = wi => RANK_SLOW[wi] || RANK_SLOW[RANK_SLOW.length - 1];

  /* 后期身份加码：前 5 个身份（i ≤ 4）门槛完全不动，第 6 个起按 (i-4)/4 的
     1.8 次方向上抬，一直到第 9 个身份。
     END_SCALE = 5 × 2.8^wi：第 1 颗末级只放大 5 倍，第 10 颗放大到 5.3 万倍，
     所以终焉星球的最后一个身份落在几十「京」这个量级，而前期手感不受影响。
     资产价格、股市门槛、跃迁门槛都不吃这个系数，声望另用 rankRepBoost 压住。 */
  const rankEndScale = wi => 5 * Math.pow(2.8, wi);
  const rankBoost = (i, wi) => {
    const t = Math.max(0, Math.min(1, (i - 4) / 4));
    return 1 + (rankEndScale(wi) - 1) * Math.pow(t, 1.8);
  };
  // 声望只能靠买资产凑（上限约为基础 rep8 的 4.7 倍），所以声望门槛单独压到 4 倍以内，
  // 否则后期会变成「星尘够了、声望永远买不满」的死锁。
  const rankRepBoost = b => Math.min(4.0, Math.pow(b, 0.35));

  /* 玩法按星球逐步开放：一开始只有点击、升级、资产、身份，
     越往后才出现共振、小游戏、股市、宠物、挂机。 */
  // 玩法按星球依次开放：宠物从开局就带着（每颗星球都有自己的伙伴），
  // 其余玩法依次在第 2/3/4 颗解锁，第 6 颗解锁挂机后全部开放。
  const FEAT_MIN = { reso: 1, mini: 2, stock: 3, pets: 0, idle: 5 };
  // 升级/资产也从少到多：第 1 颗只有 4 项升级、3 项资产，越往后越多
  const openUpgrades = () => Math.min(10, 4 + state.world);
  const openAssets = () => 7;
  const FEAT_NAMES = {
    reso: '星核共振',
    mini: '小游戏',
    stock: '股市',
    pets: '宠物',
    idle: '挂机'
  };
  const unlocked = id => state.world >= (FEAT_MIN[id] || 0);

  function upDesc(t, gain) {
    if (t.kind === 'click') return '每次点击 +' + t.amount + '（再乘本星球系数）';
    if (t.kind === 'cps') return '每秒 +' + t.amount + ' 星尘（再乘本星球倍率）';
    if (t.kind === 'crit') return '暴击率 +' + Math.round(t.amount * 100) + '%（×3 收益）';
    return '全部产出 +' + Math.round(t.amount * 100) + '%';
  }

  // 成就模板：每颗星球一套，尽量覆盖各个玩法
  function makeAchs(wi, gain) {
    const base = [
      {
        id: 'start',
        name: '落脚',
        desc: wi === 0 ? '第一次点星球' : '跃迁到' + WORLD_META[wi].name,
        reward: 50 * Math.pow(10, wi),
        ok: () => state.world > wi || state.wclicks > 0
      }
    ];
    base.push(
      {
        id: 'chain',
        name: '手感渐热',
        desc: '达成 ' + 25 * (wi + 1) + ' 连击',
        reward: 120 * Math.pow(10, wi),
        ok: () => state.comboBest >= 25 * (wi + 1)
      },
      {
        id: 'reso',
        name: '共振入门',
        desc: '把星核共振推到 ' + (3 + wi) + ' 层',
        reward: 300 * Math.pow(10, wi),
        ok: () => state.reso >= 3 + wi || state.resoBest >= 3 + wi
      },
      {
        id: 'mini',
        name: '会玩小游戏',
        desc: '小游戏累计胜利 3 次',
        reward: 500 * Math.pow(10, wi),
        ok: () => state.mini.wins >= 3
      },
      {
        id: 'stock',
        name: '第一桶金',
        desc: '股票持仓市值达到 ' + fmt(1e5 * gain) + ' 星尘',
        reward: 800 * Math.pow(10, wi),
        ok: () => capitalTop() >= 1e5 * gain
      },
      {
        id: 'pets',
        name: '宠物出勤',
        desc: '让宠物完成 3 次探索',
        reward: 1200 * Math.pow(10, wi),
        ok: () => wi >= FEAT_MIN.pets && state.pets.done >= 3
      },
      {
        id: 'petlv',
        name: '养得不错',
        desc: '任意一只宠物到 Lv.5',
        reward: 900 * Math.pow(10, wi),
        ok: () =>
          wi >= FEAT_MIN.pets &&
          Object.keys(state.pets.owned).some(k => state.pets.owned[k].lv >= 5)
      },
      {
        id: 'skins',
        name: '换个毛色',
        desc: '收藏本星球任意 1 款皮肤',
        reward: 1500 * Math.pow(10, wi),
        ok: () => wi >= FEAT_MIN.pets && Object.keys(state.pets.skins || {}).length > 0
      },
      {
        id: 'done',
        name: '星球毕业',
        desc: '拿满本星球全部身份',
        reward: 5000 * Math.pow(10, wi),
        ok: () => state.worldDone
      }
    );
    return base;
  }

  const WORLDS = WORLD_META.map((meta, wi) => {
    const need0 = meta.need0;
    const gain = need0 / 300;
    // 门槛只在对应玩法解锁之后才生效，否则会卡死在没开放的系统上
    const hasReso = wi >= FEAT_MIN.reso;
    const hasMini = wi >= FEAT_MIN.mini;
    const hasStock = wi >= FEAT_MIN.stock;
    const hasPets = wi >= FEAT_MIN.pets;
    const slow = slowOf(wi);
    // 本星球最后一个身份的星尘/声望门槛，资产的价格与声望都按这个尺度换算
    const dust8 = Math.round(DUST_NEED(8, meta) * slow);
    const rep8 = Math.round(repNeed(8, meta) * slow);
    const ranks = RANK_SETS[wi].map((r, i) => {
      const b = rankBoost(i, wi);
      return {
        name: r.name,
        icon: r.icon,
        dust: Math.round(DUST_NEED(i, meta) * slow * b),
        rep: Math.round(repNeed(i, meta) * slow * rankRepBoost(b)),
        cap: hasStock && i >= 5 ? Math.round(DUST_NEED(i, meta) * 0.02 * slow) : 0,
        pet: hasPets ? PET_NEED[wi][i] : 0,
        badge: hasMini ? BADGE_NEED[wi][i] : 0
      };
    });
    const upgrades = UP_TIERS.map((t, k) => ({
      id: 'u' + k,
      name: UP_NAMES[wi][k],
      desc:
        k === 1
          ? '每秒 +' + t.amount + ' 星尘 · 每升 1 级多 1 架采集无人机（最多 8 架亮相）'
          : upDesc(t, gain),
      base: Math.round(t.base * need0),
      growth: t.growth,
      max: t.max,
      kind: t.kind,
      amount: t.amount
    }));
    const assets = ASSET_SETS[wi].map((a, k) => ({
      id: 'a' + k,
      name: a.name,
      icon: a.icon,
      base: Math.max(1, Math.round(dust8 * ASSET_COST_SHARE[k])),
      growth: 1,
      max: ASSET_MAX,
      rep: Math.max(1, Math.round(rep8 * ASSET_REP_SHARE[k]))
    }));
    return {
      name: meta.name,
      emoji: meta.emoji,
      gain: gain,
      need0: need0,
      gate: Math.round(DUST_NEED(8, meta) * 0.25),
      resoNeed: hasReso ? RESO_SETS[wi] : RESO_SETS[wi].map(() => 0),
      ranks: ranks,
      upgrades: upgrades,
      assets: assets,
      achs: makeAchs(wi, gain)
    };
  });

  // 全局成就：跨星球只解锁一次
  const GLOBAL_ACHS = [
    {
      id: 'g_world2',
      name: '第二颗星球',
      desc: '跃迁到第二颗星球',
      reward: 50000,
      ok: () => state.world >= 1
    },
    {
      id: 'g_rain',
      name: '雨中漫步',
      desc: '在雨天打开游戏',
      reward: 300,
      ok: () => /rain|drizzle|thunder|shower/.test(wx.kind)
    },
    {
      id: 'g_night',
      name: '夜观星象',
      desc: '在夜里打开游戏',
      reward: 300,
      ok: () => SceneKit.timeInfo().phase === 'night'
    },
    {
      id: 'g_c5000',
      name: '手指发烫',
      desc: '累计点击 5000 次',
      reward: 2000,
      ok: () => state.clicks >= 5000
    },
    {
      id: 'g_combo',
      name: '连锁狂人',
      desc: '任意一次达成 100 连击',
      reward: 10000,
      ok: () => state.comboBest >= 100
    },
    {
      id: 'g_reso',
      name: '共振老手',
      desc: '累计共振成功 50 次',
      reward: 20000,
      ok: () => state.resoHits >= 50
    },
    {
      id: 'g_trade',
      name: '职业股民',
      desc: '股市累计成交 200 笔',
      reward: 200000,
      ok: () => state.stats && state.stats.trades >= 200
    },
    {
      id: 'g_cap',
      name: '资本玩家',
      desc: '股票持仓市值达到 1 亿',
      reward: 800000,
      ok: () => capitalTop() >= 1e8
    },
    {
      id: 'g_exp',
      name: '探索队',
      desc: '宠物累计完成 20 次探索',
      reward: 300000,
      ok: () => state.pets && state.pets.done >= 20
    },
    {
      id: 'g_petall',
      name: '毛茸茸的家',
      desc: '在不同星球收养 6 只宠物',
      reward: 600000,
      ok: () => Object.keys(state.pets ? state.pets.owned : {}).length >= 6
    },
    {
      id: 'g_skin',
      name: '衣橱收藏家',
      desc: '收藏 6 款宠物皮肤',
      reward: 800000,
      ok: () => Object.keys(state.pets ? state.pets.skins : {}).length >= 6
    },
    {
      id: 'g_badge',
      name: '星章收藏家',
      desc: '拿到 10 枚星章',
      reward: 500000,
      ok: () => state.mini && state.mini.badges >= 10
    },
    {
      id: 'g_mini',
      name: '小游戏高手',
      desc: '小游戏累计胜利 30 次',
      reward: 400000,
      ok: () => state.mini && state.mini.wins >= 30
    },
    {
      id: 'g_idle',
      name: '挂机也是玩',
      desc: '离线挂机累计收入 1 亿',
      reward: 200000,
      ok: () => state.stats && state.stats.idleDust >= 1e8
    },
    {
      id: 'g_clear',
      name: '全剧终',
      desc: '通关全部十颗星球',
      reward: 50000000,
      ok: () => state.cleared
    }
  ];

  // 天气城市（手动选择；默认用网络 IP 自动定位）
  const CITIES = [
    { name: '北京', lat: 39.9, lon: 116.41 },
    { name: '上海', lat: 31.23, lon: 121.47 },
    { name: '广州', lat: 23.13, lon: 113.26 },
    { name: '深圳', lat: 22.54, lon: 114.06 },
    { name: '成都', lat: 30.57, lon: 104.07 },
    { name: '杭州', lat: 30.27, lon: 120.15 },
    { name: '武汉', lat: 30.59, lon: 114.3 },
    { name: '西安', lat: 34.34, lon: 108.94 },
    { name: '南京', lat: 32.06, lon: 118.8 },
    { name: '重庆', lat: 29.56, lon: 106.55 },
    { name: '天津', lat: 39.08, lon: 117.2 },
    { name: '长沙', lat: 28.23, lon: 112.94 },
    { name: '青岛', lat: 36.07, lon: 120.38 },
    { name: '沈阳', lat: 41.81, lon: 123.43 },
    { name: '哈尔滨', lat: 45.8, lon: 126.53 },
    { name: '郑州', lat: 34.75, lon: 113.62 },
    { name: '昆明', lat: 25.04, lon: 102.72 },
    { name: '乌鲁木齐', lat: 43.83, lon: 87.62 },
    { name: '拉萨', lat: 29.65, lon: 91.14 },
    { name: '香港', lat: 22.32, lon: 114.17 },
    { name: '台北', lat: 25.03, lon: 121.57 }
  ];

  /* ===================== 2. 状态 ===================== */

  const newState = () => ({
    dust: 0, // 当前星尘
    total: 0, // 本星球累计获得（身份看这个）
    clicks: 0, // 总点击（跨星球）
    wclicks: 0, // 本星球点击
    world: 0,
    levels: {},
    assets: {},
    rank: 0,
    worldDone: false,
    ach: {},
    guideSeen: false,
    cleared: false,
    startedAt: Date.now(),
    lastSave: Date.now(),
    comboBest: 0,
    reso: 0, // 星核共振层数
    resoBest: 0, // 本星球最高层数
    resoHits: 0, // 累计共振成功次数
    resoMiss: 0, // 累计失误
    resoLastAt: 0, // 上次共振时间（衰减用）

    // ===== 跨星球保留的四大系统 =====
    mini: { day: '', today: 0, wins: 0, plays: 0, badges: 0, best: {} },
    stocks: {
      hold: {},
      cost: {},
      prices: {},
      news: [],
      newsAt: 0,
      divAt: 0,
      profit: 0,
      tradeAt: 0,
      // 每颗星球见过的最高持仓市值（按星球分开存，跃迁不会带到下一颗白送身份）
      capBest: {},
      // 每颗星球「投进股市的本金净额」：买入加、卖出按成本比例减。
      // 身份判定要用它，卖掉以后这个数跟着降，所以同样按星球分开存。
      invest: {},
      // 跃迁到这颗星球那一刻带进来的持仓市值，算浮盈时要扣掉它（防白送身份）
      base: {}
    },
    pets: {
      owned: {},
      exps: [null, null, null],
      done: 0,
      skins: {},
      pat: {},
      migrated: false,
      // 每颗星球见过的最高宠物战力
      powerBest: {}
    },
    idle: { core: 0, auto: 0, report: null },
    stats: { trades: 0, exps: 0, miniDust: 0, stockProfit: 0, idleDust: 0 },
    // 每颗星球的独立进度：{ 星球序号: { levels, assets, rank, total, ... } }
    // 跃迁时把旧星球存进来、从新星球取出来，任何两个星球都不共用一份数据。
    pdata: {}
  });

  let state = newState();

  const $ = id => document.getElementById(id);

  const el = {
    dust: $('dust'),
    cps: $('cps'),
    rep: $('rep'),
    rankIcon: $('rankIcon'),
    rankName: $('rankName'),
    rankNext: $('rankNext'),
    worldEmoji: $('worldEmoji'),
    worldName: $('worldName'),
    worldSub: $('worldSub'),
    worldPct: $('worldPct'),
    hint: $('hint'),
    stage: $('stage'),
    scene: $('scene'),
    wxChip: $('wxChip'),
    timeChip: $('timeChip'),
    floats: $('floatLayer'),
    stageNote: $('stageNote'),
    combo: $('combo'),
    comboNum: $('comboNum'),
    comboBonus: $('comboBonus'),
    comboFill: $('comboFill'),
    ambient: $('ambient'),
    shop: $('shop'),
    assets: $('assets'),
    ranks: $('ranks'),
    resoLayers: $('resoLayers'),
    resoNeedle: $('resoNeedle'),
    resoZone: $('resoZone'),
    resoBtn: $('resoBtn'),
    resoRoot: $('reso'),
    resoHint: $('resoHint'),
    worlds: $('worlds'),
    achs: $('achs'),
    gachs: $('gachs'),
    achCount: $('achCount'),
    travelBox: $('travelBox'),
    travel: $('travel'),
    travelTip: $('travelTip'),
    tip: $('saveTip'),
    reset: $('reset'),
    toast: $('toast'),
    guide: $('guide'),
    help: $('help'),
    intro: $('intro'),
    clear: $('clear'),
    clearEmoji: $('clearEmoji'),
    clearTitle: $('clearTitle'),
    clearSub: $('clearSub'),
    clearStats: $('clearStats'),
    confetti: $('confetti'),
    flash: $('flash'),
    previewModal: $('previewModal'),
    pvCanvas: $('previewScene'),
    pvName: $('pvName'),
    pvDesc: $('pvDesc'),
    pvFacts: $('pvFacts'),
    pvRanks: $('pvRanks'),
    pvGo: $('pvGo'),
    pvCancel: $('pvCancel'),
    wxModal: $('wxModal'),
    wxStatus: $('wxStatus'),
    wxNow: $('wxNow'),
    citySelect: $('citySelect'),
    wxAuto: $('wxAuto'),
    wxRefresh: $('wxRefresh'),
    wxOk: $('wxOk')
  };

  /* ===================== 3. 计算 ===================== */

  const W = () => WORLDS[state.world];
  const isLastWorld = () => state.world >= WORLDS.length - 1;

  // 新系统都放在 systems.js 里，这里只取结果；没加载时当作 0
  const SYS = () => window.DDSystems;
  const sysMult = () => (SYS() && SYS().mult ? SYS().mult() : 1);
  const capital = () => (SYS() && SYS().capital ? SYS().capital() : 0);
  const petPower = () => (window.DDPets ? DDPets.petPower() : 0);
  const badges = () => (state.mini ? state.mini.badges : 0);

  // 身份/成就看的是「曾经达到过」，不是「此刻还留着」。
  // 股票卖掉市值会归零、宠物战力也可能变动，如果只认实时值，玩家刚达标就被判定失败，
  // 表现就是「我明明买了股票/养了宠物，身份却没反应」。所以统一取实时值和历史最高值里的大的。
  const capBest = () => {
    const m = state.stocks && state.stocks.capBest;
    return m && typeof m === 'object' ? Number(m[state.world]) || 0 : 0;
  };
  const capitalTop = () => Math.max(capital(), capBest());

  /* ---- 身份判定用的「星尘」 ----
     以前身份只认 state.total（本星球累计获得），而买入股票只是把 dust 换成股票，
     total 一动不动，于是出现「我明明白白投了 40 亿进股市，身份面板还是 490 万」。
     现在按「手上现金 + 压在股市里的钱」算，投入即生效、卖出即跟着降：
       买入 → 本金记进 invest，身份立刻认；
       卖出 → invest 按成本比例回退、现金回流，数字跟着卖掉之后的实际资产走。
     和 capBest 一样按星球分开存，跃迁时不会带着旧星球的持仓白拿新星球身份。 */
  const stockInvest = () => {
    const m = state.stocks && state.stocks.invest;
    return m && typeof m === 'object' ? Number(m[state.world]) || 0 : 0;
  };
  // 股市里当前压着多少钱：本星球投入本金 和 本星球见过的最高市值 取大。
  // 两个都是按星球分开存的，所以跃迁到新星球时不会带着旧星球的持仓白拿身份。
  // 不直接用实时市值 capital()：持仓是跨星球的，价格又随星球倍率缩放，
  // 跃迁瞬间会把旧星球的浮盈放大成新星球的身价。
  const stockHeld = () => Math.max(stockInvest(), capBest());
  const rankDust = () => Math.max(state.total, state.dust + stockHeld());

  /* ---- 排行榜分数 ----
     线上榜分以前直接取 state.total，那是「本星球累计真实收入」：
     跃迁带过来的现金、股市收益、挂机收益都不在里面，
     于是出现「钱包 6 万亿、榜上 4 万亿」。
     这里按玩家实际拥有算：各星球累计之和 / 当前星球累计 / 钱包+股市压着的钱，取最大。 */
  function boardScore() {
    // 排行榜口径：所有星球「赚过的钱」加在一起（每颗星球的累计收入只增不减，
    // 花掉不会扣）。不拿当前钱包、也不拿股市浮盈去补，那两样不是收入。
    let sum = 0;
    let seen = false;
    const pd = state.pdata;
    if (pd && typeof pd === 'object') {
      for (const k in pd) {
        const p = pd[k];
        if (p && typeof p === 'object') {
          sum += Number(p.total) || 0;
          seen = true;
        }
      }
    }
    // 当前星球的实时累计可能比快照新一点，取大，免得刚赚完还没落盘就少算
    return seen ? Math.max(sum, Number(state.total) || 0) : Number(state.total) || 0;
  }

  const petBest = () => {
    const m = state.pets && state.pets.powerBest;
    return m && typeof m === 'object' ? Number(m[state.world]) || 0 : 0;
  };
  const petTop = () => Math.max(petPower(), petBest());

  // 每个 tick 把历史最高值往上抬一次（只增不减）
  function markBests() {
    // 累计星尘只认真实收入，不再拿「手上星尘」补齐：
    // 卖股票的本金回流、跃迁带过来的现金都不是这辈子赚到的钱。
    // 身份判定用 rankDust()（现金 + 股市投入），不依赖这个数，所以不会卡身份。
    if (state.stocks) {
      if (!state.stocks.capBest || typeof state.stocks.capBest !== 'object')
        state.stocks.capBest = {};
      // 只记「在这颗星球上赚出来的市值」，要扣掉跃迁时带进来的那份基准。
      // 持仓是跨星球留着的，而价格会按新星球的倍率重算：不扣基准的话，
      // 跃迁一瞬间旧持仓会被放大成新星球的天价市值，直接把身份全白送掉。
      if (!state.stocks.base || typeof state.stocks.base !== 'object') state.stocks.base = {};
      const base = Number(state.stocks.base[state.world]) || 0;
      const c = Math.max(0, capital() - base);
      if (c > (Number(state.stocks.capBest[state.world]) || 0))
        state.stocks.capBest[state.world] = c;
    }
    if (state.pets) {
      if (!state.pets.powerBest || typeof state.pets.powerBest !== 'object')
        state.pets.powerBest = {};
      const p = petPower();
      if (p > (Number(state.pets.powerBest[state.world]) || 0))
        state.pets.powerBest[state.world] = p;
    }
  }

  function rankReqOK(i) {
    const r = W().ranks[i];
    if (!r) return false;
    if (rankDust() < r.dust) return false;
    if (totalRep() < r.rep) return false;
    // 共振层数会随计时衰减，同样按「曾经达到过的最高层数」判，免得刚推到就被判失败
    if (
      state.reso < ((W().resoNeed || [])[i] || 0) &&
      state.resoBest < ((W().resoNeed || [])[i] || 0)
    )
      return false;
    if (r.cap && capitalTop() < r.cap) return false;
    if (r.pet && petTop() < r.pet) return false;
    if (r.badge && badges() < r.badge) return false;
    return true;
  }

  function sumUp(kind) {
    let s = 0;
    const list = W().upgrades;
    for (let i = 0; i < list.length; i++) {
      const u = list[i];
      if (u.kind === kind) s += (state.levels[u.id] || 0) * u.amount;
    }
    return s;
  }

  // 共振每层 +7% 的全产出：层数越高越爽，但会随时间衰减
  const resoMult = () => 1 + RESO_STEP * Math.min(state.reso, RESO_MAX);

  const clickPower = () =>
    (1 + sumUp('click')) *
    (1 + sumUp('mult')) *
    W().gain *
    Math.pow(RANK_CLICK, state.rank) *
    resoMult() *
    sysMult();

  const cps = () =>
    sumUp('cps') *
    (1 + sumUp('mult')) *
    W().gain *
    (1 + state.rank * RANK_CPS) *
    resoMult() *
    sysMult();

  const critChance = () => Math.min(CRIT_CAP, sumUp('crit'));

  // 采集无人机：就是升级列表里名字带「无人机」的那一档（每颗星球都是第 2 项）
  const DRONE_UP = 'u1';
  const droneLevel = () => state.levels[DRONE_UP] || 0;
  const droneCount = () => Math.min(8, droneLevel());

  function assetRep() {
    let s = 0;
    const list = W().assets;
    for (let i = 0; i < list.length; i++) {
      s += (state.assets[list[i].id] || 0) * list[i].rep;
    }
    return s;
  }

  const totalRep = () => assetRep();

  const costOf = (item, level) => Math.floor(item.base * Math.pow(item.growth, level));

  function fmt(n) {
    n = Number(n);
    if (!isFinite(n)) return '∞';
    const neg = n < 0 ? '-' : '';
    const a = Math.abs(n);
    // 大过「极」的万亿倍就交给科学计数，再堆单位只会更难看
    if (a >= 1e52) return neg + a.toExponential(2);

    for (let i = 0; i < BIG_UNITS.length; i++) {
      const base = BIG_UNITS[i][0];
      if (a >= base) {
        const x = a / base;
        // 到了这个量级，小数位早就被双精度吃掉了，直接取整更诚实
        return neg + (x >= 1e3 ? Math.floor(x).toString() : x.toFixed(2)) + BIG_UNITS[i][1];
      }
    }
    if (a >= 1e8) return neg + (a / 1e8).toFixed(2) + '亿';
    if (a >= 1e4) return neg + (a / 1e4).toFixed(2) + '万';
    if (a >= 100) return neg + String(Math.floor(a));
    return neg + (Math.round(a * 10) / 10).toString().replace(/\.0$/, '');
  }

  function fmtDuration(ms) {
    const m = Math.floor(ms / 60000);
    if (m < 60) return m + ' 分钟';
    return (m / 60).toFixed(1) + ' 小时';
  }

  function toast(msg, ms = 2400) {
    el.toast.textContent = msg;
    el.toast.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.toast.classList.remove('show'), ms);
  }

  /* ===================== 4. 存档 ===================== */

  let saveBroken = false;
  let tipTimer = 0;

  function flashTip(msg, ms = 1400) {
    el.tip.textContent = msg;
    clearTimeout(tipTimer);
    tipTimer = setTimeout(() => {
      el.tip.textContent = '进度自动保存';
    }, ms);
  }

  let bakAt = 0;

  function save(silent = true) {
    if (saveBroken) return;
    stashPlanet(); // 当前星球也必须有自己的一份快照
    state.lastSave = Date.now();
    try {
      const next = JSON.stringify(state);
      const prev = localStorage.getItem(SAVE_KEY);
      // 每 5 分钟把上一版完整存档留一份备份；写坏了、以后升级改坏了都能退回去
      if (prev && prev !== next && Date.now() - bakAt > 5 * 60 * 1000 && prev.length > 64) {
        try {
          localStorage.setItem(SAVE_BAK, prev);
          bakAt = Date.now();
        } catch (e2) {}
      }
      localStorage.setItem(SAVE_KEY, next);
      if (!silent) flashTip('已保存');
    } catch (e) {
      saveBroken = true;
      flashTip('这个浏览器不让存档');
    }
  }

  const num = v => Number(v) || 0;

  // 存档里的身份是「已经拿到」的下限；补齐只会往上补，不会因为共振掉了而倒退
  function recountRank(floor) {
    const ranks = W().ranks;
    let r = 0;
    while (r < ranks.length && rankReqOK(r)) r += 1;
    state.rank = clamp(Math.max(r, floor || 0), 0, ranks.length);
    state.worldDone = state.rank >= ranks.length;
  }

  // 找回存档：主键 → 旧版键 → 5 分钟前的备份；解析失败的原文另存一份，绝不直接清档
  let migratedKey = ''; // 这次是从哪个旧版 key 读出来的，载入后写回主 key 并清掉旧键

  function readSave() {
    let bad = null;
    for (const k of SAVE_KEYS) {
      let raw = null;
      try {
        raw = localStorage.getItem(k);
      } catch (e) {
        return null;
      }
      if (!raw) continue;
      try {
        const d = JSON.parse(raw);
        if (d && typeof d === 'object') {
          if (k !== SAVE_KEY) {
            migratedKey = k;
            flashTip('已迁移旧存档', 3000);
          }
          return d;
        }
      } catch (e) {
        bad = bad || { k, raw };
      }
    }
    if (bad) {
      try {
        localStorage.setItem(SAVE_BAD, bad.raw);
      } catch (e) {}
      flashTip('主存档读不出来，正在找备份', 3000);
    }
    for (const k of [SAVE_BAK]) {
      try {
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        const d = JSON.parse(raw);
        if (d && typeof d === 'object') {
          flashTip('已用备份存档恢复', 3000);
          return d;
        }
      } catch (e) {}
    }
    return null;
  }

  /* ---- 每颗星球一份独立进度：绝不共用 ---- */

  // 把「当前星球」的进度拍成快照（钱包和跨星球系统不写进来）
  function snapshotPlanet() {
    return {
      levels: Object.assign({}, state.levels || {}),
      assets: Object.assign({}, state.assets || {}),
      rank: state.rank || 0,
      worldDone: !!state.worldDone,
      wclicks: state.wclicks || 0,
      total: state.total || 0,
      comboBest: state.comboBest || 0,
      reso: state.reso || 0,
      resoBest: state.resoBest || 0,
      resoHits: state.resoHits || 0,
      resoMiss: state.resoMiss || 0
    };
  }

  function stashPlanet() {
    if (!state.pdata || typeof state.pdata !== 'object') state.pdata = {};
    state.pdata[state.world] = snapshotPlanet();
  }

  // 把某颗星球的快照装回当前状态；没有快照就是一颗全新的星球
  function loadPlanet(wi) {
    state.levels = {};
    state.assets = {};
    state.rank = 0;
    state.worldDone = false;
    state.wclicks = 0;
    state.total = 0;
    state.comboBest = 0;
    state.reso = 0;
    state.resoBest = 0;
    state.resoLastAt = Date.now();
    const p = state.pdata && state.pdata[wi];
    if (!p) return;
    W().upgrades.forEach(u => {
      if (p.levels && p.levels[u.id]) state.levels[u.id] = num(p.levels[u.id]);
    });
    W().assets.forEach(a => {
      if (p.assets && p.assets[a.id]) state.assets[a.id] = num(p.assets[a.id]);
    });
    state.rank = clamp(num(p.rank), 0, W().ranks.length);
    state.worldDone = !!p.worldDone && state.rank >= W().ranks.length;
    state.wclicks = num(p.wclicks);
    state.total = num(p.total);
    state.comboBest = num(p.comboBest);
    state.reso = clamp(num(p.reso), 0, RESO_MAX);
    state.resoBest = clamp(num(p.resoBest), 0, RESO_MAX);
    state.resoHits = num(p.resoHits);
    state.resoMiss = num(p.resoMiss);
  }

  // 只保留已解锁的星球；未解锁的空数据不算有效存档
  function prunePlanets() {
    const keep = {};
    for (let i = 0; i <= state.world && i < WORLDS.length; i++) {
      if (state.pdata && state.pdata[i]) keep[i] = state.pdata[i];
    }
    state.pdata = keep;
  }

  // 把一份存档对象铺进内存（不做任何合并：合并在账号逻辑里是禁令）
  function hydrate(d) {
    // 云存档顶层的 total 是「所有星球累计之和」，只给排行榜用；
    // 本机需要的是当前星球的累计，换回上传时另存的真实值。
    if (d && d.boardTotal != null) {
      d.total = num(d.boardTotal);
      delete d.boardTotal;
    }
    if (d && d.boardScore != null) delete d.boardScore;
    const base = newState();
    state = Object.assign(base, {
      dust: num(d.dust),
      total: num(d.total),
      clicks: num(d.clicks),
      wclicks: d.wclicks != null ? num(d.wclicks) : num(d.clicks),
      world: clamp(num(d.world), 0, WORLDS.length - 1),
      rank: 0,
      worldDone: false,
      reso: clamp(num(d.reso), 0, RESO_MAX),
      ach: Object.assign({}, d.ach || {}),
      guideSeen: !!d.guideSeen,
      cleared: !!d.cleared,
      startedAt: num(d.startedAt) || Date.now(),
      lastSave: num(d.lastSave) || Date.now(),
      comboBest: num(d.comboBest),
      resoBest: clamp(num(d.resoBest), 0, RESO_MAX),
      resoHits: num(d.resoHits),
      resoMiss: num(d.resoMiss),
      resoLastAt: num(d.resoLastAt) || Date.now()
    });

    // 不再把「手上星尘」抬成「累计星尘」：卖股票的本金回流、跃迁带过来的现金
    // 都不是新收入，抬上去会让累计星尘和排行榜虚高。身份判定另有 rankDust() 兜底。

    state.mini = Object.assign(base.mini, d.mini || {});
    state.mini.best = Object.assign({}, (d.mini && d.mini.best) || {});
    state.stocks = Object.assign(base.stocks, d.stocks || {});
    state.stocks.hold = Object.assign({}, (d.stocks && d.stocks.hold) || {});
    state.stocks.cost = Object.assign({}, (d.stocks && d.stocks.cost) || {});
    state.stocks.prices = Object.assign({}, (d.stocks && d.stocks.prices) || {});
    state.stocks.news = Array.isArray(d.stocks && d.stocks.news) ? d.stocks.news : [];
    // 老存档没有「股市投入」这项：只要还有持仓，就按持仓成本补一份，
    // 免得升级之后已经投进去的钱突然不算数了。老数据不分星球，只能记在当前星球上。
    if (state.stocks.hold && Object.keys(state.stocks.hold).length) {
      if (!state.stocks.invest || typeof state.stocks.invest !== 'object') state.stocks.invest = {};
      const wi = String(state.world);
      if (!(Number(state.stocks.invest[wi]) > 0)) {
        let costSum = 0;
        const cm = state.stocks.cost || {};
        for (const k in cm) costSum += Number(cm[k]) || 0;
        if (costSum > 0) state.stocks.invest[wi] = costSum;
      }
    }
    if (!state.stocks.base || typeof state.stocks.base !== 'object') state.stocks.base = {};
    state.pets = Object.assign(base.pets, d.pets || {});
    state.pets.owned = Object.assign({}, (d.pets && d.pets.owned) || {});
    state.pets.skins = Object.assign({}, (d.pets && d.pets.skins) || {});
    state.pets.pat = Object.assign({}, (d.pets && d.pets.pat) || {});
    state.pets.exps = Array.isArray(d.pets && d.pets.exps) ? d.pets.exps : [null, null, null];
    while (state.pets.exps.length < 3) state.pets.exps.push(null);
    if (d.fleet && d.fleet.done) {
      state.pets.done += num(d.fleet.done);
      state.pets.migrated = true;
    }
    state.idle = Object.assign(base.idle, d.idle || {});
    state.stats = Object.assign(base.stats, d.stats || {});

    // 老字段先铺一层（旧存档没有 pdata）
    state.levels = {};
    W().upgrades.forEach(u => {
      if (d.levels && d.levels[u.id]) state.levels[u.id] = num(d.levels[u.id]);
    });
    state.assets = {};
    W().assets.forEach(a => {
      if (d.assets && d.assets[a.id]) state.assets[a.id] = num(d.assets[a.id]);
    });
    recountRank(clamp(num(d.rank), 0, W().ranks.length));

    // 每颗星球自己的进度：只收已解锁的星球
    state.pdata = {};
    const pd = d.pdata && typeof d.pdata === 'object' ? d.pdata : {};
    for (let i = 0; i <= state.world; i++) {
      const p = pd[i] || pd[String(i)];
      if (p && typeof p === 'object') state.pdata[i] = p;
    }
    // 当前星球以它自己的快照为准；没有就把刚铺好的老字段拍成第一份
    if (state.pdata[state.world]) loadPlanet(state.world);
    else state.pdata[state.world] = snapshotPlanet();
  }

  function load() {
    try {
      const d = readSave();
      if (!d) return;
      hydrate(d);

      // 离线收益
      const away = Date.now() - state.lastSave;
      if (away > RESO_DECAY_MS) {
        state.reso = 0;
        state.resoLastAt = Date.now();
      }
      const idleRate = Math.min(1, 0.55 + state.idle.core * 0.025);
      const gain = ((cps() * Math.min(away, OFFLINE_CAP_MS)) / 1000) * idleRate;
      if (away > 60000 && gain >= 1) {
        state.dust += gain;
        state.total += gain;
        if (state.pdata[state.world]) state.pdata[state.world].total = state.total;
        state.stats.idleDust += gain;
        state.idle.report = { away: away, gain: gain, rate: idleRate };
        flashTip('离线 ' + fmtDuration(away) + '，收入 +' + fmt(gain), 4000);
      }

      // 从旧版 key 迁移过来的：立刻写回主 key，再删掉旧键。
      // 不删的话下次启动还会先读到那份旧档，把新进度顶掉。
      if (migratedKey) {
        const oldKey = migratedKey;
        migratedKey = '';
        try {
          save(true);
          localStorage.removeItem(oldKey);
        } catch (e) {}
      }
    } catch (e) {
      state = newState(); // 存档坏了就当新档
    }
  }

  /* ===================== 5. 天气 / 时间 ===================== */

  let wx = { kind: 'clear', temp: null, code: null, source: 'sim', place: '模拟天气', ts: 0 };
  let cityPref = 'auto';
  let lastLoc = null;
  let wxLoading = false;
  let pvScene = null;
  let pvIndex = -1;

  try {
    cityPref = localStorage.getItem(CITY_KEY) || 'auto';
  } catch (e) {}
  try {
    lastLoc = JSON.parse(localStorage.getItem(LOC_KEY) || 'null');
  } catch (e) {}

  function fetchJSON(url, ms) {
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), ms || 8000) : null;
    return fetch(url, ctrl ? { signal: ctrl.signal, cache: 'no-store' } : { cache: 'no-store' })
      .then(r => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .finally(() => {
        if (timer) clearTimeout(timer);
      });
  }

  // 没网时的模拟天气：按“日期+小时”生成，稳定但会随时间变
  function simWx() {
    const now = new Date();
    const month = now.getMonth() + 1;
    let seed =
      (now.getFullYear() * 100000 + month * 1000 + now.getDate() * 31 + now.getHours()) %
      2147483647;
    if (seed <= 0) seed += 2147483646;
    const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const pool = [
      'clear',
      'clear',
      'partly',
      'partly',
      'cloudy',
      'overcast',
      'drizzle',
      'rain',
      'fog',
      'snow',
      'thunder',
      'shower'
    ];
    const cold = month <= 2 || month >= 11;
    let kind = pool[Math.floor(r() * pool.length)];
    if (kind === 'snow' && !cold) kind = 'rain';
    if (kind === 'thunder' && cold) kind = 'snow';
    const base = cold ? 2 : month >= 6 && month <= 8 ? 27 : 17;
    return { kind, temp: Math.round(base + (r() * 8 - 4)), code: null };
  }

  function applyWx(data, source, place) {
    wx = { kind: data.kind, temp: data.temp, code: data.code, source, place, ts: Date.now() };
    if (scene) scene.setWeather(wx);
    if (pvScene) pvScene.setWeather(wx);
    el.wxChip.textContent =
      SceneKit.iconOf(wx.kind) +
      ' ' +
      SceneKit.labelOf(wx.kind) +
      (wx.temp != null ? ' ' + wx.temp + '°' : '');
    refreshWxPanel();
    checkAchs();
  }

  function setWxStatus(text) {
    el.wxStatus.textContent = text;
  }

  function refreshWxPanel() {
    const ti = SceneKit.timeInfo();
    el.wxNow.innerHTML =
      '<div class="wx-cell"><b>' +
      SceneKit.iconOf(wx.kind) +
      ' ' +
      SceneKit.labelOf(wx.kind) +
      '</b>' +
      '<span>' +
      (wx.temp != null ? wx.temp + '°C' : '--') +
      '</span></div>' +
      '<div class="wx-cell"><b>' +
      ti.phaseIcon +
      ' ' +
      ti.phaseName +
      ' ' +
      ti.clock +
      '</b>' +
      '<span>' +
      (wx.place || '') +
      (wx.source === 'sim' ? ' · 模拟' : ' · 实时') +
      '</span></div>';
  }

  function writeWxCache() {
    try {
      localStorage.setItem(
        WX_KEY,
        JSON.stringify({
          ts: Date.now(),
          kind: wx.kind,
          temp: wx.temp,
          code: wx.code,
          source: wx.source,
          place: wx.place
        })
      );
    } catch (e) {}
  }

  function readWxCache() {
    try {
      const c = JSON.parse(localStorage.getItem(WX_KEY) || 'null');
      if (!c || !c.kind) return null;
      if (Date.now() - c.ts > WX_TTL) return null;
      return c;
    } catch (e) {
      return null;
    }
  }

  async function resolveLoc() {
    if (cityPref && cityPref !== 'auto') {
      const c = CITIES.find(x => x.name === cityPref);
      if (c) return { lat: c.lat, lon: c.lon, name: c.name };
    }
    if (lastLoc && Date.now() - (lastLoc.ts || 0) < 12 * 3600 * 1000) return lastLoc;
    try {
      const j = await fetchJSON('https://ipapi.co/json/', 7000);
      if (j && typeof j.latitude === 'number' && typeof j.longitude === 'number') {
        lastLoc = {
          lat: j.latitude,
          lon: j.longitude,
          name: j.city || j.region || j.country_name || '自动定位',
          ts: Date.now()
        };
        try {
          localStorage.setItem(LOC_KEY, JSON.stringify(lastLoc));
        } catch (e) {}
        return lastLoc;
      }
    } catch (e) {}
    return { lat: 39.9042, lon: 116.4074, name: '北京' };
  }

  async function loadWeather(manual) {
    if (wxLoading) return;
    wxLoading = true;
    setWxStatus('正在获取实时天气…');
    try {
      const loc = await resolveLoc();
      const url =
        'https://api.open-meteo.com/v1/forecast?latitude=' +
        loc.lat.toFixed(3) +
        '&longitude=' +
        loc.lon.toFixed(3) +
        '&current=temperature_2m,weather_code,is_day&timezone=auto';
      const j = await fetchJSON(url, 9000);
      const cur = j && j.current;
      if (!cur || typeof cur.weather_code !== 'number') throw new Error('天气数据不完整');

      applyWx(
        {
          kind: SceneKit.kindFromCode(cur.weather_code),
          temp: Math.round(cur.temperature_2m),
          code: cur.weather_code
        },
        'live',
        loc.name
      );
      writeWxCache();
      setWxStatus('实时天气 · ' + loc.name + ' · ' + SceneKit.timeInfo().clock + ' 更新');
    } catch (e) {
      if (wx.source !== 'live') {
        applyWx(simWx(), 'sim', '模拟天气');
        writeWxCache();
      }
      setWxStatus('拿不到实时天气（可能没网），现在用模拟天气。点「刷新」重试。');
    } finally {
      wxLoading = false;
    }
  }

  function buildCitySelect() {
    el.citySelect.innerHTML = '';
    el.citySelect.appendChild(new Option('自动定位（按网络 IP）', 'auto'));
    CITIES.forEach(c => el.citySelect.appendChild(new Option(c.name, c.name)));
    el.citySelect.value = cityPref || 'auto';
  }

  /* ===================== 6. 场景与点击（含连锁） ===================== */

  const scene = new PlanetScene(el.scene, { world: state.world, weather: wx });
  scene.start();

  let pendingGain = 0;
  let lastNote = '';

  // render 每 100ms 跑一次：只有值真的变了才写 DOM，避免无谓的样式重算
  const textCache = new WeakMap();
  const htmlCache = new WeakMap();
  function setText(node, text) {
    if (!node || textCache.get(node) === text) return;
    textCache.set(node, text);
    node.textContent = text;
  }
  function setHTML(node, html) {
    if (!node || htmlCache.get(node) === html) return;
    htmlCache.set(node, html);
    node.innerHTML = html;
  }
  function setDisabled(btn, v) {
    if (btn && btn.disabled !== v) btn.disabled = v;
  }

  scene.onCollect = (x, y) => {
    if (pendingGain >= 1) {
      spawnFloatAt('+' + fmt(pendingGain), false, x, y, 'pet');
      pendingGain = 0;
    }
  };

  // 无人机采回来的数字单独飘在它下面，和宠物的分开
  scene.onDroneCollect = (x, y) => {
    if (pendingGain >= 1) {
      spawnFloatAt('🛸 +' + fmt(pendingGain), false, x, y, 'ship');
      pendingGain = 0;
    }
  };

  function stagePoint(clientX, clientY) {
    const rect = el.stage.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function spawnFloatAt(text, crit, x, y, kind) {
    const span = document.createElement('span');
    span.className = 'float' + (crit ? ' crit' : '') + (kind ? ' ' + kind : '');
    span.textContent = text;
    const w = el.stage.clientWidth || 320;
    span.style.left = Math.max(26, Math.min(w - 26, x)) + 'px';
    span.style.top = Math.max(16, y) + 'px';
    el.floats.appendChild(span);
    while (el.floats.children.length > 26) el.floats.removeChild(el.floats.firstChild);
    span.addEventListener('animationend', () => span.remove());
  }

  /* ---- 星尘连锁：1.5 秒内连点累积，每 5 连 +6%，最高 +60% ---- */
  let combo = 0;
  let comboAt = 0;

  const chainBonus = () => Math.min(0.6, Math.floor(combo / 5) * 0.06);

  function renderCombo() {
    const on = combo >= 2;
    el.combo.classList.toggle('hidden', !on);
    if (!on) return;
    const pct = Math.round(chainBonus() * 100);
    el.comboNum.textContent = combo;
    el.comboBonus.textContent = '+' + pct + '%';
    el.comboFill.style.width = pct + '%';
    el.combo.classList.toggle('hot', combo >= 30);
    el.combo.classList.toggle('blazing', combo >= 60);
  }

  function comboStep() {
    const now = performance.now();
    combo = now - comboAt <= CHAIN_WINDOW ? Math.min(combo + 1, 999) : 1;
    comboAt = now;
    if (combo > state.comboBest) state.comboBest = combo;
    renderCombo();
  }

  function comboBreak() {
    if (combo === 0) return;
    combo = 0;
    renderCombo();
  }

  /* ---- 点击星球 ---- */
  const clickStamps = [];
  let blockedAt = 0;

  function clickPlanet(x, y) {
    const now = performance.now();
    while (clickStamps.length && now - clickStamps[0] > 1000) clickStamps.shift();

    if (clickStamps.length >= CLICK_LIMIT) {
      if (now - blockedAt > 2500) {
        blockedAt = now;
        toast('⛔ 手速太快，星尘暂停增长', 1800);
        el.stage.classList.add('blocked');
        setTimeout(() => el.stage.classList.remove('blocked'), 700);
      }
      return;
    }
    clickStamps.push(now);

    comboStep();

    let gain = clickPower() * (1 + chainBonus());
    // 虚空潮汐（第 6 颗星球起）：只给点击收益翻倍。
    // 以前是 fx.js 每 1.2 秒拿「星尘差值」再补一份，卖股票的本金会被一起翻倍。
    if (window.DDFX && window.DDFX.tideOn && window.DDFX.tideOn()) gain *= 2;
    let crit = false;
    if (Math.random() < critChance()) {
      gain *= CRIT_MULTI;
      crit = true;
    }

    state.clicks += 1;
    state.wclicks += 1;
    state.dust += gain;
    state.total += gain;

    // 键盘、鼠标、触屏都走 clickPlanet，所以三端都有点击音效
    try {
      if (window.DDFX) DDFX.sfx.click(combo || 0, crit);
    } catch (_) {}

    scene.burst(x, y, crit);
    if (crit) {
      // 暴击：额外一圈光环 + 舞台轻微震动，打击感更明显
      try {
        if (window.DDFX) DDFX.ring(x, y, '#ffd66a');
      } catch (_) {}
      if (el.stage && !reducedMotion()) {
        el.stage.classList.remove('shake');
        void el.stage.offsetWidth;
        el.stage.classList.add('shake');
        setTimeout(() => el.stage.classList.remove('shake'), 260);
      }
    }
    spawnFloatAt((crit ? '暴击 +' : '+') + fmt(gain), crit, x, y);

    // 每 10 连：星尘爆发
    if (combo >= 10 && combo % 10 === 0) {
      const burst = clickPower() * (1 + chainBonus()) * Math.min(combo, 50) * 0.12;
      state.dust += burst;
      state.total += burst;
      spawnFloatAt('💥 连锁爆发 +' + fmt(burst), true, x, y - 34, 'burst');
      scene.kickIt();
      spawnConfetti(16);
      el.combo.classList.remove('burst');
      void el.combo.offsetWidth;
      el.combo.classList.add('burst');
      if (combo % 50 === 0) toast('⚡ ' + combo + ' 连击！星尘爆发 +' + fmt(burst), 2200);
    }

    checkRanks();
    checkAchs();
    render();
  }

  el.stage.addEventListener('pointerdown', e => {
    if (e.target.closest('.chip')) return;
    e.preventDefault();
    // 点过跃迁/购买之类的按钮后，焦点留在按钮上会让后续键盘全部失效
    const a = document.activeElement;
    if (a && a !== document.body && a !== document.documentElement && typeof a.blur === 'function')
      a.blur();
    const p = stagePoint(e.clientX, e.clientY);
    clickPlanet(p.x, p.y);
  });

  /* 标签页 */
  const tabs = Array.from(document.querySelectorAll('.tab'));
  const panels = {
    up: $('panel-up'),
    asset: $('panel-asset'),
    rank: $('panel-rank'),
    stock: $('panel-stock'),
    pets: $('panel-pets'),
    play: $('panel-play'),
    leader: $('panel-leader')
  };

  function reducedMotion() {
    try {
      return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) {
      return false;
    }
  }

  function switchTab(name) {
    try {
      if (window.DDFX) DDFX.sfx.buy();
    } catch (_) {}
    tabs.forEach(x => x.classList.toggle('active', x.dataset.tab === name));
    Object.keys(panels).forEach(k => {
      if (panels[k]) panels[k].classList.toggle('active', k === name);
    });
  }

  tabs.forEach(t => {
    t.addEventListener('click', () => switchTab(t.dataset.tab));
  });

  /* 玩法按星球逐步开放：没解锁的标签页直接藏起来，
     当前停在被锁的页面上就退回「升级」。 */
  const TAB_FEAT = { stock: 'stock', pets: 'pets', play: 'mini' };

  function hide(id, on) {
    const n = $(id);
    if (n) n.style.display = on ? '' : 'none';
  }

  function applyLocks() {
    let switched = false;
    tabs.forEach(t => {
      const feat = TAB_FEAT[t.dataset.tab];
      const on = !feat || unlocked(feat);
      t.style.display = on ? '' : 'none';
      if (!on && t.classList.contains('active')) switched = true;
    });
    if (switched) switchTab('up');

    hide('reso', unlocked('reso'));
    hide('miniHead', unlocked('mini'));
    hide('miniTip', unlocked('mini'));
    hide('miniList', unlocked('mini'));
    hide('idleTitle', unlocked('idle'));
    hide('idleCard', unlocked('idle'));
    hide('idleClaim', unlocked('idle'));
  }

  /* ===================== 7. 列表 / 图鉴 / 预览 ===================== */

  let upRows = [];
  let assetRows = [];
  let rankRows = [];
  let achRows = [];
  let gachRows = [];

  function buildUpgrades() {
    // 底部提示：本星球已开放几项，后面还会加
    el.shop.innerHTML = '';
    upRows = W()
      .upgrades.slice(0, openUpgrades())
      .map(u => {
        const li = document.createElement('li');
        li.className = 'item';
        li.innerHTML =
          '<div class="item-main">' +
          '<div class="item-name">' +
          u.name +
          '</div>' +
          '<div class="item-desc">' +
          u.desc +
          '</div>' +
          '</div>' +
          '<div class="item-side">' +
          '<div class="item-lv">Lv.0</div>' +
          '<button type="button" class="buy">0</button>' +
          '</div>';

        const btn = li.querySelector('.buy');
        btn.addEventListener('click', () => buyUpgrade(u));
        el.shop.appendChild(li);
        return { u, btn, lv: li.querySelector('.item-lv') };
      });
    const leftUp = W().upgrades.length - upRows.length;
    if (leftUp > 0) {
      const li = document.createElement('li');
      li.className = 'item locked';
      li.innerHTML =
        '<div class="item-main"><div class="item-name">🔒 还有 ' +
        leftUp +
        ' 项升级</div><div class="item-desc">跃迁到下一颗星球后逐步开放</div></div>';
      el.shop.appendChild(li);
    }
  }

  function buildAssets() {
    el.assets.innerHTML = '';
    assetRows = W()
      .assets.slice(0, openAssets())
      .map(a => {
        const li = document.createElement('li');
        li.className = 'item';
        li.innerHTML =
          '<div class="item-main">' +
          '<div class="item-name">' +
          a.icon +
          ' ' +
          a.name +
          '</div>' +
          '<div class="item-desc">每件 +' +
          a.rep +
          ' 声望 · 单价固定</div>' +
          '</div>' +
          '<div class="item-side">' +
          '<div class="item-lv">拥有 0' +
          (a.max ? '/' + a.max : '') +
          '</div>' +
          '<button type="button" class="buy rep-buy">0</button>' +
          '</div>';

        const btn = li.querySelector('.buy');
        btn.addEventListener('click', () => buyAsset(a));
        el.assets.appendChild(li);
        return { a, btn, lv: li.querySelector('.item-lv') };
      });
    const leftAsset = W().assets.length - assetRows.length;
    if (leftAsset > 0) {
      const li = document.createElement('li');
      li.className = 'item locked';
      li.innerHTML =
        '<div class="item-main"><div class="item-name">🔒 还有 ' +
        leftAsset +
        ' 项资产</div><div class="item-desc">跃迁到后面的星球解锁</div></div>';
      el.assets.appendChild(li);
    }
  }

  function buildRanks() {
    el.ranks.innerHTML = '';
    rankRows = W().ranks.map((r, i) => {
      const li = document.createElement('li');
      li.className = 'rank-item';
      li.innerHTML =
        '<span class="rank-emoji">' +
        r.icon +
        '</span>' +
        '<div class="item-main">' +
        '<div class="rank-name">' +
        r.name +
        '</div>' +
        '<div class="rank-req">累计星尘 ' +
        fmt(r.dust) +
        ' · 声望 ' +
        fmt(r.rep) +
        (W().resoNeed && W().resoNeed[i] ? ' · 共振 ' + W().resoNeed[i] + ' 层' : '') +
        (r.cap ? ' · 市值 ' + fmt(r.cap) : '') +
        (r.pet ? ' · 宠物 ' + fmt(r.pet) : '') +
        (r.badge ? ' · 星章 ' + r.badge : '') +
        '</div>' +
        '</div>' +
        '<span class="rank-badge">未达成</span>';

      el.ranks.appendChild(li);
      return { li, badge: li.querySelector('.rank-badge') };
    });
  }

  function achKey(a) {
    return state.world + ':' + a.id;
  }

  function achItem(a, done) {
    const li = document.createElement('li');
    li.className = 'ach-item' + (done ? ' done' : '');
    li.innerHTML =
      '<span class="ach-dot">🏅</span>' +
      '<div class="item-main">' +
      '<div class="item-name">' +
      a.name +
      '</div>' +
      '<div class="item-desc">' +
      a.desc +
      ' · 奖励 ' +
      fmt(a.reward) +
      '</div>' +
      '</div>';
    return li;
  }

  function buildAchs() {
    el.achs.innerHTML = '';
    achRows = W().achs.map(a => {
      const li = achItem(a, !!state.ach[achKey(a)]);
      el.achs.appendChild(li);
      return { a, li };
    });

    el.gachs.innerHTML = '';
    gachRows = GLOBAL_ACHS.map(a => {
      const li = achItem(a, !!state.ach[a.id]);
      el.gachs.appendChild(li);
      return { a, li };
    });
    updateAchCount();
  }

  function updateAchCount() {
    const done = W().achs.filter(a => state.ach[achKey(a)]).length;
    el.achCount.textContent = done + '/' + W().achs.length;
  }

  function worldStatus(i) {
    if (i === state.world) return state.worldDone ? '身份全满' : '当前星球';
    if (i < state.world) return '已点亮';
    if (i === state.world + 1) return state.worldDone ? '可以跃迁' : '下一站';
    return '未解锁';
  }

  function buildWorldCards() {
    el.worlds.innerHTML = '';
    WORLDS.forEach((w, i) => {
      const li = document.createElement('li');
      li.className = 'world-card' + (i === state.world ? ' on' : '');
      li.innerHTML =
        '<span class="mini-planet" data-w="' +
        i +
        '"></span>' +
        '<span class="wc-info">' +
        '<b>' +
        w.name +
        '</b>' +
        '<em>星尘门槛 ' +
        fmt(w.need0) +
        ' 起 · ' +
        w.upgrades.length +
        ' 项升级 · ' +
        w.achs.length +
        ' 成就</em>' +
        '</span>' +
        '<span class="wc-badge">' +
        worldStatus(i) +
        '</span>';
      li.addEventListener('click', () => openPreview(i));
      el.worlds.appendChild(li);
    });
  }

  function closePreview() {
    el.previewModal.classList.add('hidden');
    if (pvScene) {
      pvScene.stop();
      pvScene = null;
    }
    pvIndex = -1;
  }

  function openPreview(i) {
    pvIndex = i;
    const w = WORLDS[i];

    el.pvName.textContent = w.emoji + ' ' + w.name;
    el.pvDesc.textContent =
      i === state.world
        ? '这里就是你现在的家。每升一个身份，星尘门槛乘 ' + w.ranks.length + ' 级递增曲线。'
        : i < state.world
          ? '已经点亮过的星球，可以回头看看它现在的天气。'
          : '跃迁到这里后，本星球的星尘、升级、资产、共振层数都会清零，从这颗星球重新发育。';

    const petN = window.DDPets && DDPets.PETS[i] ? DDPets.PETS[i].length : 0;
    el.pvFacts.innerHTML =
      '<div><b>' +
      fmt(w.need0) +
      '</b>首级星尘门槛</div>' +
      '<div><b>' +
      w.upgrades.length +
      '</b>项升级</div>' +
      '<div><b>' +
      petN +
      '</b>只宠物</div>' +
      '<div><b>' +
      w.achs.length +
      '</b>个成就</div>';

    el.pvRanks.innerHTML = w.ranks
      .map(
        r =>
          '<li><span>' +
          r.icon +
          ' ' +
          r.name +
          '</span><em>星尘 ' +
          fmt(r.dust) +
          ' · 声望 ' +
          fmt(r.rep) +
          '</em></li>'
      )
      .join('');

    el.previewModal.classList.remove('hidden');

    if (pvScene) {
      pvScene.stop();
      pvScene = null;
    }
    pvScene = new PlanetScene(el.pvCanvas, { world: i, preview: true, weather: wx });
    if (window.DDPets && DDPets.previewPet) pvScene.setPets([DDPets.previewPet(i)]);
    requestAnimationFrame(() => {
      if (!pvScene) return;
      pvScene.resize();
      pvScene.start();
    });

    updatePreviewGo();
  }

  function updatePreviewGo() {
    if (pvIndex < 0) return;
    const next = WORLDS[state.world + 1];
    const isCur = pvIndex === state.world;
    const isNext = pvIndex === state.world + 1;

    if (isCur) {
      el.pvGo.disabled = true;
      el.pvGo.textContent = '你就在这里';
    } else if (!isNext) {
      el.pvGo.disabled = true;
      el.pvGo.textContent = pvIndex < state.world ? '已点亮' : '还不能去';
    } else if (!state.worldDone) {
      el.pvGo.disabled = true;
      el.pvGo.textContent = '🔒 先把本星球身份拿满';
    } else if (state.dust < W().gate) {
      el.pvGo.disabled = true;
      el.pvGo.textContent = '🔒 还需要 ' + fmt(W().gate - state.dust) + ' 星尘';
    } else {
      el.pvGo.disabled = false;
      el.pvGo.textContent = '🚀 跃迁到「' + next.name + '」';
    }
  }

  /* ===================== 8. 购买 / 身份 / 跃迁 ===================== */

  function buyUpgrade(u) {
    const level = state.levels[u.id] || 0;
    if (level >= u.max) return;
    const cost = costOf(u, level);
    if (state.dust < cost) {
      toast('星尘还不够，再攒一下', 1200);
      return;
    }

    state.dust -= cost;
    state.levels[u.id] = level + 1;
    try {
      if (window.DDFX) DDFX.sfx.buy();
    } catch (_) {}
    scene.kickIt();
    checkAchs();
    render();
    save();
  }

  function buyAsset(a) {
    const level = state.assets[a.id] || 0;
    // 连点时按钮还没来得及变灰，这里要给一句反馈，不能让玩家以为买到了
    if (a.max && level >= a.max) {
      toast('「' + a.name + '」已经买满 ' + a.max + ' 件了', 1500);
      return;
    }
    const cost = costOf(a, level);
    if (state.dust < cost) {
      toast('星尘还不够，再攒一下', 1200);
      return;
    }

    state.dust -= cost;
    state.assets[a.id] = level + 1;
    try {
      if (window.DDFX) DDFX.sfx.buy();
    } catch (_) {}

    checkRanks();
    checkAchs();
    render();
    save();
  }

  // 晋升：星尘 ×2 + 点击力 ×1.5 + 自动产出 +25%
  function checkRanks() {
    const ranks = W().ranks;
    let promoted = null;
    let count = 0;

    while (state.rank < ranks.length) {
      const r = ranks[state.rank];
      if (rankReqOK(state.rank)) {
        state.rank += 1;
        state.dust *= 2;
        promoted = r;
        count += 1;
      } else {
        break;
      }
    }

    if (!count) {
      // 身份其实早就满了、却因为旧存档或云端恢复缺了毕业标记，这里补一次结算
      if (state.rank >= ranks.length && !state.worldDone) {
        state.worldDone = true;
        buildWorldCards();
        onWorldDone();
      }
      return;
    }

    save();
    scene.kickIt();
    spawnConfetti(36);
    toast(
      (count > 1 ? '🎖 连升 ' + count + ' 级 → 「' : '🎖 晋升「') +
        promoted.name +
        '」\n星尘 ×2 · 点击力 ×' +
        RANK_CLICK +
        ' · 自动产出 +' +
        Math.round(RANK_CPS * 100) +
        '%',
      3000
    );
    if (window.DDPets) DDPets.speak('big');

    if (state.rank >= ranks.length && !state.worldDone) {
      state.worldDone = true;
      buildWorldCards();
      onWorldDone();
    }
  }

  function onWorldDone() {
    checkAchs();
    if (isLastWorld()) {
      state.cleared = true;
      save();
      setTimeout(showClear, 800);
    } else {
      save();
      spawnConfetti(60);
      toast('🏁 「' + W().name + '」身份全满！攒够 ' + fmt(W().gate) + ' 星尘就能跃迁', 4200);
    }
  }

  // 跃迁：清空本星球，换一套数值，去更容易赚钱的下一颗
  function travel() {
    const next = WORLDS[state.world + 1];
    if (!next || !state.worldDone || state.dust < W().gate) return false;
    // 旧星球进度原样存进 pdata，绝不和新星球混用
    stashPlanet();
    state.world += 1;
    state.dust = 0;
    loadPlanet(state.world); // 装回目标星球自己的进度（没有就是全新的）
    clickStamps.length = 0;
    pendingGain = 0;
    comboBreak();

    applyWorld();
    // 记下跃迁这一刻带过来的持仓市值：新星球算浮盈时扣掉它，
    // 否则跨星球留着的持仓会按新价格放大，白送新星球的身份。
    if (state.stocks) {
      if (!state.stocks.base || typeof state.stocks.base !== 'object') state.stocks.base = {};
      state.stocks.base[state.world] = capital();
    }
    scene.setWorld(state.world);
    buildUpgrades();
    buildAssets();
    buildRanks();
    buildAchs();
    buildWorldCards();
    save();
    render();
    doFlash();
    checkAchs();

    if (window.DDPets) DDPets.onWorldEnter();
    // 跃迁按钮在模态里，点完焦点留在按钮上会让新世界的键盘全部失效
    const act = document.activeElement;
    if (act && act !== document.body && typeof act.blur === 'function') act.blur();
    const fresh = Object.keys(FEAT_MIN).filter(k => FEAT_MIN[k] === state.world);
    try {
      if (window.DDFX) DDFX.sfx.world();
    } catch (_) {}
    toast(
      '🚀 抵达「' +
        next.name +
        '」· 首级门槛 ' +
        fmt(next.need0) +
        ' 星尘' +
        (fresh.length ? '\n新玩法：' + fresh.map(k => FEAT_NAMES[k]).join('、') : ''),
      3800
    );
    return true;
  }

  function applyWorld() {
    document.body.dataset.world = String(state.world);
  }

  function doFlash() {
    el.flash.classList.remove('on');
    void el.flash.offsetWidth;
    el.flash.classList.add('on');
  }

  let confettiTimer = 0;
  function spawnConfetti(count) {
    el.confetti.innerHTML = '';
    const colors = ['#d8b25a', '#7e9cb0', '#8fa9a3', '#b5654f', '#a8b87b'];
    const n = count || 60;
    for (let i = 0; i < n; i++) {
      const p = document.createElement('i');
      p.style.left = Math.random() * 100 + '%';
      p.style.background = colors[i % colors.length];
      p.style.animationDuration = 1.6 + Math.random() * 1.8 + 's';
      p.style.animationDelay = Math.random() * 0.9 + 's';
      el.confetti.appendChild(p);
    }
    clearTimeout(confettiTimer);
    confettiTimer = setTimeout(() => {
      el.confetti.innerHTML = '';
    }, 4200);
  }

  function showClear() {
    el.clearEmoji.textContent = '🏆';
    el.clearTitle.textContent = '恭喜通关全部星球！';
    el.clearSub.textContent = '从一粒尘埃到宇宙之王，十颗星球都被你点亮了。';

    const mins = Math.max(1, Math.floor((Date.now() - state.startedAt) / 60000));
    el.clearStats.innerHTML =
      '<div><b>' +
      WORLDS.length +
      '</b>星球</div>' +
      '<div><b>' +
      fmt(state.clicks) +
      '</b>总点击</div>' +
      '<div><b>' +
      fmt(state.stats.trades) +
      '</b>交易</div>' +
      '<div><b>' +
      mins +
      ' 分钟</b>用时</div>';

    spawnConfetti(90);
    el.clear.classList.remove('hidden');
  }

  /* ===================== 9. 星核共振 ===================== */

  // 按住蓄力：指示条在 0~1 之间来回跑，松手时落在绿区就算成功
  const reso = {
    charging: false,
    p: 0,
    dir: 1,
    zoneAt: 0.5,
    zoneW: 0.26,
    last: 0,
    coolUntil: 0,
    raf: 0,
    startedAt: 0,
    frames: 0
  };
  const RESO_MIN_HOLD = 160; // 压住不足这么久就松手：算误触，直接取消，不判定、不掉层
  const RESO_MIN_TRAVEL = 0.06; // 指针几乎没走动（不到 6%）就松手：同样算误触，不判负
  const RESO_MIN_FRAMES = 3; // 蓄力期间至少真的渲染过 3 帧，否则说明指针没动起来

  const resoZoneWidth = () => Math.max(0.11, 0.3 - state.reso * 0.018);
  const resoNeedFor = rank => (W().resoNeed && W().resoNeed[rank]) || 0;

  function resoDraw() {
    if (el.resoNeedle) el.resoNeedle.style.left = (reso.p * 100).toFixed(2) + '%';
  }

  function resoLoop(ts) {
    if (!reso.charging) return;
    if (Date.now() - reso.startedAt > 8000) {
      resoCancel();
      return;
    } // 卡住保护
    reso.frames += 1;
    const dt = reso.last ? Math.min(80, ts - reso.last) : 16;
    reso.last = ts;
    reso.p += (dt / 1100) * reso.dir;
    if (reso.p >= 1) {
      reso.p = 1;
      reso.dir = -1;
    }
    if (reso.p <= 0) {
      reso.p = 0;
      reso.dir = 1;
    }
    resoDraw();
    reso.raf = requestAnimationFrame(resoLoop);
  }

  // 共振按钮只显示图标，不显示可被长按选中的文字；状态通过 data-on / aria-label 表达
  function paintResoBtn(mode, cd) {
    if (!el.resoBtn) return;
    const ico = el.resoBtn.querySelector('.reso-ico');
    if (ico) ico.textContent = mode === 'cool' ? '⌛' : '◉';
    el.resoBtn.dataset.on = mode === 'charge' ? '1' : '0';
    el.resoBtn.setAttribute(
      'aria-label',
      mode === 'charge'
        ? '松手锁定'
        : mode === 'cool'
          ? '冷却 ' + Math.ceil((cd || 0) / 1000) + ' 秒'
          : '按住蓄力，进绿区松手'
    );
  }

  function resoStart() {
    if (!unlocked('reso')) return;
    if (reso.charging || Date.now() < reso.coolUntil) return;
    reso.charging = true;
    reso.startedAt = Date.now();
    reso.p = 0;
    reso.dir = 1;
    reso.last = 0;
    reso.frames = 0;
    reso.zoneW = resoZoneWidth();
    reso.zoneAt = 0.2 + reso.zoneW / 2 + Math.random() * (0.6 - reso.zoneW);
    el.resoZone.style.left = ((reso.zoneAt - reso.zoneW / 2) * 100).toFixed(2) + '%';
    el.resoZone.style.width = (reso.zoneW * 100).toFixed(2) + '%';
    el.resoRoot.classList.add('on');
    paintResoBtn('charge');
    resoDraw();
    // 先把动画循环启动起来：音效出任何问题都不能让指针停在起点
    reso.raf = requestAnimationFrame(resoLoop);
    try {
      if (window.DDFX) DDFX.sfx.resoCharge();
    } catch (_) {}
  }

  function resoCancel() {
    if (!reso.charging) return;
    reso.charging = false;
    cancelAnimationFrame(reso.raf);
    reso.last = 0;
    el.resoRoot.classList.remove('on');
    paintResoBtn('idle');
    renderReso();
  }

  function resoLock() {
    if (!reso.charging) return;
    const held = Date.now() - (reso.startedAt || 0);
    // 三种情况都算误触：按得太短、指针几乎没动、蓄力循环没真正跑起来。
    // 这几种情况下玩家根本没机会把指针送进绿区，判负是不公平的。
    if (held < RESO_MIN_HOLD || reso.p < RESO_MIN_TRAVEL || reso.frames < RESO_MIN_FRAMES) {
      resoCancel();
      return;
    }
    reso.charging = false;
    cancelAnimationFrame(reso.raf);
    el.resoRoot.classList.remove('on');
    paintResoBtn('idle');

    const hit = Math.abs(reso.p - reso.zoneAt) <= reso.zoneW / 2;
    if (hit) {
      state.reso = Math.min(RESO_MAX, state.reso + 1);
      state.resoBest = Math.max(state.resoBest, state.reso);
      state.resoHits += 1;
      state.resoLastAt = Date.now();
      const burst = clickPower() * (10 + state.reso * 5);
      state.dust += burst;
      state.total += burst;
      spawnFloatAt(
        '⚡ 共振 +' + fmt(burst),
        true,
        (el.stage.clientWidth || 320) / 2,
        (el.stage.clientHeight || 320) * 0.4,
        'reso'
      );
      if (window.DDFX) DDFX.sfx.reso(state.reso);
      scene.kickIt();
      spawnConfetti(10);
      toast(
        '⚡ 共振成功 · ' + state.reso + ' 层，全产出 +' + Math.round((resoMult() - 1) * 100) + '%',
        2200
      );
      if (state.reso >= 2 && window.DDPets) DDPets.speak('big');
      checkRanks();
      checkAchs();
    } else {
      state.resoMiss += 1;
      state.reso = Math.max(0, state.reso - 1);
      state.resoLastAt = Date.now();
      if (window.DDFX) DDFX.sfx.resoMiss();
      reso.coolUntil = Date.now() + 2200;
      toast('💨 节奏歪了，共振掉到 ' + state.reso + ' 层', 1800);
    }
    render();
    save();
  }

  function resoTick() {
    if (state.reso <= 0) return;
    if (Date.now() - (state.resoLastAt || 0) < RESO_DECAY_MS) return;
    state.reso -= 1;
    if (window.DDFX) DDFX.sfx.resoDecay();
    state.resoLastAt = Date.now();
    toast('🌫 星核冷却，共振降到 ' + state.reso + ' 层', 1600);
    render();
  }

  function renderReso() {
    if (!el.resoLayers) return;
    const need = resoNeedFor(state.rank);
    el.resoLayers.textContent =
      '共振 ' +
      state.reso +
      '/' +
      RESO_MAX +
      ' 层 · 全产出 +' +
      Math.round((resoMult() - 1) * 100) +
      '%';
    el.resoLayers.classList.toggle('need', state.reso < need);
    const cd = Math.max(0, reso.coolUntil - Date.now());
    if (reso.charging) {
      paintResoBtn('charge');
    } else if (cd > 0) {
      paintResoBtn('cool', cd);
    } else {
      paintResoBtn('idle');
    }
    el.resoBtn.disabled = cd > 0;
    if (el.resoHint) {
      el.resoHint.textContent = need > 0 ? '下一个身份要共振 ' + need + ' 层' : '先把层数堆起来';
    }
  }

  if (el.resoBtn) {
    // 按下时抓住指针：手指出界/轻微滑动也不会中断蓄力；系统手势取消只中止蓄力，不判负
    el.resoBtn.addEventListener('pointerdown', e => {
      e.preventDefault();
      try {
        el.resoBtn.setPointerCapture(e.pointerId);
      } catch (_) {}
      resoStart();
    });
    el.resoBtn.addEventListener('pointerup', e => {
      e.preventDefault();
      resoLock();
    });
    el.resoBtn.addEventListener('pointercancel', resoCancel);
    el.resoBtn.addEventListener('lostpointercapture', () => {
      if (reso.charging) resoCancel();
    });
    el.resoBtn.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('pointerup', () => {
      if (reso.charging) resoLock();
    });
    window.addEventListener('pointercancel', () => {
      if (reso.charging) resoCancel();
    });
  }

  /* ========== 键盘操作：空格/回车点星球，按住 Q 蓄力共振 ==========
     外接键盘和蓝牙键盘都能用；输入框/按钮聚焦时不抢键。 */
  // 元素自己或任意一层祖先被藏起来（display:none / visibility:hidden）
  function elHidden(n) {
    for (var i = 0; n && i < 12; i++, n = n.parentElement) {
      var cs = null;
      try {
        cs = getComputedStyle(n);
      } catch (_) {
        return false;
      }
      if (!cs) return false;
      if (cs.display === 'none' || cs.visibility === 'hidden') return true;
    }
    return false;
  }
  // 焦点还在输入框上时，键盘按键会先被输入法吃掉，到不了页面：
  // 所以「不在输入」的任何时刻都要把焦点从输入框摘掉，否则表现就是
  // 开头能连点、登录或打字之后键盘突然全部失效。
  function blurField() {
    const a = document.activeElement;
    if (!a || a === document.body || a === document.documentElement) return;
    const tag = (a.tagName || '').toUpperCase();
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || a.isContentEditable) {
      try {
        a.blur();
      } catch (_) {}
    }
  }
  function keyOwnedByUI() {
    const a = document.activeElement;
    if (!a || a === document.body) return false;
    const tag = (a.tagName || '').toUpperCase();
    // 按钮/链接拿到焦点后不能吞掉键盘：点过共振按钮再按键就全哑了
    if (tag === 'BUTTON' || tag === 'A') {
      try {
        a.blur();
      } catch (_) {}
      return false;
    }
    const isField =
      tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || a.isContentEditable;
    if (!isField) return false;
    // 输入框已经看不见了（登录门关了、面板切走了）却还占着焦点：这种输入框不该再吃键盘
    if (elHidden(a) || !a.getClientRects().length) {
      try {
        a.blur();
      } catch (_) {}
      return false;
    }
    return true;
  }
  // 点输入框以外的地方 = 收起输入法，把键盘还给星球
  document.addEventListener(
    'pointerdown',
    function (e) {
      const t = e.target;
      if (!t) return;
      const tag = (t.tagName || '').toUpperCase();
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable) return;
      if (t.closest && t.closest('input, textarea, select, [contenteditable="true"]')) return;
      // 登录门里的「登录 / 注册」按钮别提前收键盘：手机上一收键盘整个门会跳位，按钮就点空了
      if (t.closest && t.closest('#loginGate')) return;
      blurField();
    },
    true
  );
  // 切走再切回来时，别让隐藏的输入框继续霸占焦点
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) blurField();
  });
  // 开场关闭有两种方式：playIntro 加 .hidden，index.html 的兜底脚本直接
  // style.display='none'。只认 classList 的话，兜底关掉之后键盘会永远失效。
  function introOpen() {
    var n = el.intro;
    if (!n) return false;
    if (n.classList.contains('hidden')) return false;
    if (n.style.display === 'none') return false;
    return true;
  }
  function keyClick() {
    if (!el.stage) return;
    let r = el.stage.getBoundingClientRect();
    if (!r.width || !r.height) {
      // 某些世界/布局下量不到尺寸，退回视口中心，避免键盘整个失灵
      r = { left: 0, top: 0, width: window.innerWidth || 320, height: window.innerHeight || 480 };
    }
    const jx = (Math.random() - 0.5) * r.width * 0.4;
    const jy = (Math.random() - 0.5) * r.height * 0.4;
    const p = stagePoint(r.left + r.width / 2 + jx, r.top + r.height / 2 + jy);
    clickPlanet(p.x, p.y);
  }
  // 键盘只认「按下」这一步：任意可打印键点星球，按住 Q 蓄力共振。
  // 蓝牙键盘的键码五花八门，所以不仅看 e.key，也看 e.code 和 Unidentified/Process 兜底。
  const KEY_DEAD = new Set([
    'Shift',
    'Control',
    'Alt',
    'Meta',
    'CapsLock',
    'NumLock',
    'ScrollLock',
    'Tab',
    'Escape',
    'Backspace',
    'Delete',
    'Insert',
    'Home',
    'End',
    'PageUp',
    'PageDown',
    'ArrowUp',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'ContextMenu',
    'Dead',
    'Fn'
  ]);
  const isResoKey = e => e.code === 'KeyQ' || e.key === 'q' || e.key === 'Q';
  function isClickKey(e) {
    if (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter') return true;
    if (e.key === ' ' || e.key === 'Spacebar' || e.key === 'Enter') return true;
    // 部分安卓/输入法键盘只给 Unidentified/Process，也当成点击，避免整片按键没反应
    if (e.key === 'Unidentified' || e.key === 'Process') return true;
    if (!e.key) return false;
    if (/^F\d{1,2}$/.test(e.key)) return false;
    if (KEY_DEAD.has(e.key)) return false;
    return e.key.length === 1; // 字母、数字、符号、小键盘数字全算点击
  }
  function onKeyDown(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (keyOwnedByUI() || introOpen()) return;
    if (isResoKey(e) && unlocked('reso')) {
      if (e.repeat) return;
      if (!el.resoBtn || reso.charging) return;
      e.preventDefault();
      resoStart();
      return;
    }
    if (isClickKey(e)) {
      e.preventDefault();
      keyClick();
    }
  }
  function onKeyUp(e) {
    if (!isResoKey(e)) return;
    if (reso.charging) {
      e.preventDefault();
      resoLock();
    }
  }
  // 捕获阶段监听：有些键盘/页面的冒泡会被别处截断
  document.addEventListener('keydown', onKeyDown, true);
  document.addEventListener('keyup', onKeyUp, true);
  window.addEventListener('blur', () => {
    if (reso.charging) resoCancel();
  });

  /* ===================== 10. 成就 ===================== */

  function checkAchs() {
    let last = null;

    for (const a of W().achs) {
      const key = achKey(a);
      if (!state.ach[key] && a.ok()) {
        state.ach[key] = true;
        state.dust += a.reward;
        state.total += a.reward;
        last = a;
      }
    }

    for (const a of GLOBAL_ACHS) {
      if (!state.ach[a.id] && a.ok()) {
        state.ach[a.id] = true;
        state.dust += a.reward;
        state.total += a.reward;
        last = a;
      }
    }

    if (last) {
      toast('🏅 解锁成就「' + last.name + '」+' + fmt(last.reward) + ' 星尘', 2600);
      updateAchCount();
      save();
      checkRanks();
    }
  }

  /* ===================== 11. 渲染 ===================== */

  function renderClock() {
    const ti = SceneKit.timeInfo();
    el.timeChip.textContent = ti.phaseIcon + ' ' + ti.phaseName + ' ' + ti.clock;
    document.body.dataset.phase = ti.phase;

    // 时段氛围光跟着当前星球的主色走，不再用固定的暖棕
    const A = 'var(--glow-rgb)';
    const bg = {
      dawn: 'radial-gradient(120% 70% at 50% -10%, rgba(' + A + ', .15), transparent 62%)',
      day: 'radial-gradient(120% 70% at 50% -10%, rgba(' + A + ', .10), transparent 62%)',
      dusk: 'radial-gradient(120% 70% at 50% -10%, rgba(' + A + ', .17), transparent 62%)',
      night: 'radial-gradient(140% 90% at 50% -20%, rgba(3, 4, 8, .55), transparent 72%)'
    };
    el.ambient.style.background = bg[ti.phase] || bg.night;
  }

  let lastLockWorld = -1;
  function applyLocksOnce() {
    if (lastLockWorld === state.world) return;
    lastLockWorld = state.world;
    applyLocks();
  }

  // 把场上无人机数量同步给场景（数量没变就不动，免得动画被重置）
  let lastDroneN = -1;
  function syncDrones() {
    const n = droneCount();
    if (n === lastDroneN) return;
    lastDroneN = n;
    if (scene && scene.setDrones) scene.setDrones(n);
  }

  function render() {
    applyLocksOnce();
    syncDrones();
    const world = W();
    const ranks = world.ranks;
    const rep = totalRep();

    el.dust.textContent = fmt(state.dust);
    const cpsNow = cps();
    setText(el.cps, cpsNow > 0 ? '+' + fmt(cpsNow) : '0');
    setText(el.rep, fmt(rep));

    // 星球条
    el.worldEmoji.textContent = world.emoji;
    el.worldName.textContent = world.name;
    el.worldSub.textContent =
      '第 ' +
      (state.world + 1) +
      ' 颗 · 星尘门槛 ' +
      fmt(world.need0) +
      ' 起 · 累计 ' +
      fmt(rankDust());
    el.worldPct.textContent = state.rank + '/' + ranks.length;

    // 当前身份
    const cur = ranks[Math.min(state.rank, ranks.length - 1)];
    el.rankIcon.textContent = cur.icon;
    el.rankName.textContent = cur.name;

    const next = ranks[state.rank];
    if (next) {
      const needReso = resoNeedFor(state.rank);
      const resoNow = Math.max(state.reso, state.resoBest);
      // 每个条件都列出来：满足的打勾只写名字，没满足的写「当前/需要」并标红。
      // 以前只显示一部分条件（比如市值常驻），容易误以为卡在市值上，却看不出真正差的是哪项。
      const items = [];
      const add = (ok, name, cur, need) => {
        items.push(
          ok
            ? '<span class="rank-ok">✅' + name + ' ' + cur + '</span>'
            : '<span class="rank-bad">❌' + name + ' ' + cur + '/' + need + '</span>'
        );
      };
      // 星尘 = 手上现金 + 股市里压着的钱（本金/市值取大），再和本星球累计取大。
      // 差得多的时候把构成直接写出来：玩家最容易把「股市里的大数字」当成账上星尘，
      // 摆在一起就不用猜到底是哪一项没认。
      const rd = rankDust();
      const held = stockHeld();
      const parts = [];
      if (Math.abs(state.dust - rd) > Math.max(1e-6, rd * 0.005))
        parts.push('现金' + fmt(state.dust));
      if (held > 0) parts.push('股市' + fmt(held));
      if (Math.abs(state.total - rd) > Math.max(1e-6, rd * 0.005))
        parts.push('累计' + fmt(state.total));
      add(
        rd >= next.dust,
        '星尘',
        fmt(rd) + (parts.length ? '(' + parts.join(' · ') + ')' : ''),
        fmt(next.dust)
      );
      add(rep >= next.rep, '声望', fmt(rep), fmt(next.rep));
      if (needReso > 0) add(resoNow >= needReso, '共振', Math.min(resoNow, needReso), needReso);
      if (next.cap) add(capitalTop() >= next.cap, '市值', fmt(capitalTop()), fmt(next.cap));
      if (next.pet) add(petTop() >= next.pet, '宠物', fmt(petTop()), fmt(next.pet));
      if (next.badge) add(badges() >= next.badge, '星章', badges(), next.badge);
      setHTML(
        el.rankNext,
        (state.rank === 0 ? '首个身份 ' : '下一站 ') + next.name + '：' + items.join(' · ')
      );
    } else {
      setText(el.rankNext, state.worldDone ? '本星球身份已全满' : '…');
    }

    const crit = critChance();
    setText(
      el.hint,
      '每次点击 +' +
        fmt(clickPower()) +
        ' 星尘' +
        (combo >= 2 ? '（连锁 +' + Math.round(chainBonus() * 100) + '%）' : '') +
        (crit > 0 ? ' · 暴击率 ' + Math.round(crit * 100) + '%' : '')
    );

    // 宠物状态
    const petN = window.DDPets ? DDPets.ownedCount() : 0;
    const dN = droneCount();
    const crew = [];
    if (dN) crew.push('🛸 ' + dN + ' 架无人机');
    if (petN) crew.push('🐾 ' + petN + ' 只宠物');
    const note =
      cps() > 0
        ? crew.length
          ? crew.join(' + ') + ' 在采集 · 每秒 +' + fmt(cps())
          : '⚡ 每秒 +' + fmt(cps())
        : crew.length
          ? crew.join(' + ') + ' 待命中，升级后会更勤快'
          : '⚡ 点星球攒星尘';
    if (note !== lastNote) {
      el.stageNote.textContent = note;
      lastNote = note;
    }

    // 升级
    for (const row of upRows) {
      const level = state.levels[row.u.id] || 0;
      setText(row.lv, 'Lv.' + level);
      if (level >= row.u.max) {
        setText(row.btn, '已满级');
        setDisabled(row.btn, true);
      } else {
        const cost = costOf(row.u, level);
        setText(row.btn, fmt(cost));
        setDisabled(row.btn, state.dust < cost);
      }
    }

    // 资产
    for (const row of assetRows) {
      const level = state.assets[row.a.id] || 0;
      const max = row.a.max || 0;
      setText(row.lv, max ? '拥有 ' + Math.min(level, max) + '/' + max : '拥有 ' + level);
      if (max && level >= max) {
        setText(row.btn, '已买满');
        setDisabled(row.btn, true);
        continue;
      }
      const cost = costOf(row.a, level);
      setText(row.btn, fmt(cost));
      setDisabled(row.btn, state.dust < cost);
    }

    // 身份列表
    rankRows.forEach((row, i) => {
      const done = i < state.rank;
      const now = i === state.rank;
      row.li.classList.toggle('done', done);
      row.li.classList.toggle('now', now);
      setText(row.badge, done ? '已获得' : now ? '进行中' : '未达成');
    });

    // 成就
    for (const row of achRows) row.li.classList.toggle('done', !!state.ach[achKey(row.a)]);
    for (const row of gachRows) row.li.classList.toggle('done', !!state.ach[row.a.id]);

    // 跃迁入口
    const nextWorld = WORLDS[state.world + 1];
    const canTravel = state.worldDone && !!nextWorld;
    el.travelBox.classList.toggle('hidden', !canTravel);
    if (canTravel) {
      el.travel.disabled = false;
      el.travel.textContent = '🔭 预览下一颗星球';
      el.travelTip.textContent =
        state.dust >= world.gate
          ? '门槛 ' +
            fmt(world.gate) +
            ' 星尘已够，点开图鉴看看' +
            nextWorld.name +
            '，再决定跃迁。'
          : '身份已全满，还差 ' +
            fmt(world.gate - state.dust) +
            ' 星尘就能跃迁到' +
            nextWorld.name +
            '。';
    }

    renderReso();
    if (pvIndex >= 0) updatePreviewGo();
  }

  /* ===================== 12. 交互 / 启动 ===================== */

  function openGuide() {
    el.guide.classList.remove('hidden');
  }

  $('guideOk').addEventListener('click', () => {
    el.guide.classList.add('hidden');
    state.guideSeen = true;
    save();
  });

  el.help.addEventListener('click', openGuide);

  /* ===== 设置面板 ===== */
  (function initSettings() {
    const box = $('settings');
    if (!box || !$('setBtn')) return;
    const KEY_FX = 'aiweb.fx.off';
    const KEY_LITE = 'aiweb.lite';
    const read = k => {
      try {
        return localStorage.getItem(k) === '1';
      } catch (e) {
        return false;
      }
    };
    const write = (k, v) => {
      try {
        localStorage.setItem(k, v ? '1' : '0');
      } catch (e) {}
    };
    let fxOff = read(KEY_FX);
    let lite = read(KEY_LITE);

    const paintFx = () => {
      if ($('setFxVal')) $('setFxVal').textContent = fxOff ? '关' : '开';
      if ($('setFx')) $('setFx').classList.toggle('off', fxOff);
    };
    const paintLite = () => {
      if ($('setMotionVal')) $('setMotionVal').textContent = lite ? '开' : '关';
      if ($('setMotion')) $('setMotion').classList.toggle('off', !lite);
      document.body.classList.toggle('lite', lite);
    };
    const paintSfx = () => {
      let muted = false;
      try {
        muted = localStorage.getItem('aiweb.sfx.mute') === '1';
      } catch (e) {}
      if ($('setSfxVal')) $('setSfxVal').textContent = muted ? '关' : '开';
      if ($('setSfx')) $('setSfx').classList.toggle('off', muted);
    };
    const paintAcc = () => {
      const n = window.Cloud && window.Cloud.name ? window.Cloud.name() : '';
      if ($('setAccName')) $('setAccName').textContent = n ? '已登录 · ' + n : '未登录';
    };

    if (window.DDFX && window.DDFX.setFx) window.DDFX.setFx(!fxOff);
    paintFx();
    paintLite();
    paintSfx();

    $('setBtn').addEventListener('click', () => {
      paintAcc();
      paintSfx();
      paintFx();
      paintLite();
      box.classList.remove('hidden');
    });
    $('setClose').addEventListener('click', () => box.classList.add('hidden'));
    box.addEventListener('click', e => {
      if (e.target === box) box.classList.add('hidden');
    });

    $('setGuide').addEventListener('click', () => {
      box.classList.add('hidden');
      openGuide();
    });

    $('setSfx').addEventListener('click', () => {
      if (window.DDFX && window.DDFX.toggle) window.DDFX.toggle();
      setTimeout(paintSfx, 30);
    });

    $('setFx').addEventListener('click', () => {
      fxOff = !fxOff;
      write(KEY_FX, fxOff);
      if (window.DDFX && window.DDFX.setFx) window.DDFX.setFx(!fxOff);
      paintFx();
    });

    $('setMotion').addEventListener('click', () => {
      lite = !lite;
      write(KEY_LITE, lite);
      paintLite();
    });

    // 账号管理 / 后台：跳到排行榜页对应位置
    const gotoLeader = sel => {
      box.classList.add('hidden');
      if (typeof switchTab === 'function') switchTab('leader');
      const target = $(sel);
      if (target) {
        target.scrollIntoView({ block: 'center', behavior: 'smooth' });
        target.classList.add('set-flash');
        setTimeout(() => target.classList.remove('set-flash'), 1200);
      }
    };
    $('setAccount').addEventListener('click', () => gotoLeader('meBox'));
    $('setAdmin').addEventListener('click', () => {
      const role = window.Cloud && window.Cloud.role ? window.Cloud.role() : '';
      if (role !== 'admin' && role !== 'author') {
        toast('这个账号没有后台权限');
        return;
      }
      gotoLeader('adminBox');
    });
  })();

  $('clearOk').addEventListener('click', () => {
    el.clear.classList.add('hidden');
    el.confetti.innerHTML = '';
  });

  el.pvCancel.addEventListener('click', closePreview);

  el.previewModal.addEventListener('click', e => {
    if (e.target === el.previewModal) closePreview();
  });

  el.pvGo.addEventListener('click', () => {
    if (el.pvGo.disabled) return;
    if (travel()) closePreview();
    else updatePreviewGo();
  });

  el.travel.addEventListener('click', () => openPreview(state.world + 1));

  el.reset.addEventListener('click', () => {
    if (!confirm('清空所有进度、回到第一颗星球，确定吗？')) return;
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch (e) {}
    state = newState();
    state.guideSeen = true; // 已经会玩了
    clickStamps.length = 0;
    pendingGain = 0;
    comboBreak();
    closePreview();
    applyWorld();
    scene.setWorld(0);
    if (window.DDPets) DDPets.onWorldEnter();
    buildUpgrades();
    buildAssets();
    buildRanks();
    buildAchs();
    buildWorldCards();
    el.clear.classList.add('hidden');
    el.confetti.innerHTML = '';
    render();
    save();
    // 云端一起清零，否则下次同步会把旧分数当成云端存档拉回来
    if (window.Cloud && window.Cloud.reset) window.Cloud.reset();
    flashTip('已重置');
  });

  /* 天气面板 */
  el.wxChip.addEventListener('click', () => {
    refreshWxPanel();
    el.wxModal.classList.remove('hidden');
  });

  el.timeChip.addEventListener('click', () => {
    refreshWxPanel();
    el.wxModal.classList.remove('hidden');
  });

  el.wxOk.addEventListener('click', () => el.wxModal.classList.add('hidden'));

  el.wxModal.addEventListener('click', e => {
    if (e.target === el.wxModal) el.wxModal.classList.add('hidden');
  });

  el.citySelect.addEventListener('change', () => {
    cityPref = el.citySelect.value;
    try {
      localStorage.setItem(CITY_KEY, cityPref);
    } catch (e) {}
    loadWeather(true);
  });

  el.wxAuto.addEventListener('click', () => {
    cityPref = 'auto';
    lastLoc = null;
    try {
      localStorage.setItem(CITY_KEY, 'auto');
      localStorage.removeItem(LOC_KEY);
    } catch (e) {}
    el.citySelect.value = 'auto';
    loadWeather(true);
  });

  el.wxRefresh.addEventListener('click', () => loadWeather(true));

  /* 开场动画 */
  function playIntro() {
    let seen = false;
    try {
      seen = localStorage.getItem(INTRO_KEY) === '1';
      localStorage.setItem(INTRO_KEY, '1');
    } catch (e) {}

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      el.intro.classList.add('out');
      setTimeout(() => {
        el.intro.classList.add('hidden');
        document.dispatchEvent(new CustomEvent('introDone'));
      }, 700);
      if (!state.guideSeen) setTimeout(openGuide, 640);
    };

    el.intro.classList.toggle('quick', seen);
    const skip = el.intro.querySelector('.intro-skip');
    if (skip) skip.textContent = seen ? '轻触任意处进入' : '晨安之作 · 5 秒后自动进入';
    // 第一次进来强制看完 5 秒（认识一下作者），看过的老朋友 1.5 秒可点掉
    setTimeout(finish, seen ? 1500 : 5000);
    el.intro.addEventListener('pointerdown', finish);
    document.addEventListener('keydown', finish, { once: true });
  }

  /* ---- 起步 ---- */
  load();

  applyWorld();
  buildUpgrades();
  buildAssets();
  buildRanks();
  buildAchs();
  buildWorldCards();
  buildCitySelect();

  checkRanks();
  checkAchs();

  if (state.worldDone && isLastWorld() && !state.cleared) {
    state.cleared = true;
    save();
    checkAchs();
    setTimeout(showClear, 700);
  }

  // 天气：先用缓存/模拟，再后台拉实时
  const cached = readWxCache();
  if (cached) {
    applyWx(
      { kind: cached.kind, temp: cached.temp, code: cached.code },
      cached.source,
      cached.place
    );
  } else {
    applyWx(simWx(), 'sim', '模拟天气');
  }

  render();
  renderClock();
  loadWeather(false);

  playIntro();

  // 身份/成就的兜底检查：累计星尘、股价市值、宠物战力这些「看不见的增长」
  // 以前只有点击、购买、交易时才检查，自动产出涨过门槛后要等下一次操作才升级，
  // 看起来就像「明明够了却不识别」。这里每 0.4 秒补一次，任何路径都不会漏。
  let checkAt = 0;
  function settleChecks() {
    checkRanks();
    checkAchs();
    render();
  }

  // 每秒自动产出：0.1s 一跳，顺便攒飞船回收的数字
  setInterval(() => {
    const gain = cps() * 0.1;
    if (gain > 0) {
      state.dust += gain;
      state.total += gain;
      pendingGain += gain;
    }

    if (combo > 0 && performance.now() - comboAt > CHAIN_WINDOW) comboBreak();
    resoTick();
    if (window.DDSystems) window.DDSystems.tick(100);
    markBests();
    render();

    const tNow = performance.now();
    if (tNow - checkAt > 400) {
      checkAt = tNow;
      settleChecks();
    }
  }, 100);

  // 宠物定期在星球表面刨星尘
  setInterval(() => {
    if (cps() > 0) scene.collect();
  }, 1700);

  // 采集无人机按自己的节奏俯冲采集（和宠物错开，看出是两拨人在干活）
  setInterval(() => {
    if (droneCount() > 0 && cps() > 0) scene.droneHarvest();
  }, 1200);

  // 时间/天气轻量刷新
  setInterval(renderClock, 15000);

  setInterval(save, AUTOSAVE_MS);
  window.addEventListener('pagehide', save);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) save();
  });

  /* ===================== 14. 给扩展系统用的接口 ===================== */
  window.DD = {
    get state() {
      return state;
    },
    worlds: WORLDS,
    featOpen: function (id) {
      return unlocked(id);
    },
    fmt: fmt,
    toast: toast,
    save: save,
    render: render,
    checkRanks: checkRanks,
    checkAchs: checkAchs,
    // 身份判定用的星尘（现金 + 股市里压着的钱）和它的两个构成项
    rankDust: rankDust,
    stockInvest: stockInvest,
    stockHeld: stockHeld,
    refreshRank: function () {
      recountRank();
      checkRanks();
      render();
    },
    switchTab: switchTab,
    // 登录门收起、跃迁等场景调用：把焦点从输入框上摘掉，让键盘继续能连点
    releaseKeys: blurField,
    addDust: function (n) {
      if (!(n > 0)) return;
      state.dust += n;
      state.total += n;
      checkRanks();
      checkAchs();
      render();
    },
    get cps() {
      return cps();
    },
    get clickPower() {
      return clickPower();
    },
    // 连击数：state 里没有 combo 字段，fx.js 之前读 S().combo 永远是 0
    get combo() {
      return combo;
    },
    // 小游戏计分用：升级后的总倍率（不含本星球倍率，星球倍率用 worlds[world].gain）
    get upgMult() {
      return (
        (1 + sumUp('click')) *
        (1 + sumUp('mult')) *
        Math.pow(RANK_CLICK, state.rank) *
        resoMult() *
        sysMult()
      );
    },
    get rep() {
      return totalRep();
    },

    // ===== 账号同步用：整份导出 / 整份替换，不做任何字段合并 =====
    exportData: function () {
      stashPlanet();
      prunePlanets();
      const d = JSON.parse(JSON.stringify(state));
      // 服务器的榜分只认顶层 total（它原本是「本星球累计」），所以上传副本里
      // 换成「所有星球累计之和」；真实的本星球累计另存 boardTotal，拉档时还原，
      // 绝不会把本机存档里的 total 改成分数。
      try {
        const bs = boardScore();
        d.boardScore = bs;
        d.boardTotal = Number(state.total) || 0;
        d.total = bs;
      } catch (e) {}
      return d;
    },
    importData: function (d) {
      if (!d || typeof d !== 'object') return false;
      hydrate(d);
      applyWorld();
      if (window.DD && window.DD.scene) window.DD.scene.setWorld(state.world);
      buildUpgrades();
      buildAssets();
      buildRanks();
      buildAchs();
      buildWorldCards();
      render();
      // 立刻落盘：不然刷新页面会读回上一个账号的本地旧档
      try {
        save();
      } catch (e) {}
      return true;
    },
    // 站长补发的星尘：钱包 + 累计 + 当前星球快照一起加
    credit: function (n) {
      n = Number(n) || 0;
      if (!(n > 0)) return;
      state.dust = (Number(state.dust) || 0) + n;
      state.total = (Number(state.total) || 0) + n;
      if (!state.pdata || typeof state.pdata !== 'object') state.pdata = {};
      if (!state.pdata[state.world]) state.pdata[state.world] = snapshotPlanet();
      const p = state.pdata[state.world];
      p.total = (Number(p.total) || 0) + n;
      try {
        save();
      } catch (e) {}
      render();
    },
    // 退出登录 / 切号前把内存和本地都清干净，绝不能残留上一个账号的进度
    clearAll: function () {
      try {
        for (const k of SAVE_KEYS) localStorage.removeItem(k);
        localStorage.removeItem(SAVE_BAK);
      } catch (e) {}
      state = newState();
      applyWorld();
      if (window.DD && window.DD.scene) window.DD.scene.setWorld(0);
      buildUpgrades();
      buildAssets();
      buildRanks();
      buildAchs();
      buildWorldCards();
      render();
    },
    rebuild: function () {
      buildUpgrades();
      buildAssets();
      buildRanks();
      buildAchs();
      buildWorldCards();
      render();
    }
  };
  window.DD.scene = scene;
  if (window.DDPets) window.DDPets.attach();
  if (window.DDSystems) window.DDSystems.attach();
})();
