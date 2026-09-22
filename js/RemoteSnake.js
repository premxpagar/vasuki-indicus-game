import * as THREE from 'three';
import { VoxelMesher } from './VoxelMesher.js';
import { SNAKE_SKINS } from './Snake.js';
import { DustTrailSystem } from './DustTrailSystem.js';

export class RemoteSnake {
  constructor(scene, skinId = 'gold') {
    this.scene = scene;
    this.skinId = SNAKE_SKINS[skinId] ? skinId : 'gold';
    this.skin = SNAKE_SKINS[this.skinId];

    // Current interpolated transform
    this.headPos = new THREE.Vector3(16, 0.5, 0);
    this.targetHeadPos = new THREE.Vector3(16, 0.5, 0);
    this.yaw = -Math.PI / 2;
    this.targetYaw = -Math.PI / 2;
    this.yOffset = 0;
    this.targetYOffset = 0;
    this.isBoosting = false;
    this.isInvulnerable = false;

    // Segment meshes
    this.segments = [];
    this.targetSegments = [];

    // FX
    this.dustTrail = new DustTrailSystem(this.scene);
    this._dustAcc = 0;

    this.createHeadMesh();
  }

  setSkin(skinId) {
    if (!SNAKE_SKINS[skinId]) return;
    this.skinId = skinId;
    this.skin = SNAKE_SKINS[skinId];
    this.rebuildMeshes();
  }

  createHeadMesh() {
    if (this.headGroup) {
      this.scene.remove(this.headGroup);
    }
    this.headGroup = new THREE.Group();
    const voxels = [];
    const colorMain = this.skin.colorMain;
    const colorWhite = this.skin.colorWhite;
    const colorBlack = this.skin.colorBlack;
    const colorNostril = this.skin.colorNostril;

    for (let x = -4; x <= 4; x++) {
      for (let y = -4; y <= 4; y++) {
        for (let z = -5; z <= 5; z++) {
          if (Math.abs(x) === 4 && Math.abs(y) === 4) continue;
          if (Math.abs(x) === 4 && Math.abs(z) >= 4) continue;
          if (Math.abs(y) === 4 && Math.abs(z) >= 4) continue;

          let color = colorMain;
          const isEye = y >= 1 && y <= 3 && z >= 2 && z <= 4 && Math.abs(x) >= 3;
          if (isEye) {
            const isPupil = y === 2 && z === 3 && Math.abs(x) === 4;
            color = isPupil ? colorBlack : colorWhite;
          }
          if (y === -1 && z === 5 && (x === -2 || x === 2)) {
            color = colorNostril;
          }
          voxels.push({ x, y, z, color });
        }
      }
    }

    const mesh = VoxelMesher.build(voxels, 0.1, { roughness: 0.28, metalness: 0.42, envMapIntensity: 1.05 });
    this.headGroup.add(mesh);

    // 3D Forked Flickering Tongue
    this.tongueGroup = new THREE.Group();
    const tongueMat = new THREE.MeshLambertMaterial({ color: this.skin.tongue });
    const stemT = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 0.3), tongueMat);
    stemT.position.z = 0.15;
    const forkL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.15), tongueMat);
    forkL.position.set(-0.05, 0, 0.32);
    forkL.rotation.y = -0.3;
    const forkR = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.15), tongueMat);
    forkR.position.set(0.05, 0, 0.32);
    forkR.rotation.y = 0.3;
    this.tongueGroup.add(stemT);
    this.tongueGroup.add(forkL);
    this.tongueGroup.add(forkR);
    this.tongueGroup.position.set(0, -0.25, 0.55);
    this.headGroup.add(this.tongueGroup);

    this.headGroup.position.copy(this.headPos);
    this.scene.add(this.headGroup);
  }

  createSegmentMesh(index) {
    const voxels = [];
    const isEven = index % 2 === 0;
    const color = isEven ? this.skin.colorMain : this.skin.colorSec;
    const dorsalColor = this.skin.colorDark;

    const taper = Math.max(0.65, 1.0 - (index * 0.012));
    const size = Math.round(3 * taper);

    for (let x = -size; x <= size; x++) {
      for (let y = -size; y <= size; y++) {
        for (let z = -size; z <= size; z++) {
          if (Math.abs(x) === size && Math.abs(y) === size) continue;
          const isDorsal = (y === size && Math.abs(x) <= 1);
          voxels.push({ x, y, z, color: isDorsal ? dorsalColor : color });
        }
      }
    }

    const mesh = VoxelMesher.build(voxels, 0.1, { roughness: 0.35, metalness: 0.35 });
    return { mesh, size };
  }

  rebuildMeshes() {
    this.createHeadMesh();
    for (let i = 0; i < this.segments.length; i++) {
      this.scene.remove(this.segments[i].mesh);
      const newSeg = this.createSegmentMesh(i);
      newSeg.mesh.position.copy(this.segments[i].mesh.position);
      this.scene.add(newSeg.mesh);
      this.segments[i] = newSeg;
    }
  }

  onTickData(data) {
    if (data.headPos) {
      this.targetHeadPos.set(data.headPos.x, data.headPos.y, data.headPos.z);
    }
    if (typeof data.yaw === 'number') {
      this.targetYaw = data.yaw;
    }
    if (typeof data.yOffset === 'number') {
      this.targetYOffset = data.yOffset;
    }
    this.isBoosting = !!data.isBoosting;
    this.isInvulnerable = !!data.invulnerable;

    if (Array.isArray(data.segments)) {
      this.targetSegments = data.segments;
      // Adjust segment mesh count if necessary
      while (this.segments.length < data.segments.length) {
        const seg = this.createSegmentMesh(this.segments.length);
        this.scene.add(seg.mesh);
        this.segments.push(seg);
      }
      while (this.segments.length > data.segments.length) {
        const seg = this.segments.pop();
        if (seg && seg.mesh) this.scene.remove(seg.mesh);
      }
    }
  }

  update(delta) {
    // Smooth lerp interpolation for fluid movement
    const lerpFactor = Math.min(1, delta * 18);
    this.headPos.lerp(this.targetHeadPos, lerpFactor);

    // Shortest angular difference for smooth yaw rotation
    let angleDiff = (this.targetYaw - this.yaw) % (Math.PI * 2);
    if (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    if (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    this.yaw += angleDiff * lerpFactor;

    this.yOffset += (this.targetYOffset - this.yOffset) * lerpFactor;

    if (this.headGroup) {
      this.headGroup.position.set(this.headPos.x, 0.5 + this.yOffset, this.headPos.z);
      this.headGroup.rotation.y = this.yaw;

      // Invulnerability blink
      if (this.isInvulnerable) {
        this.headGroup.visible = Math.sin(performance.now() * 0.03) > 0;
      } else {
        this.headGroup.visible = true;
      }
    }

    // Tongue animation
    if (this.tongueGroup) {
      const timeSec = performance.now() / 1000;
      const flick = Math.sin(timeSec * 8);
      this.tongueGroup.position.z = 0.55 + (flick > 0.6 ? 0.15 : 0.0);
    }

    // Segments interpolation
    for (let i = 0; i < this.segments.length; i++) {
      const segMesh = this.segments[i].mesh;
      const targetPos = this.targetSegments[i];
      if (targetPos) {
        segMesh.position.x += (targetPos.x - segMesh.position.x) * lerpFactor;
        segMesh.position.y += (targetPos.y - segMesh.position.y) * lerpFactor;
        segMesh.position.z += (targetPos.z - segMesh.position.z) * lerpFactor;
      }
      segMesh.visible = this.headGroup ? this.headGroup.visible : true;
    }

    // Boost FX
    if (this.isBoosting) {
      this.dustTrail.active = true;
      this._dustAcc += delta;
      if (this._dustAcc > 0.05) {
        this._dustAcc = 0;
        this.dustTrail.emit(this.headGroup.position, this.yaw);
      }
    } else {
      this.dustTrail.active = false;
      this._dustAcc = 0;
    }
    this.dustTrail.update(delta);
  }

  // Returns true if localHeadPos intersects with any segment of this remote snake
  checkBodyCollision(localHeadPos, radius = 0.75) {
    if (this.isInvulnerable) return false;
    for (let i = 0; i < this.segments.length; i++) {
      const segPos = this.segments[i].mesh.position;
      const dist = Math.hypot(localHeadPos.x - segPos.x, localHeadPos.z - segPos.z);
      if (dist < radius) {
        return true;
      }
    }
    return false;
  }

  // Returns true if head-to-head collision
  checkHeadCollision(localHeadPos, radius = 1.1) {
    if (this.isInvulnerable) return false;
    const dist = Math.hypot(localHeadPos.x - this.headPos.x, localHeadPos.z - this.headPos.z);
    return dist < radius;
  }

  destroy() {
    if (this.headGroup) {
      this.scene.remove(this.headGroup);
    }
    for (const seg of this.segments) {
      if (seg.mesh) this.scene.remove(seg.mesh);
    }
    this.segments = [];
    if (this.dustTrail) {
      this.dustTrail.destroy();
    }
  }
}
