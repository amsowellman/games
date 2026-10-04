// Soccer Stars - boot scene. All assets are procedural, so this just shows
// a quick loading bar for structure parity, then kicks off to the menu.

const SceneBoot = {
    _bar: null,
    _progress: 0,

    enter() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x06130b);
        this.camera = new THREE.PerspectiveCamera(55, GAME_WIDTH / GAME_HEIGHT, 0.1, 100);
        this.camera.position.set(0, 0, 5);

        const overlay = Utils.el('div', 'overlay-screen');
        overlay.appendChild(Utils.el('div', 'game-subtitle', 'WARMING UP...'));
        const barOuter = Utils.el('div', 'boot-bar-outer');
        this._bar = Utils.el('div', 'boot-bar-inner');
        barOuter.appendChild(this._bar);
        overlay.appendChild(barOuter);
        this.ui = overlay;
        Game.ui.appendChild(overlay);
        this._progress = 0;
    },

    update(dt) {
        this._progress += dt * 1.6;
        if (this._bar) this._bar.style.width = Math.min(100, this._progress * 100) + '%';
        if (this._progress >= 1) {
            Game.change(SceneMenu);
        }
    },

    exit() {
        this.ui.remove();
        this.ui = null;
        Utils.dispose(this.scene);
    }
};
