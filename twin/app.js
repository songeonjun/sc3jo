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
const viewer=new C.Viewer('cz',{baseLayer:false,baseLayerPicker:false,geocoder:false,homeButton:false,sceneModePicker:false,navigationHelpButton:false,animation:false,timeline:false,fullscreenButton:false,infoBox:false,selectionIndicator:false,shadows:!window.LITE,terrainShadows:window.LITE?C.ShadowMode.DISABLED:C.ShadowMode.ENABLED,msaaSamples:window.LITE?1:4});
const LITE=!!window.LITE,PF=LITE?.4:1;
const scene=viewer.scene,globe=scene.globe,camera=viewer.camera;
scene.highDynamicRange=!LITE;scene.postProcessStages.fxaa.enabled=true;
globe.enableLighting=true;globe.depthTestAgainstTerrain=true;globe.showGroundAtmosphere=true;globe.maximumScreenSpaceError=LITE?3:1.5;globe.tileCacheSize=LITE?150:400;
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
 viewer.imageryLayers.addImageryProvider(new C.UrlTemplateImageryProvider({url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',maximumLevel:17,credit:'Esri, Maxar'}));SRC.imagery='Esri 위성';}
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
const MASK=scene.groundPrimitives.add(new C.GroundPrimitive({geometryInstances:new C.GeometryInstance({geometry:new C.PolygonGeometry({polygonHierarchy:new C.PolygonHierarchy(C.Cartesian3.fromDegreesArray([127.9,36.95,128.7,36.95,128.7,37.6,127.9,37.6]),[new C.PolygonHierarchy(circPos)])}),attributes:{color:C.ColorGeometryInstanceAttribute.fromColor(new C.Color(0.03,0.05,0.09,0.62))}}),appearance:new C.PerInstanceColorAppearance({flat:true,translucent:true})}));
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
const fixH=h=>{const ok=v=>v>120;let last=null;for(let i=0;i<h.length;i++){if(ok(h[i]))last=h[i];else if(last!=null)h[i]=last}last=null;for(let i=h.length-1;i>=0;i--){if(ok(h[i]))last=h[i];else if(last!=null&&!ok(h[i]))h[i]=last}return h};
const RT={};const allC=[];for(const k in T.routes){let c0=T.routes[k].c.slice();const [ra,rb]=k.split('-');if(ra.startsWith('B')&&c0.length>2)c0=c0.slice(1);if(rb.startsWith('B')&&c0.length>2)c0=c0.slice(0,-1);const c=densify(c0);RT[k]={c,t:T.routes[k].t,km:T.routes[k].km};allC.push(...c.map(p=>C.Cartographic.fromDegrees(p[0],p[1])))}
const rh=await sampleH(allC);{let i=0;for(const k in RT){const r=RT[k];r.h=fixH(r.c.map(()=>(rh[i++].height||0)+4));const cum=[0];for(let j=1;j<r.c.length;j++)cum.push(cum[j-1]+mdist(r.c[j-1],r.c[j]));r.cum=cum;r.L=cum[cum.length-1]}}
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
    const dw=60+nb*20;v.segs.push({at:b,ts:tc,te:tc+dw,load:riders.length,pp:L?[L.c[L.c.length-1][0],L.c[L.c.length-1][1],L.h[L.h.length-1]]:null});tc+=dw;cur=b}
   const L=leg(cur,'T0');if(L){v.segs.push({r:L,ts:tc,te:tc+L.t,load:riders.length});tc+=L.t;v.km+=L.km}riders.forEach(c=>{c.ride=tc-c.pick});v.avail=tc+120}}
 return{calls,vehs}}
const T0P=[P.T0.lon,P.T0.lat];
function vehAt(v,t){for(const s of v.segs){if(t>=s.ts&&t<s.te){if(s.r){const f=(t-s.ts)/(s.te-s.ts);return{p:along(s.r,f),q:along(s.r,Math.min(1,f+.004)),st:'운행 중',load:s.load,mv:1,seg:s}}const p=P[s.at];return{p:s.pp||[p.lon,p.lat,0],st:short(p.name)+' 정차',load:s.load,mv:0}}if(s.ts>t)break}return{p:[T0P[0],T0P[1],0],st:'대합실 대기',load:0,mv:0}}
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
const S={scene:'intro',t:14*3600,t0:0,t1:1,playing:false,drt:{veh:2,rate:.15},flood:{sc:'heavy'}};
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
 else if(EXT[S.scene]){$('#pin').innerHTML=EXT[S.scene].panel()}
 else{$('#pin').innerHTML=`<h1>주천강이 넘치면 어디까지 잠기나</h1><p class="lede">200년 빈도 하천범람지도의 침수 등급을 따라, 비가 쌓일수록 강 쪽 낮은 땅부터 물이 찬다. 붉게 바뀌는 건물이 잠기는 건물이다.</p>
 <div class="seg" id="sSc"><span>강우</span><button data-s="light">보통 비</button><button data-s="heavy">집중호우</button><button data-s="extreme">극한호우</button></div>
 <div id="k"></div><div class="fig"><svg id="ch"></svg></div><ul class="log" id="lg"></ul>
 <p class="note">수면 높이 = 범람 범위 가장자리의 실제 지형 고도. 범람 범위는 범람지도 등급을 강 쪽부터 드러내는 단순화. 강우는 가상 시나리오.</p>`;
 seg('#sSc','s',S.flood.sc,v=>{S.flood.sc=v;FS=floodSeries(v);aff.clear();resetLog();drawChart();frame(true)})}}
function legend(){const L=EXT[S.scene]?EXT[S.scene].legend:S.scene==='drt'?[...ZN.map(z=>[ZC[z],z+' DRT','']),['#ffffff','T0 대합실','dot']]:S.scene==='flood'?[['#8a7350','범람 수면 (200년 빈도)',''],['#ff5a6a','잠긴 건물','dot']]:[['#ffffff','분석 범위 (판운리 제외)',''],['#e0a83a','농업 센서','dot'],['#b87a3a','건조·선별시설','dot'],['#ff4fa3','DRT 호출벨','dot']];
 $('#legend').innerHTML=L.map(([c,t,k])=>`<div><i class="${k}" style="background:${c}"></i>${t}</div>`).join('')+'<div style="color:#9aabc4">건물 높이: 건축물대장 층수</div>'}
let chX=null;
function drawChart(){const s=$('#ch');if(!s)return;const w=s.clientWidth||340,h=s.clientHeight||140,pl=30,pr=26,pt=8,pb=20,iw=w-pl-pr,ih=h-pt-pb;let o='';
 if(EXT[S.scene]&&EXT[S.scene].chart){const E=EXT[S.scene],pad=E.chartPad||0,X=t=>pl+pad+(t-S.t0)/(S.t1-S.t0)*(iw-pad);chX=X;const span=S.t1-S.t0,stp=span>H(8)?H(6):span>H(3)?H(1):1800;for(let t=Math.ceil(S.t0/stp)*stp;t<=S.t1;t+=stp)o+=`<text x="${X(t)}" y="${h-4}" fill="#9aabc4" font-size="11" text-anchor="middle">${stp>=3600?Math.round(t/3600)+'시':hhmm(t)}</text>`;o+=E.chart(X,null,pt,ih,w,pl+pad)}
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
function events(){if(EXT[S.scene])return EXT[S.scene].events();const ev=[];if(S.scene==='drt'){for(const c of M.calls){if(c.dir!=='in'||c.pick==null)continue;ev.push({t:c.t,msg:`${c.b} ${short(P[c.b].name)} 호출`,quiet:1});ev.push({t:c.pick,lv:c.wait>1800?'warn':'',msg:`${c.b} 탑승 · 대기 ${Math.round(c.wait/60)}분`,quiet:c.wait<=1800,who:ZS[ZONE_OF[c.b]]+' DRT'})}[[26400,'고정편 07:20 출발'],[30000,'고정편 08:20 출발'],[65400,'고정편 18:10 · 귀가편']].forEach(([t,m])=>ev.push({t,msg:m,who:'운행 계획'}))}
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
 const drt=S.scene==='drt'||S.scene==='ops',fl=S.scene==='flood';
 farmFrame(S.scene==='farm'||S.scene==='ops',t);emerFrame(S.scene==='emer',t);
 vehEnts.forEach(e=>{e.model.show=drt;e.tr.show=drt;e.glow.show=drt});BIDS.forEach(b=>pulse[b].billboard.show=false);
 if(drt){updateVeh(t);const pul=(performance.now()%1400)/1400;for(const c of M.calls)if(c.dir==='in'&&c.t<=t&&!(c.pick<=t)){const p=pulse[c.b].billboard;p.show=true;p.width=30+pul*70;p.height=30+pul*70;p.color=C.Color.WHITE.withAlpha(1-pul)}}
 let rainV=0,thr=99;if(fl){const x=FS[clamp(Math.floor(t/600),0,FS.length-1)];rainV=x.rain;thr=thrOf(x.L);setWater(x.L)}else setWater(0);
 colorBuildings(fl?thr:99);RAIN=rainV;const rk=clamp(rainV/60,0,1);
 scene.fog.density=1.6e-4+rk*9e-4;globe.atmosphereBrightnessShift=-rk*.35;globe.atmosphereSaturationShift=-rk*.5;scene.skyAtmosphere.brightnessShift=-rk*.45;scene.skyAtmosphere.saturationShift=-rk*.6;viewer.shadowMap.darkness=.45+rk*.4;
 const now=performance.now();if(force||now-lastUI>150){lastUI=now;ui()}}
function ui(){$('#clock').textContent=hhmm(S.t);$('#tr').value=S.t;moveCur();if(!$('#k'))return;
 if(S.scene==='drt'){const s=drtStats(M,S.t);$('#k').innerHTML=kp([[`${s.done}<small> / ${s.called}</small>`,'태운 호출 / 들어온 호출'],[`${(s.wait/60).toFixed(1)}분`,`평균 대기 · 최대 ${Math.round(s.maxw/60)}분`,s.maxw>3600?'warn':''],[`${s.moving}<small> / ${M.vehs.length}대</small>`,'지금 달리는 차량'],[`${Math.round(s.km)}km`,'누적 운행 거리']])}
 else if(S.scene==='flood'){const x=FS[clamp(Math.floor(S.t/600),0,FS.length-1)],th=thrOf(x.L),A=affected(th);$('#k').innerHTML=kp([[`${Math.round(x.rain)}mm/h`,`시간당 강우 · 누적 ${Math.round(x.cum)}mm`],[th<=5?`${th}등급`:'–','범람 범위 (5 → 1로 넓어짐)',th<=3?'alert':th<=5?'warn':''],[`${fmt(A.n)}동`,'잠긴 건물',A.n?'alert':''],[`${A.by['주천리']||0}동`,'그중 주천리']])}
 else if(EXT[S.scene]&&EXT[S.scene].kpi){const k=$('#k'),hh=EXT[S.scene].kpi(S.t);if(k._h!==hh){k.innerHTML=hh;k._h=hh}}
 renderLog(S.playing)}
let lastTs=performance.now();
viewer.clock.onTick.addEventListener(()=>{});
scene.preRender.addEventListener(()=>{const ts=performance.now(),dt=Math.min(.1,(ts-lastTs)/1000);lastTs=ts;
 if(S.playing){const E_=EXT[S.scene],rate=(E_?(typeof E_.rate==='function'?E_.rate(S.t):E_.rate):S.scene==='drt'?600:S.scene==='flood'?1500:1800)*(+$('#spd').value);S.t=S.t+dt*rate;if(S.t>=S.t1){S.t=S.t1;S.playing=false;$('#play').textContent='재생'}frame()}else if(S.scene==='drt'||EXT[S.scene])frame();drawRain(dt)});
$('#play').onclick=()=>{if(S.t>=S.t1){S.t=S.t0;resetLog()}S.playing=!S.playing;$('#play').textContent=S.playing?'일시정지':'재생';if(S.playing){DIR.user=false;DIR.idx=-1}};
$('#tr').oninput=e=>{S.t=+e.target.value;S.playing=false;$('#play').textContent='재생';renderLog(false);frame(true)};
const VIEW={intro:{lon:T.center[0],lat:T.center[1]-.012,h:0,head:10,pitch:-34,range:15000},drt:{lon:128.252,lat:37.250,head:-15,pitch:-38,range:11000},flood:{lon:128.2715,lat:37.2712,head:205,pitch:-28,range:2600}};
function fly(v,dur=3){const g0=globe.getHeight(C.Cartographic.fromDegrees(v.lon,v.lat));const target=C.Cartesian3.fromDegrees(v.lon,v.lat,g0==null?250:g0);camera.flyToBoundingSphere(new C.BoundingSphere(target,10),{offset:new C.HeadingPitchRange(C.Math.toRadians(v.head),C.Math.toRadians(v.pitch),v.range),duration:dur})}
function setScene(s,dur=3){if(typeof setAuto==='function'&&ROT.auto)setAuto(false);DIR.user=false;DIR.idx=-1;dirStop();S.scene=s;S.playing=false;$('#play').textContent='재생';$$('#tabs button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.s===s));
 if(EXT[s]){S.t0=EXT[s].t0;S.t1=EXT[s].t1;S.t=EXT[s].t}else if(s==='intro'){S.t0=6*3600;S.t1=20*3600;S.t=14*3600}else if(s==='drt'){S.t0=6.5*3600;S.t1=20*3600;S.t=8*3600}else{S.t0=0;S.t1=24*3600-600;S.t=12*3600}
 $('#tr').min=S.t0;$('#tr').max=S.t1;$('#tr').step=EXT[s]?EXT[s].step:s==='flood'?600:60;buildShots();$('#toast').innerHTML='';panel();legend();resetLog();drawChart();fly(EXT[s]?EXT[s].view:VIEW[s],dur);frame(true)}
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
 if(LITE){s=Math.min(s,.85);q.sse=Math.max(q.sse,2.5);q.msaa=Math.min(q.msaa,2)}viewer.resolutionScale=s;globe.maximumScreenSpaceError=q.sse;try{scene.msaaSamples=q.msaa}catch(e){}
 casStage.uniforms.sharp=q.sharp;casStage.enabled=true;
 try{localStorage.setItem(LITE?'jc_quality_lite':'jc_quality2',k)}catch(e){}const sel=$('#q');if(sel)sel.value=k}
let QK=LITE?'perf':'bal';try{QK=localStorage.getItem(LITE?'jc_quality_lite':'jc_quality2')||QK}catch(e){}
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


/* ================= extra scenes: 농업 센서 · 비상 대응 · 통합 상황판 + 연출 카메라 ================= */
progress(.93,'농업 센서·비상 상황을 준비하는 중…');
const RAD=C.Math.toRadians,DEG=C.Math.toDegrees;
const offLL=(lon,lat,e,n)=>[lon+e/(111320*Math.cos(lat*Math.PI/180)),lat+n/110540];
const gh=async ll=>{const r=(await sampleH(ll.map(p=>C.Cartographic.fromDegrees(p[0],p[1])))).map(x=>x.height||0);return r.map((h,i)=>{if(h>120)return h;const g=globe.getHeight(C.Cartographic.fromDegrees(ll[i][0],ll[i][1]));if(g!=null&&g>120)return g;const ok=r.filter(v=>v>120);return ok.length?ok[Math.floor(ok.length/2)]:260})};
const cart=(p,h)=>C.Cartesian3.fromDegrees(p[0],p[1],h);
async function mkRoute(c,t,km){const d=densify(c,20);const hs=await gh(d);const r={c:d,h:fixH(hs.map(x=>x+3)),t,km};const cum=[0];for(let j=1;j<d.length;j++)cum.push(cum[j-1]+mdist(d[j-1],d[j]));r.cum=cum;r.L=cum[cum.length-1];return r}
function subRoute(r,f0,f1){const d0=f0*r.L,d1=f1*r.L,a=along(r,f0),e=along(r,f1);const c=[[a[0],a[1]]],h=[a[2]];for(let i=0;i<r.c.length;i++)if(r.cum[i]>d0&&r.cum[i]<d1){c.push(r.c[i]);h.push(r.h[i])}c.push([e[0],e[1]]);h.push(e[2]);const o={c,h,t:r.t*(f1-f0),km:r.km*(f1-f0)};const cum=[0];for(let j=1;j<c.length;j++)cum.push(cum[j-1]+mdist(c[j-1],c[j]));o.cum=cum;o.L=cum[cum.length-1];return o}
function revR(r){const o={c:[...r.c].reverse(),h:[...r.h].reverse(),t:r.t,km:r.km};const cum=[0];for(let j=1;j<o.c.length;j++)cum.push(cum[j-1]+mdist(o.c[j-1],o.c[j]));o.cum=cum;o.L=cum[cum.length-1];return o}
const headOf=(a,b)=>Math.atan2((b[0]-a[0])*Math.cos(a[1]*Math.PI/180),b[1]-a[1]);
const lerpAng=(a,b,k)=>{let d=b-a;while(d>Math.PI)d-=2*Math.PI;while(d<-Math.PI)d+=2*Math.PI;return a+d*k};

/* particles run on real time, not on the simulation clock */
let REALJD=C.JulianDate.now();
{const _u=C.ParticleSystem.prototype.update;C.ParticleSystem.prototype.update=function(fs){const t=fs.time;fs.time=REALJD;try{_u.call(this,fs)}finally{fs.time=t}}}
const glowImg=(r,g,b,core=.35)=>{const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d');const gr=x.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,`rgba(${r},${g},${b},1)`);gr.addColorStop(core,`rgba(${r},${g},${b},.55)`);gr.addColorStop(1,`rgba(${r},${g},${b},0)`);x.fillStyle=gr;x.fillRect(0,0,64,64);return c};
const FIRE_IMG=glowImg(255,140,40,.25),EMBER_IMG=glowImg(255,220,120,.15),SMOKE_IMG=glowImg(175,170,163,.45),DROP_IMG=glowImg(215,235,255,.3),DUST_IMG=glowImg(150,130,105,.45);
const tmpV=new C.Cartesian3();
function psys(o){if(o.emissionRate)o.emissionRate*=PF;return scene.primitives.add(new C.ParticleSystem(Object.assign({image:FIRE_IMG,startColor:C.Color.WHITE,endColor:C.Color.WHITE.withAlpha(0),startScale:1,endScale:2.5,minimumParticleLife:1,maximumParticleLife:2,minimumSpeed:2,maximumSpeed:5,imageSize:new C.Cartesian2(6,6),sizeInMeters:true,emissionRate:20,emitter:new C.ConeEmitter(RAD(25)),show:false},o)))}
const enuAt=(p,h)=>C.Transforms.eastNorthUpToFixedFrame(cart(p,h));
function worldVec(p,e,n,u){const m=enuAt(p,0);return C.Matrix4.multiplyByPointAsVector(m,new C.Cartesian3(e,n,u),new C.Cartesian3())}
const ringImg=(col,w=6)=>{const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d');g.beginPath();g.arc(64,64,56,0,7);g.lineWidth=w;g.strokeStyle=col;g.stroke();return c};
const ALERT_RING=ringImg('#ff4d5e',7),WARN_RING=ringImg('#ffc145',6),INFO_RING=ringImg('#3ee6c1',6);
function cardImg(title,rows,accent){const c=document.createElement('canvas');const W=250,H=34+rows.length*24;c.width=W*2;c.height=H*2;const g=c.getContext('2d');g.scale(2,2);
 g.fillStyle='rgba(8,14,26,.86)';g.beginPath();g.roundRect(1,1,W-2,H-2,10);g.fill();g.strokeStyle=accent;g.lineWidth=2;g.stroke();g.fillStyle=accent;g.font='800 14px "Noto Sans KR"';g.fillText(title,12,22);
 rows.forEach(([k,v,col],i)=>{g.fillStyle='#9aabc4';g.font='500 12.5px "Noto Sans KR"';g.fillText(k,12,46+i*24);g.fillStyle=col||'#eef3fa';g.font='800 14px "Noto Sans KR"';g.textAlign='right';g.fillText(v,W-12,46+i*24);g.textAlign='left'});return c}

/* ---------- 농업 센서 ---------- */
const FARM_IDS=['S1','S2'];
function farmSeries(){const o={};FARM_IDS.forEach((id,si)=>{let m=si?29.5:26.5,irr=0;const arr=[];for(let i=0;i<144;i++){const h=i/6;const sun=Math.max(0,Math.sin((h-6.2)/13.6*Math.PI));const ta=23.5+10.6*Math.max(0,Math.sin((h-8)/14*Math.PI))-(h<6?1.5:0);const et=(.06+.62*sun)*(si?1:1.18);
  if(irr>0){m+=1.55;irr--}else m-=et;if(m<20&&irr===0)irr=6;const ts=21+7.5*Math.max(0,Math.sin((h-9.5)/14*Math.PI));arr.push({m:+m.toFixed(1),ta:+ta.toFixed(1),ts:+ts.toFixed(1),irr:irr>0})}o[id]=arr});return o}
const FM=farmSeries();
const fmAt=(id,t)=>FM[id][clamp(Math.floor(t/600),0,143)];
const FARM={ents:[],cards:{},spr:{},parcel:{},links:[],key:''};
const parcelsOf=id=>T.parcels.filter(p=>p.id===id);
const centroid=pp=>{let x=0,y=0;pp.forEach(p=>{x+=p[0];y+=p[1]});return[x/pp.length,y/pp.length]};
{const ids=[...FARM_IDS,'D1','D2','T0'];const hs=await gh(ids.map(id=>[P[id].lon,P[id].lat]));ids.forEach((id,i)=>P[id].g=hs[i])}
FARM_IDS.forEach(id=>{const p=P[id],pos=[p.lon,p.lat];
 parcelsOf(id).forEach(pc=>{const e=viewer.entities.add({show:false,polygon:{hierarchy:C.Cartesian3.fromDegreesArray(pc.p.flat()),material:new C.ColorMaterialProperty(new C.CallbackProperty(()=>FARM.parcel[id]||C.Color.WHITE.withAlpha(.3),false)),classificationType:C.ClassificationType.TERRAIN}});
  const o=viewer.entities.add({show:false,polyline:{positions:C.Cartesian3.fromDegreesArray([...pc.p.flat(),...pc.p[0]]),clampToGround:true,width:3,material:C.Color.WHITE.withAlpha(.9)}});FARM.ents.push(e,o)});
 FARM.ents.push(viewer.entities.add({show:false,position:cart(pos,p.g+2.2),cylinder:{length:4.4,topRadius:.18,bottomRadius:.22,material:C.Color.fromCssColorString('#d9dee6')}}));
 FARM.ents.push(viewer.entities.add({show:false,position:cart(pos,p.g+4.6),box:{dimensions:new C.Cartesian3(.9,.5,.6),material:C.Color.fromCssColorString('#e0a83a')}}));
 FARM.cards[id]=viewer.entities.add({show:false,position:cart(pos,p.g+14),billboard:{image:cardImg(id,[['토양수분','–']],'#e0a83a'),scale:.5,verticalOrigin:C.VerticalOrigin.BOTTOM,disableDepthTestDistance:Number.POSITIVE_INFINITY,scaleByDistance:new C.NearFarScalar(200,1.15,6000,.55)}});
 const pc=parcelsOf(id)[0];const pts=pc?[centroid(pc.p),...[0,.33,.66].map(f=>{const q=pc.p[Math.floor(f*pc.p.length)];const cc=centroid(pc.p);return[(q[0]+cc[0]*2)/3,(q[1]+cc[1]*2)/3]})]:[pos];
 FARM.spr[id]=pts.map(q=>{const s=psys({image:DROP_IMG,emitter:new C.ConeEmitter(RAD(38)),emissionRate:70,minimumSpeed:7,maximumSpeed:10,minimumParticleLife:1.2,maximumParticleLife:1.8,imageSize:new C.Cartesian2(1.3,1.3),startScale:1,endScale:.6,startColor:C.Color.WHITE.withAlpha(.9),endColor:C.Color.WHITE.withAlpha(.1)});s._q=q;return s});
 // data link arc sensor -> T0 platform
 const A=pos,Bp=[P.T0.lon,P.T0.lat],arc=[];const L=mdist(A,Bp);for(let i=0;i<=48;i++){const f=i/48;arc.push(C.Cartesian3.fromDegrees(A[0]+(Bp[0]-A[0])*f,A[1]+(Bp[1]-A[1])*f,p.g+(P.T0.g-p.g)*f+Math.sin(f*Math.PI)*Math.max(250,L*.12)+12))}
 FARM.links.push(viewer.entities.add({show:false,polyline:{positions:arc,width:7,arcType:C.ArcType.NONE,material:new C.PolylineGlowMaterialProperty({glowPower:.3,color:C.Color.fromCssColorString('#3ee6c1').withAlpha(.45)})}}));
 FARM.links.push(viewer.entities.add({show:false,position:new C.CallbackProperty(()=>{const f=((performance.now()/1000+(id==='S1'?.6:0))%2.4)/2.4;const i=Math.min(47,Math.floor(f*48)),u=f*48-i;return C.Cartesian3.lerp(arc[i],arc[i+1],u,new C.Cartesian3())},false),point:{pixelSize:9,color:C.Color.fromCssColorString('#b9fff0'),outlineColor:C.Color.fromCssColorString('#3ee6c1'),outlineWidth:3,disableDepthTestDistance:Number.POSITIVE_INFINITY}}))});
// set sprinkler positions after heights
for(const id of FARM_IDS){const hs=await gh(FARM.spr[id].map(s=>s._q));FARM.spr[id].forEach((s,i)=>{s.modelMatrix=enuAt(s._q,hs[i]+1.2);s.updateCallback=(pp,dt)=>{pp.velocity.z-=0}})}
const DOWN=C.Cartesian3.negate(UPV,new C.Cartesian3());
for(const id of FARM_IDS)FARM.spr[id].forEach(s=>{s.updateCallback=(pp,dt)=>{C.Cartesian3.add(pp.velocity,C.Cartesian3.multiplyByScalar(DOWN,9.8*dt,tmpV),pp.velocity)}});
T.parcels.filter(p=>p.id==='D1').forEach(pc=>FARM.ents.push(viewer.entities.add({show:false,polygon:{hierarchy:C.Cartesian3.fromDegreesArray(pc.p.flat()),material:C.Color.fromCssColorString('#b87a3a').withAlpha(.45),classificationType:C.ClassificationType.TERRAIN}})));
T.farmSites.forEach(f=>{const r=Math.sqrt(f.ha*1e4/Math.PI)*.55;FARM.ents.push(viewer.entities.add({show:false,position:C.Cartesian3.fromDegrees(f.lon,f.lat),ellipse:{semiMajorAxis:r,semiMinorAxis:r,material:C.Color.fromCssColorString('#e0a83a').withAlpha(.13),classificationType:C.ClassificationType.TERRAIN},label:{...LBL,text:`${f.name.replace('스마트팜 ','')} · ${Math.round(f.ha)}ha`,font:'600 13px "Noto Sans KR"',fillColor:C.Color.fromCssColorString('#ffd892'),distanceDisplayCondition:new C.DistanceDisplayCondition(1500,30000)}}))});
const moistCol=m=>C.Color.lerp(C.Color.fromCssColorString('#c8873a'),C.Color.fromCssColorString('#2f8fd8'),clamp((m-16)/16,0,1),new C.Color()).withAlpha(.5);
function farmFrame(on,t){FARM.ents.forEach(e=>e.show=on);FARM.links.forEach(e=>e.show=on);for(const id of FARM_IDS){FARM.cards[id].show=on;const x=fmAt(id,t);FARM.spr[id].forEach(s=>s.show=on&&x.irr);
  if(!on)continue;FARM.parcel[id]=moistCol(x.m);const key=id+x.m+x.irr+x.ta;if(FARM['k'+id]!==key){FARM['k'+id]=key;FARM.cards[id].billboard.image=cardImg(`${id} ${id==='S1'?'용석리':'신일리'} 밭 센서`,[['토양수분 (10cm)',x.m.toFixed(1)+'%',x.m<20?'#ffc145':'#7fd3ff'],['기온 · 지온',`${x.ta}° · ${x.ts}°`,x.ta>=33?'#ff8a8a':null],['관수 밸브',x.irr?'열림 · 관수 중':'닫힘',x.irr?'#3ee6c1':null]],x.irr?'#3ee6c1':x.m<21?'#ffc145':'#e0a83a')}}}
const farmIrr=id=>{const ev=[];let on=false,s0=0;FM[id].forEach((x,i)=>{if(x.irr&&!on){on=true;s0=i*600}if(!x.irr&&on){on=false;ev.push([s0,i*600])}});return ev};
const IRR={S1:farmIrr('S1'),S2:farmIrr('S2')};
const heatT=FM.S1.findIndex(x=>x.ta>=33)*600;

/* ---------- 비상 대응 (낙석 + 산불) ---------- */
const EM={};
{const hr=T.hallRoutes['신일4리마을회관'];EM.r1=await mkRoute(hr.c,hr.t,hr.km);EM.f=.56;EM.site=along(EM.r1,EM.f);const a=along(EM.r1,EM.f-.01),b=along(EM.r1,EM.f+.01);EM.roadHead=headOf(a,b);
 const nx=Math.cos(EM.roadHead),ny=-Math.sin(EM.roadHead);// perpendicular (east,north)
 const L=offLL(EM.site[0],EM.site[1],nx*55,ny*55),Rr=offLL(EM.site[0],EM.site[1],-nx*55,-ny*55);const [hl,hr2]=await gh([L,Rr]);EM.slope=hl>hr2?L:Rr;EM.slopeH=Math.max(hl,hr2);EM.siteG=EM.site[2]-3;
 EM.side=hl>hr2?1:-1;EM.amb=subRoute(EM.r1,0,EM.f-.012);EM.close=subRoute(EM.r1,EM.f-.05,EM.f+.05);
 const hall=T.halls.find(h=>h.name.startsWith('금마2리'));EM.hall=[hall.lon,hall.lat];
 const cand=[];for(let i=0;i<20;i++){const a2=i/20*2*Math.PI;for(const d of[550,800])cand.push(offLL(hall.lon,hall.lat,Math.cos(a2)*d,Math.sin(a2)*d))}
 const ch=await gh(cand);let bi=0;ch.forEach((h,i)=>{if(h>ch[bi])bi=i});EM.fire=cand[bi];EM.fireG=ch[bi];
 const er=T.hallRoutes['금마2리마을회관'];EM.ev=await mkRoute(er.c,er.t,er.km);EM.evBack=revR(EM.ev);}
const H=h=>h*3600;
const ET={rock:H(14),detect:H(14)+25,close:H(14)+150,amb:H(14)+200,fire:H(14.5),fireDetect:H(14.5)+180,bcast:H(14.5)+300,evac:H(14.5)+420,contain:H(15.42)};
ET.ambArr=ET.amb+Math.round(EM.amb.t*.72);ET.evArr=ET.evac+Math.round(EM.ev.t);ET.evDep=ET.evArr+300;ET.evBack=ET.evDep+Math.round(EM.ev.t);
EM.windH=RAD(62);EM.wind=[Math.sin(EM.windH),Math.cos(EM.windH)];
// rocks
const ROCKS=[...Array(7)].map((_,i)=>{const r2=rng(90+i);return{d:.8+r2()*1.6,delay:r2()*12,dx:(r2()-.5)*16,dy:(r2()-.5)*6,spin:r2()}});
const nx_=Math.cos(EM.roadHead),ny_=-Math.sin(EM.roadHead);
EM.rockEnts=ROCKS.map((k,i)=>{const end=offLL(EM.site[0],EM.site[1],nx_*k.dy*EM.side*-1+Math.sin(EM.roadHead)*k.dx,ny_*k.dy*EM.side*-1+Math.cos(EM.roadHead)*k.dx);const st=offLL(EM.slope[0],EM.slope[1],Math.sin(EM.roadHead)*k.dx,Math.cos(EM.roadHead)*k.dx);
 return viewer.entities.add({show:false,position:new C.CallbackProperty(()=>{const u=clamp((S.t-ET.rock-k.delay)/14,0,1),e=u*u;const p=[st[0]+(end[0]-st[0])*e,st[1]+(end[1]-st[1])*e];const h=(EM.slopeH+8)+(EM.siteG+k.d*.5-(EM.slopeH+8))*e+Math.sin(u*Math.PI*3)*(1-u)*4;return cart(p,h)},false),
  orientation:new C.CallbackProperty(()=>C.Transforms.headingPitchRollQuaternion(cart(EM.site,EM.siteG),new C.HeadingPitchRoll(k.spin*6,clamp((S.t-ET.rock-k.delay)/14,0,1)*8*k.spin,0)),false),
  ellipsoid:{radii:new C.Cartesian3(k.d,k.d*.8,k.d*.7),material:C.Color.fromCssColorString(i%2?'#7a7066':'#8d8378'),shadows:C.ShadowMode.ENABLED}})});
EM.dust=psys({image:DUST_IMG,emitter:new C.SphereEmitter(8),emissionRate:0,minimumSpeed:1,maximumSpeed:4,minimumParticleLife:3,maximumParticleLife:6,imageSize:new C.Cartesian2(10,10),startScale:1,endScale:4,startColor:C.Color.WHITE.withAlpha(.55),endColor:C.Color.WHITE.withAlpha(0)});
EM.dust.modelMatrix=enuAt(EM.site,EM.siteG+3);
EM.closeLine=viewer.entities.add({show:false,polyline:{positions:EM.close.c.map((c,i)=>cart(c,EM.close.h[i]+1.5)),width:14,arcType:C.ArcType.NONE,material:new C.PolylineGlowMaterialProperty({glowPower:.35,color:new C.CallbackProperty(()=>C.Color.fromCssColorString('#ff3b4e').withAlpha(.55+.4*Math.abs(Math.sin(performance.now()/300))),false)})}});
EM.siteMark=viewer.entities.add({show:false,position:cart(EM.site,EM.siteG),billboard:{image:ALERT_RING,width:60,height:60,heightReference:C.HeightReference.CLAMP_TO_GROUND,disableDepthTestDistance:Number.POSITIVE_INFINITY},label:{...LBL,text:'낙석 · 신일4리 가는 길',fillColor:C.Color.fromCssColorString('#ff8a95'),pixelOffset:new C.Cartesian2(0,-30)}});
// 119 ambulance & evacuation van
function mover(key,col,labelTxt){const st={pos:cart(T0P,P.T0.g),ori:C.Quaternion.IDENTITY,h:0,p:[T0P[0],T0P[1],P.T0.g]};const e=viewer.entities.add({show:false,position:new C.CallbackProperty(()=>st.pos,false),orientation:new C.CallbackProperty(()=>st.ori,false),model:{uri:MODELS[key],minimumPixelSize:30,maximumScale:40,heightReference:C.HeightReference.CLAMP_TO_GROUND,shadows:C.ShadowMode.ENABLED},label:{...LBL,text:labelTxt,font:'700 13px "Noto Sans KR"',fillColor:C.Color.fromCssColorString(col),pixelOffset:new C.Cartesian2(0,-34)}});
 const tr=viewer.entities.add({show:false,polyline:{positions:new C.CallbackProperty(()=>st.trail&&st.trail.length>1?st.trail:[st.pos,st.pos],false),width:12,arcType:C.ArcType.NONE,material:new C.PolylineGlowMaterialProperty({glowPower:.25,color:C.Color.fromCssColorString(col).withAlpha(.7)})}});
 return{st,e,tr,set(r,f){const a=along(r,f),q=along(r,Math.min(1,f+.004));st.p=a;st.pos=C.Cartesian3.fromDegrees(a[0],a[1],0);if(f<1){st.h=headOf(a,q);st.ori=C.Transforms.headingPitchRollQuaternion(cart(a,a[2]),new C.HeadingPitchRoll(st.h-Math.PI/2,0,0))}const pts=[];const d=f*r.L;for(let i=0;i<r.c.length&&r.cum[i]<=d;i++)if(r.cum[i]>d-900)pts.push(cart(r.c[i],r.h[i]+2));pts.push(cart(a,a[2]+2));st.trail=pts},show(v){e.show=v;tr.show=v}}}
EM.ambM=mover('amb','#ff5a6a','119 구급·구조');EM.evM=mover('west','#ff4fa3','대피 DRT');
EM.beacon=viewer.entities.add({show:false,position:new C.CallbackProperty(()=>C.Cartesian3.fromDegrees(EM.ambM.st.p[0],EM.ambM.st.p[1],3.2),false),point:{heightReference:C.HeightReference.RELATIVE_TO_GROUND,pixelSize:new C.CallbackProperty(()=>14+6*Math.abs(Math.sin(performance.now()/120)),false),color:new C.CallbackProperty(()=>Math.floor(performance.now()/250)%2?C.Color.fromCssColorString('#ff2d3d'):C.Color.fromCssColorString('#3d7bff'),false),disableDepthTestDistance:Number.POSITIVE_INFINITY}});
// wildfire
EM.burnR=0;EM.burnHier=null;
function burnPoly(a){const b=a*.58,sh=a*.32,pts=[];for(let i=0;i<48;i++){const th=i/48*2*Math.PI;const ex=Math.cos(th)*a+sh,ey=Math.sin(th)*b;const e=ex*EM.wind[0]+ey*EM.wind[1],n=ex*EM.wind[1]-ey*EM.wind[0];pts.push(offLL(EM.fire[0],EM.fire[1],e,n))}return pts}
const burnA=t=>t<ET.fire?0:Math.min(360,18+(Math.min(t,ET.contain)-ET.fire)/60*6.4);
EM.burn=viewer.entities.add({show:false,polygon:{hierarchy:new C.CallbackProperty(()=>EM.burnHier,false),material:C.Color.fromCssColorString('#2b2019').withAlpha(.58),classificationType:C.ClassificationType.TERRAIN}});
EM.burnEdge=viewer.entities.add({show:false,polyline:{positions:new C.CallbackProperty(()=>EM.burnEdgePos||[],false),clampToGround:true,width:5,material:new C.PolylineGlowMaterialProperty({glowPower:.4,color:C.Color.fromCssColorString('#ff7a1a')})}});
EM.flames=[...Array(16)].map(()=>psys({image:FIRE_IMG,emitter:new C.CircleEmitter(14),emissionRate:28,minimumSpeed:2,maximumSpeed:5.5,minimumParticleLife:.5,maximumParticleLife:1.1,imageSize:new C.Cartesian2(3.5,6),startScale:1.2,endScale:.2,startColor:C.Color.fromCssColorString('#ffd27a').withAlpha(.95),endColor:C.Color.fromCssColorString('#ff3a10').withAlpha(0)}));
EM.embers=psys({image:EMBER_IMG,emitter:new C.CircleEmitter(30),emissionRate:30,minimumSpeed:6,maximumSpeed:14,minimumParticleLife:2,maximumParticleLife:4,imageSize:new C.Cartesian2(1.6,1.6),startScale:1,endScale:.4,startColor:C.Color.WHITE,endColor:C.Color.fromCssColorString('#ff6a00').withAlpha(0)});
EM.smoke=[0,1,2].map(i=>psys({image:SMOKE_IMG,emitter:new C.CircleEmitter(25+i*20),emissionRate:7,minimumSpeed:5,maximumSpeed:9,minimumParticleLife:16,maximumParticleLife:26,imageSize:new C.Cartesian2(50,50),startScale:1,endScale:5,startColor:C.Color.fromCssColorString('#d6d1ca').withAlpha(.5),endColor:C.Color.fromCssColorString('#eeece8').withAlpha(0)}));
EM.windW=worldVec(EM.fire,EM.wind[0]*4.5,EM.wind[1]*4.5,0);
EM.smoke.forEach(s=>s.updateCallback=(pp,dt)=>{C.Cartesian3.add(pp.velocity,C.Cartesian3.multiplyByScalar(EM.windW,dt*.35,tmpV),pp.velocity)});
EM.embers.updateCallback=(pp,dt)=>{C.Cartesian3.add(pp.velocity,C.Cartesian3.multiplyByScalar(EM.windW,dt*.5,tmpV),pp.velocity)};
EM.fireMark=viewer.entities.add({show:false,position:cart(EM.fire,EM.fireG),label:{...LBL,text:'산불 · 금마2리 뒷산',fillColor:C.Color.fromCssColorString('#ffb070'),pixelOffset:new C.Cartesian2(0,-40)}});
EM.hallRing=viewer.entities.add({show:false,position:C.Cartesian3.fromDegrees(EM.hall[0],EM.hall[1]),billboard:{image:WARN_RING,width:60,height:60,heightReference:C.HeightReference.CLAMP_TO_GROUND,disableDepthTestDistance:Number.POSITIVE_INFINITY},label:{...LBL,text:'금마2리 마을회관 · 대피 집결',fillColor:C.Color.fromCssColorString('#ffd36a'),pixelOffset:new C.Cartesian2(0,-30)}});
EM.fpH=[];
async function fireHeights(a){const k=Math.round(a/15);if(EM.fpH[k])return EM.fpH[k];const pts=burnPoly(Math.max(20,a));EM.fpH[k]={pts,h:await gh(pts)};return EM.fpH[k]}
let fireBusy=false;
function emerFrame(on,t){const show=(e,v)=>{e.show=on&&v};
 EM.rockEnts.forEach(e=>show(e,t>=ET.rock));EM.dust.show=on&&t>=ET.rock&&t<ET.rock+600;EM.dust.emissionRate=(t<ET.rock+40?60:t<ET.rock+180?12:0)*PF;
 show(EM.closeLine,t>=ET.close);show(EM.siteMark,t>=ET.detect);if(EM.siteMark.billboard){const pu=(performance.now()%1300)/1300;EM.siteMark.billboard.width=40+pu*60;EM.siteMark.billboard.height=40+pu*60;EM.siteMark.billboard.color=C.Color.WHITE.withAlpha(1-pu)}
 const ambOn=t>=ET.amb;EM.ambM.show(on&&ambOn);show(EM.beacon,ambOn);if(ambOn)EM.ambM.set(EM.amb,clamp((t-ET.amb)/(ET.ambArr-ET.amb),0,1));
 const evOn=t>=ET.evac&&t<ET.evBack+120;EM.evM.show(on&&evOn);if(evOn){if(t<ET.evArr)EM.evM.set(EM.ev,clamp((t-ET.evac)/(ET.evArr-ET.evac),0,1));else if(t<ET.evDep)EM.evM.set(EM.ev,1);else EM.evM.set(EM.evBack,clamp((t-ET.evDep)/(ET.evBack-ET.evDep),0,1))}
 show(EM.hallRing,t>=ET.bcast&&t<ET.evDep);if(EM.hallRing.billboard){const pu=(performance.now()%1500)/1500;EM.hallRing.billboard.width=40+pu*70;EM.hallRing.billboard.height=40+pu*70;EM.hallRing.billboard.color=C.Color.WHITE.withAlpha(1-pu)}
 const fireOn=on&&t>=ET.fire;const a=burnA(t);show(EM.burn,t>=ET.fire);show(EM.burnEdge,t>=ET.fire&&t<ET.contain+1200);show(EM.fireMark,t>=ET.fireDetect);
 const k=Math.round(a/15);if(fireOn&&EM.burnK!==k&&!fireBusy){fireBusy=true;fireHeights(a).then(fh=>{fireBusy=false;EM.burnK=k;EM.burnHier=new C.PolygonHierarchy(C.Cartesian3.fromDegreesArray(fh.pts.flat()));EM.burnEdgePos=C.Cartesian3.fromDegreesArray([...fh.pts.flat(),...fh.pts[0]]);
   const fr=fh.pts.map((p,i)=>({p,h:fh.h[i]})).filter((q,i)=>{const th=i/48*2*Math.PI;return Math.cos(th)>-.35});EM.flames.forEach((s,j)=>{const q=fr[Math.floor(j/EM.flames.length*fr.length)]||fr[0];if(q)s.modelMatrix=enuAt(q.p,q.h+1)});
   EM.embers.modelMatrix=enuAt(EM.fire,EM.fireG+6);EM.smoke.forEach((s,j)=>{const q=fr[Math.floor((j+.5)/3*fr.length)]||{p:EM.fire,h:EM.fireG};s.modelMatrix=enuAt(q.p,q.h+15)})})}
 const fl=t<ET.contain?1:clamp(1-(t-ET.contain)/900,0,1);EM.flames.forEach(s=>{s.show=fireOn&&fl>0;s.emissionRate=55*fl*PF});EM.embers.show=fireOn&&fl>0;EM.embers.emissionRate=30*fl*PF;EM.smoke.forEach(s=>{s.show=fireOn;s.emissionRate=(t<ET.contain?7:Math.max(1.5,7*fl))*PF})}
const emStats=t=>{const area=t>=ET.fire?Math.PI*burnA(t)*burnA(t)*.58/1e4:0;return{area}};

/* ---------- ops (통합 상황판) ---------- */
const FS_OPS=floodSeries('light');

/* ---------- 연출 카메라 ---------- */
const css=document.createElement('style');css.textContent=`#lbT,#lbB{position:fixed;left:0;right:0;height:0;background:#000;z-index:3;transition:height .7s ease;pointer-events:none}#lbT{top:0}#lbB{bottom:0}body.cine #lbT,body.cine #lbB{height:7.5vh}
#cap{position:fixed;left:50%;bottom:118px;transform:translate(-50%,10px);z-index:6;padding:9px 18px;border-radius:12px;background:rgba(6,10,18,.72);backdrop-filter:blur(6px);color:#fff;font:800 17px "Noto Sans KR";opacity:0;transition:opacity .5s,transform .5s;pointer-events:none;white-space:nowrap;max-width:calc(100vw - 32px);overflow:hidden;text-overflow:ellipsis}#cap.on{opacity:1;transform:translate(-50%,0)}#cap small{display:block;font:500 12px "Noto Sans KR";color:#9aabc4}
#tabs{flex-wrap:wrap}#tabs button{padding:10px 13px}
#rot button#dc[aria-pressed=true]{background:#ff8a3d;color:#111;border-color:#ff8a3d}
.cards{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:10px 0}.card{border:1px solid var(--line);border-radius:12px;padding:10px;cursor:pointer;background:rgba(255,255,255,.04);text-align:left;color:var(--ink);font:inherit}.card b{display:block;font-size:13px;color:var(--mut);font-weight:600}.card strong{display:block;font-size:19px;font-weight:900;margin:2px 0}.card span{font-size:12px;color:var(--mut)}.card.ok strong{color:#3ee6c1}.card.warn strong{color:#ffc145}.card.alert strong{color:#ff6b7a}.card:hover{border-color:#9aabc4}
@media(max-width:900px){#cap{bottom:auto;top:84px;font-size:15px}}`;document.head.appendChild(css);
['lbT','lbB','cap'].forEach(id=>{const d=document.createElement('div');d.id=id;document.body.appendChild(d)});
[['farm','농업 센서'],['emer','비상 대응'],['ops','통합 상황판']].forEach(([s,t])=>{const b=document.createElement('button');b.dataset.s=s;b.textContent=t;$('#tabs').appendChild(b)});
{const b=document.createElement('button');b.id='dc';b.title='연출 카메라 켜기/끄기 (C)';b.textContent='연출';b.setAttribute('aria-pressed','true');$('#rot').prepend(b)}
const DIR={on:true,user:false,idx:-1,track:null,capT:0};
function caption(txt,sub){const c=$('#cap');c.innerHTML=txt+(sub?`<small>${sub}</small>`:'');c.classList.add('on');clearTimeout(DIR.capT);DIR.capT=setTimeout(()=>c.classList.remove('on'),4200)}
function groundAt(lon,lat,fb=260){const h=globe.getHeight(C.Cartographic.fromDegrees(lon,lat));return h==null?fb:h}
function flyV(v,dur=2.5){camera.lookAtTransform(C.Matrix4.IDENTITY);const tg=C.Cartesian3.fromDegrees(v.lon,v.lat,(v.g!=null?v.g:groundAt(v.lon,v.lat))+(v.up||0));camera.flyToBoundingSphere(new C.BoundingSphere(tg,5),{offset:new C.HeadingPitchRange(RAD(v.head),RAD(v.pitch),v.range),duration:dur,easingFunction:C.EasingFunction.QUADRATIC_IN_OUT})}
function startShot(s){DIR.track=null;camera.lookAtTransform(C.Matrix4.IDENTITY);if(s.cap)caption(s.cap,s.sub);
 if(s.pick)s=Object.assign({},s,s.pick()||{});
 if(s.view)flyV(s.view,s.dur||2.5);
 if(s.follow||s.orbit){const tr={fn:s.follow,orbit:s.orbit,range:s.range||160,pitch:RAD(s.pitch||-20),h:null,t0:performance.now()+(s.view?(s.dur||2.5)*1000:0)};DIR.track=tr;
  if(!s.view){const r=s.follow?s.follow():null;const tgt=s.orbit||r;if(tgt){tr.h=s.orbit?RAD(s.orbit.head||0):r.head;const p=tgt.p;flyV({lon:p[0],lat:p[1],g:p[2],head:DEG(tr.h),pitch:DEG(tr.pitch),range:tr.range},1.8);tr.t0=performance.now()+1800}}}}
function trackStep(dt){const tr=DIR.track;if(!tr||performance.now()<tr.t0)return;let p,h;
 if(tr.orbit){p=tr.orbit.p;if(tr.h==null)tr.h=RAD(tr.orbit.head||0);tr.h+=dt*RAD(tr.orbit.spd||4);h=tr.h}else{const r=tr.fn();if(!r)return;p=r.p;if(tr.h==null)tr.h=r.head;tr.h=lerpAng(tr.h,r.head,Math.min(1,dt*1.6));h=tr.h}
 camera.lookAt(C.Cartesian3.fromDegrees(p[0],p[1],p[2]),new C.HeadingPitchRange(h,tr.pitch,tr.range));
 const cg=camera.positionCartographic,gh2=globe.getHeight(cg);if(gh2!=null&&cg.height-gh2<18)tr.pitch=Math.max(RAD(-70),tr.pitch-dt*.5)}
function director(dt){const sh=SHOTS[S.scene];if(!sh||!DIR.on||DIR.user||!S.playing){document.body.classList.remove('cine');return}document.body.classList.add('cine');
 let i=-1;for(let k=0;k<sh.length;k++)if(sh[k].t<=S.t)i=k;if(i!==DIR.idx){DIR.idx=i;if(i>=0)startShot(sh[i])}trackStep(dt)}
function dirStop(){DIR.track=null;camera.lookAtTransform(C.Matrix4.IDENTITY);document.body.classList.remove('cine')}
['mousedown','wheel','touchstart'].forEach(ev=>scene.canvas.addEventListener(ev,()=>{if(S.playing&&DIR.on&&!DIR.user){DIR.user=true;dirStop();caption('연출 카메라 잠시 멈춤','직접 조작 중 · 재생을 다시 누르면 이어서 따라간다')}},{passive:true}));
const setDir=v=>{DIR.on=v;$('#dc').setAttribute('aria-pressed',v);if(!v)dirStop();else{DIR.user=false;DIR.idx=-1}};
$('#dc').onclick=()=>setDir(!DIR.on);
// follow helpers
const vehFollow=e=>()=>{const a=vehAt(e.v,S.t);if(a.mv){e.lastH=Math.atan2((a.q[0]-a.p[0])*Math.cos(a.p[1]*Math.PI/180),a.q[1]-a.p[1]);e.lastP=a.p}return e.lastP?{p:e.lastP,head:e.lastH||0}:null};
const moverFollow=m=>()=>({p:m.st.p,head:m.st.h});
function drtShots(){const o=[{t:S.t0,view:{lon:128.256,lat:37.262,head:-20,pitch:-32,range:6500},cap:'DRT 하루 운행',sub:'서부·남부 권역 마을회관 호출벨 → T0 대합실'}];
 const ks=[7.33,8.36,9.6,10.7,11.9,13.3,14.4,15.6,16.7,18.2];ks.forEach((h,k)=>o.push({t:H(h),pick:()=>{const mv=vehEnts.filter(e=>vehAt(e.v,H(h)+60).mv);const e=mv[k%Math.max(1,mv.length)];if(!e)return{view:{lon:T0P[0],lat:T0P[1],head:150+k*20,pitch:-24,range:900},cap:`${hhmm(H(h))} · T0 대합실`,sub:'차량 대기 중'};e.lastP=null;return{follow:vehFollow(e),range:190,pitch:-21,cap:`${hhmm(H(h))} · ${e.v.z} DRT`,sub:vehAt(e.v,H(h)+60).load?`승객 ${vehAt(e.v,H(h)+60).load}명 탑승`:'호출 회관으로 출발'}}}));return o}
function floodShots(){const o=[{t:0,view:{lon:128.268,lat:37.268,head:205,pitch:-30,range:3600},cap:'집중호우 · 주천강',sub:'200년 빈도 범람지도 기준'}];let seen={};FS.forEach((x,i)=>{const th=thrOf(x.L);if(th<=5&&!seen[th]){seen[th]=1;
  if(th===5)o.push({t:i*600,view:{lon:128.2745,lat:37.2668,head:230,pitch:-18,range:900},cap:`${hhmm(i*600)} · 강물이 둑 밖으로`,sub:'범람 5등급: 하천 바로 옆 저지대'});
  if(th===4)o.push({t:i*600,view:{lon:128.2705,lat:37.2705,head:170,pitch:-16,range:700},cap:`${hhmm(i*600)} · 주천리 쪽으로 번지는 물`,sub:'범람 4등급'});
  if(th===3)o.push({t:i*600,orbit:{p:[128.2715,37.2712,groundAt(128.2715,37.2712)+5],head:200,spd:3.5},range:620,pitch:-17,cap:`${hhmm(i*600)} · 주천리 시가지 침수`,sub:'붉은 건물 = 잠기는 건물'});
  if(th<=2&&!seen.low){seen.low=1;o.push({t:i*600,view:{lon:128.2705,lat:37.2690,head:200,pitch:-30,range:2300},cap:`${hhmm(i*600)} · 범람 ${th}등급까지 확대`,sub:'주천리 일대 전체'})}}});
 const peak=FS.reduce((a,x,i)=>x.L>FS[a].L?i:a,0);o.push({t:peak*600+1800,orbit:{p:[128.2715,37.2712,groundAt(128.2715,37.2712)+5],head:120,spd:5},range:1500,pitch:-26,cap:'최고 수위',sub:'물이 빠지기 시작할 때까지'});return o.sort((a,b)=>a.t-b.t)}
function farmShots(){const s1=P.S1,s2=P.S2;const o=[{t:H(4.5),view:{lon:128.262,lat:37.246,head:-10,pitch:-38,range:8000},cap:'노지 스마트팜 · 7개 단지',sub:'센서 값은 10분마다 T0 통합 플랫폼으로'},
  {t:H(6),orbit:{p:[s2.lon,s2.lat,s2.g+3],head:30,spd:4},range:320,pitch:-24,cap:'06:00 · S2 신일리 밭 센서',sub:'토양수분·지온·기온 측정'}];
 IRR.S2.forEach(([a])=>o.push({t:a,orbit:{p:[s2.lon,s2.lat,s2.g+3],head:200,spd:5},range:170,pitch:-16,cap:`${hhmm(a)} · S2 자동 관수 시작`,sub:'토양수분 20% 아래 → 밸브 열림'}));
 if(heatT>0)o.push({t:heatT,view:{lon:s1.lon,lat:s1.lat,g:s1.g+3,head:300,pitch:-22,range:420},cap:`${hhmm(heatT)} · 폭염 주의`,sub:'기온 33°C 이상 → 밭일 자제 알림'});
 IRR.S1.forEach(([a])=>o.push({t:a,orbit:{p:[s1.lon,s1.lat,s1.g+3],head:60,spd:5},range:170,pitch:-16,cap:`${hhmm(a)} · S1 자동 관수 시작`,sub:'용석리 밭'}));
 o.push({t:H(19.5),view:{lon:128.262,lat:37.246,head:20,pitch:-40,range:7500},cap:'오늘의 관수 기록',sub:'센서 → 플랫폼 → 밸브, 사람 손 없이'});return o.sort((a,b)=>a.t-b.t)}
function emerShots(){const hd=DEG(EM.roadHead);return[
 {t:H(13.92),view:{lon:EM.site[0],lat:EM.site[1],g:EM.siteG,head:hd+90*EM.side,pitch:-24,range:900},cap:'14:00 직전 · 신일4리 가는 길',sub:'급경사 절개면 옆 군도'},
 {t:ET.rock-20,view:{lon:EM.site[0],lat:EM.site[1],g:EM.siteG+4,head:hd-90*EM.side+25,pitch:-18,range:170},dur:2,cap:'14:00 · 낙석 발생',sub:'비탈면 경사계가 움직임을 감지'},
 {t:ET.close,view:{lon:EM.site[0],lat:EM.site[1],g:EM.siteG,head:hd,pitch:-35,range:420},cap:'14:02 · 도로 자동 통제',sub:'전광판·내비 통제 정보 송출'},
 {t:ET.amb+10,follow:moverFollow(EM.ambM),range:120,pitch:-17,cap:`${hhmm(ET.amb)} · 119 출동`,sub:`도착까지 약 ${Math.round((ET.ambArr-ET.amb)/60)}분`},
 {t:ET.ambArr,orbit:{p:[EM.site[0],EM.site[1],EM.siteG+3],head:hd+40,spd:6},range:160,pitch:-20,cap:`${hhmm(ET.ambArr)} · 현장 도착`,sub:'낙석 제거·부상자 확인'},
 {t:ET.fire-30,view:{lon:EM.fire[0],lat:EM.fire[1],g:EM.fireG,head:DEG(EM.windH)+180,pitch:-22,range:1300},cap:'14:30 · 금마2리 뒷산',sub:'산불감시 카메라 구역'},
 {t:ET.fireDetect,view:{lon:EM.fire[0],lat:EM.fire[1],g:EM.fireG,head:DEG(EM.windH)+150,pitch:-20,range:420},cap:`${hhmm(ET.fireDetect)} · 산불 감지`,sub:'바람 북동쪽으로 초속 4~5m'},
 {t:ET.evac+20,follow:moverFollow(EM.evM),range:140,pitch:-19,cap:`${hhmm(ET.evac)} · 대피 DRT 출발`,sub:'금마2리 마을회관 집결 주민 수송'},
 {t:ET.evArr,view:{lon:EM.hall[0],lat:EM.hall[1],head:DEG(headOf(EM.hall,EM.fire))+180,pitch:-14,range:520},cap:`${hhmm(ET.evArr)} · 회관 도착 · 탑승`,sub:'뒤로 보이는 연기'},
 {t:ET.evDep+60,follow:moverFollow(EM.evM),range:150,pitch:-20,cap:'대합실로 대피',sub:'T0 대합실 = 임시 대피소'},
 {t:ET.contain,orbit:{p:[EM.fire[0],EM.fire[1],EM.fireG],head:DEG(EM.windH)+120,spd:4},range:900,pitch:-28,cap:`${hhmm(ET.contain)} · 주불 진화`,sub:'피해 면적 확정'}]}
function opsShots(){const o=[];const cyc=[()=>({view:{lon:T0P[0],lat:T0P[1],g:P.T0.g,head:200,pitch:-22,range:700},cap:'T0 대합실 · 통합 플랫폼',sub:'DRT·센서·재난 정보가 모이는 곳'}),
 ()=>{const mv=vehEnts.find(e=>vehAt(e.v,S.t+60).mv);return mv?{follow:vehFollow(mv),range:190,pitch:-21,cap:`${mv.v.z} DRT 운행`}:{view:{lon:128.255,lat:37.255,head:-30,pitch:-30,range:5000},cap:'DRT 대기'}},
 ()=>({orbit:{p:[P.S2.lon,P.S2.lat,P.S2.g+3],head:30,spd:5},range:260,pitch:-22,cap:'S2 신일리 밭 센서',sub:`토양수분 ${fmAt('S2',S.t).m}%`}),
 ()=>({view:{lon:128.2745,lat:37.2668,head:230,pitch:-20,range:1100},cap:'주천강 수위',sub:'평상시 · 범람 위험 없음'}),
 ()=>({orbit:{p:[P.S1.lon,P.S1.lat,P.S1.g+3],head:120,spd:5},range:260,pitch:-22,cap:'S1 용석리 밭 센서',sub:`토양수분 ${fmAt('S1',S.t).m}%`}),
 ()=>({view:{lon:T.center[0],lat:T.center[1]-.012,head:10,pitch:-34,range:13000},cap:'주천면 전체',sub:'판운리 제외 반경 6.1km'})];
 for(let t=S.t0,k=0;t<S.t1;t+=2400,k++){const f=cyc[k%cyc.length];o.push({t,pick:f})}return o}
const SHOTS={};
function buildShots(){SHOTS.intro=[{t:0,orbit:{p:[T.center[0],T.center[1],groundAt(T.center[0],T.center[1])]},spd:3,range:13500,pitch:-33,cap:'주천면 디지털트윈',sub:'판운리를 뺀 반경 6.1km · 건물 4,632동 · 실제 지형'}];SHOTS.intro[0].orbit.spd=3;SHOTS.drt=drtShots();SHOTS.flood=floodShots();SHOTS.farm=farmShots();SHOTS.emer=emerShots();SHOTS.ops=opsShots();DIR.idx=-1}
addEventListener('keydown',e=>{if(e.target.matches('input,select'))return;if(e.key==='4')setScene('farm');else if(e.key==='5')setScene('emer');else if(e.key==='6')setScene('ops');else if(e.key.toLowerCase()==='c')setDir(!DIR.on)});

/* ---------- scene definitions ---------- */
const gantt=(rows,X,pt,ih,w,pl)=>{let o='';const rh=ih/rows.length;rows.forEach((r,i)=>{const y=pt+i*rh;o+=`<text x="${pl-4}" y="${y+rh*.65}" fill="#9aabc4" font-size="10.5" text-anchor="end">${r.n}</text>`;r.s.forEach(([a,b])=>{o+=`<rect x="${X(a)}" y="${y+3}" width="${Math.max(2,X(b)-X(a))}" height="${rh-6}" rx="3" fill="${r.c}"/>`})});return o};
const EXT={
 farm:{t0:0,t1:H(24)-600,t:H(5),step:600,rate:1100,
  view:{lon:128.262,lat:37.246,head:-10,pitch:-38,range:8000},
  panel:()=>`<h1>밭이 마르면 센서가 먼저 안다</h1><p class="lede">용석리(S1)·신일리(S2) 대표 밭의 토양수분 센서가 10분마다 값을 T0 통합 플랫폼으로 보낸다. 20% 아래로 떨어지면 밸브가 열려 자동 관수, 33°C를 넘으면 밭일 자제 알림이 나간다.</p><div id="k"></div><div class="fig"><svg id="ch"></svg></div><ul class="log" id="lg"></ul><p class="note">센서 위치와 필지는 설계안의 실제 필지(밭 6,349㎡·4,306㎡). 수분·기온 값은 8월 맑은 날을 가정한 시나리오. 노란 원은 스마트팜 단지 7곳.</p>`,
  legend:[['#2f8fd8','토양수분 높음 (필지 색)',''],['#c8873a','토양수분 낮음',''],['#3ee6c1','센서 → 플랫폼 데이터','dot'],['#e0a83a','스마트팜 단지','']],
  kpi:t=>{const a=fmAt('S1',t),b=fmAt('S2',t);const n=id=>IRR[id].filter(([s])=>s<=t).length;const water=(IRR.S1.concat(IRR.S2)).reduce((s,[x,y])=>s+clamp(Math.min(t,y)-x,0,1e9),0)/3600*14;
   return kp([[a.m.toFixed(1)+'%',`S1 용석리 토양수분${a.irr?' · 관수 중':''}`,a.m<20.5?'warn':''],[b.m.toFixed(1)+'%',`S2 신일리 토양수분${b.irr?' · 관수 중':''}`,b.m<20.5?'warn':''],[a.ta+'°C','기온 (S1)',a.ta>=33?'alert':''],[`${n('S1')+n('S2')}회 · ${water.toFixed(1)}t`,'오늘 자동 관수 · 물 사용']])},
  chart:(X,Y,pt,ih,w,pl)=>{const Ym=v=>pt+ih-(v-14)/(34-14)*ih;let o='';Object.entries(IRR).forEach(([id,ev])=>ev.forEach(([a,b])=>o+=`<rect x="${X(a)}" y="${pt}" width="${Math.max(2,X(b)-X(a))}" height="${ih}" fill="${id==='S1'?'rgba(224,168,58,.16)':'rgba(62,230,193,.16)'}"/>`));
   o+=`<line x1="${pl}" x2="${w-26}" y1="${Ym(20)}" y2="${Ym(20)}" stroke="#ffc145" stroke-dasharray="4 4"/><text x="${w-28}" y="${Ym(20)-4}" fill="#ffc145" font-size="10.5" text-anchor="end">관수 기준 20%</text>`;
   [['S1','#e0a83a'],['S2','#3ee6c1']].forEach(([id,c])=>o+=`<path d="${FM[id].map((x,i)=>(i?'L':'M')+X(i*600).toFixed(1)+' '+Ym(x.m).toFixed(1)).join('')}" fill="none" stroke="${c}" stroke-width="2.3"/>`);
   o+=`<text x="${pl}" y="${pt+10}" fill="#e0a83a" font-size="11">S1 토양수분</text><text x="${pl+72}" y="${pt+10}" fill="#3ee6c1" font-size="11">S2</text>`;return o},
  events:()=>{const ev=[];for(const id of FARM_IDS){IRR[id].forEach(([a,b])=>{ev.push({t:a,lv:'info',who:id+' 밭 센서',msg:`${id==='S1'?'용석리':'신일리'} 토양수분 ${fmAt(id,a-600).m}% → 자동 관수 시작`});ev.push({t:b,quiet:1,msg:`${id} 관수 종료 · 수분 ${fmAt(id,b).m}%`})})}
   if(heatT>0)ev.push({t:heatT,lv:'warn',who:'폭염 알림',msg:'기온 33°C 돌파 · 마을 방송 "한낮 밭일 자제"'});ev.push({t:H(5),quiet:1,msg:'센서 7곳 데이터 수신 정상'});return ev.sort((a,b)=>a.t-b.t)},
  frame:(on,t)=>farmFrame(on,t)},
 emer:{t0:H(13.9),t1:H(15.75),t:H(13.92),step:10,rate:t=>t>=ET.rock-30&&t<ET.rock+70?4:t>=ET.amb&&t<ET.ambArr+20?12:t>=ET.fire-20&&t<ET.fireDetect+40?18:(t>=ET.evac&&t<ET.evArr+20)||(t>=ET.evDep&&t<ET.evBack)?20:60,
  view:{lon:(EM.site[0]+EM.fire[0])/2,lat:(EM.site[1]+EM.fire[1])/2,head:-20,pitch:-32,range:6500},
  panel:()=>`<h1>산골 도로의 낙석, 마을 뒷산의 불</h1><p class="lede">신일4리로 가는 군도 절개면에서 낙석이 나고, 30분 뒤 금마2리 뒷산에 산불이 난다. 경사계·감시카메라가 먼저 알리고, 통제·출동·대피가 한 화면에서 돌아간다.</p><div id="k"></div><div class="fig"><svg id="ch"></svg></div><ul class="log" id="lg"></ul><p class="note">사고 위치·시각·바람은 가상 시나리오. 차량 경로는 도로명주소 도로망의 실제 길. 119 출발지는 주천 대합실 부근으로 가정. 산불은 실제 지형에서 회관 주변 가장 높은 비탈을 골랐다.</p>`,
  legend:[['#ff3b4e','통제 구간',''],['#ff5a6a','119 구급·구조','dot'],['#ff4fa3','대피 DRT','dot'],['#2a1a12','산불 피해 면적',''],['#ff7a1a','불머리','']],
  kpi:t=>{const st=emStats(t);const ctl=t>=ET.close?`${Math.round((ET.close-ET.rock)/60*10)/10}분`:'–',arr=t>=ET.ambArr?`${Math.round((ET.ambArr-ET.amb)/60)}분`:t>=ET.amb?`${Math.max(0,Math.round((ET.ambArr-t)/60))}분 남음`:'–';
   return kp([[ctl,'낙석 → 도로 통제',''],[arr,'119 현장 도착',t>=ET.amb&&t<ET.ambArr?'warn':''],[st.area?st.area.toFixed(1)+'ha':'–','산불 피해 면적',st.area&&t<ET.contain?'alert':''],[t>=ET.evArr?'14명':t>=ET.bcast?'집결 중':'–','대피 주민 (가정)',t>=ET.bcast&&t<ET.evBack?'warn':'']])},
  chart:(X,Y,pt,ih,w,pl)=>gantt([{n:'낙석',c:'#c9a27a',s:[[ET.rock,ET.rock+60]]},{n:'통제',c:'#ff3b4e',s:[[ET.close,H(15.75)]]},{n:'119',c:'#ff8a95',s:[[ET.amb,ET.ambArr]]},{n:'산불',c:'#ff7a1a',s:[[ET.fire,ET.contain]]},{n:'대피',c:'#ff4fa3',s:[[ET.evac,ET.evBack]]}],X,pt,ih,w,pl+26),
  chartPad:26,
  events:()=>[{t:ET.rock,lv:'alert',who:'비탈면 경사계',msg:'신일4리 군도 절개면 변위 급증 · 낙석'},{t:ET.detect,lv:'alert',who:'통합 플랫폼',msg:'낙석 확인 · CCTV 자동 전환'},{t:ET.close,lv:'warn',who:'도로 통제',msg:'해당 구간 차단 · DRT 서부 노선 우회 안내'},{t:ET.amb,lv:'alert',who:'119',msg:`구급·구조 출동 · 예상 ${Math.round((ET.ambArr-ET.amb)/60)}분`},{t:ET.ambArr,lv:'info',who:'119',msg:'현장 도착 · 부상자 없음 · 낙석 제거 시작'},
   {t:ET.fire,quiet:1,msg:'금마2리 뒷산 연기 발생'},{t:ET.fireDetect,lv:'alert',who:'산불감시 카메라',msg:'금마2리 뒷산 화염 감지 · 산림청 자동 신고'},{t:ET.bcast,lv:'alert',who:'마을 방송',msg:'금마2리 주민 마을회관 집결 안내'},{t:ET.evac,lv:'warn',who:'대피 DRT',msg:'T0 → 금마2리 회관 출발'},{t:ET.evArr,lv:'info',who:'대피 DRT',msg:'회관 도착 · 14명 탑승'},{t:ET.evBack,lv:'info',who:'대피 DRT',msg:'T0 대합실 도착 · 임시 대피 완료'},{t:ET.contain,lv:'info',who:'산림청',msg:`주불 진화 · 피해 ${emStats(ET.contain).area.toFixed(1)}ha`}],
  frame:(on,t)=>emerFrame(on,t)},
 ops:{t0:H(6.5),t1:H(20),t:H(8),step:60,rate:700,
  view:{lon:T.center[0],lat:T.center[1]-.012,head:10,pitch:-34,range:13000},
  panel:()=>`<h1>한 화면에서 보는 주천면</h1><p class="lede">DRT·하천 수위·밭 센서·재난 감시가 T0 대합실 통합 플랫폼으로 모인다. 카드를 누르면 해당 시뮬레이션으로 넘어간다.</p><div id="k"></div><ul class="log" id="lg"></ul><p class="note">평범한 8월 하루. 각 카드의 상세 상황은 해당 탭에서 재생.</p>`,
  legend:[...ZN.map(z=>[ZC[z],z+' DRT','']),['#3ee6c1','센서 데이터','dot']],
  kpi:t=>{const s=drtStats(M,t),a=fmAt('S1',t),b=fmAt('S2',t),x=FS_OPS[clamp(Math.floor(t/600),0,143)];const irr=a.irr||b.irr;
   const card=(sc,cls,tt,v,sub)=>`<button class="card ${cls}" data-go="${sc}"><b>${tt}</b><strong>${v}</strong><span>${sub}</span></button>`;
   return `<div class="cards">${card('drt',s.moving?'ok':'','DRT',s.moving?`${s.moving}대 운행`:'대기',`호출 ${s.called} · 평균 대기 ${(s.wait/60).toFixed(0)}분`)}${card('flood','ok','하천 수위','정상',`시간당 ${Math.round(x.rain)}mm · 범람 위험 없음`)}${card('farm',irr?'warn':'ok','밭 센서',irr?'관수 중':'정상',`S1 ${a.m}% · S2 ${b.m}% · ${a.ta}°C`)}${card('emer','ok','재난 감시','이상 없음','경사계 12 · 산불카메라 3')}</div>`},
  events:()=>{const ev=[[26400,'고정편 07:20 출발'],[30000,'고정편 08:20 출발'],[65400,'고정편 18:10 · 귀가편']].map(([t,m])=>({t,msg:m,who:'DRT',lv:'info'}));for(const id of FARM_IDS)IRR[id].forEach(([a])=>ev.push({t:a,lv:'info',who:id+' 센서',msg:'자동 관수 시작'}));if(heatT>0)ev.push({t:heatT,lv:'warn',who:'폭염',msg:'33°C 돌파 · 밭일 자제 방송'});return ev.sort((a,b)=>a.t-b.t)},
  frame:(on,t)=>{farmFrame(on,t)}}};
$('#pin').addEventListener('click',e=>{const b=e.target.closest('[data-go]');if(b)setScene(b.dataset.go)});
buildShots();
{let lt=performance.now();scene.preRender.addEventListener(()=>{const n=performance.now(),dt=Math.min(.1,(n-lt)/1000);lt=n;REALJD=C.JulianDate.now();try{director(dt)}catch(e){console.warn('director',e)}})}

/* ---------- UI 숨김 · / 메뉴 · F1 발표 ---------- */
{const st=document.createElement('style');st.textContent=`body.ui-off #top,body.ui-off #panel,body.ui-off #bar,body.ui-off #legend,body.ui-off #toast,body.ui-off #keybox,body.ui-off #tip{opacity:0;pointer-events:none!important;transform:translateY(6px)}
#top,#panel,#bar,#legend,#toast{transition:opacity .35s,transform .35s}#bar{transform:translateX(-50%)}body.ui-off #bar{transform:translate(-50%,8px)}
#hint{position:fixed;right:18px;bottom:16px;z-index:6;font:600 12.5px "Noto Sans KR";color:#fff;background:rgba(6,10,18,.55);padding:7px 11px;border-radius:9px;backdrop-filter:blur(4px);transition:opacity .4s;pointer-events:none}body:not(.ui-off) #hint,body.pres #hint{opacity:0}
#hint kbd{font:700 12px "IBM Plex Mono",monospace;background:rgba(255,255,255,.16);border-radius:5px;padding:1px 6px;margin:0 2px}
#pres{position:fixed;left:50%;top:calc(7.5vh + 18px);transform:translateX(-50%);z-index:6;font:700 12px "Noto Sans KR";color:#cfd8e6;letter-spacing:.02em;opacity:0;transition:opacity .4s;pointer-events:none}body.pres #pres{opacity:.85}`;document.head.appendChild(st);
 const h=document.createElement('div');h.id='hint';h.innerHTML='<kbd>/</kbd> 시뮬레이션 메뉴 · <kbd>F1</kbd> 발표';document.body.appendChild(h);
 const p=document.createElement('div');p.id='pres';document.body.appendChild(p)}
document.body.classList.add('ui-off');
const toggleUI=v=>{document.body.classList.toggle('ui-off',v===undefined?!document.body.classList.contains('ui-off'):!v);setTimeout(drawChart,400)};
const PRES={on:false,i:0,order:['intro','drt','flood','farm','emer','ops'],names:{intro:'한눈에 보기',drt:'DRT 하루 운행',flood:'집중호우 · 침수',farm:'농업 센서',emer:'비상 대응',ops:'통합 상황판'},timer:null,wasDir:true,startAt:0};
function presStep(){if(!PRES.on)return;const s=PRES.order[PRES.i];$('#pres').textContent=`발표 ${PRES.i+1} / ${PRES.order.length} · ${PRES.names[s]} · Esc 또는 F1로 종료`;setScene(s,3);
 setTimeout(()=>{if(!PRES.on)return;S.t=S.t0;resetLog();DIR.user=false;DIR.idx=-1;S.playing=true;$('#play').textContent='일시정지';PRES.startAt=performance.now()},3300)}
function presOn(){PRES.on=true;PRES.i=0;PRES.wasDir=DIR.on;setDir(true);toggleUI(false);document.body.classList.add('pres');$('#spd').value='1';presStep();
 clearInterval(PRES.timer);PRES.timer=setInterval(()=>{if(!PRES.on)return;if(!S.playing&&S.t>=S.t1-1&&performance.now()-PRES.startAt>4000){PRES.i++;if(PRES.i>=PRES.order.length){presOff();caption('발표 끝','/ 로 시뮬레이션 메뉴 열기');return}presStep()}},600)}
function presOff(){PRES.on=false;clearInterval(PRES.timer);document.body.classList.remove('pres');S.playing=false;$('#play').textContent='재생';setDir(PRES.wasDir);dirStop()}
addEventListener('keydown',e=>{if(e.target.matches('input,select,textarea'))return;
 if(e.key==='/'){e.preventDefault();if(PRES.on)presOff();toggleUI()}
 else if(e.key==='F1'){e.preventDefault();PRES.on?presOff():presOn()}
 else if(e.key==='Escape'&&PRES.on){presOff()}
 else if(PRES.on&&(e.key==='ArrowRight'||e.key==='PageDown')){PRES.i=Math.min(PRES.order.length-1,PRES.i+1);presStep()}
 else if(PRES.on&&(e.key==='ArrowLeft'||e.key==='PageUp')){PRES.i=Math.max(0,PRES.i-1);presStep()}},true);
addEventListener('help',e=>e.preventDefault());


















/* ================= FILM: 1920×1080 녹화용 시네마틱 영상 4편 ================= */
if(window.FILM){
const FW=1920,FH=1080,FPS=60;
DIR.on=false;dirStop();
globe.tileCacheSize=3000;globe.preloadSiblings=true;globe.loadingDescendantLimit=60;
{const st=document.createElement('style');st.textContent=`html,body{overflow:hidden;background:#000}
#cz{position:fixed!important;left:0;top:0;width:${FW}px!important;height:${FH}px!important;transform-origin:0 0}
#top,#panel,#bar,#legend,#toast,#hint,#pres,#cap,#lbT,#lbB,#tip,#keybox,#rain,#vig{display:none!important}
#filmui{position:fixed;left:10px;top:10px;z-index:20;background:rgba(6,10,18,.85);color:#fff;font:600 13px "Noto Sans KR";padding:10px 12px;border-radius:10px;display:grid;gap:6px}
#filmui button{font:700 12px "Noto Sans KR";padding:6px 9px;border-radius:7px;border:1px solid #445;background:#1b2436;color:#fff;cursor:pointer}#filmui .row{display:flex;gap:5px;flex-wrap:wrap}`;document.head.appendChild(st)}
const fitView=()=>{$('#cz').style.transform=`scale(${Math.min(innerWidth/FW,innerHeight/FH)})`};fitView();addEventListener('resize',fitView);
viewer.useBrowserRecommendedResolution=false;
const fixRes=()=>{viewer.resolutionScale=1/(window.devicePixelRatio||1);viewer.resize()};fixRes();setTimeout(fixRes,500);setTimeout(fixRes,3000);
try{scene.msaaSamples=LITE?1:4}catch(e){}
const comp=document.createElement('canvas');comp.width=FW;comp.height=FH;const g=comp.getContext('2d');
const ui=document.createElement('div');ui.id='filmui';document.body.appendChild(ui);

/* ---------- helpers ---------- */
const sm=u=>{u=clamp(u,0,1);return u*u*(3-2*u)};
const ease=u=>{u=clamp(u,0,1);return u<.5?4*u*u*u:1-(-2*u+2)**3/2};
const CLR={dp:0};
function camAt(p,head,pitch,range){const tg=C.Cartesian3.fromDegrees(p[0],p[1],p[2]);let need=0;
 for(let k=0;k<12;k++){camera.lookAt(tg,new C.HeadingPitchRange(RAD(head),RAD(Math.max(-80,pitch-need)),range));const cg=camera.positionCartographic,gh2=globe.getHeight(cg);if(gh2==null||cg.height-gh2>=22)break;need+=3}
 CLR.dp=need>CLR.dp?CLR.dp+(need-CLR.dp)*.25:CLR.dp*.96;camera.lookAt(tg,new C.HeadingPitchRange(RAD(head),RAD(Math.max(-80,pitch-Math.max(CLR.dp,need*.6))),range))}
ssc.enableCollisionDetection=false;
async function prepKeys(keys){const need=keys.filter(k=>k.p&&k.p.length===2);if(need.length){const hs=await gh(need.map(k=>k.p));need.forEach((k,i)=>k.p=[k.p[0],k.p[1],hs[i]+(k.up||0)])}return keys}
function liveH(k){if(!k.p||k.fixed)return;const g=globe.getHeight(C.Cartographic.fromDegrees(k.p[0],k.p[1]));if(g==null)return;const want=g+(k.up||0);if(k.lh==null)k.lh=want;k.lh+=(want-k.lh)*.15;k.p[2]=k.lh}
function keyCam(keys,t){FOL.h=null;let i=0;while(i<keys.length-1&&keys[i+1].t<=t)i++;const a=keys[i],b=keys[Math.min(i+1,keys.length-1)];liveH(a);liveH(b);const u=a===b?0:ease((t-a.t)/(b.t-a.t));
 const p=[a.p[0]+(b.p[0]-a.p[0])*u,a.p[1]+(b.p[1]-a.p[1])*u,a.p[2]+(b.p[2]-a.p[2])*u];let dh=b.head-a.head;while(dh>180)dh-=360;while(dh<-180)dh+=360;
 camAt(p,a.head+dh*u,a.pitch+(b.pitch-a.pitch)*u,Math.exp(Math.log(a.range)+(Math.log(b.range)-Math.log(a.range))*u))}
const FOL={h:null};
function followCam(r,pitch,range,headOff=0,k=.06,pk=.18){if(!r)return;if(FOL.h==null){FOL.h=r.head;FOL.p=r.p.slice()}FOL.h=lerpAng(FOL.h,r.head,k);for(let i=0;i<3;i++)FOL.p[i]+=(r.p[i]-FOL.p[i])*pk;camAt(FOL.p,DEG(FOL.h)+headOff,pitch,range)}
const mono=pts=>{for(let i=1;i<pts.length;i++)pts[i][1]=Math.max(pts[i][1],pts[i-1][1]+30);return pts};
const pw=(pts,t)=>{if(t<=pts[0][0])return pts[0][1];for(let i=1;i<pts.length;i++)if(t<=pts[i][0]){const[a,va]=pts[i-1],[b,vb]=pts[i];return va+(vb-va)*(t-a)/(b-a)}return pts[pts.length-1][1]};
const alpha=(t,a,b,f=.6)=>clamp(Math.min((t-a)/f,(b-t)/f),0,1);
/* ---------- 2D overlay drawing ---------- */
const FONT='"Noto Sans KR"';
function rr(x,y,w,h,r){g.beginPath();g.roundRect(x,y,w,h,r)}
function txt(s,x,y,size,weight=700,col='#fff',align='left'){g.font=`${weight} ${size}px ${FONT}`;g.fillStyle=col;g.textAlign=align;g.fillText(s,x,y)}
function wrap(s,maxW,size,weight=700){g.font=`${weight} ${size}px ${FONT}`;const out=[];let line='';for(const ch of s){const t2=line+ch;if(g.measureText(t2).width>maxW&&line){out.push(line);line=ch}else line=t2}if(line)out.push(line);for(let i=1;i<out.length;i++)while(/^[.,!?·)」]/.test(out[i])){out[i-1]+=out[i][0];out[i]=out[i].slice(1)}return out.filter(x=>x)}
function brand(no,name){g.save();g.globalAlpha=.92;rr(36,32,560,58,14);g.fillStyle='rgba(6,10,18,.62)';g.fill();txt(no,58,72,26,900,'#3ee6c1');txt(name,108,72,24,800);txt('강원 영월군 주천면 · 스마트시티 3조',590-14,72,15,500,'#9aabc4','right');g.restore()}
function titleCard(t,a,b,no,title,sub){const al=alpha(t,a,b,.8);if(al<=0)return;g.save();g.globalAlpha=al;const gr=g.createLinearGradient(0,0,FW*.7,0);gr.addColorStop(0,'rgba(4,8,16,.88)');gr.addColorStop(1,'rgba(4,8,16,0)');g.fillStyle=gr;g.fillRect(0,0,FW,FH);
 const dy=(1-sm((t-a)/1.2))*30;txt(no,120,430+dy,40,900,'#3ee6c1');txt(title,120,520+dy,88,900);txt(sub,122,590+dy,34,500,'#cdd8e8');g.fillStyle='#3ee6c1';g.fillRect(122,630+dy,120*sm((t-a)/1.4),5);g.restore()}
function sub(t,lines){const L=lines.find(l=>t>=l[0]&&t<=l[1]);if(!L)return;const al=alpha(t,L[0],L[1],.35);const rows=wrap(L[2],1560,38,700);g.save();g.globalAlpha=al;const h=rows.length*54+28,w=Math.min(1640,Math.max(...rows.map(r=>(g.font=`700 38px ${FONT}`,g.measureText(r).width)))+64);
 rr((FW-w)/2,FH-90-h,w,h,16);g.fillStyle='rgba(0,0,0,.62)';g.fill();rows.forEach((r,i)=>txt(r,FW/2,FH-90-h+56+i*54,38,700,'#fff','center'));g.restore()}
function lower(t,a,b,head,body,col='#3ee6c1'){const al=alpha(t,a,b,.5);if(al<=0)return;g.save();g.globalAlpha=al;const dx=(1-sm((t-a)/.6))*-40;const rows=wrap(body,620,24,500);const h=74+rows.length*36;
 rr(60+dx,FH-330-h,700,h,16);g.fillStyle='rgba(6,10,18,.78)';g.fill();g.fillStyle=col;g.fillRect(60+dx,FH-330-h,8,h);txt(head,92+dx,FH-330-h+48,30,800,col);rows.forEach((r,i)=>txt(r,92+dx,FH-330-h+88+i*36,24,500,'#e6edf7'));g.restore()}
function alertCard(t,a,b,lv,head,body){const al=alpha(t,a,b,.4);if(al<=0)return;const col=lv==='alert'?'#ff4d5e':lv==='warn'?'#ffc145':'#3ee6c1';g.save();g.globalAlpha=al;const dx=(1-sm((t-a)/.5))*80;
 rr(FW-640+dx,200,580,128,16);g.fillStyle='rgba(6,10,18,.84)';g.fill();g.lineWidth=3;g.strokeStyle=col;g.stroke();g.beginPath();g.arc(FW-600+dx,250,12+4*Math.sin(t*8),0,7);g.fillStyle=col;g.fill();
 txt(head,FW-570+dx,262,30,900,col);txt(body,FW-614+dx,306,22,500,'#e6edf7');g.restore()}
function kpis(t,a,b,items){const al=alpha(t,a,b,.5);if(al<=0)return;g.save();g.globalAlpha=al;items.forEach(([v,l,col],i)=>{const x=FW-60-i*300-280,y=40+118;rr(x,y-118,280,118,16);g.fillStyle='rgba(6,10,18,.76)';g.fill();txt(v,x+24,y-60,44,900,col||'#fff');txt(l,x+24,y-24,19,500,'#9aabc4')});g.restore()}
function endCard(t,a,b,big,small){const al=alpha(t,a,b,.8);if(al<=0)return;g.save();g.globalAlpha=al;g.fillStyle='rgba(4,8,16,.72)';g.fillRect(0,0,FW,FH);txt(big,FW/2,FH/2-10,72,900,'#fff','center');txt(small,FW/2,FH/2+60,32,500,'#9fe9d6','center');g.restore()}
const rainDrops=[...Array(900)].map(()=>[Math.random(),Math.random(),.6+Math.random()*.8]);
function rain(t,v){if(v<2)return;const n=Math.round(clamp(v/70,.08,1)*rainDrops.length);g.save();g.strokeStyle=`rgba(210,225,240,${clamp(.18+v/200,.18,.5)})`;g.lineWidth=1.6;g.beginPath();for(let i=0;i<n;i++){const d=rainDrops[i];const y=((d[1]+t*1.6*d[2])%1)*FH,x=d[0]*FW;g.moveTo(x,y);g.lineTo(x-7*d[2],y+38*d[2])}g.stroke();g.restore()}
function vignette(){const gr=g.createRadialGradient(FW/2,FH/2,FH*.45,FW/2,FH/2,FH*.95);gr.addColorStop(0,'rgba(0,0,0,0)');gr.addColorStop(1,'rgba(0,0,0,.38)');g.fillStyle=gr;g.fillRect(0,0,FW,FH)}

const SUN=scene.light,baseL=viewer.imageryLayers.get(0);let NIGHT=false;
function nightMode(on){NIGHT=on;if(on){scene.light=new C.DirectionalLight({direction:C.Cartesian3.normalize(C.Cartesian3.add(C.Cartesian3.negate(UPV,new C.Cartesian3()),new C.Cartesian3(.15,.1,0),new C.Cartesian3()),new C.Cartesian3()),color:C.Color.fromCssColorString('#9fb2ff'),intensity:.22});if(baseL){baseL.brightness=.2;baseL.saturation=.45;baseL.contrast=1.15}viewer.shadowMap.enabled=false}
 else{scene.light=SUN;if(baseL){baseL.brightness=1.05;baseL.saturation=1.05;baseL.contrast=1.08}viewer.shadowMap.enabled=false}
 if(wallPrim.ready){const dw=C.ColorGeometryInstanceAttribute.toValue(C.Color.fromCssColorString('#3b3f48')),dr=C.ColorGeometryInstanceAttribute.toValue(C.Color.fromCssColorString('#2c3038'));B.forEach((b,i)=>{const a=wallPrim.getGeometryInstanceAttributes('b'+i);if(a)a.color=on?dw:C.ColorGeometryInstanceAttribute.toValue(b.wc);const r=roofPrim.ready&&roofPrim.getGeometryInstanceAttributes('r'+i);if(r)r.color=on?dr:C.ColorGeometryInstanceAttribute.toValue(b.house?b.rc:C.Color.fromCssColorString('#cfcac0'));bState[i]=0})}}
function nightSky(){if(!NIGHT)return;scene.skyAtmosphere.brightnessShift=-.92;scene.skyAtmosphere.saturationShift=-.3;globe.atmosphereBrightnessShift=-.7;scene.fog.density=1.2e-4;scene.fog.minimumBrightness=.01}
function dayMode(){nightMode(false);hallEnts.forEach(e=>e.show=true);for(const id in facEnts)facEnts[id].show=true}
/* film-wide look: no shadows, bigger labels, village names, river-coloured flood water */
const OCC=[];viewer.shadows=false;viewer.shadowMap.enabled=false;scene.globe.shadows=C.ShadowMode.DISABLED;
try{wallPrim.shadows=C.ShadowMode.DISABLED;roofPrim.shadows=C.ShadowMode.DISABLED}catch(e){}
viewer.entities.values.forEach(e=>{if(e.model)e.model.shadows=C.ShadowMode.DISABLED});
const BIGLBL={style:C.LabelStyle.FILL_AND_OUTLINE,outlineColor:new C.Color(0.02,0.04,0.08,0.95),disableDepthTestDistance:Number.POSITIVE_INFINITY};
hallEnts.forEach((e,i)=>{const h=T.halls[i];e.label.text=`${short(h.name)} 마을회관`;e.label.font='700 21px "Noto Sans KR"';e.label.outlineWidth=5;e.label.scaleByDistance=new C.NearFarScalar(1500,1.15,16000,.8);e.label.distanceDisplayCondition=new C.DistanceDisplayCondition(0,16000);e.label.fillColor=C.Color.fromCssColorString('#f3f7ff')});
for(const id in facEnts){const e=facEnts[id];if(e.label){e.label.font='800 24px "Noto Sans KR"';e.label.outlineWidth=6;e.label.scaleByDistance=new C.NearFarScalar(1500,1.15,18000,.85)}}
{const g2={};B.forEach(b=>{if(!b.r)return;const c=b.p[0];(g2[b.r]=g2[b.r]||[]).push(c)});
 Object.entries(g2).forEach(([r,pts])=>{if(pts.length<15)return;const xs=pts.map(p=>p[0]).sort((a,b)=>a-b),ys=pts.map(p=>p[1]).sort((a,b)=>a-b);let m=[xs[xs.length>>1],ys[ys.length>>1]];for(let k=0;k<6;k++){const near=Object.values(P).concat(T.halls).some(q=>mdist([q.lon,q.lat],m)<450);if(!near)break;m=offLL(m[0],m[1],0,260)}
  OCC.push({e:viewer.entities.add({position:C.Cartesian3.fromDegrees(m[0],m[1]),label:{...BIGLBL,text:r,font:'900 38px "Noto Sans KR"',fillColor:C.Color.WHITE,outlineWidth:8,heightReference:C.HeightReference.CLAMP_TO_GROUND,verticalOrigin:C.VerticalOrigin.BOTTOM,pixelOffset:new C.Cartesian2(0,-20),scaleByDistance:new C.NearFarScalar(800,1.1,25000,.6),distanceDisplayCondition:new C.DistanceDisplayCondition(0,40000)}}),ll:m})})}
MASK.show=false;
/* labels hide when a hill stands between the camera and the place (no floating through terrain) */
hallEnts.forEach((e,i)=>OCC.push({e,ll:[T.halls[i].lon,T.halls[i].lat]}));for(const id in facEnts)OCC.push({e:facEnts[id],ll:[P[id].lon,P[id].lat]});
const occRay=new C.Ray(),occP=new C.Cartesian3();
function occlude(){const cam=camera.positionWC;for(const o of OCC){const h=globe.getHeight(C.Cartographic.fromDegrees(o.ll[0],o.ll[1]));let vis=true;if(h!=null){C.Cartesian3.fromDegrees(o.ll[0],o.ll[1],h+8,undefined,occP);const d=C.Cartesian3.distance(cam,occP);C.Cartesian3.clone(cam,occRay.origin);C.Cartesian3.normalize(C.Cartesian3.subtract(occP,cam,occRay.direction),occRay.direction);const hit=globe.pick(occRay,scene);if(hit&&C.Cartesian3.distance(cam,hit)<d-40)vis=false}
 if(o.e.label)o.e.label.show=vis;if(o.e.billboard)o.e.billboard.show=vis}}
hallEnts.forEach(e=>{e.label.verticalOrigin=C.VerticalOrigin.TOP;e.label.pixelOffset=new C.Cartesian2(0,16);e.label.distanceDisplayCondition=new C.DistanceDisplayCondition(0,5000)});
for(const id in facEnts){const e=facEnts[id];if(e.label){e.label.verticalOrigin=C.VerticalOrigin.BOTTOM;e.label.pixelOffset=new C.Cartesian2(0,-22)}}
function setRel(ids){for(const id in facEnts){const e=facEnts[id],rel=ids.includes(id),d=rel?new C.DistanceDisplayCondition(0,60000):new C.DistanceDisplayCondition(0,1500);if(e.label)e.label.distanceDisplayCondition=d;if(e.billboard)e.billboard.distanceDisplayCondition=d}}
for(const k in WATER){const W=WATER[k];if(W&&W.prim)W.prim.appearance.material=C.Material.fromType('Color',{color:C.Color.fromCssColorString('#2f5a63').withAlpha(.86)})}
/* ---------- FILM 1: DRT ---------- */
const nearStop=b=>{const p=P[b];let best=null,bd=1e9;T.stops.forEach(s=>{const d=mdist([p.lon,p.lat],[s.lon,s.lat]);if(d<bd){bd=d;best=s}});return best};
function drtCompare(){const rows=BIDS.map(b=>{const calls=M.calls.filter(c=>c.b===b&&c.dir==='in'&&c.wait!=null);const w=calls.length?calls.reduce((s,c)=>s+c.wait,0)/calls.length:900;const ride=calls.length?calls.reduce((s,c)=>s+(c.ride||RT[b+'-T0'].t),0)/calls.length:RT[b+'-T0'].t;
 const walk=T.bInfo[b].stopDist/.8,old=walk+3600+RT[b+'-T0'].t*1.25,nw=w+ride;return{b,name:short(P[b].name).replace(' ',''),old:old/60,nw:nw/60,walk:walk/60}});const o=rows.reduce((s,r)=>s+r.old,0)/rows.length,n=rows.reduce((s,r)=>s+r.nw,0)/rows.length;return{rows,old:o,nw:n,pct:Math.round((1-n/o)*100)}}
const F1={name:'DRT',file:'주천면_01_DRT',dur:82,
 enter(){dayMode();setScene('drt',0);setRel(['T0','B5','B6','B7','B8','B9'])},
 async setup(){S.drt={veh:2,rate:.15};M=makeDRT(S.drt);buildVehEnts(M);this.cmp=drtCompare();
  const ins=M.calls.filter(c=>c.dir==='in'&&c.pick!=null&&c.wait!=null);const avg=ins.reduce((x,c)=>x+c.wait,0)/ins.length;this.avg=avg;
  const cand=ins.filter(c=>c.t>H(8.6)&&c.t<H(15)&&c.wait>=300&&T.bInfo[c.b].stopDist>500).sort((x,y)=>Math.abs(x.wait-avg)-Math.abs(y.wait-avg)+(x.t-y.t)*1e-6);
  const call=cand[0]||ins[0];this.call=call;const b=call.b;this.b=b;const st=nearStop(b);this.stop=st;
  const v=vehEnts.find(e=>e.v.segs.some(s2=>s2.at===call.b&&Math.abs(s2.ts-call.pick)<2))||vehEnts.find(e=>e.v.z===ZONE_OF[call.b]);this.ve=v;
  // arrival at T0 after pick
  let arr=call.pick+1200;for(const s2 of v.v.segs)if(s2.r&&s2.ts>=call.pick&&s2.r.c[s2.r.c.length-1]&&mdist(s2.r.c[s2.r.c.length-1],T0P)<60){arr=s2.te;break}this.arr=arr;
  const hp=[P[b].lon,P[b].lat],sp=[st.lon,st.lat];const path=densify([hp,sp],10);const hs=await gh(path);this.walk=path.map((p,i)=>[p[0],p[1],hs[i]+1.2]);
  this.walkLine=viewer.entities.add({polyline:{positions:this.walk.map(p=>cart(p,p[2]+.5)),width:6,arcType:C.ArcType.NONE,material:new C.PolylineDashMaterialProperty({color:C.Color.fromCssColorString('#ffd36a'),dashLength:18})},show:false});
  this.stopEnt=viewer.entities.add({show:false,position:cart(sp,hs[hs.length-1]+1),billboard:{image:ringImg('#ffd36a',8),width:46,height:46,disableDepthTestDistance:Number.POSITIVE_INFINITY},label:{...LBL,text:'가까운 버스정류장 · '+st.name,fillColor:C.Color.fromCssColorString('#ffd36a'),pixelOffset:new C.Cartesian2(0,-28),heightReference:C.HeightReference.NONE}});
  const person=document.createElement('canvas');person.width=person.height=64;{const x=person.getContext('2d');x.fillStyle='#fff';x.beginPath();x.arc(32,14,9,0,7);x.fill();x.fillRect(24,25,16,24);x.fillRect(25,47,6,15);x.fillRect(33,47,6,15);x.strokeStyle='#ffd36a';x.lineWidth=3;x.beginPath();x.moveTo(44,28);x.lineTo(50,62);x.stroke()}
  this.ped=viewer.entities.add({show:false,position:new C.CallbackProperty(()=>{const u=clamp(((this.tt||0)-8)/12,0,1)*.45;const i=Math.max(0,Math.min(this.walk.length-2,Math.floor(u*(this.walk.length-1))));const q=this.walk[i];return cart(q,q[2])},false),billboard:{image:person,width:30,height:30,verticalOrigin:C.VerticalOrigin.BOTTOM,disableDepthTestDistance:Number.POSITIVE_INFINITY}});
  const g0=(await gh([hp]))[0];this.hp=[hp[0],hp[1],g0];
  this.keysA=await prepKeys([{t:0,p:[128.252,37.256],head:-25,pitch:-34,range:9000},{t:7,p:[128.248,37.258],head:-5,pitch:-30,range:5200},
   {t:8.5,p:[(hp[0]+sp[0])/2,(hp[1]+sp[1])/2],head:headOf(hp,sp)*57.3+90,pitch:-32,range:900},{t:20,p:[(hp[0]+sp[0])/2,(hp[1]+sp[1])/2],head:headOf(hp,sp)*57.3+60,pitch:-26,range:650},
   {t:22,p:hp,head:200,pitch:-22,range:420},{t:28,p:hp,head:150,pitch:-20,range:320},{t:30,p:hp,head:140,pitch:-24,range:420}]);
  this.keysC=await prepKeys([{t:50,p:T0P,head:210,pitch:-24,range:700},{t:55,p:T0P,head:180,pitch:-26,range:800},{t:56,p:[128.25,37.257],head:-20,pitch:-36,range:9500},{t:72,p:[128.25,37.257],head:25,pitch:-36,range:9000},{t:82,p:[128.25,37.257],head:40,pitch:-40,range:11000}]);
  const c=this.cmp;const nm=short(P[b].name).replace(' ',''),sd=T.bInfo[b].stopDist,wm=Math.round(sd/.8/60);this.nm=nm;this.lines=[[1,6.5,''],[7,12.4,`${nm} 어르신이 버스를 타려면, 가장 가까운 정류장까지 약 ${sd>=950?(sd/1000).toFixed(1)+'km':Math.round(sd/10)*10+'m'}를 걸어야 합니다.`],[12.6,20.5,`걸어서 ${wm}분. 버스를 놓치면 다음 차가 올 때까지 한참을 기다려야 하죠.`],
   [22,29.5,'DRT는 마을회관 호출벨 하나로 시작합니다. 벨을 누르면 권역 차량이 배정됩니다.'],[30.5,39,'승합차는 실제 도로의 최단 경로로 회관에 들러 어르신을 태우고,'],[39.5,49,'같은 방향의 다른 마을 호출까지 묶어서 T0 대합실로 향합니다.'],[50.5,55,'대합실 도착. 여기서 시내·시외버스로 갈아탑니다.'],
   [56.5,63,'서부·남부 다섯 마을의 대합실까지 이동 시간을 비교해 보면,'],[63.5,71,`기존 평균 ${Math.round(c.old)}분에서 DRT ${Math.round(c.nw)}분, 약 ${c.pct}% 줄어듭니다.`],[72.5,81,'권역마다 두 대, 모두 네 대로 다섯 마을을 맡는, 작은 마을에 맞는 교통입니다.']]},
 simT(t){const c=this.call;if(!this.mp)this.mp=mono([[22,c.t-120],[28,c.t+60],[30,c.pick-180],[50,c.pick+600]]);return t<22?H(9):t<50?pw(this.mp,t):t<56?this.arr-60+(t-50)*18:this.arr+48+(t-56)*60},
 update(t){this.tt=t;S.t=this.simT(t);frame(true);this.walkLine.show=t>7.5&&t<21.5;this.stopEnt.show=t>7.5&&t<21.5;this.ped.show=t>8&&t<21.5;
  if(t<30)keyCam(this.keysA,t);else if(t<50){const a=vehAt(this.ve.v,S.t);if(a.mv){this.lh=headOf(a.p,a.q);this.lp=a.p}if(this.lp)followCam({p:this.lp,head:this.lh},-20,t<32?320:210,0,.05)}else keyCam(this.keysC,t)},
 overlay(t){brand('01','DRT 수요응답형 교통');titleCard(t,0,6.6,'01','부르면 오는 마을버스','DRT · 이동 시간과 효율');
  lower(t,8.5,21.2,'지금: 걸어서 정류장까지',`${this.nm} 회관 → ${this.stop.name} ${Math.round(T.bInfo[this.b].stopDist)}m · 어르신 걸음(0.8m/s) 약 ${Math.round(T.bInfo[this.b].stopDist/.8/60)}분 · 배차 간격 2시간 가정`,'#ffd36a');
  const c=this.call;if(t>=22&&t<50){const st=S.t;lower(t,22.3,49.6,'DRT 호출 → 탑승 → 대합실',`${this.nm} · 호출 ${hhmm(c.t)}${st>=c.pick?` · 탑승 ${hhmm(c.pick)} (대기 ${Math.round(c.wait/60)}분)`:''}${st>=this.arr?` · 도착 ${hhmm(this.arr)}`:''} · 평균 대기 ${Math.round(this.avg/60)}분`,'#ff4fa3');
   const s=drtStats(M,st);kpis(t,23,49.6,[[`${Math.round(s.km)}km`,'누적 운행 거리'],[`${(s.wait/60).toFixed(1)}분`,'평균 호출 대기','#3ee6c1'],[hhmm(st),'시각']])}
  if(t>=56)this.chart(t);endCard(t,72,82.5,`평균 ${Math.round(this.cmp.old)}분 → ${Math.round(this.cmp.nw)}분`,`이동 시간 약 ${this.cmp.pct}% 단축 · 권역당 차량 2대(총 4대)로 5개 마을`);sub(t,this.lines);vignette()},
 chart(t){const al=alpha(t,56,72.2,.6);if(al<=0)return;const c=this.cmp,x0=1000,y0=280,W=840,rowH=118;g.save();g.globalAlpha=al;rr(x0-30,y0-70,W+60,c.rows.length*rowH+150,20);g.fillStyle='rgba(6,10,18,.84)';g.fill();
  txt('대합실까지 걸리는 시간 (분)',x0,y0-20,28,800);txt('기존 = 정류장 도보 + 평균 대기 60분(가정) + 버스 · DRT = 시뮬레이션 대기 + 탑승',x0,y0+12,16,500,'#9aabc4');const mx=Math.max(...c.rows.map(r=>r.old))*1.05;
  c.rows.forEach((r,i)=>{const y=y0+40+i*rowH,u=sm((t-57-i*.5)/1.6);txt(`${r.b} ${r.name}`,x0,y+24,22,700,'#e6edf7');const bw=W-150;g.fillStyle='rgba(255,211,106,.85)';g.fillRect(x0,y+36,bw*r.old/mx*u,26);g.fillStyle='#ff4fa3';g.fillRect(x0,y+68,bw*r.nw/mx*u,26);
   txt(`${Math.round(r.old*u)}분`,x0+bw*r.old/mx*u+10,y+57,20,800,'#ffd36a');txt(`${Math.round(r.nw*u)}분`,x0+bw*r.nw/mx*u+10,y+89,20,800,'#ff8ac4')});
  txt('■ 기존',x0,y0+40+c.rows.length*rowH+18,20,700,'#ffd36a');txt('■ DRT',x0+110,y0+40+c.rows.length*rowH+18,20,700,'#ff8ac4');g.restore()}};

/* ---------- FILM 2: 침수 센서 ---------- */
const F2={name:'침수 센서',file:'주천면_02_침수센서',dur:70,
 enter(){dayMode();S.flood.sc='heavy';setScene('flood',0);setRel(['T0'])},
 async setup(){S.flood.sc='heavy';FS=floodSeries('heavy');aff.clear();
  const Lat=t=>FS[clamp(Math.floor(t/600),0,FS.length-1)].L;this.Lat=Lat;this.depth=t=>Math.min(260,clamp((t-H(9))/H(5),0,1)*25+Lat(t+4200)/5.3*240);
  const cross=v=>{for(let s=H(8);s<H(24);s+=60)if(this.depth(s)>=v)return s;return H(20)};this.c60=cross(60);this.c100=cross(100);this.c150=cross(150);
  let tb=H(20);for(let s=H(8);s<H(24);s+=60){const th=thrOf(Lat(s));if(th<=5&&affected(th).n>0){tb=s;break}}this.tb=tb;
  let pk=0;FS.forEach((x,i)=>{if(x.L>FS[pk].L)pk=i});this.peak=pk*600;
  // sensors: centroids of deepest flood polygons nearest T0
  const cs=(T.flood['5']||[]).concat(T.flood['4']||[]).map(pl=>centroid(pl[0])).sort((a,b)=>mdist(a,T0P)-mdist(b,T0P));const pick=[];for(const c of cs){if(pick.every(q=>mdist(q,c)>250))pick.push(c);if(pick.length===3)break}
  const hs=await gh(pick);this.sens=pick.map((p,i)=>({id:`WL-0${i+1}`,p:[p[0],p[1],hs[i]]}));
  this.sens.forEach((s,i)=>{s.pole=viewer.entities.add({position:cart(s.p,s.p[2]+3),cylinder:{length:6,topRadius:.2,bottomRadius:.26,material:C.Color.fromCssColorString('#dfe5ee')}});
   s.box=viewer.entities.add({position:cart(s.p,s.p[2]+6.2),box:{dimensions:new C.Cartesian3(1,.6,.7),material:C.Color.fromCssColorString('#4db5ff')}});
   s.card=viewer.entities.add({position:cart(s.p,s.p[2]+16),billboard:{image:cardImg(s.id,[['수위','0cm']],'#4db5ff'),scale:.62,verticalOrigin:C.VerticalOrigin.BOTTOM,disableDepthTestDistance:Number.POSITIVE_INFINITY}});
   s.ring=viewer.entities.add({position:cart(s.p,s.p[2]+.5),billboard:{image:ringImg('#ffffff',7),width:60,height:60,disableDepthTestDistance:Number.POSITIVE_INFINITY}})});
  const T0p=[128.2715,37.2712];const s0=this.sens[0].p;
  this.keys=await prepKeys([{t:0,p:[128.268,37.268],head:200,pitch:-30,range:4200},{t:7,p:[128.270,37.269],head:215,pitch:-24,range:2400},{t:14,p:[s0[0],s0[1]],head:250,pitch:-18,range:700},{t:20.5,p:[s0[0],s0[1]],head:225,pitch:-15,range:330},
   {t:27,p:[s0[0],s0[1]],head:200,pitch:-14,range:290},{t:34,p:[s0[0],s0[1]],head:170,pitch:-16,range:420},{t:42,p:T0p,head:190,pitch:-16,range:700},{t:50,p:T0p,head:150,pitch:-20,range:900},{t:58,p:T0p,head:100,pitch:-26,range:1500},{t:70,p:T0p,head:60,pitch:-32,range:2600}]);
  const gold=Math.round((this.tb-this.c60)/60);this.gold=gold;
  this.lines=[[1,6.5,''],[7,13.2,'집중호우가 쏟아지는 날. 주천강 옆 저지대에 수위 센서 세 곳이 설치되어 있습니다.'],[13.5,20.3,'센서는 1분마다 물 높이를 재서 관제센터로 보냅니다.'],[21,27,'수위 60cm, 주의 단계. 관제센터에 경보가 뜹니다.'],
   [27.5,34,'100cm, 경계 단계. 주민에게 대피 문자와 마을 방송이 자동으로 나갑니다.'],[34.5,41,'150cm, 심각 단계. 강변 도로가 통제됩니다.'],[42,49.5,'물은 범람지도의 저지대부터 차오르고, 붉게 변한 건물이 잠기는 곳입니다.'],
   [50.5,58,`첫 경보부터 건물 침수까지 약 ${gold}분. 대피할 시간을 벌 수 있습니다.`],[59,68,'센서가 먼저 알면, 사람은 미리 움직일 수 있습니다.']]},
 simT(t){if(!this.mp)this.mp=mono([[0,H(9)],[7,H(10)],[20.5,this.c60-900],[21.5,this.c60],[28,this.c100],[35,this.c150],[43,this.tb],[58,this.peak],[70,this.peak+3600]]);return pw(this.mp,t)},
 lvl(d){return d>=150?['심각','#ff4d5e']:d>=100?['경계','#ff8a3d']:d>=60?['주의','#ffc145']:d>=30?['관심','#7fd3ff']:['정상','#3ee6c1']},
 update(t){S.t=this.simT(t);frame(true);keyCam(this.keys,t);const pu=(performance.now()%1300)/1300;
  this.sens.forEach((s,i)=>{const d=Math.round(this.depth(S.t-i*420));const [lv,col]=this.lvl(d);const key=d+lv;if(s.k!==key){s.k=key;s.card.billboard.image=cardImg(`${s.id} 수위 센서`,[['수위',d+'cm',col],['단계',lv,col]],col);s.box.box.material=C.Color.fromCssColorString(col)}
   s.ring.billboard.show=d>=60;s.ring.billboard.width=s.ring.billboard.height=40+pu*90;s.ring.billboard.color=C.Color.fromCssColorString(col).withAlpha(1-pu)})},
 overlay(t){brand('02','침수 센서');titleCard(t,0,6.6,'02','물이 차기 전에 먼저 알린다','하천 수위 센서 · 자동 경보');const x=FS[clamp(Math.floor(S.t/600),0,FS.length-1)];rain(t,x.rain);
  const d=Math.round(this.depth(S.t));const [lv,col]=this.lvl(d);const th=thrOf(this.Lat(S.t)),A=affected(th);
  if(t>7)kpis(t,7.2,66,[[`${A.n}동`,'잠긴 건물',A.n?'#ff6b7a':null],[`${d}cm`,`WL-01 수위 · ${lv}`,col],[`${Math.round(x.rain)}mm`,'시간당 강우','#7fd3ff'],[hhmm(S.t),'시각']]);
  alertCard(t,21.5,27.4,'warn','주의 · 60cm','WL-01 → 통합관제센터 경보');alertCard(t,28,34.4,'alert','경계 · 100cm','대피 문자 발송 · 마을 방송 자동 송출');alertCard(t,35,41.4,'alert','심각 · 150cm','강변 도로 통제 · 대피소 개방');
  lower(t,43,57.6,'첫 경보 → 건물 침수',`${hhmm(this.c60)} 주의 경보 → ${hhmm(this.tb)} 첫 건물 침수 · 대피 가능 시간 약 ${this.gold}분`,'#4db5ff');
  endCard(t,62,70.5,`대피 시간 약 ${this.gold}분 확보`,'수위 센서 3곳 · 관심 30 · 주의 60 · 경계 100 · 심각 150cm');sub(t,this.lines);vignette()}};

/* ---------- FILM 3: 가로등 · CCTV ---------- */
const F3={name:'가로등·CCTV',file:'주천면_03_가로등CCTV',dur:72,
 enter(){setScene('intro',0);S.scene='night';hallEnts.forEach(e=>e.show=false);for(const id in facEnts)facEnts[id].show=id==='T0';setRel(['T0']);nightMode(true)},
 async setup(){
  // lights along roads near T0
  const pts=[];T.roads.forEach(r=>{const c=densify(r.c,34);c.forEach((p,i)=>{if(mdist(p,T0P)<760&&i%1===0){const q=c[Math.min(c.length-1,i+1)],o=c[Math.max(0,i-1)];const h=headOf(o,q);const side=(i%2?1:-1)*6;pts.push({p:offLL(p[0],p[1],Math.cos(h)*side,-Math.sin(h)*side),w:r.w})}})});
  const L=[];pts.forEach(q=>{if(L.every(o=>mdist(o.p,q.p)>24))L.push(q)});const lights=L.slice(0,LITE?160:340);const hs=await gh(lights.map(l=>l.p));lights.forEach((l,i)=>l.g=hs[i]);this.lights=lights;
  const glow=glowImg(255,214,150,.18),pool=glowImg(255,190,110,.05);
  lights.forEach((l,i)=>{l.b=.35;l.ent=viewer.entities.add({position:cart(l.p,l.g+7),billboard:{image:glow,width:new C.CallbackProperty(()=>8+16*l.b,false),height:new C.CallbackProperty(()=>8+16*l.b,false),sizeInMeters:true,color:new C.CallbackProperty(()=>new C.Color(1,1,1,Math.min(1,l.b*1.1)),false),disableDepthTestDistance:1500},point:{pixelSize:new C.CallbackProperty(()=>2+4*l.b,false),color:new C.CallbackProperty(()=>new C.Color(1,.93,.78,Math.min(1,.4+l.b)),false),disableDepthTestDistance:1500}});
   l.pole=viewer.entities.add({position:cart(l.p,l.g+3.5),cylinder:{length:7,topRadius:.08,bottomRadius:.1,material:C.Color.fromCssColorString('#3a414c')}});
   if(i%2===0)l.pool=viewer.entities.add({position:C.Cartesian3.fromDegrees(l.p[0],l.p[1]),ellipse:{semiMajorAxis:15,semiMinorAxis:15,material:new C.ImageMaterialProperty({image:pool,transparent:true,color:new C.Color(1,1,1,.4)}),classificationType:C.ClassificationType.TERRAIN}})});
  // CCTV
  const cams=[];lights.filter(l=>l.w>=6).concat(lights).forEach(l=>{if(cams.length<8&&mdist(l.p,T0P)<620&&cams.every(c=>mdist(c.p,l.p)>200))cams.push({p:l.p,g:l.g})});this.cams=cams;
  const camIcon=document.createElement('canvas');camIcon.width=camIcon.height=64;{const x=camIcon.getContext('2d');x.fillStyle='#0b1220';x.beginPath();x.arc(32,32,26,0,7);x.fill();x.strokeStyle='#7fd3ff';x.lineWidth=4;x.stroke();x.fillStyle='#7fd3ff';x.fillRect(16,24,24,16);x.beginPath();x.moveTo(40,28);x.lineTo(50,22);x.lineTo(50,42);x.lineTo(40,36);x.fill()}
  cams.forEach((c,i)=>{c.id=`CAM-0${i+1}`;c.base=(i*73)%360;c.h=c.base;c.hot=0;c.icon=viewer.entities.add({position:cart(c.p,c.g+8.5),billboard:{image:camIcon,width:26,height:26,disableDepthTestDistance:Number.POSITIVE_INFINITY},label:{...LBL,heightReference:C.HeightReference.NONE,text:c.id,font:'700 12px "Noto Sans KR"',fillColor:C.Color.fromCssColorString('#a9e2ff'),pixelOffset:new C.Cartesian2(0,-20)}});
   c.cone=viewer.entities.add({polygon:{hierarchy:new C.CallbackProperty(()=>{const a=RAD(c.h),hw=RAD(26),R=78;const q=[c.p,offLL(c.p[0],c.p[1],Math.sin(a-hw)*R,Math.cos(a-hw)*R),offLL(c.p[0],c.p[1],Math.sin(a)*R*1.05,Math.cos(a)*R*1.05),offLL(c.p[0],c.p[1],Math.sin(a+hw)*R,Math.cos(a+hw)*R)];return new C.PolygonHierarchy(C.Cartesian3.fromDegreesArray(q.flat()))},false),height:c.g+1.2,material:new C.ColorMaterialProperty(new C.CallbackProperty(()=>c.hot?C.Color.fromCssColorString('#ff8a3d').withAlpha(.38):C.Color.fromCssColorString('#4db5ff').withAlpha(.22),false))}})});
  // pedestrian path: road nearest cam[1..]
  let bestR=null,bd=-1;T.roads.forEach(r=>{const L2=r.c.reduce((s,p,i)=>i?s+mdist(r.c[i-1],p):0,0);if(L2<350||L2>1600)return;const dd=densify(r.c,40);const n=dd.filter(p=>lights.some(l=>mdist(l.p,p)<30)).length/dd.length;const nc=cams.filter(c=>dd.some(p=>mdist(c.p,p)<90)).length;const sc=n+nc*.3;if(sc>bd){bd=sc;bestR=r}});
  const pr=bestR?await mkRoute(bestR.c,600,.5):subRoute(RT['B8-T0'],.7,1);this.pr=pr;
  const person=document.createElement('canvas');person.width=person.height=64;{const x=person.getContext('2d');x.fillStyle='#fff';x.beginPath();x.arc(32,13,9,0,7);x.fill();x.fillRect(24,24,16,24);x.fillRect(25,46,6,16);x.fillRect(33,46,6,16)}
  this.ped=viewer.entities.add({show:false,position:new C.CallbackProperty(()=>cart(this.pp||T0P,(this.pp&&this.pp[2])||0),false),billboard:{image:person,width:30,height:30,verticalOrigin:C.VerticalOrigin.BOTTOM,disableDepthTestDistance:Number.POSITIVE_INFINITY},label:{...LBL,heightReference:C.HeightReference.NONE,text:'배회 어르신 (가상)',font:'700 13px "Noto Sans KR"',fillColor:C.Color.fromCssColorString('#ffb070'),pixelOffset:new C.Cartesian2(0,-36)}});
  this.pedRing=viewer.entities.add({show:false,position:new C.CallbackProperty(()=>cart(this.pp||T0P,((this.pp&&this.pp[2])||0)+.5),false),billboard:{image:ringImg('#ff8a3d',7),width:50,height:50,disableDepthTestDistance:Number.POSITIVE_INFINITY}});
  // van passing (route into T0)
  const vr=RT['B8-T0'];this.vr=subRoute(vr,Math.max(0,1-420/vr.L),Math.max(.05,1-220/vr.L));this.van=viewer.entities.add({position:new C.CallbackProperty(()=>this.vp?C.Cartesian3.fromDegrees(this.vp[0],this.vp[1],0):cart(T0P,0),false),orientation:new C.CallbackProperty(()=>this.vo||C.Quaternion.IDENTITY,false),model:{uri:MODELS.south,minimumPixelSize:28,heightReference:C.HeightReference.CLAMP_TO_GROUND}});
  this.head=viewer.entities.add({position:new C.CallbackProperty(()=>this.vp?cart(offLL(this.vp[0],this.vp[1],Math.sin(this.vh||0)*14,Math.cos(this.vh||0)*14),this.vp[2]):cart(T0P,0),false),billboard:{image:glowImg(255,250,230,.2),width:4,height:4,sizeInMeters:true}});
  // faulty lamp
  this.p0=.3;this.p1=Math.min(.98,this.p0+95/pr.L);const pe=along(pr,Math.min(.99,this.p1+30/pr.L));this.fault=lights.reduce((a,l)=>mdist(l.p,pe)<mdist(a.p,pe)?l:a,lights[0]);
  this.faultMark=viewer.entities.add({show:false,position:cart(this.fault.p,this.fault.g+9),billboard:{image:ringImg('#ff4d5e',8),width:54,height:54,disableDepthTestDistance:Number.POSITIVE_INFINITY},label:{...LBL,heightReference:C.HeightReference.NONE,text:'가로등 고장 감지',fillColor:C.Color.fromCssColorString('#ff8a95'),pixelOffset:new C.Cartesian2(0,-30)}});
  const c1=cams[1]||cams[0];const mid=pr.c[Math.floor(pr.c.length*.35)];const f=this.fault.p;
  this.keys=await prepKeys([{t:0,p:T0P,head:200,pitch:-38,range:2600},{t:7,p:T0P,head:240,pitch:-30,range:1500},{t:8,p:[this.vr.c[0][0],this.vr.c[0][1]],head:DEG(headOf(this.vr.c[0],this.vr.c[Math.min(this.vr.c.length-1,8)])),pitch:-17,range:150}]);
  this.keys2=await prepKeys([{t:21,p:[mid[0],mid[1]],head:120,pitch:-28,range:520},{t:28,p:[mid[0],mid[1]],head:150,pitch:-22,range:300}]);
  this.keys3=await prepKeys([{t:44.5,p:[f[0],f[1]],head:60,pitch:-20,range:260},{t:52,p:[f[0],f[1]],head:20,pitch:-24,range:320},{t:53,p:T0P,head:200,pitch:-40,range:1900},{t:62,p:T0P,head:250,pitch:-40,range:2000},{t:72,p:T0P,head:300,pitch:-46,range:3200}]);
  const sav=Math.round((1-(.35*.9+1*.1))*100);this.sav=sav;
  this.lines=[[1,6.5,''],[7,14,`밤 9시 반, 주천리 시가지. 스마트 가로등 ${lights.length}개가 평소엔 35% 밝기로 어둡게 켜져 있습니다.`],[14.5,21,'차가 다가오면, 가는 길 앞쪽 가로등만 100%로 밝아지고 지나가면 다시 어두워집니다.'],
   [22,29,'밤 11시. CCTV가 혼자 걷는 어르신을 감지합니다.'],[29.5,36.5,'관제센터는 카메라를 이어 가며 동선을 따라가고, 보호자와 이장에게 위치를 보냅니다.'],[37,44,'가는 길의 가로등은 미리 밝아집니다.'],
   [45,52,'가로등 하나가 깜빡이다 꺼지면, 고장이 자동으로 접수되고 정비 요청이 나갑니다.'],[53,61,'모든 가로등과 CCTV는 T0 통합 관제 화면 하나에서 관리됩니다.'],[62,70.5,`필요할 때만 밝히니, 상시 점등보다 전기를 약 ${sav}% 덜 씁니다.`]]},
 update(t){S.t=t<21?H(21.5)+t*20:H(23.1)+(t-21)*20;frame(true);nightSky();
  // van
  const vu=clamp((t-7.5)/13,0,1);if(t<21){const a=along(this.vr,vu),q=along(this.vr,Math.min(1,vu+.035));this.vp=a;this.vh=headOf(a,q);this.vo=C.Transforms.headingPitchRollQuaternion(cart(a,a[2]),new C.HeadingPitchRoll(this.vh-Math.PI/2,0,0))}else this.vp=null;this.van.show=t<21;this.head.show=t>7&&t<21;
  // pedestrian
  const pu=this.p0+clamp((t-21.5)/22.5,0,1)*(this.p1-this.p0);this.pp=t>21?along(this.pr,pu):null;this.ped.show=t>21&&t<45;this.pedRing.show=t>23&&t<45;
  const agents=[];if(this.vp&&t>7)agents.push({p:this.vp,h:this.vh,ahead:85,back:12});if(this.pp){const q=along(this.pr,Math.min(1,pu+.02));agents.push({p:this.pp,h:headOf(this.pp,q),ahead:t>37?75:40,back:8})}
  const fault=this.fault;this.lights.forEach(l=>{let tgt=.18;for(const A of agents){const k=Math.cos(A.p[1]*Math.PI/180),dx=(l.p[0]-A.p[0])*111320*k,dy=(l.p[1]-A.p[1])*110540;const fw=dx*Math.sin(A.h)+dy*Math.cos(A.h),lat=Math.abs(dx*Math.cos(A.h)-dy*Math.sin(A.h));if(lat<22&&fw>-A.back&&fw<A.ahead){const e=fw<0?1+fw/A.back*.5:1-Math.max(0,fw-A.ahead*.7)/(A.ahead*.3)*.6;tgt=Math.max(tgt,clamp(e,.18,1))}}if(t<2)tgt*=sm(t/2);if(l===fault&&t>44.5){tgt=t<47?(Math.sin(t*40)>0?.9:.05):0}l.b+=(tgt-l.b)*.12});
  this.faultMark.show=t>47&&t<53;
  this.cams.forEach(c=>{c.hot=0;if(this.pp&&mdist(c.p,this.pp)<95&&t>22){c.hot=1;const hh=DEG(headOf(c.p,this.pp));c.h=c.h+((((hh-c.h)%360)+540)%360-180)*.15}else c.h=c.base+Math.sin(t*.6+c.base)*35});
  if(t<8)keyCam(this.keys,t);else if(t<21){if(this.vp)followCam({p:this.vp,head:this.vh},-17,150,0,.03,.12)}else if(t<28)keyCam(this.keys2,t);else if(t<44.5){if(this.pp){const q=along(this.pr,Math.min(1,pu+.01));followCam({p:this.pp,head:headOf(this.pp,q)},-24,170,25,.04)}}else keyCam(this.keys3,t)},
 overlay(t){brand('03','스마트 가로등 · CCTV');titleCard(t,0,6.6,'03','밤길을 한곳에서 지킨다','스마트 가로등 · CCTV 통합 관제');
  lower(t,8,20.6,'적응형 디밍',`평소 35% → 사람·차 접근 시 100% · 가로등 ${this.lights.length}개`,'#ffd36a');
  const hot=this.cams.filter(c=>c.hot).map(c=>c.id);alertCard(t,22.5,44,'warn','배회 감지',`${hot[0]||'CAM'} 추적 중 · 보호자·이장에게 위치 전송`);
  alertCard(t,47,52.6,'alert','가로등 고장 감지','자동 정비 요청 접수 · 관할: 주천면 시설팀');
  if(t>=53)this.room(t);endCard(t,63,72.5,`전력 약 ${this.sav}% 절감`,'디밍 35% · 접근 시 100% · CCTV 8대 · 고장 자동 감지 (밤 시간 90% 디밍 가정)');sub(t,this.lines);vignette()},
 room(t){const al=alpha(t,53,62.6,.6);if(al<=0)return;const x0=990,y0=18,W=900,H2=540;g.save();g.globalAlpha=al;rr(x0,y0,W,H2,20);g.fillStyle='rgba(5,9,16,.9)';g.fill();txt('T0 통합 관제센터',x0+30,y0+52,32,900);txt(`${hhmm(S.t)} · 실시간`,x0+W-30,y0+52,20,600,'#ff6b7a','right');
  const cw=(W-80)/3,ch=cw*9/16;for(let i=0;i<6;i++){const x=x0+30+(i%3)*(cw+10),y=y0+80+Math.floor(i/3)*(ch+40);const sx=(i*311)%(FW-640),sy=200+((i*173)%(FH-600));g.drawImage(viewer.scene.canvas,sx,sy,640,360,x,y,cw,ch);g.fillStyle='rgba(0,40,20,.25)';g.fillRect(x,y,cw,ch);
   txt(`CAM-0${i+1}`,x+10,y+24,16,800,'#9fffc9');txt('● REC',x+cw-10,y+24,14,800,'#ff4d5e','right');txt(i===1?'배회 추적':'정상',x,y+ch+24,16,700,i===1?'#ffb070':'#9aabc4')}
  const y=y0+80+2*(ch+40)+10;txt(`가로등 ${this.lights.length}개 · 정상 ${this.lights.length-1} · 고장 1`,x0+30,y+10,22,700,'#ffd36a');txt(`CCTV 8대 정상 · 알림 2건 처리`,x0+30,y+44,22,700,'#7fd3ff');
  const gx=x0+520,gy=y-20,gw=320,gh2=80;g.strokeStyle='#3a4558';g.strokeRect(gx,gy,gw,gh2);g.beginPath();for(let i=0;i<=40;i++){const v=i<4?1:(.35+.65*(Math.sin(i*1.7)>.85?1:0));g.lineTo(gx+i/40*gw,gy+gh2-v*gh2*.9)}g.strokeStyle='#ffd36a';g.lineWidth=2;g.stroke();txt('전력 사용 (상시 점등 = 100%)',gx,gy+gh2+22,14,500,'#9aabc4');g.restore()}};

/* ---------- FILM 4: 스마트팜 ---------- */
const F4={name:'스마트팜',file:'주천면_04_스마트팜',dur:70,
 enter(){dayMode();setScene('farm',0);setRel(['S1','S2','D1','D2','T0'])},
 async setup(){const s1=P.S1,s2=P.S2;const ha=T.farmSites.reduce((s,f)=>s+f.ha,0);this.ha=Math.round(ha);this.irrS2=IRR.S2[0]||[H(10),H(11)];this.irrS1=IRR.S1.find(([x])=>x>Math.max(heatT,(this.irrS2[0]||0))+900)||IRR.S1[IRR.S1.length-1]||[H(15),H(16)];
  this.keysA=await prepKeys([{t:0,p:[128.258,37.248],head:-15,pitch:-36,range:10000},{t:7,p:[128.255,37.250],head:5,pitch:-34,range:7000},{t:8,p:[s2.lon,s2.lat],head:30,pitch:-26,range:520},{t:21,p:[s2.lon,s2.lat],head:110,pitch:-20,range:300},
   {t:22,p:[s2.lon,s2.lat],head:150,pitch:-19,range:220},{t:35.5,p:[s2.lon,s2.lat],head:210,pitch:-18,range:180}]);
  const mid=[(s2.lon+T0P[0])/2,(s2.lat+T0P[1])/2];
  this.keysB=await prepKeys([{t:36,p:[s2.lon,s2.lat],up:150,head:DEG(headOf([s2.lon,s2.lat],T0P)),pitch:-20,range:600},{t:43,p:mid,up:300,head:DEG(headOf([s2.lon,s2.lat],T0P))+20,pitch:-26,range:2200},
   {t:44,p:[s1.lon,s1.lat],head:300,pitch:-24,range:460},{t:51.5,p:[s1.lon,s1.lat],head:345,pitch:-22,range:330},{t:59.5,p:[s1.lon,s1.lat],head:30,pitch:-20,range:230},
   {t:60,p:[128.258,37.246],head:0,pitch:-38,range:8000},{t:70,p:[128.258,37.246],head:30,pitch:-42,range:10000}]);
  const n=IRR.S1.length+IRR.S2.length,water=(IRR.S1.concat(IRR.S2)).reduce((s,[x,y])=>s+(y-x),0)/3600*14;this.n=n;this.water=water;
  this.lines=[[1,6.5,''],[7,14,`주천면에는 스마트팜 단지 일곱 곳, 모두 ${this.ha}ha 규모의 밭이 있습니다.`],[14.5,21,'대표 밭마다 토양수분·지온·기온 센서가 10분마다 값을 보냅니다.'],
   [22,29,`오전 ${Math.floor(this.irrS2[0]/3600)}시, 신일리 밭의 토양수분이 20% 아래로 떨어지자,`],[29.5,35.5,'밸브가 자동으로 열리고 관수가 시작됩니다.'],[36,43.5,'센서 데이터는 T0 통합 플랫폼에 모여, 마을 전체 밭 상태를 한눈에 보여 줍니다.'],
   [44,51,'한낮 기온이 33도를 넘으면, 밭일 자제 알림이 마을 방송으로 나갑니다.'],[52,59,'용석리 밭도 같은 방식으로, 필요할 때만 물을 줍니다.'],[60,68.5,`하루 자동 관수 ${n}회, 물 약 ${water.toFixed(0)}톤. 사람 손 없이 밭이 스스로 관리됩니다.`]]},
 simT(t){const a=this.irrS2[0],b=this.irrS1[0];if(!this.mp)this.mp=mono([[0,H(5)],[7,H(6)],[21,a-1800],[23,a-300],[29,a+60],[35.5,a+2400],[43.5,a+3600],[44,Math.max(heatT,a+3700)-600],[51,Math.max(heatT,a+3700)+600],[52,b-300],[59.5,b+2400],[60,H(18)],[70,H(19.5)]]);return pw(this.mp,t)},
 update(t){S.t=this.simT(t);frame(true);if(t<36)keyCam(this.keysA,t);else keyCam(this.keysB,t)},
 overlay(t){brand('04','스마트팜');titleCard(t,0,6.6,'04','밭이 마르기 전에 물을 준다','토양 센서 · 자동 관수 · 통합 플랫폼');const a=fmAt('S2',S.t),b=fmAt('S1',S.t);
  if(t>7&&t<60)kpis(t,7.5,59.5,[[`${b.m.toFixed(1)}%`,'S1 용석리 토양수분',b.m<20.5?'#ffc145':'#7fd3ff'],[`${a.m.toFixed(1)}%`,'S2 신일리 토양수분',a.m<20.5?'#ffc145':'#7fd3ff'],[`${b.ta}°C`,'기온',b.ta>=33?'#ff6b7a':null],[hhmm(S.t),'시각']]);
  alertCard(t,23,35,'info','S2 자동 관수 시작','토양수분 20% 미만 → 밸브 열림 · 60분');alertCard(t,44.5,51,'warn','폭염 주의','기온 33°C 이상 → 마을 방송 "한낮 밭일 자제"');alertCard(t,52.5,59.5,'info','S1 자동 관수 시작','용석리 밭 · 토양수분 20% 미만');
  if(t>=36&&t<44)this.dash(t);endCard(t,61,70.5,`하루 자동 관수 ${this.n}회 · 물 약 ${this.water.toFixed(0)}톤`,`스마트팜 단지 7곳 · ${this.ha}ha · 센서 10분 간격 (8월 맑은 날 시나리오)`);sub(t,this.lines);vignette()},
 dash(t){const al=alpha(t,36,43.8,.5);const x0=1060,y0=200,W=800,H2=420;g.save();g.globalAlpha=al;rr(x0,y0,W,H2,20);g.fillStyle='rgba(5,9,16,.88)';g.fill();txt('T0 통합 플랫폼 · 농업 센서',x0+30,y0+50,28,900);
  const X=s=>x0+60+s/H(24)*(W-100),Y=v=>y0+H2-50-(v-14)/20*(H2-130);g.strokeStyle='#ffc145';g.setLineDash([6,6]);g.beginPath();g.moveTo(X(0),Y(20));g.lineTo(X(H(24)),Y(20));g.stroke();g.setLineDash([]);
  [['S1','#e0a83a'],['S2','#3ee6c1']].forEach(([id,c])=>{g.beginPath();FM[id].forEach((x,i)=>{if(i*600>S.t)return;i?g.lineTo(X(i*600),Y(x.m)):g.moveTo(X(i*600),Y(x.m))});g.strokeStyle=c;g.lineWidth=3;g.stroke()});
  txt('S1 용석리',x0+60,y0+90,18,700,'#e0a83a');txt('S2 신일리',x0+180,y0+90,18,700,'#3ee6c1');txt('관수 기준 20%',X(H(24)),Y(20)-8,15,600,'#ffc145','right');[0,6,12,18,24].forEach(h=>txt(h+'시',X(H(h)),y0+H2-20,15,500,'#9aabc4','center'));g.restore()}};

/* ---------- runner ---------- */
const FILMS=[F1,F2,F3,F4];
const FR={cur:null,t0:0,rec:null,chunks:[],status:'준비',done:[],t:0};
function cleanupScene(){camera.lookAtTransform(C.Matrix4.IDENTITY)}
const realNow=performance.now.bind(performance);let VT=null;performance.now=()=>VT!=null?VT:realNow();const JD0=C.JulianDate.now();
scene.preRender.addEventListener(()=>{if(VT!=null)REALJD=C.JulianDate.addSeconds(JD0,VT/1000,new C.JulianDate());if(!FR.cur)return;FR.t=FR.fixed!=null?FR.fixed:(performance.now()-FR.t0)/1000;if(FR.offline&&FR.lastU===FR.t)return;FR.lastU=FR.t;try{FR.cur.update(Math.min(FR.t,FR.cur.dur));occlude()}catch(e){console.warn('film update',e)}});
scene.postRender.addEventListener(()=>{if(!FR.cur)return;g.drawImage(scene.canvas,0,0,FW,FH);try{FR.cur.overlay(Math.min(FR.t,FR.cur.dur))}catch(e){console.warn('film overlay',e)}
 if(FR.t>=FR.cur.dur+.4){const f=FR.cur;FR.cur=null;if(FR.rec&&FR.rec.state==='recording')FR.rec.stop();else{FR.status=`${f.name} 미리보기 끝`;FR.resolve&&FR.resolve()}}});
async function waitTiles(ms=20000){const t0=performance.now();while(performance.now()-t0<ms){if(globe.tilesLoaded)return true;await new Promise(r=>setTimeout(r,300))}return false}
async function prepFilm(f){FILMS.forEach(o=>{if(o!==f&&o.ents)o.ents.forEach(e=>e.show=false)});f.enter();if(!f.ready){const before=new Set(viewer.entities.values);await f.setup();f.ready=true;f.ents=viewer.entities.values.filter(e=>!before.has(e))}else f.ents.forEach(e=>e.show=true);f.mp=null}
async function play(i,record){const f=FILMS[i];FR.status=`${f.name} 준비 중`;await prepFilm(f);
 FR.fixed=null;FOL.h=null;f.update(0);await waitTiles(15000);await document.fonts.load(`900 40px ${FONT}`);
 return new Promise(res=>{FR.resolve=res;if(record){const mime=MediaRecorder.isTypeSupported('video/mp4;codecs=avc1.640028')?'video/mp4;codecs=avc1.640028':'video/webm;codecs=vp9';const stream=comp.captureStream(FPS);FR.chunks=[];
   FR.rec=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:18e6});FR.rec.ondataavailable=e=>{if(e.data.size)FR.chunks.push(e.data)};
   FR.rec.onstop=()=>{const blob=new Blob(FR.chunks,{type:mime.split(';')[0]});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=f.file+(mime.includes('mp4')?'.mp4':'.webm');document.body.appendChild(a);a.click();FR.done.push({file:a.download,size:blob.size});FR.status=`${f.name} 저장: ${a.download} (${(blob.size/1e6).toFixed(1)}MB)`;res()};FR.rec.start(1000)}
  FR.status=`${f.name} ${record?'녹화':'재생'} 중`;FR.t0=performance.now();FR.cur=f})}
const tick=()=>new Promise(r=>{const ch=new MessageChannel();ch.port1.onmessage=()=>r();ch.port2.postMessage(0)});
const sleepReal=async ms=>{const t=realNow();while(realNow()-t<ms)await tick()};
async function pickCodec(){for(const c of['avc1.640028','avc1.4d0028','avc1.42e028']){try{const r=await VideoEncoder.isConfigSupported({codec:c,width:FW,height:FH,bitrate:14e6,framerate:FPS});if(r.supported)return c}catch(e){}}return null}
async function renderFilm(i,o={}){const f=FILMS[i];const wait=o.wait??6;FR.status=`${f.name} 준비 중`;await prepFilm(f);fixRes();await document.fonts.load(`900 40px ${FONT}`);await document.fonts.load(`700 38px ${FONT}`);
 const codec=await pickCodec();if(!codec){FR.status='이 브라우저는 H.264 인코딩을 지원하지 않음';return}
 const N=Math.round((o.dur??f.dur)*FPS);const muxer=new Mp4Muxer.Muxer({target:new Mp4Muxer.ArrayBufferTarget(),video:{codec:'avc',width:FW,height:FH,frameRate:FPS},fastStart:'in-memory'});
 let err=null;const enc=new VideoEncoder({output:(c,m)=>muxer.addVideoChunk(c,m),error:e=>{err=e;console.error(e)}});enc.configure({codec,width:FW,height:FH,bitrate:o.bitrate??14e6,framerate:FPS});
 viewer.useDefaultRenderLoop=false;FR.offline=true;FOL.h=null;const base=realNow();const t0=realNow();
 try{for(let fr=0;fr<N;fr++){if(FR.abort)break;VT=base+fr*1000/FPS;FR.fixed=fr/FPS;FR.cur=f;FR.lastU=null;viewer.render();
   if(fr===0){let w=0;while(!globe.tilesLoaded&&w<300){await sleepReal(50);viewer.render();w++}}else{let k=0;while(!globe.tilesLoaded&&k<wait){await sleepReal(35);viewer.render();k++}}
   const vf=new VideoFrame(comp,{timestamp:Math.round(fr*1e6/FPS),duration:Math.round(1e6/FPS)});enc.encode(vf,{keyFrame:fr%(FPS*2)===0});vf.close();
   while(enc.encodeQueueSize>4)await tick();if(err)throw err;
   if(fr%15===0){const el=(realNow()-t0)/1000;FR.status=`${f.name} 렌더 ${fr+1}/${N} · 남은 시간 약 ${Math.round(el/(fr+1)*(N-fr-1)/60)}분`;await tick()}}
  await enc.flush();muxer.finalize();const blob=new Blob([muxer.target.buffer],{type:'video/mp4'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=f.file+'.mp4';document.body.appendChild(a);a.click();
  FR.done.push({file:a.download,size:blob.size,sec:N/FPS,took:Math.round((realNow()-t0)/1000)});FR.status=`${f.name} 저장: ${a.download} (${(blob.size/1e6).toFixed(1)}MB)`;FR.lastBlob=blob}
 catch(e){FR.status='오류: '+e.message;console.error(e)}
 finally{VT=null;FR.cur=null;FR.fixed=null;FR.offline=false;viewer.useDefaultRenderLoop=true;camera.lookAtTransform(C.Matrix4.IDENTITY)}}
async function renderOne(o={}){const order=o.order||[0,1,2,3];const codec=await pickCodec();if(!codec){FR.status='H.264 인코딩 미지원';return}
 const muxer=new Mp4Muxer.Muxer({target:new Mp4Muxer.ArrayBufferTarget(),video:{codec:'avc',width:FW,height:FH,frameRate:FPS},fastStart:'in-memory'});let err=null;
 const enc=new VideoEncoder({output:(c,m)=>muxer.addVideoChunk(c,m),error:e=>{err=e;console.error(e)}});enc.configure({codec,width:FW,height:FH,bitrate:o.bitrate??9e6,framerate:FPS});
 const total=order.reduce((s,i)=>s+Math.round(FILMS[i].dur*FPS),0);let gf=0;const t0=realNow();const wait=o.wait??6;
 try{for(const i of order){const f=FILMS[i];await prepFilm(f);fixRes();await document.fonts.load(`900 40px ${FONT}`);await document.fonts.load(`700 38px ${FONT}`);
   const N=Math.round(f.dur*FPS);viewer.useDefaultRenderLoop=false;FR.offline=true;FOL.h=null;const base=realNow();
   for(let fr=0;fr<N;fr++,gf++){if(FR.abort)throw new Error('중단');VT=base+fr*1000/FPS;FR.fixed=fr/FPS;FR.cur=f;FR.lastU=null;viewer.render();
    if(fr===0){let w=0;while(!globe.tilesLoaded&&w<300){await sleepReal(50);viewer.render();w++}}else{let k=0;while(!globe.tilesLoaded&&k<wait){await sleepReal(35);viewer.render();k++}}
    const fade=Math.max(0,1-fr/(FPS*.4),(fr-(N-FPS*.5))/(FPS*.5));if(fade>0&&gf>0){g.fillStyle=`rgba(0,0,0,${Math.min(1,fade)})`;g.fillRect(0,0,FW,FH)}
    const vf=new VideoFrame(comp,{timestamp:Math.round(gf*1e6/FPS),duration:Math.round(1e6/FPS)});enc.encode(vf,{keyFrame:gf%(FPS*2)===0});vf.close();
    while(enc.encodeQueueSize>4)await tick();if(err)throw err;
    if(gf%15===0){const el=(realNow()-t0)/1000;FR.status=`통합본 렌더 ${gf+1}/${total} (${f.name}) · 남은 시간 약 ${Math.round(el/(gf+1)*(total-gf-1)/60)}분`;await tick()}}
   FR.cur=null;camera.lookAtTransform(C.Matrix4.IDENTITY)}
  await enc.flush();muxer.finalize();const blob=new Blob([muxer.target.buffer],{type:'video/mp4'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=(o.name||'주천면_스마트시티_시뮬레이션_통합본')+'.mp4';document.body.appendChild(a);a.click();
  FR.done.push({file:a.download,size:blob.size,sec:total/FPS,took:Math.round((realNow()-t0)/1000)});FR.status=`통합본 저장: ${a.download} (${(blob.size/1e6).toFixed(0)}MB)`;FR.lastBlob=blob}
 catch(e){FR.status='오류: '+e.message;console.error(e)}
 finally{VT=null;FR.cur=null;FR.fixed=null;FR.offline=false;viewer.useDefaultRenderLoop=true;camera.lookAtTransform(C.Matrix4.IDENTITY)}}
async function renderAll(o={}){FR.abort=false;for(let i=0;i<FILMS.length;i++){await renderFilm(i,o);if(FR.abort)break}FR.status='4편 모두 렌더 완료'}
async function playAll(record,warm=true){for(let i=0;i<FILMS.length;i++){if(warm)await play(i,false);await play(i,record);cleanupScene()}FR.status='모두 끝'}
ui.innerHTML=`<b>영상 제작 모드 · 1920×1080</b><div class="row">${FILMS.map((f,i)=>`<button data-p="${i}">▶ ${i+1} ${f.name}</button>`).join('')}</div><div class="row">${FILMS.map((f,i)=>`<button data-r="${i}">● 녹화 ${i+1}</button>`).join('')}<button data-all>● 4편 모두 녹화(실시간)</button><button data-off>◆ 4편 고화질 렌더</button><button data-one>◆ 통합본 1편 렌더</button></div><div id="fst">준비</div>`;
ui.onclick=e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.p)play(+b.dataset.p,false);else if(b.dataset.r)(async()=>{await play(+b.dataset.r,false);await play(+b.dataset.r,true)})();else if(b.hasAttribute('data-all'))playAll(true);else if(b.hasAttribute('data-off'))renderAll();else if(b.hasAttribute('data-one'))renderOne()};
setInterval(()=>{const s=$('#fst');if(s)s.textContent=FR.status+(FR.cur?` · ${FR.t.toFixed(1)}s / ${FR.cur.dur}s`:'')},250);
addEventListener('resize',()=>setTimeout(fixRes,50));
window.__film={FILMS,play,playAll,renderFilm,renderAll,renderOne,FR,comp,seek:async(i,t)=>{const f=FILMS[i];if(FR.cur!==f)await prepFilm(f);FR.fixed=t;FR.cur=f;FOL.h=null},script:()=>FILMS.map(f=>({file:f.file,name:f.name,dur:f.dur,lines:(f.lines||[]).filter(l=>l[2])}))};
}

/* start */
progress(.9,'장면 준비 중…');
camera.setView({destination:C.Cartesian3.fromDegrees(T.center[0],T.center[1]-.6,90000),orientation:{heading:0,pitch:C.Math.toRadians(-45),roll:0}});
setScene('intro',0.1);
let ready=false;const done=()=>{if(ready)return;ready=true;progress(1);$('#load').style.opacity=0;setTimeout(()=>$('#load').style.display='none',900);setScene('intro',5)};
const chk=setInterval(()=>{if(globe.tilesLoaded&&wallPrim.ready){clearInterval(chk);done()}},400);setTimeout(done,25000);
window.__cz={viewer,S,setScene,frame,B,wallPrim,colorBuildings,bState,EM,ET,DIR,SHOTS,flyShot:s=>{DIR.idx=-1;startShot(s);const go=()=>{trackStep(.016);if(DIR.track)requestAnimationFrame(go)};go()},get M(){return M}};
})().catch(e=>{console.error(e);const m=document.getElementById('loadmsg');if(m)m.textContent='오류: '+e.message});
