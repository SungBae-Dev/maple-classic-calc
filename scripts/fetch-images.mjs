#!/usr/bin/env node
// Downloads monster sprites, map minimaps, skill icons and item icons once into
// .cache/img (kept between CI runs with actions/cache) so the site serves them
// itself instead of hotlinking. IDs come from data/images.json (GMS v83 IDs).
// Source: the maplestory.io asset API. Missing images are skipped; the site
// simply shows no picture for them.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, '.cache/img');
const API = process.env.IMG_API || 'https://maplestory.io/api';
const MAP = JSON.parse(readFileSync(join(ROOT, 'data/images.json'), 'utf8'));
const manifestPath = join(OUT, 'manifest.json');
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {};

async function get(url, timeoutMs = 25000) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctl.signal, headers: { 'user-agent': 'maple-classic-calc (github.com/SungBae-Dev/maple-classic-calc)' } });
    return res;
  } finally { clearTimeout(timer); }
}

/** pick the GMS version closest to the one in images.json that the API actually has */
async function pickVersion() {
  const want = Number(MAP.asset.version);
  try {
    const res = await get(`${API}/wz`, 30000);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const list = await res.json();
    const gms = [...new Set(list.filter((v) => /gms/i.test(String(v.region ?? v.Region))).map((v) => String(v.mapleVersionId ?? v.MapleVersionId)))];
    const nums = gms.map(Number).filter(Number.isFinite);
    if (!nums.length) return String(want);
    nums.sort((a, b) => Math.abs(a - want) - Math.abs(b - want) || a - b);
    return String(nums[0]);
  } catch (e) {
    console.warn(`! version list unavailable (${e.message}); using ${want}`);
    return String(want);
  }
}

const version = await pickVersion();
const R = MAP.asset.region;
const jobImg = (skillId) => String(Math.floor(skillId / 10000)).padStart(3, '0');
const jobs = [];
for (const [key, id] of Object.entries(MAP.mobs)) jobs.push({ key: `mob/${key}`, url: `${API}/${R}/${version}/mob/${id}/icon` });
for (const [key, id] of Object.entries(MAP.maps)) jobs.push({ key: `map/${key}`, url: `${API}/${R}/${version}/map/${id}/minimap` });
for (const [key, id] of Object.entries(MAP.skills)) {
  jobs.push({ key: `skill/${key.replace('/', '.')}`, url: `${API}/wz/img/${R}/${version}/Skill/${jobImg(id)}.img/skill/${String(id).padStart(7, '0')}/icon` });
}
const itemIds = new Set([...Object.values(MAP.items.weapons), ...Object.values(MAP.items.scrolls).flatMap((s) => Object.values(s)), ...Object.values(MAP.items.drops || {})]);
for (const id of itemIds) jobs.push({ key: `item/${id}`, url: `${API}/${R}/${version}/item/${id}/icon` });

let ok = 0, cached = 0, failed = [];
async function one(job) {
  const file = job.key + '.png';
  if (manifest[job.key] && existsSync(join(OUT, file))) { cached++; return; }
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await get(job.url);
      const type = res.headers.get('content-type') || '';
      if (res.status === 404) break;
      if (!res.ok || !type.includes('image')) throw new Error(`HTTP ${res.status} ${type}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 64) throw new Error('empty image');
      mkdirSync(dirname(join(OUT, file)), { recursive: true });
      writeFileSync(join(OUT, file), buf);
      manifest[job.key] = file;
      ok++;
      return;
    } catch (e) {
      if (attempt === 2) { failed.push(`${job.key} (${e.message})`); return; }
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  failed.push(`${job.key} (404)`);
}

// a few at a time — be gentle with a free community API
const queue = jobs.slice();
await Promise.all(Array.from({ length: 4 }, async () => { while (queue.length) await one(queue.shift()); }));
mkdirSync(OUT, { recursive: true });
writeFileSync(manifestPath, JSON.stringify(manifest, null, 0));
const summary = `images: ${R} v${version} · ${ok} downloaded · ${cached} cached · ${failed.length} missing of ${jobs.length}`;
console.log(summary);
if (failed.length) console.log('missing:\n  ' + failed.join('\n  '));
// surface the result as a run annotation (visible in the run summary without opening logs)
if (process.env.GITHUB_ACTIONS) {
  console.log(`::notice title=Game images::${summary}`);
  if (failed.length) console.log(`::warning title=Missing images::${failed.slice(0, 12).join(', ')}${failed.length > 12 ? ' …' : ''}`);
}
