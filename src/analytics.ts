// Privacy-friendly play statistics via GoatCounter (no cookies, no personal data).
// Set GOATCOUNTER_CODE to the site code chosen at goatcounter.com signup; empty = disabled.
const GOATCOUNTER_CODE = 'blockbattle';

interface GoatCounter {
  count?: (vars: { path: string; title?: string; event?: boolean }) => void;
}

let matchStartedAt = 0;

export function initAnalytics() {
  if (!GOATCOUNTER_CODE || import.meta.env.DEV) return;
  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://gc.zgo.at/count.js';
  s.dataset.goatcounter = `https://${GOATCOUNTER_CODE}.goatcounter.com/count`;
  document.head.appendChild(s);
}

function track(path: string, title: string = path) {
  const gc = (window as unknown as { goatcounter?: GoatCounter }).goatcounter;
  if (gc?.count) gc.count({ path, title, event: true });
}

function minutesBucket(ms: number): string {
  const m = ms / 60000;
  if (m < 1) return '0-1m';
  if (m < 3) return '1-3m';
  if (m < 5) return '3-5m';
  if (m < 10) return '5-10m';
  return '10m+';
}

export function trackMatchStart(isRestart: boolean) {
  matchStartedAt = performance.now();
  track(isRestart ? 'match-restart' : 'match-start', isRestart ? '다시 플레이' : '게임 시작');
}

export function trackMatchEnd(result: 'win' | 'death' | 'zone', rank: number, kills: number) {
  const dur = matchStartedAt ? performance.now() - matchStartedAt : 0;
  track(`match-end/${result}`, result === 'win' ? '승리' : result === 'zone' ? '자기장 사망' : '교전 사망');
  track(`match-time/${minutesBucket(dur)}`, `판 길이 ${minutesBucket(dur)}`);
  track(`match-rank/${rank <= 1 ? '1' : rank <= 5 ? '2-5' : rank <= 10 ? '6-10' : '11-20'}`, '최종 순위');
  track(`match-kills/${kills >= 5 ? '5+' : kills}`, '킬 수');
}
