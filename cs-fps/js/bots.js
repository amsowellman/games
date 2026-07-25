/* ============================================================
   bots.js — enemy AI: PATROL / ENGAGE / RETREAT states
   Exposes globals: bots, spawnBots(), clearBots(), DIFFICULTY
   ============================================================ */

const DIFFICULTY = {
  easy:   { react: 0.85, spread: 0.075, dmgMult: 0.6, burstPause: [0.9, 1.5], label: 'Easy' },
  medium: { react: 0.5,  spread: 0.042, dmgMult: 1.0, burstPause: [0.6, 1.0], label: 'Medium' },
  hard:   { react: 0.27, spread: 0.024, dmgMult: 1.35, burstPause: [0.35, 0.7], label: 'Hard' }
};
const BOT_GUNS = {
  pistol: { damage: 16, interval: 0.38, burst: 1, tracer: 0xff9090 },
  rifle:  { damage: 13, interval: 0.095, burst: [3, 5], tracer: 0xff6060 }
};
const bots = [];
const _losRay = new THREE.Raycaster();
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3();

// shared geometry/materials for bot bodies
const _geoLeg   = new THREE.BoxGeometry(0.28, 0.85, 0.28);  _geoLeg.translate(0, -0.425, 0);
const _geoTorso = new THREE.BoxGeometry(0.75, 0.85, 0.42);
const _geoHead  = new THREE.BoxGeometry(0.38, 0.38, 0.38);
const _geoGun   = new THREE.BoxGeometry(0.09, 0.09, 0.75);
const _matLeg   = new THREE.MeshLambertMaterial({ color: 0x4a3d2e });
const _matTorso = new THREE.MeshLambertMaterial({ color: 0xb5563c });
const _matHead  = new THREE.MeshLambertMaterial({ color: 0xd8a878 });
const _matGun   = new THREE.MeshLambertMaterial({ color: 0x23232a });

class Bot {
  constructor(id, scene, spawn, difficulty) {
    this.id = id;
    this.name = 'Bot ' + (id + 1);
    this.diff = DIFFICULTY[difficulty] || DIFFICULTY.medium;
    this.hp = 100;
    this.alive = true;
    this.state = 'patrol';
    this.gun = Math.random() < 0.65 ? 'rifle' : 'pistol';
    this.speed = 3.6;
    this.vel = new THREE.Vector3();
    this.waypoint = null;
    this.stuckT = 0;
    this.seesPlayer = false;
    this.spottedAt = 0;
    this.lastKnown = new THREE.Vector3();
    this.strafeDir = 1;
    this.strafeT = 0;
    this.nextShotAt = 0;
    this.burstLeft = 0;
    this.nextBurstAt = 0;
    this.coverPoint = null;
    this.coverT = 0;
    this.walkPhase = Math.random() * 6;
    this.losT = Math.random() * 0.15;   // stagger LOS checks
    this.deathT = 0;
    this.flashLeft = 0;
    this._build(scene, spawn);
  }

  _build(scene, spawn) {
    const g = new THREE.Group();
    g.position.copy(spawn);
    g.rotation.y = Math.PI; // face south toward player side

    this.legL = new THREE.Mesh(_geoLeg, _matLeg); this.legL.position.set(-0.17, 0.85, 0);
    this.legR = new THREE.Mesh(_geoLeg, _matLeg); this.legR.position.set(0.17, 0.85, 0);
    this.torso = new THREE.Mesh(_geoTorso, _matTorso); this.torso.position.set(0, 1.275, 0);
    this.head = new THREE.Mesh(_geoHead, _matHead); this.head.position.set(0, 1.89, 0);
    this.gunMesh = new THREE.Mesh(_geoGun, _matGun); this.gunMesh.position.set(0.26, 1.32, 0.4);
    g.add(this.legL, this.legR, this.torso, this.head, this.gunMesh);

    this.legL.userData = { bot: this, zone: 'limbs' };
    this.legR.userData = { bot: this, zone: 'limbs' };
    this.torso.userData = { bot: this, zone: 'body' };
    this.head.userData = { bot: this, zone: 'head' };
    this.hitMeshes = [this.legL, this.legR, this.torso, this.head];

    // muzzle flash quad
    this.flash = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22),
      new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.95,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    this.flash.position.set(0.26, 1.32, 0.82);
    this.flash.visible = false;
    g.add(this.flash);

    // health bar sprite
    const c = document.createElement('canvas'); c.width = 64; c.height = 8;
    this.hpCanvas = c;
    this.hpTex = new THREE.CanvasTexture(c);
    this.hpBar = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.hpTex, depthTest: true }));
    this.hpBar.scale.set(1.1, 0.14, 1);
    this.hpBar.position.set(0, 2.3, 0);
    g.add(this.hpBar);
    this._drawHp();

    this.group = g;
    scene.add(g);
  }

  _drawHp() {
    const ctx = this.hpCanvas.getContext('2d');
    ctx.clearRect(0, 0, 64, 8);
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, 64, 8);
    const f = Math.max(0, this.hp / 100);
    ctx.fillStyle = f > 0.55 ? '#4fd94f' : (f > 0.25 ? '#e8b53a' : '#e0483c');
    ctx.fillRect(1, 1, 62 * f, 6);
    this.hpTex.needsUpdate = true;
  }

  get pos() { return this.group.position; }

  /* --- line of sight to player (throttled in update) --- */
  checkLOS() {
    if (!player.alive) { this.seesPlayer = false; return; }
    _v1.copy(this.pos); _v1.y = 1.7;                    // bot eye
    _v2.copy(player.pos); _v2.y -= 0.25;                // player chest
    const dist = _v1.distanceTo(_v2);
    _losRay.set(_v1, _v2.sub(_v1).normalize());
    _losRay.far = dist - 0.3;
    const blocked = _losRay.intersectObjects(obstacleMeshes, false).length > 0;
    const visible = !blocked && dist < 60;
    if (visible && !this.seesPlayer) this.spottedAt = performance.now() / 1000;
    if (visible) this.lastKnown.copy(player.pos);
    this.seesPlayer = visible;
  }

  takeDamage(dmg, headshot) {
    if (!this.alive) return;
    this.hp -= dmg;
    this._drawHp();
    if (this.hp <= 0) {
      this.die(headshot);
      return;
    }
    // getting shot aggros the bot
    this.lastKnown.copy(player.pos);
    if (this.hp < 30) this.state = 'retreat';
    else if (this.state === 'patrol') { this.state = 'engage'; this.spottedAt = performance.now() / 1000; }
  }

  die(headshot) {
    this.alive = false;
    this.state = 'dead';
    this.deathT = 0;
    this.flash.visible = false;
    this.hpBar.visible = false;
    this.fallDir = Math.random() < 0.5 ? 1 : -1;
    spawnBlood(_v1.copy(this.pos).setY(1.2));
    onBotKilled(this, headshot);   // main.js: killfeed, money, round check
  }

  /* --- pick a point behind the nearest cover relative to the player --- */
  _findCover() {
    let best = null, bestD = Infinity;
    for (const c of colliders) {
      const cx = (c.minX + c.maxX) / 2, cz = (c.minZ + c.maxZ) / 2;
      const w = c.maxX - c.minX, d = c.maxZ - c.minZ;
      if (w > 20 || d > 20) continue;   // skip perimeter walls
      _v1.set(cx - player.pos.x, 0, cz - player.pos.z);
      const dist = _v1.length();
      if (dist < 1) continue;
      _v1.normalize().multiplyScalar(Math.max(w, d) / 2 + 1.3);
      const px = cx + _v1.x, pz = cz + _v1.z;
      if (!isOpen(px, pz, 0.6)) continue;
      const myD = this.pos.distanceTo(_v2.set(px, 0, pz));
      if (myD < bestD) { bestD = myD; best = _v2.clone(); }
    }
    return best;
  }

  _moveToward(target, dt, speed) {
    _v1.set(target.x - this.pos.x, 0, target.z - this.pos.z);
    const dist = _v1.length();
    if (dist < 0.05) return dist;
    _v1.normalize().multiplyScalar(speed);
    this.vel.x = _v1.x; this.vel.z = _v1.z;
    moveWithCollision(this.pos, 0.45, this.vel.x * dt, this.vel.z * dt);
    return dist;
  }

  _face(dirX, dirZ, dt) {
    const target = Math.atan2(dirX, dirZ);
    let diff = target - this.group.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.group.rotation.y += diff * Math.min(1, 10 * dt);
  }

  _animateLegs(dt, moving) {
    if (moving) {
      this.walkPhase += dt * 9;
      const a = Math.sin(this.walkPhase) * 0.55;
      this.legL.rotation.x = a;
      this.legR.rotation.x = -a;
    } else {
      this.legL.rotation.x *= 0.8;
      this.legR.rotation.x *= 0.8;
    }
  }

  _shoot(now) {
    const gun = BOT_GUNS[this.gun];
    if (this.burstLeft <= 0) {
      if (now < this.nextBurstAt) return;
      this.burstLeft = gun.burst === 1 ? 1 :
        gun.burst[0] + ((Math.random() * (gun.burst[1] - gun.burst[0] + 1)) | 0);
    }
    if (now < this.nextShotAt) return;
    this.nextShotAt = now + gun.interval;
    this.burstLeft--;
    if (this.burstLeft <= 0) {
      const p = this.diff.burstPause;
      this.nextBurstAt = now + p[0] + Math.random() * (p[1] - p[0]);
    }

    // ray from bot gun toward player chest with difficulty spread
    _v1.copy(this.pos); _v1.y = 1.35;
    _v2.copy(player.pos); _v2.y -= 0.3;
    const dist = _v1.distanceTo(_v2);
    const dir = _v2.sub(_v1).normalize();
    const spread = this.diff.spread * (1 + dist / 45);
    dir.x += (Math.random() - 0.5) * 2 * spread;
    dir.y += (Math.random() - 0.5) * 2 * spread * 0.7;
    dir.z += (Math.random() - 0.5) * 2 * spread;
    dir.normalize();

    // wall occlusion along the ray
    _losRay.set(_v1, dir);
    _losRay.far = 120;
    const wallHit = _losRay.intersectObjects(obstacleMeshes, false)[0];
    const wallDist = wallHit ? wallHit.distance : 120;

    // closest-approach sphere test vs player chest
    _v2.copy(player.pos); _v2.y -= 0.3;
    const t = _v2.clone().sub(_v1).dot(dir);
    let hitPoint = null;
    if (t > 0 && t < wallDist) {
      const closest = _v1.clone().addScaledVector(dir, t);
      if (closest.distanceTo(_v2) < 0.62) {
        const dmg = gun.damage * this.diff.dmgMult * (0.85 + Math.random() * 0.3);
        player.takeDamage(dmg, this);
        hitPoint = closest;
      }
    }
    if (!hitPoint) {
      hitPoint = wallHit ? wallHit.point : _v1.clone().addScaledVector(dir, 120);
      if (wallHit) spawnImpact(wallHit.point);
    }
    spawnTracer(_v1.clone(), hitPoint, gun.tracer);
    SFX.gunshot(this.gun === 'rifle' ? 'ak' : 'pistol', Math.max(0.12, 1 - dist / 65));
    this.flash.visible = true;
    this.flashLeft = 0.05;
  }

  update(dt, now) {
    // death animation always runs
    if (!this.alive) {
      if (this.deathT < 0.5) {
        this.deathT += dt;
        const t = Math.min(1, this.deathT / 0.45);
        this.group.rotation.x = -t * (Math.PI / 2) * 0.96;
        this.group.rotation.z = this.fallDir * t * 0.18;
      }
      return;
    }
    if (game.state !== 'playing') { this._animateLegs(dt, false); return; }  // frozen during buy time

    // throttled LOS
    this.losT -= dt;
    if (this.losT <= 0) { this.losT = 0.15; this.checkLOS(); }

    // state transitions
    if (this.hp < 30 && this.state !== 'retreat') { this.state = 'retreat'; this.coverPoint = null; }
    if (this.state === 'patrol' && this.seesPlayer) this.state = 'engage';
    if (this.state === 'engage' && !this.seesPlayer &&
        this.pos.distanceTo(this.lastKnown) < 2.5) this.state = 'patrol';

    let moving = false;
    const dPlayer = this.pos.distanceTo(player.pos);

    if (this.state === 'patrol') {
      if (!this.waypoint || this.pos.distanceTo(this.waypoint) < 1.3 || this.stuckT > 3) {
        this.waypoint = Math.random() < 0.7
          ? mapWaypoints[(Math.random() * mapWaypoints.length) | 0].clone()
          : mapWaypoints.randomOpen();
        this.stuckT = 0;
      }
      const bx = this.pos.x, bz = this.pos.z;
      this._moveToward(this.waypoint, dt, this.speed);
      this._face(this.waypoint.x - this.pos.x, this.waypoint.z - this.pos.z, dt);
      const moved = Math.hypot(this.pos.x - bx, this.pos.z - bz);
      this.stuckT = moved < this.speed * dt * 0.3 ? this.stuckT + dt : 0;
      moving = true;

    } else if (this.state === 'engage') {
      const tgt = this.seesPlayer ? player.pos : this.lastKnown;
      this._face(tgt.x - this.pos.x, tgt.z - this.pos.z, dt);
      if (this.seesPlayer) {
        // hold an 8–20u band and strafe
        this.strafeT -= dt;
        if (this.strafeT <= 0) { this.strafeT = 1 + Math.random(); this.strafeDir *= -1; }
        const toward = _v1.set(player.pos.x - this.pos.x, 0, player.pos.z - this.pos.z).normalize();
        let mx = -toward.z * this.strafeDir, mz = toward.x * this.strafeDir;
        if (dPlayer > 20) { mx += toward.x; mz += toward.z; }
        else if (dPlayer < 8) { mx -= toward.x; mz -= toward.z; }
        const L = Math.hypot(mx, mz) || 1;
        moveWithCollision(this.pos, 0.45, mx / L * 4.2 * dt, mz / L * 4.2 * dt);
        moving = true;
        if (now - this.spottedAt > this.diff.react) this._shoot(now);
      } else {
        this._moveToward(this.lastKnown, dt, 4.0);   // hunt last known position
        moving = true;
      }

    } else if (this.state === 'retreat') {
      this.coverT -= dt;
      if (!this.coverPoint || this.coverT <= 0) {
        this.coverT = 1.5;
        this.coverPoint = this._findCover() || botSpawns[this.id].clone();
      }
      const d = this._moveToward(this.coverPoint, dt, 4.4);
      moving = d > 0.4;
      if (this.seesPlayer) {
        this._face(player.pos.x - this.pos.x, player.pos.z - this.pos.z, dt);
        if (now - this.spottedAt > this.diff.react * 1.5) this._shoot(now);
      } else if (moving) {
        this._face(this.coverPoint.x - this.pos.x, this.coverPoint.z - this.pos.z, dt);
      }
    }

    this._animateLegs(dt, moving);

    if (this.flashLeft > 0) {
      this.flashLeft -= dt;
      if (this.flashLeft <= 0) this.flash.visible = false;
    }
  }
}

/* separation so bots don't stack together */
function separateBots() {
  for (let i = 0; i < bots.length; i++) {
    if (!bots[i].alive) continue;
    for (let j = i + 1; j < bots.length; j++) {
      if (!bots[j].alive) continue;
      const a = bots[i].pos, b = bots[j].pos;
      const dx = b.x - a.x, dz = b.z - a.z;
      const d = Math.hypot(dx, dz);
      if (d < 1.0 && d > 0.001) {
        const push = (1.0 - d) * 0.5, nx = dx / d, nz = dz / d;
        a.x -= nx * push; a.z -= nz * push;
        b.x += nx * push; b.z += nz * push;
      }
    }
  }
}

function spawnBots(scene, count, difficulty) {
  clearBots(scene);
  for (let i = 0; i < count; i++) {
    bots.push(new Bot(i, scene, botSpawns[i % botSpawns.length], difficulty));
  }
}

function clearBots(scene) {
  for (const b of bots) {
    scene.remove(b.group);
    b.hpTex.dispose();
    b.hpBar.material.dispose();
  }
  bots.length = 0;
}
