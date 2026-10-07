import * as THREE from 'three';
import { t } from '../i18n';
import type { GunType } from '../world/World';

export type WeaponType = 'PICKAXE' | GunType | 'MEDKIT' | 'BLOCK' | 'GRENADE';
export type ResourceType = 'wood' | 'stone' | 'iron' | 'fiber';

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
  adsSpread?: number; // spread while aiming
  range: number;
  pellets?: number;
  reloadTime: number;
  icon: string;
  scope?: number;    // current sight magnification (1 = iron sights)
  maxScope?: number; // highest scope this gun accepts
}

// Default sight and the best scope each gun can mount
const SCOPE_RULES: { [key: string]: { base: number; max: number } } = {
  PISTOL: { base: 1, max: 2 },
  SHOTGUN: { base: 1, max: 2 },
  SMG: { base: 1, max: 2 },
  RIFLE: { base: 1, max: 4 },
  LMG: { base: 1, max: 4 },
  CROSSBOW: { base: 1, max: 4 },
  DMR: { base: 1, max: 8 },
  SNIPER: { base: 2, max: 8 }
};

// Gun stats (name comes from i18n). damage per bullet/pellet; fireRate = seconds between shots
const GUN_STATS: { [key in GunType]: Omit<WeaponData, 'type' | 'name' | 'slotIndex' | 'currentAmmo' | 'reserveAmmo'> } = {
  PISTOL: { damage: 34, maxAmmo: 15, fireRate: 0.22, automatic: false, spread: 0.02, adsSpread: 0.005, range: 50, reloadTime: 1.5, icon: '🔫' },
  SHOTGUN: { damage: 18, maxAmmo: 5, fireRate: 0.8, automatic: false, spread: 0.09, adsSpread: 0.075, range: 30, pellets: 7, reloadTime: 2.2, icon: '💥' },
  SMG: { damage: 22, maxAmmo: 30, fireRate: 0.075, automatic: true, spread: 0.045, adsSpread: 0.02, range: 45, reloadTime: 1.7, icon: '🌀' },
  RIFLE: { damage: 36, maxAmmo: 30, fireRate: 0.11, automatic: true, spread: 0.035, adsSpread: 0.01, range: 80, reloadTime: 2.0, icon: '⚡' },
  LMG: { damage: 30, maxAmmo: 75, fireRate: 0.09, automatic: true, spread: 0.06, adsSpread: 0.022, range: 85, reloadTime: 4.2, icon: '🔥' },
  DMR: { damage: 62, maxAmmo: 10, fireRate: 0.38, automatic: false, spread: 0.04, adsSpread: 0.004, range: 120, reloadTime: 2.3, icon: '🎯' },
  SNIPER: { damage: 120, maxAmmo: 5, fireRate: 1.3, automatic: false, spread: 0.08, adsSpread: 0.001, range: 150, reloadTime: 2.5, icon: '🔭' },
  CROSSBOW: { damage: 95, maxAmmo: 1, fireRate: 0.4, automatic: false, spread: 0.03, adsSpread: 0.003, range: 90, reloadTime: 1.8, icon: '🏹' }
};

export const RESOURCE_ICONS: { [key in ResourceType]: string } = { wood: '🪵', stone: '🪨', iron: '⛓️', fiber: '🌿' };

/** Scope magnification -> camera FOV (iron sights still zoom in a little). */
export function fovForZoom(zoom: number, baseFov: number = 75): number {
  const effective = zoom <= 1 ? 1.25 : zoom;
  const half = (baseFov * Math.PI) / 360;
  return (Math.atan(Math.tan(half) / effective) * 360) / Math.PI;
}

export class WeaponManager {
  weapons: Map<WeaponType, WeaponData> = new Map();
  activeType: WeaponType = 'PICKAXE';
  lastFireTime: number = 0;
  private lastFireByType: { [key: string]: number } = {}; // cooldowns don't carry over between weapons
  isReloading: boolean = false;
  reloadStartTime: number = 0;
  isAiming: boolean = false;

  // Inventory slots
  slot2Weapon: WeaponType | null = null;
  slot3Weapon: WeaponType | null = null;
  unlockedWeapons: Set<WeaponType> = new Set(['PICKAXE', 'BLOCK']);
  pickaxeTier: number = 1;
  resources: { [key in ResourceType]: number } = { wood: 0, stone: 0, iron: 0, fiber: 0 };

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
    this.pickaxeTier = 1;
    this.weapons.set('PICKAXE', {
      type: 'PICKAXE',
      name: t('w.PICKAXE'),
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

    for (const type of Object.keys(GUN_STATS) as GunType[]) {
      const rule = SCOPE_RULES[type];
      this.weapons.set(type, {
        ...GUN_STATS[type],
        type,
        name: t(`w.${type}`),
        slotIndex: 2,
        currentAmmo: 0,
        reserveAmmo: 0,
        scope: rule.base,
        maxScope: rule.max
      });
    }

    this.weapons.set('MEDKIT', {
      type: 'MEDKIT',
      name: t('w.MEDKIT'),
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
      name: t('w.BLOCK'),
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

    this.weapons.set('GRENADE', {
      type: 'GRENADE',
      name: t('w.GRENADE'),
      slotIndex: 6,
      damage: 0,
      maxAmmo: 0,
      currentAmmo: 0,
      reserveAmmo: 0,
      fireRate: 0.8,
      automatic: false,
      spread: 0,
      range: 0,
      reloadTime: 0,
      icon: '💣'
    });
  }

  /** Crafted upgrade: faster mining and a harder melee hit. */
  upgradePickaxe() {
    const p = this.weapons.get('PICKAXE')!;
    this.pickaxeTier = 2;
    p.name = t('w.IRON_PICKAXE');
    p.damage = 55;
    p.fireRate = 0.18;
    const head = this.weaponMeshes.get('PICKAXE')?.children[1] as THREE.Mesh | undefined;
    if (head) (head.material as THREE.MeshStandardMaterial).color.setHex(0xe5e7eb);
  }

  addResource(type: ResourceType, n: number = 1) {
    this.resources[type] += n;
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
        if (this.slot3Weapon) this.dropGun(this.slot3Weapon);
        this.slot3Weapon = type;
        w.slotIndex = 3;
      } else {
        if (this.slot2Weapon) this.dropGun(this.slot2Weapon);
        this.slot2Weapon = type;
        w.slotIndex = 2;
      }
    }

    this.selectWeapon(type);
    return w.name;
  }

  // A replaced gun leaves the inventory together with its scope
  private dropGun(type: WeaponType) {
    this.unlockedWeapons.delete(type);
    const w = this.weapons.get(type);
    const rule = SCOPE_RULES[type];
    if (w && rule) w.scope = rule.base;
  }

  private gunsForScope(level: number): WeaponData[] {
    const order = [this.activeType, this.slot2Weapon, this.slot3Weapon];
    const seen = new Set<WeaponType>();
    const result: WeaponData[] = [];
    for (const t of order) {
      if (!t || seen.has(t) || !this.hasGun(t)) continue;
      seen.add(t);
      const w = this.weapons.get(t)!;
      if ((w.maxScope ?? 1) >= level && (w.scope ?? 1) < level) result.push(w);
    }
    return result;
  }

  canAttachScope(level: number): boolean {
    return this.gunsForScope(level).length > 0;
  }

  /** Mounts the scope on the gun in hand if it fits, otherwise the other gun. Returns that gun. */
  attachScope(level: number): WeaponData | null {
    const gun = this.gunsForScope(level)[0];
    if (!gun) return null;
    gun.scope = level;
    return gun;
  }

  /** Magnification of the sight on the weapon in hand (1 for non-guns). */
  getZoom(): number {
    return this.getActiveWeapon().scope ?? 1;
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

    // Extra guns share a simple box-built look with their own colours / proportions
    const gunModel = (type: WeaponType, bodyColor: number, len: number, magH: number, extra?: (g: THREE.Group) => void) => {
      const g = new THREE.Group();
      const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.5, metalness: 0.4 });
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, len), bodyMat);
      body.position.set(0, 0, -0.05);
      g.add(body);
      const brl = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, len * 0.6), darkGunMat);
      brl.position.set(0, 0.02, -0.05 - len * 0.75);
      g.add(brl);
      if (magH > 0) {
        const mag = new THREE.Mesh(new THREE.BoxGeometry(0.04, magH, 0.06), darkGunMat);
        mag.position.set(0, -0.04 - magH / 2, -0.08);
        g.add(mag);
      }
      if (extra) extra(g);
      this.weaponMeshes.set(type, g);
      this.viewmodelGroup.add(g);
    };
    gunModel('SMG', 0x1f2937, 0.24, 0.16);
    gunModel('LMG', 0x57534e, 0.45, 0, g => {
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.09, 0.1), darkGunMat);
      box.position.set(0, -0.08, -0.08);
      g.add(box);
    });
    gunModel('DMR', 0x8b6f47, 0.42, 0.1, g => {
      const sc = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.18, 8), darkGunMat);
      sc.rotation.x = Math.PI / 2;
      sc.position.set(0, 0.07, -0.05);
      g.add(sc);
    });
    gunModel('CROSSBOW', 0x92400e, 0.36, 0, g => {
      const bow = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.03, 0.03), new THREE.MeshStandardMaterial({ color: 0x78350f }));
      bow.position.set(0, 0.03, -0.3);
      g.add(bow);
    });

    // Grenade
    const nadeGroup = new THREE.Group();
    const nade = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshStandardMaterial({ color: 0x3f6212, roughness: 0.6 }));
    const pin = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.04, 0.03), ironMat);
    pin.position.y = 0.065;
    nadeGroup.add(nade, pin);
    nadeGroup.scale.setScalar(0.65);
    nadeGroup.position.set(0.02, -0.03, 0.05);
    this.weaponMeshes.set('GRENADE', nadeGroup);
    this.viewmodelGroup.add(nadeGroup);

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
    if (!this.unlockedWeapons.has(type) && type !== 'PICKAXE' && type !== 'BLOCK' && type !== 'MEDKIT' && type !== 'GRENADE') {
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
    this.resources = { wood: 0, stone: 0, iron: 0, fiber: 0 };
    this.initDefaultWeapons();
    const head = this.weaponMeshes.get('PICKAXE')?.children[1] as THREE.Mesh | undefined;
    if (head) (head.material as THREE.MeshStandardMaterial).color.setHex(0xcccccc);
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
      if ((this.getActiveWeapon().scope ?? 1) >= 4) {
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
    if (now - (this.lastFireByType[weapon.type] ?? 0) < weapon.fireRate) return false;

    if (weapon.maxAmmo > 0 && weapon.currentAmmo <= 0) {
      return false;
    }
    // Medkits and blocks are counted items: none left means nothing to use
    if ((weapon.type === 'MEDKIT' || weapon.type === 'BLOCK' || weapon.type === 'GRENADE') && weapon.currentAmmo <= 0) {
      return false;
    }
    return true;
  }

  consumeAmmo() {
    this.lastFireTime = performance.now() / 1000;
    const weapon = this.getActiveWeapon();
    this.lastFireByType[weapon.type] = this.lastFireTime;
    if (weapon.maxAmmo > 0) {
      weapon.currentAmmo--;
    } else if (weapon.type === 'BLOCK' || weapon.type === 'MEDKIT' || weapon.type === 'GRENADE') {
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
