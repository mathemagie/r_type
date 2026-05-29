// Main game loop + state machine
const Game = (() => {
  const W = 800, H = 450;
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  const STATE = { TITLE: 0, PLAY: 1, GAMEOVER: 2, WIN: 3, PAUSE: 4 };
  let state = STATE.TITLE;
  let prevState = STATE.TITLE;
  let lastTime = performance.now();
  let acc = 0;
  const STEP = 1 / 60;

  const overlayEl = document.getElementById('overlay');
  const overEl = document.getElementById('gameover');
  const winEl = document.getElementById('win');
  const pauseEl = document.getElementById('pause');

  function setState(s) {
    prevState = state;
    state = s;
    overlayEl.classList.toggle('show', s === STATE.TITLE);
    overEl.classList.toggle('show', s === STATE.GAMEOVER);
    winEl.classList.toggle('show', s === STATE.WIN);
    pauseEl.classList.toggle('show', s === STATE.PAUSE);
  }

  function startGame() {
    Audio.resume();
    Background.init();
    Player.reset();
    Enemies.reset();
    Bullets.reset();
    Particles.reset();
    Boss.reset();
    Level1.reset();
    FX.reset();
    Audio.startMusic();
    setState(STATE.PLAY);
  }

  function gameOver() {
    Audio.stopMusic();
    document.getElementById('final-score-over').textContent = 'Score : ' + Player.state.score;
    setState(STATE.GAMEOVER);
  }

  function win() {
    Audio.stopMusic();
    const sc = Player.state.score;
    document.getElementById('final-score-win').textContent = 'Score : ' + sc;
    let rank = 'D';
    if (sc > 12000) rank = 'C';
    if (sc > 20000) rank = 'B';
    if (sc > 28000) rank = 'A';
    if (sc > 36000) rank = 'S';
    if (sc > 50000) rank = 'SS';
    document.getElementById('final-rank').textContent = 'Rang : ' + rank;
    Audio.SFX.win();
    setState(STATE.WIN);
  }

  function loop(now) {
    let dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;

    if (state === STATE.TITLE) {
      if (Input.wasPressed('start')) startGame();
    } else if (state === STATE.GAMEOVER || state === STATE.WIN) {
      if (Input.wasPressed('restart') || Input.wasPressed('start')) startGame();
    } else if (state === STATE.PAUSE) {
      if (Input.wasPressed('pause')) setState(prevState);
    } else if (state === STATE.PLAY) {
      if (Input.wasPressed('pause')) { setState(STATE.PAUSE); }
      else if (Input.wasPressed('mute')) Audio.toggleMute();
      else {
        // Update with FX timescale
        const scale = FX.timescale(dt * 1000);
        const stepDt = dt * scale;

        // Music tick (real time)
        Audio.musicTick(dt);

        // Game logic
        Background.update(stepDt);
        Level1.update(stepDt);
        Player.update(stepDt);
        Enemies.update(stepDt);
        Boss.update(stepDt);
        Bullets.update(stepDt, Player.state);
        Particles.update(stepDt);
        Player.checkBulletCollisions();
        FX.update(stepDt);

        // End conditions
        if (Player.state.lives <= 0 && !Player.alive) {
          setTimeout(() => {
            if (Player.state.lives <= 0) gameOver();
          }, 1400);
          // prevent double-trigger
          Player.state.lives = -999;
        }
      }
    }

    render();
    Input.endFrame();
    requestAnimationFrame(loop);
  }

  function render() {
    ctx.fillStyle = '#04060c';
    ctx.fillRect(0, 0, W, H);

    if (state === STATE.PLAY || state === STATE.PAUSE) {
      FX.preDraw(ctx);
      Background.draw(ctx);
      Enemies.draw(ctx);
      Boss.draw(ctx);
      Bullets.draw(ctx);
      Particles.draw(ctx);
      Player.draw(ctx);
      FX.postDraw(ctx, W, H);

      drawHud();
      Level1.drawBanner(ctx);
    } else if (state === STATE.TITLE) {
      // Animated background under the title overlay
      Background.update(0.016);
      Background.draw(ctx);
    }
  }

  // --- HUD glyphs (Law 1: embody meaning as icons, not language-bound text) ---
  function drawHeart(c, cx, topY, s) {
    c.beginPath();
    c.moveTo(cx, topY + s * 0.25);
    c.bezierCurveTo(cx, topY, cx - s * 0.5, topY, cx - s * 0.5, topY + s * 0.25);
    c.bezierCurveTo(cx - s * 0.5, topY + s * 0.55, cx, topY + s * 0.8, cx, topY + s);
    c.bezierCurveTo(cx, topY + s * 0.8, cx + s * 0.5, topY + s * 0.55, cx + s * 0.5, topY + s * 0.25);
    c.bezierCurveTo(cx + s * 0.5, topY, cx, topY, cx, topY + s * 0.25);
    c.closePath();
    c.fill();
  }
  function drawBomb(c, cx, cy, r) {
    c.beginPath();
    c.arc(cx, cy, r, 0, Math.PI * 2);
    c.fill();
    c.lineWidth = 1.2;
    c.strokeStyle = c.fillStyle;
    c.beginPath();
    c.moveTo(cx + r * 0.5, cy - r * 0.7);
    c.quadraticCurveTo(cx + r * 1.3, cy - r * 1.5, cx + r * 1.6, cy - r * 1.1);
    c.stroke();
  }
  // Draws "icon ×n" right-anchored at rightX; returns the group's left edge x.
  function drawCounter(c, rightX, n, color, iconFn) {
    c.fillStyle = color; c.shadowColor = color; c.shadowBlur = 6;
    c.textAlign = 'right'; c.textBaseline = 'middle';
    c.font = 'bold 11px Consolas, monospace';
    const label = '×' + n;
    c.fillText(label, rightX, 10);
    const cx = rightX - c.measureText(label).width - 7;
    iconFn(c, cx);
    return cx - 9;
  }
  // Skull at the end of the progress bar (Law 6: the bar now means "toward BYDO PRIME")
  function drawBossMark(c, x, y, s, lit) {
    c.save();
    c.fillStyle = lit ? '#ff3a3a' : '#ff5aa0';
    c.shadowColor = c.fillStyle; c.shadowBlur = lit ? 12 : 5;
    c.beginPath();
    c.arc(x, y - s * 0.1, s * 0.5, Math.PI, 0);
    c.lineTo(x + s * 0.5, y + s * 0.18);
    c.lineTo(x + s * 0.22, y + s * 0.18);
    c.lineTo(x + s * 0.22, y + s * 0.45);
    c.lineTo(x - s * 0.22, y + s * 0.45);
    c.lineTo(x - s * 0.22, y + s * 0.18);
    c.lineTo(x - s * 0.5, y + s * 0.18);
    c.closePath();
    c.fill();
    c.fillStyle = '#04060c'; c.shadowBlur = 0;
    c.beginPath(); c.arc(x - s * 0.2, y, s * 0.14, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(x + s * 0.2, y, s * 0.14, 0, Math.PI * 2); c.fill();
    c.restore();
  }

  function drawHud() {
    const p = Player.state;
    ctx.save();
    // Top bar
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(0, 0, W, 18);

    ctx.font = 'bold 11px Consolas, monospace';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#7af0ff';
    ctx.shadowColor = '#7af0ff'; ctx.shadowBlur = 6;
    ctx.fillText('SCORE', 6, 9);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(String(p.score).padStart(7, '0'), 50, 9);

    // Combo
    if (p.combo >= 2) {
      const mult = 1 + Math.min(7, Math.floor(p.combo / 4));
      ctx.shadowBlur = 8;
      ctx.fillStyle = mult >= 6 ? '#ff3aa0' : (mult >= 3 ? '#ffe45a' : '#7af0ff');
      ctx.shadowColor = ctx.fillStyle;
      const grow = 1 + p.multGain * 0.6;
      ctx.font = `bold ${Math.round(11 * grow)}px Consolas, monospace`;
      ctx.fillText(`x${mult}  COMBO ${p.combo}`, 150, 9);
    }

    // Lives + bombs at right — icon + count (no language-bound labels)
    let lives = Math.max(0, p.lives);
    if (lives > 90) lives = 0;
    const livesLeft = drawCounter(ctx, W - 6, lives, '#ff3aa0',
      (c, cx) => drawHeart(c, cx, 4, 9));
    drawCounter(ctx, livesLeft - 8, p.bombs, '#ffe45a',
      (c, cx) => drawBomb(c, cx, 9, 4));

    // Progress bar — fill advances toward the boss marker at its end
    const prog = Math.min(1, Level1.getTime() / 176);
    const barX = 280, barW = 196, barY = 6;
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(barX, barY, barW, 6);
    ctx.fillStyle = '#7af0ff';
    ctx.shadowColor = '#7af0ff'; ctx.shadowBlur = 6;
    ctx.fillRect(barX, barY, barW * prog, 6);
    drawBossMark(ctx, barX + barW + 8, 9, 11, prog >= 0.985);

    // Pause overlay text
    if (state === STATE.PAUSE) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#ffe45a';
      ctx.shadowColor = '#ffe45a'; ctx.shadowBlur = 14;
      ctx.font = 'bold 40px Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('PAUSE', W / 2, H / 2);
    }

    ctx.restore();
  }

  // Public API exposed for Boss to call win
  function _win() { win(); }

  // Boot
  setState(STATE.TITLE);
  Background.init();
  requestAnimationFrame(loop);

  // Ensure audio context resumed on first user input
  window.addEventListener('keydown', () => Audio.resume(), { once: true });
  window.addEventListener('click', () => Audio.resume(), { once: true });

  // Fullscreen toggle (F). Must run inside the user gesture, so it is handled
  // here directly rather than through the polled Input system.
  function toggleFullscreen() {
    const el = document.documentElement;
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      const req = el.requestFullscreen || el.webkitRequestFullscreen;
      if (req) Promise.resolve(req.call(el)).catch(() => {});
    } else {
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (exit) Promise.resolve(exit.call(document)).catch(() => {});
    }
  }
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyF') { e.preventDefault(); toggleFullscreen(); }
  });
  // Double-click the canvas to toggle fullscreen too
  canvas.addEventListener('dblclick', toggleFullscreen);

  return { startGame, gameOver, win: _win };
})();
