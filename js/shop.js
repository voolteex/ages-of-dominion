/* =========================================================================
 * Коммерциализация (модель Free-to-Play / Freemium):
 *  1) Премиум-валюта «Королевские печати» — пакеты за реальные деньги
 *     (в прототипе — демо-оплата без списания средств).
 *  2) «Королевское издание» — разовая покупка: Сценарий III сразу, без рекламы,
 *     эксклюзивный облик, двойная награда за рекламу.
 *  3) Внутриигровые товары за печати: усиления на партию, «Королевские шпионы»
 *     (показ намерений ИИ), косметические облики короля.
 *  4) Реклама с вознаграждением (+печати, лимит 3 в день) и межуровневая
 *     реклама для бесплатных игроков.
 * Рекорды с усилениями помечаются, чтобы таблица оставалась честной.
 * ========================================================================= */
(function (root) {
  const RF = (root.RF = root.RF || {});

  const PACKS = [
    { id: 'seals_s', seals: 100, price: 99, label: 'Мешочек печатей' },
    { id: 'seals_m', seals: 550, price: 449, label: 'Сундук печатей', badge: '+10%' },
    { id: 'seals_l', seals: 1200, price: 899, label: 'Казна печатей', badge: '+20%' },
  ];
  const PREMIUM = { id: 'premium', price: 299, label: 'Королевское издание' };

  const ITEMS = [
    { id: 'gold', name: 'Казна гильдии', desc: '+150 золота в начале партии', cost: 50, icon: 'gold' },
    { id: 'army', name: 'Наёмные лучники', desc: '2 отряда лучников у столицы', cost: 60, icon: 'army' },
    { id: 'settler', name: 'Караван переселенцев', desc: 'Дополнительные поселенцы на старте', cost: 50, icon: 'settle' },
    { id: 'tech', name: 'Свитки мастеров', desc: 'Бронзовое литьё изучено с начала', cost: 40, icon: 'science' },
    { id: 'spies', name: 'Королевские шпионы', desc: 'Показывают замыслы ИИ-правителей: топ-3 решения и их полезность', cost: 80, icon: 'brain' },
  ];

  const SKINS = [
    { id: 'royal', name: 'Лазурная мантия', robe: '#2f5d9e', robeDark: '#1d3b66', cost: 0 },
    { id: 'emperor', name: 'Пурпур императора', robe: '#7b2d8e', robeDark: '#45174f', cost: 120 },
    { id: 'forest', name: 'Изумрудный плащ', robe: '#2f7a4a', robeDark: '#1a4a2b', cost: 90 },
    { id: 'golden', name: 'Золотой стяг', robe: '#c8952c', robeDark: '#7d5a14', cost: null, premium: true },
  ];

  const AD_LIMIT = 3;

  const S = () => RF.Storage;
  const today = () => new Date().toISOString().slice(0, 10);

  const Shop = {
    PACKS, PREMIUM, ITEMS, SKINS, AD_LIMIT,

    /** Демо-оплата: в реальном продукте здесь вызывается платёжный SDK (ЮKassa / Google Play Billing). */
    purchasePack(packId) {
      const pack = PACKS.find((p) => p.id === packId);
      if (!pack) return { ok: false, msg: 'Товар не найден.' };
      const p = S().profile;
      p.seals += pack.seals;
      p.purchases.push({ id: pack.id, price: pack.price, date: new Date().toISOString(), demo: true });
      S().persist();
      return { ok: true, msg: `Зачислено ${pack.seals} печатей (демо-оплата ${pack.price} ₽, средства не списаны).` };
    },

    purchasePremium() {
      const p = S().profile;
      if (p.premium) return { ok: false, msg: 'Королевское издание уже активно.' };
      p.premium = true;
      p.unlockedLevel = 3;
      if (!p.skins.owned.includes('golden')) p.skins.owned.push('golden');
      p.purchases.push({ id: PREMIUM.id, price: PREMIUM.price, date: new Date().toISOString(), demo: true });
      S().persist();
      return { ok: true, msg: 'Королевское издание активировано: Сценарий III открыта, реклама отключена, «Золотой стяг» в гардеробе!' };
    },

    buyItem(itemId) {
      const item = ITEMS.find((i) => i.id === itemId);
      const p = S().profile;
      if (!item) return { ok: false, msg: 'Товар не найден.' };
      if (p.seals < item.cost) return { ok: false, msg: `Не хватает печатей: нужно ${item.cost}.` };
      p.seals -= item.cost;
      p.inventory[itemId] = (p.inventory[itemId] || 0) + 1;
      S().persist();
      return { ok: true, msg: `«${item.name}» добавлен в запасы.` };
    },

    buySkin(skinId) {
      const skin = SKINS.find((s) => s.id === skinId);
      const p = S().profile;
      if (!skin) return { ok: false, msg: 'Облик не найден.' };
      if (p.skins.owned.includes(skinId)) { p.skins.active = skinId; S().persist(); return { ok: true, msg: `Облик «${skin.name}» выбран.` }; }
      if (skin.premium) return { ok: false, msg: 'Этот облик входит в Королевское издание.' };
      if (p.seals < skin.cost) return { ok: false, msg: `Не хватает печатей: нужно ${skin.cost}.` };
      p.seals -= skin.cost;
      p.skins.owned.push(skinId);
      p.skins.active = skinId;
      S().persist();
      return { ok: true, msg: `Облик «${skin.name}» куплен и выбран.` };
    },

    activeSkin() {
      const p = S().profile;
      return SKINS.find((s) => s.id === p.skins.active) || SKINS[0];
    },

    adsLeft() {
      const p = S().profile;
      if (p.adsWatched.date !== today()) return AD_LIMIT;
      return Math.max(0, AD_LIMIT - p.adsWatched.count);
    },

    rewardAd() {
      const p = S().profile;
      if (this.adsLeft() <= 0) return { ok: false, msg: 'Лимит рекламы на сегодня исчерпан.' };
      if (p.adsWatched.date !== today()) p.adsWatched = { date: today(), count: 0 };
      p.adsWatched.count++;
      const reward = p.premium ? 30 : 15;
      p.seals += reward;
      S().persist();
      return { ok: true, msg: `Награда за просмотр: +${reward} печатей.`, reward };
    },

    /** Забрать усиления из запасов на новую партию. selected: { gold: true, ... } */
    consumeBoosts(selected) {
      const p = S().profile;
      const boosts = {};
      for (const id of Object.keys(selected || {})) {
        if (selected[id] && p.inventory[id] > 0) { p.inventory[id]--; boosts[id] = true; }
      }
      S().persist();
      return boosts;
    },

    showInterstitial() { return !S().profile.premium; },
  };

  RF.Shop = Shop;
})(typeof window !== 'undefined' ? window : globalThis);
