// V4 images: they load from inside the single game file (no network), the car picture is used for the
// default car, other car colours keep the drawn car, and a full round plays without errors.
// Usage: node tests/art.test.js
const { chromium, serve, check, summary, open, IN_PAGE } = require('./lib');
const fs = require('fs'), path = require('path');
const PAGE = process.env.PAGE || '/platform/crazygames-v3/index.html';
const v3src = fs.readFileSync(path.join(__dirname, 'v3.test.js'), 'utf8');
const HELP = v3src.slice(v3src.indexOf('const HELP = `') + 14, v3src.indexOf('`;', v3src.indexOf('const HELP = `')));

(async () => {
  const srv = await serve(8860);
  const b = await chromium.launch();
  try {
    const { page, ctx, errors, external } = await open(b, srv.url + PAGE, { manualClock: true, init: IN_PAGE + HELP });
    await page.waitForFunction(() => { const a = window.__art(); return a.car && a.wheel && a.bg1; }, null, { timeout: 5000 }).catch(() => {});
    await page.waitForFunction(() => window.__art().all, null, { timeout: 8000 }).catch(() => {});
    const a = await page.evaluate(() => window.__art());
    check('car, wheel, and both worlds (background + rock) load from inside the game file', a.car && a.wheel && a.bg1 && a.rock1 && a.bg2 && a.rock2, JSON.stringify(a));
    check('every picture in the game file loads (' + a.count + ')', a.all && a.count >= 8, JSON.stringify(a));
    check('Green Hills uses its painted world', a.world === 1);
    check('the default car uses the picture', a.carArt);
    const r = await page.evaluate(() => { const x = window.__play(3); window.__next(); const y = window.__play(-999); return { cleared: x.cleared, fell: y.state }; });
    check('a stop and a fall play normally with the pictures', r.cleared && r.fell === 'fell', JSON.stringify(r));
    const m0 = await page.evaluate(() => window.__art());
    check('both music tracks are inside the game file', m0.musicData === 2, String(m0.musicData));
    check('after the first tap the main music plays', m0.music === 'main', String(m0.music));
    const perfect = await page.evaluate(() => { window.__next(); const x = window.__play(1); return { stars: x.stars, flash: !!x.flashAt }; });
    check('a perfect stop (3 stars) flashes the screen', perfect.stars === 3 && perfect.flash, JSON.stringify(perfect));
    check('no network requests (pictures are inside the file)', external.length === 0, external.join(' '));
    check('no page errors', errors.length === 0, errors.join(' | '));
    const size = fs.statSync(path.join(__dirname, '..', PAGE.slice(1))).size;
    check('game file stays light (under 2.5 MB with the music: about 2 s on a phone network)', size < 2500 * 1024, Math.round(size / 1024) + ' KB');
    await ctx.close();
    // garage: cars for coins, saved on the device, looks only (same stop with every car)
    {
      const seed = `localStorage.setItem('cg3_cliff_cur','3');localStorage.setItem('cg3_cliff_cp','1');localStorage.setItem('cg3_cliff_bestcliff','3');localStorage.setItem('cg3_cliff_rounds','9');localStorage.setItem('cg3_cliff_coins','500');`;
      const { page, ctx, errors } = await open(b, srv.url + PAGE, { manualClock: true, init: IN_PAGE + HELP + seed });
      await page.waitForFunction(() => window.__art().all, null, { timeout: 8000 }).catch(() => {});
      check('all six cars have their picture', await page.evaluate(() => window.__art().cars) === 6);
      const before = await page.evaluate(() => { const x = window.__play(4); return x.result; });
      const r = await page.evaluate(() => {
        window.__next(); window.__garage.open(); window.__frame(16);
        window.__tap(140 + 260, 250 + 230 * 2);          // RACER, 1000 coins: not enough
        const poor = window.__garage.state();
        window.__tap(140 + 260, 250 + 230);              // TAXI, 450 coins: bought and in use
        const rich = window.__garage.state();
        window.__tap(70, 54);                            // back to the map
        return { poor, rich, back: window.__garage.state().screen };
      });
      check('a car you cannot afford is not bought (coins unchanged)', r.poor.coins < 1000 && !r.poor.owned.includes('lava'), JSON.stringify(r.poor));
      check('buying a car spends its price, keeps it and puts it in use', r.rich.coins === r.poor.coins - 450 && r.rich.owned.includes('sunny') && r.rich.skin === 'sunny', JSON.stringify(r.rich));
      check('back button returns to the map', r.back === 'map');
      await page.reload(); await page.waitForFunction(() => typeof window.__cliff === 'function');
      const kept = await page.evaluate(() => window.__garage.state());
      check('the car you chose and the cars you own are kept after reopening', kept.skin === 'sunny' && kept.owned.includes('sunny'), JSON.stringify(kept));
      check('no page errors (garage)', errors.length === 0, errors.join(' | '));
      await ctx.close();
    }
    // physics never reads the car: the same press gives the same stop with any car
    {
      const res = [];
      for (const car of ['pinky', 'lava']) {
        const seed = `localStorage.setItem('cg3_cliff_cur','3');localStorage.setItem('cg3_cliff_cp','1');localStorage.setItem('cg3_cliff_bestcliff','3');localStorage.setItem('cg3_cliff_rounds','9');localStorage.setItem('cg3_cliff_owned','["pinky","lava"]');localStorage.setItem('cg3_cliff_skin','"${car}"');`;
        const { page, ctx } = await open(b, srv.url + PAGE, { manualClock: true, init: IN_PAGE + HELP + seed });
        res.push(await page.evaluate(() => [window.__garage.state().skin, window.__play(4).result]));
        await ctx.close();
      }
      check('same press, same stop with any car (looks only)', res[0][1] === res[1][1] && res[0][0] === 'pinky' && res[1][0] === 'lava', JSON.stringify(res));
    }
    // each painted world uses its own pictures, and a fall there plays normally
    for (const [cur, cp, n, name] of [[12, 11, 2, 'Desert'], [22, 21, 3, 'Snow Mountain'], [30, 26, 3, 'Snow boss at night'], [32, 31, 4, 'Moon'], [42, 41, 5, 'Volcano'], [48, 46, 5, 'Volcano boss']]) {
      const seed = `localStorage.setItem('cg3_cliff_cur','${cur}');localStorage.setItem('cg3_cliff_cp','${cp}');localStorage.setItem('cg3_cliff_bestcliff','${cur}');localStorage.setItem('cg3_cliff_rounds','9');`;
      const { page, ctx, errors } = await open(b, srv.url + PAGE, { manualClock: true, init: IN_PAGE + HELP + seed });
      await page.waitForFunction(() => window.__art().all, null, { timeout: 8000 }).catch(() => {});
      const w = await page.evaluate(() => window.__art().world);
      check(name + ' uses its painted world', w === n, String(w));
      const r = await page.evaluate(() => window.__play(-999).state);
      check('a fall plays normally (' + name + ')', r === 'fell', r);
      if (name === 'Volcano boss' || name === 'Snow boss at night') check('boss battle switches to the boss music (' + name + ')', await page.evaluate(() => { window.__frame(16); return window.__art().music; }) === 'boss');
      check('no page errors (' + name + ')', errors.length === 0, errors.join(' | '));
      await ctx.close();
    }
  } finally { await b.close(); srv.close(); }
  process.exit(summary() ? 1 : 0);
})();
