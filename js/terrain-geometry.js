/* The rendered ground, hazards and scenery consume the same map as navigation. */
function buildTerrain(seed) {
  const W = globalThis.WorldMap || (typeof require === 'function' ? require('./world-map.js') : null);
  if (!W) throw Error('WorldMap is required before terrain geometry');
  const batches = {terrain: [], water: [], nature: []};
  let salt = 2166136261;
  for (const c of String(seed ?? W.seed)) salt = Math.imul(salt ^ c.charCodeAt(0), 16777619) >>> 0;
  function hash(x, z, n = 0) {
    let h = (Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263) ^ salt ^ Math.imul(n, 1442695041)) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function add(group, x, y, z, sx, sy, sz, material, shade = 1) {
    if (sy > 0) batches[group].push([x, y, z, sx, sy, sz, material, shade]);
  }
  function column(cx, cz, size) {
    if (!W.isLand(cx, cz)) return;
    const top = W.height(cx, cz), surface = W.surface(cx, cz);
    const shade = .86 + hash(cx, cz, 14) * .18;
    const wet = surface === 'water' || surface === 'lava';
    const floor = wet ? Math.min(top - 1.5, -1) : top - .42;
    const bottom = -7 - Math.floor(hash(cx, cz, 15) * 4);
    const split = bottom + (floor - bottom) * .52;
    add('terrain', cx, (bottom + split) / 2, cz, size, split - bottom, size, 'rock', shade * .86);
    add('terrain', cx, (split + floor) / 2, cz, size, floor - split, size, wet ? 'rock' : W.biomeAt(cx, cz)?.edge || 'earth', shade);
    if (wet) add('water', cx, top - .1, cz, size + .005, .2, size + .005, surface, shade);
    else add('terrain', cx, top - .21, cz, size, .42, size, surface, shade);
  }
  /* 三層 LOD：城堡周邊 2 格、中距離 4 格、外圈 8 格。地圖放大兩倍之後，外圈如果
     還用 4 格，方塊數會多一倍；遠區只佔畫面幾十像素，8 格看不出差別。 */
  const half = W.navHalf, NEAR = 175, MID = 400;
  for (let x = -NEAR; x <= NEAR; x += 2) for (let z = -NEAR; z <= NEAR; z += 2) column(x, z, 2);
  for (let x = -MID; x <= MID; x += 4) for (let z = -MID; z <= MID; z += 4) {
    /* 只跳過「整塊都在細格範圍內」的中格：臨界那一格要留著，否則兩層之間會露出
       一條 2 格寬的縫（遠看就是一條白色直線）。 */
    if (Math.abs(x) < NEAR - 1 && Math.abs(z) < NEAR - 1) continue;
    column(x, z, 4);
  }
  for (let x = -half + 4; x <= half; x += 8) for (let z = -half + 4; z <= half; z += 8) {
    if (Math.abs(x) <= MID && Math.abs(z) <= MID) continue;
    column(x, z, 8);
  }
  // The causeway crosses the moat on the same y=4 plane as both gates.
  const gateZ = W.castle.gate.z;
  for (let z = gateZ + 4; z <= gateZ + 20; z += 2) {
    add('terrain', 0, 4.055, z, 8, .11, 1.94, 'wood', .83 + hash(0, z, 20) * .16);
  }
  for (const x of [-4.7, 4.7]) {
    add('nature', x, 4.6, gateZ + 12, .27, .25, 19, 'wood', .89);
    for (let z = gateZ + 4; z <= gateZ + 20; z += 4) add('nature', x, 4.95, z, .38, 1.9, .38, 'wood', .96);
  }
  function tree(x, z, ground, dark = false) {
    const tall = (dark ? 8 : 6) + hash(x, z, 30) * 3;
    add('nature', x, ground + tall * .44, z, .8, tall * .88, .8, 'trunk');
    if (dark) {
      for (let i = 0; i < 4; i++) add('nature', x + (i % 2 ? .5 : -.5), ground + tall * (.55 + i * .105), z, 5.8 - i * .5, tall * .16, 5.8 - i * .5, 'leaf', .66 + hash(x, z, 31 + i) * .15);
    } else {
      for (let i = 0; i < 5; i++) add('nature', x, ground + tall * (.42 + i * .12), z, 5.6 - i * .85, tall * .18, 5.6 - i * .85, 'leaf', .83 + hash(x, z, 31 + i) * .2);
    }
  }
  for (const p of W.props) {
    const {x, z, ground: y, kind} = p;
    if (kind === 'tree') {
      if (p.biome === 'mushroom_fields') {
        const height = 5 + hash(x, z, 41) * 4;
        add('nature', x, y + height * .48, z, 1.25, height * .96, 1.25, 'cloth');
        add('nature', x, y + height, z, 6.5, .9, 5.8, 'banner');
        add('nature', x, y + height + .6, z, 4, .5, 3.8, 'banner');
      } else if (p.biome === 'desert' || p.biome === 'badlands') {
        add('nature', x, y + 2.5, z, 1, 5, 1, p.biome === 'desert' ? 'cactus' : 'wood');
        for (const side of [-1, 1]) add('nature', x + side * 1.1, y + 2.6, z, 1.5, .8, .9, p.biome === 'desert' ? 'cactus' : 'wood');
      } else tree(x, z, y, p.biome === 'dark_forest');
    } else if (kind === 'spire' || kind === 'pillar' || kind === 'iceSpike') {
      const mat = kind === 'iceSpike' ? 'packedIce' : kind === 'pillar' ? 'stoneDark' : 'rock';
      const height = Math.max(2, p.top - y);
      add('nature', x, y + height * .42, z, 2.5, height * .84, 2.5, mat, .88);
      add('nature', x, y + height * .92, z, 1.35, height * .22, 1.35, mat, 1.06);
    } else if (kind === 'lava' || kind === 'pond') {
      add('nature', x, y + .25, z, 3.1, .5, 3.1, 'rock', .77);
      add('water', x, y + .52, z, 2.3, .09, 2.3, kind === 'lava' ? 'lava' : 'water');
    }
  }
  return {batches};
}

if (typeof module !== 'undefined' && module.exports) module.exports = {buildTerrain};
