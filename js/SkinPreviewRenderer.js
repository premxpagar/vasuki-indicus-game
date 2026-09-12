import * as THREE from 'three';
import { VoxelMesher } from './VoxelMesher.js';

export class SkinPreviewRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.active = false;
    this.animationId = null;

    this.scene = new THREE.Scene();
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(260, canvas.clientWidth || rect.width || 460);
    const height = Math.max(120, canvas.clientHeight || rect.height || 140);

    this.camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 50);
    this.camera.position.set(0, 1.3, 3.2);
    this.camera.lookAt(0, -0.05, 0);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(width, height, false);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.3;

    // Lighting
    const amb = new THREE.AmbientLight(0xffeedd, 0.85);
    this.scene.add(amb);
    const sun = new THREE.DirectionalLight(0xfff6e6, 2.2);
    sun.position.set(3.5, 5, 4);
    this.scene.add(sun);
    const rim = new THREE.DirectionalLight(0xd4b67a, 1.2);
    rim.position.set(-3.5, 2.5, -3);
    this.scene.add(rim);

    // Serpent root container
    this.serpentRoot = new THREE.Group();
    this.scene.add(this.serpentRoot);

    this.tongueMesh = null;
    this.segmentMeshes = [];
    this.lastTime = performance.now();
  }

  buildSerpent(skin) {
    // Recursively dispose old meshes
    while (this.serpentRoot.children.length > 0) {
      const child = this.serpentRoot.children[0];
      this.serpentRoot.remove(child);
      child.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach(m => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
    }

    const s = skin || {
      colorMain: 0x5C7A4A,
      colorSec: 0x4A6838,
      colorDark: 0x3A5428,
      colorNostril: 0x3A4A2E,
      colorWhite: 0xFFF8E7,
      colorBlack: 0x101010,
      tongue: 0xA63D2F
    };

    // 1. Head
    const headVoxels = [];
    for (let x = -4; x <= 4; x++) {
      for (let y = -4; y <= 4; y++) {
        for (let z = -5; z <= 5; z++) {
          if (Math.abs(x) === 4 && Math.abs(y) === 4) continue;
          if (Math.abs(x) === 4 && Math.abs(z) >= 4) continue;
          if (Math.abs(y) === 4 && Math.abs(z) >= 4) continue;

          let color = s.colorMain;
          const isEye = y >= 1 && y <= 3 && z >= 2 && z <= 4 && Math.abs(x) >= 3;
          if (isEye) {
            const isPupil = y === 2 && z === 3 && Math.abs(x) === 4;
            color = isPupil ? s.colorBlack : s.colorWhite;
          }
          if (y === -1 && z === 5 && (x === -2 || x === 2)) {
            color = s.colorNostril;
          }
          headVoxels.push({ x, y, z, color });
        }
      }
    }
    const headMesh = VoxelMesher.build(headVoxels, 0.08, { roughness: 0.28, metalness: 0.42 });
    this.serpentRoot.add(headMesh);

    // 2. Tongue
    const tongueGroup = new THREE.Group();
    const tongueMat = new THREE.MeshLambertMaterial({ color: s.tongue });
    const stemT = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, 0.24), tongueMat);
    stemT.position.z = 0.12;
    const forkL = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.12), tongueMat);
    forkL.position.set(-0.04, 0, 0.25);
    forkL.rotation.y = -0.3;
    const forkR = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.12), tongueMat);
    forkR.position.set(0.04, 0, 0.25);
    forkR.rotation.y = 0.3;
    tongueGroup.add(stemT);
    tongueGroup.add(forkL);
    tongueGroup.add(forkR);
    tongueGroup.position.set(0, -0.2, 0.42);
    this.serpentRoot.add(tongueGroup);
    this.tongueMesh = tongueGroup;

    // 3. Segments (3 body segments behind head)
    this.segmentMeshes = [];
    for (let i = 0; i < 3; i++) {
      const segVoxels = [];
      const segColor = (i % 2 === 0) ? s.colorSec : s.colorMain;
      for (let x = -4; x <= 4; x++) {
        for (let y = -4; y <= 4; y++) {
          for (let z = -4; z <= 4; z++) {
            if (Math.abs(x) === 4 && Math.abs(y) === 4) continue;
            if (Math.abs(x) === 4 && Math.abs(z) === 4) continue;
            if (Math.abs(y) === 4 && Math.abs(z) === 4) continue;
            const isScale = (x % 2 === 0 && z % 2 === 0 && y === 4);
            segVoxels.push({ x, y, z, color: isScale ? s.colorDark : segColor });
          }
        }
      }
      const segMesh = VoxelMesher.build(segVoxels, 0.08, { roughness: 0.32, metalness: 0.38 });
      segMesh.position.z = -(i + 1) * 0.72;
      this.serpentRoot.add(segMesh);
      this.segmentMeshes.push(segMesh);
    }

    // Offset center so rotation turns nicely around mid-body
    this.serpentRoot.position.set(0, 0, 0.6);
  }

  start() {
    this.active = true;
    this.lastTime = performance.now();
    this.resize();
    this.renderLoop();
  }

  stop() {
    this.active = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  renderLoop() {
    if (!this.active) return;
    const now = performance.now();
    const delta = (now - this.lastTime) / 1000;
    this.lastTime = now;

    // Smooth 3D rotation
    if (this.serpentRoot) {
      this.serpentRoot.rotation.y += delta * 0.95;

      // Serpent gentle undulation wave
      if (this.tongueMesh) {
        this.tongueMesh.position.z = 0.42 + (Math.sin(now * 0.009) > 0.6 ? 0.12 : 0);
      }
      if (this.segmentMeshes) {
        for (let i = 0; i < this.segmentMeshes.length; i++) {
          const sWave = Math.sin(now * 0.003 - (i + 1) * 0.6);
          this.segmentMeshes[i].position.x = sWave * 0.12;
        }
      }
    }

    this.renderer.render(this.scene, this.camera);
    this.animationId = requestAnimationFrame(() => this.renderLoop());
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.max(260, this.canvas.clientWidth || rect.width || 460);
    const height = Math.max(120, this.canvas.clientHeight || rect.height || 140);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }
}
