// Trailer v2: captures real gameplay frames from the experimental v2 build (fair precision),
// one frame at a time (30 fps) under a paused clock, so the result is identical on every run.
// A small "director" inside the page presses and releases like a player. The release moment is
// computed with the game's own physics (window.__physics) and given to the game as the event's
// timestamp, which v2 uses exactly. Nothing is drawn on top of the game.
// Usage: node capture_trailer_v2.js <out_frames_dir>
// Story (chronological, starts at cliff 8):
//   cliff 8 mud: PERFECT stop 0.8 cm (the strongest moment, in the first 3 seconds)
//   cliff 9 road: drives off the edge (fall + splash), retry with the ghost: GREAT, 4.6 cm
//   cliff 10 ice: clean stop -> CHECKPOINT SAVED, ends on that success screen (loops to the start)
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const OUT = process.argv[2]; fs.mkdirSync(OUT, { recursive: true });
const PAGE = 'file://' + path.resolve(__dirname, '../../../docs/crazygames-preview-v2/index.html');
const SKIP_MS = +(process.env.SKIP_MS || 900);   // footage starts this long after the first press

(async () => {
  const b = await chromium.launch();
  const c = await b.newContext({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 });
  const p = await c.newPage();
  await p.addInitScript(() => {
    const k = n => 'cg2_cliff_' + n;
    localStorage.setItem(k('rounds'), '10'); localStorage.setItem(k('cur'), '8'); localStorage.setItem(k('cp'), '6');
    localStorage.setItem(k('bestcliff'), '8'); localStorage.setItem(k('hearts'), '3');
    window.__plan = [
      { a: 'wait', ms: 150 }, { a: 'drive', gap: 0.008 }, { a: 'end' }, { a: 'wait', ms: 1000 }, { a: 'tap' },   // PERFECT
      { a: 'wait', ms: 350 }, { a: 'drive', fall: true }, { a: 'end' }, { a: 'wait', ms: 300 }, { a: 'tap' },      // fall
      { a: 'wait', ms: 450 }, { a: 'drive', gap: 0.046 }, { a: 'end' }, { a: 'wait', ms: 800 }, { a: 'tap' },     // GREAT with ghost
      { a: 'wait', ms: 350 }, { a: 'drive', gap: 0.12 }, { a: 'end' }, { a: 'wait', ms: 1300 }, { a: 'done' }];    // checkpoint
    window.__step = 0; window.__t0 = null; window.__tRel = null; window.__done = false; window.__firstPress = null;
    const cv = () => document.querySelector('canvas');
    const ev = (type, id, t) => {
      const r = cv().getBoundingClientRect();
      const e = new PointerEvent(type, { pointerId: id, bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + r.height * 0.55 });
      Object.defineProperty(e, 'timeStamp', { value: t });
      (type === 'pointerdown' ? cv() : window).dispatchEvent(e);
    };
    const tick = () => {
      const s = window.__cliff && window.__cliff(), st = window.__plan[window.__step], now = performance.now();
      if (s && st) {
        if (st.a === 'wait') { if (__t0 === null) __t0 = now; if (now - __t0 >= st.ms) { __t0 = null; __step++; } }
        else if (st.a === 'tap') { ev('pointerdown', 7, now); ev('pointerup', 7, now); __step++; }
        else if (st.a === 'drive') {
          if (s.state === 'ready') {
            ev('pointerdown', 9, now);
            if (__firstPress === null) __firstPress = now;
            const P = window.__physics, S = s.surface;
            __tRel = st.fall ? null : now + P.releaseFor(st.gap, s.dist, s.vmax, S.base, S.drag) * 1000;
          } else if (s.state === 'holding' && __tRel !== null && now >= __tRel) {
            ev('pointerup', 9, __tRel); __step++;          // released at the exact planned moment
          } else if (s.state === 'falling') { __step++; }
        }
        else if (st.a === 'end') { if (s.state === 'stopped' || s.state === 'fell') __step++; }
        else if (st.a === 'done') { __done = true; }
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await p.clock.install({ time: new Date('2026-11-04T12:00:00Z') });
  await p.goto(PAGE);
  await p.clock.pauseAt(new Date('2026-11-04T12:00:01Z'));
  let n = 0, saved = 0; const log = [];
  for (; n < 30 * 40; n++) {
    await p.clock.runFor(n % 3 === 2 ? 34 : 33);
    const info = await p.evaluate(() => ({ step: __step, done: __done, st: __cliff().state, res: __cliff().result, grade: __cliff().grade, cliff: __cliff().cliff, fp: __firstPress, now: performance.now() }));
    if (info.fp !== null && info.now - info.fp >= SKIP_MS) {
      const d = await p.evaluate(() => document.querySelector('canvas').toDataURL('image/jpeg', 0.93));
      fs.writeFileSync(path.join(OUT, String(saved).padStart(4, '0') + '.jpg'), Buffer.from(d.split(',')[1], 'base64'));
      if (saved % 15 === 0) log.push(`${(saved / 30).toFixed(1)}s step${info.step} ${info.st} cliff${info.cliff}${info.res !== null ? ' ' + info.res.toFixed(1) + 'cm' : ''}${info.grade ? ' ' + info.grade : ''}`);
      saved++;
    }
    if (info.done) break;
  }
  console.log(log.join('\n')); console.log('frames:', saved, '=', (saved / 30).toFixed(2), 's of gameplay');
  await b.close();
})();
