import * as THREE from "three";
import { ARENA_RADIUS, sampleBiome, surfaceY } from "./world.js";

export const FOOD_TYPES = {
  apple: { id: "apple", label: "Яблоко", score: 12, grow: 1, color: 0xe23d3d },
  berry: { id: "berry", label: "Ягода", score: 8, grow: 0, boost: 4.5, color: 0x7c3aed },
  gold: { id: "gold", label: "Золото", score: 45, grow: 2, color: 0xf5c542 },
  fish: { id: "fish", label: "Рыба", score: 20, grow: 1, biome: "water", color: 0x5dade2 },
  cactus: { id: "cactus", label: "Кактус", score: 16, grow: 1, biome: "sand", color: 0xe8739a },
  egg: { id: "egg", label: "Яйцо", score: 28, grow: 3, color: 0xf3e6c2 },
  shroom: { id: "shroom", label: "Мухомор", score: -8, grow: -2, slow: 3.5, color: 0xd94a4a },
};

export class FoodSystem {
  constructor(scene, count = 28) {
    this.scene = scene;
    this.items = [];
    for (let i = 0; i < count; i += 1) this.spawn();
  }

  randomType() {
    const roll = Math.random();
    if (roll < 0.08) return FOOD_TYPES.gold;
    if (roll < 0.16) return FOOD_TYPES.egg;
    if (roll < 0.28) return FOOD_TYPES.berry;
    if (roll < 0.38) return FOOD_TYPES.shroom;
    if (roll < 0.5) return FOOD_TYPES.fish;
    if (roll < 0.62) return FOOD_TYPES.cactus;
    return FOOD_TYPES.apple;
  }

  randomPoint(biome) {
    for (let i = 0; i < 30; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * (ARENA_RADIUS - 3);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const b = sampleBiome(x, z);
      if (!biome || b === biome) return { x, z, y: surfaceY(x, z) };
    }
    return { x: 0, z: 0, y: surfaceY(0, 0) };
  }

  spawn(type = this.randomType()) {
    const p = this.randomPoint(type.biome);
    const mesh = makeFoodMesh(type);
    mesh.position.set(p.x, p.y + 0.12, p.z);
    this.scene.add(mesh);
    const item = { type, mesh, bob: Math.random() * Math.PI * 2 };
    this.items.push(item);
    return item;
  }

  update(dt) {
    const t = performance.now() * 0.001;
    for (const item of this.items) {
      item.bob += dt;
      item.mesh.position.y = surfaceY(item.mesh.position.x, item.mesh.position.z) + 0.18 + Math.sin(t * 2 + item.bob) * 0.08;
      item.mesh.rotation.y += dt * 0.8;
    }
  }

  collectNear(snake) {
    const reach = snake.radius + 0.55;
    for (let i = this.items.length - 1; i >= 0; i -= 1) {
      const item = this.items[i];
      if (snake.position.distanceTo(item.mesh.position) < reach) {
        snake.eat(item.type);
        this.scene.remove(item.mesh);
        this.items.splice(i, 1);
        this.spawn();
        return item.type;
      }
    }
    return null;
  }
}

function makeFoodMesh(type) {
  const g = new THREE.Group();
  const mat = (color, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.05, ...extra });

  if (type.id === "apple") {
    const fruit = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 12), mat(type.color));
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), mat(0x3d8f2a));
    leaf.position.set(0.12, 0.22, 0);
    leaf.scale.set(1, 0.3, 0.6);
    g.add(fruit, leaf);
  } else if (type.id === "berry") {
    for (let i = 0; i < 4; i += 1) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), mat(type.color));
      b.position.set(Math.cos(i) * 0.1, 0.05 + (i % 2) * 0.08, Math.sin(i) * 0.1);
      g.add(b);
    }
  } else if (type.id === "gold") {
    g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.26, 0), mat(type.color, { metalness: 0.7, roughness: 0.2 })));
  } else if (type.id === "fish") {
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), mat(type.color));
    body.scale.set(1.4, 0.7, 0.7);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.22, 6), mat(0x2e86ab));
    tail.rotation.z = Math.PI / 2;
    tail.position.x = -0.28;
    g.add(body, tail);
  } else if (type.id === "cactus") {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.5, 8), mat(0x3f8f4a));
    const fruit = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), mat(type.color));
    fruit.position.y = 0.32;
    g.add(body, fruit);
  } else if (type.id === "egg") {
    const egg = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), mat(type.color, { roughness: 0.35 }));
    egg.scale.set(0.85, 1.1, 0.85);
    g.add(egg);
  } else {
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.22, 8), mat(0xf2efe4));
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), mat(0xe23d3d));
    cap.scale.set(1, 0.45, 1);
    cap.position.y = 0.16;
    const spot = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), mat(0xf8f4ea));
    spot.position.set(0.08, 0.22, 0.06);
    g.add(stem, cap, spot);
  }

  g.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return g;
}

export function dropFoodAt(scene, foodSystem, position, n = 2) {
  for (let i = 0; i < n; i += 1) {
    const type = Math.random() < 0.7 ? FOOD_TYPES.apple : FOOD_TYPES.berry;
    const item = foodSystem.spawn(type);
    item.mesh.position.set(
      position.x + (Math.random() - 0.5) * 1.4,
      surfaceY(position.x, position.z),
      position.z + (Math.random() - 0.5) * 1.4
    );
  }
}
