// VictoryScene - win screen over the podium/celebration reference art
// (stars, score breakdown, next/replay/menu) and the failure screen
// over the storm-interior art with an encouraging Poison Honey.

import SaveSystem from '../systems/SaveSystem.js';
import AudioSystem from '../systems/AudioSystem.js';
import { makeButton, coverBackground, heading, makePanel } from '../systems/UI.js';

export default class VictoryScene extends Phaser.Scene {
  constructor() { super('Victory'); }

  create(data) {
    this.audio = new AudioSystem(this);
    this.data = data;

    if (data.win) this._winScreen(data);
    else this._failScreen(data);
  }

  _winScreen(data) {
    // podium/rainbow celebration art (TgjVPK19sD0xbh.3.png) + theme music
    coverBackground(this, 'bg_victory');
    this.audio.playMusic();
    this.add.rectangle(640, 360, 1280, 720, 0x1f1140, 0.25);

    heading(this, 640, 90, data.level === 10 ? 'GRAND RESCUE COMPLETE!' : 'LEVEL COMPLETE!', 52);

    // animated stars
    const starY = 175;
    const xs = [560, 640, 720];
    xs.forEach((x, i) => {
      const earned = i < data.stars;
      const s = this.add.image(x, starY, earned ? 'star' : 'star_off')
        .setScale(0).setDepth(60).setAngle(earned ? Phaser.Math.Between(-12, 12) : 0);
      this.tweens.add({
        targets: s, scale: earned ? 2.2 : 1.6, duration: 400, delay: 300 + i * 350,
        ease: 'Back.easeOut', onStart: () => { if (earned) this.audio.sfx('rescued'); }
      });
    });

    // score breakdown
    makePanel(this, 640, 400, 460, 300, { depth: 55 });
    const b = data.breakdown;
    const lines = [
      ['Guinea pigs rescued', `+${b.rescues}`],
      ['Debris destroyed', `+${b.debris}`],
      ['Perfect rescue bonus', b.perfect ? `+${b.perfect}` : '—'],
      ['Unused launch bonus', b.unused ? `+${b.unused}` : '—'],
      ['Speed bonus', b.speed ? `+${b.speed}` : '—']
    ];
    lines.forEach(([label, val], i) => {
      this.add.text(440, 280 + i * 40, label, {
        fontFamily: 'Verdana, sans-serif', fontSize: '18px', color: '#e9d5ff'
      }).setOrigin(0, 0.5).setDepth(60);
      this.add.text(840, 280 + i * 40, val, {
        fontFamily: 'Verdana, sans-serif', fontSize: '18px', fontStyle: 'bold', color: '#fde68a'
      }).setOrigin(1, 0.5).setDepth(60);
    });
    this.add.text(640, 492, `TOTAL  ${data.score}`, {
      fontFamily: 'Verdana, sans-serif', fontSize: '28px', fontStyle: 'bold', color: '#ffd75e',
      stroke: '#4c1d95', strokeThickness: 5
    }).setOrigin(0.5).setDepth(60);

    if (data.level === 10) {
      this.add.image(640, 555, 'star').setScale(1.2).setDepth(60);
      this.add.text(640, 600, 'PERFECT RESCUER BADGE EARNED!', {
        fontFamily: 'Verdana, sans-serif', fontSize: '22px', fontStyle: 'bold', color: '#ffd75e',
        stroke: '#b45309', strokeThickness: 4
      }).setOrigin(0.5).setDepth(60);
    }

    // buttons
    const prog = SaveSystem.getProgress(data.difficulty || 'medium');
    if (data.level < 10 && prog.unlocked >= data.level + 1) {
      makeButton(this, 480, 660, 210, 56, 'NEXT LEVEL', () => {
        this.scene.start('Game', { level: data.level + 1 });
      }, { fontSize: 19 });
    }
    makeButton(this, 720, 660, 180, 56, 'REPLAY', () => {
      this.scene.start('Game', { level: data.level });
    }, { fontSize: 19 });
    makeButton(this, 950, 660, 190, 56, 'LEVELS', () => this.scene.start('LevelSelect'), { fontSize: 19 });

    // confetti
    this.add.particles(0, -20, 'sparkle', {
      x: { min: 0, max: 1280 }, y: -20,
      speedY: { min: 60, max: 160 }, speedX: { min: -30, max: 30 },
      rotate: { min: 0, max: 360 }, scale: { min: 0.5, max: 1.2 },
      lifespan: 4500, frequency: 120, quantity: 2,
      tint: [0xffd75e, 0xec4899, 0x7c3aed, 0x34d399, 0x60a5fa]
    }).setDepth(70);
  }

  _failScreen(data) {
    coverBackground(this, 'bg_interior_damage');
    this.add.rectangle(640, 360, 1280, 720, 0x14082e, 0.6);

    heading(this, 640, 130, 'OH NO!', 56, '#f9a8d4');
    this.add.text(640, 200, data.reason || 'The guinea pigs still need help!', {
      fontFamily: 'Verdana, sans-serif', fontSize: '22px', color: '#ede9fe', align: 'center'
    }).setOrigin(0.5);

    // encouraging Poison Honey animation
    const ferret = this.add.image(640, 400, 'ferret').setScale(2.2);
    this.tweens.add({ targets: ferret, y: 380, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: ferret, angle: 4, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.add.text(640, 520, '"Never give up - every guinea pig counts!"', {
      fontFamily: 'Verdana, sans-serif', fontSize: '18px', fontStyle: 'italic', color: '#fde68a'
    }).setOrigin(0.5);

    makeButton(this, 540, 610, 200, 58, 'RETRY (R)', () => {
      this.scene.start('Game', { level: data.level });
    }, { fontSize: 19 });
    makeButton(this, 770, 610, 200, 58, 'MENU', () => this.scene.start('LevelSelect'), { fontSize: 19 });

    this.input.keyboard.once('keydown-R', () => this.scene.start('Game', { level: data.level }));
    this.input.keyboard.once('keydown-ENTER', () => this.scene.start('Game', { level: data.level }));
  }
}
