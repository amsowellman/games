class SceneGameOver extends Phaser.Scene {
    constructor() {
        super('SceneGameOver');
    }

    init(data) {
        this.finalScore = data.score || 0;
        this.reachedLevel = data.level || 1;
    }

    create() {
        addJellyBackground(this, 0, false);

        SFX.play(this, 'gameover');

        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.6);
        overlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

        const title = this.add.text(GAME_WIDTH / 2, 160, 'GAME OVER', {
            fontFamily: 'Courier New',
            fontSize: '56px',
            color: '#ff3366',
            stroke: '#330011',
            strokeThickness: 6
        }).setOrigin(0.5);

        this.tweens.add({
            targets: title,
            scale: 1.1,
            duration: 800,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        this.add.text(GAME_WIDTH / 2, 260, 'Final Score: ' + this.finalScore, {
            fontFamily: 'Courier New',
            fontSize: '28px',
            color: '#ffd700',
            stroke: '#332200',
            strokeThickness: 3
        }).setOrigin(0.5);

        this.add.text(GAME_WIDTH / 2, 310, 'Reached Level: ' + this.reachedLevel, {
            fontFamily: 'Courier New',
            fontSize: '20px',
            color: '#6688aa'
        }).setOrigin(0.5);

        const retryButton = this.createButton(GAME_WIDTH / 2, 400, 'TRY AGAIN', () => {
            this.scene.start('ScenePlay', { level: 1, score: 0, lives: 3 });
        });

        const menuButton = this.createButton(GAME_WIDTH / 2, 470, 'MAIN MENU', () => {
            this.scene.start('SceneMenu');
        });

        this.input.keyboard.on('keydown-ENTER', () => {
            this.scene.start('ScenePlay', { level: 1, score: 0, lives: 3 });
        });

        this.input.keyboard.on('keydown-ESC', () => {
            this.scene.start('SceneMenu');
        });

        this.time.delayedCall(300, () => {
            this.createFallingParticles();
        });
    }

    createFallingParticles() {
        for (let i = 0; i < 15; i++) {
            const x = Phaser.Math.Between(0, GAME_WIDTH);
            const particle = this.add.image(x, -20, 'particle').setTint(0xff3366).setScale(2);
            this.tweens.add({
                targets: particle,
                y: GAME_HEIGHT + 30,
                x: x + Phaser.Math.Between(-50, 50),
                duration: Phaser.Math.Between(2000, 4000),
                delay: i * 100,
                repeat: -1,
                ease: 'Sine.easeIn'
            });
        }
    }

    createButton(x, y, label, callback) {
        const container = this.add.container(x, y);
        const width = 200;
        const height = 46;

        const bg = this.add.graphics();
        bg.fillStyle(0x1a1a3a, 0.9);
        bg.fillRoundedRect(-width / 2, -height / 2, width, height, 10);
        bg.lineStyle(2, 0xff3366, 1);
        bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 10);
        container.add(bg);

        const text = this.add.text(0, 0, label, {
            fontFamily: 'Courier New',
            fontSize: '18px',
            color: '#ff3366',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        container.add(text);

        container.setSize(width, height);
        container.setInteractive({ useHandCursor: true });

        container.on('pointerover', () => {
            bg.clear();
            bg.fillStyle(0x3a1a3a, 1);
            bg.fillRoundedRect(-width / 2, -height / 2, width, height, 10);
            bg.lineStyle(2, 0xff6699, 1);
            bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 10);
            text.setColor('#ff6699');
            container.setScale(1.05);
        });

        container.on('pointerout', () => {
            bg.clear();
            bg.fillStyle(0x1a1a3a, 0.9);
            bg.fillRoundedRect(-width / 2, -height / 2, width, height, 10);
            bg.lineStyle(2, 0xff3366, 1);
            bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 10);
            text.setColor('#ff3366');
            container.setScale(1.0);
        });

        container.on('pointerdown', () => {
            container.setScale(0.95);
        });

        container.on('pointerup', () => {
            callback();
        });

        return container;
    }
}
