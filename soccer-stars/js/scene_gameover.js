// Soccer Stars - full time screen. Shows the final height, the best height,
// and offers a rematch or a trip back to the menu.

const SceneGameOver = {
    enter(data) {
        data = data || {};
        const score = data.score || 0;
        const best = data.best || 0;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x14080c);
        this.camera = new THREE.PerspectiveCamera(55, GAME_WIDTH / GAME_HEIGHT, 0.1, 100);
        this.camera.position.set(0, 1.5, 6);

        this.scene.add(new THREE.AmbientLight(0xffffff, 0.4));
        const dim = new THREE.DirectionalLight(0xff8899, 0.6);
        dim.position.set(2, 5, 4);
        this.scene.add(dim);

        // a deflated-looking ball rolling slowly
        this.ball = Characters.soccerBall(0.9);
        this.ball.position.set(0, 0.2, 0);
        this.ball.scale.y = 0.85;
        this.scene.add(this.ball);
        const ground = new THREE.Mesh(
            new THREE.BoxGeometry(20, 0.4, 10),
            new THREE.MeshLambertMaterial({ color: 0x2a1218 })
        );
        ground.position.set(0, -0.85, 0);
        this.scene.add(ground);

        const overlay = Utils.el('div', 'overlay-screen dim');
        overlay.appendChild(Utils.el('div', 'game-title danger', 'FULL TIME'));
        overlay.appendChild(Utils.el('div', 'score-line', 'Height: ' + score + ' m'));
        overlay.appendChild(Utils.el('div', 'best-line', 'Best: ' + best + ' m'));

        const retry = Utils.el('button', 'game-button danger', 'REMATCH');
        retry.addEventListener('click', () => {
            SFX.play('select');
            Game.change(ScenePlay);
        });
        overlay.appendChild(retry);

        const menu = Utils.el('button', 'game-button', 'MAIN MENU');
        menu.addEventListener('click', () => {
            SFX.play('click');
            Game.change(SceneMenu);
        });
        overlay.appendChild(menu);

        overlay.appendChild(Utils.el('div', 'hint-text', 'ENTER = rematch &nbsp;|&nbsp; ESC = menu'));

        this.ui = overlay;
        Game.ui.appendChild(overlay);

        this._onKey = (e) => {
            if (e.code === 'Enter') Game.change(ScenePlay);
            else if (e.code === 'Escape') Game.change(SceneMenu);
        };
        window.addEventListener('keydown', this._onKey);
    },

    update(dt) {
        this.ball.rotation.z -= dt * 0.5;
        this.ball.position.x = Math.sin((this._t = (this._t || 0) + dt)) * 1.5;
    },

    exit() {
        window.removeEventListener('keydown', this._onKey);
        this.ui.remove();
        this.ui = null;
        Utils.dispose(this.scene);
    }
};
