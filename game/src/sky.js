// SENJA AIR — sky: golden-hour gradient dome, low sun disc with halo,
// procedural drifting clouds, and the light rig (sun + hemisphere +
// warm bounce). The palette is committed everywhere: amber sun, teal sea,
// violet haze at the horizon.
import * as THREE from 'three';

export function buildSky(scene, renderer) {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // Gradient sky dome: canvas gradient wrapped on the inside of a sphere.
  const c = document.createElement('canvas');
  c.width = 4; c.height = 512;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0.0, '#2b3a6e');   // zenith: deep dusk blue
  grad.addColorStop(0.35, '#7a5a8e');  // violet band
  grad.addColorStop(0.55, '#e07a4a');  // amber
  grad.addColorStop(0.68, '#ffb35c');  // golden horizon glow
  grad.addColorStop(0.78, '#ffd9a0');  // haze at the waterline
  grad.addColorStop(1.0, '#f7c98a');
  g.fillStyle = grad; g.fillRect(0, 0, 4, 512);
  const skyTex = new THREE.CanvasTexture(c);
  skyTex.colorSpace = THREE.SRGBColorSpace;
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(1800, 32, 20),
    new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false }),
  );
  sky.name = 'sky-dome';
  scene.add(sky);

  // Sun disc: layered glowing sprites, low on the western horizon.
  const sunGroup = new THREE.Group();
  sunGroup.position.set(-1150, 150, -620);
  const sunCore = new THREE.Mesh(new THREE.CircleGeometry(55, 32),
    new THREE.MeshBasicMaterial({ color: 0xfff2c8, fog: false }));
  sunCore.lookAt(0, 150, 0);
  sunGroup.add(sunCore);
  const haloMat = new THREE.MeshBasicMaterial({
    color: 0xff9a3c, transparent: true, opacity: 0.35, fog: false, depthWrite: false,
  });
  const halo = new THREE.Mesh(new THREE.CircleGeometry(120, 32), haloMat);
  halo.lookAt(0, 150, 0);
  halo.position.z = -2;
  sunGroup.add(halo);
  const halo2 = new THREE.Mesh(new THREE.CircleGeometry(210, 32),
    new THREE.MeshBasicMaterial({ color: 0xff7a3c, transparent: true, opacity: 0.14, fog: false, depthWrite: false }));
  halo2.lookAt(0, 150, 0);
  halo2.position.z = -4;
  sunGroup.add(halo2);
  scene.add(sunGroup);

  // Light rig: warm low sun (shadow caster), cool sky fill, warm ground bounce.
  const sun = new THREE.DirectionalLight(0xffb066, 2.6);
  sun.position.set(-700, 260, -380);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -260; sun.shadow.camera.right = 260;
  sun.shadow.camera.top = 260; sun.shadow.camera.bottom = -260;
  sun.shadow.camera.near = 50; sun.shadow.camera.far = 2200;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  const hemi = new THREE.HemisphereLight(0x8a7ab8, 0x3a5a3a, 0.85);
  scene.add(hemi);
  const bounce = new THREE.DirectionalLight(0xff8a4a, 0.55);
  bounce.position.set(400, 60, 500);
  scene.add(bounce);

  // Haze fog: warm violet, far enough to keep the island readable.
  scene.fog = new THREE.Fog(0xd98a6a, 500, 1750);

  // Procedural clouds: soft billboard puffs, warm-lit underneath.
  const clouds = [];
  const cloudGroup = new THREE.Group();
  const puffTex = makePuffTexture();
  for (let i = 0; i < 26; i++) {
    const puffs = 3 + (i % 4);
    const cloud = new THREE.Group();
    for (let p = 0; p < puffs; p++) {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(60 + (i * 7 + p * 13) % 70, 22 + (i * 3 + p * 5) % 16),
        new THREE.MeshBasicMaterial({
          map: puffTex, transparent: true, opacity: 0.5 + (p % 3) * 0.12,
          depthWrite: false, fog: false,
        }),
      );
      m.position.set(p * 26 - puffs * 13, (p % 2) * 6, (p % 3) * 8 - 8);
      cloud.add(m);
    }
    const a = (i / 26) * Math.PI * 2;
    const r = 500 + (i * 37) % 700;
    cloud.position.set(Math.cos(a) * r, 150 + (i * 29) % 130, Math.sin(a) * r);
    cloud.userData.speed = 1.2 + (i % 5) * 0.4;
    cloudGroup.add(cloud);
    clouds.push(cloud);
  }
  scene.add(cloudGroup);

  function updateClouds(dt, t) {
    for (const cloud of clouds) {
      cloud.position.x += cloud.userData.speed * dt;
      if (cloud.position.x > 1300) cloud.position.x = -1300;
      // Gentle bob; billboards face the camera in main.js via lookAt.
      cloud.position.y += Math.sin(t * 0.3 + cloud.position.z) * 0.002;
    }
  }

  return { sun, hemi, updateClouds, cloudGroup };
}

function makePuffTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 256, 128);
  // Overlapping radial blobs: warm white above, rose below.
  const blobs = [[64, 84, 52], [120, 66, 62], [180, 84, 54], [96, 92, 46], [152, 96, 44]];
  for (const [x, y, r] of blobs) {
    const grad = g.createRadialGradient(x, y, 4, x, y, r);
    grad.addColorStop(0, 'rgba(255,236,205,0.95)');
    grad.addColorStop(0.6, 'rgba(255,200,160,0.55)');
    grad.addColorStop(1, 'rgba(255,180,140,0)');
    g.fillStyle = grad;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
