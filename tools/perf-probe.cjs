'use strict';
/* 效能探測：桌機與手機尺寸各量一次 draw call／三角形／材質數、每幀 JS 時間與
   frame 間隔。headless 走軟體渲染（SwiftShader），所以 frame 間隔不代表真機 GPU；
   draw call 與 JS 時間則與顯示卡無關，可以當成預算依據。

   用法： node tools/perf-probe.cjs [--headed]
   --headed 會用真的 GPU（Linux/Windows 桌面）跑一次，數字才接近實機。 */
const { spawn } = require('node:child_process');
const path = require('node:path');
const http = require('node:http');
const PLAYWRIGHT = process.env.PLAYWRIGHT_DIR || 'C:/Users/ray/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright';
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const { chromium } = require(PLAYWRIGHT);

const ROOT = path.resolve(__dirname, '..');
const PORT = 4780 + Math.floor(Math.random() * 120);
const BASE = 'http://127.0.0.1:' + PORT;
const HEADED = process.argv.includes('--headed');
const PROFILES = [
  { name: '桌機 1440×900', width: 1440, height: 900, dpr: 1, touch: false, throttle: [1, 4] },
  { name: '手機 390×844', width: 390, height: 844, dpr: 3, touch: true, throttle: [1, 4, 6] },
  { name: '小手機 320×568', width: 320, height: 568, dpr: 2, touch: true, throttle: [1, 6] }
];

function startServer() {
  return new Promise((resolve, reject) => {
    const server = spawn(process.execPath, [path.join(ROOT, 'server.cjs')], { env: { ...process.env, PORT: String(PORT) } });
    server.on('exit', code => { if (code) reject(new Error('server exited ' + code)); });
    const deadline = Date.now() + 15000;
    (function ping() {
      http.get(BASE + '/index.html', res => { res.resume(); resolve(server); }).on('error', () => {
        if (Date.now() > deadline) reject(new Error('server did not start')); else setTimeout(ping, 150);
      });
    })();
  });
}

/* 在頁面裡量：每幀 JS 時間用 CDP 的 ScriptDuration 差分，frame 間隔用自己的 rAF 取樣。 */
const SAMPLER = `
window.__perf = { frames: [], running: true, samples: [] };
(function loop(t) {
  window.__perf.frames.push(t);
  if (window.__perf.frames.length > 4000) window.__perf.frames.shift();
  if (window.__perf.running) requestAnimationFrame(loop);
})(performance.now());
`;

async function measure(page, cdp, seconds, label) {
  await page.evaluate(() => { window.__perf.frames.length = 0; });
  const before = (await cdp.send('Performance.getMetrics')).metrics;
  await page.waitForTimeout(seconds * 1000);
  const after = (await cdp.send('Performance.getMetrics')).metrics;
  const pick = (list, name) => (list.find(m => m.name === name) || { value: 0 }).value;
  const frames = await page.evaluate(() => window.__perf.frames.slice());
  const deltas = frames.slice(1).map((t, i) => t - frames[i]).filter(d => d > 0 && d < 2000).sort((a, b) => a - b);
  const p = q => deltas.length ? deltas[Math.min(deltas.length - 1, Math.floor(deltas.length * q))] : 0;
  const scriptMs = (pick(after, 'ScriptDuration') - pick(before, 'ScriptDuration')) * 1000;
  const styleMs = (pick(after, 'RecalcStyleDuration') - pick(before, 'RecalcStyleDuration')) * 1000;
  const layoutMs = (pick(after, 'LayoutDuration') - pick(before, 'LayoutDuration')) * 1000;
  const n = deltas.length || 1;
  const stats = await page.evaluate(() => globalThis.GameApp.getWorldStats());
  return {
    label,
    frames: deltas.length,
    fps: deltas.length ? 1000 / (deltas.reduce((a, b) => a + b, 0) / n) : 0,
    p50: p(.5), p95: p(.95),
    script: scriptMs / n, style: styleMs / n, layout: layoutMs / n,
    calls: stats.drawCalls, tris: stats.triangles, geo: stats.geometries, tex: stats.textures,
    blocks: stats.blocks, worldBlocks: stats.worldBlocks, batches: stats.batches, actors: stats.actors
  };
}

(async () => {
  const server = await startServer();
  /* headless 只能走 SwiftShader；--headed 會用真的 GPU，frame 時間才有參考價值。 */
  const browser = await chromium.launch({ headless: !HEADED, executablePath: CHROME, args: HEADED ? ['--hide-scrollbars'] : ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--hide-scrollbars'] });
  const rows = [];
  try {
    for (const profile of PROFILES) {
      const context = await browser.newContext({
        viewport: { width: profile.width, height: profile.height },
        deviceScaleFactor: profile.dpr,
        hasTouch: profile.touch,
        isMobile: profile.touch
      });
      const page = await context.newPage();
      await page.addInitScript(SAMPLER);
      await page.goto(BASE + '/index.html?test', { waitUntil: 'load' });
      await page.waitForFunction(() => !!globalThis.GameApp && !!globalThis.GameApp.getWorldStats, null, { timeout: 60000 });
      // 狩獵中＋動畫場景＝最忙的情況
      await page.evaluate(() => { globalThis.GameApp.dispatch('recruit', {}); globalThis.GameApp.dispatch('autoTeam', {}); globalThis.GameApp.dispatch('dispatch', {}); globalThis.GameApp.world().setView('battle'); });
      await page.waitForTimeout(1500);
      const cdp = await context.newCDPSession(page);
      await cdp.send('Performance.enable');
      for (const rate of profile.throttle) {
        await cdp.send('Emulation.setCPUThrottlingRate', { rate });
        const r = await measure(page, cdp, 6, `CPU ×${rate}`);
        rows.push({ profile: profile.name, ...r });
        console.log(`${profile.name.padEnd(14)} ${r.label.padEnd(7)} fps ${r.fps.toFixed(1).padStart(6)} | frame p50 ${r.p50.toFixed(1).padStart(6)}ms p95 ${r.p95.toFixed(1).padStart(6)}ms | JS/幀 ${r.script.toFixed(2).padStart(6)}ms | draw ${String(r.calls).padStart(4)} | 三角 ${(r.tris / 1000).toFixed(0).padStart(5)}k | 方塊 ${(r.blocks / 1000).toFixed(0)}k | geo ${r.geo} tex ${r.tex}`);
      }
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      await context.close();
    }
    console.log('\n=== 預算對照（handoff 目標：桌機 ≤200 draw call、手機 ≤100）===');
    for (const r of rows) {
      const over = r.calls > (r.profile.startsWith('桌機') ? 200 : 100);
      console.log(`${r.profile.padEnd(14)} draw calls ${String(r.calls).padStart(4)} ${over ? '← 超過預算' : 'OK'}`);
    }
  } finally {
    await browser.close();
    server.kill();
  }
})().catch(error => { console.error(error); process.exit(1); });
