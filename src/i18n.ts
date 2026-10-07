// Tiny i18n: English by default, Korean optional (choice remembered per browser)
export type Lang = 'en' | 'ko';

type Dict = { [key: string]: string };

const en: Dict = {
  'title': 'BlockBattle - Voxel Battle Royale',
  'start.desc': 'A 20-player battle royale on an island made of blocks!<br>Loot crates, mine resources, craft gear, outrun the zone and be the last one standing.',
  'start.play': 'Drop In',
  'start.lang': 'Language',
  'key.move': 'Move (glide in the air / walk on the ground)',
  'key.jump': 'Jump / open parachute in the air',
  'key.lmb': 'Left click',
  'key.lmbDesc': 'Attack / fire / mine blocks (gives resources)',
  'key.rmb': 'Right click',
  'key.rmbDesc': 'Aim (zooms by the mounted scope) / place block',
  'key.reload': 'Reload',
  'key.slots': '1 ~ 6 / wheel',
  'key.slotsDesc': 'Switch weapons and items',
  'key.loot': 'Open crates & pick up items',
  'key.sprint': 'Sprint',
  'key.stance': 'Crouch / go prone (press again to stand)',
  'key.craft': 'Crafting menu',
  'key.grenade': 'Throw grenade (slot 6)',

  'hud.alive': 'Alive',
  'hud.kills': 'Kills',
  'hud.armor': 'Armor',
  'hud.empty': 'Empty',
  'hud.blockInfo': 'Left/right click: place block · mining with the pickaxe gives blocks + resources',
  'hud.left': 'left',
  'hud.auto': '⚡ Full auto',
  'hud.semi': 'Single shot',
  'hud.scope': ' · 🔭 {n}x scope',
  'hud.iron': ' · iron sights',
  'hud.medkitUse': 'Click to heal 75 HP',
  'hud.blockUse': 'Build cover / stairs',
  'hud.melee': 'Mine / melee',
  'hud.grenadeUse': 'Click to throw (explodes after 2.5s)',
  'hud.plane': '✈️ Flying over the island... press [SPACE] or [F] to jump!',
  'hud.chute': '🪂 Parachuting... (steer your landing with WASD)',
  'hud.freefall': '🪂 Free fall! Press [SPACE] to open the parachute',
  'hud.lootPrompt': '📦 {name} — press [E] or [F] to loot!',
  'hud.deathCrate': '[{name}]\'s loot crate',
  'hud.supplyCrate': 'Supply crate',
  'hud.swimming': '🏊 Swimming... [SPACE] to rise / swim to shore',
  'hud.findGun': '💡 Head for the light beams in buildings (guns) or crates (📦) — or mine resources and craft one with [Q]!',
  'hud.zoneWait': 'Phase {p} zone shrinks in {s}s',
  'hud.zoneShrink': '⚠️ Phase {p} zone is closing! ({s}s left)',
  'hud.zoneInit': 'Zone shrinks in: 60s',

  'stance.stand': 'Standing',
  'stance.crouch': 'Crouching',
  'stance.prone': 'Prone',

  'w.PICKAXE': 'Pickaxe',
  'w.IRON_PICKAXE': 'Iron Pickaxe',
  'w.PISTOL': 'Pistol',
  'w.SHOTGUN': 'Shotgun',
  'w.SMG': 'SMG',
  'w.RIFLE': 'Assault Rifle',
  'w.LMG': 'Light Machine Gun',
  'w.DMR': 'Marksman Rifle',
  'w.SNIPER': 'Sniper Rifle',
  'w.CROSSBOW': 'Crossbow',
  'w.MEDKIT': 'Medkit',
  'w.BLOCK': 'Blocks',
  'w.GRENADE': 'Grenade',
  'i.ARMOR': 'Armor Vest',
  'i.AMMO': 'Ammo Box',
  'i.SCOPE2': '2x Scope',
  'i.SCOPE4': '4x Scope',
  'i.SCOPE8': '8x Scope',
  'i.GRENADE': 'Grenade',

  'res.wood': 'Wood',
  'res.stone': 'Stone',
  'res.iron': 'Iron',
  'res.fiber': 'Fiber',

  'toast.slotEmpty2': '🔫 Primary slot 1 is empty. Loot a gun from buildings or crates, or craft one with [Q]!',
  'toast.slotEmpty3': '🎯 Primary slot 2 is empty. Loot a gun from buildings or crates, or craft one with [Q]!',
  'toast.noGrenade': '💣 No grenades. Find some or craft them with [Q]',
  'toast.cantStand': '⛔ No room to stand up here',
  'toast.medkit': '🩹 Picked up a medkit!',
  'toast.armor': '🛡️ Armor vest equipped! (+75 armor)',
  'toast.scopeOn': '🔭 {item} → mounted on [{gun}]! Right click for {n}x zoom',
  'toast.needGunForAmmo': '📦 You need a gun before you can use ammo!',
  'toast.ammo': '📦 Picked up {n} rounds!',
  'toast.gun': '🔫 [{gun}] equipped! Left click: fire / Right click: aim / [R]: reload',
  'toast.grenade': '💣 Picked up {n} grenade(s)!',
  'toast.deathCrate': '⚰️ Looted [{name}]\'s crate! (+{n} rounds)',
  'toast.scopeNoGun': '🔭 Find a gun first to mount a scope',
  'toast.scopeNoFit': '🔭 No gun can take it (pistol/shotgun/SMG 2x, rifle/LMG 4x, marksman/sniper 8x)',
  'toast.crateMedkit': '🩹 Supply medkits!',
  'toast.crateArmor': '🛡️ Top-tier armor vest!',
  'toast.crateScope': '📦 Supply: {n}x scope → mounted on [{gun}]!',
  'toast.crateGun': '📦 Supply weapon: {gun}! (+60 rounds)',
  'toast.crateGrenade': '📦 Supply: {n} grenades!',
  'toast.mined': '+1 {res}',
  'toast.crafted': '🛠️ Crafted: {item}',
  'toast.cantCraft': '🛠️ Not enough materials for {item}',

  'craft.title': '🛠️ Crafting',
  'craft.hint': 'Click a recipe or press its number · [Q] / [Esc] to close',
  'craft.resources': 'Resources',
  'craft.howTo': 'Mine trees (wood), leaves (fiber), rocks (stone) and the rusty ore in boulders (iron) with the pickaxe.',
  'r.BLOCKS': '10 Blocks',
  'r.IRON_PICKAXE': 'Iron Pickaxe',
  'r.MEDKIT': 'Medkit',
  'r.ARMOR': 'Armor (+50)',
  'r.AMMO': 'Ammo ×30 (gun in hand)',
  'r.GRENADE': 'Grenade ×2',
  'r.CROSSBOW': 'Crossbow',
  'r.PISTOL': 'Pistol',
  'r.SMG': 'SMG',
  'r.SCOPE2': '2x Scope',
  'rd.BLOCKS': 'Building blocks for cover',
  'rd.IRON_PICKAXE': 'Mines 2× faster, hits harder',
  'rd.MEDKIT': 'Heals 75 HP',
  'rd.ARMOR': 'Absorbs damage',
  'rd.AMMO': 'For the gun you are holding (or slot 2)',
  'rd.GRENADE': 'Blows up enemies and walls',
  'rd.CROSSBOW': 'Silent, powerful bolts',
  'rd.PISTOL': 'Reliable sidearm',
  'rd.SMG': 'Fast-firing close range gun',
  'rd.SCOPE2': 'Red dot for any gun',
  'craft.owned': 'Owned',

  'win.title': 'Last one standing! You win!',
  'win.desc': 'Congratulations! You outlasted everyone on the island.',
  'win.kills': 'Total kills: <span id="victory-kills">{k}</span>',
  'win.again': 'Play Again',
  'over.title': 'You died',
  'over.zone': 'You fell outside the zone.',
  'over.killed': 'You were taken out by {name}.',
  'over.stats': 'Placement: #<span id="gameover-rank">{r}</span> / <span id="gameover-kills">{k}</span> kills',
  'over.again': 'Try Again',
  'webgl.btn': 'WebGL unavailable',
  'webgl.desc': 'WebGL (hardware acceleration) is turned off in your browser, so the game cannot run.<br>Turn on hardware acceleration in your browser settings and reload.',

  'kf.player': 'You',
  'kf.zone': 'Zone',
  'kf.blueZone': 'Blue zone',
  'kf.gun': 'Gun',
  'kf.explosion': 'Grenade',
  'kf.fall': 'Explosion'
};

const ko: Dict = {
  'title': 'BlockBattle - 블록 배틀로얄',
  'start.desc': '블록으로 만들어진 섬에서 펼쳐지는 20인 배틀로얄!<br>상자를 파밍하고, 자원을 캐서 장비를 만들고, 자기장을 피해 최후의 1인이 되세요.',
  'start.play': '전장 강하 시작',
  'start.lang': '언어',
  'key.move': '이동 (공중 낙하 / 지상 이동)',
  'key.jump': '점프 / 공중에서 낙하산 펼치기',
  'key.lmb': '마우스 좌클릭',
  'key.lmbDesc': '공격 / 총기 발사 / 블록 채굴 (자원 획득)',
  'key.rmb': '마우스 우클릭',
  'key.rmbDesc': '조준 (스코프 배율만큼 확대) / 블록 설치',
  'key.reload': '재장전',
  'key.slots': '1 ~ 6 / 휠',
  'key.slotsDesc': '무기 및 아이템 교체',
  'key.loot': '상자 열기 & 아이템 줍기',
  'key.sprint': '달리기',
  'key.stance': '앉기 / 엎드리기 (다시 누르면 일어서기)',
  'key.craft': '제작 메뉴',
  'key.grenade': '수류탄 던지기 (6번 슬롯)',

  'hud.alive': '생존',
  'hud.kills': '처치',
  'hud.armor': '방어구',
  'hud.empty': '빈 슬롯',
  'hud.blockInfo': '좌/우클릭: 블록 설치 · 곡괭이로 캐면 블록 + 자원 획득',
  'hud.left': '개 남음',
  'hud.auto': '⚡ 완전 연사',
  'hud.semi': '단발 사격',
  'hud.scope': ' · 🔭 {n}배율',
  'hud.iron': ' · 기본 조준',
  'hud.medkitUse': '클릭하여 체력 75 즉시 회복',
  'hud.blockUse': '엄폐물 / 계단 건축 모드',
  'hud.melee': '채굴 / 근접 타격',
  'hud.grenadeUse': '클릭하여 투척 (2.5초 후 폭발)',
  'hud.plane': '✈️ 수송기 비행 중... [SPACE] 또는 [F] 키로 전장 강하!',
  'hud.chute': '🪂 낙하산 활강 중... (WASD로 착륙 지점 유도)',
  'hud.freefall': '🪂 자유 낙하 중! [SPACE] 눌러 낙하산 펼치기',
  'hud.lootPrompt': '📦 {name} [E] 또는 [F] 키로 파밍!',
  'hud.deathCrate': '[{name}] 전리품 상자',
  'hud.supplyCrate': '보급 상자',
  'hud.swimming': '🏊 수영 중... [SPACE] 수면 상승 / 해변으로 나가기',
  'hud.findGun': '💡 건물 빛기둥(총기)이나 상자(📦)로 가세요! 자원을 캐서 [Q]로 직접 만들 수도 있습니다',
  'hud.zoneWait': '{p}페이즈 자기장 축소 대기: {s}초',
  'hud.zoneShrink': '⚠️ {p}페이즈 자기장 축소 중! ({s}초 남음)',
  'hud.zoneInit': '자기장 축소 대기 중: 60초',

  'stance.stand': '서기',
  'stance.crouch': '앉기',
  'stance.prone': '엎드리기',

  'w.PICKAXE': '곡괭이',
  'w.IRON_PICKAXE': '철 곡괭이',
  'w.PISTOL': '권총',
  'w.SHOTGUN': '샷건',
  'w.SMG': '기관단총',
  'w.RIFLE': '돌격소총',
  'w.LMG': '경기관총',
  'w.DMR': '지정사수소총',
  'w.SNIPER': '저격소총',
  'w.CROSSBOW': '석궁',
  'w.MEDKIT': '구급키트',
  'w.BLOCK': '블록',
  'w.GRENADE': '수류탄',
  'i.ARMOR': '방탄 조끼',
  'i.AMMO': '탄약 상자',
  'i.SCOPE2': '2배율 스코프',
  'i.SCOPE4': '4배율 스코프',
  'i.SCOPE8': '8배율 스코프',
  'i.GRENADE': '수류탄',

  'res.wood': '나무',
  'res.stone': '돌',
  'res.iron': '철',
  'res.fiber': '섬유',

  'toast.slotEmpty2': '🔫 [주무기 1] 슬롯이 비어있습니다. 건물·상자에서 파밍하거나 [Q]로 제작하세요!',
  'toast.slotEmpty3': '🎯 [주무기 2] 슬롯이 비어있습니다. 건물·상자에서 파밍하거나 [Q]로 제작하세요!',
  'toast.noGrenade': '💣 수류탄이 없습니다. 파밍하거나 [Q]로 제작하세요',
  'toast.cantStand': '⛔ 위가 막혀 있어 일어설 수 없습니다',
  'toast.medkit': '🩹 구급키트 획득!',
  'toast.armor': '🛡️ 방탄 조끼 장착! (방어구 +75)',
  'toast.scopeOn': '🔭 {item} → [{gun}] 장착! 우클릭으로 {n}배 조준',
  'toast.needGunForAmmo': '📦 탄약을 쓰려면 먼저 총기를 구하세요!',
  'toast.ammo': '📦 탄약 {n}발 획득!',
  'toast.gun': '🔫 [{gun}] 획득 및 장착 완료! 좌클릭: 사격 / 우클릭: 조준 / [R]: 재장전',
  'toast.grenade': '💣 수류탄 {n}개 획득!',
  'toast.deathCrate': '⚰️ [{name}] 전리품 상자 파밍 완료! (+{n}발)',
  'toast.scopeNoGun': '🔭 스코프를 장착하려면 먼저 총을 구하세요',
  'toast.scopeNoFit': '🔭 장착할 총이 없습니다 (권총·샷건·기관단총 2배, 돌격소총·경기관총 4배, 지정사수·저격소총 8배까지)',
  'toast.crateMedkit': '🩹 보급 구급상자 획득!',
  'toast.crateArmor': '🛡️ 최고급 방탄 조끼 획득!',
  'toast.crateScope': '📦 보급품: {n}배율 스코프 → [{gun}] 장착!',
  'toast.crateGun': '📦 보급 무기: {gun} 획득! (+60발)',
  'toast.crateGrenade': '📦 보급품: 수류탄 {n}개!',
  'toast.mined': '+1 {res}',
  'toast.crafted': '🛠️ 제작 완료: {item}',
  'toast.cantCraft': '🛠️ {item} 재료가 부족합니다',

  'craft.title': '🛠️ 제작',
  'craft.hint': '레시피를 클릭하거나 번호 키 · [Q] / [Esc] 닫기',
  'craft.resources': '보유 자원',
  'craft.howTo': '곡괭이로 나무(나무), 나뭇잎(섬유), 바위(돌), 바위 속 녹슨 광석(철)을 캐세요.',
  'r.BLOCKS': '블록 10개',
  'r.IRON_PICKAXE': '철 곡괭이',
  'r.MEDKIT': '구급키트',
  'r.ARMOR': '방탄 조끼 (+50)',
  'r.AMMO': '탄약 30발 (든 총)',
  'r.GRENADE': '수류탄 2개',
  'r.CROSSBOW': '석궁',
  'r.PISTOL': '권총',
  'r.SMG': '기관단총',
  'r.SCOPE2': '2배율 스코프',
  'rd.BLOCKS': '엄폐용 건축 블록',
  'rd.IRON_PICKAXE': '채굴 2배 빠름, 근접 피해 증가',
  'rd.MEDKIT': '체력 75 회복',
  'rd.ARMOR': '피해 흡수',
  'rd.AMMO': '들고 있는 총 (없으면 2번 슬롯)',
  'rd.GRENADE': '적과 벽을 날려버림',
  'rd.CROSSBOW': '소리 없는 강력한 화살',
  'rd.PISTOL': '믿을 만한 보조 무기',
  'rd.SMG': '근거리 고속 연사',
  'rd.SCOPE2': '어떤 총에나 다는 레드닷',
  'craft.owned': '보유 중',

  'win.title': '최후의 생존자! 승리했습니다!',
  'win.desc': '축하합니다! 최후의 1인으로 살아남아 전장을 지배했습니다.',
  'win.kills': '총 처치 수: <span id="victory-kills">{k}</span>킬',
  'win.again': '다시 플레이',
  'over.title': '사망하셨습니다',
  'over.zone': '자기장 밖에서 쓰러졌습니다.',
  'over.killed': '{name}의 공격에 쓰러졌습니다.',
  'over.stats': '최종 순위: <span id="gameover-rank">{r}</span>위 / 총 <span id="gameover-kills">{k}</span>킬',
  'over.again': '다시 도전',
  'webgl.btn': 'WebGL을 사용할 수 없습니다',
  'webgl.desc': '브라우저에서 WebGL(하드웨어 가속)이 꺼져 있어 게임을 실행할 수 없습니다.<br>브라우저 설정에서 하드웨어 가속을 켠 뒤 새로고침하세요.',

  'kf.player': '플레이어',
  'kf.zone': '자기장',
  'kf.blueZone': '블루존',
  'kf.gun': '총기',
  'kf.explosion': '수류탄',
  'kf.fall': '폭발'
};

const DICTS: { [key in Lang]: Dict } = { en, ko };

const BOT_NAMES: { [key in Lang]: string[] } = {
  en: [
    'BlockSmith', 'SandCastle', 'ProGamer', 'DinnerHunter', 'VoxelMaster',
    'SniperKing', 'LootGoblin', 'RushLeader', 'CampLord', 'DiamondPick',
    'StoneAxe', 'NightOwl', 'BridgeKeeper', 'NoobSlayer', 'GoldenApple',
    'CrateRaider', 'AimFairy', 'ZoneRunner', 'LastSurvivor'
  ],
  ko: [
    '블록장인', '모래성', '고수플레이어', '저녁사냥꾼', '복셀마스터',
    '저격의달인', '파밍왕', '돌격대장', '존버장인', '다이아곡괭이',
    '돌도끼', '밤샘러', '다리지기', '초보탈출', '황금사과',
    '보급상자털이', '에임요정', '자기장러너', '최후의생존자'
  ]
};

function loadLang(): Lang {
  try {
    const saved = localStorage.getItem('bb-lang');
    if (saved === 'en' || saved === 'ko') return saved;
  } catch {
    // storage blocked: fall back to the default
  }
  return 'en';
}

let current: Lang = loadLang();

export function getLang(): Lang {
  return current;
}

/** Translate a key, filling {placeholders} from vars. Unknown keys fall back to English, then the key. */
export function t(key: string, vars?: { [k: string]: string | number }): string {
  let s = DICTS[current][key] ?? en[key] ?? key;
  if (vars) {
    for (const k in vars) s = s.split(`{${k}}`).join(String(vars[k]));
  }
  return s;
}

export function botNames(): string[] {
  return BOT_NAMES[current];
}

/** Fill every [data-i18n] (text) and [data-i18n-html] (markup) element on the page. */
export function applyDom() {
  document.documentElement.lang = current;
  document.title = t('title');
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n!);
  });
  document.querySelectorAll<HTMLElement>('[data-i18n-html]').forEach(el => {
    el.innerHTML = t(el.dataset.i18nHtml!);
  });
  document.querySelectorAll<HTMLElement>('[data-lang]').forEach(el => {
    el.classList.toggle('active', el.dataset.lang === current);
  });
}

const listeners: Array<() => void> = [];

export function onLangChange(fn: () => void) {
  listeners.push(fn);
}

export function setLang(lang: Lang) {
  current = lang;
  try {
    localStorage.setItem('bb-lang', lang);
  } catch {
    // not persisted; still switches for this visit
  }
  applyDom();
  listeners.forEach(fn => fn());
}
