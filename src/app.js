import * as E from './engine.ts';
import * as A from './advisor.ts';
import MOBDATA from '../data/mobs.json';

const I = window.__I18N__ || {};
const L = window.__LOCALE__ || { code: 'en', mobName: 'en', meowPath: '', locales: [] };
const MOBS = MOBDATA.mobs.slice().sort((a, b) => a.lv - b.lv || a.id - b.id);
const MOB_BY_ID = new Map(MOBS.map((m) => [String(m.id), m]));

const $ = (id) => document.getElementById(id);
const t = (k, vars) => {
  let s = I[k] != null ? I[k] : k;
  if (vars) for (const [a, b] of Object.entries(vars)) s = s.split('{' + a + '}').join(String(b));
  return s;
};
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const mobName = (m) => (L.mobName === 'ko' ? m.ko : m.en);
const mobSrc = (m) => 'https://meowdb.com/msclassic/' + (L.meowPath || '') + 'monsters/' + m.id;
const store = {
  get(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
};

// ── number formatting ──
const nf = (d, min = d) => new Intl.NumberFormat(L.code, { maximumFractionDigits: d, minimumFractionDigits: min });
const nf0 = nf(0), nf1 = nf(1), nf2 = nf(2);
const f0 = (n) => (Number.isFinite(n) ? nf0.format(n) : '–');
const f1 = (n) => (Number.isFinite(n) ? nf1.format(n) : '–');
const f2 = (n) => (Number.isFinite(n) ? nf2.format(n) : '–');
const signed = (n, fmt) => (!Number.isFinite(n) ? '–' : (n > 0.0005 ? '+' : n < -0.0005 ? '−' : '') + fmt(Math.abs(n)));
const tone = (el, n) => { el.classList.toggle('pos', n > 0.0005); el.classList.toggle('neg', n < -0.0005); };

function affinityChips(m, withSource) {
  const parts = Object.entries(m.el).map(([el, a]) =>
    '<span class="chip ' + a + '">' + esc(t('aff.' + a, { el: t('skillEl.' + el) })) + '</span>');
  m.tags.forEach((tag) => parts.push('<span class="chip">' + esc(t('mobTag.' + tag)) + '</span>'));
  if (withSource) parts.push('<a class="chip" href="' + mobSrc(m) + '" target="_blank" rel="noopener">' + esc(t('mob.source')) + '</a>');
  return parts.join('');
}

// ── language suggestion (never redirects) ──
function langTip() {
  const el = $('langTip');
  if (!el || store.get('msc-langtip')) return;
  const prefs = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || '']).map((p) => String(p).toLowerCase());
  let match = null;
  for (const p of prefs) {
    match = L.locales.find((l) => l.code.toLowerCase() === p) || L.locales.find((l) => l.code.toLowerCase().split('-')[0] === p.split('-')[0]);
    if (match) break;
  }
  if (!match || match.code === L.code) return;
  el.innerHTML = '<a href="' + match.href + '" hreflang="' + match.code + '" lang="' + match.code + '">' + esc(match.suggest) + '</a>' +
    '<button type="button" aria-label="' + esc(t('js.close')) + '">✕</button>';
  el.hidden = false;
  el.querySelector('button').addEventListener('click', () => { el.hidden = true; store.set('msc-langtip', 1); });
}
document.querySelectorAll('[data-lang-link]').forEach((a) => a.addEventListener('click', () => store.set('msc-langtip', 1)));
langTip();

// ═════════════════════════ calculator page ═════════════════════════
function calcPage() {
  const KEY = 'msc-classic-v2';
  const NUM_FIELDS = ['level', 'masterySkillLv', 'str', 'dex', 'int', 'luk', 'watk', 'matk', 'acc', 'apPassive', 'apBuff', 'skillPct', 'hits', 'critRate', 'critDmg', 'defIgnorePct'];
  const DEFAULTS = { level: 1, skillPct: 100, hits: 1 };
  const DELTA_FIELDS = ['str', 'dex', 'int', 'luk', 'watk', 'matk', 'acc'];
  const JOB_KEYS = Object.keys(E.JOBS);
  const WEAPON_KEYS = Object.keys(E.WEAPONS);
  const base = E.DEFAULT_CHAR;
  const tauro = MOB_BY_ID.get('52');
  const mobFrom = (m, enabled) => ({ enabled, level: m.lv, eva: m.eva, wdef: m.wdef, mdef: m.mdef, element: 'neutral', presetId: String(m.id) });

  const PRESETS = {
    fighter70: { c: { ...base }, mob: mobFrom(tauro, false), ref: null, delta: { watk: 3, dex: -2 } },
    warrior30: {
      c: { ...base, weapon: '1h_sword', action: 'inherited', level: 30, str: 132, dex: 30, int: 4, luk: 4, watk: 47, apPassive: 0, apBuff: 0, masterySkillLv: 0, acc: 49, skillPct: 260 },
      mob: mobFrom(MOB_BY_ID.get('29'), false), ref: null, delta: { str: 3 },
    },
    assassin70: {
      c: { ...base, job: 'thief', weapon: 'claw', action: 'shoot', level: 70, str: 4, dex: 70, int: 4, luk: 320, watk: 88, apPassive: 20, apBuff: 0, masterySkillLv: 20, acc: 120, skillPct: 100, hits: 1 },
      mob: mobFrom(tauro, false), ref: null, delta: { luk: 3, watk: -1 },
    },
    mage70: {
      c: { ...base, job: 'magician', weapon: 'wand', action: 'inherited', level: 70, str: 4, dex: 4, int: 340, luk: 40, watk: 0, matk: 100, apPassive: 0, apBuff: 0, masterySkillLv: 0, acc: 95, skillPct: 100, hits: 1, skillElement: 'ice' },
      mob: mobFrom(tauro, false), ref: null, delta: { int: 3, matk: 2 },
    },
  };

  // ── options ──
  const addOpt = (sel, value, text) => { const o = document.createElement('option'); o.value = value; o.textContent = text; sel.appendChild(o); };
  function fillWeapons(job, selected) {
    const sel = $('weapon');
    sel.innerHTML = '';
    E.JOBS[job].forEach((w) => addOpt(sel, w, t('weapon.' + w)));
    sel.value = E.JOBS[job].includes(selected) ? selected : E.JOBS[job][0];
  }
  function fillActions(weapon, selected) {
    const sel = $('action');
    const acts = E.WEAPONS[weapon].actions;
    sel.innerHTML = '';
    acts.forEach((a) => addOpt(sel, a, t('action.' + a)));
    if (acts.length) sel.value = acts.includes(selected) ? selected : acts[0];
  }
  E.ELEMENT_KEYS.forEach((k) => addOpt($('mobElement'), k, t('elem.' + k)));
  E.SKILL_ELEMENTS.forEach((k) => addOpt($('skillElement'), k, t('skillEl.' + k)));
  (function fillMobPresets() {
    const sel = $('mobPreset');
    addOpt(sel, '', t('mob.custom'));
    const groups = [[1, 20], [21, 40], [41, 60], [61, 999]];
    groups.forEach(([a, b]) => {
      const g = document.createElement('optgroup');
      g.label = b >= 999 ? t('mob.bandUp', { a }) : t('mob.band', { a, b });
      MOBS.filter((m) => !m.tags.includes('boss') && m.lv >= a && m.lv <= b).forEach((m) => addOpt(g, String(m.id), mobName(m) + ' · Lv ' + m.lv));
      if (g.children.length) sel.appendChild(g);
    });
    const boss = document.createElement('optgroup');
    boss.label = t('mob.bandBoss');
    MOBS.filter((m) => m.tags.includes('boss')).forEach((m) => addOpt(boss, String(m.id), mobName(m) + ' · Lv ' + m.lv));
    sel.appendChild(boss);
  })();

  // ── state ──
  const num = (el, d = 0) => { const v = parseFloat(el.value); return Number.isFinite(v) ? v : d; };

  function readState() {
    const jobEl = document.querySelector('input[name="job"]:checked');
    const c = { job: jobEl ? jobEl.value : 'warrior', weapon: $('weapon').value, action: $('action').value || 'inherited', skillElement: $('skillElement').value || 'none' };
    NUM_FIELDS.forEach((k) => { c[k] = num($(k), DEFAULTS[k] ?? 0); });
    const presetId = $('mobPreset').value;
    const preset = MOB_BY_ID.get(presetId);
    const mob = {
      enabled: $('mobEnabled').checked, level: num($('mobLevel'), 1), eva: num($('mobEva')), wdef: num($('mobWdef')), mdef: num($('mobMdef')),
      element: $('mobElement').value || 'neutral', presetId: preset ? presetId : '', affinity: preset ? preset.el : undefined,
    };
    const refRaw = $('ref').value.trim();
    const ref = refRaw === '' ? null : parseFloat(refRaw);
    const delta = {};
    DELTA_FIELDS.forEach((k) => { delta[k] = num($('d_' + k)); });
    return { c, mob, ref: Number.isFinite(ref) ? ref : null, delta };
  }

  function writeState(s) {
    const c = { ...base, ...s.c };
    const jobEl = $('job-' + c.job);
    if (jobEl) jobEl.checked = true;
    fillWeapons(c.job, c.weapon);
    fillActions($('weapon').value, c.action);
    NUM_FIELDS.forEach((k) => { $(k).value = c[k] ?? ''; });
    $('skillElement').value = E.SKILL_ELEMENTS.includes(c.skillElement) ? c.skillElement : 'none';
    const mob = { ...E.DEFAULT_MOB, ...(s.mob || {}) };
    $('mobEnabled').checked = !!mob.enabled;
    $('mobLevel').value = mob.level; $('mobEva').value = mob.eva; $('mobWdef').value = mob.wdef; $('mobMdef').value = mob.mdef;
    $('mobElement').value = E.ELEMENT_KEYS.includes(mob.element) ? mob.element : 'neutral';
    $('mobPreset').value = MOB_BY_ID.has(String(mob.presetId)) ? String(mob.presetId) : '';
    $('ref').value = s.ref != null ? s.ref : '';
    DELTA_FIELDS.forEach((k) => { const v = s.delta && s.delta[k]; $('d_' + k).value = v ? v : ''; });
  }

  function applyMobPreset(id) {
    const m = MOB_BY_ID.get(String(id));
    if (!m) return;
    $('mobPreset').value = String(m.id);
    $('mobLevel').value = m.lv; $('mobEva').value = m.eva; $('mobWdef').value = m.wdef; $('mobMdef').value = m.mdef;
  }

  // ── build code (MC2-…) ──
  const encN = (n) => { if (n == null || !Number.isFinite(n)) return 'x'; const s = String(Math.round(n * 100) / 100).replace('.', 'p'); return n < 0 ? 'n' + s.slice(1) : s; };
  const decN = (s) => { if (s === 'x') return null; const neg = s[0] === 'n'; const v = parseFloat((neg ? s.slice(1) : s).replace('p', '.')); if (!Number.isFinite(v)) throw new Error('bad'); return neg ? -v : v; };
  const CODE_LEN = 1 + 3 + NUM_FIELDS.length + 1 + 8;
  function encode(s) {
    const c = s.c, m = s.mob;
    const parts = [JOB_KEYS.indexOf(c.job), WEAPON_KEYS.indexOf(c.weapon), E.ACTIONS.indexOf(c.action)].map(encN);
    NUM_FIELDS.forEach((k) => parts.push(encN(c[k])));
    parts.push(encN(E.SKILL_ELEMENTS.indexOf(c.skillElement || 'none')));
    parts.push(m.enabled ? '1' : '0', encN(m.level), encN(m.eva), encN(m.wdef), encN(m.mdef), encN(E.ELEMENT_KEYS.indexOf(m.element)), m.presetId ? encN(+m.presetId) : 'x', encN(s.ref));
    return 'MC2-' + parts.join('-');
  }
  function decode(code) {
    const p = code.trim().split('-');
    if (p[0] !== 'MC2' || p.length !== CODE_LEN) throw new Error('format');
    let i = 1;
    const job = JOB_KEYS[decN(p[i++])], weapon = WEAPON_KEYS[decN(p[i++])], action = E.ACTIONS[decN(p[i++])];
    if (!job || !weapon || !action || E.WEAPONS[weapon].job !== job) throw new Error('enum');
    const c = { job, weapon, action };
    NUM_FIELDS.forEach((k) => { c[k] = decN(p[i++]) ?? 0; });
    c.skillElement = E.SKILL_ELEMENTS[decN(p[i++])] || 'none';
    const mob = {
      enabled: p[i++] === '1', level: decN(p[i++]) ?? 1, eva: decN(p[i++]) ?? 0, wdef: decN(p[i++]) ?? 0, mdef: decN(p[i++]) ?? 0,
      element: E.ELEMENT_KEYS[decN(p[i++])] || 'neutral',
    };
    const pid = decN(p[i++]);
    mob.presetId = pid != null && MOB_BY_ID.has(String(pid)) ? String(pid) : '';
    const ref = decN(p[i++]);
    return { c, mob, ref, delta: {} };
  }

  function applyVisibility(magic, mobOn) {
    document.querySelectorAll('[data-phys]').forEach((el) => { el.hidden = magic; });
    document.querySelectorAll('[data-magic]').forEach((el) => { el.hidden = !magic; });
    $('mobFields').hidden = !mobOn;
    $('mobOffNote').hidden = mobOn;
  }
  const setPresetPressed = (key) => document.querySelectorAll('[data-preset]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.preset === key)));

  // ── render ──
  function render() {
    const s = readState();
    const c = s.c, mob = s.mob;
    c.action = E.normalizeAction(c);
    const magic = E.isMagic(c);
    const spec = E.WEAPONS[c.weapon];
    const pLabel = E.STAT_LABEL[spec.primary];
    applyVisibility(magic, mob.enabled);

    const ml = E.masteryLevelFromSkill(c.masterySkillLv);
    $('masteryLabel').textContent = t('js.masteryLabel', { skill: t('mastery.' + spec.mastery) });
    $('masteryHint').textContent = (!magic && c.action === 'lucky7') ? t('js.masteryLucky') : t('js.masteryHint', { n: ml });
    $('watkHint').textContent = c.weapon === 'claw' ? t('js.watkStars') : (c.weapon === 'bow' || c.weapon === 'crossbow') ? t('js.watkArrows') : t('js.watkBase');
    $('apPassiveHint').textContent = c.weapon === 'claw' ? t('js.apPassiveClaw') : t('js.apPassiveHint');
    $('refLabel').textContent = magic ? t('res.refMagic') : t('res.refPhys');
    if (!magic) {
      const wm = spec.mult;
      const wv = E.weaponMults(c).w;
      $('actionHint').textContent = (c.action === 'inherited' && wm.swing !== wm.stab)
        ? t('js.actionHintMix', { w: wv.toFixed(2), s: wm.swing, t: wm.stab })
        : t('js.actionHint', { w: wv.toFixed(2) });
    }

    // monster preset + element
    const preset = MOB_BY_ID.get(mob.presetId);
    $('mobInfo').innerHTML = preset ? affinityChips(preset, true) : '';
    $('mobInfo').hidden = !preset;
    const auto = E.elementFromAffinity(mob.affinity, c.skillElement);
    const elSel = $('mobElement');
    if (auto) {
      elSel.value = auto; elSel.disabled = true; mob.element = auto;
      $('mobElementHint').textContent = t('js.elAuto', { el: t('skillEl.' + c.skillElement) });
    } else {
      elSel.disabled = false;
      $('mobElementHint').textContent = preset ? t('js.elPickSkill') : '';
    }

    // effective main stat
    const conv = E.convertedMainStat(c, s.ref);
    const P = E.primaryStat(c);
    $('conv').textContent = f0(conv);
    $('dockConv').textContent = f0(conv);
    if (s.ref == null) {
      $('convSub').textContent = magic ? t('js.convSubMagic', { p: f0(P) }) : t('js.convSubPhys', { stat: pLabel, p: f0(P), x: f1(conv - P) });
    } else {
      $('convSub').textContent = t(magic ? 'js.convSubPinMagic' : 'js.convSubPinPhys', { r: f0(s.ref), now: f0(magic ? c.matk : c.watk) });
    }

    const win = E.statWindowRange(c);
    $('winLabel').textContent = win.kind === 'magic' ? t('res.winMagic') : t('res.winPhys');
    $('winRange').textContent = f0(win.min) + ' ~ ' + f0(win.max);
    $('statAtk').textContent = f0(E.statAttack(c));
    if (magic) $('mtotal').textContent = f0(E.magicTotal(c));

    const ev = E.evaluate(c, mob);
    const sr = E.skillRange(c);
    $('skillRange').textContent = f0(sr.min) + ' ~ ' + f0(sr.max);
    $('perHit').textContent = f0(ev.perHit);
    $('perCast').textContent = f0(ev.perCast);
    $('dockHit').textContent = f0(ev.perHit);
    $('dockHitLabel').textContent = mob.enabled ? t('js.dockHitMob') : t('js.dockHit');

    const mods = [t('js.mod.crit', { v: ev.critMult.toFixed(3) })];
    if (mob.enabled) {
      mods.push(t('js.mod.def', { v: ev.defMult.toFixed(3) }));
      if (ev.elemMult !== 1) mods.push(t('js.mod.elem', { v: ev.elemMult }));
      if (ev.lvMult !== 1) mods.push(t('js.mod.lv', { v: ev.lvMult.toFixed(3) }));
      mods.push(t('js.mod.hit', { v: (ev.hit * 100).toFixed(1) }));
    }
    $('mods').innerHTML = mods.map((m) => '<span class="chip">' + esc(m) + '</span>').join('');

    $('hitBlock').hidden = !mob.enabled;
    if (mob.enabled) {
      const need = E.accForFullHit(c.level, mob);
      const st = $('hitState');
      st.className = 'state ' + (ev.hit >= 1 ? 'good' : ev.hit > 0 ? 'warn' : 'bad');
      st.textContent = ev.hit >= 1 ? t('js.hit.full') : ev.hit > 0 ? t('js.hit.partial', { v: (ev.hit * 100).toFixed(1) }) : t('js.hit.zero');
      $('hitNote').textContent = need == null
        ? t('js.hitNote.none')
        : t('js.hitNote.need', { need: f0(need), now: f0(c.acc) }) + (c.acc < need ? t('js.hitNote.short', { n: f0(need - c.acc) }) : '');
    }

    const cr = E.conversions(c, mob);
    $('convHead').textContent = t('js.convHead', { stat: pLabel });
    $('convNote').textContent = cr.zeroHit ? t('js.convNoteZero')
      : t(mob.enabled ? 'js.convNoteMob' : 'js.convNote', { stat: pLabel, d: f2(cr.dmgPerMainStat) });
    $('convNote').classList.toggle('warnline', !!cr.zeroHit);
    const itemLabel = (it) => it.key === 'mastery' ? t('js.item.mastery', { a: it.from, b: it.to })
      : ['str', 'dex', 'int', 'luk'].includes(it.key) ? t('js.item.stat', { stat: E.STAT_LABEL[it.key] })
      : t('js.item.' + it.key);
    $('convBody').innerHTML = cr.items.map((it) =>
      '<tr><td>' + esc(itemLabel(it)) + '</td><td class="n">' + pLabel + ' ' + f2(it.perPoint) + '</td></tr>'
    ).join('') || '<tr><td colspan="2">' + esc(t('js.convEmpty')) + '</td></tr>';

    const cmp = E.compareItem(c, s.delta, mob, s.ref);
    $('cmpDmgLabel').textContent = mob.enabled ? t('cmp.dmgMob') : t('cmp.dmg');
    const pctEl = $('cmpPct'); pctEl.textContent = signed(cmp.pct * 100, f2) + '%'; tone(pctEl, cmp.pct);
    const eqEl = $('cmpEq'); eqEl.textContent = pLabel + ' ' + signed(cmp.mainStatEq, f1); tone(eqEl, cmp.mainStatEq);
    const cvEl = $('cmpConv'); cvEl.textContent = signed(cmp.convertedDelta, f1); tone(cvEl, cmp.convertedDelta);
    const saEl = $('cmpStat'); saEl.textContent = signed(cmp.statAttackPct * 100, f2) + '%'; tone(saEl, cmp.statAttackPct);

    renderReport(c, mob, pLabel, magic);

    const snapshot = { c, mob: { ...mob, affinity: undefined }, ref: s.ref, delta: s.delta };
    $('codeOut').value = encode(snapshot);
    store.set(KEY, snapshot);
  }

  // ── spec report ──
  const STATUS_TONE = { oneshot: 'st-good', oneshotAvg: 'st-good', fast: 'st-good', ok: 'st-warn', slow: 'st-warn', miss: 'st-bad', cant: 'st-bad' };
  const killText = (r) => {
    if (r.status === 'cant') return t('rep.st.cant');
    if (r.status === 'oneshot') return t('rep.st.oneshot');
    if (r.status === 'oneshotAvg') return t('rep.st.oneshotAvg');
    return t('rep.st.n', { n: f0(r.castsIfHit) });
  };
  const pct = (h) => (h * 100).toFixed(h >= 1 || h <= 0 ? 0 : 1);
  const calcLink = (m) => '<a class="chip" href="#mob-' + m.id + '">' + esc(t('rep.calc')) + '</a>';

  function mobCard(r, extra) {
    const m = r.mob;
    const chips = [
      '<span class="chip ' + (r.hit >= 1 ? 'st-good' : r.hit >= 0.9 ? 'st-warn' : 'st-bad') + '">' + esc(t('rep.hitPct', { v: pct(r.hit) })) + '</span>',
      '<span class="chip ' + STATUS_TONE[r.status] + '">' + esc(killText(r)) + '</span>',
    ];
    if (r.needAcc != null && r.hit < 1) chips.push('<span class="chip">' + esc(t('rep.need', { v: f0(r.needAcc) })) + '</span>');
    chips.push(affinityChips({ ...m, tags: m.tags.filter((x) => x !== 'boss') }, false));
    chips.push(calcLink(m));
    return '<li class="card"><span class="nm">' + esc(mobName(m)) + '<small>Lv ' + m.lv + '</small></span>' +
      '<span class="big">' + extra + '</span><div class="chips">' + chips.join('') + '</div></li>';
  }

  function renderReport(c, mob, pLabel, magic) {
    const rep = A.buildReport(c, MOBS);
    $('huntList').innerHTML = rep.recommended.length
      ? rep.recommended.map((r) => mobCard(r, f1(r.expPerCast) + '<small>' + esc(t('rep.col.exp')) + '</small>')).join('')
      : '<li class="empty">' + esc(t('rep.hunt.empty')) + '</li>';

    const near = rep.rows.filter((r) => !r.mob.tags.includes('boss') && Math.abs(r.levelGap) <= 15);
    $('huntAll').innerHTML = near.map((r) =>
      '<tr><td class="name"><a href="#mob-' + r.mob.id + '">' + esc(mobName(r.mob)) + '</a></td>' +
      '<td class="n">' + r.mob.lv + '</td>' +
      '<td class="n hitcell ' + (r.hit >= 1 ? 'good' : r.hit >= 0.9 ? 'warn' : 'bad') + '">' + pct(r.hit) + '%</td>' +
      '<td><span class="chip ' + STATUS_TONE[r.status] + '">' + esc(killText(r)) + '</span></td>' +
      '<td class="n">' + f1(r.expPerCast) + '</td>' +
      '<td class="n">' + (r.needAcc == null ? '–' : f0(r.needAcc)) + '</td></tr>'
    ).join('');

    // reference target for upgrades: the monster set in the calculator, else the top hunting pick
    let ref = null;
    if (mob.enabled) {
      const p = MOB_BY_ID.get(mob.presetId);
      ref = p || { id: 0, en: '', ko: '', lv: mob.level, hp: 0, exp: 0, eva: mob.eva, wdef: mob.wdef, mdef: mob.mdef, el: {}, tags: [] };
    } else if (rep.recommended[0]) ref = rep.recommended[0].mob;
    $('upRef').textContent = ref && ref.id ? t('rep.up.refMob', { mob: mobName(ref) + ' (Lv ' + ref.lv + ')' })
      : ref ? t('rep.up.refCustom') : t('rep.up.refNone');

    const ups = A.upgrades(c, ref);
    const upLabel = (u) => {
      if (u.key === 'levelAp') return t('rep.up.levelAp', { stat: pLabel });
      if (u.key === 'mastery') return t('rep.up.mastery', { skill: t('mastery.' + E.WEAPONS[c.weapon].mastery), a: u.from, b: u.to });
      if (u.key === 'acc') return t('rep.up.acc', { n: f0(u.amount) });
      return t('rep.up.' + u.key);
    };
    $('upList').innerHTML = ups.length ? ups.map((u) =>
      '<li><span class="lbl">' + esc(upLabel(u)) + '</span><span class="gain">' + esc(t('rep.up.gain', { v: f2(u.gain * 100) })) + '</span>' +
      '<span class="eq">' + esc(Number.isFinite(u.mainEq) ? t('rep.up.eq', { stat: pLabel, v: f1(u.mainEq) }) : '') + '</span></li>'
    ).join('') : '<li class="empty">' + esc(t('js.convEmpty')) + '</li>';

    const target = rep.nextTarget;
    if (!target) {
      $('goalText').textContent = t('rep.goal.none');
    } else {
      const g = A.goalFor(c, target.mob);
      const parts = [];
      if (g.atk != null) parts.push(t(magic ? 'rep.goal.matk' : 'rep.goal.atk', { n: f0(g.atk) }));
      if (g.main != null) parts.push(t('rep.goal.main', { stat: pLabel, n: f0(g.main) }));
      let txt = t('rep.goal.body', { mob: mobName(target.mob), lv: target.mob.lv, a: f0(g.casts), b: f0(g.targetCasts) }) +
        (parts.length ? parts.join(t('rep.goal.or')) + '. ' : t('rep.goal.unreach') + '. ');
      txt += g.acc > 0 ? t('rep.goal.acc', { n: f0(g.acc) }) : t('rep.goal.accOk');
      $('goalText').textContent = txt;
    }

    $('bossList').innerHTML = rep.bosses.map((r) => mobCard(r,
      (Number.isFinite(r.castsExpected) ? f0(Math.ceil(r.castsExpected)) : '–') + '<small>' + esc(t('rep.boss.attacks')) + '</small>')).join('');
  }

  // highlight current section in the section nav
  const secLinks = Array.from(document.querySelectorAll('.secnav a'));
  if ('IntersectionObserver' in window && secLinks.length) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) secLinks.forEach((a) => a.classList.toggle('on', a.getAttribute('href') === '#' + en.target.id));
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    secLinks.forEach((a) => { const el = document.querySelector(a.getAttribute('href')); if (el) io.observe(el); });
  }

  // ── events ──
  const form = $('form');
  const MOB_EDIT = ['mobLevel', 'mobEva', 'mobWdef', 'mobMdef'];
  form.addEventListener('input', (e) => {
    if (e.target.id === 'codeIn') return;
    if (MOB_EDIT.includes(e.target.id)) $('mobPreset').value = '';
    setPresetPressed(null);
    render();
  });
  form.addEventListener('change', (e) => {
    if (e.target.name === 'job') {
      fillWeapons(e.target.value, null);
      fillActions($('weapon').value, null);
    } else if (e.target.id === 'weapon') {
      fillActions(e.target.value, $('action').value);
    } else if (e.target.id === 'mobPreset') {
      applyMobPreset(e.target.value);
    }
    if (e.target.id !== 'codeIn') render();
  });
  document.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => {
    writeState(PRESETS[b.dataset.preset]);
    setPresetPressed(b.dataset.preset);
    render();
  }));
  $('pinRef').addEventListener('click', () => {
    const s = readState();
    $('ref').value = E.isMagic(s.c) ? s.c.matk : s.c.watk;
    render();
  });
  $('clearDelta').addEventListener('click', () => { DELTA_FIELDS.forEach((k) => { $('d_' + k).value = ''; }); render(); });
  $('copyCode').addEventListener('click', () => {
    const el = $('codeOut');
    const done = () => { $('codeMsg').textContent = t('js.code.copied'); };
    const fallback = () => { el.focus(); el.select(); $('codeMsg').textContent = t('js.code.selected'); };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(el.value).then(done, fallback);
      else fallback();
    } catch (e) { fallback(); }
  });
  $('loadCode').addEventListener('click', () => {
    try {
      writeState(decode($('codeIn').value));
      setPresetPressed(null);
      render();
      $('codeIn').value = '';
      $('codeMsg').textContent = t('js.code.loaded');
    } catch (e) {
      $('codeMsg').textContent = t('js.code.error');
    }
  });

  function fromHash() {
    const m = /^#mob-(\d+)$/.exec(location.hash);
    if (!m || !MOB_BY_ID.has(m[1])) return false;
    $('mobEnabled').checked = true;
    applyMobPreset(m[1]);
    render();
    const sec = $('h-mob');
    if (sec && sec.scrollIntoView) sec.scrollIntoView({ block: 'start' });
    return true;
  }
  window.addEventListener('hashchange', fromHash);

  // ── boot ──
  const saved = store.get(KEY);
  let ok = false;
  if (saved && saved.c && E.WEAPONS[saved.c.weapon]) {
    try { writeState(saved); setPresetPressed(null); ok = true; } catch (e) { ok = false; }
  }
  if (!ok) { writeState(PRESETS.fighter70); setPresetPressed('fighter70'); }
  render();
  fromHash();
}

// ═════════════════════════ monster table page ═════════════════════════
function mobsPage() {
  const rows = Array.from(document.querySelectorAll('#mobRows tr'));
  const hitCols = Array.from(document.querySelectorAll('[data-hitcol]'));
  const saved = store.get('msc-mobs-v1') || {};
  if (saved.lv) $('myLevel').value = saved.lv;
  if (saved.acc) $('myAcc').value = saved.acc;

  function update() {
    const q = $('mobSearch').value.trim().toLowerCase();
    const myLv = parseFloat($('myLevel').value);
    const myAcc = parseFloat($('myAcc').value);
    const showHit = Number.isFinite(myAcc);
    hitCols.forEach((el) => { el.hidden = !showHit; });
    rows.forEach((tr) => {
      const lv = +tr.dataset.lv, eva = +tr.dataset.eva;
      tr.hidden = !!q && !tr.dataset.q.includes(q);
      const pl = Number.isFinite(myLv) && myLv > 0 ? myLv : lv;
      const need = E.accForFullHit(pl, { level: lv, eva });
      tr.querySelector('.need').textContent = need == null ? '–' : f0(need);
      const hc = tr.querySelector('.hitcell');
      hc.hidden = !showHit;
      if (showHit) {
        const h = E.hitChance(myAcc, pl, { level: lv, eva });
        hc.textContent = (h * 100).toFixed(h >= 1 || h <= 0 ? 0 : 1) + '%';
        hc.className = 'n hitcell ' + (h >= 1 ? 'good' : h > 0 ? 'warn' : 'bad');
      }
    });
    store.set('msc-mobs-v1', { lv: $('myLevel').value, acc: $('myAcc').value });
  }
  ['mobSearch', 'myLevel', 'myAcc'].forEach((id) => $(id).addEventListener('input', update));
  update();
}

if (document.body.dataset.page === 'calc') calcPage();
else if (document.body.dataset.page === 'mobs') mobsPage();
