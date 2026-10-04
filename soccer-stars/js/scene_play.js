// Soccer Stars - the match itself: a vertical climbing game.
// Score = height climbed. Fall below the camera = full time (game over).
// Reach the golden trophy platform at CLIMB.targetHeight = victory.

const ScenePlay = {
    enter() {
        this.character = GAME_SETTINGS.character || 'lion';
        this.paused = false;
        this.finished = false;

        // --- world ----------------------------------------------------------
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x79c5e8);
        this.camera = new THREE.PerspectiveCamera(55, GAME_WIDTH / GAME_HEIGHT, 0.1, 200);
        this.camera.position.set(0, 4.5, 12);

        this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
        const sun = new THREE.DirectionalLight(0xffffff, 1.0);
        sun.position.set(5, 10, 8);
        this.scene.add(sun);

        // stadium floor far below (the pitch you climb away from)
        const pitch = new THREE.Mesh(
            new THREE.BoxGeometry(60, 1, 30),
            new THREE.MeshLambertMaterial({ color: 0x1d7a38 })
        );
        pitch.position.set(0, -1.0, -6);
        this.scene.add(pitch);

        // --- platforms ------------------------------------------------------
        this.platforms = [];  // { mesh, top, w, vx, minX, maxX, moving }
        this.platHeight = 0.35;
        this._addPlatform(0, 0, 12, false);          // solid starting turf
        this._nextPlatY = 0;
        this._genPlatforms(30);

        // goal platform with the trophy
        this.goalTop = CLIMB.targetHeight;
        const goal = this._addPlatform(0, this.goalTop, 5.5, false, 0xffd700);
        this.trophy = Characters.trophy();
        this.trophy.position.set(0, goal.top, 0);
        this.scene.add(this.trophy);
        this.goalLight = new THREE.PointLight(0xffd700, 1.2, 12);
        this.goalLight.position.set(0, this.goalTop + 2, 2);
        this.scene.add(this.goalLight);

        // --- clouds for altitude flavor -------------------------------------
        this.clouds = [];
        for (let y = 6; y < this.goalTop + 20; y += 7 + Math.random() * 5) {
            const cloud = this._makeCloud();
            cloud.position.set(
                (Math.random() - 0.5) * 22,
                y,
                -6 - Math.random() * 8
            );
            this.clouds.push(cloud);
            this.scene.add(cloud);
        }

        // --- player ---------------------------------------------------------
        this.player = Characters.build(this.character);
        this.player.position.set(0, 0, 0);   // origin = feet
        this.scene.add(this.player);
        this.px = 0;
        this.py = 0;                          // feet height
        this.vy = 0;
        this.grounded = true;
        this.groundPlat = this.platforms[0];
        this.facing = 1;

        // --- scoring ----------------------------------------------------------
        this.camY = 0;
        this.maxHeight = 0;
        this.best = parseInt(localStorage.getItem(STORAGE_KEYS.best) || '0', 10);
        this.newBest = false;

        // --- input ----------------------------------------------------------
        this.keys = { left: false, right: false };
        this._onKeyDown = (e) => this._handleKey(e, true);
        this._onKeyUp = (e) => this._handleKey(e, false);
        window.addEventListener('keydown', this._onKeyDown);
        window.addEventListener('keyup', this._onKeyUp);

        this._buildHUD();
        this._buildPausePanel();
        if (('ontouchstart' in window) || navigator.maxTouchPoints > 0) {
            this._buildTouchControls();
        }
    },

    // ---------------------------------------------------------------- utils
    _addPlatform(x, y, w, moving, colorOverride) {
        const color = colorOverride !== undefined ? colorOverride : (moving ? 0xe8b93a : 0x2f9e4f);
        const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(w, this.platHeight, 1.4),
            new THREE.MeshLambertMaterial({ color: color })
        );
        mesh.position.set(x, y, 0);
        // white touch-line on top, like pitch markings
        const stripe = new THREE.Mesh(
            new THREE.BoxGeometry(w, 0.04, 1.44),
            new THREE.MeshLambertMaterial({ color: 0xe8f5ea })
        );
        stripe.position.y = this.platHeight / 2;
        mesh.add(stripe);
        this.scene.add(mesh);
        const plat = {
            mesh: mesh,
            top: y + this.platHeight / 2,
            w: w,
            vx: 0, minX: 0, maxX: 0,
            moving: !!moving
        };
        if (moving) {
            const speed = 1.2 + Math.random() * 1.4;
            plat.vx = (Math.random() < 0.5 ? -1 : 1) * speed;
            const range = 1.5 + Math.random() * 1.5;
            plat.minX = Math.max(-PHYS.maxX, x - range);
            plat.maxX = Math.min(PHYS.maxX, x + range);
        }
        this.platforms.push(plat);
        return plat;
    },

    _genPlatforms(upToY) {
        while (this._nextPlatY < upToY && this._nextPlatY < CLIMB.targetHeight - 3) {
            const progress = Math.min(1, this._nextPlatY / CLIMB.targetHeight);
            const gap = CLIMB.minGap + Math.random() * (CLIMB.maxGap - CLIMB.minGap) + progress * 0.6;
            this._nextPlatY += Math.min(gap, 3.4);
            const w = CLIMB.platMinW + Math.random() * (CLIMB.platMaxW - CLIMB.platMinW) - progress * 0.5;
            const half = Math.max(0, PHYS.maxX - w / 2);
            const x = (Math.random() * 2 - 1) * half;
            const moving = Math.random() < CLIMB.movingChance;
            this._addPlatform(x, this._nextPlatY, Math.max(1.4, w), moving);
        }
    },

    _makeCloud() {
        const g = new THREE.Group();
        const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
        const sizes = [[0, 0, 0, 0.9], [0.8, -0.1, 0.1, 0.6], [-0.8, -0.1, -0.1, 0.65], [0.3, 0.35, 0, 0.55]];
        for (const [x, y, z, r] of sizes) {
            const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), mat);
            puff.position.set(x, y, z);
            puff.scale.y = 0.6;
            g.add(puff);
        }
        return g;
    },

    // ---------------------------------------------------------------- HUD
    _buildHUD() {
        this.ui = Utils.el('div');
        this.scoreChip = Utils.el('div', 'hud-chip', 'HEIGHT 0 m');
        this.scoreChip.id = 'hud-score';
        this.bestChip = Utils.el('div', 'hud-chip', 'BEST ' + this.best + ' m');
        this.bestChip.id = 'hud-best';
        this.newBestChip = Utils.el('div', 'hud-chip', 'NEW BEST!');
        this.newBestChip.id = 'hud-newbest';
        this.ui.appendChild(this.scoreChip);
        this.ui.appendChild(this.bestChip);
        this.ui.appendChild(this.newBestChip);
        Game.ui.appendChild(this.ui);
    },

    _buildPausePanel() {
        this.pausePanel = Utils.el('div', 'overlay-screen dim clickable');
        this.pausePanel.style.display = 'none';
        const panel = Utils.el('div', 'panel');
        panel.appendChild(Utils.el('h2', null, 'PAUSED'));
        panel.appendChild(Utils.el('p', null, 'Press P to resume'));
        const resume = Utils.el('button', 'game-button', 'RESUME');
        resume.addEventListener('click', (e) => { e.stopPropagation(); this._togglePause(); });
        const quit = Utils.el('button', 'game-button danger', 'QUIT TO MENU');
        quit.addEventListener('click', (e) => {
            e.stopPropagation();
            SFX.stopMusic();
            Game.change(SceneMenu);
        });
        panel.appendChild(resume);
        panel.appendChild(quit);
        this.pausePanel.appendChild(panel);
        Game.ui.appendChild(this.pausePanel);
    },

    _buildTouchControls() {
        const bar = Utils.el('div');
        bar.id = 'touch-controls';
        bar.style.display = 'flex';
        const leftGroup = Utils.el('div');
        leftGroup.id = 'touch-left-group';
        const mk = (label, cls) => {
            const b = Utils.el('div', 'tbtn clickable', label);
            return b;
        };
        const left = mk('&#9664;');
        const right = mk('&#9654;');
        const jump = mk('&#11014;');
        leftGroup.appendChild(left);
        leftGroup.appendChild(right);
        bar.appendChild(leftGroup);
        bar.appendChild(jump);
        this.ui.appendChild(bar);

        const bind = (el, on, off) => {
            el.addEventListener('pointerdown', (e) => { e.preventDefault(); on(); });
            el.addEventListener('pointerup', off);
            el.addEventListener('pointerleave', off);
            el.addEventListener('pointercancel', off);
        };
        bind(left,  () => { this.keys.left = true; },  () => { this.keys.left = false; });
        bind(right, () => { this.keys.right = true; }, () => { this.keys.right = false; });
        bind(jump,  () => { this._tryJump(); }, () => {});
    },

    // ---------------------------------------------------------------- input
    _handleKey(e, down) {
        switch (e.code) {
            case 'KeyA': case 'ArrowLeft':  this.keys.left = down; break;
            case 'KeyD': case 'ArrowRight': this.keys.right = down; break;
            case 'KeyW': case 'ArrowUp': case 'Space':
                if (down) { e.preventDefault(); this._tryJump(); }
                break;
            case 'KeyP':
                if (down) this._togglePause();
                break;
            case 'KeyM':
                if (down) SFX.toggleMusic();
                break;
        }
    },

    _tryJump() {
        if (this.paused || this.finished) return;
        if (this.grounded) {
            this.vy = PHYS.jumpVelocity;
            this.grounded = false;
            this.groundPlat = null;
            SFX.play('jump');
        }
    },

    _togglePause() {
        if (this.finished) return;
        this.paused = !this.paused;
        this.pausePanel.style.display = this.paused ? 'flex' : 'none';
    },

    // ---------------------------------------------------------------- loop
    update(dt) {
        if (this.paused || this.finished) return;
        this._t = (this._t || 0) + dt;

        // horizontal input
        let vx = 0;
        if (this.keys.left)  vx -= PHYS.moveSpeed;
        if (this.keys.right) vx += PHYS.moveSpeed;
        this.px = Math.max(-PHYS.maxX, Math.min(PHYS.maxX, this.px + vx * dt));
        if (vx !== 0) this.facing = vx > 0 ? 1 : -1;

        // ride a moving platform
        if (this.grounded && this.groundPlat && this.groundPlat.moving) {
            this.px = Math.max(-PHYS.maxX, Math.min(PHYS.maxX,
                this.px + this.groundPlat.vx * dt));
        }

        // vertical physics
        const prevY = this.py;
        if (!this.grounded) {
            this.vy += PHYS.gravity * dt;
            this.py += this.vy * dt;
        }

        // landing check: only while falling, feet cross a platform top
        if (this.vy <= 0 && !this.grounded) {
            for (const p of this.platforms) {
                if (prevY >= p.top - 0.01 && this.py <= p.top &&
                    Math.abs(this.px - p.mesh.position.x) <= p.w / 2 + PHYS.playerHalfW * 0.6) {
                    this.py = p.top;
                    this.vy = 0;
                    this.grounded = true;
                    this.groundPlat = p;
                    SFX.play('land');
                    if (p.mesh.position.y >= this.goalTop - 1) {
                        this._win();
                        return;
                    }
                    break;
                }
            }
        }

        // walked off the edge?
        if (this.grounded && this.groundPlat) {
            const p = this.groundPlat;
            if (Math.abs(this.px - p.mesh.position.x) > p.w / 2 + PHYS.playerHalfW * 0.6) {
                this.grounded = false;
                this.groundPlat = null;
                this.vy = 0;
            }
        }

        // move sliding platforms + cull anything far below
        for (let i = this.platforms.length - 1; i >= 0; i--) {
            const p = this.platforms[i];
            if (p.moving) {
                p.mesh.position.x += p.vx * dt;
                if (p.mesh.position.x < p.minX || p.mesh.position.x > p.maxX) {
                    p.vx *= -1;
                    p.mesh.position.x = Math.max(p.minX, Math.min(p.maxX, p.mesh.position.x));
                }
            }
            if (p.top < this.camY - 12 && p !== this.groundPlat) {
                this.scene.remove(p.mesh);
                p.mesh.geometry.dispose();
                p.mesh.material.dispose();
                this.platforms.splice(i, 1);
            }
        }
        this._genPlatforms(this.camY + 40);

        // camera only ever climbs
        this.camY = Math.max(this.camY, this.py - 2);
        this.camera.position.set(this.px * 0.45, this.camY + 4.5, 12);
        this.camera.lookAt(this.px * 0.45, this.camY + 3.2, 0);

        // sky shifts from day -> dusk -> night as you climb
        const alt = Math.min(1, this.camY / CLIMB.targetHeight);
        this.scene.background.setHSL(0.58 - alt * 0.25, 0.6, 0.62 - alt * 0.42);

        // player pose: face travel direction, lean into movement
        this.player.position.set(this.px, this.py, 0);
        this.player.rotation.y += ((this.facing * 0.35) - this.player.rotation.y) * 10 * dt;
        this.player.rotation.z = this.grounded ? -vx * 0.012 : -vx * 0.02;

        // trophy + clouds idle motion
        this.trophy.rotation.y += dt * 1.2;
        for (const c of this.clouds) c.position.x += Math.sin(this._t * 0.3) * dt * 0.05;

        // scoring
        const h = Math.max(0, Math.floor(this.py));
        if (h > this.maxHeight) {
            this.maxHeight = h;
            this.scoreChip.textContent = 'HEIGHT ' + h + ' m';
            if (h > this.best) {
                this.best = h;
                this.bestChip.textContent = 'BEST ' + this.best + ' m';
                if (!this.newBest) {
                    this.newBest = true;
                    this.newBestChip.style.display = 'block';
                }
            }
        }

        // fell below the camera = full time
        if (this.py < this.camY - 8) {
            this._lose();
        }
    },

    _saveBest() {
        const stored = parseInt(localStorage.getItem(STORAGE_KEYS.best) || '0', 10);
        if (this.best > stored) {
            localStorage.setItem(STORAGE_KEYS.best, String(this.best));
        }
    },

    _win() {
        this.finished = true;
        this._saveBest();
        SFX.play('victory');
        Game.change(SceneVictory, { score: this.maxHeight, best: this.best });
    },

    _lose() {
        this.finished = true;
        this._saveBest();
        SFX.play('gameover');
        Game.change(SceneGameOver, { score: this.maxHeight, best: this.best });
    },

    exit() {
        window.removeEventListener('keydown', this._onKeyDown);
        window.removeEventListener('keyup', this._onKeyUp);
        this.ui.remove();
        this.pausePanel.remove();
        this.ui = null;
        this.pausePanel = null;
        Utils.dispose(this.scene);
    }
};
