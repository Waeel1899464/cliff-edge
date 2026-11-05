// Shared helpers for the browser tests. Run any test with: node tests/<name>.test.js
// Needs: Playwright (pre-installed in the work environment) and python3 (local web server).
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function serve(port = 8790) {
  const p = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
  return new Promise(r => setTimeout(() => r({ url: `http://127.0.0.1:${port}`, close: () => p.kill() }), 700));
}

// Manual clock: performance.now, Date.now and requestAnimationFrame are replaced so a test decides
// exactly when every frame happens (30/60/120/144 Hz) and when every input happens.
const MANUAL_CLOCK = (base) => `
  (() => {
    let T = 1000; const BASE = ${base};
    let cbs = [];
    performance.now = () => T;
    const RealDate = Date;
    Date.now = () => BASE + T;
    window.requestAnimationFrame = cb => { cbs.push(cb); return cbs.length; };
    window.__T = () => T;
    window.__advance = ms => { T += ms; };
    window.__frame = ms => { T += ms; const c = cbs; cbs = []; c.forEach(f => f(T)); };
  })();`;

let results = [];
function check(name, ok, info = '') {
  results.push({ name, ok: !!ok, info });
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? '  — ' + info : ''));
}
function summary() {
  const f = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - f}/${results.length} passed`);
  return f;
}

// Open a page, collecting console errors and any request that leaves the local server.
async function open(browser, url, opts = {}) {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 400, height: 760 }, hasTouch: true }, opts.context || {}));
  const page = await ctx.newPage();
  const errors = [], external = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  page.on('request', r => { const u = r.url(); if (!u.startsWith('http://127.0.0.1') && !u.startsWith('data:') && !u.startsWith('blob:')) external.push(u); });
  if (opts.manualClock) await page.addInitScript(MANUAL_CLOCK(opts.base || Date.UTC(2026, 10, 4, 12)));
  if (opts.init) await page.addInitScript(opts.init);
  await page.goto(url);
  await page.waitForFunction(() => typeof window.__cliff === 'function');
  return { ctx, page, errors, external };
}

// Dispatch a pointer or key event with an exact timeStamp (ms, same clock as performance.now).
const IN_PAGE = `
  window.__ptr = (type, t, id = 1) => {
    const c = document.getElementById('game'), r = c.getBoundingClientRect();
    const ev = new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: id, pointerType: 'touch', isPrimary: true,
      clientX: r.left + r.width * 0.5, clientY: r.top + r.height * 0.75 });
    if (t !== undefined) Object.defineProperty(ev, 'timeStamp', { value: t });
    (type === 'pointerdown' ? c : window).dispatchEvent(ev);
  };
  window.__key = (type, t, key = ' ') => {
    const ev = new KeyboardEvent(type, { bubbles: true, cancelable: true, key });
    if (t !== undefined) Object.defineProperty(ev, 'timeStamp', { value: t });
    window.dispatchEvent(ev);
  };`;

module.exports = { chromium, serve, check, summary, open, IN_PAGE, ROOT, MANUAL_CLOCK };
