// Boucle : simulation à pas fixe, rendu découplé, pause quand l'onglet est caché, sauvegarde locale.
import { TICKS_PER_SEC, TICKS_PER_DAY } from './config.ts';
import { Sim } from './sim.ts';
import { Renderer } from './render.ts';
import { UI, type App } from './ui.ts';

const SAVE_KEY = 'antsim-save-v1';
const canvas = document.getElementById('c') as HTMLCanvasElement;

function load(): Sim | null {
  try { const s = localStorage.getItem(SAVE_KEY); return s ? Sim.fromJSON(JSON.parse(s)) : null; } catch { return null; }
}
function fresh() { const s = new Sim((Math.random() * 2 ** 31) | 0); s.tick = Math.round(TICKS_PER_DAY * 10 / 24); s.seedWorld(); return s; } // on commence à 10 h du matin

const app: App = {
  sim: load() ?? fresh(),
  speed: 1,
  setSpeed(s) { app.speed = s; },
  skipWinter() { app.sim.skipWinter(); },
  newGame() { localStorage.removeItem(SAVE_KEY); app.sim = fresh(); app.sim.surfDirty = app.sim.dugDirty = true; },
};
const renderer = new Renderer(canvas);
const ui = new UI(app, canvas);

let last = performance.now(), acc = 0, frame = 0, saveAt = last + 60000;
function loop(now: number) {
  const dt = Math.min(0.25, (now - last) / 1000); last = now;
  if (!document.hidden) {
    acc += dt * TICKS_PER_SEC * app.speed;
    let n = Math.min(acc | 0, 120);           // plafond : on perd du temps plutôt que de bloquer l'onglet
    acc -= n;
    while (n-- > 0) app.sim.step();
    renderer.draw(app.sim);
    ui.update(frame++);
    if (now > saveAt) { save(); saveAt = now + 60000; }
  } else acc = 0;                             // pause = gel, pas de rattrapage
  requestAnimationFrame(loop);
}
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(app.sim.toJSON())); } catch (e) { console.warn('sauvegarde impossible', e); } }
addEventListener('pagehide', save);
addEventListener('keydown', e => { if (e.key === ' ') { app.setSpeed(app.speed ? 0 : 1); e.preventDefault(); } });
(window as unknown as { antsim: App }).antsim = app; // pour bidouiller depuis la console
requestAnimationFrame(loop);
