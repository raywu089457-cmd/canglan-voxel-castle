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
| 城堡台地半邊 | 44 × 38 | **外牆八邊形外推 6**（半邊 98 × 84；中央土地約 4.4 倍） |
| 護城河外緣 | 52 × 46 | **外牆外推 16**（半邊 108 × 94） |
| 外牆 | x ±40、z ±34（矩形） | **八邊形**：四邊 x ±92、z ±78，四角各切 42，牆體高 9（牆頂 y=13） |
| 內牆矩形 | x ±25、z −24…+16 | **x ±57、z −50…+36**，牆體高 13（牆頂 y=17） |
| 外城門 | (0, 34) | **(0, 78)**（＋Z 側，橋與大道同一側） |
| 內城門 | (0, 16) | **(0, 36)** |
| 十區離城堡 | 固定 105、每 36° | **130 / 146 / 160 / 174 / 187 / 199 / 210 / 220 / 229 / 237**，方位各自抖動 |
| 每區平坦空地（arena pad） | 台地半徑 32 的圓盤 | **半徑 30 的整平空地**，外緣 10 格內與群系接順 |
| 道路 | 環狀半徑 88 ＋ 放射線 | **城門大道＋穿過十區的有機環路**（樣條），路面寬 ±5，會把地形削成走廊 |

- **外牆為什麼是八邊形**：zone 2 的競技場（空地半徑 30）正好壓在城堡西南方的對角線上，實測只剩 31～33 格；
  方形外角一旦往外長就會撞進它的空地。切掉四角之後四邊都能推出去（外牆 72 → 92、內牆 45 → 57），
  對角線方向的距離反而從 26.9 變成 37.8 格。
- **兩圈防禦的間距**（`node tools/world-audit.cjs` 與核心測試都會重量方塊幾何，不只是常數）：
  外牆→內牆 35／28／42 格（舊 27／20／36），內牆→主堡 42.8／30.8／28.8 格（舊 31.7／23.7／23.7）。
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
  castle:{ plateau:[98,84], moat:[108,94], outer:{x:92,z:78,cut:42,top:18}, inner:{x:57,zMin:-50,zMax:36,top:24},
           keep:{x:10,zMin:-17,zMax:1,tower:4.2}, gate:{x:0,z:78}, spawn:[0,32], junction:[0,118],
           depth:{plateau:6,moat:16,clear:20}, dist(x,z) },
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
