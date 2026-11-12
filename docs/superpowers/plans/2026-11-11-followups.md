# PSN Tracker : points de suivi de la phase 1, Implementation Plan

> **Statut :** terminé le 12 novembre 2026, tâches 1 à 14 et une vague de corrections après la relecture finale, sur la branche `fix/followups`. Les cases ne sont pas cochées : la progression se lit dans `git log` et dans `docs/ETAT-DU-PROJET.md`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** régler tous les points mis de côté pendant la phase 1 (robustesse et sécurité, performance, interface, tuile, divers) et compléter le guide de déploiement, avant le déploiement sur le NAS.

**Architecture :**
- **Une seule migration** (tâche 1) ajoute toutes les colonnes nouvelles ; les tâches suivantes s'en servent.
- **Côté worker** : la demande de synchro vit jusqu'à la fin du run, la langue est enregistrée, la couleur de tuile est calculée au téléchargement, les images inutilisées sont supprimées après un run réussi. sharp n'est chargé que par le worker.
- **Côté site** : en-têtes de protection, page d'attente dans le proxy, caches invalidés par la fin d'un run, tuile colorée dès le premier rendu, petites corrections d'interface.

**Tech Stack :** Next.js 16 (App Router, `proxy.ts`), React 19, TypeScript strict, Drizzle (PostgreSQL, PGlite en test), sharp (worker seulement), Vitest + @testing-library/react + jsdom 31, GitHub Actions.

**Spec :** [section 19](../specs/2026-11-07-psn-tracker-design.md) (et 8.9 pour la tuile, 18.14 pour la règle du doigt). **Maquette validée** des compteurs : [2026-11-11-psn-tracker-maquette-suivis.html](../specs/2026-11-11-psn-tracker-maquette-suivis.html), v2. Là où le plan diffère de la spec, **la spec fait foi**. La liste d'origine : `docs/superpowers/plans/2026-11-08-phase1-suivis.md`.

## Global Constraints

- **Git** : branche `fix/followups`. **Après chaque commit, push.** Messages de commit en anglais, terminés par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Langues et dépendances** : interface et code en anglais. Aucune nouvelle dépendance.
- **Next.js 16** : lire `AGENTS.md` et les guides de `node_modules/next/dist/docs/` avant d'écrire du code Next (proxy, `headers()`, route handlers).
- **Windows** : en Git Bash, `export PATH="/c/Program Files/nodejs:$PATH"`. Le chemin du dépôt contient `!` : le mettre entre apostrophes.
- **Tests** : `npx vitest run <fichier>`, puis `npx vitest run && npx tsc --noEmit` avant chaque commit. ESLint n'est pas configuré. Ne jamais lancer `next build`, `next dev`, `npm run e2e:*` ni le worker : le contrôleur s'en charge.
- **`app/globals.css`** est un seul fichier global : ne changer que les règles nommées dans la tâche.
- **Textes exacts** : `Couldn't reach PSN. Try again.`, `Updating…`, `This page reloads by itself.`
- **À la souris et sur PC, rien ne change** en dehors de ce que la tâche décrit : les tests existants passent avec leurs assertions inchangées, sauf mention contraire.
- **Caches au niveau du module** : toujours indexés par l'instance `Db` (`WeakMap`), sinon les tests PGlite se contaminent.

## Review Focus

Chaque ligne a son test dans la tâche indiquée.

1. **Nettoyage des images** : une image d'une liste **cachée**, d'un groupe, d'une bannière imposée, ou la bannière de l'utilisateur (`banner/`) n'est jamais supprimée ; rien n'est supprimé après un run avec un échec (tâche 8).
2. **Cache périmé** : après la fin d'un run, réussi ou en échec, la page suivante relit la base (tâche 10).
3. **Demande de synchro** : un run « skipped » ne compte pas comme échec ; au 3ᵉ échec la demande disparaît ; une nouvelle demande faite pendant un run n'est pas effacée par la fin de ce run (tâche 4).
4. **Langue** : premier démarrage sans langue enregistrée, aucune liste rechargée (tâche 6).
5. **Page d'attente** : une fois la base à jour, plus aucune requête de vérification par appel ; `/media` et `_next/static` ne passent jamais par la page d'attente (tâche 3).

---

### Task 1: Migration 0008

**Files:**
- Modify: `src/db/schema.ts` ; Create: `src/db/migrations/0008_*.sql` et sa ligne de `meta/_journal.json` (même méthode que 0007 : regarder comment elle a été produite)
- Test: `src/db/schema.test.ts`

**Interfaces:**
- Produces : `settings.psnLanguage` (`psn_language text`, nullable) ; `settings.syncRequestFailures` (`sync_request_failures integer not null default 0`) ; `images.tileBg` (`tile_bg text`, nullable) ; `images.tileCheckedAt` (`tile_checked_at` timestamp, nullable : null = couleur pas encore calculée ; renseigné avec `tile_bg` null = calculée, pas de bord uni).

- [ ] **Step 1** : test qui applique les migrations sur PGlite et vérifie les 4 colonnes et leurs défauts. Le voir échouer.
- [ ] **Step 2** : schéma + migration. Test vert, puis suite complète et `tsc`.
- [ ] **Step 3** : commit `feat: add columns for the phase 1 follow-ups (migration 0008)`, push.

### Task 2: En-têtes de protection

**Files:**
- Create: `src/lib/security-headers.ts` ; Modify: `next.config.ts`, `app/media/[...path]/route.ts`
- Test: `src/lib/security-headers.test.ts`, test de la route `/media` (existant ou nouveau)

**Interfaces:**
- Produces : `SITE_HEADERS: { key: string; value: string }[]` = `X-Frame-Options: DENY` et `Content-Security-Policy: frame-ancestors 'none'` ; `MEDIA_CSP = "default-src 'none'; style-src 'unsafe-inline'; sandbox"`.

- [ ] **Step 1** : tests : `next.config.ts` `headers()` renvoie `SITE_HEADERS` pour `source: "/:path*"` ; une réponse de `/media` (fichier PNG et fichier SVG) porte `Content-Security-Policy: MEDIA_CSP` et `X-Content-Type-Options: nosniff`. Les voir échouer.
- [ ] **Step 2** : implémenter. Tests verts, suite complète, `tsc`.
- [ ] **Step 3** : commit `feat: refuse framing and sandbox served media`, push.

### Task 3: Page d'attente pendant les migrations

**Files:**
- Create: `src/db/readiness.ts` ; Modify: `proxy.ts` (et son matcher)
- Test: `src/db/readiness.test.ts`, test du proxy (existant ou nouveau)

**Interfaces:**
- Consumes : la table de suivi des migrations de Drizzle (lire `src/db/migrate.ts` pour son nom) et `src/db/migrations/meta/_journal.json`.
- Produces : `EXPECTED_MIGRATIONS: number` (nombre d'entrées du journal, importé en JSON donc figé au build) ; `isDbReady(db: Db): Promise<boolean>` : vrai quand la table compte au moins `EXPECTED_MIGRATIONS` lignes ; une fois vrai, renvoie vrai sans requête (mémo par `Db`). Une table absente donne faux, sans lever d'erreur.

- [ ] **Step 1** : tests de `isDbReady` sur PGlite : base migrée → vrai ; une ligne de la table supprimée → faux ; après un vrai, un second appel ne fait aucune requête (espion sur `db.execute` ou équivalent).
- [ ] **Step 2** : tests du proxy : base pas prête → une page demandée (y compris `/login`) reçoit un 503 HTML contenant `Updating…`, `This page reloads by itself.` et un rechargement toutes les 5 s (`<meta http-equiv="refresh" content="5">`) ; une route `/api/...` reçoit un 503 sans corps HTML ; `/media/...` et `/_next/static/...` ne sont jamais concernés. Base prête → comportement actuel inchangé (l'authentification optimiste reste la même).
- [ ] **Step 3** : implémenter. Lire d'abord le guide du proxy de Next 16 (runtime Node, accès à la base possible). Tests verts, suite complète, `tsc`.
- [ ] **Step 4** : commit `feat: show a wait page until the worker has migrated the database`, push.

### Task 4: Demande de synchro et bouton « Sync now »

**Files:**
- Modify: `src/settings/repo.ts`, `src/worker/scheduler.ts`, `src/sync/requests.ts`, le composant du bouton (`components/SyncButton.tsx` ou celui qui affiche « Syncing… »)
- Test: `src/settings/repo.test.ts`, `src/worker/scheduler.test.ts`, `src/sync/requests.test.ts`, test du bouton

**Interfaces:**
- Consumes : `settings.syncRequestFailures` (tâche 1).
- Produces (remplacent `takeSyncRequest`) :
  - `peekSyncRequest(db): Promise<Date | null>` ;
  - `clearSyncRequest(db, seen: Date): Promise<void>` : efface la demande et remet les échecs à 0, seulement si `sync_requested_at` vaut toujours `seen` ;
  - `failSyncRequest(db, seen: Date): Promise<number>` : ajoute 1 aux échecs et renvoie le total ; à 3, efface la demande (même condition sur `seen`) et remet à 0.

- [ ] **Step 1** : tests du scheduler : demande manuelle + run `success` ou `partial` → demande effacée ; run `skipped` → demande gardée, échecs inchangés ; run `error` ou `runSync` qui lève → demande gardée, échecs +1 ; au 3ᵉ échec → demande effacée ; une nouvelle demande posée pendant le run (valeur différente de `seen`) n'est pas effacée.
- [ ] **Step 2** : test de `getSyncStatus` : pendant toute la vie d'une demande sans run `running`, l'état est `queued` (aucun trou entre la prise de la demande et le démarrage du run). Test du bouton : il affiche « Syncing… » pour `queued` et `running`, et ne redevient cliquable qu'à `idle` ou `error`.
- [ ] **Step 3** : implémenter. Tests verts, suite complète, `tsc`.
- [ ] **Step 4** : commit `fix: keep a sync request until its run ends, give up after 3 failures`, push.

### Task 5: Token injoignable et champ npsso

**Files:**
- Modify: `src/psn/tokens.ts`, `src/settings/npsso.ts`, le formulaire npsso de Settings
- Test: `src/settings/npsso.test.ts`, test du formulaire

**Interfaces:**
- Produces : `NPSSO_UNREACHABLE = "Couldn't reach PSN. Try again."` ; `connectWithNpsso` renvoie `"unreachable"` pour une erreur réseau ou un délai dépassé, `"invalid"` pour un refus du PSN.

- [ ] **Step 1** : tests : échec réseau → `{ ok: false, message: NPSSO_UNREACHABLE }` ; refus → `NPSSO_REJECTED` comme aujourd'hui. Formulaire : après une réponse en erreur, le champ contient toujours le texte saisi (React 19 vide les formulaires après une action : garder la valeur explicitement) ; après un succès, il est vidé.
- [ ] **Step 2** : implémenter. Tests verts, suite complète, `tsc`.
- [ ] **Step 3** : commit `fix: tell an unreachable PSN from a rejected npsso, keep the field on error`, push.

### Task 6: Langue, jeux sans liste, catégorie de rareté

**Files:**
- Modify: `src/sync/run.ts` (ou le module qui décide `titleNeedsReload`), `src/sync/daily.ts`, `src/sync/played.ts`, `src/sync/title.ts`, `src/sync/user-state.ts`
- Test: les fichiers de test correspondants

**Interfaces:**
- Consumes : `settings.psnLanguage` (tâche 1), `cfg.psnLanguage`.

- [ ] **Step 1** : tests de langue : aucune langue enregistrée → elle est enregistrée et aucune liste n'est rechargée de force ; langue enregistrée identique → rien ; langue différente → toutes les listes non cachées sont rechargées (définitions comprises) dans ce run, puis la nouvelle langue est enregistrée ; si le run échoue avant la fin, la langue n'est pas enregistrée (le rechargement recommencera).
- [ ] **Step 2** : test des jeux sans liste : le rafraîchissement quotidien remet à null les correspondances vides (`np_communication_ids = '{}'`) pour que la synchro suivante les recherche ; les correspondances non vides ne changent pas.
- [ ] **Step 3** : tests de `rare_category` : partout où `earned_rate` est protégé contre une valeur vide du PSN (`title.ts`, `user-state.ts`, `daily.ts`), `rare_category` l'est de la même façon ; une vraie valeur la remplace.
- [ ] **Step 4** : implémenter. Tests verts, suite complète, `tsc`.
- [ ] **Step 5** : commit `fix: reload definitions on a language change, retry games without a list, keep rare category`, push.

### Task 7: Cache d'images côté worker, couleur de tuile enregistrée

**Files:**
- Create: `src/sync/image-cache.ts` (déplacé depuis `src/sync/images.ts` : `cacheImages`, `collectUrls`, `downloadOne`, `thumbOne`, `inPool`) ; Modify: `src/sync/images.ts` (garde `imageHash`, `mediaSrc`, `loadImageMap`, `resolveMediaPath`, `ImageMap`), `src/sync/thumbs.ts`, `src/sync/run.ts`, `src/lib/tile-bg.ts`
- Test: `src/sync/images.test.ts` (scindé si besoin), `src/sync/thumbs.test.ts`, `src/lib/tile-bg.test.ts`

**Interfaces:**
- Consumes : `images.tileBg`, `images.tileCheckedAt` (tâche 1) ; `edgeBackground` (inchangé).
- Produces :
  - `computeTileBg(file: string): Promise<string | null>` dans `src/sync/thumbs.ts` : sharp en import dynamique, pixels RGBA bruts passés à `edgeBackground` ; `null` pour un SVG ou une image carrée.
  - `cacheImages` renvoie en plus `tiles: number` (couleurs calculées). Après les miniatures, il calcule la couleur de chaque image téléchargée dont `tile_checked_at` est null, et enregistre `tile_bg` et `tile_checked_at`.
  - `ImageMap` : chaque entrée gagne `tileBg: string | null` (lu par `loadImageMap`).
  - `runSync` écrit dans le journal du worker une ligne `[worker] images: <downloaded> downloaded, <failed> failed, <thumbs> thumbnails, <tiles> tile colours`.

- [ ] **Step 1** : tests de `tile-bg` : tolérance 16 acceptée, 17 refusée ; opacité 250 acceptée, 249 refusée.
- [ ] **Step 2** : tests de `computeTileBg` sur de petites images créées par sharp dans le test : rectangle à bords unis → la couleur ; deux bords différents → le dégradé ; carré → null ; SVG → null. Test de `cacheImages` : une image téléchargée sans couleur reçoit `tile_bg` et `tile_checked_at` ; un second appel ne recalcule pas.
- [ ] **Step 3** : test : `src/sync/images.ts` n'importe plus `thumbs.ts` ni sharp (lecture du source, comme `app/stats-hover.test.ts`).
- [ ] **Step 4** : implémenter. Tests verts, suite complète, `tsc`.
- [ ] **Step 5** : commit `feat: compute tile colours in the worker and keep sharp out of the site`, push.

### Task 8: Suppression des images inutilisées

**Files:**
- Modify: `src/sync/image-cache.ts`, `src/sync/run.ts`
- Test: `src/sync/image-cache.test.ts` (ou le fichier de la tâche 7), `src/sync/run.test.ts`

**Interfaces:**
- Consumes : `collectUrls` (tâche 7), qui doit désormais inclure les bannières imposées de **toutes** les listes, cachées comprises.
- Produces : `pruneImages(db: Db, mediaDir: string): Promise<number>` : supprime les lignes `images` dont l'URL n'est plus dans `collectUrls`, et leurs fichiers `local_path` et `thumb_path` (seulement sous `psn/`, un fichier déjà absent n'est pas une erreur) ; renvoie le nombre de lignes supprimées. `runSync` l'appelle après `cacheImages` seulement si le run n'a aucun échec, et écrit `[worker] images: <n> removed`.

- [ ] **Step 1** : tests : une image orpheline est supprimée (ligne, fichier, miniature) ; sont gardées l'icône d'une liste cachée, une icône de groupe, une icône de trophée, l'avatar, une bannière imposée d'une liste cachée ; un fichier sous `banner/` n'est jamais touché ; un run avec un échec ne supprime rien.
- [ ] **Step 2** : implémenter. Tests verts, suite complète, `tsc`.
- [ ] **Step 3** : commit `feat: remove images nothing uses any more after a clean sync`, push.

### Task 9: Tuile colorée dès le premier rendu

**Files:**
- Modify: `components/TileImage.tsx` et tous ses appelants (`components/GameRow.tsx`, `app/(site)/games/[id]/page.tsx`, `components/game/TrophyList.tsx`, `components/trophy-log/TrophyLogRow.tsx`, `components/trophy-advisor/AdvisorRow.tsx`, `components/trophy-advisor/IncompleteGames.tsx`, `components/stats/LevelHistory.tsx`) et les chargeurs qui leur donnent l'image (chercher les champs `…IsIcon` / `isIcon`)
- Test: `components/TileImage.test.tsx` et les tests des chargeurs touchés

**Interfaces:**
- Consumes : `ImageMap` avec `tileBg` (tâche 7).
- Produces : `TileImage` prend `bg: string | null` (à la place de la lecture du canevas) et pose `style.background` dès le premier rendu quand `tile` est vrai et `bg` non nul. Chaque donnée d'image affichée sur une tuile porte son `tileBg` à côté de son `src`.

- [ ] **Step 1** : tests : `TileImage` avec `bg` rend le fond au premier rendu, sans événement `load` ; sans `bg`, pas de fond (le bleu nuit du CSS) ; aucun canevas créé. Un chargeur (par exemple celui de Games) renvoie le `tileBg` de l'icône pour un jeu sans jaquette.
- [ ] **Step 2** : implémenter, retirer `readEdgeBackground` et son test jsdom devenu inutile. Tests verts, suite complète, `tsc`.
- [ ] **Step 3** : commit `feat: paint the tile colour on first render`, push.

### Task 10: Données gardées en mémoire jusqu'à la fin d'un run

**Files:**
- Create: `src/lib/per-sync-cache.ts` ; Modify: `src/sync/images.ts` (`loadImageMap`), `src/stats/milestones.ts` (`getMilestones`), `src/stats/load.ts`
- Test: `src/lib/per-sync-cache.test.ts`, `src/stats/load.test.ts`

**Interfaces:**
- Produces : `cachedUntilNextRun<T>(db: Db, key: string, load: () => Promise<T>): Promise<T>` : garde la valeur par `Db` et par clé, tant que le marqueur ne change pas. Marqueur : `max(finished_at)` de `sync_runs` sur tous les runs (tous types, tous statuts) et le nombre de lignes `sync_runs`, lus en une requête à chaque appel.
- `loadImageMap(db)` et `getMilestones(db, now)` passent par ce cache (pour les milestones, le résultat ne doit pas dépendre de `now` au-delà de ce que la page affiche : vérifier et, si besoin, ne mettre en cache que la lecture des trophées).
- `getStatsData` ne lit plus la table des images qu'une fois.

- [ ] **Step 1** : tests : deux appels sans nouveau run → `load` appelé une fois ; un run qui se termine (succès ou erreur) entre deux appels → `load` rappelé ; deux `Db` différents ne partagent rien. `getStatsData` : `loadImageMap` appelé une seule fois par affichage.
- [ ] **Step 2** : implémenter. Tests verts, suite complète, `tsc`.
- [ ] **Step 3** : commit `perf: keep the image map and milestones until the next run ends`, push.

### Task 11: Carrousel, liste des jeux, toggle

**Files:**
- Modify: `components/TrophyCarousel.tsx`, `components/GameList.tsx` (ou `components/ProgressiveList.tsx`), `components/HideZeroToggle.tsx`
- Test: les fichiers de test correspondants

- [ ] **Step 1** : tests du carrousel : souris → pause au survol, reprise à la sortie (inchangé) ; doigt (`pointerType: "touch"`) → pause au `pointerdown`, reprise au `pointerup` ou `pointercancel` ; un tap ne laisse pas le carrousel en pause ; le focus clavier met toujours en pause. Les événements souris de compatibilité qui suivent un tap ne doivent plus le mettre en pause (passer aux événements pointer filtrés sur `pointerType`).
- [ ] **Step 2** : test de la liste : une page qui ne contient que des jeux déjà affichés ne stoppe pas le chargement ; la page suivante est demandée.
- [ ] **Step 3** : test du toggle : il garde le focus pendant l'enregistrement et après (pas de `disabled` ni de démontage pendant l'attente).
- [ ] **Step 4** : implémenter. Tests verts, suite complète, `tsc`.
- [ ] **Step 5** : commit `fix: carousel pauses only while a finger is down, list and toggle fixes`, push.

### Task 12: `/api/games`, compteurs du bandeau, bannière

**Files:**
- Modify: `app/api/games/route.ts` (ou le module qui lit ses paramètres), le composant du bandeau profil (compteurs), `app/globals.css`
- Test: test de la route, test du bandeau, test de l'envoi de bannière (`app/(site)/(banner)/settings/actions.ts`) s'il manque

- [ ] **Step 1** : tests : `offset` ou `limit` négatif, non entier ou au-delà de `Number.MAX_SAFE_INTEGER`, ou `offset` au-delà de 1 000 000 → 400 ; les valeurs normales répondent comme aujourd'hui.
- [ ] **Step 2** : compteurs (maquette v2) : le compteur « Trophies » porte une classe `total`. CSS à 640 px et moins : `.counts` en grille de 4 colonnes égales (gap 6 px), `.count.total` sur toute la largeur, en ligne (nombre puis libellé, gap 8 px), les 4 types sans `min-width` ; tailles de texte inchangées. Test : la classe est présente ; un test de CSS (comme `app/stats-hover.test.ts`) vérifie la règle dans le bloc `@media (max-width:640px)`. Au-dessus de 640 px, aucune règle ne change.
- [ ] **Step 3** : bannière : si aucun test ne vérifie que l'envoi d'une nouvelle bannière supprime l'ancien fichier, en ajouter un.
- [ ] **Step 4** : implémenter. Tests verts, suite complète, `tsc`.
- [ ] **Step 5** : commit `fix: reject out-of-range list offsets, stack the profile counters on phones`, push.

### Task 13: Démarrage du worker en CI, données de test

**Files:**
- Create: `scripts/worker-smoke.mjs` ; Modify: `.github/workflows/docker.yml` (job `pg-smoke`), `scripts/seed-dev.ts` / `scripts/seed-data.ts`
- Test: `scripts/seed-guard.test.ts` ou un test de `seed-data` (existant ou nouveau)

**Interfaces:**
- Produces : `scripts/worker-smoke.mjs` lance `node dist/worker.js` avec l'environnement du job, attend `[worker] started` sur sa sortie (30 s au plus), l'arrête et sort en 0 ; sinon sort en 1 avec la sortie du worker. Le job `pg-smoke` construit d'abord le paquet avec la même commande esbuild que le `Dockerfile` (ligne 14), puis lance le script.

- [ ] **Step 1** : `seed:dev` crée des `played_games` reliés à des listes, avec des heures de jeu ; test : les données de test donnent un « Hours played » non nul.
- [ ] **Step 2** : écrire le script et le job. On ne peut pas lancer la CI ici : vérifier la syntaxe YAML et lancer le script en local contre un faux worker (un petit fichier qui écrit `[worker] started`) pour tester ses deux issues.
- [ ] **Step 3** : suite complète, `tsc`, commit `ci: check that the worker bundle starts; seed played games`, push.

### Task 14: Guide de déploiement et documentation

**Files:**
- Modify: `deploy/README.md` (étape 7), `docs/superpowers/plans/2026-11-08-phase1-suivis.md`

- [ ] **Step 1** : ajouter à l'étape 7 de `deploy/README.md` les vérifications de la spec 19.2, chacune avec ce qu'on doit voir. Ne pas renuméroter les étapes existantes (1.5 et 6.4 sont citées ailleurs).
- [ ] **Step 2** : dans `docs/superpowers/plans/2026-11-08-phase1-suivis.md`, marquer chaque point traité « **Réglé** (spec 19, branche `fix/followups`) », et la bannière « déjà réglé dans le code ». Les vérifications de déploiement renvoient au guide.
- [ ] **Step 3** : commit `docs: first-deploy checks in the deploy guide, follow-ups marked done`, push.

---

## Vérification avec les vraies données (après les tâches)

Base locale synchronisée, build de production (spec 19.9) : compteurs à 375 et 320 px ; carrousel au doigt simulé ; « Sync now » ; toggle au clavier ; liste des jeux ; champ npsso ; en-têtes (`curl -I`) sur une page et sur `/media` ; page d'attente en retirant une ligne de la table des migrations ; une synchro complète (une seule instance du worker) : lignes `[worker] images: …` dans le journal, aucune image manquante sur les pages, les 4 tuiles colorées dès le premier affichage ; temps de réponse avant et après le cache.
