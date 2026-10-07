import * as THREE from 'three';

export class CargoPlane {
  scene: THREE.Scene;
  mesh: THREE.Group;
  propellers: THREE.Group[] = [];

  // Flight path parameters
  startPos: THREE.Vector3 = new THREE.Vector3(-150, 145, -150);
  endPos: THREE.Vector3 = new THREE.Vector3(150, 145, 150);
  position: THREE.Vector3 = new THREE.Vector3();
  flightDir: THREE.Vector3 = new THREE.Vector3();
  totalDistance: number = 0;
  distanceTraveled: number = 0;
  speed: number = 40; // m/s
  isFlying: boolean = false;
  yaw: number = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.mesh = new THREE.Group();
    this.buildVoxelPlane();
    this.scene.add(this.mesh);
    this.reset();
  }

  // Build authentic Minecraft Voxel C-130 Hercules Cargo Plane
  private buildVoxelPlane() {
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x334155 }); // Dark military slate
    const wingMat = new THREE.MeshLambertMaterial({ color: 0x475569 }); // Slate grey
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.75,
      roughness: 0.1
    });
    const engineMat = new THREE.MeshLambertMaterial({ color: 0x1e293b }); // Dark iron
    const propMat = new THREE.MeshLambertMaterial({ color: 0xfacc15 }); // Yellow-tipped blades
    const stripeMat = new THREE.MeshLambertMaterial({ color: 0xe2e8f0 }); // White stripe

    // 1. Main Fuselage (Cargo Cabin: length 22, width 5.2, height 4.2)
    const fuselage = new THREE.Mesh(new THREE.BoxGeometry(5.2, 4.2, 22), bodyMat);
    fuselage.castShadow = true;
    fuselage.receiveShadow = true;
    this.mesh.add(fuselage);

    // 2. Cockpit Section (Front nose)
    const nose = new THREE.Mesh(new THREE.BoxGeometry(4.8, 3.4, 5), bodyMat);
    nose.position.set(0, -0.3, 12.5);
    this.mesh.add(nose);

    // Cockpit windshield
    const glass = new THREE.Mesh(new THREE.BoxGeometry(4.0, 1.4, 1.8), glassMat);
    glass.position.set(0, 0.9, 12.8);
    this.mesh.add(glass);

    // 3. Open Rear Cargo Bay Ramp (where troops drop out!)
    const rampMat = new THREE.MeshLambertMaterial({ color: 0x111827 });
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.4, 4.5), rampMat);
    ramp.position.set(0, -1.8, -12);
    ramp.rotation.x = 0.35; // Angled downwards ramp door
    this.mesh.add(ramp);

    // Side white identification stripes
    const stripeL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.6, 16), stripeMat);
    stripeL.position.set(-2.65, 0.3, 0);
    const stripeR = stripeL.clone();
    stripeR.position.set(2.65, 0.3, 0);
    this.mesh.add(stripeL, stripeR);

    // 4. Wings (Span 34m, chord 4.6m, mounted high)
    const wing = new THREE.Mesh(new THREE.BoxGeometry(34, 0.6, 4.6), wingMat);
    wing.position.set(0, 2.0, 2);
    wing.castShadow = true;
    this.mesh.add(wing);

    // Wingtip nav lights (Red on left port, Green on right starboard)
    const navRed = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.6), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
    navRed.position.set(-17.1, 2.0, 2);
    const navGreen = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.6), new THREE.MeshBasicMaterial({ color: 0x22c55e }));
    navGreen.position.set(17.1, 2.0, 2);
    this.mesh.add(navRed, navGreen);

    // 5. Tail Fin & Stabilizers
    // Vertical tail
    const vertTail = new THREE.Mesh(new THREE.BoxGeometry(0.6, 5.5, 4.2), bodyMat);
    vertTail.position.set(0, 4.2, -10);
    this.mesh.add(vertTail);

    // Horizontal tail stabilizers
    const horizTail = new THREE.Mesh(new THREE.BoxGeometry(13, 0.5, 3.2), wingMat);
    horizTail.position.set(0, 2.2, -10.5);
    this.mesh.add(horizTail);

    // 6. Four Turboprop Engines & Spinning Propellers
    const engineXPositions = [-11.5, -5.5, 5.5, 11.5];
    engineXPositions.forEach(ex => {
      // Nacelle
      const nacelle = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 4.2), engineMat);
      nacelle.position.set(ex, 1.2, 3.2);
      this.mesh.add(nacelle);

      // Propeller Hub
      const propGroup = new THREE.Group();
      propGroup.position.set(ex, 1.2, 5.4);

      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.5, 8), engineMat);
      hub.rotation.x = Math.PI / 2;
      propGroup.add(hub);

      // 4 Propeller blades
      const blade1 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.6, 0.05), propMat);
      const blade2 = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.2, 0.05), propMat);
      propGroup.add(blade1, blade2);

      this.mesh.add(propGroup);
      this.propellers.push(propGroup);
    });
  }

  reset(start?: THREE.Vector3, end?: THREE.Vector3) {
    if (start) this.startPos.copy(start);
    if (end) this.endPos.copy(end);

    this.position.copy(this.startPos);
    this.distanceTraveled = 0;
    this.totalDistance = this.startPos.distanceTo(this.endPos);

    this.flightDir.subVectors(this.endPos, this.startPos).normalize();
    this.yaw = Math.atan2(this.flightDir.x, this.flightDir.z);

    this.mesh.position.copy(this.position);
    this.mesh.rotation.set(0, this.yaw, 0);
    this.mesh.visible = true;
    this.isFlying = true;
  }

  update(delta: number): { position: THREE.Vector3; isFinished: boolean } {
    if (!this.isFlying) {
      return { position: this.position, isFinished: true };
    }

    // Spin propellers fast
    for (const prop of this.propellers) {
      prop.rotation.z += 40 * delta;
    }

    // Advance along flight path
    const moveDist = this.speed * delta;
    this.distanceTraveled += moveDist;
    this.position.addScaledVector(this.flightDir, moveDist);
    this.mesh.position.copy(this.position);

    const isFinished = this.distanceTraveled >= this.totalDistance;
    if (isFinished) {
      this.isFlying = false;
      // Keep flying away or hide after island crossed
      this.mesh.visible = false;
    }

    return { position: this.position, isFinished };
  }

  getPosition(): THREE.Vector3 {
    return this.position.clone();
  }

  getDropPosition(): THREE.Vector3 {
    // Drop right out of the rear ramp
    const rearOffset = new THREE.Vector3(0, -1.8, -13).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    return this.position.clone().add(rearOffset);
  }

  // Flight-time window [t0, t1] (seconds) during which the plane is within `radius` of the island center
  getTimeWindowOver(radius: number): [number, number] {
    const s0 = -this.startPos.clone().setY(0).dot(this.flightDir.clone().setY(0).normalize());
    const closest = this.startPos.clone().addScaledVector(this.flightDir, s0).setY(0).length();
    const halfChord = Math.sqrt(Math.max(0, radius * radius - closest * closest));
    const t0 = Math.max(0, (s0 - halfChord) / this.speed);
    const t1 = Math.min(this.totalDistance / this.speed, (s0 + halfChord) / this.speed);
    return t1 > t0 ? [t0, t1] : [0, this.totalDistance / this.speed];
  }

  isFlightOver(): boolean {
    return !this.isFlying;
  }
}
