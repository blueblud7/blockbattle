import * as THREE from 'three';

export class TextureGenerator {
  private static cache: Map<string, THREE.CanvasTexture> = new Map();

  private static createPixelCanvas(size: number = 16): [HTMLCanvasElement, CanvasRenderingContext2D] {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    return [canvas, ctx];
  }

  private static makeTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  // Grass Top (16x16 Minecraft style green)
  static getGrassTop(): THREE.CanvasTexture {
    if (this.cache.has('grass_top')) return this.cache.get('grass_top')!;
    const [canvas, ctx] = this.createPixelCanvas(16);

    const baseGreen = [74, 150, 44];
    for (let x = 0; x < 16; x++) {
      for (let y = 0; y < 16; y++) {
        const noise = (Math.random() - 0.5) * 30;
        const r = Math.min(255, Math.max(0, Math.floor(baseGreen[0] + noise * 0.8)));
        const g = Math.min(255, Math.max(0, Math.floor(baseGreen[1] + noise)));
        const b = Math.min(255, Math.max(0, Math.floor(baseGreen[2] + noise * 0.5)));
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }

    const tex = this.makeTexture(canvas);
    this.cache.set('grass_top', tex);
    return tex;
  }

  // Grass Side (Green rim on top, Dirt on bottom)
  static getGrassSide(): THREE.CanvasTexture {
    if (this.cache.has('grass_side')) return this.cache.get('grass_side')!;
    const [canvas, ctx] = this.createPixelCanvas(16);

    // Dirt base
    const dirtColor = [134, 96, 67];
    for (let x = 0; x < 16; x++) {
      for (let y = 0; y < 16; y++) {
        const noise = (Math.random() - 0.5) * 35;
        const r = Math.min(255, Math.max(0, Math.floor(dirtColor[0] + noise)));
        const g = Math.min(255, Math.max(0, Math.floor(dirtColor[1] + noise * 0.8)));
        const b = Math.min(255, Math.max(0, Math.floor(dirtColor[2] + noise * 0.6)));
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }

    // Grass overhang (top 3-5 pixels with irregular drops)
    const baseGreen = [74, 150, 44];
    for (let x = 0; x < 16; x++) {
      const drop = Math.floor(Math.random() * 2) + 3;
      for (let y = 0; y < drop; y++) {
        const noise = (Math.random() - 0.5) * 30;
        const r = Math.min(255, Math.max(0, Math.floor(baseGreen[0] + noise * 0.8)));
        const g = Math.min(255, Math.max(0, Math.floor(baseGreen[1] + noise)));
        const b = Math.min(255, Math.max(0, Math.floor(baseGreen[2] + noise * 0.5)));
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }

    const tex = this.makeTexture(canvas);
    this.cache.set('grass_side', tex);
    return tex;
  }

  // Dirt
  static getDirt(): THREE.CanvasTexture {
    if (this.cache.has('dirt')) return this.cache.get('dirt')!;
    const [canvas, ctx] = this.createPixelCanvas(16);
    const dirtColor = [134, 96, 67];

    for (let x = 0; x < 16; x++) {
      for (let y = 0; y < 16; y++) {
        const noise = (Math.random() - 0.5) * 40;
        const r = Math.min(255, Math.max(0, Math.floor(dirtColor[0] + noise)));
        const g = Math.min(255, Math.max(0, Math.floor(dirtColor[1] + noise * 0.8)));
        const b = Math.min(255, Math.max(0, Math.floor(dirtColor[2] + noise * 0.6)));
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }

    const tex = this.makeTexture(canvas);
    this.cache.set('dirt', tex);
    return tex;
  }

  // Stone
  static getStone(): THREE.CanvasTexture {
    if (this.cache.has('stone')) return this.cache.get('stone')!;
    const [canvas, ctx] = this.createPixelCanvas(16);

    for (let x = 0; x < 16; x++) {
      for (let y = 0; y < 16; y++) {
        const val = Math.floor(115 + (Math.random() - 0.5) * 40);
        ctx.fillStyle = `rgb(${val},${val},${val})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }

    const tex = this.makeTexture(canvas);
    this.cache.set('stone', tex);
    return tex;
  }

  // Wood Planks
  static getWoodPlanks(): THREE.CanvasTexture {
    if (this.cache.has('wood_planks')) return this.cache.get('wood_planks')!;
    const [canvas, ctx] = this.createPixelCanvas(16);

    ctx.fillStyle = '#b88746';
    ctx.fillRect(0, 0, 16, 16);

    for (let y = 0; y < 16; y += 4) {
      ctx.fillStyle = '#785226';
      ctx.fillRect(0, y, 16, 1);
      for (let x = 0; x < 16; x++) {
        if (Math.random() > 0.4) {
          const shade = Math.floor(Math.random() * 20 - 10);
          ctx.fillStyle = `rgb(${184 + shade}, ${135 + shade}, ${70 + shade})`;
          ctx.fillRect(x, y + 1 + Math.floor(Math.random() * 3), 1, 1);
        }
      }
    }

    const tex = this.makeTexture(canvas);
    this.cache.set('wood_planks', tex);
    return tex;
  }

  // Leaves
  static getLeaves(): THREE.CanvasTexture {
    if (this.cache.has('leaves')) return this.cache.get('leaves')!;
    const [canvas, ctx] = this.createPixelCanvas(16);

    for (let x = 0; x < 16; x++) {
      for (let y = 0; y < 16; y++) {
        const isDark = Math.random() > 0.5;
        const g = isDark ? 95 + Math.floor(Math.random() * 20) : 130 + Math.floor(Math.random() * 30);
        const r = Math.floor(g * 0.3);
        const b = Math.floor(g * 0.2);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }

    const tex = this.makeTexture(canvas);
    this.cache.set('leaves', tex);
    return tex;
  }

  // Wood Log
  static getWoodLog(): THREE.CanvasTexture {
    if (this.cache.has('wood_log')) return this.cache.get('wood_log')!;
    const [canvas, ctx] = this.createPixelCanvas(16);

    for (let x = 0; x < 16; x++) {
      for (let y = 0; y < 16; y++) {
        const streak = Math.sin(x * 0.8) * 15;
        const noise = (Math.random() - 0.5) * 20;
        const val = Math.floor(90 + streak + noise);
        ctx.fillStyle = `rgb(${val}, ${Math.floor(val * 0.7)}, ${Math.floor(val * 0.4)})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }

    const tex = this.makeTexture(canvas);
    this.cache.set('wood_log', tex);
    return tex;
  }

  // Sand
  static getSand(): THREE.CanvasTexture {
    if (this.cache.has('sand')) return this.cache.get('sand')!;
    const [canvas, ctx] = this.createPixelCanvas(16);

    for (let x = 0; x < 16; x++) {
      for (let y = 0; y < 16; y++) {
        const noise = (Math.random() - 0.5) * 25;
        const r = Math.floor(220 + noise);
        const g = Math.floor(205 + noise);
        const b = Math.floor(150 + noise);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }

    const tex = this.makeTexture(canvas);
    this.cache.set('sand', tex);
    return tex;
  }

  // Loot Crate Side (Wooden Military Supply Crate)
  static getCrateSide(): THREE.CanvasTexture {
    if (this.cache.has('crate_side')) return this.cache.get('crate_side')!;
    const [canvas, ctx] = this.createPixelCanvas(16);

    // Base wood
    ctx.fillStyle = '#b45309';
    ctx.fillRect(0, 0, 16, 16);

    // Outer metal/wood border
    ctx.fillStyle = '#78350f';
    ctx.strokeRect(0.5, 0.5, 15, 15);

    // Diagonal Cross Brace
    ctx.strokeStyle = '#92400e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(1, 1);
    ctx.lineTo(15, 15);
    ctx.moveTo(1, 15);
    ctx.lineTo(15, 1);
    ctx.stroke();

    // Corner bolts
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(1, 1, 2, 2);
    ctx.fillRect(13, 1, 2, 2);
    ctx.fillRect(1, 13, 2, 2);
    ctx.fillRect(13, 13, 2, 2);

    const tex = this.makeTexture(canvas);
    this.cache.set('crate_side', tex);
    return tex;
  }

  // Loot Crate Top (Red Airdrop Tarp)
  static getCrateTop(): THREE.CanvasTexture {
    if (this.cache.has('crate_top')) return this.cache.get('crate_top')!;
    const [canvas, ctx] = this.createPixelCanvas(16);

    // Red Airdrop cloth
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(0, 0, 16, 16);

    // Yellow straps
    ctx.fillStyle = '#facc15';
    ctx.fillRect(7, 0, 2, 16);
    ctx.fillRect(0, 7, 16, 2);

    // Dark border
    ctx.fillStyle = '#991b1b';
    ctx.strokeRect(0.5, 0.5, 15, 15);

    const tex = this.makeTexture(canvas);
    this.cache.set('crate_top', tex);
    return tex;
  }
}
