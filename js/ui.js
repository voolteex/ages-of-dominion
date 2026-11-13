/* =========================================================================
 * AGES OF DOMINION — интерфейс: экраны, HUD, выбор и приказы отрядам, города,
 * технологии, дипломатия, династия, события, голосовые приказы, лавка,
 * рекорды, результаты.
 * ========================================================================= */
(function (root) {
  const RF = root.RF;
  const E = RF.Engine, D = RF.Data, A = RF.Art, AI = RF.AI, NLP = RF.NLP, S = RF.Storage, Shop = RF.Shop, SND = RF.Audio, V = RF.Voice, RD = RF.Render;
  const P = E.PLAYER;
  const $ = (q) => document.querySelector(q);
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const pct = (v) => Math.round(v * 100);
  const sign = (v) => (v >= 0 ? `<small class="pos">+${v}</small>` : `<small class="neg">${v}</small>`);
  const shadeCss = (hex) => { const n = parseInt(hex.slice(1), 16); const f = (v) => Math.round(v + (255 - v) * 0.45); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; };
  const PACT = { war: 'Война', alliance: 'Союз', trade: 'Торговля', peace: 'Мир', vassal: 'Вассал' };

  const UI = {
    s: null, selUnit: null, selCity: null, pendingIntent: null, lastCommands: [], heroTimer: null, queue: [],

    // =================================================================== ИНИЦИАЛИЗАЦИЯ
    init() {
      S.load();
      this.applySettings();
      $('#start-logo').innerHTML = A.logo(170);
      $('#menu-logo').innerHTML = A.logo(64);
      $('#tb-logo').innerHTML = A.logo(30);
      $('#btn-shop').innerHTML = A.icon('seal', 22) + ' Королевская лавка';
      $('#btn-records').innerHTML = A.icon('trophy', 22) + ' Летопись славы';
      $('#btn-help').innerHTML = A.icon('scroll', 22) + ' Как играть';
      $('#btn-settings').innerHTML = A.icon('gear', 22) + ' Настройки';
      $('#btn-tech').innerHTML = A.icon('science', 20) + ' Наука';
      $('#btn-diplo').innerHTML = A.icon('diplomacy', 20) + ' Дипломатия';
      $('#btn-civics').innerHTML = A.icon('culture', 20) + ' Институты';
      $('#btn-civics').onclick = () => this.openCivics();
      $('#civic-box').onclick = () => this.openCivics();
      const mm = $('#minimap');
      mm.addEventListener('pointerdown', (e) => { const r = mm.getBoundingClientRect(); RD.minimapJump((e.clientX - r.left) * (mm.width / r.width), (e.clientY - r.top) * (mm.height / r.height)); });
      this.startMenuBackground();
      $('#btn-dynasty').innerHTML = A.icon('dynasty', 20) + ' Династия';
      $('#btn-ai').innerHTML = A.icon('brain', 20) + ' ИИ';
      $('#btn-gshop').innerHTML = A.icon('seal', 20);
      $('#btn-pause').innerHTML = A.icon('pause', 20);
      $('#btn-mic').innerHTML = A.icon('mic', 30);
      if (!V.supported()) $('#btn-mic').classList.add('unsupported');

      $('#btn-start').onclick = () => { SND.unlock(); SND.play('fanfare'); this.showMenu(); };
      $('#btn-new').onclick = () => { SND.play('click'); this.openLevels(); };
      $('#btn-continue').onclick = () => { SND.play('click'); this.continueGame(); };
      $('#btn-shop').onclick = () => this.openShop();
      $('#btn-records').onclick = () => this.openRecords();
      $('#btn-help').onclick = () => this.openHelp();
      $('#btn-settings').onclick = () => this.openSettings();
      $('#player-name').oninput = (e) => { S.profile.name = e.target.value.trim() || 'Эдрик'; S.persist(); };
      $('#btn-tech').onclick = () => this.openTech();
      $('#btn-diplo').onclick = () => this.openDiplomacy();
      $('#btn-dynasty').onclick = () => this.openDynasty();
      $('#btn-ai').onclick = () => this.openAIPanel();
      $('#btn-gshop').onclick = () => this.openShop();
      $('#btn-pause').onclick = () => this.openPause();
      $('#btn-end').onclick = () => this.endTurn();
      $('#btn-mic').onclick = () => this.toggleMic();
      $('#research-box').onclick = () => this.openTech();
      $('#ruler-card').onclick = () => this.openDynasty();
      $('#end-hint').onclick = () => this.nextBlocker();
      $('#chk-continuous').onchange = (e) => { S.profile.settings.continuousVoice = e.target.checked; S.persist(); V.stop(); };
      $('#chk-continuous').checked = !!S.profile.settings.continuousVoice;
      $('#cmd-form').onsubmit = (e) => { e.preventDefault(); const v = $('#cmd-input').value.trim(); if (!v) return; $('#cmd-input').value = ''; this.handleSpeech([{ text: v, confidence: 1 }], 'text'); };
      $('#modal').addEventListener('mousedown', (e) => { if (e.target.id === 'modal' && this.modalDismissable) this.closeModal(); });
      document.addEventListener('keydown', (e) => this.onKey(e));

      let mmTick = 0;
      RD.init($('#map'), { click: (c, r) => this.onTileClick(c, r), rightClick: (c, r) => this.onTileRight(c, r), hover: (t) => this.onHover(t), frame: () => { this.positionUnitBar(); if (++mmTick % 3 === 0) RD.drawMinimap($('#minimap')); }, sfx: (n) => SND.play(n), onFx: (e) => this.onFx(e) });

      V.init({
        onState: (st) => { $('#btn-mic').classList.toggle('listening', st === 'listening'); $('#voice-status').textContent = st === 'listening' ? 'Слушаю, повелитель…' : 'Микрофон (M) — голосовой приказ'; if (st === 'listening') SND.play('listen'); },
        onInterim: (t) => { $('#voice-transcript').textContent = `«${t}…»`; },
        onFinal: (alts) => this.handleSpeech(alts, 'voice'),
        onError: (err) => {
          const m = { 'not-allowed': 'Браузер запретил микрофон — разрешите доступ в адресной строке.', 'service-not-allowed': 'Распознавание речи недоступно: откройте игру через start.bat (http://localhost).', network: 'Для распознавания речи нужен интернет.', 'no-speech': 'Ничего не слышно. Попробуйте ещё раз.', 'audio-capture': 'Микрофон не найден.' };
          if (err !== 'aborted') this.toast(m[err] || `Ошибка распознавания: ${err}`);
        },
      });
    },

    applySettings() { const st = S.profile.settings; SND.setSound(st.sound); SND.setMusic(st.music); },
    show(id) {
      document.querySelectorAll('.screen').forEach((x) => x.classList.toggle('active', x.id === id));
      if (id !== 'scr-game') V.stop();
      if (id === 'scr-game') setTimeout(() => RD.resize(), 0);
      $('#menu-bg').style.display = id === 'scr-game' ? 'none' : 'block';
    },

    /** Живая карта на фоне меню: сгенерированный мир с городами, медленный облёт камерой. */
    startMenuBackground() {
      try {
        const make = (seed) => { const ms = E.newGame(2, { seed }); for (let i = 0; i < 22; i++) { AI.RealmAI.takeTurn(ms, P); E.endTurn(ms); } if (ms._fx) ms._fx.length = 0; return ms; };
        let seed = 4242;
        const ms = make(seed);
        this.menuRender = RD.spawnPassive($('#menu-bg'), ms);
        // мир продолжает жить: ИИ ходит за всех, армии маршируют и сражаются
        setInterval(() => {
          const mr = this.menuRender;
          if (!mr || $('#menu-bg').style.display === 'none' || document.hidden) return;
          try {
            if (mr.s.over || mr.s.turn > 150) { seed += 17; mr.s = make(seed); mr.resetState(); mr.world = null; return; }
            AI.RealmAI.takeTurn(mr.s, P); E.endTurn(mr.s);
          } catch (e) { console.warn('menu turn', e); }
        }, 3200);
      } catch (e) { console.warn('menu bg', e); }
    },
    toast(html, ms) { const t = $('#toast'); t.innerHTML = html; t.classList.add('show'); clearTimeout(this._t); this._t = setTimeout(() => t.classList.remove('show'), ms || 2800); },
    speak(text) { if (S.profile.settings.voiceFeedback) V.speak(text); },

    // =================================================================== МЕНЮ
    showMenu() {
      const p = S.profile;
      $('#player-name').value = p.name === 'Правитель' ? 'Эдрик' : p.name;
      $('#btn-continue').classList.toggle('hidden', !p.save);
      this.refreshSeals();
      $('#menu-heroes').innerHTML = Object.entries(D.HEROES).map(([id, H]) => {
        const R = D.REALMS[id], U = D.UNITS[H.type];
        return `<div class="hero-tile" style="--rc:${R.color}" title="${esc(U.ability)}"><img src="${RD.unitIcon(H.type, R.color, 40, 3)}" alt=""><div class="ht-name">${esc(H.name)}</div><div class="ht-sub">${U.name} · ${R.short}</div></div>`;
      }).join('');
      this.show('scr-menu');
    },
    refreshSeals() { const p = S.profile; $('#menu-seals').innerHTML = `${A.icon('seal', 22)} Печати: ${p.seals}${p.premium ? ` · ${A.icon('crown', 20)} Королевское издание` : ''}`; },

    openLevels() {
      const p = S.profile;
      const cards = D.SCENARIOS.map((L) => {
        const locked = L.id > p.unlockedLevel;
        return `<div class="level-card ${locked ? 'locked' : ''}"><h3>${locked ? A.icon('lock', 18) : A.icon('crown', 18)} ${L.name}</h3><p>${L.desc}</p>
          <div class="meta">Карта ${L.w}×${L.h} · держав: ${L.realms.length} · ходов: ${L.turns} · сила ИИ ×${L.aiLevel}</div>
          ${locked ? `<button class="btn btn-small" data-unlock>${A.icon('seal', 16)} Открыть в лавке</button>` : `<button class="btn btn-primary btn-small" data-level="${L.id}">Начать</button>`}</div>`;
      }).join('');
      const inv = Shop.ITEMS.filter((i) => p.inventory[i.id] > 0);
      const boosts = inv.length ? `<div class="boost-list">${inv.map((i) => `<label class="boost"><input type="checkbox" data-boost="${i.id}">${A.icon(i.icon, 18)} ${i.name} (×${p.inventory[i.id]})</label>`).join('')}</div>` : '<p class="note-s">Усилений нет — их можно приобрести в Королевской лавке.</p>';
      this.modal(`<h2>Выбор сценария</h2><div class="level-cards">${cards}</div><h3>Усиления</h3>${boosts}
        <h3>Пол правителя</h3><label class="boost"><input type="checkbox" id="chk-female"> Королева</label>
        <div class="modal-actions"><button class="btn" data-close>Назад</button></div>`, { wide: true });
      const box = $('#modal-box');
      box.querySelectorAll('[data-level]').forEach((b) => b.onclick = () => {
        const sel = {}; box.querySelectorAll('[data-boost]').forEach((c) => { if (c.checked) sel[c.dataset.boost] = true; });
        const female = $('#chk-female').checked;
        this.closeModal(true); this.startGame(+b.dataset.level, sel, female);
      });
      box.querySelectorAll('[data-unlock]').forEach((b) => b.onclick = () => this.openShop());
    },

    // =================================================================== ИГРА
    startGame(level, sel, female) {
      const boosts = Shop.consumeBoosts(sel || {});
      const name = S.profile.name && S.profile.name !== 'Правитель' ? S.profile.name : (female ? 'Изольда' : 'Эдрик');
      this.s = E.newGame(level, { boosts, modelState: S.profile.aiModel, playerName: name, female });
      this.afterLoad();
      const L = E.level(this.s);
      this.modal(`<h2>${L.name}</h2>
        <div class="event-card"><div class="event-art">${A.charPortrait(this.ruler(), 'happy', 130, true)}</div>
        <div class="event-text"><p>${E.rulerTitle(this.s, P)} из рода ${D.REALMS[P].dynasty} восходит на трон в ${E.year(this.s)} году.</p>
        <p><b class="gold">Пути к победе:</b></p><ul>
          <li><b>Завоевание</b> — захватите столицы всех соперников;</li>
          <li><b>Союз корон</b> — все державы ваши союзники или вассалы (нужен хотя бы один вассал, держать ${E.UNION_TURNS} ходов);</li>
          <li><b>Величие</b> — наибольший счёт к ${E.year(this.s, this.s.turnLimit)} году (ход ${this.s.turnLimit}).</li></ul>
        <p class="note-s">Поселенцы стоят у столицы: выберите их и нажмите «Основать город» (B) на хорошем месте. Колёсико — масштаб, перетаскивание — обзор карты.</p></div></div>
        <div class="modal-actions"><button class="btn btn-primary" data-close>К делу!</button></div>`, { wide: true });
      SND.play('fanfare');
      S.saveGame(this.s);
    },

    continueGame() { const st = S.loadGame(); if (!st) return this.toast('Нет сохранённой партии.'); this.s = st; this.afterLoad(); this.toast(`С возвращением! ${E.year(st)} год.`); },

    afterLoad() {
      const s = this.s;
      E.updateVisibility(s);
      RD.setState(s);
      this.show('scr-game');
      const cap = s.cities[s.realms[P].capitalId];
      RD.cam.z = 1;
      if (cap) RD.centerOn(cap.c, cap.r);
      this.selUnit = null; this.selCity = null;
      this.selectNextIdle(true);
      this.refresh();
    },

    ruler() { return this.s.chars[this.s.realms[P].rulerId]; },

    refresh() {
      if (!this.s) return;
      this.updateOverlays(); this.renderTop(); this.renderRuler(); this.renderHeroCard(); this.renderFeed(); this.renderResearch(); this.renderCivic(); this.renderSel(); this.renderUnitBar(); this.renderCity(); this.renderEndHint();
    },

    renderTop() {
      const s = this.s, R = s.realms[P], inc = E.realmIncome(s, P);
      const stab = Math.round(R.stability);
      $('#res-row').innerHTML = [
        `<span class="res" title="Казна (доход за ход: города ${inc.gold}, торговля +${inc.trade}, содержание войск −${inc.unitUpkeep}, построек −${inc.bUpkeep})">${A.icon('gold', 18)} ${R.gold} ${sign(inc.net)}</span>`,
        `<span class="res" title="Наука за ход">${A.icon('science', 18)} ${sign(inc.sci)}</span>`,
        `<span class="res" title="Культура за ход (развивает институты)">${A.icon('culture', 18)} ${sign(Math.round(inc.culture * 10) / 10)}</span>`,
        `<span class="res" title="Стабильность державы (0 — мятеж; ниже 30 — штраф к доходам)">${A.icon('stability', 18)} <span class="${stab < 30 ? 'neg' : ''}">${stab}</span></span>`,
        `<span class="res" title="Престиж династии">${A.icon('prestige', 18)} ${Math.round(R.prestige)}</span>`,
        `<span class="res" title="Города · отряды">${A.icon('city', 18)} ${E.citiesOf(s, P).length} · ${A.icon('army', 16)} ${E.unitsOf(s, P).length}</span>`,
      ].join('');
      $('#turn-info').innerHTML = `${E.year(s)} г. · ход ${s.turn}/${s.turnLimit}<small>ИИ ×${s.difficulty.toFixed(2)} · напряжённость ${s.tension}%${s.unionTurns ? ` · Союз корон ${s.unionTurns}/${E.UNION_TURNS}` : ''}</small>`;
    },

    renderRuler() {
      const s = this.s, ch = this.ruler(), R = s.realms[P];
      const mood = R.stability < 30 ? 'angry' : R.stability > 65 ? 'happy' : 'neutral';
      const skin = Shop.activeSkin();
      const box = $('#ruler-card');
      const kingState = box.querySelector('.king') ? box.querySelector('.king').getAttribute('data-state') : 'idle';
      box.innerHTML = `${A.charPortrait(ch, mood, 64, true)}<div><div class="name">${esc(E.rulerTitle(s, P))}</div><div class="sub">${ch.age} лет · ${D.REALMS[P].dynasty}</div>
        <div class="traits-mini">${ch.traits.map((t) => `<span class="trait">${D.TRAITS[t].name}</span>`).join('')}</div></div>${A.king({ state: kingState, robe: skin.robe, robeDark: skin.robeDark })}`;
    },

    /** Карточка героя державы в левом HUD: уровень, опыт, здоровье; клик — выбрать героя. */
    renderHeroCard() {
      const s = this.s, box = $('#hero-card');
      if (!box) return;
      const h = Object.values(s.units).find((u) => u.hero && u.realm === P);
      const H = D.HEROES[P], R = s.realms[P];
      if (!h) {
        box.innerHTML = R.heroDown ? `<img src="${RD.unitIcon(H.type, R.color, 26, 0)}" style="filter:grayscale(1);opacity:.6"><div><div class="name">${esc(H.name)}</div><div class="sub neg">ранен · вернётся через ${Math.max(1, R.heroDown.turn - s.turn)} х.</div></div>` : '';
        box.classList.toggle('hidden', !R.heroDown);
        return;
      }
      const U = D.UNITS[h.type], T = D.HERO_XP, lvl = h.hero.lvl;
      const next = T[lvl] !== undefined ? T[lvl] : null, prev = T[lvl - 1] || 0;
      const xpPct = next === null ? 100 : Math.round(((h.hero.xp - prev) / (next - prev)) * 100);
      box.classList.remove('hidden');
      box.innerHTML = `<img src="${RD.unitIcon(h.type, R.color, 26, lvl)}"><div style="flex:1;min-width:0"><div class="name">${esc(h.hero.name)}</div>
        <div class="sub">${U.name} · ур. ${lvl}${next === null ? ' (макс.)' : ''} · HP ${h.hp}</div>
        <div class="bar xp" title="Опыт: ${h.hero.xp}${next !== null ? '/' + next : ''}"><i style="width:${xpPct}%"></i></div></div>`;
      box.onclick = () => this.selectHero();
    },
    selectHero() {
      const h = this.s && Object.values(this.s.units).find((u) => u.hero && u.realm === P);
      if (!h) return this.toast('Герой ранен и восстанавливается в столице.');
      this.selectUnit(h.id, true);
    },
    /** Реакция на визуальные события движка: войны, захваты, герои. */
    onFx(e) {
      const s = this.s;
      if (!s || !$('#scr-game').classList.contains('active')) return;
      if (e.type === 'war') {
        const involved = e.a === P || e.b === P;
        this.warBanner(e.a, e.b, involved);
      } else if (e.type === 'capture' && (e.by === P || e.old === P)) SND.play(e.by === P ? 'fanfare' : 'fail');
      else if (e.type === 'levelup' && E.visible(s, e.c, e.r)) SND.play('tech');
      else if (e.type === 'herofall' && e.realm === P) this.toast(`${A.icon('war', 18)} ${esc(e.name)} пал в бою! Вернётся через 6 ходов.`, 3500);
    },
    warBanner(a, b, big) {
      const s = this.s, A1 = s.realms[a], B1 = s.realms[b];
      this.warQueue = this.warQueue || [];
      this.warQueue.push({ a: A1, b: B1, big });
      if (this.warShowing) return;
      const next = () => {
        const w = this.warQueue.shift();
        if (!w) { this.warShowing = false; return; }
        this.warShowing = true;
        const el = $('#war-banner');
        el.className = 'war-banner show' + (w.big ? ' big' : '');
        el.innerHTML = `<div class="wb-shield" style="background:${w.a.color}">${esc(w.a.short[0])}</div><div class="wb-text"><div class="wb-title">${w.big ? 'Война!' : 'Новая война'}</div><div class="wb-sub"><b style="color:${shadeCss(w.a.color)}">${esc(w.a.name)}</b> объявляет войну: <b style="color:${shadeCss(w.b.color)}">${esc(w.b.name)}</b></div></div><div class="wb-shield" style="background:${w.b.color}">${esc(w.b.short[0])}</div>`;
        SND.play('drum'); if (w.big) setTimeout(() => SND.play('sword'), 300);
        setTimeout(() => { el.classList.remove('show'); setTimeout(next, 450); }, w.big ? 2800 : 1700);
      };
      next();
    },

    setHero(state, ms) {
      const k = $('#ruler-card .king');
      if (!k) return;
      k.setAttribute('data-state', state);
      clearTimeout(this.heroTimer);
      if (state !== 'idle') this.heroTimer = setTimeout(() => { const kk = $('#ruler-card .king'); if (kk) kk.setAttribute('data-state', 'idle'); }, ms || 1800);
    },

    renderFeed() {
      const s = this.s;
      const items = s.log.filter((l) => l.turn >= s.turn - 1).slice(-9).reverse();
      $('#feed').innerHTML = items.map((l, i) => `<div class="note ${l.type}" data-i="${i}">${esc(l.text)}</div>`).join('');
      $('#feed').querySelectorAll('.note').forEach((n) => n.onclick = () => { const l = items[+n.dataset.i]; if (l.c !== undefined) RD.centerOn(l.c, l.r); });
    },

    renderResearch() {
      const s = this.s, R = s.realms[P];
      if (!R.researching) { $('#research-box').innerHTML = `${A.icon('science', 18)} <b class="gold pulse" style="padding:2px 6px;border-radius:5px">Выберите исследование!</b>`; return; }
      const T = D.TECHS.find((t) => t.id === R.researching), cost = E.techCost(s, T);
      const sci = E.realmIncome(s, P).sci;
      const turns = Math.max(1, Math.ceil((cost - R.science) / Math.max(0.5, sci)));
      $('#research-box').innerHTML = `${A.icon('science', 18)} ${T.name} <div class="bar"><i style="width:${Math.min(100, (R.science / cost) * 100)}%"></i></div> <span class="muted">${turns} х.</span>`;
    },

    renderCivic() {
      const s = this.s, R = s.realms[P];
      if (!R.civicResearch) { $('#civic-box').innerHTML = `${A.icon('culture', 18)} <b class="gold">${D.CIVICS.some((c) => E.civicAvailable(s, P, c.id)) ? 'Выберите институт!' : 'Все институты'}</b>`; return; }
      const cv = D.CIVICS.find((c) => c.id === R.civicResearch), cost = E.civicCost(s, cv, P);
      const cul = Math.max(0.5, E.realmIncome(s, P).culture);
      $('#civic-box').innerHTML = `${A.icon('culture', 18)} ${cv.name} <div class="bar" style="width:90px"><i style="width:${Math.min(100, (R.culture / cost) * 100)}%;background:linear-gradient(90deg,#8a50c0,#d9a0ff)"></i></div> <span class="muted">${Math.max(1, Math.ceil((cost - R.culture) / cul))} х.</span>`;
    },

    // ----------------------------------------------------- Панель действий отряда на карте
    renderUnitBar() {
      const s = this.s, bar = $('#unit-bar'), u = s.units[this.selUnit];
      if (!u || u.realm !== P || this.placing) { bar.classList.add('hidden'); return; }
      const U = D.UNITS[u.type];
      const btn = (a, ic, tip, main) => `<button data-ub="${a}" data-tip="${esc(tip)}" class="${main ? 'main' : ''}">${A.icon(ic, 20)}</button>`;
      let h = `<span class="ub-label">${U.name}${u.charges ? ` (${u.charges})` : ''} · ${u.mp}/${U.mov}</span>`;
      if (u.type === 'settler') h += btn('found', 'settle', 'Основать город (B)', true);
      if (u.type === 'builder') {
        const imps = E.improvementsFor(s, u);
        const IC = { farm: 'farm', mine: 'hammer', pasture: 'peace', quarry: 'castle', lumber: 'hammer' };
        for (const id of imps) h += btn('imp:' + id, IC[id] || 'hammer', `Построить: ${D.IMPROVEMENTS[id].name}`, true);
        if (!imps.length) h += `<span class="ub-label muted" style="font-family:var(--font)">нечего улучшать здесь</span>`;
      }
      if (U.cls !== 'civil') h += btn('fortify', 'shield', 'Укрепиться (F)');
      if (RD.targets && RD.targets.size) h += btn('attack', 'war', 'Атаковать лучшую цель (или правый клик по врагу)', true);
      h += btn('skip', 'skip', 'Ждать (Пробел)') + btn('next', 'next', 'Следующий отряд (N)') + btn('disband', 'trash', 'Распустить');
      bar.innerHTML = h;
      bar.classList.remove('hidden');
      bar.querySelectorAll('[data-ub]').forEach((b) => b.onclick = (e) => {
        e.stopPropagation();
        const a = b.dataset.ub;
        if (a === 'next') return this.selectNextIdle();
        if (a === 'attack') return this.execute({ intent: 'attack', dir: null }, 'click');
        if (a.startsWith('imp:')) return this.improve(a.slice(4));
        this.unitAction(a);
      });
      this.positionUnitBar();
    },
    positionUnitBar() {
      const bar = $('#unit-bar'), u = this.s && this.s.units[this.selUnit];
      if (!u || bar.classList.contains('hidden')) return;
      const d = RD.disp && RD.disp[u.id];
      const [x, y] = RD.toScreen(...(d ? [d.x, d.y] : RD.center(u.c, u.r)));
      bar.style.left = Math.max(170, Math.min(RD.W - 170, x)) + 'px';
      bar.style.top = Math.min(RD.H - 120, Math.max(60, y + RD.size * RD.cam.z * 0.5 + 46)) + 'px';
    },
    improve(id) {
      const u = this.s.units[this.selUnit];
      if (!u) return this.toast('Выберите строителей.');
      const r = E.buildImprovement(this.s, u.id, id);
      SND.play(r.ok ? 'build' : 'error');
      this.toast(esc(r.msg));
      if (r.ok && !this.s.units[u.id]) this.selUnit = null;
      if (r.ok) this.selectNextIdle(true);
      this.afterAction();
      return r;
    },

    renderEndHint() {
      const s = this.s;
      const idle = E.idleUnits(s).length, cities = E.citiesNeedingOrders(s).length;
      const parts = [];
      if (idle) parts.push(`${A.icon('army', 14)} ждут приказа: ${idle}`);
      if (cities) parts.push(`${A.icon('city', 14)} без производства: ${cities}`);
      if (!s.realms[P].researching) parts.push(`${A.icon('science', 14)} нет исследования`);
      if (!s.realms[P].civicResearch && D.CIVICS.some((c) => E.civicAvailable(s, P, c.id))) parts.push(`${A.icon('culture', 14)} нет института`);
      $('#end-hint').innerHTML = parts.length ? parts.join(' · ') + ' — нажмите' : 'Все приказы отданы';
      $('#end-hint').style.cursor = parts.length ? 'pointer' : 'default';
    },

    nextBlocker() {
      const s = this.s;
      if (E.idleUnits(s).length) return this.selectNextIdle();
      const c = E.citiesNeedingOrders(s)[0];
      if (c) return this.selectCity(c.id, true);
      if (!s.realms[P].researching) return this.openTech();
      if (!s.realms[P].civicResearch) return this.openCivics();
    },

    // =================================================================== ВЫБОР
    placementHint(on) {
      let el = $('#placement-hint');
      if (!on) { if (el) el.remove(); return; }
      if (!el) { el = document.createElement('div'); el.id = 'placement-hint'; el.className = 'placement-hint'; $('.map-area').appendChild(el); }
      el.textContent = `Разместите «${D.DISTRICTS[this.placing].name}»: клик по подсвеченной клетке (число — бонус соседства) · Esc — отмена`;
    },
    selectUnit(id, center) {
      this.placing = null; this.placementHint(false);
      if (this.s.units[id] && this.s.units[id].realm === P && id !== this.selUnit) SND.play('select');
      this.selUnit = id; this.selCity = null;
      const u = this.s.units[id];
      if (u && center) RD.centerOn(u.c, u.r);
      this.refresh();
    },
    selectCity(id, center) {
      if (id !== this.selCity) { this.placing = null; this.placementHint(false); }
      this.selCity = id; this.selUnit = null;
      const c = this.s.cities[id];
      if (c && center) RD.centerOn(c.c, c.r);
      SND.play('click');
      this.refresh();
    },
    selectNextIdle(silent) {
      const list = E.idleUnits(this.s);
      if (!list.length) { if (!silent) this.toast('Все отряды получили приказы.'); return false; }
      const cur = list.findIndex((u) => u.id === this.selUnit);
      const u = list[(cur + 1) % list.length];
      this.selectUnit(u.id, true);
      return true;
    },

    updateOverlays() {
      const s = this.s, u = s.units[this.selUnit];
      RD.selUnit = u ? u.id : null;
      RD.selCity = this.selCity;
      RD.reach = null; RD.targets = null; RD.cityOverlay = null;
      const city = s.cities[this.selCity];
      if (city && city.realm === P) {
        if (this.placing) RD.cityOverlay = { cityId: city.id, mode: 'district', spots: E.districtSpots(s, city, this.placing) };
        else {
          const buyable = new Map();
          for (const [c, r] of E.inRadius(s, city.c, city.r, 3)) if (E.canBuyTile(s, city, c, r)) buyable.set(c + ',' + r, E.tileCost(s, city, c, r));
          RD.cityOverlay = { cityId: city.id, worked: E.cityYields(s, city).worked, buyable };
        }
      }
      if (u && u.realm === P) {
        RD.reach = E.reachable(s, u);
        const U = D.UNITS[u.type];
        if ((U.str || U.rstr) && u.mp > 0) {
          RD.targets = new Set();
          for (const [c, r] of E.inRadius(s, u.c, u.r, U.range || 1)) if (E.canAttack(s, u, c, r).ok && E.visible(s, c, r)) RD.targets.add(c + ',' + r);
        }
      }
      RD.dirty = true;
    },

    onTileClick(c, r) {
      const s = this.s;
      if (!s || s.over) return;
      const u = s.units[this.selUnit];
      const unit = E.unitAt(s, c, r), city = E.cityAt(s, c, r);
      // режим размещения квартала
      if (this.placing && this.selCity) {
        const sc = s.cities[this.selCity];
        if (E.validDistrictTile(s, sc, c, r)) {
          const res = E.setProduction(s, sc.id, { kind: 'district', id: this.placing, c, r });
          this.placing = null; this.placementHint(false);
          SND.play(res.ok ? 'build' : 'error'); this.toast(esc(res.msg));
          return this.refresh();
        }
        return this.toast('Выберите подсвеченную клетку или нажмите Esc.');
      }
      // покупка клетки выбранным городом
      if (this.selCity && !u && RD.cityOverlay && RD.cityOverlay.buyable && RD.cityOverlay.buyable.has(c + ',' + r)) {
        const res = E.buyTile(s, this.selCity, c, r);
        SND.play(res.ok ? 'coin' : 'error'); this.toast(esc(res.msg));
        return this.refresh();
      }
      if (u && u.realm === P && RD.targets && RD.targets.has(c + ',' + r)) return this.doAttack(u, c, r);
      if (u && u.realm === P && ((unit && unit.realm !== P) || (city && city.realm !== P)) && E.visible(s, c, r)) {
        const chk = E.canAttack(s, u, c, r);
        if (chk.needWar) return this.confirmWar(chk.needWar, () => this.doAttack(u, c, r));
        if (!chk.ok && E.dist(u.c, u.r, c, r) > (D.UNITS[u.type].range || 1)) { /* перейти ближе */ } else if (!chk.ok) return this.toast(chk.msg);
      }
      if (unit && unit.realm === P) {
        if (this.selUnit === unit.id && city && city.realm === P) return this.selectCity(city.id);
        SND.play('click');
        return this.selectUnit(unit.id);
      }
      if (city && city.realm === P && (!u || u.realm !== P || !(RD.reach && RD.reach.has(c + ',' + r)))) return this.selectCity(city.id);
      if (u && u.realm === P && E.passable(E.tileAt(s, c, r))) return this.doMove(u, c, r);
      if (city) return this.selectCity(city.id);
      this.selUnit = null; this.selCity = null; this.refresh();
    },
    onTileRight(c, r) {
      const u = this.s && this.s.units[this.selUnit];
      if (!u || u.realm !== P) return;
      if (RD.targets && RD.targets.has(c + ',' + r)) return this.doAttack(u, c, r);
      this.doMove(u, c, r);
    },
    onHover(t) {
      const s = this.s, tip = $('#tile-tip');
      if (!s || !t) { tip.classList.add('hidden'); return; }
      const [c, r] = t;
      const i = E.idx(s, c, r);
      if (!s.explored[i]) { tip.classList.add('hidden'); RD.path = null; return; }
      const tile = s.tiles[i], T = D.TERRAIN[tile.t], y = E.tileYield(s, c, r);
      let html = `<b>${T.name}</b>${tile.res ? ` · ${D.RESOURCES[tile.res].name}` : ''}${T.def ? ` · оборона +${T.def}%` : ''}<br>${A.icon('food', 13)}${y.food} ${A.icon('hammer', 13)}${y.prod} ${A.icon('gold', 13)}${y.gold}`;
      if (tile.imp) html += ` · ${D.IMPROVEMENTS[tile.imp].name}`;
      if (tile.district) html += `<br><b style="color:${D.DISTRICTS[tile.district].color}">${D.DISTRICTS[tile.district].name}</b> (соседство +${E.districtAdjacency(s, c, r, tile.district)})`;
      if (tile.camp) html += '<br><b class="neg">Лагерь разбойников</b> — займите клетку, чтобы разорить (+30 золота)';
      if (this.placing && this.selCity) { const sp = RD.cityOverlay && RD.cityOverlay.spots.find((p) => p.c === c && p.r === r); if (sp) html += `<br><b class="gold">${D.DISTRICTS[this.placing].name}: бонус соседства +${sp.adj}</b>`; }
      if (RD.cityOverlay && RD.cityOverlay.buyable && RD.cityOverlay.buyable.has(c + ',' + r)) html += `<br><b class="gold">Купить клетку: ${RD.cityOverlay.buyable.get(c + ',' + r)} золота (клик)</b>`;
      if (tile.owner) html += `<br><span style="color:${s.realms[tile.owner].color}">■</span> ${s.realms[tile.owner].short}`;
      const unit = E.unitAt(s, c, r);
      if (unit && E.visible(s, c, r)) html += `<br>${D.UNITS[unit.type].name} (${s.realms[unit.realm].short}) · ${unit.hp} HP`;
      const city = E.cityAt(s, c, r);
      if (city) html += `<br><b>${city.name}</b> · ${s.realms[city.realm].short} · сила ${Math.round(E.cityStrength(s, city))} · ${city.hp}/${E.maxCityHp(city)}`;
      const u = s.units[this.selUnit];
      RD.path = null;
      if (u && u.realm === P) {
        const f = (unit && unit.realm !== P) || (city && city.realm !== P) ? E.forecast(s, u, c, r) : null;
        if (f && E.dist(u.c, u.r, c, r) <= (D.UNITS[u.type].range || 1)) html += `<br><b class="gold">Прогноз боя:</b> урон врагу ~${f.city ? f.toDef * 2 : f.toDef}, ваши потери ~${f.toAtt}`;
        else if (E.passable(tile) && !(unit || city)) { const p = E.findPath(s, u, c, r); if (p) { RD.path = p; RD.pathTurns = E.pathTurns(s, u, p); html += `<br>Путь: ${p.length} кл., ходов: ${RD.pathTurns[RD.pathTurns.length - 1]}`; } }
      }
      const [sx, sy] = RD.toScreen(...RD.center(c, r));
      tip.style.left = Math.min(RD.W - 270, sx + 26) + 'px';
      tip.style.top = Math.max(4, sy - 20) + 'px';
      tip.innerHTML = html;
      tip.classList.remove('hidden');
    },

    // =================================================================== ДЕЙСТВИЯ
    doMove(u, c, r) {
      const res = E.moveUnit(this.s, u.id, c, r);
      if (!res.ok) { this.toast(res.msg || 'Нельзя пройти.'); SND.play('error'); return false; }
      SND.play('move');
      if (u.mp <= 0 || u.goto) setTimeout(() => { if (this.selUnit === u.id && (u.mp <= 0)) this.selectNextIdle(true); this.refresh(); }, 250);
      this.refresh();
      return true;
    },
    doAttack(u, c, r) {
      const res = E.attack(this.s, u.id, c, r);
      if (!res.ok) { this.toast(res.msg); return; }
      this.setHero('action', 800);
      setTimeout(() => this.setHero(res.attackerDied ? 'damage' : (res.killed || res.captured) ? 'victory' : 'idle', 1800), 800);
      if (res.captured) { SND.play('fanfare'); this.toast(`${A.icon('city', 18)} Город захвачен!`); }
      this.toast(esc(res.text));
      if (res.attackerDied) this.selUnit = null;
      this.afterAction();
    },
    afterAction() {
      this.refresh();
      this.checkAch();
      if (this.s.over) setTimeout(() => this.finish(), 1200);
    },
    confirmWar(target, then) {
      const R = this.s.realms[target];
      const pact = E.getPact(this.s, P, target);
      const warn = pact === 'alliance' || E.married(this.s, P, target) ? '<p class="neg">Нарушение союза или брачных уз ударит по стабильности и престижу!</p>' : '';
      this.modal(`<h2>Объявить войну?</h2><div class="event-card"><div class="event-art">${A.charPortrait(this.s.chars[R.rulerId], 'angry', 120, true)}</div>
        <div class="event-text"><p>Вы собираетесь объявить войну: <b style="color:${R.color}">${R.name}</b> (${esc(E.rulerTitle(this.s, target))}).</p>
        <p class="muted">Другие правители запомнят агрессию, а ИИ усилит ожидание угрозы от вас.</p>${warn}</div></div>
        <div class="modal-actions"><button class="btn" data-close>Отмена</button><button class="btn btn-primary" id="war-yes">Война!</button></div>`);
      $('#war-yes').onclick = () => { this.closeModal(true); const r = E.diplomacy(this.s, target, 'war'); SND.play('drum'); this.toast(r.msg); then && then(); this.refresh(); };
    },
    unitAction(kind) {
      const s = this.s, u = s.units[this.selUnit];
      if (!u || u.realm !== P) return this.toast('Сначала выберите свой отряд.');
      let r;
      if (kind === 'found') { r = E.foundCity(s, u.id); if (r.ok) { SND.play('city'); this.setHero('victory', 1600); this.selUnit = null; this.selCity = r.city.id; } }
      else if (kind === 'fortify') r = E.fortify(s, u.id);
      else if (kind === 'skip') r = E.skipUnit(s, u.id);
      else if (kind === 'disband') r = E.disband(s, u.id);
      this.toast(esc(r.msg));
      if (!r.ok) SND.play('error');
      if (r.ok && kind !== 'found') this.selectNextIdle(true);
      this.afterAction();
      return r;
    },

    renderSel() {
      const s = this.s, panel = $('#sel-panel');
      const u = s.units[this.selUnit];
      if (!u) { panel.classList.add('hidden'); return; }
      const U = D.UNITS[u.type], R = s.realms[u.realm];
      const mine = u.realm === P;
      const svg = `<img src="${RD.unitIcon(u.type, u.realm === E.BANDITS ? '#4a3a34' : R.color, 22, u.hero ? u.hero.lvl : 0)}" width="44" height="44" alt="">`;
      const heroInfo = u.hero ? (() => { const T = D.HERO_XP, lvl = u.hero.lvl, next = T[lvl]; return `<div class="hero-line"><b class="gold">${esc(u.hero.name)}</b> · уровень ${lvl}${next !== undefined ? ` · опыт ${u.hero.xp}/${next}` : ' (макс.)'}</div><div class="note-s">${esc(U.ability)}. Сила +${(lvl - 1) * 12}% за уровни. Павший герой возвращается через 6 ходов.</div>`; })() : '';
      let actions = '';
      if (mine) {
        if (u.type === 'settler') actions += `<button class="btn btn-primary" data-a="found">${A.icon('settle', 16)} Основать город (B)</button>`;
        if (U.cls !== 'civil') actions += `<button class="btn" data-a="fortify">${A.icon('shield', 16)} Укрепиться (F)</button>`;
        actions += `<button class="btn" data-a="skip">${A.icon('skip', 16)} Ждать</button><button class="btn" data-a="next">${A.icon('next', 16)} Следующий (N)</button><button class="btn" data-a="disband" title="Распустить">${A.icon('trash', 16)}</button>`;
      }
      const site = u.type === 'settler' ? E.canFound(s, u) : null;
      panel.innerHTML = `<div class="sel-head"><div class="unit-badge" style="background:${R.color}">${svg}</div><div><h3>${U.name}</h3><div class="muted" style="font-size:12.5px">${R.short}${u.fort ? ' · укреплён' : ''}${u.goto ? ' · в походе' : ''}</div></div></div>
        <div class="sel-stats"><span>HP <b>${u.hp}</b></span><span>Ходы <b>${u.mp}/${U.mov}</b></span>${U.str ? `<span>Сила <b>${U.str}</b></span>` : ''}${U.rstr ? `<span>Дальний бой <b>${U.rstr}</b> (${U.range})</span>` : ''}</div>
        ${heroInfo}
        ${site && !site.ok ? `<div class="forecast">${esc(site.msg)}</div>` : ''}
        <div class="sel-actions">${actions}</div>`;
      panel.classList.remove('hidden');
      panel.querySelectorAll('[data-a]').forEach((b) => b.onclick = () => (b.dataset.a === 'next' ? this.selectNextIdle() : this.unitAction(b.dataset.a)));
    },

    renderCity() {
      const s = this.s, panel = $('#city-panel'), city = s.cities[this.selCity];
      if (!city) { panel.classList.add('hidden'); return; }
      const R = s.realms[city.realm];
      if (city.realm !== P) {
        panel.innerHTML = `<h3 style="color:${R.color}">${city.name}</h3><p class="muted">${R.name}${city.capital ? ' · столица' : ''}</p>
          <div class="sel-stats"><span>Население <b>${city.pop}</b></span><span>Оборона <b>${Math.round(E.cityStrength(s, city))}</b></span><span>Прочность <b>${city.hp}/${E.maxCityHp(city)}</b></span></div>
          <p class="note-s">Постройки: ${city.buildings.map((b) => D.BUILDINGS[b].name).join(', ') || 'нет'}</p>
          <button class="btn btn-small" data-close-city>Закрыть</button>`;
        panel.classList.remove('hidden');
        panel.querySelector('[data-close-city]').onclick = () => { this.selCity = null; this.refresh(); };
        return;
      }
      const y = E.cityYields(s, city);
      const need = E.growthNeed(city);
      const growT = y.foodNet > 0 ? Math.ceil((need - city.food) / y.foodNet) : '—';
      const items = E.availableItems(s, city);
      const turns = (it) => Math.max(1, Math.ceil((E.itemCost(it) - (city.item && city.item.id === it.id ? city.prod : 0)) / Math.max(0.5, y.prod)));
      const row = (it) => {
        const isU = it.kind === 'unit';
        const def = E.defOf(it);
        const YN = { sci: 'науки', gold: 'золота', culture: 'культуры', prod: 'производства' };
        let desc;
        if (isU) desc = it.id === 'settler' ? 'основывает города' : it.id === 'builder' ? `улучшения клеток, ${def.charges} заряда` : `сила ${def.str}${def.rstr ? `, дальн. ${def.rstr}` : ''}, ходы ${def.mov}`;
        else if (it.kind === 'district') { const sp = E.districtSpots(s, city, it.id)[0]; desc = `${Object.entries(def.base).map(([k, v]) => `+${v} ${YN[k]}`).join(', ')}; лучшее место: +${sp ? sp.adj : 0} за соседство — выбор клетки на карте`; }
        else desc = def.desc;
        const on = city.item && city.item.id === it.id;
        const ic = isU ? (def.cls === 'civil' ? 'settle' : 'army') : it.kind === 'district' ? 'city' : 'hammer';
        return `<button class="prod-item ${on ? 'on' : ''}" data-k="${it.kind}" data-id="${it.id}">${A.icon(ic, 20)}<span>${def.name}<small>${desc}</small></span><span class="turns">${turns(it)} х.</span></button>`;
      };
      const cur = city.item ? `${E.itemName(city.item)} — ${Math.floor(city.prod)}/${E.itemCost(city.item)} <span class="muted">(${turns(city.item)} х.)</span>` : '<b class="neg">не выбрано</b>';
      const buy = city.item ? E.buyCost(city) : 0;
      panel.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center"><h3>${city.capital ? A.icon('crown', 18) : ''} ${city.name}</h3><button class="btn btn-small" data-close-city>×</button></div>
        <div class="sel-stats"><span>Население <b>${city.pop}</b></span><span>Рост <b>${city.food}/${need}</b> (${growT} х.)</span><span>Прочность <b>${city.hp}/${E.maxCityHp(city)}</b></span></div>
        <div class="yields"><div class="yield">${A.icon('food', 16)}<b>${y.foodNet >= 0 ? '+' : ''}${y.foodNet}</b>еда</div><div class="yield">${A.icon('hammer', 16)}<b>${y.prod}</b>произв.</div><div class="yield">${A.icon('gold', 16)}<b>${y.gold}</b>золото</div><div class="yield">${A.icon('science', 16)}<b>${y.sci}</b>наука</div><div class="yield">${A.icon('culture', 16)}<b>${y.culture}</b>культ.</div></div>
        <div>Производство: ${cur}</div>
        ${city.item ? `<button class="btn btn-small" id="btn-buy" ${s.realms[P].gold < buy ? 'disabled' : ''} style="margin-top:6px">${A.icon('gold', 16)} Купить за ${buy}</button>` : ''}
        <div class="section-h">Отряды</div><div class="prod-list">${items.filter((i) => i.kind === 'unit').map(row).join('')}</div>
        <div class="section-h">Кварталы</div><div class="prod-list">${items.filter((i) => i.kind === 'district').map(row).join('') || '<span class="note-s">Кварталы откроют технологии (Письменность, Деньги, Мистицизм, Бронза)</span>'}</div>
        <div class="section-h">Постройки</div><div class="prod-list">${items.filter((i) => i.kind === 'building').map(row).join('') || '<span class="note-s">Новые постройки откроют технологии и кварталы</span>'}</div>
        <div class="section-h">Возведено</div><div class="note-s">${[...Object.keys(city.districts || {}).map((d) => D.DISTRICTS[d].name), ...city.buildings.map((b) => D.BUILDINGS[b].name)].join(', ') || 'пока ничего'}</div>
        <p class="note-s">На карте: точки — доход клеток, белая рамка — обрабатываемые, золотая пунктирная — можно купить (клик).</p>`;
      panel.classList.remove('hidden');
      panel.querySelector('[data-close-city]').onclick = () => { this.selCity = null; this.placing = null; this.placementHint(false); this.refresh(); };
      panel.querySelectorAll('.prod-item').forEach((b) => b.onclick = () => {
        if (b.dataset.k === 'district') { this.placing = b.dataset.id; this.placementHint(true); SND.play('click'); return this.refresh(); }
        this.produce(city.id, { kind: b.dataset.k, id: b.dataset.id });
      });
      const bb = $('#btn-buy'); if (bb) bb.onclick = () => this.buy(city.id);
    },
    produce(cityId, item) {
      const r = E.setProduction(this.s, cityId, item);
      SND.play(r.ok ? 'build' : 'error');
      this.toast(esc(r.msg));
      this.refresh();
      return r;
    },
    buy(cityId) { const r = E.buyItem(this.s, cityId); SND.play(r.ok ? 'coin' : 'error'); this.toast(esc(r.msg)); this.refresh(); return r; },

    // =================================================================== ХОД
    endTurn() {
      const s = this.s;
      if (!s || s.over) return;
      if (s.pendingEvent) return this.showEvent();
      this.closeModal(true);
      const lostBefore = s.stats.unitsLost, capBefore = E.citiesOf(s, P).length;
      const rep = E.endTurn(s);
      SND.play('drum');
      if (!s.over) S.saveGame(s);
      if (s.stats.unitsLost > lostBefore || E.citiesOf(s, P).length < capBefore) this.setHero('damage', 2200);
      if (this.selUnit && !s.units[this.selUnit]) this.selUnit = null;
      this.refresh();
      this.checkAch();
      if (s.over) return this.finish();
      this.queue = [];
      if (s.pendingEvent) this.queue.push({ kind: 'event' });
      for (const p of s.proposals) this.queue.push({ kind: 'proposal', id: p.id });
      this.nextQueued();
      if (!this.selUnit) this.selectNextIdle(true);
      const notes = rep.notes.filter((n) => n.type === 'war' || n.type === 'diplo').length;
      this.toast(`${E.year(s)} год${notes ? ` · важных событий: ${notes}` : ''}`);
    },

    nextQueued() {
      const q = this.queue.shift();
      if (!q) return;
      if (q.kind === 'event') return this.showEvent();
      if (q.kind === 'proposal') return this.showProposal(q.id);
    },

    showEvent() {
      const s = this.s, ev = D.EVENTS.find((e) => e.id === s.pendingEvent);
      if (!ev) return;
      SND.play('notify');
      this.modal(`<h2>${ev.title}</h2><div class="event-card"><div class="event-art">${A.charPortrait(this.ruler(), 'neutral', 130, true)}</div>
        <div><p class="event-text">${ev.text}</p>${ev.choices.map((c, i) => `<button class="btn choice" data-ch="${i}">${esc(c.label)}</button>`).join('')}</div></div>`, { dismissable: false });
      this.activeEvent = true;
      $('#modal-box').querySelectorAll('[data-ch]').forEach((b) => b.onclick = () => this.chooseEvent(+b.dataset.ch));
      this.speak(`${ev.title}. ${ev.text}`);
    },
    chooseEvent(i) {
      const r = E.chooseEvent(this.s, i);
      this.activeEvent = false;
      this.closeModal(true);
      this.toast(esc(r.msg));
      this.afterAction();
      this.nextQueued();
    },

    showProposal(id) {
      const s = this.s, p = s.proposals.find((x) => x.id === id);
      if (!p) return this.nextQueued();
      const R = s.realms[p.from];
      const texts = {
        trade: ['предлагает торговый договор', '+3 золота за ход каждой стороне, открытые границы.'],
        alliance: ['предлагает военный союз', 'Союзники вступают в ваши оборонительные войны; нужен для «Союза корон».'],
        marriage: ['предлагает династический брак', 'Постоянно +25 к мнению, престиж обоим домам. Нарушить брак войной — позор.'],
        peace: ['предлагает мир', 'Война прекращается.'],
        tribute_demand: [`требует дань: ${p.amount} золота`, 'Отказ резко ухудшит отношения и может привести к войне.'],
      }[p.type];
      this.activeProposal = id;
      SND.play('notify');
      this.modal(`<h2>Послание: ${esc(E.rulerTitle(s, p.from))}</h2><div class="event-card"><div class="event-art">${A.charPortrait(s.chars[R.rulerId], p.type === 'tribute_demand' ? 'angry' : 'happy', 130, true)}</div>
        <div class="event-text"><p><b style="color:${R.color}">${R.name}</b> ${texts[0]}.</p><p class="muted">${texts[1]}</p><p>Мнение о вас: <b>${E.opinion(s, p.from, P)}</b></p><p class="note-s">Голосом: «принять» или «отклонить».</p></div></div>
        <div class="modal-actions"><button class="btn" id="pr-no">Отклонить</button><button class="btn btn-primary" id="pr-yes">Принять</button></div>`, { dismissable: false });
      $('#pr-yes').onclick = () => this.answerProposal(true);
      $('#pr-no').onclick = () => this.answerProposal(false);
      this.speak(`${E.rulerTitle(s, p.from)} ${texts[0]}`);
    },
    answerProposal(accept) {
      const r = E.respondProposal(this.s, this.activeProposal, accept);
      this.activeProposal = null;
      this.closeModal(true);
      SND.play(accept ? 'coin' : 'click');
      this.toast(esc(r.msg));
      this.afterAction();
      this.nextQueued();
    },

    // =================================================================== ТЕХНОЛОГИИ
    openTech() {
      const s = this.s, R = s.realms[P];
      const depth = {};
      const dep = (t) => (depth[t.id] !== undefined ? depth[t.id] : (depth[t.id] = t.req.length ? 1 + Math.max(...t.req.map((q) => dep(D.TECHS.find((x) => x.id === q)))) : 0));
      D.TECHS.forEach(dep);
      const cols = [];
      for (const t of D.TECHS) (cols[depth[t.id]] = cols[depth[t.id]] || []).push(t);
      const sci = E.realmIncome(s, P).sci;
      const unlocks = (id) => [...Object.values(D.UNITS).filter((u) => u.req === id).map((u) => u.name), ...Object.values(D.BUILDINGS).filter((b) => b.req === id).map((b) => b.name), id === 'feudalism' ? 'вассалитет' : null, id === 'philosophy' ? '+счёт' : null].filter(Boolean).join(', ');
      const html = cols.map((col) => `<div class="tech-col">${col.map((t) => {
        const done = R.techs.includes(t.id), avail = E.techAvailable(s, P, t.id), cur = R.researching === t.id;
        const cost = E.techCost(s, t);
        return `<button class="tech ${done ? 'done' : avail ? 'avail' : 'locked'} ${cur ? 'cur' : ''}" data-t="${t.id}" ${!avail || done ? 'disabled' : ''}><b>${t.name}</b><small>${done ? 'изучено' : `${cost} науки · ~${Math.ceil(cost / Math.max(0.5, sci))} х.`}</small><small>${unlocks(t.id)}</small>${t.req.length ? `<small>← ${t.req.map((q) => D.TECHS.find((x) => x.id === q).name).join(', ')}</small>` : ''}</button>`;
      }).join('')}</div>`).join('');
      this.modal(`<h2>${A.icon('science', 26)} Древо технологий</h2><p class="muted">Наука: +${sci} за ход. Изучено ${R.techs.length} из ${D.TECHS.length}.</p><div class="tech-tree">${html}</div>
        <div class="modal-actions"><button class="btn btn-primary" data-close>Закрыть</button></div>`, { wide: true });
      $('#modal-box').querySelectorAll('[data-t]').forEach((b) => b.onclick = () => { this.research(b.dataset.t); this.openTech(); });
    },
    // =================================================================== ИНСТИТУТЫ И ПОЛИТИКИ
    openCivics() {
      const s = this.s, R = s.realms[P];
      const depth = {};
      const dep = (c) => (depth[c.id] !== undefined ? depth[c.id] : (depth[c.id] = c.req.length ? 1 + Math.max(...c.req.map((q) => dep(D.CIVICS.find((x) => x.id === q)))) : 0));
      D.CIVICS.forEach(dep);
      const cols = [];
      for (const c of D.CIVICS) (cols[depth[c.id]] = cols[depth[c.id]] || []).push(c);
      const cul = Math.max(0.5, E.realmIncome(s, P).culture);
      const tree = cols.map((col) => `<div class="tech-col">${col.map((cv) => {
        const done = R.civics.includes(cv.id), avail = E.civicAvailable(s, P, cv.id), cur = R.civicResearch === cv.id, cost = E.civicCost(s, cv, P);
        const un = [...cv.unlocks.map((p) => D.POLICIES[p].name), cv.slot ? `+1 слот (${cv.slot === 'military' ? 'военный' : 'экономический'})` : null].filter(Boolean).join(', ');
        return `<button class="tech ${done ? 'done' : avail ? 'avail' : 'locked'} ${cur ? 'cur' : ''}" data-cv="${cv.id}" ${!avail || done ? 'disabled' : ''}><b>${cv.name}</b><small>${done ? 'принят' : `${cost} культуры · ~${Math.ceil(cost / cul)} х.`}</small><small>${un}</small></button>`;
      }).join('')}</div>`).join('');
      const slots = E.policySlots(s, P), un = E.unlockedPolicies(s, P);
      const pol = R.policies;
      const cards = un.map((id) => { const p = D.POLICIES[id]; const on = pol[p.slot].includes(id); return `<button class="policy ${p.slot} ${on ? 'on' : ''}" data-pol="${id}"><b>${p.name}</b>${p.desc}</button>`; }).join('') || '<p class="note-s">Политики откроются с первыми институтами.</p>';
      this.modal(`<h2>${A.icon('culture', 26)} Институты и политики</h2><p class="muted">Культура +${cul.toFixed(1)} за ход. Принято ${R.civics.length} из ${D.CIVICS.length}.</p>
        <div class="tech-tree civics-tree">${tree}</div>
        <h3>Политики</h3><div class="slots"><span class="slot">Военные: ${pol.military.length}/${slots.military}</span><span class="slot">Экономические: ${pol.economic.length}/${slots.economic}</span></div>
        <div class="policy-grid">${cards}</div>
        <div class="modal-actions"><button class="btn btn-primary" data-close>Закрыть</button></div>`, { wide: true });
      const box = $('#modal-box');
      box.querySelectorAll('[data-cv]').forEach((b) => b.onclick = () => { const r = E.setCivic(s, P, b.dataset.cv); SND.play('notify'); this.toast(esc(r.msg)); this.refresh(); this.openCivics(); });
      box.querySelectorAll('[data-pol]').forEach((b) => b.onclick = () => {
        const id = b.dataset.pol, kind = D.POLICIES[id].slot;
        const list = pol[kind].includes(id) ? pol[kind].filter((x) => x !== id) : [...pol[kind], id];
        if (list.length > slots[kind]) list.shift();
        const next = { ...pol, [kind]: list };
        const r = E.setPolicies(s, P, next.military, next.economic);
        SND.play(r.ok ? 'build' : 'error');
        this.refresh(); this.openCivics();
      });
    },

    research(id) { const r = E.setResearch(this.s, P, id); SND.play(r.ok ? 'tech' : 'error'); this.toast(esc(r.msg)); this.refresh(); return r; },

    // =================================================================== ДИПЛОМАТИЯ
    showAIDetails() { return S.profile.settings.aiDetails || (this.s && this.s.boosts.spies); },
    openDiplomacy() {
      const s = this.s;
      const rows = s.order.filter((id) => id !== P).map((id) => {
        const R = s.realms[id];
        if (!R.alive) return `<div class="realm-row" style="opacity:.5"><div></div><div><span class="rname">${R.name}</span> — пало</div><div></div></div>`;
        const ch = s.chars[R.rulerId];
        const op = E.opinion(s, id, P);
        const pact = R.overlord === P ? 'vassal' : E.getPact(s, P, id);
        const mood = op > 25 ? 'happy' : op < -20 || pact === 'war' ? 'angry' : 'neutral';
        const br = E.opinionBreakdown(s, id, P).map((m) => `<span class="${m.value >= 0 ? 'pos' : 'neg'}">${m.value > 0 ? '+' : ''}${m.value} ${esc(m.label)}</span>`).join('');
        const intel = s.aiIntel[id] || [];
        const ai = this.showAIDetails()
          ? `<div class="ai-box">${A.icon('brain', 14)} Замысел: <b class="intent">${AI.RealmAI.intentLabel(s, intel.find((c) => c.target) || intel[0])}</b> · ожидает нападения от вас: <b>${pct(AI.RealmAI.threatFrom(s, id, P))}%</b></div>`
          : `<div class="ai-box note-s">Замыслы правителя скрыты — нужны «Королевские шпионы» или режим демонстрации ИИ.</div>`;
        const btn = (t, label, ic) => `<button class="btn" data-d="${t}" data-r="${id}">${A.icon(ic, 15)} ${label}</button>`;
        return `<div class="realm-row"><div>${A.charPortrait(ch, mood, 84, true)}</div>
          <div><span class="rname" style="color:${R.color}">${R.name}</span><span class="pact ${pact}">${PACT[pact]}</span>${E.married(s, P, id) ? `<span class="pact">${A.icon('ring', 12)} брак</span>` : ''}
            <div class="muted" style="font-size:13px">${esc(E.rulerTitle(s, id))}, ${ch.age} лет · города: ${E.citiesOf(s, id).length} · армия: ${Math.round(E.militaryPower(s, id))} (ваша ${Math.round(E.militaryPower(s, P))})</div>
            <div class="traits-mini">${ch.traits.map((t) => `<span class="trait">${D.TRAITS[t].name}</span>`).join('')}</div>
            <div style="display:flex;align-items:center;gap:8px;margin-top:5px;font-size:13px">Мнение <div class="bar op" style="flex:1"><i style="width:${(op + 100) / 2}%"></i></div><b>${op > 0 ? '+' : ''}${op}</b></div>
            <div class="op-list">${br}</div>${ai}</div>
          <div class="dip-actions">${btn('gift', 'Дары 50', 'gift')}${btn('trade', 'Торговля', 'trade')}${btn('alliance', 'Союз', 'handshake')}${btn('marriage', 'Брак', 'ring')}${btn('peace', 'Мир', 'peace')}${btn('tribute', 'Вассалитет', 'tribute')}${btn('war', 'Война', 'war')}</div></div>`;
      }).join('');
      this.modal(`<h2>${A.icon('diplomacy', 26)} Дипломатия</h2><div class="realm-list">${rows}</div><div class="modal-actions"><button class="btn btn-primary" data-close>Закрыть</button></div>`, { wide: true });
      $('#modal-box').querySelectorAll('[data-d]').forEach((b) => b.onclick = () => this.diplo(b.dataset.r, b.dataset.d, true));
    },
    diplo(target, type, reopen) {
      if (type === 'war') return this.confirmWar(target, () => reopen && this.openDiplomacy());
      const r = E.diplomacy(this.s, target, type, 50);
      SND.play(r.ok ? (r.accepted === false ? 'error' : 'coin') : 'error');
      this.toast(esc(r.msg), 4200);
      this.speak(r.msg);
      if (r.accepted) this.setHero('victory', 1500);
      this.afterAction();
      if (reopen && !this.s.over) this.openDiplomacy();
      return r;
    },

    // =================================================================== ДИНАСТИЯ
    openDynasty() {
      const s = this.s, R = s.realms[P], ruler = this.ruler(), heir = s.chars[R.heirId];
      const card = (ch, title, isRuler) => {
        if (!ch) return '<div class="char-card">Нет наследника</div>';
        const st = Object.keys(D.STATS).map((k) => `<span>${D.STATS[k]}: <b>${E.stat(s, ch.id, k)}</b></span>`).join('');
        return `<div class="char-card"><div>${A.charPortrait(ch, isRuler ? 'happy' : 'neutral', 130, isRuler)}</div><div><h3>${title}</h3><div class="gold" style="font-family:var(--head)">${esc(ch.name)}</div><div class="muted">${ch.age} лет · ${ch.female ? 'женщина' : 'мужчина'}</div>
          <div class="traits-mini" style="margin-top:6px">${ch.traits.map((t) => `<span class="trait big" title="${esc(Object.entries(D.TRAITS[t].fx).map(([k, v]) => `${D.STATS[k] || k}: ${v > 0 ? '+' : ''}${v}`).join(', '))}">${D.TRAITS[t].name}</span>`).join('')}</div><div class="stats4">${st}</div></div></div>`;
      };
      const others = s.order.filter((id) => id !== P && s.realms[id].alive).map((id) => {
        const c = s.chars[s.realms[id].rulerId];
        return `<div class="court">${A.charPortrait(c, 'neutral', 52, true)}<div><b style="color:${s.realms[id].color}">${esc(E.rulerTitle(s, id))}</b><br>${c.age} лет · ${c.traits.map((t) => D.TRAITS[t].name).join(', ')}</div></div>`;
      }).join('');
      this.modal(`<h2>${A.icon('dynasty', 26)} ${D.REALMS[P].dynasty}</h2>
        <p>Престиж: <b class="gold">${Math.round(R.prestige)}</b> · стабильность: <b>${Math.round(R.stability)}</b> (цель ${E.stabilityTarget(s, P)}) · смен правителей: ${s.stats.successions} · браков: ${s.stats.marriages}</p>
        <div class="char-grid">${card(ruler, E.rulerTitle(s, P).split(' ')[0], true)}${card(heir, 'Наследник', false)}</div>
        <h3>Правители мира</h3><div class="courts">${others}</div>
        <p class="note-s">Черты правителя влияют на характеристики, стабильность и мнения других правителей. Когда правитель умирает, трон переходит наследнику — и соседи пересматривают отношения.</p>
        <div class="modal-actions"><button class="btn btn-primary" data-close>Закрыть</button></div>`, { wide: true });
    },

    // =================================================================== ГОЛОС
    toggleMic() {
      if (!this.s) return;
      if (!V.supported()) { this.toast('Голос работает в Chrome и Edge. Пока можно вводить приказы текстом.', 3800); $('#cmd-input').focus(); return; }
      SND.unlock();
      if (V.listening) V.stop(); else V.start($('#chk-continuous').checked);
    },

    nlpContext() {
      const s = this.s;
      return {
        realms: s.order.filter((id) => id !== P && s.realms[id].alive).map((id) => ({ id, keys: D.REALMS[id].keys })),
        items: [...Object.entries(D.UNITS).map(([id, u]) => ({ id, kind: 'unit', keys: u.keys })), ...Object.entries(D.BUILDINGS).map(([id, b]) => ({ id, kind: 'building', keys: b.keys })),
          ...Object.entries(D.DISTRICTS).map(([id, d]) => ({ id, kind: 'district', keys: d.keys })), ...Object.entries(D.IMPROVEMENTS).map(([id, im]) => ({ id, kind: 'improvement', keys: im.keys }))],
        techs: D.TECHS.map((t) => ({ id: t.id, keys: t.keys })),
        cities: E.citiesOf(s, P).map((c) => ({ id: c.id, name: c.name })),
      };
    },

    handleSpeech(alts, source) {
      if (!this.s) return;
      const ctx = this.nlpContext();
      let best = null;
      for (const a of alts) { const r = NLP.parse(a.text, ctx); r.score = (r.intent === 'unknown' ? 0 : r.confidence) * (a.confidence || 0.8); if (!best || r.score > best.score) best = r; }
      this.lastCommands.unshift({ text: best.text, intent: best.intent, confidence: best.confidence, source });
      this.lastCommands = this.lastCommands.slice(0, 8);
      if (source === 'voice') this.s.stats.voiceCommands++; else this.s.stats.textCommands++;
      $('#voice-transcript').textContent = `«${best.text}»`;
      const ents = [best.target && this.s.realms[best.target].short, best.dir !== null && best.dir !== undefined && E.DIR_NAMES[best.dir], best.item && E.itemName(best.item), best.tech && D.TECHS.find((t) => t.id === best.tech).name].filter(Boolean).join(', ');
      $('#voice-parse').innerHTML = `${A.icon('brain', 13)} ${NLP.INTENT_NAMES[best.intent]} <span class="conf"><i style="width:${pct(best.confidence)}%"></i></span> ${pct(best.confidence)}%${ents ? ' · ' + esc(ents) : ''}`;
      this.execute(best, source);
    },

    say(msg, source) { this.toast(esc(msg), 3500); if (source === 'voice') this.speak(msg); },

    execute(cmd, source) {
      const s = this.s;
      let intent = cmd.intent;
      if (this.activeProposal && (intent === 'accept' || intent === 'decline')) return this.answerProposal(intent === 'accept');
      if (this.activeEvent && (intent === 'accept' || intent === 'decline')) { const ev = D.EVENTS.find((e) => e.id === s.pendingEvent); return this.chooseEvent(intent === 'accept' ? 0 : ev.choices.length - 1); }
      const DIP = { declare_war: 'war', peace: 'peace', alliance: 'alliance', trade: 'trade', marriage: 'marriage', gift: 'gift', tribute: 'tribute' };
      if (intent === 'unknown' && cmd.target && this.pendingIntent) intent = this.pendingIntent;
      if (intent === 'unknown') { SND.play('error'); return this.say('Не понял приказ. Скажите «помощь», чтобы узнать команды.', source); }
      const u = s.units[this.selUnit];
      const myUnit = u && u.realm === P ? u : null;
      switch (intent) {
        case 'end_turn': return this.endTurn();
        case 'next_unit': return this.selectNextIdle();
        case 'help': return this.openHelp();
        case 'pause': return this.openPause();
        case 'open_tech': return this.openTech();
        case 'open_diplomacy': return this.openDiplomacy();
        case 'open_dynasty': return this.openDynasty();
        case 'open_civics': return this.openCivics();
        case 'improve': {
          let b = myUnit && myUnit.type === 'builder' ? myUnit : null;
          if (!b) { b = E.unitsOf(s, P).find((x) => x.type === 'builder' && E.improvementsFor(s, x).length); if (b) this.selUnit = b.id; }
          if (!b) return this.say('Нет строителей на клетке, которую можно улучшить.', source);
          return this.improve(cmd.item && cmd.item.kind === 'improvement' ? cmd.item.id : undefined);
        }
        case 'accept': case 'decline': return this.say('Нет посланий, ожидающих ответа.', source);
        case 'status': {
          const R = s.realms[P], inc = E.realmIncome(s, P);
          return this.say(`${E.year(s)} год. Казна ${R.gold} золота, ${inc.net >= 0 ? 'доход' : 'убыток'} ${Math.abs(inc.net)} за ход. Городов ${E.citiesOf(s, P).length}, отрядов ${E.unitsOf(s, P).length}. Стабильность ${Math.round(R.stability)}. ${R.researching ? 'Изучаем ' + D.TECHS.find((t) => t.id === R.researching).name : 'Исследование не выбрано'}.`, source);
        }
        case 'found_city': {
          let su = myUnit && myUnit.type === 'settler' ? myUnit : E.unitsOf(s, P).find((x) => x.type === 'settler');
          if (!su) return this.say('Нет поселенцев. Обучите их в городе с населением 2+.', source);
          this.selUnit = su.id;
          return this.unitAction('found');
        }
        case 'fortify': return this.unitAction('fortify');
        case 'skip': return this.unitAction('skip');
        case 'move': {
          if (!myUnit) return this.say('Сначала выберите отряд.', source);
          if (cmd.dir === null || cmd.dir === undefined) return this.say('Куда идти? Например: «идти на северо-восток».', source);
          let [c, r] = [myUnit.c, myUnit.r];
          const n = Math.max(1, Math.min(8, cmd.amount || D.UNITS[myUnit.type].mov));
          for (let i = 0; i < n; i++) { const [nc, nr] = E.step(c, r, cmd.dir); if (!E.inb(s, nc, nr) || !E.passable(E.tileAt(s, nc, nr))) break; [c, r] = [nc, nr]; }
          if (c === myUnit.c && r === myUnit.r) return this.say('В ту сторону не пройти.', source);
          return this.doMove(myUnit, c, r);
        }
        case 'attack': {
          if (!myUnit) return this.say('Выберите отряд для атаки.', source);
          let target = null;
          if (cmd.dir !== null && cmd.dir !== undefined) target = E.step(myUnit.c, myUnit.r, cmd.dir);
          else {
            let bv = -1e9;
            for (const [c, r] of E.inRadius(s, myUnit.c, myUnit.r, D.UNITS[myUnit.type].range || 1)) {
              const chk = E.canAttack(s, myUnit, c, r);
              if (!chk.ok && !chk.needWar) continue;
              const v = AI.RealmAI.attackValue(s, myUnit, c, r);
              if (v > bv) { bv = v; target = [c, r]; }
            }
          }
          if (!target) return this.say('Рядом нет врагов.', source);
          const chk = E.canAttack(s, myUnit, target[0], target[1]);
          if (chk.needWar) return this.confirmWar(chk.needWar, () => this.doAttack(myUnit, target[0], target[1]));
          if (!chk.ok) return this.say(chk.msg, source);
          return this.doAttack(myUnit, target[0], target[1]);
        }
        case 'produce': {
          const city = s.cities[cmd.city] || s.cities[this.selCity] || s.cities[s.realms[P].capitalId];
          if (!city || city.realm !== P) return this.say('Какой город?', source);
          if (!cmd.item) { this.selectCity(city.id, true); return this.say(`Что строить в городе ${city.name}?`, source); }
          this.selCity = city.id;
          const r = this.produce(city.id, cmd.item);
          if (source === 'voice') this.speak(r.msg);
          return r;
        }
        case 'buy': {
          const city = s.cities[this.selCity] || s.cities[cmd.city] || s.cities[s.realms[P].capitalId];
          return city ? this.buy(city.id) : null;
        }
        case 'research': {
          if (!cmd.tech) return this.openTech();
          const r = this.research(cmd.tech);
          if (source === 'voice') this.speak(r.msg);
          return r;
        }
        case 'select_city': {
          const city = s.cities[cmd.city] || s.cities[s.realms[P].capitalId];
          return city ? this.selectCity(city.id, true) : null;
        }
        default: break;
      }
      if (DIP[intent]) {
        if (!cmd.target) { this.pendingIntent = intent; return this.say(`${NLP.INTENT_NAMES[intent]} — с какой державой?`, source); }
        this.pendingIntent = null;
        if (intent === 'declare_war') { const r = E.diplomacy(s, cmd.target, 'war'); SND.play('drum'); this.say(r.msg, source); return this.afterAction(); }
        return this.diplo(cmd.target, DIP[intent], false);
      }
    },

    onKey(e) {
      const typing = /INPUT|TEXTAREA/.test(document.activeElement && document.activeElement.tagName);
      const game = $('#scr-game').classList.contains('active');
      if (e.key === 'Escape' && this.placing && !this.isModal()) { this.placing = null; this.placementHint(false); this.refresh(); return; }
      if (e.key === 'Escape') { if (this.isModal() && this.modalDismissable) this.closeModal(); else if (game && !this.isModal()) { if (this.selUnit || this.selCity) { this.selUnit = null; this.selCity = null; this.refresh(); } else this.openPause(); } return; }
      if (typing || !game || this.isModal()) return;
      const k = e.key.toLowerCase();
      const map = { h: () => this.selectHero(), р: () => this.selectHero(), m: () => this.toggleMic(), ь: () => this.toggleMic(), n: () => this.selectNextIdle(), т: () => this.selectNextIdle(), f: () => this.unitAction('fortify'), а: () => this.unitAction('fortify'), b: () => this.unitAction('found'), и: () => this.unitAction('found'), t: () => this.openTech(), е: () => this.openTech(), g: () => this.openDiplomacy(), п: () => this.openDiplomacy(), r: () => this.openDynasty(), к: () => this.openDynasty(), p: () => this.openCivics(), з: () => this.openCivics(), ' ': () => this.unitAction('skip'), enter: () => this.endTurn() };
      const pan = { arrowleft: [-80, 0], arrowright: [80, 0], arrowup: [0, -80], arrowdown: [0, 80], a: [-80, 0], d: [80, 0], w: [0, -80], s: [0, 80], ф: [-80, 0], в: [80, 0], ц: [0, -80], ы: [0, 80] };
      if (pan[k]) { e.preventDefault(); RD.pan(...pan[k]); return; }
      if (map[k]) { e.preventDefault(); map[k](); }
    },

    // =================================================================== МОДАЛКИ
    modal(html, opts) {
      opts = opts || {};
      const box = $('#modal-box');
      box.className = 'modal-box panel' + (opts.wide ? ' wide' : '');
      this.modalDismissable = opts.dismissable !== false;
      box.innerHTML = (this.modalDismissable ? '<button class="modal-close" data-close>×</button>' : '') + html;
      this._onClose = opts.onClose || null;
      $('#modal').classList.remove('hidden');
      box.querySelectorAll('[data-close]').forEach((b) => b.onclick = () => this.closeModal());
    },
    isModal() { return !$('#modal').classList.contains('hidden'); },
    closeModal(silent) {
      if (!this.isModal()) return;
      $('#modal').classList.add('hidden');
      clearInterval(this._adTimer);
      const cb = this._onClose; this._onClose = null;
      if (cb && !silent) cb();
    },

    openPause() {
      if (!this.s) return;
      V.stop();
      this.modal(`<h2>Меню</h2><p class="muted">${E.level(this.s).name} · ${E.year(this.s)} год</p>
        <div class="menu-buttons"><button class="btn btn-primary" data-close>Продолжить</button><button class="btn" id="p-help">${A.icon('scroll', 20)} Как играть</button>
        <button class="btn" id="p-set">${A.icon('gear', 20)} Настройки</button><button class="btn" id="p-restart">Начать сценарий заново</button><button class="btn" id="p-exit">Сохранить и выйти в меню</button></div>`);
      $('#p-help').onclick = () => this.openHelp();
      $('#p-set').onclick = () => this.openSettings();
      $('#p-restart').onclick = () => { this.closeModal(true); this.startGame(this.s.level, {}); };
      $('#p-exit').onclick = () => { S.saveGame(this.s); this.closeModal(true); this.showMenu(); };
    },
    openSettings() {
      const st = S.profile.settings;
      const row = (k, l, d) => `<div class="setting"><div><b>${l}</b><br><span class="note-s">${d}</span></div><input type="checkbox" data-set="${k}" ${st[k] ? 'checked' : ''}></div>`;
      this.modal(`<h2>Настройки</h2>${row('sound', 'Звуковые эффекты', 'Мечи, монеты, фанфары')}${row('music', 'Музыка', 'Фоновая мелодия')}${row('voiceFeedback', 'Озвучивание', 'Синтез речи читает события и ответы')}${row('aiDetails', 'Режим демонстрации ИИ', 'Показывать замыслы и оценки ИИ-правителей (для защиты проекта)')}
        <div class="setting"><div><b>Сбросить прогресс</b><br><span class="note-s">Рекорды, достижения, покупки, обученная модель ИИ</span></div><button class="btn btn-small" id="s-reset">Сбросить</button></div>
        <div class="modal-actions"><button class="btn btn-primary" data-close>Готово</button></div>`);
      $('#modal-box').querySelectorAll('[data-set]').forEach((c) => c.onchange = () => { st[c.dataset.set] = c.checked; S.persist(); this.applySettings(); });
      $('#s-reset').onclick = () => { if (!confirm('Удалить весь прогресс?')) return; S.reset(); this.applySettings(); this.closeModal(true); this.showMenu(); };
    },
    openHelp() {
      const cmds = [['основать город', 'поселенцы основывают город'], ['следующий отряд', 'выбрать отряд без приказа'], ['идти на северо-восток', 'шесть направлений гекса'], ['атаковать', 'лучшая цель рядом'], ['укрепиться / ждать', 'приказ отряду'],
        ['нанять лучников', 'производство в выбранном городе или столице'], ['построить амбар в Сольвене', 'можно назвать город'], ['купить', 'выкупить производство золотом'], ['изучить письменность', 'выбрать исследование'],
        ['предложить брак империи', 'дипломатия'], ['торговый договор с республикой', ''], ['объявить войну орде', ''], ['заключить мир', ''], ['доклад', 'сводка о державе'], ['следующий ход', ''], ['принять / отклонить', 'ответ на послание или событие']];
      this.modal(`<h2>Как играть</h2><div class="cols2"><div>
        <h3>Основы</h3><ul><li><b>Карта:</b> перетаскивайте мышью, колёсико — масштаб, WASD/стрелки — обзор.</li><li><b>Отряд:</b> клик — выбрать, клик по клетке — идти (подсвечены ходы), красная рамка — враг в досягаемости.</li>
        <li><b>Города:</b> растут от еды, производят отряды и постройки, расширяют границы культурой.</li><li><b>Наука:</b> древо технологий открывает новые отряды и постройки.</li>
        <li><b>Правители:</b> стареют и умирают, трон наследует наследник с другими чертами. Черты влияют на характеристики, стабильность и мнения соседей.</li>
        <li><b>Мнение</b> каждого правителя складывается из причин — смотрите их в окне «Дипломатия».</li><li><b>Стабильность</b> падает от войн и разрастания; храмы и справедливый правитель её поднимают. При 0 — мятеж.</li>
        <li><b>Герои (H):</b> у каждой державы есть свой герой — Паладин лечит соседей, Полководец усиливает соседние отряды на 20%, Следопыт стреляет на 2 клетки, Берсерк яростен в атаке. Бои дают опыт (до 5 уровня, +12% силы за уровень). Павший герой возвращается в столицу через 6 ходов.</li>
        <li><b>Карта:</b> реки дают +1 золото, на севере — снежная тундра, на юге — вулкан и огненные пустоши (+2 производства).</li></ul>
        <h3>Победа</h3><ul><li>Захватить столицы всех соперников;</li><li>Союз корон: все — союзники или вассалы (минимум один вассал), продержать ${E.UNION_TURNS} ходов;</li><li>Наибольший счёт к последнему ходу.</li></ul>
        <h3>Клавиши</h3><p>Enter — ход · H — герой · N — следующий отряд · F — укрепиться · B — основать город · Пробел — ждать · T — наука · G — дипломатия · R — династия · M — микрофон · Esc — меню</p></div>
        <div><h3>Голосовые приказы ${A.icon('mic', 18)}</h3><ul>${cmds.map(([c, d]) => `<li><code>${c}</code>${d ? ' — ' + d : ''}</li>`).join('')}</ul></div></div>
        <div class="modal-actions"><button class="btn btn-primary" data-close>Понятно</button></div>`, { wide: true });
    },

    openAIPanel() {
      const s = this.s; if (!s) return;
      const m = s.playerModel, prof = m.profile;
      const w = AI.PlayerModel.FEATURE_NAMES.map((n, i) => `<tr><td>${n}</td><td>${AI.PlayerModel.PRIOR[i].toFixed(2)}</td><td><b>${m.w[i].toFixed(2)}</b></td></tr>`).join('');
      const spark = (vals) => { if (vals.length < 2) return '<span class="note-s">нет данных</span>'; const W = 150, H = 30; return `<svg class="spark" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#0f0b08" stroke="#4a3a26"/><polyline points="${vals.map((v, i) => `${(i / (vals.length - 1)) * W},${H - (v / 100) * H}`).join(' ')}" fill="none" stroke="#ff8a6a" stroke-width="2"/></svg>`; };
      const rulers = E.aiIds(s).map((id) => `<tr><td style="color:${s.realms[id].color}"><b>${s.realms[id].short}</b></td><td>${pct(AI.RealmAI.threatFrom(s, id, P))}%</td><td>${spark(s.threatHistory.map((h) => h[id] || 0))}</td><td>${this.showAIDetails() ? AI.RealmAI.intentLabel(s, (s.aiIntel[id] || []).find((c) => c.target) || (s.aiIntel[id] || [])[0]) : 'скрыто'}</td></tr>`).join('');
      const bar = (l, v) => `<div style="display:flex;gap:8px;align-items:center;font-size:13px;margin:3px 0"><span style="width:96px" class="muted">${l}</span><div class="bar trait-bar" style="flex:1"><i style="width:${pct(v)}%"></i></div></div>`;
      const cmds = this.lastCommands.map((c) => `<tr><td>«${esc(c.text)}»</td><td>${NLP.INTENT_NAMES[c.intent]}</td><td>${pct(c.confidence)}%</td><td>${c.source === 'voice' ? 'голос' : 'текст'}</td></tr>`).join('') || '<tr><td colspan="4" class="note-s">Команд ещё не было</td></tr>';
      this.modal(`<h2>${A.icon('brain', 26)} ИИ-аналитика</h2><div class="cols2"><div>
        <h3>Модель игрока (онлайн-логистическая регрессия)</h3><p>Обучающих примеров: <b>${m.n}</b> · стиль: <b class="gold">${AI.PlayerModel.style(prof).name}</b></p>
        <table class="lb"><tr><th>Признак</th><th>Априори</th><th>Сейчас</th></tr>${w}</table>
        <h3>Профиль игрока</h3>${bar('Хозяйство', prof.econ)}${bar('Армия', prof.military)}${bar('Дипломатия', prof.diplo)}${bar('Агрессия', prof.aggression)}</div>
        <div><h3>ИИ-правители (Utility AI + тактика)</h3><p>Адаптивная сложность ×${s.difficulty.toFixed(2)} · напряжённость ${s.tension}%</p>
        <table class="lb"><tr><th>Держава</th><th>Угроза</th><th>Динамика</th><th>Замысел</th></tr>${rulers}</table>
        <h3>NLP голосовых приказов (наивный Байес)</h3><p>Намерений: ${Object.keys(NLP.model.classes).length} · признаков: ${NLP.model.vocab.size} · фраз корпуса: ${NLP.model.total}</p>
        <table class="lb"><tr><th>Фраза</th><th>Намерение</th><th>Увер.</th><th>Ввод</th></tr>${cmds}</table></div></div>
        <div class="modal-actions"><button class="btn btn-primary" data-close>Закрыть</button></div>`, { wide: true });
    },

    // =================================================================== ЛАВКА
    openShop(tab) {
      tab = tab || 'seals';
      const p = S.profile;
      const tabs = [['seals', 'Печати и издание'], ['items', 'Усиления'], ['skins', 'Облики'], ['ads', 'Бесплатные печати']];
      let body = '';
      if (tab === 'seals') body = `<div class="shop-grid"><div class="shop-item premium-card"><span class="ribbon">Лучший выбор</span><h4>${A.icon('crown', 20)} ${Shop.PREMIUM.label}</h4><p>Сценарий III сразу · без межуровневой рекламы · облик «Золотой стяг» · двойная награда за рекламу.</p><div><b>${Shop.PREMIUM.price} ₽</b> разово</div><button class="btn btn-primary btn-small" data-premium ${p.premium ? 'disabled' : ''}>${p.premium ? 'Активно' : 'Купить'}</button></div>
        ${Shop.PACKS.map((k) => `<div class="shop-item">${k.badge ? `<span class="ribbon">${k.badge}</span>` : ''}<h4>${A.icon('seal', 20)} ${k.label}</h4><p>${k.seals} королевских печатей</p><div><b>${k.price} ₽</b></div><button class="btn btn-small" data-pack="${k.id}">Купить</button></div>`).join('')}</div>`;
      else if (tab === 'items') body = `<div class="shop-grid">${Shop.ITEMS.map((it) => `<div class="shop-item"><h4>${A.icon(it.icon, 20)} ${it.name}</h4><p>${it.desc}</p><div>${A.icon('seal', 15)} ${it.cost} · в запасе ${p.inventory[it.id] || 0}</div><button class="btn btn-small" data-item="${it.id}" ${p.seals < it.cost ? 'disabled' : ''}>Купить</button></div>`).join('')}</div><p class="note-s">Усиления выбираются перед партией. Рекорды с усилениями помечаются в таблице.</p>`;
      else if (tab === 'skins') body = `<div class="shop-grid">${Shop.SKINS.map((sk) => { const own = p.skins.owned.includes(sk.id), act = p.skins.active === sk.id; return `<div class="shop-item"><div class="skin-preview" style="display:flex;justify-content:center">${A.king({ state: 'idle', robe: sk.robe, robeDark: sk.robeDark })}</div><h4>${sk.name}</h4><button class="btn btn-small" data-skin="${sk.id}" ${act || (sk.premium && !own) ? 'disabled' : ''}>${act ? 'Выбран' : own ? 'Выбрать' : sk.premium ? 'В издании' : sk.cost + ' печатей'}</button></div>`; }).join('')}</div>`;
      else body = `<div class="ad-box"><p>Посмотрите ролик и получите <b>+${p.premium ? 30 : 15}</b> печатей. Осталось сегодня: <b>${Shop.adsLeft()}</b> из ${Shop.AD_LIMIT}.</p><button class="btn btn-primary" data-ad ${Shop.adsLeft() <= 0 ? 'disabled' : ''}>${A.icon('play', 20)} Смотреть</button></div>`;
      this.modal(`<h2>${A.icon('seal', 26)} Королевская лавка</h2><p>Ваши печати: <b class="gold">${p.seals}</b></p>
        <div class="tabs">${tabs.map(([id, n]) => `<button class="tab ${id === tab ? 'active' : ''}" data-tab="${id}">${n}</button>`).join('')}</div>${body}
        <p class="note-s">Прототип: оплата в демо-режиме, деньги не списываются, данные карт не запрашиваются. В релизе — платёжный сервис (ЮKassa / Google Play Billing).</p>`, { wide: true });
      const box = $('#modal-box');
      box.querySelectorAll('[data-tab]').forEach((b) => b.onclick = () => this.openShop(b.dataset.tab));
      box.querySelectorAll('[data-pack]').forEach((b) => b.onclick = () => this.confirmPay(Shop.PACKS.find((k) => k.id === b.dataset.pack), () => Shop.purchasePack(b.dataset.pack)));
      box.querySelectorAll('[data-premium]').forEach((b) => b.onclick = () => this.confirmPay(Shop.PREMIUM, () => Shop.purchasePremium()));
      box.querySelectorAll('[data-item]').forEach((b) => b.onclick = () => this.shopDone(Shop.buyItem(b.dataset.item), 'items'));
      box.querySelectorAll('[data-skin]').forEach((b) => b.onclick = () => { this.shopDone(Shop.buySkin(b.dataset.skin), 'skins'); if (this.s) this.renderRuler(); });
      box.querySelectorAll('[data-ad]').forEach((b) => b.onclick = () => this.playAd(true, () => this.openShop('ads')));
    },
    confirmPay(prod, run) {
      this.modal(`<h2>Подтверждение покупки</h2><p><b>${prod.label}</b> — ${prod.price} ₽</p><p class="note-s">Демонстрационный режим: платёж имитируется, деньги не списываются.</p>
        <div class="modal-actions"><button class="btn" id="pay-no">Отмена</button><button class="btn btn-primary" id="pay-ok">Оплатить (демо)</button></div>`);
      $('#pay-no').onclick = () => this.openShop();
      $('#pay-ok').onclick = () => { $('#pay-ok').disabled = true; $('#pay-ok').textContent = 'Обработка…'; setTimeout(() => this.shopDone(run(), 'seals'), 800); };
    },
    shopDone(r, tab) { SND.play(r.ok ? 'coin' : 'error'); this.toast(esc(r.msg), 3200); if (r.ok) S.checkAchievements({ profile: S.profile }); this.openShop(tab); if ($('#scr-menu').classList.contains('active')) this.showMenu(); },
    playAd(rewarded, done) {
      let left = rewarded ? 5 : 4;
      this.modal(`<h2>Реклама партнёра</h2><div class="ad-box"><div class="ad-art">${A.logo(80)}<div>Ages of Dominion: Королевское издание<br><span style="font-size:14px">Сценарий III · без рекламы · Золотой стяг</span></div></div><div id="ad-timer" class="note-s" style="margin-top:8px"></div></div>
        <div class="modal-actions"><button class="btn" id="ad-skip" disabled>Пропустить</button></div>`, { dismissable: false });
      const tick = () => { $('#ad-timer').textContent = left > 0 ? `Осталось ${left} с…` : 'Ролик досмотрен'; if (!rewarded && left <= 2) $('#ad-skip').disabled = false; if (left <= 0) { clearInterval(this._adTimer); $('#ad-skip').disabled = false; $('#ad-skip').textContent = rewarded ? 'Забрать награду' : 'Продолжить'; } left--; };
      tick(); this._adTimer = setInterval(tick, 1000);
      $('#ad-skip').onclick = () => { clearInterval(this._adTimer); if (rewarded && left < 0) { const r = Shop.rewardAd(); SND.play('coin'); this.toast(r.msg); } this.closeModal(true); done && done(); };
    },

    openRecords() {
      const p = S.profile;
      const lb = p.leaderboard.length ? `<table class="lb"><tr><th>#</th><th>Правитель</th><th>Сценарий</th><th>Итог</th><th>Очки</th><th>Дата</th></tr>${p.leaderboard.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.name)}${r.boosted ? ' ' + A.icon('seal', 13) : ''}</td><td>${r.level}</td><td>${r.result === 'win' ? 'победа' : 'поражение'}</td><td><b>${r.score}</b></td><td>${r.date}</td></tr>`).join('')}</table>` : '<p class="note-s">Сыграйте партию, чтобы попасть в летопись.</p>';
      const ach = D.ACHIEVEMENTS.map((a) => `<div class="ach ${p.achievements[a.id] ? '' : 'locked'}">${A.icon(p.achievements[a.id] ? 'star' : 'lock', 24)}<div><b>${a.name}</b>${a.desc}</div></div>`).join('');
      const st = p.stats;
      this.modal(`<h2>${A.icon('trophy', 26)} Летопись славы</h2><div class="stat-grid"><div class="stat"><b>${st.games}</b>партий</div><div class="stat"><b>${st.wins}</b>побед</div><div class="stat"><b>${st.bestScore}</b>лучший счёт</div><div class="stat"><b>${st.voiceCommands}</b>голосовых приказов</div></div>
        <h3>Таблица рекордов</h3>${lb}<h3>Достижения (${Object.keys(p.achievements).length}/${D.ACHIEVEMENTS.length})</h3><div class="ach-grid">${ach}</div>
        <div class="modal-actions"><button class="btn btn-primary" data-close>Закрыть</button></div>`, { wide: true });
    },
    checkAch() { if (!this.s) return; for (const a of S.checkAchievements({ state: this.s, profile: S.profile })) { this.toast(`${A.icon('star', 18)} Достижение: ${a.name}`, 3000); SND.play('fanfare'); } },

    // =================================================================== ФИНАЛ
    finish() {
      const s = this.s;
      if (!s || !s.over || this._fin === s) return;
      this._fin = s;
      V.stop(); this.closeModal(true);
      const res = S.recordResult(s);
      const win = s.over.result === 'win';
      const skin = Shop.activeSkin();
      const L = E.level(s);
      const next = win && L.id < 3;
      const ranking = s.order.map((id) => [id, E.score(s, id)]).sort((a, b) => b[1] - a[1]);
      $('#scr-result').innerHTML = `<div class="result-box panel"><div>${A.king({ state: win ? 'victory' : 'damage', robe: skin.robe, robeDark: skin.robeDark })}</div>
        <div><h1 class="${win ? 'win' : 'lose'}">${win ? 'Победа!' : 'Поражение'}</h1><p>${esc(s.over.text)}</p><div class="score-big">${s.over.score} очков</div>
        <p>${L.name} · ${E.year(s)} год · ход ${Math.min(s.turn, s.turnLimit)}${res.rank ? ` · место в летописи: <b>${res.rank}</b>` : ''}</p>
        <div class="stat-grid"><div class="stat"><b>${E.citiesOf(s, P).length}</b>городов</div><div class="stat"><b>${s.stats.unitsKilled}</b>врагов разбито</div><div class="stat"><b>${s.realms[P].techs.length}</b>технологий</div><div class="stat"><b>${AI.PlayerModel.style(s.playerModel.profile).name}</b>стиль (ИИ)</div></div>
        <h3>Итоговый счёт держав</h3><table class="lb">${ranking.map(([id, sc]) => `<tr><td style="color:${s.realms[id].color}">${s.realms[id].name}</td><td>${s.realms[id].alive ? sc : 'пала'}</td></tr>`).join('')}</table>
        ${res.fresh.length ? `<h3>Новые достижения</h3><p>${res.fresh.map((a) => `${A.icon('star', 16)} ${a.name}`).join(' · ')}</p>` : ''}
        <div class="modal-actions" style="justify-content:flex-start">${next ? '<button class="btn btn-primary" id="r-next">Следующий сценарий</button>' : ''}<button class="btn" id="r-retry">Сыграть снова</button><button class="btn" id="r-rec">${A.icon('trophy', 16)} Летопись</button><button class="btn" id="r-menu">В меню</button></div></div></div>`;
      this.show('scr-result');
      SND.play(win ? 'fanfare' : 'fail');
      const go = () => this.startGame(L.id + 1, {});
      if (next) $('#r-next').onclick = () => (Shop.showInterstitial() ? this.playAd(false, go) : go());
      $('#r-retry').onclick = () => this.startGame(L.id, {});
      $('#r-rec').onclick = () => this.openRecords();
      $('#r-menu').onclick = () => this.showMenu();
    },
  };

  RF.UI = UI;
})(window);
