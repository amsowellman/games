// BootScene - loads real reference assets (backgrounds, music, intro video,
// level JSON) and procedurally generates every sprite texture in the
// cartoon style of the reference material.

import { GAME_W, GAME_H } from '../systems/SaveSystem.js';

export default class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    const fill = document.getElementById('loadfill');
    this.load.on('progress', (v) => { if (fill) fill.style.width = `${Math.round(v * 100)}%`; });

    // Reference art backgrounds (copied from Reference_Material, see REFERENCE_SUMMARY.md)
    this.load.image('bg_title', 'assets/bg/title.png');
    this.load.image('bg_storm', 'assets/bg/storm_house.png');
    this.load.image('bg_interior_storm', 'assets/bg/interior_storm.png');
    this.load.image('bg_livingroom', 'assets/bg/livingroom.png');
    this.load.image('bg_interior_damage', 'assets/bg/interior_damage.png');
    this.load.image('bg_victory', 'assets/bg/victory.png');

    // ?noaudio=1 skips the music decode (headless smoke tests stall on it)
    if (!new URLSearchParams(window.location.search).has('noaudio')) {
      this.load.audio('theme', 'assets/audio/theme.mp3');
    }

    // Intro video - referenced in place, never moved or duplicated.
    // ?novideo=1 skips it (headless smoke tests stall on video loading).
    if (!new URLSearchParams(window.location.search).has('novideo')) {
      this.load.video('introVideo', 'Reference_Material/Intro_Poison_Honey_Rescue.mp4', 'canplaythrough');
    }

    for (let i = 1; i <= 10; i++) this.load.json(`level${i}`, `assets/levels/level${i}.json`);
  }

  create() {
    const el = document.getElementById('loading');
    if (el) el.remove();

    this._genParticles();
    this._genFerret();
    this._genGuineaPigs();
    this._genDebrisTiles();
    this._genUI();

    // dev smoke-test hook: ?level=N jumps straight into a level, ?scene=X to a scene
    const q = new URLSearchParams(window.location.search);
    if (q.get('level')) {
      this.registry.set('introSeen', true);
      this.scene.start('Game', { level: Phaser.Math.Clamp(parseInt(q.get('level'), 10) || 1, 1, 10) });
    } else if (q.get('scene') === 'Victory') {
      this.scene.start('Victory', q.get('win') === '0'
        ? { win: false, level: 1, reason: 'Out of launches - the guinea pigs still need help!' }
        : { win: true, level: 5, stars: 2, score: 5430, difficulty: 'medium',
            breakdown: { rescues: 3000, debris: 430, perfect: 2000, unused: 0, speed: 0 } });
    } else if (q.get('scene')) {
      this.scene.start(q.get('scene'));
    } else {
      this.scene.start('Menu');
    }
  }

  // ---------- particles & small bits ----------
  _genParticles() {
    let g = this.make.graphics({ add: false });

    g.fillStyle(0xffffff, 1).fillCircle(6, 6, 6);
    g.generateTexture('dot', 12, 12); g.clear();

    g.fillStyle(0xffd23e, 1);
    g.fillTriangle(2, 0, 12, 0, 20, 8);
    g.fillTriangle(12, 0, 20, 8, 12, 16);
    g.fillTriangle(2, 0, 12, 16, 2, 16);
    g.fillTriangle(2, 16, 12, 16, 20, 8);
    g.generateTexture('chevron', 22, 16); g.clear();

    g.fillStyle(0xbcd8ff, 0.9).fillRoundedRect(0, 0, 4, 16, 2);
    g.generateTexture('drop', 4, 16); g.clear();

    g.fillStyle(0xffffff, 0.75).fillEllipse(20, 2, 40, 4);
    g.generateTexture('streak', 40, 6); g.clear();

    g.fillStyle(0xffffff, 0.9).fillCircle(10, 10, 9);
    g.fillStyle(0xffffff, 0.35).fillCircle(10, 10, 10);
    g.generateTexture('puff', 20, 20); g.clear();

    g.fillStyle(0xfbbf24, 1).fillCircle(5, 5, 4);
    g.fillStyle(0x000000, 1).fillRect(2, 3, 2, 4);
    g.generateTexture('bee', 10, 10); g.clear();

    g.fillStyle(0xffffff, 1);
    g.fillTriangle(6, 0, 9, 4, 6, 8);
    g.fillTriangle(6, 0, 3, 4, 6, 8);
    g.fillTriangle(2, 4, 10, 4, 6, 8);
    g.generateTexture('sparkle', 12, 10); g.clear();

    g.fillStyle(0xff5e78, 1);
    g.fillCircle(5, 5, 5); g.fillCircle(11, 5, 5);
    g.fillTriangle(0, 7, 16, 7, 8, 15);
    g.generateTexture('heart', 16, 16); g.clear();

    g.destroy();
  }

  // ---------- Poison Honey (matches title-art: brown/white ferret,
  // red-yellow striped cape, blue belt with honey-jar buckle) ----------
  _genFerret() {
    const g = this.make.graphics({ add: false });
    const W = 96, H = 116;

    // cape flowing behind (left)
    g.fillStyle(0xd92632, 1);
    g.fillPoints([{ x: 44, y: 34 }, { x: 8, y: 52 }, { x: 14, y: 78 }, { x: 44, y: 66 }], true);
    g.lineStyle(6, 0xf7c531, 1);
    g.beginPath(); g.moveTo(36, 40); g.lineTo(12, 56); g.strokePath();
    g.beginPath(); g.moveTo(38, 52); g.lineTo(16, 66); g.strokePath();

    // tail
    g.fillStyle(0x5f4634, 1).fillEllipse(18, 96, 22, 12);

    // body
    g.fillStyle(0x7a5a43, 1).fillEllipse(52, 74, 48, 66);
    g.fillStyle(0xf5e6cf, 1).fillEllipse(57, 82, 27, 42);

    // feet
    g.fillStyle(0x5f4634, 1).fillEllipse(42, 106, 18, 10).fillEllipse(64, 106, 18, 10);

    // raised fist
    g.fillStyle(0x7a5a43, 1).fillCircle(78, 46, 9);

    // head
    g.fillStyle(0x7a5a43, 1).fillCircle(52, 30, 23);
    // ears
    g.fillStyle(0x7a5a43, 1).fillCircle(35, 12, 8).fillCircle(69, 12, 8);
    g.fillStyle(0xf0b9c0, 1).fillCircle(35, 12, 4).fillCircle(69, 12, 4);
    // face blaze + dark eye mask (ferret markings)
    g.fillStyle(0xf5e6cf, 1).fillEllipse(52, 26, 18, 26);
    g.fillStyle(0x4a3628, 1).fillEllipse(42, 30, 13, 11).fillEllipse(62, 30, 13, 11);
    // eyes
    g.fillStyle(0xffffff, 1).fillCircle(43, 28, 5).fillCircle(61, 28, 5);
    g.fillStyle(0x1f130c, 1).fillCircle(44, 28, 2.6).fillCircle(62, 28, 2.6);
    g.fillStyle(0xffffff, 1).fillCircle(45, 27, 1).fillCircle(63, 27, 1);
    // nose + mouth
    g.fillStyle(0xe98a9b, 1).fillCircle(52, 38, 3.4);
    g.lineStyle(2, 0x4a3628, 1);
    g.beginPath(); g.moveTo(52, 41); g.lineTo(52, 45); g.strokePath();

    // superhero belt + honey-jar buckle
    g.fillStyle(0x2b4c9b, 1).fillRect(30, 92, 46, 9);
    g.fillStyle(0xf7c531, 1).fillRect(46, 90, 14, 13);
    g.fillStyle(0xb45309, 1).fillRect(50, 93, 6, 7);

    g.generateTexture('ferret', W, H);
    g.destroy();
  }

  // ---------- guinea pig variants ----------
  _genGuineaPigs() {
    const mk = (key, W, H, draw) => {
      const g = this.make.graphics({ add: false });
      draw(g, W, H);
      g.generateTexture(key, W, H);
      g.destroy();
    };
    const face = (g, cx, cy, s = 1) => {
      g.fillStyle(0xffffff, 1).fillCircle(cx + 11 * s, cy - 6 * s, 4.6 * s);
      g.fillStyle(0x241812, 1).fillCircle(cx + 12 * s, cy - 6 * s, 2.4 * s);
      g.fillStyle(0xffffff, 1).fillCircle(cx + 13 * s, cy - 7 * s, 0.9 * s);
      g.fillStyle(0xf2a3b3, 1).fillCircle(cx + 19 * s, cy + 1 * s, 2.6 * s);
      g.fillStyle(0xd98a9b, 1).fillEllipse(cx + 8 * s, cy - 13 * s, 8 * s, 6 * s);
    };

    // Blue Swirl - white with blue swirl markings + blue bow
    mk('gp_blue', 58, 50, (g) => {
      g.fillStyle(0xf8fafc, 1).fillEllipse(27, 30, 44, 32);
      g.lineStyle(2.5, 0x3b82f6, 1);
      g.strokeCircle(18, 30, 5); g.strokeCircle(30, 38, 4); g.strokeCircle(34, 24, 4.5);
      g.fillStyle(0x3b82f6, 1).fillCircle(18, 30, 1.6).fillCircle(30, 38, 1.4).fillCircle(34, 24, 1.5);
      // bow
      g.fillStyle(0x2563eb, 1);
      g.fillTriangle(22, 8, 12, 2, 13, 13);
      g.fillTriangle(24, 8, 34, 2, 33, 13);
      g.fillCircle(23, 8, 3.4);
      g.fillStyle(0xffffff, 1).fillCircle(15, 7, 1.3).fillCircle(31, 7, 1.3);
      face(g, 27, 30);
    });

    // Brown and White - standard
    mk('gp_brown', 58, 50, (g) => {
      g.fillStyle(0xb07a45, 1).fillEllipse(27, 30, 44, 32);
      g.fillStyle(0xfaf3e6, 1).fillEllipse(30, 36, 32, 18);
      g.fillStyle(0xfaf3e6, 1).fillCircle(40, 22, 9);
      face(g, 27, 30);
    });

    // Orange Fluffy - big fluffy orange
    mk('gp_orange', 62, 54, (g) => {
      g.fillStyle(0xd97c2e, 1).fillEllipse(29, 32, 52, 38);
      g.fillStyle(0xef9b4a, 1).fillEllipse(29, 31, 46, 33);
      g.fillStyle(0xf7cd8f, 1).fillEllipse(33, 38, 26, 16);
      g.lineStyle(2, 0xc96f26, 1);
      g.strokeEllipse(29, 32, 52, 38);
      face(g, 29, 31, 1.05);
    });

    // Baby - tiny, cream, pink bow, cannot move
    mk('gp_baby', 42, 36, (g) => {
      g.fillStyle(0xf3e2c7, 1).fillEllipse(20, 22, 30, 22);
      g.fillStyle(0xf7b8c4, 1).fillCircle(14, 24, 2.4).fillCircle(30, 24, 2.4);
      g.fillStyle(0xf472b6, 1);
      g.fillTriangle(16, 8, 10, 4, 11, 11);
      g.fillTriangle(18, 8, 24, 4, 23, 11);
      g.fillCircle(17, 8, 2.2);
      face(g, 20, 21, 0.72);
    });
  }

  // ---------- debris tiles (stretched over block bodies) ----------
  _genDebrisTiles() {
    const mk = (key, w, h, draw) => {
      const g = this.make.graphics({ add: false });
      draw(g, w, h);
      g.generateTexture(key, w, h);
      g.destroy();
    };

    mk('wood', 64, 64, (g, w, h) => {
      g.fillStyle(0x9a6a3a, 1).fillRect(0, 0, w, h);
      g.fillStyle(0x8a5a2e, 1).fillRect(0, 0, w, 6).fillRect(0, h - 6, w, 6);
      g.lineStyle(2, 0x7a4c26, 0.9);
      for (let y = 16; y < h; y += 16) g.lineBetween(4, y, w - 4, y);
      g.lineStyle(1.5, 0xb98a54, 0.8);
      g.lineBetween(6, 10, w - 8, 11); g.lineBetween(10, 30, w - 6, 29);
    });

    mk('stone', 64, 64, (g, w, h) => {
      g.fillStyle(0x9aa0a8, 1).fillRect(0, 0, w, h);
      g.fillStyle(0x7c828c, 1).fillRect(0, 0, w, 5).fillRect(0, 0, 5, h);
      g.fillStyle(0xb9bec6, 1).fillRect(0, h - 5, w, 5).fillRect(w - 5, 0, 5, h);
      g.fillStyle(0x878d96, 1).fillCircle(20, 24, 4).fillCircle(44, 42, 5).fillCircle(38, 16, 3);
    });

    mk('metal', 64, 64, (g, w, h) => {
      g.fillStyle(0x5f7386, 1).fillRect(0, 0, w, h);
      g.fillStyle(0x47586a, 1).fillRect(0, 0, w, 6).fillRect(0, h - 6, w, 6);
      g.fillStyle(0x7e93a8, 1).fillRect(4, 8, w - 8, 4);
      g.fillStyle(0x33404e, 1);
      g.fillCircle(10, 12, 3).fillCircle(w - 10, 12, 3).fillCircle(10, h - 12, 3).fillCircle(w - 10, h - 12, 3);
    });

    mk('glass', 64, 64, (g, w, h) => {
      g.fillStyle(0xbfe3f5, 0.85).fillRect(0, 0, w, h);
      g.fillStyle(0xffffff, 0.9).fillTriangle(6, h - 6, 6, 14, 24, 6);
      g.lineStyle(3, 0x8fc6e8, 1).strokeRect(2, 2, w - 4, h - 4);
    });

    mk('hay', 64, 64, (g, w, h) => {
      g.fillStyle(0xdcb84e, 1).fillRect(0, 0, w, h);
      g.lineStyle(2, 0xb9902f, 0.9);
      for (let y = 10; y < h; y += 12) g.lineBetween(2, y, w - 2, y + 3);
      g.lineStyle(2, 0xf1d789, 0.9);
      for (let y = 14; y < h; y += 14) g.lineBetween(4, y, w - 4, y - 2);
    });

    mk('trunk', 128, 64, (g, w, h) => {
      g.fillStyle(0x4f3a26, 1).fillRect(0, 0, w, h);
      g.fillStyle(0x5f4832, 1).fillRect(0, 6, w, 8).fillRect(0, h - 14, w, 8);
      g.lineStyle(3, 0x3c2c1c, 0.9);
      g.lineBetween(0, 22, w, 26); g.lineBetween(0, 40, w, 36);
      g.fillStyle(0x6f5a40, 1).fillCircle(30, 30, 5).fillCircle(88, 36, 4);
      g.fillStyle(0x3f6b2f, 1).fillEllipse(100, 8, 26, 8).fillEllipse(20, 56, 30, 8);
    });
  }

  // ---------- UI textures: stars, lock, ability icons ----------
  _genUI() {
    const g = this.make.graphics({ add: false });

    const star = (color, key) => {
      g.clear();
      const cx = 18, cy = 18, R = 16, r = 7;
      const pts = [];
      for (let i = 0; i < 10; i++) {
        const ang = -Math.PI / 2 + (i * Math.PI) / 5;
        const rad = i % 2 === 0 ? R : r;
        pts.push({ x: cx + Math.cos(ang) * rad, y: cy + Math.sin(ang) * rad });
      }
      g.fillStyle(color, 1).fillPoints(pts, true);
      g.lineStyle(2, 0xffffff, 0.7).strokePoints(pts, true);
      g.generateTexture(key, 36, 36);
    };
    star(0xffd23e, 'star');
    star(0x4b5563, 'star_off');

    // lock icon
    g.clear();
    g.fillStyle(0xf3f4f6, 1).fillRoundedRect(4, 14, 24, 16, 4);
    g.lineStyle(4, 0xf3f4f6, 1);
    g.beginPath(); g.arc(16, 14, 7, Math.PI, 0, false); g.strokePath();
    g.fillStyle(0x374151, 1).fillCircle(16, 21, 3);
    g.generateTexture('lock', 32, 32);

    // ability icons 64x64
    const icon = (key, bg, draw) => {
      g.clear();
      g.fillStyle(bg, 1).fillRoundedRect(0, 0, 64, 64, 14);
      g.lineStyle(3, 0xffffff, 0.8); g.strokeRoundedRect(2, 2, 60, 60, 12);
      draw(g);
      g.generateTexture(key, 64, 64);
    };

    icon('ab_blast', 0x7c3aed, (gg) => {
      gg.lineStyle(4, 0xffffff, 1).strokeCircle(32, 32, 15);
      gg.fillStyle(0xffffff, 1).fillCircle(32, 32, 6);
      gg.lineStyle(2, 0xe9d5ff, 1).strokeCircle(32, 32, 22);
    });
    icon('ab_trap', 0xd97706, (gg) => {
      gg.fillStyle(0xfde68a, 1);
      gg.fillCircle(32, 38, 12);
      gg.fillTriangle(32, 12, 22, 32, 42, 32);
      gg.fillStyle(0xffffff, 0.8).fillCircle(28, 36, 3.4);
    });
    icon('ab_bolt', 0xeab308, (gg) => {
      gg.fillStyle(0x1f2937, 1);
      gg.fillPoints([{ x: 38, y: 10 }, { x: 20, y: 36 }, { x: 30, y: 36 }, { x: 24, y: 54 }, { x: 44, y: 28 }, { x: 33, y: 28 }], true);
    });
    icon('ab_bees', 0x92400e, (gg) => {
      gg.fillStyle(0xfbbf24, 1);
      gg.fillCircle(24, 26, 6); gg.fillCircle(40, 24, 6); gg.fillCircle(32, 42, 6);
      gg.fillStyle(0x1f2937, 1);
      gg.fillRect(21, 24, 6, 2); gg.fillRect(37, 22, 6, 2); gg.fillRect(29, 40, 6, 2);
    });
    icon('ab_wind', 0x0d9488, (gg) => {
      gg.lineStyle(4, 0xffffff, 1);
      gg.beginPath(); gg.moveTo(12, 24); gg.lineTo(44, 24); gg.strokePath();
      gg.beginPath(); gg.moveTo(16, 34); gg.lineTo(52, 34); gg.strokePath();
      gg.beginPath(); gg.moveTo(12, 44); gg.lineTo(40, 44); gg.strokePath();
      gg.fillStyle(0xffffff, 1);
      gg.fillTriangle(44, 18, 44, 30, 54, 24);
      gg.fillTriangle(52, 28, 52, 40, 60, 34);
    });
    icon('ab_shield', 0x16a34a, (gg) => {
      gg.fillStyle(0xffffff, 1);
      gg.fillPoints([{ x: 32, y: 10 }, { x: 50, y: 18 }, { x: 48, y: 38 }, { x: 32, y: 54 }, { x: 16, y: 38 }, { x: 14, y: 18 }], true);
      gg.fillStyle(0x16a34a, 1).fillCircle(32, 31, 9);
      gg.fillStyle(0xffffff, 1).fillRect(30, 24, 4, 14).fillRect(25, 29, 14, 4);
    });

    g.destroy();
  }
}
