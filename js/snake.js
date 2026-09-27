import * as THREE from "three";
import { ARENA_RADIUS, sampleBiome, surfaceY } from "./world.js";

const _fwd = new THREE.Vector3();
const _mat = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _pos = new THREE.Vector3();
const _zAxis = new THREE.Vector3(0, 0, 1);
const _color = new THREE.Color();

export const SKINS = {
  emerald: { name: "Изумруд", body: 0x2f8f45, dark: 0x145c28, belly: 0xd7e38a, eye: 0x1a1a1a },
  sand: { name: "Песчаная", body: 0xc4a35a, dark: 0x8a6a32, belly: 0xf0e0b4, eye: 0x3b2210 },
  river: { name: "Речная", body: 0x2a6f8f, dark: 0x163f58, belly: 0xb8e0ea, eye: 0x111111 },
  coral: { name: "Коралл", body: 0xc45c4a, dark: 0x7a2c24, belly: 0xf2c9a0, eye: 0x220c0c },
  night: { name: "Ночная", body: 0x3a3f55, dark: 0x1c2030, belly: 0xc5c8d6, eye: 0xeeeeee },
};

export class Snake {
  constructor({ id, name, skinKey, isPlayer, scene }) {
    this.id = id;
    this.name = name;
    this.isPlayer = Boolean(isPlayer);
    this.skin = SKINS[skinKey] || SKINS.emerald;
    this.skinKey = skinKey;
    this.alive = true;
    this.score = 0;
    this.yaw = 0;
    this.targetYaw = 0;
    this.boost = false;
    this.speedMul = 1;
    this.boostTime = 0;
    this.slowTime = 0;
    this.respawnAt = 0;
    this.baseSpeed = isPlayer ? 6.2 : 5.4;
    this.turnSpeed = isPlayer ? 2.55 : 2.1;
    this.targetLength = isPlayer ? 16 : 12 + Math.floor(Math.random() * 8);
    this.radius = 0.34;
    this.position = new THREE.Vector3(0, 0.4, 0);
    this.trail = [];
    this.group = new THREE.Group();
    scene.add(this.group);

    this.head = buildHead(this.skin);
    this.group.add(this.head);

    const maxSeg = 90;
    const geo = new THREE.SphereGeometry(1, 12, 10);
    this.bodyMat = new THREE.MeshStandardMaterial({
      color: this.skin.body,
      roughness: 0.42,
      metalness: 0.08,
    });
    this.body = new THREE.InstancedMesh(geo, this.bodyMat, maxSeg);
    this.body.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.body.frustumCulled = false;
    this.body.castShadow = true;
    this.body.receiveShadow = true;
    this.body.count = this.targetLength;
    for (let i = 0; i < maxSeg; i += 1) {
      this.body.setColorAt(i, _color.set(this.skin.body));
    }
    this.group.add(this.body);
    this.maxSeg = maxSeg;
  }

  spawn(x, z, yaw = 0) {
    this.alive = true;
    this.yaw = yaw;
    this.targetYaw = yaw;
    this.boost = false;
    this.speedMul = 1;
    this.boostTime = 0;
    this.slowTime = 0;
    this.position.set(x, surfaceY(x, z), z);
    this.trail = [];
    for (let i = 0; i < this.targetLength * 6; i += 1) {
      this.trail.push(
        this.position
          .clone()
          .add(new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)).multiplyScalar(i * 0.12))
      );
    }
    this.group.visible = true;
    this.syncMeshes(0);
  }

  currentSpeed() {
    let s = this.baseSpeed * this.speedMul;
    if (this.boost) s *= 1.55;
    if (this.boostTime > 0) s *= 1.35;
    if (this.slowTime > 0) s *= 0.62;
    const biome = sampleBiome(this.position.x, this.position.z);
    if (biome === "water") s *= 0.72;
    if (biome === "sand") s *= 0.86;
    return s;
  }

  setAim(yaw) {
    this.targetYaw = yaw;
  }

  grow(n) {
    this.targetLength = THREE.MathUtils.clamp(this.targetLength + n, 8, this.maxSeg);
  }

  eat(food) {
    this.score = Math.max(0, this.score + food.score);
    this.grow(food.grow);
    if (food.boost) this.boostTime = Math.max(this.boostTime, food.boost);
    if (food.slow) this.slowTime = Math.max(this.slowTime, food.slow);
  }

  kill() {
    this.alive = false;
    this.group.visible = false;
    this.respawnAt = performance.now() + (this.isPlayer ? 999999 : 2600);
  }

  segmentRadius(i) {
    const t = i / Math.max(1, this.targetLength - 1);
    return this.radius * (1.05 - t * 0.55);
  }

  update(dt) {
    if (!this.alive) return;
    this.boostTime = Math.max(0, this.boostTime - dt);
    this.slowTime = Math.max(0, this.slowTime - dt);

    let diff = this.targetYaw - this.yaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const maxTurn = this.turnSpeed * (this.boost ? 1.15 : 1) * dt;
    this.yaw += THREE.MathUtils.clamp(diff, -maxTurn, maxTurn);

    const speed = this.currentSpeed();
    this.position.x += Math.sin(this.yaw) * speed * dt;
    this.position.z += Math.cos(this.yaw) * speed * dt;
    this.position.y = surfaceY(this.position.x, this.position.z);

    this.trail.unshift(this.position.clone());
    const keep = this.targetLength * 7 + 8;
    if (this.trail.length > keep) this.trail.length = keep;

    this.syncMeshes(performance.now() * 0.001);
  }

  syncMeshes(time) {
    const spacing = 2;
    this.head.position.copy(this.position);
    this.head.rotation.order = "YXZ";
    this.head.rotation.y = this.yaw;
    this.head.rotation.x = Math.sin(time * 6) * 0.04;
    const tongue = this.head.getObjectByName("tongue");
    if (tongue) tongue.scale.z = 0.4 + Math.max(0, Math.sin(time * 10)) * 1.6;

    this.body.count = this.targetLength;
    for (let i = 0; i < this.targetLength; i += 1) {
      const idx = Math.min(this.trail.length - 1, (i + 1) * spacing);
      const p = this.trail[idx] || this.position;
      const prev = this.trail[Math.max(0, idx - 2)] || p;
      _fwd.subVectors(prev, p);
      if (_fwd.lengthSq() < 1e-6) _fwd.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
      _fwd.normalize();
      _zAxis.set(0, 0, 1);
      _quat.setFromUnitVectors(_zAxis, _fwd);
      const r = this.segmentRadius(i);
      const pulse = 1 + Math.sin(time * 8 - i * 0.35) * 0.03;
      _scale.set(r * 0.92 * pulse, r * 0.72 * pulse, r * 1.55);
      _pos.copy(p);
      _mat.compose(_pos, _quat, _scale);
      this.body.setMatrixAt(i, _mat);
      this.body.setColorAt(i, _color.set(i % 4 === 0 ? this.skin.dark : this.skin.body));
    }
    this.body.instanceMatrix.needsUpdate = true;
    if (this.body.instanceColor) this.body.instanceColor.needsUpdate = true;
  }

  hitsBoundary() {
    return Math.hypot(this.position.x, this.position.z) > ARENA_RADIUS - 0.7;
  }

  hitsSnake(other) {
    if (!other.alive) return false;
    const start = other === this ? 8 : 0;
    const len = other === this ? this.targetLength : other.targetLength;
    const spacing = 2;
    for (let i = start; i < len; i += 1) {
      const idx = Math.min(other.trail.length - 1, (i + 1) * spacing);
      const p = other.trail[idx];
      if (!p) continue;
      const r = this.radius * 0.72 + other.segmentRadius(i);
      if (this.position.distanceToSquared(p) < r * r) return true;
    }
    return false;
  }

  dispose(scene) {
    scene.remove(this.group);
    this.body.geometry.dispose();
    this.bodyMat.dispose();
  }
}

function buildHead(skin) {
  const head = new THREE.Group();
  const skullMat = new THREE.MeshStandardMaterial({
    color: skin.body,
    roughness: 0.38,
    metalness: 0.06,
  });
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 14), skullMat);
  skull.scale.set(1.05, 0.78, 1.35);
  skull.castShadow = true;
  head.add(skull);

  const snout = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), skullMat);
  snout.position.set(0, -0.04, 0.38);
  snout.scale.set(0.85, 0.62, 1.1);
  head.add(snout);

  const belly = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 10, 8),
    new THREE.MeshStandardMaterial({ color: skin.belly, roughness: 0.55 })
  );
  belly.position.set(0, -0.16, 0.05);
  belly.scale.set(0.9, 0.45, 1.2);
  head.add(belly);

  [-1, 1].forEach((side) => {
    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xf4f0d8, roughness: 0.2 })
    );
    eye.position.set(0.18 * side, 0.12, 0.28);
    const pupil = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 8, 8),
      new THREE.MeshStandardMaterial({ color: skin.eye, roughness: 0.15 })
    );
    pupil.position.set(0.02 * side, 0.01, 0.06);
    eye.add(pupil);
    head.add(eye);
  });

  const tongue = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, 0.015, 0.28),
    new THREE.MeshStandardMaterial({ color: 0xd94a5a, roughness: 0.4 })
  );
  tongue.name = "tongue";
  tongue.position.set(0, -0.05, 0.52);
  head.add(tongue);
  return head;
}
