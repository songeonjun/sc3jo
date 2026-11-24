(async()=>{
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const T=window.TWIN,C=Cesium;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const hhmm=s=>{s=Math.max(0,Math.round(s));return String(Math.floor(s/3600)%24).padStart(2,'0')+':'+String(Math.floor(s%3600/60)).padStart(2,'0')};
const rng=seed=>()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
const fmt=n=>n.toLocaleString('ko-KR');
const short=n=>n.replace(' 호출벨','').replace('마을회관','');
const progress=(p,m)=>{$('#loadbar').style.width=Math.round(p*100)+'%';if(m)$('#loadmsg').textContent=m};

/* ================= viewer ================= */
C.Ion.defaultAccessToken=(window.CFG&&CFG.ionToken)||'';
const viewer=new C.Viewer('cz',{baseLayer:false,baseLayerPicker:false,geocoder:false,homeButton:false,sceneModePicker:false,navigationHelpButton:false,animation:false,timeline:false,fullscreenButton:false,infoBox:false,selectionIndicator:false,shadows:true,terrainShadows:C.ShadowMode.ENABLED,msaaSamples:4});
const scene=viewer.scene,globe=scene.globe,camera=viewer.camera;
scene.highDynamicRange=true;scene.postProcessStages.fxaa.enabled=true;
globe.enableLighting=true;globe.depthTestAgainstTerrain=true;globe.showGroundAtmosphere=true;globe.maximumScreenSpaceError=1.5;globe.tileCacheSize=400;
globe.atmosphereLightIntensity=12;scene.fog.enabled=true;scene.fog.density=1.6e-4;scene.fog.minimumBrightness=.1;
viewer.shadowMap.size=4096;viewer.shadowMap.softShadows=true;viewer.shadowMap.maximumDistance=7000;viewer.shadowMap.darkness=.45;
const ssc=scene.screenSpaceCameraController;ssc.minimumZoomDistance=40;ssc.maximumZoomDistance=90000;ssc.enableCollisionDetection=true;
viewer.clock.shouldAnimate=false;

let SRC={terrain:'',imagery:''};
// --- imagery ---
progress(.08,'항공사진 연결 중…');
async function addImagery(){
 if(window.CFG&&CFG.vworldKey){try{viewer.imageryLayers.addImageryProvider(new C.UrlTemplateImageryProvider({url:`https://api.vworld.kr/req/wmts/1.0.0/${CFG.vworldKey}/Satellite/{z}/{y}/{x}.jpeg`,maximumLevel:19,credit:'브이월드 항공사진 (국토교통부)'}));SRC.imagery='브이월드 항공사진';return}catch(e){}}
 if(C.Ion.defaultAccessToken){try{const p=await C.IonImageryProvider.fromAssetId(2);viewer.imageryLayers.addImageryProvider(p);SRC.imagery='Bing 항공사진';return}catch(e){console.warn('ion imagery',e)}}
 viewer.imageryLayers.addImageryProvider(new C.UrlTemplateImageryProvider({url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',maximumLevel:19,credit:'Esri, Maxar'}));SRC.imagery='Esri 위성';}
await addImagery();
const base=viewer.imageryLayers.get(0);if(base){base.brightness=1.05;base.contrast=1.08;base.saturation=1.05;base.gamma=1.0}
// --- terrain ---
progress(.2,'정밀 지형 연결 중…');
function terrariumProvider(){const cache=new Map(),ts=new C.GeographicTilingScheme();
 const tile=(z,x,y)=>{const k=z+'/'+x+'/'+y;if(!cache.has(k))cache.set(k,new Promise(res=>{const im=new Image();im.crossOrigin='anonymous';im.onload=()=>{try{const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');g.drawImage(im,0,0);res(g.getImageData(0,0,256,256).data)}catch(e){res(null)}};im.onerror=()=>res(null);im.src=`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`}));return cache.get(k)};
 return new C.CustomHeightmapTerrainProvider({width:65,height:65,tilingScheme:ts,callback:async(x,y,level)=>{const r=ts.tileXYToRectangle(x,y,level);const z=clamp(level+1,1,15),n=2**z;const H=new Float32Array(65*65);
  const W=C.Math.toDegrees(r.west),E=C.Math.toDegrees(r.east),S=C.Math.toDegrees(r.south),N=C.Math.toDegrees(r.north);const need=new Map(),pix=[];
  for(let j=0;j<65;j++){const lat=N-(N-S)*j/64,lr=lat*Math.PI/180,fy=(1-Math.log(Math.tan(lr)+1/Math.cos(lr))/Math.PI)/2*n;for(let i=0;i<65;i++){const lon=W+(E-W)*i/64,fx=(lon+180)/360*n;const tx=Math.floor(fx),ty=Math.floor(fy);const k=tx+','+ty;if(!need.has(k))need.set(k,tile(z,tx,ty));pix.push([k,Math.min(255,Math.floor((fx-tx)*256)),Math.min(255,Math.floor((fy-ty)*256))])}}
  const keys=[...need.keys()],datas=await Promise.all(keys.map(k=>need.get(k)));const M=new Map(keys.map((k,i)=>[k,datas[i]]));
  pix.forEach(([k,px,py],i)=>{const d=M.get(k);if(!d){H[i]=0;return}const o=(py*256+px)*4;H[i]=d[o]*256+d[o+1]+d[o+2]/256-32768});return H}})}
let terrainProvider=null;
if(C.Ion.defaultAccessToken){try{terrainProvider=await C.CesiumTerrainProvider.fromIonAssetId(1,{requestVertexNormals:true,requestWaterMask:true});SRC.terrain='Cesium World Terrain'}catch(e){console.warn('ion terrain',e)}}
if(!terrainProvider){terrainProvider=terrariumProvider();SRC.terrain='AWS Terrain Tiles'}
viewer.terrainProvider=terrainProvider;
$('#src').textContent=`지형 ${SRC.terrain} · ${SRC.imagery} · 건물 GIS건물통합정보(2026.11)`;
const sampleH=async cartos=>{try{if(terrainProvider.availability)return await C.sampleTerrainMostDetailed(terrainProvider,cartos);return await C.sampleTerrain(terrainProvider,14,cartos)}catch(e){console.warn('sample',e);return cartos}};

/* ================= time & weather ================= */
const DATE=Date.UTC(2026,7,12,0,0)-9*3600*1000;   // 2026-08-12 00:00 KST
const setClock=sec=>{viewer.clock.currentTime=C.JulianDate.fromDate(new Date(DATE+sec*1000))};
setClock(14*3600);

/* ================= focus circle ================= */
const CEN=C.Cartesian3.fromDegrees(T.center[0],T.center[1]);
const circ=[];{const enu=C.Transforms.eastNorthUpToFixedFrame(CEN);for(let i=0;i<=128;i++){const a=i/128*2*Math.PI;const p=C.Matrix4.multiplyByPoint(enu,new C.Cartesian3(Math.cos(a)*T.radius,Math.sin(a)*T.radius,0),new C.Cartesian3());const cg=C.Cartographic.fromCartesian(p);circ.push(C.Math.toDegrees(cg.longitude),C.Math.toDegrees(cg.latitude))}}
const circPos=C.Cartesian3.fromDegreesArray(circ);
scene.groundPrimitives.add(new C.GroundPrimitive({geometryInstances:new C.GeometryInstance({geometry:new C.PolygonGeometry({polygonHierarchy:new C.PolygonHierarchy(C.Cartesian3.fromDegreesArray([127.9,36.95,128.7,36.95,128.7,37.6,127.9,37.6]),[new C.PolygonHierarchy(circPos)])}),attributes:{color:C.ColorGeometryInstanceAttribute.fromColor(new C.Color(0.03,0.05,0.09,0.62))}}),appearance:new C.PerInstanceColorAppearance({flat:true,translucent:true})}));
viewer.entities.add({polyline:{positions:circPos,clampToGround:true,width:8,material:new C.Color(1,1,1,0.18)}});
viewer.entities.add({polyline:{positions:circPos,clampToGround:true,width:2.5,material:new C.Color(1,1,1,0.85)}});

/* ================= buildings (real footprints, 건축물대장 층수) ================= */
progress(.35,'건물 4,640동을 세우는 중…');
const B=T.buildings;
const cents=B.map(b=>{let x=0,y=0;b.p.forEach(p=>{x+=p[0];y+=p[1]});return C.Cartographic.fromDegrees(x/b.p.length,y/b.p.length)});
const bh=await sampleH(cents.map(c=>c.clone()));
B.forEach((b,i)=>b.g=bh[i].height||0);
const R=rng(42),ROOF=['#3f6e9e','#4f7d5a','#a8473a','#7c848c','#b9783f','#2f5f86','#6b7f5c','#8c3b34'].map(h=>C.Color.fromCssColorString(h));
const WALL=[C.Color.fromCssColorString('#e9e3d6'),C.Color.fromCssColorString('#ddd8cc'),C.Color.fromCssColorString('#f1ede4'),C.Color.fromCssColorString('#d4cfc4')];
const isHouse=u=>u==='단독주택'||u==='';
const wallInst=[],roofInst=[];
B.forEach((b,i)=>{const pos=C.Cartesian3.fromDegreesArray(b.p.flat());const house=isHouse(b.u)&&b.p.length===4&&b.fl<=2;const wallH=house?b.h*.68:b.h;b.wallH=wallH;b.house=house;
 b.wc=house?WALL[(R()*4)|0]:b.u.includes('창고')||b.u.includes('동.식물')?C.Color.fromCssColorString('#c9ced3'):WALL[(R()*4)|0];b.rc=ROOF[(R()*ROOF.length)|0];
 try{wallInst.push(new C.GeometryInstance({id:'b'+i,geometry:new C.PolygonGeometry({polygonHierarchy:new C.PolygonHierarchy(pos),height:b.g-1.5,extrudedHeight:b.g+wallH,vertexFormat:C.PerInstanceColorAppearance.VERTEX_FORMAT}),attributes:{color:C.ColorGeometryInstanceAttribute.fromColor(b.wc)}}))}catch(e){}
 if(house){const P=b.p;const d01=Math.hypot(P[1][0]-P[0][0],P[1][1]-P[0][1]),d12=Math.hypot(P[2][0]-P[1][0],P[2][1]-P[1][1]);const q=d01>=d12?[0,1,2,3]:[1,2,3,0];const A=P[q[0]],Bq=P[q[1]],Cq=P[q[2]],Dq=P[q[3]];
  const e=b.g+wallH,top=b.g+b.h;const m1=[(A[0]+Dq[0])/2,(A[1]+Dq[1])/2],m2=[(Bq[0]+Cq[0])/2,(Bq[1]+Cq[1])/2];const over=1.08;
  const v=[[A,e],[Bq,e],[m2,top],[m1,top],[Dq,e],[Cq,e]].map(([p,h])=>C.Cartesian3.fromDegrees(p[0],p[1],h));
  const faces=[[0,1,2],[0,2,3],[4,3,2],[4,2,5],[0,3,4],[1,5,2]];const pos3=[],nor=[];
  faces.forEach(f=>{const a=v[f[0]],bb=v[f[1]],c=v[f[2]];const n=C.Cartesian3.normalize(C.Cartesian3.cross(C.Cartesian3.subtract(bb,a,new C.Cartesian3()),C.Cartesian3.subtract(c,a,new C.Cartesian3()),new C.Cartesian3()),new C.Cartesian3());const up=C.Cartesian3.normalize(a,new C.Cartesian3());if(C.Cartesian3.dot(n,up)<0){C.Cartesian3.negate(n,n);[a,bb,c].reverse().forEach(p=>pos3.push(p.x,p.y,p.z))}else[a,bb,c].forEach(p=>pos3.push(p.x,p.y,p.z));for(let k=0;k<3;k++)nor.push(n.x,n.y,n.z)});
  const pts=v;const geom=new C.Geometry({attributes:{position:new C.GeometryAttribute({componentDatatype:C.ComponentDatatype.DOUBLE,componentsPerAttribute:3,values:new Float64Array(pos3)}),normal:new C.GeometryAttribute({componentDatatype:C.ComponentDatatype.FLOAT,componentsPerAttribute:3,values:new Float32Array(nor)})},indices:new Uint16Array([...Array(pos3.length/3).keys()]),primitiveType:C.PrimitiveType.TRIANGLES,boundingSphere:C.BoundingSphere.fromPoints(pts)});
  roofInst.push(new C.GeometryInstance({id:'r'+i,geometry:geom,attributes:{color:C.ColorGeometryInstanceAttribute.fromColor(b.rc)}}))}
 else{try{roofInst.push(new C.GeometryInstance({id:'r'+i,geometry:new C.PolygonGeometry({polygonHierarchy:new C.PolygonHierarchy(pos),height:b.g+wallH,extrudedHeight:b.g+wallH+.35,vertexFormat:C.PerInstanceColorAppearance.VERTEX_FORMAT}),attributes:{color:C.ColorGeometryInstanceAttribute.fromColor(b.u.includes('창고')||b.u.includes('동.식물')?C.Color.fromCssColorString('#aab4bc'):C.Color.fromCssColorString('#cfcac0'))}}))}catch(e){}}});
const wallPrim=scene.primitives.add(new C.Primitive({geometryInstances:wallInst,appearance:new C.PerInstanceColorAppearance({translucent:false,closed:true}),shadows:C.ShadowMode.ENABLED}));
const roofPrim=scene.primitives.add(new C.Primitive({geometryInstances:roofInst,appearance:new C.PerInstanceColorAppearance({translucent:false,closed:false,faceForward:true}),shadows:C.ShadowMode.ENABLED,asynchronous:false}));
let bState=new Array(B.length).fill(0);
function colorBuildings(thr){if(!wallPrim.ready)return;B.forEach((b,i)=>{const s=thr<=5&&b.f&&b.f>=thr?1:0;if(s===bState[i])return;bState[i]=s;const a=wallPrim.getGeometryInstanceAttributes('b'+i);if(a)a.color=C.ColorGeometryInstanceAttribute.toValue(s?C.Color.fromCssColorString('#ff5a6a'):b.wc);const r=roofPrim.ready&&roofPrim.getGeometryInstanceAttributes('r'+i);if(r)r.color=C.ColorGeometryInstanceAttribute.toValue(s?C.Color.fromCssColorString('#d92d44'):(b.house?b.rc:C.Color.fromCssColorString('#cfcac0')))})}

/* ================= labels & facilities ================= */
const iconC=(fill,ring,txt)=>{const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d');g.beginPath();g.arc(32,32,22,0,7);g.fillStyle=fill;g.fill();g.lineWidth=5;g.strokeStyle=ring;g.stroke();if(txt){g.fillStyle='#fff';g.font='900 20px "Noto Sans KR"';g.textAlign='center';g.textBaseline='middle';g.fillText(txt,32,33)}return c};
const ringC=(col)=>{const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d');g.beginPath();g.arc(64,64,56,0,7);g.lineWidth=6;g.strokeStyle=col;g.stroke();return c};
const LBL={font:'700 15px "Noto Sans KR"',style:C.LabelStyle.FILL_AND_OUTLINE,outlineWidth:4,outlineColor:new C.Color(0.02,0.04,0.08,0.9),heightReference:C.HeightReference.CLAMP_TO_GROUND,disableDepthTestDistance:Number.POSITIVE_INFINITY,verticalOrigin:C.VerticalOrigin.BOTTOM};
const hallEnts=T.halls.map(h=>viewer.entities.add({position:C.Cartesian3.fromDegrees(h.lon,h.lat),label:{...LBL,text:short(h.name),font:'500 13px "Noto Sans KR"',fillColor:C.Color.fromCssColorString('#e8eef8'),pixelOffset:new C.Cartesian2(0,-6),scaleByDistance:new C.NearFarScalar(800,1.1,12000,.75),distanceDisplayCondition:new C.DistanceDisplayCondition(0,14000)}}));
const P=T.points,KC={'농업 센서':'#e0a83a','공동 건조·선별':'#b87a3a','교통·생활 거점':'#8d6bff','DRT 호출벨':'#ff4fa3'};
const ZONES=T.zones,ZN=Object.keys(ZONES),ZONE_OF={};ZN.forEach(z=>ZONES[z].forEach(b=>ZONE_OF[b]=z));
const ZC={'서부 신일·도천권':'#ff4fa3','남부 금마권':'#3ee6c1'},ZS={'서부 신일·도천권':'서부','남부 금마권':'남부'};
const BIDS=Object.keys(T.bInfo).sort();
const facEnts={};for(const id in P){const p=P[id];const col=id.startsWith('B')?ZC[ZONE_OF[id]]:KC[p.kind]||'#fff';
 facEnts[id]=viewer.entities.add({position:C.Cartesian3.fromDegrees(p.lon,p.lat),billboard:{image:iconC(id==='T0'?'#ffffff':col,id==='T0'?'#8d6bff':'#ffffff',id==='T0'?'':''),width:id==='T0'?30:22,height:id==='T0'?30:22,heightReference:C.HeightReference.CLAMP_TO_GROUND,disableDepthTestDistance:Number.POSITIVE_INFINITY,verticalOrigin:C.VerticalOrigin.CENTER},
  label:{...LBL,text:id==='T0'?'T0 대합실':`${id} ${short(p.name).replace(/ 대표 밭 센서|건조·선별시설 /g,'')}`.slice(0,18),fillColor:C.Color.fromCssColorString(col),pixelOffset:new C.Cartesian2(0,-18),scaleByDistance:new C.NearFarScalar(800,1.15,15000,.8)},properties:{kind:'fac',id}})}
const pulse={};BIDS.forEach(b=>{pulse[b]=viewer.entities.add({position:C.Cartesian3.fromDegrees(P[b].lon,P[b].lat),billboard:{image:ringC(ZC[ZONE_OF[b]]),width:60,height:60,heightReference:C.HeightReference.CLAMP_TO_GROUND,disableDepthTestDistance:Number.POSITIVE_INFINITY,show:false}})});

/* ================= routes (sampled to terrain) ================= */
progress(.55,'DRT 경로를 지형에 맞추는 중…');
const mdist=(a,b)=>{const k=Math.cos(a[1]*Math.PI/180);return Math.hypot((b[0]-a[0])*111320*k,(b[1]-a[1])*110540)};
function densify(c,step=25){const o=[c[0]];for(let i=1;i<c.length;i++){const d=mdist(c[i-1],c[i]),n=Math.max(1,Math.ceil(d/step));for(let k=1;k<=n;k++)o.push([c[i-1][0]+(c[i][0]-c[i-1][0])*k/n,c[i-1][1]+(c[i][1]-c[i-1][1])*k/n])}return o}
const RT={};const allC=[];for(const k in T.routes){const c=densify(T.routes[k].c);RT[k]={c,t:T.routes[k].t,km:T.routes[k].km};allC.push(...c.map(p=>C.Cartographic.fromDegrees(p[0],p[1])))}
const rh=await sampleH(allC);{let i=0;for(const k in RT){const r=RT[k];r.h=r.c.map(()=>(rh[i++].height||0)+4);const cum=[0];for(let j=1;j<r.c.length;j++)cum.push(cum[j-1]+mdist(r.c[j-1],r.c[j]));r.cum=cum;r.L=cum[cum.length-1]}}
const revC=new Map();function rev(r){if(revC.has(r))return revC.get(r);const o={c:[...r.c].reverse(),h:[...r.h].reverse(),t:r.t,km:r.km};const cum=[0];for(let j=1;j<o.c.length;j++)cum.push(cum[j-1]+mdist(o.c[j-1],o.c[j]));o.cum=cum;o.L=cum[cum.length-1];revC.set(r,o);return o}
function idxAt(r,d){let lo=0,hi=r.cum.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(r.cum[m]<=d)lo=m;else hi=m}return[lo,hi]}
function along(r,f){const d=clamp(f,0,1)*r.L,[lo,hi]=idxAt(r,d),s=r.cum[hi]-r.cum[lo]||1,u=(d-r.cum[lo])/s;return[r.c[lo][0]+(r.c[hi][0]-r.c[lo][0])*u,r.c[lo][1]+(r.c[hi][1]-r.c[lo][1])*u,r.h[lo]+(r.h[hi]-r.h[lo])*u]}

/* ================= DRT engine ================= */
function makeDRT({veh=1,rate=.15,seed=7}){const r=rng(seed),calls=[];let id=0;
 for(const b of BIDS){const n=Math.max(2,Math.round(T.bInfo[b].popOut*.472*rate));for(let i=0;i<n;i++){const u=r();const t=Math.round(((u<.55?8.8+r()*3.2:13+r()*3.6))*60)*60;calls.push({id:id++,b,dir:'in',t});if(r()<.65){const t2=t+Math.round((1.5+r()*2)*60)*60;if(t2<18.6*3600)calls.push({id:id++,b,dir:'out',t:t2})}}}
 calls.sort((a,b)=>a.t-b.t);const vehs=[];
 for(const z of ZN){const bs=ZONES[z].slice().sort((a,b)=>RT[b+'-T0'].t-RT[a+'-T0'].t);const zc=calls.filter(c=>ZONE_OF[c.b]===z);const fixed=[{t:26400},{t:30000},{t:65400}];
  const V_=[];for(let k=0;k<veh;k++)V_.push({z,n:ZS[z]+(veh>1?k+1:''),col:ZC[z],segs:[],avail:23400,km:0});vehs.push(...V_);
  let guard=0;while(guard++<400){const v=V_.reduce((a,b)=>a.avail<=b.avail?a:b);const ta=v.avail;const pend=zc.filter(c=>!c.done);const fx=fixed.find(f=>!f.done&&f.t<=ta+60);
   if(!pend.length&&!fixed.some(f=>!f.done))break;const next=Math.min(...pend.map(c=>c.t),...fixed.filter(f=>!f.done).map(f=>f.t));if(!fx&&next>ta){v.avail=next;continue}
   let visit,depart=ta;if(fx){fx.done=true;visit=bs.slice();depart=Math.max(ta,fx.t)}else{visit=bs.filter(b=>pend.some(c=>c.b===b&&((c.dir==='in'&&c.t<=ta+600)||(c.dir==='out'&&c.t<=ta))));if(!visit.length){v.avail=ta+60;continue}}
   const leg=(a,b)=>a===b?null:a==='T0'?rev(RT[b+'-T0']):b==='T0'?RT[a+'-T0']:RT[a+'-'+b];
   let cur='T0',tc=depart;const ob=pend.filter(c=>c.dir==='out'&&c.t<=depart&&visit.includes(c.b));ob.forEach(c=>c.board=depart);const riders=[];
   for(const b of visit){const L=leg(cur,b);if(L){v.segs.push({r:L,ts:tc,te:tc+L.t,load:riders.length+ob.filter(c=>!c.done).length});tc+=L.t;v.km+=L.km}let nb=0;
    for(const c of pend)if(c.b===b&&c.dir==='in'&&!c.done&&c.t<=tc){c.pick=tc;c.wait=tc-c.t;c.done=true;riders.push(c);nb++}
    for(const c of ob)if(c.b===b&&!c.done){c.drop=tc;c.wait=c.board-c.t;c.ride=tc-c.board;c.done=true;nb++}
    const dw=60+nb*20;v.segs.push({at:b,ts:tc,te:tc+dw,load:riders.length});tc+=dw;cur=b}
   const L=leg(cur,'T0');if(L){v.segs.push({r:L,ts:tc,te:tc+L.t,load:riders.length});tc+=L.t;v.km+=L.km}riders.forEach(c=>{c.ride=tc-c.pick});v.avail=tc+120}}
 return{calls,vehs}}
const T0P=[P.T0.lon,P.T0.lat];
function vehAt(v,t){for(const s of v.segs){if(t>=s.ts&&t<s.te){if(s.r){const f=(t-s.ts)/(s.te-s.ts);return{p:along(s.r,f),q:along(s.r,Math.min(1,f+.004)),st:'운행 중',load:s.load,mv:1,seg:s}}const p=P[s.at];return{p:[p.lon,p.lat,0],st:short(p.name)+' 정차',load:s.load,mv:0}}if(s.ts>t)break}return{p:[T0P[0],T0P[1],0],st:'대합실 대기',load:0,mv:0}}
function trail(v,t,len=1200){const pts=[];for(const s of v.segs){if(!s.r||s.te<t-len||s.ts>t)continue;const a=clamp((t-len-s.ts)/(s.te-s.ts),0,1),b=clamp((t-s.ts)/(s.te-s.ts),0,1);if(b<=a)continue;const da=a*s.r.L,db=b*s.r.L;const p0=along(s.r,a);pts.push(p0);for(let i=0;i<s.r.c.length;i++)if(s.r.cum[i]>da&&s.r.cum[i]<db)pts.push([s.r.c[i][0],s.r.c[i][1],s.r.h[i]]);pts.push(along(s.r,b))}return pts}
function drtStats(M,t){const done=M.calls.filter(c=>(c.pick!=null&&c.pick<=t)||(c.board!=null&&c.board<=t));const w=done.map(c=>c.wait).filter(x=>x!=null);const km=M.vehs.reduce((s,v)=>s+v.segs.filter(g=>g.r&&g.te<=t).reduce((a,g)=>a+g.r.km,0),0);
 return{called:M.calls.filter(c=>c.t<=t).length,done:done.length,wait:w.length?w.reduce((a,b)=>a+b,0)/w.length:0,maxw:w.length?Math.max(...w):0,km,moving:M.vehs.filter(v=>vehAt(v,t).mv).length}}

/* vehicles (glTF vans) + glowing trails */
const vehEnts=[];
function buildVehEnts(M){vehEnts.forEach(e=>{viewer.entities.remove(e.model);viewer.entities.remove(e.tr);viewer.entities.remove(e.glow)});vehEnts.length=0;
 M.vehs.forEach((v,i)=>{const key=v.z.startsWith('서부')?'west':'south';const st={pos:C.Cartesian3.fromDegrees(T0P[0],T0P[1],0),ori:C.Transforms.headingPitchRollQuaternion(C.Cartesian3.fromDegrees(T0P[0],T0P[1]),new C.HeadingPitchRoll(0,0,0)),pts:[]};
  const model=viewer.entities.add({position:new C.CallbackProperty(()=>st.pos,false),orientation:new C.CallbackProperty(()=>st.ori,false),model:{uri:MODELS[key],minimumPixelSize:34,maximumScale:60,heightReference:C.HeightReference.CLAMP_TO_GROUND,shadows:C.ShadowMode.ENABLED,silhouetteColor:C.Color.WHITE.withAlpha(.6),silhouetteSize:1},
   label:{...LBL,text:v.n+' DRT',font:'700 13px "Noto Sans KR"',fillColor:C.Color.fromCssColorString(v.col),pixelOffset:new C.Cartesian2(0,-34)},properties:{kind:'veh',i}});
  const pos=new C.CallbackProperty(()=>st.pts.length>1?st.pts:[st.pos,st.pos],false);
  const glow=viewer.entities.add({polyline:{positions:pos,width:16,arcType:C.ArcType.NONE,material:new C.PolylineGlowMaterialProperty({glowPower:.25,color:C.Color.fromCssColorString(v.col).withAlpha(.55)})}});
  const tr=viewer.entities.add({polyline:{positions:pos,width:4,arcType:C.ArcType.NONE,material:C.Color.fromCssColorString(v.col)}});
  vehEnts.push({v,st,model,tr,glow})})}
function updateVeh(t){vehEnts.forEach(e=>{const a=vehAt(e.v,t);e.st.pos=C.Cartesian3.fromDegrees(a.p[0],a.p[1],0);if(a.mv){const h=Math.atan2((a.q[0]-a.p[0])*Math.cos(a.p[1]*Math.PI/180),a.q[1]-a.p[1]);e.st.ori=C.Transforms.headingPitchRollQuaternion(C.Cartesian3.fromDegrees(a.p[0],a.p[1],a.p[2]),new C.HeadingPitchRoll(h-Math.PI/2,0,0))}e.a=a;
 const tp=trail(e.v,t);e.st.pts=tp.map(p=>C.Cartesian3.fromDegrees(p[0],p[1],p[2]+2))})}

/* ================= flood water (shoreline-height surfaces, animated water material) ================= */
progress(.7,'범람 수면을 지형에 맞추는 중…');
const waterMat=()=>new C.Material({fabric:{type:'Water',uniforms:{baseWaterColor:new C.Color(0.40,0.33,0.22,0.86),blendColor:new C.Color(0.30,0.36,0.30,0.9),normalMap:C.buildModuleUrl('Assets/Textures/waterNormals.jpg'),frequency:1800,animationSpeed:0.012,amplitude:6,specularIntensity:0.55,fadeFactor:1}}});
const WATER={};
{const levels=['5','4','3','2','1'];const req=[],meta=[];
 for(const k of levels)for(const poly of T.flood[k]||[]){const o=poly[0],step=Math.max(1,Math.floor(o.length/40));const ids=[];for(let i=0;i<o.length;i+=step){ids.push(req.length);req.push(C.Cartographic.fromDegrees(o[i][0],o[i][1]))}meta.push({k,poly,ids})}
 const hs=await sampleH(req);
 for(const k of levels)WATER[k]={inst:[],prim:null,off:0};
 meta.forEach(m=>{const v=m.ids.map(i=>hs[i].height||0).sort((a,b)=>a-b);const surf=v[Math.floor(v.length*.3)]+.5;const hier=new C.PolygonHierarchy(C.Cartesian3.fromDegreesArray(m.poly[0].flat()),m.poly.slice(1).map(h=>new C.PolygonHierarchy(C.Cartesian3.fromDegreesArray(h.flat()))));
  try{WATER[m.k].inst.push(new C.GeometryInstance({geometry:new C.PolygonGeometry({polygonHierarchy:hier,height:surf,vertexFormat:C.EllipsoidSurfaceAppearance.VERTEX_FORMAT})}))}catch(e){}});
 for(const k of levels){const W=WATER[k];if(!W.inst.length)continue;W.prim=scene.primitives.add(new C.Primitive({geometryInstances:W.inst,appearance:new C.EllipsoidSurfaceAppearance({material:waterMat(),aboveGround:true}),show:false,asynchronous:true}))}}
const UPV=C.Cartesian3.normalize(CEN,new C.Cartesian3());
function setWater(L){const cur=6-Math.min(5,Math.max(1,Math.ceil(L)));for(const k in WATER){const W=WATER[k];if(!W.prim)continue;const kk=+k;const show=L>0.02&&kk===cur;W.prim.show=show;if(show){const a=clamp(L-(5-kk),0,1);const dz=(a-1)*2.5;W.prim.modelMatrix=C.Matrix4.fromTranslation(C.Cartesian3.multiplyByScalar(UPV,dz,new C.Cartesian3()))}}}

/* ================= flood engine ================= */
function floodSeries(sc){const N=144,o=[],r=rng(sc.length*31+5),rain=[];let cum=0;
 for(let i=0;i<N;i++){const h=i/6;let v;if(sc==='light')v=(h>5&&h<23?2:.5)+10*Math.exp(-(((h-14)/3)**2));else if(sc==='heavy')v=(h>4?3:1)+8*Math.exp(-(((h-11)/2)**2))+52*Math.exp(-(((h-16)/2.2)**2));else v=(h>3?4:1.5)+12*Math.exp(-(((h-10)/2)**2))+85*Math.exp(-(((h-16)/2.6)**2));rain.push(v*(.85+r()*.3))}
 for(let i=0;i<N;i++){cum+=rain[i]/6;let c24=0;for(let j=Math.max(0,i-156);j<=i-12;j++)c24+=rain[j]/6;o.push({rain:rain[i],cum,L:clamp((c24-60)/300*5,0,5.3)})}return o}
const thrOf=L=>L<=0.02?99:6-Math.min(5,Math.ceil(L));
const aff=new Map();function affected(thr){if(thr>5)return{n:0,by:{}};if(aff.has(thr))return aff.get(thr);const by={};let n=0;for(const b of B)if(b.f&&b.f>=thr){n++;by[b.r]=(by[b.r]||0)+1}const o={n,by};aff.set(thr,o);return o}

/* ================= scenes / UI ================= */
const S={scene:'intro',t:14*3600,t0:0,t1:1,playing:false,drt:{veh:1,rate:.15},flood:{sc:'heavy'}};
let M=makeDRT(S.drt),FS=floodSeries(S.flood.sc);buildVehEnts(M);
const kp=l=>`<div class="kpis">${l.map(([v,lab,c])=>`<div class="kpi ${c||''}"><b>${v}</b><span>${lab}</span></div>`).join('')}</div>`;
function seg(sel,key,cur,fn){$$(sel+' button').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset[key])===String(cur));b.onclick=()=>{$$(sel+' button').forEach(x=>x.setAttribute('aria-pressed',x===b));fn(b.dataset[key])}})}
const homes=B.filter(b=>isHouse(b.u)).length,multi=B.filter(b=>b.fl>=2).length;
function panel(){if(S.scene==='intro'){$('#pin').innerHTML=`<h1>판운리를 뺀 주천면 · 반경 6.1km</h1><p class="lede">실제 지형과 항공사진 위에, 건축물대장 층수로 세운 건물 ${fmt(B.length)}동이 서 있다. 주천강을 따라 내려앉은 마을과 산 사이 밭이 이 지역의 모양을 정한다.</p>
 ${kp([['3,632명','주천면 인구 (SGIS 2024)'],['47.2%','65세 이상'],[fmt(B.length)+'동','범위 안 건물 · 2층 이상 '+multi],['22곳','범위 안 마을회관']])}
 <p class="note">드래그 이동 · 우클릭 드래그(또는 Ctrl+드래그) 회전·기울이기 · 휠 확대. 땅 아래로는 들어가지 않는다. 숫자 1·2·3 장면 전환 · 스페이스 재생 · Q/E 45° 회전 · R 자동 회전 · N 북쪽 위로.</p>`}
 else if(S.scene==='drt'){$('#pin').innerHTML=`<h1>회관 벨 하나로 대합실까지</h1><p class="lede">서부(신일·도천)와 남부(금마) 권역 5개 마을회관 호출벨. 승합차가 실제 도로로 어르신을 대합실까지 태워 나른다. 빛의 꼬리는 지난 20분 경로다.</p>
 <div class="seg" id="sVeh"><span>권역당 차량</span><button data-v="1">1대</button><button data-v="2">2대</button></div>
 <div class="seg" id="sRate"><span>하루 이용률</span><button data-r="0.1">10%</button><button data-r="0.15">15%</button><button data-r="0.25">25%</button></div>
 <div id="k"></div><div class="fig"><svg id="ch"></svg></div><ul class="log" id="lg"></ul>
 <p class="note">수요 = 회관 주변 정류장 500m 밖 인구 × 65세 이상 47.2% × 이용률. 경로는 도로명주소 도로망 최단시간. 고정편 07:20·08:20·18:10.</p>`;
 seg('#sVeh','v',S.drt.veh,v=>{S.drt.veh=+v;M=makeDRT(S.drt);buildVehEnts(M);resetLog();drawChart();frame(true)});seg('#sRate','r',S.drt.rate,v=>{S.drt.rate=+v;M=makeDRT(S.drt);buildVehEnts(M);resetLog();drawChart();frame(true)})}
 else{$('#pin').innerHTML=`<h1>주천강이 넘치면 어디까지 잠기나</h1><p class="lede">200년 빈도 하천범람지도의 침수 등급을 따라, 비가 쌓일수록 강 쪽 낮은 땅부터 물이 찬다. 붉게 바뀌는 건물이 잠기는 건물이다.</p>
 <div class="seg" id="sSc"><span>강우</span><button data-s="light">보통 비</button><button data-s="heavy">집중호우</button><button data-s="extreme">극한호우</button></div>
 <div id="k"></div><div class="fig"><svg id="ch"></svg></div><ul class="log" id="lg"></ul>
 <p class="note">수면 높이 = 범람 범위 가장자리의 실제 지형 고도. 범람 범위는 범람지도 등급을 강 쪽부터 드러내는 단순화. 강우는 가상 시나리오.</p>`;
 seg('#sSc','s',S.flood.sc,v=>{S.flood.sc=v;FS=floodSeries(v);aff.clear();resetLog();drawChart();frame(true)})}}
function legend(){const L=S.scene==='drt'?[...ZN.map(z=>[ZC[z],z+' DRT','']),['#ffffff','T0 대합실','dot']]:S.scene==='flood'?[['#8a7350','범람 수면 (200년 빈도)',''],['#ff5a6a','잠긴 건물','dot']]:[['#ffffff','분석 범위 (판운리 제외)',''],['#e0a83a','농업 센서','dot'],['#b87a3a','건조·선별시설','dot'],['#ff4fa3','DRT 호출벨','dot']];
 $('#legend').innerHTML=L.map(([c,t,k])=>`<div><i class="${k}" style="background:${c}"></i>${t}</div>`).join('')+'<div style="color:#9aabc4">건물 높이: 건축물대장 층수</div>'}
let chX=null;
function drawChart(){const s=$('#ch');if(!s)return;const w=s.clientWidth||340,h=s.clientHeight||140,pl=30,pr=26,pt=8,pb=20,iw=w-pl-pr,ih=h-pt-pb;let o='';
 if(S.scene==='drt'){const X=t=>pl+(t-S.t0)/(S.t1-S.t0)*iw;chX=X;const tot=M.calls.length||1,Y=v=>pt+ih-v/tot*ih;const st=[];for(let t=S.t0;t<=S.t1;t+=600)st.push(t);
  const a=st.map(t=>M.calls.filter(c=>c.t<=t).length),b=st.map(t=>M.calls.filter(c=>(c.pick??c.board??1e9)<=t).length);
  for(let hh=8;hh<=20;hh+=4)o+=`<text x="${X(hh*3600)}" y="${h-4}" fill="#9aabc4" font-size="11" text-anchor="middle">${hh}시</text>`;
  const pth=(arr,c,wd)=>`<path d="${arr.map((v,i)=>(i?'L':'M')+X(st[i]).toFixed(1)+' '+Y(v).toFixed(1)).join('')}" fill="none" stroke="${c}" stroke-width="${wd}"/>`;
  o+=pth(a,'#9aabc4',1.5)+pth(b,'#3ee6c1',2.5)+`<text x="${pl}" y="${pt+10}" fill="#3ee6c1" font-size="11">태운 호출</text><text x="${pl+62}" y="${pt+10}" fill="#9aabc4" font-size="11">들어온 호출</text>`}
 else if(S.scene==='flood'){const N=FS.length,X=i=>pl+i/(N-1)*iw;chX=t=>X(t/600);const YR=v=>pt+ih-Math.min(90,v)/90*ih,YL=v=>pt+ih-v/5.3*ih;
  for(let hh=0;hh<=24;hh+=6)o+=`<text x="${X(Math.min(N-1,hh*6))}" y="${h-4}" fill="#9aabc4" font-size="11" text-anchor="middle">${hh}시</text>`;
  FS.forEach((x,i)=>o+=`<rect x="${X(i)}" y="${YR(x.rain)}" width="${Math.max(1,iw/N)}" height="${pt+ih-YR(x.rain)}" fill="rgba(77,181,255,.45)"/>`);
  o+=`<path d="${FS.map((x,i)=>(i?'L':'M')+X(i).toFixed(1)+' '+YL(x.L).toFixed(1)).join('')}" fill="none" stroke="#e7c48a" stroke-width="2.4"/><text x="${pl}" y="${pt+10}" fill="#4db5ff" font-size="11">시간당 강우</text><text x="${pl+66}" y="${pt+10}" fill="#e7c48a" font-size="11">범람 단계</text>`}
 o+=`<line id="cur" y1="${pt}" y2="${pt+ih}" stroke="#ff8a3d" stroke-width="2"/>`;s.innerHTML=o;moveCur()}
function moveCur(){const c=$('#cur');if(c&&chX){const x=chX(S.t);c.setAttribute('x1',x);c.setAttribute('x2',x)}}
new ResizeObserver(()=>drawChart()).observe($('#panel'));
function toast(msg,lv='warn',who=''){const el=document.createElement('div');el.className='toast glass '+lv;el.innerHTML=(who?`<b>${who}</b>`:'')+msg;const b=$('#toast');b.prepend(el);while(b.children.length>3)b.lastChild.remove();setTimeout(()=>el.remove(),6000)}
function events(){const ev=[];if(S.scene==='drt'){for(const c of M.calls){if(c.dir!=='in'||c.pick==null)continue;ev.push({t:c.t,msg:`${c.b} ${short(P[c.b].name)} 호출`,quiet:1});ev.push({t:c.pick,lv:c.wait>1800?'warn':'',msg:`${c.b} 탑승 · 대기 ${Math.round(c.wait/60)}분`,quiet:c.wait<=1800,who:ZS[ZONE_OF[c.b]]+' DRT'})}[[26400,'고정편 07:20 출발'],[30000,'고정편 08:20 출발'],[65400,'고정편 18:10 · 귀가편']].forEach(([t,m])=>ev.push({t,msg:m,who:'운행 계획'}))}
 else if(S.scene==='flood'){let pt=99;FS.forEach((x,i)=>{const th=thrOf(x.L);if(th<pt&&th<=5){const A=affected(th);ev.push({t:i*600,lv:th<=3?'alert':'warn',who:'하천 범람',msg:`범람 등급 ${th}까지 확대 · 건물 ${A.n}동 잠김 (주천리 ${A.by['주천리']||0})`})}pt=Math.min(pt,th)});
  FS.forEach((x,i)=>{if(i&&x.rain>=30&&FS[i-1].rain<30)ev.push({t:i*600,lv:'warn',who:'기상',msg:`시간당 ${Math.round(x.rain)}mm 강한 비`})})}
 return ev.sort((a,b)=>a.t-b.t)}
let EV=[],fired=new Set();function resetLog(){EV=events();fired=new Set();renderLog(false)}
function renderLog(play){const lg=$('#lg');if(!lg)return;const vis=EV.filter(e=>e.t<=S.t);vis.forEach(e=>{const k=e.t+e.msg;if(!fired.has(k)){fired.add(k);if(play&&!e.quiet&&e.t>S.t-1800)toast(e.msg,e.lv||'warn',(e.who?e.who+' · ':'')+hhmm(e.t))}});lg.innerHTML=vis.slice(-7).reverse().map(e=>`<li class="${e.lv||''}"><time>${hhmm(e.t)}</time><span>${e.msg}</span></li>`).join('')}

/* rain overlay */
const rc=$('#rain'),rx=rc.getContext('2d');let RAIN=0;const drops=[];for(let i=0;i<1100;i++)drops.push({x:Math.random(),y:Math.random(),l:.6+Math.random()*.8,s:.7+Math.random()*.6});
const rs=()=>{rc.width=innerWidth;rc.height=innerHeight};addEventListener('resize',rs);rs();
function drawRain(dt){rx.clearRect(0,0,rc.width,rc.height);if(RAIN<2)return;const n=Math.round(clamp(RAIN/70,.1,1)*drops.length),W=rc.width,H=rc.height;rx.strokeStyle=`rgba(200,220,240,${clamp(.15+RAIN/220,.15,.45)})`;rx.lineWidth=1;rx.beginPath();for(let i=0;i<n;i++){const d=drops[i];d.y+=dt*1.7*d.s;if(d.y>1){d.y-=1;d.x=Math.random()}const x=d.x*W,y=d.y*H;rx.moveTo(x,y);rx.lineTo(x-4*d.l,y+22*d.l)}rx.stroke()}

/* frame */
let lastUI=0;
function frame(force){const t=S.t;setClock(S.scene==='intro'?t:t);
 const drt=S.scene==='drt',fl=S.scene==='flood';
 vehEnts.forEach(e=>{e.model.show=drt;e.tr.show=drt;e.glow.show=drt});BIDS.forEach(b=>pulse[b].billboard.show=false);
 if(drt){updateVeh(t);const pul=(performance.now()%1400)/1400;for(const c of M.calls)if(c.dir==='in'&&c.t<=t&&!(c.pick<=t)){const p=pulse[c.b].billboard;p.show=true;p.width=30+pul*70;p.height=30+pul*70;p.color=C.Color.WHITE.withAlpha(1-pul)}}
 let rainV=0,thr=99;if(fl){const x=FS[clamp(Math.floor(t/600),0,FS.length-1)];rainV=x.rain;thr=thrOf(x.L);setWater(x.L)}else setWater(0);
 colorBuildings(fl?thr:99);RAIN=rainV;const rk=clamp(rainV/60,0,1);
 scene.fog.density=1.6e-4+rk*9e-4;globe.atmosphereBrightnessShift=-rk*.35;globe.atmosphereSaturationShift=-rk*.5;scene.skyAtmosphere.brightnessShift=-rk*.45;scene.skyAtmosphere.saturationShift=-rk*.6;viewer.shadowMap.darkness=.45+rk*.4;
 const now=performance.now();if(force||now-lastUI>150){lastUI=now;ui()}}
function ui(){$('#clock').textContent=hhmm(S.t);$('#tr').value=S.t;moveCur();if(!$('#k'))return;
 if(S.scene==='drt'){const s=drtStats(M,S.t);$('#k').innerHTML=kp([[`${s.done}<small> / ${s.called}</small>`,'태운 호출 / 들어온 호출'],[`${(s.wait/60).toFixed(1)}분`,`평균 대기 · 최대 ${Math.round(s.maxw/60)}분`,s.maxw>3600?'warn':''],[`${s.moving}<small> / ${M.vehs.length}대</small>`,'지금 달리는 차량'],[`${Math.round(s.km)}km`,'누적 운행 거리']])}
 else if(S.scene==='flood'){const x=FS[clamp(Math.floor(S.t/600),0,FS.length-1)],th=thrOf(x.L),A=affected(th);$('#k').innerHTML=kp([[`${Math.round(x.rain)}mm/h`,`시간당 강우 · 누적 ${Math.round(x.cum)}mm`],[th<=5?`${th}등급`:'–','범람 범위 (5 → 1로 넓어짐)',th<=3?'alert':th<=5?'warn':''],[`${fmt(A.n)}동`,'잠긴 건물',A.n?'alert':''],[`${A.by['주천리']||0}동`,'그중 주천리']])}
 renderLog(S.playing)}
let lastTs=performance.now();
viewer.clock.onTick.addEventListener(()=>{});
scene.preRender.addEventListener(()=>{const ts=performance.now(),dt=Math.min(.1,(ts-lastTs)/1000);lastTs=ts;
 if(S.playing){const rate=(S.scene==='drt'?600:S.scene==='flood'?1500:1800)*(+$('#spd').value);S.t=S.t+dt*rate;if(S.t>=S.t1){S.t=S.t1;S.playing=false;$('#play').textContent='재생'}frame()}else if(S.scene==='drt')frame();drawRain(dt)});
$('#play').onclick=()=>{if(S.t>=S.t1){S.t=S.t0;resetLog()}S.playing=!S.playing;$('#play').textContent=S.playing?'일시정지':'재생'};
$('#tr').oninput=e=>{S.t=+e.target.value;S.playing=false;$('#play').textContent='재생';renderLog(false);frame(true)};
const VIEW={intro:{lon:T.center[0],lat:T.center[1]-.012,h:0,head:10,pitch:-34,range:15000},drt:{lon:128.252,lat:37.250,head:-15,pitch:-38,range:11000},flood:{lon:128.2715,lat:37.2712,head:205,pitch:-28,range:2600}};
function fly(v,dur=3){const target=C.Cartesian3.fromDegrees(v.lon,v.lat,250);camera.flyToBoundingSphere(new C.BoundingSphere(target,10),{offset:new C.HeadingPitchRange(C.Math.toRadians(v.head),C.Math.toRadians(v.pitch),v.range),duration:dur})}
function setScene(s,dur=3){if(typeof setAuto==='function'&&ROT.auto)setAuto(false);S.scene=s;S.playing=false;$('#play').textContent='재생';$$('#tabs button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.s===s));
 if(s==='intro'){S.t0=6*3600;S.t1=20*3600;S.t=14*3600}else if(s==='drt'){S.t0=6.5*3600;S.t1=20*3600;S.t=8*3600}else{S.t0=0;S.t1=24*3600-600;S.t=12*3600}
 $('#tr').min=S.t0;$('#tr').max=S.t1;$('#tr').step=s==='flood'?600:60;$('#toast').innerHTML='';panel();legend();resetLog();drawChart();fly(VIEW[s],dur);frame(true)}
$('#tabs').onclick=e=>{const b=e.target.closest('button');if(b)setScene(b.dataset.s)};
addEventListener('keydown',e=>{if(e.target.matches('input,select'))return;if(e.code==='Space'){e.preventDefault();$('#play').click()}else if(e.key==='1')setScene('intro');else if(e.key==='2')setScene('drt');else if(e.key==='3')setScene('flood')});
// tooltips
const tip=$('#tip');const hnd=new C.ScreenSpaceEventHandler(scene.canvas);
hnd.setInputAction(m=>{const p=scene.pick(m.endPosition);let h='';if(p&&p.id){if(typeof p.id==='string'&&/^[br]\d/.test(p.id)){const b=B[+p.id.slice(1)];h=`<b>${b.u||'건물'}</b><br>${b.fl>=2?b.fl+'층 · ':''}높이 약 ${b.h}m${b.f?`<br>200년 범람 등급 ${b.f}`:''}`}else if(p.id.properties){const k=p.id.properties.kind&&p.id.properties.kind.getValue();if(k==='fac'){const id=p.id.properties.id.getValue(),q=P[id];h=`<b>${id} · ${short(q.name)}</b><br>${q.desc}`;if(T.bInfo[id])h+=`<br>지금은 정류장까지 걸어서 ${Math.round(T.bInfo[id].stopDist/.8/60)}분`}else if(k==='veh'){const e=vehEnts[p.id.properties.i.getValue()];h=`<b>${e.v.z} DRT</b><br>${e.a?e.a.st:''} · 탑승 ${e.a?e.a.load:0}명`}}}
 if(h){tip.innerHTML=h;tip.style.display='block';tip.style.left=Math.min(innerWidth-300,m.endPosition.x+16)+'px';tip.style.top=(m.endPosition.y-10)+'px'}else tip.style.display='none'},C.ScreenSpaceEventType.MOUSE_MOVE);



/* ================= graphics quality (supersampling + CAS sharpen) ================= */
const casStage=scene.postProcessStages.add(new C.PostProcessStage({name:'cas',uniforms:{sharp:.35},fragmentShader:`
uniform sampler2D colorTexture;uniform float sharp;in vec2 v_textureCoordinates;
void main(){vec2 p=1.0/czm_viewport.zw;vec2 uv=v_textureCoordinates;vec4 C0=texture(colorTexture,uv);vec3 c=C0.rgb;
vec3 a=texture(colorTexture,uv+vec2(0.,-p.y)).rgb,b=texture(colorTexture,uv+vec2(-p.x,0.)).rgb,d=texture(colorTexture,uv+vec2(p.x,0.)).rgb,e=texture(colorTexture,uv+vec2(0.,p.y)).rgb;
vec3 mn=min(min(min(a,b),min(d,e)),c),mx=max(max(max(a,b),max(d,e)),c);vec3 amp=sqrt(clamp(min(mn,1.0-mx)/max(mx,vec3(1e-4)),0.,1.));
vec3 w=-amp/mix(8.0,5.0,sharp);vec3 o=(c+w*(a+b+d+e))/(1.0+4.0*w);out_FragColor=vec4(clamp(o,0.,1.),C0.a);}`}));
const QUAL={
 max:{label:'최고',ss:2.0,sse:1.0,msaa:8,sharp:.35,anis:16},
 bal:{label:'균형',ss:1.0,sse:1.5,msaa:4,sharp:.25,anis:8},
 perf:{label:'성능',ss:.67,sse:2.5,msaa:1,sharp:.6,anis:4}};
viewer.useBrowserRecommendedResolution=false;globe.preloadSiblings=true;globe.loadingDescendantLimit=40;
function setQuality(k){const q=QUAL[k]||QUAL.max;const dpr=window.devicePixelRatio||1;
 // 목표 렌더 배율(q.ss) = 화면 픽셀 대비. 4K×1.3 이상의 내부 해상도는 넘지 않게 제한
 let s=q.ss/dpr*dpr;const px=innerWidth*innerHeight*dpr*dpr;const cap=Math.sqrt(3840*2160*1.3/px);s=Math.min(s,Math.max(1,cap));if(q.ss<1)s=q.ss;
 viewer.resolutionScale=s;globe.maximumScreenSpaceError=q.sse;try{scene.msaaSamples=q.msaa}catch(e){}
 casStage.uniforms.sharp=q.sharp;casStage.enabled=true;
 try{localStorage.setItem('jc_quality',k)}catch(e){}const sel=$('#q');if(sel)sel.value=k}
let QK='max';try{QK=localStorage.getItem('jc_quality')||'max'}catch(e){}
setQuality(QK);$('#q').onchange=e=>setQuality(e.target.value);addEventListener('resize',()=>setQuality($('#q').value));

/* ================= rotation ================= */
const ROT={auto:false,anim:null};
function pivot(){const c=scene.canvas,p=scene.pickPosition(new C.Cartesian2(c.clientWidth/2,c.clientHeight/2));if(p&&C.defined(p))return p;const r=camera.getPickRay(new C.Cartesian2(c.clientWidth/2,c.clientHeight/2));return globe.pick(r,scene)||C.Cartesian3.fromDegrees(T.center[0],T.center[1])}
function orbit(rad){const t=pivot();const off=C.Cartesian3.subtract(camera.positionWC,t,new C.Cartesian3());const range=C.Cartesian3.magnitude(off);const enu=C.Transforms.eastNorthUpToFixedFrame(t);const inv=C.Matrix4.inverseTransformation(enu,new C.Matrix4());const lo=C.Matrix4.multiplyByPointAsVector(inv,off,new C.Cartesian3());const head=Math.atan2(-lo.x,-lo.y),pitch=-Math.asin(C.Math.clamp(lo.z/range,-1,1));return{t,range,head,pitch}}
function rotateBy(deg,dur=.6){const o=orbit();if(ROT.anim)cancelAnimationFrame(ROT.anim);const h0=o.head,h1=h0+C.Math.toRadians(deg),t0=performance.now();const step=()=>{const u=Math.min(1,(performance.now()-t0)/(dur*1000)),e=u<.5?2*u*u:1-(-2*u+2)**2/2;camera.lookAt(o.t,new C.HeadingPitchRange(h0+(h1-h0)*e,o.pitch,o.range));if(u<1)ROT.anim=requestAnimationFrame(step);else{camera.lookAtTransform(C.Matrix4.IDENTITY);ROT.anim=null}};step()}
function northUp(){const o=orbit();let d=-C.Math.toDegrees(o.head)%360;if(d>180)d-=360;if(d<-180)d+=360;rotateBy(d,.8)}
function setAuto(on){ROT.auto=on;$('#ra').setAttribute('aria-pressed',on);if(on){ROT.o=orbit();camera.lookAt(ROT.o.t,new C.HeadingPitchRange(ROT.o.head,ROT.o.pitch,ROT.o.range))}else camera.lookAtTransform(C.Matrix4.IDENTITY)}
scene.preRender.addEventListener((sc,time)=>{if(!ROT.auto)return;const ts=performance.now(),dt=ROT.last?Math.min(.1,(ts-ROT.last)/1000):0;ROT.last=ts;camera.rotateRight(-C.Math.toRadians(4)*dt)});
$('#rl').onclick=()=>{setAuto(false);rotateBy(-45)};$('#rr').onclick=()=>{setAuto(false);rotateBy(45)};$('#ra').onclick=()=>{ROT.last=0;setAuto(!ROT.auto)};$('#rn').onclick=()=>{setAuto(false);northUp()};
['mousedown','wheel','touchstart'].forEach(ev=>scene.canvas.addEventListener(ev,()=>{if(ROT.auto)setAuto(false)},{passive:true}));
addEventListener('keydown',e=>{if(e.target.matches('input,select'))return;const k=e.key.toLowerCase();if(k==='q'){setAuto(false);rotateBy(-45)}else if(k==='e'){setAuto(false);rotateBy(45)}else if(k==='r'){ROT.last=0;setAuto(!ROT.auto)}else if(k==='n'){setAuto(false);northUp()}});

/* start */
progress(.9,'장면 준비 중…');
camera.setView({destination:C.Cartesian3.fromDegrees(T.center[0],T.center[1]-.6,90000),orientation:{heading:0,pitch:C.Math.toRadians(-45),roll:0}});
setScene('intro',0.1);
let ready=false;const done=()=>{if(ready)return;ready=true;progress(1);$('#load').style.opacity=0;setTimeout(()=>$('#load').style.display='none',900);setScene('intro',5)};
const chk=setInterval(()=>{if(globe.tilesLoaded&&wallPrim.ready){clearInterval(chk);done()}},400);setTimeout(done,25000);
window.__cz={viewer,S,setScene,frame,B,wallPrim,colorBuildings,bState,get M(){return M}};
})().catch(e=>{console.error(e);const m=document.getElementById('loadmsg');if(m)m.textContent='오류: '+e.message});
