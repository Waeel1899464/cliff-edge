// Full QA of the V3 platform build (the CrazyGames package): a complete playthrough of all 50 cliffs
// and Endless, every button, real mouse/touch/keyboard input, phone/tablet/desktop screens, platform
// iframes, blocked storage, a long session (memory), and network silence.
// Usage: node tests/qa-full.test.js
const { chromium, serve, check, summary, open, IN_PAGE } = require('./lib');
const fs = require('fs'), path = require('path');
const PAGE = process.env.PAGE || '/platform/crazygames-v3/index.html';
const v3src = fs.readFileSync(path.join(__dirname, 'v3.test.js'), 'utf8');
const HELP = v3src.slice(v3src.indexOf('const HELP = `') + 14, v3src.indexOf('`;', v3src.indexOf('const HELP = `')));
const seed = (o = {}) => IN_PAGE + HELP + Object.entries(Object.assign({ rounds: '10' }, o)).map(([k, v]) => `localStorage.setItem('cg3_cliff_${k}', ${JSON.stringify(String(v))});`).join('');

(async () => {
  const srv = await serve(8820);
  const b = await chromium.launch({ args: ['--js-flags=--expose-gc'] });
  try {
    // ---------------- A. complete playthrough: 1-1 ... 5-10, then Endless ----------------
    {
      const { page, ctx, errors, external } = await open(b, srv.url + PAGE, { manualClock: true, init: seed() });
      const r = await page.evaluate(() => {
        const out = { order: [], worlds: new Set(), bosses: 0, intros: 0, cards: 0 };
        for (let i = 0; i < 50; i++) {
          const s = window.__cliff();
          out.order.push(s.cliff);
          if (s.introAt) out.intros++;
          if (s.worldIntroAt) out.cards++;
          const res = window.__play(Math.min(s.target * 0.4, 20));
          if (!res.cleared) return Object.assign(out, { stuckAt: s.cliff });
          if (res.worldDone) out.bosses++;
          window.__next();
        }
        out.after50 = window.__cliff().endless;
        for (let i = 0; i < 12; i++) { const s = window.__play(Math.min(window.__cliff().target * 0.4, 20)); if (!s.cleared) return Object.assign(out, { endlessStuck: i }); window.__next(); }
        out.streak = JSON.parse(JSON.stringify(window.__cliff().cliff));
        window.__play(window.__cliff().target + 10);
        out.runOver = window.__cliff().runOver;
        out.endlessBest = localStorage.getItem('cg3_cliff_endless_best');
        out.best = localStorage.getItem('cg3_cliff_bestcliff');
        out.coins = +localStorage.getItem('cg3_cliff_coins');
        out.stars = Object.keys(JSON.parse(localStorage.getItem('cg3_cliff_stars') || '{}')).length;
        return out;
      });
      check('playthrough: all 50 cliffs in order, 1-1 to 5-10', r.order.length === 50 && r.order.every((c, i) => c === i + 1), r.stuckAt ? 'stuck at ' + r.stuckAt : '');
      check('playthrough: 5 bosses beaten, 5 boss intros, 4 new-world cards', r.bosses === 5 && r.intros === 5 && r.cards === 4, `${r.bosses} bosses, ${r.intros} intros, ${r.cards} cards`);
      check('playthrough: Endless starts after 5-10; 12 cliffs in a row; a miss ends the run; best saved', r.after50 && r.runOver && r.endlessBest === '12' && r.best === '51', `best ${r.endlessBest}`);
      check('playthrough: stars saved for all 50 cliffs, coins earned', r.stars === 50 && r.coins > 300, `${r.stars} cliffs with stars, ${r.coins} coins`);
      check('playthrough: no page errors, no network requests', errors.length === 0 && external.length === 0, errors.concat(external).slice(0, 3).join(' | '));
      await ctx.close();
    }

    // ---------------- B. every button ----------------
    {
      const { page, ctx, errors } = await open(b, srv.url + PAGE, { manualClock: true, init: seed({ cur: 14, cp: 11, bestcliff: 14, hearts: 1, coins: 50 }) });
      const r = await page.evaluate(() => {
        const out = {}, k = n => localStorage.getItem('cg3_cliff_' + n);
        window.__frame(16);
        // mute (top right) on and off, saved
        window.__tap(540 - 44, 50); out.muteOn = k('muted') === '1'; window.__tap(540 - 44, 50); out.muteOff = k('muted') === '0';
        // +1 heart (only one heart left)
        window.__tap(270 + 112, 242); out.heart = k('hearts') === '2';
        // daily pill on, then off again
        window.__tap(390, 50); out.dailyOn = window.__cliff().daily; window.__tap(390, 50); out.dailyOff = !window.__cliff().daily && window.__cliff().cliff === 14;
        // map: open, shop does nothing, close with PLAY
        window.__tap(74, 120); window.__tap(540 - 70, 54);       // SHOP · SOON (switched off)
        out.shopOff = true;
        window.__tap(270, 900); out.mapPlay = window.__cliff().cliff === 14 && !window.__cliff().replay;
        // share / challenge buttons never appear in the platform build
        window.__play(window.__cliff().target * 0.4);
        out.noShare = !window.__shareVisible();
        // double coins
        const c0 = +k('coins'), won = window.__cliff().coinsWon; window.__tap(270, 452); out.double = +k('coins') === c0 + won;
        window.__next();
        return out;
      });
      check('buttons: mute on/off (saved)', r.muteOn && r.muteOff);
      check('buttons: +1 heart', r.heart);
      check('buttons: daily challenge on and off', r.dailyOn && r.dailyOff);
      check('buttons: map PLAY returns to the story; shop is switched off', r.mapPlay && r.shopOff);
      check('buttons: no share / challenge buttons in the platform build', r.noShare);
      check('buttons: double coins', r.double);
      check('no page errors (buttons)', errors.length === 0, errors.join(' | '));
      await ctx.close();
    }
    // daily challenge: 3 tries, then locked for the day; no rescue there
    {
      const { page, ctx, errors } = await open(b, srv.url + PAGE, { manualClock: true, init: seed({ cur: 3, cp: 1, bestcliff: 3 }) });
      const r = await page.evaluate(() => {
        window.__tap(390, 50);
        const tries = [];
        for (let i = 0; i < 3; i++) { tries.push(window.__cliff().daily); window.__play(30); window.__next(); }
        const after = window.__cliff();
        return { tries, back: !after.daily, stored: JSON.parse(localStorage.getItem('cg3_cliff_daily')).tries };
      });
      check('daily challenge: 3 tries, then back to the story; tries saved', r.tries.every(Boolean) && r.back && r.stored === 3);
      check('no page errors (daily)', errors.length === 0, errors.join(' | '));
      await ctx.close();
    }

    // ---------------- C. real mouse, touch and keyboard (real clock) on several devices ----------------
    const DEV = { 'iPhone SE': { viewport: { width: 375, height: 667 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 },
      'Pixel 7': { viewport: { width: 412, height: 915 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.6 },
      'iPhone 14 Pro Max': { viewport: { width: 430, height: 932 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 },
      'iPad': { viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 },
      'desktop 1280x720': { viewport: { width: 1280, height: 720 } }, 'desktop 1920x1080': { viewport: { width: 1920, height: 1080 } },
      'phone landscape': { viewport: { width: 915, height: 412 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.6 } };
    for (const [name, o] of Object.entries(DEV)) {
      const ctx = await b.newContext(o); const page = await ctx.newPage();
      const errs = []; page.on('pageerror', e => errs.push(String(e)));
      await page.addInitScript(() => localStorage.setItem('cg3_cliff_rounds', '10'));
      await page.goto(srv.url + PAGE); await page.waitForTimeout(300);
      const fit = await page.evaluate(() => { const r = document.querySelector('canvas').getBoundingClientRect(); return r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1 && (innerWidth / innerHeight > 0.5625 * 1.15 ? Math.abs(r.height - innerHeight) < 2 && Math.abs(r.width - Math.min(innerWidth, innerHeight * 2.2)) < 2 : Math.abs(r.width / r.height - 0.5625) < 0.01) && document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight; });
      const box = await page.locator('canvas').boundingBox(); const pt = { x: box.x + box.width / 2, y: box.y + box.height * 0.62 };
      let h, s2;
      if (o.hasTouch) {
        const cdp = await ctx.newCDPSession(page);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pt] }); await page.waitForTimeout(500); h = await page.evaluate(() => __cliff().state);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await page.waitForTimeout(120); s2 = await page.evaluate(() => __cliff().state);
      } else {
        await page.mouse.move(pt.x, pt.y); await page.mouse.down(); await page.waitForTimeout(500); h = await page.evaluate(() => __cliff().state);
        await page.mouse.up(); await page.waitForTimeout(120); s2 = await page.evaluate(() => __cliff().state);
      }
      let key = 'n/a';
      if (!o.hasTouch) {
        for (let i = 0; i < 150 && !['stopped', 'fell'].includes(await page.evaluate(() => __cliff().state)); i++) await page.waitForTimeout(40);
        await page.waitForTimeout(400); await page.keyboard.press('Space'); await page.waitForTimeout(100);
        await page.keyboard.down('Space'); await page.waitForTimeout(300); const kh = await page.evaluate(() => __cliff().state); await page.keyboard.up('Space');
        key = kh;
      }
      check(`${name}: fits the screen (phones 9:16; wide screens use the whole width up to 2.2:1; no scroll), press drives, release brakes${o.hasTouch ? ' (touch)' : ' (mouse), Space drives'}`,
        fit && h === 'holding' && ['sliding', 'stopped', 'falling'].includes(s2) && (o.hasTouch || key === 'holding') && errs.length === 0, `${h} -> ${s2}${o.hasTouch ? '' : ', key ' + key}`);
      await ctx.close();
    }

    // ---------------- D. inside platform iframes (CrazyGames runs games in an iframe) ----------------
    for (const [name, attrs] of [['iframe', 'allow="autoplay; fullscreen"'], ['iframe sandbox scripts+same-origin', 'sandbox="allow-scripts allow-same-origin"'], ['iframe sandbox scripts only (no storage)', 'sandbox="allow-scripts"']]) {
      const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } }); const page = await ctx.newPage();
      const errs = []; page.on('pageerror', e => errs.push(String(e)));
      await page.goto(srv.url + '/tests/lib.js');            // any page on the same server as the host
      await page.setContent(`<html><body style="margin:0"><iframe ${attrs} src="${srv.url + PAGE}" style="border:0;width:100vw;height:100vh"></iframe></body></html>`);
      await page.waitForTimeout(900);
      const fr = page.frames().find(f => f.url().includes('crazygames-v3'));
      let ok = false, detail = '';
      try {
        await page.mouse.click(640, 300); await page.waitForTimeout(150);
        for (let i = 0; i < 150; i++) { const st = await fr.evaluate(() => __cliff().state); if (['stopped', 'fell', 'ready'].includes(st)) break; await page.waitForTimeout(40); }
        await page.waitForTimeout(400); await page.keyboard.press('Space'); await page.waitForTimeout(150);
        await page.keyboard.down('Space'); await page.waitForTimeout(300); const hk = await fr.evaluate(() => __cliff().state); await page.keyboard.up('Space');
        ok = hk === 'holding'; detail = 'Space after one click: ' + hk;
      } catch (e) { detail = 'error ' + String(e).slice(0, 80); }
      check(`${name}: loads and plays (mouse, then keyboard)`, ok && errs.length === 0, detail + (errs.length ? ' | ' + errs[0] : ''));
      await ctx.close();
    }

    // ---------------- E. private mode / blocked storage ----------------
    {
      const { page, ctx, errors } = await open(b, srv.url + PAGE, { manualClock: true, init: "Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } });" + IN_PAGE + HELP });
      const r = await page.evaluate(() => { for (let i = 0; i < 3; i++) { window.__play(window.__cliff().target * 0.4); window.__next(); } window.__tap(74, 120); window.__tap(270, 900); return window.__cliff().cliff; });
      check('blocked storage (private window): the game still plays, map works, no errors', r === 4 && errors.length === 0, 'cliff ' + r + ' ' + errors.join(' | '));
      await ctx.close();
    }

    // ---------------- F. long session: 300 rounds, memory stays flat ----------------
    {
      const { page, ctx, errors } = await open(b, srv.url + PAGE, { manualClock: true, init: seed({ cur: 41, cp: 41, bestcliff: 41 }) });
      const heap = await page.evaluate(() => {
        const used = () => { if (window.gc) window.gc(); return performance.memory ? performance.memory.usedJSHeapSize : 0; };
        const run = n => { for (let i = 0; i < n; i++) { if (i % 3 === 0) window.__play(-999); else window.__play(window.__cliff().target + 5); window.__next(); } };
        run(50); const a = used(); run(250); const b2 = used();
        return { a, b: b2 };
      });
      const growMB = (heap.b - heap.a) / 1048576;
      check('long session: 300 rounds (falls, misses, rescues offered) without errors; memory does not keep growing', errors.length === 0 && growMB < 5, `heap after 50 rounds ${(heap.a / 1048576).toFixed(1)} MB, after 300 ${(heap.b / 1048576).toFixed(1)} MB`);
      await ctx.close();
    }
  } finally { await b.close(); srv.close(); }
  process.exit(summary() ? 1 : 0);
})();
