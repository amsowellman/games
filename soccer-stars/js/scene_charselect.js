// Soccer Stars - character select. The four stars idle on podiums in 3D;
// hover highlights them, click (or keys 1-4) locks in your pick.

const SceneCharSelect = {
    enter() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0a2413);
        this.camera = new THREE.PerspectiveCamera(55, GAME_WIDTH / GAME_HEIGHT, 0.1, 100);
        this.camera.position.set(0, 2.2, 8.5);
        this.camera.lookAt(0, 1.2, 0);

        this.scene.add(new THREE.AmbientLight(0xffffff, 0.55));
        const key = new THREE.DirectionalLight(0xffffff, 1.1);
        key.position.set(3, 7, 6);
        this.scene.add(key);

        // floor
        const floor = new THREE.Mesh(
            new THREE.BoxGeometry(24, 0.4, 12),
            new THREE.MeshLambertMaterial({ color: 0x155c2c })
        );
        floor.position.set(0, -0.45, 0);
        this.scene.add(floor);

        this.picks = [];   // { key, group, ring, baseY }
        this.hovered = null;
        const xs = [-4.5, -1.5, 1.5, 4.5];

        CHARACTERS.forEach((c, i) => {
            const podium = new THREE.Mesh(
                new THREE.CylinderGeometry(0.75, 0.9, 0.5, 20),
                new THREE.MeshLambertMaterial({ color: 0x0d3a1d })
            );
            podium.position.set(xs[i], -0.05, 0);
            this.scene.add(podium);

            const ring = new THREE.Mesh(
                new THREE.TorusGeometry(0.85, 0.06, 8, 28),
                new THREE.MeshBasicMaterial({ color: 0x7dff9e })
            );
            ring.rotation.x = -Math.PI / 2;
            ring.position.set(xs[i], 0.22, 0);
            ring.visible = false;
            this.scene.add(ring);

            const mesh = Characters.build(c.key);
            mesh.position.set(xs[i], 0.2, 0);
            this.scene.add(mesh);

            const label = Utils.textSprite(c.name.toUpperCase(), { color: '#d9ffe4', worldH: 0.42 });
            label.position.set(xs[i], 2.6 + (c.key === 'giraffe' ? 0.45 : 0), 0);
            this.scene.add(label);

            this.picks.push({ key: c.key, group: mesh, ring: ring, baseY: 0.2, phase: i * 1.3 });
        });

        this._raycaster = new THREE.Raycaster();
        this._pointer = new THREE.Vector2();

        this._onMove = (e) => this._updateHover(e);
        this._onClick = (e) => {
            this._updateHover(e);
            if (this.hovered) this._select(this.hovered);
        };
        this._onKey = (e) => {
            const idx = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(e.code);
            if (idx >= 0 && this.picks[idx]) {
                this._select(this.picks[idx]);
            } else if (e.code === 'Escape') {
                Game.change(SceneMenu);
            } else if (e.code === 'KeyM') {
                SFX.toggleMusic();
            }
        };
        const canvas = Game.renderer.domElement;
        canvas.addEventListener('pointermove', this._onMove);
        canvas.addEventListener('pointerdown', this._onClick);
        window.addEventListener('keydown', this._onKey);

        // UI overlay
        const overlay = Utils.el('div', 'overlay-screen');
        overlay.style.justifyContent = 'flex-start';
        overlay.style.paddingTop = '26px';
        overlay.appendChild(Utils.el('div', 'game-title', 'CHOOSE YOUR STAR'));
        overlay.appendChild(Utils.el('div', 'hint-text', 'Click a player or press 1 - 4 &nbsp;|&nbsp; ESC = back'));
        this.ui = overlay;
        Game.ui.appendChild(overlay);
    },

    _updateHover(e) {
        const rect = Game.renderer.domElement.getBoundingClientRect();
        this._pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this._pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        this._raycaster.setFromCamera(this._pointer, this.camera);
        let found = null;
        for (const p of this.picks) {
            if (this._raycaster.intersectObject(p.group, true).length > 0) {
                found = p;
                break;
            }
        }
        if (found !== this.hovered) {
            this.hovered = found;
            for (const p of this.picks) p.ring.visible = (p === found);
            Game.renderer.domElement.style.cursor = found ? 'pointer' : 'default';
            if (found) SFX.play('click');
        }
    },

    _select(pick) {
        SFX.play('select');
        GAME_SETTINGS.character = pick.key;
        Game.change(ScenePlay);
    },

    update(dt) {
        this._t = (this._t || 0) + dt;
        for (const p of this.picks) {
            p.group.rotation.y += dt * 0.6;
            const lift = (p === this.hovered) ? 0.18 : 0;
            p.group.position.y = p.baseY + lift + Math.sin(this._t * 2 + p.phase) * 0.05;
            const s = (p === this.hovered) ? 1.12 : 1.0;
            p.group.scale.setScalar(s);
        }
    },

    exit() {
        const canvas = Game.renderer.domElement;
        canvas.removeEventListener('pointermove', this._onMove);
        canvas.removeEventListener('pointerdown', this._onClick);
        canvas.style.cursor = 'default';
        window.removeEventListener('keydown', this._onKey);
        this.ui.remove();
        this.ui = null;
        Utils.dispose(this.scene);
    }
};
