// Input handling — keyboard state + edge detection
const Input = (() => {
  const keys = {};
  const pressed = {};
  const released = {};

  const map = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right',
    KeyZ: 'fire', KeyJ: 'fire', Space: 'fire',
    KeyX: 'bomb', KeyK: 'bomb',
    ShiftLeft: 'pod', ShiftRight: 'pod', KeyL: 'pod',
    Enter: 'start', NumpadEnter: 'start',
    KeyR: 'restart',
    KeyP: 'pause',
    KeyM: 'mute',
  };

  window.addEventListener('keydown', (e) => {
    const k = map[e.code];
    if (!k) return;
    if (!keys[k]) pressed[k] = true;
    keys[k] = true;
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
  });

  window.addEventListener('keyup', (e) => {
    const k = map[e.code];
    if (!k) return;
    if (keys[k]) released[k] = true;
    keys[k] = false;
  });

  // Lose focus → reset to avoid stuck keys
  window.addEventListener('blur', () => {
    for (const k in keys) keys[k] = false;
  });

  return {
    isDown(k) { return !!keys[k]; },
    wasPressed(k) { return !!pressed[k]; },
    wasReleased(k) { return !!released[k]; },
    // Call at end of frame
    endFrame() {
      for (const k in pressed) pressed[k] = false;
      for (const k in released) released[k] = false;
    },
    axis() {
      let x = 0, y = 0;
      if (keys.left) x -= 1;
      if (keys.right) x += 1;
      if (keys.up) y -= 1;
      if (keys.down) y += 1;
      // normalize diagonals
      if (x && y) { x *= 0.7071; y *= 0.7071; }
      return { x, y };
    }
  };
})();
