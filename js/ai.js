import { ARENA_RADIUS } from "./world.js";

/** Same controller contract a future RemotePlayerController would use. */
export class BotController {
  constructor(snake) {
    this.snake = snake;
    this.thinkIn = 0;
    this.aim = snake.yaw;
  }

  update(dt, { foods, snakes }) {
    this.thinkIn -= dt;
    if (this.thinkIn <= 0) {
      this.aim = this.chooseYaw(foods, snakes);
      this.thinkIn = 0.18 + Math.random() * 0.22;
    }
    this.snake.setAim(this.aim);
    const edge = Math.hypot(this.snake.position.x, this.snake.position.z);
    this.snake.boost = edge > ARENA_RADIUS - 7;
  }

  chooseYaw(foods, snakes) {
    const head = this.snake.position;
    const toCenter = Math.atan2(-head.x, -head.z);
    if (Math.hypot(head.x, head.z) > ARENA_RADIUS - 8) return toCenter;

    for (const other of snakes) {
      if (other === this.snake || !other.alive) continue;
      const dx = other.position.x - head.x;
      const dz = other.position.z - head.z;
      if (dx * dx + dz * dz < 12) {
        return Math.atan2(-dx, -dz) + (Math.random() - 0.5);
      }
    }

    let best = null;
    let bestScore = -Infinity;
    for (const food of foods) {
      if (food.type.id === "shroom" && this.snake.targetLength < 20) continue;
      const dx = food.mesh.position.x - head.x;
      const dz = food.mesh.position.z - head.z;
      const dist = Math.hypot(dx, dz) + 0.01;
      const value = food.type.score + food.type.grow * 6;
      const score = value / dist + Math.random() * 0.2;
      if (score > bestScore) {
        bestScore = score;
        best = Math.atan2(dx, dz);
      }
    }
    return best ?? this.snake.yaw + (Math.random() - 0.5) * 0.6;
  }
}

/** Placeholder for the future online mode: apply snapshots instead of local AI. */
export class RemotePlayerController {
  constructor(snake) {
    this.snake = snake;
    this.snapshot = null;
  }

  applySnapshot(snap) {
    this.snapshot = snap;
  }

  update() {
    if (!this.snapshot) return;
    this.snake.position.set(this.snapshot.x, this.snapshot.y, this.snapshot.z);
    this.snake.yaw = this.snapshot.yaw;
    this.snake.targetYaw = this.snapshot.yaw;
    this.snake.targetLength = this.snapshot.length;
    this.snake.score = this.snapshot.score;
    this.snake.alive = this.snapshot.alive;
  }
}
