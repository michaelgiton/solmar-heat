// The screenshot scenes behind ?shot=start|chase|drive|mission. Each one sets
// the real game state — the player's car, the police, the mission, the thugs —
// then plays the real rules forward for a short while with scripted inputs, so
// the frame is what the game genuinely looks like mid-play and the same seed
// always gives the same frame. The HUD, minimap and objective banner are the
// real ones; nothing is composited. The camera snaps to the staged position
// so the first rendered frame is already the shot.

import { STEP } from './config.js';

function scripted(forward = 0, strafe = 0) {
  return { forward, strafe, sprint: false, handbrake: false, firing: false, actions: 0, mouseDX: 0, mouseDY: 0 };
}

function runSteps(game, count, input) {
  for (let i = 0; i < count; i += 1) game.update(STEP, input);
}

/** Stage the named scene; returns the camera mode ('vista' or 'chase'). */
export function stageShot(name, game) {
  const { city, missions } = game;
  if (name === 'chase') {
    // Mission 5's escape: three stars, cruisers closing in, the player
    // flooring a Comet SR up the avenue with the objective banner up.
    missions.setCompleted(4);
    missions.startNext();
    const car = game.spawnCar('sports', 0, 120, Math.PI, 0xc83232, 'player');
    game.putPlayerInCar(car);
    game.teleportPlayer(0, 120, Math.PI);
    runSteps(game, 30, scripted(1, 0));
    // Stage the cruisers where the chase camera can see them: one pulling
    // alongside just ahead, one coming head-on down the avenue.
    const px = game.player.car.x;
    const pz = game.player.car.z;
    const spots = [
      { dx: -6, dz: -16, heading: Math.PI, speed: 25 },
      { dx: -2, dz: -200, heading: 0, speed: 25 },
    ];
    game.police.cruisers.forEach((cruiser, i) => {
      const spot = spots[i % spots.length];
      cruiser.x = px + spot.dx;
      cruiser.z = pz + spot.dz;
      cruiser.heading = spot.heading;
      cruiser.speed = spot.speed;
    });
    runSteps(game, 40, scripted(0.45, 0));
    game.snapCamera();
    return 'chase';
  }
  if (name === 'drive') {
    // Free roam downtown: the player cruising a sedan east along the avenue
    // with traffic, pedestrians and towers around.
    const car = game.spawnCar('sedan', -162, 0, Math.PI / 2, 0x8a9ab0, 'player');
    game.putPlayerInCar(car);
    game.teleportPlayer(-162, 0, Math.PI / 2);
    runSteps(game, 70, scripted(0.8, 0));
    game.snapCamera();
    return 'chase';
  }
  if (name === 'mission') {
    // The Big Score: on foot at the Golden Palms approach, guards closing in,
    // the objective banner counting the grab.
    missions.setCompleted(5);
    missions.startNext();
    const approach = city.locations.casino.approach;
    // Just outside the hold radius: the grab stays on screen while the guards close in.
    game.teleportPlayer(approach.x, approach.z + 10, Math.PI);
    runSteps(game, 60, scripted());
    game.snapCamera();
    return 'chase';
  }
  // start: the title screen over a vista of the city from the beach.
  return 'vista';
}
