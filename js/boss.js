// Final boss — 3 phases
const Boss = (() => {
  let b = null;
  let active = false;

  function start() {
    b = {
      x: 900, y: 225,
      vx: 0, vy: 0,
      maxHp: 360,
      hp: 360,
      phase: 1,
      r: 56,
      t: 0,
      enterDone: false,
      fireT1: 1.0,
      fireT2: 0.4,
      laserChargeT: 0,
      laserActive: 0,
      laserAngle: 0,
      spawnT: 0,
      chargeT: 0,
      chargeDirX: 0,
      chargeDirY: 0,
      eyeAngle: 0,
      flash: 0,
      dyingT: 0,
    };
    active = true;
    Audio.SFX.bossWarn();
  }

  function damage(d) {
    if (!active || !b || b.hp <= 0) return;
    b.hp -= d;
    b.flash = 0.06;
    FX.hitstop(40);
    if (b.hp <= 0) {
      die();
    }
  }

  function die() {
    b.dyingT = 2.5;
    FX.shake(28); FX.flash('#ffffff', 0.9); FX.hitstop(200);
    Audio.SFX.explodeBig();
    Player.addScore(8000);
  }

  function update(dt) {
    if (!active || !b) return;
    b.t += dt;
    b.flash = Math.max(0, b.flash - dt);
    b.eyeAngle += dt * 1.4;

    if (b.dyingT > 0) {
      b.dyingT -= dt;
      // chain of explosions
      if (Math.random() < 12 * dt) {
        const ex = b.x + (Math.random() - 0.5) * 90;
        const ey = b.y + (Math.random() - 0.5) * 90;
        Particles.explosion(ex, ey, { count: 22, color: '#ffaa3a', shockSize: 60 });
        FX.shake(8);
        Audio.SFX.explodeSmall();
      }
      if (b.dyingT <= 0) {
        Particles.explosion(b.x, b.y, { count: 80, speed: 360, color: '#ffe45a', innerColor: '#ffffff', shockSize: 240 });
        FX.shake(40); FX.flash('#ffffff', 1.0); FX.hitstop(300);
        active = false;
        Game.win();
      }
      return;
    }

    if (!b.enterDone) {
      const dx = 640 - b.x;
      b.x += Math.sign(dx) * Math.min(Math.abs(dx), 140 * dt);
      if (Math.abs(dx) < 4) { b.x = 640; b.enterDone = true; }
      return;
    }

    // phase transitions
    const ratio = b.hp / b.maxHp;
    const phase = ratio > 0.66 ? 1 : (ratio > 0.33 ? 2 : 3);
    if (phase !== b.phase) {
      b.phase = phase;
      FX.flash('#ff3aa0', 0.5);
      FX.shake(14);
      Audio.SFX.bossWarn();
    }

    // movement
    if (b.phase === 1) {
      b.y = 225 + Math.sin(b.t * 0.8) * 80;
    } else if (b.phase === 2) {
      b.y = 225 + Math.sin(b.t * 1.2) * 100;
      b.x = 640 + Math.sin(b.t * 0.6) * 30;
    } else {
      // phase 3 enrage: occasional charges
      if (b.chargeT <= 0) {
        b.y += Math.sin(b.t * 1.5) * 1.6;
        b.x += Math.sin(b.t * 0.8) * 1.0;
        if (Math.random() < 0.3 * dt) {
          // charge towards player
          const dx = Player.x - b.x, dy = Player.y - b.y;
          const d = Math.hypot(dx, dy);
          b.chargeDirX = dx / d;
          b.chargeDirY = dy / d;
          b.chargeT = 0.9;
          FX.flash('#ff0000', 0.25);
        }
      } else {
        b.chargeT -= dt;
        b.x += b.chargeDirX * 320 * dt;
        b.y += b.chargeDirY * 320 * dt;
        if (b.chargeT <= 0) {
          // bounce back to default
          b.chargeDirX = 0; b.chargeDirY = 0;
        }
      }
      // clamp
      b.x = Math.max(380, Math.min(740, b.x));
      b.y = Math.max(70, Math.min(380, b.y));
    }

    // Firing
    fireRoutine(dt);

    // Body collide with player
    if (Player.alive && Player.state.invul <= 0) {
      const dx = Player.x - b.x, dy = Player.y - b.y;
      if (dx * dx + dy * dy < (b.r + Player.state.r) * (b.r + Player.state.r)) {
        Player.takeHit();
      }
    }

    // Player bullet collisions
    const bs = Bullets.all();
    for (let i = 0; i < bs.length; i++) {
      const bb = bs[i];
      if (!bb.alive || !bb.friendly) continue;
      const dx = bb.x - b.x, dy = bb.y - b.y;
      const rs = b.r + bb.r;
      if (dx * dx + dy * dy < rs * rs) {
        if (bb.piercing) {
          const now = performance.now();
          if (bb.bossHitTo && now < bb.bossHitTo) continue;
          bb.bossHitTo = now + 90;
        }
        damage(bb.damage);
        Particles.spark(bb.x, bb.y, { color: '#ffffff', count: 6, life: 0.25 });
        if (!bb.piercing) bb.alive = false;
      }
    }
  }

  function fireRoutine(dt) {
    b.fireT1 -= dt;
    b.fireT2 -= dt;
    b.spawnT -= dt;

    if (b.phase === 1) {
      // Straight burst aimed at player every ~1.0s
      if (b.fireT1 <= 0) {
        for (let k = -1; k <= 1; k++) {
          const ang = Math.atan2(Player.y - b.y, Player.x - b.x) + k * 0.18;
          const sp = 280;
          Bullets.spawn({
            x: b.x - 30, y: b.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
            type: 'eshot', r: 6, color: '#ff7a7a', life: 4,
          });
        }
        Audio.SFX.enemyShot();
        b.fireT1 = 1.0;
      }
      // Telegraphed laser every ~3s
      if (b.laserChargeT <= 0 && b.laserActive <= 0 && Math.random() < dt * 0.5) {
        b.laserChargeT = 0.8;
        b.laserAngle = Math.atan2(Player.y - b.y, Player.x - b.x);
        Audio.SFX.beamCharge();
      }
      if (b.laserChargeT > 0) {
        b.laserChargeT -= dt;
        if (b.laserChargeT <= 0) {
          b.laserActive = 0.35;
          Audio.SFX.beamFire();
          FX.shake(8);
        }
      }
      if (b.laserActive > 0) {
        b.laserActive -= dt;
        // damage if player on the beam line
        const ang = b.laserAngle;
        const dx = Player.x - b.x, dy = Player.y - b.y;
        const projX = Math.cos(ang) * (dx * Math.cos(ang) + dy * Math.sin(ang));
        const projY = Math.sin(ang) * (dx * Math.cos(ang) + dy * Math.sin(ang));
        const perp = Math.hypot(dx - projX, dy - projY);
        if (Player.alive && perp < 8 && Player.state.invul <= 0 && (dx * Math.cos(ang) + dy * Math.sin(ang)) > 0) {
          Player.takeHit();
        }
      }
    } else if (b.phase === 2) {
      // Fan + 8-way spiral
      if (b.fireT1 <= 0) {
        for (let k = -3; k <= 3; k++) {
          const ang = Math.atan2(Player.y - b.y, Player.x - b.x) + k * 0.18;
          const sp = 240;
          Bullets.spawn({
            x: b.x - 30, y: b.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
            type: 'eshot', r: 5, color: '#ff7a7a', life: 4,
          });
        }
        Audio.SFX.enemyShot();
        b.fireT1 = 1.4;
      }
      if (b.fireT2 <= 0) {
        const baseAng = b.t * 1.6;
        for (let i = 0; i < 8; i++) {
          const ang = baseAng + (i / 8) * Math.PI * 2;
          const sp = 180;
          Bullets.spawn({
            x: b.x, y: b.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
            type: 'eblob', r: 6, color: '#ff3aa0', life: 5,
          });
        }
        b.fireT2 = 0.55;
      }
      if (b.spawnT <= 0) {
        Enemies.spawn('kamikaze', { x: b.x - 50, y: b.y - 60 });
        Enemies.spawn('kamikaze', { x: b.x - 50, y: b.y + 60 });
        b.spawnT = 5;
      }
    } else {
      // Phase 3 — enrage: homing + dense bursts
      if (b.fireT1 <= 0) {
        for (let k = -2; k <= 2; k++) {
          const ang = Math.atan2(Player.y - b.y, Player.x - b.x) + k * 0.12;
          const sp = 240;
          Bullets.spawn({
            x: b.x - 30, y: b.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
            type: 'eshot', r: 5, color: '#ff5555', life: 4,
          });
        }
        Audio.SFX.enemyShot();
        b.fireT1 = 0.7;
      }
      if (b.fireT2 <= 0) {
        // homing missiles
        for (let i = 0; i < 2; i++) {
          const ang = Math.atan2(Player.y - b.y, Player.x - b.x) + (i === 0 ? -0.6 : 0.6);
          const sp = 180;
          Bullets.spawn({
            x: b.x, y: b.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
            type: 'ehoming', r: 5, color: '#ff8a3a', life: 5,
            homing: 2.2,
          });
        }
        b.fireT2 = 1.5;
      }
    }
  }

  function draw(ctx) {
    if (!active || !b) return;
    if (b.dyingT > 0) {
      ctx.save();
      const flicker = Math.floor(performance.now() / 40) % 2 === 0;
      if (flicker) {
        ctx.globalCompositeOperation = 'lighter';
      }
      drawBody(ctx);
      ctx.restore();
      return;
    }

    // telegraph laser
    if (b.laserChargeT > 0) {
      ctx.save();
      const t = 1 - b.laserChargeT / 0.8;
      ctx.globalAlpha = 0.5 + Math.sin(performance.now() * 0.03) * 0.3 * t;
      ctx.strokeStyle = '#ff3aa0';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#ff3aa0'; ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x + Math.cos(b.laserAngle) * 900, b.y + Math.sin(b.laserAngle) * 900);
      ctx.stroke();
      ctx.restore();
    }
    if (b.laserActive > 0) {
      ctx.save();
      ctx.strokeStyle = '#ff3aa0';
      ctx.lineWidth = 14;
      ctx.shadowColor = '#ff3aa0'; ctx.shadowBlur = 24;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x + Math.cos(b.laserAngle) * 900, b.y + Math.sin(b.laserAngle) * 900);
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 5;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x + Math.cos(b.laserAngle) * 900, b.y + Math.sin(b.laserAngle) * 900);
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    if (b.flash > 0) {
      ctx.globalCompositeOperation = 'lighter';
    }
    drawBody(ctx);
    ctx.restore();

    // HP bar
    drawHpBar(ctx);
  }

  function drawBody(ctx) {
    ctx.save();
    ctx.translate(b.x, b.y);

    // outer ring spikes
    const spikeColor = b.phase === 1 ? '#ff3aa0' : (b.phase === 2 ? '#ff5555' : '#ff0040');
    ctx.fillStyle = spikeColor;
    ctx.shadowColor = spikeColor; ctx.shadowBlur = 18;
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2 + b.t * 0.6;
      const r1 = 44;
      const r2 = 62;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a - 0.12) * r1, Math.sin(a - 0.12) * r1);
      ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
      ctx.lineTo(Math.cos(a + 0.12) * r1, Math.sin(a + 0.12) * r1);
      ctx.closePath();
      ctx.fill();
    }

    // hull
    ctx.fillStyle = '#3a0820';
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(0, 0, 48, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ff3aa0';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#ff3aa0'; ctx.shadowBlur = 14;
    ctx.stroke();

    // inner core / eye
    const coreColor = b.phase === 3 ? '#ff0040' : '#ffe45a';
    ctx.fillStyle = coreColor;
    ctx.shadowColor = coreColor; ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.fill();

    // pupil tracks player
    const ang = Math.atan2(Player.y - b.y, Player.x - b.x);
    ctx.fillStyle = '#000000';
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(Math.cos(ang) * 8, Math.sin(ang) * 8, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(Math.cos(ang) * 8 - 2, Math.sin(ang) * 8 - 2, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // tendrils / cannons
    ctx.fillStyle = '#ff3aa0';
    ctx.shadowColor = '#ff3aa0'; ctx.shadowBlur = 8;
    for (let i = 0; i < 4; i++) {
      const aa = i / 4 * Math.PI * 2 + Math.PI / 4;
      ctx.save();
      ctx.rotate(aa);
      ctx.fillRect(40, -6, 18, 12);
      ctx.restore();
    }

    ctx.restore();
  }

  function drawHpBar(ctx) {
    ctx.save();
    const ratio = Math.max(0, b.hp / b.maxHp);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(80, 22, 640, 12);
    ctx.fillStyle = b.phase === 3 ? '#ff0040' : (b.phase === 2 ? '#ff5555' : '#ff3aa0');
    ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 10;
    ctx.fillRect(80, 22, 640 * ratio, 12);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(80, 22, 640, 12);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('BYDO PRIME — PHASE ' + b.phase, 80, 14);
    ctx.restore();
  }

  function isActive() { return active; }
  function isDefeated() { return active && b && b.hp <= 0 && b.dyingT <= 0; }
  function reset() { active = false; b = null; }

  return { start, update, draw, damage, isActive, isDefeated, reset };
})();
