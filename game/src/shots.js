// SENJA AIR — shots: deterministic ?shot= staging for screenshots.
// cover | cockpit | coast | landing, each with &seed=1. Stages the plane,
// mission state, camera and HUD, then main.js renders twice and sets
// window.__shotReady. No randomness: every shot is the same every run.
import * as THREE from 'three';
import { STRIP_A, STRIP_B, groundHeight } from './terrain.js';
import { MISSIONS } from './missions.js';

export function stageShot(name, seed, ctx) {
  const { scene, camera, renderer, flight, missions, hud, placePlane, groundHeight: gh } = ctx;
  document.getElementById('title').style.display = 'none';
  document.getElementById('endCard').style.display = 'none';
  hud.hideTitle(); hud.hideEnd();

  // Seed the motion VFX from the staged pose so a frozen still reads as
  // flight: contrails trailing behind the wingtips, speed lines at cruise
  // opacity. Safe no-op when the caller passes no VFX handles.
  const seedShotVfx = (f) => {
    if (ctx.contrails) ctx.contrails.seed(new THREE.Vector3(f.x, f.y, f.z), f.heading, f.speed);
    if (ctx.speedLines) ctx.speedLines.update(0, f.speed);
  };

  const f = flight.state;
  const setFlight = (x, y, z, heading, speed, throttle) => {
    flight.reset({ x, z, y, heading, speed, throttle, fuel: name === 'coast' ? 72 : 88 });
    f.pitch = 0.04; f.roll = 0.08;
  };

  if (name === 'cover') {
    // Chase view mid-course: the gold next ring dead ahead, fully in
    // frame. The plane sits ~50 m short of ring 2 on the ring 1 -> ring 2
    // leg (heading 1.67, straight at it), so the two flown (green) rings
    // are ~70 m behind the camera and out of frame instead of looming at
    // the edge, and the village + windmill fill the lower frame.
    missions.start('ring', flight);
    missions.state.ringsHit = 2;
    missions.state.score = 1240;
    missions.state.elapsed = 47;
    // Rings 0-1 already flown (green); the gold next ring is dead ahead.
    missions.rings[0].hit = true; missions.rings[1].hit = true;
    missions.refreshRings();
    setFlight(10, 50, 195, 1.67, 40, 0.72);
    f.pitch = 0.02; f.roll = -0.12;
    missions.update(0, flight, { ring: () => {}, landed: () => {} });
    placePlane();
    ctx.snapCamera();
    for (let i = 0; i < 150; i++) ctx.updateCamera(1 / 60);
    seedShotVfx(f);
    hud.toast('RING 3 / 8 — THREAD THE GOLD RING', 9999);
  } else if (name === 'cockpit') {
    // Cockpit view flying through a ring: ring dead ahead, instruments lit.
    missions.start('ring', flight);
    missions.state.ringsHit = 3;
    missions.state.score = 1980;
    missions.state.elapsed = 71;
    missions.refreshRings();
    setFlight(52, 47, 178, 2.6, 42, 0.78);
    f.pitch = 0.0; f.roll = 0.05;
    placePlane();
    hud.setCockpit(true);
    if (ctx.plane) ctx.plane.canopy.visible = false; // glass dome would fill the view
    const fwd = new THREE.Vector3(Math.sin(f.heading), 0, Math.cos(f.heading));
    const head = new THREE.Vector3(f.x + fwd.x * 0.8, f.y + 1.9, f.z + fwd.z * 0.8);
    camera.position.copy(head);
    const look = new THREE.Vector3(
      Math.sin(f.heading), Math.sin(f.pitch) - 0.03, Math.cos(f.heading));
    camera.lookAt(head.clone().add(look.multiplyScalar(30)));
    camera.fov = 72; camera.updateProjectionMatrix();
    seedShotVfx(f);
    hud.toast('THROUGH THE RING ✦', 9999);
  } else if (name === 'coast') {
    // Low sunset pass along the west coast: sea + sun glitter ahead-left,
    // coastline on the right, island behind the plane's shoulder.
    missions.start('patrol', flight);
    missions.state.ringsHit = 1;
    missions.state.score = 640;
    missions.state.elapsed = 122;
    missions.refreshRings();
    setFlight(-360, 28, 60, 2.75, 44, 0.66);
    f.pitch = -0.02; f.roll = 0.18;
    placePlane();
    ctx.snapCamera();
    for (let i = 0; i < 150; i++) ctx.updateCamera(1 / 60);
    seedShotVfx(f);
    hud.toast('DUSK PATROL — LOW OVER THE COAST', 9999);
  } else if (name === 'landing') {
    // Flare over Strip B: gear + flaps down, runway filling the frame.
    missions.start('hop', flight);
    missions.state.elapsed = 96;
    const by = groundHeight(STRIP_B.x, STRIP_B.z);
    const ax = STRIP_B.x - Math.sin(STRIP_B.heading) * 100;
    const az = STRIP_B.z - Math.cos(STRIP_B.heading) * 100;
    setFlight(ax, by + 20, az, STRIP_B.heading, 24, 0.34);
    f.flaps = true; f.gear = true; f.pitch = 0.1; f.roll = 0.0;
    f.onGround = false;
    placePlane();
    ctx.snapCamera();
    for (let i = 0; i < 150; i++) ctx.updateCamera(1 / 60);
    seedShotVfx(f);
    hud.toast('FLARE — GEAR DOWN, EASY NOW', 9999);
  } else {
    // Unknown shot: fall back to the cover composition.
    stageShot('cover', seed, ctx);
    return;
  }

  // Final HUD state for the shot (score, timer, rings, fuel all live).
  hud.update({
    flight: flight.state,
    headingDeg: flight.headingDegrees(),
    knots: flight.knots(), feet: flight.feet(),
    ringsHit: missions.state.ringsHit, ringsTotal: missions.state.ringsTotal,
    score: missions.state.score, elapsed: missions.state.elapsed,
    objective: MISSIONS[missions.state.missionId].objective,
    missionLine: MISSIONS[missions.state.missionId].line,
    crashed: false,
  });
  renderer.render(scene, camera);
}
