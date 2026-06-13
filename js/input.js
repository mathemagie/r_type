// Input handling — keyboard + Gamepad API (standard + DualShock 4 raw)
const Input = (() => {
  const keys = {};
  const pressed = {};
  const released = {};

  const gpDown = {};
  const gpSlots = {};
  let gpAxisX = 0;
  let gpAxisY = 0;
  let activePad = null;
  let activeProfile = 'none';
  let userGestured = false;

  const DEADZONE = 0.2;
  const TRIGGER_ON = 0.35;

  const STANDARD_BTN = {
    fire: [0, 5, 7],
    bomb: [1],
    pod: [2, 4],
    start: [9],
    restart: [3],
    pause: [8],
    mute: [10],
    up: [12],
    down: [13],
    left: [14],
    right: [15],
  };

  // macOS / Bluetooth HID layout before the browser remaps to "standard"
  const DS4_RAW_BTN = {
    fire: [1, 5],
    bomb: [2],
    pod: [0, 4],
    start: [9],
    restart: [3],
    pause: [8],
    mute: [10],
    up: [12],
    down: [13],
    left: [14],
    right: [15],
  };
  const DS4_RAW_TRIGGERS = { fire: [4] };

  const DS4_HAT_SECTORS = [
    { v: 1, up: true },
    { v: 0.7142857142857143, up: true, right: true },
    { v: 0.5714285714285714, right: true },
    { v: 0.2857142857142857, right: true, down: true },
    { v: -1, down: true },
    { v: -0.7142857142857143, down: true, left: true },
    { v: -0.5714285714285714, left: true },
    { v: -0.2857142857142857, left: true, up: true },
  ];

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

  const ACTIONS = [
    'up', 'down', 'left', 'right',
    'fire', 'bomb', 'pod', 'start', 'restart', 'pause', 'mute',
  ];

  const GP_LOG = '[Gamepad]';
  const GP_DEBUG = typeof location !== 'undefined' && location.search.includes('gpdebug');
  let lastScanLog = 0;
  let lastActiveId = null;
  let lastPressedBtns = '';

  function gpLog(...args) {
    if (GP_DEBUG) console.log(...args);
  }

  function summarizePad(gp) {
    if (!gp) return null;
    return {
      index: gp.index,
      id: gp.id,
      connected: gp.connected,
      mapping: gp.mapping,
      buttons: gp.buttons.length,
      axes: gp.axes.length,
    };
  }

  function summarizePads() {
    const pads = getGamepads() || [];
    const out = [];
    for (let i = 0; i < pads.length; i++) out.push(summarizePad(pads[i]));
    return out;
  }

  function summarizeSlots() {
    const out = [];
    for (const idx in gpSlots) out.push(summarizePad(gpSlots[idx]));
    return out;
  }

  function pageHref() {
    return (window.location && window.location.href) || 'unknown';
  }

  function pageSecure() {
    return !!window.isSecureContext;
  }

  function logScan(reason) {
    const now = performance.now();
    const important = reason === 'boot'
      || reason === 'connected'
      || reason === 'disconnected'
      || reason === 'gesture'
      || reason === 'blur';
    if (!important && now - lastScanLog < 2000) return;
    lastScanLog = now;
    gpLog(GP_LOG, `scan (${reason})`, {
      userGestured,
      secureContext: pageSecure(),
      href: pageHref(),
      getGamepads: summarizePads(),
      cachedSlots: summarizeSlots(),
      active: summarizePad(activePad),
      profile: activeProfile,
    });
  }

  function logActiveChange(gp) {
    const id = gp ? gp.id : null;
    if (id === lastActiveId) return;
    lastActiveId = id;
    if (!gp) {
      gpLog(GP_LOG, 'active cleared');
      return;
    }
    gpLog(GP_LOG, 'active pad', {
      ...summarizePad(gp),
      profile: resolveProfile(gp),
    });
  }

  function logButtonActivity(gp, actions) {
    const pressedBtns = [];
    for (let i = 0; i < gp.buttons.length; i++) {
      if (btnPressed(gp.buttons[i])) pressedBtns.push(i);
    }
    const resolved = ACTIONS.filter((a) => actions && actions[a]);
    const key = pressedBtns.join(',') + '|' + resolved.join(',');
    if (key !== lastPressedBtns && (pressedBtns.length || resolved.length)) {
      // Always-on (not gated by ?gpdebug) so controller issues are visible in the console.
      console.log(GP_LOG, 'btns', pressedBtns, '-> actions', resolved, {
        profile: activeProfile,
        id: gp.id,
        axes: Array.from(gp.axes).map((v) => Number(v.toFixed(3))),
      });
    }
    lastPressedBtns = key;
  }

  function getGamepads() {
    const nav = navigator;
    if (nav.getGamepads) return nav.getGamepads();
    if (nav.webkitGetGamepads) return nav.webkitGetGamepads();
    return [];
  }

  function gamepadApiSupported() {
    return !!(navigator.getGamepads || navigator.webkitGetGamepads);
  }

  function isDualShock4(gp) {
    const id = (gp.id || '').toLowerCase();
    return /054c-(05c4|09cc|0ba0)/.test(id)
      || id.includes('dualshock')
      || (id.includes('wireless controller') && id.includes('054c'))
      || (id.includes('wireless controller') && id.includes('sony'));
  }

  function resolveProfile(gp) {
    if (!gp) return 'none';
    if (isDualShock4(gp)) {
      return gp.mapping === 'standard' ? 'dualshock4' : 'dualshock4-raw';
    }
    return gp.mapping === 'standard' ? 'standard' : 'generic';
  }

  function gamepadLabel() {
    if (!activePad) return '';
    if (activeProfile === 'dualshock4' || activeProfile === 'dualshock4-raw') {
      return 'DualShock 4';
    }
    const id = (activePad.id || '').toLowerCase();
    if (id.includes('xbox') || id.includes('xinput')) return 'Xbox';
    if (id.includes('switch') || id.includes('pro controller')) return 'Switch Pro';
    if (id.includes('dualsense')) return 'DualSense';
    return 'Manette';
  }

  function btnPressed(btn) {
    if (!btn) return false;
    if (typeof btn === 'object') return !!btn.pressed || btn.value > 0.5;
    return btn === 1 || btn > 0.5;
  }

  function axisAsTrigger(v) {
    if (v == null || Number.isNaN(v)) return false;
    if (v >= 0) return v > TRIGGER_ON;
    return (v + 1) / 2 > TRIGGER_ON;
  }

  function applyDeadzone(v) {
    if (Math.abs(v) < DEADZONE) return 0;
    const sign = v < 0 ? -1 : 1;
    return sign * (Math.abs(v) - DEADZONE) / (1 - DEADZONE);
  }

  function anyBtn(gp, ids) {
    for (let i = 0; i < ids.length; i++) {
      if (btnPressed(gp.buttons[ids[i]])) return true;
    }
    return false;
  }

  function anyTrigger(gp, ids) {
    for (let i = 0; i < ids.length; i++) {
      if (axisAsTrigger(gp.axes[ids[i]])) return true;
    }
    return false;
  }

  function applyDs4Hat(next, axis) {
    if (axis == null || Math.abs(axis) < 0.01) return;
    for (let i = 0; i < DS4_HAT_SECTORS.length; i++) {
      const s = DS4_HAT_SECTORS[i];
      if (Math.abs(axis - s.v) < 0.06) {
        if (s.up) next.up = true;
        if (s.down) next.down = true;
        if (s.left) next.left = true;
        if (s.right) next.right = true;
        return;
      }
    }
  }

  function applyAxisDpad(next, gp) {
    if (gp.axes.length <= 7) return;
    const dx = gp.axes[6];
    const dy = gp.axes[7];
    if (Math.abs(dx) > 0.5) {
      next.left = dx < 0;
      next.right = dx > 0;
    }
    if (Math.abs(dy) > 0.5) {
      next.up = dy < 0;
      next.down = dy > 0;
    }
  }

  function readMappedState(gp, btnMap, triggerMap) {
    const next = {};
    for (let i = 0; i < ACTIONS.length; i++) {
      const a = ACTIONS[i];
      next[a] = anyBtn(gp, btnMap[a] || []);
      if (triggerMap && triggerMap[a]) next[a] = next[a] || anyTrigger(gp, triggerMap[a]);
    }
    return next;
  }

  // DS4 reports different button indices on macOS (raw HID vs standard mapping).
  // Merge both layouts so Cross / Options / R2 work regardless of profile string.
  function readDualShock4State(gp) {
    const std = readMappedState(gp, STANDARD_BTN);
    const raw = readMappedState(gp, DS4_RAW_BTN, DS4_RAW_TRIGGERS);
    const next = {};
    for (let i = 0; i < ACTIONS.length; i++) {
      const a = ACTIONS[i];
      next[a] = !!(std[a] || raw[a]);
    }
    next.fire = next.fire || anyTrigger(gp, [4, 5]);
    if (!next.up && !next.down && !next.left && !next.right) {
      applyDs4Hat(next, gp.axes[9]);
    }
    if (!next.up && !next.down && !next.left && !next.right) {
      applyAxisDpad(next, gp);
    }
    return next;
  }

  function readGamepadState(gp, profile) {
    let next;
    if (profile === 'dualshock4' || profile === 'dualshock4-raw') {
      next = readDualShock4State(gp);
    } else {
      next = readMappedState(gp, STANDARD_BTN);
      if (!next.up && !next.down && !next.left && !next.right) {
        applyAxisDpad(next, gp);
      }
    }

    const ax = applyDeadzone(gp.axes[0] || 0);
    const ay = applyDeadzone(gp.axes[1] || 0);
    return { actions: next, ax, ay };
  }

  function refreshGamepadSlots() {
    const pads = getGamepads();
    if (!pads) return;
    for (let i = 0; i < pads.length; i++) {
      if (pads[i]) gpSlots[i] = pads[i];
    }
    for (const idx in gpSlots) {
      if (gpSlots[idx] && gpSlots[idx].connected === false) delete gpSlots[idx];
    }
  }

  // GamepadEvent.gamepad is a snapshot — only navigator.getGamepads()[i] updates live.
  function pickLiveGamepad() {
    refreshGamepadSlots();
    const pads = getGamepads() || [];
    for (let i = 0; i < pads.length; i++) {
      if (pads[i] && pads[i].connected) return pads[i];
    }
    return null;
  }

  function pickSlotGamepad() {
    for (const idx in gpSlots) {
      const gp = gpSlots[idx];
      if (gp && gp.connected) return gp;
    }
    return null;
  }

  function setActionEdge(action, down) {
    if (down && !gpDown[action]) pressed[action] = true;
    if (!down && gpDown[action]) released[action] = true;
    gpDown[action] = down;
  }

  function clearGamepadState() {
    for (let i = 0; i < ACTIONS.length; i++) {
      const a = ACTIONS[i];
      if (gpDown[a]) released[a] = true;
      gpDown[a] = false;
    }
    gpAxisX = 0;
    gpAxisY = 0;
    activePad = null;
    activeProfile = 'none';
  }

  function pollGamepad() {
    const hadLive = !!activePad;
    const live = pickLiveGamepad();
    const slot = pickSlotGamepad();

    if (!live) {
      if (slot) {
        activePad = slot;
        activeProfile = resolveProfile(slot);
      } else if (hadLive) {
        logActiveChange(null);
        clearGamepadState();
      }
      return;
    }

    if (!hadLive || activePad !== live) logActiveChange(live);
    activePad = live;
    activeProfile = resolveProfile(live);
    const { actions, ax, ay } = readGamepadState(live, activeProfile);
    gpAxisX = ax;
    gpAxisY = ay;
    logButtonActivity(live, actions);

    for (let i = 0; i < ACTIONS.length; i++) {
      setActionEdge(ACTIONS[i], !!actions[ACTIONS[i]]);
    }
  }

  function scanGamepads(reason = 'gesture') {
    userGestured = true;
    refreshGamepadSlots();
    logScan(reason);
    pollGamepad();
  }

  window.addEventListener('keydown', (e) => {
    scanGamepads();
    const k = map[e.code];
    if (!k) return;
    if (!keys[k]) pressed[k] = true;
    keys[k] = true;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
  });

  window.addEventListener('keyup', (e) => {
    const k = map[e.code];
    if (!k) return;
    if (keys[k]) released[k] = true;
    keys[k] = false;
  });

  window.addEventListener('mousedown', scanGamepads);
  window.addEventListener('touchstart', scanGamepads, { passive: true });

  window.addEventListener('blur', () => {
    gpLog(GP_LOG, 'window blur — clearing keyboard state');
    for (const k in keys) keys[k] = false;
  });

  window.addEventListener('gamepadconnected', (e) => {
    gpLog(GP_LOG, 'gamepadconnected event', summarizePad(e.gamepad));
    userGestured = true;
    gpSlots[e.gamepad.index] = e.gamepad;
    logScan('connected');
    pollGamepad();
  });

  window.addEventListener('gamepaddisconnected', (e) => {
    gpLog(GP_LOG, 'gamepaddisconnected event', summarizePad(e.gamepad));
    delete gpSlots[e.gamepad.index];
    logScan('disconnected');
    pollGamepad();
  });

  if (!('ongamepadconnected' in window)) {
    gpLog(GP_LOG, 'no gamepadconnected event — enabling 500ms interval scan');
    setInterval(() => scanGamepads('interval'), 500);
  }

  if (GP_DEBUG) {
    gpLog(GP_LOG, 'init', {
      api: gamepadApiSupported(),
      events: 'ongamepadconnected' in window,
      secureContext: pageSecure(),
      href: pageHref(),
      hint: 'Add ?gpdebug to the URL for [Gamepad] logs. Or run Input.debugGamepad() in the console.',
    });
    logScan('boot');
  }

  return {
    isDown(k) { return !!keys[k] || !!gpDown[k]; },
    wasPressed(k) { return !!pressed[k]; },
    wasReleased(k) { return !!released[k]; },
    hasGamepad() { return !!pickLiveGamepad(); },
    gamepadApiSupported,
    hasUserGesture() { return userGestured; },
    gamepadWaiting() {
      return gamepadApiSupported() && userGestured && !pickLiveGamepad();
    },
    gamepadId() { return activePad ? activePad.id : ''; },
    gamepadProfile() { return activeProfile; },
    gamepadLabel,
    poll: pollGamepad,
    debugGamepad() {
      const live = pickLiveGamepad();
      const pressedBtns = [];
      if (live) {
        for (let i = 0; i < live.buttons.length; i++) {
          if (btnPressed(live.buttons[i])) pressedBtns.push(i);
        }
      }
      const snap = {
        userGestured,
        secureContext: pageSecure(),
        getGamepads: summarizePads(),
        cachedSlots: summarizeSlots(),
        active: summarizePad(live || activePad),
        profile: live ? resolveProfile(live) : activeProfile,
        label: gamepadLabel(),
        pressedButtons: pressedBtns,
        axes: live ? Array.from(live.axes).map((v) => Number(v.toFixed(3))) : [],
        waiting: gamepadApiSupported() && userGestured && !live,
      };
      console.log(GP_LOG, 'debug snapshot', snap);
      return snap;
    },
    endFrame() {
      for (const k in pressed) pressed[k] = false;
      for (const k in released) released[k] = false;
    },
    axis() {
      let x = 0;
      let y = 0;
      if (keys.left || gpDown.left) x -= 1;
      if (keys.right || gpDown.right) x += 1;
      if (keys.up || gpDown.up) y -= 1;
      if (keys.down || gpDown.down) y += 1;
      x += gpAxisX;
      y += gpAxisY;
      if (x && y) { x *= 0.7071; y *= 0.7071; }
      return { x, y };
    },
  };
})();
