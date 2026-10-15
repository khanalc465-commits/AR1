"use strict";

const scene = document.querySelector("#gameScene");
const ball = document.querySelector("#ball");

const startScreen = document.querySelector("#startScreen");
const startButton = document.querySelector("#startButton");
const restartButton = document.querySelector("#restartButton");
const gameOverScreen = document.querySelector("#gameOver");

const finalScore = document.querySelector("#finalScore");
const scoreDisplay = document.querySelector("#scoreDisplay");
const leftButton = document.querySelector("#leftButton");
const rightButton = document.querySelector("#rightButton");

const roads = [...document.querySelectorAll(".road")];
const roadLines = [...document.querySelectorAll(".road-line")];
const obstacles = [...document.querySelectorAll(".obstacle")];
const grass = document.querySelector("#infinite-grass");

// Game settings
const SIDE_SPEED = 10;
const ROAD_SPEED = 18;
const RECYCLE_DISTANCE = 160;
const PLAYER_START = { x: 0, y: 1, z: 5 };

let gameStarted = false;
let score = 0;
let lastTime = 0;
let animationId = 0;
let lastGrassUpdate = 0;

const controls = {
  left: false,
  right: false
};

// Keep the displayed score updated.
function updateScore() {
  scoreDisplay.textContent = `SCORE: ${score}`;
  finalScore.textContent = `Score: ${score}`;
}

// Movement controls
function setControl(direction, pressed) {
  if (direction === "left") {
    controls.left = pressed;
    leftButton.classList.toggle("pressed", pressed);
  } else {
    controls.right = pressed;
    rightButton.classList.toggle("pressed", pressed);
  }
}

function releaseControls() {
  setControl("left", false);
  setControl("right", false);
}

function bindTouchButton(button, direction) {
  button.addEventListener("pointerdown", event => {
    event.preventDefault();

    if (!gameStarted) return;

    setControl(direction, true);

    try {
      button.setPointerCapture(event.pointerId);
    } catch (_) {
      // Pointer capture is not essential.
    }
  });

  const release = event => {
    event.preventDefault();
    setControl(direction, false);
  };

  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("lostpointercapture", () => {
    setControl(direction, false);
  });

  button.addEventListener("contextmenu", event => {
    event.preventDefault();
  });
}

bindTouchButton(leftButton, "left");
bindTouchButton(rightButton, "right");

// Keyboard support for desktop.
document.addEventListener("keydown", event => {
  if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
    event.preventDefault();
    if (gameStarted) setControl("left", true);
  }

  if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
    event.preventDefault();
    if (gameStarted) setControl("right", true);
  }
});

document.addEventListener("keyup", event => {
  if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
    setControl("left", false);
  }

  if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
    setControl("right", false);
  }
});

window.addEventListener("blur", releaseControls);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) releaseControls();
});

// Wait for A-Frame and physics to initialize.
function waitForPhysics(callback) {
  if (ball.body) {
    callback();
    return;
  }

  setTimeout(() => waitForPhysics(callback), 100);
}

// Reset a physics body to its starting position.
function resetBody(el, position) {
  el.object3D.position.set(position.x, position.y, position.z);
  el.object3D.rotation.set(0, 0, 0);
  el.object3D.updateMatrixWorld(true);

  if (el.body) {
    el.body.position.set(position.x, position.y, position.z);
    el.body.velocity.set(0, 0, 0);
    el.body.angularVelocity.set(0, 0, 0);
    el.body.quaternion.set(0, 0, 0, 1);
    el.body.wakeUp();
  }
}

// Start or restart the game.
function startGame() {
  if (gameStarted) return;

  if (!ball.body) {
    startButton.disabled = true;
    startButton.textContent = "LOADING...";

    waitForPhysics(() => {
      startButton.disabled = false;
      startButton.textContent = "▶ START GAME";
      startGame();
    });

    return;
  }

  // Stop any previous game loop.
  cancelAnimationFrame(animationId);

  gameStarted = true;
  score = 0;
  lastTime = 0;
  lastGrassUpdate = 0;

  releaseControls();
  updateScore();

  // Reset the player.
  resetBody(ball, PLAYER_START);

  // Restore all road segments.
  roads.forEach((road, index) => {
    const z = 5 - index * 20;
    road.object3D.position.set(0, 0.1, z);
    road.object3D.updateMatrixWorld(true);
  });

  // Restore road markings.
  roadLines.forEach((line, index) => {
    const z = 5 - index * 20;
    line.object3D.position.set(0, 0.22, z);
    line.object3D.updateMatrixWorld(true);
  });

  // Reset obstacles and their collision state.
  const obstacleStarts = [
    { x: -3, y: 0.7, z: -20 },
    { x: 3, y: 0.7, z: -40 },
    { x: 0, y: 0.7, z: -60 },
    { x: -3, y: 0.7, z: -80 }
  ];

  obstacles.forEach((obstacle, index) => {
    const position = obstacleStarts[index];

    obstacle.dataset.hit = "false";
    obstacle.setAttribute("visible", true);

    obstacle.object3D.position.set(
      position.x,
      position.y,
      position.z
    );

    obstacle.object3D.updateMatrixWorld(true);
  });

  startScreen.classList.add("hidden");
  gameOverScreen.classList.add("hidden");

  animationId = requestAnimationFrame(gameLoop);
}

// End the game.
function endGame() {
  if (!gameStarted) return;

  gameStarted = false;
  releaseControls();

  cancelAnimationFrame(animationId);

  finalScore.textContent = `Score: ${score}`;
  gameOverScreen.classList.remove("hidden");
}

// Handle collisions with obstacles.
ball.addEventListener("collide", event => {
  if (!gameStarted) return;

  const hitObject = event.detail?.body?.el;

  if (!hitObject || !hitObject.classList.contains("obstacle")) {
    return;
  }

  if (hitObject.dataset.hit === "true") return;

  hitObject.dataset.hit = "true";

  // Preserve the original game's scoring behavior:
  // touching an obstacle gives one point and moves it away.
  score++;
  updateScore();

  hitObject.setAttribute("visible", false);

  const position = hitObject.object3D.position;
  position.z -= RECYCLE_DISTANCE;
  hitObject.object3D.updateMatrixWorld(true);

  // Reappear the obstacle after a short delay.
  setTimeout(() => {
    if (!hitObject.isConnected) return;

    hitObject.dataset.hit = "false";
    hitObject.setAttribute("visible", true);
  }, 1000);
});

// Move the endless road toward the player.
function moveWorld(deltaSeconds) {
  const movement = ROAD_SPEED * deltaSeconds;

  roads.forEach(road => {
    const position = road.object3D.position;

    position.z += movement;

    if (position.z > 17) {
      position.z -= RECYCLE_DISTANCE;
    }

    road.object3D.updateMatrixWorld(true);
  });

  roadLines.forEach(line => {
    const position = line.object3D.position;

    position.z += movement;

    if (position.z > 15) {
      position.z -= RECYCLE_DISTANCE;
    }

    line.object3D.updateMatrixWorld(true);
  });

  obstacles.forEach(obstacle => {
    if (obstacle.dataset.hit === "true") return;

    const position = obstacle.object3D.position;

    position.z += movement;

    if (position.z > 17) {
      position.z -= RECYCLE_DISTANCE;
    }

    obstacle.object3D.updateMatrixWorld(true);
  });
}

// Move the player left and right.
function movePlayer() {
  if (!ball.body) return;

  let direction = 0;

  if (controls.left && !controls.right) {
    direction = -1;
  } else if (controls.right && !controls.left) {
    direction = 1;
  }

  // Prevent movement beyond the edges of the road.
  const x = ball.object3D.position.x;

  if ((x <= -4 && direction < 0) ||
      (x >= 4 && direction > 0)) {
    direction = 0;
  }

  ball.body.velocity.x = direction * SIDE_SPEED;

  // Keep the player from moving forward or backward.
  ball.body.velocity.z = 0;

  // Visual rolling animation.
  ball.object3D.rotation.x += 0.08;
  ball.object3D.rotation.z = -direction * 0.15;
}

// Move the grass texture when available.
function moveGrassTexture() {
  if (!grass) return;

  const mesh = grass.getObject3D("mesh");

  if (!mesh || !mesh.material || !mesh.material.map) return;

  const texture = mesh.material.map;

  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.offset.y += 0.01;
}

// Main game loop.
function gameLoop(timestamp) {
  if (!gameStarted) return;

  if (!lastTime) lastTime = timestamp;

  // Clamp delta time to avoid huge jumps after lag.
  const deltaSeconds = Math.min((timestamp - lastTime) / 1000, 0.05);
  lastTime = timestamp;

  moveWorld(deltaSeconds);
  movePlayer();

  // Update grass less frequently for better mobile performance.
  if (timestamp - lastGrassUpdate > 40) {
    moveGrassTexture();
    lastGrassUpdate = timestamp;
  }

  // Falling off the road ends the game.
  if (ball.object3D.position.y < -1) {
    endGame();
    return;
  }

  animationId = requestAnimationFrame(gameLoop);
}

// Button events.
startButton.addEventListener("click", startGame);
restartButton.addEventListener("click", startGame);

// Initialize the scene.
scene.addEventListener("loaded", () => {
  startButton.disabled = false;
});

// Initialize the score display.
updateScore();