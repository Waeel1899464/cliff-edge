// Trailer V3 — renders the text overlays as transparent PNGs with the browser, using the same
// font stack as the game (system-ui, heavy weight, dark outline), so labels match the game's look.
// Usage: node labels_v3.js <out_dir>
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const OUT = process.argv[2]; fs.mkdirSync(OUT, { recursive: true });
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

const CSS = `
  body { margin: 0; background: transparent; font-family: ${FONT}; }
  .wrap { display: inline-block; padding: 24px; }
  .pill { display: inline-flex; align-items: center; gap: 22px; padding: 22px 46px; border-radius: 999px;
          background: rgba(10,10,25,0.80); box-shadow: 0 8px 28px rgba(0,0,0,0.35);
          color: #ffd23f; font-weight: 900; font-size: 62px; letter-spacing: 1px; white-space: nowrap; }
  .dot { width: 40px; height: 40px; border-radius: 50%; flex: none; }
  .dot.down { background: #ffd23f; box-shadow: 0 0 0 8px rgba(255,210,63,0.30); }
  .dot.up { border: 7px solid #ffd23f; box-sizing: border-box; }
  .step { display: flex; align-items: center; gap: 26px; font-weight: 900; font-size: 50px; white-space: nowrap; color: #ffffff; }
  .num { width: 66px; height: 66px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
         font-size: 38px; flex: none; }
  .on .num { background: #ffd23f; color: #12141f; }
  .on .txt { color: #ffd23f; }
  .off { opacity: 0.38; }
  .off .num { border: 4px solid #ffffff; box-sizing: border-box; color: #ffffff; }
  .q { font-weight: 900; font-size: 64px; color: #ffffff; white-space: nowrap;
       -webkit-text-stroke: 12px rgba(10,10,25,0.85); paint-order: stroke fill; }
  .cta { display: inline-block; padding: 26px 70px; border-radius: 999px; background: #ffd23f; color: #12141f;
         font-weight: 900; font-size: 60px; letter-spacing: 2px; box-shadow: 0 10px 0 #c99a12, 0 18px 36px rgba(0,0,0,0.35); }
`;

const ITEMS = {
  press:   `<div class="pill"><span class="dot down"></span>PRESS TO DRIVE</div>`,
  release: `<div class="pill"><span class="dot up"></span>RELEASE TO STOP</div>`,
  closer:  `<div class="pill">THE CLOSER, THE BETTER</div>`,
  retry:   `<div class="pill">INSTANT RETRY</div>`,
  zone:    `<div class="pill">NEW ZONE EVERY 5 CLIFFS</div>`,
  question:`<div class="q">HOW CLOSE CAN YOU STOP?</div>`,
  cta:     `<div class="cta">PLAY NOW</div>`,
};
const STEPS = ['PRESS TO DRIVE', 'RELEASE TO STOP', 'THE CLOSER, THE BETTER'];
STEPS.forEach((t, i) => {
  ITEMS['step' + (i + 1) + '_on'] = `<div class="step on"><span class="num">${i + 1}</span><span class="txt">${t}</span></div>`;
  ITEMS['step' + (i + 1) + '_off'] = `<div class="step off"><span class="num">${i + 1}</span><span class="txt">${t}</span></div>`;
});

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 400 }, deviceScaleFactor: 1 });
  for (const [name, html] of Object.entries(ITEMS)) {
    await p.setContent(`<style>${CSS}</style><div class="wrap" id="w">${html}</div>`);
    await p.evaluate(() => document.fonts.ready);
    await p.locator('#w').screenshot({ path: path.join(OUT, name + '.png'), omitBackground: true });
  }
  await b.close();
  console.log('labels:', Object.keys(ITEMS).length);
})();
