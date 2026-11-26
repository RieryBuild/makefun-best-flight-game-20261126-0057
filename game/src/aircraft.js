// SENJA AIR — aircraft: a little courier plane built from rounded
// primitives only. Capsule fuselage, tapered wings, glass canopy,
// spinning prop, nav lights, retractable gear, cream + teal +
// sunset-orange livery. No stacked plain boxes.
import * as THREE from 'three';

export function buildAircraft() {
  const g = new THREE.Group();
  g.name = 'courier-plane';

  const cream = new THREE.MeshStandardMaterial({ color: 0xf2e3c2, roughness: 0.45, metalness: 0.15 });
  const teal = new THREE.MeshStandardMaterial({ color: 0x2e7f7a, roughness: 0.5, metalness: 0.2 });
  const orange = new THREE.MeshStandardMaterial({ color: 0xff7a2a, roughness: 0.5, metalness: 0.15 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.6, metalness: 0.4 });
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x9fd8ef, roughness: 0.08, metalness: 0.1,
    transmission: 0.35, transparent: true, opacity: 0.85,
  });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xd8dde2, roughness: 0.25, metalness: 0.8 });

  // Fuselage: capsule along Z, nose toward -Z? Forward is +Z in our flight
  // model (heading 0 = +Z), so the nose points +Z.
  const fuselage = new THREE.Mesh(new THREE.CapsuleGeometry(1.05, 4.6, 6, 14), cream);
  fuselage.rotation.x = Math.PI / 2;
  fuselage.position.y = 0.2;
  g.add(fuselage);
  // Nose cone: rounded orange spinner base + cowling ring.
  const cowling = new THREE.Mesh(new THREE.SphereGeometry(1.02, 16, 12), orange);
  cowling.scale.set(1, 1, 0.7);
  cowling.position.set(0, 0.2, 2.9);
  g.add(cowling);
  // Teal cheatline stripe along the fuselage.
  const stripe = new THREE.Mesh(new THREE.CapsuleGeometry(1.08, 4.2, 4, 14), teal);
  stripe.rotation.x = Math.PI / 2;
  stripe.scale.set(1, 0.32, 1);
  stripe.position.set(0, 0.45, 0.1);
  g.add(stripe);
  // Tail cone + vertical + horizontal stabilisers (tapered, rounded).
  // The tail is what the chase camera sees, and the low western sun leaves
  // it in shadow — so the tail carries a warm sunset emissive lift (a
  // bounce-light look, not a livery change: same hues, just lit).
  const tailCone = new THREE.Mesh(new THREE.ConeGeometry(0.85, 1.8, 12),
    new THREE.MeshStandardMaterial({ color: 0x2e7f7a, roughness: 0.5, metalness: 0.2,
      emissive: 0xff8a4a, emissiveIntensity: 0.22 }));
  tailCone.rotation.x = -Math.PI / 2;
  tailCone.position.set(0, 0.35, -3.4);
  g.add(tailCone);
  const fin = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 1.5, 2.4, 4),
    new THREE.MeshStandardMaterial({ color: 0xff7a2a, roughness: 0.5, metalness: 0.15,
      emissive: 0xff7a2a, emissiveIntensity: 0.45 }));
  fin.scale.set(0.18, 1, 1.1);
  fin.position.set(0, 1.5, -3.6);
  fin.rotation.x = 0.35;
  g.add(fin);
  const stab = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 1.9, 1.1, 4),
    new THREE.MeshStandardMaterial({ color: 0x2e7f7a, roughness: 0.5, metalness: 0.2,
      emissive: 0xff8a4a, emissiveIntensity: 0.22 }));
  stab.rotation.z = Math.PI / 2;
  stab.scale.set(1, 1, 0.55);
  stab.position.set(0, 0.5, -3.7);
  g.add(stab);
  // White tail beacon: a small lit dot at the very tail tip, the brightest
  // point on the rear view — it pins the hero's outline against the sky.
  const beaconMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, emissive: 0xfff6dd, emissiveIntensity: 3.0, roughness: 0.3,
  });
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), beaconMat);
  beacon.position.set(0, 0.55, -4.35);
  g.add(beacon);

  // Main wing: tapered — a flattened, scaled cylinder segment reads as a
  // rounded airfoil; tips get orange caps.
  const wing = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 11.4, 12), cream);
  wing.rotation.z = Math.PI / 2;
  wing.scale.set(1, 1, 0.42);
  wing.position.set(0, 0.55, 0.4);
  g.add(wing);
  for (const side of [-1, 1]) {
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), orange);
    tip.scale.set(0.5, 0.5, 1.4);
    tip.position.set(side * 5.6, 0.55, 0.4);
    g.add(tip);
    // Nav light: red port, green starboard, glowing.
    const navMat = new THREE.MeshStandardMaterial({
      color: side < 0 ? 0xff2a2a : 0x2aff5a,
      emissive: side < 0 ? 0xff2020 : 0x20ff50, emissiveIntensity: 2.4,
    });
    const nav = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), navMat);
    nav.position.set(side * 5.85, 0.55, 0.4);
    g.add(nav);
  }

  // Canopy: a stretched glass half-capsule over the cockpit.
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.85, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), glass);
  canopy.scale.set(1, 0.75, 2.1);
  canopy.position.set(0, 0.75, 1.15);
  g.add(canopy);
  // Instrument glint: two tiny lit dials visible through the canopy.
  const dialMat = new THREE.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffc23c, emissiveIntensity: 1.2 });
  for (const dx of [-0.3, 0.3]) {
    const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.05, 10), dialMat);
    dial.rotation.x = Math.PI / 2 - 0.5;
    dial.position.set(dx, 0.85, 1.5);
    g.add(dial);
  }
  // Pilot helmet peeking under the canopy.
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 10), orange);
  helmet.position.set(0, 0.95, 0.55);
  g.add(helmet);

  // Propeller: hub + two rounded blades, spins in the loop.
  const prop = new THREE.Group();
  prop.position.set(0, 0.2, 3.75);
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), chrome);
  prop.add(hub);
  for (const a of [0, Math.PI]) {
    const blade = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 1.7, 4, 8), dark);
    blade.position.set(Math.cos(a) * 0.95, Math.sin(a) * 0.95, 0);
    blade.rotation.z = a + Math.PI / 2;
    prop.add(blade);
  }
  g.add(prop);

  // Landing gear: three legs with rounded wheels, hidden when retracted.
  const gear = new THREE.Group();
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1a1d22, roughness: 0.9 });
  for (const [gx, gz] of [[-0.85, 1.1], [0.85, 1.1], [0, -2.6]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.1, 6), chrome);
    leg.position.set(gx, -0.55, gz);
    gear.add(leg);
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.2, 8, 14), wheelMat);
    wheel.position.set(gx, -1.05, gz);
    if (gz < 0) wheel.rotation.y = Math.PI / 2;
    gear.add(wheel);
  }
  g.add(gear);

  // Mail sacks strapped under the belly — the courier's cargo.
  const sackMat = new THREE.MeshStandardMaterial({ color: 0xb98a4a, roughness: 1 });
  for (const sx of [-0.55, 0.55]) {
    const sack = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), sackMat);
    sack.scale.set(1, 0.7, 1.5);
    sack.position.set(sx, -0.75, -0.6);
    g.add(sack);
  }

  // Hero fill light: a warm point light parented to the aircraft, sitting
  // just behind and above the tail — exactly the side the chase camera
  // sees, and the side the low western sun never reaches. It rides with
  // the plane, so the fill follows through every view and mission. Range
  // 20 m covers the 11.4 m wingspan but never reaches the ground (the
  // lowest staged shot is ~20 m up), so no light pools appear on the
  // terrain or runway; decay 1.5 keeps the wash soft, not blown out.
  const fill = new THREE.PointLight(0xffc98a, 30, 20, 1.5);
  fill.position.set(0, 3.5, -10);
  g.add(fill);

  // Crash smoke puffs: hidden until a crash, animated by main.js.
  const smokeMat = new THREE.MeshStandardMaterial({ color: 0x555555, transparent: true, opacity: 0.55, roughness: 1 });
  const smoke = [];
  for (let i = 0; i < 10; i++) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.9 + (i % 3) * 0.4, 8, 6), smokeMat.clone());
    puff.visible = false;
    g.add(puff);
    smoke.push(puff);
  }

  return { group: g, prop, gear, smoke, canopy, fill };
}
