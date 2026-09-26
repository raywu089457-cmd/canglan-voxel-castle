'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
require('../js/game-data.js');
const C=require('../js/game-core.js');
const E=require('../js/game-extensions.js');
const NOW=Date.parse('2026-09-21T10:00:00+08:00');
function fresh(seed=123){const s=C.create(seed);s.createdAt=NOW;s.clock=NOW;s.lastSeen=NOW;delete s.ext;E.init(s,NOW);return s;}
function rich(){const s=fresh();s.kingdom.level=30;s.progress.zone=10;s.progress.maxZone=10;for(const k of Object.keys(s.resources))s.resources[k]=1e7;for(const k of Object.keys(s.materials))s.materials[k]=1e5;for(const k of Object.keys(s.buildings))s.buildings[k]=Math.min(k==='market'?10:20,20);E.view(s,NOW);return s;}
function act(s,type,p={},now=NOW){const r=C.dispatch(s,type,p,now);assert.equal(r.ok,true,type+': '+r.message);return r;}
function reject(s,type,p={},now=NOW){const snapshot=JSON.stringify(s);const r=C.dispatch(s,type,p,now);assert.equal(r.ok,false,type+' must reject');assert.equal(JSON.stringify(s),snapshot,'rejected action must be transactional');return r;}
function addHero(s,cls='mage',lv=30){const h=C.makeHero(s,cls,3,lv);s.heroes.push(h);return h;}

test('complete normalized UI catalog and failure-safe fresh state',()=>{const s=fresh(),v=E.view(s,NOW);assert.deepEqual(E.counts,{main:31,daily:10,weekly:8,achievements:45,tutorial:7,artifacts:11,visitorTypes:18});assert.equal(v.buildings.length,10);assert.equal(v.tasks.filter(r=>r.group==='daily').length,5);assert.equal(v.challenges.length,9);for(const rows of [v.buildings,v.tasks,v.shops,v.challenges,v.research,v.honor])for(const row of rows){assert.equal(typeof row.type,'string');assert.equal(typeof row.locked,'boolean');assert.ok(row.payload);assert.ok(row.cost);}assert.equal(C.validate(s).ok,true);reject(s,'building',{id:'castle'});});
test('signin and chest are once per real day and persist through reload',()=>{let s=fresh();act(s,'signin');act(s,'chest');s=JSON.parse(JSON.stringify(s));reject(s,'signin');reject(s,'chest');const before=s.resources.gold;act(s,'signin',{},NOW+86400000);assert.equal(s.ext.monthly.signins,2);assert.equal(s.resources.gold-before,800);act(s,'signin',{},Date.parse('2026-10-01T10:00:00+08:00'));assert.equal(s.ext.monthly.signins,1);});
test('cosmetic world seed does not change task offers or chest',()=>{const a=fresh(123),b=fresh(123);b.worldSeed='different-art-seed';delete b.ext;E.init(b,NOW);assert.deepEqual(a.ext.daily.taskIds,b.ext.daily.taskIds);assert.deepEqual(a.ext.daily.chest,b.ext.daily.chest);assert.deepEqual(a.ext.daily.offers,b.ext.daily.offers);});
test('main quest order and earned claims are permanent',()=>{const s=rich();s.stats.kills=1000;s.progress.totalStages=20;reject(s,'quest',{kind:'main',id:'1'});act(s,'quest',{kind:'main',id:'0'});act(s,'quest',{kind:'main',id:'1'});reject(s,'quest',{kind:'main',id:'0'});assert.equal(s.ext.mainIndex,2);});
test('building resources commit together and grant core kingdom XP',()=>{const s=fresh();s.resources.gold=1e5;s.materials.iron=7;s.materials.leather=4;reject(s,'building',{id:'tavern'});s.materials.iron=8;const before=s.resources.gold;act(s,'building',{id:'tavern'});assert.equal(s.buildings.tavern,2);assert.equal(s.materials.iron,0);assert.equal(s.materials.leather,0);assert.equal(before-s.resources.gold,322);assert.equal(s.kingdom.xp,28);});
test('shop single-use starter aid and weekly limits cannot duplicate',()=>{const s=rich();const before=s.resources.gems;act(s,'shop',{id:'starter'});assert.equal(s.resources.gems-before,180);reject(s,'shop',{id:'starter'});act(s,'shop',{id:'honor:books'});reject(s,'shop',{id:'honor:books'});const counter=JSON.stringify(s.ext.claimed.once);E.onAscend(s,NOW);assert.equal(JSON.stringify(s.ext.claimed.once),counter);});
test('artifact exact appendix costs, account sharing, and no stacked gold effect',()=>{const s=rich(),h=s.heroes[0],h2=addHero(s);s.teams[0][1]=h2.id;act(s,'shop',{id:'artifact:greed'});act(s,'artifact',{id:'greed',action:'equip',heroId:h.id});const one=E.modifiers(s).gold;act(s,'artifact',{id:'greed',action:'equip',heroId:h2.id});assert.equal(E.modifiers(s).gold,one);const before={gold:s.resources.gold,crystal:s.materials.crystal};act(s,'artifact',{id:'greed',action:'refine'});assert.equal(before.gold-s.resources.gold,400);assert.equal(before.crystal-s.materials.crystal,1);s.ext.artifacts.greed.level=10;const gold=s.resources.gold,v=s.materials.void,m=s.materials.myth;act(s,'artifact',{id:'greed',action:'awaken'});assert.equal(gold-s.resources.gold,500000);assert.equal(v-s.materials.void,8);assert.equal(m-s.materials.myth,2);});
test('resonance follows fifth actual level without changing investments',()=>{const s=rich();s.heroes[0].level=50;[40,30,20,10].forEach(lv=>addHero(s,'archer',lv));const novice=addHero(s,'priest',1);const investment=JSON.stringify(novice.investment);act(s,'resonance',{slot:0,heroId:novice.id});assert.equal(C.effectiveLevel(s,novice),10);assert.equal(novice.level,1);assert.equal(JSON.stringify(novice.investment),investment);reject(s,'resonance',{slot:1,heroId:novice.id});});
test('visitor real seconds are independent of combat speed and batching',()=>{const a=rich(),b=JSON.parse(JSON.stringify(a));a.hunting.speed=4;b.hunting.speed=1;E.tick(a,90,NOW+90000);for(let n=1;n<=18;n++)E.tick(b,5,NOW+n*5000);assert.deepEqual(a.ext.wanderers,b.ext.wanderers);assert.equal(a.rng,b.rng);const w=a.ext.wanderers[0],id=w.id;act(a,'wanderer',{id,action:'feed'},NOW+90000);reject(a,'wanderer',{id,action:'feed'},NOW+90000);act(a,'wanderer',{id,action:'recruit'},NOW+90000);assert.ok(!a.ext.wanderers.some(x=>x.id===id));assert.ok(a.heroes.some(h=>h.visitorIdentity===id));});
test('visitor expedition blocks other operations and settles only once',()=>{const s=rich();E.tick(s,45,NOW+45000);const w=s.ext.wanderers[0];act(s,'wanderer',{id:w.id,action:'expedition',hours:1,zone:1},NOW+45000);reject(s,'wanderer',{id:w.id,action:'recruit'},NOW+45000);reject(s,'wanderer',{id:w.id,action:'feed'},NOW+45000);E.offline(s,3600,NOW+3645000);assert.equal(w.expedition,null);const gold=s.resources.gold;E.offline(s,0,NOW+3645000);assert.equal(s.resources.gold,gold);});
test('commission immediate recall yields zero and blocks retry',()=>{const s=rich();const h=addHero(s,'swordsman',150),row=E.view(s,NOW).commissions[0];act(s,'commission',{id:row.id,heroIds:[h.id]});assert.ok(h.expeditionId);const before=s.resources.gold;act(s,'commissionRecall',{id:row.id});assert.equal(s.resources.gold,before);assert.equal(h.expeditionId,null);reject(s,'commission',{id:row.id,heroIds:[h.id]});});
test('commission complete and partial recall release occupancy exactly once',()=>{const s=rich(),h=addHero(s,'swordsman',150),row=E.view(s,NOW).commissions[0];act(s,'commission',{id:row.id,heroIds:[h.id]});const x=s.ext.commissions[0],reward=x.reward.gold,before=s.resources.gold;act(s,'commissionRecall',{id:x.id},NOW+1800000);assert.equal(s.resources.gold-before,Math.floor(reward*.25));const h2=addHero(s,'mage',150),row2=E.view(s,NOW+1800000).commissions[1];act(s,'commission',{id:row2.id,heroIds:[h2.id]},NOW+1800000);const x2=s.ext.commissions[0],g=s.resources.gold;E.offline(s,3600,x2.endAt);assert.equal(s.resources.gold-g,x2.reward.gold);assert.equal(h2.expeditionId,null);reject(s,'commissionRecall',{id:x2.id},x2.endAt);});
test('challenge difficulty is fixed while growth improves success chance',()=>{const s=rich(),first=E.view(s,NOW).challenges.find(r=>r.id==='gold');s.heroes[0].level=100;const second=E.view(s,NOW).challenges.find(r=>r.id==='gold');assert.equal(first.opponentPower,second.opponentPower);assert.ok(second.chance>first.chance);for(let n=0;n<3;n++)act(s,'challenge',{kind:'gold'});reject(s,'challenge',{kind:'gold'});});
test('world boss kill gives unused-entry bonus once and no repeat rewards',()=>{const s=rich();s.heroes[0].level=200;s.ext.daily.worldBoss.hp=100;s.ext.daily.worldBoss.damage=0;const gems=s.resources.gems;act(s,'challenge',{kind:'worldBoss'});assert.equal(s.resources.gems-gems,40);reject(s,'challenge',{kind:'worldBoss'});act(s,'quest',{kind:'milestone',id:'worldBoss:3'});reject(s,'quest',{kind:'milestone',id:'worldBoss:3'});});
test('labyrinth offers require event completion and do not leak global buffs',()=>{const s=rich(),before=E.modifiers(s,s.heroes[0]);reject(s,'labyrinthBlessing',{id:'attack'});act(s,'challenge',{kind:'labyrinth',route:'event'});assert.equal(s.ext.weekly.labyrinth.pending,1);const id=E.view(s,NOW).labyrinth.choices[0].id;act(s,'labyrinthBlessing',{id});assert.equal(s.ext.weekly.labyrinth.pending,0);assert.deepEqual(E.modifiers(s,s.heroes[0]),before);reject(s,'labyrinthBlessing',{id});for(let i=0;i<3;i++)assert.deepEqual(s.ext.weekly.labyrinth.route.slice(i*4,i*4+4).slice().sort(),['battle','boss','chest','event'].sort());});
test('activity earned points remain after spending; weekly resets preserve permanent claims',()=>{const s=rich();s.ext.weekly.pointsEarned=80;s.resources.points=80;act(s,'shop',{id:'event:ticket'});assert.equal(s.ext.weekly.pointsEarned,80);act(s,'quest',{kind:'milestone',id:'event:1'});act(s,'shop',{id:'starter'});E.init(s,NOW+7*86400000);assert.equal(s.ext.weekly.pointsEarned,0);assert.equal(s.resources.points,0);assert.equal(s.ext.claimed.once['shop:starter'],1);});
test('abyss permanent milestones and depth rewards cannot be reclaimed',()=>{const s=rich();s.progress.abyssMax=1000;act(s,'quest',{kind:'milestone',id:'abyss:1000'});reject(s,'quest',{kind:'milestone',id:'abyss:1000'});const before=s.resources.badges;E.onEvent(s,'kill',{abyssFloor:50,boss:true});E.onEvent(s,'kill',{abyssFloor:50,boss:true});assert.equal(s.resources.badges-before,1);});
test('guild donation caps and full technology costs are enforced',()=>{const s=rich();s.ext.guild.level=1;for(let i=0;i<3;i++)act(s,'guildDonate');reject(s,'guildDonate');act(s,'guildDonate',{feast:true});reject(s,'guildDonate',{feast:true});const gold=s.resources.gold;act(s,'guildTech',{id:'attack'});assert.equal(gold-s.resources.gold,800);reject(s,'guildTech',{id:'attack',ancient:true});});
test('malformed extension state is rejected before import',()=>{const s=fresh();s.ext.artifacts.dragon={level:100,awakening:0};assert.equal(E.validate(s).ok,false);assert.equal(C.validate(s).ok,false);});

test('challenge result reports only rewards actually granted',()=>{
  function force(s,win){for(let seed=1;seed<100000;seed++){const candidate={rng:seed},value=C.rng(candidate);if(win?value<.01:value>.99){s.rng=seed;return;}}throw Error('No deterministic outcome seed found');}
  const s=rich();
  force(s,true);let before=s.resources.gems;const first=act(s,'challenge',{kind:'arena'});assert.equal(first.win,true);assert.equal(s.resources.gems-before,first.reward.gems);
  force(s,true);before=s.resources.gems;const repeat=act(s,'challenge',{kind:'arena'});assert.equal(repeat.win,true);assert.equal(s.resources.gems,before);assert.deepEqual(repeat.reward,{});assert.deepEqual(s.ext.lastChallenge.reward,{});
  for(const kind of ['arena','tower','labyrinth']){force(s,false);const prior=JSON.stringify({resources:s.resources,materials:s.materials}),result=act(s,'challenge',{kind,...(kind==='labyrinth'?{route:'battle'}:{})});assert.equal(result.win,false);assert.equal(JSON.stringify({resources:s.resources,materials:s.materials}),prior);assert.deepEqual(result.reward,{});assert.deepEqual(s.ext.lastChallenge.reward,{});}
});

test('import rejects malformed runtime structures and unowned artifact references',()=>{
  const mutations=[
    s=>delete s.ext.daily.offers,
    s=>s.ext.daily.offers[0]=8,
    s=>s.ext.daily.chest.gold=-1,
    s=>delete s.ext.weekly.labyrinth.blessings,
    s=>s.ext.weekly.labyrinth.route[3]='event',
    s=>{s.ext.weekly.labyrinth.pending=1;s.ext.weekly.labyrinth.offers=[];},
    s=>s.ext.weekly.arena.opponents[0]=null,
    s=>s.ext.weekly.tower.elements[2]=99,
    s=>s.ext.daily.worldBoss.damage=s.ext.daily.worldBoss.hp+1,
    s=>s.ext.daily.challengeCounts.arena=-1,
    s=>s.ext.monthly.days.push(s.ext.period.day),
    s=>s.ext.wanderers.push({id:'broken'}),
    s=>s.heroes[0].artifact='dragon'
  ];
  for(const mutate of mutations){const s=fresh();mutate(s);assert.equal(E.validate(s).ok,false,mutate.toString());assert.equal(C.validate(s).ok,false,mutate.toString());}
});

test('active visitor and commission saves survive strict validation and resumed settlement',()=>{
  const s=rich(),h=addHero(s,'mage',150);E.tick(s,45,NOW+45000);const visitor=s.ext.wanderers[0],commission=E.view(s,NOW+45000).commissions[0];
  act(s,'wanderer',{id:visitor.id,action:'expedition',hours:1,zone:1},NOW+45000);act(s,'commission',{id:commission.id,heroIds:[h.id]},NOW+45000);
  const restored=JSON.parse(JSON.stringify(s));assert.equal(C.validate(restored).ok,true);const before=restored.resources.gold;E.offline(restored,3600,NOW+3645000);assert.ok(restored.resources.gold>before);assert.equal(restored.ext.commissions.length,0);assert.equal(restored.ext.wanderers[0].expedition,null);assert.equal(C.validate(restored).ok,true);
  const corrupt=JSON.parse(JSON.stringify(s));corrupt.ext.commissions[0].reward.gold=-100;assert.equal(C.validate(corrupt).ok,false);
});
