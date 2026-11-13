/* =========================================================================
 * AI-механика №1: NLP голосовых приказов.
 *  Input: текст от Web Speech API (или ручной ввод)
 *  Processing: нормализация → токенизация → маскирование сущностей →
 *    стемминг → униграммы+биграммы → нечёткое сопоставление (Левенштейн)
 *    → мультиномиальный наивный Байес (сглаживание Лидстоуна)
 *  Entities: держава, направление, юнит/постройка, технология, город, число
 *  Output: { intent, confidence, target, dir, item, tech, city, amount }
 * ========================================================================= */
(function (root) {
  const RF = (root.RF = root.RF || {});

  const TRAINING = {
    end_turn: ['следующий ход', 'закончить ход', 'конец хода', 'завершить ход', 'ход окончен', 'передать ход', 'дальше', 'заканчиваю ход', 'новый ход'],
    next_unit: ['следующий отряд', 'следующий юнит', 'следующая армия', 'другой отряд', 'выбрать отряд', 'покажи отряд', 'кто ждёт приказа'],
    found_city: ['основать город', 'построить город здесь', 'заложить город', 'основать поселение', 'город здесь', 'поселиться здесь', 'основывай город'],
    fortify: ['укрепиться', 'занять оборону', 'окопаться', 'держать оборону', 'стоять на месте и защищаться', 'укрепи отряд', 'оборона'],
    skip: ['пропустить', 'ждать', 'пропусти отряд', 'отряд ждёт', 'пусть стоит', 'ожидать'],
    move: ['идти на восток', 'двигаться на запад', 'иди на северо восток', 'шагать на юго запад', 'двигай отряд на север', 'вперёд на юг', 'переместить на восток', 'марш на запад', 'отряд на северо запад', 'идти'],
    attack: ['атаковать', 'в атаку', 'атакуй врага', 'напасть на врага', 'ударить', 'атаковать на восток', 'бей их', 'в бой', 'штурмовать город', 'стрелять по врагу', 'обстрелять'],
    produce: ['построить амбар', 'строить стены', 'нанять лучников', 'производить мечников', 'обучить копейщиков', 'построй библиотеку', 'создать поселенцев', 'город строит рынок', 'производство храм', 'нанять всадников', 'тренировать рыцарей', 'возвести замок', 'построить катапульту', 'набрать ополчение', 'обучить арбалетчиков', 'построить мастерскую'],
    improve: ['построить ферму', 'строители построят шахту', 'сделать пастбище', 'улучшить клетку', 'возвести каменоломню', 'поставить лесопилку', 'улучшение клетки', 'строители работают здесь'],
    open_civics: ['институты', 'открыть институты', 'политики', 'покажи политики', 'социальные институты', 'культура и политики'],
    buy: ['купить', 'купить за золото', 'выкупить производство', 'ускорить за золото', 'заплатить золотом', 'купи'],
    research: ['изучить письменность', 'исследовать математику', 'изучать бронзовое литьё', 'наука феодализм', 'открыть технологию', 'исследование верховой езды', 'учёные изучают деньги', 'изучить рыцарство', 'исследуй земледелие', 'изучить философию'],
    declare_war: ['объявить войну', 'война с ордой', 'объявляю войну империи', 'начать войну', 'идём войной на республику', 'объявить войну ханше'],
    peace: ['заключить мир', 'предложить мир', 'мир с ордой', 'перемирие', 'прекратить войну', 'мирный договор'],
    alliance: ['предложить союз', 'заключить союз', 'союз с империей', 'альянс', 'военный союз', 'стать союзниками'],
    trade: ['торговый договор', 'предложить торговлю', 'открыть границы', 'торговое соглашение', 'торговать с республикой', 'договор о торговле'],
    marriage: ['предложить брак', 'династический брак', 'заключить брак', 'свадьба с наследником', 'выдать замуж', 'женить наследника', 'породниться'],
    gift: ['отправить дары', 'подарок', 'послать золото', 'подарить золото', 'отправить подарок', 'задобрить подарком'],
    tribute: ['потребовать дань', 'сделать вассалом', 'потребовать присяги', 'вассалитет', 'требую покорности', 'пусть станут вассалами'],
    open_tech: ['открыть науку', 'древо технологий', 'технологии', 'покажи науку', 'исследования'],
    open_diplomacy: ['открыть дипломатию', 'дипломатия', 'покажи державы', 'отношения с соседями', 'послы'],
    open_dynasty: ['династия', 'мой правитель', 'покажи наследника', 'открыть династию', 'персонаж правителя', 'двор'],
    status: ['доклад', 'статус', 'отчёт', 'сколько золота', 'как дела в королевстве', 'обстановка', 'доложи'],
    help: ['помощь', 'какие команды', 'что я могу сказать', 'подсказка', 'справка', 'список команд'],
    pause: ['пауза', 'меню', 'поставить на паузу', 'настройки', 'стоп игра'],
    accept: ['принять', 'да', 'согласен', 'принимаю', 'хорошо', 'одобряю', 'конечно'],
    decline: ['отклонить', 'нет', 'отказать', 'не согласен', 'отказываюсь', 'никогда', 'отклоняю'],
    select_city: ['выбрать город', 'открыть город', 'покажи город', 'перейти к столице', 'столица', 'город'],
  };

  const STOP = new Set(['и', 'в', 'во', 'на', 'с', 'со', 'к', 'ко', 'у', 'о', 'об', 'по', 'для', 'за', 'из', 'от', 'до', 'пожалуйста', 'мне', 'нам', 'давай', 'давайте', 'ну', 'же', 'бы', 'ли', 'это', 'этот', 'эй', 'слушай', 'ваше', 'величество', 'а', 'то', 'там', 'тут', 'надо', 'нужно', 'хочу', 'мы', 'я', 'какие', 'какая', 'какой', 'еще', 'ещё', 'наш', 'наши', 'нашего', 'мой', 'моего', 'этим', 'этом', 'сейчас', 'теперь']);
  const ENDINGS = ['ями', 'ами', 'ого', 'его', 'ому', 'ему', 'ыми', 'ими', 'ией', 'ать', 'ять', 'ить', 'еть', 'ешь', 'ете', 'ует', 'уют', 'ях', 'ах', 'ов', 'ев', 'ей', 'ой', 'ий', 'ый', 'ая', 'яя', 'ое', 'ее', 'ые', 'ие', 'ую', 'юю', 'ом', 'ем', 'ам', 'ям', 'ии', 'ия', 'ть', 'ет', 'ит', 'ут', 'ют', 'ат', 'ят', 'ла', 'ло', 'ли', 'а', 'я', 'о', 'е', 'и', 'ы', 'у', 'ю', 'ь', 'й'];
  const NUMBERS = { один: 1, два: 2, три: 3, пять: 5, десять: 10, двадцать: 20, тридцать: 30, пятьдесят: 50, сто: 100, двести: 200 };

  const DIR_WORDS = [
    { dir: 1, re: /северо[\s-]?восток/ }, { dir: 2, re: /северо[\s-]?запад/ }, { dir: 5, re: /юго[\s-]?восток/ }, { dir: 4, re: /юго[\s-]?запад/ },
    { dir: 0, re: /восток|вправо|направо/ }, { dir: 3, re: /запад|влево|налево/ }, { dir: 1, re: /север|вверх/ }, { dir: 5, re: /юг|вниз/ },
  ];
  const DIR_STEMS = ['север', 'восток', 'запад', 'юг', 'северо', 'юго', 'вверх', 'вниз', 'влев', 'вправ', 'налев', 'направ'];

  let ENTITY_STEMS = [];
  const normalize = (t) => String(t || '').toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9\s-]/g, ' ').replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
  function stem(w) {
    if (w.length <= 3 || /^\d+$/.test(w)) return w;
    for (const e of ENDINGS) if (w.endsWith(e) && w.length - e.length >= 3) return w.slice(0, -e.length);
    return w;
  }
  const isEntity = (w) => DIR_STEMS.some((d) => w.startsWith(d)) || ENTITY_STEMS.some((e) => w === e || (e.length >= 4 && w.startsWith(e)));
  function features(text) {
    const toks = normalize(text).split(' ').filter((w) => w && !STOP.has(w) && NUMBERS[w] === undefined && !/^\d+$/.test(w)).map(stem).filter((w) => !isEntity(w));
    const f = toks.slice();
    for (let i = 0; i < toks.length - 1; i++) f.push(toks[i] + '_' + toks[i + 1]);
    return f;
  }
  function levenshtein(a, b) {
    if (a === b) return 0;
    let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[b.length];
  }

  const ALPHA = 0.1;
  function train(corpus) {
    const model = { classes: {}, vocab: new Set(), total: 0 };
    for (const [intent, phrases] of Object.entries(corpus)) {
      const c = (model.classes[intent] = { docs: 0, words: {}, count: 0 });
      for (const p of phrases) { c.docs++; model.total++; for (const f of features(p)) { c.words[f] = (c.words[f] || 0) + 1; c.count++; model.vocab.add(f); } }
    }
    return model;
  }
  function fuzzy(f, vocab) {
    if (vocab.has(f) || f.includes('_') || f.length < 4) return f;
    let best = f, bd = 2;
    for (const v of vocab) { if (v.includes('_') || Math.abs(v.length - f.length) > 1) continue; const d = levenshtein(f, v); if (d < bd) { bd = d; best = v; } }
    return best;
  }

  // Сущности для маскирования: ключи держав (из данных)
  function initEntities() {
    const D = RF.Data;
    if (!D) return;
    ENTITY_STEMS = Object.values(D.REALMS).flatMap((r) => r.keys).concat(['государств', 'сосед', 'королевств']);
  }
  initEntities();
  let MODEL = train(TRAINING);

  function classify(text, model) {
    model = model || MODEL;
    const feats = features(text).map((f) => fuzzy(f, model.vocab));
    const known = feats.filter((f) => model.vocab.has(f));
    const V = model.vocab.size;
    const scores = {};
    for (const [intent, c] of Object.entries(model.classes)) {
      let lp = Math.log(c.docs / model.total);
      for (const f of known) lp += Math.log(((c.words[f] || 0) + ALPHA) / (c.count + ALPHA * V));
      scores[intent] = lp;
    }
    const max = Math.max(...Object.values(scores));
    let sum = 0; const probs = {};
    for (const k in scores) { probs[k] = Math.exp(scores[k] - max); sum += probs[k]; }
    for (const k in probs) probs[k] /= sum;
    const ranked = Object.entries(probs).sort((a, b) => b[1] - a[1]);
    const uni = feats.filter((f) => !f.includes('_'));
    const coverage = uni.length ? uni.filter((f) => model.vocab.has(f)).length / uni.length : 0;
    if (!known.length || coverage < 0.5) return { intent: 'unknown', confidence: 0, ranked, coverage };
    return { intent: ranked[0][1] < 0.25 ? 'unknown' : ranked[0][0], confidence: ranked[0][1], ranked, coverage };
  }

  function matchKeys(text, list) {
    // list: [{id, keys:[...]}] → id с лучшим совпадением основы
    const toks = normalize(text).split(' ').filter(Boolean);
    let best = null, bs = 0;
    for (const item of list) for (const kw of item.keys) for (const t of toks) {
      const st = stem(t);
      let sc = 0;
      if (t.startsWith(kw) || st === kw) sc = 2 + kw.length / 10;
      else if (kw.length >= 5 && levenshtein(st.slice(0, kw.length), kw) <= 1) sc = 1;
      if (sc > bs) { bs = sc; best = item.id; }
    }
    return best;
  }

  function extractDir(text) { const n = normalize(text); for (const d of DIR_WORDS) if (d.re.test(n)) return d.dir; return null; }
  function extractAmount(text) {
    const n = normalize(text); const m = n.match(/\b(\d{1,4})\b/); if (m) return +m[1];
    let t = 0, f = false; for (const w of n.split(' ')) if (NUMBERS[w] !== undefined) { t += NUMBERS[w]; f = true; } return f ? t : null;
  }

  /** ctx: { realms:[{id,keys}], items:[{id,kind,keys}], techs:[{id,keys}], cities:[{id,name}] } */
  function parse(text, ctx) {
    ctx = ctx || {};
    const cls = classify(text);
    const out = { text, intent: cls.intent, confidence: cls.confidence, ranked: cls.ranked.slice(0, 3) };
    out.target = matchKeys(text, ctx.realms || []);
    out.dir = extractDir(text);
    // приоритет сущностей: улучшение → квартал → постройка → отряд («строители, постройте ферму» — это ферма)
    let itemId = null;
    for (const kind of ['improvement', 'district', 'building', 'unit']) {
      itemId = matchKeys(text, (ctx.items || []).filter((i) => i.kind === kind).map((i) => ({ id: i.kind + ':' + i.id, keys: i.keys })));
      if (itemId) break;
    }
    out.item = itemId ? { kind: itemId.split(':')[0], id: itemId.split(':')[1] } : null;
    out.tech = matchKeys(text, ctx.techs || []);
    out.city = matchKeys(text, (ctx.cities || []).map((c) => ({ id: c.id, keys: [stem(normalize(c.name).split(' ')[0]).slice(0, 6)] })));
    out.amount = extractAmount(text);
    // Контекстные исправления: технология без глагола → research, юнит/постройка → produce
    if (out.item && out.intent === 'found_city' && (out.item.kind === 'district' || out.item.kind === 'building')) out.intent = 'produce';
    if (out.item && (out.intent === 'produce' || out.intent === 'improve')) out.intent = out.item.kind === 'improvement' ? 'improve' : 'produce';
    if (out.intent === 'unknown' && out.tech) { out.intent = 'research'; out.confidence = 0.5; }
    else if (out.intent === 'unknown' && out.item) { out.intent = 'produce'; out.confidence = 0.5; }
    else if (out.intent === 'unknown' && out.dir !== null) { out.intent = 'move'; out.confidence = 0.5; }
    return out;
  }

  const INTENT_NAMES = {
    end_turn: 'Следующий ход', next_unit: 'Следующий отряд', found_city: 'Основать город', fortify: 'Укрепиться', skip: 'Пропустить', move: 'Движение',
    attack: 'Атака', produce: 'Производство', buy: 'Купить', research: 'Исследование', declare_war: 'Объявить войну', peace: 'Мир', alliance: 'Союз',
    trade: 'Торговый договор', marriage: 'Брак', gift: 'Дары', tribute: 'Вассалитет', open_tech: 'Технологии', open_diplomacy: 'Дипломатия',
    open_dynasty: 'Династия', improve: 'Улучшение клетки', open_civics: 'Институты', status: 'Доклад', help: 'Помощь', pause: 'Пауза', accept: 'Принять', decline: 'Отклонить', select_city: 'Город', unknown: 'Не распознано',
  };

  RF.NLP = {
    TRAINING, normalize, stem, features, levenshtein, train, classify, parse, extractDir, extractAmount, matchKeys, INTENT_NAMES,
    retrain() { initEntities(); MODEL = train(TRAINING); return MODEL; },
    get model() { return MODEL; },
  };
})(typeof window !== 'undefined' ? window : globalThis);
