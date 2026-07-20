class SceneBoot extends Phaser.Scene {
    constructor() {
        super('SceneBoot');
    }

    preload() {
        const loadingText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 30, 'Loading...', {
            fontFamily: 'Courier New',
            fontSize: '24px',
            color: '#00d4ff'
        }).setOrigin(0.5);

        const barBg = this.add.graphics();
        barBg.fillStyle(0x1a1a3a, 1);
        barBg.fillRoundedRect(GAME_WIDTH / 2 - 150, GAME_HEIGHT / 2 + 10, 300, 16, 8);
        const bar = this.add.graphics();

        this.load.on('progress', (value) => {
            bar.clear();
            bar.fillStyle(0x00d4ff, 1);
            bar.fillRoundedRect(GAME_WIDTH / 2 - 146, GAME_HEIGHT / 2 + 14, 292 * value, 8, 4);
        });

        this.load.image('bgJellies', 'assets/bg_jellies.jpeg');
        this.load.audio('music', 'assets/music_jellyfish.mp3');
    }

    create() {
        this.generateTextures();
        this.scene.start('SceneMenu');
    }

    generateTextures() {
        for (const c of CHARACTERS) {
            this.createCharacterTexture('char_' + c.key,        c.key, 'idle');
            this.createCharacterTexture('char_' + c.key + '_run1', c.key, 'run1');
            this.createCharacterTexture('char_' + c.key + '_run2', c.key, 'run2');
            this.createCharacterTexture('char_' + c.key + '_jump', c.key, 'jump');
        }

        this.createPlatformTexture('platform', TILE_SIZE, TILE_SIZE);
        this.createGroundTexture('ground', TILE_SIZE, TILE_SIZE);
        this.createCoinTexture('coin', 20, 20);
        this.createCrystalTexture('crystal', 24, 28);
        this.createEnemyTexture('enemy', 30, 28);
        this.createSpikeTexture('spike', TILE_SIZE, 20);
        this.createParticleTexture('particle', 6, 6);
        this.createBitcoinTexture('bitcoin', 28, 28);
        this.createFlagTextures();
        this.createCloudTexture('cloud', 80, 30);
        this.createHeartTexture('heart', 20, 18);
        this.createStarTexture('star', 16, 16);
    }

    // All characters are drawn facing RIGHT on a 28x36 canvas.
    // pose: 'idle' | 'run1' | 'run2' | 'jump'
    createCharacterTexture(key, characterKey, pose) {
        const g = this.add.graphics();
        g.clear();

        switch (characterKey) {
            case 'riley': this.drawAxolotl(g, pose); break;
            case 'mommy': this.drawBear(g, pose); break;
            case 'daddy': this.drawTurtle(g, pose); break;
            case 'max':
            default:      this.drawDragon(g, pose); break;
        }

        g.generateTexture(key, 28, 36);
        g.destroy();
    }

    drawFeet(g, color, pose, w, h) {
        let leftY = h - 4, rightY = h - 4;
        if (pose === 'run1') { leftY = h - 6; rightY = h - 4; }
        else if (pose === 'run2') { leftY = h - 4; rightY = h - 6; }
        else if (pose === 'jump') { leftY = h - 7; rightY = h - 7; }
        g.fillStyle(color, 1);
        g.fillRect(8, leftY, 7, 4);
        g.fillRect(w - 15, rightY, 7, 4);
    }

    drawDragon(g, pose) {
        const w = 28, h = 36;
        const body = 0x3ddc63, dark = 0x249a44, belly = 0xbaffcf;
        const wing = 0x2ab04e, membrane = 0x8ff0aa, horn = 0xffd24d;

        // tail
        g.fillStyle(dark, 1);
        g.fillTriangle(3, 26, 9, 20, 9, 30);
        // body
        g.fillStyle(body, 1);
        g.fillRoundedRect(6, 9, 18, 24, 7);
        // belly
        g.fillStyle(belly, 1);
        g.fillEllipse(17, 26, 10, 13);
        // wing (flaps upward while jumping)
        g.fillStyle(wing, 1);
        if (pose === 'jump') {
            g.fillTriangle(8, 14, 1, 1, 15, 9);
            g.fillStyle(membrane, 1);
            g.fillTriangle(8, 12, 3, 3, 13, 9);
        } else {
            g.fillTriangle(8, 18, 2, 6, 13, 13);
            g.fillStyle(membrane, 1);
            g.fillTriangle(8, 16, 4, 8, 12, 13);
        }
        // horns
        g.fillStyle(horn, 1);
        g.fillTriangle(10, 10, 12, 2, 14, 10);
        g.fillTriangle(16, 10, 18, 3, 20, 10);
        // back spikes
        g.fillTriangle(5, 13, 2, 10, 7, 11);
        g.fillTriangle(5, 19, 2, 16, 7, 17);
        // snout
        g.fillStyle(body, 1);
        g.fillRoundedRect(19, 11, 8, 8, 3);
        g.fillStyle(dark, 1);
        g.fillCircle(25, 14, 1);
        // eye
        g.fillStyle(0xffffff, 1);
        g.fillCircle(20, 13, 3);
        g.fillStyle(0x1a2a1a, 1);
        g.fillCircle(21, 13, 1.5);

        this.drawFeet(g, dark, pose, w, h);
    }

    drawAxolotl(g, pose) {
        const w = 28, h = 36;
        const body = 0xff9fce, gill = 0xff5c8a, belly = 0xffd9e8;

        // tail fin
        g.fillStyle(gill, 1);
        g.fillTriangle(2, 24, 8, 16, 8, 32);
        // body (one big round shape)
        g.fillStyle(body, 1);
        g.fillRoundedRect(5, 7, 19, 26, 9);
        // belly
        g.fillStyle(belly, 1);
        g.fillEllipse(15, 27, 12, 10);
        // external gills - 3 stalks per side
        g.lineStyle(2, gill, 1);
        g.lineBetween(6, 9, 1, 5);
        g.lineBetween(5, 12, 0, 11);
        g.lineBetween(6, 15, 2, 19);
        g.lineBetween(22, 9, 27, 5);
        g.lineBetween(23, 12, 28, 11);
        g.lineBetween(22, 15, 26, 19);
        g.fillStyle(gill, 1);
        g.fillCircle(1, 5, 2);  g.fillCircle(1, 11, 2); g.fillCircle(2, 19, 2);
        g.fillCircle(27, 5, 2); g.fillCircle(27, 11, 2); g.fillCircle(26, 19, 2);
        // eyes
        g.fillStyle(0x2a1a22, 1);
        g.fillCircle(12, 13, 2.2);
        g.fillCircle(20, 13, 2.2);
        g.fillStyle(0xffffff, 1);
        g.fillCircle(11.4, 12.4, 0.8);
        g.fillCircle(19.4, 12.4, 0.8);
        // smile
        g.lineStyle(1.5, 0x8a2a52, 1);
        g.beginPath();
        g.arc(16, 17, 3.5, Math.PI * 0.15, Math.PI * 0.85);
        g.strokePath();

        this.drawFeet(g, body, pose, w, h);
    }

    drawBear(g, pose) {
        const w = 28, h = 36;
        const body = 0xb5835a, dark = 0x8a5f3c, light = 0xe8c9a0, bow = 0xff6fa5;

        // ears
        g.fillStyle(body, 1);
        g.fillCircle(9, 6, 4);
        g.fillCircle(20, 6, 4);
        g.fillStyle(dark, 1);
        g.fillCircle(9, 6, 2);
        g.fillCircle(20, 6, 2);
        // body
        g.fillStyle(body, 1);
        g.fillRoundedRect(5, 8, 19, 25, 8);
        // belly
        g.fillStyle(light, 1);
        g.fillEllipse(14, 27, 11, 12);
        // bow on top of head
        g.fillStyle(bow, 1);
        g.fillTriangle(15, 4, 10, 1, 10, 7);
        g.fillTriangle(15, 4, 20, 1, 20, 7);
        g.fillCircle(15, 4, 1.8);
        // snout
        g.fillStyle(light, 1);
        g.fillEllipse(17, 17, 9, 7);
        g.fillStyle(0x3a2415, 1);
        g.fillCircle(19, 15, 1.6);
        // smile
        g.lineStyle(1, 0x3a2415, 1);
        g.beginPath();
        g.arc(17, 17, 3, Math.PI * 0.2, Math.PI * 0.8);
        g.strokePath();
        // eyes
        g.fillStyle(0xffffff, 1);
        g.fillCircle(11, 11, 2.5);
        g.fillCircle(18, 11, 2.5);
        g.fillStyle(0x2a1a10, 1);
        g.fillCircle(11.6, 11, 1.2);
        g.fillCircle(18.6, 11, 1.2);
        // eyelashes
        g.lineStyle(1, 0x2a1a10, 1);
        g.lineBetween(8.6, 9.6, 7.2, 8.2);
        g.lineBetween(20.4, 9.6, 21.8, 8.2);

        this.drawFeet(g, dark, pose, w, h);
    }

    drawTurtle(g, pose) {
        const w = 28, h = 36;
        const skin = 0x5ec45e, shellDark = 0x2e7d32, shellLight = 0x4caf50, belly = 0xd7f0c2;

        // tail
        g.fillStyle(skin, 1);
        g.fillTriangle(4, 28, 8, 25, 8, 31);
        // shell on the back
        g.fillStyle(shellDark, 1);
        g.fillEllipse(11, 21, 17, 21);
        g.lineStyle(1.5, shellLight, 1);
        g.strokeEllipse(11, 21, 17, 21);
        g.lineStyle(1, shellLight, 1);
        g.lineBetween(11, 11, 11, 31);
        g.lineBetween(4, 21, 18, 21);
        // front body
        g.fillStyle(skin, 1);
        g.fillRoundedRect(12, 12, 12, 21, 6);
        // belly
        g.fillStyle(belly, 1);
        g.fillEllipse(19, 26, 8, 12);
        // head
        g.fillStyle(skin, 1);
        g.fillCircle(20, 9, 5.5);
        // eye
        g.fillStyle(0x1a2a1a, 1);
        g.fillCircle(21.5, 8, 1.4);
        // round glasses
        g.lineStyle(1.2, 0xffffff, 1);
        g.strokeCircle(21, 8, 3.2);
        g.lineBetween(24, 7, 26, 6);
        // smile
        g.lineStyle(1, 0x1c4a1c, 1);
        g.beginPath();
        g.arc(20, 11, 2.5, Math.PI * 0.2, Math.PI * 0.8);
        g.strokePath();

        this.drawFeet(g, skin, pose, w, h);
    }

    createPlatformTexture(key, w, h) {
        const g = this.add.graphics();
        g.clear();
        g.fillStyle(0x3a2a5a, 1);
        g.fillRoundedRect(0, 0, w, h, 4);
        g.fillStyle(0x5a3a8a, 1);
        g.fillRoundedRect(0, 0, w, 6, 4);
        g.fillStyle(0x2a1a4a, 1);
        g.fillRoundedRect(0, h - 4, w, 4, 2);
        g.fillStyle(0x6a4aaa, 0.5);
        g.fillCircle(w * 0.25, h * 0.5, 2);
        g.fillCircle(w * 0.75, h * 0.6, 2);
        g.generateTexture(key, w, h);
        g.destroy();
    }

    createGroundTexture(key, w, h) {
        const g = this.add.graphics();
        g.clear();
        g.fillStyle(0x2a1a4a, 1);
        g.fillRect(0, 0, w, h);
        g.fillStyle(0x4a2a7a, 1);
        g.fillRect(0, 0, w, 8);
        g.fillStyle(0x1a0a3a, 1);
        g.fillRect(0, h - 4, w, 4);
        g.fillStyle(0x6a3aaa, 0.4);
        g.fillCircle(w * 0.3, h * 0.4, 3);
        g.fillCircle(w * 0.7, h * 0.6, 2);
        g.generateTexture(key, w, h);
        g.destroy();
    }

    createCoinTexture(key, w, h) {
        const g = this.add.graphics();
        g.clear();
        g.fillStyle(0xffd700, 1);
        g.fillCircle(w / 2, h / 2, w / 2 - 1);
        g.fillStyle(0xffaa00, 1);
        g.fillCircle(w / 2, h / 2, w / 2 - 3);
        g.fillStyle(0xffe44d, 1);
        g.fillRect(w / 2 - 2, h / 2 - 5, 4, 10);
        g.generateTexture(key, w, h);
        g.destroy();
    }

    createCrystalTexture(key, w, h) {
        const g = this.add.graphics();
        g.clear();
        g.fillStyle(0x00ffaa, 0.9);
        g.beginPath();
        g.moveTo(w / 2, 0);
        g.lineTo(w, h * 0.35);
        g.lineTo(w * 0.8, h);
        g.lineTo(w * 0.2, h);
        g.lineTo(0, h * 0.35);
        g.closePath();
        g.fillPath();
        g.fillStyle(0x66ffcc, 0.8);
        g.beginPath();
        g.moveTo(w / 2, 4);
        g.lineTo(w * 0.8, h * 0.35);
        g.lineTo(w * 0.6, h * 0.8);
        g.lineTo(w * 0.4, h * 0.8);
        g.lineTo(w * 0.2, h * 0.35);
        g.closePath();
        g.fillPath();
        g.fillStyle(0xffffff, 0.6);
        g.fillRect(w / 2 - 1, 4, 2, h - 8);
        g.generateTexture(key, w, h);
        g.destroy();
    }

    createEnemyTexture(key, w, h) {
        const g = this.add.graphics();
        g.clear();
        g.fillStyle(0xff3366, 1);
        g.fillRoundedRect(0, 4, w, h - 4, 8);
        g.fillStyle(0xcc1144, 1);
        g.fillRoundedRect(0, h - 8, w, 4, 4);
        g.fillStyle(0xffffff, 1);
        g.fillCircle(w * 0.3, h * 0.4, 5);
        g.fillCircle(w * 0.7, h * 0.4, 5);
        g.fillStyle(0x000000, 1);
        g.fillCircle(w * 0.3, h * 0.4, 2.5);
        g.fillCircle(w * 0.7, h * 0.4, 2.5);
        g.fillStyle(0xffffff, 1);
        g.fillRect(w * 0.2, h * 0.7, 4, 2);
        g.fillRect(w * 0.35, h * 0.7, 4, 2);
        g.fillRect(w * 0.55, h * 0.7, 4, 2);
        g.fillRect(w * 0.7, h * 0.7, 4, 2);
        g.generateTexture(key, w, h);
        g.destroy();
    }

    createSpikeTexture(key, w, h) {
        const g = this.add.graphics();
        g.clear();
        g.fillStyle(0x888899, 1);
        const spikeWidth = w / 3;
        for (let i = 0; i < 3; i++) {
            g.beginPath();
            g.moveTo(i * spikeWidth, h);
            g.lineTo(i * spikeWidth + spikeWidth / 2, 0);
            g.lineTo((i + 1) * spikeWidth, h);
            g.closePath();
            g.fillPath();
        }
        g.fillStyle(0xccccdd, 0.6);
        for (let i = 0; i < 3; i++) {
            g.beginPath();
            g.moveTo(i * spikeWidth + 2, h);
            g.lineTo(i * spikeWidth + spikeWidth / 2, 4);
            g.lineTo(i * spikeWidth + spikeWidth / 2, h);
            g.closePath();
            g.fillPath();
        }
        g.generateTexture(key, w, h);
        g.destroy();
    }

    createParticleTexture(key, w, h) {
        const g = this.add.graphics();
        g.clear();
        g.fillStyle(0xffffff, 1);
        g.fillCircle(w / 2, h / 2, w / 2);
        g.generateTexture(key, w, h);
        g.destroy();
    }

    // Floating Bitcoin powerup: orange coin with a cream "B".
    createBitcoinTexture(key, w, h) {
        const g = this.add.graphics();
        g.clear();
        const cx = w / 2, cy = h / 2;
        // coin body
        g.fillStyle(0xf7931a, 1);
        g.fillCircle(cx, cy, 13);
        g.lineStyle(2, 0xffd24d, 1);
        g.strokeCircle(cx, cy, 11);
        // "B" - two bumps with a vertical bar over their left edges
        g.fillStyle(0xfff7e6, 1);
        g.fillCircle(cx + 2, cy - 4, 4.5);
        g.fillCircle(cx + 2, cy + 4, 4.5);
        g.fillRect(cx - 3.5, cy - 8, 3.5, 16);
        // double-stroke hints of the bitcoin symbol
        g.fillRect(cx - 3.5, cy - 11, 2, 3);
        g.fillRect(cx - 3.5, cy + 8, 2, 3);
        g.generateTexture(key, w, h);
        g.destroy();
    }

    // 'Finish' flag: separate pole and cloth so the cloth can wave.
    createFlagTextures() {
        // pole (8x56) with a golden knob on top
        let g = this.add.graphics();
        g.clear();
        g.fillStyle(0x9999aa, 1);
        g.fillRect(2, 3, 4, 53);
        g.fillStyle(0xffd700, 1);
        g.fillCircle(4, 3, 4);
        g.generateTexture('flagpole', 8, 56);
        g.destroy();

        // cloth (36x20), green with a lighter stripe
        g = this.add.graphics();
        g.clear();
        g.fillStyle(0x22cc55, 1);
        g.fillRect(0, 0, 36, 20);
        g.fillStyle(0x66ff99, 1);
        g.fillRect(0, 0, 36, 6);
        g.fillStyle(0x118833, 1);
        g.fillRect(0, 16, 36, 4);
        g.generateTexture('flagcloth', 36, 20);
        g.destroy();
    }

    createCloudTexture(key, w, h) {
        const g = this.add.graphics();
        g.clear();
        g.fillStyle(0x3a3a6a, 0.4);
        g.fillCircle(w * 0.2, h * 0.6, h * 0.5);
        g.fillCircle(w * 0.4, h * 0.4, h * 0.55);
        g.fillCircle(w * 0.6, h * 0.5, h * 0.45);
        g.fillCircle(w * 0.8, h * 0.6, h * 0.4);
        g.fillRect(w * 0.15, h * 0.5, w * 0.7, h * 0.3);
        g.generateTexture(key, w, h);
        g.destroy();
    }

    createHeartTexture(key, w, h) {
        const g = this.add.graphics();
        g.clear();
        g.fillStyle(0xff3366, 1);
        g.beginPath();
        g.moveTo(w / 2, h);
        g.lineTo(0, h * 0.3);
        g.lineTo(w * 0.15, 0);
        g.lineTo(w / 2, h * 0.3);
        g.lineTo(w * 0.85, 0);
        g.lineTo(w, h * 0.3);
        g.closePath();
        g.fillPath();
        g.fillStyle(0xff6699, 0.6);
        g.fillCircle(w * 0.3, h * 0.3, 2);
        g.generateTexture(key, w, h);
        g.destroy();
    }

    createStarTexture(key, w, h) {
        const g = this.add.graphics();
        g.clear();
        g.fillStyle(0xffe44d, 1);
        const cx = w / 2;
        const cy = h / 2;
        const outerR = w / 2;
        const innerR = w / 4;
        g.beginPath();
        for (let i = 0; i < 10; i++) {
            const angle = (Math.PI / 5) * i - Math.PI / 2;
            const r = i % 2 === 0 ? outerR : innerR;
            const x = cx + Math.cos(angle) * r;
            const y = cy + Math.sin(angle) * r;
            if (i === 0) g.moveTo(x, y);
            else g.lineTo(x, y);
        }
        g.closePath();
        g.fillPath();
        g.generateTexture(key, w, h);
        g.destroy();
    }
}
