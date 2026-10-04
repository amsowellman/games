// Soccer Stars - champions' podium: golden ball, falling confetti,
// final height, and play-again / menu options.

const SceneVictory = {
    enter(data) {
        data = data || {};
        const score = data.score || 0;
        const best = data.best || 0;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x06210f);
        this.camera = new THREE.PerspectiveCamera(55, GAME_WIDTH / GAME_HEIGHT, 0.1, 100);
        this.camera.position.set(0, 1.8, 7);
        this.camera.lookAt(0, 1.4, 0);

        this.scene.add(new THREE.AmbientLight(0xffffff, 0.5));
        const glow = new THREE.DirectionalLight(0xfff2b0, 1.2);
        glow.position.set(3, 6, 5);
        this.scene.add(glow);
        const rim = new THREE.PointLight(0xffd700, 1.0, 20);
        rim.position.set(0, 3, 3);
        this.scene.add(rim);

        // podium + golden ball
        const podium = new THREE.Mesh(
            new THREE.CylinderGeometry(1.6, 2.0, 0.6, 24),
            new THREE.MeshLambertMaterial({ color: 0x0d3a1d })
        );
        podium.position.set(0, 0, 0);
        this.scene.add(podium);

        this.goldBall = new THREE.Mesh(
            new THREE.SphereGeometry(0.85, 24, 18),
            new THREE.MeshLambertMaterial({ color: 0xffd700 })
        );
        this.goldBall.position.set(0, 1.6, 0);
        this.scene.add(this.goldBall);

        // recycled confetti rain
        this.confetti = [];
        const colors = [0x3ddc63, 0xffd700, 0xffffff, 0xff6fa5, 0x2a9de0];
        for (let i = 0; i < 60; i++) {
            const bit = new THREE.Mesh(
                new THREE.BoxGeometry(0.14, 0.14, 0.03),
                new THREE.MeshLambertMaterial({ color: colors[i % colors.length] })
            );
            bit.position.set((Math.random() - 0.5) * 12, Math.random() * 7 + 1, (Math.random() - 0.5) * 4);
            bit.userData.vy = 1.5 + Math.random() * 1.5;
            bit.userData.spin = (Math.random() - 0.5) * 6;
            bit.userData.sway = Math.random() * Math.PI * 2;
            this.confetti.push(bit);
            this.scene.add(bit);
        }

        const overlay = Utils.el('div', 'overlay-screen');
        overlay.style.justifyContent = 'flex-start';
        overlay.style.paddingTop = '34px';
        overlay.appendChild(Utils.el('div', 'game-title gold', 'CHAMPIONS!'));
        overlay.appendChild(Utils.el('div', 'game-subtitle',
            'You reached the trophy at ' + CLIMB.targetHeight + ' m'));
        overlay.appendChild(Utils.el('div', 'score-line', 'Height: ' + score + ' m'));
        overlay.appendChild(Utils.el('div', 'best-line', 'Best: ' + best + ' m'));

        const again = Utils.el('button', 'game-button gold', 'PLAY AGAIN');
        again.addEventListener('click', () => {
            SFX.play('select');
            Game.change(ScenePlay);
        });
        overlay.appendChild(again);

        const menu = Utils.el('button', 'game-button', 'MAIN MENU');
        menu.addEventListener('click', () => {
            SFX.play('click');
            Game.change(SceneMenu);
        });
        overlay.appendChild(menu);

        overlay.appendChild(Utils.el('div', 'hint-text', 'ENTER = play again &nbsp;|&nbsp; ESC = menu'));

        this.ui = overlay;
        Game.ui.appendChild(overlay);

        this._onKey = (e) => {
            if (e.code === 'Enter') Game.change(ScenePlay);
            else if (e.code === 'Escape') Game.change(SceneMenu);
        };
        window.addEventListener('keydown', this._onKey);
    },

    update(dt) {
        this._t = (this._t || 0) + dt;
        this.goldBall.rotation.y += dt * 1.4;
        this.goldBall.position.y = 1.6 + Math.sin(this._t * 1.8) * 0.15;
        for (const bit of this.confetti) {
            bit.position.y -= bit.userData.vy * dt;
            bit.position.x += Math.sin(this._t * 2 + bit.userData.sway) * dt * 0.6;
            bit.rotation.z += bit.userData.spin * dt;
            if (bit.position.y < -0.5) {
                bit.position.y = 7 + Math.random();
                bit.position.x = (Math.random() - 0.5) * 12;
            }
        }
    },

    exit() {
        window.removeEventListener('keydown', this._onKey);
        this.ui.remove();
        this.ui = null;
        Utils.dispose(this.scene);
    }
};
