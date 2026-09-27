'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const path=require('node:path');
const fs=require('node:fs');
const PLAYWRIGHT='C:/Users/ray/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright';
const {chromium}=require(PLAYWRIGHT);

const ROOT=path.resolve(__dirname,'..');
const PORT=4599+Math.floor(Math.random()*300);
const BASE='http://127.0.0.1:'+PORT;
const SHOT=path.join(ROOT,'tests','shots');
const CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe';
const ARGS=['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader','--hide-scrollbars'];

let server,browser,context,page,errors;

function startServer(){
  return new Promise((resolve,reject)=>{
    server=spawn(process.execPath,[path.join(ROOT,'server.cjs')],{env:{...process.env,PORT:String(PORT)}});
    server.stderr.on('data',d=>process.stderr.write('[server] '+d));
    const deadline=Date.now()+15000;
    (function ping(){
      require('node:http').get(BASE+'/index.html',res=>{res.resume();resolve();}).on('error',()=>{
        if(Date.now()>deadline)reject(new Error('server did not start'));else setTimeout(ping,150);
      });
    })();
  });
}

const state=()=>page.evaluate(()=>globalThis.GameApp.snapshot());
const worldStats=()=>page.evaluate(()=>globalThis.GameApp.getWorldStats());
const dispatch=(type,payload)=>page.evaluate(([t,p])=>globalThis.GameApp.dispatch(t,p),[type,payload||{}]);
const tap=selector=>page.locator(selector).first().dispatchEvent('click');
const advance=seconds=>page.evaluate(s=>{globalThis.GameApp.advance(s);return globalThis.GameApp.snapshot();},seconds);

async function reset(seed){
  await page.evaluate(s=>{
    try{localStorage.clear();}catch(_){}
    globalThis.GameApp.replaceState(globalThis.GameCore.create(s));
  },seed);
  await page.evaluate(()=>globalThis.GameApp.navigate('castle'));
  await page.waitForTimeout(120);
}

function check(name,fn){return async()=>{const mark=errors.length;await fn();assert.deepEqual(errors.slice(mark),[],name+' raised errors');};}

test.before(async()=>{
  fs.mkdirSync(SHOT,{recursive:true});
  await startServer();
  browser=await chromium.launch({headless:true,executablePath:CHROME,args:ARGS});
  context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1});
  page=await context.newPage();
  errors=[];
  page.on('pageerror',e=>errors.push('pageerror: '+e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text());});
  await page.goto(BASE+'/?test',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>globalThis.GameApp&&document.querySelectorAll('.nav-button').length>=8,{timeout:60000});
  await page.waitForFunction(()=>globalThis.GameApp.getWorldStats()?.frames>0,{timeout:60000});
});

test.after(async()=>{await browser?.close();server?.kill();});

test('boot: shell, resources, navigation and a live voxel world with no console errors',check('boot',async()=>{
  const info=await page.evaluate(()=>({
    resources:document.querySelectorAll('#resource-bar .resource').length,
    nav:document.querySelectorAll('.nav-button').length,
    slots:document.querySelectorAll('#party-dock .party-slot').length,
    panel:document.querySelector('#panel').innerHTML.length,
    worldMessage:document.querySelector('#world-message').hidden,
    stats:globalThis.GameApp.getWorldStats()
  }));
  assert.equal(info.resources,4);
  assert.equal(info.nav,8);
  assert.ok(info.slots>=2,'party dock shows unlocked slots');
  assert.ok(info.panel>1500,'castle panel rendered');
  assert.equal(info.worldMessage,true,'world start message is cleared');
  assert.ok(info.stats.frames>0&&info.stats.blocks>1000,'voxel scene produced geometry');
  assert.equal(info.stats.worldSeed,'94721');
  // Software WebGL has to rasterise a whole continent now; give the capture room.
  await page.screenshot({path:path.join(SHOT,'desktop-castle.png'),timeout:120000});
}));

test('first-run free route through the live UI: recruit, form up, hunt, loot, equip, build, enhance',check('free route',async()=>{
  await reset(42);
  await tap('.nav-button[data-nav="heroes"]');
  const before=(await state()).heroes.length;
  await tap('button[data-action="recruit"][data-payload*="normal"]');
  await page.waitForFunction(n=>globalThis.GameApp.snapshot().heroes.length===n+1,before);
  const recruited=await state();
  assert.equal(recruited.heroes.length,before+1);
  assert.ok(recruited.resources.gold<300,'recruiting spent gold');
  assert.equal(recruited.stats.recruits,1);

  await tap('button[data-action="autoTeam"]');
  await page.waitForFunction(()=>globalThis.GameApp.snapshot().teams[0].filter(Boolean).length>=2);
  await tap('.nav-button[data-nav="hunt"]');
  await tap('button[data-action="dispatch"]');
  await page.waitForFunction(()=>globalThis.GameApp.snapshot().hunting.active===true);

  const hunted=await advance(180);
  assert.ok(hunted.stats.kills>0,'combat produced kills');
  assert.ok(hunted.progress.totalStages>0,'stage progress advanced');
  assert.ok(hunted.heroes.some(h=>h.level>1),'hero gained levels');
  assert.ok(hunted.kingdom.level>=2,'kingdom gained levels');
  let looted=hunted;
  for(let i=0;i<15&&looted.inventory.length===0;i++)looted=await advance(120);
  assert.ok(looted.inventory.length>0,'early hunting drops equipment within the first half hour of game time');

  const recalled=await dispatch('recall');
  assert.ok(recalled.ok||/休整/.test(recalled.message),'recall is either accepted or blocked by the documented rest lock: '+recalled.message);
  const pick=await page.evaluate(()=>{
    const s=globalThis.GameApp.snapshot();
    const hero=s.heroes.find(h=>s.inventory.some(i=>!i.classId||i.classId===h.classId));
    const it=s.inventory.find(i=>!i.classId||i.classId===hero.classId);
    return {itemId:it.id,heroId:hero.id,slot:it.slot};
  });
  const equipped=await page.evaluate(p=>({r:globalThis.GameApp.dispatch('equip',p),s:globalThis.GameApp.snapshot()}),pick);
  assert.equal(equipped.r.ok,true,equipped.r.message);
  assert.equal(equipped.s.heroes.find(h=>h.id===pick.heroId).equipment[pick.slot],pick.itemId,'equipping binds the item');

  await advance(900);
  const built=await page.evaluate(()=>{
    const s=globalThis.GameApp.snapshot();
    globalThis.GameApp.replaceState(globalThis.GameCore.addReward(s,{materials:{iron:40,leather:20,herb:20}},'test fixture supply')||s);
    return globalThis.GameApp.dispatch('building',{id:'forge'});
  });
  assert.equal(built.ok,true,built.message);
  const enhanced=await page.evaluate(()=>{
    const it=globalThis.GameApp.snapshot().inventory.find(i=>!i.locked);
    const r=globalThis.GameApp.dispatch('enhance',{itemId:it.id,count:1});
    const s=globalThis.GameApp.snapshot();
    return {r,forge:s.buildings.forge,level:s.inventory.find(i=>i.id===it.id).enhance};
  });
  assert.equal(enhanced.r.ok,true,enhanced.r.message);
  assert.equal(enhanced.forge,1,'forge construction committed');
  assert.equal(enhanced.level,1,'forge upgrade raised the item enhance level');
}));

test('requested quests render their real state and the loader serves every asset',check('layout',async()=>{
  for(const nav of ['castle','hunt','heroes','equipment','quests','challenges','shop','settings']){
    await tap(`.nav-button[data-nav="${nav}"]`);
    await page.waitForTimeout(90);
    const len=await page.evaluate(()=>document.querySelector('#panel').innerHTML.length);
    assert.ok(len>400,`${nav} panel renders content`);
  }
  await page.screenshot({path:path.join(SHOT,'desktop-quests.png')});
  const missing=await page.evaluate(async()=>{
    const urls=['style.css','vendor/three.min.js','js/castle-geometry.js','js/terrain-geometry.js','js/game-data.js','js/game-core.js','js/game-extensions.js','js/icons.js','js/world.js','js/ui.js'];
    const bad=[];
    for(const url of urls){const res=await fetch(url);if(!res.ok)bad.push(url+':'+res.status);}
    return bad;
  });
  assert.deepEqual(missing,[]);
}));

test('extension systems accept real actions: quests, signin, chest, buildings, challenges, guild, research',check('extensions',async()=>{
  await reset(77);
  await dispatch('recruit',{kind:'normal'});
  await dispatch('autoTeam');
  await dispatch('dispatch');
  const progressed=await advance(2400);
  assert.ok(progressed.kingdom.level>=2,'hunting raised the kingdom to Lv2 before building');
  // This test is about the actions being accepted, not about how fast iron accrues, and
  // income pacing now includes the march to the zone. Grant what the upgrade needs.
  await page.evaluate(()=>{
    const s=globalThis.GameApp.snapshot();
    for(const k of Object.keys(s.materials))s.materials[k]=Math.max(s.materials[k],500);
    s.resources.gold=Math.max(s.resources.gold,500000);
    globalThis.GameApp.replaceState(s);
  });
  const r=await page.evaluate(()=>{
    const A=globalThis.GameApp,out={};
    out.claimAll=A.dispatch('claimAll');
    out.signin=A.dispatch('signin');
    out.chest=A.dispatch('chest');
    out.building=A.dispatch('building',{id:'training'});
    out.challenge=A.dispatch('challenge',{kind:'gold'});
    out.arenaDefense=A.dispatch('arenaDefense',{team:0});
    out.guildDonate=A.dispatch('guildDonate',{});
    out.research=A.dispatch('research');
    out.recall=A.dispatch('recall');
    return out;
  });
  // auto-continue would re-dispatch the party the moment a defeat rest finishes, so the
  // retry loop below would never see a settled state and the assertion would race.
  await dispatch('autoContinue',{value:false});
  let target=await dispatch('target',{zone:1,stage:3});
  for(let i=0;i<5&&!target.ok;i++){
    await dispatch('recall');
    await advance(30);
    target=await dispatch('target',{zone:1,stage:3});
  }
  assert.equal(target.ok,true,target.message);
  for(const key of ['building','challenge','arenaDefense','guildDonate']){
    assert.equal(r[key].ok,true,key+' failed: '+r[key].message);
  }
  assert.equal((await dispatch('speed',{value:4})).ok,true);
  assert.equal((await dispatch('autoNext',{value:true})).ok,true);
  assert.equal(r.signin.ok,true,'signin should succeed on a fresh day: '+r.signin.message);
  assert.equal(r.chest.ok,true,'chest should open on a fresh day: '+r.chest.message);
  for(const nav of ['quests','shop','challenges','castle']){
    await tap(`.nav-button[data-nav="${nav}"]`);
    await page.waitForTimeout(80);
    assert.ok((await page.evaluate(()=>document.querySelector('#panel').innerHTML.length))>400);
  }
  for(const sub of ['wanderers','expeditions','guild','artifacts','collections','resonance']){
    await tap('.nav-button[data-nav="castle"]');
    await page.waitForTimeout(60);
    await tap(`[data-nav="${sub}"]`);
    await page.waitForTimeout(80);
    assert.ok((await page.evaluate(()=>document.querySelector('#panel').innerHTML.length))>300,sub+' panel renders');
  }
}));

test('save, export, import and rejection of corrupt data',check('persistence',async()=>{
  await reset(11);
  await dispatch('recruit',{kind:'normal'});
  await advance(120);
  const snapshot=await state();
  const roundTrip=await page.evaluate(next=>{globalThis.GameApp.replaceState(next);return globalThis.GameApp.snapshot();},snapshot);
  assert.deepEqual(roundTrip.heroes.map(h=>h.id),snapshot.heroes.map(h=>h.id));
  assert.equal(roundTrip.resources.gold,snapshot.resources.gold);
  const rejected=await page.evaluate(()=>{
    const s=globalThis.GameApp.snapshot();s.buildings.castle=9999;
    try{globalThis.GameApp.replaceState(s);return null;}catch(e){return e.message;}
  });
  assert.ok(rejected&&/不/.test(rejected),'invalid save is refused with an explanation');
  const after=await state();
  assert.equal(after.buildings.castle,snapshot.buildings.castle,'refused import left progress untouched');

  const stored=await page.evaluate(()=>{try{return JSON.parse(localStorage.getItem('canglan-save-v1'))?.heroes.length??null;}catch(_){return null;}});
  assert.equal(stored,snapshot.heroes.length,'autosave wrote the roster to persistent storage');
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>globalThis.GameApp&&globalThis.GameApp.getWorldStats()?.frames>0,{timeout:90000});
  const reloaded=await page.evaluate(()=>globalThis.GameApp.snapshot());
  assert.equal(reloaded.heroes.length,snapshot.heroes.length,'progress survives a real reload');
  assert.equal(reloaded.resources.gold,snapshot.resources.gold);
}));

test('world views, cutaway, inspection, zoom, map, battle and lighting stay bounded',check('world',async()=>{
  const before=await worldStats();
  for(const name of ['overview','top','gate','courtyard','keep']){
    await page.evaluate(n=>globalThis.GameApp.world().setCamera(n),name);
    await page.waitForTimeout(90);
  }
  await tap('button[data-world="zoom-in"]');
  await tap('button[data-world="zoom-out"]');
  await tap('button[data-world="inspect"]');
  await tap('button[data-world="cut"]');
  await page.waitForTimeout(220);
  const cut=await worldStats();
  assert.equal(cut.cutaway,true,'cutaway toggles');
  assert.equal(cut.inspection,true,'inspection toggles');
  await tap('button[data-world="cut"]');
  await tap('button[data-world="inspect"]');
  await page.evaluate(()=>globalThis.GameApp.world().setView('map'));
  await page.waitForTimeout(180);
  assert.equal((await worldStats()).view,'map');
  await page.screenshot({path:path.join(SHOT,'world-map.png')});
  await page.evaluate(()=>{globalThis.GameApp.world().setView('battle');globalThis.GameApp.dispatch('dispatch');});  await page.waitForTimeout(240);
  assert.equal((await worldStats()).view,'battle');
  await page.screenshot({path:path.join(SHOT,'world-battle.png')});
  await page.evaluate(()=>globalThis.GameApp.world().setHour(2));
  assert.equal((await worldStats()).hour,2,'night lighting applies');
  await page.evaluate(()=>{globalThis.GameApp.world().setHour(15);globalThis.GameApp.world().setView('castle');globalThis.GameApp.world().setCamera('overview');});
  const after=await worldStats();
  assert.ok(after.geometries<=before.geometries+16,`geometry stays bounded (${before.geometries} -> ${after.geometries})`);
  assert.ok(after.blocks>1000);
}));

test('3D markers select real buildings and the world map marks all ten regions',check('markers',async()=>{
  await reset(5);
  await page.evaluate(()=>{globalThis.GameApp.world().setView('castle');globalThis.GameApp.world().setCamera('overview');});
  await page.waitForTimeout(320);
  const buildings=await page.evaluate(()=>globalThis.GameApp.world().getMarkers().filter(m=>m.kind==='building'));
  assert.equal(buildings.length,10,'ten facility markers exist');
  const target=buildings.find(m=>m.id==='forge'&&m.visible)||buildings.find(m=>m.visible);
  assert.ok(target,'a facility marker is on screen');
  const box=await page.locator('#world').boundingBox();
  await page.mouse.move(box.x+target.x,box.y+target.y);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(220);
  const panel=await page.evaluate(()=>document.querySelector('#panel').innerHTML);
  assert.ok(panel.includes('設施功能')&&(panel.includes('升級建築')||panel.includes('建造設施')),'clicking a facility proxy opens its building panel');
  const anchors=await page.evaluate(()=>Object.keys(globalThis.GameApp.getWorldStats().buildingAnchors));
  assert.equal(anchors.length,10);
  await page.evaluate(()=>globalThis.GameApp.world().setView('map'));
  await page.waitForTimeout(320);
  const zones=await page.evaluate(()=>globalThis.GameApp.world().getMarkers().filter(m=>m.kind==='zone'));
  assert.equal(zones.length,10,'ten region markers exist');
  assert.equal(zones.filter(z=>z.locked).length,9,'only the first region is unlocked on a new save');
}));

test('responsive layouts 1440/768/390/320 keep the game usable without overflow',check('responsive',async()=>{
  await reset(3);
  const problems=[];
  for(const size of [{width:1440,height:900},{width:768,height:1024},{width:390,height:844},{width:320,height:640}]){
    await page.setViewportSize(size);
    /* resize 會丟掉 drawing buffer，而閒置時場景不重繪；強制重畫並等真的畫完，
       不然截圖（軟體渲染＋合成器）會拍到空的 canvas。 */
    const before=await page.evaluate(()=>{globalThis.GameApp.world().zoom(1);return globalThis.GameApp.getWorldStats().frames;});
    await page.waitForFunction(n=>globalThis.GameApp.getWorldStats().frames>n+1,before,{timeout:60000,polling:120});
    await page.waitForTimeout(300);
    const report=await page.evaluate(()=>{
      const root=document.documentElement;
      const overflow=root.scrollWidth-root.clientWidth;
      const clipped=[...document.querySelectorAll('#panel button,#panel select,#resource-bar .resource,#navigation .nav-button')]
        .filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&(r.right>root.clientWidth+2||r.left<-2);})
        .map(el=>(el.className||el.tagName)+'@'+Math.round(el.getBoundingClientRect().right));
      return {overflow,clipped:clipped.slice(0,6),nav:document.querySelectorAll('.nav-button').length};
    });
    if(report.overflow>1)problems.push(`${size.width}: horizontal overflow ${report.overflow}px`);
    if(report.clipped.length)problems.push(`${size.width}: clipped ${report.clipped.join(', ')}`);
    if(report.nav<8)problems.push(`${size.width}: navigation incomplete`);
    if(size.width<=390)await page.screenshot({path:path.join(SHOT,`mobile-${size.width}.png`)});
  }
  await page.setViewportSize({width:1440,height:900});
  assert.deepEqual(problems,[],problems.join(' | '));
}));

test('accessibility basics: names, landmarks, live region, focus and escape',check('a11y',async()=>{
  const audit=await page.evaluate(()=>({
    unlabelled:[...document.querySelectorAll('button,select,input')].filter(el=>{
      const name=el.getAttribute('aria-label')||el.textContent.trim()||el.closest('label')?.textContent?.trim()||el.getAttribute('title');
      return !name;
    }).length,
    canvas:document.querySelector('#world')?.getAttribute('aria-label')||'',
    live:!!document.querySelector('#toasts[aria-live]'),
    main:!!document.querySelector('main'),
    nav:!!document.querySelector('nav[aria-label]')
  }));
  assert.equal(audit.unlabelled,0,'every control has an accessible name');
  assert.ok(audit.canvas.length>4,'world canvas is described');
  assert.equal(audit.live,true);
  assert.equal(audit.main,true);
  assert.equal(audit.nav,true);
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  const focused=await page.evaluate(()=>document.activeElement.tagName);
  assert.ok(['BUTTON','SELECT','INPUT','A'].includes(focused),'tab focus lands on a control');
  await page.evaluate(()=>{const d=document.querySelector('#confirm-dialog');document.querySelector('#dialog-content').innerHTML='<h2 id="dialog-title">測試</h2>';d.showModal();});
  await page.keyboard.press('Escape');
  await page.waitForTimeout(120);
  assert.equal(await page.evaluate(()=>document.querySelector('#confirm-dialog').open),false,'escape closes the confirm dialog');
}));

test('render loop stays bounded: idle scene pauses, active scene animates, views do not leak',check('performance',async()=>{
  await reset(9);
  const idle=await page.evaluate(async()=>{
    const start=globalThis.GameApp.getWorldStats().frames;
    await new Promise(r=>setTimeout(r,1500));
    return globalThis.GameApp.getWorldStats().frames-start;
  });
  assert.ok(idle<=6,`an idle castle does not spin the renderer (${idle} frames in 1.5s)`);

  await dispatch('recruit',{kind:'normal'});
  await dispatch('autoTeam');
  await dispatch('dispatch');
  const active=await page.evaluate(async()=>{
    const start=globalThis.GameApp.getWorldStats();
    const t0=performance.now();
    await new Promise(r=>setTimeout(r,3000));
    const end=globalThis.GameApp.getWorldStats();
    return {frames:end.frames-start.frames,seconds:(performance.now()-t0)/1000,actors:end.actors,geometries:end.geometries,textures:end.textures,drawCalls:end.drawCalls,triangles:end.triangles,msPerFrame:(performance.now()-t0)/Math.max(1,end.frames-start.frames)};
  });
  assert.ok(active.actors>=2,`the active hunt places party and enemy actors in the scene (${active.actors})`);
  assert.ok(active.frames>0,'the active hunt keeps rendering');
  assert.ok(active.drawCalls<=400,`draw calls bounded (${active.drawCalls})`);
  assert.ok(active.geometries<=260,`geometry count bounded (${active.geometries})`);
  const before=active.geometries;
  for(let i=0;i<3;i++){
    await page.evaluate(()=>globalThis.GameApp.world().setView('map'));
    await page.waitForTimeout(140);
    await page.evaluate(()=>globalThis.GameApp.world().setView('castle'));
    await page.waitForTimeout(140);
  }
  const after=await worldStats();
  assert.ok(after.geometries<=before+8,`view switching does not leak geometry (${before} -> ${after.geometries})`);
  assert.ok(after.frames>0,'renderer keeps producing frames after view churn');
}));

test('open world: ten biome zones share one map and combat never swaps the scene',check('openworld',async()=>{
  await reset(9);
  const base=await worldStats();
  assert.equal(base.map.count,10,'ten dungeon zones exist');
  assert.equal(base.map.biomes,10,'ten biomes cover the world');
  assert.equal(base.map.groups,10,'all ten zone groups are built at once');
  const distances=base.map.positions.map(p=>Math.hypot(...p));
  assert.ok(distances.every((d,i)=>d>120&&d<250&&(!i||d>distances[i-1])),'zones advance outward in difficulty order');
  const gaps=base.map.positions.map((p,i)=>{const n=base.map.positions[(i+1)%base.map.positions.length];return Math.hypot(n[0]-p[0],n[1]-p[1]);});
  assert.ok(Math.min(...gaps)>=60,'neighbouring zones do not overlap');
  assert.ok(base.worldBlocks>60000,`the whole world is built at once (${base.worldBlocks} static blocks)`);

  assert.ok(base.map.radius>=250,'the continent is larger than the old island');

  // A view must only move the camera: the same geometry stays in the scene in every view.
  for(const view of['castle','map','battle']){
    await page.evaluate(v=>globalThis.GameApp.world().setView(v),view);
    const stats=await worldStats();
    assert.equal(stats.view,view,`view ${view} is reported`);
    assert.equal(stats.worldBlocks,base.worldBlocks,`view ${view} keeps the entire map instead of swapping scenes`);
  }

  // Building markers, ring markers and the abyss gate all coexist on the one map.
  const markers=await page.evaluate(()=>globalThis.GameApp.world().getMarkers());
  assert.equal(markers.filter(m=>m.kind==='building').length,10,'ten facility markers');
  assert.equal(markers.filter(m=>m.kind==='zone').length,10,'ten ring markers');
  assert.equal(markers.filter(m=>m.kind==='abyss').length,1,'the abyss gate is on the map');

  // The party walks the gate road and the ring road, then fights inside the zone.
  await dispatch('recruit',{kind:'normal'});
  await dispatch('autoTeam');
  await dispatch('target',{zone:1,stage:1});
  await dispatch('dispatch');
  await page.waitForTimeout(300);
  const setOut=await page.evaluate(()=>globalThis.GameApp.getWorldStats().field);
  assert.ok(setOut&&setOut.phase==='out','the game state puts the party on the march');
  assert.ok(setOut.party.length>=1,'the field carries the party');
  assert.ok(setOut.party.every(m=>m.path>5),'every member has a real waypoint route');
  // Spacing is applied on the game clock, and in software WebGL that clock only moves
  // with animation frames, so wait for the state instead of for a duration.
  if(setOut.party.length>=2){
    await page.waitForFunction(()=>{
      const f=globalThis.GameApp.getWorldStats().field;
      if(!f||f.party.length<2)return true;
      for(let a=0;a<f.party.length;a++)for(let b=a+1;b<f.party.length;b++){
        if(Math.hypot(f.party[a].x-f.party[b].x,f.party[a].z-f.party[b].z)<1)return false;
      }
      return true;
    },null,{timeout:120000,polling:100});
    const marched=await page.evaluate(()=>globalThis.GameApp.getWorldStats().field.party.map(m=>[m.x,m.z]));
    const marchGaps=marched.flatMap((m,i)=>marched.slice(i+1).map(n=>Math.hypot(m[0]-n[0],m[1]-n[1])));
    assert.ok(Math.min(...marchGaps)>1,'members march apart instead of standing on one point');
  }

  const zone1=base.map.positions[0];
  const closest=()=>page.evaluate(z=>{
    const f=globalThis.GameApp.getWorldStats().field;
    return f&&f.party.length?Math.min(...f.party.map(m=>Math.hypot(m.x-z[0],m.z-z[1]))):null;
  },zone1);
  const far=await closest();
  // Headless WebGL is software rendered, so the walk is driven by animation frames, not
  // wall clock: wait for the actual state instead of a fixed duration.
  await page.waitForFunction(z=>{
    const f=globalThis.GameApp.getWorldStats().field;
    return !!f&&f.party.some(m=>Math.hypot(m.x-z[0],m.z-z[1])<10);
  },zone1,{timeout:180000,polling:250});
  const near=await closest();
  assert.ok(near!==null&&far!==null&&near<far-1,`the party closes on zone 1 on foot (${far} -> ${near})`);

  await page.evaluate(()=>globalThis.GameApp.world().setView('battle'));
  // Sample continuously inside the page: a round trip between the wait and the read can
  // miss the window if the fight resolves before the assertion runs.
  const fighting=await page.evaluate(async()=>{
    const deadline=performance.now()+180000;
    let best=null;
    while(performance.now()<deadline){
      const s=globalThis.GameApp.getWorldStats(),f=s.field;
      if(f&&f.phase==='fight'){
        best={front:f.party.map(m=>[m.x,m.z]),foe:f.foe,worldBlocks:s.worldBlocks,drawCalls:s.drawCalls,view:s.view,aggro:f.aggro};
        if(f.party.length>=2)break;
      }
      await new Promise(r=>setTimeout(r,50));
    }
    return best;
  });
  assert.ok(fighting,'the party never closed on the monster inside the zone');
  const front=fighting.front;
  assert.ok(front.length>=1,'the party holds its melee slots inside the zone');
  const meleeGaps=front.flatMap((p,i)=>front.slice(i+1).map(q=>Math.hypot(p[0]-q[0],p[1]-q[1])));
  if(meleeGaps.length)assert.ok(Math.min(...meleeGaps)>1,'the party fights fanned out, not stacked on one point');
  for(const p of front)assert.ok(Math.hypot(p[0]-zone1[0],p[1]-zone1[1])<16,`melee slot ${p} is inside zone 1`);
  assert.ok(fighting.aggro,'the monster aggroed and came out to meet the party');
  const enemy=fighting.foe;
  assert.ok(Math.hypot(enemy[0]-zone1[0],enemy[1]-zone1[1])<16,`the enemy is inside zone 1 too (${enemy})`);
  // Dispatching must walk the party all the way onto the monster, not just into the zone.
  for(const p of front){
    const gap=Math.hypot(p[0]-enemy[0],p[1]-enemy[1]);
    assert.ok(gap<10,`hero stopped ${gap.toFixed(1)} units from the monster; it must close to melee range`);
  }
  assert.equal(fighting.worldBlocks,base.worldBlocks,'fighting did not swap the scene');
  assert.ok(fighting.drawCalls<=400,`draw calls bounded (${fighting.drawCalls})`);

  // 畫質設定：低畫質真的關陰影並降解析度，高畫質拉回來
  const low=await page.evaluate(()=>{globalThis.GameApp.world().setQuality('low');return globalThis.GameApp.getWorldStats();});
  assert.equal(low.shadows,false,'低畫質關閉陰影');
  assert.ok(low.pixelRatio<=1.01,`低畫質 pixel ratio 降到 1（${low.pixelRatio}）`);
  const high=await page.evaluate(()=>{globalThis.GameApp.world().setQuality('high');return globalThis.GameApp.getWorldStats();});
  assert.equal(high.shadows,true,'高畫質開啟陰影');
  assert.ok(high.shadowSize>=2048,`高畫質把陰影拉到 2048（${high.shadowSize}）`);
  assert.ok(high.pixelRatio>=low.pixelRatio,`高畫質的 pixel ratio 不低於低畫質（${low.pixelRatio} → ${high.pixelRatio}）`);
  await page.evaluate(()=>globalThis.GameApp.world().setQuality('auto'));
}));
