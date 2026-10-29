/**
 * Auto-fill: turn the few things a player types (job, level, stats, W.ATK, ACC)
 * into a full CharInput — skill %, hits, element, mastery, buffs, attack interval —
 * using Classic skill data and the SP guide. Any field the player fills in wins.
 */
import * as E from './engine';
import { guideFor, spAvailable, WEAPON_FAMILY } from './guides.js';

export interface LevelRow { lv: number; dmg?: number; hits?: number; targets?: number; mp?: number; ap?: number; matk?: number; mastery?: number; [k: string]: number | undefined }
export interface SkillInfo {
  slug: string; en: string; type: string; maxLv: number;
  dmgPct?: number; hits?: number; targets?: number; element?: string | null; atMax?: string; src?: string;
  animMs?: number; levels?: LevelRow[];
  /** per weapon group and speed stage: ms without / with booster */
  anim?: { weapon: string; stage: number; ms: number; boosterMs?: number; msMax?: number; boosterMsMax?: number }[];
}
export interface SkillDB {
  jobs: Record<string, { tier: number; src?: string; skills: SkillInfo[] }>;
  timing?: {
    boosterStages?: number; ordinaryAttackMs?: Record<string, number>; weaponStageRange?: Record<string, [number, number]>;
    magicFixedMs?: number; healMs?: number;
  };
}

/** raw input: overridable fields are null when the player left them empty */
export interface RawChar extends Omit<E.CharInput, 'skillPct' | 'hits' | 'masterySkillLv' | 'apPassive' | 'apBuff' | 'attackMs' | 'critRate' | 'critDmg' | 'defIgnorePct'> {
  skill: string;            // slug, 'basic', or 'auto'
  skillLv: number | null;
  skillPct: number | null;
  hits: number | null;
  masterySkillLv: number | null;
  apPassive: number | null;
  apBuff: number | null;
  attackMs: number | null;
  weaponStage: number | null;
  buffs: boolean;
  critRate: number | null;
  critDmg: number | null;
  defIgnorePct: number | null;
}

export interface SkillOption {
  slug: string; name: string; lv: number; maxLv: number; dmg: number; hits: number; targets: number;
  element: E.SkillElement; animMs: number; approx: boolean; dps: number; mastery?: number;
}

export interface Resolved {
  c: E.CharInput;
  skill: SkillOption | null;
  options: SkillOption[];
  est: Record<string, number>;
  auto: { skill: boolean; skillLv: boolean; skillPct: boolean; hits: boolean; mastery: boolean; apPassive: boolean; apBuff: boolean; attackMs: boolean; crit: boolean };
  booster: boolean; weaponStage: number;
  buffAp: { slug: string; lv: number; ap: number } | null;
  buffMatk: { slug: string; lv: number; matk: number } | null;
}

// which weapons can use which main attack
const WEAPON_GATE: Record<string, (w: E.WeaponType) => boolean> = {
  'power-strike': (w) => E.WEAPONS[w].job === 'warrior',
  'slash-blast': (w) => E.WEAPONS[w].job === 'warrior',
  'arrow-blow': (w) => w === 'bow' || w === 'crossbow',
  'double-shot': (w) => w === 'bow' || w === 'crossbow',
  'arrow-bomb-bow': (w) => w === 'bow',
  'iron-arrow-crossbow': (w) => w === 'crossbow',
  'lucky-seven': (w) => w === 'claw',
  drain: (w) => w === 'claw',
  'double-stab': (w) => w === 'dagger',
  'savage-blow': (w) => w === 'dagger',
};
const MAGIC_ATTACKS = new Set(['energy-bolt', 'magic-claw', 'fire-arrow', 'poison-breath', 'cold-beam', 'thunder-bolt', 'holy-arrow']);
const MASTERY_SKILL: Record<string, string> = {
  sword: 'sword-mastery', axe: 'axe-mastery', blunt: 'blunt-weapon-mastery', spear: 'spear-mastery', polearm: 'polearm-mastery',
  bow: 'bow-mastery', crossbow: 'crossbow-mastery', claw: 'claw-mastery', dagger: 'dagger-mastery',
};
const BOOSTER_SKILL: Record<string, string> = {
  sword: 'sword-booster', axe: 'axe-booster', blunt: 'blunt-weapon-booster', spear: 'spear-booster', polearm: 'polearm-booster',
  bow: 'bow-booster', crossbow: 'crossbow-booster', claw: 'claw-booster', dagger: 'dagger-booster',
};
/** base element of magic attacks (others: none) */
const SKILL_ELEMENT: Record<string, E.SkillElement> = {
  'fire-arrow': 'fire', 'poison-breath': 'poison', 'cold-beam': 'ice', 'thunder-bolt': 'lightning', 'holy-arrow': 'holy',
};
export const DEFAULT_STAGE = 6;
const BASIC_ANIM = 600;

const ANIM_GROUP: Record<string, string> = {
  '1h_sword': '1h_sword_axe_mace', '1h_axe': '1h_sword_axe_mace', '1h_blunt': '1h_sword_axe_mace',
  '2h_sword': '2h_sword_axe_mace', '2h_axe': '2h_sword_axe_mace', '2h_blunt': '2h_sword_axe_mace',
  spear: 'spear_polearm', polearm: 'spear_polearm', bow: 'bow', crossbow: 'crossbow', claw: 'claw', dagger: 'dagger',
};
const STAGE_KEY: Record<string, string> = { '1h_blunt': '1h_mace', '2h_blunt': '2h_mace' };
const FALLBACK_ORDINARY: Record<string, number> = { 0: 510, 1: 570, 2: 600, 3: 660, 4: 720, 5: 750, 6: 810, 7: 870, 8: 900, 9: 960, 10: 1020, 11: 1020, 12: 1020 };
const up30 = (ms: number) => 30 * Math.ceil(ms / 30 - 1e-9);

/** typical speed stage of a weapon type (slower end of the NiaDB range) */
export function defaultStage(db: SkillDB, weapon: E.WeaponType): number {
  const r = db.timing?.weaponStageRange?.[STAGE_KEY[weapon] || weapon];
  return r ? r[1] : DEFAULT_STAGE;
}

/** attack time for a skill on a weapon at a speed stage (booster = −2 stages) */
export function skillTime(db: SkillDB, sk: SkillInfo | null, weapon: E.WeaponType, stage: number, booster: boolean): { ms: number; approx: boolean } {
  const magic = !!E.WEAPONS[weapon]?.magic;
  if (magic) return { ms: sk?.slug === 'heal' ? (db.timing?.healMs ?? 600) : (db.timing?.magicFixedMs ?? 810), approx: false };
  const ord = db.timing?.ordinaryAttackMs || FALLBACK_ORDINARY;
  const bs = db.timing?.boosterStages ?? 2;
  const eff = (st: number) => Math.max(0, Math.min(12, st - (booster ? bs : 0)));
  const rows = (sk?.anim || []).filter((r) => r.weapon === ANIM_GROUP[weapon]);
  const pick = (r: NonNullable<SkillInfo['anim']>[number]) => {
    const a = booster ? (r.boosterMs ?? r.ms) : r.ms;
    const b = booster ? (r.boosterMsMax ?? r.msMax) : r.msMax;
    return b ? (a + b) / 2 : a;
  };
  if (rows.length) {
    const exact = rows.find((r) => r.stage === stage);
    if (exact) return { ms: up30(pick(exact)), approx: false };
    const near = rows.slice().sort((a, b) => Math.abs(a.stage - stage) - Math.abs(b.stage - stage))[0];
    return { ms: up30(pick(near) * (ord[eff(stage)] ?? 810) / (ord[eff(near.stage)] ?? 810)), approx: true };
  }
  return { ms: ord[eff(stage)] ?? 810, approx: !sk };
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function skillsOf(db: SkillDB, keys: string[]): Map<string, SkillInfo> {
  const m = new Map<string, SkillInfo>();
  keys.forEach((k) => (db.jobs[k]?.skills || []).forEach((s) => { if (!m.has(s.slug)) m.set(s.slug, s); }));
  return m;
}

/** skill levels a player following the SP guide would have at this level */
export function estimateLevels(db: SkillDB, job: E.JobGroup, subJob: string, weapon: E.WeaponType, level: number): Record<string, number> {
  const sp = spAvailable(job, level);
  const out: Record<string, number> = {};
  ([[job, sp.first], [subJob, sp.second]] as [string, number][]).forEach(([key, avail]) => {
    if (!key || !(avail > 0)) return;
    const skills = skillsOf(db, [key]);
    let left = avail;
    for (const st of guideFor(key, weapon)) {
      const sk = skills.get(st.skill);
      if (!sk) continue;
      const to = st.to === 'max' ? sk.maxLv : Math.min(st.to, sk.maxLv);
      const from = out[st.skill] || 0;
      const add = Math.min(Math.max(0, to - from), left);
      out[st.skill] = from + add;
      left -= add;
      if (left <= 0) break;
    }
  });
  return out;
}

/** values of a skill at a level (table first, else max-level values marked approx) */
export function skillAt(sk: SkillInfo, lv: number): { dmg: number | null; hits: number; targets: number; approx: boolean; row: LevelRow | null } {
  const L = Math.max(0, Math.min(sk.maxLv, Math.floor(lv)));
  if (sk.levels && sk.levels.length) {
    const rows = sk.levels.slice().sort((a, b) => a.lv - b.lv);
    const row = rows.filter((r) => r.lv <= L).pop() || null;
    if (row) return { dmg: num(row.dmg) ?? num(sk.dmgPct), hits: num(row.hits) ?? sk.hits ?? 1, targets: num(row.targets) ?? sk.targets ?? 1, approx: false, row };
  }
  return { dmg: num(sk.dmgPct), hits: sk.hits ?? 1, targets: sk.targets ?? 1, approx: L < sk.maxLv, row: null };
}

/** modeled attack time: base action scaled by weapon speed stage (booster −2), rounded up to 30 ms */
export function attackTime(baseMs: number, magic: boolean, stage: number, booster: boolean, boosterStages = 2): number {
  if (magic) return 30 * Math.ceil(baseMs / 30);
  const tier = Math.max(0, Math.min(10, stage - (booster ? boosterStages : 0)));
  return 30 * Math.ceil((baseMs * (10 + tier)) / 16 / 30);
}

export function resolve(raw: RawChar, db: SkillDB, mob: E.MobInput = E.NO_MOB): Resolved {
  const fam = WEAPON_FAMILY[raw.weapon];
  const magic = !!E.WEAPONS[raw.weapon]?.magic;
  const keys = [raw.job, raw.subJob || ''].filter(Boolean);
  const skills = skillsOf(db, keys);
  const est = estimateLevels(db, raw.job, raw.subJob || '', raw.weapon, raw.level);
  const lvOf = (slug: string) => est[slug] || 0;

  // mastery / booster / buffs
  const mSlug = MASTERY_SKILL[fam];
  const masteryAuto = raw.masterySkillLv == null;
  const masterySkillLv = masteryAuto ? (mSlug ? lvOf(mSlug) : 0) : raw.masterySkillLv!;
  const bSlug = BOOSTER_SKILL[fam];
  const booster = raw.buffs && !!bSlug && lvOf(bSlug) > 0;
  const stage = raw.weaponStage ?? defaultStage(db, raw.weapon);

  let apPassive = raw.apPassive;
  const apPassiveAuto = apPassive == null;
  if (apPassiveAuto) {
    apPassive = 0;
    if (fam === 'claw' && skills.has('claw-mastery')) {
      const at = skillAt(skills.get('claw-mastery')!, masterySkillLv);
      apPassive = num(at.row?.ap) ?? masterySkillLv; // Claw Mastery: Attack Power +1 per level
    }
  }
  let buffAp: Resolved['buffAp'] = null;
  if (raw.buffs && raw.subJob === 'fighter' && skills.has('rage') && lvOf('rage') > 0) {
    const sk = skills.get('rage')!;
    const at = skillAt(sk, lvOf('rage'));
    const ap = num(at.row?.ap) ?? (lvOf('rage') >= sk.maxLv ? 40 : null);
    if (ap != null) buffAp = { slug: 'rage', lv: lvOf('rage'), ap };
  }
  const apBuffAuto = raw.apBuff == null;
  const apBuff = apBuffAuto ? (buffAp ? buffAp.ap : 0) : raw.apBuff!;
  let buffMatk: Resolved['buffMatk'] = null;
  if (raw.buffs && magic && skills.has('meditation') && lvOf('meditation') > 0) {
    const sk = skills.get('meditation')!;
    const at = skillAt(sk, lvOf('meditation'));
    const m = num(at.row?.matk) ?? (lvOf('meditation') >= sk.maxLv ? 25 : null);
    if (m != null) buffMatk = { slug: 'meditation', lv: lvOf('meditation'), matk: m };
  }

  const baseChar: E.CharInput = {
    job: raw.job, weapon: raw.weapon, action: raw.action, level: raw.level, subJob: raw.subJob,
    str: raw.str, dex: raw.dex, int: raw.int, luk: raw.luk, watk: raw.watk, acc: raw.acc,
    matk: raw.matk + (buffMatk ? buffMatk.matk : 0),
    apPassive: apPassive!, apBuff, masterySkillLv,
    critRate: raw.critRate ?? 5, critDmg: raw.critDmg ?? 20, defIgnorePct: raw.defIgnorePct ?? 0,
    skillPct: 100, hits: 1, skillElement: raw.skillElement, attackMs: skillTime(db, null, raw.weapon, stage, booster).ms,
  };

  // selectable attacks
  const options: SkillOption[] = [];
  const evalOpt = (o: Omit<SkillOption, 'dps'>): SkillOption => {
    const cc = optionChar(baseChar, o, raw, magic);
    const ev = E.evaluate(cc, mob);
    return { ...o, dps: ev.perCast / (cc.attackMs! / 1000) };
  };
  for (const sk of skills.values()) {
    const usable = magic ? MAGIC_ATTACKS.has(sk.slug) : (WEAPON_GATE[sk.slug]?.(raw.weapon) ?? false);
    if (!usable) continue;
    const lv = raw.skill === sk.slug && raw.skillLv != null ? raw.skillLv : lvOf(sk.slug);
    const at = skillAt(sk, Math.max(1, lv));
    if (at.dmg == null) continue;
    const tm = skillTime(db, sk, raw.weapon, stage, booster);
    options.push(evalOpt({
      slug: sk.slug, name: sk.en, lv, maxLv: sk.maxLv, dmg: at.dmg, hits: at.hits, targets: at.targets,
      element: (SKILL_ELEMENT[sk.slug] || 'none'), animMs: tm.ms, approx: at.approx || tm.approx,
      mastery: num(at.row?.mastery) ?? undefined,
    }));
  }
  const basic = evalOpt({ slug: 'basic', name: 'Basic attack', lv: 0, maxLv: 0, dmg: 100, hits: 1, targets: 1, element: 'none', animMs: skillTime(db, null, raw.weapon, stage, booster).ms, approx: false });

  let chosen: SkillOption | null;
  const skillAuto = !raw.skill || raw.skill === 'auto';
  if (raw.skill === 'basic') chosen = basic;
  else if (!skillAuto) chosen = options.find((o) => o.slug === raw.skill) || null;
  else chosen = null;
  if (!chosen) {
    const learned = options.filter((o) => o.lv > 0);
    chosen = learned.sort((a, b) => b.dps - a.dps)[0] || basic;
  }
  const c = optionChar(baseChar, chosen, raw, magic);
  return {
    c, skill: chosen, options: [...options.sort((a, b) => b.dps - a.dps), basic], est,
    auto: {
      skill: skillAuto, skillLv: raw.skillLv == null, skillPct: raw.skillPct == null, hits: raw.hits == null,
      mastery: masteryAuto, apPassive: apPassiveAuto, apBuff: apBuffAuto, attackMs: raw.attackMs == null, crit: raw.critRate == null && raw.critDmg == null,
    },
    booster, weaponStage: stage, buffAp, buffMatk,
  };

  function optionChar(b: E.CharInput, o: Omit<SkillOption, 'dps'>, r: RawChar, mg: boolean): E.CharInput {
    const action: E.Action = o.slug === 'lucky-seven' ? 'lucky7' : (b.weapon === 'claw' && b.action === 'lucky7') ? 'shoot' : b.action;
    return {
      ...b,
      action,
      skillPct: r.skillPct ?? o.dmg,
      hits: r.hits ?? o.hits,
      skillElement: (r.skillElement && r.skillElement !== 'none') ? r.skillElement : o.element,
      attackMs: r.attackMs ?? o.animMs,
      masteryLv: mg ? (r.masterySkillLv != null ? Math.min(10, r.masterySkillLv) : (o.mastery ?? 0)) : undefined,
    };
  }
}
