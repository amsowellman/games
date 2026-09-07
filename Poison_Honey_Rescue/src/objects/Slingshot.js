// Slingshot - big yellow Y-slingshot (matches the HUD mockup reference).
// Handles unified pointer drag (mouse + touch via activePointer),
// draws elastic bands, computes launch velocity and shows a dotted
// trajectory preview with yellow chevrons like the reference HUD.

import InputManager from '../systems/InputManager.js';
import { PH_STATE } from './PoisonHoney.js';

const MAX_PULL = 120;      // px
const POWER = 0.185;       // velocity (px/step) per px of pull
const GRAVITY = 1000;      // px/s^2, matches Matter default gravity y=1
const SIM_DT = 1 / 60;

export default class Slingshot {
  constructor(scene, x, y, ferret) {
    this.scene = scene;
    this.x = x;
    this.y = y;             // fork/anchor height
    this.groundY = y + 62;
    this.ferret = ferret;
    this.dragging = false;
    this.enabled = true;
    this.onLaunch = null;   // (velX, velY) callback, px/step
    this.wind = 0;          // px/s^2 sideways (storm levels)
    this.previewCount = 14; // difficulty-controlled

    this._drawPost();
    this.bandBack = scene.add.graphics().setDepth(7);
    this.bandFront = scene.add.graphics().setDepth(9);
    this.dots = [];
    this.chevrons = [];
    for (let i = 0; i < 30; i++) {
      const d = scene.add.image(-100, -100, 'dot').setDepth(6).setScale(0.9).setAlpha(0.95);
      this.dots.push(d);
      if (i % 2 === 0) {
        const c = scene.add.image(-100, -100, 'chevron').setDepth(6).setAlpha(0.95);
        this.chevrons.push(c);
      }
    }

    this._bindInput();
  }

  _drawPost() {
    const g = this.scene.add.graphics().setDepth(7);
    const x = this.x, gy = this.groundY, fy = this.y;
    // trunk (yellow with darker outline, like the mockup)
    g.lineStyle(26, 0xd9a520, 1);
    g.beginPath(); g.moveTo(x, gy); g.lineTo(x, fy + 6); g.strokePath();
    g.lineStyle(20, 0xf7c531, 1);
    g.beginPath(); g.moveTo(x, gy); g.lineTo(x, fy + 6); g.strokePath();
    // prongs
    g.lineStyle(18, 0xd9a520, 1);
    g.beginPath(); g.moveTo(x, fy + 14); g.lineTo(x - 22, fy - 22); g.strokePath();
    g.beginPath(); g.moveTo(x, fy + 14); g.lineTo(x + 22, fy - 22); g.strokePath();
    g.lineStyle(12, 0xf7c531, 1);
    g.beginPath(); g.moveTo(x, fy + 12); g.lineTo(x - 21, fy - 21); g.strokePath();
    g.beginPath(); g.moveTo(x, fy + 12); g.lineTo(x + 21, fy - 21); g.strokePath();
    // red band wraps at prong tips
    g.fillStyle(0xd92632, 1);
    g.fillCircle(x - 22, fy - 22, 9);
    g.fillCircle(x + 22, fy - 22, 9);
    this.forkL = { x: x - 22, y: fy - 22 };
    this.forkR = { x: x + 22, y: fy - 22 };
    // base mound
    g.fillStyle(0x6b8f3f, 1).fillEllipse(x, gy + 4, 90, 22);
  }

  _bindInput() {
    const scene = this.scene;
    const grabRadius = Math.max(60, InputManager.targetSize + 16);

    scene.input.on('pointerdown', (pointer) => {
      if (!this.enabled || scene._paused || scene._gameOver || !this.ferret || this.ferret.state !== PH_STATE.READY) return;
      const d = Phaser.Math.Distance.Between(pointer.worldX, pointer.worldY, this.ferret.x, this.ferret.y);
      if (d <= grabRadius) {
        this.dragging = true;
        this.dragPointer = pointer.id;
        this.ferret.beginAim();
        scene.audio.sfx('stretch');
      }
    });

    scene.input.on('pointermove', (pointer) => {
      if (!this.dragging || scene._paused || pointer.id !== this.dragPointer || !pointer.isDown) return;
      const dx = pointer.worldX - this.x;
      const dy = pointer.worldY - this.y;
      const dist = Math.min(MAX_PULL, Math.hypot(dx, dy));
      const ang = Math.atan2(dy, dx);
      const px = this.x + Math.cos(ang) * dist;
      const py = this.y + Math.sin(ang) * dist;
      this.ferret.aimAt(px, py);
      this._updateBands(px, py);
      this._updatePreview(px, py);
    });

    scene.input.on('pointerup', (pointer) => {
      if (!this.dragging || scene._paused || pointer.id !== this.dragPointer) return;
      this.dragging = false;
      const dx = this.x - this.ferret.x;
      const dy = this.y - this.ferret.y;
      const pull = Math.hypot(dx, dy);
      this._clearBands();
      this._clearPreview();
      if (pull < 18) {
        // too weak: settle back into the sling
        this.ferret.placeAt(this.x, this.y);
        return;
      }
      const vx = dx * POWER;
      const vy = dy * POWER;
      InputManager.vibrate(30);
      scene.audio.sfx('launch');
      this.enabled = false;
      if (this.onLaunch) this.onLaunch(vx, vy);
    });
  }

  _updateBands(px, py) {
    this.bandBack.clear().lineStyle(6, 0x6b3f1d, 1);
    this.bandBack.beginPath(); this.bandBack.moveTo(this.forkL.x, this.forkL.y);
    this.bandBack.lineTo(px, py); this.bandBack.strokePath();
    this.bandFront.clear().lineStyle(6, 0x8a5a2e, 1);
    this.bandFront.beginPath(); this.bandFront.moveTo(this.forkR.x, this.forkR.y);
    this.bandFront.lineTo(px, py); this.bandFront.strokePath();
  }

  _clearBands() { this.bandBack.clear(); this.bandFront.clear(); }

  _clearPreview() {
    for (const d of this.dots) d.setPosition(-100, -100);
    for (const c of this.chevrons) c.setPosition(-100, -100);
  }

  /** Simulate the exact launch arc (gravity + air drag + storm wind). */
  computeTrajectory(px, py, steps) {
    const dx = this.x - px, dy = this.y - py;
    let vx = dx * POWER * 60;  // px/s
    let vy = dy * POWER * 60;
    let x = px, y = py;
    const pts = [];
    for (let i = 0; i < steps; i++) {
      vx = vx * (1 - 0.008) + this.wind * SIM_DT;
      vy = vy * (1 - 0.008) + GRAVITY * SIM_DT;
      x += vx * SIM_DT;
      y += vy * SIM_DT;
      if (i % 2 === 0) pts.push({ x, y, angle: Math.atan2(vy, vx) });
    }
    return pts;
  }

  _updatePreview(px, py) {
    const pts = this.computeTrajectory(px, py, this.previewCount * 2);
    this._clearPreview();
    let ci = 0;
    for (let i = 0; i < pts.length && i < this.dots.length; i++) {
      const p = pts[i];
      this.dots[i].setPosition(p.x, p.y);
      if (i % 2 === 0 && ci < this.chevrons.length) {
        this.chevrons[ci].setPosition(p.x, p.y).setRotation(p.angle);
        ci++;
      }
    }
  }

  /** Reset for the next launch. */
  reload() {
    this.dragging = false;
    this.dragPointer = null;
    this._clearBands();
    this._clearPreview();
    this.enabled = true;
    if (this.ferret) this.ferret.placeAt(this.x, this.y);
  }

  hidePreview() { this._clearPreview(); }
}
