(function (g) {
  'use strict';
  /* ---------------------------------------------------------------- 世界地圖
     地形高度、碰撞與尋路只有這一份來源：畫面（terrain-geometry.js）與模擬
     （game-core.js）都讀它，所以「畫得出來的」和「走得到的」永遠是同一件事。
     規格見 docs/WORLD-MAP-SPEC.md，驗收見 tools/world-audit.cjs。
     全部由固定種子決定，不碰玩法亂數，重新產生必然一模一樣。 */
  const SEED_TEXT = '94721';
  let seedNumber = 2166136261;
  for (let i = 0; i < SEED_TEXT.length; i++) seedNumber = Math.imul(seedNumber ^ SEED_TEXT.charCodeAt(i), 16777619) >>> 0;

  /* 座標雜湊與值雜訊：與 js/terrain-geometry.js 同一套，重建才會一致。 */
  function hash(x, z, salt) {
    let h = (Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263) ^ seedNumber ^ Math.imul(salt | 0, 1442695041)) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = t => t * t * (3 - 2 * t);
  const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
  function noise(x, z, scale, salt) {
    const px = x / scale, pz = z / scale, ix = Math.floor(px), iz = Math.floor(pz);
    const tx = smooth(px - ix), tz = smooth(pz - iz);
    return lerp(lerp(hash(ix, iz, salt), hash(ix + 1, iz, salt), tx), lerp(hash(ix, iz + 1, salt), hash(ix + 1, iz + 1, salt), tx), tz);
  }
  /* 兩個八度、坡度刻意壓在 1.35/格以下：走得到的坡面不會出現斷崖。 */
  function reliefNoise(x, z, scale, salt) {
    return (noise(x, z, scale, salt) - .5) * 1.36 + (noise(x, z, scale * .5, salt + 17) - .5) * .5;
  }

  /* ---------------------------------------------------------------- 尺度 */
  const CELL = 2;              // 網格步長，與舊地形一致
  const SPAN = 320;            // 預先算好的地形範圍（±320）
  const NAV_HALF = 288;        // A* 可活動範圍；比 SPAN 窄，路線不會撞到預算邊界
  const RADIUS = 252;          // 海岸基準半徑
  const ARENA_Y = 4;           // 城堡台地與競技場空地的固定高度
  const PAD = 30;              // 每區整平空地半徑（規格值）
  const ROAD_HALF = 5;         // 路面半寬
  /* ---------------------------------------------------------------- 城堡
     外圈是八邊形：四邊 ±92／±78，四角各向内切 42。切角不是裝飾，是為了讓兩圈都能
     往外長——zone 2 的競技場正好壓在城堡西南方的對角線上，方形外角一長大就會撞
     進它的空地。護城河、台地與城堡特區都是這個八邊形等距外推。 */
  const OUTER = { x: 92, z: 78, cut: 42, top: 13 };   // 牆體高 9（原本 14，降 1/3）
  const CHAMFER = OUTER.x + OUTER.z - OUTER.cut;   // 切角線：|x| + |z| = CHAMFER
  /* 八邊形的向外距離：正值在城外，負值在城內。凸多邊形取各邊距離的最大值即為精確值。 */
  function castleDist(x, z) {
    return Math.max(Math.abs(x) - OUTER.x, Math.abs(z) - OUTER.z, (Math.abs(x) + Math.abs(z) - CHAMFER) / Math.SQRT2);
  }
  const PLATEAU_D = 6, MOAT_D = 16, CLEAR_D = 20;
  const PLATEAU = [OUTER.x + PLATEAU_D, OUTER.z + PLATEAU_D];  // 城堡台地（全平地）
  const MOAT = [OUTER.x + MOAT_D, OUTER.z + MOAT_D];           // 護城河外緣
  const CLEAR = [OUTER.x + CLEAR_D, OUTER.z + CLEAR_D];        // 城堡特區：不屬於任何群系
  const INNER = { x: 57, zMin: -50, zMax: 36, top: 17 };   // 牆體高 13（原本 20，降 1/3）
  /* 主堡的佔地（含四角圓塔）：審查腳本用它算「內圈到主堡」的間距，不必重複寫數字。 */
  const KEEP = { x: 10, zMin: -17, zMax: 1, tower: 4.2 };
  const GATE = { x: 0, z: OUTER.z };
  const SPAWN = [0, 32];
  const MOAT_Y = 2.2, OCEAN_Y = -1.4, SLOPE = 1.35;

  /* ---------------------------------------------------------------- 生物群系
     每個群系＝一個 Minecraft 主世界群系家族的對照：地表方塊、邊坡、基準高度、
     起伏振幅與波長。波長刻意取大，起伏就溫和，人走起來不會卡在陡坡上。 */
  const SURFACES = ['grass', 'earth', 'path', 'rock', 'stone', 'stoneDark', 'sand', 'redSand', 'terracotta', 'snow', 'mud', 'mycelium', 'sculk', 'water', 'gravel', 'packedIce', 'ice', 'lava'];
  const SURF = Object.fromEntries(SURFACES.map((s, i) => [s, i]));
  const BIOME_ROWS = [
    /* id, 遊戲名, MC 群系, 地表, 邊坡, 基準, 起伏, 波長, 會擋人的裝飾, 樹/裝飾密度 */
    ['plains', '翠綠草原', 'Plains', 'grass', 'earth', 3.2, 1.7, 30, '', .016],
    ['dark_forest', '幽暗森林', 'Dark Forest', 'grass', 'earth', 3.6, 2.6, 28, '', .12],
    ['stony_peaks', '灰燼洞穴', 'Stony Peaks & Caves', 'rock', 'gravel', 5.0, 4.6, 34, 'spire', .020],
    ['badlands', '烈焰火山', 'Badlands', 'redSand', 'terracotta', 4.0, 3.0, 30, 'lava', .016],
    ['snowy_plains', '冰封高原', 'Snowy Plains & Ice Spikes', 'snow', 'packedIce', 3.4, 2.4, 30, 'iceSpike', .018],
    ['desert', '黃沙荒漠', 'Desert', 'sand', 'sand', 3.2, 2.0, 26, '', .018],
    ['swamp', '詛咒沼澤', 'Swamp & Mangrove', 'mud', 'mud', 2.6, 1.0, 30, 'pond', .020],
    ['windswept_hills', '蒼穹之塔', 'Windswept Hills & Jagged Peaks', 'rock', 'stone', 5.5, 5.4, 40, 'spire', .022],
    ['deep_dark', '深淵裂谷', 'Deep Dark & Dripstone Caves', 'sculk', 'stoneDark', 2.6, 3.4, 30, 'pillar', .020],
    ['mushroom_fields', '神話之域', 'Mushroom Fields', 'mycelium', 'mycelium', 4.2, 2.8, 30, '', .018]
  ];
  const biomes = BIOME_ROWS.map((r, i) => ({
    id: r[0], zone: i + 1, name: r[1], mc: r[2], surface: r[3], edge: r[4],
    base: r[5], relief: r[6], scale: r[7], blockedKind: r[8], density: r[9], water: r[8] === 'pond' ? MOAT_Y : (r[8] === 'lava' ? 3.4 : null)
  }));

  /* ---------------------------------------------------------------- 十區配置
     距離＝難度順序（規格表），方位以 36° 為底再各自抖動 ±5°，抖動後仍遞增，
     所以不會交叉，也能保證兩兩間距 ≥ 58（空地不會互相重疊）。 */
  const ZONE_D = [130, 146, 160, 174, 187, 199, 210, 220, 229, 237];
  const ZONE_JUNCTION = 5;     // 城門大道接上環路的位置：第 6 區與第 7 區之間
  /* 內圈的群系會被城堡切掉一塊，權重調小讓面積跟外圈接近。 */
  const REGION_W = [.86, .90, .94, .97, .99, 1, 1, 1, 1, 1];
  const zoneBearing = i => (-170 + 36 * i + (hash(i * 29 + 7, 13, 911) - .5) * 10) * Math.PI / 180;
  const zones = ZONE_D.map((d, i) => {
    const b = zoneBearing(i), c = Math.cos(b), s = Math.sin(b);
    /* 座標對齊網格：空地的樣本點與格點重合，整平檢查才不會被內插扯歪。 */
    const x = Math.round(s * d / CELL) * CELL, z = Math.round(c * d / CELL) * CELL;
    /* 進場點在空地外緣：方位增加方向的切線，稍微往內收，環路才會貼著各區走。 */
    const tx = c, tz = -s, ux = tx - .55 * s, uz = tz - .55 * c, n = Math.hypot(ux, uz);
    const u = [ux / n, uz / n];
    return {
      index: i + 1, id: i + 1, name: BIOME_ROWS[i][1], distance: Math.hypot(x, z), bearing: b, x, z,
      pad: PAD, biome: biomes[i], u, yaw: Math.atan2(-u[0], -u[1]),
      approach: [x + u[0] * 42, z + u[1] * 42],
      gates: [x + u[0] * 13, z + u[1] * 13]
    };
  });

  /* ---------------------------------------------------------------- 海岸線
     諧波給不規則外形，再讓每一區附近外凸，保證「空地＋緩坡＋沙灘」一定在陸地上。 */
  const NEED = zones.map(zn => zn.distance + PAD + 18);
  function coastRadius(a) {
    let r = RADIUS + 14 * Math.sin(a * 2.3 + .7) + 8 * Math.sin(a * 3.9 + 2.1) + 6 * Math.sin(a * 1.3 + 4.4);
    for (let i = 0; i < zones.length; i++) {
      let d = Math.abs(a - zones[i].bearing);
      if (d > Math.PI) d = Math.PI * 2 - d;
      if (d >= .96) continue;
      const t = d <= .26 ? 1 : Math.cos((d - .26) / .70 * Math.PI / 2);
      if (t > 0) r = Math.max(r, NEED[i] * t);
    }
    return r;
  }
  const isLandAt = (x, z) => Math.hypot(x, z) <= coastRadius(Math.atan2(x, z));

  /* ---------------------------------------------------------------- 群系分區
     先把取樣點做域扭曲（domain warp）再比距離，邊界就會有機地互相咬合，而不是
     正圓或直線；高度則用前兩名的權重混合，交界不會出現跳崖。 */
  function regionBlend(x, z) {
    const wx = x + (noise(x, z, 34, 701) - .5) * 52 + (noise(x, z, 13, 703) - .5) * 16;
    const wz = z + (noise(x, z, 34, 702) - .5) * 52 + (noise(x, z, 13, 704) - .5) * 16;
    let best = -1, bestScore = Infinity;
    const score = [];
    for (let i = 0; i < biomes.length; i++) {
      const sc = Math.hypot(wx - zones[i].x, wz - zones[i].z) * REGION_W[i];
      score.push(sc);
      if (sc < bestScore) { bestScore = sc; best = i; }
    }
    let wsum = 0, base = 0, relief = 0, scale = 0;
    for (let i = 0; i < biomes.length; i++) {
      const w = Math.max(0, 1 - (score[i] - bestScore) / 46);
      if (w <= 0) continue;
      wsum += w; base += w * biomes[i].base; relief += w * biomes[i].relief; scale += w * biomes[i].scale;
    }
    return { bio: best, base: base / wsum, relief: relief / wsum, scale: scale / wsum };
  }

  /* 未經道路／水面／城牆處理的地表高度；道路的高度基準也取這裡，路才會跟著地形走。
     陸地一律不低於水面高度：可走的地方不會沉到水下，也不會出現看不見底的坑。 */
  function sampleTerrain(x, z) {
    const b = regionBlend(x, z);
    let h = b.bio < 0 || castleDist(x, z) <= CLEAR_D ? ARENA_Y : Math.max(2.2, b.base + b.relief * reliefNoise(x, z, b.scale, 311));
    const cd = castleDist(x, z) - PLATEAU_D;
    if (cd <= 0) return { bio: b.bio, h: ARENA_Y };
    if (cd < 34) h = lerp(ARENA_Y, h, smooth(cd / 34));
    let flat = 0;
    for (let i = 0; i < zones.length; i++) {
      const d = Math.hypot(x - zones[i].x, z - zones[i].z);
      if (d >= PAD + 26) continue;
      const w = 1 - smooth(clamp((d - PAD) / 26, 0, 1));
      if (w > flat) flat = w;
    }
    if (flat > 0) h = lerp(h, ARENA_Y, flat);
    const rr = Math.hypot(x, z), cr = coastRadius(Math.atan2(x, z));
    if (rr > cr) return { bio: b.bio, h: lerp(h, OCEAN_Y, clamp((rr - cr) / 10, 0, 1)) };
    if (rr > cr - 16) h = lerp(h, 2.2, clamp((rr - (cr - 16)) / 16, 0, 1));
    return { bio: b.bio, h };
  }

  /* ---------------------------------------------------------------- 道路
     城門大道筆直走出城，環路是穿過十區進場點的有機封閉樣條。路面會把地形削成
     走廊（高度取樣條自身的高度），所以道路一定可走，也一定接得到城門與各區閘門。 */
  function catmullClosed(control, spacing) {
    const raw = [], n = control.length;
    for (let i = 0; i < n; i++) {
      const p0 = control[(i - 1 + n) % n], p1 = control[i], p2 = control[(i + 1) % n], p3 = control[(i + 2) % n];
      for (let s = 0; s < 12; s++) {
        const t = s / 12, t2 = t * t, t3 = t2 * t;
        raw.push([
          .5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
          .5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
        ]);
      }
    }
    raw.push([control[0][0], control[0][1]]);
    return resample(raw, spacing);
  }
  /* 依固定弧長重取樣：連通檢查只看 4 格內的相鄰點，所以間距必須穩定。 */
  function resample(points, spacing) {
    const out = [[points[0][0], points[0][1]]];
    let last = out[0], acc = 0;
    for (let i = 1; i < points.length; i++) {
      const p = points[i];
      let dx = p[0] - last[0], dz = p[1] - last[1], d = Math.hypot(dx, dz);
      while (acc + d >= spacing && d > 1e-9) {
        const need = spacing - acc, nx = last[0] + dx / d * need, nz = last[1] + dz / d * need;
        out.push([nx, nz]);
        dx = p[0] - nx; dz = p[1] - nz; last = [nx, nz]; acc = 0; d = Math.hypot(dx, dz);
      }
      acc += d; last = [p[0], p[1]];
    }
    return out;
  }
  const JUNCTION = [0, 118];
  const loopControl = [];
  for (let i = 0; i < zones.length; i++) {
    loopControl.push(zones[i].approach);
    if (i === ZONE_JUNCTION) { loopControl.push(JUNCTION); continue; }
    const mid = (-170 + 36 * (i + .5)) * Math.PI / 180;
    const radius = (zones[i].distance + ZONE_D[(i + 1) % zones.length]) / 2 + 12;
    loopControl.push([Math.round(Math.sin(mid) * radius), Math.round(Math.cos(mid) * radius)]);
  }
  const loop = catmullClosed(loopControl, 2);
  const causeway = resample([[0, 16], [0, 26], [SPAWN[0], SPAWN[1]], [0, 48], [0, 62], [0, GATE.z], [0, 92], [0, 104], JUNCTION], 2);

  /* ---------------------------------------------------------------- 網格
     先把地形算成固定網格，之後所有查詢（高度、可走、障礙）都只是讀表，模擬端每
     一幀呼叫也不會有效能問題，而且查詢結果與畫面產生器完全一致。 */
  const N = 2 * (SPAN / CELL) + 1;
  const H = new Float32Array(N * N);
  const FLAG = new Uint8Array(N * N);   // 1=陸地 2=實體結構 4=門洞（非實體、可通行）8=城牆本體
  const D_OPEN = 4, WALL = 8;
  const BIO = new Uint8Array(N * N);    // 255=不屬於任何群系
  const SURFID = new Uint8Array(N * N);
  const LOCK = new Uint8Array(N * N);   // 空地：不參與坡度整修，永遠保持全平
  const roadW = new Float32Array(N * N), roadH = new Float32Array(N * N);
  const nodeIndex = (x, z) => Math.round((x + SPAN) / CELL) + Math.round((z + SPAN) / CELL) * N;
  const ix = x => Math.round((x + SPAN) / CELL);
  const jz = z => Math.round((z + SPAN) / CELL);
  const nodeX = i => -SPAN + i * CELL;

  /* 路面先寫進 roadW／roadH，再由節點把地形拉過去；城堡空地一律跳過，維持全平。 */
  function carveRoad(list) {
    for (let s = 0; s < list.length; s++) {
      const sx = list[s][0], sz = list[s][1], ph = sampleTerrain(sx, sz).h;
      const span = Math.ceil((ROAD_HALF + 6) / CELL);
      const ci = ix(sx), cj = jz(sz);
      for (let i = ci - span; i <= ci + span; i++) for (let j = cj - span; j <= cj + span; j++) {
        if (i < 0 || j < 0 || i >= N || j >= N) continue;
        const x = nodeX(i), z = nodeX(j), d = Math.hypot(x - sx, z - sz);
        if (d > ROAD_HALF + 6) continue;
        let inPad = false;
        for (let k = 0; k < zones.length; k++) if (Math.hypot(x - zones[k].x, z - zones[k].z) < PAD + 1.5) { inPad = true; break; }
        if (inPad) continue;
        const w = d <= ROAD_HALF ? 1 : 1 - (d - ROAD_HALF) / 6, at = j * N + i;
        if (w > roadW[at]) { roadW[at] = w; roadH[at] = ph; }
      }
    }
  }
  carveRoad(causeway);
  carveRoad(loop);
  const roadCell = new Uint8Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const at = j * N + i;
    if (roadW[at] >= 1 - 1e-6) { roadCell[at] = 1; roadW[at] = 1; }
  }

  for (let j = 0; j < N; j++) {
    const z = nodeX(j);
    for (let i = 0; i < N; i++) {
      const x = nodeX(i), at = j * N + i;
      if (!isLandAt(x, z)) { H[at] = OCEAN_Y; SURFID[at] = SURF.water; continue; }
      const t = sampleTerrain(x, z);
      FLAG[at] = 1;
      BIO[at] = t.bio < 0 ? 255 : t.bio;
      H[at] = t.h;
      SURFID[at] = t.bio < 0 ? SURF.grass : SURF[biomes[t.bio].surface];
    }
  }

  /* 城堡：兩圈城牆是實心（唯一開口在城門），護城河是水，路面本身就是橋。 */
  const onLine = (v, t) => Math.abs(v - t) < .01;
  const wallCells = fixed => {
    const base = fixed > 0 ? Math.ceil(fixed / CELL) * CELL : Math.floor(fixed / CELL) * CELL;
    return [base, base + (fixed > 0 ? -CELL : CELL)];
  };
  const wallAt = (value, fixed) => wallCells(fixed).includes(value);
  const wallAtAbs = (value, fixed) => wallCells(fixed).includes(Math.abs(value));
  for (let j = 0; j < N; j++) {
    const z = nodeX(j);
    for (let i = 0; i < N; i++) {
      const x = nodeX(i), at = j * N + i;
      if (!(FLAG[at] & 1)) continue;
      /* 門洞寬度必須與 castle-geometry.js 畫的拱門一致（archOpening 的 wide=3 → |x| ≤ 3），
         否則導航會讓人在「牆有被畫出來」的格子上走出去，就是穿牆。 */
      /* 外圈是八邊形，內圈仍是方形；門洞寬度必須與 castle-geometry.js 畫的拱門一致。 */
      const gate = (wallAt(z, GATE.z) || wallAt(z, INNER.zMax)) && Math.abs(x - GATE.x) <= 3;
      const dCastle = castleDist(x, z);
      const outerWall = dCastle <= 0 && dCastle >= -2.45;
      const innerWall = (wallAtAbs(x, INNER.x) && z >= INNER.zMin - .01 && z <= INNER.zMax + .01) ||
        (wallAt(z, INNER.zMin) && Math.abs(x) <= INNER.x + .01) || (wallAt(z, INNER.zMax) && Math.abs(x) <= INNER.x + .01);
      /* 城門是「牆上的門洞」：門洞格既不是實心（blocked 為 false，牆線在這裡真的斷開），
         也一定可以走（walkable 為 true）。blocked() 只描述實心結構，不描述能不能通過；
         二者只在水與岩石上一致。這樣渲染、碰撞、尋路三邊吃到的都是同一個事實。 */
      if (outerWall || innerWall) { FLAG[at] |= WALL | (gate ? D_OPEN : 2); H[at] = ARENA_Y; SURFID[at] = SURF.stoneDark; continue; }
      const plateau = dCastle <= PLATEAU_D;
      /* 護城河是水，但橋面例外：路廊本身就是橋，高度沿用路面。 */
      if (!plateau && !roadCell[at] && dCastle < MOAT_D) { FLAG[at] |= 2; H[at] = MOAT_Y; SURFID[at] = SURF.water; continue; }
      if (roadCell[at]) { SURFID[at] = SURF.path; H[at] = lerp(H[at], roadH[at], roadW[at]); }
    }
  }
  /* 空地：整平到固定高度並鎖住，外緣 26 格才接回群系。 */
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const at = j * N + i, x = nodeX(i), z = nodeX(j);
    for (let k = 0; k < zones.length; k++) {
      if (Math.hypot(x - zones[k].x, z - zones[k].z) > PAD) continue;
      H[at] = ARENA_Y; LOCK[at] = 1; SURFID[at] = SURF.path; break;
    }
  }
  /* 道路走廊只清「水與岩石」的擋格（橋面就是靠這裡打開）；城牆一格都不能被清掉，
     牆上唯一的開口就是城門門洞，所以道路不可能在牆上另外鑿出縫。 */
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const at = j * N + i;
    if (roadCell[at] && (FLAG[at] & 1) && !(FLAG[at] & WALL)) { FLAG[at] &= ~2; SURFID[at] = SURF.path; }
  }

  /* 坡度整修：走得到的相鄰格（±2）高差一律壓到 1.35 以內。反覆投影到這個限制上，
     所以「走得到的地方一定沒有斷崖」是構造上的保證，不是隨機湊出來的。 */
  const walkNode = at => (FLAG[at] & 1) && (!(FLAG[at] & 2) || !!(FLAG[at] & D_OPEN));
  for (let pass = 0; pass < 24; pass++) {
    let changed = 0;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const at = j * N + i;
      if (!walkNode(at) || LOCK[at]) continue;
      let minN = Infinity, maxN = -Infinity;
      if (i > 0 && walkNode(at - 1)) { minN = Math.min(minN, H[at - 1]); maxN = Math.max(maxN, H[at - 1]); }
      if (i < N - 1 && walkNode(at + 1)) { minN = Math.min(minN, H[at + 1]); maxN = Math.max(maxN, H[at + 1]); }
      if (j > 0 && walkNode(at - N)) { minN = Math.min(minN, H[at - N]); maxN = Math.max(maxN, H[at - N]); }
      if (j < N - 1 && walkNode(at + N)) { minN = Math.min(minN, H[at + N]); maxN = Math.max(maxN, H[at + N]); }
      if (minN === Infinity) continue;
      /* 不能比最高的鄰居低超過 SLOPE，也不能比最低的鄰居高超過 SLOPE。 */
      const lower = maxN - SLOPE, upper = minN + SLOPE;
      const v = lower > upper ? (lower + upper) / 2 : clamp(H[at], lower, upper);
      if (Math.abs(v - H[at]) > 1e-4) { H[at] = v; changed++; }
    }
    if (!changed) break;
  }

  /* 障礙物：岩柱、岩漿池、冰刺、水潭、鐘乳石柱。單格或兩格、彼此不相連，而且不
     靠近道路或空地，才不會把大陸切斷；其餘裝飾（樹、仙人掌）不擋人。 */
  const props = [];
  const BLOCK_KINDS = { spire: 'rock', lava: 'lava', iceSpike: 'ice', pond: 'water', pillar: 'stoneDark' };
  const PROP_TOP = { spire: 4.6, iceSpike: 5.4, pillar: 3.2, lava: -.9, pond: -.6 };
  for (let j = 1; j < N - 1; j++) for (let i = 1; i < N - 1; i++) {
    const at = j * N + i;
    if (!walkNode(at) || BIO[at] === 255) continue;
    const b = biomes[BIO[at]], x = nodeX(i), z = nodeX(j);
    let nearPad = false, nearRoad = 0;
    for (let k = 0; k < zones.length; k++) if (Math.hypot(x - zones[k].x, z - zones[k].z) < PAD + 2) { nearPad = true; break; }
    if (nearPad) continue;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if (roadW[at + dj * N + di] > 0) nearRoad++;
    if (nearRoad) continue;
    if (hash(x, z, 1401) >= b.density) continue;
    const kind = b.blockedKind || 'tree';
    const blocking = !!BLOCK_KINDS[kind];
    if (blocking) {
      let blockedNeighbours = 0;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (FLAG[at + dj * N + di] & 2) blockedNeighbours++;
      if (blockedNeighbours > 1) continue;
      FLAG[at] |= 2;
      SURFID[at] = SURF[BLOCK_KINDS[kind]];
    } else if (kind === 'tree' && hash(x, z, 1407) < .45) continue;   // 樹不要太整齊
    /* 裝飾不改變地表高度：地表高度就是可站的地面，才不會出現假的陡坡。 */
    props.push({ x, z, kind, blocking, biome: b.id, ground: H[at], top: H[at] + (PROP_TOP[kind] || 0) });
  }

  /* ---------------------------------------------------------------- 查詢
     全部只讀表；height 用雙線性內插，所以角色站的位置與方塊表面一致。
     blocked／walkable 刻意分開：水、岩石、城牆本體是 blocked（實心）；城門門洞既不是
     blocked 也一定 walkable，所以「人物不會撞進牆裡」與「走得出去」同時成立；
     大陸以外的格子則是 blocked 且 walkable 皆 false。 */
  function height(x, z) {
    const fi = (x + SPAN) / CELL, fj = (z + SPAN) / CELL;
    if (fi < 0 || fj < 0 || fi > N - 1 || fj > N - 1) return OCEAN_Y;
    const i0 = Math.floor(fi), j0 = Math.floor(fj), i1 = Math.min(i0 + 1, N - 1), j1 = Math.min(j0 + 1, N - 1);
    const tx = fi - i0, tz = fj - j0;
    return lerp(lerp(H[j0 * N + i0], H[j0 * N + i1], tx), lerp(H[j1 * N + i0], H[j1 * N + i1], tx), tz);
  }
  function indexAt(x, z) {
    if (x < -SPAN - .001 || z < -SPAN - .001 || x > SPAN + .001 || z > SPAN + .001) return -1;
    return nodeIndex(x, z);
  }
  const isLand = (x, z) => { const at = indexAt(x, z); return at >= 0 && !!(FLAG[at] & 1); };
  const blocked = (x, z) => { const at = indexAt(x, z); return at < 0 || !!(FLAG[at] & 2); };
  const walkable = (x, z) => { const at = indexAt(x, z); return at >= 0 && walkNode(at); };
  const surface = (x, z) => { const at = indexAt(x, z); return at < 0 ? 'water' : SURFACES[SURFID[at]]; };
  const biomeAt = (x, z) => { const at = indexAt(x, z); return at < 0 || BIO[at] === 255 ? null : biomes[BIO[at]]; };

  /* 一格移動的合法性：兩邊都要能站、高差合格、對角不能切過牆角。 */
  function validStep(from, to) {
    const a = indexAt(from[0], from[1]), b = indexAt(to[0], to[1]);
    if (a < 0 || b < 0 || !walkNode(a) || !walkNode(b)) return false;
    const ai = a % N, aj = (a - ai) / N, bi = b % N, bj = (b - bi) / N;
    if (Math.abs(bi - ai) > 1 || Math.abs(bj - aj) > 1) return false;
    const dh = H[b] - H[a];
    if (dh > SLOPE + .05 || dh < -3.0) return false;
    if (bi !== ai && bj !== aj && (!walkNode(aj * N + bi) || !walkNode(bj * N + ai))) return false;
    return true;
  }

  /* ---------------------------------------------------------------- A*
     二元堆的 8 方向 A*；同樣吃 walkable／高差／不切角這三條規則，所以找出來的路
     一定符合移動規則，不存在「走得到但穿過牆」的路線。 */
  const MOVES = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.4142], [1, -1, 1.4142], [-1, 1, 1.4142], [-1, -1, 1.4142]];
  const NAV_I0 = Math.round((SPAN - NAV_HALF) / CELL), NAV_I1 = N - 1 - NAV_I0;
  const heap = new Int32Array(N * N), fScore = new Float64Array(N * N), gScore = new Float64Array(N * N);
  const stamp = new Int32Array(N * N), came = new Int32Array(N * N);
  let runId = 0, heapSize = 0;
  function heapPush(node) {
    let c = heapSize++;
    heap[c] = node;
    while (c > 0) {
      const p = (c - 1) >> 1;
      if (fScore[heap[p]] <= fScore[heap[c]]) break;
      const t = heap[p]; heap[p] = heap[c]; heap[c] = t; c = p;
    }
  }
  function heapPop() {
    const top = heap[0];
    heapSize--;
    if (heapSize > 0) {
      heap[0] = heap[heapSize];
      let c = 0;
      for (;;) {
        const l = c * 2 + 1, r = l + 1;
        let m = c;
        if (l < heapSize && fScore[heap[l]] < fScore[heap[m]]) m = l;
        if (r < heapSize && fScore[heap[r]] < fScore[heap[m]]) m = r;
        if (m === c) break;
        const t = heap[m]; heap[m] = heap[c]; heap[c] = t; c = m;
      }
    }
    return top;
  }
  const octile = (ai, aj, bi, bj) => {
    const dx = Math.abs(ai - bi), dz = Math.abs(aj - bj);
    return dx > dz ? dx + .4142 * dz : dz + .4142 * dx;
  };
  /* 就近找可站的一格：起點終點可能剛好落在裝飾物上。 */
  function nearestWalkable(pt) {
    const ci = ix(pt[0]), cj = jz(pt[1]);
    for (let r = 0; r <= 8; r++) {
      for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
        const i = ci + di, j = cj + dj;
        if (i < NAV_I0 || j < NAV_I0 || i > NAV_I1 || j > NAV_I1) continue;
        const at = j * N + i;
        if (walkNode(at)) return at;
      }
    }
    return -1;
  }
  function findPath(from, to) {
    const s = nearestWalkable(from), t = nearestWalkable(to);
    if (s < 0 || t < 0 || s === t) return [];
    runId++; heapSize = 0;
    const si = s % N, sj = (s - si) / N, ti = t % N, tj = (t - ti) / N;
    stamp[s] = runId; gScore[s] = 0; fScore[s] = 0; came[s] = -1;
    heapPush(s);
    let guard = 0;
    while (heapSize && guard++ < 300000) {
      const cur = heapPop();
      if (cur === t) {
        const path = [];
        for (let n = cur; n >= 0 && n !== s; n = came[n]) { const ni = n % N; path.push([nodeX(ni), nodeX((n - ni) / N)]); }
        return path.reverse();
      }
      const ci = cur % N, cj = (cur - ci) / N;
      for (let m = 0; m < MOVES.length; m++) {
        const ni = ci + MOVES[m][0], nj = cj + MOVES[m][1];
        if (ni < NAV_I0 || nj < NAV_I0 || ni > NAV_I1 || nj > NAV_I1) continue;
        const nk = nj * N + ni;
        if (!walkNode(nk)) continue;
        if (MOVES[m][0] && MOVES[m][1] && (!walkNode(cj * N + ni) || !walkNode(nj * N + ci))) continue;
        const dh = H[nk] - H[cur];
        if (dh > SLOPE + .05 || dh < -3.0) continue;
        const g = gScore[cur] + MOVES[m][2] * CELL;
        if (stamp[nk] === runId && g >= gScore[nk]) continue;
        stamp[nk] = runId; gScore[nk] = g; came[nk] = cur;
        fScore[nk] = g + octile(ni, nj, ti, tj) * CELL;
        heapPush(nk);
      }
    }
    return [];
  }

  /* ---------------------------------------------------------------- 路線
     A* 的結果先用 RDP 簡化，再用「與驗收完全相同」的 1 單位取樣逐點驗證；只要簡化
     後有任何一點落在障礙或陡坡上，就退回未簡化的原路徑。 */
  function rdp(points, eps) {
    if (points.length < 3) return points.slice();
    const keep = new Array(points.length).fill(false);
    keep[0] = keep[points.length - 1] = true;
    const stack = [[0, points.length - 1]];
    while (stack.length) {
      const [a, b] = stack.pop();
      if (b - a < 2) continue;
      const ax = points[a][0], az = points[a][1], bx = points[b][0], bz = points[b][1];
      const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz) || 1;
      let worst = -1, at = -1;
      for (let i = a + 1; i < b; i++) {
        const d = Math.abs((points[i][0] - ax) * dz - (points[i][1] - az) * dx) / len;
        if (d > worst) { worst = d; at = i; }
      }
      if (worst > eps) { keep[at] = true; stack.push([a, at], [at, b]); }
    }
    return points.filter((_, i) => keep[i]);
  }
  function traceOk(points) {
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i];
      const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const n = Math.max(1, Math.ceil(d / 1));
      for (let s = 0; s <= n; s++) {
        const t = s / n, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
        if (!walkable(x, z)) return false;
        if (s > 0) {
          const pt = (s - 1) / n, px = a[0] + (b[0] - a[0]) * pt, pz = a[1] + (b[1] - a[1]) * pt;
          if (Math.abs(height(x, z) - height(px, pz)) > 1.5) return false;
        }
      }
    }
    return true;
  }
  const routeCache = new Map(), betweenCache = new Map();
  /* 分段簡化：城門是必經節點，所以路線拆成「出生點→城門」「城門→該區」兩段，
     簡化不會把城門那一點吃掉，驗收才檢查得到「確實穿過城門」。 */
  function safeRoute(legs) {
    const tidy = leg => { const s = rdp(leg, 1.2); return traceOk(s) ? s : leg; };
    const join = list => {
      const out = [];
      for (const leg of list) for (const p of leg) {
        const last = out[out.length - 1];
        if (!last || Math.abs(last[0] - p[0]) > 1e-9 || Math.abs(last[1] - p[1]) > 1e-9) out.push(p);
      }
      return out;
    };
    const simplified = join(legs.map(tidy));
    if (traceOk(simplified)) return simplified;
    const raw = join(legs);
    return traceOk(raw) ? raw : simplified;
  }
  /* Runtime callers get the same treatment as the published routes: simplify first,
     then verify the simplification at 1-unit sampling, and fall back to the raw A*
     result when the shortcut turns out not to be walkable. */
  function smoothPath(points) {
    if (!points || points.length < 3) return points || [];
    const tidy = rdp(points, 1.2);
    return traceOk(tidy) ? tidy : points;
  }
  function routeTo(index) {
    const zn = zones[index - 1];
    if (!zn) return null;
    if (routeCache.has(index)) return routeCache.get(index);
    const toGate = findPath(SPAWN, [GATE.x, GATE.z]);
    const fromGate = findPath([GATE.x, GATE.z], zn.gates);
    const route = safeRoute([
      [[SPAWN[0], SPAWN[1]]].concat(toGate.length ? toGate : [[GATE.x, GATE.z]]),
      [[GATE.x, GATE.z]].concat(fromGate.length ? fromGate : [[zn.gates[0], zn.gates[1]]])
    ]);
    routeCache.set(index, route);
    return route;
  }
  function routeBetween(a, b) {
    const za = zones[a - 1], zb = zones[b - 1];
    if (!za || !zb) return null;
    const key = a + '-' + b;
    if (betweenCache.has(key)) return betweenCache.get(key);
    const path = findPath(za.gates, zb.gates);
    const route = safeRoute([[[za.gates[0], za.gates[1]]].concat(path.length ? path : [[zb.gates[0], zb.gates[1]]])]);
    betweenCache.set(key, route);
    return route;
  }

  const api = {
    seed: SEED_TEXT, cell: CELL, navHalf: NAV_HALF, radius: RADIUS,
    castle: { plateau: PLATEAU, moat: MOAT, clear: CLEAR, outer: OUTER, inner: INNER, keep: KEEP, gate: GATE, spawn: SPAWN, junction: JUNCTION, depth: { plateau: PLATEAU_D, moat: MOAT_D, clear: CLEAR_D }, dist: castleDist },
    zones, biomes, props, road: causeway, loop,
    coastRadius, isLand, height, surface, biomeAt, blocked, walkable,
    validStep, findPath, smoothPath, routeTo, routeBetween
  };
  g.WorldMap = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
