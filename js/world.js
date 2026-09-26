/* 蒼嵐堡 — deterministic presentation. No gameplay mutation or gameplay RNG. */
(function (global) {
  'use strict';
  const D=global.GameData;
  const W=global.WorldMap;
  const ANCHORS = {castle:[0,4,-8],tavern:[-24,4,48],warehouse:[25,4,48],market:[-28,4,36],training:[-59,4,2],forge:[-59,4,-24],potion:[-59,4,-38],gem:[31,4,-8],library:[-32,4,-30],altar:[25,4,-28]};
  const MILESTONES={castle:[20,40],tavern:[10,20],warehouse:[17,34],training:[14,27],forge:[14,27],potion:[14,27],gem:[14,27],market:[4,7],library:[14,27],altar:[10,20]};
  const ENTRIES={gold:[-12,4.8,86],xp:[-24,4.8,86],materials:[-36,4.8,86],arena:[20,4.8,86],king:[33,4.8,86],labyrinth:[-50,4.8,85],commission:[-49,4.8,48],worldBoss:[49,4.8,85],tower:[57,4.8,85],abyss:[-60,4.8,85],guild:[18,4.18,10],quests:[-8,4.18,41],collections:[-18,4.18,10]};
  const COLORS = {stone:0xb6ad94,stoneDark:0x756f62,roof:0x344a63,wood:0x67462f,metal:0x849395,banner:0x963e43,leaf:0x406b48,grass:0x718358,path:0xaa9877,water:0x386f81,light:0xffc66f,earth:0x81624c,rock:0x67685f,trunk:0x654833,snow:0xd2e1e1,ice:0x78bacb,lava:0xde693b,sand:0xc8ad76,void:0x645280,myth:0xd5bf80,skin:0xd9b18c,cloth:0xe2d5b3,dark:0x2c3540,redSand:0xb37a5b,terracotta:0x9f735e,mud:0x555d4a,mycelium:0x877d8d,sculk:0x384c55,gravel:0x92918b,packedIce:0x92b4c4,cactus:0x53715a};
  const CLASS = {swordsman:{color:0x577b8f,accent:0xd5c99c,weapon:'sword'},archer:{color:0x558163,accent:0xd0af65,weapon:'bow'},mage:{color:0x855f92,accent:0xe4aa6c,weapon:'staff'},assassin:{color:0x42475e,accent:0xb97078,weapon:'daggers'},knight:{color:0x8b9d9c,accent:0x597d92,weapon:'shield'},priest:{color:0xd5c8a7,accent:0x88b991,weapon:'staff'}};
  const BIOMES = [
    {name:'翠綠草原',floor:'grass',edge:'earth',leaf:'leaf',sky:0xd8dfd5,accent:0xb6c18d},
    {name:'幽暗森林',floor:'grass',edge:'earth',leaf:'leaf',sky:0xabbcac,accent:0x668a6e},
    {name:'灰燼洞穴',floor:'rock',edge:'stoneDark',leaf:'ice',sky:0xa7b6b9,accent:0x70b7b7},
    {name:'烈焰火山',floor:'rock',edge:'stoneDark',leaf:'lava',sky:0xb2a294,accent:0xe79555},
    {name:'冰封高原',floor:'snow',edge:'rock',leaf:'snow',sky:0xc8dae1,accent:0x81b9d1},
    {name:'黃沙荒漠',floor:'sand',edge:'earth',leaf:'sand',sky:0xe0d1b5,accent:0xd8ba73},
    {name:'詛咒沼澤',floor:'grass',edge:'earth',leaf:'void',sky:0xb5bfa8,accent:0x8bab72},
    {name:'蒼穹之塔',floor:'stone',edge:'rock',leaf:'ice',sky:0xc8d8df,accent:0xa8c5d2},
    {name:'深淵裂谷',floor:'stoneDark',edge:'rock',leaf:'void',sky:0xa5a2b7,accent:0xa78ccc},
    {name:'神話之域',floor:'stone',edge:'rock',leaf:'myth',sky:0xddd9c8,accent:0xddc37f}
  ];
  function hash(value) { let h=2166136261; for(const c of String(value))h=Math.imul(h^c.charCodeAt(0),16777619); return h>>>0; }
  function rand(x,z,s=0) { let h=Math.imul((x*997)|0,374761393)^Math.imul((z*991)|0,668265263)^s;h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967296; }
  function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
  function block(a,x,y,z,sx=1,sy=1,sz=1,c='stone',shade=1,part='body'){a.push({x,y,z,sx,sy,sz,c,shade,part});}
  function tree(a,x,y,z,scale=1,kind='leaf',seed=0) {
    block(a,x,y+2.4*scale,z,.75*scale,4.8*scale,.75*scale,'trunk');
    for(let i=0;i<3;i++){const size=(4.6-i*.8)*scale;block(a,x+(i===1?.5:0)*scale,y+(4+i*1.1)*scale,z,size,2*scale,size,kind,.88+rand(x,z,seed+i)*.2);}
  }
  function roof(a,cx,y,cz,w,d,mat='roof') {for(let k=0;k<Math.ceil(w/2)+1;k++){let span=Math.max(.8,w-k*2);block(a,cx,y+k*.8,cz,span,.8,d+1,mat,1-k*.015);}}
  function house(a,x,z,w,d,h,roofMat='roof',wall='stone') {
    const y=4.16; block(a,x,y+.25,z,w+1,.5,d+1,'stoneDark');
    block(a,x,y+h/2,z,w,h,d,wall);block(a,x,y+h*.64,z+d/2+.02,1.5,h*.66,.12,'wood');
    for(const dx of [-w/2+.4,w/2-.4]){block(a,x+dx,y+h/2,z+d/2+.09,.3,h,.3,'wood');block(a,x+dx,y+h*.65,z+d/2+.2,.62,.92,.18,'light');}
    block(a,x,y+h-.25,z,w+.25,.32,d+.25,'wood');roof(a,x,y+h+.25,z,w+1,d,roofMat);
  }
  function facilityBlocks(id,level) {
    const a=[],p=ANCHORS[id],x=p[0],z=p[2],milestones=MILESTONES[id],stage=level?1+Number(level>=milestones[0])+Number(level>=milestones[1]):0;
    if(id==='castle'){
      if(!level)return a;
      for(let i=0;i<1+(level-1)%6;i++)block(a,-2.5+i,11.6,2.58,.36,.5,.16,'myth');
      if(stage>=2)for(const dx of[-12.6,12.6]){block(a,dx,19,-3,.3,9,.3,'wood');block(a,dx,20.5,-2.8,2.2,4,.16,'banner');block(a,dx,20.8,-2.67,.65,1.2,.12,'myth');}
      if(stage>=3)for(const dx of[-7,7]){block(a,dx,35,2.5,1.2,.5,1.2,'myth');block(a,dx,36,2.5,.45,1.6,.45,'light');}
      return a;
    }
    const w=['training','market','altar'].includes(id)?7:7,d=['library','gem','forge'].includes(id)?9:6;
    if(!level){
      block(a,x,4.21,z,w+1,.24,d+1,'earth',.95);
      for(const dz of [-d/2,d/2])block(a,x,4.48,z+dz,w+1,.42,.5,'stoneDark');
      for(const dx of [-w/2,w/2])block(a,x+dx,4.48,z,.5,.42,d,'stoneDark');
      for(const dx of [-w/2,w/2])block(a,x+dx,5.5,z+d/2,.23,2.5,.23,'wood');
      block(a,x,6.2,z+d/2,w+.2,.58,.2,'wood');
      block(a,x,5.55,z+d/2+.17,1.4,.9,.14,'cloth');
      for(let k=0;k<3;k++)block(a,x-w/3+k*.9,4.6,z-1,.65,.72,1.9,'stone',.8+k*.08);
      return a;
    }
    if(id==='training'){
      block(a,x,4.3,z,8,.3,10,'path');
      for(const dx of [-2.3,2.3]){block(a,x+dx,5.6,z-2,.3,2.8,.3,'wood');block(a,x+dx,6.1,z-2,1.7,1.7,.32,'cloth');block(a,x+dx,6.1,z-1.81,.65,.65,.15,'banner');}
      block(a,x,5.4,z+2,.55,2.4,.55,'wood');block(a,x,6.2,z+2,2.8,.42,.45,'wood');block(a,x,7,z+2,.8,.8,.8,'cloth');
      for(let k=0;k<stage+1;k++)block(a,x-3+k,5.7,z+3,.12,2.8,.15,'metal');
      if(stage>=2){block(a,x,4.5,z-3.5,5,.6,1.4,'wood');block(a,x,5.1,z-3.5,5,.3,1.4,'cloth');}
      if(stage>=3)for(const dx of[-3.7,3.7]){block(a,x+dx,6.5,z,.2,5,.2,'wood');block(a,x+dx,8,z,1.4,2,.15,'banner');}
    } else if(id==='market'){
      for(const dx of [-2.5,2.5]){for(const dz of [-2,2])block(a,x+dx,6,z+dz,.35,4,.35,'wood');}
      for(let k=-3;k<=3;k++)block(a,x+k,8.5-Math.abs(k)*.27,z,1,.4,5.4,k%2?'cloth':'banner');
      block(a,x,5.1,z+1.3,6,1.8,1.9,'wood');
      ['herb','fruit','grain'].forEach((_,i)=>{block(a,x-2+i*2,6.2,z+1.4,1.6,.4,1.3,'wood');for(let j=0;j<3;j++)block(a,x-2.5+i*2+j*.5,6.6,z+1.4,.5,.5,.6,['leaf','banner','sand'][i]);});
      if(stage>=2){block(a,x-3,5.1,z-1.5,1.1,2,1.8,'wood');block(a,x-3,6.25,z-1.5,1.2,.2,1.9,'myth');}
      if(stage>=3){block(a,x,9.1,z,.18,2,.18,'wood');block(a,x+.8,9.5,z,1.6,1,.15,'banner');}
    } else if(id==='altar'){
      for(let k=0;k<3;k++)block(a,x,4.25+k*.42,z,8-k*1.4,.42,8-k*1.4,'stone');
      for(const dx of [-2.6,2.6])for(const dz of [-2.6,2.6]){block(a,x+dx,6.7,z+dz,.85,4.8,.85,'stoneDark');block(a,x+dx,9.25,z+dz,1.3,.45,1.3,'myth');}
      block(a,x,7,z,1.8,3.2,1.8,'ice');block(a,x,9,z,.9,1.2,.9,'light');
      block(a,x,5.8,z,3.1,.3,3.1,'myth');
      if(stage>=2)for(const dx of[-2.6,2.6])block(a,x+dx,9.7,z,.65,.45,6,'myth');
      if(stage>=3)for(const dz of[-2.6,2.6])block(a,x,10.1,z+dz,6,.45,.65,'myth');
    } else {
      const h=4.1+stage*.5;
      house(a,x,z,w,d,h,id==='tavern'?'banner':'roof',id==='warehouse'?'wood':'stone');
      if(id==='forge'){block(a,x+1.7,4.2+h+2.5,z-2,1.5,5,1.5,'stoneDark');block(a,x+1.7,6,z+d/2+1.2,2.5,2.5,2.5,'stoneDark');block(a,x+1.7,6,z+d/2+2.49,1.2,1.5,.08,'light');block(a,x-1.8,5.1,z+d/2+1.3,2,.6,1,'metal');block(a,x-1.8,4.65,z+d/2+1.3,1.1,.7,.7,'wood');}
      if(id==='tavern'){block(a,x-w/2-.5,7.8,z+d/2,.2,2,.2,'wood');block(a,x-w/2-1.1,7.1,z+d/2,1.25,1.25,.25,'wood');block(a,x-w/2-1.1,7.2,z+d/2+.18,.6,.65,.2,'light');for(const dx of [-1.8,1.8]){block(a,x+dx,4.9,z+d/2+1.3,1.1,1.4,1.1,'wood');block(a,x+dx,5.4,z+d/2+1.3,1.22,.12,1.22,'metal');}}
      if(id==='warehouse'){for(let i=0;i<5+stage;i++){block(a,x-3+(i%4)*1.6,4.8+Math.floor(i/4)*1.3,z+d/2+1.2,1.3,1.3,1.3,'wood',.9+i*.025);block(a,x-3+(i%4)*1.6,4.8+Math.floor(i/4)*1.3,z+d/2+1.87,1.35,.18,.1,'metal');}}
      if(id==='potion'){for(let i=0;i<3;i++){block(a,x-2+i*2,5.9,z+d/2+.45,.85,1.25,.8,['ice','banner','leaf'][i]);block(a,x-2+i*2,6.7,z+d/2+.45,.35,.45,.35,'wood');}block(a,x-2.5,4.4,z-1,1.8,.45,3,'leaf');}
      if(id==='gem'){for(let i=0;i<3;i++){block(a,x-1.8+i*1.8,5.4+i*.35,z+d/2+1.1,.8,1.3+i*.4,.8,['ice','void','myth'][i]);block(a,x-1.8+i*1.8,4.55,z+d/2+1.1,1.5,.5,1.5,'stoneDark');}}
      if(id==='library'){block(a,x,6.3,z+d/2+.3,2.8,2.6,.35,'wood');for(let i=0;i<6;i++)block(a,x-1.05+i*.42,6.4,z+d/2+.55,.28,1.6,.25,['banner','roof','cloth'][i%3]);}
      if(stage>1)for(const dx of [-w/2,w/2]){block(a,x+dx,7,z+d/2+.35,.7,2.8,.13,'banner');block(a,x+dx,7.2,z+d/2+.45,.23,.8,.15,'myth');}
    }
    // A small brass entrance strip unifies the facility family.
    block(a,x,4.35,z+d/2+1,3.5,.18,1,'path');
    // Active window lanterns change at every level; larger silhouettes follow each building's own range.
    for(let i=0;i<1+(level-1)%6;i++)block(a,x-1.5+i*.6,4.67,z+d/2+1.2,.24,.42,.22,'light');
    return a;
  }

  function heroModel(classId,stars=2,visitor=false,hero=null) {
    const a=[],c=CLASS[classId]||CLASS.swordsman,col=c.color;
    block(a,0,2.14,0,.95,1.05,.61,col);block(a,0,1.67,0,1.01,.16,.7,'wood');
    block(a,0,3.1,0,.85,.86,.77,'skin',1,'head');block(a,0,3.56,-.04,.9,.22,.84,'wood',.8,'head');
    block(a,-.21,3.17,.405,.12,.12,.08,'dark',1,'head');block(a,.21,3.17,.405,.12,.12,.08,'dark',1,'head');
    for(const [side,part]of[[-1,'leftArm'],[1,'rightArm']]){block(a,side*.73,2.24,0,.4,.81,.46,col,1,part);block(a,side*.73,1.82,.04,.36,.36,.4,'skin',1,part);}
    for(const [side,part]of[[-1,'leftLeg'],[1,'rightLeg']]){block(a,side*.28,.94,0,.42,1.12,.49,'dark',1,part);block(a,side*.28,.27,.14,.5,.34,.74,'wood',.78,part);}
    block(a,0,2.24,-.38,1.12,1.5,.17,c.accent);block(a,0,1.46,-.48,1.15,.28,.22,c.accent);
    if(['knight','swordsman'].includes(classId)){block(a,0,3.5,0,1.02,.5,.93,'metal',1,'head');block(a,0,3.81,0,.22,.32,.65,c.accent,1,'head');}
    if(classId==='knight'){for(const side of[-1,1])block(a,side*.77,2.71,0,.7,.45,.85,'metal',1,side<0?'leftArm':'rightArm');block(a,-1.02,2.08,.4,.22,1.75,1.3,c.accent,1,'leftArm');}
    if(classId==='mage'){block(a,0,3.65,0,1.28,.2,1.08,col,1,'head');block(a,0,4,0,.72,.58,.7,col,1,'head');block(a,0,4.39,0,.35,.3,.35,col,1,'head');}
    if(classId==='priest'){block(a,0,3.61,-.08,.94,.27,.82,c.accent,1,'head');block(a,0,3.78,.05,.28,.22,.28,'myth',1,'head');}
    if(classId==='archer'||classId==='assassin'){block(a,0,3.58,-.09,1,.29,.98,col,1,'head');block(a,0,3.21,-.42,1,.8,.25,col,1,'head');}
    if(c.weapon==='sword'||c.weapon==='shield'){block(a,.77,2.25,.54,.16,1.9,.18,'metal',1,'rightArm');block(a,.77,1.56,.54,.64,.14,.22,'myth',1,'rightArm');block(a,-.83,2.08,.4,.2,1.3,1.05,c.accent,1,'leftArm');block(a,-.95,2.08,.4,.12,.8,.68,'metal',1,'leftArm');}
    if(c.weapon==='bow'){for(let i=0;i<5;i++)block(a,-.81,1.6+i*.33,.55+Math.sin(i/4*Math.PI)*.35,.14,.36,.15,'wood',1,'leftArm');block(a,-.82,2.2,.5,.08,1.7,.06,'cloth',1,'leftArm');block(a,.72,2.12,.6,.1,.1,1.65,'wood',1,'rightArm');}
    if(c.weapon==='staff'){block(a,.8,2.1,.45,.15,3.8,.15,'wood',1,'rightArm');block(a,.8,4.13,.45,.61,.7,.61,classId==='priest'?'myth':'ice',1,'rightArm');}
    if(c.weapon==='daggers')for(const[side,part]of[[-1,'leftArm'],[1,'rightArm']]){block(a,side*.77,1.9,.64,.16,.2,1.25,'metal',1,part);block(a,side*.77,1.9,.16,.5,.18,.18,c.accent,1,part);}
    if(stars>=5&&!visitor)block(a,0,2.37,.4,.38,.35,.12,'myth');
    if(hero?.legend){const legendId=typeof hero.legend==='string'?hero.legend:hero.legend.id||hero.legend.name,legendIndex=['ayla','rain','mona','vera','odin','celine','thorin','nyx'].indexOf(legendId),emblem=legendIndex>=0?legendIndex:hash(legendId),height=.35+(emblem%4)*.12;
      block(a,0,3.95,-.12,.28,height,.28,'myth',1,'head');block(a,-.73,2.66,0,.72,.35,.7,emblem%2?'ice':'myth',1,'leftArm');
      for(let i=0;i<1+emblem%3;i++)block(a,-.35+i*.35,2.58,-.5,.16,.6,.14,'myth');
    }
    if(hero?.equipment?.armor)block(a,0,2.2,.37,.83,.9,.18,'metal');
    if(hero?.equipment?.helmet)block(a,0,3.6,-.04,1.05,.25,.98,'metal',1,'head');
    if(hero?.artifact)block(a,0,2.45,.52,.32,.38,.23,'ice');
    return a;
  }
  function enemyFamily(name,zone,boss) {
    if(/龍|龙/.test(name))return 'dragon';
    if(/古神|巨神/.test(name))return 'eldritch';
    if(/樹|树/.test(name))return 'tree';
    if(/蘑菇/.test(name))return 'mushroom';
    if(/狼|犬|豹|狐|獅|狮|獸|兽|豬|猪|熊|鼠|貓|猫/.test(name))return 'beast';
    if(/蝙|鳥|鸟|鷹|鹰|蝶|蜂|翼|天使|石像鬼/.test(name))return 'wing';
    if(/蛛|蠍|蝎|蟹/.test(name))return 'spider';
    if(/蟲|虫|蜥|蠑|蟾|鱷/.test(name))return 'crawler';
    if(/幽|靈|灵|魂|鬼火|元素$/.test(name))return 'spirit';
    if(/史萊|史莱|黏|軟|软|水母/.test(name))return 'slime';
    if(/石|岩|魔像|傀儡|巨人|巨靈|雪人|泰坦/.test(name))return 'golem';
    if(/骷|骨|衛|卫|兵|盜|盗|騎|骑|巫|法|影|惡魔|恶魔|哥布林|乃伊|元素使|奧術|炎魔|魔后|之王|行者|淵魔|領主/.test(name))return 'humanoid';
    return boss?'golem':['slime','beast','spider','golem','beast','spider','slime','humanoid','wing','dragon'][(zone-1)%10];
  }
  function enemyModel(name,zone=1,boss=false,elite=false) {
    const a=[],fam=enemyFamily(name,zone,boss),b=BIOMES[(zone-1)%10],col=boss?b.accent:COLORS[b.leaf],accent=zone===4?COLORS.lava:zone===9?0xd1a0c9:0xe2bc6d;
    if(fam==='tree'||fam==='mushroom'){
      const mushroom=fam==='mushroom';block(a,0,1.7,0,mushroom?1.1:1.65,3.3,1.2,mushroom?'cloth':'trunk');
      for(const side of[-1,1]){block(a,side*.5,.4,.3,.75,.65,1.3,'trunk',.85,side<0?'leftLeg':'rightLeg');block(a,side*1.25,1.8,0,1.3,.55,.5,mushroom?'cloth':'trunk',1,side<0?'leftArm':'rightArm');block(a,side*.34,2.3,.67,.2,.25,.12,'light');}
      if(mushroom){block(a,0,3.2,0,3.9,.65,3.5,'banner');block(a,0,3.8,0,2.9,.65,2.7,'banner');block(a,0,4.26,0,1.8,.28,1.7,'banner');for(let k=0;k<5;k++)block(a,-1.2+k*.6,3.92,.5, .3,.5,.4,'cloth');}
      else{for(let k=0;k<3;k++)block(a,k===1?.6:0,3.3+k*.68,0,3.8-k*.65,1.4,3.3-k*.55,'leaf',.85+k*.09);}
    }else if(fam==='crawler'){
      for(let i=0;i<4;i++){block(a,0,.63+i*.14,-1.8+i,1.25+i*.12,1.15,1.4,col,.82+i*.06,i===3?'head':'body');for(const side of[-1,1])block(a,side*.9,.2,-1.8+i,.6,.28,.5,'dark',1,side<0?'leftLeg':'rightLeg');}
      for(const side of[-1,1]){block(a,side*.47,1.52,1.75,.23,.35,.25,'light',1,'head');block(a,side*.4,.69,2,.2,.6,.3,'cloth',1,'head');}
    }else if(fam==='spirit'){
      for(let k=0;k<4;k++)block(a,0,1+k*.66,0,.8+k*.38,.7,.7+k*.28,col,.9+k*.08,k>1?'head':'body');
      for(const side of[-1,1]){block(a,side*.4,2.5,.96,.2,.28,.14,'light',1,'head');block(a,side*1.35,1.75,0,.5,1.3,.5,col,1,side<0?'leftArm':'rightArm');}
      block(a,0,.45,0,.4,.7,.4,accent);
    }else if(fam==='eldritch'){
      block(a,0,2.2,0,2.4,3.3,1.8,'void');block(a,0,4.26,0,2.5,1.4,2.2,col,1,'head');block(a,0,4.3,1.18,1.3,.62,.15,'light',1,'head');block(a,0,4.3,1.3,.25,.55,.1,'dark',1,'head');
      for(const side of[-1,1]){for(let k=0;k<3;k++)block(a,side*(1.4+k*.6),3.2-k*.75,0,.75,1.2,.8,col,.9,side<0?'leftArm':'rightArm');block(a,side*.7,.4,.3,.9,.8,1.1,'stoneDark',1,side<0?'leftLeg':'rightLeg');block(a,side*.9,5.5,0,.5,1.2,.6,'myth',1,'head');}
    }else if(fam==='slime'){
      block(a,0,.7,0,2.8,1.25,2.45,col);block(a,0,1.6,0,2.1,.9,1.9,col,1.1);block(a,0,2.15,0,1.2,.3,1.1,col,1.2);
      for(const s of[-1,1])block(a,s*.5,1.65,1.02,.26,.36,.14,'dark');block(a,0,1.14,1.26,.5,.12,.1,'dark');
    }else if(fam==='beast'){
      block(a,0,1.55,-.3,1.7,1.3,2.8,col);block(a,0,2.02,1.06,1.6,1.2,1.4,col,1.05,'head');block(a,0,1.8,1.97,1,.62,.77,'cloth',.72,'head');
      for(const s of[-1,1]){block(a,s*.55,2.93,.98,.38,.75,.42,col,1,'head');block(a,s*.8,2.22,1.64,.13,.23,.26,'light',1,'head');for(const k of[-1,1])block(a,s*.57,.58,k*.93,.52,1.15,.58,col,.8,s===k?'leftLeg':'rightLeg');}
      block(a,0,1.83,-2.02,.45,.48,1.5,col,.8,'tail');
    }else if(fam==='spider'){
      block(a,0,1,0,2.1,1.4,2.1,col);block(a,0,1.13,1.24,1.4,.9,1,col,.82,'head');
      for(const s of[-1,1]){for(let i=0;i<4;i++){block(a,s*1.65,.82,-1.2+i*.8,1.5,.3,.3,'dark',1,s<0?'leftLeg':'rightLeg');block(a,s*2.3,.45,-1.2+i*.8,.3,.9,.3,'dark',1,s<0?'leftLeg':'rightLeg');}block(a,s*.38,1.35,1.8,.28,.24,.16,'light',1,'head');}
    }else if(fam==='wing'||fam==='dragon'){
      block(a,0,1.7,0,1.2,1.5,1.9,col);block(a,0,2.53,.92,1,1.1,1.25,col,1,'head');block(a,0,2.3,1.7,.62,.35,.7,accent,1,'head');
      for(const s of[-1,1]){for(let i=0;i<3;i++)block(a,s*(1.05+i*.7),2.1-i*.08,-.25,1,.25,2.1-i*.5,col,.85+i*.04,s<0?'leftArm':'rightArm');block(a,s*.37,2.68,1.56,.18,.18,.12,'light',1,'head');block(a,s*.35,.62,.35,.42,1.2,.48,'dark',1,s<0?'leftLeg':'rightLeg');}
      if(fam==='dragon'){for(let i=0;i<4;i++)block(a,0,1.4-i*.16,-1.3-i*.7,.65-i*.1,.6-i*.06,.95,col,1,'tail');for(const s of[-1,1])block(a,s*.37,3.37,.67,.28,.9,.34,'cloth',1,'head');}
    }else{
      const stone=fam==='golem';block(a,0,2.08,0,stone?2.4:1.25,1.9,stone?1.5:.8,col);block(a,0,3.65,.04,stone?1.65:1.04,stone?1.3:1,stone?1.3:.9,stone?'rock':'cloth',1,'head');
      for(const[s,arm,leg]of[[-1,'leftArm','leftLeg'],[1,'rightArm','rightLeg']]){block(a,s*(stone?1.6:.9),2.23,0,stone?.88:.48,1.65,stone?.9:.5,col,.87,arm);block(a,s*(stone?.68:.37),.64,0,stone?.83:.5,1.2,stone?.85:.6,'dark',1,leg);block(a,s*.38,3.8,.75,.23,.18,.12,'light',1,'head');}
      if(!stone){block(a,.93,2.27,.6,.16,2.8,.19,'metal',1,'rightArm');block(a,0,4.37,0,1.15,.4,1.02,col,1,'head');}
      else block(a,0,2.3,.81,.8,.7,.15,accent);
    }
    if(boss){block(a,0,4.7,0,.8,.55,.8,'myth',1,'head');}
    if(elite)for(const side of[-1,1])block(a,side*.95,2.5,.2,.45,.5,.55,'myth');
    // Named species retain a deterministic silhouette, markings, and proportions across reloads.
    const species=hash(name);for(let i=0;i<1+species%3;i++)block(a,-.45+i*.45,1.65, .91,.22,.2,.13,accent,1,'body');
    const broad=.9+(species%7)*.025,tall=.93+((species>>>4)%7)*.02;
    for(const v of a){v.x*=broad;v.sx*=broad;v.y*=tall;v.sy*=tall;}
    return {blocks:a,family:fam,scale:boss?1.7:1.15};
  }

  function create(options) {
    const T=global.THREE,canvas=options.canvas;
    if(!T||!canvas)throw new Error('體素世界缺少 THREE 或 canvas');
    const onSelect=options.onSelect||(()=>{}),onError=options.onError||(()=>{}),reducedQuery=matchMedia('(prefers-reduced-motion: reduce)');
    let disposed=false,state=null,api={},view='castle',hour=15,inspection=false,cutaway=false,autoOrbit=false,seed='94721',lastT=0,raf=0,frames=0,dirty=true,lastRender=0,builtSignature='',actorsSignature='',zonesSignature='',activeZoneSignature='',selected=null,lastEnemyHp=null,lastEnemyKey='',attackCursor=0,visibility=true;
    let reducedOverride=null,particleAmount=1,eventsInitialized=false,lastCombatEvent=null;
    let seenEvents=new Set();
    const motionReduced=()=>reducedOverride===null?reducedQuery.matches:reducedOverride;
    const scene=new T.Scene(),camera=new T.OrthographicCamera(-100,100,80,-80,.1,1200);
    scene.background=new T.Color(0xe3dfd2);
    const renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
    renderer.setPixelRatio(Math.min(devicePixelRatio||1,window.innerWidth<650?1.25:1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;renderer.localClippingEnabled=true;
    const unit=new T.BoxGeometry(1,1,1),material=new T.MeshLambertMaterial({vertexColors:false}),glow=new T.MeshBasicMaterial(),waterMaterial=new T.MeshPhongMaterial({shininess:65,specular:0x8caeb6}),proxyMaterial=new T.MeshBasicMaterial({visible:false}),outlineMaterial=new T.MeshBasicMaterial({color:0xe6bd67,transparent:true,opacity:.85,depthWrite:false});
    const sun=new T.DirectionalLight(0xffe6c5,2.3),hemi=new T.HemisphereLight(0xe7f1f2,0x7b6c54,2.4),fill=new T.DirectionalLight(0xa5c7db,.55);sun.position.set(-70,100,60);sun.castShadow=true;sun.shadow.mapSize.set(window.innerWidth<650?1024:2048,window.innerWidth<650?1024:2048);Object.assign(sun.shadow.camera,{left:-105,right:105,top:105,bottom:-105,near:1,far:360});sun.shadow.normalBias=.35;sun.shadow.bias=-.0003;sun.target.position.set(0,7,0);fill.position.set(60,55,-50);scene.add(sun,sun.target,hemi,fill);
    const castle=new T.Group(),facilities=new T.Group(),zones=new T.Group(),zoneGroups=[];scene.add(castle,facilities,zones);
    const dynamic=new T.InstancedMesh(unit,material,18000);dynamic.count=0;dynamic.instanceMatrix.setUsage(T.DynamicDrawUsage);dynamic.castShadow=false;dynamic.receiveShadow=true;dynamic.frustumCulled=false;scene.add(dynamic);
    const actorShadowMaterial=new T.MeshBasicMaterial({color:0x253129,transparent:true,opacity:.18,depthWrite:false});
    const actorShadows=new T.InstancedMesh(unit,actorShadowMaterial,40);actorShadows.count=0;actorShadows.instanceMatrix.setUsage(T.DynamicDrawUsage);actorShadows.frustumCulled=false;scene.add(actorShadows);
    const particles=new T.InstancedMesh(unit,glow,220);particles.count=0;particles.instanceMatrix.setUsage(T.DynamicDrawUsage);particles.frustumCulled=false;scene.add(particles);
    const selectRing=new T.Group();for(let i=0;i<4;i++){const bar=new T.Mesh(unit,outlineMaterial);bar.scale.set(i%2? .17:7.6,.14,i%2?7.6:.17);bar.position.set(i===1?3.8:i===3?-3.8:0,0,i===0?3.8:i===2?-3.8:0);selectRing.add(bar);}scene.add(selectRing);selectRing.visible=false;
    const dummy=new T.Object3D(),matrix=new T.Matrix4(),color=new T.Color(),raycaster=new T.Raycaster(),pointer=new T.Vector2(),proxies=[],actors=[],fx=[],listeners=[];
    const orbit={theta:.55,phi:.88,size:78,target:new T.Vector3(0,8,4)};
    const presets={overview:{theta:.55,phi:.88,size:115,target:[0,8,4]},top:{theta:0,phi:.07,size:103,target:[0,4,0]},gate:{theta:.1,phi:1.13,size:33,target:[0,11,64]},courtyard:{theta:.18,phi:.44,size:63,target:[0,4,40]},keep:{theta:.65,phi:.82,size:29,target:[0,25,-8]},ring:{theta:0,phi:.34,size:320,target:[0,4,0]}};
    function on(el,type,fn,opts){el.addEventListener(type,fn,opts);listeners.push(()=>el.removeEventListener(type,fn,opts));}
    function disposeGroup(group){while(group.children.length){const child=group.children.pop();child.traverse(obj=>{if(obj.isInstancedMesh)obj.dispose();if(obj.userData.ownedGeometry)obj.geometry.dispose();if(obj.userData.ownedMaterial)obj.material.dispose();});child.parent=null;}}
    function makeInstances(blocks,parent,name='blocks',chunkSize=0){
      const buckets=new Map();for(const b of blocks){const mat=b.c==='light'?'light':b.c==='water'?'water':'solid',key=mat+(chunkSize?':'+Math.floor(b.x/chunkSize)+','+Math.floor(b.z/chunkSize):'');if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(b);}
      for(const[key,items]of buckets){const mesh=new T.InstancedMesh(unit,key.startsWith('light')?glow:key.startsWith('water')?waterMaterial:material,items.length);mesh.name=name;mesh.userData.count=items.length;mesh.castShadow=!key.startsWith('light')&&!key.startsWith('water');mesh.receiveShadow=!key.startsWith('light');items.forEach((b,i)=>{dummy.position.set(b.x,b.y,b.z);const gap=b.c==='stone'||b.c==='stoneDark'?.988:1;dummy.scale.set(b.sx*gap,b.sy*gap,b.sz*gap);dummy.rotation.set(0,0,0);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);color.set(typeof b.c==='number'?b.c:COLORS[b.c]||COLORS.stone).multiplyScalar(b.shade==null?1:b.shade);mesh.setColorAt(i,color);});mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();parent.add(mesh);}
    }
    function proxy(kind,id,x,y,z,w,h,d,extra={}){const m=new T.Mesh(unit,proxyMaterial);m.position.set(x,y,z);m.scale.set(w,h,d);m.updateMatrixWorld();m.userData={kind,id:String(id),...extra};proxies.push(m);return m;}
    function cleanProxies(scope){for(let i=proxies.length-1;i>=0;i--)if(proxies[i].userData.scope===scope)proxies.splice(i,1);}
    function buildCastleScene(){
      disposeGroup(castle);const cast=global.buildCastle(hash(seed)),land=global.buildTerrain(hash(seed));
      for(const[name,rows]of Object.entries({...land.batches,...cast.batches})){
        const filtered=name==='courtyard'?rows.filter(b=>b[1]<4.4||(b[0]>-31&&b[0]<-23&&b[2]>41&&b[2]<49)):name==='nature'?rows.filter(b=>!Object.values(ENTRIES).some(p=>p[2]>45&&Math.abs(p[0]-b[0])<7&&Math.abs(p[2]-b[2])<6)):rows;
        const blocks=filtered.map(b=>({x:b[0],y:b[1],z:b[2],sx:b[3],sy:b[4],sz:b[5],c:b[6],shade:b[7]}));makeInstances(blocks,castle,name,64);
      }
      // Presentation clipping belongs to these meshes, not the shared default material.
      castle.traverse(m=>{if(m.isMesh&&['outer','inner'].includes(m.name)){m.material=m.material.clone();m.userData.ownedMaterial=true;}});
      applyCut();builtSignature='';renderer.shadowMap.needsUpdate=true;dirty=true;
    }
    function buildFacilities(){
      disposeGroup(facilities);cleanProxies('building');cleanProxies('challenge');const blocks=[];
      for(const id of Object.keys(ANCHORS)){const level=Number(state?.buildings?.[id]||0),p=ANCHORS[id];blocks.push(...facilityBlocks(id,level));
        proxy('building',id,p[0],id==='castle'?21:8,p[2],id==='castle'?21:9,id==='castle'?34:9,id==='castle'?20:9,{scope:'building',level});
      }
      buildEntries(blocks);
      makeInstances(blocks,facilities,'facilities',0);renderer.shadowMap.needsUpdate=true;dirty=true;
    }
    function buildEntries(a){
      for(const[id,[x,y,z]]of Object.entries(ENTRIES)){
        const outside=z>45,w=['arena','labyrinth','worldBoss'].includes(id)?9:6;
        if(outside)block(a,x,y-.48,z,w+.8,.85,6.6,'stoneDark');
        if(['gold','xp','materials'].includes(id)){const col=id==='gold'?'myth':id==='xp'?'ice':'leaf';for(const dx of[-2,2]){block(a,x+dx,y+2,z,.85,4,.9,'stone');block(a,x+dx,y+4.2,z,1.3,.4,1.2,col);}block(a,x,y+4.5,z,5.4,.75,1.2,'roof');block(a,x,y+.25,z,3,.35,2,col);block(a,x,y+3.7,z+.65,.8,.8,.16,col);}
        if(id==='arena'){for(let i=0;i<12;i++){const angle=i/12*Math.PI*2;block(a,x+Math.cos(angle)*4,y+.75,z+Math.sin(angle)*2.6,1.4,1.5,1.3,'stone');}block(a,x,y+.15,z,7,.25,3.5,'sand');for(const dx of[-4,4]){block(a,x+dx,y+3,z,.16,3,.16,'wood');block(a,x+dx,y+3.7,z,1.4,1.5,.13,'banner');}}
        if(id==='king')for(let i=0;i<3;i++){block(a,x-2.3+i*2.3,y+.4,z,1.8,.8,3,'stone');block(a,x-2.3+i*2.3,y+1,z,1.3,.4,1.6,'myth');}
        if(id==='labyrinth'){for(let i=0;i<3;i++){block(a,x-3+i*3,y+1,z-1,1,2,4,'rock');block(a,x-2+i*3,y+1,z+1,3,2,.7,'rock');}block(a,x,y+3,z-2,8,.8,1.1,'stone');}
        if(id==='commission'){for(let k=0;k<4;k++)block(a,x,y+.7+k*.65,z,5.5-k*1.3,.7,4.8,'cloth');for(const dx of[-2.6,2.6])block(a,x+dx,y+1.5,z+2.4,.2,3,.2,'wood');block(a,x+3,y+.7,z,1.5,1.4,2,'wood');}
        if(id==='worldBoss'){for(let k=0;k<3;k++)block(a,x,y+.25+k*.45,z,8-k*1.8,.5,5-k,'stoneDark');block(a,x,y+2.8,z-1,1.6,3.5,1.2,'void');block(a,x,y+4.8,z-1,2.3,.8,1.5,'myth');}
        if(id==='tower'){for(let k=0;k<4;k++){block(a,x,y+1+k*1.5,z,2.2-k*.25,1.4,2.2-k*.25,'stone');block(a,x,y+1.7+k*1.5,z,2.5-k*.25,.23,2.5-k*.25,['ice','lava','leaf','void'][k]);}roof(a,x,y+6.8,z,2.6,2.4);}
        if(id==='abyss'){for(const side of[-1,1])for(let k=0;k<3;k++)block(a,x+side*(1.6+k*.55),y+1+k*.8,z,.8,2+k,1.2,'void');block(a,x,y+.05,z,2.4,.15,4.5,'dark');for(let k=0;k<3;k++)block(a,x,y+.2+k*.3,z+2-k*.6,2,.3,.6,'stone');}
        if(id==='guild'){block(a,x,y+.35,z,6,.6,4,'stone');block(a,x,y+2,z-1,5,3.4,.8,'wood');for(let k=0;k<6;k++)block(a,x-2+k*.8,y+2.3,z-.5,.55,1.4,.2,['roof','leaf','banner','void','ice','cloth'][k]);block(a,x,y+1,z+1.3,4.3,1.3,1.7,'wood');}
        if(id==='quests'){for(const dx of[-1.8,1.8])block(a,x+dx,y+1.4,z,.3,2.8,.3,'wood');block(a,x,y+2.3,z,4,2,.3,'wood');for(let k=0;k<3;k++)block(a,x-1.2+k*1.2,y+2.4,z+.2,.8,1.2,.1,'cloth');}
        if(id==='collections'){block(a,x,y+.4,z,5,.8,3,'stone');for(let k=0;k<3;k++){block(a,x-1.6+k*1.6,y+1,z,.9,.5,.9,'wood');block(a,x-1.6+k*1.6,y+1.7,z,.55,1,.55,['ice','myth','void'][k]);}roof(a,x,y+3.2,z,5.4,3.4);for(const dx of[-2.3,2.3])block(a,x+dx,y+1.7,z-.9,.25,3.4,.25,'wood');}
        proxy('challenge',id,x,y+2,z,w,6,id==='king'?4:6,{scope:'challenge'});
      }
    }
    /* Ten dungeon zones arranged in a ring around the castle: zone i sits at
       angle (i/10)*2PI on radius RING_RADIUS and its local +Z axis points
       radially outward, so every arena reads as a petal facing the castle.
       Because all scene groups now stay visible, a "view" is nothing more
       than a camera placement - combat plays out on the same map. */
    /* The ring and the arena layouts are game data, shared with the simulation, so the
       renderer cannot disagree with the pathfinder about where anything is. */
    const ZONE_COUNT=D.ring.count,RING_RADIUS=D.ring.radius,RING_ROAD=D.ring.road,ZONE_Y=D.ring.zoneY;
    const zoneAngle=D.ring.angle,MAP_POS=D.ring.positions,zoneToWorld=D.ring.toWorld;
    const zoneLayout=i=>D.zones[i].field;
    function landmark(a,x,z,index,small=false){const s=small?.6:1,b=BIOMES[index],base=.36;
      if(index===0||index===1||index===4){for(let k=0;k<3;k++)tree(a,x-4+k*4,base,z-2-Math.abs(k-1)*2,s,index===4?'snow':'leaf',index*21+k);if(index===0){block(a,x,1.7,z+2,2.8,2.7,2.2,'stone');roof(a,x,3.1,z+2,3.2,2.6);}}
      else if(index===2){for(let i=0;i<5;i++){block(a,x-4+i*2,1+Math.sin(i)*.5,z,1,2+Math.abs(Math.sin(i))*2,1,'ice');}block(a,x,1.2,z-2,6,2.5,3,'rock');}
      else if(index===3){for(let k=0;k<4;k++)block(a,x,k*.8+.5,z,8-k*1.7,.8,7-k*1.5,'rock');block(a,x,3.7,z,1.8,.25,1.8,'lava');for(let k=0;k<4;k++)block(a,x+1+k*.8,.58,z+1+k,1.5,.2,1.8,'lava');}
      else if(index===5){for(let k=0;k<4;k++)block(a,x,.6+k*.8,z,7-k*1.6,.8,7-k*1.6,'sand');block(a,x+4,2,z-2,1.2,4,1.2,'stone');}
      else if(index===6){block(a,x,.42,z,7,.12,5,'water');tree(a,x-3,.4,z-2,.75,'void',23);for(let k=0;k<5;k++)block(a,x+k-2,.7,z+1,.8,.2,1.5,'wood');}
      else if(index===7){for(let k=0;k<3;k++){block(a,x,1+k*2.5,z,3-k*.5,2.5,3-k*.5,'stone');block(a,x,2.3+k*2.5,z,3.4-k*.5,.3,3.4-k*.5,'roof');}roof(a,x,8,z,2.8,2.4);}
      else if(index===8){for(const side of[-1,1])for(let k=0;k<3;k++)block(a,x+side*(2+k*.7),1+k*.8,z+k-1,1.5,2+k,1.8,'void');block(a,x,.5,z,1.2,.15,7,'void',1.3);}
      else{for(const dx of[-3,3])block(a,x+dx,3,z,1.3,6,1.3,'stone');block(a,x,6,z,7.5,1.1,1.5,'myth');block(a,x,3,z,.9,2.5,.9,'light');for(const dx of[-2,2])block(a,x+dx,4,z+3,1.8,.7,1.8,'stone');}
    }
    function zoneArena(a,zone,biome){
      for(let x=-17;x<=17;x+=2)for(let z=-11;z<=11;z+=2){if(Math.abs(x)>13&&Math.abs(z)>8)continue;const height=2+rand(x,z,hash(seed+zone))*2;block(a,x,-height/2-.25,z,2,height,2,biome.edge,.86+rand(x,z,zone)*.18);block(a,x,.02,z,2,.5,2,biome.floor,.96+rand(x,z,zone+100)*.18);}
      // A low kerb frames the arena against the plain.
      for(let x=-19;x<=19;x+=2)for(const z of[-13,13])if(z!==-13||Math.abs(x)>5)block(a,x,.14,z,2,.85,1.6,biome.edge,.78+rand(x,z,zone+7)*.14);
      for(let z=-13;z<=13;z+=2)for(const x of[-19,19])block(a,x,.14,z,1.6,.85,2,biome.edge,.78+rand(x,z,zone+9)*.14);
      // Obstacles are drawn from the shared layout, which is also what blocks navigation.
      for(const p of zoneLayout(zone-1).props){
        if(p.kind==='tree')tree(a,p.x,.27,p.z,.8,biome.leaf,zone+p.x);
        else if(p.kind==='spire'){block(a,p.x,1.7,p.z-.5,1.6,3.4,1.7,biome.leaf);block(a,p.x+1.3,1,p.z+.5,.9,2,.9,biome.leaf);}
        else if(p.kind==='lava'){block(a,p.x,.33,p.z-.5,3,.15,3,'lava');block(a,p.x,1.3,p.z+1.5,3,2.2,2,'rock');}
        else if(p.kind==='dune')for(let k=0;k<3;k++)block(a,p.x,.7+k*.55,p.z,4-k,.8,4-k,'sand');
        else if(p.kind==='pool')block(a,p.x,.31,p.z,3,.12,2,'water');
        else{block(a,p.x,2.4,p.z,1.6,4.8,1.6,'stone');block(a,p.x,4.9,p.z,2.5,.5,2.5,zone===10?'myth':'roof');}
      }
      // Zone gate on the castle-facing edge, plus a beacon over the zone we are hunting in.
      for(const dx of[-5,5]){block(a,dx,2.05,-13,.42,4.6,.42,'wood');block(a,dx,4.3,-13,1.5,1.5,.16,'banner');}
      block(a,0,4.3,-13,11.4,.34,.4,'wood');
      if(zone===clamp(Number(state?.hunting?.zone||1),1,10))for(let k=0;k<6;k++)block(a,0,5.2+k*1.7,-13,.72,.5,.72,'light');
      // Deliberate arena markers establish team and enemy sides without adding combat rules.
      for(const x of[-9,9])for(const z of[-7,7]){block(a,x,.35,z,.65,.2,.65,'path');}
    }
    function buildZones(){
      disposeGroup(zones);cleanProxies('zone');zoneGroups.length=0;
      const unlocked=state?.progress?.maxZone||1;
      MAP_POS.forEach((pos,i)=>{
        const biome=BIOMES[i],group=new T.Group();
        group.position.set(pos[0],ZONE_Y,pos[1]);group.rotation.y=zoneAngle(i);zones.add(group);zoneGroups.push(group);
        const a=[];
        zoneArena(a,i+1,biome);landmark(a,-16,16,i,true);
        if(i===8){
          // 深淵裂谷 carries the physical gate to the endless abyss.
          const rift=zoneToWorld(8,-16,16);
          for(const side of[-1,1]){block(a,-16+side*4.2,2.6,16,1.1,5.2,4.2,'void');block(a,-16+side*4.2,5.4,16,1.4,.6,4.6,'myth');}
          block(a,-16,.35,16,7.6,.3,3.4,'dark');
          for(let k=0;k<5;k++)block(a,-16,1.2+k*1.3,16,1.7,.6,2.4,'void',1.06);
          for(let k=0;k<4;k++)block(a,-16,6.1+k*1.6,16,.8,.6,.8,'light');
          proxy('challenge','abyss',rift[0],ZONE_Y+3.4,rift[1],11,8,11,{scope:'challenge'});
        }
        makeInstances(a,group,'zone'+(i+1),0);
        proxy('zone',i+1,pos[0],ZONE_Y+9,pos[1],26,14,26,{scope:'zone',locked:i+1>unlocked});
      });
      renderer.shadowMap.needsUpdate=true;dirty=true;
    }
    function makeActor(id,model,position,meta={}){
      const root=new T.Object3D();root.position.set(...position);root.scale.setScalar(meta.scale||1);const parts={};
      const pivots={body:[0,0,0],head:[0,2.8,0],leftArm:[-.6,2.62,0],rightArm:[.6,2.62,0],leftLeg:[-.25,1.5,0],rightLeg:[.25,1.5,0],tail:[0,1.5,-.7]};
      for(const[key,p]of Object.entries(pivots)){const part=new T.Object3D();part.position.set(...p);root.add(part);parts[key]=part;}
      const boxes=model.map(b=>{const pivot=pivots[b.part]||pivots.body,m=new T.Matrix4();dummy.position.set(b.x-pivot[0],b.y-pivot[1],b.z-pivot[2]);dummy.scale.set(b.sx,b.sy,b.sz);dummy.rotation.set(0,0,0);dummy.updateMatrix();m.copy(dummy.matrix);return {...b,local:m};});
      const actor={id,root,parts,boxes,baseY:position[1],origin:[...position],renderX:position[0],renderZ:position[2],field:false,phase:rand(hash(id),2)*6.28,attack:0,hit:0,route:null,routeIndex:0,wait:0,speed:1.5+rand(hash(id),3)*.5,...meta};actors.push(actor);return actor;
    }
    function getTeam(){try{const index=state?.hunting?.active?(state.hunting.team??state.selectedTeam??0):(state?.selectedTeam||0);return (state?.teams?.[index]||[]).map(id=>(state.heroes||[]).find(h=>h.id===id)).filter(Boolean);}catch(_){return[];}}
    /* Courtyard patrol loop for heroes and visitors who are not out on the field. */
    const COURT_ROUTE=[[-21,21],[-10,21],[0,23],[19,21],[14,21],[0,23],[-10,21]];
    function rebuildActors(){
      const previous=new Map(actors.map(a=>[a.id,a]));actors.length=0;cleanProxies('actor');
      const hunting=!!state?.hunting?.active,field=state?.hunting?.field;
      const zoneIndex=clamp(Number(state?.hunting?.zone||1),1,10)-1,zoneYaw=zoneAngle(zoneIndex);
      const teamIndex=hunting?(state.hunting.team??state.selectedTeam??0):(state?.selectedTeam||0),slots=state?.teams?.[teamIndex]||[];
      const team=getTeam(),fieldIds=new Set(field?field.party.map(m=>m.id):[]);
      /* The party and the monster are drawn exactly where the game state puts them; this
         layer never decides a position of its own. */
      if(field){
        const foe=[field.foe.x,field.foe.z];
        for(const h of team){
          const m=field.party.find(x=>x.id===h.id);if(!m)continue;
          const dx=foe[0]-m.x,dz=foe[1]-m.z,d=Math.hypot(dx,dz)||1;
          const actor=makeActor(h.id,heroModel(h.classId,h.stars,false,h),[m.x,W.height(m.x,m.z)+.18,m.z],{hero:h,field:true,fieldX:m.x,fieldZ:m.z,faceOpp:[dx/d,dz/d]});
          actor.root.rotation.y=Math.atan2(dx,dz);
        }
        const foeData=state?.hunting?.enemy;
        if(foeData){
          const boss=!!(foeData.boss||foeData.isBoss),model=enemyModel(foeData.name,zoneIndex+1,boss,foeData.elite);
          let nearest=null,nd=Infinity;
          for(const m of field.party){const d=Math.hypot(m.x-foe[0],m.z-foe[1]);if(d<nd){nd=d;nearest=m;}}
          const fx=(nearest?nearest.x:foe[0])-foe[0],fz=(nearest?nearest.z:foe[1]-1)-foe[1],fl=Math.hypot(fx,fz)||1;
          const actor=makeActor('enemy',model.blocks,[foe[0],W.height(...foe)+.24,foe[1]],{enemy:true,field:true,fieldX:foe[0],fieldZ:foe[1],family:model.family,scale:model.scale,dead:foeData.hp<=0,enemyData:foeData,faceOpp:[fx/fl,fz/fl]});
          actor.root.rotation.y=Math.atan2(fx/fl,fz/fl);
        }
      }
      const heroes=(state?.heroes||[]).filter(h=>!fieldIds.has(h.id)&&!h.expeditionId).slice(0,18);
      heroes.forEach((h,i)=>{const pt=COURT_ROUTE[i%COURT_ROUTE.length];
        const actor=makeActor(h.id,heroModel(h.classId,h.stars,false,h),[pt[0],4.18,pt[1]],{hero:h,route:COURT_ROUTE,routeIndex:(i+1)%COURT_ROUTE.length,speed:1.5+rand(hash(h.id),3)*.5});
        actor.root.rotation.y=i*.7;});
      const visitors=(state?.ext?.wanderers||state?.ext?.visitors||[]).filter(v=>!['hunting','expedition'].includes(v.status)).slice(0,9);
      visitors.forEach((v,i)=>{const busy=['resting','eating','drinking','shopping'].includes(v.status),route=v.status==='arriving'?[[0,47],[0,37],[0,23],[-10,21],[-21,21]]:COURT_ROUTE;let pt=route[(i+2)%route.length];if(busy)pt=v.status==='shopping'?[10,30.6]:v.status==='resting'?[-12,21]:[-21,29];makeActor(v.id,heroModel(v.classId,v.stars||1,true),[pt[0],4.18,pt[1]],{visitor:true,hero:v,route:busy?null:route,routeIndex:(i+3)%route.length,busy,status:v.status});});
      for(const actor of actors){
        const old=previous.get(actor.id);if(!old)continue;
        actor.attack=old.attack;actor.hit=old.hit;actor.previousHp=old.previousHp;actor.phase=old.phase;
        if(actor.field&&old.field){actor.renderX=old.renderX;actor.renderZ=old.renderZ;actor.faceMove=old.faceMove;}
        else if(!actor.field&&!old.field){actor.root.position.copy(old.root.position);actor.root.rotation.copy(old.root.rotation);actor.routeIndex=old.routeIndex;actor.wait=old.wait;}
      }
      let n=0;for(const actor of actors){actor.start=n;for(const b of actor.boxes){color.set(typeof b.c==='number'?b.c:COLORS[b.c]||COLORS.stone).multiplyScalar(b.shade||1);dynamic.setColorAt(n++,color);}if(!actor.enemy)actor.proxy=proxy('hero',actor.id,...actor.origin,2,5,2,{scope:'actor',visitor:!!actor.visitor});}
      dynamic.count=n;if(dynamic.instanceColor)dynamic.instanceColor.needsUpdate=true;dirty=true;
      actorShadows.count=actors.length;
    }
    function emitFX(x,y,z,c,count=12){if(motionReduced()||!particleAmount)return;count=Math.floor(count*particleAmount);for(let i=0;i<count&&fx.length<Math.floor(180*particleAmount);i++){const angle=i/count*Math.PI*2;fx.push({x,y,z,vx:Math.cos(angle)*(1.8+i%3),vy:2.8+i%4*.4,vz:Math.sin(angle)*(1.8+i%3),life:.5+i%3*.08,max:.7,c});}}
    function consumeCombatEvents(){
      if(!Array.isArray(state.events))return false;
      const fresh=eventsInitialized?state.events.filter(e=>!seenEvents.has(e.id)):[];
      seenEvents=new Set(state.events.map(e=>e.id));eventsInitialized=true;
      const foe=actors.find(a=>a.enemy);
      for(const event of fresh.slice(-24)){
        if(!['attack','skill','cast','dot','hurt','heal'].includes(event.type))continue;
        const actor=actors.find(a=>a.field&&!a.enemy&&a.id===event.heroId);
        if(!actor)continue;
        lastCombatEvent={id:event.id,type:event.type,heroId:actor.id};
        const position=actor.root.position,accent=CLASS[actor.hero.classId]?.accent||0xf9c980;
        if(event.type==='heal'){
          emitFX(position.x,position.y+2.4,position.z,0x74d99c,10);
        }else if(event.type==='hurt'){
          actor.hit=.25;if(foe)foe.attack=.45;
          emitFX(position.x,position.y+2,position.z,0xe58374,8);
        }else if(event.type==='cast'){
          actor.attack=.48;
          const skill=global.GameData?.classes?.[actor.hero.classId]?.skills?.find(s=>String(event.text).includes(s.name));
          if(skill?.guard||skill?.taunt)emitFX(position.x,position.y+2,position.z,0x81bce0,14);
          else if(skill?.freeze&&foe)emitFX(foe.root.position.x,foe.root.position.y+2,foe.root.position.z,0xabeaff,18);
        }else if(foe&&(!event.enemyId||event.enemyId===state.hunting?.enemy?.id)){
          if(event.type!=='dot')actor.attack=.48;
          foe.hit=.23;
          emitFX(foe.root.position.x,foe.root.position.y+2,foe.root.position.z,event.type==='dot'?0xc396dd:accent,event.type==='skill'?18:10);
        }
      }
      return true;
    }
    function sync(next,nextApi){
      if(disposed||!next)return;state=next;api=nextApi||api;
      if(String(state.worldSeed||'94721')!==seed){seed=String(state.worldSeed||'94721');buildCastleScene();zonesSignature='';}
      const bs=JSON.stringify(state.buildings||{});if(bs!==builtSignature){builtSignature=bs;buildFacilities();}
      const zs=[seed,state.progress?.maxZone||1].join(':');if(zs!==zonesSignature){zonesSignature=zs;buildZones();}
      const es=[state.hunting?.zone||1,state.hunting?.mode||'main'].join(':');if(es!==activeZoneSignature){activeZoneSignature=es;if(view==='battle')focusZone(state.hunting?.zone||1);updateLight();}
      const enemy=state.hunting?.enemy,ek=enemy?[enemy.id||enemy.name,state.hunting?.zone,state.hunting?.stage,!!enemy.boss,!!enemy.elite].join(':'):'none';
      const as=[view,state.hunting?.active,JSON.stringify(state.teams),getTeam().map(h=>h.id).join(','),state.heroes?.map(h=>h.id+':'+h.classId+':'+h.stars+':'+h.expeditionId+':'+h.legend+':'+JSON.stringify(h.equipment)+':'+h.artifact).join(','),(state.ext?.wanderers||[]).map(v=>v.id+':'+v.status).join(','),JSON.stringify(state.hunting?.field?[state.hunting.field.phase,state.hunting.field.party.map(m=>[Math.round(m.x),Math.round(m.z),m.pi].join(',')).join(';'),Math.round(state.hunting.field.foe.x)+','+Math.round(state.hunting.field.foe.z)]:null),ek].join('|');
      if(as!==actorsSignature){actorsSignature=as;rebuildActors();}
      const eventsDriven=consumeCombatEvents();
      if(!eventsDriven&&enemy&&ek===lastEnemyKey&&lastEnemyHp!=null&&enemy.hp<lastEnemyHp){
        const heroes=actors.filter(a=>a.field&&!a.enemy&&a.hero.hp>0),attacker=heroes.length?heroes[attackCursor++%heroes.length]:null;if(attacker){attacker.attack=.48;emitFX(attacker.root.position.x,attacker.root.position.y+2,attacker.root.position.z,CLASS[attacker.hero.classId]?.accent||0xf9c980,14);}const foe=actors.find(a=>a.enemy);if(foe)foe.hit=.23;
      }
      lastEnemyKey=ek;lastEnemyHp=enemy?.hp??null;
      for(const actor of actors){if(actor.hero&&!actor.visitor){const h=state.heroes?.find(h=>h.id===actor.id);if(h){if(!eventsDriven&&actor.previousHp!=null&&h.hp<actor.previousHp){actor.hit=.25;const foe=actors.find(a=>a.enemy);if(foe)foe.attack=.45;}actor.previousHp=h.hp;actor.hero=h;}}}
      dirty=true;
    }
    function applyCut(){const plane=new T.Plane(new T.Vector3(0,0,-1),12);castle.traverse(m=>{if(m.isMesh&&m.userData.ownedMaterial){m.material.clippingPlanes=cutaway?[plane]:[];m.material.clipShadows=true;m.material.needsUpdate=true;}});renderer.shadowMap.needsUpdate=true;dirty=true;}
    function updateLight(){
      const daylight=clamp(Math.sin((hour-6)/12*Math.PI)*1.6,0,1),angle=(hour-6)/12*Math.PI;sun.position.set(Math.cos(angle)*90,Math.max(12,Math.sin(angle)*100),50);sun.intensity=.35+daylight*2.4;sun.color.set(daylight>.7?0xffedcf:0xffbc81);hemi.intensity=1.1+daylight*1.35;hemi.color.set(daylight>.35?0xe4eff0:0x98b4d3);fill.intensity=.42+.25*(1-daylight);renderer.toneMappingExposure=.95+daylight*.17;
      const bg=view==='battle'?BIOMES[clamp(Number(state?.hunting?.zone||1),1,10)-1].sky:view==='map'?0xd4d9d3:0xe3dfd2;scene.background.set(bg).lerp(new T.Color(0x263444),(1-daylight)*.7);renderer.shadowMap.needsUpdate=true;dirty=true;
    }
    function cameraUpdate(){const w=Math.max(1,canvas.clientWidth),h=Math.max(1,canvas.clientHeight),aspect=w/h,size=orbit.size*Math.max(1,1.05/aspect);camera.left=-size*aspect;camera.right=size*aspect;camera.top=size;camera.bottom=-size;camera.position.set(orbit.target.x+700*Math.sin(orbit.phi)*Math.sin(orbit.theta),orbit.target.y+700*Math.cos(orbit.phi),orbit.target.z+700*Math.sin(orbit.phi)*Math.cos(orbit.theta));camera.lookAt(orbit.target);camera.updateProjectionMatrix();camera.updateMatrixWorld();}
    /* Frame the zone that is currently being hunted, seen from the castle side.
       The target sits between the party rank and the foe so both stay on screen. */
    function focusZone(zone){
      const i=clamp(Number(zone||1),1,10)-1,a=zoneAngle(i),layout=zoneLayout(i),mid=zoneToWorld(i,(layout.slots[0][0]+layout.foe[0])/2,(layout.slots[0][1]+layout.foe[1])/2);
      orbit.theta=a+Math.PI;orbit.phi=.66;orbit.size=27;
      orbit.target.set(mid[0],ZONE_Y+1.5,mid[1]);autoOrbit=false;dirty=true;
    }
    /* One continuous world: every group stays visible, so switching a view only moves the camera. */
    function setView(next){
      if(!['castle','battle','map'].includes(next))return;view=next;
      castle.visible=facilities.visible=zones.visible=true;
      selectRing.visible=false;selected=null;autoOrbit=false;fx.length=0;
      if(view==='castle')setCamera('overview');else if(view==='battle')focusZone(state?.hunting?.zone||1);else setCamera('ring');
      actorsSignature='';if(state)sync(state,api);updateLight();dirty=true;
    }
    function setCamera(name){const p=presets[name];if(!p)return;Object.assign(orbit,{theta:p.theta,phi:p.phi,size:p.size});orbit.target.set(...p.target);autoOrbit=false;dirty=true;}
    function focus(id){const p=ANCHORS[id]||ENTRIES[id]||actors.find(a=>a.id===id)?.root.position.toArray();if(!p)return;orbit.target.set(p[0],p[1]+4,p[2]);orbit.size=id==='castle'?30:20;orbit.phi=.65;autoOrbit=false;selected=String(id);selectRing.position.set(p[0],p[1]+.24,p[2]);selectRing.visible=true;dirty=true;}
    function resize(){const w=Math.max(1,canvas.clientWidth),h=Math.max(1,canvas.clientHeight);renderer.setSize(w,h,false);dirty=true;}
    const pointers=new Map();let pressed=null,lastDistance=0;
    on(canvas,'pointerdown',e=>{if(e.target!==canvas)return;canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});pressed={x:e.clientX,y:e.clientY,moved:false,t:performance.now()};lastDistance=0;autoOrbit=false;});
    on(canvas,'pointermove',e=>{const old=pointers.get(e.pointerId);if(!old)return;const dx=e.clientX-old.x,dy=e.clientY-old.y;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pressed&&Math.hypot(e.clientX-pressed.x,e.clientY-pressed.y)>5)pressed.moved=true;
      if(pointers.size>1){if(pressed)pressed.moved=true;const pts=[...pointers.values()],dist=Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y);if(lastDistance)orbit.size=clamp(orbit.size*lastDistance/Math.max(10,dist),10,360);lastDistance=dist;}
      else if(inspection){orbit.theta-=dx*.006;orbit.phi=clamp(orbit.phi-dy*.006,.06,1.4);}
      else{const scale=orbit.size*2/Math.max(200,canvas.clientHeight);orbit.target.x=clamp(orbit.target.x-dx*scale*Math.cos(orbit.theta)-dy*scale*Math.sin(orbit.theta),-275,275);orbit.target.z=clamp(orbit.target.z+dx*scale*Math.sin(orbit.theta)-dy*scale*Math.cos(orbit.theta),-275,275);}
      dirty=true;
    });
    function endPointer(e,cancel=false){pointers.delete(e.pointerId);lastDistance=0;if(!cancel&&pressed&&!pressed.moved&&performance.now()-pressed.t<900){const rect=canvas.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);cameraUpdate();raycaster.setFromCamera(pointer,camera);
        const choices=proxies.filter(p=>['building','actor','challenge','zone'].includes(p.userData.scope));const hits=raycaster.intersectObjects(choices,false);if(hits.length){const item=hits[0].object.userData;selected=item.id;const hit=hits[0].object;selectRing.position.set(hit.position.x,hit.userData.scope==='zone'?ZONE_Y+.7:4.4,hit.position.z);selectRing.visible=true;onSelect({kind:item.kind,id:item.id,...(item.visitor?{visitor:true}:{}),...(item.locked?{locked:true}:{})});dirty=true;}}
      if(!pointers.size)pressed=null;
    }
    on(canvas,'pointerup',e=>endPointer(e));on(canvas,'pointercancel',e=>endPointer(e,true));on(canvas,'wheel',e=>{e.preventDefault();autoOrbit=false;orbit.size=clamp(orbit.size*Math.exp(clamp(e.deltaY,-160,160)*.0014),10,360);dirty=true;},{passive:false});on(canvas,'contextmenu',e=>e.preventDefault());
    on(document,'visibilitychange',()=>{visibility=!document.hidden;lastT=0;dirty=true;});on(canvas,'webglcontextlost',e=>{e.preventDefault();onError('3D 顯示暫時中斷，遊戲進度仍保留；請重新開啟場景。');});on(canvas,'webglcontextrestored',()=>{renderer.shadowMap.needsUpdate=true;dirty=true;});
    const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(canvas);on(reducedQuery,'change',()=>{if(reducedQuery.matches){autoOrbit=false;if(state)rebuildActors();}dirty=true;});
    function animate(time){
      if(disposed)return;raf=requestAnimationFrame(animate);if(!visibility)return;const raw=lastT?(time-lastT)/1000:0,dt=Math.min(raw,.06);lastT=time;const reduce=reducedQuery.matches;
      if(autoOrbit&&!reduce){orbit.theta+=dt*.1;dirty=true;}
      let moving=false,rebuildAfter=false;const walkDt=Math.min(raw,.4);
      for(const actor of actors){const {root,parts}=actor;let walk=0;
        if(actor.field&&!reduce){
          // Only ever draws the position the simulation already computed, eased for the eye.
          const k=Math.min(1,Math.max(dt,walkDt)*16),dx=actor.fieldX-actor.renderX,dz=actor.fieldZ-actor.renderZ,d=Math.hypot(dx,dz);
          if(d>.02){actor.renderX+=dx*k;actor.renderZ+=dz*k;actor.faceMove=[dx/d,dz/d];walk=Math.sin(time*.012+actor.phase)*.43;moving=true;}
          else{actor.renderX=actor.fieldX;actor.renderZ=actor.fieldZ;}
        }else if(actor.route&&!reduce){if(actor.wait>0)actor.wait-=walkDt;else{const pt=actor.route[actor.routeIndex],dx=pt[0]-root.position.x,dz=pt[1]-root.position.z,d=Math.hypot(dx,dz);if(d<Math.max(.18,walkDt*actor.speed)){
          root.position.x=pt[0];root.position.z=pt[1];
          actor.routeIndex=(actor.routeIndex+1)%actor.route.length;actor.wait=.8+rand(hash(actor.id),actor.routeIndex)*2;
        }else{root.position.x+=dx/d*walkDt*actor.speed;root.position.z+=dz/d*walkDt*actor.speed;root.rotation.y=Math.atan2(dx,dz);walk=Math.sin(time*.005+actor.phase)*.43;moving=true;}}}
        actor.attack=Math.max(0,actor.attack-dt);actor.hit=Math.max(0,actor.hit-dt);const strike=reduce?0:Math.sin(actor.attack/.48*Math.PI),breath=reduce?0:Math.sin(time*.002+actor.phase)*.055;
        if(actor.field)actor.baseY=W.height(actor.renderX,actor.renderZ)+(actor.enemy?.24:.18);
        root.position.y=actor.baseY+breath+(walk?Math.abs(walk)*.06:0);if(actor.field){const f=actor.faceOpp||[1,0],look=actor.faceMove||f;root.rotation.y=Math.atan2(look[0],look[1]);const s=actor.enemy?strike*.6:strike*.7;root.position.x=actor.renderX+(actor.enemy?-f[0]:f[0])*s;root.position.z=actor.renderZ+(actor.enemy?-f[1]:f[1])*s;root.rotation.z=actor.enemy?(actor.hit?.055:0):(actor.hero.hp<=0?-1.3:actor.hit?-.06:0);}
        parts.leftLeg.rotation.x=walk;parts.rightLeg.rotation.x=-walk;parts.leftArm.rotation.x=-walk*.6;parts.rightArm.rotation.x=walk*.6-strike*1.2+(actor.busy&&!reduce?-.65+Math.sin(time*.003)*.18:0);parts.body.rotation.z=actor.hit?Math.sin(time*.08)*.04:0;parts.head.rotation.y=reduce?0:Math.sin(time*.001+actor.phase)*.05;
        if(actor.family==='wing'||actor.family==='dragon'){parts.leftArm.rotation.z=reduce?-.12:Math.sin(time*.004)*.25;parts.rightArm.rotation.z=-parts.leftArm.rotation.z;}
        parts.tail.rotation.y=reduce?0:Math.sin(time*.003)*.16;root.updateMatrixWorld(true);
        actor.boxes.forEach((b,i)=>{matrix.multiplyMatrices((parts[b.part]||parts.body).matrixWorld,b.local);dynamic.setMatrixAt(actor.start+i,matrix);});
        if(actor.proxy){actor.proxy.position.set(root.position.x,root.position.y+2,root.position.z);actor.proxy.updateMatrixWorld();}
        dummy.position.set(root.position.x,actor.baseY+.01,root.position.z);dummy.rotation.set(0,root.rotation.y,0);dummy.scale.set((actor.enemy?2.3:1.4)*root.scale.x,.025,(actor.enemy?2.1:1.2)*root.scale.z);dummy.updateMatrix();actorShadows.setMatrixAt(actors.indexOf(actor),dummy.matrix);
      }
      if(rebuildAfter){actorsSignature='';rebuildActors();}
      if(actors.length)dynamic.instanceMatrix.needsUpdate=true;
      if(actors.length)actorShadows.instanceMatrix.needsUpdate=true;
      for(let i=fx.length-1;i>=0;i--){const f=fx[i];f.life-=dt;if(f.life<=0){fx.splice(i,1);continue;}f.x+=f.vx*dt;f.y+=f.vy*dt;f.z+=f.vz*dt;f.vy-=7*dt;}
      particles.count=fx.length;fx.forEach((f,i)=>{dummy.position.set(f.x,f.y,f.z);const size=.1+.15*f.life/f.max;dummy.scale.setScalar(size);dummy.rotation.set(time*.004+i,0,time*.003);dummy.updateMatrix();particles.setMatrixAt(i,dummy.matrix);color.set(f.c);particles.setColorAt(i,color);});if(fx.length){particles.instanceMatrix.needsUpdate=true;particles.instanceColor.needsUpdate=true;}
      const active=actors.length&&!reduce||fx.length||autoOrbit;const interval=window.innerWidth<650?1000/30:1000/50;
      if((dirty||active)&&time-lastRender>=interval){cameraUpdate();renderer.render(scene,camera);frames++;lastRender=time;dirty=false;}
    }
    function getMarkers(){
      cameraUpdate();const names={castle:'王城',tavern:'酒館',warehouse:'倉庫',training:'訓練場',forge:'鐵匠鋪',potion:'藥水工坊',gem:'寶石工坊',market:'市場',library:'圖書館',altar:'昇華祭壇'};
      const rift=zoneToWorld(8,-16,16);
      const entries=[...Object.entries(ANCHORS).map(([id,p])=>({id,kind:'building',p:[p[0],id==='castle'?37:11,p[2]],label:names[id],level:state?.buildings?.[id]||0})),...MAP_POS.map((p,i)=>({id:String(i+1),kind:'zone',p:[p[0],ZONE_Y+9,p[1]],label:BIOMES[i].name,locked:i+1>(state?.progress?.maxZone||1)})),{id:'abyss',kind:'abyss',p:[rift[0],ZONE_Y+9,rift[1]],label:'無盡深淵'}];
      return entries.map(({p,...entry})=>{const v=new T.Vector3(...p).project(camera);return{...entry,x:(v.x+1)*canvas.clientWidth/2,y:(1-v.y)*canvas.clientHeight/2,visible:v.z>=-1&&v.z<=1&&Math.abs(v.x)<1&&Math.abs(v.y)<1};});
    }
    function getStats(){let blocks=0,batches=0;for(const g of[castle,facilities,zones])if(g.visible)g.traverse(m=>{if(m.isInstancedMesh){blocks+=m.count;batches++;}});return{view,hour,blocks:blocks+dynamic.count,worldBlocks:blocks,batches:batches+(dynamic.count?2:0),map:{count:ZONE_COUNT,radius:RING_RADIUS,groups:zoneGroups.length,positions:MAP_POS,biomes:W.biomes.length,abyss:zoneToWorld(8,-16,16),slots:MAP_POS.map((_,i)=>zoneLayout(i).slots.map(l=>zoneToWorld(i,l[0],l[1]))),props:MAP_POS.map((_,i)=>zoneLayout(i).props.length)},actors:actors.length,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,frames,worldSeed:seed,generationVersion:2,inspection,cutaway,camera:{theta:orbit.theta,phi:orbit.phi,size:orbit.size,target:orbit.target.toArray()},buildingAnchors:ANCHORS,buildingStages:Object.fromEntries(Object.entries(MILESTONES).map(([id,m])=>{const level=state?.buildings?.[id]||0;return[id,level?1+Number(level>=m[0])+Number(level>=m[1]):0];})),field:state?.hunting?.field?{phase:state.hunting.field.phase,retreat:state.hunting.field.retreat||null,aggro:state.hunting.field.foe.aggro,foe:[state.hunting.field.foe.x,state.hunting.field.foe.z],party:state.hunting.field.party.map(m=>({id:m.id,x:m.x,z:m.z,pi:m.pi,path:m.path.length}))}:null,actorStates:actors.map(a=>({id:a.id,visitor:!!a.visitor,enemy:!!a.enemy,field:!!a.field,family:a.family||null,position:a.field?[a.fieldX,a.baseY,a.fieldZ]:a.root.position.toArray(),drawn:a.root.position.toArray(),walking:!!a.route,routeLength:a.route?a.route.length:0,speed:a.speed||0}))};}
    function dispose(){if(disposed)return;disposed=true;cancelAnimationFrame(raf);resizeObserver.disconnect();listeners.forEach(fn=>fn());[castle,facilities,zones].forEach(disposeGroup);dynamic.dispose();particles.dispose();actorShadows.dispose();[material,glow,waterMaterial,proxyMaterial,outlineMaterial,actorShadowMaterial].forEach(m=>m.dispose());unit.dispose();sun.shadow.map?.dispose();renderer.dispose();proxies.length=actors.length=fx.length=0;}
    buildCastleScene();buildFacilities();buildZones();setView('castle');updateLight();resize();raf=requestAnimationFrame(animate);
    return{sync,setView,setCamera,setInspection(v){inspection=!!v;autoOrbit=false;},setCutaway(v){cutaway=!!v;applyCut();},setHour(v){hour=clamp(Number(v)||0,0,24);updateLight();},setOrbit(v){autoOrbit=!!v&&!reducedQuery.matches;dirty=true;},zoom(factor){if(!Number.isFinite(factor)||factor<=0)return;orbit.size=clamp(orbit.size*factor,9,360);dirty=true;},focus,dispose,getStats,getMarkers};
  }
  global.GameWorld={create,buildingAnchors:ANCHORS,biomes:BIOMES};
})(globalThis);
