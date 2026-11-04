// A. Exact stop timing: math, frame-rate independence, continuity, delayed / invalid / reordered
// events, keyboard and pointer, blur / visibility / pointercancel.
const { chromium, serve, check, summary, open, IN_PAGE } = require('./lib');

const PAGE = process.env.PAGE || '/platform/crazygames-v3/index.html';
const RATES = [30, 60, 120, 144];

(async () => {
  const srv = await serve(8791);
  const browser = await chromium.launch();
  try {
    // ---------- pure math (in the page, using the game's own Physics) ----------
    {
      const { page, ctx } = await open(browser, srv.url + PAGE, { manualClock: true });
      const m = await page.evaluate(() => {
        const P = window.__physics, out = [];
        for (const S of P.SURFACES) {
          const c = S.base, k = S.drag;
          for (const v0 of [0.5, 3, 6, 9]) {
            // numerical integration with tiny steps must match the closed form
            let v = v0, x = 0, t = 0; const h = 1e-5;
            while (v > 0) { const a = c + k * v; x += v * h - 0.5 * a * h * h; v -= a * h; t += h; }
            out.push({ s: S.name, v0, dErr: Math.abs(x - P.stopDist(v0, c, k)), tErr: Math.abs(t - P.stopTime(v0, c, k)) });
          }
        }
        // hold: distance continuous at the speed cap
        const tv = 7 / P.ACCEL;
        const cont = Math.abs(P.hold(tv - 1e-9, 7).d - P.hold(tv + 1e-9, 7).d);
        // inverses
        const inv1 = Math.abs(P.hold(P.holdTimeFor(9.3, 8), 8).d - 9.3);
        const tr = P.releaseFor(0.05, 10, 7, 2, 0.9);
        const inv2 = Math.abs(P.gapAfter(tr, 10, 7, 2, 0.9) - 0.05);
        const sd = P.slide(0.3, 6, 2, 0.9).d, inv3 = Math.abs(P.slideTimeFor(sd, 6, 2, 0.9) - 0.3);
        const ni = [P.normInv(0.975) - 1.959964, P.normInv(0.5), P.normInv(0.025) + 1.959964].map(Math.abs);
        return { out, cont, inv1, inv2, inv3, ni };
      });
      check('math: closed-form stop distance = fine numeric integration (3 surfaces × 4 speeds)', m.out.every(r => r.dErr < 1e-3), 'max err ' + Math.max(...m.out.map(r => r.dErr)).toExponential(1) + ' m');
      check('math: closed-form stop time = numeric integration', m.out.every(r => r.tErr < 1e-3));
      check('math: holding distance continuous at top speed', m.cont < 1e-6);
      check('math: holdTimeFor / releaseFor / slideTimeFor invert correctly', m.inv1 < 1e-9 && m.inv2 < 1e-6 && m.inv3 < 1e-6);
      check('math: normInv accurate', m.ni.every(e => e < 1e-5));
      await ctx.close();
    }

    // ---------- frame-rate independence ----------
    // Same press and release timestamps at 30/60/120/144 Hz must give the same result.
    async function play(rate, holdMs, opts = {}) {
      const { page, ctx, errors } = await open(browser, srv.url + PAGE, { manualClock: true, init: IN_PAGE });
      const dt = 1000 / rate;
      const r = await page.evaluate(({ dt, holdMs, opts }) => {
        for (let i = 0; i < 5; i++) window.__frame(dt);
        const tp = window.__T() + 3.7;            // input between frames, on purpose
        window.__advance(3.7);
        window.__ptr('pointerdown', tp);
        const tr = tp + holdMs;
        let released = false, frames = 0, prevX = window.__cliff().x, back = 0, maxStep = 0;
        while (frames < 2000) {
          const nextT = window.__T() + dt;
          if (!released && nextT >= tr + (opts.delayMs || 0)) {
            // the release event fires before the next frame (or late, if delayMs)
            window.__advance(tr + (opts.delayMs || 0) - window.__T());
            window.__ptr('pointerup', tr);
            released = true;
            window.__frame(nextT - window.__T());
          } else window.__frame(dt);
          frames++;
          const s = window.__cliff();
          if (s.x < prevX - 1e-9 && s.state !== 'falling') back++;
          maxStep = Math.max(maxStep, s.x - prevX); prevX = s.x;
          if (s.state === 'stopped' || s.state === 'falling' || s.state === 'fell') break;
        }
        const s = window.__cliff(), P = window.__physics;
        const ideal = P.gapAfter(holdMs / 1000, s.dist, s.vmax, s.surface.base, s.surface.drag) * 100;
        return { state: s.state, result: s.result, ideal, back, maxStep, cliff: s.cliff };
      }, { dt, holdMs, opts });
      r.errors = errors.length;
      await ctx.close();
      return r;
    }
    const cliff1 = await (async () => {
      const { page, ctx } = await open(browser, srv.url + PAGE, { manualClock: true });
      const r = await page.evaluate(() => { const s = window.__cliff(), P = window.__physics; return { tr: P.releaseFor(0.0123, s.dist, s.vmax, s.surface.base, s.surface.drag) }; });
      await ctx.close(); return r;
    })();
    const holds = [Math.round(cliff1.tr * 1e6) / 1e3, 1000, 1500.25];
    for (const h of holds) {
      const res = [];
      for (const rate of RATES) res.push(await play(rate, h));
      const stops = res.filter(r => r.state === 'stopped');
      const same = res.every(r => r.state === res[0].state) && (stops.length === 0 || stops.every(r => Math.abs(r.result - stops[0].result) < 1e-9));
      check(`frame rate: hold ${h} ms → identical outcome at 30/60/120/144 Hz`, same,
        res.map((r, i) => RATES[i] + 'Hz:' + (r.state === 'stopped' ? r.result.toFixed(6) + 'cm' : r.state)).join(' '));
      check(`frame rate: hold ${h} ms → equals the exact equation`, stops.every(r => Math.abs(r.result - r.ideal) < 1e-9), 'ideal ' + res[0].ideal.toFixed(6));
      check(`continuity: hold ${h} ms → car never jumps back, no frame step over 0.5 m (all rates)`, res.every(r => r.back === 0 && r.maxStep < 0.5));
      check(`no page errors (hold ${h} ms)`, res.every(r => r.errors === 0));
    }
    // A very fine precision sweep: every millisecond of release changes the result smoothly.
    {
      const { page, ctx } = await open(browser, srv.url + PAGE, { manualClock: true });
      const sw = await page.evaluate(() => {
        const s = window.__cliff(), P = window.__physics, c = s.surface.base, k = s.surface.drag;
        const t0 = P.releaseFor(0, s.dist, s.vmax, c, k);
        const steps = []; for (let i = 1; i <= 40; i++) steps.push(P.gapAfter(t0 - i / 1000, s.dist, s.vmax, c, k) * 100);
        const diffs = steps.slice(1).map((v, i) => v - steps[i]);
        return { first: steps[0], maxDiff: Math.max(...diffs), minDiff: Math.min(...diffs) };
      });
      check('precision: 1 ms earlier release = ~0.6–1 cm more distance, no jumps (cliff 1)', sw.maxDiff < 1.2 && sw.minDiff > 0, `step ${sw.minDiff.toFixed(2)}–${sw.maxDiff.toFixed(2)} cm`);
      await ctx.close();
    }

    // ---------- delayed release event (busy phone): applied at its real time ----------
    {
      const a = await play(60, holds[0]);
      const b = await play(60, holds[0], { delayMs: 40 });
      check('delayed event: release delivered 40 ms late still counts at its timestamp', a.state === b.state && Math.abs(a.result - b.result) < 1e-9, `${a.result && a.result.toFixed(4)} vs ${b.result && b.result.toFixed(4)}`);
    }

    // ---------- invalid timestamps, ordering, keyboard, cancel, blur, visibility ----------
    {
      const { page, ctx, errors } = await open(browser, srv.url + PAGE, { manualClock: true, init: IN_PAGE });
      const r = await page.evaluate(() => {
        const out = {};
        const P = window.__physics;
        const reset = () => { for (let i = 0; i < 400 && window.__cliff().state !== 'ready'; i++) { window.__frame(16); const s = window.__cliff(); if (['stopped', 'fell', 'falling'].includes(s.state)) { window.__advance(400); window.__ptr('pointerdown', window.__T()); window.__ptr('pointerup', window.__T()); } } };
        const finish = () => { for (let i = 0; i < 2000; i++) { window.__frame(16); const st = window.__cliff().state; if (st !== 'holding' && st !== 'sliding') break; } return window.__cliff(); };
        // invalid timestamps → fall back to "now"
        for (const [name, bad] of [['NaN', NaN], ['Infinity', Infinity], ['future', 1e12], ['old', -5e5], ['epoch-ms', Date.now()]]) {
          reset();
          const tp = window.__T();
          window.__ptr('pointerdown', bad);
          const s = window.__cliff();
          out['press_' + name] = s.tPress === tp;
          window.__advance(500);
          window.__ptr('pointerup', bad);
          out['release_' + name] = window.__cliff().tRel === tp + 500;
          finish();
        }
        // release timestamp earlier than press → clamped to the press
        reset();
        let tp = window.__T(); window.__ptr('pointerdown', tp); window.__advance(10); window.__ptr('pointerup', tp - 5);
        out.order = window.__cliff().tRel === tp && finish().result === window.__cliff().dist * 100;
        // keyboard: keydown/keyup timestamps are used exactly; auto-repeat ignored
        reset();
        tp = window.__T() + 2.5; window.__advance(2.5); window.__key('keydown', tp);
        window.__frame(16); window.__frame(16);
        const rep = new KeyboardEvent('keydown', { key: ' ', repeat: true, bubbles: true }); window.dispatchEvent(rep);
        const tr = tp + 900.4; window.__advance(tr - window.__T()); window.__key('keyup', tr);
        let s = finish();
        const ideal = P.gapAfter(0.9004, s.dist, s.vmax, s.surface.base, s.surface.drag);
        out.key = s.tPress === tp && s.tRel === tr && (ideal >= 0 ? Math.abs(s.result - ideal * 100) < 1e-9 : s.state !== 'stopped');
        // pointercancel releases at its timestamp
        reset();
        tp = window.__T(); window.__ptr('pointerdown', tp); window.__frame(16); window.__advance(300);
        window.__ptr('pointercancel', tp + 300);
        out.cancel = window.__cliff().state === 'sliding' && window.__cliff().tRel === tp + 300 && tp + 300 < window.__T(); finish();
        // blur (window loses focus) releases a held finger
        reset();
        tp = window.__T(); window.__ptr('pointerdown', tp); window.__frame(16); window.__advance(250);
        window.dispatchEvent(new Event('blur'));
        out.blur = window.__cliff().state === 'sliding' && window.__cliff().tRel === window.__T(); finish();
        // page hidden releases a held key
        reset();
        tp = window.__T(); window.__key('keydown', tp); window.__frame(16); window.__advance(200);
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
        document.dispatchEvent(new Event('visibilitychange'));
        out.hidden = window.__cliff().state === 'sliding' && window.__cliff().tRel === window.__T(); finish();
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
        // a release after the car already crossed the edge does not undo the fall
        reset();
        s = window.__cliff();
        tp = window.__T(); window.__ptr('pointerdown', tp);
        const cross = s.crossAt; window.__advance(cross - window.__T() + 5); window.__ptr('pointerup', cross + 5);
        out.late = window.__cliff().state === 'holding'; window.__frame(1);
        out.late = out.late && window.__cliff().state === 'falling';
        // fall starts with the car exactly at the edge
        out.fallAtEdge = Math.abs(window.__cliff().x + 1.6 - 430 / 30) < 1e-9;
        return out;
      });
      for (const k of ['NaN', 'Infinity', 'future', 'old', 'epoch-ms']) check(`invalid timestamp (${k}) → press and release use "now"`, r['press_' + k] && r['release_' + k]);
      check('event order: release stamped before press is clamped (car does not move)', r.order);
      check('keyboard: keydown/keyup timestamps used exactly, auto-repeat ignored', r.key);
      check('pointercancel releases at its timestamp', r.cancel);
      check('window blur releases a held finger', r.blur);
      check('hidden page releases a held key', r.hidden);
      check('release after crossing the edge is ignored; fall starts exactly at the edge', r.late && r.fallAtEdge);
      check('no page errors (input edge cases)', errors.length === 0, errors.join(' | '));
      await ctx.close();
    }
  } finally {
    await browser.close();
    srv.close();
  }
  process.exit(summary() ? 1 : 0);
})();
