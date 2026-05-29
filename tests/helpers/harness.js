// Test harness — loads the game's browser-global IIFE modules into Node.
//
// The game ships as a series of <script> tags (see index.html). Each file does
//   const FX = (() => { ... })();
// and relies on classic-script semantics where every top-level `const` lives in
// ONE shared lexical scope visible to later scripts. Node's `vm` gives each
// `runInContext` call its own lexical scope, so we reproduce the browser by
// concatenating every module into a SINGLE script and running it once. The
// appended export line sits in that same shared scope, so it can see every
// module binding and copy them onto the sandbox global for the tests to read.
//
// All DOM / Canvas / WebAudio / timing dependencies are stubbed deterministically.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');

// Browser <script> load order, straight from index.html.
const MODULE_FILES = [
  'js/fx.js',
  'js/particles.js',
  'js/audio.js',
  'js/input.js',
  'js/bullets.js',
  'js/background.js',
  'js/player.js',
  'js/enemies.js',
  'js/boss.js',
  'js/level1.js',
  'js/main.js',
];

// The global each file declares, in the same order.
const MODULE_GLOBALS = [
  'FX', 'Particles', 'Audio', 'Input', 'Bullets',
  'Background', 'Player', 'Enemies', 'Boss', 'Level1', 'Game',
];

// ---- Canvas 2D context stub -------------------------------------------------
// A Proxy that stores assigned properties and answers any unknown method with a
// no-op. Enough to let every draw() run without throwing.
function makeGradient() {
  return { addColorStop() {} };
}

function makeCtx(canvas) {
  const known = {
    canvas,
    createRadialGradient: makeGradient,
    createLinearGradient: makeGradient,
    createPattern: () => ({}),
    measureText: () => ({ width: 10 }),
    getImageData: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }),
    createImageData: (w = 1, h = 1) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    putImageData() {},
  };
  return new Proxy(known, {
    get(target, prop) {
      if (prop in target) return target[prop];
      // Unknown reads return a callable no-op — covers every ctx.method().
      return () => {};
    },
    set(target, prop, value) {
      target[prop] = value;
      return true;
    },
  });
}

function makeCanvas(width = 800, height = 450) {
  const canvas = { width, height, style: {}, addEventListener() {}, removeEventListener() {} };
  canvas.getContext = () => makeCtx(canvas);
  return canvas;
}

// ---- DOM element stub -------------------------------------------------------
function makeElement(id) {
  const classes = new Set();
  return {
    id,
    textContent: '',
    style: {},
    classList: {
      add: (c) => classes.add(c),
      remove: (c) => classes.delete(c),
      contains: (c) => classes.has(c),
      toggle: (c, force) => {
        const on = force === undefined ? !classes.has(c) : !!force;
        if (on) classes.add(c); else classes.delete(c);
        return on;
      },
    },
    addEventListener() {},
    removeEventListener() {},
    appendChild() {},
    requestFullscreen() { return Promise.resolve(); },
    webkitRequestFullscreen() { return Promise.resolve(); },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 450 }),
  };
}

// ---- WebAudio stub ----------------------------------------------------------
function makeAudioParam() {
  return {
    value: 0,
    setValueAtTime() { return this; },
    linearRampToValueAtTime() { return this; },
    exponentialRampToValueAtTime() { return this; },
    setTargetAtTime() { return this; },
    cancelScheduledValues() { return this; },
  };
}

function makeAudioContext() {
  return {
    currentTime: 0,
    sampleRate: 44100,
    state: 'running',
    destination: {},
    resume() { this.state = 'running'; return Promise.resolve(); },
    suspend() { this.state = 'suspended'; return Promise.resolve(); },
    close() { return Promise.resolve(); },
    createGain: () => ({ gain: makeAudioParam(), connect() {}, disconnect() {} }),
    createOscillator: () => ({
      frequency: makeAudioParam(), detune: makeAudioParam(), type: 'sine',
      connect() {}, disconnect() {}, start() {}, stop() {},
    }),
    createBiquadFilter: () => ({
      frequency: makeAudioParam(), Q: makeAudioParam(), gain: makeAudioParam(),
      type: 'lowpass', connect() {}, disconnect() {},
    }),
    createBuffer: (channels, length) => ({
      length, sampleRate: 44100, numberOfChannels: channels,
      getChannelData: () => new Float32Array(length),
    }),
    createBufferSource: () => ({
      buffer: null, loop: false, connect() {}, disconnect() {}, start() {}, stop() {},
    }),
  };
}

/**
 * Load a fresh, fully-isolated instance of the whole game into a vm sandbox.
 *
 * @param {object}  [opts]
 * @param {number}  [opts.now=0]      initial performance.now() value (ms)
 * @param {number}  [opts.random=0.5] fixed Math.random() return, or null for real randomness
 * @returns {object} the loaded module globals plus test helpers:
 *   { FX, Particles, Audio, Input, Bullets, Background, Player, Enemies, Boss,
 *     Level1, Game, ctx, sandbox,
 *     clock: { now(), set(ms), advance(ms) },
 *     dispatch(type, event),   // fire a window event (e.g. keydown) at listeners
 *     step(now),               // invoke the captured requestAnimationFrame loop
 *     runTimers() }            // run pending setTimeout callbacks
 */
function loadGame(opts = {}) {
  const { now = 0, random = 0.5 } = opts;

  let clockNow = now;
  const windowListeners = {};       // type -> [fn]
  let rafCallback = null;
  const timers = [];                // pending setTimeout callbacks
  const elements = new Map();

  const sharedCanvas = makeCanvas();
  function getEl(id) {
    if (!elements.has(id)) {
      elements.set(id, id === 'game' ? sharedCanvas : makeElement(id));
    }
    return elements.get(id);
  }

  const documentStub = {
    getElementById: (id) => getEl(id),
    createElement: (tag) => (tag === 'canvas' ? makeCanvas() : makeElement(tag)),
    addEventListener() {},
    removeEventListener() {},
    documentElement: makeElement('html'),
    fullscreenElement: null,
    webkitFullscreenElement: null,
    exitFullscreen() { return Promise.resolve(); },
    webkitExitFullscreen() { return Promise.resolve(); },
  };

  const windowStub = {
    addEventListener(type, fn) {
      (windowListeners[type] ||= []).push(fn);
    },
    removeEventListener(type, fn) {
      const list = windowListeners[type];
      if (list) windowListeners[type] = list.filter((f) => f !== fn);
    },
    AudioContext: makeAudioContext,
    webkitAudioContext: makeAudioContext,
    requestAnimationFrame: (cb) => { rafCallback = cb; return 1; },
    cancelAnimationFrame() {},
    innerWidth: 800,
    innerHeight: 450,
    devicePixelRatio: 1,
  };

  const sandbox = {
    window: windowStub,
    document: documentStub,
    navigator: { userAgent: 'node-test' },
    console,
    performance: { now: () => clockNow },
    requestAnimationFrame: (cb) => { rafCallback = cb; return 1; },
    cancelAnimationFrame() {},
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    clearTimeout() {},
    setInterval: () => 0,
    clearInterval() {},
    Image: function Image() { return makeCanvas(); },
    Math: random === null
      ? Math
      : Object.assign(Object.create(Math), { random: () => random }),
  };
  sandbox.globalThis = sandbox;
  sandbox.window.document = documentStub;

  vm.createContext(sandbox);

  // Concatenate all modules + an export line, exactly as the browser's shared
  // classic-script scope would expose them. Per-file //# comments keep stack
  // traces pointing at the right source.
  const parts = MODULE_FILES.map((rel) => {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    return `\n//# sourceURL=${rel}\n${src}\n`;
  });
  parts.push(`\n;globalThis.__MODULES = { ${MODULE_GLOBALS.join(', ')} };\n`);

  vm.runInContext(parts.join('\n'), sandbox, { filename: 'game-bundle.js' });

  const mods = sandbox.__MODULES;

  return {
    ...mods,
    sandbox,
    ctx: sharedCanvas.getContext('2d'),
    clock: {
      now: () => clockNow,
      set: (ms) => { clockNow = ms; },
      advance: (ms) => { clockNow += ms; },
    },
    dispatch(type, event = {}) {
      const list = windowListeners[type] || [];
      for (const fn of list.slice()) fn(event);
    },
    step(t = clockNow) {
      if (!rafCallback) throw new Error('no requestAnimationFrame callback captured');
      rafCallback(t);
    },
    runTimers() {
      const pending = timers.splice(0);
      for (const { fn } of pending) fn();
    },
    getElement: (id) => getEl(id),
  };
}

module.exports = { loadGame, MODULE_GLOBALS };
