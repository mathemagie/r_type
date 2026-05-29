// Bullet pool — player & enemy projectiles
const Bullets = (() => {
  const POOL = 600;
  const bs = [];
  for (let i = 0; i < POOL; i++) bs.push({ alive: false });

  // Sprite cache — pre-render glowing bullets to bitmaps to avoid shadowBlur on hot path
  const SPRITES = new Map();
  function makeSprite(key, w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const cx = c.getContext('2d');
    draw(cx);
    SPRITES.set(key, c);
    return c;
  }

  function getEShotSprite(color, r) {
    const key = 'eshot|' + color + '|' + r;
    if (SPRITES.has(key)) return SPRITES.get(key);
    const pad = 8;
    const size = (r + pad) * 2;
    return makeSprite(key, size, size, (cx) => {
      cx.translate(size / 2, size / 2);
      cx.fillStyle = color;
      cx.shadowColor = color; cx.shadowBlur = 10;
      cx.beginPath(); cx.arc(0, 0, r, 0, Math.PI * 2); cx.fill();
      cx.shadowBlur = 0;
      cx.fillStyle = '#ffffff';
      cx.beginPath(); cx.arc(-r * 0.3, -r * 0.3, r * 0.35, 0, Math.PI * 2); cx.fill();
    });
  }

  function getEBlobSprite(color, r) {
    const key = 'eblob|' + color + '|' + r;
    if (SPRITES.has(key)) return SPRITES.get(key);
    const pad = 10;
    const size = (r + pad) * 2;
    return makeSprite(key, size, size, (cx) => {
      cx.translate(size / 2, size / 2);
      cx.fillStyle = color;
      cx.shadowColor = color; cx.shadowBlur = 14;
      cx.beginPath(); cx.arc(0, 0, r, 0, Math.PI * 2); cx.fill();
      cx.shadowBlur = 0;
      cx.fillStyle = '#ffffff';
      cx.beginPath(); cx.arc(-r * 0.3, -r * 0.3, r * 0.4, 0, Math.PI * 2); cx.fill();
    });
  }

  function getEHomingSprite(color, r) {
    const key = 'ehoming|' + color + '|' + r;
    if (SPRITES.has(key)) return SPRITES.get(key);
    const pad = 10;
    const size = (r + pad) * 2;
    return makeSprite(key, size, size, (cx) => {
      cx.translate(size / 2, size / 2);
      cx.fillStyle = color;
      cx.shadowColor = color; cx.shadowBlur = 14;
      cx.beginPath(); cx.arc(0, 0, r, 0, Math.PI * 2); cx.fill();
      cx.shadowBlur = 0;
      cx.fillStyle = '#ffffff';
      cx.fillRect(-1, -1, 2, 2);
    });
  }

  function getPShotSprite(color) {
    const key = 'pshot|' + color;
    if (SPRITES.has(key)) return SPRITES.get(key);
    const w = 24, h = 14;
    return makeSprite(key, w, h, (cx) => {
      cx.translate(w / 2, h / 2);
      cx.fillStyle = color;
      cx.shadowColor = color; cx.shadowBlur = 8;
      cx.fillRect(-6, -1.5, 12, 3);
      cx.shadowBlur = 0;
      cx.fillStyle = '#ffffff';
      cx.fillRect(-4, -0.5, 8, 1);
    });
  }

  function getPBeamSprite(color) {
    const key = 'pbeam|' + color;
    if (SPRITES.has(key)) return SPRITES.get(key);
    const w = 40, h = 16;
    return makeSprite(key, w, h, (cx) => {
      cx.translate(w / 2, h / 2);
      cx.fillStyle = color;
      cx.shadowColor = color; cx.shadowBlur = 14;
      cx.fillRect(-14, -4, 28, 8);
      cx.shadowBlur = 0;
      cx.fillStyle = '#ffffff';
      cx.fillRect(-10, -1.5, 20, 3);
    });
  }

  function getPMissileSprite(color) {
    const key = 'pmissile|' + color;
    if (SPRITES.has(key)) return SPRITES.get(key);
    const w = 18, h = 10;
    return makeSprite(key, w, h, (cx) => {
      cx.translate(w / 2, h / 2);
      cx.fillStyle = color;
      cx.shadowColor = color; cx.shadowBlur = 8;
      cx.beginPath();
      cx.moveTo(7, 0);
      cx.lineTo(-2, -3);
      cx.lineTo(-5, -2);
      cx.lineTo(-5, 2);
      cx.lineTo(-2, 3);
      cx.closePath();
      cx.fill();
      cx.shadowBlur = 0;
      cx.fillStyle = '#ffffff';
      cx.fillRect(-1, -1, 5, 2);
    });
  }

  function alloc() {
    for (let i = 0; i < POOL; i++) if (!bs[i].alive) return bs[i];
    return null;
  }

  // Nearest live enemy ahead of (x,y) — homing target for friendly missiles
  function nearestEnemy(x, y) {
    if (typeof Enemies === 'undefined') return null;
    const es = Enemies.all();
    let best = null, bestD = Infinity;
    for (let i = 0; i < es.length; i++) {
      const e = es[i];
      if (!e.alive || e.isPowerup) continue;
      if (e.x < x - 30) continue; // prefer targets the missile is heading toward
      const dx = e.x - x, dy = e.y - y;
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = e; }
    }
    return best;
  }

  // type: 'pshot' = player simple shot, 'pbeam' = charged beam, 'eshot' = enemy basic,
  //       'eblob' = slow big enemy bullet, 'ehoming' = homing, 'elaser' = pre-warned laser segment
  function spawn(opts) {
    const b = alloc();
    if (!b) return null;
    b.alive = true;
    b.x = opts.x; b.y = opts.y;
    b.vx = opts.vx ?? 0; b.vy = opts.vy ?? 0;
    b.type = opts.type;
    b.r = opts.r ?? 3;
    b.damage = opts.damage ?? 1;
    b.life = opts.life ?? 3;
    b.color = opts.color ?? '#ffffff';
    b.friendly = opts.friendly ?? false;
    b.homing = opts.homing ?? 0; // turning rate rad/s
    b.target = opts.target ?? null;
    b.piercing = opts.piercing ?? false;
    b.hit = false;
    b.grazed = false;
    return b;
  }

  function update(dt, playerRef) {
    for (let i = 0; i < POOL; i++) {
      const b = bs[i];
      if (!b.alive) continue;
      b.life -= dt;
      if (b.life <= 0) { b.alive = false; continue; }

      if (b.homing > 0) {
        let tx, ty, hasTarget = false;
        if (b.friendly) {
          // Friendly missiles seek the nearest enemy, falling back to the boss
          const tgt = (b.target && b.target.alive && !b.target.isPowerup)
            ? b.target : nearestEnemy(b.x, b.y);
          if (tgt) { b.target = tgt; tx = tgt.x; ty = tgt.y; hasTarget = true; }
          else if (typeof Boss !== 'undefined' && Boss.isActive()) {
            const bp = Boss.target();
            if (bp) { tx = bp.x; ty = bp.y; hasTarget = true; }
          }
        } else if (playerRef && playerRef.alive) {
          tx = playerRef.x; ty = playerRef.y; hasTarget = true;
        }
        if (hasTarget) {
          const targetAng = Math.atan2(ty - b.y, tx - b.x);
          const curAng = Math.atan2(b.vy, b.vx);
          let diff = targetAng - curAng;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          const turn = Math.sign(diff) * Math.min(Math.abs(diff), b.homing * dt);
          const newAng = curAng + turn;
          const speed = Math.hypot(b.vx, b.vy);
          b.vx = Math.cos(newAng) * speed;
          b.vy = Math.sin(newAng) * speed;
        }
      }

      b.x += b.vx * dt;
      b.y += b.vy * dt;

      // off-screen
      if (b.x < -40 || b.x > 840 || b.y < -40 || b.y > 490) {
        b.alive = false;
      }

      // trail (sparse to avoid particle pool saturation)
      if (b.type === 'pbeam') {
        if (Math.random() < 0.35) Particles.trail(b.x, b.y, b.vx, b.vy, b.color);
      } else if (b.type === 'ehoming') {
        if (Math.random() < 0.2) Particles.trail(b.x, b.y, b.vx, b.vy, b.color);
      } else if (b.type === 'pmissile') {
        if (Math.random() < 0.6) Particles.trail(b.x, b.y, b.vx, b.vy, b.color);
      }
    }
  }

  function draw(ctx) {
    for (let i = 0; i < POOL; i++) {
      const b = bs[i];
      if (!b.alive) continue;
      if (b.type === 'pmissile') {
        const sp = getPMissileSprite(b.color);
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(Math.atan2(b.vy, b.vx));
        ctx.drawImage(sp, -sp.width / 2, -sp.height / 2);
        ctx.restore();
        continue;
      }
      let sprite;
      if (b.type === 'pshot') sprite = getPShotSprite(b.color);
      else if (b.type === 'pbeam') sprite = getPBeamSprite(b.color);
      else if (b.type === 'eshot') sprite = getEShotSprite(b.color, b.r);
      else if (b.type === 'eblob') sprite = getEBlobSprite(b.color, b.r);
      else if (b.type === 'ehoming') sprite = getEHomingSprite(b.color, b.r);
      if (sprite) {
        ctx.drawImage(sprite, b.x - sprite.width / 2, b.y - sprite.height / 2);
      }
    }
  }

  function all() { return bs; }

  function clearEnemyBullets() {
    for (let i = 0; i < POOL; i++) {
      const b = bs[i];
      if (b.alive && !b.friendly) {
        Particles.spark(b.x, b.y, { color: b.color, count: 4, life: 0.3 });
        b.alive = false;
      }
    }
  }

  function reset() {
    for (let i = 0; i < POOL; i++) bs[i].alive = false;
  }

  return { spawn, update, draw, all, clearEnemyBullets, reset };
})();
