const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, MODULE_GLOBALS } = require('./helpers/harness');

test('harness loads every module global', () => {
  const g = loadGame();
  for (const name of MODULE_GLOBALS) {
    assert.ok(g[name], `expected global ${name} to be defined`);
  }
});

test('FX.timescale slows during hitstop and recovers', () => {
  const { FX } = loadGame();
  assert.equal(FX.timescale(16), 1);
  FX.hitstop(100);
  assert.ok(FX.timescale(16) < 1, 'timescale should drop during hitstop');
});

test('Game.win computes a rank into the DOM', () => {
  const g = loadGame();
  g.Player.state.score = 60000;
  g.Game.win();
  assert.match(g.getElement('final-rank').textContent, /SS/);
});

test('draw passes do not throw against the canvas stub', () => {
  const g = loadGame();
  assert.doesNotThrow(() => {
    g.Background.init();
    g.Background.draw(g.ctx);
    g.Particles.explosion(100, 100);
    g.Particles.draw(g.ctx);
  });
});
