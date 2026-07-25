/* ============================================================
   player.js — FPS controller: pointer lock, WASD, jump, crouch
   Exposes globals: player, initPlayer()
   ============================================================ */

/* Minimal PointerLockControls fallback (same API as three r128
   examples/js version) in case the CDN script failed to load. */
if (typeof THREE !== 'undefined' && !THREE.PointerLockControls) {
  THREE.PointerLockControls = function (camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;
    this.isLocked = false;
    const euler = new THREE.Euler(0, 0, 0, 'YXZ');
    const pitchObject = new THREE.Object3D();
    pitchObject.add(camera);
    const yawObject = new THREE.Object3D();
    yawObject.add(pitchObject);
    const listeners = { lock: [], unlock: [] };
    this.addEventListener = (t, fn) => { (listeners[t] = listeners[t] || []).push(fn); };
    this.getObject = () => yawObject;
    this.lock = () => domElement.requestPointerLock();
    this.unlock = () => document.exitPointerLock();
    const onMouseMove = (e) => {
      if (!this.isLocked) return;
      euler.setFromQuaternion(camera.quaternion);
      euler.y -= e.movementX * 0.0022;
      euler.x -= e.movementY * 0.0022;
      euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.x));
      camera.quaternion.setFromEuler(euler);
    };
    const onChange = () => {
      this.isLocked = document.pointerLockElement === domElement;
      (listeners[this.isLocked ? 'lock' : 'unlock'] || []).forEach(fn => fn());
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('pointerlockchange', onChange);
  };
}

/* ---------------- Player ---------------- */
class Player {
  constructor(controls) {
    this.controls = controls;
    this.pos = controls.getObject().position;   // eye position (y managed here)
    this.vel = new THREE.Vector3();
    this.feetY = 0;
    this.eyeH = 1.62;
    this.radius = 0.42;
    this.hp = 100;
    this.alive = true;
    this.onGround = true;
    this.crouching = false;
    this.walking = false;
    this.deathT = 0;
    this.keys = {};
    this.runSpeed = 6.2;
    this.walkSpeed = 3.1;
    this.crouchSpeed = 2.2;
    this.jumpVel = 8.4;
    this.gravity = 24;
    this._bindInput();
  }

  _bindInput() {
    const gameKeys = ['KeyW','KeyA','KeyS','KeyD','Space','ShiftLeft','ShiftRight',
      'ControlLeft','ControlRight','KeyC','KeyR','KeyB','Digit1','Digit2','Digit3'];
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (gameKeys.includes(e.code) && (this.controls.isLocked || game.testMode)) e.preventDefault();
      handleGameKey(e.code);          // defined in main.js (R / B / 1-3)
    });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    window.addEventListener('blur', () => { this.keys = {}; firing = false; });

    document.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      if (this.controls.isLocked || game.testMode) { firing = true; }
      else if (game.state !== 'menu' && !buyMenuOpen) this.controls.lock();
    });
    document.addEventListener('mouseup', (e) => {
      if (e.button === 0) { firing = false; triggerReady = true; weaponState && (weaponState.patternShots = 0); }
    });
    document.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  reset(spawn) {
    this.hp = 100;
    this.alive = true;
    this.deathT = 0;
    this._roll = 0;
    this.pos.set(spawn.x, 1.62, spawn.z);
    this.vel.set(0, 0, 0);
    this.feetY = 0;
    this.eyeH = 1.62;
    this.crouching = false;
    camera.rotation.set(0, 0, 0);   // face north (-z), clear death roll
    recoilOffset.pitch = 0;
    recoilOffset.yaw = 0;
  }

  takeDamage(dmg, fromBot) {
    if (!this.alive || game.state === 'menu') return;
    this.hp = Math.max(0, this.hp - dmg);
    ui.damageFlash();
    if (this.hp <= 0) {
      this.alive = false;
      firing = false;
      onPlayerDeath(fromBot);         // main.js
    }
  }

  update(dt) {
    const k = this.keys;
    if (!this.alive) {
      // death cam: sink and roll (rotateZ works regardless of euler order)
      this.deathT += dt;
      const t = Math.min(1, this.deathT * 1.4);
      this.pos.y = 1.62 - t * 1.1;
      const roll = t * 0.45;
      camera.rotateZ(roll - (this._roll || 0));
      this._roll = roll;
      return;
    }

    this.crouching = !!(k['ControlLeft'] || k['ControlRight'] || k['KeyC']);
    this.walking = !!(k['ShiftLeft'] || k['ShiftRight']) && !this.crouching;
    const speed = this.crouching ? this.crouchSpeed : (this.walking ? this.walkSpeed : this.runSpeed);

    // desired velocity in camera-yaw space (yaw from world direction — safe
    // for both the real PointerLockControls and the fallback above)
    let fx = 0, fz = 0;
    if (k['KeyW']) fz += 1;
    if (k['KeyS']) fz -= 1;
    if (k['KeyA']) fx -= 1;
    if (k['KeyD']) fx += 1;
    camera.getWorldDirection(_fwd);
    _fwd.y = 0;
    if (_fwd.lengthSq() < 1e-6) _fwd.set(0, 0, -1);
    _fwd.normalize();
    // forward = _fwd, right = (-_fwd.z, 0, _fwd.x)
    const len = Math.hypot(fx, fz) || 1;
    const wishX = (_fwd.x * fz - _fwd.z * fx) / len * speed;
    const wishZ = (_fwd.z * fz + _fwd.x * fx) / len * speed;

    // accelerate toward wish velocity
    const accel = this.onGround ? 12 : 2.5;
    const blend = Math.min(1, accel * dt);
    this.vel.x += (wishX - this.vel.x) * blend;
    this.vel.z += (wishZ - this.vel.z) * blend;

    // gravity & jump
    if (k['Space'] && this.onGround) {
      this.vel.y = this.jumpVel;
      this.onGround = false;
    }
    this.vel.y -= this.gravity * dt;
    this.feetY += this.vel.y * dt;
    if (this.feetY <= 0) {
      this.feetY = 0; this.vel.y = 0; this.onGround = true;
    } else {
      this.onGround = false;
    }

    // horizontal move with wall collision
    moveWithCollision(this.pos, this.radius, this.vel.x * dt, this.vel.z * dt);

    // eye height (crouch lerp) + jump offset
    const targetEye = this.crouching ? 1.06 : 1.62;
    this.eyeH += (targetEye - this.eyeH) * Math.min(1, 12 * dt);
    this.pos.y = this.feetY + this.eyeH;
  }

  get speedRatio() {
    return Math.min(1, Math.hypot(this.vel.x, this.vel.z) / this.runSpeed);
  }
}

let player = null;
const _fwd = new THREE.Vector3();
function initPlayer(controls) {
  player = new Player(controls);
  return player;
}
