/* =========================================================================
 * AGES OF DOMINION — ИИ держав.
 *
 * 1) PlayerModel — онлайн-машинное обучение (логистическая регрессия + SGD):
 *    каждый ход ИИ учится предсказывать, нападёт ли игрок на конкретную
 *    державу. Веса сохраняются между партиями. Профиль стиля игрока.
 * 2) RealmAI — стратегический Utility AI правителя: личность из черт
 *    характера, мнения, угрозы, адаптивная сложность → дипломатия
 *    (войны, мир, торговля, союзы, браки, дань, коалиции), выбор
 *    производства и исследований.
 * 3) Тактический ИИ отрядов: поиск пути, оценка боя (прогноз урона),
 *    атаки, осада городов, оборона, выбор места для новых городов.
 * ========================================================================= */
(function (root) {
  const RF = (root.RF = root.RF || {});
  const E = () => RF.Engine;
  const D = () => RF.Data;
  const sig = (x) => 1 / (1 + Math.exp(-x));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const PLAYER = 'aurelia';

  // ============================================================ PlayerModel
  const PRIOR = [-2.8, 1.3, 1.0, 2.2, 1.6, 0.8, -2.2];
  const FEATURE_NAMES = ['смещение', 'перевес армии игрока', 'враждебность', 'агрессивность игрока', 'идёт война', 'милитаризм игрока', 'союз / брак / вассал'];

  const PlayerModel = {
    PRIOR, FEATURE_NAMES,
    create(saved) {
      const w = saved && Array.isArray(saved.w) && saved.w.length === PRIOR.length ? saved.w.slice() : PRIOR.slice();
      return { w, n: (saved && saved.n) || 0, lr: 0.15, l2: 0.02, profile: { econ: 0.4, military: 0.3, diplo: 0.3, aggression: 0.05 } };
    },
    features(s, id) {
      const ratio = clamp(E().militaryPower(s, PLAYER) / Math.max(1, E().militaryPower(s, id)), 0, 3) / 1.5;
      const hostility = clamp(-E().opinion(s, id, PLAYER), -100, 100) / 100;
      const pact = E().getPact(s, id, PLAYER);
      const m = s.playerModel.profile;
      const bond = pact === 'alliance' || E().married(s, id, PLAYER) || s.realms[id].overlord === PLAYER ? 1 : 0;
      return [1, ratio, hostility, m.aggression, pact === 'war' ? 1 : 0, m.military, bond];
    },
    predict(model, x) { let z = 0; for (let i = 0; i < x.length; i++) z += model.w[i] * x[i]; return sig(z); },
    update(model, x, y) {
      const p = this.predict(model, x);
      for (let i = 0; i < x.length; i++) model.w[i] += model.lr * ((y - p) * x[i] - model.l2 * (model.w[i] - PRIOR[i]));
      model.n++;
      return p;
    },
    observe(model, kind) {
      const a = 0.15;
      if (['econ', 'military', 'diplo'].includes(kind)) for (const c of ['econ', 'military', 'diplo']) model.profile[c] = model.profile[c] * (1 - a) + (c === kind ? a : 0);
      if (kind === 'attack') {
        model.profile.aggression = model.profile.aggression * 0.75 + 0.25;
        for (const c of ['econ', 'military', 'diplo']) model.profile[c] = model.profile[c] * (1 - a) + (c === 'military' ? a : 0);
      }
    },
    endTurn(model, attacked) { if (!attacked) model.profile.aggression *= 0.9; },
    style(p) {
      if (p.aggression > 0.3) return { id: 'conqueror', name: 'Завоеватель' };
      const top = ['econ', 'military', 'diplo'].sort((a, b) => p[b] - p[a])[0];
      return { econ: { id: 'builder', name: 'Строитель' }, military: { id: 'warlord', name: 'Полководец' }, diplo: { id: 'diplomat', name: 'Дипломат' } }[top];
    },
    serialize(model) { return { w: model.w.map((v) => Math.round(v * 1000) / 1000), n: model.n }; },
  };

  // ============================================================ RealmAI: стратегия
  function bonded(s, a, b) {
    return E().getPact(s, a, b) === 'alliance' || s.realms[a].overlord === b || s.realms[b].overlord === a;
  }

  function threatFrom(s, me, o) {
    if (!s.realms[o] || !s.realms[o].alive || !s.realms[me].alive) return 0;
    let t;
    if (o === PLAYER && me !== PLAYER) t = PlayerModel.predict(s.playerModel, PlayerModel.features(s, me));
    else {
      const ratio = E().militaryPower(s, o) / Math.max(1, E().militaryPower(s, me));
      const pact = E().getPact(s, me, o);
      t = sig((ratio - 1) * 2 - E().opinion(s, o, me) / 40 + E().personality(s, o).aggression * 1.6 - 2.2 + (pact === 'war' ? 1.8 : 0));
    }
    if (bonded(s, me, o) || E().married(s, me, o)) t *= 0.35;
    return t;
  }

  function nearness(s, a, b) {
    let best = 99;
    for (const c1 of E().citiesOf(s, a)) for (const c2 of E().citiesOf(s, b)) best = Math.min(best, E().dist(c1.c, c1.r, c2.c, c2.r));
    return best;
  }

  function recently(s, R, type, turns) { return R.lastProposal && R.lastProposal[type] !== undefined && s.turn - R.lastProposal[type] < turns; }

  function evaluate(s, me) {
    const R = s.realms[me];
    const p = E().personality(s, me);
    const L = E().level(s);
    const myPow = E().militaryPower(s, me);
    const others = E().aliveIds(s).filter((o) => o !== me);
    const threats = {};
    let maxThreat = 0;
    for (const o of others) { threats[o] = threatFrom(s, me, o); maxThreat = Math.max(maxThreat, threats[o]); }
    const cities = E().citiesOf(s, me).length;
    const wars = others.filter((o) => E().getPact(s, me, o) === 'war');
    const cands = [];
    const add = (type, u, extra) => cands.push(Object.assign({ type, u: Math.round(u * 1000) / 1000 }, extra || {}));
    const diff = s.difficulty || 1;
    // Стратегическая установка (для производства)
    add('expand', p.expansion * 0.8 * (cities < 3 + Math.round(p.expansion * 4) ? 1 : 0.2) - wars.length * 0.2);
    add('build', 0.35 + p.greed * 0.2 + (1 - p.aggression) * 0.2);
    add('arm', 0.15 + maxThreat * 0.7 + p.aggression * 0.3 + (wars.length ? 0.4 : 0));
    add('fortify', maxThreat * p.caution * 0.8);
    for (const o of others) {
      const O = s.realms[o];
      const pact = E().getPact(s, me, o);
      const op = E().opinion(s, me, o);
      let theirPow = E().militaryPower(s, o);
      for (const x of others) if (x !== o && E().getPact(s, o, x) === 'alliance') theirPow += E().militaryPower(s, x) * 0.4;
      const ratio = myPow / Math.max(1, theirPow);
      const near = nearness(s, me, o);
      const vsPlayer = o === PLAYER;
      const bond = bonded(s, me, o);
      const marriedTo = E().married(s, me, o);
      const graceBlock = vsPlayer && s.turn <= L.grace ? 5 : 0;
      const pBias = vsPlayer ? (diff - 1) * 0.6 : 0;
      if (pact !== 'war' && !bond && near <= 12 && ratio > 1.1) {
        const landHunger = p.expansion > 0.5 && !E().citiesOf(s, me).some((c) => findSite(s, me, c.c, c.r, 7)) ? 0.25 : 0;
        add('declare_war', p.aggression * 0.55 + (Math.min(ratio, 3) - 1.3) * 0.45 + (op < -20 ? 0.2 : 0) + (op < -50 ? 0.15 : 0) + landHunger + (R.grudge || 0) * 0.1 + pBias +
          (vsPlayer ? threats[o] * p.aggression * 0.3 : 0) - p.honor * (pact === 'trade' ? 0.3 : 0.15) - (marriedTo ? 0.35 * p.honor + 0.1 : 0) - graceBlock - 0.25 - (wars.length ? 0.3 : 0), { target: o });
      }
      if (pact === 'war') {
        const w = s.wars[E().pairKey(me, o)] || { start: s.turn, loss: {} };
        const myLoss = w.loss[me] || { units: 0, cities: 0 }, theirLoss = w.loss[o] || { units: 0, cities: 0 };
        const score = (theirLoss.cities - myLoss.cities) * 2 + (theirLoss.units - myLoss.units) * 0.3;
        add('war', 0.3 + p.aggression * 0.3, { target: o });
        add('offer_peace', (Math.min(2.5, 1 / Math.max(0.25, ratio)) - 0.9) * 0.6 - score * 0.08 + (R.stability < 35 ? 0.3 : 0) + (s.turn - w.start) * 0.015 + p.caution * 0.1 - p.aggression * 0.2 -
          (vsPlayer && recently(s, R, 'peace', 4) ? 1 : 0), { target: o });
      }
      if (pact === 'peace' && op > -15) add('propose_trade', 0.1 + p.greed * 0.4 + op / 250 - (recently(s, R, vsPlayer ? 'trade' : 'trade_' + o, 6) ? 1 : 0), { target: o });
      if ((pact === 'peace' || pact === 'trade') && !bond) {
        let coal = 0;
        if (L.coalition && !vsPlayer && me !== PLAYER) coal = Math.min(threatFrom(s, me, PLAYER), threatFrom(s, o, PLAYER));
        const allies = others.filter((x) => E().getPact(s, me, x) === 'alliance').length;
        const u = (vsPlayer ? (op - 35) / 100 + (pact === 'trade' ? 0.1 : 0) + Math.max(0, ...others.filter((x) => x !== o).map((x) => threats[x])) * 0.3 * p.caution
          : (op - 30) / 120 + coal * 1.1 * p.caution) - allies * 0.3;
        if (op > (vsPlayer ? 30 : 20) || coal > 0.4) add('propose_alliance', u - (recently(s, R, vsPlayer ? 'alliance' : 'alliance_' + o, 8) ? 1 : 0), { target: o, coalition: coal > 0.4 });
      }
      if (!marriedTo && pact !== 'war' && op > 10) add('propose_marriage', 0.05 + op / 200 + (1 - p.aggression) * 0.1 - (recently(s, R, vsPlayer ? 'marriage' : 'marriage_' + o, 10) ? 1 : 0), { target: o });
      if (vsPlayer && pact !== 'war' && !bond && ratio > 1.7) add('demand_tribute', p.aggression * 0.3 + p.greed * 0.3 + (Math.min(ratio, 3) - 1.7) * 0.25 - p.honor * 0.2 - graceBlock - (recently(s, R, 'tribute_demand', 6) ? 1 : 0), { target: o });
      if (pact !== 'war' && R.gold > 150 && threats[o] > 0.45) add('gift', threats[o] * p.caution * 0.4 - p.greed * 0.2, { target: o });
    }
    cands.sort((a, b) => b.u - a.u);
    return { cands, threats, maxThreat, wars, personality: p };
  }

  function softmaxPick(s, list, T) {
    const max = list[0].u;
    const ws = list.map((c) => Math.exp((c.u - max) / T));
    let r = E().rand(s) * ws.reduce((a, b) => a + b, 0);
    for (let i = 0; i < list.length; i++) { r -= ws[i]; if (r <= 0) return list[i]; }
    return list[list.length - 1];
  }

  function respond(s, me, from, type) {
    const p = E().personality(s, me);
    const op = E().opinion(s, me, from);
    const fear = clamp(E().militaryPower(s, from) / Math.max(1, E().militaryPower(s, me)), 0, 3);
    const pact = E().getPact(s, me, from);
    let score = 0, prob;
    if (type === 'trade') { score = p.greed * 0.4 + op / 100 * 0.6 - (pact === 'war' ? 1 : 0); prob = sig((score - 0.15) * 8); }
    else if (type === 'alliance') {
      let common = 0;
      for (const o of E().aliveIds(s)) if (o !== me && o !== from) common = Math.max(common, Math.min(threatFrom(s, me, o), threatFrom(s, from, o)));
      const ladder = pact === 'trade' || E().married(s, me, from) ? 0 : common > 0.4 ? 0.1 : 0.35;
      const aggr = from === PLAYER ? s.playerModel.profile.aggression * 0.5 : 0;
      const allies = E().aliveIds(s).filter((x) => x !== me && E().getPact(s, me, x) === 'alliance').length;
      score = op / 100 * 0.9 + common * 0.6 + (fear > 1.3 ? 0.15 : 0) - p.aggression * 0.25 + p.honor * 0.1 - aggr - ladder - (op < 30 && common < 0.4 ? 0.3 : 0) - allies * 0.15;
      prob = sig((score - 0.45) * 8);
    } else if (type === 'marriage') { score =op / 100 * 0.8 + (fear > 1.2 ? 0.15 : 0) + (1 - p.aggression) * 0.15 - (from === PLAYER ? s.playerModel.profile.aggression * 0.3 : 0); prob = sig((score - 0.3) * 8); }
    else if (type === 'peace') {
      const w = s.wars[E().pairKey(me, from)] || { start: s.turn, loss: {} };
      const myLoss = w.loss[me] || { units: 0, cities: 0 }, theirLoss = w.loss[from] || { units: 0, cities: 0 };
      score = (fear - 1) * 0.5 + (myLoss.cities - theirLoss.cities) * 0.25 + (myLoss.units - theirLoss.units) * 0.05 + (s.realms[me].stability < 35 ? 0.25 : 0) + p.caution * 0.2 + (s.turn - w.start) * 0.02 - p.aggression * 0.3;
      prob = sig((score - 0.05) * 7);
    } else if (type === 'tribute') {
      score = (fear - 1.8) * 0.6 + p.caution * 0.2 - p.honor * 0.15 - p.aggression * 0.25 + (E().citiesOf(s, me).length <= 1 ? 0.3 : 0);
      prob = sig(score * 7);
    }
    prob = clamp(prob || 0, 0.02, 0.98);
    const accept = E().rand(s) < prob;
    const yes = ['«Да будет так. Скрепим печатями».', '«Это разумно. Мы согласны».', '«Мой совет одобряет. Договорились».'];
    const no = ['«Нет. Это не в наших интересах».', '«Вы просите слишком многого».', '«Мой ответ — нет, и не просите снова».'];
    return { accept, prob: Math.round(prob * 100) / 100, score: Math.round(score * 100) / 100, line: E().pick(s, accept ? yes : no) };
  }

  function applyDiplomacy(s, me, act) {
    const o = act.target;
    if (!o || !s.realms[o] || !s.realms[o].alive) return;
    const R = s.realms[me];
    R.lastProposal = R.lastProposal || {};
    const toPlayer = o === PLAYER;
    switch (act.type) {
      case 'declare_war': E().declareWar(s, me, o); break;
      case 'offer_peace':
        if (toPlayer) { E().pushProposal(s, me, 'peace'); break; }
        if (respond(s, o, me, 'peace').accept) E().makePeace(s, me, o);
        R.lastProposal['peace_' + o] = s.turn;
        break;
      case 'propose_trade': case 'propose_alliance': case 'propose_marriage': {
        const type = act.type.replace('propose_', '');
        if (toPlayer) { E().pushProposal(s, me, type); break; }
        R.lastProposal[type + '_' + o] = s.turn;
        if (respond(s, o, me, type).accept) {
          E().applyAgreement(s, me, o, type);
          if (act.coalition) E().log(s, `Коалиция! ${s.realms[me].short} и ${s.realms[o].short} объединились против растущей мощи ${s.realms[PLAYER].short}.`, 'war');
        }
        break;
      }
      case 'demand_tribute':
        if (toPlayer) E().pushProposal(s, me, 'tribute_demand', { amount: Math.round(clamp(s.realms[PLAYER].gold * 0.3, 30, 150)) });
        break;
      case 'gift':
        R.gold -= 50; s.realms[o].gold += 50;
        E().addOpinion(s, o, me, 'Подарки', 12, 12, true);
        if (toPlayer) E().log(s, `${E().rulerTitle(s, me)} присылает дары: +50 золота.`, 'diplo');
        break;
      default: break;
    }
  }

  // ============================================================ Производство и наука
  const MILITARY_TECHS = ['bronze', 'archery', 'horse', 'iron', 'math', 'engineering', 'chivalry', 'feudalism'];
  const ECON_TECHS = ['agriculture', 'currency', 'masonry'];
  function chooseResearch(s, me) {
    const R = s.realms[me];
    if (R.researching) return;
    const p = E().personality(s, me);
    const lrn = E().stat(s, R.rulerId, 'lrn');
    const opts = D().TECHS.filter((t) => E().techAvailable(s, me, t.id));
    if (!opts.length) return;
    let best = null, bv = -1;
    for (const t of opts) {
      let w = 0.6;
      if (MILITARY_TECHS.includes(t.id)) w += p.aggression * 0.8;
      if (ECON_TECHS.includes(t.id)) w += p.greed * 0.6 + 0.2;
      if (['writing', 'mysticism', 'philosophy'].includes(t.id)) w += lrn / 12;
      if (['writing', 'currency', 'mysticism'].includes(t.id)) w += 0.45; // открывают кварталы
      const v = w / Math.sqrt(t.cost) + E().rand(s) * 0.02;
      if (v > bv) { bv = v; best = t; }
    }
    R.researching = best.id;
  }

  function bestMilitaryUnit(s, me, preferRanged) {
    const R = s.realms[me];
    const opts = Object.entries(D().UNITS).filter(([id, u]) => u.cls !== 'civil' && !u.hero && (!u.req || R.techs.includes(u.req)));
    const score = ([, u]) => Math.max(u.str, u.rstr * 1.1) / Math.pow(u.cost, 0.55) + (preferRanged && u.range ? 0.6 : 0) + (u.cls === 'siege' ? -0.3 : 0);
    opts.sort((a, b) => score(b) - score(a));
    return opts[0][0];
  }

  function chooseProduction(s, city, ev) {
    const me = city.realm;
    const R = s.realms[me];
    const p = ev.personality;
    const avail = E().availableItems(s, city);
    const has = (id) => avail.some((i) => i.id === id);
    const units = E().unitsOf(s, me);
    const mil = units.filter((u) => D().UNITS[u.type].cls !== 'civil').length;
    const settlers = units.filter((u) => u.type === 'settler').length;
    const cities = E().citiesOf(s, me).length;
    const y = E().cityYields(s, city);
    const inc = E().realmIncome(s, me);
    const top = ev.cands.filter((c) => ['expand', 'build', 'arm', 'fortify'].includes(c.type)).reduce((m, c) => (m[c.type] = c.u, m), {});
    const opts = [];
    if (city.pop >= 2 && settlers < 1 && hasSite(s, me, city)) opts.push(['unit', 'settler', (top.expand || 0) + 0.25]);
    const milU = (top.arm || 0) + (mil < cities ? 0.5 : 0) - (mil > cities * 3 ? 0.6 : 0) - (mil >= cities * 1.5 && !ev.wars.length ? 0.35 : 0) - (inc.net < 0 ? 0.5 : 0) + (ev.wars.length ? 0.3 : 0);
    opts.push(['unit', bestMilitaryUnit(s, me, E().rand(s) < 0.35), milU]);
    if (ev.wars.length && E().rand(s) < 0.3 && has('catapult')) opts.push(['unit', 'catapult', milU]);
    const b = (id, u) => { if (has(id)) opts.push(['building', id, u]); };
    b('granary', y.foodNet < 3 ? 0.55 : 0.25);
    b('workshop', 0.38);
    b('market', 0.3 + p.greed * 0.35 + (inc.net < 2 ? 0.25 : 0));
    b('library', 0.3 + (1 - p.aggression) * 0.15);
    b('temple', R.stability < 50 ? 0.6 : 0.18);
    b('walls', ev.maxThreat * 0.6 + (city.capital ? 0.1 : 0) + (top.fortify || 0) * 0.5);
    b('castle', ev.maxThreat * 0.5 + (top.fortify || 0) * 0.4);
    // строители и кварталы
    const builders = units.filter((u) => u.type === 'builder').length;
    const todo = E().inRadius(s, city.c, city.r, city.radius).filter(([c, r]) => improvable(s, me, c, r)).length;
    if (todo >= 2 && builders < cities) opts.push(['unit', 'builder', 0.42 + todo * 0.03]);
    const lrn = E().stat(s, R.rulerId, 'lrn');
    const dU = { campus: 0.42 + lrn / 30, commercial: 0.36 + p.greed * 0.3, holy: R.stability < 50 ? 0.55 : 0.28, encampment: ev.maxThreat * 0.5 + p.aggression * 0.15 };
    for (const it of avail.filter((i) => i.kind === 'district')) {
      const spot = E().districtSpots(s, city, it.id)[0];
      opts.push(['district', it.id, dU[it.id] + 0.12 + spot.adj * 0.08, spot]);
    }
    b('barracks', ev.wars.length ? 0.45 : 0.15 + p.aggression * 0.2);
    opts.sort((a, b2) => b2[2] - a[2] + (E().rand(s) - 0.5) * 0.04);
    const [kind, id, , spot] = opts[0];
    city.item = kind === 'district' ? { kind, id, c: spot.c, r: spot.r } : { kind, id };
    // Покупка при угрозе
    if (kind === 'unit' && id !== 'settler' && ev.maxThreat > 0.6 && R.gold > E().buyCost(city) + 60 && city.prod < E().itemCost(city.item)) E().buyItem(s, city.id);
  }

  // ============================================================ Тактика отрядов
  function improvable(s, me, c, r) {
    const t = E().tileAt(s, c, r);
    if (!t || t.owner !== me || t.cityId || t.district || t.imp) return false;
    return E().improvementsFor(s, { type: 'builder', realm: me, c, r }).length > 0;
  }
  function nearestCamp(s, u, maxD) {
    let best = null, bd = maxD + 1;
    for (const [c, r] of s.camps || []) { const d = E().dist(u.c, u.r, c, r); if (d < bd) { bd = d; best = [c, r]; } }
    return best;
  }
  function hasSite(s, me, city) { return !!findSite(s, me, city.c, city.r, 9); }

  function siteScore(s, c, r) {
    let v = 0;
    for (const [a, b] of E().inRadius(s, c, r, 2)) {
      const t = E().tileAt(s, a, b);
      if (t.owner) continue;
      const y = E().tileYield(s, a, b);
      v += (y.food * 1.3 + y.prod + y.gold * 0.7) * (E().dist(c, r, a, b) === 1 ? 1 : 0.5);
    }
    return v;
  }

  function findSite(s, me, fc, fr, maxD) {
    let best = null, bv = 0;
    for (const [c, r] of E().inRadius(s, fc, fr, maxD)) {
      const t = E().tileAt(s, c, r);
      if (!E().passable(t) || t.t === 'mountain' || (t.owner && t.owner !== me)) continue;
      if (Object.values(s.cities).some((x) => E().dist(x.c, x.r, c, r) < 3)) continue;
      if (Object.values(s.units).some((u) => u.realm !== me && E().dist(u.c, u.r, c, r) < 2 && E().getPact(s, me, u.realm) === 'war')) continue;
      const v = siteScore(s, c, r) - E().dist(fc, fr, c, r) * 0.9 + (['grass', 'plains'].includes(t.t) ? 1 : 0);
      if (v > bv) { bv = v; best = [c, r]; }
    }
    return bv > 4 ? best : null;
  }

  function enemiesOf(s, me) { return E().aliveIds(s).filter((o) => o !== me && E().getPact(s, me, o) === 'war'); }

  function moveToward(s, u, tc, tr, stopAdjacent) {
    if (u.mp <= 0) return false;
    const m = E().dijkstra(s, u, 200, 'friendly');
    let goal = null, gd = 1e9;
    if (stopAdjacent) {
      for (const [a, b] of E().neighbors(s, tc, tr)) { const n = m.get(a + ',' + b); if (n && n.cost < gd && !E().unitAt(s, a, b)) { gd = n.cost; goal = [a, b]; } }
    } else if (m.has(tc + ',' + tr)) goal = [tc, tr];
    if (!goal) {
      // ближайшая достижимая клетка к цели
      for (const [k, n] of m) { if (E().unitAt(s, n.c, n.r) && k !== u.c + ',' + u.r) continue; const d = E().dist(n.c, n.r, tc, tr) * 3 + n.cost * 0.3; if (d < gd) { gd = d; goal = [n.c, n.r]; } }
    }
    if (!goal || (goal[0] === u.c && goal[1] === u.r)) return false;
    const res = E().moveUnit(s, u.id, goal[0], goal[1]);
    u.goto = null;
    return res.ok;
  }

  function attackValue(s, u, c, r) {
    const f = E().forecast(s, u, c, r);
    if (!f) return -1;
    if (f.city) {
      const U = D().UNITS[u.type];
      if (U.range) return f.toDef * 1.2;
      if (f.defHp - f.toDef * 2 <= 0) return 200; // захват
      return u.hp - f.toAtt > 35 ? f.toDef - f.toAtt * 1.2 : -1;
    }
    const kill = f.toDef >= f.defHp ? 60 : 0;
    if (f.toAtt >= u.hp) return -1;
    return f.toDef - f.toAtt * 0.9 + kill;
  }

  function tactical(s, me, ev) {
    const enemies = enemiesOf(s, me);
    const myCities = E().citiesOf(s, me);
    const units = E().unitsOf(s, me);
    const garrisons = new Set();
    for (const city of myCities) { const g = E().unitAt(s, city.c, city.r); if (g && g.realm === me && D().UNITS[g.type].cls !== 'civil') garrisons.add(g.id); }
    const targetCity = (u) => {
      let best = null, bd = 1e9;
      for (const city of Object.values(s.cities)) if (enemies.includes(city.realm)) { const d = E().dist(u.c, u.r, city.c, city.r) + city.hp / 40; if (d < bd) { bd = d; best = city; } }
      return best;
    };
    for (const u of units) {
      if (!s.units[u.id]) continue;
      const U = D().UNITS[u.type];
      if (u.type === 'builder') {
        if (improvable(s, me, u.c, u.r)) { E().buildImprovement(s, u.id); continue; }
        let best = null, bd = 99;
        for (const city of myCities) for (const [c, r] of E().inRadius(s, city.c, city.r, city.radius)) {
          if (!improvable(s, me, c, r) || (E().unitAt(s, c, r) && E().unitAt(s, c, r).id !== u.id)) continue;
          const d = E().dist(u.c, u.r, c, r) - (E().tileAt(s, c, r).res ? 2 : 0);
          if (d < bd) { bd = d; best = [c, r]; }
        }
        if (best) { moveToward(s, u, best[0], best[1], false); if (s.units[u.id] && improvable(s, me, u.c, u.r) && u.mp > 0) E().buildImprovement(s, u.id); }
        else u.sleep = true;
        continue;
      }
      if (u.type === 'settler') {
        const chk = E().canFound(s, u);
        const site = findSite(s, me, u.c, u.r, 10);
        if (chk.ok && (!site || (site[0] === u.c && site[1] === u.r) || siteScore(s, u.c, u.r) >= siteScore(s, site[0], site[1]) - 1)) { E().foundCity(s, u.id); continue; }
        if (site) moveToward(s, u, site[0], site[1], false);
        if (s.units[u.id] && E().canFound(s, u).ok && site && u.c === site[0] && u.r === site[1]) E().foundCity(s, u.id);
        continue;
      }
      // 1. Атака, если есть выгодная цель
      const tryAttack = () => {
        if (!s.units[u.id] || u.mp <= 0) return false;
        const range = U.range || 1;
        let best = null, bv = 0;
        for (const [c, r] of E().inRadius(s, u.c, u.r, range)) {
          if (!E().canAttack(s, u, c, r).ok) continue;
          const v = attackValue(s, u, c, r);
          if (v > bv) { bv = v; best = [c, r]; }
        }
        if (best) { E().attack(s, u.id, best[0], best[1]); return true; }
        return false;
      };
      if (U.hero && u.hp < 45 && myCities.length) {
        // раненый герой отступает к ближайшему своему городу
        let home = myCities[0], hd = 99;
        for (const city of myCities) { const d = E().dist(u.c, u.r, city.c, city.r); if (d < hd) { hd = d; home = city; } }
        if (hd > 1) moveToward(s, u, home.c, home.r, true);
        if (s.units[u.id]) u.fort = true;
        continue;
      }
      if (tryAttack()) continue;
      if (!s.units[u.id]) continue;
      // 2. Гарнизон стоит на месте
      if (garrisons.has(u.id)) {
        const threatNear = Object.values(s.units).some((x) => enemies.includes(x.realm) && E().dist(x.c, x.r, u.c, u.r) <= 3);
        if (threatNear || myCities.length <= 3 || E().rand(s) < 0.7) { u.fort = true; continue; }
      }
      // 3. Защита города без гарнизона
      const undefended = myCities.find((city) => !E().unitAt(s, city.c, city.r) && Object.values(s.units).some((x) => enemies.includes(x.realm) && E().dist(x.c, x.r, city.c, city.r) <= 4));
      if (undefended && E().dist(u.c, u.r, undefended.c, undefended.r) <= 6) { moveToward(s, u, undefended.c, undefended.r, false); continue; }
      const empty = myCities.find((city) => !E().unitAt(s, city.c, city.r));
      if (empty && !enemies.length && u.type !== 'scout' && !U.hero) { moveToward(s, u, empty.c, empty.r, false); continue; }
      // 3b. Разорение лагерей разбойников (герои охотятся на них дальше)
      const camp = nearestCamp(s, u, u.type === 'scout' ? 14 : U.hero ? 12 : 7);
      if (camp && !enemies.length && (U.str >= 8 || u.type === 'scout') && u.hp > 50) {
        const occ = E().unitAt(s, camp[0], camp[1]);
        if (occ && occ.realm === E().BANDITS) { moveToward(s, u, camp[0], camp[1], true); tryAttack(); }
        else moveToward(s, u, camp[0], camp[1], false);
        continue;
      }
      if (u.type === 'scout') { const c = Math.floor(E().rand(s) * s.w), r = Math.floor(E().rand(s) * s.h); moveToward(s, u, c, r, false); continue; }
      // 4. Наступление
      if (enemies.length) {
        const tgt = targetCity(u);
        if (tgt) {
          moveToward(s, u, tgt.c, tgt.r, true);
          tryAttack();
          continue;
        }
        let near = null, nd = 99;
        for (const x of Object.values(s.units)) if (enemies.includes(x.realm)) { const d = E().dist(u.c, u.r, x.c, x.r); if (d < nd) { nd = d; near = x; } }
        if (near) { moveToward(s, u, near.c, near.r, true); tryAttack(); continue; }
      }
      // 5. Подготовка к войне: сосредоточение у границы
      const plan = ev.cands.find((c) => c.type === 'declare_war' && c.u > 0);
      if (plan && myCities.length) {
        const theirs = E().citiesOf(s, plan.target);
        if (theirs.length) {
          let base = myCities[0], bd = 99;
          for (const mc of myCities) { const d = Math.min(...theirs.map((t) => E().dist(t.c, t.r, mc.c, mc.r))); if (d < bd) { bd = d; base = mc; } }
          if (E().dist(u.c, u.r, base.c, base.r) > 2) { moveToward(s, u, base.c, base.r, true); continue; }
        }
      }
      u.fort = true;
    }
  }

  // ============================================================ Ход державы
  function takeTurn(s, me) {
    const ev = evaluate(s, me);
    s.aiIntel[me] = ev.cands.slice(0, 3);
    // дипломатия: одно действие за ход (softmax по положительным полезностям)
    const diplo = ev.cands.filter((c) => c.u > 0 && c.target && !['war'].includes(c.type)).slice(0, 5);
    if (diplo.length) applyDiplomacy(s, me, softmaxPick(s, diplo, 0.1));
    const ev2 = evaluate(s, me);
    chooseResearch(s, me);
    const R = s.realms[me];
    if (!R.civicResearch) { const nx = D().CIVICS.filter((x) => E().civicAvailable(s, me, x.id)); if (nx.length) R.civicResearch = nx.sort((a, b) => a.cost - b.cost)[0].id; }
    if (s.turn % 10 === 0) E().autoPolicies(s, me);
    for (const city of E().citiesOf(s, me)) if (!city.item) chooseProduction(s, city, ev2);
    tactical(s, me, ev2);
  }

  function intentLabel(s, cand) {
    if (!cand) return D().INTENT_LABELS.idle;
    const tpl = D().INTENT_LABELS[cand.type] || cand.type;
    return tpl.replace('{t}', cand.target ? s.realms[cand.target].short : '');
  }

  RF.AI = { PlayerModel, RealmAI: { evaluate, takeTurn, respond, threatFrom, intentLabel, chooseProduction, chooseResearch, findSite, tactical, attackValue, bestMilitaryUnit } };
})(typeof window !== 'undefined' ? window : globalThis);
