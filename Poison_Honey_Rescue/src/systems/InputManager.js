// InputManager - one unified input pipeline for mouse + touch.
// Pointer input always comes from Phaser's activePointer so a single
// code path serves both platforms; this class adds keyboard shortcuts,
// the platform mode setting, and haptic feedback.

import SaveSystem from './SaveSystem.js';

export default class InputManager {
  constructor(scene) {
    this.scene = scene;
    const kb = scene.input.keyboard;
    if (!kb) return;

    kb.on('keydown-R', () => scene.events.emit('input:restart'));
    kb.on('keydown-SPACE', () => scene.events.emit('input:activate'));
    kb.on('keydown-ESC', () => scene.events.emit('input:pause'));
    kb.on('keydown-P', () => scene.events.emit('input:pause'));
    kb.on('keydown-ENTER', () => scene.events.emit('input:confirm'));
    const numKeys = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX'];
    numKeys.forEach((k, i) => kb.on(`keydown-${k}`, () => scene.events.emit('input:selectAbility', i)));
  }

  /** 'mobile' | 'desktop' - manual setting overrides auto-detection. */
  static getPlatform() {
    const pref = SaveSystem.getSettings().platform;
    if (pref === 'mobile' || pref === 'desktop') return pref;
    const touch = 'ontouchstart' in window || (navigator.maxTouchPoints || 0) > 0;
    return touch ? 'mobile' : 'desktop';
  }

  static isMobile() { return InputManager.getPlatform() === 'mobile'; }

  /** Minimum touch target (px) - 48 on touch, smaller is OK for mouse. */
  static get targetSize() { return InputManager.isMobile() ? 48 : 36; }

  static vibrate(pattern) {
    try {
      if (InputManager.isMobile() && navigator.vibrate) navigator.vibrate(pattern);
    } catch (e) { /* unsupported */ }
  }

  /** Hand cursor over interactive elements (desktop only effect). */
  static handCursor(scene, gameObject) {
    gameObject.on('pointerover', () => { scene.game.canvas.style.cursor = 'pointer'; });
    gameObject.on('pointerout', () => { scene.game.canvas.style.cursor = 'default'; });
  }
}
