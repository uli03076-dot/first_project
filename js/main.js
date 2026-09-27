import * as THREE from "three";
import { createWorld, sampleBiome, sampleHeight } from "./world.js";
import { Snake } from "./snake.js";
import { FoodSystem, dropFoodAt } from "./food.js";
import { BotController } from "./ai.js";
import { Net } from "./net.js";

const HIGH_SCORE_KEY = "snake3d-high-score";

const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlayText = document.getElementById("overlay-text");
const startBtn = document.getElementById("start-btn");
const scoreEl = document.getElementById("score");
const lengthEl = document.getElementById("length");
const highEl = document.getElementById("high-score");
const effectsEl = document.getElementById("effects");
const boardEl = document.getElementById("board");

let highScore = Number(localStorage.getItem(HIGH_SCORE_KEY) || 0);
highEl.textContent = String(highScore);

const view = document.getElementById("view");
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
view.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8ec7e6);
scene.fog = new THREE.Fog(0x9fd0e8, 38, 92);

const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 200);
camera.position.set(0, 14, 18);

const hemi = new THREE.HemisphereLight(0xc8e7ff, 0x6a8f45, 1.05);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1d0, 1.35);
sun.position.set(18, 28, 12);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.near = 2;
sun.shadow.camera.far = 80;
sun.shadow.camera.left = -40;
sun.shadow.camera.right = 40;
sun.shadow.camera.top = 40;
sun.shadow.camera.bottom = -40;
scene.add(sun);

const world = createWorld(scene);
const clock = new THREE.Clock();
const pointer = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const hit = new THREE.Vector3();
const camTarget = new THREE.Vector3();
const camPos = new THREE.Vector3();

const keys = new Set();
let running = false;
let paused = false;
let pointerAim = null;

const snakes = [];
const bots = [];
let player;
let foods;

function addSnake(opts) {
  const snake = new Snake({ ...opts, scene });
  snakes.push(snake);
  return snake;
}

function randomSpawn(minR = 6, maxR = 18) {
  for (let i = 0; i < 50; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const r = minR + Math.random() * (maxR - minR);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const y = sampleHeight(x, z);
    if (sampleBiome(x, z, y) !== "grass" || y < 0.45) continue;
    return { x, z, yaw: Math.atan2(-x, -z) };
  }
  return { x: 8, z: 8, yaw: Math.atan2(-8, -8) };
}

function cameraFollow(dt, snap = false) {
  const fwd = new THREE.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw));
  camPos.copy(player.position).addScaledVector(fwd, -11);
  camPos.y = player.position.y + 9.6;
  camTarget.copy(player.position).addScaledVector(fwd, 3);
  camTarget.y += 0.2;
  if (snap) {
    camera.position.copy(camPos);
  } else {
    camera.position.lerp(camPos, 1 - Math.exp(-dt * 3.2));
  }
  camera.lookAt(camTarget);
  groundPlane.constant = -player.position.y;
}

function setupMatch() {
  snakes.splice(0).forEach((s) => s.dispose(scene));
  bots.length = 0;
  if (foods) {
    foods.items.forEach((i) => scene.remove(i.mesh));
  }
  foods = new FoodSystem(scene, 32);

  player = addSnake({
    id: Net.localId,
    name: "Ты",
    skinKey: "emerald",
    isPlayer: true,
  });
  player.score = 0;
  player.targetLength = 16;
  const p = randomSpawn(8, 14);
  player.spawn(p.x, p.z, p.yaw);

  const skins = ["sand", "river", "coral", "night", "sand"];
  const names = ["Песок", "Река", "Коралл", "Тень", "Дюна"];
  for (let i = 0; i < 5; i += 1) {
    const bot = addSnake({
      id: `bot-${i}`,
      name: names[i],
      skinKey: skins[i],
      isPlayer: false,
    });
    const s = randomSpawn(12, 28);
    bot.spawn(s.x, s.z, s.yaw);
    bots.push(new BotController(bot));
  }
}

function aimFromPointer() {
  if (!pointerAim) return;
  raycaster.setFromCamera(pointerAim, camera);
  if (raycaster.ray.intersectPlane(groundPlane, hit)) {
    const yaw = Math.atan2(hit.x - player.position.x, hit.z - player.position.z);
    player.setAim(yaw);
  }
}

function applyKeyboard(dt) {
  let turn = 0;
  if (keys.has("keya") || keys.has("arrowleft")) turn += 1;
  if (keys.has("keyd") || keys.has("arrowright")) turn -= 1;
  if (turn) {
    player.targetYaw = player.yaw + turn * 1.8;
    pointerAim = null;
  }
  player.boost = keys.has("shiftleft") || keys.has("shiftright") || keys.has("space");
  void dt;
}

function updateHud() {
  scoreEl.textContent = String(player.score);
  lengthEl.textContent = String(player.targetLength);
  if (player.score > highScore) {
    highScore = player.score;
    highEl.textContent = String(highScore);
    localStorage.setItem(HIGH_SCORE_KEY, String(highScore));
  }
  const pills = [];
  if (player.boostTime > 0) pills.push(`<span class="pill">Ягода ${player.boostTime.toFixed(1)}с</span>`);
  if (player.slowTime > 0) pills.push(`<span class="pill bad">Яд ${player.slowTime.toFixed(1)}с</span>`);
  effectsEl.innerHTML = pills.join("");

  const ranked = [...snakes].filter((s) => s.alive || s.isPlayer).sort((a, b) => b.score - a.score);
  boardEl.innerHTML = ranked
    .map((s) => `<li>${s.name}<b>${s.score}</b></li>`)
    .join("");
}

function endPlayer(reason) {
  running = false;
  overlayTitle.textContent = "Остров затих";
  overlayText.textContent = `${reason} Счёт: ${player.score}`;
  startBtn.textContent = "Ещё раз";
  overlay.classList.remove("hidden");
}

function tick(dt) {
  const t = performance.now() * 0.001;
  world.water.position.y = 0.06 + Math.sin(t * 0.7) * 0.04;
  world.water.material.opacity = 0.48 + Math.sin(t * 0.9) * 0.05;

  if (!running || paused) {
    renderer.render(scene, camera);
    return;
  }

  aimFromPointer();
  applyKeyboard(dt);
  player.update(dt);
  foods.update(dt);
  foods.collectNear(player);

  for (const bot of bots) {
    const snake = bot.snake;
    if (!snake.alive) {
      if (performance.now() > snake.respawnAt) {
        const s = randomSpawn(10, 26);
        snake.targetLength = 12 + Math.floor(Math.random() * 6);
        snake.score = Math.floor(snake.score * 0.35);
        snake.spawn(s.x, s.z, s.yaw);
      }
      continue;
    }
    bot.update(dt, { foods: foods.items, snakes });
    snake.update(dt);
    foods.collectNear(snake);
  }

  if (player.alive && player.hitsBoundary()) {
    player.kill();
    endPlayer("Ты выполз за край острова.");
  }
  if (player.alive) {
    for (const other of snakes) {
      if (player.hitsSnake(other)) {
        player.kill();
        endPlayer(other === player ? "Ты укусил себя." : `Столкновение с «${other.name}».`);
        break;
      }
    }
  }

  for (const snake of snakes) {
    if (!snake.alive || snake.isPlayer) continue;
    if (snake.hitsBoundary()) {
      dropFoodAt(scene, foods, snake.position);
      snake.kill();
      continue;
    }
    for (const other of snakes) {
      if (snake.hitsSnake(other)) {
        dropFoodAt(scene, foods, snake.position);
        snake.kill();
        break;
      }
    }
  }

  updateHud();

  cameraFollow(dt);
  renderer.render(scene, camera);
}

function loop() {
  const dt = Math.min(0.033, clock.getDelta());
  tick(dt);
  requestAnimationFrame(loop);
}

function startGame() {
  setupMatch();
  running = true;
  paused = false;
  overlay.classList.add("hidden");
  clock.getDelta();
  cameraFollow(0, true);
  updateHud();
}

startBtn.addEventListener("click", startGame);

window.addEventListener("keydown", (e) => {
  keys.add(e.code.toLowerCase());
  if (e.code === "Space") e.preventDefault();
  if (e.code === "KeyP") paused = !paused;
  if (!running && (e.code === "Space" || e.code === "Enter")) startGame();
});
window.addEventListener("keyup", (e) => keys.delete(e.code.toLowerCase()));

function setPointer(event, down) {
  const rect = renderer.domElement.getBoundingClientRect();
  const x = (("touches" in event ? event.touches[0].clientX : event.clientX) - rect.left) / rect.width;
  const y = (("touches" in event ? event.touches[0].clientY : event.clientY) - rect.top) / rect.height;
  pointer.set(x * 2 - 1, -(y * 2 - 1));
  pointerAim = pointer.clone();
  if (down && !running) startGame();
}

renderer.domElement.addEventListener("pointermove", (e) => setPointer(e, false));
renderer.domElement.addEventListener("pointerdown", (e) => setPointer(e, true));
renderer.domElement.addEventListener("touchmove", (e) => {
  e.preventDefault();
  setPointer(e, false);
}, { passive: false });

window.addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

setupMatch();
cameraFollow(0, true);
loop();
