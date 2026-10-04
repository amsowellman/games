// Soccer Stars - main menu. A slowly rotating ball over a pitch, with the
// classic START / HOW TO PLAY buttons. ENTER or SPACE also starts.

const SceneMenu = {
    enter() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0a2413);
        this.camera = new THREE.PerspectiveCamera(55, GAME_WIDTH / GAME_HEIGHT, 0.1, 100);
        this.camera.position.set(0, 1.6, 7);
        this.camera.lookAt(0, 1.2, 0);

        this.scene.add(new THREE.AmbientLight(0xffffff, 0.55));
        const sun = new THREE.DirectionalLight(0xffffff, 1.1);
        sun.position.set(4, 8, 6);
        this.scene.add(sun);

        // pitch: a green slab with white midfield markings
        const pitch = new THREE.Mesh(
            new THREE.BoxGeometry(30, 0.5, 20),
            new THREE.MeshLambertMaterial({ color: 0x1d7a38 })
        );
        pitch.position.set(0, -0.55, -2);
        this.scene.add(pitch);
        const lineMat = new THREE.MeshLambertMaterial({ color: 0xe8f5ea });
        const midLine = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.02, 20), lineMat);
        midLine.position.set(0, -0.28, -2);
        this.scene.add(midLine);
        const circle = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.07, 8, 40), lineMat);
        circle.rotation.x = -Math.PI / 2;
        circle.position.set(0, -0.28, -2);
        this.scene.add(circle);

        // hero ball
        this.ball = Characters.soccerBall(1.1);
        this.ball.position.set(0, 1.6, 0);
        this.scene.add(this.ball);

        // drifting confetti cubes for some life
        this.confetti = [];
        const colors = [0x3ddc63, 0xffd700, 0xffffff, 0xff6fa5];
        for (let i = 0; i < 24; i++) {
            const cube = new THREE.Mesh(
                new THREE.BoxGeometry(0.12, 0.12, 0.02),
                new THREE.MeshLambertMaterial({ color: colors[i % colors.length] })
            );
            cube.position.set(
                (Math.random() - 0.5) * 16,
                Math.random() * 6 - 0.5,
                (Math.random() - 0.5) * 6 - 1
            );
            cube.userData.spin = (Math.random() - 0.5) * 3;
            cube.userData.bobPhase = Math.random() * Math.PI * 2;
            this.confetti.push(cube);
            this.scene.add(cube);
        }

        this._buildUI();

        this._onKey = (e) => {
            if (e.code === 'Enter' || e.code === 'Space') {
                e.preventDefault();
                SFX.play('select');
                Game.change(SceneCharSelect);
            } else if (e.code === 'KeyM') {
                SFX.toggleMusic();
            }
        };
        window.addEventListener('keydown', this._onKey);
    },

    _buildUI() {
        const overlay = Utils.el('div', 'overlay-screen');
        overlay.appendChild(Utils.el('div', 'game-title', 'SOCCER STARS'));
        overlay.appendChild(Utils.el('div', 'game-subtitle', 'A three.js climbing match'));

        const start = Utils.el('button', 'game-button', 'KICK OFF');
        start.addEventListener('click', () => {
            SFX.play('select');
            Game.change(SceneCharSelect);
        });
        overlay.appendChild(start);

        const how = Utils.el('button', 'game-button', 'HOW TO PLAY');
        how.addEventListener('click', () => {
            SFX.play('click');
            this._showInstructions();
        });
        overlay.appendChild(how);

        overlay.appendChild(Utils.el('div', 'hint-text', 'or press SPACE / ENTER to begin'));
        overlay.appendChild(Utils.el('div', 'footer-text',
            'Made with three.js &nbsp;|&nbsp; Hosted on GitHub Pages &nbsp;|&nbsp; M = music on/off'));

        this.ui = overlay;
        Game.ui.appendChild(overlay);

        // browsers require a gesture before audio can start
        this._unlock = () => {
            SFX.ensure();
            SFX.startMusic();
            window.removeEventListener('pointerdown', this._unlock);
        };
        window.addEventListener('pointerdown', this._unlock);
    },

    _showInstructions() {
        const dim = Utils.el('div', 'overlay-screen dim clickable');
        const panel = Utils.el('div', 'panel');
        panel.appendChild(Utils.el('h2', null, 'HOW TO PLAY'));
        panel.appendChild(Utils.el('ul', null,
            '<li><b>A / Left</b> - move left</li>' +
            '<li><b>D / Right</b> - move right</li>' +
            '<li><b>W / Up / Space</b> - jump</li>' +
            '<li><b>P</b> - pause &nbsp; <b>M</b> - music on/off</li>' +
            '<li>&nbsp;</li>' +
            '<li>Climb the platforms as high as you can.</li>' +
            '<li>Fall below the camera and the match is over.</li>' +
            '<li>Reach the golden trophy at ' + CLIMB.targetHeight + 'm to win!</li>'));
        panel.appendChild(Utils.el('p', null, 'Click anywhere to close'));
        dim.appendChild(panel);
        dim.addEventListener('click', () => dim.remove());
        Game.ui.appendChild(dim);
    },

    update(dt) {
        this._t = (this._t || 0) + dt;
        this.ball.rotation.y += dt * 0.7;
        this.ball.rotation.x = Math.sin(this._t * 0.5) * 0.2;
        this.ball.position.y = 1.6 + Math.sin(this._t * 1.4) * 0.25;
        for (const cube of this.confetti) {
            cube.rotation.z += cube.userData.spin * dt;
            cube.position.y += Math.sin(this._t + cube.userData.bobPhase) * dt * 0.15;
        }
    },

    exit() {
        window.removeEventListener('keydown', this._onKey);
        if (this._unlock) window.removeEventListener('pointerdown', this._unlock);
        this.ui.remove();
        this.ui = null;
        Utils.dispose(this.scene);
    }
};
