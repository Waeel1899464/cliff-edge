// Cliff Run v0 simulator: the run sequence, targets and bonus zones are read from the game itself
// (the CRUN block of index.html), the physics from the PHYSICS block (via sim.js), so these numbers
// always match the implemented rules. Player model and limits: see tools/sim/sim.js.
//   node tools/sim/run.js            -> markdown tables
//   node tools/sim/run.js --runs 3000
const fs = require('fs'), path = require('path');
const S = require('./sim.js');
const P = S.Physics, PROFILES = S.PROFILES, rng = S.rng;
const src = fs.readFileSync(path.join(__dirname, '../../index.html'), 'utf8');
const a = src.indexOf('const CRUN = (() => {'), b = src.indexOf('  const CRUN_CELEB');
const CRUN = new Function('Physics', src.slice(a, b) + '\nreturn CRUN;')(P);
const args = process.argv.slice(2), RUNS = +(args[args.indexOf('--runs') + 1] || 0) || 2000;
const N = CRUN.list.length;

function stop(R, prof, biasScale, r, aimCm) {
  const pl = S.playerFor(prof, R.sp);
  const tRel = Math.max(0, P.releaseS(aimCm / 100, R.sp) + pl.bias0 * biasScale * r.n() + pl.st * r.n() + pl.q * r.u() - pl.q / 2);
  const g = P.gapS(tRel, R.sp);
  if (g < 0) return { res: 'fall' };
  const cm = g * 100;
  return cm >= R.target ? { res: 'short' } : { res: 'ok', cm };
}
const STRAT = {
  'safe (middle of zone)': (T) => Math.min(T / 2, 50),
  'aim 25 %': (T) => 0.25 * T,
  'aim 18 %': (T) => 0.18 * T,
  'protect streak': (T, st) => (st.mult >= 3 ? 0.18 : 0.28) * T,
  'exploit strikes': (T, st, R) => (R.role === 'learn' && st.strikes < 2 ? 1.4 * T : Math.min(T / 2, 50)),
};
function run(prof, strat, r, seen, practiced) {
  const st = { strikes: 0, mult: 1 }; let score = 0, cliffs = 0, ok = 0, at5 = 0, resets = 0;
  for (let k = 1; k <= N; k++) {
    const R = CRUN.at(k, 'sim');
    let bias = R.role === 'learn' || R.boss ? 1 : 0.6;
    if (practiced) bias *= Math.max(0.25, Math.pow(0.6, seen[k] || 0));
    seen[k] = (seen[k] || 0) + 1;
    const s = stop(R, prof, bias, r, STRAT[strat](R.target, st, R));
    if (s.res === 'fall') return { cliffs, score, ok, at5, resets, end: 'fall' };
    if (s.res === 'short') { if (st.mult > 1) resets++; st.mult = 1; if (++st.strikes > 2) return { cliffs, score, ok, at5, resets, end: 'strike' }; cliffs++; continue; }
    cliffs++; ok++; if (st.mult === 5) at5++;
    score += Math.round(100 * (1 - s.cm / R.target)) * st.mult * (R.boss ? 2 : 1);
    if (s.cm < CRUN.bonusFrac(st.mult) * R.target) st.mult = Math.min(5, st.mult + 1); else { if (st.mult > 1) resets++; st.mult = 1; }
  }
  return { cliffs, score, ok, at5, resets, end: 'done' };
}
function table(practiced) {
  const out = [`\n### ${practiced ? 'Practiced (after many runs)' : 'First run (no practice)'} — ${RUNS} runs each\n`,
    '| player · strategy | median cliffs | reach 10 | reach 20 | reach 30 | reach 50 | points per cliff | mean score | stops at ×5 | multiplier resets / run | ended by 3rd strike |', '|---|---|---|---|---|---|---|---|---|---|---|'];
  for (const [pn, prof] of Object.entries(PROFILES)) for (const sn of Object.keys(STRAT)) {
    if (pn === 'beginner' && sn !== 'safe (middle of zone)' && sn !== 'exploit strikes') continue;
    const r = rng(17 + pn.length * 31 + sn.length), seen = {}, res = [];
    for (let i = 0; i < RUNS; i++) res.push(run(prof, sn, r, practiced ? seen : {}, practiced));
    const sum = f => res.reduce((x, y) => x + f(y), 0), at = k => Math.round(100 * res.filter(x => x.cliffs >= k).length / RUNS) + '%';
    out.push(`| ${pn} · ${sn} | ${res.map(x => x.cliffs).sort((x, y) => x - y)[RUNS >> 1]} | ${at(10)} | ${at(20)} | ${at(30)} | ${at(50)} | ${Math.round(sum(x => x.score) / Math.max(1, sum(x => x.cliffs)))} | ${Math.round(sum(x => x.score) / RUNS)} | ${Math.round(100 * sum(x => x.at5) / Math.max(1, sum(x => x.ok)))}% | ${(sum(x => x.resets) / RUNS).toFixed(1)} | ${Math.round(100 * res.filter(x => x.end === 'strike').length / RUNS)}% |`);
  }
  return out.join('\n');
}
if (require.main === module) { console.log(`Cliff Run sequence: ${N} cliffs, read from index.html`); console.log(table(false)); console.log(table(true)); }
module.exports = { CRUN, run };
