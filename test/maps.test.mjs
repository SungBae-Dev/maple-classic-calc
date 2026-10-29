import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as M from '../.build/maps.mjs';
import * as A from '../.build/advisor.mjs';
import * as E from '../.build/engine.mjs';

let pass = 0;
const t = (name, fn) => { fn(); pass++; console.log('✓', name); };
const mobs = JSON.parse(readFileSync(new URL('../data/mobs.json', import.meta.url))).mobs;
const byId = new Map(mobs.map((m) => [m.id, m]));
const MAPS = JSON.parse(readFileSync(new URL('../data/maps.json', import.meta.url)));
const EXP = JSON.parse(readFileSync(new URL('../data/exp.json', import.meta.url))).exp;
const fighter = { ...E.DEFAULT_CHAR };

t('수용량: 스폰 포인트 × 75% 내림 (NiaDB 예: 50 → 솔로 37, 2인 40, 6인 50)', () => {
  assert.equal(M.capacity(50), 37);
  assert.equal(M.capacity(50, 2), 40);
  assert.equal(M.capacity(50, 3), 42);
  assert.equal(M.capacity(50, 4), 45);
  assert.equal(M.capacity(50, 5), 47);
  assert.equal(M.capacity(50, 6), 50);
  assert.equal(M.capacity(50, 9), 50);
});
t('리젠 상한: 수용량 × 3600 / 7.56초', () => {
  assert.ok(Math.abs(M.respawnPerHour(50) - (37 * 3600) / 7.56) < 1e-9);
  // 스폰 포인트 1개당 476/h (파티 풀) — 가이드 수치
  assert.equal(Math.round(M.respawnPerHour(100, 6) / 100), 476);
});
t('단일 몹 맵: 시간당 처치 = 3600 × 공격 비율 ÷ (예상 공격 횟수 × 공격 간격), 리젠 상한 이하', () => {
  const map = { id: 'x', en: 'Test', spawns: 40, mobs: [{ id: 24, count: 40 }] };
  const e = M.mapEfficiency(fighter, map, byId, { targets: 1, active: 0.5 });
  const row = A.huntRow(fighter, byId.get(24));
  const expect = (3600 * 0.5) / (row.castsExpected * fighter.attackMs / 1000);
  assert.ok(Math.abs(e.playerKph - expect) < 1e-6);
  assert.ok(Math.abs(e.kph - Math.min(expect, e.ceiling)) < 1e-6);
  assert.ok(Math.abs(e.eph - e.kph * 52) < 1e-6);
  assert.equal(e.perCast, 1);
  assert.equal(e.cap, 30);
});
t('다수기: 한 번에 잡는 몹 수 = min(최대 대상, 3) → 처치 속도 비례', () => {
  const map = { id: 'x', en: 'Test', spawns: 80, mobs: [{ id: 24, count: 80 }] };
  const one = M.mapEfficiency(fighter, map, byId, { targets: 1 });
  const six = M.mapEfficiency(fighter, map, byId, { targets: 6 });
  const pack2 = M.mapEfficiency(fighter, map, byId, { targets: 6, pack: 2 });
  assert.equal(six.perCast, 3);
  assert.equal(pack2.perCast, 2);
  assert.ok(Math.abs(six.playerKph / one.playerKph - 3) < 1e-9);
});
t('작은 맵은 리젠이 병목 (limit=respawn), 처치량 = 리젠 상한', () => {
  const map = { id: 'x', en: 'Tiny', spawns: 4, mobs: [{ id: 3, count: 4 }] };
  const e = M.mapEfficiency(fighter, map, byId, { targets: 6, active: 1 });
  assert.equal(e.limit, 'respawn');
  assert.ok(Math.abs(e.kph - e.ceiling) < 1e-9);
  assert.equal(e.cap, 3);
});
t('타이머 스폰: 3600 / (타이머 + 3.78초), 인원 배율 미적용; 웨이브는 따로 수용량', () => {
  const map = { id: 'x', en: 'Kargo', spawns: 31, mobs: [{ id: 37, count: 17 }, { id: 51, count: 14 }], timed: [{ id: 51, respawnS: 120 }] };
  const r = M.mapRates(map);
  assert.equal(r.wavePoints, 17); assert.equal(r.timedPoints, 14);
  assert.equal(r.cap, 12 + 14);
  assert.ok(Math.abs(r.perMob.get(51) - 14 * 3600 / (120 + 3.78)) < 1e-9);
  assert.ok(Math.abs(r.perMob.get(37) - 12 * 3600 / 7.56) < 1e-9);
  assert.equal(M.mapRates(map, 6).perMob.get(51), r.perMob.get(51));
  // 빠른 캐릭터: 카르고는 리젠 한도까지만, 남는 시간은 콜드아이
  const strong = { ...fighter, level: 80, watk: 160, str: 420, acc: 150 };
  const e = M.mapEfficiency(strong, map, byId, { targets: 6 });
  const kargo = e.mobs.find((m) => m.spawn.id === 51), eye = e.mobs.find((m) => m.spawn.id === 37);
  assert.ok(kargo.kills <= kargo.respawn + 1e-6);
  if (e.limit === 'dps') {
    const used = e.mobs.reduce((s, m) => s + m.kills * m.secPerKill, 0);
    assert.ok(Math.abs(used - 3600 * M.DEFAULT_ACTIVE) < 1e-3);
    assert.ok(eye.kills / 17 >= kargo.kills / 14 - 1e-6);
  }
});
t('혼합 맵: 화력 병목이면 스폰 수 비율대로 처치, 못 잡는 웨이브 몹이 섞이면 blocked', () => {
  const map = { id: 'x', en: 'Mix', spawns: 30, mobs: [{ id: 13, count: 10 }, { id: 19, count: 20 }] };
  const e = M.mapEfficiency(fighter, map, byId, { targets: 1 });
  assert.equal(e.limit, 'dps');
  assert.ok(Math.abs(e.expPerKill - (10 * 26 + 20 * 41) / 30) < 1e-6);
  const weak = { ...fighter, level: 10, acc: 5, watk: 10, str: 30 };
  const hard = M.mapEfficiency(weak, { id: 'y', en: 'Hard', spawns: 20, mobs: [{ id: 13, count: 10 }, { id: 53, count: 10 }] }, byId, {});
  assert.equal(hard.status, 'blocked');
});
t('레벨업 시간 = 필요 경험치 ÷ 시간당 경험치 (Lv70 → 2,062,925)', () => {
  assert.equal(EXP[69], 2062925);
  assert.equal(M.hoursToLevel(70, 2062925, EXP), 1);
  assert.equal(M.hoursToLevel(70, 0, EXP), Infinity);
});
t('maps.json: 모든 맵 스폰 수 = 몬스터 스폰 합, 몬스터는 mobs.json에 있음, 출처 링크', () => {
  assert.ok(MAPS.maps.length >= 20);
  const ids = new Set();
  for (const m of MAPS.maps) {
    assert.ok(!ids.has(m.id), 'duplicate ' + m.id); ids.add(m.id);
    assert.ok(/^\d{9}$/.test(m.id), m.id);
    assert.ok(m.src && m.src.includes(m.id), m.id + ' src');
    const sum = m.mobs.reduce((s, x) => s + x.count, 0);
    assert.equal(sum, m.spawns, m.en + ' spawn sum');
    for (const x of m.mobs) assert.ok(byId.has(x.id), m.en + ': mob ' + x.id + ' missing in mobs.json');
  }
});
t('추천 순서: 추천 가능 맵 먼저, 시간당 경험치 내림차순 (Lv70 파이터)', () => {
  const r = M.rankMaps(fighter, MAPS.maps, byId, { targets: 6 });
  const firstBad = r.findIndex((e) => !M.isRecommendable(e));
  const good = firstBad < 0 ? r : r.slice(0, firstBad);
  assert.ok(good.length >= 3);
  for (let i = 1; i < good.length; i++) assert.ok(good[i - 1].eph >= good[i].eph);
  assert.ok(r.slice(good.length).every((e) => !M.isRecommendable(e)));
});
t('맵마다 가장 좋은 공격 선택: 다수기(6) vs 단일기 — 각 맵의 결과는 둘 중 높은 쪽', () => {
  const single = { c: { ...fighter, skillPct: 260, hits: 1 }, targets: 1 };
  const multi = { c: { ...fighter, skillPct: 190, hits: 1 }, targets: 6 };
  const best = M.rankMapsBest([single, multi], MAPS.maps, byId, {});
  for (const e of best) {
    const a = M.mapEfficiency(single.c, e.map, byId, { targets: 1 }), b = M.mapEfficiency(multi.c, e.map, byId, { targets: 6 });
    const top = [a, b].filter(M.isRecommendable).sort((x, y) => y.eph - x.eph)[0];
    if (top) assert.ok(Math.abs(e.eph - top.eph) < 1e-6, e.map.en);
  }
  assert.ok(best.some((e) => e.variant === 1));
});
t('막힌 맵(못 잡는 웨이브 몹)은 시간당 경험치 0, 맨 뒤', () => {
  const weak = { ...fighter, level: 12, acc: 20, watk: 20, str: 45 };
  const r = M.rankMaps(weak, MAPS.maps, byId, {});
  const blocked = r.filter((e) => e.status === 'blocked');
  assert.ok(blocked.length > 0);
  blocked.forEach((e) => { assert.equal(e.eph, 0); assert.equal(e.kph, 0); });
  assert.ok(r.indexOf(blocked[0]) > r.findIndex((e) => M.isRecommendable(e)));
});
t('images.json: 모든 몬스터·맵(1곳 제외)·스킬 매핑, 무기·주문서 아이템 ID', () => {
  const I = JSON.parse(readFileSync(new URL('../data/images.json', import.meta.url)));
  for (const m of mobs) assert.ok(I.mobs[m.id] > 0, 'mob ' + m.id);
  const unmapped = MAPS.maps.filter((m) => !I.maps[m.id]).map((m) => m.id);
  assert.ok(unmapped.length <= 1, 'maps without image: ' + unmapped);
  assert.ok(Object.keys(I.skills).length >= 80);
  for (const [k, id] of Object.entries(I.skills)) assert.ok(/^[a-z]+\/[a-z0-9-]+$/.test(k) && Number.isInteger(id) && id > 0, k);
  for (const w of Object.keys(E.WEAPONS)) {
    assert.ok(I.items.weapons[w] >= 1300000, 'weapon ' + w);
    assert.deepEqual(Object.keys(I.items.scrolls[w]).sort(), ['10', '100', '60']);
  }
});

console.log(`\n${pass} map tests passed`);
