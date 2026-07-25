/* ============================================================
   main.js — scene setup, game loop, round system, sound, economy
   ============================================================ */

let scene, camera, renderer, controls;
let paused = false;
let buyMenuOpen = false;
let gameTime = 0;

const game = {
  state: 'menu',          // menu | buy | playing | roundend | matchend
  round: 0,
  wins: 0, losses: 0,
  money: 800,
  buyTimeLeft: 0, roundTimeLeft: 0,
  difficulty: 'medium',
  playerDiedLastRound: false,
  pendingEnd: 0, pendingWin: false, pendingReason: '',
  started: false,
  testMode: false
};

/* ==================== SFX (Web Audio API) ==================== */
const SFX = {
  ctx: null, master: null, noiseBuf: null,
  init() {
    if (this.ctx) { this.ctx.resume && this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.45;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  },
  _noise(dur, freq, vol, type) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = type || 'lowpass';
    f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + dur);
  },
  _tone(freq, dur, vol, type, when) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + (when || 0);
    const o = this.ctx.createOscillator();
    o.type = type || 'sine';
    o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur);
  },
  gunshot(kind, vol) {
    if (!this.ctx) return;
    vol = vol === undefined ? 1 : vol;
    if (kind === 'awp')      { this._noise(0.32, 700, 0.9 * vol); this._noise(0.1, 3500, 0.35 * vol); }
    else if (kind === 'ak')  { this._noise(0.14, 1800, 0.6 * vol); this._tone(140, 0.08, 0.25 * vol, 'triangle'); }
    else                     { this._noise(0.1, 2600, 0.5 * vol); }
  },
  hit()      { this._tone(950, 0.05, 0.3, 'square'); },
  headshot() { this._tone(1500, 0.08, 0.35, 'square'); },
  dry()      { this._noise(0.04, 5000, 0.2, 'highpass'); },
  reload()   { this._noise(0.05, 3000, 0.25, 'bandpass'); this._tone(420, 0.04, 0.2, 'square', 0.16); },
  buy()      { this._tone(880, 0.06, 0.25, 'square'); this._tone(1174, 0.08, 0.25, 'square', 0.07); },
  win()      { this._tone(523, 0.18, 0.3); this._tone(784, 0.3, 0.3, 'sine', 0.16); },
  lose()     { this._tone(330, 0.2, 0.3); this._tone(220, 0.35, 0.3, 'sine', 0.18); },
  roundStart(){ this._tone(660, 0.12, 0.25, 'triangle'); }
};

/* ==================== tracers / particles ==================== */
const fxTracers = [];
const fxParts = [];
const _partGeo = new THREE.BoxGeometry(0.07, 0.07, 0.07);

function spawnTracer(a, b, color) {
  const g = new THREE.BufferGeometry().setFromPoints([a, b]);
  const m = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85 });
  const line = new THREE.Line(g, m);
  scene.add(line);
  fxTracers.push({ line, life: 0.07 });
}

function spawnParticles(p, color, n, speed) {
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(_partGeo,
      new THREE.MeshBasicMaterial({ color, transparent: true }));
    m.position.copy(p);
    const v = new THREE.Vector3(
      (Math.random() - 0.5) * speed,
      Math.random() * speed * 0.8 + 0.5,
      (Math.random() - 0.5) * speed);
    const life = 0.25 + Math.random() * 0.25;
    scene.add(m);
    fxParts.push({ m, v, life, max: life });
  }
}
function spawnImpact(p) { spawnParticles(p, 0xffd27a, 4, 2.4); }
function spawnBlood(p)  { spawnParticles(p, 0xc02020, 7, 3.2); }

function updateFX(dt) {
  for (let i = fxTracers.length - 1; i >= 0; i--) {
    const t = fxTracers[i];
    t.life -= dt;
    if (t.life <= 0) {
      scene.remove(t.line);
      t.line.geometry.dispose(); t.line.material.dispose();
      fxTracers.splice(i, 1);
    } else {
      t.line.material.opacity = (t.life / 0.07) * 0.85;
    }
  }
  for (let i = fxParts.length - 1; i >= 0; i--) {
    const p = fxParts[i];
    p.life -= dt;
    if (p.life <= 0) {
      scene.remove(p.m);
      p.m.material.dispose();
      fxParts.splice(i, 1);
    } else {
      p.m.position.addScaledVector(p.v, dt);
      p.v.y -= 9 * dt;
      p.m.material.opacity = p.life / p.max;
    }
  }
}

/* ==================== round system ==================== */
function startMatch() {
  game.wins = 0; game.losses = 0; game.round = 0;
  game.money = 800;
  game.playerDiedLastRound = false;
  switchWeapon('pistol');
  startRound();
}

function startRound() {
  game.round++;
  game.state = 'buy';
  game.buyTimeLeft = 20;
  game.roundTimeLeft = 115;
  game.pendingEnd = 0;
  firing = false;
  if (buyMenuOpen) ui.closeBuyMenu(false);

  // lost your weapon when you died — back to pistol
  if (game.playerDiedLastRound) switchWeapon('pistol');
  game.playerDiedLastRound = false;
  // free ammo refill every round
  weaponState.mag = weaponState.def.magSize;
  weaponState.reserve = weaponState.def.reserve;
  weaponState.reloading = false;

  player.reset(playerSpawn);
  spawnBots(scene, 5, game.difficulty);
  ui.clearAnnounce();
  ui.announce('ROUND ' + game.round, 'Buy time — press <b>B</b> to buy weapons', 'white');
  SFX.roundStart();
}

function goLive() {
  game.state = 'playing';
  if (buyMenuOpen) ui.closeBuyMenu();
  ui.announce('Round Live', 'Eliminate all 5 bots', 'white');
}

function endRound(win, reason) {
  if (game.state === 'roundend' || game.state === 'matchend' || game.state === 'menu') return;
  firing = false;
  if (buyMenuOpen) ui.closeBuyMenu(false);

  if (win) { game.wins++; game.money = Math.min(16000, game.money + 3250); }
  else     { game.losses++; game.money = Math.min(16000, game.money + 1400); }

  const matchOver = game.wins >= 16 || game.losses >= 16;
  if (matchOver) {
    game.state = 'matchend';
    const youWon = game.wins >= 16;
    ui.announce('MATCH OVER',
      (youWon ? 'You win ' : 'Bots win ') + game.wins + ' — ' + game.losses +
      '<br>Press <b>R</b> to restart', youWon ? 'green' : 'red', true);
    if (youWon) SFX.win(); else SFX.lose();
  } else {
    game.state = 'roundend';
    ui.announce(win ? 'ROUND WON' : 'ROUND LOST',
      reason + ' · ' + (win ? '+$3250' : '+$1400') + '<br>Press <b>R</b> for next round',
      win ? 'green' : 'red', true);
    if (win) SFX.win(); else SFX.lose();
  }
}

function onBotKilled(bot, headshot) {
  game.money = Math.min(16000, game.money + 300);
  ui.killfeed('<span class="you">You</span> killed <span class="bot">' + bot.name + '</span>' +
    (headshot ? ' <span class="hs">(Headshot)</span>' : '') +
    ' <span style="color:#7ee787">+$300</span>');
  if (bots.every(b => !b.alive)) endRound(true, 'Enemy team eliminated');
}

function onPlayerDeath(bot) {
  ui.killfeed('<span class="bot">' + (bot ? bot.name : 'Bots') +
    '</span> killed <span class="you">You</span>');
  game.playerDiedLastRound = true;
  game.pendingEnd = 1.5;          // let the death cam play before the overlay
  game.pendingWin = false;
  game.pendingReason = 'You were eliminated';
}

function buyWeapon(key) {
  if (game.state !== 'buy') return;
  const def = WEAPONS[key];
  if (weaponState.key === key) { ui.closeBuyMenu(); return; }
  if (game.money < def.price) { SFX.dry(); return; }
  game.money -= def.price;
  switchWeapon(key);
  SFX.buy();
  ui.renderBuyMenu();
}

function handleGameKey(code) {
  if (code === 'KeyR') {
    if (game.state === 'roundend') startRound();
    else if (game.state === 'matchend') startMatch();
    else if (game.state === 'buy' || game.state === 'playing') startReload();
  } else if (code === 'KeyB') {
    if (game.state !== 'buy') return;
    if (buyMenuOpen) ui.closeBuyMenu(); else ui.openBuyMenu();
  } else if (code === 'Digit1' || code === 'Digit2' || code === 'Digit3') {
    if (buyMenuOpen) buyWeapon(['pistol', 'ak', 'awp'][+code.slice(-1) - 1]);
  }
}
/* ==================== init ==================== */
function init() {
  if (typeof THREE === 'undefined') {
    document.querySelector('#mainmenu .card').innerHTML =
      '<h1>ERROR</h1><h2>Could not load Three.js from the CDN.<br>Check your internet connection and reload.</h2>';
    return;
  }

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0e0f13);
  scene.fog = new THREE.Fog(0x0e0f13, 45, 130);

  camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.05, 300);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(innerWidth, innerHeight);
  renderer.domElement.classList.add('game');
  document.body.appendChild(renderer.domElement);

  // lights
  scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x3a3228, 0.9));
  const sun = new THREE.DirectionalLight(0xfff2dd, 0.65);
  sun.position.set(30, 60, 25);
  scene.add(sun);

  // controls (mouse look)
  controls = new THREE.PointerLockControls(camera, renderer.domElement);
  if (controls.getObject() !== camera && !controls.getObject().parent) {
    scene.add(controls.getObject());
  } else {
    scene.add(camera);   // r128: getObject() returns the camera itself
  }

  createMap(scene);
  buildViewmodels(camera);
  initPlayer(controls);
  switchWeapon('pistol');
  ui.init();

  // pause when pointer lock is lost mid-round
  controls.addEventListener('unlock', () => {
    if (game.started && !buyMenuOpen && !game.testMode &&
        (game.state === 'buy' || game.state === 'playing')) {
      paused = true;
      ui.announce('PAUSED', 'Click anywhere to resume', 'white', true);
    }
  });
  controls.addEventListener('lock', () => {
    if (paused) { paused = false; ui.clearAnnounce(); }
  });

  // menu wiring
  document.getElementById('playbtn').addEventListener('click', () => {
    SFX.init();
    const sel = document.querySelector('input[name="diff"]:checked');
    game.difficulty = sel ? sel.value : 'medium';
    ui.showMainMenu(false);
    ui.showHUD(true);
    game.started = true;
    startMatch();
    if (!game.testMode) controls.lock();
  });

  window.addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  // headless / debugging hook: index.html#autostart skips the menu
  if (location.hash === '#autostart') {
    game.testMode = true;
    game.difficulty = 'medium';
    ui.showMainMenu(false);
    ui.showHUD(true);
    game.started = true;
    startMatch();
  }

  animate();
}

/* ==================== game loop ==================== */
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);

  if (!paused && game.started) {
    gameTime += dt;
    const active = game.state === 'buy' || game.state === 'playing';

    if (active || game.state === 'roundend') player.update(dt);
    if (active) {
      updateWeapons(dt, gameTime, player.speedRatio,
        player.onGround, player.crouching, player.walking);

      if (game.state === 'buy') {
        game.buyTimeLeft -= dt;
        if (game.buyTimeLeft <= 0) goLive();
      } else {
        game.roundTimeLeft -= dt;
        if (game.roundTimeLeft <= 0) endRound(false, 'Time expired');
      }
    }

    for (const b of bots) b.update(dt, gameTime);
    if (game.state === 'playing') separateBots();

    // delayed round end (death cam)
    if (game.pendingEnd > 0) {
      game.pendingEnd -= dt;
      if (game.pendingEnd <= 0) endRound(game.pendingWin, game.pendingReason);
    }

    updateFX(dt);
    ui.update(dt);
  }

  renderer.render(scene, camera);
}

init();
