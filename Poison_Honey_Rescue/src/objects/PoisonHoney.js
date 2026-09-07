// PoisonHoney - the heroic ferret projectile. States:
// ready (in sling) -> aiming -> flying -> done.

import { CAT } from './Debris.js';

export const PH_STATE = { READY: 0, AIMING: 1, FLYING: 2, DONE: 3 };

export default class PoisonHoney extends Phaser.Physics.Matter.Image {
  constructor(scene, x, y) {
    super(scene.matter.world, x, y, 'ferret', null, {
      shape: { type: 'circle', radius: 24 },
      density: 0.0022,
      friction: 0.4,
      frictionAir: 0.008,
      restitution: 0.25,
      collisionFilter: { category: CAT.FERRET, mask: 0xFFFF },
      label: 'poisonHoney'
    });
    scene.add.existing(this);

    this.state = PH_STATE.READY;
    this.setDisplaySize(62, 76);
    this.setStatic(true);
    this.setDepth(8);
    this._calmTimer = 0;
    this._spin = 0;
  }

  get isFlying() { return this.state === PH_STATE.FLYING; }
  get isDone() { return this.state === PH_STATE.DONE; }

  placeAt(x, y) {
    this.setPosition(x, y);
    this.setVelocity(0, 0);
    this.setAngularVelocity(0);
    this.setAngle(0);
    this.setStatic(true);
    this.setVisible(true);
    this.setActive(true);
    this.state = PH_STATE.READY;
    this._calmTimer = 0;
    this.setAlpha(1);
  }

  beginAim() { if (this.state === PH_STATE.READY) this.state = PH_STATE.AIMING; }

  aimAt(x, y) {
    if (this.state !== PH_STATE.AIMING) return;
    this.setPosition(x, y);
  }

  launch(velX, velY) {
    this.state = PH_STATE.FLYING;
    this.setStatic(false);
    this.setAwake();
    this.setVelocity(velX, velY);
    this.setAngularVelocity(0.12);
  }

  update(delta, world) {
    if (this.state !== PH_STATE.FLYING) return;
    this.setAngle(this.body.angle * 57.3 + 3);

    const b = this.body;
    const slow = b.speed < 0.9;
    this._calmTimer = slow ? this._calmTimer + delta : 0;

    const out = this.x < -120 || this.x > world.width + 120 || this.y > world.height + 160;
    if (this._calmTimer > 1400 || out) this.finish();
  }

  finish() {
    if (this.state === PH_STATE.DONE) return;
    this.state = PH_STATE.DONE;
    this.scene.tweens.add({ targets: this, alpha: 0, duration: 250 });
  }

  /** Convert px/s^2 to Matter force (mass * px/ms^2) before each physics step. */
  applyWind(accelX) {
    if (this.state !== PH_STATE.FLYING) return;
    this.applyForce({ x: this.body.mass * accelX / 1000000, y: 0 });
  }
}
