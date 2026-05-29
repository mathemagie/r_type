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

    // Lives + bombs at right
    ctx.textAlign = 'right';
    ctx.font = 'bold 11px Consolas, monospace';
    ctx.shadowColor = '#ff3aa0'; ctx.shadowBlur = 6;
    ctx.fillStyle = '#ff3aa0';
    let lives = Math.max(0, p.lives);
    if (lives > 90) lives = 0;
    ctx.fillText('VIES ' + lives, W - 6, 9);
    ctx.shadowColor = '#ffe45a';
    ctx.fillStyle = '#ffe45a';
    ctx.fillText('BOMBES ' + p.bombs, W - 80, 9);

    // Progress bar
    const prog = Math.min(1, Level1.getTime() / 176);
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(280, 6, 200, 6);
    ctx.fillStyle = '#7af0ff';
    ctx.shadowColor = '#7af0ff'; ctx.shadowBlur = 6;
    ctx.fillRect(280, 6, 200 * prog, 6);

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

  return { startGame, gameOver, win: _win };
})();
