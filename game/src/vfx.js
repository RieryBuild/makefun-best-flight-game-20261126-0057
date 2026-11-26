// SENJA AIR — vfx: motion cues so fast flight reads as motion, not a still.
// Two cheap, speed-gated effects in the committed golden-hour palette:
//   - wingtip contrails: world-space ribbons that trail behind the wing
//     tips, widening and warming into haze as they age;
//   - speed lines: short warm streaks rushing past the aircraft in an
//     annulus clear of the wings, so they never cross the plane or the HUD.
// Both are deterministic in ?shot= stills (seeded from the staged pose)
// and fade to nothing below ~18 m/s, on the ground, or at rest.
import * as THREE from 'three';

// Deterministic 0..1 hash — the same streak layout every load.
function hash1(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

// Rotate a plane-local offset into world space for a given heading.
// Heading 0 = +Z (flight-model forward); matches rotation.y = heading.
function headingOffset(heading, lx, ly, lz) {
  const c = Math.cos(heading), s = Math.sin(heading);
  return new THREE.Vector3(lx * c + lz * s, ly, -lx * s + lz * c);
}

const TRAIL_MAX = 42;

export function createContrails(scene) {
  const ribbons = [];
  for (let t = 0; t < 2; t++) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL_MAX * 2 * 3), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(TRAIL_MAX * 2 * 3), 3));
    const idx = [];
    for (let i = 0; i < TRAIL_MAX - 1; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    geo.setIndex(idx);
    geo.setDrawRange(0, 0);
    const mat = new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0.3,
      side: THREE.DoubleSide, depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.name = t === 0 ? 'contrail-port' : 'contrail-starboard';
    scene.add(mesh);
    ribbons.push({ mesh, geo, pts: [] });
  }

  const UP = new THREE.Vector3(0, 1, 0);
  function rebuild(r) {
    const pts = r.pts;
    const pos = r.geo.attributes.position.array;
    const col = r.geo.attributes.color.array;
    const n = pts.length;
    if (n < 2) { r.geo.setDrawRange(0, 0); r.geo.attributes.position.needsUpdate = true; return; }
    const dir = new THREE.Vector3();
    const side = new THREE.Vector3();
    for (let i = 0; i < TRAIL_MAX; i++) {
      const p = pts[Math.min(i, n - 1)];
      const a = pts[Math.max(0, Math.min(i - 1, n - 1))];
      const b = pts[Math.max(0, Math.min(i + 1, n - 1))];
      dir.subVectors(a, b);
      if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1);
      dir.normalize();
      side.crossVectors(dir, UP);
      if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
      side.normalize();
      // The trail widens and warms into haze as it ages.
      const age = i / Math.max(1, n - 1);
      const w = 0.35 + i * 0.035;
      const o = i * 6;
      pos[o] = p.x - side.x * w / 2; pos[o + 1] = p.y - side.y * w / 2; pos[o + 2] = p.z - side.z * w / 2;
      pos[o + 3] = p.x + side.x * w / 2; pos[o + 4] = p.y + side.y * w / 2; pos[o + 5] = p.z + side.z * w / 2;
      const g = 0.96 - 0.22 * age, bl = 0.88 - 0.33 * age;
      col[o] = 1; col[o + 1] = g; col[o + 2] = bl;
      col[o + 3] = 1; col[o + 4] = g; col[o + 5] = bl;
    }
    r.geo.setDrawRange(0, (n - 1) * 6);
    r.geo.attributes.position.needsUpdate = true;
    r.geo.attributes.color.needsUpdate = true;
  }

  // Live update: append the current tip positions while fast and airborne;
  // otherwise let the trail retract from the tail so it never hangs in air
  // after a landing or a slowdown.
  function update(tipL, tipR, speed, onGround) {
    const tips = [tipL, tipR];
    for (let t = 0; t < 2; t++) {
      const r = ribbons[t];
      if (speed > 15 && !onGround) {
        r.pts.unshift(tips[t].clone());
        if (r.pts.length > TRAIL_MAX) r.pts.pop();
      } else if (r.pts.length > 2) {
        r.pts.pop();
      }
      rebuild(r);
    }
  }

  // Deterministic stills: lay the trail straight behind the staged pose,
  // with a gentle sink and lateral wobble, as if the plane flew in on
  // its current heading.
  function seed(planePos, heading, speed) {
    const fwd = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
    const side = new THREE.Vector3(fwd.z, 0, -fwd.x);
    for (let t = 0; t < 2; t++) {
      const r = ribbons[t];
      r.pts = [];
      const tip = headingOffset(heading, t === 0 ? -5.6 : 5.6, 0.55, 0.4);
      for (let i = 0; i < TRAIL_MAX; i++) {
        const back = i * 1.15;
        const wob = Math.sin(i * 0.55 + t * 2.1) * 0.35;
        r.pts.push(new THREE.Vector3(
          planePos.x + tip.x - fwd.x * back + side.x * wob,
          planePos.y + tip.y - i * 0.05,
          planePos.z + tip.z - fwd.z * back + side.z * wob,
        ));
      }
      rebuild(r);
    }
  }

  function reset() {
    for (const r of ribbons) { r.pts = []; rebuild(r); }
  }

  return { update, seed, reset };
}

const STREAKS = 26;

export function createSpeedLines(planeGroup) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(STREAKS * 2 * 3), 3));
  const mat = new THREE.LineBasicMaterial({
    color: 0xfff0d0, transparent: true, opacity: 0, depthWrite: false,
  });
  const lines = new THREE.LineSegments(geo, mat);
  lines.frustumCulled = false;
  lines.name = 'speed-lines';
  planeGroup.add(lines);

  // Streaks live in an annulus (radius 7–15 m) around the plane, clear of
  // the fuselage and wingtips, spread from ahead of the nose to behind
  // the tail so a frozen ?shot= still shows them distributed.
  const s = [];
  for (let i = 0; i < STREAKS; i++) {
    const r = 7 + hash1(i * 3 + 1) * 8;
    const a = hash1(i * 3 + 2) * Math.PI * 2;
    s.push({
      x: Math.cos(a) * r,
      y: Math.sin(a) * r * 0.75 + 0.5,
      z: -28 + hash1(i * 3 + 3) * 46,
      len: 3 + hash1(i * 3 + 4) * 4,
      cycle: 0,
    });
  }

  function writePositions() {
    const pos = geo.attributes.position.array;
    for (let i = 0; i < STREAKS; i++) {
      const k = s[i];
      const o = i * 6;
      pos[o] = k.x; pos[o + 1] = k.y; pos[o + 2] = k.z;
      pos[o + 3] = k.x; pos[o + 4] = k.y; pos[o + 5] = k.z - k.len;
    }
    geo.attributes.position.needsUpdate = true;
  }
  writePositions();

  // dt = 0 only sets the opacity (used by ?shot= staging); live frames
  // rush the streaks backwards past the plane and wrap them ahead again.
  function update(dt, speed) {
    const target = speed > 18 ? Math.min(0.45, 0.12 + (speed - 18) * 0.012) : 0;
    mat.opacity += (target - mat.opacity) * (dt > 0 ? Math.min(1, dt * 6) : 1);
    if (dt > 0) {
      for (let i = 0; i < STREAKS; i++) {
        const k = s[i];
        k.z -= speed * dt * 1.1;
        if (k.z < -30) {
          k.z += 48;
          k.cycle += 1;
          const r = 7 + hash1(i * 7 + k.cycle * 13 + 1) * 8;
          const a = hash1(i * 7 + k.cycle * 13 + 2) * Math.PI * 2;
          k.x = Math.cos(a) * r;
          k.y = Math.sin(a) * r * 0.75 + 0.5;
        }
      }
      writePositions();
    }
  }

  return { update };
}
