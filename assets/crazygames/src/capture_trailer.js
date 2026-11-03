// Captures real gameplay frames from the CrazyGames build, one frame at a time (30 fps) under a
// controlled clock, so the footage is smooth and sharp. A small "director" inside the page presses
// and releases exactly like a player. Nothing is drawn on top of the game.
// Usage: node capture_trailer.js <out_frames_dir>
const {chromium}=require('playwright');const fs=require('fs');const path=require('path');
const OUT=process.argv[2];fs.mkdirSync(OUT,{recursive:true});
(async()=>{const b=await chromium.launch();
const c=await b.newContext({viewport:{width:540,height:960},deviceScaleFactor:2});const p=await c.newPage();
await p.addInitScript(([__M2__,__M3__,__START__])=>{
  // start at cliff START (default 5: ice, target 37 cm; cliff 6 is a checkpoint) with 3 hearts; controls tutorial already seen
  localStorage.setItem('cliff_rounds','10');localStorage.setItem('cliff_cur',String(__START__));localStorage.setItem('cliff_cp',String(Math.floor((__START__-1)/5)*5+1));
  localStorage.setItem('cliff_bestcliff',String(__START__));localStorage.setItem('cliff_hearts','3');
  window.__plan=[
    {a:'wait',ms:250},{a:'drive',m:-1.2},{a:'end'},{a:'wait',ms:900},{a:'tap'},       // 1. slide off the ice: fall + splash
    {a:'wait',ms:400},{a:'drive',m:+(__M2__)},{a:'end'},{a:'wait',ms:1300},{a:'tap'},       // 2. retry with ghost -> checkpoint
    {a:'wait',ms:300},{a:'drive',m:__M3__},{a:'end'},{a:'wait',ms:1500},{a:'done'}];     // 3. near-miss on road
  window.__step=0;window.__t0=null;window.__released=false;window.__done=false;
  const cv=()=>document.querySelector('canvas');
  const ev=(t,id)=>cv().dispatchEvent(new PointerEvent(t,{pointerId:id,bubbles:true,cancelable:true,clientX:cv().getBoundingClientRect().left+cv().getBoundingClientRect().width/2,clientY:cv().getBoundingClientRect().top+cv().getBoundingClientRect().height*0.55}));
  const tick=()=>{const s=window.__cliff&&__cliff();const st=__plan[__step];const now=performance.now();
    if(s&&st){
      if(st.a==='wait'){if(__t0===null)__t0=now;if(now-__t0>=st.ms){__t0=null;__step++;}}
      else if(st.a==='tap'){ev('pointerdown',7);ev('pointerup',7);__step++;}
      else if(st.a==='drive'){
        if(s.state==='ready'){ev('pointerdown',9);__released=false;}
        else if(s.state==='holding'&&!__released){const S=s.surface,v=s.v,k=S.drag,c0=S.base;
          if(v/k-c0/(k*k)*Math.log(1+k*v/c0)+v*0.016>=430/30-(s.x+1.6)-st.m){ev('pointerup',9);__released=true;__step++;}}
        else if(s.state==='falling'){__step++;}}
      else if(st.a==='end'){if(s.state==='stopped'||s.state==='fell')__step++;}
      else if(st.a==='done'){__done=true;}
    }
    requestAnimationFrame(tick);};
  requestAnimationFrame(tick);
},[+(process.env.M2||0.10),+(process.env.M3||-0.10),+(process.env.START||5)]);
await p.clock.install({time:new Date('2026-11-04T12:00:00Z')});
await p.goto('file:///home/user/docs/crazygames-preview/index.html');
await p.clock.pauseAt(new Date('2026-11-04T12:00:01Z'));   // time only moves when we step it: identical result on every run
let n=0;const log=[];
for(;n<30*30;n++){
  await p.clock.runFor(n%3===2?34:33);
  if(!process.env.NOSAVE){
    const d=await p.evaluate(()=>document.querySelector('canvas').toDataURL('image/jpeg',0.93));
    fs.writeFileSync(path.join(OUT,String(n).padStart(4,'0')+'.jpg'),Buffer.from(d.split(',')[1],'base64'));
  }
  const info=await p.evaluate(()=>({step:__step,done:__done,st:__cliff().state,res:__cliff().result,cliff:__cliff().cliff}));
  if(n%15===0)log.push(`${(n/30).toFixed(1)}s step${info.step} ${info.st} cliff${info.cliff}${info.res?' '+info.res.toFixed(1)+'cm':''}`);
  if(info.done)break;
}
console.log(log.join('\n'));console.log('frames:',n+1,'=',((n+1)/30).toFixed(1),'s');await b.close();})();
