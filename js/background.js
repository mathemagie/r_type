// Parallax background — 3 layers + terrain
const Background = (() => {
  const W = 800, H = 450;
  let stars = [];
  let nebulas = [];
  let terrain = [];     // {x, topH, bottomH} — corridor walls
  let nebOffset = 0;
  let scroll = 0;
  let phase = 'open';   // 'open' | 'corridor' | 'asteroids' | 'approach' | 'boss'

  function init() {
    stars = [];
    for (let i = 0; i < 140; i++) {
      stars.push({
        x: Math.random() * W,
        y: Math.random() * H,
        z: 0.2 + Math.random() * 1.6,   // 0.2 far, 1.8 near
        size: 0.5 + Math.random() * 1.6,
      });
    }
    nebulas = [];
    for (let i = 0; i < 6; i++) {
      nebulas.push({
        x: Math.random() * W,
        y: 30 + Math.random() * (H - 60),
        r: 80 + Math.random() * 140,
        hue: 240 + Math.random() * 80,
        speed: 8 + Math.random() * 10,
        alpha: 0.06 + Math.random() * 0.07,
      });
    }
    terrain = [];
    phase = 'open';
    scroll = 0;
    nebOffset = 0;
  }

  function setPhase(p) { phase = p; }
  function getPhase() { return phase; }

  function update(dt) {
    scroll += 60 * dt;
    nebOffset += 12 * dt;

    // stars
    for (const s of stars) {
      s.x -= s.z * 70 * dt;
      if (s.x < -5) { s.x = W + 5; s.y = Math.random() * H; }
    }
    for (const n of nebulas) {
      n.x -= n.speed * dt;
      if (n.x + n.r < -40) {
        n.x = W + n.r;
        n.y = 30 + Math.random() * (H - 60);
        n.hue = 240 + Math.random() * 80;
      }
    }

    // terrain: feed from right depending on phase
    const corridorActive = phase === 'corridor';
    const speed = 140;
    // shift existing
    for (const t of terrain) t.x -= speed * dt;
    // remove off-screen
    while (terrain.length && terrain[0].x < -30) terrain.shift();

    // spawn new slices on the right
    while (!terrain.length || terrain[terrain.length - 1].x < W + 30) {
      const lastX = terrain.length ? terrain[terrain.length - 1].x : -20;
      const x = lastX + 20;
      let topH = 0, bottomH = 0;
      if (corridorActive) {
        const t = scroll / 60; // local time
        topH = 40 + Math.sin(t * 0.6 + x * 0.012) * 24 + Math.sin(t * 1.3) * 6;
        bottomH = 40 + Math.cos(t * 0.5 + x * 0.014) * 24 + Math.cos(t * 1.1) * 6;
      }
      terrain.push({ x, topH, bottomH });
    }
  }

  function draw(ctx) {
    // far stars
    for (const s of stars) {
      const b = Math.min(1, s.z / 1.8);
      ctx.fillStyle = `rgba(${180 + b * 60},${200 + b * 40},255,${0.4 + b * 0.6})`;
      ctx.fillRect(s.x, s.y, s.size, s.size);
    }
    // nebulas
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const n of nebulas) {
      const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
      g.addColorStop(0, `hsla(${n.hue}, 90%, 60%, ${n.alpha})`);
      g.addColorStop(1, 'hsla(0, 0%, 0%, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(n.x - n.r, n.y - n.r, n.r * 2, n.r * 2);
    }
    ctx.restore();

    // distant grid (cyberpunk floor effect)
    ctx.save();
    ctx.strokeStyle = 'rgba(80, 140, 220, 0.06)';
    ctx.lineWidth = 1;
    const gridShift = (scroll * 0.4) % 40;
    for (let x = -gridShift; x < W; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    ctx.restore();

    // terrain
    drawTerrain(ctx);
  }

  function drawTerrain(ctx) {
    if (!terrain.length) return;
    ctx.save();
    // top
    ctx.fillStyle = '#1a3050';
    ctx.beginPath();
    ctx.moveTo(terrain[0].x, 0);
    for (const t of terrain) ctx.lineTo(t.x, t.topH);
    ctx.lineTo(terrain[terrain.length - 1].x, 0);
    ctx.closePath();
    ctx.fill();
    // top neon edge
    ctx.strokeStyle = '#3aa0ff';
    ctx.shadowColor = '#3aa0ff';
    ctx.shadowBlur = 10;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < terrain.length; i++) {
      const t = terrain[i];
      if (t.topH <= 0) continue;
      if (i === 0 || terrain[i - 1].topH <= 0) ctx.moveTo(t.x, t.topH);
      else ctx.lineTo(t.x, t.topH);
    }
    ctx.stroke();
    // bottom
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#1a3050';
    ctx.beginPath();
    ctx.moveTo(terrain[0].x, H);
    for (const t of terrain) ctx.lineTo(t.x, H - t.bottomH);
    ctx.lineTo(terrain[terrain.length - 1].x, H);
    ctx.closePath();
    ctx.fill();
    // bottom edge
    ctx.strokeStyle = '#ff3aa0';
    ctx.shadowColor = '#ff3aa0';
    ctx.shadowBlur = 10;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < terrain.length; i++) {
      const t = terrain[i];
      if (t.bottomH <= 0) continue;
      if (i === 0 || terrain[i - 1].bottomH <= 0) ctx.moveTo(t.x, H - t.bottomH);
      else ctx.lineTo(t.x, H - t.bottomH);
    }
    ctx.stroke();
    ctx.restore();
  }

  // Returns collision boundary at given x: { top, bottom } in canvas Y coordinates
  function collideY(x) {
    // find nearest terrain segments
    let topY = 0;
    let bottomY = H;
    for (let i = 0; i < terrain.length - 1; i++) {
      const a = terrain[i], b = terrain[i + 1];
      if (a.x <= x && x <= b.x) {
        const t = (x - a.x) / Math.max(0.001, b.x - a.x);
        topY = a.topH + (b.topH - a.topH) * t;
        bottomY = H - (a.bottomH + (b.bottomH - a.bottomH) * t);
        break;
      }
    }
    return { top: topY, bottom: bottomY };
  }

  return { init, update, draw, setPhase, getPhase, collideY };
})();
