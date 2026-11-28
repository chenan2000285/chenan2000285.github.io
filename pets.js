/* ============================================================
   点点星球 · 宠物与皮肤  (pets.js)
   1 皮肤数据  2 宠物数据  3 战力与加成  4 探索
   5 互动与说话  6 皮肤商店  7 面板渲染  8 画宠物  9 挂载
   ============================================================ */
(function (global) {
  'use strict';

  var $ = function (id) {
    return document.getElementById(id);
  };
  var D = function () {
    return window.DD;
  };
  var S = function () {
    return window.DD ? window.DD.state : null;
  };
  var TAU = Math.PI * 2;

  // 等级不设上限：每升一级，下一级的价钱乘 1.5
  var UP_BASE = 450; // 第 1 级升第 2 级的价钱
  var UP_GROW = 1.5;
  var MAX_PETS_SCENE = 8; // 同一颗星球上最多同时上场几只
  var PAT_CD = 20000;
  var SLOTS = 3;

  function clamp(v, a, b) {
    return v < a ? a : v > b ? b : v;
  }
  function rgba(hex, a) {
    var s = String(hex).replace('#', '');
    if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
    var n = parseInt(s, 16) || 0;
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  /* ===================== 1. 皮肤 =====================
     每颗星球 4 款：第一款自带，后三款用星尘购买。
     price 是「第一颗星球的价钱」，实际价格会乘本星球倍率。
     穿在宠物身上后，身体、肚皮、眼睛、光晕、头顶饰品一起换。
     ================================================= */
  var SKINS = [
    [
      // 0 暮紫
      {
        id: 'w0s0',
        name: '星尘',
        price: 0,
        acc: 'none',
        desc: '出生自带，毛色像晒过月光的紫绒。',
        c: {
          body: '#8b78bd',
          shade: '#4b3f6e',
          belly: '#ded4f5',
          accent: '#e8c477',
          eye: '#221a36',
          glow: '#b9a6f0'
        }
      },
      {
        id: 'w0s1',
        name: '月白',
        price: 1800,
        acc: 'star',
        desc: '整只泡在月光里，毛尖会轻轻发亮。',
        c: {
          body: '#cfd6e6',
          shade: '#98a2bb',
          belly: '#f6f8ff',
          accent: '#e8c477',
          eye: '#2c3550',
          glow: '#e8eeff'
        }
      },
      {
        id: 'w0s2',
        name: '熔金',
        price: 7200,
        acc: 'crown',
        desc: '把黄昏的金边缝在身上，走路带火星。',
        c: {
          body: '#dda94e',
          shade: '#a06f28',
          belly: '#ffeec9',
          accent: '#fff1c9',
          eye: '#3b2a12',
          glow: '#ffd27a'
        }
      },
      {
        id: 'w0s3',
        name: '极光',
        price: 26000,
        acc: 'halo',
        desc: '极光裁成的披风，一转头就是一道绿。',
        c: {
          body: '#6fd6c8',
          shade: '#2f8f94',
          belly: '#d6fff6',
          accent: '#b98cff',
          eye: '#12323a',
          glow: '#7effe0'
        }
      }
    ],
    [
      // 1 烈焰
      {
        id: 'w1s0',
        name: '熔岩',
        price: 0,
        acc: 'none',
        desc: '天生带一层余温，抱起来像暖手宝。',
        c: {
          body: '#d1652f',
          shade: '#8a3315',
          belly: '#ffd9a8',
          accent: '#ffcf6a',
          eye: '#2b0f07',
          glow: '#ff8a4a'
        }
      },
      {
        id: 'w1s1',
        name: '余烬',
        price: 5000,
        acc: 'star',
        desc: '灰里还藏着红，风一吹就亮一下。',
        c: {
          body: '#8a4a3a',
          shade: '#4a1f18',
          belly: '#d8a48a',
          accent: '#ff7a3a',
          eye: '#1b0a06',
          glow: '#ff5a2a'
        }
      },
      {
        id: 'w1s2',
        name: '焰心',
        price: 20000,
        acc: 'crown',
        desc: '最中间那撮火，亮得看不清轮廓。',
        c: {
          body: '#ffb03a',
          shade: '#d96a1a',
          belly: '#fff0c0',
          accent: '#fff7e0',
          eye: '#3a1d05',
          glow: '#ffcf6a'
        }
      },
      {
        id: 'w1s3',
        name: '琉璃',
        price: 68000,
        acc: 'halo',
        desc: '冷却后的火山玻璃，蓝得不像火家的人。',
        c: {
          body: '#7fd8e8',
          shade: '#3a8fa8',
          belly: '#e0fbff',
          accent: '#ff9ad8',
          eye: '#14323a',
          glow: '#9ff0ff'
        }
      }
    ],
    [
      // 2 霜蓝
      {
        id: 'w2s0',
        name: '霜白',
        price: 0,
        acc: 'none',
        desc: '毛上永远挂着一层薄霜。',
        c: {
          body: '#cfe3ee',
          shade: '#8fa9c0',
          belly: '#ffffff',
          accent: '#8fe0ff',
          eye: '#24405a',
          glow: '#bfefff'
        }
      },
      {
        id: 'w2s1',
        name: '极光',
        price: 18000,
        acc: 'halo',
        desc: '整夜趴在冰原上看极光，把自己看成了极光。',
        c: {
          body: '#7fe0c0',
          shade: '#3aa088',
          belly: '#e0fff4',
          accent: '#b48cff',
          eye: '#143a30',
          glow: '#8fffd8'
        }
      },
      {
        id: 'w2s2',
        name: '深海',
        price: 56000,
        acc: 'star',
        desc: '从冰层下最深的海沟里捞上来的颜色。',
        c: {
          body: '#3a6fa8',
          shade: '#1a3a5e',
          belly: '#bfe0ff',
          accent: '#7fd8ff',
          eye: '#08182a',
          glow: '#5fb8ff'
        }
      },
      {
        id: 'w2s3',
        name: '冰晶',
        price: 180000,
        acc: 'crystal',
        desc: '每一根毛都是一枚六角冰晶。',
        c: {
          body: '#a8c8ff',
          shade: '#5f7fc0',
          belly: '#f0f6ff',
          accent: '#ff9ad8',
          eye: '#1a2540',
          glow: '#c0d8ff'
        }
      }
    ],
    [
      // 3 翡翠
      {
        id: 'w3s0',
        name: '苔绿',
        price: 0,
        acc: 'none',
        desc: '在树根下睡了一整个雨季的毛色。',
        c: {
          body: '#7fa04a',
          shade: '#4a6628',
          belly: '#e0e8b0',
          accent: '#ffd36a',
          eye: '#1e2a10',
          glow: '#b8e07a'
        }
      },
      {
        id: 'w3s1',
        name: '花朝',
        price: 70000,
        acc: 'flower',
        desc: '走过的地方会多出一小丛花。',
        c: {
          body: '#e88fb0',
          shade: '#b05a7a',
          belly: '#ffe0ec',
          accent: '#ffe08a',
          eye: '#3a1420',
          glow: '#ffb8d8'
        }
      },
      {
        id: 'w3s2',
        name: '金秋',
        price: 220000,
        acc: 'star',
        desc: '叶子落下来那天的阳光，全部收进毛里。',
        c: {
          body: '#d8a03a',
          shade: '#a06a18',
          belly: '#ffeec0',
          accent: '#ff7a3a',
          eye: '#2e1e06',
          glow: '#ffcb6a'
        }
      },
      {
        id: 'w3s3',
        name: '雨林',
        price: 640000,
        acc: 'crown',
        desc: '深绿到发亮，还带着雨后的水汽。',
        c: {
          body: '#3aa88a',
          shade: '#16705a',
          belly: '#c0ffe8',
          accent: '#7fe0ff',
          eye: '#06281e',
          glow: '#5fffc0'
        }
      }
    ],
    [
      // 4 量子
      {
        id: 'w4s0',
        name: '电蓝',
        price: 0,
        acc: 'none',
        desc: '同时存在又不同时存在的一只。',
        c: {
          body: '#4ab8d8',
          shade: '#1a6f8a',
          belly: '#c9f6ff',
          accent: '#8ff0ff',
          eye: '#06222a',
          glow: '#8ff0ff'
        }
      },
      {
        id: 'w4s1',
        name: '干涉',
        price: 240000,
        acc: 'halo',
        desc: '两束光叠在一起，颜色一直在变。',
        c: {
          body: '#8f7aff',
          shade: '#4a3ab0',
          belly: '#e0d9ff',
          accent: '#8ff0ff',
          eye: '#140a3a',
          glow: '#b8a8ff'
        }
      },
      {
        id: 'w4s2',
        name: '超导',
        price: 780000,
        acc: 'crystal',
        desc: '零下两百度也不掉电的毛。',
        c: {
          body: '#d8d8e8',
          shade: '#8a8aa8',
          belly: '#ffffff',
          accent: '#58ffff',
          eye: '#22223a',
          glow: '#e8e8ff'
        }
      },
      {
        id: 'w4s3',
        name: '星云',
        price: 2600000,
        acc: 'star',
        desc: '在星云里洗过澡，身上有整片宇宙。',
        c: {
          body: '#ff7ad8',
          shade: '#b03a98',
          belly: '#ffd9f4',
          accent: '#8ff0ff',
          eye: '#3a0a2a',
          glow: '#ff9ae8'
        }
      }
    ],
    [
      // 5 虚空
      {
        id: 'w5s0',
        name: '虚空',
        price: 0,
        acc: 'none',
        desc: '看着它的时候，它也在看着你。',
        c: {
          body: '#4a3a6a',
          shade: '#241a3a',
          belly: '#b8a8d8',
          accent: '#c6a8ff',
          eye: '#0a0614',
          glow: '#a98ce0'
        }
      },
      {
        id: 'w5s1',
        name: '暗蚀',
        price: 900000,
        acc: 'halo',
        desc: '把光吞进去，只留下一点红。',
        c: {
          body: '#1a1a26',
          shade: '#080810',
          belly: '#6a6a8a',
          accent: '#ff4a6a',
          eye: '#ff2a4a',
          glow: '#ff5a7a'
        }
      },
      {
        id: 'w5s2',
        name: '星骸',
        price: 3200000,
        acc: 'star',
        desc: '一颗死去的星星剩下的骨头，被它捡来当外衣。',
        c: {
          body: '#d8cfb8',
          shade: '#9a9078',
          belly: '#fff8e8',
          accent: '#ffd27a',
          eye: '#2a2418',
          glow: '#ffebbf'
        }
      },
      {
        id: 'w5s3',
        name: '创世',
        price: 9800000,
        acc: 'crown',
        desc: '站在它旁边，会觉得一切刚要开始。',
        c: {
          body: '#ffffff',
          shade: '#b8c8ff',
          belly: '#ffffff',
          accent: '#ffd27a',
          eye: '#2a3a8a',
          glow: '#ffffff'
        }
      }
    ]
  ];

  /* ===================== 2. 宠物 =====================
     img 是宠物贴图（pets/<id>.png，动漫原图裁成的方形头像）；
     base 是 1 级战力；idle/big/feed/back 是它说话的语气库。
     ================================================= */
  var PETS = [
    [
      // 0 暮紫：只有一只
      {
        id: 'alya',
        name: '艾莉',
        title: '俄语同学',
        base: 10,
        idle: ['Хорошо，今天也陪你一会儿', '别、别误会，我只是路过', '想听俄语？就一句哦'],
        big: ['Хорошо！这次算你厉害', '我才没有很高兴呢！'],
        feed: ['……谢谢，味道还行', '下次换我请你'],
        back: ['顺路带回来的，别多想', '东西放这儿了，Хорошо']
      }
    ],
    [
      // 1 烈焰：两只
      {
        id: 'seven',
        name: '伍六七',
        title: '刺客',
        base: 42,
        idle: ['靓仔，剪头发不', '一把剪刀走天下', '今日份的帅气已送达'],
        big: ['哇，靓仔你好猛啊！', '这波我剪得漂亮！'],
        feed: ['好味！再来一份', '多谢靓仔'],
        back: ['帮你捡了一袋星尘', '我剪完头就回来了']
      },
      {
        id: 'meihua',
        name: '梅花十三',
        title: '梅花',
        base: 50,
        idle: ['……别靠太近', '梅花会在最冷的时候开', '你的手，稳一点'],
        big: ['这一下，够快', '难得夸你一句'],
        feed: ['多谢', '味道不错，收下了'],
        back: ['路上顺手清的', '我回来了，别担心']
      }
    ],
    [
      // 2 霜蓝：三只
      {
        id: 'asuna',
        name: '亚丝娜',
        title: '闪光',
        base: 130,
        idle: ['一起去吃点什么吧', '今天的剑，很快', '别站太远，我护得住你'],
        big: ['闪光！这一击漂亮吧', '太好了，我们一起赢的'],
        feed: ['好吃，你也吃一口', '谢谢，我很喜欢'],
        back: ['带回来了，够分', '我跑得比风快']
      },
      {
        id: 'rem',
        name: '雷姆',
        title: '蓝发女仆',
        base: 140,
        idle: ['雷姆在这里，主人', '要喝点热的吗', '姐姐大人也会夸你的'],
        big: ['雷姆，真的很高兴！', '主人最棒了，雷姆保证'],
        feed: ['谢谢主人，雷姆会好好吃', '很甜'],
        back: ['雷姆把星尘都收好了', '我回来了，主人']
      },
      {
        id: 'zero2',
        name: '零二',
        title: '红鬼',
        base: 150,
        idle: ['darling，看着我', '我是怪物，你怕吗', '蜂蜜味的，要尝吗'],
        big: ['这才像话，darling！', '我的心跳好快'],
        feed: ['甜的，还要', '喂我，darling'],
        back: ['我带回了很远的地方', 'darling，抱一下']
      }
    ],
    [
      // 3 翡翠：四只
      {
        id: 'kaguya',
        name: '辉夜',
        title: '大小姐',
        base: 320,
        idle: ['真是拿你没办法呢', '想让我说「可爱」？做梦', '今天的红茶，泡得不错'],
        big: ['哼，勉强合格', '我、我才没有心动'],
        feed: ['……还、还行吧', '再来一份也可以'],
        back: ['顺手拿的，不必谢', '本小姐出手，当然有']
      },
      {
        id: 'frieren',
        name: '芙莉莲',
        title: '千年精灵',
        base: 350,
        idle: ['人类真是短命又热闹', '这个魔法，我学了一百年', '要一起看星星吗'],
        big: ['人类，果然很有趣', '这一下，我记住了'],
        feed: ['甜的，人类真会做', '再来一点'],
        back: ['路上捡的，不值钱', '走了很远，也看到了很多']
      },
      {
        id: 'naruto',
        name: '鸣人',
        title: '火影',
        base: 380,
        idle: ['我迟早要当上火影！', '一碗拉面，什么都好说', '别放弃，我说到做到'],
        big: ['这就是我的忍道！', '看到没，我办到了！'],
        feed: ['拉面！最棒了', '再来一碗，多谢！'],
        back: ['我跑遍整片林子了', '带回来一堆，够用了吧']
      },
      {
        id: 'sasuke',
        name: '佐助',
        title: '写轮眼',
        base: 410,
        idle: ['……无聊', '别挡路', '复仇之前，不谈其他'],
        big: ['哼，还看得过去', '这一击，够了'],
        feed: ['……放那儿', '还行'],
        back: ['顺路罢了', '东西在那边，自己拿']
      }
    ],
    [
      // 4 量子：五只
      {
        id: 'sakura',
        name: '小樱',
        title: '樱',
        base: 600,
        idle: ['不许拖后腿哦', '医疗忍术，交给我', '樱花开的时候真好看'],
        big: ['看这一拳！', '我可不是以前的我了'],
        feed: ['好吃，谢谢你', '下次我请你吃丸子'],
        back: ['我带回来了，满满的', '我跑得可不慢']
      },
      {
        id: 'hinata',
        name: '雏田',
        title: '白眼',
        base: 640,
        idle: ['那、那个……我在这儿', '白眼，看得见你', '我会努力的'],
        big: ['我做到了……！', '谢谢你一直看着我'],
        feed: ['谢谢，很好吃', '我不客气了'],
        back: ['我带回来了，请收下', '我一路都在跟着你']
      },
      {
        id: 'kakashi',
        name: '卡卡西',
        title: '拷贝忍者',
        base: 680,
        idle: ['今天也迟到了，抱歉', '忍者的心得，慢慢教', '嗯？那边有猫'],
        big: ['这一手，写得不错', '千鸟——！'],
        feed: ['谢谢，味道可以', '再来一份'],
        back: ['路上顺手接了个任务', '带回来的，收好']
      },
      {
        id: 'gaara',
        name: '我爱罗',
        title: '砂瀑',
        base: 720,
        idle: ['砂会保护你', '我曾经也怕过', '现在的我，想守护村子'],
        big: ['砂缚柩！', '这力量，用在正道上'],
        feed: ['……谢谢', '我是第一次吃这个'],
        back: ['沙子替我搬回来了', '我带回来的']
      },
      {
        id: 'itachi',
        name: '鼬',
        title: '月读',
        base: 760,
        idle: ['原谅我，这是最后一次', '别被表象骗了', '你的眼睛，还看得清吗'],
        big: ['月读', '这一下，我认真的'],
        feed: ['……多谢', '味道很淡，我喜欢'],
        back: ['顺手带回来的', '我该走了']
      }
    ],
    [
      // 5 虚空：六只
      {
        id: 'miku',
        name: '初音',
        title: '电子歌姬',
        base: 1000,
        idle: ['听我唱一首吗', '声音飘得很远，对吧', '今天也一起唱吧'],
        big: ['这一声，传得很高！', '和声都亮了！'],
        feed: ['谢谢，嗓子暖和了', '再来一口'],
        back: ['我把歌带回来了', '一路都在哼']
      },
      {
        id: 'violet',
        name: '薇尔莉特',
        title: '自动手记人偶',
        base: 1060,
        idle: ['请问，要写一封信吗', '我在学习「爱」的意思', '你的手，很暖'],
        big: ['我明白了，一点点', '这一击，很漂亮'],
        feed: ['谢谢，很好吃', '我会记住这个味道'],
        back: ['信和星尘，都带回来了', '我去了很远的地方']
      },
      {
        id: 'kurumi',
        name: '狂三',
        title: '时之精灵',
        base: 1120,
        idle: ['呵呵，要陪我玩吗', '时间，是最甜的毒', '我的左眼，看得见哦'],
        big: ['刻刻帝！', '这一下，很合我意'],
        feed: ['谢谢，甜的', '再来一份，可以吗'],
        back: ['从时间里捞回来的', '我比你先到一步']
      },
      {
        id: 'rin',
        name: '凛',
        title: '远坂',
        base: 1180,
        idle: ['魔术师要随时准备着', '不许叫我大小姐', '宝石用完了，心疼'],
        big: ['这一发，看好了！', '哼，当然的'],
        feed: ['谢谢，味道不错', '再来一份'],
        back: ['从灵脉边捡的', '我回来了']
      },
      {
        id: 'levi',
        name: '利威尔',
        title: '人类最强',
        base: 1240,
        idle: ['别把后背交给不可靠的人', '脏，就扫干净', '选择吧，然后别后悔'],
        big: ['这一刀，够了', '给我站起来'],
        feed: ['……味道可以', '再来一份'],
        back: ['顺手清了几个', '东西在这儿']
      },
      {
        id: 'shinobu',
        name: '蝴蝶忍',
        title: '蝶',
        base: 1300,
        idle: ['蝴蝶会停在温柔的地方', '毒也是药，看怎么用', '笑一笑嘛'],
        big: ['虫之呼吸，舞', '这一下，很轻但很准'],
        feed: ['谢谢，苦的我也吃', '很甜'],
        back: ['蝶替我带回来了', '我飞了一圈']
      }
    ]
  ];

  /* 第 7–10 颗星球（曜金 / 幻梦 / 时序 / 终焉）各有自己的伙伴，不再复用第 5 颗星球的模板。 */
  PETS.push(
    [
      // 6 曜金
      {
        id: 'artoria',
        name: '阿尔托莉雅',
        title: '骑士王',
        base: 1500,
        idle: ['圆桌之上，没有退路', '这一剑，为的是誓约', '……有饭吃吗'],
        big: ['誓约胜利之剑！', '这一击，配得上王者之名'],
        feed: ['多谢，味道很好', '身为王者不该贪食……再来一份'],
        back: ['战果带回来了，收下', '远征归来，无恙']
      },
      {
        id: 'kurisu',
        name: '红莉栖',
        title: '天才少女',
        base: 1600,
        idle: ['别用那种眼神看我，笨蛋', '这是实验数据，不是直觉', '世界线，不会自己改变'],
        big: ['看到了吗，这就是理论！', '哼，实验成功'],
        feed: ['……谢谢，还不错', '热量？我、我今天不算'],
        back: ['带回来的样本，别乱碰', '观测完毕']
      },
      {
        id: 'nakano',
        name: '三玖',
        title: '中野家三女',
        base: 1700,
        idle: ['战国武将的事，我懂很多', '那个……我也在努力', '耳机借你听一首'],
        big: ['我、我也能行！', '这次没有输'],
        feed: ['谢谢……很好吃', '可以再来一点吗'],
        back: ['一路都在听歌', '带回来的，给你']
      },
      {
        id: 'asuka',
        name: '明日香',
        title: '二号机驾驶员',
        base: 1800,
        idle: ['笨蛋，别拖后腿', '我可是天才', '这种程度就想赢我？'],
        big: ['看好了，这才是实力！', '本小姐出手，当然赢'],
        feed: ['还行吧，勉强吃', '味道不错，算你及格'],
        back: ['我一个人就够了', '战利品带回来了，别谢']
      },
      {
        id: 'yor',
        name: '约尔',
        title: '荆棘公主',
        base: 1900,
        idle: ['今天的晚饭，想吃什么', '工作的事，别问', '针线活我也会'],
        big: ['这一击，很干净', '结束了，收工'],
        feed: ['谢谢，很好吃', '我做饭不太行……'],
        back: ['顺手办完的', '回来了，饭做好了']
      }
    ],
    [
      // 7 幻梦
      {
        id: 'nezuko',
        name: '祢豆子',
        title: '鬼',
        base: 2300,
        idle: ['唔——唔！', '……（点了点头）', '（轻轻拍你的手）'],
        big: ['唔！', '（眼睛一下子亮了）'],
        feed: ['唔唔（好吃）', '……（再来一口）'],
        back: ['（抱着星尘回来）', '唔——']
      },
      {
        id: 'eru',
        name: '千反田',
        title: '好奇的千金',
        base: 2450,
        idle: ['我很好奇！', '这里，有什么理由吗', '请告诉我'],
        big: ['原来如此！', '我明白了'],
        feed: ['谢谢，很美味', '这个做法，我也很好奇'],
        back: ['一路都在想问题', '带回来了，请']
      },
      {
        id: 'shiro',
        name: '白',
        title: '游戏天才',
        base: 2600,
        idle: ['游戏，一起玩吗', '白，会赢的', '哥哥不在，也没关系'],
        big: ['白，赢了', '这一步，算到了'],
        feed: ['好吃，甜的', '再来'],
        back: ['带回来了，很多', '白，没输']
      },
      {
        id: 'flandre',
        name: '芙兰',
        title: '恶魔之妹',
        base: 2750,
        idle: ['陪我玩嘛', '捏碎的话，会痛吗', '四百九十五年，好无聊'],
        big: ['看，碎掉了！', '好玩，再来一次'],
        feed: ['甜的，喜欢', '再给我一块'],
        back: ['带回来了，红色的', '我出去转了转']
      },
      {
        id: 'mikoto',
        name: '御坂美琴',
        title: '超电磁炮',
        base: 2900,
        idle: ['别碰我的硬币', '超电磁炮，看过吗', '这附近有呱太吗'],
        big: ['接好了！', '这就是等级五'],
        feed: ['谢谢，我开动了', '好吃，再来一份'],
        back: ['跑了一圈，顺便充了电', '带回来的，别客气']
      }
    ],
    [
      // 8 时序
      {
        id: 'homura',
        name: '晓美焰',
        title: '时之魔法少女',
        base: 3500,
        idle: ['这次，我不会再失败', '时间，还能再来一次', '别靠太近'],
        big: ['时间停止', '这一次，我算好了'],
        feed: ['……谢谢', '吃一点就够了'],
        back: ['从别的世界线带回来的', '我又转了一圈']
      },
      {
        id: 'elaina',
        name: '伊蕾娜',
        title: '灰之魔女',
        base: 3750,
        idle: ['我是灰之魔女，伊蕾娜', '旅行者的故事，要听吗', '钱，还是要收的'],
        big: ['这就是魔女的本事', '漂亮吧'],
        feed: ['谢谢，旅费就免了', '味道不错'],
        back: ['一路飞回来的', '带回来的特产']
      },
      {
        id: 'megumin',
        name: '惠惠',
        title: '爆裂魔法使',
        base: 4000,
        idle: ['爆裂魔法，是最强的', '今天也只能放一发', 'Explosion！'],
        big: ['Explosion——！', '看到了吗，这就是爆裂'],
        feed: ['谢谢，恢复了一点魔力', '再来一份'],
        back: ['炸完顺手捡的', '我回来了，扶我一下']
      },
      {
        id: 'bocchi',
        name: '波奇',
        title: '吉他英雄',
        base: 4250,
        idle: ['啊、啊……你好', '吉他，我会弹', '社恐，抱歉'],
        big: ['我、我做到了！', '（一口气弹完了一整段）'],
        feed: ['谢谢……我、我开动了', '好吃到想哭'],
        back: ['一路都在弹吉他', '带回来了，请、请收下']
      },
      {
        id: 'shana',
        name: '夏娜',
        title: '火雾战士',
        base: 4500,
        idle: ['吵死了吵死了吵死了', '菠萝面包，给我', '火雾战士，在此'],
        big: ['贽殿遮那！', '这一击，燃尽了'],
        feed: ['菠萝面包！', '好吃，还要'],
        back: ['烧完了，顺手带回来', '我回来了']
      }
    ],
    [
      // 9 终焉
      {
        id: 'mikasa',
        name: '三笠',
        title: '调查兵团',
        base: 5500,
        idle: ['这个世界，很残酷', '围巾，还暖和', '我会保护你'],
        big: ['这一刀，够了', '别死在我前面'],
        feed: ['……谢谢', '够了'],
        back: ['清完了，回来', '带回来的']
      },
      {
        id: 'nobara',
        name: '钉崎野蔷薇',
        title: '咒术师',
        base: 5900,
        idle: ['我可是很强的好吧', '钉子，够用', '别小看乡下人'],
        big: ['共鸣——！', '这一下，扎心了吧'],
        feed: ['谢谢，我开动了', '好吃，再来'],
        back: ['一路顺手清了', '带回来的，收好']
      },
      {
        id: 'makima',
        name: '玛奇玛',
        title: '支配恶魔',
        base: 6300,
        idle: ['坐下来，听我说', '我，喜欢平等的关系', '狗，要听话'],
        big: ['这样就好', '乖'],
        feed: ['谢谢，一起吃吧', '味道，不错'],
        back: ['安排好了', '带回来的']
      },
      {
        id: 'illya',
        name: '伊莉雅',
        title: '魔法少女',
        base: 6700,
        idle: ['魔法少女，伊莉雅！', '一起玩吧', '哥哥，你在哪'],
        big: ['魔法少女，变身！', '看我的！'],
        feed: ['谢谢，好吃', '再来一个'],
        back: ['飞回来的', '带回来啦']
      },
      {
        id: 'roxy',
        name: '洛琪希',
        title: '水圣级魔术师',
        base: 7100,
        idle: ['师傅，请多指教', '水圣级魔术，看好了', '我也是有徒弟的人了'],
        big: ['水之加护！', '这一下，认真了'],
        feed: ['谢谢，很好吃', '再来一份'],
        back: ['从迷宫带回来的', '我回来了']
      }
    ]
  );

  var BY_ID = {};
  PETS.forEach(function (list, wi) {
    list.forEach(function (p, i) {
      p.world = wi;
      p.index = i;
      BY_ID[p.id] = p;
    });
  });

  /* ===================== 3. 战力 / 加成 ===================== */

  function gainAt(wi) {
    return D() && D().worlds[wi] ? D().worlds[wi].gain : 1;
  }
  function gain() {
    return gainAt((S() && S().world) || 0);
  }
  function pets() {
    return S().pets;
  }
  function owned(id) {
    var p = S() && S().pets;
    return (p && p.owned[id]) || null;
  }
  function species() {
    return PETS[(S() && S().world) || 0] || [];
  }
  // 宠物系统从开局就开放：每颗星球都有自己的伙伴，换星球也能带着走
  function featOpen() {
    return !!(D() && D().featOpen ? D().featOpen('pets') : true);
  }

  function levelOf(id) {
    var o = owned(id);
    return o ? Math.max(1, Math.round(o.lv) || 1) : 0;
  }

  function powerOf(p, lv) {
    return Math.round(p.base * (1 + (lv - 1) * 0.35));
  }

  // 所有星球、所有已经招募到的伙伴（图鉴是全局的，不再只看当前星球）
  function allOwned() {
    var out = [];
    PETS.forEach(function (list) {
      (list || []).forEach(function (p) {
        if (owned(p.id)) out.push(p);
      });
    });
    return out;
  }

  // ---- 探索排队：按战力从高到低 ----
  // 已经在路上的伙伴不再重复派，空闲的按战力排序，第 1 个位置派最强的
  function onTrip(id) {
    var ex = (pets() && pets().exps) || [];
    for (var i = 0; i < ex.length; i++) if (ex[i] && ex[i].pet === id) return true;
    return false;
  }

  function rankedFree() {
    return allOwned()
      .filter(function (p) {
        return !onTrip(p.id);
      })
      .sort(function (a, b) {
        return powerOf(b, levelOf(b.id)) - powerOf(a, levelOf(a.id));
      });
  }

  // 探索位 idx 该派谁：只派还没出门的，战力高的先上
  function tripPetFor(idx) {
    var free = rankedFree();
    if (!free.length) return null;
    return free[Math.min(idx, free.length - 1)];
  }

  // 探索位 idx 空着时，排队轮到谁（不足则 null，只用于界面提示）
  function tripPreview(idx) {
    var free = rankedFree();
    return free[idx] || null;
  }

  function petPower() {
    var st = S();
    if (!st || !st.pets || !featOpen()) return 0;
    var sum = 0;
    allOwned().forEach(function (p) {
      sum += powerOf(p, levelOf(p.id));
    });
    return sum;
  }

  function skinList(wi) {
    return SKINS[wi] || SKINS[0];
  }

  function ownedSkinCount() {
    var st = S();
    if (!st || !st.pets) return 0;
    var n = 0;
    skinList(st.world).forEach(function (s) {
      if (s.price === 0 || (st.pets.skins && st.pets.skins[s.id])) n += 1;
    });
    return n;
  }

  // 宠物加成：比星舰更狠一点（星舰是 log×0.45，宠物是 log×0.55 + 皮肤收藏）
  function petMult() {
    if (!featOpen()) return 1;
    var p = petPower();
    return 1 + Math.log10(1 + p) * 0.55 + ownedSkinCount() * 0.015;
  }

  function skinFor(p) {
    var o = owned(p.id);
    var list = skinList(p.world);
    var idx = o && typeof o.skin === 'number' ? o.skin : 0;
    return list[idx] || list[0];
  }

  function scenePets() {
    var st = S();
    if (!st || !st.pets || !featOpen()) return [];
    var out = [];
    allOwned()
      .sort(function (a, b) {
        return powerOf(b, levelOf(b.id)) - powerOf(a, levelOf(a.id));
      })
      .slice(0, MAX_PETS_SCENE)
      .forEach(function (p) {
        var sk = skinFor(p);
        out.push({ id: p.id, name: p.name, colors: sk.c, acc: sk.acc });
      });
    return out;
  }

  function previewPet(wi) {
    var list = PETS[wi] || PETS[0];
    var p = list[0];
    var sk = (SKINS[wi] || SKINS[0])[0];
    return { id: p.id, name: p.name, colors: sk.c, acc: sk.acc };
  }

  function refreshScene() {
    var st = S();
    if (st && D() && D().scene && D().scene.setPets) D().scene.setPets(scenePets());
  }

  /* ===================== 4. 探索 ===================== */

  var DESTS = [
    { id: 'd1', name: '星草坡', icon: '🌿', min: 5, need: 0, rate: 30 },
    { id: 'd2', name: '流星旷野', icon: '☄️', min: 20, need: 80, rate: 44 },
    { id: 'd3', name: '幻境裂隙', icon: '🌌', min: 60, need: 400, rate: 60 }
  ];

  function fmtLeft(ms) {
    var s = Math.max(0, Math.ceil(ms / 1000));
    var m = Math.floor(s / 60);
    var ss = s % 60;
    return m + ':' + (ss < 10 ? '0' : '') + ss;
  }

  function launch(slot, dest) {
    if (petPower() < dest.need) {
      D().toast('宠物战力不够，先喂喂它们', 1600);
      return;
    }
    var who = tripPetFor(slot);
    if (!who) {
      D().toast('能出门的伙伴都在路上了，先领回一只', 1800);
      return;
    }
    var secs = dest.min * 60;
    var reward = Math.round(
      D().cps * secs * dest.rate + 600 * gain() + petPower() * dest.rate * 0.5
    );
    pets().exps[slot] = {
      dest: dest.id,
      name: dest.name,
      icon: dest.icon,
      endsAt: Date.now() + secs * 1000,
      reward: reward,
      startedAt: Date.now(),
      pet: who.id
    };
    var pet = BY_ID[pets().exps[slot].pet];
    if (pet) speakLine(pet, 'idle', '我去' + dest.name + '啦！');
    D().toast(
      '🐾 ' + (pet ? pet.name : '宠物') + ' 出发去' + dest.name + '（' + dest.min + ' 分钟）',
      2200
    );
    render(true);
    D().save();
  }

  function claim(slot) {
    var e = pets().exps[slot];
    if (!e || Date.now() < e.endsAt) return;
    pets().exps[slot] = null;
    pets().done += 1;
    if (S().stats) S().stats.exps = (S().stats.exps || 0) + 1;
    D().addDust(e.reward);
    var pet = BY_ID[e.pet] || species()[0];
    speakLine(pet, 'back');
    D().toast('🎁 ' + pet.name + ' 带回来 +' + D().fmt(e.reward) + ' 星尘', 2400);
    if (window.DDFX) DDFX.sfx.mini(true);
    D().checkAchs();
    D().checkRanks();
    render(true);
    D().save();
  }

  /* ===================== 5. 互动 / 说话 ===================== */

  // 升级价钱：第 1 级升第 2 级是 UP_BASE，之后每一级都乘 UP_GROW（默认 1.5）
  // 价格按宠物自己所属星球的倍率算：在后期星球养前期伙伴也不会白菜价
  function upCost(lv, p) {
    var g = p ? gainAt(p.world) : gain();
    return Math.round(UP_BASE * g * Math.pow(UP_GROW, Math.max(0, lv - 1)));
  }

  // 再升一级之后，下一级会贵多少倍（给界面显示用）
  function nextGrow() {
    return UP_GROW;
  }

  function adoptCost(p) {
    return Math.round(4000 * gainAt(p.world) * Math.pow(2.2, Math.max(0, p.index - 1)));
  }

  function pat(id) {
    var st = S(),
      o = owned(id),
      p = BY_ID[id];
    if (!o || !p) return;
    var now = Date.now();
    if (st.pets.pat[id] && now - st.pets.pat[id] < PAT_CD) {
      D().toast('它刚被摸过，等一会儿再摸', 1400);
      return;
    }
    st.pets.pat[id] = now;
    o.aff = Math.floor(o.aff || 0) + 4;
    if (window.DDFX) DDFX.sfx.orb();
    speakLine(p, 'idle');
    D().checkAchs();
    render(true);
    D().save();
  }

  // 点一下直接升 1 级，等级没有上限，但越往上一级越贵（每级 ×1.5）
  function levelUp(id) {
    var st = S(),
      o = owned(id),
      p = BY_ID[id];
    if (!o || !p) return;
    var lv = Math.max(1, Math.round(o.lv) || 1);
    var cost = upCost(lv, p);
    if (st.dust < cost) {
      D().toast('星尘不够，还差 ' + D().fmt(cost - st.dust), 1600);
      return;
    }
    st.dust -= cost;
    o.lv = lv + 1;
    if (window.DDFX) DDFX.sfx.buy();
    speakLine(p, 'big');
    onLevel(p, o);
    D().checkAchs();
    D().checkRanks();
    D().render();
    render(true);
    D().save();
  }

  function onLevel(p, o) {
    D().toast('✨ ' + p.name + ' 升到 Lv.' + o.lv + '，战力 ' + powerOf(p, o.lv), 2000);
    if (window.DDFX) DDFX.sfx.mini(true);
    refreshScene();
  }

  function adopt(id) {
    var st = S(),
      p = BY_ID[id];
    if (!p || owned(id)) return;
    if (p.world > (st.world || 0)) {
      var wn =
        (D().worlds[p.world] && D().worlds[p.world].name) || '第 ' + (p.world + 1) + ' 颗星球';
      D().toast('还没到「' + wn + '」，遇不到它', 1800);
      return;
    }
    var cost = adoptCost(p);
    if (st.dust < cost) {
      D().toast('星尘不够招募它', 1400);
      return;
    }
    st.dust -= cost;
    st.pets.owned[id] = { lv: 1, aff: 0, skin: 0 };
    if (window.DDFX) DDFX.sfx.mini(true);
    D().toast('🎉 ' + p.name + ' 加入了你！', 2200);
    speakLine(p, 'idle');
    refreshScene();
    D().checkAchs();
    D().checkRanks();
    D().render();
    render(true);
    D().save();
  }

  function equip(id, skinIdx) {
    var st = S(),
      o = owned(id),
      p = BY_ID[id];
    if (!o || !p) return;
    var skin = skinList(p.world)[skinIdx];
    if (!skin) return;
    if (skin.price > 0 && !(st.pets.skins && st.pets.skins[skin.id])) {
      D().toast('还没买这款皮肤', 1400);
      return;
    }
    o.skin = skinIdx;
    if (window.DDFX) DDFX.sfx.buy();
    D().toast('👗 ' + p.name + ' 换上了「' + skin.name + '」', 1800);
    refreshScene();
    D().render();
    render(true);
    D().save();
  }

  function buySkin(skin) {
    var st = S();
    if (!skin || skin.price <= 0) return;
    if (st.pets.skins && st.pets.skins[skin.id]) {
      D().toast('已经买过了', 1200);
      return;
    }
    var price = Math.round(skin.price * gain());
    if (st.dust < price) {
      D().toast('星尘不够', 1400);
      return;
    }
    st.dust -= price;
    st.pets.skins[skin.id] = true;
    if (window.DDFX) DDFX.sfx.mini(true);
    var pet = allOwned()[0];
    if (pet) {
      var idx = skinList(pet.world).indexOf(skin);
      owned(pet.id).skin = idx;
      refreshScene();
    }
    D().toast(
      '👗 皮肤「' + skin.name + '」已收藏' + (pet ? '，' + pet.name + ' 先穿上了' : ''),
      2400
    );
    D().checkAchs();
    D().render();
    render(true);
    D().save();
  }

  /* ---- 说话气泡 ---- */
  var sayTimer = 0;

  function pickOwnedId() {
    var list = allOwned();
    if (!list.length) return null;
    return list[Math.floor(Math.random() * list.length)].id;
  }

  function lineOf(p, kind) {
    var arr = p[kind] && p[kind].length ? p[kind] : p.idle || ['…'];
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function showBubble(p, text) {
    var box = $('petSay');
    if (!box || !p) return;
    var nm = $('petSayName');
    if (nm) nm.innerHTML = '<b>' + p.name + '</b>' + (p.title ? '<i>· ' + p.title + '</i>' : '');
    $('petSayText').textContent = text;
    var av = $('petSayAv');
    if (av) {
      var sk = skinFor(p);
      av.innerHTML = '';
      av.style.setProperty('--ring', sk.c.glow || '#ffffff');
      var avS = global.innerWidth && global.innerWidth < 380 ? 44 : 50;
      av.style.width = av.style.height = av.style.flexBasis = avS + 'px';
      av.style.borderRadius = Math.round(avS * 0.33) + 'px';
      var cv = document.createElement('canvas');
      av.appendChild(cv);
      drawThumb(cv, p, sk, avS);
    }
    box.classList.remove('hidden');
    box.classList.remove('on');
    void box.offsetWidth;
    box.classList.add('on');
    clearTimeout(sayTimer);
    sayTimer = setTimeout(function () {
      box.classList.remove('on');
    }, 4600);
  }

  // 让某只宠物说一句；不指定就随机挑一只
  function speakLine(p, kind, forced) {
    if (!featOpen()) return;
    if (!p) p = BY_ID[pickOwnedId()];
    if (!p || !owned(p.id)) return;
    var text = forced || lineOf(p, kind || 'idle');
    showBubble(p, text);
  }

  function speak(kind, id) {
    var p = id ? BY_ID[id] : BY_ID[pickOwnedId()];
    speakLine(p, kind || 'idle');
  }

  /* ===================== 6. 面板渲染 ===================== */

  var sig = '';
  var slotEls = [];
  var interactiveEls = [];
  var barEls = [];
  var lastWorld = -1;

  function signature() {
    var st = S();
    if (!st || !st.pets) return '';
    var ids = [];
    Object.keys(st.pets.owned).forEach(function (k) {
      var o = st.pets.owned[k];
      ids.push(k + ':' + o.lv + ':' + o.skin);
    });
    ids.sort();
    var exps = st.pets.exps
      .map(function (e) {
        return e ? e.dest + e.endsAt : '-';
      })
      .join(',');
    return (
      st.world +
      '|' +
      ids.join(',') +
      '|' +
      exps +
      '|' +
      Object.keys(st.pets.skins || {})
        .sort()
        .join(',')
    );
  }

  function statLine() {
    $('petPower').textContent = D().fmt(petPower());
    $('petMult').textContent = '×' + petMult().toFixed(2);
    $('petDone').textContent = D().fmt(pets().done);
  }

  // 气泡里的小头像：铺满方片，边角由外层圆角裁掉
  function drawThumb(cv, p, skin, size) {
    var dpr = Math.min(global.devicePixelRatio || 1, 2);
    cv.width = Math.round(size * dpr);
    cv.height = Math.round(size * dpr);
    cv.style.width = size + 'px';
    cv.style.height = size + 'px';
    var ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawPetFace(ctx, size / 2, size / 2, size, p.id, skin.c, 0.33);
  }

  function paintPortrait(cv, p, skin, size) {
    var dpr = Math.min(global.devicePixelRatio || 1, 2);
    cv.width = Math.round(size * dpr);
    cv.height = Math.round(size * dpr);
    cv.style.width = size + 'px';
    cv.style.height = size + 'px';
    var ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var g = ctx.createRadialGradient(
      size * 0.5,
      size * 0.46,
      0,
      size * 0.5,
      size * 0.5,
      size * 0.55
    );
    g.addColorStop(0, rgba(skin.c.glow, 0.3));
    g.addColorStop(1, rgba(skin.c.glow, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    drawPetFace(ctx, size * 0.5, size * 0.51, size * 0.86, p.id, skin.c, 0.26);
  }

  function petCard(p) {
    var st = S();
    var o = owned(p.id);
    var li = document.createElement('li');
    li.className = 'pet-card' + (o ? '' : ' locked');
    var av = document.createElement('div');
    av.className = 'pet-av';
    var skin = o ? skinFor(p) : skinList(p.world)[0];
    var cv = document.createElement('canvas');
    av.appendChild(cv);
    paintPortrait(cv, p, skin, 56);
    li.appendChild(av);

    var info = document.createElement('div');
    info.className = 'pet-info';

    if (o) {
      var lv = Math.max(1, Math.round(o.lv) || 1);
      var cost = upCost(lv, p);
      // 等级没有上限，进度条改成「离下一级还差多少星尘」
      var pct = Math.max(2, Math.min(100, Math.round((st.dust / Math.max(1, cost)) * 100)));
      info.innerHTML =
        '<div class="pet-line"><b>' +
        p.name +
        '</b><span class="pet-title">' +
        p.title +
        '</span>' +
        '<em class="pet-lv">Lv.' +
        lv +
        '</em>' +
        '<em class="pet-on">上场中</em></div>' +
        '<div class="pet-bar" title="攒够下一级的星尘"><s style="width:' +
        pct +
        '%"></s></div>' +
        '<div class="pet-meta">战力 ' +
        D().fmt(powerOf(p, lv)) +
        ' · 亲密度 ' +
        Math.floor(o.aff || 0) +
        ' · 皮肤「' +
        skin.name +
        '」</div>' +
        '<div class="pet-ops">' +
        '<button type="button" data-up="' +
        p.id +
        '">升 1 级 ' +
        D().fmt(cost) +
        '</button>' +
        '<button type="button" data-pat="' +
        p.id +
        '">摸摸</button>' +
        '<button type="button" data-skin="' +
        p.id +
        '">换肤</button>' +
        '</div>' +
        '<div class="pet-tip">无等级上限 · 每升一级，下一级贵 ×' +
        nextGrow() +
        '</div>' +
        '<div class="pet-skins hidden" data-skins="' +
        p.id +
        '"></div>';

      info.querySelector('[data-pat]').addEventListener('click', function () {
        pat(p.id);
      });
      var ub = info.querySelector('[data-up]');
      if (ub) {
        ub.addEventListener('click', function () {
          levelUp(p.id);
        });
        interactiveEls.push({ el: ub, cost: cost });
      }
      var bf = info.querySelector('.pet-bar > s');
      if (bf) barEls.push({ el: bf, cost: cost });
      info.querySelector('[data-skin]').addEventListener('click', function () {
        var box = info.querySelector('[data-skins]');
        if (!box.classList.contains('hidden')) {
          box.classList.add('hidden');
          return;
        }
        box.classList.remove('hidden');
        box.innerHTML = '';
        skinList(p.world).forEach(function (s, idx) {
          var has = s.price === 0 || (st.pets.skins && st.pets.skins[s.id]);
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'skin-dot' + (idx === (o.skin || 0) ? ' on' : '') + (has ? '' : ' off');
          btn.title = s.name;
          var sc = document.createElement('canvas');
          sc.width = 48;
          sc.height = 48;
          sc.style.width = '24px';
          sc.style.height = '24px';
          btn.appendChild(sc);
          drawSwatch(sc.getContext('2d'), s.c, 24);
          var lab = document.createElement('i');
          lab.textContent = s.name;
          btn.appendChild(lab);
          btn.addEventListener('click', function () {
            if (!has) {
              D().toast('这款皮肤还没买，去下面皮肤商店看看', 1600);
              return;
            }
            equip(p.id, idx);
          });
          box.appendChild(btn);
        });
      });
    } else if (p.world > (st.world || 0)) {
      // 还没到的星球：看得到它在图鉴里，但走不过去就碰不到
      var wn2 =
        (D().worlds[p.world] && D().worlds[p.world].name) || '第 ' + (p.world + 1) + ' 颗星球';
      info.innerHTML =
        '<div class="pet-line"><b>？？？</b><span class="pet-title">未解锁</span></div>' +
        '<div class="pet-meta">🔒 到「' +
        wn2 +
        '」才能遇见它</div>' +
        '<div class="pet-ops"><button type="button" disabled>未解锁</button></div>';
    } else {
      var acost = adoptCost(p);
      info.innerHTML =
        '<div class="pet-line"><b>？？？</b><span class="pet-title">' +
        p.title +
        '</span></div>' +
        '<div class="pet-meta">还没遇见它 · 战力 ' +
        D().fmt(powerOf(p, 1)) +
        ' 起步</div>' +
        '<div class="pet-ops"><button type="button" data-adopt="' +
        p.id +
        '" data-cost="' +
        acost +
        '">招募 ' +
        D().fmt(acost) +
        '</button></div>';
      var ab = info.querySelector('[data-adopt]');
      ab.addEventListener('click', function () {
        adopt(p.id);
      });
      interactiveEls.push({ el: ab, cost: acost });
    }

    li.appendChild(info);
    return li;
  }

  function drawSwatch(ctx, c, size) {
    var g = ctx.createLinearGradient(0, 0, 0, size);
    g.addColorStop(0, c.body);
    g.addColorStop(1, c.shade);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size * 0.45, 0, TAU);
    ctx.fill();
    ctx.fillStyle = c.belly;
    ctx.beginPath();
    ctx.ellipse(size / 2, size * 0.62, size * 0.2, size * 0.13, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = c.accent;
    ctx.beginPath();
    ctx.arc(size * 0.68, size * 0.3, size * 0.1, 0, TAU);
    ctx.fill();
  }

  function rebuild() {
    var st = S();
    if (!st || !$('petList')) return;
    interactiveEls = [];
    barEls = [];
    slotEls = [];
    lastWorld = st.world;

    var all = [];
    PETS.forEach(function (grp) {
      (grp || []).forEach(function (p) {
        all.push(p);
      });
    });
    var got = all.filter(function (p) {
      return owned(p.id);
    }).length;
    $('petCount').textContent = got + '/' + all.length;

    var list = $('petList');
    list.innerHTML = '';
    // 全局图鉴：按星球分组，所有星球的伙伴都能看到、招募、上阵
    var cur = st.world;
    PETS.forEach(function (grp, wi) {
      if (!grp || !grp.length) return;
      var title = document.createElement('li');
      title.className = 'pet-group';
      var wname = (D().worlds[wi] && D().worlds[wi].name) || '第 ' + (wi + 1) + ' 颗星球';
      var here = grp.filter(function (p) {
        return owned(p.id);
      }).length;
      title.innerHTML =
        '<b>' +
        wname +
        '</b>' +
        (wi === cur ? '<em>当前星球</em>' : wi > cur ? '<em>未到达</em>' : '') +
        '<span>' +
        here +
        '/' +
        grp.length +
        ' 只</span>';
      list.appendChild(title);
      grp.forEach(function (p) {
        list.appendChild(petCard(p));
      });
    });

    // 探索泊位
    var wrap = $('petExp');
    wrap.innerHTML = '';
    for (var i = 0; i < SLOTS; i++) {
      (function (idx) {
        var e = st.pets.exps[idx];
        var li = document.createElement('li');
        li.className = 'exp-item';
        if (!e) {
          var next = tripPreview(idx);
          li.innerHTML =
            '<div class="exp-title">探索位 ' +
            (idx + 1) +
            ' · 空着' +
            '<em data-left="' +
            idx +
            '">空闲</em></div>' +
            (next
              ? '<div class="exp-reward">按战力排队：' +
                next.name +
                ' · ' +
                D().fmt(powerOf(next, levelOf(next.id))) +
                ' 战力</div>'
              : allOwned().length
                ? '<div class="exp-reward">没有空闲的伙伴了，先领回一只</div>'
                : '') +
            '<div class="exp-ops">' +
            DESTS.map(function (d, k) {
              return (
                '<button type="button" data-slot="' +
                idx +
                '" data-d="' +
                k +
                '"' +
                (petPower() < d.need ? ' disabled' : '') +
                '>' +
                d.icon +
                ' ' +
                d.name +
                ' · ' +
                d.min +
                '分</button>'
              );
            }).join('') +
            '</div>';
          li.querySelectorAll('[data-d]').forEach(function (b) {
            b.addEventListener('click', function () {
              launch(Number(b.dataset.slot), DESTS[Number(b.dataset.d)]);
            });
          });
          slotEls.push({ li: li, left: li.querySelector('[data-left]'), btn: null });
        } else {
          var pet = BY_ID[e.pet];
          li.innerHTML =
            '<div class="exp-title">' +
            (e.icon || '🐾') +
            ' ' +
            e.name +
            '<em data-left="' +
            idx +
            '">' +
            fmtLeft(e.endsAt - Date.now()) +
            '</em></div>' +
            '<div class="exp-reward">' +
            (pet ? pet.name : '宠物') +
            ' 预计带回 ' +
            D().fmt(e.reward) +
            ' 星尘</div>' +
            '<button type="button" class="exp-claim" data-claim="' +
            idx +
            '"' +
            (Date.now() < e.endsAt ? ' disabled' : '') +
            '>' +
            (Date.now() < e.endsAt ? '探索中' : '领取') +
            '</button>';
          var c = li.querySelector('[data-claim]');
          c.addEventListener('click', function () {
            claim(idx);
          });
          slotEls.push({ li: li, left: li.querySelector('[data-left]'), btn: c, endsAt: e.endsAt });
        }
        wrap.appendChild(li);
      })(i);
    }

    // 皮肤商店
    var shop = $('skinList');
    shop.innerHTML = '';
    var sl = skinList(st.world);
    sl.forEach(function (s, idx) {
      var has = s.price === 0 || (st.pets.skins && st.pets.skins[s.id]);
      var price = Math.round(s.price * gain());
      var li = document.createElement('li');
      li.className = 'skin-card' + (has ? ' own' : '');
      var cv = document.createElement('canvas');
      cv.width = 96;
      cv.height = 96;
      cv.style.width = '48px';
      cv.style.height = '48px';
      drawSwatch(cv.getContext('2d'), s.c, 48);
      li.appendChild(cv);
      var info = document.createElement('div');
      info.className = 'item-main';
      info.innerHTML =
        '<div class="item-name">' +
        s.name +
        '</div>' +
        '<div class="item-desc">' +
        s.desc +
        '</div>';
      li.appendChild(info);
      var side = document.createElement('div');
      side.className = 'item-side';
      if (has) {
        side.innerHTML = '<span class="skin-owned">已收藏</span>';
      } else {
        side.innerHTML =
          '<button type="button" class="buy" data-buy="' +
          idx +
          '">' +
          D().fmt(price) +
          '</button>';
        var b = side.querySelector('button');
        b.addEventListener('click', function () {
          buySkin(s);
        });
        interactiveEls.push({ el: b, cost: price });
      }
      li.appendChild(side);
      shop.appendChild(li);
    });

    statLine();
    tickSlots();
    tickAfford();
  }

  function tickSlots() {
    var now = Date.now();
    slotEls.forEach(function (s) {
      if (!s.endsAt) return;
      var left = s.endsAt - now;
      if (s.left) s.left.textContent = left > 0 ? fmtLeft(left) : '已归来';
      if (s.btn) {
        var ready = left <= 0;
        if (s.btn.disabled === ready) {
          s.btn.disabled = !ready;
          s.btn.textContent = ready ? '领取' : '探索中';
        }
      }
    });
  }

  function tickAfford() {
    var st = S();
    if (!st) return;
    interactiveEls.forEach(function (it) {
      if (!it.el || !it.el.isConnected) return;
      it.el.disabled = st.dust < it.cost;
    });
    barEls.forEach(function (b) {
      if (!b.el || !b.el.isConnected) return;
      b.el.style.width =
        Math.max(2, Math.min(100, Math.round((st.dust / Math.max(1, b.cost)) * 100))) + '%';
    });
  }

  function render(force) {
    var st = S();
    if (!st || !st.pets || !$('petList')) return;
    var ns = signature();
    if (force || ns !== sig) {
      sig = ns;
      if (st.world !== lastWorld) {
        interactiveEls = [];
        barEls = [];
      }
      rebuild();
    } else {
      statLine();
      tickSlots();
      tickAfford();
    }
  }

  /* ---- 宠物贴图：动漫原图裁成的方形头像 ---- */
  var IMG = {};
  var IMG_READY = {};

  function assetBase() {
    var el = document.currentScript;
    var s = el && el.src ? String(el.src) : '';
    if (!s) {
      // 兜底：按脚本名在页面里找一次（脚本被动态插入时 currentScript 可能为空）
      var ss = document.getElementsByTagName('script');
      for (var i = 0; i < ss.length; i++) {
        if (/pets(\.[a-z0-9]+)?\.js/i.test(ss[i].src || '')) {
          s = ss[i].src;
          break;
        }
      }
    }
    if (!s) return '';
    try {
      // 取脚本所在目录。不再依赖文件名里必须叫 pets.js，
      // 这样压缩改名（pets.min.js）、带 ?v= 版本号、子目录部署都不会拼错路径。
      return new URL('.', s).href;
    } catch (e) {
      return s.replace(/[^\/]*$/, '');
    }
  }
  var BASE = assetBase();

  function petImg(id) {
    if (!id) return null;
    var im = IMG[id];
    if (im && im.complete && im.naturalWidth) return im;
    return null;
  }

  function loadPetImgs() {
    PETS.forEach(function (list) {
      list.forEach(function (p) {
        var im = new Image();
        im.onload = function () {
          IMG_READY[p.id] = true;
          if (D() && D().scene && D().scene.kickIt) D().scene.kickIt();
        };
        im.src = BASE + 'pets/' + p.id + '.png';
        IMG[p.id] = im;
      });
    });
  }

  // 圆角方形贴图 + 细描边 + 投影，看起来像一枚小挂饰
  function roundRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function drawPetFace(ctx, cx, cy, size, id, c, rad) {
    var im = petImg(id);
    var x = cx - size / 2,
      y = cy - size / 2;
    var r = size * (rad || 0.26);
    ctx.save();
    ctx.shadowColor = 'rgba(6,4,14,0.55)';
    ctx.shadowBlur = size * 0.22;
    ctx.shadowOffsetY = size * 0.08;
    roundRectPath(ctx, x, y, size, size, r);
    ctx.fillStyle = c ? c.shade : '#2a2340';
    ctx.fill();
    ctx.restore();
    if (im) {
      ctx.save();
      roundRectPath(ctx, x, y, size, size, r);
      ctx.clip();
      ctx.drawImage(im, x, y, size, size);
      ctx.restore();
    } else {
      // 图还没加载好，或者这颗星球暂时没有贴图（第 6–10 颗复用模板，pets/ 里没有对应 png）：
      // 画一张程序化的小脸，总比一块纯色方块好看，也不会因为缺图整块空着。
      ctx.save();
      roundRectPath(ctx, x, y, size, size, r);
      ctx.clip();
      var bg = ctx.createRadialGradient(cx, cy - size * 0.16, 0, cx, cy, size * 0.72);
      bg.addColorStop(0, c ? c.body : '#6b5a92');
      bg.addColorStop(1, c ? c.shade : '#2a2340');
      ctx.fillStyle = bg;
      ctx.fillRect(x, y, size, size);
      ctx.beginPath();
      ctx.arc(cx, cy, size * 0.3, 0, TAU);
      ctx.fillStyle = c ? c.body : '#8a78b8';
      ctx.fill();
      var ex = size * 0.11,
        ey = cy - size * 0.03;
      [cx - ex, cx + ex].forEach(function (exx) {
        ctx.beginPath();
        ctx.ellipse(exx, ey, size * 0.045, size * 0.055, 0, 0, TAU);
        ctx.fillStyle = c ? c.eye : '#221a36';
        ctx.fill();
      });
      ctx.fillStyle = c ? rgba(c.accent, 0.4) : 'rgba(255,200,160,.4)';
      [cx - size * 0.19, cx + size * 0.19].forEach(function (bx) {
        ctx.beginPath();
        ctx.ellipse(bx, cy + size * 0.09, size * 0.055, size * 0.03, 0, 0, TAU);
        ctx.fill();
      });
      ctx.restore();
    }
    ctx.save();
    roundRectPath(ctx, x, y, size, size, r);
    ctx.strokeStyle = c ? rgba(c.glow || '#ffffff', 0.85) : 'rgba(255,255,255,0.7)';
    ctx.lineWidth = Math.max(1, size * 0.055);
    ctx.stroke();
    ctx.restore();
  }

  /* ===================== 7. 画宠物 ===================== */

  // 一只圆滚滚的小家伙，占 100×100 的局部坐标系
  function drawCreature(ctx, cx, cy, size, kind, c, t, flip, hop, acc) {
    var k = size / 100;
    if (!(k > 0)) return;
    var bob = Math.sin(t * 2.2) * 1.6 + (hop > 0 ? Math.sin(Math.PI * clamp(hop, 0, 1)) * 10 : 0);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(k * (flip ? -1 : 1), k);

    // 影子
    if (kind !== 'ghost') {
      ctx.fillStyle = 'rgba(0,0,0,.26)';
      ctx.beginPath();
      ctx.ellipse(0, 46, 27 - bob * 0.3, 6.5, 0, 0, TAU);
      ctx.fill();
    }

    // 光晕
    var gl = ctx.createRadialGradient(0, 0, 3, 0, 0, 52);
    gl.addColorStop(0, rgba(c.glow, 0.2));
    gl.addColorStop(1, rgba(c.glow, 0));
    ctx.fillStyle = gl;
    ctx.beginPath();
    ctx.arc(0, 0, 52, 0, TAU);
    ctx.fill();

    ctx.translate(0, -bob);

    var bodyGrad = ctx.createLinearGradient(0, -48, 0, 46);
    bodyGrad.addColorStop(0, c.body);
    bodyGrad.addColorStop(1, c.shade);

    // 尾巴（画在身体后面）
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (kind === 'cat' || kind === 'fox' || kind === 'wolf' || kind === 'dragon') {
      ctx.beginPath();
      ctx.moveTo(20, 30);
      if (kind === 'cat') {
        ctx.quadraticCurveTo(44, 24, 38, 2);
        ctx.strokeStyle = c.body;
        ctx.lineWidth = 6;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(38, 2, 3.4, 0, TAU);
        ctx.fillStyle = c.accent;
        ctx.fill();
      } else if (kind === 'fox') {
        ctx.quadraticCurveTo(52, 20, 40, -2);
        ctx.strokeStyle = c.body;
        ctx.lineWidth = 12;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(40, -2, 7, 0, TAU);
        ctx.fillStyle = c.accent;
        ctx.fill();
      } else if (kind === 'wolf') {
        ctx.quadraticCurveTo(46, 26, 42, 10);
        ctx.strokeStyle = c.body;
        ctx.lineWidth = 8;
        ctx.stroke();
      } else {
        ctx.moveTo(18, 32);
        ctx.lineTo(40, 36);
        ctx.lineTo(30, 26);
        ctx.lineTo(46, 24);
        ctx.strokeStyle = c.body;
        ctx.lineWidth = 7;
        ctx.stroke();
      }
    }
    if (kind === 'rabbit') {
      ctx.beginPath();
      ctx.arc(24, 34, 7, 0, TAU);
      ctx.fillStyle = c.belly;
      ctx.fill();
      ctx.strokeStyle = rgba(c.shade, 0.5);
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }
    if (kind === 'bird') {
      ctx.beginPath();
      ctx.moveTo(14, 34);
      ctx.lineTo(38, 40);
      ctx.lineTo(30, 30);
      ctx.closePath();
      ctx.fillStyle = c.shade;
      ctx.fill();
    }
    if (kind === 'blob') {
      for (var q = 0; q < 3; q++) {
        ctx.beginPath();
        ctx.arc(26 + q * 5, 26 - q * 5, 3.4 - q * 0.4, 0, TAU);
        ctx.fillStyle = rgba(c.accent, 0.6);
        ctx.fill();
      }
    }

    // 龙 / 鸟的翅膀
    if (kind === 'dragon' || kind === 'bird') {
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.moveTo(-14, -6);
      ctx.quadraticCurveTo(-46, -22, -40, 10);
      ctx.quadraticCurveTo(-30, 6, -14, 12);
      ctx.closePath();
      ctx.fillStyle = rgba(c.accent, kind === 'bird' ? 0.75 : 0.55);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(14, -6);
      ctx.quadraticCurveTo(46, -22, 40, 10);
      ctx.quadraticCurveTo(30, 6, 14, 12);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // 身体
    if (kind === 'blob') {
      ctx.beginPath();
      ctx.moveTo(-26, 36);
      ctx.bezierCurveTo(-34, 4, -20, -22, 0, -22);
      ctx.bezierCurveTo(20, -22, 34, 4, 26, 36);
      ctx.quadraticCurveTo(0, 46, -26, 36);
      ctx.closePath();
      ctx.fillStyle = bodyGrad;
      ctx.fill();
    } else if (kind === 'ghost') {
      ctx.beginPath();
      ctx.moveTo(-24, 30);
      ctx.bezierCurveTo(-26, -6, -18, -30, 0, -30);
      ctx.bezierCurveTo(18, -30, 26, -6, 24, 30);
      for (var w = 0; w < 4; w++) {
        var wx = 24 - w * 12;
        ctx.quadraticCurveTo(wx - 6, 30 + (w % 2 ? 10 : -4), wx - 12, 30);
      }
      ctx.closePath();
      ctx.fillStyle = bodyGrad;
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.ellipse(0, 22, 24, 21, 0, 0, TAU);
      ctx.fillStyle = bodyGrad;
      ctx.fill();
      // 肚皮
      ctx.beginPath();
      ctx.ellipse(0, 27, 13, 13, 0, 0, TAU);
      ctx.fillStyle = rgba(c.belly, 0.95);
      ctx.fill();
      // 脚
      ctx.fillStyle = c.shade;
      ctx.beginPath();
      ctx.ellipse(-10, 42, 8, 5, 0, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(10, 42, 8, 5, 0, 0, TAU);
      ctx.fill();
    }

    // 耳朵 / 角
    if (kind === 'cat') {
      triEar(ctx, -22, -24, -16, -52, -2, -30, c, rgba(c.accent, 0.55));
      triEar(ctx, 22, -24, 16, -52, 2, -30, c, rgba(c.accent, 0.55));
    } else if (kind === 'fox') {
      triEar(ctx, -24, -20, -17, -56, -1, -30, c, rgba(c.belly, 0.9));
      triEar(ctx, 24, -20, 17, -56, 1, -30, c, rgba(c.belly, 0.9));
    } else if (kind === 'wolf') {
      ctx.save();
      ctx.translate(-18, -24);
      ctx.rotate(-0.5);
      ctx.beginPath();
      ctx.ellipse(0, 0, 10, 15, 0, 0, TAU);
      ctx.fillStyle = c.shade;
      ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.translate(18, -24);
      ctx.rotate(0.5);
      ctx.beginPath();
      ctx.ellipse(0, 0, 10, 15, 0, 0, TAU);
      ctx.fillStyle = c.shade;
      ctx.fill();
      ctx.restore();
    } else if (kind === 'rabbit') {
      ctx.save();
      ctx.translate(-11, -34);
      ctx.rotate(-0.18);
      ctx.beginPath();
      ctx.ellipse(0, 0, 7.5, 22, 0, 0, TAU);
      ctx.fillStyle = c.body;
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(0, 2, 4, 15, 0, 0, TAU);
      ctx.fillStyle = rgba(c.accent, 0.55);
      ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.translate(11, -34);
      ctx.rotate(0.18);
      ctx.beginPath();
      ctx.ellipse(0, 0, 7.5, 22, 0, 0, TAU);
      ctx.fillStyle = c.body;
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(0, 2, 4, 15, 0, 0, TAU);
      ctx.fillStyle = rgba(c.accent, 0.55);
      ctx.fill();
      ctx.restore();
    } else if (kind === 'deer') {
      ctx.strokeStyle = c.accent;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(-8, -34);
      ctx.lineTo(-14, -50);
      ctx.moveTo(-14, -50);
      ctx.lineTo(-24, -54);
      ctx.moveTo(-13, -44);
      ctx.lineTo(-20, -42);
      ctx.moveTo(8, -34);
      ctx.lineTo(14, -50);
      ctx.moveTo(14, -50);
      ctx.lineTo(24, -54);
      ctx.moveTo(13, -44);
      ctx.lineTo(20, -42);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(-22, -30, 6, 9, 0.5, 0, TAU);
      ctx.fillStyle = c.body;
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(22, -30, 6, 9, -0.5, 0, TAU);
      ctx.fillStyle = c.body;
      ctx.fill();
    } else if (kind === 'dragon') {
      ctx.fillStyle = c.accent;
      ctx.beginPath();
      ctx.moveTo(-14, -34);
      ctx.lineTo(-22, -50);
      ctx.lineTo(-6, -40);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(14, -34);
      ctx.lineTo(22, -50);
      ctx.lineTo(6, -40);
      ctx.closePath();
      ctx.fill();
    }

    // 头
    var headY = kind === 'ghost' || kind === 'blob' ? -8 : -10;
    var hg = ctx.createRadialGradient(-8, headY - 12, 2, 0, headY, 30);
    hg.addColorStop(0, c.body);
    hg.addColorStop(1, c.shade);
    ctx.beginPath();
    ctx.ellipse(0, headY, 25, 23, 0, 0, TAU);
    ctx.fillStyle = hg;
    ctx.fill();

    // 脸
    if (kind === 'bird') {
      ctx.beginPath();
      ctx.moveTo(-3, headY + 6);
      ctx.lineTo(3, headY + 6);
      ctx.lineTo(0, headY + 14);
      ctx.closePath();
      ctx.fillStyle = c.accent;
      ctx.fill();
    }
    // 眼睛
    var ex = 9.5,
      ey = headY - 1;
    eyes(ctx, -ex, ey, c);
    eyes(ctx, ex, ey, c);
    // 腮红
    ctx.fillStyle = rgba(c.accent, 0.32);
    ctx.beginPath();
    ctx.ellipse(-17, headY + 7, 5, 3, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(17, headY + 7, 5, 3, 0, 0, TAU);
    ctx.fill();
    // 嘴
    if (kind !== 'bird') {
      ctx.strokeStyle = rgba(c.eye, 0.85);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(-0.2, headY + 8, 3.4, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    }
    // 胡须
    if (kind === 'cat' || kind === 'fox') {
      ctx.strokeStyle = rgba(c.belly, 0.8);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-25, headY + 4);
      ctx.lineTo(-36, headY + 2);
      ctx.moveTo(-25, headY + 8);
      ctx.lineTo(-36, headY + 10);
      ctx.moveTo(25, headY + 4);
      ctx.lineTo(36, headY + 2);
      ctx.moveTo(25, headY + 8);
      ctx.lineTo(36, headY + 10);
      ctx.stroke();
    }

    // 饰品
    drawAcc(ctx, acc, c, t);

    ctx.restore();
  }

  // 三角耳朵：外圈主色，内圈衬色
  function triEar(ctx, ax, ay, bx, by, cx2, cy2, c, inner) {
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.lineTo(cx2, cy2);
    ctx.closePath();
    ctx.fillStyle = c.body;
    ctx.fill();
    var gx = (ax + bx + cx2) / 3,
      gy = (ay + by + cy2) / 3;
    var s = 0.52;
    ctx.beginPath();
    ctx.moveTo(gx + (ax - gx) * s, gy + (ay - gy) * s);
    ctx.lineTo(gx + (bx - gx) * s, gy + (by - gy) * s);
    ctx.lineTo(gx + (cx2 - gx) * s, gy + (cy2 - gy) * s);
    ctx.closePath();
    ctx.fillStyle = inner;
    ctx.fill();
  }

  // 眼睛：深色眼珠 + 高光
  function eyes(ctx, x, y, c) {
    ctx.beginPath();
    ctx.ellipse(x, y, 4.4, 5.2, 0, 0, TAU);
    ctx.fillStyle = c.eye;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x - 1.5, y - 1.8, 1.5, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,.92)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 1.4, y + 1.6, 0.7, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.fill();
  }

  function drawAcc(ctx, acc, c, t) {
    if (!acc || acc === 'none') {
      for (var i = 0; i < 2; i++) {
        var a = t * 0.8 + i * Math.PI;
        spark(ctx, Math.cos(a) * 40, -34 + Math.sin(a) * 8, 2.4, c.accent);
      }
      return;
    }
    if (acc === 'star') {
      star(ctx, 26, -38, 5.5, c.accent);
      spark(ctx, -30, -30, 2.2, c.belly);
    } else if (acc === 'crown') {
      ctx.beginPath();
      ctx.moveTo(-14, -40);
      ctx.lineTo(-8, -50);
      ctx.lineTo(0, -42);
      ctx.lineTo(8, -50);
      ctx.lineTo(14, -40);
      ctx.closePath();
      ctx.fillStyle = c.accent;
      ctx.fill();
    } else if (acc === 'halo') {
      ctx.beginPath();
      ctx.ellipse(0, -44, 25, 6, 0, 0, TAU);
      ctx.strokeStyle = rgba(c.accent, 0.9);
      ctx.lineWidth = 2.4;
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(0, -44, 25, 6, 0, 0, TAU);
      ctx.strokeStyle = rgba(c.glow, 0.45);
      ctx.lineWidth = 5;
      ctx.stroke();
    } else if (acc === 'crystal') {
      ctx.beginPath();
      ctx.moveTo(0, -58);
      ctx.lineTo(7, -46);
      ctx.lineTo(0, -36);
      ctx.lineTo(-7, -46);
      ctx.closePath();
      ctx.fillStyle = rgba(c.accent, 0.9);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.7)';
      ctx.lineWidth = 1;
      ctx.stroke();
    } else if (acc === 'flower') {
      for (var k = 0; k < 5; k++) {
        var ang = (k / 5) * TAU;
        ctx.beginPath();
        ctx.arc(28 + Math.cos(ang) * 5, -44 + Math.sin(ang) * 5, 3.2, 0, TAU);
        ctx.fillStyle = c.accent;
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(28, -44, 2.6, 0, TAU);
      ctx.fillStyle = '#fff6e3';
      ctx.fill();
    }
  }

  function star(ctx, x, y, r, color) {
    ctx.beginPath();
    for (var i = 0; i < 8; i++) {
      var a = (i * Math.PI) / 4;
      var rr = i % 2 ? r * 0.42 : r;
      if (i === 0) ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      else ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  function spark(ctx, x, y, r, color) {
    ctx.globalAlpha = 0.8;
    star(ctx, x, y, r, color);
    ctx.globalAlpha = 1;
  }

  /* ===================== 8. 皮肤收藏成就 / 挂载 ===================== */

  var attached = false;

  function attach() {
    if (!window.DD || !window.DD.state) return;
    // 只挂一次：重复调用会重复注册下面的定时器，越积越多越卡
    if (attached) return;
    attached = true;
    loadPetImgs();
    var st = S();
    var base = { owned: {}, exps: [null, null, null], done: 0, skins: {}, pat: {} };
    st.pets = Object.assign(base, st.pets || {});
    st.pets.owned = Object.assign({}, st.pets.owned || {});
    st.pets.skins = Object.assign({}, st.pets.skins || {});
    st.pets.pat = Object.assign({}, st.pets.pat || {});
    if (!Array.isArray(st.pets.exps)) st.pets.exps = [null, null, null];
    while (st.pets.exps.length < SLOTS) st.pets.exps.push(null);

    // 老存档里第 7–10 颗星球是第 5 颗的克隆（id 形如 w6_sakura），
    // 现在每颗星球都有自己的伙伴，把旧 id 换成新伙伴，等级和好感度照搬。
    var LEGACY_ID = {
      w6_sakura: 'artoria',
      w6_hinata: 'kurisu',
      w6_kakashi: 'nakano',
      w6_gaara: 'asuka',
      w6_itachi: 'yor',
      w7_sakura: 'nezuko',
      w7_hinata: 'eru',
      w7_kakashi: 'shiro',
      w7_gaara: 'flandre',
      w7_itachi: 'mikoto',
      w8_sakura: 'homura',
      w8_hinata: 'elaina',
      w8_kakashi: 'megumin',
      w8_gaara: 'bocchi',
      w8_itachi: 'shana',
      w9_sakura: 'mikasa',
      w9_hinata: 'nobara',
      w9_kakashi: 'makima',
      w9_gaara: 'illya',
      w9_itachi: 'roxy'
    };
    Object.keys(st.pets.owned).forEach(function (k) {
      var to = LEGACY_ID[k];
      if (!to) return;
      var old = st.pets.owned[k];
      delete st.pets.owned[k];
      if (!st.pets.owned[to]) st.pets.owned[to] = old;
    });

    // 旧存档里的舰队远征：换算成宠物探索次数
    if (st.fleet && st.fleet.done && !st.pets.migrated) {
      st.pets.done += st.fleet.done;
      st.pets.migrated = true;
    }

    // 每颗到过的星球都该有它的第一只伙伴：
    // 老存档按已经到达的星球补齐（只补一次），新存档就等着进星球时送。
    if (featOpen() && !st.pets.legacy) {
      st.pets.legacy = true;
      var brought = 0;
      var reach = Math.min(PETS.length - 1, Math.max(0, Math.round(st.world) || 0));
      PETS.forEach(function (grp, wi) {
        if (wi > reach) return;
        var first = (grp || [])[0];
        if (first && !owned(first.id)) {
          st.pets.owned[first.id] = { lv: 1, aff: 0, skin: 0 };
          brought += 1;
        }
      });
      if (brought > 1) D().toast('🐾 ' + brought + ' 颗星球的伙伴都在这儿了', 3200);
    }

    // 第一只宠物永远陪着你（只在宠物系统已经开放时）
    var first = species()[0];
    if (first && featOpen() && !owned(first.id)) {
      st.pets.owned[first.id] = { lv: 1, aff: 0, skin: 0 };
    }

    refreshScene();
    render(true);
    setInterval(function () {
      render();
    }, 500);
    setInterval(function () {
      statLine();
    }, 1000);
  }

  function onWorldEnter() {
    var st = S();
    if (!st) return;
    if (!featOpen()) {
      refreshScene();
      return;
    }
    var first = species()[0];
    if (first && !owned(first.id)) {
      st.pets.owned[first.id] = { lv: 1, aff: 0, skin: 0 };
      D().toast('🐾 新伙伴「' + first.name + '」跟着你落地了', 3000);
      speakLine(first, 'idle');
    } else if (first) {
      speakLine(first, 'idle');
    }
    refreshScene();
    render(true);
  }

  global.DDPets = {
    attach: attach,
    onWorldEnter: onWorldEnter,
    render: render,
    petPower: petPower,
    petMult: petMult,
    done: function () {
      return S() && pets() ? pets().done : 0;
    },
    scenePets: scenePets,
    previewPet: previewPet,
    speak: speak,
    adopt: adopt,
    ownedCount: function () {
      if (!S() || !S().pets || !featOpen()) return 0;
      return allOwned().length;
    },
    drawCreature: drawCreature,
    drawPetFace: drawPetFace,
    petImg: petImg,
    loadImgs: loadPetImgs,
    DESTS: DESTS,
    PETS: PETS,
    SKINS: SKINS
  };
})(typeof window !== 'undefined' ? window : this);
