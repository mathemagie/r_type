// Player ship — movement, shooting, beam charge, Force Pod
const Player = (() => {
  const W = 800, H = 450;

  const p = {
    x: 120, y: 225,
    vx: 0, vy: 0,
    r: 8,                 // hitbox (small for fairness)
    visualW: 28, visualH: 16,
    alive: true,
    invul: 0,
    spawnFlash: 0,
    speed: 260,
    accel: 1800,
    drag: 0.82,

    fireCooldown: 0,
    fireInterval: 0.11,

    missileT: 0,
    missileInterval: 0.7,   // auto-firing homing missiles (secondary weapon)

    chargeHeld: false,
    chargeTime: 0,
    chargeStartedShootingAt: 0,

    pod: {
      mode: 'attached',   // 'attached' | 'detached' | 'returning'
      x: 0, y: 0,
      vx: 0, vy: 0,
      attachOffset: 26,    // forward
      fireCooldown: 0,
      hasPod: true,        // pod is available from the start (modern flow)
      angle: 0,
    },

    lives: 3,
    bombs: 2,
    bombCooldown: 0,
    bombActive: 0,
    score: 0,
    combo: 0,
    comboTimer: 0,
    grazeFlashes: 0,
    multGain: 0,
  };

  function reset() {
    p.x = 120; p.y = 225; p.vx = 0; p.vy = 0;
    p.alive = true; p.invul = 2;
    p.fireCooldown = 0; p.chargeHeld = false; p.chargeTime = 0;
    p.missileT = 0;
    p.pod.mode = 'attached';
    p.pod.x = p.x + p.pod.attachOffset; p.pod.y = p.y;
    p.pod.fireCooldown = 0;
    p.lives = 3; p.bombs = 2; p.bombCooldown = 0; p.bombActive = 0;
    p.score = 0; p.combo = 0; p.comboTimer = 0;
  }

  function respawn() {
    p.x = 120; p.y = 225; p.vx = 0; p.vy = 0;
    p.alive = true; p.invul = 2; p.spawnFlash = 0.4;
    p.combo = Math.floor(p.combo * 0.5);
    p.pod.mode = 'attached';
    p.pod.x = p.x + p.pod.attachOffset; p.pod.y = p.y;
  }

  function addScore(n) {
    const mult = 1 + Math.min(7, Math.floor(p.combo / 4));
    p.score += n * mult;
    p.combo++;
    p.comboTimer = 2.5;
    p.multGain = 0.4;
  }

  function takeHit() {
    if (p.invul > 0) return false;
    p.lives--;
    p.alive = false;
    Particles.explosion(p.x, p.y, { count: 36, speed: 240, color: '#ff5555', innerColor: '#ffffff', shockSize: 80 });
    FX.shake(18); FX.flash('#ff3030', 0.7); FX.hitstop(140);
    Audio.SFX.playerHit();
    if (p.lives > 0) {
      setTimeout(() => respawn(), 1200);
    }
    return true;
  }

  function fireBomb() {
    if (p.bombs <= 0 || p.bombCooldown > 0) return;
    p.bombs--;
    p.bombCooldown = 0.6;
    p.bombActive = 0.6;
    Audio.SFX.bomb();
    FX.shake(20); FX.flash('#ffffff', 0.9); FX.hitstop(80);
    Bullets.clearEnemyBullets();
    Enemies.bombHit();
    Particles.explosion(p.x, p.y, { count: 60, speed: 320, color: '#aaddff', innerColor: '#ffffff', shockSize: 220, shockColor: '#aaddff' });
  }

  function update(dt) {
    p.comboTimer -= dt;
    if (p.comboTimer <= 0) { p.combo = 0; p.comboTimer = 0; }
    p.multGain = Math.max(0, p.multGain - dt);
    p.bombCooldown = Math.max(0, p.bombCooldown - dt);
    p.bombActive = Math.max(0, p.bombActive - dt);
    p.invul = Math.max(0, p.invul - dt);
    p.spawnFlash = Math.max(0, p.spawnFlash - dt);
    p.grazeFlashes = Math.max(0, p.grazeFlashes - dt);

    if (!p.alive) return;

    // Movement
    const axis = Input.axis();
    p.vx += axis.x * p.accel * dt;
    p.vy += axis.y * p.accel * dt;
    p.vx *= Math.pow(p.drag, dt * 60);
    p.vy *= Math.pow(p.drag, dt * 60);

    // Clamp by speed cap
    const sp = Math.hypot(p.vx, p.vy);
    if (sp > p.speed) { p.vx = p.vx / sp * p.speed; p.vy = p.vy / sp * p.speed; }

    p.x += p.vx * dt;
    p.y += p.vy * dt;

    // Bounds
    if (p.x < 16) { p.x = 16; p.vx = 0; }
    if (p.x > W - 16) { p.x = W - 16; p.vx = 0; }
    if (p.y < 16) { p.y = 16; p.vy = 0; }
    if (p.y > H - 16) { p.y = H - 16; p.vy = 0; }

    // Collide with terrain
    const c = Background.collideY(p.x);
    if (p.y - p.r < c.top + 2) { p.y = c.top + 2 + p.r; p.vy = Math.max(0, p.vy); }
    if (p.y + p.r > c.bottom - 2) { p.y = c.bottom - 2 - p.r; p.vy = Math.min(0, p.vy); }

    // Fire / charge
    p.fireCooldown -= dt;
    if (Input.isDown('fire')) {
      if (!p.chargeHeld) { p.chargeHeld = true; p.chargeTime = 0; }
      p.chargeTime += dt;
      // Tap-fire while charging (R-Type lets you rapid fire AND charge)
      if (p.fireCooldown <= 0) {
        spawnPShot();
        p.fireCooldown = p.fireInterval;
      }
    }
    if (Input.wasReleased('fire')) {
      if (p.chargeTime >= 1.0) {
        fireBeam(p.chargeTime);
      }
      p.chargeHeld = false;
      p.chargeTime = 0;
    }

    if (Input.wasPressed('bomb')) fireBomb();
    if (Input.wasPressed('pod')) togglePod();

    // Auto-firing homing missiles (passive secondary weapon)
    p.missileT -= dt;
    if (p.missileT <= 0) { spawnMissiles(); p.missileT = p.missileInterval; }

    updatePod(dt);
  }

  function spawnMissiles() {
    for (const wy of [-10, 10]) {
      Bullets.spawn({
        x: p.x - 4, y: p.y + wy,
        vx: 360, vy: wy * 15,        // arc outward from the wings, then home
        type: 'pmissile', r: 5, damage: 2, color: '#8dff6a',
        friendly: true, homing: 7, life: 2.0,
      });
    }
    Audio.SFX.missile();
  }

  function spawnPShot() {
    Bullets.spawn({
      x: p.x + 18, y: p.y - 2, vx: 680, vy: 0,
      type: 'pshot', r: 4, damage: 1, color: '#ffe45a', friendly: true, life: 1.4,
    });
    Bullets.spawn({
      x: p.x + 18, y: p.y + 2, vx: 680, vy: 0,
      type: 'pshot', r: 4, damage: 1, color: '#ffe45a', friendly: true, life: 1.4,
    });
    if (p.pod.mode === 'attached') {
      // pod fires aligned shot
      Bullets.spawn({
        x: p.pod.x + 12, y: p.pod.y, vx: 700, vy: 0,
        type: 'pshot', r: 4, damage: 1, color: '#7af0ff', friendly: true, life: 1.4,
      });
    }
    Audio.SFX.shoot();
  }

  function fireBeam(chargeT) {
    const level = Math.min(3, Math.floor(chargeT / 0.9));
    const dmg = [3, 6, 10][level];
    const w = [12, 18, 28][level];
    Bullets.spawn({
      x: p.x + 24, y: p.y, vx: 900, vy: 0,
      type: 'pbeam', r: w / 2, damage: dmg, color: '#ff3aa0', friendly: true,
      piercing: true, life: 1.2,
    });
    if (p.pod.mode === 'attached') {
      Bullets.spawn({
        x: p.pod.x + 24, y: p.pod.y, vx: 900, vy: 0,
        type: 'pbeam', r: w / 2, damage: dmg, color: '#00e1ff', friendly: true,
        piercing: true, life: 1.2,
      });
    }
    FX.shake(4 + level * 2);
    Audio.SFX.beamFire();
  }

  function togglePod() {
    if (!p.pod.hasPod) return;
    if (p.pod.mode === 'attached') {
      // Launch forward
      p.pod.mode = 'detached';
      p.pod.vx = 380;
      p.pod.vy = 0;
      Audio.SFX.podDeploy();
    } else {
      p.pod.mode = 'returning';
      Audio.SFX.podReturn();
    }
  }

  function updatePod(dt) {
    if (!p.pod.hasPod) return;
    p.pod.fireCooldown -= dt;

    if (p.pod.mode === 'attached') {
      p.pod.x += (p.x + p.pod.attachOffset - p.pod.x) * 0.4;
      p.pod.y += (p.y - p.pod.y) * 0.4;
    } else if (p.pod.mode === 'detached') {
      p.pod.x += p.pod.vx * dt;
      p.pod.vx *= 0.96;
      // pod follows the player's vertical position softly when in front
      const ty = p.y;
      p.pod.y += (ty - p.pod.y) * 1.2 * dt;
      if (p.pod.x > 760 || p.pod.x < 40) {
        p.pod.vx *= -0.6;
      }
      // Pod auto-fires
      if (p.pod.fireCooldown <= 0) {
        Bullets.spawn({
          x: p.pod.x + 12, y: p.pod.y, vx: 700, vy: 0,
          type: 'pshot', r: 4, damage: 1, color: '#7af0ff', friendly: true, life: 1.4,
        });
        p.pod.fireCooldown = 0.16;
      }
    } else if (p.pod.mode === 'returning') {
      const dx = p.x + p.pod.attachOffset - p.pod.x;
      const dy = p.y - p.pod.y;
      const d = Math.hypot(dx, dy);
      if (d < 6) {
        p.pod.mode = 'attached';
      } else {
        p.pod.x += dx / d * 500 * dt;
        p.pod.y += dy / d * 500 * dt;
      }
    }
    p.pod.angle += dt * 8;
  }

  // Bullet collisions against player
  function checkBulletCollisions() {
    if (!p.alive) return;
    const bs = Bullets.all();
    for (let i = 0; i < bs.length; i++) {
      const b = bs[i];
      if (!b.alive || b.friendly) continue;
      const dx = b.x - p.x, dy = b.y - p.y;
      const d2 = dx * dx + dy * dy;
      const rs = (p.r + b.r);
      // Pod absorbs bullets that touch it
      if (p.pod.hasPod) {
        const pdx = b.x - p.pod.x, pdy = b.y - p.pod.y;
        if (pdx * pdx + pdy * pdy < 100) {
          b.alive = false;
          Particles.spark(b.x, b.y, { color: '#7af0ff', count: 4, life: 0.3 });
          Audio.SFX.hitSmall();
          continue;
        }
      }
      if (d2 < rs * rs) {
        if (takeHit()) return;
      } else if (d2 < (p.r + 14) * (p.r + 14) && p.invul <= 0) {
        // graze
        if (!b.grazed) {
          b.grazed = true;
          p.combo++;
          p.comboTimer = 2.5;
          p.grazeFlashes = 0.25;
          FX.slowmo(180);
          Audio.SFX.graze();
        }
      }
    }
  }

  function drawShip(ctx, x, y) {
    ctx.save();
    ctx.translate(x, y);
    // engine flame
    const flame = 6 + Math.sin(performance.now() * 0.03) * 2;
    ctx.fillStyle = '#ffaa3a';
    ctx.shadowColor = '#ffaa3a';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(-14, -3);
    ctx.lineTo(-14 - flame, 0);
    ctx.lineTo(-14, 3);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffe45a';
    ctx.beginPath();
    ctx.moveTo(-14, -1.5);
    ctx.lineTo(-14 - flame * 0.6, 0);
    ctx.lineTo(-14, 1.5);
    ctx.closePath();
    ctx.fill();

    // hull body
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#cfe6f5';
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(-2, -7);
    ctx.lineTo(-14, -5);
    ctx.lineTo(-14, 5);
    ctx.lineTo(-2, 7);
    ctx.closePath();
    ctx.fill();
    // wings
    ctx.fillStyle = '#7a98b0';
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(-8, -12);
    ctx.lineTo(-12, -5);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, 7);
    ctx.lineTo(-8, 12);
    ctx.lineTo(-12, 5);
    ctx.closePath();
    ctx.fill();
    // cockpit
    ctx.fillStyle = '#ff3aa0';
    ctx.shadowColor = '#ff3aa0';
    ctx.shadowBlur = 6;
    ctx.fillRect(2, -2, 7, 4);
    ctx.shadowBlur = 0;
    // nose highlight
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(13, -1, 3, 2);
    ctx.restore();
  }

  function drawPod(ctx) {
    if (!p.pod.hasPod) return;
    const x = p.pod.x, y = p.pod.y;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(p.pod.angle);
    ctx.fillStyle = '#00e1ff';
    ctx.shadowColor = '#00e1ff';
    ctx.shadowBlur = 14;
    // diamond core
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(7, 0);
    ctx.lineTo(0, 7);
    ctx.lineTo(-7, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function draw(ctx) {
    if (!p.alive) {
      drawPod(ctx);
      return;
    }
    const flicker = p.invul > 0 && Math.floor(performance.now() / 60) % 2 === 0;
    if (flicker) {
      ctx.globalAlpha = 0.4;
    }
    if (p.spawnFlash > 0) {
      ctx.save();
      ctx.globalAlpha = p.spawnFlash * 2;
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#ffffff'; ctx.shadowBlur = 30;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    drawShip(ctx, p.x, p.y);
    ctx.globalAlpha = 1;

    drawPod(ctx);

    // charge indicator
    if (p.chargeHeld && p.chargeTime > 0.3) {
      const ratio = Math.min(3, p.chargeTime / 0.9) / 3;
      ctx.save();
      ctx.translate(p.x, p.y + 18);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(-16, -2, 32, 4);
      const level = Math.min(3, Math.floor(p.chargeTime / 0.9));
      const colors = ['#7af0ff', '#ffe45a', '#ff8a3a', '#ff3aa0'];
      ctx.fillStyle = colors[level];
      ctx.shadowColor = colors[level]; ctx.shadowBlur = 10;
      ctx.fillRect(-16, -2, 32 * ratio, 4);
      ctx.restore();
      // halo around ship
      const haloA = 0.15 + Math.sin(performance.now() * 0.02) * 0.1;
      ctx.save();
      ctx.globalAlpha = haloA;
      ctx.strokeStyle = colors[level];
      ctx.shadowColor = colors[level]; ctx.shadowBlur = 16;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 18 + ratio * 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  return {
    state: p,
    reset, respawn, update, draw,
    checkBulletCollisions, addScore, takeHit,
    fireBomb,
    get x() { return p.x; },
    get y() { return p.y; },
    get alive() { return p.alive; },
  };
})();
