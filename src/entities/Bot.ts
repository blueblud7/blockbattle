import * as THREE from 'three';
import { World, GunType, isGun } from '../world/World';
import { SRC_ZONE } from './Player';

// Bots fire on a fixed cadence, so per-shot damage stands in for each gun's strength
const BOT_DAMAGE: { [key in GunType]: number } = {
  PISTOL: 14, SHOTGUN: 22, SMG: 13, RIFLE: 16, LMG: 16, DMR: 30, SNIPER: 55, CROSSBOW: 40
};
import { ZoneManager } from '../zone/ZoneManager';

export class Bot {
  id: number;
  name: string;
  scene: THREE.Scene;
  world: World;
  mesh: THREE.Group;

  // Body parts for animation
  head: THREE.Mesh;
  body: THREE.Mesh;
  leftArm: THREE.Mesh;
  rightArm: THREE.Mesh;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  gunMesh: THREE.Mesh;
  parachuteMesh: THREE.Group;

  // Flight & Parachuting state
  inPlane: boolean = true;
  ejectTimer: number = 1.0;
  isParachuting: boolean = false;

  // Stats
  health: number = 100;
  maxHealth: number = 100;
  isAlive: boolean = true;
  hasWeapon: boolean = false;
  weapon: GunType | null = null;

  // Movement & Physics
  position: THREE.Vector3;
  velocity: THREE.Vector3 = new THREE.Vector3();
  yaw: number = 0;
  pitch: number = 0;

  // AI Logic
  state: 'LOOT' | 'WANDER' | 'COMBAT' = 'LOOT';
  targetPos: THREE.Vector3 = new THREE.Vector3();
  targetEntity: { position: THREE.Vector3; isPlayer: boolean; id?: number } | null = null;
  targetLoot: { position: THREE.Vector3; type: 'GROUND' | 'CRATE' | 'DEATH_CRATE'; ref: any } | null = null;
  shootTimer: number = 0;
  shootCooldown: number = 0.8;
  aiThinkTimer: number = 0;
  lootSearchTimer: number = 0;
  walkCycle: number = 0;
  blockedTime: number = 0;
  isOnGround: boolean = false;
  killedBy: string | null = null;
  private shirtColor: number = 0x2563eb;
  static readonly RADIUS = 0.3;
  // Set by the game each frame from the player's stance
  static playerAimHeight = 1.0;
  static playerDetectRange = 38;
  static readonly HEIGHT = 1.8;

  constructor(id: number, name: string, scene: THREE.Scene, world: World, startPos: THREE.Vector3) {
    this.id = id;
    this.name = name;
    this.scene = scene;
    this.world = world;
    this.position = startPos.clone();

    // Randomize time before jumping from cargo plane (1.0 to 9.0s)
    this.ejectTimer = 1.0 + Math.random() * 8.0;

    this.mesh = new THREE.Group();
    this.mesh.position.copy(this.position);
    this.mesh.visible = false; // Hidden until ejected from cargo plane

    const parts = this.buildVoxelCharacter();
    this.head = parts.head;
    this.body = parts.body;
    this.leftArm = parts.leftArm;
    this.rightArm = parts.rightArm;
    this.leftLeg = parts.leftLeg;
    this.rightLeg = parts.rightLeg;
    this.gunMesh = parts.gunMesh;
    this.parachuteMesh = parts.parachute;

    this.scene.add(this.mesh);

    // Pick initial landing destination
    this.targetPos.set(
      (Math.random() - 0.5) * 160,
      0,
      (Math.random() - 0.5) * 160
    );
  }

  // Authentic Minecraft Voxel Character Model
  private buildVoxelCharacter() {
    const shirtColors = [0x2563eb, 0xdc2626, 0x16a34a, 0x9333ea, 0xd97706, 0x0891b2, 0xe11d48, 0x059669];
    const shirtColor = shirtColors[this.id % shirtColors.length];
    this.shirtColor = shirtColor;

    const skinMat = new THREE.MeshLambertMaterial({ color: 0xd4a373 }); // Peach skin
    const hairMat = new THREE.MeshLambertMaterial({ color: 0x4a2810 }); // Brown hair
    const shirtMat = new THREE.MeshLambertMaterial({ color: shirtColor });
    const pantsMat = new THREE.MeshLambertMaterial({ color: 0x1e3a8a }); // Blue jeans

    // Head (0.5 x 0.5 x 0.5)
    const headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.set(0, 1.45, 0);
    this.mesh.add(head);

    // Hair cap
    const hairGeo = new THREE.BoxGeometry(0.52, 0.2, 0.52);
    const hair = new THREE.Mesh(hairGeo, hairMat);
    hair.position.set(0, 0.18, 0);
    head.add(hair);

    // Eyes
    const eyeGeo = new THREE.BoxGeometry(0.08, 0.08, 0.02);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.12, 0, 0.26);
    head.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.12, 0, 0.26);
    head.add(rightEye);

    // Torso (0.5 x 0.75 x 0.28)
    const bodyGeo = new THREE.BoxGeometry(0.5, 0.75, 0.28);
    const body = new THREE.Mesh(bodyGeo, shirtMat);
    body.position.set(0, 0.85, 0);
    this.mesh.add(body);

    // Arms
    const armGeo = new THREE.BoxGeometry(0.22, 0.75, 0.24);
    const leftArm = new THREE.Mesh(armGeo, shirtMat);
    leftArm.position.set(-0.38, 0.85, 0);
    this.mesh.add(leftArm);

    const rightArm = new THREE.Mesh(armGeo, shirtMat);
    rightArm.position.set(0.38, 0.85, 0);
    this.mesh.add(rightArm);

    // Weapon held in right hand (Hidden initially until looted!)
    const gunMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.12, 0.45),
      new THREE.MeshLambertMaterial({ color: 0x1e293b })
    );
    gunMesh.position.set(0, -0.28, -0.15);
    gunMesh.visible = false; // Start unarmed!
    rightArm.add(gunMesh);

    // Legs
    const legGeo = new THREE.BoxGeometry(0.24, 0.75, 0.26);
    const leftLeg = new THREE.Mesh(legGeo, pantsMat);
    leftLeg.position.set(-0.13, 0.25, 0);
    this.mesh.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, pantsMat);
    rightLeg.position.set(0.13, 0.25, 0);
    this.mesh.add(rightLeg);

    // Parachute canopy (Voxel glider style)
    const chuteGroup = new THREE.Group();
    const chuteMat = new THREE.MeshLambertMaterial({ color: 0xf59e0b, side: THREE.DoubleSide });
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.2, 1.6), chuteMat);
    canopy.position.set(0, 2.5, 0);
    chuteGroup.add(canopy);

    // Chute cords
    const cordMat = new THREE.LineBasicMaterial({ color: 0xcccccc });
    const cordGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-1.1, 2.4, -0.7), new THREE.Vector3(0, 1.4, 0),
      new THREE.Vector3(1.1, 2.4, -0.7), new THREE.Vector3(0, 1.4, 0),
      new THREE.Vector3(-1.1, 2.4, 0.7), new THREE.Vector3(0, 1.4, 0),
      new THREE.Vector3(1.1, 2.4, 0.7), new THREE.Vector3(0, 1.4, 0),
    ]);
    const cords = new THREE.LineSegments(cordGeo, cordMat);
    chuteGroup.add(cords);

    chuteGroup.visible = false;
    this.mesh.add(chuteGroup);

    return { head, body, leftArm, rightArm, leftLeg, rightLeg, gunMesh, parachute: chuteGroup };
  }

  // Eject from Cargo Plane high in the sky
  eject(planeDropPos: THREE.Vector3) {
    this.inPlane = false;
    this.isParachuting = true;

    this.position.copy(planeDropPos);
    this.position.x += (Math.random() - 0.5) * 8;
    this.position.z += (Math.random() - 0.5) * 8;

    this.mesh.position.copy(this.position);
    this.mesh.visible = true;
    this.parachuteMesh.visible = true;

    // Pick a landing spot near the drop point, kept on the island
    const tx = this.position.x + (Math.random() - 0.5) * 120;
    const tz = this.position.z + (Math.random() - 0.5) * 120;
    const maxR = this.world.half * 0.7;
    const r = Math.hypot(tx, tz);
    const k = r > maxR ? maxR / r : 1;
    this.targetPos.set(tx * k, 0, tz * k);
    // Don't steer the parachute into the sea or the river
    if (!this.world.isLand(this.targetPos.x, this.targetPos.z)) {
      const land = this.world.findNearestLand(this.targetPos.x, this.targetPos.z, 6, 120);
      if (land) this.targetPos.set(land.x, 0, land.y);
    }
  }

  update(
    delta: number,
    playerPos: THREE.Vector3,
    allBots: Bot[],
    zone: ZoneManager,
    onShootCallback: (from: THREE.Vector3, dir: THREE.Vector3, damage: number, shooterName: string) => void
  ) {
    if (!this.isAlive || this.inPlane) return;

    // Check Blue zone damage
    if (!zone.isInsideBlueZone(this.position.x, this.position.z)) {
      this.health -= zone.getCurrentDPS() * delta;
      if (this.health <= 0) {
        this.die(SRC_ZONE);
        return;
      }
    }

    if (this.isParachuting) {
      this.updateParachuteDescent(delta);
      return;
    }

    // AI Decision loop
    this.aiThinkTimer -= delta;
    if (this.aiThinkTimer <= 0) {
      this.aiThinkTimer = 0.35 + Math.random() * 0.3;
      this.decideAIState(playerPos, allBots, zone);
    }

    // Execute state behavior
    this.executeMovement(delta);
    this.executeCombat(delta, playerPos, onShootCallback);

    // Animate limbs
    this.animateWalking(delta);
  }

  private updateParachuteDescent(delta: number) {
    // Fall downward
    this.position.y -= 8.5 * delta;

    // Glide horizontally toward target
    const dx = this.targetPos.x - this.position.x;
    const dz = this.targetPos.z - this.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist > 1) {
      const glideSpeed = 12 * delta;
      this.position.x += (dx / dist) * glideSpeed;
      this.position.z += (dz / dist) * glideSpeed;
      this.mesh.rotation.y = Math.atan2(dx, dz);
    }

    // Landing check
    const surfaceY = Math.max(this.world.getSurfaceHeight(this.position.x, this.position.z), World.WATER_LEVEL - 1.2);
    if (this.position.y <= surfaceY) {
      this.position.y = surfaceY;
      this.world.unstick(this.position, Bot.RADIUS, Bot.HEIGHT);
      this.velocity.set(0, 0, 0);
      this.isParachuting = false;
      this.parachuteMesh.visible = false;
      this.state = 'LOOT'; // Land bare-handed -> must loot!
      this.lootSearchTimer = 0;
    }

    this.mesh.position.copy(this.position);
  }

  private canSee(target: THREE.Vector3, aimHeight: number = 1.2): boolean {
    const eye = this.position.clone();
    eye.y += 1.5;
    const aim = target.clone();
    aim.y += aimHeight;
    return this.world.hasLineOfSight(eye, aim);
  }

  private decideAIState(playerPos: THREE.Vector3, allBots: Bot[], zone: ZoneManager) {
    // 1. If unharmed & unarmed, priority #1 is LOOTING!
    if (!this.hasWeapon) {
      this.state = 'LOOT';
      this.findNearestLoot();
      return;
    }

    // 2. Safe zone movement if outside
    if (!zone.isInsideBlueZone(this.position.x, this.position.z) || Math.random() < 0.25) {
      this.targetPos.set(
        zone.nextCenter.x + (Math.random() - 0.5) * zone.nextRadius * 0.7,
        0,
        zone.nextCenter.y + (Math.random() - 0.5) * zone.nextRadius * 0.7
      );
    }

    // 3. Enemy detection (Player or other Bots)
    let closestTarget: { position: THREE.Vector3; isPlayer: boolean; id?: number } | null = null;
    let closestDist = 38; // Bot visual range

    // Check Player
    const distToPlayer = this.position.distanceTo(playerPos);
    if (distToPlayer < Math.min(closestDist, Bot.playerDetectRange) && this.canSee(playerPos, Bot.playerAimHeight + 0.1)) {
      closestTarget = { position: playerPos, isPlayer: true };
      closestDist = distToPlayer;
    }

    // Check Other Bots
    for (const other of allBots) {
      if (other.id === this.id || !other.isAlive || other.isParachuting || other.inPlane) continue;
      const d = this.position.distanceTo(other.position);
      if (d < closestDist && this.canSee(other.position)) {
        closestDist = d;
        closestTarget = { position: other.position, isPlayer: false, id: other.id };
      }
    }

    if (closestTarget) {
      this.state = 'COMBAT';
      this.targetEntity = closestTarget;
    } else {
      this.state = 'WANDER';
      this.targetEntity = null;
    }
  }

  // AI Searches for Ground Items, Supply Crates, or Death Crates
  private findNearestLoot() {
    let closestLoot: { position: THREE.Vector3; type: 'GROUND' | 'CRATE' | 'DEATH_CRATE'; ref: any } | null = null;
    let minD = 90;

    // 1. Check Ground Loot Items (Weapons in houses/barracks)
    for (const item of this.world.groundItems) {
      if (item.picked || !isGun(item.type)) continue; // bots only go for guns
      const d = this.position.distanceTo(item.position);
      if (d < minD) {
        minD = d;
        closestLoot = { position: item.position, type: 'GROUND', ref: item };
      }
    }

    // 2. Check Death Crates (Defeated players)
    for (const dc of this.world.deathCrates) {
      if (dc.opened) continue;
      const d = this.position.distanceTo(dc.position);
      if (d < minD) {
        minD = d;
        closestLoot = { position: dc.position, type: 'DEATH_CRATE', ref: dc };
      }
    }

    // 3. Check Supply Crates
    for (const crate of this.world.crates) {
      if (crate.opened) continue;
      const d = this.position.distanceTo(crate.position);
      if (d < minD) {
        minD = d;
        closestLoot = { position: crate.position, type: 'CRATE', ref: crate };
      }
    }

    if (closestLoot) {
      this.targetLoot = closestLoot;
      this.targetPos.copy(closestLoot.position);
    } else {
      // If no loot found within 55m, bot scavenges for a basic weapon after 6s
      this.lootSearchTimer += 0.5;
      if (this.lootSearchTimer > 6.0) {
        const fallback: GunType[] = ['PISTOL', 'SHOTGUN', 'RIFLE', 'SMG'];
        this.equipWeapon(fallback[Math.floor(Math.random() * fallback.length)]);
      }
    }
  }

  private equipWeapon(type: GunType) {
    this.hasWeapon = true;
    this.weapon = type;
    this.gunMesh.visible = true;

    // Recolor gun mesh based on weapon type
    const mat = this.gunMesh.material as THREE.MeshLambertMaterial;
    if (type === 'SNIPER') mat.color.setHex(0x2e3a1f);
    else if (type === 'SHOTGUN') mat.color.setHex(0x78350f);
    else if (type === 'RIFLE') mat.color.setHex(0x1e3a24);
    else if (type === 'LMG') mat.color.setHex(0x57534e);
    else if (type === 'DMR' || type === 'CROSSBOW') mat.color.setHex(0x8b6f47);
    else mat.color.setHex(0x1e293b);

    this.state = 'WANDER';
    this.targetLoot = null;
  }

  private executeMovement(delta: number) {
    let moveTarget = this.targetPos;

    if (this.state === 'COMBAT' && this.targetEntity) {
      moveTarget = this.targetEntity.position;
    } else if (this.state === 'LOOT' && this.targetLoot) {
      moveTarget = this.targetLoot.position;
    }

    const dx = moveTarget.x - this.position.x;
    const dz = moveTarget.z - this.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const dy = Math.abs(moveTarget.y - this.position.y);

    // Reached loot: pick it up (loot on an upper floor right above counts as reachable)
    if (this.state === 'LOOT' && this.targetLoot && dist < 1.6 && dy < 5) {
      if (this.targetLoot.type === 'GROUND') {
        const item = this.targetLoot.ref;
        item.picked = true;
        item.mesh.visible = false;
        this.equipWeapon(isGun(item.type) ? item.type : 'PISTOL');
      } else if (this.targetLoot.type === 'CRATE') {
        const crate = this.targetLoot.ref;
        crate.opened = true;
        crate.mesh.scale.set(0.01, 0.01, 0.01);
        this.equipWeapon(isGun(crate.lootType) ? crate.lootType : 'RIFLE');
      } else if (this.targetLoot.type === 'DEATH_CRATE') {
        const dc = this.targetLoot.ref;
        dc.opened = true;
        dc.mesh.visible = false;
        const w = dc.weapons[0];
        this.equipWeapon(w && isGun(w) ? w : 'RIFLE');
      }
      return;
    }

    // Someone else took the loot we were walking to
    if (this.targetLoot) {
      const ref = this.targetLoot.ref;
      if (ref.picked || ref.opened) {
        this.targetLoot = null;
        this.aiThinkTimer = 0;
      }
    }

    const R = Bot.RADIUS;
    const H = Bot.HEIGHT;
    const inWater = this.position.y < World.WATER_LEVEL - 0.4;
    const stopDist = this.state === 'COMBAT' ? 6 : 1.0;

    if (dist > stopDist) {
      const speed = inWater ? 3.2 : 4.4;
      const stepX = (dx / dist) * speed * delta;
      const stepZ = (dz / dist) * speed * delta;
      const before = this.position.clone();
      this.world.moveHorizontal(this.position, stepX, stepZ, R, H, inWater ? 2.0 : (this.isOnGround ? 1.05 : 0));

      const progressed = Math.hypot(this.position.x - before.x, this.position.z - before.z);
      if (progressed < speed * delta * 0.3) {
        this.blockedTime += delta;
        if (this.blockedTime > 0.7) {
          this.digForward(dx / dist, dz / dist);
          this.blockedTime = 0;
        }
      } else {
        this.blockedTime = 0;
      }

      this.mesh.rotation.y = Math.atan2(dx, dz);
    }

    // Gravity / floating
    if (inWater) {
      const floatY = World.WATER_LEVEL - 1.2;
      this.velocity.y = this.position.y < floatY ? 3 : 0;
    } else {
      this.velocity.y = Math.max(this.velocity.y - 25 * delta, -40);
    }
    this.isOnGround = this.world.moveVertical(this.position, this.velocity, delta, R, H);
    this.mesh.position.copy(this.position);
  }

  // Minecraft-style: when a wall blocks the way, mine through it (feet + head height)
  private digForward(dirX: number, dirZ: number) {
    const bx = Math.floor(this.position.x + dirX * 0.8);
    const bz = Math.floor(this.position.z + dirZ * 0.8);
    const by = Math.floor(this.position.y + 0.01);
    this.world.breakBlock(bx, by, bz, true);
    this.world.breakBlock(bx, by + 1, bz, true);
  }

  private executeCombat(
    delta: number,
    playerPos: THREE.Vector3,
    onShootCallback: (from: THREE.Vector3, dir: THREE.Vector3, damage: number, shooterName: string) => void
  ) {
    if (this.state !== 'COMBAT' || !this.targetEntity || !this.hasWeapon) return;

    const targetPos = this.targetEntity.position;
    const dist = this.position.distanceTo(targetPos);

    // Face the target
    const dx = targetPos.x - this.position.x;
    const dz = targetPos.z - this.position.z;
    this.mesh.rotation.y = Math.atan2(dx, dz);

    // Aim right arm up
    this.rightArm.rotation.x = -Math.PI / 2 + 0.1;

    // Shoot interval (only with a clear line of fire)
    this.shootTimer -= delta;
    const aimH = this.targetEntity.isPlayer ? Bot.playerAimHeight : 1.0;
    if (this.shootTimer <= 0 && dist < 45 && this.canSee(targetPos, aimH + 0.1)) {
      this.shootTimer = this.shootCooldown;
      this.shootCooldown = 0.5 + Math.random() * 0.6;

      // Shooting direction with slight inaccuracy
      const dir = new THREE.Vector3()
        .subVectors(targetPos.clone().add(new THREE.Vector3(0, aimH, 0)), this.position.clone().add(new THREE.Vector3(0, 1.2, 0)))
        .normalize();

      dir.x += (Math.random() - 0.5) * 0.12;
      dir.y += (Math.random() - 0.5) * 0.08;
      dir.z += (Math.random() - 0.5) * 0.12;
      dir.normalize();

      const shootOrigin = this.position.clone().add(new THREE.Vector3(0, 1.2, 0));
      const damage = BOT_DAMAGE[this.weapon || 'PISTOL'];

      onShootCallback(shootOrigin, dir, damage, this.name);
    }
  }

  private animateWalking(delta: number) {
    this.walkCycle += delta * 10;
    const legAngle = Math.sin(this.walkCycle) * 0.5;

    this.leftLeg.rotation.x = legAngle;
    this.rightLeg.rotation.x = -legAngle;

    if (this.state !== 'COMBAT') {
      this.leftArm.rotation.x = -legAngle;
      this.rightArm.rotation.x = legAngle;
    }
  }

  takeDamage(amount: number, attackerName: string): boolean {
    if (!this.isAlive) return false;

    this.health -= amount;

    // Flash red
    (this.body.material as THREE.MeshLambertMaterial).color.setHex(0xff0000);
    setTimeout(() => {
      if (this.isAlive) {
        (this.body.material as THREE.MeshLambertMaterial).color.setHex(this.shirtColor);
      }
    }, 100);

    // If unarmed and attacked, panic and run to cover/loot!
    if (!this.hasWeapon) {
      this.state = 'LOOT';
      this.findNearestLoot();
    }

    if (this.health <= 0) {
      this.die(attackerName);
      return true;
    }
    return false;
  }

  die(killer: string) {
    this.isAlive = false;
    this.killedBy = killer;
    this.health = 0;

    // Death animation: collapse / tilt
    this.mesh.rotation.z = Math.PI / 2;
    this.mesh.position.y -= 0.6;

    // Spawn PUBG Death Crate with glowing vertical beam!
    const droppedWeapon = this.weapon || 'PISTOL';
    this.world.spawnDeathCrate(
      this.position.clone(),
      this.name,
      droppedWeapon,
      40,
      Math.random() > 0.4 ? 1 : 0,
      Math.random() > 0.5
    );

    // Hide character model after 2.5 seconds
    setTimeout(() => {
      this.scene.remove(this.mesh);
    }, 2500);
  }
}
