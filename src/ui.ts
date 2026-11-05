// Interface HTML par-dessus le canvas : barre du haut, boîte à outils (glisser-déposer), compteur par rôle, journal.
import { ROLE_COLORS } from './config.ts';
import { Sim, SH, ROLE_NAMES, SEASONS, type ItemKind } from './sim.ts';

export type PlaceKind = ItemKind | 'stone' | 'queen0' | 'queen1';
export type App = {
  sim: Sim; speed: number;
  setSpeed(s: number): void; skipWinter(): void; newGame(): void;
};

const TOOLS: [PlaceKind, string, string][] = [
  ['sugar', '🍬', 'Sucre'], ['protein', '🪲', 'Proie'], ['water', '💧', 'Eau'], ['plant', '🌱', 'Plante à pucerons'],
  ['stone', '🪨', 'Pierre'], ['radiator', '♨️', 'Radiateur'], ['queen0', '🐜', 'Reine noire'], ['queen1', '🐜', 'Reine rouge'],
];
const SPEEDS = [0, 1, 10, 60];

export class UI {
  stage = document.getElementById('stage')!;
  clock = document.createElement('span');
  temp = document.createElement('span');
  speedBtns: HTMLButtonElement[] = [];
  skipBtn = document.createElement('button');
  count = document.createElement('div');
  log = document.createElement('div');
  armed: PlaceKind | null = null;
  private app: App;

  constructor(app: App, canvas: HTMLCanvasElement) {
    this.app = app;
    const bar = document.createElement('div'); bar.className = 'bar';
    this.clock.className = 'clock'; bar.append(this.clock);
    bar.append(this.temp);
    const sp = document.createElement('span'); sp.className = 'spacer'; bar.append(sp);
    SPEEDS.forEach(s => {
      const b = document.createElement('button'); b.textContent = s === 0 ? '⏸' : `×${s}`; b.title = s === 0 ? 'Pause' : `Vitesse ×${s}`;
      b.onclick = () => app.setSpeed(s); bar.append(b); this.speedBtns.push(b);
    });
    this.skipBtn.textContent = 'Sauter l’hiver'; this.skipBtn.onclick = () => app.skipWinter(); bar.append(this.skipBtn);
    const lab = document.createElement('label');
    const slider = document.createElement('input'); slider.type = 'range'; slider.min = '-10'; slider.max = '10'; slider.step = '1'; slider.value = String(app.sim.tempOffset);
    const sv = document.createElement('span'); sv.textContent = '🌡 ' + fmtOffset(app.sim.tempOffset);
    slider.oninput = () => { app.sim.tempOffset = Number(slider.value); sv.textContent = '🌡 ' + fmtOffset(app.sim.tempOffset); };
    lab.append(sv, slider); bar.append(lab);
    const ng = document.createElement('button'); ng.textContent = 'Nouvelle partie'; ng.onclick = () => { if (confirm('Effacer la colonie et recommencer ?')) app.newGame(); }; bar.append(ng);
    this.stage.append(bar);

    const tools = document.createElement('div'); tools.id = 'tools';
    for (const [kind, ico, label] of TOOLS) {
      const t = document.createElement('div'); t.className = 'tool'; t.draggable = true;
      t.innerHTML = `<span class="ico" ${kind === 'queen1' ? 'style="filter:hue-rotate(-20deg) saturate(3) brightness(1.1)"' : kind === 'queen0' ? 'style="filter:brightness(0.4)"' : ''}>${ico}</span><span>${label}</span>`;
      t.title = 'Glisse-moi sur le jardin (ou clique, puis clique sur le jardin)';
      t.ondragstart = e => { e.dataTransfer!.setData('text/plain', kind); e.dataTransfer!.effectAllowed = 'copy'; };
      t.onclick = () => { this.armed = this.armed === kind ? null : kind; tools.querySelectorAll('.tool').forEach(el => el.classList.remove('on')); if (this.armed) t.classList.add('on'); };
      tools.append(t);
    }
    this.stage.append(tools);

    const toCanvas = (e: MouseEvent) => { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) * canvas.width / r.width, (e.clientY - r.top) * canvas.height / r.height]; };
    canvas.ondragover = e => { e.preventDefault(); e.dataTransfer!.dropEffect = 'copy'; };
    canvas.ondrop = e => { e.preventDefault(); const kind = e.dataTransfer!.getData('text/plain') as PlaceKind; const [x, y] = toCanvas(e); if (kind && y < SH) app.sim.place(kind, x, y); };
    canvas.onclick = e => { if (!this.armed) return; const [x, y] = toCanvas(e); if (y < SH) app.sim.place(this.armed, x, y); };

    this.count.id = 'count'; this.stage.append(this.count);
    this.log.id = 'log'; this.stage.append(this.log);
  }

  update(frame: number) {
    const sim = this.app.sim;
    const h = sim.dayFrac * 24, hh = String(h | 0).padStart(2, '0'), mm = String((h % 1) * 60 | 0).padStart(2, '0');
    this.clock.textContent = `An ${sim.year} · ${SEASONS[sim.season]} · Jour ${sim.dayOfYear} · ${hh}:${mm}`;
    this.temp.textContent = `${sim.surfaceT(640, 240).toFixed(0)} °C`;
    this.speedBtns.forEach((b, k) => b.classList.toggle('on', SPEEDS[k] === this.app.speed));
    this.skipBtn.disabled = !sim.isWinterish;
    if (frame % 10 === 0) {
      const tot = [0, 0, 0, 0, 0, 0]; let colonies = 0;
      for (const c of sim.colonies) if (c.alive) { colonies++; c.counts.forEach((n, r) => tot[r] += n); }
      const rows = ROLE_NAMES.map((name, r) => tot[r] ? `<div><span><span class="dot" style="background:${ROLE_COLORS[0][r]}"></span>${name}</span><span>${tot[r]}</span></div>` : '').join('');
      const all = tot.reduce((a, b) => a + b, 0);
      this.count.innerHTML = rows + `<div class="total"><span>${colonies > 1 ? colonies + ' colonies' : 'Fourmis'}</span><span>${all}</span></div>`;
      this.log.innerHTML = sim.log.slice(-3).map(s => `<div>${s}</div>`).join('');
    }
  }
}

const fmtOffset = (v: number) => (v > 0 ? '+' : '') + v + ' °C';
