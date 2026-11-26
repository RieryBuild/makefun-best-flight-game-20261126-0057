// SENJA AIR — missions: three different goals on one island, one flight
// model. Ring Run (8 rings vs the clock), Island Hop (take off Strip A,
// land soft on Strip B), Dusk Patrol (rings + fuel — empty tank glides).
// Landings are scored: soft touchdown + on-runway + low vertical speed.
import * as THREE from 'three';
import { STRIP_A, STRIP_B, groundHeight } from './terrain.js';

export const MISSIONS = {
  ring: {
    id: 'ring', name: 'RING RUN', bestKey: 'senjaair-best-ring',
    objective: 'RING RUN — fly all 8 rings in order',
    line: 'Thread each glowing ring. Next ring is gold; the rest are teal.',
  },
  hop: {
    id: 'hop', name: 'ISLAND HOP', bestKey: 'senjaair-best-hop',
    objective: 'ISLAND HOP — take off Strip A, land on Strip B',
    line: 'Gear + flaps down (G), slow to under 70 knots, flare over Strip B.',
  },
  patrol: {
    id: 'patrol', name: 'DUSK PATROL', bestKey: 'senjaair-best-patrol',
    objective: 'DUSK PATROL — rings + fuel: watch the gauge',
    line: 'Rings pay 500 each. Empty tank means glide — save some for the landing.',
  },
};

// Ring course: a scenic loop — over the village, around the lighthouse,
// low over the coast, back across the ridge to Strip A.
export function ringCourse() {
  const pts = [
    [-180, 42, 140], [-60, 55, 210], [60, 48, 190], [150, 60, 60],
    [190, 52, -90], [90, 45, -190], [-40, 58, -160], [-190, 46, -60],
  ];
  return pts.map(([x, y, z], i) => ({ x, y, z, index: i }));
}

export function createMissions(scene) {
  const ringGroup = new THREE.Group();
  ringGroup.name = 'rings';
  scene.add(ringGroup);
  const rings = [];
  const ringGeo = new THREE.TorusGeometry(9, 0.85, 10, 40);
  const matNext = new THREE.MeshStandardMaterial({
    color: 0xffc23c, emissive: 0xff9a2a, emissiveIntensity: 1.4, roughness: 0.4,
  });
  const matTodo = new THREE.MeshStandardMaterial({
    color: 0x2ec8c8, emissive: 0x1a7a8a, emissiveIntensity: 0.9, roughness: 0.4,
  });
  const matDone = new THREE.MeshStandardMaterial({
    color: 0x37d67a, emissive: 0x1a8a4a, emissiveIntensity: 0.7, roughness: 0.4,
  });
  for (const p of ringCourse()) {
    const mesh = new THREE.Mesh(ringGeo, matTodo.clone());
    mesh.position.set(p.x, p.y, p.z);
    // Rings face along the course: look at the next ring.
    const next = ringCourse()[(p.index + 1) % 8];
    mesh.lookAt(next.x, next.y, next.z);
    ringGroup.add(mesh);
    // Inner glow disc so the ring reads from far away.
    const disc = new THREE.Mesh(new THREE.CircleGeometry(8.2, 32),
      new THREE.MeshBasicMaterial({
        color: 0x2ec8c8, transparent: true, opacity: 0.10, side: THREE.DoubleSide, depthWrite: false,
      }));
    disc.position.copy(mesh.position);
    disc.quaternion.copy(mesh.quaternion);
    ringGroup.add(disc);
    rings.push({ ...p, mesh, disc, hit: false });
  }
  // A chevron beacon over the next ring.
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.85 });
  const beacon = new THREE.Mesh(new THREE.ConeGeometry(1.6, 4.5, 4), beaconMat);
  beacon.rotation.x = Math.PI;
  scene.add(beacon);

  const state = {
    missionId: 'ring',
    ringsHit: 0, ringsTotal: 8,
    score: 0, elapsed: 0, running: false, finished: false,
    result: null, // { kind: 'win'|'crash'|'landed', ... }
    fuelStart: 100,
    landing: null,
  };

  function start(missionId, flight) {
    state.missionId = missionId;
    state.ringsHit = 0; state.score = 0; state.elapsed = 0;
    state.running = true; state.finished = false; state.result = null; state.landing = null;
    for (const r of rings) {
      r.hit = false;
      r.mesh.material = matTodo.clone();
      r.disc.material.color.set(0x2ec8c8);
    }
    // Spawn: on Strip A, heading down the runway, throttle idle.
    const spawn = {
      x: STRIP_A.x, z: STRIP_A.z,
      y: groundHeight(STRIP_A.x, STRIP_A.z) + 0.9,
      heading: STRIP_A.heading, speed: 0, throttle: 0, onGround: true,
      fuel: missionId === 'patrol' ? 55 : 100,
    };
    flight.reset(spawn);
    // Island Hop has no rings: hide the course so the runway owns the frame.
    ringGroup.visible = missionId !== 'hop';
    updateRingMaterials();
  }

  function updateRingMaterials() {
    rings.forEach((r, i) => {
      if (r.hit) { r.mesh.material = matDone.clone(); r.disc.material.color.set(0x37d67a); }
      else if (i === state.ringsHit) { r.mesh.material = matNext.clone(); r.disc.material.color.set(0xffc23c); }
      else { r.mesh.material = matTodo.clone(); r.disc.material.color.set(0x2ec8c8); }
    });
  }

  function onRing(i, flight) {
    const r = rings[i];
    if (r.hit || i !== state.ringsHit) return false;
    r.hit = true;
    state.ringsHit += 1;
    const timeBonus = Math.max(0, 300 - Math.round(state.elapsed * 4));
    state.score += 500 + timeBonus;
    updateRingMaterials();
    if (state.missionId === 'ring' && state.ringsHit === 8) finish('win', flight);
    if (state.missionId === 'patrol' && state.ringsHit === 8) finish('win', flight);
    return true;
  }

  function finish(kind, flight, detail) {
    if (state.finished) return;
    state.finished = true; state.running = false;
    let title = '', text = '';
    if (kind === 'win') {
      const best = readBest(state.missionId);
      const isBest = state.elapsed < best || best === 0;
      if (isBest) saveBest(state.missionId, state.elapsed);
      title = 'ROUTE COMPLETE ✦';
      text = `All ${state.ringsHit} rings in ${formatTime(state.elapsed)} — score ${state.score}.`
        + (isBest ? '<br><b>New best time!</b>' : `<br>Best time: ${formatTime(best)}`);
    } else if (kind === 'landed') {
      const d = detail;
      state.score += d.bonus;
      const best = readBest(state.missionId);
      const isBest = d.bonus > best || best === 0;
      if (isBest) saveBest(state.missionId, d.bonus);
      title = d.soft ? 'BEAUTIFUL LANDING ✦' : 'LANDED';
      text = `Touchdown ${d.vsFpm} ft/min, ${d.onRunway ? 'on the runway' : 'off the runway'} — landing bonus +${d.bonus}.`
        + `<br>Score ${state.score}.` + (d.soft ? '<br><b>Softest touchdown yet!</b>' : '');
    } else if (kind === 'crash') {
      title = 'CRASHED';
      text = `The courier is down after ${formatTime(state.elapsed)} — score ${state.score}.<br>Press R to fly again.`;
    }
    state.result = { kind, title, text };
  }

  function readBest(missionId) {
    try { return Number.parseInt(window.localStorage.getItem(MISSIONS[missionId].bestKey) ?? '0', 10) || 0; } catch { return 0; }
  }
  function saveBest(missionId, value) {
    try { window.localStorage.setItem(MISSIONS[missionId].bestKey, String(Math.round(value))); } catch { /* storage off */ }
  }
  function formatTime(s) {
    const m = Math.floor(s / 60), sec = Math.floor(s % 60);
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }

  // Per-frame: timer, ring proximity, landing detection, fuel-out glide.
  function update(dt, flight, events) {
    if (!state.running || state.finished) return;
    state.elapsed += dt;
    const f = flight.state;
    // Ring proximity: within 9.5 m of the next ring centre.
    const next = rings[state.ringsHit];
    if (next && state.missionId !== 'hop') {
      const d = Math.hypot(f.x - next.x, f.y - next.y, f.z - next.z);
      if (d < 9.5) {
        if (onRing(state.ringsHit, flight)) events.ring(state.ringsHit, state.score);
      }
    }
    // Beacon bobs above the next ring.
    if (next) {
      beacon.visible = state.missionId !== 'hop';
      beacon.position.set(next.x, next.y + 14 + Math.sin(state.elapsed * 2.4) * 1.5, next.z);
      beacon.rotation.y += dt * 1.2;
    } else beacon.visible = false;
    // Landing check for Island Hop: on the ground near Strip B, slow.
    if (state.missionId === 'hop' && f.onGround && !state.finished) {
      const dx = f.x - STRIP_B.x, dz = f.z - STRIP_B.z;
      const along = Math.abs(dx * Math.sin(STRIP_B.heading) + dz * Math.cos(STRIP_B.heading));
      const across = Math.abs(dx * Math.cos(STRIP_B.heading) - dz * Math.sin(STRIP_B.heading));
      const onRunway = along < STRIP_B.length / 2 && across < STRIP_B.width / 2 + 4;
      const near = Math.hypot(dx, dz) < 130;
      if (near && f.speed < 12) {
        const vsFpm = Math.round(Math.abs(f.verticalSpeed) * 196.85);
        const soft = vsFpm < 350 && onRunway;
        const bonus = (onRunway ? 800 : 200) + (soft ? 700 : 0) + Math.max(0, 400 - vsFpm);
        state.landing = { vsFpm, onRunway, soft, bonus };
        finish('landed', flight, state.landing);
        events.landed(state.landing);
      }
    }
    // Dusk Patrol fuel-out: if the tank dies with no rings left to chase,
    // a soft landing anywhere still counts as a finish.
    if (state.missionId === 'patrol' && f.fuel <= 0 && f.onGround && f.speed < 8 && !state.finished) {
      const vsFpm = Math.round(Math.abs(f.verticalSpeed) * 196.85);
      state.landing = { vsFpm, onRunway: false, soft: vsFpm < 400, bonus: 300 };
      finish('landed', flight, state.landing);
      events.landed(state.landing);
    }
  }

  function animateRings(t) {
    rings.forEach((r, i) => {
      if (!r.hit) {
        const s = 1 + Math.sin(t * 2 + i) * 0.03;
        r.mesh.scale.set(s, s, s);
      }
    });
  }

  // Refresh ring colours after an external ringsHit change (shot staging).
  function refreshRings() { updateRingMaterials(); }

  return { state, rings, beacon, start, update, animateRings, finish, readBest, refreshRings, MISSIONS };
}
