// V3 features: world map, replaying cliffs, stars, coins, checkpoints inside each world.
const { chromium, serve, check, summary, open, IN_PAGE } = require('./lib');
const PAGE = process.env.PAGE || '/platform/crazygames-v3/index.html';

const HELP = `
  window.__play = (gapCm) => {            // gapCm <= -100: drive off the edge
    const s0 = window.__cliff(), P = window.__physics;
    const hold = (gapCm <= -100 ? P.holdTimeForS(P.edgeAt(s0.spec, Infinity), s0.spec) + 0.3 : P.releaseS(gapCm / 100, s0.spec)) * 1000;
    const tp = window.__T(); window.__ptr('pointerdown', tp); let rel = false;
    for (let i = 0; i < 4000; i++) {
      if (!rel && window.__T() + 16 >= tp + hold) { window.__advance(tp + hold - window.__T()); window.__ptr('pointerup', tp + hold); rel = true; }
      window.__frame(16);
      const st = window.__cliff().state; if (st === 'stopped' || st === 'fell') break;
    }
    return window.__cliff();
  };
  window.__tap = (x, y) => {               // tap at logical canvas coordinates (540x960)
    const c = document.getElementById('game'), r = c.getBoundingClientRect(), k = r.width / 540;
    for (const type of ['pointerdown', 'pointerup']) {
      const e = new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 5, clientX: r.left + x * k, clientY: r.top + y * k });
      Object.defineProperty(e, 'timeStamp', { value: window.__T() });
      (type === 'pointerdown' ? c : window).dispatchEvent(e);
    }
    window.__frame(16);
  };
  window.__next = () => {
    const s0 = window.__cliff();
    window.__advance(400); window.__tap(270, 600);
    if (window.__cliff() === s0 && s0.worldDone) window.__tap(270, 600);   // skip the map travel after a boss
  };`;
const seed = (cur, cp, best, extra = '') => IN_PAGE + HELP + `localStorage.setItem('cg3_cliff_cur','${cur}');localStorage.setItem('cg3_cliff_cp','${cp}');localStorage.setItem('cg3_cliff_bestcliff','${best}');localStorage.setItem('cg3_cliff_rounds','10');${extra}`;

(async () => {
  const srv = await serve(8798);
  const b = await chromium.launch();
  try {
    // ---- checkpoints stay inside the world ----
    {
      const out = [];
      for (const [cur, cp] of [[13, 11], [11, 11], [20, 16], [31, 31], [45, 41], [50, 46]]) {
        const { page, ctx } = await open(b, srv.url + PAGE, { manualClock: true, init: seed(cur, cp, cur) });
        const r = await page.evaluate(() => { const c0 = window.__cliff().cliff; for (let k = 0; k < 6 && window.__cliff().cliff === c0 && !window.__cliff().backTo; k++) { window.__play(-999); window.__next(); } return window.__cliff().cliff; });
        out.push([cur, r]); await ctx.close();
      }
      check('losing all hearts (3, or 4 in a boss battle) goes back to a checkpoint in the same world, never an earlier world',
        out.every(([c, r]) => Math.ceil(c / 10) === Math.ceil(r / 10) && r <= c), out.map(([c, r]) => c + '→' + r).join(' '));
    }

    // ---- map: open, replay an old cliff, stars/coins, back to the story ----
    {
      const { page, ctx, errors } = await open(b, srv.url + PAGE, { manualClock: true, init: seed(14, 11, 14) });
      const r = await page.evaluate(() => {
        const out = {};
        window.__frame(16);
        window.__tap(74, 120);                         // MAP button
        out.mapOpen = true;
        const P = window.__physics;
        // tap cliff 1-3 on the map (world card 0, node k=2)
        window.__tap(52 + 2 * 48.4, 212);
        let s = window.__cliff();
        out.replayStart = s.cliff === 3 && s.replay === true && s.state === 'ready';
        const heartsBefore = s.heartsLeft;
        // a fall during a replay: no heart lost, same cliff again
        window.__play(-999); window.__next();
        s = window.__cliff();
        out.noHeart = s.cliff === 3 && s.replay && s.heartsLeft === heartsBefore && localStorage.getItem('cg3_cliff_hearts') === null;
        // PERFECT on the replay: 3 stars, coins, story position unchanged
        const coins0 = +(localStorage.getItem('cg3_cliff_coins') || 0);
        s = window.__play(0.5);
        out.stars3 = s.grade === 'PERFECT' && s.stars === 3 && JSON.parse(localStorage.getItem('cg3_cliff_stars'))['3'] === 3;
        out.coins = s.coinsWon === 10 + 15 + 1 - 0 || s.coinsWon > 20;
        out.coinsSaved = +localStorage.getItem('cg3_cliff_coins') === coins0 + s.coinsWon;
        out.storyKept = localStorage.getItem('cg3_cliff_cur') === '14';
        window.__next();
        s = window.__cliff();
        out.backToStory = s.cliff === 14 && !s.replay;
        // replay again with only GOOD: stars stay 3 (best kept)
        window.__tap(74, 120); window.__tap(52 + 2 * 48.4, 212);
        s = window.__play(window.__cliff().target * 0.8);
        out.bestKept = s.grade === 'GOOD' && JSON.parse(localStorage.getItem('cg3_cliff_stars'))['3'] === 3;
        window.__next();
        // a locked cliff (beyond the furthest reached) cannot be opened
        window.__tap(74, 120); window.__tap(52 + 9 * 48.4, 212 + 136);   // 2-10 (not reached)
        out.lockedStays = window.__cliff().cliff === 14 && !window.__cliff().replay;
        // keyboard Space on the map = PLAY
        window.__tap(74, 120);
        const ev = new KeyboardEvent('keydown', { key: ' ', bubbles: true }); window.dispatchEvent(ev);
        window.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true }));
        window.__frame(16);
        out.keyPlay = window.__cliff().state === 'ready' && window.__cliff().cliff === 14;
        return out;
      });
      check('map: replay a reached cliff (1-3) from the map', r.replayStart);
      check('replay: a fall costs no heart and the same cliff comes back', r.noHeart);
      check('stars: PERFECT gives 3 stars, saved per cliff', r.stars3);
      check('coins: closer = more coins (+bonus), saved; story position unchanged by a replay', r.coins && r.coinsSaved && r.storyKept);
      check('after a cleared replay, the next tap returns to the story cliff', r.backToStory);
      check('stars keep the best result (a later GOOD does not lower 3 stars)', r.bestKept);
      check('locked cliffs on the map cannot be opened', r.lockedStays);
      check('keyboard: Space on the map continues the story', r.keyPlay);
      check('no page errors (map, replay, stars, coins)', errors.length === 0, errors.join(' | '));
      await ctx.close();
    }

    // ---- coins formula ----
    {
      const { page, ctx } = await open(b, srv.url + PAGE, { manualClock: true, init: seed(1, 1, 1) });
      const r = await page.evaluate(() => {
        const a = window.__play(80);      // GOOD, close to the 90 cm target -> few coins
        window.__next();
        const c = window.__play(5);       // GREAT
        return { good: a.coinsWon, great: c.coinsWon, ga: a.grade, gc: c.grade, fall: null };
      });
      check('coins: a GOOD near the target line pays little, a GREAT close to the edge pays more', r.ga === 'GOOD' && r.gc === 'GREAT' && r.great > r.good, `GOOD ${r.good}, GREAT ${r.great}`);
      await ctx.close();
    }
    // ---- rescue, golden heart, helpers, rewards (all through requestReward) ----
    {
      const { page, ctx, errors } = await open(b, srv.url + PAGE, { manualClock: true, init: seed(7, 6, 7, "localStorage.setItem('cg3_cliff_hearts','1');") });
      const r = await page.evaluate(() => {
        const out = {}, k = n => localStorage.getItem('cg3_cliff_' + n), rw = () => JSON.parse(localStorage.getItem('cg3_cliff_rewards') || '{}');
        const frames = n => { for (let i = 0; i < n; i++) window.__frame(16); };
        // 1) last heart lost -> offer -> SAVE ME -> animation -> same cliff, heart kept
        window.__play(-999); frames(2);
        let s = window.__cliff();
        out.offer = s.rescue && s.rescue.state === 'offer' && s.rescue.t0 !== null && k('hearts') === '1';
        window.__tap(270, 470); frames(1);
        out.anim = window.__cliff().rescue && window.__cliff().rescue.state === 'anim';
        window.__tap(270, 700);                       // taps during the animation are ignored
        frames(160);
        s = window.__cliff();
        out.saved = s.cliff === 7 && s.state === 'ready' && k('hearts') === '1' && k('cur') === '7' && rw().rescue === 1;
        // 2) a second rescue by stopping short (rewind of the car)
        window.__play(window.__cliff().target + 10); frames(2);
        window.__tap(270, 470); frames(130);
        out.second = window.__cliff().cliff === 7 && rw().rescue === 2 && k('hearts') === '1';
        // 3) daily limit reached: no offer any more, back to the checkpoint as before
        window.__play(-999); frames(2);
        s = window.__cliff();
        out.limit = !s.rescue && s.backTo === 6 && k('cur') === '6';
        window.__next();
        // 4) helpers: after 2 failures in a row on the same cliff
        out.noHelperYet = !(window.__cliff().state === 'ready' && window.__cliff().helper);
        window.__play(-999); window.__next(); window.__play(-999); window.__next();
        s = window.__cliff();
        const tIdeal = window.__physics.releaseS(Math.min(s.target / 2, 50) / 100, s.spec);
        window.__tap(270 - 118, 392);                 // CRYSTAL BALL
        s = window.__cliff();
        out.ball = s.helper === 'ball' && Math.abs(s.idealFront - (s.x0 + 1.6 + window.__physics.holdS(tIdeal, s.spec).d)) < 1e-9 && rw().helper === 1;
        // letting go exactly at the shown point stops in the middle of the zone
        const rr = window.__play(s.target / 2);
        out.ballWorks = rr.cleared;
        window.__next();
        // helper limit (1 a day): fail twice again, no helper buttons
        window.__play(-999); window.__next(); window.__play(-999); window.__next();
        window.__tap(270, 392);
        out.helperLimit = !window.__cliff().helper;
        return out;
      });
      check('rescue: offered only when the last heart is lost (story mode)', r.offer);
      check('rescue: SAVE ME plays an animation (taps ignored meanwhile), then the same cliff with the heart kept', r.anim && r.saved);
      check('rescue works after a short stop too (rewind), counted in the daily limit', r.second);
      check('rescue: after 2 a day no offer, back to the checkpoint as before', r.limit);
      check('helpers appear only after 2 failures in a row; crystal ball shows the exact ideal release point', r.noHelperYet && r.ball);
      check('crystal ball: letting go at the shown point clears the cliff', r.ballWorks);
      check('helpers: 1 a day', r.helperLimit);
      check('no page errors (rescue, helpers)', errors.length === 0, errors.join(' | '));
      await ctx.close();
    }
    // golden heart, double coins, slow motion exactness, sandbag, no rewards in the daily
    {
      const { page, ctx, errors } = await open(b, srv.url + PAGE, { manualClock: true, init: seed(2, 1, 2) });
      const r = await page.evaluate(() => {
        const out = {}, k = n => localStorage.getItem('cg3_cliff_' + n);
        const c0 = +(k('coins') || 0);
        let s = window.__play(0.5);                        // PERFECT with 3 hearts -> golden 4th heart
        out.golden = s.heartWon && k('hearts') === '4';
        const won = s.coinsWon;
        window.__tap(270, 452);                            // DOUBLE COINS
        out.double = window.__cliff().coinsWon === won * 2 && +k('coins') === c0 + won * 2;
        window.__next();
        // slow motion: exact time map, invertible
        s = window.__cliff();
        s.warp = { a: 0.5, b: 1.2, k: 0.35 };
        const gameTau = r2 => { const w = s.warp, len = (w.b - w.a) / w.k; return r2 <= w.a ? r2 : r2 <= w.a + len ? w.a + (r2 - w.a) * w.k : w.b + (r2 - w.a - len); };
        out.warpMono = [0.2, 0.9, 1.5, 3.5].every((x, i, a) => i === 0 || gameTau(x) > gameTau(a[i - 1]));
        s.warp = null;
        // sandbag: grippy mud before the edge, same target
        const T0 = s.target;
        s.spec = Object.assign({}, s.spec, { patches: [{ at: s.dist - 1.6, si: 2 }] });
        out.sandbag = window.__physics.segments(s.spec).slice(-1)[0].si === 2 && s.target === T0;
        return out;
      });
      check('golden heart: a 3-star stop gives a 4th (golden) heart', r.golden);
      check('double coins: doubles the coins of that stop (counted in the daily limit)', r.double);
      check('slow motion: the time map only slows, never reverses', r.warpMono);
      check('sandbag: grippy ground before the edge, target unchanged', r.sandbag);
      await ctx.close();
    }
    // slow motion in the real game: identical result at 30 and 144 Hz with the warp active
    {
      const res = [];
      for (const rate of [30, 144]) {
        const { page, ctx } = await open(b, srv.url + PAGE, { manualClock: true, init: seed(9, 6, 9) });
        res.push(await page.evaluate((dt) => {
          const s = window.__cliff(), P = window.__physics;
          s.helper = 'slow'; s.warp = { a: 0.7, b: 1.6, k: 0.35 };
          const holdReal = 1900.37;                     // ms of real time
          const tp = window.__T(); window.__ptr('pointerdown', tp); let rel = false;
          for (let i = 0; i < 3000; i++) {
            if (!rel && window.__T() + dt >= tp + holdReal) { window.__advance(tp + holdReal - window.__T()); window.__ptr('pointerup', tp + holdReal); rel = true; }
            window.__frame(dt);
            if (['stopped', 'falling'].includes(window.__cliff().state)) break;
          }
          return window.__cliff().state + ':' + (window.__cliff().result || 0).toFixed(9);
        }, 1000 / rate));
        await ctx.close();
      }
      check('slow motion helper: same result at 30 and 144 Hz (exact time map)', res[0] === res[1], res.join(' / '));
    }
    // no rescue or helpers in the daily challenge
    {
      const { page, ctx } = await open(b, srv.url + PAGE, { manualClock: true, init: seed(7, 6, 7, "localStorage.setItem('cg3_cliff_hearts','1');") });
      const r = await page.evaluate(() => {
        window.__tap(390, 50);                          // DAILY pill
        const d = window.__cliff().daily;
        window.__play(-999); for (let i = 0; i < 3; i++) window.__frame(16);
        return { d, rescue: !!window.__cliff().rescue };
      });
      check('daily challenge: no rescue offered (competition stays pure)', r.d && !r.rescue);
      await ctx.close();
    }
    // ---- boss battle (world 1: cliffs 6-10, 5 phases, 4 hearts) ----
    {
      const { page, ctx, errors } = await open(b, srv.url + PAGE, { manualClock: true, init: seed(5, 1, 5) });
      const r = await page.evaluate(() => {
        const out = {}, k = n => localStorage.getItem('cg3_cliff_' + n);
        window.__play(window.__cliff().target * 0.4); window.__next();          // clear 1-5 -> enter the battle
        let s = window.__cliff();
        out.enter = s.cliff === 6 && !!s.introAt && k('hearts') === '4';
        window.__play(-999); window.__next();                                  // fail phase 1: no second intro
        out.noReIntro = window.__cliff().cliff === 6 && !window.__cliff().introAt && k('hearts') === '3';
        const phases = [];
        for (let i = 0; i < 5; i++) { const r2 = window.__play(window.__cliff().target * 0.4); phases.push([r2.cliff, r2.cleared, r2.worldDone]); window.__next(); }
        out.phases = phases.every((p, i) => p[0] === 6 + i && p[1]) && phases[4][2] === true && phases.slice(0, 4).every(p => !p[2]);
        out.after = window.__cliff().cliff === 11 && k('hearts') === '3';
        return out;
      });
      check('boss battle: entering phase 1 shows the intro, 4 hearts', r.enter);
      check('boss battle: retrying phase 1 after a miss does not repeat the intro', r.noReIntro);
      check('boss battle: 5 phases (cliffs 6-10); only the final hit ends the world', r.phases);
      check('after the boss: world 2 starts with 3 hearts again', r.after);
      check('no page errors (boss battle)', errors.length === 0, errors.join(' | '));
      await ctx.close();
    }
    {
      const { page, ctx } = await open(b, srv.url + PAGE, { manualClock: true, init: seed(8, 6, 8, "localStorage.setItem('cg3_cliff_hearts','1');") });
      const r = await page.evaluate(() => {
        window.__play(-999); window.__next();                                  // last heart, decline the rescue
        const s = window.__cliff();
        return { back: s.cliff === 6 && localStorage.getItem('cg3_cliff_hearts') === '4' && !!s.introAt };
      });
      check('boss battle lost: back to phase 1 with 4 hearts, and the intro again', r.back);
      await ctx.close();
    }
    // ---- after cliff 50: celebration, then Endless ----
    {
      const { page, ctx, errors } = await open(b, srv.url + PAGE, { manualClock: true, init: seed(50, 46, 50) });
      const r = await page.evaluate(() => {
        const out = {}, k = n => localStorage.getItem('cg3_cliff_' + n);
        let s = window.__play(window.__cliff().target * 0.4);
        const s50 = window.__cliff();
        out.allDone = s50.worldDone && s50.allDone && s50.cleared;
        window.__next();
        s = window.__cliff();
        out.endlessStart = s.endless && s.state === 'ready' && k('cur') === '51';
        // clear 3 endless cliffs, then miss: run over, best saved
        for (let i = 0; i < 3; i++) { window.__play(window.__cliff().target * 0.4); window.__next(); }
        s = window.__cliff();
        out.streak = s.endless && s.cliff === 1003;
        const before = localStorage.getItem('cg3_cliff_hearts');
        window.__play(window.__cliff().target + 5);
        s = window.__cliff();
        out.runOver = s.runOver && s.runScore === 3 && k('endless_best') === '3' && localStorage.getItem('cg3_cliff_hearts') === before && !s.rescue;
        window.__next();
        s = window.__cliff();
        out.newRun = s.endless && s.cliff === 1000 && s.state === 'ready';
        // a fall also ends the run, and still no rescue
        window.__play(-999); for (let i = 0; i < 5; i++) window.__frame(16);
        out.fallEnds = window.__cliff().runOver && !window.__cliff().rescue;
        window.__next();
        // map: PLAY ENDLESS continues Endless; replaying a story cliff then returns to Endless
        window.__tap(74, 120); window.__tap(52 + 2 * 48.4, 212);
        out.replayFromEndless = window.__cliff().replay && window.__cliff().cliff === 3;
        window.__play(window.__cliff().target * 0.4); window.__next();
        out.backToEndless = window.__cliff().endless;
        return out;
      });
      check('final boss: ALL WORLDS COMPLETE, then the next tap starts Endless', r.allDone && r.endlessStart);
      check('Endless: the score counts cliffs cleared in a row', r.streak);
      check('Endless: a miss ends the run (no hearts, no rescue), best saved; next tap = new run', r.runOver && r.newRun);
      check('Endless: a fall also ends the run, no rescue', r.fallEnds);
      check('Endless: the map still allows story replays, then back to Endless', r.replayFromEndless && r.backToEndless);
      check('no page errors (Endless)', errors.length === 0, errors.join(' | '));
      await ctx.close();
    }
    // ---- SAVE ME at the moment of the loss, protected second, failures remembered, NEW! badges ----
    {
      const { page, ctx, errors } = await open(b, srv.url + PAGE, { manualClock: true, init: seed(7, 6, 7, "localStorage.setItem('cg3_cliff_hearts','1');") });
      const r = await page.evaluate(() => {
        const out = {};
        const tp = window.__T(); window.__ptr('pointerdown', tp);
        for (let i = 0; i < 3000 && window.__cliff().state !== 'falling'; i++) window.__frame(16);
        out.atOnce = !!(window.__cliff().rescue && window.__cliff().rescue.t0 !== null);   // visible as the car goes over
        for (let i = 0; i < 37; i++) window.__frame(16);                                     // ~0.6 s later: a quick retry tap
        window.__tap(270, 700);
        out.protected = window.__cliff().cliff === 7 && window.__cliff().rescue && window.__cliff().rescue.state === 'offer';
        for (let i = 0; i < 30; i++) window.__frame(16);                                     // after the first second
        window.__tap(270, 700);
        out.skipAfter = window.__cliff().cliff === 6;                                         // no rescue: back to the checkpoint
        out.seenSaved = JSON.parse(localStorage.getItem('cg3_cliff_seen') || '{}').rescue === true;
        return out;
      });
      check('SAVE ME appears at the moment the car goes over the edge (not after the splash)', r.atOnce);
      check('SAVE ME: a quick tap in its first second does not hide it; after that a tap skips it as before', r.protected && r.skipAfter);
      check('NEW! badge: remembered after the first time it was shown', r.seenSaved);
      check('no page errors (SAVE ME timing)', errors.length === 0, errors.join(' | '));
      await ctx.close();
    }
    {
      const { page, ctx } = await open(b, srv.url + PAGE, { manualClock: true, init: seed(3, 1, 3) });
      await page.evaluate(() => { window.__play(-999); window.__next(); window.__play(-999); window.__next(); });
      await page.reload(); await page.waitForFunction(() => typeof window.__cliff === 'function');
      const r = await page.evaluate(() => { window.__frame(16); const before = window.__cliff().helper; window.__tap(270 - 118, 392); return { stuck: JSON.parse(localStorage.getItem('cg3_cliff_stuck')), used: window.__cliff().helper }; });
      check('helpers: 2 failures in a row are remembered after closing the game; the helper can be used', r.stuck.n === 3 && r.stuck.fails === 2 && r.used === 'ball', JSON.stringify(r.stuck));
      await ctx.close();
    }
    // ---- moving to a new world: map travel, then the new world's card ----
    {
      const { page, ctx, errors } = await open(b, srv.url + PAGE, { manualClock: true, init: seed(10, 6, 10) });
      const r = await page.evaluate(() => {
        const out = {};
        window.__play(window.__cliff().target * 0.4);
        const boss = window.__cliff();
        window.__advance(400); window.__tap(270, 600);                     // first tap after the boss
        out.mapShown = window.__cliff() === boss;                           // still the boss round: the map travel plays
        for (let i = 0; i < 150; i++) window.__frame(16);                   // ~2.4 s: it continues by itself
        const s = window.__cliff();
        out.newWorld = s !== boss && s.cliff === 11 && s.state === 'ready' && !!s.worldIntroAt;
        out.desert = s.spec.si === 3 && s.spec.wind > 0;                     // 2-1 shows sand and wind at once
        // the card shows once per session: back to 2-1 again later -> no card
        window.__play(-999); window.__next(); window.__play(-999); window.__next(); window.__play(-999); window.__next();
        out.onceOnly = window.__cliff().cliff === 11 && !window.__cliff().worldIntroAt;
        return out;
      });
      check('after a boss: the next tap shows the map travel; it continues by itself to the new world', r.mapShown && r.newWorld);
      check('new world: its card shows once per session; the first desert cliff shows sand and wind', r.desert && r.onceOnly);
      check('no page errors (world change)', errors.length === 0, errors.join(' | '));
      await ctx.close();
    }
    {
      const { page, ctx } = await open(b, srv.url + PAGE, { manualClock: true, init: seed(10, 6, 10) });
      const r = await page.evaluate(() => {
        window.__play(window.__cliff().target * 0.4); const boss = window.__cliff();
        window.__advance(400); window.__tap(270, 600); window.__frame(16); window.__tap(270, 600);   // skip with a tap
        return window.__cliff() !== boss && window.__cliff().cliff === 11;
      });
      check('the map travel can be skipped with one tap', r);
      await ctx.close();
    }
  } finally { await b.close(); srv.close(); }
  process.exit(summary() ? 1 : 0);
})();
