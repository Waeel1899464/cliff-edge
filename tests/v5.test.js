// V5 quality pass (CrazyGames build): readable text and a bigger car in the portal's own frame
// sizes (907x510 and 821x462, at 1 device pixel per CSS pixel), the corner buttons still work
// where they moved, upright phones unchanged, and the LAST RELEASE / LAST STOP marks only after a miss.
// Usage: node tests/v5.test.js
const { chromium, serve, check, summary, open, IN_PAGE } = require('./lib');
const fs = require('fs'), path = require('path');
const PAGE = process.env.PAGE || '/platform/crazygames-v3/index.html';
const v3src = fs.readFileSync(path.join(__dirname, 'v3.test.js'), 'utf8');
const HELP = v3src.slice(v3src.indexOf('const HELP = `') + 14, v3src.indexOf('`;', v3src.indexOf('const HELP = `')));
// Every screen text goes through text(): outlined with this exact colour. Records its real size in
// CSS pixels (font size x the canvas transform), and the car's real length (drawCar's translate).
const SPY = `
  window.__spy = () => {
    const P = CanvasRenderingContext2D.prototype, st = P.strokeText, tr = P.translate, s = window.__cliff(), out = { texts: [], car: null };
    const dpr = window.devicePixelRatio || 1;
    P.strokeText = function (str, x, y) {
      if (this.strokeStyle === 'rgba(10, 10, 25, 0.85)' || this.strokeStyle === 'rgba(10,10,25,0.85)') {
        const px = parseFloat(/(\\d+(\\.\\d+)?)px/.exec(this.font)[1]), m = this.getTransform();
        out.texts.push([String(str), +(px * Math.hypot(m.a, m.b) / dpr).toFixed(1)]);
      }
      return st.call(this, str, x, y);
    };
    P.translate = function (x, y) { tr.call(this, x, y); if (Math.abs(y - 612) < 1e-6 && Math.abs(x - (s.x * 30 + 24)) < 1e-6) { const m = this.getTransform(); out.car = +(48 * Math.hypot(m.a, m.b) / dpr).toFixed(1); } };
    window.__frame(16);
    P.strokeText = st; P.translate = tr;
    return out;
  };`;
const seed = (cur, extra = '') => IN_PAGE + HELP + SPY + `localStorage.setItem('cg3_cliff_cur','${cur}');localStorage.setItem('cg3_cliff_cp','${Math.floor((cur - 1) / 5) * 5 + 1}');localStorage.setItem('cg3_cliff_bestcliff','${cur}');localStorage.setItem('cg3_cliff_rounds','10');${extra}`;

(async () => {
  const srv = await serve(8871);
  const b = await chromium.launch();
  try {
    for (const [w, h] of [[907, 510], [821, 462]]) {
      const tag = `${w}x${h}`;
      const { page, ctx, errors } = await open(b, srv.url + PAGE, { manualClock: true, init: seed(1), context: { viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: false } });
      const r = await page.evaluate(() => {
        for (let i = 0; i < 90; i++) window.__frame(16);
        const ready = window.__spy();
        window.__play(4); for (let i = 0; i < 60; i++) window.__frame(16);
        const stopped = window.__spy();
        window.__next(); for (let i = 0; i < 90; i++) window.__frame(16);
        window.__play(-999); for (let i = 0; i < 30; i++) window.__frame(16);
        const fell = window.__spy();
        return { ready, stopped, fell, ui: window.__ui() };
      });
      const all = [...r.ready.texts, ...r.stopped.texts, ...r.fell.texts];
      const small = all.filter(([, px]) => px < 14);
      check(`${tag}: every screen text is at least 14 px (start, result, fall screens)`, all.length > 10 && small.length === 0, small.length ? JSON.stringify(small.slice(0, 6)) : `${all.length} texts, smallest ${Math.min(...all.map(t => t[1]))} px`);
      check(`${tag}: the car is at least 70 px long at the start of cliff 1`, r.ready.car >= 70, r.ready.car + ' px');
      check(`${tag}: the car is at least 100 px long after a close stop`, r.stopped.car >= 100, r.stopped.car + ' px');
      check(`${tag}: the corner buttons moved into the side areas and grew`, r.ui.SIDE > 0 && r.ui.UI > 1.3 && r.ui.mute.x > 540 && r.ui.map.x < 74, JSON.stringify({ SIDE: r.ui.SIDE, UI: +r.ui.UI.toFixed(2), mute: r.ui.mute.x, map: r.ui.map.x }));
      // the moved buttons still answer where they are drawn
      const taps = await page.evaluate(() => {
        while (window.__cliff().state !== 'ready') window.__next();
        for (let i = 0; i < 30; i++) window.__frame(16);
        const u = window.__ui(), out = {};
        const muted0 = localStorage.getItem('cg3_cliff_muted');
        window.__tap(u.mute.x, u.mute.y); out.mute = localStorage.getItem('cg3_cliff_muted') !== muted0;
        window.__tap(u.daily.x + u.daily.w * u.UI / 2 - 6, u.daily.y); for (let i = 0; i < 5; i++) window.__frame(16); out.daily = !!window.__cliff().daily;
        window.__tap(u.daily.x, u.daily.y); for (let i = 0; i < 5; i++) window.__frame(16); out.back = !window.__cliff().daily;
        return out;
      });
      check(`${tag}: the sound button and the DAILY button work where they are drawn (also near the edge of the bigger button)`, taps.mute && taps.daily && taps.back, JSON.stringify(taps));
      check(`${tag}: no page errors`, errors.length === 0, errors.join(' | '));
      await ctx.close();
    }

    // ---------- upright phone: unchanged ----------
    {
      const { page, ctx } = await open(b, srv.url + PAGE, { manualClock: true, init: seed(1), context: { viewport: { width: 390, height: 844 } } });
      const u = await page.evaluate(() => window.__ui());
      check('upright phone: no wide-screen changes (text, buttons, camera)', u.PAD === 0 && u.MINF === 0 && u.UI === 1 && u.SIDE === 0 && u.mute.x === 540 - 44, JSON.stringify(u));
      await ctx.close();
    }

    // ---------- LAST RELEASE / LAST STOP: only after a miss ----------
    {
      const { page, ctx, errors } = await open(b, srv.url + PAGE, { manualClock: true, init: seed(3) });
      const shown = () => page.evaluate(() => {
        const P = CanvasRenderingContext2D.prototype, f = P.fillText, seen = [];
        P.fillText = function (str, x, y) { seen.push(String(str)); return f.call(this, str, x, y); };
        window.__frame(16); P.fillText = f;
        return ['LAST RELEASE', 'LAST STOP'].filter(t => seen.includes(t));
      });
      const r = {};
      await page.evaluate(() => { window.__play(400); window.__next(); for (let i = 0; i < 30; i++) window.__frame(16); });   // a short stop: a miss
      r.afterShort = await shown();
      await page.evaluate(() => { window.__play(-50); window.__next(); for (let i = 0; i < 30; i++) window.__frame(16); });   // let go too late: a fall
      r.afterFall = await shown();
      // the daily cliff is the same cliff every try: a good stop must not leave the marks
      await page.evaluate(() => { const u = window.__ui(); window.__tap(u.daily.x, u.daily.y); for (let i = 0; i < 10; i++) window.__frame(16); window.__play(5); window.__next(); for (let i = 0; i < 30; i++) window.__frame(16); });
      r.dailyAfterStop = await shown();
      r.daily = await page.evaluate(() => !!window.__cliff().daily);
      await page.evaluate(() => { window.__play(-50); window.__next(); for (let i = 0; i < 30; i++) window.__frame(16); });
      r.dailyAfterFall = await shown();
      check('after a short stop, the retry shows LAST RELEASE and LAST STOP', r.afterShort.length === 2, JSON.stringify(r.afterShort));
      check('after a fall, the retry shows LAST RELEASE', r.afterFall.includes('LAST RELEASE'), JSON.stringify(r.afterFall));
      check('daily cliff (same cliff every try): after a good stop, no marks', r.daily && r.dailyAfterStop.length === 0, JSON.stringify(r));
      check('daily cliff: after a fall, LAST RELEASE shows', r.dailyAfterFall.includes('LAST RELEASE'), JSON.stringify(r.dailyAfterFall));
      check('no page errors (marks)', errors.length === 0, errors.join(' | '));
      await ctx.close();
    }
  } finally { await b.close(); srv.close(); }
  process.exit(summary() ? 1 : 0);
})();
