import assert from 'node:assert/strict';
import * as E from '../.build/engine.mjs';

let pass = 0;
const t = (name, fn) => { fn(); pass++; console.log('✓', name); };
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

const lv30 = {
  ...E.DEFAULT_CHAR, job: 'warrior', weapon: '1h_sword', action: 'inherited', level: 30,
  str: 132, dex: 30, int: 4, luk: 4, watk: 47, apPassive: 0, apBuff: 0,
  masterySkillLv: 0, skillPct: 100, critRate: 0, critDmg: 0,
};

// MeowDB 워크드 예제: Lv30 전사, 글라디우스 47
t('스탯창 범위 59-172', () => {
  const r = E.statWindowRange(lv30);
  assert.deepEqual([r.min, r.max], [59, 172]);
});
t('파워 스트라이크 260% → 154-449', () => {
  const r = E.skillRange({ ...lv30, skillPct: 260 });
  assert.deepEqual([r.min, r.max], [154, 449]);
});
t('검 숙련 20 (숙련도 10) → 137-172', () => {
  const r = E.statWindowRange({ ...lv30, masterySkillLv: 20 });
  assert.deepEqual([r.min, r.max], [137, 172]);
});
t('검 숙련 20 + 파스 → 357-449', () => {
  const r = E.skillRange({ ...lv30, masterySkillLv: 20, skillPct: 260 });
  assert.deepEqual([r.min, r.max], [357, 449]);
});
t('숙련 스킬레벨 매핑 (MeowDB 표)', () => {
  const exp = { 0: 0, 1: 1, 3: 1, 4: 2, 5: 2, 6: 3, 9: 4, 10: 5, 15: 7, 19: 9, 20: 10 };
  for (const [k, v] of Object.entries(exp)) assert.equal(E.masteryLevelFromSkill(+k), v, `lv ${k}`);
});

// MeowDB FAQ 벤치마크: Lv70 파이터, 337 STR / 70 DEX / 총공 105 / AP 40 / 숙련 10 / 파스 2.60 동작
const bench = { ...E.DEFAULT_CHAR };
t('벤치마크: AP 1 ≈ STR 0.9', () => {
  const c = E.conversions(bench);
  const ap = c.items.find((i) => i.key === 'ap').perPoint;
  near(ap, 0.87, 0.03, 'AP');
});
t('벤치마크: 공 1 ≈ AP 5', () => {
  const c = E.conversions(bench);
  const ap = c.items.find((i) => i.key === 'ap').perPoint;
  const w = c.items.find((i) => i.key === 'watk').perPoint;
  near(w / ap, 4.83, 0.2, 'WATK/AP');
});
t('AP 1 = 부스탯 2 (MeowDB FAQ)', () => {
  const c = E.conversions(bench);
  const ap = c.items.find((i) => i.key === 'ap').perPoint;
  const dex = c.items.find((i) => i.key === 'dex').perPoint;
  near(ap / dex, 2, 1e-6, 'AP/DEX');
});

t('환산 주스탯 (기준=현재) = P + (2Q+4AP)/(W(1+m))', () => {
  const v = E.convertedMainStat(bench);
  const m = 0.77, W = 2.6;
  near(v, 337 + (2 * 70 + 4 * 40) / (W * (1 + m)), 1e-6, 'conv');
});
t('환산 주스탯 기준 고정 시 공격력 오르면 증가', () => {
  const a = E.convertedMainStat(bench, 105);
  const b = E.convertedMainStat({ ...bench, watk: 110 }, 105);
  assert.ok(b > a);
});
t('마법사: 기준=현재 마력이면 환산 = INT', () => {
  const mage = { ...E.DEFAULT_CHAR, job: 'magician', weapon: 'wand', int: 300, luk: 40, matk: 90, masterySkillLv: 0, skillPct: 100 };
  near(E.convertedMainStat(mage), 300, 1e-6, 'mage conv');
});

// 명중
t('명중: 회피 0 몹은 100%', () => {
  assert.equal(E.hitChance(10, 30, { level: 30, eva: 0 }), 1);
});
t('명중: 명중 0이면 0%', () => {
  assert.equal(E.hitChance(0, 30, { level: 30, eva: 20 }), 0);
});
t('명중: 단조 증가', () => {
  const mob = { level: 75, eva: 30 };
  let prev = -1;
  for (let a = 0; a <= 300; a++) { const h = E.hitChance(a, 70, mob); assert.ok(h >= prev - 1e-12); prev = h; }
});
t('100% 명중 필요치에서 hit=1, 그 아래는 <1', () => {
  const mob = { level: 75, eva: 30 };
  const need = E.accForFullHit(70, mob);
  assert.equal(E.hitChance(need, 70, mob), 1);
  assert.ok(E.hitChance(need - 1, 70, mob) < 1);
});

// 템 비교
t('템 비교: 공 +5 = 주스탯 등가가 환산비와 근사', () => {
  const r = E.compareItem(bench, { watk: 5 });
  const per = E.conversions(bench).items.find((i) => i.key === 'watk').perPoint;
  near(r.mainStatEq, per * 5, 1.0, 'eq');
  assert.ok(r.pct > 0);
});
t('템 비교: 몹 설정 시 DEX가 명중 통해 가치 상승', () => {
  const mob = { enabled: true, level: 75, eva: 30, wdef: 300, mdef: 100, element: 'neutral' };
  const c = { ...bench, acc: 90 };
  assert.ok(E.hitChance(90, 70, mob) > 0 && E.hitChance(90, 70, mob) < 1);
  const noMob = E.conversions(c).items.find((i) => i.key === 'dex').perPoint;
  const withMob = E.conversions(c, mob).items.find((i) => i.key === 'dex').perPoint;
  assert.ok(withMob > noMob, `${withMob} > ${noMob}`);
});
t('명중 0% 몹이면 몹 미적용 기준으로 대체 + 플래그', () => {
  const mob = { enabled: true, level: 80, eva: 35, wdef: 300, mdef: 100, element: 'neutral' };
  const r = E.conversions({ ...bench, acc: 90 }, mob);
  assert.equal(r.zeroHit, true);
  assert.ok(r.items.length > 0);
});
t('속성: 단일 속성 약점 1.25 / 반감 0.75 / 무효 0 (NiaDB)', () => {
  const aff = { fire: 'weak', ice: 'strong', poison: 'immune' };
  assert.equal(E.elementFromAffinity(aff, 'fire'), 'weak');
  assert.equal(E.elementFromAffinity(aff, 'ice'), 'resist');
  assert.equal(E.elementFromAffinity(aff, 'poison'), 'immune');
  assert.equal(E.elementFromAffinity(aff, 'holy'), 'neutral');
  assert.equal(E.elementFromAffinity(aff, 'none'), null);
  assert.equal(E.ELEMENT_MULT.weak, 1.25);
  assert.equal(E.ELEMENT_MULT.resist, 0.75);
});
t('몹 방어: 물리는 wdef, 마법은 mdef 사용', () => {
  const mob = { enabled: true, level: 1, eva: 0, wdef: 100, mdef: 0, element: 'neutral' };
  const phys = E.evaluate({ ...lv30, level: 30 }, mob);
  assert.equal(phys.defMult, 0.5);
  const mage = { ...E.DEFAULT_CHAR, job: 'magician', weapon: 'wand', int: 300, matk: 90, level: 30 };
  assert.equal(E.evaluate(mage, mob).defMult, 1);
});

t('방어·레벨차·크리 보정', () => {
  assert.equal(E.defenseMult(100), 0.5);
  near(E.defenseMult(100, 50), 0.75, 1e-12, 'ignore');
  near(E.levelScale(70, 75), 1 / (1 + 25 * 0.005), 1e-12, 'lv5');
  near(E.levelScale(70, 85), 1 / (1 + 15 * 0.05), 1e-12, 'lv15');
  const ev = E.evaluate({ ...lv30, critRate: 5, critDmg: 20 });
  near(ev.critMult, 1.01, 1e-12, 'crit');
});

console.log(`\n${pass} passed`);

// 몹 데이터 무결성
import { readFileSync } from 'node:fs';
const mobs = JSON.parse(readFileSync(new URL('../data/mobs.json', import.meta.url))).mobs;
t(`몹 데이터 ${mobs.length}종 무결성`, () => {
  const ids = new Set();
  for (const m of mobs) {
    assert.ok(!ids.has(m.id), 'dup ' + m.id); ids.add(m.id);
    for (const k of ['lv', 'eva', 'wdef', 'mdef']) assert.ok(Number.isFinite(m[k]) && m[k] >= 0, `${m.en}.${k}`);
    assert.ok(m.en && m.ko, 'name ' + m.id);
    for (const [el, a] of Object.entries(m.el)) {
      assert.ok(E.SKILL_ELEMENTS.includes(el) && el !== 'none', `${m.en} el ${el}`);
      assert.ok(['weak', 'strong', 'immune'].includes(a), `${m.en} aff ${a}`);
    }
  }
});
console.log(`${pass} passed (total)`);
