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
    gift: "把礼物递过去的时候，假装自己一点也不紧张。",
    date: "今天，是只属于两个人的一页。"
  };

  /* ---------------- 基础工具 ---------------- */
  function tpl(s) {
    if (!state) return String(s == null ? "" : s);
    var r = D.roles[state.role] || D.roles.bunny;
    return String(s == null ? "" : s).replace(/\{\{T\}\}/g, r.target).replace(/\{\{M\}\}/g, r.me);
  }
  function season() { return D.seasons[clamp(Math.floor((state.day - 1) / 7), 0, 3)]; }
  function role() { return D.roles[state.role] || D.roles.bunny; }

  function newState(roleKey) {
    var m = F.getMeta();
    var st = {
      v: 2, role: roleKey, day: 1, ap: 3,
      aff: 12, bond: 8, mood: 72, energy: 100,
      items: { berry: 2, mushroom: 1, wood: 0, flower: 0, stardust: 0 },
      seenEvents: [], memories: [], tokens: [], trials: {}, diary: [], log: [],
      gifts: 0, dates: 0, encounters: 0, flags: {},
      ending: null, lastLine: "", dateDoneDay: 0,
      startedAt: Date.now(), updatedAt: Date.now()
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
    if (!state.trials || typeof state.trials !== "object") state.trials = {};
    if (!state.flags || typeof state.flags !== "object") state.flags = {};
    if (!state.role || !D.roles[state.role]) state.role = "bunny";
    if (typeof state.gifts !== "number") state.gifts = 0;
    if (typeof state.dates !== "number") state.dates = 0;
    if (typeof state.dateDoneDay !== "number") state.dateDoneDay = 0;
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
  function openOverlay(html, opts) {
    opts = opts || {};
    destroyMini();
    card.className = "overlay-card" + (opts.wide ? " wide" : "");
    card.innerHTML = html;
    overlayLocked = !!opts.locked;
    overlayOnClose = opts.onClose || null;
    overlay.classList.add("show");
    overlay.setAttribute("aria-hidden", "false");
    card.scrollTop = 0;
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

    $("hud").innerHTML =
      '<div class="hud-top">' +
        '<span class="season-chip"><span class="sc-icon">' + s.icon + "</span>" + esc(s.title) + " · " + esc(s.subtitle) + "</span>" +
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
    sc.innerHTML =
      '<div class="scene-decor">' + Art.scene(s.id) + "</div>" +
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

    $("diaryCard").innerHTML =
      '<div class="diary-head"><h3>今日手记</h3><span>第 ' + state.day + " 天</span></div>" +
      '<ul class="diary-list">' + list + "</ul>" +
      '<div class="diary-summary">已写下 <b>' + state.diary.length + "</b> 页 · 收集 <b>" + state.memories.length +
        "</b> 张回忆 · 季节信物 <b>" + state.tokens.length + " / 4</b></div>" +
      '<div class="diary-foot">' +
        '<button class="btn btn-sm" type="button" data-act="album">📖 回忆册</button>' +
        '<button class="btn btn-sm" type="button" data-act="help">❔ 玩法</button>' +
      "</div>";
  }

  /* ---------------- 渲染：行动卡 ---------------- */
  function actionStatus(a, s) {
    if (state.ending) return { ok: false, why: "这一本已经写完啦" };
    if (state.ap < a.ap) return { ok: false, why: "行动点不够" };
    if (a.energy && state.energy < a.energy) return { ok: false, why: "体力不够，先歇一会儿" };
    if (a.special === "gift" && !anyItems()) return { ok: false, why: "背包空空的" };
    if (a.special === "date") {
      var cost = D.dateCost[s.id] || {};
      if (state.dateDoneDay === state.day) return { ok: false, why: "今天已经约过啦" };
      if (!hasItems(cost)) return { ok: false, why: "需要 " + costText(cost) };
    }
    return { ok: true, why: "" };
  }
  function renderActions() {
    var s = season();
    $("actionsHint").textContent = state.mood < 30
      ? "心情有点低，今天的好感收益会打七折 —— 不妨先歇一会儿。"
      : "每格行动都会写进手记，随时可以合上这一页。";

    $("actionGrid").innerHTML = D.actions.map(function (a) {
      var st = actionStatus(a, s);
      var cost = a.ap + " AP" + (a.energy ? " · " + a.energy + " 体力" : "");
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
    var alive = save && save.v === 2 && !save.ending;
    var rolesHtml = Object.keys(D.roles).map(function (k) {
      var r = D.roles[k];
      return '<button class="role-card' + (k === selectedRole ? " is-active" : "") + '" type="button" data-act="role" data-role="' + k + '">' +
        '<div class="rc-icon">' + r.icon + '</div><div class="rc-name">扮演 ' + esc(r.me) + "</div>" +
        '<div class="rc-desc">和' + esc(r.target) + "写一本手记<br>" + esc(r.desc) + "</div></button>";
    }).join("");
    var html =
      '<div class="start-hero"><div class="sh-mark">🌳</div><h2>森林手记 · 四季之心</h2>' +
      '<p>从初春到冬末，二十八天，每天三格行动力。把「最要好的朋友」，慢慢写成别的什么。</p></div>' +
      '<div class="role-grid">' + rolesHtml + "</div>" +
      '<div class="ov-actions">' +
        '<button class="btn btn-primary btn-block" type="button" data-act="new">开始写第一页 →</button>' +
        (alive ? '<button class="btn btn-block" type="button" data-act="continue">继续第 ' + save.day + " 天</button>" : "") +
        '<button class="btn btn-ghost btn-block" type="button" data-act="help-start">先看看玩法</button>' +
      "</div>" +
      '<p class="ov-note">进度自动保存在本机 · 昼夜主题与音效在右上角切换 · 电脑和手机都能玩</p>';
    openOverlay(html, { locked: true });
  }
  function startNew(roleKey) {
    state = newState(roleKey);
    meta = F.getMeta();
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
    if (a.special === "date") { startDate(a, s); return; }

    state.ap -= a.ap;
    if (a.energy) state.energy = clamp(state.energy - a.energy, 0, 100);
    applyGain(a.gain);

    var gained = {};
    if (a.items) { addItems(a.items); mergeMap(gained, a.items); }
    if (a.bonus && a.bonus.season === s.id && a.bonus.items) {
      addItems(a.bonus.items); mergeMap(gained, a.bonus.items);
    }
    var notes = [];
    if (a.bonus && a.bonus.season === s.id) notes.push(s.name + "季加成，收获更多！");

    if (a.chance) handleChance(a.chance, s, gained, notes);

    var line = tpl(ACTION_LINES[id] || "今天也好好过了一天。");
    state.lastLine = line;
    state.log.push(line);
    if (state.log.length > 12) state.log = state.log.slice(-12);

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
      if (Math.random() < q) { addItems({ stardust: 1 }); mergeMap(gained, { stardust: 1 }); }
    } else if (kind === "encounter") {
      if (Math.random() < 0.42) {
        var en = util.pick(D.encounters);
        applyGain(en.gain);
        state.encounters++;
        var txt = tpl(en.text);
        state.log.push(txt);
        notes.push(txt);
      }
    }
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
    state.energy = clamp(state.energy - a.energy, 0, 100);
    state.dates++;
    state.dateDoneDay = state.day;
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
    trialCtx = { s: s, tr: tr, cb: cb, phase: "intro" };
    var html = ovHead("季末考验 · " + s.title, tr.icon + " " + tr.title) +
      '<p class="ov-sub">' + esc(tpl(tr.intro)) + "</p>" +
      '<div class="ov-actions"><button class="btn btn-primary" type="button" data-act="trial-start">开始考验 →</button>' +
      '<button class="btn" type="button" data-act="trial-skip">这次先跳过</button></div>' +
      '<p class="ov-note">赢下考验可获得「' + esc(tr.token) + '」与额外心动、默契；没赢也能重试，不会卡住故事。</p>';
    openOverlay(html, { locked: true, wide: true });
  }
  function startTrialMini() {
    if (!trialCtx) return;
    trialCtx.phase = "playing";
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
    trialCtx.phase = "result";
    var tr = trialCtx.tr, s = trialCtx.s;
    var deltas, items = {};
    if (res.win) {
      deltas = applyGain({ aff: 12, bond: 8, mood: 6 });
      items = { stardust: 1 };
      addItems(items);
      if (state.tokens.indexOf(s.id) < 0) state.tokens.push(s.id);
      state.trials[s.id] = "win";
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
    state.trials[trialCtx.s.id] = trialCtx.phase === "intro" ? "skip" : "lose";
    syncAchievements();
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
    state.dateDoneDay = 0;
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
    F.patchMeta({
      endings: meta.endings,
      bestAff: Math.max(meta.bestAff || 0, state.aff),
      totalDays: (meta.totalDays || 0) + 28
    });
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
      '<div class="ov-actions" style="justify-content:center">' +
        '<button class="btn btn-primary" type="button" data-act="ending-restart">再写一本 →</button>' +
        '<button class="btn" type="button" data-act="ending-album">📖 回忆册</button>' +
        '<button class="btn btn-ghost" type="button" data-act="ending-home">回到首页</button>' +
      "</div></div>";
    openOverlay(html, { locked: true, wide: true });
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
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeOverlay(); });
    document.addEventListener("click", function (e) {
      var btn = e.target && e.target.closest ? e.target.closest("[data-act]") : null;
      if (!btn || btn.disabled) return;
      handleAct(btn);
    });

    var saved = F.getSave(F.SAVE_KEY);
    if (saved && saved.v === 2) {
      state = saved;
      normalize(); save(); render();
      if (state.ending) {
        lastEnding = D.endings.filter(function (x) { return x.id === state.ending; })[0] || D.endings[D.endings.length - 1];
        renderEndingOverlay();
      } else {
        toast("欢迎回来 · 第 " + state.day + " 天", "good");
      }
    } else {
      renderEmpty();
      showStart();
    }
  }

  init();
})();
