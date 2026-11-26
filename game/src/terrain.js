// SENJA AIR — terrain: one island map, two airstrips, a village, a
// lighthouse, palms, and the ring course. All textures are procedural
// canvases; no image files. groundHeight(x,z) is the single source of
// truth for the flight model, the aircraft placement and the rings.
import * as THREE from 'three';

export const ISLAND_R = 420;
export const STRIP_A = { x: -260, z: 60, heading: Math.PI / 2, length: 150, width: 16 };
export const STRIP_B = { x: 250, z: -120, heading: -Math.PI / 2 + 0.35, length: 130, width: 16 };

// Deterministic hash noise so the island is identical every load.
function hash2(x, z) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function smoothNoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash2(xi, zi), b = hash2(xi + 1, zi), c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, z) {
  return smoothNoise(x, z) * 0.55 + smoothNoise(x * 2.3, z * 2.3) * 0.3 + smoothNoise(x * 5.1, z * 5.1) * 0.15;
}

export function groundHeight(x, z) {
  const d = Math.hypot(x, z);
  if (d > ISLAND_R) return -6; // sea floor, well below the water plane
  const coast = Math.max(0, 1 - Math.pow(d / ISLAND_R, 3));
  // A ridge spine running north-east, a hill by the lighthouse, gentle centre.
  const ridge = Math.exp(-Math.pow((x * 0.5 + z * 0.86 + 60) / 90, 2)) * 20;
  const hill = Math.exp(-(Math.pow(x - 120, 2) + Math.pow(z + 190, 2)) / (2 * 90 * 90)) * 34;
  let h = 2 + fbm(x * 0.012, z * 0.012) * 14 * coast + ridge * coast + hill;
  // Flatten both runways so landings are fair.
  for (const s of [STRIP_A, STRIP_B]) {
    const dx = x - s.x, dz = z - s.z;
    // Strip axis is (sin h, cos h); along is the dot with the axis.
    const along = Math.abs(dx * Math.sin(s.heading) + dz * Math.cos(s.heading));
    const across = Math.abs(dx * Math.cos(s.heading) - dz * Math.sin(s.heading));
    if (along < s.length / 2 + 30 && across < s.width / 2 + 26) {
      const t = Math.min(1, Math.max(0, (along - s.length / 2) / 30 + (across - s.width / 2) / 26));
      h = h * t + 3.2 * (1 - t);
    }
  }
  return h;
}

function canvasTexture(size, painter) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  painter(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function grassTexture() {
  return canvasTexture(512, (g, s) => {
    g.fillStyle = '#5d8a3c'; g.fillRect(0, 0, s, s);
    // Meadow patches: ochre dry grass, deep green scrub, sandy specks.
    const patches = [['#7fae4e', 260], ['#8a9a3f', 200], ['#4c7a33', 220], ['#b59a55', 90], ['#6b8f3e', 300]];
    for (const [col, n] of patches) {
      g.fillStyle = col;
      for (let i = 0; i < n; i++) {
        const x = hash2(i, 7) * s, y = hash2(i, 13) * s, r = 4 + hash2(i, 29) * 22;
        g.beginPath(); g.ellipse(x, y, r, r * 0.6, hash2(i, 3) * 3, 0, Math.PI * 2); g.fill();
      }
    }
    g.strokeStyle = 'rgba(60,90,35,0.5)';
    for (let i = 0; i < 900; i++) {
      const x = hash2(i, 41) * s, y = hash2(i, 43) * s;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + 3, y - 6); g.stroke();
    }
  });
}

function sandTexture() {
  return canvasTexture(256, (g, s) => {
    g.fillStyle = '#e0c184'; g.fillRect(0, 0, s, s);
    g.fillStyle = '#d4af6e';
    for (let i = 0; i < 260; i++) {
      g.beginPath(); g.arc(hash2(i, 5) * s, hash2(i, 11) * s, 1 + hash2(i, 17) * 4, 0, Math.PI * 2); g.fill();
    }
  });
}

function asphaltTexture() {
  return canvasTexture(256, (g, s) => {
    g.fillStyle = '#3a3f47'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 1400; i++) {
      g.fillStyle = hash2(i, 2) > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.12)';
      g.fillRect(hash2(i, 3) * s, hash2(i, 7) * s, 2, 2);
    }
    // Centreline dashes + edge lines, drawn along the texture's long axis.
    g.fillStyle = '#f5d76e';
    for (let y = 8; y < s; y += 32) g.fillRect(s / 2 - 3, y, 6, 18);
    g.fillStyle = '#e8e8e8';
    g.fillRect(6, 0, 4, s); g.fillRect(s - 10, 0, 4, s);
  });
}

function roofTexture(base, line) {
  return canvasTexture(128, (g, s) => {
    g.fillStyle = base; g.fillRect(0, 0, s, s);
    g.strokeStyle = line; g.lineWidth = 3;
    for (let y = 0; y < s; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(s, y); g.stroke(); }
  });
}

const MAT = {};
export function buildTerrain(scene) {
  MAT.grass = new THREE.MeshStandardMaterial({ map: grassTexture(), roughness: 0.95, metalness: 0 });
  MAT.sand = new THREE.MeshStandardMaterial({ map: sandTexture(), roughness: 1, metalness: 0 });
  MAT.asphalt = new THREE.MeshStandardMaterial({ map: asphaltTexture(), roughness: 0.9, metalness: 0.05 });
  MAT.rock = new THREE.MeshStandardMaterial({ color: 0x8a7a68, roughness: 1, flatShading: true });
  MAT.wood = new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 0.9 });
  MAT.white = new THREE.MeshStandardMaterial({ color: 0xf5efe2, roughness: 0.85 });
  MAT.terracotta = new THREE.MeshStandardMaterial({ map: roofTexture('#c65a33', '#9c3f20'), roughness: 0.9 });
  MAT.tealRoof = new THREE.MeshStandardMaterial({ map: roofTexture('#2e7f7a', '#1d5a56'), roughness: 0.9 });
  MAT.ochreRoof = new THREE.MeshStandardMaterial({ map: roofTexture('#d9a441', '#a87a22'), roughness: 0.9 });
  MAT.glass = new THREE.MeshStandardMaterial({ color: 0x9fd8ef, roughness: 0.15, metalness: 0.4, emissive: 0x223344, emissiveIntensity: 0.4 });
  MAT.leaf = new THREE.MeshStandardMaterial({ color: 0x3f7a2e, roughness: 1, flatShading: true });
  MAT.trunk = new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 1 });
  MAT.red = new THREE.MeshStandardMaterial({ color: 0xc23b2e, roughness: 0.7 });
  MAT.orange = new THREE.MeshStandardMaterial({ color: 0xff7a2a, roughness: 0.6 });
  MAT.cream = new THREE.MeshStandardMaterial({ color: 0xf2e3c2, roughness: 0.7 });

  const group = new THREE.Group();
  group.name = 'terrain';

  // Sea: big teal plane with a gentle normal ripple via vertex waves in the
  // render loop (kept cheap: 48x48 segments, positions nudged per frame).
  const seaGeo = new THREE.PlaneGeometry(2600, 2600, 48, 48);
  seaGeo.rotateX(-Math.PI / 2);
  const seaMat = new THREE.MeshStandardMaterial({ color: 0x1e7d8c, roughness: 0.25, metalness: 0.35 });
  const sea = new THREE.Mesh(seaGeo, seaMat);
  sea.position.y = 0.4;
  sea.name = 'sea';
  group.add(sea);

  // Island: a finely segmented plane, every vertex displaced by
  // groundHeight — a CircleGeometry fan would stay flat inside the rim.
  const isoGeo = new THREE.PlaneGeometry((ISLAND_R + 40) * 2, (ISLAND_R + 40) * 2, 128, 128);
  isoGeo.rotateX(-Math.PI / 2);
  const pos = isoGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setY(i, groundHeight(x, z));
  }
  isoGeo.computeVertexNormals();
  const island = new THREE.Mesh(isoGeo, MAT.grass);
  island.name = 'island';
  group.add(island);
  // Beach ring: a sand annulus hugging the coast, draped over the terrain.
  const beachGeo = new THREE.RingGeometry(ISLAND_R - 26, ISLAND_R + 6, 96, 1);
  beachGeo.rotateX(-Math.PI / 2);
  const bpos = beachGeo.attributes.position;
  for (let i = 0; i < bpos.count; i++) {
    const x = bpos.getX(i), z = bpos.getZ(i);
    bpos.setY(i, Math.max(0.8, groundHeight(x, z) + 0.35));
  }
  beachGeo.computeVertexNormals();
  const beach = new THREE.Mesh(beachGeo, MAT.sand);
  group.add(beach);

  // Rocky outcrops on the ridge for scale and silhouette.
  for (let i = 0; i < 20; i++) {
    const a = hash2(i, 71) * Math.PI * 2, r = 120 + hash2(i, 73) * 220;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(4 + hash2(i, 79) * 9, 0), MAT.rock);
    rock.position.set(x, groundHeight(x, z) + 2, z);
    rock.rotation.set(hash2(i, 83), hash2(i, 89), hash2(i, 97));
    rock.scale.y = 0.7;
    group.add(rock);
  }

  // Palms: curved trunk (stacked cylinders) + 6 fronds, instanced by hand.
  const palmSpots = [];
  for (let i = 0; i < 60; i++) {
    const a = hash2(i, 101) * Math.PI * 2, r = 90 + hash2(i, 103) * 300;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (nearStrip(x, z, 26)) continue;
    palmSpots.push([x, z]);
  }
  for (const [x, z] of palmSpots) buildPalm(group, x, groundHeight(x, z), z);
  // Coastal palm clusters: along the west beach the coast shot flies, and
  // around the lighthouse hamlet — never on a runway, never in the sea.
  for (let i = 0; i < 12; i++) {
    const x = -368 - hash2(i, 213) * 18;
    const z = -150 + i * 25 + hash2(i, 215) * 8;
    if (Math.hypot(x, z) > 405 || nearStrip(x, z, 26)) continue;
    buildPalm(group, x, groundHeight(x, z), z);
  }
  for (let i = 0; i < 6; i++) {
    const x = 150 + hash2(i, 221) * 70;
    const z = -235 + hash2(i, 223) * 70;
    if (nearStrip(x, z, 26)) continue;
    buildPalm(group, x, groundHeight(x, z), z);
  }

  // Runways + props.
  const strips = [];
  for (const s of [STRIP_A, STRIP_B]) strips.push(buildStrip(group, s));
  buildVillage(group, 40, 180, 16);
  buildVillage(group, -330, -60, 8); // west-coast fishing hamlet (coast shot)
  buildVillage(group, 185, -195, 6); // hillside hamlet by the lighthouse (landing shot)
  buildLighthouse(group, 120, -190);
  buildWindmill(group, 120, 150); // cover shot: ahead-right of the ring run
  buildHangar(group, STRIP_A);
  // West-coast working waterfront: fishing boats, a wooden pier, buoys.
  buildBoat(group, -455, -30, 0.6);
  buildBoat(group, -475, -110, 2.4);
  buildBoat(group, -445, 45, 1.3);
  buildPier(group, -405, -60);
  for (const [bx, bz] of [[-452, -60], [-470, 10], [-440, -150], [-458, 95]]) buildBuoy(group, bx, bz);

  scene.add(group);
  return { group, sea, strips, groundHeight };
}

function nearStrip(x, z, pad) {
  for (const s of [STRIP_A, STRIP_B]) {
    const dx = x - s.x, dz = z - s.z;
    const along = Math.abs(dx * Math.sin(s.heading) + dz * Math.cos(s.heading));
    const across = Math.abs(dx * Math.cos(s.heading) - dz * Math.sin(s.heading));
    if (along < s.length / 2 + pad && across < s.width / 2 + pad) return true;
  }
  return false;
}

function buildPalm(group, x, y, z) {
  const palm = new THREE.Group();
  const h = 7 + hash2(x, z) * 4;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.7, h, 7), MAT.trunk);
  trunk.position.y = h / 2; trunk.rotation.z = 0.12;
  palm.add(trunk);
  for (let i = 0; i < 7; i++) {
    const frond = new THREE.Mesh(new THREE.ConeGeometry(1.25, 6.5, 4), MAT.leaf);
    const a = i / 7 * Math.PI * 2;
    frond.position.set(Math.cos(a) * 2.4, h + 0.5, Math.sin(a) * 2.4);
    frond.rotation.set(Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1);
    frond.scale.set(1, 1, 0.22);
    palm.add(frond);
  }
  const nuts = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), MAT.wood);
  nuts.position.y = h - 0.3; palm.add(nuts);
  palm.position.set(x, y, z);
  group.add(palm);
}

function buildStrip(group, s) {
  const g = new THREE.Group();
  const y = 3.3;
  const tex = MAT.asphalt.map.clone();
  tex.needsUpdate = true;
  tex.repeat.set(1, s.length / 16);
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, metalness: 0.05 });
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(s.width, s.length), mat);
  strip.rotation.x = -Math.PI / 2; strip.rotation.z = -s.heading;
  strip.position.set(s.x, y, s.z);
  g.add(strip);
  // Threshold numbers: big white "A" / "B" painted as canvas sprite planes.
  const num = makeTextSprite(s === STRIP_A ? 'A' : 'B', 64, '#ffffff');
  num.position.set(s.x, y + 0.2, s.z);
  num.rotation.x = -Math.PI / 2; num.rotation.z = -s.heading;
  num.scale.set(14, 14, 1);
  g.add(num);
  // Edge lights: small warm-glowing spheres along both edges.
  const lightMat = new THREE.MeshStandardMaterial({ color: 0xffc46e, emissive: 0xff9a2a, emissiveIntensity: 1.6 });
  // Edge lights: along the strip axis (sin/cos of heading), offset to both sides.
  const ax = Math.sin(s.heading), az = Math.cos(s.heading);
  const px = Math.cos(s.heading), pz = -Math.sin(s.heading);
  for (let i = -6; i <= 6; i++) {
    for (const side of [-1, 1]) {
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), lightMat);
      bulb.position.set(
        s.x + ax * i * 11 + px * side * (s.width / 2 + 1.2),
        y + 0.6,
        s.z + az * i * 11 + pz * side * (s.width / 2 + 1.2));
      g.add(bulb);
    }
  }
  // Windsock near the threshold.
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 7, 6), MAT.wood);
  pole.position.set(s.x + 22, y + 3.5, s.z + 18);
  g.add(pole);
  const sock = new THREE.Mesh(new THREE.ConeGeometry(0.9, 3.2, 8), MAT.red);
  sock.rotation.z = Math.PI / 2 - 0.35;
  sock.position.set(s.x + 23.5, y + 6.6, s.z + 18);
  g.add(sock);
  group.add(g);
  return { def: s, group: g };
}

function makeTextSprite(text, px, color) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(0,0,0,0)';
  g.clearRect(0, 0, 128, 128);
  g.fillStyle = color; g.font = `bold ${px}px sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 64, 70);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
  return m;
}

function buildVillage(group, cx, cz, count = 12) {
  // A dozen houses with distinct rooflines and palettes, aligned window grids.
  const roofs = [MAT.terracotta, MAT.tealRoof, MAT.ochreRoof];
  const walls = [MAT.white, MAT.cream, new THREE.MeshStandardMaterial({ color: 0xe8c9a0, roughness: 0.9 })];
  const winMat = new THREE.MeshStandardMaterial({ color: 0x2c4a66, roughness: 0.2, metalness: 0.3, emissive: 0xffb35c, emissiveIntensity: 0.55 });
  for (let i = 0; i < count; i++) {
    const gx = (i % 4) * 22 - 30, gz = Math.floor(i / 4) * 24 - 24;
    const x = cx + gx + hash2(i, 131) * 6, z = cz + gz + hash2(i, 137) * 6;
    const y = groundHeight(x, z);
    const house = new THREE.Group();
    const w = 8 + hash2(i, 139) * 4, d = 7 + hash2(i, 141) * 3, h = 4 + hash2(i, 143) * 2;
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), walls[i % 3]);
    body.position.y = h / 2; house.add(body);
    // Gable roof: a triangular prism made from a cylinder with 3 segments.
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.01, w * 0.72, d + 1.5, 4, 1), roofs[i % 3]);
    roof.rotation.y = Math.PI / 4; roof.rotation.z = Math.PI / 2;
    roof.scale.set(1, 1, 0.62);
    roof.position.y = h + d * 0.28;
    house.add(roof);
    // Windows: aligned 2x1 grid on the front face, never scattered.
    for (let wx = -1; wx <= 1; wx += 2) {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.6), winMat);
      win.position.set(wx * w * 0.26, h * 0.55, d / 2 + 0.06);
      house.add(win);
    }
    const door = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.6), MAT.wood);
    door.position.set(0, 1.3, d / 2 + 0.06);
    house.add(door);
    house.position.set(x, y, z);
    house.rotation.y = hash2(i, 149) * 0.6 - 0.3;
    group.add(house);
  }
}

function buildLighthouse(group, x, z) {
  const y = groundHeight(x, z);
  const g = new THREE.Group();
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3.2, 26, 12), MAT.white);
  tower.position.y = 13; g.add(tower);
  for (let i = 0; i < 3; i++) {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(2.75 - i * 0.25, 2.9 - i * 0.25, 2.2, 12), MAT.red);
    band.position.y = 6 + i * 7; g.add(band);
  }
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffc23c, emissiveIntensity: 2.2 });
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(1.6, 12, 10), lampMat);
  lamp.position.y = 27.5; g.add(lamp);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(2.6, 3, 12), MAT.red);
  cap.position.y = 30; g.add(cap);
  g.position.set(x, y, z);
  group.add(g);
}

function buildHangar(group, strip) {
  const x = strip.x - 34, z = strip.z + 34;
  const y = groundHeight(x, z);
  const g = new THREE.Group();
  // Arched hangar: half-cylinder shell + end wall + big door.
  const shell = new THREE.Mesh(
    new THREE.CylinderGeometry(11, 11, 22, 16, 1, true, 0, Math.PI), MAT.tealRoof);
  shell.rotation.z = Math.PI / 2; shell.rotation.y = Math.PI / 2;
  shell.position.y = 0.5; g.add(shell);
  const door = new THREE.Mesh(new THREE.PlaneGeometry(18, 9),
    new THREE.MeshStandardMaterial({ color: 0x3a4a5a, roughness: 0.6, metalness: 0.4 }));
  door.position.set(0, 4.5, 11.1); g.add(door);
  // Fuel drums and crates beside it.
  for (let i = 0; i < 4; i++) {
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 2.2, 10), i % 2 ? MAT.red : MAT.cream);
    drum.position.set(13 + (i % 2) * 2.2, 1.1, -6 + Math.floor(i / 2) * 2.4);
    g.add(drum);
  }
  g.position.set(x, y, z);
  g.rotation.y = strip.heading;
  group.add(g);
}

function buildWindmill(group, x, z) {
  // Cream tower, terracotta cap, four wood blades facing the sea breeze —
  // the cover shot's mid-ground landmark, same palette as the village.
  const y = groundHeight(x, z);
  const g = new THREE.Group();
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 2.9, 15, 10), MAT.cream);
  tower.position.y = 7.5; g.add(tower);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(2.3, 3.4, 10), MAT.terracotta);
  cap.position.y = 16.6; g.add(cap);
  const winMat = new THREE.MeshStandardMaterial({ color: 0x2c4a66, roughness: 0.2, metalness: 0.3, emissive: 0xffb35c, emissiveIntensity: 0.55 });
  for (const wy of [5, 10]) {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.4), winMat);
    win.position.set(0, wy, 2.35 - wy * 0.04);
    win.rotation.x = -0.08;
    g.add(win);
  }
  const door = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.6), MAT.wood);
  door.position.set(0, 1.3, 2.9);
  g.add(door);
  // Blades on the west face, turning into the sunset wind.
  const blades = new THREE.Group();
  blades.position.set(-2.4, 14.5, 0);
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.7, 10, 8), MAT.wood);
  blades.add(hub);
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2 + 0.5;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.18, 7.5, 0.55), MAT.wood);
    blade.position.set(0, Math.cos(a) * 3.6, Math.sin(a) * 3.6);
    blade.rotation.x = a;
    blades.add(blade);
    const sail = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 6.2), MAT.cream);
    sail.position.set(-0.15, Math.cos(a) * 3.6, Math.sin(a) * 3.6);
    sail.rotation.x = a;
    sail.rotation.y = -Math.PI / 2;
    blades.add(sail);
  }
  g.add(blades);
  g.position.set(x, y, z);
  g.rotation.y = 0.6;
  group.add(g);
}

function buildBoat(group, x, z, rot) {
  // Little wooden fishing boat at anchor: rounded hull, mast, cream sail.
  const g = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.SphereGeometry(1.4, 12, 8), MAT.wood);
  hull.scale.set(1, 0.55, 2.6);
  hull.position.y = 0.35;
  g.add(hull);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.14, 6, 14), MAT.trunk);
  rim.rotation.x = Math.PI / 2;
  rim.scale.set(1, 2.6, 1);
  rim.position.y = 0.75;
  g.add(rim);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 6.5, 6), MAT.trunk);
  mast.position.y = 3.6;
  g.add(mast);
  const sail = new THREE.Mesh(new THREE.ConeGeometry(1.9, 4.6, 4), MAT.white);
  sail.scale.set(1, 1, 0.28);
  sail.rotation.y = Math.PI / 4;
  sail.position.y = 4.4;
  g.add(sail);
  const flag = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.9, 6), MAT.red);
  flag.rotation.z = -Math.PI / 2;
  flag.position.set(0.5, 6.8, 0);
  g.add(flag);
  g.position.set(x, 0.55, z);
  g.rotation.y = rot;
  group.add(g);
}

function buildPier(group, x, z) {
  // Wooden pier from the beach into the sea, posts down into the water,
  // a couple of crates waiting at the root.
  const g = new THREE.Group();
  const deck = new THREE.Mesh(new THREE.BoxGeometry(46, 0.45, 4.2), MAT.wood);
  deck.position.y = 1.5;
  g.add(deck);
  for (const px of [-21, -14, -7, 0, 7, 14, 21]) {
    for (const pz of [-1.7, 1.7]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 2.8, 6), MAT.trunk);
      post.position.set(px, 0.4, pz);
      g.add(post);
    }
  }
  for (const [cx, cz, s] of [[-19, 0.8, 1.3], [-17.4, -0.9, 1.0]]) {
    const crate = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), MAT.cream);
    crate.position.set(cx, 1.7 + s / 2, cz);
    crate.rotation.y = 0.4;
    g.add(crate);
  }
  g.position.set(x, 0, z);
  group.add(g);
}

function buildBuoy(group, x, z) {
  // Sunset-orange marker buoy bobbing on the teal sea.
  const g = new THREE.Group();
  const float = new THREE.Mesh(new THREE.SphereGeometry(0.9, 10, 8), MAT.orange);
  float.position.y = 0.9;
  g.add(float);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.1, 8), MAT.red);
  tip.position.y = 2.1;
  g.add(tip);
  g.position.set(x, 0, z);
  group.add(g);
}
