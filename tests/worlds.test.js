// V3 worlds: physics of every twist (slope, wind, ground patches, crumbling edge, low gravity),
// checked against fine numeric integration; plain cliffs identical to V2; every story cliff valid;
// the boss cliff identical at 30/60/120/144 Hz in the real game.
const fs = require('fs'), path = require('path');
const { chromium, serve, check, summary, open, IN_PAGE } = require('./lib');

const src = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const block = src.slice(src.indexOf('/* PHYSICS-BEGIN'), src.indexOf('/* PHYSICS-END */'));
const P = new Function(block.replace(/^\/\*[\s\S]*?\*\//, '') + '\nreturn Physics;')();

// fine numeric reference: Euler-Cromer with 10 µs steps, same rules written out longhand
function numeric(tau, sp) {
  const dt = 1e-5, aH = P.ACCEL + P.G * sp.gs * sp.slope + sp.wind;
  let x = 0, v = 0, t = 0;
  while (t < tau) { v = Math.min(sp.vmax, v + aH * dt); x += v * dt; t += dt; }
  const segs = P.segments(sp);
  while (v > 0) {
    const g = segs.find(s => x < s.x1);
    v = Math.max(0, v - (g.c + g.k * v) * dt); x += v * dt;
  }
  return P.edgeAt(sp, x) - x;
}

(async () => {
  // ---- plain cliffs = V2 ----
  let maxd = 0;
  for (let si = 0; si < P.SURFACES.length; si++) for (const [dist, vmax] of [[8, 6], [11, 7.3], [13, 9]]) {
    const S = P.SURFACES[si], sp = P.spec({ si, dist, vmax });
    for (let tau = 0; tau < 2.6; tau += 0.07) maxd = Math.max(maxd, Math.abs(P.gapS(tau, sp) - P.gapAfter(tau, dist, vmax, S.base, S.drag)));
  }
  check('plain cliffs: the V3 model gives exactly V2\'s results (all grounds, many release times)', maxd < 1e-12, 'max diff ' + maxd.toExponential(1) + ' m');

  // ---- each twist vs numeric integration ----
  const cases = {
    'downhill slope': P.spec({ si: 0, dist: 16, vmax: 8, slope: 0.1 }),
    'tail wind': P.spec({ si: 0, dist: 12, vmax: 7, wind: 0.6 }),
    'head wind': P.spec({ si: 2, dist: 11, vmax: 8, wind: -0.8 }),
    'ice patch before the edge': P.spec({ si: 0, dist: 12, vmax: 8, patches: [{ at: 9, si: 1 }] }),
    'two ground changes': P.spec({ si: 2, dist: 13, vmax: 8, patches: [{ at: 7, si: 0 }, { at: 11, si: 1 }] }),
    'crumbling edge': P.spec({ si: 0, dist: 12, vmax: 7, crumble: [{ at: 10, len: 0.3 }, { at: 10.8, len: 0.3 }] }),
    'moon gravity': P.spec({ si: 0, dist: 24, vmax: 7, gs: 0.4 }),
  };
  for (const [name, sp] of Object.entries(cases)) {
    const t0 = P.releaseS(0, sp);
    let worst = 0;
    for (const dtau of [-0.25, -0.1, -0.03, 0, 0.02]) {
      const tau = Math.max(0.05, t0 + dtau);
      worst = Math.max(worst, Math.abs(P.gapS(tau, sp) - numeric(tau, sp)));
    }
    check(`${name}: exact pieces = fine numeric integration`, worst < 3e-4, 'max diff ' + (worst * 100).toFixed(4) + ' cm');
  }

  // ---- continuity of the piecewise slide (position and speed) ----
  {
    const sp = cases['two ground changes'];
    let h, plan;   // a release whose slide crosses both ground changes (mud -> road -> ice)
    for (let tau = 0.3; tau < 2; tau += 0.01) { h = P.holdS(tau, sp); plan = P.slidePlan(h.d, h.v, sp); if (plan.phases.length === 3) break; }
    let ok = plan.phases.length === 3;
    for (let i = 1; i < plan.phases.length; i++) {
      const tB = plan.phases[i].t0, a = P.planAt(plan, tB - 1e-9), b = P.planAt(plan, tB + 1e-9);
      ok = ok && Math.abs(a.d - b.d) < 1e-6 && Math.abs(a.v - b.v) < 1e-6;
    }
    const x = (h.d + plan.stopX) / 2, back = P.planAt(plan, P.planTimeFor(plan, x)).d;
    check('ground changes: no jump in position or speed at a boundary; time-for-position inverts', ok && Math.abs(back - x) < 1e-6, plan.phases.length + ' pieces');
  }

  // ---- crumbling edge: the result jumps by the piece length at a trigger, never backwards ----
  {
    const sp = cases['crumbling edge'];
    let mono = true, prev = Infinity;
    for (let tau = 0.8; tau < P.holdTimeForS(12, sp); tau += 0.002) { const g = P.gapS(tau, sp); if (g > prev + 1e-12) mono = false; prev = g; }
    const reach = [9.9, 10.0, 10.5, 10.8, 11.2].map(r => P.edgeAt(sp, r));
    check('crumbling edge: edge 12 → 11.7 at 10 m → 11.4 at 10.8 m; result never grows with a later release', mono && [12, 11.7, 11.7, 11.4, 11.4].every((v, i) => Math.abs(reach[i] - v) < 1e-9), reach.map(v => v.toFixed(2)).join(' / '));
  }

  // ---- every story cliff is valid and possible ----
  {
    const bad = [];
    P.CLIFFS.forEach((c, i) => {
      const n = i + 1, sp = P.cliffSpec(n);
      if (P.holdAccel(sp) <= 1) bad.push(n + ': weak hold');
      for (const g of P.segments(sp)) if (!(g.c > 0.15)) bad.push(n + ': cannot stop on ' + P.SURFACES[g.si].name);
      let E = sp.dist;
      for (const cr of sp.crumble.slice().sort((a, b) => a.at - b.at)) { E -= cr.len; if (cr.at > E - 0.2) bad.push(n + ': trigger too close to the new edge'); }
      const tr = P.releaseS(0, sp);
      if (!(tr > 0.4)) bad.push(n + ': release too early ' + tr.toFixed(2));
      const T = P.storyTarget(n, sp);
      if (!(T >= 0.5 && T <= 100)) bad.push(n + ': target ' + T);
    });
    check(`all ${P.CLIFFS.length} story cliffs: the car can always stop, triggers are fair, release > 0.4 s, target 0.5–100 cm`, bad.length === 0, bad.join('; '));
  }

  // ---- the boss cliff in the real game: same result at 30/60/120/144 Hz ----
  const srv = await serve(8794);
  const browser = await chromium.launch();
  try {
    const res = [];
    for (const rate of [30, 60, 120, 144]) {
      const { page, ctx, errors } = await open(browser, srv.url + (process.env.PAGE || '/platform/crazygames-v3/index.html'),
        { manualClock: true, init: IN_PAGE + `localStorage.setItem('cg3_cliff_cur','10');localStorage.setItem('cg3_cliff_cp','6');localStorage.setItem('cg3_cliff_bestcliff','10');` });
      const r = await page.evaluate((dt) => {
        const s0 = window.__cliff(), P = window.__physics;
        const hold = P.releaseS(0.123, s0.spec) * 1000 + 0.37;
        for (let i = 0; i < 3; i++) window.__frame(dt);
        const tp = window.__T() + 2.1; window.__advance(2.1); window.__ptr('pointerdown', tp);
        let rel = false;
        for (let i = 0; i < 3000; i++) {
          if (!rel && window.__T() + dt >= tp + hold) { window.__advance(tp + hold - window.__T()); window.__ptr('pointerup', tp + hold); rel = true; }
          window.__frame(dt);
          if (['stopped', 'falling'].includes(window.__cliff().state)) break;
        }
        const s = window.__cliff();
        return { cliff: s0.cliff, boss: s0.spec.boss, state: s.state, result: s.result, ideal: P.gapS(hold / 1000, s0.spec) * 100 };
      }, 1000 / rate);
      r.errors = errors.length; res.push(r); await ctx.close();
    }
    const same = res.every(r => r.state === 'stopped' && Math.abs(r.result - res[0].result) < 1e-9 && Math.abs(r.result - r.ideal) < 1e-9);
    check('boss slope (cliff 1-10) in the game: identical result at 30/60/120/144 Hz, equal to the exact equation', same && res[0].boss && res[0].cliff === 10,
      res.map(r => r.state === 'stopped' ? r.result.toFixed(6) : r.state).join(' / '));
    check('no page errors (boss cliff)', res.every(r => r.errors === 0));
  } finally { await browser.close(); srv.close(); }
  process.exit(summary() ? 1 : 0);
})();
