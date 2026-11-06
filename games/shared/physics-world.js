/* AGC shared physics helper — cannon-es based, Three.js-agnostic.
 * Replaces legacy global CANNON 0.6.2 (cdnjs) used by jenga.html.
 * Copy this file 1:1 into gamesapp/games/shared/physics-world.js — same API.
 *
 * Usage as ES module with importmap:
 * <script type="importmap">
 * {"imports":{
 *   "three":"https://unpkg.com/three@0.128.0/build/three.module.js",
 *   "cannon-es":"https://unpkg.com/cannon-es@0.20.0/dist/cannon-es.js"
 * }}
 * </script>
 * <script type="module">
 * import { createWorld, addBox, stepWorld } from './physics-world.js';
 * </script>
 */

import * as CANNON from 'https://unpkg.com/cannon-es@0.20.0/dist/cannon-es.js';

export const CANNON_ES_VERSION = '0.20.0';

export function createWorld(opts = {}) {
  const world = new CANNON.World({
    gravity: new CANNON.Vec3(0, opts.gravityY ?? -9.82, 0),
  });
  world.broadphase = new CANNON.SAPBroadphase(world);
  world.allowSleep = true; // critical for Jenga: tower rests instead of jittering
  world.defaultContactMaterial.friction = opts.friction ?? 0.4;
  world.defaultContactMaterial.restitution = opts.restitution ?? 0.05; // low bounce, old code used 0.3 = bouncy
  world.solver.iterations = opts.iterations ?? 12;
  return world;
}

export function addBox(world, { x = 0, y = 0, z = 0, w = 3, h = 1, d = 1, mass = 0, kinematic = true }) {
  const shape = new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, d / 2));
  const body = new CANNON.Body({
    mass: kinematic ? 0 : mass,
    type: kinematic ? CANNON.Body.KINEMATIC : CANNON.Body.DYNAMIC,
    shape,
    sleepSpeedLimit: 0.15,
    sleepTimeLimit: 0.6,
  });
  body.position.set(x, y, z);
  world.addBody(body);
  return body;
}

export function wakeNeighbours(world, body) {
  // On pull: wake bodies stacked above so tower can settle realistically.
  // Call after removing a block, before next step.
  const p = body.position;
  for (const b of world.bodies) {
    if (b === body) continue;
    const dy = b.position.y - p.y;
    if (dy > 0 && dy < 3 && Math.hypot(b.position.x - p.x, b.position.z - p.z) < 3) {
      b.type = CANNON.Body.DYNAMIC;
      b.mass = 1;
      b.updateMassProperties();
      b.wakeUp();
    }
  }
}

export function stepWorld(world, dt = 1 / 60) {
  world.step(dt);
}

export { CANNON };
