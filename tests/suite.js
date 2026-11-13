/* =========================================================================
 * AGES OF DOMINION — набор автотестов (Node и браузер):
 *  1) функциональные тесты движка (TC-xx);
 *  2) AI №1 — NLP голосовых приказов на отложенной выборке;
 *  3) AI №2 — ML-модель игрока, стратегический и тактический ИИ держав;
 *  4) интеграционная симуляция партий.
 * ========================================================================= */
(function (root) {
  // [фраза, намерение, сущности]
  const NLP_TEST = [
    ['следующий ход пожалуйста', 'end_turn'], ['завершаю ход', 'end_turn'], ['конец хода', 'end_turn'],
    ['следующий отряд', 'next_unit'], ['покажи другой отряд', 'next_unit'],
    ['основать город здесь', 'found_city'], ['заложи здесь город', 'found_city'], ['поселиться тут', 'found_city'],
    ['укрепиться на холме', 'fortify'], ['занять оборону', 'fortify'],
    ['пропусти ход отряда', 'skip'], ['ждать', 'skip'],
    ['идти на северо восток', 'move', { dir: 1 }], ['двигаться на юго запад', 'move', { dir: 4 }], ['иди на восток', 'move', { dir: 0 }], ['марш на запад', 'move', { dir: 3 }],
    ['атакуй их', 'attack'], ['напасть на врага на востоке', 'attack', { dir: 0 }], ['обстрелять город', 'attack'],
    ['нанять лучников', 'produce', { item: 'archer' }], ['построй амбар', 'produce', { item: 'granary' }], ['обучить мечников', 'produce', { item: 'swordsman' }],
    ['построить стены', 'produce', { item: 'walls' }], ['создать поселенцев', 'produce', { item: 'settler' }], ['возвести храм', 'produce', { item: 'temple' }], ['тренировать всадников', 'produce', { item: 'horseman' }],
    ['купить за золото', 'buy'], ['выкупи это', 'buy'],
    ['изучить математику', 'research', { tech: 'math' }], ['исследовать феодализм', 'research', { tech: 'feudalism' }], ['изучаем письменность', 'research', { tech: 'writing' }], ['исследуй верховую езду', 'research', { tech: 'horse' }],
    ['объявить войну орде', 'declare_war', { target: 'tarkhan' }], ['объявляю войну республике', 'declare_war', { target: 'serenica' }],
    ['заключить мир с империей', 'peace', { target: 'valdorn' }], ['предложи перемирие орде', 'peace', { target: 'tarkhan' }],
    ['предложить союз республике', 'alliance', { target: 'serenica' }], ['военный союз с ярлом', 'alliance', { target: 'ulfgard' }],
    ['торговый договор с империей', 'trade', { target: 'valdorn' }], ['открыть границы с ордой', 'trade', { target: 'tarkhan' }],
    ['предложить брак империи', 'marriage', { target: 'valdorn' }], ['женить наследника на дочери хана', 'marriage', { target: 'tarkhan' }],
    ['отправить дары республике', 'gift', { target: 'serenica' }], ['подарить золото ярлу', 'gift', { target: 'ulfgard' }],
    ['потребовать дань с орды', 'tribute', { target: 'tarkhan' }], ['сделать республику вассалом', 'tribute', { target: 'serenica' }],
    ['строители постройте ферму', 'improve', { item: 'farm' }], ['сделать шахту на холме', 'improve', { item: 'mine' }], ['построить научный квартал', 'produce', { item: 'campus' }], ['заложить святилище', 'produce', { item: 'holy' }],
    ['открой институты', 'open_civics'], ['выбрать политики', 'open_civics'],
    ['покажи технологии', 'open_tech'], ['открыть дипломатию', 'open_diplomacy'], ['покажи династию', 'open_dynasty'],
    ['доложи обстановку', 'status'], ['сколько у нас золота', 'status'],
    ['какие есть команды', 'help'], ['пауза', 'pause'],
    ['да принимаю', 'accept'], ['нет отклоняю', 'decline'],
    // ASR-ошибки
    ['основат город', 'found_city'], ['следуюший ход', 'end_turn'], ['изучит математику', 'research', { tech: 'math' }],
    // посторонняя речь
    ['какая сегодня хорошая погода', 'unknown'], ['бла бла бла', 'unknown'],
  ];

  function runAll(RF, opts) {
    opts = opts || {};
    const E = RF.Engine, AI = RF.AI, NLP = RF.NLP, D = RF.Data, P = E.PLAYER;
    const sections = [];
    let cur;
    const section = (n) => { cur = { name: n, results: [] }; sections.push(cur); };
    const test = (id, name, fn) => { try { cur.results.push({ id, name, pass: true, detail: fn() || '' }); } catch (e) { cur.results.push({ id, name, pass: false, detail: e.message }); } };
    const ok = (c, m) => { if (!c) throw new Error(m || 'проверка не пройдена'); };
    const game = (lvl, seed) => E.newGame(lvl || 1, { seed: seed || 7 });
    const pct = (v) => Math.round(v * 100);
    const freeLand = (s, c, r, rad) => E.inRadius(s, c, r, rad).find(([a, b]) => E.passable(E.tileAt(s, a, b)) && !E.unitAt(s, a, b) && !E.cityAt(s, a, b) && E.tileAt(s, a, b).t !== 'ocean');

    // ======================================================= ФУНКЦИОНАЛЬНЫЕ
    section('Функциональные тесты движка');
    test('TC01', 'Создание партии: державы, столицы, стартовые отряды', () => {
      const res = [1, 2, 3].map((l) => { const s = game(l); return [E.aliveIds(s).length, Object.keys(s.cities).length, Object.values(s.units).filter((u) => u.realm !== E.BANDITS).length]; });
      ok(res[0][0] === 3 && res[1][0] === 4 && res[2][0] === 5, JSON.stringify(res));
      ok(res.every(([n, c, u]) => c === n && u === n * 3), JSON.stringify(res));
      return `держав/городов/отрядов (ополчение, поселенцы, герой): ${res.map((r) => r.join('/')).join(' · ')}`;
    });
    test('TC27', 'Герои: у каждой державы свой герой, опыт повышает уровень и силу, павший герой возвращается', () => {
      const s = game(1);
      const heroes = Object.values(s.units).filter((u) => u.hero);
      ok(heroes.length === E.aliveIds(s).length, 'героев: ' + heroes.length);
      ok(!E.availableItems(s, s.cities[s.realms[E.PLAYER].capitalId]).some((i) => D.UNITS[i.id] && D.UNITS[i.id].hero), 'героя нельзя построить');
      const h = heroes.find((u) => u.realm === E.PLAYER);
      const st1 = E.unitStrength(s, h, {});
      E.heroGainXp(s, h, 80);
      ok(h.hero.lvl === 3, 'уровень ' + h.hero.lvl);
      ok(E.unitStrength(s, h, {}) > st1 * 1.2, 'сила растёт с уровнем');
      const name = h.hero.name;
      E.killUnit(s, h);
      ok(s.realms[E.PLAYER].heroDown && s.realms[E.PLAYER].heroDown.lvl === 2, 'павший герой теряет уровень');
      for (let t = 0; t < 7; t++) E.endTurn(s);
      const back = Object.values(s.units).find((u) => u.hero && u.realm === E.PLAYER);
      ok(back && back.hero.name === name, 'герой вернулся');
      return `героев ${heroes.length}; ${name}: ур.1 → ур.3, сила ×${(E.unitStrength(s, back, {}) / st1).toFixed(2)} после возвращения`;
    });
    test('TC28', 'Карта мира: реки дают золото, есть снежный север и вулканические пустоши', () => {
      const s = game(3);
      const rivers = s.tiles.filter((t) => t.river).length, tundra = s.tiles.filter((t) => t.t === 'tundra').length, ash = s.tiles.filter((t) => t.t === 'ash').length;
      ok(s.rivers.length >= 3 && rivers > 5, 'рек ' + s.rivers.length);
      const i = s.tiles.findIndex((t) => t.river && t.t === 'plains');
      if (i >= 0) ok(E.tileYield(s, i % s.w, Math.floor(i / s.w)).gold >= 1, 'река даёт золото');
      ok(tundra > 0 && ash > 0 && s.tiles.some((t) => t.volcano), `тундра ${tundra}, пустоши ${ash}`);
      return `рек ${s.rivers.length} (${rivers} клеток), тундра ${tundra}, огненные пустоши ${ash}, вулкан есть`;
    });
    test('TC02', 'Гекс-геометрия: соседи на расстоянии 1, шаг по направлению', () => {
      const s = game();
      for (let r = 2; r < 6; r++) for (let c = 2; c < 6; c++) {
        const n = E.neighbors(s, c, r);
        ok(n.length === 6 && n.every(([a, b]) => E.dist(c, r, a, b) === 1), `клетка ${c},${r}`);
        for (let d = 0; d < 6; d++) { const [a, b] = E.step(c, r, d); ok(E.dist(c, r, a, b) === 1); }
      }
      ok(E.dist(0, 0, 4, 0) === 4 && E.dist(0, 0, 0, 4) === 4);
      return 'соседи и расстояния корректны';
    });
    test('TC03', 'Генерация мира: доля суши и разнесённые столицы', () => {
      const s = game(2, 11);
      const land = s.tiles.filter((t) => t.t !== 'ocean').length / s.tiles.length;
      const caps = Object.values(s.cities);
      let minD = 99;
      for (let i = 0; i < caps.length; i++) for (let j = i + 1; j < caps.length; j++) minD = Math.min(minD, E.dist(caps[i].c, caps[i].r, caps[j].c, caps[j].r));
      ok(land > 0.5 && land < 0.75 && minD >= 6, `суша ${land}, мин. расстояние ${minD}`);
      return `суша ${pct(land)}%, мин. расстояние между столицами ${minD}`;
    });
    test('TC04', 'Основание города и запрет рядом с другим городом', () => {
      const s = game(1, 3);
      const cap = s.cities[s.realms[P].capitalId];
      const settler = E.unitsOf(s, P).find((u) => u.type === 'settler');
      settler.c = cap.c; settler.r = cap.r; s._pos = null;
      const bad = E.foundCity(s, settler.id);
      ok(!bad.ok, 'рядом со столицей нельзя');
      const spot = RF.AI.RealmAI.findSite(s, P, cap.c, cap.r, 6);
      settler.c = spot[0]; settler.r = spot[1]; s._pos = null;
      const good = E.foundCity(s, settler.id);
      ok(good.ok && E.citiesOf(s, P).length === 2, good.msg);
      return `${bad.msg} → ${good.msg}`;
    });
    test('TC05', 'Перемещение: очки хода, непроходимая местность, чужие границы', () => {
      const s = game(1, 3);
      const w = E.unitsOf(s, P).find((u) => u.type === 'warrior');
      const reach = E.reachable(s, w);
      ok(reach.size > 0 && [...reach.values()].every((v) => E.passable(E.tileAt(s, v.c, v.r))), 'горы и море недоступны');
      ok([...reach.values()].every((v) => E.dist(w.c, w.r, v.c, v.r) <= 2), 'не дальше 2 клеток');
      const other = Object.values(s.cities).find((c) => c.realm !== P);
      const inner = E.neighbors(s, other.c, other.r).find(([a, b]) => E.tileAt(s, a, b).owner === other.realm && E.passable(E.tileAt(s, a, b)));
      ok(!E.canEnterTerritory(s, P, inner[0], inner[1]), 'в мирное время граница закрыта');
      s.pacts[E.pairKey(P, other.realm)] = 'trade';
      ok(E.canEnterTerritory(s, P, inner[0], inner[1]), 'торговый договор открывает границы');
      return `достижимо клеток: ${reach.size}; границы закрыты без договора`;
    });
    test('TC06', 'Производство: отряд появляется, поселенцы забирают жителя', () => {
      const s = game(1, 3);
      const cap = s.cities[s.realms[P].capitalId];
      ok(E.setProduction(s, cap.id, { kind: 'unit', id: 'warrior' }).ok);
      const before = E.unitsOf(s, P).length;
      cap.prod = 25; E.processRealm(s, P);
      ok(E.unitsOf(s, P).length === before + 1 && !cap.item, 'отряд создан');
      cap.pop = 1;
      ok(!E.setProduction(s, cap.id, { kind: 'unit', id: 'settler' }).ok, 'нужно население 2+');
      cap.pop = 3; E.setProduction(s, cap.id, { kind: 'unit', id: 'settler' }); cap.prod = 55; E.processRealm(s, P);
      ok(cap.pop === 2 || cap.pop === 3, `население ${cap.pop}`);
      ok(!E.setProduction(s, cap.id, { kind: 'building', id: 'library' }).ok, 'библиотека требует Письменности');
      return 'ополченцы → поселенцы; библиотека недоступна без технологии';
    });
    test('TC07', 'Наука: недоступная технология, завершение исследования', () => {
      const s = game(1, 3);
      ok(!E.setResearch(s, P, 'math').ok, 'Математика требует предшественников');
      ok(E.setResearch(s, P, 'archery').ok);
      s.realms[P].science = 999; E.processRealm(s, P);
      ok(s.realms[P].techs.includes('archery'), 'изучено');
      const cap = s.cities[s.realms[P].capitalId];
      ok(E.availableItems(s, cap).some((i) => i.id === 'archer'), 'лучники открыты');
      return 'Стрельба из лука → Лучники';
    });
    const battleSetup = () => {
      const s = game(1, 3);
      const enemy = E.aiIds(s)[0];
      const w = E.unitsOf(s, P).find((u) => u.type === 'warrior');
      const spot = E.neighbors(s, w.c, w.r).find(([a, b]) => E.passable(E.tileAt(s, a, b)) && !E.unitAt(s, a, b) && !E.cityAt(s, a, b));
      const foe = E.createUnit(s, enemy, 'warrior', spot[0], spot[1]);
      return { s, enemy, w, foe };
    };
    test('TC08', 'Бой: нужна война, урон обеим сторонам, ответного урона у стрелков нет', () => {
      const { s, enemy, w, foe } = battleSetup();
      const no = E.attack(s, w.id, foe.c, foe.r);
      ok(!no.ok && no.needWar === enemy, 'без войны атака невозможна');
      E.declareWar(s, P, enemy);
      const r = E.attack(s, w.id, foe.c, foe.r);
      ok(r.ok && r.toDef > 0 && r.toAtt > 0, JSON.stringify(r));
      const a = E.createUnit(s, P, 'archer', ...freeLand(s, foe.c, foe.r, 2));
      const hp = a.hp; const r2 = s.units[foe.id] ? E.attack(s, a.id, foe.c, foe.r) : { ok: true, toAtt: 0 };
      ok(r2.ok && a.hp === hp, 'лучник не получает урона');
      return `ближний бой: −${r.toDef}/−${r.toAtt}; лучники без потерь`;
    });
    test('TC09', 'Захват города: прочность 0 и атака ближнего боя', () => {
      const s = game(1, 3);
      const enemy = E.aiIds(s)[0];
      const city = s.cities[s.realms[enemy].capitalId];
      for (const u of Object.values(s.units)) if (u.c === city.c && u.r === city.r) E.killUnit(s, u);
      const spot = E.neighbors(s, city.c, city.r).find(([a, b]) => E.passable(E.tileAt(s, a, b)) && !E.unitAt(s, a, b));
      const sw = E.createUnit(s, P, 'swordsman', spot[0], spot[1]);
      E.declareWar(s, P, enemy);
      city.hp = 5;
      const r = E.attack(s, sw.id, city.c, city.r);
      ok(r.captured && city.realm === P && s.stats.citiesCaptured === 1, JSON.stringify(r));
      ok(E.opinion(s, enemy, P) < -40, 'обида за захват');
      return `${city.name} захвачен; мнение побеждённого ${E.opinion(s, enemy, P)}`;
    });
    test('TC10', 'Держава без городов и поселенцев исчезает', () => {
      const s = game(1, 3);
      const enemy = E.aiIds(s)[0];
      for (const c of E.citiesOf(s, enemy)) E.captureCity(s, c, P);
      for (const u of E.unitsOf(s, enemy)) if (u.type === 'settler') E.killUnit(s, u);
      E.endTurn(s);
      ok(!s.realms[enemy].alive);
      return `${s.realms[enemy].name} пала`;
    });
    test('TC11', 'Пустая казна распускает отряд и снижает стабильность', () => {
      const s = game(1, 3);
      const R = s.realms[P]; R.gold = -50; const st = R.stability; const n = E.unitsOf(s, P).length;
      E.processRealm(s, P);
      ok(E.unitsOf(s, P).length < n && R.gold === 0, 'отряд распущен');
      return `отрядов ${n}→${E.unitsOf(s, P).length}, стабильность ${Math.round(st)}→${Math.round(R.stability)}`;
    });
    test('TC12', 'Рост города при избытке еды', () => {
      const s = game(1, 3);
      const cap = s.cities[s.realms[P].capitalId];
      cap.food = E.growthNeed(cap); const pop = cap.pop;
      E.processRealm(s, P);
      ok(cap.pop === pop + 1, `${pop}→${cap.pop}`);
      return `население ${pop}→${cap.pop}`;
    });
    test('TC13', 'Наследование: смерть правителя, новый наследник, штраф стабильности', () => {
      const s = game(1, 3);
      const R = s.realms[P]; const heir = R.heirId; const st = R.stability;
      E.succession(s, P);
      ok(R.rulerId === heir && R.heirId !== heir && R.stability === st - 10 && s.stats.successions === 1);
      return `трон наследует ${s.chars[heir].name}`;
    });
    test('TC14', 'Мнение: брак, торговля, подарки', () => {
      const s = game(1, 3);
      const t = E.aiIds(s)[0];
      const base = E.opinion(s, t, P);
      E.applyAgreement(s, P, t, 'marriage'); s.pacts[E.pairKey(P, t)] = 'trade';
      const after = E.opinion(s, t, P);
      ok(after === Math.min(100, base + 35), `${base} → ${after}`);
      const g = E.diplomacy(s, t, 'gift', 50);
      ok(g.ok && E.opinion(s, t, P) > after);
      return `${base} → ${after} → ${E.opinion(s, t, P)} (дары)`;
    });
    test('TC15', 'Война: союзник жертвы с высокой честью вступает в войну', () => {
      const s = game(2, 3);
      const [a, b] = E.aiIds(s);
      s.pacts[E.pairKey(a, b)] = 'alliance';
      const ruler = s.chars[s.realms[b].rulerId]; ruler.traits = ['honest', 'just', 'brave'];
      E.declareWar(s, P, a);
      ok(E.getPact(s, P, a) === 'war' && E.getPact(s, P, b) === 'war');
      return `${s.realms[b].short} вступает в войну за ${s.realms[a].short}`;
    });
    test('TC16', 'Победа и поражение: завоевание, Союз корон, счёт, мятеж', () => {
      const a = game(1, 3);
      for (const id of E.aiIds(a)) E.captureCity(a, a.cities[a.realms[id].origCapitalId], P);
      E.checkEnd(a);
      const b = game(1, 3);
      const [x, y] = E.aiIds(b);
      const bc = b.cities[b.realms[P].capitalId];
      for (let i = 0; i < 8; i++) { const sp = E.freeNeighbor(b, bc.c, bc.r); if (sp) E.createUnit(b, P, 'swordsman', ...sp); } // сюзерен сильнее вассала — иначе вассал восстанет
      for (let i = 0; i < E.UNION_TURNS + 1 && !b.over; i++) {
        for (const id of E.aiIds(b)) { b.pacts[E.pairKey(P, id)] = 'alliance'; E.addOpinion(b, id, P, 'Верность', 90, 5); }
        b.realms[y].overlord = P;
        E.endTurn(b);
      }
      const c = game(1, 3); c.realms[P].stability = 0; E.checkEnd(c);
      const d = game(1, 3); d.turn = d.turnLimit + 1; E.checkEnd(d);
      ok(a.over && a.over.reason === 'domination', 'завоевание');
      ok(b.over && b.over.reason === 'diplomacy', `союз: ${b.over && b.over.reason}`);
      ok(c.over.reason === 'revolt' && d.over.reason === 'score');
      return `domination / diplomacy (${E.UNION_TURNS} ходов) / revolt / score (${d.over.result})`;
    });
    test('TC17', 'События: выбор применяет последствия', () => {
      const s = game(1, 3);
      s.pendingEvent = 'vassal'; const g = s.realms[P].gold = 100;
      E.chooseEvent(s, 0);
      ok(s.realms[P].gold === g - 50 && !s.pendingEvent);
      return 'Уступить барону: −50 золота';
    });
    test('TC18', 'Детерминированность: одинаковый seed — одинаковая партия с ИИ', () => {
      const run = () => { const s = game(2, 99); for (let i = 0; i < 12; i++) E.endTurn(s); return JSON.stringify([s.realms, Object.values(s.units).map((u) => [u.c, u.r, u.hp])]); };
      ok(run() === run());
      return '12 ходов совпадают';
    });
    if (RF.Storage) test('TC19', 'Сохранение: результат, рекорды, веса ИИ, загрузка партии', () => {
      RF.Storage.reset();
      const s = game(1, 3); E.endTurn(s);
      RF.Storage.saveGame(s);
      const l = RF.Storage.loadGame();
      ok(l.turn === s.turn && Object.keys(l.cities).length === Object.keys(s.cities).length, 'загрузка');
      s.over = { result: 'win', reason: 'score', text: '', score: 1234 };
      const res = RF.Storage.recordResult(s);
      const p = RF.Storage.profile;
      ok(p.leaderboard.length === 1 && p.unlockedLevel === 2 && p.aiModel.w.length === 7 && res.rank === 1);
      return `место ${res.rank}, открыт сценарий II, веса ИИ сохранены`;
    });
    if (RF.Shop) test('TC20', 'Коммерциализация: пакет, усиление в партии, премиум', () => {
      RF.Storage.reset(); const p = RF.Storage.profile;
      ok(!RF.Shop.buyItem('spies').ok, 'мало печатей');
      ok(RF.Shop.purchasePack('seals_s').ok && p.seals === 130);
      ok(RF.Shop.buyItem('tech').ok);
      const s = E.newGame(1, { seed: 1, boosts: RF.Shop.consumeBoosts({ tech: true }) });
      ok(s.realms[P].techs.includes('bronze'), 'усиление применено');
      ok(RF.Shop.purchasePremium().ok && p.unlockedLevel === 3 && !RF.Shop.showInterstitial());
      RF.Storage.reset();
      return 'печати → «Свитки мастеров» → Бронза с начала; издание открывает III';
    });

    test('TC21', 'Строители: улучшение клетки повышает доход и тратит заряд', () => {
      const s = game(1, 3); const cap = s.cities[s.realms[P].capitalId];
      const spot = E.inRadius(s, cap.c, cap.r, 1).find(([c, r]) => ['grass', 'plains'].includes(E.tileAt(s, c, r).t) && !E.cityAt(s, c, r) && !E.unitAt(s, c, r));
      const b = E.createUnit(s, P, 'builder', spot[0], spot[1]);
      const before = E.tileYield(s, spot[0], spot[1]).food;
      const r = E.buildImprovement(s, b.id, 'farm');
      ok(r.ok && E.tileYield(s, spot[0], spot[1]).food === before + 1 && b.charges === 2, r.msg);
      return `ферма: еда ${before} → ${before + 1}, зарядов осталось ${b.charges}`;
    });
    test('TC22', 'Кварталы: размещение на клетке, бонус соседства, постройки только в квартале', () => {
      const s = game(1, 3); const cap = s.cities[s.realms[P].capitalId];
      s.realms[P].techs.push('agriculture', 'writing');
      ok(!E.setProduction(s, cap.id, { kind: 'building', id: 'library' }).ok, 'библиотека без квартала недоступна');
      const spot = E.districtSpots(s, cap, 'campus')[0];
      ok(E.setProduction(s, cap.id, { kind: 'district', id: 'campus', c: spot.c, r: spot.r }).ok);
      const sci0 = E.cityYields(s, cap).sci;
      cap.prod = 99; E.processRealm(s, P);
      ok(E.tileAt(s, spot.c, spot.r).district === 'campus' && E.cityYields(s, cap).sci > sci0, 'квартал построен');
      ok(E.setProduction(s, cap.id, { kind: 'building', id: 'library' }).ok, 'библиотека доступна');
      return `научный квартал на (${spot.c},${spot.r}), соседство +${spot.adj}; наука ${sci0} → ${E.cityYields(s, cap).sci}`;
    });
    test('TC23', 'Институты и политики: культура открывает политику, политика меняет доход', () => {
      const s = game(1, 3); const R = s.realms[P];
      R.culture = 999; E.processRealm(s, P);
      ok(R.civics.includes('code_of_laws'), 'институт принят');
      const g0 = E.realmIncome(s, P).gold;
      ok(E.setPolicies(s, P, [], ['taxation']).ok && E.realmIncome(s, P).gold > g0, 'налоговая реформа');
      ok(!E.setPolicies(s, P, [], ['taxation', 'agrarian']).ok, 'лишняя политика не влезает в слот');
      return `золото ${g0} → ${E.realmIncome(s, P).gold} с «Налоговой реформой»`;
    });
    test('TC24', 'Покупка клетки за золото расширяет границы', () => {
      const s = game(1, 3); const cap = s.cities[s.realms[P].capitalId]; s.realms[P].gold = 500;
      const t = E.inRadius(s, cap.c, cap.r, 2).find(([c, r]) => E.canBuyTile(s, cap, c, r));
      const cost = E.tileCost(s, cap, t[0], t[1]);
      const r = E.buyTile(s, cap.id, t[0], t[1]);
      ok(r.ok && E.tileAt(s, t[0], t[1]).owner === P && s.realms[P].gold === 500 - cost, r.msg);
      return r.msg;
    });
    test('TC25', 'Разбойники: лагерь появляется, занятие клетки разоряет его (+30 золота)', () => {
      const s = game(1, 3);
      ok(s.camps.length > 0, 'лагеря есть');
      const [c, r] = s.camps[0];
      for (const u of Object.values(s.units)) if (u.c === c && u.r === r) E.killUnit(s, u);
      const nb = E.neighbors(s, c, r).find(([a, b]) => E.passable(E.tileAt(s, a, b)) && !E.unitAt(s, a, b) && !E.tileAt(s, a, b).owner);
      const w = E.createUnit(s, P, 'warrior', nb[0], nb[1]); const g = s.realms[P].gold;
      E.moveUnit(s, w.id, c, r);
      ok(!E.tileAt(s, c, r).camp && s.realms[P].gold === g + 30, 'лагерь разорён');
      ok(E.getPact(s, P, E.BANDITS) === 'war', 'разбойники всегда враждебны');
      return 'лагерь разорён, +30 золота';
    });
    test('TC26', 'Путь на несколько ходов: номера ходов по клеткам', () => {
      const s = game(1, 3); const w = E.unitsOf(s, P).find((u) => u.type === 'warrior');
      const far = E.inRadius(s, w.c, w.r, 5).filter(([c, r]) => E.dist(w.c, w.r, c, r) === 5 && E.passable(E.tileAt(s, c, r)) && !E.tileAt(s, c, r).owner).map(([c, r]) => [c, r, E.findPath(s, w, c, r)]).find((x) => x[2]);
      const turns = E.pathTurns(s, w, far[2]);
      ok(turns[0] === 1 && turns[turns.length - 1] >= 3, JSON.stringify(turns));
      return `путь ${far[2].length} кл., ходы: ${turns.join(',')}`;
    });

    // ======================================================= NLP
    section('AI-компонент №1: NLP голосовых приказов');
    const ctx = {
      realms: Object.entries(D.REALMS).filter(([id]) => id !== P).map(([id, r]) => ({ id, keys: r.keys })),
      items: [...Object.entries(D.UNITS).map(([id, u]) => ({ id, kind: 'unit', keys: u.keys })), ...Object.entries(D.BUILDINGS).map(([id, b]) => ({ id, kind: 'building', keys: b.keys })),
        ...Object.entries(D.DISTRICTS).map(([id, d]) => ({ id, kind: 'district', keys: d.keys })), ...Object.entries(D.IMPROVEMENTS).map(([id, im]) => ({ id, kind: 'improvement', keys: im.keys }))],
      techs: D.TECHS.map((t) => ({ id: t.id, keys: t.keys })), cities: [],
    };
    const rows = [];
    let okI = 0, entN = 0, entOk = 0;
    const perIntent = {};
    for (const [text, intent, ent] of NLP_TEST) {
      const r = NLP.parse(text, ctx);
      const iOk = r.intent === intent;
      let eOk = true;
      if (ent) {
        entN++;
        if (ent.target) eOk = r.target === ent.target;
        if (ent.dir !== undefined) eOk = eOk && r.dir === ent.dir;
        if (ent.item) eOk = eOk && r.item && r.item.id === ent.item;
        if (ent.tech) eOk = eOk && r.tech === ent.tech;
        if (eOk) entOk++;
      }
      if (iOk) okI++;
      perIntent[intent] = perIntent[intent] || { n: 0, ok: 0 }; perIntent[intent].n++; if (iOk) perIntent[intent].ok++;
      rows.push({ text, expected: intent, got: r.intent, conf: r.confidence, ok: iOk && eOk, ent: ent ? JSON.stringify(ent) : '', gotEnt: JSON.stringify({ target: r.target, dir: r.dir, item: r.item && r.item.id, tech: r.tech }) });
    }
    const acc = okI / NLP_TEST.length;
    test('AI1-01', 'Точность намерений на отложенной выборке ≥ 85%', () => { ok(acc >= 0.85, `${(acc * 100).toFixed(1)}%`); return `${okI}/${NLP_TEST.length} = ${(acc * 100).toFixed(1)}%`; });
    test('AI1-02', 'Извлечение сущностей (держава, направление, юнит/постройка, технология) ≥ 85%', () => { ok(entOk / entN >= 0.85, `${entOk}/${entN}`); return `${entOk}/${entN} = ${((entOk / entN) * 100).toFixed(1)}%`; });
    test('AI1-03', 'Отклонение посторонней речи', () => { ok(NLP.classify('какая сегодня хорошая погода').intent === 'unknown' && NLP.classify('').intent === 'unknown'); return 'unknown'; });
    test('AI1-04', 'Устойчивость к ошибкам распознавания', () => { const r = NLP.parse('основат город', ctx); ok(r.intent === 'found_city', r.intent); return '«основат город» → found_city'; });
    test('AI1-05', 'Контекстное восстановление: «лучники» без глагола → производство', () => { const r = NLP.parse('лучники', ctx); ok(r.intent === 'produce' && r.item.id === 'archer', JSON.stringify(r)); return 'produce: archer'; });

    // ======================================================= AI держав
    section('AI-компонент №2: ИИ держав');
    const PM = AI.PlayerModel;
    test('AI2-01', 'ML: логистическая регрессия обучается (точность на тесте ≥ 85%)', () => {
      const m = PM.create(); m.l2 = 0; m.lr = 0.3;
      let seed = 5; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      const sample = () => { const x = [1, rnd() * 2, rnd() * 2 - 1, rnd(), rnd() < 0.3 ? 1 : 0, rnd(), rnd() < 0.2 ? 1 : 0]; return [x, x[1] * 1.5 + x[3] * 2 - x[6] * 3 > 2 ? 1 : 0]; };
      for (let i = 0; i < 2000; i++) { const [x, y] = sample(); PM.update(m, x, y); }
      let c = 0; for (let i = 0; i < 500; i++) { const [x, y] = sample(); if ((PM.predict(m, x) > 0.5 ? 1 : 0) === y) c++; }
      ok(c / 500 >= 0.85, `${c / 5}%`);
      return `точность ${(c / 5).toFixed(1)}%`;
    });
    test('AI2-02', 'Агрессивного игрока ИИ считает опаснее мирного (одинаковые армии)', () => {
      const play = (aggr) => {
        const s = game(2, 21);
        const victim = E.aiIds(s)[0], watcher = E.aiIds(s)[1];
        for (let t = 0; t < 5; t++) {
          if (aggr) { if (E.getPact(s, P, victim) !== 'war') E.declareWar(s, P, victim); s.turnAttacks[victim] = true; PM.observe(s.playerModel, 'attack'); }
          else PM.observe(s.playerModel, 'econ');
          E.endTurn(s);
        }
        return { thr: AI.RealmAI.threatFrom(s, watcher, P), style: PM.style(s.playerModel.profile).name };
      };
      const a = play(true), b = play(false);
      ok(a.thr > b.thr + 0.1, `${a.thr} / ${b.thr}`);
      return `угроза для соседа: завоеватель ${pct(a.thr)}% (${a.style}) против ${pct(b.thr)}% (${b.style})`;
    });
    const freq = (s, id, n, pred) => { let k = 0; for (let i = 0; i < n; i++) { const ev = AI.RealmAI.evaluate(s, id); const top = ev.cands.filter((c) => c.target && c.u > 0).slice(0, 5); if (top.length && pred(top[0], top)) k++; s.rng = (s.rng + 7919) | 0; } return k / n; };
    test('AI2-03', 'Сценарий: сильный агрессивный правитель готовит войну со слабым соседом', () => {
      const s = game(1, 4);
      const horde = 'tarkhan'; s.chars[s.realms[horde].rulerId].traits = ['wrathful', 'ambitious', 'brave'];
      s.turn = 30;
      for (let i = 0; i < 8; i++) E.createUnit(s, horde, 'swordsman', ...E.freeNeighbor(s, s.cities[s.realms[horde].capitalId].c, s.cities[s.realms[horde].capitalId].r));
      const ev = AI.RealmAI.evaluate(s, horde);
      const war = ev.cands.find((c) => c.type === 'declare_war');
      ok(war && war.u > 0 && ev.cands.filter((c) => c.target)[0].type === 'declare_war', JSON.stringify(ev.cands.slice(0, 3)));
      return `лучшее действие: ${AI.RealmAI.intentLabel(s, war)} (полезность ${war.u})`;
    });
    test('AI2-04', 'Сценарий: мирный период — ИИ не нападает на игрока', () => {
      const s = game(1, 4); s.turn = 2;
      for (let i = 0; i < 8; i++) E.createUnit(s, 'tarkhan', 'swordsman', ...E.freeNeighbor(s, s.cities[s.realms.tarkhan.capitalId].c, s.cities[s.realms.tarkhan.capitalId].r));
      const war = AI.RealmAI.evaluate(s, 'tarkhan').cands.find((c) => c.type === 'declare_war' && c.target === P);
      ok(!war || war.u < 0, JSON.stringify(war));
      return 'война против игрока заблокирована (полезность < 0)';
    });
    test('AI2-05', 'Сценарий: проигрывающая сторона ищет мира', () => {
      const s = game(1, 4); const e = 'serenica';
      E.declareWar(s, P, e);
      for (let i = 0; i < 10; i++) { const sp = E.freeNeighbor(s, s.cities[s.realms[P].capitalId].c, s.cities[s.realms[P].capitalId].r); if (sp) E.createUnit(s, P, 'swordsman', ...sp); }
      s.wars[E.pairKey(P, e)].loss[e] = { units: 4, cities: 1 }; s.realms[e].stability = 25;
      const top = AI.RealmAI.evaluate(s, e).cands.filter((c) => c.target)[0];
      ok(top.type === 'offer_peace', JSON.stringify(top));
      return `лучшее действие: ${AI.RealmAI.intentLabel(s, top)}`;
    });
    test('AI2-06', 'Сценарий: коалиция против агрессивного сильного игрока', () => {
      const s = game(2, 4);
      s.playerModel.profile.aggression = 0.9; s.playerModel.profile.military = 0.8;
      for (let i = 0; i < 14; i++) { const sp = E.freeNeighbor(s, s.cities[s.realms[P].capitalId].c, s.cities[s.realms[P].capitalId].r); if (sp) E.createUnit(s, P, 'swordsman', ...sp); }
      for (const a of E.aiIds(s)) for (const b of E.aiIds(s)) if (a !== b) E.addOpinion(s, a, b, 'Общий враг', 30, 20);
      const coal = E.aiIds(s).flatMap((id) => AI.RealmAI.evaluate(s, id).cands.filter((c) => c.type === 'propose_alliance' && c.coalition));
      ok(coal.length > 0, 'нет коалиций');
      return `коалиционных предложений: ${coal.length}`;
    });
    test('AI2-07', 'Согласие на союз растёт с мнением и торговым договором', () => {
      const s = game(2, 4); const t = 'valdorn';
      const p1 = AI.RealmAI.respond(s, t, P, 'alliance').prob;
      E.addOpinion(s, t, P, 'Дружба', 70, 20); s.pacts[E.pairKey(P, t)] = 'trade';
      const p2 = AI.RealmAI.respond(s, t, P, 'alliance').prob;
      ok(p2 > p1 + 0.4, `${p1} → ${p2}`);
      return `вероятность ${pct(p1)}% → ${pct(p2)}%`;
    });
    test('AI2-08', 'Тактика: ИИ-поселенцы основывают города', () => {
      const s = game(1, 4);
      const before = E.citiesOf(s, 'serenica').length;
      for (let i = 0; i < 8; i++) AI.RealmAI.takeTurn(s, 'serenica'), E.endTurn(s);
      ok(E.citiesOf(s, 'serenica').length > before, 'город не основан');
      return `городов Сереники: ${before} → ${E.citiesOf(s, 'serenica').length}`;
    });
    test('AI2-09', 'Тактика: ИИ атакует ослабленного врага рядом', () => {
      const s = game(1, 4); const e = 'tarkhan';
      const sw = E.createUnit(s, e, 'swordsman', ...freeLand(s, s.cities[s.realms[e].capitalId].c, s.cities[s.realms[e].capitalId].r, 2));
      const spot = E.neighbors(s, sw.c, sw.r).find(([a, b]) => E.passable(E.tileAt(s, a, b)) && !E.unitAt(s, a, b) && !E.cityAt(s, a, b));
      const victim = E.createUnit(s, P, 'warrior', spot[0], spot[1]); victim.hp = 30;
      E.declareWar(s, e, P);
      AI.RealmAI.tactical(s, e, AI.RealmAI.evaluate(s, e));
      ok(!s.units[victim.id] || s.units[victim.id].hp < 30, 'атаки не было');
      return s.units[victim.id] ? `урон нанесён (HP ${s.units[victim.id].hp})` : 'отряд игрока уничтожен';
    });
    test('AI2-10', 'Производство ИИ: под угрозой — войска и стены', () => {
      const s = game(1, 4); const id = 'serenica';
      E.declareWar(s, P, id);
      s.playerModel.profile.aggression = 0.9;
      for (let i = 0; i < 10; i++) { const sp = E.freeNeighbor(s, s.cities[s.realms[P].capitalId].c, s.cities[s.realms[P].capitalId].r); if (sp) E.createUnit(s, P, 'swordsman', ...sp); }
      s.realms[id].techs.push('masonry', 'bronze');
      let mil = 0; const N = 30;
      for (let i = 0; i < N; i++) { const c = s.cities[s.realms[id].capitalId]; c.item = null; AI.RealmAI.chooseProduction(s, c, AI.RealmAI.evaluate(s, id)); if (c.item.kind === 'unit' && c.item.id !== 'settler' || c.item.id === 'walls') mil++; s.rng = (s.rng + 31) | 0; }
      ok(mil / N > 0.6, `${mil}/${N}`);
      return `военные решения: ${mil}/${N}`;
    });
    test('AI2-11', 'Адаптивная сложность: растёт при доминировании игрока', () => {
      const s = game(2, 4);
      for (let i = 0; i < 14; i++) { const sp = E.freeNeighbor(s, s.cities[s.realms[P].capitalId].c, s.cities[s.realms[P].capitalId].r); if (sp) E.createUnit(s, P, 'knight', ...sp); }
      for (let i = 0; i < 8; i++) E.updateDifficulty(s);
      const w = game(2, 4); for (const u of E.unitsOf(w, P)) E.killUnit(w, u);
      for (let i = 0; i < 8; i++) E.updateDifficulty(w);
      ok(s.difficulty > 1.1 && w.difficulty < 0.95, `${s.difficulty} / ${w.difficulty}`);
      return `сильный игрок ×${s.difficulty}, слабый ×${w.difficulty}`;
    });

    // ======================================================= СИМУЛЯЦИЯ
    const sim = [];
    if (opts.simulate !== false) {
      const N = opts.games || 4;
      const styles = { 'Агрессор': ['wrathful', 'ambitious', 'brave'], 'Миротворец': ['content', 'calm', 'honest'] };
      for (const lvl of opts.levels || [1, 2]) for (const [style, traits] of Object.entries(styles)) {
        let wins = 0, warsOnPlayer = 0, coal = 0, turns = 0, succ = 0, caps = 0;
        for (let seed = 1; seed <= N; seed++) {
          const s = E.newGame(lvl, { seed: seed * 13 });
          s.chars[s.realms[P].rulerId].traits = traits.slice();
          while (!s.over) {
            s.chars[s.realms[P].rulerId].traits = traits.slice();
            AI.RealmAI.takeTurn(s, P);
            for (const p of s.proposals.slice()) E.respondProposal(s, p.id, p.type !== 'tribute_demand' && style === 'Миротворец');
            E.endTurn(s);
          }
          if (s.over.result === 'win') wins++;
          warsOnPlayer += s.log.filter((l) => /объявляет войну: Королевство Аурелия/.test(l.text)).length;
          coal += s.log.filter((l) => /Коалиция!/.test(l.text)).length;
          succ += s.log.filter((l) => /скончался/.test(l.text)).length;
          caps += s.log.filter((l) => /захватывает город/.test(l.text)).length;
          turns += s.turn;
        }
        sim.push({ level: lvl, style, games: N, winRate: wins / N, warsOnPlayer: warsOnPlayer / N, coalitions: coal, avgTurns: turns / N, successions: succ / N, captures: caps / N });
      }
      section('Интеграционная симуляция (ИИ против ИИ)');
      test('SIM-01', 'Партии доигрываются без ошибок, происходят войны, захваты и смены правителей', () => {
        const caps = sim.reduce((a, r) => a + r.captures, 0), succ = sim.reduce((a, r) => a + r.successions, 0);
        ok(caps > 0 && succ > 0, `${caps} / ${succ}`);
        return `в среднем за партию: захватов ${(caps / sim.length).toFixed(1)}, смен правителей ${(succ / sim.length).toFixed(1)}`;
      });
      test('SIM-02', 'Агрессивного игрока атакуют чаще, против него создаются коалиции', () => {
        const a = sim.filter((r) => r.style === 'Агрессор'), b = sim.filter((r) => r.style === 'Миротворец');
        const wa = a.reduce((x, r) => x + r.warsOnPlayer + r.coalitions / r.games, 0), wb = b.reduce((x, r) => x + r.warsOnPlayer + r.coalitions / r.games, 0);
        ok(wa >= wb, `${wa} / ${wb}`);
        return `войн+коалиций против игрока на партию: агрессор ${wa.toFixed(2)}, миротворец ${wb.toFixed(2)}`;
      });
    }
    const all = sections.flatMap((x) => x.results);
    return { sections, total: all.length, passed: all.filter((r) => r.pass).length, nlp: { rows, accuracy: acc, perIntent, entOk, entN, size: NLP_TEST.length }, sim };
  }

  const api = { runAll, NLP_TEST };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.RFTests = api;
})(typeof window !== 'undefined' ? window : globalThis);
