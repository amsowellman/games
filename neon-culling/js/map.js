/* ============================================================
   map.js — arena geometry, colliders, waypoints, bombsites
   Exposes globals: createMap(), moveWithCollision(), isOpen()
   Coordinate system: x/z ground plane, 80x80 units, y up.
   z < 0 = north (bot side), z > 0 = south (player side).
   ============================================================ */

const MAP_HALF = 40;          // playable area is 80x80
const colliders = [];         // {minX,maxX,minZ,maxZ} AABBs
const mapMini = [];           // collider rects + crate flag, for the minimap
const obstacleMeshes = [];    // meshes bullets can hit (walls/crates)
const mapMeshes = { walls: [], crates: [], floor: null };  // for theme recoloring
let floorMesh = null;
const mapSites = { a: null, b: null };
const mapWaypoints = [];      // safe patrol points for bots
const botSpawns = [];
const playerSpawn = new THREE.Vector3(0, 0, 34);

function addCollider(x, z, w, d) {
  colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
}

/* Is circle (x,z,r) free of colliders? Used for waypoint validation. */
function isOpen(x, z, r) {
  r = r || 0.7;
  for (const c of colliders) {
    if (x + r > c.minX && x - r < c.maxX && z + r > c.minZ && z - r < c.maxZ) return false;
  }
  return true;
}

/* Move a sphere-ish actor (radius r) by dx,dz with axis-separated AABB resolution. */
function moveWithCollision(pos, r, dx, dz) {
  pos.x += dx;
  for (const c of colliders) {
    if (pos.x + r > c.minX && pos.x - r < c.maxX && pos.z + r > c.minZ && pos.z - r < c.maxZ) {
      pos.x = dx > 0 ? c.minX - r : c.maxX + r;
    }
  }
  pos.z += dz;
  for (const c of colliders) {
    if (pos.x + r > c.minX && pos.x - r < c.maxX && pos.z + r > c.minZ && pos.z - r < c.maxZ) {
      pos.z = dz > 0 ? c.minZ - r : c.maxZ + r;
    }
  }
}

function makeBox(scene, x, y, z, w, h, d, color, collide, kind) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = new THREE.MeshLambertMaterial({ color });
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y + h / 2, z);
  m.userData.env = true;
  scene.add(m);
  obstacleMeshes.push(m);
  if (kind === 'crate') mapMeshes.crates.push(m);
  else if (kind === 'wall') mapMeshes.walls.push(m);
  if (collide !== false) {
    addCollider(x, z, w, d);
    mapMini.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2,
      crate: color === 0x8a5a2b });
  }
  return m;
}

function createMap(scene) {
  /* ---- floor ---- */
  const floorGeo = new THREE.PlaneGeometry(MAP_HALF * 2 + 40, MAP_HALF * 2 + 40);
  const floorMat = new THREE.MeshLambertMaterial({ color: 0x33343b });
  floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.userData.env = true;
  scene.add(floorMesh);
  mapMeshes.floor = floorMesh;

  /* ---- perimeter walls (tall, gray) ---- */
  const W = MAP_HALF, T = 1, PH = 6;
  makeBox(scene, 0, 0, -W - T / 2, W * 2 + T * 2, PH, T, 0x75777e, true, 'wall');
  makeBox(scene, 0, 0,  W + T / 2, W * 2 + T * 2, PH, T, 0x75777e, true, 'wall');
  makeBox(scene, -W - T / 2, 0, 0, T, PH, W * 2, 0x75777e, true, 'wall');
  makeBox(scene,  W + T / 2, 0, 0, T, PH, W * 2, 0x75777e, true, 'wall');

  /* ---- interior walls (gray, h=4) ---- */
  const H = 4, WC = 0x82848c;
  // lane dividers west/east (leave an 8u mid-west / mid-east gap)
  makeBox(scene, -12, 0, -18, 1, H, 20, WC, true, 'wall');   // z -28..-8
  makeBox(scene, -12, 0,  18, 1, H, 20, WC, true, 'wall');   // z   8..28
  makeBox(scene,  12, 0, -18, 1, H, 20, WC, true, 'wall');
  makeBox(scene,  12, 0,  18, 1, H, 20, WC, true, 'wall');
  // site south walls with 4u doorways at x=±14
  makeBox(scene, -25, 0, -10, 18, H, 1, WC, true, 'wall');   // x -34..-16
  makeBox(scene,  25, 0, -10, 18, H, 1, WC, true, 'wall');   // x  16..34
  // mid cover chunks
  makeBox(scene, 0, 0,   8, 8, H, 1, WC, true, 'wall');      // blocks spawn-to-spawn sightline
  makeBox(scene, 0, 0, -20, 6, H, 1, WC, true, 'wall');      // mid-north block

  /* ---- crates (brown cover) ---- */
  const CRATE = 0x8a5a2b, CRATE2 = 0x7a4d24, S = 2;
  const crateSpots = [
    [22, -22], [30, -27], [26, -19, true],      // A site (one stacked)
    [-22, -22], [-30, -27], [-26, -19, true],   // B site
    [5, -2], [-5, 16], [0, -32],                // mid
    [-24, 4], [24, 4],                          // west / east lanes
    [-32, -20], [32, -20],                      // site halls
    [7, 26], [-7, 26], [0, -14]                 // south / mid
  ];
  for (const [cx, cz, stacked] of crateSpots) {
    makeBox(scene, cx, 0, cz, S, S, S, CRATE, true, 'crate');
    if (stacked) makeBox(scene, cx, S, cz, S, S, S, CRATE2, false, 'crate');
  }

  /* ---- bombsites (colored floor zones: A red, B blue) ---- */
  function site(cx, cz, color) {
    const g = new THREE.PlaneGeometry(14, 14);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.30, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(cx, 0.03, cz);
    scene.add(m);
    const border = new THREE.Mesh(new THREE.PlaneGeometry(15, 15),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.12, depthWrite: false }));
    border.rotation.x = -Math.PI / 2;
    border.position.set(cx, 0.02, cz);
    scene.add(border);
    return { x: cx, z: cz, size: 14, mesh: m };
  }
  mapSites.a = site(25, -23, 0xff4030);
  mapSites.b = site(-25, -23, 0x3a78ff);

  /* ---- spawns ---- */
  botSpawns.length = 0;
  for (let i = 0; i < 5; i++) botSpawns.push(new THREE.Vector3(-6 + i * 3, 0, -36));

  /* ---- patrol waypoints (validated open) ---- */
  mapWaypoints.length = 0;
  const candidates = [
    [0, 30], [12, 30], [-12, 30], [0, 18], [8, 14], [-8, 14],
    [0, 0], [0, -8], [-20, 0], [20, 0], [-24, -6], [24, -6],
    [26, -24], [16, -24], [-26, -24], [-16, -24],             // sites
    [33, -12], [-33, -12], [0, -34], [8, -34], [-8, -34],
    [30, 20], [-30, 20], [34, -30], [-34, -30]
  ];
  for (const [x, z] of candidates) {
    if (isOpen(x, z, 1.0)) mapWaypoints.push(new THREE.Vector3(x, 0, z));
  }

  /* random open point helper for bot patrol fallback */
  mapWaypoints.randomOpen = function () {
    for (let i = 0; i < 12; i++) {
      const x = (Math.random() * 2 - 1) * (MAP_HALF - 4);
      const z = (Math.random() * 2 - 1) * (MAP_HALF - 4);
      if (isOpen(x, z, 0.9)) return new THREE.Vector3(x, 0, z);
    }
    return mapWaypoints[(Math.random() * mapWaypoints.length) | 0].clone();
  };
}
