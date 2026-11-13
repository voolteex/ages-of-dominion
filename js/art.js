/* =========================================================================
 * Авторская векторная графика (SVG): логотип, персонажи, портреты, иконки,
 * карта. Единый стиль «геральдическая миниатюра»: пергамент, золото,
 * чернильный контур 2px, плоские заливки с мягким градиентом.
 * ========================================================================= */
(function (root) {
  const RF = (root.RF = root.RF || {});
  const INK = '#2b1d14';
  const GOLD = '#d4a537';
  const GOLD_D = '#9c7420';
  const SKIN = '#f2c7a0';

  let uid = 0;
  const nid = (p) => `${p}${++uid}`;

  // ---------------------------------------------------------------- ЛОГОТИП
  function logo(size) {
    const g = nid('lg');
    return `<svg class="logo-emblem" width="${size || 160}" height="${(size || 160) * 1.15}" viewBox="0 0 200 230" xmlns="http://www.w3.org/2000/svg" aria-label="Ages of Dominion">
      <defs>
        <linearGradient id="${g}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8b2532"/><stop offset="1" stop-color="#4a0f18"/></linearGradient>
        <linearGradient id="${g}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6d77a"/><stop offset="1" stop-color="${GOLD_D}"/></linearGradient>
        <linearGradient id="${g}i" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c8cfd8"/><stop offset="1" stop-color="#6b7480"/></linearGradient>
      </defs>
      <path d="M100 40 L176 62 C176 140 150 186 100 214 C50 186 24 140 24 62 Z" fill="url(#${g}s)" stroke="${INK}" stroke-width="5"/>
      <path d="M100 52 L164 70 C163 136 142 174 100 199 C58 174 37 136 36 70 Z" fill="none" stroke="url(#${g}g)" stroke-width="4"/>
      <!-- Наковальня -->
      <path d="M52 112 H140 C140 124 128 130 116 132 L112 150 H128 V162 H72 V150 H88 L84 132 C70 130 60 124 52 112 Z" fill="url(#${g}i)" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
      <path d="M140 112 C152 112 160 108 164 102 C154 104 146 104 140 104 Z" fill="url(#${g}i)" stroke="${INK}" stroke-width="3"/>
      <!-- Молот -->
      <g transform="rotate(-35 100 100)"><path d="M96 70 H104 V128 H96 Z" fill="#8a5a33" stroke="${INK}" stroke-width="3"/><path d="M80 60 H120 V78 H80 Z" fill="url(#${g}i)" stroke="${INK}" stroke-width="3.5"/></g>
      <!-- Искры -->
      <g fill="#ffcf5a" stroke="${INK}" stroke-width="1.2"><path d="M146 92 l4 -8 l2 9z"/><path d="M58 98 l-6 -6 l9 2z"/><path d="M128 88 l6 -9 l1 10z"/></g>
      <!-- Корона -->
      <path d="M52 44 L46 6 L72 28 L86 0 L100 24 L114 0 L128 28 L154 6 L148 44 Z" fill="url(#${g}g)" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
      <path d="M50 44 L150 44 L148 58 L52 58 Z" fill="url(#${g}g)" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
      <circle cx="76" cy="51" r="4.5" fill="#c0392b" stroke="${INK}" stroke-width="1.5"/>
      <circle cx="100" cy="51" r="5" fill="#2e86de" stroke="${INK}" stroke-width="1.5"/>
      <circle cx="124" cy="51" r="4.5" fill="#27ae60" stroke="${INK}" stroke-width="1.5"/>
    </svg>`;
  }

  // ------------------------------------------------- ГЛАВНЫЙ ГЕРОЙ: КОРОЛЬ
  /** Правитель: 4 визуальных состояния — idle, action, damage, victory. */
  function king(opts) {
    opts = opts || {};
    const robe = opts.robe || '#2f5d9e';
    const robeD = opts.robeDark || '#1d3b66';
    const g = nid('k');
    const hand = (x, y) => `<path d="M${x - 7} ${y - 3} C${x - 9} ${y + 5} ${x - 3} ${y + 9} ${x + 2} ${y + 8} C${x + 8} ${y + 6} ${x + 8} ${y - 2} ${x + 4} ${y - 6} C${x} ${y - 9} ${x - 5} ${y - 7} ${x - 7} ${y - 3} Z" fill="${SKIN}" stroke="${INK}" stroke-width="2"/>`;
    const spots = [[80, 118], [92, 126], [104, 130], [118, 130], [130, 126], [142, 118], [86, 112], [136, 112]]
      .map(([x, y]) => `<path d="M${x} ${y} l2 5 l2 -5 q-2 1.5 -4 0z" fill="${INK}"/>`).join('');
    return `<svg class="king" data-state="${opts.state || 'idle'}" viewBox="0 0 220 280" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Правитель">
      <defs>
        <linearGradient id="${g}r" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${robe}"/><stop offset="1" stop-color="${robeD}"/></linearGradient>
        <linearGradient id="${g}c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8f2635"/><stop offset="1" stop-color="#4d1018"/></linearGradient>
        <linearGradient id="${g}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f8dc84"/><stop offset="1" stop-color="${GOLD_D}"/></linearGradient>
        <linearGradient id="${g}b" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e9eef5"/><stop offset=".5" stop-color="#ffffff"/><stop offset="1" stop-color="#9aa7b8"/></linearGradient>
      </defs>
      <ellipse cx="110" cy="270" rx="72" ry="7" fill="#00000030"/>
      <g class="k-body">
        <path d="M66 118 C46 170 36 220 30 262 Q110 276 190 262 C184 220 174 170 154 118 Z" fill="url(#${g}c)" stroke="${INK}" stroke-width="2.5"/>
        <path d="M33 255 Q110 270 187 255" stroke="url(#${g}g)" stroke-width="5" fill="none"/>
        <path d="M80 246 L80 262 Q70 264 66 271 L97 271 L97 246 Z" fill="#4a2e1c" stroke="${INK}" stroke-width="2"/>
        <path d="M140 246 L140 262 Q150 264 154 271 L123 271 L123 246 Z" fill="#4a2e1c" stroke="${INK}" stroke-width="2"/>
        <path d="M74 122 C64 170 60 215 58 254 Q110 264 162 254 C160 215 156 170 146 122 Q110 108 74 122 Z" fill="url(#${g}r)" stroke="${INK}" stroke-width="2.5"/>
        <path d="M104 124 L98 257 Q110 259 122 257 L116 124 Z" fill="url(#${g}g)" stroke="${GOLD_D}" stroke-width="1.5"/>
        <path d="M100 150 l10 -6 l10 6 l-10 6 z M99 205 l11 -6 l11 6 l-11 6 z" fill="#c0392b" stroke="${INK}" stroke-width="1.2"/>
        <path d="M67 182 Q110 193 153 182 L154 195 Q110 206 66 195 Z" fill="#5a3520" stroke="${INK}" stroke-width="2"/>
        <path d="M102 186 h16 v12 h-16 z" fill="url(#${g}g)" stroke="${INK}" stroke-width="1.5" rx="2"/>
        <path d="M62 128 Q110 162 158 128 Q154 102 110 104 Q66 102 62 128 Z" fill="#f6f1e6" stroke="${INK}" stroke-width="2.5"/>
        ${spots}
      </g>
      <!-- Руки: idle -->
      <g class="st st-idle">
        <path d="M74 128 C64 150 61 172 65 192 L81 192 C80 172 82 152 88 134 Z" fill="url(#${g}r)" stroke="${INK}" stroke-width="2.2"/>
        <path d="M71 140 L71 240" stroke="${INK}" stroke-width="7" stroke-linecap="round"/><path d="M71 140 L71 240" stroke="url(#${g}g)" stroke-width="4" stroke-linecap="round"/>
        <circle cx="71" cy="134" r="8" fill="url(#${g}g)" stroke="${INK}" stroke-width="2"/><path d="M71 122 v-8 M67 118 h8" stroke="${INK}" stroke-width="2.5"/>
        ${hand(73, 196)}
        <path d="M146 128 C156 150 159 172 155 192 L139 192 C140 172 138 152 132 134 Z" fill="url(#${g}r)" stroke="${INK}" stroke-width="2.2"/>
        <path d="M150 204 L162 252 L170 250 L158 202 Z" fill="#5a3520" stroke="${INK}" stroke-width="2"/>
        <path d="M140 200 L162 194" stroke="url(#${g}g)" stroke-width="6" stroke-linecap="round"/>
        ${hand(148, 196)}
      </g>
      <!-- Руки: action (меч поднят) -->
      <g class="st st-action">
        <path d="M76 128 C60 140 49 150 40 158 L49 169 C59 161 71 151 86 138 Z" fill="url(#${g}r)" stroke="${INK}" stroke-width="2.2"/>
        ${hand(42, 164)}
        <path d="M164 66 L177 2 L184 6 L172 68 Z" fill="url(#${g}b)" stroke="${INK}" stroke-width="2"/>
        <path d="M154 72 L184 62" stroke="${INK}" stroke-width="9" stroke-linecap="round"/><path d="M154 72 L184 62" stroke="url(#${g}g)" stroke-width="5.5" stroke-linecap="round"/>
        <path d="M144 128 C160 116 170 96 172 78 L159 74 C156 92 148 106 135 117 Z" fill="url(#${g}r)" stroke="${INK}" stroke-width="2.2"/>
        ${hand(166, 74)}
        <path class="slash" d="M196 20 Q214 70 190 120" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" opacity=".8"/>
      </g>
      <!-- Руки: damage -->
      <g class="st st-damage">
        <path d="M146 128 C151 150 147 168 133 175 L128 164 C138 158 140 146 135 134 Z" fill="url(#${g}r)" stroke="${INK}" stroke-width="2.2"/>
        ${hand(128, 170)}
        <path d="M76 128 C64 112 72 92 86 80 L95 88 C85 98 82 112 87 132 Z" fill="url(#${g}r)" stroke="${INK}" stroke-width="2.2"/>
        ${hand(91, 82)}
      </g>
      <!-- Руки: victory -->
      <g class="st st-victory">
        <path d="M76 128 C62 112 56 92 54 72 L67 70 C69 88 75 104 87 118 Z" fill="url(#${g}r)" stroke="${INK}" stroke-width="2.2"/>
        ${hand(60, 66)}
        <path d="M144 128 C158 112 164 92 166 72 L153 70 C151 88 145 104 133 118 Z" fill="url(#${g}r)" stroke="${INK}" stroke-width="2.2"/>
        ${hand(160, 66)}
        <g class="sparkles" fill="#f8dc84" stroke="${GOLD_D}" stroke-width="1">
          <path d="M40 40 l3 8 l8 3 l-8 3 l-3 8 l-3 -8 l-8 -3 l8 -3 z"/><path d="M182 36 l2.5 6 l6 2.5 l-6 2.5 l-2.5 6 l-2.5 -6 l-6 -2.5 l6 -2.5 z"/>
          <path d="M28 100 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 l5 -2 z"/><path d="M196 96 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 l5 -2 z"/>
        </g>
      </g>
      <!-- Голова -->
      <g class="k-head">
        <path d="M82 66 C80 40 92 24 110 24 C128 24 140 40 138 66 L134 72 C132 50 124 42 110 42 C96 42 88 50 86 72 Z" fill="#6b3f22" stroke="${INK}" stroke-width="2"/>
        <path d="M84 62 q-7 0 -6 8 q1 7 7 6 M136 62 q7 0 6 8 q-1 7 -7 6" fill="${SKIN}" stroke="${INK}" stroke-width="2"/>
        <path d="M84 66 C84 42 96 32 110 32 C124 32 136 42 136 66 C136 88 126 100 110 100 C94 100 84 88 84 66 Z" fill="${SKIN}" stroke="${INK}" stroke-width="2.5"/>
        <path d="M86 50 C92 40 100 38 110 38 C120 38 128 40 134 50 C126 46 118 45 110 45 C102 45 94 46 86 50 Z" fill="#6b3f22"/>
        <ellipse cx="95" cy="76" rx="5" ry="3" fill="#e8907a" opacity=".45"/><ellipse cx="125" cy="76" rx="5" ry="3" fill="#e8907a" opacity=".45"/>
        <path d="M86 72 C88 100 98 118 110 122 C122 118 132 100 134 72 C128 86 120 93 110 93 C100 93 92 86 86 72 Z" fill="#7a4828" stroke="${INK}" stroke-width="2"/>
        <path d="M110 64 Q105 76 108 79 Q112 80 114 77" fill="none" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/>
        <!-- лица по состояниям -->
        <g class="st st-idle">
          <path d="M93 56 Q99 52 105 56 M115 56 Q121 52 127 56" stroke="${INK}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
          <ellipse cx="99" cy="64" rx="3.2" ry="3.8" fill="${INK}"/><ellipse cx="121" cy="64" rx="3.2" ry="3.8" fill="${INK}"/>
          <circle cx="100" cy="62.5" r="1.1" fill="#fff"/><circle cx="122" cy="62.5" r="1.1" fill="#fff"/>
          <path d="M104 90 Q110 94 116 90" stroke="${INK}" stroke-width="2" fill="none" stroke-linecap="round"/>
        </g>
        <g class="st st-action">
          <path d="M92 53 L106 58 M128 53 L114 58" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/>
          <ellipse cx="99" cy="64" rx="3" ry="3.4" fill="${INK}"/><ellipse cx="121" cy="64" rx="3" ry="3.4" fill="${INK}"/>
          <path d="M102 88 Q110 100 118 88 Q110 92 102 88 Z" fill="#7a1f2b" stroke="${INK}" stroke-width="1.5"/>
        </g>
        <g class="st st-damage">
          <path d="M93 57 L105 52 M127 57 L115 52" stroke="${INK}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
          <path d="M95 61 L103 64 L95 67 M125 61 L117 64 L125 67" stroke="${INK}" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M101 91 Q105.5 87 110 91 Q114.5 95 119 91" stroke="${INK}" stroke-width="2" fill="none" stroke-linecap="round"/>
          <path d="M140 44 Q146 54 140 58 Q134 54 140 44 Z" fill="#8fd3ff" stroke="${INK}" stroke-width="1.3"/>
        </g>
        <g class="st st-victory">
          <path d="M93 53 Q99 48 105 52 M115 52 Q121 48 127 53" stroke="${INK}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
          <path d="M95 65 Q99 59 103 65 M117 65 Q121 59 125 65" stroke="${INK}" stroke-width="2.8" fill="none" stroke-linecap="round"/>
          <path d="M100 87 Q110 101 120 87 Q110 91 100 87 Z" fill="#7a1f2b" stroke="${INK}" stroke-width="1.5"/>
        </g>
        <path d="M95 85 Q102.5 79 110 83 Q117.5 79 125 85 Q117 89 110 87 Q103 89 95 85 Z" fill="#5c331b" stroke="${INK}" stroke-width="1.5"/>
        <!-- Корона -->
        <g class="k-crown">
          <path d="M87 38 L84 14 L97 27 L104 7 L110 24 L116 7 L123 27 L136 14 L133 38 Z" fill="url(#${g}g)" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>
          <path d="M86 36 L134 36 L132 46 L88 46 Z" fill="url(#${g}g)" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>
          <circle cx="98" cy="41" r="2.6" fill="#c0392b" stroke="${INK}"/><circle cx="110" cy="41" r="3" fill="#2e86de" stroke="${INK}"/><circle cx="122" cy="41" r="2.6" fill="#27ae60" stroke="${INK}"/>
        </g>
      </g>
    </svg>`;
  }

  // ------------------------------------------------------ ПОРТРЕТЫ (БЮСТ)
  const PORTRAITS = {
    player: { skin: SKIN, hair: '#6b3f22', hairStyle: 'short', beard: 'full', head: 'crown', cloth: '#2f5d9e', trim: GOLD, bg: '#dfe8f5' },
    valmira: { skin: '#f4d2b8', hair: '#9b4a22', hairStyle: 'bun', beard: 'none', head: 'corno', cloth: '#23877a', trim: '#f2e6c9', bg: '#d6efe9', female: true, extra: 'pearls' },
    khanate: { skin: '#c98d5a', hair: '#1d1410', hairStyle: 'topknot', beard: 'mustache', head: 'furhat', cloth: '#b23a2a', trim: GOLD, bg: '#f5dcd2', extra: 'earring' },
    morven: { skin: '#efd2c0', hair: '#b9bcc4', hairStyle: 'short', beard: 'longbraid', head: 'circlet', cloth: '#56688f', trim: '#cfd6e2', bg: '#dde3ee', extra: 'fur' },
    sylvaria: { skin: '#d8ad84', hair: '#2a2a1e', hairStyle: 'long', beard: 'none', head: 'leafcrown', cloth: '#3d7a35', trim: '#c9e0a5', bg: '#dcebd2', female: true },
    advisor: { skin: '#f6d6bd', hair: '#b5462a', hairStyle: 'braid', beard: 'none', head: 'hood', cloth: '#5b3f86', trim: GOLD, bg: '#e8dff2', female: true, extra: 'scroll' },
  };

  function hashStr(str) { let h = 7; for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0; return h; }

  /** Портрет персонажа (правитель/наследник) по его внешности, полу и возрасту. */
  function charPortrait(ch, mood, size, isRuler) {
    const h = hashStr(ch.id + ch.name);
    const old = ch.age >= 55;
    const child = ch.age < 14;
    const o = {
      skin: ch.look.skin, hair: old ? '#c4c6cc' : ch.look.hair, cloth: ch.look.cloth, trim: GOLD, bg: ch.look.bg,
      female: ch.female,
      hairStyle: ch.female ? 'long' : (ch.look.head === 'furhat' ? 'topknot' : 'short'),
      beard: ch.female || child ? 'none' : ['full', 'mustache', 'longbraid', 'none', 'full'][h % 5],
      head: isRuler ? ch.look.head : (child ? 'none' : (ch.female ? 'circlet' : 'none')),
      extra: ch.female && h % 3 === 0 ? 'pearls' : (!ch.female && h % 4 === 1 ? 'fur' : ''),
    };
    if (o.head === 'corno' && ch.female) o.head = 'circlet';
    return portrait(o, mood, size);
  }

  function portrait(id, mood, size) {
    const o = typeof id === 'object' ? id : (PORTRAITS[id] || PORTRAITS.player);
    mood = mood || 'neutral';
    const g = nid('p');
    const s = size || 96;
    const parts = [];
    // Фон-медальон
    parts.push(`<circle cx="60" cy="60" r="57" fill="${o.bg}" stroke="${INK}" stroke-width="3"/>`);
    parts.push(`<clipPath id="${g}cl"><circle cx="60" cy="60" r="55"/></clipPath><g clip-path="url(#${g}cl)">`);
    // Капюшон/волосы сзади
    if (o.head === 'hood') parts.push(`<path d="M28 76 C24 34 42 14 60 14 C78 14 96 34 92 76 L100 120 L20 120 Z" fill="${o.cloth}" stroke="${INK}" stroke-width="2"/>`);
    if (o.hairStyle === 'long') parts.push(`<path d="M34 54 C32 26 46 16 60 16 C74 16 88 26 86 54 L92 100 C84 106 78 102 76 92 L80 56 C78 42 72 36 60 36 C48 36 42 42 40 56 L44 92 C42 102 36 106 28 100 Z" fill="${o.hair}" stroke="${INK}" stroke-width="2"/>`);
    if (o.hairStyle === 'braid') parts.push(`<path d="M74 66 C84 76 84 90 78 104 C76 98 72 96 70 90 Z" fill="${o.hair}" stroke="${INK}" stroke-width="1.8"/>`);
    // Плечи и одежда
    parts.push(`<path d="M12 122 C14 98 32 87 60 87 C88 87 106 98 108 122 Z" fill="${o.cloth}" stroke="${INK}" stroke-width="2.5"/>`);
    parts.push(`<path d="M44 89 L60 106 L76 89" fill="none" stroke="${o.trim}" stroke-width="4"/>`);
    if (o.extra === 'fur') parts.push(`<path d="M18 104 C30 88 46 90 60 96 C74 90 90 88 102 104 C92 100 84 104 76 100 C70 106 50 106 44 100 C36 104 28 100 18 104 Z" fill="#e8e1d3" stroke="${INK}" stroke-width="2"/>`);
    if (id === 'player' || o.head === 'crown') parts.push(`<path d="M22 102 Q60 124 98 102 Q92 90 60 92 Q28 90 22 102 Z" fill="#f6f1e6" stroke="${INK}" stroke-width="2"/><path d="M40 102 l1.5 4 l1.5 -4z M58 108 l1.5 4 l1.5 -4z M76 102 l1.5 4 l1.5 -4z" fill="${INK}"/>`);
    // Шея и голова
    parts.push(`<path d="M51 74 L50 92 Q60 97 70 92 L69 74 Z" fill="${o.skin}" stroke="${INK}" stroke-width="2"/>`);
    if (o.extra === 'pearls') parts.push(`<path d="M47 91 Q60 101 73 91" fill="none" stroke="#fffaf0" stroke-width="4" stroke-dasharray="0.1 5" stroke-linecap="round"/>`);
    parts.push(`<path d="M37 54 q-6 0 -5 7 q1 6 6 5 M83 54 q6 0 5 7 q-1 6 -6 5" fill="${o.skin}" stroke="${INK}" stroke-width="2"/>`);
    parts.push(`<path d="M38 54 C38 32 48 24 60 24 C72 24 82 32 82 54 C82 72 72 82 60 82 C48 82 38 72 38 54 Z" fill="${o.skin}" stroke="${INK}" stroke-width="2.5"/>`);
    if (o.extra === 'earring') parts.push(`<circle cx="34" cy="66" r="3.5" fill="none" stroke="${GOLD}" stroke-width="2"/>`);
    // Причёски спереди
    if (o.hairStyle === 'short') parts.push(`<path d="M38 52 C37 30 48 20 60 20 C72 20 83 30 82 52 C79 40 72 34 60 34 C48 34 41 40 38 52 Z" fill="${o.hair}" stroke="${INK}" stroke-width="2"/>`);
    if (o.hairStyle === 'bun' || o.hairStyle === 'braid') parts.push(`<path d="M38 58 C36 34 46 22 60 22 C74 22 84 34 82 58 C80 46 74 37 60 36 C46 37 40 46 38 58 Z" fill="${o.hair}" stroke="${INK}" stroke-width="2"/>`);
    if (o.hairStyle === 'long') parts.push(`<path d="M37 58 C35 30 47 19 60 19 C73 19 85 30 83 58 C79 43 71 36 60 36 C49 36 41 43 37 58 Z" fill="${o.hair}" stroke="${INK}" stroke-width="2"/>`);
    if (o.hairStyle === 'topknot') parts.push(`<path d="M44 34 C50 26 70 26 76 34" fill="none" stroke="#00000022" stroke-width="5"/>`);
    // Румянец, нос
    parts.push(`<ellipse cx="48" cy="64" rx="4" ry="2.4" fill="#e8907a" opacity=".4"/><ellipse cx="72" cy="64" rx="4" ry="2.4" fill="#e8907a" opacity=".4"/>`);
    parts.push(`<path d="M60 55 Q57 63 59 65 Q62 66 63 64" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>`);
    // Глаза и брови по настроению
    const brows = {
      neutral: 'M46 46 Q51 43 56 46 M64 46 Q69 43 74 46',
      angry: 'M45 43 L56 48 M75 43 L64 48',
      happy: 'M46 44 Q51 40 56 44 M64 44 Q69 40 74 44',
    }[mood];
    parts.push(`<path d="${brows}" stroke="${o.beard === 'longbraid' ? '#8d929c' : INK}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`);
    if (mood === 'happy') parts.push(`<path d="M47 54 Q51 49 55 54 M65 54 Q69 49 73 54" stroke="${INK}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`);
    else parts.push(`<ellipse cx="51" cy="53" rx="2.7" ry="3.2" fill="${INK}"/><ellipse cx="69" cy="53" rx="2.7" ry="3.2" fill="${INK}"/><circle cx="52" cy="52" r=".9" fill="#fff"/><circle cx="70" cy="52" r=".9" fill="#fff"/>`);
    if (o.female) parts.push(`<path d="M47 49.5 l-2.5 -2 M73 49.5 l2.5 -2" stroke="${INK}" stroke-width="1.5" stroke-linecap="round"/>`);
    // Рот
    const mouth = {
      neutral: `<path d="M54 72 Q60 74 66 72" stroke="${INK}" stroke-width="2" fill="none" stroke-linecap="round"/>`,
      angry: `<path d="M53 74 Q60 69 67 74" stroke="${INK}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`,
      happy: `<path d="M52 70 Q60 79 68 70 Q60 73 52 70 Z" fill="#8a2a2a" stroke="${INK}" stroke-width="1.5"/>`,
    }[mood];
    if (o.female && mood !== 'happy') parts.push(mouth.replace(`stroke="${INK}"`, 'stroke="#b5485a"'));
    else parts.push(mouth);
    // Бороды/усы
    if (o.beard === 'full') parts.push(`<path d="M40 60 C42 80 50 90 60 92 C70 90 78 80 80 60 C76 72 70 76 60 76 C50 76 44 72 40 60 Z" fill="#7a4828" stroke="${INK}" stroke-width="2"/><path d="M50 69 Q55 65 60 68 Q65 65 70 69 Q65 72 60 71 Q55 72 50 69 Z" fill="#5c331b" stroke="${INK}" stroke-width="1.3"/>`);
    if (o.beard === 'mustache') parts.push(`<path d="M60 68 C54 66 48 68 46 74 C45 82 44 88 42 92 C46 88 48 80 52 74 C55 71 58 71 60 71 C62 71 65 71 68 74 C72 80 74 88 78 92 C76 88 75 82 74 74 C72 68 66 66 60 68 Z" fill="${o.hair}" stroke="${INK}" stroke-width="1.4"/>`);
    if (o.beard === 'longbraid') parts.push(`<path d="M42 62 C44 80 52 86 54 92 L56 112 Q60 118 64 112 L66 92 C68 86 76 80 78 62 C74 72 68 76 60 76 C52 76 46 72 42 62 Z" fill="${o.hair}" stroke="${INK}" stroke-width="2"/><path d="M56 98 h8 M56 104 h8" stroke="${INK}" stroke-width="1.5"/><path d="M50 69 Q55 66 60 68 Q65 66 70 69 Q65 72 60 71 Q55 72 50 69 Z" fill="#9ea2ab" stroke="${INK}" stroke-width="1.2"/>`);
    // Головные уборы
    if (o.head === 'crown') parts.push(`<path d="M40 34 L37 14 L49 25 L55 8 L60 22 L65 8 L71 25 L83 14 L80 34 Z" fill="#f2c94c" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/><path d="M39 32 L81 32 L80 40 L40 40 Z" fill="#e0b13a" stroke="${INK}" stroke-width="2"/><circle cx="60" cy="36" r="2.5" fill="#2e86de" stroke="${INK}"/>`);
    if (o.head === 'furhat') parts.push(`<path d="M42 30 C42 14 52 8 60 8 C68 8 78 14 78 30 Z" fill="#b23a2a" stroke="${INK}" stroke-width="2"/><path d="M34 36 C34 26 46 24 60 24 C74 24 86 26 86 36 C86 42 74 42 60 42 C46 42 34 42 34 36 Z" fill="#7b5233" stroke="${INK}" stroke-width="2"/><path d="M40 33 q3 -3 6 0 M52 31 q3 -3 6 0 M64 31 q3 -3 6 0 M76 33 q3 -3 6 0" stroke="#4e321f" stroke-width="1.5" fill="none"/><circle cx="60" cy="9" r="3" fill="${GOLD}" stroke="${INK}"/>`);
    if (o.head === 'corno') parts.push(`<path d="M40 38 C38 18 52 6 68 8 C80 10 86 22 82 38 Z" fill="${o.cloth}" stroke="${INK}" stroke-width="2"/><path d="M66 9 C76 6 84 14 80 26" fill="none" stroke="${INK}" stroke-width="2"/><path d="M38 36 L84 36 L83 42 L39 42 Z" fill="${GOLD}" stroke="${INK}" stroke-width="2"/><path d="M50 22 l4 4 l-4 4 l-4 -4z" fill="${GOLD}" stroke="${INK}" stroke-width="1"/>`);
    if (o.head === 'laurel') {
      const lv = [[40, 40, -60], [44, 33, -40], [50, 28, -20], [70, 28, 20], [76, 33, 40], [80, 40, 60]]
        .map(([x, y, r]) => `<path d="M0 0 C-4 -5 -3 -11 0 -14 C3 -11 4 -5 0 0 Z" transform="translate(${x} ${y}) rotate(${r})" fill="#d9b23f" stroke="${INK}" stroke-width="1.3"/>`).join('');
      parts.push(lv);
    }
    if (o.head === 'circlet') parts.push(`<path d="M38 40 Q60 32 82 40 L82 45 Q60 37 38 45 Z" fill="#c4cad6" stroke="${INK}" stroke-width="2"/><path d="M60 30 l5 7 l-5 6 l-5 -6 z" fill="#5dade2" stroke="${INK}" stroke-width="1.5"/>`);
    if (o.head === 'leafcrown') {
      const leaves = [[40, 36, -40], [47, 30, -25], [54, 27, -10], [60, 26, 0], [66, 27, 10], [73, 30, 25], [80, 36, 40]]
        .map(([x, y, r]) => `<path d="M0 0 C-5 -6 -4 -14 0 -18 C4 -14 5 -6 0 0 Z" transform="translate(${x} ${y}) rotate(${r})" fill="#6aa84f" stroke="${INK}" stroke-width="1.5"/>`).join('');
      parts.push(leaves + `<circle cx="60" cy="27" r="2.5" fill="#e74c3c" stroke="${INK}"/>`);
    }
    if (o.head === 'hood') parts.push(`<path d="M30 74 C28 36 44 18 60 18 C76 18 92 36 90 74 C86 52 78 32 60 32 C42 32 34 52 30 74 Z" fill="${o.cloth}" stroke="${INK}" stroke-width="2"/><path d="M33 70 C33 44 44 28 60 28 C76 28 87 44 87 70" fill="none" stroke="${o.trim}" stroke-width="2.5"/>`);
    if (o.hairStyle === 'topknot') parts.push(`<path d="M57 10 Q60 -2 63 10 Z" fill="${o.hair}"/>`);
    if (o.extra === 'scroll') parts.push(`<g transform="translate(78 92) rotate(-20)"><path d="M0 0 h26 v18 h-26 z" fill="#f3e3c3" stroke="${INK}" stroke-width="2"/><circle cx="0" cy="9" r="4" fill="#e0cba0" stroke="${INK}" stroke-width="1.5"/><path d="M5 6 h16 M5 11 h14" stroke="#8a6d4a" stroke-width="1.5"/></g>`);
    parts.push('</g>');
    parts.push(`<circle cx="60" cy="60" r="57" fill="none" stroke="${GOLD}" stroke-width="2.5" stroke-dasharray="2 4"/>`);
    return `<svg class="portrait" width="${s}" height="${s}" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">${parts.join('')}</svg>`;
  }

  // ---------------------------------------------------------------- ИКОНКИ
  const ICON_PATHS = {
    gold: `<circle cx="12" cy="12" r="9" fill="#f2c94c" stroke="${INK}" stroke-width="1.8"/><circle cx="12" cy="12" r="6" fill="none" stroke="${GOLD_D}" stroke-width="1.4"/><path d="M12 8 v8 M10 10 h3.5 a1.6 1.6 0 0 1 0 3.2 h-3" fill="none" stroke="${GOLD_D}" stroke-width="1.4"/>`,
    food: `<path d="M12 22 V8" stroke="${INK}" stroke-width="1.8"/><path d="M12 8 c-3 -1 -4 -4 -3 -6 c3 1 4 4 3 6 z M12 12 c-4 -1 -5 -4 -4 -6 c3 0 5 3 4 6z M12 12 c4 -1 5 -4 4 -6 c-3 0 -5 3 -4 6z M12 16 c-4 -1 -5 -4 -4 -6 c3 0 5 3 4 6z M12 16 c4 -1 5 -4 4 -6 c-3 0 -5 3 -4 6z" fill="#e3b448" stroke="${INK}" stroke-width="1.2"/>`,
    army: `<path d="M5 19 L17 5 L19 7 L7 21 Z" fill="#dfe6ee" stroke="${INK}" stroke-width="1.6"/><path d="M4 15 L9 20" stroke="${GOLD_D}" stroke-width="3" stroke-linecap="round"/><path d="M19 19 L7 5 L5 7 L17 21 Z" fill="#dfe6ee" stroke="${INK}" stroke-width="1.6"/><path d="M20 15 L15 20" stroke="${GOLD_D}" stroke-width="3" stroke-linecap="round"/>`,
    pop: `<circle cx="8" cy="8" r="3.4" fill="#e9c39b" stroke="${INK}" stroke-width="1.5"/><path d="M2 20 c0 -5 3 -7 6 -7 s6 2 6 7z" fill="#7d9bc9" stroke="${INK}" stroke-width="1.5"/><circle cx="16" cy="9" r="3" fill="#e9c39b" stroke="${INK}" stroke-width="1.5"/><path d="M12 20 c0 -4 2 -6 4 -6 s6 2 6 6z" fill="#b5735a" stroke="${INK}" stroke-width="1.5"/>`,
    mood: `<path d="M12 21 C4 15 2 11 2 8 a5 5 0 0 1 10 -1 a5 5 0 0 1 10 1 c0 3 -2 7 -10 13z" fill="#e85d6a" stroke="${INK}" stroke-width="1.6"/>`,
    castle: `<path d="M3 21 V8 h3 v2 h2 V8 h3 v2 h2 V8 h3 v2 h2 V8 h3 v13 z" fill="#c9b79a" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/><path d="M10 21 v-5 a2 2 0 0 1 4 0 v5" fill="#5a3520" stroke="${INK}" stroke-width="1.4"/>`,
    scroll: `<path d="M6 4 h12 v14 a3 3 0 0 1 -3 3 H6 a3 3 0 0 1 0 -6 h9" fill="#f3e3c3" stroke="${INK}" stroke-width="1.6"/><path d="M9 8 h6 M9 11 h5" stroke="#8a6d4a" stroke-width="1.4"/>`,
    hourglass: `<path d="M6 3 h12 M6 21 h12 M7 3 c0 6 10 6 10 9 s-10 3 -10 9 M17 3 c0 6 -10 6 -10 9 s10 3 10 9" fill="none" stroke="${INK}" stroke-width="1.7"/><path d="M9 19 c1 -2 5 -2 6 0z M10 7 h4 l-2 3z" fill="#e3b448"/>`,
    crown: `<path d="M3 18 L2 7 L7 11 L12 4 L17 11 L22 7 L21 18 Z" fill="#f2c94c" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/><path d="M3 18 h18 v3 H3z" fill="#e0b13a" stroke="${INK}" stroke-width="1.4"/>`,
    mic: `<rect x="9" y="2" width="6" height="12" rx="3" fill="#f3e3c3" stroke="${INK}" stroke-width="1.7"/><path d="M5 11 a7 7 0 0 0 14 0 M12 18 v4 M8 22 h8" fill="none" stroke="${INK}" stroke-width="1.7" stroke-linecap="round"/>`,
    seal: `<circle cx="12" cy="12" r="8.5" fill="#a82a35" stroke="${INK}" stroke-width="1.6"/><path d="M12 6 l1.6 3.6 l3.9 .3 l-3 2.5 l1 3.8 l-3.5 -2.1 l-3.5 2.1 l1 -3.8 l-3 -2.5 l3.9 -.3z" fill="#f2c94c"/>`,
    trophy: `<path d="M7 3 h10 v5 a5 5 0 0 1 -10 0z" fill="#f2c94c" stroke="${INK}" stroke-width="1.6"/><path d="M7 5 H3 c0 4 2 5 4 5 M17 5 h4 c0 4 -2 5 -4 5 M12 13 v4 M8 21 h8 l-1 -4 h-6z" fill="none" stroke="${INK}" stroke-width="1.6"/>`,
    shield: `<path d="M12 2 L20 5 C20 13 17 18 12 22 C7 18 4 13 4 5 Z" fill="#7d9bc9" stroke="${INK}" stroke-width="1.6"/><path d="M12 6 v12 M7 10 h10" stroke="#f2c94c" stroke-width="2"/>`,
    handshake: `<path d="M2 12 l5 -5 l4 2 l3 -2 l4 1 l4 4 l-6 6 c-1 1 -2 1 -3 0 l-4 -3" fill="#e9c39b" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/><path d="M9 13 l3 3 M11 11 l3 3" stroke="${INK}" stroke-width="1.3"/>`,
    gift: `<path d="M4 10 h16 v11 H4z" fill="#c0392b" stroke="${INK}" stroke-width="1.6"/><path d="M3 7 h18 v3 H3z" fill="#e74c3c" stroke="${INK}" stroke-width="1.6"/><path d="M12 7 v14" stroke="#f2c94c" stroke-width="2.4"/><path d="M12 7 c-2 -4 -6 -4 -6 -1 c0 1 2 1 6 1 c4 0 6 0 6 -1 c0 -3 -4 -3 -6 1" fill="none" stroke="${INK}" stroke-width="1.4"/>`,
    hammer: `<path d="M13 7 L4 18 l2 2 L15 9" fill="#8a5a33" stroke="${INK}" stroke-width="1.5"/><path d="M11 5 l4 -2 l6 6 l-2 4 z" fill="#aab4c0" stroke="${INK}" stroke-width="1.6"/>`,
    goblet: `<path d="M6 3 h12 c0 6 -2 9 -6 9 s-6 -3 -6 -9z" fill="#f2c94c" stroke="${INK}" stroke-width="1.6"/><path d="M12 12 v6 M8 21 h8" stroke="${INK}" stroke-width="1.8"/><path d="M8 5 h8" stroke="#a82a35" stroke-width="2"/>`,
    farm: `<path d="M2 21 h20" stroke="${INK}" stroke-width="1.6"/><path d="M4 21 V11 l6 -5 l6 5 v10z" fill="#c0392b" stroke="${INK}" stroke-width="1.6"/><path d="M8 21 v-5 h4 v5" fill="#f3e3c3" stroke="${INK}" stroke-width="1.3"/><path d="M18 21 v-8 a2 2 0 0 1 4 0 v8" fill="#e3b448" stroke="${INK}" stroke-width="1.4"/>`,
    market: `<path d="M3 9 l2 -5 h14 l2 5z" fill="#e67e22" stroke="${INK}" stroke-width="1.5"/><path d="M3 9 c0 2 3 2 3 0 c0 2 3 2 3 0 c0 2 3 2 3 0 c0 2 3 2 3 0 c0 2 3 2 3 0 c0 2 3 2 3 0" fill="#f3e3c3" stroke="${INK}" stroke-width="1.3"/><path d="M5 11 v10 h14 v-10" fill="none" stroke="${INK}" stroke-width="1.6"/><path d="M9 21 v-5 h6 v5" fill="#8a5a33" stroke="${INK}" stroke-width="1.2"/>`,
    tax: `<path d="M6 9 c0 -3 3 -5 6 -5 s6 2 6 5 c3 2 4 6 3 9 c-1 3 -5 4 -9 4 s-8 -1 -9 -4 c-1 -3 0 -7 3 -9z" fill="#c9a36b" stroke="${INK}" stroke-width="1.6"/><path d="M8 8 h8" stroke="${INK}" stroke-width="1.6"/><path d="M12 11 v7 M10 13 h3 a1.3 1.3 0 0 1 0 2.6 h-3" fill="none" stroke="${INK}" stroke-width="1.4"/>`,
    fort: `<path d="M4 21 V6 l2 -2 l2 2 V9 h2 V5 h4 v4 h2 V6 l2 -2 l2 2 v15z" fill="#aab4c0" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/><path d="M4 13 h16 M4 17 h16 M9 13 v4 M15 13 v4 M12 17 v4" stroke="${INK}" stroke-width="1"/>`,
    peace: `<path d="M12 21 V8" stroke="${INK}" stroke-width="1.6"/><path d="M12 8 c-6 -1 -9 -5 -8 -7 c4 0 7 3 8 7z M12 11 c5 0 8 -3 8 -6 c-4 0 -7 2 -8 6z" fill="#7fbf6a" stroke="${INK}" stroke-width="1.3"/><circle cx="12" cy="17" r="2" fill="#f3e3c3" stroke="${INK}"/>`,
    tribute: `<path d="M3 14 h18 l-2 7 H5z" fill="#8a5a33" stroke="${INK}" stroke-width="1.5"/><circle cx="8" cy="11" r="3" fill="#f2c94c" stroke="${INK}" stroke-width="1.3"/><circle cx="14" cy="10" r="3" fill="#f2c94c" stroke="${INK}" stroke-width="1.3"/><circle cx="11" cy="6" r="3" fill="#f2c94c" stroke="${INK}" stroke-width="1.3"/>`,
    trade: `<path d="M12 3 v18 M5 21 h14" stroke="${INK}" stroke-width="1.7"/><path d="M4 7 h16" stroke="${INK}" stroke-width="1.7"/><path d="M4 7 l-3 7 h6z M20 7 l-3 7 h6z" fill="#f2c94c" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/>`,
    war: `<path d="M12 2 C8 6 5 9 5 13 a7 7 0 0 0 14 0 c0 -4 -3 -7 -7 -11z" fill="#e74c3c" stroke="${INK}" stroke-width="1.6"/><path d="M12 9 c-2 2 -3 4 -3 6 a3 3 0 0 0 6 0 c0 -2 -1 -4 -3 -6z" fill="#f5b041"/>`,
    lock: `<rect x="5" y="10" width="14" height="11" rx="2" fill="#c9a36b" stroke="${INK}" stroke-width="1.6"/><path d="M8 10 V7 a4 4 0 0 1 8 0 v3" fill="none" stroke="${INK}" stroke-width="1.7"/><circle cx="12" cy="15" r="1.6" fill="${INK}"/>`,
    play: `<circle cx="12" cy="12" r="9" fill="#7d9bc9" stroke="${INK}" stroke-width="1.6"/><path d="M10 8 l6 4 l-6 4z" fill="#fff" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/>`,
    gear: `<path d="M12 2 l2 3 l3 -1 l1 3 l3 1 l-1 3 l3 2 l-3 2 l1 3 l-3 1 l-1 3 l-3 -1 l-2 3 l-2 -3 l-3 1 l-1 -3 l-3 -1 l1 -3 l-3 -2 l3 -2 l-1 -3 l3 -1 l1 -3 l3 1z" fill="#aab4c0" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/><circle cx="12" cy="12" r="3.5" fill="#f3e3c3" stroke="${INK}" stroke-width="1.4"/>`,
    pause: `<rect x="5" y="4" width="5" height="16" rx="1" fill="#f3e3c3" stroke="${INK}" stroke-width="1.6"/><rect x="14" y="4" width="5" height="16" rx="1" fill="#f3e3c3" stroke="${INK}" stroke-width="1.6"/>`,
    star: `<path d="M12 2 l3 6.5 l7 .8 l-5.2 4.8 l1.4 7 L12 17.6 L5.8 21.1 l1.4 -7 L2 9.3 l7 -.8z" fill="#f2c94c" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>`,
    brain: `<path d="M9 3 a3 3 0 0 0 -3 3 a3 3 0 0 0 -3 4 a3 3 0 0 0 1 5 a3 3 0 0 0 4 4 a3 3 0 0 0 4 1 V4 a3 3 0 0 0 -3 -1z M15 3 a3 3 0 0 1 3 3 a3 3 0 0 1 3 4 a3 3 0 0 1 -1 5 a3 3 0 0 1 -4 4 a3 3 0 0 1 -4 1" fill="#f4b6c2" stroke="${INK}" stroke-width="1.5"/><path d="M8 9 c1 1 2 1 4 0 M8 14 c2 -1 3 0 4 1 M16 9 c-1 1 -2 1 -4 0 M16 14 c-2 -1 -3 0 -4 1" fill="none" stroke="${INK}" stroke-width="1.1"/>`,
    sound: `<path d="M3 9 h4 l5 -4 v14 l-5 -4 H3z" fill="#f3e3c3" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/><path d="M15 8 c2 2 2 6 0 8 M18 5 c4 4 4 10 0 14" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>`,
  };

  Object.assign(ICON_PATHS, {
    science: `<path d="M9 3 h6 M10 3 v6 L4 19 a2 2 0 0 0 2 3 h12 a2 2 0 0 0 2 -3 L14 9 V3" fill="#bfe3f2" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/><path d="M7 15 h10 l2 4 H5z" fill="#4aa3c9"/><circle cx="11" cy="17" r="1" fill="#fff"/>`,
    culture: `<path d="M12 3 L21 8 H3 Z" fill="#c9a36b" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/><path d="M5 9 v9 M9 9 v9 M15 9 v9 M19 9 v9" stroke="${INK}" stroke-width="2"/><path d="M3 19 h18 v2 H3z" fill="#c9a36b" stroke="${INK}" stroke-width="1.4"/>`,
    stability: `<path d="M12 2 L20 6 V12 C20 17 16 20 12 22 C8 20 4 17 4 12 V6 Z" fill="#7fbf6a" stroke="${INK}" stroke-width="1.6"/><path d="M8 12 l3 3 l5 -6" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`,
    prestige: `<path d="M12 2 l2.6 5.6 l6 .7 l-4.5 4.1 l1.2 6 L12 15.4 L6.7 18.4 l1.2 -6 L3.4 8.3 l6 -.7z" fill="#e9c35a" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/><circle cx="12" cy="11" r="2.2" fill="#a82a35"/>`,
    dynasty: `<path d="M12 21 V11 M12 11 L6 6 M12 11 L18 6 M6 6 V3 M18 6 V3" fill="none" stroke="${INK}" stroke-width="1.8"/><circle cx="12" cy="11" r="2.6" fill="#f2c94c" stroke="${INK}"/><circle cx="6" cy="5" r="2.3" fill="#e9c39b" stroke="${INK}"/><circle cx="18" cy="5" r="2.3" fill="#e9c39b" stroke="${INK}"/><path d="M8 21 h8" stroke="${INK}" stroke-width="2"/>`,
    diplomacy: `<path d="M4 4 h16 v12 H9 l-5 4z" fill="#f3e3c3" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/><circle cx="16" cy="15" r="4" fill="#a82a35" stroke="${INK}" stroke-width="1.3"/><path d="M7 8 h10 M7 11 h6" stroke="#8a6d4a" stroke-width="1.5"/>`,
    ring: `<circle cx="12" cy="14" r="6" fill="none" stroke="#e0b13a" stroke-width="3"/><path d="M9 6 l3 -4 l3 4 l-3 3z" fill="#7fd3ff" stroke="${INK}" stroke-width="1.2"/>`,
    next: `<path d="M5 5 l8 7 l-8 7z M13 5 l8 7 l-8 7z" fill="#f3e3c3" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>`,
    city: `<path d="M3 21 V10 h4 V6 l3 -3 l3 3 v4 h4 V8 l2 -2 l2 2 v13z" fill="#d9c9a8" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/><path d="M9 21 v-4 a1.5 1.5 0 0 1 3 0 v4" fill="#5a3520"/>`,
    settle: `<path d="M3 21 L12 4 L21 21 Z" fill="#c9a36b" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 4 V1 l5 2 l-5 2" fill="#a82a35" stroke="${INK}" stroke-width="1"/><path d="M10 21 v-5 h4 v5" fill="#5a3520"/>`,
    move: `<path d="M4 12 h13 M13 6 l6 6 l-6 6" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`,
    skip: `<path d="M6 4 v16 M10 12 L20 4 V20 Z" fill="#f3e3c3" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>`,
    trash: `<path d="M5 7 h14 l-1 14 H6z" fill="#c9a36b" stroke="${INK}" stroke-width="1.5"/><path d="M3 7 h18 M9 4 h6 v3 H9z M10 11 v6 M14 11 v6" fill="none" stroke="${INK}" stroke-width="1.5"/>`,
  });

  function icon(name, size, cls) {
    return `<svg class="ico ${cls || ''}" width="${size || 20}" height="${size || 20}" viewBox="0 0 24 24" aria-hidden="true">${ICON_PATHS[name] || ''}</svg>`;
  }

  /** Глифы отрядов для холста (SVG-пути в рамке 24×24, рисуются Path2D). */
  const UNIT_GLYPHS = {
    settler: { fill: 'M3 13 H17 L20 8 H7 Z', stroke: 'M7 13 V8 M12 13 V8 M17 13 V8 M6 19 a2.5 2.5 0 1 0 0.01 0 M15 19 a2.5 2.5 0 1 0 0.01 0 M3 13 v3 h17 v-3' },
    warrior: { fill: 'M5 20 L13 9 L16 11 L8 21 Z M13 9 C12 5 16 2 19 4 C21 6 19 10 16 11 Z', stroke: '' },
    spearman: { fill: 'M18 3 L20 9 L17 8 Z', stroke: 'M4 21 L18 5 M7 15 l3 3' },
    archer: { fill: 'M20 12 l-4 -3 v6 Z', stroke: 'M7 3 C17 6 17 18 7 21 M7 3 L7 21 M3 12 H18' },
    horseman: { fill: 'M5 21 C5 15 7 10 12 7 L14 3 L15.5 6.5 C19 7.5 21 10.5 20 13 L16.5 13 L13.5 11.5 C12.5 14.5 12.5 17.5 13.5 21 Z', stroke: '' },
    swordsman: { fill: 'M12 2 L14.5 14 H9.5 Z M6.5 14 H17.5 V16 H6.5 Z M11 16 H13 V21 H11 Z', stroke: '' },
    catapult: { fill: 'M15 3 a3 3 0 1 0 0.01 0', stroke: 'M3 17 H21 M6 17 L11 9 L18 5 M10 17 L13 12 M7 21 a2 2 0 1 0 0.01 0 M17 21 a2 2 0 1 0 0.01 0' },
    crossbow: { fill: 'M20 12 l-4 -2.5 v5 Z', stroke: 'M3 12 H17 M10 4 C14 6 14 18 10 20 M10 4 C6 6 6 18 10 20 M5 14 v5' },
    knight: { fill: 'M6 20 V10 C6 5 9 3 12 3 C15 3 18 5 18 10 V20 Z', stroke: 'M6 11 H18 M12 11 V19 M9 8 H15' },
  };

  RF.Art = { logo, king, portrait, charPortrait, icon, ICON_PATHS, UNIT_GLYPHS, PORTRAITS };

})(typeof window !== 'undefined' ? window : globalThis);
