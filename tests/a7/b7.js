const {chromium,devices}=require('playwright');
const SP='/tmp/claude-0/-home-user/6aedb57c-d660-571b-9cb8-05ccda97d7f6/scratchpad/';
(async()=>{const b=await chromium.launch();const c=await b.newContext({...devices['Pixel 7'],deviceScaleFactor:1});const p=await c.newPage();
const errs=[];p.on('pageerror',e=>errs.push(e.message+' | '+(e.stack||'').split('\n').slice(0,3).join(' / ')));
await p.addInitScript(()=>{localStorage.setItem('cg2_cliff_rounds','30');
  // count canvas save/restore balance per frame
  const P=CanvasRenderingContext2D.prototype;const s0=P.save,r0=P.restore;window.__depth=0;window.__maxDepth=0;
  P.save=function(){__depth++;if(__depth>__maxDepth)__maxDepth=__depth;return s0.call(this)};P.restore=function(){__depth--;return r0.call(this)};});
await p.goto('http://localhost:8765/crazygames-preview-v2/');await p.waitForTimeout(300);
const box=await p.locator('canvas').boundingBox();const sc=box.width/540;
for(let k=0;k<4;k++){
  // drive off the cliff
  await p.mouse.move(box.x+270*sc,box.y+500*sc);await p.mouse.down();await p.waitForTimeout(4500);await p.mouse.up();
  for(let i=0;i<300;i++){if(await p.evaluate(()=>__cliff().state==='falling'))break;await p.waitForTimeout(10);}
  await p.waitForTimeout(400);           // tap DURING the fall
  await p.mouse.click(box.x+270*sc,box.y+500*sc);await p.waitForTimeout(150);
  await p.mouse.down();await p.waitForTimeout(800);
  await p.screenshot({path:SP+`bug2_${k}.png`});
  await p.mouse.up();await p.waitForTimeout(2500);
  console.log('round',k,'state',await p.evaluate(()=>__cliff().state),'depth',await p.evaluate(()=>[__depth,__maxDepth]));
  await p.mouse.click(box.x+270*sc,box.y+500*sc);await p.waitForTimeout(300);
}
console.log('errors',JSON.stringify(errs,null,1));await b.close();})();
