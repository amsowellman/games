// Soccer Stars - procedural character builders.
// Each player is a THREE.Group (origin at the feet, facing +Z toward the
// camera) assembled from box, sphere and cylinder primitives only.

const Characters = {

    // --- primitive helpers -------------------------------------------------
    _mat(color) {
        return new THREE.MeshLambertMaterial({ color: color });
    },

    _box(w, h, d, color, x, y, z) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this._mat(color));
        m.position.set(x || 0, y || 0, z || 0);
        return m;
    },

    _sphere(r, color, x, y, z, sx, sy, sz) {
        const m = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 14), this._mat(color));
        m.position.set(x || 0, y || 0, z || 0);
        if (sx !== undefined) m.scale.set(sx, sy, sz);
        return m;
    },

    _cyl(rt, rb, h, color, x, y, z, rx, rz) {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 14), this._mat(color));
        m.position.set(x || 0, y || 0, z || 0);
        if (rx) m.rotation.x = rx;
        if (rz) m.rotation.z = rz;
        return m;
    },

    // Shared lower body: shoes, legs, shorts and jersey torso + arms.
    _kit(skin, jersey, shorts) {
        const g = new THREE.Group();
        // shoes
        g.add(this._box(0.2, 0.1, 0.3, 0xffffff, -0.15, 0.05, 0.04));
        g.add(this._box(0.2, 0.1, 0.3, 0xffffff,  0.15, 0.05, 0.04));
        // legs
        g.add(this._box(0.15, 0.42, 0.16, skin, -0.15, 0.31, 0));
        g.add(this._box(0.15, 0.42, 0.16, skin,  0.15, 0.31, 0));
        // shorts
        g.add(this._box(0.52, 0.22, 0.3, shorts, 0, 0.6, 0));
        // jersey torso
        g.add(this._box(0.6, 0.5, 0.32, jersey, 0, 0.96, 0));
        // jersey stripe
        g.add(this._box(0.6, 0.08, 0.34, 0xffffff, 0, 1.12, 0));
        // arms
        g.add(this._box(0.13, 0.42, 0.14, jersey, -0.38, 0.98, 0));
        g.add(this._box(0.13, 0.42, 0.14, jersey,  0.38, 0.98, 0));
        return g;
    },

    _eyes(head, dx, dy, dz, sep) {
        head.add(this._sphere(0.05, 0xffffff, -sep, dy, dz));
        head.add(this._sphere(0.05, 0xffffff,  sep, dy, dz));
        head.add(this._sphere(0.022, 0x1a1a1a, -sep, dy, dz + 0.035));
        head.add(this._sphere(0.022, 0x1a1a1a,  sep, dy, dz + 0.035));
    },

    // --- the four stars ----------------------------------------------------

    buildLion() {
        const fur = 0xd99a2b, mane = 0x8a5a1a, muzzle = 0xf0cd8a;
        const g = this._kit(fur, 0xe04b2a, 0x7a1f10);
        const head = new THREE.Group();
        head.position.set(0, 1.52, 0);
        // mane: a flattened disc of fur behind the face
        head.add(this._sphere(0.36, mane, 0, 0, -0.06, 1, 1.08, 0.55));
        // face
        head.add(this._sphere(0.24, fur, 0, 0, 0.1));
        // ears poking out of the mane
        head.add(this._sphere(0.08, fur, -0.18, 0.26, 0));
        head.add(this._sphere(0.08, fur,  0.18, 0.26, 0));
        // muzzle + nose
        head.add(this._sphere(0.1, muzzle, 0, -0.08, 0.3));
        head.add(this._sphere(0.035, 0x3a2415, 0, -0.04, 0.39));
        this._eyes(head, 0, 0.06, 0.3, 0.1);
        g.add(head);
        return g;
    },

    buildHyena() {
        const fur = 0x9a8f7d, dark = 0x5e564a, muzzle = 0x6e6455;
        const g = this._kit(fur, 0x7a4fd0, 0x33255a);
        // sloped, hunched back: tilt the whole kit forward and add a
        // shaggy shoulder hump so the silhouette reads "hyena" head-on.
        g.rotation.x = 0.12;
        const hump = this._sphere(0.24, dark, 0, 1.28, -0.12, 1.1, 0.7, 0.8);
        g.add(hump);
        // spots on the jersey
        g.add(this._sphere(0.045, dark, -0.18, 0.9, 0.17));
        g.add(this._sphere(0.045, dark,  0.14, 1.02, 0.17));
        g.add(this._sphere(0.045, dark,  0.02, 0.84, 0.17));
        g.add(this._sphere(0.045, dark,  0.22, 0.88, 0.17));
        const head = new THREE.Group();
        head.position.set(0, 1.42, 0.12);
        head.add(this._sphere(0.22, fur, 0, 0, 0));
        // big round ears
        head.add(this._sphere(0.11, fur, -0.16, 0.2, 0, 1, 1, 0.5));
        head.add(this._sphere(0.11, fur,  0.16, 0.2, 0, 1, 1, 0.5));
        head.add(this._sphere(0.06, dark, -0.16, 0.2, 0.05, 1, 1, 0.4));
        head.add(this._sphere(0.06, dark,  0.16, 0.2, 0.05, 1, 1, 0.4));
        // spiky head tuft
        head.add(this._box(0.06, 0.14, 0.06, dark, 0, 0.24, -0.02));
        head.add(this._box(0.06, 0.11, 0.06, dark, -0.08, 0.22, -0.02));
        head.add(this._box(0.06, 0.11, 0.06, dark, 0.08, 0.22, -0.02));
        // long dark muzzle
        head.add(this._sphere(0.09, muzzle, 0, -0.06, 0.22, 1, 0.85, 1.2));
        head.add(this._sphere(0.035, 0x1a1a1a, 0, -0.03, 0.33));
        this._eyes(head, 0, 0.05, 0.19, 0.09);
        g.add(head);
        return g;
    },

    buildGiraffe() {
        const fur = 0xe8c552, spot = 0xa8722e, muzzle = 0xd9b45c;
        const g = this._kit(fur, 0x2a9de0, 0x144a70);
        // torso spots
        g.add(this._sphere(0.05, spot, -0.16, 1.0, 0.17));
        g.add(this._sphere(0.05, spot,  0.12, 0.88, 0.17));
        g.add(this._sphere(0.05, spot,  0.2, 1.08, 0.17));
        // the famous neck
        const neck = this._cyl(0.09, 0.11, 0.7, fur, 0, 1.55, 0);
        g.add(neck);
        g.add(this._sphere(0.045, spot, 0.05, 1.5, 0.1));
        g.add(this._sphere(0.045, spot, -0.06, 1.68, 0.1));
        const head = new THREE.Group();
        head.position.set(0, 1.98, 0.04);
        head.add(this._box(0.24, 0.2, 0.26, fur, 0, 0, 0));
        head.add(this._box(0.16, 0.12, 0.14, muzzle, 0, -0.04, 0.18));
        head.add(this._sphere(0.025, 0x3a2415, -0.04, -0.02, 0.26));
        head.add(this._sphere(0.025, 0x3a2415,  0.04, -0.02, 0.26));
        // ossicones
        head.add(this._cyl(0.02, 0.02, 0.12, spot, -0.07, 0.16, 0));
        head.add(this._cyl(0.02, 0.02, 0.12, spot,  0.07, 0.16, 0));
        head.add(this._sphere(0.035, spot, -0.07, 0.23, 0));
        head.add(this._sphere(0.035, spot,  0.07, 0.23, 0));
        // ears
        head.add(this._sphere(0.07, fur, -0.16, 0.08, 0, 1.4, 0.7, 0.5));
        head.add(this._sphere(0.07, fur,  0.16, 0.08, 0, 1.4, 0.7, 0.5));
        this._eyes(head, 0, 0.03, 0.14, 0.09);
        g.add(head);
        return g;
    },

    buildElephant() {
        const skin = 0x9aa3ad, inner = 0xc3ccd4;
        const g = this._kit(skin, 0x2ab06a, 0x14522f);
        const head = new THREE.Group();
        head.position.set(0, 1.5, 0);
        head.add(this._sphere(0.26, skin, 0, 0, 0));
        // huge floppy ears
        head.add(this._sphere(0.22, skin, -0.28, 0.04, -0.02, 0.9, 1.1, 0.35));
        head.add(this._sphere(0.22, skin,  0.28, 0.04, -0.02, 0.9, 1.1, 0.35));
        head.add(this._sphere(0.15, inner, -0.28, 0.04, 0.05, 0.85, 1.05, 0.25));
        head.add(this._sphere(0.15, inner,  0.28, 0.04, 0.05, 0.85, 1.05, 0.25));
        // trunk: two tapering segments curving down and out
        head.add(this._cyl(0.05, 0.065, 0.26, skin, 0, -0.2, 0.24, 0.5, 0));
        head.add(this._cyl(0.035, 0.05, 0.22, skin, 0, -0.4, 0.32, 0.7, 0));
        // tusks (cones = cylinders with a zero top radius)
        head.add(this._cyl(0.0, 0.03, 0.18, 0xf5f0e0, -0.12, -0.14, 0.24, 0.9, 0));
        head.add(this._cyl(0.0, 0.03, 0.18, 0xf5f0e0,  0.12, -0.14, 0.24, 0.9, 0));
        this._eyes(head, 0, 0.08, 0.23, 0.1);
        g.add(head);
        return g;
    },

    build(key) {
        switch (key) {
            case 'hyena':    return this.buildHyena();
            case 'giraffe':  return this.buildGiraffe();
            case 'elephant': return this.buildElephant();
            case 'lion':
            default:         return this.buildLion();
        }
    },

    // --- shared props ------------------------------------------------------

    // A soccer ball: white sphere with black pentagons painted on a canvas.
    soccerBall(radius) {
        radius = radius || 0.5;
        const c = document.createElement('canvas');
        c.width = c.height = 256;
        const g = c.getContext('2d');
        g.fillStyle = '#f2f2ec';
        g.fillRect(0, 0, 256, 256);
        g.fillStyle = '#1c1c1c';
        const spots = [
            [64, 60], [190, 56], [128, 126], [40, 190], [214, 186],
            [110, 226], [166, 20], [20, 120], [236, 112], [86, 150]
        ];
        for (const [cx, cy] of spots) {
            g.beginPath();
            for (let i = 0; i < 5; i++) {
                const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
                const px = cx + Math.cos(a) * 16;
                const py = cy + Math.sin(a) * 16;
                if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
            }
            g.closePath();
            g.fill();
        }
        const tex = new THREE.CanvasTexture(c);
        const ball = new THREE.Mesh(
            new THREE.SphereGeometry(radius, 24, 18),
            new THREE.MeshLambertMaterial({ map: tex })
        );
        return ball;
    },

    // Simple golden trophy for the summit platform.
    trophy() {
        const gold = 0xffd700;
        const g = new THREE.Group();
        g.add(this._cyl(0.3, 0.36, 0.12, gold, 0, 0.06, 0));   // base
        g.add(this._cyl(0.08, 0.12, 0.3, gold, 0, 0.26, 0));   // stem
        g.add(this._cyl(0.34, 0.12, 0.4, gold, 0, 0.6, 0));    // cup
        g.add(this._sphere(0.09, gold, -0.36, 0.62, 0));       // handles
        g.add(this._sphere(0.09, gold,  0.36, 0.62, 0));
        return g;
    }
};
