'use strict';
/* §16.1 / §17.5 long-term free-route run.
   Plays a brand-new save with no purchased currency through an automatic
   policy and records the economy at the 30min / 2h / 12h / 1d / 3d / 7d
   checkpoints, stopping at (or reporting the stall before) first ascension.

   This is an accelerated simulation of the shipped rules, not a human
   playthrough: every gain and cost goes through GameCore.dispatch / tick. */
const path = require('node:path');
const fs = require('node:fs');

const ROOT = path.resolve(__dirname, '..');
const D = require(path.join(ROOT, 'js', 'game-data.js'));
const C = require(path.join(ROOT, 'js', 'game-core.js'));
const E = require(path.join(ROOT, 'js', 'game-extensions.js'));
globalThis.GameData = D;
globalThis.GameExtensions = E;

const SEED = Number(process.argv[2] || 42);
const START = Date.parse('2026-09-16T12:00:00+08:00');
const CHECKPOINTS = [1800, 7200, 43200, 86400, 259200, 604800];
const CHUNK = 900;
const BUILD_ORDER = ['tavern', 'castle', 'warehouse', 'training', 'forge', 'potion', 'gem', 'market', 'library', 'altar'];

const s = C.create(SEED);
s.createdAt = s.clock = s.lastSeen = START;
E.init(s, START);
C.dispatch(s, 'autoNext', { value: true }, START);
C.dispatch(s, 'autoContinue', { value: true }, START);
C.dispatch(s, 'speed', { value: 1 }, START);

const journal = [];
const notes = [];
let spent = { recruit: 0, building: 0, training: 0, enhance: 0, breakthrough: 0, craft: 0 };
let denied = { building: 0, training: 0, enhance: 0, breakthrough: 0, craft: 0 };

const act = (type, payload) => C.dispatch(s, type, payload, s.clock);
const tier = () => C.heroStats(s, C.team(s)[0] || s.heroes[0]).power;

function claimAll() {
  const r = act('claimAll', {});
  if (r.ok) notes.push(`at ${fmtDur(elapsed())} claimed ${r.count} rewards`);
  return r;
}

function recruitIfRoom() {
  if (s.heroes.length >= C.capacity(s).roster) return;
  const cost = C.recruitCost(s, 'advanced');
  if (cost && s.resources.tickets >= 1) { act('recruit', { kind: 'advanced' }); spent.recruit++; return; }
  const gold = C.recruitCost(s, 'normal').gold;
  if (s.resources.gold > gold * 4) { act('recruit', { kind: 'normal' }); spent.recruit++; }
}

function buildNext() {
  for (const id of BUILD_ORDER) {
    const before = s.buildings[id];
    const r = act('building', { id });
    if (r.ok) { spent.building++; return true; }
    if (before === s.buildings[id]) denied.building++;
  }
  return false;
}

function trainTeam() {
  let did = false;
  for (const h of C.team(s)) {
    const cost = C.trainingCost(h).gold;
    if (s.resources.gold > cost * 8) {
      const r = act('train', { heroId: h.id, count: 5 });
      if (r.ok) { spent.training += r.count; did = true; } else denied.training++;
    }
  }
  return did;
}

function breakthroughTeam() {
  let did = false;
  for (const h of s.heroes) {
    if (s.resources.gold < 200000 && h.breakthrough > 0) continue;
    const r = act('breakthrough', { heroId: h.id });
    if (r.ok) { spent.breakthrough++; did = true; }
  }
  return did;
}

function enhanceKit() {
  let did = false;
  for (const h of C.team(s)) {
    for (const id of Object.values(h.equipment)) {
      const it = s.inventory.find(i => i.id === id);
      if (!it || it.enhance >= 15) continue;
      const cost = C.enhanceCost(s, it).gold;
      if (s.resources.gold > cost * 6) {
        const r = act('enhance', { itemId: it.id, count: 1 });
        if (r.ok) { spent.enhance++; did = true; } else denied.enhance++;
      }
    }
  }
  return did;
}

function craftGear() {
  const affordable = D.recipes.filter(r => s.progress.zone >= r.unlock && C.canAfford(s, r.cost)).pop();
  if (!affordable) { denied.craft++; return false; }
  const r = act('craft', { recipeId: affordable.id });
  if (r.ok) { spent.craft++; return true; }
  denied.craft++;
  return false;
}

function tryDifficulty() {
  const next = s.hunting.difficulty + 1;
  if (next < D.difficulties.length && s.progress.zone >= D.difficulties[next].zone) {
    act('target', { zone: s.hunting.zone, stage: s.hunting.stage, difficulty: next });
  }
}

function economy() {
  claimAll();
  recruitIfRoom();
  act('autoTeam', { team: 0 });
  if (!s.hunting.active && s.hunting.restUntil <= s.clock) act('dispatch', {});
  for (const h of C.team(s)) act('autoEquip', { heroId: h.id });
  buildNext(); trainTeam(); breakthroughTeam(); enhanceKit(); craftGear(); tryDifficulty();
}

function fmtDur(sec) {
  const d = Math.floor(sec / 86400), h = Math.floor(sec % 86400 / 3600), m = Math.floor(sec % 3600 / 60);
  return (d ? d + 'd' : '') + (h ? h + 'h' : '') + (m ? m + 'm' : '') || Math.floor(sec) + 's';
}

const snapshot = () => ({
  elapsedSeconds: Math.round(elapsed()),
  elapsed: fmtDur(elapsed()),
  kingdom: s.kingdom.level,
  maxZone: s.progress.maxZone,
  maxStage: s.progress.maxStage,
  totalStages: s.progress.totalStages,
  teamPower: Math.round(C.teamPower(s)),
  heroes: s.heroes.length,
  roster: C.capacity(s).roster,
  gold: Math.round(s.resources.gold),
  gems: s.resources.gems,
  tickets: s.resources.tickets,
  honor: s.resources.honor,
  kills: s.stats.kills,
  bossKills: s.stats.bossKills,
  items: s.inventory.length,
  maxItemStars: s.stats.maxItemStars,
  maxHeroLevel: s.stats.maxHeroLevel,
  buildings: Object.entries(s.buildings).filter(([, v]) => v > 0).map(([k, v]) => k + v).join(' '),
  ascensionEligible: C.ascensionInfo(s).eligible,
  ascensionReason: C.ascensionInfo(s).reason,
  losses: s.hunting.losses
});

const t0 = Date.now();
let elapsed = () => (s.clock - START) / 1000;
let next = 0;
let guard = 0;
while (!C.ascensionInfo(s).eligible && elapsed() < CHECKPOINTS[CHECKPOINTS.length - 1] && guard++ < 20000) {
  economy();
  const step = Math.min(CHUNK, CHECKPOINTS[CHECKPOINTS.length - 1] - elapsed());
  C.tick(s, step, s.clock + step * 1000);
  while (next < CHECKPOINTS.length && elapsed() >= CHECKPOINTS[next]) {
    journal.push({ checkpoint: fmtDur(CHECKPOINTS[next]), ...snapshot() });
    next++;
  }
}
const wallMs = Date.now() - t0;
const final = snapshot();
const paidCurrencyUsed = { gemsSpentOnMythicRecruit: 0, note: 'no mythic recruitment and no ticket purchase was used' };
const info = C.ascensionInfo(s);

const report = {
  kind: 'accelerated free-route simulation of the shipped rules',
  seed: SEED,
  startIso: new Date(START).toISOString(),
  simSeconds: Math.round(elapsed()),
  simTime: fmtDur(elapsed()),
  wallClockMs: wallMs,
  reachedFirstAscension: info.eligible,
  ascensionReason: info.reason,
  ascensionHonor: info.honor,
  checkpoints: journal,
  final,
  spend: spent,
  blockedAttempts: denied,
  paidCurrencyUsed,
  notes: notes.slice(0, 40)
};

const outDir = path.join(ROOT, 'docs');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'free-route.json'), JSON.stringify(report, null, 1) + '\n');

console.log('sim ' + report.simTime + ' in ' + wallMs + 'ms | reached first ascension: ' + info.eligible + (info.eligible ? '' : ' -> ' + info.reason));
console.log('checkpoint    kingdom  zone/stage  power      gold       heroes  items  kills  bosses');
for (const j of journal) {
  console.log(
    String(j.checkpoint).padEnd(13) +
    String('Lv' + j.kingdom).padEnd(9) +
    String(j.maxZone + '-' + j.maxStage).padEnd(12) +
    String(j.teamPower).padEnd(11) +
    String(j.gold.toLocaleString('en-US')).padEnd(11) +
    String(j.heroes + '/' + j.roster).padEnd(8) +
    String(j.items).padEnd(7) +
    String(j.kills).padEnd(7) + j.bossKills
  );
}
console.log('spend', JSON.stringify(spent));
console.log('final', JSON.stringify({ kingdom: final.kingdom, zone: final.maxZone + '-' + final.maxStage, power: final.teamPower, heroes: final.heroes, gold: final.gold }));
