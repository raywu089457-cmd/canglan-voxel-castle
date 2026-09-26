(function (g) {
  'use strict';
  const D = g.GameData || (typeof require === 'function' ? require('./game-data.js') : null);
  const W = g.WorldMap || (typeof require === 'function' ? require('./world-map.js') : null);
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n)), num=n=>Number.isFinite(n)?n:0;
  const clone=o=>JSON.parse(JSON.stringify(o));
  function restore(target,source){for(const key of Object.keys(target))if(!Object.hasOwn(source,key))delete target[key];if(Array.isArray(target))target.length=source.length;for(const[key,value]of Object.entries(source)){if(value&&typeof value==='object'&&target[key]&&typeof target[key]==='object'&&Array.isArray(value)===Array.isArray(target[key]))restore(target[key],value);else target[key]=value;}return target;}
  const ok=(message,more={})=>({ok:true,message,...more}), fail=message=>({ok:false,message});
  const ext=()=>g.GameExtensions;
  const hero=(s,id)=>s.heroes.find(h=>h.id===id), item=(s,id)=>s.inventory.find(i=>i.id===id);
  function event(s,type,data={}) { if(ext()?.onEvent) ext().onEvent(s,type,data); }
  function uid(s,prefix='id'){return prefix+'-'+(++s.sequence);}
  function rng(s){let x=s.rng>>>0;x^=x<<13;x^=x>>>17;x^=x<<5;s.rng=x>>>0;return s.rng/4294967296;}
  function pick(s,arr){return arr[Math.floor(rng(s)*arr.length)];}
  function weighted(s,weights){let r=rng(s)*weights.reduce((a,b)=>a+b,0);for(let i=0;i<weights.length;i++){r-=weights[i];if(r<0)return i;}return weights.length-1;}
  function log(s,text,type='info',data={}){s.events.push({id:uid(s,'event'),type,text,at:s.clock,...data});if(s.events.length>160)s.events.splice(0,s.events.length-160);}
  function dayKey(now){return new Date(now+28800000).toISOString().slice(0,10);}
  function weekKey(now){const d=new Date(now+28800000);d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);return d.toISOString().slice(0,10);}
  function modifiers(s,h){return ext()?.modifiers?.(s,h)||{};}
  const mult=(m,k)=>Number.isFinite(m[k])?m[k]:1;
  function capacity(s){const l=s.buildings.tavern;return {roster:Math.min(40,4+2*l),inventory:200+s.buildings.warehouse*10,slots:l>=10?5:l>=7?4:l>=4?3:2,teams:l>=8?5:l>=6?4:l>=4?3:l>=2?2:1};}
  function team(s,index=s.selectedTeam){return(s.teams[index]||[]).slice(0,capacity(s).slots).map(id=>hero(s,id)).filter(Boolean);}
  function occupied(s,h){return !!h&&(!!h.expeditionId||((s.hunting.active||s.hunting.restUntil>s.clock)&&team(s,s.hunting.team).some(t=>t.id===h.id)));}
  function effectiveLevel(s,h){return clamp(num(ext()?.effectiveLevel?.(s,h))||h.level,h.level,200);}
  function heroXP(l){return Math.floor(55*Math.pow(l,1.45));}
  function kingdomXP(l){return Math.floor(60*Math.pow(l,1.35));}
  function canAfford(s,cost={}){return Object.entries(cost).every(([k,v])=>k==='materials'?Object.entries(v).every(([m,n])=>Number.isFinite(n)&&n>=0&&num(s.materials[m])>=n):Number.isFinite(v)&&v>=0&&num(s.resources[k])>=v);}
  function spend(s,cost){if(!canAfford(s,cost))return false;for(const[k,v]of Object.entries(cost)){if(k==='materials'){for(const[m,n]of Object.entries(v))s.materials[m]-=n;}else s.resources[k]-=v;}return true;}
  function addReward(s,rewards,label){for(const[k,v]of Object.entries(rewards||{})){if(k==='materials'){for(const[m,n]of Object.entries(v)){if(m in s.materials&&Number.isFinite(n)&&n>0){s.materials[m]+=n;s.stats.materials+=n;s.collections.materials[m]=true;}}}else if(k in s.resources&&Number.isFinite(v)&&v>0){s.resources[k]+=v;if(k==='gold')s.stats.goldEarned+=v;}}if(label)log(s,label,'reward');event(s,'reward',{rewards});}
  function makeHero(s,classId,stars,level=1,legend=null){if(!D.classes[classId])throw Error('未知職業');const h={id:uid(s,'hero'),name:legend?(D.legends.find(l=>l.id===legend)?.name||D.classes[classId].name):D.classes[classId].name+'・'+String(s.sequence).padStart(2,'0'),classId,stars:clamp(stars,1,6),level:clamp(level,1,200),xp:0,hp:1,mp:1,breakthrough:0,skills:[1,1,1],mainSkill:0,subSkill:1,equipment:{},artifact:null,locked:false,legend,investment:{gold:0,materials:{},books:0},cooldowns:[0,0,0],attackTimer:0,status:{}};const st=heroStats(s,h);h.hp=st.maxHp;h.mp=st.maxMp;return h;}
  function create(seed=0x81f7a42d){let x=typeof seed==='number'?seed>>>0:2166136261;if(typeof seed==='string')for(const c of seed)x=Math.imul(x^c.charCodeAt(0),16777619)>>>0;if(!x)x=0x81f7a42d;const now=Date.now();const s={version:1,rng:x,gameplaySeed:x,worldSeed:'94721',generationVersion:2,sequence:0,createdAt:now,lastSeen:now,clock:now,resources:{gold:300,gems:120,tickets:1,honor:0,books:0,fragments:0,badges:0,kingCoins:0,swapStones:0,points:0},materials:Object.fromEntries(Object.keys(D.materials).map(k=>[k,0])),kingdom:{level:1,xp:0,milestones:[]},buildings:{castle:1,tavern:1,warehouse:1,training:0,forge:0,potion:0,gem:0,market:0,library:0,altar:0},heroes:[],teams:Array.from({length:5},()=>Array(5).fill(null)),selectedTeam:0,inventory:[],gems:[],hunting:{active:false,team:0,zone:1,stage:1,difficulty:0,speed:1,autoNext:true,autoContinue:true,restUntil:0,enemy:null,mode:'main',abyssFloor:1,report:{},elapsed:0,losses:0,manualAutoNext:false,farmTarget:null,focusSeconds:0,accumulator:0},progress:{zone:1,stage:1,maxZone:1,maxStage:1,totalStages:0,firstClears:[],dailyBoss:{},completed:[],abyssMax:0},stats:{kills:0,goldEarned:0,recruits:0,upgrades:0,enhances:0,bossKills:0,dailyBossKills:0,breakthroughs:0,stars:0,materials:0,gems:0,stages:0,heroLevels:0,maxHeroLevel:1,maxItemStars:0},events:[],recruitment:{normal:0,advancedPity:0,mythicPity:0,wishlist:[]},consumables:{hp:0,mp:0,attack:0,xp:0,hourglass:0,goldBag:0},buffs:{attack:0,gold:0,xp:0,hourglass:0},autoPotion:{enabled:false,hp:.3,mp:.2,nextAt:0},ascensions:0,traditions:{hunting:0,forging:0,commerce:0,academic:0,pioneer:0},traditionChoices:0,collections:{monsters:{},classes:{},legends:[],items:[],materials:{}},settings:{autoDismantle:0},synthesis:{week:'',four:0,five:0},ext:{}};
    s.consumables.gold=0;
    const h=makeHero(s,pick(s,D.classList).id,2);s.heroes.push(h);s.teams[0][0]=h.id;s.collections.classes[h.classId]=1;if(ext()?.init)ext().init(s,now);log(s,'歡迎來到蒼嵐堡。招募夥伴，從城門出發。');return s;
  }
  function equippedBy(s,it){return s.heroes.find(h=>Object.values(h.equipment).includes(it.id));}
  function gemStats(gem){if(!gem)return {};const t=gem.tier;return gem.type==='red'?{attack:Math.round(10.4*t)}:gem.type==='blue'?{defense:Math.round(9.1*t)}:gem.type==='green'?{maxHp:Math.round(58.5*t)}:{crit:Math.round(1+.9*t)/100};}
  function itemStats(it){const t=it.tier,round=Math.round;let st={attack:0,defense:0,maxHp:0,crit:0};switch(it.slot){case'weapon':st.attack=round(6*t**1.45);break;case'helmet':st.defense=round(4*t**1.4);st.maxHp=round(14*t**1.3);break;case'armor':st.defense=round(5*t**1.4);st.maxHp=round(22*t**1.3);break;case'boots':st.defense=round(3*t**1.4);st.maxHp=round(18*t**1.3);break;case'necklace':st.attack=round(3*t**1.4);st.defense=round(2*t**1.35);st.maxHp=round(16*t**1.3);break;case'ring':st.attack=round(3*t**1.35);st.crit=round(.8+.7*t)/100;break;case'charm':st.attack=round(2*t**1.35);st.defense=round(2*t**1.35);st.maxHp=round(12*t**1.3);st.crit=round(.6+.5*t)/100;break;}
    for(const k of Object.keys(st))st[k]*=D.equipmentMultipliers[it.stars-1]*(1+.05*it.enhance);for(const gm of it.gems||[])for(const[k,v]of Object.entries(gemStats(gm)))st[k]=(st[k]||0)+v;return st;}
  function setEffects(s,h){const counts={},total={},effects={};const ti=s.teams.findIndex(t=>t.includes(h.id)),all=ti<0?[h]:team(s,ti);for(const other of all)for(const id of Object.values(other.equipment)){const it=item(s,id);if(it?.set){total[it.set]=(total[it.set]||0)+1;if(other.id===h.id)counts[it.set]=(counts[it.set]||0)+1;}}for(const def of Object.values(D.sets)){for(const e of def.personal)if((counts[def.id]||0)>=e.count)for(const[k,v]of Object.entries(e.effects))effects[k]=(effects[k]||0)+v;for(const e of def.team)if((total[def.id]||0)>=e.count)for(const[k,v]of Object.entries(e.effects))effects[k]=(effects[k]||0)+v;}return effects;}
  function heroStats(s,h){const cls=D.classes[h.classId],level=effectiveLevel(s,h),scale=D.starMultipliers[h.stars-1]*1.2**h.breakthrough;const st={};for(const k of ['attack','defense','maxHp','maxMp'])st[k]=(cls.base[k]+cls.growth[k]*(level-1))*scale;st.speed=cls.base.speed;st.crit=Math.min(.8,cls.base.crit+cls.growth.crit*(level-1));for(const k of ['lifesteal','bossDamage','critDamage','reflect','reduction','xp','gold','treasure','killHeal'])st[k]=0;
    for(const id of Object.values(h.equipment)){const it=item(s,id);if(!it)continue;for(const[k,v]of Object.entries(itemStats(it)))st[k]+=v;if(it.affix){const a=D.affixes[it.affix.id||it.affix];if(a)st[a.id]+=Math.min(a.max,a.base+a.growth*(it.tier-1));}}
    const sets=setEffects(s,h);for(const[k,v]of Object.entries(sets)){const target=k==='hp'?'maxHp':k;if(['attack','defense','maxHp','speed'].includes(target))st[target]*=1+v;else st[target]=(st[target]||0)+v;}
    const m=modifiers(s,h);st.attack*=mult(m,'attack')*(1+.01*(s.kingdom.level-1))*(1+.85*(1-.6**s.ascensions));st.defense*=mult(m,'defense');st.maxHp*=mult(m,'hp');st.speed*=mult(m,'speed');st.crit+=num(m.crit);st.skill=mult(m,'skill')*(1+.03*s.traditions.academic);for(const k of ['lifesteal','reduction','bossDamage','critDamage','reflect','killHeal'])st[k]+=num(m[k]);const artifact=ext()?.artifactCombat?.(s,h)||{};st.lifesteal+=num(artifact.lifesteal);st.openingReduction=num(artifact.openingReduction);st.openingSeconds=num(artifact.openingSeconds)||5;if(s.buffs.attack>s.clock)st.attack*=1.3+.05*s.buildings.potion;st.crit=clamp(st.crit,0,1);st.reduction=clamp(st.reduction,0,.9);st.lifesteal=clamp(st.lifesteal,0,.9);st.maxHp=Math.round(st.maxHp);st.maxMp=Math.round(st.maxMp);st.power=Math.floor(st.attack*3+st.defense*2+st.maxHp/10+st.crit*100);return st;}
  function teamPower(s,index=s.selectedTeam){return team(s,index).reduce((n,h)=>n+heroStats(s,h).power,0);}
  function clampHealth(s,h){const st=heroStats(s,h);h.hp=clamp(h.hp,0,st.maxHp);h.mp=clamp(h.mp,0,st.maxMp);}
  function grantKingdomXP(s,amount){if(!Number.isFinite(amount)||amount<=0||s.kingdom.level>=50)return;const m=modifiers(s);s.kingdom.xp+=Math.floor(amount*(1+.1*s.traditions.pioneer)*mult(m,'kingdomXp'));while(s.kingdom.level<50&&s.kingdom.xp>=kingdomXP(s.kingdom.level)){s.kingdom.xp-=kingdomXP(s.kingdom.level);s.kingdom.level++;const l=s.kingdom.level;addReward(s,{gold:Math.floor(200*l**1.4),gems:l%5===0?10:0},'王國升至 Lv'+l);const rewards={20:{gems:150,books:20},25:{gems:200,tickets:2},30:{gems:300,books:30,materials:{void:30}},35:{gems:400,tickets:3,materials:{myth:20}},40:{gems:500,books:50}};if(rewards[l]&&!s.kingdom.milestones.includes(l)){s.kingdom.milestones.push(l);addReward(s,rewards[l],'王國里程碑 Lv'+l);}event(s,'kingdomLevel',{level:l});}if(s.kingdom.level>=50)s.kingdom.xp=0;}
  function grantHeroXP(s,h,amount){if(!Number.isFinite(amount)||amount<=0||h.level>=200)return;h.xp+=amount;while(h.level<200&&h.xp>=heroXP(h.level)){h.xp-=heroXP(h.level);h.level++;const st=heroStats(s,h);h.hp=st.maxHp;h.mp=st.maxMp;s.stats.heroLevels++;s.stats.maxHeroLevel=Math.max(s.stats.maxHeroLevel,h.level);grantKingdomXP(s,10+h.level);event(s,'heroLevel',{hero:h});log(s,h.name+' 升至 Lv'+h.level,'level',{heroId:h.id});}if(h.level>=200)h.xp=0;}
  function recruitCost(s,kind){return kind==='normal'?{gold:Math.floor(Math.floor(150*2.1**Math.min(s.recruitment.normal,10))*(1-.02*s.buildings.tavern))}:kind==='advanced'?{tickets:1}:kind==='mythic'?{gems:300}:null;}
  function trainingCost(h){return {gold:Math.floor(60*h.level**1.85)};}
  function enhanceCost(s,it){let base=Math.floor(40*it.tier**1.6*1.5**it.enhance);if(it.enhance>=13)base*=3**(it.enhance-12);return {gold:Math.floor(base*Math.max(.1,1-.04*s.buildings.forge)*(1-.04*s.traditions.forging))};}
  function makeItem(s,tier,options={}){tier=clamp(Math.floor(tier),1,10);const weights=[[68,24,7,1,0,0],[48,32,15,4,1,0],[30,34,22,10,3.4,.6],[16,28,26,18,9,3],[8,18,24,26,16,8]][Math.floor((tier-1)/2)];const stars=clamp(Math.max(options.minStars||1,options.stars||weighted(s,weights)+1),1,6);const slot=options.slot||pick(s,D.slots).id;const classId=slot==='weapon'?(options.classId||pick(s,D.classList).id):null;const holes=stars>=5?2:stars>=3?(rng(s)<.35?1:0)+(rng(s)<.1?1:0):(rng(s)<.08?1:0);const available=Object.values(D.sets).filter(v=>v.tier<=tier);const chance=tier<=2?0:tier===3?.1:tier===4?.16:tier<=7?.22:.3;const set=options.set||(available.length&&rng(s)<chance?pick(s,available).id:null);const affix=stars>=3&&rng(s)<[.2,.4,.6,.8][stars-3]?{id:pick(s,Object.keys(D.affixes))}:null;return {id:uid(s,'item'),name:options.name||((set?D.sets[set].name:'第'+tier+'階')+(classId?D.classes[classId].name:'')+D.slots.find(v=>v.id===slot).name),slot,classId,tier,stars,enhance:0,locked:false,holes,gems:Array(holes).fill(null),set,affix};}
  function makeGem(s,tier,type){const gm={id:uid(s,'gem'),tier:clamp(Math.floor(tier),1,10),type:type||pick(s,Object.keys(D.gemTypes))};s.gems.push(gm);s.stats.gems++;event(s,'gem',{gem:gm});return gm;}
  function dismantleReward(it){const t=it.tier,u=1+.25*(it.stars-1)+.1*it.enhance,m={iron:Math.max(1,Math.round(2.5*t*u))};const rows=[['herb',2,1.2*t],['leather',3,t-1],['crystal',4,2*(t-2)],['ember',5,t-4],['frost',6,t-5],['poison',7,t-6],['void',8,2*(t-7)],['myth',9,3*(t-8)]];for(const[k,l,v]of rows)if(t>=l)m[k]=Math.max(1,Math.round(v*u));return {gold:Math.floor(20*t*it.stars*(1+it.enhance/5)),materials:m};}
  function receiveItem(s,it){s.stats.maxItemStars=Math.max(s.stats.maxItemStars,it.stars);const key=it.slot+':'+it.tier+':'+it.stars;if(!s.collections.items.includes(key))s.collections.items.push(key);event(s,'item',{item:it});if(it.stars<=s.settings.autoDismantle&&!it.locked&&!it.gems.some(Boolean)){addReward(s,dismantleReward(it),'自動分解：'+it.name);return true;}if(s.inventory.length>=capacity(s).inventory){log(s,'背包已滿，未收入 1 件：'+it.name,'warning');s.stats.lostItems=(s.stats.lostItems||0)+1;return false;}s.inventory.push(it);log(s,'取得 '+it.stars+'★ '+it.name,'loot');return true;}
  function enemyPreview(s,zone,stage,difficulty=0){const z=D.zones[zone-1];if(!z||stage<1||stage>10)return null;const boss=stage===10,base=boss?z.boss:z.monsters[(stage-1)%5],sc=1+.16*(stage-1),bm=boss?(zone<=2?2.4:zone<=4?3:4):1,dm=D.difficulties[difficulty]?.multiplier||1;return {...base,hp:Math.round(base.hp*sc*bm*dm),maxHp:Math.round(base.hp*sc*bm*dm),attack:base.attack*sc*bm*dm,defense:base.defense*sc,gold:base.gold*sc*bm*dm,xp:base.xp*sc*bm*dm,element:z.element,boss,elite:false,mechanic:boss?z.mechanic:'none',elapsed:0,attackTimer:0,freeze:0,dots:[],mechanicTimer:0};}
  function abyssEnemy(floor){const boss=floor%10===0,hp=(6000+2500*floor)*(boss?3:1);return {id:'abyss-'+(boss?'boss':'monster'),name:(boss?'深淵守門者':'裂隙行者')+'・'+floor+' 層',hp,maxHp:hp,attack:(80+32*floor)*(boss?1.8:1),defense:(12+7*floor)*(boss?1.8:1),gold:(300+120*floor)*(boss?2:1),xp:(350+110*floor)*(boss?2:1),element:'dark',boss,elite:false,mechanic:'none',material:floor%2?'void':'myth',drop:.4,elapsed:0,attackTimer:0,freeze:0,dots:[],mechanicTimer:0};}
  function spawnEnemy(s){const h=s.hunting;let e=h.mode==='abyss'?abyssEnemy(h.abyssFloor):enemyPreview(s,h.zone,h.stage,h.difficulty);if(!e)return;if(!e.boss&&h.mode==='main'&&rng(s)<.22){e.elite=true;e.name='精英 '+e.name;e.hp=Math.round(e.hp*2.6);e.maxHp=e.hp;e.attack*=1.7;e.defense*=1.6;e.gold*=6;e.xp*=5;}h.enemy=e;h.elapsed=0;fieldResetFoe(s);for(const member of team(s,h.team)){member.cooldowns=[0,0,0];member.attackTimer=0;member.status={};}log(s,'遭遇 '+e.name,'encounter',{enemyId:e.id});}
  function rewardMultipliers(s,now=s.clock,offline=false){const m=modifiers(s),base=(1+.01*(s.kingdom.level-1))*(1+.05*s.traditions.hunting),a=.85*(1-.6**s.ascensions),weekend=[0,6].includes(new Date(now+28800000).getUTCDay())?1.5:1;const focus=offline?1.2:1.2+Math.min(4,Math.floor(s.hunting.focusSeconds/3600))*.05;const activeTeam=team(s,s.hunting.team);const avg=key=>activeTeam.length?activeTeam.reduce((n,h)=>n+heroStats(s,h)[key],0)/activeTeam.length:0;return {gold:base*(1+.08*s.buildings.castle)*(1+a)*mult(m,'gold')*(1+avg('gold'))*weekend*focus*(now<s.createdAt+600000?1.5:1)*(s.buffs.gold>now?1.5+.05*s.buildings.potion:1),xp:base*(1+.1*s.buildings.training)*(1+a/5)*mult(m,'xp')*(1+avg('xp'))*weekend*focus*(s.buffs.xp>now?1.5+.05*s.buildings.potion:1)};}
  const counters={fire:'nature',nature:'thunder',thunder:'ice',ice:'fire',holy:'dark',dark:'holy'};
  function elementMultiplier(a,b){return counters[a]===b?1.25:1;}
  function report(s,h){return s.hunting.report[h.id]||(s.hunting.report[h.id]={damage:0,healing:0});}
  function heal(s,h,amount,source=null,revive=false){if(h.hp<=0&&!revive)return 0;const actual=Math.max(0,Math.min(amount,heroStats(s,h).maxHp-h.hp));h.hp+=actual;if(source)report(s,source).healing+=actual;if(actual>.01)log(s,h.name+' +'+Math.round(actual),'heal',{heroId:h.id,amount:actual});return actual;}
  function damageEnemy(s,h,raw,st,kind='attack',isCrit=false){const e=s.hunting.enemy;if(!e||e.hp<=0)return 0;let damage=raw*100/(100+e.defense)*elementMultiplier(D.classes[h.classId].element,e.element)*(e.boss?1+st.bossDamage:1);if(e.mechanic==='shield'&&e.elapsed<8*[1,1.15,1.35,1.55][s.hunting.difficulty])damage*=.5;if(isCrit)damage*=2+st.critDamage;const actual=Math.min(e.hp,Math.max(1,damage));e.hp-=actual;report(s,h).damage+=actual;log(s,h.name+' '+Math.round(actual)+(isCrit?' 暴擊':''),kind,{heroId:h.id,enemyId:e.id,amount:actual});if(st.lifesteal)heal(s,h,actual*st.lifesteal,h);return actual;}
  function damageHero(s,h,raw,st,direct=false){if(h.hp<=0)return 0;let damage=raw;if(direct){damage*=1-Math.min(.7,st.defense/(st.defense+120));const slot=s.teams[s.hunting.team].indexOf(h.id);if(slot>=2)damage*=.75;damage*=1-st.reduction;if((h.status.guard||0)>0)damage*=.5;if(s.hunting.elapsed<st.openingSeconds)damage*=1-st.openingReduction;}const actual=Math.min(h.hp,Math.max(1,damage));h.hp-=actual;log(s,h.name+' −'+Math.round(actual),'hurt',{heroId:h.id,amount:actual});if(direct&&st.reflect&&s.hunting.enemy){const reflected=Math.min(s.hunting.enemy.hp,actual*st.reflect);s.hunting.enemy.hp-=reflected;report(s,h).damage+=reflected;}return actual;}
  function applySkill(s,h,index,st,sub){const skill=D.classes[h.classId].skills[index];if(h.level<skill.unlock||h.cooldowns[index]>0||h.mp<skill.mp)return false;h.mp-=skill.mp;h.cooldowns[index]=skill.cooldown;const power=(1+.12*(h.skills[index]-1))*st.skill;const e=s.hunting.enemy;for(let hit=0;hit<skill.hits&&e.hp>0;hit++)damageEnemy(s,h,st.attack*skill.mult*power*(skill.hits>1?.85+rng(s)*.3:.9+rng(s)*.2),st,'skill',!!skill.guaranteedCrit);if(skill.freeze)e.freeze=Math.max(e.freeze,skill.freeze*(sub?.5:1));if(skill.dot){const key=h.id+':'+index,old=e.dots.find(d=>d.key===key),dot={key,heroId:h.id,remaining:skill.dot,timer:0,attack:st.attack*.5};if(old)Object.assign(old,dot);else e.dots.push(dot);}if(skill.guard)h.status.guard=skill.guard;if(skill.taunt)h.status.taunt=skill.taunt;if(skill.selfHeal)heal(s,h,st.maxHp*skill.selfHeal*power,h);if(skill.heal)for(const ally of team(s,s.hunting.team))heal(s,ally,heroStats(s,ally).maxHp*skill.heal*power,h);log(s,h.name+'：'+skill.name,'cast',{heroId:h.id,enemyId:e.id});return true;}
  function advanceProgress(s){const hu=s.hunting,z=hu.zone,st=hu.stage,key=z+'-'+st;if(!s.progress.completed.includes(key)){s.progress.completed.push(key);s.progress.totalStages++;s.stats.stages++;event(s,'stage',{zone:z,stage:st});}let nz=z,ns=st;if(st===10&&z<10){nz=z+1;ns=1;}else if(st<10)ns++;if(nz>s.progress.zone||nz===s.progress.zone&&ns>s.progress.stage){s.progress.zone=nz;s.progress.stage=ns;grantKingdomXP(s,ns>=2&&ns<=6?8:ns>=7?5:0);}if(nz>s.progress.maxZone||nz===s.progress.maxZone&&ns>s.progress.maxStage){s.progress.maxZone=nz;s.progress.maxStage=ns;}if(hu.autoNext){hu.zone=nz;hu.stage=ns;}if(z===10&&st===10)hu.autoNext=false;}
  function kill(s){const h=s.hunting,e=h.enemy;if(!e)return;const targets=team(s,h.team),mods=rewardMultipliers(s,s.clock),gold=Math.floor(e.gold*mods.gold),xp=Math.floor(e.xp*mods.xp);addReward(s,{gold});for(const member of targets)grantHeroXP(s,member,xp/Math.max(1,targets.length));s.stats.kills++;s.stats.bossKills+=e.boss?1:0;const abyss=h.mode==='abyss';if(!abyss)s.collections.monsters[e.id]=(s.collections.monsters[e.id]||0)+1;let dailyFirst=false;const zone=h.zone,stage=h.stage,floor=h.abyssFloor;
    if(e.boss&&!abyss){const day=dayKey(s.clock);s.progress.dailyBoss[day]||={};dailyFirst=!s.progress.dailyBoss[day][zone];if(dailyFirst){s.progress.dailyBoss[day][zone]=true;s.stats.dailyBossKills++;addReward(s,{gems:5,honor:3+Math.floor(2*(1+.05*s.buildings.altar))},'每日首領首殺');}if(!s.progress.firstClears.includes(zone)){s.progress.firstClears.push(zone);addReward(s,{gems:20},'第 '+zone+' 區永久首通');}grantKingdomXP(s,50);}
    const diff=abyss?1:D.difficulties[h.difficulty].multiplier,elite=e.elite?3:1,tier=abyss?10:zone,chance=p=>rng(s)<Math.min(.95,p*diff),treasure=targets.length?targets.reduce((n,t)=>n+heroStats(s,t).treasure,0)/targets.length:0;
    if(e.boss||chance(e.elite?.3:.075))receiveItem(s,makeItem(s,tier,{minStars:e.boss?3:1}));if(e.boss)makeGem(s,Math.ceil(tier/2));if(chance(.035*elite*(1+.06*s.buildings.gem)))makeGem(s,Math.ceil(tier/2));if(chance(.015*elite*(1+.05*s.buildings.library)))addReward(s,{books:1});if(e.boss&&chance(.35))addReward(s,{tickets:1});if(e.boss&&chance(.2))addReward(s,{books:1});if(e.material&&chance(e.drop*(1+treasure)))addReward(s,{materials:{[e.material]:1}});const pool=materialPool(zone,abyss);if(chance(.12*(1+treasure)))addReward(s,{materials:{[pick(s,pool)]:1}});
    grantKingdomXP(s,Math.max(1,Math.floor(kingdomXP(s.kingdom.level)*.003))+(e.boss?Math.floor(kingdomXP(s.kingdom.level)*.02):0));for(const member of targets)if(member.hp>0){const st=heroStats(s,member);heal(s,member,st.maxHp*(.25+(member.classId==='priest'?.1:0)+st.killHeal),member);}h.losses=0;event(s,'kill',{zone,boss:e.boss,enemyId:e.id,abyssFloor:abyss?floor:0,dailyFirst});log(s,'擊敗 '+e.name+' · +'+gold+' 金 / '+xp+' 經驗','kill',{enemyId:e.id});if(abyss){s.progress.abyssMax=Math.max(s.progress.abyssMax,floor);if(h.autoNext)h.abyssFloor++;}else advanceProgress(s);h.enemy=null;
  }
  function materialPool(zone,abyss=false){if(abyss)return ['iron','herb','leather','crystal','ember','frost','poison','void','myth'];const pool=new Set(['iron','herb']);for(const z of D.zones.slice(0,zone))for(const e of z.monsters)if(e.material)pool.add(e.material);return [...pool];}
  function defeat(s){const h=s.hunting;h.active=false;h.restUntil=s.clock+20000;h.losses++;h.focusSeconds=0;fieldReturn(s,true);if(!h.enemy?.boss)h.enemy=null;log(s,'隊伍敗退，休整 20 秒。','defeat');if(h.losses>=3&&h.mode==='main'){h.farmTarget||={zone:h.zone,stage:h.stage,difficulty:h.difficulty};h.autoNext=false;const oldZone=h.zone;h.zone=Math.max(1,h.zone-1);h.stage=oldZone>1?9:Math.max(1,h.stage-1);h.enemy=null;log(s,'暫退 '+h.zone+'-'+h.stage+' 補給；成長後再挑戰卡關點。','warning');}}
  function battleStep(s,dt){const h=s.hunting;if(!h.active||h.mode==='main'&&!h.field)return;if(!h.enemy)spawnEnemy(s);const e=h.enemy;if(!e)return;h.elapsed+=dt;e.elapsed+=dt;const party=team(s,h.team),stats=new Map(party.map(p=>[p.id,heroStats(s,p)])),contact=fieldContact(s);for(const p of party){const st=stats.get(p.id);if(p.hp<=0)continue;p.mp=Math.min(st.maxMp,p.mp+st.maxMp*.02*dt);p.cooldowns=p.cooldowns.map(cd=>Math.max(0,cd-dt));p.status.guard=Math.max(0,(p.status.guard||0)-dt);p.status.taunt=Math.max(0,(p.status.taunt||0)-dt);if(contact&&contact.get(p.id)>FIELD.heroRange)continue;applySkill(s,p,p.mainSkill,st,false);if(e.hp>0)applySkill(s,p,p.subSkill,st,true);p.attackTimer+=dt;while(p.attackTimer>=1/st.speed&&e.hp>0){p.attackTimer-=1/st.speed;damageEnemy(s,p,st.attack*(.9+rng(s)*.2),st,'attack',rng(s)<st.crit);}if(e.hp<=0){kill(s);return;}}
    for(const d of e.dots){d.remaining-=dt;d.timer+=dt;const source=hero(s,d.heroId);while(d.timer>=1&&source&&e.hp>0){d.timer-=1;damageEnemy(s,source,d.attack,stats.get(source.id)||heroStats(s,source),'dot');}}e.dots=e.dots.filter(d=>d.remaining>0);if(e.hp<=0){kill(s);return;}
    const living=()=>party.filter(p=>p.hp>0),strength=[1,1.15,1.35,1.55][h.mode==='abyss'?0:h.difficulty],reachable=!contact||[...contact.values()].some(d=>d<=FIELD.foeRange);e.mechanicTimer+=dt;if(e.mechanic==='regen'&&e.hp<e.maxHp*.5)e.hp=Math.min(e.maxHp,e.hp+e.maxHp*.008*strength*dt);if(reachable&&e.mechanic==='poison'&&e.mechanicTimer>=4){e.mechanicTimer-=4;const p=pick(s,living());if(p)damageHero(s,p,stats.get(p.id).maxHp*.03*strength,stats.get(p.id));}if(reachable&&e.mechanic==='shock'&&e.mechanicTimer>=8){e.mechanicTimer-=8;for(const p of living())damageHero(s,p,e.attack*.6*strength,stats.get(p.id));}
    if(e.freeze>0)e.freeze=Math.max(0,e.freeze-dt);else if(reachable){e.attackTimer+=dt;const interval=1/(e.boss?.95:.7);while(e.attackTimer>=interval&&living().length){e.attackTimer-=interval;const live=living(),taunt=live.filter(p=>p.status.taunt>0),front=live.filter(p=>s.teams[h.team].indexOf(p.id)<2),candidates=taunt.length?taunt:front.length?front:live,knights=front.filter(p=>p.classId==='knight');const target=!taunt.length&&knights.length&&rng(s)<.5?pick(s,knights):pick(s,candidates);const actual=damageHero(s,target,e.attack*(.9+rng(s)*.2),stats.get(target.id),true);if(e.mechanic==='lifesteal')e.hp=Math.min(e.maxHp,e.hp+actual*Math.min(.9,.6*strength));if(e.hp<=0){kill(s);return;}}}if(!living().length)defeat(s);
  }
  /* ---------------------------------------------------------------- field
     Party and monster positions live in the game state and advance on the very same
     clock as the combat maths, so what is drawn and what is counted can never drift
     apart. Walking, pathfinding, aggro and engagement all live in here. */
  const FIELD={walk:26,aggro:16,leash:34,heroRange:5.6,foeRange:3.4,repath:.5,home:.6};
  /* Only the arena matters: advancing a stage inside the same zone must not send the
     party back to the castle. */
  const fieldKey=s=>s.hunting.zone+':'+s.hunting.mode;
  function fieldWalker(s,zone){
    const index=(zone??s.hunting.zone)-1,layout=D.zones[index]?.field;
    if(!layout||s.hunting.mode==='abyss')return null;
    return {index,layout,
      toWorld:(x,z)=>D.ring.toWorld(index,x,z),
      /* Blocked by exactly the props the renderer draws, so the picture and the
         navigation can never disagree. */
      walkable:(wx,wz)=>{const l=D.ring.toLocal(index,wx,wz);return layout.walkable(l[0],l[1]);}};
  }
  /* 8-way A* across one arena, in world coordinates. Returns the waypoints after
     the start, or [] when the walker is already standing on the goal. */
  function findPath(walker,from,to,step=1){
    const cell=v=>Math.round(v/step),sx=cell(from[0]),sz=cell(from[1]),tx=cell(to[0]),tz=cell(to[1]);
    if(!walker.walkable(tx*step,tz*step))return [];
    if(sx===tx&&sz===tz)return [];
    const key=(x,z)=>x+','+z,heuristic=(x,z)=>Math.hypot(tx-x,tz-z);
    const blocked=(x,z)=>(x!==tx||z!==tz)&&!walker.walkable(x*step,z*step);
    const open=new Map(),cost=new Map();
    open.set(key(sx,sz),{x:sx,z:sz,g:0,f:heuristic(sx,sz),p:null});cost.set(key(sx,sz),0);
    const moves=[[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,1.42],[1,-1,1.42],[-1,1,1.42],[-1,-1,1.42]];
    let guard=0;
    while(open.size&&guard++<6000){
      let best=null;for(const n of open.values())if(!best||n.f<best.f)best=n;
      open.delete(key(best.x,best.z));
      if(best.x===tx&&best.z===tz){const path=[];for(let n=best;n;n=n.p)path.push([n.x*step,n.z*step]);return path.reverse().slice(1);}
      for(const[dx,dz,weight]of moves){
        const nx=best.x+dx,nz=best.z+dz;if(blocked(nx,nz))continue;
        const g=best.g+weight;if(g>=(cost.get(key(nx,nz))??Infinity))continue;
        cost.set(key(nx,nz),g);open.set(key(nx,nz),{x:nx,z:nz,g,f:g+heuristic(nx,nz),p:best});
      }
    }
    return [];
  }
  function walkAlong(entity,step,walker){
    let move=step,replanned=false;
    while(move>1e-6&&entity.pi<entity.path.length){
      const t=entity.path[entity.pi],dx=t[0]-entity.x,dz=t[1]-entity.z,d=Math.hypot(dx,dz);
      if(d<1e-6){entity.pi++;continue;}
      const distance=Math.min(move,d,.7),next=[entity.x+dx/d*distance,entity.z+dz/d*distance];
      if(!W.validStep([entity.x,entity.z],next)||walker&&walker.walkable(entity.x,entity.z)&&!walker.walkable(next[0],next[1])){
        const inside=walker&&walker.walkable(entity.x,entity.z)&&walker.walkable(t[0],t[1]);
        const route=inside?findPath(walker,[entity.x,entity.z],t):W.findPath([entity.x,entity.z],t);
        if(route.length&&!replanned){entity.path.splice(entity.pi,1,...route);replanned=true;continue;}
        entity.path=[];entity.pi=0;return false;
      }
      entity.x=next[0];entity.z=next[1];move-=distance;
      if(distance>=d-1e-6)entity.pi++;
    }
    return entity.pi>=entity.path.length;
  }
  const walkDone=e=>e.pi>=e.path.length;
  /* prev = {index, at:Map(id -> [x,z])} when the party is already in the field. */
  function buildField(s,prev){
    const h=s.hunting,walker=fieldWalker(s);
    if(!walker){h.field=null;return;}
    const layout=walker.layout,members=team(s,h.team),ring=D.ring;
    const gate=walker.toWorld(layout.gate[0],layout.gate[1]);
    const approach=ring.approach(walker.index);
    const party=members.map((p,k)=>{
      const slot=k%layout.slots.length,at=prev?.at.get(p.id);
      const path=[];
      if(at){
        if(prev.index!==walker.index){
          const oldWalker=fieldWalker(s,prev.index+1);
          if(oldWalker)path.push(...findPath(oldWalker,at,oldWalker.toWorld(oldWalker.layout.gate[0],oldWalker.layout.gate[1])));
          path.push(...ring.arc(prev.index,walker.index));
        }else{
          path.push(...findPath(walker,at,gate));
        }
      }else{
        path.push(...approach);
      }
      path.push(gate);
      const assembly=walker.toWorld(...layout.assembly[slot]),position=walker.toWorld(...layout.slots[slot]);
      path.push(...findPath(walker,gate,assembly),...findPath(walker,assembly,position));
      const start=at||approach[0];
      return {id:p.id,x:start[0],z:start[1],pi:0,path,slot};
    });
    const home=walker.toWorld(layout.foe[0],layout.foe[1]);
    h.field={key:fieldKey(s),phase:'out',party,foe:{x:home[0],z:home[1],homeX:home[0],homeZ:home[1],aggro:false,path:[],pi:0,target:null,repath:0}};
  }
  /* Walk the party back out, still on the game clock. A defeat only pushes them to the
     zone gate so the next attempt is cheap; a recall walks them the whole way home. */
  function fieldReturn(s,toGate){
    const h=s.hunting,f=h.field;if(!f)return;
    const walker=fieldWalker(s);if(!walker)return;
    const gate=walker.toWorld(walker.layout.gate[0],walker.layout.gate[1]);
    for(const m of f.party){
      const inside=walker.walkable(m.x,m.z);
      const out=inside?findPath(walker,[m.x,m.z],gate):W.findPath([m.x,m.z],gate);
      m.path=toGate?out:out.concat(W.findPath(gate,W.castle.spawn));
      m.pi=0;
    }
    f.phase='back';f.retreat=toGate?'gate':'home';f.foe.aggro=false;f.foe.path=[];f.foe.pi=0;
  }
  function fieldStep(s,dt){
    const h=s.hunting,f=h.field;if(!f)return;
    const walker=fieldWalker(s);if(!walker)return;
    const living=team(s,h.team).filter(p=>p.hp>0),ids=new Set(living.map(p=>p.id));
    const step=FIELD.walk*dt;
    for(const m of f.party){
      if(!ids.has(m.id))continue;
      m.retry=Math.max(0,(m.retry||0)-dt);
      // Stop as soon as the monster is within reach and fight from there, instead of
      // marching on into its model to reach a scripted slot.
      if(h.active&&Math.hypot(m.x-f.foe.x,m.z-f.foe.z)<=FIELD.heroRange*.85){m.pi=m.path.length;continue;}
      const attempted=h.active&&walkDone(m)&&!m.retry;
      if(attempted){
        const goal=walker.toWorld(walker.layout.slots[m.slot][0],walker.layout.slots[m.slot][1]);
        const at=walker.walkable(m.x,m.z)?[]:W.findPath([m.x,m.z],walker.toWorld(...walker.layout.gate));
        m.path=at.concat(findPath(walker,at.length?at[at.length-1]:[m.x,m.z],goal));m.pi=0;
        if(!m.path.length)m.retry=1;
      }
      const before=[m.x,m.z],valid=walkAlong(m,step,walker);
      if(h.active&&!m.path.length&&(!valid||Math.hypot(m.x-f.foe.x,m.z-f.foe.z)>FIELD.heroRange)){
        if(attempted||!valid)m.failures=(m.failures||0)+1;
        m.retry=1;
        if(m.failures>=8){m.x=W.castle.spawn[0];m.z=W.castle.spawn[1];h.field=null;log(s,'路線受阻，隊伍已返回城內重新出發。','warning');return;}
      }else if(Math.hypot(m.x-before[0],m.z-before[1])>.01)m.failures=0;
    }
    let target=null,best=Infinity;
    for(const m of f.party){if(!ids.has(m.id))continue;const d=Math.hypot(m.x-f.foe.x,m.z-f.foe.z);if(d<best){best=d;target=m;}}
    if(!target){f.foe.aggro=false;f.foe.path=[];f.foe.pi=0;return;}
    if(!f.foe.aggro&&best<=FIELD.aggro){f.foe.aggro=true;f.foe.repath=0;}
    if(f.foe.aggro&&best>FIELD.leash){f.foe.aggro=false;f.foe.path=[];f.foe.pi=0;f.foe.repath=0;}
    f.foe.repath-=dt;
    const chase=f.foe.aggro?target:null;
    const goal=chase?[chase.x,chase.z]:[f.foe.homeX,f.foe.homeZ];
    const tag=chase?chase.id:'home';
    /* Close to its own reach and then hold the line, so the monster never walks
       through the hero it is attacking. */
    const stop=chase?FIELD.foeRange:FIELD.home;
    const reach=Math.hypot(f.foe.x-goal[0],f.foe.z-goal[1]);
    if(reach>stop){
      if(f.foe.target!==tag||f.foe.repath<=0){
        f.foe.target=tag;f.foe.repath=FIELD.repath;
        f.foe.path=findPath(walker,[f.foe.x,f.foe.z],goal);f.foe.pi=0;
      }
      walkAlong(f.foe,step,walker);
      // Never let the last step carry it inside the reach it was closing to.
      if(chase){const d=Math.hypot(f.foe.x-chase.x,f.foe.z-chase.z);if(d>1e-6&&d<stop){f.foe.x=chase.x+(f.foe.x-chase.x)/d*stop;f.foe.z=chase.z+(f.foe.z-chase.z)/d*stop;}}
    }else{f.foe.path=[];f.foe.pi=0;}
    // Once both sides have moved, keep a shoulder's width of space so nobody ends up
    // standing inside the monster.
    const minGap=FIELD.heroRange*.62;
    for(const m of f.party){
      if(!ids.has(m.id))continue;
      const dx=m.x-f.foe.x,dz=m.z-f.foe.z,d=Math.hypot(dx,dz);
      if(d>1e-6&&d<minGap){m.x=f.foe.x+dx/d*minGap;m.z=f.foe.z+dz/d*minGap;}
    }
    if(f.phase==='out'&&f.party.every(m=>!ids.has(m.id)||walkDone(m)))f.phase='fight';
  }
  /* Distance from every party member to the monster, or null when nothing is on the field. */
  function fieldContact(s){
    const f=s.hunting.field;if(!f)return null;
    const map=new Map();
    for(const m of f.party)map.set(m.id,Math.hypot(m.x-f.foe.x,m.z-f.foe.z));
    return map;
  }
  function fieldRebuildIfStale(s){
    const h=s.hunting,f=h.field;if(!h.active)return;
    // A defeat sends the party home and auto-continue re-dispatches them once the rest
    // is over, so the field has to be rebuilt for the new departure instead of staying
    // stuck in the walk-home phase.
    if(!f){buildField(s);return;}
    if(f.phase==='back'){const at=new Map(f.party.map(m=>[m.id,[m.x,m.z]]));buildField(s,{index:Number(f.key.split(':')[0])-1,at});return;}
    if(f.key!==fieldKey(s)){
      const at=new Map(f.party.map(m=>[m.id,[m.x,m.z]]));
      buildField(s,{index:Number(f.key.split(':')[0])-1,at});
    }
  }
  function fieldResetFoe(s){
    const f=s.hunting.field,walker=fieldWalker(s);if(!f||!walker)return;
    const home=walker.toWorld(walker.layout.foe[0],walker.layout.foe[1]);
    Object.assign(f.foe,{x:home[0],z:home[1],aggro:false,path:[],pi:0,target:null,repath:0});
  }
  function usePotion(s,kind,count=1){if(!Object.hasOwn(s.consumables,kind))return fail('未知補給');let used=0;for(let i=0;i<count;i++){if(s.consumables[kind]<=0)break;if(kind==='hp'||kind==='mp'){if(s.hunting.restUntil>s.clock)break;const targets=team(s,s.hunting.active?s.hunting.team:s.selectedTeam);if(!targets.length||!targets.some(p=>p.hp>0))break;const key=kind==='hp'?'hp':'mp',max=kind==='hp'?'maxHp':'maxMp';if(targets.every(p=>p[key]>=heroStats(s,p)[max]))break;for(const p of targets){const st=heroStats(s,p);if(kind==='hp')heal(s,p,st.maxHp*.5,null,true);else p.mp=Math.min(st.maxMp,p.mp+st.maxMp*.5);}}else if(kind==='goldBag')addReward(s,{gold:Math.floor(3000*1.35**Math.min(18,s.kingdom.level-1))},'金幣包');else{s.buffs[kind]=Math.max(s.clock,s.buffs[kind])+ (kind==='hourglass'?60000:1800000);}s.consumables[kind]--;used++;}return used?ok('使用 '+used+' 份補給',{count:used}):fail('補給不足、全滿或正在休整');}
  function tick(s,seconds,now=Date.now()){if(!Number.isFinite(seconds)||seconds<=0)return;let left=seconds;const start=now-seconds*1000;s.clock=start;while(left>1e-8){const dt=Math.min(.1,left);left-=dt;s.clock+=dt*1000;const h=s.hunting;if(h.restUntil&&s.clock>=h.restUntil){h.restUntil=0;for(const p of team(s,h.team)){const st=heroStats(s,p);p.hp=st.maxHp;p.mp=st.maxMp;}if(h.autoContinue&&team(s,h.team).length){h.active=true;log(s,'休整完成，隊伍重新出發。','dispatch');}}
      const busy=new Set((h.active||h.restUntil>s.clock)?team(s,h.team).map(p=>p.id):[]);for(const p of s.heroes)if(!busy.has(p.id)&&!p.expeditionId){const st=heroStats(s,p);p.hp=Math.min(st.maxHp,p.hp+st.maxHp*.02*dt);p.mp=Math.min(st.maxMp,p.mp+st.maxMp*.05*dt);}if(h.active){fieldRebuildIfStale(s);h.focusSeconds+=dt;if(s.autoPotion.enabled&&s.clock>=s.autoPotion.nextAt){const ts=team(s,h.team);const hp=ts.some(p=>p.hp/heroStats(s,p).maxHp<=s.autoPotion.hp),mp=ts.some(p=>p.mp/heroStats(s,p).maxMp<=s.autoPotion.mp);if(hp&&s.consumables.hp>0&&usePotion(s,'hp').ok)s.autoPotion.nextAt=s.clock+1000;else if(mp&&s.consumables.mp>0&&usePotion(s,'mp').ok)s.autoPotion.nextAt=s.clock+1000;}h.accumulator+=dt*h.speed*(s.buffs.hourglass>s.clock?5:1);while(h.accumulator>=.1-1e-9&&h.active){h.accumulator-=.1;fieldStep(s,.1);battleStep(s,.1);}if(!h.active)h.accumulator=0;if(h.farmTarget&&!h.manualAutoNext){const f=h.farmTarget,e=enemyPreview(s,f.zone,f.stage,f.difficulty),need=Math.floor(e.attack*3+e.defense*2+e.maxHp/10);if(teamPower(s,h.team)>=need*1.15){h.zone=f.zone;h.stage=f.stage;h.difficulty=f.difficulty;h.enemy=null;h.autoNext=true;h.farmTarget=null;}}}else h.focusSeconds=0;if(!h.active&&h.field&&h.field.phase==='back'){fieldStep(s,dt*h.speed);if(h.field.retreat==='home'&&h.field.party.every(m=>walkDone(m)))h.field=null;}if(ext()?.tick)ext().tick(s,dt,s.clock);}
    s.clock=now;s.lastSeen=now;
  }
  function offline(s,now=Date.now()){
    const from=s.lastSeen,elapsed=Math.max(0,(now-from)/1000),summary={seconds:Math.min(43200,elapsed),gold:0,xp:0,items:0,materials:{},hunting:false};if(now<=from)return summary;const h=s.hunting,party=team(s,h.team),legal=party.length>0&&party.every(p=>!p.expeditionId),active=legal&&(h.active||h.restUntil>from&&h.autoContinue);s.clock=from;
    if(elapsed>=90&&active){const end=Math.min(now,from+43200000),begin=Math.min(end,Math.max(from,h.restUntil||from));if(begin<end){summary.hunting=true;const base=h.mode==='abyss'?abyssEnemy(h.abyssFloor):enemyPreview(s,h.zone,h.stage,h.difficulty);const cuts=[begin,end,s.createdAt+600000,...Object.values(s.buffs)].filter(t=>t>=begin&&t<=end);let midnight=Date.parse(dayKey(begin)+'T00:00:00+08:00')+86400000;while(midnight<end){cuts.push(midnight);midnight+=86400000;}cuts.sort((a,b)=>a-b);let gold=0,xp=0;for(let i=1;i<cuts.length;i++){const duration=(cuts[i]-cuts[i-1])/1000;if(duration<=0)continue;s.clock=(cuts[i]+cuts[i-1])/2;const dps=party.reduce((n,p)=>{const st=heroStats(s,p);return n+st.attack*st.speed*(1+st.crit)*100/(100+base.defense)*elementMultiplier(D.classes[p.classId].element,base.element);},0);const difficulty=h.mode==='abyss'?1:D.difficulties[h.difficulty].multiplier,kills=duration/Math.max(.4*difficulty,base.maxHp/Math.max(1,dps)),mods=rewardMultipliers(s,s.clock,true);gold+=kills*base.gold*mods.gold;xp+=kills*base.xp*mods.xp;}summary.gold=Math.floor(gold);summary.xp=Math.floor(xp);s.clock=end;addReward(s,{gold:summary.gold});for(const p of party)grantHeroXP(s,p,summary.xp/party.length);const hours=(end-begin)/3600000;grantKingdomXP(s,kingdomXP(s.kingdom.level)*hours*.08);const pool=materialPool(h.zone,h.mode==='abyss'),count=Math.min(pool.length,rng(s)<.5?2:3),selected=[];while(selected.length<count){const material=pick(s,pool);if(!selected.includes(material))selected.push(material);}for(const m of selected)summary.materials[m]=Math.floor(hours*(2+rng(s)*3));addReward(s,{materials:summary.materials});for(let i=0;i<Math.min(3,Math.floor(1+hours/4));i++)if(rng(s)<.6){if(receiveItem(s,makeItem(s,h.mode==='abyss'?10:h.zone)))summary.items++;}log(s,'離線狩獵 '+Math.floor((end-begin)/60)+' 分鐘 · '+summary.gold+' 金 / '+summary.xp+' 經驗','offline');}}
    if(h.restUntil&&h.restUntil<=now){h.restUntil=0;for(const p of party){const st=heroStats(s,p);p.hp=st.maxHp;p.mp=st.maxMp;}h.active=active&&h.autoContinue;}for(const p of s.heroes)if(!party.includes(p)||!active){if(p.expeditionId)continue;const st=heroStats(s,p);p.hp=Math.min(st.maxHp,p.hp+elapsed*st.maxHp*.02);p.mp=Math.min(st.maxMp,p.mp+elapsed*st.maxMp*.05);}h.focusSeconds=0;s.clock=now;if(ext()?.offline)ext().offline(s,elapsed,now);else if(ext()?.tick)ext().tick(s,elapsed,now);s.lastSeen=now;s.offlineReport=summary;return summary;
  }
  function ascensionInfo(s){const buildings=['castle','tavern','training','forge'].filter(k=>s.buildings[k]>=10).length,reached=s.progress.zone>7||s.progress.zone===7&&s.progress.stage>=10;return {eligible:reached&&buildings>=3,honor:Math.floor((100+25*Math.min(s.ascensions,10))*(1+.05*s.buildings.altar)),bonus:.85*(1-.6**s.ascensions),nextBonus:.85*(1-.6**(s.ascensions+1)),reason:!reached?'本輪須抵達第 7 區第 10 關':buildings<3?'王城、酒館、訓練場、鐵匠至少三座 Lv10':'可昇華；英雄、金幣、素材、装備與本輪建築將重置'};}
  function isFree(s,h,locked=false){return h&&!occupied(s,h)&&(!locked||!h.locked);}
  function removeHero(s,h){for(const t of s.teams)for(let i=0;i<t.length;i++)if(t[i]===h.id)t[i]=null;if(Array.isArray(s.ext.resonance))s.ext.resonance=s.ext.resonance.map(id=>id===h.id?null:id);h.equipment={};s.heroes=s.heroes.filter(p=>p.id!==h.id);}
  function countValue(p,max=100){if(p.count===undefined)return 1;return Number.isInteger(p.count)&&p.count>=1&&p.count<=max?p.count:0;}
  function validIndex(i,size){return Number.isInteger(i)&&i>=0&&i<size;}
  function action(s,type,p,now){const h=hero(s,p.heroId),it=item(s,p.itemId),count=countValue(p);
    switch(type){
      case'recruit':{if(!['normal','advanced','mythic'].includes(p.kind)||!count)return fail('招募類型或次數不合法');let done=0;const recruited=[];for(let i=0;i<count;i++){const cost=recruitCost(s,p.kind);if(s.heroes.length>=capacity(s).roster||!canAfford(s,cost))break;spend(s,cost);let stars;if(p.kind==='normal'){stars=weighted(s,[60,30,10])+1;s.recruitment.normal++;}else if(p.kind==='advanced'){stars=s.recruitment.advancedPity>=9?5:weighted(s,[45,30,20,5])+2;s.recruitment.advancedPity=stars===5?0:s.recruitment.advancedPity+1;}else{stars=s.recruitment.mythicPity>=19?6:weighted(s,[40,35,20,5])+3;s.recruitment.mythicPity=stars===6?0:s.recruitment.mythicPity+1;}let cls=D.classList[weighted(s,D.classList.map(c=>s.recruitment.wishlist.includes(c.id)?2:1))].id,legend=null;if(p.kind==='mythic'&&stars===6&&rng(s)<.25){const def=pick(s,D.legends);legend=def.id;cls=def.classId;}if(legend&&s.heroes.some(member=>member.legend===legend)){addReward(s,{badges:5},'重複命名傳說轉為 5 片徽章碎片');}else{const newHero=makeHero(s,cls,stars,1,legend);s.heroes.push(newHero);recruited.push(newHero.id);s.collections.classes[cls]=(s.collections.classes[cls]||0)+1;if(legend&&!s.collections.legends.includes(legend))s.collections.legends.push(legend);event(s,'recruit',{hero:newHero});log(s,'招募 '+stars+'★ '+newHero.name,'recruit',{heroId:newHero.id});}s.stats.recruits++;done++;}return done?ok('完成 '+done+' 次招募',{count:done,heroIds:recruited}):fail(s.heroes.length>=capacity(s).roster?'名冊已滿，先擴建酒館或整理英雄':'招募資源不足');}
      case'wishlist':if(!Array.isArray(p.classes)||p.classes.length>2||new Set(p.classes).size!==p.classes.length||p.classes.some(c=>!D.classes[c]))return fail('心願單最多兩個不同職業');s.recruitment.wishlist=p.classes.slice();return ok('心願單已更新');
      case'assign':{if(!validIndex(p.team,capacity(s).teams)||!validIndex(p.slot,capacity(s).slots))return fail('隊伍或格位尚未解鎖');const old=hero(s,s.teams[p.team][p.slot]);if((old&&occupied(s,old))||(s.hunting.team===p.team&&(s.hunting.active||s.hunting.restUntil>s.clock)))return fail('此隊伍正在狩獵或休整，請先召回');if(p.heroId===null){s.teams[p.team][p.slot]=null;return ok('格位已清空');}if(!h)return fail('找不到英雄');if(occupied(s,h))return fail('英雄正在執行任務');for(const t of s.teams)for(let i=0;i<t.length;i++)if(t[i]===h.id)t[i]=null;s.teams[p.team][p.slot]=h.id;return ok('已編入第 '+(p.team+1)+' 隊');}
      case'autoTeam':{const index=p.team??s.selectedTeam;if(!validIndex(index,capacity(s).teams))return fail('隊伍尚未解鎖');if(s.hunting.team===index&&(s.hunting.active||s.hunting.restUntil>s.clock))return fail('隊伍正在狩獵或休整');const assigned=new Set(s.teams.filter((_,i)=>i!==index).flat().filter(Boolean));const choices=s.heroes.filter(member=>!occupied(s,member)&&!assigned.has(member.id)).sort((a,b)=>heroStats(s,b).power-heroStats(s,a).power).slice(0,capacity(s).slots);if(!choices.length)return fail('沒有可編隊的英雄');choices.sort((a,b)=>(['knight','swordsman'].includes(b.classId)?1:0)-(['knight','swordsman'].includes(a.classId)?1:0));s.teams[index]=Array.from({length:5},(_,i)=>choices[i]?.id||null);return ok('已按戰力與前排職業編隊');}
      case'selectTeam':if(!validIndex(p.index,capacity(s).teams))return fail('隊伍尚未解鎖');s.selectedTeam=p.index;return ok('已選第 '+(p.index+1)+' 隊');
      case'dispatch':{if(s.hunting.active)return fail('已有隊伍出戰');if(s.hunting.restUntil>s.clock)return fail('休整尚未完成');const members=team(s);if(!members.length)return fail('請先編入英雄');if(members.some(member=>member.expeditionId))return fail('隊員正在遠征');if(!members.some(member=>member.hp>0))return fail('隊伍仍在城內恢復生命');s.hunting.active=true;s.hunting.team=s.selectedTeam;s.hunting.report={};s.hunting.focusSeconds=0;s.hunting.accumulator=0;s.hunting.field=null;buildField(s);if(!s.hunting.enemy)spawnEnemy(s);log(s,'第 '+(s.selectedTeam+1)+' 隊穿過城門出發。','dispatch');return ok('隊伍已出征');}
      case'recall':if(s.hunting.restUntil>s.clock)return fail('敗退休整不能跳過');if(!s.hunting.active)return fail('目前沒有狩獵隊伍');s.hunting.active=false;s.hunting.focusSeconds=0;s.hunting.accumulator=0;fieldReturn(s,false);log(s,'隊伍返回蒼嵐堡，開始緩慢恢復。','recall');return ok('已召回；生命與魔力逐秒恢復');
      case'target':{if(s.hunting.active||s.hunting.restUntil>s.clock)return fail('請先召回並完成休整，再更換目標');const mode=p.mode||'main';if(mode==='abyss'){if(s.progress.zone<6)return fail('通過第 5 區後開放無盡深淵');const floor=p.floor??p.stage??s.hunting.abyssFloor;if(!Number.isInteger(floor)||floor<1||floor>s.progress.abyssMax+1)return fail('深淵樓層尚未解鎖');s.hunting.mode='abyss';s.hunting.abyssFloor=floor;s.hunting.difficulty=0;}else if(mode==='main'){const zone=p.zone,stage=p.stage,difficulty=p.difficulty??s.hunting.difficulty;if(!Number.isInteger(zone)||!Number.isInteger(stage)||zone<1||zone>10||stage<1||stage>10||zone>s.progress.zone||zone===s.progress.zone&&stage>s.progress.stage)return fail('此關卡本輪尚未抵達');if(!validIndex(difficulty,4)||s.progress.zone<D.difficulties[difficulty].zone)return fail('此難度尚未解鎖');s.hunting.mode='main';s.hunting.zone=zone;s.hunting.stage=stage;s.hunting.difficulty=difficulty;}else return fail('未知狩獵模式');s.hunting.enemy=null;s.hunting.field=null;s.hunting.losses=0;s.hunting.farmTarget=null;return ok('狩獵目標已更新');}
      case'speed':if(![1,2,4].includes(p.value))return fail('速度只能為 1、2、4 倍');s.hunting.speed=p.value;return ok('戰鬥速度 '+p.value+'×');
      case'autoNext':if(typeof p.value!=='boolean')return fail('需要開關值');s.hunting.autoNext=p.value;s.hunting.manualAutoNext=!p.value;if(p.value)s.hunting.farmTarget=null;return ok(p.value?'自動進關已開啟':'固定目前關卡');
      case'autoContinue':if(typeof p.value!=='boolean')return fail('需要開關值');s.hunting.autoContinue=p.value;return ok('自動續戰設定已更新');
      case'train':{if(!h||!count)return fail('英雄或次數不合法');if(s.buildings.training<1)return fail('請先建造訓練場');let done=0;for(let i=0;i<count&&h.level<200;i++){const cost=trainingCost(h);if(!spend(s,cost))break;h.investment.gold+=cost.gold;const xp=Math.floor(40*h.level**1.5*(1+.1*s.buildings.training));grantHeroXP(s,h,xp);done++;}return done?ok('完成 '+done+' 次訓練',{count:done}):fail(h.level>=200?'英雄已滿級':'訓練金幣不足');}
      case'breakthrough':{if(!h)return fail('找不到英雄');const def=D.breakthroughs[h.breakthrough];if(!def)return fail('已完成五次突破');if(h.level<def.level)return fail('實際等級須達 Lv'+def.level);if(!spend(s,def.cost))return fail('突破資源不足');h.investment.gold+=def.cost.gold;for(const[k,v]of Object.entries(def.cost.materials))h.investment.materials[k]=(h.investment.materials[k]||0)+v;h.breakthrough++;s.stats.breakthroughs++;event(s,'breakthrough',{hero:h});return ok('突破完成，基礎四屬性提升 20%');}
      case'skill':{if(!h||!validIndex(p.index,3))return fail('英雄或技能不合法');const def=D.classes[h.classId].skills[p.index],level=h.skills[p.index];if(h.level<def.unlock)return fail('實際等級不足，技能尚未解鎖');if(level>=10)return fail('技能已滿級');const books=level*(level<5?2:3);if(!spend(s,{books}))return fail('技能書不足');h.skills[p.index]++;h.investment.books+=books;return ok(def.name+' 升至 Lv'+h.skills[p.index]);}
      case'selectSkill':if(!h||!validIndex(p.main,3)||!validIndex(p.sub,3)||p.main===p.sub)return fail('主技與副技必須為不同技能');if(h.level<D.classes[h.classId].skills[p.main].unlock)return fail('主技能尚未解鎖');if(h.level<D.classes[h.classId].skills[p.sub].unlock)return fail('副技能尚未解鎖');h.mainSkill=p.main;h.subSkill=p.sub;return ok('主副技已設定');
      case'lockHero':if(!h)return fail('找不到英雄');h.locked=!h.locked;return ok(h.locked?'英雄已鎖定':'英雄已解除鎖定');
      case'renameHero':if(!h||typeof p.name!=='string'||!p.name.trim()||p.name.trim().length>24)return fail('名字需為 1～24 字');h.name=p.name.trim();return ok('姓名已更新');
      case'dismiss':{if(!isFree(s,h,true))return fail('英雄不存在、已鎖定或正在執行任務');if(s.heroes.length<=1)return fail('至少保留一名英雄以持續狩獵');if(p.confirm!==true)return fail('請確認遣散具名英雄，裝備會完整卸回');const fragments=[0,0,1,3,8,20][h.stars-1];removeHero(s,h);addReward(s,{fragments},'遣散 '+h.name+'，取得 '+fragments+' 英雄碎片');return ok('英雄已遣散，裝備完整保留');}
      case'starUp':{if(!isFree(s,h))return fail('目標英雄不存在或正在執行任務');if(h.stars>=6)return fail('英雄已達 6★');const same=[1,2,3,4,6][h.stars-1],any=[0,1,1,2,2][h.stars-1],ids=p.materialIds;if(!Array.isArray(ids)||ids.length!==same+any||new Set(ids).size!==ids.length)return fail('需 '+same+' 位同職業與 '+any+' 位任意職業的同星素材');const mats=ids.map(id=>hero(s,id));if(mats.some(m=>!isFree(s,m,true)||m.id===h.id||m.stars!==h.stars))return fail('素材須為未占用、未鎖定、同星級的其他英雄');if(mats.filter(m=>m.classId===h.classId).length<same)return fail('同職業素材數量不足');if(p.confirm!==true)return fail('請確認具名素材與裝備卸回結果');for(const m of mats)removeHero(s,m);h.stars++;s.stats.stars++;event(s,'starUp',{hero:h});return ok('升至 '+h.stars+'★，素材裝備已卸回');}
      case'resetHero':{if(!isFree(s,h,true))return fail('英雄不存在、已鎖定或正在執行任務');if(p.confirm!==true)return fail('請確認重置英雄及實際投入返還');const investment=clone(h.investment);h.level=1;h.xp=0;h.breakthrough=0;h.skills=[1,1,1];h.cooldowns=[0,0,0];h.mainSkill=0;h.subSkill=1;h.investment={gold:0,materials:{},books:0};clampHealth(s,h);addReward(s,investment,'返還 '+h.name+' 的實際培養投入');return ok('英雄已重置；星級、身份、裝備與神器保留',{refund:investment});}
      case'swapHero':{const other=hero(s,p.otherId);if(!isFree(s,h,true)||!isFree(s,other,true)||h.id===other.id)return fail('兩名英雄須不同、閒置且未鎖定');if(h.classId!==other.classId)return fail('只可置換相同職業');if(p.confirm!==true)return fail('請確認置換；身份、裝備、神器保留原持有人');const cost=1+Math.ceil(Math.abs(h.stars-other.stars)/2);if(!spend(s,{swapStones:cost}))return fail('置換石不足');const keys=['stars','level','xp','breakthrough','skills','mainSkill','subSkill','investment'];for(const key of keys){const tmp=h[key];h[key]=other[key];other[key]=tmp;}h.cooldowns=[0,0,0];other.cooldowns=[0,0,0];clampHealth(s,h);clampHealth(s,other);return ok('養成已交換；身份、編隊、共鳴位置與裝備歸屬保留');}
      case'synthHero':{if(!D.classes[p.classId]||![4,5].includes(p.stars))return fail('可合成自選職業 4★ 或 5★');if(s.heroes.length>=capacity(s).roster)return fail('名冊已滿');const key=p.stars===4?'four':'five',week=weekKey(now),used=s.synthesis.week===week?s.synthesis[key]:0;if(used>=(p.stars===4?2:1))return fail('本週合成次數已用完');const cost={fragments:p.stars===4?30:60};if(!spend(s,cost))return fail('英雄碎片不足');if(s.synthesis.week!==week)s.synthesis={week,four:0,five:0};s.synthesis[key]++;const result=makeHero(s,p.classId,p.stars);s.heroes.push(result);s.stats.recruits++;s.collections.classes[p.classId]=(s.collections.classes[p.classId]||0)+1;event(s,'recruit',{hero:result});return ok('已合成 '+result.name,{heroId:result.id});}
      case'equip':if(!h||!it)return fail('找不到英雄或裝備');if(it.classId&&it.classId!==h.classId)return fail('武器職業不符');if(equippedBy(s,it)&&equippedBy(s,it).id!==h.id)return fail('裝備已由另一名英雄穿戴');h.equipment[it.slot]=it.id;clampHealth(s,h);event(s,'equip',{hero:h,item:it});return ok('已穿戴 '+it.name);
      case'unequip':if(!h||!D.slots.some(slot=>slot.id===p.slot)||!h.equipment[p.slot])return fail('此部位沒有裝備');delete h.equipment[p.slot];clampHealth(s,h);return ok('裝備已卸回背包');
      case'autoEquip':{if(!h)return fail('找不到英雄');let changed=0;for(const slot of D.slots){const originalId=h.equipment[slot.id]||null;let bestId=originalId,best=teamPower(s,s.teams.findIndex(t=>t.includes(h.id))>=0?s.teams.findIndex(t=>t.includes(h.id)):s.selectedTeam)+heroStats(s,h).power;for(const candidate of s.inventory.filter(i=>i.slot===slot.id&&(!i.classId||i.classId===h.classId)&&(!equippedBy(s,i)||equippedBy(s,i).id===h.id))){h.equipment[slot.id]=candidate.id;const score=teamPower(s,s.teams.findIndex(t=>t.includes(h.id))>=0?s.teams.findIndex(t=>t.includes(h.id)):s.selectedTeam)+heroStats(s,h).power;if(score>best+.001){best=score;bestId=candidate.id;}}if(bestId){if(bestId!==originalId)changed++;h.equipment[slot.id]=bestId;}else delete h.equipment[slot.id];}clampHealth(s,h);return ok('已比較屬性與套裝效果，裝備最佳可用組合',{count:changed});}
      case'enhance':{if(!it||!count)return fail('裝備或次數不合法');if(s.buildings.forge<1)return fail('請先建造鐵匠鋪');let done=0;for(let i=0;i<count&&it.enhance<15;i++){if(!spend(s,enhanceCost(s,it)))break;it.enhance++;s.stats.enhances++;event(s,'enhance',{item:it});done++;}return done?ok('強化完成：+'+it.enhance,{count:done}):fail(it.enhance>=15?'已達強化上限 +15':'強化金幣不足');}
      case'dismantle':{const ids=p.itemIds;if(!Array.isArray(ids)||!ids.length||ids.length>100||new Set(ids).size!==ids.length)return fail('請選擇 1～100 件不同裝備');const objects=ids.map(id=>item(s,id));if(objects.some(object=>!object||object.locked||equippedBy(s,object)||object.gems.some(Boolean)))return fail('已穿戴、已鎖定或有嵌入寶石的裝備不能分解');if(p.confirm!==true)return fail('請確認分解清單與返還素材');for(const object of objects)addReward(s,dismantleReward(object));s.inventory=s.inventory.filter(object=>!ids.includes(object.id));return ok('已分解 '+ids.length+' 件裝備',{count:ids.length});}
      case'lockItem':if(!it)return fail('找不到裝備');it.locked=!it.locked;return ok(it.locked?'裝備已鎖定':'裝備已解除鎖定');
      case'craft':{const recipe=D.recipes.find(r=>r.id===p.recipeId);if(!recipe)return fail('配方不存在');if(s.progress.zone<recipe.unlock)return fail('抵達第 '+recipe.unlock+' 區後開放配方');if(s.inventory.length>=capacity(s).inventory)return fail('背包已滿');if(!spend(s,recipe.cost))return fail('製作金幣或素材不足');const crafted=makeItem(s,recipe.tier,recipe);receiveItem(s,crafted);return ok('已製作 '+crafted.name,{itemId:crafted.id});}
      case'socket':{const gm=s.gems.find(gm=>gm.id===p.gemId);if(!it||!gm||!validIndex(p.index,it.holes))return fail('裝備、寶石或孔位不合法');const old=it.gems[p.index];s.gems=s.gems.filter(gem=>gem.id!==gm.id);if(old)s.gems.push(old);it.gems[p.index]=gm;return ok(old?'已替換寶石，原寶石回到背包':'寶石已鑲嵌');}
      case'unsocket':if(!it||!validIndex(p.index,it.holes)||!it.gems[p.index])return fail('此孔位沒有寶石');s.gems.push(it.gems[p.index]);it.gems[p.index]=null;for(const member of s.heroes)clampHealth(s,member);return ok('寶石已完整卸回背包');
      case'fuseGem':{if(s.buildings.gem<1)return fail('請先建造寶石工坊');if(!D.gemTypes[p.type]||!Number.isInteger(p.tier)||p.tier<1||p.tier>=10)return fail('寶石第 10 階禁止再融合');const matches=s.gems.filter(gem=>gem.type===p.type&&gem.tier===p.tier).slice(0,3);if(matches.length<3)return fail('需 3 顆同種類同階寶石');if(!spend(s,{gold:200}))return fail('融合金幣不足');s.gems=s.gems.filter(gem=>!matches.includes(gem));const result=makeGem(s,p.tier+1,p.type);return ok('融合完成：第 '+result.tier+' 階'+D.gemTypes[result.type].name,{gemId:result.id});}
      case'reroll':{if(!it||it.stars<3)return fail('洗練需要 3★ 以上裝備');if(it.locked)return fail('請先解除裝備鎖定');const costs=[{gold:2000,materials:{crystal:2}},{gold:5000,materials:{crystal:4,ember:2}},{gold:12000,materials:{ember:4,void:2}},{gold:30000,materials:{void:4,myth:2}}];if(!spend(s,costs[it.stars-3]))return fail('洗練資源不足');it.affix={id:pick(s,Object.keys(D.affixes))};return ok('新詞綴：'+D.affixes[it.affix.id].name);}
      case'potion':return count?usePotion(s,p.kind,count):fail('次數不合法');
      case'autoPotion':if(typeof p.enabled!=='boolean'||!Number.isFinite(p.hp)||!Number.isFinite(p.mp)||p.hp<0||p.hp>1||p.mp<0||p.mp>1)return fail('自動喝藥門檻需介於 0～100%');s.autoPotion={...s.autoPotion,enabled:p.enabled,hp:p.hp,mp:p.mp};return ok('自動補給設定已更新');
      case'autoDismantle':if(!Number.isInteger(p.stars)||p.stars<0||p.stars>4)return fail('可自動分解 1～4★，0 為關閉');s.settings.autoDismantle=p.stars;return ok('自動分解規則已更新');
      case'convertMaterial':{const groups=[['iron','herb','leather'],['crystal','ember','frost'],['poison','void','myth']],from=groups.findIndex(v=>v.includes(p.from)),to=groups.findIndex(v=>v.includes(p.to));if(from<0||to!==from+1||!count)return fail('只能由低階合成中階，或由中階合成高階');let done=0;for(let i=0;i<count;i++){if(!spend(s,{gold:from===0?100:500,materials:{[p.from]:4}}))break;addReward(s,{materials:{[p.to]:1}});done++;}return done?ok('已合成 '+done+' 個'+D.materials[p.to],{count:done}):fail('素材或金幣不足');}
      case'ascend':{const preview=ascensionInfo(s);if(!preview.eligible)return fail(preview.reason);if(p.confirm!==true)return fail('請確認昇華前的重置與保留清單');event(s,'ascend',{phase:'before'});ext()?.onAscend?.(s,now);addReward(s,{honor:preview.honor});s.ascensions++;s.traditionChoices++;s.resources.gold=300;for(const k of Object.keys(s.materials))s.materials[k]=0;s.kingdom={level:1,xp:0,milestones:s.kingdom.milestones};s.buildings={castle:1,tavern:1,warehouse:1,training:0,forge:0,potion:0,gem:0,market:0,library:0,altar:0};s.heroes=[];s.inventory=[];s.gems=[];s.teams=Array.from({length:5},()=>Array(5).fill(null));s.selectedTeam=0;for(const k of Object.keys(s.consumables))s.consumables[k]=0;for(const k of Object.keys(s.buffs))s.buffs[k]=0;Object.assign(s.hunting,{active:false,team:0,zone:1,stage:1,difficulty:0,restUntil:0,enemy:null,field:null,mode:'main',abyssFloor:1,report:{},elapsed:0,losses:0,farmTarget:null,focusSeconds:0,accumulator:0,autoNext:true,manualAutoNext:false});Object.assign(s.progress,{zone:1,stage:1,completed:[]});if(s.ext.resonance)s.ext.resonance=s.ext.resonance.map(()=>null);const starter=makeHero(s,pick(s,D.classList).id,2);s.heroes.push(starter);s.teams[0][0]=starter.id;event(s,'ascend',{phase:'after'});log(s,'第 '+s.ascensions+' 次昇華完成。新的英雄在城門等待。','ascend');return ok('昇華完成，获得 '+preview.honor+' 榮譽與一次傳統選擇');}
      case'tradition':if(!D.traditions[p.id])return fail('未知傳統');if(s.traditionChoices<1)return fail('沒有可用的傳統選擇');if(s.traditions[p.id]>=10)return fail('此傳統已滿級');s.traditionChoices--;s.traditions[p.id]++;return ok(D.traditions[p.id].name+' 傳統升至 Lv'+s.traditions[p.id]);
      default:return ext()?.dispatch?.(s,type,p,now)||fail('尚未支援的操作：'+type);
    }
  }
  function dispatch(s,type,payload={},now=Date.now()){if(typeof type!=='string'||!payload||typeof payload!=='object'||Array.isArray(payload)||!Number.isFinite(now))return fail('操作格式不合法');const snapshot=clone(s);try{s.clock=now;const result=action(s,type,payload,now);if(!result||typeof result.ok!=='boolean')throw Error('操作沒有回傳結果');if(!result.ok)restore(s,snapshot);return result;}catch(error){restore(s,snapshot);return fail('操作未完成：'+error.message);}}
  function validate(s){try{if(!s||typeof s!=='object'||Array.isArray(s)||s.version!==1)return fail('不支援的存檔版本');let nodes=0;const scan=(v,depth=0)=>{if(++nodes>150000||depth>30)throw Error('存檔過大');if(typeof v==='number'&&(!Number.isFinite(v)||Math.abs(v)>1e100))throw Error('存檔含無效數值');if(v&&typeof v==='object'){for(const[k,n]of Object.entries(v)){if(['__proto__','prototype','constructor'].includes(k))throw Error('存檔含非法欄位');scan(n,depth+1);}}};scan(s);if(!Number.isInteger(s.rng)||s.rng<=0||s.rng>4294967295||!Number.isInteger(s.sequence)||s.sequence<0)return fail('乱數或識別序號不合法');for(const k of ['resources','materials','kingdom','buildings','hunting','progress','stats','recruitment','consumables','buffs','autoPotion','traditions','collections','settings','synthesis','ext'])if(!s[k]||typeof s[k]!=='object'||Array.isArray(s[k]))return fail('缺少 '+k+' 存檔欄位');for(const k of ['heroes','inventory','gems','teams','events'])if(!Array.isArray(s[k]))return fail('缺少 '+k+' 清單');if(s.teams.length!==5||s.teams.some(t=>!Array.isArray(t)||t.length!==5))return fail('編隊資料不完整');if(!Number.isFinite(s.lastSeen)||!Number.isFinite(s.createdAt)||!Number.isFinite(s.clock)||s.lastSeen<0)return fail('存檔時間不合法');if(!Number.isInteger(s.kingdom.level)||s.kingdom.level<1||s.kingdom.level>50||s.kingdom.xp<0)return fail('王國等級不合法');for(const k of ['gold','gems','tickets','honor','books','fragments','badges','kingCoins','swapStones','points'])if(!Number.isFinite(s.resources[k])||s.resources[k]<0)return fail('資源數值不合法');for(const k of Object.keys(D.materials))if(!Number.isFinite(s.materials[k])||s.materials[k]<0)return fail('素材數值不合法');const max={castle:60,tavern:30,warehouse:50,training:40,forge:40,potion:40,gem:40,market:10,library:40,altar:30};for(const[k,v]of Object.entries(max))if(!Number.isInteger(s.buildings[k])||s.buildings[k]<(['castle','tavern','warehouse'].includes(k)?1:0)||s.buildings[k]>v)return fail('建築等級不合法');if(!validIndex(s.selectedTeam,capacity(s).teams)||!validIndex(s.hunting.team,capacity(s).teams))return fail('隊伍尚未解鎖');const ids=new Set(),claim=id=>{if(typeof id!=='string'||!id||ids.has(id))throw Error('物件識別碼重複或缺失');ids.add(id);};for(const h of s.heroes){claim(h.id);if(!D.classes[h.classId]||!Number.isInteger(h.level)||h.level<1||h.level>200||!Number.isInteger(h.stars)||h.stars<1||h.stars>6||!Number.isInteger(h.breakthrough)||h.breakthrough<0||h.breakthrough>5||h.hp<0||h.mp<0||h.xp<0)throw Error('英雄屬性不合法');if(!Array.isArray(h.skills)||h.skills.length!==3||h.skills.some(l=>!Number.isInteger(l)||l<1||l>10)||!validIndex(h.mainSkill,3)||!validIndex(h.subSkill,3)||h.mainSkill===h.subSkill||!h.equipment||!h.investment||!Array.isArray(h.cooldowns)||h.cooldowns.length!==3||!h.status)throw Error('英雄養成欄位不完整');}
      const checkGem=gm=>{claim(gm.id);if(!D.gemTypes[gm.type]||!Number.isInteger(gm.tier)||gm.tier<1||gm.tier>10)throw Error('寶石資料不合法');};for(const gm of s.gems)checkGem(gm);for(const it of s.inventory){claim(it.id);if(!D.slots.some(sl=>sl.id===it.slot)||!Number.isInteger(it.tier)||it.tier<1||it.tier>10||!Number.isInteger(it.stars)||it.stars<1||it.stars>6||!Number.isInteger(it.enhance)||it.enhance<0||it.enhance>15||!Number.isInteger(it.holes)||it.holes<0||it.holes>2||!Array.isArray(it.gems)||it.gems.length!==it.holes)throw Error('裝備資料不合法');if(it.slot==='weapon'&&!D.classes[it.classId])throw Error('武器職業不合法');for(const gm of it.gems)if(gm)checkGem(gm);if(it.set&&!D.sets[it.set]||it.affix&&!D.affixes[it.affix.id||it.affix])throw Error('裝備套裝或詞綴不合法');}const worn=new Set();for(const h of s.heroes)for(const[slot,id]of Object.entries(h.equipment)){const it=item(s,id);if(!it||it.slot!==slot||worn.has(id)||it.classId&&it.classId!==h.classId)throw Error('裝備歸屬不合法');worn.add(id);}const assigned=new Set();for(let ti=0;ti<5;ti++)for(let si=0;si<5;si++){const id=s.teams[ti][si];if(id!==null){if(!hero(s,id)||assigned.has(id)||ti>=capacity(s).teams||si>=capacity(s).slots)throw Error('隊伍有重复英雄或未解鎖位置');assigned.add(id);}}if(!Number.isInteger(s.progress.zone)||s.progress.zone<1||s.progress.zone>10||!Number.isInteger(s.progress.stage)||s.progress.stage<1||s.progress.stage>10||!Number.isInteger(s.hunting.zone)||s.hunting.zone<1||s.hunting.zone>10||!Number.isInteger(s.hunting.stage)||s.hunting.stage<1||s.hunting.stage>10||!validIndex(s.hunting.difficulty,4)||![1,2,4].includes(s.hunting.speed)||!['main','abyss'].includes(s.hunting.mode))throw Error('關卡進度不合法');if(s.hunting.mode==='main'&&(s.hunting.zone>s.progress.zone||s.hunting.zone===s.progress.zone&&s.hunting.stage>s.progress.stage))throw Error('狩獵目標尚未解鎖');if(s.hunting.active&&(!team(s,s.hunting.team).length||team(s,s.hunting.team).some(h=>h.expeditionId)))throw Error('派遣英雄歸屬不合法');if(!Array.isArray(s.progress.completed)||!Array.isArray(s.progress.firstClears)||!Array.isArray(s.collections.items)||!Array.isArray(s.collections.legends)||!Array.isArray(s.recruitment.wishlist))throw Error('永久紀錄缺失');return ok('存檔格式有效');}catch(error){return fail(error.message);}}
  function validateComplete(s){const basic=validate(s);if(!basic.ok)return basic;try{const bounded=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;const positiveMap=(o,allowed)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.entries(o).every(([k,v])=>(!allowed||allowed.includes(k))&&Number.isFinite(v)&&v>=0);if(!bounded(s.ascensions,0,1000000)||!bounded(s.traditionChoices,0,s.ascensions)||!positiveMap(s.traditions,Object.keys(D.traditions))||Object.keys(D.traditions).some(k=>!bounded(s.traditions[k],0,10)))return fail('昇華或傳統紀錄不合法');if(!positiveMap(s.stats)||!positiveMap(s.buffs)||!positiveMap(s.consumables))return fail('統計或道具數值不合法');if(!bounded(s.recruitment.normal,0,1000000000)||!bounded(s.recruitment.advancedPity,0,9)||!bounded(s.recruitment.mythicPity,0,19)||s.recruitment.wishlist.length>2||new Set(s.recruitment.wishlist).size!==s.recruitment.wishlist.length||s.recruitment.wishlist.some(k=>!D.classes[k]))return fail('招募保底資料不合法');if(!bounded(s.progress.maxZone,1,10)||!bounded(s.progress.maxStage,1,10)||!bounded(s.progress.abyssMax,0,1000000000)||!bounded(s.hunting.abyssFloor,1,s.progress.abyssMax+1)||!positiveMap(s.collections.classes,Object.keys(D.classes))||!s.collections.monsters||!s.collections.materials||!s.progress.dailyBoss||!Array.isArray(s.kingdom.milestones))return fail('歷史進度或收藏資料不完整');if(['active','autoNext','autoContinue','manualAutoNext'].some(k=>typeof s.hunting[k]!=='boolean')||!Number.isFinite(s.hunting.restUntil)||s.hunting.restUntil<0||!Number.isFinite(s.hunting.accumulator)||s.hunting.accumulator<-.000001||!s.hunting.report)return fail('戰鬥計時或設定不合法');if(s.hunting.mode==='abyss'&&s.progress.zone<6)return fail('無盡深淵尚未解鎖');if(s.hunting.enemy){const e=s.hunting.enemy;if(!Number.isFinite(e.hp)||e.hp<0||!Number.isFinite(e.maxHp)||e.maxHp<=0||e.hp>e.maxHp||!positiveMap({attack:e.attack,defense:e.defense,gold:e.gold,xp:e.xp,elapsed:e.elapsed,attackTimer:e.attackTimer,freeze:e.freeze})||!Array.isArray(e.dots))return fail('敵人戰鬥狀態不合法');}if(!bounded(s.settings.autoDismantle,0,4)||typeof s.autoPotion.enabled!=='boolean'||!Number.isFinite(s.autoPotion.hp)||s.autoPotion.hp<0||s.autoPotion.hp>1||!Number.isFinite(s.autoPotion.mp)||s.autoPotion.mp<0||s.autoPotion.mp>1)return fail('補給或分解設定不合法');if(s.heroes.length<1||s.heroes.length>40||s.inventory.length>700)return fail('名冊或背包容量不合法');for(const h of s.heroes){if(!Number.isFinite(h.hp)||!Number.isFinite(h.mp)||!Number.isFinite(h.xp)||!Number.isFinite(h.investment.gold)||h.investment.gold<0||!Number.isFinite(h.investment.books)||h.investment.books<0||!positiveMap(h.investment.materials,Object.keys(D.materials))||h.cooldowns.some(v=>!Number.isFinite(v)||v<0)||h.legend&&!D.legends.some(v=>v.id===h.legend))return fail('英雄養成或身份資料不合法');}const extra=ext()?.validate?.(s);if(extra&&!extra.ok)return extra;return basic;}catch(error){return fail('存檔欄位不完整：'+error.message);}}
  function validateSave(s){
    const complete=validateComplete(s);if(!complete.ok)return complete;
    try{
      const nonnegative=v=>Number.isFinite(v)&&v>=0;
      const fields=(object,keys)=>keys.every(key=>nonnegative(object[key]));
      if(!nonnegative(s.kingdom.xp)||!fields(s.stats,['kills','goldEarned','recruits','upgrades','enhances','bossKills','dailyBossKills','breakthroughs','stars','materials','gems','stages','heroLevels','maxHeroLevel','maxItemStars']))return fail('王國經驗或必要統計欄位不完整');
      if(!fields(s.hunting,['elapsed','focusSeconds','losses'])||!fields(s.progress,['totalStages'])||!nonnegative(s.autoPotion.nextAt))return fail('戰鬥或補給計時欄位不完整');
      if(!fields(s.consumables,['hp','mp','attack','gold','xp','hourglass','goldBag'])||!fields(s.buffs,['attack','gold','xp','hourglass']))return fail('補給與效果期限欄位不完整');
      if(!Number.isInteger(s.gameplaySeed)||s.gameplaySeed<1||s.gameplaySeed>4294967295||typeof s.worldSeed!=='string'||![1,2].includes(s.generationVersion))return fail('世界或遊戲生成資料不完整');
      for(const h of s.heroes){
        if(typeof h.name!=='string'||!h.name.trim()||h.name.length>24||!nonnegative(h.attackTimer)||typeof h.status!=='object'||Array.isArray(h.status)||Object.values(h.status).some(v=>!nonnegative(v)))return fail('英雄名稱或戰鬥計時不合法');
      }
      const e=s.hunting.enemy;
      if(e&&(!nonnegative(e.mechanicTimer)||typeof e.id!=='string'||typeof e.name!=='string'||e.dots.some(dot=>!dot||typeof dot.key!=='string'||typeof dot.heroId!=='string'||!fields(dot,['remaining','timer','attack']))))return fail('敵人機制或持續傷害資料不完整');
      if(typeof s.hunting.report!=='object'||Array.isArray(s.hunting.report)||Object.values(s.hunting.report).some(row=>!row||!fields(row,['damage','healing'])))return fail('戰鬥報告數值不合法');
      // uid() shares one monotonic sequence across heroes, loot and events.
      // Accepting a rewound sequence would let the next recruit duplicate an owner ID.
      const identities=[...s.heroes,...s.inventory,...s.gems,...s.inventory.flatMap(it=>it.gems.filter(Boolean)),...s.events];
      const seen=new Set();
      for(const object of identities){
        if(typeof object.id!=='string'||seen.has(object.id))return fail('物件或事件識別碼重複');
        seen.add(object.id);
        const suffix=/^[A-Za-z]+-(\d+)$/.exec(object.id);
        if(suffix&&Number(suffix[1])>s.sequence)return fail('識別序號早於現有物件');
      }
      for(const entry of s.events)if(typeof entry.text!=='string'||typeof entry.type!=='string'||!nonnegative(entry.at))return fail('事件紀錄不完整');
      return complete;
    }catch(error){return fail('存檔欄位不完整：'+error.message);}
  }
  function migrate(s){const valid=validateSave(s);if(!valid.ok)return valid;if(s.generationVersion===1){s.generationVersion=2;s.hunting.field=null;}return ok('世界資料已更新');}
  const API={create,dispatch,tick,offline,validate:validateSave,migrate,heroStats,team,teamPower,addReward,rng,log,uid,makeHero,capacity,heroXP,kingdomXP,effectiveLevel,occupied,itemStats,enhanceCost,recruitCost,trainingCost,canAfford,spend,grantHeroXP,grantHeroXp:grantHeroXP,grantKingdomXP,makeItem,makeGem,receiveItem,enemyPreview,ascensionInfo,rewardMultipliers,dayKey,weekKey,elementMultiplier,dismantleReward};g.GameCore=API;if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof globalThis!=='undefined'?globalThis:this);
