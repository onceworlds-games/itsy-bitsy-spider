// Keys (and the platform's touch stick and buttons, which press the same keys): direction, Jump (tap or hold for height,
// and in the air near a bolt it fires silk), Hold. Jump presses are buffered until the next step reads them.

const KEYMAP = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  Space: 'jump',
  KeyK: 'jump',
  KeyJ: 'hold',
  ShiftLeft: 'hold',
  ShiftRight: 'hold',
};

export function createInput(opts = {}) {
  const held = new Set();
  let jumpQueued = false;
  let last = 'keys';
  const input = { x: 0, y: 0, jump: false, jumpHeld: false, hold: false };
  const keyOf = (e) => KEYMAP[e.code] ?? (e.key === ' ' ? 'jump' : e.key === 'j' || e.key === 'J' ? 'hold' : null);

  addEventListener('keydown', (e) => {
    if (e.isTrusted && !e.repeat) last = 'keys';
    if (opts.onKey && opts.onKey(e) === true) return;
    const k = keyOf(e);
    if (!k) return;
    held.add(k);
    if (!opts.playing()) return;
    e.preventDefault();
    if (k === 'jump' && !e.repeat) jumpQueued = true;
  });
  addEventListener('keyup', (e) => {
    const k = keyOf(e);
    if (k) held.delete(k);
  });
  addEventListener('blur', () => held.clear());
  addEventListener(
    'pointerdown',
    (e) => {
      last = e.pointerType === 'touch' || e.pointerType === 'pen' ? 'touch' : 'keys';
      opts.onPointer?.(e);
    },
    { capture: true },
  );

  return {
    /** The input for the next steps (jump is consumed by the first step that reads it). */
    read() {
      input.x = (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0);
      input.y = (held.has('up') ? 1 : 0) - (held.has('down') ? 1 : 0);
      input.hold = held.has('hold');
      input.jumpHeld = held.has('jump');
      input.jump = jumpQueued;
      jumpQueued = false;
      return input;
    },
    clear() {
      held.clear();
      jumpQueued = false;
    },
    has: (k) => held.has(k),
    get last() {
      return last;
    },
  };
}

/** A fresh no-input (the step writes jump back to false, so never share a frozen one). */
export const idle = () => ({ x: 0, y: 0, jump: false, jumpHeld: false, hold: false });
