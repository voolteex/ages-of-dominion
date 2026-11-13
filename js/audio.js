/* =========================================================================
 * Звук: синтезированные эффекты и фоновая «средневековая» мелодия на Web Audio
 * (без внешних файлов — дорийский лад, щипковый тембр лютни + бурдон).
 * ========================================================================= */
(function (root) {
  const RF = (root.RF = root.RF || {});
  let ctx = null, master = null, musicGain = null, musicTimer = null;
  let soundOn = true, musicOn = true;

  function ensure() {
    if (ctx) return ctx;
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
    musicGain = ctx.createGain(); musicGain.gain.value = 0.16; musicGain.connect(master);
    return ctx;
  }

  function tone(freq, start, dur, opts) {
    opts = opts || {};
    const c = ensure(); if (!c) return;
    const o = c.createOscillator();
    const g = c.createGain();
    const f = c.createBiquadFilter();
    o.type = opts.type || 'triangle';
    o.frequency.setValueAtTime(freq, start);
    if (opts.slide) o.frequency.exponentialRampToValueAtTime(opts.slide, start + dur);
    f.type = 'lowpass'; f.frequency.value = opts.cutoff || 2400;
    const vol = opts.vol || 0.3;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(vol, start + (opts.attack || 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(f); f.connect(g); g.connect(opts.dest || master);
    o.start(start); o.stop(start + dur + 0.05);
  }

  function noise(start, dur, vol, cutoff) {
    const c = ensure(); if (!c) return;
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = c.createBufferSource(); s.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = cutoff || 3000;
    const g = c.createGain(); g.gain.value = vol || 0.3;
    s.connect(f); f.connect(g); g.connect(master);
    s.start(start);
  }

  const SFX = {
    click: (t) => tone(660, t, 0.08, { type: 'square', vol: 0.08, cutoff: 1800 }),
    coin: (t) => { tone(988, t, 0.1, { vol: 0.2 }); tone(1319, t + 0.08, 0.25, { vol: 0.2 }); },
    build: (t) => { noise(t, 0.08, 0.3, 900); noise(t + 0.15, 0.08, 0.3, 900); tone(220, t, 0.2, { vol: 0.15 }); },
    sword: (t) => { noise(t, 0.25, 0.4, 5000); tone(1800, t, 0.3, { type: 'sawtooth', vol: 0.06, slide: 900 }); },
    drum: (t) => { for (let i = 0; i < 3; i++) tone(90, t + i * 0.18, 0.25, { type: 'sine', vol: 0.5, slide: 50 }); },
    fanfare: (t) => { [523, 659, 784, 1047].forEach((f, i) => tone(f, t + i * 0.14, i === 3 ? 0.7 : 0.18, { type: 'sawtooth', vol: 0.12, cutoff: 2600 })); },
    fail: (t) => { [392, 349, 311, 262].forEach((f, i) => tone(f, t + i * 0.22, 0.35, { type: 'triangle', vol: 0.18 })); },
    notify: (t) => { tone(784, t, 0.12, { vol: 0.12 }); tone(1175, t + 0.1, 0.2, { vol: 0.12 }); },
    listen: (t) => tone(880, t, 0.12, { type: 'sine', vol: 0.15 }),
    error: (t) => tone(180, t, 0.25, { type: 'square', vol: 0.08 }),
    select: (t) => { tone(587, t, 0.07, { type: 'triangle', vol: 0.12 }); tone(880, t + 0.05, 0.12, { type: 'triangle', vol: 0.1 }); },
    move: (t) => { for (let i = 0; i < 3; i++) noise(t + i * 0.11, 0.05, 0.18, 700); },
    tech: (t) => { [659, 784, 988, 1319].forEach((f, i) => tone(f, t + i * 0.09, 0.5, { type: 'sine', vol: 0.12 })); },
    city: (t) => { tone(392, t, 1.2, { type: 'sine', vol: 0.18 }); tone(588, t, 1.0, { type: 'sine', vol: 0.08 }); tone(784, t + 0.02, 0.8, { type: 'sine', vol: 0.05 }); },
  };

  // Мелодия: D дорийский (D E F G A B C)
  const MELODY = [62, 65, 67, 69, 67, 65, 64, 62, 69, 72, 71, 69, 67, 65, 67, 69, 62, 64, 65, 67, 69, 67, 65, 62];
  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

  // Оркестровая тема: аккорды-подложка (Dm–C–B♭–C / Dm–F–C–A), щипковая мелодия, рамочный барабан
  const PROG = [[50, 53, 57], [48, 52, 55], [46, 50, 53], [48, 52, 55], [50, 53, 57], [53, 57, 60], [48, 52, 55], [45, 49, 52]];
  const SCALE = [62, 64, 65, 67, 69, 70, 72, 74];
  function startMusic() {
    const c = ensure(); if (!c || musicTimer) return;
    let bar = 0;
    const beat = 0.5;
    const schedule = () => {
      const t = c.currentTime + 0.05;
      const chord = PROG[bar % PROG.length];
      for (const n of chord) tone(midi(n), t, beat * 4.2, { type: 'sawtooth', vol: 0.05, cutoff: 700, dest: musicGain, attack: 0.6 });
      tone(midi(chord[0] - 12), t, beat * 4, { type: 'triangle', vol: 0.22, cutoff: 500, dest: musicGain, attack: 0.05 });
      // мелодия: ноты аккорда и лада, ритм 1-1-½-½-1
      const rhythm = [0, 1, 2, 2.5, 3];
      rhythm.forEach((pos, i) => {
        const pool = i % 2 === 0 ? chord.map((x) => x + 12) : SCALE;
        const n = pool[(bar * 3 + i * 5) % pool.length];
        tone(midi(n), t + pos * beat, beat * 1.4, { type: 'triangle', vol: 0.32, cutoff: 1800, dest: musicGain });
      });
      // рамочный барабан
      for (let i = 0; i < 4; i++) tone(i % 2 ? 110 : 70, t + i * beat, 0.18, { type: 'sine', vol: i % 2 ? 0.12 : 0.22, slide: 45, dest: musicGain });
      bar++;
    };
    schedule();
    musicTimer = setInterval(schedule, beat * 4 * 1000);
  }
  function stopMusic() { if (musicTimer) clearInterval(musicTimer); musicTimer = null; }

  RF.Audio = {
    unlock() { const c = ensure(); if (c && c.state === 'suspended') c.resume(); if (musicOn) startMusic(); },
    play(name) { if (!soundOn) return; const c = ensure(); if (!c || !SFX[name]) return; SFX[name](c.currentTime + 0.01); },
    setSound(v) { soundOn = !!v; },
    setMusic(v) { musicOn = !!v; if (musicOn && ctx) startMusic(); else stopMusic(); },
  };
})(typeof window !== 'undefined' ? window : globalThis);
