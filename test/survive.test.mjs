import assert from 'node:assert/strict';
import * as S from '../.build/survive.mjs';

let pass = 0;
const t = (name, fn) => { fn(); pass++; console.log('✓', name); };

t('기본 회피 = floor(LUK/3) + floor(DEX/6) + 5', () => {
  assert.equal(S.baseAvoid(30, 30), 20);
  assert.equal(S.baseAvoid(4, 4), 6);
  assert.equal(S.baseAvoid(25, 200), 75);
});
t('피격 데미지: 공격 400, 방어 100, Lv50 → 435–514 (NiaDB 공식)', () => {
  const d = S.damageTaken({ atk: 400 }, { level: 50, wdef: 100, mdef: 0 });
  assert.equal(d.min, 435);
  assert.equal(d.max, 514);
  assert.ok(d.avg > d.min && d.avg < d.max);
});
t('방어력이 높을수록 덜 아프고, 최소 1', () => {
  const lo = S.damageTaken({ atk: 300 }, { level: 30, wdef: 50, mdef: 0 });
  const hi = S.damageTaken({ atk: 300 }, { level: 30, wdef: 300, mdef: 0 });
  assert.ok(hi.max < lo.max);
  assert.equal(S.damageTaken({ atk: 5 }, { level: 70, wdef: 500, mdef: 0 }).max, 1);
});
t('마법 공격은 마법 방어력, 비율(%) 반영', () => {
  const p = { level: 40, wdef: 400, mdef: 0 };
  assert.ok(S.damageTaken({ atk: 300, magic: true }, p).max > S.damageTaken({ atk: 300 }, p).max);
  assert.ok(S.damageTaken({ atk: 300, ratio: 150 }, p).max > S.damageTaken({ atk: 300 }, p).max);
});
t('몬스터 명중: 회피 0이면 거의 맞고, 회피가 높을수록 덜 맞음 (최소 8% 이상)', () => {
  const a = S.mobHitChance(104, 28, { level: 25, avoid: 0 });
  const b = S.mobHitChance(104, 28, { level: 25, avoid: 60 });
  const c = S.mobHitChance(104, 28, { level: 25, avoid: 400 });
  assert.ok(a > 0.95);
  assert.ok(b < a && c < b);
  assert.ok(c >= 0.08 && c < 0.12);
});
t('threat: HP로 몇 대에 쓰러지는지, 위험도 구간', () => {
  const p = { level: 30, hp: 1000, wdef: 50, mdef: 30, avoid: 20 };
  const m = { lv: 40, acc: 120, patk: 300, matk: 250, attacks: [{ type: 'magic', ratio: 100 }] };
  const th = S.threat(m, p);
  assert.ok(th.touch && th.magic);
  assert.equal(th.worst, Math.max(th.touch.max, th.magic.max));
  assert.equal(th.hitsToDie, Math.ceil(1000 / th.worst));
  assert.equal(S.threat(m, { ...p, hp: 100 }).danger, 'deadly');
  assert.equal(S.threat(m, { ...p, hp: null }).danger, 'unknown');
});

console.log(`\n${pass} survival tests passed`);
