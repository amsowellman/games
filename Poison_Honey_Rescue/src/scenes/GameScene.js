// GameScene - core gameplay: slingshot launches, destructible debris,
// guinea pig rescue, six abilities, weather effects, HUD, scoring.

import SaveSystem, { DIFFICULTIES, GAME_W, GAME_H } from '../systems/SaveSystem.js';
import AudioSystem from '../systems/AudioSystem.js';
import InputManager from '../systems/InputManager.js';
import Abilities, { ABILITY_DEFS } from '../systems/Abilities.js';
import Slingshot from '../objects/Slingshot.js';
import PoisonHoney, { PH_STATE } from '../objects/PoisonHoney.js';
import Debris, { CAT } from '../objects/Debris.js';
import GuineaPig from '../objects/GuineaPig.js';
import { makeButton, coverBackground, addStarRow, makePanel } from '../systems/UI.js';

export default class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  create(data) {
    this.levelIndex = (data && data.level) || 1;
    this.levelData = this.cache.json.get(`level${this.levelIndex}`);
    const settings = SaveSystem.getSettings();
    this.diffKey = settings.difficulty || 'medium';
    this.diff = DIFFICULTIES[this.diffKey];

    this.audio = new AudioSystem(this);
    this.inputManager = new InputManager(this);
    this._listeners = [];
    this._listen(this.events, 'shutdown', () => this._cleanup());

    // state
    this.score = 0;
    this.debrisScore = 0;
    this.rescueCount = 0;
    this.launchesLeft = Math.max(1, this.levelData.launches + this.diff.launchMod);
    this.gpHarmed = false;
    this._gameOver = false;
    this._resolving = false;
    this._paused = false;
    this.time.paused = false;
    this.tweens.setGlobalTimeScale(1);
    this.elapsed = 0; // gameplay clock excludes pause time, including effect deadlines
    // grace = physics steps, NOT wall time: with the fixed-step runner a frame
    // hitch advances the clock far more than the physics world.
    this._physSteps = 0;
    this._graceSteps = 150; // ~2.5s at 60 fixed steps/s - let the structure settle before damage counts
    this._listen(this.matter.world, 'afterupdate', () => { this._physSteps++; });
    this._dbg = new URLSearchParams(location.search).has('dbg');
    if (this._dbg) {
      this._dbgLines = [];
      this._dbgText = this.add.text(10, 110, '', {
        fontFamily: 'monospace', fontSize: '15px', color: '#ffff66',
        backgroundColor: 'rgba(0,0,0,0.7)'
      }).setDepth(9999);
      this._dbgLog(`create graceSteps=${this._graceSteps}`);
    }
    this.currentWind = 0;
    this.windGustDir = -1;

    this._buildBackground();
    this._buildGround();
    this._buildParticles();

    // physics bodies
    this.debris = (this.levelData.debris || []).map((cfg, i) => {
      const d = new Debris(this, Object.assign({ hpMult: this.diff.debrisHpMult }, cfg));
      d.spawnIndex = i;
      return d;
    });
    this.guineaPigs = (this.levelData.guineaPigs || []).map(
      (cfg) => new GuineaPig(this, cfg, this.diff.resilience)
    );
    this._triggers = (this.levelData.triggers || []).map((tr) => ({ ...tr, fired: false }));

    // slingshot + hero
    const s = this.levelData.slingshot;
    this.ferret = new PoisonHoney(this, s.x, s.y);
    this.slingshot = new Slingshot(this, s.x, s.y, this.ferret);
    this.slingshot.previewCount = this.diff.previewDots;
    this.slingshot.onLaunch = (vx, vy) => this._onLaunch(vx, vy);
    this._setupWeather(this.levelData.weather || {});
    this._listen(this.matter.world, 'beforeupdate', () => {
      if (this.currentWind) this.ferret.applyWind(this.currentWind);
    });

    // abilities + UI
    this.abilities = new Abilities(this, this.levelData.abilities, this.diff.cooldownMult);
    this._buildAbilityBar();
    this._buildHUD();
    this._buildTutorial();

    this._listen(this.matter.world, 'collisionstart', (e) => this._onCollision(e));
    this._listen(this.events, 'input:restart', () => this.scene.restart({ level: this.levelIndex }));
    this._listen(this.events, 'input:pause', () => this._togglePause());
    this._listen(this.events, 'input:activate', () => this._tryActivateAbility());
    this._listen(this.events, 'input:selectAbility', (i) => { this.abilities.select(i); });

    // tap/click anywhere mid-flight triggers the selected ability
    this._lastUiTap = 0;
    this.input.on('pointerdown', (p) => {
      if (this._paused || this._gameOver) return;
      if (this.time.now - this._lastUiTap < 150) return;
      if (p.y > GAME_H - 84) return;          // ability bar zone
      if (p.x > GAME_W - 90 && p.y < 80) return; // pause button zone
      this._tryActivateAbility();
    });
  }

  _listen(emitter, ev, fn) {
    emitter.on(ev, fn);
    this._listeners.push({ emitter, ev, fn });
  }

  _cleanup() {
    for (const l of this._listeners) l.emitter.off(l.ev, l.fn);
    this._listeners = [];
    this.audio.stopRain();
  }

  // ----------------------------------------------------------- build

  _buildBackground() {
    const bg = this.levelData.background || 'day';
    if (bg === 'storm') {
      coverBackground(this, 'bg_storm');
      this.add.rectangle(640, 360, GAME_W, GAME_H, 0x14082e, 0.18);
    } else if (bg === 'interior_storm') {
      coverBackground(this, 'bg_interior_storm');
      this.add.rectangle(640, 360, GAME_W, GAME_H, 0x14082e, 0.10);
    } else if (bg === 'interior_damage') {
      coverBackground(this, 'bg_interior_damage');
      this.add.rectangle(640, 360, GAME_W, GAME_H, 0x14082e, 0.10);
    } else {
      // generated stylized sky (matches the pine-tree HUD mockup style)
      const palettes = {
        day:   [0x7ec8f7, 0xd8f3ff, 0x7fae4c],
        dusk:  [0x3b2d6b, 0xd9895b, 0x51703a],
        night: [0x141b3d, 0x3c4a7a, 0x2e4a2e]
      };
      const [top, bottom, hill] = palettes[bg] || palettes.day;
      const g = this.add.graphics().setDepth(-10);
      g.fillGradientStyle(top, top, bottom, bottom, 1);
      g.fillRect(0, 0, GAME_W, GAME_H);
      // hills
      g.fillStyle(hill, 1);
      g.fillEllipse(200, 700, 700, 220);
      g.fillEllipse(900, 720, 900, 260);
      g.fillEllipse(1300, 690, 500, 180);
      // pine trees (silhouettes like the reference HUD)
      g.fillStyle(bg === 'day' ? 0x2f6b3a : 0x1d3a28, 1);
      const pine = (x, y, s) => {
        g.fillTriangle(x, y - 90 * s, x - 26 * s, y - 30 * s, x + 26 * s, y - 30 * s);
        g.fillTriangle(x, y - 64 * s, x - 32 * s, y, x + 32 * s, y);
        g.fillRect(x - 5 * s, y, 10 * s, 16 * s);
      };
      pine(70, 590, 1.2); pine(1210, 580, 1.35); pine(1140, 610, 0.9);
      if (bg !== 'day') {
        g.fillStyle(0xffffff, 0.8);
        for (let i = 0; i < 40; i++) g.fillCircle(Phaser.Math.Between(0, 1280), Phaser.Math.Between(0, 300), 1.2);
      }
    }
  }

  _buildGround() {
    this.groundY = this.levelData.groundY || 640;
    const onlyArt = ['storm', 'interior_storm', 'interior_damage'].includes(this.levelData.background);
    if (!onlyArt) {
      const g = this.add.graphics().setDepth(-5);
      g.fillStyle(0x5d8f3e, 1).fillRect(0, this.groundY, GAME_W, GAME_H - this.groundY);
      g.fillStyle(0x4a7430, 1).fillRect(0, this.groundY, GAME_W, 8);
    }
    this.matter.add.rectangle(640, this.groundY + 60, 4000, 120, {
      isStatic: true, friction: 0.9,
      collisionFilter: { category: CAT.GROUND, mask: 0xFFFF }, label: 'ground'
    });
  }

  _buildParticles() {
    this.puffEmitter = this.add.particles(0, 0, 'puff', {
      speed: { min: 40, max: 140 }, lifespan: 450,
      scale: { start: 1.2, end: 0.2 }, alpha: { start: 0.85, end: 0 }, emitting: false
    }).setDepth(18);
    this.streakEmitter = this.add.particles(0, 0, 'streak', {
      speedX: -560, speedY: 0, lifespan: 500,
      scale: { start: 1, end: 0.4 }, alpha: { start: 0.7, end: 0 }, emitting: false
    }).setDepth(16);
  }

  _setupWeather(w) {
    if (w.rain) {
      this.add.particles(0, -40, 'drop', {
        x: { min: -100, max: 1400 }, y: { min: -60, max: -20 },
        speedY: { min: 700, max: 1000 }, speedX: { min: -200, max: -120 },
        scale: { min: 0.7, max: 1.2 }, alpha: 0.5, lifespan: 1100,
        frequency: 16, quantity: 2
      }).setDepth(15);
      this.audio.startRain();
    }
    if (w.lightning) {
      const flash = () => {
        if (this._gameOver) return;
        this.cameras.main.flash(110, 230, 220, 255, true);
        const bx = Phaser.Math.Between(200, 1200);
        const g = this.add.graphics().setDepth(14);
        g.lineStyle(5, 0xe9d5ff, 0.95);
        let cx = bx, cy = -10;
        g.beginPath(); g.moveTo(cx, cy);
        while (cy < 420) { cy += 50; cx += Phaser.Math.Between(-40, 40); g.lineTo(cx, cy); }
        g.strokePath();
        this.tweens.add({ targets: g, alpha: 0, duration: 260, onComplete: () => g.destroy() });
        this.audio.sfx('thunder');
        this.time.delayedCall(Phaser.Math.Between(3200, 7500), flash);
      };
      this.time.delayedCall(2200, flash);
    }
    if (w.wind) {
      this.currentWind = w.wind.base;
      this.slingshot.wind = this.currentWind;
      const flip = () => {
        this.currentWind = -this.currentWind * Phaser.Math.FloatBetween(0.6, 1.15);
        this.slingshot.wind = this.currentWind;
        // visible wind streak indicators
        for (let i = 0; i < 6; i++) {
          this.streakEmitter.explode(4, Phaser.Math.Between(200, 1200), Phaser.Math.Between(60, 500));
        }
        this.time.delayedCall(w.wind.interval, flip);
      };
      this.time.delayedCall(w.wind.interval, flip);
      this.time.addEvent({
        delay: 700, loop: true,
        callback: () => this.streakEmitter.explode(2, Phaser.Math.Between(100, 1280), Phaser.Math.Between(50, 520))
      });
    }
  }

  _buildHUD() {
    // top-left: LEVEL + stars (matches HUD mockup)
    this.add.text(22, 14, `LEVEL ${this.levelIndex}`, {
      fontFamily: 'Verdana, sans-serif', fontSize: '30px', fontStyle: 'bold',
      color: '#ffd75e', stroke: '#7c2d12', strokeThickness: 5
    }).setDepth(40);
    const saved = SaveSystem.getProgress(this.diffKey).stars[this.levelIndex - 1] || 0;
    addStarRow(this, 74, 58, saved, 3, 0.62).forEach((s) => s.setDepth(40));

    // top-center: score + remaining launches
    this.scoreText = this.add.text(640, 14, '0', {
      fontFamily: 'Verdana, sans-serif', fontSize: '32px', fontStyle: 'bold',
      color: '#ffffff', stroke: '#1f2937', strokeThickness: 5
    }).setOrigin(0.5, 0).setDepth(40);
    this.launchRow = this.add.container(640, 60).setDepth(40);
    this._refreshLaunchIcons();

    // top-right: pause
    makeButton(this, 1236, 36, 56, 52, 'II', () => this._togglePause(), { fontSize: 20, depth: 45 });
  }

  _refreshLaunchIcons() {
    this.launchRow.removeAll(true);
    const n = this.launchesLeft;
    const totalW = n * 30;
    for (let i = 0; i < n; i++) {
      this.launchRow.add(
        this.add.image(-totalW / 2 + i * 30 + 15, 0, 'ferret').setDisplaySize(26, 31).setCrop(22, 0, 52, 46)
      );
    }
    this.launchRow.add(this.add.text(totalW / 2 + 8, 0, `x${n}`, {
      fontFamily: 'Verdana, sans-serif', fontSize: '18px', fontStyle: 'bold', color: '#fff',
      stroke: '#1f2937', strokeThickness: 3
    }).setOrigin(0, 0.5));
  }

  _buildAbilityBar() {
    const mobile = InputManager.isMobile();
    const ids = this.abilities.ids;
    const size = mobile ? 64 : 56;
    const gap = size + (mobile ? 16 : 12);
    const totalW = ids.length * gap - (gap - size);
    const startX = mobile ? 640 - totalW / 2 + size / 2 : 96;
    const y = 668;

    const barBg = this.add.graphics().setDepth(29);
    barBg.fillStyle(0x1f1140, 0.55);
    barBg.fillRoundedRect(startX - size / 2 - 12, y - size / 2 - 10, totalW + 24, size + 20, 14);

    this.abilitySlots = ids.map((id, i) => {
      const x = startX + i * gap;
      const icon = this.add.image(x, y, ABILITY_DEFS[id].icon)
        .setDisplaySize(size, size).setDepth(30).setInteractive();
      InputManager.handCursor(this, icon);
      icon.on('pointerdown', () => {
        if (this._paused || this._gameOver) return;
        this._lastUiTap = this.time.now;
        this.abilities.select(i);
        this._showAbilityHint(id, x, y - size / 2 - 14);
      });
      const ring = this.add.graphics().setDepth(32);
      const cdText = this.add.text(x, y, '', {
        fontFamily: 'Verdana, sans-serif', fontSize: '20px', fontStyle: 'bold', color: '#fff',
        stroke: '#000', strokeThickness: 4
      }).setOrigin(0.5).setDepth(33);
      if (!mobile) {
        this.add.text(x - size / 2 + 2, y - size / 2 - 16, `${i + 1}`, {
          fontFamily: 'Verdana, sans-serif', fontSize: '13px', fontStyle: 'bold', color: '#ffd75e',
          stroke: '#000', strokeThickness: 3
        }).setDepth(33);
      }
      return { id, icon, ring, cdText, x, y, size };
    });
    this._updateAbilityBar();
  }

  _showAbilityHint(id, x, y) {
    if (this._hint) this._hint.destroy();
    const def = ABILITY_DEFS[id];
    this._hint = this.add.text(Phaser.Math.Clamp(x, 200, 1080), y, `${def.name} - ${def.hint}`, {
      fontFamily: 'Verdana, sans-serif', fontSize: '14px', color: '#fef3c7', align: 'center',
      backgroundColor: 'rgba(31,17,64,0.85)', padding: { x: 10, y: 5 },
      wordWrap: { width: 380 }
    }).setOrigin(0.5, 1).setDepth(60);
    this.time.delayedCall(2600, () => { if (this._hint) { this._hint.destroy(); this._hint = null; } });
  }

  _updateAbilityBar() {
    for (const slot of this.abilitySlots) {
      const rem = this.abilities.remaining(slot.id);
      const selected = this.abilities.selectedId === slot.id;
      slot.icon.setAlpha(rem > 0 ? 0.45 : 1);
      slot.cdText.setText(rem > 0 ? `${Math.ceil(rem / 1000)}` : '');
      slot.ring.clear();
      if (selected) {
        slot.ring.lineStyle(4, 0xffd75e, 1);
        slot.ring.strokeRoundedRect(slot.x - slot.size / 2 - 4, slot.y - slot.size / 2 - 4,
          slot.size + 8, slot.size + 8, 16);
      }
    }
  }

  _buildTutorial() {
    this._tutSteps = this.levelData.tutorial || [];
    this._tutStep = 0;
    if (!this._tutSteps.length) return;
    this._tutText = this.add.text(640, 130, this._tutSteps[0], {
      fontFamily: 'Verdana, sans-serif', fontSize: '21px', fontStyle: 'bold', color: '#ffffff',
      align: 'center', backgroundColor: 'rgba(76,29,149,0.85)', padding: { x: 16, y: 8 },
      wordWrap: { width: 620 }
    }).setOrigin(0.5).setDepth(55);
  }

  _advanceTutorial(trigger) {
    if (!this._tutSteps.length) return;
    if (trigger === 'launch' && this._tutStep === 0 && this._tutSteps.length > 1) {
      this._tutStep = 1;
      this._tutText.setText(this._tutSteps[1]);
    } else if (trigger === 'ability' && this._tutStep >= 1) {
      this.tweens.add({ targets: this._tutText, alpha: 0, duration: 500, onComplete: () => this._tutText.destroy() });
      this._tutSteps = [];
    }
  }

  // ----------------------------------------------------------- gameplay

  _onLaunch(vx, vy) {
    if (this._paused || this._gameOver || this.launchesLeft <= 0) return;
    this.launchesLeft--;
    this._refreshLaunchIcons();
    this.ferret.launch(vx, vy);
    this._advanceTutorial('launch');
  }

  _tryActivateAbility() {
    if (this._paused || this._gameOver) return;
    if (this.abilities.activateSelected()) this._advanceTutorial('ability');
  }

  _onCollision(event) {
    const now = this.time.now;
    for (const pair of event.pairs) {
      const a = pair.bodyA.gameObject;
      const b = pair.bodyB.gameObject;
      if (!a || !b) continue;
      const impact = Math.max(pair.bodyA.speed, pair.bodyB.speed);

      if (this._physSteps > this._graceSteps) {
        this._maybeDamageDebris(a, b, impact);
        this._maybeDamageDebris(b, a, impact);
        if (a instanceof GuineaPig) a.onHit(impact);
        if (b instanceof GuineaPig) b.onHit(impact);
      }

      const noisy = a instanceof Debris || b instanceof Debris || a instanceof PoisonHoney || b instanceof PoisonHoney;
      if (noisy && impact > 3 && now - (this._lastCrash || 0) > 160) {
        this._lastCrash = now;
        this.audio.sfx('crash');
      }
    }
  }

  _maybeDamageDebris(d, other, impact) {
    if (!(d instanceof Debris) || d.dead) return;
    const t = d.typeCfg;
    if (t.bluntImmune) return; // metal only breaks via lightning/bees
    const eff = other instanceof PoisonHoney ? impact * 1.3 : impact;
    const threshold = t.fragile ? 3.2 : 3.6; // above stack-settle jitter; ferret hits are 10+
    if (eff < threshold) return;
    const dmg = t.fragile ? 99 : 1 + Math.floor((eff - threshold) / 4);
    if (this._dbg) this._dbgLog(`DMG ${d.debrisType}@${Math.round(d.x)},${Math.round(d.y)} imp=${eff.toFixed(2)} dmg=${dmg} hp=${d.hp}`);
    d.damage(dmg, this);
  }

  onDebrisDestroyed(d) {
    if (this._dbg) this._dbgLog(`DESTROY ${d.debrisType}@${Math.round(d.x)},${Math.round(d.y)}`);
    this.score += d.points;
    this.debrisScore += d.points;
    this.scoreText.setText(`${this.score}`);
    this._floatText(d.x, d.y, `+${d.points}`, '#fde68a');
    this.audio.sfx(d.typeCfg.sfx);
    // dynamic secondary collapses (Level 10 triggers)
    for (const tr of this._triggers) {
      if (tr.watchIndex === d.spawnIndex && !tr.fired) {
        tr.fired = true;
        this.time.delayedCall(tr.delay || 400, () => {
          for (const cfg of tr.spawn) {
            const nd = new Debris(this, Object.assign({ hpMult: this.diff.debrisHpMult }, cfg));
            nd.spawnIndex = -1;
            this.debris.push(nd);
          }
          this.cameras.main.shake(200, 0.004);
        });
      }
    }
  }

  onGuineaPigRescued(gp) {
    this.rescueCount++;
    this.score += 1000;
    this.scoreText.setText(`${this.score}`);
    this._floatText(gp.x, Math.max(60, gp.y - 40), '+1000 RESCUED!', '#86efac');
    this.spawnHearts(gp.x, gp.y - 10);
    if (this.guineaPigs.every((g) => g.rescued)) {
      this.time.delayedCall(900, () => this._win());
    }
  }

  onGuineaPigHarmed() { this.gpHarmed = true; }

  onGuineaPigFainted() {
    if (this._gameOver) return;
    this._fail('A guinea pig was knocked out!');
  }

  spawnHearts(x, y) {
    const e = this.add.particles(x, y, 'heart', {
      speed: { min: 40, max: 100 }, angle: { min: 230, max: 310 },
      lifespan: 900, scale: { start: 0.9, end: 0.2 }, gravityY: -60, emitting: false
    }).setDepth(22);
    e.explode(6, x, y);
    this.time.delayedCall(1000, () => e.destroy());
  }

  _floatText(x, y, msg, color) {
    const t = this.add.text(x, y, msg, {
      fontFamily: 'Verdana, sans-serif', fontSize: '20px', fontStyle: 'bold', color,
      stroke: '#1f2937', strokeThickness: 4
    }).setOrigin(0.5).setDepth(50);
    this.tweens.add({
      targets: t, y: y - 60, alpha: 0, duration: 900, ease: 'Cubic.easeOut',
      onComplete: () => t.destroy()
    });
  }

  // ----------------------------------------------------------- win / lose

  _win() {
    if (this._gameOver) return;
    this._gameOver = true;
    const elapsed = this.elapsed / 1000;
    const par = this.levelData.parTime || 90;
    const speedBonus = elapsed < par * 0.6 ? 1000 : elapsed < par ? 500 : 0;
    const perfectBonus = this.gpHarmed ? 0 : 2000;
    const unusedBonus = this.launchesLeft * 500;
    this.score += perfectBonus + unusedBonus + speedBonus;

    const two = this.levelData.stars.two * this.diff.starMult;
    const three = this.levelData.stars.three * this.diff.starMult;
    const stars = this.score >= three ? 3 : this.score >= two ? 2 : 1;
    SaveSystem.recordResult(this.diffKey, this.levelIndex, stars, this.score);
    this.audio.sfx('fanfare');
    this.audio.stopRain();

    this.scene.start('Victory', {
      win: true, level: this.levelIndex, stars, score: this.score,
      breakdown: {
        rescues: this.rescueCount * 1000,
        debris: this.debrisScore,
        perfect: perfectBonus,
        unused: unusedBonus,
        speed: speedBonus
      },
      difficulty: this.diffKey
    });
  }

  _fail(reason) {
    if (this._gameOver) return;
    this._gameOver = true;
    this.audio.sfx('fail');
    this.audio.stopRain();
    this.scene.start('Victory', { win: false, level: this.levelIndex, reason: reason || '' });
  }

  _togglePause() {
    if (this._gameOver) return;
    if (this._paused) return this._resume();
    this._paused = true;
    this.matter.world.pause();
    this.time.paused = true;
    // Keep Phaser's tween clock ticking so a short pause isn't caught up on resume.
    this.tweens.setGlobalTimeScale(0);
    if (this.slingshot.dragging) this.slingshot.reload();

    this._pauseItems = [];
    this._pauseItems.push(this.add.rectangle(640, 360, GAME_W, GAME_H, 0x000000, 0.5).setDepth(90));
    this._pauseItems.push(makePanel(this, 640, 360, 420, 380, { depth: 91 }));
    this._pauseItems.push(this.add.text(640, 225, 'PAUSED', {
      fontFamily: 'Verdana, sans-serif', fontSize: '38px', fontStyle: 'bold', color: '#ffd75e',
      stroke: '#4c1d95', strokeThickness: 6
    }).setOrigin(0.5).setDepth(95));
    const btns = [
      ['RESUME', () => this._resume()],
      ['RESTART (R)', () => { this._resume(); this.scene.restart({ level: this.levelIndex }); }],
      ['LEVEL SELECT', () => this.scene.start('LevelSelect')],
      ['MAIN MENU', () => this.scene.start('Menu')]
    ];
    btns.forEach(([label, cb], i) => {
      const b = makeButton(this, 640, 300 + i * 64, 250, 50, label, cb, { fontSize: 17, depth: 95 });
      this._pauseItems.push(b);
    });
  }

  _resume() {
    this._paused = false;
    this.matter.world.resume();
    this.time.paused = false;
    this.tweens.setGlobalTimeScale(1);
    for (const item of this._pauseItems || []) item.destroy();
    this._pauseItems = [];
  }

  // ----------------------------------------------------------- update

  _dbgLog(msg) {
    const t = Math.round(this.time.now);
    this._dbgLines.push(`[${t}] ${msg}`);
    if (this._dbgLines.length > 26) this._dbgLines.shift();
    this._dbgText.setText(this._dbgLines.join('\n'));
  }

  update(time, delta) {
    if (this._paused || this._gameOver) return;
    this.elapsed += delta;

    if (this._dbg) {
      if (!this._dbgNext || time > this._dbgNext) {
        this._dbgNext = time + 400;
        let mx = 0, who = '-';
        for (const d of this.debris) {
          if (d.active && !d.dead && d.body.speed > mx) { mx = d.body.speed; who = `${d.debrisType}@${Math.round(d.x)},${Math.round(d.y)}`; }
        }
        for (const g of this.guineaPigs) {
          if (g.active && !g.rescued && g.body.speed > mx) { mx = g.body.speed; who = `GP_${g.variant}@${Math.round(g.x)},${Math.round(g.y)}`; }
        }
        this._dbgLog(`peak=${mx.toFixed(2)} ${who}`);
      }
    }

    this.ferret.update(delta, { width: GAME_W, height: GAME_H });

    // Honey Trap slow field
    for (const d of this.debris) {
      if (!d.active || d.dead) continue;
      if (d.slowUntil > this.elapsed) {
        d.setVelocity(d.body.velocity.x * 0.9, d.body.velocity.y * 0.88);
      }
    }

    // guinea pig rescue checks
    for (const gp of this.guineaPigs) {
      if (gp.active && !gp.rescued) gp.update(delta, this.debris);
    }

    // turn resolution once the hero settles
    if (this.ferret.isDone) {
      if (!this._resolving) {
        this._resolving = true;
        this._turnFinishedAt = this.elapsed;
      }
      const wait = this.elapsed - this._turnFinishedAt;
      if (!this.guineaPigs.every((g) => g.rescued)) {
        if (this.launchesLeft > 0 && wait >= 900) {
          this.slingshot.reload();
          this._resolving = false;
        } else if (this.launchesLeft === 0 && wait >= 5000) {
          // Let timed abilities finish and freed animals escape, but don't wait
          // forever if an animal's route is blocked by surviving debris.
          const escaping = this.guineaPigs.some((g) => g.escaping);
          if (!escaping || wait >= 20000) {
            this._fail('Out of launches - the guinea pigs still need help!');
          }
        }
      }
    }

    this._updateAbilityBar();
  }
}
