// Particle pool — explosions, sparks, trails, debris
const Particles = (() => {
  const POOL = 800;
  const ps = [];
  for (let i = 0; i < POOL; i++) ps.push({ alive: false });

  function alloc() {
    for (let i = 0; i < POOL; i++) if (!ps[i].alive) return ps[i];
    return ps[0];
  }

  function spark(x, y, opts = {}) {
    const p = alloc();
    p.alive = true;
    p.x = x; p.y = y;
    const ang = opts.angle ?? Math.random() * Math.PI * 2;
    const speed = opts.speed ?? (40 + Math.random() * 120);
    p.vx = Math.cos(ang) * speed;
    p.vy = Math.sin(ang) * speed;
    p.life = opts.life ?? (0.3 + Math.random() * 0.4);
    p.maxLife = p.life;
    p.size = opts.size ?? (1 + Math.random() * 2);
    p.color = opts.color ?? '#ffe45a';
    p.glow = opts.glow ?? true;
    p.gravity = opts.gravity ?? 0;
    p.drag = opts.drag ?? 0.94;
    p.type = opts.type ?? 'spark';
  }

  function explosion(x, y, opts = {}) {
    const count = opts.count ?? 22;
    const speed = opts.speed ?? 180;
    const color = opts.color ?? '#ffaa3a';
    const inner = opts.innerColor ?? '#ffffff';
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const sp = speed * (0.4 + Math.random() * 0.9);
      spark(x, y, {
        angle: ang, speed: sp,
        life: 0.4 + Math.random() * 0.5,
        size: 1.5 + Math.random() * 2.5,
        color: Math.random() < 0.3 ? inner : color,
        glow: true,
      });
    }
    // shock ring
    const r = alloc();
    r.alive = true;
    r.type = 'ring';
    r.x = x; r.y = y; r.radius = 4;
    r.maxRadius = opts.shockSize ?? 50;
    r.life = 0.28; r.maxLife = r.life;
    r.color = opts.shockColor ?? '#ffffff';
  }

  function trail(x, y, vx, vy, color = '#7ad7ff') {
    spark(x, y, {
      angle: Math.atan2(vy, vx) + Math.PI + (Math.random() - 0.5) * 0.5,
      speed: 20 + Math.random() * 30,
      life: 0.25, size: 1.5, color, glow: true,
    });
  }

  function update(dt) {
    for (let i = 0; i < POOL; i++) {
      const p = ps[i];
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) { p.alive = false; continue; }
      if (p.type === 'ring') {
        const t = 1 - p.life / p.maxLife;
        p.radius = 4 + (p.maxRadius - 4) * t;
      } else {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= Math.pow(p.drag, dt * 60);
        p.vy *= Math.pow(p.drag, dt * 60);
        p.vy += p.gravity * dt;
      }
    }
  }

  function draw(ctx) {
    ctx.save();
    // Pass 1 — additive blend, no shadowBlur (much faster than shadowBlur per particle)
    ctx.globalCompositeOperation = 'lighter';
    ctx.shadowBlur = 0;
    for (let i = 0; i < POOL; i++) {
      const p = ps[i];
      if (!p.alive || p.type === 'ring') continue;
      const a = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      const s = p.size * (0.6 + a * 0.4);
      // small inner core
      ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
      // halo via larger semi-transparent rect (cheap glow effect)
      if (p.glow) {
        ctx.globalAlpha = a * 0.35;
        const h = s * 2.5;
        ctx.fillRect(p.x - h / 2, p.y - h / 2, h, h);
      }
    }
    // Pass 2 — rings (few of them, shadowBlur OK)
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < POOL; i++) {
      const p = ps[i];
      if (!p.alive || p.type !== 'ring') continue;
      const a = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = a * 0.7;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function reset() {
    for (let i = 0; i < POOL; i++) ps[i].alive = false;
  }

  return { spark, explosion, trail, update, draw, reset };
})();
