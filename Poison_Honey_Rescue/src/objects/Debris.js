// Debris - destructible structure blocks. Types differ in HP, density,
// points and damage rules (metal ignores blunt impacts; glass/hay shatter).

export const DEBRIS_TYPES = {
  wood:  { hp: 2, density: 0.0012, points: 20, texture: 'wood',  sfx: 'wood'  },
  plank: { hp: 1, density: 0.0010, points: 10, texture: 'wood',  sfx: 'wood'  },
  stone: { hp: 4, density: 0.0028, points: 40, texture: 'stone', sfx: 'stone' },
  metal: { hp: 8, density: 0.0036, points: 50, texture: 'metal', sfx: 'stone', bluntImmune: true },
  glass: { hp: 1, density: 0.0008, points: 10, texture: 'glass', sfx: 'glass', fragile: true },
  hay:   { hp: 1, density: 0.0006, points: 10, texture: 'hay',   sfx: 'wood'  },
  trunk: { hp: 6, density: 0.0030, points: 50, texture: 'trunk', sfx: 'wood'  }
};

export const CAT = { FERRET: 0x1, DEBRIS: 0x2, GP: 0x4, GROUND: 0x8 };

export default class Debris extends Phaser.Physics.Matter.Image {
  /**
   * @param scene GameScene
   * @param cfg {type,x,y,w,h,angle,hpMult}
   */
  constructor(scene, cfg) {
    const t = DEBRIS_TYPES[cfg.type];
    super(scene.matter.world, cfg.x, cfg.y, t.texture, null, {
      density: t.density,
      friction: cfg.friction != null ? cfg.friction : 0.7,
      frictionAir: 0.012,
      restitution: 0.05,
      collisionFilter: { category: CAT.DEBRIS, mask: 0xFFFF }
    });
    scene.add.existing(this);

    this.debrisType = cfg.type;
    this.typeCfg = t;
    this.maxHp = Math.max(1, Math.round(t.hp * (cfg.hpMult || 1)));
    this.hp = this.maxHp;
    this.points = t.points;
    this.dead = false;
    this.slowUntil = 0;   // Honey Trap
    this.weakenUntil = 0; // Bee Swarm (extra damage taken)

    this.setDisplaySize(cfg.w, cfg.h);
    // scale the default rectangle body to match display size
    const sx = cfg.w / this.width;
    const sy = cfg.h / this.height;
    this.setScale(sx, sy);
    if (cfg.angle) this.setAngle(cfg.angle);
    if (cfg.isStatic) this.setStatic(true);
    this.setSleepThreshold(45);
  }

  /** Apply damage; returns true if destroyed. */
  damage(amount, scene) {
    if (this.dead) return false;
    if (this.weakenUntil > scene.elapsed) amount *= 2;
    this.hp -= amount;
    this._flash();
    if (this.hp <= 0) {
      this.dead = true;
      scene.onDebrisDestroyed(this);
      if (scene.puffEmitter) scene.puffEmitter.explode(8, this.x, this.y);
      this.destroy();
      return true;
    }
    return false;
  }

  _flash() {
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(70, () => { if (this.active) this.clearTint(); });
  }
}
