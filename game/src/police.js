// The wanted system and the police pursuit. Stars rise with crimes — stealing
// cars, hitting pedestrians, shooting, mission heat — and fall when the
// player breaks line of sight long enough. Police cruisers spawn on the road
// graph, chase by road when far and directly when close, ram the player's car,
// and fill a bust meter when the player is on foot nearby. Spraying the car at
// Auto Shine clears the heat for cash.

import { POLICE } from './config.js';
import { createVehicle, stepDrivenCar } from './vehicles.js';

export function createPolice(scene, city, random) {
  let stars = 0;
  let unseen = 0;
  let blinking = false;
  let bust = 0;
  const cruisers = [];

  function addStars(n, onChange) {
    const before = stars;
    stars = Math.max(0, Math.min(POLICE.maxStars, stars + n));
    if (stars !== before) {
      unseen = 0;
      blinking = false;
      if (onChange) onChange(stars, before);
    }
  }

  function spawnCruiser(playerX, playerZ) {
    const node = city.roadGraph.nearestNode(playerX, playerZ);
    // Pick a node roughly a block or two away, on a road.
    let best = -1;
    let bestScore = Infinity;
    for (let i = 0; i < city.roadGraph.neighbours.length; i += 1) {
      const pos = city.roadGraph.nodePos(i);
      const dist = Math.hypot(pos.x - playerX, pos.z - playerZ);
      const score = Math.abs(dist - POLICE.spawnDistance) + random() * 30;
      if (score < bestScore) {
        bestScore = score;
        best = i;
      }
    }
    const pos = city.roadGraph.nodePos(best === -1 ? node : best);
    const car = createVehicle(scene, 'police', pos.x, pos.z, random() * Math.PI * 2, 0x1a1a1a);
    car.driver = 'police';
    cruisers.push(car);
    return car;
  }

  function removeCruiser(car) {
    scene.remove(car.model.group);
    cruisers.splice(cruisers.indexOf(car), 1);
  }

  /** Steer a cruiser toward the player, by road when far, directly when close. */
  function pursue(car, dt, playerX, playerZ, playerHeading, playerOnFoot) {
    const dx = playerX - car.x;
    const dz = playerZ - car.z;
    const dist = Math.hypot(dx, dz);
    // An on-foot player is cornered, not run down: stop nearby and let the
    // bust meter do its work.
    if (playerOnFoot && dist < 9) {
      stepDrivenCar(car, dt, car.speed > 1 ? -0.9 : 0, 0, false, city);
      return 0;
    }
    let targetX = playerX;
    let targetZ = playerZ;
    if (dist > 45) {
      // Head for the intersection nearest the player, then re-aim each step.
      const node = city.roadGraph.nodePos(city.roadGraph.nearestNode(playerX, playerZ));
      const myNode = city.roadGraph.nearestNode(car.x, car.z);
      const options = city.roadGraph.neighbours[myNode];
      let bestNode = myNode;
      let bestDist = Infinity;
      for (const option of options) {
        const pos = city.roadGraph.nodePos(option);
        const d = Math.hypot(pos.x - node.x, pos.z - node.z);
        if (d < bestDist) {
          bestDist = d;
          bestNode = option;
        }
      }
      const aim = city.roadGraph.nodePos(bestNode);
      targetX = aim.x;
      targetZ = aim.z;
      if (Math.hypot(aim.x - car.x, aim.z - car.z) < 8) {
        targetX = playerX;
        targetZ = playerZ;
      }
    } else if (!city.isOnRoad(car.x, car.z) && dist > 12) {
      // Off the roads, a straight line wedges the cruiser on a building:
      // get back to the nearest intersection first, then close in.
      const node = city.roadGraph.nodePos(city.roadGraph.nearestNode(car.x, car.z));
      targetX = node.x;
      targetZ = node.z;
    } else {
      // Close in: aim slightly ahead of the player.
      targetX = playerX + Math.sin(playerHeading) * 4;
      targetZ = playerZ + Math.cos(playerHeading) * 4;
    }
    const wanted = Math.atan2(targetX - car.x, targetZ - car.z);
    let diff = wanted - car.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const steer = Math.max(-1, Math.min(1, diff * 1.8));
    if (car.backing > 0) {
      // Reverse-out REPLACES forward driving: running both in one step makes
      // them cancel and the cruiser sits pinned at speed zero forever.
      car.backing -= dt;
      stepDrivenCar(car, dt, -0.9, -steer, false, city);
      car.stuck = 0;
      return 0;
    }
    const throttle = dist > 6 ? 1 : 0.2;
    const hitSpeed = stepDrivenCar(car, dt, throttle, steer, false, city);
    // Stuck means pressing the throttle while barely moving — a cruiser
    // creeping into a wall never has a hard impact to notice.
    if (throttle > 0.5 && Math.abs(car.speed) < 2) {
      car.stuck += dt;
      if (car.stuck > 1.0) {
        car.backing = 0.7;
        car.stuck = 0;
      }
    } else {
      car.stuck = Math.max(0, car.stuck - dt * 2);
    }
    return hitSpeed;
  }

  /**
   * One step. player: {x, z, heading, onFoot, speed}. Returns events:
   * busted (bool), rammed (impact speed), nearest (distance to closest cruiser).
   */
  function step(dt, player, onBustedProgress) {
    const wanted = Math.min(stars, 1 + Math.floor(stars / 2));
    while (cruisers.length < wanted && stars > 0) spawnCruiser(player.x, player.z);
    while (cruisers.length > wanted) removeCruiser(cruisers[cruisers.length - 1]);

    let nearest = Infinity;
    let rammed = 0;
    let seen = false;
    for (const car of cruisers) {
      const dist = Math.hypot(car.x - player.x, car.z - player.z);
      nearest = Math.min(nearest, dist);
      if (dist > POLICE.despawnDistance) {
        // Teleport the cruiser back into range instead of leaving the chase empty.
        const node = city.roadGraph.nodePos(city.roadGraph.nearestNode(player.x, player.z));
        car.x = node.x;
        car.z = node.z;
        car.speed = 0;
      }
      const hit = pursue(car, dt, player.x, player.z, player.heading, player.onFoot);
      if (dist < 4.5 && Math.abs(car.speed) > 4) rammed = Math.max(rammed, Math.abs(car.speed));
      if (dist < POLICE.sightRange) seen = true;
    }

    if (stars > 0) {
      if (seen) {
        unseen = 0;
        blinking = false;
      } else {
        unseen += dt;
        if (unseen > POLICE.loseSightTime * 0.5) blinking = true;
        if (unseen > POLICE.loseSightTime) {
          stars -= 1;
          unseen = 0;
          blinking = false;
        }
      }
    }

    // Bust meter: on foot, a cruiser sitting next to the player fills it.
    if (stars > 0 && player.onFoot && nearest < POLICE.bustRange && player.speed < 2) {
      bust += dt / POLICE.bustTime;
      if (onBustedProgress) onBustedProgress(bust);
    } else {
      bust = Math.max(0, bust - dt * 0.5);
    }
    return { busted: bust >= 1, rammed, nearest, blinking };
  }

  function clear() {
    stars = 0;
    unseen = 0;
    blinking = false;
    bust = 0;
    while (cruisers.length) removeCruiser(cruisers[0]);
  }

  return {
    get stars() {
      return stars;
    },
    get cruisers() {
      return cruisers;
    },
    get bust() {
      return bust;
    },
    addStars,
    step,
    clear,
  };
}
