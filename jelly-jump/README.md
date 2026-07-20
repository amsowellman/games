# Jelly Jump - A Phaser Platformer

A retro-style platformer game built with Phaser 3, playable on desktop and mobile, deployable on GitHub Pages.

## Features

- Desktop or Mobile mode selector at the start of the game (auto-detected by default)
  - **Desktop**: full keyboard controls
  - **Mobile**: the player runs forward automatically - tap the screen to jump (double-tap mid-air for double jump)
- Character selection: play as Max the Dragon, Riley the Axolotl, Mommy the Bear, or Daddy the Turtle
- **Bitcoin Powerup** in every level: a narrator announces "Bitcoin Powerup!" and you get a
  5-second rocket booster - hold jump (desktop) or hold the screen (mobile) to fly forward,
  smashing through enemies, before falling back to the ground
- Reach the **Finish flag** at the end of each of the 3 levels
- Collectible coins (10 pts), crystals (50 pts), and the Bitcoin (100 pts)
- Patrolling enemies you can stomp or avoid, spike hazards, and gaps to jump over
- Score tracking and 3-life system
- Pause functionality (P key, desktop)
- Background music with on/off toggle (M key or menu buttons)
- Procedural sound effects with on/off toggle, plus a victory jingle after beating the game
- Jellyfish background artwork
- All character and level graphics generated procedurally

## Controls (Desktop mode)

| Key | Action |
|-----|--------|
| A / Left Arrow | Move Left |
| D / Right Arrow | Move Right |
| W / Up Arrow / Space | Jump (press twice for double jump); hold for rocket thrust |
| P | Pause / Resume |
| M | Music On/Off |
| 1-4 | Select character (on character select screen) |

## Controls (Mobile mode)

| Input | Action |
|-------|--------|
| (none) | The player runs forward automatically |
| Tap screen | Jump (tap again mid-air for double jump) |
| Hold screen | Rocket thrust while the Bitcoin booster is active |

## Play Locally

You need a local web server because the game loads JavaScript modules.

### Option 1: Python (already installed on Raspberry Pi)

```bash
cd jelly-jump
python3 -m http.server 8080
```

Open your browser to `http://localhost:8080`

### Option 2: Node.js

```bash
cd jelly-jump
npx serve -p 8080
```

Open your browser to `http://localhost:8080`

### Option 3: VS Code

Install the "Live Server" extension, right-click `index.html`, and select "Open with Live Server".

## Deploy to GitHub Pages

1. Create a new repository on GitHub (e.g., `jelly-jump`)

2. Initialize git and push the code:

```bash
cd jelly-jump
git init
git add .
git commit -m "Initial commit - Jelly Jump platformer"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/jelly-jump.git
git push -u origin main
```

3. Enable GitHub Pages:
   - Go to your repository on GitHub
   - Click **Settings** > **Pages**
   - Under "Source", select **Deploy from a branch**
   - Select **main** branch and **/ (root)** folder
   - Click **Save**

4. Wait 1-2 minutes, then visit:
   ```
   https://YOUR_USERNAME.github.io/jelly-jump/
   ```

## Project Structure

```
jelly-jump/
├── index.html          # Main HTML file
├── style.css           # Page styling
├── README.md           # This file
├── assets/
│   ├── bg_jellies.jpeg     # Background artwork
│   └── music_jellyfish.mp3 # Background music
└── js/
    ├── config.js       # Phaser game configuration + character roster
    ├── sfx.js          # Sound effects (procedural) + music/toggle helpers
    ├── scene_boot.js   # Boot scene - loads assets, generates all textures
    ├── scene_menu.js   # Main menu scene
    ├── scene_charselect.js # Character selection scene
    ├── scene_play.js   # Main gameplay scene (levels, player, enemies)
    ├── scene_gameover.js  # Game over screen
    └── scene_victory.js   # Victory screen
```

## Customization

### Add a new level

Add a new level object to the `levels` array in `js/scene_play.js` inside `getLevelData()`:

```javascript
{
    width: 1920,
    platforms: [
        { x: 160, y: 440 },
        { x: 320, y: 360 },
    ],
    coins: [
        { x: 224, y: 400 },
    ],
    crystals: [
        { x: 784, y: 250 },
    ],
    enemies: [
        { x: 540, y: 370, minX: 500, maxX: 620, speed: 50 },
    ],
    spikes: [
        { x: 640, y: GAME_HEIGHT - TILE_SIZE - 20 },
    ],
    gaps: [
        { x: 640, width: TILE_SIZE * 2 },
    ],
    bitcoin: { x: 600, y: 525 },
    flag: { x: 1840, y: GAME_HEIGHT - TILE_SIZE - 56 }
}
```

Update `this.maxLevel` in the `init()` method of `ScenePlay`.

### Change player speed

In `js/scene_play.js`, look for `setVelocityX(-180)` (left) and `setVelocityX(180)` (right).

### Change jump height

In `js/scene_play.js`, look for `setVelocityY(-400)` (first jump) and `setVelocityY(-380)` (double jump).

### Change gravity

In `js/config.js`, modify `gravity: { y: 600 }`.

## Tech Stack

- [Phaser 3.80.1](https://phaser.io/) - HTML5 game framework
- Vanilla JavaScript (no build step required)
- All graphics generated with Phaser's Graphics API

## License

MIT - feel free to use, modify, and share!
