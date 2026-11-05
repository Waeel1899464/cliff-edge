// V3 website build (platform/web-v3/index.html, build with: ./build.sh web-v3).
// Checks: players start fresh (w3_ saves) and V1 saves on the phone stay untouched; tracking is
// silent unless on the real site (or ?track=1); with tracking on, every id is marked 'v3-' and every
// event name is one the database accepts (list read from metrics/v3-allow-events.sql).
// Usage: node tests/web-v3.test.js
const { chromium, serve, check, summary, open, IN_PAGE, ROOT } = require('./lib');
const fs = require('fs'), path = require('path');
const PAGE = process.env.PAGE || '/platform/web-v3/index.html';
const v3src = fs.readFileSync(path.join(__dirname, 'v3.test.js'), 'utf8');
const HELP = v3src.slice(v3src.indexOf('const HELP = `') + 14, v3src.indexOf('`;', v3src.indexOf('const HELP = `')));
const sql = fs.readFileSync(path.join(ROOT, 'metrics/v3-allow-events.sql'), 'utf8');
const ALLOWED = [...sql.slice(sql.indexOf('array[')).matchAll(/'([a-z_]+)'/g)].map(m => m[1]);

// V1 saves as a real website player has them (original key names, no prefix)
const V1 = { cliff_best: '0.4', cliff_bestcliff: '23', cliff_rounds: '310', cliff_muted: '1', cliff_dev: 'oldv1device',
  cliff_daily: JSON.stringify({ day: '2026-11-04', tries: 3, best: 2 }), cliff_streak: JSON.stringify({ last: '2026-11-04', count: 6 }) };
const seedV1 = `if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.clear();
  for (const [k, v] of Object.entries(${JSON.stringify(V1)})) localStorage.setItem(k, v); }`;

(async () => {
  const srv = await serve(8830);
  const b = await chromium.launch();
  try {
    check('the event list was read from the database file', ALLOWED.includes('open') && ALLOWED.includes('cliff_pass'), ALLOWED.join(','));
    const html = fs.readFileSync(path.join(ROOT, PAGE.slice(1)), 'utf8');
    check('website build: no CrazyGames switch, w3_ saves, v3 ids', !/CLIFF_BUILD/.test(html.slice(0, html.indexOf('<body>'))) &&
      html.includes("window.CLIFF_STORE_PREFIX = 'w3_'") && html.includes("window.CLIFF_VERSION = 'v3'"));
    check('website build keeps the share tags of the public page', html.includes('og:image') && html.includes('waeel1899464.github.io/cliff-edge/'));

    // ---- fresh start, V1 saves untouched, no tracking on a test address ----
    {
      const { page, ctx, errors, external } = await open(b, srv.url + PAGE, { manualClock: true, init: seedV1 + IN_PAGE + HELP });
      const st = await page.evaluate(() => ({ cliff: window.__cliff().cliff, hearts: window.__cliff().heartsLeft }));
      check('a V1 player starts V3 fresh: cliff 1, 3 hearts', st.cliff === 1 && st.hearts === 3, JSON.stringify(st));
      const r = await page.evaluate(() => { const a = window.__play(3); window.__next(); return { cleared: a.cleared, cliff: window.__cliff().cliff }; });
      check('playing works: cliff 1 cleared, now on cliff 2', r.cleared && r.cliff === 2, JSON.stringify(r));
      await page.evaluate(() => { window.__play(-999); window.__next(); });
      const keys = await page.evaluate(() => Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)]));
      const v1now = Object.fromEntries(keys.filter(([k]) => !k.startsWith('w3_')));
      check('V1 saves are not read, changed or deleted', JSON.stringify(v1now) === JSON.stringify(Object.fromEntries(Object.entries(V1).sort())));
      check('every V3 save is under w3_', keys.some(([k]) => k === 'w3_cliff_cur') && keys.every(([k]) => k.startsWith('w3_') || k in V1), keys.map(k => k[0]).join(','));
      await page.reload(); await page.waitForFunction(() => typeof window.__cliff === 'function');
      check('after reopening: progress kept (cliff 2)', await page.evaluate(() => window.__cliff().cliff) === 2);
      check('test address: nothing sent anywhere', external.length === 0, external.join(' '));
      check('no page errors', errors.length === 0, errors.join(' | '));
      await ctx.close();
    }

    // ---- tracking on (?track=1, as on the real site): ids and names ----
    {
      const ctx = await b.newContext({ viewport: { width: 400, height: 760 }, hasTouch: true });
      const sent = [];
      await ctx.route('https://twgbgjwweanifxngkzrd.supabase.co/**', r => { try { sent.push(JSON.parse(r.request().postData())); } catch (e) {} r.fulfill({ status: 201, body: '' }); });
      const page = await ctx.newPage(); const errors = [];
      page.on('pageerror', e => errors.push(String(e)));
      await page.addInitScript(require('./lib').MANUAL_CLOCK(Date.UTC(2026, 10, 4, 12)));
      await page.addInitScript(seedV1 + IN_PAGE + HELP);
      await page.goto(srv.url + PAGE + '?track=1');
      await page.waitForFunction(() => typeof window.__cliff === 'function');
      const passed = await page.evaluate(() => { const a = window.__play(3); window.__next(); return a.cleared; });
      await page.evaluate(() => { window.__play(-999); window.__next(); });
      await page.waitForTimeout(300);
      const ev = sent.map(x => x.event);
      check('tracking on: open + round sent', ev.includes('open') && ev.includes('round'), ev.join(','));
      check('a passed cliff sends cliff_pass with its number', passed && sent.some(x => x.event === 'cliff_pass' && x.value === 1), JSON.stringify(sent));
      check('every id is marked v3- and fits the database rules', sent.length > 0 && sent.every(x => /^v3-[a-z0-9]{12}$/.test(x.device) && /^v3-[a-z0-9]{12}$/.test(x.session)), JSON.stringify(sent[0]));
      check('the V1 device id is not reused', sent.every(x => x.device !== 'oldv1device'));
      check('every event name is accepted by the database list', sent.every(x => ALLOWED.includes(x.event)), ev.join(','));
      check('no personal data: only device, session, event, value', sent.every(x => Object.keys(x).sort().join() === 'device,event,session,value'));
      check('no page errors (tracking on)', errors.length === 0, errors.join(' | '));
      await ctx.close();
    }

    // ---- Challenge a friend: the link replays the same cliff, twists included ----
    {
      const share = `navigator.share = d => { window.__shared = d; return Promise.resolve(); };`;
      const seedAt = n => `localStorage.setItem('w3_cliff_cur','${n}');localStorage.setItem('w3_cliff_cp','${n}');localStorage.setItem('w3_cliff_bestcliff','${n}');localStorage.setItem('w3_cliff_rounds','5');`;
      const linkFrom = async (n, gap) => {
        const { page, ctx, errors } = await open(b, srv.url + PAGE, { manualClock: true, init: IN_PAGE + HELP + share + seedAt(n) });
        const r = await page.evaluate(g => { const a = window.__play(g); window.__advance(400); window.__tap(270, 784); return { cliff: a.cliff, spec: JSON.stringify(a.spec), result: a.result }; }, gap);
        await page.waitForTimeout(100);
        const url = await page.evaluate(() => window.__shared && window.__shared.url);
        await ctx.close();
        return Object.assign(r, { url, errors });
      };
      const replay = async (url) => {
        const q = url.slice(url.indexOf('?'));
        const { page, ctx, errors } = await open(b, srv.url + PAGE + q, { manualClock: true, init: IN_PAGE + HELP });
        const r = await page.evaluate(() => { const s = window.__cliff(); return { friend: !!s.friend, spec: JSON.stringify(s.spec), world: s.world, target: s.target }; });
        await ctx.close(); return Object.assign(r, { errors });
      };
      const A = await linkFrom(11, 4);            // Desert 2-1: sand + wind
      check('story link names the cliff (c=n11) and the score', /[?&]c=n11&s=\d+$/.test(A.url || ''), A.url);
      const RA = await replay(A.url);
      check('friend plays the same Desert cliff: same sand, wind and distance', RA.friend && RA.spec === A.spec && RA.world === 2, RA.spec);
      const B = await linkFrom(45, 5);            // Volcano: crumbling edge / quakes
      const RB = await replay(B.url || '?');
      check('volcano cliff link keeps its twists too', RB.friend && RB.spec === B.spec && RB.world === 5, (B.url || '') + ' ' + RB.spec);
      const RE = await replay('?c=eabc123.7&s=10');
      const { page: pe, ctx: ce } = await open(b, srv.url + PAGE, {});
      const wantE = await pe.evaluate(() => JSON.stringify(window.__physics.endlessSpec('abc123', 7))); await ce.close();
      check('Endless link replays the same Endless cliff', RE.friend && RE.spec === wantE, RE.spec);
      const R1 = await replay('?c=1-10500-7200&s=35');
      check('old V1 challenge links still open a plain cliff', R1.friend && JSON.parse(R1.spec).si === 1 && JSON.parse(R1.spec).dist === 10.5);
      const bad = [];
      for (const q of ['?c=n0&s=10', '?c=n999&s=10', '?c=n5&s=abc', '?c=eAB$.3&s=10', '?c=1-2&s=1']) { const r = await replay(q); if (r.friend || r.errors.length) bad.push(q); }
      check('broken or edited links are ignored safely (normal game, no errors)', bad.length === 0, bad.join(' '));
      check('no page errors (challenge links)', [A, B, RA, RB, R1].every(x => x.errors.length === 0));
    }

    // ---- every Track.send name in the game is in the database list ----
    const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const names = new Set();
    for (const m of src.matchAll(/Track\.send\(([^;]*?)\)\s*;/g)) for (const q of m[1].matchAll(/'([a-z_]+)'/g)) names.add(q[1]);
    for (const k of src.slice(src.indexOf('const REWARD_LIMITS'), src.indexOf('};', src.indexOf('const REWARD_LIMITS'))).matchAll(/([a-z]+):/g)) names.add('reward_' + k[1]);
    names.delete('reward_');
    const bad = [...names].filter(n => !ALLOWED.includes(n));
    check('every event name written in the game is in the database list', bad.length === 0, 'missing: ' + bad.join(','));
  } finally { await b.close(); srv.close(); }
  process.exit(summary() ? 1 : 0);
})();
