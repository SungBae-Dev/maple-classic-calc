import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as A from '../.build/advisor.mjs';
import * as E from '../.build/engine.mjs';

let pass = 0;
const t = (name, fn) => { fn(); pass++; console.log('✓', name); };
const mobs = JSON.parse(readFileSync(new URL('../data/mobs.json', import.meta.url))).mobs;
const fighter = { ...E.DEFAULT_CHAR };
const warrior30 = { ...fighter, weapon: '1h_sword', level: 30, str: 132, dex: 30, watk: 47, apBuff: 0, masterySkillLv: 0, acc: 49, skillPct: 260 };

t('리포트: 모든 몹 행 생성 + 레벨순', () => {
  const r = A.buildReport(fighter, mobs);
  assert.equal(r.rows.length, mobs.length);
  for (let i = 1; i < r.rows.length; i++) assert.ok(r.rows[i].mob.lv >= r.rows[i - 1].mob.lv);
});
t('추천 사냥터: 명중 90%+, 4방 이내, 레벨 -15~+10, 공격당 EXP 내림차순', () => {
  for (const c of [fighter, warrior30]) {
    const r = A.buildReport(c, mobs);
    assert.ok(r.recommended.length > 0);
    r.recommended.forEach((x, i) => {
      assert.ok(x.hit >= 0.9 && x.castsIfHit <= 4 && x.levelGap >= -15 && x.levelGap <= 10);
      if (i) assert.ok(r.recommended[i - 1].expPerCast >= x.expPerCast);
      assert.ok(!x.mob.tags.includes('boss'));
    });
  }
});
t('처치 횟수 = ceil(HP / 착탄 평균), 확정 1방은 최소 데미지 ≥ HP', () => {
  const row = A.huntRow(warrior30, mobs.find((m) => m.id === 18));
  assert.equal(row.castsIfHit, Math.max(1, Math.ceil(row.mob.hp / row.landedPerCast)));
  if (row.status === 'oneshot') assert.ok(row.minPerCast >= row.mob.hp);
});
t('명중 0% → cant, EXP/공격 0', () => {
  const r = A.huntRow({ ...fighter, acc: 1 }, mobs.find((m) => m.id === 700001));
  assert.equal(r.status, 'cant');
  assert.equal(r.expPerCast, 0);
});
t('스펙업 추천: 증가율 내림차순, 공격력 +5 > +1', () => {
  const ups = A.upgrades(warrior30, mobs.find((m) => m.id === 19));
  for (let i = 1; i < ups.length; i++) assert.ok(ups[i - 1].gain >= ups[i].gain);
  const g = (k) => ups.find((u) => u.key === k).gain;
  assert.ok(g('watk5') > g('watk1'));
  assert.ok(ups.some((u) => u.key === 'mastery'));
});
t('목표: 필요 공격력을 더하면 실제로 한 방 줄어듦', () => {
  const m = mobs.find((x) => x.id === 50);
  const g = A.goalFor(fighter, m);
  assert.ok(g.atk != null && g.atk > 0);
  assert.ok(A.huntRow({ ...fighter, watk: fighter.watk + g.atk }, m).castsIfHit <= g.targetCasts);
  assert.ok(A.huntRow({ ...fighter, watk: fighter.watk + g.atk - 1 }, m).castsIfHit > g.targetCasts);
});

console.log(`\n${pass} passed`);
