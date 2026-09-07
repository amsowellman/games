// AudioSystem - theme music playback + fully procedural WebAudio SFX
// (no external SFX assets needed). Volumes come from SaveSystem settings.

import SaveSystem from './SaveSystem.js';

export default class AudioSystem {
  constructor(scene) {
    this.scene = scene;
    this.music = null;
    this._rainNodes = null;
    const unlock = () => {
      const ctx = scene.sound.context;
      if (ctx && ctx.state === 'suspended') ctx.resume();
    };
    scene.input.on('pointerdown', unlock);
  }

  get musicVol() { return SaveSystem.getSettings().music; }
  get sfxVol() { return SaveSystem.getSettings().sfx; }

  playMusic() {
    if (!this.scene.cache.audio.exists('theme')) return; // skipped via ?noaudio=1
    if (this.music && this.music.isPlaying) return;
    // sounds live in the global manager and survive scene changes - reuse a
    // theme that is already playing instead of stacking a second copy
    const playing = this.scene.sound.getAllPlaying('theme')[0];
    if (playing) { this.music = playing; return; }
    this.music = this.scene.sound.add('theme', { loop: true, volume: this.musicVol * 0.7 });
    this.music.play();
  }

  stopMusic() { if (this.music) { this.music.stop(); this.music.destroy(); this.music = null; } }

  refreshMusicVolume() { if (this.music) this.music.setVolume(this.musicVol * 0.7); }

  get ctx() { return this.scene.sound.context; }

  /** Low-level tone helper. */
  _tone({ freq = 440, endFreq = null, dur = 0.2, type = 'sine', vol = 0.5, delay = 0 }) {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol * this.sfxVol, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  /** Low-level filtered-noise helper. */
  _noise({ dur = 0.3, vol = 0.5, freq = 1000, q = 0.8, endFreq = null, delay = 0, type = 'bandpass' }) {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const t0 = ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, t0);
    if (endFreq) filter.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t0 + dur);
    filter.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol * this.sfxVol, t0 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  sfx(name) {
    switch (name) {
      case 'click':   this._tone({ freq: 700, endFreq: 500, dur: 0.07, type: 'triangle', vol: 0.35 }); break;
      case 'stretch': this._tone({ freq: 180, endFreq: 320, dur: 0.12, type: 'sawtooth', vol: 0.12 }); break;
      case 'launch':  this._noise({ dur: 0.4, vol: 0.5, freq: 500, endFreq: 3500, q: 1.2 });
                      this._tone({ freq: 220, endFreq: 660, dur: 0.3, type: 'sine', vol: 0.25 }); break;
      case 'crash':   this._noise({ dur: 0.35, vol: 0.55, freq: 300, endFreq: 90, q: 0.6, type: 'lowpass' });
                      this._tone({ freq: 90, endFreq: 40, dur: 0.3, type: 'sine', vol: 0.4 }); break;
      case 'wood':    this._noise({ dur: 0.16, vol: 0.4, freq: 900, endFreq: 300, q: 2 }); break;
      case 'stone':   this._noise({ dur: 0.22, vol: 0.45, freq: 500, endFreq: 150, q: 1 }); break;
      case 'glass':   this._tone({ freq: 2200, endFreq: 3400, dur: 0.18, type: 'sine', vol: 0.3 });
                      this._noise({ dur: 0.2, vol: 0.25, freq: 4000, q: 3, type: 'highpass' }); break;
      case 'squeak':  this._tone({ freq: 1400, endFreq: 2400, dur: 0.14, type: 'sine', vol: 0.3 });
                      this._tone({ freq: 1800, endFreq: 2600, dur: 0.12, type: 'sine', vol: 0.25, delay: 0.13 }); break;
      case 'rescued': this._tone({ freq: 660, dur: 0.12, type: 'triangle', vol: 0.35 });
                      this._tone({ freq: 880, dur: 0.12, type: 'triangle', vol: 0.35, delay: 0.1 });
                      this._tone({ freq: 1320, dur: 0.22, type: 'triangle', vol: 0.35, delay: 0.2 }); break;
      case 'blast':   this._noise({ dur: 0.5, vol: 0.6, freq: 200, endFreq: 60, q: 0.5, type: 'lowpass' });
                      this._tone({ freq: 140, endFreq: 40, dur: 0.45, type: 'sine', vol: 0.5 });
                      this._tone({ freq: 800, endFreq: 200, dur: 0.3, type: 'sawtooth', vol: 0.15 }); break;
      case 'trap':    this._tone({ freq: 500, endFreq: 180, dur: 0.4, type: 'sine', vol: 0.35 });
                      this._tone({ freq: 350, endFreq: 120, dur: 0.45, type: 'triangle', vol: 0.25, delay: 0.08 }); break;
      case 'bolt':    this._noise({ dur: 0.28, vol: 0.6, freq: 3000, endFreq: 400, q: 0.7, type: 'highpass' });
                      this._tone({ freq: 1200, endFreq: 100, dur: 0.28, type: 'sawtooth', vol: 0.3 }); break;
      case 'bees':    this._tone({ freq: 190, dur: 0.7, type: 'square', vol: 0.12 });
                      this._tone({ freq: 240, dur: 0.7, type: 'square', vol: 0.1, delay: 0.05 }); break;
      case 'wind':    this._noise({ dur: 0.8, vol: 0.4, freq: 400, endFreq: 1400, q: 0.4 }); break;
      case 'shield':  this._tone({ freq: 520, dur: 0.15, type: 'sine', vol: 0.3 });
                      this._tone({ freq: 780, dur: 0.15, type: 'sine', vol: 0.3, delay: 0.09 });
                      this._tone({ freq: 1040, dur: 0.3, type: 'sine', vol: 0.3, delay: 0.18 }); break;
      case 'thunder': this._noise({ dur: 1.4, vol: 0.5, freq: 120, endFreq: 45, q: 0.4, type: 'lowpass', delay: 0.25 }); break;
      case 'hurt':    this._tone({ freq: 500, endFreq: 180, dur: 0.25, type: 'square', vol: 0.25 }); break;
      case 'fanfare': [523, 659, 784, 1047].forEach((f, i) => this._tone({ freq: f, dur: 0.28, type: 'triangle', vol: 0.4, delay: i * 0.16 }));
                      this._tone({ freq: 1319, dur: 0.6, type: 'triangle', vol: 0.4, delay: 0.7 }); break;
      case 'fail':    this._tone({ freq: 300, endFreq: 140, dur: 0.6, type: 'sawtooth', vol: 0.25 }); break;
      default: break;
    }
  }

  /** Looping rain ambience for storm levels. */
  startRain() {
    this.stopRain();
    const ctx = this.ctx;
    if (!ctx) return;
    const start = () => {
      const len = ctx.sampleRate * 2;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf; src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass'; filter.frequency.value = 2600; filter.Q.value = 0.4;
      const gain = ctx.createGain();
      gain.gain.value = 0.05 * this.sfxVol;
      src.connect(filter).connect(gain).connect(ctx.destination);
      src.start();
      this._rainNodes = { src, gain };
    };
    if (ctx.state === 'running') start();
    else ctx.resume().then(start).catch(() => {});
  }

  stopRain() {
    if (this._rainNodes) {
      try { this._rainNodes.src.stop(); } catch (e) { /* already stopped */ }
      this._rainNodes = null;
    }
  }
}
