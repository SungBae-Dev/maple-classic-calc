/**
 * MapleStory Classic World (GMS) — damage & effective-main-stat engine
 * 메이플스토리 클래식 월드 데미지 · 환산 주스탯 엔진
 *
 * Formulas: NiaDB "MapleStory Classic Damage Formula" (community reverse-engineering)
 *   https://meowdb.com/msclassic/guides/explaining-the-damage-formula
 *   https://meowdb.com/msclassic/formulas/damage  (elements)
 * Values may change with patches — re-verify after game updates.
 *
 * Zero dependencies. Language-neutral: returns keys, the UI translates them.
 */

// ───────────────────────── types ─────────────────────────

export type Stat = 'str' | 'dex' | 'int' | 'luk';
export type JobGroup = 'warrior' | 'bowman' | 'thief' | 'magician';
export type Action = 'inherited' | 'swing' | 'stab' | 'shoot' | 'lucky7';
/** Final element multiplier class (MeowDB table) */
export type ElementKey = 'immune' | 'quarter' | 'half' | 'resist' | 'neutral' | 'weak' | 'enhanced';
/** Attack element of a skill */
export type SkillElement = 'none' | 'fire' | 'ice' | 'lightning' | 'poison' | 'holy';
/** Monster attribute toward one element */
export type MobAffinity = 'weak' | 'strong' | 'immune';
export type MasteryKey = 'sword' | 'axe' | 'blunt' | 'spear' | 'polearm' | 'bow' | 'crossbow' | 'claw' | 'dagger' | 'spell';
export type WeaponType =
  | '1h_sword' | '2h_sword' | '1h_axe' | '2h_axe' | '1h_blunt' | '2h_blunt'
  | 'spear' | 'polearm' | 'bow' | 'crossbow' | 'claw' | 'dagger' | 'wand' | 'staff';

export interface WeaponSpec {
  job: JobGroup;
  primary: Stat;
  /** physical-formula secondary stat(s); thieves use STR+DEX */
  secondary: Stat[];
  /** weapon multiplier per action */
  mult: Partial<Record<'swing' | 'stab' | 'shoot', number>>;
  actions: Action[];
  magic?: boolean;
  mastery: MasteryKey;
}

export interface CharInput {
  job: JobGroup;
  weapon: WeaponType;
  action: Action;
  level: number;
  /** stat-window totals (AP + gear + buffs) */
  str: number; dex: number; int: number; luk: number;
  /** total weapon attack: weapon + gear + stars/arrows */
  watk: number;
  /** passive Attack Power (e.g. Claw Mastery +20). Adds to the buff */
  apPassive: number;
  /** buff Attack Power (Rage, potions). Buffs don't stack → strongest one */
  apBuff: number;
  /** mastery skill level 0–20 */
  masterySkillLv: number;
  /** magician: gear + scroll + buff magic attack (excluding INT/2) */
  matk: number;
  /** stat-window accuracy */
  acc: number;
  critRate: number;   // %
  critDmg: number;    // %
  skillPct: number;   // % (basic attack = 100)
  hits: number;
  /** defense-ignore proc chance % (e.g. Blunt Mastery) */
  defIgnorePct: number;
  /** attack element of the skill */
  skillElement?: SkillElement;
}

export interface MobInput {
  enabled: boolean;
  level: number;
  eva: number;
  /** weapon (physical) defense */
  wdef: number;
  /** magic defense */
  mdef: number;
  /** manual element multiplier; ignored when `affinity` + skillElement resolve one */
  element: ElementKey;
  /** monster attributes per element (from a preset) */
  affinity?: Partial<Record<Exclude<SkillElement, 'none'>, MobAffinity>>;
}

// ───────────────────────── data ─────────────────────────

const MELEE: Action[] = ['inherited', 'swing', 'stab'];
const W = (job: JobGroup, primary: Stat, secondary: Stat[], mult: WeaponSpec['mult'], actions: Action[], mastery: MasteryKey, magic = false): WeaponSpec =>
  ({ job, primary, secondary, mult, actions, mastery, ...(magic ? { magic } : {}) });

export const WEAPONS: Record<WeaponType, WeaponSpec> = {
  '1h_sword': W('warrior', 'str', ['dex'], { swing: 1.8, stab: 1.8 }, ['inherited'], 'sword'),
  '2h_sword': W('warrior', 'str', ['dex'], { swing: 2.5, stab: 2.5 }, ['inherited'], 'sword'),
  '1h_axe':   W('warrior', 'str', ['dex'], { swing: 2.4, stab: 1.2 }, MELEE, 'axe'),
  '2h_axe':   W('warrior', 'str', ['dex'], { swing: 3.0, stab: 2.0 }, MELEE, 'axe'),
  '1h_blunt': W('warrior', 'str', ['dex'], { swing: 2.4, stab: 1.2 }, MELEE, 'blunt'),
  '2h_blunt': W('warrior', 'str', ['dex'], { swing: 3.0, stab: 2.0 }, MELEE, 'blunt'),
  'spear':    W('warrior', 'str', ['dex'], { swing: 1.5, stab: 3.5 }, MELEE, 'spear'),
  'polearm':  W('warrior', 'str', ['dex'], { swing: 3.5, stab: 1.5 }, MELEE, 'polearm'),
  'bow':      W('bowman', 'dex', ['str'], { shoot: 2.5 }, ['shoot'], 'bow'),
  'crossbow': W('bowman', 'dex', ['str'], { shoot: 2.5 }, ['shoot'], 'crossbow'),
  'claw':     W('thief', 'luk', ['str', 'dex'], { shoot: 2.5 }, ['shoot', 'lucky7'], 'claw'),
  'dagger':   W('thief', 'luk', ['str', 'dex'], { swing: 1.0, stab: 2.0 }, MELEE, 'dagger'),
  'wand':     W('magician', 'int', ['luk'], {}, [], 'spell', true),
  'staff':    W('magician', 'int', ['luk'], {}, [], 'spell', true),
};

export const JOBS: Record<JobGroup, WeaponType[]> = {
  warrior:  ['1h_sword', '2h_sword', '1h_axe', '2h_axe', '1h_blunt', '2h_blunt', 'spear', 'polearm'],
  bowman:   ['bow', 'crossbow'],
  thief:    ['claw', 'dagger'],
  magician: ['wand', 'staff'],
};

export const ACTIONS: Action[] = ['inherited', 'swing', 'stab', 'shoot', 'lucky7'];

export const ELEMENT_MULT: Record<ElementKey, number> = {
  immune: 0, quarter: 0.25, half: 0.5, resist: 0.75, neutral: 1, weak: 1.25, enhanced: 1.5,
};
export const ELEMENT_KEYS = Object.keys(ELEMENT_MULT) as ElementKey[];
export const SKILL_ELEMENTS: SkillElement[] = ['none', 'fire', 'ice', 'lightning', 'poison', 'holy'];

/** accuracy gained per stat point (slope of each job's ACC formula, floors ignored) */
export const ACC_COEF: Record<JobGroup, Partial<Record<Stat, number>>> = {
  warrior:  { dex: 1.2 / 2.5, luk: 0.6 / 2.5 },
  bowman:   { dex: 1.2 / 4.8, luk: 0.6 / 4.8 },
  thief:    { dex: 1.2 / 4,   luk: 0.6 / 4 },
  magician: { int: 1.2 / 5.1, luk: 0.6 / 5.1 },
};

export const STAT_LABEL: Record<Stat, string> = { str: 'STR', dex: 'DEX', int: 'INT', luk: 'LUK' };

const STAT_DIV = 100;
const AP_DIV = 50;
export const DAMAGE_CAP = 99_999;

// ───────────────────────── utils ─────────────────────────

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

export function isMagic(c: CharInput): boolean {
  return !!WEAPONS[c.weapon]?.magic;
}

/** mastery skill level (0–20) → mastery level (0–10). NiaDB skill table: 1→1, 4→2, 6→3 … 20→10 */
export function masteryLevelFromSkill(skillLv: number): number {
  const lv = clamp(Math.floor(num(skillLv)), 0, 20);
  if (lv <= 0) return 0;
  return Math.max(1, Math.floor(lv / 2));
}

/** m = (MasteryLevel / 10 + 0.1) × 0.7 */
export function masteryFactor(masteryLv: number): number {
  return (clamp(masteryLv, 0, 10) / 10 + 0.1) * 0.7;
}

function effectiveMastery(c: CharInput, masteryLvOverride?: number): number {
  if (!isMagic(c) && normalizeAction(c) === 'lucky7') return 0.5;
  const ml = masteryLvOverride ?? masteryLevelFromSkill(c.masterySkillLv);
  return masteryFactor(ml);
}

/** fall back to the weapon's default action when the chosen one is invalid */
export function normalizeAction(c: CharInput): Action {
  const w = WEAPONS[c.weapon];
  if (!w || w.magic) return c.action;
  return w.actions.includes(c.action) ? c.action : w.actions[0];
}

/** weapon multiplier: w = expected, wMin/wMax = range ends */
export function weaponMults(c: CharInput): { w: number; wMin: number; wMax: number } {
  const spec = WEAPONS[c.weapon];
  const action = normalizeAction(c);
  if (action === 'lucky7') return { w: 3.0, wMin: 3.0, wMax: 3.0 };
  if (action === 'shoot') {
    const s = spec.mult.shoot ?? 1;
    return { w: s, wMin: s, wMax: s };
  }
  const sw = spec.mult.swing ?? 1;
  const st = spec.mult.stab ?? sw;
  if (action === 'swing') return { w: sw, wMin: sw, wMax: sw };
  if (action === 'stab') return { w: st, wMin: st, wMax: st };
  // inherited: 3 swing + 2 stab entries → 60/40 expectation; range uses both ends
  return { w: 0.6 * sw + 0.4 * st, wMin: Math.min(sw, st), wMax: Math.max(sw, st) };
}

export function primaryStat(c: CharInput): number {
  return num(c[WEAPONS[c.weapon].primary]);
}

export function secondaryStat(c: CharInput): number {
  return WEAPONS[c.weapon].secondary.reduce((s, k) => s + num(c[k]), 0);
}

export function totalAP(c: CharInput): number {
  return num(c.apPassive) + num(c.apBuff);
}

export function magicTotal(c: CharInput, smooth = false): number {
  const i = num(c.int);
  return (smooth ? i / 2 : Math.floor(i / 2)) + num(c.matk);
}

// ───────────────────────── damage range ─────────────────────────

export interface Range { min: number; max: number; avg: number }

/** raw range with skill factor S (before defense, element, crit) */
export function rawRange(c: CharInput, S = 1, smooth = false, masteryLvOverride?: number): Range {
  const m = effectiveMastery(c, masteryLvOverride);
  if (isMagic(c)) {
    const mt = magicTotal(c, smooth);
    const i = num(c.int);
    const min = S * mt * (1 + (i * m) / 125);
    const max = S * mt * (1 + i / 125);
    return { min, max, avg: (min + max) / 2 };
  }
  const P = primaryStat(c);
  const Q = secondaryStat(c);
  const A = totalAP(c);
  const TW = num(c.watk);
  const { w, wMin, wMax } = weaponMults(c);
  const min = S * TW * (0.8 + (P * m * wMin + Q) / STAT_DIV + A / AP_DIV);
  const max = S * TW * (1.0 + (P * wMax + Q) / STAT_DIV + A / AP_DIV);
  // B~U(0.8,1), Q~U(P·m, P), independent → mean
  const avg = S * TW * (0.9 + ((P * (m + 1)) / 2 * w + Q) / STAT_DIV + A / AP_DIV);
  return { min, max, avg };
}

/**
 * Stat-window damage range (for verifying inputs). One basic attack, no defense/crit/skill.
 * Melee weapons show lowest MIN ~ highest MAX across swing and stab.
 */
export function statWindowRange(c: CharInput): { min: number; max: number; kind: 'physical' | 'magic' } {
  if (isMagic(c)) {
    const r = rawRange(c, 1);
    return { min: Math.trunc(r.min), max: Math.trunc(r.max), kind: 'magic' };
  }
  const spec = WEAPONS[c.weapon];
  const basic: CharInput = { ...c, action: spec.actions.includes('shoot') ? 'shoot' : 'inherited' };
  const r = rawRange(basic, 1);
  return { min: Math.trunc(r.min), max: Math.trunc(r.max), kind: 'physical' };
}

/** displayed range of one skill hit (truncated) */
export function skillRange(c: CharInput): { min: number; max: number } {
  const r = rawRange(c, num(c.skillPct, 100) / 100);
  return { min: Math.trunc(r.min), max: Math.trunc(r.max) };
}

// ───────────────────────── monster modifiers ─────────────────────────

export function hitChance(acc: number, playerLv: number, mob: Pick<MobInput, 'level' | 'eva'>): number {
  const L = Math.max(0, num(mob.level) - num(playerLv));
  const eva = Math.max(0, num(mob.eva));
  const A = (Math.max(0, num(acc)) * 100) / (10 * L + 255);
  const D = A - eva;
  if (D >= 25 + L * (0.5 * num(playerLv) + 15)) return 1;
  if (A <= 0) return eva <= 0 ? 1 : 0;
  const f = 0.15 + 0.2 / (1 + Math.exp(D / 12));
  const q = eva / A;
  if (q <= 1 - f) return 1;
  if (q >= 1 + f) return 0;
  return (1 + f - q) / (2 * f);
}

/** minimum accuracy for a guaranteed hit on this monster */
export function accForFullHit(playerLv: number, mob: Pick<MobInput, 'level' | 'eva'>): number | null {
  for (let a = 0; a <= 5000; a++) if (hitChance(a, playerLv, mob) >= 1) return a;
  return null;
}

export function levelScale(playerLv: number, mobLv: number): number {
  const gap = num(mobLv) - num(playerLv);
  if (gap <= 0) return 1;
  if (gap < 10) return 1 / (1 + gap * gap * 0.005);
  return 1 / (1 + gap * 0.05);
}

export function defenseMult(def: number, ignorePct = 0): number {
  const g = clamp(num(ignorePct) / 100, 0, 1);
  const d = Math.max(0, num(def));
  return (1 - g) * (100 / (d + 100)) + g;
}

/** single-element attack vs monster attribute → multiplier class (immune 0 · resistant 0.75 · neutral 1 · weak 1.25) */
export function elementFromAffinity(affinity: MobInput['affinity'], skillElement: SkillElement | undefined): ElementKey | null {
  if (!affinity || !skillElement || skillElement === 'none') return null;
  const a = affinity[skillElement];
  if (a === 'weak') return 'weak';
  if (a === 'strong') return 'resist';
  if (a === 'immune') return 'immune';
  return 'neutral';
}

export function resolveElement(c: CharInput, mob: MobInput): ElementKey {
  return elementFromAffinity(mob.affinity, c.skillElement) ?? (ELEMENT_MULT[mob.element] != null ? mob.element : 'neutral');
}

// ───────────────────────── expected damage ─────────────────────────

export interface Evaluation {
  raw: Range;
  critMult: number;
  defMult: number;
  element: ElementKey;
  elemMult: number;
  lvMult: number;
  hit: number;
  /** expected damage per hit (hit chance included) */
  perHit: number;
  /** expected damage per cast (× hits) */
  perCast: number;
}

export const NO_MOB: MobInput = { enabled: false, level: 1, eva: 0, wdef: 0, mdef: 0, element: 'neutral' };

export function evaluate(c: CharInput, mob: MobInput = NO_MOB, smooth = false, masteryLvOverride?: number): Evaluation {
  const S = num(c.skillPct, 100) / 100;
  const raw = rawRange(c, S, smooth, masteryLvOverride);
  const critMult = 1 + (clamp(num(c.critRate), 0, 100) / 100) * (Math.max(0, num(c.critDmg)) / 100);
  const hits = Math.max(1, Math.floor(num(c.hits, 1)));
  if (!mob?.enabled) {
    const perHit = raw.avg * critMult;
    return { raw, critMult, defMult: 1, element: 'neutral', elemMult: 1, lvMult: 1, hit: 1, perHit, perCast: perHit * hits };
  }
  const defMult = defenseMult(isMagic(c) ? mob.mdef : mob.wdef, c.defIgnorePct);
  const element = resolveElement(c, mob);
  const elemMult = ELEMENT_MULT[element];
  const lvMult = levelScale(c.level, mob.level);
  const hit = hitChance(c.acc, c.level, mob);
  const landed = Math.min(DAMAGE_CAP, raw.avg * defMult * elemMult * lvMult * critMult);
  const perHit = landed * hit;
  return { raw, critMult, defMult, element, elemMult, lvMult, hit, perHit, perCast: perHit * hits };
}

/** stat attack: mean raw damage of one basic attack (no skill/crit/monster) */
export function statAttack(c: CharInput): number {
  return rawRange({ ...c, skillPct: 100 }, 1).avg;
}

// ───────────────────────── conversion ─────────────────────────

/** change a stat and the accuracy it brings */
export function withStat(c: CharInput, stat: Stat, d: number): CharInput {
  const coef = ACC_COEF[c.job]?.[stat] ?? 0;
  return { ...c, [stat]: num(c[stat]) + d, acc: num(c.acc) + coef * d };
}

/**
 * Effective main stat (환산 주스탯): the main stat a reference character
 * (total W.ATK / magic = reference, secondary & AP = 0, same mastery & weapon multiplier)
 * would need to deal the same average damage as you.
 *  - no reference → your current W.ATK: "main stat with secondary & AP folded in"
 *  - pinned reference → also rises with W.ATK upgrades (progress tracking)
 * Pure gear metric: independent of monsters and accuracy.
 */
export function convertedMainStat(c: CharInput, ref?: number | null): number {
  const m = effectiveMastery(c);
  if (isMagic(c)) {
    const target = rawRange({ ...c, skillPct: 100 }, 1, true).avg; // MT·(1 + INT(1+m)/250)
    const r = ref != null && Number.isFinite(ref) ? ref : num(c.matk);
    const k = (1 + m) / 250;
    // (x/2 + r)(1 + kx) = target
    const a = k / 2, b = 0.5 + r * k, c0 = r - target;
    const disc = b * b - 4 * a * c0;
    return disc < 0 ? 0 : (-b + Math.sqrt(disc)) / (2 * a);
  }
  const TW = num(c.watk);
  const r = ref != null && Number.isFinite(ref) && ref > 0 ? ref : TW;
  if (r <= 0) return 0;
  const { w } = weaponMults(c);
  const avg = rawRange({ ...c, skillPct: 100 }, 1, true).avg;
  return ((avg / r - 0.9) * 2 * STAT_DIV) / ((1 + m) * w);
}

export type ConversionKey = 'watk' | 'ap' | 'matk' | 'acc' | 'mastery' | Stat;
export interface Conversion { key: ConversionKey; perPoint: number; from?: number; to?: number }

export interface ConversionResult {
  /** expected damage gained per main-stat point (one hit) */
  dmgPerMainStat: number;
  items: Conversion[];
  /** 0% hit on the monster → values computed without the monster */
  zeroHit?: boolean;
}

/** value of +1 of each stat, in main-stat units (with a monster: accuracy included) */
export function conversions(c: CharInput, mob: MobInput = NO_MOB): ConversionResult {
  const spec = WEAPONS[c.weapon];
  const V = (cc: CharInput, ml?: number) => evaluate(cc, mob, true, ml).perHit;
  const h = 0.5;
  const deriv = (f: (d: number) => CharInput) => (V(f(h)) - V(f(-h))) / (2 * h);

  const dP = deriv((d) => withStat(c, spec.primary, d));
  if (!(dP > 0)) {
    if (mob?.enabled) return { ...conversions(c, NO_MOB), zeroHit: true };
    return { dmgPerMainStat: 0, items: [] };
  }

  const items: Conversion[] = [];
  if (spec.magic) {
    items.push({ key: 'matk', perPoint: deriv((d) => ({ ...c, matk: num(c.matk) + d })) / dP });
  } else {
    items.push({ key: 'watk', perPoint: deriv((d) => ({ ...c, watk: num(c.watk) + d })) / dP });
    items.push({ key: 'ap', perPoint: deriv((d) => ({ ...c, apBuff: num(c.apBuff) + d })) / dP });
  }
  (['str', 'dex', 'int', 'luk'] as Stat[])
    .filter((s) => s !== spec.primary)
    .forEach((s) => {
      const v = deriv((d) => withStat(c, s, d)) / dP;
      if (Math.abs(v) > 1e-6) items.push({ key: s, perPoint: v });
    });
  if (mob?.enabled) {
    items.push({ key: 'acc', perPoint: deriv((d) => ({ ...c, acc: num(c.acc) + d })) / dP });
  }
  const lucky = !spec.magic && normalizeAction(c) === 'lucky7';
  const ml = masteryLevelFromSkill(c.masterySkillLv);
  if (!lucky && ml < 10) {
    items.push({ key: 'mastery', perPoint: (V(c, ml + 1) - V(c, ml)) / dP, from: ml, to: ml + 1 });
  }
  return { dmgPerMainStat: dP, items };
}

export interface ItemDelta { str?: number; dex?: number; int?: number; luk?: number; watk?: number; matk?: number; acc?: number }

export interface CompareResult {
  before: number;
  after: number;
  /** expected-damage change (accuracy included when a monster is set) */
  pct: number;
  /** stat-attack change (monster independent) */
  statAttackPct: number;
  /** main-stat change with the same effect */
  mainStatEq: number;
  /** effective-main-stat change (same reference) */
  convertedDelta: number;
}

export function applyDelta(c: CharInput, d: ItemDelta): CharInput {
  let out: CharInput = { ...c };
  (['str', 'dex', 'int', 'luk'] as Stat[]).forEach((s) => {
    if (num(d[s])) out = withStat(out, s, num(d[s]));
  });
  out.watk = num(out.watk) + num(d.watk);
  out.matk = num(out.matk) + num(d.matk);
  out.acc = num(out.acc) + num(d.acc);
  return out;
}

export function compareItem(c: CharInput, d: ItemDelta, mob: MobInput = NO_MOB, ref?: number | null): CompareResult {
  const after = applyDelta(c, d);
  const V = (cc: CharInput) => evaluate(cc, mob, true).perHit;
  const v0 = V(c);
  const v1 = V(after);
  const s0 = statAttack(c);
  const s1 = statAttack(after);
  const refVal = ref != null && Number.isFinite(ref) ? ref : isMagic(c) ? num(c.matk) : num(c.watk);

  const p = WEAPONS[c.weapon].primary;
  let lo = -primaryStat(c), hi = Math.max(1000, primaryStat(c) * 10);
  let x = 0;
  if (v0 > 0 && v1 !== v0) {
    for (let i = 0; i < 80; i++) {
      x = (lo + hi) / 2;
      if (V(withStat(c, p, x)) < v1) lo = x; else hi = x;
    }
    x = (lo + hi) / 2;
  }
  return {
    before: v0,
    after: v1,
    pct: v0 > 0 ? v1 / v0 - 1 : 0,
    statAttackPct: s0 > 0 ? s1 / s0 - 1 : 0,
    mainStatEq: x,
    convertedDelta: convertedMainStat(after, refVal) - convertedMainStat(c, refVal),
  };
}

// ───────────────────────── defaults ─────────────────────────

export const DEFAULT_CHAR: CharInput = {
  job: 'warrior', weapon: '2h_axe', action: 'inherited', level: 70,
  str: 337, dex: 70, int: 4, luk: 4,
  watk: 105, apPassive: 0, apBuff: 40, masterySkillLv: 20,
  matk: 0, acc: 100, critRate: 5, critDmg: 20,
  skillPct: 260, hits: 1, defIgnorePct: 0, skillElement: 'none',
};

export const DEFAULT_MOB: MobInput = { enabled: false, level: 70, eva: 41, wdef: 25, mdef: 5, element: 'neutral' };
