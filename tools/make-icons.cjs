'use strict';
/* 產生 PWA／主畫面圖示（純 Node，無外部依賴）：自己寫 PNG 編碼器，把暖色系的
   城堡紋章畫成點陣圖。執行：node tools/make-icons.cjs
   產出 icons/icon-192.png、icons/icon-512.png、icons/apple-touch-icon-180.png */
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const OUT = path.resolve(__dirname, '..', 'icons');

/* --- 最小 PNG 編碼器（8-bit RGBA、無交錯） --- */
function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = (crc ^ buf[i]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;                                   // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0; // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/* --- 畫圖：暖色調色盤（跟 style.css 同一組） --- */
const C = {
  sky: [0x2f, 0x48, 0x26],   // 深森林綠底
  ground: [0x45, 0x67, 0x3a],
  wall: [0xff, 0xed, 0xc8],  // 羊皮紙白牆
  wallShade: [0xd8, 0xb8, 0x81],
  roof: [0x8f, 0x4f, 0x30],  // 陶瓦
  door: [0xbe, 0x8c, 0x53],
  gold: [0xcd, 0x8c, 0x2f]
};

function makeIcon(size) {
  const px = Buffer.alloc(size * size * 4);
  const put = (x, y, [r, g, b], a = 255) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    const na = a / 255, ia = 1 - na;
    px[i] = Math.round(px[i] * ia + r * na);
    px[i + 1] = Math.round(px[i + 1] * ia + g * na);
    px[i + 2] = Math.round(px[i + 2] * ia + b * na);
    px[i + 3] = Math.max(px[i + 3], a);
  };
  const rect = (x0, y0, w, h, col, a) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) put(x, y, col, a);
  };

  const u = size / 32;                                   // 以 32 格為設計單位
  const G = (n) => Math.round(n * u);
  // 底色：深綠天，下半草原
  rect(0, 0, size, size, C.sky);
  rect(0, G(21), size, size, C.ground);
  // 城牆（含兩座塔）
  rect(G(5), G(13), G(22), G(9), C.wallShade);
  rect(G(5), G(13), G(22), G(2), C.wall);
  rect(G(4), G(10), G(5), G(12), C.wall);                // 左塔
  rect(G(23), G(10), G(5), G(12), C.wall);               // 右塔
  for (const t of [4, 23]) for (let i = 0; i < 3; i++) rect(G(t + i * 2), G(9), G(1), G(1), C.wall);
  for (let i = 0; i < 11; i++) if (i % 2 === 0) rect(G(5 + i * 2), G(11), G(1), G(1), C.wall);
  // 中央主堡與陶瓦屋頂
  rect(G(12), G(6), G(8), G(9), C.wall);
  for (let i = 0; i < 4; i++) rect(G(11 + i), G(5 - i), G(10 - i * 2), G(1), C.roof);
  // 城門與旗幟
  rect(G(14), G(18), G(4), G(4), C.door);
  rect(G(15), G(2), G(2), G(2), C.gold);
  rect(G(15), G(7), G(2), G(2), C.gold);
  return encodePng(size, size, px);
}

fs.mkdirSync(OUT, { recursive: true });
for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon-180.png', 180]]) {
  fs.writeFileSync(path.join(OUT, name), makeIcon(size));
  console.log('寫出 icons/' + name, size + '×' + size);
}
