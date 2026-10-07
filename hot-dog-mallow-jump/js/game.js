/* Hot Dog Mallow Jump — a kid-friendly doodle-jump.
 * Steer the hot dog as it bounces up floating marshmallows.
 * Everything is drawn with canvas shapes; no images or network needed. */
(function () {
    'use strict';

    var canvas = document.getElementById('game');
    var ctx = canvas.getContext('2d');
    var W = canvas.width;
    var H = canvas.height;

    var GRAVITY = 1500;          // px/s^2
    var BOUNCE = 720;            // bounce velocity off a plain marshmallow
    var BOUNCE_SPRING = 1050;    // bounce off a toasted marshmallow
    var MOVE_ACCEL = 2600;
    var MOVE_MAX = 420;
    var FRICTION = 0.90;         // per-frame horizontal damping

    var SKY_TOP = '#bfe6ff';
    var SKY_BOTTOM = '#ffe6f0';

    var state = null;
    var keys = {};
    var touchTargetX = null;   // finger position: the hot dog steers toward it
    var highScore = 0;
    try {
        highScore = parseInt(localStorage.getItem('hdmj-high') || '0', 10) || 0;
    } catch (e) {
        highScore = 0;
    }

    function rand(min, max) {
        return min + Math.random() * (max - min);
    }

    function makeMarshmallow(x, y) {
        var springy = Math.random() < 0.18;
        return {
            x: x, y: y,
            w: rand(64, 92),
            h: 20,
            squash: 0,          // 0..1 visual squash timer
            springy: springy
        };
    }

    function newGame() {
        state = {
            px: W / 2, py: H - 120,   // player position
            vx: 0, vy: BOUNCE,
            score: 0,
            best: highScore,
            over: false,
            worldY: 0,                // total height climbed
            nextY: H - 80,            // where the next platform goes
            platforms: [],
            squirts: [],              // little mustard particles
            t: 0
        };
        var i;
        state.platforms.push(makeMarshmallow(W / 2 - 40, H - 60));
        while (state.nextY > -40) {
            spawnPlatform();
        }
    }

    function spawnPlatform() {
        var s = state;
        var climb = Math.min(1, s.worldY / 4000);   // difficulty 0..1
        var gap = rand(70, 105) + climb * 60;
        s.nextY -= gap;
        var x = rand(8, W - 100);
        s.platforms.push(makeMarshmallow(x, s.nextY));
    }

    function addSquirt(x, y) {
        state.squirts.push({ x: x, y: y, vx: rand(-60, 60), vy: rand(-140, -40), life: 0.5 });
    }

    function bounce(vy) {
        state.vy = -vy;
    }

    function update(dt) {
        if (state.over) {
            return;
        }
        var s = state;
        s.t += dt;

        // horizontal control: keyboard, or steer toward the finger on touch
        var dir = 0;
        if (keys.ArrowLeft || keys.a) { dir -= 1; }
        if (keys.ArrowRight || keys.d) { dir += 1; }
        if (touchTargetX !== null) {
            var dx = touchTargetX - s.px;
            if (dx > 12) { dir += 1; }
            if (dx < -12) { dir -= 1; }
        }
        s.vx += dir * MOVE_ACCEL * dt;
        if (dir === 0) { s.vx *= FRICTION; }
        if (s.vx > MOVE_MAX) { s.vx = MOVE_MAX; }
        if (s.vx < -MOVE_MAX) { s.vx = -MOVE_MAX; }

        // physics
        s.vy += GRAVITY * dt;
        s.px += s.vx * dt;
        s.py += s.vy * dt;

        // wrap around the sides
        if (s.px < -30) { s.px = W + 30; }
        if (s.px > W + 30) { s.px = -30; }

        // squash timers
        var i, p;
        for (i = 0; i < s.platforms.length; i++) {
            p = s.platforms[i];
            if (p.squash > 0) { p.squash -= dt * 4; }
        }

        // platform collisions (only when falling)
        if (s.vy > 0) {
            for (i = 0; i < s.platforms.length; i++) {
                p = s.platforms[i];
                if (p.squash > 0) { continue; }   // already used this pass
                var feet = s.py + 26;
                if (s.px > p.x - 22 && s.px < p.x + p.w + 22 &&
                    feet > p.y - 4 && feet < p.y + p.h + 10) {
                    p.squash = 1;
                    bounce(p.springy ? BOUNCE_SPRING : BOUNCE);
                    addSquirt(s.px, p.y);
                    if (p.springy) { addSquirt(s.px + 10, p.y); }
                    break;
                }
            }
        }

        // score: track the highest point reached
        var climbed = Math.max(0, Math.round((H - 120 - s.py) / 10));
        if (climbed > s.score) { s.score = climbed; }
        if (s.score > s.best) {
            s.best = s.score;
            try {
                localStorage.setItem('hdmj-high', String(s.best));
            } catch (e) { /* storage unavailable; score still counts in-session */ }
        }

        // camera: keep the player in the upper part of the screen
        var target = H * 0.4;
        if (s.py < target) {
            var shift = target - s.py;
            s.py = target;
            s.worldY += shift;
            for (i = 0; i < s.platforms.length; i++) {
                s.platforms[i].y += shift;
            }
            s.nextY += shift;
        }

        // spawn more platforms and prune the ones far below
        while (s.nextY > -40) { spawnPlatform(); }
        s.platforms = s.platforms.filter(function (p) { return p.y < H + 80; });

        // mustard particles
        for (i = s.squirts.length - 1; i >= 0; i--) {
            var q = s.squirts[i];
            q.life -= dt;
            if (q.life <= 0) { s.squirts.splice(i, 1); continue; }
            q.vy += GRAVITY * 0.4 * dt;
            q.x += q.vx * dt;
            q.y += q.vy * dt;
        }

        // game over: fell below the screen
        if (s.py > H + 60) {
            s.over = true;
        }
    }

    function drawHotDog(x, y) {
        var s = state;
        var lean = Math.max(-0.3, Math.min(0.3, s.vx / MOVE_MAX * 0.5));
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(lean);
        // bun (bottom)
        ctx.fillStyle = '#f2b25c';
        roundRect(-26, 2, 52, 20, 10);
        // sausage
        ctx.fillStyle = '#e0623d';
        roundRect(-28, -10, 56, 16, 8);
        // bun (top)
        ctx.fillStyle = '#f7c877';
        roundRect(-24, -22, 48, 16, 8);
        // mustard zigzag
        ctx.strokeStyle = '#f5d327';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-20, -4);
        ctx.lineTo(-12, -8);
        ctx.lineTo(-4, -4);
        ctx.lineTo(4, -8);
        ctx.lineTo(12, -4);
        ctx.lineTo(20, -8);
        ctx.stroke();
        // face
        ctx.fillStyle = '#2b2b40';
        ctx.beginPath();
        ctx.arc(-8, -1, 2.2, 0, Math.PI * 2);
        ctx.arc(8, -1, 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, 3, 5, 0.15 * Math.PI, 0.85 * Math.PI);
        ctx.strokeStyle = '#2b2b40';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
    }

    function roundRect(x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
        ctx.fill();
    }

    function drawMarshmallow(p) {
        var squash = Math.max(0, p.squash);
        var w = p.w + squash * 14;
        var h = p.h - squash * 8;
        var x = p.x - (w - p.w) / 2;
        var y = p.y + (p.h - h);
        ctx.fillStyle = p.springy ? '#ffcf7a' : '#ffffff';
        roundRect(x, y, w, h, 9);
        // toasted top for springy ones
        if (p.springy) {
            ctx.fillStyle = '#d98a3d';
            roundRect(x + 6, y + 3, w - 12, 5, 3);
        } else {
            ctx.fillStyle = '#f0f0f8';
            roundRect(x + 6, y + h - 8, w - 12, 4, 2);
        }
    }

    function draw() {
        var s = state;
        var grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, SKY_TOP);
        grad.addColorStop(1, SKY_BOTTOM);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);

        // drifting sprinkles for a soft candy feel
        ctx.save();
        for (var k = 0; k < 18; k++) {
            var sx = (k * 97 + Math.floor(s.worldY / 6)) % W;
            var sy = (k * 211 + s.worldY * 0.5) % (H + 40) - 20;
            ctx.fillStyle = ['#ff8fa3', '#ffd166', '#9bf6ff', '#caffbf'][k % 4];
            ctx.globalAlpha = 0.5;
            ctx.fillRect(sx, sy, 6, 3);
        }
        ctx.restore();

        var i;
        for (i = 0; i < s.squirts.length; i++) {
            var q = s.squirts[i];
            ctx.globalAlpha = Math.max(0, q.life * 2);
            ctx.fillStyle = '#f5d327';
            ctx.fillRect(q.x, q.y, 5, 5);
            ctx.globalAlpha = 1;
        }

        for (i = 0; i < s.platforms.length; i++) {
            drawMarshmallow(s.platforms[i]);
        }
        drawHotDog(s.px, s.py);

        // score
        ctx.fillStyle = 'rgba(43,43,64,0.85)';
        roundRect(10, 10, 150, 58, 10);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 16px Verdana, sans-serif';
        ctx.fillText('Score: ' + s.score, 22, 34);
        ctx.font = '13px Verdana, sans-serif';
        ctx.fillText('Best: ' + s.best, 22, 56);

        // game over panel
        if (s.over) {
            ctx.fillStyle = 'rgba(43,43,64,0.82)';
            ctx.fillRect(0, 0, W, H);
            ctx.fillStyle = '#ffd166';
            ctx.font = 'bold 30px Verdana, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Game Over!', W / 2, H / 2 - 40);
            ctx.fillStyle = '#fff';
            ctx.font = '18px Verdana, sans-serif';
            ctx.fillText('Score: ' + s.score, W / 2, H / 2);
            ctx.fillText('Best: ' + s.best, W / 2, H / 2 + 28);
            ctx.font = '15px Verdana, sans-serif';
            ctx.fillText('Tap or press Space to play again', W / 2, H / 2 + 64);
            ctx.textAlign = 'left';
        }
    }

    function loop(ts) {
        if (!state) { newGame(); }
        if (!state.lastTs) { state.lastTs = ts; }
        var dt = Math.min((ts - state.lastTs) / 1000, 0.05);
        state.lastTs = ts;
        update(dt);
        draw();
        window.requestAnimationFrame(loop);
    }

    function restartIfOver() {
        if (state && state.over) { newGame(); }
    }

    document.addEventListener('keydown', function (e) {
        var k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
        keys[k] = true;
        if (k === 'ArrowLeft' || k === 'ArrowRight') { e.preventDefault(); }
        if (k === ' ') { restartIfOver(); e.preventDefault(); }
    });
    document.addEventListener('keyup', function (e) {
        var k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
        keys[k] = false;
    });

    function touchPos(e) {
        var rect = canvas.getBoundingClientRect();
        return (e.touches[0].clientX - rect.left) * (W / rect.width);
    }

    canvas.addEventListener('touchstart', function (e) {
        restartIfOver();
        touchTargetX = touchPos(e);
        e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchmove', function (e) {
        touchTargetX = touchPos(e);
        e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchend', function () {
        touchTargetX = null;
    });
    canvas.addEventListener('mousedown', function () {
        restartIfOver();
    });

    window.requestAnimationFrame(loop);
})();
