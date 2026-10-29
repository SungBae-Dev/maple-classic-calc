import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

const out = await build({ entryPoints: [new URL('../src/auto.ts', import.meta.url).pathname], bundle: true, format: 'esm', write: false, logLevel: 'warning' });
const AU = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'));
const E = await import('../.build/engine.mjs');
const DB = JSON.parse(readFileSync(new URL('../.build/skills.json', import.meta.url)));
let pass = 0;
const t = (name, fn) => { fn(); pass++; console.log('✓', name); };
const NULLS = { skillLv: null, skillPct: null, hits: null, masterySkillLv: null, apPassive: null, apBuff: null, attackMs: null, weaponStage: null, critRate: null, critDmg: null, defIgnorePct: null };
const base = { job: 'warrior', subJob: 'fighter', weapon: '2h_axe', action: 'inherited', level: 70, str: 337, dex: 70, int: 4, luk: 4, watk: 105, matk: 0, acc: 100, skill: 'auto', skillElement: 'none', buffs: true, ...NULLS };

t('Lv70 파이터: 파워 스트라이크 260%, 분노 AP 40, 숙련 20 자동 (MeowDB 벤치마크와 동일)', () => {
  const R = AU.resolve(base, DB);
  assert.equal(R.skill.slug, 'power-strike');
  assert.equal(R.c.skillPct, 260);
  assert.equal(R.c.apBuff, 40);
  assert.equal(R.c.masterySkillLv, 20);
  assert.ok(R.booster);
});
t('Lv30 1차 검 전사: 스탯창 59–172 (NiaDB 예제), 파스 154–449', () => {
  const R = AU.resolve({ ...base, subJob: '', weapon: '1h_sword', level: 30, str: 132, dex: 30, watk: 47, acc: 49 }, DB);
  const w = E.statWindowRange({ ...R.c, apBuff: 0 });
  assert.deepEqual([w.min, w.max], [59, 172]);
  assert.equal(R.skill.slug, 'power-strike');
  const r = E.skillRange(R.c);
  assert.deepEqual([r.min, r.max], [154, 449]);
});
t('어쌔신: 럭키 세븐은 lucky7 동작(W 3.0), 자벨린 숙련 AP +20 자동', () => {
  const R = AU.resolve({ ...base, job: 'thief', subJob: 'assassin', weapon: 'claw', action: 'shoot', str: 4, luk: 320, skill: 'lucky-seven' }, DB);
  assert.equal(R.c.action, 'lucky7');
  assert.equal(R.c.hits, 2);
  assert.equal(R.c.apPassive, 20);
});
t('썬콜: 마법 숙련은 스킬 데이터, 메디테이션 +25 마력 자동', () => {
  const raw = { ...base, job: 'magician', subJob: 'il', weapon: 'wand', str: 4, dex: 4, int: 340, luk: 40, watk: 0, matk: 100, acc: 95 };
  const R = AU.resolve(raw, DB);
  assert.equal(R.c.matk, 125);
  assert.ok(['cold-beam', 'thunder-bolt', 'magic-claw', 'energy-bolt'].includes(R.skill.slug));
  assert.equal(R.c.masteryLv, 10);
  assert.equal(R.c.attackMs, 810);
  const off = AU.resolve({ ...raw, buffs: false }, DB);
  assert.equal(off.c.matk, 100);
});
t('입력값이 있으면 자동값을 덮어씀', () => {
  const R = AU.resolve({ ...base, skillPct: 300, hits: 3, attackMs: 500, apBuff: 0 }, DB);
  assert.equal(R.c.skillPct, 300);
  assert.equal(R.c.hits, 3);
  assert.equal(R.c.attackMs, 500);
  assert.equal(R.c.apBuff, 0);
});
t('공격 시간: 부스터는 2단계 빠르게, 같은 단계 표가 있으면 그대로', () => {
  const ps = DB.jobs.warrior.skills.find((s) => s.slug === 'power-strike');
  const a = AU.skillTime(DB, ps, '2h_axe', 6, false).ms, b = AU.skillTime(DB, ps, '2h_axe', 6, true).ms;
  assert.ok(b < a, `${b} < ${a}`);
  assert.equal(a, 810);
});
t('레벨 낮으면 가이드대로 스킬 레벨 추정 (Lv12 전사: SB 우선)', () => {
  const est = AU.estimateLevels(DB, 'warrior', '', '1h_sword', 12);
  assert.equal(est['power-strike'], 1);
  assert.equal(est['slash-blast'], 6);
});
console.log(`${pass} passed`);
