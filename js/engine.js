/* =========================================================================
 * AGES OF DOMINION — игровой движок (без зависимостей от браузера):
 * гекс-карта и генерация мира, города и экономика, юниты, бой, наука,
 * правители и наследование, мнения, дипломатия, события, победа/поражение.
 * ========================================================================= */
(function (root) {
  const RF = (root.RF = root.RF || {});
  const D = () => RF.Data;
  const AI = () => RF.AI;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const PLAYER = 'aurelia';

  // ------------------------------------------------------------------ ГПСЧ
  function rand(s) {
    s.rng = (s.rng + 0x6d2b79f5) | 0;
    let t = s.rng;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const pick = (s, a) => a[Math.floor(rand(s) * a.length)];

  // ------------------------------------------------------------------ ГЕКСЫ (pointy-top, odd-r)
  const DIRS_EVEN = [[1, 0], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1]];
  const DIRS_ODD = [[1, 0], [1, -1], [0, -1], [-1, 0], [0, 1], [1, 1]];
  const DIR_NAMES = ['восток', 'северо-восток', 'северо-запад', 'запад', 'юго-запад', 'юго-восток'];
  const idx = (s, c, r) => r * s.w + c;
  const inb = (s, c, r) => c >= 0 && r >= 0 && c < s.w && r < s.h;
  const tileAt = (s, c, r) => (inb(s, c, r) ? s.tiles[idx(s, c, r)] : null);
  function neighbors(s, c, r) {
    const d = r & 1 ? DIRS_ODD : DIRS_EVEN;
    const out = [];
    for (let i = 0; i < 6; i++) {
      const nc = c + d[i][0], nr = r + d[i][1];
      if (inb(s, nc, nr)) out.push([nc, nr, i]);
    }
    return out;
  }
  function step(c, r, dir) { const d = (r & 1 ? DIRS_ODD : DIRS_EVEN)[dir]; return [c + d[0], r + d[1]]; }
  function cube(c, r) { const x = c - (r - (r & 1)) / 2; return [x, -x - r, r]; }
  function dist(c1, r1, c2, r2) {
    const a = cube(c1, r1), b = cube(c2, r2);
    return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));
  }
  function inRadius(s, c, r, rad) {
    const out = [];
    for (let rr = Math.max(0, r - rad); rr <= Math.min(s.h - 1, r + rad); rr++)
      for (let cc = Math.max(0, c - rad - 1); cc <= Math.min(s.w - 1, c + rad + 1); cc++)
        if (dist(c, r, cc, rr) <= rad) out.push([cc, rr]);
    return out;
  }
  const passable = (t) => t && D().TERRAIN[t.t].move < 99;

  // ------------------------------------------------------------------ ГЕНЕРАЦИЯ КАРТЫ
  function noiseGrid(s, gw, gh) { const g = []; for (let i = 0; i < gw * gh; i++) g.push(rand(s)); return { g, gw, gh }; }
  function sample(n, x, y) {
    const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
    const at = (i, j) => n.g[(clamp(j, 0, n.gh - 1)) * n.gw + clamp(i, 0, n.gw - 1)];
    const sm = (t) => t * t * (3 - 2 * t);
    const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sm(fx);
    const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sm(fx);
    return a + (b - a) * sm(fy);
  }

  function generateMap(s) {
    const { w, h } = s;
    const n1 = noiseGrid(s, Math.ceil(w / 4) + 2, Math.ceil(h / 4) + 2);
    const n2 = noiseGrid(s, Math.ceil(w / 2) + 2, Math.ceil(h / 2) + 2);
    const m1 = noiseGrid(s, Math.ceil(w / 4) + 2, Math.ceil(h / 4) + 2);
    const elev = [], moist = [];
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
      const nx = (c + 0.5 * (r & 1)) / w - 0.5, ny = r / h - 0.5;
      const d = Math.sqrt(nx * nx * 1.1 + ny * ny * 1.6) * 2;
      elev.push(sample(n1, c / 4, r / 4) * 0.62 + sample(n2, c / 2, r / 2) * 0.38 - d * d * 0.55);
      moist.push(sample(m1, c / 4, r / 4));
    }
    const sorted = elev.slice().sort((a, b) => a - b);
    const sea = sorted[Math.floor(sorted.length * 0.36)];
    const land = elev.filter((e) => e >= sea).sort((a, b) => a - b);
    const mountainLvl = land[Math.floor(land.length * 0.95)];
    const hillLvl = land[Math.floor(land.length * 0.84)];
    s.tiles = elev.map((e, i) => {
      let t;
      if (e < sea) t = 'ocean';
      else if (e >= mountainLvl) t = 'mountain';
      else if (e >= hillLvl) t = 'hills';
      else if (moist[i] < 0.27) t = 'desert';
      else if (moist[i] > 0.63) t = 'forest';
      else if (moist[i] > 0.45) t = 'grass';
      else t = 'plains';
      return { t, res: null, owner: null, cityId: null };
    });
    // Снежный север и огненные пустоши вокруг вулкана на юге
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
      const i = idx(s, c, r), t = s.tiles[i];
      if (t.t === 'ocean') continue;
      const lat = r / h + (moist[i] - 0.5) * 0.12;
      if (lat < 0.17 && ['grass', 'plains', 'desert'].includes(t.t)) t.t = 'tundra';
    }
    const vc = [];
    for (let r = Math.floor(h * 0.6); r < h - 1; r++) for (let c = 1; c < w - 1; c++) { const t = s.tiles[idx(s, c, r)]; if (t.t === 'mountain' || t.t === 'hills') vc.push([c, r]); }
    if (vc.length) {
      const [vx, vy] = vc[Math.floor(rand(s) * vc.length)];
      const vt = tileAt(s, vx, vy); vt.t = 'mountain'; vt.volcano = true;
      for (const [a, b] of inRadius(s, vx, vy, 2)) { const t2 = tileAt(s, a, b); if (['grass', 'plains', 'desert', 'forest', 'tundra', 'hills'].includes(t2.t)) t2.t = 'ash'; }
    }
    // Реки: от гор и холмов вниз по рельефу к морю (+1 золото на клетках реки)
    s.rivers = [];
    const used = new Set();
    const srcs = [];
    for (let i = 0; i < s.tiles.length; i++) if (s.tiles[i].t === 'mountain' || s.tiles[i].t === 'hills') srcs.push(i);
    for (let i = srcs.length - 1; i > 0; i--) { const j = Math.floor(rand(s) * (i + 1)); [srcs[i], srcs[j]] = [srcs[j], srcs[i]]; }
    const maxRivers = Math.max(3, Math.round((w * h) / 85));
    // расстояние до моря: реки текут к ближайшему побережью, не петляя
    const seaD = new Array(s.tiles.length).fill(1e9), q = [];
    s.tiles.forEach((t, i) => { if (t.t === 'ocean') { seaD[i] = 0; q.push(i); } });
    for (let qi = 0; qi < q.length; qi++) { const k = q[qi]; for (const [a, b] of neighbors(s, k % w, Math.floor(k / w))) { const j = idx(s, a, b); if (seaD[j] > seaD[k] + 1) { seaD[j] = seaD[k] + 1; q.push(j); } } }
    for (const src of srcs) {
      if (s.rivers.length >= maxRivers) break;
      if (used.has(src) || seaD[src] < 3 || seaD[src] > 12) continue;
      const path = [src];
      let cur = src, done = false;
      for (let k = 0; k < 30 && !done; k++) {
        const cc = cur % w, cr = Math.floor(cur / w);
        let best = -1, be = 1e9;
        for (const [a, b] of neighbors(s, cc, cr)) { const j = idx(s, a, b); if (seaD[j] >= seaD[cur]) continue; const e = elev[j] + rand(s) * 0.08; if (e < be) { be = e; best = j; } }
        if (best < 0) break;
        path.push(best);
        if (s.tiles[best].t === 'ocean' || used.has(best)) done = true;
        cur = best;
      }
      if (!done || path.length < 3) continue;
      for (const j of path) { used.add(j); const t = s.tiles[j]; if (t.t !== 'ocean' && t.t !== 'mountain') t.river = true; }
      s.rivers.push(path);
    }
    // Ресурсы
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
      const t = s.tiles[idx(s, c, r)];
      const p = rand(s);
      if (t.t === 'ocean') {
        if (p < 0.09 && neighbors(s, c, r).some(([a, b]) => s.tiles[idx(s, a, b)].t !== 'ocean')) t.res = 'fish';
        continue;
      }
      if (p < 0.12) {
        const opts = Object.entries(D().RESOURCES).filter(([, v]) => v.on.includes(t.t)).map(([k]) => k);
        if (opts.length) t.res = pick(s, opts);
      }
    }
  }

  function largestLandmass(s) {
    const seen = new Array(s.tiles.length).fill(-1);
    let best = [], id = 0;
    for (let i = 0; i < s.tiles.length; i++) {
      if (seen[i] >= 0 || !passable(s.tiles[i])) continue;
      const comp = [], q = [i];
      seen[i] = id;
      while (q.length) {
        const k = q.pop(); comp.push(k);
        const c = k % s.w, r = Math.floor(k / s.w);
        for (const [a, b] of neighbors(s, c, r)) { const j = idx(s, a, b); if (seen[j] < 0 && passable(s.tiles[j])) { seen[j] = id; q.push(j); } }
      }
      if (comp.length > best.length) best = comp;
      id++;
    }
    return best;
  }

  function startPositions(s, n) {
    const land = largestLandmass(s).filter((k) => {
      const t = s.tiles[k];
      if (!['grass', 'plains', 'hills'].includes(t.t)) return false;
      const c = k % s.w, r = Math.floor(k / s.w);
      return neighbors(s, c, r).filter(([a, b]) => passable(s.tiles[idx(s, a, b)])).length >= 5 && c > 1 && r > 1 && c < s.w - 2 && r < s.h - 2;
    });
    if (land.length < n * 4) return null;
    const pos = [land[Math.floor(rand(s) * land.length)]];
    while (pos.length < n) {
      let best = -1, bestD = -1;
      for (const k of land) {
        const c = k % s.w, r = Math.floor(k / s.w);
        const dmin = Math.min(...pos.map((p) => dist(c, r, p % s.w, Math.floor(p / s.w))));
        const score = dmin + rand(s) * 1.5;
        if (score > bestD) { bestD = score; best = k; }
      }
      pos.push(best);
    }
    const minD = Math.min(...pos.flatMap((a, i) => pos.slice(i + 1).map((b) => dist(a % s.w, Math.floor(a / s.w), b % s.w, Math.floor(b / s.w)))));
    if (minD < 6) return null;
    return pos.map((k) => [k % s.w, Math.floor(k / s.w)]);
  }

  // ------------------------------------------------------------------ ПЕРСОНАЖИ
  function makeCharacter(s, realmId, age, female) {
    const R = D().REALMS[realmId];
    const traits = [];
    const all = Object.keys(D().TRAITS);
    const add = (t) => { const T = D().TRAITS[t]; if (!traits.includes(t) && !(T.opp && traits.includes(T.opp))) traits.push(t); };
    if (rand(s) < 0.75) add(pick(s, R.traits));
    while (traits.length < 3) add(pick(s, all));
    const stats = {};
    for (const k of Object.keys(D().STATS)) stats[k] = 3 + Math.floor(rand(s) * 5);
    const id = 'c' + s.nextId++;
    const ch = { id, realm: realmId, female: !!female, name: pick(s, female ? R.female : R.male), age, traits, stats, alive: true, look: { ...R.look, hair: rand(s) < 0.3 ? pick(s, ['#3b2a1e', '#8a5a2b', '#c8a26a', '#5a3a28', '#222']) : R.look.hair } };
    s.chars[id] = ch;
    return ch;
  }

  function stat(s, charId, key) {
    const ch = s.chars[charId];
    if (!ch) return 0;
    let v = ch.stats[key];
    for (const t of ch.traits) v += D().TRAITS[t].fx[key] || 0;
    return Math.max(0, v);
  }

  function personality(s, realmId) {
    const p = { aggression: 0.35, greed: 0.4, honor: 0.5, caution: 0.45, expansion: 0.55 };
    const ch = s.chars[s.realms[realmId].rulerId];
    if (ch) for (const t of ch.traits) for (const [k, v] of Object.entries(D().TRAITS[t].fx)) if (k in p) p[k] += v;
    for (const k in p) p[k] = clamp(p[k], 0.02, 0.98);
    return p;
  }

  function rulerTitle(s, realmId) {
    const R = D().REALMS[realmId], ch = s.chars[s.realms[realmId].rulerId];
    return `${ch.female ? R.titleF : R.title} ${ch.name}`;
  }

  // ------------------------------------------------------------------ МНЕНИЯ
  const pairKey = (a, b) => (a < b ? a + '|' + b : b + '|' + a);
  const BANDITS = 'bandits';
  const getPact = (s, a, b) => (a === BANDITS || b === BANDITS ? (a === b ? 'peace' : 'war') : s.pacts[pairKey(a, b)] || 'peace');
  const hasPolicy = (s, realm, id) => { const R = s.realms[realm]; return !!(R && R.policies && (R.policies.military.includes(id) || R.policies.economic.includes(id))); };
  const married = (s, a, b) => !!s.marriages[pairKey(a, b)];
  function addOpinion(s, of, about, label, value, turns, stack) {
    const R = s.realms[of];
    R.opinion[about] = R.opinion[about] || [];
    const ex = R.opinion[about].find((m) => m.label === label);
    if (ex) { ex.value = stack ? clamp(ex.value + value, -60, 60) : (Math.abs(value) > Math.abs(ex.value) ? value : ex.value); ex.turns = Math.max(ex.turns, turns); }
    else R.opinion[about].push({ label, value, turns });
  }
  function opinionBreakdown(s, of, about) {
    const out = [];
    const a = s.chars[s.realms[of].rulerId], b = s.chars[s.realms[about].rulerId];
    if (a && b) {
      let comp = 0;
      for (const t of a.traits) { if (b.traits.includes(t)) comp += 10; if (D().TRAITS[t].opp && b.traits.includes(D().TRAITS[t].opp)) comp -= 10; }
      if (comp) out.push({ label: comp > 0 ? 'Схожие характеры' : 'Несовместимые характеры', value: comp });
      const dip = stat(s, b.id, 'dip') - 5;
      if (dip) out.push({ label: 'Дипломатия правителя', value: dip * 2 });
      const amb = a.traits.filter((t) => t === 'ambitious' || t === 'wrathful' || t === 'arbitrary').length;
      if (amb) out.push({ label: 'Нрав правителя', value: -8 * amb });
    }
    let near = 99;
    for (const c1 of Object.values(s.cities)) if (c1.realm === of) for (const c2 of Object.values(s.cities)) if (c2.realm === about) near = Math.min(near, dist(c1.c, c1.r, c2.c, c2.r));
    if (near <= 5) out.push({ label: 'Спорные границы', value: -20 });
    else if (near <= 8) out.push({ label: 'Соперничество за земли', value: -10 });
    const pact = getPact(s, of, about);
    if (pact === 'trade') out.push({ label: 'Торговый договор', value: 10 });
    if (pact === 'alliance') out.push({ label: 'Союз', value: 20 });
    if (pact === 'war') out.push({ label: 'Война', value: -30 });
    if (married(s, of, about)) out.push({ label: 'Династический брак', value: 25 });
    if (s.realms[of].overlord === about) out.push({ label: 'Сюзерен', value: -10 });
    for (const m of s.realms[of].opinion[about] || []) out.push({ label: m.label, value: Math.round(m.value) });
    return out;
  }
  const opinion = (s, of, about) => clamp(opinionBreakdown(s, of, about).reduce((a, m) => a + m.value, 0), -100, 100);

  // ------------------------------------------------------------------ НОВАЯ ИГРА
  function newGame(level, opts) {
    opts = opts || {};
    const L = D().SCENARIOS.find((x) => x.id === level) || D().SCENARIOS[0];
    let seed = opts.seed !== undefined ? opts.seed : Math.floor(Math.random() * 1e9);
    let s, starts;
    for (let attempt = 0; attempt < 40; attempt++) {
      s = {
        version: 2, level: L.id, seed, rng: seed | 0, turn: 1, turnLimit: L.turns, w: L.w, h: L.h,
        tiles: [], realms: {}, order: L.realms.slice(), chars: {}, cities: {}, units: {}, nextId: 1,
        pacts: {}, marriages: {}, wars: {}, proposals: [], pendingEvent: null, log: [], notes: [],
        explored: [], difficulty: 1, tension: 0, aiLevel: L.aiLevel, boosts: { ...(opts.boosts || {}) },
        stats: { citiesFounded: 0, citiesCaptured: 0, unitsKilled: 0, unitsLost: 0, marriages: 0, successions: 0, voiceCommands: 0, textCommands: 0, warsDeclared: 0, battlesWon: 0, techs: 0 },
        turnAttacks: {}, turnFeatures: {}, aiIntel: {}, threatHistory: [], scoreHistory: [], recentEvents: [],
        playerName: opts.playerName || null,
      };
      generateMap(s);
      starts = startPositions(s, L.realms.length);
      if (starts) break;
      seed = (seed * 7 + 13) % 1e9;
    }
    s.explored = new Array(s.tiles.length).fill(0);
    L.realms.forEach((id, i) => {
      const R = D().REALMS[id];
      const realm = {
        id, name: R.name, short: R.short, color: R.color, isPlayer: id === PLAYER, alive: true,
        gold: id === PLAYER ? 60 : Math.round(60 * L.aiLevel), science: 0, researching: null, techs: [], stability: 60, prestige: 0,
        rulerId: null, heirId: null, opinion: {}, capitalId: null, origCapitalId: null, overlord: null, goldBonus: 0, cityNames: R.cities.slice(),
        culture: 0, civics: [], civicResearch: 'code_of_laws', policies: { military: [], economic: [] },
      };
      s.realms[id] = realm;
      const ruler = makeCharacter(s, id, 26 + Math.floor(rand(s) * 14), rand(s) < 0.25);
      if (id === PLAYER && opts.playerName) ruler.name = opts.playerName;
      if (id === PLAYER) { ruler.female = !!opts.female; }
      realm.rulerId = ruler.id;
      realm.heirId = makeCharacter(s, id, 4 + Math.floor(rand(s) * 8), rand(s) < 0.4).id;
      const [c, r] = starts[i];
      const tile = tileAt(s, c, r);
      if (tile.t === 'hills' || tile.t === 'forest') tile.t = 'plains';
      const city = foundCityAt(s, id, c, r, true);
      city.pop = 2;
      // стартовые отряды
      const free = neighbors(s, c, r).filter(([a, b]) => passable(tileAt(s, a, b)));
      if (free[0]) createUnit(s, id, 'warrior', free[0][0], free[0][1]);
      if (free[1]) createUnit(s, id, 'settler', free[1][0], free[1][1]);
      spawnHero(s, id, 1, 0);
      chooseDefaultResearch(s, id);
    });
    // Разбойники — особая сторона, всегда враждебная всем
    s.realms[BANDITS] = { id: BANDITS, name: 'Разбойники', short: 'Разбойники', color: '#3a3330', isPlayer: false, alive: true, gold: 0, techs: [], stability: 50, prestige: 0, opinion: {}, policies: { military: [], economic: [] }, civics: [] };
    s.camps = [];
    for (let i = 0; i < Math.round(L.realms.length * 0.8); i++) spawnCamp(s);
    // Усиления игрока (магазин)
    const P = s.realms[PLAYER];
    if (s.boosts.gold) P.gold += 150;
    if (s.boosts.tech) P.techs.push('bronze');
    if (s.boosts.settler) { const cap = s.cities[P.capitalId]; const spot = freeNeighbor(s, cap.c, cap.r); if (spot) createUnit(s, PLAYER, 'settler', spot[0], spot[1]); }
    if (s.boosts.army) { const cap = s.cities[P.capitalId]; for (let k = 0; k < 2; k++) { const spot = freeNeighbor(s, cap.c, cap.r); if (spot) createUnit(s, PLAYER, 'archer', spot[0], spot[1]); } }
    s.playerModel = AI().PlayerModel.create(opts.modelState);
    updateVisibility(s);
    captureFeatures(s);
    for (const id of aiIds(s)) s.aiIntel[id] = AI().RealmAI.evaluate(s, id).cands.slice(0, 3);
    log(s, `${L.name}. ${rulerTitle(s, PLAYER)} основывает столицу ${s.cities[P.capitalId].name}.`, 'info');
    return s;
  }

  function log(s, text, type, c, r) {
    const e = { turn: s.turn, text, type: type || 'info' };
    if (c !== undefined) { e.c = c; e.r = r; }
    s.log.push(e);
    if (s.log.length > 200) s.log.shift();
    s.notes.push(e);
  }

  const year = (s, turn) => D().START_YEAR + ((turn || s.turn) - 1) * D().YEARS_PER_TURN;
  const level = (s) => D().SCENARIOS.find((x) => x.id === s.level);
  const aliveIds = (s) => s.order.filter((id) => s.realms[id].alive);
  const aiIds = (s) => aliveIds(s).filter((id) => id !== PLAYER);
  const citiesOf = (s, id) => Object.values(s.cities).filter((c) => c.realm === id);
  const unitsOf = (s, id) => Object.values(s.units).filter((u) => u.realm === id);

  // ------------------------------------------------------------------ ЮНИТЫ
  function posMap(s) {
    if (!s._pos) {
      const m = new Map();
      for (const u of Object.values(s.units)) m.set(u.c + ',' + u.r, u);
      Object.defineProperty(s, '_pos', { value: m, writable: true, enumerable: false, configurable: true });
    }
    return s._pos;
  }
  const invalidate = (s) => { if (s._pos) s._pos = null; };
  const unitAt = (s, c, r) => posMap(s).get(c + ',' + r) || null;
  const cityAt = (s, c, r) => { const t = tileAt(s, c, r); return t && t.cityId ? s.cities[t.cityId] : null; };

  function createUnit(s, realm, type, c, r) {
    const id = 'u' + s.nextId++;
    const u = { id, type, realm, c, r, hp: 100, mp: D().UNITS[type].mov, fort: false, sleep: false, goto: null };
    if (D().UNITS[type].charges) u.charges = D().UNITS[type].charges;
    s.units[id] = u;
    invalidate(s);
    return u;
  }
  function killUnit(s, u) {
    delete s.units[u.id]; invalidate(s);
    if (u.hero && s.realms[u.realm] && s.realms[u.realm].alive) {
      s.realms[u.realm].heroDown = { turn: s.turn + 6, lvl: Math.max(1, u.hero.lvl - 1), xp: HXP()[Math.max(0, u.hero.lvl - 2)] };
      fx(s, { type: 'herofall', c: u.c, r: u.r, realm: u.realm, name: u.hero.name });
      log(s, `Герой ${u.hero.name} (${s.realms[u.realm].short}) пал в бою! Вернётся в столицу через 6 ходов.`, 'war', u.c, u.r);
    }
  }
  const HXP = () => D().HERO_XP;
  /** Очередь визуальных эффектов для отрисовки (не сохраняется). */
  function fx(s, e) {
    if (!s._fx) Object.defineProperty(s, '_fx', { value: [], writable: true, enumerable: false, configurable: true });
    s._fx.push(e);
    if (s._fx.length > 200) s._fx.shift();
  }
  /** Призвать героя державы у столицы. */
  function spawnHero(s, realm, lvl, xp) {
    const H = D().HEROES[realm], R = s.realms[realm];
    if (!H || !R || !R.alive) return null;
    const cap = s.cities[R.capitalId];
    if (!cap) return null;
    const spot = freeNeighbor(s, cap.c, cap.r);
    if (!spot) return null;
    const u = createUnit(s, realm, H.type, spot[0], spot[1]);
    u.hero = { name: H.name, lvl: lvl || 1, xp: xp || 0 };
    R.heroDown = null;
    return u;
  }
  function heroGainXp(s, u, amount) {
    if (!u || !u.hero || !s.units[u.id]) return;
    u.hero.xp += amount;
    const T = HXP();
    while (u.hero.lvl < T.length && u.hero.xp >= T[u.hero.lvl]) {
      u.hero.lvl++; u.hp = 100;
      fx(s, { type: 'levelup', c: u.c, r: u.r, lvl: u.hero.lvl });
      if (u.realm === PLAYER) log(s, `${u.hero.name} достигает ${u.hero.lvl}-го уровня! Сила растёт.`, 'tech', u.c, u.r);
    }
  }
  function freeNeighbor(s, c, r) {
    if (!unitAt(s, c, r) && passable(tileAt(s, c, r))) return [c, r];
    for (const [a, b] of neighbors(s, c, r)) if (passable(tileAt(s, a, b)) && !unitAt(s, a, b) && !cityAt(s, a, b)) return [a, b];
    for (const [a, b] of inRadius(s, c, r, 2)) if (passable(tileAt(s, a, b)) && !unitAt(s, a, b) && !cityAt(s, a, b)) return [a, b];
    return null;
  }

  /** Может ли юнит войти на клетку (без учёта занятости). */
  function canEnterTerritory(s, realm, c, r) {
    const t = tileAt(s, c, r);
    if (!passable(t)) return false;
    if (!t.owner || t.owner === realm) return true;
    const pact = getPact(s, realm, t.owner);
    return pact === 'war' || pact === 'trade' || pact === 'alliance' || s.realms[t.owner].overlord === realm || s.realms[realm].overlord === t.owner;
  }

  /** Дейкстра: стоимости путей от юнита (ограничение maxCost). Возвращает Map key->{cost, prev}. */
  function dijkstra(s, u, maxCost, ignoreUnits) {
    const T = D().TERRAIN;
    const start = u.c + ',' + u.r;
    const best = new Map([[start, { cost: 0, prev: null, c: u.c, r: u.r }]]);
    const open = [[0, u.c, u.r]];
    while (open.length) {
      open.sort((a, b) => a[0] - b[0]);
      const [cost, c, r] = open.shift();
      const key = c + ',' + r;
      if (best.get(key).cost < cost) continue;
      for (const [a, b] of neighbors(s, c, r)) {
        if (!canEnterTerritory(s, u.realm, a, b)) continue;
        const other = unitAt(s, a, b);
        const city = cityAt(s, a, b);
        if (city && city.realm !== u.realm) continue;
        if (!ignoreUnits && other && other.realm !== u.realm) continue;
        if (other && other.realm !== u.realm && ignoreUnits === 'friendly') continue;
        const nc = cost + T[tileAt(s, a, b).t].move;
        if (nc > maxCost) continue;
        const k = a + ',' + b;
        if (!best.has(k) || best.get(k).cost > nc) { best.set(k, { cost: nc, prev: key, c: a, r: b }); open.push([nc, a, b]); }
      }
    }
    return best;
  }

  /** Клетки, достижимые в этот ход (правило: можно войти, если осталось хоть 1 очко). */
  function reachable(s, u) {
    if (u.mp <= 0) return new Map();
    const T = D().TERRAIN;
    const res = new Map();
    const start = { c: u.c, r: u.r, left: u.mp };
    const bestLeft = new Map([[u.c + ',' + u.r, u.mp]]);
    const q = [start];
    while (q.length) {
      const cur = q.shift();
      if (cur.left <= 0) continue;
      for (const [a, b] of neighbors(s, cur.c, cur.r)) {
        if (!canEnterTerritory(s, u.realm, a, b)) continue;
        const other = unitAt(s, a, b);
        const city = cityAt(s, a, b);
        if (other || (city && city.realm !== u.realm)) continue;
        const left = Math.max(0, cur.left - T[tileAt(s, a, b).t].move);
        const k = a + ',' + b;
        if ((bestLeft.get(k) ?? -1) < left) { bestLeft.set(k, left); res.set(k, { c: a, r: b, left, prev: cur.c + ',' + cur.r }); q.push({ c: a, r: b, left }); }
      }
    }
    return res;
  }

  function findPath(s, u, tc, tr) {
    const m = dijkstra(s, u, 400, 'friendly');
    let k = tc + ',' + tr;
    if (!m.has(k)) return null;
    const path = [];
    while (k && k !== u.c + ',' + u.r) { const n = m.get(k); path.push([n.c, n.r]); k = n.prev; }
    return path.reverse();
  }

  /** Переместить юнит к цели: идёт сколько хватает очков, остаток пути сохраняется. */
  function moveUnit(s, uid, tc, tr) {
    const u = s.units[uid];
    if (!u) return { ok: false, msg: 'Отряд не найден.' };
    if (u.c === tc && u.r === tr) return { ok: false, msg: 'Отряд уже здесь.' };
    const path = findPath(s, u, tc, tr);
    if (!path) return { ok: false, msg: 'Туда не пройти: горы, море или чужие границы (нужен торговый договор).' };
    u.fort = false; u.sleep = false;
    const T = D().TERRAIN;
    let moved = 0;
    const trail = [[u.c, u.r]];
    for (const [c, r] of path) {
      if (u.mp <= 0) break;
      if (unitAt(s, c, r)) break;
      u.mp = Math.max(0, u.mp - T[tileAt(s, c, r).t].move);
      u.c = c; u.r = r; moved++;
      trail.push([c, r]);
      invalidate(s);
      if (u.realm !== BANDITS && D().UNITS[u.type].cls !== 'civil') clearCamp(s, u);
    }
    if (moved) fx(s, { type: 'move', id: u.id, path: trail });
    u.goto = u.c === tc && u.r === tr ? null : { c: tc, r: tr };
    if (u.realm === PLAYER) updateVisibility(s);
    return { ok: moved > 0, moved, msg: moved ? '' : 'Путь перекрыт.' };
  }

  /** Номер хода, на котором отряд достигнет каждой клетки пути (для подписи пути на карте). */
  function pathTurns(s, u, path) {
    const T = D().TERRAIN, max = D().UNITS[u.type].mov;
    let mp = u.mp, turn = mp > 0 ? 1 : 2;
    if (mp <= 0) mp = max;
    return path.map(([c, r]) => {
      if (mp <= 0) { turn++; mp = max; }
      mp = Math.max(0, mp - T[tileAt(s, c, r).t].move);
      return turn;
    });
  }

  // ------------------------------------------------------------------ РАЗБОЙНИКИ
  function spawnCamp(s) {
    const cand = [];
    for (let r = 1; r < s.h - 1; r++) for (let c = 1; c < s.w - 1; c++) {
      const t = tileAt(s, c, r);
      if (!passable(t) || t.owner || t.cityId || t.camp || unitAt(s, c, r)) continue;
      if (Object.values(s.cities).some((x) => dist(x.c, x.r, c, r) < 5)) continue;
      if (s.camps.some(([a, b]) => dist(a, b, c, r) < 5)) continue;
      cand.push([c, r]);
    }
    if (!cand.length) return null;
    const [c, r] = pick(s, cand);
    tileAt(s, c, r).camp = true;
    s.camps.push([c, r]);
    createUnit(s, BANDITS, 'warrior', c, r);
    return [c, r];
  }

  function clearCamp(s, u) {
    const t = tileAt(s, u.c, u.r);
    if (!t.camp) return false;
    t.camp = false;
    s.camps = s.camps.filter(([a, b]) => !(a === u.c && b === u.r));
    s.realms[u.realm].gold += 30;
    s.realms[u.realm].prestige += 4;
    if (u.realm === PLAYER) { s.stats.campsCleared = (s.stats.campsCleared || 0) + 1; log(s, 'Лагерь разбойников разорён! +30 золота.', 'war', u.c, u.r); }
    return true;
  }

  function banditTurn(s) {
    const B = BANDITS;
    // новые лагеря и отряды
    if (s.turn % 12 === 0 && s.camps.length < 2 + s.order.length) spawnCamp(s);
    for (const [c, r] of s.camps) {
      const near = Object.values(s.units).filter((u) => u.realm === B && dist(u.c, u.r, c, r) <= 4).length;
      if (s.turn % 7 === 0 && near < 3) { const sp = freeNeighbor(s, c, r); if (sp) createUnit(s, B, s.turn > 30 && rand(s) < 0.5 ? 'archer' : (s.turn > 50 ? 'swordsman' : 'warrior'), sp[0], sp[1]); }
    }
    for (const u of Object.values(s.units).filter((x) => x.realm === B)) {
      if (!s.units[u.id] || u.mp <= 0) continue;
      const U = D().UNITS[u.type], range = U.range || 1;
      // атака соседей
      let best = null, bv = -1;
      for (const [c, r] of inRadius(s, u.c, u.r, range)) {
        const v = unitAt(s, c, r), city = cityAt(s, c, r);
        if (v && v.realm !== B) { const sc = D().UNITS[v.type].cls === 'civil' ? 100 : 100 - v.hp; if (sc > bv) { bv = sc; best = [c, r]; } }
        else if (city && !U.range && city.hp > 0 && u.hp > 60) { if (20 > bv) { bv = 20; best = [c, r]; } }
      }
      if (best && rand(s) < 0.85) { attack(s, u.id, best[0], best[1]); continue; }
      // движение к ближайшей цели в радиусе 7, иначе стоим у лагеря
      let tgt = null, td = 8;
      for (const v of Object.values(s.units)) if (v.realm !== B) { const d = dist(u.c, u.r, v.c, v.r); if (d < td) { td = d; tgt = [v.c, v.r]; } }
      if (!tgt) for (const city of Object.values(s.cities)) { const d = dist(u.c, u.r, city.c, city.r); if (d < td) { td = d; tgt = [city.c, city.r]; } }
      if (tgt) {
        const m = dijkstra(s, u, 30, 'friendly');
        let goal = null, gd = 1e9;
        for (const n of m.values()) { if (unitAt(s, n.c, n.r) || cityAt(s, n.c, n.r)) continue; const d = dist(n.c, n.r, tgt[0], tgt[1]) * 3 + n.cost; if (d < gd) { gd = d; goal = [n.c, n.r]; } }
        if (goal) { moveUnit(s, u.id, goal[0], goal[1]); u.goto = null; }
      } else u.fort = true;
    }
  }

  // ------------------------------------------------------------------ СТРОИТЕЛИ И УЛУЧШЕНИЯ
  function improvementsFor(s, u) {
    const t = tileAt(s, u.c, u.r);
    if (!u || u.type !== 'builder' || !t || t.owner !== u.realm || t.cityId || t.district) return [];
    const R = s.realms[u.realm];
    return Object.entries(D().IMPROVEMENTS).filter(([id, im]) => t.imp !== id && (!im.req || R.techs.includes(im.req)) && (im.on.includes(t.t) || (t.res && im.res.includes(t.res)))).map(([id]) => id);
  }
  function buildImprovement(s, uid, impId) {
    const u = s.units[uid];
    if (!u || u.type !== 'builder') return { ok: false, msg: 'Улучшения возводят только строители.' };
    const t = tileAt(s, u.c, u.r);
    if (t.owner !== u.realm) return { ok: false, msg: 'Строить можно только на своей земле.' };
    const opts = improvementsFor(s, u);
    if (!impId) impId = opts[0];
    if (!impId || !opts.includes(impId)) return { ok: false, msg: impId ? `${D().IMPROVEMENTS[impId] ? D().IMPROVEMENTS[impId].name : impId}: здесь нельзя или нужна технология.` : 'На этой клетке нечего улучшать.' };
    t.imp = impId;
    u.charges--; u.mp = 0;
    const name = D().IMPROVEMENTS[impId].name;
    if (u.charges <= 0) killUnit(s, u);
    if (u.realm === PLAYER) AI().PlayerModel.observe(s.playerModel, 'econ');
    return { ok: true, msg: `${name} построена.${u.charges > 0 ? ` Зарядов: ${u.charges}.` : ' Строители исчерпали силы.'}` };
  }

  // ------------------------------------------------------------------ КВАРТАЛЫ
  function districtAdjacency(s, c, r, id) {
    const Dd = D().DISTRICTS[id];
    let v = 0;
    for (const [a, b] of neighbors(s, c, r)) {
      const t = tileAt(s, a, b);
      if (Dd.adj.mountain && t.t === 'mountain') v += Dd.adj.mountain;
      if (Dd.adj.forest && t.t === 'forest') v += Dd.adj.forest;
      if (Dd.adj.hills && t.t === 'hills') v += Dd.adj.hills;
      if (Dd.adj.ocean && t.t === 'ocean') { v += Dd.adj.ocean; }
      if (Dd.adj.district && (t.district || t.cityId)) v += Dd.adj.district;
    }
    if (id === 'commercial') v = Math.min(v, 3);
    return Math.floor(v);
  }
  function validDistrictTile(s, city, c, r) {
    const t = tileAt(s, c, r);
    if (!t || !passable(t) || t.cityId || t.district || t.camp) return false;
    if (t.workCity !== city.id) return false;
    const u = unitAt(s, c, r);
    return !(u && u.realm !== city.realm);
  }
  function districtSpots(s, city, id) {
    const out = [];
    for (const [c, r] of inRadius(s, city.c, city.r, city.radius)) if (validDistrictTile(s, city, c, r)) out.push({ c, r, adj: districtAdjacency(s, c, r, id) });
    return out.sort((a, b) => b.adj - a.adj);
  }
  const cityDistricts = (s, city) => (city.districts || (city.districts = {}));

  // ------------------------------------------------------------------ ПОКУПКА КЛЕТОК
  function tileCost(s, city, c, r) { return 20 + dist(city.c, city.r, c, r) * 12 + (tileAt(s, c, r).res ? 15 : 0); }
  function canBuyTile(s, city, c, r) {
    const t = tileAt(s, c, r);
    if (!t || t.owner || dist(city.c, city.r, c, r) > 3 || t.t === 'ocean' && !t.res) return false;
    return neighbors(s, c, r).some(([a, b]) => tileAt(s, a, b).workCity === city.id);
  }
  function buyTile(s, cityId, c, r) {
    const city = s.cities[cityId];
    if (!city || !canBuyTile(s, city, c, r)) return { ok: false, msg: 'Эту клетку нельзя купить: она должна граничить с землями города (до 3 клеток от центра).' };
    const cost = tileCost(s, city, c, r), R = s.realms[city.realm];
    if (R.gold < cost) return { ok: false, msg: `Нужно ${cost} золота.` };
    R.gold -= cost;
    tileAt(s, c, r).boughtBy = city.id;
    recomputeOwnership(s);
    if (city.realm === PLAYER) updateVisibility(s);
    return { ok: true, msg: `Клетка присоединена к городу ${city.name} за ${cost} золота.` };
  }

  // ------------------------------------------------------------------ ИНСТИТУТЫ И ПОЛИТИКИ
  const civicCost = (s, cv, realmId) => Math.round(cv.cost * (1 + s.realms[realmId].civics.length * 0.1));
  function civicAvailable(s, realmId, id) { const cv = D().CIVICS.find((x) => x.id === id), R = s.realms[realmId]; return cv && !R.civics.includes(id) && cv.req.every((q) => R.civics.includes(q)); }
  function setCivic(s, realmId, id) {
    if (!civicAvailable(s, realmId, id)) return { ok: false, msg: 'Этот институт пока недоступен.' };
    s.realms[realmId].civicResearch = id;
    return { ok: true, msg: `Развиваем институт: ${D().CIVICS.find((x) => x.id === id).name}.` };
  }
  function policySlots(s, realmId) {
    const R = s.realms[realmId];
    const slots = { military: 1, economic: 1 };
    for (const id of R.civics) { const cv = D().CIVICS.find((x) => x.id === id); if (cv.slot) slots[cv.slot]++; }
    return slots;
  }
  function unlockedPolicies(s, realmId) { return s.realms[realmId].civics.flatMap((id) => D().CIVICS.find((x) => x.id === id).unlocks); }
  function setPolicies(s, realmId, military, economic) {
    const slots = policySlots(s, realmId), un = unlockedPolicies(s, realmId), P = D().POLICIES;
    const okList = (list, kind) => list.length <= slots[kind] && list.every((p) => un.includes(p) && P[p].slot === kind);
    if (!okList(military, 'military') || !okList(economic, 'economic')) return { ok: false, msg: 'Недопустимый набор политик.' };
    s.realms[realmId].policies = { military: military.slice(), economic: economic.slice() };
    return { ok: true, msg: 'Политики утверждены.' };
  }
  function autoPolicies(s, realmId) {
    const slots = policySlots(s, realmId), un = unlockedPolicies(s, realmId), P = D().POLICIES;
    const p = realmId === PLAYER ? { aggression: 0.4, greed: 0.5 } : personality(s, realmId);
    const pref = { discipline: 0.4, conscription: 0.5 + p.aggression * 0.3, chivalry_code: 0.6 + p.aggression * 0.4, taxation: 0.5 + p.greed * 0.3, agrarian: 0.55, guilds: 0.4 + p.greed * 0.4, divine_right: s.realms[realmId].stability < 45 ? 0.9 : 0.35, patronage: 0.6 };
    const pickK = (kind) => un.filter((x) => P[x].slot === kind).sort((a, b) => pref[b] - pref[a]).slice(0, slots[kind]);
    s.realms[realmId].policies = { military: pickK('military'), economic: pickK('economic') };
  }

  function continueGoto(s, u) {
    if (!u.goto || u.mp <= 0) return;
    const g = u.goto;
    const r = moveUnit(s, u.id, g.c, g.r);
    if (!r.ok) u.goto = null;
  }

  // ------------------------------------------------------------------ ГОРОДА
  function foundCityAt(s, realm, c, r, capital) {
    const R = s.realms[realm];
    const id = 'city' + s.nextId++;
    const name = R.cityNames.shift() || `${R.short}-${citiesOf(s, realm).length + 1}`;
    const city = { id, name, realm, c, r, pop: 1, food: 0, prod: 0, item: null, buildings: [], hp: 200, culture: 0, radius: 1, capital: !!capital, origRealm: realm, foundedTurn: s.turn, bombarded: false };
    s.cities[id] = city;
    tileAt(s, c, r).cityId = id;
    if (capital) { R.capitalId = id; if (!R.origCapitalId) R.origCapitalId = id; }
    recomputeOwnership(s);
    return city;
  }

  function canFound(s, u) {
    if (!u || u.type !== 'settler') return { ok: false, msg: 'Город могут основать только поселенцы.' };
    const t = tileAt(s, u.c, u.r);
    if (!passable(t) || t.t === 'mountain') return { ok: false, msg: 'Здесь нельзя строить город.' };
    if (t.owner && t.owner !== u.realm) return { ok: false, msg: 'Это чужая земля.' };
    for (const city of Object.values(s.cities)) if (dist(city.c, city.r, u.c, u.r) < 3) return { ok: false, msg: `Слишком близко к городу ${city.name} (нужно ≥ 3 клеток).` };
    return { ok: true };
  }

  function foundCity(s, uid) {
    const u = s.units[uid];
    const chk = canFound(s, u);
    if (!chk.ok) return chk;
    killUnit(s, u);
    const city = foundCityAt(s, u.realm, u.c, u.r, citiesOf(s, u.realm).length === 0);
    if (u.realm === PLAYER) { s.stats.citiesFounded++; AI().PlayerModel.observe(s.playerModel, 'econ'); updateVisibility(s); }
    s.realms[u.realm].prestige += 5;
    log(s, `Основан город ${city.name} (${s.realms[u.realm].short}).`, 'city', city.c, city.r);
    return { ok: true, city, msg: `Основан город ${city.name}!` };
  }

  function recomputeOwnership(s) {
    const cities = Object.values(s.cities);
    for (let r = 0; r < s.h; r++) for (let c = 0; c < s.w; c++) {
      const t = s.tiles[idx(s, c, r)];
      let best = null, bd = 99;
      for (const city of cities) {
        const d = dist(c, r, city.c, city.r);
        if (d <= city.radius && (d < bd || (d === bd && best && city.foundedTurn < best.foundedTurn))) { bd = d; best = city; }
      }
      if (t.boughtBy && s.cities[t.boughtBy] && (!best || bd > 0)) best = s.cities[t.boughtBy];
      if (t.district && t.distCity && s.cities[t.distCity]) best = s.cities[t.distCity];
      t.owner = best ? best.realm : null;
      t.workCity = best ? best.id : null;
    }
  }

  function tileYield(s, c, r) {
    const t = tileAt(s, c, r);
    const T = D().TERRAIN[t.t];
    const y = { food: T.food, prod: T.prod, gold: T.gold };
    if (t.res) { const R = D().RESOURCES[t.res]; y.food += R.food; y.prod += R.prod; y.gold += R.gold; }
    if (t.imp) { const I = D().IMPROVEMENTS[t.imp]; y.food += I.food; y.prod += I.prod; y.gold += I.gold; }
    if (t.river) y.gold += 1;
    return y;
  }

  function cityYields(s, city) {
    const realm = s.realms[city.realm];
    const B = D().BUILDINGS;
    const center = tileYield(s, city.c, city.r);
    const y = { food: Math.max(2, center.food), prod: Math.max(1, center.prod), gold: Math.max(1, center.gold) + 1, sci: 1, culture: 1 };
    const tiles = [];
    for (const [c, r] of inRadius(s, city.c, city.r, city.radius)) {
      if (c === city.c && r === city.r) continue;
      const t = tileAt(s, c, r);
      if (t.workCity !== city.id || t.district) continue;
      const ty = tileYield(s, c, r);
      tiles.push({ c, r, ...ty, score: ty.food * 2.2 + ty.prod + ty.gold * 0.8 });
    }
    tiles.sort((a, b) => b.score - a.score);
    const worked = tiles.slice(0, city.pop);
    for (const t of worked) { y.food += t.food; y.prod += t.prod; y.gold += t.gold; }
    y.sci += city.pop * 0.6;
    if (city.capital) { y.gold += 2; y.sci += 2; y.culture += 1; y.prod += 1; }
    let goldPct = 0;
    for (const b of city.buildings) {
      const bd = B[b];
      y.food += bd.food || 0; y.prod += bd.prod || 0; y.gold += bd.gold || 0; y.sci += bd.sci || 0; y.culture += bd.culture || 0; goldPct += bd.goldPct || 0;
    }
    for (const [id, pos] of Object.entries(city.districts || {})) {
      const Dd = D().DISTRICTS[id];
      for (const [k, v] of Object.entries(Dd.base)) y[k] += v;
      y[Dd.yieldKey] += districtAdjacency(s, pos[0], pos[1], id);
    }
    if (hasPolicy(s, city.realm, 'agrarian')) y.food += 1;
    if (hasPolicy(s, city.realm, 'taxation')) goldPct += 10;
    const ruler = realm.rulerId;
    y.gold *= 1 + goldPct / 100 + stat(s, ruler, 'stw') * 0.03;
    y.sci *= 1 + stat(s, ruler, 'lrn') * 0.04 + (hasPolicy(s, city.realm, 'patronage') ? 0.15 : 0);
    y.prod *= 1 + stat(s, ruler, 'stw') * 0.02;
    if (!realm.isPlayer) { y.prod *= s.aiLevel; y.sci *= s.aiLevel; y.gold *= s.aiLevel; }
    if (realm.stability < 30) { y.prod *= 0.75; y.gold *= 0.75; y.sci *= 0.75; }
    y.foodNet = y.food - city.pop * 2;
    for (const k of ['food', 'prod', 'gold', 'sci', 'culture', 'foodNet']) y[k] = Math.round(y[k] * 10) / 10;
    y.worked = worked;
    return y;
  }

  const growthNeed = (city) => 12 + city.pop * 7;
  const defOf = (item) => (item.kind === 'unit' ? D().UNITS : item.kind === 'district' ? D().DISTRICTS : D().BUILDINGS)[item.id];
  const itemCost = (item) => defOf(item).cost;
  const itemName = (item) => defOf(item).name;

  function availableItems(s, city) {
    const R = s.realms[city.realm];
    const ds = cityDistricts(s, city);
    const out = [];
    for (const [id, u] of Object.entries(D().UNITS)) if (!u.hero && (!u.req || R.techs.includes(u.req))) out.push({ kind: 'unit', id });
    for (const [id, d] of Object.entries(D().DISTRICTS)) if (!ds[id] && (!d.req || R.techs.includes(d.req)) && districtSpots(s, city, id).length) out.push({ kind: 'district', id });
    for (const [id, b] of Object.entries(D().BUILDINGS)) if (!city.buildings.includes(id) && (!b.req || R.techs.includes(b.req)) && (!b.district || ds[b.district])) out.push({ kind: 'building', id });
    return out;
  }

  function setProduction(s, cityId, item) {
    const city = s.cities[cityId];
    if (!city) return { ok: false, msg: 'Город не найден.' };
    if (item.kind === 'building' && D().BUILDINGS[item.id] && D().BUILDINGS[item.id].district && !cityDistricts(s, city)[D().BUILDINGS[item.id].district]) return { ok: false, msg: `«${D().BUILDINGS[item.id].name}» строится в квартале «${D().DISTRICTS[D().BUILDINGS[item.id].district].name}» — сначала постройте квартал.` };
    if (!availableItems(s, city).some((i) => i.kind === item.kind && i.id === item.id)) return { ok: false, msg: `«${itemName(item)}» пока недоступно (нужна технология, место или уже построено).` };
    if (item.kind === 'district') {
      if (item.c === undefined) { const best = districtSpots(s, city, item.id)[0]; item = { ...item, c: best.c, r: best.r }; }
      if (!validDistrictTile(s, city, item.c, item.r)) return { ok: false, msg: 'Квартал можно разместить только на свободной клетке города (не в центре).' };
    }
    if (item.kind === 'unit' && item.id === 'settler' && city.pop < 2) return { ok: false, msg: 'Поселенцам нужен город с населением ≥ 2.' };
    city.item = { ...item };
    if (city.realm === PLAYER) AI().PlayerModel.observe(s.playerModel, item.kind === 'unit' && item.id !== 'settler' ? 'military' : 'econ');
    return { ok: true, msg: `${city.name}: производство — ${itemName(item)}.` };
  }

  function buyCost(city) { return city.item ? Math.ceil(Math.max(0, itemCost(city.item) - city.prod) * 2.2) : 0; }
  function buyItem(s, cityId) {
    const city = s.cities[cityId];
    if (!city || !city.item) return { ok: false, msg: 'Сначала выберите, что производить.' };
    const cost = buyCost(city), R = s.realms[city.realm];
    if (R.gold < cost) return { ok: false, msg: `Нужно ${cost} золота.` };
    R.gold -= cost;
    city.prod = itemCost(city.item);
    completeItem(s, city);
    return { ok: true, msg: `Куплено за ${cost} золота.` };
  }

  function completeItem(s, city) {
    const item = city.item;
    if (!item) return false;
    if (item.kind === 'unit') {
      if (item.id === 'settler' && city.pop < 2) return false;
      const spot = freeNeighbor(s, city.c, city.r);
      if (!spot) return false;
      const nu = createUnit(s, city.realm, item.id, spot[0], spot[1]);
      if (city.buildings.includes('barracks') && D().UNITS[item.id].str) nu.vet = true;
      if (item.id === 'settler') city.pop -= 1;
    } else if (item.kind === 'district') {
      if (!validDistrictTile(s, city, item.c, item.r)) { const best = districtSpots(s, city, item.id)[0]; if (!best) { city.item = null; return false; } item.c = best.c; item.r = best.r; }
      const t = tileAt(s, item.c, item.r);
      t.district = item.id; t.distCity = city.id; t.imp = null;
      cityDistricts(s, city)[item.id] = [item.c, item.r];
      recomputeOwnership(s);
    } else {
      city.buildings.push(item.id);
      const b = D().BUILDINGS[item.id];
      if (b.hp) city.hp += b.hp;
    }
    city.prod = Math.max(0, city.prod - itemCost(item));
    if (city.realm === PLAYER) log(s, `${city.name}: готово — ${itemName(item)}.`, 'city', city.c, city.r);
    city.item = null;
    return true;
  }

  const maxCityHp = (city) => 200 + city.buildings.reduce((a, b) => a + (D().BUILDINGS[b].hp || 0), 0);
  function cityStrength(s, city) {
    let st = 6 + city.pop * 1.5;
    for (const b of city.buildings) st += D().BUILDINGS[b].def || 0;
    const g = unitAt(s, city.c, city.r);
    if (g && g.realm === city.realm && D().UNITS[g.type].str) st += D().UNITS[g.type].str * 0.5;
    if (city.capital) st += 2;
    if (city.realm !== PLAYER) st *= 1 + (s.aiLevel - 1) * 0.5;
    return st;
  }

  // ------------------------------------------------------------------ БОЙ
  function unitStrength(s, u, opts) {
    const U = D().UNITS[u.type];
    let st = opts.ranged ? U.rstr : U.str;
    if (!st) return 0.5;
    st *= 0.5 + 0.5 * u.hp / 100;
    st *= 1 + stat(s, s.realms[u.realm].rulerId, 'mar') * 0.03;
    if (opts.defending) {
      st *= 1 + D().TERRAIN[tileAt(s, u.c, u.r).t].def / 100;
      if (u.fort) st *= 1.25;
    }
    if (opts.vs && U.antiMounted && D().UNITS[opts.vs.type] && D().UNITS[opts.vs.type].cls === 'mounted') st *= 1.5;
    if (opts.vsCity && U.cls === 'siege') st *= 2;
    if (u.vet) st *= 1.25;
    if (u.hero) {
      st *= 1 + 0.12 * (u.hero.lvl - 1);
      if (u.type === 'hero_berserker' && !opts.defending) st *= 1.3;
    } else if (u.realm !== BANDITS) {
      // аура полководца рядом
      for (const [a, b] of neighbors(s, u.c, u.r)) { const h = unitAt(s, a, b); if (h && h.realm === u.realm && h.type === 'hero_warlord') { st *= 1.2; break; } }
    }
    if (hasPolicy(s, u.realm, 'chivalry_code')) st *= 1.1;
    if (opts.vs && opts.vs.realm === BANDITS && hasPolicy(s, u.realm, 'discipline')) st *= 1.25;
    if (u.realm === BANDITS) st *= 0.85 + Math.min(0.5, s.turn / 160);
    if (u.realm !== PLAYER) st *= 1 + (s.aiLevel - 1) * 0.5;
    return st;
  }
  const dmg = (a, d, s, noise) => clamp(Math.round(30 * Math.pow(a / d, 1.1) * (noise ? 0.8 + rand(s) * 0.4 : 1)), 1, 100);

  /** Прогноз боя без случайности (для подсказок и ИИ). */
  function forecast(s, u, tc, tr) {
    const U = D().UNITS[u.type];
    const ranged = U.range > 0;
    const city = cityAt(s, tc, tr);
    const target = unitAt(s, tc, tr);
    if (city && city.realm !== u.realm) {
      const a = unitStrength(s, u, { ranged, vsCity: true }), d = cityStrength(s, city);
      return { toDef: dmg(a, d, s), toAtt: ranged ? 0 : dmg(d, a, s), defHp: city.hp, city: true, a, d };
    }
    if (target) {
      const a = unitStrength(s, u, { ranged, vs: target });
      const d = unitStrength(s, target, { defending: true, ranged: false, vs: u });
      return { toDef: dmg(a, d, s), toAtt: ranged ? 0 : dmg(d, a, s), defHp: target.hp, city: false, a, d };
    }
    return null;
  }

  function canAttack(s, u, tc, tr) {
    if (!u) return { ok: false, msg: 'Нет отряда.' };
    const U = D().UNITS[u.type];
    if (!U.str && !U.rstr) return { ok: false, msg: 'Этот отряд не может сражаться.' };
    if (u.mp <= 0) return { ok: false, msg: 'Отряд уже израсходовал ходы.' };
    const d = dist(u.c, u.r, tc, tr);
    const range = U.range || 1;
    if (d > range || d === 0) return { ok: false, msg: U.range ? `Цель вне дальности (${U.range}).` : 'Цель должна быть рядом.' };
    const city = cityAt(s, tc, tr), target = unitAt(s, tc, tr);
    const owner = city && city.realm !== u.realm ? city.realm : target && target.realm !== u.realm ? target.realm : null;
    if (!owner) return { ok: false, msg: 'Здесь нет врага.' };
    if (getPact(s, u.realm, owner) !== 'war') return { ok: false, needWar: owner, msg: `Вы не воюете с: ${s.realms[owner].short}.` };
    return { ok: true, owner };
  }

  function attack(s, uid, tc, tr) {
    const u = s.units[uid];
    const chk = canAttack(s, u, tc, tr);
    if (!chk.ok) return chk;
    const U = D().UNITS[u.type];
    const ranged = U.range > 0;
    const city = cityAt(s, tc, tr) && cityAt(s, tc, tr).realm !== u.realm ? cityAt(s, tc, tr) : null;
    const target = unitAt(s, tc, tr);
    const owner = chk.owner;
    const res = { att: u.realm, def: owner, killed: false, attackerDied: false, captured: false, city: !!city, c: tc, r: tr };
    const ac = u.c, ar = u.r, defHero = target && target.hero ? target : null;
    u.fort = false; u.mp = 0; u.goto = null;
    if (u.realm === PLAYER && owner !== BANDITS) { s.turnAttacks[owner] = true; AI().PlayerModel.observe(s.playerModel, 'attack'); }
    if (owner === PLAYER) s.turnAttacks._against = true;
    if (city) {
      const a = unitStrength(s, u, { ranged, vsCity: true }), d = cityStrength(s, city);
      const toCity = dmg(a, d, s, true), toAtt = ranged ? 0 : dmg(d, a, s, true);
      city.hp = Math.max(0, city.hp - toCity * 2);
      city.bombarded = true;
      u.hp -= toAtt;
      res.toDef = toCity * 2; res.toAtt = toAtt;
      if (target && target.realm === city.realm) target.hp = Math.max(1, target.hp - Math.round(toCity / 2));
      if (u.hp <= 0) { res.attackerDied = true; killUnit(s, u); warLoss(s, u.realm, owner, 'units'); }
      else if (city.hp <= 0 && u.realm === BANDITS) { city.hp = 1; const loot = Math.min(40, s.realms[city.realm].gold); s.realms[city.realm].gold -= loot; log(s, `Разбойники грабят окрестности города ${city.name}: −${loot} золота.`, 'war', city.c, city.r); }
      else if (city.hp <= 0 && !ranged && U.cls !== 'siege') {
        if (target && target.realm === city.realm) { killUnit(s, target); warLoss(s, owner, u.realm, 'units'); }
        captureCity(s, city, u.realm);
        u.c = tc; u.r = tr; invalidate(s);
        res.captured = true;
      }
    } else if (target) {
      const a = unitStrength(s, u, { ranged, vs: target });
      const d = unitStrength(s, target, { defending: true, vs: u });
      if (D().UNITS[target.type].cls === 'civil') {
        killUnit(s, target); res.killed = true; warLoss(s, owner, u.realm, 'units');
        if (!ranged) { u.c = tc; u.r = tr; invalidate(s); }
      } else {
        const toDef = dmg(a, d, s, true), toAtt = ranged ? 0 : dmg(d, a, s, true);
        target.hp -= toDef; u.hp -= toAtt;
        res.toDef = toDef; res.toAtt = toAtt;
        if (target.hp <= 0) {
          killUnit(s, target); res.killed = true; warLoss(s, owner, u.realm, 'units');
          if (!ranged && u.hp > 0) { u.c = tc; u.r = tr; invalidate(s); }
        }
        if (u.hp <= 0) { killUnit(s, u); res.attackerDied = true; warLoss(s, u.realm, owner, 'units'); }
      }
    }
    // опыт героев и эффекты боя
    if (!res.attackerDied && u.hero) {
      if (u.type === 'hero_berserker' && (res.killed || res.captured)) u.hp = Math.min(100, u.hp + 25);
      heroGainXp(s, u, 10 + (res.killed ? 20 : 0) + (res.captured ? 30 : 0));
    }
    if (defHero && !res.killed) heroGainXp(s, defHero, 8 + (res.attackerDied ? 20 : 0));
    fx(s, { type: 'battle', aid: uid, from: [ac, ar], to: [tc, tr], ranged, att: u.realm, def: owner, toDef: res.toDef || 0, toAtt: res.toAtt || 0, killed: res.killed, died: res.attackerDied, captured: res.captured, city: !!city, utype: u.type, dtype: target ? target.type : null });
    if (u.realm === PLAYER || owner === PLAYER) {
      if (u.realm === PLAYER && res.killed) { s.stats.unitsKilled++; s.stats.battlesWon++; s.realms[PLAYER].prestige += 3; }
      if (owner === PLAYER && res.attackerDied) { s.stats.unitsKilled++; s.stats.battlesWon++; }
      if (owner === PLAYER && res.killed) s.stats.unitsLost++;
      if (u.realm === PLAYER && res.attackerDied) s.stats.unitsLost++;
      updateVisibility(s);
    }
    res.text = battleText(s, u, res);
    log(s, res.text, 'war', tc, tr);
    checkElimination(s);
    checkEnd(s);
    return { ok: true, ...res };
  }

  function battleText(s, u, res) {
    const A = s.realms[res.att].short, B = s.realms[res.def].short, name = D().UNITS[u.type].name;
    if (res.captured) return `${A}: ${name} захватывают город!`;
    if (res.city) return `${A}: ${name} атакуют город (${B}): −${res.toDef} прочности${res.toAtt ? `, потери −${res.toAtt} HP` : ''}${res.attackerDied ? '. Отряд погиб!' : ''}.`;
    if (res.killed && res.attackerDied) return `${A} и ${B}: оба отряда уничтожены.`;
    if (res.killed) return `${A}: ${name} разбили врага (${B})!`;
    if (res.attackerDied) return `${A}: ${name} погибли в атаке на ${B}.`;
    return `${A}: ${name} атакуют (${B}): урон ${res.toDef}${res.toAtt ? `, ответный ${res.toAtt}` : ''}.`;
  }

  function warLoss(s, loser, winner, kind) {
    const w = s.wars[pairKey(loser, winner)];
    if (!w) return;
    w.loss[loser] = w.loss[loser] || { units: 0, cities: 0 };
    w.loss[loser][kind]++;
  }

  function captureCity(s, city, by) {
    const old = city.realm;
    city.realm = by;
    city.hp = 60;
    city.pop = Math.max(1, city.pop - 1);
    city.item = null;
    city.prod = 0;
    city.buildings = city.buildings.filter((b) => b !== 'walls' || rand(s) < 0.5);
    if (city.capital) {
      city.capital = false;
      const rest = citiesOf(s, old);
      if (rest.length) { rest[0].capital = true; s.realms[old].capitalId = rest[0].id; }
    }
    warLoss(s, old, by, 'cities');
    addOpinion(s, old, by, 'Захватил наш город', -40, 60);
    s.realms[old].stability -= 12;
    s.realms[by].prestige += 15;
    if (by === PLAYER) s.stats.citiesCaptured++;
    recomputeOwnership(s);
    fx(s, { type: 'capture', c: city.c, r: city.r, by, old });
    log(s, `${s.realms[by].short} захватывает город ${city.name} у ${s.realms[old].short}!`, 'war', city.c, city.r);
  }

  function checkElimination(s) {
    for (const id of aliveIds(s)) {
      if (citiesOf(s, id).length === 0 && !unitsOf(s, id).some((u) => u.type === 'settler')) {
        s.realms[id].alive = false;
        for (const u of unitsOf(s, id)) killUnit(s, u);
        for (const o of s.order) if (o !== id) { delete s.pacts[pairKey(id, o)]; delete s.wars[pairKey(id, o)]; }
        log(s, `${s.realms[id].name} пало и исчезло с карты!`, 'war');
      }
    }
  }

  // ------------------------------------------------------------------ НАУКА
  function techAvailable(s, realmId, techId) {
    const T = D().TECHS.find((t) => t.id === techId), R = s.realms[realmId];
    return T && !R.techs.includes(techId) && T.req.every((q) => R.techs.includes(q));
  }
  function setResearch(s, realmId, techId) {
    if (!techAvailable(s, realmId, techId)) return { ok: false, msg: 'Эта технология недоступна: нужны предыдущие открытия.' };
    s.realms[realmId].researching = techId;
    return { ok: true, msg: `Учёные изучают: ${D().TECHS.find((t) => t.id === techId).name}.` };
  }
  function chooseDefaultResearch(s, realmId) {
    const opts = D().TECHS.filter((t) => techAvailable(s, realmId, t.id));
    s.realms[realmId].researching = opts.length ? opts.sort((a, b) => a.cost - b.cost)[0].id : null;
  }
  const techCost = (s, t, realmId) => Math.round(t.cost * (1 + s.realms[realmId || PLAYER].techs.length * 0.12));

  // ------------------------------------------------------------------ ДИПЛОМАТИЯ
  function declareWar(s, a, b) {
    if (getPact(s, a, b) === 'war') return { ok: false, msg: 'Война уже идёт.' };
    if (s.realms[b].overlord === a) s.realms[b].overlord = null;
    if (s.realms[a].overlord === b) s.realms[a].overlord = null;
    s.pacts[pairKey(a, b)] = 'war';
    s.wars[pairKey(a, b)] = { start: s.turn, loss: {} };
    fx(s, { type: 'war', a, b });
    addOpinion(s, b, a, 'Объявил нам войну', -40, 40);
    if (married(s, a, b)) { delete s.marriages[pairKey(a, b)]; s.realms[a].prestige -= 20; s.realms[a].stability -= 5; }
    for (const o of aliveIds(s)) {
      if (o === a || o === b) continue;
      const p = personality(s, o);
      addOpinion(s, o, a, 'Развязывает войны', -Math.round(4 + p.honor * 8), 30);
      if (getPact(s, o, b) === 'alliance' && getPact(s, o, a) !== 'alliance' && p.honor >= 0.45) {
        s.pacts[pairKey(o, a)] = 'war';
        s.wars[pairKey(o, a)] = { start: s.turn, loss: {} };
        log(s, `${rulerTitle(s, o)} верен союзу с ${s.realms[b].short} и вступает в войну против ${s.realms[a].short}!`, 'war');
      }
    }
    if (a === PLAYER) { s.stats.warsDeclared++; s.turnAttacks[b] = true; AI().PlayerModel.observe(s.playerModel, 'attack'); }
    log(s, `${s.realms[a].short} объявляет войну: ${s.realms[b].name}!`, 'war');
    return { ok: true, msg: `Война объявлена: ${s.realms[b].name}.` };
  }

  function makePeace(s, a, b) {
    s.pacts[pairKey(a, b)] = 'peace';
    delete s.wars[pairKey(a, b)];
    addOpinion(s, a, b, 'Недавний мир', 10, 15);
    addOpinion(s, b, a, 'Недавний мир', 10, 15);
    log(s, `${s.realms[a].short} и ${s.realms[b].short} заключили мир.`, 'diplo');
  }

  const DIPLO = ['gift', 'trade', 'alliance', 'marriage', 'peace', 'tribute', 'war'];
  /** Дипломатическое действие игрока. */
  function diplomacy(s, target, type, amount) {
    if (s.over) return { ok: false, msg: 'Игра окончена.' };
    const T = s.realms[target], P = s.realms[PLAYER];
    if (!T || !T.alive || target === PLAYER) return { ok: false, msg: 'Неверная цель.' };
    const pact = getPact(s, PLAYER, target);
    const cd = (P.cooldowns = P.cooldowns || {});
    const key = target + type;
    if (type !== 'war' && type !== 'gift' && cd[key] && cd[key] > s.turn) return { ok: false, msg: `${rulerTitle(s, target)} не станет обсуждать это ещё ${cd[key] - s.turn} ход(а).` };
    if (type === 'war') {
      if (pact === 'alliance' || married(s, PLAYER, target)) P.stability -= 8;
      const r = declareWar(s, PLAYER, target);
      return r;
    }
    if (type === 'gift') {
      const g = clamp(Math.round(amount || 50), 25, Math.max(25, P.gold));
      if (P.gold < g) return { ok: false, msg: `Нужно ${g} золота.` };
      P.gold -= g; T.gold += g;
      const recent = (T.opinion[PLAYER] || []).find((m) => m.label === 'Подарки');
      const gain = Math.round((g / 50) * 12 * (0.6 + personality(s, target).greed * 0.7) / (1 + (recent ? recent.value / 30 : 0)));
      addOpinion(s, target, PLAYER, 'Подарки', gain, 12, true);
      AI().PlayerModel.observe(s.playerModel, 'diplo');
      return { ok: true, msg: `Дары (${g} золота) приняты при дворе: ${rulerTitle(s, target)}. Мнение +${gain}.` };
    }
    if (type === 'trade' && pact !== 'peace') return { ok: false, msg: pact === 'war' ? 'Во время войны торговля невозможна.' : 'Торговля уже налажена.' };
    if (type === 'alliance' && (pact === 'alliance' || pact === 'war')) return { ok: false, msg: pact === 'war' ? 'Сначала заключите мир.' : 'Союз уже заключён.' };
    if (type === 'marriage' && (married(s, PLAYER, target) || pact === 'war')) return { ok: false, msg: pact === 'war' ? 'Свадьбы во время войны не играют.' : 'Брак уже заключён.' };
    if (type === 'peace' && pact !== 'war') return { ok: false, msg: 'Вы не воюете.' };
    if (type === 'tribute') {
      if (!P.techs.includes('feudalism')) return { ok: false, msg: 'Вассалитет требует технологии «Феодализм».' };
      if (T.overlord === PLAYER) return { ok: false, msg: 'Уже ваш вассал.' };
    }
    const resp = AI().RealmAI.respond(s, target, PLAYER, type);
    cd[key] = s.turn + (resp.accept ? 1 : 5);
    AI().PlayerModel.observe(s.playerModel, 'diplo');
    if (resp.accept) applyAgreement(s, PLAYER, target, type);
    else addOpinion(s, target, PLAYER, 'Отвергнутые требования', type === 'tribute' ? -20 : -3, 10);
    const names = { trade: 'торговый договор', alliance: 'союз', marriage: 'династический брак', peace: 'мир', tribute: 'вассальную присягу' };
    checkEnd(s);
    return { ok: true, accepted: resp.accept, prob: resp.prob, msg: `${rulerTitle(s, target)} ${resp.accept ? 'принимает' : 'отвергает'} ${names[type]} (вероятность ${Math.round(resp.prob * 100)}%). ${resp.line}` };
  }

  function applyAgreement(s, a, b, type) {
    const k = pairKey(a, b);
    if (type === 'trade') s.pacts[k] = 'trade';
    if (type === 'alliance') s.pacts[k] = 'alliance';
    if (type === 'peace') makePeace(s, a, b);
    if (type === 'marriage') {
      s.marriages[k] = true;
      s.realms[a].prestige += 10; s.realms[b].prestige += 10;
      if (a === PLAYER || b === PLAYER) s.stats.marriages++;
      log(s, `Династический брак: ${s.realms[a].short} и ${s.realms[b].short} породнились.`, 'diplo');
    }
    if (type === 'tribute') { s.realms[b].overlord = a; if (s.pacts[k] === 'war') makePeace(s, a, b); s.pacts[k] = 'alliance'; log(s, `${s.realms[b].short} присягает на верность ${s.realms[a].short}.`, 'diplo'); }
    if (type === 'trade' || type === 'alliance') log(s, `${s.realms[a].short} и ${s.realms[b].short}: ${type === 'trade' ? 'торговый договор и открытые границы' : 'военный союз'}.`, 'diplo');
  }

  function respondProposal(s, pid, accept) {
    const i = s.proposals.findIndex((p) => p.id === pid);
    if (i < 0) return { ok: false, msg: 'Предложение не найдено.' };
    const p = s.proposals.splice(i, 1)[0];
    const from = p.from;
    if (!s.realms[from].alive) return { ok: false, msg: 'Держава пала.' };
    let msg;
    if (p.type === 'tribute_demand') {
      if (accept) { const g = Math.min(p.amount, s.realms[PLAYER].gold); s.realms[PLAYER].gold -= g; s.realms[from].gold += g; addOpinion(s, from, PLAYER, 'Платит дань', 15, 20); msg = `Вы выплатили ${g} золота.`; }
      else { addOpinion(s, from, PLAYER, 'Отказ платить дань', -25, 25); s.realms[from].grudge = (s.realms[from].grudge || 0) + 1; msg = 'Вы отвергли требование. Ждите беды.'; }
    } else if (accept) {
      const pact = getPact(s, PLAYER, from);
      if ((p.type === 'trade' && pact !== 'peace') || (p.type === 'alliance' && pact === 'war') || (p.type === 'peace' && pact !== 'war')) return { ok: false, msg: 'Предложение устарело.' };
      applyAgreement(s, from, PLAYER, p.type);
      addOpinion(s, from, PLAYER, 'Принял наше предложение', 10, 15);
      msg = 'Договор заключён.';
    } else { addOpinion(s, from, PLAYER, 'Отверг наше предложение', -8, 10); msg = 'Предложение отклонено.'; }
    checkEnd(s);
    return { ok: true, msg };
  }

  function pushProposal(s, from, type, extra) {
    if (s.proposals.some((p) => p.from === from && p.type === type)) return;
    const R = s.realms[from];
    R.lastProposal = R.lastProposal || {};
    R.lastProposal[type] = s.turn;
    s.proposals.push({ id: `${from}-${type}-${s.turn}`, from, type, ...(extra || {}) });
  }

  // ------------------------------------------------------------------ СОБЫТИЯ
  function chooseEvent(s, choiceIdx) {
    const ev = D().EVENTS.find((e) => e.id === s.pendingEvent);
    if (!ev) return { ok: false, msg: 'Нет события.' };
    const ch = ev.choices[choiceIdx] || ev.choices[0];
    let fx = ch.fx, extra = '';
    if (fx.check) {
      const v = stat(s, s.realms[PLAYER].rulerId, fx.check) + Math.floor(rand(s) * 6);
      const ok = v >= fx.dc;
      extra = ok ? ' Успех!' : ' Неудача.';
      fx = ok ? fx.win : fx.lose;
    }
    applyFx(s, PLAYER, fx);
    s.pendingEvent = null;
    log(s, `${ev.title}: ${ch.label}.${extra}`, 'event');
    checkEnd(s);
    return { ok: true, msg: `${ch.label}.${extra}` };
  }

  function applyFx(s, realmId, fx) {
    const R = s.realms[realmId];
    const cap = s.cities[R.capitalId];
    if (fx.gold) R.gold = Math.max(0, R.gold + fx.gold);
    if (fx.stability) R.stability = clamp(R.stability + fx.stability, 0, 100);
    if (fx.prestige) R.prestige += fx.prestige;
    if (fx.science) R.science = Math.max(0, R.science + fx.science);
    if (fx.goldPerTurn) R.goldBonus += fx.goldPerTurn;
    if (fx.capitalProd && cap) cap.prod += fx.capitalProd;
    if (fx.foodAll) for (const c of citiesOf(s, realmId)) c.food += fx.foodAll;
    if (fx.popLoss) { const cs = citiesOf(s, realmId).filter((c) => c.pop > 1); if (cs.length) pick(s, cs).pop -= fx.popLoss; }
    if (fx.heirTrait) { const h = s.chars[R.heirId]; if (h) { h.traits = h.traits.filter((t) => t !== D().TRAITS[fx.heirTrait].opp && t !== 'lazy' && t !== 'diligent'); if (!h.traits.includes(fx.heirTrait)) h.traits.push(fx.heirTrait); } }
    if (fx.rulerTraitChance && rand(s) < fx.rulerTraitChance[1]) { const r = s.chars[R.rulerId]; const t = fx.rulerTraitChance[0]; r.traits = r.traits.filter((x) => x !== D().TRAITS[t].opp); if (!r.traits.includes(t)) r.traits.push(t); }
  }

  // ------------------------------------------------------------------ ВИДИМОСТЬ
  function updateVisibility(s) {
    const vis = new Set();
    const mark = (c, r, rad) => { for (const [a, b] of inRadius(s, c, r, rad)) { const k = idx(s, a, b); vis.add(k); s.explored[k] = 1; } };
    for (const u of unitsOf(s, PLAYER)) mark(u.c, u.r, 2);
    for (const city of citiesOf(s, PLAYER)) mark(city.c, city.r, city.radius + 2);
    for (const id of aliveIds(s)) if (id !== PLAYER && (getPact(s, PLAYER, id) === 'alliance' || s.realms[id].overlord === PLAYER)) for (const city of citiesOf(s, id)) mark(city.c, city.r, 2);
    Object.defineProperty(s, '_vis', { value: vis, writable: true, enumerable: false, configurable: true });
    return vis;
  }
  const visible = (s, c, r) => (s._vis || updateVisibility(s)).has(idx(s, c, r));

  // ------------------------------------------------------------------ ОБСЧЁТ ХОДА
  function militaryPower(s, id) {
    let p = 0;
    for (const u of unitsOf(s, id)) { const U = D().UNITS[u.type]; p += Math.max(U.str, U.rstr) * (0.4 + 0.6 * u.hp / 100); }
    p *= 1 + stat(s, s.realms[id].rulerId, 'mar') * 0.03;
    if (id !== PLAYER) p *= 1 + (s.aiLevel - 1) * 0.5;
    return p + citiesOf(s, id).length * 4;
  }

  function realmIncome(s, id) {
    const R = s.realms[id];
    let gold = 0, sci = 0, culture = 0;
    for (const c of citiesOf(s, id)) { const y = cityYields(s, c); gold += y.gold; sci += y.sci; culture += y.culture; }
    const cities = citiesOf(s, id).length;
    const units = unitsOf(s, id).length;
    const unitUpkeep = Math.max(0, units - cities * 2 - 1 - (hasPolicy(s, id, 'conscription') ? 2 : 0));
    const bUpkeep = citiesOf(s, id).reduce((a, c) => a + c.buildings.length, 0) * 0.8;
    const trade = aliveIds(s).filter((o) => o !== id && ['trade', 'alliance'].includes(getPact(s, id, o))).length * (hasPolicy(s, id, 'guilds') ? 5 : 3);
    let tribute = 0;
    for (const o of aliveIds(s)) if (s.realms[o].overlord === id) tribute += 4;
    if (R.overlord) tribute -= 4;
    const net = gold + trade + tribute + R.goldBonus - unitUpkeep - bUpkeep;
    return { gold: Math.round(gold * 10) / 10, sci: Math.round(sci * 10) / 10, culture, net: Math.round(net * 10) / 10, unitUpkeep, bUpkeep: Math.round(bUpkeep), trade, tribute };
  }

  function stabilityTarget(s, id) {
    const R = s.realms[id];
    let t = 60;
    const ch = s.chars[R.rulerId];
    if (ch) for (const tr of ch.traits) t += (D().TRAITS[tr].fx.stability || 0) * 6;
    for (const c of citiesOf(s, id)) for (const b of c.buildings) t += (D().BUILDINGS[b].stability || 0) * 3;
    t -= aliveIds(s).filter((o) => getPact(s, id, o) === 'war').length * 6;
    t -= Math.max(0, citiesOf(s, id).length - 6) * 2;
    if (hasPolicy(s, id, 'divine_right')) t += 8;
    return clamp(t, 5, 95);
  }

  function processRealm(s, id) {
    const R = s.realms[id];
    const inc = realmIncome(s, id);
    for (const city of citiesOf(s, id)) {
      const y = cityYields(s, city);
      city.food += y.foodNet;
      if (city.food >= growthNeed(city)) { city.pop++; city.food = city.buildings.includes('granary') ? Math.round(growthNeed(city) * 0.25) : 0; if (id === PLAYER) log(s, `${city.name} вырос до ${city.pop}.`, 'city', city.c, city.r); }
      else if (city.food < 0) { if (city.pop > 1) { city.pop--; if (id === PLAYER) log(s, `${city.name}: голод! Население сократилось.`, 'war', city.c, city.r); } city.food = 0; }
      if (city.item) { city.prod += y.prod; if (city.prod >= itemCost(city.item)) completeItem(s, city); }
      else city.prod += y.prod * 0.5;
      city.culture += y.culture;
      if (city.radius < 2 && city.culture >= 15) { city.radius = 2; recomputeOwnership(s); if (id === PLAYER) log(s, `Границы города ${city.name} расширились.`, 'city', city.c, city.r); }
      if (!city.bombarded) city.hp = Math.min(maxCityHp(city), city.hp + 20);
      city.bombarded = false;
    }
    R.gold += inc.net;
    if (R.gold < 0) {
      const us = unitsOf(s, id).filter((u) => u.type !== 'settler' && !u.hero);
      if (us.length) { const u = pick(s, us); killUnit(s, u); if (id === PLAYER) log(s, `Казна пуста! Отряд «${D().UNITS[u.type].name}» распущен.`, 'war', u.c, u.r); }
      R.stability -= 4; R.gold = 0;
    }
    R.gold = Math.round(R.gold);
    if (R.researching) {
      R.science += inc.sci;
      const T = D().TECHS.find((t) => t.id === R.researching);
      const cost = techCost(s, T, id);
      if (R.science >= cost) {
        R.science -= cost; R.techs.push(T.id); R.researching = null;
        if (id === PLAYER) { s.stats.techs++; log(s, `Открытие: ${T.name}!`, 'tech'); }
        if (id !== PLAYER) chooseDefaultResearch(s, id);
      }
    }
    // Культура → институты
    R.culture += inc.culture;
    if (R.civicResearch) {
      const cv = D().CIVICS.find((x) => x.id === R.civicResearch);
      const cost = civicCost(s, cv, id);
      if (R.culture >= cost) {
        R.culture -= cost; R.civics.push(cv.id); R.civicResearch = null;
        if (id === PLAYER) log(s, `Новый институт: ${cv.name}! ${cv.unlocks.length ? 'Доступны политики: ' + cv.unlocks.map((p) => D().POLICIES[p].name).join(', ') + '.' : 'Открыт новый слот политики.'}`, 'tech');
        else autoPolicies(s, id);
        if (id !== PLAYER) { const nx = D().CIVICS.filter((x) => civicAvailable(s, id, x.id)); R.civicResearch = nx.length ? nx.sort((a, b) => a.cost - b.cost)[0].id : null; }
      }
    }
    R.stability = clamp(R.stability + (stabilityTarget(s, id) - R.stability) * 0.12, 0, 100);
  }

  function cityBombard(s) {
    for (const city of Object.values(s.cities)) {
      if (city.hp < 30) continue;
      let best = null;
      for (const u of Object.values(s.units)) {
        if (u.realm === city.realm || getPact(s, u.realm, city.realm) !== 'war') continue;
        if (dist(u.c, u.r, city.c, city.r) > 2) continue;
        if (!best || u.hp < best.hp) best = u;
      }
      if (!best) continue;
      const d = dmg(cityStrength(s, city) * 0.8, unitStrength(s, best, { defending: true }), s, true);
      best.hp -= d;
      if (best.realm === PLAYER || city.realm === PLAYER) log(s, `Город ${city.name} обстреливает врага: −${d} HP.`, 'war', best.c, best.r);
      if (best.hp <= 0) {
        if (best.realm === PLAYER) s.stats.unitsLost++;
        if (city.realm === PLAYER) s.stats.unitsKilled++;
        warLoss(s, best.realm, city.realm, 'units');
        killUnit(s, best);
      }
    }
  }

  function processCharacters(s) {
    for (const id of aliveIds(s)) {
      const R = s.realms[id];
      const ruler = s.chars[R.rulerId], heir = s.chars[R.heirId];
      ruler.age += D().YEARS_PER_TURN;
      if (heir) heir.age += D().YEARS_PER_TURN;
      const pDeath = ruler.age < 55 ? 0.002 : Math.min(0.3, Math.pow((ruler.age - 50) / 40, 2) * 0.2);
      if (rand(s) < pDeath) succession(s, id);
      else if (heir && rand(s) < 0.004) { heir.alive = false; R.heirId = makeCharacter(s, id, 1 + Math.floor(rand(s) * 5), rand(s) < 0.4).id; if (id === PLAYER) log(s, `Наследник ${heir.name} скончался. Двор в трауре.`, 'event'); }
    }
  }

  function succession(s, id) {
    const R = s.realms[id];
    const old = s.chars[R.rulerId];
    old.alive = false;
    let heir = s.chars[R.heirId];
    if (!heir) heir = makeCharacter(s, id, 18, false);
    if (heir.age < 16) heir.age = 16;
    R.rulerId = heir.id;
    R.heirId = makeCharacter(s, id, 1 + Math.floor(rand(s) * 6), rand(s) < 0.4).id;
    R.stability = clamp(R.stability - 10, 0, 100);
    for (const o of s.order) {
      if (!s.realms[o].opinion[id]) continue;
      s.realms[o].opinion[id] = s.realms[o].opinion[id].map((m) => ({ ...m, value: Math.round(m.value * 0.5) })).filter((m) => Math.abs(m.value) >= 2);
    }
    if (id === PLAYER) s.stats.successions++;
    log(s, `${old.name} (${s.realms[id].short}) скончался в возрасте ${old.age} лет. Трон наследует ${heir.name}.`, id === PLAYER ? 'war' : 'event');
    return heir;
  }

  function decayOpinions(s) {
    for (const id of s.order) {
      const R = s.realms[id];
      for (const o in R.opinion) R.opinion[o] = R.opinion[o].filter((m) => { m.turns--; if (m.turns < 10) m.value *= 0.9; return m.turns > 0 && Math.abs(m.value) >= 1; });
    }
  }

  function captureFeatures(s) {
    s.turnFeatures = {};
    for (const id of aiIds(s)) s.turnFeatures[id] = AI().PlayerModel.features(s, id);
  }

  function updateDifficulty(s) {
    const ids = aiIds(s);
    if (!ids.length) return;
    const str = (id) => militaryPower(s, id) + citiesOf(s, id).length * 25 + s.realms[id].techs.length * 8;
    const avg = ids.reduce((a, id) => a + str(id), 0) / ids.length;
    const ratio = str(PLAYER) / Math.max(1, avg);
    const target = clamp(0.8 + (ratio - 1) * 0.5, 0.7, 1.45);
    s.difficulty = Math.round((s.difficulty * 0.75 + target * 0.25) * 100) / 100;
    let t = 0;
    for (const id of ids) t += AI().RealmAI.threatFrom(s, id, PLAYER) * 0.6 + clamp(-opinion(s, id, PLAYER), 0, 100) / 100 * 0.4;
    s.tension = Math.round((t / ids.length) * 100);
  }

  function rollEvent(s) {
    if (s.pendingEvent || rand(s) > 0.17 || s.turn < 3) return;
    const pool = D().EVENTS.filter((e) => !s.recentEvents.includes(e.id));
    const ev = pick(s, pool.length ? pool : D().EVENTS);
    s.pendingEvent = ev.id;
    s.recentEvents.push(ev.id);
    if (s.recentEvents.length > 5) s.recentEvents.shift();
  }

  /** Конец хода игрока: ходы ИИ, экономика, наука, персонажи, события. */
  function endTurn(s) {
    if (s.over) return null;
    s.notes = [];
    // 1) обучение модели игрока на поступках этого хода
    const learned = [];
    for (const id of Object.keys(s.turnFeatures)) {
      if (!s.realms[id] || !s.realms[id].alive) continue;
      const y = s.turnAttacks[id] ? 1 : 0;
      const p = AI().PlayerModel.update(s.playerModel, s.turnFeatures[id], y);
      learned.push({ id, y, p: Math.round(p * 100) });
    }
    AI().PlayerModel.endTurn(s.playerModel, Object.keys(s.turnAttacks).some((k) => k !== '_against'));
    if (s.pendingEvent) chooseEvent(s, 0);
    for (const p of s.proposals.slice()) respondProposal(s, p.id, false);
    s.proposals = [];
    // 2) ходы ИИ
    const ids = aiIds(s);
    for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(rand(s) * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
    for (const id of ids) { if (s.realms[id].alive && !s.over) AI().RealmAI.takeTurn(s, id); }
    banditTurn(s);
    // 3) экономика и мир
    for (const id of aliveIds(s)) processRealm(s, id);
    cityBombard(s);
    for (const u of Object.values(s.units)) {
      const max = D().UNITS[u.type].mov;
      if (u.mp === max && u.hp < 100) { const t = tileAt(s, u.c, u.r); u.hp = Math.min(100, u.hp + (t.cityId ? 25 : t.owner === u.realm ? 15 : 8)); }
      u.mp = max;
    }
    // Святой свет паладина и возвращение павших героев
    for (const h of Object.values(s.units)) {
      if (h.type !== 'hero_paladin') continue;
      for (const u of [h, ...neighbors(s, h.c, h.r).map(([a, b]) => unitAt(s, a, b))]) {
        if (u && u.realm === h.realm && u.hp < 100) { u.hp = Math.min(100, u.hp + 15); fx(s, { type: 'heal', c: u.c, r: u.r }); }
      }
    }
    for (const id of aliveIds(s)) {
      const R = s.realms[id];
      if (R.heroDown && s.turn + 1 >= R.heroDown.turn) {
        const h = spawnHero(s, id, R.heroDown.lvl, R.heroDown.xp);
        if (h && id === PLAYER) log(s, `Герой ${h.hero.name} оправился от ран и вернулся в столицу.`, 'city', h.c, h.r);
      }
    }
    processCharacters(s);
    decayOpinions(s);
    // вассалы, восставшие при силе
    for (const id of aiIds(s)) {
      const R = s.realms[id];
      if (R.overlord && s.realms[R.overlord].alive && militaryPower(s, id) > militaryPower(s, R.overlord) * 1.4 && personality(s, id).honor < 0.6) {
        log(s, `${R.short} сбрасывает вассальную зависимость!`, 'war'); R.overlord = null;
      }
      for (const o of aliveIds(s)) if (o !== id && getPact(s, id, o) === 'alliance' && opinion(s, id, o) < -25 && R.overlord !== o) { s.pacts[pairKey(id, o)] = 'peace'; log(s, `${rulerTitle(s, id)} разрывает союз с ${s.realms[o].short}.`, 'diplo'); }
    }
    checkElimination(s);
    updateDifficulty(s);
    s.threatHistory.push(Object.fromEntries(aiIds(s).map((id) => [id, Math.round(AI().RealmAI.threatFrom(s, id, PLAYER) * 100)])));
    s.scoreHistory.push(score(s, PLAYER));
    s.unionTurns = unionHolds(s) ? (s.unionTurns || 0) + 1 : 0;
    // 4) новый ход
    s.turn++;
    s.turnAttacks = {};
    for (const u of unitsOf(s, PLAYER)) continueGoto(s, u);
    rollEvent(s);
    captureFeatures(s);
    for (const id of aiIds(s)) s.aiIntel[id] = AI().RealmAI.evaluate(s, id).cands.slice(0, 3);
    updateVisibility(s);
    checkEnd(s);
    return { notes: s.notes.slice(), learned, proposals: s.proposals.slice(), event: s.pendingEvent };
  }

  // ------------------------------------------------------------------ ПОБЕДА / ОЧКИ
  function score(s, id) {
    const R = s.realms[id];
    if (!R.alive) return 0;
    const cs = citiesOf(s, id);
    return Math.round(cs.length * 12 + cs.reduce((a, c) => a + c.pop, 0) * 4 + R.techs.length * 8 + R.prestige * 0.5 + militaryPower(s, id) / 5 + R.gold / 25 + (aliveIds(s).filter((o) => s.realms[o].overlord === id).length * 15));
  }

  function checkEnd(s) {
    if (s.over) return s.over;
    const P = s.realms[PLAYER];
    const others = s.order.filter((id) => id !== PLAYER);
    const finish = (result, reason, text) => { s.over = { result, reason, text, score: finalScore(s, result) }; return s.over; };
    if (!P.alive || (citiesOf(s, PLAYER).length === 0 && !unitsOf(s, PLAYER).some((u) => u.type === 'settler'))) return finish('lose', 'conquest', 'Последний город пал. Династия изгнана из своих земель.');
    if (P.stability <= 0) return finish('lose', 'revolt', 'Бароны подняли мятеж и низложили правителя.');
    const capitals = others.map((id) => s.cities[s.realms[id].origCapitalId]).filter(Boolean);
    if (capitals.length && capitals.every((c) => c.realm === PLAYER)) return finish('win', 'domination', 'Все столицы соперников под вашим знаменем. Победа завоевателя!');
    const alive = others.filter((id) => s.realms[id].alive);
    if ((s.unionTurns || 0) >= UNION_TURNS) return finish('win', 'diplomacy', 'Все державы — ваши союзники или вассалы. Союз корон провозглашён!');
    for (const id of others) {
      const R = s.realms[id];
      if (!R.alive) continue;
      const caps = s.order.filter((o) => o !== id).map((o) => s.cities[s.realms[o].origCapitalId]).filter(Boolean);
      if (caps.every((c) => c.realm === id)) return finish('lose', 'ai_domination', `${R.name} покорило все столицы. Ваша эпоха окончена.`);
    }
    if (s.turn > s.turnLimit) {
      const ranking = aliveIds(s).map((id) => [id, score(s, id)]).sort((a, b) => b[1] - a[1]);
      if (ranking[0][0] === PLAYER) return finish('win', 'score', `Эпоха завершена. Ваша держава — величайшая в летописях (${ranking[0][1]} очков).`);
      return finish('lose', 'score', `Эпоха завершена. Первенство за: ${s.realms[ranking[0][0]].name} (${ranking[0][1]} против ваших ${score(s, PLAYER)}).`);
    }
    return null;
  }

  const UNION_TURNS = 10;
  /** Условие «Союза корон»: все — союзники или вассалы, хотя бы один вассал (нужен Феодализм). */
  function unionHolds(s) {
    const alive = s.order.filter((id) => id !== PLAYER && s.realms[id].alive);
    return alive.length > 0 && alive.every((id) => getPact(s, PLAYER, id) === 'alliance' || s.realms[id].overlord === PLAYER) && alive.some((id) => s.realms[id].overlord === PLAYER);
  }

  function finalScore(s, result) {
    let v = score(s, PLAYER) * 10;
    if (result === 'win') v += 2000 * s.level + Math.max(0, s.turnLimit - s.turn) * 20;
    return Math.round(v * (1 + (s.level - 1) * 0.25));
  }

  /** Отряды игрока, ждущие приказов. */
  function idleUnits(s) {
    return unitsOf(s, PLAYER).filter((u) => u.mp > 0 && !u.fort && !u.sleep && !u.goto);
  }
  function citiesNeedingOrders(s) { return citiesOf(s, PLAYER).filter((c) => !c.item); }

  function fortify(s, uid) { const u = s.units[uid]; if (!u) return { ok: false, msg: 'Нет отряда.' }; u.fort = true; u.goto = null; return { ok: true, msg: 'Отряд укрепился (+25% к обороне).' }; }
  function skipUnit(s, uid) { const u = s.units[uid]; if (!u) return { ok: false, msg: 'Нет отряда.' }; u.sleep = true; return { ok: true, msg: 'Отряд ждёт.' }; }
  function disband(s, uid) { const u = s.units[uid]; if (!u) return { ok: false, msg: 'Нет отряда.' }; if (u.hero) return { ok: false, msg: 'Героя нельзя распустить.' }; killUnit(s, u); return { ok: true, msg: 'Отряд распущен.' }; }

  RF.Engine = {
    PLAYER, rand, pick, clamp, idx, inb, tileAt, neighbors, step, dist, inRadius, passable, DIR_NAMES,
    newGame, year, level, aliveIds, aiIds, citiesOf, unitsOf, unitAt, cityAt, createUnit, killUnit, freeNeighbor, spawnHero, heroGainXp, fx,
    canEnterTerritory, reachable, findPath, dijkstra, moveUnit, continueGoto, canFound, foundCity, foundCityAt, recomputeOwnership,
    tileYield, cityYields, growthNeed, itemCost, itemName, availableItems, setProduction, buyCost, buyItem, cityStrength, maxCityHp,
    unitStrength, forecast, canAttack, attack, captureCity, techAvailable, setResearch, chooseDefaultResearch,
    pairKey, getPact, married, addOpinion, opinion, opinionBreakdown, declareWar, makePeace, diplomacy, applyAgreement, respondProposal, pushProposal, DIPLO,
    chooseEvent, applyFx, updateVisibility, visible, militaryPower, realmIncome, stabilityTarget, endTurn, score, checkEnd, finalScore,
    idleUnits, citiesNeedingOrders, unionHolds, UNION_TURNS, BANDITS, hasPolicy, pathTurns, spawnCamp, clearCamp, banditTurn,
    improvementsFor, buildImprovement, districtAdjacency, validDistrictTile, districtSpots, tileCost, canBuyTile, buyTile,
    civicCost, civicAvailable, setCivic, policySlots, unlockedPolicies, setPolicies, autoPolicies, defOf, fortify, skipUnit, disband, stat, personality, rulerTitle, succession, makeCharacter, log, processRealm, updateDifficulty, techCost,
  };
})(typeof window !== 'undefined' ? window : globalThis);
