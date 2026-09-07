// LevelSelectScene - grid of 10 level cards with lock status and stars
// for the current difficulty, over the cozy living-room reference art.

import SaveSystem, { DIFFICULTIES } from '../systems/SaveSystem.js';
import AudioSystem from '../systems/AudioSystem.js';
import InputManager from '../systems/InputManager.js';
import { makeButton, coverBackground, heading, addStarRow } from '../systems/UI.js';

const LEVEL_NAMES = [
  'The Storm', 'The Fallen Oak', 'Two-Story Trouble', 'Attic Escape', 'Reinforced Ruins',
  'Kitchen Collapse', 'Multi-Room Mayhem', 'Storm Surge', 'The Fortress', 'The Grand Rescue'
];

export default class LevelSelectScene extends Phaser.Scene {
  constructor() { super('LevelSelect'); }

  create() {
    this.audio = new AudioSystem(this);
    this.input.once('pointerdown', () => this.audio.playMusic());

    coverBackground(this, 'bg_livingroom');
    this.add.rectangle(640, 360, 1280, 720, 0x1f1140, 0.55);

    const difficulty = SaveSystem.getSettings().difficulty || 'medium';
    const prog = SaveSystem.getProgress(difficulty);

    heading(this, 640, 70, 'SELECT LEVEL', 48);
    this.add.text(640, 112, `Difficulty: ${DIFFICULTIES[difficulty].label}`, {
      fontFamily: 'Verdana, sans-serif', fontSize: '18px', fontStyle: 'bold', color: '#e9d5ff',
      stroke: '#4c1d95', strokeThickness: 3
    }).setOrigin(0.5);

    const cols = 5, cardW = 210, cardH = 170, gapX = 30, gapY = 40;
    const startX = 640 - ((cols - 1) * (cardW + gapX)) / 2;
    const startY = 250;

    for (let i = 0; i < 10; i++) {
      const level = i + 1;
      const col = i % cols, row = Math.floor(i / cols);
      const x = startX + col * (cardW + gapX);
      const y = startY + row * (cardH + gapY);
      const locked = level > prog.unlocked;
      this._card(x, y, cardW, cardH, level, LEVEL_NAMES[i], locked, prog.stars[i] || 0);
    }

    makeButton(this, 120, 665, 170, 52, 'BACK', () => this.scene.start('Menu'), { fontSize: 18 });
  }

  _card(x, y, w, h, level, name, locked, stars) {
    const c = this.add.container(x, y);
    const g = this.add.graphics();
    g.fillStyle(locked ? 0x374151 : 0x6d28d9, 0.95).fillRoundedRect(-w / 2, -h / 2, w, h, 14);
    g.lineStyle(3, locked ? 0x4b5563 : 0xa855f7, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 14);

    c.add([g]);
    if (locked) {
      c.add(this.add.image(0, -14, 'lock').setScale(2));
      c.add(this.add.text(0, 44, 'LOCKED', {
        fontFamily: 'Verdana, sans-serif', fontSize: '15px', fontStyle: 'bold', color: '#9ca3af'
      }).setOrigin(0.5));
    } else {
      c.add(this.add.text(0, -h / 2 + 26, `LEVEL ${level}`, {
        fontFamily: 'Verdana, sans-serif', fontSize: '20px', fontStyle: 'bold', color: '#ffd75e',
        stroke: '#4c1d95', strokeThickness: 4
      }).setOrigin(0.5));
      c.add(this.add.text(0, -h / 2 + 52, name, {
        fontFamily: 'Verdana, sans-serif', fontSize: '12.5px', color: '#ede9fe', align: 'center',
        wordWrap: { width: w - 20 }
      }).setOrigin(0.5, 0));
      const starRow = addStarRow(this, 0, h / 2 - 30, stars, 3, 0.8);
      starRow.forEach((s) => c.add(s));

      const zone = this.add.zone(0, 0, w, h).setInteractive();
      InputManager.handCursor(this, zone);
      zone.on('pointerover', () => c.setScale(1.05));
      zone.on('pointerout', () => c.setScale(1));
      zone.on('pointerup', () => {
        this.audio.sfx('click');
        this.scene.start('Game', { level });
      });
      c.add(zone);
    }
  }
}
