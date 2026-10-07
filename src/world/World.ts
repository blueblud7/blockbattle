import * as THREE from 'three';
import { TextureGenerator } from '../textures/TextureGenerator';
import { sounds } from '../audio/SoundManager';
import { t } from '../i18n';

export type GunType = 'PISTOL' | 'SHOTGUN' | 'SMG' | 'RIFLE' | 'LMG' | 'DMR' | 'SNIPER' | 'CROSSBOW';
export const GUN_TYPES: GunType[] = ['PISTOL', 'SHOTGUN', 'SMG', 'RIFLE', 'LMG', 'DMR', 'SNIPER', 'CROSSBOW'];
export function isGun(type: string): type is GunType {
  return (GUN_TYPES as string[]).includes(type);
}

export type LootItemType = GunType | 'MEDKIT' | 'ARMOR' | 'AMMO' | 'GRENADE' | ScopeItemType;
export type ScopeItemType = 'SCOPE2' | 'SCOPE4' | 'SCOPE8';

/** Display name of a loot item in the current language. */
export function itemName(type: string): string {
  return isGun(type) || type === 'MEDKIT' ? t(`w.${type}`) : t(`i.${type}`);
}

export const SCOPE_LEVEL: { [key in ScopeItemType]: number } = { SCOPE2: 2, SCOPE4: 4, SCOPE8: 8 };
export function isScope(type: string): type is ScopeItemType {
  return type === 'SCOPE2' || type === 'SCOPE4' || type === 'SCOPE8';
}

export interface GroundItem {
  id: number;
  type: LootItemType;
  mesh: THREE.Group;
  position: THREE.Vector3;
  baseY: number;
  ammoCount: number;
  picked: boolean;
}

export interface DeathCrate {
  id: number;
  victimName: string;
  mesh: THREE.Group;
  position: THREE.Vector3;
  weapons: LootItemType[];
  ammoCount: number;
  medkitCount: number;
  hasArmor: boolean;
  opened: boolean;
}

export interface LootCrate {
  id: number;
  mesh: THREE.Mesh;
  position: THREE.Vector3;
  opened: boolean;
  lootType: LootItemType;
}

type StructureType = 'house' | 'barracks' | 'warehouse' | 'watchtower';

interface StructurePlan {
  x: number;
  z: number;
  type: StructureType;
  baseY: number; // top surface of the flattened ground (= floor block Y)
}

// Footprint of each structure relative to its origin (inclusive bounds)
const FOOTPRINTS: { [key in StructureType]: { x0: number; x1: number; z0: number; z1: number } } = {
  house: { x0: 0, x1: 9, z0: 0, z1: 7 },
  barracks: { x0: 0, x1: 13, z0: 0, z1: 6 },
  warehouse: { x0: 0, x1: 11, z0: 0, z1: 11 },
  watchtower: { x0: -3, x1: 13, z0: -3, z1: 3 }
};

// Cube faces: corner offsets + UVs (CCW when viewed from outside)
const FACES = [
  { dir: [-1, 0, 0], shade: 0.8, corners: [[0, 1, 0], [0, 0, 0], [0, 1, 1], [0, 0, 1]], uvs: [[0, 1], [0, 0], [1, 1], [1, 0]] },
  { dir: [1, 0, 0], shade: 0.8, corners: [[1, 1, 1], [1, 0, 1], [1, 1, 0], [1, 0, 0]], uvs: [[0, 1], [0, 0], [1, 1], [1, 0]] },
  { dir: [0, -1, 0], shade: 0.55, corners: [[1, 0, 1], [0, 0, 1], [1, 0, 0], [0, 0, 0]], uvs: [[1, 0], [0, 0], [1, 1], [0, 1]] },
  { dir: [0, 1, 0], shade: 1.0, corners: [[0, 1, 1], [1, 1, 1], [0, 1, 0], [1, 1, 0]], uvs: [[1, 1], [0, 1], [1, 0], [0, 0]] },
  { dir: [0, 0, -1], shade: 0.7, corners: [[1, 0, 0], [0, 0, 0], [1, 1, 0], [0, 1, 0]], uvs: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  { dir: [0, 0, 1], shade: 0.7, corners: [[0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]], uvs: [[0, 0], [1, 0], [0, 1], [1, 1]] }
];

// Atlas tile indices
const TILE_GRASS_TOP = 0;
const TILE_GRASS_SIDE = 1;
const TILE_DIRT = 2;
const TILE_STONE = 3;
const TILE_PLANK = 4;
const TILE_LOG = 5;
const TILE_LEAVES = 6;
const TILE_SAND = 7;
const TILE_GRAVEL = 8;
const TILE_IRON_ORE = 9;
const ATLAS_TILES = 10;

// Villages are the main loot hubs: flattened sites with a street grid, joined by gravel roads
interface Town {
  x: number;
  z: number;
  r: number;
  military?: boolean;
}
const TOWNS: Town[] = [
  { x: 0, z: 0, r: 30, military: true }, // central military compound
  { x: 5, z: 168, r: 40 },               // north coast town
  { x: 35, z: -170, r: 34 },             // southern island village
  { x: 146, z: 25, r: 36 },              // east town
  { x: -155, z: -40, r: 38 },            // west town
  { x: 120, z: 135, r: 24 },             // northeast hill village
  { x: -80, z: 128, r: 26 },             // northwest village past the lake
  { x: 45, z: 75, r: 26 },               // foothills village below the peak
  { x: -95, z: -175, r: 28 },            // southwest village
  { x: 70, z: -60, r: 22 },              // mid-island hamlets
  { x: -70, z: 20, r: 22 }
];

const HOUSE_GUNS: LootItemType[] = ['PISTOL', 'PISTOL', 'SHOTGUN', 'SMG', 'SMG', 'RIFLE', 'CROSSBOW'];
const UPPER_LOOT: LootItemType[] = ['RIFLE', 'DMR', 'SNIPER', 'LMG', 'MEDKIT', 'ARMOR', 'SMG'];
const MILITARY_GUNS: LootItemType[] = ['RIFLE', 'RIFLE', 'LMG', 'DMR', 'SMG'];
const CONSUMABLES: LootItemType[] = ['MEDKIT', 'GRENADE', 'ARMOR', 'AMMO'];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export class World {
  scene: THREE.Scene;
  worldSize: number = 520; // 520x520 island (4x the area of the old 260 map)
  blockSize: number = 1.0;
  readonly half: number;
  readonly gridSize: number;
  static readonly MAX_HEIGHT = 80;

  // Dense voxel storage: index = ((x + half) * gridSize + (z + half)) * MAX_HEIGHT + y
  private grid: Uint8Array;
  private initialGrid: Uint8Array | null = null;
  heightMap: Int16Array; // terrain top block Y per column
  private coastDist: Float32Array; // >0: distance inland from the shore, <=0: distance out to sea
  mapImage: HTMLCanvasElement | null = null; // top-down colour map for the minimap

  // Chunked face-culled meshes
  static readonly CHUNK = 32;
  private chunkMeshes: Map<string, THREE.Mesh> = new Map();
  private dirtyChunks: Set<string> = new Set();
  private blockMaterial!: THREE.MeshLambertMaterial;

  // Loot items
  crates: LootCrate[] = [];
  groundItems: GroundItem[] = [];
  deathCrates: DeathCrate[] = [];
  private nextItemId: number = 0;
  private structures: StructurePlan[] = [];
  private reserved: Uint8Array; // columns reserved for structures (no trees)
  private road: Uint8Array;     // gravel road / street columns

  // Block types
  static readonly BLOCK_AIR = 0;
  static readonly BLOCK_GRASS = 1;
  static readonly BLOCK_DIRT = 2;
  static readonly BLOCK_STONE = 3;
  static readonly BLOCK_WOOD_PLANK = 4;
  static readonly BLOCK_WOOD_LOG = 5;
  static readonly BLOCK_LEAVES = 6;
  static readonly BLOCK_SAND = 7;
  static readonly BLOCK_WATER = 8;
  static readonly BLOCK_GRAVEL = 9;
  static readonly BLOCK_IRON_ORE = 10;
  static readonly WATER_LEVEL = 4.5;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.half = Math.floor(this.worldSize / 2);
    this.gridSize = this.half * 2 + 1;
    this.grid = new Uint8Array(this.gridSize * this.gridSize * World.MAX_HEIGHT);
    this.heightMap = new Int16Array(this.gridSize * this.gridSize);
    this.reserved = new Uint8Array(this.gridSize * this.gridSize);
    this.road = new Uint8Array(this.gridSize * this.gridSize);
    this.coastDist = new Float32Array(this.gridSize * this.gridSize);

    this.initMaterials();
    this.initWater();
    this.generateHeightMap();
    this.planStructures();
    this.fillTerrain();
    this.buildStructures();
    this.buildBridges();
    this.spawnTrees();
    this.spawnDocks();
    this.spawnBoulders();
    this.spawnLootCrates();
    this.spawnStreetLoot();

    this.initialGrid = this.grid.slice();
    this.rebuildAllChunks();
    this.buildMapImage();
  }

  private initMaterials() {
    // Pack every block texture into one horizontal atlas -> one draw call per chunk
    const tiles = [
      TextureGenerator.getGrassTop(),
      TextureGenerator.getGrassSide(),
      TextureGenerator.getDirt(),
      TextureGenerator.getStone(),
      TextureGenerator.getWoodPlanks(),
      TextureGenerator.getWoodLog(),
      TextureGenerator.getLeaves(),
      TextureGenerator.getSand(),
      TextureGenerator.getGravel(),
      TextureGenerator.getIronOre()
    ];
    const canvas = document.createElement('canvas');
    canvas.width = 16 * ATLAS_TILES;
    canvas.height = 16;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    tiles.forEach((tex, i) => ctx.drawImage(tex.image as HTMLCanvasElement, i * 16, 0, 16, 16));

    const atlas = new THREE.CanvasTexture(canvas);
    atlas.magFilter = THREE.NearestFilter;
    atlas.minFilter = THREE.NearestFilter;
    atlas.generateMipmaps = false;
    atlas.colorSpace = THREE.SRGBColorSpace;

    this.blockMaterial = new THREE.MeshLambertMaterial({ map: atlas, vertexColors: true });
  }

  private initWater() {
    const waterGeo = new THREE.PlaneGeometry(4000, 4000);
    const waterMat = new THREE.MeshLambertMaterial({
      color: 0x1d4ed8,
      transparent: true,
      opacity: 0.8,
      depthWrite: false
    });
    const waterMesh = new THREE.Mesh(waterGeo, waterMat);
    waterMesh.rotation.x = -Math.PI / 2;
    waterMesh.position.y = World.WATER_LEVEL;
    waterMesh.renderOrder = 1;
    this.scene.add(waterMesh);
  }

  // ---------- Voxel grid access ----------

  private inBounds(x: number, z: number): boolean {
    return x >= -this.half && x <= this.half && z >= -this.half && z <= this.half;
  }

  private colIndex(x: number, z: number): number {
    return (x + this.half) * this.gridSize + (z + this.half);
  }

  private h(x: number, z: number): number {
    return this.inBounds(x, z) ? this.heightMap[this.colIndex(x, z)] : 0;
  }

  setBlock(x: number, y: number, z: number, type: number) {
    x = Math.floor(x);
    y = Math.floor(y);
    z = Math.floor(z);
    if (!this.inBounds(x, z) || y < 0 || y >= World.MAX_HEIGHT) return;
    this.grid[this.colIndex(x, z) * World.MAX_HEIGHT + y] = type;

    if (this.chunkMeshes.size > 0 || this.initialGrid) {
      this.markDirty(x, z);
    }
  }

  getBlock(x: number, y: number, z: number): number {
    x = Math.floor(x);
    y = Math.floor(y);
    z = Math.floor(z);
    if (y < 0) return World.BLOCK_STONE; // bedrock below the world
    if (y >= World.MAX_HEIGHT || !this.inBounds(x, z)) return World.BLOCK_AIR;
    return this.grid[this.colIndex(x, z) * World.MAX_HEIGHT + y];
  }

  hasBlock(x: number, y: number, z: number): boolean {
    return this.getBlock(x, y, z) !== World.BLOCK_AIR;
  }

  // ---------- Terrain ----------

  // Fixed seed so the island always has the same, learnable shape (like a real BR map)
  private static readonly MAP_SEED = 7;

  private static hash2(ix: number, iz: number, seed: number): number {
    let h = (Math.imul(ix, 374761393) + Math.imul(iz, 668265263) + Math.imul(seed, 1442695041)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  // Smooth value noise in [-1, 1]
  private static noise(x: number, z: number, seed: number): number {
    const ix = Math.floor(x);
    const iz = Math.floor(z);
    const fx = x - ix;
    const fz = z - iz;
    const sx = fx * fx * (3 - 2 * fx);
    const sz = fz * fz * (3 - 2 * fz);
    const a = World.hash2(ix, iz, seed);
    const b = World.hash2(ix + 1, iz, seed);
    const c = World.hash2(ix, iz + 1, seed);
    const d = World.hash2(ix + 1, iz + 1, seed);
    const v = a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
    return v * 2 - 1;
  }

  private static fbm(x: number, z: number, seed: number, octaves: number): number {
    let sum = 0;
    let amp = 1;
    let norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += World.noise(x, z, seed + i * 31) * amp;
      norm += amp;
      amp *= 0.5;
      x *= 2.03;
      z *= 2.03;
    }
    return sum / norm;
  }

  // Centre line of the strait that splits off the southern island
  private static channelZ(x: number): number {
    return -118 + 14 * Math.sin(x * 0.018 + 0.6) + 6 * Math.sin(x * 0.05);
  }

  // Centre line of the river running from the inland lake to the west coast
  private static riverZ(x: number): number {
    return 72 + 12 * Math.sin(x * 0.035) + 4 * Math.sin(x * 0.11);
  }

  private static readonly LAKE = { x: -100, z: 72, r: 18 };

  // Land mask: > 0 is land. Irregular coastline, bays, a strait, a river and a lake.
  private landShape(x: number, z: number): number {
    const seed = World.MAP_SEED;
    const half = this.half;
    const r = Math.hypot(x, z);
    const ang = Math.atan2(z, x);

    // Lumpy, non-circular outline; domain-warped noise carves bays and capes
    const warp = 0.10 * Math.sin(2 * ang + 0.3) + 0.07 * Math.sin(3 * ang + 0.7)
      + 0.05 * Math.sin(5 * ang + 2.1) + 0.03 * Math.sin(8 * ang + 4.0);
    const R = half * 0.8 * (1 + warp);
    const wx = x + 40 * World.noise(x * 0.01, z * 0.01, seed + 700);
    const wz = z + 40 * World.noise(x * 0.01 + 50, z * 0.01, seed + 800);
    let s = 1 - r / R
      + World.fbm(wx * 0.005, wz * 0.005, seed, 4) * 0.5
      + World.fbm(wx * 0.025, wz * 0.025, seed + 100, 2) * 0.07;

    // Deep bays
    const bays = [
      { x: 205, z: 45, r: 60 },
      { x: -70, z: 225, r: 50 },
      { x: -215, z: -40, r: 40 }
    ];
    for (const b of bays) {
      s -= Math.max(0, 1 - Math.hypot(x - b.x, z - b.z) / b.r) * 0.7;
    }

    // A long cape reaching out to the southwest
    {
      const ax = -110, az = -150, bx = -215, bz = -205;
      const vx = bx - ax, vz = bz - az;
      const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz)));
      const d = Math.hypot(x - (ax + vx * t), z - (az + vz * t));
      s = Math.max(s, (1 - d / (22 - t * 10)) * 0.5);
    }

    // A few small islands offshore
    const islets = [
      { x: 215, z: -120, r: 14 },
      { x: 150, z: 205, r: 12 },
      { x: -225, z: 120, r: 11 }
    ];
    for (const i of islets) {
      s = Math.max(s, (1 - Math.hypot(x - i.x, z - i.z) / i.r) * 0.6);
    }

    // Never touch the edge of the world
    s -= Math.max(0, r - half * 0.95) / 8;

    // Strait between the mainland and the southern island
    const chW = 6.5 + 2.5 * World.noise(x * 0.04, 3.3, seed + 200);
    if (Math.abs(z - World.channelZ(x)) < chW) s = Math.min(s, -0.05);

    // River from the lake to the west coast
    if (x < World.LAKE.x) {
      const rw = 3.5 + 1.0 * World.noise(x * 0.06, 7.7, seed + 300);
      if (Math.abs(z - World.riverZ(x)) < rw) s = Math.min(s, -0.05);
    }

    // Inland lake
    const lr = World.LAKE.r + 7 * World.fbm(x * 0.06, z * 0.06, seed + 400, 2);
    if (Math.hypot(x - World.LAKE.x, z - World.LAKE.z) < lr) s = Math.min(s, -0.05);

    return s;
  }

  // Two-pass chamfer distance transform: distance to the nearest cell where mask != target
  private distanceTransform(isTarget: Uint8Array): Float32Array {
    const n = this.gridSize;
    const INF = 1e6;
    const D1 = 1;
    const D2 = Math.SQRT2;
    const dist = new Float32Array(n * n);
    for (let i = 0; i < n * n; i++) dist[i] = isTarget[i] ? INF : 0;

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const k = i * n + j;
        if (dist[k] === 0) continue;
        let v = dist[k];
        if (i > 0) {
          v = Math.min(v, dist[k - n] + D1);
          if (j > 0) v = Math.min(v, dist[k - n - 1] + D2);
          if (j < n - 1) v = Math.min(v, dist[k - n + 1] + D2);
        }
        if (j > 0) v = Math.min(v, dist[k - 1] + D1);
        dist[k] = v;
      }
    }
    for (let i = n - 1; i >= 0; i--) {
      for (let j = n - 1; j >= 0; j--) {
        const k = i * n + j;
        if (dist[k] === 0) continue;
        let v = dist[k];
        if (i < n - 1) {
          v = Math.min(v, dist[k + n] + D1);
          if (j > 0) v = Math.min(v, dist[k + n - 1] + D2);
          if (j < n - 1) v = Math.min(v, dist[k + n + 1] + D2);
        }
        if (j < n - 1) v = Math.min(v, dist[k + 1] + D1);
        dist[k] = v;
      }
    }
    return dist;
  }

  private generateHeightMap() {
    const half = this.half;
    const n = this.gridSize;
    const seed = World.MAP_SEED;

    const land = new Uint8Array(n * n);
    const water = new Uint8Array(n * n);
    for (let x = -half; x <= half; x++) {
      for (let z = -half; z <= half; z++) {
        const ci = this.colIndex(x, z);
        const isLand = this.landShape(x, z) > 0 ? 1 : 0;
        land[ci] = isLand;
        water[ci] = 1 - isLand;
      }
    }

    const landDist = this.distanceTransform(land);   // land cells: distance to water
    const waterDist = this.distanceTransform(water); // water cells: distance to land

    for (let x = -half; x <= half; x++) {
      for (let z = -half; z <= half; z++) {
        const ci = this.colIndex(x, z);
        let height: number;

        if (!land[ci]) {
          const wd = waterDist[ci];
          this.coastDist[ci] = -wd;
          if (wd <= 2) height = 3;      // shallow bank, just under the surface
          else if (wd <= 6) height = 2;
          else height = 0;              // open sea
        } else {
          const d = landDist[ci];
          this.coastDist[ci] = d;
          if (d < 3) {
            height = 4;
          } else if (d < 7) {
            height = 5;
          } else {
            const nx = x * 0.012;
            const nz = z * 0.012;
            const n1 = Math.sin(nx) * Math.cos(nz) * 6;
            const n2 = Math.sin(nx * 2.2 + 1.2) * Math.cos(nz * 2.2) * 3;
            const n3 = World.fbm(x * 0.008, z * 0.008, seed + 500, 3) * 8;
            const n4 = World.fbm(x * 0.03, z * 0.03, seed + 600, 2) * 2;

            // Big mountain in the northeast, a hill range in the west, a ridge on the southern island
            const peak = Math.max(0, 22 - Math.hypot(x - 90, z - 90) * 0.22);
            const hill = Math.max(0, 12 - Math.hypot(x + 110, z + 20) * 0.16);
            const ridge = Math.max(0, 8 - Math.hypot(x - 20, z + 185) * 0.15);

            const raw = 2 + (n1 + n2 + n3 + n4 + 8 + peak + hill + ridge) * 1.1;
            const blend = Math.min(1, (d - 7) / 22);
            height = Math.max(5, Math.floor(5 + raw * blend));
          }
        }

        this.heightMap[ci] = Math.min(height, World.MAX_HEIGHT - 20);
      }
    }

    this.planBridges();
  }

  /** True if the column is dry land (top surface above the water). */
  isLand(x: number, z: number): boolean {
    const ix = Math.floor(x);
    const iz = Math.floor(z);
    return this.inBounds(ix, iz) && this.coastDist[this.colIndex(ix, iz)] > 0;
  }

  /** Nearest dry-land point to (x, z), searching outward in rings. Returns null if none nearby. */
  findNearestLand(x: number, z: number, minCoastDist: number = 4, maxRadius: number = 200): THREE.Vector2 | null {
    const cx = Math.floor(x);
    const cz = Math.floor(z);
    for (let rad = 0; rad <= maxRadius; rad += 2) {
      const steps = Math.max(1, Math.floor(rad * 1.5));
      let best: THREE.Vector2 | null = null;
      for (let i = 0; i < steps; i++) {
        const a = (i / steps) * Math.PI * 2;
        const px = Math.round(cx + Math.cos(a) * rad);
        const pz = Math.round(cz + Math.sin(a) * rad);
        if (!this.inBounds(px, pz)) continue;
        if (this.coastDist[this.colIndex(px, pz)] >= minCoastDist) {
          best = new THREE.Vector2(px + 0.5, pz + 0.5);
          break;
        }
      }
      if (best) return best;
    }
    return null;
  }

  // Bridges across the strait and the river: [crossing point in the water, direction]
  private bridges: { x: number; z: number; dx: number; dz: number; from: number; to: number }[] = [];

  private planBridges() {
    const sites = [
      { x: -50, z: Math.round(World.channelZ(-50)), dx: 0, dz: 1 },
      { x: 85, z: Math.round(World.channelZ(85)), dx: 0, dz: 1 },
      { x: -138, z: Math.round(World.riverZ(-138)), dx: 0, dz: 1 }
    ];
    for (const s of sites) {
      if (this.h(s.x, s.z) > 3) continue; // no water here after all
      // Walk out both ways across the water, then over the beach until proper ground
      const walk = (sign: number): number | null => {
        let t = 0;
        let reachedLand = false;
        while (Math.abs(t) < 40) {
          const hh = this.h(s.x + s.dx * (t + sign), s.z + s.dz * (t + sign));
          if (hh >= 4) reachedLand = true;
          else if (reachedLand) break; // back into water: stop at the end of the beach
          if (hh > 5) break;
          t += sign;
        }
        return reachedLand ? t : null;
      };
      const from = walk(-1);
      const to = walk(1);
      if (from === null || to === null) continue;
      this.bridges.push({ ...s, from, to });
      // Keep buildings and trees off the bridge and its approaches
      for (let t = from - 4; t <= to + 4; t++) {
        for (let w = -3; w <= 3; w++) {
          const bx = s.x + s.dx * t + s.dz * w;
          const bz = s.z + s.dz * t + s.dx * w;
          if (this.inBounds(bx, bz)) this.reserved[this.colIndex(bx, bz)] = 1;
        }
      }
    }
  }

  // Plank bridges, deck surface at y=6 like the docks, railings over the water
  private buildBridges() {
    for (const b of this.bridges) {
      const px = b.dz; // perpendicular
      const pz = b.dx;
      for (let t = b.from; t <= b.to; t++) {
        const cx = b.x + b.dx * t;
        const cz = b.z + b.dz * t;
        const overWater = this.h(cx, cz) < 4;
        for (let w = -2; w <= 2; w++) {
          const x = cx + px * w;
          const z = cz + pz * w;
          this.setBlock(x, 5, z, World.BLOCK_WOOD_PLANK);
          for (let y = 6; y < 9; y++) this.setBlock(x, y, z, World.BLOCK_AIR);
        }
        if (overWater) {
          this.setBlock(cx + px * 2, 6, cz + pz * 2, World.BLOCK_WOOD_LOG);
          this.setBlock(cx - px * 2, 6, cz - pz * 2, World.BLOCK_WOOD_LOG);
          if (t % 5 === 0) {
            for (const w of [-2, 2]) {
              for (let y = 0; y < 5; y++) this.setBlock(cx + px * w, y, cz + pz * w, World.BLOCK_WOOD_LOG);
            }
          }
        }
      }
    }
  }

  private fillTerrain() {
    const half = this.half;
    const H = World.MAX_HEIGHT;
    for (let x = -half; x <= half; x++) {
      for (let z = -half; z <= half; z++) {
        const ci = this.colIndex(x, z);
        const height = this.heightMap[ci];
        const isShore = this.coastDist[ci] < 7;
        const isRoad = this.road[ci] === 1 && height >= 4;
        const base = ci * H;
        for (let y = 0; y <= height; y++) {
          let type: number;
          if (y === height) type = isRoad ? World.BLOCK_GRAVEL : isShore ? World.BLOCK_SAND : World.BLOCK_GRASS;
          else if (y >= height - 3) type = isShore ? World.BLOCK_SAND : World.BLOCK_DIRT;
          else type = Math.random() < 0.04 ? World.BLOCK_IRON_ORE : World.BLOCK_STONE;
          this.grid[base + y] = type;
        }
      }
    }
  }

  private spawnTrees() {
    const half = this.half;
    for (let x = -half + 20; x <= half - 20; x += 5) {
      for (let z = -half + 20; z <= half - 20; z += 5) {
        if (Math.random() >= 0.28) continue;
        const tx = x + Math.floor(Math.random() * 3) - 1;
        const tz = z + Math.floor(Math.random() * 3) - 1;
        if (this.isReservedNear(tx, tz, 3)) continue;
        if (this.isRoadNear(tx, tz, 2) || TOWNS.some(tw => Math.hypot(tw.x - tx, tw.z - tz) < tw.r + 4)) continue;
        const h = this.h(tx, tz);
        if (!this.inBounds(tx, tz) || this.coastDist[this.colIndex(tx, tz)] < 9) continue;
        if (h >= 5 && h < 50 && this.getBlock(tx, h, tz) === World.BLOCK_GRASS) {
          this.spawnTree(tx, h + 1, tz);
        }
      }
    }
  }

  private isRoadNear(x: number, z: number, r: number): boolean {
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        if (this.inBounds(x + dx, z + dz) && this.road[this.colIndex(x + dx, z + dz)]) return true;
      }
    }
    return false;
  }

  // Rocky outcrops: the main source of stone and iron ore above ground
  private spawnBoulders() {
    let placed = 0;
    for (let tries = 0; tries < 4000 && placed < 170; tries++) {
      const x = Math.floor((Math.random() * 2 - 1) * this.half * 0.9);
      const z = Math.floor((Math.random() * 2 - 1) * this.half * 0.9);
      if (!this.inBounds(x, z) || this.coastDist[this.colIndex(x, z)] < 8) continue;
      if (this.isReservedNear(x, z, 4) || this.isRoadNear(x, z, 3)) continue;
      if (TOWNS.some(tw => Math.hypot(tw.x - x, tw.z - z) < tw.r + 3)) continue;
      const r = 1.3 + Math.random() * 1.4;
      const ri = Math.ceil(r);
      const oreChance = 0.22 + Math.random() * 0.18;
      for (let dx = -ri; dx <= ri; dx++) {
        for (let dz = -ri; dz <= ri; dz++) {
          const ground = this.h(x + dx, z + dz);
          for (let dy = 0; dy <= ri; dy++) {
            if (Math.hypot(dx, dy * 1.2, dz) > r) continue;
            const type = Math.random() < oreChance ? World.BLOCK_IRON_ORE : World.BLOCK_STONE;
            this.setBlock(x + dx, ground + 1 + dy, z + dz, type);
          }
        }
      }
      placed++;
    }
  }

  private isReservedNear(x: number, z: number, r: number): boolean {
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        const cx = x + dx;
        const cz = z + dz;
        if (this.inBounds(cx, cz) && this.reserved[this.colIndex(cx, cz)]) return true;
      }
    }
    return false;
  }

  // 8 wooden docks where the shoreline meets each compass direction
  private spawnDocks() {
    const dirs = [
      { dx: 0, dz: 1 }, { dx: 0, dz: -1 }, { dx: 1, dz: 0 }, { dx: -1, dz: 0 },
      { dx: 1, dz: 1 }, { dx: -1, dz: 1 }, { dx: 1, dz: -1 }, { dx: -1, dz: -1 }
    ];
    const dockLocations: { x: number; z: number; dx: number; dz: number }[] = [];
    for (const d of dirs) {
      // Come in from the open sea until we hit the first real beach
      const maxK = d.dx !== 0 && d.dz !== 0 ? Math.floor((this.half - 4) / Math.SQRT2) : this.half - 4;
      for (let k = maxK; k > 20; k--) {
        const x = d.dx * k;
        const z = d.dz * k;
        if (this.coastDist[this.colIndex(x, z)] > 0) {
          if (!this.isReservedNear(x, z, 2)) dockLocations.push({ x: x - d.dx, z: z - d.dz, dx: d.dx, dz: d.dz });
          break;
        }
      }
    }

    dockLocations.forEach((loc, idx) => {
      const perpX = -loc.dz;
      const perpZ = loc.dx;
      for (let step = 0; step < 14; step++) {
        const px = Math.floor(loc.x + loc.dx * step);
        const pz = Math.floor(loc.z + loc.dz * step);
        // Deck at Y=5 (top 6), well above the water at 4.5
        this.setBlock(px, 5, pz, World.BLOCK_WOOD_PLANK);
        this.setBlock(px + perpX, 5, pz + perpZ, World.BLOCK_WOOD_PLANK);
        this.setBlock(px - perpX, 5, pz - perpZ, World.BLOCK_WOOD_PLANK);
        // Support pillars down to the sea floor
        if (step % 3 === 0) {
          for (let y = this.h(px, pz) + 1; y < 5; y++) this.setBlock(px, y, pz, World.BLOCK_WOOD_LOG);
        }
      }

      // Steps at the outer end down into the water so swimmers can climb back up
      const endX = Math.floor(loc.x + loc.dx * 14);
      const endZ = Math.floor(loc.z + loc.dz * 14);
      this.setBlock(endX, 4, endZ, World.BLOCK_WOOD_PLANK);
      this.setBlock(endX + loc.dx, 3, endZ + loc.dz, World.BLOCK_WOOD_PLANK);

      const gunTypes: LootItemType[] = ['RIFLE', 'SHOTGUN', 'PISTOL', 'SMG', 'DMR', 'SNIPER', 'LMG', 'PISTOL'];
      this.spawnGroundItem(loc.x + loc.dx * 3, 6.2, loc.z + loc.dz * 3, gunTypes[idx % gunTypes.length], 45);
      this.spawnGroundItem(loc.x + loc.dx * 8, 6.2, loc.z + loc.dz * 8, 'MEDKIT', 1);
    });
  }

  // Oak tree
  private spawnTree(x: number, baseY: number, z: number) {
    const trunkHeight = 4 + Math.floor(Math.random() * 2);
    for (let y = 0; y < trunkHeight; y++) {
      this.setBlock(x, baseY + y, z, World.BLOCK_WOOD_LOG);
    }

    const crownY = baseY + trunkHeight - 1;
    for (let lx = -2; lx <= 2; lx++) {
      for (let lz = -2; lz <= 2; lz++) {
        for (let ly = 0; ly <= 2; ly++) {
          if (Math.abs(lx) === 2 && Math.abs(lz) === 2 && Math.random() > 0.4) continue;
          if (lx === 0 && lz === 0 && ly < 2) continue;
          if (this.getBlock(x + lx, crownY + ly, z + lz) !== World.BLOCK_AIR) continue;
          this.setBlock(x + lx, crownY + ly, z + lz, World.BLOCK_LEAVES);
        }
      }
    }
    this.setBlock(x, crownY + 3, z, World.BLOCK_LEAVES);
  }

  // ---------- Structures ----------

  private planStructures() {
    this.flattenTowns();
    const candidates = this.layoutTowns();
    this.planRoads();

    // A few lone cabins/towers between the villages
    const extraTypes: StructureType[] = ['house', 'house', 'watchtower', 'house', 'barracks'];
    let attempts = 0;
    let added = 0;
    while (added < 16 && attempts < 600) {
      attempts++;
      const angle = Math.random() * Math.PI * 2;
      const dist = 30 + Math.random() * (this.half * 0.82);
      const x = Math.round(Math.cos(angle) * dist);
      const z = Math.round(Math.sin(angle) * dist);
      if (this.coastDist[this.colIndex(x, z)] < 8) continue;
      if (candidates.some(c => Math.hypot(c.x - x, c.z - z) < 30)) continue;
      if (TOWNS.some(tw => Math.hypot(tw.x - x, tw.z - z) < tw.r + 20)) continue;
      candidates.push({ x, z, type: extraTypes[added % extraTypes.length] });
      added++;
    }

    for (const cand of candidates) {
      // Named spots that ended up in the sea/river get nudged to the nearest dry ground
      const spot = this.findStructureSpot(cand.type, cand.x, cand.z);
      if (!spot) continue;
      const c = { x: spot.x, z: spot.z, type: cand.type };
      const fp = FOOTPRINTS[c.type];
      // Use the average terrain height under the footprint so we cut/fill as little as possible
      let sum = 0;
      let n = 0;
      let minH = Infinity;
      for (let x = c.x + fp.x0; x <= c.x + fp.x1; x++) {
        for (let z = c.z + fp.z0; z <= c.z + fp.z1; z++) {
          const hh = this.h(x, z);
          sum += hh;
          minH = Math.min(minH, hh);
          n++;
        }
      }
      if (minH < 4) continue; // would stand in the water
      const groundY = Math.round(sum / n);

      // Flatten footprint (+1 margin) so walls never get buried inside a slope
      for (let x = c.x + fp.x0 - 1; x <= c.x + fp.x1 + 1; x++) {
        for (let z = c.z + fp.z0 - 1; z <= c.z + fp.z1 + 1; z++) {
          if (!this.inBounds(x, z)) continue;
          const ci = this.colIndex(x, z);
          this.heightMap[ci] = groundY;
          this.reserved[ci] = 1;
        }
      }

      // Blend the surrounding terrain toward the pad (max 1 block per ring) so every door is reachable
      for (let ring = 2; ring <= 8; ring++) {
        for (let x = c.x + fp.x0 - ring; x <= c.x + fp.x1 + ring; x++) {
          for (let z = c.z + fp.z0 - ring; z <= c.z + fp.z1 + ring; z++) {
            const onRing = x === c.x + fp.x0 - ring || x === c.x + fp.x1 + ring || z === c.z + fp.z0 - ring || z === c.z + fp.z1 + ring;
            if (!onRing || !this.inBounds(x, z)) continue;
            const ci = this.colIndex(x, z);
            if (this.reserved[ci] || this.coastDist[ci] <= 0) continue;
            const k = ring - 1;
            this.heightMap[ci] = Math.max(groundY - k, Math.min(groundY + k, this.heightMap[ci]));
          }
        }
      }

      this.structures.push({ x: c.x, z: c.z, type: c.type, baseY: groundY + 1 });
    }
  }

  private structureFits(type: StructureType, x: number, z: number): boolean {
    const fp = FOOTPRINTS[type];
    for (let cx = x + fp.x0 - 2; cx <= x + fp.x1 + 2; cx++) {
      for (let cz = z + fp.z0 - 2; cz <= z + fp.z1 + 2; cz++) {
        if (!this.inBounds(cx, cz)) return false;
        const ci = this.colIndex(cx, cz);
        if (this.reserved[ci] || this.coastDist[ci] < 3) return false;
        // Streets may run right past the walls, but not through the building
        const inside = cx >= x + fp.x0 && cx <= x + fp.x1 && cz >= z + fp.z0 && cz <= z + fp.z1;
        if (inside && this.road[ci]) return false;
      }
    }
    return true;
  }

  // Level each village site toward its median height, blending into the hills around it
  private flattenTowns() {
    const blendW = 18;
    for (const town of TOWNS) {
      const samples: number[] = [];
      for (let x = town.x - town.r; x <= town.x + town.r; x += 2) {
        for (let z = town.z - town.r; z <= town.z + town.r; z += 2) {
          if (!this.inBounds(x, z) || Math.hypot(x - town.x, z - town.z) > town.r) continue;
          const ci = this.colIndex(x, z);
          if (this.coastDist[ci] >= 3) samples.push(this.heightMap[ci]);
        }
      }
      if (samples.length === 0) continue;
      samples.sort((a, b) => a - b);
      const base = Math.max(6, samples[Math.floor(samples.length / 2)]);
      const R = town.r + blendW;
      for (let x = town.x - R; x <= town.x + R; x++) {
        for (let z = town.z - R; z <= town.z + R; z++) {
          if (!this.inBounds(x, z)) continue;
          const ci = this.colIndex(x, z);
          if (this.coastDist[ci] < 3) continue;
          const d = Math.hypot(x - town.x, z - town.z);
          if (d > R) continue;
          let w = d <= town.r ? 1 : 1 - (d - town.r) / blendW;
          w = w * w * (3 - 2 * w); // smoothstep
          const h = this.heightMap[ci];
          this.heightMap[ci] = Math.max(5, Math.round(h + (base - h) * w));
        }
      }
    }
  }

  // Street grid: buildings on 16x14 lots, 3-wide gravel streets in between
  private layoutTowns(): { x: number; z: number; type: StructureType }[] {
    const out: { x: number; z: number; type: StructureType }[] = [];
    const LX = 18;
    const LZ = 16;
    for (const town of TOWNS) {
      const lots: { gx: number; gz: number }[] = [];
      const n = Math.ceil(town.r / LZ) + 1;
      for (let gx = -n; gx <= n; gx++) {
        for (let gz = -n; gz <= n; gz++) {
          if (Math.hypot(gx * LX, gz * LZ) > town.r - 2) continue;
          lots.push({ gx, gz });
        }
      }

      // Streets run along the gaps between lots
      for (let gx = -n; gx <= n + 1; gx++) {
        const sx = town.x + Math.round((gx - 0.5) * LX);
        for (let z = town.z - town.r; z <= town.z + town.r; z++) {
          if (Math.hypot(sx - town.x, z - town.z) <= town.r) this.paintRoad(sx, z, 1);
        }
      }
      for (let gz = -n; gz <= n + 1; gz++) {
        const sz = town.z + Math.round((gz - 0.5) * LZ);
        for (let x = town.x - town.r; x <= town.x + town.r; x++) {
          if (Math.hypot(x - town.x, sz - town.z) <= town.r) this.paintRoad(x, sz, 1);
        }
      }

      lots.forEach((lot, i) => {
        const cx = town.x + lot.gx * LX;
        const cz = town.z + lot.gz * LZ;
        let type: StructureType = 'house';
        if (town.military) {
          type = i % 3 === 0 ? 'warehouse' : 'barracks';
        } else if (lot.gx === 0 && lot.gz === 0) {
          type = 'warehouse';
        } else if (i % 7 === 3) {
          type = 'barracks';
        } else if (Math.random() < 0.12) {
          return; // the odd empty lot / yard
        }
        if (type === 'warehouse') out.push({ x: cx - 6, z: cz - 6, type });
        else if (type === 'barracks') out.push({ x: cx - 7, z: cz - 3, type });
        else out.push({ x: cx - 5, z: cz - 4, type });
      });

      // A lookout tower just outside the village
      const a = Math.random() * Math.PI * 2;
      out.push({ x: Math.round(town.x + Math.cos(a) * (town.r + 8)), z: Math.round(town.z + Math.sin(a) * (town.r + 8)), type: 'watchtower' });
    }
    return out;
  }

  private paintRoad(x: number, z: number, halfWidth: number) {
    for (let dx = -halfWidth; dx <= halfWidth; dx++) {
      for (let dz = -halfWidth; dz <= halfWidth; dz++) {
        const px = x + dx;
        const pz = z + dz;
        if (!this.inBounds(px, pz)) continue;
        const ci = this.colIndex(px, pz);
        if (this.coastDist[ci] >= 2) this.road[ci] = 1;
      }
    }
  }

  // Gravel roads linking every village (minimum spanning tree), gently winding
  private planRoads() {
    const linked = [0];
    const rest = TOWNS.map((_, i) => i).slice(1);
    while (rest.length > 0) {
      let best = { a: 0, b: 0, d: Infinity };
      for (const a of linked) {
        for (const b of rest) {
          const d = Math.hypot(TOWNS[a].x - TOWNS[b].x, TOWNS[a].z - TOWNS[b].z);
          if (d < best.d) best = { a, b, d };
        }
      }
      linked.push(best.b);
      rest.splice(rest.indexOf(best.b), 1);
      const A = TOWNS[best.a];
      const B = TOWNS[best.b];
      const len = best.d;
      const px = -(B.z - A.z) / len;
      const pz = (B.x - A.x) / len;
      for (let s = 0; s <= len; s += 0.5) {
        const f = s / len;
        const wob = Math.sin(f * Math.PI) * Math.sin(f * Math.PI * 3 + best.b) * 10;
        const x = Math.round(A.x + (B.x - A.x) * f + px * wob);
        const z = Math.round(A.z + (B.z - A.z) * f + pz * wob);
        this.paintRoad(x, z, 1);
      }
    }
  }

  /** Village sites, for the zone and anything else that wants to know where people gather. */
  static get towns(): ReadonlyArray<{ x: number; z: number; r: number }> {
    return TOWNS;
  }

  private findStructureSpot(type: StructureType, x: number, z: number): { x: number; z: number } | null {
    if (this.structureFits(type, x, z)) return { x, z };
    for (let rad = 3; rad <= 30; rad += 3) {
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const px = Math.round(x + Math.cos(a) * rad);
        const pz = Math.round(z + Math.sin(a) * rad);
        if (this.structureFits(type, px, pz)) return { x: px, z: pz };
      }
    }
    return null;
  }

  private buildStructures() {
    for (const s of this.structures) {
      if (s.type === 'house') this.buildHouse(s.x, s.baseY, s.z);
      else if (s.type === 'barracks') this.buildBarracks(s.x, s.baseY, s.z);
      else if (s.type === 'warehouse') this.buildWarehouse(s.x, s.baseY, s.z);
      else this.buildWatchtower(s.x, s.baseY, s.z);
    }
  }

  // Two-story walkable house (10x8). Floor block at `by`, standing surface at by+1.
  private buildHouse(bx: number, by: number, bz: number) {
    const w = 10;
    const d = 8;
    const h1 = 3; // 1st floor wall height
    const h2 = 7; // top of 2nd floor walls

    for (let x = 0; x < w; x++) {
      for (let z = 0; z < d; z++) {
        this.setBlock(bx + x, by, bz + z, World.BLOCK_WOOD_PLANK);

        const isWall = (x === 0 || x === w - 1 || z === 0 || z === d - 1);
        if (isWall) {
          for (let y = 1; y <= h1; y++) {
            if (z === 0 && (x === 4 || x === 5) && y <= 2) continue;     // front door
            if (z === d - 1 && x === 4 && y <= 2) continue;              // back door
            if ((x === 0 || x === w - 1) && (z === 3 || z === 4) && y === 2) continue; // windows
            this.setBlock(bx + x, by + y, bz + z, World.BLOCK_WOOD_PLANK);
          }
        }

        // 2nd floor (opening above the staircase at x=7..8, z=4..6)
        const isStairOpening = (x >= 7 && x <= 8 && z >= 4 && z <= 6);
        if (!isStairOpening) {
          this.setBlock(bx + x, by + h1 + 1, bz + z, World.BLOCK_WOOD_PLANK);
        }

        if (isWall) {
          for (let y = h1 + 2; y <= h2; y++) {
            if (z === 0 && (x === 4 || x === 5) && y <= h1 + 3) continue; // balcony opening
            if ((x === 0 || x === w - 1) && (z === 3 || z === 4) && y === h1 + 3) continue;
            this.setBlock(bx + x, by + y, bz + z, World.BLOCK_WOOD_PLANK);
          }
        }

        this.setBlock(bx + x, by + h2 + 1, bz + z, World.BLOCK_WOOD_PLANK);
      }
    }

    // Staircase: each step 1 block higher, walking toward -z, ending on the 2nd floor at z=3
    this.setBlock(bx + 7, by + 1, bz + 6, World.BLOCK_WOOD_LOG);
    for (let y = 1; y <= 2; y++) this.setBlock(bx + 7, by + y, bz + 5, World.BLOCK_WOOD_LOG);
    for (let y = 1; y <= 3; y++) this.setBlock(bx + 7, by + y, bz + 4, World.BLOCK_WOOD_LOG);

    // Ground floor: a gun, ammo and maybe a consumable; upstairs: more of the same
    const up = by + h1 + 2.2;
    this.spawnGroundItem(bx + 3, by + 1.2, bz + 4, pick(HOUSE_GUNS), 30);
    this.spawnGroundItem(bx + 2, by + 1.2, bz + 2, 'AMMO', 30 + Math.floor(Math.random() * 30));
    if (Math.random() < 0.6) this.spawnGroundItem(bx + 5, by + 1.2, bz + 5, pick(CONSUMABLES), 1);
    this.spawnGroundItem(bx + 3, up, bz + 3, pick(UPPER_LOOT), 45);
    if (Math.random() < 0.7) this.spawnGroundItem(bx + 2, up, bz + 6, 'AMMO', 40);
    if (Math.random() < 0.5) this.spawnGroundItem(bx + 5, up, bz + 2, pick(CONSUMABLES), 1);

    // Some houses also hide a scope
    if (Math.random() < 0.55) {
      const r = Math.random();
      this.spawnGroundItem(bx + 6, by + 1.2, bz + 2, r < 0.5 ? 'SCOPE2' : r < 0.85 ? 'SCOPE4' : 'SCOPE8', 0);
    }
  }

  // Military barracks (14x7)
  private buildBarracks(bx: number, by: number, bz: number) {
    const w = 14;
    const d = 7;
    const h = 4;

    for (let x = 0; x < w; x++) {
      for (let z = 0; z < d; z++) {
        this.setBlock(bx + x, by, bz + z, World.BLOCK_STONE);

        if (x === 0 || x === w - 1 || z === 0 || z === d - 1) {
          for (let y = 1; y <= h; y++) {
            if (z === 0 && (x === 6 || x === 7) && y <= 2) continue;
            if (z === d - 1 && (x === 6 || x === 7) && y <= 2) continue;
            if ((z === 0 || z === d - 1) && (x === 3 || x === 10) && y === 2) continue;
            const mat = (y === 1) ? World.BLOCK_STONE : World.BLOCK_WOOD_PLANK;
            this.setBlock(bx + x, by + y, bz + z, mat);
          }
        }

        this.setBlock(bx + x, by + h + 1, bz + z, World.BLOCK_STONE);
      }
    }

    this.spawnGroundItem(bx + 3, by + 1.2, bz + 3, pick(MILITARY_GUNS), 60);
    this.spawnGroundItem(bx + 10, by + 1.2, bz + 3, 'ARMOR', 0);
    this.spawnGroundItem(bx + 2, by + 1.2, bz + 5, 'AMMO', 60);
    this.spawnGroundItem(bx + 11, by + 1.2, bz + 5, 'AMMO', 45);
    if (Math.random() < 0.6) this.spawnGroundItem(bx + 8, by + 1.2, bz + 2, 'GRENADE', 2);
    if (Math.random() < 0.5) this.spawnGroundItem(bx + 6, by + 1.2, bz + 3, Math.random() < 0.6 ? 'SCOPE4' : 'SCOPE2', 0);
  }

  // Warehouse / hangar (12x12)
  private buildWarehouse(bx: number, by: number, bz: number) {
    const w = 12;
    const d = 12;
    const h = 5;

    for (let x = 0; x < w; x++) {
      for (let z = 0; z < d; z++) {
        this.setBlock(bx + x, by, bz + z, World.BLOCK_STONE);

        if (x === 0 || x === w - 1 || z === 0 || z === d - 1) {
          for (let y = 1; y <= h; y++) {
            if (z === 0 && x >= 4 && x <= 7 && y <= 3) continue;
            if ((x === 0 || x === w - 1) && (z === 4 || z === 7) && y === 3) continue;
            this.setBlock(bx + x, by + y, bz + z, World.BLOCK_STONE);
          }
        }

        this.setBlock(bx + x, by + h + 1, bz + z, World.BLOCK_STONE);
      }
    }

    // Interior cover
    this.setBlock(bx + 3, by + 1, bz + 4, World.BLOCK_WOOD_PLANK);
    this.setBlock(bx + 3, by + 2, bz + 4, World.BLOCK_WOOD_PLANK);
    this.setBlock(bx + 8, by + 1, bz + 7, World.BLOCK_WOOD_PLANK);

    this.spawnGroundItem(bx + 5, by + 1.2, bz + 6, pick(['SHOTGUN', 'SMG', 'LMG', 'RIFLE']), 40);
    this.spawnGroundItem(bx + 8, by + 1.2, bz + 4, 'MEDKIT', 2);
    this.spawnGroundItem(bx + 2, by + 1.2, bz + 9, 'AMMO', 60);
    this.spawnGroundItem(bx + 9, by + 1.2, bz + 9, pick(['GRENADE', 'ARMOR', 'AMMO']), 2);
    if (Math.random() < 0.5) this.spawnGroundItem(bx + 6, by + 1.2, bz + 9, pick(['SCOPE2', 'SCOPE4']), 0);
  }

  // Watchtower with an external staircase up to the sniper platform
  private buildWatchtower(bx: number, by: number, bz: number) {
    const towerH = 10;
    for (let y = 0; y < towerH; y++) {
      this.setBlock(bx - 2, by + y, bz - 2, World.BLOCK_WOOD_LOG);
      this.setBlock(bx + 2, by + y, bz - 2, World.BLOCK_WOOD_LOG);
      this.setBlock(bx - 2, by + y, bz + 2, World.BLOCK_WOOD_LOG);
      this.setBlock(bx + 2, by + y, bz + 2, World.BLOCK_WOOD_LOG);
    }

    for (let x = -3; x <= 3; x++) {
      for (let z = -3; z <= 3; z++) {
        this.setBlock(bx + x, by + towerH, bz + z, World.BLOCK_WOOD_PLANK);

        // Railing (gap where the staircase arrives at x=+3, z=0..1)
        const isGap = x === 3 && (z === 0 || z === 1);
        if ((Math.abs(x) === 3 || Math.abs(z) === 3) && !isGap) {
          this.setBlock(bx + x, by + towerH + 1, bz + z, World.BLOCK_WOOD_LOG);
        }

        this.setBlock(bx + x, by + towerH + 4, bz + z, World.BLOCK_WOOD_PLANK);
      }
    }

    // Staircase (2 wide) rising 1 block per step toward the platform edge
    for (let k = 1; k <= towerH; k++) {
      const topY = by + towerH - k; // block Y of this step
      for (const dz of [0, 1]) {
        this.setBlock(bx + 3 + k, topY, bz + dz, World.BLOCK_WOOD_PLANK);
      }
    }

    this.spawnGroundItem(bx, by + towerH + 1.2, bz, Math.random() < 0.55 ? 'SNIPER' : 'DMR', 20);
    this.spawnGroundItem(bx - 1, by + towerH + 1.2, bz + 1, 'AMMO', 30);
    if (Math.random() < 0.6) this.spawnGroundItem(bx + 1, by + towerH + 1.2, bz + 1, Math.random() < 0.5 ? 'SCOPE8' : 'SCOPE4', 0);
  }

  // ---------- Loot ----------

  spawnGroundItem(x: number, y: number, z: number, type: LootItemType, ammoCount: number = 30) {
    if (type === 'AMMO' && ammoCount < 10) ammoCount = 30;
    const mesh = this.createItemModel(type);
    mesh.position.set(x, y, z);
    this.scene.add(mesh);

    const item: GroundItem = {
      id: this.nextItemId++,
      type,
      mesh,
      position: new THREE.Vector3(x, y, z),
      baseY: y,
      ammoCount,
      picked: false
    };

    this.groundItems.push(item);
    return item;
  }

  private createItemModel(type: LootItemType): THREE.Group {
    const group = new THREE.Group();

    const ringColors: { [key in LootItemType]: number } = {
      'PISTOL': 0x4ade80,
      'SHOTGUN': 0xf97316,
      'SMG': 0x2dd4bf,
      'RIFLE': 0x38bdf8,
      'LMG': 0x60a5fa,
      'DMR': 0xfbbf24,
      'SNIPER': 0xfacc15,
      'CROSSBOW': 0xa3e635,
      'GRENADE': 0x84cc16,
      'MEDKIT': 0xef4444,
      'ARMOR': 0x3b82f6,
      'AMMO': 0xfde047,
      'SCOPE2': 0xe879f9,
      'SCOPE4': 0xc084fc,
      'SCOPE8': 0xa855f7
    };
    const ringMat = new THREE.MeshBasicMaterial({
      color: ringColors[type],
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide
    });
    const ringMesh = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.45, 16), ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.y = -0.35;
    group.add(ringMesh);

    const beamGeo = new THREE.CylinderGeometry(0.04, 0.04, 5.0, 6);
    const beamMat = new THREE.MeshBasicMaterial({
      color: ringColors[type],
      transparent: true,
      opacity: 0.65
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.y = 2.2;
    group.add(beam);

    if (type === 'PISTOL') {
      const mat = new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.8 });
      const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.4), mat);
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 0.12), mat);
      grip.position.set(0, -0.12, 0.1);
      group.add(barrel, grip);
    } else if (type === 'SHOTGUN') {
      const wood = new THREE.MeshStandardMaterial({ color: 0x78350f });
      const metal = new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.8 });
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.35), wood);
      stock.position.set(0, -0.04, 0.2);
      const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.65), metal);
      barrel.position.set(0, 0.04, -0.2);
      group.add(stock, barrel);
    } else if (type === 'RIFLE') {
      const army = new THREE.MeshStandardMaterial({ color: 0x1e3a24, metalness: 0.5 });
      const metal = new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.8 });
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.55), army);
      const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.4), metal);
      barrel.position.set(0, 0.03, -0.4);
      const mag = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.25, 0.12), metal);
      mag.position.set(0, -0.14, -0.05);
      group.add(body, barrel, mag);
    } else if (type === 'SNIPER') {
      const green = new THREE.MeshStandardMaterial({ color: 0x2e3a1f });
      const metal = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8 });
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.7), green);
      const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.65), metal);
      barrel.position.set(0, 0.03, -0.6);
      const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.35, 8), metal);
      scope.rotation.x = Math.PI / 2;
      scope.position.set(0, 0.14, -0.05);
      group.add(body, barrel, scope);
    } else if (type === 'SMG') {
      const metal = new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.8 });
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.4), metal);
      const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.18), metal);
      barrel.position.set(0, 0.03, -0.28);
      const mag = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.28, 0.08), metal);
      mag.position.set(0, -0.18, -0.02);
      group.add(body, barrel, mag);
    } else if (type === 'LMG') {
      const tan = new THREE.MeshStandardMaterial({ color: 0x57534e, metalness: 0.5 });
      const metal = new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.8 });
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, 0.7), tan);
      const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.5), metal);
      barrel.position.set(0, 0.03, -0.55);
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.18, 0.18), metal);
      box.position.set(0, -0.16, -0.05);
      group.add(body, barrel, box);
    } else if (type === 'DMR') {
      const tan = new THREE.MeshStandardMaterial({ color: 0x8b6f47 });
      const metal = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8 });
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.65), tan);
      const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.5), metal);
      barrel.position.set(0, 0.03, -0.55);
      const mag = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.18, 0.1), metal);
      mag.position.set(0, -0.15, -0.05);
      group.add(body, barrel, mag);
    } else if (type === 'CROSSBOW') {
      const wood = new THREE.MeshStandardMaterial({ color: 0x92400e });
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.6), wood);
      const bow = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 0.06), wood);
      bow.position.set(0, 0.02, -0.25);
      group.add(stock, bow);
    } else if (type === 'GRENADE') {
      const green = new THREE.MeshStandardMaterial({ color: 0x3f6212, roughness: 0.6 });
      const metal = new THREE.MeshStandardMaterial({ color: 0x9ca3af, metalness: 0.8 });
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), green);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), metal);
      cap.position.y = 0.15;
      group.add(body, cap);
    } else if (type === 'MEDKIT') {
      const red = new THREE.MeshStandardMaterial({ color: 0xdc2626 });
      const white = new THREE.MeshStandardMaterial({ color: 0xffffff });
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.25, 0.18), red);
      const cH = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.19), white);
      const cV = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 0.19), white);
      group.add(box, cH, cV);
    } else if (type === 'ARMOR') {
      const blue = new THREE.MeshStandardMaterial({ color: 0x2563eb, metalness: 0.4 });
      const vest = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.4, 0.2), blue);
      group.add(vest);
    } else if (isScope(type)) {
      // Scope: black tube, longer for higher magnification, with a tinted lens
      const len = type === 'SCOPE2' ? 0.22 : type === 'SCOPE4' ? 0.32 : 0.42;
      const metal = new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.8 });
      const lensMat = new THREE.MeshBasicMaterial({ color: 0x67e8f9 });
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, len, 10), metal);
      tube.rotation.x = Math.PI / 2;
      const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.08, 10), metal);
      bell.rotation.x = Math.PI / 2;
      bell.position.z = -len / 2;
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.075, 12), lensMat);
      lens.position.z = -len / 2 - 0.041;
      lens.rotation.y = Math.PI;
      const mount = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.12), metal);
      mount.position.y = -0.07;
      group.add(tube, bell, lens, mount);
    } else {
      const gold = new THREE.MeshStandardMaterial({ color: 0xeab308, metalness: 0.6 });
      const ammoBox = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.2, 0.2), gold);
      group.add(ammoBox);
    }

    return group;
  }

  spawnDeathCrate(pos: THREE.Vector3, victimName: string, weaponType: LootItemType, ammoCount: number, medkits: number, hasArmor: boolean) {
    const group = new THREE.Group();

    const crateSide = TextureGenerator.getCrateSide();
    const crateTop = TextureGenerator.getCrateTop();
    const boxMat = [
      new THREE.MeshLambertMaterial({ map: crateSide }),
      new THREE.MeshLambertMaterial({ map: crateSide }),
      new THREE.MeshLambertMaterial({ map: crateTop }),
      new THREE.MeshLambertMaterial({ map: crateSide }),
      new THREE.MeshLambertMaterial({ map: crateSide }),
      new THREE.MeshLambertMaterial({ map: crateSide })
    ];
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.65, 0.85), boxMat);
    box.position.y = 0.33;
    box.castShadow = true;
    group.add(box);

    const beamGeo = new THREE.CylinderGeometry(0.08, 0.08, 8, 8);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0.55
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.y = 4.3;
    group.add(beam);

    group.position.copy(pos);
    this.scene.add(group);

    const deathCrate: DeathCrate = {
      id: this.deathCrates.length,
      victimName,
      mesh: group,
      position: pos.clone(),
      weapons: [weaponType],
      ammoCount: Math.max(30, ammoCount),
      medkitCount: medkits,
      hasArmor,
      opened: false
    };

    this.deathCrates.push(deathCrate);
    return deathCrate;
  }

  private spawnLootCrates() {
    const crateSide = TextureGenerator.getCrateSide();
    const crateTop = TextureGenerator.getCrateTop();
    const crateMat = [
      new THREE.MeshLambertMaterial({ map: crateSide }),
      new THREE.MeshLambertMaterial({ map: crateSide }),
      new THREE.MeshLambertMaterial({ map: crateTop }),
      new THREE.MeshLambertMaterial({ map: crateSide }),
      new THREE.MeshLambertMaterial({ map: crateSide }),
      new THREE.MeshLambertMaterial({ map: crateSide })
    ];
    const crateGeo = new THREE.BoxGeometry(0.9, 0.9, 0.9);

    const lootPool: Array<LootCrate['lootType']> = [
      'RIFLE', 'SHOTGUN', 'SNIPER', 'SMG', 'MEDKIT', 'ARMOR',
      'LMG', 'DMR', 'MEDKIT', 'ARMOR', 'GRENADE', 'SNIPER',
      'RIFLE', 'DMR', 'MEDKIT', 'ARMOR', 'SHOTGUN', 'SMG',
      'SCOPE4', 'SCOPE8', 'SCOPE4', 'GRENADE', 'LMG'
    ];

    // One supply crate just outside each structure (on its flattened margin)
    this.structures.forEach((s, idx) => {
      const fp = FOOTPRINTS[s.type];
      const cx = s.x + fp.x0 - 1;
      const cz = s.z + fp.z0 - 1;
      const top = this.getSurfaceHeight(cx, cz);
      if (top < 5) return;

      const mesh = new THREE.Mesh(crateGeo, crateMat);
      mesh.position.set(cx + 0.5, top + 0.45, cz + 0.5);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);

      this.crates.push({
        id: idx,
        mesh,
        position: mesh.position.clone(),
        opened: false,
        lootType: lootPool[idx % lootPool.length]
      });
    });
  }

  // Loose loot lying in the village streets (ammo, meds, grenades, the odd gun)
  private spawnStreetLoot() {
    const pool: LootItemType[] = ['AMMO', 'AMMO', 'AMMO', 'MEDKIT', 'GRENADE', 'ARMOR', 'PISTOL', 'SMG', 'SHOTGUN', 'SCOPE2'];
    for (const town of TOWNS) {
      const want = Math.round(town.r / 3);
      let placed = 0;
      for (let tries = 0; tries < 400 && placed < want; tries++) {
        const a = Math.random() * Math.PI * 2;
        const d = Math.random() * town.r;
        const x = Math.round(town.x + Math.cos(a) * d);
        const z = Math.round(town.z + Math.sin(a) * d);
        if (!this.inBounds(x, z) || !this.road[this.colIndex(x, z)]) continue;
        const top = this.getSurfaceHeight(x, z);
        if (top !== this.h(x, z) + 1 || top < 5) continue; // nothing built on top
        const type = pick(pool);
        this.spawnGroundItem(x + 0.5, top + 0.7, z + 0.5, type, type === 'GRENADE' ? 1 : 30);
        placed++;
      }
    }
  }

  // Top-down colour map of the island (1 px = 2 blocks) for the minimap
  private buildMapImage() {
    if (typeof document === 'undefined') return;
    const step = 2;
    const size = Math.floor(this.gridSize / step);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = ctx.createImageData(size, size);
    const H = World.MAX_HEIGHT;

    for (let px = 0; px < size; px++) {
      for (let pz = 0; pz < size; pz++) {
        const x = -this.half + px * step;
        const z = -this.half + pz * step;
        const base = this.colIndex(x, z) * H;
        let y = H - 1;
        while (y > 0 && this.grid[base + y] === World.BLOCK_AIR) y--;
        const type = this.grid[base + y];

        let r: number, g: number, b: number;
        if (y < 4) {
          // Water: lighter over the shallows
          const depth = Math.min(1, -this.coastDist[this.colIndex(x, z)] / 14);
          r = 40 - depth * 20; g = 110 - depth * 50; b = 190 - depth * 40;
        } else if (type === World.BLOCK_SAND) {
          r = 214; g = 196; b = 128;
        } else if (type === World.BLOCK_WOOD_PLANK || type === World.BLOCK_WOOD_LOG) {
          r = 150; g = 105; b = 60;
        } else if (type === World.BLOCK_STONE || type === World.BLOCK_IRON_ORE) {
          r = 130; g = 130; b = 130;
        } else if (type === World.BLOCK_GRAVEL) {
          r = 168; g = 160; b = 148;
        } else if (type === World.BLOCK_LEAVES) {
          r = 38; g = 96; b = 40;
        } else {
          // Grass, shaded by altitude
          const t = Math.min(1, (y - 5) / 30);
          r = 70 + t * 60; g = 140 - t * 20; b = 60 + t * 30;
        }
        const i = (pz * size + px) * 4;
        img.data[i] = r;
        img.data[i + 1] = g;
        img.data[i + 2] = b;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    this.mapImage = canvas;
  }

  // Restore terrain and loot for a new match
  resetWorld() {
    if (this.initialGrid) {
      this.grid.set(this.initialGrid);
      this.rebuildAllChunks();
    }
    for (const item of this.groundItems) {
      item.picked = false;
      item.mesh.visible = true;
    }
    for (const dc of this.deathCrates) {
      this.scene.remove(dc.mesh);
    }
    this.deathCrates = [];
    for (const c of this.crates) {
      c.opened = false;
      c.mesh.scale.set(1, 1, 1);
    }
  }

  update(delta: number) {
    const time = performance.now() * 0.003;
    for (const item of this.groundItems) {
      if (item.picked) continue;
      item.mesh.rotation.y += delta * 1.6;
      item.mesh.position.y = item.baseY + Math.sin(time + item.id * 0.5) * 0.08;
    }
    this.flushDirtyChunks();
  }

  // ---------- Chunk meshing ----------

  private chunkKey(cx: number, cz: number) {
    return `${cx},${cz}`;
  }

  private markDirty(x: number, z: number) {
    const C = World.CHUNK;
    const lx = x + this.half;
    const lz = z + this.half;
    const cx = Math.floor(lx / C);
    const cz = Math.floor(lz / C);
    this.dirtyChunks.add(this.chunkKey(cx, cz));
    // Neighbouring chunk faces may become visible too
    if (lx % C === 0) this.dirtyChunks.add(this.chunkKey(cx - 1, cz));
    if (lx % C === C - 1) this.dirtyChunks.add(this.chunkKey(cx + 1, cz));
    if (lz % C === 0) this.dirtyChunks.add(this.chunkKey(cx, cz - 1));
    if (lz % C === C - 1) this.dirtyChunks.add(this.chunkKey(cx, cz + 1));
  }

  private flushDirtyChunks() {
    if (this.dirtyChunks.size === 0) return;
    for (const key of this.dirtyChunks) {
      const [cx, cz] = key.split(',').map(Number);
      this.buildChunk(cx, cz);
    }
    this.dirtyChunks.clear();
  }

  private rebuildAllChunks() {
    const n = Math.ceil(this.gridSize / World.CHUNK);
    for (let cx = 0; cx < n; cx++) {
      for (let cz = 0; cz < n; cz++) {
        this.buildChunk(cx, cz);
      }
    }
    this.dirtyChunks.clear();
  }

  private buildChunk(cx: number, cz: number) {
    const C = World.CHUNK;
    const H = World.MAX_HEIGHT;
    const key = this.chunkKey(cx, cz);
    const n = Math.ceil(this.gridSize / C);
    if (cx < 0 || cz < 0 || cx >= n || cz >= n) return;

    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];

    const x0 = cx * C - this.half;
    const z0 = cz * C - this.half;
    const tileW = 1 / ATLAS_TILES;

    for (let x = x0; x < x0 + C; x++) {
      for (let z = z0; z < z0 + C; z++) {
        if (!this.inBounds(x, z)) continue;
        const base = this.colIndex(x, z) * H;
        for (let y = 0; y < H; y++) {
          const type = this.grid[base + y];
          if (type === World.BLOCK_AIR) continue;

          for (let f = 0; f < 6; f++) {
            const face = FACES[f];
            const nx = x + face.dir[0];
            const ny = y + face.dir[1];
            const nz = z + face.dir[2];
            if (ny < 0) continue; // never visible from below the world
            if (this.getBlock(nx, ny, nz) !== World.BLOCK_AIR) continue;

            const tile = this.tileFor(type, f);
            const ndx = positions.length / 3;
            const shade = face.shade;
            for (let c = 0; c < 4; c++) {
              const corner = face.corners[c];
              positions.push(x + corner[0], y + corner[1], z + corner[2]);
              normals.push(face.dir[0], face.dir[1], face.dir[2]);
              const u = Math.min(0.999, Math.max(0.001, face.uvs[c][0]));
              uvs.push((tile + u) * tileW, face.uvs[c][1]);
              colors.push(shade, shade, shade);
            }
            indices.push(ndx, ndx + 1, ndx + 2, ndx + 2, ndx + 1, ndx + 3);
          }
        }
      }
    }

    const old = this.chunkMeshes.get(key);
    if (old) {
      this.scene.remove(old);
      old.geometry.dispose();
      this.chunkMeshes.delete(key);
    }
    if (indices.length === 0) return;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);
    geo.computeBoundingSphere();

    const mesh = new THREE.Mesh(geo, this.blockMaterial);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    this.chunkMeshes.set(key, mesh);
  }

  private tileFor(type: number, faceIndex: number): number {
    switch (type) {
      case World.BLOCK_GRASS:
        if (faceIndex === 3) return TILE_GRASS_TOP;
        if (faceIndex === 2) return TILE_DIRT;
        return TILE_GRASS_SIDE;
      case World.BLOCK_DIRT: return TILE_DIRT;
      case World.BLOCK_STONE: return TILE_STONE;
      case World.BLOCK_WOOD_PLANK: return TILE_PLANK;
      case World.BLOCK_WOOD_LOG: return TILE_LOG;
      case World.BLOCK_LEAVES: return TILE_LEAVES;
      case World.BLOCK_SAND: return TILE_SAND;
      case World.BLOCK_GRAVEL: return TILE_GRAVEL;
      case World.BLOCK_IRON_ORE: return TILE_IRON_ORE;
      default: return TILE_STONE;
    }
  }

  // ---------- Queries & physics ----------

  // Y of the top surface of the highest block in this column (roofs, treetops included)
  getSurfaceHeight(x: number, z: number): number {
    const ix = Math.floor(x);
    const iz = Math.floor(z);
    if (!this.inBounds(ix, iz)) return 0;
    const base = this.colIndex(ix, iz) * World.MAX_HEIGHT;
    for (let y = World.MAX_HEIGHT - 1; y >= 0; y--) {
      if (this.grid[base + y] !== World.BLOCK_AIR) return y + 1;
    }
    return 0;
  }

  // Does an axis-aligned box (feet center at x,y,z) overlap any solid block?
  collidesBox(x: number, y: number, z: number, radius: number, height: number): boolean {
    const eps = 1e-4;
    const minX = Math.floor(x - radius);
    const maxX = Math.floor(x + radius - eps);
    const minY = Math.floor(y + eps);
    const maxY = Math.floor(y + height - eps);
    const minZ = Math.floor(z - radius);
    const maxZ = Math.floor(z + radius - eps);
    for (let bx = minX; bx <= maxX; bx++) {
      for (let bz = minZ; bz <= maxZ; bz++) {
        for (let by = minY; by <= maxY; by++) {
          if (this.getBlock(bx, by, bz) !== World.BLOCK_AIR) return true;
        }
      }
    }
    return false;
  }

  // Move horizontally with wall collision and automatic step-up. Returns false if fully blocked.
  moveHorizontal(pos: THREE.Vector3, dx: number, dz: number, radius: number, height: number, maxStep: number): boolean {
    let moved = false;
    const tryAxis = (ax: number, az: number): boolean => {
      if (ax === 0 && az === 0) return true;
      const nx = pos.x + ax;
      const nz = pos.z + az;
      if (!this.collidesBox(nx, pos.y, nz, radius, height)) {
        pos.x = nx;
        pos.z = nz;
        return true;
      }
      if (maxStep > 0) {
        for (let ty = Math.floor(pos.y + 1e-3) + 1; ty - pos.y <= maxStep + 1e-6; ty++) {
          if (!this.collidesBox(nx, ty, nz, radius, height) && !this.collidesBox(pos.x, ty, pos.z, radius, height)) {
            pos.x = nx;
            pos.z = nz;
            pos.y = ty;
            return true;
          }
        }
      }
      return false;
    };
    // Resolve each axis separately so entities slide along walls
    if (tryAxis(dx, 0)) moved = moved || dx !== 0;
    if (tryAxis(0, dz)) moved = moved || dz !== 0;
    return moved;
  }

  // Apply vertical velocity with floor/ceiling collision. Returns true when standing on ground.
  moveVertical(pos: THREE.Vector3, velocity: THREE.Vector3, delta: number, radius: number, height: number): boolean {
    let remaining = velocity.y * delta;
    let onGround = false;
    while (Math.abs(remaining) > 1e-6) {
      const step = Math.max(-0.45, Math.min(0.45, remaining));
      const ny = pos.y + step;
      if (this.collidesBox(pos.x, ny, pos.z, radius, height)) {
        if (step < 0) {
          const landY = Math.floor(ny) + 1;
          if (landY <= pos.y + 1e-6) pos.y = landY;
          onGround = true;
        }
        velocity.y = 0;
        break;
      }
      pos.y = ny;
      remaining -= step;
    }
    if (!onGround && velocity.y <= 0) {
      onGround = this.collidesBox(pos.x, pos.y - 0.05, pos.z, radius, 0.05);
    }
    return onGround;
  }

  // Push an entity up out of blocks it ended up inside (e.g. a block placed on it)
  unstick(pos: THREE.Vector3, radius: number, height: number) {
    for (let i = 0; i < 4 && this.collidesBox(pos.x, pos.y, pos.z, radius, height); i++) {
      pos.y = Math.floor(pos.y) + 1;
    }
  }

  breakBlock(x: number, y: number, z: number, silent: boolean = false): boolean {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const iz = Math.floor(z);
    if (iy <= 0) return false; // keep a floor under the ocean
    if (this.hasBlock(ix, iy, iz)) {
      this.setBlock(ix, iy, iz, World.BLOCK_AIR);
      this.flushDirtyChunks();
      if (!silent) sounds.playBlockBreak();
      return true;
    }
    return false;
  }

  placeBlock(x: number, y: number, z: number, type: number = World.BLOCK_WOOD_PLANK): boolean {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const iz = Math.floor(z);
    if (iy < 0 || iy >= World.MAX_HEIGHT || !this.inBounds(ix, iz)) return false;

    if (!this.hasBlock(ix, iy, iz)) {
      this.setBlock(ix, iy, iz, type);
      this.flushDirtyChunks();
      sounds.playBlockPlace();
      return true;
    }
    return false;
  }

  raycastBlock(origin: THREE.Vector3, direction: THREE.Vector3, maxDistance: number, step: number = 0.05): {
    hit: boolean;
    blockPos: THREE.Vector3;
    placePos: THREE.Vector3;
    distance: number;
  } | null {
    let px = Math.floor(origin.x);
    let py = Math.floor(origin.y);
    let pz = Math.floor(origin.z);

    for (let d = step; d <= maxDistance; d += step) {
      const cx = origin.x + direction.x * d;
      const cy = origin.y + direction.y * d;
      const cz = origin.z + direction.z * d;
      const bx = Math.floor(cx);
      const by = Math.floor(cy);
      const bz = Math.floor(cz);
      if (bx === px && by === py && bz === pz) continue;

      if (this.hasBlock(bx, by, bz)) {
        return {
          hit: true,
          blockPos: new THREE.Vector3(bx, by, bz),
          placePos: new THREE.Vector3(px, py, pz),
          distance: d
        };
      }
      px = bx;
      py = by;
      pz = bz;
    }
    return null;
  }

  hasLineOfSight(from: THREE.Vector3, to: THREE.Vector3): boolean {
    const dir = new THREE.Vector3().subVectors(to, from);
    const dist = dir.length();
    if (dist < 0.01) return true;
    dir.divideScalar(dist);
    const hit = this.raycastBlock(from, dir, dist, 0.25);
    return !hit;
  }
}
