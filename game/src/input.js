// Keyboard and mouse input. Held keys give movement axes; one-shot presses
// (confirm, pause, interact, punch, reload, mute) are queued as bit flags and
// taken once by the loop, so a press between two frames is never lost and
// never counted twice. The mouse steers the camera and aims.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_INTERACT = 4;
export const ACTION_PUNCH = 8;
export const ACTION_RELOAD = 16;
export const ACTION_MUTE = 32;
export const ACTION_FIRE = 64;

const FORWARD = new Set(['KeyW', 'ArrowUp']);
const BACK = new Set(['KeyS', 'ArrowDown']);
const LEFT = new Set(['KeyA', 'ArrowLeft']);
const RIGHT = new Set(['KeyD', 'ArrowRight']);
const SPRINT = new Set(['ShiftLeft', 'ShiftRight']);
const HANDBRAKE = new Set(['Space']);
const CONFIRM = new Set(['Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const INTERACT = new Set(['KeyE']);
const PUNCH = new Set(['KeyF']);
const RELOAD = new Set(['KeyR']);
const MUTE = new Set(['KeyM']);

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let firing = false;

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    held.add(event.code);
    if (CONFIRM.has(event.code)) actions |= ACTION_CONFIRM;
    else if (PAUSE.has(event.code)) actions |= ACTION_PAUSE;
    else if (INTERACT.has(event.code)) actions |= ACTION_INTERACT;
    else if (PUNCH.has(event.code)) actions |= ACTION_PUNCH;
    else if (RELOAD.has(event.code)) actions |= ACTION_RELOAD;
    else if (MUTE.has(event.code)) actions |= ACTION_MUTE;
    if (FORWARD.has(event.code) || BACK.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code) || HANDBRAKE.has(event.code)) {
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    held.clear();
    firing = false;
  });
  canvas.addEventListener('pointerdown', (event) => {
    if (event.button === 0) {
      firing = true;
      actions |= ACTION_FIRE;
    }
  });
  window.addEventListener('pointerup', (event) => {
    if (event.button === 0) firing = false;
  });
  window.addEventListener('pointermove', (event) => {
    mouseX += event.movementX || 0;
    mouseY += event.movementY || 0;
  });

  function has(set) {
    for (const code of set) if (held.has(code)) return true;
    return false;
  }

  return {
    /** -1..1 forward axis (W/S), for walking and throttle. */
    forward() {
      return (has(FORWARD) ? 1 : 0) - (has(BACK) ? 1 : 0);
    },
    /** -1..1 strafe/steer axis (A/D). */
    strafe() {
      return (has(RIGHT) ? 1 : 0) - (has(LEFT) ? 1 : 0);
    },
    sprint() {
      return has(SPRINT);
    },
    handbrake() {
      return has(HANDBRAKE);
    },
    isFiring() {
      return firing;
    },
    /** Mouse movement since the last call, in pixels; consumed. */
    takeMouse() {
      const taken = { x: mouseX, y: mouseY };
      mouseX = 0;
      mouseY = 0;
      return taken;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
