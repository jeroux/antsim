// La simulation : monde, colonies, fourmis, couvain, saisons. Aucune dépendance au DOM.
import { CELL, SURF_W, SURF_H, UND_W, UND_H, MAX_ANTS, MAX_BROOD, MAX_COLONIES, TICKS_PER_DAY, YEAR, START_YEAR_FRAC, BIO, SPECIES, ANT_SPEED, PHERO_DEPOSIT, PHERO_MAX, PHERO_EVAP, days } from './config.ts';
import { Rng } from './rng.ts';

export const R = { QUEEN: 0, NURSE: 1, NEST: 2, FORAGER: 3, GYNE: 4, MALE: 5 } as const;
export const ROLE_NAMES = ['Reine', 'Nourrices', 'Ouvrières du nid', 'Fourrageuses', 'Gynes', 'Mâles'];
export const CARRY = { NONE: 0, SUGAR: 1, PROTEIN: 2, WATER: 3, BROOD: 4, CORPSE: 5 } as const;
export const ST = { IDLE: 0, FOUND_WALK: 1, FOUND_DIG: 2, QUEEN: 3, OUT: 4, RETURN: 5, DIG: 6, TO_MIDDEN: 7, FLY: 8, REST: 9, TO_ENTRANCE: 10 } as const;
export const S = { GRASS: 0, STONE: 1, ENTRANCE: 2 } as const;
export const SEASONS = ['Hiver', 'Printemps', 'Été', 'Automne'];
export const FIELD = { ENTRANCE: 0, EGG: 1, LARVA: 2, PUPA: 3, DIG: 4 } as const;
export type ItemKind = 'sugar' | 'protein' | 'water' | 'plant' | 'radiator' | 'corpse';
export type Item = { kind: ItemKind; x: number; y: number; amount: number };
export const ITEM_AMOUNT: Record<ItemKind, number> = { sugar: 40, protein: 25, water: 40, plant: 3, radiator: 8, corpse: 0 };

export const SW = SURF_W * CELL, SH = SURF_H * CELL, UW = UND_W * CELL, UH = UND_H * CELL;
const TAU = Math.PI * 2;
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const wrapAngle = (a: number) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
const KEYS_A = ['alive', 'x', 'y', 'ang', 'role', 'state', 'col', 'age', 'layer', 'carry', 'carryIdx', 'hp', 'size', 'timer', 'tgt', 'tx', 'ty'];
const KEYS_B = ['balive', 'bstage', 'bprog', 'bcol', 'bx', 'by', 'bcarried', 'bkind', 'bstarve', 'bqueued'];

export type Colony = {
  id: number; species: number; alive: boolean;
  ex: number; ey: number; queen: number;
  sugar: number; protein: number; water: number;
  founded: boolean; foundedTick: number; diapause: boolean;
  reserve: number; layTimer: number; hunger: number;
  phero: Float32Array; fields: Int16Array[]; fieldsDirty: boolean;
  targets: number[]; digCell: number; cells: number[]; dugCount: number;
  counts: number[]; broodCounts: number[]; misplaced: number[];
  swarmYear: number; alateMode: boolean; flight: number; landers: number; landTimer: number;
  middenDir: number; devRate: number; activity: number;
};

export class Sim {
  rng: Rng;
  tick = 0;
  tempOffset = 0;
  surf = new Uint8Array(SURF_W * SURF_H);
  dug = new Uint8Array(UND_W * UND_H);
  dugOwner = new Int8Array(UND_W * UND_H).fill(-1);
  dugDirty = true; surfDirty = true;
  items: Item[] = [];
  ucorpses: { x: number; y: number }[] = [];
  colonies: Colony[] = [];
  log: string[] = [];
  preyTimer = BIO.preySpawnTicks;

  // Fourmis (Structure of Arrays)
  n = 0; free: number[] = [];
  alive = new Uint8Array(MAX_ANTS); x = new Float32Array(MAX_ANTS); y = new Float32Array(MAX_ANTS);
  ang = new Float32Array(MAX_ANTS); role = new Uint8Array(MAX_ANTS); state = new Uint8Array(MAX_ANTS);
  col = new Int8Array(MAX_ANTS); age = new Int32Array(MAX_ANTS); layer = new Uint8Array(MAX_ANTS);
  carry = new Uint8Array(MAX_ANTS); carryIdx = new Int32Array(MAX_ANTS); hp = new Float32Array(MAX_ANTS);
  size = new Float32Array(MAX_ANTS); timer = new Int32Array(MAX_ANTS); tgt = new Int32Array(MAX_ANTS);
  tx = new Float32Array(MAX_ANTS); ty = new Float32Array(MAX_ANTS);

  // Couvain (Structure of Arrays)
  bn = 0; bfree: number[] = [];
  balive = new Uint8Array(MAX_BROOD); bstage = new Uint8Array(MAX_BROOD); bprog = new Float32Array(MAX_BROOD);
  bcol = new Int8Array(MAX_BROOD); bx = new Float32Array(MAX_BROOD); by = new Float32Array(MAX_BROOD);
  bcarried = new Int32Array(MAX_BROOD); bkind = new Uint8Array(MAX_BROOD); bstarve = new Int32Array(MAX_BROOD);
  bqueued = new Uint8Array(MAX_BROOD);

  private queue = new Int32Array(UND_W * UND_H);
  private head = new Int32Array(SURF_W * SURF_H);
  private next = new Int32Array(MAX_ANTS);

  constructor(seed = 1) { this.rng = new Rng(seed); }

  // ---------- Temps et climat ----------
  get dayFrac() { return (this.tick % TICKS_PER_DAY) / TICKS_PER_DAY; }
  get yearFrac() { return (this.tick / YEAR + START_YEAR_FRAC) % 1; }
  get year() { return Math.floor(this.tick / YEAR + START_YEAR_FRAC) + 1; }
  get dayOfYear() { return Math.floor(this.yearFrac * YEAR / TICKS_PER_DAY) + 1; }
  get month() { return Math.floor(this.yearFrac * 12); }
  get season() { return Math.floor(((this.month + 1) % 12) / 3); }
  get seasonalT() { return 12 - 9 * Math.cos(TAU * this.yearFrac); }       // Liège, un été chaud : ~3 °C janvier, ~21 °C juillet
  get dailyT() { return -4 * Math.cos(TAU * (this.dayFrac - 0.25)); }       // min à 6 h, max à 18 h
  get daylight() {
    const dayLen = 12 - 4.5 * Math.cos(TAU * this.yearFrac), h = this.dayFrac * 24;
    const rise = 12 - dayLen / 2, set = 12 + dayLen / 2;
    return clamp((h - rise + 0.7) / 1.4, 0, 1) * clamp((set - h + 0.7) / 1.4, 0, 1);
  }
  radiatorT(px: number, py: number) {
    let t = 0;
    for (const it of this.items) if (it.kind === 'radiator') {
      const d = Math.hypot(it.x - px, it.y - py);
      if (d < 96) t += it.amount * (1 - d / 96);
    }
    return t;
  }
  surfaceT(px: number, py: number) { return this.seasonalT + this.dailyT + this.tempOffset + this.radiatorT(px, py); }
  nestT(c: Colony) { return this.seasonalT + 3 + 0.3 * this.dailyT + this.tempOffset + 0.6 * this.radiatorT((c.ex + 0.5) * CELL, (c.ey + 0.5) * CELL); }
  get isWinterish() { const m = this.month; return m >= 10 || m <= 1; }

  // ---------- Monde ----------
  scell(px: number, py: number) { return clamp(py / CELL | 0, 0, SURF_H - 1) * SURF_W + clamp(px / CELL | 0, 0, SURF_W - 1); }
  ucell(px: number, py: number) { return clamp(py / CELL | 0, 0, UND_H - 1) * UND_W + clamp(px / CELL | 0, 0, UND_W - 1); }

  seedWorld() {
    for (let k = 0; k < 5; k++) this.place('stone', this.rng.range(60, SW - 60), this.rng.range(60, SH - 60));
    for (let k = 0; k < 2; k++) this.place('plant', this.rng.range(100, SW - 100), this.rng.range(60, SH - 60));
    this.place('water', this.rng.range(100, SW - 100), this.rng.range(60, SH - 60));
    this.place('queen0', SW / 2 + this.rng.range(-100, 100), SH / 2 + this.rng.range(-60, 60));
  }

  place(kind: ItemKind | 'stone' | 'queen0' | 'queen1', px: number, py: number): boolean {
    px = clamp(px, 4, SW - 4); py = clamp(py, 4, SH - 4);
    if (kind === 'queen0' || kind === 'queen1') return this.placeQueen(kind === 'queen0' ? 0 : 1, px, py);
    if (kind === 'stone') {
      const cx = px / CELL | 0, cy = py / CELL | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const X = cx + dx, Y = cy + dy;
        if (X < 0 || Y < 0 || X >= SURF_W || Y >= SURF_H || (Math.abs(dx) + Math.abs(dy) === 2 && this.rng.float() < 0.5)) continue;
        const c = Y * SURF_W + X;
        if (this.surf[c] === S.GRASS) this.surf[c] = S.STONE;
      }
      this.surfDirty = true; return true;
    }
    if (this.surf[this.scell(px, py)] === S.STONE) return false;
    this.items.push({ kind, x: px, y: py, amount: ITEM_AMOUNT[kind] });
    return true;
  }

  // ---------- Colonies ----------
  newColony(species: number): Colony | null {
    if (this.colonies.filter(c => c.alive).length >= MAX_COLONIES || this.colonies.length >= 120) return null;
    const c: Colony = {
      id: this.colonies.length, species, alive: true, ex: -1, ey: -1, queen: -1,
      sugar: 0, protein: 0, water: 0, founded: false, foundedTick: -1, diapause: false,
      reserve: BIO.queenReserve, layTimer: BIO.claustralEggInterval, hunger: 0,
      phero: new Float32Array(SURF_W * SURF_H), fields: [0, 1, 2, 3, 4].map(() => new Int16Array(UND_W * UND_H).fill(-1)), fieldsDirty: true,
      targets: [-1, -1, -1, -1, -1], digCell: -1, cells: [], dugCount: 0,
      counts: [0, 0, 0, 0, 0, 0], broodCounts: [0, 0, 0], misplaced: [],
      swarmYear: -1, alateMode: false, flight: -1, landers: 0, landTimer: 0,
      middenDir: this.rng.float() * TAU, devRate: 0, activity: 0,
    };
    this.colonies.push(c); return c;
  }

  placeQueen(species: number, px: number, py: number) {
    const c = this.newColony(species); if (!c) return false;
    const i = this.addAnt(c.id, R.QUEEN, px, py, 0, 1.7);
    if (i < 0) return false;
    this.state[i] = ST.FOUND_WALK; c.queen = i;
    this.pickFoundSpot(i);
    this.say(`Une reine ${SPECIES[species].name} cherche où fonder.`);
    return true;
  }

  private pickFoundSpot(i: number) {
    for (let k = 0; k < 12; k++) {
      const a = this.rng.float() * TAU, r = this.rng.range(30, 110);
      const px = clamp(this.x[i] + Math.cos(a) * r, 24, SW - 24), py = clamp(this.y[i] + Math.sin(a) * r, 24, SH - 24);
      if (this.goodNestSpot(px, py)) { this.tx[i] = px; this.ty[i] = py; return; }
    }
    this.tx[i] = this.x[i]; this.ty[i] = this.y[i];
  }
  private goodNestSpot(px: number, py: number) {
    if (this.surf[this.scell(px, py)] !== S.GRASS) return false;
    for (const c of this.colonies) if (c.alive && c.ex >= 0 && Math.hypot((c.ex + 0.5) * CELL - px, (c.ey + 0.5) * CELL - py) < 90) return false;
    return true;
  }

  private carveNest(c: Colony, qi: number) {
    const cx = clamp(this.x[qi] / CELL | 0, 2, UND_W - 3), cy = this.y[qi] / CELL | 0;
    c.ex = cx; c.ey = cy; this.surf[cy * SURF_W + cx] = S.ENTRANCE; this.surfDirty = true;
    for (let y = 0; y <= 5; y++) this.digCell(c, y * UND_W + cx);
    for (let y = 6; y <= 7; y++) for (let x = cx - 1; x <= cx + 1; x++) this.digCell(c, y * UND_W + x);
    this.layer[qi] = 1; this.x[qi] = (cx + 0.5) * CELL; this.y[qi] = 7 * CELL;
    this.state[qi] = ST.QUEEN; c.layTimer = BIO.claustralEggInterval;
    this.say(`${SPECIES[c.species].name} : loge claustrale creusée.`);
  }
  private digCell(c: Colony, idx: number) {
    if (this.dug[idx]) return;
    this.dug[idx] = 1; this.dugOwner[idx] = c.id; c.cells.push(idx); c.dugCount++;
    this.dugDirty = true; c.fieldsDirty = true;
  }

  say(s: string) { this.log.push(s); if (this.log.length > 6) this.log.shift(); }

  // ---------- Fourmis ----------
  addAnt(colId: number, role: number, px: number, py: number, layer: number, size: number) {
    let i: number;
    if (this.free.length) i = this.free.pop()!; else if (this.n < MAX_ANTS) i = this.n++; else return -1;
    this.alive[i] = 1; this.x[i] = px; this.y[i] = py; this.ang[i] = this.rng.float() * TAU;
    this.role[i] = role; this.state[i] = ST.IDLE; this.col[i] = colId; this.age[i] = 0; this.layer[i] = layer;
    this.carry[i] = 0; this.carryIdx[i] = -1; this.hp[i] = SPECIES[this.colonies[colId].species].hp * size;
    this.size[i] = size; this.timer[i] = 0; this.tgt[i] = -1;
    return i;
  }

  kill(i: number, corpse = true) {
    if (!this.alive[i]) return;
    this.alive[i] = 0; this.free.push(i);
    const c = this.colonies[this.col[i]];
    if (this.carry[i] === CARRY.BROOD && this.carryIdx[i] >= 0) { const b = this.carryIdx[i]; this.bcarried[b] = -1; this.bqueued[b] = 0; this.bx[b] = this.x[i]; this.by[b] = this.y[i]; }
    if (this.role[i] === R.QUEEN) { c.queen = -1; this.say(`La reine ${SPECIES[c.species].name} est morte.`); }
    if (!corpse) return;
    if (this.layer[i] === 1) this.ucorpses.push({ x: this.x[i], y: this.y[i] });
    else this.items.push({ kind: 'corpse', x: this.x[i], y: this.y[i], amount: days(3) });
  }

  addBrood(c: Colony, px: number, py: number, kind: number) {
    let j: number;
    if (this.bfree.length) j = this.bfree.pop()!; else if (this.bn < MAX_BROOD) j = this.bn++; else return -1;
    this.balive[j] = 1; this.bstage[j] = 0; this.bprog[j] = 0; this.bcol[j] = c.id; this.bx[j] = px; this.by[j] = py;
    this.bcarried[j] = -1; this.bkind[j] = kind; this.bstarve[j] = 0; this.bqueued[j] = 0;
    return j;
  }
  killBrood(j: number) { if (!this.balive[j]) return; this.balive[j] = 0; this.bfree.push(j); if (this.bcarried[j] >= 0) { const i = this.bcarried[j]; this.carry[i] = 0; this.carryIdx[i] = -1; this.bcarried[j] = -1; } }

  // ---------- Boucle ----------
  step() {
    this.tick++;
    if (this.tick % 10 === 0) for (const c of this.colonies) if (c.alive) { const p = c.phero; for (let k = 0; k < p.length; k++) p[k] *= PHERO_EVAP; }
    if (this.tick % 100 === 0) this.slow();
    if (this.tick % 500 === 0) this.assignRoles();
    for (let i = 0; i < this.n; i++) if (this.alive[i]) this.stepAnt(i);
    this.stepBrood();
    if (this.tick % 5 === 0) this.combat();
  }

  private slow() {
    // Comptages
    for (const c of this.colonies) { c.counts.fill(0); c.broodCounts.fill(0); }
    for (let i = 0; i < this.n; i++) if (this.alive[i]) { this.colonies[this.col[i]].counts[this.role[i]]++; }
    for (let j = 0; j < this.bn; j++) if (this.balive[j]) this.colonies[this.bcol[j]].broodCounts[this.bstage[j]]++;

    const dayFrac100 = 100 / TICKS_PER_DAY;     // fraction de jour de jeu écoulée en 100 ticks
    for (const c of this.colonies) {
      if (!c.alive) continue;
      const workers = c.counts[1] + c.counts[2] + c.counts[3];
      const nAnts = workers + c.counts[0] + c.counts[4] + c.counts[5];
      const brood = c.broodCounts[0] + c.broodCounts[1] + c.broodCounts[2];
      if (c.ex < 0) { if (c.queen < 0) c.alive = false; continue; }  // reine encore en surface
      if (nAnts === 0 && brood === 0) { this.dissolve(c); continue; }

      // Climat de la colonie
      const T = this.nestT(c);
      if (!c.diapause && T < 8) { c.diapause = true; if (workers > 10) this.say(`${SPECIES[c.species].name} : la colonie entre en diapause.`); }
      else if (c.diapause && T > 10) { c.diapause = false; if (workers > 10) this.say(`${SPECIES[c.species].name} : la colonie se réveille.`); }
      const humidity = clamp(0.75 + c.water / 25, 0.75, 1);
      c.devRate = c.diapause ? 0 : clamp((T - 8) / 12, 0, 1.3) * humidity;
      const Ts = this.surfaceT((c.ex + 0.5) * CELL, (c.ey + 0.5) * CELL);
      c.activity = c.diapause ? 0 : clamp((Ts - 8) / 8, 0, 1) * (0.4 + 0.6 * this.daylight);

      // Métabolisme
      const meta = c.diapause ? 0.1 : 1;
      const eat = workers * BIO.workerSugarPerDay * dayFrac100 * meta;
      if (c.sugar >= eat) { c.sugar -= eat; c.hunger = 0; }
      else if (c.reserve > 1.5) { c.reserve -= eat; c.hunger = 0; }   // trophallaxie depuis la reine (naines)
      else { c.sugar = 0; c.hunger += 100; }
      c.water = Math.max(0, c.water - 0.02);
      if (c.hunger > BIO.starve && workers > 0) {
        let toKill = Math.ceil(workers * 0.01);
        for (let i = 0; i < this.n && toKill > 0; i++) if (this.alive[i] && this.col[i] === c.id && this.role[i] >= 1 && this.role[i] <= 3 && this.rng.float() < 0.05) { this.kill(i); toKill--; }
      }
      // Reine
      if (c.queen >= 0) {
        c.reserve -= BIO.queenReserve * 0.5 * 100 / BIO.queenDrainTicks * meta;
        if (c.founded && c.sugar > 0.2 && c.reserve < BIO.queenReserve) { const take = Math.min(0.2, c.sugar); c.sugar -= take; c.reserve += take; }
        if (!c.founded && c.reserve < 1 && c.broodCounts[0] > 0) { // la reine mange un œuf
          for (let j = 0; j < this.bn; j++) if (this.balive[j] && this.bcol[j] === c.id && this.bstage[j] === 0) { this.killBrood(j); c.reserve += 0.15; break; }
        }
        if (c.reserve <= 0 || this.age[c.queen] > BIO.queenLife) this.kill(c.queen);
      }
      // Champs de distance et cibles
      if (c.fieldsDirty || this.tick % 300 === 0) this.updateFields(c);
      // Creusement
      if (c.digCell < 0 && c.dugCount < 8 + (workers + brood) * 0.7 && workers > 0) this.pickDig(c);
      // Essaimage
      this.swarmLogic(c, workers);
    }
    // Objets de surface
    for (let k = this.items.length - 1; k >= 0; k--) {
      const it = this.items[k];
      if (it.kind === 'plant') it.amount = Math.min(15, it.amount + BIO.honeydewPerDay * 100 / TICKS_PER_DAY);
      else if (it.kind === 'corpse') { it.amount -= 100; if (it.amount <= 0) this.items.splice(k, 1); }
      else if (it.kind !== 'radiator' && it.amount <= 0) this.items.splice(k, 1);
    }
    this.preyTimer -= 100;
    if (this.preyTimer <= 0) { this.preyTimer = BIO.preySpawnTicks * this.rng.range(0.6, 1.4); const px = this.rng.range(20, SW - 20), py = this.rng.range(20, SH - 20); if (this.surf[this.scell(px, py)] === S.GRASS) this.items.push({ kind: 'protein', x: px, y: py, amount: 4 }); }
  }

  private dissolve(c: Colony) {
    c.alive = false;
    if (c.ex >= 0) this.surf[c.ey * SURF_W + c.ex] = S.GRASS;
    c.phero.fill(0); this.surfDirty = true;
    this.say(`La colonie ${SPECIES[c.species].name} s'est éteinte.`);
  }

  private updateFields(c: Colony) {
    c.fieldsDirty = false;
    if (c.cells.length === 0) return;
    // cibles : œufs = reine ; larves = bas du nid ; nymphes = milieu
    let minY = UND_H, maxY = 0;
    for (const idx of c.cells) { const y = idx / UND_W | 0; if (y < minY) minY = y; if (y > maxY) maxY = y; }
    const span = Math.max(1, maxY - minY);
    const pick = (lo: number, hi: number, old: number) => {
      let best = -1, bestN = -1;
      for (let k = 0; k < 40; k++) {
        const idx = c.cells[this.rng.int(c.cells.length)], y = (idx / UND_W | 0);
        const f = (y - minY) / span; if (f < lo || f > hi) continue;
        let nb = 0; for (const d of [-1, 1, -UND_W, UND_W]) { const q = idx + d; if (q >= 0 && q < this.dug.length && this.dug[q]) nb++; }
        if (nb > bestN) { bestN = nb; best = idx; }
      }
      if (best < 0) return old >= 0 ? old : c.cells[c.cells.length - 1];
      if (old >= 0 && Math.abs((old % UND_W) - (best % UND_W)) + Math.abs((old / UND_W | 0) - (best / UND_W | 0)) < 4) return old;
      return best;
    };
    c.targets[FIELD.ENTRANCE] = c.ex;
    c.targets[FIELD.EGG] = c.queen >= 0 ? this.ucell(this.x[c.queen], this.y[c.queen]) : pick(0.6, 1, c.targets[FIELD.EGG]);
    c.targets[FIELD.LARVA] = pick(0.55, 1, c.targets[FIELD.LARVA]);
    c.targets[FIELD.PUPA] = pick(0.2, 0.7, c.targets[FIELD.PUPA]);
    c.targets[FIELD.DIG] = c.digCell;
    for (let f = 0; f < 5; f++) if (c.targets[f] >= 0) this.bfs(c.targets[f], c.fields[f]);
  }

  private bfs(target: number, out: Int16Array) {
    out.fill(-1); const q = this.queue; let h = 0, t = 0; out[target] = 0; q[t++] = target;
    while (h < t) {
      const cidx = q[h++], d = out[cidx], cx = cidx % UND_W, cy = cidx / UND_W | 0;
      if (cx > 0 && this.visit(cidx - 1, d, out, q, t)) t++;
      if (cx < UND_W - 1 && this.visit(cidx + 1, d, out, q, t)) t++;
      if (cy > 0 && this.visit(cidx - UND_W, d, out, q, t)) t++;
      if (cy < UND_H - 1 && this.visit(cidx + UND_W, d, out, q, t)) t++;
    }
  }
  private visit(nc: number, d: number, out: Int16Array, q: Int32Array, t: number) {
    if (!this.dug[nc] || out[nc] >= 0) return false; out[nc] = d + 1; q[t] = nc; return true;
  }

  private pickDig(c: Colony) {
    const tunnel = this.rng.float() < 0.25;
    let cand = -1;
    if (tunnel) {
      let deepest = -1, dy = -1;
      for (const idx of c.cells) { const y = idx / UND_W | 0; if (y > dy) { dy = y; deepest = idx; } }
      const below = deepest + UND_W;
      if (dy < UND_H - 2 && !this.dug[below]) cand = below;
    }
    const dirs = [[-1, 0], [1, 0], [0, 1], [0, -1]];
    for (let k = 0; k < 30 && cand < 0; k++) {
      const idx = c.cells[this.rng.int(c.cells.length)], x = idx % UND_W, y = idx / UND_W | 0;
      if (y < 3) continue;
      const [dx, dyy] = dirs[this.rng.int(this.rng.float() < 0.75 ? 3 : 4)];
      const X = x + dx, Y = y + dyy;
      if (X < 1 || X >= UND_W - 1 || Y < 3 || Y >= UND_H - 1) continue;
      const q = Y * UND_W + X;
      if (this.dug[q]) continue;
      let foreign = false, nb = 0;
      for (const d of [-1, 1, -UND_W, UND_W]) { const z = q + d; if (z < 0 || z >= this.dug.length) continue; if (this.dug[z]) { nb++; if (this.dugOwner[z] !== c.id) foreign = true; } }
      if (foreign) continue;
      if (nb >= 2 || this.rng.float() < 0.3) cand = q;
    }
    if (cand >= 0) { c.digCell = cand; c.targets[FIELD.DIG] = cand; this.bfs(cand, c.fields[FIELD.DIG]); }
  }

  private assignRoles() {
    const buckets: number[][] = this.colonies.map(() => []);
    for (let i = 0; i < this.n; i++) if (this.alive[i] && this.role[i] >= 1 && this.role[i] <= 3) buckets[this.col[i]].push(i);
    for (const c of this.colonies) {
      const w = buckets[c.id]; if (!w.length) continue;
      w.sort((a, b) => this.age[b] - this.age[a]);  // plus âgées d'abord
      const n = w.length, brood = c.broodCounts[0] + c.broodCounts[1] + c.broodCounts[2];
      const nF = Math.max(1, Math.round(n * 0.45));
      const nN = clamp(Math.ceil(brood / 5), n > 1 ? 1 : 0, Math.floor(n * 0.4));
      for (let k = 0; k < n; k++) {
        const i = w[k];
        const want = k < nF ? R.FORAGER : k >= n - nN ? R.NURSE : R.NEST;
        if (this.role[i] !== want && this.carry[i] === 0 && this.layer[i] === 1) { this.role[i] = want; this.state[i] = ST.IDLE; }
      }
    }
  }

  // ---------- Essaimage ----------
  private swarmLogic(c: Colony, workers: number) {
    const m = this.month;
    c.alateMode = c.founded && (m === 5 || m === 6) && workers >= BIO.alateMinWorkers && this.year > Math.floor(c.foundedTick / YEAR + START_YEAR_FRAC) + 1;
    const alates = c.counts[4] + c.counts[5];
    const h = this.dayFrac * 24;
    if (c.flight < 0 && alates >= 6 && m >= 5 && m <= 7 && h > 15 && h < 19 && this.surfaceT((c.ex + 0.5) * CELL, (c.ey + 0.5) * CELL) > 17 && this.rng.float() < 0.08) {
      c.flight = this.tick; c.landers = Math.min(2, Math.floor(c.counts[4] / 4)); c.landTimer = 150;
      this.say(`${SPECIES[c.species].name} : vol nuptial !`);
    }
    if (c.flight >= 0 && this.tick - c.flight > 3000) c.flight = -1;
    if (c.landers > 0) {
      c.landTimer -= 100;
      if (c.landTimer <= 0) {
        c.landTimer = 400; c.landers--;
        for (let k = 0; k < 15; k++) {
          const px = this.rng.range(30, SW - 30), py = this.rng.range(30, SH - 30);
          if (this.goodNestSpot(px, py)) { this.placeQueen(c.species, px, py); break; }
        }
      }
    }
  }

  // ---------- Couvain ----------
  private stepBrood() {
    for (let j = 0; j < this.bn; j++) {
      if (!this.balive[j]) continue;
      const c = this.colonies[this.bcol[j]];
      if (this.bcarried[j] >= 0) { const i = this.bcarried[j]; this.bx[j] = this.x[i]; this.by[j] = this.y[i]; continue; }
      if (c.devRate <= 0) continue;
      const stage = this.bstage[j];
      const dur = stage === 0 ? BIO.egg : stage === 1 ? BIO.larva : BIO.pupa;
      let rate = c.devRate;
      if (stage === 1 && (j + this.tick) % 100 === 0) {
        const need = BIO.larvaFoodPerDay * 100 / TICKS_PER_DAY * rate; // une larve mange à mesure qu'elle grandit
        if (this.take(c, need)) this.bstarve[j] = 0; else { this.bstarve[j] += 100; if (this.bstarve[j] > BIO.starve) { this.killBrood(j); continue; } }
      }
      if (stage === 1 && this.bstarve[j] > 0) rate *= 0.1;
      this.bprog[j] += rate / dur;
      if ((j + this.tick) % 100 === 0 && !this.bqueued[j]) {
        const t = c.targets[1 + stage];
        if (t >= 0) { const tx = (t % UND_W + 0.5) * CELL, ty = ((t / UND_W | 0) + 0.5) * CELL; if (Math.hypot(tx - this.bx[j], ty - this.by[j]) > 2.5 * CELL) { c.misplaced.push(j); this.bqueued[j] = 1; } }
      }
      if (this.bprog[j] >= 1) {
        this.bprog[j] = 0;
        if (stage < 2) this.bstage[j] = stage + 1;
        else this.emerge(j, c);
      }
    }
  }
  private take(c: Colony, amt: number) {
    if (c.founded) { if (c.protein >= amt && c.sugar >= amt) { c.protein -= amt; c.sugar -= amt; return true; } return false; }
    if (c.reserve > amt) { c.reserve -= amt; return true; }
    return false;
  }
  private emerge(j: number, c: Colony) {
    const workers = c.counts[1] + c.counts[2] + c.counts[3];
    const kind = this.bkind[j];
    const size = kind === 1 ? 1.5 : kind === 2 ? 0.9 : c.founded ? clamp(0.8 + workers / 500, 0.8, 1.15) : 0.7;
    const px = this.bx[j], py = this.by[j];
    this.killBrood(j);
    const i = this.addAnt(c.id, kind === 1 ? R.GYNE : kind === 2 ? R.MALE : R.NURSE, px, py, 1, size);
    if (i < 0) return;
    if (!c.founded) { c.founded = true; c.foundedTick = this.tick; this.say(`${SPECIES[c.species].name} : les premières ouvrières naines sont là.`); }
  }

  // ---------- Fourmis : comportement ----------
  private stepAnt(i: number) {
    this.age[i]++;
    const c = this.colonies[this.col[i]];
    const role = this.role[i];
    if (role !== R.QUEEN && this.age[i] > (role >= 4 ? BIO.alateLife : BIO.workerLife) && this.rng.float() < 0.002) { this.kill(i); return; }
    const sp = ANT_SPEED * SPECIES[c.species].speed * (c.diapause ? 0.15 : 1);
    if (this.layer[i] === 0) this.stepSurface(i, c, sp); else this.stepUnder(i, c, sp);
  }

  private stepSurface(i: number, c: Colony, sp: number) {
    const st = this.state[i];
    if (st === ST.FOUND_WALK) {
      this.steer(i, this.tx[i], this.ty[i], 0.2, 0.15); this.moveSurface(i, sp * 0.8);
      if (Math.hypot(this.tx[i] - this.x[i], this.ty[i] - this.y[i]) < 3) {
        if (this.goodNestSpot(this.x[i], this.y[i])) { this.state[i] = ST.FOUND_DIG; this.timer[i] = BIO.digTicks * 4; } else this.pickFoundSpot(i);
      }
      return;
    }
    if (st === ST.FOUND_DIG) { this.ang[i] += this.rng.range(-0.3, 0.3); if (--this.timer[i] <= 0) this.carveNest(c, i); return; }
    if (st === ST.FLY) { this.y[i] -= 0.8; this.x[i] += Math.cos(this.ang[i]) * 0.5; if (--this.timer[i] <= 0) this.kill(i, false); return; }
    if (st === ST.TO_MIDDEN) {
      const mx = (c.ex + 0.5) * CELL + Math.cos(c.middenDir) * 36, my = (c.ey + 0.5) * CELL + Math.sin(c.middenDir) * 36;
      this.steer(i, mx, my, 0.25, 0.2); this.moveSurface(i, sp);
      if (Math.hypot(mx - this.x[i], my - this.y[i]) < 5 || --this.timer[i] <= 0) { this.items.push({ kind: 'corpse', x: this.x[i] + this.rng.range(-4, 4), y: this.y[i] + this.rng.range(-4, 4), amount: days(3) }); this.carry[i] = 0; this.state[i] = ST.RETURN; this.timer[i] = 2000; }
      return;
    }
    const ex = (c.ex + 0.5) * CELL, ey = (c.ey + 0.5) * CELL;
    if (st === ST.RETURN || (st === ST.OUT && --this.timer[i] <= 0)) {
      this.state[i] = ST.RETURN;
      if (this.carry[i] >= 1 && this.carry[i] <= 3) { const k = this.scell(this.x[i], this.y[i]); c.phero[k] = Math.min(PHERO_MAX, c.phero[k] + PHERO_DEPOSIT); }
      this.steer(i, ex, ey, 0.18, 0.25); this.moveSurface(i, sp);
      if (Math.hypot(ex - this.x[i], ey - this.y[i]) < 6) {
        if (this.carry[i] === CARRY.SUGAR) c.sugar += 1; else if (this.carry[i] === CARRY.PROTEIN) c.protein += 1; else if (this.carry[i] === CARRY.WATER) c.water += 1;
        this.carry[i] = 0; this.layer[i] = 1; this.x[i] = ex; this.y[i] = 0.5 * CELL; this.state[i] = ST.REST; this.timer[i] = 40; this.tgt[i] = -1;
      }
      return;
    }
    // OUT : chercher de la nourriture
    if (this.tgt[i] >= 0) {
      const it = this.items[this.tgt[i]];
      if (!it || it.amount <= 0 || it.kind === 'radiator' || it.kind === 'corpse' || Math.hypot(it.x - this.x[i], it.y - this.y[i]) > 60) this.tgt[i] = -1; // l'index peut glisser après un splice
      else {
        this.steer(i, it.x, it.y, 0.3, 0.1); this.moveSurface(i, sp);
        if (Math.hypot(it.x - this.x[i], it.y - this.y[i]) < 5) {
          if (it.kind === 'plant') { if (it.amount >= 1) { it.amount -= 1; this.carry[i] = CARRY.SUGAR; } }
          else { it.amount -= 1; this.carry[i] = it.kind === 'sugar' ? CARRY.SUGAR : it.kind === 'protein' ? CARRY.PROTEIN : CARRY.WATER; }
          this.tgt[i] = -1;
          if (this.carry[i]) { this.state[i] = ST.RETURN; this.ang[i] += Math.PI; }
        }
        return;
      }
    }
    if ((i + this.tick) % 10 === 0) this.lookForFood(i, c);
    if (this.tgt[i] < 0) {
      // suivre la piste
      const d = 10, a = this.ang[i];
      const s0 = c.phero[this.scell(this.x[i] + Math.cos(a - 0.6) * d, this.y[i] + Math.sin(a - 0.6) * d)];
      const s1 = c.phero[this.scell(this.x[i] + Math.cos(a) * d, this.y[i] + Math.sin(a) * d)];
      const s2 = c.phero[this.scell(this.x[i] + Math.cos(a + 0.6) * d, this.y[i] + Math.sin(a + 0.6) * d)];
      const m = Math.max(s0, s1, s2);
      if (m > 0.05 && this.rng.float() < 0.9) this.ang[i] += (m === s1 ? 0 : m === s0 ? -0.4 : 0.4) + this.rng.range(-0.1, 0.1);
      else this.ang[i] += this.rng.range(-0.35, 0.35);
      this.moveSurface(i, sp);
    }
  }

  private lookForFood(i: number, c: Colony) {
    const needProtein = c.broodCounts[1] > 0 && c.protein < c.broodCounts[1] * 0.3 + 2;
    const needWater = c.water < 8;
    let best = -1, bd = 32 * 32;
    for (let k = 0; k < this.items.length; k++) {
      const it = this.items[k];
      if (it.kind === 'radiator' || it.kind === 'corpse' || it.amount < 1) continue;
      if (it.kind === 'water' && !needWater) continue;
      if (it.kind === 'protein' && !needProtein && this.rng.float() < 0.9) continue;
      const d = (it.x - this.x[i]) ** 2 + (it.y - this.y[i]) ** 2;
      if (d < bd) { bd = d; best = k; }
    }
    this.tgt[i] = best;
  }

  private stepUnder(i: number, c: Colony, sp: number) {
    const role = this.role[i], st = this.state[i];
    if (role === R.QUEEN) {
      if (!c.diapause && c.queen === i) {
        if (--c.layTimer <= 0) {
          const fed = c.founded ? (c.sugar > 1 && c.protein > 0.5) : c.reserve > 1.2;
          const workers = c.counts[1] + c.counts[2] + c.counts[3];
          c.layTimer = !c.founded ? BIO.claustralEggInterval : fed ? Math.max(BIO.eggIntervalMin, BIO.eggIntervalMax / (1 + workers / 40)) : BIO.eggIntervalMax * 3;
          const broodNow = c.broodCounts[0] + c.broodCounts[1] + c.broodCounts[2];
          if ((!c.founded && broodNow < BIO.claustralMaxBrood) || (c.founded && fed)) { const kind = c.alateMode && this.rng.float() < 0.25 ? (this.rng.float() < 0.5 ? 1 : 2) : 0; this.addBrood(c, this.x[i] + this.rng.range(-5, 5), this.y[i] + this.rng.range(-3, 3), kind); }
        }
      }
      if (this.rng.float() < 0.02) { this.ang[i] = this.rng.float() * TAU; this.moveUnder(i, sp * 0.3); }
      return;
    }
    if (st === ST.REST) { if (--this.timer[i] <= 0) this.state[i] = ST.IDLE; this.wanderUnder(i, sp * 0.5); return; }
    if (role === R.GYNE || role === R.MALE) {
      if (c.flight >= 0) { if (this.stepField(i, c.fields[FIELD.ENTRANCE], sp, 0)) { this.exit(i, c); this.state[i] = ST.FLY; this.timer[i] = 160; this.ang[i] = this.rng.range(-1, 1); } }
      else if (this.stepField(i, c.fields[FIELD.ENTRANCE], sp, 4)) this.wanderUnder(i, sp);
      return;
    }
    if (role === R.FORAGER) {
      if (this.carry[i] === 0 && c.activity > 0 && (i + this.tick) % 50 === 0 && this.rng.float() < c.activity) this.state[i] = ST.TO_ENTRANCE;
      if (st === ST.TO_ENTRANCE) { if (c.activity <= 0) this.state[i] = ST.IDLE; else if (this.stepField(i, c.fields[FIELD.ENTRANCE], sp, 0)) { this.exit(i, c); this.state[i] = ST.OUT; this.timer[i] = BIO.foragerOutTicks; } }
      else if (this.stepField(i, c.fields[FIELD.ENTRANCE], sp, 5)) this.wanderUnder(i, sp * 0.6);
      return;
    }
    if (role === R.NURSE) {
      if (this.carry[i] === CARRY.BROOD) {
        const j = this.carryIdx[i], f = 1 + this.bstage[j];
        if (this.stepField(i, c.fields[f], sp, 0) || this.rng.float() < 0.0005) {
          const px = this.x[i] + this.rng.range(-7, 7), py = this.y[i] + this.rng.range(-5, 5);
          const ok = this.dug[this.ucell(px, py)];
          this.bx[j] = ok ? px : this.x[i]; this.by[j] = ok ? py : this.y[i];
          this.bcarried[j] = -1; this.bqueued[j] = 0; this.carry[i] = 0; this.carryIdx[i] = -1;
        }
        return;
      }
      while (c.misplaced.length) {
        const j = c.misplaced.pop()!;
        if (this.balive[j] && this.bcarried[j] < 0) { this.bcarried[j] = i; this.carry[i] = CARRY.BROOD; this.carryIdx[i] = j; this.bqueued[j] = 0; break; }
        this.bqueued[j] = 0;
      }
      if (this.carry[i] === CARRY.BROOD) return;
      if (this.stepField(i, c.fields[FIELD.LARVA], sp, 2)) this.wanderUnder(i, sp * 0.5);
      return;
    }
    // Ouvrière du nid : creuser, sortir les cadavres, sinon flâner
    if (this.carry[i] === CARRY.CORPSE) {
      if (this.stepField(i, c.fields[FIELD.ENTRANCE], sp, 0)) { this.exit(i, c); this.state[i] = ST.TO_MIDDEN; this.timer[i] = 600; }
      return;
    }
    if (c.digCell >= 0) {
      if (st !== ST.DIG) { this.state[i] = ST.DIG; this.timer[i] = BIO.digTicks; }
      if (this.stepField(i, c.fields[FIELD.DIG], sp, 1)) {
        if (--this.timer[i] <= 0) { this.digCell(c, c.digCell); c.digCell = -1; this.state[i] = ST.IDLE; }
      }
      return;
    }
    if (st === ST.DIG) this.state[i] = ST.IDLE;
    if (this.ucorpses.length && (i + this.tick) % 30 === 0) {
      let best = -1, bd = 1e9;
      for (let k = 0; k < this.ucorpses.length; k++) { const u = this.ucorpses[k]; const d = (u.x - this.x[i]) ** 2 + (u.y - this.y[i]) ** 2; if (d < bd && this.dugOwner[this.ucell(u.x, u.y)] === c.id) { bd = d; best = k; } }
      if (best >= 0 && bd < 20 * 20) { this.ucorpses.splice(best, 1); this.carry[i] = CARRY.CORPSE; return; }
      if (best >= 0) { this.tx[i] = this.ucorpses[best].x; this.ty[i] = this.ucorpses[best].y; this.steer(i, this.tx[i], this.ty[i], 0.3, 0.1); this.moveUnder(i, sp); return; }
    }
    this.wanderUnder(i, sp * 0.6);
  }

  private exit(i: number, c: Colony) { this.layer[i] = 0; this.x[i] = (c.ex + 0.5) * CELL; this.y[i] = (c.ey + 0.5) * CELL; this.ang[i] = this.rng.float() * TAU; this.tgt[i] = -1; }

  // ---------- Déplacement ----------
  private steer(i: number, tx: number, ty: number, k: number, noise: number) {
    const want = Math.atan2(ty - this.y[i], tx - this.x[i]);
    this.ang[i] += wrapAngle(want - this.ang[i]) * k + this.rng.range(-noise, noise);
  }
  private moveSurface(i: number, sp: number) {
    const nx = this.x[i] + Math.cos(this.ang[i]) * sp, ny = this.y[i] + Math.sin(this.ang[i]) * sp;
    if (nx < 2 || nx > SW - 2 || ny < 2 || ny > SH - 2 || this.surf[this.scell(nx, ny)] === S.STONE) { this.ang[i] += Math.PI / 2 + this.rng.range(-0.8, 0.8); return false; }
    this.x[i] = nx; this.y[i] = ny; return true;
  }
  private moveUnder(i: number, sp: number) {
    const nx = this.x[i] + Math.cos(this.ang[i]) * sp, ny = this.y[i] + Math.sin(this.ang[i]) * sp;
    if (nx < 1 || nx > UW - 1 || ny < 1 || ny > UH - 1 || !this.dug[this.ucell(nx, ny)]) { this.ang[i] = this.rng.float() * TAU; return false; }
    this.x[i] = nx; this.y[i] = ny; return true;
  }
  private wanderUnder(i: number, sp: number) { if (this.rng.float() < 0.05) this.ang[i] += this.rng.range(-1, 1); this.moveUnder(i, sp); }
  /** Descend le champ de distance ; renvoie true une fois à `stop` cases ou moins de la cible. */
  private stepField(i: number, f: Int16Array, sp: number, stop: number) {
    const cidx = this.ucell(this.x[i], this.y[i]), d = f[cidx];
    if (d < 0) { this.wanderUnder(i, sp); return false; }
    if (d <= stop) return true;
    let best = -1, bv = d;
    const cx = cidx % UND_W, cy = cidx / UND_W | 0;
    if (cx > 0 && f[cidx - 1] >= 0 && f[cidx - 1] < bv) { bv = f[cidx - 1]; best = cidx - 1; }
    if (cx < UND_W - 1 && f[cidx + 1] >= 0 && f[cidx + 1] < bv) { bv = f[cidx + 1]; best = cidx + 1; }
    if (cy > 0 && f[cidx - UND_W] >= 0 && f[cidx - UND_W] < bv) { bv = f[cidx - UND_W]; best = cidx - UND_W; }
    if (cy < UND_H - 1 && f[cidx + UND_W] >= 0 && f[cidx + UND_W] < bv) { bv = f[cidx + UND_W]; best = cidx + UND_W; }
    if (best < 0) { this.wanderUnder(i, sp); return false; }
    const tx = (best % UND_W + 0.5) * CELL, ty = ((best / UND_W | 0) + 0.5) * CELL;
    this.ang[i] = Math.atan2(ty - this.y[i], tx - this.x[i]) + this.rng.range(-0.2, 0.2);
    if (!this.dug[best] && Math.hypot(tx - this.x[i], ty - this.y[i]) < CELL) return true; // devant la case à creuser
    this.moveUnder(i, sp);
    return false;
  }

  // ---------- Combat ----------
  private combat() {
    this.head.fill(-1);
    const fights = (i: number) => this.alive[i] && this.layer[i] === 0 && this.state[i] !== ST.FLY && this.state[i] !== ST.FOUND_WALK && this.state[i] !== ST.FOUND_DIG; // les reines fondatrices sont épargnées (sinon la colonie mère tue ses propres filles)
    for (let i = 0; i < this.n; i++) if (fights(i)) { const k = this.scell(this.x[i], this.y[i]); this.next[i] = this.head[k]; this.head[k] = i; }
    for (let i = 0; i < this.n; i++) {
      if (!fights(i)) continue;
      const cx = this.x[i] / CELL | 0, cy = this.y[i] / CELL | 0;
      for (let dy = -1; dy <= 1 && this.alive[i]; dy++) for (let dx = -1; dx <= 1 && this.alive[i]; dx++) {
        const X = cx + dx, Y = cy + dy; if (X < 0 || Y < 0 || X >= SURF_W || Y >= SURF_H) continue;
        for (let j = this.head[Y * SURF_W + X]; j >= 0; j = this.next[j]) {
          if (j <= i || this.col[j] === this.col[i] || !this.alive[j]) continue;
          if ((this.x[i] - this.x[j]) ** 2 + (this.y[i] - this.y[j]) ** 2 > 64) continue;
          this.hp[i] -= SPECIES[this.colonies[this.col[j]].species].dmg * 0.15;
          this.hp[j] -= SPECIES[this.colonies[this.col[i]].species].dmg * 0.15;
          this.ang[i] = Math.atan2(this.y[j] - this.y[i], this.x[j] - this.x[i]); this.ang[j] = this.ang[i] + Math.PI;
          if (this.hp[j] <= 0) this.kill(j);
          if (this.hp[i] <= 0) { this.kill(i); break; }
        }
      }
    }
  }

  // ---------- Sauter l'hiver ----------
  skipWinter() {
    const target = 2 / 12 + 0.003; // 1er mars (petite marge pour tomber dans le mois)
    let dt = ((target - this.yearFrac + 1) % 1) * YEAR; if (dt < 100) dt += YEAR;
    const dDays = dt / TICKS_PER_DAY;
    for (let i = 0; i < this.n; i++) if (this.alive[i]) {
      this.age[i] += dt;
      const r = this.role[i];
      if (r !== R.QUEEN && this.age[i] > (r >= 4 ? BIO.alateLife : BIO.workerLife)) this.kill(i, false);
      else if (r === R.QUEEN && this.age[i] > BIO.queenLife) this.kill(i, false);
      else if (this.layer[i] === 0) { const c = this.colonies[this.col[i]]; if (c.ex >= 0) { this.layer[i] = 1; this.x[i] = (c.ex + 0.5) * CELL; this.y[i] = 0.5 * CELL; this.state[i] = ST.IDLE; this.carry[i] = 0; this.tgt[i] = -1; } }
    }
    for (const c of this.colonies) {
      if (!c.alive) continue;
      const workers = c.counts[1] + c.counts[2] + c.counts[3];
      c.sugar -= workers * BIO.workerSugarPerDay * dDays * 0.1; c.reserve -= BIO.queenReserve * 0.5 * dt / BIO.queenDrainTicks * 0.1;
      if (c.sugar < 0) { const frac = clamp(-c.sugar / Math.max(1, workers * 0.2), 0, 0.6); c.sugar = 0; for (let i = 0; i < this.n; i++) if (this.alive[i] && this.col[i] === c.id && this.role[i] >= 1 && this.role[i] <= 3 && this.rng.float() < frac) this.kill(i, false); }
      c.phero.fill(0); c.misplaced.length = 0; c.flight = -1;
    }
    for (let j = 0; j < this.bn; j++) if (this.balive[j] && this.bstage[j] === 1 && this.bprog[j] > 0.5 && this.rng.float() < 0.3) this.killBrood(j);
    this.items = this.items.filter(it => it.kind !== 'corpse');
    this.ucorpses.length = 0;
    this.tick += Math.round(dt);
    this.say('Le printemps revient.');
  }

  // ---------- Sauvegarde ----------
  toJSON() {
    const me = this as unknown as Record<string, { subarray(a: number, b: number): ArrayLike<number> }>;
    const arr = (k: string, len: number) => Array.from(me[k].subarray(0, len));
    return {
      v: 1, tick: this.tick, seed: this.rng.s, tempOffset: this.tempOffset, preyTimer: this.preyTimer,
      surf: Array.from(this.surf), dug: Array.from(this.dug), dugOwner: Array.from(this.dugOwner),
      items: this.items, ucorpses: this.ucorpses, log: this.log,
      colonies: this.colonies.map(c => ({ ...c, phero: undefined, fields: undefined, misplaced: [] })),
      n: this.n, free: this.free, a: KEYS_A.map(k => arr(k, this.n)),
      bn: this.bn, bfree: this.bfree, b: KEYS_B.map(k => arr(k, this.bn)),
    };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static fromJSON(d: any): Sim {
    const s = new Sim(d.seed); s.tick = d.tick; s.tempOffset = d.tempOffset; s.preyTimer = d.preyTimer ?? BIO.preySpawnTicks;
    s.surf.set(d.surf); s.dug.set(d.dug); s.dugOwner.set(d.dugOwner); s.items = d.items; s.ucorpses = d.ucorpses; s.log = d.log ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    s.colonies = d.colonies.map((c: any) => ({ ...c, phero: new Float32Array(SURF_W * SURF_H), fields: [0, 1, 2, 3, 4].map(() => new Int16Array(UND_W * UND_H).fill(-1)), fieldsDirty: true, misplaced: [] }));
    s.n = d.n; s.free = d.free; s.bn = d.bn; s.bfree = d.bfree;
    const me = s as unknown as Record<string, { set(a: ArrayLike<number>): void }>;
    KEYS_A.forEach((k, idx) => me[k].set(d.a[idx]));
    KEYS_B.forEach((k, idx) => me[k].set(d.b[idx]));
    // Les portages sont annulés à la sauvegarde : on remet tout au sol
    for (let i = 0; i < s.n; i++) if (s.alive[i] && s.carry[i] === CARRY.BROOD) { s.carry[i] = 0; s.carryIdx[i] = -1; }
    for (let j = 0; j < s.bn; j++) { s.bcarried[j] = -1; s.bqueued[j] = 0; }
    return s;
  }
}
