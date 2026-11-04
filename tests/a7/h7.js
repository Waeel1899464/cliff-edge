const {chromium,devices}=require('playwright');
const SP='/tmp/claude-0/-home-user/6aedb57c-d660-571b-9cb8-05ccda97d7f6/scratchpad/';
(async()=>{const b=await chromium.launch();const c=await b.newContext({...devices['Pixel 7'],deviceScaleFactor:1});const p=await c.newPage();
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8765/crazygames-preview-v2/');await p.waitForTimeout(300);
const box=await p.locator('canvas').boundingBox();const sc=box.width/540;
const play=async(m,shot)=>{
  const before=await p.evaluate(()=>({cliff:__cliff().cliff,target:__cliff().target}));
  if(shot==='ready')await p.screenshot({path:SP+'h_ready.png'});
  await p.evaluate((m)=>{const cv=document.querySelector('canvas');const ev=t=>new PointerEvent(t,{pointerId:99,bubbles:true,cancelable:true});cv.dispatchEvent(ev('pointerdown'));
    const f=()=>{const s=__cliff();const S=s.surface,v=s.v,k=S.drag,c=S.base;
      // aim to stop at ~40% of the target distance (success) or deliberately overshoot (m<0)
      const aim=m<0?m:Math.min(0.9,s.target/100*0.4);
      if(v/k-c/(k*k)*Math.log(1+k*v/c)>=430/30-(s.x+1.6)-aim){cv.dispatchEvent(ev('pointerup'));return;}requestAnimationFrame(f)};requestAnimationFrame(f);},m);
  for(let i=0;i<400;i++){const st=await p.evaluate(()=>__cliff().state);if(st==='stopped'||st==='fell')break;await p.waitForTimeout(25);}
  await p.waitForTimeout(500);
  const r=await p.evaluate(()=>{const s=__cliff();return {state:s.state,res:s.result&&+s.result.toFixed(1),cleared:s.cleared,missed:s.missed,heartsLeft:s.heartsLeft,backTo:s.backTo,newCp:s.newCp}});
  console.log(`cliff ${before.cliff} (under ${before.target}cm)`,JSON.stringify(r));
  if(shot&&shot!=='ready')await p.screenshot({path:SP+'h_'+shot+'.png'});
  await p.mouse.click(box.x+270*sc,box.y+450*sc);await p.waitForTimeout(350);};
const OK=1, MISS=-1.5;
console.log('--- part 1');
await play(OK);await play(OK,'ready');await play(MISS,'missed');await play(MISS);await play(MISS,'nohearts');
console.log('now at cliff',await p.evaluate(()=>__cliff().cliff));
console.log('--- part 2');
for(let i=0;i<5;i++)await play(OK,i===4?'checkpoint':null);
console.log('--- reload');
await p.reload();await p.waitForTimeout(300);
console.log('after reload: cliff',await p.evaluate(()=>__cliff().cliff));
console.log('--- part 4');
await play(MISS);await play(MISS);await play(MISS);
console.log('after 3 misses at checkpoint: cliff',await p.evaluate(()=>__cliff().cliff),'| best', await p.evaluate(()=>localStorage.getItem('cg2_cliff_bestcliff')));
console.log('errors',errs);await b.close();})();
