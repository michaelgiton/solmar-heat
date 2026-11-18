// Vehicles: box-built car models, arcade driving physics, and the traffic
// system. Traffic cars follow the road graph on the right-hand lane, slow for
// the car ahead, and keep out of the player's way only by braking — collisions
// are the player's problem. The player's car uses the same physics with
// steering, handbrake drift and off-road drag.

import * as THREE from '../vendor/three.min.js';
import { CITY, DRIVING } from './config.js';

export const CAR_TYPES = {
  sedan: { name: 'Solmar Sedan', length: 4.4, width: 1.9, height: 0.62, top: 1.0, accel: 1.0, colors: [0x8a9ab0, 0xc8c8c8, 0x3a4a5a, 0x7a2a2a, 0x4a6a4a] },
  taxi: { name: 'City Cab', length: 4.4, width: 1.9, height: 0.62, top: 0.95, accel: 1.0, colors: [0xf2c21a] },
  sports: { name: 'Comet SR', length: 4.2, width: 2.0, height: 0.45, top: 1.45, accel: 1.5, colors: [0xc83232, 0x2a6ac8, 0xf2f2f2, 0x1a1a1a] },
  van: { name: 'Delivery Van', length: 5.0, width: 2.1, height: 1.1, top: 0.8, accel: 0.75, colors: [0xe8e8e8, 0x4a7a9a, 0xc87a2a] },
  pickup: { name: 'Ranchero Pickup', length: 4.9, width: 2.0, height: 0.75, top: 0.95, accel: 0.9, colors: [0x6a4a2a, 0x2a4a3a, 0x8a8a7a] },
  police: { name: 'Police Cruiser', length: 4.5, width: 1.9, height: 0.62, top: 1.2, accel: 1.25, colors: [0x1a1a1a] },
};

const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 12);
wheelGeo.rotateZ(Math.PI / 2);
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const wheelMat = new THREE.MeshLambertMaterial({ color: 0x181818 });
const glassMat = new THREE.MeshLambertMaterial({ color: 0x9ac8e8 });
const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff8d8 });
const tailMat = new THREE.MeshBasicMaterial({ color: 0xc83232 });

function box(parent, w, h, d, x, y, z, material) {
  const mesh = new THREE.Mesh(boxGeo, material);
  mesh.scale.set(w, h, d);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

/** Build a car model of the given type and colour; returns the group plus its wheels and lights. */
export function createCarModel(type, colorHex) {
  const spec = CAR_TYPES[type];
  const group = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color: colorHex });
  const { length: L, width: W, height: H } = spec;
  box(group, W, H, L, 0, 0.55 + H / 2, 0, paint);
  box(group, W * 0.86, H * 0.85, L * 0.45, 0, 0.55 + H + H * 0.4, -L * 0.06, glassMat);
  if (type === 'van') box(group, W * 0.96, H * 0.9, L * 0.55, 0, 0.55 + H + H * 0.42, L * 0.16, paint);
  box(group, 0.34, 0.16, 0.06, -W * 0.32, 0.72, L / 2 + 0.02, lightMat);
  box(group, 0.34, 0.16, 0.06, W * 0.32, 0.72, L / 2 + 0.02, lightMat);
  box(group, 0.34, 0.16, 0.06, -W * 0.32, 0.72, -L / 2 - 0.02, tailMat);
  box(group, 0.34, 0.16, 0.06, W * 0.32, 0.72, -L / 2 - 0.02, tailMat);
  if (type === 'taxi') {
    box(group, 0.7, 0.22, 0.3, 0, 0.55 + H * 2 + 0.1, 0, new THREE.MeshBasicMaterial({ color: 0x222222 }));
  }
  let lightbar = null;
  if (type === 'police') {
    box(group, W * 1.02, 0.3, L * 0.5, 0, 0.55 + H * 0.5, 0, new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }));
    lightbar = new THREE.Group();
    lightbar.position.set(0, 0.55 + H * 2 + 0.08, 0);
    const red = box(lightbar, 0.5, 0.18, 0.3, -0.3, 0, 0, new THREE.MeshBasicMaterial({ color: 0xff2020 }));
    const blue = box(lightbar, 0.5, 0.18, 0.3, 0.3, 0, 0, new THREE.MeshBasicMaterial({ color: 0x2050ff }));
    lightbar.userData = { red, blue };
    group.add(lightbar);
  }
  const wheels = [];
  for (const [wx, wz] of [[-W / 2, L * 0.32], [W / 2, L * 0.32], [-W / 2, -L * 0.32], [W / 2, -L * 0.32]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.position.set(wx, 0.36, wz);
    group.add(wheel);
    wheels.push(wheel);
  }
  // Soft blob shadow under the car.
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(1, 20),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.scale.set(W * 0.75, L * 0.62, 1);
  shadow.position.y = 0.02;
  group.add(shadow);
  return { group, wheels, lightbar, spec, paint };
}

export function createVehicle(scene, type, x, z, heading, colorHex) {
  const spec = CAR_TYPES[type];
  const model = createCarModel(type, colorHex ?? spec.colors[0]);
  model.group.position.set(x, 0, z);
  model.group.rotation.y = heading;
  scene.add(model.group);
  return {
    type,
    spec,
    model,
    x,
    z,
    heading,
    speed: 0,
    steer: 0,
    wheelSpin: 0,
    driver: null, // 'player' | 'traffic' | 'police' | null (parked)
    route: null,
    routeIndex: 0,
    stuck: 0,
    backing: 0,
    sirenPhase: 0,
    damage: 0,
    parked: false,
  };
}

function syncModel(car) {
  car.model.group.position.set(car.x, 0, car.z);
  car.model.group.rotation.y = car.heading;
  for (let i = 0; i < 4; i += 1) {
    const wheel = car.model.wheels[i];
    wheel.rotation.x = car.wheelSpin;
    wheel.rotation.y = i < 2 ? car.steer * 0.5 : 0;
  }
  if (car.model.lightbar) {
    car.sirenPhase += 0.35;
    const on = Math.sin(car.sirenPhase) > 0;
    car.model.lightbar.userData.red.material.color.setHex(on ? 0xff2020 : 0x551010);
    car.model.lightbar.userData.blue.material.color.setHex(on ? 0x101055 : 0x2050ff);
  }
}

/**
 * One physics step for a driven car. throttle -1..1, steer -1..1, handbrake
 * loosens the grip for drifts. Returns true when the car hit a building.
 */
export function stepDrivenCar(car, dt, throttle, steer, handbrake, city) {
  const top = DRIVING.topSpeed * car.spec.top;
  const accel = DRIVING.accel * car.spec.accel;
  if (throttle > 0) car.speed += accel * throttle * dt;
  else if (throttle < 0) {
    if (car.speed > 0.5) car.speed += DRIVING.brake * throttle * dt;
    else car.speed = Math.max(-DRIVING.reverseTop, car.speed + accel * 0.6 * throttle * dt);
  } else {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 3.5 * dt);
  }
  if (!city.isOnRoad(car.x, car.z)) {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), DRIVING.offroadDrag * dt);
  }
  car.speed = Math.max(-DRIVING.reverseTop, Math.min(top, car.speed));
  const steerTarget = steer * (1 - Math.min(0.55, Math.abs(car.speed) / top * 0.55));
  car.steer += (steerTarget - car.steer) * Math.min(1, dt * 8);
  const grip = handbrake ? DRIVING.handbrakeGrip : DRIVING.grip;
  // Turn authority grows with speed, but a car with the throttle down can
  // always manoeuvre at low speed — otherwise a cruiser wedged on a building
  // can never rotate out of the wedge it drove into.
  const authority = Math.max(Math.min(1, Math.abs(car.speed) / 6), throttle !== 0 ? 0.3 : 0);
  const turnRate = (car.steer * DRIVING.steerRate * authority) * (car.speed >= 0 ? 1 : -1);
  car.heading += turnRate * dt * (handbrake ? 1.5 : 1);
  const forward = { x: Math.sin(car.heading), z: Math.cos(car.heading) };
  const slide = handbrake && Math.abs(car.speed) > 8 ? 0.35 : 0;
  const moveX = forward.x * car.speed * dt;
  const moveZ = forward.z * car.speed * dt;
  const pos = { x: car.x + moveX, z: car.z + moveZ };
  const hit = city.resolveCircle(pos, Math.max(car.spec.width, 2.2) / 2 + 0.4);
  if (hit) {
    const lost = Math.abs(car.speed);
    car.speed *= 0.45;
    car.damage += lost * 0.4;
    car.x = pos.x;
    car.z = pos.z;
    car.wheelSpin += car.speed * dt * 2.4;
    syncModel(car);
    return lost;
  }
  // Cars stay out of the ocean: the shore is a soft wall.
  if (pos.z > CITY.shore + 4) {
    pos.z = CITY.shore + 4;
    car.speed *= 0.6;
  }
  car.x = pos.x;
  car.z = pos.z;
  if (slide) {
    car.x += -forward.z * car.speed * slide * dt * 0.3 * Math.sign(car.steer);
    car.z += forward.x * car.speed * slide * dt * 0.3 * Math.sign(car.steer);
  }
  car.wheelSpin += car.speed * dt * 2.4;
  syncModel(car);
  return 0;
}

/** Pick a random route across the road graph, starting near (x, z). */
export function randomRoute(graph, x, z, length, random) {
  let node = graph.nearestNode(x, z);
  const route = [node];
  let prev = -1;
  for (let i = 0; i < length; i += 1) {
    const options = graph.neighbours[node].filter((n) => n !== prev);
    const next = options[Math.floor(random() * options.length)];
    route.push(next);
    prev = node;
    node = next;
  }
  return route;
}

/** Step one traffic car along its route; returns the new route when it needs one. */
export function stepTrafficCar(car, dt, city, others, random) {
  const graph = city.roadGraph;
  if (!car.route || car.routeIndex >= car.route.length - 1) {
    car.route = randomRoute(graph, car.x, car.z, 6, random);
    car.routeIndex = 0;
  }
  const target = graph.nodePos(car.route[car.routeIndex + 1]);
  const current = graph.nodePos(car.route[car.routeIndex]);
  // Right-hand lane: offset the target point sideways from the direction of travel.
  const dx = target.x - current.x;
  const dz = target.z - current.z;
  const len = Math.hypot(dx, dz) || 1;
  const lane = 3.4;
  const tx = target.x + (-dz / len) * lane * -1;
  const tz = target.z + (dx / len) * lane * -1;
  const toX = tx - car.x;
  const toZ = tz - car.z;
  const dist = Math.hypot(toX, toZ);
  if (dist < 6) {
    car.routeIndex += 1;
    return;
  }
  const wanted = Math.atan2(toX, toZ);
  let diff = wanted - car.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  // Slow for the car ahead.
  let clear = 14;
  for (const other of others) {
    if (other === car) continue;
    const ox = other.x - car.x;
    const oz = other.z - car.z;
    const ahead = ox * Math.sin(car.heading) + oz * Math.cos(car.heading);
    const side = Math.abs(ox * Math.cos(car.heading) - oz * Math.sin(car.heading));
    if (ahead > 0 && ahead < clear && side < 2.4) clear = ahead;
  }
  const targetSpeed = clear < 6 ? 0 : clear < 12 ? 4 : 11;
  const throttle = car.speed < targetSpeed ? 0.55 : car.speed > targetSpeed + 1 ? -0.8 : 0;
  const steer = Math.max(-1, Math.min(1, diff * 1.6));
  stepDrivenCar(car, dt, throttle, steer, false, city);
}
