// Level 1 — declarative timeline of spawns, phase transitions, boss cue
const Level1 = (() => {
  // Helper formation spawners
  function vWave(yCenter, count, type, opts = {}) {
    const items = [];
    for (let i = 0; i < count; i++) {
      const offsetY = (i - (count - 1) / 2) * 22;
      items.push({ type, x: 850 + i * 38, y: yCenter + offsetY, ...opts });
    }
    return items;
  }
  function line(yCenter, count, type, delayStep, opts = {}) {
    const items = [];
    for (let i = 0; i < count; i++) {
      items.push({ at: i * delayStep, type, x: 850, y: yCenter, ...opts });
    }
    return items;
  }

  // Timeline events. Time in seconds.
  // Action types:
  //   { at, spawn: [{type, x, y, ...}] }
  //   { at, phase: 'open'|'corridor'|'asteroids'|'approach'|'boss' }
  //   { at, banner: 'text', sub: 'subtext' }
  //   { at, action: 'spawnBoss' }
  //   { at, action: 'dropPod' }
  const events = [
    // 0:00 - 0:20 Intro / tuto implicite
    { at: 1.0, banner: 'SECTEUR 7 — APPROCHE', sub: '// CONTACT IMMINENT' },
    { at: 2.5, spawn: vWave(180, 3, 'drone') },
    { at: 5.5, spawn: vWave(280, 3, 'drone') },
    { at: 8.0, spawn: vWave(140, 4, 'drone') },
    { at: 8.0, spawn: vWave(310, 4, 'drone', { dx: -200 }) },
    { at: 12.0, spawn: [{ type: 'sniper', x: 850, y: 120 }, { type: 'sniper', x: 850, y: 330 }] },
    { at: 15.0, spawn: vWave(225, 5, 'swooper') },

    // 0:20 - 0:50 Mid vagues
    { at: 20.0, banner: 'ARMEMENT DISPONIBLE', sub: '// FORCE POD INBOUND' },
    { at: 22.0, action: 'dropPod' },
    { at: 26.0, spawn: vWave(160, 4, 'drone') },
    { at: 26.0, spawn: vWave(290, 4, 'drone') },
    { at: 30.0, spawn: [
      { type: 'kamikaze', x: 850, y: 100 },
      { type: 'kamikaze', x: 880, y: 200 },
      { type: 'kamikaze', x: 910, y: 300 },
      { type: 'kamikaze', x: 940, y: 380 },
    ]},
    { at: 35.0, spawn: vWave(225, 6, 'swooper') },
    { at: 40.0, spawn: [
      { type: 'sniper', x: 850, y: 110 },
      { type: 'sniper', x: 850, y: 225 },
      { type: 'sniper', x: 850, y: 340 },
    ]},
    { at: 45.0, spawn: vWave(225, 5, 'drone') },

    // 0:50 - 1:30 corridor étroit
    { at: 50.0, banner: 'COULOIR DÉTECTÉ', sub: '// PRUDENCE PILOTE' },
    { at: 50.5, phase: 'corridor' },
    { at: 53.0, spawn: [{ type: 'turret', x: 850, y: 0, top: true }] },
    { at: 55.0, spawn: [{ type: 'turret', x: 850, y: 0, top: false }] },
    { at: 57.0, spawn: [
      { type: 'turret', x: 850, y: 0, top: true },
      { type: 'turret', x: 920, y: 0, top: false },
    ]},
    { at: 60.0, spawn: vWave(225, 4, 'kamikaze') },
    { at: 64.0, spawn: [
      { type: 'turret', x: 850, y: 0, top: true },
      { type: 'turret', x: 870, y: 0, top: false },
      { type: 'turret', x: 920, y: 0, top: true },
    ]},
    { at: 70.0, spawn: vWave(180, 4, 'drone') },
    { at: 70.0, spawn: vWave(280, 4, 'drone') },
    { at: 76.0, spawn: [{ type: 'powerup', x: 850, y: 225, kind: 'bomb' }] },
    { at: 80.0, spawn: [
      { type: 'sniper', x: 850, y: 120 },
      { type: 'sniper', x: 880, y: 330 },
    ]},

    // 1:30 - 1:55 Mid-boss
    { at: 88.0, phase: 'open' },
    { at: 90.0, banner: 'ALERTE — VAISSEAU ENNEMI', sub: '// CROISEUR LOURD' },
    { at: 92.0, spawn: [{ type: 'midboss', x: 900, y: 225 }] },

    // 2:00 - 2:30 astéroïdes
    { at: 115.0, banner: 'CHAMP D\'ASTÉROÏDES', sub: '// ROCHES INSTABLES' },
    { at: 117.0, phase: 'asteroids' },
    { at: 118.0, spawn: [
      { type: 'asteroid', x: 850, y: 100 },
      { type: 'asteroid', x: 880, y: 250 },
      { type: 'asteroid', x: 910, y: 350 },
    ]},
    { at: 122.0, spawn: [
      { type: 'asteroid', x: 850, y: 150 },
      { type: 'asteroid', x: 880, y: 320 },
    ]},
    { at: 124.0, spawn: vWave(225, 4, 'swooper') },
    { at: 128.0, spawn: [
      { type: 'asteroid', x: 850, y: 80 },
      { type: 'asteroid', x: 880, y: 200 },
      { type: 'asteroid', x: 920, y: 310 },
      { type: 'asteroid', x: 950, y: 400 },
    ]},
    { at: 134.0, spawn: [{ type: 'powerup', x: 850, y: 200, kind: 'pod' }] },
    { at: 138.0, spawn: [
      { type: 'kamikaze', x: 850, y: 100 },
      { type: 'kamikaze', x: 850, y: 350 },
      { type: 'asteroid', x: 870, y: 225 },
    ]},

    // 2:30 - 3:00 approche
    { at: 145.0, banner: 'APPROCHE FINALE', sub: '// TRANSMISSION HOSTILE' },
    { at: 145.5, phase: 'approach' },
    { at: 148.0, spawn: vWave(180, 5, 'drone') },
    { at: 150.0, spawn: vWave(280, 5, 'drone') },
    { at: 154.0, spawn: [
      { type: 'sniper', x: 850, y: 130 },
      { type: 'sniper', x: 850, y: 320 },
      { type: 'sniper', x: 880, y: 225 },
    ]},
    { at: 160.0, spawn: vWave(225, 6, 'swooper') },
    { at: 165.0, spawn: [{ type: 'powerup', x: 850, y: 225, kind: 'bomb' }] },

    // 3:00 BOSS
    { at: 172.0, banner: '!!! ALERTE MAXIMUM !!!', sub: '// BYDO PRIME EN APPROCHE' },
    { at: 175.0, phase: 'boss' },
    { at: 176.0, action: 'spawnBoss' },
  ];

  let t = 0;
  let fired = 0;
  let banner = null;

  function reset() {
    t = 0;
    fired = 0;
    banner = null;
  }

  function update(dt) {
    // freeze timeline while midboss alive (gate)
    const gates = [
      { at: 95.0, until: () => Enemies.activeCount() === 0 || t > 110 },
    ];
    let frozen = false;
    for (const g of gates) {
      if (t >= g.at && fired < events.length && events[fired] && events[fired].at > g.at) {
        // only when crossing the gate the next spawn is past it AND not satisfied
      }
    }
    // Simpler approach: freeze timeline at t=110 if midboss still alive
    if (t >= 110 && t < 115 && Enemies.all().some(e => e.alive && e.type === 'midboss')) {
      // hold here
      t = 110;
      frozen = true;
    }
    if (!frozen) t += dt;

    while (fired < events.length && events[fired].at <= t) {
      const e = events[fired++];
      applyEvent(e);
    }

    if (banner) {
      banner.t += dt;
      if (banner.t > 3.2) banner = null;
    }
  }

  function applyEvent(e) {
    if (e.spawn) {
      for (const s of e.spawn) {
        Enemies.spawn(s.type, s);
      }
    }
    if (e.phase) Background.setPhase(e.phase);
    if (e.banner) banner = { text: e.banner, sub: e.sub || '', t: 0 };
    if (e.action === 'spawnBoss') Boss.start();
    if (e.action === 'dropPod') {
      Enemies.spawn('powerup', { x: 850, y: 225, kind: 'pod' });
    }
  }

  function drawBanner(ctx) {
    if (!banner) return;
    const W = 800, H = 450;
    const fadeIn = Math.min(1, banner.t / 0.3);
    const fadeOut = Math.min(1, (3.2 - banner.t) / 0.3);
    const a = Math.min(fadeIn, fadeOut);
    ctx.save();
    ctx.globalAlpha = a * 0.85;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, H / 2 - 36, W, 60);
    ctx.globalAlpha = a;
    ctx.fillStyle = '#ff3aa0';
    ctx.shadowColor = '#ff3aa0'; ctx.shadowBlur = 14;
    ctx.font = 'bold 22px Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(banner.text, W / 2, H / 2 - 8);
    ctx.fillStyle = '#7af0ff';
    ctx.shadowColor = '#7af0ff';
    ctx.font = 'bold 12px Consolas, monospace';
    ctx.fillText(banner.sub, W / 2, H / 2 + 14);
    ctx.restore();
  }

  function getTime() { return t; }
  function done() { return fired >= events.length; }

  return { reset, update, drawBanner, getTime, done };
})();
