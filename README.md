# Maple Classic Calc · 메이플 클래식 환산

MapleStory Classic World (GMS) effective-main-stat calculator with a spec report.
메이플스토리 클래식 월드(GMS) 환산 주스탯 계산기 + 스펙 진단.

**Live:** https://sungbae-dev.github.io/maple-classic-calc/ · [한국어](https://sungbae-dev.github.io/maple-classic-calc/ko/) · English · Español · Português · Français · Deutsch · 日本語 · 简体中文

## 기능 (Features)

스탯창 값을 한 번 입력하면:

| | |
|---|---|
| **환산 주스탯 · 스공** | 부스탯·AP를 주스탯으로 합친 실질 주스탯, 평타 평균, 스탯창 범위(입력 검증용) |
| **스킬 기대 데미지** | 스킬 %, 타수, 크리, 몹 방어(물방/마방), 속성 약점, 레벨 차, 명중 판정 반영 |
| **지금 갈 수 있는 사냥터** | 몬스터 40종에 내 빌드를 대입 → 명중률·처치 횟수·공격당 경험치 순 추천 |
| **보스** | 머쉬맘·주니어 발록 명중 가능 여부, 필요 명중, 예상 공격 횟수 |
| **다음 스펙업 추천** | 레벨업(AP 5), 공격력 +1/+5, 숙련 스킬, 명중 보강 효과 순위 + "다음 몹 한 방 줄이려면 공격력 +n" 목표 |
| **스탯 환산표 · 템 비교** | 공 1 = 주스탯 x, 템 교체 시 기대 데미지 % / 주스탯 상당치 |
| **몬스터 명중표** | 몬스터별 100% 명중 필요치, 내 레벨·명중 기준 명중률 (`/mobs/`) |
| **빌드 코드** | `MC2-…` 코드로 빌드 공유/불러오기 |

8 languages, static HTML per language with `hreflang`, canonical, Open Graph, JSON-LD (WebApplication + FAQPage), sitemap with alternates.

## 공식 (Formulas)

Community reverse-engineered formulas published by NiaDB — reproduced exactly in tests:

- [Damage formula](https://meowdb.com/msclassic/guides/explaining-the-damage-formula): `MAX = S × TotalWATK × (1.0 + (P·W + Q)/100 + AP/50)`, mastery `m = (lv/10 + 0.1) × 0.7`
- [Elements](https://meowdb.com/msclassic/formulas/damage): single element — immune 0 · resistant 0.75 · neutral 1 · weak 1.25
- Hit chance, level-gap scaling, defense `raw × 100 / (DEF + 100)`

**환산 주스탯 정의**: 기준 공격력(기본=현재)에서 부스탯·AP 0인 캐릭터가 같은 평균 데미지를 내는 데 필요한 주스탯. 기준을 고정하면 공격력 강화까지 반영.

## 데이터 (Data)

`data/mobs.json` — 40 popular monsters (level, HP, EXP, avoidability, W.DEF, M.DEF, elements), each value taken from its individual [NiaDB](https://meowdb.com/msclassic/monsters) page and linked in the UI. This is a curated subset on purpose: NiaDB's [reuse policy](https://meowdb.com/reuse) allows individual facts with attribution but asks for permission before copying the database. To extend the list, email contact@meowdb.com (subject `Permission request: Maple Classic Calc`) or add values you measured yourself.

## 개발 (Development)

```bash
npm ci
npm test          # engine + advisor tests (NiaDB worked examples)
npm run build     # → dist/ (16 pages, 8 languages)
npm run serve     # preview dist/
```

```
src/engine.ts     damage / conversion engine (no deps, language-neutral)
src/advisor.ts    spec report: hunting spots, bosses, upgrades, goals
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
