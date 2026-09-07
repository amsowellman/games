// GuineaPig - rescue targets. Trapped while debris is nearby; once the
// coast is clear they scramble to safety (babies can't move and are
// airlifted instead). Variants: blue (fast), orange (slow), brown, baby.

import { CAT } from './Debris.js';

export const GP_VARIANTS = {
  blue:   { texture: 'gp_blue',   speed: 6.5, canMove: true,  radius: 18 },
  brown:  { texture: 'gp_brown',  speed: 4.0, canMove: true,  radius: 18 },
  orange: { texture: 'gp_orange', speed: 2.4, canMove: true,  radius: 21 },
  baby:   { texture: 'gp_baby',   speed: 0,   canMove: false, radius: 14 }
};

const STATE = { TRAPPED: 0, FREED: 1, RESCUED: 2, FAINTED: 3 };

/** Shortest distance from a point to a Matter body polygon. */
function pointToBodyDist(px, py, body) {
  const vs = body.vertices;
  let min = Infinity;
  for (let i = 0; i < vs.length; i++) {
    const a = vs[i], b = vs[(i + 1) % vs.length];
    const abx = b.x - a.x, aby = b.y - a.y;
    const len2 = abx * abx + aby * aby || 1;
    const t = Math.max(0, Math.min(1, ((px - a.x) * abx + (py - a.y) * aby) / len2));
    const cx = a.x + abx * t, cy = a.y + aby * t;
    const dx = px - cx, dy = py - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < min) min = d2;
  }
  return Math.sqrt(min);
}

export default class GuineaPig extends Phaser.Physics.Matter.Image {
  constructor(scene, cfg, resilience) {
    const v = GP_VARIANTS[cfg.variant] || GP_VARIANTS.brown;
    super(scene.matter.world, cfg.x, cfg.y, v.texture, null, {
      shape: { type: 'circle', radius: v.radius },
      density: 0.0008,
      friction: 0.9,
      frictionAir: 0.03,
      restitution: 0.1,
      collisionFilter: { category: CAT.GP, mask: 0xFFFF }
    });
    scene.add.existing(this);

    this.variant = cfg.variant;
    this.variantCfg = v;
    this.state = STATE.TRAPPED;
    this.resilience = resilience;
    this.hits = 0;                       // harm counter
    this.maxHits = resilience >= 2 ? 3 : resilience >= 1 ? 2 : 1;
    this.freeTimer = 0;                  // ms accumulated while clear
    this.shieldUntil = 0;                // Honey Shield / blast shielding
    this.rescueX = cfg.rescueX != null ? cfg.rescueX : -60; // run-off target
    this._shieldBubble = null;

    this.setFixedRotation();
    this.setDepth(5);
  }

  get alive() { return this.state !== STATE.FAINTED; }
  get rescued() { return this.state === STATE.RESCUED; }
  get trapped() { return this.state === STATE.TRAPPED; }
  get escaping() { return this.state === STATE.FREED; }
  get isShielded() { return this.scene.elapsed < this.shieldUntil; }

  playIdle() {
    // NOTE: no scale/rotation tweens here - tweening a MatterImage transform
    // rebuilds its physics body every frame and jitters resting debris.
  }

  /** Called from collision events. relSpeed = impact speed in px/step. */
  onHit(relSpeed) {
    if (this.state !== STATE.TRAPPED || this.isShielded) return;
    const threshold = 6 * this.resilience;
    if (relSpeed < threshold) return;
    const hard = relSpeed > threshold * 1.8;
    this.hits += hard ? 2 : 1;
    this.scene.audio.sfx('hurt');
    this.setTintFill(0xff6666);
    this.scene.time.delayedCall(120, () => { if (this.active) this.clearTint(); });
    if (this.hits >= this.maxHits) this._faint();
    else this.scene.onGuineaPigHarmed(this);
  }

  _faint() {
    if (!this.alive) return;
    this.state = STATE.FAINTED;
    this.setTint(0x888888);
    this.setAngle(90);
    this.scene.onGuineaPigFainted(this);
  }

  applyShield(durationMs) {
    this.shieldUntil = Math.max(this.shieldUntil, this.scene.elapsed + durationMs);
    if (this._shieldBubble) this._shieldBubble.destroy();
    const b = this.scene.add.circle(this.x, this.y, 30, 0xffd76a, 0.25)
      .setStrokeStyle(3, 0xffd76a, 0.9).setDepth(6);
    this._shieldBubble = b;
    this.scene.tweens.add({ targets: b, alpha: 0.45, duration: 400, yoyo: true, repeat: -1 });
  }

  /** Per-frame rescue check driven by GameScene. */
  update(delta, debrisBodies) {
    if (!this.active) return;

    if (this._shieldBubble) {
      if (this.isShielded) this._shieldBubble.setPosition(this.x, this.y);
      else { this._shieldBubble.destroy(); this._shieldBubble = null; }
    }

    if (this.state === STATE.TRAPPED) {
      let clear = true;
      for (const d of debrisBodies) {
        if (!d.active || d.dead) continue;
        if (pointToBodyDist(this.x, this.y, d.body) < this.variantCfg.radius + 18) {
          clear = false; break;
        }
      }
      const calm = this.body.speed < 1.2;
      if (clear && calm) {
        this.freeTimer += delta;
        if (this.freeTimer > 900) this._escape();
      } else {
        this.freeTimer = 0;
      }
    } else if (this.state === STATE.FREED) {
      // run to safety off the bottom-left/right edge of the screen
      if (this.variantCfg.canMove) {
        this.escapeTimer += delta;
        const dir = Math.sign(this.rescueX - this.x) || 1;
        this.setAwake();
        this.setVelocity(dir * this.variantCfg.speed, this.body.velocity.y);
        this.setFlipX(dir < 0);
        if ((dir < 0 && this.x < this.rescueX) || (dir > 0 && this.x > this.rescueX) ||
            this.x < -50 || this.x > 1330) {
          this._finishRescue();
        } else if (this.escapeTimer > 12000 && !this._escFading) {
          // failsafe: nothing may block a rescue forever - scamper off with a fade
          this._escFading = true;
          this.scene.tweens.add({
            targets: this, alpha: 0, duration: 350,
            onComplete: () => this._finishRescue()
          });
        }
      }
    }
  }

  _escape() {
    if (this.state !== STATE.TRAPPED) return;
    this.state = STATE.FREED;
    this.setAwake();
    this.escapeTimer = 0;
    this.scene.audio.sfx('squeak');
    if (!this.variantCfg.canMove) {
      // babies are airlifted with hearts
      this.setStatic(true);
      if (this._idleTween) this._idleTween.stop();
      this.scene.spawnHearts(this.x, this.y - 20);
      this.scene.tweens.add({
        targets: this, y: this.y - 140, alpha: 0, scaleX: 0.6, scaleY: 0.6,
        duration: 1100, ease: 'Sine.easeIn', onComplete: () => this._finishRescue()
      });
    } else {
      // escaping animals squeeze through remaining rubble and each other;
      // only the ground still supports them (keeps them running on the floor)
      this.setCollidesWith(CAT.GROUND);
      this.scene.audio.sfx('rescued');
    }
  }

  _finishRescue() {
    if (this.state === STATE.RESCUED) return;
    this.state = STATE.RESCUED;
    if (this._idleTween) this._idleTween.stop();
    this.scene.onGuineaPigRescued(this);
    this.setActive(false);
    this.setVisible(false);
    this.setStatic(true);
    this.setPosition(-9999, -9999); // fully out of the physics world
  }

  destroy(fromScene) {
    if (this._shieldBubble) this._shieldBubble.destroy();
    super.destroy(fromScene);
  }
}
