// Abilities - the six mid-flight special abilities with cooldowns.
// Cooldowns are scaled by difficulty. Multiple abilities may be used
// in a single launch (Level 7 requires combining two in one launch).

export const ABILITY_DEFS = {
  blast:  { name: 'Poison Blast',    cooldown: 5000,  icon: 'ab_blast',  tint: 0x7c3aed,
            hint: 'Shockwave blasts debris away - guinea pigs in the ring are shielded' },
  trap:   { name: 'Honey Trap',      cooldown: 12000, icon: 'ab_trap',   tint: 0xd97706,
            hint: 'Sticky cloud slows falling debris for 3s' },
  bolt:   { name: 'Lightning Strike', cooldown: 15000, icon: 'ab_bolt',  tint: 0xeab308,
            hint: 'Vertical bolt shatters reinforced wood and stone' },
  bees:   { name: 'Bee Swarm',       cooldown: 10000, icon: 'ab_bees',   tint: 0x92400e,
            hint: 'Bees weaken nearby structure for 4s' },
  wind:   { name: 'Wind Gust',       cooldown: 8000,  icon: 'ab_wind',   tint: 0x0d9488,
            hint: 'Wind tunnel pushes debris and guinea pigs toward safety' },
  shield: { name: 'Honey Shield',    cooldown: 20000, icon: 'ab_shield', tint: 0x16a34a,
            hint: 'Guinea pigs are invulnerable for 5s' }
};

export default class Abilities {
  constructor(scene, abilityIds, cooldownMult) {
    this.scene = scene;
    this.ids = abilityIds;
    this.cooldownMult = cooldownMult;
    this.readyAt = {};
    for (const id of abilityIds) this.readyAt[id] = 0;
    this.selectedIndex = 0;
    this._activeEffects = [];
  }

  get selectedId() { return this.ids[this.selectedIndex] || null; }

  select(i) {
    if (i >= 0 && i < this.ids.length) {
      this.selectedIndex = i;
      this.scene.audio.sfx('click');
      this.scene.events.emit('abilities:changed');
    }
  }

  remaining(id) {
    return Math.max(0, (this.readyAt[id] || 0) - this.scene.elapsed);
  }

  canActivate(id) {
    return id && !this.scene._paused && !this.scene._gameOver && this.remaining(id) === 0 && this.scene.ferret && this.scene.ferret.isFlying;
  }

  /** Trigger the currently selected ability at the ferret's position. */
  activateSelected() {
    const id = this.selectedId;
    if (!this.canActivate(id)) return false;
    const f = this.scene.ferret;
    this.readyAt[id] = this.scene.elapsed + ABILITY_DEFS[id].cooldown * this.cooldownMult;
    this.scene.events.emit('abilities:changed');
    this[`_fx_${id}`](f.x, f.y);
    return true;
  }

  _debrisNear(x, y, r) {
    const out = [];
    for (const d of this.scene.debris) {
      if (!d.active || d.dead) continue;
      if (Phaser.Math.Distance.Between(x, y, d.x, d.y) <= r) out.push(d);
    }
    return out;
  }

  // 1. Poison Blast - radial shockwave, guinea pigs inside are shielded
  _fx_blast(x, y) {
    const scene = this.scene, R = 240;
    scene.audio.sfx('blast');
    scene.cameras.main.shake(180, 0.006);
    const ring = scene.add.circle(x, y, 20, 0xa855f7, 0.15)
      .setStrokeStyle(8, 0xa855f7, 1).setDepth(20);
    scene.tweens.add({
      targets: ring, radius: R, alpha: 0, duration: 420, ease: 'Cubic.easeOut',
      onUpdate: () => ring.setStrokeStyle(8, 0xa855f7, ring.alpha),
      onComplete: () => ring.destroy()
    });
    for (const gp of scene.guineaPigs) {
      if (gp.alive && !gp.rescued &&
          Phaser.Math.Distance.Between(x, y, gp.x, gp.y) <= R) {
        gp.applyShield(1200); // shielded from harm inside the blast
      }
    }
    for (const d of this._debrisNear(x, y, R)) {
      const ang = Math.atan2(d.y - y, d.x - x);
      const dist = Math.max(40, Phaser.Math.Distance.Between(x, y, d.x, d.y));
      const force = 0.055 * d.body.mass * (1 - dist / (R * 1.6));
      d.setAwake();
      d.applyForce({ x: Math.cos(ang) * force, y: Math.sin(ang) * force - 0.01 * d.body.mass });
      d.damage(3, scene);
    }
  }

  // 2. Honey Trap - sticky cloud slows debris for 3s
  _fx_trap(x, y) {
    const scene = this.scene, R = 200, DUR = 3000;
    scene.audio.sfx('trap');
    const cloud = scene.add.circle(x, y, R, 0xf59e0b, 0.28)
      .setStrokeStyle(3, 0xfbbf24, 0.8).setDepth(19);
    const until = scene.elapsed + DUR;
    for (const d of this._debrisNear(x, y, R)) d.slowUntil = until;
    const tick = scene.time.addEvent({
      delay: 120, repeat: DUR / 120 - 1,
      callback: () => {
        for (const d of this._debrisNear(x, y, R)) d.slowUntil = until;
        cloud.setAlpha(0.18 + Math.random() * 0.15);
      }
    });
    scene.time.delayedCall(DUR, () => { tick.remove(); cloud.destroy(); });
  }

  // 3. Lightning Strike - vertical bolt shatters wood & stone in a column
  _fx_bolt(x, y) {
    const scene = this.scene, HALF_W = 42;
    scene.audio.sfx('bolt');
    scene.cameras.main.flash(120, 255, 255, 220);
    const g = scene.add.graphics().setDepth(21);
    g.lineStyle(7, 0xffffff, 1);
    let cx = x, cy = -10;
    g.beginPath(); g.moveTo(cx, cy);
    while (cy < 640) {
      cy += 40 + Math.random() * 30;
      cx = x + (Math.random() - 0.5) * 46;
      g.lineTo(cx, Math.min(cy, 645));
    }
    g.strokePath();
    g.lineStyle(2.5, 0xfde047, 1).strokeRect(x - HALF_W, 0, HALF_W * 2, 645);
    scene.tweens.add({ targets: g, alpha: 0, duration: 320, onComplete: () => g.destroy() });

    for (const d of scene.debris) {
      if (!d.active || d.dead) continue;
      if (Math.abs(d.x - x) > HALF_W + d.displayWidth * 0.5) continue;
      if (d.y > 650) continue;
      if (d.debrisType === 'metal') d.damage(2, scene);
      else if (d.debrisType === 'trunk') d.damage(3, scene);
      else d.damage(99, scene); // shatters wood, stone, glass, hay
    }
    scene.audio.sfx('thunder');
  }

  // 4. Bee Swarm - bees weaken structure near the ferret for 4s
  _fx_bees(x, y) {
    const scene = this.scene, R = 260, DUR = 4000;
    scene.audio.sfx('bees');
    const until = scene.elapsed + DUR;
    const bees = [];
    for (let i = 0; i < 14; i++) {
      bees.push(scene.add.image(x, y, 'bee').setDepth(20).setScale(1.4));
    }
    const swarm = scene.time.addEvent({
      delay: 80, repeat: DUR / 80 - 1,
      callback: () => {
        const t = scene.time.now / 1000;
        bees.forEach((b, i) => {
          if (!b.active) return;
          const a = t * 3 + (i * Math.PI * 2) / bees.length;
          const r = 60 + 40 * Math.sin(t * 2 + i);
          b.setPosition(x + Math.cos(a) * r, y + Math.sin(a * 1.3) * r * 0.7);
        });
      }
    });
    const dmg = scene.time.addEvent({
      delay: 400, repeat: DUR / 400 - 1,
      callback: () => {
        for (const d of this._debrisNear(x, y, R)) {
          d.weakenUntil = until;
          d.damage(1, scene);
        }
      }
    });
    scene.time.delayedCall(DUR, () => {
      swarm.remove(); dmg.remove();
      bees.forEach((b) => b.destroy());
    });
  }

  // 5. Wind Gust - pushes debris & guinea pigs toward safety for 3s
  _fx_wind(x, y) {
    const scene = this.scene, R = 300, DUR = 3000;
    scene.audio.sfx('wind');
    const dir = scene.windGustDir || -1; // default: blow left toward the lawn
    const gust = scene.time.addEvent({
      delay: 60, repeat: DUR / 60 - 1,
      callback: () => {
        for (const d of this._debrisNear(x, y, R)) {
          d.setAwake();
          d.applyForce({ x: dir * 0.0045 * d.body.mass, y: -0.0008 * d.body.mass });
        }
        for (const gp of scene.guineaPigs) {
          if (gp.alive && !gp.rescued &&
              Phaser.Math.Distance.Between(x, y, gp.x, gp.y) <= R) {
            gp.setAwake();
            gp.applyForce({ x: dir * 0.003 * gp.body.mass, y: 0 });
          }
        }
        if (scene.streakEmitter) {
          scene.streakEmitter.explode(3, x + Phaser.Math.Between(-120, 120), y + Phaser.Math.Between(-90, 90));
        }
      }
    });
    scene.time.delayedCall(DUR, () => gust.remove());
  }

  // 6. Honey Shield - all guinea pigs invulnerable for 5s
  _fx_shield(x, y) {
    const scene = this.scene;
    scene.audio.sfx('shield');
    for (const gp of scene.guineaPigs) {
      if (gp.alive && !gp.rescued) gp.applyShield(5000);
    }
    scene.cameras.main.flash(140, 255, 215, 106);
  }
}
