// Soccer Stars - global configuration and shared helpers.
// Everything is procedural: no external assets are loaded at runtime.

const GAME_WIDTH = 960;
const GAME_HEIGHT = 600;

// Selectable players. Meshes are built in characters.js from primitives.
const CHARACTERS = [
    { key: 'lion',     name: 'Lion',     blurb: 'Golden mane, golden boot'   },
    { key: 'hyena',    name: 'Hyena',    blurb: 'Scrappy sloped-back striker' },
    { key: 'giraffe',  name: 'Giraffe',  blurb: 'Heads everything, everywhere' },
    { key: 'elephant', name: 'Elephant', blurb: 'Big ears, bigger headers'    }
];

// Physics tuning for the play scene (units are meters-ish).
const PHYS = {
    gravity: -30,
    moveSpeed: 8.5,
    jumpVelocity: 13.5,
    maxX: 6.0,          // horizontal clamp for the player
    playerHalfW: 0.42   // collision half-width
};

// Vertical climb tuning.
const CLIMB = {
    targetHeight: 200,  // reach this height to win
    minGap: 1.7,        // min vertical gap between platforms
    maxGap: 2.7,        // max vertical gap (grows slightly with height)
    platMinW: 1.7,
    platMaxW: 3.4,
    movingChance: 0.16  // fraction of platforms that slide horizontally
};

const STORAGE_KEYS = {
    best: 'soccer-stars-best',
    music: 'soccer-stars-music'
};

const GAME_SETTINGS = {
    character: 'lion'
};

// Small shared helpers (DOM + three.js cleanup + canvas sprites).
const Utils = {
    el(tag, cls, html) {
        const e = document.createElement(tag);
        if (cls) e.className = cls;
        if (html !== undefined) e.innerHTML = html;
        return e;
    },

    // Free GPU resources held by an object tree before dropping it.
    dispose(root) {
        root.traverse((obj) => {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
                const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
                for (const m of mats) {
                    if (m.map) m.map.dispose();
                    m.dispose();
                }
            }
        });
    },

    // Text rendered to a canvas, used for floating name labels in 3D.
    textSprite(text, opts) {
        opts = opts || {};
        const fontPx = opts.fontPx || 40;
        const color = opts.color || '#ffffff';
        const pad = 20;
        const c = document.createElement('canvas');
        const g = c.getContext('2d');
        g.font = 'bold ' + fontPx + 'px "Courier New", monospace';
        c.width = Math.ceil(g.measureText(text).width) + pad * 2;
        c.height = fontPx + pad * 2;
        const g2 = c.getContext('2d');
        g2.font = 'bold ' + fontPx + 'px "Courier New", monospace';
        g2.textAlign = 'center';
        g2.textBaseline = 'middle';
        g2.shadowColor = 'rgba(0,0,0,0.8)';
        g2.shadowBlur = 6;
        g2.fillStyle = color;
        g2.fillText(text, c.width / 2, c.height / 2);
        const tex = new THREE.CanvasTexture(c);
        tex.minFilter = THREE.LinearFilter;
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
        const h = opts.worldH || 0.5;
        sprite.scale.set(h * (c.width / c.height), h, 1);
        return sprite;
    }
};
