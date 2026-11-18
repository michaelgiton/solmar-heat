// Solmar Heat: boot, the fixed-step loop, and everything that ties the
// systems together — the player on foot and in cars, entering and stealing,
// interactions (missions, respray, save), busts and wipeouts, coins, and the
// title / pause / end screens. ?seed=N fixes the city; ?shot=start|chase|
// drive|mission stages that screenshot scene instead of the title screen.

import * as THREE from '../vendor/three.min.js';
import { CITY, COMBAT, DRIVING, ECONOMY, PLAYER, STEP, blockCentre, roadCoord } from './config.js';
import { createRandom } from './random.js';
import { ACTION_CONFIRM, ACTION_FIRE, ACTION_INTERACT, ACTION_MUTE, ACTION_PAUSE, ACTION_PUNCH, ACTION_RELOAD, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createSave } from './save.js';
import { buildCity } from './city.js';
import { CAR_TYPES, createVehicle, stepDrivenCar, stepTrafficCar } from './vehicles.js';
import { createPersonModel, createWalker, posePunch, poseWalk, stepWalker } from './character.js';
import { createPedestrians } from './pedestrians.js';
import { createPolice } from './police.js';
import { createCombat } from './combat.js';
import { createMarker, createMissions } from './missions.js';
import { createHud } from './hud.js';
import { createCamera } from './camera.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 1337;
const random = createRandom(seed);

// Renderer, scene, camera.
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.3;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1600);
const cameraController = createCamera(camera);

const city = buildCity(scene, random);
const audio = createAudio();
const save = createSave();
const hud = createHud();
const input = createInput(canvas);
const peds = createPedestrians(scene, city, random);
const police = createPolice(scene, city, random);
const combat = createCombat(scene, city, random);

// The player.
const playerModel = createPersonModel(0xe8a83a, 0x2a3a5a, 0xc89a6a);
const garage = city.locations.garage;
// Spawn a step south of the garage approach, facing the garage and its
// mission marker, with the building, its sign and the street all in view —
// never nose-to-a-wall inside the building's edge.
const spawnPoint = { x: garage.approach.x, z: garage.approach.z + 7 };
const player = {
  walker: createWalker(scene, playerModel, spawnPoint.x, spawnPoint.z, Math.PI),
  health: PLAYER.maxHealth,
  cash: ECONOMY.startCash,
  onFoot: true,
  car: null,
  lastCar: null,
  punchTimer: 0,
  lastDamage: -99,
  shotFired: false,
};
player.walker.x = spawnPoint.x;
player.walker.z = spawnPoint.z;

// Vehicles: traffic, parked cars, and mission cars as they spawn.
const cars = [];
function spawnCar(type, x, z, heading, colorHex, owner) {
  const car = createVehicle(scene, type, x, z, heading, colorHex);
  car.owner = owner || 'civilian';
  car.stolen = false;
  cars.push(car);
  return car;
}
function spawnTraffic() {
  const types = ['sedan', 'sedan', 'taxi', 'van', 'pickup', 'sports'];
  for (let i = 0; i < 14; i += 1) {
    const type = types[Math.floor(random() * types.length)];
    const spec = CAR_TYPES[type];
    const node = Math.floor(random() * city.roadGraph.neighbours.length);
    const pos = city.roadGraph.nodePos(node);
    const car = spawnCar(type, pos.x + (random() - 0.5) * 20, pos.z + (random() - 0.5) * 20, random() * Math.PI * 2, spec.colors[Math.floor(random() * spec.colors.length)], 'civilian');
    car.driver = 'traffic';
  }
  for (let i = 0; i < 8; i += 1) {
    const type = types[Math.floor(random() * types.length)];
    const spec = CAR_TYPES[type];
    const node = Math.floor(random() * city.roadGraph.neighbours.length);
    const pos = city.roadGraph.nodePos(node);
    const car = spawnCar(type, pos.x + CITY.road / 2 - 2, pos.z + (random() - 0.5) * 30, 0, spec.colors[Math.floor(random() * spec.colors.length)], 'civilian');
    car.driver = null;
    car.parked = true;
  }
}
spawnTraffic();

// Missions and their hooks into the world.
let missionCar = null;
const startMarker = createMarker(scene);
const missions = createMissions(scene, city, {
  prepareMission(index) {
    if (index === 0) {
      missionCar = spawnCar('taxi', garage.x + 6, garage.z + 12, Math.PI, 0xf2c21a, 'player');
    } else if (index === 1) {
      const casino = city.locations.casino;
      missionCar = spawnCar('sports', casino.x + 18, casino.z + 14, Math.PI / 2, 0xc83232, 'casino');
      missionCar.isStealTarget = true;
    } else if (index === 2) {
      missionCar = spawnCar('van', garage.x - 6, garage.z + 12, Math.PI, 0xe8e8e8, 'player');
    }
  },
  spawnThugs(x, z, n) {
    // Ring around the approach point, clear of the building's collision box.
    for (let i = 0; i < n; i += 1) {
      const angle = (i / n) * Math.PI * 2 + random() * 0.6;
      const radius = 12 + random() * 6;
      combat.spawnThug(x + Math.cos(angle) * radius, z + Math.sin(angle) * radius);
    }
  },
  stealCarPosition() {
    return missionCar ? { x: missionCar.x, z: missionCar.z } : city.locations.casino;
  },
  addStars(n) {
    police.addStars(n, (stars) => {
      hud.setStars(stars, false);
      if (stars > 0) {
        audio.wantedUp();
        hud.message(`Wanted level: ${stars} star${stars > 1 ? 's' : ''}`);
      }
    });
  },
  onObjective(text) {
    hud.setObjective(text);
  },
  onDialogue(line) {
    hud.subtitle(line);
  },
  onStart(title) {
    hud.message(`Mission started: ${title}`);
    audio.click();
  },
  onComplete(reward, title) {
    player.cash += reward;
    hud.setCash(player.cash);
    hud.message(`Mission complete: ${title} — +$${reward}`);
    hud.setObjective(null);
    audio.missionComplete();
    writeSave();
  },
  onFail(reason) {
    hud.message(reason);
    hud.setObjective(null);
    audio.missionFailed();
    combat.clearThugs();
  },
});

let screen = 'title';
let time = 0;
let muted = false;
let endKind = '';
let vistaMode = false;
let frameCount = 0;
let lastImpact = -99;

/** Crash and ram damage, at most once a second — impacts, not grinding. */
function impactDamage(amount, cause) {
  if (time - lastImpact < 1) return;
  lastImpact = time;
  damagePlayer(amount, cause);
}

function playerPos() {
  return player.onFoot ? { x: player.walker.x, z: player.walker.z } : { x: player.car.x, z: player.car.z };
}
function playerHeading() {
  return player.onFoot ? player.walker.heading : player.car.heading;
}
function playerSpeed() {
  return player.onFoot ? player.walker.speed : Math.abs(player.car.speed);
}

function writeSave() {
  const pos = playerPos();
  const ok = save.save({
    cash: player.cash,
    missionsDone: missions.completedCount,
    x: pos.x,
    z: pos.z,
    heading: playerHeading(),
    health: player.health,
    coins: city.coins.filter((c) => c.taken).map((c) => c.index),
  });
  if (ok) hud.showSaved();
  return ok;
}

function applySave(data) {
  player.cash = data.cash ?? ECONOMY.startCash;
  player.health = data.health ?? PLAYER.maxHealth;
  missions.setCompleted(data.missionsDone || 0);
  const taken = new Set(data.coins || []);
  for (const coin of city.coins) {
    if (taken.has(coin.index)) {
      coin.taken = true;
      coin.mesh.visible = false;
    }
  }
  teleportPlayer(data.x ?? spawnPoint.x, data.z ?? spawnPoint.z, data.heading ?? Math.PI);
  hud.setCash(player.cash);
  hud.setHealth(player.health, PLAYER.maxHealth);
}

function teleportPlayer(x, z, heading) {
  if (player.car) {
    player.car.x = x;
    player.car.z = z;
    player.car.heading = heading;
    player.car.speed = 0;
    player.car.model.group.position.set(x, 0, z);
    player.car.model.group.rotation.y = heading;
  } else {
    player.walker.x = x;
    player.walker.z = z;
    player.walker.heading = heading;
    player.walker.model.group.position.set(x, 0, z);
    player.walker.model.group.rotation.y = heading;
  }
  const pos = playerPos();
  cameraController.snapTo(pos.x, 0, pos.z, heading);
}

function enterCar(car) {
  player.car = car;
  player.lastCar = car;
  player.onFoot = false;
  car.driver = 'player';
  car.parked = false;
  player.walker.model.group.visible = false;
  audio.door();
  cameraController.reset();
  const stolen = car.owner !== 'player' && !car.stolen;
  if (stolen) {
    car.stolen = true;
    if (!car.isStealTarget) {
      police.addStars(1, (stars) => hud.setStars(stars, false));
      hud.message(`You stole the ${car.spec.name}!`);
    }
  }
  missions.onEvent('carEntered', { carType: car.type, stolen: !!car.isStealTarget });
}

function exitCar() {
  const car = player.car;
  car.speed = 0;
  car.driver = null;
  const side = { x: car.x + Math.cos(car.heading) * 2.2, z: car.z - Math.sin(car.heading) * 2.2 };
  city.resolveCircle(side, PLAYER.radius);
  player.walker.x = side.x;
  player.walker.z = side.z;
  player.walker.heading = car.heading;
  player.walker.model.group.visible = true;
  player.walker.model.group.position.set(side.x, 0, side.z);
  player.walker.model.group.rotation.y = car.heading;
  player.car = null;
  player.onFoot = true;
  audio.door();
  cameraController.reset();
  cameraController.snapTo(side.x, 0, side.z, car.heading);
}

function damagePlayer(amount, cause) {
  if (screen !== 'play') return;
  player.health -= amount;
  player.lastDamage = time;
  cameraController.addShake(0.5);
  hud.setHealth(player.health, PLAYER.maxHealth);
  if (player.health <= 0) endRun('WASTED', cause || 'You were wasted. The medics patched you up — minus a fee.');
}

function endRun(kind, text) {
  endKind = kind;
  screen = 'end';
  const fine = Math.min(player.cash, kind === 'BUSTED' ? ECONOMY.bustFine : ECONOMY.wastedFine);
  player.cash -= fine;
  hud.setCash(player.cash);
  missions.failActive(kind === 'BUSTED' ? 'Busted — the job fell through.' : 'Wasted — the job fell through.');
  police.clear();
  combat.clearThugs();
  hud.setStars(0, false);
  hud.setBust(0);
  hud.showEnd(kind, `${text}  (Fine: $${fine})`);
  audio.missionFailed();
}

function respawn() {
  const spot = endKind === 'BUSTED' ? city.locations.police : city.locations.hospital;
  if (player.car) {
    player.car.driver = null;
    player.car = null;
  }
  player.onFoot = true;
  player.health = PLAYER.maxHealth;
  player.walker.model.group.visible = true;
  teleportPlayer(spot.approach.x, spot.approach.z, Math.PI);
  hud.setHealth(player.health, PLAYER.maxHealth);
  hud.hideEnd();
  screen = 'play';
}

function currentPrompt() {
  const pos = playerPos();
  if (!player.onFoot) {
    const spray = city.locations.spray.approach;
    if (police.stars > 0 && player.cash >= ECONOMY.sprayCost && Math.hypot(pos.x - spray.x, pos.z - spray.z) < 14) {
      return { text: `E — Respray ($${ECONOMY.sprayCost}, clears wanted)`, action: 'spray' };
    }
    return { text: 'E — Exit car', action: 'exit' };
  }
  let nearest = null;
  let nearestDist = DRIVING.enterRange;
  for (const car of cars) {
    if (car.driver === 'player') continue;
    const dist = Math.hypot(car.x - pos.x, car.z - pos.z);
    if (dist < nearestDist) {
      nearest = car;
      nearestDist = dist;
    }
  }
  if (nearest) {
    const verb = nearest.owner === 'player' ? 'Enter' : 'Take';
    return { text: `E — ${verb} the ${nearest.spec.name}`, action: 'enter', car: nearest };
  }
  const start = missions.nextStart;
  if (!missions.active && start && Math.hypot(pos.x - start.x, pos.z - start.z) < 14) {
    return { text: `E — Start mission: ${missions.nextTitle}`, action: 'mission' };
  }
  const safe = city.locations.safehouse.approach;
  if (Math.hypot(pos.x - safe.x, pos.z - safe.z) < 12) {
    return { text: 'E — Save game', action: 'save' };
  }
  return null;
}

function doPromptAction(prompt) {
  if (!prompt) return;
  if (prompt.action === 'enter') enterCar(prompt.car);
  else if (prompt.action === 'exit') exitCar();
  else if (prompt.action === 'mission') missions.startNext();
  else if (prompt.action === 'spray') {
    player.cash -= ECONOMY.sprayCost;
    hud.setCash(player.cash);
    police.clear();
    hud.setStars(0, false);
    const paint = player.car.model.paint;
    if (paint) paint.color.setHex(CAR_TYPES[player.car.type].colors[Math.floor(random() * CAR_TYPES[player.car.type].colors.length)]);
    hud.message('Fresh paint. The heat is off.');
    audio.pickup();
  } else if (prompt.action === 'save') {
    if (writeSave()) hud.message('Game saved.');
  }
}

function shootTargets() {
  const targets = combat.thugTargets((thug) => {
    player.cash += thug.cash;
    hud.setCash(player.cash);
    missions.onEvent('thugKilled');
  });
  for (const ped of peds.peds) {
    if (ped.state === 'down') continue;
    targets.push({
      x: ped.x,
      z: ped.z,
      radius: 0.9,
      onHit() {
        ped.state = 'down';
        ped.down = 2.5;
        peds.scare(ped.x, ped.z, 20);
        police.addStars(1, (stars) => hud.setStars(stars, false));
        return 0;
      },
    });
  }
  return targets;
}

function update(dt, inputState) {
  time += dt;
  const pos = playerPos();

  // Player movement.
  if (!player.onFoot) {
    const car = player.car;
    const impact = stepDrivenCar(car, dt, inputState.forward, inputState.strafe, inputState.handbrake, city);
    if (impact > 8) {
      impactDamage((impact - 8) * 1.1, 'You crashed.');
      audio.crash(impact);
      cameraController.addShake(0.6);
    } else if (impact > 3) {
      audio.crash(impact * 0.5);
    }
    // Car-to-car collisions.
    for (const other of [...cars, ...police.cruisers]) {
      if (other === car) continue;
      const dx = car.x - other.x;
      const dz = car.z - other.z;
      const dist = Math.hypot(dx, dz);
      const min = 3.4;
      if (dist < min && dist > 0.01) {
        const push = (min - dist) / 2;
        car.x += (dx / dist) * push;
        car.z += (dz / dist) * push;
        other.x -= (dx / dist) * push;
        other.z -= (dz / dist) * push;
        const closing = Math.abs(car.speed - other.speed);
        if (closing > 6) {
          audio.crash(closing);
          cameraController.addShake(0.5);
          impactDamage((closing - 6) * 0.5, 'You crashed.');
          car.speed *= 0.6;
          other.speed *= 0.6;
        }
      }
    }
    // Pedestrians under the wheels.
    if (Math.abs(car.speed) > 6 && peds.hitAt(car.x, car.z, 2.4)) {
      police.addStars(1, (stars) => hud.setStars(stars, false));
      hud.message('You hit a pedestrian!');
      cameraController.addShake(0.7);
      audio.crash(4);
    }
  } else {
    // On foot: move relative to the camera's facing.
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    const right = new THREE.Vector3(forward.z, 0, -forward.x);
    const moveX = forward.x * inputState.forward + right.x * inputState.strafe;
    const moveZ = forward.z * inputState.forward + right.z * inputState.strafe;
    stepWalker(player.walker, dt, moveX, moveZ, inputState.sprint, city);
    if (player.punchTimer > 0) {
      player.punchTimer -= dt;
      posePunch(playerModel, 1 - Math.max(0, player.punchTimer) / PLAYER.punchCooldown);
      if (player.punchTimer <= 0) poseWalk(playerModel, player.walker.phase, 0);
    }
    if (inputState.actions & ACTION_PUNCH && player.punchTimer <= 0) {
      player.punchTimer = PLAYER.punchCooldown;
      audio.punch();
      const dropped = combat.punch(player.walker.x, player.walker.z, player.walker.heading, shootTargets());
      if (dropped > 0) {
        player.cash += dropped;
        hud.setCash(player.cash);
      }
    }
    if (inputState.actions & ACTION_RELOAD) combat.startReload();
    if (inputState.firing) {
      const origin = camera.position.clone();
      const direction = new THREE.Vector3();
      camera.getWorldDirection(direction);
      const before = combat.ammo;
      const dropped = combat.shoot(origin, direction, shootTargets(), () => {
        audio.gunshot();
        cameraController.addShake(0.25);
        peds.scare(player.walker.x, player.walker.z, 26);
        if (!player.shotFired) {
          player.shotFired = true;
          police.addStars(1, (stars) => hud.setStars(stars, false));
        }
      });
      if (combat.ammo !== before && dropped > 0) {
        player.cash += dropped;
        hud.setCash(player.cash);
      }
    }
  }

  // World systems.
  for (const car of cars) {
    if (car.driver === 'traffic') stepTrafficCar(car, dt, city, cars, random);
  }
  peds.step(dt, pos.x, pos.z, playerSpeed());
  const policeResult = police.step(dt, { x: pos.x, z: pos.z, heading: playerHeading(), onFoot: player.onFoot, speed: playerSpeed() }, (bust) => hud.setBust(bust));
  if (policeResult.busted) {
    endRun('BUSTED', 'The cops caught you.');
    return;
  }
  if (policeResult.rammed > 8) {
    impactDamage((policeResult.rammed - 8) * 0.8, 'The police rammed you.');
    audio.crash(policeResult.rammed);
  }
  hud.setBust(police.bust);
  hud.setStars(police.stars, policeResult.blinking);
  combat.step(dt, pos.x, pos.z, (damage) => {
    damagePlayer(damage, 'You were beaten down.');
    audio.punch();
  });
  missions.step(dt, { playerX: pos.x, playerZ: pos.z, onFoot: player.onFoot, stars: police.stars, time });
  city.update(dt, time);

  // Health regen after a calm stretch.
  if (player.health < PLAYER.maxHealth && time - player.lastDamage > 8) {
    player.health = Math.min(PLAYER.maxHealth, player.health + 6 * dt);
    hud.setHealth(player.health, PLAYER.maxHealth);
  }

  // Coins.
  for (const coin of city.coins) {
    if (coin.taken) continue;
    if (Math.hypot(coin.x - pos.x, coin.z - pos.z) < 2.2) {
      coin.taken = true;
      coin.mesh.visible = false;
      player.cash += ECONOMY.coinValue;
      hud.setCash(player.cash);
      hud.message(`Sunset coin! +$${ECONOMY.coinValue}`);
      audio.pickup();
    }
  }

  // Interactions.
  const prompt = currentPrompt();
  hud.setPrompt(prompt ? prompt.text : null);
  if (inputState.actions & ACTION_INTERACT) doPromptAction(prompt);

  // Mission start marker.
  if (!missions.active && missions.nextStart) {
    const start = missions.nextStart;
    startMarker.show(start.x, start.z);
  } else {
    startMarker.hide();
  }
  startMarker.step(dt, time);

  // HUD + audio state.
  hud.setAmmo(combat.ammo, COMBAT.magSize, combat.reloading);
  hud.setObjective(missions.active ? missions.currentObjectiveText : missions.nextTitle ? `Next job: ${missions.nextTitle} — visit Theo's Garage` : 'All missions complete — Solmar is yours. Free roam!');
  hud.setCrosshair(player.onFoot && screen === 'play');
  if (!player.onFoot) hud.setSpeed(Math.abs(player.car.speed) * 3.6, player.car.spec.name);
  else hud.setSpeed(0, null);
  audio.engine(player.onFoot ? 0 : player.car.speed, Math.abs(inputState.forward), !player.onFoot);
  const nearestCop = policeResult.nearest;
  audio.siren(police.stars > 0 && nearestCop < 80 ? 1 - nearestCop / 80 : 0);
}

// The game object the screenshot staging drives.
const game = {
  city,
  missions,
  police,
  combat,
  player,
  spawnCar,
  putPlayerInCar(car) {
    if (player.car) exitCar();
    enterCar(car);
  },
  teleportPlayer,
  snapCamera() {
    const pos = playerPos();
    cameraController.snapTo(pos.x, 0, pos.z, playerHeading());
  },
  update,
};

// Screens and menus.
function startGame(fromSave) {
  audio.unlock();
  if (fromSave) {
    const data = save.load();
    if (data) applySave(data);
  } else {
    save.clear();
    missions.setCompleted(0);
    player.cash = ECONOMY.startCash;
    player.health = PLAYER.maxHealth;
    teleportPlayer(garage.x + 8, garage.z + 14, Math.PI);
    hud.setCash(player.cash);
    hud.setHealth(player.health, PLAYER.maxHealth);
  }
  hud.hideTitle();
  hud.hideEnd();
  screen = 'play';
  hud.message(fromSave ? 'Welcome back to Solmar.' : 'Welcome to Solmar. Visit Theo\'s Garage for work.');
}

document.getElementById('title-new').addEventListener('click', () => startGame(false));
document.getElementById('title-continue').addEventListener('click', () => startGame(true));
document.getElementById('pause-resume').addEventListener('click', () => {
  screen = 'play';
  hud.hidePause();
  audio.click();
});
document.getElementById('pause-save').addEventListener('click', () => {
  writeSave();
  hud.message('Game saved.');
});
document.getElementById('pause-quit').addEventListener('click', () => {
  screen = 'title';
  hud.hidePause();
  hud.showTitle(save.hasSave(), missions.completedCount);
});
document.getElementById('pause-mute').addEventListener('click', () => {
  muted = !muted;
  audio.setMuted(muted);
  hud.showPause(muted);
});
document.getElementById('end-continue').addEventListener('click', () => {
  audio.click();
  respawn();
});
canvas.addEventListener('pointerdown', () => audio.unlock());
window.addEventListener('keydown', () => audio.unlock(), { once: true });

// Fixed-step loop.
let last = performance.now();
let accumulator = 0;
let mapTick = 0;

function frame(now) {
  requestAnimationFrame(frame);
  const dtReal = Math.min((now - last) / 1000, MAX_FRAME);
  last = now;
  frameCount += 1;
  hud.step(dtReal);

  if (screen === 'play') {
    accumulator += dtReal;
    const actions = input.takeActions();
    const mouse = input.takeMouse();
    cameraController.orbit(mouse.x, mouse.y);
    if (actions & ACTION_PAUSE) {
      screen = 'paused';
      hud.showPause(muted);
      audio.engine(0, 0, false);
      audio.siren(0);
    } else if (actions & ACTION_MUTE) {
      muted = !muted;
      audio.setMuted(muted);
      hud.message(muted ? 'Sound off.' : 'Sound on.');
    }
    let first = true;
    // In shot mode the scripted inputs keep the staged scene alive (the chase
    // keeps driving) while the screenshot is taken.
    const shotDrive = shot === 'chase' ? 0.45 : shot === 'drive' ? 0.8 : 0;
    const baseInput = {
      forward: shot ? shotDrive : input.forward(),
      strafe: shot ? 0 : input.strafe(),
      sprint: shot ? false : input.sprint(),
      handbrake: shot ? false : input.handbrake(),
      // A click is a shot even if the button was released between frames:
      // the one-shot ACTION_FIRE flag carries it into this frame's steps.
      firing: shot ? false : input.isFiring() || !!(actions & ACTION_FIRE),
      actions: 0,
      mouseDX: 0,
      mouseDY: 0,
    };
    while (accumulator >= STEP && screen === 'play') {
      baseInput.actions = first ? actions : 0;
      first = false;
      update(STEP, baseInput);
      accumulator -= STEP;
    }
    if (screen !== 'play') accumulator = 0;
    const pos = playerPos();
    cameraController.update(dtReal, pos.x, 0, pos.z, playerHeading(), playerSpeed(), !player.onFoot);
  } else if (screen === 'title' && vistaMode) {
    const t = now / 1000;
    camera.position.set(30 + Math.sin(t * 0.05) * 8, 30, 330);
    camera.lookAt(-10, 12, 0);
    camera.fov = 55;
    camera.updateProjectionMatrix();
    city.update(dtReal, t);
  } else if (screen === 'title') {
    // Title backdrop: slow orbit over downtown.
    const t = now / 1000;
    camera.position.set(Math.sin(t * 0.06) * 130, 55, Math.cos(t * 0.06) * 130);
    camera.lookAt(0, 8, 0);
    city.update(dtReal, t);
  }

  // Minimap, a few times a second.
  mapTick += 1;
  if (mapTick % 3 === 0 && screen === 'play') {
    const pos = playerPos();
    hud.drawMinimap({
      playerX: pos.x,
      playerZ: pos.z,
      heading: playerHeading(),
      marker: missions.markerPosition || (missions.nextStart && !missions.active ? missions.nextStart : null),
      cops: police.cruisers,
      garage: city.locations.garage,
      playerCar: player.lastCar && player.onFoot ? player.lastCar : null,
    });
  }

  renderer.render(scene, camera);
  if (shot && frameCount === 3) window.__shotReady = true;
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && screen === 'play') {
    screen = 'paused';
    hud.showPause(muted);
  }
});

// Boot.
hud.setCash(player.cash);
hud.setHealth(player.health, PLAYER.maxHealth);
hud.setStars(0, false);
cameraController.snapTo(spawnPoint.x, 0, spawnPoint.z, Math.PI);
if (shot) {
  vistaMode = stageShot(shot, game) === 'vista';
  if (vistaMode) {
    hud.showTitle(false, 0);
  } else {
    screen = 'play';
    hud.hideTitle();
  }
} else {
  hud.showTitle(save.hasSave(), missions.completedCount);
}
requestAnimationFrame(frame);
