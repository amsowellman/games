const GAME_WIDTH = 960;
const GAME_HEIGHT = 600;
const TILE_SIZE = 32;

const CHARACTERS = [
    { key: 'max',   name: 'Max',   species: 'Dragon'  },
    { key: 'riley', name: 'Riley', species: 'Axolotl' },
    { key: 'mommy', name: 'Mommy', species: 'Bear'    },
    { key: 'daddy', name: 'Daddy', species: 'Turtle'  }
];

// 'desktop' (keyboard) or 'mobile' (auto-run + tap to jump). Auto-detected if null.
const GAME_SETTINGS = {
    controls: null
};

const GAME_CONFIG = {
    type: Phaser.AUTO,
    parent: 'phaser-game',
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: '#0a0a1a',
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 600 },
            debug: false
        }
    },
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    }
};
