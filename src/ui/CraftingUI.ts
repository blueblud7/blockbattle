import { Player } from '../entities/Player';
import { RECIPES } from '../crafting/Recipes';
import { RESOURCE_ICONS, ResourceType } from '../weapons/Weapon';
import { t } from '../i18n';

const RES_ORDER: ResourceType[] = ['wood', 'stone', 'iron', 'fiber'];

/** [Q] crafting menu. Frees the mouse while open; recipes are clicked or picked by number key. */
export class CraftingUI {
  private panel: HTMLElement;
  private isOpenFlag = false;
  private lastRender = 0;

  constructor(
    private getPlayer: () => Player,
    private canOpen: () => boolean,
    private relock: () => void
  ) {
    this.panel = document.getElementById('craft-panel')!;

    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (e.repeat) return;
      if (e.code === 'KeyQ' || k === 'q' || k === 'ㅂ') {
        if (this.isOpenFlag) this.close();
        else if (this.canOpen()) this.open();
        return;
      }
      if (!this.isOpenFlag) return;
      if (e.code === 'Escape') {
        this.close();
        return;
      }
      const m = /^Digit(\d)$/.exec(e.code);
      if (m) {
        const idx = m[1] === '0' ? 9 : parseInt(m[1], 10) - 1;
        if (RECIPES[idx]) this.craft(RECIPES[idx].id);
      }
    });

    this.panel.addEventListener('mousedown', (e) => e.stopPropagation());
    this.panel.addEventListener('click', (e) => {
      const row = (e.target as HTMLElement).closest<HTMLElement>('[data-recipe]');
      if (row) this.craft(row.dataset.recipe!);
    });
  }

  get isOpen(): boolean {
    return this.isOpenFlag;
  }

  open() {
    const p = this.getPlayer();
    this.isOpenFlag = true;
    p.uiOpen = true;
    p.keys = {};
    p.isMouseDown = false;
    p.isRightMouseDown = false;
    if (document.pointerLockElement) document.exitPointerLock();
    this.render();
    this.panel.style.display = 'block';
  }

  close(relock: boolean = true) {
    if (!this.isOpenFlag) return;
    this.isOpenFlag = false;
    this.getPlayer().uiOpen = false;
    this.panel.style.display = 'none';
    if (relock) this.relock();
  }

  private craft(id: string) {
    this.getPlayer().craft(id);
    this.render();
  }

  /** Keep the counts fresh while open (resources can change, e.g. ammo target). */
  update() {
    if (!this.isOpenFlag) return;
    const now = performance.now();
    if (now - this.lastRender > 300) this.render();
  }

  private render() {
    this.lastRender = performance.now();
    const p = this.getPlayer();
    const res = p.weapons.resources;
    const resHtml = RES_ORDER.map(r =>
      `<span class="craft-res">${RESOURCE_ICONS[r]} ${t(`res.${r}`)} <b>${res[r]}</b></span>`).join('');

    const rows = RECIPES.map((r, i) => {
      const ok = p.canCraft(r.id);
      const cost = (Object.keys(r.cost) as ResourceType[]).map(k => {
        const need = r.cost[k] ?? 0;
        const cls = res[k] >= need ? 'have' : 'miss';
        return `<span class="${cls}">${RESOURCE_ICONS[k]}${need}</span>`;
      }).join(' ');
      const owned = r.id === 'IRON_PICKAXE' && p.weapons.pickaxeTier >= 2;
      return `<div class="craft-row ${ok ? 'ok' : 'no'}" data-recipe="${r.id}">
        <span class="craft-key">${i === 9 ? 0 : i + 1}</span>
        <span class="craft-icon">${r.icon}</span>
        <span class="craft-name">${t(`r.${r.id}`)}<small>${owned ? t('craft.owned') : t(`rd.${r.id}`)}</small></span>
        <span class="craft-cost">${cost}</span>
      </div>`;
    }).join('');

    this.panel.innerHTML = `
      <div class="craft-head"><span>${t('craft.title')}</span><small>${t('craft.hint')}</small></div>
      <div class="craft-resbar">${resHtml}</div>
      <div class="craft-list">${rows}</div>
      <div class="craft-foot">${t('craft.howTo')}</div>`;
  }
}
