// Ambient pedestrians: they stroll the sidewalks around blocks, pause to look
// at shop fronts, and flee when a gun goes off or a car bears down on them.
// A pedestrian hit by a car falls, gets up shaken, and walks away.

import { CITY, blockCentre, roadCoord } from './config.js';
import { createPersonModel, createWalker, poseFall, poseWalk, stepWalker } from './character.js';

const SHIRTS = [0xc84a4a, 0x4a7ac8, 0x4aa86a, 0xd8a83a, 0x8a5aa8, 0xe8e8e8, 0x3a9a9a, 0xc86a8a];
const PANTS = [0x2a3a5a, 0x3a3a3a, 0x5a4a3a, 0x6a7a8a];
const SKINS = [0xf2c8a0, 0xc89a6a, 0x8a5a3a, 0xe8b890, 0x6a4530];

export function createPedestrians(scene, city, random, count = 22) {
  const peds = [];
  for (let i = 0; i < count; i += 1) {
    const bx = Math.floor(random() * CITY.grid);
    const bz = Math.floor(random() * CITY.grid);
    const side = Math.floor(random() * 4);
    const half = (CITY.pitch - CITY.road) / 2 - 1;
    const cx = blockCentre(bx);
    const cz = blockCentre(bz);
    const x = cx + (side === 0 ? -half : side === 1 ? half : (random() - 0.5) * half * 2);
    const z = cz + (side === 2 ? -half : side === 3 ? half : (random() - 0.5) * half * 2);
    const model = createPersonModel(
      SHIRTS[Math.floor(random() * SHIRTS.length)],
      PANTS[Math.floor(random() * PANTS.length)],
      SKINS[Math.floor(random() * SKINS.length)],
    );
    const walker = createWalker(scene, model, x, z, random() * Math.PI * 2);
    peds.push({
      ...walker,
      state: 'walk',
      target: null,
      pause: random() * 4,
      fleeX: 0,
      fleeZ: 0,
      down: 0,
    });
  }

  function pickTarget(ped) {
    const bx = Math.floor(random() * CITY.grid);
    const bz = Math.floor(random() * CITY.grid);
    const half = (CITY.pitch - CITY.road) / 2 - 1;
    ped.target = {
      x: blockCentre(bx) + (random() - 0.5) * half * 2,
      z: blockCentre(bz) + (random() - 0.5) * half * 2,
    };
  }

  function scare(x, z, radius) {
    for (const ped of peds) {
      const dx = ped.x - x;
      const dz = ped.z - z;
      const dist = Math.hypot(dx, dz);
      if (dist < radius && ped.state !== 'down') {
        ped.state = 'flee';
        ped.fleeX = dx / (dist || 1);
        ped.fleeZ = dz / (dist || 1);
        ped.pause = 2 + random() * 2;
      }
    }
  }

  function step(dt, playerX, playerZ, playerSpeed) {
    for (const ped of peds) {
      if (ped.state === 'down') {
        ped.down -= dt;
        poseFall(ped.model, 1 - Math.max(0, ped.down) / 2);
        if (ped.down <= 0) {
          ped.state = 'walk';
          ped.model.group.rotation.x = 0;
          ped.model.group.position.y = 0;
          pickTarget(ped);
        }
        continue;
      }
      if (ped.state === 'flee') {
        ped.pause -= dt;
        stepWalker(ped, dt, ped.fleeX, ped.fleeZ, true, city);
        poseWalk(ped.model, ped.phase, 1);
        if (ped.pause <= 0) {
          ped.state = 'walk';
          pickTarget(ped);
        }
        continue;
      }
      // A fast car nearby sends them running.
      const dx = ped.x - playerX;
      const dz = ped.z - playerZ;
      if (playerSpeed > 12 && Math.hypot(dx, dz) < 9) {
        scare(playerX, playerZ, 10);
        continue;
      }
      if (ped.pause > 0) {
        ped.pause -= dt;
        poseWalk(ped.model, ped.phase, 0);
        continue;
      }
      if (!ped.target) pickTarget(ped);
      const tx = ped.target.x - ped.x;
      const tz = ped.target.z - ped.z;
      if (Math.hypot(tx, tz) < 2) {
        ped.target = null;
        ped.pause = 1 + random() * 5;
        continue;
      }
      stepWalker(ped, dt, tx, tz, false, city);
    }
  }

  /** Knock a pedestrian down (car hit); returns true when one was hit. */
  function hitAt(x, z, radius) {
    for (const ped of peds) {
      if (ped.state === 'down') continue;
      if (Math.hypot(ped.x - x, ped.z - z) < radius) {
        ped.state = 'down';
        ped.down = 2.5;
        scare(x, z, 18);
        return true;
      }
    }
    return false;
  }

  return { peds, step, scare, hitAt };
}
