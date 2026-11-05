/* =========================================================
   art.js · 角色与装饰 SVG
   两个角色各有 5 种表情：normal / happy / shy / sleep / love
   表情靠眼睛、嘴和脸外的小装饰区分，脸颊只保留角色自带的淡腮红
   ========================================================= */
(function () {
  "use strict";

  /* 状态小装饰（两个角色共用） */
  var SPARKS =
    '<path d="M44 85 L46 90 L51 92 L46 94 L44 99 L42 94 L37 92 L42 90 Z" fill="#f3c66a" opacity="0.9"/>' +
    '<path d="M156 85 L158 90 L163 92 L158 94 L156 99 L154 94 L149 92 L154 90 Z" fill="#f3c66a" opacity="0.9"/>';
  var DOZY =
    '<circle cx="156" cy="86" r="2.2" fill="#c9b6a4" opacity="0.85"/>' +
    '<circle cx="163" cy="76" r="3" fill="#c9b6a4" opacity="0.7"/>' +
    '<circle cx="171" cy="64" r="3.8" fill="#c9b6a4" opacity="0.55"/>';
  var SWEAT =
    '<path d="M158 88 C162 94 164 98 161 101 C158 104 154 101 155 97 Z" fill="#a8cfe4" opacity="0.9"/>';
  /* 心动：飘在头两侧的小爱心 */
  var LITTLE_HEARTS =
    '<path d="M30 46 C27 42 22 44 23 49 C24 53 28 56 30 58 C32 56 36 53 37 49 C38 44 33 42 30 46 Z" fill="#f2a5a5" opacity="0.8"/>' +
    '<path d="M170 46 C167 42 162 44 163 49 C164 53 168 56 170 58 C172 56 176 53 177 49 C178 44 173 42 170 46 Z" fill="#f2a5a5" opacity="0.8"/>';

  /* ---------- 小兔子 ---------- */
  var BUNNY_MOUTH =
    '<path d="M100 132 q-6 8 -12 4" stroke="#c98b6e" stroke-width="2.5" fill="none" stroke-linecap="round"/>' +
    '<path d="M100 132 q6 8 12 4" stroke="#c98b6e" stroke-width="2.5" fill="none" stroke-linecap="round"/>';
  var BUNNY_OPEN_MOUTH =
    '<path d="M90 133 Q100 145 110 133 Z" fill="#c98b6e"/>' +
    '<path d="M95 138 Q100 143 105 138 Z" fill="#ef9d9d" opacity="0.85"/>';

  var BUNNY_FACES = {
    normal:
      '<circle cx="82" cy="112" r="6" fill="#5a4636"/>' +
      '<circle cx="118" cy="112" r="6" fill="#5a4636"/>' +
      '<circle cx="84" cy="110" r="2" fill="#fff"/>' +
      '<circle cx="120" cy="110" r="2" fill="#fff"/>' +
      BUNNY_MOUTH,
    happy:
      '<path d="M75 115 q7 -12 14 0" stroke="#5a4636" stroke-width="3.4" fill="none" stroke-linecap="round"/>' +
      '<path d="M111 115 q7 -12 14 0" stroke="#5a4636" stroke-width="3.4" fill="none" stroke-linecap="round"/>' +
      BUNNY_OPEN_MOUTH + SPARKS,
    shy:
      /* 眼睛微微内收、高光偏下：视线躲闪，不靠脸颊色块 */
      '<circle cx="84" cy="113" r="5.2" fill="#5a4636"/>' +
      '<circle cx="116" cy="113" r="5.2" fill="#5a4636"/>' +
      '<circle cx="82.5" cy="115" r="1.9" fill="#fff"/>' +
      '<circle cx="114.5" cy="115" r="1.9" fill="#fff"/>' +
      '<path d="M74 100 Q82 98 90 96" stroke="#c99a86" stroke-width="2.6" fill="none" stroke-linecap="round"/>' +
      '<path d="M110 96 Q118 98 126 100" stroke="#c99a86" stroke-width="2.6" fill="none" stroke-linecap="round"/>' +
      '<path d="M93 134 Q100 139 107 134" stroke="#c98b6e" stroke-width="2.4" fill="none" stroke-linecap="round"/>' +
      SWEAT,
    sleep:
      '<path d="M75 112 q7 9 14 0" stroke="#5a4636" stroke-width="3.2" fill="none" stroke-linecap="round"/>' +
      '<path d="M111 112 q7 9 14 0" stroke="#5a4636" stroke-width="3.2" fill="none" stroke-linecap="round"/>' +
      '<ellipse cx="100" cy="135" rx="3.2" ry="2.4" fill="#c98b6e" opacity="0.9"/>' +
      DOZY,
    love:
      '<circle cx="82" cy="112" r="6.8" fill="#5a4636"/>' +
      '<circle cx="118" cy="112" r="6.8" fill="#5a4636"/>' +
      '<circle cx="84" cy="109.5" r="2.6" fill="#fff"/>' +
      '<circle cx="120" cy="109.5" r="2.6" fill="#fff"/>' +
      '<circle cx="80" cy="115" r="1.3" fill="#fff" opacity="0.8"/>' +
      '<circle cx="116" cy="115" r="1.3" fill="#fff" opacity="0.8"/>' +
      BUNNY_OPEN_MOUTH + LITTLE_HEARTS +
      '<path d="M100 52 C94 46 86 49 88 56 C89 61 96 65 100 69 C104 65 111 61 112 56 C114 49 106 46 100 52 Z" fill="#f2a5a5" opacity="0.95"/>'
  };

  /* ---------- 小狐狸 ---------- */
  var FOX_BROWS =
    '<path d="M70 89 Q78 84 87 90" stroke="#c96a32" stroke-width="2.4" fill="none" stroke-linecap="round" opacity="0.85"/>' +
    '<path d="M113 90 Q122 84 130 89" stroke="#c96a32" stroke-width="2.4" fill="none" stroke-linecap="round" opacity="0.85"/>';
  var FOX_BROWS_SHY =
    '<path d="M70 91 Q78 88 87 86" stroke="#c96a32" stroke-width="2.4" fill="none" stroke-linecap="round" opacity="0.85"/>' +
    '<path d="M113 86 Q122 88 130 91" stroke="#c96a32" stroke-width="2.4" fill="none" stroke-linecap="round" opacity="0.85"/>';
  var FOX_ROUND_EYES =
    '<ellipse cx="78" cy="100" rx="5.8" ry="7.2" fill="#4a372c"/>' +
    '<ellipse cx="122" cy="100" rx="5.8" ry="7.2" fill="#4a372c"/>' +
    '<circle cx="80" cy="97.5" r="2.5" fill="#fff"/>' +
    '<circle cx="124" cy="97.5" r="2.5" fill="#fff"/>' +
    '<circle cx="76" cy="103" r="1.1" fill="#fff" opacity="0.65"/>' +
    '<circle cx="120" cy="103" r="1.1" fill="#fff" opacity="0.65"/>';
  /* 害羞时眼睛内收、高光偏下：视线躲闪 */
  var FOX_DOWN_EYES =
    '<ellipse cx="80" cy="101" rx="5" ry="6.2" fill="#4a372c"/>' +
    '<ellipse cx="120" cy="101" rx="5" ry="6.2" fill="#4a372c"/>' +
    '<circle cx="79" cy="103" r="2" fill="#fff"/>' +
    '<circle cx="119" cy="103" r="2" fill="#fff"/>';
  var FOX_MOUTH =
    '<path d="M100 135 L100 138 M100 138 Q94 144 88 139 M100 138 Q106 144 112 139" ' +
      'stroke="#4a372c" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>';
  var FOX_OPEN_MOUTH =
    '<path d="M90 138 Q100 150 110 138 Z" fill="#4a372c"/>' +
    '<path d="M95 144 Q100 149 105 144 Z" fill="#e88f86" opacity="0.9"/>';

  var FOX_FACES = {
    normal: FOX_ROUND_EYES + FOX_BROWS + FOX_MOUTH,
    happy:
      '<path d="M71 101 Q78 89 86 101" stroke="#4a372c" stroke-width="3.6" fill="none" stroke-linecap="round"/>' +
      '<path d="M114 101 Q122 89 129 101" stroke="#4a372c" stroke-width="3.6" fill="none" stroke-linecap="round"/>' +
      FOX_BROWS + FOX_OPEN_MOUTH + SPARKS,
    shy:
      FOX_DOWN_EYES + FOX_BROWS_SHY +
      '<path d="M93 139 Q100 143 107 139" stroke="#4a372c" stroke-width="2.2" fill="none" stroke-linecap="round"/>' +
      SWEAT,
    sleep:
      '<path d="M71 99 Q78 108 86 99" stroke="#4a372c" stroke-width="3.2" fill="none" stroke-linecap="round"/>' +
      '<path d="M114 99 Q122 108 129 99" stroke="#4a372c" stroke-width="3.2" fill="none" stroke-linecap="round"/>' +
      '<ellipse cx="100" cy="140" rx="3" ry="2.2" fill="#4a372c" opacity="0.9"/>' +
      DOZY,
    love:
      '<ellipse cx="78" cy="100" rx="6.6" ry="8" fill="#4a372c"/>' +
      '<ellipse cx="122" cy="100" rx="6.6" ry="8" fill="#4a372c"/>' +
      '<circle cx="80" cy="97" r="2.8" fill="#fff"/>' +
      '<circle cx="124" cy="97" r="2.8" fill="#fff"/>' +
      '<circle cx="76" cy="103" r="1.3" fill="#fff" opacity="0.8"/>' +
      '<circle cx="120" cy="103" r="1.3" fill="#fff" opacity="0.8"/>' +
      FOX_BROWS + FOX_OPEN_MOUTH + LITTLE_HEARTS +
      '<path d="M100 32 C94 26 86 29 88 36 C89 41 96 45 100 49 C104 45 111 41 112 36 C114 29 106 26 100 32 Z" fill="#f2a5a5" opacity="0.95"/>'
  };

  function bunny(mood) {
    var face = BUNNY_FACES[mood] || BUNNY_FACES.normal;
    return '' +
      '<svg viewBox="0 0 200 220" role="img" aria-label="小兔子" xmlns="http://www.w3.org/2000/svg">' +
        '<ellipse cx="78" cy="48" rx="15" ry="40" fill="#f7e4d8" transform="rotate(-8 78 48)"/>' +
        '<ellipse cx="122" cy="48" rx="15" ry="40" fill="#f7e4d8" transform="rotate(8 122 48)"/>' +
        '<ellipse cx="78" cy="52" rx="7" ry="27" fill="#f2c6c6" transform="rotate(-8 78 52)"/>' +
        '<ellipse cx="122" cy="52" rx="7" ry="27" fill="#f2c6c6" transform="rotate(8 122 52)"/>' +
        '<ellipse cx="100" cy="172" rx="56" ry="46" fill="#f7e4d8"/>' +
        '<ellipse cx="100" cy="176" rx="30" ry="28" fill="#fdf0e6"/>' +
        '<circle cx="100" cy="118" r="52" fill="#fdf0e6"/>' +
        '<circle cx="68" cy="132" r="9" fill="#f7c8c8" opacity="0.7"/>' +
        '<circle cx="132" cy="132" r="9" fill="#f7c8c8" opacity="0.7"/>' +
        face +
        '<ellipse cx="100" cy="128" rx="5" ry="4" fill="#e8a0a0"/>' +
        '<line x1="60" y1="124" x2="42" y2="120" stroke="#d8c4b4" stroke-width="2" stroke-linecap="round"/>' +
        '<line x1="60" y1="132" x2="42" y2="134" stroke="#d8c4b4" stroke-width="2" stroke-linecap="round"/>' +
        '<line x1="140" y1="124" x2="158" y2="120" stroke="#d8c4b4" stroke-width="2" stroke-linecap="round"/>' +
        '<line x1="140" y1="132" x2="158" y2="134" stroke="#d8c4b4" stroke-width="2" stroke-linecap="round"/>' +
      '</svg>';
  }

  function fox(mood) {
    var face = FOX_FACES[mood] || FOX_FACES.normal;
    return '' +
      '<svg viewBox="0 0 200 220" role="img" aria-label="小狐狸" xmlns="http://www.w3.org/2000/svg">' +
        /* 蓬松大尾巴：深橙底 + 亮橙主体 + 奶白尾尖 */
        '<g transform="rotate(45 143 170)">' +
          '<ellipse cx="143" cy="158" rx="27" ry="48" fill="#d96b30"/>' +
          '<ellipse cx="143" cy="155" rx="22" ry="43" fill="#ef8a45"/>' +
          '<path d="M143 105 C156 107 163 117 162 129 C161 140 152 145 143 145 ' +
            'C134 145 125 140 124 129 C123 117 130 107 143 105 Z" fill="#f6d9bd"/>' +
          '<path d="M143 108 C154 110 160 118 159 128 C158 137 151 142 143 142 ' +
            'C135 142 128 137 127 128 C126 118 132 110 143 108 Z" fill="#fff5ec"/>' +
          '<path d="M126 132 Q132 126 138 133 Q143 126 149 133 Q155 127 160 132 ' +
            'Q159 145 143 146 Q127 145 126 132 Z" fill="#ef8a45"/>' +
        '</g>' +
        /* 后脚与身体 */
        '<ellipse cx="78" cy="207" rx="15" ry="8" fill="#d9682c"/>' +
        '<ellipse cx="122" cy="207" rx="15" ry="8" fill="#d9682c"/>' +
        '<ellipse cx="100" cy="172" rx="49" ry="45" fill="#ec8341"/>' +
        '<ellipse cx="100" cy="180" rx="28" ry="30" fill="#fff5ec"/>' +
        /* 耳朵：外层橙、粉色内耳、耳尖阴影 */
        '<path d="M62 80 C56 60 52 36 50 18 C70 30 88 44 96 62 Z" fill="#ec8341"/>' +
        '<path d="M138 80 C144 60 148 36 150 18 C130 30 112 44 104 62 Z" fill="#ec8341"/>' +
        '<path d="M62 72 C58 56 55 40 54 30 C69 40 81 50 88 62 Z" fill="#f4b7a4"/>' +
        '<path d="M138 72 C142 56 145 40 146 30 C131 40 119 50 112 62 Z" fill="#f4b7a4"/>' +
        '<path d="M54 30 C58 38 63 45 68 50 C62 47 57 40 54 30 Z" fill="#e89a8c" opacity="0.7"/>' +
        '<path d="M146 30 C142 38 137 45 132 50 C138 47 143 40 146 30 Z" fill="#e89a8c" opacity="0.7"/>' +
        /* 头部轮廓：上宽下收的圆润狐狸脸 */
        '<path d="M100 56 C128 56 150 70 152 96 C153 123 132 150 100 150 ' +
          'C68 150 47 123 48 96 C50 70 72 56 100 56 Z" fill="#ec8341"/>' +
        '<ellipse cx="62" cy="106" rx="10" ry="16" fill="#f6a05c" opacity="0.4"/>' +
        '<ellipse cx="138" cy="106" rx="10" ry="16" fill="#f6a05c" opacity="0.4"/>' +
        '<ellipse cx="100" cy="67" rx="30" ry="8" fill="#f6a05c" opacity="0.35"/>' +
        /* 眉心一撮细白毛 */
        '<path d="M100 70 C104 78 106 86 104 93 C102 89 100 87 100 87 ' +
          'C100 87 98 89 96 93 C94 86 96 78 100 70 Z" fill="#fff5ec" opacity="0.9"/>' +
        /* 心形白色吻部，向下收成尖下巴 */
        '<path d="M100 108 C108 100 116 102 122 110 C130 120 128 134 116 143 ' +
          'C108 148 92 148 84 143 C72 134 70 120 78 110 C84 102 92 100 100 108 Z" fill="#fff5ec"/>' +
        '<path d="M88 142 Q100 148 112 142" stroke="#f2ded0" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.7"/>' +
        '<ellipse cx="60" cy="116" rx="9" ry="5" fill="#f0a08f" opacity="0.45"/>' +
        '<ellipse cx="140" cy="116" rx="9" ry="5" fill="#f0a08f" opacity="0.45"/>' +
        /* 五官：表情图层 + 固定的小鼻子 */
        face +
        '<path d="M95 129 Q100 127 105 129 Q105 133 100 135 Q95 133 95 129 Z" fill="#4a372c"/>' +
        '<ellipse cx="98.5" cy="129.5" rx="1.6" ry="1" fill="#fff" opacity="0.3"/>' +
      '</svg>';
  }

  var DECOR = {
    spring: ["🌸", "🍃", "🌷", "💛", "🌸", "🍃"],
    summer: ["☀️", "💧", "🍃", "🐟", "✨", "💧"],
    autumn: ["🍁", "🍂", "🌰", "🍯", "🍁", "🍂"],
    winter: ["❄️", "✨", "❄️", "⭐", "❄️", "✨"]
  };

  window.ForestArt = {
    bunny: bunny,
    fox: fox,
    get: function (who, mood) { return who === "fox" ? fox(mood) : bunny(mood); },
    heart: function (size) {
      var s = size || 40;
      return '<svg viewBox="0 0 60 60" width="' + s + '" height="' + s + '" aria-hidden="true">' +
        '<path d="M30 50 C10 36 4 24 12 16 C18 10 27 12 30 20 C33 12 42 10 48 16 C56 24 50 36 30 50 Z" fill="#f2a5a5"/></svg>';
    },
    scene: function (season) {
      var list = DECOR[season] || DECOR.spring;
      var html = "";
      for (var i = 0; i < list.length; i++) {
        var left = 6 + (i * 17 + (i % 3) * 5) % 88;
        var delay = (i * 0.7).toFixed(1);
        var dur = (6 + (i % 4) * 1.3).toFixed(1);
        html += '<span class="scene-float" style="left:' + left + '%;animation-delay:-' + delay + 's;animation-duration:' + dur + 's">' + list[i] + '</span>';
      }
      return html;
    }
  };
})();

