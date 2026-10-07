import type { ResourceType } from '../weapons/Weapon';

export interface Recipe {
  id: string; // also the i18n key suffix: r.<id> (name) and rd.<id> (description)
  icon: string;
  cost: Partial<{ [key in ResourceType]: number }>;
}

// Minecraft-style crafting from mined materials (wood, stone, iron ore, fiber from leaves)
export const RECIPES: Recipe[] = [
  { id: 'BLOCKS', icon: '🧱', cost: { wood: 2 } },
  { id: 'MEDKIT', icon: '🩹', cost: { fiber: 6, wood: 1 } },
  { id: 'AMMO', icon: '📦', cost: { iron: 1, stone: 2 } },
  { id: 'GRENADE', icon: '💣', cost: { iron: 1, stone: 3 } },
  { id: 'IRON_PICKAXE', icon: '⛏️', cost: { iron: 3, wood: 2 } },
  { id: 'ARMOR', icon: '🛡️', cost: { iron: 5, fiber: 4 } },
  { id: 'CROSSBOW', icon: '🏹', cost: { wood: 6, fiber: 4, iron: 1 } },
  { id: 'PISTOL', icon: '🔫', cost: { iron: 4, wood: 1 } },
  { id: 'SMG', icon: '🌀', cost: { iron: 8, wood: 2 } },
  { id: 'SCOPE2', icon: '🔴', cost: { iron: 2, stone: 2 } }
];
