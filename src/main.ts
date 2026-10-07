import { initAnalytics, trackMatchStart, trackMatchEnd } from './analytics';
import * as THREE from 'three';
import { World } from './world/World';
import { Player, SRC_ZONE } from './entities/Player';
import { CraftingUI } from './ui/CraftingUI';
import { t, applyDom, setLang, botNames, Lang } from './i18n';
import { Bot } from './entities/Bot';
import { CargoPlane } from './entities/CargoPlane';
import { ZoneManager } from './zone/ZoneManager';
import { HUD } from './ui/HUD';
import { sounds } from './audio/SoundManager';

class Game {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;

  cargoPlane: CargoPlane;
  world: World;
  player: Player;
  zone: ZoneManager;
  hud: HUD;

  bots: Bot[] = [];
  crafting: CraftingUI;
  grenades: { mesh: THREE.Mesh; vel: THREE.Vector3; fuse: number }[] = [];

  // Visual Tracers & Particles
  tracers: { mesh: THREE.Line; age: number; maxAge: number }[] = [];
  particles: { mesh: THREE.Mesh; vel: THREE.Vector3; age: number; maxAge: number }[] = [];

  // Match State
  canvas: HTMLCanvasElement;
  totalPlayers: number = 20;
  aliveCount: number = 20;
  isGameActive: boolean = false;
  clock: THREE.Clock = new THREE.Clock();
  sunLight: THREE.DirectionalLight;
  private matchOver: boolean = false;

  constructor() {
    this.canvas = document.getElementById('game-canvas') as HTMLCanvasElement;

    // WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Scene & Atmosphere
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x7ec0ee); // Minecraft Sky Blue
    this.scene.fog = new THREE.FogExp2(0x7ec0ee, 0.0022);

    // Camera
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1500);
    this.scene.add(this.camera);

    // Lighting
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.7);
    this.scene.add(hemiLight);

    // Sun shadow box follows the camera (see updateSun) so the big map keeps crisp shadows
    const sunLight = new THREE.DirectionalLight(0xfff5e6, 1.2);
    sunLight.position.set(120, 240, 90);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 500;
    sunLight.shadow.bias = -0.0005;
    const shadowDist = 90;
    sunLight.shadow.camera.left = -shadowDist;
    sunLight.shadow.camera.right = shadowDist;
    sunLight.shadow.camera.top = shadowDist;
    sunLight.shadow.camera.bottom = -shadowDist;
    this.scene.add(sunLight);
    this.scene.add(sunLight.target);
    this.sunLight = sunLight;

    // Initialize systems
    this.cargoPlane = new CargoPlane(this.scene);
    this.world = new World(this.scene);
    this.zone = new ZoneManager(this.scene);
    this.zone.isLand = (x, z) => this.world.isLand(x, z);
    this.player = new Player(this.camera, this.world);
    this.player.weapons.resetInventory();
    this.player.weapons.selectWeapon('PICKAXE'); // Start unarmed with pickaxe!
    this.hud = new HUD(this.player, this.zone, this.world);
    this.crafting = new CraftingUI(
      () => this.player,
      () => this.isGameActive && this.player.isAlive && !this.player.inPlane && !this.player.isAirborne,
      () => this.requestLock()
    );

    this.setupEvents();
    this.initBots();

    // Start render loop
    requestAnimationFrame(this.loop.bind(this));
  }

  private initBots() {
    // Clear existing bots
    this.bots.forEach(b => this.scene.remove(b.mesh));
    this.bots = [];

    // Initialize 19 bots aboard the Cargo Plane
    for (let i = 0; i < 19; i++) {
      const names = botNames();
      const name = names[i % names.length];
      const bot = new Bot(i, name, this.scene, this.world, this.cargoPlane.getPosition());
      bot.inPlane = true;
      bot.mesh.visible = false;
      this.bots.push(bot);
    }

    this.aliveCount = 20;
  }

  private setupEvents() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    const startModal = document.getElementById('start-screen')!;
    const btnStart = document.getElementById('btn-start')!;
    const btnRestartWin = document.getElementById('btn-restart-win')!;
    const btnRestartLose = document.getElementById('btn-restart-lose')!;

    const requestLock = () => this.requestLock();
    const startGameAction = (isRestart: boolean = false) => {
      startModal.style.display = 'none';
      // Bot names follow the chosen language
      const names = botNames();
      this.bots.forEach((b, i) => { b.name = names[i % names.length]; });
      document.getElementById('victory-screen')!.style.display = 'none';
      document.getElementById('gameover-screen')!.style.display = 'none';

      this.launchPlane();

      // Put player on the plane
      this.player.inPlane = true;
      this.player.isAirborne = false;
      this.player.isParachuteOpen = false;
      this.player.position.copy(this.cargoPlane.getPosition());
      this.player.planeYaw = this.cargoPlane.yaw;
      this.player.yaw = this.cargoPlane.yaw + Math.PI;
      this.player.pitch = -0.15;
      this.player.weapons.resetInventory();
      this.player.weapons.selectWeapon('PICKAXE');

      // Put all bots on the plane; they jump at random moments while it's over the island
      const [t0, t1] = this.cargoPlane.getTimeWindowOver(this.world.half * 0.7);
      this.bots.forEach((bot) => {
        bot.inPlane = true;
        bot.isParachuting = false;
        bot.hasWeapon = false;
        bot.gunMesh.visible = false;
        bot.mesh.visible = false;
        bot.ejectTimer = t0 + Math.random() * (t1 - t0);
      });

      this.isGameActive = true;
      this.matchOver = false;
      trackMatchStart(isRestart);
      requestLock();
    };

    btnStart.addEventListener('click', () => startGameAction(false));
    document.querySelectorAll<HTMLElement>('[data-lang]').forEach(btn => {
      btn.addEventListener('click', () => setLang(btn.dataset.lang as Lang));
    });
    btnRestartWin.addEventListener('click', () => {
      this.restartMatch();
      startGameAction(true);
    });
    btnRestartLose.addEventListener('click', () => {
      this.restartMatch();
      startGameAction(true);
    });

    // Also lock pointer when clicking canvas during active game
    this.canvas.addEventListener('click', () => {
      if (this.crafting.isOpen) return;
      if (this.isGameActive && document.pointerLockElement !== this.canvas && document.pointerLockElement !== document.body) {
        requestLock();
      }
    });

    let isMouseDown = false;
    let lastX = 0;
    let lastY = 0;

    // Universal Mouse Look (Pointer Lock + Window tracking fallback)
    window.addEventListener('mousemove', (e) => {
      if (!this.isGameActive || this.crafting.isOpen) return;

      const isLocked = (document.pointerLockElement === this.canvas || document.pointerLockElement === document.body);

      let deltaX = 0;
      let deltaY = 0;

      if (isLocked) {
        deltaX = e.movementX;
        deltaY = e.movementY;
      } else {
        deltaX = e.movementX || (lastX ? e.clientX - lastX : 0);
        deltaY = e.movementY || (lastY ? e.clientY - lastY : 0);
      }

      lastX = e.clientX;
      lastY = e.clientY;

      if (Math.abs(deltaX) > 120 || Math.abs(deltaY) > 120) return;

      // Slower look while zoomed in so scopes stay controllable
      const sensitivity = 0.0024 * (this.camera.fov / 75);
      this.player.yaw -= deltaX * sensitivity;
      this.player.pitch -= deltaY * sensitivity;

      // Clamp pitch
      const maxPitch = Math.PI / 2 - 0.05;
      this.player.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.player.pitch));
    });

    // Mouse Clicks
    window.addEventListener('mousedown', (e) => {
      if (this.crafting.isOpen) return;
      isMouseDown = true;
      lastX = e.clientX;
      lastY = e.clientY;

      if (this.isGameActive && document.pointerLockElement !== this.canvas && document.pointerLockElement !== document.body) {
        requestLock();
      }

      if (e.button === 0) {
        this.player.isMouseDown = true;
        if (this.player.weapons.activeType === 'BLOCK') {
          this.handleBlockAction(true);
        }
      } else if (e.button === 2) {
        this.player.isRightMouseDown = true;
        if (this.player.weapons.activeType === 'BLOCK') {
          this.handleBlockAction(true);
        }
      }
    });

    window.addEventListener('mouseup', (e) => {
      isMouseDown = false;
      if (e.button === 0) {
        this.player.isMouseDown = false;
      } else if (e.button === 2) {
        this.player.isRightMouseDown = false;
      }
    });

    // Prevent context menu
    window.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // Random flight path across the island each match
  private launchPlane() {
    const angle = Math.random() * Math.PI * 2;
    const R = this.world.half + 70;
    const offset = (Math.random() - 0.5) * this.world.half * 0.6;
    const dir = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const perp = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(offset);
    const start = dir.clone().multiplyScalar(-R).add(perp).setY(140);
    const end = dir.clone().multiplyScalar(R).add(perp).setY(140);
    this.cargoPlane.reset(start, end);
  }

  private handleBlockAction(isPlace: boolean) {
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    const ray = this.world.raycastBlock(this.camera.position, dir, 5.0);

    if (ray && ray.hit) {
      if (isPlace) {
        const p = ray.placePos;
        // Don't build a block inside your own body
        const pp = this.player.position;
        const overlapsPlayer =
          p.x + 1 > pp.x - Player.RADIUS && p.x < pp.x + Player.RADIUS &&
          p.z + 1 > pp.z - Player.RADIUS && p.z < pp.z + Player.RADIUS &&
          p.y + 1 > pp.y && p.y < pp.y + this.player.height;
        if (!overlapsPlayer && this.player.weapons.weapons.get('BLOCK')!.currentAmmo > 0) {
          if (this.world.placeBlock(ray.placePos.x, ray.placePos.y, ray.placePos.z, World.BLOCK_WOOD_PLANK)) {
            this.player.weapons.consumeAmmo();
          }
        }
      }
    }
  }

  // Combat: Player shoots
  private onPlayerShoot = (origin: THREE.Vector3, dir: THREE.Vector3, damage: number, spread: number) => {
    // Add spread
    const finalDir = dir.clone();
    if (spread > 0) {
      finalDir.x += (Math.random() - 0.5) * spread;
      finalDir.y += (Math.random() - 0.5) * spread;
      finalDir.z += (Math.random() - 0.5) * spread;
      finalDir.normalize();
    }

    const range = this.player.weapons.getActiveWeapon().range;
    let hitPoint = origin.clone().addScaledVector(finalDir, range);

    // Walls stop bullets: bots are only hittable in front of the first block on the ray
    const blockRay = this.world.raycastBlock(origin, finalDir, range);

    // 1. Raycast against Bots
    let closestBot: Bot | null = null;
    let closestBotDist = blockRay ? blockRay.distance : range;

    const raycaster = new THREE.Raycaster(origin, finalDir, 0.5, range);

    for (const bot of this.bots) {
      if (!bot.isAlive || bot.inPlane) continue;
      const botCenter = bot.position.clone().add(new THREE.Vector3(0, 1.0, 0));
      const distToRay = raycaster.ray.distanceToPoint(botCenter);

      if (distToRay < 0.65) {
        const d = origin.distanceTo(botCenter);
        if (d < closestBotDist) {
          closestBotDist = d;
          closestBot = bot;
          hitPoint = botCenter;
        }
      }
    }

    if (closestBot) {
      sounds.playHit();
      this.triggerHitCrosshair();
      const isDead = closestBot.takeDamage(damage, t('kf.player'));

      if (isDead) {
        this.player.kills++;
        this.hud.addKillMessage(t('kf.player'), closestBot.name, this.player.weapons.getActiveWeapon().name);
      }
    } else {
      // 2. Hit the voxel world
      if (blockRay && blockRay.hit) {
        hitPoint = origin.clone().addScaledVector(finalDir, blockRay.distance);

        // Pickaxe mines blocks (and gives them back for building); heavy rounds also break them
        const isPickaxe = this.player.weapons.activeType === 'PICKAXE';
        if (isPickaxe || damage >= 40) {
          const bp = blockRay.blockPos;
          const blockType = this.world.getBlock(bp.x, bp.y, bp.z);
          const broke = this.world.breakBlock(bp.x, bp.y, bp.z);
          if (broke && isPickaxe) {
            this.player.weapons.addConsumable('BLOCK', 1);
            this.player.gainFromBlock(blockType);
          }
        }
        this.spawnBlockParticles(hitPoint, 0x8b5a2b);
      }
    }

    // Spawn bullet tracer
    this.createBulletTracer(origin, hitPoint);
  };

  // Combat: Bot shoots
  private onBotShoot = (from: THREE.Vector3, dir: THREE.Vector3, damage: number, shooterName: string) => {
    // Only gunfire near the player is audible
    if (from.distanceTo(this.player.position) < 90) {
      sounds.playRifle();
    }

    const blockRay = this.world.raycastBlock(from, dir, 45, 0.1);
    const maxDist = blockRay ? blockRay.distance : 45;
    let hitPoint = from.clone().addScaledVector(dir, maxDist);

    // Raycast toward the player's body (smaller target when crouched / prone)
    const playerCenter = this.player.position.clone().add(new THREE.Vector3(0, this.player.aimHeight, 0));
    const ray = new THREE.Ray(from, dir);
    const hb = this.player.getHitbox();
    const distToPlayer = Math.sqrt(ray.distanceSqToSegment(hb.a, hb.b));

    if (!this.player.inPlane && distToPlayer < hb.radius && from.distanceTo(playerCenter) < maxDist) {
      hitPoint = playerCenter;
      this.player.takeDamage(damage, true, shooterName);

      if (!this.player.isAlive) {
        this.hud.addKillMessage(shooterName, t('kf.player'), t('kf.gun'));
      }
    } else {
      // Check if it hits another bot
      for (const other of this.bots) {
        if (!other.isAlive || other.inPlane || other.name === shooterName) continue;
        const otherCenter = other.position.clone().add(new THREE.Vector3(0, 1.0, 0));
        if (ray.distanceToPoint(otherCenter) < 0.65 && from.distanceTo(otherCenter) < maxDist) {
          hitPoint = otherCenter;
          const dead = other.takeDamage(damage, shooterName);
          if (dead) {
            this.hud.addKillMessage(shooterName, other.name, t('kf.gun'));
          }
          break;
        }
      }
    }

    this.createBulletTracer(from, hitPoint);
  };

  private requestLock() {
    try {
      const lockRes = this.canvas.requestPointerLock() as unknown as Promise<void> | undefined;
      if (lockRes && typeof lockRes.catch === 'function') lockRes.catch(() => {});
    } catch {
      // pointer lock unavailable; the mouse-move fallback still works
    }
  }

  private throwGrenade = (origin: THREE.Vector3, dir: THREE.Vector3) => {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 10, 8),
      new THREE.MeshLambertMaterial({ color: 0x3f6212 })
    );
    mesh.position.copy(origin).addScaledVector(dir, 0.6);
    mesh.castShadow = true;
    this.scene.add(mesh);
    const vel = dir.clone().multiplyScalar(17).add(new THREE.Vector3(0, 4, 0));
    this.grenades.push({ mesh, vel, fuse: 2.5 });
  };

  // Simple bouncing physics against the voxel grid, then a block-breaking blast
  private updateGrenades(delta: number) {
    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const g = this.grenades[i];
      g.fuse -= delta;
      g.vel.y -= 22 * delta;
      const p = g.mesh.position;
      const steps = 3;
      for (let s = 0; s < steps; s++) {
        const d = delta / steps;
        for (const axis of ['x', 'y', 'z'] as const) {
          const old = p[axis];
          p[axis] += g.vel[axis] * d;
          if (this.world.hasBlock(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z))) {
            p[axis] = old;
            g.vel[axis] *= -0.35;
            if (axis === 'y') {
              g.vel.x *= 0.7;
              g.vel.z *= 0.7;
            }
          }
        }
      }
      if (p.y < World.WATER_LEVEL - 0.5) g.vel.multiplyScalar(0.9);
      if (g.fuse <= 0) {
        this.explode(p.clone());
        this.scene.remove(g.mesh);
        this.grenades.splice(i, 1);
      }
    }
  }

  private explode(at: THREE.Vector3) {
    const R = 5.5;
    const dist = at.distanceTo(this.player.position);
    sounds.playExplosion(Math.max(0, 1 - dist / 90));

    // Flash + debris
    const flash = new THREE.PointLight(0xffaa33, 6, 14);
    flash.position.copy(at);
    this.scene.add(flash);
    setTimeout(() => this.scene.remove(flash), 120);
    for (let k = 0; k < 4; k++) this.spawnBlockParticles(at, k % 2 ? 0x6b7280 : 0xf97316);

    // Blast hole (keeps the sea floor)
    const br = 2.3;
    for (let x = Math.floor(at.x - br); x <= Math.floor(at.x + br); x++) {
      for (let y = Math.floor(at.y - br); y <= Math.floor(at.y + br); y++) {
        for (let z = Math.floor(at.z - br); z <= Math.floor(at.z + br); z++) {
          if (Math.hypot(x + 0.5 - at.x, y + 0.5 - at.y, z + 0.5 - at.z) <= br && y > 1) {
            this.world.breakBlock(x, y, z, true);
          }
        }
      }
    }

    const blastDamage = (pos: THREE.Vector3) => {
      const d = pos.distanceTo(at);
      return d >= R ? 0 : 110 * (1 - d / R);
    };
    const weapon = t('kf.explosion');
    for (const bot of this.bots) {
      if (!bot.isAlive || bot.inPlane) continue;
      const dmg = blastDamage(bot.position.clone().add(new THREE.Vector3(0, 0.9, 0)));
      if (dmg <= 0) continue;
      if (bot.takeDamage(dmg, t('kf.player'))) {
        this.player.kills++;
        this.hud.addKillMessage(t('kf.player'), bot.name, weapon);
      } else {
        this.triggerHitCrosshair();
      }
    }
    const selfDmg = blastDamage(this.player.position.clone().add(new THREE.Vector3(0, 0.9, 0)));
    if (selfDmg > 0 && !this.player.inPlane) {
      this.player.takeDamage(selfDmg, true, t('kf.fall'));
      if (!this.player.isAlive) this.hud.addKillMessage(t('kf.player'), t('kf.player'), weapon);
    }
  }

  private triggerHitCrosshair() {
    const ch = document.getElementById('crosshair');
    if (ch) {
      ch.classList.add('hit');
      setTimeout(() => ch.classList.remove('hit'), 120);
    }
  }

  private createBulletTracer(from: THREE.Vector3, to: THREE.Vector3) {
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const mat = new THREE.LineBasicMaterial({
      color: 0xfef08a,
      linewidth: 2,
      transparent: true,
      opacity: 0.9
    });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);

    this.tracers.push({
      mesh: line,
      age: 0,
      maxAge: 0.08
    });
  }

  private spawnBlockParticles(pos: THREE.Vector3, color: number) {
    const count = 5;
    const geo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
    const mat = new THREE.MeshLambertMaterial({ color });

    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(pos);
      this.scene.add(mesh);

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 4,
        Math.random() * 3 + 1,
        (Math.random() - 0.5) * 4
      );

      this.particles.push({ mesh, vel, age: 0, maxAge: 0.5 });
    }
  }

  private handlePlayerDeath(killer: string) {
    if (this.matchOver) return;
    this.matchOver = true;
    this.isGameActive = false;
    document.exitPointerLock();
    const gameoverScreen = document.getElementById('gameover-screen')!;
    const rankEl = document.getElementById('gameover-rank')!;
    const killsEl = document.getElementById('gameover-kills')!;
    const causeEl = document.getElementById('gameover-cause')!;

    rankEl.textContent = `${this.aliveCount}`;
    trackMatchEnd(killer === SRC_ZONE ? 'zone' : 'death', this.aliveCount, this.player.kills);
    killsEl.textContent = `${this.player.kills}`;
    causeEl.textContent = killer === SRC_ZONE ? t('over.zone') : t('over.killed', { name: killer });
    this.crafting.close(false);
    document.getElementById('scope-overlay')!.style.display = 'none';
    gameoverScreen.style.display = 'flex';
  }

  private checkMatchStatus() {
    // If only 1 player remains and player is alive => VICTORY!
    if (!this.matchOver && this.aliveCount <= 1 && this.player.isAlive) {
      this.matchOver = true;
      this.isGameActive = false;
      this.crafting.close(false);
      sounds.playVictory();
      document.getElementById('scope-overlay')!.style.display = 'none';
      document.exitPointerLock();

      const victoryScreen = document.getElementById('victory-screen')!;
      const victoryKills = document.getElementById('victory-kills')!;
      victoryKills.textContent = `${this.player.kills}`;
      trackMatchEnd('win', 1, this.player.kills);
      victoryScreen.style.display = 'flex';
    }
  }

  private restartMatch() {
    // Reset Cargo Plane
    this.launchPlane();

    // Reset terrain (broken/placed blocks), loot and effects
    this.world.resetWorld();
    this.tracers.forEach(t => this.scene.remove(t.mesh));
    this.particles.forEach(p => this.scene.remove(p.mesh));
    this.tracers = [];
    this.particles = [];
    this.hud.clearKillfeed();

    // Reset player
    this.player.lastDamageSource = SRC_ZONE;
    this.grenades.forEach(g => this.scene.remove(g.mesh));
    this.grenades = [];
    this.player.isMouseDown = false;
    this.player.isRightMouseDown = false;
    this.camera.fov = 75;
    this.camera.updateProjectionMatrix();
    this.player.inPlane = true;
    this.player.position.copy(this.cargoPlane.getPosition());
    this.player.velocity.set(0, 0, 0);
    this.player.health = 100;
    this.player.armor = 0;
    this.player.kills = 0;
    this.player.isAlive = true;
    this.player.isAirborne = false;
    this.player.isParachuteOpen = false;
    this.player.planeYaw = this.cargoPlane.yaw;
    this.player.yaw = this.cargoPlane.yaw + Math.PI;
    this.player.pitch = -0.15;

    // Reset weapons to unarmed pickaxe
    this.player.weapons.resetInventory();
    this.player.weapons.selectWeapon('PICKAXE');

    // Reset Zone
    this.scene.remove(this.zone.blueZoneMesh);
    this.scene.remove(this.zone.safeZoneMesh);
    this.zone = new ZoneManager(this.scene);
    this.zone.isLand = (x, z) => this.world.isLand(x, z);

    // Re-init Bots
    this.initBots();
    this.hud = new HUD(this.player, this.zone, this.world);
  }

  private loop() {
    requestAnimationFrame(this.loop.bind(this));

    const delta = Math.min(this.clock.getDelta(), 0.1);

    if (this.isGameActive) {
      // 0. Update Cargo Plane flight
      const planeStatus = this.cargoPlane.update(delta);

      // If player is still aboard the Cargo Plane, follow its position
      if (this.player.inPlane) {
        this.player.position.copy(this.cargoPlane.getPosition());
        if (planeStatus.isFinished) {
          // Force auto-drop when flight route ends
          this.player.ejectFromPlane();
        }
      }

      // Check Bot Cargo Plane ejections
      for (const bot of this.bots) {
        if (bot.isAlive && bot.inPlane) {
          bot.ejectTimer -= delta;
          if (bot.ejectTimer <= 0 || planeStatus.isFinished) {
            bot.eject(this.cargoPlane.getDropPosition());
          }
        }
      }

      // 1. Update World (Floating ground loot rotation & bobbing)
      this.world.update(delta);

      // 2. Update Zone
      this.zone.update(delta);

      // 3. Update Player
      this.player.update(delta, this.zone, this.onPlayerShoot, this.throwGrenade);
      this.updateGrenades(delta);
      this.crafting.update();

      // 4. Update Bots (a crouched / prone player is harder to spot and to hit)
      Bot.playerAimHeight = this.player.aimHeight;
      Bot.playerDetectRange = this.player.stance === 'prone' ? 20 : this.player.stance === 'crouch' ? 30 : 38;
      let currentAlive = this.player.isAlive ? 1 : 0;
      for (const bot of this.bots) {
        if (bot.isAlive) {
          bot.update(delta, this.player.position, this.bots, this.zone, this.onBotShoot);
          if (!bot.isAlive && bot.killedBy === SRC_ZONE) {
            this.hud.addKillMessage(t('kf.zone'), bot.name, t('kf.blueZone'));
          }
        }
        if (bot.isAlive) currentAlive++;
      }

      // Player died this frame (gunfire or blue zone)
      if (!this.player.isAlive) {
        if (this.player.lastDamageSource === SRC_ZONE) {
          this.hud.addKillMessage(t('kf.zone'), t('kf.player'), t('kf.blueZone'));
        }
        this.handlePlayerDeath(this.player.lastDamageSource);
      }

      this.aliveCount = currentAlive;
      this.checkMatchStatus();

      // 5. Update HUD
      this.hud.update(this.aliveCount, this.bots);

      // 6. Update Tracers
      for (let i = this.tracers.length - 1; i >= 0; i--) {
        const tr = this.tracers[i];
        tr.age += delta;
        if (tr.age >= tr.maxAge) {
          this.scene.remove(tr.mesh);
          this.tracers.splice(i, 1);
        }
      }

      // 7. Update Particles
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.age += delta;
        p.vel.y -= 15 * delta;
        p.mesh.position.addScaledVector(p.vel, delta);

        if (p.age >= p.maxAge) {
          this.scene.remove(p.mesh);
          this.particles.splice(i, 1);
        }
      }
    }

    this.updateSun();
    this.renderer.render(this.scene, this.camera);
  }

  private updateSun() {
    const c = this.camera.position;
    this.sunLight.target.position.set(c.x, 0, c.z);
    this.sunLight.position.set(c.x + 120, 240, c.z + 90);
  }
}

// Start game
function initGame() {
  applyDom();
  initAnalytics();
  console.log('[BlockBattle] Initializing game instance...');
  try {
    const game = new Game();
    // Dev-only handle for debugging/automated play-testing (stripped from production builds)
    if (import.meta.env.DEV) (window as unknown as { __game: Game }).__game = game;
  } catch (err) {
    console.error(err);
    const btn = document.getElementById('btn-start') as HTMLButtonElement | null;
    if (btn) {
      btn.disabled = true;
      btn.textContent = t('webgl.btn');
    }
    const p = document.querySelector('#start-screen p');
    if (p) {
      p.innerHTML = t('webgl.desc');
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initGame);
} else {
  initGame();
}
