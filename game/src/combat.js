// Combat: the pistol (raycast from the camera through the crosshair, with a
// tracer and impact puff), the punch (short arc in front of the player), and
// the thugs — mission enemies who chase the player on foot and swing back.
// Thugs drop cash when they fall.

import * as THREE from '../vendor/three.min.js';
import { COMBAT } from './config.js';
import { createPersonModel, createWalker, poseFall, posePunch, poseWalk, stepWalker } from './character.js';

export function createCombat(scene, city, random) {
  const thugs = [];
  const effects = [];
  let ammo = COMBAT.magSize;
  let reload = 0;
  let cooldown = 0;

  const tracerMat = new THREE.LineBasicMaterial({ color: 0xffe89a, transparent: true, opacity: 0.9 });
  const puffGeo = new THREE.SphereGeometry(0.22, 8, 6);
  const puffMat = new THREE.MeshBasicMaterial({ color: 0xffd28a, transparent: true, opacity: 0.9 });

  function spawnThug(x, z) {
    const model = createPersonModel(0x3a3a3a, 0x222222, 0xc89a6a);
    const walker = createWalker(scene, model, x, z, random() * Math.PI * 2);
    const thug = { ...walker, health: COMBAT.thugHealth, state: 'chase', swing: 0, down: 0, cash: 40 + Math.floor(random() * 40) };
    thugs.push(thug);
    return thug;
  }

  function spawnTracer(from, to) {
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const line = new THREE.Line(geo, tracerMat);
    scene.add(line);
    effects.push({ mesh: line, life: 0.08, kind: 'line' });
  }

  function spawnPuff(at) {
    const mesh = new THREE.Mesh(puffGeo, puffMat.clone());
    mesh.position.copy(at);
    scene.add(mesh);
    effects.push({ mesh, life: 0.25, kind: 'puff' });
  }

  function clearThugs() {
    for (const thug of thugs) scene.remove(thug.model.group);
    thugs.length = 0;
  }

  /**
   * Fire the pistol along the camera ray. targets: [{x, z, radius, onHit}].
   * Returns the cash dropped by a thug killed, or 0.
   */
  function shoot(origin, direction, targets, onShot) {
    if (cooldown > 0 || reload > 0) return 0;
    if (ammo <= 0) {
      reload = COMBAT.reloadTime;
      return 0;
    }
    ammo -= 1;
    cooldown = COMBAT.fireCooldown;
    if (onShot) onShot();
    const ray = new THREE.Raycaster(origin, direction, 0.1, COMBAT.pistolRange);
    let end = origin.clone().add(direction.clone().multiplyScalar(COMBAT.pistolRange));
    let killed = 0;
    // Hit the nearest target whose body the ray passes close to.
    let best = null;
    let bestDist = Infinity;
    for (const target of targets) {
      const toTarget = new THREE.Vector3(target.x - origin.x, 1.2 - origin.y, target.z - origin.z);
      const along = toTarget.dot(direction);
      if (along < 0 || along > COMBAT.pistolRange) continue;
      const closest = origin.clone().add(direction.clone().multiplyScalar(along));
      const miss = Math.hypot(closest.x - target.x, closest.z - target.z);
      if (miss < (target.radius || 0.8) && along < bestDist) {
        best = target;
        bestDist = along;
      }
    }
    if (best) {
      end = origin.clone().add(direction.clone().multiplyScalar(bestDist));
      spawnPuff(end);
      killed = best.onHit(COMBAT.pistolDamage) || 0;
    } else {
      // Impact against the world: stop at the first building the ray meets.
      const step = 2;
      const probe = origin.clone();
      for (let d = 0; d < COMBAT.pistolRange; d += step) {
        probe.add(direction.clone().multiplyScalar(step));
        const pos = { x: probe.x, z: probe.z };
        const before = { ...pos };
        if (city.resolveCircle(pos, 0.1) && (pos.x !== before.x || pos.z !== before.z)) {
          end = probe.clone();
          break;
        }
        if (probe.y < 0) {
          end = probe.clone();
          break;
        }
      }
      spawnPuff(end);
    }
    spawnTracer(origin.clone().add(direction.clone().multiplyScalar(1.2)), end);
    return killed;
  }

  /** Punch in front of the player; targets are the same shape as shoot's. Returns cash dropped. */
  function punch(playerX, playerZ, heading, targets) {
    let dropped = 0;
    for (const target of targets) {
      const dx = target.x - playerX;
      const dz = target.z - playerZ;
      const dist = Math.hypot(dx, dz);
      if (dist > 2.3) continue;
      const facing = dx * Math.sin(heading) + dz * Math.cos(heading);
      if (facing < 0) continue;
      dropped += target.onHit(34) || 0;
    }
    return dropped;
  }

  function step(dt, playerX, playerZ, onThugHit) {
    cooldown = Math.max(0, cooldown - dt);
    if (reload > 0) {
      reload -= dt;
      if (reload <= 0) ammo = COMBAT.magSize;
    }
    for (const effect of effects) {
      effect.life -= dt;
      if (effect.kind === 'puff') {
        effect.mesh.scale.multiplyScalar(1 + dt * 6);
        effect.mesh.material.opacity = Math.max(0, effect.life * 3.6);
      }
      if (effect.life <= 0) {
        scene.remove(effect.mesh);
        if (effect.mesh.geometry) effect.mesh.geometry.dispose();
      }
    }
    for (let i = effects.length - 1; i >= 0; i -= 1) if (effects[i].life <= 0) effects.splice(i, 1);

    for (const thug of thugs) {
      if (thug.state === 'down') {
        thug.down -= dt;
        poseFall(thug.model, 1);
        if (thug.down <= 0) {
          scene.remove(thug.model.group);
          thugs.splice(thugs.indexOf(thug), 1);
        }
        continue;
      }
      const dx = playerX - thug.x;
      const dz = playerZ - thug.z;
      const dist = Math.hypot(dx, dz);
      if (dist > COMBAT.thugRange) {
        stepWalker(thug, dt, dx, dz, false, city);
        thug.model.group.position.x = thug.x;
        thug.model.group.position.z = thug.z;
        thug.swing = 0;
      } else {
        thug.swing += dt;
        posePunch(thug.model, (thug.swing % 0.9) / 0.9);
        if (thug.swing >= 0.9) {
          thug.swing = 0;
          if (onThugHit) onThugHit(COMBAT.thugDamage);
        }
      }
    }
  }

  function thugTargets(onKill) {
    return thugs
      .filter((t) => t.state !== 'down')
      .map((thug) => ({
        x: thug.x,
        z: thug.z,
        radius: 0.9,
        onHit(damage) {
          thug.health -= damage;
          if (thug.health <= 0) {
            thug.state = 'down';
            thug.down = 2.5;
            poseFall(thug.model, 1);
            if (onKill) onKill(thug);
            return thug.cash;
          }
          return 0;
        },
      }));
  }

  return {
    get thugs() {
      return thugs;
    },
    get ammo() {
      return ammo;
    },
    get reloading() {
      return reload > 0;
    },
    spawnThug,
    clearThugs,
    shoot,
    punch,
    step,
    thugTargets,
    startReload() {
      if (ammo < COMBAT.magSize && reload <= 0) reload = COMBAT.reloadTime;
    },
  };
}
