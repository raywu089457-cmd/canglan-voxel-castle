# 交接：世界地圖重做（P1–P7 已整合）

交接日期：2026-09-25。交接範圍：`voxel-castle-game` 的**開放世界地圖重做**。
這份文件只描述「已經做完什麼、怎麼驗、還沒做什麼、做完的檔案在哪」，不把還沒做的當成已完成。

---

## 0. 一句話現況

地圖重做已接入遊戲：`WorldMap` 驅動地形、城堡尺寸、十區座標、世界尋路、碰撞與角色高度；P0 自動狩獵死鎖也已修復。Node 驗收目前為世界地圖 14/14、核心 41/41、擴充 22/22、內容 27/27。瀏覽器截圖與硬體 FPS 尚未重新驗收，因目前執行環境禁止啟動 Chrome（`spawn EPERM`）。

---

## 1. 這次要達成的目標（原始需求）

1. 城堡**兩圈防禦拉大**，中間土地變寬大。
2. 怪物區**不要死板圍繞一圈**，改成**不規則、連續**的地形。
3. 直接**套用 Minecraft 主世界的地形區域（生物群系）設計**。
4. 道路要確保**人物能從城內一路走到各區**。
5. 人物要有**尋路功能**。
6. **碰撞要正確**：不能撞進牆內、不能掉下去、不能穿過地板。

規模決定：選項 1（中）——海岸基準半徑 145 → **252**，十區散布在離城堡 **130~237**，中央土地約 **3.35 倍**。

---

## 2. 產出檔案（新增檔案仍未 commit）

| 檔案 | 行數 | 狀態 | 被誰載入 |
|---|---|---|---|
| `docs/WORLD-MAP-SPEC.md` | 106 | 新 | 人看的規格（設計數字、群系表、API、驗收條件） |
| `tools/world-audit.cjs` | 303 | 新 | 獨立 CLI：`node tools/world-audit.cjs`，只讀 `js/world-map.js` |
| `js/world-map.js` | 552 | 新 | `index.html`、`js/game-data.js`、`js/game-core.js`、`js/world.js` |

**既有檔案已經修改以完成整合。** `docs/content-coverage.json`、`docs/free-route.json`、`tests/shots/*.png` 仍有先前工作樹變動，未將它們視為本次視覺驗收證據。

---

## 3. 契約（下一階段必須遵守）

### 3.1 `WorldMap` API

```js
WorldMap = {
  seed:'94721', cell:2, navHalf:288, radius:252,
  castle:{ plateau:[78,70], moat:[88,80], clear:[92,84],
           outer:{x:72,z:64,top:18}, inner:{x:45,zMin:-44,zMax:28,top:24},
           gate:{x:0,z:64}, spawn:[0,30], junction:[...] },
  zones:[{index,id,name,x,z,distance,bearing,yaw,pad:30,biome,gates:[x,z],approach:[x,z]}],  // 10 筆
  biomes:[{id,zone,name,mc,base,relief,surface,edge,...}],                                   // 10 筆
  props:[{x,z,kind,blocking,biome,ground,top}],
  road:[...], loop:[...],                        // 城門大道 / 環路（世界 XZ）
  coastRadius(angle), isLand(x,z), height(x,z), surface(x,z), biomeAt(x,z),
  blocked(x,z), walkable(x,z), validStep(from,to), findPath(from,to), routeTo(i), routeBetween(a,b)
};
```

- `height()` 用**雙線性內插**，所以角色站的位置與方塊表面一致（不會浮起或陷進去）。
- `routeTo(i)` / `routeBetween(a,b)` 回傳的點串**已經逐格驗過可走**，並且**在城門處被切成兩段再簡化**（RDP ε=1.2），
  所以簡化不會把「必經城門」那一點吃掉。

### 3.2 `blocked` 與 `walkable` 的語意（重要，別再搞混）

- `blocked(x,z)` = **實心結構**：水、岩漿、岩石、**城牆本體**。它**不代表不能走**。
- `walkable(x,z)` = **可以站可以走**。
- **城門門洞**：`blocked === false`、`walkable === true`（真的是牆上的一個洞）。
- **大陸以外**：兩者皆 false。
- 城牆用專屬 flag（`WALL=8`）；道路走廊只能清「水／岩石」的擋格，**永遠不能清牆**。

### 3.3 關鍵常數（改動前先看 `docs/WORLD-MAP-SPEC.md`）

```
CELL=2  SPAN=320  NAV_HALF=288  RADIUS=252  ARENA_Y=4  PAD=30  ROAD_HALF=5
PLATEAU=外牆+6  MOAT=外牆+16  CLEAR=外牆+20（同一個八邊形等距外推）→ [98,84] / [108,94] / [112,98]
OUTER={x:92,z:78,cut:42,top:13}（八邊形：|x|+|z| = 92+78-42 = 128 是切角線）
INNER={x:57,zMin:-50,zMax:36,top:17}  KEEP={x:10,zMin:-17,zMax:1,tower:4.2}
GATE={x:0,z:78}  SPAWN=[0,32]  JUNCTION=[0,118]
MOAT_Y=2.2  OCEAN_Y=-1.4  SLOPE=1.35（坡度硬上限）
※ 2026-09-26 更新：外圈改成八邊形（切角閃開 zone 2 的競技場），兩圈間距與內牆到主堡都拉開；
   形狀只有一個來源 WorldMap.castle.dist(x,z)，導航的牆格／護城河／畫面方塊都讀它。
```

**門洞寬度必須與 `js/castle-geometry.js` 畫的拱門一致**：那裡是 `archOpening(t,y,4,3,7)` → `|x| ≤ 3`。
`world-map.js` 的 gate 條件就是 `Math.abs(x-GATE.x) <= 3`（網格節點 −2/0/+2 可走，±4 是牆）。
**兩邊改一邊就要改另一邊**，否則會出現「人在有畫牆的格子上走出去」＝穿牆。

---

## 4. 怎麼驗（照這個順序）

```powershell
cd C:\Users\ray\Desktop\Claude code\voxel-castle-game
node tools/world-audit.cjs     # 14/14 通過，0.25 秒
npm test                       # 59/59 通過（核心與擴充規則，與地圖無關）
npm run test:browser           # 11/11 通過（需要 Playwright + Chrome，約 90 秒）
```

`npm run test:browser` 用的 Playwright 在
`C:/Users/ray/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright`，
Chrome 在 `C:/Program Files/Google/Chrome/Application/chrome.exe`（設定在 `tests/browser.test.cjs` 檔頭）。

### 4.1 驗收腳本目前實際輸出（節錄，2026-09-22）

```
✔ 十區：數量／遞增／不重疊        距離 130/146/159/174/187/198/210/220/229/237 | 最小間距 80.3 | 空地不重疊=true
✔ 十區：方位抖動                 相鄰方位差 33/32/35/41/38/30/37/36/36 極差 10.7°
✔ 路線：每區都走得到             10 條路線全部可走（取樣 2900 格，違規 0）
✔ 路線：必須穿過外城門開口        10 條都經過 (0,64) 開口
✔ 地形：可走區域沒有斷崖          檢查 102680 組相鄰格，斷崖 0，最大高差 1.35 @-94,-50
✔ 道路：全程可走且只有一區連通    點數 836 不可走 0 連通分量 1 接得到城門=true
✔ 海岸：不規則                   半徑 235~285（差 50）離岸區塊 0 空地觸海 0
✔ 群系：十個都成立               面積 4127~10340 格，fill 0.32~0.59（圓形會接近 0.79）
✔ 城堡：中央土地 ≥ 3 倍          5609 格（舊制 1672 → 3.35 倍）| 牆上有洞 0 城門被填死 0 城門走不通 0
✔ 移動規則                       陡坡被接受 0/0 斜向切角 0/120
✔ 預算                          54296 格 → 預估 162888 塊 / 1.95M 三角形
14/14 通過
```

### 4.2 交接者自己另外做過的獨立驗證（不屬於驗收腳本）

腳本放在 `%TEMP%\world-verify.cjs`（暫存，不建議當成專案資產）。結果：

| 驗的東西 | 結果 |
|---|---|
| 跨行程決定性 | 兩個獨立 node 行程 fingerprint **完全相同**（`e42810bbfd4ec8b19f9d2ef9eed9976d`） |
| 全圖連通 | 可走 52,313 格，從 `spawn` flood fill 到 52,313 → **孤立 0** |
| 城門是唯一出口 | 封住城門那 9 格後，能走到的「城外」格數 = **0** |
| 城門剖面 | −4 牆／−2,0,+2 可走／+4 牆，高度全 4.0 |
| 路線成本 | 每條 7~15 個轉折點、**0.1 KB**；一趟 10~16 秒（走速 26/秒） |
| 地表材質普查 | grass 12217 / path 9898 / rock 8015 / sculk 4424 / snow 4208 / mud 3827 / mycelium 3554 / sand 3357 / redSand 2942 / water 1302 / stoneDark 448 / ice 60 / lava 44 |
| 裝飾數量 | tree 206 / pillar 86 / spire 134 / lava 44 / pond 59 / iceSpike 60（共 589） |
| 陸地高度 | 2.20 ~ 7.27（水面 2.2、競技場 4） |

### 4.3 過程中修掉的兩個「驗收條件自己寫錯」的坑（不要再改回去）

1. 原本我要求「城門那格必須是 blocked」→ 語意反了。已改成**門洞必須不是 blocked 且必須 walkable**。
2. 改成上面的語意後，立刻抓到**牆上真的有 2 格洞**（道路走廊把牆鑿穿，`x=±4`）。
   修法：牆用 `WALL` flag，道路只清水／岩石，**永遠不清牆**；門洞寬度對齊 `|x| ≤ 3`。

---

## 5. 進度表

| 階段 | 內容 | 狀態 |
|---|---|---|
| P1 | 地形／碰撞／尋路底層 `js/world-map.js` ＋ 規格 ＋ 驗收腳本 | ✅ 完成、14/14、獨立驗過 |
| P2 | `js/terrain-geometry.js` 改寫：由 `WorldMap` 產生群系地表、地層、水／岩漿、道路、裝飾 | ✅ 完成；含遠區 4 單位粗格 LOD |
| P3 | `js/castle-geometry.js` 放大到 ±72/±64 與 ±45（中央土地 3.35 倍） | ✅ 完成 |
| P4 | `js/game-data.js` 的 `ring` 換成 `WorldMap` 的配置與 A* 路線 | ✅ 完成 |
| P5 | `js/game-core.js` 移動改成有碰撞＋會重尋路（用 `validStep`、`height`） | ✅ 完成；含卡住復原、召回回城、換怪重尋路 |
| P6 | `js/world.js` 整合：新材質色、LOD、相機範圍、角色站在地面上 | ✅ 完成；瀏覽器畫面尚未重新驗收 |
| P7 | 測試斷言更新、README／IMPLEMENTATION 更新、整體驗收 | ✅ Node 驗收完成；瀏覽器／硬體效能待環境允許 |

---

## 6. 後續 TODO（只列尚未完成）

- 在允許啟動 Chrome 的環境執行 `npm run test:browser`，重新產生桌面／手機截圖。
- ~~實機量測 draw calls 與 frame time~~ 2026-09-26 已用 `node tools/perf-probe.cjs --headed`（真 GPU）量過：桌機 28／手機 23／小手機 25 draw calls、453～503k 三角形、每帧 JS 0.25～0.3ms（CPU ×6 降速 1.5～1.6ms）；**真機 GPU 仍未量**。
- 手機補算上限已修（每帧最多 1.5 秒），舊版會凍 0.26～8 秒。
- 畫質設定已加（設定 → 畫質：自動／高／低），低畫質 pixel ratio 1、關陰影；真機仍未驗。
- 若要支援不同世界種子，需把 `world-map.js` 的固定 `SEED_TEXT` 參數化，並加入不同 seed 的指紋驗收。
- 可選：補齊藤蔓、枯木、巨石、鐘乳石等群系專屬裝飾；目前已有樹、仙人掌、巨型蘑菇、尖塔、柱、熔岩池與水潭。

以下 P2–P7 原始 TODO 只保留作為歷史設計背景，不代表尚未完成。

### P2 地形方塊產生器（`js/terrain-geometry.js`）

- 目前 `buildTerrain(seed)` 是**舊的超橢圓小島**（`isIsland` 用 `|x|/77`、`|z+1|/70`），整支要換成由 `WorldMap` 走一遍網格：
  對每個節點讀 `isLand / height / surface / blocked / biomeAt` 產生方塊。
- 需要保留的既有慣例：`batches` 分 `terrain` / `water` / `nature` 三組、每筆 `[x,y,z,sx,sy,sz,material,shade]`、
  兩條地質帶（`rock`）× 表土（`earth`／`stone`）＋表層（`surface()`）。
- 水（`MOAT_Y=2.2`）與岩漿要照舊「薄片浮在凹槽上，不是實心藍塊」的做法（見舊檔 `water` 那段的註解）。
- 護城河／橋／城門大道：舊檔有一段手工木橋與石緣，現在道路已由 `WorldMap.road/loop` 提供（含 `path` 路面），
  要改成沿著道路點鋪，不要再寫死 `z=38.5..49`。
- 新增材質（`js/world.js` 的 `COLORS`）：`redSand, terracotta, mud, mycelium, sculk, gravel, packedIce`。
- **已知要補的**：
  - 黑森林樹密度要 3~5 倍（目前全圖只有 206 棵，`world-map.js` 的密度參數是 `BIOME_ROWS` 最後一欄）。
  - 缺群系專屬裝飾：仙人掌、枯木、巨型蘑菇（`cloth` 柄 + `banner` 傘）、藤蔓、巨石、鐘乳石。
    要加的話在 `world-map.js` 的 `PROP_TOP` 與生成處擴充 kind。
- **LOD 預算**：預估 163k 塊／1.95M 三角形（現行線上版本是 9 萬塊／1.08M）。
  建議半徑 >180 的格子改用 `cell × 2` 的粗格距發方塊，把量壓回 ~120k 塊；`WorldMap` 不用改。

### P3 城堡放大（`js/castle-geometry.js`）

- 現在的牆呼叫是 `wall('outer','x',-34,...)` 這種形式，**注意 `wall()` 的第一個座標參數是「牆所在的平面」**：
  `axis 'x'` 時 `fixed` 是 `z` 平面、`t` 是 `x` 範圍（**這是舊檔最容易讀錯的地方**）。
- 新的兩圈：外牆 `x=±72`、`z=±64`、`top 18`；內牆 `x=±45`、`z=-44..+28`、`top 24`；城門在 `(0,64)` 與 `(0,28)`。
- 要一起搬的：角樓（`roundTower`）、城垛、門樓（`box` 那些門扇／吊閘）、庭院石板（`courtyard` 現在是 ±38/±32）、
  五座 `smallBuilding`、水井、`landmarks` 回傳座標、`stats.towers`。
- 城堡台地與護城河在 `terrain-geometry.js`／`world-map.js` 裡是 `PLATEAU=[78,70]`、`MOAT=[88,80]`，**與牆必須一致**。

### P4 遊戲本體接上新世界（`js/game-data.js`）

- `RING_COUNT/RING_RADIUS/RING_ROAD/ZONE_Y` 與 `ring` 物件（`positions/angle/toWorld/toLocal/approach/arc`）改成讀 `WorldMap`：
  - `positions[i]` → `WorldMap.zones[i]` 的 `x,z`
  - `toWorld/toLocal` 用 `zone.yaw` 取代 `ringAngle(i)`
  - `approach(i)` → `WorldMap.routeTo(i+1)`；`arc(a,b)` → `WorldMap.routeBetween(a+1,b+1)`
- **`ZONE_Y` 不能再是固定 3.91**：競技場地板是 `ARENA_Y=4`，角色要站在地面上（見 P5/P6）。
- `js/game-core.js` 的 `fieldWalker()` 目前硬吃 `D.ring.toLocal` ＋ `layout.walkable`；改完之後
  「世界段」用 `WorldMap`、「競技場內段」維持 `field.walkable`，兩段都是 A*。

### P5 移動與碰撞（`js/game-core.js`）

- `walkAlong()` 目前**無條件沿路徑移動**（只看 waypoint，不看地形）。要改成：
  1. 每一步先問 `WorldMap.validStep(now, next)`；不合法就**停下來重尋路**（不要硬穿）。
  2. 角色 `y` 由 `WorldMap.height(x,z)` 決定（畫面與模擬同一份高度）。
  3. 卡住保護：連續 N 次重尋路失敗就退回上一個合法點並記錄事件（避免無限迴圈）。
- `findPath()` 的 `guard<6000` 是**競技場尺度**的；世界尺度要用 `WorldMap.findPath`（二元堆）。

### P6 畫面整合（`js/world.js`）

- `buildZones()` 現在用 `MAP_POS = D.ring.positions` ＋ `group.rotation.y = zoneAngle(i)`；改成新配置與 `yaw`。
- `zoneGround()`（半徑 32 圓盤）、`buildLowland()`、`coastlineRadius()`（世界半徑 145）**整組作廢**，
  改由 `terrain-geometry.js` 產生的大陸取代。
- 相機：`presets.ring.size=178` → 要放大到看得見 285 半徑；平移夾制 `x∈[-70,70], z∈[-65,65]`、
  縮放 `9..180`、陰影相機 `±105 / far 360` 都要跟著放大。
- `getStats().ring` 欄位（`count/radius/road/groups/positions/lowland`…）要改成新地圖的對應值，
  **`tests/browser.test.cjs:384-394` 的斷言會因此而改**（見 P7）。
- 角色站立高度：現在是固定 `ZONE_Y`；要改成 `WorldMap.height(x,z)`。

### P7 測試與文件

- `tests/browser.test.cjs` 會被新地圖影響的斷言（行號為目前檔案）：
  `:384` `ring.count===10`、`:385` `ring.groups===10`、`:386` 每區都在半徑 ±2、
  `:387-388` 最小間距 ≥56、`:389` `worldBlocks>60000`、`:393-394` lowland 欄位、
  `:400-401` 三視角 `worldBlocks` 不變、`:406-408` markers 數量、`:421` `positions[0]`、`:455` `zone1` 距離。
  → 建議改成新契約：十區都在大陸內、距離嚴格遞增、每區都走得到、視角不換場景、群系數量 10。
- `tests/core.test.cjs:15` 的 `engage()` 用 `D.ring.toWorld(...)`；只要 P4 保住 `toWorld/toLocal` 語意就不用改。
- 文件要更新：`README.md` 的「開放地圖」段（現在寫「十區以半徑 105、每 36° 排成一圈」、「海岸半徑由四組正弦諧波」）、
  `docs/IMPLEMENTATION.md` 的「開放地圖」與「場域」兩段（台地半徑 32、低地半徑 145 等數字）。

---

## 7. 風險與地雷

1. **存檔相容**：`hunting.field.party[].path` 會變長／變樣（現在每條路線 7~15 點，很省），
   `validateSave` 的 `nodes<=150000` 上限要注意；新舊存檔的路徑座標可能落在新地形外面，需要遷移或「載入時重算路線」。
2. **決定性**：`world-map.js` 只讀 `SEED_TEXT='94721'`，**絕對不能碰玩法 RNG**（`s.rng`）。
   `generationVersion` 目前是 `1`；**地形換了應該升版**（例如 `2`），否則舊存檔會對不上新地形。
3. **`blocked` 不是「不能走」**：碰撞一律用 `walkable()` ／ `validStep()`。
4. **門洞寬度**：`world-map.js` 的 `|x| ≤ 3` 與 `castle-geometry.js` 的 `archOpening(...,3,...)` 必須一致（見 §3.3）。
5. **效能**：新大陸預估 1.95M 三角形（現行 1.08M）。無頭環境（SwiftShader）量不到真實 FPS，
   實機（尤其手機）要另外驗；LOD 是必要的下一步，不是可選。
6. **外觀沒人驗過**：`WorldMap` 只證明「幾何與規則」，**沒有任何圖片被檢查過**。
   P2/P6 完成後要請人看畫面（專案裡有 `tests/shots/` 的既有慣例）。
7. **未 commit**：這三個新檔還在 working tree。建議 commit 拆成三顆：
   ① `docs: 世界地圖規格與驗收條件` ② `feat: WorldMap 地形／碰撞／尋路底層` ③ `tools: world-audit`。

---

## 8. 同一時間發現、但**還沒修**的另一個問題（不要漏掉）

**P0：自動狩獵會永久卡死**（已修復，保留以下描述作為回歸背景）。

- 症狀：隊伍與怪物互看，雙方都不動，永不擊殺、不敗退、不重試。
- 條件：換怪時隊伍離怪物站位 > `FIELD.aggro`(16)，怪物不主動追，而隊伍路徑已走完（`pi == path.length`）→ 死鎖。
- 重現率：1 人隊 **3/3**、2 人隊 **3/3**、3 人隊 **2/3**、滿 5 人隊 0/3 → **新手最慘**。
- 專案自己的 `tools/free-route.cjs` 也踩到：7 天模擬從第 30 分鐘起擊殺永遠停在 35、關卡停在 4-6。
- 救回方式：召回 → 重新派出（重載頁面無效）。卡住時唯一收入是流浪獵人在酒館消費（10 分鐘約 327 金）。
- 相關程式：`js/game-core.js:82`（FIELD 常數）、`:73` `battleStep`、`:170` `fieldStep`、`:221` `fieldRebuildIfStale`、`:55` `spawnEnemy`。
- 證據檔（暫存）：`%TEMP%\canglan-qa-shots\report13~16.json`，測試腳本 `%TEMP%\canglan-qa14~19.cjs`。
- 實際修法：路徑走完且離怪物仍超出 `heroRange` 時重尋路；世界段逐步檢查 `WorldMap.validStep()`；連續失敗達上限時回到城內重建場域。回歸測試位於 `tests/core.test.cjs`。

---

## 9. 環境

- 專案：`C:\Users\ray\Desktop\Claude code\voxel-castle-game`
- 線上服務：`node serve-4180.cjs`（`http://100.79.149.0:4180/`，Tailscale），`start-4180.cmd` 可重啟
- Node `v24.13.1`；純本機、無外部依賴（Three.js r160 隨包）
- 測試：`npm test`（59）、`npm run test:browser`（11）、`node tools/world-audit.cjs`（14）、`node tools/content-audit.cjs`
- `?test` 參數才會掛上 `GameApp.dispatch/replaceState/advance` 等測試接口
- 本次地圖工作的其它暫存：`%TEMP%\world-verify.cjs`（獨立驗證）、`%TEMP%\canglan-qa-shots\`（前一輪 QA 證據）。這些不是本次新地圖的視覺證據。
