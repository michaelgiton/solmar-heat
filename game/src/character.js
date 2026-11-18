// People: box-built characters with a procedural walk cycle (arms and legs
// swing with the stride, the body bobs), plus the on-foot controller: walking,
// running, turning toward the camera's facing, and the punch animation.

import * as THREE from '../vendor/three.min.js';
import { PLAYER } from './config.js';

const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const headGeo = new THREE.BoxGeometry(0.42, 0.46, 0.42);
const limbGeo = new THREE.BoxGeometry(0.16, 0.62, 0.16);
limbGeo.translate(0, -0.31, 0);

function limb(material, x, y) {
  const mesh = new THREE.Mesh(limbGeo, material);
  mesh.position.set(x, y, 0);
  return mesh;
}

/** Build a person: head, torso, arms, legs, blob shadow. Returns the group and its joints. */
export function createPersonModel(shirt, pants, skin) {
  const group = new THREE.Group();
  const shirtMat = new THREE.MeshLambertMaterial({ color: shirt });
  const pantsMat = new THREE.MeshLambertMaterial({ color: pants });
  const skinMat = new THREE.MeshLambertMaterial({ color: skin });
  const torso = new THREE.Mesh(boxGeo, shirtMat);
  torso.scale.set(0.56, 0.66, 0.3);
  torso.position.y = 1.18;
  group.add(torso);
  const head = new THREE.Mesh(headGeo, skinMat);
  head.position.y = 1.74;
  group.add(head);
  const hair = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0x2a2018 }));
  hair.scale.set(0.44, 0.14, 0.44);
  hair.position.y = 1.99;
  group.add(hair);
  const armL = limb(skinMat, -0.37, 1.48);
  const armR = limb(skinMat, 0.37, 1.48);
  const legL = limb(pantsMat, -0.15, 0.85);
  const legR = limb(pantsMat, 0.15, 0.85);
  group.add(armL, armR, legL, legR);
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.5, 16),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  group.add(shadow);
  return { group, head, torso, armL, armR, legL, legR };
}

/** Pose the walk cycle: phase advances with distance walked, amplitude with speed. */
export function poseWalk(model, phase, speedFactor) {
  const swing = Math.sin(phase) * 0.7 * speedFactor;
  model.legL.rotation.x = swing;
  model.legR.rotation.x = -swing;
  model.armL.rotation.x = -swing * 0.8;
  model.armR.rotation.x = swing * 0.8;
  model.group.position.y = Math.abs(Math.cos(phase)) * 0.05 * speedFactor;
}

/** Pose a punch: the right arm extends forward over the swing's first half. */
export function posePunch(model, t) {
  const extend = t < 0.4 ? t / 0.4 : 1 - (t - 0.4) / 0.6;
  model.armR.rotation.x = -Math.PI / 2 * Math.max(0, extend);
  model.armL.rotation.x = 0.4 * Math.max(0, extend);
}

/** Pose a fall: the whole body tips back and sinks. */
export function poseFall(model, t) {
  model.group.rotation.x = -Math.PI / 2 * Math.min(1, t * 2);
  model.group.position.y = -0.2 * Math.min(1, t * 2);
}

export function createWalker(scene, model, x, z, heading) {
  model.group.position.set(x, 0, z);
  model.group.rotation.y = heading;
  scene.add(model.group);
  return {
    model,
    x,
    z,
    heading,
    speed: 0,
    phase: 0,
    punchTimer: 0,
    fallTimer: -1,
  };
}

/** Move a walker on foot; returns true when it bumped into a building. */
export function stepWalker(walker, dt, moveX, moveZ, running, city) {
  const speed = running ? PLAYER.runSpeed : PLAYER.walkSpeed;
  const mag = Math.hypot(moveX, moveZ);
  if (mag > 0.01) {
    const nx = moveX / mag;
    const nz = moveZ / mag;
    const wanted = Math.atan2(nx, nz);
    let diff = wanted - walker.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    walker.heading += diff * Math.min(1, dt * PLAYER.turnSpeed);
    const pos = { x: walker.x + nx * speed * dt, z: walker.z + nz * speed * dt };
    const hit = city.resolveCircle(pos, PLAYER.radius);
    walker.x = pos.x;
    walker.z = pos.z;
    walker.speed = speed;
    walker.phase += speed * dt * 1.6;
    walker.model.group.position.x = walker.x;
    walker.model.group.position.z = walker.z;
    walker.model.group.rotation.y = walker.heading;
    if (walker.punchTimer <= 0) poseWalk(walker.model, walker.phase, 1);
    return hit;
  }
  walker.speed = 0;
  if (walker.punchTimer <= 0) poseWalk(walker.model, walker.phase, 0);
  walker.model.group.position.x = walker.x;
  walker.model.group.position.z = walker.z;
  return false;
}
