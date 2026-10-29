import * as E from './engine.ts';
import * as A from './advisor.ts';
import MOBDATA from '../data/mobs.json';
import SKILLDATA from '../.build/skills.json';
import { guideFor, spAvailable, ROADMAP, SKILL_KO } from './guides.js';

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

const nf = (d, min = d) => new Intl.NumberFormat(L.code, { maximumFractionDigits: d, minimumFractionDigits: min });
const nf0 = nf(0), nf1 = nf(1), nf2 = nf(2);
const f0 = (n) => (Number.isFinite(n) ? nf0.format(n) : '–');
const f1 = (n) => (Number.isFinite(n) ? nf1.format(n) : '–');
const f2 = (n) => (Number.isFinite(n) ? nf2.format(n) : '–');
const signed = (n, fmt) => (!Number.isFinite(n) ? '–' : (n > 0.0005 ? '+' : n < -0.0005 ? '−' : '') + fmt(Math.abs(n)));
const tone = (el, n) => { el.classList.toggle('pos', n > 0.0005); el.classList.toggle('neg', n < -0.0005); };
const secs = (s) => (!Number.isFinite(s) ? '–' : s < 10 ? t('js.sec', { v: f1(s) }) : t('js.sec', { v: f0(s) }));
const pct = (h) => (h * 100).toFixed(h >= 1 || h <= 0 ? 0 : 1);

function affinityChips(m, withSource) {
  const parts = Object.entries(m.el).map(([el, a]) =>
    '<span class="chip ' + a + '">' + esc(t('aff.' + a, { el: t('skillEl.' + el) })) + '</span>');
  m.tags.forEach((tag) => parts.push('<span class="chip">' + esc(t('mobTag.' + tag)) + '</span>'));
  if (withSource) parts.push('<a class="chip" href="' + mobSrc(m) + '" target="_blank" rel="noopener">' + esc(t('mob.source')) + '</a>');
  return parts.join('');
}

function copyText(el, value, msgEl, okKey, failKey) {
  const done = () => { msgEl.textContent = t(okKey); };
  const fallback = () => { el.focus(); el.select(); msgEl.textContent = t(failKey); };
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(value).then(done, fallback);
    else fallback();
  } catch (e) { fallback(); }
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

// ═════════════════════════ calculator / dashboard ═════════════════════════
function calcPage() {
  const KEY = 'msc-classic-v3';
  const BUILDS_KEY = 'msc-builds-v1';
  const NUM_FIELDS = ['level', 'masterySkillLv', 'str', 'dex', 'int', 'luk', 'watk', 'matk', 'acc', 'apPassive', 'apBuff', 'skillPct', 'hits', 'critRate', 'critDmg', 'defIgnorePct', 'attackMs'];
  const DEFAULTS = { level: 1, skillPct: 100, hits: 1, attackMs: A.DEFAULT_ATTACK_MS };
  const DELTA_FIELDS = ['str', 'dex', 'int', 'luk', 'watk', 'matk', 'acc', 'attackMs', 'cost'];
  const MOB_EDIT = ['mobLevel', 'mobHp', 'mobEva', 'mobWdef', 'mobMdef'];
  const JOB_KEYS = Object.keys(E.JOBS);
  const WEAPON_KEYS = Object.keys(E.WEAPONS);
  const SUB_KEYS = ['', ...Object.values(E.SUBJOBS).flat()];
  const base = E.DEFAULT_CHAR;
  const tauro = MOB_BY_ID.get('52');
  const mobFrom = (m, enabled) => ({ enabled, level: m.lv, hp: m.hp, eva: m.eva, wdef: m.wdef, mdef: m.mdef, element: 'neutral', presetId: String(m.id) });

  const PRESETS = {
    fighter70: { c: { ...base }, mob: mobFrom(tauro, false), ref: null, delta: { watk: 3, dex: -2, cost: 150 } },
    warrior30: {
      c: { ...base, weapon: '1h_sword', action: 'inherited', level: 30, str: 132, dex: 30, int: 4, luk: 4, watk: 47, apPassive: 0, apBuff: 0, masterySkillLv: 0, acc: 49, skillPct: 260, subJob: 'fighter' },
      mob: mobFrom(MOB_BY_ID.get('19'), true), ref: null, delta: { watk: 10, str: 4, cost: 150 },
    },
    assassin70: {
      c: { ...base, job: 'thief', subJob: 'assassin', weapon: 'claw', action: 'shoot', level: 70, str: 4, dex: 70, int: 4, luk: 320, watk: 88, apPassive: 20, apBuff: 0, masterySkillLv: 20, acc: 120, skillPct: 100, hits: 1, attackMs: 600 },
      mob: mobFrom(tauro, false), ref: null, delta: { luk: 3, watk: -1 },
    },
    mage70: {
      c: { ...base, job: 'magician', subJob: 'il', weapon: 'wand', action: 'inherited', level: 70, str: 4, dex: 4, int: 340, luk: 40, watk: 0, matk: 100, apPassive: 0, apBuff: 0, masterySkillLv: 0, acc: 95, skillPct: 100, hits: 1, skillElement: 'ice' },
      mob: mobFrom(tauro, false), ref: null, delta: { int: 3, matk: 2 },
    },
  };

  // ── options ──
  const addOpt = (sel, value, text) => { const o = document.createElement('option'); o.value = value; o.textContent = text; sel.appendChild(o); return o; };
  function fillSubJobs(job, selected) {
    const sel = $('subJob');
    sel.innerHTML = '';
    addOpt(sel, '', t('sub.none', { job: t('job.' + job) }));
    E.SUBJOBS[job].forEach((s) => addOpt(sel, s, t('sub.' + s)));
    sel.value = E.SUBJOBS[job].includes(selected) ? selected : '';
  }
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
    [[1, 20], [21, 40], [41, 60], [61, 999]].forEach(([a, b]) => {
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
    const c = {
      job: jobEl ? jobEl.value : 'warrior', subJob: $('subJob').value || '', weapon: $('weapon').value,
      action: $('action').value || 'inherited', skillElement: $('skillElement').value || 'none',
    };
    NUM_FIELDS.forEach((k) => { c[k] = num($(k), DEFAULTS[k] ?? 0); });
    const presetId = $('mobPreset').value;
    const preset = MOB_BY_ID.get(presetId);
    const mob = {
      enabled: $('mobEnabled').checked, level: num($('mobLevel'), 1), hp: num($('mobHp'), 0), eva: num($('mobEva')), wdef: num($('mobWdef')), mdef: num($('mobMdef')),
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
    fillSubJobs(c.job, c.subJob);
    fillWeapons(c.job, c.weapon);
    fillActions($('weapon').value, c.action);
    NUM_FIELDS.forEach((k) => { $(k).value = c[k] ?? DEFAULTS[k] ?? ''; });
    $('skillElement').value = E.SKILL_ELEMENTS.includes(c.skillElement) ? c.skillElement : 'none';
    const mob = { ...E.DEFAULT_MOB, hp: 0, ...(s.mob || {}) };
    $('mobEnabled').checked = !!mob.enabled;
    $('mobLevel').value = mob.level; $('mobHp').value = mob.hp || ''; $('mobEva').value = mob.eva; $('mobWdef').value = mob.wdef; $('mobMdef').value = mob.mdef;
    $('mobElement').value = E.ELEMENT_KEYS.includes(mob.element) ? mob.element : 'neutral';
    $('mobPreset').value = MOB_BY_ID.has(String(mob.presetId)) ? String(mob.presetId) : '';
    $('ref').value = s.ref != null ? s.ref : '';
    if (s.delta) DELTA_FIELDS.forEach((k) => { const v = s.delta[k]; $('d_' + k).value = v ? v : ''; });
  }

  function applyMobPreset(id) {
    const m = MOB_BY_ID.get(String(id));
    if (!m) return;
    $('mobPreset').value = String(m.id);
    $('mobLevel').value = m.lv; $('mobHp').value = m.hp; $('mobEva').value = m.eva; $('mobWdef').value = m.wdef; $('mobMdef').value = m.mdef;
  }

  // ── build code (MC3-…) ──
  const encN = (n) => { if (n == null || !Number.isFinite(n)) return 'x'; const s = String(Math.round(n * 100) / 100).replace('.', 'p'); return n < 0 ? 'n' + s.slice(1) : s; };
  const decN = (s) => { if (s === 'x') return null; const neg = s[0] === 'n'; const v = parseFloat((neg ? s.slice(1) : s).replace('p', '.')); if (!Number.isFinite(v)) throw new Error('bad'); return neg ? -v : v; };
  const CODE_LEN = 1 + 4 + NUM_FIELDS.length + 1 + 9;
  function encode(s) {
    const c = s.c, m = s.mob;
    const parts = [JOB_KEYS.indexOf(c.job), SUB_KEYS.indexOf(c.subJob || ''), WEAPON_KEYS.indexOf(c.weapon), E.ACTIONS.indexOf(c.action)].map(encN);
    NUM_FIELDS.forEach((k) => parts.push(encN(c[k])));
    parts.push(encN(E.SKILL_ELEMENTS.indexOf(c.skillElement || 'none')));
    parts.push(m.enabled ? '1' : '0', encN(m.level), encN(m.hp || 0), encN(m.eva), encN(m.wdef), encN(m.mdef), encN(E.ELEMENT_KEYS.indexOf(m.element)), m.presetId ? encN(+m.presetId) : 'x', encN(s.ref));
    return 'MC3-' + parts.join('-');
  }
  function decode(code) {
    const p = String(code).trim().split('-');
    if (p[0] !== 'MC3' || p.length !== CODE_LEN) throw new Error('format');
    let i = 1;
    const job = JOB_KEYS[decN(p[i++])], subJob = SUB_KEYS[decN(p[i++])] ?? '', weapon = WEAPON_KEYS[decN(p[i++])], action = E.ACTIONS[decN(p[i++])];
    if (!job || !weapon || !action || E.WEAPONS[weapon].job !== job) throw new Error('enum');
    const c = { job, subJob: E.SUBJOBS[job].includes(subJob) ? subJob : '', weapon, action };
    NUM_FIELDS.forEach((k) => { c[k] = decN(p[i++]) ?? DEFAULTS[k] ?? 0; });
    c.skillElement = E.SKILL_ELEMENTS[decN(p[i++])] || 'none';
    const mob = {
      enabled: p[i++] === '1', level: decN(p[i++]) ?? 1, hp: decN(p[i++]) ?? 0, eva: decN(p[i++]) ?? 0, wdef: decN(p[i++]) ?? 0, mdef: decN(p[i++]) ?? 0,
      element: E.ELEMENT_KEYS[decN(p[i++])] || 'neutral',
    };
    const pid = decN(p[i++]);
    mob.presetId = pid != null && MOB_BY_ID.has(String(pid)) ? String(pid) : '';
    const ref = decN(p[i++]);
    return { c, mob, ref, delta: null };
  }
  const shareUrl = (code) => location.href.split('#')[0] + '#b=' + code;

  function applyVisibility(magic, mobOn) {
    document.querySelectorAll('[data-phys]').forEach((el) => { el.hidden = magic; });
    document.querySelectorAll('[data-magic]').forEach((el) => { el.hidden = !magic; });
    $('mobFields').hidden = !mobOn;
    $('mobOffNote').hidden = mobOn;
  }
  const setPresetPressed = (key) => document.querySelectorAll('[data-preset]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.preset === key)));

  // target monster used by the diagnosis: the one set in "Target monster", else the top training pick
  function resolveTarget(c, mob, rep) {
    if (mob.enabled) {
      const p = MOB_BY_ID.get(mob.presetId);
      if (p) return { m: p, auto: false };
      return { m: { id: 0, en: t('mob.customName'), ko: t('mob.customName'), lv: mob.level, hp: mob.hp || 0, exp: 0, eva: mob.eva, wdef: mob.wdef, mdef: mob.mdef, el: {}, tags: [] }, auto: false };
    }
    if (rep.recommended[0]) return { m: rep.recommended[0].mob, auto: true };
    return { m: null, auto: true };
  }

  let last = null; // last computed state for other handlers

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
        ? t('js.actionHintMix', { w: wv.toFixed(2), s: wm.swing, t: wm.stab }) : t('js.actionHint', { w: wv.toFixed(2) });
    }

    // monster element
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

    // core numbers
    const conv = E.convertedMainStat(c, s.ref);
    const P = E.primaryStat(c);
    $('conv').textContent = f0(conv);
    $('convSub').textContent = s.ref == null
      ? (magic ? t('js.convSubMagic', { p: f0(P) }) : t('js.convSubPhys', { stat: pLabel, p: f0(P), x: f1(conv - P) }))
      : t(magic ? 'js.convSubPinMagic' : 'js.convSubPinPhys', { r: f0(s.ref), now: f0(magic ? c.matk : c.watk) });
    const win = E.statWindowRange(c);
    $('winLabel').textContent = win.kind === 'magic' ? t('res.winMagic') : t('res.winPhys');
    $('winRange').textContent = f0(win.min) + ' ~ ' + f0(win.max);
    $('statAtk').textContent = f0(E.statAttack(c));
    if (magic) $('mtotal').textContent = f0(E.magicTotal(c));
    const sr = E.skillRange(c);
    $('skillRange').textContent = f0(sr.min) + ' ~ ' + f0(sr.max);

    const rep = A.buildReport(c, MOBS);
    const tgt = resolveTarget(c, mob, rep);
    const target = tgt.m;
    const evMob = mob.enabled ? mob : (target ? A.mobInput(target) : E.NO_MOB);
    const ev = E.evaluate(c, evMob);
    $('perCast').textContent = f0(ev.perCast);

    // KPIs
    const tc = target && target.hp > 0 ? A.targetCheck(c, target) : null;
    const dpsNow = A.dps(c, target);
    $('kpiAvg').textContent = f0(ev.perHit);
    $('kpiAvgSub').textContent = target ? t('kpi.vs', { mob: mobName(target) }) : t('kpi.noMob');
    $('kpiDps').textContent = f0(dpsNow);
    $('kpiDpsSub').textContent = t('kpi.dpsSub', { ms: f0(c.attackMs) });
    $('kpiKill').textContent = tc && tc.hit > 0 ? t('rep.st.n', { n: f0(tc.casts) }) : '–';
    $('kpiKillSub').textContent = tc && tc.hit > 0 ? secs(tc.seconds) : (target ? t('rep.st.cant') : '');

    // summary + top bar
    const who = (c.subJob ? t('sub.' + c.subJob) : t('job.' + c.job)) + ' · Lv ' + c.level;
    $('sumWho').textContent = who;
    $('sumConv').textContent = f0(conv);
    $('sumDps').textContent = f0(dpsNow);

    const mods = [t('js.mod.crit', { v: ev.critMult.toFixed(3) })];
    if (evMob.enabled) {
      mods.push(t('js.mod.def', { v: ev.defMult.toFixed(3) }));
      if (ev.elemMult !== 1) mods.push(t('js.mod.elem', { v: ev.elemMult }));
      if (ev.lvMult !== 1) mods.push(t('js.mod.lv', { v: ev.lvMult.toFixed(3) }));
      mods.push(t('js.mod.hit', { v: (ev.hit * 100).toFixed(1) }));
    }
    $('mods').innerHTML = mods.map((m) => '<span class="chip">' + esc(m) + '</span>').join('');
    $('hitBlock').hidden = !evMob.enabled;
    if (evMob.enabled) {
      const need = E.accForFullHit(c.level, evMob);
      const st = $('hitState');
      st.className = 'state ' + (ev.hit >= 1 ? 'good' : ev.hit > 0 ? 'warn' : 'bad');
      st.textContent = ev.hit >= 1 ? t('js.hit.full') : ev.hit > 0 ? t('js.hit.partial', { v: (ev.hit * 100).toFixed(1) }) : t('js.hit.zero');
      $('hitNote').textContent = need == null ? t('js.hitNote.none')
        : t('js.hitNote.need', { need: f0(need), now: f0(c.acc) }) + (c.acc < need ? t('js.hitNote.short', { n: f0(need - c.acc) }) : '');
    }

    // stat value table
    const cr = E.conversions(c, evMob);
    $('convHead').textContent = t('js.convHead', { stat: pLabel });
    $('convNote').textContent = cr.zeroHit ? t('js.convNoteZero') : t(evMob.enabled ? 'js.convNoteMob' : 'js.convNote', { stat: pLabel, d: f2(cr.dmgPerMainStat) });
    $('convNote').classList.toggle('warnline', !!cr.zeroHit);
    const itemLabel = (it) => it.key === 'mastery' ? t('js.item.mastery', { a: it.from, b: it.to })
      : ['str', 'dex', 'int', 'luk'].includes(it.key) ? t('js.item.stat', { stat: E.STAT_LABEL[it.key] }) : t('js.item.' + it.key);
    $('convBody').innerHTML = cr.items.map((it) => '<tr><td>' + esc(itemLabel(it)) + '</td><td class="n">' + pLabel + ' ' + f2(it.perPoint) + '</td></tr>').join('')
      || '<tr><td colspan="2">' + esc(t('js.convEmpty')) + '</td></tr>';

    last = { s, c, mob, magic, pLabel, rep, target, tgtAuto: tgt.auto };
    renderSim();
    renderTarget();
    renderUpgrades();
    renderHunt();
    renderGear();
    renderScrolls();
    renderSkills();

    const snapshot = { c, mob: { ...mob, affinity: undefined }, ref: s.ref, delta: s.delta };
    const code = encode(snapshot);
    $('codeOut').value = code;
    $('shareOut').value = shareUrl(code);
    if (!viewingShared) store.set(KEY, snapshot);
  }

  // ── upgrade simulation chart ──
  function renderSim() {
    const { c, target, magic, pLabel } = last;
    const kind = (document.querySelector('input[name="simKind"]:checked') || {}).value || 'atk';
    $('simAtkLabel').textContent = magic ? t('sim.matk') : t('sim.atk');
    const steps = kind === 'atk' ? [0, 5, 10, 15, 20] : kind === 'main' ? [0, 10, 20, 30, 40] : [0, 5, 10, 15, 20];
    const pts = A.simulate(c, target && target.hp > 0 ? target : null, kind, steps);
    const W = 380, H = 200, padL = 40, padR = 10, padT = 24, padB = 26;
    const maxY = Math.max(1, ...pts.map((p) => p.dps)) * 1.15;
    const x = (i) => padL + (i * (W - padL - padR)) / (pts.length - 1);
    const y = (v) => padT + (1 - v / maxY) * (H - padT - padB);
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => maxY * f);
    const unit = kind === 'atk' ? (magic ? 'MATK' : 'ATK') : kind === 'main' ? pLabel : 'ACC';
    const unitName = kind === 'atk' ? (magic ? t('sim.matk') : t('sim.atk')) : kind === 'main' ? pLabel : t('sim.acc');
    let svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg">';
    ticks.forEach((v) => { svg += '<line class="grid-line" x1="' + padL + '" x2="' + (W - padR) + '" y1="' + y(v) + '" y2="' + y(v) + '"/><text class="axis" x="' + (padL - 8) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + f0(v) + '</text>'; });
    svg += '<line class="base" x1="' + padL + '" x2="' + (W - padR) + '" y1="' + y(pts[0].dps) + '" y2="' + y(pts[0].dps) + '"/>';
    const path = pts.map((p, i) => (i ? 'L' : 'M') + x(i) + ' ' + y(p.dps)).join(' ');
    svg += '<path class="area" d="' + path + ' L' + x(pts.length - 1) + ' ' + y(0) + ' L' + x(0) + ' ' + y(0) + 'Z"/>';
    svg += '<path class="line" d="' + path + '"/>';
    pts.forEach((p, i) => {
      const brk = i > 0 && p.casts != null && pts[i - 1].casts != null && p.casts < pts[i - 1].casts;
      svg += '<circle class="dot' + (brk ? ' brk' : '') + '" cx="' + x(i) + '" cy="' + y(p.dps) + '" r="' + (brk ? 5 : 4) + '"/>';
      svg += '<text class="axis" x="' + x(i) + '" y="' + (H - 8) + '" text-anchor="middle">' + (i ? '+' + p.d + ' ' + unit : t('sim.now')) + '</text>';
      if (brk) svg += '<text class="brk-lbl" x="' + x(i) + '" y="' + (y(p.dps) - 10) + '" text-anchor="middle">' + esc(t('rep.st.n', { n: p.casts })) + '</text>';
    });
    svg += '<text class="lbl" x="' + x(pts.length - 1) + '" y="' + (y(pts[pts.length - 1].dps) - (pts[pts.length - 1].casts != null && pts[pts.length - 2].casts != null && pts[pts.length - 1].casts < pts[pts.length - 2].casts ? 24 : 10)) + '" text-anchor="end">' + f0(pts[pts.length - 1].dps) + '</text>';
    svg += '</svg>';
    $('simChart').innerHTML = svg;
    const first = pts.find((p, i) => i > 0 && p.casts != null && p.casts < pts[0].casts);
    $('simNote').textContent = !target ? t('sim.noTarget')
      : first ? t('sim.breakpoint', { mob: mobName(target), d: first.d, unit: unitName, a: pts[0].casts, b: first.casts })
      : t('sim.flat', { mob: mobName(target), d: steps[steps.length - 1], unit: unitName, v: f1((pts[pts.length - 1].dps / Math.max(1e-9, pts[0].dps) - 1) * 100) });
  }

  // ── target check: now vs after the item swap ──
  function renderTarget() {
    const { c, s, target, tgtAuto } = last;
    if (!target || !(target.hp > 0)) {
      $('tcRef').textContent = t('tc.none');
      ['tcNow', 'tcAfter'].forEach((id) => { $(id).textContent = '–'; });
      ['tcNowRange', 'tcAfterRange'].forEach((id) => { $(id).textContent = ''; });
      $('tcCallout').textContent = '';
      return;
    }
    $('tcRef').textContent = t(tgtAuto ? 'tc.refAuto' : 'tc.ref', { mob: mobName(target), lv: target.lv, hp: f0(target.hp) });
    const g = A.gearCompare(c, s.delta, target, s.delta.cost);
    const a = A.targetCheck(c, target), b = A.targetCheck(g.afterChar, target);
    const show = (id, r) => {
      $(id).textContent = r.hit > 0 ? t('rep.st.n', { n: f0(r.casts) }) : '–';
      $(id + 'Range').textContent = r.hit > 0 ? t('tc.range', { a: r.castsBest, b: r.castsWorst }) : t('rep.st.cant');
    };
    show('tcNow', a); show('tcAfter', b);
    const hasDelta = Object.entries(s.delta).some(([k, v]) => k !== 'cost' && v);
    $('tcCallout').textContent = !hasDelta ? t('tc.noDelta')
      : b.casts < a.casts ? t('tc.fewer', { n: a.casts - b.casts, a: a.casts, b: b.casts })
      : b.casts > a.casts ? t('tc.more', { a: a.casts, b: b.casts })
      : t('tc.same', { a: a.casts, pct: f1(g.dpsPct * 100) });
  }

  // ── next upgrade ──
  function renderUpgrades() {
    const { c, target, magic, pLabel, rep } = last;
    $('upRef').textContent = target && target.id ? t('rep.up.refMob', { mob: mobName(target) + ' (Lv ' + target.lv + ')' })
      : target ? t('rep.up.refCustom') : t('rep.up.refNone');
    const ups = A.upgrades(c, target);
    const upLabel = (u) => u.key === 'levelAp' ? t('rep.up.levelAp', { stat: pLabel })
      : u.key === 'mastery' ? t('rep.up.mastery', { skill: t('mastery.' + E.WEAPONS[c.weapon].mastery), a: u.from, b: u.to })
      : u.key === 'acc' ? t('rep.up.acc', { n: f0(u.amount) }) : t('rep.up.' + u.key);
    $('upList').innerHTML = ups.length ? ups.map((u) =>
      '<li><span class="lbl">' + esc(upLabel(u)) + '</span><span class="gain">' + esc(t('rep.up.gain', { v: f2(u.gain * 100) })) + '</span>' +
      '<span class="eq">' + esc(Number.isFinite(u.mainEq) ? t('rep.up.eq', { stat: pLabel, v: f1(u.mainEq) }) : '') + '</span></li>').join('')
      : '<li class="empty">' + esc(t('js.convEmpty')) + '</li>';
    const nt = rep.nextTarget;
    if (!nt) { $('goalText').textContent = t('rep.goal.none'); return; }
    const g = A.goalFor(c, nt.mob);
    const parts = [];
    if (g.atk != null) parts.push(t(magic ? 'rep.goal.matk' : 'rep.goal.atk', { n: f0(g.atk) }));
    if (g.main != null) parts.push(t('rep.goal.main', { stat: pLabel, n: f0(g.main) }));
    $('goalText').textContent = t('rep.goal.body', { mob: mobName(nt.mob), lv: nt.mob.lv, a: f0(g.casts), b: f0(g.targetCasts) }) +
      (parts.length ? parts.join(t('rep.goal.or')) + '. ' : t('rep.goal.unreach') + '. ') + (g.acc > 0 ? t('rep.goal.acc', { n: f0(g.acc) }) : t('rep.goal.accOk'));
  }

  // ── hunting & bosses ──
  const STATUS_TONE = { oneshot: 'st-good', oneshotAvg: 'st-good', fast: 'st-good', ok: 'st-warn', slow: 'st-warn', miss: 'st-bad', cant: 'st-bad' };
  const killText = (r) => r.status === 'cant' ? t('rep.st.cant') : r.status === 'oneshot' ? t('rep.st.oneshot') : r.status === 'oneshotAvg' ? t('rep.st.oneshotAvg') : t('rep.st.n', { n: f0(r.castsIfHit) });
  function mobCard(r, extra, acts) {
    const m = r.mob;
    const chips = [
      '<span class="chip ' + (r.hit >= 1 ? 'st-good' : r.hit >= 0.9 ? 'st-warn' : 'st-bad') + '">' + esc(t('rep.hitPct', { v: pct(r.hit) })) + '</span>',
      '<span class="chip ' + STATUS_TONE[r.status] + '">' + esc(killText(r)) + '</span>',
    ];
    if (r.needAcc != null && r.hit < 1) chips.push('<span class="chip">' + esc(t('rep.need', { v: f0(r.needAcc) })) + '</span>');
    chips.push(affinityChips({ ...m, tags: m.tags.filter((x) => x !== 'boss') }, false));
    return '<li class="card"><span class="nm">' + esc(mobName(m)) + '<small>Lv ' + m.lv + '</small></span><span class="big">' + extra + '</span>' +
      '<div class="chips">' + chips.join('') + '</div><div class="acts">' + (acts || '') + '<a class="chip" href="#mob-' + m.id + '">' + esc(t('rep.calc')) + '</a></div></li>';
  }
  function renderHunt() {
    const { c, rep } = last;
    const tsec = (m) => { const tc = A.targetCheck(c, m); return tc.hit > 0 ? secs(tc.seconds) : '–'; };
    $('huntList').innerHTML = rep.recommended.length
      ? rep.recommended.map((r) => mobCard(r, f1(r.expPerCast) + '<small>' + esc(t('rep.col.exp')) + ' · ' + esc(tsec(r.mob)) + '</small>')).join('')
      : '<li class="empty">' + esc(t('rep.hunt.empty')) + '</li>';
    const near = rep.rows.filter((r) => !r.mob.tags.includes('boss') && Math.abs(r.levelGap) <= 15);
    $('huntAll').innerHTML = near.map((r) =>
      '<tr><td class="name"><a href="#mob-' + r.mob.id + '">' + esc(mobName(r.mob)) + '</a></td><td class="n">' + r.mob.lv + '</td>' +
      '<td class="n hitcell ' + (r.hit >= 1 ? 'good' : r.hit >= 0.9 ? 'warn' : 'bad') + '">' + pct(r.hit) + '%</td>' +
      '<td><span class="chip ' + STATUS_TONE[r.status] + '">' + esc(killText(r)) + '</span></td><td class="n">' + esc(tsec(r.mob)) + '</td>' +
      '<td class="n">' + f1(r.expPerCast) + '</td><td class="n">' + (r.needAcc == null ? '–' : f0(r.needAcc)) + '</td></tr>').join('');
    $('bossList').innerHTML = rep.bosses.map((r) => {
      const tc = A.targetCheck(c, r.mob);
      const extra = (tc.hit > 0 ? esc(secs(tc.seconds)) : '–') + '<small>' + esc(tc.hit > 0 ? t('boss.kill', { n: f0(Math.ceil(r.castsExpected)) }) : t('rep.st.cant')) + '</small>';
      return mobCard(r, extra, '<button class="chip" type="button" data-share-boss="' + r.mob.id + '">' + esc(t('boss.share')) + '</button>');
    }).join('');
  }

  // ── gear workbench ──
  function renderGear() {
    const { c, s, target, magic, pLabel } = last;
    const g = A.gearCompare(c, s.delta, target && target.hp > 0 ? target : null, s.delta.cost);
    const hasDelta = Object.entries(s.delta).some(([k, v]) => k !== 'cost' && v);
    $('cmpCallout').textContent = !hasDelta ? t('cmp.empty')
      : t(target ? 'cmp.summary' : 'cmp.summaryNoMob', { mob: target ? mobName(target) : '', avg: signed(g.avgPct * 100, f1), dps: signed(g.dpsPct * 100, f1) });
    const row = (label, a, b, better) => {
      const cls = better == null ? '' : better > 0 ? ' up' : better < 0 ? ' down' : '';
      return '<tr><td>' + esc(label) + '</td><td class="n">' + a + '</td><td class="n' + cls + '">' + b + '</td></tr>';
    };
    const B = g.before, Aa = g.after;
    const sec = E.WEAPONS[c.weapon].secondary.map((x) => E.STAT_LABEL[x]).join('+');
    let rows = '';
    rows += magic ? row(t('f.matk'), f0(B.matk), f0(Aa.matk), Aa.matk - B.matk) : row(t('f.watk'), f0(B.watk), f0(Aa.watk), Aa.watk - B.watk);
    rows += row(pLabel + ' / ' + sec, f0(B.main) + ' / ' + f0(B.sec), f0(Aa.main) + ' / ' + f0(Aa.sec), (Aa.main - B.main) || (Aa.sec - B.sec));
    rows += row(t('f.attackMs'), f0(B.attackMs) + ' ms', f0(Aa.attackMs) + ' ms', B.attackMs - Aa.attackMs);
    rows += row(t('cmp.avgHit'), f0(B.avgHit), f0(Aa.avgHit), Aa.avgHit - B.avgHit);
    rows += row(t('kpi.dps'), f0(B.dps), f0(Aa.dps), Aa.dps - B.dps);
    if (B.casts != null) rows += row(t('cmp.casts'), t('rep.st.n', { n: B.casts }), t('rep.st.n', { n: Aa.casts }), B.casts - Aa.casts);
    if (B.seconds != null) rows += row(t('cmp.time'), secs(B.seconds), secs(Aa.seconds), B.seconds - Aa.seconds);
    $('cmpTable').innerHTML = rows;
    $('costBox').hidden = !(hasDelta && g.perMillion != null);
    if (g.perMillion != null) $('costText').innerHTML = esc(t('cmp.perMillion', { cost: new Intl.NumberFormat(L.code, { notation: 'compact', maximumFractionDigits: 1 }).format(s.delta.cost * 10000) })) + ' <b>' + esc(signed(g.perMillion, f2)) + '%p</b>';
  }

  // ── scroll expectations ──
  function renderScrolls() {
    const { c, target, magic } = last;
    const slots = num($('sc_slots'), 7);
    const unit = magic ? t('scroll.unitMagic') : t('scroll.unitAtk');
    const plans = [
      { key: '100', successPct: 100, gain: 1, price10k: num($('sc_price100')) },
      { key: '60', successPct: 60, gain: 2, price10k: num($('sc_price60')) },
      { key: '10', successPct: 10, gain: 5, price10k: num($('sc_price10')) },
    ];
    const res = plans.map((p) => ({ p, r: A.scrollExpectation(c, target && target.hp > 0 ? target : null, { ...p, slots }) }));
    const best = res.filter((x) => x.r.perMillion != null).sort((a, b) => b.r.perMillion - a.r.perMillion)[0];
    $('scrollTable').innerHTML = res.map(({ p, r }) =>
      '<tr' + (best && best.p === p ? ' class="best"' : '') + '><td>' + esc(t('scroll.type', { pct: p.successPct, gain: p.gain, unit })) + '</td>' +
      '<td class="n">+' + f1(r.expectedGain) + '</td><td class="n">' + signed(r.dpsPct * 100, f1) + '%</td>' +
      '<td class="n">' + (r.allSuccessPct >= 0.1 ? f1(r.allSuccessPct) : '<0.1') + '%</td>' +
      '<td class="n">' + (r.perMillion == null ? '–' : signed(r.perMillion, f2) + '%p') + '</td></tr>').join('');
  }

  // ── skills & roadmap ──
  const SK = SKILLDATA.jobs || {};
  const skName = (sk) => (L.code === 'ko' && SKILL_KO[sk.slug]) ? SKILL_KO[sk.slug] : sk.en;
  function renderSkills() {
    const { c, rep, magic } = last;
    const sub = c.subJob;
    const sp = spAvailable(c.job, c.level);
    const tiers = [{ key: c.job, tier: 'first', label: t('job.' + c.job) }];
    if (sub) tiers.push({ key: sub, tier: 'second', label: t('sub.' + sub) });
    $('skIntro').textContent = t(sub ? 'sk.intro2' : 'sk.intro', { job: sub ? t('sub.' + sub) : t('job.' + c.job), lv: c.level });
    let html = '';
    let tableRows = '';
    tiers.forEach((tr) => {
      const data = SK[tr.key];
      const skillBy = new Map(((data && data.skills) || []).map((x) => [x.slug, x]));
      const guide = guideFor(tr.key, c.weapon);
      const avail = sp[tr.tier];
      const levels = {};
      let used = 0;
      let items = '';
      guide.forEach((g) => {
        const sk = skillBy.get(g.skill);
        if (!sk) return;
        const to = g.to === 'max' ? sk.maxLv : Math.min(g.to, sk.maxLv);
        const from = levels[g.skill] || 0;
        const cost = Math.max(0, to - from);
        levels[g.skill] = Math.max(from, to);
        const start = used; used += cost;
        const state = avail >= used ? 'done' : avail > start ? 'now' : '';
        items += '<li class="' + state + '"><span class="t">' + esc(skName(sk)) + ' <small>Lv ' + from + ' → ' + to + '</small></span>' +
          '<span class="d">' + esc(t('reason.' + g.why)) + ' · SP ' + cost + '</span></li>';
      });
      html += '<h3 class="skhead">' + esc(t('sk.tierHead', { job: tr.label, sp: avail, need: used })) + '</h3>' +
        (items ? '<ol class="steps">' + items + '</ol>' : '<p class="note">' + esc(t('sk.none')) + '</p>');
      if (data) {
        tableRows += '<tr class="grp"><th colspan="3" scope="rowgroup">' + esc(tr.label) + '</th></tr>' + data.skills.map((sk) =>
          '<tr><td class="name"><a href="' + esc(sk.src || data.src) + '" target="_blank" rel="noopener">' + esc(skName(sk)) + '</a><small>' + esc(t('sktype.' + sk.type)) + (sk.dmgPct ? ' · ' + sk.dmgPct + '%' + (sk.hits > 1 ? ' ×' + sk.hits : '') : '') + '</small></td>' +
          '<td class="n">' + esc(sk.maxLv ?? '–') + '</td><td>' + esc(sk.atMax || '') + '</td></tr>').join('');
      }
    });
    $('skOrder').innerHTML = html;
    $('skTable').innerHTML = tableRows || '<tr><td colspan="3">' + esc(t('sk.noData')) + '</td></tr>';

    // roadmap
    const steps = [];
    const lv = c.level;
    steps.push({ done: lv >= sp.adv1, tt: t('path.adv1', { lv: sp.adv1, job: t('job.' + c.job) }), d: t('path.adv1d') });
    steps.push({ done: lv >= 30 && !!sub, now: lv >= 30 && !sub, tt: t('path.adv2', { lv: 30 }), d: sub ? t('sub.' + sub) : t('path.adv2d') });
    ROADMAP.forEach((r) => steps.push({ done: lv >= r.lv, tt: t('path.' + r.key, { lv: r.lv }), d: t('path.' + r.key + 'd') }));
    if (rep.recommended[0]) steps.push({ now: true, tt: t('path.train', { mob: mobName(rep.recommended[0].mob) }), d: t('path.traind', { exp: f1(rep.recommended[0].expPerCast) }) });
    if (rep.nextTarget) {
      const g = A.goalFor(c, rep.nextTarget.mob);
      const bits = [];
      if (g.atk != null) bits.push(t(magic ? 'rep.goal.matk' : 'rep.goal.atk', { n: g.atk }));
      if (g.acc > 0) bits.push(t('path.acc', { n: g.acc }));
      steps.push({ tt: t('path.next', { mob: mobName(rep.nextTarget.mob), lv: rep.nextTarget.mob.lv }), d: bits.join(' · ') });
    }
    rep.bosses.forEach((r) => steps.push({ done: r.hit >= 1, tt: t('path.boss', { mob: mobName(r.mob), lv: r.mob.lv }), d: r.needAcc == null ? '' : t('path.bossd', { need: f0(r.needAcc), now: f0(c.acc) }) }));
    $('pathList').innerHTML = steps.map((st) => '<li class="' + (st.done ? 'done' : st.now ? 'now' : '') + '"><span class="t">' + esc(st.tt) + '</span><span class="d">' + esc(st.d || '') + '</span></li>').join('');
  }

  // ── saved builds ──
  const builds = () => store.get(BUILDS_KEY) || [];
  function renderBuilds() {
    const list = builds();
    const cur = last ? A.dps(last.c, last.target) : 0;
    $('bldList').innerHTML = list.length ? list.map((b, i) => {
      let info = '';
      try {
        const st = decode(b.code);
        const cc = { ...base, ...st.c };
        const d = A.dps(cc, last && last.target);
        info = (cc.subJob ? t('sub.' + cc.subJob) : t('job.' + cc.job)) + ' · Lv ' + cc.level + ' · ' + t('res.conv') + ' ' + f0(E.convertedMainStat(cc, st.ref)) +
          ' · DPS ' + f0(d) + (cur > 0 ? ' (' + signed((d / cur - 1) * 100, f1) + '%)' : '');
      } catch (e) { info = t('bld.broken'); }
      return '<li class="card"><span class="nm">' + esc(b.name) + '<small>' + esc(new Date(b.at).toLocaleDateString(L.code)) + '</small></span><span class="big"></span>' +
        '<div class="chips"><span class="chip">' + esc(info) + '</span></div>' +
        '<div class="acts"><button class="chip" type="button" data-bld-load="' + i + '">' + esc(t('bld.load')) + '</button>' +
        '<button class="chip" type="button" data-bld-share="' + i + '">' + esc(t('share.copyLink')) + '</button>' +
        '<button class="chip" type="button" data-bld-del="' + i + '">' + esc(t('bld.delete')) + '</button></div></li>';
    }).join('') : '<li class="empty">' + esc(t('bld.empty')) + '</li>';
  }

  // ── tabs ──
  const TABS = ['diag', 'hunt', 'gear', 'skills', 'builds'];
  function showTab(name, scroll) {
    if (!TABS.includes(name)) name = 'diag';
    document.querySelectorAll('[data-panel]').forEach((p) => { p.hidden = p.dataset.panel !== name; });
    document.querySelectorAll('#tabbar a').forEach((a) => { if (a.dataset.tab === name) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    $('summary').hidden = name === 'diag';
    if (name === 'builds') renderBuilds();
    if (scroll) { const tb = $('tabbar'); const top = tb.getBoundingClientRect().top + window.scrollY - 8; if (window.scrollY > top) window.scrollTo({ top }); }
  }

  // ── shared builds (#b=MC3-…) ──
  let viewingShared = false;
  function route() {
    const h = location.hash;
    const mb = /^#b=(MC3-[\w.-]+)$/.exec(h);
    if (mb) {
      try {
        writeState(decode(mb[1]));
        viewingShared = true;
        const tip = $('sharedTip');
        tip.innerHTML = '<span>' + esc(t('share.viewing')) + '</span><button class="btn sm" type="button" id="sharedKeep">' + esc(t('share.keep')) + '</button><button class="btn sm" type="button" id="sharedBack">' + esc(t('share.back')) + '</button>';
        tip.hidden = false;
        $('sharedKeep').addEventListener('click', () => { viewingShared = false; tip.hidden = true; history.replaceState(null, '', '#diag'); render(); });
        $('sharedBack').addEventListener('click', () => { viewingShared = false; tip.hidden = true; history.replaceState(null, '', '#diag'); boot(true); });
        render();
        showTab(last && last.mob.enabled && MOB_BY_ID.get(last.mob.presetId) && MOB_BY_ID.get(last.mob.presetId).tags.includes('boss') ? 'hunt' : 'diag');
        return;
      } catch (e) { /* fall through */ }
    }
    const mm = /^#mob-(\d+)$/.exec(h);
    if (mm && MOB_BY_ID.has(mm[1])) {
      $('mobEnabled').checked = true;
      applyMobPreset(mm[1]);
      render();
      showTab('diag');
      const sec = $('h-mob');
      if (sec && sec.scrollIntoView) sec.scrollIntoView({ block: 'start' });
      return;
    }
    showTab(h.slice(1), true);
  }
  window.addEventListener('hashchange', route);

  // ── events ──
  const onEdit = (e) => {
    const id = e.target.id || '';
    if (id === 'codeIn' || id === 'bldName' || id === 'shareOut' || id === 'codeOut') return;
    if (MOB_EDIT.includes(id)) $('mobPreset').value = '';
    if (e.type === 'change') {
      if (e.target.name === 'job') { fillSubJobs(e.target.value, null); fillWeapons(e.target.value, null); fillActions($('weapon').value, null); }
      else if (id === 'weapon') fillActions(e.target.value, $('action').value);
      else if (id === 'mobPreset') applyMobPreset(e.target.value);
    }
    if (e.target.name !== 'simKind') setPresetPressed(null);
    render();
  };
  document.addEventListener('input', (e) => { if (e.target.closest('.tabpanel')) onEdit(e); });
  document.addEventListener('change', (e) => { if (e.target.closest('.tabpanel') && e.target.type !== 'file') onEdit(e); });
  document.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => { writeState(PRESETS[b.dataset.preset]); setPresetPressed(b.dataset.preset); render(); }));
  $('pinRef').addEventListener('click', () => { const s = readState(); $('ref').value = E.isMagic(s.c) ? s.c.matk : s.c.watk; render(); });
  $('clearDelta').addEventListener('click', () => { DELTA_FIELDS.forEach((k) => { $('d_' + k).value = ''; }); render(); });
  $('applyDelta').addEventListener('click', () => {
    const s = readState();
    const g = A.gearCompare(s.c, s.delta, null, 0);
    const after = g.afterChar;
    writeState({ ...s, c: after, delta: {} });
    DELTA_FIELDS.forEach((k) => { $('d_' + k).value = ''; });
    render();
    $('cmpCallout').textContent = t('cmp.applied');
  });
  $('copyCode').addEventListener('click', () => copyText($('codeOut'), $('codeOut').value, $('codeMsg'), 'js.code.copied', 'js.code.selected'));
  $('copyShare').addEventListener('click', () => copyText($('shareOut'), $('shareOut').value, $('codeMsg'), 'share.copied', 'js.code.selected'));
  $('loadCode').addEventListener('click', () => {
    try { writeState(decode($('codeIn').value)); setPresetPressed(null); render(); $('codeIn').value = ''; $('codeMsg').textContent = t('js.code.loaded'); }
    catch (e) { $('codeMsg').textContent = t('js.code.error'); }
  });
  document.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.shareBoss) {
      const s = readState();
      const m = MOB_BY_ID.get(b.dataset.shareBoss);
      const code = encode({ c: { ...s.c, action: E.normalizeAction(s.c) }, mob: mobFrom(m, true), ref: s.ref });
      copyText($('shareOut'), shareUrl(code), $('bossMsg'), 'boss.copied', 'js.code.selected');
      return;
    }
    const list = builds();
    if (b.dataset.bldLoad != null) {
      const it = list[+b.dataset.bldLoad];
      try { writeState(decode(it.code)); render(); showTab('diag'); history.replaceState(null, '', '#diag'); } catch (err) { $('bldMsg').textContent = t('bld.broken'); }
    } else if (b.dataset.bldShare != null) {
      const it = list[+b.dataset.bldShare];
      copyText($('shareOut'), shareUrl(it.code), $('bldMsg'), 'share.copied', 'js.code.selected');
    } else if (b.dataset.bldDel != null) {
      if (b.dataset.armed !== '1') { b.dataset.armed = '1'; b.textContent = t('bld.confirm'); b.classList.add('danger'); return; }
      list.splice(+b.dataset.bldDel, 1);
      store.set(BUILDS_KEY, list);
      renderBuilds();
      $('bldMsg').textContent = t('bld.deleted');
    }
  });
  $('bldSave').addEventListener('click', () => {
    const s = readState();
    s.c.action = E.normalizeAction(s.c);
    const name = $('bldName').value.trim() || ((s.c.subJob ? t('sub.' + s.c.subJob) : t('job.' + s.c.job)) + ' Lv' + s.c.level);
    const list = builds();
    list.unshift({ name, at: Date.now(), code: encode({ c: s.c, mob: { ...s.mob, affinity: undefined }, ref: s.ref }) });
    store.set(BUILDS_KEY, list.slice(0, 50));
    $('bldName').value = '';
    renderBuilds();
    $('bldMsg').textContent = t('bld.saved', { name });
  });
  $('bldExport').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ app: 'maple-classic-calc', version: 1, builds: builds() }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'maple-classic-builds.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    $('bldMsg').textContent = t('bld.exported');
  });
  $('bldImport').addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const data = JSON.parse(String(r.result));
        const incoming = (data.builds || []).filter((b) => b && typeof b.code === 'string' && typeof b.name === 'string');
        incoming.forEach((b) => decode(b.code));
        store.set(BUILDS_KEY, [...incoming, ...builds()].slice(0, 50));
        renderBuilds();
        $('bldMsg').textContent = t('bld.imported', { n: incoming.length });
      } catch (err) { $('bldMsg').textContent = t('bld.importError'); }
      e.target.value = '';
    };
    r.readAsText(f);
  });

  // ── boot ──
  ['sc_slots'].forEach((id) => { if (!$(id).value) $(id).value = 7; });
  function boot(fromSaved) {
    const saved = store.get(KEY);
    let ok = false;
    if (saved && saved.c && E.WEAPONS[saved.c.weapon]) { try { writeState(saved); setPresetPressed(null); ok = true; } catch (e) { ok = false; } }
    if (!ok) { writeState(PRESETS.fighter70); setPresetPressed('fighter70'); }
    render();
    if (!fromSaved) route();
  }
  boot(false);
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
