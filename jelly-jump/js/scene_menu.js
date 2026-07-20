class SceneMenu extends Phaser.Scene {
    constructor() {
        super('SceneMenu');
    }

    create() {
        addJellyBackground(this, 0.35, true);

        SFX.startMusic(this);
        this.input.once('pointerdown', () => SFX.startMusic(this));

        this.createDecorations();

        const title = this.add.text(GAME_WIDTH / 2, 140, 'JELLY JUMP', {
            fontFamily: 'Courier New',
            fontSize: '56px',
            color: '#00d4ff',
            stroke: '#003355',
            strokeThickness: 4
        }).setOrigin(0.5);

        this.tweens.add({
            targets: title,
            y: 135,
            duration: 2000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        const subtitle = this.add.text(GAME_WIDTH / 2, 195, 'A Phaser Platformer Adventure', {
            fontFamily: 'Courier New',
            fontSize: '18px',
            color: '#aaccdd',
            stroke: '#000022',
            strokeThickness: 3
        }).setOrigin(0.5);

        const startButton = this.createButton(GAME_WIDTH / 2, 320, 'START GAME', () => {
            SFX.play(this, 'click');
            this.scene.start('SceneCharSelect');
        });

        const howToButton = this.createButton(GAME_WIDTH / 2, 390, 'HOW TO PLAY', () => {
            SFX.play(this, 'click');
            this.showInstructions();
        });

        createAudioToggles(this, GAME_WIDTH / 2, 505);

        const startHint = this.add.text(GAME_WIDTH / 2, 455, 'or press SPACE / ENTER to begin', {
            fontFamily: 'Courier New',
            fontSize: '14px',
            color: '#99bbdd',
            stroke: '#000022',
            strokeThickness: 3
        }).setOrigin(0.5);

        this.tweens.add({
            targets: startHint,
            alpha: 0.4,
            duration: 900,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        this.add.text(GAME_WIDTH / 2, 575, 'Made with Phaser 3  |  Hosted on GitHub Pages', {
            fontFamily: 'Courier New',
            fontSize: '12px',
            color: '#8899bb',
            stroke: '#000022',
            strokeThickness: 2
        }).setOrigin(0.5);

        const startGame = () => {
            this.scene.start('SceneCharSelect');
        };
        this.input.keyboard.on('keydown-ENTER', startGame);
        this.input.keyboard.on('keydown-SPACE', startGame);
    }

    createDecorations() {
        for (let i = 0; i < 5; i++) {
            const x = Phaser.Math.Between(50, GAME_WIDTH - 50);
            const y = Phaser.Math.Between(40, 100);
            const cloud = this.add.image(x, y, 'cloud').setAlpha(0.3);
            this.tweens.add({
                targets: cloud,
                x: x + 30,
                duration: 4000 + i * 1000,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
        }

        const crystalColors = [0x00ffaa, 0x00d4ff, 0xff66cc];
        for (let i = 0; i < 8; i++) {
            const x = Phaser.Math.Between(30, GAME_WIDTH - 30);
            const y = Phaser.Math.Between(420, 530);
            const crystal = this.add.image(x, y, 'crystal').setScale(0.6).setAlpha(0.4);
            this.tweens.add({
                targets: crystal,
                y: y - 10,
                duration: 2000 + i * 200,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
        }
    }

    createButton(x, y, label, callback) {
        const container = this.add.container(x, y);
        const width = 220;
        const height = 50;

        const bg = this.add.graphics();
        bg.fillStyle(0x1a1a3a, 0.9);
        bg.fillRoundedRect(-width / 2, -height / 2, width, height, 10);
        bg.lineStyle(2, 0x00d4ff, 1);
        bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 10);
        container.add(bg);

        const text = this.add.text(0, 0, label, {
            fontFamily: 'Courier New',
            fontSize: '20px',
            color: '#00d4ff',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        container.add(text);

        container.setSize(width, height);
        container.setInteractive({ useHandCursor: true });

        container.on('pointerover', () => {
            bg.clear();
            bg.fillStyle(0x2a2a5a, 1);
            bg.fillRoundedRect(-width / 2, -height / 2, width, height, 10);
            bg.lineStyle(2, 0x00ffff, 1);
            bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 10);
            text.setColor('#00ffff');
            container.setScale(1.05);
        });

        container.on('pointerout', () => {
            bg.clear();
            bg.fillStyle(0x1a1a3a, 0.9);
            bg.fillRoundedRect(-width / 2, -height / 2, width, height, 10);
            bg.lineStyle(2, 0x00d4ff, 1);
            bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 10);
            text.setColor('#00d4ff');
            container.setScale(1.0);
        });

        container.on('pointerdown', () => {
            bg.clear();
            bg.fillStyle(0x0a0a2a, 1);
            bg.fillRoundedRect(-width / 2, -height / 2, width, height, 10);
            bg.lineStyle(2, 0x0099cc, 1);
            bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 10);
            container.setScale(0.95);
        });

        container.on('pointerup', () => {
            callback();
        });

        return container;
    }

    showInstructions() {
        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.85);
        overlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        overlay.setDepth(100);

        const panel = this.add.graphics();
        panel.fillStyle(0x1a1a3a, 1);
        panel.fillRoundedRect(120, 80, GAME_WIDTH - 240, GAME_HEIGHT - 160, 15);
        panel.lineStyle(3, 0x00d4ff, 1);
        panel.strokeRoundedRect(120, 80, GAME_WIDTH - 240, GAME_HEIGHT - 160, 15);
        panel.setDepth(101);

        const instructions = [
            'HOW TO PLAY',
            '',
            'CONTROLS:',
            '  A / Left Arrow   -  Move Left',
            '  D / Right Arrow  -  Move Right',
            '  W / Up / Space   -  Jump (double jump unlocked!)',
            '  P                -  Pause Game',
            '  M                -  Music On/Off',
            '  MOBILE MODE: auto-run forward, tap screen to jump,',
            '  hold screen for rocket thrust while boosted',
            '',
            'OBJECTIVES:',
            '  - Collect coins and crystals for points',
            '  - Reach the Finish flag to complete each level',
            '  - Grab the Bitcoin for a 5 second rocket boost!',
            '  - Avoid enemies and spikes',
            '  - Stomp enemies from above to defeat them',
            '  - You have 3 lives - don\'t lose them all!',
            '',
            'Click anywhere to return to menu'
        ];

        let yPos = 130;
        for (const line of instructions) {
            const isTitle = line === 'HOW TO PLAY';
            this.add.text(GAME_WIDTH / 2, yPos, line, {
                fontFamily: 'Courier New',
                fontSize: isTitle ? '28px' : '16px',
                color: isTitle ? '#00d4ff' : '#aabbcc',
                fontStyle: isTitle ? 'bold' : 'normal'
            }).setOrigin(0.5).setDepth(102);
            yPos += isTitle ? 40 : 24;
        }

        this.input.once('pointerdown', () => {
            overlay.destroy();
            panel.destroy();
            this.children.list.filter(c => c.depth >= 102).forEach(c => c.destroy());
        });
    }
}
