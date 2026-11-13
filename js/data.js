/* =========================================================================
 * AGES OF DOMINION — игровые данные: местность, ресурсы, технологии, юниты,
 * постройки, черты правителей, державы, сценарии, события, достижения.
 * ========================================================================= */
(function (root) {
  const RF = (root.RF = root.RF || {});

  const TERRAIN = {
    ocean: { name: 'Море', food: 1, prod: 0, gold: 1, move: 99, def: 0, color: '#3d6e99' },
    grass: { name: 'Луга', food: 2, prod: 0, gold: 0, move: 1, def: 0, color: '#7ea54f' },
    plains: { name: 'Равнины', food: 1, prod: 1, gold: 0, move: 1, def: 0, color: '#b9ae62' },
    forest: { name: 'Лес', food: 1, prod: 2, gold: 0, move: 2, def: 25, color: '#4e7a3b' },
    hills: { name: 'Холмы', food: 0, prod: 2, gold: 0, move: 2, def: 25, color: '#a58c5c' },
    mountain: { name: 'Горы', food: 0, prod: 0, gold: 0, move: 99, def: 0, color: '#8b8681' },
    desert: { name: 'Пустыня', food: 0, prod: 1, gold: 1, move: 1, def: 0, color: '#dcc58c' },
    tundra: { name: 'Снежная тундра', food: 1, prod: 1, gold: 0, move: 1, def: 0, color: '#dfe6ea' },
    ash: { name: 'Огненные пустоши', food: 0, prod: 2, gold: 1, move: 2, def: 10, color: '#6e3a2c' },
  };

  const RESOURCES = {
    wheat: { name: 'Пшеница', food: 2, prod: 0, gold: 0, on: ['grass', 'plains'] },
    fish: { name: 'Рыба', food: 2, prod: 0, gold: 0, on: ['ocean'] },
    iron: { name: 'Железо', food: 0, prod: 2, gold: 0, on: ['hills', 'plains', 'ash'] },
    horses: { name: 'Лошади', food: 0, prod: 1, gold: 1, on: ['plains', 'grass', 'tundra'] },
    gold: { name: 'Золото', food: 0, prod: 0, gold: 3, on: ['hills', 'desert', 'ash'] },
    stone: { name: 'Камень', food: 0, prod: 1, gold: 1, on: ['hills', 'desert', 'plains', 'tundra'] },
  };

  const TECHS = [
    { id: 'agriculture', name: 'Земледелие', cost: 22, req: [], keys: ['земледел', 'сельск', 'агрикульт'] },
    { id: 'bronze', name: 'Бронзовое литьё', cost: 30, req: [], keys: ['бронз', 'лить'] },
    { id: 'archery', name: 'Стрельба из лука', cost: 30, req: [], keys: ['стрельб', 'лук'] },
    { id: 'masonry', name: 'Каменная кладка', cost: 38, req: ['agriculture'], keys: ['камен', 'кладк'] },
    { id: 'horse', name: 'Верховая езда', cost: 45, req: ['agriculture'], keys: ['верхов', 'езд'] },
    { id: 'writing', name: 'Письменность', cost: 50, req: ['agriculture'], keys: ['письмен'] },
    { id: 'currency', name: 'Деньги', cost: 52, req: ['bronze'], keys: ['деньг', 'монет'] },
    { id: 'mysticism', name: 'Мистицизм', cost: 55, req: ['writing'], keys: ['мистиц', 'религ'] },
    { id: 'iron', name: 'Обработка железа', cost: 70, req: ['bronze'], keys: ['железа', 'железо', 'обработк'] },
    { id: 'math', name: 'Математика', cost: 90, req: ['writing', 'masonry'], keys: ['математ'] },
    { id: 'feudalism', name: 'Феодализм', cost: 110, req: ['currency', 'iron'], keys: ['феодал'] },
    { id: 'engineering', name: 'Инженерия', cost: 135, req: ['math'], keys: ['инженер'] },
    { id: 'chivalry', name: 'Рыцарство', cost: 140, req: ['feudalism', 'horse'], keys: ['рыцарств'] },
    { id: 'philosophy', name: 'Философия', cost: 170, req: ['mysticism', 'math'], keys: ['философ'] },
  ];

  const UNITS = {
    settler: { name: 'Поселенцы', cost: 55, str: 0, rstr: 0, range: 0, mov: 2, cls: 'civil', req: null, keys: ['поселен', 'колонист'] },
    builder: { name: 'Строители', cost: 40, str: 0, rstr: 0, range: 0, mov: 2, cls: 'civil', req: null, charges: 3, keys: ['строител', 'рабоч'] },
    scout: { name: 'Разведчики', cost: 25, str: 4, rstr: 0, range: 0, mov: 3, cls: 'recon', req: null, keys: ['разведчик', 'развед'] },
    warrior: { name: 'Ополченцы', cost: 25, str: 8, rstr: 0, range: 0, mov: 2, cls: 'melee', req: null, keys: ['ополчен', 'воин'] },
    spearman: { name: 'Копейщики', cost: 40, str: 12, rstr: 0, range: 0, mov: 2, cls: 'melee', req: 'bronze', antiMounted: true, keys: ['копейщ', 'копь'] },
    archer: { name: 'Лучники', cost: 40, str: 5, rstr: 9, range: 2, mov: 2, cls: 'ranged', req: 'archery', keys: ['лучник'] },
    horseman: { name: 'Всадники', cost: 50, str: 12, rstr: 0, range: 0, mov: 4, cls: 'mounted', req: 'horse', keys: ['всадник', 'конниц', 'кавалер'] },
    swordsman: { name: 'Мечники', cost: 60, str: 17, rstr: 0, range: 0, mov: 2, cls: 'melee', req: 'iron', keys: ['мечник'] },
    catapult: { name: 'Катапульта', cost: 75, str: 5, rstr: 16, range: 2, mov: 1, cls: 'siege', req: 'math', keys: ['катапульт'] },
    crossbow: { name: 'Арбалетчики', cost: 75, str: 10, rstr: 16, range: 2, mov: 2, cls: 'ranged', req: 'engineering', keys: ['арбалет'] },
    knight: { name: 'Рыцари', cost: 90, str: 24, rstr: 0, range: 0, mov: 4, cls: 'mounted', req: 'chivalry', keys: ['рыцар', 'рыцари'] },
    // Герои: не производятся в городах, по одному на державу, растут в уровнях
    hero_paladin: { name: 'Паладин', cost: 0, str: 18, rstr: 0, range: 0, mov: 3, cls: 'hero', hero: true, req: null, keys: [], ability: 'Святой свет: в начале хода лечит себя и соседние отряды (+15 HP)' },
    hero_warlord: { name: 'Полководец', cost: 0, str: 17, rstr: 0, range: 0, mov: 3, cls: 'hero', hero: true, req: null, keys: [], ability: 'Боевой клич: соседние союзные отряды +20% к силе' },
    hero_ranger: { name: 'Следопыт', cost: 0, str: 10, rstr: 16, range: 2, mov: 4, cls: 'hero', hero: true, req: null, keys: [], ability: 'Меткий выстрел: дальний бой на 2 клетки, +1 к движению' },
    hero_berserker: { name: 'Берсерк', cost: 0, str: 20, rstr: 0, range: 0, mov: 3, cls: 'hero', hero: true, req: null, keys: [], ability: 'Ярость: +30% к силе в атаке, победа восстанавливает 25 HP' },
  };

  /** Герои держав: имя и класс. Уровень растёт за бои; павший герой возвращается в столицу через 6 ходов. */
  const HEROES = {
    aurelia: { type: 'hero_paladin', name: 'Сэр Гаэль Светозарный' },
    serenica: { type: 'hero_warlord', name: 'Кондотьер Вьола Ост' },
    tarkhan: { type: 'hero_ranger', name: 'Батур Кара-Беркут' },
    valdorn: { type: 'hero_warlord', name: 'Легат Сервий Корвин' },
    ulfgard: { type: 'hero_berserker', name: 'Хродгар Медвежья Шкура' },
  };
  const HERO_XP = [0, 30, 75, 135, 210]; // порог опыта для уровней 1..5

  const BUILDINGS = {
    granary: { name: 'Амбар', cost: 40, req: 'agriculture', food: 2, desc: '+2 еды', keys: ['амбар'] },
    workshop: { name: 'Мастерская', cost: 50, req: 'bronze', prod: 2, desc: '+2 производства', keys: ['мастерск'] },
    walls: { name: 'Стены', cost: 50, req: 'masonry', def: 6, hp: 100, desc: '+6 к обороне, +100 прочности', keys: ['стен'] },
    market: { name: 'Рынок', cost: 60, req: 'currency', district: 'commercial', gold: 3, goldPct: 25, desc: '+3 золота, +25% золота (в торговом квартале)', keys: ['рынок', 'рынк'] },
    library: { name: 'Библиотека', cost: 60, req: 'writing', district: 'campus', sci: 3, desc: '+3 науки (в научном квартале)', keys: ['библиотек'] },
    temple: { name: 'Храм', cost: 45, req: 'mysticism', district: 'holy', culture: 2, stability: 1, desc: '+2 культуры, +1 стабильности (в святилище)', keys: ['храм'] },
    barracks: { name: 'Казармы', cost: 45, req: 'bronze', district: 'encampment', desc: 'новые отряды — ветераны (+25% к силе)', keys: ['казарм'] },
    castle: { name: 'Замок', cost: 90, req: 'feudalism', def: 8, hp: 100, stability: 1, desc: '+8 к обороне, +100 прочности, +1 стабильности', keys: ['замок', 'замк'] },
  };

  /** Улучшения клеток, которые возводят строители. */
  const IMPROVEMENTS = {
    farm: { name: 'Ферма', food: 1, prod: 0, gold: 0, on: ['grass', 'plains'], res: ['wheat'], req: null, keys: ['ферм'] },
    mine: { name: 'Шахта', food: 0, prod: 1, gold: 1, on: ['hills'], res: ['iron', 'gold'], req: 'bronze', keys: ['шахт', 'рудник'] },
    pasture: { name: 'Пастбище', food: 1, prod: 1, gold: 0, on: [], res: ['horses'], req: 'horse', keys: ['пастбищ'] },
    quarry: { name: 'Каменоломня', food: 0, prod: 1, gold: 1, on: [], res: ['stone'], req: 'masonry', keys: ['каменолом'] },
    lumber: { name: 'Лесопилка', food: 0, prod: 1, gold: 1, on: ['forest'], res: [], req: 'math', keys: ['лесопил'] },
  };

  /** Кварталы: строятся на клетке карты, дают доход с бонусом соседства. */
  const DISTRICTS = {
    campus: { name: 'Научный квартал', cost: 55, req: 'writing', base: { sci: 2 }, adj: { mountain: 1, forest: 0.5, district: 0.5 }, yieldKey: 'sci', color: '#3f9fd0', keys: ['научн', 'кампус', 'университетск'] },
    commercial: { name: 'Торговый квартал', cost: 55, req: 'currency', base: { gold: 3 }, adj: { ocean: 1, district: 0.5 }, yieldKey: 'gold', color: '#e0b13a', keys: ['торгов квартал', 'торговый', 'базарн'] },
    holy: { name: 'Святилище', cost: 50, req: 'mysticism', base: { culture: 2 }, adj: { mountain: 1, forest: 0.5, district: 0.5 }, yieldKey: 'culture', color: '#a870d9', keys: ['святилищ', 'святын'] },
    encampment: { name: 'Военный лагерь', cost: 50, req: 'bronze', base: { prod: 1 }, adj: { hills: 0.5 }, yieldKey: 'prod', color: '#c0392b', keys: ['лагер', 'военн'] },
  };

  /** Институты (развиваются за культуру) и политики. */
  const CIVICS = [
    { id: 'code_of_laws', name: 'Свод законов', cost: 18, req: [], unlocks: ['discipline', 'taxation'] },
    { id: 'craftsmanship', name: 'Ремесло', cost: 30, req: ['code_of_laws'], unlocks: ['agrarian'] },
    { id: 'foreign_trade', name: 'Внешняя торговля', cost: 34, req: ['code_of_laws'], unlocks: ['guilds'] },
    { id: 'military_tradition', name: 'Воинская традиция', cost: 48, req: ['craftsmanship'], unlocks: ['conscription'] },
    { id: 'early_empire', name: 'Ранняя империя', cost: 52, req: ['foreign_trade'], unlocks: [], slot: 'economic' },
    { id: 'theology', name: 'Богословие', cost: 70, req: ['early_empire'], unlocks: ['divine_right'] },
    { id: 'recorded_history', name: 'Летопись', cost: 70, req: ['early_empire'], unlocks: ['patronage'], slot: 'military' },
    { id: 'feudal_oath', name: 'Вассальная клятва', cost: 100, req: ['military_tradition', 'theology'], unlocks: ['chivalry_code'] },
  ];
  const POLICIES = {
    discipline: { name: 'Дисциплина', slot: 'military', desc: '+25% к силе против разбойников' },
    conscription: { name: 'Воинская повинность', slot: 'military', desc: 'Содержание войск −2 золота' },
    chivalry_code: { name: 'Рыцарский кодекс', slot: 'military', desc: '+10% к силе всех отрядов' },
    taxation: { name: 'Налоговая реформа', slot: 'economic', desc: '+10% золота' },
    agrarian: { name: 'Земледельческая община', slot: 'economic', desc: '+1 еда в каждом городе' },
    guilds: { name: 'Торговые гильдии', slot: 'economic', desc: '+2 золота за каждый торговый договор' },
    divine_right: { name: 'Божественное право', slot: 'economic', desc: '+8 к целевой стабильности' },
    patronage: { name: 'Покровительство наук', slot: 'economic', desc: '+15% науки' },
  };

  /** Черты правителей (в духе династических стратегий). Влияют на ИИ, характеристики и мнения. */
  const TRAITS = {
    ambitious: { name: 'Честолюбивый', opp: 'content', fx: { aggression: 0.2, expansion: 0.25 } },
    content: { name: 'Довольный', opp: 'ambitious', fx: { aggression: -0.2, expansion: -0.15, stability: 1 } },
    brave: { name: 'Храбрый', opp: 'craven', fx: { mar: 2, caution: -0.2 } },
    craven: { name: 'Трусливый', opp: 'brave', fx: { mar: -2, caution: 0.3 } },
    greedy: { name: 'Жадный', opp: 'generous', fx: { greed: 0.3, stw: 1 } },
    generous: { name: 'Щедрый', opp: 'greedy', fx: { greed: -0.3, dip: 2 } },
    honest: { name: 'Честный', opp: 'deceitful', fx: { honor: 0.3, dip: 1 } },
    deceitful: { name: 'Лживый', opp: 'honest', fx: { honor: -0.3 } },
    wrathful: { name: 'Гневливый', opp: 'calm', fx: { aggression: 0.25 } },
    calm: { name: 'Спокойный', opp: 'wrathful', fx: { aggression: -0.1, caution: 0.1, lrn: 1 } },
    just: { name: 'Справедливый', opp: 'arbitrary', fx: { honor: 0.1, stability: 1 } },
    arbitrary: { name: 'Деспотичный', opp: 'just', fx: { aggression: 0.1, stability: -1 } },
    diligent: { name: 'Усердный', opp: 'lazy', fx: { dip: 1, mar: 1, stw: 1, lrn: 1 } },
    lazy: { name: 'Ленивый', opp: 'diligent', fx: { dip: -1, mar: -1, stw: -1, lrn: -1 } },
    scholar: { name: 'Учёный', opp: null, fx: { lrn: 3 } },
    strategist: { name: 'Стратег', opp: null, fx: { mar: 3, aggression: 0.05 } },
  };

  const STATS = { dip: 'Дипломатия', mar: 'Военное дело', stw: 'Управление', lrn: 'Учёность' };

  /** Державы. Названия, персонажи и города — оригинальные. */
  const REALMS = {
    aurelia: {
      name: 'Королевство Аурелия', short: 'Аурелия', adj: 'аурелийский', color: '#2f63b0', title: 'Король', titleF: 'Королева',
      dynasty: 'дом Сольвейн', male: ['Эдрик', 'Ален', 'Тибальд', 'Роланд', 'Матеус', 'Корвин'], female: ['Изольда', 'Марена', 'Элинор', 'Сибилла'],
      traits: ['just', 'diligent', 'honest'], keys: ['аурели'],
      cities: ['Аурелиум', 'Сольвен', 'Мерид', 'Брайтхолл', 'Кастелар', 'Линдор', 'Вейрмут', 'Эшфорд', 'Рейнгард', 'Альбемар'],
      look: { hair: '#6b3f22', skin: '#f2c7a0', head: 'crown', cloth: '#2f63b0', bg: '#dfe8f5' },
    },
    serenica: {
      name: 'Республика Сереника', short: 'Сереника', adj: 'сереникский', color: '#1f8a7a', title: 'Дож', titleF: 'Догаресса',
      dynasty: 'дом Валеранте', male: ['Лоренцо', 'Марино', 'Фабио', 'Джанлуко'], female: ['Мариэлла', 'Беатрис', 'Ливия', 'Оттавия'],
      traits: ['greedy', 'calm', 'deceitful'], keys: ['сереник', 'республик', 'дож', 'догаресс'],
      cities: ['Сереника', 'Лазурра', 'Порто-Вэй', 'Мирабель', 'Кьяра', 'Солано', 'Тессина', 'Бельмаре'],
      look: { hair: '#9b4a22', skin: '#f4d2b8', head: 'corno', cloth: '#1f8a7a', bg: '#d6efe9' },
    },
    tarkhan: {
      name: 'Орда Тархана', short: 'Орда', adj: 'ордынский', color: '#b8392a', title: 'Хан', titleF: 'Ханша',
      dynasty: 'род Тарх', male: ['Боргул', 'Темир', 'Аркан', 'Сабур', 'Улаг'], female: ['Айнура', 'Сайхан', 'Толуна'],
      traits: ['wrathful', 'brave', 'ambitious'], keys: ['орд', 'тархан', 'хан', 'ханш', 'степ', 'кочевник'],
      cities: ['Тарх', 'Кара-Тол', 'Ашан', 'Буран', 'Седжа', 'Улус-Бей', 'Кумыр', 'Арсан'],
      look: { hair: '#1d1410', skin: '#c98d5a', head: 'furhat', cloth: '#b8392a', bg: '#f5dcd2' },
    },
    valdorn: {
      name: 'Империя Валдорн', short: 'Валдорн', adj: 'валдорнский', color: '#7a3592', title: 'Император', titleF: 'Императрица',
      dynasty: 'дом Кассарий', male: ['Максиан', 'Октавен', 'Северин', 'Лукан'], female: ['Валерия', 'Аурена', 'Корнелла'],
      traits: ['ambitious', 'arbitrary', 'strategist'], keys: ['валдорн', 'импери', 'император', 'императриц'],
      cities: ['Валдорн', 'Кассарион', 'Тирем', 'Орвиста', 'Делмар', 'Претория', 'Сильвен', 'Корда'],
      look: { hair: '#2a2420', skin: '#ecc8a8', head: 'laurel', cloth: '#7a3592', bg: '#ece0f2' },
    },
    ulfgard: {
      name: 'Северная марка Ульфгард', short: 'Ульфгард', adj: 'ульфгардский', color: '#55698f', title: 'Ярл', titleF: 'Ярлесса',
      dynasty: 'род Хельма', male: ['Торвальд', 'Хаук', 'Рагнвар', 'Эйрик'], female: ['Сигрун', 'Астрид', 'Ингрид'],
      traits: ['honest', 'brave', 'content'], keys: ['ульфгард', 'марк', 'ярл', 'ярлесс', 'северян'],
      cities: ['Ульфгард', 'Хельмвик', 'Сторнхейм', 'Фьяльбор', 'Исмарк', 'Скальд', 'Вирхольм'],
      look: { hair: '#c7b48a', skin: '#efd2c0', head: 'circlet', cloth: '#55698f', bg: '#dde3ee' },
    },
  };

  const SCENARIOS = [
    { id: 1, name: 'Сценарий I. Рассвет королевств', desc: 'Небольшой континент и два соседа: торговая Сереника и воинственная Орда. Освойте земли, постройте города, проверьте соседей на прочность.', w: 22, h: 15, realms: ['aurelia', 'serenica', 'tarkhan'], turns: 70, aiLevel: 0.9, grace: 14, coalition: false, premium: false },
    { id: 2, name: 'Сценарий II. Железный век', desc: 'С востока поднимается Империя Валдорн. Три соперника, у каждого правителя свои черты и амбиции. Коалиции против агрессора.', w: 28, h: 18, realms: ['aurelia', 'serenica', 'tarkhan', 'valdorn'], turns: 85, aiLevel: 1.0, grace: 10, coalition: true, premium: false },
    { id: 3, name: 'Сценарий III. Война династий', desc: 'Большая карта, четыре державы и дальновидный ИИ. Открывается после Сценария II или в Королевском издании.', w: 34, h: 21, realms: ['aurelia', 'serenica', 'tarkhan', 'valdorn', 'ulfgard'], turns: 100, aiLevel: 1.15, grace: 6, coalition: true, premium: true },
  ];

  /** События-выборы (в духе династических стратегий). */
  const EVENTS = [
    {
      id: 'vassal', title: 'Дерзкий барон', text: 'Барон приграничных земель требует освободить его от налогов на десять лет, иначе грозит смутой.',
      choices: [
        { label: 'Уступить (−50 золота)', fx: { gold: -50, stability: 5 } },
        { label: 'Отказать', fx: { stability: -8 } },
        { label: 'Бросить в темницу', fx: { stability: -3, prestige: 15 } },
      ],
    },
    {
      id: 'heir_edu', title: 'Воспитание наследника', text: 'Наследнику пора выбрать наставника. От этого зависит, каким правителем он станет.',
      choices: [
        { label: 'Мудрецы и книги (−40 золота)', fx: { gold: -40, heirTrait: 'scholar' } },
        { label: 'Полководцы и ристалище (−40 золота)', fx: { gold: -40, heirTrait: 'strategist' } },
        { label: 'Пусть растёт при дворе', fx: { heirTrait: 'lazy' } },
      ],
    },
    {
      id: 'master', title: 'Странствующий зодчий', text: 'Знаменитый зодчий предлагает свои услуги столице — за щедрую плату.',
      choices: [
        { label: 'Нанять (−60 золота, +40 производства в столице)', fx: { gold: -60, capitalProd: 40 } },
        { label: 'Отказать', fx: {} },
      ],
    },
    {
      id: 'heretics', title: 'Ересь в городе', text: 'Проповедник собирает толпы, отрицая власть короны над душами.',
      choices: [
        { label: 'Изгнать проповедника', fx: { stability: -4, prestige: 5 } },
        { label: 'Устроить диспут (проверка Учёности)', fx: { check: 'lrn', dc: 7, win: { stability: 6, prestige: 10 }, lose: { stability: -6 } } },
        { label: 'Терпеть', fx: { stability: -2, science: 15 } },
      ],
    },
    {
      id: 'tourney', title: 'Великий турнир', text: 'Рыцари королевства просят устроить турнир в честь правителя.',
      choices: [
        { label: 'Устроить (−50 золота, +престиж)', fx: { gold: -50, prestige: 20, rulerTraitChance: ['brave', 0.4] } },
        { label: 'Не время для забав', fx: { prestige: -5 } },
      ],
    },
    {
      id: 'plot', title: 'Заговор при дворе', text: 'Шпионы доносят: кто-то из придворных плетёт заговор против правителя.',
      choices: [
        { label: 'Расследовать (проверка Дипломатии)', fx: { check: 'dip', dc: 7, win: { stability: 8, prestige: 10 }, lose: { stability: -10 } } },
        { label: 'Усилить стражу (−40 золота)', fx: { gold: -40, stability: 2 } },
      ],
    },
    {
      id: 'comet', title: 'Комета в небесах', text: 'Над королевством пролетела хвостатая звезда. Народ ждёт толкования.',
      choices: [
        { label: '«Это знак величия нашего дома!»', fx: { prestige: 10, stability: 3 } },
        { label: '«Это предупреждение — молитесь»', fx: { stability: 5, science: -10 } },
      ],
    },
    {
      id: 'guild', title: 'Купеческая хартия', text: 'Гильдия купцов просит хартию с торговыми привилегиями.',
      choices: [
        { label: 'Даровать хартию (+3 золота за ход навсегда, −4 стабильности)', fx: { goldPerTurn: 3, stability: -4 } },
        { label: 'Отказать', fx: { stability: 2 } },
      ],
    },
    {
      id: 'harvest', title: 'Небывалый урожай', text: 'Амбары полны, по деревням гуляют свадьбы.',
      choices: [{ label: 'Славно!', fx: { foodAll: 12, stability: 3 } }],
    },
    {
      id: 'plague', title: 'Моровое поветрие', text: 'Болезнь пришла в один из городов.',
      choices: [
        { label: 'Карантин (−40 золота)', fx: { gold: -40 } },
        { label: 'Положиться на судьбу', fx: { popLoss: 1, stability: -3 } },
      ],
    },
  ];

  const ACHIEVEMENTS = [
    { id: 'first_city', name: 'Основатель', desc: 'Основать второй город', check: (c) => c.state && c.state.stats.citiesFounded >= 1 },
    { id: 'first_blood', name: 'Первая кровь', desc: 'Уничтожить вражеский отряд', check: (c) => c.state && c.state.stats.unitsKilled >= 1 },
    { id: 'conqueror', name: 'Завоеватель', desc: 'Захватить вражеский город', check: (c) => c.state && c.state.stats.citiesCaptured >= 1 },
    { id: 'scholar', name: 'Век разума', desc: 'Изучить Философию', check: (c) => c.state && c.state.realms.aurelia.techs.includes('philosophy') },
    { id: 'marriage', name: 'Узы крови', desc: 'Заключить династический брак', check: (c) => c.state && c.state.stats.marriages >= 1 },
    { id: 'dynasty', name: 'Династия', desc: 'Пережить смену правителя', check: (c) => c.state && c.state.stats.successions >= 1 },
    { id: 'voice', name: 'Голос короны', desc: '15 голосовых приказов за партию', check: (c) => c.state && c.state.stats.voiceCommands >= 15 },
    { id: 'win1', name: 'Рассвет', desc: 'Победить в Сценарии I', check: (c) => c.summary && c.summary.result === 'win' && c.summary.level === 1 },
    { id: 'win2', name: 'Железная воля', desc: 'Победить в Сценарии II', check: (c) => c.summary && c.summary.result === 'win' && c.summary.level === 2 },
    { id: 'win3', name: 'Владыка династий', desc: 'Победить в Сценарии III', check: (c) => c.summary && c.summary.result === 'win' && c.summary.level === 3 },
    { id: 'patron', name: 'Меценат', desc: 'Поддержать разработчиков', check: (c) => c.profile && c.profile.purchases && c.profile.purchases.length > 0 },
  ];

  const INTENT_LABELS = {
    expand: 'Расселяется и основывает города',
    build: 'Строит и развивает города',
    arm: 'Вооружается',
    fortify: 'Укрепляет оборону',
    declare_war: 'Готовит войну против: {t}!',
    war: 'Ведёт войну против: {t}',
    offer_peace: 'Ищет мира с: {t}',
    propose_trade: 'Хочет торговать с: {t}',
    propose_alliance: 'Ищет союза с: {t}',
    propose_marriage: 'Предлагает брак: {t}',
    demand_tribute: 'Хочет дани от: {t}',
    gift: 'Ищет расположения: {t}',
    idle: 'Выжидает',
  };

  RF.Data = { HEROES, HERO_XP, IMPROVEMENTS, DISTRICTS, CIVICS, POLICIES, TERRAIN, RESOURCES, TECHS, UNITS, BUILDINGS, TRAITS, STATS, REALMS, SCENARIOS, EVENTS, ACHIEVEMENTS, INTENT_LABELS, START_YEAR: 1000, YEARS_PER_TURN: 2 };
})(typeof window !== 'undefined' ? window : globalThis);
