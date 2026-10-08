# 🎮 BlockBattle

A **voxel battle royale** in the browser: you + 1–100 AI bots (Easy / Normal / Hard / Hell) drop onto a block island, loot villages, **mine resources and craft gear**, and fight inside a shrinking zone. No install needed.

👉 **Play: [https://blueblud7.github.io/blockbattle/](https://blueblud7.github.io/blockbattle/)**

Desktop Chrome / Edge / Firefox / Safari with keyboard + mouse (no mobile). English by default, 한국어 available on the start screen.

---

## 🕹️ Controls

| Key | Action |
| :--- | :--- |
| **W A S D** | Move (glide while parachuting) |
| **SPACE** | Jump / open parachute |
| **SHIFT** | Sprint |
| **C / Z** | Crouch / go prone (press again or SPACE to stand). Lower = slower, steadier aim, harder to spot and hit |
| **Mouse** | Look |
| **Left click** | Fire / melee / mine blocks |
| **Right click** | Aim (zooms by the mounted scope) / place block |
| **1 ~ 6 / wheel** | Switch slots (pickaxe, 2 guns, medkit, blocks, grenades) |
| **R** | Reload |
| **E or F** | Open crates, pick up items, get in / out of vehicles |
| **W S / A D / SPACE** (driving) | Throttle & reverse / steer / brake |
| **G** | Grenade |
| **Q** | Crafting menu |

## ⚔️ Features

- **Villages are the loot hubs** — 11 villages with street grids and gravel roads between them; houses hold guns, ammo, meds, grenades and scopes on both floors, plus loose loot in the streets.
- **Guns** — Pistol, Shotgun, SMG, Assault Rifle, Light Machine Gun, Marksman Rifle, Sniper Rifle, Crossbow.
- **Scopes** — 2x / 4x / 8x, auto-mounted on a gun that takes them:

  | Gun | Base | Max |
  | :--- | :--- | :--- |
  | Pistol · Shotgun · SMG | 1x | 2x |
  | Assault Rifle · LMG · Crossbow | 1x | 4x |
  | Marksman Rifle | 1x | 8x |
  | Sniper Rifle | 2x | 8x |

- **Mining & crafting (Minecraft-style)** — the pickaxe gives building blocks plus resources: 🪵 wood (trees, planks), 🪨 stone (rocks, gravel), ⛓️ iron (rusty ore in boulders and underground), 🌿 fiber (leaves). Press **Q** to craft blocks, medkits, ammo, grenades, an iron pickaxe, armor, a crossbow, a pistol, an SMG or a 2x scope.
- **Vehicles** — jeeps and motorbikes parked on village streets and along the roads. Fastest on gravel roads, slower off-road. A jeep soaks most bullets aimed at its driver; a motorbike is quicker but leaves you exposed. Run bots over, but crash into walls and you get hurt; enough damage blows the vehicle up.
- **Grenades** — bounce, explode after 2.5 s, hurt everyone nearby and blow holes in walls.
- **1–100 AI opponents** and four difficulties: Easy, Normal, Hard and **Hell** (bots hunt you with near-perfect aim). Bots spread their landings across the island.
- **Shrinking zone**, cargo-plane drop, AI bots that loot and fight, kill feed, victory screen.

## 🛠️ Local development

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static files in dist/
```

Pushing to `main` builds and deploys to GitHub Pages via GitHub Actions.

---

### 한국어

블록으로 된 섬에서 펼쳐지는 20인 배틀로얄입니다. 마을에서 파밍하고, 지프나 오토바이로 이동하고, 곡괭이로 자원을 캐서 **[Q] 제작 메뉴**로 장비를 만들고, 자기장을 피해 최후의 1인이 되세요. 시작 화면에서 **한국어**를 선택할 수 있습니다.
