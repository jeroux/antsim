// Rendu Canvas 2D : surface vue de dessus en haut, coupe du nid en bas. Sprites pré-rendus par espèce × rôle.
import { CELL, SURF_W, SURF_H, UND_W, UND_H, ROLE_COLORS } from './config.ts';
import { Sim, SW, SH, UW, S, R, ST, CARRY, type Item } from './sim.ts';

const FRAMES = 32, FS = 28;
const TAU = Math.PI * 2;

function drawAntShape(g: CanvasRenderingContext2D, role: number, color: string) {
  // repère : fourmi orientée vers +x, centrée en (0,0), ~13 px de long à taille 1
  const queen = role === R.QUEEN, gyne = role === R.GYNE, male = role === R.MALE;
  g.strokeStyle = color; g.lineWidth = 0.9; g.lineCap = 'round';
  for (const s of [-1, 1]) for (const [x0, x1, y1] of [[1.5, 4.5, 3.6], [0.3, 0.5, 4.2], [-1, -3.8, 3.4]]) {
    g.beginPath(); g.moveTo(x0, s * 0.9); g.lineTo(x0 + (x1 - x0) * 0.5, s * y1 * 0.6); g.lineTo(x1, s * y1); g.stroke();
  }
  g.beginPath(); g.moveTo(4.5, -0.6); g.lineTo(7.5, -2.6); g.moveTo(4.5, 0.6); g.lineTo(7.5, 2.6); g.stroke();
  if (gyne || male) { g.fillStyle = 'rgba(220,230,255,0.45)'; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(-3.5, s * 2.2, 6, 1.8, s * 0.25, 0, TAU); g.fill(); } }
  g.fillStyle = color;
  g.beginPath(); g.ellipse(queen ? -5 : -4, 0, queen ? 5 : 3.2, queen ? 3 : 2.1, 0, 0, TAU); g.fill();       // gastre
  g.beginPath(); g.ellipse(0.5, 0, 2.3, 1.5, 0, 0, TAU); g.fill();                                           // thorax
  g.beginPath(); g.arc(4, 0, male ? 1.5 : 1.9, 0, TAU); g.fill();                                            // tête
  if (queen) { g.fillStyle = 'rgba(255,230,160,0.5)'; g.beginPath(); g.ellipse(-5, 0, 2.5, 1.2, 0, 0, TAU); g.fill(); }
}

export class Renderer {
  ctx: CanvasRenderingContext2D;
  sheet = document.createElement('canvas');
  surfBg = document.createElement('canvas');
  undBg = document.createElement('canvas');
  pheroC = document.createElement('canvas');
  pheroImg: ImageData;
  canvas: HTMLCanvasElement;
  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d')!;
    this.sheet.width = FRAMES * FS; this.sheet.height = ROLE_COLORS.length * 6 * FS;
    const g = this.sheet.getContext('2d')!;
    ROLE_COLORS.forEach((cols, sp) => cols.forEach((color, role) => {
      for (let f = 0; f < FRAMES; f++) {
        g.save(); g.translate(f * FS + FS / 2, (sp * 6 + role) * FS + FS / 2); g.rotate(f / FRAMES * TAU);
        drawAntShape(g, role, color); g.restore();
      }
    }));
    this.surfBg.width = SW; this.surfBg.height = SH;
    this.undBg.width = UW; this.undBg.height = UND_H * CELL;
    this.pheroC.width = SURF_W; this.pheroC.height = SURF_H;
    this.pheroImg = this.pheroC.getContext('2d')!.createImageData(SURF_W, SURF_H);
  }

  private buildSurface(sim: Sim) {
    const g = this.surfBg.getContext('2d')!;
    g.fillStyle = '#7a9e55'; g.fillRect(0, 0, SW, SH);
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let k = 0; k < 6000; k++) { g.fillStyle = rnd() < 0.5 ? 'rgba(60,90,40,0.35)' : 'rgba(170,200,110,0.3)'; const x = rnd() * SW, y = rnd() * SH; g.fillRect(x, y, 1 + rnd() * 2, 1 + rnd() * 3); }
    for (let c = 0; c < sim.surf.length; c++) {
      const x = (c % SURF_W) * CELL, y = (c / SURF_W | 0) * CELL;
      if (sim.surf[c] === S.STONE) {
        g.fillStyle = `hsl(30, 6%, ${48 + rnd() * 12}%)`; g.beginPath(); g.roundRect(x - 1, y - 1, CELL + 2, CELL + 2, 3); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(x + 1, y + 1, CELL - 3, 2);
      } else if (sim.surf[c] === S.ENTRANCE) {
        g.fillStyle = '#a2814f'; g.beginPath(); g.arc(x + 4, y + 4, 9, 0, TAU); g.fill();
        g.fillStyle = '#6c5232'; g.beginPath(); g.arc(x + 4, y + 4, 7, 0, TAU); g.fill();
        g.fillStyle = '#1b130c'; g.beginPath(); g.arc(x + 4, y + 4, 3.5, 0, TAU); g.fill();
      }
    }
    sim.surfDirty = false;
  }

  private buildUnder(sim: Sim) {
    const g = this.undBg.getContext('2d')!, H = UND_H * CELL;
    const grad = g.createLinearGradient(0, 0, 0, H); grad.addColorStop(0, '#5e4330'); grad.addColorStop(1, '#2d1d14');
    g.fillStyle = grad; g.fillRect(0, 0, UW, H);
    let seed = 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let k = 0; k < 5000; k++) { g.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.18)' : 'rgba(255,220,180,0.08)'; g.fillRect(rnd() * UW, rnd() * H, 1 + rnd() * 2, 1 + rnd() * 2); }
    g.fillStyle = '#4b3523';
    for (let c = 0; c < sim.dug.length; c++) if (sim.dug[c]) { const x = (c % UND_W) * CELL, y = (c / UND_W | 0) * CELL; g.fillRect(x - 1, y - 1, CELL + 2, CELL + 2); }
    for (let c = 0; c < sim.dug.length; c++) if (sim.dug[c]) {
      const x = (c % UND_W) * CELL, y = (c / UND_W | 0) * CELL, depth = y / H;
      g.fillStyle = `hsl(28, 32%, ${34 - depth * 10}%)`; g.beginPath(); g.arc(x + 4, y + 4, 5.2, 0, TAU); g.fill();
      g.fillRect(x, y, CELL, CELL);
    }
    sim.dugDirty = false;
  }

  private drawItem(g: CanvasRenderingContext2D, it: Item) {
    const { x, y } = it;
    if (it.kind === 'sugar') {
      const n = Math.max(1, Math.min(6, Math.ceil(it.amount / 7)));
      for (let k = 0; k < n; k++) { g.fillStyle = k % 2 ? '#fff5f7' : '#f3dfe6'; g.fillRect(x - 5 + (k % 3) * 4, y - 3 + (k / 3 | 0) * 4, 3.5, 3.5); }
    } else if (it.kind === 'protein') {
      const s = 0.6 + Math.min(1, it.amount / 25) * 0.8;
      g.fillStyle = '#3b2a1e'; g.beginPath(); g.ellipse(x, y, 6 * s, 3.5 * s, 0.4, 0, TAU); g.fill();
      g.strokeStyle = '#3b2a1e'; g.lineWidth = 1; for (const a of [0.9, 1.6, 2.3, 4.0, 4.7, 5.4]) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 8 * s, y + Math.sin(a) * 8 * s); g.stroke(); }
    } else if (it.kind === 'water') {
      const r = 4 + Math.min(1, it.amount / 40) * 7;
      g.fillStyle = 'rgba(90,150,210,0.75)'; g.beginPath(); g.ellipse(x, y, r * 1.3, r, 0, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.45)'; g.beginPath(); g.ellipse(x - r * 0.4, y - r * 0.35, r * 0.4, r * 0.22, 0, 0, TAU); g.fill();
    } else if (it.kind === 'plant') {
      g.strokeStyle = '#3f6b2a'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y + 8); g.quadraticCurveTo(x + 2, y - 4, x, y - 14); g.stroke();
      g.fillStyle = '#5c9a3c';
      for (const [dx, dy, a] of [[-6, -2, -0.6], [6, -6, 0.6], [-5, -10, -0.9], [5, 2, 0.9]]) { g.beginPath(); g.ellipse(x + dx, y + dy, 6, 2.6, a, 0, TAU); g.fill(); }
      g.fillStyle = '#b9e08a'; const n = Math.min(8, Math.round(it.amount / 2));
      for (let k = 0; k < n; k++) { g.beginPath(); g.arc(x + (k % 2 ? 1.5 : -1.5), y + 6 - k * 2.4, 1.3, 0, TAU); g.fill(); }
    } else if (it.kind === 'radiator') {
      const gr = g.createRadialGradient(x, y, 2, x, y, 60); gr.addColorStop(0, 'rgba(255,140,40,0.35)'); gr.addColorStop(1, 'rgba(255,140,40,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, 60, 0, TAU); g.fill();
      g.fillStyle = '#d9d2c8'; g.beginPath(); g.roundRect(x - 9, y - 6, 18, 12, 2); g.fill();
      g.fillStyle = '#e8702a'; for (let k = 0; k < 4; k++) g.fillRect(x - 7 + k * 4, y - 4, 2, 8);
    } else if (it.kind === 'corpse') {
      g.fillStyle = 'rgba(50,40,35,0.7)'; g.beginPath(); g.ellipse(x, y, 3, 1.6, 0.5, 0, TAU); g.fill();
    }
  }

  draw(sim: Sim) {
    const g = this.ctx;
    if (sim.surfDirty) this.buildSurface(sim);
    if (sim.dugDirty) this.buildUnder(sim);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(this.surfBg, 0, 0);
    g.drawImage(this.undBg, 0, SH);

    // Pistes de phéromone
    const px = this.pheroImg.data; px.fill(0);
    for (const c of sim.colonies) if (c.alive) {
      const p = c.phero, red = c.species === 1;
      for (let k = 0; k < p.length; k++) if (p[k] > 0.02) { const a = Math.min(1, p[k] / 3) * 140; const o = k * 4; px[o] = red ? 255 : 255; px[o + 1] = red ? 200 : 246; px[o + 2] = red ? 180 : 205; px[o + 3] = Math.min(255, px[o + 3] + a); }
    }
    this.pheroC.getContext('2d')!.putImageData(this.pheroImg, 0, 0);
    g.imageSmoothingEnabled = true; g.drawImage(this.pheroC, 0, 0, SW, SH);

    for (const it of sim.items) this.drawItem(g, it);

    // Couvain et cadavres sous terre
    for (let j = 0; j < sim.bn; j++) if (sim.balive[j]) {
      const st = sim.bstage[j], x = sim.bx[j], y = SH + sim.by[j];
      g.fillStyle = st === 0 ? '#fbf7ee' : st === 1 ? '#f1e6c8' : sim.bkind[j] === 1 ? '#c9cfe6' : '#d9c39a';
      g.beginPath(); g.ellipse(x, y, st === 0 ? 1.4 : st === 1 ? 2.4 : 3.2, st === 0 ? 1 : st === 1 ? 1.6 : 1.9, j % 7 * 0.4, 0, TAU); g.fill();
    }
    g.fillStyle = 'rgba(40,30,25,0.8)';
    for (const u of sim.ucorpses) { g.beginPath(); g.ellipse(u.x, SH + u.y, 3, 1.6, 0.5, 0, TAU); g.fill(); }

    // Fourmis
    for (let i = 0; i < sim.n; i++) {
      if (!sim.alive[i]) continue;
      const c = sim.colonies[sim.col[i]], sz = sim.size[i];
      const fx = ((Math.round(sim.ang[i] / TAU * FRAMES) % FRAMES) + FRAMES) % FRAMES, fy = c.species * 6 + sim.role[i];
      const x = sim.x[i], y = sim.layer[i] ? SH + sim.y[i] : sim.y[i], w = FS * sz;
      if (sim.state[i] === ST.FLY) g.globalAlpha = Math.max(0, sim.timer[i] / 160);
      g.drawImage(this.sheet, fx * FS, fy * FS, FS, FS, x - w / 2, y - w / 2, w, w);
      g.globalAlpha = 1;
      const cr = sim.carry[i];
      if (cr) {
        g.fillStyle = cr === CARRY.SUGAR ? '#fff4f6' : cr === CARRY.PROTEIN ? '#4a3425' : cr === CARRY.WATER ? '#7fb6e6' : cr === CARRY.BROOD ? '#f6efdd' : '#3a2f28';
        g.beginPath(); g.arc(x + Math.cos(sim.ang[i]) * 6 * sz, y + Math.sin(sim.ang[i]) * 6 * sz, 1.8 * sz, 0, TAU); g.fill();
      }
    }

    // Lumière, saison, séparation
    const night = 1 - sim.daylight;
    const T = sim.surfaceT(SW / 2, SH / 2);
    if (sim.month >= 8 && sim.month <= 10) { g.fillStyle = 'rgba(210,130,40,0.09)'; g.fillRect(0, 0, SW, SH); }
    if (T < 1) { g.fillStyle = `rgba(245,248,255,${Math.min(0.55, (1 - T) * 0.12)})`; g.fillRect(0, 0, SW, SH); }
    g.fillStyle = `rgba(12,20,55,${night * 0.3})`; g.fillRect(0, 0, SW, SH);
    g.fillStyle = `rgba(0,0,0,${night * 0.15})`; g.fillRect(0, SH, UW, UND_H * CELL);
    g.fillStyle = '#1a120c'; g.fillRect(0, SH - 1, SW, 2);
  }
}
