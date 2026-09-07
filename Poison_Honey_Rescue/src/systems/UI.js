// UI - shared widget helpers styled after the title-screen reference art:
// honey-drip pink buttons, dark translucent panels, star rows.

import InputManager from './InputManager.js';

/** Honey-drip button (min 48px touch target enforced on mobile). */
export function makeButton(scene, x, y, w, h, label, onClick, opts = {}) {
  const size = InputManager.targetSize;
  h = Math.max(h, Math.min(size, 60));
  const fontSize = opts.fontSize || Math.min(30, h * 0.42);
  const c = scene.add.container(x, y).setDepth(opts.depth || 50);

  const g = scene.add.graphics();
  const draw = (pressed, hover) => {
    g.clear();
    const base = pressed ? 0xdb2777 : hover ? 0xf472b6 : 0xec4899;
    g.fillStyle(0x9d174d, 1).fillRoundedRect(-w / 2, -h / 2 + 3, w, h, h * 0.3);
    g.fillStyle(base, 1).fillRoundedRect(-w / 2, -h / 2, w, h, h * 0.3);
    // honey drip band
    g.fillStyle(0xfbbf24, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h * 0.32, { tl: h * 0.3, tr: h * 0.3, bl: 0, br: 0 });
    const n = Math.max(3, Math.floor(w / 46));
    for (let i = 0; i < n; i++) {
      const dx = -w / 2 + (i + 0.5) * (w / n);
      g.fillCircle(dx, -h / 2 + h * 0.3, 4 + (i % 2) * 2.5);
    }
  };
  draw(false, false);

  const text = scene.add.text(0, 2, label, {
    fontFamily: 'Verdana, sans-serif', fontSize: `${fontSize}px`, fontStyle: 'bold',
    color: '#ffffff', stroke: '#9d174d', strokeThickness: 4
  }).setOrigin(0.5);

  const zone = scene.add.zone(0, 0, w, h).setInteractive({ useHandCursor: false });
  c.add([g, text, zone]);
  InputManager.handCursor(scene, zone);
  zone.on('pointerover', () => draw(false, true));
  zone.on('pointerout', () => draw(false, false));
  zone.on('pointerdown', () => { draw(true, false); scene.events.emit('ui:down'); });
  zone.on('pointerup', () => {
    draw(false, true);
    if (scene.audio) scene.audio.sfx('click');
    onClick();
  });
  c.setSize(w, h);
  c.redraw = draw;
  return c;
}

/** Dark translucent panel with purple border. */
export function makePanel(scene, x, y, w, h, opts = {}) {
  const g = scene.add.graphics().setDepth(opts.depth || 80);
  g.fillStyle(0x1f1140, opts.alpha != null ? opts.alpha : 0.92);
  g.fillRoundedRect(x - w / 2, y - h / 2, w, h, 18);
  g.lineStyle(3, 0x9333ea, 0.9);
  g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 18);
  return g;
}

/** Row of earned/empty stars centered at x,y. Returns the star images. */
export function addStarRow(scene, x, y, earned, total = 3, scale = 1) {
  const imgs = [];
  const gap = 34 * scale;
  const startX = x - ((total - 1) * gap) / 2;
  for (let i = 0; i < total; i++) {
    imgs.push(scene.add.image(startX + i * gap, y, i < earned ? 'star' : 'star_off').setScale(scale));
  }
  return imgs;
}

/** Cover-fit a background image to the game canvas. */
export function coverBackground(scene, key) {
  const img = scene.add.image(640, 360, key).setDepth(-10);
  const s = Math.max(1280 / img.width, 720 / img.height);
  img.setScale(s);
  return img;
}

/** Outlined heading text. */
export function heading(scene, x, y, label, size = 44, color = '#ffd75e') {
  return scene.add.text(x, y, label, {
    fontFamily: 'Verdana, sans-serif', fontSize: `${size}px`, fontStyle: 'bold',
    color, stroke: '#4c1d95', strokeThickness: 6
  }).setOrigin(0.5);
}

/** Simple horizontal slider for settings (drag handle). */
export function makeSlider(scene, x, y, w, value, onChange) {
  const c = scene.add.container(x, y).setDepth(90);
  const track = scene.add.graphics();
  track.fillStyle(0x4b5563, 1).fillRoundedRect(-w / 2, -5, w, 10, 5);
  const fillG = scene.add.graphics();
  const handle = scene.add.circle(0, 0, 14, 0xfbbf24).setStrokeStyle(3, 0xb45309);
  const zone = scene.add.zone(0, 0, w + 30, 40).setInteractive({ useHandCursor: false });
  c.add([track, fillG, handle, zone]);
  InputManager.handCursor(scene, zone);

  const render = (v) => {
    fillG.clear();
    fillG.fillStyle(0xf59e0b, 1).fillRoundedRect(-w / 2, -5, w * v, 10, 5);
    handle.x = -w / 2 + w * v;
  };
  render(value);

  const setFromPointer = (p) => {
    const localX = p.x - x; // zone is at scene coords via container; containers don't transform input, so compute manually
    const v = Phaser.Math.Clamp(localX / w + 0.5, 0, 1);
    render(v);
    onChange(v);
  };
  let dragging = false;
  zone.on('pointerdown', (p) => { dragging = true; setFromPointer(p); });
  scene.input.on('pointermove', (p) => { if (dragging && p.isDown) setFromPointer(p); });
  scene.input.on('pointerup', () => { dragging = false; });
  return c;
}
