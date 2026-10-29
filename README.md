# Maple Classic Calc · 메이플 클래식 환산

MapleStory Classic World (GMS) effective-main-stat calculator with a spec report.
메이플스토리 클래식 월드(GMS) 환산 주스탯 계산기 + 스펙 진단.

**Live:** https://sungbae-dev.github.io/maple-classic-calc/ · [한국어](https://sungbae-dev.github.io/maple-classic-calc/ko/) · English · Español · Português · Français · Deutsch · 日本語 · 简体中文

## 기능 (Features)

스탯창 값을 **한 번만** 입력하면 탭마다 진단이 이어져요. 입력값은 브라우저에 저장돼요.

| 탭 | 내용 |
|---|---|
| **진단** | 환산 주스탯 · 1타 기대 데미지 · 예상 DPS · 타깃 처치 횟수/시간, 업그레이드 시뮬레이션 차트(공격력·주스탯·명중 +n 시 DPS와 "몇 방" 변곡점), 타깃 체크(현재 → 교체 후, 편차), 다음 스펙업 순위 + 목표 |
| **사냥·보스** | 현재 레벨 추천 사냥터(명중률·처치 횟수·시간·공격당 경험치), ±15레벨 전체 표, 보스 준비도(필요 명중·처치 시간) + **보스 빌드 공유 링크** |
| **장비·주문서** | 장비 교체 비교표(공격력·스탯·공격 간격·평균 데미지·DPS·처치 횟수·시간), **100만 메소당 DPS 증가율**, 교체 세팅 적용, 주문서 100%/60%/10% 기대값·메소 효율 |
| **스킬** | 2차 전직·무기별 **SP 투자 순서**(현재 레벨에서 찍을 수 있는 단계 체크), 스킬북(마스터 레벨·효과, 출처 링크), 성장 로드맵 |
| **내 빌드** | 빌드 저장/불러오기/삭제, 현재 대비 DPS 비교, JSON 내보내기·가져오기, 공유 링크(`#b=MC3-…`) |
| `/mobs/` | 몬스터 명중표: 몹별 100% 명중 필요치, 내 레벨·명중 기준 명중률 |

8 languages, static HTML per language with `hreflang`, canonical, Open Graph, JSON-LD (WebApplication + FAQPage), sitemap with alternates.

## 공식 (Formulas)

Community reverse-engineered formulas published by NiaDB — reproduced exactly in tests:

- [Damage formula](https://meowdb.com/msclassic/guides/explaining-the-damage-formula): `MAX = S × TotalWATK × (1.0 + (P·W + Q)/100 + AP/50)`, mastery `m = (lv/10 + 0.1) × 0.7`
- [Elements](https://meowdb.com/msclassic/formulas/damage): single element — immune 0 · resistant 0.75 · neutral 1 · weak 1.25
- Hit chance, level-gap scaling, defense `raw × 100 / (DEF + 100)`

**환산 주스탯 정의**: 기준 공격력(기본=현재)에서 부스탯·AP 0인 캐릭터가 같은 평균 데미지를 내는 데 필요한 주스탯. 기준을 고정하면 공격력 강화까지 반영.

## 데이터 (Data)

`data/skills-*.json` — Classic skill lists per job (names, max level, key values at max) from NiaDB class pages, each skill linked to its source. Skill **order** in `src/guides.js` is this project's recommendation.

`data/mobs.json` — 40 popular monsters (level, HP, EXP, avoidability, W.DEF, M.DEF, elements), each value taken from its individual [NiaDB](https://meowdb.com/msclassic/monsters) page and linked in the UI. This is a curated subset on purpose: NiaDB's [reuse policy](https://meowdb.com/reuse) allows individual facts with attribution but asks for permission before copying the database. To extend the list, email contact@meowdb.com (subject `Permission request: Maple Classic Calc`) or add values you measured yourself.

## 개발 (Development)

```bash
npm ci
npm test          # engine, advisor, guide tests (NiaDB worked examples, SP budgets)
npm run build     # → dist/ (16 pages, 8 languages)
npm run serve     # preview dist/
```

```
src/engine.ts     damage / conversion engine (no deps, language-neutral)
src/advisor.ts    spec report: hunting spots, bosses, upgrades, goals, DPS, simulation, gear, scrolls
src/guides.js     skill point orders per job/weapon, roadmap, Korean skill names
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
