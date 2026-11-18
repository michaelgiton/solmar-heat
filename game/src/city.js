// Solmar: a procedural sun-soaked coastal city. One ground texture paints the
// roads, sidewalks and block interiors; buildings are instanced boxes with
// window textures; the beach, pier and ocean lie south, the lighthouse hill
// north-west. Special locations (garage, casino, hotel, hospital, police
// station, spray shop, safehouse, docks, marina) are fixed blocks with signs.
// Also owns the road graph traffic drives on, the collision boxes, and the
// collectible coins.

import * as THREE from '../vendor/three.min.js';
import { CITY, PALETTE, blockCentre, roadCoord } from './config.js';

const NODES = CITY.grid + 1;

function makeCanvas(width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function windowTexture(floors, base, glass) {
  return makeCanvas(128, 256, (ctx, w, h) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    const cols = 6;
    const rows = floors;
    const cw = w / cols;
    const ch = h / rows;
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        const lit = Math.random() < 0.22;
        ctx.fillStyle = lit ? '#ffd98a' : glass;
        ctx.fillRect(x * cw + cw * 0.2, y * ch + ch * 0.22, cw * 0.6, ch * 0.56);
      }
    }
  });
}

function signTexture(text, sub, bg, fg) {
  return makeCanvas(512, 128, (ctx, w, h) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = fg;
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    ctx.fillStyle = fg;
    ctx.textAlign = 'center';
    ctx.font = 'bold 52px system-ui, sans-serif';
    ctx.fillText(text, w / 2, sub ? 62 : 82);
    if (sub) {
      ctx.font = '28px system-ui, sans-serif';
      ctx.fillText(sub, w / 2, 104);
    }
  });
}

function groundTexture(random) {
  const size = 2048;
  // The ground plane is NOT square: it spans half*2 in x but shore+half in z
  // (the south edge is the shoreline). Paint each axis at its own scale or
  // every road, dash and block drifts north of where the rules think it is.
  const scaleX = size / (CITY.half * 2);
  const scaleZ = size / (CITY.shore + CITY.half);
  const toPx = (v) => (v + CITY.half) * scaleX;
  const toPz = (v) => (v + CITY.half) * scaleZ;
  return makeCanvas(size, size, (ctx) => {
    // Base: dry grass beyond the streets.
    ctx.fillStyle = '#8aa860';
    ctx.fillRect(0, 0, size, size);
    // Sidewalk apron for the whole street area.
    const lo = toPx(roadCoord(0) - CITY.road / 2 - CITY.walk);
    const hi = toPx(roadCoord(CITY.grid) + CITY.road / 2 + CITY.walk);
    const loZ = toPz(roadCoord(0) - CITY.road / 2 - CITY.walk);
    const hiZ = toPz(roadCoord(CITY.grid) + CITY.road / 2 + CITY.walk);
    ctx.fillStyle = '#b9b3a6';
    ctx.fillRect(lo, loZ, hi - lo, hiZ - loZ);
    // Block interiors: grass, plaza, parking, dirt.
    const fills = ['#7fae5a', '#c9b896', '#9a9a94', '#a8b878', '#c2b49a'];
    for (let bx = 0; bx < CITY.grid; bx += 1) {
      for (let bz = 0; bz < CITY.grid; bz += 1) {
        const cx = blockCentre(bx);
        const cz = blockCentre(bz);
        const half = (CITY.pitch - CITY.road) / 2 - CITY.walk;
        ctx.fillStyle = fills[Math.floor(random() * fills.length)];
        ctx.fillRect(toPx(cx - half), toPz(cz - half), half * 2 * scaleX, half * 2 * scaleZ);
      }
    }
    // Roads.
    ctx.fillStyle = '#3a3f46';
    for (let i = 0; i < NODES; i += 1) {
      const c = roadCoord(i);
      ctx.fillRect(toPx(c - CITY.road / 2), loZ, CITY.road * scaleX, hiZ - loZ);
      ctx.fillRect(lo, toPz(c - CITY.road / 2), hi - lo, CITY.road * scaleZ);
    }
    // Centre dashes and crosswalks.
    ctx.fillStyle = '#e8c84a';
    for (let i = 0; i < NODES; i += 1) {
      const c = roadCoord(i);
      for (let d = roadCoord(0); d < roadCoord(CITY.grid); d += 8) {
        ctx.fillRect(toPx(c) - 2, toPz(d), 4, 4 * scaleZ);
        ctx.fillRect(toPx(d), toPz(c) - 2, 4 * scaleX, 4);
      }
    }
    ctx.fillStyle = '#e8e8e8';
    for (let i = 0; i < NODES; i += 1) {
      for (let j = 0; j < NODES; j += 1) {
        const x = roadCoord(i);
        const z = roadCoord(j);
        for (let k = -2; k <= 2; k += 1) {
          ctx.fillRect(toPx(x - CITY.road / 2 + 1), toPz(z + k * 2.2 - 0.7), 2.4 * scaleX, 1.4 * scaleZ);
          ctx.fillRect(toPx(x + k * 2.2 - 0.7), toPz(z - CITY.road / 2 + 1), 1.4 * scaleX, 2.4 * scaleZ);
        }
      }
    }
    // Sand strip along the shore.
    ctx.fillStyle = '#e8d29a';
    ctx.fillRect(0, toPz(230), size, toPz(CITY.shore) - toPz(230));
    for (let i = 0; i < 900; i += 1) {
      ctx.fillStyle = random() < 0.5 ? '#dcc288' : '#f2e2b0';
      ctx.fillRect(random() * size, toPz(230) + random() * (toPz(CITY.shore) - toPz(230)), 3, 3);
    }
  });
}

export function buildCity(scene, random) {
  const colliders = [];
  const coins = [];

  // Sky dome, sun, lights, fog.
  const skyTex = makeCanvas(16, 256, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#4f9ede');
    grad.addColorStop(0.55, '#8ec9e8');
    grad.addColorStop(0.8, '#ffd9a0');
    grad.addColorStop(1, '#ffd9a0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  });
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(900, 24, 16),
    new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false }),
  );
  scene.add(sky);
  scene.fog = new THREE.Fog(0xe8ddc8, 200, 700);

  const sun = new THREE.DirectionalLight(PALETTE.sun, 3.2);
  sun.position.set(180, 260, 120);
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xbfdcff, 0x9a8a6a, 1.7));

  // Ground and ocean.
  const groundDepth = CITY.shore + CITY.half;
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.half * 2, groundDepth),
    new THREE.MeshLambertMaterial({ map: groundTexture(random) }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, (CITY.shore - CITY.half) / 2);
  scene.add(ground);

  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(1400, 500),
    new THREE.MeshLambertMaterial({ color: PALETTE.ocean }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(0, -0.15, CITY.shore + 250);
  scene.add(ocean);
  const foam = new THREE.Mesh(
    new THREE.PlaneGeometry(560, 3),
    new THREE.MeshBasicMaterial({ color: 0xf4fbff }),
  );
  foam.rotation.x = -Math.PI / 2;
  foam.position.set(0, 0.05, CITY.shore + 1);
  scene.add(foam);

  // Buildings: three instanced sets (towers, mid-rise, houses).
  const sets = [
    { tex: windowTexture(16, '#5d718c', '#33415a'), maxH: 58, minH: 30, list: [] },
    { tex: windowTexture(6, '#93805f', '#46525e'), maxH: 22, minH: 10, list: [] },
    { tex: windowTexture(2, '#c69c72', '#46525e'), maxH: 8, minH: 5, list: [] },
  ];
  const tints = [0xffffff, 0xf2e8dc, 0xdce8f2, 0xf2ddc8, 0xe4e4da];
  const specialBlocks = new Set(['1,6', '5,2', '3,3', '1,1', '6,6', '0,3', '6,1', '3,5', '7,3']);
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  boxGeo.translate(0, 0.5, 0);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  for (let bx = 0; bx < CITY.grid; bx += 1) {
    for (let bz = 0; bz < CITY.grid; bz += 1) {
      if (specialBlocks.has(`${bx},${bz}`)) continue;
      const cx = blockCentre(bx);
      const cz = blockCentre(bz);
      const distCentre = Math.abs(bx - 3.5) + Math.abs(bz - 3.5);
      const downtown = distCentre <= 3;
      const setIndex = downtown ? 0 : random() < 0.55 ? 1 : 2;
      const set = sets[setIndex];
      const inner = CITY.pitch - CITY.road - CITY.walk * 2;
      const count = setIndex === 0 ? 1 : random() < 0.5 ? 2 : 4;
      const cells = count === 1 ? [[0, 0, inner]] : count === 2
        ? [[-inner / 4, 0, inner / 2 - 3], [inner / 4, 0, inner / 2 - 3]]
        : [[-inner / 4, -inner / 4, inner / 2 - 4], [inner / 4, -inner / 4, inner / 2 - 4], [-inner / 4, inner / 4, inner / 2 - 4], [inner / 4, inner / 4, inner / 2 - 4]];
      for (const [ox, oz, size] of cells) {
        const w = size * (0.8 + random() * 0.2);
        const d = size * (0.8 + random() * 0.2);
        const h = set.minH + random() * (set.maxH - set.minH);
        const x = cx + ox;
        const z = cz + oz;
        set.list.push({ x, z, w, d, h, tint: tints[Math.floor(random() * tints.length)] });
        colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
      }
    }
  }
  for (const set of sets) {
    const mesh = new THREE.InstancedMesh(boxGeo, new THREE.MeshLambertMaterial({ map: set.tex }), set.list.length);
    set.list.forEach((b, i) => {
      dummy.position.set(b.x, 0, b.z);
      dummy.scale.set(b.w, b.h, b.d);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, color.setHex(b.tint));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    scene.add(mesh);
  }

  // Special locations: simple structures with painted signs.
  const locations = {};
  function place(name, bx, bz, build) {
    const group = new THREE.Group();
    group.position.set(blockCentre(bx), 0, blockCentre(bz));
    build(group);
    scene.add(group);
    // The approach point: where a player stands or parks for this place, in
    // front of the building (signs face +Z), clear of its collision box.
    locations[name] = { x: blockCentre(bx), z: blockCentre(bz), approach: { x: blockCentre(bx), z: blockCentre(bz) + 18 }, group };
    return locations[name];
  }
  function slab(group, w, h, d, x, z, mat, y = 0) {
    const mesh = new THREE.Mesh(boxGeo, mat);
    mesh.scale.set(w, h, d);
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  }
  function sign(group, texture, w, y, z, face = 0) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, w / 4),
      new THREE.MeshBasicMaterial({ map: texture }),
    );
    mesh.position.set(0, y, z);
    mesh.rotation.y = face;
    group.add(mesh);
    return mesh;
  }
  const mat = (c) => new THREE.MeshLambertMaterial({ color: c });
  const inner = CITY.pitch - CITY.road - CITY.walk * 2;

  place('garage', 1, 6, (g) => {
    slab(g, inner * 0.8, 7, inner * 0.6, 0, 0, mat(0x8a7a66));
    // Roller-door texture: steel slats instead of a flat black void.
    const dc = document.createElement('canvas');
    dc.width = 128; dc.height = 64;
    const dctx = dc.getContext('2d');
    dctx.fillStyle = '#6a7a8a'; dctx.fillRect(0, 0, 128, 64);
    dctx.fillStyle = '#46566a';
    for (let y = 6; y < 64; y += 8) dctx.fillRect(0, y, 128, 2);
    dctx.fillStyle = '#93a3b5'; dctx.fillRect(0, 0, 128, 3);
    const doorTex = new THREE.CanvasTexture(dc);
    slab(g, inner * 0.5, 4.5, 1, 0, inner * 0.3 + 0.5, new THREE.MeshLambertMaterial({ map: doorTex }));
    sign(g, signTexture("THEO'S GARAGE", 'REPAIRS • TOWING', '#24344d', '#ffd98a'), 20, 8.5, inner * 0.3 + 0.6);
    colliders.push(boxCollider(1, 6, inner * 0.8, inner * 0.6));
  });
  place('casino', 5, 2, (g) => {
    slab(g, inner * 0.9, 14, inner * 0.7, 0, 0, mat(0x6a4a7a));
    slab(g, inner * 0.9, 1.2, inner * 0.7, 0, 14, mat(0xffd98a));
    sign(g, signTexture('GOLDEN PALMS', 'CASINO • HOTEL', '#3a1a4a', '#ffd98a'), 24, 10, inner * 0.35 + 0.6);
    colliders.push(boxCollider(5, 2, inner * 0.9, inner * 0.7));
  });
  place('hotel', 3, 3, (g) => {
    slab(g, inner * 0.6, 30, inner * 0.6, 0, 0, mat(0xe8ddc8));
    sign(g, signTexture('PALM COURT', 'HOTEL', '#7a5a2a', '#fff4dc'), 18, 12, inner * 0.3 + 0.6);
    colliders.push(boxCollider(3, 3, inner * 0.6, inner * 0.6));
  });
  place('hospital', 1, 1, (g) => {
    slab(g, inner * 0.8, 12, inner * 0.6, 0, 0, mat(0xf2f2f2));
    sign(g, signTexture('SOLMAR GENERAL', 'HOSPITAL', '#ffffff', '#c83232'), 20, 9, inner * 0.3 + 0.6);
    colliders.push(boxCollider(1, 1, inner * 0.8, inner * 0.6));
  });
  place('police', 6, 6, (g) => {
    slab(g, inner * 0.8, 10, inner * 0.6, 0, 0, mat(0x5a6a7a));
    sign(g, signTexture('SOLMAR POLICE', 'DEPARTMENT', '#1a2a3a', '#9ac8ff'), 20, 8, inner * 0.3 + 0.6);
    colliders.push(boxCollider(6, 6, inner * 0.8, inner * 0.6));
  });
  place('spray', 0, 3, (g) => {
    slab(g, inner * 0.7, 6, inner * 0.5, 0, 0, mat(0x3a7a8a));
    sign(g, signTexture('AUTO SHINE', 'NEW PAINT • NO QUESTIONS', '#123a4a', '#7ae8ff'), 18, 7.5, inner * 0.25 + 0.6);
    colliders.push(boxCollider(0, 3, inner * 0.7, inner * 0.5));
  });
  place('safehouse', 6, 1, (g) => {
    slab(g, 14, 6, 12, 0, 0, mat(0xd8a878));
    const roof = new THREE.Mesh(new THREE.ConeGeometry(11, 4, 4), mat(0x8a4a3a));
    roof.position.y = 8;
    roof.rotation.y = Math.PI / 4;
    g.add(roof);
    colliders.push(boxCollider(6, 1, 14, 12));
  });
  place('docks', 7, 3, (g) => {
    slab(g, inner * 0.8, 8, inner * 0.8, 0, 0, mat(0x7a7a72));
    for (let i = 0; i < 5; i += 1) {
      slab(g, 6, 2.6, 2.6, -12 + i * 6, inner * 0.45, mat([0xc8552a, 0x2a7ac8, 0x3a9a4a, 0xc8a82a, 0x8a5aa8][i]), 0);
    }
    colliders.push(boxCollider(7, 3, inner * 0.8, inner * 0.8));
  });
  function boxCollider(bx, bz, w, d) {
    const x = blockCentre(bx);
    const z = blockCentre(bz);
    return { minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 };
  }

  // Park block: pond, paths, extra palms.
  {
    const px = blockCentre(3);
    const pz = blockCentre(5);
    const pond = new THREE.Mesh(new THREE.CircleGeometry(9, 24), new THREE.MeshLambertMaterial({ color: 0x4a9ac8 }));
    pond.rotation.x = -Math.PI / 2;
    pond.position.set(px, 0.06, pz);
    scene.add(pond);
    locations.park = { x: px, z: pz, approach: { x: px, z: pz + 12 } };
  }

  // Lighthouse on its hill, north-west.
  {
    const hill = new THREE.Mesh(new THREE.CylinderGeometry(26, 34, 8, 20), mat(0x7fae5a));
    hill.position.set(-252, 4, -252);
    scene.add(hill);
    const tower = new THREE.Group();
    tower.position.set(-252, 8, -252);
    const stripes = makeCanvas(64, 128, (ctx, w, h) => {
      for (let i = 0; i < 6; i += 1) {
        ctx.fillStyle = i % 2 ? '#c83232' : '#f2f2f2';
        ctx.fillRect(0, (i * h) / 6, w, h / 6);
      }
    });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3, 18, 12), new THREE.MeshLambertMaterial({ map: stripes }));
    shaft.position.y = 9;
    tower.add(shaft);
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 3, 12), new THREE.MeshBasicMaterial({ color: 0xfff2b0 }));
    lamp.position.y = 19.5;
    tower.add(lamp);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(3, 2.5, 12), mat(0x333333));
    cap.position.y = 22;
    tower.add(cap);
    scene.add(tower);
    colliders.push({ minX: -256, maxX: -248, minZ: -256, maxZ: -248 });
    locations.lighthouse = { x: -252, z: -252, approach: { x: -238, z: -238 } };
  }

  // Marina pier and boats.
  {
    const pier = new THREE.Group();
    pier.position.set(20, 0.4, CITY.shore + 4);
    for (let i = 0; i < 14; i += 1) {
      const plank = new THREE.Mesh(boxGeo, mat(0x8a6a4a));
      plank.scale.set(8, 0.4, 4.4);
      plank.position.set(0, 0, i * 4.6);
      pier.add(plank);
    }
    scene.add(pier);
    for (const [bx, bz, c] of [[8, 34, 0xf2f2f2], [34, 52, 0x4a7ac8], [6, 66, 0xc83232]]) {
      const boat = new THREE.Group();
      boat.position.set(bx, 0.2, CITY.shore + bz);
      const hull = new THREE.Mesh(boxGeo, mat(c));
      hull.scale.set(3, 1.2, 8);
      boat.add(hull);
      const cabin = new THREE.Mesh(boxGeo, mat(0xeeeeee));
      cabin.scale.set(2, 1.2, 2.5);
      cabin.position.set(0, 1.2, -1);
      boat.add(cabin);
      scene.add(boat);
    }
    locations.marina = { x: 20, z: CITY.shore + 40, approach: { x: 20, z: 238 } };
  }

  // Streetlights at intersections, palms along the beach and avenues.
  const poleGeo = new THREE.CylinderGeometry(0.14, 0.18, 6, 6);
  poleGeo.translate(0, 3, 0);
  const headGeo = new THREE.BoxGeometry(0.7, 0.25, 0.3);
  const poles = [];
  const heads = [];
  for (let i = 0; i < NODES; i += 1) {
    for (let j = 0; j < NODES; j += 1) {
      if ((i + j) % 2) continue;
      const x = roadCoord(i) + CITY.road / 2 + 1;
      const z = roadCoord(j) + CITY.road / 2 + 1;
      poles.push([x, z]);
      heads.push([x - 0.5, 6, z]);
    }
  }
  const poleMesh = new THREE.InstancedMesh(poleGeo, mat(0x2a2a2a), poles.length);
  const headMesh = new THREE.InstancedMesh(headGeo, new THREE.MeshBasicMaterial({ color: 0xfff2c8 }), heads.length);
  poles.forEach(([x, z], i) => {
    dummy.position.set(x, 0, z);
    dummy.scale.set(1, 1, 1);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    poleMesh.setMatrixAt(i, dummy.matrix);
  });
  heads.forEach(([x, y, z], i) => {
    dummy.position.set(x, y, z);
    dummy.updateMatrix();
    headMesh.setMatrixAt(i, dummy.matrix);
  });
  scene.add(poleMesh, headMesh);

  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.34, 7, 6);
  trunkGeo.translate(0, 3.5, 0);
  const frondGeo = new THREE.BoxGeometry(3.4, 0.08, 0.7);
  frondGeo.translate(1.7, 0, 0);
  const palmSpots = [];
  for (let x = -240; x <= 240; x += 26) palmSpots.push([x + random() * 8 - 4, 238 + random() * 8]);
  for (let i = 0; i < NODES; i += 1) {
    palmSpots.push([roadCoord(i) + CITY.road / 2 + 2.5, roadCoord(2) - 8]);
    palmSpots.push([roadCoord(i) - CITY.road / 2 - 2.5, roadCoord(5) + 8]);
  }
  palmSpots.push([blockCentre(5) - 14, blockCentre(2) + 16], [blockCentre(5) + 14, blockCentre(2) + 16]);
  const trunkMesh = new THREE.InstancedMesh(trunkGeo, mat(0x7a5a3a), palmSpots.length);
  const frondMesh = new THREE.InstancedMesh(frondGeo, mat(0x3f8a3a), palmSpots.length * 6);
  palmSpots.forEach(([x, z], i) => {
    const lean = random() * 0.14;
    dummy.position.set(x, 0, z);
    dummy.scale.set(1, 0.9 + random() * 0.3, 1);
    dummy.rotation.set(lean, random() * Math.PI, 0);
    dummy.updateMatrix();
    trunkMesh.setMatrixAt(i, dummy.matrix);
    for (let f = 0; f < 6; f += 1) {
      dummy.position.set(x, 6.6 * dummy.scale.y, z);
      dummy.rotation.set(0, (f / 6) * Math.PI * 2 + random() * 0.3, -0.5);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      frondMesh.setMatrixAt(i * 6 + f, dummy.matrix);
    }
  });
  scene.add(trunkMesh, frondMesh);

  // Clouds: flat white blobs drifting high above the city.
  const clouds = [];
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, fog: false });
  for (let i = 0; i < 10; i += 1) {
    const cloud = new THREE.Group();
    for (let p = 0; p < 4; p += 1) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(6 + random() * 7, 10, 8), cloudMat);
      puff.scale.y = 0.45;
      puff.position.set(p * 8 - 12 + random() * 4, random() * 2, random() * 6 - 3);
      cloud.add(puff);
    }
    cloud.position.set(random() * 560 - 280, 110 + random() * 40, random() * 560 - 280);
    scene.add(cloud);
    clouds.push(cloud);
  }

  // Collectible sunset coins: gold discs on sidewalks, the beach and the pier.
  const coinGeo = new THREE.CylinderGeometry(0.8, 0.8, 0.16, 20);
  const coinMat = new THREE.MeshLambertMaterial({ color: 0xf2c94c, emissive: 0x7a5a10 });
  const coinSpots = [];
  for (let i = 0; i < 20; i += 1) {
    const bx = Math.floor(random() * CITY.grid);
    const bz = Math.floor(random() * CITY.grid);
    coinSpots.push([blockCentre(bx) + (random() - 0.5) * 30, blockCentre(bz) + (random() - 0.5) * 30]);
  }
  coinSpots[0] = [20, CITY.shore + 56];
  coinSpots[1] = [-252, -238];
  coinSpots[2] = [blockCentre(3), blockCentre(5) + 12];
  coinSpots.forEach(([x, z], i) => {
    const mesh = new THREE.Mesh(coinGeo, coinMat);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(x, 1.1, z);
    scene.add(mesh);
    coins.push({ mesh, x, z, index: i, taken: false });
  });

  // Road graph: nodes at intersections, edges to the four neighbours.
  const neighbours = [];
  for (let j = 0; j < NODES; j += 1) {
    for (let i = 0; i < NODES; i += 1) {
      const list = [];
      if (i > 0) list.push(j * NODES + i - 1);
      if (i < CITY.grid) list.push(j * NODES + i + 1);
      if (j > 0) list.push((j - 1) * NODES + i);
      if (j < CITY.grid) list.push((j + 1) * NODES + i);
      neighbours.push(list);
    }
  }
  function nodePos(index) {
    return { x: roadCoord(index % NODES), z: roadCoord(Math.floor(index / NODES)) };
  }
  function nearestNode(x, z) {
    const i = Math.max(0, Math.min(CITY.grid, Math.round(x / CITY.pitch + CITY.grid / 2)));
    const j = Math.max(0, Math.min(CITY.grid, Math.round(z / CITY.pitch + CITY.grid / 2)));
    return j * NODES + i;
  }

  function isOnRoad(x, z) {
    for (let i = 0; i < NODES; i += 1) {
      const c = roadCoord(i);
      if (Math.abs(x - c) <= CITY.road / 2 + 0.5 || Math.abs(z - c) <= CITY.road / 2 + 0.5) {
        if (x > roadCoord(0) - CITY.road && x < roadCoord(CITY.grid) + CITY.road && z > roadCoord(0) - CITY.road && z < roadCoord(CITY.grid) + CITY.road) return true;
      }
    }
    return false;
  }

  /** Push a circle out of every building box it overlaps; returns true when pushed. */
  function resolveCircle(pos, radius) {
    let pushed = false;
    for (const box of colliders) {
      const cx = Math.max(box.minX, Math.min(pos.x, box.maxX));
      const cz = Math.max(box.minZ, Math.min(pos.z, box.maxZ));
      const dx = pos.x - cx;
      const dz = pos.z - cz;
      const distSq = dx * dx + dz * dz;
      if (distSq >= radius * radius) continue;
      pushed = true;
      if (distSq > 1e-6) {
        const dist = Math.sqrt(distSq);
        pos.x = cx + (dx / dist) * radius;
        pos.z = cz + (dz / dist) * radius;
      } else {
        // Centre inside the box: push out along the smallest penetration.
        const pushes = [
          [box.minX - radius - pos.x, 0],
          [box.maxX + radius - pos.x, 0],
          [0, box.minZ - radius - pos.z],
          [0, box.maxZ + radius - pos.z],
        ];
        pushes.sort((a, b) => Math.abs(a[0] + a[1]) - Math.abs(b[0] + b[1]));
        pos.x += pushes[0][0];
        pos.z += pushes[0][1];
      }
    }
    // Keep everything inside the world.
    pos.x = Math.max(-CITY.half + 2, Math.min(CITY.half - 2, pos.x));
    pos.z = Math.max(-CITY.half + 2, Math.min(CITY.shore + 70, pos.z));
    return pushed;
  }

  function update(dt, time) {
    for (const cloud of clouds) {
      cloud.position.x += dt * 1.2;
      if (cloud.position.x > 320) cloud.position.x = -320;
    }
    for (const coin of coins) {
      if (coin.taken) continue;
      coin.mesh.rotation.y = time * 1.6;
      coin.mesh.position.y = 1.1 + Math.sin(time * 2 + coin.index) * 0.15;
    }
  }

  return {
    colliders,
    coins,
    locations,
    roadGraph: { neighbours, nodePos, nearestNode },
    isOnRoad,
    resolveCircle,
    update,
  };
}
