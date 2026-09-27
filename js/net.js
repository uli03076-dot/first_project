/** Offline session with the same actor API a future online lobby would use. */
export const Net = {
  mode: "offline",
  localId: "player-1",

  serializeSnake(snake) {
    return {
      id: snake.id,
      name: snake.name,
      x: snake.position.x,
      z: snake.position.z,
      y: snake.position.y,
      yaw: snake.yaw,
      length: snake.targetLength,
      score: snake.score,
      alive: snake.alive,
      skin: snake.skinKey,
    };
  },

  applySnapshot(snake, snap) {
    snake.position.set(snap.x, snap.y, snap.z);
    snake.yaw = snap.yaw;
    snake.targetLength = snap.length;
    snake.score = snap.score;
    snake.alive = snap.alive;
  },
};
