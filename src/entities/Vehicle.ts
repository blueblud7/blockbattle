import * as THREE from 'three';
import { World } from '../world/World';

export type VehicleType = 'JEEP' | 'MOTO';

interface VehicleSpec {
  maxSpeed: number;   // m/s on gravel roads
  accel: number;
  turnRate: number;   // rad/s at speed
  health: number;
  radius: number;     // collision half-width
  height: number;
  seat: THREE.Vector3;
  armor: number;      // share of bullet damage the vehicle soaks for its driver
}

const SPECS: { [key in VehicleType]: VehicleSpec } = {
  JEEP: { maxSpeed: 20, accel: 8, turnRate: 1.6, health: 400, radius: 0.95, height: 1.5, seat: new THREE.Vector3(-0.45, 0.55, -0.1), armor: 0.65 },
  MOTO: { maxSpeed: 27, accel: 12, turnRate: 2.4, health: 160, radius: 0.45, height: 1.3, seat: new THREE.Vector3(0, 0.75, -0.25), armor: 0 }
};

export class Vehicle {
  type: VehicleType;
  spec: VehicleSpec;
  world: World;
  scene: THREE.Scene;
  mesh: THREE.Group;
  driverMesh: THREE.Group;
  wheels: THREE.Mesh[] = [];
  position: THREE.Vector3;
  velocity: THREE.Vector3 = new THREE.Vector3();
  yaw: number;
  speed = 0;
  steer = 0;
  health: number;
  destroyed = false;
  occupied = false;
  isOnGround = false;
  private visualY: number;

  constructor(type: VehicleType, x: number, z: number, yaw: number, world: World, scene: THREE.Scene) {
    this.type = type;
    this.spec = SPECS[type];
    this.world = world;
    this.scene = scene;
    this.yaw = yaw;
    this.health = this.spec.health;
    this.position = new THREE.Vector3(x, world.getSurfaceHeight(x, z), z);
    world.unstick(this.position, this.spec.radius, this.spec.height);
    this.visualY = this.position.y;
    this.mesh = type === 'JEEP' ? this.buildJeep() : this.buildMoto();
    this.driverMesh = this.buildDriver();
    this.driverMesh.position.copy(this.spec.seat);
    this.driverMesh.visible = false;
    this.mesh.add(this.driverMesh);
    this.mesh.traverse(o => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
    this.syncMesh();
    scene.add(this.mesh);
  }

  get maxHealth(): number {
    return this.spec.health;
  }

  /** Unit vector the vehicle points along (model faces +z). */
  get forward(): THREE.Vector3 {
    return new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
  }

  /** World position of the driver's feet. */
  seatPosition(): THREE.Vector3 {
    return this.spec.seat.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw).add(this.mesh.position);
  }

  /** Centre used for bullet / blast hits. */
  get center(): THREE.Vector3 {
    return this.position.clone().add(new THREE.Vector3(0, this.spec.height * 0.5, 0));
  }

  get hitRadius(): number {
    return this.type === 'JEEP' ? 1.5 : 0.8;
  }

  /**
   * Drive one frame. throttle -1..1, steer -1..1. Returns the impact speed when it hits a wall
   * hard (for crash damage), else 0.
   */
  update(delta: number, throttle: number, steerIn: number, brake: boolean): number {
    if (this.destroyed) return 0;
    const s = this.spec;
    const below = this.world.getBlock(Math.floor(this.position.x), Math.floor(this.position.y - 0.5), Math.floor(this.position.z));
    const onRoad = below === World.BLOCK_GRAVEL;
    const top = (onRoad ? 1 : 0.7) * s.maxSpeed;

    // Engine, brakes and rolling drag
    if (throttle > 0) this.speed += s.accel * throttle * delta * (this.speed < 0 ? 2 : 1);
    else if (throttle < 0) this.speed += s.accel * throttle * delta * (this.speed > 0 ? 2 : 0.6);
    else this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 4 * delta);
    if (brake) this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 18 * delta);
    if (!this.isOnGround) this.speed *= Math.pow(0.9, delta);
    this.speed = Math.max(-top * 0.35, Math.min(top, this.speed));

    // Steering bites harder at speed, flips when reversing
    this.steer += (steerIn - this.steer) * Math.min(1, 8 * delta);
    const grip = Math.min(1, Math.abs(this.speed) / 6);
    this.yaw += this.steer * s.turnRate * grip * Math.sign(this.speed) * delta * (this.isOnGround ? 1 : 0.3);

    let impact = 0;
    const step = this.forward.multiplyScalar(this.speed * delta);
    if (step.lengthSq() > 0) {
      const nx = this.position.x + step.x, nz = this.position.z + step.z;
      // Don't drive into the sea or the river
      const ahead = this.world.getSurfaceHeight(nx + Math.sign(step.x) * s.radius, nz + Math.sign(step.z) * s.radius);
      if (ahead < World.WATER_LEVEL) {
        impact = Math.abs(this.speed);
        this.speed = 0;
      } else {
        const before = this.position.clone();
        // Wheels take 1-block steps in stride and crawl up 2-block ledges
        this.world.moveHorizontal(this.position, step.x, step.z, s.radius, s.height, this.isOnGround ? 2.05 : 0);
        if (this.position.y - before.y > 1.5) this.speed *= 0.5;
        const moved = Math.hypot(this.position.x - before.x, this.position.z - before.z);
        if (moved < step.length() * 0.3) {
          impact = Math.abs(this.speed);
          this.speed *= -0.15; // bounce off the wall
        }
      }
    }

    this.velocity.y = Math.max(this.velocity.y - 25 * delta, -40);
    this.isOnGround = this.world.moveVertical(this.position, this.velocity, delta, s.radius, s.height);

    // Spin the wheels
    for (const w of this.wheels) w.rotation.x += (this.speed * delta) / 0.4;
    this.syncMesh(delta);
    return impact;
  }

  /** Keep a parked / wrecked vehicle sitting on the ground (blocks under it may be blown away). */
  settle(delta: number) {
    this.velocity.y = Math.max(this.velocity.y - 25 * delta, -40);
    this.isOnGround = this.world.moveVertical(this.position, this.velocity, delta, this.spec.radius, this.spec.height);
    this.speed = 0;
    this.syncMesh(delta);
  }

  takeDamage(amount: number): boolean {
    if (this.destroyed) return false;
    this.health -= amount;
    if (this.health <= 0) {
      this.health = 0;
      this.destroyed = true;
      this.occupied = false;
      this.driverMesh.visible = false;
      // Burnt-out wreck
      this.mesh.traverse(o => {
        const m = (o as THREE.Mesh).material as THREE.MeshLambertMaterial | undefined;
        if (m && m.color) { m.color.setHex(0x1f1f1f); }
      });
      return true;
    }
    return false;
  }

  setOccupied(on: boolean) {
    this.occupied = on;
    this.driverMesh.visible = on;
    if (!on) this.steer = 0;
  }

  dispose() {
    this.scene.remove(this.mesh);
  }

  private syncMesh(delta: number = 1) {
    // Smooth out the 1-block stair steps of the voxel terrain
    this.visualY += (this.position.y - this.visualY) * Math.min(1, 14 * delta);
    if (Math.abs(this.position.y - this.visualY) > 3) this.visualY = this.position.y;
    this.mesh.position.set(this.position.x, this.visualY, this.position.z);
    this.mesh.rotation.y = this.yaw;
    // Lean a little into turns (bikes lean more)
    this.mesh.rotation.z = -this.steer * Math.min(1, Math.abs(this.speed) / 15) * (this.type === 'MOTO' ? 0.35 : 0.05);
  }

  private box(w: number, h: number, d: number, color: number, x: number, y: number, z: number, parent: THREE.Object3D) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }

  private wheel(r: number, width: number, x: number, y: number, z: number, parent: THREE.Object3D) {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, z);
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(r, r, width, 12), new THREE.MeshLambertMaterial({ color: 0x18181b }));
    tire.rotation.z = Math.PI / 2;
    const hub = new THREE.Mesh(new THREE.BoxGeometry(width + 0.02, r * 0.7, r * 0.7), new THREE.MeshLambertMaterial({ color: 0x9ca3af }));
    const spin = new THREE.Mesh(); // rotates around x with the wheel
    spin.add(tire, hub);
    pivot.add(spin);
    parent.add(pivot);
    this.wheels.push(spin);
  }

  private buildJeep(): THREE.Group {
    const g = new THREE.Group();
    const olive = 0x556b2f, dark = 0x3f4f22;
    this.box(1.9, 0.55, 3.6, olive, 0, 0.75, 0, g);            // tub
    this.box(1.8, 0.35, 1.2, dark, 0, 1.15, 1.15, g);          // hood
    this.box(1.9, 0.08, 0.1, 0x111827, 0, 1.1, 1.78, g);       // grille line
    this.box(0.25, 0.18, 0.05, 0xfef3c7, -0.65, 0.95, 1.81, g); // headlights
    this.box(0.25, 0.18, 0.05, 0xfef3c7, 0.65, 0.95, 1.81, g);
    this.box(1.8, 0.7, 0.06, 0x94a3b8, 0, 1.65, 0.5, g).material = new THREE.MeshLambertMaterial({ color: 0xbae6fd, transparent: true, opacity: 0.45 });
    this.box(0.08, 0.75, 0.08, dark, -0.88, 1.65, 0.5, g);      // windshield frame
    this.box(0.08, 0.75, 0.08, dark, 0.88, 1.65, 0.5, g);
    this.box(0.08, 0.9, 0.08, 0x27272a, -0.85, 1.5, -1.0, g);   // roll bar
    this.box(0.08, 0.9, 0.08, 0x27272a, 0.85, 1.5, -1.0, g);
    this.box(1.78, 0.08, 0.08, 0x27272a, 0, 1.95, -1.0, g);
    this.box(0.7, 0.35, 0.7, 0x292524, -0.45, 1.15, -0.1, g);   // seats
    this.box(0.7, 0.35, 0.7, 0x292524, 0.45, 1.15, -0.1, g);
    this.box(0.08, 0.08, 0.3, 0x111827, -0.45, 1.4, 0.35, g);   // steering column
    const spare = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.25, 12), new THREE.MeshLambertMaterial({ color: 0x18181b }));
    spare.rotation.x = Math.PI / 2;
    spare.position.set(0, 1.05, -1.92);
    g.add(spare);
    for (const [x, z] of [[-0.95, 1.2], [0.95, 1.2], [-0.95, -1.2], [0.95, -1.2]]) this.wheel(0.42, 0.32, x, 0.42, z, g);
    return g;
  }

  private buildMoto(): THREE.Group {
    const g = new THREE.Group();
    const red = 0xb91c1c;
    this.box(0.22, 0.3, 1.3, 0x27272a, 0, 0.55, 0, g);        // frame
    this.box(0.36, 0.3, 0.5, red, 0, 0.85, 0.25, g);          // tank
    this.box(0.3, 0.12, 0.6, 0x111827, 0, 0.82, -0.3, g);     // seat
    this.box(0.3, 0.25, 0.3, 0x52525b, 0, 0.4, 0.05, g);      // engine
    this.box(0.08, 0.6, 0.08, 0x9ca3af, 0, 0.75, 0.62, g);    // fork
    this.box(0.7, 0.06, 0.06, 0x111827, 0, 1.08, 0.58, g);    // handlebar
    this.box(0.18, 0.12, 0.06, 0xfef3c7, 0, 0.95, 0.7, g);    // headlight
    this.box(0.26, 0.08, 0.35, red, 0, 0.72, -0.72, g);       // rear fender
    this.wheel(0.38, 0.14, 0, 0.38, 0.68, g);
    this.wheel(0.38, 0.16, 0, 0.38, -0.65, g);
    return g;
  }

  // Simple seated voxel figure so the driver shows in third person
  private buildDriver(): THREE.Group {
    const d = new THREE.Group();
    const moto = this.type === 'MOTO';
    this.box(0.5, 0.7, 0.28, 0xf59e0b, 0, 0.75, moto ? 0.05 : 0, d).rotation.x = moto ? 0.35 : 0;
    this.box(0.46, 0.46, 0.46, 0xd4a373, 0, 1.35, moto ? 0.18 : 0, d);
    this.box(0.48, 0.16, 0.48, 0x4a2810, 0, 1.6, moto ? 0.18 : 0, d);
    this.box(0.18, 0.18, 0.6, 0xf59e0b, -0.3, 0.85, 0.3, d);  // arms forward to the wheel / bars
    this.box(0.18, 0.18, 0.6, 0xf59e0b, 0.3, 0.85, 0.3, d);
    this.box(0.22, 0.22, 0.6, 0x1e3a8a, -0.13, 0.35, 0.25, d); // thighs
    this.box(0.22, 0.22, 0.6, 0x1e3a8a, 0.13, 0.35, 0.25, d);
    return d;
  }
}
