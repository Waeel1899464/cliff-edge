// Difficulty simulator. Uses the game's own physics: the PHYSICS block is read from index.html,
// so the numbers here are always the numbers in the game.
//   node tools/sim/sim.js            -> prints all tables (markdown)
//   node tools/sim/sim.js --runs 4000
//
// Player model (release timing, seconds):
//   release = ideal moment + bias + noise
//   noise ~ Normal(0, st)              human timing spread on every attempt
//         + Uniform(0, q)              touch-screen / input sampling delay
//   bias  ~ Normal(0, bias0) on the first attempt at a cliff, halved on each retry of the same
//           cliff (the ghost of the last try shows how far off you were).
// The player aims for the middle of the target zone (the best aim for "stop before the line,
// but don't fall"). Attempt time: holding + sliding + end screen (falls take longer).
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '../../index.html'), 'utf8');
const block = src.slice(src.indexOf('/* PHYSICS-BEGIN'), src.indexOf('/* PHYSICS-END */'));
const Physics = new Function(block.replace(/^\/\*[\s\S]*?\*\//, '') + '\nreturn Physics;')();

const args = process.argv.slice(2);
const RUNS = +(args[args.indexOf('--runs') + 1] || 0) || 3000;

// ---- deterministic random numbers (same tables on every run) ----
function rng(seed) {
  let a = seed >>> 0;
  const u = () => { a = (a + 0x6D2B79F5) >>> 0; let x = a; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
  const n = () => { let s = 0; for (let i = 0; i < 12; i++) s += u(); return s - 6; };
  return { u, n };
}

const PROFILES = {
  skilled:  { st: 0.008, q: 0.004, bias0: 0.020 },
  average:  { st: 0.015, q: 0.008, bias0: 0.040 },
  beginner: { st: 0.025, q: 0.008, bias0: 0.070 },
};

// ---- the old game (stable A7), for comparison ----
// Frame-stepped Euler motion at 60 Hz; the release is only noticed at the next frame.
function oldTarget(n) { const v = 100 * Math.pow(0.78, n - 1); return v >= 10 ? Math.round(v) : Math.max(1, Math.round(v * 10) / 10); }
function oldGap(tRel, prm, phase) {
  const S = Physics.SURFACES[prm.si], dt = 1 / 60;
  let x = 0, v = 0, t = phase, sliding = false;
  for (let i = 0; i < 4000; i++) {
    t += dt;
    if (!sliding && t > tRel + phase) sliding = true;   // release seen at this frame
    if (!sliding) v = Math.min(prm.vmax, v + Physics.ACCEL * dt);
    else { v = Math.max(0, v - (S.base + S.drag * v) * dt); if (v < 0.01) v = 0; }
    x += v * dt;
    if (x > prm.dist) return -1;
    if (sliding && v === 0) return prm.dist - x;
  }
  return prm.dist - x;
}

// ---- candidate difficulty designs ----
// Each gives: params(n) (cliff layout), target(n, prm) in cm, gap(tRel, prm, r) in m, aim(n, prm).
const exactGap = (tRel, prm) => { const S = Physics.SURFACES[prm.si]; return Physics.gapAfter(tRel, prm.dist, prm.vmax, S.base, S.drag); };
const seeded = n => Physics.seededParams('cliff-' + n);
function probTarget(curve) {
  return (n, prm) => {
    const save = Object.assign({}, Physics.CURVE); Object.assign(Physics.CURVE, curve);
    const S = Physics.SURFACES[prm.si];
    const t = Physics.targetFor(Physics.successGoal(n), prm.dist, prm.vmax, S.base, S.drag);
    Object.assign(Physics.CURVE, save);
    return t;
  };
}
const DESIGNS = {
  'A7 (now): 0.78/1 cm, frame physics': { params: seeded, target: oldTarget, gap: (t, prm, r) => oldGap(t, prm, r.u() / 60) },
  'A7 targets + exact physics': { params: seeded, target: oldTarget, gap: exactGap },
  'Naive: 0.85/2.5 cm': { params: seeded, target: n => Math.max(2.5, Math.round(100 * Math.pow(0.85, n - 1) * 10) / 10), gap: exactGap },
  'Prob: flat 0.32 after 20': { params: Physics.cliffParams, target: probTarget({ plateau: 0.32, n4: 20 }), gap: exactGap },
  'Prob: 0.40→0.25 by 50 (chosen)': { params: Physics.cliffParams, target: (n, prm) => Physics.cliffTarget(n, prm), gap: exactGap },
  'Prob: 0.40→0.18 by 50': { params: Physics.cliffParams, target: probTarget({ plateau: 0.18 }), gap: exactGap },
};

// One attempt: returns { ok, fell, cm, secs }
function attempt(design, n, prm, T, prof, bias, r, bold = false) {
  const S = Physics.SURFACES[prm.si];
  // safe: aim for the middle of the zone. bold: chase a close stop, accepting ~10% falls
  // (aim 1.28 of the player's own result spread from the edge), never past the middle.
  const spread = Physics.sensitivity(prm.dist, prm.vmax, S.base, S.drag) * Math.sqrt(prof.st * prof.st + prof.q * prof.q / 12 + 0.25 * prof.bias0 * prof.bias0);
  const aimGap = bold ? Math.min(T / 200, 1.28 * spread) : Math.min(T / 2, 50) / 100;
  const tIdeal = Physics.releaseFor(aimGap, prm.dist, prm.vmax, S.base, S.drag);
  const tRel = Math.max(0, tIdeal + bias + prof.st * r.n() + prof.q * r.u() - prof.q / 2);
  const g = design.gap(tRel, prm, r);
  const fell = g < 0;
  const cm = fell ? null : g * 100;
  const h = Physics.hold(tRel, prm.vmax);
  const secs = tRel + (fell ? 3.2 : Physics.stopTime(h.v, S.base, S.drag) + 1.6) + 0.4;
  return { ok: !fell && cm < T, fell, cm, secs };
}

// Per-cliff success probability for a profile (each attempt independent, first-try bias included)
function perCliff(design, prof, n, runs, seed, retry = 0) {
  const r = rng(seed), prm = design.params(n), T = design.target(n, prm);
  let ok = 0;
  for (let i = 0; i < runs; i++) ok += attempt(design, n, prm, T, prof, prof.bias0 * Math.pow(0.5, retry) * r.n(), r).ok ? 1 : 0;
  return { T, p: ok / runs, prm };
}

// A whole session: 3 hearts, checkpoint every 5 cliffs, budget in seconds.
function session(design, prof, budget, r) {
  let cliff = 1, cp = 1, hearts = 3, t = 0, tries = 0, resets = 0, falls = 0, best = 1;
  let lastProgressAt = 0, retry = 0, bias = prof.bias0 * r.n();
  const cache = {};
  while (t < budget) {
    if (!cache[cliff]) { const prm = design.params(cliff); cache[cliff] = { prm, T: design.target(cliff, prm) }; }
    const { prm, T } = cache[cliff];
    const a = attempt(design, cliff, prm, T, prof, bias, r);
    t += a.secs; tries++;
    if (a.fell) falls++;
    if (a.ok) {
      cliff++; retry = 0; bias = prof.bias0 * r.n();
      if ((cliff - 1) % 5 === 0) { cp = cliff; hearts = 3; }
      if (cliff > best) { best = cliff; lastProgressAt = t; }
    } else {
      hearts--; retry++; bias *= 0.5;
      if (hearts <= 0) { cliff = cp; hearts = 3; resets++; retry = 0; bias = prof.bias0 * r.n(); }
    }
  }
  return { best, tries, resets, falls, stuckSecs: budget - lastProgressAt };
}

function pct(a, q) { const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; }
const f1 = x => (Math.round(x * 10) / 10).toFixed(1);
const p0 = x => Math.round(x * 100) + '%';

function main() {
  const out = [];
  const say = s => out.push(s);
  say(`# Difficulty simulation (runs per number: ${RUNS})\n`);
  say('Profiles (release timing, ms): ' + Object.entries(PROFILES).map(([k, p]) => `${k} = spread ${p.st * 1000}, input ${p.q * 1000}, first-try misjudgment ${p.bias0 * 1000}`).join('; ') + '.\n');

  // Table 1: first-attempt and retry success per cliff, old vs chosen
  for (const name of ['A7 (now): 0.78/1 cm, frame physics', 'Prob: 0.40→0.25 by 50 (chosen)']) {
    const d = DESIGNS[name];
    say(`## Per-cliff success — ${name}\n`);
    say('| Cliff | Ground | Target cm | Skilled 1st / retry | Average 1st / retry | Beginner 1st / retry |');
    say('|---|---|---|---|---|---|');
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 15, 20, 25, 30, 40, 50, 60]) {
      const cells = Object.values(PROFILES).map((pr, j) => {
        const a = perCliff(d, pr, n, RUNS, 1000 + n * 7 + j), b = perCliff(d, pr, n, RUNS, 5000 + n * 7 + j, 1);
        return p0(a.p) + ' / ' + p0(b.p);
      });
      const prm = d.params(n);
      say(`| ${n} | ${Physics.SURFACES[prm.si].name} | ${d.target(n, prm)} | ${cells.join(' | ')} |`);
    }
    say('');
  }

  // Table 2: sessions, all designs
  for (const budget of [180, 600, 1800]) {
    say(`## Sessions of ${budget / 60} minutes (${Math.round(RUNS / 3)} players per cell)\n`);
    say('| Design | Profile | Farthest cliff (median, 10%–90%) | Attempts | Back to checkpoint | Falls | Stuck at end (median s) |');
    say('|---|---|---|---|---|---|---|');
    for (const [name, d] of Object.entries(DESIGNS)) {
      for (const [pn, pr] of Object.entries(PROFILES)) {
        const r = rng(777 + budget), res = [];
        for (let i = 0; i < Math.round(RUNS / 3); i++) res.push(session(d, pr, budget, r));
        const b = res.map(x => x.best);
        const mean = k => res.reduce((s, x) => s + x[k], 0) / res.length;
        say(`| ${name} | ${pn} | ${pct(b, 0.5)} (${pct(b, 0.1)}–${pct(b, 0.9)}) | ${f1(mean('tries'))} | ${f1(mean('resets'))} | ${f1(mean('falls'))} | ${Math.round(pct(res.map(x => x.stuckSecs), 0.5))} |`);
      }
    }
    say('');
  }

  // Table 3: grade calibration (chosen design): share of successful stops per grade, for a safe
  // aim (middle of the zone) and a bold aim (chasing a close stop, ~10% falls).
  const d = DESIGNS['Prob: 0.40→0.25 by 50 (chosen)'];
  for (const bold of [false, true]) {
    say(`## Grades on successful stops, ${bold ? 'bold aim (chasing a close stop)' : 'safe aim (middle of the zone)'} — chosen design\n`);
    say('| Cliff | Target | GREAT under | PERFECT under | Beginner GOOD / GREAT / PERFECT | Average GOOD / GREAT / PERFECT | Skilled GOOD / GREAT / PERFECT |');
    say('|---|---|---|---|---|---|---|');
    for (const n of [1, 3, 5, 8, 10, 15, 20, 30, 50]) {
      const prm = d.params(n), T = d.target(n, prm);
      const G = Physics.GRADE, great = Math.min(G.greatMax, G.greatFrac * T), perfect = Math.min(G.perfectMax, G.perfectFrac * T, great * 0.5);
      const cells = ['beginner', 'average', 'skilled'].map((pn, j) => {
        const r = rng(9000 + n + j), c = { GOOD: 0, GREAT: 0, PERFECT: 0 }; let k = 0;
        for (let i = 0; i < RUNS * 2; i++) {
          const a = attempt(d, n, prm, T, PROFILES[pn], PROFILES[pn].bias0 * 0.5 * r.n(), r, bold);
          if (a.ok) { c[Physics.grade(a.cm, T)]++; k++; }
        }
        return ['GOOD', 'GREAT', 'PERFECT'].map(g => p0(c[g] / Math.max(1, k))).join(' / ');
      });
      say(`| ${n} | ${T} | ${f1(great)} | ${f1(perfect)} | ${cells.join(' | ')} |`);
    }
    say('');
  }
  return out.join('\n');
}

if (require.main === module) console.log(main());
module.exports = { Physics, PROFILES, DESIGNS, attempt, perCliff, session, rng, oldGap, oldTarget };
