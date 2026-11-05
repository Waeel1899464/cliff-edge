// V3 covers: captures real frames of the V3 platform build (unchanged game file) for the covers.
// Scene: the final hit of the Sandstorm boss battle (cliff 2-10): the car brakes at the edge on
// sand while the furious storm cloud blows from the left (the boss is fully inside the frame). Covers may carry no text except the
// title, so the game's text drawing is switched off in this capture only (shapes are untouched).
// Usage: node capture_cover_v3.js <out_dir>
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const OUT = process.argv[2]; fs.mkdirSync(OUT, { recursive: true });
const PAGE = 'file://' + path.resolve(__dirname, '../../../platform/crazygames-v3/index.html');
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 })).newPage();
  await p.addInitScript(() => {
    for (const k of ['cur', 'bestcliff']) localStorage.setItem('cg3_cliff_' + k, '20');
    localStorage.setItem('cg3_cliff_cp', '16'); localStorage.setItem('cg3_cliff_rounds', '10');
    CanvasRenderingContext2D.prototype.fillText = function () {};
    CanvasRenderingContext2D.prototype.strokeText = function () {};
  });
  await p.clock.install({ time: new Date('2026-11-05T12:00:00Z') });
  await p.goto(PAGE);
  await p.clock.pauseAt(new Date('2026-11-05T12:00:01Z'));
  await p.clock.runFor(2500);                       // the boss intro has faded
  const info = await p.evaluate(() => {
    const s = window.__cliff(), P = window.__physics, c = document.querySelector('canvas'), r = c.getBoundingClientRect();
    const tp = performance.now(), hold = P.releaseS(0.02, s.spec) * 1000;
    const ev = (type, t) => { const e = new PointerEvent(type, { bubbles: true, pointerId: 3, clientX: r.left + r.width / 2, clientY: r.top + r.height * 0.6 }); Object.defineProperty(e, 'timeStamp', { value: t }); (type === 'pointerdown' ? c : window).dispatchEvent(e); };
    ev('pointerdown', tp);
    window.__rel = () => ev('pointerup', tp + hold);
    return { hold, stopT: 0 };
  });
  await p.clock.runFor(Math.ceil(info.hold) + 2);
  await p.evaluate(() => window.__rel());
  let n = 0;
  for (let i = 0; i < 90; i++) {
    await p.clock.runFor(33);
    const st = await p.evaluate(() => [window.__cliff().state, window.__cliff().v]);
    if (st[0] !== 'sliding') break;
    if (i % 6 === 5) {
      const d = await p.evaluate(() => document.querySelector('canvas').toDataURL('image/png'));
      fs.writeFileSync(path.join(OUT, `cover_${String(n++).padStart(2, '0')}_v${st[1].toFixed(2)}.png`), Buffer.from(d.split(',')[1], 'base64'));
    }
  }
  console.log('frames', n);
  await b.close();
})();
