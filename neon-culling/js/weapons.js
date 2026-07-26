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
  slingshot: {
    name: 'Slingshot', price: 400, damage: 22, magSize: 8, reserve: 64,
    fireRate: 0.45, auto: false, reloadTime: 1.4,
    spread: 0.012, moveSpread: 0.02, airSpread: 0.05,
    recoilPitch: 0.006, recoilYaw: 0.002, bloom: 0.004,
    sound: 'twang', projectile: { speed: 38, gravity: 14, type: 'stone' },
    desc: '$400 · 8 stones · arcs through the air'
  },
  waterballoon: {
    name: 'Water Balloons', price: 650, damage: 14, magSize: 6, reserve: 30,
    fireRate: 0.55, auto: false, reloadTime: 1.8,
    spread: 0.014, moveSpread: 0.024, airSpread: 0.06,
    recoilPitch: 0.005, recoilYaw: 0.002, bloom: 0.004,
    sound: 'splat',
    projectile: { speed: 26, gravity: 16, type: 'balloon', splash: { radius: 3.2, damage: 26 } },
    desc: '$650 · 6 balloons · splash damage on impact'
  },
  crossbow: {
    name: 'Crossbow', price: 1250, damage: 75, magSize: 5, reserve: 25,
    fireRate: 0.9, auto: false, reloadTime: 2.0,
    spread: 0.002, moveSpread: 0.012, airSpread: 0.04,
    recoilPitch: 0.02, recoilYaw: 0.004, bloom: 0.008,
    sound: 'twang', projectile: { speed: 55, gravity: 4, type: 'bolt' },
    desc: '$1250 · 5 bolts · fast, deadly, slight drop'
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
  },
  bazooka: {
    name: 'Bazooka', price: 5200, damage: 30, magSize: 1, reserve: 4,
    fireRate: 1.8, auto: false, reloadTime: 2.8,
    spread: 0.004, moveSpread: 0.02, airSpread: 0.05,
    recoilPitch: 0.06, recoilYaw: 0.008, bloom: 0.02,
    sound: 'whoosh',
    projectile: { speed: 30, gravity: 1, type: 'rocket', explosion: { radius: 5, damage: 120 } },
    desc: '$5200 · 1 rocket · massive explosion (mind the splash!)'
  }
};
/* buy menu / hotkey order */
const BUY_ORDER = ['pistol', 'slingshot', 'waterballoon', 'crossbow', 'ak', 'awp', 'bazooka'];
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

  // Slingshot: wooden Y-frame
  g = new THREE.Group();
  vmBox(g, 0, -0.06, 0, 0.04, 0.12, 0.05, 0x8a5a2b);       // handle
  vmBox(g, -0.045, 0.03, -0.02, 0.03, 0.11, 0.03, 0x8a5a2b); // left prong
  vmBox(g, 0.045, 0.03, -0.02, 0.03, 0.11, 0.03, 0x8a5a2b);  // right prong
  vmBox(g, 0, 0.03, -0.045, 0.1, 0.012, 0.012, 0xd8d0c0);  // band
  g.userData.muzzle = new THREE.Vector3(0, 0.03, -0.06);
  viewmodels.slingshot = g;

  // Water balloons: bright blue balloon held in hand
  g = new THREE.Group();
  const balloon = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8),
    new THREE.MeshLambertMaterial({ color: 0x3aa0ff }));
  balloon.position.set(0, -0.02, -0.08);
  g.add(balloon);
  vmBox(g, 0, -0.1, 0.02, 0.05, 0.07, 0.06, 0xd8a878);     // hand
  g.userData.muzzle = new THREE.Vector3(0, 0, -0.14);
  viewmodels.waterballoon = g;

  // Crossbow: stock + horizontal bow arms
  g = new THREE.Group();
  vmBox(g, 0, -0.02, -0.08, 0.05, 0.07, 0.5, 0x6b4423);    // stock
  vmBox(g, -0.17, 0, -0.3, 0.3, 0.025, 0.05, 0x3a3a41);    // left bow arm
  vmBox(g, 0.17, 0, -0.3, 0.3, 0.025, 0.05, 0x3a3a41);     // right bow arm
  vmBox(g, 0, 0.005, -0.28, 0.012, 0.012, 0.34, 0xd8d0c0); // string/rail
  vmBox(g, 0, 0.035, -0.1, 0.03, 0.03, 0.06, 0x222226);    // sight
  g.userData.muzzle = new THREE.Vector3(0, 0, -0.44);
  viewmodels.crossbow = g;

  // Bazooka: big tube on the shoulder
  g = new THREE.Group();
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.85, 10),
    new THREE.MeshLambertMaterial({ color: 0x4a5d23 }));
  tube.rotation.x = Math.PI / 2;
  tube.position.set(0, 0.02, -0.2);
  g.add(tube);
  const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.06, 0.12, 10),
    new THREE.MeshLambertMaterial({ color: 0x3a4a1c }));
  bell.rotation.x = Math.PI / 2;
  bell.position.set(0, 0.02, -0.63);
  g.add(bell);
  vmBox(g, 0, -0.06, -0.05, 0.04, 0.08, 0.05, 0x2c2c33);   // grip
  vmBox(g, 0, 0.09, -0.15, 0.03, 0.03, 0.08, 0x222226);    // sight
  g.userData.muzzle = new THREE.Vector3(0, 0.02, -0.7);
  viewmodels.bazooka = g;

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

/* Apply a recoil/shake delta to the camera — mobile mode drives the camera
   from yaw/pitch accumulators, so it must go through them. */
function applyRecoilDelta(dp, dy) {
  if (game.mobile) {
    mobilePitch += dp;
    mobileYaw += dy;
  } else {
    camera.rotateX(dp);   // rotateX/rotateY: safe with any euler order
    camera.rotateY(dy);
  }
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

  if (def.projectile) {
    spawnProjectile(_origin.clone(), _dir.clone(), def, false);
  } else {
    hitscanShot(_origin, _dir, def);
  }

  // recoil: pattern climbs, yaw wobbles on later shots
  const i = w.patternShots;
  const pitch = def.recoilPitch * (1 + Math.min(i, 10) * 0.04);
  const yaw = def.recoilYaw * Math.sin(i * 1.7) * (i > 5 ? 1 : 0.2);
  applyRecoilDelta(pitch, yaw);
  recoilOffset.pitch += pitch;
  recoilOffset.yaw += yaw;
  w.patternShots++;
  bloom += def.bloom;

  // viewmodel kick + muzzle flash
  const vm = viewmodels[w.key];
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

/* hitscan path (pistol / ak / awp) */
function hitscanShot(origin, dir, def) {
  _raycaster.set(origin, dir);
  _raycaster.far = 200;
  const hits = _raycaster.intersectObjects(getShootTargets(), false);

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
    endPoint = origin.clone().addScaledVector(dir, 120);
  }

  // tracer from muzzle tip
  const vm = viewmodels[weaponState.key];
  muzzleTip = vm.userData.muzzle.clone().applyMatrix4(vm.matrixWorld);
  spawnTracer(muzzleTip, endPoint, def.tracer);
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
    (controls.isLocked || game.testMode || game.mobile);
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
  applyRecoilDelta(recoilOffset.pitch * (f - 1), recoilOffset.yaw * (f - 1));
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

/* ==================== projectiles ==================== */
/* stones, water balloons, crossbow bolts, rockets, boss orbs */
const projectiles = [];
const _projRay = new THREE.Raycaster();
const _pv = new THREE.Vector3();

const PROJ_STYLES = {
  stone:   { geo: () => new THREE.SphereGeometry(0.06, 6, 5), color: 0x9a9a9a, basic: false },
  balloon: { geo: () => new THREE.SphereGeometry(0.13, 10, 8), color: 0x3aa0ff, basic: false },
  bolt:    { geo: () => new THREE.BoxGeometry(0.03, 0.03, 0.5), color: 0xc08a4a, basic: false },
  rocket:  { geo: () => new THREE.CylinderGeometry(0.07, 0.09, 0.42, 8), color: 0x4a5d23, basic: false },
  orb:     { geo: () => new THREE.SphereGeometry(0.18, 10, 8), color: 0xd060ff, basic: true }
};

function spawnProjectile(origin, dir, def, hostile) {
  const style = PROJ_STYLES[def.projectile.type];
  const mat = style.basic
    ? new THREE.MeshBasicMaterial({ color: style.color })
    : new THREE.MeshLambertMaterial({ color: style.color });
  const mesh = new THREE.Mesh(style.geo(), mat);
  mesh.position.copy(origin).addScaledVector(dir, 0.6);
  scene.add(mesh);
  projectiles.push({
    mesh, def, hostile,
    vel: dir.clone().multiplyScalar(def.projectile.speed),
    grav: def.projectile.gravity,
    life: 6, trailT: 0
  });
}

function explodeProjectile(p, point, hitBot, hitZone) {
  const pj = p.def.projectile;
  if (!p.hostile) {
    // direct-hit damage for player-owned projectiles
    if (hitBot && hitBot.alive) {
      const mult = HIT_ZONE_MULT[hitZone] || 1;
      const dmg = p.def.damage * mult;
      spawnBlood(point.clone());
      ui.hitmarker(hitZone === 'head');
      if (hitZone === 'head') SFX.headshot(); else SFX.hit();
      hitBot.takeDamage(dmg, hitZone === 'head');
    }
    if (pj.splash) {
      spawnSplash(point);
      areaDamage(point, pj.splash.radius, pj.splash.damage, true, false);
    }
    if (pj.explosion) {
      spawnExplosion(point, pj.explosion.radius);
      areaDamage(point, pj.explosion.radius, pj.explosion.damage, true, true);
    }
    if (!pj.splash && !pj.explosion && !hitBot) spawnImpact(point);
  } else {
    // hostile orb: explodes, hurts only the player
    spawnExplosion(point, 3.5);
    _pv.copy(player.pos); _pv.y -= 0.3;
    const d = point.distanceTo(_pv);
    if (d < 4) player.takeDamage(55 * (1 - 0.7 * d / 4), null);
  }
}

/* radial damage from player-owned splash/explosions */
function areaDamage(center, radius, maxDmg, hurtBots, hurtPlayer) {
  if (hurtBots) {
    for (const b of bots) {
      if (!b.alive) continue;
      _pv.copy(b.pos); _pv.y = 1.0 * (b.scaleF || 1);
      const d = center.distanceTo(_pv);
      if (d < radius) {
        b.takeDamage(maxDmg * (1 - 0.7 * d / radius), false);
        ui.hitmarker(false);
      }
    }
  }
  if (hurtPlayer && player.alive) {
    _pv.copy(player.pos); _pv.y -= 0.3;
    const d = center.distanceTo(_pv);
    if (d < radius) player.takeDamage(maxDmg * 0.5 * (1 - 0.7 * d / radius), null);
  }
}

function updateProjectiles(dt) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.life -= dt;
    p.vel.y -= p.grav * dt;
    const stepLen = p.vel.length() * dt;
    _pv.copy(p.vel).normalize();

    // rocket smoke trail
    if (p.def.projectile.type === 'rocket') {
      p.trailT -= dt;
      if (p.trailT <= 0) { p.trailT = 0.035; spawnParticles(p.mesh.position, 0xaaaaaa, 1, 0.4); }
    }

    // collision along this step
    let hit = null, hitPlayer = false;
    if (stepLen > 0) {
      _projRay.set(p.mesh.position, _pv);
      _projRay.far = stepLen + 0.15;
      const targets = [];
      for (const m of obstacleMeshes) targets.push(m);
      targets.push(floorMesh);
      if (!p.hostile) {
        for (const b of bots) if (b.alive) for (const hm of b.hitMeshes) targets.push(hm);
      }
      hit = _projRay.intersectObjects(targets, false)[0] || null;
    }
    if (p.hostile && player.alive) {
      _pv.copy(player.pos); _pv.y -= 0.3;
      if (p.mesh.position.distanceTo(_pv) < 0.95) hitPlayer = true;
      _pv.copy(p.vel).normalize();
    }

    if (hit || hitPlayer || p.life <= 0) {
      const point = hit ? hit.point.clone()
        : (hitPlayer ? p.mesh.position.clone() : p.mesh.position.clone());
      const hitBot = hit && hit.object.userData.bot && !p.hostile ? hit.object.userData.bot : null;
      const hitZone = hitBot ? hit.object.userData.zone : null;
      explodeProjectile(p, point, hitBot, hitZone);
      scene.remove(p.mesh);
      p.mesh.geometry.dispose(); p.mesh.material.dispose();
      projectiles.splice(i, 1);
      continue;
    }

    p.mesh.position.addScaledVector(p.vel, dt);
    // orient bolts/rockets along velocity
    const t = p.def.projectile.type;
    if (t === 'bolt' || t === 'rocket') {
      p.mesh.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, t === 'rocket' ? 1 : 0, t === 'rocket' ? 0 : 1),
        _pv.copy(p.vel).normalize());
    }
  }
}

function clearProjectiles() {
  for (const p of projectiles) {
    scene.remove(p.mesh);
    p.mesh.geometry.dispose(); p.mesh.material.dispose();
  }
  projectiles.length = 0;
}
