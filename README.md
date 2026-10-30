# Maple Classic Calc · 메이플 클래식 환산

MapleStory Classic World (GMS) effective-main-stat calculator with a spec report.
메이플스토리 클래식 월드(GMS) 환산 주스탯 계산기 + 스펙 진단.

**Live:** https://sungbae-dev.github.io/maple-classic-calc/ · [한국어](https://sungbae-dev.github.io/maple-classic-calc/ko/) · English · Español · Português · Français · Deutsch · 日本語 · 简体中文

## 기능 (Features)

스탯창 값을 **한 번만** 입력하면 탭마다 진단이 이어져요. 입력값은 브라우저에 저장돼요.

**필수 입력은 9개뿐**: 직업 · 2차 전직 · 레벨 · 무기 · STR/DEX/INT/LUK · 총 공격력(마력) · 명중.
나머지는 자동이에요: 스킬 가이드대로 찍었을 때의 스킬 레벨 → 클래식 스킬 데이터의 레벨별 %·타수·대상 수·속성, 숙련도, 분노·메디테이션·자벨린 숙련 AP, 부스터, 무기 속도 단계별 공격 시간. 가장 DPS가 높은 스킬을 자동 선택하고, "고급 설정"에서 어떤 값이든 덮어쓸 수 있어요.

| 탭 | 내용 |
|---|---|
| **진단** | 환산 주스탯 · 1타 기대 데미지 · 예상 DPS · 타깃 처치 횟수/시간, 업그레이드 시뮬레이션 차트(공격력·주스탯·명중 +n 시 DPS와 "몇 방" 변곡점), 타깃 체크(현재 → 교체 후, 편차), 다음 스펙업 순위 + 목표 |
| **사냥·보스** | **맵별 사냥 효율**: 맵 스폰·리젠 한도와 내 처치 속도로 시간당 처치 수·경험치·레벨업 시간 순위(다수기 대상 수·실제 공격 시간 비율 조정), 몹별 추천(명중률·처치 횟수·공격당 경험치), 보스 준비도 + **보스 빌드 공유 링크** |
| **장비·주문서** | 장비 교체 비교표(공격력·스탯·공격 간격·평균 데미지·DPS·처치 횟수·시간), **100만 메소당 DPS 증가율**, 교체 세팅 적용, 주문서 100%/60%/10% 기대값·메소 효율 |
| **스킬** | 2차 전직·무기별 **SP 투자 순서**(현재 레벨에서 찍을 수 있는 단계 체크), 스킬북(마스터 레벨·효과, 출처 링크), 성장 로드맵 |
| **내 빌드** | 빌드 저장/불러오기/삭제, 현재 대비 DPS 비교, JSON 내보내기·가져오기, 공유 링크(`#b=MC3-…`) |
| `/maps/` | 사냥터 효율: 맵별 몬스터 × 스폰 수, 솔로 동시 최대 몹 수, 시간당 리젠 한도, 저장된 캐릭터 기준 시간당 처치·경험치·레벨업 시간 |
| `/log/` | 사냥 기록기: 타이머 + 사냥 전후 레벨·경험치 %·메소 → 실측 시간당 경험치·메소, 맵별 평균, 추정치 대비, CSV |
| `/mobs/` | 몬스터: 100% 명중 필요치·내 명중률·몸박 피격, 약점 속성·분류·레벨대 필터, 드랍 목록과 아이템 이름 역검색 |

8 languages, static HTML per language with `hreflang`, canonical, Open Graph, JSON-LD (WebApplication + FAQPage), sitemap with alternates.

## 공식 (Formulas)

Community reverse-engineered formulas published by NiaDB — reproduced exactly in tests:

- [Damage formula](https://meowdb.com/msclassic/guides/explaining-the-damage-formula): `MAX = S × TotalWATK × (1.0 + (P·W + Q)/100 + AP/50)`, mastery `m = (lv/10 + 0.1) × 0.7`
- [Elements](https://meowdb.com/msclassic/formulas/damage): single element — immune 0 · resistant 0.75 · neutral 1 · weak 1.25
- Hit chance, level-gap scaling, defense `raw × 100 / (DEF + 100)`
- [Spawn engine](https://meowdb.com/msclassic/guides/spawn-engine-respawn-and-map-capacity): respawn tick 7.56 s, capacity `floor(spawn points × 75%)` solo (+5%/extra player, 100% at six), timed spawns `3600 / (timer + 3.78 s)` per point per hour

**시간당 효율 (EXP/hour)**: 몬스터 종류별 처치 수 = min(리젠 한도, 내 처치 속도) — 처치 속도 = 1시간 × 실제 공격 비율(기본 60%) ÷ (처치당 예상 공격 횟수 × 공격 간격 ÷ 한 번에 맞히는 몹 수(다수기 기본 3)). 처치 속도가 모자라면 스폰 수 비율대로 잡고, 리젠이 먼저 막힌 몹 몫의 시간은 다른 몹에 씀. 시간당 경험치 = Σ 처치 수 × 몹 경험치, 레벨업 시간 = [경험치 표](https://meowdb.com/msclassic/guides/exp-table-level-1-to-100) ÷ 시간당 경험치.

**환산 주스탯 정의**: 기준 공격력(기본=현재)에서 부스탯·AP 0인 캐릭터가 같은 평균 데미지를 내는 데 필요한 주스탯. 기준을 고정하면 공격력 강화까지 반영.

## 데이터 (Data)

`data/skill-levels-*.json` — per-level skill tables and per-weapon/per-speed attack times (NiaDB skill pages and the attack speed guide).

`data/skills-*.json` — Classic skill lists per job (names, max level, key values at max) from NiaDB class pages, each skill linked to its source. Skill **order** in `src/guides.js` is this project's recommendation.

`data/maps.json` — 29 popular training maps: spawn points per monster, timed spawns, mob rate, each linked to its [NiaDB map page](https://meowdb.com/msclassic/maps). `data/exp.json` — EXP table (levels 1–99).

`data/images.json` — game images: monster sprites, map minimaps, skill icons and item icons (weapons, attack scrolls), mapped to GMS v83 in-game IDs by name from the v83 `String.wz` tables ([Cosmic](https://github.com/P0nk/Cosmic)). `scripts/fetch-images.mjs` downloads them once from the [maplestory.io](https://maplestory.io) asset API in CI (cached), and the site serves them itself; anything that fails to download is simply not shown. Game images © Nexon.

`data/drops.json` — drop lists for those monsters from each NiaDB monster page (NiaDB's pre-Big Bang reference list + OSMLib reference rates; the page notes Classic rates may differ).

`data/mobs.json` — 48 popular monsters (level, HP, EXP, avoidability, W.DEF, M.DEF, elements), each value taken from its individual [NiaDB](https://meowdb.com/msclassic/monsters) page and linked in the UI. This is a curated subset on purpose: NiaDB's [reuse policy](https://meowdb.com/reuse) allows individual facts with attribution but asks for permission before copying the database. To extend the list, email contact@meowdb.com (subject `Permission request: Maple Classic Calc`) or add values you measured yourself.

## 개발 (Development)

```bash
npm ci
npm test          # engine, advisor, guide, auto-fill, map-efficiency tests (NiaDB worked examples, SP budgets)
npm run build     # → dist/ (24 pages, 8 languages)
npm run serve     # preview dist/
```

```
src/engine.ts     damage / conversion engine (no deps, language-neutral)
src/advisor.ts    spec report: hunting spots, bosses, upgrades, goals, DPS, simulation, gear, scrolls
src/guides.js     skill point orders per job/weapon, roadmap, Korean skill names
src/auto.ts       auto-fill: skill levels from the guide, skill %/hits/element, mastery, buffs, attack time
src/maps.ts       map efficiency: respawn limits, kills & EXP per hour, time per level
src/app.js        browser UI
src/pages/*.html  page templates   src/i18n/*.json  strings (en is the fallback)
scripts/build.mjs static build, hreflang, JSON-LD, sitemap, robots
scripts/og.py     Open Graph images (dev only, PNGs committed in public/og)
```

Add a language: copy `src/i18n/en.json` to `src/i18n/<code>.json`, translate, add the locale to `LOCALES` in `scripts/build.mjs`, run `FONTS_DIR=… python3 scripts/og.py <code>`.

## 배포 (Deploy)

Push to `main` → GitHub Actions builds and deploys to Pages (Settings → Pages → Source: **GitHub Actions**).
Optional repository variables: `SITE_URL` (custom domain), `GOOGLE_SITE_VERIFICATION`, `NAVER_SITE_VERIFICATION`, `BING_SITE_VERIFICATION`.

검색 등록: Google Search Console / 네이버 서치어드바이저 / Bing Webmaster에서 사이트 소유 확인 → 위 변수에 값 입력 → `sitemap.xml` 제출.

---
Fan-made, not affiliated with Nexon. MapleStory is a trademark of Nexon. Code: MIT.
