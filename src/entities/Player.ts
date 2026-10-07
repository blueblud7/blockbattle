import * as THREE from 'three';
import { World } from '../world/World';
import { WeaponManager, WeaponType } from '../weapons/Weapon';
import { sounds } from '../audio/SoundManager';
import { ZoneManager } from '../zone/ZoneManager';

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
  lastDamageSource: string = '자기장';

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
      this.keys[e.code] = true;
      const k = e.key.toLowerCase();
      if (e.code === 'Space') e.preventDefault();

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
          this.showToast('🔫 [주무기 1] 슬롯이 비어있습니다. 건물의 빛기둥이나 상자에서 총기를 파밍하세요!');
        }
      }
      if (e.code === 'Digit3' || k === '3') {
        if (this.weapons.slot3Weapon) {
          this.weapons.selectWeapon(this.weapons.slot3Weapon);
        } else {
          this.showToast('🎯 [주무기 2] 슬롯이 비어있습니다. 건물의 빛기둥이나 상자에서 총기를 파밍하세요!');
        }
      }
      if (e.code === 'Digit4' || k === '4') this.weapons.selectWeapon('MEDKIT');
      if (e.code === 'Digit5' || k === '5') this.weapons.selectWeapon('BLOCK');

      // Reload
      if (e.code === 'KeyR' || k === 'r' || k === 'ㄱ') {
        if (this.weapons.startReload()) {
          sounds.playReload();
        }
      }

      // Interact (E or F) to loot crates & ground items
      if (!e.repeat && !this.inPlane && !this.isAirborne &&
          (e.code === 'KeyE' || e.code === 'KeyF' || k === 'e' || k === 'f' || k === 'ㄷ' || k === 'ㄹ')) {
        this.interactLoot();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
      const k = e.key.toLowerCase();
      if (k === 'w' || k === 'ㅈ') this.keys['KeyW'] = false;
      if (k === 's' || k === 'ㄴ') this.keys['KeyS'] = false;
      if (k === 'a' || k === 'ㅁ') this.keys['KeyA'] = false;
      if (k === 'd' || k === 'ㅇ') this.keys['KeyD'] = false;
      if (e.code === 'Space' || k === ' ') this.keys['Space'] = false;
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
      const slots: WeaponType[] = ['PICKAXE', 'PISTOL', 'RIFLE', 'SHOTGUN', 'SNIPER', 'MEDKIT', 'BLOCK'];
      const available = slots.filter(t =>
        t === 'PICKAXE' || t === 'MEDKIT' || t === 'BLOCK' || this.weapons.hasGun(t));
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
    onPlayerShoot: (origin: THREE.Vector3, dir: THREE.Vector3, damage: number, spread: number) => void
  ) {
    if (!this.isAlive) return;

    if (this.inPlane) {
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
      this.takeDamage(zone.getCurrentDPS() * delta, false, '자기장');
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
    this.camera.position.set(this.position.x, this.position.y + Player.EYE_HEIGHT, this.position.z);
    this.camera.rotation.set(0, 0, 0);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;

    // Aim Down Sights (Right click)
    const isAiming = this.isRightMouseDown && this.weapons.activeType !== 'BLOCK';
    this.weapons.isAiming = isAiming;

    // Adjust camera FOV for ADS
    const targetFov = isAiming
      ? (this.weapons.activeType === 'SNIPER' ? 20 : 50)
      : 75;
    this.camera.fov += (targetFov - this.camera.fov) * 15 * delta;
    this.camera.updateProjectionMatrix();

    // Toggle scope overlay
    const scopeEl = document.getElementById('scope-overlay');
    if (scopeEl) {
      scopeEl.style.display = (isAiming && this.weapons.activeType === 'SNIPER') ? 'block' : 'none';
    }

    // Viewmodel weapon update
    const isMoving = this.keys['KeyW'] || this.keys['KeyS'] || this.keys['KeyA'] || this.keys['KeyD'];
    this.weapons.update(delta, isMoving, this.moveSpeed);

    // Block Preview Mesh update (if holding block)
    this.updateBlockPreview();

    // Weapon firing
    this.handleWeaponFiring(onPlayerShoot);
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
      this.world.unstick(this.position, Player.RADIUS, Player.HEIGHT);
    }
  }

  isInWater: boolean = false;

  private updateGroundMovement(delta: number) {
    const R = Player.RADIUS;
    const H = Player.HEIGHT;
    this.world.unstick(this.position, R, H);

    // Swimming when the body is mostly under the water surface
    const isInWater = this.position.y < World.WATER_LEVEL - 0.4;
    this.isInWater = isInWater;
    const floatY = World.WATER_LEVEL - 1.3; // feet height that keeps the eyes just above water

    const isSprinting = this.keys['ShiftLeft'] || this.keys['ShiftRight'];
    const baseSpeed = isInWater ? this.moveSpeed * 0.8 : this.moveSpeed;
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
    if (this.keys['Space'] && this.isOnGround && !isInWater) {
      this.velocity.y = 8.5;
      this.isOnGround = false;
    }
  }

  private canAutoLoot(type: string): boolean {
    if (type === 'MEDKIT' || type === 'ARMOR') return true;
    if (type === 'AMMO') return this.weapons.getAmmoTarget() !== null;
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

    // 3. Firearms & Pickaxe
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
        if (weapon.type === 'PISTOL') {
          sounds.playPistol();
          onPlayerShoot(this.camera.position, dir, weapon.damage, this.weapons.isAiming ? 0.005 : weapon.spread);
      } else if (weapon.type === 'SHOTGUN') {
        sounds.playShotgun();
        const pellets = weapon.pellets || 6;
        for (let i = 0; i < pellets; i++) {
          onPlayerShoot(this.camera.position, dir, weapon.damage, weapon.spread);
        }
      } else if (weapon.type === 'RIFLE') {
        sounds.playRifle();
        onPlayerShoot(this.camera.position, dir, weapon.damage, this.weapons.isAiming ? 0.01 : weapon.spread);
      } else if (weapon.type === 'SNIPER') {
        sounds.playSniper();
        onPlayerShoot(this.camera.position, dir, weapon.damage, this.weapons.isAiming ? 0.001 : 0.08);
      }
    }

      if (!weapon.automatic) {
        this.isMouseDown = false; // Require click again for semi-auto
      }
    }
  }

  // Interacting with Loot: Death Crates, Ground Items, Supply Crates
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
      text = '🩹 구급키트 획득!';
    } else if (item.type === 'ARMOR') {
      this.armor = Math.min(100, this.armor + 75);
      text = '🛡️ 방탄 조끼 장착! (방어구 +75)';
    } else if (item.type === 'AMMO') {
      const target = this.weapons.getAmmoTarget();
      if (!target) {
        item.picked = false;
        item.mesh.visible = true;
        this.showToast('📦 탄약을 쓰려면 먼저 총기를 파밍하세요!');
        return;
      }
      this.weapons.addAmmo(target, item.ammoCount);
      text = `📦 탄약 ${item.ammoCount}발 획득!`;
    } else {
      const name = this.weapons.equipWeapon(item.type, item.ammoCount);
      text = `🔫 [${name}] 획득 및 장착 완료! 좌클릭: 사격 / 우클릭: 조준 / [R]: 재장전`;
    }

    this.showToast(text);
  }

  lootDeathCrate(dc: any) {
    dc.opened = true;
    dc.mesh.visible = false;
    sounds.playCrateOpen();

    if (dc.weapons && dc.weapons[0]) {
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

    this.showToast(`⚰️ [${dc.victimName}] 전리품 상자 파밍 완료! (+${dc.ammoCount}발)`);
  }

  lootSupplyCrate(crate: any) {
    crate.opened = true;
    crate.mesh.scale.set(0.01, 0.01, 0.01);
    sounds.playCrateOpen();

    let text = '';
    if (crate.lootType === 'MEDKIT') {
      this.weapons.addConsumable('MEDKIT', 2);
      text = '🩹 보급 구급상자 획득!';
    } else if (crate.lootType === 'ARMOR') {
      this.armor = 100;
      text = '🛡️ 레벨 3 최고급 방탄 조끼 획득!';
    } else {
      const name = this.weapons.equipWeapon(crate.lootType, 60);
      text = `📦 보급 무기: ${name} 획득! (+60발)`;
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

  takeDamage(amount: number, playHitSfx: boolean = true, source: string = '알 수 없음') {
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
