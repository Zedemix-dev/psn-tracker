# PSN Tracker : fin de l'audit hors design (branche `fix/audit-suite`), Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** finir tous les points restants de `a_reprendre.md` sauf le design : S7, P2, P3, P4, P6, P7, R3, Q1 à Q7, P5, S8, S9 (plus Dependabot), S10 étant déjà noté en spec 14.5.

**Architecture :**
- **Base** (tâche 1) : migration 0010 (npsso supprimé, date d'application des non obtenables) et marqueur de cache qui la lit.
- **Site** (tâches 2, 3, 7, 8, 9) : caches Stats et liste des jeux, page d'un jeu qui ne se redessine qu'en fin de run, CSS découpé, Games sur `ProgressiveList`, police locale.
- **Worker** (tâche 4) : couleur de tuile limitée aux icônes, historique limité à 500 runs, images au rafraîchissement quotidien.
- **Outillage** (tâches 5, 6, 10, 11, 12) : ESLint, doublons et nettoyages, Vitest plus rapide, versions figées et Dependabot, conteneurs durcis et leur test en CI.
- **Contrôleur** (C1, C2, tâches 14 et 15) : relevé des styles avant et après le découpage du CSS, mesure des pics de mémoire, vérification avec les vraies données, documents.

**Tech Stack :** Next.js 16 (App Router), React 19, TypeScript strict, Drizzle (PostgreSQL 16, PGlite en test), sharp, Vitest + jsdom, ESLint (flat config), Docker Compose (Portainer), GitHub Actions, Dependabot.

**Spec :** [section 21](../specs/2026-11-07-psn-tracker-design.md) (et 5, 14.5, 19.4, 19.5.3). Là où le plan diffère de la spec, **la spec fait foi**.

## Global Constraints

- **Git** : branche `fix/audit-suite`. **Après chaque commit, push.** Messages en anglais, terminés par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Ne jamais commiter `.claude/launch.json`, `.data/` ni `.superpowers/`. Ne jamais utiliser `git stash`.
- **Langues** : code, textes du site et commits en anglais ; spec, guide et `docs/ETAT-DU-PROJET.md` en français.
- **Dépendances** : seules nouveautés permises : `eslint` et `eslint-config-next` en développement (tâche 5). Mises à jour permises : celles de la tâche 11, rien de majeur.
- **Next.js 16** : lire `AGENTS.md` et les guides de `node_modules/next/dist/docs/` avant d'écrire du code Next (fonts, CSS, config).
- **Windows** : en Git Bash, `export PATH="/c/Program Files/nodejs:$PATH"` ; le chemin du dépôt contient `!`, le mettre entre apostrophes. Pas de Docker sur ce PC.
- **Tests** : `npx vitest run <fichier>` pendant le travail ; avant chaque commit de code, la suite complète (`npx vitest run`, 4 à 5 minutes, en arrière-plan) et `npx tsc --noEmit` ; à partir de la tâche 5, aussi `npm run lint`. Ne jamais lancer `next build`, `next dev`, `npm run e2e:*` ni le worker : le contrôleur s'en charge.
- **Rien ne change à l'écran** (spec 21.1) : les tests existants passent avec leurs assertions inchangées, sauf mention dans la tâche.
- **Caches au niveau du module** : toujours indexés par l'instance `Db` (`WeakMap`), sinon les tests PGlite se contaminent. Une valeur sortie d'un cache n'est jamais modifiée par l'appelant.
- **Valeurs exactes** : 500 runs gardés (P7) ; limites de conteneur fixées par le contrôleur (C2) ; `worker` au plus 1 cœur, `app` au plus 2 ; plafond du tas Node à environ 75 % de la limite mémoire.

## Review Focus

Chaque ligne a son test dans la tâche indiquée.

1. **Un objet sorti d'un cache est modifié par un appelant** (un `sort()` en place sur un tableau de l'index des jeux, par exemple) et corrompt les pages suivantes (tâche 2).
2. **Données périmées** : après la fin d'un run, après `applyUnobtainable` (lancé après chaque run et après un téléchargement de liste) et après minuit à Paris pour Stats, la page suivante relit la base (tâches 1 et 2).
3. **Run court non vu** : un run commencé et fini entre deux interrogations, ou fini en erreur, fait quand même redessiner la page d'un jeu (tâche 3).
4. **Retour arrière Games** : après « Show all » ou après trois pages chargées, revenir d'une page de jeu recharge autant de lignes et retrouve la même ligne ; une page entière de doublons ne bloque pas le chargement (tâche 8).
5. **Élagage de `sync_runs`** : le run qui vient de finir n'est jamais supprimé, un échec d'élagage ne change pas le résultat du run, et le marqueur du cache change toujours à la fin d'un run même quand la table reste à 500 lignes (tâche 4).

---

### Tâche 1 : S7, migration 0010 et marqueur des non obtenables

**Files:**
- Modify: `src/db/schema.ts` (`settings.npssoEnc` retiré ; `unobtainableList.appliedAt` ajouté, `ts("applied_at")`)
- Create: `src/db/migrations/0010_*.sql` (+ journal et snapshot, par `npx drizzle-kit generate --name=npsso_out_applied_at`)
- Modify: `src/settings/repo.ts` (`savePsnTokens`), `src/psn/tokens.ts` (`connectWithNpsso`), `src/unobtainable/apply.ts`, `src/lib/per-sync-cache.ts` (`readMarker`)
- Test: `src/settings/repo.test.ts`, `src/psn/tokens.test.ts`, `src/unobtainable/apply.test.ts` (ou le fichier de test existant d'`applyUnobtainable`), `src/lib/per-sync-cache.test.ts`

**Interfaces:**
- `savePsnTokens(db, key, tokens, npssoSetAt?: Date)` : le quatrième paramètre devient la date du collage ; rien d'autre du npsso n'est reçu ni écrit. `connectWithNpsso` passe `now`.
- `applyUnobtainable(db)` : quand il écrit les marques, il écrit aussi `unobtainable_list.applied_at = now` dans la même transaction (ligne `id = 1` créée si besoin). S'il sort tôt sans rien écrire, il n'écrit pas la date.
- `readMarker(db)` : `${dernier finished_at}:${nombre de runs}:${applied_at ou "none"}`.

- [ ] **Step 1 : tests** :
  - `saves the npsso date but never the npsso` : après `connectWithNpsso`, la ligne `settings` n'a plus de colonne `npsso_enc` (le type Drizzle ne l'a plus) et `npssoSetAt` vaut `now` ; remplacer le test de `repo.test.ts:98` qui vérifiait le chiffrement du npsso.
  - `applyUnobtainable stamps applied_at with its writes` et `does not stamp when there is nothing to apply`.
  - `the cache marker changes when the unobtainable list is applied` : une valeur mise en cache par `cachedUntilNextRun`, puis `applyUnobtainable` → le chargement suivant relit.
- [ ] **Step 2 : lancer** les fichiers : échec.
- [ ] **Step 3 : implémenter**, puis générer la migration et vérifier son SQL : `ALTER TABLE "settings" DROP COLUMN "npsso_enc"` et `ALTER TABLE "unobtainable_list" ADD COLUMN "applied_at" timestamp with time zone`. Mettre à jour `scripts/pg-smoke.ts` s'il lit `npsso_enc` (il ne devrait pas).
- [ ] **Step 4 : lancer** les fichiers, puis la suite complète et `npx tsc --noEmit`.
- [ ] **Step 5 : commit et push** : `feat: stop storing the npsso, stamp each unobtainable apply (migration 0010)`.

### Tâche 2 : P2 et P3, Stats et index des jeux en mémoire

**Files:**
- Modify: `src/lib/per-sync-cache.ts`, `src/stats/load.ts`, `src/games/siblings.ts`, `app/(site)/(banner)/stats/page.tsx` (seulement si sa lecture de `imageMap` devient inutile)
- Test: `src/lib/per-sync-cache.test.ts`, `src/stats/load.test.ts` (ou le test existant de `getStatsData`), `src/games/siblings.test.ts`

**Interfaces:**
- Consumes : le marqueur de la tâche 1.
- `cachedUntilNextRun<T>(db, key, load, validity = "")` : une entrée n'est reprise que si le marqueur **et** `validity` sont identiques ; sinon elle est remplacée sous la même clé (jamais une clé par jour).
- `getStatsData(db, opts)` garde sa signature et passe par `cachedUntilNextRun(db, \`stats:${hideZero}\`, …, parisDay(now))`, où `parisDay(now)` est la date `YYYY-MM-DD` à l'heure `Europe/Paris`. Le calcul lui-même devient `computeStatsData` (non exporté, ou exporté pour les tests).
- `loadSiblingIndex(db)` garde sa signature et passe par `cachedUntilNextRun(db, "sibling-index", …)`.

- [ ] **Step 1 : tests** :
  - `reuses an entry only while marker and validity match` et `replaces the entry when validity changes, without growing` (une seule entrée pour la clé après deux jours).
  - `getStatsData reads the earned trophies once per run and per Paris day` : deux appels le même jour → une lecture ; un appel après minuit à Paris (par exemple `2026-11-12T23:30:00Z`, déjà le 13 à Paris) → une nouvelle lecture.
  - `loadSiblingIndex is reused until a run ends`.
  - **Review Focus 1** : relire chaque appelant de `loadSiblingIndex` (`src/games/query.ts`, `src/games/detail.ts`, `src/trophy-log/load.ts`, `src/trophy-advisor/load.ts`, `src/stats/load.ts`) et `getStatsData` ; aucun ne doit modifier en place la `Map`, ses tableaux ou ses lignes. Test `callers do not mutate the cached sibling index` : après un appel de chaque chargeur, l'index en cache est égal (`toEqual`) à une copie prise avant.
- [ ] **Step 2 : lancer** les fichiers : échec.
- [ ] **Step 3 : implémenter.** Si un appelant trie en place, il trie une copie.
- [ ] **Step 4 : lancer** les fichiers, la suite complète et `npx tsc --noEmit`.
- [ ] **Step 5 : commit et push** : `perf: keep Stats data and the sibling index until the next run`.

### Tâche 3 : P4, la page d'un jeu ne se redessine qu'en fin de run

**Files:**
- Modify: `src/sync/requests.ts` (`getSyncStatus`), `components/AutoRefresh.tsx` (ou nouveau `components/RefreshOnRunEnd.tsx`), `app/(site)/games/[id]/page.tsx`
- Test: `src/sync/requests.test.ts`, test du composant (jsdom)

**Interfaces:**
- `SyncStatus` gagne `lastFinishedAt: string | null` : la fin du dernier run terminé, quel que soit son statut.
- Le composant interroge `/api/sync` (`cache: "no-store"`) toutes les 3 s tant que le statut est `queued` ou `running`, toutes les 60 s sinon, jamais quand l'onglet est caché ; il appelle `router.refresh()` seulement quand `lastFinishedAt` change par rapport à l'interrogation précédente. La page lui passe le `lastFinishedAt` du rendu serveur comme valeur de départ.
- Settings garde `AutoRefresh` tel quel.

- [ ] **Step 1 : tests** : `getSyncStatus returns the end of the latest finished run, success or error` ; composant : `refreshes once when a run ends in success`, `refreshes once when a run ends in error`, `refreshes when a whole run happened between two idle polls` (Review Focus 3), `never refreshes while nothing ends`, `does not poll while the tab is hidden`.
- [ ] **Step 2 : lancer** : échec. **Step 3 : implémenter.** **Step 4 : lancer**, suite complète, `tsc`.
- [ ] **Step 5 : commit et push** : `perf: redraw a game page only when a sync run ends`.

### Tâche 4 : P6, P7 et R3, côté worker

**Files:**
- Modify: `src/sync/image-cache.ts` (`cacheImages`), `src/sync/run.ts` (`executeRun`), `src/sync/daily.ts` (`runDailyRefresh`)
- Test: `src/sync/image-cache.test.ts`, `src/sync/run.test.ts`, `src/sync/daily.test.ts`

**Interfaces:**
- **P6** : la recherche des images sans couleur de tuile ne retient que les adresses présentes dans `titles.icon_url` ou `trophy_groups.icon_url`. Les autres images gardent `tile_checked_at` vide et ne sont jamais traitées.
- **P7** : `export const KEEP_SYNC_RUNS = 500` ; après `writeFinal` (succès comme échec), `executeRun` supprime les runs dont l'identifiant n'est pas parmi les 500 plus grands. Une erreur d'élagage est avalée (comme celle de `writeFinal`) et ne change pas le résultat du run.
- **R3** : à la fin du corps de `runDailyRefresh`, avant le statut final, `cacheImages(db, cfg.mediaDir, deps?.fetchImpl)` est appelé, même si des jeux ont échoué, avec la même ligne de journal que la synchro (`[worker] images: …`). Jamais `pruneImages`.

- [ ] **Step 1 : tests** : `computes tile colours only for list and group icons` (une bannière et une icône de trophée restent sans `tile_checked_at`) ; `keeps the 500 newest runs and never the one that just ended`, `a failed prune leaves the run result unchanged`, `the cache marker still changes when the table stays at 500 rows` (Review Focus 5) ; `the daily refresh downloads the images of a reloaded title` et `the daily refresh never prunes images`.
- [ ] **Step 2 : lancer** : échec. **Step 3 : implémenter.** **Step 4 : lancer**, suite complète, `tsc`.
- [ ] **Step 5 : commit et push** : `perf: tile colours for icons only, keep 500 sync runs, fetch images in the daily refresh`.

### Tâche 5 : Q1, ESLint

**Files:**
- Create: `eslint.config.mjs`
- Modify: `package.json` (`eslint`, `eslint-config-next` en `devDependencies` ; script `"lint": "eslint ."`), `package-lock.json`, `.github/workflows/docker.yml` (job `test` : `npm run lint` après `npm ci`, avant Vitest), les fichiers signalés
- Test : `npm run lint`

**Interfaces:**
- Configuration : `eslint-config-next/core-web-vitals` et `eslint-config-next/typescript` (guide `node_modules/next/dist/docs/01-app/03-api-reference/05-config/03-eslint.md`), ignorés en plus : `.data/**`, `.superpowers/**`, `dist/**`, `src/db/migrations/**`.

- [ ] **Step 1 : installer** (`npm i -D eslint eslint-config-next`) et écrire la configuration ; lancer `npm run lint`, noter le nombre d'erreurs et d'avertissements par règle dans le rapport.
- [ ] **Step 2 : corriger** chaque signalement sans changer le comportement. Une désactivation n'est permise que sur une ligne précise, sous la forme `// eslint-disable-next-line <règle> -- <raison>`. Revoir les 20 désactivations existantes : retirer celles devenues inutiles, ajouter une raison aux autres. En particulier `components/GameFilters.tsx:74` et `components/plat-wall/PlatWallControls.tsx:70` (`react-hooks/exhaustive-deps`) : corriger les dépendances si c'est sans effet de bord, sinon garder la désactivation avec sa raison.
- [ ] **Step 3 : lancer** `npm run lint` (0 erreur, 0 avertissement), la suite complète et `tsc`.
- [ ] **Step 4 : commit et push** : `chore: add ESLint with the Next config, run it in CI`. Si les corrections dépassent 30 fichiers, les commiter à part (`fix: lint findings`) et le signaler en DONE_WITH_CONCERNS.

### Tâche 6 : Q2, Q4 et Q5, petits nettoyages

**Files:**
- Create: `src/lib/pick.ts` (`pick`), `src/lib/escape-like.ts` (`escapeLike`)
- Modify: `src/games/query.ts`, `src/plat-wall/query.ts`, `src/trophy-advisor/query.ts`, `src/trophy-log/query.ts`, `src/cabinet/repo.ts` (importe `escapeLike` et `earnedVisible`), `src/stats/trophies.ts` (garde l'unique `earnedVisible`, exporté), `src/stats/milestones.ts` et `src/sync/title.ts` (paramètre `_now` retiré, appelants mis à jour), `next.config.ts` (commentaire)
- Test : tests existants ; `src/lib/pick.test.ts` et `src/lib/escape-like.test.ts`

**Interfaces:**
- `pick<T extends string>(allowed: readonly T[], value: string | null, fallback: T): T` et `escapeLike(s: string): string`, inchangés.
- Q5 : le commentaire de `next.config.ts` dit que les en-têtes passent par `headers()` parce que le proxy ne voit pas `_next/static` ni le favicon ; la page de connexion, elle, passe par le proxy.

- [ ] **Step 1 : tests** : `pick returns the value when allowed, else the fallback` ; `escapeLike escapes backslash, percent and underscore`.
- [ ] **Step 2 : déplacer** les fonctions, retirer `_now`, corriger le commentaire.
- [ ] **Step 3 : lancer** les tests touchés, la suite complète, `tsc` et `npm run lint`.
- [ ] **Step 4 : commit et push** : `refactor: share pick, escapeLike and earnedVisible, drop unused params, fix a config comment`.

### C1 (contrôleur, avant la tâche 7) : relevé des styles de référence

- [ ] Arrêter le worker (aucune synchro entre les deux relevés). `npm run build`, `npm run e2e:prod`, connexion dans le navigateur de l'app.
- [ ] Sur Games, une page de jeu, Plat Wall, Trophy Log, Trophy Advisor, Stats, Settings et la page de connexion, à 1 630 puis à 375 px : désactiver animations et transitions par une feuille injectée, attendre la fin du chargement, puis relever pour chaque élément, dans l'ordre du document, son chemin et toutes les propriétés de `getComputedStyle`. Garder une empreinte par page et largeur, et le relevé complet dans `.data/styles-before/`.

### Tâche 7 : Q7, `globals.css` découpé par page

**Files:**
- Modify: `app/globals.css` (ne garde que la base commune), les `page.tsx`, `layout.tsx` ou composants qui importent leur fichier
- Create: `app/styles/*.css` (un fichier par page ou zone : `games.css`, `game.css`, `plat-wall.css`, `trophy-log.css`, `trophy-advisor.css`, `stats.css`, `settings.css`, `login.css`, ou le découpage que le builder juge le plus clair)

**Interfaces:**
- Pas de modules CSS, aucun nom de classe ne change. L'ordre des règles qui se recouvrent est conservé : une règle de page qui surcharge une règle commune vient toujours après elle.
- Les règles partagées par plusieurs pages (lignes de trophées, contrôles des listes, tuile, infobulles…) restent dans la base commune ou dans un fichier partagé importé par chaque page qui s'en sert.

- [ ] **Step 1 : découper**, en notant dans le rapport quelle règle va où.
- [ ] **Step 2 : lancer** la suite complète (certains tests lisent `app/globals.css`, comme `app/icon-backgrounds.test.ts` : les adapter pour lire tous les fichiers CSS), `tsc` et `npm run lint`.
- [ ] **Step 3 : commit et push** : `refactor: split globals.css per page`. Le contrôleur reconstruit le build, refait le relevé de C1 et compare : **aucune différence** sur aucune page à aucune largeur. Une différence est corrigée dans cette tâche.

### Tâche 8 : Q3, Games sur `ProgressiveList`

**Files:**
- Modify: `components/ProgressiveList.tsx` (paramètres), `components/GameList.tsx`, `src/games/query.ts` (`queryGames` applique `limit`), `app/api/games/route.ts`, les appelants de `ProgressiveList` (Trophy Log, Trophy Advisor) si un paramètre devient obligatoire
- Delete: `components/list-snapshot.ts` (et son test)
- Test: `components/GameList.test.tsx` (réécrit), `components/ProgressiveList.test.tsx`, `src/games/query.test.ts`, `app/api/games/route.test.ts`

**Interfaces:**
- `ProgressiveList` gagne des paramètres avec les valeurs actuelles par défaut, pour que Trophy Log et Trophy Advisor ne changent pas : `rowKey(row: T): string` (défaut : `row.key`), `rowSelector` (défaut : `.log-row[data-key]`, et l'attribut lu pour la clé), `noun` (défaut : `"trophies"`, utilisé dans « Couldn't load more … » et « The next 50 … load… »), `className` du conteneur (défaut : aucune). Games passe `rowKey: (g) => g.id`, son sélecteur de ligne (`a.game` avec un `data-key`, à ajouter à `GameRow` s'il manque), `noun: "games"`, `className: "stacked"`.
- `queryGames(db, query, { hideZero, all, limit?, offset? })` : `limit` (au plus `ALL_LIMIT`) remplace `PAGE_SIZE` quand il est fourni ; `/api/games` le transmet.
- Le comportement de Games reste celui de 19.5.3 et 14.6 : pages de doublons sautées, `offset` qui peut avancer plus vite que le nombre de lignes affichées, fin de liste.

- [ ] **Step 1 : tests** : réécrire les tests de retour arrière de `GameList.test.tsx` sur la nouvelle liste, mêmes cas qu'avant plus **Review Focus 4** (`restores the same rows and position after Show all`, `restores after three loaded pages`, `keeps loading past a page made only of duplicates`) ; `ProgressiveList keeps the trophy defaults` ; `queryGames honours limit up to ALL_LIMIT` ; `/api/games passes limit through`.
- [ ] **Step 2 : lancer** : échec. **Step 3 : implémenter.** **Step 4 : lancer**, suite complète, `tsc`, `npm run lint`.
- [ ] **Step 5 : commit et push** : `refactor: run the Games list on ProgressiveList`.

### Tâche 9 : Q6, police locale

**Files:**
- Modify: `app/layout.tsx`
- Test : `app/layout.test.tsx` s'il existe, sinon aucun

**Interfaces:**
- `localFont({ src: "../public/fonts/Sora-Variable.ttf", variable: <la même variable CSS qu'aujourd'hui>, weight: <la même plage qu'aujourd'hui>, display: <le même> })` ; la classe ou la variable posée sur `<html>`/`<body>` ne change pas de nom.

- [ ] **Step 1 : implémenter** (guide `node_modules/next/dist/docs/01-app/03-api-reference/02-components/font.md`).
- [ ] **Step 2 : lancer** la suite complète, `tsc`, `npm run lint`.
- [ ] **Step 3 : commit et push** : `build: load Sora from the repo instead of Google Fonts`. Le contrôleur vérifie à l'écran (graisses, chiffres, captures avant et après) et que `next build` passe sans réseau vers Google.

### Tâche 10 : P5, Vitest plus rapide

**Files:**
- Modify: `vitest.config.mts`, éventuellement les en-têtes `// @vitest-environment` des fichiers jsdom

**Interfaces:**
- Deux projets : `node` (tout ce qui n'a pas besoin du DOM) et `jsdom` (composants). `isolate: false` seulement pour les fichiers sans état de module partagé ; jamais pour ceux qui touchent `src/sync/run.ts` (variable `active`), au limiteur de connexion, aux minuteurs simulés ou à `vi.stubGlobal`, sauf preuve contraire.

- [ ] **Step 1 : mesurer** la durée actuelle de `npx vitest run` (écrite dans le rapport).
- [ ] **Step 2 : configurer**, puis lancer la suite complète **trois fois de suite** : trois passages verts, sans échec intermittent, et la nouvelle durée dans le rapport.
- [ ] **Step 3 : commit et push** : `test: split Vitest into node and jsdom projects, share workers where safe`.

### Tâche 11 : S8 et Dependabot

**Files:**
- Modify: `Dockerfile` (trois `FROM node:22-alpine` → `node:22-alpine@sha256:<empreinte> # 22-alpine`), `.github/workflows/docker.yml` (chaque `uses:` → `<action>@<sha du commit> # vX.Y.Z`), `package.json` et `package-lock.json`
- Create: `.github/dependabot.yml`

**Interfaces:**
- Empreinte de l'image : celle de l'index multi-plateforme de `node:22-alpine` au jour du commit (API du registre Docker Hub). SHA des actions : le commit de l'étiquette utilisée aujourd'hui (API GitHub `git/ref/tags/<tag>`).
- Mises à jour : `next` 16.4.6, `postgres` 4.1.1, `@electric-sql/pglite` 0.5.16, `@electric-sql/pglite-socket` 0.2.19 (le contrôleur vérifie la rustine de `scripts/e2e/db.mjs` ; si elle casse, retour à 0.2.18 avec la raison). Rien d'autre.
- `dependabot.yml` : `version: 2` ; écosystèmes `npm` (`/`), `docker` (`/`) et `github-actions` (`/`) ; `schedule.interval: weekly` ; un groupe par écosystème pour `minor` et `patch` ; majeures non groupées.

- [ ] **Step 1 : écrire** et mettre à jour ; `npm ci` doit passer.
- [ ] **Step 2 : lancer** la suite complète, `tsc`, `npm run lint`.
- [ ] **Step 3 : commit et push** : `build: pin base images and actions by digest, minor updates, Dependabot`. Le contrôleur vérifie la CI sur github.com (par l'utilisateur).

### C2 (contrôleur, avant la tâche 12) : pics de mémoire

- [ ] Sur le build de production avec les tâches 1 à 11 : pic de mémoire (RSS) du processus `next start` pendant l'export PNG du Plat Wall avec Art, Rarity et Name, et sa durée ; pic du worker pendant une synchro complète suivie d'un recalcul des miniatures et couleurs de tuile (`update images set thumb_path = null, tile_checked_at = null` sur une partie des icônes). Valeurs écrites dans le rapport de la tâche 12 : limite = pic × 1,5 arrondi aux 64 Mo au-dessus.

### Tâche 12 : S9, conteneurs durcis et leur test en CI

**Files:**
- Modify: `deploy/stack-site.yml`, `deploy/stack-infra.yml`, `.github/workflows/docker.yml`
- Create: le script du test (par exemple `scripts/ci/stack-smoke.sh`)

**Interfaces:**
- `app` et `worker` : `cap_drop: [ALL]`, `security_opt: ["no-new-privileges:true"]`, `mem_limit` (valeurs de C2), `cpus` (`app` : 2, `worker` : 1), `NODE_OPTIONS=--max-old-space-size=<75 % de la limite en Mo>`.
- `app` : `healthcheck` avec `node -e` qui demande `http://127.0.0.1:3000/login` et sort en 0 seulement sur 200 ; intervalle 30 s, délai 5 s, 3 essais, `start_period` 30 s.
- `postgres` et `nginx` (`stack-infra.yml`) : `mem_limit` (`postgres` 512 Mo, `nginx` 64 Mo, ajustables d'après C2).
- Test CI : l'image construite par le job `image` (chargée localement, `load: true`) est lancée avec ces réglages exacts (`--cap-drop ALL --security-opt no-new-privileges:true --memory … --cpus …`) devant `postgres:16-alpine` sur un réseau dédié : le worker écrit `[worker] started`, et `app` devient `healthy` en moins de 2 minutes. Le job échoue sinon, avec les journaux des conteneurs.

- [ ] **Step 1 : écrire** les fichiers ; `bash -n` sur le script ; relire le YAML.
- [ ] **Step 2 : commit et push** : `feat: harden the app and worker containers, test them in CI`. Le contrôleur vérifie le job sur github.com (par l'utilisateur).

### Tâche 13 : guide de déploiement

**Files:**
- Modify: `deploy/README.md`

- [ ] **Step 1 : écrire**, en français, dans le style du guide :
  - **étape 5** : `app` doit passer à « healthy » dans Portainer ;
  - **étape 7, nouveau point** « Partage du NAS », *Quand : pendant la première synchro, puis pendant un export PNG* : Portainer → Containers → Stats montre chaque conteneur du PSN Tracker sous sa limite (valeurs listées, total de la stack), et une vidéo lue sur Plex ne saccade pas. Pas bon : un conteneur redémarre (tué faute de mémoire) ; comment relever `mem_limit` et `--max-old-space-size` dans la stack ;
  - **étape 8** : les PR de Dependabot, une fois par semaine, à fusionner une fois la CI verte, sans branche `docs/…` ;
  - **étape 9, Dépannage** : un conteneur `app` « unhealthy » (page d'attente qui ne part pas, ou base injoignable).
- [ ] **Step 2 : relire** le guide en entier (numérotation, renvois).
- [ ] **Step 3 : commit et push** : `docs: deploy guide for hardened containers, limits and Dependabot`.

### Tâche 14 : vérification avec les vraies données (contrôleur)

Spec 21.7, sur le build de production local, avec un seul worker.
- [ ] **S7** : migration 0010 appliquée, plus de colonne `npsso_enc`, aucun bandeau, une synchro passe sans recoller le npsso.
- [ ] **P2, P3** : temps de réponse de Stats, Games, Trophy Log et Trophy Advisor avant (build de C1) et après ; après une synchro, puis après « Save » de la liste des non obtenables, les pages montrent les nouvelles données.
- [ ] **P4** : pendant une synchro, la page d'un jeu ne fait que des petites requêtes `/api/sync`, puis se redessine une fois à la fin.
- [ ] **P6, R3, P7** : synchro complète puis rafraîchissement quotidien ; aucune image manquante, les 4 tuiles gardent leur couleur ; `select count(*) from sync_runs` ≤ 500.
- [ ] **Q3** : Games à 1 630 et 375 px : défilement, « Show all », filtres, tris, recherche, « Hide 0% games », retour depuis une page de jeu (après une page, après « Show all »).
- [ ] **Q6, Q7** : comparaison des styles (tâche 7) sans différence ; police Sora identique à l'écran.
- [ ] **P5** : durées avant et après (rapport de la tâche 10).
- [ ] **S9** : pics de C2 et limites retenues ; job de la CI vert sur github.com.

### Tâche 15 : état du projet et audit (contrôleur)

- [ ] `docs/ETAT-DU-PROJET.md` : en-tête, bloc en section 2, section 3 (reste : D1 à D7 puis le NAS), section 5 (`npm run lint`), tableau des documents (ce plan).
- [ ] `a_reprendre.md` : chaque point de cette branche marqué « Fait (`fix/audit-suite`) », S10 « noté en spec 14.5 ».
- [ ] Spec 21 : en-tête « Construit et vérifié … ».
- [ ] Commit et push : `docs: project status after finishing the audit outside design`.
