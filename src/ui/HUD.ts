import * as THREE from 'three';
import { Player } from '../entities/Player';
import { ZoneManager } from '../zone/ZoneManager';
import { World } from '../world/World';
import { Bot } from '../entities/Bot';
import { itemName } from '../world/World';
import { RESOURCE_ICONS, ResourceType } from '../weapons/Weapon';
import { t } from '../i18n';

export class HUD {
  player: Player;
  zone: ZoneManager;
  world: World;

  // DOM Elements
  minimapCanvas: HTMLCanvasElement;
  minimapCtx: CanvasRenderingContext2D;
  compassTape: HTMLElement;
  aliveCountEl: HTMLElement;
  killCountEl: HTMLElement;
  zoneNoticeText: HTMLElement;
  zoneNoticeBox: HTMLElement;
  healthBar: HTMLElement;
  healthText: HTMLElement;
  armorBar: HTMLElement;
  armorText: HTMLElement;
  weaponNameEl: HTMLElement;
  currentAmmoEl: HTMLElement;
  reserveAmmoEl: HTMLElement;
  fireModeEl: HTMLElement;
  stanceEl: HTMLElement;
  hotbarSlots: NodeListOf<HTMLElement>;
  killfeedEl: HTMLElement;
  dropPromptEl: HTMLElement;
  blockInfoEl: HTMLElement;
  resBarEl: HTMLElement;
  private lastResText = '';

  constructor(player: Player, zone: ZoneManager, world: World) {
    this.player = player;
    this.zone = zone;
    this.world = world;

    this.minimapCanvas = document.getElementById('minimap-canvas') as HTMLCanvasElement;
    this.minimapCtx = this.minimapCanvas.getContext('2d')!;

    this.compassTape = document.getElementById('compass-tape')!;
    this.aliveCountEl = document.getElementById('alive-count')!;
    this.killCountEl = document.getElementById('kill-count')!;
    this.zoneNoticeText = document.getElementById('zone-notice-text')!;
    this.zoneNoticeBox = document.getElementById('zone-notice-box')!;
    this.healthBar = document.getElementById('health-bar')!;
    this.healthText = document.getElementById('health-text')!;
    this.armorBar = document.getElementById('armor-bar')!;
    this.armorText = document.getElementById('armor-text')!;
    this.weaponNameEl = document.getElementById('weapon-name')!;
    this.currentAmmoEl = document.getElementById('current-ammo')!;
    this.reserveAmmoEl = document.getElementById('reserve-ammo')!;
    this.fireModeEl = document.getElementById('fire-mode')!;
    this.stanceEl = document.getElementById('stance-indicator')!;
    this.hotbarSlots = document.querySelectorAll('.hotbar-slot');
    this.killfeedEl = document.getElementById('killfeed')!;
    this.dropPromptEl = document.getElementById('drop-prompt')!;
    this.blockInfoEl = document.getElementById('block-info')!;
    this.resBarEl = document.getElementById('res-bar')!;
  }

  update(aliveCount: number, bots: Bot[]) {
    this.updateStats();
    this.updateCompass();
    this.updateMinimap(bots);
    this.updateHotbarAndWeapon();
    this.updateZoneNotice();
    this.updateDropPrompt();

    this.aliveCountEl.textContent = `${aliveCount}`;
    this.killCountEl.textContent = `${this.player.kills}`;
  }

  private updateStats() {
    const hpPct = Math.max(0, (this.player.health / this.player.maxHealth) * 100);
    this.healthBar.style.width = `${hpPct}%`;
    this.healthText.textContent = `${Math.ceil(this.player.health)} / 100`;

    const armorPct = Math.max(0, (this.player.armor / this.player.maxArmor) * 100);
    this.armorBar.style.width = `${armorPct}%`;
    this.armorText.textContent = `${Math.ceil(this.player.armor)} / 100`;
  }

  private updateCompass() {
    // Player yaw in degrees (0 to 360)
    let deg = ((-this.player.yaw * (180 / Math.PI)) % 360 + 360) % 360;

    // Approximate pixel offset on the compass tape
    const pxPerDegree = 3.6;
    const offset = -(deg * pxPerDegree);
    this.compassTape.style.transform = `translateX(${offset}px)`;
  }

  private updateMinimap(bots: Bot[]) {
    const ctx = this.minimapCtx;
    const w = this.minimapCanvas.width;
    const h = this.minimapCanvas.height;

    ctx.clearRect(0, 0, w, h);

    const mapScale = w / (this.world.worldSize * 1.1);
    const toMapX = (worldX: number) => w / 2 + worldX * mapScale;
    const toMapY = (worldZ: number) => h / 2 + worldZ * mapScale;

    // Ocean background
    ctx.fillStyle = '#143c96';
    ctx.fillRect(0, 0, w, h);

    // Island terrain (pre-rendered top-down map)
    if (this.world.mapImage) {
      const topLeft = toMapX(-this.world.half);
      const size = this.world.gridSize * mapScale;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(this.world.mapImage, topLeft, toMapY(-this.world.half), size, size);
    }

    // Blue Zone Circle on map
    const bzx = toMapX(this.zone.currentCenter.x);
    const bzy = toMapY(this.zone.currentCenter.y);
    const bzRadius = this.zone.currentRadius * mapScale;

    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(bzx, bzy, bzRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Safe Zone White Ring on map
    const szx = toMapX(this.zone.nextCenter.x);
    const szy = toMapY(this.zone.nextCenter.y);
    const szRadius = this.zone.nextRadius * mapScale;

    ctx.strokeStyle = '#ffffff';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(szx, szy, szRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Player position arrow
    const px = toMapX(this.player.position.x);
    const py = toMapY(this.player.position.z);

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(this.player.yaw);

    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4, 5);
    ctx.lineTo(-4, 5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();
  }

  private updateHotbarAndWeapon() {
    const active = this.player.weapons.getActiveWeapon();

    // Hotbar selection & dynamic slot contents
    this.hotbarSlots.forEach(slot => {
      const slotNum = parseInt(slot.dataset.slot || '1', 10);
      slot.classList.remove('active');

      if (slotNum === active.slotIndex) {
        slot.classList.add('active');
      }

      const nameEl = slot.querySelector('.slot-name');
      const countEl = slot.querySelector('.slot-count');
      const iconEl = slot.querySelector('.slot-icon');

      if (slotNum === 1) {
        const pick = this.player.weapons.weapons.get('PICKAXE')!;
        if (nameEl) nameEl.textContent = pick.name;
      } else if (slotNum === 2) {
        const s2 = this.player.weapons.slot2Weapon;
        if (s2) {
          const w = this.player.weapons.weapons.get(s2)!;
          if (nameEl) nameEl.textContent = w.name;
          if (iconEl) iconEl.textContent = w.icon;
          if (countEl) countEl.textContent = `${w.currentAmmo}`;
        } else {
          if (nameEl) nameEl.textContent = t('hud.empty');
          if (iconEl) iconEl.textContent = '🔫';
          if (countEl) countEl.textContent = '-';
        }
      } else if (slotNum === 3) {
        const s3 = this.player.weapons.slot3Weapon;
        if (s3) {
          const w = this.player.weapons.weapons.get(s3)!;
          if (nameEl) nameEl.textContent = w.name;
          if (iconEl) iconEl.textContent = w.icon;
          if (countEl) countEl.textContent = `${w.currentAmmo}`;
        } else {
          if (nameEl) nameEl.textContent = t('hud.empty');
          if (iconEl) iconEl.textContent = '🎯';
          if (countEl) countEl.textContent = '-';
        }
      } else if (slotNum === 4) {
        const medkit = this.player.weapons.weapons.get('MEDKIT')!;
        if (countEl) countEl.textContent = `${medkit.currentAmmo}`;
      } else if (slotNum === 5) {
        const block = this.player.weapons.weapons.get('BLOCK')!;
        if (countEl) countEl.textContent = `${block.currentAmmo}`;
      } else if (slotNum === 6) {
        const nade = this.player.weapons.weapons.get('GRENADE')!;
        if (countEl) countEl.textContent = `${nade.currentAmmo}`;
        slot.classList.toggle('dim', nade.currentAmmo <= 0);
      }
    });

    // Weapon info box
    this.weaponNameEl.textContent = active.name;

    if (active.maxAmmo > 0) {
      this.currentAmmoEl.textContent = `${active.currentAmmo}`;
      this.reserveAmmoEl.textContent = `/ ${active.reserveAmmo}`;
      const scope = active.scope ?? 1;
      this.fireModeEl.textContent = (active.automatic ? t('hud.auto') : t('hud.semi')) +
        (scope > 1 ? t('hud.scope', { n: scope }) : t('hud.iron'));
    } else if (active.type === 'MEDKIT' || active.type === 'BLOCK' || active.type === 'GRENADE') {
      this.currentAmmoEl.textContent = `${active.currentAmmo}`;
      this.reserveAmmoEl.textContent = t('hud.left');
      this.fireModeEl.textContent = t(active.type === 'MEDKIT' ? 'hud.medkitUse' : active.type === 'BLOCK' ? 'hud.blockUse' : 'hud.grenadeUse');
    } else {
      this.currentAmmoEl.textContent = '∞';
      this.reserveAmmoEl.textContent = '/ ∞';
      this.fireModeEl.textContent = t('hud.melee');
    }

    // Gathered resources
    const res = this.player.weapons.resources;
    const resText = (['wood', 'stone', 'iron', 'fiber'] as ResourceType[]).map(r => `${RESOURCE_ICONS[r]} ${res[r]}`).join('   ') + '   [Q] 🛠️';
    if (resText !== this.lastResText) {
      this.resBarEl.textContent = resText;
      this.lastResText = resText;
    }

    // Stance
    const icon = this.player.stance === 'prone' ? '🛌' : this.player.stance === 'crouch' ? '🧎' : '🧍';
    const stanceText = `${icon} ${this.player.stanceLabel}`;
    if (this.stanceEl.textContent !== stanceText) this.stanceEl.textContent = stanceText;

    // Block instruction toast
    this.blockInfoEl.style.display = (active.type === 'BLOCK') ? 'block' : 'none';
  }

  private updateZoneNotice() {
    const status = this.zone.getStatusText();
    this.zoneNoticeText.textContent = status.text;

    if (status.isDanger) {
      this.zoneNoticeBox.style.background = 'rgba(239, 68, 68, 0.45)';
      this.zoneNoticeBox.style.borderColor = '#ef4444';
    } else {
      this.zoneNoticeBox.style.background = 'rgba(220, 38, 38, 0.25)';
      this.zoneNoticeBox.style.borderColor = 'rgba(239, 68, 68, 0.6)';
    }
  }

  private updateDropPrompt() {
    if (this.player.inPlane) {
      this.dropPromptEl.style.display = 'block';
      this.dropPromptEl.textContent = t('hud.plane');
    } else if (this.player.isAirborne) {
      this.dropPromptEl.style.display = 'block';
      if (this.player.isParachuteOpen) {
        this.dropPromptEl.textContent = t('hud.chute');
      } else {
        this.dropPromptEl.textContent = t('hud.freefall');
      }
    } else {
      // Check if near any loot item on ground
      let nearLootName: string | null = null;
      for (const item of this.world.groundItems) {
        if (!item.picked && this.player.position.distanceTo(item.position) < 3.0) {
          nearLootName = itemName(item.type);
          break;
        }
      }
      if (!nearLootName) {
        for (const dc of this.world.deathCrates) {
          if (!dc.opened && this.player.position.distanceTo(dc.position) < 3.2) {
            nearLootName = t('hud.deathCrate', { name: dc.victimName });
            break;
          }
        }
      }
      if (!nearLootName) {
        for (const c of this.world.crates) {
          if (!c.opened && this.player.position.distanceTo(c.position) < 3.2) {
            nearLootName = t('hud.supplyCrate');
            break;
          }
        }
      }

      if (nearLootName) {
        this.dropPromptEl.style.display = 'block';
        this.dropPromptEl.textContent = t('hud.lootPrompt', { name: nearLootName });
      } else if (this.player.isInWater) {
        this.dropPromptEl.style.display = 'block';
        this.dropPromptEl.textContent = t('hud.swimming');
      } else if (!this.player.weapons.slot2Weapon && !this.player.weapons.slot3Weapon) {
        this.dropPromptEl.style.display = 'block';
        this.dropPromptEl.textContent = t('hud.findGun');
      } else {
        this.dropPromptEl.style.display = 'none';
      }
    }
  }

  clearKillfeed() {
    this.killfeedEl.innerHTML = '';
  }

  addKillMessage(killer: string, victim: string, weapon: string) {
    const item = document.createElement('div');
    item.className = 'kill-item';
    const span = (cls: string, text: string, style?: string) => {
      const el = document.createElement('span');
      if (cls) el.className = cls;
      if (style) el.setAttribute('style', style);
      el.textContent = text;
      return el;
    };
    item.append(
      span('killer', killer), ' ',
      span('', '➔', 'color:#aaa;'), ' ',
      span('victim', victim), ' ',
      span('weapon', `(${weapon})`)
    );
    this.killfeedEl.appendChild(item);

    setTimeout(() => {
      if (item.parentNode) {
        item.parentNode.removeChild(item);
      }
    }, 4500);
  }
}
