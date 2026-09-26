# 世界地圖規格（Phase 1：地形／碰撞／尋路底層）

紀錄日期：2026-09-22。這一版把「城堡一圈十座台地」改成**一塊不規則大陸＋十個 Minecraft 主世界風格生物群系**，
並讓**模擬與畫面共用同一份地形資料**。目標是：隊伍從城內出發可以一路走到任一區，途中不會撞進牆、不會掉下去、不會穿過地板。

## 為什麼要先做這層

現在 `terrain-geometry.js` 只在畫方塊，行走路線是手寫的環狀 waypoint（`GameData.ring.approach/arc`），
模擬端沒有任何碰撞概念；只要有地形起伏或城牆，路線就可能貼著牆或被地形切斷。
因此新增 `js/world-map.js` 作為**唯一地形來源**：

- 畫面：`terrain-geometry.js` 由它產生方塊。
- 模擬：`game-core.js` 由它取高度、可走判定與 A* 路線。
- 兩邊用同一份資料，就不可能「畫得出來但走不過去」或「走過去但穿過牆」。

## 座標與尺度（選項 1：中）

| 項目 | 舊值 | 新值 |
|---|---|---|
| 大陸基準半徑（海岸） | 145 | **250**（不規則：諧波 + 雜訊 + 逐區外凸） |
| 城堡台地半邊 | 44 × 38 | **78 × 70**（中央土地約 3.3 倍） |
| 護城河外緣 | 52 × 46 | **88 × 80** |
| 外牆矩形（牆面所在平面） | x ±40、z ±34 | **x ±72、z ±64**，牆高 18 |
| 內牆矩形 | x ±25、z −24…+16 | **x ±45、z −44…+28**，牆高 24 |
| 外城門 | (0, 34) | **(0, 64)**（＋Z 側，橋與大道同一側） |
| 內城門 | (0, 16) | **(0, 28)** |
| 十區離城堡 | 固定 105、每 36° | **130 / 146 / 160 / 174 / 187 / 199 / 210 / 220 / 229 / 237**，方位各自抖動 |
| 每區平坦空地（arena pad） | 台地半徑 32 的圓盤 | **半徑 30 的整平空地**，外緣 10 格內與群系接順 |
| 道路 | 環狀半徑 88 ＋ 放射線 | **城門大道＋穿過十區的有機環路**（樣條），路面寬 ±5，會把地形削成走廊 |

- 網格步長 `cell = 2`（與舊地形一致），導航範圍 ±280。
- 高度上限：**相鄰可走格高差 ≤ 1.5**（整平後的保證）；超過者必須標記為 `blocked`（畫成實心岩體／水／岩漿），
  所以「走得到的地方一定沒有斷崖」，掉下去／穿地板在結構上不可能發生。

## 十個生物群系（Minecraft 主世界）

| 區 | 遊戲名稱 | MC 群系 | 地表材質 | 高度基準／起伏 | 植被與裝飾 |
|---|---|---|---|---|---|
| 1 | 翠綠草原 | Plains | grass / earth / path | 3.2 / 1.6 | 橡木（leaf, trunk）、高草花叢（leaf 小塊） |
| 2 | 幽暗森林 | Dark Forest | grass / earth / podzol | 3.4 / 2.6 | 深色密林（leaf shade 偏暗、株距密）、菇類 |
| 3 | 灰燼洞穴 | Stony Peaks & Caves | rock / stone / gravel | 5.0 / 6.5 | 石柱、礫石堆、岩洞（blocked 岩體） |
| 4 | 烈焰火山 | Badlands | redSand / terracotta / rock | 4.0 / 3.2 | 陶土色帶、岩漿池（lava, blocked） |
| 5 | 冰封高原 | Snowy Plains & Ice Spikes | snow / packedIce / stone | 3.4 / 2.6 | 雪層、冰刺（ice 柱, blocked）、雲杉 |
| 6 | 黃沙荒漠 | Desert | sand / sand / rock | 3.2 / 2.0 | 仙人掌、枯木、沙丘 |
| 7 | 詛咒沼澤 | Swamp & Mangrove | mud / grass / water | 2.6 / 1.0 | 淺水（water, blocked）、藤蔓、菇、紅樹 |
| 8 | 蒼穹之塔 | Windswept Hills & Jagged Peaks | rock / stone / snow | 5.5 / 7.0 | 尖峰岩柱（blocked）、高山雪線 |
| 9 | 深淵裂谷 | Deep Dark & Dripstone Caves | sculk / stoneDark / deepslate | 2.4 / 4.0 | sculk 斑塊、峽谷裂縫（blocked）、鐘乳石柱 |
| 10 | 神話之域 | Mushroom Fields | mycelium / mycelium / myth | 4.2 / 3.0 | 巨型蘑菇（cloth 柄 + banner 傘）、奇花 |

（MC 沒有「火山」；以惡地＋岩漿池代替，並在文件註明這是對照選擇。）

新增材質（`js/world.js` 的 `COLORS`）：`redSand, terracotta, mud, mycelium, sculk, gravel, packedIce`。

## 區域配置（不規則，不是一圈）

- 方位由固定 layout 種子產生抖動（±15°）後**依序遞增**，所以不會交叉；半徑依上表遞增 → **距離＝難度順序**。
- 每個 zone 有 `yaw`：讓競技場的閘門（local `[0,-13]`）朝向道路進場點。
- 大陸海岸在每一區附近**外凸**，保證 `半徑 + pad + 沙灘` 一定在陸地上。

## 道路

- **城門大道**：`(0,66)` → 一路向北接到環路起點。
- **環路**：封閉的 Catmull-Rom 樣條，依序穿過十區的路側進場點（每點在該區 pad 邊緣朝外 6 格）。
- 路面（距樣條 ≤5 格）會被削平並鋪 `path`，高度取樣條自身的平滑高度；
  因此道路**一定可走**，且與城門、各區閘門相連（單一連通分量）。

## 導航

- `WorldMap.findPath(from, to)`：8 方向 A*（二元堆），
  - 不可走：`blocked`（水／岩漿／城牆／岩體／大陸外）
  - 不可走：高差 > 1.5（上）或 > 3.0（下）
  - **禁止切角**：對角移動時兩側正交格都必須可走
- `routeTo(i)`：城門內側出生點 → 第 i 區閘門；`routeBetween(a,b)`：兩區之間。
  路線用 RDP 簡化（ε=1.2）後才存進存檔。
- 通行保證（驗收腳本會逐格檢查）：路線每一段以 1 格取樣都必須 `walkable` 且高差合格，
  且**至少經過外城門開口一次**。

## API（`globalThis.WorldMap`）

```js
WorldMap = {
  seed, cell, navHalf, radius, castle: {...}, zones: [...], biomes: [...],
  // 地形
  isLand(x,z), height(x,z), surface(x,z), biomeAt(x,z), blocked(x,z), walkable(x,z),
  // 城堡（castle-geometry.js 與導航共用同一組數字）
  castle:{ plateau:[78,70], moat:[88,80], outer:{x:72,z:64,top:18}, inner:{x:45,zMin:-44,zMax:28,top:24}, gate:{x:0,z:64}, spawn:[0,30] },
  // 區域
  zones:[{index,id,name,x,z,distance,bearing,yaw,pad,biome,gates:[x,z],approach:[x,z]}],
  biomes:[{id,zone,name,mc,base,relief,surface,edge,water}],
  // 道路
  road:[{x,z}...], loop:[{x,z}...],
  // 導航
  findPath(from,to,opts), routeTo(i), routeBetween(a,b), validStep(from,to)
};
```

## 驗收

- `node tools/world-audit.cjs`：十區遞增且不重疊、每區都走得到、路線逐格拉鏈檢查、必經城門、
  無斷崖、道路連通、海岸不規則、群系面積與形狀不規則、中央土地 ≥3 倍、競技場地板全平、方塊數預算。
- 既有 `npm test`、`npm run test:browser` 必須全綠（第二階段以後才會動到它們的斷言）。

## 這一階段不做

畫面整合、城堡幾何實際放大、`game-core` 換用新路線、測試斷言更新、文件更新 —— 都排在後續階段，
每階段結束都會跑一次完整測試並回報。
