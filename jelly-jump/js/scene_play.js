class ScenePlay extends Phaser.Scene {
    constructor() {
        super('ScenePlay');
    }

    init(data) {
        this.currentLevel = data.level || 1;
        this.score = data.score || 0;
        this.lives = data.lives || 3;
        this.maxLevel = 3;
        this.character = data.character || this.registry.get('character') || 'max';
        this.registry.set('character', this.character);
    }

    create() {
        this.isPaused = false;
        this.canDoubleJump = true;
        this.hasJumped = false;
        this.invulnerable = false;
        this.levelComplete = false;

        // Platform mode: mobile = auto-run + tap to jump
        this.isMobile = (GAME_SETTINGS.controls === 'mobile');
        this.touchHeld = false;

        // Rocket booster state (Bitcoin powerup)
        this.jetpackActive = false;
        this.jetpackMs = 0;
        this.jetpackText = null;
        this.jetpackFlame = null;

        this.buildBackground();
        this.buildLevel();
        this.createPlayer();
        this.setupCollisions();
        this.createHUD();
        this.setupControls();
        this.setupCamera();
        this.setupMobileInput();
        this.updateControlsHint();

        this.input.keyboard.on('keydown-P', () => {
            this.togglePause();
        });

        this.input.keyboard.on('keydown-M', () => {
            SFX.toggleMusic(this);
        });
    }

    // Tap anywhere on the page = jump (hold = rocket thrust while boosted).
    setupMobileInput() {
        if (!this.isMobile) return;
        this.onPointerDown = () => {
            this.touchHeld = true;
            this.tryJump();
        };
        this.onPointerUp = () => {
            this.touchHeld = false;
        };
        document.addEventListener('pointerdown', this.onPointerDown);
        document.addEventListener('pointerup', this.onPointerUp);
        document.addEventListener('pointercancel', this.onPointerUp);
        this.events.once('shutdown', () => {
            document.removeEventListener('pointerdown', this.onPointerDown);
            document.removeEventListener('pointerup', this.onPointerUp);
            document.removeEventListener('pointercancel', this.onPointerUp);
        });
    }

    updateControlsHint() {
        const hint = document.getElementById('controls-hint');
        if (!hint) return;
        if (this.isMobile) {
            hint.innerHTML = '<span class="key">TAP</span> Jump (x2 for double jump) &nbsp;|&nbsp; ' +
                '<span class="key">HOLD</span> Rocket thrust while boosted';
        } else {
            hint.innerHTML = '<span class="key">A</span> / <span class="key">&larr;</span> Move Left &nbsp;|&nbsp; ' +
                '<span class="key">D</span> / <span class="key">&rarr;</span> Move Right &nbsp;|&nbsp; ' +
                '<span class="key">W</span> / <span class="key">&uarr;</span> / <span class="key">Space</span> Jump &nbsp;|&nbsp; ' +
                '<span class="key">P</span> Pause &nbsp;|&nbsp; <span class="key">M</span> Music On/Off';
        }
    }

    buildBackground() {
        const bg = addJellyBackground(this, 0.45, false);
        bg.img.setScrollFactor(0);
        if (bg.overlay) bg.overlay.setScrollFactor(0);

        for (let i = 0; i < 6; i++) {
            const x = Phaser.Math.Between(0, this.levelWidth || GAME_WIDTH);
            const y = Phaser.Math.Between(40, 120);
            const cloud = this.add.image(x, y, 'cloud').setAlpha(0.2).setScrollFactor(0.3);
            this.tweens.add({
                targets: cloud,
                x: x + 50,
                duration: 6000 + i * 2000,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
        }
    }

    buildLevel() {
        const levelData = this.getLevelData(this.currentLevel);
        this.levelWidth = levelData.width;

        this.platforms = this.physics.add.staticGroup();
        this.coins = this.physics.add.group();
        this.crystals = this.physics.add.group();
        this.enemies = this.physics.add.group();
        this.spikes = this.physics.add.staticGroup();
        this.bitcoins = this.physics.add.group();
        this.flagPole = null;

        for (const p of levelData.platforms) {
            const plat = this.platforms.create(p.x, p.y, 'platform').setOrigin(0, 0);
            plat.refreshBody();
            plat.setTint(p.tint || 0xffffff);
        }

        for (let x = 0; x < levelData.width; x += TILE_SIZE) {
            const ground = this.platforms.create(x, GAME_HEIGHT - TILE_SIZE, 'ground').setOrigin(0, 0);
            ground.refreshBody();
        }

        for (const gap of levelData.gaps || []) {
            this.platforms.children.entries.forEach(child => {
                if (child.y === GAME_HEIGHT - TILE_SIZE && child.x >= gap.x && child.x < gap.x + gap.width) {
                    child.destroy();
                }
            });
        }

        for (const c of levelData.coins) {
            const coin = this.coins.create(c.x, c.y, 'coin');
            coin.setBounce(0.3);
            this.tweens.add({
                targets: coin,
                y: c.y - 8,
                duration: 800,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
        }

        for (const c of levelData.crystals) {
            const crystal = this.crystals.create(c.x, c.y, 'crystal');
            crystal.setBounce(0.2);
            this.tweens.add({
                targets: crystal,
                y: c.y - 10,
                duration: 1200,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
            crystal.setData('value', 50);
        }

        for (const e of levelData.enemies) {
            const enemy = this.enemies.create(e.x, e.y, 'enemy');
            enemy.setBounce(0);
            enemy.setCollideWorldBounds(false);
            enemy.setData('speed', e.speed || 60);
            enemy.setData('minX', e.minX);
            enemy.setData('maxX', e.maxX);
            enemy.setData('direction', 1);
        }

        for (const s of levelData.spikes || []) {
            const spike = this.spikes.create(s.x, s.y, 'spike').setOrigin(0, 0);
            spike.refreshBody();
        }

        // Floating Bitcoin powerup (one per level)
        if (levelData.bitcoin) {
            const bitcoin = this.bitcoins.create(levelData.bitcoin.x, levelData.bitcoin.y, 'bitcoin');
            bitcoin.setBounce(0.2);
            bitcoin.setScale(1.3);
            this.tweens.add({
                targets: bitcoin,
                y: levelData.bitcoin.y - 12,
                duration: 900,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
            this.tweens.add({
                targets: bitcoin,
                angle: 8,
                duration: 700,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
        }

        // 'Finish' flag at the end of the level
        if (levelData.flag) {
            const fx = levelData.flag.x;
            const fy = levelData.flag.y;

            this.flagPole = this.physics.add.staticImage(fx, fy, 'flagpole').setOrigin(0, 0);
            this.flagPole.refreshBody();

            const cloth = this.add.image(fx + 8, fy + 2, 'flagcloth').setOrigin(0, 0);
            this.tweens.add({
                targets: cloth,
                scaleY: 0.85,
                angle: -3,
                duration: 600,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });

            this.add.text(fx + 26, fy - 14, 'Finish', {
                fontFamily: 'Courier New',
                fontSize: '16px',
                color: '#ffffff',
                stroke: '#003322',
                strokeThickness: 3,
                fontStyle: 'bold'
            }).setOrigin(0.5);

            const glow = this.add.graphics();
            glow.fillStyle(0x22cc55, 0.15);
            glow.fillCircle(fx + 4, fy + 28, 40);
            this.tweens.add({
                targets: glow,
                alpha: 0.35,
                duration: 1000,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
        }
    }

    getLevelData(level) {
        const levels = [
            {
                width: 1920,
                platforms: [
                    { x: 160, y: 440, tint: 0xaaccff },
                    { x: 320, y: 360, tint: 0xaaccff },
                    { x: 540, y: 400, tint: 0xaaccff },
                    { x: 720, y: 320, tint: 0xaaccff },
                    { x: 920, y: 400, tint: 0xaaccff },
                    { x: 1120, y: 350, tint: 0xaaccff },
                    { x: 1320, y: 280, tint: 0xaaccff },
                    { x: 1520, y: 380, tint: 0xaaccff },
                    { x: 1720, y: 450, tint: 0xaaccff },
                    { x: 420, y: 500, tint: 0x88aaff },
                    { x: 820, y: 500, tint: 0x88aaff },
                    { x: 1220, y: 460, tint: 0x88aaff },
                ],
                coins: [
                    { x: 224, y: 400 }, { x: 384, y: 320 }, { x: 604, y: 360 },
                    { x: 784, y: 280 }, { x: 984, y: 360 }, { x: 1184, y: 310 },
                    { x: 1384, y: 240 }, { x: 1584, y: 340 }, { x: 1784, y: 410 },
                    { x: 180, y: 520 }, { x: 460, y: 460 }, { x: 860, y: 460 },
                    { x: 1260, y: 420 },
                ],
                crystals: [
                    { x: 784, y: 250 }, { x: 1384, y: 210 }, { x: 300, y: 520 }
                ],
                enemies: [
                    { x: 540, y: 370, minX: 500, maxX: 620, speed: 50 },
                    { x: 920, y: 370, minX: 880, maxX: 1000, speed: 55 },
                    { x: 1520, y: 350, minX: 1480, maxX: 1600, speed: 60 },
                ],
                spikes: [
                    { x: 640, y: GAME_HEIGHT - TILE_SIZE - 20 },
                ],
                gaps: [
                    { x: 640, width: TILE_SIZE * 2 },
                ],
                bitcoin: { x: 600, y: 525 },
                flag: { x: 1840, y: GAME_HEIGHT - TILE_SIZE - 56 }
            },
            {
                width: 2560,
                platforms: [
                    { x: 140, y: 480 },
                    { x: 300, y: 400 },
                    { x: 460, y: 320 },
                    { x: 300, y: 240 },
                    { x: 140, y: 160 },
                    { x: 620, y: 440 },
                    { x: 800, y: 360 },
                    { x: 980, y: 280 },
                    { x: 1160, y: 360 },
                    { x: 1340, y: 440 },
                    { x: 1520, y: 360 },
                    { x: 1700, y: 280 },
                    { x: 1880, y: 200 },
                    { x: 1700, y: 120 },
                    { x: 2060, y: 320 },
                    { x: 2240, y: 400 },
                    { x: 2420, y: 480 },
                ],
                coins: [
                    { x: 204, y: 440 }, { x: 364, y: 360 }, { x: 524, y: 280 },
                    { x: 364, y: 200 }, { x: 204, y: 120 }, { x: 684, y: 400 },
                    { x: 864, y: 320 }, { x: 1044, y: 240 }, { x: 1224, y: 320 },
                    { x: 1404, y: 400 }, { x: 1584, y: 320 }, { x: 1764, y: 240 },
                    { x: 1944, y: 160 }, { x: 1764, y: 80 }, { x: 2124, y: 280 },
                    { x: 2304, y: 360 }, { x: 2484, y: 440 },
                    { x: 100, y: 520 }, { x: 600, y: 520 }, { x: 1100, y: 520 },
                    { x: 1600, y: 520 }, { x: 2100, y: 520 },
                ],
                crystals: [
                    { x: 204, y: 80 }, { x: 1944, y: 120 }, { x: 1044, y: 200 },
                    { x: 2484, y: 440 },
                ],
                enemies: [
                    { x: 620, y: 410, minX: 580, maxX: 700, speed: 60 },
                    { x: 1160, y: 330, minX: 1120, maxX: 1240, speed: 65 },
                    { x: 1700, y: 250, minX: 1660, maxX: 1780, speed: 70 },
                    { x: 2240, y: 370, minX: 2200, maxX: 2320, speed: 65 },
                    { x: 400, y: 520, minX: 300, maxX: 500, speed: 55 },
                ],
                spikes: [
                    { x: 760, y: GAME_HEIGHT - TILE_SIZE - 20 },
                    { x: 792, y: GAME_HEIGHT - TILE_SIZE - 20 },
                    { x: 1300, y: GAME_HEIGHT - TILE_SIZE - 20 },
                    { x: 1332, y: GAME_HEIGHT - TILE_SIZE - 20 },
                ],
                gaps: [
                    { x: 760, width: TILE_SIZE * 2 },
                    { x: 1300, width: TILE_SIZE * 2 },
                ],
                bitcoin: { x: 700, y: 525 },
                flag: { x: 2480, y: GAME_HEIGHT - TILE_SIZE - 56 }
            },
            {
                width: 3200,
                platforms: [
                    { x: 160, y: 450 }, { x: 320, y: 370 }, { x: 480, y: 290 },
                    { x: 640, y: 210 }, { x: 480, y: 130 }, { x: 320, y: 130 },
                    { x: 800, y: 420 }, { x: 1000, y: 340 }, { x: 1200, y: 260 },
                    { x: 1400, y: 180 }, { x: 1600, y: 260 }, { x: 1800, y: 340 },
                    { x: 2000, y: 420 }, { x: 2200, y: 340 }, { x: 2400, y: 260 },
                    { x: 2600, y: 180 }, { x: 2800, y: 260 }, { x: 3000, y: 340 },
                    { x: 3140, y: 420 },
                    { x: 900, y: 520 }, { x: 1500, y: 520 }, { x: 2100, y: 520 },
                    { x: 2700, y: 520 },
                ],
                coins: [
                    { x: 224, y: 410 }, { x: 384, y: 330 }, { x: 544, y: 250 },
                    { x: 704, y: 170 }, { x: 544, y: 90 }, { x: 384, y: 90 },
                    { x: 864, y: 380 }, { x: 1064, y: 300 }, { x: 1264, y: 220 },
                    { x: 1464, y: 140 }, { x: 1664, y: 220 }, { x: 1864, y: 300 },
                    { x: 2064, y: 380 }, { x: 2264, y: 300 }, { x: 2464, y: 220 },
                    { x: 2664, y: 140 }, { x: 2864, y: 220 }, { x: 3064, y: 300 },
                    { x: 3204, y: 380 },
                    { x: 100, y: 520 }, { x: 960, y: 480 }, { x: 1560, y: 480 },
                    { x: 2160, y: 480 }, { x: 2760, y: 480 },
                ],
                crystals: [
                    { x: 704, y: 120 }, { x: 1464, y: 100 }, { x: 2664, y: 100 },
                    { x: 60, y: 520 }, { x: 3204, y: 380 },
                ],
                enemies: [
                    { x: 800, y: 390, minX: 760, maxX: 880, speed: 65 },
                    { x: 1200, y: 230, minX: 1160, maxX: 1280, speed: 70 },
                    { x: 1800, y: 310, minX: 1760, maxX: 1880, speed: 75 },
                    { x: 2400, y: 230, minX: 2360, maxX: 2480, speed: 70 },
                    { x: 3000, y: 310, minX: 2960, maxX: 3080, speed: 75 },
                    { x: 600, y: 520, minX: 500, maxX: 700, speed: 60 },
                    { x: 2000, y: 520, minX: 1900, maxX: 2100, speed: 65 },
                ],
                spikes: [
                    { x: 560, y: GAME_HEIGHT - TILE_SIZE - 20 },
                    { x: 592, y: GAME_HEIGHT - TILE_SIZE - 20 },
                    { x: 1136, y: GAME_HEIGHT - TILE_SIZE - 20 },
                    { x: 1168, y: GAME_HEIGHT - TILE_SIZE - 20 },
                    { x: 1712, y: GAME_HEIGHT - TILE_SIZE - 20 },
                    { x: 1744, y: GAME_HEIGHT - TILE_SIZE - 20 },
                    { x: 2336, y: GAME_HEIGHT - TILE_SIZE - 20 },
                    { x: 2368, y: GAME_HEIGHT - TILE_SIZE - 20 },
                ],
                gaps: [
                    { x: 560, width: TILE_SIZE * 2 },
                    { x: 1136, width: TILE_SIZE * 2 },
                    { x: 1712, width: TILE_SIZE * 2 },
                    { x: 2336, width: TILE_SIZE * 2 },
                ],
                bitcoin: { x: 1100, y: 525 },
                flag: { x: 3140, y: GAME_HEIGHT - TILE_SIZE - 56 }
            }
        ];

        return levels[Math.min(level - 1, levels.length - 1)];
    }

    createPlayer() {
        const tex = 'char_' + this.character;
        this.player = this.physics.add.sprite(80, GAME_HEIGHT - TILE_SIZE - 36, tex);
        this.player.setBounce(0.1);
        this.player.setCollideWorldBounds(false);
        this.player.body.setSize(24, 34, true);

        const idleKey = this.character + '-idle';
        const runKey = this.character + '-run';
        const jumpKey = this.character + '-jump';

        if (!this.anims.exists(idleKey)) {
            this.anims.create({
                key: idleKey,
                frames: [{ key: tex }],
                frameRate: 1,
                repeat: -1
            });

            this.anims.create({
                key: runKey,
                frames: [
                    { key: tex + '_run1' },
                    { key: tex },
                    { key: tex + '_run2' },
                    { key: tex }
                ],
                frameRate: 10,
                repeat: -1
            });

            this.anims.create({
                key: jumpKey,
                frames: [{ key: tex + '_jump' }],
                frameRate: 1,
                repeat: -1
            });
        }

        this.player.play(idleKey);
    }

    setupCollisions() {
        this.physics.world.setBounds(0, 0, this.levelWidth, GAME_HEIGHT);

        this.physics.add.collider(this.player, this.platforms);
        this.physics.add.collider(this.enemies, this.platforms);
        this.physics.add.collider(this.player, this.spikes, this.hitSpike, null, this);

        this.physics.add.overlap(this.player, this.coins, this.collectCoin, null, this);
        this.physics.add.overlap(this.player, this.crystals, this.collectCrystal, null, this);
        this.physics.add.overlap(this.player, this.bitcoins, this.collectBitcoin, null, this);
        this.physics.add.overlap(this.player, this.enemies, this.hitEnemy, null, this);

        if (this.flagPole) {
            this.physics.add.overlap(this.player, this.flagPole, this.reachFlag, null, this);
        }
    }

    createHUD() {
        this.scoreText = this.add.text(20, 20, 'Score: ' + this.score, {
            fontFamily: 'Courier New',
            fontSize: '20px',
            color: '#00d4ff',
            stroke: '#001122',
            strokeThickness: 3
        }).setScrollFactor(0).setDepth(200);

        this.levelText = this.add.text(GAME_WIDTH / 2, 20, 'Level ' + this.currentLevel + '/' + this.maxLevel, {
            fontFamily: 'Courier New',
            fontSize: '20px',
            color: '#ff66cc',
            stroke: '#110022',
            strokeThickness: 3
        }).setOrigin(0.5).setScrollFactor(0).setDepth(200);

        this.livesContainer = this.add.container(GAME_WIDTH - 20, 25);
        this.livesContainer.setScrollFactor(0).setDepth(200);
        this.updateLivesDisplay();
    }

    updateLivesDisplay() {
        this.livesContainer.removeAll(true);
        for (let i = 0; i < this.lives; i++) {
            const heart = this.add.image(-i * 26 - 12, 0, 'heart').setScale(1.2);
            this.livesContainer.add(heart);
        }
    }

    setupControls() {
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys('W,A,S,D');
    }

    setupCamera() {
        this.cameras.main.setBounds(0, 0, this.levelWidth, GAME_HEIGHT);
        this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
        this.cameras.main.setFollowOffset(0, 50);
    }

    update(time, delta) {
        if (this.isPaused || this.levelComplete) return;

        if (this.jetpackActive) {
            this.updateJetpack(delta);
        } else if (this.isMobile) {
            // Mobile: the player runs forward automatically.
            this.player.setVelocityX(180);
            this.player.flipX = false;
            if (this.player.body.blocked.down) {
                this.player.play(this.character + '-run', true);
            } else {
                this.player.play(this.character + '-jump', true);
            }
        } else {
            // Desktop: keyboard movement.
            const left = this.cursors.left.isDown || this.wasd.A.isDown;
            const right = this.cursors.right.isDown || this.wasd.D.isDown;
            const jump = this.cursors.up.isDown || this.wasd.W.isDown || this.cursors.space.isDown;

            if (left) {
                this.player.setVelocityX(-180);
                this.player.flipX = true;
                if (this.player.body.blocked.down) this.player.play(this.character + '-run', true);
            } else if (right) {
                this.player.setVelocityX(180);
                this.player.flipX = false;
                if (this.player.body.blocked.down) this.player.play(this.character + '-run', true);
            } else {
                this.player.setVelocityX(0);
                if (this.player.body.blocked.down) this.player.play(this.character + '-idle', true);
            }

            if (!this.player.body.blocked.down) {
                this.player.play(this.character + '-jump', true);
            }

            if (jump) this.tryJump();
        }

        if (this.player.body.blocked.down) {
            this.canDoubleJump = true;
            this.hasJumped = false;
        }

        if (this.player.y > GAME_HEIGHT + 100) {
            this.playerFell();
        }

        this.updateEnemies();
    }

    tryJump() {
        if (this.isPaused || this.levelComplete || this.jetpackActive) return;

        if (this.player.body.blocked.down) {
            this.player.setVelocityY(-400);
            this.hasJumped = false;
            SFX.play(this, 'jump');
            this.createJumpParticles();
        } else if (!this.hasJumped && this.canDoubleJump) {
            this.player.setVelocityY(-380);
            this.hasJumped = true;
            this.canDoubleJump = false;
            SFX.play(this, 'jump2');
            this.createJumpParticles();
        }
    }

    updateEnemies() {
        this.enemies.children.entries.forEach(enemy => {
            if (!enemy.active) return;
            const speed = enemy.getData('speed');
            const dir = enemy.getData('direction');
            const minX = enemy.getData('minX');
            const maxX = enemy.getData('maxX');

            enemy.setVelocityX(speed * dir);
            enemy.flipX = dir < 0;

            if (enemy.x <= minX) {
                enemy.setData('direction', 1);
            } else if (enemy.x >= maxX) {
                enemy.setData('direction', -1);
            }
        });
    }

    collectCoin(player, coin) {
        coin.destroy();
        this.score += 10;
        this.scoreText.setText('Score: ' + this.score);
        SFX.play(this, 'coin');
        this.createCollectParticles(coin.x, coin.y, 0xffd700);
    }

    collectCrystal(player, crystal) {
        crystal.destroy();
        this.score += 50;
        this.scoreText.setText('Score: ' + this.score);
        SFX.play(this, 'crystal');
        this.createCollectParticles(crystal.x, crystal.y, 0x00ffaa);
    }

    collectBitcoin(player, bitcoin) {
        bitcoin.destroy();
        this.score += 100;
        this.scoreText.setText('Score: ' + this.score);
        SFX.play(this, 'powerup');
        this.createCollectParticles(bitcoin.x, bitcoin.y, 0xf7931a);
        this.announceBitcoin();
        this.startJetpack();
    }

    // The narrator announces "Bitcoin Powerup!" (speech + on-screen text).
    announceBitcoin() {
        if (SFX.sfxOn && window.speechSynthesis) {
            try {
                window.speechSynthesis.cancel();
                const utter = new SpeechSynthesisUtterance('Bitcoin Powerup!');
                utter.rate = 1.0;
                utter.pitch = 1.1;
                window.speechSynthesis.speak(utter);
            } catch (e) { /* speech unavailable - text banner still shows */ }
        }

        const banner = this.add.text(GAME_WIDTH / 2, 150, 'BITCOIN POWERUP!', {
            fontFamily: 'Courier New',
            fontSize: '40px',
            color: '#f7931a',
            stroke: '#3a2200',
            strokeThickness: 5,
            fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(250).setScale(0.2);

        this.tweens.add({
            targets: banner,
            scale: 1,
            duration: 300,
            ease: 'Back.easeOut'
        });
        this.tweens.add({
            targets: banner,
            alpha: 0,
            y: 110,
            duration: 600,
            delay: 1400,
            onComplete: () => banner.destroy()
        });
    }

    // 5 seconds of rocket flight: hold tap (mobile) or hold jump (desktop) to thrust.
    startJetpack() {
        this.jetpackActive = true;
        this.jetpackMs = 5000;
        this.invulnerable = true;

        this.jetpackText = this.add.text(GAME_WIDTH / 2, 48, 'ROCKET: 5s', {
            fontFamily: 'Courier New',
            fontSize: '20px',
            color: '#f7931a',
            stroke: '#3a2200',
            strokeThickness: 3,
            fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(200);

        this.jetpackFlame = this.add.particles(0, 0, 'particle', {
            speed: { min: 60, max: 140 },
            angle: { min: 80, max: 100 },
            scale: { start: 1.6, end: 0 },
            lifespan: 350,
            tint: [0xff6600, 0xffcc33, 0xff9933],
            frequency: 30
        });
        this.jetpackFlame.startFollow(this.player, 0, 18);
    }

    updateJetpack(delta) {
        this.jetpackMs -= delta;

        // Fly forward automatically while boosted.
        this.player.setVelocityX(300);
        this.player.flipX = false;
        this.player.play(this.character + '-jump', true);

        const thrust = this.isMobile
            ? this.touchHeld
            : (this.cursors.up.isDown || this.wasd.W.isDown || this.cursors.space.isDown);

        if (thrust) {
            this.player.setVelocityY(-300);
        } else if (this.player.body.velocity.y > 200) {
            this.player.setVelocityY(200); // gentle fall while coasting
        }

        // Don't fly off the top of the world.
        if (this.player.y < 24) {
            this.player.y = 24;
            if (this.player.body.velocity.y < 0) this.player.setVelocityY(0);
        }

        if (this.jetpackText) {
            this.jetpackText.setText('ROCKET: ' + Math.max(0, Math.ceil(this.jetpackMs / 1000)) + 's');
        }

        if (this.jetpackMs <= 0) {
            this.endJetpack();
        }
    }

    endJetpack() {
        this.jetpackActive = false;
        this.invulnerable = false;
        if (this.jetpackFlame) {
            this.jetpackFlame.destroy();
            this.jetpackFlame = null;
        }
        if (this.jetpackText) {
            this.jetpackText.destroy();
            this.jetpackText = null;
        }
        // Gravity takes over from here and the player falls back to the ground.
        this.player.setVelocityY(0);
    }

    hitEnemy(player, enemy) {
        if (!enemy.active) return;

        // The rocket booster smashes straight through enemies.
        if (this.jetpackActive) {
            enemy.destroy();
            this.score += 25;
            this.scoreText.setText('Score: ' + this.score);
            SFX.play(this, 'stomp');
            this.createCollectParticles(enemy.x, enemy.y, 0xff3366);
            return;
        }

        const playerBottom = player.body.y + player.body.height;
        const enemyTop = enemy.body.y;
        const isStomping = playerBottom < enemyTop + 15 && player.body.velocity.y > 0;

        if (isStomping) {
            enemy.destroy();
            this.score += 25;
            this.scoreText.setText('Score: ' + this.score);
            player.setVelocityY(-300);
            SFX.play(this, 'stomp');
            this.createCollectParticles(enemy.x, enemy.y, 0xff3366);
        } else if (!this.invulnerable) {
            this.takeDamage();
        }
    }

    hitSpike(player, spike) {
        if (!this.invulnerable && !this.jetpackActive) {
            this.takeDamage();
        }
    }

    takeDamage() {
        this.lives--;
        this.updateLivesDisplay();
        this.invulnerable = true;

        SFX.play(this, 'hurt');
        this.cameras.main.shake(200, 0.01);

        this.player.setVelocityY(-250);
        this.player.setVelocityX(this.player.flipX ? 100 : -100);

        this.player.setTint(0xff0000);
        this.time.delayedCall(1500, () => {
            this.player.clearTint();
            this.invulnerable = false;
        });

        this.player.setVisible(false);
        this.time.delayedCall(100, () => this.player.setVisible(true));
        this.time.delayedCall(300, () => this.player.setVisible(false));
        this.time.delayedCall(500, () => this.player.setVisible(true));
        this.time.delayedCall(700, () => this.player.setVisible(false));
        this.time.delayedCall(900, () => this.player.setVisible(true));

        if (this.lives <= 0) {
            this.scene.start('SceneGameOver', {
                score: this.score,
                level: this.currentLevel
            });
        }
    }

    playerFell() {
        this.lives--;
        this.updateLivesDisplay();

        SFX.play(this, 'fall');

        if (this.lives <= 0) {
            this.scene.start('SceneGameOver', {
                score: this.score,
                level: this.currentLevel
            });
        } else {
            this.player.setPosition(80, GAME_HEIGHT - TILE_SIZE - 36);
            this.player.setVelocity(0, 0);
            this.cameras.main.shake(200, 0.01);
        }
    }

    reachFlag(player, pole) {
        if (this.levelComplete) return;
        this.levelComplete = true;

        if (this.jetpackActive) this.endJetpack();

        SFX.play(this, 'win');
        this.cameras.main.fade(500, 0, 0, 0);

        this.time.delayedCall(600, () => {
            if (this.currentLevel >= this.maxLevel) {
                this.scene.start('SceneVictory', { score: this.score });
            } else {
                this.scene.restart({ level: this.currentLevel + 1, score: this.score, lives: this.lives });
            }
        });
    }

    createJumpParticles() {
        const emitter = this.add.particles(this.player.x, this.player.y + 18, 'particle', {
            speed: { min: 50, max: 100 },
            angle: { min: 220, max: 320 },
            scale: { start: 0.6, end: 0 },
            lifespan: 300,
            tint: 0x00d4ff,
            emitting: false
        });
        emitter.explode(5);
        this.time.delayedCall(400, () => emitter.destroy());
    }

    createCollectParticles(x, y, color) {
        const emitter = this.add.particles(x, y, 'particle', {
            speed: { min: 80, max: 150 },
            angle: { min: 0, max: 360 },
            scale: { start: 0.5, end: 0 },
            lifespan: 500,
            tint: color,
            emitting: false
        });
        emitter.explode(10);
        this.time.delayedCall(600, () => emitter.destroy());
    }

    togglePause() {
        this.isPaused = !this.isPaused;

        SFX.play(this, 'pause');

        if (this.isPaused) {
            this.physics.world.pause();
            this.tweens.pauseAll();

            this.pauseOverlay = this.add.graphics();
            this.pauseOverlay.fillStyle(0x000000, 0.6);
            this.pauseOverlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
            this.pauseOverlay.setScrollFactor(0).setDepth(300);

            this.pauseText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 20, 'PAUSED', {
                fontFamily: 'Courier New',
                fontSize: '48px',
                color: '#00d4ff',
                stroke: '#001122',
                strokeThickness: 4
            }).setOrigin(0.5).setScrollFactor(0).setDepth(301);

            this.pauseSubtext = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 30, 'Press P to resume', {
                fontFamily: 'Courier New',
                fontSize: '18px',
                color: '#6688aa'
            }).setOrigin(0.5).setScrollFactor(0).setDepth(301);
        } else {
            this.physics.world.resume();
            this.tweens.resumeAll();
            if (this.pauseOverlay) this.pauseOverlay.destroy();
            if (this.pauseText) this.pauseText.destroy();
            if (this.pauseSubtext) this.pauseSubtext.destroy();
        }
    }
}
