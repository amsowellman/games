// Poison Honey Rescue - entry point.
// Phaser 3 + Matter.js physics, responsive FIT scaling, multi-touch input.

import { GAME_W, GAME_H } from './systems/SaveSystem.js';
import BootScene from './scenes/BootScene.js';
import MenuScene from './scenes/MenuScene.js';
import LevelSelectScene from './scenes/LevelSelectScene.js';
import IntroVideoScene from './scenes/IntroVideoScene.js';
import GameScene from './scenes/GameScene.js';
import VictoryScene from './scenes/VictoryScene.js';

const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  backgroundColor: '#1a0f2e',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_W,
    height: GAME_H
  },
  input: {
    activePointers: 3 // multi-touch support
  },
  physics: {
    default: 'matter',
    matter: {
      gravity: { y: 1 },
      enableSleeping: true,
      debug: false,
      // fixed timestep: frame hitches (tab switch, slow devices, audio decode)
      // must not produce giant physics steps that explode resting structures
      runner: { isFixed: true, fps: 60, maxUpdates: 3 }
    }
  },
  fps: { target: 60, forceSetTimeOut: false },
  scene: [BootScene, MenuScene, LevelSelectScene, IntroVideoScene, GameScene, VictoryScene]
};

window.addEventListener('load', () => {
  window.PHR_GAME = new Phaser.Game(config);
});
