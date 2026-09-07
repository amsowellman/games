// MenuScene - title screen using the official title art as the backdrop.
// Hosts Play, Level Select, Settings, Credits plus the platform and
// difficulty selectors. Starts the theme music on first interaction.

import SaveSystem, { DIFFICULTIES } from '../systems/SaveSystem.js';
import AudioSystem from '../systems/AudioSystem.js';
import InputManager from '../systems/InputManager.js';
import { makeButton, makePanel, makeSlider, coverBackground, heading } from '../systems/UI.js';

export default class MenuScene extends Phaser.Scene {
  constructor() { super('Menu'); }

  create() {
    this.audio = new AudioSystem(this);
    this.input.once('pointerdown', () => this.audio.playMusic());

    coverBackground(this, 'bg_title');

    // subtle animated sparkle over the artwork
    this.add.particles(0, 0, 'sparkle', {
      x: { min: 0, max: 1280 }, y: { min: 0, max: 720 },
      lifespan: 2600, frequency: 500, quantity: 1,
      scale: { min: 0.4, max: 1 }, alpha: { start: 0, end: 0.8, ease: 'Sine.easeIn' },
      duration: 1, tint: 0xfff7cc
    }).setDepth(1);

    // Cover the artwork's two painted buttons exactly (measured from title.png):
    // painted START RESCUE ~(505,507) 307x109, painted OPTIONS ~(460,625) 239x77.
    // Ours are drawn slightly larger in the same honey-drip style so the painted
    // labels never peek out from underneath.
    makeButton(this, 505, 507, 340, 120, 'START RESCUE', () => this._play(), { fontSize: 30 });
    makeButton(this, 460, 625, 280, 94, 'LEVEL SELECT', () => this.scene.start('LevelSelect'), { fontSize: 22 });
    makeButton(this, 920, 664, 170, 52, 'SETTINGS', () => this._settings(), { fontSize: 18 });
    makeButton(this, 1105, 662, 150, 52, 'CREDITS', () => this._credits(), { fontSize: 18 });

    this._buildToggles();

    if (SaveSystem.hasBadge('perfect_rescuer')) {
      this.add.image(1205, 568, 'star').setScale(1.4);
      this.add.text(1205, 603, 'PERFECT\nRESCUER', {
        fontFamily: 'Verdana, sans-serif', fontSize: '14px', fontStyle: 'bold',
        color: '#ffd75e', align: 'center', stroke: '#4c1d95', strokeThickness: 3
      }).setOrigin(0.5);
    }
  }

  _play() {
    if (!this.registry.get('introSeen')) {
      this.scene.start('IntroVideo', { next: 'LevelSelect' });
    } else {
      this.scene.start('LevelSelect');
    }
  }

  _buildToggles() {
    const s = SaveSystem.getSettings();
    const detected = InputManager.isMobile() ? 'mobile' : 'desktop';
    this.platform = s.platform || detected;
    this.difficulty = s.difficulty || 'medium';

    this.add.text(1020, 20, 'CONTROLS', {
      fontFamily: 'Verdana, sans-serif', fontSize: '15px', fontStyle: 'bold', color: '#e9d5ff',
      stroke: '#4c1d95', strokeThickness: 3
    });
    this.platformBtns = this._segmented(930, 60, ['desktop', 'mobile'], this.platform, (v) => {
      this.platform = v;
      SaveSystem.setSetting('platform', v);
      this._refreshSegments();
    });

    this.add.text(1004, 102, 'DIFFICULTY', {
      fontFamily: 'Verdana, sans-serif', fontSize: '15px', fontStyle: 'bold', color: '#e9d5ff',
      stroke: '#4c1d95', strokeThickness: 3
    });
    this.diffBtns = this._segmented(880, 146, ['easy', 'medium', 'hard'], this.difficulty, (v) => {
      this.difficulty = v;
      SaveSystem.setSetting('difficulty', v);
      this._refreshSegments();
    });

    this.add.text(1015, 192, `auto-detect: ${detected}`, {
      fontFamily: 'Verdana, sans-serif', fontSize: '12px', color: '#c4b5fd'
    });
  }

  _segmented(x, y, options, current, onPick) {
    const group = { x, y, options, onPick, items: [] };
    let cx = x;
    for (const opt of options) {
      const label = opt === 'desktop' ? 'DESKTOP' : opt === 'mobile' ? 'MOBILE' : DIFFICULTIES[opt].label.toUpperCase();
      const btn = makeButton(this, cx, y, opt === 'desktop' || opt === 'mobile' ? 120 : 100, 40, label,
        () => onPick(opt), { fontSize: 13 });
      btn.choiceValue = opt;
      group.items.push(btn);
      cx += opt === 'desktop' || opt === 'mobile' ? 128 : 108;
    }
    (this._segments = this._segments || []).push(group);
    this._refreshSegments();
    return group;
  }

  _refreshSegments() {
    for (const g of this._segments || []) {
      const current = g.options.includes(this.platform) ? this.platform : this.difficulty;
      for (const btn of g.items) {
        const active = btn.choiceValue === current;
        btn.setScale(active ? 1.08 : 0.96);
        btn.setAlpha(active ? 1 : 0.65);
      }
    }
  }

  _settings() {
    const s = SaveSystem.getSettings();
    makePanel(this, 640, 360, 560, 420);
    heading(this, 640, 190, 'SETTINGS', 36);

    this.add.text(455, 260, 'Music', { fontFamily: 'Verdana, sans-serif', fontSize: '18px', color: '#fff' });
    makeSlider(this, 700, 268, 240, s.music, (v) => {
      SaveSystem.setSetting('music', v);
      this.audio.refreshMusicVolume();
    });

    this.add.text(455, 320, 'Sound FX', { fontFamily: 'Verdana, sans-serif', fontSize: '18px', color: '#fff' });
    makeSlider(this, 700, 328, 240, s.sfx, (v) => {
      SaveSystem.setSetting('sfx', v);
      this.audio.sfx('click');
    });

    const fs = makeButton(this, 640, 400, 260, 48,
      this.scale.isFullscreen ? 'WINDOWED MODE' : 'FULLSCREEN', () => {
        if (this.scale.isFullscreen) this.scale.stopFullscreen();
        else this.scale.startFullscreen();
        fs.getAt(1).setText(this.scale.isFullscreen ? 'WINDOWED MODE' : 'FULLSCREEN');
      }, { fontSize: 16, depth: 95 });
    fs.setDepth(95);

    const reset = makeButton(this, 640, 462, 260, 48, 'RESET PROGRESS', () => {
      SaveSystem.reset();
      this.registry.set('introSeen', false);
      this.scene.restart();
    }, { fontSize: 16, depth: 95 });
    reset.setDepth(95);

    const close = makeButton(this, 640, 524, 160, 44, 'CLOSE', () => this.scene.restart(), { fontSize: 15, depth: 95 });
    close.setDepth(95);
  }

  _credits() {
    makePanel(this, 640, 360, 640, 380);
    heading(this, 640, 210, 'CREDITS', 36);
    this.add.text(640, 330, [
      'POISON HONEY RESCUE', '',
      'Starring Poison Honey the superhero ferret', '',
      'Art & story reference: Reference_Material folder',
      'Engine: Phaser 3 + Matter.js',
      'Music: Poison Honey Rescue Intro theme', '',
      'Made with honey and lightning. Rescue every guinea pig!'
    ].join('\n'), {
      fontFamily: 'Verdana, sans-serif', fontSize: '16px', color: '#ede9fe', align: 'center'
    }).setOrigin(0.5).setDepth(95);
    const close = makeButton(this, 640, 500, 160, 44, 'CLOSE', () => this.scene.restart(), { fontSize: 15, depth: 95 });
    close.setDepth(95);
  }
}
