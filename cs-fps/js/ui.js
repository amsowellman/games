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
      'dmgflash','mainmenu','playbtn','buymenu','buyitems','buymoney','buytimeleft'];
    for (const id of ids) this.el[id] = document.getElementById(id);
    this.mapCtx = this.el.minimap.getContext('2d');
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
    if (relock !== false && !game.testMode &&
        (game.state === 'buy' || game.state === 'playing')) controls.lock();
  },
  renderBuyMenu() {
    this.el.buymoney.textContent = '$' + game.money;
    const wrap = this.el.buyitems;
    wrap.innerHTML = '';
    const keys = ['pistol', 'ak', 'awp'];
    keys.forEach((k, i) => {
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
