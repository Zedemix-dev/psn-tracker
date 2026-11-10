# PSN Tracker : page Trophy Advisor, Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** remplacer « Coming soon » de l'onglet Trophy Advisor par la liste de tous les trophées non obtenus (tri, sens, filtres, Reset, défilement 50 par 50, trois réglages enregistrés en base) et la colonne des jeux incomplets. Sur la page Games, placer « Show all » après le nombre.

**Architecture :**
- **Même forme que le Trophy Log** : le serveur rend les 50 premières lignes, une API fournit la suite, tri et filtres vivent dans l'adresse.
- **Rien n'est recopié** : le défilement, « Show all », le retour et les morceaux des contrôles du Trophy Log deviennent des composants partagés, sans changer son comportement. Ses tests actuels doivent passer sans modification.
- **Un seul filtre SQL de portée** (`scopeWhere`) sert à la liste, à son nombre et à la colonne : leurs chiffres ne peuvent pas diverger.
- **« Hide DLC » et « DLC only » sont une seule colonne en base** (`advisor_dlc` : `all`, `hide` ou `only`) : l'état interdit « les deux actifs » n'existe pas.

**Tech Stack :** Next.js 16 (App Router, RSC), React 19, TypeScript strict, Drizzle (PostgreSQL, PGlite en test), Vitest + @testing-library/react + jsdom.

**Spec :** [section 17](../specs/2026-11-07-psn-tracker-design.md), et 13 et 14.6 pour « Show all ». **Maquette validée** (référence du CSS) : [2026-11-10-psn-tracker-maquette-advisor.html](../specs/2026-11-10-psn-tracker-maquette-advisor.html), v4. Là où elle diffère de la spec, **la spec fait foi**.

## Global Constraints

- **Git** : branche `feat/trophy-advisor`. **Après chaque commit, push.** Messages de commit en anglais, terminés par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Langues et dépendances** : interface du site et code en anglais. Aucune nouvelle dépendance.
- **Next.js 16** : lire `AGENTS.md` et les guides de `node_modules/next/dist/docs/` avant d'écrire du code Next.
- **Windows** : en Git Bash, `export PATH="/c/Program Files/nodejs:$PATH"`. Le chemin du dépôt contient `!` : le mettre entre apostrophes.
- **Tests** : `npx vitest run <fichier>`, puis `npx vitest run && npx tsc --noEmit` avant chaque commit. ESLint n'est pas configuré.
- **`app/globals.css` est un seul fichier global** :
  - toute nouvelle classe est préfixée `adv-` ou rangée sous `.adv-row` / `.adv-game` ;
  - les règles `.adv-*` vont après celles du Trophy Log, pour gagner à spécificité égale ;
  - aucune règle existante n'est modifiée ;
  - `.glass` piège `position:fixed`, `.panel` a `overflow:hidden`, et `content-visibility:auto` sur `.log-row` coupe les infobulles (levé par `.log-row:has(.unob:hover,.unob:focus)`).
- **Textes exacts** :
  - en-tête : `Zmx969's Trophy Advisor` (avec le pseudo du profil), `798 trophies`, `1 trophy`, `336 of 798 trophies match` ;
  - réglages : `Hide unobtainable`, `Hide DLC`, `DLC only` ;
  - listes vides : `No trophies match these filters.`, `Nothing left to earn.`, `No incomplete games.` ;
  - chargement : `Show all`, `Loading…`, `The next 50 trophies load as you scroll down`, `Couldn't load more trophies.`, `Retry` ;
  - tri et sens : `Rarity`, `Alphabetical`, `Most common first`, `Rarest first`, `A to Z`, `Z to A` ;
  - filtres : ceux du Trophy Log ;
  - colonne : `Incomplete games`, `41 games`, `1 game`, `left` ;
  - autres : `Reset (N)`, `No longer obtainable.`
- **Valeurs par défaut** : tri `rarity`, sens `desc` (« Most common first ») ; pour Alphabetical, `asc`. Réglages inactifs.
- **Images** : aucun fond derrière une icône de trophée (`.log-row .ic` est déjà gardée par `app/icon-backgrounds.test.ts`). L'image du jeu est celle de sa ligne dans Games.

## Review Focus

Chaque ligne a son test dans la tâche indiquée.

1. **Une adresse modifiée à la main** (`?sort=date&order=up&rarity=epic&type=x&offset=-3&limit=0`) : `date` n'est pas un tri de cette page. La page et l'API reviennent aux valeurs par défaut sans planter (tâche 2).
2. **Des pages successives de 50** donnent la liste complète, sans doublon ni trou, même avec des dizaines de trophées de même rareté ou de même nom, dans les deux sens (tâche 2).
3. **Un réglage changé pendant un « Show all »** : la liste repart du haut et aucune ligne de l'ancienne réponse n'apparaît. Un retour pris avec d'autres réglages est ignoré (tâches 2 et 3).
4. **Un réglage qui ne s'enregistre pas** (erreur réseau) : l'interrupteur et son voisin reviennent à leur position, sans planter, et deux clics rapides ne lancent pas deux enregistrements (tâche 4).
5. **Un profil sans rien à obtenir, ou avant la première synchro** : « Nothing left to earn. » et « No incomplete games. », sans « Show all » (tâches 2 et 4).

## Fichiers

| Fichier | Rôle |
|---|---|
| `src/lib/sort-name.ts` | Le nom de tri SQL (16.6), sorti de `src/trophy-log/load.ts` |
| `src/games/game-image.ts` | L'image d'un jeu dans une liste, sortie de `src/trophy-log/load.ts` |
| `src/trophy-advisor/query.ts` | Pur, utilisable côté client : réglages de l'adresse, libellés, clé de la liste |
| `src/trophy-advisor/load.ts` | Les requêtes SQL, les lignes et la colonne |
| `app/api/trophy-advisor/route.ts` | Les pages suivantes et « Show all » |
| `components/ProgressiveList.tsx` | Client, partagé : défilement, Show all, Retry, retour |
| `components/place-snapshot.ts` | Partagé : la place gardée pour le retour |
| `components/trophy-log/ControlParts.tsx` | Client, partagé : filtres, bouton de sens, Reset |
| `components/trophy-advisor/AdvisorRow.tsx` | Une ligne |
| `components/trophy-advisor/AdvisorList.tsx` | Client : `ProgressiveList` pour cette page |
| `components/trophy-advisor/AdvisorControls.tsx` | Client : tri, sens, filtres, Reset |
| `components/trophy-advisor/AdvisorToggles.tsx` | Client : les trois réglages |
| `components/trophy-advisor/IncompleteGames.tsx` | La colonne |
| `app/(site)/(banner)/trophy-advisor/page.tsx` | La page |

---

### Task 1 : les trois réglages en base

**Files :**
- Modify : `src/db/schema.ts`, `src/settings/repo.ts`, `src/settings/repo.test.ts`, `app/(site)/actions.ts`, `app/(site)/actions.test.ts`.
- Create : `src/db/migrations/0007_advisor_settings.sql` et son `meta`, générés.

**Interfaces — Produces :**
```ts
// src/db/schema.ts
export type AdvisorDlc = "all" | "hide" | "only";
// in settings: advisorHideUnobtainable: boolean("advisor_hide_unobtainable").notNull().default(false)
//              advisorDlc: text("advisor_dlc").$type<AdvisorDlc>().notNull().default("all")
// src/settings/repo.ts — Settings gains advisorHideUnobtainable: boolean; advisorDlc: AdvisorDlc
export function setAdvisorHideUnobtainable(db: Db, on: boolean): Promise<void>;
export function setAdvisorDlc(db: Db, mode: AdvisorDlc): Promise<void>;
// app/(site)/actions.ts
export async function toggleAdvisorHideUnobtainable(on: boolean): Promise<void>;
export async function setAdvisorDlcMode(mode: AdvisorDlc): Promise<void>;
```

- [ ] **Step 1 : écrire les tests qui échouent**

```ts
// repo.test.ts
it("starts with every Trophy Advisor setting off", async () => {
  expect(await getSettings(db)).toMatchObject({ advisorHideUnobtainable: false, advisorDlc: "all" });
});
it("saves the Trophy Advisor settings", async () => {
  await setAdvisorHideUnobtainable(db, true);
  await setAdvisorDlc(db, "only");
  expect(await getSettings(db)).toMatchObject({ advisorHideUnobtainable: true, advisorDlc: "only" });
});
// actions.test.ts: extend the "@/src/settings/repo" mock with the two setters
it("rejects a non-boolean", () => expect(toggleAdvisorHideUnobtainable("yes" as never)).rejects.toThrow("Invalid value"));
it("rejects an unknown DLC mode", () => expect(setAdvisorDlcMode("both" as never)).rejects.toThrow("Invalid value"));
it("saves a valid DLC mode", /* setAdvisorDlc called with (db, "hide"); revalidatePath("/trophy-advisor") called */);
```

- [ ] **Step 2 : lancer les tests, ils échouent** : `npx vitest run src/settings/repo.test.ts "app/(site)/actions.test.ts"` donne FAIL.
- [ ] **Step 3 : implémenter** le schéma, puis `npm run db:generate -- --name advisor_settings`. Le SQL généré ne doit contenir que deux `ALTER TABLE "settings" ADD COLUMN`. Puis le dépôt et les deux actions (`requireSession` d'abord, comme `toggleHideZero`).
- [ ] **Step 4 : relancer** : `npx vitest run && npx tsc --noEmit` donne PASS.
- [ ] **Step 5 : commit et push** : `feat: Trophy Advisor settings stored in the database`.

---

### Task 2 : requêtes, colonne et API

**Files :**
- Create : `src/lib/sort-name.ts`, `src/games/game-image.ts`, `src/trophy-advisor/query.ts`, `src/trophy-advisor/query.test.ts`, `src/trophy-advisor/load.ts`, `src/trophy-advisor/load.test.ts`, `app/api/trophy-advisor/route.ts`, `app/api/trophy-advisor/route.test.ts`.
- Modify : `src/trophy-log/load.ts` (utilise les deux extractions), `src/trophy-log/query.ts` (`isFiltered` accepte `Pick<LogQuery, "platform" | "rarity" | "type">`), `src/lib/format.ts` et son test (`formatCounter`), `src/games/detail.ts` (l'utilise), `scripts/pg-smoke.ts`.

**Interfaces — Consumes :** `Settings` et `AdvisorDlc` (tâche 1). De `src/trophy-log/query.ts`, tels quels : `LOG_ORDERS`, `LOG_PLATFORMS`, `LOG_RARITIES`, `LOG_TYPES` et leurs types, `tierOf`, `parsePaging`, `shownText`, `isFiltered`, `LOG_PAGE_SIZE`, `LOG_MAX`.

**Interfaces — Produces :**
```ts
// src/lib/sort-name.ts — spec 16.6: no case, accents or leading punctuation, code order
export function sortName(column: SQLWrapper): SQL;
// src/lib/format.ts
export function formatCounter(progress: number, target: number): string; // "3,626/5,000"
// src/games/game-image.ts — the image of a game's row in Games, worked out once per game
export type GameImage = { gameSrc: string; gameIsIcon: boolean };
export function gameImages(siblings: SiblingIndex, imageMap: ImageMap): (titleId: string) => GameImage;
// src/trophy-advisor/query.ts
export const ADVISOR_SORTS = ["rarity", "alphabetical"] as const;
export type AdvisorSort = (typeof ADVISOR_SORTS)[number];
export type AdvisorQuery = { sort: AdvisorSort; order: LogOrder; platform: LogPlatform; rarity: LogRarity; type: LogType };
export const DEFAULT_ADVISOR_QUERY: AdvisorQuery; // rarity, desc, all, all, all
export const ADVISOR_SHOW_ALL_SLOT_ID = "trophy-advisor-show-all";
export function naturalOrder(sort: AdvisorSort): LogOrder;
export function orderLabel(sort: AdvisorSort, order: LogOrder): string;
export function parseAdvisorQuery(params: URLSearchParams): AdvisorQuery;
export function advisorQueryParams(query: AdvisorQuery): URLSearchParams; // defaults left out
export function withSort(query: AdvisorQuery, sort: AdvisorSort): AdvisorQuery;
export function activeControls(query: AdvisorQuery): number;
export type AdvisorScope = { hideZero: boolean; hideUnobtainable: boolean; dlc: AdvisorDlc };
export function advisorListKey(query: AdvisorQuery, scope: AdvisorScope, lastSuccessAt: unknown): string;
// src/trophy-advisor/load.ts
export type AdvisorRow = {
  key: string; name: string; detail: string; iconSrc: string; type: TrophyType;
  gameId: string; gameName: string; gameSrc: string; gameIsIcon: boolean;
  dlc: string | null; platforms: ("PS4" | "PS5")[]; counter: string | null;
  ratePct: string | null; tier: RarityTier | null;
  unobtainable: boolean; unobtainableNote: string | null; // plain text, only when unobtainable
};
export type AdvisorPage = { items: AdvisorRow[]; total: number };
export function advisorScope(s: Pick<Settings, "hideZero" | "advisorHideUnobtainable" | "advisorDlc">): AdvisorScope;
export function queryAdvisor(db: Db, query: AdvisorQuery, scope: AdvisorScope, paging: { offset: number; limit: number }): Promise<AdvisorPage>;
export function countAdvisorTrophies(db: Db, scope: AdvisorScope): Promise<number>;
export type IncompleteGame = {
  id: string; name: string; platforms: ("PS4" | "PS5")[]; coverSrc: string; coverIsIcon: boolean;
  progress: number; rank: GameRank; left: number;
  unobtainable: { label: string; note: string | null } | null; // only when counted unobtainable trophies remain
};
export function getIncompleteGames(db: Db, scope: AdvisorScope): Promise<IncompleteGame[]>;
```

- [ ] **Step 1 : écrire les tests qui échouent.** Graines avec `insertTitle` / `insertTrophies` / `insertGroup` de `tests/fixtures/profile.ts`, sur `createTestDb()`. `OFF = { hideZero: false, hideUnobtainable: false, dlc: "all" }`.

```ts
// query.test.ts
it("defaults to rarity, most common first", () => expect(parseAdvisorQuery(new URLSearchParams())).toEqual(DEFAULT_ADVISOR_QUERY));
it("ignores a hand-edited address", () =>
  expect(parseAdvisorQuery(new URLSearchParams("sort=date&order=up&rarity=epic&type=x&platform=PS3"))).toEqual(DEFAULT_ADVISOR_QUERY));
it("leaves defaults out of the address", () => expect(advisorQueryParams(DEFAULT_ADVISOR_QUERY).toString()).toBe(""));
it("gives each sort its natural order", () => { /* withSort(q, "alphabetical").order === "asc"; withSort(q, "rarity").order === "desc" */ });
it("labels the direction", /* the four labels of Global Constraints */);
it("counts the changed controls", () => {
  expect(activeControls(DEFAULT_ADVISOR_QUERY)).toBe(0);
  expect(activeControls(withSort(DEFAULT_ADVISOR_QUERY, "alphabetical"))).toBe(1);
  expect(activeControls({ ...withSort(DEFAULT_ADVISOR_QUERY, "alphabetical"), order: "desc", platform: "PS5" })).toBe(3);
});
it("changes the list key with the settings and the last sync", /* each of dlc, hideUnobtainable, hideZero, lastSuccessAt, sort gives a different key */);
// load.test.ts
it("lists unearned trophies of visible titles only", /* earned one and one in a hidden title left out; total counts the same */);
it("sorts by rarity, most common first, unknown rarity last in both directions", …);
it("sorts alphabetically without case, accents or leading punctuation", /* " Journeyman", "\"A hero\"", "À On", "apple", "Zebra": A hero, À On, apple, Journeyman, Zebra */);
it("breaks ties by game name, list id, then trophy order, in both directions", …);
it("filters by platform, rarity and type", …);
it("hides unobtainable trophies", …);
it("hides DLC trophies with dlc 'hide' and keeps only them with 'only'", …);
it("drops 0% games with hideZero", …);
it.each(sortsAndOrders)("pages of 2 cover the list with no duplicate or gap: %s %s", /* 7 trophies with the same rate and the same name, offsets 0, 2, 4, 6 */);
it("gives the counter only to a trophy with a target and a progress", /* "3,626/5,000", "0/4", null */);
it("gives the cause of an unobtainable trophy in plain text", /* a Markdown link in titles.unobtainable_note comes out as its label */);
describe("getIncompleteGames", () => {
  it("orders by trophies left, then game name, then list id", …);
  it("counts DLC by default", …);
  it("applies hideUnobtainable: a game with only unobtainable trophies left is gone, another goes from 6 to 2", …);
  it("applies dlc 'hide' and 'only' the same way", …);
  it("agrees with the list: the sum of left equals countAdvisorTrophies", /* for each of the 6 combinations of hideUnobtainable and dlc */);
  it("marks a game only while counted unobtainable trophies remain", …);
  it("is empty on a profile with nothing left", …);
});
// route.test.ts: 401 without a session; reads the settings from the database (dlc "only" in settings
// → only DLC rows); a hand-edited address gives the default first page, like app/api/trophy-log/route.test.ts
```

- [ ] **Step 2 : lancer les tests, ils échouent** : `npx vitest run src/trophy-advisor app/api/trophy-advisor` donne FAIL.
- [ ] **Step 3 : implémenter.**
  - `scopeWhere(scope)`, privé à `load.ts` : `earned = false`, `titles.hidden = false`, plus selon la portée `titles.progress <> 0`, `trophies.unobtainable = false`, `group_id = 'default'` ou `<> 'default'`. La liste, son total, `countAdvisorTrophies` et la colonne s'en servent tous.
  - Filtres de plateforme, de rareté et de type : mêmes conditions que `filtersFor` dans `src/trophy-log/load.ts`.
  - Ordre, total comme l'exige la pagination : `earned_rate <dir> nulls last` ou `sortName(trophies.name) <dir>`, puis toujours en `asc` : `sortName(titles.name)`, `title_id collate "C"`, `trophy_id`.
  - Colonne : un `group by` sur `titles.np_communication_id` avec `count(*)` et `count(*) filter (where trophies.unobtainable)`, trié `count desc`, `sortName(titles.name)`, `id collate "C"`. Le reste vient de `toGameRow`, déjà utilisé par Games, avec `unobtainableLabel(n, definedTotal)` pour le libellé. Un titre absent de l'index des siblings est ignoré.
  - `scripts/pg-smoke.ts` : après `smokeTrophyLog`, une `smokeAdvisor` sur le même modèle, sous un autre identifiant, avec 3 trophées non obtenus dont un de DLC : l'ordre alphabétique, et `getIncompleteGames` qui compte 3 puis 2 avec `dlc: "hide"`.
- [ ] **Step 4 : relancer** : `npx vitest run && npx tsc --noEmit` donne PASS. Les tests de `src/trophy-log` passent sans modification.
- [ ] **Step 5 : commit et push** : `feat: Trophy Advisor queries, incomplete games and API`.

---

### Task 3 : liste et contrôles partagés avec le Trophy Log

Refactorisation sans changement de comportement. **`components/trophy-log/TrophyLogList.test.tsx`, `TrophyLogControls.test.tsx` et `log-snapshot.test.ts` ne sont pas modifiés**, sauf le nouveau test ci-dessous.

**Files :**
- Create : `components/ProgressiveList.tsx`, `components/place-snapshot.ts`, `components/trophy-log/ControlParts.tsx`.
- Modify : `components/trophy-log/TrophyLogList.tsx`, `components/trophy-log/log-snapshot.ts`, `components/trophy-log/TrophyLogControls.tsx`, `components/trophy-log/TrophyLogList.test.tsx`.

**Interfaces — Produces :**
```ts
// components/place-snapshot.ts — the code of log-snapshot.ts, its two keys as parameters
export type PlaceSnapshot = { key: string; loaded: number; scrollY: number; anchorKey?: string; anchorOffset?: number };
export type PlaceStore = { save(s: PlaceSnapshot): void; take(key: string): PlaceSnapshot | null };
export function createPlaceStore(storageKey: string, stateTag: string): PlaceStore;
// components/trophy-log/log-snapshot.ts keeps saveLogSnapshot, takeLogSnapshot and LogSnapshot on top of it.
// components/ProgressiveList.tsx — the body of TrophyLogList
export const RENDER_CHUNK = 300; // re-exported by TrophyLogList as LOG_RENDER_CHUNK
export function ProgressiveList<T extends { key: string }>(props: {
  initial: { items: T[]; total: number };
  apiPath: string;           // "/api/trophy-log"
  queryString: string;       // filters only, without offset, limit or all
  snapshotKey: string;
  places: PlaceStore;
  slotId: string;            // where "Show all" is portaled
  renderRow: (row: T) => ReactNode;  // a stable, module-level function
  empty: string;
}): ReactNode;
// components/trophy-log/ControlParts.tsx — same markup and classes as today
export const selectClass: (active: boolean) => string;
export function TrophyFilterSelects(props: {
  value: { platform: LogPlatform; rarity: LogRarity; type: LogType };
  onChange: (next: { platform: LogPlatform; rarity: LogRarity; type: LogType }) => void;
}): ReactNode;
export function DirectionButton(props: { active: boolean; label: string; onClick: () => void }): ReactNode;
export function ResetButton(props: { count: number; onClick: () => void }): ReactNode;
```

- [ ] **Step 1 : écrire le test qui échoue**, dans `TrophyLogList.test.tsx`, section « coming back from a game page » :

```ts
it("saves the place when a game link outside the list is clicked", async () => {
  /* render the list and, next to it, <a href="/games/X">; click that link;
     the saved snapshot has loaded === rows shown. Modified clicks still save nothing. */
});
```

- [ ] **Step 2 : lancer le test, il échoue** : `npx vitest run components/trophy-log` donne FAIL sur ce seul test.
- [ ] **Step 3 : implémenter.**
  - `TrophyLogList` garde ses props et devient une enveloppe : `const Row = memo(TrophyLogRow)`, `renderRow` au niveau du module, `queryString` tiré de `logQueryParams(query)`.
  - Dans `ProgressiveList`, chaque ligne est rendue dans `<Fragment key={row.key}>`. `findRow` et `topRow` gardent le sélecteur `.log-row` : Trophy Advisor réutilise cette classe.
  - **Seul changement de fonctionnement** : `rememberPlace` n'est plus un `onClickCapture` sur la liste, mais un écouteur `click` en capture sur `document`, posé dans un `useEffect` et retiré au démontage, pour couvrir les liens de la colonne (17.4). Le nombre de lignes chargées se lit dans une `ref`. La condition sur `a[href^="/games/"]` et les touches de modification ne change pas.
- [ ] **Step 4 : relancer** : `npx vitest run && npx tsc --noEmit` donne PASS, tous les tests du Trophy Log inchangés.
- [ ] **Step 5 : commit et push** : `refactor: share the progressive list and the controls of the Trophy Log`.

---

### Task 4 : composants de la page

**Files :**
- Create : les cinq fichiers de `components/trophy-advisor/`, chacun avec son test.
- Modify : `app/globals.css`.

**Interfaces — Consumes :** tâches 1 à 3.

**Interfaces — Produces :**
```ts
export function AdvisorRow(props: { row: AdvisorRow }): ReactNode;
export function AdvisorList(props: { initial: AdvisorPage; query: AdvisorQuery; snapshotKey: string; empty: string }): ReactNode;
export function AdvisorControls(props: { query: AdvisorQuery }): ReactNode;
export function AdvisorToggles(props: { hideUnobtainable: boolean; dlc: AdvisorDlc }): ReactNode;
export function IncompleteGames(props: { games: IncompleteGame[] }): ReactNode;
```

- [ ] **Step 1 : écrire les tests qui échouent.**

```ts
// AdvisorRow.test.tsx
it("links the image and the name of the game", …);
it("shows the DLC name, the platforms, the rarity and the type", …);
it("shows the counter only when there is one", …);
it("shows no number and no date", …);
it("marks an unobtainable trophy: class lost, tooltip with the cause", …);
// AdvisorControls.test.tsx: same cases as TrophyLogControls.test.tsx, with the defaults of this page:
it("offers only Rarity and Alphabetical", …);
it("reads Most common first by default, with no accent contour and no Reset", …);
it("resets to the defaults without touching the settings", …);
// AdvisorToggles.test.tsx — vi.mock("@/app/(site)/actions"), vi.mock("next/navigation")
it("saves Hide unobtainable and refreshes", …);
it("turning on DLC only turns off Hide DLC, with one save of mode 'only'", …);
it("turning on Hide DLC turns off DLC only, with one save of mode 'hide'", …);
it("turning a DLC toggle off saves mode 'all'", …);
it("puts both DLC toggles back when the save fails", /* action rejects: state before the click, no throw */);
it("disables the three while a save runs", …);
// IncompleteGames.test.tsx
it("links each game and shows the count with 'left'", …);
it("gives the bar the colour of the rank and the PSN percentage", /* style background var(--rank-d) for 27 */);
it("shows the mark only when the game has one", …);
it("reads 41 games, 1 game, and the empty text", …);
// AdvisorList.test.tsx
it("asks /api/trophy-advisor with the filters of the list", …);
```

- [ ] **Step 2 : lancer les tests, ils échouent** : `npx vitest run components/trophy-advisor` donne FAIL.
- [ ] **Step 3 : implémenter les composants.** `AdvisorRow` a le balisage de `TrophyLogRow`, sans numéro ni date, avec `<div className={`log-row adv-row${row.unobtainable ? " lost" : ""}`} data-key=…>` et, dans `.meta`, `<div className="adv-count" title="Progress">{row.counter}</div>` avant `.rate`. `AdvisorToggles` suit `HideZeroToggle` : état local, `useTransition`, retour arrière sur échec, `router.refresh()`.
- [ ] **Step 4 : ajouter le CSS**, repris de la maquette v4, en réutilisant `.log-head`, `.log-aside`, `.log-tools`, `.log-row` et ses enfants, `.toggle`, `.bar`, `.pct` :

```css
.adv-panel{margin:0}
.adv-left{display:flex;align-items:center;gap:8px 16px;flex-wrap:wrap}
.log-row.adv-row{grid-template-columns:56px 56px minmax(0,1fr) 120px 92px 30px}
.log-row.adv-row.lost{background:color-mix(in srgb,var(--rank-f) 14%,transparent)}
.log-row .adv-count{text-align:right;font-size:15px;font-weight:600;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
@media (max-width:1400px){.adv-layout{grid-template-columns:minmax(0,1fr) 360px}}
@media (max-width:1180px){.adv-layout{grid-template-columns:minmax(0,1fr)} .adv-side{order:-1} .adv-games{max-height:300px;overflow-y:auto}}
@media (max-width:900px){.log-row.adv-row{grid-template-columns:48px minmax(0,1fr) 120px 84px 26px}}
@media (max-width:640px){.log-row.adv-row{grid-template-columns:44px minmax(0,1fr) 26px} .log-row .adv-count{text-align:left;font-size:12.5px}}
```

  Puis `.adv-side-head`, `.adv-game` et ses enfants, d'après `.side-head` et `.ag` de la maquette. Vérifier d'abord qu'aucun nom `.adv-*` n'existe.
- [ ] **Step 5 : relancer** : `npx vitest run && npx tsc --noEmit` donne PASS.
- [ ] **Step 6 : commit et push** : `feat: Trophy Advisor row, list, controls, settings and incomplete games`.

---

### Task 5 : la page, et « Show all » sur Games

**Files :**
- Create : `app/(site)/(banner)/trophy-advisor/page.tsx`, `app/show-all-order.test.ts`.
- Modify : `app/(site)/(banner)/[section]/page.tsx` (retirer `"trophy-advisor"` de `SECTIONS`), `app/(site)/(banner)/page.tsx`.

**Interfaces — Consumes :** tâches 1, 2 et 4. La page suit `app/(site)/(banner)/trophy-log/page.tsx`.

- [ ] **Step 1 : écrire le test qui échoue**

```ts
// app/show-all-order.test.ts — reads the page sources as text
it.each([
  ["app/(site)/(banner)/page.tsx", "SHOW_ALL_SLOT_ID", 'className="aside"'],
  ["app/(site)/(banner)/trophy-log/page.tsx", "LOG_SHOW_ALL_SLOT_ID", "shownText("],
  ["app/(site)/(banner)/trophy-advisor/page.tsx", "ADVISOR_SHOW_ALL_SLOT_ID", "shownText("],
])("%s: Show all comes after the count", (file, slot, count) => {
  /* in the returned JSX: indexOf(`id={${slot}}`) > indexOf(count), both found */
});
```

- [ ] **Step 2 : lancer le test, il échoue** : `npx vitest run app/show-all-order.test.ts` donne FAIL.
- [ ] **Step 3 : implémenter la page** :
  - `<main className="wrap">`, `ProfileBand`, `StatTiles`, puis `<div className="layout adv-layout">` ;
  - `<section className="panel glass log-panel adv-panel" aria-label="Trophy Advisor">` avec `.log-head` (`.adv-left` : le titre et `AdvisorToggles` ; `.log-aside` : `shownText(overall, page.total, isFiltered(query))` puis le slot), `AdvisorControls`, `AdvisorList` ;
  - `<aside className="panel glass adv-side" aria-label="Incomplete games">` avec `IncompleteGames` ;
  - `key` et `snapshotKey` de la liste : `advisorListKey(query, scope, sync.lastSuccessAt)` ;
  - `empty` : `overall === 0 ? "Nothing left to earn." : "No trophies match these filters."`
- [ ] **Step 4 : sur Games**, échanger l'ordre de `<span id={SHOW_ALL_SLOT_ID} />` et de `.aside` dans `.head-right`.
- [ ] **Step 5 : relancer** : `npx vitest run && npx tsc --noEmit` donne PASS.
- [ ] **Step 6 : commit et push** : `feat: Trophy Advisor page; Show all after the count on Games`.

---

## Après les tâches (session principale, pas de subagent)

1. Appliquer la migration à la base locale sans lancer le worker, puis vérifier avec les vraies données sur le build de production, selon la spec 17.10.
2. Relecture finale de toute la branche par un subagent Opus.
3. Mettre à jour `docs/ETAT-DU-PROJET.md` et la spec (13, 14.6), commit et push. L'utilisateur crée et fusionne la Pull Request.
