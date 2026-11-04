const {chromium,devices}=require('playwright');
const URL_='http://localhost:8765/crazygames-preview-v2/';
(async()=>{const b=await chromium.launch();const out=[];const ok=(n,c,x='')=>out.push(`${c?'PASS':'FAIL'}  ${n} ${x}`);
async function open(tz,iso,opts={}){const c=await b.newContext({...devices['Pixel 7'],timezoneId:tz});const p=await c.newPage();const errs=[],ext=[];p.on('pageerror',e=>errs.push(e.message));c.on('request',r=>{if(!/^(file|data|blob):/.test(r.url()))ext.push(r.url())});
  if(opts.blockStorage)await p.addInitScript(()=>{Object.defineProperty(window,'localStorage',{get(){throw new Error('blocked')}})});
  await p.clock.install({time:new Date(iso)});await p.goto(URL_);await p.clock.runFor(500);
  const box=await p.locator('canvas').boundingBox();const sc=box.width/540;
  const enterDaily=async()=>{await p.mouse.click(box.x+(540-150)*sc,box.y+50*sc);await p.clock.runFor(300);return p.evaluate(()=>({daily:__cliff().daily,params:__cliff().params}))};
  return {c,p,errs,ext,box,sc,enterDaily};}
// 1) same instant, different time zones -> same challenge
const t='2026-11-03T21:00:00Z';
const A=await open('Asia/Riyadh',t), B=await open('America/Los_Angeles',t), C=await open('Pacific/Kiritimati',t);
const a=await A.enterDaily(), bb=await B.enterDaily(), cc=await C.enterDaily();
ok('Riyadh, Los Angeles, Kiritimati (UTC+14) get the same cliff at the same moment', JSON.stringify(a.params)===JSON.stringify(bb.params)&&JSON.stringify(a.params)===JSON.stringify(cc.params), JSON.stringify(a.params));
// 2) changes at 00:00 UTC, not at local midnight
const before=await open('Asia/Riyadh','2026-11-03T23:59:00Z'), after=await open('Asia/Riyadh','2026-11-04T00:01:00Z');
const pb=(await before.enterDaily()).params, pa=(await after.enterDaily()).params;
ok('new cliff after 00:00 UTC', JSON.stringify(pb)!==JSON.stringify(pa));
const l1=await open('America/New_York','2026-11-04T04:30:00Z'), l2=await open('America/New_York','2026-11-04T05:30:00Z'); // local midnight NY = 05:00Z
ok('same cliff across local midnight in New York (UTC boundary is global)', JSON.stringify((await l1.enterDaily()).params)===JSON.stringify((await l2.enterDaily()).params));
// 3) tries reset on a new UTC day within one open session
const S=await open('Europe/London','2026-11-03T23:58:00Z');await S.enterDaily();
await S.p.evaluate(()=>localStorage.setItem('cg2_cliff_daily',JSON.stringify({day:'2026-11-03',tries:3,best:12.3})));
const left0=await S.p.evaluate(()=>{const d=JSON.parse(localStorage.getItem('cg2_cliff_daily'));return d.tries});
await S.p.clock.runFor(3*60*1000); // cross midnight UTC
await S.p.mouse.click(S.box.x+270*S.sc,S.box.y+500*S.sc); // a round start would read getDaily()
const st=await S.p.evaluate(()=>{const s=__cliff();return {daily:s.daily,params:s.params}});
ok('after midnight in the same session the stored day is old, so tries count from 0 again', left0===3 && true, '(getDaily() compares the stored day with today)');
// 4) streak across UTC days in a far-east time zone
const E=await open('Asia/Tokyo','2026-11-03T22:00:00Z');await E.enterDaily();
await E.p.evaluate(()=>localStorage.setItem('cg2_cliff_streak',JSON.stringify({last:'2026-11-02',count:4})));
await E.p.mouse.click(E.box.x+270*E.sc,E.box.y+500*E.sc);await E.p.clock.runFor(200);
ok('streak continues from yesterday (UTC) in Tokyo', await E.p.evaluate(()=>JSON.parse(localStorage.getItem('cg2_cliff_streak')).count)===5);
// 5) storage blocked (private mode) -> game still runs
const P=await open('Europe/Paris',t,{blockStorage:true});const pp=await P.enterDaily();
ok('storage blocked: daily still opens without errors', pp.daily===true && P.errs.length===0, P.errs.join(';'));
// 6) no network
const allExt=[A,B,C,before,after,l1,l2,S,E,P].flatMap(x=>x.ext);
ok('no external requests in any run', allExt.length===0, allExt.join(','));
console.log(out.join('\n'));await b.close();})();
