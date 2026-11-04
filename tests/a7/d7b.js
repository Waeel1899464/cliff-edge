const {chromium,devices}=require('playwright');
const URL_='http://localhost:8765/crazygames-preview-v2/';
(async()=>{const b=await chromium.launch();
const c=await b.newContext({...devices['Pixel 7'],timezoneId:'Europe/London'});const p=await c.newPage();
await p.clock.install({time:new Date('2026-11-03T23:50:00Z')});await p.goto(URL_);await p.clock.runFor(500);
const box=await p.locator('canvas').boundingBox();const sc=box.width/540;
const pill=async()=>{await p.mouse.click(box.x+(540-150)*sc,box.y+50*sc);await p.clock.runFor(300);};
const play=async()=>{await p.mouse.move(box.x+270*sc,box.y+500*sc);await p.mouse.down();await p.clock.runFor(1200);await p.mouse.up();await p.clock.runFor(9000);await p.mouse.click(box.x+270*sc,box.y+500*sc);await p.clock.runFor(300);};
// use all 3 tries on Nov 3
await pill();const p3=await p.evaluate(()=>__cliff().params);
for(let i=0;i<3;i++)await play();
const d3=await p.evaluate(()=>JSON.parse(localStorage.getItem('cg2_cliff_daily')));
console.log('Nov 3 after 3 tries:',JSON.stringify({day:d3.day,tries:d3.tries}),'| mode now daily?',await p.evaluate(()=>__cliff().daily));
// cross UTC midnight inside the same session, then open the daily again
await p.clock.runFor(10*60*1000);
await pill();const p4=await p.evaluate(()=>({daily:__cliff().daily,params:__cliff().params}));
console.log('Nov 4, same session: daily opens again =',p4.daily,'| different cliff =',JSON.stringify(p4.params)!==JSON.stringify(p3));
await play();
const d4=await p.evaluate(()=>JSON.parse(localStorage.getItem('cg2_cliff_daily')));
console.log('Nov 4 storage after one try:',JSON.stringify({day:d4.day,tries:d4.tries}));
// RARE CASE: daily ready screen opened at 23:59:50, first press after midnight
const c2=await b.newContext({...devices['Pixel 7']});const q=await c2.newPage();
await q.clock.install({time:new Date('2026-11-04T23:59:50Z')});await q.goto(URL_);await q.clock.runFor(300);
const bx=await q.locator('canvas').boundingBox();const s2=bx.width/540;
await q.mouse.click(bx.x+(540-150)*s2,bx.y+50*s2);await q.clock.runFor(300);
const oldParams=await q.evaluate(()=>__cliff().params);
await q.clock.runFor(20000);           // now 00:00:10 on Nov 5, still on the ready screen
await q.mouse.move(bx.x+270*s2,bx.y+500*s2);await q.mouse.down();await q.clock.runFor(1000);await q.mouse.up();await q.clock.runFor(9000);
const st=await q.evaluate(()=>JSON.parse(localStorage.getItem('cg2_cliff_daily')));
console.log('RARE CASE: played the Nov 4 cliff but the try was counted for',st.day,'(best',st.best&&st.best.toFixed(1),')');
await b.close();})();
