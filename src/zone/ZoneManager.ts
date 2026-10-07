import * as THREE from 'three';
import { sounds } from '../audio/SoundManager';

export interface ZonePhase {
  phaseNum: number;
  waitTime: number;     // seconds before shrink starts
  shrinkTime: number;   // seconds to shrink
  targetRadius: number; // target radius
  dps: number;          // damage per second
}

export class ZoneManager {
  scene: THREE.Scene;

  // Blue Zone (Current active damage boundary)
  currentCenter: THREE.Vector2 = new THREE.Vector2(0, 0);
  currentRadius: number = 380; // starts covering the whole island

  // Safe Zone (Next target circle)
  nextCenter: THREE.Vector2 = new THREE.Vector2(0, 0);
  nextRadius: number = 200;

  // Shrink state
  phaseIndex: number = 0;
  isWaiting: boolean = true;
  timer: number = 55; // initial wait time

  // Visual 3D Meshes
  blueZoneMesh: THREE.Mesh;
  safeZoneMesh: THREE.LineLoop;

  phases: ZonePhase[] = [
    { phaseNum: 1, waitTime: 75, shrinkTime: 50, targetRadius: 200, dps: 1 },
    { phaseNum: 2, waitTime: 50, shrinkTime: 40, targetRadius: 120, dps: 3 },
    { phaseNum: 3, waitTime: 40, shrinkTime: 30, targetRadius: 65, dps: 6 },
    { phaseNum: 4, waitTime: 30, shrinkTime: 22, targetRadius: 30, dps: 10 },
    { phaseNum: 5, waitTime: 20, shrinkTime: 16, targetRadius: 12, dps: 16 },
    { phaseNum: 6, waitTime: 15, shrinkTime: 12, targetRadius: 0,  dps: 25 }
  ];

  private startCenter: THREE.Vector2 = new THREE.Vector2(0, 0);
  private startRadius: number = 380;
  private shrinkProgress: number = 0;

  /** Optional land test so the safe zone doesn't end up out at sea. */
  isLand: ((x: number, z: number) => boolean) | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Create 3D Blue Zone Cylinder Mesh
    const cylGeo = new THREE.CylinderGeometry(1, 1, 160, 96, 1, true);
    const blueMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    this.blueZoneMesh = new THREE.Mesh(cylGeo, blueMat);
    this.blueZoneMesh.position.set(0, 60, 0);
    this.scene.add(this.blueZoneMesh);

    // Create Safe Zone White Ring indicator on ground
    const ringPts: THREE.Vector3[] = [];
    const segments = 64;
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      ringPts.push(new THREE.Vector3(Math.cos(theta), 0, Math.sin(theta)));
    }
    const ringGeo = new THREE.BufferGeometry().setFromPoints(ringPts);
    const ringMat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      linewidth: 2,
      transparent: true,
      opacity: 0.75
    });
    this.safeZoneMesh = new THREE.LineLoop(ringGeo, ringMat);
    this.safeZoneMesh.position.set(0, 4.6, 0);
    this.scene.add(this.safeZoneMesh);

    this.initPhase(0);
  }

  private initPhase(index: number) {
    this.phaseIndex = index;
    if (this.phaseIndex >= this.phases.length) return;

    const p = this.phases[this.phaseIndex];
    this.isWaiting = true;
    this.timer = p.waitTime;
    this.startRadius = this.currentRadius;
    this.startCenter.copy(this.currentCenter);

    this.nextRadius = p.targetRadius;

    // Pick a random next center inside the current circle, preferring one over dry land
    const maxOffset = Math.max(0, this.currentRadius - this.nextRadius) * 0.8;
    const maxCenterDist = Math.max(0, 200 - this.nextRadius * 0.5);
    let fallback: THREE.Vector2 | null = null;
    for (let attempt = 0; attempt < 40; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * maxOffset;
      const c = new THREE.Vector2(
        this.currentCenter.x + Math.cos(angle) * dist,
        this.currentCenter.y + Math.sin(angle) * dist
      );
      if (c.length() > maxCenterDist) c.setLength(maxCenterDist);
      if (!fallback) fallback = c;
      if (!this.isLand || this.isLand(c.x, c.y)) {
        fallback = c;
        break;
      }
    }
    this.nextCenter.copy(fallback!);

    this.updateVisuals();
  }

  update(delta: number) {
    if (this.phaseIndex >= this.phases.length) {
      // Game end or maximum shrink
      return;
    }

    const currentPhase = this.phases[this.phaseIndex];

    if (this.isWaiting) {
      this.timer -= delta;
      if (this.timer <= 0) {
        // Start shrinking!
        this.isWaiting = false;
        this.timer = currentPhase.shrinkTime;
        this.shrinkProgress = 0;
        sounds.playZoneWarning();
      }
    } else {
      // Shrinking in progress
      this.timer -= delta;
      this.shrinkProgress = 1 - (this.timer / currentPhase.shrinkTime);
      this.shrinkProgress = Math.min(1, Math.max(0, this.shrinkProgress));

      this.currentRadius = THREE.MathUtils.lerp(this.startRadius, this.nextRadius, this.shrinkProgress);
      this.currentCenter.lerpVectors(this.startCenter, this.nextCenter, this.shrinkProgress);

      if (this.timer <= 0) {
        // Shrink complete, proceed to next phase
        this.initPhase(this.phaseIndex + 1);
      }
    }

    this.updateVisuals();
  }

  private updateVisuals() {
    // Blue zone cylinder
    this.blueZoneMesh.scale.set(this.currentRadius, 1, this.currentRadius);
    this.blueZoneMesh.position.x = this.currentCenter.x;
    this.blueZoneMesh.position.z = this.currentCenter.y;

    // Subtle breathing pulse for blue zone
    const pulse = 0.3 + Math.sin(performance.now() * 0.004) * 0.08;
    (this.blueZoneMesh.material as THREE.MeshBasicMaterial).opacity = pulse;

    // Safe zone white ring
    this.safeZoneMesh.scale.set(this.nextRadius, 1, this.nextRadius);
    this.safeZoneMesh.position.x = this.nextCenter.x;
    this.safeZoneMesh.position.z = this.nextCenter.y;
  }

  isInsideBlueZone(x: number, z: number): boolean {
    const dx = x - this.currentCenter.x;
    const dz = z - this.currentCenter.y;
    return (dx * dx + dz * dz) <= (this.currentRadius * this.currentRadius);
  }

  getCurrentDPS(): number {
    if (this.phaseIndex < this.phases.length) {
      return this.phases[this.phaseIndex].dps;
    }
    return 30;
  }

  getStatusText(): { text: string; isDanger: boolean } {
    const sec = Math.max(0, Math.ceil(this.timer));
    const phaseNum = Math.min(this.phases.length, this.phaseIndex + 1);

    if (this.isWaiting) {
      return {
        text: `${phaseNum}페이즈 자기장 축소 대기: ${sec}초`,
        isDanger: false
      };
    } else {
      return {
        text: `⚠️ ${phaseNum}페이즈 자기장 축소 중! (${sec}초 남음)`,
        isDanger: true
      };
    }
  }
}
