// V5 CrazyGames trailers: records real gameplay scenes from the V5 platform build (unchanged game
// file), frame by frame at 30 fps under a paused clock (identical result on every run), directly at
// each video's own size: the game lays itself out for the frame (wide screens use the full width).
// A small director presses and releases at exact moments (the release moment comes from the game's
// own physics). Nothing is drawn on top. A per-frame log lets compose_trailer_v5.py cut the scenes.
// Usage: node capture_trailer_v5.js <out_dir>
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const OUT = process.argv[2]; fs.mkdirSync(OUT, { recursive: true });
const PAGE = 'file://' + path.resolve(__dirname, '../../../platform/crazygames-v3/index.html');
const FORMATS = [   // video size = viewport x deviceScaleFactor
  { id: 'land', viewport: { width: 1920, height: 1080 }, dsf: 1 },     // 1920x1080
  { id: 'p916', viewport: { width: 540, height: 960 }, dsf: 2 },       // 1080x1920
  { id: 'p23',  viewport: { width: 720, height: 1080 }, dsf: 1.5 },    // 1080x1620
];
const SCENES = [
  { id: 's1_hill_final',   cliff: 10, cp: 6,  gap: 0.01, after: 2.4 },   // PERFECT on the steep slope, the Giant Hill goes down
  { id: 's2_sandstorm',    cliff: 19, cp: 16, gap: 0.05, after: 1.4 },   // head wind from the storm cloud, GREAT, HIT!
  { id: 's3_blizzard',     cliff: 29, cp: 26, gap: 0.06, after: 1.4 },   // dusk and fog, road then ice
  { id: 's4_moon_fall',    cliff: 32, cp: 31, fall: true, after: 2.6 },  // long road, floaty fall (the STOP sign shuts its eyes)
  { id: 's5_volcano_edge', cliff: 43, cp: 41, gap: 0.03, after: 1.4 },   // two pieces of the edge break off
  { id: 's6_final_hit',    cliff: 50, cp: 46, gap: 0.08, after: 2.6 },   // the Angry Volcano goes down, all worlds complete
];
(async () => {
  const b = await chromium.launch();
  for (const F of FORMATS) for (const sc of SCENES) {
    const dir = path.join(OUT, F.id, sc.id); fs.mkdirSync(dir, { recursive: true });
    const p = await (await b.newContext({ viewport: F.viewport, deviceScaleFactor: F.dsf })).newPage();
    await p.addInitScript((sc) => {
      const k = n => 'cg3_cliff_' + n;
      localStorage.setItem(k('cur'), String(sc.cliff)); localStorage.setItem(k('bestcliff'), String(sc.cliff));
      localStorage.setItem(k('cp'), String(sc.cp)); localStorage.setItem(k('rounds'), '10');
      // today's free bonuses already used, so no reward buttons appear in the footage
      localStorage.setItem(k('rewards'), JSON.stringify({ day: '2026-11-05', double: 3, box: 5, heart: 1, helper: 1, rescue: 2 }));
    }, sc);
    await p.clock.install({ time: new Date('2026-11-05T12:00:00Z') });
    await p.goto(PAGE);
    await p.clock.pauseAt(new Date('2026-11-05T12:00:01Z'));
    await p.clock.runFor(2500);
    const hold = await p.evaluate((sc) => {
      const s = window.__cliff(), P = window.__physics, c = document.querySelector('canvas'), r = c.getBoundingClientRect();
      const ev = (type, t) => { const e = new PointerEvent(type, { bubbles: true, pointerId: 3, clientX: r.left + r.width / 2, clientY: r.top + r.height * 0.6 }); Object.defineProperty(e, 'timeStamp', { value: t }); (type === 'pointerdown' ? c : window).dispatchEvent(e); };
      window.__ev = ev; window.__press = performance.now();
      return sc.fall ? (P.holdTimeForS(P.edgeAt(s.spec, Infinity), s.spec) + 0.4) * 1000 : P.releaseS(sc.gap, s.spec) * 1000;
    }, sc);
    const log = []; let n = 0, released = false, endAt = null;
    const shot = async () => {
      const d = await p.evaluate(() => document.querySelector('canvas').toDataURL('image/jpeg', 0.93));
      fs.writeFileSync(path.join(dir, String(n).padStart(4, '0') + '.jpg'), Buffer.from(d.split(',')[1], 'base64'));
      log.push(await p.evaluate(() => { const s = window.__cliff(); return { st: s.state, cleared: s.cleared, done: !!s.worldDone, splashed: !!s.splashed, fallen: s.fallen || 0, t: performance.now() - window.__press }; }));
      n++;
    };
    await p.evaluate(() => window.__ev('pointerdown', window.__press));
    for (let i = 0; i < 30 * 20; i++) {
      await p.clock.runFor(i % 3 === 2 ? 34 : 33);
      if (!released) {
        const t = await p.evaluate(() => performance.now() - window.__press);
        if (t >= hold) { await p.evaluate((h) => window.__ev('pointerup', window.__press + h), hold); released = true; }
      }
      await shot();
      const st = log[log.length - 1].st;
      if (endAt === null && (st === 'stopped' || (st === 'falling' && sc.fall))) endAt = n;
      if (endAt !== null && n - endAt > sc.after * 30) break;
    }
    fs.writeFileSync(path.join(dir, 'log.json'), JSON.stringify(log));
    console.log(F.id, sc.id, 'frames', n, 'end at', endAt, 'state', log[log.length - 1].st, 'cleared', log[log.length - 1].cleared);
    await p.context().close();
  }
  await b.close();
})();
