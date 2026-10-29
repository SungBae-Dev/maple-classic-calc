/**
 * Damage taken from monsters and the chance they land a hit (NiaDB damage-taken formulas).
 *
 * Hit check:  G = max(0, playerLv − mobLv)
 *             A = mobACC × 100 / (5 × (G + 51))
 *             E = avoid / (1 + avoid/80) / (1 + G/40)
 *             f = 0.15 + 0.20 / (1 + e^((A − E)/12)),  R ~ U(1 − f, 1 + f)
 *             P(hit) = P(A·R ≥ E)  (or 2–3 % chip chance when E > A(1+f)), then + 8 % of the rest
 * Physical:   raw = trunc(ATK × ratio/100) × U(1.2, 1.4)
 *             taken = raw × (1 − DEF/(DEF + 300 + 2·raw)) − (DEF/25 + level/10), at least 1
 * Magic attacks use the same curve with magic defense (approximation — NiaDB documents the physical one).
 */

export interface Defender { level: number; hp?: number | null; wdef: number; mdef: number; avoid: number }
export interface Attack { atk: number; ratio?: number; magic?: boolean }

/** base avoidability from the stat window: floor(LUK/3) + floor(DEX/6) + 5 */
export function baseAvoid(dex: number, luk: number): number {
  return Math.floor(Math.max(0, luk) / 3) + Math.floor(Math.max(0, dex) / 6) + 5;
}

/** chance a monster's attack lands on the player */
export function mobHitChance(mobAcc: number, mobLv: number, p: Pick<Defender, 'level' | 'avoid'>): number {
  const G = Math.max(0, p.level - mobLv);
  const A = (mobAcc * 100) / (5 * (G + 51));
  const ev = Math.max(0, p.avoid);
  const E = ev / (1 + ev / 80) / (1 + G / 40);
  const f = 0.15 + 0.2 / (1 + Math.exp((A - E) / 12));
  let cand: number;
  if (A <= 0) cand = 0;
  else if (E > A * (1 + f)) cand = Math.min(0.03, Math.max(0.02, Math.exp((A - E) / 18) * 0.03));
  else cand = Math.min(1, Math.max(0, (1 + f - E / A) / (2 * f)));
  return cand + (1 - cand) * 0.08;
}

function takenAt(raw: number, def: number, level: number): number {
  const v = raw * (1 - def / (def + 300 + 2 * raw)) - (def / 25 + level / 10);
  return Math.trunc(Math.min(50_000_000, Math.max(1, v)));
}

export interface Taken { min: number; max: number; avg: number }

/** damage of one landed hit */
export function damageTaken(a: Attack, p: Pick<Defender, 'level' | 'wdef' | 'mdef'>): Taken {
  const eff = Math.trunc((Math.max(0, a.atk) * (a.ratio ?? 100)) / 100);
  const def = Math.max(0, a.magic ? p.mdef : p.wdef);
  const N = 40;
  let sum = 0;
  for (let i = 0; i <= N; i++) sum += takenAt(eff * (1.2 + (0.2 * i) / N), def, p.level);
  return { min: takenAt(eff * 1.2, def, p.level), max: takenAt(eff * 1.4, def, p.level), avg: sum / (N + 1) };
}

export type Danger = 'safe' | 'ok' | 'risky' | 'deadly' | 'unknown';

export interface MobThreat {
  hit: number;
  touch: Taken | null;
  magic: Taken | null;
  /** worst single hit among touch and the monster's attacks */
  worst: number;
  /** hits of the worst attack that kill you (null without HP) */
  hitsToDie: number | null;
  danger: Danger;
}

export interface MobAttackData { lv: number; acc?: number; patk?: number; matk?: number; attacks?: { type: string; ratio?: number }[] }

/** everything about getting hit by one monster */
export function threat(m: MobAttackData, p: Defender): MobThreat {
  const hit = m.acc != null ? mobHitChance(m.acc, m.lv, p) : 1;
  const touch = m.patk ? damageTaken({ atk: m.patk }, p) : null;
  let worst = touch ? touch.max : 0;
  let magic: Taken | null = null;
  for (const at of m.attacks || []) {
    const isMagic = at.type === 'magic';
    const base = isMagic ? m.matk : m.patk;
    if (!base) continue;
    const d = damageTaken({ atk: base, ratio: at.ratio ?? 100, magic: isMagic }, p);
    if (isMagic && (!magic || d.max > magic.max)) magic = d;
    worst = Math.max(worst, d.max);
  }
  const hp = p.hp && p.hp > 0 ? p.hp : null;
  const hitsToDie = hp && worst > 0 ? Math.ceil(hp / worst) : null;
  const danger: Danger = !worst ? 'unknown' : hitsToDie == null ? 'unknown'
    : hitsToDie <= 1 ? 'deadly' : hitsToDie <= 3 ? 'risky' : hitsToDie <= 8 ? 'ok' : 'safe';
  return { hit, touch, magic, worst, hitsToDie, danger };
}
