// Skill point order per job. Skill names/max levels come from data/skills-*.json (NiaDB class pages).
// The ORDER is this project's recommendation (pre-Big Bang conventions + Classic skill values), not official.
// Keys: '<job or subJob>' or '<job or subJob>:<weapon family>' (more specific wins).
// Each step raises `skill` to `to` ('max' = max level). `why` → i18n key reason.<why>.

const step = (skill, to, why) => ({ skill, to, why });

export const GUIDES = {
  // ── 1st job (SP: 1 at advancement + 3 per level until 30) ──
  warrior: [
    step('power-strike', 1, 'prereq'),
    step('slash-blast', 'max', 'mob'),
    step('precise-strikes', 'max', 'acc'),
    step('power-strike', 'max', 'core'),
    step('improved-hp-recovery', 3, 'sustain'),
    step('max-hp-increase', 2, 'survival'),
  ],
  magician: [
    step('energy-bolt', 1, 'prereq'),
    step('magic-claw', 'max', 'core'),
    step('magic-guard', 'max', 'survival'),
    step('improved-mp-recovery', 'max', 'mp'),
    step('max-mp-increase', 10, 'mp'),
    step('magic-armor', 6, 'survival'),
  ],
  bowman: [
    step('arrow-blow', 1, 'prereq'),
    step('double-shot', 'max', 'core'),
    step('the-eye-of-amazon', 'max', 'range'),
    step('critical-shot', 'max', 'crit'),
    step('focus', 10, 'acc'),
  ],
  'thief:claw': [
    step('lucky-seven', 'max', 'core'),
    step('nimble-body', 'max', 'acc'),
    step('keen-eyes', 'max', 'range'),
    step('disorder', 3, 'prereq'),
    step('dark-sight', 8, 'survival'),
  ],
  'thief:dagger': [
    step('double-stab', 'max', 'core'),
    step('nimble-body', 'max', 'acc'),
    step('disorder', 'max', 'boss'),
    step('dark-sight', 6, 'survival'),
  ],

  // ── 2nd job (SP: 1 at advancement + 3 per level from 30) ──
  'fighter:sword': [
    step('sword-mastery', 5, 'mastery'), step('sword-booster', 1, 'speed'), step('sword-mastery', 'max', 'mastery'),
    step('rage', 'max', 'damage'), step('final-attack-sword', 'max', 'damage'), step('sword-booster', 'max', 'speed'), step('rush', 'max', 'mobility'),
  ],
  'fighter:axe': [
    step('axe-mastery', 5, 'mastery'), step('axe-booster', 1, 'speed'), step('axe-mastery', 'max', 'mastery'),
    step('rage', 'max', 'damage'), step('final-attack-axe', 'max', 'damage'), step('axe-booster', 'max', 'speed'), step('rush', 'max', 'mobility'),
  ],
  'page:sword': [
    step('sword-mastery', 5, 'mastery'), step('sword-booster', 1, 'speed'), step('sword-mastery', 'max', 'mastery'),
    step('final-attack-sword', 'max', 'damage'), step('threaten', 'max', 'boss'), step('sword-booster', 'max', 'speed'), step('rush', 'max', 'mobility'),
  ],
  'page:blunt': [
    step('blunt-weapon-mastery', 5, 'mastery'), step('blunt-weapon-booster', 1, 'speed'), step('blunt-weapon-mastery', 'max', 'mastery'),
    step('final-attack-blunt-weapon', 'max', 'damage'), step('threaten', 'max', 'boss'), step('blunt-weapon-booster', 'max', 'speed'), step('rush', 'max', 'mobility'),
  ],
  'spearman:spear': [
    step('spear-mastery', 5, 'mastery'), step('spear-booster', 1, 'speed'), step('spear-mastery', 'max', 'mastery'),
    step('final-attack-spear', 'max', 'damage'), step('spear-booster', 'max', 'speed'), step('iron-will', 'max', 'survival'), step('rush', 'max', 'mobility'),
  ],
  'spearman:polearm': [
    step('polearm-mastery', 5, 'mastery'), step('polearm-booster', 1, 'speed'), step('polearm-mastery', 'max', 'mastery'),
    step('final-attack-polearm', 'max', 'damage'), step('polearm-booster', 'max', 'speed'), step('iron-will', 'max', 'survival'), step('rush', 'max', 'mobility'),
  ],
  fp: [
    step('teleport', 1, 'mobility'), step('fire-arrow', 'max', 'core'), step('mp-eater', 3, 'prereq'), step('meditation', 'max', 'damage'),
    step('poison-breath', 'max', 'mob'), step('teleport', 'max', 'mobility'), step('mp-eater', 'max', 'mp'),
  ],
  il: [
    step('teleport', 1, 'mobility'), step('thunder-bolt', 'max', 'mob'), step('mp-eater', 3, 'prereq'), step('meditation', 'max', 'damage'),
    step('cold-beam', 'max', 'core'), step('teleport', 'max', 'mobility'), step('mp-eater', 'max', 'mp'),
  ],
  cleric: [
    step('teleport', 1, 'mobility'), step('heal', 'max', 'sustain'), step('holy-arrow', 'max', 'core'), step('bless', 'max', 'survival'),
    step('invincible', 'max', 'survival'), step('teleport', 'max', 'mobility'),
  ],
  hunter: [
    step('bow-mastery', 5, 'mastery'), step('bow-booster', 1, 'speed'), step('bow-mastery', 'max', 'mastery'), step('arrow-bomb-bow', 'max', 'mob'),
    step('final-attack-bow', 'max', 'damage'), step('bow-booster', 'max', 'speed'), step('soul-arrow-bow', 'max', 'ammo'), step('amazon-s-judgement', 1, 'utility'),
  ],
  crossbowman: [
    step('crossbow-mastery', 5, 'mastery'), step('crossbow-booster', 1, 'speed'), step('crossbow-mastery', 'max', 'mastery'), step('iron-arrow-crossbow', 'max', 'mob'),
    step('final-attack-crossbow', 'max', 'damage'), step('crossbow-booster', 'max', 'speed'), step('soul-arrow-crossbow', 'max', 'ammo'), step('amazon-s-judgement', 1, 'utility'),
  ],
  assassin: [
    step('claw-mastery', 5, 'mastery'), step('claw-booster', 1, 'speed'), step('claw-mastery', 'max', 'mastery'), step('critical-throw', 'max', 'crit'),
    step('claw-booster', 'max', 'speed'), step('critical-recovery', 3, 'prereq'), step('drain', 'max', 'sustain'), step('haste', 18, 'mobility'),
  ],
  bandit: [
    step('dagger-mastery', 5, 'mastery'), step('dagger-booster', 1, 'speed'), step('dagger-mastery', 'max', 'mastery'), step('savage-blow', 'max', 'core'),
    step('haste', 5, 'prereq'), step('steal', 'max', 'damage'), step('dagger-booster', 'max', 'speed'), step('haste', 'max', 'mobility'),
  ],
};

export const WEAPON_FAMILY = {
  '1h_sword': 'sword', '2h_sword': 'sword', '1h_axe': 'axe', '2h_axe': 'axe', '1h_blunt': 'blunt', '2h_blunt': 'blunt',
  spear: 'spear', polearm: 'polearm', bow: 'bow', crossbow: 'crossbow', claw: 'claw', dagger: 'dagger', wand: 'wand', staff: 'staff',
};

export function guideFor(key, weapon) {
  const fam = WEAPON_FAMILY[weapon];
  return GUIDES[key + ':' + fam] || GUIDES[key] || Object.entries(GUIDES).find(([k]) => k.startsWith(key + ':'))?.[1] || [];
}

/** SP available per tier (classic rules assumed: 1 at advancement + 3 per level) */
export function spAvailable(job, level) {
  const adv1 = job === 'magician' ? 8 : 10;
  const first = level >= adv1 ? 1 + 3 * (Math.min(level, 30) - adv1) : 0;
  const second = level >= 30 ? 1 + 3 * (level - 30) : 0;
  return { first, second, adv1 };
}

// level checkpoints shown in the roadmap (sourced: NiaDB Forgotten Hollow guide, Lv 39–60)
export const ROADMAP = [
  { lv: 39, key: 'hollow' },
];

// KMS-style Korean names for the ko locale (others fall back to the English name)
export const SKILL_KO = {
  'power-strike': '파워 스트라이크', 'slash-blast': '슬래시 블러스트', 'iron-body': '아이언 바디', 'improved-hp-recovery': 'HP 회복력 향상', 'max-hp-increase': '맥스 HP 증가',
  'sword-mastery': '소드 마스터리', 'axe-mastery': '액스 마스터리', 'blunt-weapon-mastery': '블런트 웨폰 마스터리', 'spear-mastery': '스피어 마스터리', 'polearm-mastery': '폴암 마스터리',
  'sword-booster': '소드 부스터', 'axe-booster': '액스 부스터', 'blunt-weapon-booster': '블런트 웨폰 부스터', 'spear-booster': '스피어 부스터', 'polearm-booster': '폴암 부스터',
  'final-attack-sword': '파이널 어택: 소드', 'final-attack-axe': '파이널 어택: 액스', 'final-attack-blunt-weapon': '파이널 어택: 블런트 웨폰', 'final-attack-spear': '파이널 어택: 스피어', 'final-attack-polearm': '파이널 어택: 폴암',
  rage: '분노', threaten: '위협', 'iron-will': '아이언 월', rush: '러시',
  'energy-bolt': '에너지 볼트', 'magic-claw': '매직 클로', 'magic-guard': '매직 가드', 'magic-armor': '매직 아머', 'improved-mp-recovery': 'MP 회복력 향상', 'max-mp-increase': '맥스 MP 증가',
  'mp-eater': 'MP 이터', meditation: '메디테이션', teleport: '텔레포트', slow: '슬로우', 'fire-arrow': '파이어 애로우', 'poison-breath': '포이즌 브레스',
  'cold-beam': '콜드 빔', 'thunder-bolt': '썬더 볼트', heal: '힐', bless: '블레스', invincible: '인빈서블', 'holy-arrow': '홀리 애로우',
  'arrow-blow': '애로우 블로우', 'double-shot': '더블 샷', 'the-eye-of-amazon': '아마존의 눈', focus: '포커스', 'critical-shot': '크리티컬 샷', 'power-knockback': '파워 넉백',
  'bow-mastery': '보우 마스터리', 'crossbow-mastery': '크로스보우 마스터리', 'bow-booster': '보우 부스터', 'crossbow-booster': '크로스보우 부스터',
  'final-attack-bow': '파이널 어택: 보우', 'final-attack-crossbow': '파이널 어택: 크로스보우', 'soul-arrow-bow': '소울 애로우: 보우', 'soul-arrow-crossbow': '소울 애로우: 크로스보우',
  'arrow-bomb-bow': '애로우 봄', 'iron-arrow-crossbow': '아이언 애로우', 'amazon-s-judgement': '아마존의 심판',
  'lucky-seven': '럭키 세븐', 'double-stab': '더블 스탭', 'nimble-body': '님블 바디', 'keen-eyes': '킨 아이즈', disorder: '디스오더', 'dark-sight': '다크 사이트',
  'claw-mastery': '자벨린 마스터리', 'critical-throw': '크리티컬 스로우', 'claw-booster': '자벨린 부스터', 'critical-recovery': '크리티컬 리커버리', drain: '드레인', haste: '헤이스트',
  'dagger-mastery': '대거 마스터리', 'dagger-booster': '대거 부스터', 'nimble-recovery': '님블 리커버리', steal: '스틸', 'savage-blow': '새비지 블로우',
  'three-snails': '달팽이 세 마리', 'nimble-feet': '님블 피트', recovery: '리커버리',
};
