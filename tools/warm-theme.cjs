'use strict';
/* 把 style.css 的冷色／玫瑰木主題換成暖色（羊皮紙 + 木框 + 森林綠）。
   以「舊色 → 新色」對照表處理，保留 alpha（#rrggbbaa 的 aa 原樣接回）。
   用法：node tools/warm-theme.cjs [--check]
   --check 只列出沒對照到的顏色，不改檔。 */
const fs = require('node:fs');
const path = require('node:path');

const MAP = {
  /* 文字與中性色：冷灰藍 → 暖棕 */
  '24393a': '3b2b25', '233a36': '3b2b25', '687473': '756145',
  '3d4048': '4a3b2f', '565a63': '6b5744', '4a4e58': '55432f',
  '3e3c2d': '3b2b25', '394235': '453a28', '4d5748': '4f4630',
  '88967c': '8f8360', '837e70': '8a8065', 'becbc3': 'cbbb95',
  /* 主要動作色：深青 → 森林綠 */
  '294d4d': '45673a', '1b3839': '2f4826', '345352': '4a4530', '58736a': '6b6040',
  '547468': '5b5a3a', '53685e': '5f5236', '526957': '5f5236',
  '4b6654': '57502f', '4c6956': '57502f', '6b91ac': '5d8fa0', '6897b6': '5d8fa0',
  /* 羊皮紙底／面板：冷白 → 暖紙 */
  'f5f1e6': 'f3ddab', 'fcfaf3': 'ffedc8', 'f9f7ee': 'fbe8c4', 'f8f6ec': 'fbe8c4',
  'f8f4dd': 'fbe8c4', 'f7f4e8': 'fbe8c4', 'f4edda': 'f6e2bd', 'f3f0e5': 'f7e5c0',
  'f3f2e6': 'f7e5c0', 'f0f0e4': 'f4e0b8', 'f0efe3': 'f4e0b8', 'f0eee1': 'f4e0b8',
  'edf0e5': 'f2dfb5', 'edf0e3': 'f2dfb5', 'e8ecdc': 'efd9a8', 'e9ede0': 'efd9a8',
  'ece9df': 'e8d3a5', 'dbe4dc': 'e3d2a4', 'dbe0cf': 'e2cea0', 'dce1cc': 'e2cea0',
  'ced5c3': 'd5c091', 'cdd6bb': 'd5c091', 'bcc9b1': 'c9b183', 'cbd1c0': 'cbb488',
  'c7cfbf': 'c9b183', 'cfd2c3': 'd2bd90', 'd8d9c9': 'd6c194', 'dedfce': 'dcc79a',
  'e1e3d4': 'e0cb9e', 'e2e2d3': 'e0cb9e', 'e1e2d5': 'e0cb9e', 'e3e3d5': 'e2cd9f',
  'e5e9de': 'e8d4a6', 'c4cdbd': 'ccbb93', 'a8b8a5': 'b5a480', 'acbca8': 'bfae86',
  'acb69c': 'b6a582',
  /* 玫瑰木框 → 木框 */
  '855757': '6b3f2a', '5f3c3c': '4a2c1e', 'a9746e': 'b07a45', 'd9a292': 'ddb87f',
  'e9c1b3': 'e8cb96', 'c08573': 'c99a5f', 'bd6a62': 'bd8133', '8f4640': '8a5f22',
  '4a2f2f': '4a2c1e', '3a2424': '3a2418', '7d4a42': '7a4a28', '4a2b26': '48301f',
  '2f1c1c': '33231a', 'f6d9cd': 'f7dfb4', 'f4e6cf': 'f6e1bb', 'dcc9a6': 'dcc191',
  '9d6b52': '9d6b3a', 'f6ece5': 'faf0dc', 'f3ddcf': 'f7e3c6', 'f1cfc3': 'f0d9b4',
  'f0ddd4': 'f4e3cb', 'f0c9ba': 'f3dcb8', 'efd6c6': 'f0dcba', 'e3cdbe': 'e7d3ad',
  'e2ae9c': 'e2c08c', 'cb907d': 'cfa165', 'c99a92': 'c9a673', 'c98d7c': 'c99a63',
  'c9766d': 'c08a3f', 'b87a68': 'b8863f', 'b06253': 'b0722f', 'a25348': 'a4562f',
  '954d42': '9a4f2c', '995549': '9d5433', '977161': '9a7350', '7d5852': '7d5a2f',
  '7d3c37': '7d5220', '7a3a35': '7a4d1e', '5b3d39': '5b4028', '553a36': '55402a',
  '4d3431': '4d3a26', '3f2b28': '3f2b22', '2f1f1d': '331f16', '241a16': '2a1c14',
  '6b4a45': '6b4a2a', '694c3e': '694c26', '795642': '7a5c33', '7e6652': '7e6540',
  '83703d': '837032', '8c783e': '8c7830', '9b793a': '9b7930', 'af8740': 'af8330',
  '94713c': '947130', '213d39': '3a2c1c', '183d3b': '231a10', '183c3b': '231a10',
  /* 金／強調色 */
  'b18c45': 'bd8133', 'ebd8a7': 'eed6a0', 'd8a94e': 'cd8c2f', '8a6524': '8a5f1f',
  'f2d489': 'f0cf8c', 'e6c781': 'e8c98a', 'f0d79a': 'f0d9a5', 'dab774': 'd3a765',
  'c0a063': 'c9a774', 'eee0bc': 'ecd9ae',
  /* 純黑陰影 → 暖黑陰影（保留透明度，影子才不會在羊皮紙上發灰） */
  '000000': '2a1c14', 'fff': 'fff8e6', 'ffffff': 'fff8e6', 'fff7e1': 'fff6df',
  /* 稀有度／狀態色：只把紫與藍偏暖，金與陶土色本來就暖 */
  'b397bd': 'b08fa6', 'c5a458': 'c5a458', 'c3836d': 'c3836d',
  /* 其餘零星：深綠陰影、綠色強調、危險色、冷奶油 */
  '182f2b': '1f1a12', '263b28': '231f16', '2f221d': '3b2b25', '3a2020': '33231a',
  '453029': '4d382c', '4a2a2a': '40291c', '4f795d': '557a3c', '566b52': '5c5a34',
  'a97c2c': 'a97c2c', 'ab5549': 'a46342', 'c99991': 'c9a673', 'cfada4': 'cfa165',
  'e4e7da': 'e8ddc0', 'f8f5e6': 'fbe8c4', 'f5eacb': 'ffedc8', 'f7ecd4': 'ffedc8',
  'dccdb0': 'd8b881'
};

const target = process.argv.includes('--check') ? null : path.resolve(__dirname, '..', 'style.css');
const file = target || path.resolve(__dirname, '..', 'style.css');
let css = fs.readFileSync(file, 'utf8');
const misses = new Set();
let hits = 0;
css = css.replace(/#([0-9a-fA-F]{3,8})\b/g, (whole, hexRaw) => {
  const hex = hexRaw.toLowerCase();
  let base, alpha = '';
  if (hex.length === 4) { base = hex.split('').map(c => c + c).join('').slice(0, 6); alpha = hex[3].repeat(2); }
  else if (hex.length === 3) base = hex.split('').map(c => c + c).join('');
  else { base = hex.slice(0, 6); alpha = hex.slice(6); }
  const mapped = MAP[base];
  if (!mapped) { misses.add(base); return whole; }
  hits++;
  return '#' + mapped + alpha;
});
if (misses.size) {
  console.log('未對照到的顏色（保留原值）：' + [...misses].sort().join(' '));
}
console.log(`已置換 ${hits} 個顏色引用`);
if (target) fs.writeFileSync(target, css);
