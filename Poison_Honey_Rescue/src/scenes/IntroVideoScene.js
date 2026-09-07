// IntroVideoScene - plays the intro cinematic fullscreen from its original
// location in Reference_Material (preloaded in Boot for instant start).
// A Skip button appears after 3 seconds.

import { makeButton } from '../systems/UI.js';

export default class IntroVideoScene extends Phaser.Scene {
  constructor() { super('IntroVideo'); }

  create(data) {
    this.next = (data && data.next) || 'LevelSelect';
    this.cameras.main.setBackgroundColor('#000000');

    if (!this.cache.video.exists('introVideo')) { // skipped via ?novideo=1
      this.scene.start(this.next);
      return;
    }

    const video = this.add.video(640, 360, 'introVideo').setDepth(0);
    this._finish = this._finish.bind(this);

    video.on('play', () => {
      // cover-fit once dimensions are known
      const vw = video.video.videoWidth || 1280;
      const vh = video.video.videoHeight || 720;
      const s = Math.max(1280 / vw, 720 / vh);
      video.setDisplaySize(vw * s, vh * s);
    });
    video.on('complete', this._finish);
    video.on('error', this._finish);
    video.on('unsupported', this._finish);
    this._video = video;

    // safety net: never trap the player here
    this.time.delayedCall(22000, this._finish);

    // We arrive here from a Play-button gesture, so unmuted playback is allowed.
    const played = video.play(false);
    if (played === false) this._finish();

    // Skip button after 3 seconds of playback
    this.time.delayedCall(3000, () => {
      if (this._done) return;
      makeButton(this, 1140, 660, 160, 52, 'SKIP >>', this._finish, { fontSize: 18, depth: 60 });
    });
  }

  _finish() {
    if (this._done) return;
    this._done = true;
    if (this._video) { this._video.stop(); }
    this.registry.set('introSeen', true);
    this.scene.start(this.next);
  }
}
