// The HUD: DOM overlays for cash, health, wanted stars, the objective banner,
// subtitles, the message feed and the menus — plus the minimap, a small canvas
// that draws the road grid, the player arrow and blips for the mission marker,
// police, the garage and the player's car. DOM text stays crisp at any size
// and costs the renderer nothing.

import { CITY, blockCentre, roadCoord } from './config.js';

export function createHud() {
  const el = (id) => document.getElementById(id);
  const cashEl = el('hud-cash');
  const healthFill = el('hud-health-fill');
  const starsEl = el('hud-stars');
  const ammoEl = el('hud-ammo');
  const speedEl = el('hud-speed');
  const vehicleEl = el('hud-vehicle');
  const objectiveEl = el('hud-objective');
  const subtitleEl = el('hud-subtitle');
  const feedEl = el('hud-feed');
  const promptEl = el('hud-prompt');
  const bustEl = el('hud-bust');
  const bustFill = el('hud-bust-fill');
  const mapCanvas = el('hud-minimap');
  const mapCtx = mapCanvas.getContext('2d');
  const crosshair = el('hud-crosshair');
  const titleEl = el('screen-title');
  const pauseEl = el('screen-pause');
  const endEl = el('screen-end');
  const endTitle = el('end-title');
  const endText = el('end-text');
  const saveEl = el('hud-saved');

  let subtitleTimer = 0;
  let saveTimer = 0;
  const MAP = 220;
  const worldToMap = (v) => ((v + CITY.half) / (CITY.half * 2)) * MAP;

  function message(text, ms = 4200) {
    const line = document.createElement('div');
    line.className = 'feed-line';
    line.textContent = text;
    feedEl.appendChild(line);
    while (feedEl.children.length > 4) feedEl.removeChild(feedEl.firstChild);
    setTimeout(() => {
      if (line.parentNode) line.parentNode.removeChild(line);
    }, ms);
  }

  function drawMinimap(state) {
    const ctx = mapCtx;
    ctx.clearRect(0, 0, MAP, MAP);
    ctx.fillStyle = '#20261f';
    ctx.fillRect(0, 0, MAP, MAP);
    // Blocks.
    ctx.fillStyle = '#4a5a44';
    for (let bx = 0; bx < CITY.grid; bx += 1) {
      for (let bz = 0; bz < CITY.grid; bz += 1) {
        const half = (CITY.pitch - CITY.road) / 2;
        ctx.fillRect(worldToMap(blockCentre(bx) - half), worldToMap(blockCentre(bz) - half), half * 2 / (CITY.half * 2) * MAP, half * 2 / (CITY.half * 2) * MAP);
      }
    }
    // Roads.
    ctx.fillStyle = '#6a6a66';
    for (let i = 0; i <= CITY.grid; i += 1) {
      const c = worldToMap(roadCoord(i));
      const w = (CITY.road / (CITY.half * 2)) * MAP;
      ctx.fillRect(c - w / 2, 0, w, MAP);
      ctx.fillRect(0, c - w / 2, MAP, w);
    }
    // Ocean.
    ctx.fillStyle = '#2e7fa8';
    ctx.fillRect(0, worldToMap(CITY.shore), MAP, MAP - worldToMap(CITY.shore));
    const blip = (x, z, color, size = 5) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(worldToMap(x), worldToMap(z), size, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    };
    if (state.garage) blip(state.garage.x, state.garage.z, '#7ae8ff', 4);
    if (state.marker) blip(state.marker.x, state.marker.z, '#ffd94c', 6);
    for (const cop of state.cops || []) blip(cop.x, cop.z, '#4a7aff', 4);
    if (state.playerCar) blip(state.playerCar.x, state.playerCar.z, '#ffffff', 3);
    // Player arrow, rotated to the heading.
    const px = worldToMap(state.playerX);
    const pz = worldToMap(state.playerZ);
    ctx.save();
    ctx.translate(px, pz);
    ctx.rotate(Math.PI - state.heading);
    ctx.fillStyle = '#ffd94c';
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(5.5, 6);
    ctx.lineTo(-5.5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#222222';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
    // North tick.
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('N', 6, 14);
  }

  return {
    setCash(cash) {
      cashEl.textContent = `$${cash.toLocaleString('en-US')}`;
    },
    setHealth(health, max) {
      const pct = Math.max(0, Math.min(100, (health / max) * 100));
      healthFill.style.width = `${pct}%`;
      healthFill.style.background = pct > 50 ? '#6ac86a' : pct > 25 ? '#e8c84a' : '#e84a4a';
    },
    setStars(stars, blinking) {
      starsEl.textContent = '★'.repeat(stars) + '☆'.repeat(5 - stars);
      starsEl.classList.toggle('blinking', blinking);
      starsEl.classList.toggle('hot', stars > 0);
    },
    setAmmo(ammo, mag, reloading) {
      ammoEl.textContent = reloading ? 'RELOADING…' : `AMMO ${ammo}/${mag}`;
    },
    setSpeed(speedKmh, vehicleName) {
      if (vehicleName) {
        speedEl.textContent = `${Math.round(speedKmh)} km/h`;
        vehicleEl.textContent = vehicleName;
        speedEl.style.display = 'block';
        vehicleEl.style.display = 'block';
      } else {
        speedEl.style.display = 'none';
        vehicleEl.style.display = 'none';
      }
    },
    setObjective(text) {
      objectiveEl.textContent = text || '';
      objectiveEl.style.display = text ? 'block' : 'none';
    },
    subtitle(text) {
      subtitleEl.textContent = text;
      subtitleEl.style.display = 'block';
      subtitleTimer = 3.6;
    },
    message,
    setPrompt(text) {
      promptEl.textContent = text || '';
      promptEl.style.display = text ? 'block' : 'none';
    },
    setBust(fraction) {
      if (fraction > 0.02) {
        bustEl.style.display = 'block';
        bustFill.style.width = `${Math.min(100, fraction * 100)}%`;
      } else {
        bustEl.style.display = 'none';
      }
    },
    setCrosshair(visible) {
      crosshair.style.display = visible ? 'block' : 'none';
    },
    showSaved() {
      saveEl.style.display = 'block';
      saveTimer = 2;
    },
    drawMinimap,
    showTitle(hasSave, missionsDone) {
      document.body.classList.add('menu-open');
      titleEl.style.display = 'flex';
      pauseEl.style.display = 'none';
      endEl.style.display = 'none';
      el('title-continue').style.display = hasSave ? 'block' : 'none';
      el('title-progress').textContent = missionsDone > 0 ? `Missions complete: ${missionsDone} / 6` : '';
    },
    hideTitle() {
      document.body.classList.remove('menu-open');
      titleEl.style.display = 'none';
    },
    showPause(muted) {
      pauseEl.style.display = 'flex';
      el('pause-mute').textContent = muted ? 'Sound: OFF (M)' : 'Sound: ON (M)';
    },
    hidePause() {
      pauseEl.style.display = 'none';
    },
    showEnd(kind, text) {
      document.body.classList.add('menu-open');
      endTitle.textContent = kind;
      endText.textContent = text;
      endEl.style.display = 'flex';
    },
    hideEnd() {
      document.body.classList.remove('menu-open');
      endEl.style.display = 'none';
    },
    step(dt) {
      if (subtitleTimer > 0) {
        subtitleTimer -= dt;
        if (subtitleTimer <= 0) subtitleEl.style.display = 'none';
      }
      if (saveTimer > 0) {
        saveTimer -= dt;
        if (saveTimer <= 0) saveEl.style.display = 'none';
      }
    },
  };
}
