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
  window.__next = () => { window.__advance(400); window.__tap(270, 600); };`;
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
        const r = await page.evaluate(() => { for (let k = 0; k < 3; k++) { window.__play(-999); window.__next(); } return window.__cliff().cliff; });
        out.push([cur, r]); await ctx.close();
      }
      check('losing all 3 hearts goes back to a checkpoint in the same world, never an earlier world',
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
  } finally { await b.close(); srv.close(); }
  process.exit(summary() ? 1 : 0);
})();
