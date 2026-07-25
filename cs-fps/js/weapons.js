/* ============================================================
   weapons.js — weapon defs, hitscan shooting, recoil, viewmodels
   Exposes globals: WEAPONS, weaponState, switchWeapon(),
   updateWeapons(), currentSpreadRad, startReload()
   ============================================================ */

const WEAPONS = {
  pistol: {
    name: 'Pistol', price: 0, damage: 34, magSize: 12, reserve: 48,
    fireRate: 0.22, auto: false, reloadTime: 1.6,
    spread: 0.007, moveSpread: 0.022, airSpread: 0.06,
    recoilPitch: 0.014, recoilYaw: 0.004, bloom: 0.006,
    tracer: 0xffe08a, sound: 'pistol',
    desc: 'Free · 12 rounds · reliable sidearm'
  },
  ak: {
    name: 'AK-47', price: 2700, damage: 36, magSize: 30, reserve: 90,
    fireRate: 0.1, auto: true, reloadTime: 2.5,
    spread: 0.009, moveSpread: 0.034, airSpread: 0.07,
    recoilPitch: 0.0085, recoilYaw: 0.0035, bloom: 0.007,
    tracer: 0xffb050, sound: 'ak',
    desc: '$2700 · 30 rounds · 1-shot headshot, wild spray'
  },
  awp: {
    name: 'AWP', price: 4750, damage: 115, magSize: 10, reserve: 30,
    fireRate: 1.5, auto: false, reloadTime: 3.2,
    spread: 0.0012, moveSpread: 0.055, airSpread: 0.09,
    recoilPitch: 0.05, recoilYaw: 0.006, bloom: 0.02,
    tracer: 0xa0e0ff, sound: 'awp',
    desc: '$4750 · 10 rounds · one-shot kill (except legs)'
  }
};
const HIT_ZONE_MULT = { head: 4, body: 1, limbs: 0.75 };

let weaponState = null;          // { key, def, mag, reserve, reloading, reloadLeft, lastShot, patternShots }
let firing = false;              // left mouse held
let triggerReady = true;         // semi-auto gate
let bloom = 0;                   // extra spread from sustained fire
let currentSpreadRad = 0.01;     // read by ui.js for crosshair gap
const recoilOffset = { pitch: 0, yaw: 0 };
const viewmodels = {};           // key -> group
let muzzleFlash, muzzleLight, muzzleTip;
let flashLeft = 0, bobT = 0;
const _raycaster = new THREE.Raycaster();
const _origin = new THREE.Vector3(), _dir = new THREE.Vector3();

/* ---------------- viewmodels (simple box shapes) ---------------- */
function vmBox(group, x, y, z, w, h, d, color) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color }));
  m.position.set(x, y, z);
  group.add(m);
  return m;
}

function buildViewmodels(camera) {
  // Pistol: compact dark
  let g = new THREE.Group();
  vmBox(g, 0, 0, -0.1, 0.055, 0.09, 0.22, 0x2b2b30);       // slide/body
  vmBox(g, 0, -0.07, 0.02, 0.05, 0.08, 0.07, 0x3a3a41);    // grip
  g.userData.muzzle = new THREE.Vector3(0, 0.01, -0.24);
  viewmodels.pistol = g;

  // AK-47: wood + metal, long
  g = new THREE.Group();
  vmBox(g, 0, 0, -0.22, 0.06, 0.08, 0.5, 0x333338);        // receiver+barrel
  vmBox(g, 0, -0.015, -0.38, 0.05, 0.055, 0.22, 0x6b4423); // wood foregrip
  vmBox(g, 0, -0.02, 0.08, 0.055, 0.07, 0.2, 0x6b4423);    // wood stock
  vmBox(g, 0, -0.1, -0.08, 0.045, 0.13, 0.07, 0x3d3d44);   // magazine
  vmBox(g, 0, 0.06, -0.16, 0.02, 0.03, 0.04, 0x222226);    // sight
  g.userData.muzzle = new THREE.Vector3(0, 0, -0.5);
  viewmodels.ak = g;

  // AWP: long green + scope
  g = new THREE.Group();
  vmBox(g, 0, 0, -0.3, 0.055, 0.07, 0.7, 0x3f5d3a);        // body+barrel
  vmBox(g, 0, -0.03, 0.1, 0.05, 0.09, 0.22, 0x33502f);     // stock
  vmBox(g, 0, 0.075, -0.14, 0.035, 0.05, 0.18, 0x1d1d22);  // scope
  vmBox(g, 0, -0.09, -0.02, 0.04, 0.1, 0.06, 0x2c2c33);    // mag
  g.userData.muzzle = new THREE.Vector3(0, 0, -0.68);
  viewmodels.awp = g;

  for (const k in viewmodels) {
    viewmodels[k].position.set(0.26, -0.25, -0.45);
    viewmodels[k].visible = false;
    camera.add(viewmodels[k]);
  }

  // shared muzzle flash (plane + light), attached to camera
  muzzleFlash = new THREE.Mesh(
    new THREE.PlaneGeometry(0.16, 0.16),
    new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.95,
      blending: THREE.AdditiveBlending, depthWrite: false }));
  muzzleFlash.visible = false;
  camera.add(muzzleFlash);
  muzzleLight = new THREE.PointLight(0xffc86e, 0, 9, 2);
  camera.add(muzzleLight);
}

/* ---------------- weapon state ---------------- */
function switchWeapon(key) {
  const def = WEAPONS[key];
  weaponState = {
    key, def,
    mag: def.magSize, reserve: def.reserve,
    reloading: false, reloadLeft: 0, lastShot: -9, patternShots: 0
  };
  for (const k in viewmodels) viewmodels[k].visible = (k === key);
  if (muzzleFlash) muzzleFlash.visible = false;
}

function startReload() {
  if (!weaponState || weaponState.reloading) return;
  if (weaponState.mag >= weaponState.def.magSize || weaponState.reserve <= 0) return;
  weaponState.reloading = true;
  weaponState.reloadLeft = weaponState.def.reloadTime;
  SFX.reload();
}

/* ---------------- shooting ---------------- */
function fireWeapon(now) {
  const w = weaponState, def = w.def;
  w.lastShot = now;
  w.mag--;

  // direction with spread
  camera.getWorldDirection(_dir);
  const s = currentSpreadRad;
  _dir.x += (Math.random() - 0.5) * 2 * s;
  _dir.y += (Math.random() - 0.5) * 2 * s;
  _dir.z += (Math.random() - 0.5) * 2 * s;
  _dir.normalize();
  _origin.setFromMatrixPosition(camera.matrixWorld);

  _raycaster.set(_origin, _dir);
  _raycaster.far = 200;
  const targets = getShootTargets();
  const hits = _raycaster.intersectObjects(targets, false);

  let endPoint = null;
  if (hits.length) {
    const hit = hits[0];
    endPoint = hit.point;
    const ud = hit.object.userData;
    if (ud.bot && ud.bot.alive) {
      const mult = HIT_ZONE_MULT[ud.zone] || 1;
      const dmg = def.damage * mult;
      const head = ud.zone === 'head';
      spawnBlood(hit.point);
      ui.hitmarker(head);
      if (head) SFX.headshot(); else SFX.hit();
      ud.bot.takeDamage(dmg, head);
    } else {
      spawnImpact(hit.point);
    }
  } else {
    endPoint = _origin.clone().addScaledVector(_dir, 120);
  }

  // tracer from muzzle tip
  const vm = viewmodels[w.key];
  muzzleTip = vm.userData.muzzle.clone().applyMatrix4(vm.matrixWorld);
  spawnTracer(muzzleTip, endPoint, def.tracer);

  // recoil: pattern climbs, yaw wobbles on later shots
  const i = w.patternShots;
  const pitch = def.recoilPitch * (1 + Math.min(i, 10) * 0.04);
  const yaw = def.recoilYaw * Math.sin(i * 1.7) * (i > 5 ? 1 : 0.2);
  camera.rotateX(pitch);   // rotateX/rotateY: safe with any euler order
  camera.rotateY(yaw);
  recoilOffset.pitch += pitch;
  recoilOffset.yaw += yaw;
  w.patternShots++;
  bloom += def.bloom;

  // viewmodel kick + muzzle flash
  vm.position.z = -0.45 + 0.09;
  muzzleFlash.position.copy(vm.userData.muzzle).add(vm.position);
  muzzleFlash.material.rotation = Math.random() * Math.PI;
  muzzleFlash.visible = true;
  muzzleLight.position.copy(muzzleFlash.position);
  muzzleLight.intensity = 2.2;
  flashLeft = 0.045;

  SFX.gunshot(def.sound, 1);

  if (w.mag <= 0) startReload();
}

function getShootTargets() {
  const t = [];
  for (const m of obstacleMeshes) t.push(m);
  t.push(floorMesh);
  for (const b of bots) if (b.alive) for (const p of b.hitMeshes) t.push(p);
  return t;
}

/* ---------------- per-frame update ---------------- */
function updateWeapons(dt, now, speedRatio, onGround, crouching, walking) {
  const w = weaponState;
  if (!w) return;
  const def = w.def;

  // reload timer
  if (w.reloading) {
    w.reloadLeft -= dt;
    if (w.reloadLeft <= 0) {
      const need = def.magSize - w.mag;
      const take = Math.min(need, w.reserve);
      w.mag += take; w.reserve -= take;
      w.reloading = false;
    }
  }

  // spread model
  let sp = def.spread + speedRatio * def.moveSpread;
  if (!onGround) sp += def.airSpread;
  if (crouching) sp *= 0.6;
  else if (walking) sp *= 0.75;
  bloom *= Math.exp(-4 * dt);
  currentSpreadRad = sp + bloom;

  // firing
  const canAct = player.alive && !buyMenuOpen &&
    (game.state === 'buy' || game.state === 'playing') &&
    (controls.isLocked || game.testMode);
  if (firing && canAct && !w.reloading) {
    if (now - w.lastShot >= def.fireRate && (def.auto || triggerReady)) {
      if (w.mag > 0) {
        fireWeapon(now);
        if (!def.auto) triggerReady = false;
      } else {
        SFX.dry();
        w.lastShot = now;
        triggerReady = false;
      }
    }
  }

  // recoil recovery (pull tracked offset back out of the camera)
  const f = Math.exp(-6 * dt);
  camera.rotateX(recoilOffset.pitch * (f - 1));
  camera.rotateY(recoilOffset.yaw * (f - 1));
  recoilOffset.pitch *= f;
  recoilOffset.yaw *= f;

  // viewmodel bob + kick recovery
  const vm = viewmodels[w.key];
  if (vm) {
    bobT += dt * (2 + speedRatio * 9);
    const bobA = onGround ? 0.011 * speedRatio : 0;
    vm.position.x = 0.26 + Math.sin(bobT) * bobA;
    vm.position.y = -0.25 + Math.abs(Math.cos(bobT)) * bobA * 0.9;
    vm.position.z += (-0.45 - vm.position.z) * Math.min(1, 14 * dt);
  }

  // muzzle flash decay
  if (flashLeft > 0) {
    flashLeft -= dt;
    muzzleLight.intensity = Math.max(0, flashLeft / 0.045) * 2.2;
    if (flashLeft <= 0) { muzzleFlash.visible = false; muzzleLight.intensity = 0; }
  }
}
