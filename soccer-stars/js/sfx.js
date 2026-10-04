// Soccer Stars - tiny WebAudio sound module. All audio is synthesized;
// there are no audio files. M toggles the background loop.

const SFX = {
    ctx: null,
    musicOn: true,
    musicTimer: null,
    musicStep: 0,

    ensure() {
        if (!this.ctx) {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return false;
            this.ctx = new AC();
        }
        if (this.ctx.state === 'suspended') this.ctx.resume();
        // restore saved preference once
        if (this._prefLoaded !== true) {
            this._prefLoaded = true;
            const saved = localStorage.getItem(STORAGE_KEYS.music);
            if (saved === 'off') this.musicOn = false;
        }
        return true;
    },

    tone(freq, dur, type, vol, delay) {
        if (!this.ensure()) return;
        const t = this.ctx.currentTime + (delay || 0);
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type || 'square';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(vol || 0.08, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + dur + 0.02);
    },

    play(name) {
        switch (name) {
            case 'jump':
                this.tone(300, 0.12, 'square', 0.06);
                this.tone(520, 0.14, 'square', 0.05, 0.05);
                break;
            case 'land':
                this.tone(180, 0.07, 'triangle', 0.05);
                break;
            case 'click':
                this.tone(660, 0.06, 'square', 0.05);
                break;
            case 'select':
                this.tone(523, 0.09, 'square', 0.06);
                this.tone(784, 0.12, 'square', 0.06, 0.08);
                break;
            case 'gameover':
                this.tone(392, 0.2, 'sawtooth', 0.07);
                this.tone(311, 0.25, 'sawtooth', 0.07, 0.18);
                this.tone(233, 0.45, 'sawtooth', 0.07, 0.4);
                break;
            case 'victory':
                this.tone(523, 0.12, 'square', 0.07);
                this.tone(659, 0.12, 'square', 0.07, 0.12);
                this.tone(784, 0.12, 'square', 0.07, 0.24);
                this.tone(1047, 0.35, 'square', 0.08, 0.36);
                break;
        }
    },

    // Cheerful two-bar chiptune loop (pentatonic), scheduled per step.
    MELODY: [523, 659, 784, 659, 880, 784, 659, 523, 587, 698, 880, 698, 784, 659, 523, 392],
    BASS:   [131, 131, 165, 165, 175, 175, 196, 196],

    startMusic() {
        if (!this.ensure() || !this.musicOn || this.musicTimer) return;
        this.musicStep = 0;
        this.musicTimer = setInterval(() => {
            if (!this.musicOn) return;
            const i = this.musicStep;
            this.tone(this.MELODY[i % this.MELODY.length], 0.18, 'triangle', 0.035);
            if (i % 2 === 0) {
                this.tone(this.BASS[(i / 2) % this.BASS.length], 0.3, 'sine', 0.05);
            }
            this.musicStep++;
        }, 220);
    },

    stopMusic() {
        if (this.musicTimer) {
            clearInterval(this.musicTimer);
            this.musicTimer = null;
        }
    },

    toggleMusic() {
        this.musicOn = !this.musicOn;
        localStorage.setItem(STORAGE_KEYS.music, this.musicOn ? 'on' : 'off');
        if (this.musicOn) this.startMusic(); else this.stopMusic();
        return this.musicOn;
    }
};
