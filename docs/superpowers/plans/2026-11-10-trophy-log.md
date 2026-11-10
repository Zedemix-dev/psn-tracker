# PSN Tracker : page Trophy Log, Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** remplacer « Coming soon » de l'onglet Trophy Log par la liste de tous les trophées obtenus : une ligne par trophée avec son numéro d'obtention, tri, sens, filtres, Reset et défilement 50 par 50. Corriger au passage la page d'un jeu, l'heure des trophées et les fonds d'icônes (spec 16.7).

**Architecture :**
- **Une seule règle d'ordre d'obtention** (`src/lib/earned-order.ts`). Elle sert aux milestones et au tri « Date earned » de la page d'un jeu. Traduite en SQL, elle donne le numéro du Trophy Log, et un test vérifie que les deux versions donnent le même ordre.
- **La liste est interrogée en SQL** : numéro par `row_number()` sur tous les trophées obtenus, puis filtres, tri et pagination.
- **Affichage** : le serveur rend les 50 premières lignes, une API fournit la suite, comme pour la liste Games. Les réglages vivent dans l'adresse.

**Tech Stack :** Next.js 16 (App Router, RSC), React 19, TypeScript strict, Drizzle (PostgreSQL, PGlite en test), Vitest + @testing-library/react + jsdom.

**Spec :** [section 16](../specs/2026-11-07-psn-tracker-design.md), et les lignes de 8.9 qui y renvoient. **Maquette validée** (référence du CSS) : [2026-11-10-psn-tracker-maquette-trophylog.html](../specs/2026-11-10-psn-tracker-maquette-trophylog.html). Là où elle diffère de la spec (égalités en sens inverse, compte de Reset, numéro masqué entre 640 et 900 px), **la spec fait foi**.

## Global Constraints

- **Git** : branche `feat/trophy-log`. **Après chaque commit, push.** Messages de commit en anglais, terminés par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Langues et dépendances** : interface du site et code en anglais. Aucune nouvelle dépendance.
- **Next.js 16** : lire `AGENTS.md` et les guides de `node_modules/next/dist/docs/` avant d'écrire du code Next.
- **Windows** : en Git Bash, `export PATH="/c/Program Files/nodejs:$PATH"`. Le chemin du dépôt contient `!` : le mettre entre apostrophes.
- **Tests** : `npx vitest run <fichier>`, puis `npx vitest run && npx tsc --noEmit` avant chaque commit. ESLint n'est pas configuré.
- **`app/globals.css` est un seul fichier global** :
  - toute nouvelle classe est préfixée `log-` ou rangée sous `.log-panel` / `.log-row` ;
  - avant d'ajouter un nom, vérifier par une recherche qu'il ne touche rien d'existant (incidents `.plat` et `.pct` du Plat Wall) ;
  - `.glass` a un `backdrop-filter` qui piège `position:fixed`, et `.panel` a `overflow:hidden` : tout ce qui flotte passe par `createPortal` vers `document.body`.
- **Textes exacts** :
  - en-tête : `Zmx969's Trophy Log` (avec le pseudo du profil), `11,636 trophies`, `1 trophy`, `1,234 of 11,636 trophies match` ;
  - listes vides : `No trophies match these filters.`, `No trophies earned yet.` ;
  - chargement : `Show all`, `Loading…`, `The next 50 trophies load as you scroll down`, `Couldn't load more trophies.`, `Retry` ;
  - tri et sens : `Date earned`, `Alphabetical`, `Rarity`, `Newest first`, `Oldest first`, `A to Z`, `Z to A`, `Rarest first`, `Most common first` ;
  - filtres : `All platforms`, `PS4`, `PS5`, `All rarities`, `Ultra rare`, `Very rare`, `Rare`, `Uncommon`, `Common`, `All types`, `Platinum`, `Gold`, `Silver`, `Bronze` ;
  - autres : `Reset (N)`, `No longer obtainable.`, `You already have it.`
- **Ordre d'obtention (16.4)** :
  - critères, dans l'ordre : la seconde d'obtention, puis le platine en dernier, puis `trophyId`, puis l'identifiant de la liste, en ordre des codes (`collate "C"` en SQL) ;
  - le numéro est le rang dans cet ordre, parmi les trophées obtenus et datés des jeux non masqués ;
  - les filtres et le tri ne le changent jamais.
- **Heures** : heure de Paris, 24 h, avec les secondes (`15:46:30`). Dates au format du site (`9 Nov 2026`).
- **Images** :
  - aucun fond derrière une icône de trophée ;
  - aucune image rectangulaire : l'image du jeu est celle de sa ligne dans Games (`withSiblings`, puis `TileImage` quand c'est l'icône de la liste).

## Review Focus

Chaque ligne a son test dans la tâche indiquée.

1. **Une adresse modifiée à la main** (`?sort=foo&order=up&rarity=epic&type=x&offset=-3&limit=0`) : la page et l'API reviennent aux valeurs par défaut sans planter (tâches 3 et 4).
2. **Des pages successives de 50** donnent la liste complète, sans doublon ni trou, quel que soit le tri. Cela vaut aussi pour des trophées de même nom ou de même rareté (tâche 4).
3. **Deux trophées de jeux différents à la même seconde**, avec des millisecondes différentes : même numéro dans le Trophy Log et dans les milestones (tâche 4, test d'équivalence SQL / JS).
4. **Le retour après « Show all »** (11 636 lignes) :
   - le navigateur ne garde aucune ligne, et la liste recharge le même nombre de lignes ;
   - si ce rechargement échoue, la première page reste, sans planter ;
   - un retour pris avec d'autres filtres ou avant une synchro est ignoré (tâche 6).
5. **Un profil sans aucun trophée obtenu** (avant la première synchro) : « No trophies earned yet. », sans « Show all » (tâches 5 et 6).

## Fichiers

| Fichier | Rôle |
|---|---|
| `src/lib/earned-order.ts` | Pur : l'ordre d'obtention partagé (16.4) |
| `src/trophy-log/query.ts` | Pur, utilisable côté client : réglages, adresse, libellés, pagination, texte du nombre |
| `src/trophy-log/load.ts` | La requête SQL et la fabrication des lignes |
| `app/api/trophy-log/route.ts` | Les pages suivantes et « Show all » |
| `app/(site)/(banner)/trophy-log/page.tsx` | La page |
| `components/trophy-log/TrophyLogRow.tsx` | Une ligne |
| `components/trophy-log/TrophyLogControls.tsx` | Client : tri, sens, filtres, Reset |
| `components/trophy-log/TrophyLogList.tsx` | Client : défilement, Show all, Retry, retour |
| `components/trophy-log/log-snapshot.ts` | La place gardée pour le retour |
| `app/icon-backgrounds.test.ts` | Garde-fou : aucun fond derrière une icône de trophée |

Modifiés : `src/stats/milestones.ts`, `src/games/trophy-view.ts`, `src/lib/format.ts`, `src/lib/rarity.ts`, `app/(site)/(banner)/page.tsx`, `components/MilestonesPanel.tsx`, `app/(site)/(banner)/[section]/page.tsx`, `app/globals.css`, `components/TrophyCarousel.module.css`, `tests/fixtures/profile.ts`, et les tests qui fixent l'heure sans secondes.

---

### Task 1 : ordre d'obtention partagé et heures avec secondes

**Files :**
- Create : `src/lib/earned-order.ts`, `src/lib/earned-order.test.ts`.
- Modify :
  - `src/stats/milestones.ts` : supprimer `compareCounting` et utiliser la règle partagée ;
  - `src/games/trophy-view.ts` et `src/games/trophy-view.test.ts` ;
  - `src/lib/format.ts` et `src/lib/format.test.ts` ;
  - `src/games/detail-stats.test.ts` et `components/game/TrophyList.test.tsx` : heures attendues avec les secondes ;
  - `app/(site)/(banner)/page.tsx` : le `when` du carrousel ;
  - `components/MilestonesPanel.tsx` : l'infobulle de la date.

**Interfaces — Produces :**
```ts
// src/lib/earned-order.ts — pure, safe in client code (type-only import of TrophyType)
export type EarnedOrderKey = { earnedAtMs: number; type: TrophyType; trophyId: number; titleId?: string };
/** Spec 16.4: second earned, then the platinum last, then trophyId, then titleId (code-unit order, "" when absent). */
export function compareEarnedOrder(a: EarnedOrderKey, b: EarnedOrderKey): number;
// src/lib/format.ts
export function formatTime(d: Date): string;            // now with seconds: "01:21:07"
export function formatDateTimeSeconds(d: Date): string; // "5 Nov 2026, 00:16:37"
```

- [ ] **Step 1 : écrire les tests qui échouent**

```ts
// earned-order.test.ts — at(s, ms) = Date.UTC(2026, 10, 4, 23, 16, s, ms)
it("orders by the second first", () => /* platinum at :36.900 before bronze at :37.000 */);
it("puts the platinum after the other trophies of its second", () => /* platinum id 0 at :37.100, gold id 5 at :37.900: gold first */);
it("breaks a tie by trophyId, then titleId", () => /* same second, ids 3 vs 4; then same id, "NPWR2" vs "NPWR10" in code-unit order */);
it("treats a missing titleId as empty", …);
// trophy-view.test.ts
it("sorts by date with the platinum after the last trophy of its second", () =>
  /* plat id 0 and gold id 5 at T, bronze id 3 at T - 60 s, unearned id 1: ids [3, 5, 0, 1] */);
// format.test.ts
expect(formatTime(new Date("2022-07-17T23:21:07Z"))).toBe("01:21:07");
expect(formatDateTimeSeconds(new Date("2026-11-04T23:16:37Z"))).toBe("5 Nov 2026, 00:16:37");
expect(formatDateTime(new Date("2026-11-04T23:16:37Z"))).toBe("5 Nov 2026, 00:16"); // unchanged: last sync, sync history
```

- [ ] **Step 2 : lancer les tests, ils échouent** : `npx vitest run src/lib src/games src/stats` donne FAIL (module introuvable, heures sans secondes).
- [ ] **Step 3 : implémenter.**
  - Ajouter `second: "2-digit"` à `parisParts` dans `format.ts`.
  - Milestones : comparer avec `compareEarnedOrder` sur `{ earnedAtMs: earnedAt.getTime(), type, trophyId, titleId }`. Leurs tests actuels doivent passer sans changement.
  - Page d'un jeu : le tri `date` de `filterAndSort` compare les obtenus avec `compareEarnedOrder`, puis place les non obtenus en ordre PSN, comme aujourd'hui.
  - Carrousel et infobulle des milestones : `formatDateTimeSeconds`. La Timeline suit d'elle-même par `formatTime`.
- [ ] **Step 4 : relancer** : `npx vitest run && npx tsc --noEmit` donne PASS.
- [ ] **Step 5 : commit et push** : `fix: platinum after the last trophy of its second, trophy times with seconds`.

---

### Task 2 : aucun fond derrière une icône de trophée

**Files :**
- Create : `app/icon-backgrounds.test.ts`.
- Modify :
  - `app/globals.css` : retirer `background:var(--surface-2)` des règles `.tlist img`, `.ce-list img:first-child` et `.game-page .trophy img.ic` ;
  - `components/TrophyCarousel.module.css` : même retrait sur `.item img`.

**Interfaces — Produces :** `ICON_RULES`, la liste exportée par le test, que la tâche 5 complète avec `.log-row .ic`.

- [ ] **Step 1 : écrire le test qui échoue.** Lire les deux fichiers CSS en texte et trouver les règles avec `/([^{}]+)\{([^{}]*)\}/g` (les règles internes des `@media` sont prises aussi).

```ts
export const ICON_RULES: [file: string, selector: string][] = [
  ["app/globals.css", ".tlist img"],
  ["app/globals.css", ".ce-list img:first-child"],
  ["app/globals.css", ".game-page .trophy img.ic"],
  ["components/TrophyCarousel.module.css", ".item img"],
];
it.each(ICON_RULES)("%s: no background behind %s", (file, selector) =>
  /* every rule whose comma-separated selector list contains exactly `selector` (media queries included)
     has no `background` declaration; at least one such rule exists */);
```
- [ ] **Step 2 : lancer, FAIL sur les 4 règles, puis retirer les fonds.**
  - Ne toucher à rien d'autre : la carte vitrée du carrousel, le fond vert ou rouge des lignes et le liseré autour de l'icône restent (16.7).
  - La tuile `#0B1022` des images de jeu reste aussi.
- [ ] **Step 3 : relancer** : PASS, puis `npx vitest run && npx tsc --noEmit`.
- [ ] **Step 4 : commit et push** : `fix: no background behind trophy icons`.

---

### Task 3 : les réglages du Trophy Log

**Files :**
- Create : `src/trophy-log/query.ts`, `src/trophy-log/query.test.ts`.
- Modify : `src/lib/rarity.ts`, `src/lib/rarity.test.ts`.

**Interfaces — Produces :**
```ts
// src/lib/rarity.ts — rarityTier() is rewritten on these bounds
/** [min, max) of each tier in percent; max null for Common. */
export const RARITY_RANGES: Record<RarityTier, [min: number, max: number | null]>;
// src/trophy-log/query.ts — no database import
export const LOG_SORTS = ["date", "alphabetical", "rarity"] as const;
export const LOG_ORDERS = ["desc", "asc"] as const;
export const LOG_PLATFORMS = ["all", "PS4", "PS5"] as const;
export const LOG_RARITIES = ["all", "ultra-rare", "very-rare", "rare", "uncommon", "common"] as const;
export const LOG_TYPES = ["all", "platinum", "gold", "silver", "bronze"] as const;
export type LogSort = (typeof LOG_SORTS)[number]; // and LogOrder, LogPlatform, LogRarity, LogType likewise
export type LogQuery = { sort: LogSort; order: LogOrder; platform: LogPlatform; rarity: LogRarity; type: LogType };
export const DEFAULT_LOG_QUERY: LogQuery;            // date, desc, all, all, all
export const LOG_PAGE_SIZE = 50;
export const LOG_MAX = 100_000;                      // "Show all" cap
export const LOG_SHOW_ALL_SLOT_ID = "trophy-log-show-all";
export function naturalOrder(sort: LogSort): LogOrder;              // date desc, alphabetical asc, rarity asc
export function orderLabel(sort: LogSort, order: LogOrder): string; // "Newest first", "Z to A", "Most common first"…
export function tierOf(rarity: Exclude<LogRarity, "all">): RarityTier; // "ultra-rare" -> "Ultra rare"
export function parseLogQuery(params: URLSearchParams): LogQuery;    // lenient; missing or bad order -> naturalOrder(sort)
export function logQueryParams(query: LogQuery): URLSearchParams;    // defaults left out, order left out when natural
export function withSort(query: LogQuery, sort: LogSort): LogQuery;  // order reset to naturalOrder(sort)
export function activeControls(query: LogQuery): number;             // sort ≠ date, order ≠ natural, each filter ≠ all
export function isFiltered(query: LogQuery): boolean;                // platform, rarity or type ≠ all
export function parsePaging(params: URLSearchParams): { offset: number; limit: number };
export function shownText(overall: number, matching: number, filtered: boolean): string;
```

- [ ] **Step 1 : écrire les tests qui échouent**

```ts
it("uses the defaults", () => expect(parseLogQuery(new URLSearchParams())).toEqual(DEFAULT_LOG_QUERY));
it("falls back on garbage", () =>
  expect(parseLogQuery(new URLSearchParams("sort=foo&order=up&platform=PS3&rarity=epic&type=x"))).toEqual(DEFAULT_LOG_QUERY));
it("takes the natural order of the sort", () =>
  expect(parseLogQuery(new URLSearchParams("sort=alphabetical")).order).toBe("asc"));
it("leaves the defaults and the natural order out", () => {
  expect(logQueryParams(DEFAULT_LOG_QUERY).toString()).toBe("");
  expect(logQueryParams({ ...DEFAULT_LOG_QUERY, sort: "rarity", order: "asc" }).toString()).toBe("sort=rarity");
  expect(logQueryParams({ ...DEFAULT_LOG_QUERY, sort: "rarity", order: "desc", type: "gold" }).toString())
    .toBe("sort=rarity&order=desc&type=gold");
});
it("round-trips every combination", () => /* parseLogQuery(logQueryParams(q)) equals q */);
it("labels the six orders", () => /* "Newest first", "Oldest first", "A to Z", "Z to A", "Rarest first", "Most common first" */);
it("resets the order when the sort changes", () => {
  expect(withSort({ ...DEFAULT_LOG_QUERY, sort: "alphabetical", order: "desc" }, "date").order).toBe("desc");
  expect(withSort({ ...DEFAULT_LOG_QUERY, order: "asc" }, "rarity").order).toBe("asc");
});
it("counts the changed controls", () => {
  expect(activeControls(DEFAULT_LOG_QUERY)).toBe(0);
  expect(activeControls(withSort(DEFAULT_LOG_QUERY, "alphabetical"))).toBe(1);
  expect(activeControls({ ...withSort(DEFAULT_LOG_QUERY, "alphabetical"), order: "desc", platform: "PS5" })).toBe(3);
  expect(activeControls({ ...DEFAULT_LOG_QUERY, order: "asc" })).toBe(1);
});
it("reads the paging", () => {
  expect(parsePaging(new URLSearchParams("offset=-3&limit=0"))).toEqual({ offset: 0, limit: 50 });
  expect(parsePaging(new URLSearchParams("offset=50&limit=120"))).toEqual({ offset: 50, limit: 120 });
  expect(parsePaging(new URLSearchParams("limit=999999"))).toEqual({ offset: 0, limit: 50 });
  expect(parsePaging(new URLSearchParams("offset=50&all=1"))).toEqual({ offset: 50, limit: LOG_MAX });
});
it("words the count", () => {
  expect(shownText(11636, 11636, false)).toBe("11,636 trophies");
  expect(shownText(1, 1, false)).toBe("1 trophy");
  expect(shownText(11636, 1234, true)).toBe("1,234 of 11,636 trophies match");
});
// rarity.test.ts
it("agrees with rarityTier at every bound", () => /* rarityTier(min) is the tier; rarityTier(max - 0.01) too when max is set */);
```
- [ ] **Step 2 : lancer, FAIL, puis implémenter** sur le modèle de `src/plat-wall/query.ts` (`pick`).
- [ ] **Step 3 : relancer** : `npx vitest run src/trophy-log src/lib && npx tsc --noEmit` donne PASS.
- [ ] **Step 4 : commit et push** : `feat: Trophy Log settings in the URL`.

---

### Task 4 : la requête et l'API

**Files :**
- Create : `src/trophy-log/load.ts`, `src/trophy-log/load.test.ts`, `app/api/trophy-log/route.ts`, `app/api/trophy-log/route.test.ts`.
- Modify : `tests/fixtures/profile.ts`. `TrophySeed` reçoit `groupId?: string` (défaut `"default"`) et `unobtainable?: boolean`. Ajouter `insertGroup(db, { titleId, groupId, name })`.

**Interfaces :**
- Consumes : tâche 1 (`compareEarnedOrder`, `formatTime`) et tâche 3.
- Produces :
```ts
// src/trophy-log/load.ts
/** JSON-safe: what one row of the log shows. */
export type LogRow = {
  key: string;               // `${titleId}:${trophyId}`
  n: number;                 // earned number (16.4)
  name: string;
  detail: string;
  iconSrc: string;
  type: TrophyType;
  gameId: string;
  gameName: string;
  gameSrc: string;           // the image of the game's row in Games
  gameIsIcon: boolean;       // true: the trophy-list icon, shown whole on its tile
  dlc: string | null;        // group name, only when groupId ≠ "default"
  platforms: ("PS4" | "PS5")[];
  date: string;              // "9 Nov 2026"
  time: string;              // "15:46:30"
  ratePct: string | null;    // "4.60%"
  tier: RarityTier | null;
  unobtainable: boolean;
};
export type LogPage = { items: LogRow[]; total: number }; // total: rows matching the filters
export async function queryTrophyLog(db: Db, query: LogQuery, paging: { offset: number; limit: number }): Promise<LogPage>;
export async function countLoggedTrophies(db: Db): Promise<number>; // earned, dated, visible titles
// app/api/trophy-log/route.ts
export async function GET(req: Request): Promise<Response>; // 401 without a session; otherwise the LogPage as JSON
```

**La règle SQL**, seul algorithme que le plan fixe, en Drizzle (`$with` et fragments `sql`, comme `src/stats/trophies.ts`) :
```sql
-- numbered: every earned, dated trophy of a visible title (earned and earned_at not null and not titles.hidden)
row_number() over (order by date_trunc('second', t.earned_at), (t.type = 'platinum'), t.trophy_id, t.title_id collate "C") as n
-- filters apply to the numbered set; then:
--   date:         n desc | n asc
--   alphabetical: lower(t.name) collate "C" asc | desc, then n desc
--   rarity:       t.earned_rate asc | desc nulls last, then n desc
-- then limit / offset
```
- **Filtres** :
  - plateforme : `'PS4' = any(titles.platforms)` ;
  - rareté : `earned_rate >= min and earned_rate < max` avec `RARITY_RANGES` ; les raretés inconnues sont exclues dès que le filtre n'est pas All ;
  - type : `t.type = …`.
- **Image du jeu** :
  - `loadSiblingIndex(db)`, puis `withSiblings`, puis `mediaSrc(info.coverUrl ?? info.coverFallbackUrl, imageMap)`, exactement comme `toGameRow` ;
  - un calcul par jeu et par requête, pas par ligne ;
  - le nom du DLC vient d'une jointure à gauche sur `trophy_groups` (`title_id`, `group_id`).

- [ ] **Step 1 : écrire les tests qui échouent** (PGlite : `createTestDb`, `insertTitle`, `insertTrophies`, `insertGroup`).

```ts
const ALL = { offset: 0, limit: LOG_MAX };
it("numbers every earned trophy like the milestones", () =>
  /* ties: two games at the same second with different ms, a platinum and a gold at the same second;
     n of each row = 1 + its index in [...seeds].sort(compareEarnedOrder) */);
it("puts the platinum above the last trophy of its game", () =>
  /* gold id 5 and platinum id 0 at 00:16:37: newest first gives the platinum first, n one higher */);
it("keeps the number whatever the filters and the sort", …);
it("leaves out unearned trophies and hidden games", …);
it("filters by platform, rarity tier and type", () =>
  /* platforms ["PS3","PS4"] kept by PS4; 4.99 ultra-rare, 5.00 very-rare, 50.00 common; a null rate only under all */);
it("sorts by name ignoring case, newest first on a tie, in both orders", …);
it("sorts by rarity with unknown rates last in both orders, newest first on a tie", …);
it("pages without gaps or duplicates", () =>
  /* 7 rows with two equal names and two equal rates; for each sort and order, pages of 3 concatenated == one ALL request */);
it("counts the matching rows and all logged trophies", …);
it("fills a row", () =>
  /* dlc "Phantom Liberty" for group "001", null for "default"; time "00:16:37"; ratePct "4.60%", tier "Ultra rare";
     unobtainable true; platforms ["PS4","PS5"]; gameSrc and gameIsIcon equal to toGameRow's for that title */);
// route.test.ts — mocks as in app/api/plat-wall/export/route.test.ts
it("answers 401 without a session", …);
it("reads garbage as the defaults", () =>
  /* "?sort=foo&offset=-3" -> queryTrophyLog(db, DEFAULT_LOG_QUERY, { offset: 0, limit: 50 }) */);
it("loads the rest with all=1", () => /* limit LOG_MAX */);
```
- [ ] **Step 2 : lancer, FAIL, puis implémenter.**
- [ ] **Step 3 : relancer** : `npx vitest run src/trophy-log app/api/trophy-log && npx tsc --noEmit` donne PASS.
- [ ] **Step 4 : mesurer** sur la base e2e (`npm run e2e:db` tourne déjà ; PGlite est plus lent que Postgres) :
  - une page de 50 doit répondre en moins de 300 ms ;
  - une requête `limit=LOG_MAX` en moins de 2 s.
  Noter les deux temps dans le rapport de la tâche. Au-delà, revoir la requête avant de continuer.
- [ ] **Step 5 : commit et push** : `feat: query the Trophy Log`.

---

### Task 5 : la page, la ligne et les contrôles

**Files :**
- Create : `app/(site)/(banner)/trophy-log/page.tsx`, `components/trophy-log/TrophyLogRow.tsx`, `components/trophy-log/TrophyLogRow.test.tsx`, `components/trophy-log/TrophyLogControls.tsx`, `components/trophy-log/TrophyLogControls.test.tsx`.
- Modify :
  - `app/(site)/(banner)/[section]/page.tsx` : retirer `trophy-log` de `SECTIONS` ;
  - `app/globals.css` ;
  - `app/icon-backgrounds.test.ts` : ajouter `["app/globals.css", ".log-row .ic"]`.

**Interfaces :**
- Consumes : tâches 3 et 4.
- Produces :
```ts
export function TrophyLogRow(props: { row: LogRow }): JSX.Element;          // no hooks; used by the client list
export function TrophyLogControls(props: { query: LogQuery }): JSX.Element;  // "use client"
```

**La page** suit `plat-wall/page.tsx` :
- les mêmes chargements, plus `queryTrophyLog(db, query, { offset: 0, limit: LOG_PAGE_SIZE })` et `countLoggedTrophies(db)` ;
- puis, dans l'ordre : `ProfileBand`, `StatTiles`, et `<section className="panel glass log-panel" aria-label="Trophy Log">`.
- **Le panneau** :
  - en-tête `.log-head` : à gauche le `h2` (`${onlineId ?? "PSN profile"}'s Trophy Log`) ; à droite `<span id={LOG_SHOW_ALL_SLOT_ID} />`, puis `shownText(overall, total, isFiltered(query))` ;
  - puis `TrophyLogControls`, puis les lignes de la première page (la tâche 6 les remplace par la liste).
- **Liste vide** :
  - `No trophies earned yet.` si `overall` vaut 0 ;
  - sinon `No trophies match these filters.` ;
  - balise `<p className="empty">`, comme sur Games.

**La ligne**, conforme à la maquette v2 (une `div.log-row`, pas un lien) :
- `a.gl` vers `/games/<id>`, qui contient `TileImage` (`tile={gameIsIcon}`, classe `gc`, plus `icon` si `gameIsIcon`, `alt` = nom du jeu) ;
- `img.ic` : l'icône du trophée ;
- le bloc texte :
  - `.n` : le nom, puis `UnobtainableMark` (`focusable`, `label="No longer obtainable."`, `detail="You already have it."`) si le trophée est non obtenable ;
  - `.d` : la description ;
  - `.g` : un lien `/games/<id>` sur le nom du jeu, puis `span.dlc` « · nom du DLC », puis une pastille `.platform` par plateforme ;
- `.meta`, qui contient `.num` (`#` + `formatInt(n)`), `.when` (la date, puis l'heure dans un `small`) et `.rate` (`b` pour le pourcentage, puis la catégorie) ;
- `TrophyTypeIcon` (taille 30, classe `ti`).

**Les contrôles** :
- `router.replace(qs ? "/trophy-log?" + qs : "/trophy-log", { scroll: false })` ;
- un select de tri (`aria-label="Sort by"`), qui passe par `withSort` ;
- le bouton de sens `button.select.log-dir` : icône de flèches de la maquette, plus `orderLabel`, `title="Reverse the order"` ;
- les selects de plateforme, de rareté et de type (`aria-label` : `Filter by platform`, `Filter by rarity`, `Filter by type`) ;
- la classe `on` sur tout contrôle qui diffère de sa valeur par défaut, et sur le bouton de sens si `order ≠ naturalOrder(sort)` ;
- `button.log-reset`, présent seulement si `activeControls > 0`, avec le texte `Reset (N)` et la croix de la maquette. Il ramène à `/trophy-log`.

**CSS**, copié de la maquette v2 avec ces écarts :
- noms : `.log-panel`, `.log-head`, `.log-tools`, `.log-dir`, `.log-reset`, et tout le reste sous `.log-row` ;
- aucun `background` sur `.log-row .ic` ni `.log-row .gc`, sauf `.log-row .gc.icon{object-fit:contain;background:#0B1022}`, la tuile de Games ;
- `.log-row{content-visibility:auto;contain-intrinsic-size:auto 66px}`, pour rester fluide après « Show all » ;
- sous 900 px, le numéro reste : `grid-template-columns:48px minmax(0,1fr) 70px 104px 84px 26px` ;
- en dessous de 640 px : comme la maquette, numéro, date et rareté sur une ligne sous la description.

- [ ] **Step 1 : écrire les tests qui échouent** (`// @vitest-environment jsdom`, `next/navigation` simulé comme dans `components/plat-wall/PlatWallControls.test.tsx`)

```ts
// TrophyLogRow
it("shows the trophy, its number, date, time and rarity", () => /* "#11,636", "9 Nov 2026", "15:46:30", "4.60%", "Ultra rare" */);
it("links the game image and the game name, not the row", () => /* two links to "/games/NPWR1_00"; the row root is a div */);
it("shows the DLC only for a DLC trophy", …);
it("marks an unobtainable trophy", () => /* role img named "No longer obtainable. You already have it." */);
it("shows no rarity when it is unknown", …);
it("puts the list icon on its tile", () => /* gameIsIcon: img.gc has class "icon" */);
// TrophyLogControls
it("changes the sort and resets the order", () => /* from {date, asc} choose Alphabetical: replace("/trophy-log?sort=alphabetical") */);
it("reverses the order", () => /* defaults: button "Newest first", click: replace("/trophy-log?order=asc") */);
it("filters by rarity", () => /* Ultra rare: replace("/trophy-log?rarity=ultra-rare") */);
it("outlines what differs from the default", () => /* PS5 and Z to A: those two have class "on", the others not */);
it("shows Reset with its count and goes back to the defaults", () => /* {alphabetical, desc, PS5}: "Reset (3)", click: replace("/trophy-log") */);
it("has no Reset with the defaults", …);
```
- [ ] **Step 2 : lancer, FAIL, puis implémenter.** Avant d'écrire le CSS, chercher dans `app/globals.css` chaque nouveau nom de classe : aucun ne doit déjà exister.
- [ ] **Step 3 : relancer** : `npx vitest run && npx tsc --noEmit` donne PASS.
- [ ] **Step 4 : coup d'œil.** `npm run e2e:web` (configuration « e2e-web »), page `/trophy-log` : elle s'affiche comme la maquette, et `/trophy-advisor` montre toujours « Coming soon ».
- [ ] **Step 5 : commit et push** : `feat: Trophy Log page with its controls`.

---

### Task 6 : défilement, Show all et retour au même endroit

**Files :**
- Create : `components/trophy-log/TrophyLogList.tsx`, `components/trophy-log/TrophyLogList.test.tsx`, `components/trophy-log/log-snapshot.ts`, `components/trophy-log/log-snapshot.test.ts`.
- Modify : la page, qui affiche désormais la liste.

**Interfaces :**
- Consumes : tâches 3 à 5.
- Produces :
```ts
// components/trophy-log/log-snapshot.ts — same history-entry tag rule as components/list-snapshot.ts,
// own storage key "trophy-log-list" and state tag "trophyLogSnapshot"
export type LogSnapshot = { key: string; loaded: number; scrollY: number }; // no rows: 11,636 would not fit
export function saveLogSnapshot(s: LogSnapshot): void;
export function takeLogSnapshot(key: string): LogSnapshot | null;
// components/trophy-log/TrophyLogList.tsx ("use client")
export function TrophyLogList(props: { initial: LogPage; query: LogQuery; snapshotKey: string; empty: string }): JSX.Element;
```

**Comportement** : celui de `components/GameList.tsx`, adapté ainsi.
- **Pages suivantes** : `fetch("/api/trophy-log?" + params)`, avec `params = logQueryParams(query)`, plus `offset` et, pour « Show all », `all=1`. Les doublons sont écartés par `key`.
- **Bas de liste** :
  - même sentinelle et même `rootMargin` que Games ;
  - « Show all » passe par un portail dans `LOG_SHOW_ALL_SLOT_ID` ;
  - textes `The next 50 trophies load as you scroll down`, `Couldn't load more trophies.` et `Retry`.
- **Retour en arrière** :
  - un clic capturé sur un `a[href^="/games/"]` de la liste enregistre `{ key, loaded: items.length, scrollY }` ;
  - au montage, si un retour est valable : `fetch` avec `offset=0&limit=<loaded>`, puis les lignes reçues remplacent la première page, puis on défile jusqu'à `scrollY` (même `useLayoutEffect` que Games) ;
  - en cas d'échec, la première page reste, sans défilement.
- **La page** :
  - `snapshotKey = logQueryParams(query) + "|" + sync.lastSuccessAt` ;
  - `<TrophyLogList key={snapshotKey} … />` : après une synchro, la liste repart de la première page.

- [ ] **Step 1 : écrire les tests qui échouent** (`fetch` simulé, `IntersectionObserver` remplacé comme dans `components/GameList.test.tsx`)

```ts
// log-snapshot
it("restores on the history entry it was taken on", …);
it("ignores another key or an untagged entry", …);
it("does not throw when storage fails", …);
// TrophyLogList
it("loads the next 50 when the bottom shows", () => /* fetch "/api/trophy-log?sort=rarity&offset=50" */);
it("loads the rest with Show all", () => /* "…&offset=50&all=1"; Show all then disappears */);
it("offers Retry after a failure", …);
it("never shows a row twice", …);
it("saves the place, without rows, when a game link is clicked", () => /* sessionStorage holds loaded and scrollY, no items */);
it("puts the rows and the scroll back after Back", () => /* tagged entry: fetch "offset=0&limit=120", then scrollTo(0, 3400) */);
it("ignores a place saved for other filters or before a sync", …);
it("keeps the first page when the restore fails", …);
it("shows the empty text and no Show all", …);
```
- [ ] **Step 2 : lancer, FAIL, puis implémenter.**
- [ ] **Step 3 : relancer** : `npx vitest run && npx tsc --noEmit` donne PASS.
- [ ] **Step 4 : commit et push** : `feat: Trophy Log infinite scroll, Show all and Back`.

---

### Task 7 : vérification avec les vraies données et documents

À faire par la session principale, dans le navigateur de l'app. `e2e:db` tourne déjà. Ne pas lancer de worker en double (`docs/ETAT-DU-PROJET.md`, section 5).

- [ ] **Step 1 : dérouler la spec 16.9** sur `npm run e2e:web` (configuration « e2e-web ») :
  - « 11,636 trophies » et la première ligne ;
  - Magicka 2 et Hellblade ;
  - les milestones contre les numéros ;
  - les nombres par filtre ;
  - les tris dans les deux sens et Reset ;
  - « précédent » depuis une page de jeu, avant et après « Show all » ;
  - aucun fond derrière les icônes transparentes, sur toutes les pages citées ;
  - la page d'un jeu (platine en dernier, secondes, Timeline) ;
  - l'affichage téléphone.
- [ ] **Step 2 : construire le bundle de production**, pour que le build de la CI passe : `set -a; . .data/e2e.env; set +a; npx next build`.
- [ ] **Step 3 : mettre à jour** `docs/ETAT-DU-PROJET.md` : ce qui est fait, ce qui reste à faire (Trophy Advisor, puis Stats), et les documents de référence (cette maquette, ce plan, `trophylog-v1` et `v2`). Ajouter en tête de ce plan la ligne de statut, comme pour le Plat Wall.
- [ ] **Step 4 : commit et push** : `docs: project status after the Trophy Log page`.

---

### Task 8 : corrections de la vérification (ajoutée le 10 novembre 2026)

Constats de la tâche 7 sur le build de production avec les vraies données. La spec a été mise à jour avant cette tâche (16.5, 16.6 et 16.8).

**Files :**
- Modify : `src/lib/format.ts`, `src/lib/format.test.ts`, `components/trophy-log/TrophyLogRow.tsx`, `components/trophy-log/TrophyLogRow.test.tsx`, `src/trophy-log/load.ts`, `src/trophy-log/load.test.ts`.

**1. « Show all » plus rapide.** Mesuré : 3,1 s pour 11 636 lignes (1 s d'API, dont environ 0,7 s dans `formatDate` / `formatTime`, et 2,1 s de rendu). Objectif : **moins de 2 s** au total sur le build de production.
- `src/lib/format.ts` : `parts()` appelle `formatToParts` **une seule fois** par date, au lieu d'une fois par champ. `formatInt` utilise un `Intl.NumberFormat` créé une fois au chargement du module. Les sorties ne changent pas : les tests existants de `format.test.ts` passent tels quels.
- `TrophyLogRow` :
  - les deux liens vers la page du jeu ont `prefetch={false}` : des milliers de liens visibles ne doivent pas précharger autant de pages ;
  - `TileImage` n'est utilisé que si `gameIsIcon` ; sinon, un simple `<img className="gc">`.
- Tests :
```ts
it("puts a plain image when the game image is a cover", () => /* gameIsIcon false: img.gc without class "icon"; still inside the link */);
it("does not prefetch the game page", () => /* both links rendered with prefetch disabled — assert through the next/link mock's props */);
```

**2. Tri alphabétique (16.6).** La clé de tri ignore la casse, les accents, et la ponctuation ou les espaces en tête du nom.
- Clé en SQL, identique sur PGlite et Postgres, sans extension :
  - `lower(name)` ;
  - puis `translate()` des lettres accentuées latines courantes vers leur lettre de base (`àáâãäåçèéêëìíîïñòóôõöùúûüýÿ` donne `aaaaaaceeeeiiiinooooouuuuyy`) ;
  - puis `regexp_replace(…, '^[^a-z0-9]+', '')` ;
  - le tout en `collate "C"`, avec toujours `n desc` à égalité.
- Test dans `load.test.ts` :
```ts
it("sorts by name ignoring accents and leading punctuation", () =>
  /* names ' Journeyman', '"A hero"', '…There', '“Endless”', 'À On', 'Zebra', 'apple':
     A to Z gives '"A hero"', 'À On', 'apple', '“Endless”', ' Journeyman', '…There', 'Zebra'; Z to A is the reverse */);
```

- [ ] **Step 1 : écrire les tests qui échouent**, lancer : FAIL.
- [ ] **Step 2 : implémenter**, puis `npx vitest run && npx tsc --noEmit` donne PASS.
- [ ] **Step 3 : commit et push** : `perf: faster Trophy Log Show all, alphabetical sort ignores accents and leading punctuation`.
- [ ] **Step 4 (session principale)** : refaire le build de production et mesurer « Show all » (moins de 2 s), puis vérifier les deux sens du tri alphabétique dans le navigateur.
