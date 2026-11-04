// Trailer V3 — gameplay capture. Records real gameplay of the V2 build (unchanged game file)
// frame by frame at 30 fps under a paused clock (identical result on every run), and writes a
// per-frame log (state, cliff, result, grade, finger down/up) used by compose_v3.py to cut the
// trailer and place the labels exactly on the real press/release moments.
// Nothing is drawn by this script; the game draws everything.
// Usage: node capture_v3.js <frames_dir>
// Story (one continuous session, starting at cliff 8):
//   R1 cliff 8 (mud)  PERFECT 0.8 cm            -> the opening
//   R2 cliff 9 (road) GREAT 4.6 cm               -> press / release explained
//   R3 cliff 10 (ice) drives off: fall + splash  -> quick retry (tap during the fall)
//   R4 cliff 10 (ice) retry with the ghost, 12 cm -> CHECKPOINT SAVED
//   R5 cliff 11       night zone appears         -> progression
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const OUT = process.argv[2]; fs.mkdirSync(OUT, { recursive: true });
const PAGE = 'file://' + path.resolve(__dirname, '../../../docs/crazygames-preview-v2/index.html');

(async () => {
  const b = await chromium.launch();
  const c = await b.newContext({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 });
  const p = await c.newPage();
  await p.addInitScript(() => {
    const k = n => 'cg2_cliff_' + n;
    localStorage.setItem(k('rounds'), '10'); localStorage.setItem(k('cur'), '8'); localStorage.setItem(k('cp'), '6');
    localStorage.setItem(k('bestcliff'), '8'); localStorage.setItem(k('hearts'), '3');
    window.__plan = [
      { a: 'wait', ms: 150 }, { a: 'drive', gap: 0.008 }, { a: 'end' }, { a: 'wait', ms: 900 }, { a: 'tap' },     // R1
      { a: 'wait', ms: 500 }, { a: 'drive', gap: 0.046 }, { a: 'end' }, { a: 'wait', ms: 1300 }, { a: 'tap' },    // R2
      { a: 'wait', ms: 300 }, { a: 'drive', fall: true }, { a: 'splash' }, { a: 'wait', ms: 450 }, { a: 'tap' },  // R3
      { a: 'wait', ms: 350 }, { a: 'drive', gap: 0.12 }, { a: 'end' }, { a: 'wait', ms: 1100 }, { a: 'tap' },     // R4
      { a: 'wait', ms: 1600 }, { a: 'done' }];                                                                    // R5
    window.__step = 0; window.__t0 = null; window.__tRel = null; window.__done = false;
    window.__held = false; window.__taps = 0;
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
        else if (st.a === 'tap') { ev('pointerdown', 7, now); ev('pointerup', 7, now); __taps++; __step++; }
        else if (st.a === 'drive') {
          if (s.state === 'ready') {
            ev('pointerdown', 9, now); __held = true;
            const P = window.__physics, S = s.surface;
            __tRel = st.fall ? null : now + P.releaseFor(st.gap, s.dist, s.vmax, S.base, S.drag) * 1000;
          } else if (s.state === 'holding' && __tRel !== null && now >= __tRel) {
            ev('pointerup', 9, __tRel); __held = false; __step++;
          } else if (s.state === 'falling') { ev('pointerup', 9, now); __held = false; __step++; }
        }
        else if (st.a === 'end') { if (s.state === 'stopped' || s.state === 'fell') __step++; }
        else if (st.a === 'splash') { if (s.splashed) __step++; }
        else if (st.a === 'done') { __done = true; }
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await p.clock.install({ time: new Date('2026-11-04T12:00:00Z') });
  await p.goto(PAGE);
  await p.clock.pauseAt(new Date('2026-11-04T12:00:01Z'));
  const log = [];
  for (let n = 0; n < 30 * 60; n++) {
    await p.clock.runFor(n % 3 === 2 ? 34 : 33);
    const d = await p.evaluate(() => document.querySelector('canvas').toDataURL('image/jpeg', 0.94));
    fs.writeFileSync(path.join(OUT, String(n).padStart(4, '0') + '.jpg'), Buffer.from(d.split(',')[1], 'base64'));
    const info = await p.evaluate(() => { const s = __cliff(); return { st: s.state, cliff: s.cliff, res: s.result, grade: s.grade, cp: s.newCp, splashed: !!s.splashed, held: __held, taps: __taps, done: __done, z: s.state }; });
    info.n = n; log.push(info);
    if (info.done) break;
  }
  fs.writeFileSync(path.join(OUT, 'log.json'), JSON.stringify(log));
  console.log('frames', log.length);
  await b.close();
})();
