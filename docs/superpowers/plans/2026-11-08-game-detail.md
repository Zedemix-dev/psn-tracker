# PSN Tracker — Page de détail d'un jeu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** remplacer l'emplacement provisoire de `/games/[id]` par la page de détail d'un jeu validée (maquette v5). Il faut aussi :
- compléter la synchro avec ce dont la page a besoin : concept, bannière, logo, catalogue PSN et compteurs des trophées à paliers ;
- ramener la liste Games à sa position au retour.

**Architecture :**
- **Synchro** :
  - le worker lit le concept de chaque jeu joué (déjà renvoyé par `getUserPlayedGames`) ;
  - il interroge le catalogue PSN pour l'éditeur, les genres et la date de sortie ;
  - il lit l'objectif des trophées à paliers dans leurs définitions, et la progression dans l'état utilisateur.
- **Page** :
  - un chargeur serveur (`getGameDetail`) construit un modèle de vue sérialisable ;
  - la page serveur assemble des composants sans état ;
  - seule la liste des trophées est un composant client (filtre et tri locaux, reflétés dans l'adresse).
- **Bannière** : la bannière de l'utilisateur passe dans un groupe de routes `(banner)`, pour que la page d'un jeu fournisse la sienne.

**Tech Stack :** Next.js 16 (App Router, RSC), React 19, TypeScript strict, Drizzle ORM + drizzle-kit, PGlite (tests), `psn-api`, Vitest + @testing-library/react + jsdom.

**Spec :** [docs/superpowers/specs/2026-11-07-psn-tracker-design.md](../specs/2026-11-07-psn-tracker-design.md).
- Sections **8.9** (la page), **6.3 / 6.4 / 6.5 / 7** (données et synchro), **8.7** (retour à la liste), **8.8** (rareté centrée) et **10** (proportions).
- Maquette validée : [2026-11-08-psn-tracker-maquette-jeu.html](../specs/2026-11-08-psn-tracker-maquette-jeu.html) (v5). **Le CSS de la page se porte depuis cette maquette**, avec les mêmes valeurs. Les seuls ajouts sont un préfixe `.game-page` (voir Task 10) et le sélecteur de la maquette (`.switcher`), qui n'est pas porté.

## Global Constraints

- **Interface 100 % en anglais**. Le code et les messages de commit sont en anglais aussi.
- **Dates :**
  - date seule au format `18 Jul 2022` (`formatDate`) ;
  - heure seule au format `01:21` (24 h, `Europe/Paris`) ;
  - temps relatif comme les milestones (`formatRelative`).
- **Nombres :** `1,485`, `25.81%` (deux décimales), `3,626/5,000`.
- **Points PSN :** bronze 15, argent 30, or 90, platine 300.
- **Pourcentage d'un groupe :**
  - `floor(points obtenus hors platine × 100 / points du groupe hors platine)` ;
  - au moins `1` dès que des points hors platine sont obtenus ;
  - `0` sans aucun point.
- **Raretés :** paliers de `rarityTier` (`src/lib/rarity.ts`). Un trophée sans rareté connue (`earnedRate` null) est exclu des moyennes, de la médiane, des extrêmes et de la répartition. Le tri « Rarest first » le met en dernier.
- **Couleurs :**
  - trophée obtenu : fond `#3DBE6B` à 14 %, liseré de 2 px `#3DBE6B` autour de l'icône, date en `#93E2AE` ;
  - barres aux couleurs de rang S…F, déjà dans `globals.css`.
- **Proportions** (spec 10) :
  - colonne latérale de **320 px** et jaquette en 320 × 320 ;
  - lignes de trophées d'au moins **66 px**, icônes de **56 px**, nom en **15 px** ;
  - en-têtes de groupe de **110 px**, icônes de groupe de **100 px** ;
  - bannière **identique à celle de Games** (`.hero`, 1920 × 520, entre 240 et 560 px).
- **Logo :** au plus 400 px de large (38 %) et 42 % de la hauteur de la bannière, en bas à gauche, aligné sur le contenu, masqué à 640 px et moins.
- **Images :** la bannière est gardée **en taille originale** (4K). Le logo est téléchargé avec `?w=800`. Aucune image n'est chargée depuis psnprofiles ou le CDN de Sony à l'affichage : tout passe par `mediaSrc` / `/media/...`.
- **Catalogue PSN :** `GET https://m.np.playstation.com/api/catalog/v2/concepts/{conceptId}?country=GB&language=en&age=99`. Les trois paramètres doivent être tous présents.
- **Next.js 16 :** lire le guide concerné dans `node_modules/next/dist/docs/` avant d'écrire du code Next. Lire aussi `AGENTS.md`.
- **Environnement :**
  - Windows, Node pas toujours dans le PATH : en Git Bash, `export PATH="/c/Program Files/nodejs:$PATH"` ;
  - chemin du dépôt avec `!` : le mettre entre apostrophes.
- **Vérifications de chaque tâche :** `npx vitest run <fichiers>` puis, en fin de tâche, `npx vitest run` et `npx tsc --noEmit`.
- **Git :** branche `feat/game-detail`. **Un commit et un `git push` à la fin de chaque tâche** : l'utilisateur change de PC.

## Review Focus

1. **Jeu sans concept ou images pas encore téléchargées :** nouveau jeu, 7 listes sans jeu joué relié, téléchargement raté. La page s'affiche avec la bannière de l'utilisateur, sans logo, et les lignes Publisher / Genre / Release date sont masquées. Testé dans Task 7.
2. **Trophée sans rareté connue** (jeu tout juste sorti) : pas de « NaN% », exclu des statistiques, en dernier avec « Rarest first ». Testé dans Task 6 (`rarityStats`) et Task 9 (tri).
3. **Changement d'heure entre deux dates :** les durées sont calculées sur l'heure de Paris. Le Gap de Cyberpunk traverse le passage à l'heure d'hiver. Testé dans Task 6.
4. **Nom de jeu avec ™, ®, apostrophe typographique, deux-points, accents ou espaces doubles :** aucune lettre ne doit disparaître des liens de guides (bug de la v4 « Gran Turi mo »). Testé dans Task 6.
5. **Retour sur Games après une synchro, ou avec d'autres filtres :** la liste repart du haut, sans restaurer une liste périmée. Testé dans Task 11.

---

### Task 1 : Schéma et migration

**Files:**
- Modify: `src/db/schema.ts`
- Create: `src/db/migrations/0004_*.sql` et son snapshot (générés)
- Test: `src/db/schema.test.ts`

**Interfaces:**
- Produces, dans le schéma Drizzle :
  - `titles` : `conceptId: integer("concept_id")`, `bannerUrl: text("banner_url")`, `logoUrl: text("logo_url")`, `publisher: text("publisher")`, `genres: text("genres").array()`, `releaseDate: ts("release_date")`, `catalogCheckedAt: ts("catalog_checked_at")`. Toutes nullables. `genres` null veut dire « jamais récupéré ».
  - `playedGames` : `conceptId: integer("concept_id")`, `bannerUrl: text("banner_url")`, `logoUrl: text("logo_url")`.
  - `trophies` : `progressTarget` devient `integer("progress_target")` (au lieu de `text`), plus `progress: integer("progress")` et `progressedAt: ts("progressed_at")`.

- [ ] **Step 1 : test qui échoue.** Dans `schema.test.ts`, ajouter `it("stores tiered trophy progress and game catalog columns")`. Le test :
  - insère un titre avec `conceptId: 234567`, `genres: ["Role Playing Games"]` et `releaseDate: new Date("2020-12-10T00:00:00Z")` ;
  - insère un trophée avec `progressTarget: 5000`, `progress: 3626` et `progressedAt` ;
  - relit et vérifie que `progressTarget === 5000` est un **nombre**.
- [ ] **Step 2 :** `npx vitest run src/db/schema.test.ts` → FAIL (colonnes inconnues).
- [ ] **Step 3 :** modifier `schema.ts`, puis `npm run db:generate`.
  - **Corriger à la main le SQL généré** : passer `progress_target` de `text` à `integer` exige `USING "progress_target"::integer`, sinon Postgres refuse la conversion. La colonne est vide partout (12 434 lignes nulles en local), la conversion est donc sans perte.
  - La seule écriture existante est `progressTarget: u?.progressTarget ?? null` dans `src/sync/title.ts`. Pour que `tsc` passe, la convertir en nombre (`Number(...)`, ou `null`). La Task 2 la prendra dans la définition.
- [ ] **Step 4 :** `npx vitest run src/db/schema.test.ts` → PASS, puis `npx vitest run` → tout passe.
- [ ] **Step 5 :** commit `feat(db): game concept, catalog and tiered trophy progress columns`, puis push.

---

### Task 2 : Passerelle PSN (concept, catalogue, paliers)

**Files:**
- Modify: `src/psn/types.ts`, `src/psn/gateway.ts`, `tests/fakes/psn.ts`, `tests/fixtures/titles.ts`, `tests/fixtures/played.ts`
- Test: `src/psn/gateway.test.ts`

**Interfaces:**
- Produces (`src/psn/types.ts`) :
  ```ts
  export type RemoteTrophyDef = { /* existant */ progressTarget: number | null };
  // progressTarget quitte RemoteUserTrophy :
  export type RemoteUserTrophy = { trophyId: number; earned: boolean; earnedAt: Date | null;
    earnedRate: number | null; rareCategory: number | null; progress: number | null; progressedAt: Date | null };
  export type RemoteConcept = { id: number; bannerUrl: string | null; logoUrl: string | null };
  export type RemotePlayedGame = { /* existant */ concept: RemoteConcept | null };
  export type RemoteCatalog = { publisher: string | null; releaseDate: Date | null; genres: string[] };
  ```
- Produces (`src/psn/gateway.ts`) :
  - `PsnGateway.getCatalog(auth: PsnAuth, conceptId: number): Promise<RemoteCatalog>` ;
  - `export function catalogLocale(language: string): { country: string; language: string }`.
- Faux PSN : `FakePsnFixture.catalogs?: Record<number, RemoteCatalog>`. `getCatalog` enregistre `"getCatalog:<conceptId>"` et rejette quand le concept est absent de la fixture. Les fixtures `makeTrophies` et `makePlayedGame` reçoivent `progressTarget: null`, `progress: null`, `progressedAt: null` et `concept: null`.

- [ ] **Step 1 : tests qui échouent**, dans `gateway.test.ts`, en réutilisant `on(...)` :
  - `it("reads the progress target from definitions and the progress from the user state")` :
    - une définition porte `trophyProgressTargetValue: "5000"` ;
    - l'état utilisateur porte `progress: "3626"` et `progressedDateTime: "2023-02-05T09:36:54Z"` ;
    - attendu : `progressTarget === 5000`, `progress === 3626`, `progressedAt` égal à cette date.
  - `it("maps the played game concept to its banner and its logo resized to 800 px")` :
    - le jeu porte `concept: { id: 234567, media: { images: [...] } }`, avec les types `GAMEHUB_COVER_ART` (`…/a1krx.png`), `LOGO` (`…/logo.png`) et `MASTER` ;
    - attendu : `{ id: 234567, bannerUrl: "…/a1krx.png", logoUrl: "…/logo.png?w=800" }` ;
    - un jeu sans `concept` donne `concept: null`.
  - `it("fetches the catalog with country, language and age together")` :
    - la requête porte `country=GB`, `language=en` et `age=99` ;
    - la réponse `{ publisherName: "CD PROJEKT RED S.A.", releaseDate: { date: "2020-12-10T00:00:00Z" }, localizedGenres: [{ value: "Role Playing Games" }, { value: "Role Playing Games" }] }` donne `{ publisher: "CD PROJEKT RED S.A.", releaseDate: new Date("2020-12-10T00:00:00Z"), genres: ["Role Playing Games"] }` (doublon retiré) ;
    - une réponse `{ error: { message: "x" } }` rejette.
  - `it("derives the catalog locale from the PSN language")` : `catalogLocale("en-GB")` donne `{ country: "GB", language: "en" }`, et `catalogLocale("en")` donne `{ country: "US", language: "en" }`.
- [ ] **Step 2 :** `npx vitest run src/psn/gateway.test.ts` → FAIL.
- [ ] **Step 3 :** implémenter.
  - `getCatalog` passe par `call` avec `headerOverrides`, comme `getProfile`.
  - Le logo reçoit `?w=800` (`LOGO_WIDTH = 800`). La bannière garde son adresse d'origine (spec 6.5 : 4K).
  - `getUserTrophies` ne lit plus `trophyProgressTargetValue`.
  - Dans `syncTitle`, `progressTarget` vient désormais de la définition (`d.progressTarget`).
  - Mettre à jour le faux et les fixtures.
- [ ] **Step 4 :** `npx vitest run` → PASS ; `npx tsc --noEmit` → aucune erreur.
- [ ] **Step 5 :** commit `feat(psn): played game concept, catalog and tiered trophy progress`, puis push.

---

### Task 3 : Compteurs stockés à la synchro d'un jeu et au rafraîchissement quotidien

**Files:**
- Modify: `src/sync/title.ts`, `src/sync/daily.ts`
- Create: `src/sync/user-state.ts`
- Test: `src/sync/title.test.ts`, `src/sync/user-state.test.ts`, `src/sync/daily.test.ts`

**Interfaces:**
- Consumes : `RemoteTrophyDef.progressTarget`, `RemoteUserTrophy.progress` et `.progressedAt` (Task 2).
- Produces : `refreshUserState(db: Db, gw: PsnGateway, auth: PsnAuth, ref: TitleRef): Promise<number>`, dans `src/sync/user-state.ts`.
  - Il relit l'état utilisateur d'un jeu et met à jour, pour chaque trophée, `earnedRate`, `rareCategory`, `progress` et `progressedAt`, dans une transaction.
  - Il ne touche jamais `earned` ni `earnedAt`.
  - Il renvoie le nombre de trophées lus.

- [ ] **Step 1 : tests qui échouent.**
  - `title.test.ts`, `it("stores the progress target from definitions and the user's progress")` :
    - un trophée non obtenu avec `progressTarget: 4` et `progress: 1` est stocké avec `progressTarget === 4` et `progress === 1` ;
    - un trophée obtenu avec `progressTarget: 4` et `progress: null` garde `progress === null`.
  - `user-state.test.ts`, `it("updates rates and progress without touching earned state")` : après un `syncTitle`, le faux renvoie `progress: 3` et un nouveau `earnedRate`. Après `refreshUserState`, la ligne a les nouvelles valeurs, et `earned` / `earnedAt` sont inchangés.
  - `daily.test.ts`, `it("refreshes tiered trophy progress daily")` : la progression passe de 1 à 2 entre deux appels du faux, et `runDailyRefresh` stocke `2`.
- [ ] **Step 2 :** `npx vitest run src/sync/title.test.ts src/sync/user-state.test.ts src/sync/daily.test.ts` → FAIL.
- [ ] **Step 3 :** implémenter.
  - Dans `syncTitle`, `progress` et `progressedAt` viennent de l'état utilisateur. L'upsert les met à jour depuis `excluded`, comme `progressTarget`.
  - Dans `runDailyRefresh`, la branche « mêmes groupes » appelle `refreshUserState` au lieu de sa mise à jour en ligne.
- [ ] **Step 4 :** relancer les trois fichiers → PASS ; `npx vitest run` ; `npx tsc --noEmit`.
- [ ] **Step 5 :** commit `feat(sync): store tiered trophy targets and progress`, puis push.

---

### Task 4 : Concept des jeux joués, et compteurs des jeux joués depuis la dernière synchro

**Files:**
- Modify: `src/sync/played.ts`, `src/sync/run.ts`
- Test: `src/sync/played.test.ts`, `src/sync/run.test.ts`

**Interfaces:**
- Consumes : `RemotePlayedGame.concept` (Task 2), `refreshUserState` (Task 3).
- Produces : `syncPlayedGames(db, gw, auth): Promise<{ replayedTitleIds: string[] }>`. Ce sont les listes dont `titles.lastPlayedAt` a changé pendant l'appel et n'est pas nul.

- [ ] **Step 1 : tests qui échouent.**
  - `played.test.ts`, `it("gives a title the concept, banner and logo of its most recently played linked game")` :
    - deux jeux joués A et B sont reliés au même titre ; seul le plus récent, B, a un concept ;
    - le titre reçoit `conceptId`, `bannerUrl` et `logoUrl` de B.
  - `played.test.ts`, `it("clears the catalog fields when a title's concept changes")` : un titre déjà rempli (`publisher`, `catalogCheckedAt`) change de concept, et ces champs repassent à `null`.
  - `played.test.ts`, `it("reports the titles whose last played date changed")` :
    - premier appel : le titre est rapporté ;
    - second appel avec la même date : liste vide ;
    - troisième appel avec une date plus récente : le titre est rapporté.
  - `run.test.ts`, `it("refreshes the user state of a replayed PS5 title that was not reloaded")` :
    - le titre `trophy2` est inchangé côté `getTitles`, mais sa date de dernière partie avance entre deux `runSync` ;
    - le second `runSync` appelle `getUserTrophies:<id>` une fois, et ne l'appelle pas pour un titre `trophy` (PS4).
- [ ] **Step 2 :** `npx vitest run src/sync/played.test.ts src/sync/run.test.ts` → FAIL.
- [ ] **Step 3 :** implémenter.
  - `RemotePlayedGame` ne s'insère plus tel quel. Les lignes `played_games` sont construites explicitement, avec `conceptId`, `bannerUrl` et `logoUrl`.
  - Le concept d'un titre est celui du jeu relié le plus récemment joué **qui a un concept** (même règle de date que la jaquette).
  - `runSync` retient les titres rechargés par `syncTitle` pendant le run. Après `syncPlayedGames`, il appelle `refreshUserState` pour chaque titre rapporté qui n'a pas été rechargé, qui est `trophy2` et qui n'est pas caché. Un échec va dans `failures`, comme pour un titre.
- [ ] **Step 4 :** relancer → PASS ; `npx vitest run` ; `npx tsc --noEmit`.
- [ ] **Step 5 :** commit `feat(sync): game concept from played games, refresh progress of replayed games`, puis push.

---

### Task 5 : Catalogue PSN et images du jeu

**Files:**
- Create: `src/sync/catalog.ts`
- Modify: `src/sync/run.ts`, `src/sync/daily.ts`, `src/sync/images.ts`
- Test: `src/sync/catalog.test.ts`, `src/sync/images.test.ts`

**Interfaces:**
- Consumes : `PsnGateway.getCatalog` (Task 2), `titles.conceptId` (Task 4).
- Produces : `syncCatalog(db: Db, gw: PsnGateway, auth: PsnAuth, mode: "missing" | "all", now: Date): Promise<{ fetched: number; failed: number }>`, dans `src/sync/catalog.ts`.
  - `"missing"` ne traite que les concepts dont un titre a `catalogCheckedAt` nul.
  - Un seul appel par `conceptId`, même s'il est partagé par plusieurs titres (versions PS4 et PS5).
  - En cas de succès, il écrit `publisher`, `genres`, `releaseDate` et `catalogCheckedAt = now` sur tous les titres du concept.
  - Un échec est compté dans `failed`, ne lève rien et laisse `catalogCheckedAt` nul.

- [ ] **Step 1 : tests qui échouent.**
  - `catalog.test.ts` :
    - `it("fetches each concept once and fills every title sharing it")` : deux titres partagent le concept 1 → un seul `getCatalog:1`, et les deux titres sont remplis ;
    - `it("only fetches missing concepts unless asked for all")` : un second appel en `"missing"` ne fait aucun appel ; un appel en `"all"` refait `getCatalog:1` ;
    - `it("counts a failing concept and retries it next time")` : concept absent du faux → `{ fetched: 0, failed: 1 }` et `catalogCheckedAt` reste nul.
  - `images.test.ts`, `it("collects the game banner and logo")` : un titre avec `bannerUrl` et `logoUrl` fait télécharger ces deux adresses.
- [ ] **Step 2 :** `npx vitest run src/sync/catalog.test.ts src/sync/images.test.ts` → FAIL.
- [ ] **Step 3 :** implémenter.
  - `collectUrls` ajoute `titles.bannerUrl` et `titles.logoUrl`.
  - `runSync` appelle `syncCatalog(..., "missing", now)` après `syncPlayedGames` et le rafraîchissement de la Task 4, avant `cacheImages`.
  - `runDailyRefresh` appelle `syncCatalog(..., "all", now)` après sa boucle.
- [ ] **Step 4 :** relancer → PASS ; `npx vitest run` ; `npx tsc --noEmit`.
- [ ] **Step 5 :** commit `feat(sync): PSN catalog (publisher, genres, release date) and game images`, puis push.

---

### Task 6 : Fonctions pures de la page

**Files:**
- Modify: `src/lib/format.ts`
- Create: `src/lib/span.ts`, `src/lib/guide-links.ts`, `src/games/detail-stats.ts`
- Test: `src/lib/format.test.ts`, `src/lib/span.test.ts`, `src/lib/guide-links.test.ts`, `src/games/detail-stats.test.ts`

**Interfaces:**
- Produces :
  ```ts
  // src/lib/format.ts
  export function formatTime(d: Date): string; // "01:21", Europe/Paris
  // src/lib/span.ts
  export function formatSpan(from: Date, to: Date, maxUnits?: number): string;
  // src/lib/guide-links.ts
  export function guideSearchName(name: string): string;
  export function powerPyxRoadmapUrl(name: string): string;
  export function psnProfilesGuidesUrl(name: string): string;
  // src/games/detail-stats.ts
  export const TROPHY_POINTS: Record<TrophyType, number>;
  export type ProgressTrophy = { type: TrophyType; earned: boolean };
  export function pointsOf(trophies: ProgressTrophy[]): { total: number; earned: number };
  export function groupProgress(trophies: ProgressTrophy[]): number;
  export function typeCounts(trophies: ProgressTrophy[]): Record<TrophyType, [earned: number, defined: number]>;
  export type RarityStats = { average: number; lowest: number; median: number; highest: number };
  export function rarityStats(rates: (number | null)[]): RarityStats | null;
  export function rarityBreakdownOf(rates: (number | null)[]): Record<RarityTier, number>;
  export type TimelineRow = { label: string; note: string | null; date: string | null; time: string | null };
  export function buildTimeline(earned: { type: TrophyType; earnedAt: Date }[], hasPlatinum: boolean, now: Date): TimelineRow[];
  ```
- Règles de `formatSpan` (spec 8.9) :
  - le calcul se fait sur l'heure de Paris : convertir les deux dates en heure locale de Paris avant de compter ;
  - les années et les mois sont des années et des mois du calendrier, puis viennent semaines, jours, heures et minutes ;
  - `maxUnits` (6 par défaut) garde une fenêtre d'unités **consécutives** à partir de la première non nulle, puis retire les unités nulles ;
  - singulier ou pluriel en anglais (`1 week`, `4 days`), séparés par `, ` ;
  - moins d'une minute donne `less than a minute`.
- `guideSearchName` retire `™`, `®` et `©`, réduit tout espace multiple à un seul, puis rogne les bords.
  - `powerPyxRoadmapUrl` donne `https://www.powerpyx.com/?s=` + `encodeURIComponent(nom + " roadmap")`, avec `%20` remplacé par `+`.
  - `psnProfilesGuidesUrl` donne `https://psnprofiles.com/search/guides?q=` + `encodeURIComponent(nom)`.
- `buildTimeline` :
  - sans trophée obtenu, une seule ligne `{ label: "No trophy earned yet", note: null, date: null, time: null }` ;
  - sinon, dans l'ordre :
    - `First trophy` : note `formatRelative`, avec date et heure ;
    - `Platinum`, si `hasPlatinum` : obtenu, la note est `formatSpan(premier, platine, 3)` avec date et heure ; non obtenu, la note est `Not earned yet` et la date `—` ;
    - `Latest trophy` : note relative, avec date et heure ;
    - `Gap` : note `formatSpan(premier, dernier)`, sans date.

- [ ] **Step 1 : tests qui échouent**, avec les valeurs de la spec :
  - `format.test.ts` : `formatTime(new Date("2022-07-17T23:21:00Z")) === "01:21"`.
  - `span.test.ts` :
    - `formatSpan(new Date("2022-07-06T20:10:57Z"), new Date("2022-07-17T23:21:00Z"), 3) === "1 week, 4 days, 3 hours"` ;
    - `formatSpan(new Date("2022-07-06T20:10:57Z"), new Date("2026-11-07T18:21:58Z")) === "4 years, 4 months, 21 hours, 11 minutes"` (traverse un changement d'heure) ;
    - une durée de 1 an, 0 mois, 2 semaines et 3 jours, avec `maxUnits` 3, donne `"1 year, 2 weeks"` ;
    - un écart de 30 s donne `"less than a minute"`.
  - `guide-links.test.ts` :
    - `powerPyxRoadmapUrl("Gran Turismo 7") === "https://www.powerpyx.com/?s=Gran+Turismo+7+roadmap"` ;
    - `psnProfilesGuidesUrl("Gran Turismo 7") === "https://psnprofiles.com/search/guides?q=Gran%20Turismo%207"` ;
    - `guideSearchName("Assassin's Creed® Odyssey") === "Assassin's Creed Odyssey"` ;
    - `guideSearchName("ASTRO’s PLAYROOM") === "ASTRO’s PLAYROOM"` ;
    - `guideSearchName("  Tales  of Arise™ ") === "Tales of Arise"` ;
    - `guideSearchName("13 Sentinels: Aegis Rim")` reste inchangé ;
    - le décodage de l'adresse PSNProfiles de `"Pokémon Legends: Arceus"` redonne le nom exact.
  - `detail-stats.test.ts` :
    - `groupProgress` de 2 bronzes obtenus sur 13 donne `15` ;
    - 1 bronze obtenu sur 144 (15 / 2160 points) donne `1` ;
    - tout obtenu, platine compris, donne `100` ; rien d'obtenu donne `0` ;
    - `pointsOf` d'un jeu 1 platine, 1 or, 17 argents et 39 bronzes, dont 28 bronzes obtenus avec le reste, donne `{ total: 1485, earned: 1320 }` ;
    - `rarityStats([79.7, null, 2.3, 11.9])` donne `{ average: 31.3, lowest: 2.3, median: 11.9, highest: 79.7 }` à `toBeCloseTo` près, et `rarityStats([null])` donne `null` ;
    - pour un nombre pair de valeurs, la médiane est la moyenne des deux valeurs du milieu ;
    - `rarityBreakdownOf([2.3, 7, 15, 30, 60, null])` donne un trophée dans chacun des 5 paliers ;
    - `buildTimeline` sans trophée donne une seule ligne ; avec un platine non obtenu, la ligne Platinum a la note `"Not earned yet"` et la date `"—"` ; sans platine dans le jeu, elle n'apparaît pas.
- [ ] **Step 2 :** lancer ces quatre fichiers → FAIL.
- [ ] **Step 3 :** implémenter.
- [ ] **Step 4 :** relancer → PASS ; `npx tsc --noEmit`.
- [ ] **Step 5 :** commit `feat(game): durations, guide links and per-game stats`, puis push.

---

### Task 7 : Chargeur de la page (`getGameDetail`)

**Files:**
- Create: `src/games/detail.ts`
- Test: `src/games/detail.test.ts`

**Interfaces:**
- Consumes : Tasks 1 et 6, `mediaSrc` / `ImageMap` (`src/sync/images.ts`), `progressRank` / `gameStatus` (`src/games/row.ts`), `formatDate`, `formatTime`, `formatPercent`, `formatInt`, `formatLastPlayedLine`.
- Produces (JSON sérialisable, aucune `Date`) :
  ```ts
  export type TrophyRowData = {
    id: number; groupId: string; type: TrophyType; name: string; detail: string; iconSrc: string;
    earned: boolean; earnedDate: string | null; earnedTime: string | null; earnedAtMs: number | null;
    rate: number | null; rateLabel: string | null; tier: RarityTier | null;
    counter: string | null; // "3,626/5,000" : non obtenu, objectif ET progression connus
  };
  export type GroupData = {
    id: string; kicker: string; name: string; iconSrc: string; earned: number; total: number;
    counts: Record<TrophyType, [number, number]>; progress: number; rank: GameRank; status: GameStatus;
  };
  export type GameDetail = {
    id: string; name: string; platforms: ("PS4" | "PS5")[];
    coverSrc: string; coverIsIcon: boolean;
    bannerPath: string | null; // chemin relatif à MEDIA_DIR, pour bannerVars ; null = pas encore téléchargée
    logoSrc: string | null;
    metaParts: string[]; // ["47 of 58 trophies", "Last played 8 Nov 2026", "71h 24m played"]
    counts: Record<TrophyType, [number, number]>; progress: number; rank: GameRank; status: GameStatus;
    earnedTotal: number; definedTotal: number; points: { total: number; earned: number };
    groups: GroupData[]; trophies: TrophyRowData[];
    breakdown: Record<RarityTier, number>;
    rarity: { average: string; lowest: string; median: string; highest: string } | null; // "25.81%"
    publisher: string | null; genres: string | null; releaseDate: string | null; // valeurs mises en forme
    guides: { powerPyx: string; psnProfiles: string };
    timeline: TimelineRow[];
  };
  export async function getGameDetail(db: Db, id: string, imageMap: ImageMap, now: Date): Promise<GameDetail | null>;
  ```
- Règles :
  - **Groupes** : `default` d'abord, puis les autres par `groupId` croissant. Le sur-titre vaut `Base game` pour le premier et `DLC 1`, `DLC 2`… ensuite. Le nom vaut le nom du jeu pour `default`, celui du groupe sinon.
  - **État d'un groupe** : `plat-earned` ou `plat-missing` s'il contient le platine ; sinon `complete` à 100 %, et `incomplete` en dessous.
  - **Trophées** : triés par `trophyId`, avec les icônes en miniature (`mediaSrc`). **[décidé]** Les trophées secrets (`hidden`) sont inclus comme les autres, avec leur nom et leur description, obtenus ou non.
  - **Jaquette** : `mediaSrc(coverUrl ?? iconUrl, map, "full")`, et `coverIsIcon` vaut vrai sans `coverUrl`.
  - **Logo** : `mediaSrc(logoUrl, map, "full")`, ou `null` si non téléchargé. **Bannière** : `imageMap.get(bannerUrl)?.path ?? null`.
  - **Genres** : joints par `, `. **Date de sortie** : `formatDate`. Les valeurs inconnues valent `null`.
  - **Progression** : celle du PSN pour le titre (`titles.progress`), et `groupProgress` pour les groupes.
  - Un `id` inconnu renvoie `null`.

- [ ] **Step 1 : tests qui échouent** (PGlite, données insérées directement) :
  - `it("builds the Cyberpunk-like detail")` :
    - un titre avec un groupe `default` (1 platine obtenu) et un groupe `001` (13 bronzes, 2 obtenus) ;
    - attendu : `groups.map(g => g.kicker)` vaut `["Base game", "DLC 1"]`, la progression du DLC vaut `15`, et le nom du jeu de base est celui du jeu.
  - `it("shows a counter only for an unearned trophy with a known target and progress")` :
    - non obtenu, objectif 5000 et progression 3626 → `"3,626/5,000"` ;
    - obtenu → `null` ;
    - non obtenu avec une progression nulle → `null`.
  - `it("falls back cleanly without concept, catalog or downloaded images")` : `bannerPath`, `logoSrc`, `publisher`, `genres` et `releaseDate` valent tous `null`, sans erreur.
  - `it("returns null for an unknown id")`.
- [ ] **Step 2 :** `npx vitest run src/games/detail.test.ts` → FAIL.
- [ ] **Step 3 :** implémenter.
- [ ] **Step 4 :** relancer → PASS ; `npx tsc --noEmit`.
- [ ] **Step 5 :** commit `feat(game): game detail view model`, puis push.

---

### Task 8 : Bannière par page (groupe de routes) et composants partagés

**Files:**
- Move (`git mv`) : `app/(site)/page.tsx`, `app/(site)/settings/` et `app/(site)/[section]/` vers `app/(site)/(banner)/`.
- Create: `app/(site)/(banner)/layout.tsx`, `components/ProgressStack.tsx`, `components/RarityBreakdown.tsx`
- Modify: `app/(site)/layout.tsx`, `components/Banner.tsx`, `components/GameRow.tsx`, `components/RarestPanel.tsx`, `components/SettingsForms.tsx` (import de `settings/actions`), `app/globals.css`
- Test: `components/Banner.test.tsx` (nouveau), `components/RarityBreakdown.test.tsx` (nouveau), plus `components/GameRow.test.tsx` existant

**Interfaces:**
- Produces :
  - `Banner({ hasImage, label = "Custom banner", logo }: { hasImage: boolean; label?: string; logo?: { src: string; alt: string } | null })`. Le logo est un `<img className="hero-logo">` dans `.hero`.
  - `ProgressStack({ counts, progress, rank }: { counts: Record<TrophyType, [number, number]>; progress: number; rank: GameRank })`. C'est le bloc pastilles + barre + % extrait de `GameRow`, avec le même markup (`.right > .chips` + `.progress`).
  - `StatusIcon({ status, size = 28 }: { status: GameStatus; size?: number })`, extrait de `GameRow`.
  - `RarityBreakdown({ breakdown }: { breakdown: Record<RarityTier, number> })`. C'est le bloc `.rarity` extrait de `RarestPanel`.
- Mise en page :
  - `app/(site)/layout.tsx` ne garde que la session, `AuthBanner` et `<div className="shell-top"><TopMenu /></div>` ;
  - `(banner)/layout.tsx` reprend `bannerVars`, `PageBackground` et `Banner` de l'utilisateur, autour de `children` ;
  - les adresses ne changent pas (lire `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route-groups.md`).

- [ ] **Step 1 : tests qui échouent.**
  - `Banner.test.tsx` : avec `logo`, une image `.hero-logo` a le bon `src` et le bon `alt` ; sans, il n'y a pas d'image ; sans bannière, le lien « Choose a banner in Settings » reste.
  - `RarityBreakdown.test.tsx` : les 5 libellés, et les nombres mis en forme (`1,314`).
- [ ] **Step 2 :** lancer → FAIL.
- [ ] **Step 3 :** implémenter et déplacer.
  - **[décidé, spec 8.8]** Dans `globals.css`, `.rgrid` passe à 5 colonnes égales, centrées (`text-align:center`, et `justify-content:center` sur `.rgrid b`), sur les deux pages.
  - `.hero-logo` est porté depuis la maquette, avec `display:none` à 640 px et moins.
- [ ] **Step 4 :** `npx vitest run` (dont `GameRow.test.tsx` inchangé) → PASS ; `npx tsc --noEmit`.
- [ ] **Step 5 :** vérifier dans le navigateur de l'app (configuration `e2e-web`, voir Task 12 pour lancer la base) que `/`, `/settings` et `/stats` ont toujours la bannière de l'utilisateur et le menu par-dessus.
- [ ] **Step 6 :** commit `refactor(site): banner per page via a route group, shared progress and rarity components`, puis push.

---

### Task 9 : Liste des trophées (composant client)

**Files:**
- Create: `src/games/trophy-view.ts`, `components/game/TrophyList.tsx`
- Test: `src/games/trophy-view.test.ts`, `components/game/TrophyList.test.tsx`

**Interfaces:**
- Consumes : `TrophyRowData`, `GroupData` (Task 7), `ProgressStack`, `StatusIcon`, `TrophyTypeIcon`.
- Produces :
  ```ts
  // src/games/trophy-view.ts
  export type TrophyShow = "all" | "earned" | "unearned";
  export type TrophySort = "psn" | "date" | "rarity";
  export function parseTrophyView(params: URLSearchParams): { show: TrophyShow; sort: TrophySort };
  export function trophyViewParams(view: { show: TrophyShow; sort: TrophySort }): URLSearchParams; // valeurs par défaut omises
  export function filterAndSort(rows: TrophyRowData[], show: TrophyShow, sort: TrophySort): TrophyRowData[];
  // components/game/TrophyList.tsx ("use client")
  export function TrophyList(props: { groups: GroupData[]; trophies: TrophyRowData[]; initialShow: TrophyShow; initialSort: TrophySort }): JSX.Element;
  ```
- Règles :
  - **Paramètres d'adresse** : `show` (`earned` ou `unearned`) et `sort` (`date` ou `rarity`). Une valeur inconnue revient au défaut.
  - **Tris** :
    - `psn` : par `id` ;
    - `date` : les obtenus par `earnedAtMs` croissant, puis les non obtenus par `id` ;
    - `rarity` : par `rate` croissant, les `null` en dernier, à égalité par `id`.
  - **Adresse** : un changement de menu met l'adresse à jour avec `window.history.replaceState(null, "", url)`, sans requête serveur (`node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md`, « Native History API »).
  - **Textes exacts** :
    - titre `Trophies`, et `47 of 58 earned` à côté ;
    - menu « Show » : `All trophies`, `Earned`, `Unearned` ;
    - menu « Sort by » (étiquette pour lecteurs d'écran) : `PSN order`, `Date earned`, `Rarest first` ;
    - liste vide : `No trophy matches this filter.`
  - **Groupes** : leurs en-têtes ne s'affichent que si `groups.length > 1`. Un groupe sans ligne visible disparaît.
  - **Ligne** (structure de la maquette v5) :
    - `.trophy.earned` pour un trophée obtenu ;
    - `.when` contient la date et l'heure, ou `.count` (le compteur), ou rien ;
    - `.rate` contient le `rateLabel` et le palier, ou rien.

- [ ] **Step 1 : tests qui échouent.**
  - `trophy-view.test.ts` :
    - chaque tri sur un petit jeu de lignes, dont une rareté `null` (dernière en `rarity`) et deux non obtenus (après les obtenus en `date`) ;
    - `parseTrophyView(new URLSearchParams("show=bogus&sort=rarity"))` donne `{ show: "all", sort: "rarity" }` ;
    - `trophyViewParams({ show: "all", sort: "psn" }).toString() === ""`.
  - `TrophyList.test.tsx` (jsdom) :
    - avec un seul groupe, aucun `.group-head` ; avec deux, deux en-têtes `Base game` et `DLC 1` ;
    - choisir `Unearned` masque les lignes `.earned` et appelle `history.replaceState` avec une adresse qui contient `show=unearned` ;
    - une ligne non obtenue avec `counter: "0/4"` affiche `0/4` dans `.when` ;
    - une ligne obtenue affiche sa date et son heure ;
    - `Earned` sur un jeu sans trophée obtenu affiche `No trophy matches this filter.`
- [ ] **Step 2 :** lancer → FAIL.
- [ ] **Step 3 :** implémenter.
- [ ] **Step 4 :** relancer → PASS ; `npx tsc --noEmit`.
- [ ] **Step 5 :** commit `feat(game): trophy list with groups, filter, sort and tiered counters`, puis push.

---

### Task 10 : Page `/games/[id]`, bandeau, colonne latérale et CSS

**Files:**
- Modify: `app/(site)/games/[id]/page.tsx`, `app/globals.css`
- Create: `components/game/GameBand.tsx`, `components/game/GameInfoPanel.tsx`, `components/game/TimelinePanel.tsx`
- Test: `components/game/GameInfoPanel.test.tsx`, `components/game/TimelinePanel.test.tsx`

**Interfaces:**
- Consumes : `getGameDetail` (Task 7), `Banner`, `PageBackground`, `bannerVars`, `ProgressStack`, `StatusIcon`, `RarityBreakdown` (Task 8), `TrophyList` et `parseTrophyView` (Task 9), `AutoRefresh`, `getSyncStatus`, `getSettings`, `loadImageMap`.
- Produces : `GameBand({ detail })`, `GameInfoPanel({ detail })` et `TimelinePanel({ rows })`, tous composants serveur.
- **`GameBand`** : `section.gband.glass` qui contient :
  - le `h1` du nom et les badges `.platform`, comme dans `GameRow` ;
  - la ligne `.gmeta`, avec les `metaParts` séparés par `.sep` ;
  - `ProgressStack` ;
  - `StatusIcon` en 32 px.
- **Page** :
  - `requireSession()`, puis `notFound()` si `getGameDetail` renvoie `null` ;
  - enveloppe `<div className="game-page" style={bannerVars(...)}>` :
    - `bannerVars(detail.bannerPath, 25)` si la bannière du jeu est là ;
    - sinon la bannière de Games, `getPageBanner(db)` (Task 14) : `bannerVars(banner?.path ?? null, banner?.posY ?? 50)` ;
  - `PageBackground` s'il y a une image ;
  - `Banner` avec `label` = nom du jeu, et `logo` seulement si la bannière du jeu **et** le logo sont là ;
  - `main.wrap` : `GameBand`, puis `.layout` avec `TrophyList` et `aside.side` (jaquette, `GameInfoPanel`, `TimelinePanel`) ;
  - `<AutoRefresh active={sync.status === "queued" || sync.status === "running"} />`.
- **`GameInfoPanel`** (textes exacts) :
  - `Total` puis `58 trophies · 1,485 points` avec les pastilles du nombre défini ;
  - `Earned` puis `47 trophies · 1,320 points` avec les pastilles du nombre obtenu ;
  - `RarityBreakdown` ;
  - liste `dl` : `Publisher`, `Genre`, `Release date` (chaque ligne est omise si sa valeur est `null`) ;
  - `Avg. rarity` : la moyenne, puis la ligne `.spread` avec trois `span` titrés `Lowest`, `Median` et `Highest` (séparés par ` · `), ligne omise si `rarity` est `null` ;
  - `Guides` : `PowerPyx roadmap` et `PSNProfiles guides`, avec `target="_blank"` et `rel="noopener"`.
- **`TimelinePanel`** : un panneau titré `Timeline`, une ligne par `TimelineRow`.
- **CSS** :
  - porter depuis la maquette v5 les règles `.gband`, `.gtitle`, `.gmeta`, `.group-head`, `.trophy`, `.meta`, `.when`, `.count`, `.rate`, `img.ti`, `.empty-list`, `.cover`, `.block`, `.totals`, `.kv`, `.spread`, `.dates`, la requête de conteneur `.trophies-panel`, et les règles responsives (980 / 640 px) ;
  - **toutes sont préfixées par `.game-page`**, pour ne pas toucher Games, dont les classes `.layout`, `.chips` et `.status` ont d'autres valeurs ;
  - `.game-page .layout` passe à `grid-template-columns: minmax(0,1fr) 320px` ;
  - `.game-page .rgrid` garde `gap:2px`, et ses libellés passent à `9.5px` avec `white-space:nowrap` ;
  - `.game-page .cover.icon` utilise `object-fit:contain`.
  - **[décidé]** Le fond sombre ne s'applique qu'à l'icône du groupe (`.group-head > img`, enfant direct), jamais à l'icône de platine de l'en-tête (défaut de la maquette v3).

- [ ] **Step 1 : tests qui échouent.**
  - `GameInfoPanel.test.tsx` :
    - les deux lignes de totaux, avec les valeurs ci-dessus ;
    - sans `publisher`, aucun `dt` « Publisher » ;
    - les trois valeurs de la ligne `.spread` portent les titres `Lowest`, `Median` et `Highest` ;
    - les deux liens de guides ont les adresses de `detail.guides`.
  - `TimelinePanel.test.tsx` : la ligne Platinum non obtenue affiche `Not earned yet` et `—`.
- [ ] **Step 2 :** lancer → FAIL.
- [ ] **Step 3 :** implémenter la page, les composants et le CSS.
- [ ] **Step 4 :** `npx vitest run` → PASS ; `npx tsc --noEmit`.
- [ ] **Step 5 :** vérifier dans le navigateur de l'app, avec les vraies données (Task 12, étapes 1 à 3), que Cyberpunk 2077 PS5 correspond à la maquette v5 à 1 630 px de large : bannière, logo, bandeau, groupes, compteurs, colonne de 320 px et Timeline.
- [ ] **Step 6 :** commit `feat(game): game detail page`, puis push.

---

### Task 11 : Retour sur la liste Games à la même position

**Files:**
- Create: `components/list-snapshot.ts`
- Modify: `components/GameList.tsx`, `app/(site)/(banner)/page.tsx`
- Test: `components/GameList.test.tsx`

**Interfaces:**
- Produces (`components/list-snapshot.ts`, côté client) :
  ```ts
  export type ListSnapshot = { key: string; items: GameRowData[]; total: number; scrollY: number };
  export function saveListSnapshot(s: ListSnapshot): void;        // sessionStorage "games-list", erreurs ignorées
  export function takeListSnapshot(key: string): ListSnapshot | null;
  ```
- `takeListSnapshot` renvoie l'instantané **seulement** si les deux conditions suivantes sont réunies. Dans tous les cas, il efface l'instantané et remet l'indicateur à faux.
  - Un évènement `popstate` a eu lieu depuis le dernier appel. Un écouteur est posé une fois au chargement du module.
  - La clé correspond.
- `GameList` reçoit `snapshotKey: string`.
  - La page lui passe la même chaîne que sa `key` actuelle : filtres, tri, recherche et `sync.lastSuccessAt`.
  - Un clic sur une ligne de jeu enregistre `{ key, items, total, scrollY: window.scrollY }`.
  - Au montage, un instantané rendu par `takeListSnapshot` remplace les lignes et le total, puis la page défile à `scrollY` une fois ces lignes rendues.

- [ ] **Step 1 : tests qui échouent** (`GameList.test.tsx`, jsdom, `window.scrollTo` espionné) :
  - `it("restores the loaded games and the scroll position after a back navigation")` : instantané de 120 lignes, puis `dispatchEvent(new PopStateEvent("popstate"))`, puis montage → 120 lignes et `scrollTo(0, 4200)`.
  - `it("starts from the top on a fresh visit")` : même instantané sans `popstate` → 50 lignes, et l'instantané est effacé.
  - `it("ignores a snapshot taken with other filters or before a sync")` : clé différente → 50 lignes.
- [ ] **Step 2 :** `npx vitest run components/GameList.test.tsx` → FAIL.
- [ ] **Step 3 :** implémenter.
- [ ] **Step 4 :** relancer → PASS ; `npx vitest run` ; `npx tsc --noEmit`.
- [ ] **Step 5 :** commit `feat(games): come back to the same place in the list`, puis push.

---

### Task 12 : Vérification avec les vraies données et documentation

**Files:**
- Modify: `docs/ETAT-DU-PROJET.md`, `docs/superpowers/plans/2026-11-08-phase1-suivis.md`

- [ ] **Step 1 :** lancer `npm run e2e:db` (à laisser tourner), puis `npm run e2e:worker`. Le worker applique la migration 0004. Le token est déjà enregistré dans `.data/`.
- [ ] **Step 2 :** lancer une synchro complète.
  - Dans Settings, utiliser « Sync now », ou attendre la synchro de démarrage.
  - Lancer ensuite le rafraîchissement quotidien une fois : `npm run e2e:sql -- "update job_state set last_run_at = null where key = 'daily'"`. Le worker le prend au tour suivant de son minuteur.
  - Vérifier avec `npm run e2e:sql` :
    - `select count(*) from titles where banner_url is not null` donne environ 259 ;
    - `select count(*) from titles where publisher is not null` donne environ 259 ;
    - `select count(*) from trophies where progress_target is not null` est supérieur à 0.
- [ ] **Step 3 :** ouvrir la configuration « e2e-web » du navigateur de l'app et se connecter avec l'identifiant de test (`.data/e2e.env`, ligne 2).
- [ ] **Step 4 :** contrôler, à 1 630 px puis en mode mobile :
  - **Cyberpunk 2077 PS5** :
    - 86 % et `47 of 58 trophies` ;
    - `58 trophies · 1,485 points` et `47 trophies · 1,320 points` ;
    - DLC 1 « Phantom Liberty » à 15 % ;
    - Platinum `1 week, 4 days, 3 hours` ;
    - un Gap qui part du 6 Jul 2022, 22:10 ;
    - les deux liens de guides ouvrent les bonnes recherches.
  - **Gran Turismo 7 PS5** : `Not earned yet`, et le lien `Gran+Turismo+7+roadmap`.
  - **FINAL FANTASY XIV Online** : 17 groupes, et des compteurs comme `3,626/5,000`.
  - **Phantom Blade Zero** : `0/3`, `0/4`, et `No trophy earned yet`.
  - **Dauntless** (sans concept) : la bannière de l'utilisateur, sans logo ni Publisher.
  - **Adresses** : `/games/INCONNU` donne la page 404. `?show=unearned&sort=rarity` survit au rechargement.
  - **Retour à la liste** : depuis Games, faire défiler jusqu'au 120e jeu, l'ouvrir, puis faire « précédent ». La liste revient au même endroit.
  - **Page Games** : la répartition par rareté est centrée.
- [ ] **Step 5 :** mettre à jour `docs/ETAT-DU-PROJET.md`. La page de détail est faite, et la phase 1 est terminée une fois la PR fusionnée. La suite est le déploiement et les pages suivantes.
- [ ] **Step 6 :** commit `docs: game detail page done`, puis push.

---

## Tâches ajoutées pendant l'exécution (8 novembre 2026)

Ordre d'exécution : Task 13 et Task 14 passent **après la Task 9 et avant la Task 10**.

### Task 13 : Rattrapage des objectifs des trophées à paliers

Les objectifs viennent des définitions des trophées, qui ne sont lues qu'au rechargement d'un jeu (`syncTitle`). Les listes déjà synchronisées et inchangées n'auraient donc jamais d'objectif, ni de compteur.

**Files:**
- Create: `src/db/migrations/0005_*.sql` et son snapshot (via `npx drizzle-kit generate --custom --name=reload_ps5_lists`)

- [ ] **Step 1 :** générer une migration vide avec `--custom`, puis y écrire seulement :
  ```sql
  UPDATE "titles" SET "synced_at" = NULL WHERE "np_service_name" = 'trophy2';
  ```
  `titleNeedsReload` traite un `syncedAt` nul comme « à recharger ». La synchro suivante recharge donc une fois chaque liste PS5 (environ 130), et lit leurs objectifs. `syncedAt` ne sert à rien d'autre.
- [ ] **Step 2 :** `npx vitest run` (les migrations s'appliquent sur PGlite) et `npx tsc --noEmit` → PASS. Pas de test unitaire dédié : c'est une mise à jour de données, vérifiée sur les vraies données en Task 12.
- [ ] **Step 3 :** commit `fix(db): reload PS5 lists once to read their tiered trophy targets`, puis push.

### Task 14 : Bannière automatique de Games (spec 8.2 et 9)

**Files:**
- Create: `src/settings/page-banner.ts`
- Modify: `app/(site)/(banner)/layout.tsx`, `app/(site)/(banner)/settings/page.tsx`, `components/SettingsForms.tsx`
- Test: `src/settings/page-banner.test.ts`, `components/SettingsForms.test.tsx` (nouveau ou existant)

**Interfaces:**
- Produces :
  ```ts
  // src/settings/page-banner.ts
  export type PageBanner = { path: string; posY: number; source: "custom" | "auto"; gameName: string | null };
  export async function getPageBanner(db: Db): Promise<PageBanner | null>;
  ```
- Règles de `getPageBanner` :
  - une bannière personnalisée (`settings.bannerPath`) donne `{ path, posY: settings.bannerPosY, source: "custom", gameName: null }` ;
  - sinon, le titre non caché le plus récemment joué (`lastPlayedAt` décroissant, nuls en dernier) dont la bannière (`titles.bannerUrl`) est **téléchargée** (ligne `images` avec `localPath` non nul) donne `{ path: images.localPath, posY: 25, source: "auto", gameName: titles.name }`. Une seule requête avec jointure : ne pas charger toute la table `images` ;
  - sinon `null`.
- `(banner)/layout.tsx` : `bannerVars(banner?.path ?? null, banner?.posY ?? 50)`, `PageBackground` et `Banner hasImage={banner !== null}`.
- La page d'un jeu (Task 10) prend `getPageBanner` comme repli quand le jeu n'a pas de bannière téléchargée.
- **Settings** : `BannerForm` reçoit en plus `auto: { url: string; gameName: string } | null`, la bannière automatique du moment.
  - Sans bannière personnalisée, l'aperçu montre `auto`, avec la mention exacte `Automatic — last played game (<gameName>)`.
  - Le bouton de remise à zéro s'appelle `Use automatic banner`.
  - Le curseur de position reste désactivé sans bannière personnalisée.

- [ ] **Step 1 : tests qui échouent.**
  - `page-banner.test.ts` :
    - une bannière personnalisée gagne, avec sa position ;
    - sinon, le jeu joué le plus récemment qui a une bannière téléchargée, avec `posY: 25` et son nom ;
    - un jeu caché, ou dont la bannière n'est pas téléchargée, est ignoré au profit du suivant ;
    - aucun candidat → `null`.
  - `SettingsForms.test.tsx` : sans bannière personnalisée et avec `auto`, la mention `Automatic — last played game (Cyberpunk 2077)` et le bouton `Use automatic banner` sont présents.
- [ ] **Step 2 :** lancer → FAIL.
- [ ] **Step 3 :** implémenter.
- [ ] **Step 4 :** `npx vitest run` → PASS ; `npx tsc --noEmit` ; `npm run build`.
- [ ] **Step 5 :** commit `feat(site): automatic Games banner from the last played game`, puis push.

### Task 15 : Tri par défaut de Games = « Last trophy » (spec 8.7)

Ordre d'exécution : avec la Task 13, avant la Task 14.

**Files:**
- Modify: `src/games/query.ts`, `components/game-query-string.ts`
- Test: `src/games/query.test.ts`, et le test existant de `game-query-string` ou de `GameFilters` qui couvre l'omission du tri par défaut

- [ ] **Step 1 : tests qui échouent.**
  - `parseGameQuery(new URLSearchParams(""))` donne `sort: "lastTrophy"` ;
  - `parseGameQuery(new URLSearchParams("sort=lastPlayed"))` donne `sort: "lastPlayed"` ;
  - `gameQueryParams` omet `sort` pour `lastTrophy` et écrit `sort=lastPlayed` pour `lastPlayed`.
- [ ] **Step 2 :** lancer → FAIL.
- [ ] **Step 3 :** changer la valeur par défaut dans `parseGameQuery` et dans `gameQueryParams`. L'ordre des options de `GameFilters` ne change pas. Adapter les tests existants qui supposaient `lastPlayed` par défaut.
- [ ] **Step 4 :** `npx vitest run` → PASS ; `npx tsc --noEmit`.
- [ ] **Step 5 :** commit `feat(games): default sort is last trophy`, puis push.
