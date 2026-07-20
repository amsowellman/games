class SceneCharSelect extends Phaser.Scene {
    constructor() {
        super('SceneCharSelect');
    }

    create() {
        addJellyBackground(this, 0.45, true);

        SFX.startMusic(this);
        this.input.once('pointerdown', () => SFX.startMusic(this));

        // Auto-detect the platform on first visit (can be overridden below).
        if (!GAME_SETTINGS.controls) {
            const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
            GAME_SETTINGS.controls = isTouch ? 'mobile' : 'desktop';
        }

        this.add.text(GAME_WIDTH / 2, 40, 'CHOOSE YOUR CHARACTER', {
            fontFamily: 'Courier New',
            fontSize: '32px',
            color: '#00d4ff',
            stroke: '#003355',
            strokeThickness: 4,
            fontStyle: 'bold'
        }).setOrigin(0.5);

        this.add.text(GAME_WIDTH / 2, 78, 'Click a character or press 1 - 4', {
            fontFamily: 'Courier New',
            fontSize: '14px',
            color: '#88aacc',
            stroke: '#000022',
            strokeThickness: 2
        }).setOrigin(0.5);

        this.createModeToggle(GAME_WIDTH / 2, 118);

        this.cards = [];
        CHARACTERS.forEach((char, i) => {
            this.createCard(char, 150 + i * 220, 330, i);
        });

        createAudioToggles(this, GAME_WIDTH / 2, 565);

        this.input.keyboard.on('keydown-ESC', () => {
            this.scene.start('SceneMenu');
        });
    }

    // Desktop vs Mobile selector. Mobile = auto-run + tap to jump.
    createModeToggle(x, y) {
        const container = this.add.container(x, y);
        const w = 300;
        const h = 40;

        const bg = this.add.graphics();
        const drawBg = (fill, line) => {
            bg.clear();
            bg.fillStyle(fill, 0.92);
            bg.fillRoundedRect(-w / 2, -h / 2, w, h, 10);
            bg.lineStyle(2, line, 1);
            bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 10);
        };
        drawBg(0x14142e, 0xffd700);

        const label = this.add.text(0, 0, '', {
            fontFamily: 'Courier New',
            fontSize: '18px',
            color: '#ffd700',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        container.add([bg, label]);

        const refresh = () => {
            label.setText('MODE: ' + GAME_SETTINGS.controls.toUpperCase());
        };
        refresh();

        container.setSize(w, h);
        container.setInteractive({ useHandCursor: true });
        container.on('pointerover', () => drawBg(0x2a2a5a, 0xffe44d));
        container.on('pointerout', () => drawBg(0x14142e, 0xffd700));
        container.on('pointerdown', () => {
            GAME_SETTINGS.controls = (GAME_SETTINGS.controls === 'desktop') ? 'mobile' : 'desktop';
            SFX.play(this, 'click');
            refresh();
        });
    }

    createCard(char, x, y, index) {
        const w = 190;
        const h = 300;

        const container = this.add.container(x, y);

        const bg = this.add.graphics();
        const drawBg = (fill, line) => {
            bg.clear();
            bg.fillStyle(fill, 0.92);
            bg.fillRoundedRect(-w / 2, -h / 2, w, h, 14);
            bg.lineStyle(3, line, 1);
            bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 14);
        };
        drawBg(0x14142e, 0x00d4ff);
        container.add(bg);

        const number = this.add.text(0, -h / 2 + 22, (index + 1).toString(), {
            fontFamily: 'Courier New',
            fontSize: '16px',
            color: '#5577aa'
        }).setOrigin(0.5);
        container.add(number);

        const sprite = this.add.image(0, -30, 'char_' + char.key).setScale(3.2);
        container.add(sprite);

        this.tweens.add({
            targets: sprite,
            y: -38,
            duration: 1200 + index * 150,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        const nameText = this.add.text(0, 62, char.name, {
            fontFamily: 'Courier New',
            fontSize: '26px',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        container.add(nameText);

        const speciesText = this.add.text(0, 95, 'the ' + char.species, {
            fontFamily: 'Courier New',
            fontSize: '16px',
            color: '#88aacc'
        }).setOrigin(0.5);
        container.add(speciesText);

        container.setSize(w, h);
        container.setInteractive({ useHandCursor: true });

        container.on('pointerover', () => {
            drawBg(0x2a2a5a, 0x00ffff);
            container.setScale(1.05);
            nameText.setColor('#00ffff');
        });

        container.on('pointerout', () => {
            drawBg(0x14142e, 0x00d4ff);
            container.setScale(1.0);
            nameText.setColor('#ffffff');
        });

        container.on('pointerdown', () => {
            this.selectCharacter(char);
        });

        const numKeys = ['ONE', 'TWO', 'THREE', 'FOUR'];
        this.input.keyboard.on('keydown-' + numKeys[index], () => {
            this.selectCharacter(char);
        });

        this.cards.push(container);
    }

    selectCharacter(char) {
        SFX.play(this, 'select');
        this.registry.set('character', char.key);
        this.scene.start('ScenePlay', { level: 1, score: 0, lives: 3, character: char.key });
    }
}
