class SceneVictory extends Phaser.Scene {
    constructor() {
        super('SceneVictory');
    }

    init(data) {
        this.finalScore = data.score || 0;
    }

    create() {
        addJellyBackground(this, 0, false);

        SFX.play(this, 'victory');

        const overlay = this.add.graphics();
        overlay.fillStyle(0x001122, 0.5);
        overlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

        const title = this.add.text(GAME_WIDTH / 2, 130, 'VICTORY!', {
            fontFamily: 'Courier New',
            fontSize: '56px',
            color: '#00ffaa',
            stroke: '#003322',
            strokeThickness: 6
        }).setOrigin(0.5);

        this.tweens.add({
            targets: title,
            scale: 1.15,
            duration: 600,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        this.add.text(GAME_WIDTH / 2, 220, 'You conquered Jelly Jump!', {
            fontFamily: 'Courier New',
            fontSize: '22px',
            color: '#66ffcc'
        }).setOrigin(0.5);

        this.add.text(GAME_WIDTH / 2, 290, 'Final Score: ' + this.finalScore, {
            fontFamily: 'Courier New',
            fontSize: '32px',
            color: '#ffd700',
            stroke: '#332200',
            strokeThickness: 3
        }).setOrigin(0.5);

        const stars = this.add.container(GAME_WIDTH / 2, 360);
        for (let i = 0; i < 3; i++) {
            const star = this.add.image((i - 1) * 50, 0, 'star').setScale(2.5);
            stars.add(star);
            this.tweens.add({
                targets: star,
                angle: 360,
                duration: 3000,
                repeat: -1,
                ease: 'Linear'
            });
            this.tweens.add({
                targets: star,
                scaleX: 3,
                scaleY: 3,
                duration: 500,
                delay: i * 200,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
        }

        const playAgainButton = this.createButton(GAME_WIDTH / 2, 450, 'PLAY AGAIN', () => {
            this.scene.start('ScenePlay', { level: 1, score: 0, lives: 3 });
        });

        const menuButton = this.createButton(GAME_WIDTH / 2, 520, 'MAIN MENU', () => {
            this.scene.start('SceneMenu');
        });

        this.input.keyboard.on('keydown-ENTER', () => {
            this.scene.start('ScenePlay', { level: 1, score: 0, lives: 3 });
        });

        this.input.keyboard.on('keydown-ESC', () => {
            this.scene.start('SceneMenu');
        });

        this.createCelebrationParticles();
    }

    createCelebrationParticles() {
        const colors = [0x00ffaa, 0x00d4ff, 0xffd700, 0xff66cc, 0xff9966];
        let count = 0;
        const interval = setInterval(() => {
            if (count > 50 || !this.scene.isActive()) {
                clearInterval(interval);
                return;
            }
            const x = Phaser.Math.Between(0, GAME_WIDTH);
            const y = Phaser.Math.Between(0, GAME_HEIGHT * 0.6);
            const color = Phaser.Utils.Array.GetRandom(colors);

            const particle = this.add.image(x, y, 'particle').setTint(color).setScale(2);
            this.tweens.add({
                targets: particle,
                y: y + Phaser.Math.Between(100, 200),
                x: x + Phaser.Math.Between(-80, 80),
                alpha: 0,
                scale: 0,
                duration: Phaser.Math.Between(1500, 2500),
                ease: 'Sine.easeOut',
                onComplete: () => particle.destroy()
            });
            count++;
        }, 100);
    }

    createButton(x, y, label, callback) {
        const container = this.add.container(x, y);
        const width = 200;
        const height = 46;

        const bg = this.add.graphics();
        bg.fillStyle(0x0a2a2a, 0.9);
        bg.fillRoundedRect(-width / 2, -height / 2, width, height, 10);
        bg.lineStyle(2, 0x00ffaa, 1);
        bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 10);
        container.add(bg);

        const text = this.add.text(0, 0, label, {
            fontFamily: 'Courier New',
            fontSize: '18px',
            color: '#00ffaa',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        container.add(text);

        container.setSize(width, height);
        container.setInteractive({ useHandCursor: true });

        container.on('pointerover', () => {
            bg.clear();
            bg.fillStyle(0x1a4a4a, 1);
            bg.fillRoundedRect(-width / 2, -height / 2, width, height, 10);
            bg.lineStyle(2, 0x66ffcc, 1);
            bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 10);
            text.setColor('#66ffcc');
            container.setScale(1.05);
        });

        container.on('pointerout', () => {
            bg.clear();
            bg.fillStyle(0x0a2a2a, 0.9);
            bg.fillRoundedRect(-width / 2, -height / 2, width, height, 10);
            bg.lineStyle(2, 0x00ffaa, 1);
            bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 10);
            text.setColor('#00ffaa');
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
