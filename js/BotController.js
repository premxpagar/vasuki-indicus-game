/**
 * VASUKI INDICUS — Bot Controller (AI Brain)
 * Controls autonomous serpent behavior with apple navigation and multi-probe obstacle avoidance.
 */

export class BotController {
  constructor() {
    this.currentSteer = 0;
    this.boostCooldown = 0;
    this.jumpCooldown = 0;
  }

  normalizeAngle(angle) {
    let a = angle % (Math.PI * 2);
    if (a > Math.PI) a -= Math.PI * 2;
    if (a < -Math.PI) a += Math.PI * 2;
    return a;
  }

  compute(botSnake, foodItems = [], obstacles = null, playerSnake = null, delta = 0.016) {
    const head = botSnake.headPos;
    const yaw = botSnake.yaw;

    // 1. Locate closest target apple
    let target = null;
    let minDist = Infinity;

    for (const item of foodItems) {
      if (!item || !item.group) continue;
      const pos = item.group.position;
      const d = Math.hypot(pos.x - head.x, pos.z - head.z);
      if (d < minDist) {
        minDist = d;
        target = pos;
      }
    }

    if (!target) {
      target = { x: 0, z: 0 };
    }

    // Target yaw from bot to apple
    const targetAngle = Math.atan2(target.x - head.x, target.z - head.z);

    // 2. Candidate steer angles: [-1.0 (Right), -0.65, -0.3, 0.0, 0.3, 0.65, 1.0 (Left)]
    const candidates = [-1.0, -0.7, -0.35, 0.0, 0.35, 0.7, 1.0];
    let bestSteer = 0;
    let lowestCost = Infinity;

    const blockers = obstacles ? obstacles.getBlockerPositions() : [];
    const arenaLimit = 70;

    for (const cand of candidates) {
      // In Snake.js: yaw += steer * turnSpeed * delta
      const testYaw = yaw + cand * botSnake.turnSpeed * 0.45;
      let cost = 0;

      // Desirability: angular difference to apple
      const diff = Math.abs(this.normalizeAngle(targetAngle - testYaw));
      cost += diff * 45;

      // Multi-probe lookahead at 2 distances (3.5m and 7.5m)
      const lookDistances = [3.5, 7.5];
      for (const d of lookDistances) {
        const px = head.x + Math.sin(testYaw) * d;
        const pz = head.z + Math.cos(testYaw) * d;

        // Boundary Penalty
        if (Math.abs(px) > arenaLimit - 4 || Math.abs(pz) > arenaLimit - 4) {
          cost += 800 * (1 / (d * 0.2));
        }

        // Obstacles Penalty
        for (const b of blockers) {
          const bDist = Math.hypot(px - b.x, pz - b.z);
          if (bDist < 3.2) {
            cost += 600 * (1 / (bDist + 0.1));
          }
        }

        // Player Snake Body Penalty (Avoid colliding with player)
        if (playerSnake && playerSnake.segments) {
          for (let i = 0; i < playerSnake.segments.length; i++) {
            const segPos = playerSnake.segments[i].mesh.position;
            const sDist = Math.hypot(px - segPos.x, pz - segPos.z);
            if (sDist < 2.8) {
              cost += 1000 * (1 / (sDist + 0.1));
            }
          }
          // Avoid player head directly
          const headDist = Math.hypot(px - playerSnake.headPos.x, pz - playerSnake.headPos.z);
          if (headDist < 3.0) {
            cost += 900;
          }
        }

        // Own Body Penalty (Don't run into self)
        for (let i = 5; i < botSnake.segments.length; i++) {
          const segPos = botSnake.segments[i].mesh.position;
          const selfDist = Math.hypot(px - segPos.x, pz - segPos.z);
          if (selfDist < 2.5) {
            cost += 700;
          }
        }
      }

      if (cost < lowestCost) {
        lowestCost = cost;
        bestSteer = cand;
      }
    }

    // Smooth steering transition
    this.currentSteer += (bestSteer - this.currentSteer) * Math.min(1, delta * 12);

    // Boost intelligence
    let boost = false;
    if (this.boostCooldown > 0) {
      this.boostCooldown -= delta;
    } else if (Math.abs(bestSteer) < 0.35 && minDist > 8 && minDist < 32 && lowestCost < 120) {
      boost = true;
      if (Math.random() < 0.02) {
        this.boostCooldown = 1.5; // Rest boost occasionally
      }
    }

    return {
      steer: this.currentSteer,
      boost
    };
  }
}
