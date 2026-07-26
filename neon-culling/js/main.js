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
  mobile: false,
  playerDiedLastRound: false,
  pendingEnd: 0, pendingWin: false, pendingReason: '',
  started: false,
  testMode: false
};

/* mobile: tapping the screen = one trigger pull */
function queueMobileShot() {
  if (!game.started || !player.alive || buyMenuOpen) return;
  if (game.state !== 'buy' && game.state !== 'playing') return;
  firing = true;
  triggerReady = true;
  clearTimeout(queueMobileShot._t);
  queueMobileShot._t = setTimeout(() => {
    firing = false;
    triggerReady = true;
    if (weaponState) weaponState.patternShots = 0;
  }, 130);
}

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
    else if (kind === 'twang') { this._tone(180, 0.09, 0.4 * vol, 'triangle'); this._noise(0.05, 2500, 0.2 * vol); }
    else if (kind === 'splat') { this._noise(0.09, 1100, 0.45 * vol); }
    else if (kind === 'whoosh') { this._noise(0.28, 750, 0.5 * vol, 'bandpass'); }
    else                     { this._noise(0.1, 2600, 0.5 * vol); }
  },
  explosion(vol) {
    if (!this.ctx) return;
    this._noise(0.55, 320, 1.0 * (vol || 1));
    this._tone(52, 0.45, 0.7, 'sine');
    this._noise(0.12, 2500, 0.3);
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

/* water balloon splash: burst of blue droplets + flash */
function spawnSplash(p) {
  spawnParticles(p, 0x3aa0ff, 12, 4.5);
  spawnParticles(p, 0x9fd4ff, 6, 3);
  flashSphere(p, 1.6, 0x5db8ff, 0.18);
  SFX.gunshot('splat', 0.9);
}

/* bazooka / orb explosion: fireball, debris, boom, camera shake */
function spawnExplosion(p, radius) {
  spawnParticles(p, 0xff7b24, 14, 7);
  spawnParticles(p, 0xffd23e, 10, 5);
  spawnParticles(p, 0x555555, 8, 3);
  flashSphere(p, radius * 0.9, 0xffa030, 0.28);
  SFX.explosion(1);
  _pv.copy(player.pos);
  const d = p.distanceTo(_pv);
  addShake(Math.max(0, 0.5 - d * 0.02));
}

/* expanding additive flash sphere */
const fxFlashes = [];
function flashSphere(p, size, color, dur) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false }));
  m.position.copy(p);
  scene.add(m);
  fxFlashes.push({ m, life: dur, max: dur, size });
}

/* camera shake */
const shake = { amt: 0, lastP: 0, lastY: 0 };
function addShake(a) { shake.amt = Math.min(0.6, shake.amt + a); }
function updateShake(dt) {
  applyRecoilDelta(-shake.lastP, -shake.lastY);       // undo last frame
  shake.amt *= Math.exp(-5 * dt);
  if (shake.amt < 0.002) shake.amt = 0;
  shake.lastP = (Math.random() - 0.5) * 2 * shake.amt * 0.06;
  shake.lastY = (Math.random() - 0.5) * 2 * shake.amt * 0.06;
  applyRecoilDelta(shake.lastP, shake.lastY);
}

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
  for (let i = fxFlashes.length - 1; i >= 0; i--) {
    const f = fxFlashes[i];
    f.life -= dt;
    if (f.life <= 0) {
      scene.remove(f.m);
      f.m.geometry.dispose(); f.m.material.dispose();
      fxFlashes.splice(i, 1);
    } else {
      const t = 1 - f.life / f.max;
      f.m.scale.setScalar(0.3 + t * f.size / 0.3);
      f.m.material.opacity = 0.85 * (1 - t);
    }
  }
}

/* ==================== per-round themes ==================== */
/* every round gets a unique look: rainbow, sunny grass, underwater, moon */
let hemiLight = null, sunLight = null;
const themeExtras = [];        // stars / clouds / bubbles, rebuilt per theme
let currentTheme = -1;

const THEMES = [
  {
    name: 'Rainbow Arena',
    sky: 0x2a0a4a, fog: [0x2a0a4a, 40, 120], hemi: [0xff9ff3, 0x581845, 1.0],
    sun: [0xfff0f5, 0.8], floor: null /* animated */, wall: 'rainbow', crate: 'rainbow',
    gravity: 24
  },
  {
    name: 'Sunny Meadow',
    sky: 0x87ceeb, fog: [0x9fd7f0, 55, 150], hemi: [0xbfe3ff, 0x3f7a3a, 1.05],
    sun: [0xfff5cc, 1.0], floor: 0x4a9e3f, wall: 0xf2e9d8, crate: 0xc98f3d,
    gravity: 24, clouds: true
  },
  {
    name: 'Underwater Reef',
    sky: 0x06304f, fog: [0x0a4066, 14, 70], hemi: [0x3a7ca8, 0x0a2a3a, 0.85],
    sun: [0x7fb8d8, 0.5], floor: 0x2e6f6a, wall: 0x2f7f8f, crate: 0x7a5a3a,
    gravity: 14, bubbles: true
  },
  {
    name: 'Moon Base',
    sky: 0x050510, fog: [0x050510, 60, 160], hemi: [0x8a9ac8, 0x1a1a22, 0.55],
    sun: [0xc8d4ff, 0.45], floor: 0x9a9a92, wall: 0x6e6e68, crate: 0x555550,
    gravity: 8, stars: true
  }
];

function clearThemeExtras() {
  for (const e of themeExtras) {
    scene.remove(e.obj);
    if (e.geo) e.geo.dispose();
    if (e.mat) e.mat.dispose();
  }
  themeExtras.length = 0;
}

function applyTheme(idx) {
  const th = THEMES[idx % THEMES.length];
  currentTheme = idx % THEMES.length;
  clearThemeExtras();

  scene.background = new THREE.Color(th.sky);
  scene.fog.color.setHex(th.fog[0]);
  scene.fog.near = th.fog[1];
  scene.fog.far = th.fog[2];
  hemiLight.color.setHex(th.hemi[0]);
  hemiLight.groundColor.setHex(th.hemi[1]);
  hemiLight.intensity = th.hemi[2];
  sunLight.color.setHex(th.sun[0]);
  sunLight.intensity = th.sun[1];

  // floor & walls & crates
  if (th.floor !== null) mapMeshes.floor.material.color.setHex(th.floor);
  mapMeshes.walls.forEach((w, i) => {
    if (th.wall === 'rainbow') w.material.color.setHSL((i / mapMeshes.walls.length + 0.0) % 1, 0.85, 0.55);
    else w.material.color.setHex(th.wall);
  });
  mapMeshes.crates.forEach((c, i) => {
    if (th.crate === 'rainbow') c.material.color.setHSL((i * 0.13 + 0.5) % 1, 0.9, 0.6);
    else c.material.color.setHex(th.crate);
  });

  // moon gravity / underwater buoyancy
  player.gravity = th.gravity;

  // ambient extras
  if (th.stars) {
    const n = 350, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, e = Math.random() * Math.PI * 0.45 + 0.05;
      const r = 150;
      pos[i * 3] = Math.cos(a) * Math.cos(e) * r;
      pos[i * 3 + 1] = Math.sin(e) * r;
      pos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false });
    const stars = new THREE.Points(geo, mat);
    scene.add(stars);
    themeExtras.push({ obj: stars, geo, mat });
  }
  if (th.clouds) {
    for (let i = 0; i < 6; i++) {
      const geo = new THREE.BoxGeometry(8 + Math.random() * 8, 1.6, 4 + Math.random() * 3);
      const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
      const c = new THREE.Mesh(geo, mat);
      c.position.set((Math.random() - 0.5) * 90, 20 + Math.random() * 10, (Math.random() - 0.5) * 90);
      scene.add(c);
      themeExtras.push({ obj: c, geo, mat, cloud: true, speed: 0.4 + Math.random() * 0.5 });
    }
  }
  if (th.bubbles) {
    const n = 60, pos = new Float32Array(n * 3), speeds = [];
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 76;
      pos[i * 3 + 1] = Math.random() * 14;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 76;
      speeds.push(0.6 + Math.random() * 1.2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: 0x9fd4ff, size: 0.18, transparent: true, opacity: 0.7 });
    const b = new THREE.Points(geo, mat);
    scene.add(b);
    themeExtras.push({ obj: b, geo, mat, bubbles: true, speeds });
  }
  return th;
}

/* per-frame ambient theme animation */
function updateTheme(dt) {
  if (currentTheme === 0) {   // rainbow: animated floor hue
    mapMeshes.floor.material.color.setHSL((gameTime * 0.04) % 1, 0.7, 0.5);
  }
  for (const e of themeExtras) {
    if (e.cloud) {
      e.obj.position.x += e.speed * dt;
      if (e.obj.position.x > 70) e.obj.position.x = -70;
    } else if (e.bubbles) {
      const arr = e.geo.attributes.position.array;
      for (let i = 0; i < e.speeds.length; i++) {
        arr[i * 3 + 1] += e.speeds[i] * dt;
        if (arr[i * 3 + 1] > 15) arr[i * 3 + 1] = 0;
      }
      e.geo.attributes.position.needsUpdate = true;
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
  clearProjectiles();
  ui.hideBossBar();

  // lost your weapon when you died — back to pistol
  if (game.playerDiedLastRound) switchWeapon('pistol');
  game.playerDiedLastRound = false;
  // free ammo refill every round
  weaponState.mag = weaponState.def.magSize;
  weaponState.reserve = weaponState.def.reserve;
  weaponState.reloading = false;

  player.reset(playerSpawn);

  // unique level theme every round
  const th = applyTheme(game.round - 1);

  // boss every 4th round (3 bosses cycle, stronger each cycle)
  const isBossRound = game.round % 4 === 0;
  const buyHint = game.mobile ? 'Tap <b>$</b> to buy weapons' : 'Buy time — press <b>B</b> to buy weapons';
  if (isBossRound) {
    const cycle = Math.floor((game.round / 4 - 1) / BOSS_DEFS.length);
    const tier = (game.round / 4 - 1) % BOSS_DEFS.length;
    const statScale = 1 + 0.35 * cycle;
    const boss = spawnBossRound(scene, game.difficulty, tier, statScale);
    ui.showBossBar(boss.name + (cycle > 0 ? ' ' + (cycle + 1) : ''));
    ui.announce('BOSS ROUND', boss.name + ' approaches in ' + th.name + '…<br>' + buyHint, 'red');
  } else {
    spawnBots(scene, 5, game.difficulty);
    ui.announce('ROUND ' + game.round + ' · ' + th.name, buyHint, 'white');
  }
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
  const reward = bot.isBoss ? 1000 : 300;
  game.money = Math.min(16000, game.money + reward);
  if (bot.isBoss) {
    ui.killfeed('<span class="you">You</span> eliminated <span class="hs">☠ ' + bot.name +
      '</span> <span style="color:#7ee787">+$1000</span>');
  } else {
    ui.killfeed('<span class="you">You</span> killed <span class="bot">' + bot.name + '</span>' +
      (headshot ? ' <span class="hs">(Headshot)</span>' : '') +
      ' <span style="color:#7ee787">+$300</span>');
  }
  if (bots.every(b => !b.alive)) {
    endRound(true, bot.isBoss ? 'Boss ' + bot.name + ' defeated!' : 'Enemy team eliminated');
  }
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
  } else if (code.startsWith('Digit')) {
    const n = +code.slice(-1);
    if (buyMenuOpen && n >= 1 && n <= BUY_ORDER.length) buyWeapon(BUY_ORDER[n - 1]);
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

  // lights (stored so themes can recolor them)
  hemiLight = new THREE.HemisphereLight(0xbfd4ff, 0x3a3228, 0.9);
  scene.add(hemiLight);
  sunLight = new THREE.DirectionalLight(0xfff2dd, 0.65);
  sunLight.position.set(30, 60, 25);
  scene.add(sunLight);

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

  // platform selector (desktop / mobile)
  const platLabels = { desktop: document.getElementById('plat-desktop'),
                       mobile: document.getElementById('plat-mobile') };
  for (const key in platLabels) {
    platLabels[key].addEventListener('click', () => {
      platLabels[key].querySelector('input').checked = true;
      platLabels.desktop.classList.toggle('sel', key === 'desktop');
      platLabels.mobile.classList.toggle('sel', key === 'mobile');
    });
  }
  // preselect mobile on touch devices
  if (navigator.maxTouchPoints > 0 && !matchMedia('(pointer:fine)').matches) {
    platLabels.mobile.click();
  }

  // menu wiring
  document.getElementById('playbtn').addEventListener('click', () => {
    SFX.init();
    const sel = document.querySelector('input[name="diff"]:checked');
    game.difficulty = sel ? sel.value : 'medium';
    game.mobile = !!document.querySelector('input[name="plat"]:checked') &&
      document.querySelector('input[name="plat"]:checked').value === 'mobile';
    ui.showMainMenu(false);
    ui.showHUD(true);
    if (game.mobile) ui.showTouchControls(true);
    game.started = true;
    startMatch();
    if (!game.testMode && !game.mobile) controls.lock();
  });

  window.addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  // headless / debugging hook: #autostart skips the menu,
  // optional #autostart,round4 / #autostart,mobile variants
  if (location.hash.startsWith('#autostart')) {
    game.testMode = true;
    game.difficulty = 'medium';
    ui.showMainMenu(false);
    ui.showHUD(true);
    if (location.hash.includes('mobile')) {
      game.mobile = true;
      ui.showTouchControls(true);
    }
    game.started = true;
    startMatch();
    const m = location.hash.match(/round(\d+)/);
    if (m) { game.round = parseInt(m[1], 10) - 1; startRound(); }
    if (location.hash.includes('round') || location.hash.includes('mobile')) {
      goLive();   // jump straight into action for screenshots
    }
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
      updateProjectiles(dt);

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
    updateShake(dt);
    updateTheme(dt);
    ui.update(dt);
  }

  renderer.render(scene, camera);
}

init();
