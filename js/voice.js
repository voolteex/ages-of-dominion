/* =========================================================================
 * Голосовой интерфейс: распознавание речи (Web Speech API, ru-RU) и
 * озвучивание ответов советницы (SpeechSynthesis). Текст передаётся в NLP.
 * Работает в Chrome / Edge; требуется доступ к микрофону и http://localhost.
 * ========================================================================= */
(function (root) {
  const RF = (root.RF = root.RF || {});
  const SR = root.SpeechRecognition || root.webkitSpeechRecognition;
  let rec = null, listening = false, continuous = false, handlers = {};
  let ruVoice = null;

  function pickVoice() {
    if (!root.speechSynthesis) return;
    const vs = root.speechSynthesis.getVoices();
    ruVoice = vs.find((v) => /ru/i.test(v.lang) && /female|irina|svetlana|milena|dariya|женск/i.test(v.name)) || vs.find((v) => /ru/i.test(v.lang)) || null;
  }
  if (root.speechSynthesis) { pickVoice(); root.speechSynthesis.onvoiceschanged = pickVoice; }

  function build() {
    rec = new SR();
    rec.lang = 'ru-RU';
    rec.interimResults = true;
    rec.maxAlternatives = 3;
    rec.continuous = false;
    rec.onstart = () => { listening = true; handlers.onState && handlers.onState('listening'); };
    rec.onend = () => {
      listening = false;
      handlers.onState && handlers.onState('idle');
      if (continuous) setTimeout(() => { if (continuous && !listening) try { rec.start(); } catch (e) { /* уже запущено */ } }, 250);
    };
    rec.onerror = (e) => {
      handlers.onError && handlers.onError(e.error);
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') continuous = false;
    };
    rec.onresult = (e) => {
      const res = e.results[e.results.length - 1];
      if (!res.isFinal) { handlers.onInterim && handlers.onInterim(res[0].transcript); return; }
      const alts = [];
      for (let i = 0; i < res.length; i++) alts.push({ text: res[i].transcript, confidence: res[i].confidence });
      handlers.onFinal && handlers.onFinal(alts);
    };
  }

  RF.Voice = {
    supported: () => !!SR,
    init(h) { handlers = h || {}; if (SR && !rec) build(); },
    get listening() { return listening; },
    start(cont) {
      if (!SR) return false;
      if (!rec) build();
      continuous = !!cont;
      if (listening) return true;
      try { rec.start(); return true; } catch (e) { return false; }
    },
    stop() { continuous = false; if (rec && listening) rec.stop(); },
    speak(text) {
      if (!root.speechSynthesis || !text) return;
      root.speechSynthesis.cancel();
      const u = new root.SpeechSynthesisUtterance(text.replace(/[«»]/g, ''));
      u.lang = 'ru-RU';
      if (ruVoice) u.voice = ruVoice;
      u.rate = 1.05; u.pitch = 1.1;
      root.speechSynthesis.speak(u);
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
