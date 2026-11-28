// 点点星球 · 账号 + 云同步 + 排行榜 + 管理员后台（客户端）
// 原则：分数属于服务器，本地只是缓存；表对前端完全关闭，只能走接口函数。
(() => {
  'use strict';

  /* ========== 1. 后端地址（只有站长改这里，玩家看不到也改不了） ========== */
  const CFG = {
    // Supabase 项目地址，例如：https://abcdefgh.supabase.co
    url: 'https://bjeltfyiqwmnsbpdynmf.supabase.co',
    // Supabase 的 anon / publishable key（公开的，可以放在前端）
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqZWx0ZnlpcXdtbnNicGR5bm1mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUyNDMyMTYsImV4cCI6MjExMDgxOTIxNn0.Jq_7aBcR-Zii6t3ve5JIXaLrQ3WzuZtMQe6HEm7wP5Y'
  };

  // 用户在页面上填过的地址和 key 存在本机，下次打开直接用
  try {
    const sUrl = localStorage.getItem('aiweb.clicker.url');
    const sKey = localStorage.getItem('aiweb.clicker.key');
    if (sUrl) CFG.url = sUrl;
    if (sKey) CFG.key = sKey;
  } catch (e) {}

  const K = {
    token: 'aiweb.clicker.token',
    name: 'aiweb.clicker.name'
  };

  const $ = id => document.getElementById(id);
  const ready = () => !!(CFG.url && CFG.key);

  function tok() {
    try {
      return localStorage.getItem(K.token) || '';
    } catch (e) {
      return '';
    }
  }
  function setTok(v) {
    try {
      v ? localStorage.setItem(K.token, v) : localStorage.removeItem(K.token);
    } catch (e) {}
  }
  function myName() {
    try {
      return localStorage.getItem(K.name) || '';
    } catch (e) {
      return '';
    }
  }
  function setName(v) {
    try {
      localStorage.setItem(K.name, v || '');
    } catch (e) {}
  }

  const S = () => (window.DD ? window.DD.state : null);

  function fmt(n) {
    n = Number(n) || 0;
    if (window.DD && window.DD.fmt) {
      try {
        return window.DD.fmt(n);
      } catch (e) {}
    }
    const U = [
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
    if (n >= 1e52) return n.toExponential(2);
    for (let i = 0; i < U.length; i++) {
      if (n >= U[i][0]) {
        const x = n / U[i][0];
        return (x >= 1e3 ? Math.floor(x).toString() : x.toFixed(2)) + U[i][1];
      }
    }
    if (n >= 1e8) return (n / 1e8).toFixed(2) + '亿';
    if (n >= 1e4) return (n / 1e4).toFixed(2) + '万';
    return Math.floor(n).toString();
  }

  function hdr() {
    return {
      'Content-Type': 'application/json',
      apikey: CFG.key,
      Authorization: 'Bearer ' + CFG.key
    };
  }

  // 调 Supabase 的 rpc 函数：POST /rest/v1/rpc/<函数名>，参数直接当 JSON body
  // 带超时，避免网络被黑洞时一直转圈
  async function rpc(fn, body) {
    if (!ready()) return { ok: false, reason: 'nosetup' };
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    let timer = 0;
    if (ctrl)
      timer = setTimeout(() => {
        try {
          ctrl.abort();
        } catch (e) {}
      }, 12000);
    let r;
    try {
      r = await fetch(CFG.url.replace(/\/+$/, '') + '/rest/v1/rpc/' + fn, {
        method: 'POST',
        headers: hdr(),
        body: JSON.stringify(body || {}),
        signal: ctrl ? ctrl.signal : undefined
      });
    } catch (e) {
      return { ok: false, reason: '连不上服务器' };
    } finally {
      if (timer) clearTimeout(timer);
    }
    let data = null;
    try {
      data = await r.json();
    } catch (e) {}
    if (!r.ok) {
      // 函数内部报错时 Supabase 会回 { message, code }
      return {
        ok: false,
        reason: (data && (data.message || data.hint || data.details)) || 'HTTP ' + r.status
      };
    }
    return data;
  }

  /* ===== 云端连通性探测 / 离线降级 ===== */
  // 实测有些网络访问 Supabase 时会在 TLS 握手阶段被重置，任何请求都失败。
  // 所以启动先探测一次：通则正常登录/同步；不通就进离线模式（不弹登录框、不报错），
  // 只在页面重新可见或网络恢复时再探测，避免离线时反复重试刷屏。
  let cloudOn = true; // 云端当前是否可用
  let probing = false; // 是否正在探测
  const PROBE_TIMEOUT = 4000; // 探测超时，3–5 秒

  // 只要服务器有 HTTP 回应（哪怕这个函数还不存在）就算连通；TLS 被重置才会走 catch
  function probe(timeoutMs) {
    if (!ready()) return Promise.resolve(false);
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    let timer = 0;
    if (ctrl)
      timer = setTimeout(() => {
        try {
          ctrl.abort();
        } catch (e) {}
      }, timeoutMs || PROBE_TIMEOUT);
    return fetch(CFG.url.replace(/\/+$/, '') + '/rest/v1/rpc/api_health', {
      method: 'POST',
      headers: hdr(),
      body: '{}',
      signal: ctrl ? ctrl.signal : undefined
    })
      .then(() => true)
      .catch(() => false)
      .then(good => {
        if (timer) clearTimeout(timer);
        return good;
      });
  }

  // 云端连不上：仍然把登录门留在页面上（给重试和「先离线玩」两个出口），
  // 绝不静默地放人进去，否则玩家会以为登录界面不见了。
  function enterOffline() {
    if (!cloudOn) return;
    cloudOn = false;
    if (tok()) {
      showMe();
      updateGate(true);
      status('云端连不上，先离线继续（进度只存本机）', 'off');
    } else {
      showAuth();
      const off = $('gateOffline');
      if (off) off.classList.remove('hidden');
      updateGate(false);
      status('云端连不上：检查网络后点「登录」重试，或先离线玩', 'off');
    }
    if ($('adminBox')) $('adminBox').classList.add('hidden');
    if ($('lbList')) renderBoard([], '离线中，排行榜不可用');
  }

  // 离线时被 visibilitychange / online 叫醒，再探测一次
  async function recheck() {
    if (!ready() || probing) return;
    probing = true;
    const good = await probe(PROBE_TIMEOUT);
    probing = false;
    if (!good) {
      if (cloudOn) enterOffline();
      return;
    }
    if (!cloudOn) {
      cloudOn = true;
      status('云端恢复了', 'ok');
      toast('☁️ 云端恢复了');
      if (tok()) {
        showMe();
        resume();
      } else {
        showAuth();
        status('云端恢复了，登录就能上传', 'idle');
      }
      loadBoard();
      if (isStaff()) loadAdmin();
    }
  }

  /* ========== 2. 界面骨架 ========== */
  let role = ''; // '' / 'user' / 'admin' / 'author'
  // 上传锁：登录后必须先成功拉到云端存档，才允许再往云端写。
  // 否则「本地离线进度 → 自动上传」会把服务器上的账号存档整份覆盖掉（作者号变 200 万的 bug）。
  let syncLock = ''; // '' 允许上传；'need_pull' 还没拉到云端存档，禁止写云端
  const isStaff = () => role === 'admin' || role === 'author';
  let busy = false;
  let tickAt = 0;
  const RESET_FLAG = 'aiweb.clicker.resetPending';

  // 本地重置过、云端还没清：这期间不许拿云端总分回来覆盖
  function resetPending() {
    try {
      return localStorage.getItem(RESET_FLAG) === '1';
    } catch (e) {
      return false;
    }
  }

  // 把云端也清零（重置进度用）；失败就留着标记，下次同步再试
  async function clearCloud() {
    if (!ready() || !tok()) return false;
    if (!cloudOn) {
      status('云端连不上，已离线；进度都存在本机', 'off');
      return false;
    }
    const res = await rpc('api_reset', { p_token: tok() });
    if (res && res.ok) {
      try {
        localStorage.removeItem(RESET_FLAG);
      } catch (e) {}
      status('云端已清空 · ' + fmt(0), 'ok');
      return true;
    }
    status('云端还没清掉，下次同步再试', 'warn');
    return false;
  }

  /* ===== 登录门：不登录不能玩；云端断了也要看得见门，用户可以选重试或离线 ===== */
  // 开场是否还盖在页面上。注意开场关闭用的是 style.display='none'，
  // 不是加 .hidden 类——之前用 classList 判断会永远为「还在」，登录门于是永远不出现。
  function introVisible() {
    const intro = document.getElementById('intro');
    if (!intro) return false;
    if (intro.classList.contains('hidden')) return false;
    if (intro.style.display === 'none') return false;
    try {
      return getComputedStyle(intro).display !== 'none';
    } catch (e) {
      return true;
    }
  }

  function updateGate(logged) {
    const gate = $('loginGate');
    if (!gate) return;
    const open = !!logged;
    if (!open && introVisible()) {
      // 开场动画（5 秒署名）期间先别弹登录门，等它放完
      document.addEventListener('introDone', () => updateGate(false), { once: true });
      return;
    }
    gate.classList.toggle('hidden', open);
    document.body.classList.toggle('locked', !open);
    if (open) {
      // 登录门收起后把焦点从账号/密码框上摘掉：手机输入法会一直激活，
      // 之后按键全被输入法吃掉，外接/蓝牙键盘连点星球就失灵。
      const a = document.activeElement;
      if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable)) {
        try {
          a.blur();
        } catch (_) {}
      }
      if (window.DD && window.DD.releaseKeys) {
        try {
          window.DD.releaseKeys();
        } catch (_) {}
      }
    }
  }

  function offlinePlay() {
    cloudOn = false;
    updateGate(true);
    status('离线模式：进度只存在这台手机，联网登录后会被服务器存档覆盖', 'warn');
  }

  function status(text, tone) {
    const el = $('lbStatus');
    if (!el) return;
    el.textContent = text;
    el.dataset.tone = tone || 'idle';
  }

  function toast(msg) {
    if (window.DD && window.DD.toast) {
      window.DD.toast(msg, 2600);
      return;
    }
    const t = $('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2600);
  }

  function showAuth() {
    $('authBox') && $('authBox').classList.remove('hidden');
    $('meBox') && $('meBox').classList.add('hidden');
    $('adminBox') && $('adminBox').classList.add('hidden');
    role = '';
  }

  function syncRoleTitle() {
    const t = $('adminTitle');
    if (!t) return;
    t.textContent = role === 'author' ? '作者后台（最高权限）' : '管理员后台';
  }

  function showMe(name) {
    syncRoleTitle();
    $('authBox') && $('authBox').classList.add('hidden');
    $('meBox') && $('meBox').classList.remove('hidden');
    const el = $('meName');
    if (el) el.textContent = name || myName() || '—';
    const out = $('auOut');
    if (out) out.classList.toggle('hidden', !tok());
  }

  /* 登录 / 注册
     登录老号 = 先清空本机，再用服务器存档整份覆盖，两边数据绝不混合
     注册新号 = 把当前这台手机的进度整份写进新账号 */
  function buildUI() {
    if (!$('lbList')) return;

    const doAuth = async kind => {
      const u = (($('auName') && $('auName').value) || '').trim();
      const p = ($('auPass') && $('auPass').value) || '';
      if (!u || !p) {
        status('账号和密码都要填', 'bad');
        return;
      }
      if (kind === 'reg') {
        // 新注册：至少 6 位，且必须同时包含小写字母和数字（老账号登录不检查）
        if (p.length < 6) {
          status('密码至少 6 位', 'bad');
          return;
        }
        if (!/[a-z]/.test(p)) {
          status('密码里要有小写字母', 'bad');
          return;
        }
        if (!/[0-9]/.test(p)) {
          status('密码里要有数字', 'bad');
          return;
        }
      }
      if (!cloudOn) {
        status('云端连不上，正在重试…', 'busy');
        await recheck();
        if (!cloudOn) {
          status('还是连不上：检查网络后重试，或先离线玩', 'bad');
          return;
        }
      }
      status(kind === 'reg' ? '注册中…' : '登录中…', 'busy');
      try {
        const res = await rpc(kind === 'reg' ? 'api_register' : 'api_login', {
          p_user: u,
          p_pass: p
        });
        if (!res || !res.ok) {
          status((res && res.reason) || '失败', 'bad');
          return;
        }
        setTok(res.token);
        setName(res.name);
        role = res.role || 'user';
        if ($('auPass')) $('auPass').value = '';
        showMe(res.name);
        toast(kind === 'reg' ? '☁️ 注册好了，进度会自动上传' : '☁️ 欢迎回来');
        updateGate(true);

        if (kind === 'reg') {
          // 新账号：本机进度原样写进新号（这是需求里唯一允许把本机数据上传的入口）
          syncLock = '';
          const ok = await pushSave('reg-init');
          status(
            ok ? '云端 · 已把本机进度存进新号' : '已登录，但初始上传没成功，稍后会自动重试',
            ok ? 'ok' : 'warn'
          );
        } else {
          // 登录老账号：服务器存档整份替换本地，不是合并、不取最大值、不保留本机进度。
          // 拉取失败时本机先不动，但上传锁保持关闭——绝不拿本机数据去覆盖服务器。
          syncLock = 'need_pull';
          if (window.__syncLockUI) window.__syncLockUI();
          const got = await pullSave();
          if (got.ok) {
            syncLock = '';
            if (window.__syncLockUI) window.__syncLockUI();
            if (got.had) {
              status('云端 · 已用服务器存档整份覆盖本机', 'ok');
            } else {
              // 老账号但服务器上确实没有存档：先清空本机，再把这台手机的空档写上去，
              // 避免离线玩出来的进度混进这个账号。
              if (window.DD && window.DD.clearAll) window.DD.clearAll();
              await pushSave('login-init');
              status('云端 · 这个账号还没有存档，已从零开始', 'ok');
            }
          } else {
            status(
              '存档读取失败，上传已暂停（不会覆盖服务器数据）。检查网络后点「立即上传」旁的重试',
              'bad'
            );
          }
        }
        if (isStaff()) {
          $('adminBox') && $('adminBox').classList.remove('hidden');
          loadAdmin();
        }
        loadBoard();
      } catch (e) {
        status('连不上服务器，稍后再试', 'off');
      }
    };

    const loginBtn = $('auLogin');
    if (loginBtn) loginBtn.addEventListener('click', () => doAuth('login'));
    const regBtn = $('auReg');
    if (regBtn) regBtn.addEventListener('click', () => doAuth('reg'));
    const pass = $('auPass');
    if (pass)
      pass.addEventListener('keydown', e => {
        if (e.key === 'Enter') doAuth('login');
      });

    // 云端连不上时才出现的「先离线玩」出口
    const offBtn = $('gateOffline');
    if (offBtn)
      offBtn.addEventListener('click', () => {
        offlinePlay();
        offBtn.classList.add('hidden');
      });

    const out = $('auOut');
    if (out)
      out.addEventListener('click', async () => {
        if (
          !window.confirm(
            '退出登录会清掉这台手机上的当前进度（云端存档还在，下次登录会重新载入）。继续？'
          )
        )
          return;
        try {
          await rpc('api_logout', { p_token: tok() });
        } catch (e) {}
        setTok('');
        setName('');
        role = '';
        syncLock = '';
        if (window.DD && window.DD.clearAll) window.DD.clearAll();
        showAuth();
        updateGate(false);
        status('已退出，请重新登录', 'idle');
      });

    const syncBtn = $('lbSync');
    if (syncBtn) syncBtn.addEventListener('click', () => sync('manual'));

    // 上传被锁（还没拉到云端存档）时，给一个明确的重试出口
    const pullBtn = $('lbPull');
    if (pullBtn)
      pullBtn.addEventListener('click', async () => {
        status('正在重新拉取云端存档…', 'busy');
        const got = await pullSave();
        if (got.ok) {
          syncLock = '';
          syncLockUI();
          status(got.had ? '云端 · 已用服务器存档覆盖本机' : '云端 · 这个账号还没有存档', 'ok');
        } else {
          status('还是拉不到：' + (got.reason || '网络问题') + '，上传继续暂停', 'bad');
        }
      });

    // 锁着的时候把「立即上传」变灰、把「重新拉取」亮出来
    function syncLockUI() {
      if ($('lbSync')) $('lbSync').disabled = !!syncLock;
      if ($('lbPull')) $('lbPull').classList.toggle('hidden', !syncLock);
    }
    window.__syncLockUI = syncLockUI;
    syncLockUI();

    const refresh = $('lbRefresh');
    if (refresh) refresh.addEventListener('click', () => loadBoard(true));

    const save = $('lbSave');
    if (save)
      save.addEventListener('click', async () => {
        const u = (($('lbUrl') && $('lbUrl').value) || '').trim().replace(/\/+$/, '');
        const k = (($('lbKey') && $('lbKey').value) || '').trim();
        if (!/^https?:\/\/[^\s]+$/i.test(u)) {
          status('地址要以 https:// 开头，例如 https://abc.supabase.co', 'bad');
          return;
        }
        if (k.length < 40) {
          status('key 没粘全，要整段复制（很长一串）', 'bad');
          return;
        }
        CFG.url = u;
        CFG.key = k;
        try {
          localStorage.setItem('aiweb.clicker.url', u);
          localStorage.setItem('aiweb.clicker.key', k);
        } catch (e) {}
        if ($('lbSetup')) $('lbSetup').classList.add('hidden');
        status('正在连接云端…', 'busy');
        const good = await probe(PROBE_TIMEOUT);
        if (!good) {
          enterOffline();
          return;
        }
        cloudOn = true;
        status('已连接，注册或登录吧', 'ok');
        loadBoard();
        if (tok()) {
          showMe();
          resume();
        } else {
          showAuth();
        }
      });

    if (!ready()) {
      if ($('lbSetup')) $('lbSetup').classList.remove('hidden');
      status('先把 Supabase 地址和 key 填上', 'off');
      return;
    }
    if ($('lbSetup')) {
      $('lbUrl') && ($('lbUrl').value = CFG.url);
      $('lbKey') && ($('lbKey').value = CFG.key);
    }
  }

  /* 回到页面：拿令牌换身份，然后把服务器上的完整存档整份拉到本地 */
  async function resume() {
    if (!cloudOn || !tok()) return;
    try {
      const me = await rpc('api_me', { p_token: tok() });
      if (!me) {
        status('连不上服务器，稍后自动重试', 'off');
        return;
      }
      if (!me.ok) {
        if (String(me.reason || '').indexOf('登录') >= 0) {
          setTok('');
          showAuth();
          status('登录已过期，请重新登录', 'off');
          updateGate(false);
        } else {
          status(me.reason || '连不上服务器', 'off');
        }
        return;
      }
      setName(me.name);
      role = me.role || 'user';
      showMe(me.name);
      syncLock = 'need_pull';
      if (window.__syncLockUI) window.__syncLockUI();
      const got = await pullSave();
      if (got.ok) {
        syncLock = '';
        if (window.__syncLockUI) window.__syncLockUI();
        updateGate(true);
        status(got.had ? '云端 · 已载入服务器存档' : '云端 · 这个账号还没有存档', 'ok');
      } else {
        status(got.reason || '存档读取失败，上传已暂停以免覆盖云端', 'bad');
      }
      if (isStaff()) {
        $('adminBox') && $('adminBox').classList.remove('hidden');
        loadAdmin();
      }
    } catch (e) {
      status('连不上服务器，稍后自动重试', 'off');
    }
  }

  /* 服务器解锁了新星球：本地直接跳过去 */
  function applyServer(res) {
    const st = S();
    if (!st || !res) return;
    const p = Number(res.planets) || 1;
    if (p > 1 && (st.world || 0) < p - 1) {
      const before = st.world || 0;
      const target = Math.min(9, p - 1);
      // 服务器只说「解锁到第几颗」，本机不能直接改 world 了事：
      // 那样第 8 颗星球会沿用第 3 颗的升级/身份数据。先整份导出（导出会先把
      // 当前星球存进 pdata），改掉 world，再整份导回，目标星球就装它自己的档。
      if (window.DD && window.DD.exportData && window.DD.importData) {
        const snap = window.DD.exportData();
        snap.world = target;
        window.DD.importData(snap);
      } else {
        st.world = target;
      }
      if (window.DD) {
        try {
          window.DD.save();
          window.DD.render();
        } catch (e) {}
      }
      if (target > before) toast('🪐 管理员给你解锁了第 ' + (target + 1) + ' 颗星球');
    }
  }

  /* ========== 3. 上传完整存档 ========== */

  // 拉：服务器上的存档整份替换本地，不合并不取最大值
  async function pullSave() {
    if (!ready() || !cloudOn || !tok()) return { ok: false, reason: '离线中' };
    // 本地刚重置过、云端还没清干净：先把云端清掉再拉，别把旧存档拉回来覆盖重置进度
    if (resetPending() && !(await clearCloud())) {
      status('已重置本机进度，云端存档还没清掉；下次联网会自动再试', 'warn');
      return { ok: true, had: false, resetPending: true };
    }
    const res = await rpc('api_load', { p_token: tok() });
    if (!res || !res.ok) return { ok: false, reason: (res && res.reason) || '读取存档失败' };
    const sv = res.save;
    let had = false;
    if (sv && typeof sv === 'object' && window.DD && window.DD.importData) {
      window.DD.importData(sv);
      had = true;
    }
    // 服务器可能把星球解锁得更多（管理员操作），拉档后统一应用一次
    applyServer(res);
    return { ok: true, had: had };
  }

  // 推：把当前账号的整份存档写回服务器
  async function pushSave(reason) {
    const st = S();
    if (!st) return false;
    if (!ready()) {
      status('排行榜还没开通', 'off');
      return false;
    }
    if (!cloudOn) {
      if (reason === 'manual') status('云端连不上，已离线；进度都存在本机', 'off');
      return false;
    }
    if (!tok()) {
      status('登录后才会保存进度', 'idle');
      return false;
    }
    if (syncLock) {
      if (reason === 'manual')
        status(
          '还没把云端存档拉下来，先别上传，免得覆盖服务器数据（点排行榜里的「重新拉取」）',
          'warn'
        );
      return false;
    }
    if (busy) return false;
    const data = window.DD && window.DD.exportData ? window.DD.exportData() : st;
    busy = true;
    status('同步中…', 'busy');
    try {
      const res = await rpc('api_save', { p_token: tok(), p_save: data });
      if (res && res.ok) {
        // 后台加过星尘：服务器在收档时补进去了，这里同步补到本机，不然下次上传又覆盖回去
        if (Number(res.granted) > 0 && window.DD && window.DD.credit) {
          window.DD.credit(Number(res.granted));
          toast('☁️ 站长给你加了 ' + fmt(res.granted));
        }
        // 后端顺手解锁了星球（管理员操作）：本机直接跳过去，不用等下次重新拉档
        applyServer(res);
        status('已上传整份存档' + (res.bytes ? ' · ' + fmt(res.bytes) + ' 字节' : ''), 'ok');
        if (reason === 'manual') toast('☁️ 存档已上传');
        return true;
      }
      if (res && res.reason === 'need_login') {
        setTok('');
        showAuth();
        updateGate(false);
        status('请先登录再上传', 'off');
        return false;
      }
      if (res && res.reason === 'too_big') {
        status('存档太大，服务器没收', 'bad');
        return false;
      }
      status('上传失败：' + ((res && res.reason) || '未知'), 'bad');
      return false;
    } catch (e) {
      status('连不上服务器，稍后自动重试', 'off');
      return false;
    } finally {
      busy = false;
    }
  }

  function sync(reason) {
    return pushSave(reason);
  }

  /* ========== 4. 排行榜 ========== */
  let boardLoading = false;

  async function loadBoard(showTip) {
    const list = $('lbList');
    if (!list) return;
    if (!ready()) {
      renderBoard([], '排行榜还没开通');
      return;
    }
    if (!cloudOn) {
      renderBoard([], '离线中，排行榜不可用');
      return;
    }
    if (boardLoading) return;
    boardLoading = true;
    try {
      const rows = await rpc('api_board', { p_limit: 50 });
      // 管理员和作者不上榜（后端也过滤，这里再挡一层）
      const list = Array.isArray(rows)
        ? rows.filter(r => r && r.user_role !== 'admin' && r.user_role !== 'author')
        : [];
      renderBoard(list);
    } catch (e) {
      renderBoard([], '排行榜加载失败，检查网络');
    } finally {
      boardLoading = false;
    }
  }

  function renderBoard(rows, emptyText) {
    const list = $('lbList');
    if (!list) return;
    list.innerHTML = '';

    if (!rows.length) {
      const p = document.createElement('p');
      p.className = 'panel-tip small';
      p.textContent = emptyText || '还没有人上榜，你上传一次就是第一名';
      list.appendChild(p);
      return;
    }

    const me = (myName() || '').toLowerCase();
    rows.forEach(r => {
      const li = document.createElement('li');
      li.className = 'lb-row' + (String(r.name || '').toLowerCase() === me ? ' me' : '');

      const pos = document.createElement('span');
      pos.className = 'lb-pos';
      pos.textContent = Number(r.pos) <= 3 ? ['🥇', '🥈', '🥉'][Number(r.pos) - 1] : '#' + r.pos;

      const nm = document.createElement('span');
      nm.className = 'lb-name';
      nm.textContent = r.name || '无名旅人';
      if (r.user_role === 'author' || r.user_role === 'admin') {
        const rt = document.createElement('span');
        rt.className = 'lb-tag ' + (r.user_role === 'author' ? 'author' : 'staff');
        rt.textContent = r.user_role === 'author' ? '作者' : '管理';
        nm.appendChild(rt);
      }
      if (r.planets) {
        const pl = document.createElement('span');
        pl.className = 'lb-tag';
        pl.textContent = 'P' + r.planets;
        nm.appendChild(pl);
      }
      if (r.suspicious) {
        const tag = document.createElement('span');
        tag.className = 'lb-tag warn';
        tag.textContent = '待查';
        tag.title = '这个分数有过异常上传，站长还没判';
        nm.appendChild(tag);
      }

      const sc = document.createElement('span');
      sc.className = 'lb-score';
      sc.textContent = fmt(r.total);

      li.append(pos, nm, sc);
      list.appendChild(li);
    });
  }

  /* ========== 5. 管理员后台 ========== */
  function bindAdminTools() {
    // 一键清空只给作者：管理员只能做加法，连按钮都不显示
    const tools = $('adAuthorTools');
    if (tools) tools.classList.toggle('hidden', role !== 'author');

    const bS = $('adClearScores');
    if (bS && !bS.dataset.bound) {
      bS.dataset.bound = '1';
      bS.addEventListener('click', async () => {
        if (
          !window.confirm(
            '清空全服所有人的进度（星尘、宠物、股票、小游戏、星球），账号和密码全部保留？'
          )
        )
          return;
        if (!window.confirm('再确认一次：全员归零，不能恢复。')) return;
        await adminCall('api_admin_clear', { p_mode: 'scores' }, '全服数据已清零');
      });
    }
  }

  async function loadQuota() {
    const el = $('adminQuota');
    if (!el) return;
    const res = await rpc('api_admin_quota', { p_token: tok() });
    if (!res || !res.ok) {
      el.textContent = '';
      return;
    }
    if (res.role === 'author') {
      el.textContent = '作者：不限次数，可清空全服数据、改权限';
    } else {
      el.textContent =
        '管理员：今天还能改 ' +
        res.left +
        ' 次（' +
        res.used +
        '/' +
        res.limit +
        '，只能加不能减）';
    }
  }

  async function loadAdmin() {
    bindAdminTools();
    loadQuota();
    const box = $('adminList');
    if (!box) return;
    if (!cloudOn) {
      box.innerHTML = '<p class="panel-tip small">离线中，后台不可用</p>';
      return;
    }
    box.innerHTML = '<p class="panel-tip small">读取中…</p>';
    try {
      const res = await rpc('api_admin_list', { p_token: tok() });
      if (!res || !res.ok) {
        box.innerHTML = '';
        return;
      }
      renderAdmin(res.rows || []);
    } catch (e) {
      box.innerHTML = '<p class="panel-tip small">后台加载失败</p>';
    }
  }

  function renderAdmin(rows) {
    const box = $('adminList');
    if (!box) return;
    box.innerHTML = '';
    if (!rows.length) {
      box.innerHTML = '<p class="panel-tip small">还没有用户</p>';
      return;
    }

    rows.forEach(u => {
      const row = document.createElement('div');
      row.className = 'admin-row';

      const head = document.createElement('div');
      head.className = 'admin-head';
      const nm = document.createElement('b');
      const roleLabel = u.role === 'author' ? '（作者）' : u.role === 'admin' ? '（管理员）' : '';
      nm.textContent = u.name + roleLabel;
      const sum = document.createElement('span');
      sum.className = 'small';
      sum.textContent = fmt(u.total) + ' · P' + u.planets + ' · ' + u.age_hours + ' 小时';
      head.append(nm, sum);

      row.appendChild(head);

      // 今日收益：后端按 UTC+8 零点记基线；旧版后端没有 today_gain 就显示「今日 —」
      const today = document.createElement('p');
      today.className = 'panel-tip small';
      const gain = u.today_gain;
      if (gain === undefined || gain === null || gain === '' || !isFinite(Number(gain))) {
        today.textContent = '今日 —';
      } else {
        let txt = '今日 +' + fmt(Number(gain));
        const syncs = Number(u.today_syncs);
        if (u.today_syncs !== undefined && u.today_syncs !== null && isFinite(syncs)) {
          txt += '（已同步 ' + syncs + ' 次）';
        } else if (u.today_at) {
          // 旧一点的服务器没有 today_syncs，就显示统计窗口有多久
          const hrs = (Date.now() - Number(u.today_at)) / 3600000;
          if (isFinite(hrs) && hrs >= 0) {
            txt +=
              '（统计 ' +
              (hrs < 1 ? Math.max(1, Math.round(hrs * 60)) + ' 分钟' : hrs.toFixed(1) + ' 小时') +
              '）';
          }
        }
        today.textContent = txt;
      }
      row.appendChild(today);

      if (u.verdict === 'ok') {
        const v = document.createElement('div');
        v.className = 'admin-why ok';
        v.textContent = '✓ 已判为真玩家';
        row.appendChild(v);
      }
      if (u.verdict === 'cheat') {
        const v = document.createElement('div');
        v.className = 'admin-why';
        v.textContent = '✕ 已判假，不上榜';
        row.appendChild(v);
      }

      const isSelf =
        !!u.is_self || (!!myName() && String(u.name).toLowerCase() === myName().toLowerCase());

      if (isSelf) {
        const me = document.createElement('div');
        me.className = 'admin-why ok';
        me.textContent =
          role === 'author'
            ? '★ 这是你自己（作者）：作者是最高权限，别人的权限你能改，自己的不能改'
            : '★ 这是你自己：不能判定、不能删、不能改权限';
        row.appendChild(me);
      }

      const acts = document.createElement('div');
      acts.className = 'admin-acts';

      const bGrant = document.createElement('button');
      bGrant.className = 'ghost tiny';
      bGrant.textContent = '+星尘';
      bGrant.addEventListener('click', async () => {
        // 作者不受单次额度限制，管理员仍然是每次最多 1000 万亿
        const isAuthor = role === 'author';
        const v = window.prompt(
          '给「' +
            u.name +
            '」加多少？（同时加到：钱包星尘 + 榜分 + 他正在玩的那颗星球' +
            (isAuthor ? '，作者不限额度' : '，一次最多 1000 万亿') +
            '）',
          isAuthor ? '1000000000000000000' : '1000000000000'
        );
        if (v === null) return;
        const n = Number(v.replace(/[,，\s]/g, ''));
        if (!isFinite(n) || n <= 0) {
          toast('数字不对');
          return;
        }
        // 作者不限额度；管理员仍然是每次最多 1000 万亿（数据库里也有同样的判断）
        if (!isAuthor && n > 1e15) {
          toast('一次最多 1000 万亿');
          return;
        }
        await adminCall(
          'api_admin_grant',
          { p_name: u.name, p_amount: n },
          '已加 ' + fmt(n) + '（星尘 + 分数）'
        );
      });

      const bUnlock = document.createElement('button');
      bUnlock.className = 'ghost tiny';
      bUnlock.textContent = '解锁星球';
      bUnlock.addEventListener('click', async () => {
        const v = window.prompt(
          '给「' + u.name + '」解锁到第几颗星球？（1 – 10）',
          String(Math.min(10, (u.planets || 1) + 1))
        );
        if (v === null) return;
        const p = Math.floor(Number(v));
        if (!(p >= 1 && p <= 10)) {
          toast('只能是 1 到 10');
          return;
        }
        await adminCall(
          'api_admin_unlock',
          { p_name: u.name, p_planets: p },
          res => '已解锁到第 ' + (res.planets || p) + ' 颗' + (res.noop ? '（本来就是这么多）' : '')
        );
      });

      acts.append(bGrant, bUnlock);

      // 清零 / 判假 / 改权限 / 删号 都属于「减少」，只给作者
      if (!isSelf && role === 'author') {
        const bOk = document.createElement('button');
        bOk.className = 'ghost tiny';
        bOk.textContent = '判真';
        bOk.addEventListener('click', () =>
          adminCall('api_admin_judge', { p_name: u.name, p_verdict: 'ok' }, '已判为真')
        );

        const bBad = document.createElement('button');
        bBad.className = 'ghost tiny';
        bBad.textContent = '判假';
        bBad.addEventListener('click', () =>
          adminCall('api_admin_judge', { p_name: u.name, p_verdict: 'cheat' }, '已判假，掉榜')
        );

        const bZero = document.createElement('button');
        bZero.className = 'ghost tiny';
        bZero.textContent = '清零';
        bZero.addEventListener('click', async () => {
          if (!window.confirm('把「' + u.name + '」的分数、点击、星球全清零？账号还在。')) return;
          await adminCall('api_admin_reset_user', { p_name: u.name }, '已清零 ' + u.name);
        });

        // 权限三档：普通 / 管理员 / 作者。只有作者能授作者、能改管理员。
        const roleBox = document.createElement('span');
        roleBox.className = 'role-box';
        [
          ['user', '普通'],
          ['admin', '管理'],
          ['author', '作者']
        ].forEach(pair => {
          const target = pair[0];
          const b = document.createElement('button');
          b.className = 'ghost tiny' + (u.role === target ? ' on' : '');
          b.textContent = pair[1];
          b.disabled =
            u.role === target ||
            (role !== 'author' &&
              (target === 'author' || u.role === 'admin' || u.role === 'author'));
          b.title = b.disabled && u.role !== target ? '只有作者能调整管理员/作者的权限' : '';
          b.addEventListener('click', async () => {
            const tip =
              target === 'author'
                ? '设为作者？作者拥有最高权限，连管理员都能管。'
                : target === 'admin'
                  ? '设为管理员？他能进后台、删号、给别人权限。'
                  : '降为普通用户？';
            if (!window.confirm('把「' + u.name + '」' + tip)) return;
            await adminCall(
              'api_admin_role',
              { p_name: u.name, p_role: target },
              target === 'author'
                ? '已设为作者'
                : target === 'admin'
                  ? '已设为管理员'
                  : '已降为普通'
            );
          });
          roleBox.appendChild(b);
        });

        const bDel = document.createElement('button');
        bDel.className = 'ghost tiny danger';
        bDel.textContent = '删号';
        bDel.addEventListener('click', async () => {
          if (!window.confirm('彻底删除「' + u.name + '」？账号、分数、登录都会删掉，不能恢复。'))
            return;
          if (!window.confirm('再确认一次：删掉「' + u.name + '」，确定？')) return;
          await adminCall('api_admin_delete', { p_name: u.name }, '已删除 ' + u.name);
        });

        acts.append(bOk, bBad, bZero, roleBox, bDel);
      }
      row.appendChild(acts);
      box.appendChild(row);
    });
  }

  async function adminCall(fn, body, okTip) {
    try {
      const res = await rpc(fn, Object.assign({ p_token: tok() }, body));
      if (!res || !res.ok) {
        toast((res && res.reason) || '操作失败');
        return;
      }
      // okTip 既可以是一句话，也可以是「用返回结果拼提示」的函数（解锁星球要用真实的第几颗）
      toast(typeof okTip === 'function' ? okTip(res) : okTip || '好了');
      loadAdmin();
      loadBoard();
    } catch (e) {
      toast('连不上服务器');
    }
  }

  /* ========== 6. 自动上传：登录后每 3 秒整份上传一次 ========== */
  // 之前 tick() 写好了却没人调用，自动上传其实一次都没跑过——
  // 这里必须真的把它挂到定时器上，否则所有进度只能靠手动点上传。
  const AUTO_EVERY = 3000;
  let lastSentKey = ''; // 上次成功上传的存档内容；一模一样就不重复传，省流量也省服务器

  function tick() {
    const st = S();
    if (!st || !ready() || !tok() || !cloudOn || syncLock) return;
    const now = Date.now();
    if (now - tickAt < AUTO_EVERY) return;
    let key = '';
    try {
      key = JSON.stringify(window.DD && window.DD.exportData ? window.DD.exportData() : st);
    } catch (e) {
      key = '';
    }
    if (key && key === lastSentKey) return;
    tickAt = now;
    const sent = key;
    pushSave('auto').then(ok => {
      if (ok) lastSentKey = sent;
    });
  }

  function flush() {
    const st = S();
    if (!st || !ready() || !tok() || !cloudOn || syncLock) return;
    try {
      fetch(CFG.url.replace(/\/+$/, '') + '/rest/v1/rpc/api_save', {
        method: 'POST',
        keepalive: true,
        headers: hdr(),
        body: JSON.stringify({
          p_token: tok(),
          p_save: window.DD && window.DD.exportData ? window.DD.exportData() : st
        })
      });
    } catch (e) {}
  }

  /* ========== 7. 启动 ========== */
  async function boot() {
    buildUI();

    document.querySelectorAll('.tab').forEach(t => {
      if (t.dataset.tab === 'leader') {
        t.addEventListener('click', () => {
          loadBoard();
          if (isStaff()) loadAdmin();
        });
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        flush();
        return;
      } // 切走 / 锁屏：先把最新进度推上去
      if (!cloudOn)
        recheck(); // 回到页面时如果还在离线，再探测一次
      else if (tok()) tick(); // 回到页面立刻补一次，不等节流
    });
    window.addEventListener('pagehide', flush); // 关页面 / 被系统杀掉前的最后兜底
    setInterval(tick, 1000); // 自动上传心跳：tick 内部再按 AUTO_EVERY 节流
    window.addEventListener('online', () => {
      if (!cloudOn) recheck();
      else if (tok()) loadBoard();
    });

    if (!ready()) return; // 还没填地址，buildUI 已经提示了
    // 先把登录门画出来再探测，别让人对着空页面等网络
    if (!tok()) {
      showAuth();
      updateGate(false);
    }
    status('正在连接云端…', 'busy');
    const good = await probe(PROBE_TIMEOUT);
    if (!good) {
      enterOffline();
      return;
    }
    cloudOn = true;
    if (tok()) {
      showMe();
      status('云端已连接', 'ok');
      resume();
      updateGate(true);
    } else {
      showAuth();
      updateGate(false);
      status('先登录或注册，才能开始玩', 'idle');
    }
    loadBoard();
  }

  window.Cloud = {
    sync: () => sync('manual'),
    push: () => pushSave('manual'),
    pull: () => pullSave(),
    gate: v => updateGate(v),
    offline: () => offlinePlay(),
    reset: async () => {
      try {
        localStorage.setItem(RESET_FLAG, '1');
      } catch (e) {}
      lastSentKey = ''; // 重置后内容变了，别被「没变化」拦住
      return clearCloud();
    },
    board: () => loadBoard(true),
    admin: () => loadAdmin(),
    get ready() {
      return ready();
    },
    get logged() {
      return !!tok();
    },
    name: () => myName() || '',
    role: () => role
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
