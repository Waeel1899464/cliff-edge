// Cliff Run v0 (test build, test-build/index.html; build with: ./build.sh test-run).
// Checks the sequence (50 cliffs, worlds, groups, bosses), the scoring rules (points, bonus zone,
// multiplier, strikes, falls), the transition and its buffered press, that the transition never changes
// a result, the test analytics (names, ids, failures), and that Story mode still plays in the test build.
// Usage: node tests/run.test.js
const { chromium, serve, check, summary, open, IN_PAGE, ROOT, MANUAL_CLOCK } = require('./lib');
const fs = require('fs'), path = require('path');
const PAGE = '/test-build/index.html';
const v3src = fs.readFileSync(path.join(__dirname, 'v3.test.js'), 'utf8');
const HELP = v3src.slice(v3src.indexOf('const HELP = `') + 14, v3src.indexOf('`;', v3src.indexOf('const HELP = `')));
const RUN_HELP = `
  window.__step = () => { for (let i = 0; i < 400; i++) { window.__frame(16); const c = window.__cliff(); if (c.state === 'ready' && !window.__crun().busy()) break; } return window.__cliff(); };
  window.__run = (gapCm) => { const r = window.__play(gapCm); return { state: r.state, result: r.result, T: r.target, k: r.crunR.k, cleared: r.cleared, strike: !!r.crunStrike, pts: r.crunPts, bonus: !!r.crunBonus, multBefore: r.crunMult, frac: r.crunFrac, over: !!r.crunOver, boss: r.crunR.boss }; };
  window.__skipTo = (k) => { while (window.__cliff().crunR.k < k) { window.__run(Math.min(window.__cliff().target * 0.6, 60)); window.__step(); } };`;
const ALLOWED = (() => { const sql = fs.readFileSync(path.join(ROOT, 'metrics/v3-allow-events.sql'), 'utf8'); return [...sql.slice(sql.indexOf('array[')).matchAll(/'([a-z_]+)'/g)].map(m => m[1]); })();

(async () => {
  const srv = await serve(8870);
  const b = await chromium.launch();
  // The test build turns analytics on: every page here answers it locally (before the page loads),
  // so nothing ever leaves the machine during the tests.
  const openRun = async (q = '?first=run', extra = '') => {
    const ctx = await b.newContext({ viewport: { width: 400, height: 760 }, hasTouch: true });
    await ctx.route('https://twgbgjwweanifxngkzrd.supabase.co/**', r => r.fulfill({ status: 201, body: '' }));
    const page = await ctx.newPage(), errors = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', e => errors.push(String(e)));
    await page.addInitScript(MANUAL_CLOCK(Date.UTC(2026, 10, 4, 12)));
    await page.addInitScript(IN_PAGE + HELP + RUN_HELP + extra);
    await page.goto(srv.url + PAGE + q); await page.waitForFunction(() => typeof window.__cliff === 'function');
    return { page, ctx, errors };
  };
  const quiet = async () => {};
  try {
    // ---------- sequence ----------
    {
      const { page, ctx, errors } = await openRun(); await quiet(ctx);
      const L = await page.evaluate(() => window.__crun().list);
      check('the run has exactly 50 cliffs', L.length === 50, String(L.length));
      const perWorld = [1, 2, 3, 4, 5].map(w => L.filter(R => R.world === w).length);
      check('10 cliffs per world, worlds in order 1..5', perWorld.every(n => n === 10) && L.every((R, i) => R.world === Math.floor(i / 10) + 1), perWorld.join(','));
      check('each world: 3 groups of learn, vary, test, then the boss cliff', [1, 2, 3, 4, 5].every(w => L.filter(R => R.world === w).map(R => R.role).join() === 'learn,vary,test,learn,vary,test,learn,vary,test,boss'));
      check('boss cliffs are 10, 20, 30, 40, 50 and use the story boss cliffs', L.filter(R => R.boss).map(R => R.k).join() === '10,20,30,40,50' && L.filter(R => R.boss).map(R => R.base).join() === '10,20,30,40,50');
      const bases = L.filter(R => !R.boss).map(R => R.base);
      check('every group is built on a story cliff of its own world, none used twice', [...new Set(bases)].length === 15 && L.filter(R => !R.boss).every(R => Math.floor((R.base - 1) / 10) + 1 === R.world), [...new Set(bases)].join(','));
      check('the three cliffs of a group share the ground and twists but differ (road length, speed)', L.filter(R => !R.boss).every((R, i, a) => {
        const g = a.filter(x => x.group === R.group); const sig = x => JSON.stringify([x.sp.si, x.sp.gs, x.sp.patches.length, x.sp.crumble.length, x.sp.quake, Math.sign(x.sp.wind), Math.sign(x.sp.slope)]);
        return g.length === 3 && g.every(x => sig(x) === sig(R)) && new Set(g.map(x => x.sp.dist + '/' + x.sp.vmax)).size === 3; }));
      check('no fog anywhere in the run', L.every(R => !R.sp.fog));
      check('every road is at least 8 m', L.every(R => R.sp.dist >= 8));
      check('non-boss cliffs never show a boss (look taken from a non-boss cliff of the same world)', L.filter(R => !R.boss).every(R => (R.ref - 1) % 10 < 5 && Math.floor((R.ref - 1) / 10) + 1 === R.world));
      const T = await page.evaluate(() => { const c = window.__crun(); return Array.from({ length: 50 }, (_, i) => c.target(i + 1)); });
      check('first three targets 150, 130, 115 cm; every later target 100 cm or less', T[0] === 150 && T[1] === 130 && T[2] === 115 && T.slice(3).every(t => t > 0 && t <= 100), T.slice(0, 12).join(','));
      check('bonus zone shares 35, 32, 28, 24, 21 %', JSON.stringify(await page.evaluate(() => window.__crun().bonus)) === JSON.stringify([0, 0.35, 0.32, 0.28, 0.24, 0.21]));
      check('no page errors (sequence)', errors.length === 0, errors.join(' | '));
      await ctx.close();
    }

    // ---------- rules: points, bonus, multiplier, strikes, falls ----------
    {
      const { page, ctx, errors } = await openRun(); await quiet(ctx);
      const r = await page.evaluate(() => {
        const out = {};
        out.start = window.__cliff().crunR.k + '/' + window.__crun().crun.mult;
        out.a = window.__run(5); window.__step();                         // 5 cm on a 150 cm zone: bonus (x1 -> x2)
        out.b = window.__run(10); window.__step();                        // 10 cm of 130: bonus (x2 -> x3)
        out.c = window.__run(80); window.__step();                        // 80 cm of 115: clear but outside the bonus: back to x1
        out.d = window.__run(140); window.__step();                       // short of the 100 cm zone: strike 1
        out.e = window.__run(140); window.__step();                       // strike 2
        out.mid = Object.assign({}, window.__crun().crun);
        out.f = window.__run(150);                                        // strike 3: run over
        return out;
      });
      const pts = (cm, T, m) => Math.round(100 * (1 - cm / T)) * m;
      check('starts at cliff 1 with x1', r.start === '1/1', r.start);
      check('a stop in the gold zone scores 100 x (1 - gap/target) x multiplier and raises the multiplier',
        r.a.cleared && r.a.bonus && r.a.multBefore === 1 && Math.abs(r.a.pts - pts(r.a.result, r.a.T, 1)) <= 1 && r.b.multBefore === 2 && r.b.bonus, JSON.stringify([r.a, r.b]));
      check('the bonus zone uses the multiplier before the stop (x1 35 %, x2 32 %, x3 28 %)', r.a.frac === 0.35 && r.b.frac === 0.32 && r.c.frac === 0.28, [r.a.frac, r.b.frac, r.c.frac].join(','));
      check('a clear outside the gold zone scores x3 points and sets the multiplier back to x1',
        r.c.cleared && !r.c.bonus && r.c.multBefore === 3 && Math.abs(r.c.pts - pts(r.c.result, r.c.T, 3)) <= 3 && r.d.multBefore === 1, JSON.stringify(r.c));
      check('a stop short of the zone is a strike: no points, the run goes on', r.d.strike && !r.d.cleared && !r.d.over && r.e.strike && !r.e.over && r.mid.strikes === 2 && r.mid.k === 6, JSON.stringify(r.mid));
      check('the third short stop ends the run', r.f.strike && r.f.over, JSON.stringify(r.f));
      const g = await page.evaluate(() => { window.__advance(700); window.__tap(270, 600); return window.__crun().crun; });
      check('after a run is over, a tap starts a new run at cliff 1 with x1 and no strikes', g.k === 1 && g.mult === 1 && g.strikes === 0 && g.score === 0, JSON.stringify(g));
      const h = await page.evaluate(() => { const x = window.__run(-999); return { over: x.over, state: x.state }; });
      check('a fall ends the run at once', h.over && h.state === 'fell', JSON.stringify(h));
      const best = await page.evaluate(() => window.__crun().best);
      check('the best run score is kept', best > 0, String(best));
      check('no page errors (rules)', errors.length === 0, errors.join(' | '));
      await ctx.close();
    }

    // ---------- multiplier cap and the boss cliff ----------
    {
      const { page, ctx, errors } = await openRun(); await quiet(ctx);
      const r = await page.evaluate(() => {
        const m = [];
        for (let i = 0; i < 7; i++) { const x = window.__run(1.5); m.push(x.multBefore); window.__step(); }   // seven gold stops in a row
        window.__skipTo(10);
        const boss = window.__run(Math.min(window.__cliff().target * 0.5, 40));
        return { m, boss, world: window.__art().world };
      });
      check('the multiplier climbs x1..x5 and stays at x5 (max)', r.m.join() === '1,2,3,4,5,5,5', r.m.join());
      check('cliff 10 is the boss cliff and scores double', r.boss.k === 10 && r.boss.boss && Math.abs(r.boss.pts - Math.round(100 * (1 - r.boss.result / r.boss.T)) * r.boss.multBefore * 2) <= 2, JSON.stringify(r.boss));
      const w = await page.evaluate(() => { window.__step(); const a = []; for (const k of [11, 21, 31, 41]) { window.__skipTo(k); a.push([window.__cliff().crunR.k, window.__cliff().world, window.__art().world]); } return a; });
      check('world backgrounds follow the run: cliffs 11, 21, 31, 41 are worlds 2, 3, 4, 5', w.every(([k, wd, aw], i) => wd === i + 2 && aw === i + 2), JSON.stringify(w));
      check('no page errors (boss, worlds)', errors.length === 0, errors.join(' | '));
      await ctx.close();
    }

    // ---------- transition and buffered press ----------
    {
      const { page, ctx, errors } = await openRun(); await quiet(ctx);
      const r = await page.evaluate(() => {
        const c = window.__crun(), out = {};
        window.__run(30);
        const t0 = window.__T(); let readyAt = null, k0 = window.__cliff().crunR.k;
        for (let i = 0; i < 200; i++) { window.__frame(16); if (window.__cliff().crunR.k !== k0 && readyAt === null) out.newAt = window.__T() - t0; if (window.__cliff().state === 'ready' && !c.busy()) { readyAt = window.__T() - t0; break; } }
        out.readyAt = readyAt; out.expect = c.celeb + c.tr;
        // a press during the move, still held: the drive starts once, when the move ends
        window.__run(30); for (let i = 0; i < 30; i++) window.__frame(16);   // result shown, move started
        window.__ptr('pointerdown', window.__T(), 4); window.__frame(16);
        window.__ptr('pointerdown', window.__T(), 4); window.__frame(16);         // a second press while buffered
        out.holdingEarly = window.__cliff().state;
        for (let i = 0; i < 60; i++) { window.__frame(16); if (window.__cliff().state === 'holding') break; }
        out.after = window.__cliff().state; out.k = window.__cliff().crunR.k;
        out.pressAt = window.__cliff().tPress; out.introEnd = window.__cliff().crunIntro.t0 + c.tr;
        window.__ptr('pointerup', window.__T(), 4);
        for (let i = 0; i < 400; i++) { window.__frame(16); const st = window.__cliff().state; if (st === 'stopped' || st === 'fell') break; }
        // a press and release during the move: no drive
        window.__step(); window.__run(30); for (let i = 0; i < 30; i++) window.__frame(16);
        window.__ptr('pointerdown', window.__T(), 6); window.__frame(16); window.__ptr('pointerup', window.__T(), 6);
        for (let i = 0; i < 80; i++) window.__frame(16);
        out.tapDuring = window.__cliff().state;
        return out;
      });
      check(`the next cliff is ready ${'~'}${r.expect} ms after the stop (result + ground moving in)`, r.readyAt !== null && Math.abs(r.readyAt - r.expect) <= 40, JSON.stringify(r));
      check('a press held during the move starts the drive exactly when the move ends (not before)', r.holdingEarly === 'ready' && r.after === 'holding' && r.pressAt >= r.introEnd - 1, JSON.stringify(r));
      check('a press and release during the move does not start a drive', r.tapDuring === 'ready', r.tapDuring);
      check('no page errors (transition)', errors.length === 0, errors.join(' | '));
      await ctx.close();
    }

    // ---------- the transition never changes a result ----------
    {
      const { page, ctx } = await openRun(); await quiet(ctx);
      const r = await page.evaluate(() => {
        const P = window.__physics, out = [];
        for (let i = 0; i < 6; i++) {
          const c = window.__cliff(), gap = Math.min(c.target * 0.4, 30);
          const tau = P.releaseS(gap / 100, c.spec), expect = P.gapS(tau, c.spec) * 100;
          const x = window.__run(gap); out.push([x.result, expect]); window.__step();
        }
        return out;
      });
      check('every run stop equals the physics result for that press (transitions change nothing)', r.every(([a, e]) => Math.abs(a - e) < 0.05), JSON.stringify(r));
      await ctx.close();
    }

    // ---------- analytics in the test build ----------
    for (const [q, prefix] of [['?first=run', 'ra-'], ['?first=story', 'sa-']]) {
      const ctx = await b.newContext({ viewport: { width: 400, height: 760 }, hasTouch: true });
      const sent = [];
      await ctx.route('https://twgbgjwweanifxngkzrd.supabase.co/**', r => { try { sent.push(JSON.parse(r.request().postData())); } catch (e) {} r.fulfill({ status: 201, body: '' }); });
      const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(String(e)));
      await page.addInitScript(MANUAL_CLOCK(Date.UTC(2026, 10, 4, 12)));
      await page.addInitScript(IN_PAGE + HELP + RUN_HELP);
      await page.goto(srv.url + PAGE + q); await page.waitForFunction(() => typeof window.__cliff === 'function');
      const m = await page.evaluate(() => window.__crun().mode);
      if (m === 'cliffrun') await page.evaluate(() => { window.__run(20); window.__step(); window.__run(-999); });
      else await page.evaluate(() => { window.__play(3); });
      await page.waitForTimeout(200);
      check(`${q}: opens ${prefix === 'ra-' ? 'Cliff Run' : 'Story'} first`, m === (prefix === 'ra-' ? 'cliffrun' : 'run'), m);
      check(`${q}: every id starts with ${prefix} (test data apart from the website's v3-)`, sent.length > 0 && sent.every(x => x.device.startsWith(prefix) && x.session.startsWith(prefix)), JSON.stringify(sent[0]));
      check(`${q}: only allowed event names, and only device/session/event/value are sent`, sent.every(x => ALLOWED.includes(x.event) && Object.keys(x).sort().join() === 'device,event,session,value'), sent.map(x => x.event).join(','));
      if (prefix === 'ra-') {
        const end = sent.find(x => x.event === 'endless_run');
        check('run end is sent as score x 10 + reason (1 = fell)', end && end.value % 10 === 1 && Math.floor(end.value / 10) >= 0, JSON.stringify(end));
        check('each cleared run cliff is sent as endless_round with its number', sent.some(x => x.event === 'endless_round' && x.value === 1));
      }
      check(`${q}: no page errors`, errors.length === 0, errors.join(' | '));
      await ctx.close();
    }
    {   // analytics failing (network down) never breaks the game
      const ctx = await b.newContext({ viewport: { width: 400, height: 760 }, hasTouch: true });
      await ctx.route('https://twgbgjwweanifxngkzrd.supabase.co/**', r => r.abort());
      const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(String(e)));
      await page.addInitScript(MANUAL_CLOCK(Date.UTC(2026, 10, 4, 12)));
      await page.addInitScript(IN_PAGE + HELP + RUN_HELP);
      await page.goto(srv.url + PAGE + '?first=run'); await page.waitForFunction(() => typeof window.__cliff === 'function');
      const r = await page.evaluate(() => { const a = window.__run(20); window.__step(); const b2 = window.__run(20); return [a.cleared, b2.cleared, window.__crun().crun.k]; });
      check('with analytics failing, the run plays on normally', r[0] && r[1] && r[2] === 3, JSON.stringify(r));
      check('no page errors (analytics down)', errors.length === 0, errors.join(' | '));
      await ctx.close();
    }

    // ---------- On a downhill road the car sits on the road (drawing only) ----------
    // Records the canvas transform where the car is placed (drawCar: translate(car centre, GROUND_Y - WHEEL_R))
    // and where the road top is drawn (fillRect at GROUND_Y, 14 px high), then checks that the point under
    // the car's wheels lies on the road top line, and that the car is tilted like the road.
    {
      const { page, ctx, errors } = await openRun(); await quiet(ctx);
      const pose = () => page.evaluate(() => {
        const P = CanvasRenderingContext2D.prototype, s = window.__cliff(), rec = {};
        const tr = P.translate, fr = P.fillRect;
        P.translate = function (x, y) { tr.call(this, x, y); if (Math.abs(y - 612) < 1e-6 && Math.abs(x - (s.x * 30 + 24)) < 1e-6) rec.car = this.getTransform(); };
        P.fillRect = function (x, y, w, h) { if (y === 620 && h === 14 && !rec.road) rec.road = this.getTransform(); return fr.call(this, x, y, w, h); };
        window.__frame(16);
        P.translate = tr; P.fillRect = fr;
        if (!rec.car || !rec.road) return null;
        const under = rec.car.transformPoint(new DOMPoint(0, 8));            // where the wheels touch the ground
        const onRoad = rec.road.inverse().transformPoint(under);             // in road coordinates: road top is y = 620
        return { k: s.crunR.k, slope: s.spec.slope, gapPx: onRoad.y - 620, carAng: Math.atan2(rec.car.b, rec.car.a), roadAng: Math.atan2(rec.road.b, rec.road.a), tilt: s.tilt };
      });
      const flat = await pose();
      check('flat road: the car stands on the road (as before)', flat && Math.abs(flat.gapPx) < 0.5 && Math.abs(flat.carAng - flat.roadAng) < 1e-3, JSON.stringify(flat));
      await page.evaluate(() => window.__skipTo(10));
      const hill = await pose();
      check('downhill boss cliff: the car sits on the tilted road, not inside it', hill && hill.slope > 0 && Math.abs(hill.gapPx) < 0.5, JSON.stringify(hill));
      check('downhill: the car is tilted at the road angle', hill && Math.abs(hill.carAng - hill.roadAng) < 1e-3, JSON.stringify(hill));
      check('no page errors (downhill)', errors.length === 0, errors.join(' | '));
      await ctx.close();
    }

    // ---------- Story mode still plays in the test build; no bonus buttons ----------
    {
      const { page, ctx, errors } = await openRun('?first=story'); await quiet(ctx);
      const r = await page.evaluate(() => {
        const a = window.__play(3); window.__next(); const b2 = window.__play(-999);
        return { cleared: a.cleared, cliff: window.__cliff().cliff, fell: b2.state, hearts: window.__cliff().heartsLeft, mode: window.__crun().mode };
      });
      check('Story mode in the test build: clear, next cliff, a fall costs a heart', r.mode === 'run' && r.cleared && r.cliff === 2 && r.fell === 'fell' && r.hearts === 2, JSON.stringify(r));
      const sw = await page.evaluate(() => { window.__advance(800); window.__crun().switchMode(); return [window.__crun().mode, window.__cliff().crun, window.__crun().crun.k]; });
      check('the mode button switches to Cliff Run (cliff 1)', sw[0] === 'cliffrun' && sw[1] === true && sw[2] === 1, JSON.stringify(sw));
      const back = await page.evaluate(() => { window.__crun().switchMode(); return [window.__crun().mode, window.__cliff().cliff]; });
      check('and back to Story, at the same story cliff', back[0] === 'run' && back[1] === 2, JSON.stringify(back));
      check('no page errors (story in the test build)', errors.length === 0, errors.join(' | '));
      await ctx.close();
    }
  } finally { await b.close(); srv.close(); }
  process.exit(summary() ? 1 : 0);
})();
