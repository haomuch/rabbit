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


  /* ---------------- 口琴与和弦节奏小游戏（秋） ---------------- */
  function rhythmGame(root, opts, done) {
    opts = opts || {};
    var duration = opts.duration || 16;
    var target = opts.target || 8;
    var tempo = opts.tempo || 750; // 音符生成间隔 ms

    var score = 0, combo = 0, maxCombo = 0, finished = false;
    var timeLeft = duration, timer = null, spawnTimer = null, raf = null;
    var notes = []; // { el, progress, speed, hit, symbol }

    root.innerHTML =
      head("口琴合奏 · 伴奏 " + target + " 拍", '<span class="m-score">0</span> / ' + target, '<span class="m-time">' + duration + "</span>s") +
      '<div class="rhythm-field">' +
        '<div class="rhythm-combo" id="rhythmCombo">Combo 0</div>' +
        '<div class="rhythm-track">' +
          '<div class="rhythm-start-icon">🦊🎶</div>' +
          '<div class="rhythm-line"></div>' +
          '<div class="rhythm-hit-zone" id="hitZone">' +
            '<span class="hit-ring"></span>' +
            '<span class="hit-center">🐰</span>' +
          '</div>' +
        '</div>' +
        '<div class="rhythm-feedback" id="rhythmFeedback"></div>' +
        '<div class="rhythm-ctrl">' +
          '<button class="rhythm-btn" id="rhythmBtn" type="button">🎶 击节伴奏 (空格/轻触)</button>' +
        '</div>' +
      '</div>' +
      '<div class="mini-foot">等音符飘到光环中央时按下伴奏 · 敲满 ' + target + ' 拍就算过关</div>';

    var track = root.querySelector(".rhythm-track");
    var hitZone = root.querySelector("#hitZone");
    var hudScore = root.querySelector(".m-score");
    var hudTime = root.querySelector(".m-time");
    var comboEl = root.querySelector("#rhythmCombo");
    var feedbackEl = root.querySelector("#rhythmFeedback");
    var rhythmBtn = root.querySelector("#rhythmBtn");

    var trackWidth = track.clientWidth || 320;
    var symbols = ["🎶", "🍁", "✨", "🍂", "💛"];

    function showFeedback(text, cls) {
      if (!feedbackEl) return;
      feedbackEl.className = "rhythm-feedback " + cls;
      feedbackEl.textContent = text;
      setTimeout(function () {
        if (feedbackEl) feedbackEl.className = "rhythm-feedback";
      }, 500);
    }

    function spawnNote() {
      if (finished) return;
      var symbol = F.util.pick(symbols);
      var el = document.createElement("div");
      el.className = "rhythm-note";
      el.textContent = symbol;
      track.appendChild(el);

      var note = {
        el: el,
        pos: 0, // 0% 到 100%
        speed: 0.45, // 百分比 / 秒
        hit: false
      };
      notes.push(note);
    }

    function playChordTone(isPerfect) {
      // 模拟口琴与和弦清澈声响
      var baseFreq = isPerfect ? 659.25 : 523.25; // E5 或 C5
      F.audio.beep(baseFreq, 0.12, "triangle", 0.04);
      setTimeout(function () {
        F.audio.beep(baseFreq * 1.25, 0.16, "sine", 0.03);
      }, 40);
    }

    function triggerHit() {
      if (finished) return;
      hitZone.classList.add("pulse");
      setTimeout(function () { if (hitZone) hitZone.classList.remove("pulse"); }, 200);

      // 寻找最接近判定区的音符 (hit zone 位于 82% ~ 94% 区域)
      var targetZone = 88;
      var bestIdx = -1, minDiff = 999;
      for (var i = 0; i < notes.length; i++) {
        var n = notes[i];
        if (!n.hit) {
          var diff = Math.abs(n.pos - targetZone);
          if (diff < minDiff) { minDiff = diff; bestIdx = i; }
        }
      }

      if (bestIdx >= 0 && minDiff <= 12) {
        var hitNote = notes[bestIdx];
        hitNote.hit = true;
        hitNote.el.classList.add("hit-success");
        var isPerfect = minDiff <= 6;
        score++;
        combo++;
        if (combo > maxCombo) maxCombo = combo;
        hudScore.textContent = String(score);
        comboEl.textContent = "Combo " + combo;
        comboEl.classList.add("active");

        playChordTone(isPerfect);
        showFeedback(isPerfect ? "✨ 完美合奏 Perfect!" : "💛 好节拍 Good!", isPerfect ? "is-perfect" : "is-good");

        setTimeout(function () {
          if (hitNote.el.parentNode) hitNote.el.parentNode.removeChild(hitNote.el);
        }, 220);
      } else {
        combo = 0;
        comboEl.textContent = "Combo 0";
        comboEl.classList.remove("active");
        F.audio.sfx("bad");
        showFeedback("错过了 Miss", "is-miss");
      }
    }

    rhythmBtn.addEventListener("pointerdown", function (e) {
      e.preventDefault();
      triggerHit();
    });

    function onKey(e) {
      if (e.code === "Space" || e.key === " ") {
        e.preventDefault();
        triggerHit();
      }
    }
    window.addEventListener("keydown", onKey);

    var lastTs = 0;
    function loop(ts) {
      if (finished) return;
      if (!lastTs) lastTs = ts;
      var dt = Math.min((ts - lastTs) / 1000, 0.05);
      lastTs = ts;

      for (var i = notes.length - 1; i >= 0; i--) {
        var n = notes[i];
        if (!n.hit) {
          n.pos += n.speed * dt * 100;
          n.el.style.left = n.pos + "%";
          if (n.pos > 102) {
            // 超出屏幕未点击
            n.hit = true;
            if (n.el.parentNode) n.el.parentNode.removeChild(n.el);
            notes.splice(i, 1);
            if (combo > 0) {
              combo = 0;
              comboEl.textContent = "Combo 0";
              comboEl.classList.remove("active");
            }
          }
        }
      }

      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);

    spawnTimer = setInterval(spawnNote, tempo);

    timer = setInterval(function () {
      if (finished) return;
      timeLeft--;
      hudTime.textContent = String(Math.max(0, timeLeft));
      if (timeLeft <= 0) {
        finish();
      }
    }, 1000);

    function finish() {
      if (finished) return;
      finished = true;
      if (timer) clearInterval(timer);
      if (spawnTimer) clearInterval(spawnTimer);
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);

      notes.forEach(function (n) {
        if (n.el.parentNode) n.el.parentNode.removeChild(n.el);
      });
      notes = [];

      var win = score >= target;
      if (win) F.audio.sfx("win");
      else F.audio.sfx("lose");

      done({ win: win, score: score, target: target, maxCombo: maxCombo });
    }

    return {
      destroy: function () {
        finished = true;
        if (timer) clearInterval(timer);
        if (spawnTimer) clearInterval(spawnTimer);
        if (raf) cancelAnimationFrame(raf);
        window.removeEventListener("keydown", onKey);
        root.innerHTML = "";
      }
    };
  }
  window.ForestMiniGames = {
    catchGame: catchGame,
    memoryGame: memoryGame,
    rhythmGame: rhythmGame,
    start: function (root, kind, opts, done) {
      if (kind === "rhythm") return rhythmGame(root, opts, done);
      return kind === "memory" ? memoryGame(root, opts, done) : catchGame(root, opts, done);
    }
  };
})();
