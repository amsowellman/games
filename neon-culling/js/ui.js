/* ============================================================
   ui.js — HUD, crosshair, killfeed, overlays, buy menu, minimap
   Exposes global: ui
   ============================================================ */

const ui = {
  el: {},
  _dmg: 0,
  _mapT: 0,
  _announceTimer: null,

  init() {
    const ids = ['hud','crosshair','hitmarker','healthbar','healthnum','ammo','weaponname',
      'money','timer','score','wins','losses','roundnum','killfeed','minimap','announce',
      'dmgflash','mainmenu','playbtn','buymenu','buyitems','buymoney','buytimeleft',
      'bossbar','bossname','bossbar-fill','touchui','movepad','lookpad',
      'mb-jump','mb-reload','mb-buy'];
    for (const id of ids) this.el[id] = document.getElementById(id);
    this.mapCtx = this.el.minimap.getContext('2d');
    this._initTouch();
  },

  /* ---------- boss bar ---------- */
  showBossBar(name) {
    this.el.bossname.textContent = '☠ ' + name + ' ☠';
    this.setBossBar(1);
    this.el.bossbar.style.display = 'block';
  },
  setBossBar(f) {
    this.el['bossbar-fill'].style.width = Math.max(0, f * 100) + '%';
  },
  hideBossBar() {
    this.el.bossbar.style.display = 'none';
  },

  /* ---------- touch controls (mobile mode) ---------- */
  showTouchControls(v) {
    this.el.touchui.style.display = v ? 'block' : 'none';
  },

  _initTouch() {
    const movePad = this.el.movepad, lookPad = this.el.lookpad;
    const moveKnob = movePad.querySelector('.knob');
    const lookKnob = lookPad.querySelector('.knob');
    const HOME = { x: 110, y: () => innerHeight * 0.78 };
    let moveT = null, lookT = null, taps = [];
    const self = this;

    function placePad(pad, knob, ax, ay, dx, dy) {
      pad.style.left = ax + 'px';
      pad.style.top = ay + 'px';
      pad.style.right = 'auto';
      knob.style.transform = 'translate(' + dx * 38 + 'px,' + dy * 38 + 'px)';
    }
    function resetPad(pad, knob, home) {
      pad.style.left = home.x + 'px';
      pad.style.top = home.y() + 'px';
      pad.style.right = 'auto';
      knob.style.transform = 'translate(0,0)';
    }
    function vec(t, a) {
      let dx = (t.clientX - a.x) / 52, dy = (t.clientY - a.y) / 52;
      const l = Math.hypot(dx, dy);
      if (l > 1) { dx /= l; dy /= l; }
      return { x: dx, y: dy };
    }

    document.addEventListener('touchstart', (e) => {
      if (!game.mobile || !game.started) return;
      for (const t of e.changedTouches) {
        if (t.target.closest('.mbtn') || t.target.closest('.panel')) continue;
        const rx = t.clientX / innerWidth;
        taps.push({ id: t.identifier, x: t.clientX, y: t.clientY, t: performance.now(), moved: false });
        if (rx < 0.45 && !moveT) {
          moveT = { id: t.identifier, x: t.clientX, y: t.clientY };
        } else if (rx > 0.55 && !lookT) {
          lookT = { id: t.identifier, x: t.clientX, y: t.clientY };
        }
      }
      if (e.cancelable) e.preventDefault();
    }, { passive: false });

    document.addEventListener('touchmove', (e) => {
      if (!game.mobile) return;
      for (const t of e.changedTouches) {
        const tap = taps.find(p => p.id === t.identifier);
        if (tap && Math.hypot(t.clientX - tap.x, t.clientY - tap.y) > 12) tap.moved = true;
        if (moveT && t.identifier === moveT.id) {
          const v = vec(t, moveT);
          mobileMove.x = v.x;
          mobileMove.y = -v.y;   // screen down = +y, game forward = -screen-y
          placePad(movePad, moveKnob, moveT.x, moveT.y, v.x, v.y);
        } else if (lookT && t.identifier === lookT.id) {
          const v = vec(t, lookT);
          mobileLook.x = v.x;
          mobileLook.y = v.y;
          placePad(lookPad, lookKnob, lookT.x, lookT.y, v.x, v.y);
        }
      }
      if (e.cancelable) e.preventDefault();
    }, { passive: false });

    function endTouch(e) {
      if (!game.mobile) return;
      for (const t of e.changedTouches) {
        if (moveT && t.identifier === moveT.id) {
          moveT = null;
          mobileMove.x = 0; mobileMove.y = 0;
          resetPad(movePad, moveKnob, { x: HOME.x, y: HOME.y });
        }
        if (lookT && t.identifier === lookT.id) {
          lookT = null;
          mobileLook.x = 0; mobileLook.y = 0;
          resetPad(lookPad, lookKnob, { x: innerWidth - HOME.x, y: HOME.y });
        }
        const ti = taps.findIndex(p => p.id === t.identifier);
        if (ti >= 0) {
          const tap = taps[ti];
          taps.splice(ti, 1);
          if (!tap.moved && performance.now() - tap.t < 300) queueMobileShot();
        }
      }
    }
    document.addEventListener('touchend', endTouch);
    document.addEventListener('touchcancel', endTouch);

    // action buttons
    this.el['mb-jump'].addEventListener('touchstart', (e) => {
      e.preventDefault(); e.stopPropagation();
      if (player) player.keys['Space'] = true;
    }, { passive: false });
    this.el['mb-jump'].addEventListener('touchend', (e) => {
      e.preventDefault();
      if (player) player.keys['Space'] = false;
    });
    this.el['mb-reload'].addEventListener('touchstart', (e) => {
      e.preventDefault(); e.stopPropagation();
      startReload();
    }, { passive: false });
    this.el['mb-buy'].addEventListener('touchstart', (e) => {
      e.preventDefault(); e.stopPropagation();
      if (game.state !== 'buy') return;
      if (buyMenuOpen) self.closeBuyMenu(); else self.openBuyMenu();
    }, { passive: false });
  },

  showHUD(v) { this.el.hud.style.display = v ? 'block' : 'none'; },
  showMainMenu(v) { this.el.mainmenu.style.display = v ? 'flex' : 'none'; },

  /* ---------- per-frame ---------- */
  update(dt) {
    // health
    const hp = Math.ceil(player.hp);
    this.el.healthbar.style.width = hp + '%';
    this.el.healthbar.classList.toggle('low', hp <= 30);
    this.el.healthnum.textContent = hp;

    // ammo
    const w = weaponState;
    this.el.ammo.querySelector('.mag').textContent = w.reloading ? '--' : w.mag;
    this.el.ammo.querySelector('.res').textContent = '/ ' + w.reserve;
    this.el.ammo.classList.toggle('reloading', w.reloading);
    this.el.weaponname.textContent = w.def.name;
    this.el.money.textContent = '$' + game.money;

    // timer / score
    const t = this.el.timer;
    if (game.state === 'buy') {
      t.textContent = fmtTime(game.buyTimeLeft);
      t.className = 'buy';
    } else {
      t.textContent = fmtTime(game.roundTimeLeft);
      t.className = game.roundTimeLeft <= 10 && game.state === 'playing' ? 'urgent' : '';
    }
    this.el.wins.textContent = game.wins;
    this.el.losses.textContent = game.losses;
    this.el.roundnum.textContent = 'Round ' + game.round + ' · First to 16';

    // crosshair gap from weapon spread
    const showCh = player.alive && !buyMenuOpen &&
      (game.state === 'buy' || game.state === 'playing');
    this.el.crosshair.style.display = showCh ? 'block' : 'none';
    if (showCh) {
      const px = Math.max(7, Math.min(64, 7 + currentSpreadRad * 1400));
      this.el.crosshair.style.setProperty('--gap', px + 'px');
    }

    // damage vignette decay
    if (this._dmg > 0) {
      this._dmg = Math.max(0, this._dmg - dt * 2.2);
      this.el.dmgflash.style.opacity = this._dmg.toFixed(3);
    }

    // minimap ~20 Hz
    this._mapT -= dt;
    if (this._mapT <= 0) { this._mapT = 0.05; this.drawMinimap(); }

    // buy countdown text
    if (buyMenuOpen) this.el.buytimeleft.textContent = Math.ceil(game.buyTimeLeft);

    // mobile buy button only during buy time
    if (game.mobile) {
      this.el['mb-buy'].style.display = game.state === 'buy' ? 'block' : 'none';
    }
  },

  /* ---------- feedback ---------- */
  hitmarker(head) {
    const h = this.el.hitmarker;
    h.classList.remove('show', 'head');
    void h.offsetWidth;                 // restart CSS animation
    if (head) h.classList.add('head');
    h.classList.add('show');
  },

  damageFlash() {
    this._dmg = Math.min(0.85, this._dmg + 0.45);
  },

  killfeed(html) {
    const d = document.createElement('div');
    d.className = 'kf';
    d.innerHTML = html;
    const feed = this.el.killfeed;
    feed.prepend(d);
    while (feed.children.length > 5) feed.lastChild.remove();
    setTimeout(() => d.classList.add('fade'), 3400);
    setTimeout(() => d.remove(), 4100);
  },

  announce(big, sub, color, sticky) {
    const a = this.el.announce;
    a.innerHTML = '<div class="big">' + big + '</div>' +
      (sub ? '<div class="sub">' + sub + '</div>' : '');
    a.className = color || 'white';
    a.style.opacity = 1;
    clearTimeout(this._announceTimer);
    if (!sticky) this._announceTimer = setTimeout(() => { a.style.opacity = 0; }, 2600);
  },
  clearAnnounce() {
    clearTimeout(this._announceTimer);
    this.el.announce.style.opacity = 0;
  },

  /* ---------- buy menu ---------- */
  openBuyMenu() {
    buyMenuOpen = true;
    this.renderBuyMenu();
    this.el.buymenu.style.display = 'flex';
    if (controls.isLocked) controls.unlock();
  },
  closeBuyMenu(relock) {
    buyMenuOpen = false;
    this.el.buymenu.style.display = 'none';
    if (relock !== false && !game.testMode && !game.mobile &&
        (game.state === 'buy' || game.state === 'playing')) controls.lock();
  },
  renderBuyMenu() {
    this.el.buymoney.textContent = '$' + game.money;
    const wrap = this.el.buyitems;
    wrap.innerHTML = '';
    BUY_ORDER.forEach((k, i) => {
      const d = WEAPONS[k];
      const owned = weaponState.key === k;
      const afford = game.money >= d.price;
      const item = document.createElement('div');
      item.className = 'buyitem' + (owned ? ' owned' : '') + (!afford && !owned ? ' cant' : '');
      item.innerHTML =
        '<span class="nm">' + d.name + '<small>' + d.desc + '</small></span>' +
        '<span><span class="pr">' + (owned ? 'OWNED' : '$' + d.price) + '</span>' +
        '<span class="key">' + (i + 1) + '</span></span>';
      if (afford || owned) item.addEventListener('click', () => buyWeapon(k));
      wrap.appendChild(item);
    });
  },

  /* ---------- minimap ---------- */
  drawMinimap() {
    const ctx = this.mapCtx, S = 170 / 80;   // world 80 -> 170px
    const px = (x) => (x + MAP_HALF) * S;
    ctx.clearRect(0, 0, 170, 170);

    // bombsites under everything
    for (const key of ['a', 'b']) {
      const s = mapSites[key];
      ctx.fillStyle = key === 'a' ? 'rgba(255,64,48,0.4)' : 'rgba(58,120,255,0.4)';
      ctx.fillRect(px(s.x - 7), px(s.z - 7), 14 * S, 14 * S);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 9px monospace';
      ctx.fillText(key.toUpperCase(), px(s.x) - 3, px(s.z) + 3);
    }

    // walls & crates
    for (const r of mapMini) {
      ctx.fillStyle = r.crate ? '#8a5a2b' : '#9a9ca4';
      ctx.fillRect(px(r.minX), px(r.minZ), (r.maxX - r.minX) * S, (r.maxZ - r.minZ) * S);
    }

    // bots
    for (const b of bots) {
      if (!b.alive) continue;
      ctx.fillStyle = '#ff5147';
      ctx.beginPath();
      ctx.arc(px(b.pos.x), px(b.pos.z), 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // player + facing
    if (player.alive) {
      const x = px(player.pos.x), y = px(player.pos.z);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(x, y, 3.4, 0, Math.PI * 2); ctx.fill();
      camera.getWorldDirection(_mapDir);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + _mapDir.x * 9, y + _mapDir.z * 9);
      ctx.stroke();
    }
  }
};

const _mapDir = new THREE.Vector3();
function fmtTime(s) {
  s = Math.max(0, Math.ceil(s));
  return ((s / 60) | 0) + ':' + String(s % 60).padStart(2, '0');
}
