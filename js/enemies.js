// Enemies — pool + types
const Enemies = (() => {
  const POOL = 80;
  const es = [];
  for (let i = 0; i < POOL; i++) es.push({ alive: false });

  function alloc() {
    for (let i = 0; i < POOL; i++) if (!es[i].alive) return es[i];
    return null;
  }

  // Common AI updates registered per type
  const TYPES = {
    drone: {
      hp: 1, score: 80, r: 12,
      color: '#ff5a8a',
      init(e, opts) {
        e.vx = -130;
        e.amp = opts.amp ?? 40;
        e.freq = opts.freq ?? 2.4;
        e.baseY = opts.y;
        e.t = 0;
        e.firePeriod = 1.4;
        e.fireT = 0.6 + Math.random() * 0.6;
      },
      update(e, dt) {
        e.t += dt;
        e.y = e.baseY + Math.sin(e.t * e.freq) * e.amp;
        e.x += e.vx * dt;
        e.fireT -= dt;
        if (e.fireT <= 0 && e.x < 760 && e.x > 50) {
          fireAtPlayer(e, 220, '#ff7aa0', 4);
          e.fireT = e.firePeriod;
        }
      },
      draw(e, ctx) {
        ctx.save();
        ctx.translate(e.x, e.y);
        ctx.fillStyle = '#ff5a8a';
        ctx.shadowColor = '#ff5a8a'; ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(-12, 0);
        ctx.lineTo(-4, -8);
        ctx.lineTo(10, 0);
        ctx.lineTo(-4, 8);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#ffe45a';
        ctx.shadowBlur = 4;
        ctx.fillRect(-2, -2, 6, 4);
        ctx.restore();
      }
    },
    sniper: {
      hp: 2, score: 140, r: 14,
      color: '#9b6dff',
      init(e, opts) {
        e.vx = -60;
        e.t = 0;
        e.fireT = 1.4 + Math.random() * 0.8;
        e.firing = false;
      },
      update(e, dt) {
        e.t += dt;
        e.x += e.vx * dt;
        e.y += Math.sin(e.t * 0.6) * 12 * dt;
        e.fireT -= dt;
        if (e.fireT <= 0 && e.x < 720) {
          // 3-shot spread
          for (let k = -1; k <= 1; k++) {
            const ang = Math.atan2(Player.y - e.y, Player.x - e.x) + k * 0.2;
            const sp = 280;
            Bullets.spawn({
              x: e.x, y: e.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
              type: 'eshot', r: 5, color: '#c8a0ff', life: 4,
            });
          }
          Audio.SFX.enemyShot();
          e.fireT = 2.2;
        }
      },
      draw(e, ctx) {
        ctx.save();
        ctx.translate(e.x, e.y);
        ctx.fillStyle = '#7a4adb';
        ctx.shadowColor = '#9b6dff'; ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, Math.PI * 2);
        ctx.fill();
        // eye
        ctx.fillStyle = '#ffe45a';
        ctx.shadowBlur = 8;
        const eyeX = Math.cos(performance.now() * 0.005) * 3;
        const eyeY = Math.sin(performance.now() * 0.005) * 3;
        ctx.beginPath();
        ctx.arc(eyeX, eyeY, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    },
    turret: {
      hp: 4, score: 200, r: 14,
      color: '#8ad8ff',
      init(e, opts) {
        e.vx = -80;
        e.fixedTop = opts.top ?? true;
        e.fireT = 1.2;
        e.t = 0;
      },
      update(e, dt) {
        e.x += e.vx * dt;
        // stick to terrain
        const c = Background.collideY(e.x);
        if (e.fixedTop) e.y = c.top + 14;
        else e.y = c.bottom - 14;
        e.fireT -= dt;
        e.t += dt;
        if (e.fireT <= 0 && e.x < 760 && e.x > 60) {
          const ang = Math.atan2(Player.y - e.y, Player.x - e.x);
          const sp = 260;
          Bullets.spawn({
            x: e.x, y: e.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
            type: 'eshot', r: 5, color: '#7af0ff', life: 4,
          });
          Audio.SFX.enemyShot();
          e.fireT = 1.5;
        }
      },
      draw(e, ctx) {
        ctx.save();
        ctx.translate(e.x, e.y);
        ctx.fillStyle = '#447aa0';
        ctx.fillRect(-10, -8, 20, 16);
        ctx.fillStyle = '#8ad8ff';
        ctx.shadowColor = '#8ad8ff'; ctx.shadowBlur = 8;
        // cannon
        const ang = Math.atan2(Player.y - e.y, Player.x - e.x);
        ctx.rotate(ang);
        ctx.fillRect(0, -2, 14, 4);
        ctx.restore();
      }
    },
    kamikaze: {
      hp: 1, score: 110, r: 10,
      color: '#ff8a3a',
      init(e, opts) {
        e.vx = -180;
        e.t = 0;
        e.lockedY = false;
      },
      update(e, dt) {
        e.t += dt;
        if (e.x < 720 && !e.lockedY) {
          // aim at player
          const dy = Player.y - e.y;
          e.vy = Math.sign(dy) * Math.min(260, Math.abs(dy) * 4);
          if (Math.abs(dy) < 6) e.lockedY = true;
        }
        e.vx -= 60 * dt;  // accelerate forward
        e.vx = Math.max(e.vx, -480);
        e.x += e.vx * dt;
        e.y += (e.vy || 0) * dt;
        if (Math.random() < 0.5) {
          Particles.trail(e.x + 8, e.y, e.vx, e.vy || 0, '#ffaa3a');
        }
      },
      draw(e, ctx) {
        ctx.save();
        ctx.translate(e.x, e.y);
        ctx.fillStyle = '#ff8a3a';
        ctx.shadowColor = '#ff8a3a'; ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.moveTo(-10, -7);
        ctx.lineTo(10, 0);
        ctx.lineTo(-10, 7);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#ffe45a';
        ctx.shadowBlur = 0;
        ctx.fillRect(-6, -2, 6, 4);
        ctx.restore();
      }
    },
    asteroid: {
      hp: 3, score: 60, r: 18,
      color: '#aa8866',
      init(e, opts) {
        e.vx = -90 - Math.random() * 50;
        e.vy = (Math.random() - 0.5) * 30;
        e.rot = Math.random() * Math.PI * 2;
        e.rotSpeed = (Math.random() - 0.5) * 2;
      },
      update(e, dt) {
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        e.rot += e.rotSpeed * dt;
      },
      draw(e, ctx) {
        ctx.save();
        ctx.translate(e.x, e.y);
        ctx.rotate(e.rot);
        ctx.fillStyle = '#866a4a';
        ctx.strokeStyle = '#c8a880';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        const sides = 7;
        for (let i = 0; i < sides; i++) {
          const a = (i / sides) * Math.PI * 2;
          const r = 14 + Math.sin(i * 1.7) * 4;
          const x = Math.cos(a) * r;
          const y = Math.sin(a) * r;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // craters
        ctx.fillStyle = '#5a4838';
        ctx.beginPath(); ctx.arc(-3, -2, 3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(4, 3, 2, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    },
    swooper: {
      hp: 2, score: 130, r: 11,
      color: '#6dff8e',
      init(e, opts) {
        e.vx = -160;
        e.t = Math.random() * 3;
        e.baseY = opts.y;
        e.amp = 90;
      },
      update(e, dt) {
        e.t += dt;
        e.x += e.vx * dt;
        e.y = e.baseY + Math.sin(e.t * 3.4) * e.amp;
      },
      draw(e, ctx) {
        ctx.save();
        ctx.translate(e.x, e.y);
        ctx.fillStyle = '#6dff8e';
        ctx.shadowColor = '#6dff8e'; ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(-8, -6);
        ctx.lineTo(-4, 0);
        ctx.lineTo(-8, 6);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(2, -1, 4, 2);
        ctx.restore();
      }
    },
    powerup: {
      hp: 99, score: 0, r: 12,
      color: '#ffe45a',
      isPowerup: true,
      init(e, opts) {
        e.vx = -90;
        e.t = 0;
        e.kind = opts.kind ?? 'pod';
      },
      update(e, dt) {
        e.t += dt;
        e.x += e.vx * dt;
        e.y += Math.sin(e.t * 3) * 14 * dt;
      },
      draw(e, ctx) {
        ctx.save();
        ctx.translate(e.x, e.y);
        ctx.rotate(e.t * 2);
        ctx.fillStyle = '#ffe45a';
        ctx.shadowColor = '#ffe45a'; ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.moveTo(0, -10);
        ctx.lineTo(10, 0);
        ctx.lineTo(0, 10);
        ctx.lineTo(-10, 0);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 4;
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(e.kind === 'bomb' ? 'B' : 'P', 0, 0);
        ctx.restore();
      },
      onCollect(e) {
        if (e.kind === 'bomb') {
          Player.state.bombs = Math.min(5, Player.state.bombs + 1);
        } else {
          Player.state.pod.hasPod = true;
        }
        Audio.SFX.powerup();
        FX.flash('#ffe45a', 0.3);
      }
    },
    midboss: {
      hp: 60, score: 1500, r: 38,
      color: '#ff3a3a',
      init(e, opts) {
        e.vx = -50;
        e.t = 0;
        e.fireT = 1.5;
        e.entering = true;
        e.targetX = 580;
        e.baseY = 225;
        e.turrets = [
          { offsetY: -36, alive: true, hp: 12, fireT: 0.8 },
          { offsetY: 0,   alive: true, hp: 18, fireT: 1.2 },
          { offsetY: 36,  alive: true, hp: 12, fireT: 1.6 },
        ];
      },
      update(e, dt) {
        e.t += dt;
        if (e.entering) {
          e.x += e.vx * dt;
          if (e.x <= e.targetX) { e.entering = false; e.vx = 0; }
        }
        e.y = e.baseY + Math.sin(e.t * 0.8) * 50;

        // turrets fire
        for (const t of e.turrets) {
          if (!t.alive) continue;
          t.fireT -= dt;
          if (t.fireT <= 0) {
            const tx = e.x - 30;
            const ty = e.y + t.offsetY;
            const ang = Math.atan2(Player.y - ty, Player.x - tx);
            const sp = 260;
            Bullets.spawn({
              x: tx, y: ty, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
              type: 'eshot', r: 5, color: '#ff7a7a', life: 4,
            });
            Audio.SFX.enemyShot();
            t.fireT = 1.3 + Math.random() * 0.4;
          }
        }
        // if all turrets dead, mark midboss as dead
        if (e.turrets.every(t => !t.alive)) {
          e.hp = 0;
        }
      },
      onSubHit(e, x, y, dmg) {
        // route damage to nearest alive turret if close, else hull
        let best = null, bestD = 30 * 30;
        for (const t of e.turrets) {
          if (!t.alive) continue;
          const tx = e.x - 22;
          const ty = e.y + t.offsetY;
          const d2 = (x - tx) * (x - tx) + (y - ty) * (y - ty);
          if (d2 < bestD) { bestD = d2; best = t; }
        }
        if (best) {
          best.hp -= dmg;
          if (best.hp <= 0) {
            best.alive = false;
            Particles.explosion(e.x - 22, e.y + best.offsetY, { count: 22, color: '#ffaa3a' });
            FX.shake(10);
            Audio.SFX.explodeBig();
          }
          return true;
        }
        return false;
      },
      draw(e, ctx) {
        ctx.save();
        ctx.translate(e.x, e.y);
        // hull
        ctx.fillStyle = '#5a1a30';
        ctx.strokeStyle = '#ff3a3a';
        ctx.shadowColor = '#ff3a3a'; ctx.shadowBlur = 14;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(40, 0);
        ctx.lineTo(20, -50);
        ctx.lineTo(-30, -55);
        ctx.lineTo(-40, -20);
        ctx.lineTo(-40, 20);
        ctx.lineTo(-30, 55);
        ctx.lineTo(20, 50);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // turrets
        ctx.shadowBlur = 8;
        for (const t of e.turrets) {
          if (!t.alive) continue;
          ctx.fillStyle = '#ff3a3a';
          ctx.beginPath();
          ctx.arc(-22, t.offsetY, 10, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#ffe45a';
          ctx.fillRect(-32, t.offsetY - 2, 8, 4);
        }
        // cockpit
        ctx.shadowBlur = 4;
        ctx.fillStyle = '#ffaa3a';
        ctx.beginPath();
        ctx.arc(10, 0, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    },
  };

  function spawn(type, opts = {}) {
    const def = TYPES[type];
    if (!def) return null;
    const e = alloc();
    if (!e) return null;
    e.alive = true;
    e.type = type;
    e.def = def;
    e.x = opts.x ?? 820;
    e.y = opts.y ?? 225;
    e.vx = 0; e.vy = 0;
    e.hp = def.hp;
    e.maxHp = def.hp;
    e.r = def.r;
    e.flash = 0;
    e.score = def.score;
    e.isPowerup = def.isPowerup ?? false;
    def.init(e, opts);
    return e;
  }

  function fireAtPlayer(e, sp, color, r) {
    const ang = Math.atan2(Player.y - e.y, Player.x - e.x);
    Bullets.spawn({
      x: e.x, y: e.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
      type: 'eshot', r: r ?? 4, color: color ?? '#ff7aa0', life: 4,
    });
    Audio.SFX.enemyShot();
  }

  function damage(e, dmg, hitX, hitY) {
    if (e.def.onSubHit && e.def.onSubHit(e, hitX, hitY, dmg)) {
      e.flash = 0.08;
      return;
    }
    e.hp -= dmg;
    e.flash = 0.08;
    if (e.hp <= 0) {
      kill(e);
    } else {
      Audio.SFX.hitSmall();
    }
  }

  function kill(e) {
    e.alive = false;
    if (e.isPowerup) return;
    Particles.explosion(e.x, e.y, {
      count: e.def.r > 25 ? 50 : 20,
      color: e.def.color,
      innerColor: '#ffffff',
      shockSize: e.def.r * 3,
      speed: 180 + e.def.r * 4,
    });
    if (e.def.r > 25) {
      Audio.SFX.explodeBig();
      FX.shake(14); FX.hitstop(80); FX.flash('#ffffff', 0.4);
    } else {
      Audio.SFX.explodeSmall();
      FX.shake(3 + e.def.r * 0.2); FX.hitstop(40);
    }
    Player.addScore(e.score);
  }

  function bombHit() {
    for (let i = 0; i < POOL; i++) {
      const e = es[i];
      if (!e.alive || e.isPowerup) continue;
      damage(e, 6, e.x, e.y);
    }
    if (window.Boss) Boss.damage(20);
  }

  function update(dt) {
    for (let i = 0; i < POOL; i++) {
      const e = es[i];
      if (!e.alive) continue;
      e.flash = Math.max(0, e.flash - dt);
      e.def.update(e, dt);
      if (e.x < -60) e.alive = false;
    }
    // Bullet collisions vs enemies
    const bs = Bullets.all();
    for (let i = 0; i < POOL; i++) {
      const e = es[i];
      if (!e.alive) continue;
      if (e.isPowerup) {
        // collect by player
        if (Player.alive) {
          const dx = e.x - Player.x, dy = e.y - Player.y;
          if (dx * dx + dy * dy < (e.r + 14) * (e.r + 14)) {
            e.def.onCollect(e);
            e.alive = false;
          }
        }
        continue;
      }
      for (let j = 0; j < bs.length; j++) {
        const b = bs[j];
        if (!b.alive || !b.friendly) continue;
        const dx = b.x - e.x, dy = b.y - e.y;
        const rs = (b.r + e.r);
        if (dx * dx + dy * dy < rs * rs) {
          if (b.piercing) {
            // limit beam hit frequency
            const now = performance.now();
            if (b.hitCooldownTo && now < b.hitCooldownTo) continue;
            b.hitCooldownTo = now + 90;
          }
          damage(e, b.damage, b.x, b.y);
          Particles.spark(b.x, b.y, { color: '#ffffff', count: 4, life: 0.2 });
          if (!b.piercing) {
            b.alive = false;
            break;
          }
        }
      }
      // collide with player body
      if (e.alive && Player.alive && Player.state.invul <= 0) {
        const dx = e.x - Player.x, dy = e.y - Player.y;
        const rs = e.r + Player.state.r;
        if (dx * dx + dy * dy < rs * rs) {
          Player.takeHit();
          damage(e, 3, e.x, e.y);
        }
      }
    }
  }

  function draw(ctx) {
    for (let i = 0; i < POOL; i++) {
      const e = es[i];
      if (!e.alive) continue;
      ctx.save();
      if (e.flash > 0) {
        ctx.globalCompositeOperation = 'lighter';
      }
      e.def.draw(e, ctx);
      ctx.restore();
    }
  }

  function activeCount(excludePowerups = true) {
    let n = 0;
    for (let i = 0; i < POOL; i++) {
      if (es[i].alive && (!excludePowerups || !es[i].isPowerup)) n++;
    }
    return n;
  }

  function reset() {
    for (let i = 0; i < POOL; i++) es[i].alive = false;
  }

  return { spawn, update, draw, damage, kill, bombHit, activeCount, reset, all: () => es };
})();
