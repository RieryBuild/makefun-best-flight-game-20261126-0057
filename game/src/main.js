// SENJA AIR — main: bootstrap, fixed-step loop, input, cameras, crash
// sequence and the ?shot= staging hook. Owns the game state machine:
// title -> flying -> paused / finished (landed, complete, crashed).
import * as THREE from 'three';
import { createFlightModel, STALL_SPEED } from './flight.js';
import { buildTerrain, groundHeight, STRIP_A } from './terrain.js';
import { buildAircraft } from './aircraft.js';
import { buildSky } from './sky.js';
import { createHUD } from './hud.js';
import { createAudio } from './audio.js';
import { createMissions, MISSIONS } from './missions.js';
import { stageShot } from './shots.js';
import { createContrails, createSpeedLines } from './vfx.js';

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 1;

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2b3a6e);
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 4000);

const sky = buildSky(scene, renderer);
const terrain = buildTerrain(scene);
const plane = buildAircraft();
scene.add(plane.group);
const contrails = createContrails(scene);
const speedLines = createSpeedLines(plane.group);
const hud = createHUD();
const audio = createAudio();
const flight = createFlightModel();
const missions = createMissions(scene);

// --- input ---------------------------------------------------------------
const keys = new Set();
let mouseDX = 0, mouseDY = 0, mouseDown = false;
let lookYaw = 0, lookPitch = 0;
window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
  keys.add(e.code);
  if (e.code === 'KeyC') toggleCamera();
  if (e.code === 'KeyG') toggleFlapsGear();
  if (e.code === 'KeyP') togglePause();
  if (e.code === 'KeyR') restart();
  if (e.code === 'Enter' && screen === 'title') startMission(selectedMission);
  if (e.code === 'Digit1') selectMission('ring');
  if (e.code === 'Digit2') selectMission('hop');
  if (e.code === 'Digit3') selectMission('patrol');
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());
canvas.addEventListener('mousedown', () => { mouseDown = true; });
window.addEventListener('mouseup', () => { mouseDown = false; });
window.addEventListener('mousemove', (e) => {
  if (!mouseDown) return;
  mouseDX += e.movementX || 0; mouseDY += e.movementY || 0;
});
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- game state ----------------------------------------------------------
let screen = 'title'; // title | flying | paused | finished
let selectedMission = 'ring';
let cameraMode = 'chase'; // chase | cockpit
let crashT = 0;
let camPos = new THREE.Vector3(0, 20, -30);
let camLook = new THREE.Vector3();
let shotMode = false;

document.querySelectorAll('.mission').forEach((el) => {
  el.addEventListener('click', () => selectMission(el.dataset.mission));
});
document.getElementById('startBtn').addEventListener('click', () => startMission(selectedMission));
document.getElementById('againBtn').addEventListener('click', () => restart());
document.getElementById('menuBtn').addEventListener('click', () => {
  screen = 'title'; hud.showTitle(); hud.hideEnd(); audio.titlePad(true);
});
function selectMission(id) {
  selectedMission = id;
  document.querySelectorAll('.mission').forEach((el) => el.classList.toggle('sel', el.dataset.mission === id));
}
function refreshBestLabels() {
  for (const id of ['ring', 'hop', 'patrol']) {
    const el = document.getElementById(`best-${id}`);
    if (!el) continue;
    const v = missions.readBest(id);
    el.textContent = v ? `Best: ${id === 'hop' ? `+${v} pts` : `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`}` : 'Best: —';
  }
}
refreshBestLabels();

function startMission(id) {
  audio.resume();
  missions.start(id, flight);
  contrails.reset();
  screen = 'flying';
  hud.hideTitle(); hud.hideEnd();
  hud.setCockpit(false);
  cameraMode = 'chase';
  hud.toast(MISSIONS[id].objective, 200);
  hud.setStatus(`${MISSIONS[id].name} started`);
  audio.titlePad(false);
  snapCamera();
}

function restart() {
  if (screen === 'title') return;
  crashT = 0;
  for (const p of plane.smoke) { p.visible = false; }
  plane.group.rotation.set(0, 0, 0);
  plane.group.visible = true;
  startMission(selectedMission);
}

function togglePause() {
  if (screen === 'flying') { screen = 'paused'; hud.toast('PAUSED — press P to resume', 9999); }
  else if (screen === 'paused') { screen = 'flying'; hud.toast('', 1); }
}

function toggleCamera() {
  if (screen !== 'flying') return;
  cameraMode = cameraMode === 'chase' ? 'cockpit' : 'chase';
  hud.setCockpit(cameraMode === 'cockpit');
  hud.toast(cameraMode === 'cockpit' ? 'COCKPIT VIEW' : 'CHASE VIEW', 90);
}

function toggleFlapsGear() {
  if (screen !== 'flying') return;
  const f = flight.state;
  f.flaps = !f.flaps; f.gear = f.flaps;
  hud.toast(f.flaps ? 'FLAPS + GEAR DOWN — landing config' : 'FLAPS + GEAR UP — clean', 120);
}

// --- per-frame update ------------------------------------------------------
const STEP = 1 / 60;
let acc = 0, last = performance.now(), elapsed = 0;

function readInput(dt) {
  const pitch = (keys.has('ArrowUp') ? 1 : 0) + (keys.has('ArrowDown') ? -1 : 0);
  const roll = (keys.has('ArrowLeft') ? 1 : 0) + (keys.has('ArrowRight') ? -1 : 0);
  const rudder = (keys.has('KeyA') ? -1 : 0) + (keys.has('KeyD') ? 1 : 0);
  const throttleDelta = ((keys.has('KeyW') ? 1 : 0) + (keys.has('KeyS') ? -1 : 0)) * 0.9 * dt;
  // Mouse look nudges the view, never the flight path.
  lookYaw = THREE.MathUtils.clamp(lookYaw - mouseDX * 0.003, -0.9, 0.9);
  lookPitch = THREE.MathUtils.clamp(lookPitch - mouseDY * 0.002, -0.45, 0.45);
  mouseDX = 0; mouseDY = 0;
  if (!mouseDown) { lookYaw *= 0.94; lookPitch *= 0.94; }
  return { pitch, roll, rudder, throttleDelta, dt };
}

function placePlane() {
  const f = flight.state;
  plane.group.position.set(f.x, f.y, f.z);
  plane.group.rotation.order = 'YXZ';
  plane.group.rotation.y = f.heading;
  plane.group.rotation.x = -f.pitch;
  plane.group.rotation.z = f.roll;
  plane.prop.rotation.z = f.propAngle;
  plane.gear.visible = f.gear || f.onGround;
}

function snapCamera() {
  const f = flight.state;
  const back = new THREE.Vector3(-Math.sin(f.heading), 0, -Math.cos(f.heading));
  const right = new THREE.Vector3(-Math.cos(f.heading), 0, Math.sin(f.heading));
  camPos.set(f.x + back.x * 18 + right.x * 3, f.y + 5.4, f.z + back.z * 18 + right.z * 3);
}

function updateCamera(dt) {
  const f = flight.state;
  const forward = new THREE.Vector3(Math.sin(f.heading), 0, Math.cos(f.heading));
  if (cameraMode === 'cockpit') {
    plane.canopy.visible = false; // the glass dome would fill the view from inside
    // Sit up in the cockpit, over the canopy station: the nose becomes a
    // hood at the bottom of the frame instead of a wall in front of it.
    const fwd = new THREE.Vector3(Math.sin(f.heading), 0, Math.cos(f.heading));
    const head = new THREE.Vector3(f.x + fwd.x * 0.8, f.y + 1.9, f.z + fwd.z * 0.8);
    const look = new THREE.Vector3(
      Math.sin(f.heading + lookYaw) * Math.cos(f.pitch + lookPitch),
      Math.sin(f.pitch + lookPitch) - 0.03,
      Math.cos(f.heading + lookYaw) * Math.cos(f.pitch + lookPitch),
    );
    camera.position.copy(head);
    camLook.lerp(head.clone().add(look.multiplyScalar(30)), 1 - Math.pow(0.0001, dt));
    camera.lookAt(camLook);
    camera.fov = 72;
  } else {
    plane.canopy.visible = true;
    const back = forward.clone().multiplyScalar(-18);
    const right0 = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
    // Slight three-quarter offset: the plane reads as a 3D aircraft, not a blob.
    const target = new THREE.Vector3(f.x + back.x + right0.x * 3, f.y + 5.4, f.z + back.z + right0.z * 3);
    // Lerp: the camera never snaps or fights the pilot.
    camPos.lerp(target, 1 - Math.pow(0.001, dt));
    camera.position.copy(camPos);
    const lookTarget = new THREE.Vector3(f.x + forward.x * 24, f.y + 1.2 + f.pitch * 8, f.z + forward.z * 24);
    camLook.lerp(lookTarget, 1 - Math.pow(0.0005, dt));
    // Mouse look offsets the look target sideways.
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
    camera.lookAt(camLook.clone().add(right.multiplyScalar(lookYaw * 14)));
    camera.fov = 62 + Math.min(10, f.speed * 0.12);
  }
  camera.updateProjectionMatrix();
}

const crashSpin = new THREE.Vector3();
function updateCrash(dt) {
  crashT += dt;
  // Tumble: the plane rolls over and drops, smoke puffs bloom and rise.
  plane.group.rotation.z += dt * 2.2;
  plane.group.rotation.x += dt * 0.8;
  plane.group.position.y = Math.max(groundHeight(flight.state.x, flight.state.z) + 1.2, plane.group.position.y - 6 * dt);
  plane.smoke.forEach((p, i) => {
    p.visible = true;
    const a = i * 1.7;
    p.position.set(Math.cos(a) * 1.5, 1 + ((crashT * 2 + i) % 3), Math.sin(a) * 1.5);
    const s = 0.8 + ((crashT + i * 0.3) % 2.5);
    p.scale.set(s, s, s);
    p.material.opacity = Math.max(0, 0.55 - crashT * 0.08);
  });
  if (crashT > 0.2 && !updateCrash.shown) {
    updateCrash.shown = true;
    audio.crash();
    hud.toast('✕ CRASHED — PRESS R ✕', 9999);
  }
}

function stepGame(dt) {
  elapsed += dt;
  const f = flight.state;
  const input = readInput(dt);
  const wasAirborne = !f.onGround;
  const wasStalled = f.stalled;
  const prevDamage = f.damage;
  flight.step(input, groundHeight, dt);
  missions.update(dt, flight, {
    ring: (i, score) => { audio.ringChime(); hud.toast(`RING ${i + 1} / 8  ✦  +${score >= 500 ? 500 : 0}`, 140); },
    landed: (d) => { audio.fanfare(); },
  });
  // Touchdown thump the first frame we meet the ground.
  if (wasAirborne && f.onGround && !f.crashed) audio.thump();
  if (f.damage > prevDamage && !f.crashed) hud.toast('HARD HIT — damage!', 120);
  if (f.crashed && screen === 'flying') {
    screen = 'finished';
    crashT = 0; updateCrash.shown = false;
    missions.finish('crash', flight);
    hud.showEnd(missions.state.result.title, missions.state.result.text);
    hud.setStatus('crashed');
  }
  if (missions.state.finished && screen === 'flying') {
    screen = 'finished';
    if (missions.state.result.kind === 'win') audio.fanfare();
    hud.showEnd(missions.state.result.title, missions.state.result.text);
    hud.setStatus(missions.state.result.title);
    refreshBestLabels();
  }
  audio.updateFlight(f.throttle, f.speed, f.stalled);
  missions.animateRings(elapsed);
  sky.updateClouds(dt, elapsed);
  // Sea shimmer: cheap vertex bob on the water plane.
  const seaPos = terrain.sea.geometry.attributes.position;
  for (let i = 0; i < seaPos.count; i += 7) {
    const x = seaPos.getX(i), y = seaPos.getY(i);
    seaPos.setZ(i, Math.sin(x * 0.02 + elapsed * 0.9) * 0.35 + Math.cos(y * 0.02 + elapsed * 0.7) * 0.35);
  }
  seaPos.needsUpdate = true;
  // Cloud billboards face the camera.
  for (const cloud of sky.cloudGroup.children) {
    for (const puff of cloud.children) puff.lookAt(camera.position);
  }
  placePlane();
  // Motion VFX: wingtip contrails + speed lines, both speed-gated.
  plane.group.updateMatrixWorld(true);
  contrails.update(
    plane.group.localToWorld(new THREE.Vector3(-5.6, 0.55, 0.4)),
    plane.group.localToWorld(new THREE.Vector3(5.6, 0.55, 0.4)),
    f.speed, f.onGround);
  speedLines.update(dt, f.speed);
  updateCamera(dt);
}

function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  if (shotMode) return; // shots stage a frozen scene; no loop advance.
  if (screen === 'flying') {
    acc += dt;
    while (acc >= STEP) { stepGame(STEP); acc -= STEP; }
  } else if (screen === 'finished' && flight.state.crashed) {
    updateCrash(dt);
    placePlane();
    updateCamera(dt);
  } else if (screen === 'title') {
    // Title orbit: slow cinematic sweep around the island at dusk.
    elapsed += dt;
    const a = elapsed * 0.03;
    camera.position.set(Math.cos(a) * 320, 90 + Math.sin(elapsed * 0.1) * 12, Math.sin(a) * 320);
    camera.lookAt(0, 18, 0);
    sky.updateClouds(dt, elapsed);
    missions.animateRings(elapsed);
    placePlaneAtStripA();
  }
  hud.update({
    flight: flight.state,
    headingDeg: flight.headingDegrees(),
    knots: flight.knots(), feet: flight.feet(),
    ringsHit: missions.state.ringsHit, ringsTotal: missions.state.ringsTotal,
    score: missions.state.score, elapsed: missions.state.elapsed,
    objective: screen === 'title' ? 'SENJA AIR — DUSK COURIER' : MISSIONS[selectedMission].objective,
    missionLine: screen === 'title' ? '' : MISSIONS[selectedMission].line,
    crashed: flight.state.crashed,
  });
  renderer.render(scene, camera);
}

function placePlaneAtStripA() {
  const f = flight.state;
  if (f.x === 0 && f.z === 0) {
    flight.reset({ x: STRIP_A.x, z: STRIP_A.z, y: groundHeight(STRIP_A.x, STRIP_A.z) + 0.9, heading: STRIP_A.heading, speed: 0, throttle: 0, onGround: true });
  }
  placePlane();
}

// Title-screen idle state: plane parked on Strip A before any mission.
flight.reset({ x: STRIP_A.x, z: STRIP_A.z, y: groundHeight(STRIP_A.x, STRIP_A.z) + 0.9, heading: STRIP_A.heading, speed: 0, throttle: 0, onGround: true });
placePlane();
audio.titlePad(true);

// ?shot= staging: freeze a composed scene, render twice, signal readiness.
if (shotName) {
  shotMode = true;
  stageShot(shotName, seed, { scene, camera, renderer, flight, missions, hud, plane, placePlane, updateCamera, snapCamera, groundHeight, contrails, speedLines });
  renderer.render(scene, camera);
  renderer.render(scene, camera);
  window.__shotReady = true;
} else {
  requestAnimationFrame(frame);
}
