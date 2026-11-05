/* =========================================================
   minigames.js · 季末考验的两个小游戏引擎
   catchGame：点击/触摸下落物（春、冬）
   memoryGame：限时记忆配对（夏、秋）
   两者都只依赖 core.js，鼠标与触屏通用，调用 done({win,...})
   ========================================================= */
(function () {
  "use strict";

  var F = window.Forest;
  var esc = F.util.esc;

  function head(title, left, right) {
    return '<div class="mini-head">' +
      '<span class="mini-title">' + esc(title) + "</span>" +
      '<span class="mini-metrics"><span class="m-left">' + left + '</span><span class="m-right">' + right + "</span></span>" +
      "</div>";
  }

  /* ---------------- 接住心意 ---------------- */
  function catchGame(root, opts, done) {
    opts = opts || {};
    var duration = opts.duration || 12;
    var target = opts.target || 8;
    var spawnMs = opts.spawn || 540;
    var fallSec = opts.fall || 3.3;
    var good = opts.good || ["💛"];
    var bad = opts.bad || ["🌧️"];

    var score = 0, misses = 0, finished = false;
    var elapsed = 0, last = 0, spawnAcc = 0, raf = null;
    var items = [];

    root.innerHTML =
      head("接住心意 · 目标 " + target + " 个", '<span class="m-score">0</span> / ' + target, '<span class="m-time">' + duration + "</span>s") +
      '<div class="catch-field"><span class="catch-hint">点一下飘落的好东西，别碰到坏的</span></div>' +
      '<div class="mini-foot">鼠标点击或手指轻触都可以 · 接满 ' + target + ' 个就算过关</div>';

    var field = root.querySelector(".catch-field");
    var hudScore = root.querySelector(".m-score");
    var hudTime = root.querySelector(".m-time");
    var fieldH = field.clientHeight || 280;
    var speed = (fieldH + 70) / (fallSec * 1000);

    function pop(x, y, text, goodHit) {
      var el = document.createElement("span");
      el.className = "catch-pop " + (goodHit ? "is-good" : "is-bad");
      el.textContent = text;
      el.style.left = x + "%";
      el.style.top = y + "px";
      field.appendChild(el);
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 620);
    }

    function spawn() {
      var isGood = Math.random() < 0.76;
      var symbol = isGood ? F.util.pick(good) : F.util.pick(bad);
      var el = document.createElement("button");
      el.type = "button";
      el.className = "fall-item " + (isGood ? "is-good" : "is-bad");
      el.textContent = symbol;
      var x = 7 + Math.random() * 82;
      el.style.left = x + "%";
      el.setAttribute("aria-label", isGood ? "接住它" : "别碰它");
      field.appendChild(el);

      var item = { el: el, x: x, y: -48, good: isGood, dead: false };
      items.push(item);
      el.addEventListener("pointerdown", function (e) {
        e.preventDefault();
        if (finished || item.dead) return;
        item.dead = true;
        if (item.good) {
          score++;
          F.audio.beep(760, 0.07, "sine", 0.032);
          pop(item.x, item.y, "+1", true);
        } else {
          score = Math.max(0, score - 1);
          misses++;
          F.audio.sfx("bad");
          pop(item.x, item.y, "−1", false);
        }
        hudScore.textContent = String(score);
        if (el.parentNode) el.parentNode.removeChild(el);
      });
    }

    function finish() {
      if (finished) return;
      finished = true;
      if (raf) cancelAnimationFrame(raf);
      items.forEach(function (it) { if (it.el.parentNode) it.el.parentNode.removeChild(it.el); });
      items = [];
      done({ win: score >= target, score: score, target: target, misses: misses });
    }

    function loop(ts) {
      if (finished) return;
      if (!last) last = ts;
      var dt = Math.min(ts - last, 60);
      last = ts;
      elapsed += dt;
      spawnAcc += dt;
      if (spawnAcc >= spawnMs) { spawnAcc = 0; spawn(); }

      for (var i = items.length - 1; i >= 0; i--) {
        var it = items[i];
        if (it.dead) { items.splice(i, 1); continue; }
        it.y += speed * dt;
        it.el.style.transform = "translate3d(0," + it.y.toFixed(1) + "px,0)";
        if (it.y > fieldH + 30) {
          if (it.el.parentNode) it.el.parentNode.removeChild(it.el);
          items.splice(i, 1);
        }
      }

      var left = Math.max(0, Math.ceil(duration - elapsed / 1000));
      if (hudTime.textContent !== String(left)) hudTime.textContent = String(left);
      if (elapsed >= duration * 1000) { finish(); return; }
      raf = requestAnimationFrame(loop);
    }

    spawn();
    raf = requestAnimationFrame(loop);

    return {
      destroy: function () {
        finished = true;
        if (raf) cancelAnimationFrame(raf);
        items.forEach(function (it) { if (it.el.parentNode) it.el.parentNode.removeChild(it.el); });
        items = [];
        root.innerHTML = "";
      }
    };
  }

  /* ---------------- 手记翻翻 ---------------- */
  function memoryGame(root, opts, done) {
    opts = opts || {};
    var pairs = Math.max(2, Math.min(6, opts.pairs || 4));
    var icons = (opts.icons || ["🍓", "🍄", "🌰", "🍯"]).slice(0, pairs);
    while (icons.length < pairs) icons.push("💛");
    var timeLimit = opts.timeLimit || 40;

    var deck = F.util.shuffle(icons.concat(icons));
    var first = null, lock = false, matched = 0, moves = 0, left = timeLimit;
    var finished = false, timer = null;

    root.innerHTML =
      head("手记翻翻 · " + pairs + " 对", '<span class="m-score">0</span> / ' + pairs + " 对", '<span class="m-time">' + left + "</span>s") +
      '<div class="mem-grid"></div>' +
      '<div class="mini-foot">翻开两张相同的图案即可配对 · 步数 <span class="m-moves">0</span></div>';

    var grid = root.querySelector(".mem-grid");
    var hudScore = root.querySelector(".m-score");
    var hudTime = root.querySelector(".m-time");
    var hudMoves = root.querySelector(".m-moves");

    deck.forEach(function (icon) {
      var card = document.createElement("button");
      card.type = "button";
      card.className = "mem-card";
      card.dataset.icon = icon;
      card.setAttribute("aria-label", "翻开一张手记卡");
      card.innerHTML = '<span class="mem-back">📖</span><span class="mem-face">' + esc(icon) + "</span>";
      card.addEventListener("click", function () { flip(card); });
      grid.appendChild(card);
    });

    function finish(win) {
      if (finished) return;
      finished = true;
      if (timer) clearInterval(timer);
      done({ win: win, matched: matched, pairs: pairs, moves: moves });
    }

    function flip(card) {
      if (finished || lock || card.classList.contains("flipped") || card.classList.contains("matched")) return;
      card.classList.add("flipped");
      F.audio.sfx("tap");
      if (!first) { first = card; return; }

      var a = first, b = card;
      first = null;
      lock = true;
      moves++;
      hudMoves.textContent = String(moves);

      if (a.dataset.icon === b.dataset.icon) {
        setTimeout(function () {
          a.classList.add("matched"); b.classList.add("matched");
          matched++;
          hudScore.textContent = String(matched);
          F.audio.sfx("good");
          lock = false;
          if (matched >= pairs) { F.audio.sfx("win"); finish(true); }
        }, 300);
      } else {
        setTimeout(function () {
          a.classList.remove("flipped"); b.classList.remove("flipped");
          lock = false;
        }, 680);
      }
    }

    timer = setInterval(function () {
      if (finished) return;
      left--;
      hudTime.textContent = String(Math.max(0, left));
      if (left <= 0) { F.audio.sfx("lose"); finish(false); }
    }, 1000);

    return {
      destroy: function () {
        finished = true;
        if (timer) clearInterval(timer);
        root.innerHTML = "";
      }
    };
  }

  window.ForestMiniGames = {
    catchGame: catchGame,
    memoryGame: memoryGame,
    start: function (root, kind, opts, done) {
      return kind === "memory" ? memoryGame(root, opts, done) : catchGame(root, opts, done);
    }
  };
})();
