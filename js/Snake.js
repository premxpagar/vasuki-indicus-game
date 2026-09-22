import * as THREE from 'three';
import { VoxelMesher } from './VoxelMesher.js';
import { DustTrailSystem } from './DustTrailSystem.js';

export const SNAKE_SKINS = {
    emerald: {
        id: 'emerald',
        name: 'Ancient Emerald',
        desc: 'Vedic sacred forest green with deep jade scales',
        colorMain: 0x5C7A4A,
        colorSec: 0x4A6838,
        colorDark: 0x3A5428,
        colorNostril: 0x3A4A2E,
        colorWhite: 0xFFF8E7,
        colorBlack: 0x101010,
        tongue: 0xA63D2F,
        swatchPrimary: '#5C7A4A',
        swatchSecondary: '#4A6838'
    },
    gold: {
        id: 'gold',
        name: 'Golden Nagavanshi',
        desc: 'Royal antique bronze and burnished gold',
        colorMain: 0xC49A54,
        colorSec: 0x9E7535,
        colorDark: 0x6B4C22,
        colorNostril: 0x4A3212,
        colorWhite: 0xFFF8E7,
        colorBlack: 0x101010,
        tongue: 0xA63D2F,
        swatchPrimary: '#C49A54',
        swatchSecondary: '#9E7535'
    },
    obsidian: {
        id: 'obsidian',
        name: 'Charcoal Obsidian',
        desc: 'Volcanic black stone serpent with amber gaze',
        colorMain: 0x2D2C28,
        colorSec: 0x201F1C,
        colorDark: 0x141311,
        colorNostril: 0x0A0908,
        colorWhite: 0xD4B67A,
        colorBlack: 0x050505,
        tongue: 0xC49A54,
        swatchPrimary: '#2D2C28',
        swatchSecondary: '#141311'
    },
    crimson: {
        id: 'crimson',
        name: 'Crimson Terracotta',
        desc: 'Sacred temple sindoor and burnt clay ochre',
        colorMain: 0x9E3A2B,
        colorSec: 0x802E21,
        colorDark: 0x541C14,
        colorNostril: 0x3A120B,
        colorWhite: 0xFFF8E7,
        colorBlack: 0x101010,
        tongue: 0xD4B67A,
        swatchPrimary: '#9E3A2B',
        swatchSecondary: '#541C14'
    },
    ivory: {
        id: 'ivory',
        name: 'Ivory Shesha',
        desc: 'Celestial alabaster white with gold undertones',
        colorMain: 0xEDE4D3,
        colorSec: 0xD8CEBC,
        colorDark: 0xB8AE9C,
        colorNostril: 0x9A9080,
        colorWhite: 0x6B4C22,
        colorBlack: 0x1A1814,
        tongue: 0x9E3A2B,
        swatchPrimary: '#EDE4D3',
        swatchSecondary: '#B8AE9C'
    }
};

export class Snake {
    constructor(scene, soundManager) {
        this.scene = scene;
        
        // Movement params
        this.baseSpeed = 14.5;
        this.boostSpeed = 25.5;
        this.turnSpeed = 3.65;
        this.steerSmoothed = 0;
        this.speedMul = 1;
        
        // FX
        this.dustTrail = new DustTrailSystem(this.scene);
        this._dustAcc = 0;
        this.justLanded = false;
        
        // State
        this.headPos = new THREE.Vector3(0, 0.5, 0);
        this.yaw = 0;
        this.turnDelta = 0;
        
        // Jumping
        this.verticalVelocity = 0;
        this.gravity = 30;
        this.jumpImpulse = 13.5;
        this.yOffset = 0;
        this.isJumping = false;
        
        // Powerups
        this.hasShield = false;
        this.shieldTimer = 0;
        this.isInvulnerable = false;
        this.invulnTimer = 0;
        
        // Setup
        this.soundManager = soundManager;
        this.pathHistory = [];
        this.segmentSpacing = 1.15;
        this.segments = [];

        // Load skin
        const savedSkin = localStorage.getItem('vasuki_snake_skin');
        this.currentSkinId = (savedSkin && SNAKE_SKINS[savedSkin]) ? savedSkin : 'emerald';
        this.skin = SNAKE_SKINS[this.currentSkinId];
        
        this.createHeadMesh();
        
        for (let i = 0; i < 4; i++) {
            this.addSegment();
        }
    }

    setSkin(skinId) {
        if (!SNAKE_SKINS[skinId]) return;
        this.currentSkinId = skinId;
        this.skin = SNAKE_SKINS[skinId];
        localStorage.setItem('vasuki_snake_skin', skinId);
        this.rebuildMeshes();
    }

    rebuildMeshes() {
        if (!this.headGroup) return;
        const oldHeadPos = this.headGroup.position.clone();
        const oldHeadRot = this.headGroup.rotation.clone();
        const headVisible = this.headGroup.visible;

        this.scene.remove(this.headGroup);
        this.createHeadMesh();
        this.headGroup.position.copy(oldHeadPos);
        this.headGroup.rotation.copy(oldHeadRot);
        this.headGroup.visible = headVisible;

        for (let i = 0; i < this.segments.length; i++) {
            const seg = this.segments[i];
            const oldPos = seg.mesh.position.clone();
            const oldRot = seg.mesh.rotation.clone();
            const segVisible = seg.mesh.visible;

            this.scene.remove(seg.mesh);
            const newSeg = this.createSegmentMesh(i);
            newSeg.mesh.position.copy(oldPos);
            newSeg.mesh.rotation.copy(oldRot);
            newSeg.mesh.visible = segVisible;
            this.scene.add(newSeg.mesh);
            this.segments[i] = newSeg;
        }
    }

    createHeadMesh() {
        this.headGroup = new THREE.Group();
        const voxels = [];
        const colorMain = this.skin.colorMain;
        const colorWhite = this.skin.colorWhite;
        const colorBlack = this.skin.colorBlack;
        const colorNostril = this.skin.colorNostril;

        for (let x = -4; x <= 4; x++) {
            for (let y = -4; y <= 4; y++) {
                for (let z = -5; z <= 5; z++) {
                    // Round the corners
                    if (Math.abs(x) === 4 && Math.abs(y) === 4) continue;
                    if (Math.abs(x) === 4 && Math.abs(z) >= 4) continue;
                    if (Math.abs(y) === 4 && Math.abs(z) >= 4) continue;

                    // Eyes
                    let color = colorMain;
                    const isEye = y >= 1 && y <= 3 && z >= 2 && z <= 4 && Math.abs(x) >= 3;
                    if (isEye) {
                        const isPupil = y === 2 && z === 3 && Math.abs(x) === 4;
                        color = isPupil ? colorBlack : colorWhite;
                    }
                    
                    // Nostrils
                    if (y === -1 && z === 5 && (x === -2 || x === 2)) {
                        color = colorNostril;
                    }

                    voxels.push({ x, y, z, color });
                }
            }
        }

        const mesh = VoxelMesher.build(voxels, 0.1, { roughness: 0.28, metalness: 0.42, envMapIntensity: 1.05 });
        this.headGroup.add(mesh);

        // 3D FORKED FLICKERING TONGUE
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

        // 3D SHIELD AURA (Floating Crystal Sub-Cubes)
        this.shieldGroup = new THREE.Group();
        const shieldMat = new THREE.MeshStandardMaterial({ 
            color: 0xC49A54, 
            emissive: 0xC49A54, 
            emissiveIntensity: 1.5, 
            transparent: true, 
            opacity: 0.8 
        });
        const shieldGeo = new THREE.BoxGeometry(0.14, 0.14, 0.14);
        this.shieldCubes = [];
        for (let i = 0; i < 6; i++) {
            const sc = new THREE.Mesh(shieldGeo, shieldMat);
            this.shieldGroup.add(sc);
            this.shieldCubes.push(sc);
        }
        this.shieldGroup.visible = false;
        this.headGroup.add(this.shieldGroup);

        this.scene.add(this.headGroup);
    }

    createSegmentMesh(index) {
        const segmentGroup = new THREE.Group();
        const voxels = [];
        const colorMain = (index % 2 === 0) ? this.skin.colorMain : this.skin.colorSec;
        const colorDark = this.skin.colorDark;

        for (let x = -4; x <= 4; x++) {
            for (let y = -4; y <= 4; y++) {
                for (let z = -4; z <= 4; z++) {
                    // Round the corners
                    if (Math.abs(x) === 4 && Math.abs(y) === 4) continue;
                    if (Math.abs(x) === 4 && Math.abs(z) === 4) continue;
                    if (Math.abs(y) === 4 && Math.abs(z) === 4) continue;

                    // Create a pattern (e.g. scales on top)
                    const isScale = (x % 2 === 0 && z % 2 === 0 && y === 4);
                    voxels.push({ x, y, z, color: isScale ? colorDark : colorMain });
                }
            }
        }

        const mesh = VoxelMesher.build(voxels, 0.1, { roughness: 0.32, metalness: 0.38, envMapIntensity: 0.95 });
        segmentGroup.add(mesh);
        
        return { mesh: segmentGroup, radius: 0.475 };
    }

    addSegment() {
        const segment = this.createSegmentMesh(this.segments.length);
        this.segments.push(segment);
        this.scene.add(segment.mesh);
    }

    removeSegments(count = 3) {
        const limit = Math.max(3, this.segments.length - count);
        while (this.segments.length > limit) {
            const seg = this.segments.pop();
            this.scene.remove(seg.mesh);
            if (seg.mesh.geometry) seg.mesh.geometry.dispose();
            if (seg.mesh.material) seg.mesh.material.dispose();
        }
    }

    reset() {
        this.headPos.set(0, 0.5, 0);
        this.yaw = 0;
        this.turnDelta = 0;
        this.yOffset = 0;
        this.verticalVelocity = 0;
        this.isJumping = false;
        this.hasShield = false;
        this.shieldTimer = 0;
        this.isInvulnerable = false;
        this.invulnTimer = 2.0;
        this.steerSmoothed = 0;
        this.speedMul = 1;
        this.baseSpeed = 14.5;
        this.boostSpeed = 25.5;
        this.pathHistory = [];
        if (this.headGroup) this.headGroup.visible = true;
        
        while (this.segments.length > 4) {
            const seg = this.segments.pop();
            this.scene.remove(seg.mesh);
            if (seg.mesh.geometry) seg.mesh.geometry.dispose();
            if (seg.mesh.material) seg.mesh.material.dispose();
        }
    }

    respawnAt(x = 0, y = 0.5, z = 0, yaw = 0, preserveLength = true) {
        this.headPos.set(x, y, z);
        this.yaw = yaw;
        this.turnDelta = 0;
        this.yOffset = 0;
        this.verticalVelocity = 0;
        this.isJumping = false;
        this.hasShield = false;
        this.shieldTimer = 0;
        this.isInvulnerable = true;
        this.invulnTimer = 3.0;
        this.steerSmoothed = 0;
        this.pathHistory = [];

        if (this.headGroup) {
            this.headGroup.position.set(x, y, z);
            this.headGroup.rotation.set(0, yaw, 0);
            this.headGroup.visible = true;
        }

        if (!preserveLength) {
            while (this.segments.length > 4) {
                const seg = this.segments.pop();
                this.scene.remove(seg.mesh);
                if (seg.mesh.geometry) seg.mesh.geometry.dispose();
                if (seg.mesh.material) seg.mesh.material.dispose();
            }
        }

        for (let i = 0; i < this.segments.length; i++) {
            const dist = (i + 1) * this.segmentSpacing;
            const sx = x - Math.sin(yaw) * dist;
            const sz = z - Math.cos(yaw) * dist;
            this.segments[i].mesh.position.set(sx, y, sz);
            this.segments[i].mesh.rotation.y = yaw;
            this.pathHistory.push({ x: sx, y, z: sz, yaw });
        }
    }

    updateIdle(time) {
        if (!this.headGroup) return;
        const wave = Math.sin(time * 2.4);
        this.headGroup.position.set(this.headPos.x, 0.5, this.headPos.z);
        this.headGroup.rotation.y = wave * 0.18;
        this.headGroup.rotation.x = 0;
        this.headGroup.visible = true;

        if (this.tongueGroup) {
            const flick = Math.sin(time * 7);
            this.tongueGroup.position.z = 0.55 + (flick > 0.65 ? 0.15 : 0.0);
        }

        for (let i = 0; i < this.segments.length; i++) {
            const segWave = Math.sin(time * 2.4 - (i + 1) * 0.55);
            this.segments[i].mesh.position.set(
                this.headPos.x + segWave * 0.35,
                0.5,
                this.headPos.z - (i + 1) * this.segmentSpacing
            );
            this.segments[i].mesh.rotation.y = segWave * 0.28;
            this.segments[i].mesh.visible = true;
        }
    }

    jump() {
        if (!this.isJumping) {
            this.isJumping = true;
            this.verticalVelocity = this.jumpImpulse;
            return true;
        }
        return false;
    }

    grantShield(duration = 10) {
        this.hasShield = true;
        this.shieldTimer = duration;
    }

    consumeShield() {
        if (this.invulnTimer > 0 || this.isInvulnerable) return true;
        if (!this.hasShield) return false;
        this.hasShield = false;
        this.shieldTimer = 0;
        this.invulnTimer = 1.35;
        this.isInvulnerable = true;
        return true;
    }

    applyProgression(sector, segmentCount) {
        const extra = Math.max(0, segmentCount - 4);
        this.baseSpeed = Math.min(23, 14.5 + sector * 0.45 + extra * 0.04);
        this.boostSpeed = this.baseSpeed + 10.5;
        this.turnSpeed = 3.65;
    }

    update(steeringInput, isBoosting, delta) {
        if (this.invulnTimer > 0) {
            this.invulnTimer -= delta;
            this.isInvulnerable = this.invulnTimer > 0;
            this.headGroup.visible = this.isInvulnerable
                ? (Math.sin(performance.now() * 0.028) > 0)
                : true;
        } else {
            this.isInvulnerable = false;
            this.headGroup.visible = true;
        }

        if (this.hasShield) {
            this.shieldTimer -= delta;
            if (this.shieldTimer <= 0) {
                this.hasShield = false;
                this.shieldTimer = 0;
            }
        }

        this.steerSmoothed += (steeringInput - this.steerSmoothed) * Math.min(1, delta * 11);
        const steer = this.steerSmoothed;

        const currentSpeed = (isBoosting ? this.boostSpeed : this.baseSpeed) * this.speedMul;
        const turn = steer * this.turnSpeed * (isBoosting ? 0.84 : 1) * delta;

        this.turnDelta = steer * this.turnSpeed;
        this.yaw += turn;

        this.justLanded = false;
        if (isBoosting) {
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
        
        this.headPos.x += Math.sin(this.yaw) * currentSpeed * delta;
        this.headPos.z += Math.cos(this.yaw) * currentSpeed * delta;
        
        if (this.isJumping) {
            this.verticalVelocity -= this.gravity * delta;
            this.yOffset += this.verticalVelocity * delta;
            if (this.yOffset <= 0) {
                this.justLanded = this.isJumping && this.verticalVelocity < -4;
                this.yOffset = 0;
                this.verticalVelocity = 0;
                this.isJumping = false;
            }
        }
        
        this.headGroup.position.set(this.headPos.x, 0.5 + this.yOffset, this.headPos.z);
        this.headGroup.rotation.y = this.yaw;
        this.headGroup.rotation.x = this.verticalVelocity * 0.015;
        
        // Animate 3D Tongue Flickering
        if (this.tongueGroup) {
            const timeSec = performance.now() / 1000;
            const flick = Math.sin(timeSec * 8);
            this.tongueGroup.position.z = 0.55 + (flick > 0.6 ? 0.15 : 0.0);
        }

        // Animate 3D Shield Crystal Aura
        if (this.shieldGroup) {
            this.shieldGroup.visible = this.hasShield;
            if (this.hasShield) {
                const timeSec = performance.now() / 1000;
                this.shieldGroup.rotation.y = timeSec * 2.5;
                for (let i = 0; i < this.shieldCubes.length; i++) {
                    const angle = (i / this.shieldCubes.length) * Math.PI * 2;
                    const r = 1.1;
                    this.shieldCubes[i].position.set(
                        Math.cos(angle) * r,
                        Math.sin(timeSec * 3 + i) * 0.2,
                        Math.sin(angle) * r
                    );
                }
            }
        }
        
        this.pathHistory.unshift({
            x: this.headPos.x,
            y: 0.5 + this.yOffset,
            z: this.headPos.z,
            yaw: this.yaw
        });

        // Cap history so a tiny/zero/negative delta after pause cannot
        // produce Infinity/NaN and crash with "Invalid array length".
        const step = Math.max(currentSpeed * Math.max(delta, 1 / 120), 0.08);
        const samples = Math.ceil(this.segmentSpacing / step);
        const maxHistory = Math.min(
            8000,
            Math.max(48, (this.segments.length + 2) * samples + 16)
        );
        if (Number.isFinite(maxHistory) && this.pathHistory.length > maxHistory) {
            this.pathHistory.length = maxHistory;
        }
        
        this.updateTailSegments();
    }

    updateTailSegments() {
        let historyIndex = 0;
        let distanceCovered = 0;
        
        for (let i = 0; i < this.segments.length; i++) {
            const targetDistance = (i + 1) * this.segmentSpacing;
            
            while (historyIndex < this.pathHistory.length - 1 && distanceCovered < targetDistance) {
                const p1 = this.pathHistory[historyIndex];
                const p2 = this.pathHistory[historyIndex + 1];
                const dx = p1.x - p2.x;
                const dy = p1.y - p2.y;
                const dz = p1.z - p2.z;
                const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
                
                if (distanceCovered + dist >= targetDistance) {
                    const t = (targetDistance - distanceCovered) / dist;
                    const x = p1.x - dx * t;
                    const y = p1.y - dy * t;
                    const z = p1.z - dz * t;
                    const yaw = p1.yaw * (1 - t) + p2.yaw * t;
                    
                    const segment = this.segments[i];
                    segment.mesh.position.set(x, y, z);
                    segment.mesh.rotation.y = yaw;
                    break;
                }
                
                distanceCovered += dist;
                historyIndex++;
            }
            
            if (historyIndex >= this.pathHistory.length - 1 && this.pathHistory.length > 0) {
                const last = this.pathHistory[this.pathHistory.length - 1];
                const segment = this.segments[i];
                segment.mesh.position.set(last.x, last.y, last.z);
                segment.mesh.rotation.y = last.yaw;
            }
        }
    }

    checkSelfCollision() {
        if (this.hasShield || this.yOffset > 1.5 || this.isInvulnerable) {
            return false;
        }

        const skip = this.speedMul > 1.05 ? 7 : 6;
        for (let i = skip; i < this.segments.length; i++) {
            const segment = this.segments[i];
            const dx = this.headPos.x - segment.mesh.position.x;
            const dy = (0.5 + this.yOffset) - segment.mesh.position.y;
            const dz = this.headPos.z - segment.mesh.position.z;
            if (dx * dx + dy * dy + dz * dz < 0.42) return true;
        }
        return false;
    }

    checkBoundaryCollision(arenaHalf = 76) {
        if (this.isInvulnerable) return false;
        return Math.abs(this.headPos.x) > arenaHalf || Math.abs(this.headPos.z) > arenaHalf;
    }

    getLengthMeters() {
        return (this.segments.length * 0.5).toFixed(1);
    }
}
