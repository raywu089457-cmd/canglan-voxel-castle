/* Original voxel icons, rendered locally from the castle's stone / oak / copper palette. */
(function(g){'use strict';
const cache=new Map(),P={stone:'#9daca0',light:'#c3cbb1',dark:'#526c68',wood:'#846246',roof:'#47756a',gold:'#cba255',skin:'#d5ac7d',iron:'#839599',red:'#ad6150',blue:'#678ca2',green:'#6c925d',purple:'#8c769a'};
function shade(hex,m){return '#'+hex.slice(1).match(/../g).map(v=>Math.min(255,Math.max(0,Math.round(parseInt(v,16)*m))).toString(16).padStart(2,'0')).join('');}
function icon(id,variant=''){
const key=id+':'+variant;if(cache.has(key))return cache.get(key);
const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;const c=canvas.getContext('2d'),b=[];
const cube=(x,y,z,s=1,col=P.stone)=>b.push({x,y,z,s,col});
const box=(x,y,z,w,h,d,col)=>{for(let i=0;i<w;i++)for(let j=0;j<h;j++)for(let k=0;k<d;k++)cube(x+i,y+j,z+k,1,col);};
const hero=['swordsman','archer','mage','assassin','knight','priest'].includes(id);
if(hero){
const col={swordsman:P.red,archer:P.green,mage:P.blue,assassin:P.purple,knight:P.iron,priest:P.light}[id];
box(-1,0,0,1,2,2,P.dark);box(1,0,0,1,2,2,P.dark);box(-1,2,0,3,3,2,col);box(-1,5,0,3,3,2,P.skin);box(-1,7,0,3,1,2,id==='priest'?P.light:P.wood);box(-2,3,0,1,2,1,col);box(2,3,0,1,2,1,col);cube(1,6,1.6,.34,P.dark);
if(id==='mage'||id==='priest'){box(3,0,0,1,7,1,P.wood);cube(2.8,7,0,1.4,id==='mage'?P.blue:P.gold);}
else if(id==='archer'){box(3,2,0,1,4,1,P.wood);cube(2.5,1,0);cube(2.5,6,0);}
else{box(3,2,0,1,5,1,P.iron);box(2,2,0,3,1,1,P.gold);if(id==='knight')box(-3,2,1,2,4,1,P.blue);}
}else if(['castle','tavern','warehouse','training','forge','potion','gem','market','library','altar'].includes(id)){
const colors={castle:P.roof,tavern:P.red,warehouse:P.wood,training:P.iron,forge:P.dark,potion:P.green,gem:P.blue,market:P.gold,library:P.blue,altar:P.purple};
box(-3,0,-2,6,1,5,P.dark);box(-2,1,-1,4,4,3,P.light);box(-1,1,2,1,2,1,P.wood);
if(id==='castle'){box(-3,1,-1,1,6,3,P.stone);box(2,1,-1,1,6,3,P.stone);for(let x=-3;x<=3;x+=2)cube(x,7,0,1,P.light);box(-1,5,0,2,3,2,P.stone);cube(0,8,0,1,P.gold);}
else{for(let y=0;y<3;y++)box(-3+y,5+y,-2,6-y*2,1,5,colors[id]);if(id==='forge')box(1,5,-1,1,4,1,P.stone);if(id==='altar'){box(-1,7,-1,2,2,2,P.gold);}}
}else if(['gold','honor','points','kingCoins','badges'].includes(id)){
for(let j=0;j<3;j++)box(-2+j*.5,j*1.5,-1-j*.3,4,1,3,id==='honor'?P.iron:P.gold);
}else if(['gems','crystal','red','blue','green','yellow','void','myth','ember','frost','poison'].includes(id)){
const col={red:P.red,blue:P.blue,green:P.green,yellow:P.gold,ember:P.red,frost:P.blue,void:P.purple,myth:P.gold,poison:P.green}[id]||P.blue;box(-1,0,-1,2,1,2,col);box(-2,1,-2,4,3,4,col);box(-1,4,-1,2,2,2,col);cube(0,6,0,1,col);
}else if(['book','books','quests','collections','tickets','research'].includes(id)){
box(-3,0,-1,6,1,4,P.wood);box(-2,1,-1,4,1,4,P.light);box(-3,2,-1,6,1,4,id==='tickets'?P.gold:P.green);box(-1,3,0,1,1,3,P.gold);
}else if(['weapon','hunt','challenges','trainingSword'].includes(id)){
box(0,0,0,1,3,1,P.wood);box(-2,3,0,5,1,1,P.gold);box(-1,4,0,2,5,1,P.iron);cube(0,9,0,1,P.light);
}else if(['helmet','armor','boots','necklace','ring','charm','equipment'].includes(id)){
if(id==='ring'||id==='necklace'||id==='charm'){box(-2,1,0,1,4,1,P.gold);box(2,1,0,1,4,1,P.gold);box(-1,0,0,3,1,1,P.gold);box(-1,5,0,3,1,1,P.gold);cube(0,6,0,1.5,P.blue);}
else if(id==='boots'){box(-2,0,-1,2,2,4,P.wood);box(1,0,-1,2,2,4,P.wood);box(-2,2,-1,2,2,2,P.iron);box(1,2,-1,2,2,2,P.iron);}
else{box(-2,1,-1,4,id==='helmet'?3:5,3,P.iron);box(-3,3,-1,1,2,2,P.dark);box(2,3,-1,1,2,2,P.dark);box(-1,4,2,2,1,1,P.gold);}
}else if(id==='heroes'||id==='wanderers'){return icon('knight');}
else if(['guild','expeditions','map'].includes(id)){box(-3,0,-2,6,1,5,P.green);box(-1,1,-1,2,3,2,P.stone);box(0,4,0,1,5,1,P.wood);box(1,6,0,3,2,1,P.red);}
else if(id==='artifacts'){box(-2,0,-2,4,1,4,P.dark);box(-1,1,-1,2,2,2,P.gold);box(-2,3,-2,4,2,4,P.gold);box(-1,5,-1,2,2,2,P.blue);}
else if(['hp','mp','attack','xp','hourglass','goldBag','shop','settings'].includes(id)){box(-2,0,-1,4,4,3,id==='hp'?P.red:id==='mp'?P.blue:P.green);box(-1,4,0,2,2,1,P.light);box(-1,6,0,2,1,1,P.wood);}
else if(id==='herb'){box(0,0,0,1,5,1,P.wood);box(-2,2,0,2,1,2,P.green);box(1,4,0,2,1,2,P.green);}
else{box(-2,0,-1,4,2,3,id==='iron'?P.iron:id==='leather'?P.wood:P.stone);box(-1,2,-1,3,1,2,P.light);}
const pr=(x,y,z)=>[(x-z)*.866,(x+z)*.45-y],verts=[];
for(const v of b)for(const dx of [0,v.s])for(const dy of [0,v.s])for(const dz of [0,v.s])verts.push(pr(v.x+dx,v.y+dy,v.z+dz));
const xs=verts.map(v=>v[0]),ys=verts.map(v=>v[1]),loX=Math.min(...xs),hiX=Math.max(...xs),loY=Math.min(...ys),hiY=Math.max(...ys),scale=Math.min(110/(hiX-loX),112/(hiY-loY));
const pt=(x,y,z)=>{const p=pr(x,y,z);return [64+(p[0]-(loX+hiX)/2)*scale,64+(p[1]-(loY+hiY)/2)*scale];};
function face(pts,col){c.fillStyle=col;c.beginPath();pts.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.closePath();c.fill();}
b.sort((a,b)=>(a.x+a.z-b.x-b.z)||a.y-b.y).forEach(({x,y,z,s,col})=>{face([pt(x,y,z+s),pt(x+s,y,z+s),pt(x+s,y+s,z+s),pt(x,y+s,z+s)],shade(col,.78));face([pt(x+s,y,z),pt(x+s,y,z+s),pt(x+s,y+s,z+s),pt(x+s,y+s,z)],shade(col,.6));face([pt(x,y+s,z),pt(x+s,y+s,z),pt(x+s,y+s,z+s),pt(x,y+s,z+s)],shade(col,1.14));});
const url=canvas.toDataURL('image/png');cache.set(key,url);return url;
}
g.VoxelIcons={icon};
})(globalThis);
