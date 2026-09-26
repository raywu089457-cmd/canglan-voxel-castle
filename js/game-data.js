(function (g) {
  'use strict';
  const names = ['攻擊','防禦','生命','魔力','攻速','暴擊'];
  const keys = ['attack','defense','maxHp','maxMp','speed','crit'];
  const classRows = [
    ['swordsman','劍士','holy',[12,7,90,45,1.05,.05],[3.2,1.9,16,3,0,.001]],
    ['archer','弓手','thunder',[11,4,70,40,1.5,.12],[3,1.1,11,2.8,0,.0014]],
    ['mage','法師','fire',[18,2,52,75,.7,.08],[4.6,.6,8,5.2,0,.001]],
    ['assassin','刺客','dark',[15,3,60,45,1.35,.24],[3.8,.8,9,3,0,.0018]],
    ['knight','騎士','ice',[9,11,130,35,.8,.04],[2.5,2.7,21,2.4,0,0]],
    ['priest','牧師','nature',[12,6,82,65,.95,.06],[3,1.4,14,4.6,0,.001]]
  ];
  const skillRows = [
    ['蓄力猛擊',10,20,3.2,1,{}],['連斬',7,25,1.1,3,{}],['禦劍架式',14,30,0,0,{guard:6}],
    ['貫穿箭',9,18,2.5,1,{}],['三連箭',6,22,1.2,3,{}],['寒霜凍矢',11,26,1.4,1,{freeze:2.5}],
    ['火球術',9,25,3,1,{dot:3}],['連鎖閃電',12,30,1.05,4,{}],['冰霜新星',13,28,1.8,1,{freeze:3}],
    ['致命背刺',10,24,4.2,1,{guaranteedCrit:true}],['刀扇',12,26,.9,5,{}],['淬毒之刃',8,22,1.8,1,{dot:4}],
    ['聖光斬擊',9,22,2.6,1,{selfHeal:.3}],['橫掃千軍',11,26,1.25,3,{}],['嘲諷',12,25,0,0,{taunt:6}],
    ['聖裁',10,25,3.2,1,{}],['聖光連擊',11,28,.85,4,{}],['群體治療',12,30,0,0,{heal:.35}]
  ];
  const classes = {}, skills = [];
  classRows.forEach((row,ci)=>{
    const [id,name,element,base,growth]=row;
    classes[id]={id,name,element,base:Object.fromEntries(keys.map((k,i)=>[k,base[i]])),growth:Object.fromEntries(keys.map((k,i)=>[k,growth[i]])),skills:[]};
    for(let i=0;i<3;i++){
      const [skillName,cooldown,mp,mult,hits,effects]=skillRows[ci*3+i];
      const skill={id:id+'-'+i,classId:id,index:i,name:skillName,unlock:[5,15,25][i],cooldown,mp,mult,hits,...effects};
      classes[id].skills.push(skill);skills.push(skill);
    }
  });
  const materialNames={iron:'鐵礦石',herb:'藥草',leather:'獸皮',crystal:'魔水晶',ember:'餘燼石',frost:'寒霜晶',poison:'毒囊',void:'虛空碎片',myth:'神話殘片'};
  const zoneRows = [
    ['翠綠草原','nature','none',[
      ['綠史萊姆',64,7,1,6,7,'herb',.25],['草原野狼',88,10,2,8,9,'leather',.22],['哥布林斥候',104,11,2,8,10,'iron',.2],['毒蘑菇精',120,13,2,9,10,'herb',.3],['鐵牙山豬',136,14,3,10,11,'leather',.3],['哥布林王',80,9,2,7,8]]],
    ['幽暗森林','nature','poison',[
      ['夜蝙蝠',120,12,2,13,15,'herb',.25],['古樹精',210,16,7,17,20,'leather',.25],['巨型蜘蛛',165,17,4,15,19,'poison',.18],['暗影貓妖',180,18,4,18,22,'leather',.28],['幽光靈',240,21,5,20,24,'crystal',.2],['古樹王',150,13,4,14,17]]],
    ['灰燼洞穴','fire','shield',[
      ['洞穴巨鼠',232,17,4,23,29,'iron',.3],['灰燼哥布林',319,25,6,29,35,'iron',.3],['岩石巨魔',435,29,10,31,38,'crystal',.22],['熔岩幼蟲',348,32,7,34,42,'ember',.25],['洞穴巨熊',493,34,10,36,45,'leather',.3],['岩窟幼龍',290,21,6,26,32]]],
    ['烈焰火山','fire','lifesteal',[
      ['火蜥蜴',486,37,9,45,48,'ember',.3],['熔岩元素',702,51,13,54,58,'ember',.3],['炎魔',594,48,9,54,58,'crystal',.25],['火山毒蠍',756,44,12,59,62,'poison',.25],['焰尾蠑螈',918,58,15,68,72,'ember',.35],['焚天炎龍',540,34,10,45,48]]],
    ['冰封高原','ice','regen',[
      ['冰霜野狼',1560,64,16,89,70,'leather',.3],['雪人',2426,70,29,107,84,'frost',.3],['冰晶幽靈',2080,87,16,116,91,'frost',.3],['寒風鷹',1906,75,14,107,84,'crystal',.25],['冰岩魔像',3119,93,32,134,105,'frost',.35],['霜翼巨龍',1733,58,16,89,70]]],
    ['黃沙荒漠','dark','shock',[
      ['沙蠍',2599,97,23,148,115,'poison',.3],['木乃伊',4043,114,35,178,138,'void',.2],['沙蟲',4332,132,32,192,150,'crystal',.28],['禿鷹盜賊',3466,123,21,192,150,'leather',.3],['阿努比斯兵',4910,150,37,222,173,'void',.28],['法老王',2888,88,23,148,115]]],
    ['詛咒沼澤','dark','poison',[
      ['毒蟾蜍',4307,130,29,242,190,'poison',.35],['沼澤怨靈',6221,195,32,315,247,'void',.3],['瘟疫騎士',7656,208,58,339,266,'poison',.3],['鬼火',6699,221,26,339,266,'crystal',.3],['鱷巫師',8135,234,45,387,304,'void',.35],['沼澤魔后',4785,130,32,242,190]]],
    ['蒼穹之塔','thunder','shield',[
      ['石像鬼',9306,247,75,474,372,'crystal',.35],['雷鳥',10857,304,48,553,434,'crystal',.35],['元素使',11633,323,57,593,465,'myth',.15],['風魔像',13184,285,88,593,465,'crystal',.4],['奧術師',13959,361,53,672,527,'myth',.18],['蒼穹之王',7755,190,44,395,310]]],
    ['深淵裂谷','dark','lifesteal',[
      ['深淵小惡魔',12375,330,60,814,633,'void',.4],['虛空行者',17325,440,78,1036,805,'void',.4],['深淵獵犬',18563,468,84,1110,863,'ember',.35],['混沌法師',21038,495,78,1184,920,'void',.45],['深淵魔',24750,550,132,1332,1035,'myth',.25],['深淵領主',12375,275,60,740,575]]],
    ['神話之域','holy','shock',[
      ['墮天使',13200,520,98,1388,1248,'myth',.35],['泰坦兵卒',21600,720,197,1851,1664,'myth',.4],['古神信使',18000,680,107,1736,1560,'myth',.4],['星輝獸',20400,760,131,1967,1768,'myth',.45],['異形古神',25200,880,156,2198,1976,'myth',.5],['初代古神',12000,400,82,1157,1040]]]
  ];
  const zones=zoneRows.map(([name,element,mechanic,rows],zi)=>{
    const list=rows.map(([name,hp,attack,defense,gold,xp,material,drop],mi)=>({id:`z${zi+1}${mi===5?'boss':'m'+(mi+1)}`,name,hp,attack,defense,gold,xp,material:material||null,drop:drop||0}));
    return {id:zi+1,name,element,mechanic,monsters:list.slice(0,5),boss:list[5]};
  });
  const setRows=[
    ['wolf','獵狼',3,{attack:.13},{crit:.12},{attack:.04},{crit:.03},{attack:.06}],
    ['lava','熔岩',4,{attack:.17},{speed:.17},{attack:.04},{speed:.04},{attack:.07}],
    ['frost','冰霜',5,{hp:.21},{defense:.29},{hp:.06},{defense:.06},{hp:.09}],
    ['dragon','龍鱗',8,{attack:.17,defense:.17,hp:.17},{reduction:.17},{attack:.04,defense:.04,hp:.04},{reduction:.04},{attack:.06,defense:.06,hp:.06}],
    ['wind','獵風',6,{speed:.1},{crit:.17},{speed:.04},{crit:.04},{speed:.06}],
    ['phoenix','不死鳥',9,{hp:.17},{reduction:.17,killHeal:.17},{hp:.05},{reduction:.04},{hp:.08}]
  ];
  const sets=Object.fromEntries(setRows.map(([id,name,tier,p2,p4,t4,t8,t12])=>[id,{id,name,tier,personal:[{count:2,effects:p2},{count:4,effects:p4}],team:[{count:4,effects:t4},{count:8,effects:t8},{count:12,effects:t12}]}]));
  const recipeRows=[
    ['steel-sword','鋼鐵劍刃',2,'weapon',2,1,800,{iron:25}],['steel-armor','鋼鐵戰甲',2,'armor',2,1,700,{iron:20,leather:15}],
    ['fine-helmet','精鋼護盔',3,'helmet',2,2,2500,{iron:45,crystal:10}],['fine-boots','精鋼戰靴',3,'boots',2,2,2200,{leather:40,iron:20}],
    ['rune-sword','符文劍刃',4,'weapon',3,3,9000,{crystal:35,iron:30}],['rune-ring','符文指環',4,'ring',3,3,6000,{crystal:25,ember:10}],
    ['mithril-armor','秘銀戰甲',5,'armor',3,4,26000,{crystal:50,frost:25}],['mithril-necklace','秘銀項墜',5,'necklace',3,4,20000,{crystal:40,ember:20}],
    ['dragon-sword','龍骨劍刃',6,'weapon',4,5,80000,{ember:60,frost:40,crystal:30}],['star-armor','星隕戰甲',7,'armor',4,6,240000,{frost:80,poison:40,crystal:60}],
    ['void-charm','虛空護符',8,'charm',4,7,700000,{void:70,crystal:80}],['divine-sword','神裁劍刃',9,'weapon',5,8,2000000,{void:100,myth:30}],
    ['genesis-armor','創世戰甲',10,'armor',5,9,6000000,{myth:80,void:120}]
  ];
  const recipes=recipeRows.map(([id,name,tier,slot,minStars,unlock,gold,materials])=>({id,name,tier,slot,classId:slot==='weapon'?'swordsman':null,minStars,unlock,cost:{gold,materials}}));
  const affixes=Object.fromEntries([
    ['lifesteal','嗜血',.03,.004,.08],['bossDamage','獵手',.08,.01,.25],['critDamage','鋒銳',.10,.015,.35],['reflect','荊棘',.06,.008,.20],
    ['reduction','鐵壁',.04,.006,.15],['xp','學者',.06,.008,.20],['gold','貪婪',.06,.008,.20],['treasure','尋寶',.05,.008,.20]
  ].map(([id,name,base,growth,max])=>[id,{id,name,base,growth,max}]));
  const breakthroughs=[
    {level:10,cost:{gold:2500,materials:{iron:20,herb:15}}},{level:25,cost:{gold:12500,materials:{iron:40,herb:25,leather:15}}},
    {level:50,cost:{gold:62500,materials:{iron:60,herb:35,leather:30,crystal:10}}},{level:100,cost:{gold:312500,materials:{iron:80,herb:45,leather:45,crystal:20,ember:10}}},
    {level:150,cost:{gold:1562500,materials:{iron:100,herb:55,leather:60,crystal:30,ember:20,myth:5}}}
  ];
  const traditions=Object.fromEntries([
    ['hunting','狩獵','每級金幣與經驗 +5%'],['forging','鍛造','每級強化費用 −4%'],['commerce','商會','每級金幣特惠價格 −4%'],['academic','學術','每級技能威力 +3%'],['pioneer','開拓','每級王國經驗 +10%']
  ].map(([id,name,description])=>[id,{id,name,description,max:10}]));
  const legends=[['ayla','艾拉·晨星','swordsman'],['rain','雷恩·颶風','archer'],['mona','莫娜·灰燼','mage'],['vera','薇拉·影刃','assassin'],['odin','奧丁·冰壁','knight'],['celine','瑟琳·聖歌','priest'],['thorin','索林·岩心','knight'],['nyx','妮克絲·夜幕','mage']].map(([id,name,classId])=>({id,name,classId}));
  /* ------------------------------------------------------------------ world ring
     Shared by the simulation (pathfinding, engagement, aggro) and the renderer, so
     both sides always agree on where the ten zones and their arenas actually are. */
  const W=g.WorldMap||(typeof require==='function'?require('./world-map.js'):null);
  const RING_COUNT=W.zones.length,RING_RADIUS=W.radius,RING_ROAD=W.castle.junction[1],ZONE_Y=4;
  const ringAngle=i=>W.zones[i].yaw;
  const ring={
    count:RING_COUNT,radius:RING_RADIUS,road:RING_ROAD,zoneY:ZONE_Y,angle:ringAngle,
    positions:W.zones.map(z=>[z.x,z.z]),
    /* Arena-local XZ -> world XZ. Mirrors a render group at positions[i] rotated by angle(i). */
    toWorld(i,x,z){const a=ringAngle(i),c=Math.cos(a),s=Math.sin(a);return [ring.positions[i][0]+x*c+z*s,ring.positions[i][1]-x*s+z*c];},
    /* Courtyard exit, castle gate, causeway, then the ring road round to a zone gate. */
    approach(i){return W.routeTo(i+1).map(p=>p.slice());},
    /* Ring-road waypoints from one zone angle to another, always the same way round. */
    arc(from,to){return from===to?[]:W.routeBetween(from+1,to+1).map(p=>p.slice());},
    /* World XZ -> arena-local XZ. Inverse of toWorld. */
    toLocal(i,x,z){const a=ringAngle(i),c=Math.cos(a),s=Math.sin(a),dx=x-ring.positions[i][0],dz=z-ring.positions[i][1];return [dx*c-dz*s,dx*s+dz*c];}
  };
  /* ------------------------------------------------------------------ arena field
     Walkable footprint, obstacles, party slots and monster home of one arena. The
     renderer draws exactly these obstacles and the pathfinder blocks exactly these
     obstacles, so the picture and the navigation can never disagree. */
  const FIELD_HALF=[17,11],FIELD_CORNER=[13,8],FIELD_GATE=[0,-13],FIELD_FOE=[0,2];
  /* A 5-unit ring around the monster's post, spread across its front arc, so everyone
     who arrives can actually reach it without standing inside its model. */
  const FIELD_SLOTS=[[-4.5,1.9],[-2.1,-.6],[1.3,-.8],[4.1,-.8],[5,2.5]];
  const FIELD_ASSEMBLY=[[-3.6,-6],[3.6,-6],[0,-9.4],[-5.4,-9.4],[5.4,-9.4]];
  function fieldProps(zone){
    const props=[];
    for(let k=0;k<4;k++){const x=-13+k*8;
      if([1,2,5].includes(zone))props.push({x,z:9,r:2.6,kind:'tree'});
      else if([3,9].includes(zone))props.push({x,z:8,r:2.6,kind:'spire'});
      else if(zone===4)props.push({x,z:9,r:3,kind:'lava'});
      else if(zone===6)props.push({x,z:9,r:3,kind:'dune'});
      else if(zone===7){props.push({x,z:9,r:2.4,kind:'tree'});props.push({x,z:-8,r:2.4,kind:'pool'});}
      else props.push({x,z:9,r:2.6,kind:'tower'});
    }
    return props;
  }
  function fieldLayout(zone){
    const props=fieldProps(zone);
    return {zone,half:FIELD_HALF,corner:FIELD_CORNER,gate:FIELD_GATE,foe:FIELD_FOE,slots:FIELD_SLOTS,assembly:FIELD_ASSEMBLY,props,
      /* The gate corridor, plus the arena rectangle minus its cut corners minus the props. */
      walkable(x,z){
        const corridor=z>=-14.5&&z<=-FIELD_HALF[1]&&Math.abs(x)<=5;
        if(!corridor){
          if(Math.abs(x)>FIELD_HALF[0]||Math.abs(z)>FIELD_HALF[1])return false;
          if(Math.abs(x)>FIELD_CORNER[0]&&Math.abs(z)>FIELD_CORNER[1])return false;
        }
        for(const p of props)if(Math.hypot(x-p.x,z-p.z)<p.r)return false;
        return true;
      }};
  }
  zones.forEach((z,i)=>{z.field=fieldLayout(i+1);});
  const data={classes,classList:Object.values(classes),skills,zones,ring,fieldLayout,materials:materialNames,statNames:Object.fromEntries(keys.map((k,i)=>[k,names[i]])),
    elements:{holy:'聖',thunder:'雷',fire:'火',dark:'暗',ice:'冰',nature:'自然'},rarities:['普通','高級','稀有','史詩','傳說','神話'],starMultipliers:[1,1.15,1.35,1.6,1.9,2.3],equipmentMultipliers:[1,1.25,1.5,2,2.5,3.2],
    slots:[['weapon','武器'],['helmet','頭盔'],['armor','鎧甲'],['boots','靴子'],['necklace','項鍊'],['ring','戒指'],['charm','護符']].map(([id,name])=>({id,name})),
    sets,recipes,affixes,breakthroughs,traditions,legends,
    gemTypes:{red:{id:'red',name:'紅寶石',stat:'attack'},blue:{id:'blue',name:'藍寶石',stat:'defense'},green:{id:'green',name:'綠寶石',stat:'maxHp'},yellow:{id:'yellow',name:'黃寶石',stat:'crit'}},
    difficulties:[{id:0,name:'普通',multiplier:1,zone:1},{id:1,name:'困難',multiplier:1.8,zone:3},{id:2,name:'地獄',multiplier:3.2,zone:5},{id:3,name:'夢魘',multiplier:5.5,zone:7}],
    mechanicNames:{none:'無',poison:'劇毒：每 4 秒造成 3% 最大生命',shield:'護盾：前 8 秒承伤減半',lifesteal:'吸血：普攻回復傷害的 60%',regen:'再生：半血以下每秒回復 0.8%',shock:'全體衝擊：每 8 秒造成 60% 攻擊傷害'},
    supplements:['未載明的分解金幣補定為 floor(20 × 階数 × 星級 × (1 + 強化/5))，不返還額外培養費。','通用素材池補定為當區可掉素材與鐵礦／藥草，基率 12%。','普通裝備階數等於目前區域，普通寶石階數為 ceil(區域/2)。']};
  g.GameData=data;
  if(typeof module!=='undefined'&&module.exports)module.exports=data;
})(typeof globalThis!=='undefined'?globalThis:this);
