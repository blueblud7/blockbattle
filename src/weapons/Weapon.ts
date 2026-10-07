import * as THREE from 'three';

export type WeaponType = 'PICKAXE' | 'PISTOL' | 'SHOTGUN' | 'RIFLE' | 'SNIPER' | 'MEDKIT' | 'BLOCK';

export interface WeaponData {
  type: WeaponType;
  name: string;
  slotIndex: number;
  damage: number;
  maxAmmo: number;
  currentAmmo: number;
  reserveAmmo: number;
  fireRate: number; // in seconds
  automatic: boolean;
  spread: number;
  range: number;
  pellets?: number;
  reloadTime: number;
  icon: string;
}

export class WeaponManager {
  weapons: Map<WeaponType, WeaponData> = new Map();
  activeType: WeaponType = 'PICKAXE';
  lastFireTime: number = 0;
  isReloading: boolean = false;
  reloadStartTime: number = 0;
  isAiming: boolean = false;

  // Inventory slots
  slot2Weapon: WeaponType | null = null;
  slot3Weapon: WeaponType | null = null;
  unlockedWeapons: Set<WeaponType> = new Set(['PICKAXE', 'BLOCK']);

  // Viewmodel 3D mesh
  viewmodelGroup: THREE.Group;
  weaponMeshes: Map<WeaponType, THREE.Group> = new Map();
  muzzleFlash: THREE.PointLight;

  constructor(camera: THREE.Camera) {
    this.viewmodelGroup = new THREE.Group();
    this.viewmodelGroup.position.set(0.28, -0.28, -0.45);
    camera.add(this.viewmodelGroup);

    this.muzzleFlash = new THREE.PointLight(0xffaa22, 0, 5);
    this.muzzleFlash.position.set(0, 0.1, -0.5);
    this.viewmodelGroup.add(this.muzzleFlash);

    this.initDefaultWeapons();
    this.buildViewmodels();
    this.selectWeapon('PICKAXE');
  }

  private initDefaultWeapons() {
    this.weapons.set('PICKAXE', {
      type: 'PICKAXE',
      name: '곡괭이 (채굴/근접)',
      slotIndex: 1,
      damage: 30,
      maxAmmo: 0,
      currentAmmo: 0,
      reserveAmmo: 0,
      fireRate: 0.35,
      automatic: false,
      spread: 0.01,
      range: 4,
      reloadTime: 0,
      icon: '⛏️'
    });

    this.weapons.set('PISTOL', {
      type: 'PISTOL',
      name: 'P92 권총',
      slotIndex: 2,
      damage: 34,
      maxAmmo: 15,
      currentAmmo: 0,
      reserveAmmo: 0,
      fireRate: 0.22,
      automatic: false,
      spread: 0.02,
      range: 50,
      reloadTime: 1.5,
      icon: '🔫'
    });

    this.weapons.set('SHOTGUN', {
      type: 'SHOTGUN',
      name: 'S1897 샷건',
      slotIndex: 3,
      damage: 18,
      maxAmmo: 5,
      currentAmmo: 0,
      reserveAmmo: 0,
      fireRate: 0.8,
      automatic: false,
      spread: 0.09,
      range: 30,
      pellets: 7,
      reloadTime: 2.2,
      icon: '💥'
    });

    this.weapons.set('RIFLE', {
      type: 'RIFLE',
      name: '돌격소총',
      slotIndex: 2,
      damage: 36,
      maxAmmo: 30,
      currentAmmo: 0,
      reserveAmmo: 0,
      fireRate: 0.11,
      automatic: true,
      spread: 0.035,
      range: 80,
      reloadTime: 2.0,
      icon: '⚡'
    });

    this.weapons.set('SNIPER', {
      type: 'SNIPER',
      name: '저격소총',
      slotIndex: 3,
      damage: 120,
      maxAmmo: 5,
      currentAmmo: 0,
      reserveAmmo: 0,
      fireRate: 1.3,
      automatic: false,
      spread: 0.005,
      range: 150,
      reloadTime: 2.5,
      icon: '🎯'
    });

    this.weapons.set('MEDKIT', {
      type: 'MEDKIT',
      name: '구급키트',
      slotIndex: 4,
      damage: 0,
      maxAmmo: 0,
      currentAmmo: 0,
      reserveAmmo: 0,
      fireRate: 1.0,
      automatic: false,
      spread: 0,
      range: 0,
      reloadTime: 0,
      icon: '🩹'
    });

    this.weapons.set('BLOCK', {
      type: 'BLOCK',
      name: '건축 블록',
      slotIndex: 5,
      damage: 0,
      maxAmmo: 0,
      currentAmmo: 15,
      reserveAmmo: 15,
      fireRate: 0.2,
      automatic: false,
      spread: 0,
      range: 6,
      reloadTime: 0,
      icon: '🧱'
    });
  }

  equipWeapon(type: WeaponType, ammoBonus: number = 30): string {
    const w = this.weapons.get(type);
    if (!w) return '';

    // Already carrying this gun: just top up ammo instead of shuffling slots
    if (this.slot2Weapon === type || this.slot3Weapon === type) {
      w.reserveAmmo += ammoBonus;
      if (w.currentAmmo === 0 && !this.isReloading) {
        const toLoad = Math.min(w.maxAmmo, w.reserveAmmo);
        w.currentAmmo = toLoad;
        w.reserveAmmo -= toLoad;
      }
      this.selectWeapon(type);
      return w.name;
    }

    this.unlockedWeapons.add(type);
    w.currentAmmo = w.maxAmmo;
    w.reserveAmmo = Math.max(w.reserveAmmo, ammoBonus);

    if (!this.slot2Weapon) {
      this.slot2Weapon = type;
      w.slotIndex = 2;
    } else if (!this.slot3Weapon && this.slot2Weapon !== type) {
      this.slot3Weapon = type;
      w.slotIndex = 3;
    } else {
      if (this.activeType === this.slot3Weapon) {
        if (this.slot3Weapon) this.unlockedWeapons.delete(this.slot3Weapon);
        this.slot3Weapon = type;
        w.slotIndex = 3;
      } else {
        if (this.slot2Weapon) this.unlockedWeapons.delete(this.slot2Weapon);
        this.slot2Weapon = type;
        w.slotIndex = 2;
      }
    }

    this.selectWeapon(type);
    return w.name;
  }

  // Procedural 3D Voxel Models for Viewmodels
  private buildViewmodels() {
    // 1. Pickaxe
    const pickGroup = new THREE.Group();
    const handleMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.8 });
    const ironMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.6, roughness: 0.3 });

    // Handle
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.45, 0.04), handleMat);
    handle.rotation.z = -0.3;
    pickGroup.add(handle);

    // Pick head
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.06, 0.05), ironMat);
    head.position.set(-0.06, 0.2, 0);
    head.rotation.z = 0.2;
    pickGroup.add(head);

    this.weaponMeshes.set('PICKAXE', pickGroup);
    this.viewmodelGroup.add(pickGroup);

    // 2. Pistol
    const pistolGroup = new THREE.Group();
    const darkGunMat = new THREE.MeshStandardMaterial({ color: 0x222225, metalness: 0.7, roughness: 0.3 });
    const gripMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });

    // Grip
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.06), gripMat);
    grip.position.set(0, -0.05, 0);
    grip.rotation.x = 0.2;
    pistolGroup.add(grip);

    // Barrel
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.055, 0.22), darkGunMat);
    barrel.position.set(0, 0.02, -0.07);
    pistolGroup.add(barrel);

    this.weaponMeshes.set('PISTOL', pistolGroup);
    this.viewmodelGroup.add(pistolGroup);

    // 3. Shotgun
    const shotgunGroup = new THREE.Group();
    const woodStockMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.7 });

    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.09, 0.22), woodStockMat);
    stock.position.set(0, -0.04, 0.1);
    shotgunGroup.add(stock);

    const shotBarrel = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.05, 0.45), darkGunMat);
    shotBarrel.position.set(0, 0.02, -0.16);
    shotgunGroup.add(shotBarrel);

    const pump = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.06, 0.12), woodStockMat);
    pump.position.set(0, -0.01, -0.15);
    shotgunGroup.add(pump);

    this.weaponMeshes.set('SHOTGUN', shotgunGroup);
    this.viewmodelGroup.add(shotgunGroup);

    // 4. Rifle (M416)
    const rifleGroup = new THREE.Group();
    const armyGreenMat = new THREE.MeshStandardMaterial({ color: 0x2e3a23, roughness: 0.5, metalness: 0.5 });

    const rBody = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.35), armyGreenMat);
    rBody.position.set(0, 0, -0.05);
    rifleGroup.add(rBody);

    const rBarrel = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.3), darkGunMat);
    rBarrel.position.set(0, 0.02, -0.32);
    rifleGroup.add(rBarrel);

    const rMag = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.06), darkGunMat);
    rMag.position.set(0, -0.08, -0.08);
    rMag.rotation.x = -0.2;
    rifleGroup.add(rMag);

    this.weaponMeshes.set('RIFLE', rifleGroup);
    this.viewmodelGroup.add(rifleGroup);

    // 5. Sniper (AWM)
    const sniperGroup = new THREE.Group();
    const awmGreenMat = new THREE.MeshStandardMaterial({ color: 0x3d4a2d, roughness: 0.6 });

    const sBody = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.08, 0.45), awmGreenMat);
    sBody.position.set(0, -0.02, 0);
    sniperGroup.add(sBody);

    const sBarrel = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.45), darkGunMat);
    sBarrel.position.set(0, 0.01, -0.4);
    sniperGroup.add(sBarrel);

    // Scope cylinder
    const sScope = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.22, 8), darkGunMat);
    sScope.rotation.x = Math.PI / 2;
    sScope.position.set(0, 0.07, -0.05);
    sniperGroup.add(sScope);

    this.weaponMeshes.set('SNIPER', sniperGroup);
    this.viewmodelGroup.add(sniperGroup);

    // 6. Medkit
    const medGroup = new THREE.Group();
    const medMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.5 });
    const crossMat = new THREE.MeshStandardMaterial({ color: 0xffffff });

    const medBox = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 0.08), medMat);
    medGroup.add(medBox);

    const cH = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 0.082), crossMat);
    medGroup.add(cH);
    const cV = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.1, 0.082), crossMat);
    medGroup.add(cV);

    this.weaponMeshes.set('MEDKIT', medGroup);
    this.viewmodelGroup.add(medGroup);

    // 7. Block (Minecraft Dirt/Wood cube)
    const blockGroup = new THREE.Group();
    const blockMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.9 });
    const blockMesh = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), blockMat);
    blockGroup.add(blockMesh);

    this.weaponMeshes.set('BLOCK', blockGroup);
    this.viewmodelGroup.add(blockGroup);
  }

  selectWeapon(type: WeaponType) {
    if (!this.weapons.has(type)) return;
    if (!this.unlockedWeapons.has(type) && type !== 'PICKAXE' && type !== 'BLOCK' && type !== 'MEDKIT') {
      return; // Gun not looted yet!
    }
    this.activeType = type;
    this.isReloading = false;

    // Show only active mesh
    this.weaponMeshes.forEach((mesh, t) => {
      mesh.visible = (t === type);
    });
  }

  resetInventory() {
    this.slot2Weapon = null;
    this.slot3Weapon = null;
    this.unlockedWeapons = new Set(['PICKAXE', 'BLOCK']);
    this.initDefaultWeapons();
    this.selectWeapon('PICKAXE');
  }

  getActiveWeapon(): WeaponData {
    return this.weapons.get(this.activeType)!;
  }

  // Update viewmodel animation (sway, recoil, aiming)
  update(delta: number, isMoving: boolean, moveSpeed: number) {
    const time = performance.now() * 0.003;

    // Target position based on ADS
    let targetX = 0.28;
    let targetY = -0.28;
    let targetZ = -0.45;

    if (this.isAiming) {
      if (this.activeType === 'SNIPER') {
        // Hide model when using sniper scope overlay
        targetY = -2;
      } else {
        // Center ADS
        targetX = 0.0;
        targetY = -0.2;
        targetZ = -0.35;
      }
    }

    // Walking sway / bobbing
    if (isMoving && !this.isAiming) {
      targetX += Math.sin(time * 6) * 0.015;
      targetY += Math.abs(Math.cos(time * 6)) * 0.02;
    }

    // Smooth lerp to target
    this.viewmodelGroup.position.x += (targetX - this.viewmodelGroup.position.x) * 12 * delta;
    this.viewmodelGroup.position.y += (targetY - this.viewmodelGroup.position.y) * 12 * delta;
    this.viewmodelGroup.position.z += (targetZ - this.viewmodelGroup.position.z) * 12 * delta;

    // Dim muzzle flash
    if (this.muzzleFlash.intensity > 0) {
      this.muzzleFlash.intensity = Math.max(0, this.muzzleFlash.intensity - delta * 30);
    }

    // Check reload completion
    if (this.isReloading) {
      const weapon = this.getActiveWeapon();
      if (performance.now() - this.reloadStartTime >= weapon.reloadTime * 1000) {
        this.finishReload();
      }
    }
  }

  // Trigger recoil kickback
  applyRecoil() {
    this.viewmodelGroup.position.z += 0.08;
    this.viewmodelGroup.position.y += 0.03;
    this.viewmodelGroup.rotation.x += 0.1;
    this.muzzleFlash.intensity = 2.5;

    // Recover rotation
    setTimeout(() => {
      this.viewmodelGroup.rotation.x = 0;
    }, 60);
  }

  // Pickaxe / Melee swing animation
  applySwing() {
    this.viewmodelGroup.rotation.x -= 0.6;
    this.viewmodelGroup.rotation.y += 0.3;
    this.viewmodelGroup.position.z -= 0.12;

    setTimeout(() => {
      this.viewmodelGroup.rotation.x = 0;
      this.viewmodelGroup.rotation.y = 0;
    }, 120);
  }

  canFire(): boolean {
    if (this.isReloading) return false;
    const now = performance.now() / 1000;
    const weapon = this.getActiveWeapon();
    if (now - this.lastFireTime < weapon.fireRate) return false;

    if (weapon.maxAmmo > 0 && weapon.currentAmmo <= 0) {
      return false;
    }
    // Medkits and blocks are counted items: none left means nothing to use
    if ((weapon.type === 'MEDKIT' || weapon.type === 'BLOCK') && weapon.currentAmmo <= 0) {
      return false;
    }
    return true;
  }

  consumeAmmo() {
    this.lastFireTime = performance.now() / 1000;
    const weapon = this.getActiveWeapon();
    if (weapon.maxAmmo > 0) {
      weapon.currentAmmo--;
    } else if (weapon.type === 'BLOCK' || weapon.type === 'MEDKIT') {
      weapon.currentAmmo = Math.max(0, weapon.currentAmmo - 1);
    }
  }

  startReload(): boolean {
    const weapon = this.getActiveWeapon();
    if (weapon.maxAmmo === 0 || this.isReloading) return false;
    if (weapon.currentAmmo >= weapon.maxAmmo) return false;
    if (weapon.reserveAmmo <= 0) return false;

    this.isReloading = true;
    this.reloadStartTime = performance.now();
    return true;
  }

  private finishReload() {
    const weapon = this.getActiveWeapon();
    const needed = weapon.maxAmmo - weapon.currentAmmo;
    const toLoad = Math.min(needed, weapon.reserveAmmo);
    weapon.currentAmmo += toLoad;
    weapon.reserveAmmo -= toLoad;
    this.isReloading = false;
  }

  addAmmo(type: WeaponType, count: number) {
    const weapon = this.weapons.get(type);
    if (weapon) {
      weapon.reserveAmmo += count;
    }
  }

  hasFreeGunSlot(): boolean {
    return !this.slot2Weapon || !this.slot3Weapon;
  }

  hasGun(type: WeaponType): boolean {
    return this.slot2Weapon === type || this.slot3Weapon === type;
  }

  // Gun that should receive loose ammo: the one in hand, otherwise the primary slot
  getAmmoTarget(): WeaponType | null {
    if (this.hasGun(this.activeType)) return this.activeType;
    return this.slot2Weapon || this.slot3Weapon;
  }

  addConsumable(type: WeaponType, count: number) {
    const weapon = this.weapons.get(type);
    if (weapon) {
      weapon.currentAmmo += count;
    }
  }
}
