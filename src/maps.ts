/**
 * Map efficiency: kills and EXP per hour on a training map.
 *
 * Respawn (NiaDB spawn-engine guide): one global respawn tick every 7.56 s.
 *  - wave-pool points refill on each tick up to capacity = points × 75 % solo
 *    (+5 % per extra player, 100 % at six), rounded down → capacity × 3600 / 7.56 per hour
 *  - timed points come back after their own timer (+ half a tick on average) and
 *    are not scaled by player count → 3600 / (timer + 3.78) per point per hour
 *
 * Player side: attacking seconds per kill = expected attacks (misses included) × attack
 * interval ÷ monsters hit per cast. Within `active` × 3600 s of attacking per hour the player
 * kills each monster type in proportion to how many of its points the map has, until a type
 * runs into its respawn limit; the time left goes to the other types (water-filling).
 * kills/hour is therefore the lower of kill speed and respawn, per monster type.
 */
import * as E from './engine';
import * as A from './advisor';

export interface MapSpawn { id: number; count: number; en?: string; lv?: number; hp?: number; exp?: number }
export interface MapTimed { id: number; en?: string; respawnS: number; respawnMaxS?: number }
export interface MapData {
  id: string; en: string; ko?: string; region?: string; regionKo?: string; street?: string; streetKo?: string;
  lv?: [number, number]; spawns: number; mobRate?: number; mobs: MapSpawn[]; timed?: MapTimed[]; src?: string;
}

export const RESPAWN = { tickS: 7.56, cooldownS: 5, soloScalar: 0.75, perExtraPlayer: 0.05, fullPlayers: 6 };
export const DEFAULT_ACTIVE = 0.6;
export const DEFAULT_PACK = 3;
/** monsters this far above the player keep a map out of the recommendations */
export const MAX_LEVEL_ABOVE = 10;

export function playerScalar(players = 1): number {
  const p = Math.max(1, Math.floor(players));
  return Math.min(1, RESPAWN.soloScalar + RESPAWN.perExtraPlayer * (p - 1));
}

/** most wave-pool monsters alive at once */
export function capacity(wavePoints: number, players = 1): number {
  return Math.floor(wavePoints * playerScalar(players) + 1e-9);
}

/** most wave-pool monsters the map can put back per hour (each tick refills to capacity) */
export function respawnPerHour(wavePoints: number, players = 1): number {
  return (capacity(wavePoints, players) * 3600) / RESPAWN.tickS;
}

/** one timed point: spawns per hour */
export function timedPerHour(t: MapTimed): number {
  const s = t.respawnMaxS && t.respawnMaxS > t.respawnS ? (t.respawnS + t.respawnMaxS) / 2 : t.respawnS;
  return 3600 / (Math.max(0, s) + RESPAWN.tickS / 2);
}

export interface MapRates {
  wavePoints: number; timedPoints: number;
  /** wave capacity + timed points */
  cap: number;
  /** per monster id: spawns per hour */
  perMob: Map<number, number>;
  total: number;
}

/** respawn limits of a map, before any player is involved */
export function mapRates(map: MapData, players = 1, skip: (id: number) => boolean = () => false): MapRates {
  const timed = new Map((map.timed || []).map((t) => [t.id, t]));
  const live = map.mobs.filter((x) => !skip(x.id));
  const wavePoints = live.filter((x) => !timed.has(x.id)).reduce((s, x) => s + x.count, 0);
  const timedPoints = live.filter((x) => timed.has(x.id)).reduce((s, x) => s + x.count, 0);
  const wave = wavePoints > 0 ? respawnPerHour(wavePoints, players) : 0;
  const perMob = new Map<number, number>();
  for (const x of live) {
    const t = timed.get(x.id);
    perMob.set(x.id, (perMob.get(x.id) || 0) + (t ? x.count * timedPerHour(t) : (wave * x.count) / wavePoints));
  }
  return { wavePoints, timedPoints, cap: capacity(wavePoints, players) + timedPoints, perMob, total: [...perMob.values()].reduce((s, v) => s + v, 0) };
}

export interface EffOptions {
  /** max monsters the skill hits per cast */
  targets?: number;
  /** monsters actually caught per cast with a multi-target skill (default min(targets, 3)) */
  pack?: number | null;
  /** share of the hour spent attacking — walking, looting and waiting excluded */
  active?: number;
  expRate?: number;
  players?: number;
}

export interface MapMobEff {
  spawn: MapSpawn;
  mob: A.MobData | null;
  timed: MapTimed | null;
  /** share of the map's spawn points */
  share: number;
  row: A.HuntRow | null;
  /** attacking seconds per kill after multi-target (misses included) */
  secPerKill: number;
  /** bosses are listed but not farmed */
  boss: boolean;
  killable: boolean;
  /** spawns per hour of this monster on this map */
  respawn: number;
  /** kills per hour in the estimate */
  kills: number;
}

export type MapStatus = 'good' | 'ok' | 'slow' | 'miss' | 'hard' | 'blocked';

export interface MapEff {
  map: MapData;
  /** monsters alive at once, solo (wave capacity + timed points) */
  cap: number;
  /** respawn ceiling (kills/hour) for the monsters you can kill */
  ceiling: number;
  mobs: MapMobEff[];
  perCast: number;
  /** spawn-weighted hit chance and the lowest one */
  hit: number; minHit: number;
  /** spawn-weighted casts to kill (all landing) */
  avgCasts: number;
  /** kills/hour if monsters never ran out */
  playerKph: number;
  kph: number;
  limit: 'dps' | 'respawn';
  expPerKill: number;
  eph: number;
  status: MapStatus;
  lvMin: number; lvMax: number;
}

const attackSec = (c: E.CharInput) => Math.max(0.05, (c.attackMs && c.attackMs > 0 ? c.attackMs : A.DEFAULT_ATTACK_MS) / 1000);

export function mobsPerCast(o: EffOptions): number {
  const targets = Math.max(1, Math.floor(o.targets || 1));
  if (targets <= 1) return 1;
  const pack = o.pack != null && o.pack > 0 ? o.pack : DEFAULT_PACK;
  return Math.max(1, Math.min(targets, pack));
}

export function mapEfficiency(c: E.CharInput, map: MapData, mobsById: Map<number, A.MobData>, o: EffOptions = {}): MapEff {
  const perCast = mobsPerCast(o);
  const active = o.active != null ? Math.min(1, Math.max(0.05, o.active)) : DEFAULT_ACTIVE;
  const expRate = o.expRate && o.expRate > 0 ? o.expRate : 1;
  const players = o.players || 1;
  const atk = attackSec(c);
  const timedById = new Map((map.timed || []).map((t) => [t.id, t]));
  const isBoss = (id: number) => !!mobsById.get(id)?.tags.includes('boss');
  const rates = mapRates(map, players, isBoss);
  const farmTotal = map.mobs.filter((x) => !isBoss(x.id)).reduce((s, x) => s + x.count, 0) || 1;

  const mobs: MapMobEff[] = map.mobs.map((spawn) => {
    const mob = mobsById.get(spawn.id) ?? null;
    const boss = isBoss(spawn.id);
    const row = mob ? A.huntRow(c, mob) : null;
    const sec = row && Number.isFinite(row.castsExpected) ? (row.castsExpected * atk) / perCast : Infinity;
    return {
      spawn, mob, timed: timedById.get(spawn.id) ?? null, share: boss ? 0 : spawn.count / farmTotal, row, secPerKill: sec, boss,
      killable: !boss && !!row && row.hit > 0 && Number.isFinite(sec), respawn: rates.perMob.get(spawn.id) ?? 0, kills: 0,
    };
  });
  const farm = mobs.filter((m) => m.killable);

  // water-filling: kills_i = min(respawn_i, k · points_i) with Σ kills_i · sec_i = budget
  const budget = 3600 * active;
  const spend = (k: number) => farm.reduce((s, m) => s + Math.min(m.respawn, k * m.spawn.count) * m.secPerKill, 0);
  const full = farm.reduce((s, m) => s + m.respawn * m.secPerKill, 0);
  let limit: 'dps' | 'respawn' = 'respawn';
  if (full > budget) {
    limit = 'dps';
    let lo = 0, hi = Math.max(...farm.map((m) => m.respawn / m.spawn.count));
    for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; if (spend(mid) > budget) hi = mid; else lo = mid; }
    farm.forEach((m) => { m.kills = Math.min(m.respawn, lo * m.spawn.count); });
  } else {
    farm.forEach((m) => { m.kills = m.respawn; });
  }
  const kph = farm.reduce((s, m) => s + m.kills, 0);
  const eph = farm.reduce((s, m) => s + m.kills * m.mob!.exp, 0) * expRate;
  const pts = farm.reduce((s, m) => s + m.spawn.count, 0);
  const avgSec = pts ? farm.reduce((s, m) => s + m.spawn.count * m.secPerKill, 0) / pts : Infinity;

  const field = mobs.filter((m) => !m.boss);
  const fieldPts = field.reduce((s, m) => s + m.spawn.count, 0) || 1;
  const hitOf = (m: MapMobEff) => (m.row ? m.row.hit : 0);
  const hit = field.reduce((s, m) => s + m.spawn.count * hitOf(m), 0) / fieldPts;
  const minHit = field.length ? Math.min(...field.map(hitOf)) : 0;
  const avgCasts = pts ? farm.reduce((s, m) => s + m.spawn.count * m.row!.castsIfHit, 0) / pts : Infinity;
  const lvs = field.map((m) => m.mob?.lv ?? m.spawn.lv ?? 0).filter((x) => x > 0);
  const lvMin = lvs.length ? Math.min(...lvs) : 0;
  const lvMax = lvs.length ? Math.max(...lvs) : 0;
  // an unkillable wave monster never dies and slowly takes over the map's capacity
  const clogged = field.some((m) => !m.killable && !m.timed);

  let status: MapStatus;
  if (!farm.length || clogged) {
    // the estimate is meaningless once the map fills up with monsters you can't kill
    status = 'blocked';
    return {
      map, cap: rates.cap, ceiling: 0, mobs: mobs.map((m) => ({ ...m, kills: 0 })), perCast, hit, minHit, avgCasts,
      playerKph: 0, kph: 0, limit: 'dps', expPerKill: 0, eph: 0, status, lvMin, lvMax,
    };
  }
  else if (lvMax - c.level > MAX_LEVEL_ABOVE) status = 'hard';
  else if (hit < 0.9) status = 'miss';
  else if (avgCasts <= 2) status = 'good';
  else if (avgCasts <= 4) status = 'ok';
  else status = 'slow';

  return {
    map, cap: rates.cap, ceiling: farm.reduce((s, m) => s + m.respawn, 0), mobs, perCast, hit, minHit, avgCasts,
    playerKph: avgSec > 0 && Number.isFinite(avgSec) ? budget / avgSec : 0,
    kph, limit, expPerKill: kph > 0 ? eph / kph : 0, eph, status, lvMin, lvMax,
  };
}

const RECOMMENDABLE: MapStatus[] = ['good', 'ok', 'slow'];

export function isRecommendable(e: MapEff): boolean {
  return RECOMMENDABLE.includes(e.status) && e.eph > 0;
}

/** every map ranked for this character: recommendable first, then by EXP/hour */
export function rankMaps(c: E.CharInput, maps: MapData[], mobsById: Map<number, A.MobData>, o: EffOptions = {}): MapEff[] {
  return maps
    .map((m) => mapEfficiency(c, m, mobsById, o))
    .sort((a, b) => Number(isRecommendable(b)) - Number(isRecommendable(a)) || b.eph - a.eph);
}

export interface Variant { c: E.CharInput; targets: number }
export interface MapPick extends MapEff { variant: number }

const better = (a: MapEff, b: MapEff) => Number(isRecommendable(a)) - Number(isRecommendable(b)) || a.eph - b.eph;

/**
 * Like rankMaps, but tries every attack the character has (e.g. single-target and
 * multi-target skills) and keeps the best one per map.
 */
export function rankMapsBest(variants: Variant[], maps: MapData[], mobsById: Map<number, A.MobData>, o: EffOptions = {}): MapPick[] {
  return maps
    .map((m) => {
      let best: MapEff | null = null, vi = 0;
      variants.forEach((v, i) => {
        const e = mapEfficiency(v.c, m, mobsById, { ...o, targets: v.targets });
        if (!best || better(e, best) > 0) { best = e; vi = i; }
      });
      return { ...(best as unknown as MapEff), variant: vi };
    })
    .sort((a, b) => better(b, a));
}

/** hours to gain one level at `eph` (exp[] index 0 = level 1) */
export function hoursToLevel(level: number, eph: number, exp: number[]): number {
  const need = exp[Math.max(1, Math.floor(level)) - 1];
  return need && eph > 0 ? need / eph : Infinity;
}
