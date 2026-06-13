const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/harness');

function makeGamepad(overrides = {}) {
  const buttons = (overrides.buttons || []).map((b) => (
    typeof b === 'object' ? b : { pressed: !!b, value: b ? 1 : 0 }
  ));
  return {
    index: overrides.index ?? 0,
    id: overrides.id ?? 'test-gamepad',
    connected: overrides.connected !== false,
    mapping: overrides.mapping ?? 'standard',
    buttons,
    axes: overrides.axes || [0, 0],
  };
}

function setPads(g, pads) {
  const list = [null, null, null, null];
  for (let i = 0; i < pads.length; i++) list[i] = pads[i];
  g.sandbox.navigator.getGamepads = () => list;
}

function tick(g) {
  g.Input.poll();
  g.Input.endFrame();
}

test('Input polls gamepad without throwing when no pad is connected', () => {
  const g = loadGame();
  assert.doesNotThrow(() => {
    g.Input.poll();
    g.Input.endFrame();
    g.Input.axis();
    g.Input.isDown('fire');
  });
  assert.equal(g.Input.hasGamepad(), false);
});

test('gamepad stick movement feeds Input.axis()', () => {
  const g = loadGame();
  setPads(g, [makeGamepad({ axes: [0.9, -0.8] })]);
  g.Input.poll();
  const { x, y } = g.Input.axis();
  assert.ok(x > 0.5, 'stick right should move x positive');
  assert.ok(y < -0.5, 'stick up should move y negative');
});

test('gamepad button edges map to wasPressed and wasReleased', () => {
  const g = loadGame();
  const buttons = new Array(16).fill(0).map(() => ({ pressed: false, value: 0 }));

  setPads(g, [makeGamepad({ buttons })]);
  tick(g);

  buttons[0].pressed = true;
  buttons[0].value = 1;
  setPads(g, [makeGamepad({ buttons })]);
  g.Input.poll();
  assert.equal(g.Input.wasPressed('fire'), true, 'A button should fire');
  tick(g);

  g.Input.poll();
  assert.equal(g.Input.isDown('fire'), true, 'A held should keep fire down');
  tick(g);

  buttons[0].pressed = false;
  buttons[0].value = 0;
  setPads(g, [makeGamepad({ buttons })]);
  g.Input.poll();
  assert.equal(g.Input.wasReleased('fire'), true, 'releasing A should release fire');
});

test('gamepad start button starts the game from title', () => {
  const g = loadGame();
  const buttons = new Array(16).fill(0).map(() => ({ pressed: false, value: 0 }));
  setPads(g, [makeGamepad({ buttons })]);
  tick(g);

  buttons[9].pressed = true;
  buttons[9].value = 1;
  setPads(g, [makeGamepad({ buttons })]);

  g.step(g.clock.now());
  assert.equal(g.getElement('overlay').classList.contains('show'), false);
});

test('game loop update and draw stay stable while polling a gamepad', () => {
  const g = loadGame();
  setPads(g, [makeGamepad({
    axes: [0.4, 0],
    buttons: [
      { pressed: true, value: 1 }, // fire
      ...new Array(15).fill({ pressed: false, value: 0 }),
    ],
  })]);

  g.dispatch('keydown', { code: 'Enter' });
  g.step(g.clock.now());

  assert.doesNotThrow(() => {
    for (let i = 0; i < 30; i++) {
      g.clock.advance(16);
      tick(g);
      g.Player.update(1 / 60);
      g.Player.draw(g.ctx);
    }
  });
});

test('DualShock 4 standard mapping uses Cross for fire', () => {
  const g = loadGame();
  const buttons = new Array(16).fill(0).map(() => ({ pressed: false, value: 0 }));
  setPads(g, [makeGamepad({
    id: '054c-05c4-Wireless Controller',
    mapping: 'standard',
    buttons,
  })]);
  tick(g);

  buttons[0].pressed = true;
  buttons[0].value = 1;
  setPads(g, [makeGamepad({
    id: '054c-05c4-Wireless Controller',
    mapping: 'standard',
    buttons,
  })]);
  g.Input.poll();
  assert.equal(g.Input.gamepadProfile(), 'dualshock4');
  assert.equal(g.Input.wasPressed('fire'), true);
});

test('DualShock 4 raw HID maps Cross on button 1 and R2 on axis 4', () => {
  const g = loadGame();
  const buttons = new Array(16).fill(0).map(() => ({ pressed: false, value: 0 }));

  setPads(g, [makeGamepad({
    id: '054c-09cc-DualShock 4 Wireless Controller',
    mapping: '',
    buttons,
    axes: [0, 0, 0, 0, 0.9],
  })]);
  g.Input.poll();
  assert.equal(g.Input.gamepadProfile(), 'dualshock4-raw');
  assert.equal(g.Input.wasPressed('fire'), true, 'R2 axis should fire');
  tick(g);

  setPads(g, [makeGamepad({
    id: '054c-09cc-DualShock 4 Wireless Controller',
    mapping: '',
    buttons,
    axes: [0, 0, 0, 0, 0],
  })]);
  tick(g);

  buttons[1].pressed = true;
  buttons[1].value = 1;
  setPads(g, [makeGamepad({
    id: '054c-09cc-DualShock 4 Wireless Controller',
    mapping: '',
    buttons,
    axes: [0, 0, 0, 0, 0],
  })]);
  g.Input.poll();
  assert.equal(g.Input.wasPressed('fire'), true, 'Cross on button 1 should fire');
});

test('DualShock 4 raw Options button starts the game', () => {
  const g = loadGame();
  const buttons = new Array(16).fill(0).map(() => ({ pressed: false, value: 0 }));
  setPads(g, [makeGamepad({
    id: '054c-05c4-Wireless Controller',
    mapping: '',
    buttons,
  })]);
  tick(g);

  buttons[9].pressed = true;
  buttons[9].value = 1;
  setPads(g, [makeGamepad({
    id: '054c-05c4-Wireless Controller',
    mapping: '',
    buttons,
  })]);

  g.step(g.clock.now());
  assert.equal(g.getElement('overlay').classList.contains('show'), false);
});

test('gamepadLabel returns a friendly controller name', () => {
  const g = loadGame();
  setPads(g, [makeGamepad({ id: '054c-05c4-Wireless Controller', mapping: 'standard' })]);
  g.Input.poll();
  assert.equal(g.Input.gamepadLabel(), 'DualShock 4');
});

test('gamepadconnected event registers pad before getGamepads snapshot', () => {
  const g = loadGame();
  const pad = makeGamepad({ id: '054c-05c4-Wireless Controller', mapping: 'standard' });
  g.dispatch('gamepadconnected', { gamepad: pad });
  setPads(g, [pad]);
  g.Input.poll();
  assert.equal(g.Input.hasGamepad(), true);
  assert.equal(g.Input.gamepadProfile(), 'dualshock4');
});

test('stale gamepadconnected snapshot does not read button presses', () => {
  const g = loadGame();
  const stale = makeGamepad({
    id: '054c-09cc-DualShock 4 Wireless Controller',
    mapping: '',
    buttons: [{ pressed: false, value: 0 }, ...new Array(15).fill({ pressed: false, value: 0 })],
  });
  stale.buttons[1].pressed = true;
  g.dispatch('gamepadconnected', { gamepad: stale });
  g.Input.poll();
  assert.equal(g.Input.hasGamepad(), false, 'event snapshot alone is not a live pad');
  assert.equal(g.Input.wasPressed('fire'), false, 'stale snapshot must not register presses');

  const live = makeGamepad({
    id: '054c-09cc-DualShock 4 Wireless Controller',
    mapping: '',
    buttons: new Array(16).fill(0).map(() => ({ pressed: false, value: 0 })),
  });
  live.buttons[1].pressed = true;
  live.buttons[1].value = 1;
  setPads(g, [live]);
  g.Input.poll();
  assert.equal(g.Input.hasGamepad(), true);
  assert.equal(g.Input.wasPressed('fire'), true);
});

test('DualShock 4 unified mapping accepts Cross on button 0 or 1', () => {
  const g = loadGame();
  for (const crossIndex of [0, 1]) {
    const buttons = new Array(16).fill(0).map(() => ({ pressed: false, value: 0 }));
    setPads(g, [makeGamepad({
      id: '054c-05c4-Wireless Controller',
      mapping: 'standard',
      buttons,
    })]);
    tick(g);

    buttons[crossIndex].pressed = true;
    buttons[crossIndex].value = 1;
    setPads(g, [makeGamepad({
      id: '054c-05c4-Wireless Controller',
      mapping: 'standard',
      buttons,
    })]);
    g.Input.poll();
    assert.equal(g.Input.wasPressed('fire'), true, `Cross on button ${crossIndex} should fire`);
    tick(g);
  }
});

test('gamepaddisconnected clears active pad and stale slots', () => {
  const g = loadGame();
  const pad = makeGamepad({ id: '054c-05c4-Wireless Controller', mapping: 'standard' });
  g.dispatch('gamepadconnected', { gamepad: pad });
  setPads(g, [pad]);
  g.Input.poll();
  assert.equal(g.Input.hasGamepad(), true);

  g.dispatch('gamepaddisconnected', { gamepad: pad });
  g.sandbox.navigator.getGamepads = () => [null, null, null, null];
  g.Input.poll();
  assert.equal(g.Input.hasGamepad(), false);
});

test('gamepadWaiting is true after user gesture but before pad is found', () => {
  const g = loadGame();
  assert.equal(g.Input.gamepadWaiting(), false);
  g.dispatch('mousedown', {});
  assert.equal(g.Input.hasUserGesture(), true);
  assert.equal(g.Input.gamepadWaiting(), true);
});
