// B/C/D/E/G/H and storage: first 10 cliffs, difficulty targets, grades, daily midnight, hearts and
// checkpoints, save/load and isolation between the three versions, zones, shorter repeated falls.
const { chromium, serve, check, summary, open, IN_PAGE } = require('./lib');

const V2 = process.env.PAGE || '/platform/crazygames-v3/index.html';
const DAY = Date.UTC(2026, 10, 4);          // 2026-11-04 00:00 UTC

// play one round in the page: hold so the car stops `gapCm` from the edge (negative = fall)
const PLAY = `
  window.__playGap = (gapCm) => {
    const s0 = window.__cliff(), P = window.__physics, S = s0.surface;
    const tHold = gapCm <= -100 ? P.holdTimeForS(P.edgeAt(s0.spec, Infinity), s0.spec) + 0.3 : P.releaseS(gapCm / 100, s0.spec);
    const tp = window.__T(); window.__ptr('pointerdown', tp);
    let released = false;
    for (let i = 0; i < 3000; i++) {
      if (!released && window.__T() + 16 >= tp + tHold * 1000) { window.__advance(tp + tHold * 1000 - window.__T()); window.__ptr('pointerup', window.__T()); released = true; }
      window.__frame(16);
      const st = window.__cliff().state;
      if (st === 'stopped' || st === 'fell') break;
    }
    const s = window.__cliff();
    return { state: s.state, result: s.result, target: s.target, grade: s.grade, cleared: s.cleared, cliff: s.cliff, hearts: s.heartsLeft, backTo: s.backTo, newCp: s.newCp };
  };
  window.__next = () => {
    const s0 = window.__cliff();
    window.__advance(400); window.__ptr('pointerdown', window.__T()); window.__ptr('pointerup', window.__T()); window.__frame(16);
    // after a boss the tap opens the map travel to the next world: a second tap skips it (like a player)
    if (window.__cliff() === s0 && s0.worldDone) { window.__ptr('pointerdown', window.__T()); window.__ptr('pointerup', window.__T()); window.__frame(16); }
    return window.__cliff();
  };`;

(async () => {
  const srv = await serve(8793);
  const browser = await chromium.launch();
  try {
    // ---------- C: first 10 cliffs ----------
    {
      const { page, ctx, errors } = await open(browser, srv.url + V2, { manualClock: true, init: IN_PAGE + PLAY });
      const r = await page.evaluate(() => {
        const P = window.__physics, rows = [];
        for (let n = 1; n <= 12; n++) {
          const prm = P.cliffParams(n), S = P.SURFACES[prm.si];
          const tRel = P.releaseFor(0, prm.dist, prm.vmax, S.base, S.drag);
          rows.push({ n, s: S.name, prm, T: P.cliffTarget(n, prm), T3: P.storyTarget(n, P.cliffSpec(n)), atTop: tRel > prm.vmax / P.ACCEL + 0.15, sens: P.sensitivity(prm.dist, prm.vmax, S.base, S.drag) });
        }
        return rows;
      });
      const names = r.slice(0, 10).map(x => x.s);
      check('C: 10 hand-made cliffs, cliffs 1–2 road', names.length === 10 && names[0] === 'ROAD' && names[1] === 'ROAD', names.join(','));
      check('C: mud from cliff 3, then mixed in (never twice in a row)', names[2] === 'MUD' && !names.some((s, i) => i && s === 'MUD' && names[i - 1] === 'MUD'));
      check('C: no ice before the first checkpoint, and never two ice cliffs in a row', names.slice(0, 5).every(s => s !== 'ICE') && !names.some((s, i) => i && s === 'ICE' && names[i - 1] === 'ICE'));
      check('C: forgiving ice: at top speed well before the ideal release (result moves at car speed only)', r.filter(x => x.s === 'ICE' && x.n <= 10).every(x => x.atTop && Math.abs(x.sens - x.prm.vmax) < 0.01));
      check('C: all first-10 layouts inside the normal ranges (8–13 m, 6–9 m/s)', r.slice(0, 10).every(x => x.prm.dist >= 8 && x.prm.dist <= 13 && x.prm.vmax >= 6 && x.prm.vmax <= 9));
      check('C: cliffs 11+ come from the seeded generator (same for everyone)', JSON.stringify(r[10].prm) === JSON.stringify(await page.evaluate(() => window.__physics.seededParams('cliff-11'))));
      console.log('     targets 1–12: ' + r.map(x => x.n + ':' + x.s[0] + ' ' + x.T).join('  '));
      // play the first 10 cliffs in the game, stopping at 40% of each target: all cleared, in order
      const run = await page.evaluate(() => { const out = []; for (let i = 0; i < 10; i++) { const s = window.__cliff(); const T = s.target; const res = window.__playGap(T * 0.4); out.push([s.cliff, T, res.cleared]); window.__next(); } return { out, now: window.__cliff().cliff }; });
      check('C: playing cliffs 1–10 (world 1) in the game uses the V3 story targets; all clear in order', run.out.every((x, i) => x[0] === i + 1 && x[1] === r[i].T3 && x[2]) && run.now === 11, run.out.map(x => x[1]).join(','));
      const w1 = await page.evaluate(() => { const P = window.__physics; return {
        same: [1,2,3,4,5].every(n => { const a = P.cliffSpec(n), b = P.CURATED[n - 1]; return a.si === b.si && a.dist === b.dist && a.vmax === b.vmax && !a.slope && !a.wind && a.gs === 1 && !a.patches.length && !a.crumble.length; }),
        arena: [6,7,8,9].map(n => { const a = P.cliffSpec(n), b = P.CURATED[n - 1]; return a.si === b.si && a.vmax === b.vmax && (a.dist === b.dist || n === 6) ? a.slope : -1; }),
        boss: P.cliffSpec(10) }; });
      check('V3: world 1 cliffs 1–5 are V2\'s; boss battle 6–9 = V2 layouts with the tilt rising 0.02→0.08; cliff 10 the steep final slope', w1.same && w1.arena.join() === '0.02,0.04,0.06,0.08' && w1.boss.boss === true && w1.boss.slope === 0.1, w1.arena.join());
      check('no page errors (first 10 cliffs)', errors.length === 0, errors.join('|'));
      await ctx.close();
    }

    // ---------- D: grades ----------
    {
      const { page, ctx, errors } = await open(browser, srv.url + V2, { manualClock: true, init: IN_PAGE + PLAY });
      const g = await page.evaluate(() => {
        const P = window.__physics, bad = [];
        for (const T of [0.5, 1, 2.5, 5, 9.5, 10, 17, 25, 50, 90, 100]) {
          const great = Math.min(10, 0.4 * T), perfect = Math.min(2, 0.2 * T, great * 0.5);
          if (!(perfect < great && great < T)) bad.push('order ' + T);
          for (let x = 0; x <= T * 1.2; x += T / 997) {
            const gr = P.grade(x, T);
            const want = x >= T ? null : x < perfect ? 'PERFECT' : x < great ? 'GREAT' : 'GOOD';
            if (gr !== want) { bad.push(`T${T} x${x.toFixed(3)} ${gr} vs ${want}`); break; }
          }
          if (P.grade(T, T) !== null) bad.push('at target ' + T);
        }
        if (P.grade(-0.1, 10) !== null || P.grade(NaN, 10) !== null || P.grade(null, 10) !== null) bad.push('fail inputs');
        return bad;
      });
      check('D: thresholds always PERFECT < GREAT < target; exact boundaries; failures and falls get no grade', g.length === 0, g.slice(0, 3).join(' | '));
      const inGame = await page.evaluate(() => {
        const out = {};
        let s = window.__cliff(); out.perfect = window.__playGap(0.5); window.__next();
        s = window.__cliff(); out.great = window.__playGap(6); window.__next();
        s = window.__cliff(); out.good = window.__playGap(s.target * 0.8); window.__next();
        s = window.__cliff(); out.miss = window.__playGap(s.target + 3); window.__next();
        s = window.__cliff(); out.fall = window.__playGap(-999);
        out.fallMsgOk = typeof window.__cliff().fallMsg === 'string';
        return out;
      });
      check('D: in game, 0.5 cm → PERFECT, 6 cm → GREAT, 80% of target → GOOD', inGame.perfect.grade === 'PERFECT' && inGame.great.grade === 'GREAT' && inGame.good.grade === 'GOOD', [inGame.perfect.result, inGame.great.result, inGame.good.result].map(x => x.toFixed(2)).join(' / '));
      check('D: missed target and fall → no grade', inGame.miss.grade === null && !inGame.miss.cleared && inGame.fall.grade === null && inGame.fall.state === 'fell');
      check('no page errors (grades)', errors.length === 0, errors.join('|'));
      await ctx.close();
    }

    // ---------- SO CLOSE is kept for slow falls ----------
    {
      const { page, ctx } = await open(browser, srv.url + V2, { manualClock: true, init: IN_PAGE + PLAY });
      const m = await page.evaluate(() => { window.__playGap(-0.5); return window.__cliff().fallMsg; });
      check('fall that barely goes over the edge still says SO CLOSE!', m === 'SO CLOSE!', m);
      await ctx.close();
    }

    // ---------- E: daily challenge at midnight (controlled clock) ----------
    for (const scenario of [1, 2]) {
      // the manual clock starts 30 s before midnight UTC
      const { page, ctx, errors } = await open(browser, srv.url + V2, { manualClock: true, base: DAY - 30000 - 1000, init: IN_PAGE + PLAY });
      const r = await page.evaluate((scenario) => {
        const sk = k => 'cg3_' + k;
        const P = window.__physics;
        const dayOf = () => new Date(Date.now()).toISOString().slice(0, 10);
        const yParams = P.seededParams('cliff-edge-' + dayOf());
        // open the daily challenge (the pill)
        const c = document.getElementById('game'), r0 = c.getBoundingClientRect(), sc = r0.width / 540;
        const ev = (type) => { const e = new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 7, clientX: r0.left + 390 * sc, clientY: r0.top + 50 * sc }); Object.defineProperty(e, 'timeStamp', { value: window.__T() }); (type === 'pointerdown' ? c : window).dispatchEvent(e); };
        ev('pointerdown'); ev('pointerup'); window.__frame(16);
        const s0 = window.__cliff();
        const out = { day0: s0.dailyDay, daily: s0.daily, yParams: JSON.stringify(s0.params) === JSON.stringify(yParams) };
        if (scenario === 1) {
          // screen opened before midnight, first press after midnight
          window.__advance(31000); window.__frame(16);
          const today = dayOf();
          window.__ptr('pointerdown', window.__T()); window.__ptr('pointerup', window.__T()); window.__frame(16);
          const s1 = window.__cliff();
          out.rebuilt = s1.state === 'ready' && s1.dailyDay === today && JSON.stringify(s1.params) === JSON.stringify(P.seededParams('cliff-edge-' + today));
          const stored = JSON.parse(localStorage.getItem(sk('cliff_daily')) || 'null');
          out.noTryUsed = !stored || stored.tries === 0;
          const res = window.__playGap(20);
          const d = JSON.parse(localStorage.getItem(sk('cliff_daily')));
          out.counted = d.day === today && d.tries === 1 && Math.abs(d.best - res.result) < 1e-9;
        } else {
          // press before midnight, the car stops after midnight
          const yday = dayOf();
          window.__advance(29200);
          const s1 = window.__cliff(), S = s1.surface;
          const tHold = P.releaseFor(0.2, s1.dist, s1.vmax, S.base, S.drag);
          const tp = window.__T(); window.__ptr('pointerdown', tp);
          let rel = false;
          for (let i = 0; i < 2000; i++) {
            if (!rel && window.__T() + 16 >= tp + tHold * 1000) { window.__advance(tp + tHold * 1000 - window.__T()); window.__ptr('pointerup', window.__T()); rel = true; }
            window.__frame(16); if (window.__cliff().state === 'stopped') break;
          }
          const s2 = window.__cliff();
          out.crossed = dayOf() !== yday && s2.dailyDay === yday && s2.state === 'stopped';
          const d = JSON.parse(localStorage.getItem(sk('cliff_daily')));
          out.keptDay = d.day === yday && d.tries === 1 && Math.abs(d.best - s2.result) < 1e-9;
          // the new day starts clean: 3 tries, no best
          window.__next(); const s3 = window.__cliff();
          out.newDay = s3.daily && s3.dailyDay === dayOf() && JSON.stringify(s3.params) === JSON.stringify(P.seededParams('cliff-edge-' + dayOf()));
        }
        return out;
      }, scenario);
      if (scenario === 1) {
        check('E1: daily screen opened 30 s before midnight shows that day\'s cliff', r.daily && r.yParams && r.day0 === '2026-11-03');
        check('E1: first press after midnight switches to today\'s cliff without using a try', r.rebuilt && r.noTryUsed);
        check('E1: the next round counts for today (1 try, best saved for today)', r.counted);
      } else {
        check('E2: round pressed before midnight and stopped after it keeps its own date', r.crossed);
        check('E2: its try and best go to the old day; today is untouched', r.keptDay);
        check('E2: next round is today\'s cliff', r.newDay);
      }
      check(`no page errors (midnight ${scenario})`, errors.length === 0, errors.join('|'));
      await ctx.close();
    }

    // ---------- hearts, checkpoints, saves ----------
    {
      const { page, ctx, errors } = await open(browser, srv.url + V2, { manualClock: true, init: IN_PAGE + PLAY });
      const r = await page.evaluate(() => {
        const out = {}, k = n => localStorage.getItem('cg3_cliff_' + n);
        for (let i = 0; i < 5; i++) { window.__playGap(window.__cliff().target * 0.4); window.__next(); }
        // cliff 6 starts the world-1 boss battle: 4 hearts there
        out.cp = window.__cliff().cliff === 6 && k('cp') === '6' && k('cur') === '6' && k('hearts') === '4';
        const a = window.__playGap(-999); window.__next();
        const b = window.__playGap(window.__cliff().target + 5); window.__next();
        const c2 = window.__playGap(-999); window.__next();
        out.hearts = a.hearts === 3 && b.hearts === 2 && c2.hearts === 1 && k('hearts') === '1';
        window.__playGap(-999);
        const c = window.__cliff();                         // the round itself (the helper returns a summary)
        // V3: losing the last heart first offers a rescue; nothing is lost until the player chooses
        out.offer = !!(c.rescue && c.rescue.state === 'offer') && k('hearts') === '1';
        window.__next();                                    // any other tap = no rescue: back as usual
        out.back = out.offer && c.backTo === 6 && window.__cliff().cliff === 6 && k('hearts') === '4';
        out.bestCliff = k('bestcliff') === '6';
        return out;
      });
      check('checkpoint at cliff 6 saved (cliff, checkpoint), boss battle: hearts refilled to 4', r.cp);
      check('fall and missed target each cost one heart (saved), 4 → 1', r.hearts);
      check('no hearts left → rescue offered first; a normal tap goes back to the checkpoint (boss battle start), 4 hearts again', r.back && r.bestCliff);
      await page.reload(); await page.waitForFunction(() => typeof window.__cliff === 'function');
      const after = await page.evaluate(() => ({ cliff: window.__cliff().cliff, target: window.__cliff().target, exp: window.__physics.cliffTarget(6, window.__physics.cliffParams(6)) }));
      check('after reload: same cliff and same target', after.cliff === 6 && after.target === after.exp);
      check('no page errors (hearts)', errors.length === 0, errors.join('|'));
      await ctx.close();
    }

    // ---------- storage isolation: web keys / cg_ (first preview) / cg3_ (v2) ----------
    {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await page.goto(srv.url + '/docs/index.html');   // same origin as the previews in this test
      const seed = { cliff_cur: '7', cliff_cp: '6', cliff_hearts: '2', cliff_best: '3.5', cliff_bestcliff: '9', cliff_rounds: '40', cliff_muted: '0',
        cliff_daily: JSON.stringify({ day: '2026-11-04', tries: 2, best: 8 }), cliff_streak: JSON.stringify({ last: '2026-11-04', count: 4 }), cliff_dev: 'webdevice' };
      await page.evaluate(seed => { localStorage.clear(); for (const [k, v] of Object.entries(seed)) { localStorage.setItem(k, v); localStorage.setItem('cg_' + k, v + (k === 'cliff_dev' ? 'cg' : '')); } }, seed);
      const before = await page.evaluate(() => JSON.stringify(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)])));
      await page.goto(srv.url + V2);
      await page.waitForFunction(() => typeof window.__cliff === 'function');
      const start = await page.evaluate(() => ({ cliff: window.__cliff().cliff, hearts: window.__cliff().heartsLeft }));
      // play: hold long (fall), then a short stop, toggle mute
      const box = await page.locator('canvas').boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.6); await page.mouse.down(); await page.waitForTimeout(2600); await page.mouse.up();
      await page.waitForTimeout(2500); await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.6); await page.waitForTimeout(300);
      const mp = await page.evaluate(() => window.__toClient ? window.__toClient(540 - 44, 50) : null);   // the sound button (wide screens: middle column)
      if (mp) await page.mouse.click(mp.x, mp.y); else { const sc = box.width / 540; await page.mouse.click(box.x + (540 - 44) * sc, box.y + 50 * sc); }
      await page.waitForTimeout(100);
      const after = await page.evaluate(() => Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)]));
      const untouched = JSON.stringify(after.filter(([k]) => !k.startsWith('cg3_'))) === before;
      const own = after.filter(([k]) => k.startsWith('cg3_')).map(([k]) => k);
      check('isolation: v3 starts fresh (cliff 1, 3 hearts) even with web and cg_ saves present', start.cliff === 1 && start.hearts === 3);
      check('isolation: playing v2 changes none of the web or cg_ keys', untouched);
      check('isolation: v3 writes only cg3_ keys', own.length >= 4 && own.includes('cg3_cliff_muted') && own.includes('cg3_cliff_dev'), own.join(','));
      // a bad prefix is refused: the page falls back to cg_
      const html = require('fs').readFileSync(require('path').join(__dirname, '..', V2), 'utf8').replace("window.CLIFF_STORE_PREFIX = 'cg3_'", "window.CLIFF_STORE_PREFIX = '../Evil-prefix'");
      await page.route('**/bad-prefix.html', r => r.fulfill({ contentType: 'text/html', body: html }));
      await page.goto(srv.url + '/bad-prefix.html'); await page.waitForFunction(() => typeof window.__cliff === 'function');
      const mp2 = await page.evaluate(() => window.__toClient(540 - 44, 50)); await page.mouse.click(mp2.x, mp2.y); await page.waitForTimeout(100);
      const keys = await page.evaluate(() => Object.keys(localStorage));
      check('isolation: an invalid storage prefix is refused (falls back to cg_)', !keys.some(k => /evil/i.test(k)) && keys.includes('cg_cliff_dev'));
      await ctx.close();
    }

    // ---------- G: zones and H: shorter repeated falls ----------
    {
      const { page, ctx, errors } = await open(browser, srv.url + V2, { manualClock: true, init: IN_PAGE + PLAY });
      const z = await page.evaluate(() => {
        const out = { zones: [] };
        for (let i = 0; i < 11; i++) { out.zones.push(getComputedStyle(document.body).backgroundImage.slice(0, 120)); window.__playGap(window.__cliff().target * 0.4); window.__next(); window.__frame(16); }
        out.cliff = window.__cliff().cliff;
        out.bodyAt = getComputedStyle(document.body).backgroundImage;
        // falls
        const t = [];
        for (let i = 0; i < 3; i++) {
          window.__playGap(-999); t.push(window.__cliff().fallTiming);
          window.__next();
        }
        out.fall = t;
        return out;
      });
      check('G (V3): one look per world: cliffs 1–10 share the Green Hills look, cliff 11 (world 2) changes it (page sides follow)', z.zones[1] === z.zones[9] && z.zones[10] !== z.zones[9], '');
      check('H: first fall full (0.45 s slow motion, 0.9 s end), later falls shorter (0.2 s, 0.45 s)', z.fall[0].slow === 0.45 && z.fall[0].end === 0.9 && z.fall[1].slow === 0.2 && z.fall[2].end === 0.45, JSON.stringify(z.fall) + ' cliff ' + z.cliff);
      check('no page errors (zones, falls)', errors.length === 0, errors.join('|'));
      // quick retry: during a fall, a tap after 0.3 s starts the next round
      const q = await page.evaluate(() => { localStorage.setItem('cg3_cliff_rewards', JSON.stringify({ day: new Date(Date.now()).toISOString().slice(0, 10), rescue: 2 })); /* no rescue offer here: plain quick retry */ const s0 = window.__cliff(); const tp = window.__T(); window.__ptr('pointerdown', tp); for (let i = 0; i < 400 && window.__cliff().state !== 'falling'; i++) window.__frame(16); window.__frame(16); for (let i = 0; i < 20; i++) window.__frame(16); window.__ptr('pointerdown', window.__T()); window.__ptr('pointerup', window.__T()); return window.__cliff().state; });
      check('H: tap during a fall (after 0.3 s, no rescue offered) → next round right away', q === 'ready', q);
      await ctx.close();
    }

    // ---------- night zone screenshot for the report (visual check) ----------
    {
      const { page, ctx, errors } = await open(browser, srv.url + V2, { manualClock: true, init: IN_PAGE + PLAY, context: { viewport: { width: 540, height: 960 }, deviceScaleFactor: 1 } });
      await page.evaluate(() => { localStorage.setItem('cg3_cliff_cur', '11'); localStorage.setItem('cg3_cliff_cp', '11'); localStorage.setItem('cg3_cliff_bestcliff', '11'); });
      await page.reload(); await page.waitForFunction(() => typeof window.__cliff === 'function');
      await page.evaluate(() => { for (let i = 0; i < 3; i++) window.__frame(16); });
      const dir = process.env.SHOTS; if (dir) await page.screenshot({ path: dir + '/zone_night_ready.png' });
      const st = await page.evaluate(() => ({ cliff: window.__cliff().cliff }));
      check('G: night zone (cliff 11) draws without errors', st.cliff === 11 && errors.length === 0);
      await ctx.close();
    }
  } finally {
    await browser.close();
    srv.close();
  }
  process.exit(summary() ? 1 : 0);
})();

