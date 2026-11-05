/* =========================================================
   core.js · 共享核心
   Forest.util / Forest.storage / Forest.theme / Forest.audio / Forest.fx
   首页与游戏页共用，无任何外部依赖
   ========================================================= */
(function () {
  "use strict";

  var Forest = window.Forest = {};
  var THEME_KEY = "bunny-fox-theme";
  var SOUND_KEY = "forest.sound";
  var META_KEY = "forest.meta.v2";
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------- 工具 ---------------- */
  Forest.util = {
    clamp: function (v, a, b) { return Math.max(a, Math.min(b, v)); },
    pick: function (arr) { return arr[Math.floor(Math.random() * arr.length)]; },
    shuffle: function (arr) {
      var a = arr.slice();
      for (var i = a.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = a[i]; a[i] = a[j]; a[j] = t;
      }
      return a;
    },
    esc: function (s) {
      return String(s == null ? "" : s)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    },
    qs: function (sel, root) { return (root || document).querySelector(sel); },
    qsa: function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); },
    pad2: function (n) { return n < 10 ? "0" + n : String(n); },
    reduceMotion: reduceMotion
  };

  /* ---------------- 本地存储 ---------------- */
  function read(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch (e) { return fallback; }
  }
  function write(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; }
    catch (e) { return false; }
  }
  Forest.storage = {
    get: read,
    set: write,
    remove: function (key) { try { localStorage.removeItem(key); } catch (e) {} },
    metaKey: META_KEY
  };
  Forest.getMeta = function () {
    var m = read(META_KEY, null);
    if (!m || typeof m !== "object") m = {};
    if (!Array.isArray(m.endings)) m.endings = [];
    if (!Array.isArray(m.achievements)) m.achievements = [];
    if (typeof m.bestAff !== "number") m.bestAff = 0;
    if (typeof m.totalDays !== "number") m.totalDays = 0;
    if (typeof m.quizPerfect !== "boolean") m.quizPerfect = false;
    return m;
  };
  Forest.patchMeta = function (patch) {
    var m = Forest.getMeta();
    for (var k in patch) if (Object.prototype.hasOwnProperty.call(patch, k)) m[k] = patch[k];
    write(META_KEY, m);
    return m;
  };
  Forest.SAVE_KEY = "forest.save.v2";
  Forest.getSave = function (key) { return read(key, null); };

  /* ---------------- 昼夜主题 ---------------- */
  var theme = "day";
  try { theme = localStorage.getItem(THEME_KEY) || "day"; } catch (e) {}
  if (theme !== "night") theme = "day";

  Forest.theme = {
    current: function () { return theme; },
    apply: function (next) {
      theme = next === "night" ? "night" : "day";
      document.documentElement.setAttribute("data-theme", theme);
      try { localStorage.setItem(THEME_KEY, theme); } catch (e) {}
      var btn = document.getElementById("themeToggle");
      if (btn) {
        btn.textContent = theme === "night" ? "☀️" : "🌙";
        btn.setAttribute("aria-label", theme === "night" ? "切换到日间模式" : "切换到夜间模式");
      }
      window.dispatchEvent(new CustomEvent("forest:theme", { detail: { theme: theme } }));
    },
    toggle: function () { Forest.theme.apply(theme === "night" ? "day" : "night"); },
    init: function () {
      Forest.theme.apply(theme);
      var btn = document.getElementById("themeToggle");
      if (btn) btn.addEventListener("click", function () {
        Forest.theme.toggle();
        Forest.audio.sfx("tap");
      });
    }
  };

  /* ---------------- 音效（Web Audio） ---------------- */
  var soundOn = read(SOUND_KEY, false) === true;
  var audioCtx = null;

  function tone(freq, dur, type, vol, delay) {
    if (!soundOn) return;
    try {
      if (!audioCtx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        audioCtx = new AC();
      }
      if (audioCtx.state === "suspended") audioCtx.resume();
      var osc = audioCtx.createOscillator();
      var gain = audioCtx.createGain();
      osc.type = type || "sine";
      osc.frequency.value = freq || 520;
      var now = audioCtx.currentTime + (delay || 0);
      var v = vol == null ? 0.03 : vol;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(v, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + (dur || 0.08));
      osc.connect(gain); gain.connect(audioCtx.destination);
      osc.start(now); osc.stop(now + (dur || 0.08) + 0.02);
    } catch (e) { /* 静默失败 */ }
  }

  Forest.audio = {
    get enabled() { return soundOn; },
    beep: tone,
    sfx: function (name) {
      switch (name) {
        case "tap":   tone(620, 0.07, "sine", 0.028); break;
        case "page":  tone(520, 0.06, "sine", 0.024); tone(700, 0.06, "sine", 0.018, 0.06); break;
        case "good":  tone(660, 0.09, "sine", 0.035); tone(880, 0.12, "sine", 0.035, 0.09); break;
        case "great": tone(660, 0.09, "sine", 0.035); tone(880, 0.09, "sine", 0.035, 0.09); tone(1180, 0.18, "sine", 0.035, 0.18); break;
        case "bad":   tone(240, 0.16, "sawtooth", 0.025); break;
        case "win":   tone(523, 0.12, "sine", 0.035); tone(659, 0.12, "sine", 0.035, 0.12); tone(784, 0.22, "sine", 0.035, 0.24); break;
        case "lose":  tone(330, 0.14, "triangle", 0.03); tone(247, 0.22, "triangle", 0.03, 0.13); break;
        default:      tone(520, 0.07, "sine", 0.025);
      }
    },
    init: function () {
      var btn = document.getElementById("soundToggle");
      function paint() {
        if (!btn) return;
        btn.textContent = soundOn ? "🔊" : "🔇";
        btn.setAttribute("aria-label", soundOn ? "关闭音效" : "开启音效");
      }
      paint();
      if (btn) btn.addEventListener("click", function () {
        soundOn = !soundOn;
        write(SOUND_KEY, soundOn);
        paint();
        if (soundOn) tone(720, 0.09, "sine", 0.04);
      });
    }
  };

  /* ---------------- 视觉特效 ---------------- */
  var fx = {};

  fx.particles = function (canvasId) {
    var canvas = document.getElementById(canvasId);
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext("2d");
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0, H = 0, particles = [];
    var mouse = { x: -9999, y: -9999 };
    var night = Forest.theme.current() === "night";

    window.addEventListener("forest:theme", function (e) { night = e.detail.theme === "night"; });

    function makeParticle(init) {
      return {
        x: Math.random() * W,
        y: init ? Math.random() * H : H + 20,
        r: Math.random() * 2.2 + 0.6,
        vx: (Math.random() - 0.5) * 0.3,
        vy: -(Math.random() * 0.35 + 0.08),
        phase: Math.random() * Math.PI * 2,
        speed: Math.random() * 0.02 + 0.008,
        alpha: Math.random() * 0.5 + 0.25
      };
    }
    function initParticles() {
      var count = window.innerWidth < 768 ? 34 : 58;
      particles = [];
      for (var i = 0; i < count; i++) particles.push(makeParticle(true));
    }
    function resize() {
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = Math.floor(W * dpr); canvas.height = Math.floor(H * dpr);
      canvas.style.width = W + "px"; canvas.style.height = H + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      initParticles();
    }
    function draw() {
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        if (!reduceMotion) {
          p.x += p.vx; p.y += p.vy; p.phase += p.speed;
          var dx = p.x - mouse.x, dy = p.y - mouse.y, d2 = dx * dx + dy * dy;
          if (d2 < 32400 && d2 > 0) {
            var d = Math.sqrt(d2), force = (180 - d) / 180 * 0.55;
            p.x += (dx / d) * force; p.y += (dy / d) * force;
          }
        }
        if (p.y < -24 || p.x < -24 || p.x > W + 24) { particles[i] = makeParticle(false); continue; }
        var a = p.alpha * (0.5 + 0.5 * Math.sin(p.phase));
        if (night) {
          ctx.fillStyle = "rgba(255,214,140," + a.toFixed(3) + ")";
          ctx.shadowColor = "rgba(255,200,120,0.75)";
          ctx.shadowBlur = p.r * 6;
        } else {
          ctx.fillStyle = "rgba(224,150,80," + (a * 0.65).toFixed(3) + ")";
          ctx.shadowColor = "rgba(224,150,80,0.35)";
          ctx.shadowBlur = p.r * 3;
        }
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.shadowBlur = 0;
      requestAnimationFrame(draw);
    }
    resize(); draw();
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", function (e) { mouse.x = e.clientX; mouse.y = e.clientY; });
    window.addEventListener("mouseleave", function () { mouse.x = -9999; mouse.y = -9999; });
  };

  fx.cursorGlow = function (glowId) {
    var el = document.getElementById(glowId);
    if (!el || !window.matchMedia("(pointer: fine)").matches) return;
    var active = false, tx = 0, ty = 0, gx = 0, gy = 0;
    window.addEventListener("mousemove", function (e) {
      tx = e.clientX; ty = e.clientY;
      if (!active) { active = true; gx = tx; gy = ty; document.body.classList.add("has-pointer"); }
    });
    (function loop() {
      gx += (tx - gx) * 0.14; gy += (ty - gy) * 0.14;
      el.style.transform = "translate(" + gx.toFixed(1) + "px," + gy.toFixed(1) + "px)";
      requestAnimationFrame(loop);
    })();
  };

  fx.progress = function (progressId) {
    var el = document.getElementById(progressId);
    if (!el) return;
    function update() {
      var doc = document.documentElement;
      var max = doc.scrollHeight - doc.clientHeight;
      el.style.width = (max > 0 ? doc.scrollTop / max * 100 : 0).toFixed(2) + "%";
    }
    window.addEventListener("scroll", update, { passive: true });
    update();
  };

  fx.reveal = function () {
    var els = Forest.util.qsa(".reveal");
    if (!("IntersectionObserver" in window)) {
      els.forEach(function (el) { el.classList.add("is-visible"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add("is-visible"); io.unobserve(entry.target); }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    els.forEach(function (el) { io.observe(el); });
  };

  fx.initAll = function (opts) {
    opts = opts || {};
    Forest.theme.init();
    Forest.audio.init();
    fx.particles(opts.canvas || "bgCanvas");
    fx.cursorGlow(opts.glow || "cursorGlow");
    fx.progress(opts.progress || "scrollProgress");
    fx.reveal();
  };

  Forest.fx = fx;
})();
