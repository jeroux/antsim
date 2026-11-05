// Un seul check : une reine seule, sans nourriture, produit des ouvrières ; puis la colonie croît et reste dans la grille.
// Lancer : npm run check   (Node 24, pas de dépendance)
import { Sim, SW, SH, UW, UH, R } from './sim.ts';
import { TICKS_PER_DAY, YEAR } from './config.ts';
const assert = { ok(c: unknown, m: string) { if (!c) { console.error('ÉCHEC : ' + m); process.exit(1); } }, equal(a: unknown, b: unknown, m: string) { this.ok(a === b, m); } };
declare const process: { exit(code: number): never };

const sim = new Sim(42);
sim.tick = Math.round(YEAR * 0.75); // on démarre en avril pour avoir une saison chaude devant nous
sim.place('queen0', SW / 2, SH / 2);
const t0 = performance.now();
for (let t = 0; t < 13 * TICKS_PER_DAY; t++) { sim.step(); if (t % (5 * TICKS_PER_DAY) === 0) { const c = sim.colonies[0]; console.log(`jour ${t / TICKS_PER_DAY} : reine=${c.queen} réserve=${c.reserve.toFixed(2)} couvain=${c.broodCounts.join('/')} fourmis=${c.counts.join('/')}`); } }
const c = sim.colonies[0];
const workers = () => c.counts[1] + c.counts[2] + c.counts[3];
console.log(`jour 13 : ouvrières=${workers()} œufs=${c.broodCounts[0]} larves=${c.broodCounts[1]} nymphes=${c.broodCounts[2]} réserve=${c.reserve.toFixed(2)} creusé=${c.dugCount}`);
assert.ok(c.queen >= 0, 'la reine doit être vivante');
assert.ok(workers() >= 1, 'au moins une ouvrière naine au jour 13');
assert.ok(c.reserve > 0, 'réserve de la reine > 0');

sim.place('sugar', SW / 2 + 120, SH / 2 + 40);
sim.place('protein', SW / 2 - 100, SH / 2 - 30);
sim.place('plant', SW / 2 + 60, SH / 2 - 90);
const w0 = workers();
for (let t = 0; t < 30 * TICKS_PER_DAY; t++) { sim.step(); if (t % (10 * TICKS_PER_DAY) === 0) console.log(`  +${t / TICKS_PER_DAY} j : ouvrières=${workers()} couvain=${c.broodCounts.join('/')} sucre=${c.sugar.toFixed(1)} prot=${c.protein.toFixed(1)} T=${sim.nestT(c).toFixed(0)}`); }
console.log(`jour 43 : ouvrières=${workers()} couvain=${c.broodCounts.join('/')} sucre=${c.sugar.toFixed(1)} protéines=${c.protein.toFixed(1)} creusé=${c.dugCount} (${((performance.now() - t0) / 1000).toFixed(1)} s)`);
assert.ok(workers() > w0, 'la colonie doit avoir grandi avec de la nourriture');
for (let i = 0; i < sim.n; i++) if (sim.alive[i]) {
  const W = sim.layer[i] ? UW : SW, H = sim.layer[i] ? UH : SH;
  assert.ok(sim.x[i] >= 0 && sim.x[i] <= W && sim.y[i] >= 0 && sim.y[i] <= H, `fourmi ${i} hors grille`);
  if (sim.layer[i] === 1 && sim.role[i] !== R.QUEEN) assert.ok(sim.dug[sim.ucell(sim.x[i], sim.y[i])], `fourmi ${i} dans la terre`);
}
const json = JSON.stringify(sim.toJSON());
const sim2 = Sim.fromJSON(JSON.parse(json));
sim2.step();
assert.equal(sim2.tick, sim.tick + 1, 'rechargement de sauvegarde');
console.log(`ok (sauvegarde ${(json.length / 1024).toFixed(0)} ko)`);
