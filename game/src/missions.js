// The story: Maya Reyes, driver-for-hire in Solmar, working off a debt to her
// uncle Theo's garage. Six missions, each a list of objectives — drive
// somewhere, steal a car, beat the clock, fight thugs, lose the cops, pull the
// big score. The mission controller tracks the current objective, drives the
// 3D marker beacon, queues dialogue lines, and reports completion or failure
// through callbacks so the main loop stays in charge of the world.

import * as THREE from '../vendor/three.min.js';

const MISSION_DEFS = [
  {
    title: 'First Fare',
    giver: 'Theo',
    reward: 250,
    intro: [
      'Theo: Maya! The cab is out front. Mrs. Alvarez waits at the Palm Court.',
      'Theo: She tips well and complains loudly. Do not keep her waiting.',
    ],
    objectives: [
      { type: 'enterCar', carType: 'taxi', text: 'Get in the cab' },
      { type: 'driveTo', place: 'hotel', radius: 10, text: 'Pick up Mrs. Alvarez at the Palm Court Hotel' },
      { type: 'driveTo', place: 'marina', radius: 12, text: 'Drop her at the Marina' },
    ],
  },
  {
    title: 'A Faster Ride',
    giver: 'Theo',
    reward: 400,
    intro: [
      'Theo: A client wants a Comet SR. No questions, cash on delivery.',
      'Theo: There is one parked by the casino. Bring it to the garage.',
      'Theo: And Maya — try not to attract attention.',
    ],
    objectives: [
      { type: 'goto', place: 'casino', radius: 14, text: 'Find the Comet SR by the casino' },
      { type: 'stealCar', text: 'Take the Comet SR' },
      { type: 'deliver', place: 'garage', radius: 12, text: 'Deliver the Comet to the garage' },
    ],
  },
  {
    title: 'Rush Hour',
    giver: 'Theo',
    reward: 500,
    intro: [
      'Theo: Three deliveries, one hour. The van is loaded and running.',
      'Theo: Hospital, hotel, docks — in that order. Clock is ticking.',
    ],
    objectives: [
      { type: 'enterCar', carType: 'van', text: 'Get in the delivery van' },
      { type: 'driveTo', place: 'hospital', radius: 10, text: 'Deliver to Solmar General', time: 75 },
      { type: 'driveTo', place: 'hotel', radius: 10, text: 'Deliver to the Palm Court', time: 75 },
      { type: 'driveTo', place: 'docks', radius: 12, text: 'Deliver to the docks', time: 75 },
    ],
  },
  {
    title: 'Rough Crowd',
    giver: 'Theo',
    reward: 600,
    intro: [
      'Theo: Thugs are shaking down my driver at the docks.',
      'Theo: Go sort it out. Fists, pistol — your call. Then bring him home.',
    ],
    objectives: [
      { type: 'goto', place: 'docks', radius: 16, text: 'Reach the docks' },
      { type: 'defeat', count: 4, place: 'docks', text: 'Deal with the thugs', spawn: 4 },
      { type: 'driveTo', place: 'garage', radius: 12, text: 'Drive back to the garage' },
    ],
  },
  {
    title: 'Heat Wave',
    giver: 'Theo',
    reward: 700,
    intro: [
      'Theo: The whole department is out tonight. Lose them first.',
      'Theo: Then a fresh coat at Auto Shine, and lie low at the safehouse.',
    ],
    startStars: 3,
    objectives: [
      { type: 'loseCops', text: 'Lose the cops' },
      { type: 'driveTo', place: 'spray', radius: 10, text: 'Get a respray at Auto Shine' },
      { type: 'goto', place: 'safehouse', radius: 10, text: 'Reach the safehouse' },
    ],
  },
  {
    title: 'The Big Score',
    giver: 'Theo',
    reward: 1200,
    intro: [
      'Theo: The Golden Palms keeps the weekend take out back.',
      'Theo: Get in, grab it, get out. Then run for the lighthouse.',
      'Theo: Nobody follows you to the lighthouse, Maya. Nobody.',
    ],
    objectives: [
      { type: 'goto', place: 'casino', radius: 14, text: 'Reach the Golden Palms' },
      { type: 'hold', place: 'casino', radius: 8, seconds: 6, text: 'Grab the cash', stars: 3, spawn: 3 },
      { type: 'goto', place: 'lighthouse', radius: 14, text: 'Escape to the lighthouse' },
    ],
    outro: [
      'Theo: You did it, Maya. The debt is paid. The city is yours.',
      'Maya: From the marina to the lighthouse — all of it.',
    ],
  },
];

/** The marker beacon: a light pillar, a ground ring and a spinning diamond. */
export function createMarker(scene) {
  const group = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd94c, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.y = 30;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.2, 3, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd94c, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.1;
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.7),
    new THREE.MeshBasicMaterial({ color: 0xffd94c }),
  );
  diamond.position.y = 5;
  group.add(beam, ring, diamond);
  group.visible = false;
  scene.add(group);
  return {
    group,
    show(x, z) {
      group.position.set(x, 0, z);
      group.visible = true;
    },
    hide() {
      group.visible = false;
    },
    step(dt, time) {
      if (!group.visible) return;
      diamond.rotation.y = time * 2;
      diamond.position.y = 5 + Math.sin(time * 2.2) * 0.4;
      beam.material.opacity = 0.22 + Math.sin(time * 3) * 0.08;
    },
  };
}

export function createMissions(scene, city, hooks) {
  const marker = createMarker(scene);
  let index = -1;
  let objectiveIndex = 0;
  let active = false;
  let timer = 0;
  let holdTime = 0;
  let defeated = 0;
  let dialogueQueue = [];
  let dialogueTimer = 0;
  let completedCount = 0;

  function place(name) {
    return city.locations[name];
  }

  function currentDef() {
    return index >= 0 ? MISSION_DEFS[index] : null;
  }

  function currentObjective() {
    const def = currentDef();
    return def ? def.objectives[objectiveIndex] : null;
  }

  function objectiveTarget(obj) {
    if (obj.place) {
      const loc = place(obj.place);
      return loc.approach || loc;
    }
    if (obj.type === 'stealCar') return hooks.stealCarPosition();
    return null;
  }

  function refreshMarker() {
    const obj = currentObjective();
    if (!obj || !active) {
      marker.hide();
      return;
    }
    const target = objectiveTarget(obj);
    if (target) marker.show(target.x, target.z);
    else marker.hide();
  }

  function say(lines) {
    dialogueQueue = [...lines];
    dialogueTimer = 0;
  }

  function advance() {
    objectiveIndex += 1;
    holdTime = 0;
    defeated = 0;
    const def = currentDef();
    if (objectiveIndex >= def.objectives.length) {
      complete();
      return;
    }
    const obj = currentObjective();
    timer = obj.time || 0;
    if (obj.spawn) {
      const target = objectiveTarget(obj);
      hooks.spawnThugs(target.x, target.z, obj.spawn);
    }
    if (obj.stars) hooks.addStars(obj.stars);
    refreshMarker();
    hooks.onObjective(obj.text, objectiveTarget(obj));
  }

  function complete() {
    const def = currentDef();
    active = false;
    marker.hide();
    completedCount = index + 1;
    if (def.outro) say(def.outro);
    hooks.onComplete(def.reward, def.title);
    index = -1;
  }

  function fail(reason) {
    active = false;
    marker.hide();
    hooks.onFail(reason);
    index = -1;
  }

  return {
    get active() {
      return active;
    },
    get completedCount() {
      return completedCount;
    },
    get currentTitle() {
      const def = currentDef();
      return def ? def.title : null;
    },
    get currentObjectiveText() {
      const obj = currentObjective();
      if (!obj) return null;
      if (obj.type === 'defeat') return `${obj.text} (${defeated}/${obj.count})`;
      if (obj.time) return `${obj.text} — ${Math.max(0, Math.ceil(timer))}s`;
      if (obj.type === 'hold' && holdTime > 0) return `${obj.text}… ${Math.ceil(obj.seconds - holdTime)}s`;
      return obj.text;
    },
    get markerPosition() {
      return marker.group.visible ? { x: marker.group.position.x, z: marker.group.position.z } : null;
    },
    get nextStart() {
      // The next mission starts at the garage until all six are done.
      if (completedCount >= MISSION_DEFS.length) return null;
      const loc = place('garage');
      return loc.approach || loc;
    },
    get nextTitle() {
      return completedCount < MISSION_DEFS.length ? MISSION_DEFS[completedCount].title : null;
    },
    setCompleted(count) {
      completedCount = Math.max(0, Math.min(MISSION_DEFS.length, count));
    },
    startNext() {
      if (active || completedCount >= MISSION_DEFS.length) return false;
      index = completedCount;
      objectiveIndex = 0;
      active = true;
      const def = currentDef();
      say(def.intro);
      if (def.startStars) hooks.addStars(def.startStars);
      hooks.prepareMission(index, def);
      const obj = currentObjective();
      timer = obj.time || 0;
      if (obj.spawn) {
        const target = objectiveTarget(obj);
        hooks.spawnThugs(target.x, target.z, obj.spawn);
      }
      if (obj.stars) hooks.addStars(obj.stars);
      refreshMarker();
      hooks.onObjective(obj.text, objectiveTarget(obj));
      hooks.onStart(def.title);
      return true;
    },
    /** Events from the world: carEntered, thugKilled. */
    onEvent(name, data) {
      if (!active) return;
      const obj = currentObjective();
      if (!obj) return;
      if (name === 'carEntered') {
        if (obj.type === 'enterCar' && data.carType === obj.carType) advance();
        else if (obj.type === 'stealCar' && data.stolen) {
          hooks.addStars(1);
          advance();
        }
      } else if (name === 'thugKilled' && obj.type === 'defeat') {
        defeated += 1;
        if (defeated >= obj.count) advance();
      }
    },
    failActive(reason) {
      if (active) fail(reason);
    },
    step(dt, ctx) {
      marker.step(dt, ctx.time);
      if (dialogueQueue.length) {
        dialogueTimer -= dt;
        if (dialogueTimer <= 0) {
          hooks.onDialogue(dialogueQueue.shift());
          dialogueTimer = 3.6;
        }
      }
      if (!active) return;
      const obj = currentObjective();
      if (!obj) return;
      if (obj.time) {
        timer -= dt;
        if (timer <= 0) {
          fail('Too slow — the job fell through.');
          return;
        }
      }
      if (obj.type === 'goto' || obj.type === 'driveTo' || obj.type === 'deliver') {
        const target = objectiveTarget(obj);
        const dist = Math.hypot(ctx.playerX - target.x, ctx.playerZ - target.z);
        const inCarOk = obj.type === 'goto' || !ctx.onFoot;
        if (dist < obj.radius && inCarOk) advance();
      } else if (obj.type === 'hold') {
        const target = objectiveTarget(obj);
        const dist = Math.hypot(ctx.playerX - target.x, ctx.playerZ - target.z);
        if (dist < obj.radius && ctx.onFoot) {
          holdTime += dt;
          if (holdTime >= obj.seconds) advance();
        } else {
          holdTime = Math.max(0, holdTime - dt * 2);
        }
      } else if (obj.type === 'loseCops') {
        if (ctx.stars === 0) advance();
      }
    },
  };
}
