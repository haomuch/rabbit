/* =========================================================
   site.js · 首页交互
   章节 / 档案 / 问答 / 气泡 / 轮播 / 视差 / 游戏入口状态
   ========================================================= */
(function () {
  "use strict";

  var F = window.Forest, D = window.ForestData, Art = window.ForestArt;
  var util = F.util, esc = util.esc;
  var $ = function (id) { return document.getElementById(id); };

  /* ---------------- Hero 角色插画：点击可轮换 5 种表情 ---------------- */
  var HERO_MOODS = ["normal", "happy", "shy", "sleep", "love"];
  var HERO_MOOD_NAMES = { normal: "平常", happy: "开心", shy: "害羞", sleep: "困了", love: "心动" };
  var heroMood = { bunny: 0, fox: 0 };

  function paintHero(who) {
    var el = $(who === "bunny" ? "bunnyChar" : "foxChar");
    var mood = HERO_MOODS[heroMood[who]];
    el.querySelector(".char-art").innerHTML = who === "bunny" ? Art.bunny(mood) : Art.fox(mood);
    el.setAttribute("aria-label", "点击" + (who === "bunny" ? "小兔子" : "小狐狸") + "，换一副表情");
    return mood;
  }
  paintHero("bunny");
  paintHero("fox");
  $("heartSep").innerHTML = Art.heart(40);

  /* ---------------- Hero 文案轮播 ---------------- */
  var leadEl = $("heroLead"), leadIdx = 0;
  leadEl.textContent = D.leads[0];
  setInterval(function () {
    leadIdx = (leadIdx + 1) % D.leads.length;
    leadEl.style.opacity = 0;
    setTimeout(function () {
      leadEl.textContent = D.leads[leadIdx];
      leadEl.style.opacity = 1;
    }, 480);
  }, 4800);

  /* ---------------- 鼠标视差 ---------------- */
  if (window.matchMedia("(pointer: fine)").matches) {
    var charEls = util.qsa(".char[data-depth]"), parallaxRaf = null;
    window.addEventListener("mousemove", function (e) {
      if (parallaxRaf) return;
      parallaxRaf = requestAnimationFrame(function () {
        var nx = e.clientX / window.innerWidth - 0.5;
        var ny = e.clientY / window.innerHeight - 0.5;
        charEls.forEach(function (el) {
          var depth = parseFloat(el.dataset.depth) || 1;
          el.style.transform = "translate(" + (nx * 16 * depth).toFixed(2) + "px," + (ny * 11 * depth).toFixed(2) + "px)";
        });
        parallaxRaf = null;
      });
    });
  }

  /* ---------------- 角色对话气泡 ---------------- */
  var bubble = $("speechBubble"), bubbleTimer = null;
  function showBubble(anchorEl, text) {
    var margin = 10;
    var rect = anchorEl.getBoundingClientRect();
    var centerX = rect.left + rect.width / 2;
    // 关键：fixed 元素若未定宽，其 shrink-to-fit 宽度 = 视口宽 - left，
    // 会随 left 变化。测量前先把 left 归零，拿到不依赖位置的最大宽度，
    // 之后写入新 left 时实际宽度只会 <= 该值，钳制才始终成立。
    bubble.style.left = "0px";
    // 宽度按视口自适应（不依赖 CSS min()，兼容老旧 WebView）
    bubble.style.maxWidth = Math.min(250, window.innerWidth - margin * 2) + "px";
    bubble.textContent = text;
    bubble.classList.add("show");
    var bw = bubble.offsetWidth, bh = bubble.offsetHeight;
    var half = bw / 2;
    // 水平方向：优先以角色为中心，越界则吸附到视口内
    var left = centerX;
    if (left - half < margin) left = margin + half;
    if (left + half > window.innerWidth - margin) left = window.innerWidth - margin - half;
    // 垂直方向：默认浮在角色上方，越界则下移到视口内
    var top = rect.top - 14;
    if (top - bh < margin) top = rect.bottom + 14;
    if (top + bh > window.innerHeight - margin) top = window.innerHeight - margin - bh;
    if (top < margin) top = margin;
    bubble.style.left = left + "px";
    bubble.style.top = top + "px";
    // 用写入 left 后的真实宽度计算箭头，保证箭头落在气泡范围内
    var actualHalf = bubble.offsetWidth / 2;
    var arrow = Math.max(-actualHalf + 12, Math.min(actualHalf - 12, centerX - left));
    bubble.style.setProperty("--arrow", arrow + "px");
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(function () { bubble.classList.remove("show"); }, 2800);
  }
  $("bunnyChar").addEventListener("click", function () {
    heroMood.bunny = (heroMood.bunny + 1) % HERO_MOODS.length;
    var m = paintHero("bunny");
    showBubble(this, util.pick(D.bubbles.bunny));
    F.audio.sfx("tap");
  });
  $("foxChar").addEventListener("click", function () {
    heroMood.fox = (heroMood.fox + 1) % HERO_MOODS.length;
    var m = paintHero("fox");
    showBubble(this, util.pick(D.bubbles.fox));
    F.audio.beep(470, 0.08, "triangle", 0.03);
  });
  window.addEventListener("scroll", function () { bubble.classList.remove("show"); }, { passive: true });

  /* ---------------- 章节 ---------------- */
  (function renderChapters() {
    var tabs = $("chapterTabs"), body = $("chapterBody");
    D.chapters.forEach(function (c, i) {
      var tab = document.createElement("button");
      tab.type = "button";
      tab.className = "tab" + (i === 0 ? " is-active" : "");
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-selected", i === 0 ? "true" : "false");
      tab.dataset.chapter = String(i);
      tab.textContent = c.tab;
      tabs.appendChild(tab);

      var article = document.createElement("article");
      article.className = "chapter" + (i === 0 ? " is-active" : "");
      article.dataset.chapter = String(i);
      var html = "<h3>" + esc(c.title) + "</h3>";
      c.paragraphs.forEach(function (p) { html += "<p>" + esc(p) + "</p>"; });
      html += "<blockquote>" + esc(c.quote) + "</blockquote>";
      article.innerHTML = html;
      body.appendChild(article);
    });

    var tabEls = util.qsa(".tab", tabs), chapterEls = util.qsa(".chapter", body);
    tabEls.forEach(function (tab) {
      tab.addEventListener("click", function () {
        tabEls.forEach(function (t) {
          var on = t === tab;
          t.classList.toggle("is-active", on);
          t.setAttribute("aria-selected", on ? "true" : "false");
        });
        chapterEls.forEach(function (c) { c.classList.toggle("is-active", c.dataset.chapter === tab.dataset.chapter); });
        F.audio.sfx("page");
      });
    });
  })();

  /* ---------------- 档案 ---------------- */
  (function renderProfiles() {
    var grid = $("profileGrid");
    D.profiles.forEach(function (p) {
      var card = document.createElement("article");
      card.className = "profile-card reveal";
      var html = '<div class="profile-emoji">' + esc(p.emoji) + "</div><h3>" + esc(p.name) + "</h3>" +
        '<p class="profile-desc">' + esc(p.desc) + "</p><ul class=\"traits\">";
      p.traits.forEach(function (t) { html += "<li>" + esc(t) + "</li>"; });
      html += "</ul>";
      card.innerHTML = html;
      grid.appendChild(card);
    });
  })();

  /* ---------------- 默契小考 ---------------- */
  (function initQuiz() {
    var data = D.quiz;
    var stage = $("quizStage"), progressEl = $("quizProgress"), barFill = $("quizBarFill");
    var idx = 0, score = 0, locked = false;

    function renderQuestion() {
      if (idx >= data.length) { renderResult(); return; }
      locked = false;
      var q = data[idx];
      progressEl.textContent = "第 " + (idx + 1) + " / " + data.length + " 题";
      barFill.style.width = (idx / data.length * 100) + "%";
      stage.innerHTML = "";

      var qEl = document.createElement("p");
      qEl.className = "q-text";
      qEl.textContent = q.q;
      stage.appendChild(qEl);

      var optWrap = document.createElement("div");
      optWrap.className = "q-options";
      stage.appendChild(optWrap);

      q.options.forEach(function (opt, i) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "q-option";
        var key = document.createElement("span");
        key.className = "q-key";
        key.textContent = String.fromCharCode(65 + i);
        var label = document.createElement("span");
        label.textContent = opt;
        btn.appendChild(key); btn.appendChild(label);

        btn.addEventListener("click", function () {
          if (locked) return;
          locked = true;
          util.qsa(".q-option", optWrap).forEach(function (b, bi) {
            b.disabled = true;
            if (bi === q.answer) b.classList.add("is-correct");
          });
          if (i === q.answer) { score++; F.audio.sfx("good"); }
          else { btn.classList.add("is-wrong"); F.audio.sfx("bad"); }

          var fb = document.createElement("div");
          fb.className = "q-feedback";
          fb.textContent = (i === q.answer ? "✓ 答对了。" : "✗ 正确答案是「" + q.options[q.answer] + "」。") + " " + q.explain;
          stage.appendChild(fb);

          var nextBtn = document.createElement("button");
          nextBtn.type = "button";
          nextBtn.className = "q-next";
          nextBtn.textContent = idx === data.length - 1 ? "查看结果" : "下一题";
          nextBtn.addEventListener("click", function () { F.audio.sfx("page"); idx++; renderQuestion(); });
          stage.appendChild(nextBtn);
        });
        optWrap.appendChild(btn);
      });
    }

    function renderResult() {
      progressEl.textContent = "已完成";
      barFill.style.width = "100%";
      stage.innerHTML = "";
      var wrap = document.createElement("div");
      wrap.className = "quiz-result";

      var scoreEl = document.createElement("div");
      scoreEl.className = "quiz-score";
      scoreEl.textContent = score + " / " + data.length;

      var msg = document.createElement("p");
      msg.className = "quiz-msg";
      if (score === data.length) msg.textContent = "全对。你比小狐狸还了解它们的故事。";
      else if (score === data.length - 1) msg.textContent = "很接近了，再翻一翻森林手记吧。";
      else if (score > 0) msg.textContent = "不错，故事里还藏着不少细节。";
      else msg.textContent = "没关系，故事可以再读一遍。";

      var again = document.createElement("button");
      again.type = "button";
      again.className = "q-next";
      again.textContent = "再玩一次";
      again.addEventListener("click", function () { idx = 0; score = 0; renderQuestion(); });

      wrap.appendChild(scoreEl); wrap.appendChild(msg); wrap.appendChild(again);

      if (score === data.length) {
        F.patchMeta({ quizPerfect: true });
        F.audio.sfx("win");
        var reward = document.createElement("div");
        reward.className = "quiz-reward";
        reward.textContent = "🌼 默契小考全对 · 新的手记开局获赠野花 ×2";
        wrap.appendChild(reward);
      }
      stage.appendChild(wrap);
    }

    renderQuestion();
  })();

  /* ---------------- 玩法卡片 ---------------- */
  (function renderPlayCards() {
    var grid = $("playGrid");
    D.playCards.forEach(function (c) {
      var card = document.createElement("article");
      card.className = "play-card reveal";
      card.innerHTML = '<div class="pc-icon">' + esc(c.icon) + "</div><h4>" + esc(c.title) +
        "</h4><p>" + esc(c.text) + "</p>";
      grid.appendChild(card);
    });
  })();

  /* ---------------- 存档状态 / 游戏入口 ---------------- */
  (function renderEntry() {
    var save = F.getSave(F.SAVE_KEY);
    var meta = F.getMeta();
    var status = $("playStatus"), cont = $("playContinueBtn"), heroStart = $("heroStart");
    var alive = save && save.v === 2 && !save.ending;

    if (alive) {
      var s = D.seasons[Math.floor((Math.max(1, save.day) - 1) / 7)] || D.seasons[3];
      status.innerHTML = "本机遇到了一本正在写的手记：<strong>" + esc(s.title) + " · 第 " +
        Number(save.day) + " / 28 天</strong>　心动 " + Number(save.aff) +
        " · 回忆 " + (save.memories ? save.memories.length : 0) + " 张";
      cont.hidden = false;
      cont.textContent = "继续第 " + save.day + " 天 →";
      heroStart.textContent = "继续第 " + save.day + " 天 →";
    } else if (save && save.ending) {
      var end = D.endings.filter(function (e) { return e.id === save.ending; })[0];
      status.innerHTML = "上一本手记已经写完：<strong>" + esc(end ? end.title : "某个结局") +
        "</strong>　已解锁 " + meta.endings.length + " 个结局";
      heroStart.textContent = "再写一本新的手记 →";
    } else {
      status.textContent = "手记架还空着 —— 第一页，等你来写。";
    }
  })();

  /* ---------------- 启动共享特效（动态内容已生成） ---------------- */
  F.fx.initAll();
})();

