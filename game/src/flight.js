// SENJA AIR — flight model: arcade discipline.
// Throttle sets target speed; speed governs turn rate and lift. Below the
// stall speed the nose drops and the wing stops answering. Pitch and roll
// are banked turns: roll banks, pitch pulls, rudder yaws. All angles in
// radians, speeds in m/s, altitudes in metres. One fixed step (1/60 s).

export const MIN_SPEED = 14;        // m/s — below this the wing quits
export const STALL_SPEED = 18;      // m/s — warning band starts here
export const MAX_SPEED = 62;        // m/s — full throttle, clean
export const CRUISE_SPEED = 38;     // m/s — comfortable ring-running pace
export const GRAVITY = 9.81;

export function createFlightModel() {
  const state = {
    // Position and attitude. Heading 0 = +Z (north on the map), yaw turns it.
    x: 0, y: 6, z: 0,
    heading: 0, pitch: 0, roll: 0,
    speed: 0, throttle: 0,
    verticalSpeed: 0,
    flaps: false, gear: false,
    fuel: 100, damage: 0,
    stalled: false, onGround: true,
    crashed: false, landed: false,
    propAngle: 0,
  };

  function reset(spawn) {
    state.x = spawn.x; state.y = spawn.y; state.z = spawn.z;
    state.heading = spawn.heading ?? 0;
    state.pitch = 0; state.roll = 0;
    state.speed = spawn.speed ?? 0; state.throttle = spawn.throttle ?? 0;
    state.verticalSpeed = 0;
    state.flaps = false; state.gear = false;
    state.fuel = spawn.fuel ?? 100; state.damage = 0;
    state.stalled = false;
    // Spawned on the runway: start on the ground, never drop in from above.
    state.onGround = spawn.onGround ?? spawn.y <= 0.5;
    state.crashed = false; state.landed = false;
    state.propAngle = 0;
  }

  // input: { pitch: -1..1 (up positive), roll: -1..1, rudder: -1..1,
  //          throttleDelta, dt } — groundHeight(x,z) from terrain.
  function step(input, groundHeight, dt) {
    if (state.crashed) return state;
    const s = state;

    // Throttle: W/S move the lever; the engine chases it.
    s.throttle = Math.min(1, Math.max(0, s.throttle + (input.throttleDelta || 0)));
    const flapDrag = s.flaps ? 0.82 : 1;
    const topSpeed = MAX_SPEED * flapDrag;
    const targetSpeed = s.throttle * topSpeed;
    // Engine pulls toward target; drag bites harder at high speed.
    const accel = (targetSpeed - s.speed) * (targetSpeed > s.speed ? 0.55 : 0.35);
    s.speed = Math.max(0, s.speed + accel * dt);
    if (s.fuel <= 0) { s.throttle = 0; s.speed = Math.max(0, s.speed - 6 * dt); }

    // Stall: below STALL_SPEED the wing gives up lift and the nose drops.
    const stallSpeed = s.flaps ? STALL_SPEED - 4 : STALL_SPEED;
    s.stalled = s.speed < stallSpeed && !s.onGround;
    const authority = Math.min(1, Math.max(0.15, s.speed / CRUISE_SPEED));

    // Roll is a bank TARGET, not a rate: the pilot holds an arrow to hold a
    // bank angle, and the wing eases back to level when released. Holding
    // an arrow must never pin the plane at max bank.
    const targetRoll = (input.roll || 0) * 1.15;
    const rollResponse = 3.2 * authority;
    s.roll += (targetRoll - s.roll) * Math.min(1, rollResponse * dt);
    s.roll = Math.max(-1.35, Math.min(1.35, s.roll));
    // Heading follows bank, faster with speed. Positive roll banks right
    // and turns right (heading grows toward south from east, etc.).
    s.heading += Math.sin(s.roll) * (0.55 + s.speed / MAX_SPEED * 0.9) * dt;
    s.heading += (input.rudder || 0) * 0.35 * authority * dt;

    // Pitch is a climb-angle TARGET, like roll is a bank target: holding
    // Up holds a climb, releasing eases the nose back to level. A rate
    // integrator here made the plane porpoise and overshoot altitude.
    const targetPitch = (input.pitch || 0) * 0.5;
    if (s.stalled) {
      s.pitch -= 0.9 * dt; // nose drops
    } else {
      s.pitch += (targetPitch - s.pitch) * Math.min(1, 3.0 * authority * dt);
    }
    s.pitch = Math.max(-0.55, Math.min(0.5, s.pitch));

    // Velocity from attitude: forward along heading, up from pitch.
    const lift = s.stalled ? 0.25 : 1;
    const forward = Math.cos(s.pitch);
    const vx = Math.sin(s.heading) * forward * s.speed;
    const vz = Math.cos(s.heading) * forward * s.speed;
    let vy = Math.sin(s.pitch) * s.speed * lift;
    // Gravity always pulls; lift cancels it only when fast enough.
    const liftFactor = Math.min(1, s.speed / (stallSpeed + 6));
    vy -= GRAVITY * (1 - liftFactor * 0.92) * dt * 2.2;
    if (s.onGround && s.speed < stallSpeed + 4 && s.pitch <= 0.05) vy = Math.min(vy, 0);

    s.x += vx * dt; s.z += vz * dt; s.y += vy * dt;
    s.verticalSpeed = vy;

    // Ground: terrain height + gear clearance.
    const ground = groundHeight(s.x, s.z);
    const gearClearance = 0.9;
    if (s.y <= ground + gearClearance) {
      s.y = ground + gearClearance;
      if (!s.onGround) {
        // Touchdown: judge it by vertical speed, alignment and energy.
        // A truly violent impact ends the sortie; a hard knock costs 40.
        const vs = -vy;
        const aligned = Math.abs(s.roll) < 0.35 && Math.abs(s.pitch) < 0.35;
        if (vs > 20 || (vs > 12 && s.speed > 55)) {
          s.damage = 100; s.crashed = true;
        } else if (vs > 9) {
          s.damage += 40;
          if (s.damage >= 100) s.crashed = true;
        } else if (!aligned) {
          s.damage += 25;
          if (s.damage >= 100) s.crashed = true;
        } else {
          s.landed = true;
        }
      }
      s.onGround = true;
      s.pitch = 0;
      // Rolling friction on the ground.
      if (s.throttle < 0.15) s.speed = Math.max(0, s.speed - 14 * dt);
    } else {
      s.onGround = false;
      s.landed = false;
    }

    // Fuel drains with throttle; flaps cost a little extra drag-fuel.
    // A full tank lasts ~5 minutes at cruise — enough for a ring run with
    // margin, tight enough that Dusk Patrol's half tank is a real decision.
    if (!s.onGround || s.speed > 5) {
      s.fuel = Math.max(0, s.fuel - (0.06 + s.throttle * 0.35 + (s.flaps ? 0.05 : 0)) * dt);
    }
    s.propAngle += (2 + s.throttle * 38) * dt;
    return state;
  }

  function knots() { return state.speed * 1.944; }
  function feet() { return state.y * 3.281; }
  function headingDegrees() { return ((state.heading * 180 / Math.PI) % 360 + 360) % 360; }

  return { state, reset, step, knots, feet, headingDegrees };
}
