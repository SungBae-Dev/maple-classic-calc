// Static multi-language build → dist/
// SITE_URL (env) sets canonical/hreflang/sitemap URLs. Default: GitHub Pages URL of this repo.
import { build, transform } from 'esbuild';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const SITE_URL = (process.env.SITE_URL || 'https://sungbae-dev.github.io/maple-classic-calc/').replace(/\/?$/, '/');
const TODAY = new Date().toISOString().slice(0, 10);

const FONT_COMMON = 'family=IBM+Plex+Mono:wght@400;600&family=Silkscreen';
const gf = (families) => `https://fonts.googleapis.com/css2?${families}&${FONT_COMMON}&display=swap`;
const LATIN = {
  href: gf('family=Fredoka:wght@500;600&family=IBM+Plex+Sans:wght@400;500;600'),
  display: "'Fredoka', 'IBM Plex Sans', system-ui, sans-serif", weight: 600,
  body: "'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', sans-serif",
};
export const LOCALES = [
  { code: 'en', name: 'English', path: '', og: 'en_US', meow: '', font: LATIN },
  { code: 'ko', name: '한국어', path: 'ko/', og: 'ko_KR', meow: 'ko/', font: {
    href: gf('family=Jua&family=IBM+Plex+Sans+KR:wght@400;500;700'),
    display: "'Jua', 'IBM Plex Sans KR', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif", weight: 400,
    body: "'IBM Plex Sans KR', 'Apple SD Gothic Neo', 'Malgun Gothic', system-ui, sans-serif" } },
  { code: 'es', name: 'Español', path: 'es/', og: 'es_ES', meow: 'es/', font: LATIN },
  { code: 'pt-BR', name: 'Português (Brasil)', path: 'pt-br/', og: 'pt_BR', meow: '', font: LATIN },
  { code: 'fr', name: 'Français', path: 'fr/', og: 'fr_FR', meow: '', font: LATIN },
  { code: 'de', name: 'Deutsch', path: 'de/', og: 'de_DE', meow: '', font: LATIN },
  { code: 'ja', name: '日本語', path: 'ja/', og: 'ja_JP', meow: '', font: {
    href: gf('family=M+PLUS+Rounded+1c:wght@500;700&family=IBM+Plex+Sans+JP:wght@400;500;700'),
    display: "'M PLUS Rounded 1c', 'IBM Plex Sans JP', 'Hiragino Sans', 'Yu Gothic', sans-serif", weight: 700,
    body: "'IBM Plex Sans JP', 'Hiragino Sans', 'Yu Gothic', 'Meiryo', system-ui, sans-serif" } },
  { code: 'zh-CN', name: '简体中文', path: 'zh-cn/', og: 'zh_CN', meow: 'zh-cn/', font: {
    href: gf('family=Noto+Sans+SC:wght@400;500;700'),
    display: "'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif", weight: 700,
    body: "'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif" } },
];
const PAGES = [
  { id: 'calc', path: '', tpl: 'calc.html', title: 'meta.calc.title', desc: 'meta.calc.desc', priority: '1.0' },
  { id: 'maps', path: 'maps/', tpl: 'maps.html', title: 'meta.maps.title', desc: 'meta.maps.desc', priority: '0.8' },
  { id: 'mobs', path: 'mobs/', tpl: 'mobs.html', title: 'meta.mobs.title', desc: 'meta.mobs.desc', priority: '0.8' },
];
// keys the browser script needs
const JS_PREFIXES = ['js.', 'weapon.', 'action.', 'elem.', 'skillEl.', 'aff.', 'mastery.', 'mobTag.', 'mob.', 'rep.', 'res.', 'cmp.', 'kpi.', 'sim.', 'tc.', 'boss.', 'scroll.', 'sk.', 'sktype.', 'reason.', 'path.', 'bld.', 'share.', 'sub.', 'job.', 'f.', 'tab.', 'map.', 'stage.', 'sv.'];

// ── helpers ──
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const hash = (s) => createHash('sha256').update(s).digest('hex').slice(0, 10);
const jsonForScript = (o) => JSON.stringify(o).replace(/</g, '\\u003c');
function render(tpl, ctx, where) {
  return tpl
    .replace(/\{\{\{\s*([\w.-]+)\s*\}\}\}/g, (_, k) => {
      if (!(k in ctx)) throw new Error(`${where}: missing raw key ${k}`);
      return ctx[k];
    })
    .replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, k) => {
      if (!(k in ctx)) throw new Error(`${where}: missing key ${k}`);
      return esc(ctx[k]);
    });
}

const EN = JSON.parse(read('src/i18n/en.json'));
function dict(code) {
  const p = join(ROOT, `src/i18n/${code}.json`);
  if (!existsSync(p)) { console.warn(`! ${code}.json missing → English fallback`); return { ...EN }; }
  const d = JSON.parse(readFileSync(p, 'utf8'));
  const missing = Object.keys(EN).filter((k) => !(k in d));
  if (missing.length) console.warn(`! ${code}: ${missing.length} keys fall back to English (${missing.slice(0, 5).join(', ')}…)`);
  return { ...EN, ...d };
}

// ── build ──
rmSync(DIST, { recursive: true, force: true });
mkdirSync(join(DIST, 'assets'), { recursive: true });

// engine for tests + build-time numbers
mkdirSync(join(ROOT, '.build'), { recursive: true });
await build({ entryPoints: [join(ROOT, 'src/engine.ts')], format: 'esm', outfile: join(ROOT, '.build/engine.mjs'), logLevel: 'warning' });
await build({ entryPoints: [join(ROOT, 'src/advisor.ts')], bundle: true, format: 'esm', outfile: join(ROOT, '.build/advisor.mjs'), logLevel: 'warning' });
await build({ entryPoints: [join(ROOT, 'src/maps.ts')], bundle: true, format: 'esm', outfile: join(ROOT, '.build/maps.mjs'), logLevel: 'warning' });
await build({ entryPoints: [join(ROOT, 'src/survive.ts')], bundle: true, format: 'esm', outfile: join(ROOT, '.build/survive.mjs'), logLevel: 'warning' });
const E = await import(pathToFileURL(join(ROOT, '.build/engine.mjs')).href + '?t=' + Date.now());

// merge skill data files for the browser bundle
const skillJobs = {};
for (const f of ['bowman', 'warrior', 'magician', 'thief']) {
  const p = join(ROOT, `data/skills-${f}.json`);
  if (!existsSync(p)) continue;
  const d = JSON.parse(readFileSync(p, 'utf8'));
  for (const [k, j] of Object.entries(d.jobs || {})) {
    skillJobs[k] = { tier: j.tier, src: j.src, skills: (j.skills || []).map(({ slug, en, type, maxLv, dmgPct, hits, targets, element, atMax, src }) => ({ slug, en, type, maxLv, dmgPct, hits, targets, element, atMax, src })) };
  }
}
// per-level tables, animation times and timing rules
let timing = {};
const extra = {};
for (const f of ['a', 'b']) {
  const p = join(ROOT, `data/skill-levels-${f}.json`);
  if (!existsSync(p)) continue;
  const d = JSON.parse(readFileSync(p, 'utf8'));
  if (d.timing) timing = { ...timing, ...d.timing };
  Object.assign(extra, d.skills || {});
}
for (const j of Object.values(skillJobs)) {
  j.skills = j.skills.map((sk) => {
    const x = extra[sk.slug];
    if (!x) return sk;
    return { ...sk, element: x.element ?? sk.element, animMs: x.animMs ?? sk.animMs, anim: x.anim, src: x.src || sk.src,
      levels: (x.levels || []).map(({ lv, dmg, hits, targets, ap, matk, mastery }) => ({ lv, dmg, hits, targets, ap, matk, mastery })) };
  });
}
const { boosterStages, ordinaryAttackMs, weaponStageRange, magicFixedMs, healMs } = timing;
writeFileSync(join(ROOT, '.build/skills.json'), JSON.stringify({ jobs: skillJobs, timing: { boosterStages, ordinaryAttackMs, weaponStageRange, magicFixedMs, healMs } }));

// game images downloaded by scripts/fetch-images.mjs (optional — the site works without them)
const IMG_DIR = join(ROOT, '.cache/img');
const IMG = existsSync(join(IMG_DIR, 'manifest.json')) ? JSON.parse(read('.cache/img/manifest.json')) : {};
const IMG_KEYS = Object.keys(IMG).filter((k) => existsSync(join(IMG_DIR, IMG[k]))).sort();
writeFileSync(join(ROOT, '.build/img.json'), JSON.stringify(IMG_KEYS));
const hasImg = new Set(IMG_KEYS);

const js = (await build({
  entryPoints: [join(ROOT, 'src/app.js')], bundle: true, minify: true, format: 'iife', target: 'es2019',
  write: false, logLevel: 'warning', loader: { '.json': 'json' },
})).outputFiles[0].text;
const jsPath = `assets/app.${hash(js)}.js`;
writeFileSync(join(DIST, jsPath), js);

const css = (await transform(read('src/styles.css'), { loader: 'css', minify: true })).code;
const cssPath = `assets/style.${hash(css)}.css`;
writeFileSync(join(DIST, cssPath), css);

const MOBS = JSON.parse(read('data/mobs.json')).mobs.slice().sort((a, b) => a.lv - b.lv || a.id - b.id);
const MOB_BY_ID = new Map(MOBS.map((m) => [m.id, m]));
const MAPS = JSON.parse(read('data/maps.json')).maps;
const Mx = await import(pathToFileURL(join(ROOT, '.build/maps.mjs')).href + '?t=' + Date.now());
const HEAD = read('src/pages/head.html');
const dicts = Object.fromEntries(LOCALES.map((l) => [l.code, dict(l.code)]));

const verification = [
  process.env.GOOGLE_SITE_VERIFICATION && `<meta name="google-site-verification" content="${esc(process.env.GOOGLE_SITE_VERIFICATION)}">`,
  process.env.NAVER_SITE_VERIFICATION && `<meta name="naver-site-verification" content="${esc(process.env.NAVER_SITE_VERIFICATION)}">`,
  process.env.BING_SITE_VERIFICATION && `<meta name="msvalidate.01" content="${esc(process.env.BING_SITE_VERIFICATION)}">`,
].filter(Boolean).join('\n');

const urlOf = (l, page) => SITE_URL + l.path + page.path;

const imgTag = (base, key, cls) => (hasImg.has(key) ? `<img class="${cls}" src="${base}img/${IMG[key]}" alt="" loading="lazy" decoding="async">` : '');

function mobRows(d, l, base) {
  const name = (m) => (l.code === 'ko' ? m.ko : m.en);
  return MOBS.map((m) => {
    const need = E.accForFullHit(m.lv, { level: m.lv, eva: m.eva });
    const chips = Object.entries(m.el).map(([el, a]) => `<span class="chip ${a}">${esc(d['aff.' + a].replace('{el}', d['skillEl.' + el]))}</span>`)
      .concat(m.tags.map((t) => `<span class="chip">${esc(d['mobTag.' + t])}</span>`)).join('');
    const q = [m.en, m.ko].join(' ').toLowerCase();
    const src = `https://meowdb.com/msclassic/${l.meow}monsters/${m.id}`;
    const sub = l.code === 'ko' ? `<small>${esc(m.en)}</small>` : '';
    return `<tr data-lv="${m.lv}" data-eva="${m.eva}" data-q="${esc(q)}">` +
      `<td class="name"><div class="withimg">${imgTag(base, 'mob/' + m.id, 'sprite')}<div><a href="${src}" target="_blank" rel="noopener">${esc(name(m))}</a>${sub}</div></div></td>` +
      `<td class="n">${m.lv}</td><td class="n need">${need ?? '–'}</td><td class="n hitcell" data-hitcol hidden></td>` +
      `<td class="n">${m.eva}</td><td class="n">${m.wdef}</td><td class="n">${m.mdef}</td>` +
      `<td><div class="chips">${chips}</div></td>` +
      `<td><a class="btn sm" href="${base}${l.path}#mob-${m.id}">${esc(d['mobs.open'])}</a></td></tr>`;
  }).join('\n');
}

function mapRows(d, l, base) {
  const ko = l.code === 'ko';
  const fmt = new Intl.NumberFormat(l.code, { maximumFractionDigits: 0 });
  return MAPS.map((m) => {
    const mobs = m.mobs.slice().sort((a, b) => b.count - a.count);
    const lvs = mobs.map((x) => MOB_BY_ID.get(x.id)?.lv ?? x.lv).filter(Boolean);
    const lvMin = Math.min(...lvs), lvMax = Math.max(...lvs);
    const chips = mobs.map((x) => {
      const mob = MOB_BY_ID.get(x.id);
      const nm = mob ? (ko ? mob.ko : mob.en) : x.en;
      return `<span class="chip">${imgTag(base, 'mob/' + x.id, 'ico')}${esc(nm)} <b>×${x.count}</b></span>`;
    }).join('');
    const q = [m.en, m.ko || '', m.region || '', ...mobs.map((x) => { const mob = MOB_BY_ID.get(x.id); return mob ? mob.en + ' ' + mob.ko : x.en || ''; })].join(' ').toLowerCase();
    const src = `https://meowdb.com/msclassic/${l.meow}maps/${m.id}`;
    const name = ko && m.ko ? m.ko : m.en;
    const sub = ko && m.ko ? `<small>${esc(m.en)}</small>` : (m.region ? `<small>${esc(ko && m.regionKo ? m.regionKo : m.region)}</small>` : '');
    return `<tr data-map="${m.id}" data-lvmin="${lvMin}" data-lvmax="${lvMax}" data-q="${esc(q)}">` +
      `<td class="name"><div class="withimg">${imgTag(base, 'map/' + m.id, 'minimap')}<div><a href="${src}" target="_blank" rel="noopener">${esc(name)}</a>${sub}</div></div></td>` +
      `<td class="n">${lvMin === lvMax ? lvMin : lvMin + '–' + lvMax}</td>` +
      `<td class="n">${m.spawns}</td><td class="n">${Mx.capacity(m.spawns)}</td><td class="n">${fmt.format(Mx.respawnPerHour(m.spawns))}</td>` +
      `<td><div class="chips">${chips}</div></td>` +
      `<td class="n mine kph" data-mine hidden></td><td class="n mine eph" data-mine hidden></td><td class="n mine lvup" data-mine hidden></td></tr>`;
  }).join('\n');
}

function jsonLd(d, l, page) {
  const url = urlOf(l, page);
  const inLanguage = l.code;
  if (page.id === 'calc') {
    return [
      {
        '@context': 'https://schema.org', '@type': 'WebApplication', name: d['meta.siteName'], alternateName: d['calc.h1'],
        url, inLanguage, description: d['meta.calc.desc'], applicationCategory: 'GameApplication', operatingSystem: 'Any',
        browserRequirements: 'Requires JavaScript', isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        about: { '@type': 'VideoGame', name: 'MapleStory', publisher: { '@type': 'Organization', name: 'Nexon' } },
      },
      {
        '@context': 'https://schema.org', '@type': 'FAQPage', inLanguage,
        mainEntity: [1, 2, 3, 4, 5, 6].map((i) => ({ '@type': 'Question', name: d[`faq.q${i}`], acceptedAnswer: { '@type': 'Answer', text: d[`faq.a${i}`] } })),
      },
    ];
  }
  const h1 = d[page.id + '.h1'];
  return [
    { '@context': 'https://schema.org', '@type': 'WebPage', name: h1, url, inLanguage, description: d[page.desc] },
    {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: d['meta.siteName'], item: urlOf(l, PAGES[0]) },
        { '@type': 'ListItem', position: 2, name: h1, item: url },
      ],
    },
  ];
}

const sitemapUrls = [];
for (const l of LOCALES) {
  const d = dicts[l.code];
  for (const page of PAGES) {
    const rel = l.path + page.path;
    const depth = rel.split('/').filter(Boolean).length;
    const base = '../'.repeat(depth);
    const where = `${l.code}/${page.id}`;

    const hreflang = LOCALES.map((x) => `<link rel="alternate" hreflang="${x.code}" href="${urlOf(x, page)}">`)
      .concat(`<link rel="alternate" hreflang="x-default" href="${urlOf(LOCALES[0], page)}">`).join('\n');
    const ogLocaleAlt = LOCALES.filter((x) => x !== l).map((x) => `<meta property="og:locale:alternate" content="${x.og}">`).join('\n');

    const nav = [
      `<a href="${base}${l.path}"${page.id === 'calc' ? ' aria-current="page"' : ''}>${esc(d['nav.calc'])}</a>`,
      `<a href="${base}${l.path}maps/"${page.id === 'maps' ? ' aria-current="page"' : ''}>${esc(d['nav.maps'])}</a>`,
      `<a href="${base}${l.path}mobs/"${page.id === 'mobs' ? ' aria-current="page"' : ''}>${esc(d['nav.mobs'])}</a>`,
      `<details class="langs"><summary>${esc(d['nav.lang'])} · ${esc(l.code.toUpperCase())}</summary><ul>` +
        LOCALES.map((x) => `<li><a href="${base}${x.path}${page.path}" hreflang="${x.code}" lang="${x.code}" data-lang-link${x === l ? ' aria-current="true"' : ''}>${esc(x.name)}</a></li>`).join('') +
        `</ul></details>`,
    ].join('');
    const topnav = `<nav class="topnav" aria-label="${esc(d['meta.siteName'])}"><a class="brand" href="${base}${l.path}"><img src="${base}favicon.svg" alt="" width="24" height="24">${esc(d['meta.siteName'])}</a><div class="navlinks">${nav}</div></nav>`;
    const footer = `<footer><span>${d['footer.formula_html']}</span><span>${esc(d['footer.notNexon'])}</span></footer>`;

    const i18n = Object.fromEntries(Object.entries(d).filter(([k]) => JS_PREFIXES.some((p) => k.startsWith(p))));
    const locale = {
      code: l.code, mobName: l.code === 'ko' ? 'ko' : 'en', meowPath: l.meow, base,
      locales: LOCALES.map((x) => ({ code: x.code, href: `${base}${x.path}${page.path}`, suggest: dicts[x.code].langSuggest })),
    };
    const scripts = `<script>window.__I18N__=${jsonForScript(i18n)};window.__LOCALE__=${jsonForScript(locale)};</script>\n<script src="${base}${jsPath}" defer></script>`;

    const ctx = {
      ...d,
      lang: l.code, htmlLang: l.code, canonical: urlOf(l, page), hreflang, ogLocale: l.og, ogLocaleAlt,
      ogImage: `${SITE_URL}og/${l.code}.png`, base, cssPath, fontsHref: l.font.href,
      fontDisplay: l.font.display, fontDisplayWeight: String(l.font.weight), fontBody: l.font.body,
      pageTitle: d[page.title], pageDesc: d[page.desc], verification,
      jsonld: jsonForScript(jsonLd(d, l, page)),
      topnav, footer, scripts,
    };
    ctx.head = render(HEAD, ctx, where);
    if (page.id === 'mobs') ctx.mobRows = mobRows(d, l, base);
    if (page.id === 'maps') ctx.mapRows = mapRows(d, l, base);
    const html = render(read(`src/pages/${page.tpl}`), ctx, where);
    mkdirSync(join(DIST, rel), { recursive: true });
    writeFileSync(join(DIST, rel, 'index.html'), html);
    sitemapUrls.push({ page, l });
  }
}

// sitemap with hreflang alternates
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${sitemapUrls.map(({ page, l }) => `  <url>
    <loc>${urlOf(l, page)}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${page.priority}</priority>
${LOCALES.map((x) => `    <xhtml:link rel="alternate" hreflang="${x.code}" href="${urlOf(x, page)}"/>`).join('\n')}
    <xhtml:link rel="alternate" hreflang="x-default" href="${urlOf(LOCALES[0], page)}"/>
  </url>`).join('\n')}
</urlset>
`;
writeFileSync(join(DIST, 'sitemap.xml'), sitemap);
writeFileSync(join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}sitemap.xml\n`);

// 404 (GitHub Pages)
const notFound = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Page not found · Maple Classic Calc</title>
<style>body{margin:0;font:16px/1.6 system-ui,sans-serif;background:#E7EEF5;color:#16212D;padding:48px max(16px,env(safe-area-inset-left,0px))}@media(prefers-color-scheme:dark){body{background:#0D151E;color:#E4EBF3}a{color:#F5A673}}a{color:#A3410D}ul{padding-left:18px}</style></head>
<body><h1>Page not found</h1><p>Open the calculator in your language:</p><ul>${LOCALES.map((x) => `<li><a href="${SITE_URL}${x.path}" hreflang="${x.code}" lang="${x.code}">${esc(x.name)}</a></li>`).join('')}</ul></body></html>`;
writeFileSync(join(DIST, '404.html'), notFound);

writeFileSync(join(DIST, 'site.webmanifest'), JSON.stringify({
  name: EN['meta.siteName'], short_name: 'Classic Calc', start_url: './', display: 'standalone',
  background_color: '#E7EEF5', theme_color: '#D2581B',
  icons: [{ src: 'apple-touch-icon.png', sizes: '180x180', type: 'image/png' }, { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' }],
}, null, 2));
writeFileSync(join(DIST, '.nojekyll'), '');
if (existsSync(join(ROOT, 'public'))) cpSync(join(ROOT, 'public'), DIST, { recursive: true });
for (const k of IMG_KEYS) { mkdirSync(dirname(join(DIST, 'img', IMG[k])), { recursive: true }); cpSync(join(IMG_DIR, IMG[k]), join(DIST, 'img', IMG[k])); }

console.log(`built ${sitemapUrls.length} pages · ${IMG_KEYS.length} images · ${jsPath} (${(js.length / 1024).toFixed(1)} KB) · ${cssPath} · ${SITE_URL}`);
