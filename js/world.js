import * as THREE from "three";

const SIZE = 96;
const SEGMENTS = 96;

function fract(n) {
  return n - Math.floor(n);
}

function hash(x, z) {
  return fract(Math.sin(x * 127.1 + z * 311.7) * 43758.5453123);
}

function valueNoise(x, z) {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const xf = x - xi;
  const zf = z - zi;
  const u = xf * xf * (3 - 2 * xf);
  const v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi);
  const b = hash(xi + 1, zi);
  const c = hash(xi, zi + 1);
  const d = hash(xi + 1, zi + 1);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a, b, u), THREE.MathUtils.lerp(c, d, u), v);
}

function fbm(x, z, octaves = 5) {
  let sum = 0;
  let amp = 0.55;
  let freq = 1;
  for (let i = 0; i < octaves; i += 1) {
    sum += amp * valueNoise(x * freq, z * freq);
    freq *= 2.02;
    amp *= 0.5;
  }
  return sum;
}

export function sampleHeight(x, z) {
  const n = fbm(x * 0.035 + 8.1, z * 0.035 - 3.4);
  const ridge = Math.abs(fbm(x * 0.018, z * 0.018) - 0.5) * 2;
  let h = n * 0.78 + ridge * 0.22;
  h = Math.pow(THREE.MathUtils.clamp(h, 0, 1), 1.25);
  return (h - 0.34) * 5.4;
}

export function sampleBiome(x, z, height = sampleHeight(x, z)) {
  const moist = fbm(x * 0.028 + 40, z * 0.028 + 12, 4);
  if (height < 0.12) return "water";
  if (height < 0.42 && moist > 0.42) return "sand";
  if (height < 0.38) return "sand";
  if (height > 1.7) return "dirt";
  return "grass";
}

export const ARENA_RADIUS = 42;

function biomeColor(biome, height, x, z) {
  const speck = hash(Math.floor(x * 6), Math.floor(z * 6));
  if (biome === "water") return new THREE.Color(0x2f6b5a).lerp(new THREE.Color(0x1d4e4a), speck);
  if (biome === "sand") return new THREE.Color(0xe2c98a).lerp(new THREE.Color(0xc9a35c), speck);
  if (biome === "dirt") return new THREE.Color(0x6d4c32).lerp(new THREE.Color(0x8a6a44), speck);
  const lush = new THREE.Color(0x3f7a2c);
  const deep = new THREE.Color(0x1f4d1c);
  return lush.lerp(deep, THREE.MathUtils.clamp(height / 3, 0, 1) * 0.45 + speck * 0.2);
}

export function createWorld(scene) {
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEGMENTS, SEGMENTS);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const color = new THREE.Color();

  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = sampleHeight(x, z);
    pos.setY(i, y);
    const biome = sampleBiome(x, z, y);
    color.copy(biomeColor(biome, y, x, z));
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const ground = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.92,
      metalness: 0.02,
    })
  );
  ground.receiveShadow = true;
  scene.add(ground);

  const waterGeo = new THREE.PlaneGeometry(SIZE * 1.05, SIZE * 1.05, 24, 24);
  waterGeo.rotateX(-Math.PI / 2);
  const water = new THREE.Mesh(
    waterGeo,
    new THREE.MeshStandardMaterial({
      color: 0x2ea0c8,
      transparent: true,
      opacity: 0.52,
      roughness: 0.12,
      metalness: 0.35,
    })
  );
  water.position.y = 0.08;
  water.receiveShadow = true;
  scene.add(water);

  addDecor(scene);
  addRim(scene);

  return { ground, water, getHeight: sampleHeight, getBiome: sampleBiome };
}

function addRim(scene) {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(ARENA_RADIUS + 0.6, 0.45, 10, 80),
    new THREE.MeshStandardMaterial({ color: 0x8d6a42, roughness: 0.8 })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.4;
  ring.castShadow = true;
  scene.add(ring);
}

function addDecor(scene) {
  const treeMat = new THREE.MeshStandardMaterial({ color: 0x2f6b24, roughness: 0.78 });
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c3a22, roughness: 0.9 });
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x8b8174, roughness: 0.95 });
  const reedMat = new THREE.MeshStandardMaterial({ color: 0x6ea34a, roughness: 0.7 });

  for (let i = 0; i < 70; i += 1) {
    const x = (hash(i, 3) - 0.5) * SIZE * 0.82;
    const z = (hash(i, 9) - 0.5) * SIZE * 0.82;
    if (Math.hypot(x, z) > ARENA_RADIUS - 4) continue;
    const y = sampleHeight(x, z);
    const biome = sampleBiome(x, z, y);
    if (biome !== "grass" || y < 0.5) continue;

    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 1.1, 6), trunkMat);
    trunk.position.set(x, y + 0.55, z);
    trunk.castShadow = true;
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(0.85 + hash(i, 1) * 0.4, 0), treeMat);
    crown.position.set(x, y + 1.45, z);
    crown.castShadow = true;
    scene.add(trunk, crown);
  }

  for (let i = 0; i < 40; i += 1) {
    const x = (hash(i, 21) - 0.5) * SIZE * 0.8;
    const z = (hash(i, 17) - 0.5) * SIZE * 0.8;
    const y = sampleHeight(x, z);
    if (sampleBiome(x, z, y) !== "sand") continue;
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.28 + hash(i, 4) * 0.35, 0), rockMat);
    rock.position.set(x, y + 0.18, z);
    rock.rotation.set(hash(i, 5), hash(i, 6), hash(i, 7));
    rock.castShadow = true;
    scene.add(rock);
  }

  for (let i = 0; i < 50; i += 1) {
    const x = (hash(i, 33) - 0.5) * SIZE * 0.75;
    const z = (hash(i, 31) - 0.5) * SIZE * 0.75;
    const y = sampleHeight(x, z);
    if (y > 0.22 || y < -0.15) continue;
    const reed = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.9, 5), reedMat);
    reed.position.set(x, 0.45, z);
    scene.add(reed);
  }

  const lilyMat = new THREE.MeshStandardMaterial({ color: 0x4a8f3a, roughness: 0.7 });
  for (let i = 0; i < 18; i += 1) {
    const x = (hash(i, 41) - 0.5) * SIZE * 0.7;
    const z = (hash(i, 43) - 0.5) * SIZE * 0.7;
    const y = sampleHeight(x, z);
    if (y > 0.05 || y < -0.35) continue;
    const lily = new THREE.Mesh(new THREE.CircleGeometry(0.35 + hash(i, 2) * 0.2, 8), lilyMat);
    lily.rotation.x = -Math.PI / 2;
    lily.position.set(x, 0.1, z);
    scene.add(lily);
  }
}

export function surfaceY(x, z) {
  return Math.max(sampleHeight(x, z), 0.08) + 0.28;
}
