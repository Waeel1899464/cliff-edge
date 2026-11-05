const {chromium}=require('playwright');
const SP='/tmp/claude-0/-home-user/6aedb57c-d660-571b-9cb8-05ccda97d7f6/scratchpad/';
(async()=>{const b=await chromium.launch();const c=await b.newContext({viewport:{width:1280,height:800}});const p=await c.newPage();
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8765/crazygames-preview-v2/');await p.waitForTimeout(400);
await p.screenshot({path:SP+'g3_desktop_ready.png'});
const st=()=>p.evaluate(()=>__cliff().state);
const res=[];const check=(name,ok,extra='')=>res.push(`${ok?'PASS':'FAIL'}  ${name} ${extra}`);
// 1) Space hold/release
await p.keyboard.down('Space');await p.waitForTimeout(600);check('Space down -> holding',await st()==='holding');
// repeated keydown events while held must not do anything
await p.evaluate(()=>{for(let i=0;i<5;i++)window.dispatchEvent(new KeyboardEvent('keydown',{key:' ',repeat:true,cancelable:true}))});
check('auto-repeat ignored (still holding)',await st()==='holding');
await p.keyboard.up('Space');await p.waitForTimeout(100);check('Space up -> sliding',await st()==='sliding');
for(let i=0;i<300;i++){const s=await st();if(s==='stopped'||s==='fell')break;await p.waitForTimeout(25);}
await p.waitForTimeout(600);
// 2) key on end screen -> next round (ready), not driving yet
await p.keyboard.down('Enter');await p.waitForTimeout(150);const afterEnd=await st();await p.keyboard.up('Enter');await p.waitForTimeout(100);
check('Enter on end screen -> new round ready',afterEnd==='ready',`(got ${afterEnd})`);
check('still ready after releasing Enter',await st()==='ready');
// 3) ArrowUp drives
await p.keyboard.down('ArrowUp');await p.waitForTimeout(300);check('ArrowUp down -> holding',await st()==='holding');
// 4) blur while holding -> released
await p.evaluate(()=>window.dispatchEvent(new Event('blur')));await p.waitForTimeout(50);
check('window blur while holding -> released',await st()==='sliding');
await p.keyboard.up('ArrowUp');
for(let i=0;i<300;i++){const s=await st();if(s==='stopped'||s==='fell')break;await p.waitForTimeout(25);}
await p.waitForTimeout(400);await p.keyboard.press('Space');await p.waitForTimeout(200);
// 5) other keys ignored
await p.keyboard.press('a');await p.keyboard.press('ArrowDown');await p.waitForTimeout(100);check('other keys ignored',await st()==='ready');
// 6) mouse holding, then key press -> no double action
const box=await p.locator('canvas').boundingBox();
await p.mouse.move(box.x+box.width/2,box.y+box.height*0.6);await p.mouse.down();await p.waitForTimeout(300);
await p.keyboard.down('Space');await p.keyboard.up('Space');await p.waitForTimeout(100);
check('mouse holding + Space tap -> still holding (no interference)',await st()==='holding');
await p.mouse.up();await p.waitForTimeout(100);check('mouse up -> sliding',await st()==='sliding');
// 7) Space does not scroll / default prevented
const prevented=await p.evaluate(()=>{const e=new KeyboardEvent('keydown',{key:' ',cancelable:true});window.dispatchEvent(e);window.dispatchEvent(new KeyboardEvent('keyup',{key:' ',cancelable:true}));return e.defaultPrevented});
check('Space default (page scroll) prevented',prevented);
console.log(res.join('\n'));console.log('errors',errs);await b.close();})();
