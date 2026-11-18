// The third-person camera: it trails behind the player or the car at a
// distance that grows with speed, eases toward its target so it never snaps,
// lets the mouse orbit around the heading, and kicks the field of view up as
// the car accelerates. A shake impulse sells collisions and punches.

import * as THREE from '../vendor/three.min.js';

export function createCamera(camera) {
  let yawOffset = 0;
  let pitch = 0.32;
  let distance = 8;
  let shake = 0;
  const current = new THREE.Vector3(0, 4, -8);
  const desired = new THREE.Vector3();
  const lookAt = new THREE.Vector3();

  return {
    addShake(amount) {
      shake = Math.min(1.2, shake + amount);
    },
    /** Mouse orbit: dx turns around the target, dy raises/lowers the camera. */
    orbit(dx, dy) {
      yawOffset -= dx * 0.0028;
      pitch = Math.max(0.08, Math.min(1.1, pitch + dy * 0.0022));
    },
    reset() {
      yawOffset = 0;
      pitch = 0.32;
    },
    snapTo(x, y, z, heading) {
      const behind = heading + Math.PI + yawOffset;
      current.set(x + Math.sin(behind) * distance, y + 3, z + Math.cos(behind) * distance);
    },
    /**
     * Follow the target. heading is the direction of travel, speed the m/s
     * (for distance and FOV), driving switches the framing for cars.
     */
    update(dt, x, y, z, heading, speed, driving) {
      const targetDistance = driving ? 10.5 + Math.min(4, Math.abs(speed) * 0.09) : 7.5;
      distance += (targetDistance - distance) * Math.min(1, dt * 3);
      const height = driving ? 3.6 + distance * Math.sin(pitch) * 0.55 : 2.6 + distance * Math.sin(pitch) * 0.6;
      const behind = heading + Math.PI + yawOffset;
      const horizontal = Math.cos(pitch) * distance;
      desired.set(
        x + Math.sin(behind) * horizontal,
        y + height,
        z + Math.cos(behind) * horizontal,
      );
      if (desired.y < 1.2) desired.y = 1.2;
      const ease = 1 - Math.exp(-dt * (driving ? 4.5 : 6));
      current.lerp(desired, ease);
      camera.position.copy(current);
      if (shake > 0) {
        shake = Math.max(0, shake - dt * 2.4);
        camera.position.x += (Math.random() - 0.5) * shake * 0.5;
        camera.position.y += (Math.random() - 0.5) * shake * 0.4;
      }
      lookAt.set(x, y + (driving ? 1.4 : 1.6), z);
      camera.lookAt(lookAt);
      const targetFov = driving ? 62 + Math.min(8, Math.abs(speed) * 0.16) : 60;
      camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 4);
      camera.updateProjectionMatrix();
      // The orbit offset decays back behind the direction of travel.
      yawOffset *= Math.max(0, 1 - dt * 0.25);
    },
  };
}
