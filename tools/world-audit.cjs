#!/usr/bin/env node
'use strict';
/* 世界地圖驗收（Phase 1）
   規格：docs/WORLD-MAP-SPEC.md
   用法：node tools/world-audit.cjs
   只讀 js/world-map.js，不啟瀏覽器、不改任何檔案。 */
const path = require('node:path');
const fs = require('node:fs');

const MODULE = path.join(__dirname, '..', 'js', 'world-map.js');
if (!fs.existsSync(MODULE)) {
  console.error('缺少 js/world-map.js');
  process.exit(1);
}
require(MODULE);
const W = globalThis.WorldMap;
if (!W) { console.error('js/world-map.js 沒有設定 globalThis.WorldMap'); process.exit(1); }

const results = [];
const check = (name, fn) => {
  try {
    const info = fn() || {};
    results.push({ name, ok: info.ok !== false, detail: info.detail == null ? '' : String(info.detail) });
  } catch (e) {
    results.push({ name, ok: false, detail: 'EXCEPTION: ' + e.message });
  }
};
const cell = W.cell || 2;
const walkable = (x, z) => !!W.walkable(x, z);
const height = (x, z) => W.height(x, z);
const near = (a, b, r) => Math.hypot(a[0] - b[0], a[1] - b[1]) <= r;

/* 逐格取樣一條路線，檢查是否全程可走、高差合格、沒有切過牆角。 */
function traceRoute(points, label) {
  let steps = 0, blocked = 0, steep = 0, firstBlocked = null;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(1, Math.ceil(d / 1));
    for (let s = 0; s <= n; s++) {
      const t = s / n, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
      steps++;
      if (!walkable(x, z)) { blocked++; if (!firstBlocked) firstBlocked = [Math.round(x * 10) / 10, Math.round(z * 10) / 10]; }
      const prevX = a[0] + (b[0] - a[0]) * Math.max(0, t - 1 / n), prevZ = a[1] + (b[1] - a[1]) * Math.max(0, t - 1 / n);
      if (s > 0 && Math.abs(height(x, z) - height(prevX, prevZ)) > 1.5 + 1e-6) steep++;
    }
  }
  return { label, steps, blocked, steep, firstBlocked };
}

/* ---------------------------------------------------------------- 1. 基本欄位 */
check('WorldMap 基本欄位', () => {
  const need = ['cell', 'radius', 'castle', 'zones', 'biomes', 'findPath', 'routeTo', 'routeBetween', 'walkable', 'height', 'surface', 'biomeAt', 'blocked', 'isLand'];
  const missing = need.filter(k => W[k] === undefined);
  return { ok: missing.length === 0, detail: missing.length ? '缺少 ' + missing.join(',') : `cell=${W.cell} radius=${W.radius}` };
});

/* ---------------------------------------------------------------- 2. 十區配置 */
check('十區：數量／遞增／不重疊', () => {
  const z = W.zones || [];
  if (z.length !== 10) return { ok: false, detail: 'zones=' + z.length };
  const dist = z.map(a => Math.hypot(a.x, a.z));
  let increasing = true;
  for (let i = 1; i < dist.length; i++) if (dist[i] <= dist[i - 1]) increasing = false;
  let minGap = Infinity, minPair = '';
  for (let i = 0; i < z.length; i++) for (let j = i + 1; j < z.length; j++) {
    const gap = Math.hypot(z[i].x - z[j].x, z[i].z - z[j].z);
    if (gap < minGap) { minGap = gap; minPair = (i + 1) + '-' + (j + 1); }
  }
  const padsClear = minGap >= 2 * (z[0].pad || 30) - 2;
  return {
    ok: increasing && padsClear,
    detail: `距離 ${dist.map(d => Math.round(d)).join('/')} | 最小間距 ${minGap.toFixed(1)}（${minPair}）| 遞增=${increasing} 空地不重疊=${padsClear}`
  };
});

check('十區：方位抖動（不是等角排列）', () => {
  const z = W.zones || [];
  const bearings = z.map(a => Math.atan2(a.x, a.z) * 180 / Math.PI);
  const steps = [];
  for (let i = 1; i < bearings.length; i++) steps.push(Math.abs(bearings[i] - bearings[i - 1]));
  const spread = Math.max(...steps) - Math.min(...steps);
  return { ok: spread > 4, detail: `相鄰方位差 ${steps.map(s => s.toFixed(0)).join('/')} 極差 ${spread.toFixed(1)}°` };
});

/* ---------------------------------------------------------------- 3. 每區在陸地且競技場全平 */
check('十區：空地全在陸地、競技場地板全平', () => {
  const bad = [];
  for (const z of W.zones || []) {
    let offLand = 0, uneven = 0, ground = null;
    for (let dx = -z.pad; dx <= z.pad; dx += cell) for (let dz = -z.pad; dz <= z.pad; dz += cell) {
      if (Math.hypot(dx, dz) > z.pad) continue;
      const x = z.x + dx, zz = z.z + dz;
      if (!W.isLand(x, zz)) offLand++;
      const h = height(x, zz);
      if (ground === null) ground = h;
      if (Math.hypot(dx, dz) <= 24 && Math.abs(h - ground) > 1e-6) uneven++;
    }
    if (offLand || uneven) bad.push(`#${z.index} offLand=${offLand} uneven=${uneven}`);
  }
  return { ok: bad.length === 0, detail: bad.length ? bad.join(' ; ') : '10 區空地皆在陸地，半徑 24 內高度一致' };
});

/* ---------------------------------------------------------------- 4. 路線可走 */
check('路線：每區都走得到（逐格 1 單位取樣）', () => {
  const spawn = (W.castle && W.castle.spawn) || [0, 30];
  const bad = [], traces = [];
  for (const z of W.zones || []) {
    const route = W.routeTo(z.index);
    if (!route || !route.length) { bad.push(`#${z.index} 沒有路線`); continue; }
    const t = traceRoute([[spawn[0], spawn[1]], ...route], 'route' + z.index);
    traces.push(t);
    if (!near(route[route.length - 1], z.gates || [z.x, z.z], 10)) bad.push(`#${z.index} 終點不在閘門附近`);
    if (t.blocked || t.steep) bad.push(`#${z.index} blocked=${t.blocked} steep=${t.steep} 首次@${t.firstBlocked}`);
  }
  const worst = traces.length ? Math.max(...traces.map(t => t.blocked + t.steep)) : -1;
  return { ok: bad.length === 0, detail: bad.length ? bad.join(' ; ') : `10 條路線全部可走（取樣 ${traces.reduce((n, t) => n + t.steps, 0)} 格，違規 0） worst=${worst}` };
});

check('路線：必須穿過外城門開口', () => {
  const g = (W.castle && W.castle.gate) || { x: 0, z: 64 };
  const bad = [];
  for (const z of W.zones || []) {
    const route = W.routeTo(z.index) || [];
    const through = route.some(([x, zz]) => Math.abs(x - g.x) <= 4 && Math.abs(zz - g.z) <= 3.5);
    if (!through) bad.push('#' + z.index);
  }
  return { ok: bad.length === 0, detail: bad.length ? '沒經過城門：' + bad.join(',') : `10 條都經過 (${g.x},${g.z}) 開口` };
});

/* ---------------------------------------------------------------- 5. 無斷崖 */
check('地形：可走區域沒有斷崖（相鄰高差 ≤ 1.5）', () => {
  let pairs = 0, cliffs = 0, worst = 0, at = null;
  const R = W.navHalf || 270;
  for (let x = -R; x <= R; x += cell) for (let z = -R; z <= R; z += cell) {
    if (!walkable(x, z)) continue;
    for (const [dx, dz] of [[cell, 0], [0, cell]]) {
      const nx = x + dx, nz = z + dz;
      if (!walkable(nx, nz)) continue;
      pairs++;
      const d = Math.abs(height(x, z) - height(nx, nz));
      if (d > worst) { worst = d; at = [x, z]; }
      if (d > 1.5 + 1e-6) cliffs++;
    }
  }
  return { ok: cliffs === 0, detail: `檢查 ${pairs} 組相鄰格，斷崖 ${cliffs}，最大高差 ${worst.toFixed(2)} @${at}` };
});

/* ---------------------------------------------------------------- 6. 道路 */
check('道路：全程可走且只有一區連通', () => {
  const road = W.road || [], loop = W.loop || [];
  const all = [...road, ...loop];
  if (all.length < 20) return { ok: false, detail: '道路點太少 ' + all.length };
  const bad = all.filter(([x, z]) => !walkable(x, z));
  // 連通：把道路點以 4 格內互相連接，檢查單一連通分量
  const parent = all.map((_, i) => i);
  const find = i => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const join = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; };
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
    if (Math.hypot(all[i][0] - all[j][0], all[i][1] - all[j][1]) <= 4) join(i, j);
  }
  const roots = new Set(all.map((_, i) => find(i)));
  const gateNear = all.some(([x, z]) => Math.abs(x) <= 6 && Math.abs(z - ((W.castle && W.castle.gate.z) || 64)) <= 8);
  return { ok: bad.length === 0 && roots.size === 1 && gateNear, detail: `點數 ${all.length} 不可走 ${bad.length} 連通分量 ${roots.size} 接得到城門=${gateNear}` };
});

check('道路：環路經過每一區的進場點', () => {
  const loop = W.loop || [];
  const bad = [];
  for (const z of W.zones || []) {
    const p = z.approach || z.gates; if (!p) { bad.push('#' + z.index + ' 缺 approach'); continue; }
    const d = Math.min(...loop.map(([x, zz]) => Math.hypot(x - p[0], zz - p[1])));
    if (d > 10) bad.push(`#${z.index} 距 ${d.toFixed(1)}`);
  }
  return { ok: bad.length === 0, detail: bad.length ? bad.join(' ; ') : '十區都在環路 10 格內' };
});

/* ---------------------------------------------------------------- 7. 海岸不規則 */
check('海岸：不規則且十區都留在大陸上', () => {
  const rs = [];
  for (let a = 0; a < 360; a += 1) rs.push(W.coastRadius ? W.coastRadius(a * Math.PI / 180) : NaN);
  const min = Math.min(...rs), max = Math.max(...rs);
  const inSea = (W.zones || []).filter(z => !W.isLand(z.x, z.z));
  const padsInSea = (W.zones || []).filter(z => !W.isLand(z.x + z.pad + 8, z.z) || !W.isLand(z.x, z.z + z.pad + 8));
  return { ok: (max - min) >= 25 && inSea.length === 0 && padsInSea.length === 0, detail: `半徑 ${min.toFixed(0)}~${max.toFixed(0)}（差 ${(max - min).toFixed(0)}）離岸區塊 ${inSea.length} 空地觸海 ${padsInSea.length}` };
});

/* ---------------------------------------------------------------- 8. 群系面積與形狀 */
check('群系：十個都成立、面積足夠、形狀不規則', () => {
  const biomes = W.biomes || [];
  if (biomes.length !== 10) return { ok: false, detail: 'biomes=' + biomes.length };
  const stat = new Map();
  const R = W.navHalf || 270;
  for (let x = -R; x <= R; x += cell) for (let z = -R; z <= R; z += cell) {
    if (!W.isLand(x, z)) continue;
    const b = W.biomeAt(x, z);
    if (!b) continue;
    const s = stat.get(b.id) || { n: 0, sx: 0, sz: 0, minX: 1e9, maxX: -1e9, minZ: 1e9, maxZ: -1e9, sq: 0 };
    s.n++; s.sx += x; s.sz += z; s.sq += x * x + z * z;
    s.minX = Math.min(s.minX, x); s.maxX = Math.max(s.maxX, x); s.minZ = Math.min(s.minZ, z); s.maxZ = Math.max(s.maxZ, z);
    stat.set(b.id, s);
  }
  const lines = [], bad = [];
  for (const b of biomes) {
    const s = stat.get(b.id);
    if (!s) { bad.push(b.id + ' 面積 0'); continue; }
    const cx = s.sx / s.n, cz = s.sz / s.n;
    const rmean = Math.sqrt(Math.max(0, s.sq / s.n - (cx * cx + cz * cz)));
    const box = (s.maxX - s.minX + cell) * (s.maxZ - s.minZ + cell) / (cell * cell);
    const fill = s.n / Math.max(1, box);
    // 不規則＝不是圓盤也不是矩形：填滿率明顯低於 1，且離心半徑有變異
    const irregular = fill < 0.92 && rmean > 8;
    const big = s.n >= 3000;
    lines.push(`${b.id}:${s.n}格 fill=${fill.toFixed(2)} r=${rmean.toFixed(0)}`);
    if (!big) bad.push(b.id + ' 面積僅 ' + s.n);
    if (!irregular) bad.push(b.id + ' 形狀太規則(fill=' + fill.toFixed(2) + ',r=' + rmean.toFixed(0) + ')');
  }
  return { ok: bad.length === 0, detail: (bad.length ? bad.join(' ; ') + ' || ' : '') + lines.join(' ') };
});

/* ---------------------------------------------------------------- 9. 城堡中央土地 */
check('城堡：中央土地 ≥ 3 倍、八邊形城牆完整、城門是唯一開口', () => {
  const c = W.castle || {};
  const dist = c.dist || (() => 0);
  const depth = c.depth || { plateau: 6 };
  const outer = c.outer || { x: 92, z: 78, cut: 42 };
  const sweep = outer.x + depth.plateau;
  let inside = 0, blockedInside = 0;
  for (let x = -sweep; x <= sweep; x += cell) for (let z = -sweep; z <= sweep; z += cell) {
    if (dist(x, z) > depth.plateau) continue;
    inside++;
    if (W.blocked(x, z)) blockedInside++; // 只有城牆與建築可以擋
  }
  const oldArea = (44 * 2) * (38 * 2) / (cell * cell);
  const ratio = inside / oldArea;
  /* 外牆取樣：八邊形的每一個牆格都必須是 blocked，只有城門開口例外。
     城門語意（重要）：門洞是「牆上的洞」，所以門洞格必須不是 blocked，而且必須 walkable。 */
  const gx = c.gate ? c.gate.x : 0;
  const isGate = (x, z) => Math.abs(x - gx) <= 3.9 && z <= outer.z + .01 && z >= outer.z - cell - .01;
  let wallCells = 0, wallHoles = 0, gateSealed = 0, gateNotWalkable = 0;
  for (let x = -sweep; x <= sweep; x += cell) for (let z = -sweep; z <= sweep; z += cell) {
    const d = dist(x, z);
    if (d > 0 || d < -2.45) continue;
    wallCells++;
    if (isGate(x, z)) {
      if (W.blocked(x, z)) gateSealed++;
      if (!W.walkable(x, z)) gateNotWalkable++;
      continue;
    }
    if (!W.blocked(x, z)) wallHoles++;
  }
  return {
    ok: ratio >= 3 && wallCells > 400 && wallHoles === 0 && gateSealed === 0 && gateNotWalkable === 0,
    detail: `中央格數 ${inside}（舊制 ${oldArea.toFixed(0)} → ${ratio.toFixed(2)} 倍）| 外牆取樣 ${wallCells} 格 牆上有洞 ${wallHoles} 城門被填死 ${gateSealed} 城門走不通 ${gateNotWalkable} | 內部被擋 ${blockedInside} 格（應只有建築）`
  };
});

/* ------------------------------------------------- 9b. 兩圈防禦與主堡的間距 */
check('城堡：兩圈防禦彼此拉開、內層到主堡也拉開', () => {
  const c = W.castle, k = c.keep || { x: 10, zMin: -17, zMax: 1, tower: 4.2 };
  const keepX = k.x + k.tower, keepZMin = k.zMin - k.tower, keepZMax = k.zMax + k.tower;
  const gaps = [
    ['外牆→內牆（東西）', c.outer.x - c.inner.x],
    ['外牆→內牆（北側）', c.inner.zMin + c.outer.z],
    ['外牆→內牆（南側）', c.outer.z - c.inner.zMax],
    ['內牆→主堡（東西）', c.inner.x - keepX],
    ['內牆→主堡（北側）', c.inner.zMax - keepZMax],
    ['內牆→主堡（南側）', keepZMin - c.inner.zMin]
  ];
  const worst = Math.min(...gaps.map(g => g[1]));
  return {
    ok: worst >= 26,
    detail: gaps.map(([name, v]) => name + ' ' + v.toFixed(1)).join(' | ') + '（最小 ' + worst.toFixed(1) + '，門檻 26）'
  };
});

/* ---------------------------------------------------------------- 10. 移動規則 */
check('移動規則：validStep 不會允許穿牆／掉下去', () => {
  const z0 = (W.zones || [])[0];
  if (!z0) return { ok: false, detail: '沒有 zones' };
  const blockedTarget = W.validStep([z0.x, z0.z], [z0.x + 400, z0.z + 400]);
  const insidePad = W.validStep([z0.x, z0.z], [z0.x + cell, z0.z]);
  let steepAccepted = 0, steepTotal = 0, cornerCut = 0, diagonalSteps = 0;
  const R = W.navHalf || 270;
  for (let x = -R; x <= R; x += 40) for (let z = -R; z <= R; z += 40) {
    for (const [dx, dz] of [[cell, 0], [0, cell], [cell, cell]]) {
      const a = [x, z], b = [x + dx, z + dz];
      if (!walkable(a[0], a[1]) || !walkable(b[0], b[1])) continue;
      const dh = Math.abs(height(a[0], a[1]) - height(b[0], b[1]));
      if (dh > 1.5) { steepTotal++; if (W.validStep(a, b)) steepAccepted++; }
      // 斜向一步必須兩側正交格都可走，否則就是切過牆角
      if (dx && dz && W.validStep(a, b)) {
        diagonalSteps++;
        if (!walkable(x + dx, z) || !walkable(x, z + dz)) cornerCut++;
      }
    }
  }
  return {
    ok: blockedTarget === false && insidePad === true && steepAccepted === 0 && cornerCut === 0,
    detail: `大陸外= ${blockedTarget}（應 false）平地格= ${insidePad}（應 true）陡坡被接受 ${steepAccepted}/${steepTotal} 斜向切角 ${cornerCut}/${diagonalSteps}`
  };
});

/* ---------------------------------------------------------------- 11. 方塊預算
   直接叫產生器跑一遍並數方塊，而不是用「每格三個方塊」估算——地圖改成三層 LOD
   （近 2 格、中 4 格、遠 8 格）之後，估算會高估將近三倍。 */
check('預算：真正產生的方塊數與三角形', () => {
  const R = W.navHalf || 270;
  let cells = 0, water = 0;
  for (let x = -R; x <= R; x += cell) for (let z = -R; z <= R; z += cell) {
    if (!W.isLand(x, z)) continue;
    cells++;
    if (W.blocked(x, z)) water++;
  }
  const terrain = require('../js/terrain-geometry.js').buildTerrain('94721');
  const castle = require('../js/castle-geometry.js').buildCastle(314159);
  const count = b => Object.values(b).reduce((n, rows) => n + rows.length, 0);
  const land = count(terrain.batches), built = count(castle.batches);
  const blocks = land + built, tris = blocks * 12;
  const budget = 400000;
  return {
    ok: blocks <= budget,
    detail: `陸地 ${cells} 格（擋格 ${water}）→ 地形 ${land} 塊 ＋ 城堡 ${built} 塊 ＝ ${blocks} 塊 / ${(tris / 1e6).toFixed(2)}M 三角形（預算 ${budget}）`
  };
});

/* ---------------------------------------------------------------- 輸出 */
let failed = 0;
const pad = Math.max(...results.map(r => r.name.length));
console.log('== 世界地圖驗收（Phase 1）==');
for (const r of results) {
  if (!r.ok) failed++;
  console.log(`${r.ok ? '✔' : '✘'} ${r.name.padEnd(pad)}  ${r.detail}`);
}
console.log(`\n${results.length - failed}/${results.length} 通過`);
process.exit(failed ? 1 : 0);
