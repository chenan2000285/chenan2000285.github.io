/* ============================================================
   点点星球 · 扩展系统  (systems.js)
   股市 / 舰队 / 小游戏 / 挂机
   依赖 game.js 暴露的 window.DD 接口，所有进度都存在同一份存档里
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

  var MINI_PER_DAY = 100; // 小游戏每天最多玩 100 次，按手机本地日期重置
  var IDLE_CAP_H = 12;

  /* ===================== 股市 ===================== */

  var TICKERS = [
    { id: 'sdm', sym: 'SDM', name: '星尘矿业', base: 120, vol: 0.045, drift: 0.0004 },
    { id: 'qrs', sym: 'QRS', name: '曲率航运', base: 460, vol: 0.06, drift: 0.0002 },
    { id: 'amd', sym: 'AMD', name: '反物质动力', base: 1500, vol: 0.08, drift: 0.0006 },
    { id: 'holo', sym: 'HOLO', name: '全息娱乐', base: 5200, vol: 0.1, drift: 0.0003 },
    { id: 'dsi', sym: 'DSI', name: '深空保险', base: 18000, vol: 0.03, drift: 0.0001 },
    { id: 'qag', sym: 'QAG', name: '量子农业', base: 60000, vol: 0.07, drift: 0.0002 }
  ];

  var NEWS = [
    ['星尘矿业在近地小行星带发现富矿脉', 1, 0.06],
    ['曲率航运的跃迁航线被税局抽查', 1, -0.07],
    ['反物质动力发布新一代约束环', 1, 0.09],
    ['全息娱乐的虚拟偶像演唱会售票破纪录', 1, 0.08],
    ['深空保险因陨石潮赔付，利润承压', 1, -0.05],
    ['量子农业的基因稻在零重力下丰收', 2, 0.07],
    ['星际交易所临时调整保证金比例', 0, -0.04],
    ['有匿名巨鲸在收盘前扫货', 0, 0.05],
    ['太阳风干扰了深空通讯，交易延迟', 0, -0.03]
  ];

  function gain() {
    return D().worlds[S().world].gain;
  }

  // 局部重绘（股市 / 宠物 / 小游戏）
  function render() {
    renderStocks();
    renderFleet();
    renderMini();
  }

  function factorOf(t) {
    var p = S().stocks.prices[t.id];
    return typeof p === 'number' && p > 0 ? p : 1;
  }

  function priceOf(t) {
    return Math.max(1, Math.round(t.base * gain() * factorOf(t)));
  }

  function capital() {
    var st = S();
    if (!st) return 0;
    var sum = 0;
    for (var i = 0; i < TICKERS.length; i++) {
      var t = TICKERS[i];
      sum += (st.stocks.hold[t.id] || 0) * priceOf(t);
    }
    return sum;
  }

  function stockMult() {
    return 1 + Math.log10(1 + capital() / 1000) * 0.42;
  }

  function stockTick(dtMs) {
    var st = S().stocks;
    st.pxAt = (st.pxAt || 0) + dtMs;
    if (st.pxAt >= 5000) {
      st.pxAt = 0;
      for (var i = 0; i < TICKERS.length; i++) {
        var t = TICKERS[i];
        var f = factorOf(t);
        // 倍率波动：大多数时候是几分之一到几倍的小抖动，
        // 极小概率（约 1.2%）才出现跌到十几分之一、或涨几十倍的极端行情。
        var roll = Math.random();
        var k;
        if (roll < 0.006) {
          k = 0.05 + Math.random() * 0.1; // 暴跌到 1/20 ~ 1/7
        } else if (roll < 0.012) {
          k = 3 + Math.random() * 27; // 暴涨 3 ~ 30 倍
        } else {
          k = Math.exp((Math.random() * 2 - 1) * t.vol * 1.6); // 常态小波动
        }
        var meanRev = (1 - f) * 0.015; // 长期拉回 1 倍
        f = Math.max(0.05, Math.min(30, f * k + meanRev));
        S().stocks.prices[t.id] = f;
      }
    }

    st.newsAt = (st.newsAt || 0) + dtMs;
    if (st.newsAt >= 75000) {
      st.newsAt = 0;
      var item = NEWS[Math.floor(Math.random() * NEWS.length)];
      var target = item[1] >= 2 ? TICKERS[Math.floor(Math.random() * TICKERS.length)] : null;
      var shockPct = item[2];
      if (target) {
        S().stocks.prices[target.id] = Math.max(
          0.35,
          Math.min(3.2, factorOf(target) * (1 + shockPct))
        );
      } else {
        for (var ci = 0; ci < TICKERS.length; ci++) {
          var tk = TICKERS[ci];
          S().stocks.prices[tk.id] = Math.max(
            0.35,
            Math.min(3.2, factorOf(tk) * (1 + shockPct + (Math.random() - 0.5) * 0.02))
          );
        }
      }
      st.news.unshift({ text: item[0], pct: shockPct, at: Date.now() });
      if (st.news.length > 8) st.news.length = 8;
    }

    st.divAt = (st.divAt || 0) + dtMs;
    if (st.divAt >= 120000) {
      st.divAt = 0;
      var cap = capital();
      if (cap > 0) {
        var pay = cap * 0.02;
        S().dust += pay;
        S().total += pay;
        S().stats.stockProfit += pay;
        D().toast('💰 股息到账 +' + D().fmt(pay), 1800);
      }
    }
  }

  // 防连点：同一时刻最多 4 笔/秒，且两笔之间至少隔 220ms。
  // 不管怎么狂点，都不可能靠反复买卖把累计星尘刷上去。
  var TRADE_GAP = 220;
  var TRADE_WIN = 1000;
  var tradeStamps = [];

  function trade(t, dir, ratio) {
    var st = S();
    var now = Date.now();
    while (tradeStamps.length && now - tradeStamps[0] > TRADE_WIN) tradeStamps.shift();
    if (now - (st.stocks.tradeAt || 0) < TRADE_GAP || tradeStamps.length >= 4) {
      D().toast('手速太快了，等一下再下单', 1200);
      return;
    }
    st.stocks.tradeAt = now;
    tradeStamps.push(now);

    var p = priceOf(t);
    var hold = st.stocks.hold[t.id] || 0;
    var cost = st.stocks.cost[t.id] || 0;
    // 老存档没有成本记录：按当前价补一份，卖出时就不会凭空多出利润
    if (hold > 0 && !(cost > 0)) cost = hold * p;

    // 老存档没有 invest：补一个空表，下面买卖直接往里记
    if (!st.stocks.invest || typeof st.stocks.invest !== 'object') st.stocks.invest = {};

    if (dir === 'buy') {
      var budget = st.dust * ratio;
      var shares = Math.floor(budget / (p * 1.005));
      if (shares <= 0) {
        D().toast('星尘不够买一股', 1500);
        return;
      }
      var paid = shares * p * 1.005;
      st.dust -= paid;
      st.stocks.hold[t.id] = hold + shares;
      st.stocks.cost[t.id] = cost + paid;
      // 买入的本金记进本星球：身份判定立刻认，不用等卖出算利润
      st.stocks.invest[st.world] = (Number(st.stocks.invest[st.world]) || 0) + paid;
    } else {
      var sell = ratio >= 1 ? hold : Math.floor(hold * ratio);
      if (sell <= 0) return;
      var revenue = sell * p * 0.995;
      // 只把「卖出价 - 这部分持仓的成本」计入累计星尘，本金回流不算新收入。
      // 否则反复买卖会把 total 刷到天文数字（之前 1 万亿的 bug 就是这么来的）。
      var costPart = hold > 0 ? cost * (sell / hold) : 0;
      var profit = revenue - costPart;
      st.dust += revenue;
      if (profit > 0) st.total += profit;
      st.stocks.hold[t.id] = hold - sell;
      st.stocks.cost[t.id] = Math.max(0, cost - costPart);
      // 本金按比例回退：卖多少就少认多少，身份面板上的数跟着卖掉后的实际资产走
      st.stocks.invest[st.world] = Math.max(
        0,
        (Number(st.stocks.invest[st.world]) || 0) - costPart
      );
    }
    st.stats.trades += 1;
    // 交易当下就把「见过的最高市值」记下来：买卖很快时，100ms 的主循环可能只看到卖掉后的 0，
    // 身份和成就就会以为你从没持有过。
    if (!st.stocks.capBest || typeof st.stocks.capBest !== 'object') st.stocks.capBest = {};
    if (!st.stocks.base || typeof st.stocks.base !== 'object') st.stocks.base = {};
    // 和 markBests 一样扣掉跃迁带进来的基准，只记这颗星球自己赚出来的市值
    var capNow = Math.max(0, capital() - (Number(st.stocks.base[st.world]) || 0));
    if (capNow > (Number(st.stocks.capBest[st.world]) || 0)) st.stocks.capBest[st.world] = capNow;
    D().checkAchs();
    D().checkRanks();
    render();
    D().save();
  }

  function renderStocks() {
    var st = S().stocks;
    $('stkCapital').textContent = D().fmt(capital());
    // 投入本金单独摆出来：身份认的「股市里的钱」是 本金 和 市值 取大，
    // 两个数都摆出来，玩家一眼就知道自己投了多少、现在值多少。
    var invEl = $('stkInvest');
    if (invEl) {
      var inv = st.invest && typeof st.invest === 'object' ? Number(st.invest[S().world]) || 0 : 0;
      invEl.textContent = D().fmt(inv);
    }
    // 手上星尘单独摆出来：股市里的钱和市面上的钱是两个数，混着看最容易误会。
    var cashEl = $('stkCashNow');
    if (cashEl) cashEl.textContent = D().fmt(st.dust);
    // 把「历史最高」也摆出来：身份和成就按最高值判，卖掉股票后这里不会归零
    var tip = $('stkBestTip');
    if (tip) {
      var wi = S().world;
      var best = st.capBest && typeof st.capBest === 'object' ? Number(st.capBest[wi]) || 0 : 0;
      tip.textContent = best > 0 ? '当前市值 · 历史最高 ' + D().fmt(best) : '当前市值';
    }
    $('stkMult').textContent = '×' + stockMult().toFixed(2);
    $('stkCash').textContent = D().fmt(S().stats.stockProfit);

    var list = $('stkList');
    if (!list) return;
    list.innerHTML = '';
    TICKERS.forEach(function (t) {
      var p = priceOf(t);
      var change = (factorOf(t) - 1) * 100;
      var hold = st.hold[t.id] || 0;
      var li = document.createElement('li');
      li.className = 'stock-item';
      li.innerHTML =
        '<div class="stock-top">' +
        '<span class="stock-name">' +
        t.name +
        '<em>' +
        t.sym +
        '</em></span>' +
        '<span class="stock-price">' +
        D().fmt(p) +
        '<em class="' +
        (change >= 0 ? 'up' : 'down') +
        '">' +
        (change >= 0 ? '+' : '') +
        change.toFixed(1) +
        '%</em></span>' +
        '</div>' +
        '<div class="stock-sub">持有 ' +
        D().fmt(hold) +
        ' 股 · 市值 ' +
        D().fmt(hold * p) +
        '</div>' +
        '<div class="stock-ops">' +
        '<button type="button" data-op="b10">买10%</button>' +
        '<button type="button" data-op="b50">买50%</button>' +
        '<button type="button" data-op="ball">全买</button>' +
        '<button type="button" data-op="s50">卖一半</button>' +
        '<button type="button" data-op="sall">全卖</button>' +
        '</div>';
      li.querySelectorAll('button').forEach(function (b) {
        b.addEventListener('click', function () {
          var op = b.dataset.op;
          if (op === 'b10') trade(t, 'buy', 0.1);
          else if (op === 'b50') trade(t, 'buy', 0.5);
          else if (op === 'ball') trade(t, 'buy', 1);
          else if (op === 's50') trade(t, 'sell', 0.5);
          else trade(t, 'sell', 1);
        });
      });
      list.appendChild(li);
    });

    var news = $('stkNews');
    if (news) {
      news.innerHTML = st.news.length
        ? st.news
            .map(function (n) {
              return (
                '<li class="news-item"><i class="' +
                (n.pct >= 0 ? 'up' : 'down') +
                '">' +
                (n.pct >= 0 ? '↑' : '↓') +
                '</i><span>' +
                n.text +
                '</span></li>'
              );
            })
            .join('')
        : '<li class="news-item dim">市场风平浪静，等你入场。</li>';
    }
  }

  /* ===================== 探索 / 宠物 ===================== */
  // 舰队已经换成宠物：探索、战力、加成都在 pets.js 里，
  // 这里只保留给主循环和身份判定用的转发。

  function petPower() {
    return window.DDPets ? DDPets.petPower() : 0;
  }
  function petMult() {
    return window.DDPets ? DDPets.petMult() : 1;
  }

  function renderFleet() {
    var st = S();
    if (!st || !st.pets) return;
    $('petPower').textContent = D().fmt(petPower());
    $('petMult').textContent = '×' + petMult().toFixed(2);
    $('petDone').textContent = D().fmt(st.pets.done || 0);
  }

  function fmtLeft(ms) {
    var s = Math.max(0, Math.ceil(ms / 1000));
    var m = Math.floor(s / 60);
    var ss = s % 60;
    return m + ':' + (ss < 10 ? '0' : '') + ss;
  }

  /* ===================== 小游戏 ===================== */

  /* ===================== 小游戏 · 无尽模式 ===================== */
  /* 旧的 6 个小游戏（星矿淘金 / 流星截击 / 星图记忆 / 序列破解 / 微观猎手 / 节律脉冲）
     已全部删除，入口和旧计分逻辑都不再保留。
     现在是三个无尽模式：星尘狂奔、引力穿针、脉冲连击。
     计分：得分 = 操作次数 × 本星球倍率 × 升级总倍率（两个倍率同时生效） */

  var GAMES = [
    {
      id: 'run',
      name: '星尘狂奔',
      icon: '🏃',
      desc: '点屏幕跳跃，躲开迎面而来的陨石。跑得越远越快，撞一下就结束。'
    },
    {
      id: 'needle',
      name: '引力穿针',
      icon: '🧭',
      desc: '点左半屏 / 右半屏左右闪避，吃光点加分，撞到红色引力阱就结束。'
    },
    {
      id: 'pulse',
      name: '脉冲连击',
      icon: '⚡',
      desc: '点破亮起的光点，连击越高分越高；点到红色核心立刻结束。'
    }
  ];

  function dayKey() {
    var d = new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }

  // 跨天自动清零，返回今天已经玩了几次
  function playsToday() {
    var m = S().mini;
    if (!m.day || m.day !== dayKey()) {
      m.day = dayKey();
      m.today = 0;
    }
    return m.today || 0;
  }

  function playsLeft() {
    return Math.max(0, MINI_PER_DAY - playsToday());
  }

  function badgeCount() {
    return Math.min(25, Math.floor(S().mini.wins / 2));
  }

  // 得分：操作次数 × 本星球倍率 × 升级后的总倍率
  function scoreOf(ops) {
    var w = gain(); // 本星球倍率
    var u = Number(D().upgMult) || 1; // 升级后的总倍率
    return Math.round(ops * w * u);
  }

  function badgeMult() {
    return 1 + badgeCount() * 0.02;
  }

  // 一局结束：结算星尘、记录最高分、刷新界面
  function finishRun(ops, label) {
    var score = scoreOf(ops);
    var rew = Math.round(score * 0.5 * badgeMult());
    var m = S().mini;
    if (!m.best || typeof m.best !== 'object') m.best = {};
    var prev = Number(m.best[label]) || 0;
    if (score > prev) m.best[label] = score;
    if (ops > 0) {
      m.wins += 1;
      m.badges = badgeCount();
    }
    if (!S().stats) S().stats = {};
    S().stats.miniDust = (Number(S().stats.miniDust) || 0) + rew;
    if (rew > 0) D().addDust(rew);
    if (ops > 0)
      D().toast('🎮 ' + label + ' 得分 ' + D().fmt(score) + ' · 星尘 +' + D().fmt(rew), 2600);
    D().checkRanks();
    D().checkAchs();
    D().save();
    render();
    return { score: score, rew: rew, best: Math.max(prev, score) };
  }

  var miniCleanup = null;

  function openGame(g) {
    if (playsLeft() <= 0) {
      D().toast('今天的 100 次玩完了，明天再来', 2400);
      return;
    }
    playsToday();
    S().mini.today = (S().mini.today || 0) + 1;
    var body = $('miniBody');
    body.innerHTML = '';
    $('miniTitle').textContent = g.icon + ' ' + g.name;
    $('miniDesc').textContent = g.desc;
    $('miniModal').classList.remove('hidden');
    if (miniCleanup) {
      miniCleanup();
      miniCleanup = null;
    }
    track(g.id, body);
    render();
  }

  function track(id, body) {
    if (id === 'run') startRun(body);
    else if (id === 'needle') startNeedle(body);
    else startPulse(body);
  }

  function closeGame() {
    $('miniModal').classList.add('hidden');
    if (miniCleanup) {
      miniCleanup();
      miniCleanup = null;
    }
  }

  /* ---------- 通用舞台 ---------- */
  function buildStage(body, h, hint) {
    var wrap = document.createElement('div');
    wrap.className = 'mini-stage';
    wrap.style.height = h + 'px';
    var hud = document.createElement('div');
    hud.className = 'mini-hud';
    var scoreEl = document.createElement('span');
    scoreEl.className = 'mini-hud-score';
    scoreEl.textContent = '0';
    var extraEl = document.createElement('span');
    extraEl.className = 'mini-hud-extra';
    extraEl.textContent = hint || '';
    hud.appendChild(scoreEl);
    hud.appendChild(extraEl);
    var stage = document.createElement('div');
    stage.className = 'mini-stage-in';
    var over = document.createElement('div');
    over.className = 'mini-over hidden';
    wrap.appendChild(hud);
    wrap.appendChild(stage);
    wrap.appendChild(over);
    body.appendChild(wrap);
    return { wrap: wrap, stage: stage, over: over, scoreEl: scoreEl, extraEl: extraEl };
  }

  function endScreen(f, ops, label, retry) {
    var res = finishRun(ops, label);
    f.over.classList.remove('hidden');
    f.over.innerHTML =
      '<div class="mini-over-box">' +
      '<div class="mini-over-title">得分 ' +
      D().fmt(res.score) +
      '</div>' +
      '<div class="mini-over-sub">操作 ' +
      D().fmt(ops) +
      ' 次 · 最高 ' +
      D().fmt(res.best) +
      '</div>' +
      '<div class="mini-over-dust">星尘 +' +
      D().fmt(res.rew) +
      '</div>' +
      '<div class="mini-over-acts">' +
      '<button type="button" class="primary mini-again">再来一局</button>' +
      '<button type="button" class="ghost mini-quit">退出</button>' +
      '</div>' +
      '</div>';
    var again = f.over.querySelector('.mini-again');
    var quit = f.over.querySelector('.mini-quit');
    if (again)
      again.addEventListener('click', function () {
        if (playsLeft() <= 0) {
          D().toast('今天的次数用完了，明天再来', 2000);
          return;
        }
        S().mini.today = (S().mini.today || 0) + 1;
        render();
        retry();
      });
    if (quit) quit.addEventListener('click', closeGame);
    render();
  }

  /* ============ 1. 星尘狂奔：跑酷躲避，越跑越快 ============ */
  function startRun(body) {
    var f = buildStage(body, 230, '点击跳跃');
    var GROUND = 30;
    var STAGE_W = f.stage.clientWidth || 320;

    var player = document.createElement('div');
    player.className = 'runner-player';
    player.style.left = '28px';
    player.style.bottom = GROUND + 'px';
    f.stage.appendChild(player);

    var obs = [],
      ops = 0,
      running = true,
      dead = false;
    var raf = 0,
      last = 0,
      py = 0,
      vy = 0;
    var dist = 0,
      spawnIn = 0.6,
      speed = 150;

    function spawnRock() {
      var el = document.createElement('div');
      el.className = 'runner-rock';
      var hh = 16 + Math.random() * 16;
      var ww = 12 + Math.random() * 10;
      el.style.width = ww + 'px';
      el.style.height = hh + 'px';
      el.style.bottom = GROUND + 'px';
      el.style.left = STAGE_W + 10 + 'px';
      f.stage.appendChild(el);
      obs.push({ el: el, x: STAGE_W + 10, w: ww, h: hh, scored: false });
    }

    function jump() {
      if (!running || dead) return;
      if (py <= 0.5 && vy <= 0) {
        vy = 330;
        try {
          if (window.DDFX) DDFX.sfx.click(0, false);
        } catch (e) {}
      }
    }

    function onDown(e) {
      e.preventDefault();
      jump();
    }
    f.stage.addEventListener('pointerdown', onDown);
    var onKey = function (e) {
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.key === ' ') {
        e.preventDefault();
        jump();
      }
    };
    document.addEventListener('keydown', onKey);

    function loop(now) {
      if (!running) return;
      if (!last) last = now;
      var dt = Math.min(40, now - last) / 1000;
      last = now;

      dist += speed * dt;
      speed = Math.min(520, 150 + dist * 0.05);
      f.extraEl.textContent = Math.round(speed) + ' px/s';

      // 跳跃物理
      if (py > 0 || vy > 0) {
        vy -= 780 * dt;
        py += vy * dt;
        if (py <= 0) {
          py = 0;
          vy = 0;
        }
        player.style.bottom = GROUND + py + 'px';
      }

      // 生成
      spawnIn -= dt;
      if (spawnIn <= 0) {
        spawnRock();
        spawnIn = Math.max(0.42, 1.05 - dist * 0.00006);
      }

      // 障碍移动 + 计分 + 碰撞
      var px = 28,
        pw = 22;
      var pyBottom = GROUND + py;
      for (var i = obs.length - 1; i >= 0; i--) {
        var o = obs[i];
        o.x -= speed * dt;
        o.el.style.left = o.x + 'px';
        if (!o.scored && o.x + o.w < px) {
          o.scored = true;
          ops += 1;
          f.scoreEl.textContent = D().fmt(scoreOf(ops));
        }
        // 碰撞（玩家和岩石都是方形，简单 AABB）
        if (o.x < px + pw && o.x + o.w > px && pyBottom < GROUND + o.h) {
          dead = true;
          running = false;
          cancelAnimationFrame(raf);
          f.stage.removeEventListener('pointerdown', onDown);
          document.removeEventListener('keydown', onKey);
          if (window.DDFX) {
            try {
              DDFX.sfx.rank();
            } catch (e) {}
          }
          player.classList.add('dead');
          setTimeout(function () {
            endScreen(f, ops, '星尘狂奔', function () {
              body.innerHTML = '';
              startRun(body);
            });
          }, 320);
          return;
        }
        if (o.x < -40) {
          f.stage.removeChild(o.el);
          obs.splice(i, 1);
        }
      }

      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);
    miniCleanup = function () {
      running = false;
      cancelAnimationFrame(raf);
      f.stage.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }

  /* ============ 2. 引力穿针：左右闪避 + 吃光点 ============ */
  function startNeedle(body) {
    var f = buildStage(body, 250, '点左/右半边移动');
    var W = f.stage.clientWidth || 320,
      H = 250;
    var player = document.createElement('div');
    player.className = 'needle-player';
    player.style.left = W / 2 - 12 + 'px';
    player.style.bottom = '14px';
    f.stage.appendChild(player);

    var px = W / 2 - 12,
      PW = 24,
      PH = 18;
    var items = [],
      ops = 0,
      running = true,
      dead = false;
    var raf = 0,
      last = 0,
      spawnIn = 0.5,
      fall = 90,
      t = 0;

    function spawnItem() {
      var bad = Math.random() < 0.42;
      var el = document.createElement('div');
      el.className = bad ? 'needle-trap' : 'needle-orb';
      var x = 12 + Math.random() * (W - 44);
      el.style.left = x + 'px';
      el.style.top = '-20px';
      f.stage.appendChild(el);
      items.push({ el: el, x: x, y: -20, size: 16, bad: bad, hit: false });
    }

    function moveTo(nx) {
      px = Math.max(4, Math.min(W - PW - 4, nx));
      player.style.left = px + 'px';
    }
    function onDown(e) {
      e.preventDefault();
      if (!running || dead) return;
      var r = f.stage.getBoundingClientRect();
      var x = (e.clientX || 0) - r.left;
      moveTo(x < r.width / 2 ? px - 52 : px + 52);
    }
    f.stage.addEventListener('pointerdown', onDown);

    function loop(now) {
      if (!running) return;
      if (!last) last = now;
      var dt = Math.min(40, now - last) / 1000;
      last = now;
      t += dt;
      fall = Math.min(300, 90 + t * 8);
      f.extraEl.textContent = Math.round(fall) + ' px/s';

      spawnIn -= dt;
      if (spawnIn <= 0) {
        spawnItem();
        spawnIn = Math.max(0.22, 0.5 - t * 0.01);
      }

      for (var i = items.length - 1; i >= 0; i--) {
        var it = items[i];
        it.y += fall * dt;
        it.el.style.top = it.y + 'px';
        // 与玩家碰撞
        var pyTop = H - 14 - PH;
        if (
          !it.hit &&
          it.y + it.size > pyTop &&
          it.y < pyTop + PH &&
          it.x + it.size > px &&
          it.x < px + PW
        ) {
          if (it.bad) {
            dead = true;
            running = false;
            cancelAnimationFrame(raf);
            if (window.DDFX) {
              try {
                DDFX.sfx.rank();
              } catch (e) {}
            }
            f.stage.removeEventListener('pointerdown', onDown);
            setTimeout(function () {
              endScreen(f, ops, '引力穿针', function () {
                body.innerHTML = '';
                startNeedle(body);
              });
            }, 300);
            return;
          }
          it.hit = true;
          ops += 1;
          f.scoreEl.textContent = D().fmt(scoreOf(ops));
          if (window.DDFX) {
            try {
              DDFX.sfx.orb();
            } catch (e) {}
          }
        }
        if (it.y > H + 10) {
          f.stage.removeChild(it.el);
          items.splice(i, 1);
        }
      }
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);
    miniCleanup = function () {
      running = false;
      cancelAnimationFrame(raf);
      f.stage.removeEventListener('pointerdown', onDown);
    };
  }

  /* ============ 3. 脉冲连击：点光点，越点越快 ============ */
  function startPulse(body) {
    var f = buildStage(body, 250, '点亮点，躲红核');
    var W = f.stage.clientWidth || 320,
      H = 250;
    var ops = 0,
      combo = 0,
      running = true;
    var raf = 0,
      last = 0,
      spawnIn = 0.35,
      t = 0;
    var orbs = [];

    function spawnOrb() {
      var bad = Math.random() < Math.min(0.3, 0.08 + t * 0.004);
      var el = document.createElement('div');
      el.className = bad ? 'pulse-bad' : 'pulse-orb';
      var size = bad ? 30 : 38;
      var x = 8 + Math.random() * (W - size - 16);
      var y = 8 + Math.random() * (H - size - 16);
      var life = Math.max(620, 1900 - t * 28);
      el.style.width = size + 'px';
      el.style.height = size + 'px';
      el.style.left = x + 'px';
      el.style.top = y + 'px';
      f.stage.appendChild(el);
      var o = { el: el, bad: bad, life: life, born: performance.now(), done: false };
      el.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (!running || o.done) return;
        o.done = true;
        if (bad) {
          running = false;
          cancelAnimationFrame(raf);
          if (window.DDFX) {
            try {
              DDFX.sfx.rank();
            } catch (e) {}
          }
          setTimeout(function () {
            endScreen(f, ops, '脉冲连击', function () {
              body.innerHTML = '';
              startPulse(body);
            });
          }, 260);
        } else {
          combo += 1;
          ops += 1 + Math.floor(combo / 10); // 连击越高，单次算更多次操作
          f.scoreEl.textContent = D().fmt(scoreOf(ops));
          f.extraEl.textContent = '连击 ' + combo;
          if (window.DDFX) {
            try {
              DDFX.sfx.orb();
            } catch (e) {}
          }
          killOrb(o);
        }
      });
      orbs.push(o);
    }

    function killOrb(o) {
      o.done = true;
      if (o.el.parentNode) o.el.parentNode.removeChild(o.el);
      var i = orbs.indexOf(o);
      if (i >= 0) orbs.splice(i, 1);
    }

    function loop(now) {
      if (!running) return;
      if (!last) last = now;
      var dt = Math.min(40, now - last) / 1000;
      last = now;
      t += dt;

      spawnIn -= dt;
      if (spawnIn <= 0 && orbs.length < 5) {
        spawnOrb();
        spawnIn = Math.max(0.28, 0.72 - t * 0.012);
      }

      for (var i = orbs.length - 1; i >= 0; i--) {
        var o = orbs[i];
        if (o.done) continue;
        var age = now - o.born;
        if (age >= o.life) {
          if (!o.bad) {
            combo = 0;
            f.extraEl.textContent = '连击断了';
          }
          killOrb(o);
          continue;
        }
        var k = age / o.life;
        o.el.style.opacity = String(1 - k * 0.55);
        o.el.style.transform = 'scale(' + (1 - k * 0.15) + ')';
      }
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);
    miniCleanup = function () {
      running = false;
      cancelAnimationFrame(raf);
      while (orbs.length) killOrb(orbs[0]);
    };
  }

  function renderMini() {
    var m = S().mini;
    var left = playsLeft();
    m.badges = badgeCount();
    $('miniEnergy').textContent = MINI_PER_DAY - left + '/' + MINI_PER_DAY;
    $('miniBadge').textContent = m.badges;
    $('miniWins').textContent = m.wins;

    var list = $('miniList');
    if (list) {
      list.innerHTML = '';
      GAMES.forEach(function (g) {
        var li = document.createElement('li');
        li.className = 'mini-card';
        li.innerHTML =
          '<span class="mini-ico">' +
          g.icon +
          '</span>' +
          '<div class="item-main"><div class="item-name">' +
          g.name +
          '</div>' +
          '<div class="item-desc">' +
          g.desc +
          '</div></div>' +
          '<button type="button" class="mini-go"' +
          (left <= 0 ? ' disabled' : '') +
          '>开始</button>';
        li.querySelector('button').addEventListener('click', function () {
          openGame(g);
        });
        list.appendChild(li);
      });
    }

    var card = $('idleCard');
    if (card) {
      var core = S().idle.core;
      var rate = Math.min(1, 0.55 + core * 0.025);
      var auto = S().idle.auto;
      var cost = Math.round(20000 * gain() * Math.pow(1.7, core));
      var acost = Math.round(5000 * gain() * Math.pow(1.6, auto));
      card.innerHTML =
        '<div class="idle-row"><span>离线收益效率</span><b>' +
        Math.round(rate * 100) +
        '%</b></div>' +
        '<div class="idle-row"><span>离线累计上限</span><b>' +
        IDLE_CAP_H +
        ' 小时</b></div>' +
        '<div class="idle-row"><span>自动点击无人机</span><b>' +
        auto +
        ' 架 · ' +
        (auto * 0.4).toFixed(1) +
        ' 次/秒</b></div>' +
        '<div class="idle-ops">' +
        '<button type="button" id="idleCore"' +
        (core >= 20 || S().dust < cost ? ' disabled' : '') +
        '>采集核心 ' +
        D().fmt(cost) +
        '</button>' +
        '<button type="button" id="idleAuto"' +
        (auto >= 20 || S().dust < acost ? ' disabled' : '') +
        '>自动无人机 ' +
        D().fmt(acost) +
        '</button>' +
        '</div>';
      var cb = $('idleCore');
      if (cb)
        cb.addEventListener('click', function () {
          if (S().idle.core >= 20 || S().dust < cost) return;
          S().dust -= cost;
          S().idle.core += 1;
          D().checkAchs();
          render();
          D().save();
        });
      var ab = $('idleAuto');
      if (ab)
        ab.addEventListener('click', function () {
          if (S().idle.auto >= 20 || S().dust < acost) return;
          S().dust -= acost;
          S().idle.auto += 1;
          render();
          D().save();
        });
    }

    var claimBox = $('idleClaim');
    if (claimBox) {
      var rep = S().idle.report;
      claimBox.innerHTML = rep
        ? '<p class="panel-tip">上次离线 ' +
          fmtLeft(rep.away * 1000) +
          '，按 ' +
          Math.round(rep.rate * 100) +
          '% 效率收入 <b>' +
          D().fmt(rep.gain) +
          '</b> 星尘。</p>'
        : '<p class="panel-tip dim">关掉页面也会继续生产，回来记得看看这里。</p>';
    }
  }

  /* ===================== 总倍率 & 主循环 ===================== */

  function mult() {
    return stockMult() * petMult() * (1 + badgeCount() * 0.03) * (1 + S().idle.core * 0.02);
  }

  var autoAcc = 0;

  function tick(dtMs) {
    var st = S();
    if (!st) return;
    var dt = dtMs || 100;

    stockTick(dt);
    playsToday();

    var auto = st.idle.auto;
    if (auto > 0) {
      autoAcc += dt * auto * 0.4;
      while (autoAcc >= 1000) {
        autoAcc -= 1000;
        var g = D().clickPower * 0.35;
        st.dust += g;
        st.total += g;
      }
    }
  }

  var renderAcc = 0;
  function slowRender(dt) {
    renderAcc += dt;
    if (renderAcc < 500) return;
    renderAcc = 0;
    renderStocks();
    renderFleet();
    renderMini();
  }

  var attached = false;

  function attach() {
    if (!window.DD || attached) return;
    attached = true;
    var st = S();
    TICKERS.forEach(function (t) {
      if (!st.stocks.prices[t.id]) st.stocks.prices[t.id] = 1;
    });
    if (!st.stocks.newsAt) st.stocks.newsAt = 0;
    if (!st.stocks.divAt) st.stocks.divAt = 0;

    $('miniClose').addEventListener('click', closeGame);
    $('miniModal').addEventListener('click', function (e) {
      if (e.target === $('miniModal')) closeGame();
    });

    // 切标签立刻刷新，别让玩家看到旧的禁用按钮
    document.querySelectorAll('.tab').forEach(function (t) {
      t.addEventListener('click', function () {
        setTimeout(render, 0);
      });
    });

    // 离线收益在 game.js 里只按基础产出算过一次；这里补上股市/宠物/星章的加成。
    // 必须只结算一次：report 会跟着存档留下来，不标记的话每次刷新页面都会再领一遍。
    var r = st.idle.report;
    if (r && r.away > 0 && !r.settled) {
      var extra =
        ((D().cps * Math.min(r.away, IDLE_CAP_H * 3600 * 1000)) / 1000) * r.rate * (mult() - 1);
      if (extra > 1) {
        st.dust += extra;
        st.total += extra;
        st.stats.idleDust += extra;
        r.gain += extra;
      }
      r.settled = true;
    }

    renderStocks();
    renderFleet();
    renderMini();
    setInterval(function () {
      slowRender(500);
    }, 500);
    playsToday();
    D().checkRanks();
    D().render();
  }

  global.DDSystems = {
    attach: attach,
    tick: function (dt) {
      tick(dt);
      slowRender(dt);
    },
    mult: mult,
    capital: capital,
    petPower: petPower,
    stockMult: stockMult,
    petMult: petMult,
    badges: badgeCount
  };
})(window);

// game.js 先执行，等它暴露好 DD 再挂载
if (window.DD) window.DDSystems.attach();
