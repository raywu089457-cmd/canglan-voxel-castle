/* Deterministic voxel architecture. Coordinates are world-space cube centers. */
function buildCastle(seed = 314159) {
  const batches = { outer: [], inner: [], keep: [], courtyard: [] };
  const occupied = Object.fromEntries(Object.keys(batches).map(k => [k, new Set()]));
  let seedHash = 2166136261;
  for (const c of String(seed)) seedHash = Math.imul(seedHash ^ c.charCodeAt(0), 16777619);
  let randomState = seedHash >>> 0;
  function random() {
    randomState += 0x6D2B79F5;
    let t = randomState;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  function box(batch, x, y, z, sx = 1, sy = 1, sz = 1, material = 'stone', tone) {
    const key = `${x},${y},${z},${sx},${sy},${sz}`;
    if (occupied[batch].has(key)) return;
    occupied[batch].add(key);
    batches[batch].push([x, y, z, sx, sy, sz, material, tone ?? (0.85 + random() * 0.27)]);
  }
  function voxel(batch, x, y, z, material = 'stone') {
    box(batch, x, y + 0.5, z, 1, 1, 1, material);
  }
  function archOpening(t, y, bottom = 4, wide = 3, height = 7) {
    const level = y - bottom;
    return level >= 0 && level < height + wide && Math.abs(t) <= wide - Math.max(0, level - height + 1);
  }
  function floor(batch, minX, maxX, minZ, maxZ, y, material = 'stone', skip) {
    for (let x = minX; x <= maxX; x++) for (let z = minZ; z <= maxZ; z++) {
      if (!skip || !skip(x, z)) box(batch, x, y, z, 1, 0.45, 1, material);
    }
  }
  function banner(batch, x, y, z, direction = 'z', height = 6) {
    const alongZ = direction === 'z';
    box(batch, x, y + 0.7, z, alongZ ? 3.8 : 0.25, 0.24, alongZ ? 0.25 : 3.8, 'wood');
    for (let row = 0; row < height; row++) for (let col = -1; col <= 1; col++) {
      if (row === height - 1 && col === 0) continue;
      const gold = (row === 1 || row === 2 || row === 3) && col === 0;
      box(batch, x + (alongZ ? col : 0), y - row, z + (alongZ ? 0 : col),
        alongZ ? 0.96 : 0.13, 0.96, alongZ ? 0.13 : 0.96, gold ? 'light' : 'banner');
    }
  }
  function torch(batch, x, y, z) {
    box(batch, x, y, z, 0.28, 1.4, 0.28, 'wood');
    box(batch, x, y + 0.85, z, 0.55, 0.75, 0.55, 'light');
    box(batch, x, y + 0.35, z, 0.7, 0.15, 0.7, 'metal');
  }
  let towerCount = 0;
  function roundTower(batch, cx, cz, radius, top, roof = false, gateSide = false) {
    towerCount++;
    const bound = Math.ceil(radius + 1);
    const points = [];
    for (let dx = -bound; dx <= bound; dx++) for (let dz = -bound; dz <= bound; dz++) {
      const d = Math.hypot(dx, dz);
      if (d <= radius + 0.15) points.push([dx, dz, d]);
    }
    // Foundations extend to the moat bed wherever tower shells project beyond the plateau.
    if (batch === 'outer') for (const [dx, dz, d] of points) {
      if (d < radius - 1.35) continue;
      if (Math.abs(cx + dx) + 0.5 <= 78 && Math.abs(cz + dz) + 0.5 <= 70) continue;
      for (let y = 0; y < 4; y++) voxel(batch, cx + dx, y, cz + dz, 'stoneDark');
    }
    for (let y = 4; y < top; y++) for (const [dx, dz, d] of points) {
      if (d < radius - 1.35) continue;
      const slit = ((y >= 11 && y <= 13) || (y >= 19 && y <= 21) || (y >= 32 && y <= 34)) &&
        ((dx === 0 && Math.abs(dz) > radius - 1.4) || (dz === 0 && Math.abs(dx) > radius - 1.4));
      if (slit) continue;
      const ring = y === 5 || y === top - 5;
      voxel(batch, cx + dx, y, cz + dz, ring ? 'stoneDark' : 'stone');
    }
    // Widened corbel ring, roof-level deck and a hollow crenellated parapet.
    for (let dx = -bound; dx <= bound; dx++) for (let dz = -bound; dz <= bound; dz++) {
      const d = Math.hypot(dx, dz);
      if (d > radius + 0.85) continue;
      if (d > radius - 1.3) {
        voxel(batch, cx + dx, top - 4, cz + dz, 'stoneDark');
        voxel(batch, cx + dx, top - 3, cz + dz);
      }
      if (d <= radius + 0.15) {
        box(batch, cx + dx, top - 2.75, cz + dz, 1, 0.5, 1, 'stone');
      }
      if (!roof && d > radius - 1.1) {
        voxel(batch, cx + dx, top - 2, cz + dz);
        const angle = (Math.atan2(dz, dx) + Math.PI) / (2 * Math.PI);
        if (Math.floor(angle * 12) % 2 === 0) {
          voxel(batch, cx + dx, top - 1, cz + dz);
          voxel(batch, cx + dx, top, cz + dz);
        }
      }
    }
    if (roof) {
      for (let tier = 0; tier < 8; tier++) {
        const rr = radius + 1 - tier * (radius + 0.7) / 8;
        for (let dx = -bound; dx <= bound; dx++) for (let dz = -bound; dz <= bound; dz++) {
          const d = Math.hypot(dx, dz);
          if (d <= rr && d >= Math.max(0, rr - 1.5)) voxel(batch, cx + dx, top - 2 + tier, cz + dz, 'roof');
        }
      }
      box(batch, cx, top + 6.8, cz, 0.3, 2.6, 0.3, 'metal');
      box(batch, cx + 1.05, top + 7.3, cz, 2.1, 0.9, 0.16, 'banner');
    }
    if (gateSide) banner(batch, cx, top - 5.5, cz + radius + 0.7, 'z', 6);
  }
  function wall(batch, axis, fixed, start, end, top, gate = false) {
    for (let t = start; t <= end; t++) {
      for (let thick = 0; thick < 2; thick++) {
        const offset = fixed < 0 ? thick : -thick;
        const x = axis === 'x' ? t : fixed + offset;
        const z = axis === 'x' ? fixed + offset : t;
        for (let y = 4; y < top; y++) {
          if (gate && archOpening(t, y, 4, 3, 7)) continue;
          const arrow = Math.abs(t) % 9 === 3 && y >= top - 7 && y <= top - 5;
          if (arrow && thick === 0) continue;
          voxel(batch, x, y, z, y === 5 || y === top - 4 ? 'stoneDark' : 'stone');
        }
        voxel(batch, x, top, z);
        if ((t - start) % 4 < 2) {
          voxel(batch, x, top + 1, z);
          voxel(batch, x, top + 2, z);
        }
      }
      const inOffset = fixed < 0 ? 2 : -2;
      const deckX = axis === 'x' ? t : fixed + inOffset;
      const deckZ = axis === 'x' ? fixed + inOffset : t;
      voxel(batch, deckX, top - 2, deckZ);
      if (t % 4 === 0) voxel(batch, deckX, top - 3, deckZ, 'stoneDark');
      // Regular footing buttresses make the defenses legible at oblique angles.
      if (t % 9 === 0 && (!gate || Math.abs(t) > 5)) {
        const out = fixed < 0 ? -1 : 1;
        for (let y = 4; y < top - 5; y++) {
          voxel(batch, axis === 'x' ? t : fixed + out, y, axis === 'x' ? fixed + out : t, 'stoneDark');
          if (y < 8) voxel(batch, axis === 'x' ? t : fixed + 2 * out, y, axis === 'x' ? fixed + 2 * out : t, 'stoneDark');
        }
      }
    }
  }
  // The wider outer bailey leaves independent sites for the ten facilities.
  wall('outer', 'x', -64, -72, 72, 18);
  wall('outer', 'x', 64, -72, 72, 18, true);
  wall('outer', 'z', -72, -64, 64, 18);
  wall('outer', 'z', 72, -64, 64, 18);
  for (const x of [-72, 72]) for (const z of [-64, 64]) roundTower('outer', x, z, 5, 28);
  for (const x of [-72, 72]) roundTower('outer', x, 0, 4.5, 26);
  roundTower('outer', 0, -64, 4.5, 27);
  for (const x of [-8, 8]) roundTower('outer', x, 64, 4.5, 31, false, true);
  // Raised portcullis and outward-open gate leaves preserve the entrance void.
  for (let x = -3; x <= 3; x++) box('outer', x, 16.6, 64.65, 0.13, 3.6, 0.18, 'metal');
  for (const y of [15.4, 16.7, 18]) box('outer', 0, y, 64.65, 7, 0.15, 0.22, 'metal');
  for (const x of [-4.15, 4.15]) {
    box('outer', x, 7.5, 60.7, 0.45, 7, 4.3, 'wood');
    for (const y of [5.5, 8.7]) box('outer', x, y, 60.7, 0.52, 0.22, 4.5, 'metal');
    torch('outer', x * 1.35, 9, 69.2);
  }
  // The taller inner ring leaves a wide outer bailey on every side.
  wall('inner', 'x', -44, -45, 45, 24);
  wall('inner', 'x', 28, -45, 45, 24, true);
  wall('inner', 'z', -45, -44, 28, 24);
  wall('inner', 'z', 45, -44, 28, 24);
  for (const x of [-45, 45]) for (const z of [-44, 28]) roundTower('inner', x, z, 4, 33);
  for (const x of [-7, 7]) roundTower('inner', x, 28, 3.5, 34, false, true);
  for (let x = -3; x <= 3; x++) box('inner', x, 16, 28.65, 0.15, 5, 0.18, 'metal');
  for (const y of [14, 16, 18]) box('inner', 0, y, 28.65, 7, 0.15, 0.2, 'metal');
  // Keep shell with arched entry and tall recessed windows on each facade.
  for (let x = -10; x <= 10; x++) for (let z = -17; z <= 1; z++) {
    const boundary = Math.abs(x) >= 9 || z <= -16 || z >= 0;
    if (!boundary) continue;
    for (let y = 4; y < 37; y++) {
      if (z >= 0 && archOpening(x, y, 4, 2, 7)) continue;
      const frontWindow = (z <= -16 || z >= 0) && (Math.abs(x) === 4 || Math.abs(x) === 7);
      const sideWindow = Math.abs(x) >= 9 && (z === -4 || z === -8 || z === -12);
      const windowY = (y >= 17 && y <= 20) || (y >= 28 && y <= 31);
      if ((frontWindow || sideWindow) && windowY) {
        // Set back a dark pane to preserve readable depth in the window apertures.
        if ((z === 0 || z === -16) || Math.abs(x) === 9) voxel('keep', x, y, z, 'stoneDark');
        continue;
      }
      voxel('keep', x, y, z, y === 5 || y === 15 || y === 25 || y === 35 ? 'stoneDark' : 'stone');
    }
  }
  floor('keep', -10, 10, -17, 1, 36.8, 'stone');
  // A visibly stepped hipped slate roof rather than a solid hidden volume.
  for (let tier = 0; tier < 7; tier++) {
    const minX = -11 + tier, maxX = 11 - tier;
    const minZ = -18 + tier, maxZ = 2 - tier;
    for (let x = minX; x <= maxX; x++) for (let z = minZ; z <= maxZ; z++) {
      if (x <= minX + 1 || x >= maxX - 1 || z <= minZ + 1 || z >= maxZ - 1 || tier === 6) {
        voxel('keep', x, 37 + tier, z, 'roof');
      }
    }
  }
  for (const x of [-10, 10]) for (const z of [-17, 1]) roundTower('keep', x, z, 3.3, 44, true);
  for (const x of [-6, 6]) banner('keep', x, 26.5, 2, 'z', 7);
  banner('keep', 11, 28, -8, 'x', 8);
  box('keep', 0, 47.2, -8, 0.4, 8, 0.4, 'wood');
  for (let x = 1; x <= 5; x++) box('keep', x, 49.4, -8, 1, 2.5 - x * 0.18, 0.18, x === 2 ? 'light' : 'banner');
  // Facade buttresses give the central mass a tall rhythm.
  for (const x of [-8, -3, 3, 8]) for (let y = 4; y < 28; y++) {
    voxel('keep', x, y, 2, y % 10 === 5 ? 'stoneDark' : 'stone');
    if (y < 10) voxel('keep', x, y, 3, 'stoneDark');
  }
  for (const x of [-3.6, 3.6]) torch('keep', x, 8.1, 3.6);
  // Interlocking cobbles: the unobstructed axis runs through both gatehouses.
  for (let x = -70; x <= 70; x++) for (let z = -62; z <= 62; z++) {
    const underKeep = Math.abs(x) <= 14 && z >= -21 && z <= 5;
    const wallBand = (Math.abs(x) >= 44 && Math.abs(x) <= 46 && z >= -44 && z <= 28) ||
      ((z >= -44 && z <= -42 || z >= 27 && z <= 29) && Math.abs(x) <= 46 && Math.abs(x) > 3);
    if (underKeep || wallBand) continue;
    const road = Math.abs(x) <= 3 || z >= 42 && z <= 46 || Math.abs(x) >= 49 && Math.abs(x) <= 53;
    box('courtyard', x, 4.08, z, 0.94, 0.14, 0.94, road ? 'path' : 'stoneDark', road ? 0.94 + random() * 0.16 : 0.85 + random() * 0.15);
  }
  for (let x = -3; x <= 3; x++) for (let z = 63; z <= 70; z++) box('courtyard', x, 4.08, z, 0.96, 0.15, 0.96, 'path');
  function smallBuilding(cx, cz, width, depth, wallTop, roofMaterial) {
    const hx = Math.floor(width / 2), hz = Math.floor(depth / 2);
    for (let x = -hx; x <= hx; x++) for (let z = -hz; z <= hz; z++) {
      if (Math.abs(x) !== hx && Math.abs(z) !== hz) continue;
      for (let y = 4; y < wallTop; y++) {
        if (z === hz && x === 0 && y < 8) continue;
        const beam = y === wallTop - 1 || x % 4 === 0 || z % 4 === 0 && Math.abs(x) === hx;
        voxel('courtyard', cx + x, y, cz + z, beam ? 'wood' : 'stone');
      }
    }
    for (let tier = 0; tier <= hx + 1; tier++) {
      const edge = hx + 1 - tier;
      for (let z = -hz - 1; z <= hz + 1; z++) {
        voxel('courtyard', cx - edge, wallTop + tier, cz + z, roofMaterial);
        if (edge !== 0) voxel('courtyard', cx + edge, wallTop + tier, cz + z, roofMaterial);
      }
      if (tier < hx) for (let x = -edge + 1; x < edge; x++) {
        voxel('courtyard', cx + x, wallTop + tier, cz - hz, 'wood');
        voxel('courtyard', cx + x, wallTop + tier, cz + hz, 'wood');
      }
    }
    for (let y = wallTop; y < wallTop + 6; y++) {
      voxel('courtyard', cx + hx - 1, y, cz - hz + 1, 'stoneDark');
      voxel('courtyard', cx + hx - 1, y, cz - hz + 2, 'stoneDark');
    }
  }
  // Upgradeable facilities are built in these side bays by world.js.
  // Stone well with a hollow opening, water below, timber posts and tiled canopy.
  const wx = -27, wz = 45;
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
    if (Math.hypot(dx, dz) > 2.6) continue;
    if (Math.hypot(dx, dz) > 1.1) {
      voxel('courtyard', wx + dx, 4, wz + dz, 'stoneDark');
      voxel('courtyard', wx + dx, 5, wz + dz);
    } else box('courtyard', wx + dx, 4.5, wz + dz, 1, 0.15, 1, 'water');
  }
  for (const x of [-2.5, 2.5]) box('courtyard', wx + x, 7, wz, 0.5, 6, 0.5, 'wood');
  box('courtyard', wx, 9.2, wz, 6, 0.5, 0.5, 'wood');
  for (let tier = 0; tier <= 2; tier++) for (let x = -3; x <= 3; x++) {
    voxel('courtyard', wx + x, 10 + tier, wz - 2 + tier, 'roof');
    voxel('courtyard', wx + x, 10 + tier, wz + 2 - tier, 'roof');
  }
  box('courtyard', wx, 7.9, wz, 0.12, 2.5, 0.12, 'wood');
  // Supply stacks and restrained courtyard planting.
  for (const [cx, cz] of [[35, 48], [39, 50], [-63, 46], [59, -46], [61, -51]]) {
    const layers = random() > 0.45 ? 2 : 1;
    for (let i = 0; i < 3; i++) for (let y = 0; y < layers; y++) {
      box('courtyard', cx + (i % 2) * 1.4, 4.7 + y * 1.4, cz + Math.floor(i / 2) * 1.4, 1.25, 1.25, 1.25, 'wood');
      box('courtyard', cx + (i % 2) * 1.4, 4.7 + y * 1.4, cz + Math.floor(i / 2) * 1.4 + 0.64, 1.3, 0.16, 0.1, 'metal');
    }
  }
  // Exterior-access stair flights up to the outer wall walks.
  for (const sign of [-1, 1]) for (let step = 0; step < 11; step++) {
    for (let w = 0; w < 3; w++) {
      box('outer', sign * (58 + step), 4.5 + step, 59 - w, 1, 1, 1, 'stoneDark');
      if (step > 0) box('outer', sign * (58 + step), 4 + step / 2, 59 - w, 1, step, 1, 'stoneDark');
    }
  }
  return {
    batches,
    landmarks: [
      { id: 'outer', label: '第一道防线 · 外城墙', pos: [72, 23, 2] },
      { id: 'inner', label: '第二道防线 · 内城堡', pos: [45, 31, 28] },
      { id: 'keep', label: '中央主堡 · 最后防线', pos: [0, 52, -8] },
      { id: 'gate', label: '双塔城门 · 吊闸入口', pos: [0, 21, 67] },
      { id: 'courtyard', label: '前庭院 · 补给与集结', pos: [-27, 12, 45] }
    ],
    stats: { towers: towerCount }
  };
}

if (typeof module !== 'undefined' && module.exports) module.exports = { buildCastle };
