# À reprendre : bilan du check-up complet du 11 novembre 2026

Ce fichier est destiné à l'agent (ou à la personne) qui reprend le projet. Il donne le résultat d'un audit complet et la liste, par priorité, de ce qu'il reste à corriger. **Rien n'a été modifié dans le code pendant l'audit** : ce fichier est le seul ajout.

> **Suivi au 12 novembre 2026, après la fusion de la PR #19 (`fix/followups`)** : l'utilisateur garde ce fichier, car ses points devront être vérifiés ou corrigés un jour.
> - **Fait** : S1, corrigé dans la PR #19 (voir sa section) ; la mise à jour de `docs/ETAT-DU-PROJET.md` demandée en section 8 ; la valeur exacte de la CSP de `/media` dans `deploy/README.md`, étape 7, point 5.
> - **À faire** : tout le reste, sur une branche `fix/audit`, en suivant l'ordre de la section 9. Rien n'est commencé.

## 1. Ce qui a été audité, et comment

- **Version auditée** : branche `fix/followups`, commit `e28f726` (16 commits d'avance sur `main`, spec section 19).
- **Lu en entier** : `docs/ETAT-DU-PROJET.md`, la spec (`docs/superpowers/specs/2026-11-07-psn-tracker-design.md`, sections 1 à 19), `docs/superpowers/plans/2026-11-08-phase1-suivis.md`, le déploiement (`Dockerfile`, `deploy/`, `.github/workflows/docker.yml`).
- **Code relu** : toute l'authentification, le proxy, toutes les routes `app/api`, `app/media`, toutes les actions serveur, le worker, la synchro PSN, le schéma, les requêtes des pages, les composants de liste et de synchro.
- **Commandes lancées** :
  - `npx vitest run` : **122 fichiers, 1 114 tests, tous verts** (322 s) ;
  - `npx tsc --noEmit` : **aucune erreur** ;
  - `npm audit --omit=dev` : **0 faille** ; `npm audit` : 4 failles modérées, toutes dans les outils de développement (voir S8).
- **Vérifié dans le navigateur**, sur le build de production local (`next start`, port 3000) avec les vraies données, en lecture seule : Games, page d'un jeu (Cyberpunk 2077), Plat Wall, Trophy Log, Trophy Advisor, Stats, Settings, à 1 630 px puis à 375 px. Les en-têtes de réponse et les tailles des réponses ont été lus par `fetch` depuis la page.

### Ce qui n'a pas pu être vérifié
- La CI sur github.com (`gh` n'est pas installé), le build Docker, tout ce qui ne se voit que sur le NAS (liste dans `deploy/README.md`, étape 7).
- Un vrai écran tactile et le pavé tactile d'un Mac.
- Les en-têtes ajoutés par le reverse proxy de DSM.
- Les temps mesurés l'ont été pendant qu'une synchro tournait : ils ne valent pas référence.

### À savoir avant de toucher au dépôt
- ~~Une autre session Claude exécutait le plan `docs/superpowers/plans/2026-11-11-followups.md` pendant l'audit.~~ Cette branche est fusionnée (PR #19, 12 novembre 2026) : partir d'un `main` à jour.
- `.claude/launch.json` est modifié en local (configuration `e2e-prod`) et n'est pas commité : c'est voulu, ne pas l'ajouter.
- Le processus de `CLAUDE.md` s'applique à tout ce qui suit : décision reportée dans la spec, plan, branche, vérification avec les vraies données, PR créée par l'utilisateur. **Les points de design (section 6) demandent une validation de l'utilisateur avant toute construction.**

## 2. Verdict en une page

| Domaine | Verdict | En bref |
|---|---|---|
| Design | **Bon** | Conforme aux mesures de la spec sur les 7 pages, aucune image cassée ni rectangulaire, aucun défilement horizontal à 375 px. 7 retouches mineures, surtout sur téléphone. |
| Code | **Propre** | Typage strict sans `any`, aucun `TODO`, SQL toujours paramétré, 1 114 tests. Quelques doublons et pas de linter. |
| Sécurité | **Bonne, 1 défaut réel** | Le `sandbox` de `/media` n'est pas appliqué en production (S1, corrigé depuis dans la PR #19). Le reste est du durcissement. |
| Performances | **Bonnes** | Pages en ~200 ms. Un gain net et facile : compresser les réponses JSON (P1). |
| Conformité à la spec | **Conforme, 3 écarts** | S1 (19.3.1), le bandeau « token expired » sur panne réseau (R1), les nombres de l'historique des synchros (D5). |

Rien de bloquant pour le déploiement, mais **S1, P1, S2 et R1 sont à faire avant** : ils sont courts et le premier contredit la spec. *(12 novembre : S1 est corrigé ; restent P1, S2 et R1.)*

## 3. Priorité 1 : à corriger avant le déploiement sur le NAS

### S1. Le `sandbox` de `/media` est écrasé par l'en-tête global (sécurité, moyenne)
> **Corrigé dans la PR #19** (commit `771bd27`). `next.config.ts` ajoute une règle `/media/:path*` après la règle globale : Next applique les règles dans l'ordre et la dernière l'emporte pour une même clé. La valeur `MEDIA_CSP` vient de `src/lib/security-headers.ts`, partagée par la configuration et la route : `default-src 'none'; style-src 'unsafe-inline'; sandbox; frame-ancestors 'none'`. Vérifié sur le build de production local, connecté, avec `fetch("/media/…")`. `deploy/README.md`, étape 7, point 5, donne maintenant cette valeur exacte. Le commentaire faux de Q5 est toujours là.

- **Constat, mesuré sur le serveur de production local** : une image servie par `/media/psn/...` répond avec `Content-Security-Policy: frame-ancestors 'none'`, et non avec `default-src 'none'; style-src 'unsafe-inline'; sandbox`. `X-Content-Type-Options: nosniff` et `Cache-Control`, posés par la même route, sont bien là.
- **Cause** : `next.config.ts` applique `SITE_HEADERS` à `source: "/:path*"`, donc aussi à `/media`. Pour une même clé, l'en-tête de `headers()` remplace celui que pose la route (`app/media/[...path]/route.ts:35`).
- **Pourquoi les tests ne le voient pas** : `app/media/[...path]/route.test.ts` appelle la route seule, sans la configuration de Next.
- **Conséquence** : la spec 19.3.1 n'est pas tenue. Un SVG venu de Sony, ouvert directement par son adresse, pourrait exécuter un script. Le risque réel est faible (source de confiance, images affichées dans `<img>`), mais c'est un écart avec ce qui a été décidé.
- **Correction proposée** :
  1. dans `next.config.ts`, exclure `/media` de la règle globale (par exemple `source: "/((?!media/).*)"`) et ajouter une règle `/media/:path*` qui porte `X-Frame-Options: DENY` et une CSP unique : `default-src 'none'; style-src 'unsafe-inline'; sandbox; frame-ancestors 'none'` ;
  2. garder la même valeur dans la route, via `src/lib/security-headers.ts`, pour qu'il n'y ait qu'une définition ;
  3. tester la configuration elle-même (la règle globale ne doit pas correspondre à `/media/x.png`) ;
  4. **revérifier sur le serveur réel**, connecté, et pas seulement en test : `fetch("/media/…")` puis lire l'en-tête. `curl -I` sans cookie répond 401 et ne montre que l'en-tête global : il ne prouve rien.
- `deploy/README.md`, étape 7, point 5, demande déjà de voir `sandbox` sur une image de `/media` : sans cette correction, cette vérification échouera sur le NAS. Y mettre la valeur exacte attendue une fois S1 corrigé.

### P1. Les réponses JSON ne sont pas compressées (performance, moyenne)
- **Constat** : les pages et les réponses RSC sortent en gzip, mais pas les routes `app/api`. Mesuré : `/api/trophy-log?all=1` = **6,4 Mo** sans compression, `/api/trophy-advisor?all=1` = 450 Ko, `/api/games?all=1` = 120 Ko.
- **Conséquence** : « Show all » du Trophy Log envoie 6,4 Mo depuis le NAS, sur son débit montant. L'objectif de la spec 16.8 (premières lignes en moins de 1 s) risque de ne pas tenir hors de la maison.
- **Correction proposée** : activer gzip dans `deploy/nginx/default.conf` (`gzip on; gzip_proxied any; gzip_types application/json text/x-component; gzip_min_length 1024;`). Aucun changement dans l'app. Gain attendu : environ 85 à 90 % sur ce JSON très répétitif.
- À mesurer sur le NAS avec la vérification déjà prévue (`deploy/README.md`, étape 7, point 8).

### S2. Les serveurs de test écoutent sur tout le réseau (sécurité, moyenne sur un PC de travail)
- **Constat** : `scripts/e2e/web.mjs` lance `next dev -p 3000` sans `-H`. Le port 3000 écoute sur `0.0.0.0` : le site de test, avec les vraies données du profil, est joignable depuis le réseau local du PC (seul le pare-feu de Windows le protège). Le script local `.data/e2e-prod.mjs` fait pareil avec `next start`.
- **Correction proposée** : ajouter `-H 127.0.0.1` aux deux. `scripts/e2e/db.mjs` écoute déjà sur `127.0.0.1`.

### R1. Une panne réseau affiche « PSN token expired » (robustesse, moyenne)
- **Constat** : dans `src/psn/tokens.ts:21-26`, toute erreur de `gw.refresh()` met `psnAuthStatus` à `expired`, y compris un PSN injoignable. Le site affiche alors « PSN token expired — update it in Settings », à tort, jusqu'à la synchro suivante (6 h).
- La spec 19.3.3 a réglé ce même défaut pour l'enregistrement du npsso (`isUnreachable`), mais pas pour le renouvellement. C'est contraire à l'anti-objectif de la spec 2 : ne pas afficher une information fausse.
- **Correction proposée** : réutiliser `isUnreachable` dans `getValidAuth`. Si le PSN est injoignable, la synchro échoue avec « Couldn't reach PSN » sans changer le statut du token.

## 4. Priorité 2 : durcissement de la sécurité (tout est de gravité basse)

| N° | Constat | Où | Proposition |
|---|---|---|---|
| S3 | En-têtes manquants : pas de `Referrer-Policy` (les liens PowerPyx et PSNProfiles transmettent l'adresse privée du site, `rel="noopener"` sans `noreferrer`), pas de `nosniff` sur les pages, `X-Powered-By: Next.js` présent, pas de HSTS. | `src/lib/security-headers.ts`, `next.config.ts`, `components/game/GameInfoPanel.tsx:99,103` | Ajouter `Referrer-Policy: same-origin` et `X-Content-Type-Options: nosniff` à `SITE_HEADERS`, `poweredByHeader: false`. HSTS : case à cocher dans la règle du reverse proxy DSM, à ajouter au guide. |
| S4 | nginx fait confiance à `10/8` et `192.168/16` avec `real_ip_recursive on` : un appareil du réseau local peut envoyer un `X-Forwarded-For` inventé et contourner la limite de tentatives de connexion. Un client venu d'internet ne le peut pas. | `deploy/nginx/default.conf:12-17` | Ne garder que `127.0.0.0/8` et `172.16.0.0/12`. Le commentaire du fichier dit le contraire de ce qui se passe : le corriger. |
| S5 | Une session ne finit jamais côté serveur : `validateSession` n'a aucune limite d'âge, les lignes ne sont jamais supprimées, et l'identifiant est stocké en clair. | `src/auth/sessions.ts:14-21` | Refuser et supprimer une session non vue depuis 400 jours (la durée du cookie, donc sans effet sur la « session sans fin » de la spec 5). Stocker le SHA-256 de l'identifiant plutôt que l'identifiant. |
| S6 | Connexion : aucune limite de longueur sur l'identifiant et le mot de passe (l'action accepte 11 Mo, compromis déjà noté dans `next.config.ts`), et la table du limiteur n'est jamais nettoyée pour une IP qui ne revient pas. | `app/login/actions.ts:17-19`, `src/auth/rate-limit.ts:10` | Refuser au-delà de 256 caractères avant `bcrypt`. Balayer les entrées périmées à chaque tentative. |
| S7 | Le npsso est stocké chiffré (`npsso_enc`) mais jamais relu : seul le refresh token sert. C'est un secret gardé sans usage. | `src/settings/repo.ts:119`, `src/db/schema.ts:181` | **Décision de l'utilisateur** (la spec 5 dit qu'il est stocké) : soit ne plus le garder, soit s'en servir pour redemander des tokens quand le refresh token est refusé. |
| S8 | Chaîne de build : images de base et actions GitHub épinglées par étiquette et non par empreinte, stack sur `:latest`. `npm audit` : 4 failles modérées dans `esbuild`, tirées par `drizzle-kit` (outil de développement, jamais dans l'image). | `Dockerfile`, `.github/workflows/docker.yml`, `deploy/stack-site.yml` | Facultatif pour un dépôt privé. Mettre à jour `drizzle-kit` quand une version corrigée sort. Mises à jour mineures disponibles : `next` 16.4.6, `postgres` 4.1.1, `@electric-sql/pglite` 0.5.16. |
| S9 | Conteneurs sans durcissement : pas de `no-new-privileges`, pas de `cap_drop`, pas de `read_only`, pas de limite mémoire, pas de healthcheck pour `app`. | `deploy/stack-site.yml`, `deploy/stack-infra.yml` | Ajouter `security_opt: ["no-new-privileges:true"]` et `cap_drop: [ALL]` à `app` et `worker`, une limite mémoire (l'export PNG monte haut), un healthcheck. À tester sur le NAS. |
| S10 | L'adresse de la liste des trophées non obtenables est téléchargée par le worker depuis le réseau Docker : une adresse interne (`http://postgres:5432`, l'interface du NAS) est acceptée. | `src/unobtainable/refresh.ts:40-44` | Accepté tel quel : seul l'utilisateur connecté peut la changer, et la réponse n'est jamais affichée. À noter dans la spec 14.5 comme risque accepté. |

### Ce qui est bon, à ne pas refaire
- Toutes les pages, routes API, `/media` et actions serveur vérifient la session en base. Le proxy ne fait que le contrôle rapide.
- SQL toujours paramétré, `sql.raw` seulement sur des chaînes fixes. Aucun `dangerouslySetInnerHTML`. Notes de la liste externe jamais interprétées en HTML, liens limités à `http(s)`.
- `/media` : traversée de répertoire refusée, vérifié en direct (`..%2f`, `%2e%2e`, dossier inconnu : 404).
- Bannière : type vérifié sur la signature du fichier, 10 Mo, nom aléatoire, écriture atomique.
- Tokens PSN en AES-256-GCM avec étiquette de 16 octets imposée. Mot de passe en bcrypt, coût 12, comparaison faite même si l'identifiant est faux.
- Cookie `httpOnly`, `SameSite=Lax`, `Secure` en HTTPS. Limite de 5 tentatives par 15 minutes.
- Conteneur non root, base non exposée, nginx lié à `127.0.0.1`, CI avec droits minimaux.

## 5. Priorité 3 : performance et robustesse

| N° | Constat | Où | Proposition |
|---|---|---|---|
| P2 | La page Stats recharge les 11 640 trophées obtenus à chaque affichage (`getAllEarned`), alors que les milestones sont déjà gardées en mémoire. | `src/stats/load.ts:38` | Passer `getStatsData` par `cachedUntilNextRun`, avec `hideZero` et le jour de Paris dans la clé (le calendrier dépend du jour). |
| P3 | `loadSiblingIndex` relit toute la table `titles` à chaque requête de Games, Trophy Log, Trophy Advisor et Stats. | `src/games/siblings.ts:26` | Même cache. |
| P4 | `AutoRefresh` refait le rendu complet de la page toutes les 3 s pendant une synchro, et toutes les 60 s au repos, sur la page d'un jeu et Settings. | `components/AutoRefresh.tsx` | Sur la page d'un jeu, s'aligner sur `SyncButton` : interroger `/api/sync` et ne rafraîchir qu'à la fin d'un run. |
| P5 | La suite de tests dure 322 s. Vitest indique qu'environ 64 s partent dans un processus par fichier. Les minutes de CI sont comptées. | `vitest.config.mts` | Séparer deux projets (node et jsdom) et essayer `isolate: false` sur les tests purs. |
| P6 | La couleur de tuile est calculée pour toutes les images, bannières 4K comprises (environ 33 Mo décodés par image, 4 à la fois), alors qu'elle ne sert qu'aux icônes de listes. | `src/sync/image-cache.ts:219-226` | Limiter aux icônes de `titles` et de `trophy_groups`. Gain seulement à la première synchro. |
| P7 | `sync_runs` grossit sans fin (environ 1 800 lignes par an) et le marqueur du cache la parcourt à chaque appel. | `src/lib/per-sync-cache.ts:14` | Sans urgence. Garder par exemple les 500 derniers runs. |
| R2 | Le téléchargement d'une image n'a pas de délai explicite (5 min par défaut dans Node). Un run bloqué garde le verrou en mémoire et aucune synchro ne repart avant sa fin. | `src/sync/image-cache.ts:64` | `AbortSignal.timeout(30_000)`, comme pour la liste des non obtenables. |
| R3 | Le rafraîchissement quotidien recharge un jeu qui a reçu un DLC mais ne télécharge pas ses images : vignette neutre jusqu'à la synchro suivante (6 h au plus). | `src/sync/daily.ts` | Appeler `cacheImages` à la fin du run quotidien. |

## 6. Priorité 4 : design (à faire valider par l'utilisateur avant de construire)

Mesuré à 1 630 px, conforme à la spec 10 : contenu de 1 400 px, colonne de 450 px (Games, Trophy Advisor) et de 320 px (page d'un jeu), bannière de 437 px, lignes de jeux de 79 px, jaquette de 60 px, lignes latérales de 66 px, en-tête de groupe de 111 px avec image de 100 px, ligne de trophée de 67 px, Plat Wall à 13 cases de 93 px. À 375 px : aucun défilement horizontal sur Games, page d'un jeu, Stats, Trophy Log et Plat Wall (4 cases par ligne), logo et jaquette masqués comme prévu. Police Sora en 14 px, aucune image chargée hors du site.

Retouches proposées, toutes mineures :

| N° | Constat | Proposition |
|---|---|---|
| D1 | **Menu sur téléphone** : les onglets défilent de côté sans aucun signe. À 375 px on voit « Games », « Plat Wall » et « Troph » coupé net par le bouton Settings. Trophy Log, Trophy Advisor et Stats ne se devinent pas. | Un fondu sur le bord droit, comme sur les graphiques de Stats (18.14), ou Settings réduit à son icône sous 640 px. |
| D2 | **Settings** : le champ de fichier est celui du navigateur, sans style (« Choisir un fichier », en français dans un site en anglais), et le texte « Automatic — last played game » posé sur l'aperçu de la bannière se lit mal sur une image claire. | Un bouton au style du site, et un fond sombre sous le texte de l'aperçu. |
| D3 | **Cibles tactiles petites** : « Edit » du Trophy cabinet (17 px de haut), « Show all » (24 px), « Sync now » (27 px). | Au moins 32 px de zone tactile sous 640 px, sans changer l'aspect. |
| D4 | **Ligne de jeu sur téléphone** : « Last played 11 Nov 2026 \| » finit par un séparateur seul quand le temps de jeu passe à la ligne. | Masquer le séparateur quand la ligne se coupe. |
| D5 | **Historique des synchros** : « 12434 trophies » sans séparateur de milliers, contrairement au format de la spec 8.1. | `formatInt` dans `app/(site)/(banner)/settings/page.tsx:125`. |
| D6 | **Animations réduites** (spec 10) : seuls le bouton de synchro et le minuteur du carrousel en tiennent compte. Les transitions au survol (cases du Plat Wall, parts d'anneau) restent. | Une règle `@media (prefers-reduced-motion:reduce)` qui coupe les `transition` de `app/globals.css`. |
| D7 | **En-tête de la liste Games à 375 px** : « Hide 0% games » et « 266 games » passent chacun sur deux lignes. | Passer le nombre et « Show all » sous le titre à cette largeur. |

Non défauts, vérifiés : les textes coupés par « … » dans la carte du carrousel sont ceux de la maquette validée (v12) ; « NieR Replicant ver.1.22474487139... » est le vrai nom du jeu.

## 7. Priorité 5 : qualité du code

| N° | Constat | Proposition |
|---|---|---|
| Q1 | **Pas de linter**, alors que 20 commentaires `eslint-disable` sont dans le code, dont deux `react-hooks/exhaustive-deps` que rien ne vérifie (`components/GameFilters.tsx:74`, `components/plat-wall/PlatWallControls.tsx:70`). | Installer ESLint avec `eslint-config-next`, l'ajouter au job `test` de la CI. |
| Q2 | **Doublons** : `pick` écrit 4 fois (`src/games/query.ts`, `src/plat-wall/query.ts`, `src/trophy-advisor/query.ts`, `src/trophy-log/query.ts`), `escapeLike` 2 fois, `earnedVisible` 2 fois (`src/cabinet/repo.ts:16`, `src/stats/trophies.ts:57`). | Les regrouper dans `src/lib/`. |
| Q3 | **Deux listes à défilement** : `components/GameList.tsx` avec `list-snapshot.ts`, et `components/ProgressiveList.tsx` avec `place-snapshot.ts`, qui font presque la même chose. | Passer Games sur `ProgressiveList`. Chantier à part, avec ses tests de retour arrière. |
| Q4 | **Paramètres inutilisés** : `_now` dans `computeMilestones` (`src/stats/milestones.ts:39`) et dans `upsertTitleRow` (`src/sync/title.ts:37`). | Les retirer. |
| Q5 | **Commentaire faux** dans `next.config.ts` : il dit que le proxy saute la page de connexion, alors que `proxy.ts` la traite. | Corriger la phrase (S1 a été corrigé sans elle). |
| Q6 | **Police téléchargée au build** : `app/layout.tsx` utilise `next/font/google`, donc le build dépend de Google Fonts, alors que `public/fonts/Sora-Variable.ttf` est déjà dans le dépôt pour l'export PNG. | `next/font/local` avec ce fichier : un build reproductible, sans réseau. |
| Q7 | **`app/globals.css`** : un seul fichier de 48 Ko pour tout le site. Lisible, mais chaque page le charge en entier. | Sans urgence. À découper par page en modules CSS si une nouvelle page arrive. |

Points forts à garder : pas un seul `any` ni `@ts-ignore` hors tests, aucun `TODO`, commentaires qui expliquent le pourquoi, dépendances injectées dans la synchro (horloge, `fetch`, pauses), caches indexés par instance de base.

## 8. Conformité à la spec, section par section

| Section | Verdict | Remarque |
|---|---|---|
| 2. Anti-objectifs | Conforme, sauf R1 | Bandeau « token expired » faux sur panne réseau. |
| 5. Accès et sécurité | Conforme | Voir S5 et S7 pour aller plus loin. |
| 6. Synchronisation | Conforme | 6 h, quotidien, incrémental, pauses et reprises, images locales. |
| 7. Données | Conforme | Tout ce que les pages demandent est stocké. |
| 8.1 à 8.8. Games | Conforme | Mesures et libellés vérifiés. Retouches D1, D4, D7. |
| 8.9. Page d'un jeu | Conforme | Aucune image rectangulaire, liens des guides corrects. |
| 9. Settings | Conforme, sauf D5 | Le token n'apparaît jamais dans la page (vérifié dans le HTML). |
| 10. Système visuel | Conforme, sauf D6 | Couleurs et proportions exactes. |
| 11. Déploiement | Conforme sur le papier | Non vérifiable ici. |
| 14. Non obtenables | Conforme | 5 jeux, liste à jour, garde-fous présents. |
| 15. Plat Wall | Conforme | 230 cases, sans fond ni ombre, coins de 12 px. Export non refait pendant l'audit. |
| 16. Trophy Log | Conforme | Numéros, heures avec secondes, ordre. Voir P1 pour « Show all ». |
| 17. Trophy Advisor | Conforme | 3 réglages, colonne de 41 jeux. Les réglages n'ont pas été actionnés (lecture seule). |
| 18. Stats | Conforme | Les 6 blocs dans l'ordre, niveau 530 sur « Do No Evil ». |
| 19. Suivis | **Écart sur 19.3.1** | S1. Le reste est en place dans le code. La vérification 19.9 était en cours dans l'autre session. *(12 novembre : S1 corrigé et 19.9 faite, PR #19 fusionnée.)* |

**Documentation à mettre à jour en fin de branche `fix/followups`** : `docs/ETAT-DU-PROJET.md` ne parle pas encore de cette branche, et sa section 3 liste toujours les vérifications du premier déploiement que la spec 19.2 demande de remplacer par un renvoi au guide. À faire par la session qui termine la branche, ou à vérifier après sa fusion. *(Fait dans la PR #19.)*

## 9. Ordre de travail conseillé

1. ~~**Attendre la fin de `fix/followups`**~~ : fusionnée (PR #19). Partir de `git switch main` puis `git pull`.
2. **Écrire la décision dans la spec** : une section 20 « Suites du check-up du 11 novembre 2026 », qui reprend les points retenus par l'utilisateur. Lui demander ce qu'il garde : S7 et toute la section 6 sont ses choix.
3. **Plan** dans `docs/superpowers/plans/` et branche `fix/audit` :
   - lot 1, avant le déploiement : P1, S2, R1 (S1 est fait) ;
   - lot 2, durcissement : S3, S4, S5, S6, R2 ;
   - lot 3, confort : P2, P3, P4, R3, Q1, Q2, Q4, Q5, Q6 ;
   - lot 4, design, après validation : D1 à D7.
4. **Vérifier avec les vraies données** (`docs/ETAT-DU-PROJET.md`, section 5), sur le build de production. Pour S1 et P1, lire les en-têtes d'une réponse réelle, connecté.
5. **Mettre à jour** `deploy/README.md` (gzip, HSTS, plages de confiance de nginx) et `docs/ETAT-DU-PROJET.md`.
6. Q3, P5, P6, P7, S8, S9 et Q7 peuvent attendre que le site tourne sur le NAS.
