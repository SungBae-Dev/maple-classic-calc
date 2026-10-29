import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GUIDES, spAvailable, SKILL_KO } from '../src/guides.js';

const jobs = {};
for (const f of ['warrior', 'magician', 'bowman', 'thief']) Object.assign(jobs, JSON.parse(readFileSync(new URL(`../data/skills-${f}.json`, import.meta.url))).jobs);
let pass = 0;
const t = (name, fn) => { fn(); pass++; console.log('✓', name); };
const FIRST = ['warrior', 'magician', 'bowman', 'thief'];

t('가이드의 모든 스킬이 해당 직업 스킬 데이터에 존재', () => {
  for (const [key, steps] of Object.entries(GUIDES)) {
    const job = key.split(':')[0];
    const data = jobs[job];
    assert.ok(data, 'no data for ' + job);
    const slugs = new Set(data.skills.map((s) => s.slug));
    for (const s of steps) assert.ok(slugs.has(s.skill), `${key}: ${s.skill}`);
  }
});
t('SP 합계가 보유 SP 이내 (1차 Lv30, 2차 Lv70 기준)', () => {
  for (const [key, steps] of Object.entries(GUIDES)) {
    const job = key.split(':')[0];
    const data = jobs[job];
    const max = Object.fromEntries(data.skills.map((s) => [s.slug, s.maxLv]));
    const lv = {};
    let total = 0;
    for (const s of steps) {
      const to = s.to === 'max' ? max[s.skill] : Math.min(s.to, max[s.skill]);
      total += Math.max(0, to - (lv[s.skill] || 0));
      lv[s.skill] = Math.max(lv[s.skill] || 0, to);
    }
    const first = FIRST.includes(job);
    const groupJob = first ? job : 'warrior';
    const budget = first ? spAvailable(job, 30).first : spAvailable(groupJob, 70).second;
    assert.ok(total <= budget, `${key}: ${total} > ${budget}`);
  }
});
t('SP 계산: 전직 1 + 레벨당 3', () => {
  assert.deepEqual(spAvailable('warrior', 30), { first: 61, second: 1, adv1: 10 });
  assert.equal(spAvailable('magician', 30).first, 67);
  assert.equal(spAvailable('thief', 9).first, 0);
});
t('한국어 스킬명 키가 실제 스킬 슬러그', () => {
  const all = new Set(Object.values(jobs).flatMap((j) => j.skills.map((s) => s.slug)));
  for (const k of Object.keys(SKILL_KO)) assert.ok(all.has(k), k);
});
console.log(`${pass} passed`);
