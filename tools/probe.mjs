// One-off probe: what does planet-helper.com/gmsclassic expose, and what do its robots/terms say?
const UA = 'Mozilla/5.0 (compatible; maple-classic-calc probe; one-off)';
const out = (title, msg) => console.log(`::notice title=${title}::${String(msg).replace(/\r?\n/g, ' ⏎ ').slice(0, 3800)}`);
async function get(url) {
  try {
    const r = await fetch(url, { headers: { 'user-agent': UA, 'accept-language': 'ko' }, redirect: 'follow' });
    const text = await r.text();
    return { status: r.status, type: r.headers.get('content-type'), text, url: r.url };
  } catch (e) { return { status: 0, text: String(e) }; }
}
const robots = await get('https://planet-helper.com/robots.txt');
out('robots', `${robots.status} ${robots.text.slice(0, 1500)}`);
const home = await get('https://planet-helper.com/gmsclassic/ko/');
out('home', `${home.status} ${home.type} ${home.url} len=${home.text.length}`);
const h = home.text;
out('title', (h.match(/<title[^>]*>([^<]*)/i) || [])[1] + ' | ' + ((h.match(/<meta[^>]+name="description"[^>]+content="([^"]*)/i) || [])[1] || ''));
const links = [...new Set([...h.matchAll(/href="([^"#]+)"/g)].map((m) => m[1]))];
out('links', links.slice(0, 120).join(' '));
const scripts = [...new Set([...h.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]))];
out('scripts', scripts.join(' '));
const apis = [...new Set([...h.matchAll(/["'(]((?:https?:)?\/\/[^"')\s]*(?:api|json|supabase|firebase|graphql)[^"')\s]*|\/[^"')\s]*(?:api|\.json)[^"')\s]*)/gi)].map((m) => m[1]))];
out('api-like', apis.slice(0, 60).join(' '));
const legal = links.filter((l) => /term|privacy|약관|정책|legal|about|faq|contact/i.test(l));
out('legal-links', legal.join(' ') || 'none');
for (const l of legal.slice(0, 3)) {
  const u = new URL(l, home.url).href;
  const p = await get(u);
  const body = p.text.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  out('legal ' + u.slice(0, 60), `${p.status} ${body.slice(0, 3500)}`);
}
const next = h.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
out('next-data', next ? next[1].slice(0, 3500) : 'no __NEXT_DATA__');
const text = h.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
out('text', text.slice(0, 3500));
// first JS bundle: look for API endpoints referenced in code
for (const s of scripts.slice(0, 6)) {
  const u = new URL(s, home.url).href;
  const js = await get(u);
  const hits = [...new Set([...js.text.matchAll(/["'`]((?:https?:\/\/[^"'`\s]{4,120})|(?:\/[a-z0-9_\-\/]*(?:api|price|market|item)[a-z0-9_\-\/.?=]*))["'`]/gi)].map((m) => m[1]))].filter((x) => !/w3\.org|reactjs|googleapis\.com\/css|schema\.org/.test(x));
  out('js ' + s.slice(-40), `${js.status} len=${js.text.length} :: ${hits.slice(0, 80).join(' ')}`);
}
