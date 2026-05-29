// Procedural audio — SFX + chiptune bass loop via Web Audio API
const Audio = (() => {
  let ctx = null;
  let masterGain, sfxGain, musicGain;
  let muted = false;
  let musicPlaying = false;
  let musicTimer = 0;
  let beat = 0;

  function ensure() {
    if (ctx) return;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = 0.55;
      masterGain.connect(ctx.destination);
      sfxGain = ctx.createGain();
      sfxGain.gain.value = 0.8;
      sfxGain.connect(masterGain);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.35;
      musicGain.connect(masterGain);
    } catch (e) { ctx = null; }
  }

  function tone(freq, dur, opts = {}) {
    ensure(); if (!ctx) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = opts.type ?? 'square';
    o.frequency.value = freq;
    if (opts.freqEnd) {
      o.frequency.exponentialRampToValueAtTime(Math.max(20, opts.freqEnd), ctx.currentTime + dur);
    }
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(opts.vol ?? 0.18, ctx.currentTime + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g);
    g.connect(opts.bus ?? sfxGain);
    o.start();
    o.stop(ctx.currentTime + dur + 0.02);
  }

  function noise(dur, opts = {}) {
    ensure(); if (!ctx) return;
    const bufSize = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = opts.filter ?? 'lowpass';
    filter.frequency.value = opts.cutoff ?? 1200;
    const g = ctx.createGain();
    g.gain.value = opts.vol ?? 0.25;
    src.connect(filter);
    filter.connect(g);
    g.connect(opts.bus ?? sfxGain);
    src.start();
  }

  const SFX = {
    shoot() { tone(880, 0.06, { type: 'square', freqEnd: 440, vol: 0.08 }); },
    beamCharge() { tone(220, 0.08, { type: 'sawtooth', freqEnd: 440, vol: 0.08 }); },
    beamFire() {
      tone(180, 0.35, { type: 'sawtooth', freqEnd: 60, vol: 0.18 });
      tone(360, 0.3, { type: 'square', freqEnd: 120, vol: 0.1 });
      noise(0.25, { cutoff: 3000, vol: 0.18 });
    },
    hitSmall() { noise(0.06, { cutoff: 2400, vol: 0.12 }); },
    explodeSmall() {
      noise(0.18, { cutoff: 1400, vol: 0.22 });
      tone(180, 0.18, { type: 'square', freqEnd: 60, vol: 0.12 });
    },
    explodeBig() {
      noise(0.55, { cutoff: 800, vol: 0.32 });
      tone(120, 0.45, { type: 'sawtooth', freqEnd: 30, vol: 0.18 });
    },
    enemyShot() {
      const now = performance.now();
      if (now - (SFX._lastEnemyShot || 0) < 35) return;
      SFX._lastEnemyShot = now;
      tone(420, 0.06, { type: 'square', freqEnd: 220, vol: 0.04 });
    },
    podDeploy() { tone(660, 0.12, { type: 'triangle', freqEnd: 880, vol: 0.15 }); },
    podReturn() { tone(880, 0.12, { type: 'triangle', freqEnd: 660, vol: 0.12 }); },
    bomb() {
      noise(0.7, { cutoff: 500, vol: 0.45 });
      tone(80, 0.8, { type: 'sawtooth', freqEnd: 20, vol: 0.22 });
    },
    playerHit() {
      tone(180, 0.5, { type: 'sawtooth', freqEnd: 40, vol: 0.25 });
      noise(0.3, { cutoff: 600, vol: 0.2 });
    },
    powerup() {
      tone(660, 0.08, { vol: 0.12 });
      setTimeout(() => tone(880, 0.08, { vol: 0.12 }), 70);
      setTimeout(() => tone(1320, 0.12, { vol: 0.12 }), 140);
    },
    bossWarn() {
      tone(220, 0.5, { type: 'sawtooth', vol: 0.2 });
      setTimeout(() => tone(220, 0.5, { type: 'sawtooth', vol: 0.2 }), 600);
    },
    win() {
      [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.18, { type: 'triangle', vol: 0.18 }), i * 120));
    },
    graze() { tone(1500, 0.04, { type: 'square', vol: 0.05 }); },
    missile() {
      const now = performance.now();
      if (now - (SFX._lastMissile || 0) < 120) return;
      SFX._lastMissile = now;
      tone(520, 0.1, { type: 'triangle', freqEnd: 920, vol: 0.05 });
      noise(0.06, { cutoff: 3200, vol: 0.05 });
    },
  };

  // Simple chiptune bass loop — driven by beat tick
  function musicTick(dt) {
    if (!ctx || !musicPlaying || muted) return;
    musicTimer += dt;
    const beatInterval = 0.18; // BPM ~333 / 2 = aggressive
    while (musicTimer >= beatInterval) {
      musicTimer -= beatInterval;
      const pattern = [55, 0, 55, 82, 110, 82, 73, 65, 55, 0, 65, 82, 110, 98, 82, 73];
      const f = pattern[beat % pattern.length];
      if (f > 0) {
        tone(f, 0.15, { type: 'square', vol: 0.04, bus: musicGain });
        tone(f * 2, 0.08, { type: 'triangle', vol: 0.03, bus: musicGain });
      }
      // hi-hat-ish every 2 beats
      if (beat % 2 === 0) noise(0.04, { cutoff: 6000, vol: 0.04, bus: musicGain });
      // kick on 0 and 8
      if (beat % 8 === 0) {
        tone(60, 0.12, { type: 'sine', freqEnd: 30, vol: 0.15, bus: musicGain });
      }
      beat++;
    }
  }

  function startMusic() {
    ensure();
    musicPlaying = true;
    musicTimer = 0; beat = 0;
  }
  function stopMusic() { musicPlaying = false; }

  function toggleMute() {
    muted = !muted;
    if (masterGain) masterGain.gain.value = muted ? 0 : 0.55;
  }

  function resume() {
    ensure();
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  return { SFX, startMusic, stopMusic, musicTick, toggleMute, resume };
})();
