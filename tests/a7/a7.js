const {chromium,devices}=require('playwright');
const URL_='http://localhost:8765/crazygames-preview-v2/';
const R=[];const rec=(area,name,ok,detail='')=>R.push({area,name,ok,detail});
const ALLERR=[],ALLEXT=[];
async function ctx(b,opt){const c=await b.newContext(opt);c.on('request',r=>{const u=r.url();if(!u.startsWith('http://localhost:8765')&&!/^(data|blob):/.test(u))ALLEXT.push(u)});return c;}
function watch(p){p.on('pageerror',e=>ALLERR.push(e.message));p.on('console',m=>{if(m.type()==='error')ALLERR.push('console: '+m.text())});}
const st=p=>p.evaluate(()=>__cliff().state);
async function waitEnd(p){for(let i=0;i<400;i++){const s=await st(p);if(s==='stopped'||s==='fell')return s;await p.waitForTimeout(25);}return await st(p);}
(async()=>{const b=await chromium.launch();
// ---- Loading & performance
{const c=await ctx(b,{...devices['Pixel 7']});const p=await c.newPage();watch(p);let bytes=0,reqs=0;
 p.on('response',async r=>{reqs++;try{bytes+=(await r.body()).length}catch(e){}});
 const t0=Date.now();await p.goto(URL_);await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));const t1=Date.now();
 rec('Loading','requests / bytes on load',reqs===1,`${reqs} request, ${(bytes/1024).toFixed(0)} KB`);
 rec('Loading','time to first drawn frame (local server)',t1-t0<1500,`${t1-t0} ms`);
 await c.close();}
// ---- Mouse (desktop)
{const c=await ctx(b,{viewport:{width:1280,height:800}});const p=await c.newPage();watch(p);
 await p.addInitScript(()=>localStorage.setItem('cg2_cliff_rounds','10'));await p.goto(URL_);await p.waitForTimeout(300);
 const box=await p.locator('canvas').boundingBox();
 await p.mouse.move(box.x+box.width/2,box.y+box.height*0.6);await p.mouse.down();await p.waitForTimeout(500);const h=await st(p);await p.mouse.up();await p.waitForTimeout(80);const sl=await st(p);
 rec('Mouse','press = drive, release = brake',h==='holding'&&sl==='sliding',`${h} -> ${sl}`);
 const end=await waitEnd(p);await p.waitForTimeout(350);const tEnd=Date.now();await p.mouse.click(box.x+box.width/2,box.y+box.height*0.6);await p.waitForTimeout(50);
 rec('Retry loop','click after a round starts the next one',await st(p)==='ready',`round ended ${end}; next round ready within ~0.35 s`);
 // mute by click, persists after reload
 const sc=box.width/540;await p.mouse.click(box.x+(540-44)*sc,box.y+50*sc);await p.waitForTimeout(100);
 const m1=await p.evaluate(()=>localStorage.getItem('cg2_cliff_muted'));await p.reload();await p.waitForTimeout(300);const m2=await p.evaluate(()=>localStorage.getItem('cg2_cliff_muted'));
 rec('Sound','mute button toggles and is remembered after reload',m1==='1'&&m2==='1',`saved ${m1}, after reload ${m2}`);
 await p.mouse.click(box.x+(540-44)*sc,box.y+50*sc);
 await c.close();}
// ---- Touch (phone, real touch events)
{const c=await ctx(b,{...devices['Pixel 7']});const p=await c.newPage();watch(p);await p.goto(URL_);await p.waitForTimeout(300);
 const cdp=await c.newCDPSession(p);const box=await p.locator('canvas').boundingBox();const pt={x:box.x+box.width/2,y:box.y+box.height*0.6};
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[pt]});await p.waitForTimeout(600);const h=await st(p);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(150);const s2=await st(p);
 rec('Touch','touch and hold = drive, lift = brake',h==='holding'&&(s2==='sliding'||s2==='stopped'||s2==='falling'),`${h} -> ${s2}`);
 const sy=await p.evaluate(()=>window.scrollY);rec('Touch','page does not scroll or zoom during play',sy===0,`scrollY ${sy}`);
 await c.close();}
// ---- Sound output (game audio actually produced)
{const c=await ctx(b,{...devices['Pixel 7']});const p=await c.newPage();watch(p);
 await p.addInitScript(()=>{window.__peak=0;const o=AudioNode.prototype.connect;AudioNode.prototype.connect=function(d,...r){if(d instanceof AudioDestinationNode&&!this.__t){this.__t=1;const an=this.context.createAnalyser();o.call(this,an);const buf=new Float32Array(2048);setInterval(()=>{an.getFloatTimeDomainData(buf);for(const v of buf)window.__peak=Math.max(window.__peak,Math.abs(v))},20)}return o.call(this,d,...r)}});
 await p.goto(URL_);await p.waitForTimeout(300);const box=await p.locator('canvas').boundingBox();
 await p.mouse.move(box.x+box.width/2,box.y+box.height*0.6);await p.mouse.down();await p.waitForTimeout(800);
 const eng=await p.evaluate(()=>{const v=__peak;__peak=0;return v});await p.waitForTimeout(3000);await p.mouse.up();await waitEnd(p);await p.waitForTimeout(500);
 const fx=await p.evaluate(()=>__peak);
 rec('Sound','engine / fall / splash sounds produce audio',eng>0.05&&fx>0.05,`engine peak ${eng.toFixed(2)}, round sounds peak ${fx.toFixed(2)}`);
 await c.close();}
// ---- Screen sizes & orientations
for(const [name,opt] of [['desktop 1280x800',{viewport:{width:1280,height:800}}],['desktop 1920x1080',{viewport:{width:1920,height:1080}}],['tablet landscape',devices['iPad Pro 11 landscape']],['tablet portrait',devices['iPad Pro 11']],['phone small',devices['iPhone SE']],['phone tall',devices['Pixel 7']],['phone landscape',devices['Pixel 7 landscape']]]){
 const c=await ctx(b,opt);const p=await c.newPage();watch(p);await p.goto(URL_);await p.waitForTimeout(300);
 const m=await p.evaluate(()=>{const r=document.querySelector('canvas').getBoundingClientRect();return {w:Math.round(r.width),h:Math.round(r.height),fits:r.right<=innerWidth+1&&r.bottom<=innerHeight+1&&r.left>=-1&&r.top>=-1,scroll:document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight}});
 rec('Screens',name,m.fits&&!m.scroll&&Math.abs(m.w/m.h-0.5625)<0.01,`game ${m.w}x${m.h}, fully visible, no scrollbars`);await c.close();}
// ---- iframe variants
for(const [name,attrs] of [['iframe (normal)','allow="autoplay; fullscreen"'],['iframe sandbox scripts+same-origin','sandbox="allow-scripts allow-same-origin" allow="autoplay"'],['iframe sandbox scripts only (storage blocked)','sandbox="allow-scripts" allow="autoplay"']]){
 const c=await ctx(b,{viewport:{width:1280,height:800}});const p=await c.newPage();watch(p);
 await p.setContent(`<html><body style="margin:0;background:#000"><iframe ${attrs} src="${URL_}" style="border:0;width:100vw;height:100vh"></iframe></body></html>`);await p.waitForTimeout(900);
 const fr=p.frames().find(f=>f.url().includes('crazygames-preview'));
 let ok=false,detail='';
 try{const s0=await fr.evaluate(()=>__cliff().state);
   await p.mouse.click(640,300);await p.waitForTimeout(150);                 // first click focuses the game
   for(let i=0;i<200;i++){const s=await fr.evaluate(()=>__cliff().state);if(s==='stopped'||s==='fell'||s==='ready')break;await p.waitForTimeout(25);}
   await p.waitForTimeout(400);await p.keyboard.press('Space');await p.waitForTimeout(150);
   await p.keyboard.down('Space');await p.waitForTimeout(300);const hk=await fr.evaluate(()=>__cliff().state);await p.keyboard.up('Space');
   ok=s0==='ready'&&hk==='holding';detail=`loads (${s0}), Space works after one click (${hk})`;}catch(e){detail='error: '+e.message.slice(0,80);}
 rec('iframe',name,ok,detail);await c.close();}
console.log(JSON.stringify({R,ALLERR,ALLEXT}));await b.close();})();
