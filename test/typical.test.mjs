import assert from 'node:assert/strict';
import { typical } from '../.build/typical.mjs';

let pass = 0;
const t = (name, fn) => { fn(); pass++; console.log('✓', name); };
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

t('Lv70 Fighter ≈ NiaDB benchmark (STR 337, DEX 70, W.ATK 105, ACC 100)', () => {
  const x = typical('warrior', '2h_axe', 70);
  near(x.str, 337, 3, 'STR'); assert.equal(x.dex, 70); near(x.watk, 105, 2, 'ATK'); near(x.acc, 100, 2, 'ACC');
});
t('Lv30 warrior (STR 132, DEX 30, W.ATK 47)', () => {
  const x = typical('warrior', '1h_sword', 30);
  assert.equal(x.str, 132); assert.equal(x.dex, 30); assert.equal(x.watk, 47);
});
t('Lv70 Assassin (LUK 320, DEX 70, W.ATK 88, ACC 120)', () => {
  const x = typical('thief', 'claw', 70);
  near(x.luk, 320, 3, 'LUK'); assert.equal(x.dex, 70); near(x.watk, 88, 2, 'ATK'); near(x.acc, 120, 2, 'ACC');
});
t('Lv70 Magician (INT 340, LUK 39, M.ATK 100, ACC 95)', () => {
  const x = typical('magician', 'wand', 70);
  near(x.int, 340, 3, 'INT'); near(x.luk, 40, 2, 'LUK'); near(x.matk, 100, 2, 'MATK'); near(x.acc, 95, 2, 'ACC'); assert.equal(x.watk, 0);
});
t('모든 직업·무기·레벨: 스탯 합 = AP(+장비), 최소 4, 공격력·명중 양수', () => {
  for (const [job, ws] of Object.entries({ warrior: ['1h_sword', 'spear'], bowman: ['bow', 'crossbow'], thief: ['claw', 'dagger'], magician: ['wand', 'staff'] })) {
    for (const w of ws) for (const L of [1, 8, 10, 15, 30, 50, 70, 100]) {
      const x = typical(job, w, L);
      for (const k of ['str', 'dex', 'int', 'luk']) assert.ok(x[k] >= 4, `${job} ${w} ${L} ${k}`);
      assert.ok((job === 'magician' ? x.matk : x.watk) > 0 && x.acc > 0);
      assert.ok(x.str + x.dex + x.int + x.luk >= 25 + 5 * (L - 1) - 1);
    }
  }
});

console.log(`\n${pass} typical-stat tests passed`);
