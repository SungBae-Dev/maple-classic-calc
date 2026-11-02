/**
 * "Typical" stat window for a class and level, so the site works from class + level alone.
 * Rough community-style builds, calibrated on the presets (NiaDB benchmark Lv70 Fighter etc.):
 *  - AP: 25 at creation + 5 per level, the rest at 4
 *  - secondary stat: warriors and thieves DEX ≈ level, bowmen STR ≈ 4 + level/2, magicians LUK ≈ 4 + level/2
 *  - gear adds main stat from Lv 30 on (warrior 1.1, thief/bowman 0.7, magician 0.45 per level)
 *  - attack and accuracy grow linearly with level per weapon family
 * Every value is a placeholder: the player's stat window always wins.
 */
import * as E from './engine';

export interface Typical { str: number; dex: number; int: number; luk: number; watk: number; matk: number; acc: number }

const GEAR_MAIN: Record<E.JobGroup, number> = { warrior: 1.1, thief: 0.7, bowman: 0.7, magician: 0.45 };
/** attack at Lv 30 and gain per level, by weapon family */
const ATK: Record<string, [number, number]> = {
  sword: [47, 1.45], axe: [47, 1.45], blunt: [47, 1.45], spear: [49, 1.5], polearm: [49, 1.5],
  bow: [45, 1.25], crossbow: [48, 1.3], claw: [40, 1.2], dagger: [50, 1.5], spell: [40, 1.5],
};
/** accuracy = a + b × level */
const ACC: Record<E.JobGroup, [number, number]> = { warrior: [7, 1.33], bowman: [10, 1.6], thief: [10, 1.57], magician: [5, 1.29] };

export function typical(job: E.JobGroup, weapon: E.WeaponType, level: number): Typical {
  const L = Math.max(1, Math.min(200, Math.round(level)));
  const ap = 25 + 5 * (L - 1);
  const gear = Math.round(Math.max(0, L - 30) * GEAR_MAIN[job]);
  const s = { str: 4, dex: 4, int: 4, luk: 4 };
  const main = E.WEAPONS[weapon].primary;
  const sec: E.Stat = job === 'warrior' ? 'dex' : job === 'thief' ? 'dex' : job === 'bowman' ? 'str' : 'luk';
  const secVal = job === 'warrior' ? Math.max(4, L) : job === 'thief' ? Math.max(L >= 10 ? 25 : 4, L) : 4 + Math.floor(L / 2);
  // early levels: keep the secondary at what job advancement needs, not more than the AP you have
  s[sec] = Math.min(secVal, Math.max(4, ap - 12));
  s[main] = Math.max(4, ap + gear - s[sec] - 8);
  const fam = E.WEAPONS[weapon].mastery;
  const [a30, per] = ATK[fam] || ATK.sword;
  const atk = Math.max(job === 'magician' ? 10 : 15, Math.round(a30 + (L - 30) * per));
  const [a, b] = ACC[job];
  return {
    ...s,
    watk: job === 'magician' ? 0 : atk,
    matk: job === 'magician' ? atk : 0,
    acc: Math.max(5, Math.round(a + b * L)),
  };
}
