import * as THREE from 'three';
import type { Vehicle } from './Vehicle';
import { World, isScope, isGun, itemName, SCOPE_LEVEL } from '../world/World';
import { WeaponManager, WeaponType, fovForZoom, ResourceType } from '../weapons/Weapon';
import { t } from '../i18n';
import { RECIPES } from '../crafting/Recipes';
import { sounds } from '../audio/SoundManager';
import { ZoneManager } from '../zone/ZoneManager';

export type Stance = 'stand' | 'crouch' | 'prone';

// Body height, eye height, move speed and weapon spread per stance
const STANCES: { [key in Stance]: { height: number; eye: number; speed: number; spread: number } } = {
  stand: { height: 1.8, eye: 1.6, speed: 1.0, spread: 1.0 },
  crouch: { height: 1.25, eye: 1.05, speed: 0.55, spread: 0.7 },
  prone: { height: 0.6, eye: 0.4, speed: 0.25, spread: 0.45 }
};

/** Damage source ids (translated only when shown). */
export const SRC_ZONE = 'ZONE';

export class Player {
  camera: THREE.PerspectiveCamera;
  world: World;
  weapons: WeaponManager;

  // Stats
  health: number = 100;
  maxHealth: number = 100;
  armor: number = 0;
  maxArmor: number = 100;
  isAlive: boolean = true;
  kills: number = 0;

  // Drop & Flight state
  inPlane: boolean = true;
  isAirborne: boolean = false;
  isParachuteOpen: boolean = false;

  // Physics & Movement
  position: THREE.Vector3 = new THREE.Vector3(0, 160, 0);
  velocity: THREE.Vector3 = new THREE.Vector3();
  isOnGround: boolean = false;
  moveSpeed: number = 7.0;
  sprintMultiplier: number = 1.45;
  static readonly RADIUS = 0.3;
  static readonly HEIGHT = 1.8;
  static readonly EYE_HEIGHT = 1.6;
  lastDamageSource: string = SRC_ZONE;
  uiOpen: boolean = false;
  vehicle: Vehicle | null = null; // driving this
  onInteract: (() => boolean) | null = null; // vehicle enter / exit, set by the game // crafting menu is open: no shooting / mouse look

  // Stance (C: crouch, Z: prone)
  stance: Stance = 'stand';
  private eyeHeight: number = Player.EYE_HEIGHT;
  private suppressJump: boolean = false; // Space used to stand up shouldn't also jump

  get height(): number {
    return STANCES[this.stance].height;
  }

  get stanceLabel(): string {
    return t(`stance.${this.stance}`);
  }

  /** Switch stance; standing up needs head room. Returns false if blocked. */
  setStance(next: Stance, silent: boolean = false): boolean {
    if (next === this.stance) return true;
    if (this.inPlane || this.isAirborne || this.isInWater) {
      if (next !== 'stand') return false;
    }
    if (STANCES[next].height > this.height &&
        this.world.collidesBox(this.position.x, this.position.y + 0.01, this.position.z, Player.RADIUS, STANCES[next].height)) {
      if (!silent) this.showToast(t('toast.cantStand'));
      return false;
    }
    this.stance = next;
    return true;
  }

  resetStance() {
    this.stance = 'stand';
    this.eyeHeight = Player.EYE_HEIGHT;
    this.suppressJump = false;
  }

  /** Body capsule used for incoming hits (segment + radius). */
  getHitbox(): { a: THREE.Vector3; b: THREE.Vector3; radius: number } {
    const p = this.position;
    if (this.stance === 'prone') {
      // Lying flat along the view direction
      const f = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).multiplyScalar(0.5);
      const c = new THREE.Vector3(p.x, p.y + 0.25, p.z);
      return { a: c.clone().sub(f), b: c.clone().add(f), radius: 0.3 };
    }
    if (this.stance === 'crouch') {
      return { a: new THREE.Vector3(p.x, p.y + 0.35, p.z), b: new THREE.Vector3(p.x, p.y + 0.95, p.z), radius: 0.45 };
    }
    return { a: new THREE.Vector3(p.x, p.y + 0.35, p.z), b: new THREE.Vector3(p.x, p.y + 1.45, p.z), radius: 0.5 };
  }

  /** Height above the feet that enemies aim at. */
  get aimHeight(): number {
    return this.stance === 'prone' ? 0.25 : this.stance === 'crouch' ? 0.65 : 1.0;
  }

  // Mouse Look (Euler angles)
  pitch: number = -0.35;
  yaw: number = 0;

  // Input states
  keys: { [key: string]: boolean } = {};
  isMouseDown: boolean = false;
  isRightMouseDown: boolean = false;

  // Block Ghost preview
  blockPreviewMesh: THREE.Mesh;

  constructor(camera: THREE.PerspectiveCamera, world: World) {
    this.camera = camera;
    this.world = world;
    this.camera.position.copy(this.position);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;

    this.weapons = new WeaponManager(this.camera);

    // Ghost mesh for placing blocks
    const previewGeo = new THREE.BoxGeometry(1.02, 1.02, 1.02);
    const previewMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      wireframe: true,
      transparent: true,
      opacity: 0.7
    });
    this.blockPreviewMesh = new THREE.Mesh(previewGeo, previewMat);
    this.blockPreviewMesh.visible = false;
    this.world.scene.add(this.blockPreviewMesh);

    this.initControls();
  }

  private initControls() {
    window.addEventListener('keydown', (e) => {
      if (this.uiOpen) return; // the crafting menu has the keyboard
      this.keys[e.code] = true;
      const k = e.key.toLowerCase();
      if (e.code === 'Space') e.preventDefault();

      // Stance: C = crouch toggle, Z = prone toggle (Korean IME: ㅊ / ㅋ)
      if (!e.repeat && !this.inPlane && !this.isAirborne && !this.vehicle) {
        if (e.code === 'KeyC' || k === 'c' || k === 'ㅊ') {
          this.setStance(this.stance === 'crouch' ? 'stand' : 'crouch');
        }
        if (e.code === 'KeyZ' || k === 'z' || k === 'ㅋ') {
          this.setStance(this.stance === 'prone' ? 'stand' : 'prone');
        }
        // Space while crouched / prone stands up instead of jumping
        if ((e.code === 'Space' || k === ' ') && this.stance !== 'stand') {
          this.setStance('stand');
          this.suppressJump = true;
        }
      }

      // Plane eject or parachute deploy (ignore auto-repeat so holding SPACE doesn't do both)
      if (!e.repeat && (e.code === 'Space' || k === ' ' || e.code === 'KeyF' || k === 'f' || k === 'ㄹ')) {
        if (this.inPlane) {
          this.ejectFromPlane();
          return;
        }
        if (this.isAirborne && !this.isParachuteOpen) {
          this.openParachute();
          return;
        }
      }

      // Support Korean IME keys (W -> ㅈ, S -> ㄴ, A -> ㅁ, D -> ㅇ)
      if (k === 'w' || k === 'ㅈ') this.keys['KeyW'] = true;
      if (k === 's' || k === 'ㄴ') this.keys['KeyS'] = true;
      if (k === 'a' || k === 'ㅁ') this.keys['KeyA'] = true;
      if (k === 'd' || k === 'ㅇ') this.keys['KeyD'] = true;

      // Slot hotkeys
      if (e.code === 'Digit1' || k === '1') this.weapons.selectWeapon('PICKAXE');
      if (e.code === 'Digit2' || k === '2') {
        if (this.weapons.slot2Weapon) {
          this.weapons.selectWeapon(this.weapons.slot2Weapon);
        } else {
          this.showToast(t('toast.slotEmpty2'));
        }
      }
      if (e.code === 'Digit3' || k === '3') {
        if (this.weapons.slot3Weapon) {
          this.weapons.selectWeapon(this.weapons.slot3Weapon);
        } else {
          this.showToast(t('toast.slotEmpty3'));
        }
      }
      if (e.code === 'Digit4' || k === '4') this.weapons.selectWeapon('MEDKIT');
      if (e.code === 'Digit5' || k === '5') this.weapons.selectWeapon('BLOCK');
      if (e.code === 'Digit6' || k === '6' || e.code === 'KeyG' || k === 'g' || k === 'ㅎ') {
        if (this.weapons.weapons.get('GRENADE')!.currentAmmo > 0) this.weapons.selectWeapon('GRENADE');
        else this.showToast(t('toast.noGrenade'));
      }

      // Reload
      if (e.code === 'KeyR' || k === 'r' || k === 'ㄱ') {
        if (this.weapons.startReload()) {
          sounds.playReload();
        }
      }

      // Interact (E or F) to loot crates & ground items
      if (!e.repeat && !this.inPlane && !this.isAirborne &&
          (e.code === 'KeyE' || e.code === 'KeyF' || k === 'e' || k === 'f' || k === 'ㄷ' || k === 'ㄹ')) {
        if (this.onInteract?.()) return;
        if (!this.vehicle) this.interactLoot();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
      const k = e.key.toLowerCase();
      if (k === 'w' || k === 'ㅈ') this.keys['KeyW'] = false;
      if (k === 's' || k === 'ㄴ') this.keys['KeyS'] = false;
      if (k === 'a' || k === 'ㅁ') this.keys['KeyA'] = false;
      if (k === 'd' || k === 'ㅇ') this.keys['KeyD'] = false;
      if (e.code === 'Space' || k === ' ') {
        this.keys['Space'] = false;
        this.suppressJump = false;
      }
    });

    // Releasing keys while the window is unfocused would otherwise leave them stuck "down"
    const clearInput = () => {
      this.keys = {};
      this.isMouseDown = false;
      this.isRightMouseDown = false;
    };
    window.addEventListener('blur', clearInput);
    document.addEventListener('pointerlockchange', () => {
      if (!document.pointerLockElement) clearInput();
    });

    // Mouse wheel for switching weapons
    window.addEventListener('wheel', (e) => {
      if (this.uiOpen) return;
      const w = this.weapons;
      const slots: (WeaponType | null)[] = ['PICKAXE', w.slot2Weapon, w.slot3Weapon, 'MEDKIT', 'BLOCK', 'GRENADE'];
      const available = slots.filter((s): s is WeaponType =>
        s !== null && (s !== 'GRENADE' || w.weapons.get('GRENADE')!.currentAmmo > 0));
      const curIdx = Math.max(0, available.indexOf(this.weapons.activeType));
      const step = e.deltaY > 0 ? 1 : -1;
      const nextIdx = (curIdx + step + available.length) % available.length;
      this.weapons.selectWeapon(available[nextIdx]);
    });
  }

  planeYaw: number = 0;

  ejectFromPlane() {
    if (!this.inPlane) return;
    this.inPlane = false;
    this.isAirborne = true;
    this.isParachuteOpen = false;
    this.weapons.viewmodelGroup.visible = true;
    sounds.playParachuteOpen();
  }

  openParachute() {
    this.isParachuteOpen = true;
    sounds.playParachuteOpen();
  }

  update(
    delta: number,
    zone: ZoneManager,
    onPlayerShoot: (origin: THREE.Vector3, dir: THREE.Vector3, damage: number, spread: number) => void,
    onThrowGrenade?: (origin: THREE.Vector3, dir: THREE.Vector3) => void
  ) {
    if (!this.isAlive) return;
    this.onThrowGrenade = onThrowGrenade;

    if (this.inPlane) {
      if (this.stance !== 'stand') this.resetStance();
      this.weapons.viewmodelGroup.visible = false;
      const fDir = new THREE.Vector3(Math.sin(this.planeYaw), 0, Math.cos(this.planeYaw));
      // Camera positioned 24m behind the cargo plane and 9.5m above
      this.camera.position.set(
        this.position.x - fDir.x * 24,
        this.position.y + 9.5,
        this.position.z - fDir.z * 24
      );
      this.camera.rotation.set(0, 0, 0);
      this.camera.rotation.order = 'YXZ';
      this.camera.rotation.y = this.yaw;
      this.camera.rotation.x = this.pitch - 0.22;
      return;
    } else {
      this.weapons.viewmodelGroup.visible = true;
    }

    // Check Blue zone damage
    if (!zone.isInsideBlueZone(this.position.x, this.position.z)) {
      this.takeDamage(zone.getCurrentDPS() * delta, false, SRC_ZONE);
    }

    if (this.vehicle) {
      this.updateDriving(delta);
      return;
    }

    if (this.isAirborne) {
      this.updateAirborneMovement(delta);
    } else {
      this.updateGroundMovement(delta);

      // Auto-loot nearby ground items (never silently swaps out a gun you already carry)
      for (const item of this.world.groundItems) {
        if (item.picked || !this.canAutoLoot(item.type)) continue;
        if (this.position.distanceTo(item.position) < 2.0) {
          this.pickGroundItem(item);
          break;
        }
      }

      // Auto-loot nearby death crates
      for (const dc of this.world.deathCrates) {
        if (dc.opened || !this.canAutoLoot(dc.weapons[0])) continue;
        if (this.position.distanceTo(dc.position) < 2.5) {
          this.lootDeathCrate(dc);
          break;
        }
      }
    }

    // Camera follow player position and sync continuous rotation
    const targetEye = this.isAirborne ? Player.EYE_HEIGHT : STANCES[this.stance].eye;
    this.eyeHeight += (targetEye - this.eyeHeight) * Math.min(1, 12 * delta);
    this.camera.position.set(this.position.x, this.position.y + this.eyeHeight, this.position.z);
    this.camera.rotation.set(0, 0, 0);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;

    // Aim Down Sights (Right click)
    const isAiming = this.isRightMouseDown && !this.uiOpen && isGun(this.weapons.activeType);
    this.weapons.isAiming = isAiming;

    // Adjust camera FOV for ADS according to the mounted scope
    const zoom = this.weapons.getZoom();
    const targetFov = isAiming ? fovForZoom(zoom) : 75;
    this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, 15 * delta);
    this.camera.updateProjectionMatrix();

    // Scope overlays: 4x/8x = full scope picture, 2x = red-dot reticle
    const scoped = isAiming && zoom >= 4;
    const scopeEl = document.getElementById('scope-overlay');
    if (scopeEl) scopeEl.style.display = scoped ? 'block' : 'none';
    const dotEl = document.getElementById('reddot-overlay');
    if (dotEl) dotEl.style.display = isAiming && zoom === 2 ? 'block' : 'none';
    const zoomEl = document.getElementById('zoom-label');
    if (zoomEl) {
      zoomEl.style.display = isAiming && zoom > 1 ? 'block' : 'none';
      zoomEl.textContent = `${zoom}x`;
    }
    this.weapons.viewmodelGroup.visible = !scoped;

    // Viewmodel weapon update
    const isMoving = this.keys['KeyW'] || this.keys['KeyS'] || this.keys['KeyA'] || this.keys['KeyD'];
    this.weapons.update(delta, isMoving, this.moveSpeed);

    // Block Preview Mesh update (if holding block)
    this.updateBlockPreview();

    // Weapon firing
    this.handleWeaponFiring(onPlayerShoot);
  }

  // Seated in a vehicle: third-person camera orbiting it with the mouse, no weapons
  private updateDriving(delta: number) {
    const v = this.vehicle!;
    this.position.copy(v.seatPosition());
    this.velocity.set(0, 0, 0);
    this.weapons.viewmodelGroup.visible = false;
    this.weapons.isAiming = false;
    for (const id of ['scope-overlay', 'reddot-overlay', 'zoom-label']) {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    }
    this.camera.fov += (75 - this.camera.fov) * Math.min(1, 15 * delta);
    this.camera.updateProjectionMatrix();

    const pitch = Math.max(-1.2, Math.min(0.35, this.pitch));
    const look = new THREE.Vector3(-Math.sin(this.yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(this.yaw) * Math.cos(pitch));
    const pivot = v.mesh.position.clone().add(new THREE.Vector3(0, 2.2, 0));
    const dist = v.type === 'JEEP' ? 8 : 6;
    const cam = pivot.addScaledVector(look, -dist);
    cam.y = Math.max(cam.y, this.world.getSurfaceHeight(cam.x, cam.z) + 0.6);
    this.camera.position.copy(cam);
    this.camera.rotation.set(0, 0, 0);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = pitch;
  }

  private updateAirborneMovement(delta: number) {
    // Parachute descent physics
    const groundBelow = Math.max(this.world.getSurfaceHeight(this.position.x, this.position.z), World.WATER_LEVEL);
    if (!this.isParachuteOpen && this.position.y - groundBelow <= 30) {
      this.openParachute(); // Auto-open near ground (relative to terrain, so mountains are safe)
    }

    const fallSpeed = this.isParachuteOpen ? 7.5 : 22.0;
    this.position.y -= fallSpeed * delta;

    // Horizontal gliding with WASD
    const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);

    const glideSpeed = this.isParachuteOpen ? 18.0 : 25.0;
    if (this.keys['KeyW']) this.position.addScaledVector(forward, glideSpeed * delta);
    if (this.keys['KeyS']) this.position.addScaledVector(forward, -glideSpeed * 0.5 * delta);
    if (this.keys['KeyA']) this.position.addScaledVector(right, -glideSpeed * 0.7 * delta);
    if (this.keys['KeyD']) this.position.addScaledVector(right, glideSpeed * 0.7 * delta);

    // Keep inside the map
    const limit = this.world.half - 2;
    this.position.x = Math.max(-limit, Math.min(limit, this.position.x));
    this.position.z = Math.max(-limit, Math.min(limit, this.position.z));

    // Check landing (roofs and treetops count as ground; water catches you too)
    const surfaceY = this.world.getSurfaceHeight(this.position.x, this.position.z);
    const landY = Math.max(surfaceY, World.WATER_LEVEL);
    if (this.position.y <= landY) {
      this.position.y = Math.max(surfaceY, Math.min(this.position.y, landY));
      this.isAirborne = false;
      this.isParachuteOpen = false;
      this.velocity.set(0, 0, 0);
      this.isOnGround = surfaceY >= World.WATER_LEVEL;
      this.world.unstick(this.position, Player.RADIUS, this.height);
    }
  }

  isInWater: boolean = false;

  private updateGroundMovement(delta: number) {
    const R = Player.RADIUS;

    // Swimming when the body is mostly under the water surface
    const isInWater = this.position.y < World.WATER_LEVEL - 0.4;
    this.isInWater = isInWater;
    if (isInWater && this.stance !== 'stand') this.stance = 'stand'; // can't crouch/lie down while swimming
    const floatY = World.WATER_LEVEL - 1.3; // feet height that keeps the eyes just above water

    const wantsMove = this.keys['KeyW'] || this.keys['KeyS'] || this.keys['KeyA'] || this.keys['KeyD'];
    let isSprinting = !!(this.keys['ShiftLeft'] || this.keys['ShiftRight']);
    // Sprinting gets you back on your feet (if there's room)
    if (isSprinting && wantsMove && this.stance !== 'stand') this.setStance('stand', true);
    if (this.stance !== 'stand') isSprinting = false;

    const H = this.height;
    this.world.unstick(this.position, R, H);

    const baseSpeed = (isInWater ? this.moveSpeed * 0.8 : this.moveSpeed) * STANCES[this.stance].speed;
    const currentSpeed = (isSprinting ? baseSpeed * this.sprintMultiplier : baseSpeed) * delta;

    const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);

    const moveVector = new THREE.Vector3();
    if (this.keys['KeyW']) moveVector.add(forward);
    if (this.keys['KeyS']) moveVector.sub(forward);
    if (this.keys['KeyD']) moveVector.add(right);
    if (this.keys['KeyA']) moveVector.sub(right);

    if (moveVector.lengthSq() > 0) {
      moveVector.normalize().multiplyScalar(currentSpeed);
      // Auto step-up 1 block on land (stairs), up to 2 blocks when climbing out of water
      const maxStep = isInWater ? 2.0 : (this.isOnGround ? 1.05 : 0);
      this.world.moveHorizontal(this.position, moveVector.x, moveVector.z, R, H, maxStep);
    }

    const limit = this.world.half - 2;
    this.position.x = Math.max(-limit, Math.min(limit, this.position.x));
    this.position.z = Math.max(-limit, Math.min(limit, this.position.z));

    if (isInWater) {
      this.velocity.y *= Math.pow(0.1, delta); // water drag
      if (this.keys['Space']) {
        this.velocity.y = 5.5; // swim up / leap onto a ledge
      } else if (isSprinting && !this.keys['KeyW']) {
        this.velocity.y = -3.0; // dive
      } else if (this.position.y < floatY) {
        this.velocity.y += Math.min((floatY - this.position.y) * 20, 12) * delta; // buoyancy
      } else {
        this.velocity.y -= 6 * delta;
      }
    } else {
      this.velocity.y -= 25.0 * delta;
      this.velocity.y = Math.max(this.velocity.y, -40);
    }

    this.isOnGround = this.world.moveVertical(this.position, this.velocity, delta, R, H);

    // Jump (only on dry ground)
    if (this.keys['Space'] && this.isOnGround && !isInWater && this.stance === 'stand' && !this.suppressJump) {
      this.velocity.y = 8.5;
      this.isOnGround = false;
    }
  }

  private canAutoLoot(type: string): boolean {
    if (type === 'MEDKIT' || type === 'ARMOR' || type === 'GRENADE') return true;
    if (type === 'AMMO') return this.weapons.getAmmoTarget() !== null;
    if (isScope(type)) return this.weapons.canAttachScope(SCOPE_LEVEL[type]);
    const gun = type as WeaponType;
    return this.weapons.hasGun(gun) || this.weapons.hasFreeGunSlot();
  }

  private updateBlockPreview() {
    if (this.weapons.activeType !== 'BLOCK') {
      this.blockPreviewMesh.visible = false;
      return;
    }

    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    const ray = this.world.raycastBlock(this.camera.position, dir, 5.0);

    if (ray && ray.hit) {
      this.blockPreviewMesh.visible = true;
      this.blockPreviewMesh.position.set(ray.placePos.x + 0.5, ray.placePos.y + 0.5, ray.placePos.z + 0.5);
    } else {
      this.blockPreviewMesh.visible = false;
    }
  }

  private handleWeaponFiring(onPlayerShoot: (origin: THREE.Vector3, dir: THREE.Vector3, damage: number, spread: number) => void) {
    if (!this.isMouseDown) return;

    const weapon = this.weapons.getActiveWeapon();

    // 1. Block placing (if holding block and right clicked or left clicked)
    if (weapon.type === 'BLOCK') {
      return; // Handled via mouseup or single action
    }

    // 2. Medkit consumption
    if (weapon.type === 'MEDKIT') {
      if (this.weapons.canFire() && this.health < 100) {
        this.weapons.consumeAmmo();
        this.health = Math.min(100, this.health + 75);
        sounds.playHeal();
      }
      return;
    }

    // 3. Grenade: thrown along the view direction
    if (weapon.type === 'GRENADE') {
      if (this.weapons.canFire() && this.onThrowGrenade) {
        this.weapons.consumeAmmo();
        this.weapons.applySwing();
        sounds.playSwing();
        const dir = new THREE.Vector3();
        this.camera.getWorldDirection(dir);
        this.onThrowGrenade(this.camera.position.clone(), dir);
        if (weapon.currentAmmo <= 0) this.weapons.selectWeapon(this.weapons.slot2Weapon || 'PICKAXE');
      }
      this.isMouseDown = false;
      return;
    }

    // 4. Firearms & Pickaxe
    const sm = STANCES[this.stance].spread; // crouching / lying down steadies your aim
    if (this.weapons.canFire()) {
      this.weapons.consumeAmmo();

      const dir = new THREE.Vector3();
      this.camera.getWorldDirection(dir);

      if (weapon.type === 'PICKAXE') {
        this.weapons.applySwing();
        sounds.playSwing();
        onPlayerShoot(this.camera.position, dir, weapon.damage, 0.01);
      } else {
        this.weapons.applyRecoil();
        sounds.playGun(weapon.type);
        const spread = (this.weapons.isAiming ? (weapon.adsSpread ?? weapon.spread) : weapon.spread) * sm;
        const pellets = weapon.pellets || 1;
        for (let i = 0; i < pellets; i++) {
          onPlayerShoot(this.camera.position, dir, weapon.damage, spread);
        }
      }

      if (!weapon.automatic) {
        this.isMouseDown = false; // Require click again for semi-auto
      }
    }
  }

  private onThrowGrenade?: (origin: THREE.Vector3, dir: THREE.Vector3) => void;

  /** Mined block -> resource. Returns the resource gained, if any. */
  gainFromBlock(blockType: number): ResourceType | null {
    let res: ResourceType | null = null;
    if (blockType === World.BLOCK_WOOD_PLANK || blockType === World.BLOCK_WOOD_LOG) res = 'wood';
    else if (blockType === World.BLOCK_STONE || blockType === World.BLOCK_GRAVEL) res = 'stone';
    else if (blockType === World.BLOCK_IRON_ORE) res = 'iron';
    else if (blockType === World.BLOCK_LEAVES) res = 'fiber';
    if (res) this.weapons.addResource(res, 1);
    return res;
  }

  canCraft(id: string): boolean {
    const r = RECIPES.find(x => x.id === id);
    if (!r) return false;
    const res = this.weapons.resources;
    for (const k in r.cost) {
      if (res[k as ResourceType] < (r.cost[k as ResourceType] ?? 0)) return false;
    }
    if (id === 'IRON_PICKAXE') return this.weapons.pickaxeTier < 2;
    if (id === 'AMMO') return this.weapons.getAmmoTarget() !== null;
    if (id === 'SCOPE2') return this.weapons.canAttachScope(2);
    if (id === 'ARMOR') return this.armor < this.maxArmor;
    return true;
  }

  /** Spend the materials and hand over the item. */
  craft(id: string): boolean {
    const r = RECIPES.find(x => x.id === id);
    if (!r) return false;
    if (!this.canCraft(id)) {
      this.showToast(t('toast.cantCraft', { item: t(`r.${id}`) }));
      return false;
    }
    for (const k in r.cost) this.weapons.resources[k as ResourceType] -= r.cost[k as ResourceType] ?? 0;
    const w = this.weapons;
    switch (id) {
      case 'BLOCKS': w.addConsumable('BLOCK', 10); break;
      case 'MEDKIT': w.addConsumable('MEDKIT', 1); break;
      case 'GRENADE': w.addConsumable('GRENADE', 2); break;
      case 'AMMO': w.addAmmo(w.getAmmoTarget()!, 30); break;
      case 'IRON_PICKAXE': w.upgradePickaxe(); break;
      case 'ARMOR': this.armor = Math.min(this.maxArmor, this.armor + 50); break;
      case 'SCOPE2': w.attachScope(2); break;
      default: w.equipWeapon(id as WeaponType, 20); break; // crafted guns
    }
    sounds.playCrateOpen();
    this.showToast(t('toast.crafted', { item: t(`r.${id}`) }));
    return true;
  }

  // Interacting with Loot: Death Crates, Ground Items, Supply Crates
  /** Distance to the closest thing E would loot, or Infinity when nothing is in reach. */
  nearestLootDist(): number {
    let d = Infinity;
    for (const dc of this.world.deathCrates) if (!dc.opened) { const x = this.position.distanceTo(dc.position); if (x < 3.2) d = Math.min(d, x); }
    for (const it of this.world.groundItems) if (!it.picked) { const x = this.position.distanceTo(it.position); if (x < 2.8) d = Math.min(d, x); }
    for (const c of this.world.crates) if (!c.opened) { const x = this.position.distanceTo(c.position); if (x < 3.5) d = Math.min(d, x); }
    return d;
  }

  interactLoot() {
    // Loot whatever is closest (death crate, ground item or supply crate)
    let best: (() => void) | null = null;
    let bestDist = Infinity;
    const consider = (dist: number, range: number, action: () => void) => {
      if (dist < range && dist < bestDist) {
        bestDist = dist;
        best = action;
      }
    };
    for (const dc of this.world.deathCrates) {
      if (!dc.opened) consider(this.position.distanceTo(dc.position), 3.2, () => this.lootDeathCrate(dc));
    }
    for (const item of this.world.groundItems) {
      if (!item.picked) consider(this.position.distanceTo(item.position), 2.8, () => this.pickGroundItem(item));
    }
    for (const crate of this.world.crates) {
      if (!crate.opened) consider(this.position.distanceTo(crate.position), 3.5, () => this.lootSupplyCrate(crate));
    }
    if (best) (best as () => void)();
  }

  pickGroundItem(item: any) {
    item.picked = true;
    item.mesh.visible = false;
    sounds.playCrateOpen();

    let text = '';
    if (item.type === 'MEDKIT') {
      this.weapons.addConsumable('MEDKIT', 1);
      text = t('toast.medkit');
    } else if (item.type === 'ARMOR') {
      this.armor = Math.min(100, this.armor + 75);
      text = t('toast.armor');
    } else if (isScope(item.type)) {
      const gun = this.weapons.attachScope(SCOPE_LEVEL[item.type as keyof typeof SCOPE_LEVEL]);
      if (!gun) {
        item.picked = false;
        item.mesh.visible = true;
        this.showToast(this.scopeRefusal());
        return;
      }
      text = t('toast.scopeOn', { item: itemName(item.type), gun: gun.name, n: gun.scope ?? 1 });
    } else if (item.type === 'GRENADE') {
      const n = Math.max(1, Math.min(3, item.ammoCount));
      this.weapons.addConsumable('GRENADE', n);
      text = t('toast.grenade', { n });
    } else if (item.type === 'AMMO') {
      const target = this.weapons.getAmmoTarget();
      if (!target) {
        item.picked = false;
        item.mesh.visible = true;
        this.showToast(t('toast.needGunForAmmo'));
        return;
      }
      this.weapons.addAmmo(target, item.ammoCount);
      text = t('toast.ammo', { n: item.ammoCount });
    } else {
      const name = this.weapons.equipWeapon(item.type, item.ammoCount);
      text = t('toast.gun', { gun: name });
    }

    this.showToast(text);
  }

  lootDeathCrate(dc: any) {
    dc.opened = true;
    dc.mesh.visible = false;
    sounds.playCrateOpen();

    if (dc.weapons && dc.weapons[0] && isGun(dc.weapons[0])) {
      this.weapons.equipWeapon(dc.weapons[0], dc.ammoCount);
    } else {
      const target = this.weapons.getAmmoTarget();
      if (target) this.weapons.addAmmo(target, dc.ammoCount);
    }
    if (dc.medkitCount > 0) {
      this.weapons.addConsumable('MEDKIT', dc.medkitCount);
    }
    if (dc.hasArmor) {
      this.armor = Math.min(100, this.armor + 50);
    }

    this.showToast(t('toast.deathCrate', { name: dc.victimName, n: dc.ammoCount }));
  }

  private scopeRefusal(): string {
    if (!this.weapons.slot2Weapon && !this.weapons.slot3Weapon) {
      return t('toast.scopeNoGun');
    }
    return t('toast.scopeNoFit');
  }

  lootSupplyCrate(crate: any) {
    if (isScope(crate.lootType) && !this.weapons.canAttachScope(SCOPE_LEVEL[crate.lootType as keyof typeof SCOPE_LEVEL])) {
      this.showToast(this.scopeRefusal());
      return; // leave the crate closed until there's a gun for it
    }
    crate.opened = true;
    crate.mesh.scale.set(0.01, 0.01, 0.01);
    sounds.playCrateOpen();

    let text = '';
    if (crate.lootType === 'MEDKIT') {
      this.weapons.addConsumable('MEDKIT', 2);
      text = t('toast.crateMedkit');
    } else if (crate.lootType === 'ARMOR') {
      this.armor = 100;
      text = t('toast.crateArmor');
    } else if (isScope(crate.lootType)) {
      const level = SCOPE_LEVEL[crate.lootType as keyof typeof SCOPE_LEVEL];
      const gun = this.weapons.attachScope(level)!;
      text = t('toast.crateScope', { n: level, gun: gun.name });
    } else if (crate.lootType === 'GRENADE') {
      this.weapons.addConsumable('GRENADE', 3);
      text = t('toast.crateGrenade', { n: 3 });
    } else if (isGun(crate.lootType)) {
      const name = this.weapons.equipWeapon(crate.lootType, 60);
      text = t('toast.crateGun', { gun: name });
    }

    this.showToast(text);
  }

  private toastTimer: number | undefined;

  showToast(text: string) {
    const toast = document.getElementById('action-toast');
    if (toast) {
      toast.textContent = text;
      toast.style.opacity = '1';
      // Restart the timer so an older toast doesn't hide the newest message early
      window.clearTimeout(this.toastTimer);
      this.toastTimer = window.setTimeout(() => { toast.style.opacity = '0'; }, 2500);
    }
  }

  takeDamage(amount: number, playHitSfx: boolean = true, source: string = '?') {
    if (!this.isAlive) return;
    this.lastDamageSource = source;

    if (this.armor > 0) {
      const absorbed = Math.min(this.armor, amount * 0.6);
      this.armor -= absorbed;
      amount -= absorbed;
    }

    this.health -= amount;

    // Damage vignette red flash
    const overlay = document.getElementById('damage-overlay');
    if (overlay) {
      overlay.style.boxShadow = 'inset 0 0 120px rgba(220, 38, 38, 0.7)';
      setTimeout(() => {
        if (overlay) overlay.style.boxShadow = 'inset 0 0 100px rgba(220, 38, 38, 0)';
      }, 180);
    }

    if (playHitSfx) {
      sounds.playHurt();
    }

    if (this.health <= 0) {
      this.health = 0;
      this.isAlive = false;
    }
  }
}
