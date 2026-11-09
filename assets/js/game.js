/* =========================================================
   game.js · 《森林手记 · 四季之心》状态机
   28 天日程 / 分支事件 / 送礼邀约 / 季末小游戏 / 结局 / 存档
   ========================================================= */
(function () {
  "use strict";

  var F = window.Forest, D = window.ForestData, Art = window.ForestArt, MG = window.ForestMiniGames;
  var util = F.util, esc = util.esc, clamp = util.clamp;
  function $(id) { return document.getElementById(id); }

  var state = null, meta = null, selectedRole = "bunny";
  var overlay = $("overlay"), card = $("overlayCard");
  var overlayLocked = false, overlayOnClose = null, miniHandle = null;
  var toastTimer = null;
  var currentEvent = null, eventDone = null, eventFromDay = false, pendingDiary = null, newMemoryId = null;
  var trialCtx = null, lastEnding = null;

  var ACTION_LINES = {
    walk: "沿着溪水走了一圈，果然又「顺路」遇见了{{T}}。",
    forage: "摘了满满一篮浆果，最甜的那几颗被单独留了出来。",
    mushroom: "把蘑菇一排排铺在窗台上，阳光刚好。",
    wood: "拾了一捆柴，抱回来的时候手有点痒，心里却很踏实。",
    write: "写完了今天的手记，最后一行没忍住又提到 {{T}}。",
    chat: "串门聊到天色变软，其实也没聊什么要紧事。",
    rest: "煮了一壶水，什么都没做，也很好。",
    craft: "在工作台前慢条斯理地手作，小窝里飘着暖洋洋的甜香。",
    gift: "把礼物递过去的时候，假装自己一点也不紧张。",
    date: "今天，是只属于两个人的一页。"
  };

  /* ---------------- 基础工具 ---------------- */
  function isNewGameRequest() { return /(?:^|[?&])new=1(?:&|$)/.test(location.search); }
  function clearNewGameRequest() {
    try {
      if (location.protocol !== "file:" && window.history && history.replaceState) {
        history.replaceState(null, "", location.pathname + location.hash);
      }
    } catch (e) { /* file:// 下浏览器不允许改写地址，忽略即可 */ }
  }
  /* 未开局时（例如从开场界面打开玩法说明）用当前选中的视角兜底，避免 {{T}} 露在界面上 */
  function tpl(s) {
    var roleKey = (state && state.role) || selectedRole;
    var r = D.roles[roleKey] || D.roles.bunny;
    var res = String(s == null ? "" : s).replace(/\{\{T\}\}/g, r.target).replace(/\{\{M\}\}/g, r.me);
    if (roleKey === "fox") {
      res = res
        .replace(/蓬松的大尾巴/g, "大大的荷叶伞")
        .replace(/大尾巴/g, "长耳朵")
        .replace(/把蓬松的尾巴铺在椅子旁边，像一条暖和的毯子/g, "把晒干的软草铺在椅子旁边，像一条暖和的毯子")
        .replace(/尾巴铺在椅子边/g, "两只长耳朵耷在椅子边")
        .replace(/尾巴借你靠一会儿/g, "肩膀借你靠一会儿")
        .replace(/尾巴却轻轻晃了一下/g, "长耳朵却轻轻抖了一下")
        .replace(/尾巴尖却卷住了你的袖口/g, "小爪子却轻轻拉住了你的袖口")
        .replace(/尾巴张着保持平衡/g, "小爪子张着保持平衡")
        .replace(/尾巴一闪就不见了/g, "一蹦一跳很快就不见了")
        .replace(/尾巴扫到了门框/g, "长耳朵蹭到了门框")
        .replace(/尾巴却悄悄挡在你靠水的那一侧/g, "悄悄伸爪拉住你靠水的那一侧")
        .replace(/把\{\{T\}\}的尾巴染成金色/g, "把\{\{T\}\}的长耳朵染成金色")
        .replace(/尾巴却收得更拢、更暖了/g, "把身子缩得更拢、更暖了")
        .replace(/尾巴慢慢扫过雪面/g, "爪子在雪地上轻轻画着圆")
        .replace(/习惯性地张开尾巴/g, "习惯性地缩紧身子")
        .replace(/把花别在它尾巴上/g, "把花别在它耳朵上")
        .replace(/把尾巴放得离火远了一点/g, "往后退了半步，小心护着耳朵")
        .replace(/它自己把手插进尾巴里/g, "它自己把小爪子缩进毛茸茸的怀里")
        .replace(/把尾巴铺在你脚边/g, "把软垫悄悄推到你脚边")
        .replace(/直晃尾巴/g, "两只耳朵直竖")
        .replace(/用尾巴扇了好久的微风/g, "用大树叶扇了好久的微风")
        .replace(/我的尾巴不由自主地摆了快半个时辰/g, "我的耳朵不由自主地抖了快半个时辰");
    }
    return res;
  }
  function season() { return D.seasons[clamp(Math.floor((state.day - 1) / 7), 0, 3)]; }
  function role() { return D.roles[(state && state.role) || selectedRole] || D.roles.bunny; }

  function generateWeather(sId) {
    var pool = ["sunny", "breezy"];
    if (sId === "spring") pool = ["sunny", "sunny", "rainy", "breezy"];
    else if (sId === "summer") pool = ["sunny", "rainy", "starry", "sunny"];
    else if (sId === "autumn") pool = ["breezy", "breezy", "rainy", "sunny"];
    else if (sId === "winter") pool = ["snowy", "snowy", "starry", "sunny"];
    return util.pick(pool);
  }
  function currentWeather() {
    var wId = (state && state.weather) || "sunny";
    return (D.weathers || []).filter(function (w) { return w.id === wId; })[0] || {
      id: "sunny", name: "晴空暖阳", icon: "☀️", hint: "散步心情+2", desc: "温暖的晴天"
    };
  }

  function newState(roleKey) {
    var m = F.getMeta();
    var st = {
      v: 2, role: roleKey, day: 1, ap: 3,
      aff: 12, bond: 8, mood: 72, energy: 100,
      items: { berry: 2, mushroom: 1, wood: 0, flower: 0, stardust: 0, jam: 0, bbq_skewer: 0, flower_wreath: 0, star_bookmark: 0 },
      seenEvents: [], memories: [], tokens: [], diary: [], log: [],
      gifts: 0, dates: 0, crafts: 0, homeDecor: {},
      weather: "sunny",
      flags: {},
      ending: null, lastLine: "",
      updatedAt: Date.now()
    };
    if (m.quizPerfect) st.items.flower += 2;
    return st;
  }

  function normalize() {
    ["aff", "bond", "mood", "energy"].forEach(function (k) { state[k] = clamp(Number(state[k]) || 0, 0, 100); });
    state.ap = clamp(Number(state.ap) || 0, 0, 3);
    state.day = clamp(Number(state.day) || 1, 1, 28);
    if (!state.items) state.items = {};
    Object.keys(D.items).forEach(function (k) { state.items[k] = Math.max(0, Number(state.items[k]) || 0); });
    ["seenEvents", "memories", "tokens", "diary", "log"].forEach(function (k) { if (!Array.isArray(state[k])) state[k] = []; });
    if (!state.flags || typeof state.flags !== "object") state.flags = {};
    if (!state.homeDecor || typeof state.homeDecor !== "object") state.homeDecor = {};
    if (!state.role || !D.roles[state.role]) state.role = "bunny";
    if (typeof state.gifts !== "number") state.gifts = 0;
    if (typeof state.dates !== "number") state.dates = 0;
    if (typeof state.crafts !== "number") state.crafts = 0;
    if (!state.weather) state.weather = "sunny";
  }
  function save() { normalize(); state.updatedAt = Date.now(); F.storage.set(F.SAVE_KEY, state); }

  function applyGain(g) {
    var out = {};
    if (!g) return out;
    var mult = state.mood < 30 ? 0.7 : 1;
    ["aff", "bond", "mood", "energy"].forEach(function (k) {
      if (!g[k]) return;
      var d = Math.round(g[k] * mult);
      state[k] = clamp(state[k] + d, 0, 100);
      out[k] = d;
    });
    return out;
  }
  function mergeMap(target, src) {
    Object.keys(src || {}).forEach(function (k) { target[k] = (target[k] || 0) + src[k]; });
    return target;
  }
  function addItems(map) {
    Object.keys(map || {}).forEach(function (k) { state.items[k] = (state.items[k] || 0) + map[k]; });
  }
  function hasItems(map) {
    return Object.keys(map || {}).every(function (k) { return (state.items[k] || 0) >= map[k]; });
  }
  function consumeItems(map) {
    Object.keys(map || {}).forEach(function (k) { state.items[k] = Math.max(0, (state.items[k] || 0) - map[k]); });
  }
  function anyItems() { return Object.keys(D.items).some(function (k) { return (state.items[k] || 0) > 0; }); }
  function itemText(map) {
    return Object.keys(map || {}).map(function (k) {
      return D.items[k].icon + " " + D.items[k].name + " ×" + map[k];
    }).join("、");
  }
  function costText(map) {
    return Object.keys(map || {}).map(function (k) {
      return D.items[k].icon + D.items[k].name + " ×" + map[k];
    }).join(" + ");
  }
  function addMemory(id) {
    if (!D.memories[id] || state.memories.indexOf(id) >= 0) return false;
    state.memories.push(id);
    return true;
  }
  function gainChips(deltas, items) {
    var names = { aff: "♥ 心动", bond: "✦ 默契", mood: "☀ 心情", energy: "⚡ 体力" };
    var html = "";
    Object.keys(deltas || {}).forEach(function (k) {
      if (!deltas[k]) return;
      html += '<span class="gain-chip ' + (deltas[k] > 0 ? "plus" : "minus") + '">' +
        (deltas[k] > 0 ? "+" : "") + deltas[k] + " " + names[k] + "</span>";
    });
    Object.keys(items || {}).forEach(function (k) {
      html += '<span class="gain-chip plus">' + esc(D.items[k].icon + " " + D.items[k].name + " ×" + items[k]) + "</span>";
    });
    return html ? '<div class="gain-row">' + html + "</div>" : "";
  }
  function syncAchievements() {
    meta = F.getMeta();
    var list = meta.achievements.slice();
    D.achievements.forEach(function (a) {
      var ok = false;
      try { ok = a.test(state, meta); } catch (e) { ok = false; }
      if (ok && list.indexOf(a.id) < 0) list.push(a.id);
    });
    if (list.length !== meta.achievements.length) F.patchMeta({ achievements: list });
    meta = F.getMeta();
  }

  /* ---------------- 提示 / 弹层 ---------------- */
  function toast(msg, kind) {
    var el = $("toast");
    el.textContent = msg;
    el.className = "toast show" + (kind ? " " + kind : "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.className = "toast"; }, 2800);
  }
  function destroyMini() {
    if (miniHandle) { try { miniHandle.destroy(); } catch (e) {} miniHandle = null; }
  }
  function ovHead(eyebrow, title, sub, closeable) {
    return '<div class="ov-head"><div class="ov-head-text">' +
      '<span class="ov-eyebrow">' + esc(eyebrow) + "</span>" +
      '<div class="ov-title">' + esc(title) + "</div>" +
      (sub ? '<p class="ov-sub">' + esc(sub) + "</p>" : "") +
      "</div>" + (closeable === false ? "" : '<button class="ov-close" type="button" data-act="close" aria-label="关闭">✕</button>') +
      "</div>";
  }
  /* 弹层：锁定页面滚动 + 焦点移入并在弹层内循环 + 关闭后还原焦点 */
  var pageLocked = false, pageLockY = 0, lastFocus = null;

  function lockPage() {
    if (pageLocked) return;
    pageLocked = true;
    pageLockY = window.pageYOffset || document.documentElement.scrollTop || 0;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
  }
  function unlockPage() {
    if (!pageLocked) return;
    pageLocked = false;
    document.documentElement.style.overflow = "";
    document.body.style.overflow = "";
    // 页面开了 scroll-behavior: smooth，复原位置时必须瞬时跳回
    var prev = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = "auto";
    window.scrollTo(0, pageLockY);
    document.documentElement.style.scrollBehavior = prev;
  }
  function overlayFocusables() {
    return util.qsa("a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex='-1'])", card)
      .filter(function (el) { return el.getClientRects().length > 0; });
  }
  function focusIntoOverlay() {
    var target = overlayFocusables()[0] || card;
    try { target.focus({ preventScroll: true }); } catch (e) { try { target.focus(); } catch (e2) {} }
  }
  function restoreFocus() {
    var el = lastFocus;
    lastFocus = null;
    if (el && el.focus && document.contains(el)) {
      try { el.focus({ preventScroll: true }); } catch (e) {}
    }
  }
  function trapTab(e) {
    if (!overlay.classList.contains("show")) return;
    var list = overlayFocusables();
    if (!list.length) { e.preventDefault(); card.focus(); return; }
    var first = list[0], last = list[list.length - 1];
    var active = document.activeElement;
    var inside = active !== card && card.contains(active);
    if (e.shiftKey) {
      if (!inside || active === first) { e.preventDefault(); last.focus(); }
    } else if (!inside || active === last) {
      e.preventDefault(); first.focus();
    }
  }
  function openOverlay(html, opts) {
    opts = opts || {};
    destroyMini();
    if (!pageLocked) { lastFocus = document.activeElement; lockPage(); }
    card.className = "overlay-card" + (opts.wide ? " wide" : "");
    card.innerHTML = html;
    var titleEl = card.querySelector(".ov-title") || card.querySelector("h2") || card.querySelector("h3");
    if (titleEl) card.setAttribute("aria-label", titleEl.textContent.trim());
    else card.removeAttribute("aria-label");
    overlayLocked = !!opts.locked;
    overlayOnClose = opts.onClose || null;
    overlay.classList.add("show");
    overlay.setAttribute("aria-hidden", "false");
    card.scrollTop = 0;
    focusIntoOverlay();
  }
  function closeOverlay(force) {
    if (overlayLocked && !force) return;
    destroyMini();
    overlay.classList.remove("show");
    overlay.setAttribute("aria-hidden", "true");
    card.innerHTML = "";
    overlayLocked = false;
    var cb = overlayOnClose;
    overlayOnClose = null;
    if (cb) cb();
    // 回调可能立刻重新打开弹层（回忆册 → 结局页），这时不要解锁
    if (!overlay.classList.contains("show")) { unlockPage(); restoreFocus(); }
  }

  /* ---------------- 空状态 ---------------- */
  function renderEmpty() {
    $("hud").innerHTML = '<div class="hud-top"><span class="season-chip"><span class="sc-icon">🌱</span>森林手记</span>' +
      '<span class="hud-day">手记还没开始</span><span class="hud-poem">第一页，等你来写。</span></div>';
    var sc = $("sceneCard");
    sc.className = "scene-card";
    sc.style.setProperty("--season-sky", "linear-gradient(180deg,#dceff5,#fdf7ee)");
    sc.innerHTML = '<div class="scene-decor"></div><div class="scene-caption">序 · 空白的一页</div>' +
      '<div class="scene-chars" style="align-items:center;justify-content:center;flex:1">' +
      '<div class="scene-char">' + Art.bunny("normal") + "</div>" +
      '<div class="scene-heart">' + Art.heart(36) + "</div>" +
      '<div class="scene-char">' + Art.fox("normal") + "</div></div>" +
      '<div class="scene-dialogue"><span class="dlg-name">森林手记</span><p class="dlg-text">从初春到冬末，一共二十八天。要开始写吗？</p></div>';
    $("diaryCard").innerHTML = '<div class="diary-head"><h3>今日手记</h3><span>—</span></div>' +
      '<p class="diary-empty">还没有记录。等第一格行动落下，这里就会有字了。</p>';
    $("actionGrid").innerHTML = '<p style="grid-column:1/-1;color:var(--text-soft);font-size:.86rem">开始游戏后，这里会出现今天可以安排的事情。</p>';
    $("actionsHint").textContent = "四季、二十八天、每天三格行动力。";
    $("dayFooter").innerHTML = '<span class="df-note">进度会自动保存在这台设备上。</span>' +
      '<div class="df-btns"><button class="btn btn-primary" type="button" data-act="start">翻开第一页 →</button></div>';
    $("mobileBar").innerHTML = '<div class="mb-info"><b>手记还没开始</b><br>四季 · 28 天</div>' +
      '<button class="btn btn-primary" type="button" data-act="start">开始 →</button>';
  }

  /* ---------------- 渲染：HUD ---------------- */
  function renderHUD() {
    var s = season();
    var dots = "";
    for (var i = 0; i < 3; i++) dots += '<span class="ap-dot' + (i < state.ap ? "" : " used") + '"></span>';
    var stats = [
      ["aff", "♥ 心动", state.aff], ["bond", "✦ 默契", state.bond],
      ["mood", "☀ 心情", state.mood], ["energy", "⚡ 体力", state.energy]
    ];
    var statHtml = stats.map(function (t) {
      return '<div class="stat ' + t[0] + '"><div class="stat-top"><span class="stat-name">' + t[1] +
        '</span><span class="stat-val">' + t[2] + "</span></div>" +
        '<div class="stat-bar"><div class="stat-fill" style="width:' + t[2] + '%"></div></div></div>';
    }).join("");
    var itemsHtml = Object.keys(D.items).map(function (k) {
      var it = D.items[k], n = state.items[k] || 0;
      return '<span class="item-chip' + (n ? "" : " empty") + '">' + it.icon + " " + it.name + " <b>" + n + "</b></span>";
    }).join("");

    var w = currentWeather();
    var talentTag = state.role === "fox"
      ? '<span class="talent-chip" title="小狐狸天赋：步伐轻快，行动耗体降低3点，串门自带心动+1">🦊 旅人天赋</span>'
      : '<span class="talent-chip" title="小兔子天赋：嗅觉敏锐，采集浆果/晒蘑菇有35%几率额外丰收">🐰 嗅觉天赋</span>';
    var weatherChip = '<span class="weather-chip" title="' + esc(w.desc) + '"><span class="w-icon">' + w.icon + '</span> ' + esc(w.name) + '<small class="w-hint">(' + esc(w.hint) + ')</small></span>';

    $("hud").innerHTML =
      '<div class="hud-top">' +
        '<span class="season-chip"><span class="sc-icon">' + s.icon + "</span>" + esc(s.title) + " · " + esc(s.subtitle) + "</span>" +
        weatherChip +
        talentTag +
        '<span class="hud-day">第 ' + state.day + ' 天 <small>/ 28</small></span>' +
        '<div class="ap-box">今日 ' + dots + " " + state.ap + " 格</div>" +
        '<span class="hud-poem">' + esc(s.poem) + "</span>" +
      "</div>" +
      '<div class="hud-stats">' + statHtml + "</div>" +
      '<div class="hud-items">' + itemsHtml + "</div>";
  }

  /* ---------------- 表情 ----------------
     玩家角色反映自己的心情与体力，对方反映关系进展；
     体力见底时一起打盹，让 sleep 状态也真正出现在故事里。 */
  function selfMood() {
    if (state.energy < 35) return "sleep";
    if (state.aff >= 78 && state.mood >= 60) return "love";
    if (state.mood >= 60) return "happy";
    if (state.mood < 38) return "shy";
    return "normal";
  }
  function targetMood() {
    if (state.energy < 35) return "sleep";
    if (state.aff >= 78) return "love";
    if (state.aff >= 46) return "happy";
    if (state.aff >= 24) return "shy";
    return "normal";
  }

  /* ---------------- 渲染：场景 ---------------- */
  function renderScene() {
    var s = season(), r = role();
    var line = state.lastLine || tpl(D.idleLines[(state.day - 1) % D.idleLines.length]);
    var sc = $("sceneCard");
    sc.className = "scene-card season-" + s.id;
    sc.style.setProperty("--season-sky", s.sky);
    var decorHtml = "";
    if (state.homeDecor && Object.keys(state.homeDecor).length > 0) {
      var decorItems = "";
      Object.keys(state.homeDecor).forEach(function (k) {
        if (state.homeDecor[k] && Art.decor) {
          decorItems += '<div class="home-decor-item" title="小窝装点">' + Art.decor(k, 34) + '</div>';
        }
      });
      if (decorItems) {
        decorHtml = '<div class="home-decor-shelf"><span class="hds-label">🏡 森林小窝</span>' + decorItems + '</div>';
      }
    }

    sc.innerHTML =
      '<div class="scene-decor">' + Art.scene(s.id) + "</div>" +
      decorHtml +
      '<div class="scene-caption">' + esc(s.title) + " · 第 " + state.day + " 天</div>" +
      '<div class="scene-chars">' +
        '<div class="scene-char me">' + Art.get(r.art, selfMood()) + "</div>" +
        '<div class="scene-heart">' + Art.heart(38) + "</div>" +
        '<div class="scene-char target">' + Art.get(r.targetArt, targetMood()) + "</div>" +
      "</div>" +
      '<div class="scene-dialogue"><span class="dlg-name">今日手记 · ' + esc(r.me) + "</span>" +
        '<p class="dlg-text">' + esc(tpl(line)) + "</p></div>";
  }

  /* ---------------- 渲染：手记侧栏 ---------------- */
  function renderDiary() {
    var list = "";
    state.log.slice(-4).forEach(function (t) {
      list += '<li class="diary-item"><span class="di-icon">✎</span><span>' + esc(t) + "</span></li>";
    });
    state.diary.slice(-2).reverse().forEach(function (d) {
      list += '<li class="diary-item"><span class="di-icon">' + esc(d.icon) + '</span><span><span class="di-day">第 ' +
        d.day + " 天</span>" + esc(d.text) + "</span></li>";
    });
    if (!list) list = '<li class="diary-empty">今天还是空白的一页。选一件事做吧，哪怕只是去溪边走走。</li>';

    var m = F.getMeta();
    var secretHtml = "";
    if (m.endings && m.endings.length > 0 && state.lastSecretThought) {
      secretHtml = '<div class="secret-thought-box">' +
        '<span class="st-tag">✨ 二周目 · TA的秘密心声</span>' +
        '<p class="st-text">' + esc(tpl(state.lastSecretThought)) + '</p>' +
        '</div>';
    }

    $("diaryCard").innerHTML =
      '<div class="diary-head"><h3>今日手记</h3><span>第 ' + state.day + " 天</span></div>" +
      '<ul class="diary-list">' + list + "</ul>" +
      secretHtml +
      '<div class="diary-summary">已写下 <b>' + state.diary.length + "</b> 页 · 收集 <b>" + state.memories.length +
        "</b> 张回忆 · 季节信物 <b>" + state.tokens.length + " / 4</b></div>" +
      '<div class="diary-foot">' +
        '<button class="btn btn-sm" type="button" data-act="album">📖 回忆册</button>' +
        '<button class="btn btn-sm" type="button" data-act="help">❔ 玩法</button>' +
      "</div>";
  }

  /* ---------------- 渲染：行动卡 ---------------- */
  /* 每季只有一场专属邀约：该季的邀约事件读过之后就不再可选 */
  function seasonDateUsed(seasonId) {
    var pool = D.dates.filter(function (d) { return d.season === seasonId; });
    return pool.length > 0 && pool.every(function (d) { return state.seenEvents.indexOf(d.id) >= 0; });
  }
  function actionStatus(a, s) {
    if (state.ending) return { ok: false, why: "这一本已经写完啦" };
    if (a.special === "date") {
      var cost = D.dateCost[s.id] || {};
      if (seasonDateUsed(s.id)) return { ok: false, why: "这一季已经约过啦" };
      if (!hasItems(cost)) return { ok: false, why: "需要 " + costText(cost) };
    }
    if (a.special === "craft") {
      var canAny = (D.recipes || []).some(function (rc) { return hasItems(rc.materials); });
      if (!canAny) return { ok: false, why: "手作材料还不够" };
    }
    if (state.ap < a.ap) return { ok: false, why: "行动点不够" };
    var energyCost = a.energy;
    if (state.role === "fox" && energyCost) energyCost = Math.max(4, energyCost - 3);
    if (state.weather === "rainy" && a.id === "walk") energyCost += 2;
    if (energyCost && state.energy < energyCost) return { ok: false, why: "体力不够，先歇一会儿" };
    if (a.special === "gift" && !anyItems()) return { ok: false, why: "背包空空的" };
    return { ok: true, why: "" };
  }
  function renderActions() {
    var s = season();
    $("actionsHint").textContent = state.mood < 30
      ? "心情有点低，今天的好感收益会打七折 —— 不妨先歇一会儿。"
      : "每格行动都会写进手记，随时可以合上这一页。";

    $("actionGrid").innerHTML = D.actions.map(function (a) {
      var st = actionStatus(a, s);
      var actualEnergy = a.energy;
      if (state.role === "fox" && actualEnergy) actualEnergy = Math.max(4, actualEnergy - 3);
      if (state.weather === "rainy" && a.id === "walk") actualEnergy += 2;
      var cost = a.ap + " AP" + (actualEnergy ? " · " + actualEnergy + " 体力" : "");
      if (a.special === "date") cost += " · " + costText(D.dateCost[s.id] || {});
      var bonus = a.bonus && a.bonus.season === s.id;
      return '<button class="action-card" type="button" data-act="do-action" data-id="' + a.id + '"' +
        (st.ok ? "" : " disabled") + ">" +
        '<div class="ac-top"><span class="ac-icon">' + a.icon + '</span><span class="ac-ap">' + a.ap + " AP</span></div>" +
        '<div class="ac-name">' + esc(a.name) + (bonus ? '<span class="ac-flag-inline">当季加成</span>' : "") + "</div>" +
        '<div class="ac-desc">' + esc(tpl(a.desc)) + (st.ok ? "" : '<br><b style="color:var(--bad)">' + esc(st.why) + "</b>") + "</div>" +
        '<div class="ac-cost">' + esc(cost) + "</div>" +
      "</button>";
    }).join("");
  }

  /* ---------------- 渲染：收尾 ---------------- */
  function renderFooter() {
    if (state.ending) {
      $("dayFooter").innerHTML = '<span class="df-note">这一本手记已经写到最后一页。</span>' +
        '<div class="df-btns"><button class="btn" type="button" data-act="ending-album">📖 看看回忆册</button>' +
        '<button class="btn btn-primary" type="button" data-act="ending-restart">再写一本 →</button></div>';
      $("mobileBar").innerHTML = '<div class="mb-info"><b>手记已写完</b><br>' + esc(lastEnding ? lastEnding.title : "结局") + "</div>" +
        '<button class="btn btn-primary" type="button" data-act="ending-restart">再写一本 →</button>';
      return;
    }
    $("dayFooter").innerHTML = '<span class="df-note">还剩 ' + state.ap + " 格行动力 · 第 " + state.day + " / 28 天</span>" +
      '<div class="df-btns"><button class="btn" type="button" data-act="album">📖 回忆册</button>' +
      '<button class="btn btn-primary" type="button" data-act="endday">合上今天 · 进入下一天 →</button></div>';
    $("mobileBar").innerHTML = '<div class="mb-info">第 ' + state.day + ' 天 · <b>' + state.ap + ' 格</b>可用<br>♥ ' +
      state.aff + " · ✦ " + state.bond + "</div>" +
      '<button class="btn btn-primary" type="button" data-act="endday">合上今天 →</button>';
  }
  function render() {
    if (!state) { renderEmpty(); return; }
    normalize();
    renderHUD(); renderScene(); renderDiary(); renderActions(); renderFooter();
  }

  /* ---------------- 开场 ---------------- */
  function showStart() {
    var save = F.getSave(F.SAVE_KEY);
    var alive = !!(save && save.v === 2 && !save.ending);
    var rolesHtml = Object.keys(D.roles).map(function (k) {
      var r = D.roles[k];
      return '<button class="role-card' + (k === selectedRole ? " is-active" : "") + '" type="button" data-act="role" data-role="' + k + '">' +
        '<div class="rc-icon">' + r.icon + '</div><div class="rc-name">扮演 ' + esc(r.me) + "</div>" +
        '<div class="rc-desc">和' + esc(r.target) + "写一本手记<br>" + esc(r.desc) + "</div></button>";
    }).join("");
    var warn = isNewGameRequest() && alive
      ? '<p class="ov-note" style="color:var(--bad)">开始新的一本会覆盖第 ' + Number(save.day) +
        " 天的进度；回忆册、成就与已解锁的结局会保留。</p>"
      : "";
    var html =
      '<div class="start-hero"><div class="sh-mark">🌳</div><h2>森林手记 · 四季之心</h2>' +
      '<p>从初春到冬末，二十八天，每天三格行动力。把「最要好的朋友」，慢慢写成别的什么。</p></div>' +
      '<div class="role-grid">' + rolesHtml + "</div>" +
      warn +
      '<div class="ov-actions">' +
        '<button class="btn btn-primary btn-block" type="button" data-act="new">开始写第一页 →</button>' +
        (alive ? '<button class="btn btn-block" type="button" data-act="continue">继续第 ' + Number(save.day) + " 天</button>" : "") +
        '<button class="btn btn-ghost btn-block" type="button" data-act="help-start">先看看玩法</button>' +
        '<a class="btn btn-ghost btn-block" href="index.html">先不写，回首页</a>' +
      "</div>" +
      '<p class="ov-note">进度自动保存在本机 · 昼夜主题与音效在右上角切换 · 电脑和手机都能玩</p>';
    openOverlay(html, { locked: true });
  }
  function startNew(roleKey) {
    state = newState(roleKey);
    meta = F.getMeta();
    clearNewGameRequest();
    save(); syncAchievements(); render();
    closeOverlay(true);
    F.audio.sfx("page");
    toast(meta.quizPerfect ? "🌼 默契小考全对：开局获赠野花 ×2" : "第一页，写好了。", "good");
  }
  function continueGame() {
    var saved = F.getSave(F.SAVE_KEY);
    if (!saved || saved.v !== 2) { showStart(); return; }
    state = saved; meta = F.getMeta(); normalize(); save(); render();
    closeOverlay(true);
    toast("欢迎回来 · 第 " + state.day + " 天", "good");
  }

  /* ---------------- 行动 ---------------- */
  function doAction(id) {
    if (!state || state.ending) return;
    var a = D.actions.filter(function (x) { return x.id === id; })[0];
    if (!a) return;
    var s = season(), st = actionStatus(a, s);
    if (!st.ok) { toast(st.why, "warn"); F.audio.sfx("bad"); return; }

    if (a.special === "gift") { openGift(); return; }
    if (a.special === "craft") { openCraft(); return; }
    if (a.special === "date") { startDate(a, s); return; }

    state.ap -= a.ap;
    var actualEnergy = a.energy;
    if (state.role === "fox" && actualEnergy) actualEnergy = Math.max(4, actualEnergy - 3);
    if (state.weather === "rainy" && id === "walk") actualEnergy += 2;
    if (actualEnergy) state.energy = clamp(state.energy - actualEnergy, 0, 100);

    var baseGain = {};
    if (a.gain) { Object.keys(a.gain).forEach(function (k) { baseGain[k] = a.gain[k]; }); }
    // 天气加成
    if (state.weather === "sunny" && id === "walk") baseGain.mood = (baseGain.mood || 0) + 2;
    if (state.weather === "rainy" && id === "chat") baseGain.aff = (baseGain.aff || 0) + 2;
    if (state.weather === "snowy" && id === "rest") baseGain.energy = (baseGain.energy || 0) + 15;
    // 小狐狸天赋：聊天心动+1
    if (state.role === "fox" && id === "chat") baseGain.aff = (baseGain.aff || 0) + 1;
    applyGain(baseGain);

    var gained = {};
    if (a.items) { addItems(a.items); mergeMap(gained, a.items); }
    if (a.bonus && a.bonus.season === s.id && a.bonus.items) {
      addItems(a.bonus.items); mergeMap(gained, a.bonus.items);
    }
    var notes = [];
    if (a.bonus && a.bonus.season === s.id) notes.push(s.name + "季加成，收获更多！");

    // 小兔子天赋：敏锐嗅觉
    if (state.role === "bunny" && (id === "forage" || id === "mushroom") && Math.random() < 0.35) {
      var bonusItem = id === "forage" ? { berry: 1 } : { mushroom: 1 };
      addItems(bonusItem); mergeMap(gained, bonusItem);
      notes.push("🐰 小兔子敏锐嗅觉触发：额外丰收！");
    }
    // 天气微风加成
    if (state.weather === "breezy" && (id === "forage" || id === "wood" || id === "mushroom") && Math.random() < 0.3) {
      var breezeItem = id === "forage" ? { berry: 1 } : (id === "mushroom" ? { mushroom: 1 } : { wood: 1 });
      addItems(breezeItem); mergeMap(gained, breezeItem);
      notes.push("🍃 森林微风拂过：顺手多捡了一份！");
    }

    if (a.chance) handleChance(a.chance, s, gained, notes);

    var line = tpl(ACTION_LINES[id] || "今天也好好过了一天。");
    state.lastLine = line;
    state.log.push(line);
    if (state.log.length > 12) state.log = state.log.slice(-12);

    // 二周目：提取 TA 的隐秘心声
    var metaCheck = F.getMeta();
    if (metaCheck.endings && metaCheck.endings.length > 0 && D.secretThoughts && D.secretThoughts[id]) {
      state.lastSecretThought = util.pick(D.secretThoughts[id]);
    }

    syncAchievements(); save(); render();
    F.audio.sfx("good");
    if (Object.keys(gained).length) notes.push("收获 " + itemText(gained));
    if (state.ap === 0) notes.push("今天的三格用完了");
    if (notes.length) toast(notes.join(" · "), "good");
  }
  function handleChance(kind, s, gained, notes) {
    if (kind === "flower") {
      var p = s.id === "spring" ? 0.6 : 0.2;
      if (Math.random() < p) { addItems({ flower: 1 }); mergeMap(gained, { flower: 1 }); }
    } else if (kind === "stardust") {
      var q = s.id === "winter" ? 0.45 : 0.12;
      if (state.weather === "starry") q *= 2;
      if (Math.random() < q) { addItems({ stardust: 1 }); mergeMap(gained, { stardust: 1 }); }
    } else if (kind === "encounter") {
      if (Math.random() < 0.42) {
        var en = util.pick(D.encounters);
        applyGain(en.gain);
        var txt = tpl(en.text);
        state.log.push(txt);
        notes.push(txt);
      }
    }
  }


  /* ---------------- 小窝手作 ---------------- */
  function openCraft() {
    var recipes = D.recipes || [];
    var grid = recipes.map(function (rc) {
      var canMake = hasItems(rc.materials);
      var matsText = Object.keys(rc.materials).map(function (k) {
        var needed = rc.materials[k], have = (state.items && state.items[k]) || 0;
        var ok = have >= needed;
        return '<span class="mat-badge' + (ok ? ' ok' : ' lack') + '">' +
          D.items[k].icon + ' ' + D.items[k].name + ' ' + have + '/' + needed + '</span>';
      }).join(' ');

      return '<div class="craft-card' + (canMake ? '' : ' locked') + '">' +
        '<div class="cc-top">' +
          '<span class="cc-icon">' + rc.icon + '</span>' +
          '<div><div class="cc-name">' + esc(rc.name) + '</div><div class="cc-desc">' + esc(rc.desc) + '</div></div>' +
        '</div>' +
        '<div class="cc-mats">需要素材：' + matsText + '</div>' +
        '<div class="cc-decor">🏡 解锁小窝装点：<b>' + esc(rc.decorName) + '</b></div>' +
        '<div class="cc-foot">' +
          '<button class="btn btn-sm btn-primary" type="button" data-act="make-craft" data-id="' + rc.id + '"' +
          (canMake ? '' : ' disabled') + '>制作并装点</button>' +
        '</div>' +
      '</div>';
    }).join('');

    var html = ovHead("小窝手作", "森林手作工作台") +
      '<p class="ov-sub">慢熬果酱、烤制蘑菇、编制花环或引纳星光。制作不仅可作为高级心意送礼，还能给小窝添上温暖装饰！消耗 1 AP。</p>' +
      '<div class="craft-grid">' + grid + '</div>' +
      '<div class="ov-actions"><button class="btn" type="button" data-act="close">合上手作台</button></div>';
    openOverlay(html, { wide: true });
  }

  function doCraft(recipeId) {
    if (!state || state.ap < 1) return;
    var rc = (D.recipes || []).filter(function (r) { return r.id === recipeId; })[0];
    if (!rc || !hasItems(rc.materials)) {
      toast("所需材料不足", "warn");
      F.audio.sfx("bad");
      return;
    }
    consumeItems(rc.materials);
    state.items[rc.product] = (state.items[rc.product] || 0) + 1;
    state.ap -= 1;
    var craftEnergy = 8;
    if (state.role === "fox") craftEnergy = Math.max(4, craftEnergy - 3);
    state.energy = clamp(state.energy - craftEnergy, 0, 100);
    state.crafts = (state.crafts || 0) + 1;
    if (!state.homeDecor) state.homeDecor = {};
    state.homeDecor[rc.decor] = true;

    var deltas = applyGain({ aff: 5, bond: 6, mood: 8 });
    var line = "制作了" + rc.name + "，小窝里摆上了" + rc.decorName + "。";
    state.lastLine = line;
    state.log.push(line);

    var metaCheck = F.getMeta();
    if (metaCheck.endings && metaCheck.endings.length > 0 && D.secretThoughts && D.secretThoughts.craft) {
      state.lastSecretThought = util.pick(D.secretThoughts.craft);
    }

    syncAchievements(); save(); render();
    F.audio.sfx("win");

    var html = ovHead("手作完成 · " + rc.name, "🏡 小窝添了新装扮！", null, false) +
      '<div class="craft-success-view">' +
        '<div class="cs-icon">' + rc.icon + '</div>' +
        '<p class="cs-desc">' + esc(rc.desc) + '</p>' +
        '<div class="cs-decor-preview">' + (Art.decor ? Art.decor(rc.decor, 56) : '') +
          '<div><b>' + esc(rc.decorName) + '</b><br><small style="color:var(--text-soft)">已悬挂摆放在树洞小窝中</small></div>' +
        '</div>' +
        gainChips(deltas, {}) +
      '</div>' +
      '<div class="ov-actions"><button class="btn btn-primary" type="button" data-act="close">真棒，收好！</button></div>';
    openOverlay(html);
  }

  /* ---------------- 送礼 ---------------- */
  function openGift() {
    var grid = Object.keys(D.items).map(function (k) {
      var it = D.items[k], n = state.items[k] || 0;
      var tag = n > 0 ? "button" : "div";
      var act = n > 0 ? ' data-act="gift" data-item="' + k + '"' : "";
      return "<" + tag + ' class="gift-card"' + act + (n > 0 ? ' type="button"' : ' style="opacity:.42"') + ">" +
        '<div class="g-icon">' + it.icon + '</div><div class="g-name">' + esc(it.name) + "</div>" +
        '<div class="g-count">持有 ' + n + '</div><div class="g-love">♥ +' + it.love + "</div></" + tag + ">";
    }).join("");
    var html = ovHead("送一份礼", "挑一样 " + role().target + " 会喜欢的") +
      '<p class="ov-sub">每份礼物消耗 1 格行动力。喜好不同，回应也不同。</p>' +
      '<div class="gift-grid">' + grid + "</div>" +
      '<div class="ov-actions"><button class="btn" type="button" data-act="close">再想想</button></div>';
    openOverlay(html);
  }
  function giveGift(itemId) {
    var it = D.items[itemId];
    if (!it || !state || state.ap < 1 || (state.items[itemId] || 0) < 1) return;
    state.items[itemId]--;
    state.ap -= 1;
    state.gifts++;
    if (itemId === "berry") state.flags.sweetGift = true;
    var deltas = applyGain({ aff: it.love, mood: 2 });
    var line = "把" + it.name + "递给" + role().target + "，它盯了很久。";
    state.lastLine = line;
    state.log.push(line);
    syncAchievements(); save(); render();
    F.audio.sfx("good");

    var html = ovHead("心意送达", it.icon + " " + it.name, null, false) +
      '<div class="ev-result"><div class="ev-reply">' + esc(tpl(it.react)) + "</div>" +
      gainChips(deltas, {}) + "</div>" +
      '<div class="ov-actions"><button class="btn btn-primary" type="button" data-act="close">收好手记</button></div>';
    openOverlay(html);
  }

  /* ---------------- 邀约 ---------------- */
  function startDate(a, s) {
    var cost = D.dateCost[s.id] || {};
    consumeItems(cost);
    state.ap -= a.ap;
    var actualEnergy = a.energy;
    if (state.role === "fox" && actualEnergy) actualEnergy = Math.max(4, actualEnergy - 3);
    state.energy = clamp(state.energy - actualEnergy, 0, 100);
    state.dates++;
    var pool = D.dates.filter(function (d) { return d.season === s.id; });
    var unseen = pool.filter(function (d) { return state.seenEvents.indexOf(d.id) < 0; });
    var ev = unseen.length ? unseen[0] : util.pick(pool);
    var line = tpl(ACTION_LINES.date);
    state.lastLine = line;
    state.log.push(line);
    F.audio.sfx("page");
    showEvent(ev, function () { save(); render(); }, false);
  }

  /* ---------------- 分支事件 ---------------- */
  function resolveEvent(ev) {
    var e = {};
    Object.keys(ev).forEach(function (k) { e[k] = ev[k]; });
    if (ev.variants) e.lines = util.pick(ev.variants);
    return e;
  }
  function showEvent(ev, done, fromDay) {
    currentEvent = resolveEvent(ev);
    eventDone = done || null;
    eventFromDay = !!fromDay;
    newMemoryId = null;
    var s = season();
    var lines = currentEvent.lines.map(function (l) {
      var who = l.who === "{{T}}" ? role().target : l.who;
      var cls = l.who === "旁白" ? "narration" : (l.who === "你" ? "you" : "target");
      return '<div class="ev-line ' + cls + '">' +
        (l.who === "旁白" ? "" : '<span class="ev-who">' + esc(who) + "</span>") +
        esc(tpl(l.text)) + "</div>";
    }).join("");
    var choices = currentEvent.choices.map(function (c, i) {
      return '<button class="ev-choice" type="button" data-act="choice" data-i="' + i + '">' +
        String.fromCharCode(65 + i) + " · " + esc(tpl(c.text)) + "</button>";
    }).join("");
    var html = ovHead("今日一页 · " + s.title, currentEvent.title, null, false) +
      '<div class="ev-banner"><span class="ev-icon">' + esc(currentEvent.icon || s.icon) + "</span>" +
      '<div><div class="ov-eyebrow">' + esc(s.subtitle) + "</div>" +
      '<div style="font-size:.86rem">第 ' + state.day + " 天 · 傍晚</div></div></div>" +
      '<div class="ev-lines">' + lines + "</div>" +
      '<div class="ev-choices">' + choices + "</div>";
    openOverlay(html, { locked: true });
    F.audio.sfx("page");
  }
  function chooseOption(i) {
    if (!currentEvent) return;
    var c = currentEvent.choices[i];
    if (!c) return;
    var deltas = applyGain(c.gain);
    var items = c.items || {};
    addItems(items);
    newMemoryId = null;
    if (currentEvent.memory && addMemory(currentEvent.memory)) newMemoryId = currentEvent.memory;
    if (!currentEvent.repeatable && state.seenEvents.indexOf(currentEvent.id) < 0) {
      state.seenEvents.push(currentEvent.id);
    }
    var reply = tpl(c.reply);
    state.lastLine = reply;
    state.log.push(reply);
    if (state.log.length > 12) state.log = state.log.slice(-12);

    if (eventFromDay) {
      pendingDiary = {
        day: state.day, season: season().id,
        icon: currentEvent.icon || season().icon,
        text: currentEvent.title + " · " + c.text
      };
    }
    syncAchievements(); save(); render();
    F.audio.sfx("good");

    var memNote = newMemoryId && D.memories[newMemoryId]
      ? '<div class="memory-note"><span class="mn-icon">' + esc(D.memories[newMemoryId].icon) +
        '</span><span>新回忆卡：<b>' + esc(D.memories[newMemoryId].title) + "</b> 已收进手记</span></div>"
      : "";
    var html = ovHead("这一页写好了", currentEvent.title, null, false) +
      '<div class="ev-result"><div class="ev-reply">' + esc(reply) + "</div>" +
      gainChips(deltas, items) + memNote + "</div>" +
      '<div class="ov-actions"><button class="btn btn-primary" type="button" data-act="event-next">合上手记 →</button></div>';
    openOverlay(html, { locked: true });
  }
  function finishEvent() {
    var cb = eventDone;
    currentEvent = null; eventDone = null; eventFromDay = false;
    closeOverlay(true);
    if (cb) cb();
  }

  /* ---------------- 结束一天 ---------------- */
  function pickEvent() {
    var s = season();
    var pool = D.events.filter(function (e) {
      return e.season === s.id && !e.repeatable &&
        state.seenEvents.indexOf(e.id) < 0 &&
        state.day >= (e.dayMin || 1) && state.day <= (e.dayMax || 99) &&
        state.aff >= (e.minAff || 0);
    });
    var pinned = pool.filter(function (e) { return e.pinned && e.dayMin === state.day; });
    if (pinned.length) return pinned[0];
    var normal = pool.filter(function (e) { return !e.pinned; });
    if (normal.length) return util.pick(normal);
    var generic = D.events.filter(function (e) { return e.season === s.id && e.repeatable; });
    return util.pick(generic.length ? generic : D.events);
  }
  function endDay() {
    if (!state || state.ending) return;
    if (state.ap > 0) {
      var html = ovHead("合上今天", "还剩 " + state.ap + " 格行动力") +
        '<p class="ov-sub">没用完的行动力不会留到明天。确定现在就翻页吗？</p>' +
        '<div class="ov-actions"><button class="btn btn-primary" type="button" data-act="confirm-endday">合上手记 →</button>' +
        '<button class="btn" type="button" data-act="close">再安排一下</button></div>';
      openOverlay(html);
      return;
    }
    proceedEndDay();
  }
  function proceedEndDay() {
    closeOverlay(true);
    var ev = pickEvent();
    showEvent(ev, finishDay, true);
  }
  function finishDay() {
    if (pendingDiary) { state.diary.push(pendingDiary); pendingDiary = null; }
    if (state.diary.length > 60) state.diary = state.diary.slice(-60);
    save();
    if (state.day % 7 === 0) runTrial(season(), afterTrial);
    else afterTrial();
  }

  /* ---------------- 季末考验 ---------------- */
  function runTrial(s, cb) {
    var tr = D.trials[s.id];
    trialCtx = { s: s, tr: tr, cb: cb };
    var html = ovHead("季末考验 · " + s.title, tr.icon + " " + tr.title, null, false) +
      '<p class="ov-sub">' + esc(tpl(tr.intro)) + "</p>" +
      '<div class="ov-actions"><button class="btn btn-primary" type="button" data-act="trial-start">开始考验 →</button>' +
      '<button class="btn" type="button" data-act="trial-skip">这次先跳过</button></div>' +
      '<p class="ov-note">赢下考验可获得「' + esc(tr.token) + '」与额外心动、默契；没赢也能重试，不会卡住故事。</p>';
    openOverlay(html, { locked: true, wide: true });
  }
  function startTrialMini() {
    if (!trialCtx) return;
    var html = ovHead("季末考验", trialCtx.tr.icon + " " + trialCtx.tr.title, null, false) +
      '<div id="miniRoot"></div>';
    openOverlay(html, { locked: true, wide: true });
    var root = $("miniRoot");
    miniHandle = MG.start(root, trialCtx.tr.game, trialCtx.tr.config, function (res) {
      miniHandle = null;
      showTrialResult(res);
    });
  }
  function showTrialResult(res) {
    if (!trialCtx) return;
    var tr = trialCtx.tr, s = trialCtx.s;
    var deltas, items = {};
    if (res.win) {
      deltas = applyGain({ aff: 12, bond: 8, mood: 6 });
      items = { stardust: 1 };
      addItems(items);
      if (state.tokens.indexOf(s.id) < 0) state.tokens.push(s.id);
      addMemory("t_" + s.id);
      state.lastLine = tpl(tr.win);
      F.audio.sfx("win");
    } else {
      deltas = trialCtx.consoled ? {} : applyGain({ aff: 3, bond: 2 });
      trialCtx.consoled = true;
      state.lastLine = tpl(tr.lose);
      F.audio.sfx("lose");
    }
    state.log.push(state.lastLine);
    syncAchievements(); save(); render();

    var buttons = res.win
      ? '<button class="btn btn-primary" type="button" data-act="trial-next">带着信物继续 →</button>'
      : '<button class="btn btn-primary" type="button" data-act="trial-retry">再试一次</button>' +
        '<button class="btn" type="button" data-act="trial-skip">就这样吧</button>';
    var html = ovHead("季末考验 · 结算", s.title, null, false) +
      '<div class="trial-result"><div class="tr-icon">' + (res.win ? tr.icon : "🍃") + "</div>" +
      "<h3>" + (res.win ? "考验通过！" : "差一点点") + "</h3>" +
      "<p>" + esc(tpl(res.win ? tr.win : tr.lose)) + "</p>" +
      (res.win ? '<p style="margin-top:.5rem;font-size:.82rem;color:var(--accent-2)">获得季节信物 · ' + esc(tr.token) + "</p>" : "") +
      gainChips(deltas, items) + "</div>" +
      '<div class="ov-actions" style="justify-content:center">' + buttons + "</div>";
    openOverlay(html, { locked: true, wide: true });
  }
  function trialNext() {
    if (!trialCtx) return;
    var cb = trialCtx.cb;
    trialCtx = null;
    closeOverlay(true);
    save(); render();
    if (cb) cb();
  }
  function trialSkip() {
    if (!trialCtx) return;
    toast("这一季的信物留在了风里", "warn");
    trialNext();
  }
  function afterTrial() { advance(); }

  /* ---------------- 翻到下一天 ---------------- */
  function advance() {
    state.day += 1;
    if (state.day > 28) { showEnding(); return; }
    state.ap = 3;
    state.energy = clamp(state.energy + 22, 0, 100);
    state.mood = clamp(state.mood + 4, 0, 100);
    state.log = [];
    state.weather = generateWeather(season().id);
    state.lastSecretThought = null;
    if ((state.day - 1) % 7 === 0) {
      var s = season();
      state.lastLine = s.title + "，" + s.poem;
      toast(s.icon + " " + s.title + " · " + s.subtitle, "good");
    } else {
      state.lastLine = tpl(D.idleLines[(state.day - 1) % D.idleLines.length]);
    }
    save(); render();
    F.audio.sfx("page");
  }

  /* ---------------- 结局 ---------------- */
  function showEnding() {
    var end = D.endings.filter(function (e) { return e.test(state); })[0] || D.endings[D.endings.length - 1];
    lastEnding = end;
    state.ending = end.id;
    state.ap = 0;
    state.lastLine = tpl(end.quote);
    meta = F.getMeta();
    if (meta.endings.indexOf(end.id) < 0) meta.endings.push(end.id);
    F.patchMeta({ endings: meta.endings });
    syncAchievements();
    save(); render();
    renderEndingOverlay();
    F.audio.sfx("win");
  }
  function renderEndingOverlay() {
    var end = lastEnding || D.endings[D.endings.length - 1];
    var lines = end.lines.map(function (p) { return "<p>" + esc(tpl(p)) + "</p>"; }).join("");
    var html = ovHead("手记 · 最后一页", end.icon + " " + end.title, null, false) +
      '<div class="ending-view"><div class="ed-icon">' + end.icon + "</div>" +
      '<div class="ed-badge">' + esc(end.badge) + "</div><h2>" + esc(end.title) + "</h2>" +
      '<p class="ed-sub">' + esc(end.subtitle) + "</p>" +
      '<div class="ed-lines">' + lines + "</div>" +
      '<p class="ed-quote">' + esc(tpl(end.quote)) + "</p>" +
      '<p class="ed-stats">♥ 心动 ' + state.aff + " · ✦ 默契 " + state.bond +
        " · 📖 回忆 " + state.memories.length + " 张 · 🏅 信物 " + state.tokens.length + " / 4</p>" +
      '<div class="ov-actions" style="justify-content:center;flex-wrap:wrap;gap:.6rem">' +
        '<button class="btn btn-primary" type="button" data-act="ending-polaroid">📷 生成拍立得明信片</button>' +
        '<button class="btn btn-primary" type="button" data-act="ending-restart">再写一本 →</button>' +
        '<button class="btn" type="button" data-act="ending-album">📖 回忆册</button>' +
        '<button class="btn btn-ghost" type="button" data-act="ending-home">回到首页</button>' +
      "</div></div>";
    openOverlay(html, { locked: true, wide: true });
  }


  /* ---------------- 结局手账拍立得生成 ---------------- */
  function generatePolaroidCard() {
    var end = lastEnding || D.endings[D.endings.length - 1];
    var r = role();
    var canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 860;
    var ctx = canvas.getContext("2d");

    // 1. 拍立得底卡纸张背景
    ctx.fillStyle = "#faf5ee";
    ctx.fillRect(0, 0, 640, 860);

    // 浅米色复古相框微阴影
    ctx.strokeStyle = "#e2d2c1";
    ctx.lineWidth = 3;
    ctx.strokeRect(16, 16, 608, 828);

    // 顶部复古手绘纸胶带
    ctx.fillStyle = "rgba(224, 154, 130, 0.75)";
    ctx.fillRect(240, 6, 160, 24);

    // 2. 相纸照片视窗 (480 x 500)
    var photoX = 40, photoY = 46, photoW = 560, photoH = 500;
    var grad = ctx.createLinearGradient(photoX, photoY, photoX, photoY + photoH);
    grad.addColorStop(0, "#dceff5");
    grad.addColorStop(0.6, "#fdf1e2");
    grad.addColorStop(1, "#fdeae0");
    ctx.fillStyle = grad;
    ctx.fillRect(photoX, photoY, photoW, photoH);
    ctx.strokeStyle = "#cbb29c";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(photoX, photoY, photoW, photoH);

    // 照片内温馨光芒与星星
    ctx.font = "26px serif";
    ctx.fillStyle = "#f3a683";
    ctx.fillText("✨", photoX + 40, photoY + 50);
    ctx.fillText("🌸", photoX + photoW - 60, photoY + 60);
    ctx.fillText("🍂", photoX + 50, photoY + photoH - 40);
    ctx.fillText("❄️", photoX + photoW - 70, photoY + photoH - 50);

    // 绘制角色与心动符号
    ctx.font = "72px serif";
    ctx.textAlign = "center";
    ctx.fillText("🐰", photoX + photoW * 0.36, photoY + photoH * 0.58);
    ctx.font = "40px serif";
    ctx.fillText("💗", photoX + photoW * 0.50, photoY + photoH * 0.52);
    ctx.font = "72px serif";
    ctx.fillText("🦊", photoX + photoW * 0.64, photoY + photoH * 0.58);

    // 照片底部小标题
    ctx.font = "bold 22px 'PingFang SC', sans-serif";
    ctx.fillStyle = "#5c4033";
    ctx.fillText("《小兔子与小狐狸 · 四季之心》", photoX + photoW * 0.5, photoY + photoH - 24);

    // 3. 拍立得下部手记文字区
    ctx.textAlign = "left";
    // 结局徽章与标题
    ctx.font = "bold 28px 'PingFang SC', sans-serif";
    ctx.fillStyle = "#c25838";
    ctx.fillText(end.badge + " · " + end.title, 48, 600);

    // 纪念数据
    ctx.font = "17px 'PingFang SC', sans-serif";
    ctx.fillStyle = "#745848";
    ctx.fillText("📅 走过四季 28 天   ♥ 心动 " + state.aff + "   ✦ 默契 " + state.bond, 48, 638);
    ctx.fillText("📖 收集 " + state.memories.length + " 张回忆   🏅 四季信物 " + state.tokens.length + " / 4 枚", 48, 668);

    // 经典引言
    ctx.font = "italic 19px serif";
    ctx.fillStyle = "#4a3528";
    var quote = tpl(end.quote);
    ctx.fillText("“ " + quote + " ”", 48, 715);

    // 尾部手写签名与印戳
    ctx.font = "16px 'PingFang SC', sans-serif";
    ctx.fillStyle = "#957461";
    ctx.fillText("—— 小兔子 & 小狐狸 · 森林手记留念", 48, 755);

    // 纪念爪印印章
    ctx.textAlign = "right";
    ctx.font = "42px serif";
    ctx.fillText("🐾", 580, 770);
    ctx.font = "13px 'PingFang SC', sans-serif";
    ctx.fillStyle = "#b48c74";
    ctx.fillText("森林手记已盖戳", 585, 794);

    var dataUrl = canvas.toDataURL("image/jpeg", 0.92);

    // 记录成就
    var m = F.getMeta();
    m.savedPolaroid = true;
    F.patchMeta({ savedPolaroid: true });
    syncAchievements();

    var html = ovHead("手账拍立得", "📷 定格这一瞬的心意") +
      '<div class="polaroid-view">' +
        '<div class="polaroid-wrapper"><img src="' + dataUrl + '" alt="结局拍立得" class="polaroid-img"></div>' +
        '<p class="polaroid-hint">💡 电脑可右键另存为图片，手机可长按图片保存到相册，分享给最想念的人。</p>' +
        '<div class="ov-actions" style="justify-content:center">' +
          '<a class="btn btn-primary" href="' + dataUrl + '" download="森林手记_拍立得纪念.jpg">下载保存图片</a>' +
          '<button class="btn" type="button" data-act="ending-back">返回结局</button>' +
        '</div>' +
      '</div>';
    openOverlay(html, { wide: true });
  }

  /* ---------------- 回忆册 / 玩法 / 重开 ---------------- */
  function openAlbum(back) {
    var memIds = Object.keys(D.memories);
    var owned = state ? state.memories : [];
    var memHtml = memIds.map(function (id) {
      var m = D.memories[id], has = owned.indexOf(id) >= 0;
      return '<div class="album-card' + (has ? "" : " locked") + '"><div class="ab-top">' +
        '<span class="ab-icon">' + (has ? m.icon : "🔒") + "</span>" + esc(has ? m.title : "还没写到") + "</div>" +
        "<p>" + esc(has ? m.text : "继续写下去，这一页会自己出现。") + "</p></div>";
    }).join("");
    var m = F.getMeta();
    var badgeHtml = D.achievements.map(function (a) {
      var has = m.achievements.indexOf(a.id) >= 0;
      return '<div class="badge' + (has ? "" : " locked") + '"><span class="bd-icon">' + a.icon + "</span>" +
        '<div><div class="bd-name">' + esc(a.name) + '</div><div class="bd-desc">' + esc(a.desc) + "</div></div></div>";
    }).join("");
    var endHtml = D.endings.map(function (e) {
      var has = m.endings.indexOf(e.id) >= 0;
      return '<div class="album-card' + (has ? "" : " locked") + '"><div class="ab-top"><span class="ab-icon">' +
        (has ? e.icon : "🔒") + "</span>" + esc(has ? e.title : "尚未抵达") + "</div><p>" +
        esc(has ? e.badge + " · " + e.subtitle : "某个还没写完的结局。") + "</p></div>";
    }).join("");
    var diary = state ? state.diary.slice(-12).reverse() : [];
    var timeline = diary.length
      ? diary.map(function (d) { return '<div class="timeline-item"><b>第 ' + d.day + " 天</b> " + esc(d.icon) + " " + esc(d.text) + "</div>"; }).join("")
      : '<div class="timeline-item">还没有写完的页面。</div>';

    var html = ovHead("回忆册", "写过的，都留下来了") +
      '<p class="ov-sub">已收集 ' + owned.length + " / " + memIds.length + " 张回忆 · " +
      (state ? state.tokens.length : 0) + " / 4 枚季节信物 · " + m.endings.length + " 个结局</p>" +
      '<div class="album-section"><h4>📖 回忆卡 <small>' + owned.length + " / " + memIds.length + "</small></h4>" +
      '<div class="album-grid">' + memHtml + "</div></div>" +
      '<div class="album-section"><h4>🏅 成就徽章</h4><div class="badge-grid">' + badgeHtml + "</div></div>" +
      '<div class="album-section"><h4>🌳 结局</h4><div class="album-grid">' + endHtml + "</div></div>" +
      '<div class="album-section" style="margin-bottom:0"><h4>🗓️ 翻回去看看</h4>' +
      '<div class="timeline">' + timeline + "</div></div>" +
      '<div class="ov-actions"><button class="btn btn-primary" type="button" data-act="close">合上回忆册</button></div>';
    openOverlay(html, { wide: true, onClose: back || null });
  }

  function openHelp(back) {
    var rules = D.help.map(function (h) {
      return '<li><span class="rl-icon">' + h.icon + "</span><div><b>" + esc(h.title) + "</b>" +
        esc(tpl(h.text)) + "</div></li>";
    }).join("");
    var html = ovHead("玩法说明", "四季之心怎么玩") +
      '<ul class="rule-list">' + rules + "</ul>" +
      '<div class="ov-actions"><button class="btn btn-primary" type="button" data-act="close">知道了</button></div>';
    openOverlay(html, { onClose: back || null });
  }

  function confirmReset() {
    var html = ovHead("重新开始", "要换一本新的手记吗？") +
      '<p class="ov-sub">当前这一本的进度会被清空，但回忆册、成就和已解锁的结局会保留下来。</p>' +
      '<div class="ov-actions"><button class="btn btn-primary" type="button" data-act="reset-confirm">清空并重开</button>' +
      '<button class="btn" type="button" data-act="reset-cancel">先不要</button></div>';
    openOverlay(html);
  }
  function resetAndStart() {
    F.storage.remove(F.SAVE_KEY);
    state = null; lastEnding = null; trialCtx = null; currentEvent = null;
    eventDone = null; pendingDiary = null; selectedRole = "bunny";
    closeOverlay(true);
    renderEmpty();
    showStart();
    toast("手记已清空，可以重新写一本了", "good");
  }

  /* ---------------- 事件总线 ---------------- */
  function handleAct(btn) {
    var act = btn.dataset.act;
    switch (act) {
      case "start": showStart(); break;
      case "role":
        selectedRole = btn.dataset.role || "bunny";
        util.qsa(".role-card", card).forEach(function (el) {
          el.classList.toggle("is-active", el.dataset.role === selectedRole);
        });
        F.audio.sfx("tap");
        break;
      case "new": startNew(selectedRole); break;
      case "continue": continueGame(); break;
      case "help-start": openHelp(showStart); break;
      case "help": openHelp(null); break;
      case "album": openAlbum(null); break;
      case "reset": confirmReset(); break;
      case "reset-confirm": resetAndStart(); break;
      case "reset-cancel": closeOverlay(true); break;
      case "close": closeOverlay(); break;
      case "do-action": doAction(btn.dataset.id); break;
      case "gift": giveGift(btn.dataset.item); break;
      case "make-craft": doCraft(btn.dataset.id); break;
      case "ending-polaroid": generatePolaroidCard(); break;
      case "ending-back": renderEndingOverlay(); break;
      case "choice": chooseOption(Number(btn.dataset.i)); break;
      case "event-next": finishEvent(); break;
      case "endday": endDay(); break;
      case "confirm-endday": proceedEndDay(); break;
      case "trial-start":
      case "trial-retry": startTrialMini(); break;
      case "trial-skip": trialSkip(); break;
      case "trial-next": trialNext(); break;
      case "ending-album": openAlbum(renderEndingOverlay); break;
      case "ending-restart": resetAndStart(); break;
      case "ending-home": window.location.href = "index.html"; break;
      default: break;
    }
  }

  function init() {
    meta = F.getMeta();
    F.fx.initAll();

    $("albumBtn").addEventListener("click", function () { F.audio.sfx("tap"); openAlbum(null); });
    $("helpBtn").addEventListener("click", function () { F.audio.sfx("tap"); openHelp(null); });
    $("resetBtn").addEventListener("click", function () { F.audio.sfx("tap"); confirmReset(); });

    overlay.addEventListener("click", function (e) { if (e.target === overlay) closeOverlay(); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { closeOverlay(); return; }
      if (e.key === "Tab") trapTab(e);
    });
    document.addEventListener("click", function (e) {
      var btn = e.target && e.target.closest ? e.target.closest("[data-act]") : null;
      if (!btn || btn.disabled) return;
      handleAct(btn);
    });

    var saved = F.getSave(F.SAVE_KEY);
    if (saved && saved.v === 2) {
      state = saved;
      normalize();
      if (state.ending) {
        lastEnding = D.endings.filter(function (x) { return x.id === state.ending; })[0] || D.endings[D.endings.length - 1];
      }
      save(); render();
      if (isNewGameRequest()) { showStart(); return; }
      if (state.ending) renderEndingOverlay();
      else toast("欢迎回来 · 第 " + state.day + " 天", "good");
    } else {
      renderEmpty();
      showStart();
    }
  }

  init();
})();
