/**
 * Spec report: what the current character can do (hunting grounds, bosses)
 * and which upgrade moves the needle next. Pure functions on top of engine.ts.
 */
import * as E from './engine';

export interface MobData {
  id: number; en: string; ko: string; lv: number; hp: number; exp: number;
  eva: number; wdef: number; mdef: number;
  el: Partial<Record<Exclude<E.SkillElement, 'none'>, E.MobAffinity>>;
  tags: string[];
}

export type HuntStatus = 'oneshot' | 'oneshotAvg' | 'fast' | 'ok' | 'slow' | 'miss' | 'cant';

export interface HuntRow {
  mob: MobData;
  hit: number;
  /** expected landed damage per cast when it hits (no miss) */
  landedPerCast: number;
  /** minimum landed damage per cast (no crit) */
  minPerCast: number;
  /** casts to kill when every cast lands */
  castsIfHit: number;
  /** expected casts including misses */
  castsExpected: number;
  expPerCast: number;
  status: HuntStatus;
  needAcc: number | null;
  levelGap: number;
}

export function mobInput(m: MobData, element: E.ElementKey = 'neutral'): E.MobInput {
  return { enabled: true, level: m.lv, eva: m.eva, wdef: m.wdef, mdef: m.mdef, element, affinity: m.el };
}

function landed(c: E.CharInput, m: MobData) {
  const mob = mobInput(m);
  const ev = E.evaluate(c, mob);
  const hits = Math.max(1, Math.floor(c.hits || 1));
  const mult = ev.defMult * ev.elemMult * ev.lvMult;
  const avg = Math.min(E.DAMAGE_CAP, ev.raw.avg * mult * ev.critMult) * hits;
  const min = Math.min(E.DAMAGE_CAP, Math.max(1, ev.raw.min * mult)) * hits;
  return { ev, avg, min };
}

export function huntRow(c: E.CharInput, m: MobData): HuntRow {
  const { ev, avg, min } = landed(c, m);
  const hit = ev.hit;
  const castsIfHit = avg > 0 ? Math.max(1, Math.ceil(m.hp / avg)) : Infinity;
  const castsExpected = hit > 0 ? castsIfHit / hit : Infinity;
  let status: HuntStatus;
  if (hit <= 0) status = 'cant';
  else if (hit < 0.9) status = 'miss';
  else if (min >= m.hp) status = 'oneshot';
  else if (avg >= m.hp) status = 'oneshotAvg';
  else if (castsIfHit <= 2) status = 'fast';
  else if (castsIfHit <= 4) status = 'ok';
  else status = 'slow';
  return {
    mob: m, hit, landedPerCast: avg, minPerCast: min, castsIfHit, castsExpected,
    expPerCast: Number.isFinite(castsExpected) ? m.exp / castsExpected : 0,
    status, needAcc: E.accForFullHit(c.level, { level: m.lv, eva: m.eva }), levelGap: m.lv - c.level,
  };
}

export interface Report {
  rows: HuntRow[];
  /** best grinding targets for this spec (single-target EXP per cast) */
  recommended: HuntRow[];
  bosses: HuntRow[];
  /** next monster up the ladder that is not yet comfortable */
  nextTarget: HuntRow | null;
}

const GOOD: HuntStatus[] = ['oneshot', 'oneshotAvg', 'fast', 'ok'];

export function buildReport(c: E.CharInput, mobs: MobData[]): Report {
  const rows = mobs.map((m) => huntRow(c, m)).sort((a, b) => a.mob.lv - b.mob.lv || a.mob.id - b.mob.id);
  const field = rows.filter((r) => !r.mob.tags.includes('boss'));
  const lv = c.level;
  const recommended = field
    .filter((r) => GOOD.includes(r.status) && r.levelGap >= -15 && r.levelGap <= 10)
    .sort((a, b) => b.expPerCast - a.expPerCast)
    .slice(0, 5);
  const bosses = rows.filter((r) => r.mob.tags.includes('boss'));
  const topLv = recommended.length ? Math.max(...recommended.map((r) => r.mob.lv)) : lv - 15;
  const nextTarget = field.find((r) => r.mob.lv > topLv && r.mob.lv <= lv + 15 && !['oneshot', 'oneshotAvg', 'fast'].includes(r.status)) ?? null;
  return { rows, recommended, bosses, nextTarget };
}

// ───────────── upgrades ─────────────

export type UpgradeKey = 'levelAp' | 'watk1' | 'watk5' | 'matk1' | 'matk5' | 'mastery' | 'acc';

export interface Upgrade {
  key: UpgradeKey;
  /** expected-damage gain ratio against the reference target */
  gain: number;
  /** same gain expressed in main stat */
  mainEq: number;
  from?: number; to?: number; amount?: number;
}

/** expected damage per cast vs a reference mob (or raw when none) */
function value(c: E.CharInput, ref: MobData | null): number {
  if (!ref) return E.evaluate(c).perCast;
  return E.evaluate(c, mobInput(ref)).perCast;
}

function mainStatEquivalent(c: E.CharInput, ref: MobData | null, target: number): number {
  const p = E.WEAPONS[c.weapon].primary;
  const v0 = value(c, ref);
  if (!(v0 > 0) || target <= v0) return 0;
  let lo = 0, hi = Math.max(1000, E.primaryStat(c) * 10);
  if (value(E.withStat(c, p, hi), ref) < target) return Infinity;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (value(E.withStat(c, p, mid), ref) < target) lo = mid; else hi = mid;
  }
  return hi;
}

/** ranked next steps by expected-damage gain against `ref` */
export function upgrades(c: E.CharInput, ref: MobData | null): Upgrade[] {
  const v0 = value(c, ref);
  if (!(v0 > 0)) return [];
  const magic = E.isMagic(c);
  const p = E.WEAPONS[c.weapon].primary;
  const out: Upgrade[] = [];
  const push = (key: UpgradeKey, cc: E.CharInput, extra: Partial<Upgrade> = {}) => {
    const v1 = value(cc, ref);
    out.push({ key, gain: v1 / v0 - 1, mainEq: mainStatEquivalent(c, ref, v1), ...extra });
  };
  push('levelAp', E.withStat({ ...c, level: c.level + 1, acc: c.acc + (2 * 1) / (c.job === 'magician' ? 5.1 : c.job === 'bowman' ? 4.8 : c.job === 'thief' ? 4 : 2.5) }, p, 5), { amount: 5 });
  if (magic) {
    push('matk1', { ...c, matk: c.matk + 1 }, { amount: 1 });
    push('matk5', { ...c, matk: c.matk + 5 }, { amount: 5 });
  } else {
    push('watk1', { ...c, watk: c.watk + 1 }, { amount: 1 });
    push('watk5', { ...c, watk: c.watk + 5 }, { amount: 5 });
  }
  const lucky = !magic && E.normalizeAction(c) === 'lucky7';
  const ml = E.masteryLevelFromSkill(c.masterySkillLv);
  if (!lucky && ml < 10) {
    const nextSkillLv = ml === 0 ? 1 : (ml + 1) * 2;
    push('mastery', { ...c, masterySkillLv: nextSkillLv }, { from: c.masterySkillLv, to: nextSkillLv });
  }
  if (ref) {
    const need = E.accForFullHit(c.level, { level: ref.lv, eva: ref.eva });
    if (need != null && c.acc < need) push('acc', { ...c, acc: need }, { amount: need - c.acc });
  }
  return out.sort((a, b) => b.gain - a.gain);
}

export interface Goal {
  mob: MobData;
  /** current casts to kill (all land) */
  casts: number;
  targetCasts: number;
  /** extra W.ATK (or magic) to reach targetCasts */
  atk: number | null;
  /** extra main stat to reach targetCasts */
  main: number | null;
  /** extra accuracy for a guaranteed hit (0 when already enough) */
  acc: number;
}

function solveExtra(c: E.CharInput, m: MobData, apply: (c: E.CharInput, d: number) => E.CharInput, targetCasts: number, max = 2000): number | null {
  const ok = (d: number) => huntRow(apply(c, d), m).castsIfHit <= targetCasts;
  if (ok(0)) return 0;
  if (!ok(max)) return null;
  let lo = 0, hi = max;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (ok(mid)) hi = mid; else lo = mid;
  }
  return Math.ceil(hi);
}

/** what it takes to kill `m` one cast faster (or in one cast) */
export function goalFor(c: E.CharInput, m: MobData): Goal {
  const row = huntRow(c, m);
  const casts = Number.isFinite(row.castsIfHit) ? row.castsIfHit : 99;
  const targetCasts = Math.max(1, casts - 1);
  const magic = E.isMagic(c);
  const p = E.WEAPONS[c.weapon].primary;
  const atk = solveExtra(c, m, (cc, d) => (magic ? { ...cc, matk: cc.matk + d } : { ...cc, watk: cc.watk + d }), targetCasts);
  const main = solveExtra(c, m, (cc, d) => E.withStat(cc, p, d), targetCasts, 5000);
  const need = row.needAcc;
  return { mob: m, casts, targetCasts, atk, main, acc: need == null ? 0 : Math.max(0, need - c.acc) };
}

// ───────────── time, DPS, simulation, gear, scrolls ─────────────

export const DEFAULT_ATTACK_MS = 900;
const attackSec = (c: E.CharInput) => Math.max(0.05, (c.attackMs && c.attackMs > 0 ? c.attackMs : DEFAULT_ATTACK_MS) / 1000);

/** expected damage per second vs a monster (or raw), misses included */
export function dps(c: E.CharInput, ref: MobData | null): number {
  const ev = ref ? E.evaluate(c, mobInput(ref)) : E.evaluate(c);
  return ev.perCast / attackSec(c);
}

export interface TargetCheck {
  hit: number;
  avgPerCast: number;
  /** casts to kill: average, best case (max roll + crit), worst case (min roll) — all hits landing */
  casts: number; castsBest: number; castsWorst: number;
  dps: number;
  /** seconds to kill: HP ÷ DPS */
  seconds: number;
}

export function targetCheck(c: E.CharInput, m: MobData): TargetCheck {
  const mob = mobInput(m);
  const ev = E.evaluate(c, mob);
  const hits = Math.max(1, Math.floor(c.hits || 1));
  const mult = ev.defMult * ev.elemMult * ev.lvMult;
  const cap = (v: number) => Math.min(E.DAMAGE_CAP, Math.max(1, v));
  const avg = cap(ev.raw.avg * mult * ev.critMult) * hits;
  const critTop = c.critRate > 0 ? 1 + Math.max(0, c.critDmg) / 100 : 1;
  const best = cap(ev.raw.max * mult * critTop) * hits;
  const worst = cap(ev.raw.min * mult) * hits;
  const d = ev.perCast / attackSec(c);
  return {
    hit: ev.hit, avgPerCast: avg,
    casts: Math.max(1, Math.ceil(m.hp / avg)), castsBest: Math.max(1, Math.ceil(m.hp / best)), castsWorst: Math.max(1, Math.ceil(m.hp / worst)),
    dps: d, seconds: d > 0 ? m.hp / d : Infinity,
  };
}

export type SimKind = 'atk' | 'main' | 'acc';
export interface SimPoint { d: number; dps: number; casts: number | null; hit: number }

/** DPS (and casts to kill `ref`) as one stat grows; d = amount added */
export function simulate(c: E.CharInput, ref: MobData | null, kind: SimKind, steps: number[]): SimPoint[] {
  const magic = E.isMagic(c);
  const p = E.WEAPONS[c.weapon].primary;
  const apply = (d: number): E.CharInput => kind === 'atk' ? (magic ? { ...c, matk: c.matk + d } : { ...c, watk: c.watk + d })
    : kind === 'main' ? E.withStat(c, p, d) : { ...c, acc: c.acc + d };
  return steps.map((d) => {
    const cc = apply(d);
    const tc = ref ? targetCheck(cc, ref) : null;
    return { d, dps: dps(cc, ref), casts: tc ? tc.casts : null, hit: tc ? tc.hit : 1 };
  });
}

export interface GearDelta extends E.ItemDelta { attackMs?: number }
export interface GearSide { watk: number; matk: number; main: number; sec: number; attackMs: number; avgHit: number; dps: number; casts: number | null; seconds: number | null; hit: number }
export interface GearResult { before: GearSide; after: GearSide; dpsPct: number; avgPct: number; perMillion: number | null; afterChar: E.CharInput }

function side(c: E.CharInput, ref: MobData | null): GearSide {
  const tc = ref ? targetCheck(c, ref) : null;
  const ev = ref ? E.evaluate(c, mobInput(ref)) : E.evaluate(c);
  return {
    watk: c.watk, matk: c.matk, main: E.primaryStat(c), sec: E.secondaryStat(c), attackMs: (c.attackMs || DEFAULT_ATTACK_MS),
    avgHit: tc ? tc.avgPerCast / Math.max(1, Math.floor(c.hits || 1)) : ev.raw.avg * ev.critMult,
    dps: dps(c, ref), casts: tc ? tc.casts : null, seconds: tc ? tc.seconds : null, hit: ev.hit,
  };
}

/** compare current gear with a swap; cost in 10k mesos (만 메소) → DPS % per 1M mesos */
export function gearCompare(c: E.CharInput, d: GearDelta, ref: MobData | null, cost10k = 0): GearResult {
  const after = { ...E.applyDelta(c, d), attackMs: Math.max(50, (c.attackMs || DEFAULT_ATTACK_MS) + (d.attackMs || 0)) };
  const b = side(c, ref), a = side(after, ref);
  const dpsPct = b.dps > 0 ? a.dps / b.dps - 1 : 0;
  return {
    before: b, after: a, dpsPct, avgPct: b.avgHit > 0 ? a.avgHit / b.avgHit - 1 : 0,
    perMillion: cost10k > 0 ? (dpsPct * 100) / (cost10k / 100) : null,
    afterChar: after,
  };
}

export interface ScrollPlan { slots: number; successPct: number; gain: number; price10k: number }
export interface ScrollResult { expectedGain: number; dpsPct: number; costTotal10k: number; perMillion: number | null; allSuccessPct: number }

/** expected value of scrolling every slot with one scroll type (W.ATK or Magic ATT) */
export function scrollExpectation(c: E.CharInput, ref: MobData | null, plan: ScrollPlan): ScrollResult {
  const slots = Math.max(0, Math.floor(plan.slots));
  const p = Math.min(1, Math.max(0, plan.successPct / 100));
  const expectedGain = slots * p * plan.gain;
  const magic = E.isMagic(c);
  const cc = magic ? { ...c, matk: c.matk + expectedGain } : { ...c, watk: c.watk + expectedGain };
  const d0 = dps(c, ref), d1 = dps(cc, ref);
  const dpsPct = d0 > 0 ? d1 / d0 - 1 : 0;
  const costTotal10k = slots * Math.max(0, plan.price10k);
  return { expectedGain, dpsPct, costTotal10k, perMillion: costTotal10k > 0 ? (dpsPct * 100) / (costTotal10k / 100) : null, allSuccessPct: Math.pow(p, slots) * 100 };
}

// ───────────── N-shot table (N방컷) ─────────────

export interface ShotRow {
  n: number;
  /** extra W.ATK / magic for an average N-shot (0 = already), null = out of reach */
  atk: number | null;
  /** extra W.ATK / magic so even the lowest roll kills in N */
  atkSure: number | null;
  /** extra main stat for an average N-shot */
  main: number | null;
}

function solveMin(ok: (d: number) => boolean, max: number): number | null {
  if (ok(0)) return 0;
  if (!ok(max)) return null;
  let lo = 0, hi = max;
  for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (ok(mid)) hi = mid; else lo = mid; }
  return Math.ceil(hi - 1e-9);
}

/** what it takes to kill `m` in 1…upTo attacks (all landing) */
export function shotTable(c: E.CharInput, m: MobData, upTo = 5): ShotRow[] {
  const magic = E.isMagic(c);
  const p = E.WEAPONS[c.weapon].primary;
  const addAtk = (d: number): E.CharInput => (magic ? { ...c, matk: c.matk + d } : { ...c, watk: c.watk + d });
  const rows: ShotRow[] = [];
  for (let n = 1; n <= upTo; n++) {
    rows.push({
      n,
      atk: solveMin((d) => targetCheck(addAtk(d), m).casts <= n, 3000),
      atkSure: solveMin((d) => targetCheck(addAtk(d), m).castsWorst <= n, 3000),
      main: solveMin((d) => targetCheck(E.withStat(c, p, d), m).casts <= n, 20000),
    });
  }
  return rows;
}
