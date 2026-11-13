/* =========================================================================
 * Хранилище: профиль игрока, статистика, таблица рекордов, достижения,
 * сохранение партии, веса ИИ-модели, покупки. localStorage (в Node — память).
 * ========================================================================= */
(function (root) {
  const RF = (root.RF = root.RF || {});
  const KEY = 'agesofdominion_v1';

  const memory = {};
  const backend = (() => {
    try {
      if (root.localStorage) { root.localStorage.setItem('__t', '1'); root.localStorage.removeItem('__t'); return root.localStorage; }
    } catch (e) { /* приватный режим */ }
    return { getItem: (k) => (k in memory ? memory[k] : null), setItem: (k, v) => { memory[k] = String(v); }, removeItem: (k) => { delete memory[k]; } };
  })();

  function defaults() {
    return {
      name: 'Правитель',
      settings: { sound: true, music: true, voiceFeedback: true, continuousVoice: false, aiDetails: true },
      stats: { games: 0, wins: 0, losses: 0, battlesWon: 0, voiceCommands: 0, bestScore: 0, totalTurns: 0 },
      leaderboard: [],
      achievements: {},
      unlockedLevel: 1,
      premium: false,
      seals: 30,
      inventory: { gold: 0, army: 0, settler: 0, tech: 0, spies: 0 },
      skins: { owned: ['royal'], active: 'royal' },
      purchases: [],
      adsWatched: { date: '', count: 0 },
      aiModel: null,
      save: null,
    };
  }

  function merge(base, data) {
    for (const k in data) {
      if (data[k] && typeof data[k] === 'object' && !Array.isArray(data[k]) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) merge(base[k], data[k]);
      else base[k] = data[k];
    }
    return base;
  }

  let profile = null;

  const Storage = {
    load() {
      try {
        const raw = backend.getItem(KEY);
        profile = merge(defaults(), raw ? JSON.parse(raw) : {});
      } catch (e) {
        profile = defaults();
      }
      return profile;
    },
    get profile() { return profile || this.load(); },
    persist() {
      try { backend.setItem(KEY, JSON.stringify(this.profile)); return true; } catch (e) { return false; }
    },
    reset() { profile = defaults(); this.persist(); return profile; },

    saveGame(state) { this.profile.save = JSON.parse(JSON.stringify(state)); this.persist(); },
    loadGame() { return this.profile.save ? JSON.parse(JSON.stringify(this.profile.save)) : null; },
    clearGame() { this.profile.save = null; this.persist(); },

    /** Записать итог партии: статистика, рекорды, разблокировки, веса ИИ. Возвращает новые достижения. */
    recordResult(state) {
      const p = this.profile;
      const over = state.over;
      const summary = { result: over.result, level: state.level, score: over.score, turns: state.turn, reason: over.reason };
      p.stats.games++;
      if (over.result === 'win') p.stats.wins++; else p.stats.losses++;
      p.stats.battlesWon += state.stats.battlesWon;
      p.stats.voiceCommands += state.stats.voiceCommands;
      p.stats.totalTurns += state.turn;
      p.stats.bestScore = Math.max(p.stats.bestScore, over.score);
      const boosted = Object.values(state.boosts || {}).some(Boolean);
      p.leaderboard.push({ name: p.name, score: over.score, level: state.level, result: over.result, date: new Date().toISOString().slice(0, 10), boosted });
      p.leaderboard.sort((a, b) => b.score - a.score);
      p.leaderboard = p.leaderboard.slice(0, 10);
      if (over.result === 'win') p.unlockedLevel = Math.max(p.unlockedLevel, Math.min(3, state.level + 1));
      if (RF.AI) p.aiModel = RF.AI.PlayerModel.serialize(state.playerModel);
      if (over.result === 'win') p.seals += 10 * state.level; // награда печатями
      const fresh = this.checkAchievements({ state, profile: p, summary });
      this.clearGame();
      this.persist();
      return { summary, fresh, rank: p.leaderboard.findIndex((r) => r.score === over.score && r.level === state.level) + 1 };
    },

    checkAchievements(ctx) {
      const fresh = [];
      for (const a of RF.Data.ACHIEVEMENTS) {
        if (this.profile.achievements[a.id]) continue;
        let ok = false;
        try { ok = a.check(ctx); } catch (e) { ok = false; }
        if (ok) { this.profile.achievements[a.id] = new Date().toISOString().slice(0, 10); fresh.push(a); }
      }
      if (fresh.length) this.persist();
      return fresh;
    },
  };

  RF.Storage = Storage;
})(typeof window !== 'undefined' ? window : globalThis);
