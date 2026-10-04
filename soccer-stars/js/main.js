// Soccer Stars - bootstrap and scene manager.
// One WebGL renderer lives for the whole session; scenes swap a THREE.Scene,
// a camera, and an HTML overlay in and out via Game.change().

const Game = {
    renderer: null,
    ui: null,
    current: null,

    init() {
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        this.renderer.setSize(GAME_WIDTH, GAME_HEIGHT);
        const host = document.getElementById('three-game');
        host.insertBefore(this.renderer.domElement, host.firstChild);
        this.ui = document.getElementById('ui-layer');

        this.change(SceneBoot);

        let last = performance.now();
        const loop = (now) => {
            requestAnimationFrame(loop);
            // clamp big deltas (tab switches) so physics stays sane
            const dt = Math.min((now - last) / 1000, 0.05);
            last = now;
            if (this.current) {
                if (this.current.update) this.current.update(dt);
                if (this.current.scene && this.current.camera) {
                    this.renderer.render(this.current.scene, this.current.camera);
                }
            }
        };
        requestAnimationFrame(loop);
    },

    change(scene, data) {
        if (this.current && this.current.exit) this.current.exit();
        this.current = scene;
        scene.enter(data);
    }
};

window.addEventListener('load', () => Game.init());
