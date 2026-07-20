// Sound effects (procedural WebAudio) + background music control.
// No audio asset files are needed for SFX - everything is synthesized.
const SFX = {
    musicOn: true,
    sfxOn: true,
    volume: 0.15,

    context(scene) {
        return (scene.sound && scene.sound.context) ? scene.sound.context : null;
    },

    // Play a single synthesized tone with a pitch slide and volume envelope.
    tone(scene, opts) {
        if (!this.sfxOn) return;
        const ctx = this.context(scene);
        if (!ctx) return;

        const freq     = opts.freq     || 440;
        const freqEnd  = opts.freqEnd  || null;
        const duration = opts.duration || 0.15;
        const type     = opts.type     || 'square';
        const volume   = (opts.volume !== undefined ? opts.volume : 1) * this.volume;
        const delay    = opts.delay    || 0;

        try {
            const t0 = ctx.currentTime + delay;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, t0);
            if (freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), t0 + duration);
            gain.gain.setValueAtTime(volume, t0);
            gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(t0);
            osc.stop(t0 + duration + 0.05);
        } catch (e) { /* audio not ready yet - ignore */ }
    },

    play(scene, name) {
        if (!this.sfxOn) return;
        switch (name) {
            case 'jump':
                this.tone(scene, { freq: 260, freqEnd: 540, duration: 0.13, type: 'square' });
                break;
            case 'jump2':
                this.tone(scene, { freq: 360, freqEnd: 720, duration: 0.13, type: 'square' });
                break;
            case 'coin':
                this.tone(scene, { freq: 988, duration: 0.06, type: 'sine', volume: 1.2 });
                this.tone(scene, { freq: 1319, duration: 0.14, type: 'sine', volume: 1.2, delay: 0.06 });
                break;
            case 'crystal':
                this.tone(scene, { freq: 880,  duration: 0.07, type: 'sine', volume: 1.1 });
                this.tone(scene, { freq: 1175, duration: 0.07, type: 'sine', volume: 1.1, delay: 0.07 });
                this.tone(scene, { freq: 1568, duration: 0.12, type: 'sine', volume: 1.1, delay: 0.14 });
                break;
            case 'stomp':
                this.tone(scene, { freq: 320, freqEnd: 70, duration: 0.16, type: 'triangle', volume: 1.4 });
                break;
            case 'hurt':
                this.tone(scene, { freq: 220, freqEnd: 60, duration: 0.28, type: 'sawtooth', volume: 1.2 });
                break;
            case 'fall':
                this.tone(scene, { freq: 420, freqEnd: 90, duration: 0.42, type: 'sine', volume: 1.2 });
                break;
            case 'win':
                [523, 659, 784, 1047].forEach((f, i) =>
                    this.tone(scene, { freq: f, duration: 0.11, type: 'triangle', volume: 1.2, delay: i * 0.09 }));
                break;
            case 'click':
                this.tone(scene, { freq: 620, duration: 0.05, type: 'square', volume: 0.8 });
                break;
            case 'select':
                this.tone(scene, { freq: 520, duration: 0.07, type: 'square' });
                this.tone(scene, { freq: 780, duration: 0.12, type: 'square', delay: 0.07 });
                break;
            case 'pause':
                this.tone(scene, { freq: 440, duration: 0.07, type: 'square' });
                this.tone(scene, { freq: 330, duration: 0.1, type: 'square', delay: 0.08 });
                break;
            case 'gameover':
                [392, 330, 262, 196].forEach((f, i) =>
                    this.tone(scene, { freq: f, duration: 0.2, type: 'triangle', volume: 1.2, delay: i * 0.18 }));
                break;
            case 'powerup':
                this.tone(scene, { freq: 220, freqEnd: 1320, duration: 0.5, type: 'sawtooth', volume: 0.9 });
                this.tone(scene, { freq: 880, duration: 0.12, type: 'sine', delay: 0.45 });
                this.tone(scene, { freq: 1320, duration: 0.2, type: 'sine', delay: 0.57 });
                break;
            case 'victory':
                this.playVictoryJingle(scene);
                break;
        }
    },

    // A small victory jingle (~7 seconds) played after beating the game.
    playVictoryJingle(scene) {
        // [frequency, beats] - cheerful march in C major
        const melody = [
            [523, 1], [523, 1], [523, 1], [659, 2],
            [784, 1], [784, 1], [784, 1], [1047, 2],
            [880, 1], [784, 1], [659, 1], [523, 2],
            [587, 1], [659, 1], [587, 1], [523, 2],
            [659, 1], [784, 1], [880, 1], [1047, 2],
            [880, 1], [784, 1], [659, 1], [587, 2],
            [523, 3], [0, 1],
            [1047, 4]
        ];
        const bass = [
            [262, 2], [196, 2], [262, 2], [196, 2],
            [220, 2], [196, 2], [262, 2], [196, 2],
            [175, 2], [196, 2], [262, 4]
        ];
        const beat = 0.26;
        let t = 0;
        for (const [freq, beats] of melody) {
            if (freq > 0) {
                this.tone(scene, { freq, duration: beat * beats * 0.9, type: 'triangle', volume: 1.3, delay: t });
            }
            t += beat * beats;
        }
        t = 0;
        for (const [freq, beats] of bass) {
            this.tone(scene, { freq, duration: beat * beats * 0.9, type: 'sine', volume: 0.9, delay: t });
            t += beat * beats;
        }
    },

    startMusic(scene) {
        if (!this.musicOn || !scene.sound || !scene.sound.get) return;
        let music = scene.sound.get('music');
        if (!music) {
            try {
                music = scene.sound.add('music', { loop: true, volume: 0.4 });
            } catch (e) { return; }
        }
        if (music && !music.isPlaying) {
            try { music.play(); } catch (e) { /* starts on first user gesture */ }
        }
    },

    toggleMusic(scene) {
        this.musicOn = !this.musicOn;
        if (this.musicOn) {
            this.startMusic(scene);
        } else if (scene.sound && scene.sound.get) {
            const music = scene.sound.get('music');
            if (music && music.isPlaying) music.pause();
        }
        return this.musicOn;
    },

    toggleSfx() {
        this.sfxOn = !this.sfxOn;
        return this.sfxOn;
    }
};

// Draws the jellyfish artwork as a cover-fit background with an optional dark overlay.
function addJellyBackground(scene, overlayAlpha, animate) {
    const img = scene.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'bgJellies');
    const scale = Math.max(GAME_WIDTH / img.width, GAME_HEIGHT / img.height);
    img.setScale(scale);

    if (animate) {
        scene.tweens.add({
            targets: img,
            scale: scale * 1.07,
            duration: 11000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }

    let overlay = null;
    if (overlayAlpha > 0) {
        overlay = scene.add.rectangle(
            GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000014, overlayAlpha
        );
    }
    return { img, overlay };
}

// Small reusable MUSIC/SOUND toggle buttons used on the menu and character select screens.
function createAudioToggles(scene, x, y) {
    const container = scene.add.container(x, y);
    const style = {
        fontFamily: 'Courier New',
        fontSize: '14px',
        color: '#00d4ff',
        backgroundColor: '#0a0a2acc',
        padding: { x: 10, y: 6 }
    };

    const musicBtn = scene.add.text(-95, 0, '', style).setOrigin(0.5).setInteractive({ useHandCursor: true });
    const sfxBtn = scene.add.text(95, 0, '', { ...style, color: '#ff66cc' }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    const refresh = () => {
        musicBtn.setText('MUSIC: ' + (SFX.musicOn ? 'ON' : 'OFF'));
        sfxBtn.setText('SOUND: ' + (SFX.sfxOn ? 'ON' : 'OFF'));
        musicBtn.setAlpha(SFX.musicOn ? 1 : 0.55);
        sfxBtn.setAlpha(SFX.sfxOn ? 1 : 0.55);
    };

    musicBtn.on('pointerdown', () => { SFX.toggleMusic(scene); SFX.play(scene, 'click'); refresh(); });
    sfxBtn.on('pointerdown', () => { SFX.toggleSfx(); SFX.play(scene, 'click'); refresh(); });

    container.add([musicBtn, sfxBtn]);
    refresh();
    return container;
}
