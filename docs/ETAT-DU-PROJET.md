# PSN Tracker : état du projet et feuille de route

*Mis à jour le 12 novembre 2026 : les lots 1 et 2 de l'audit `a_reprendre.md` sont faits et vérifiés sur la branche `fix/audit` (PR à créer). Ensuite : la fusionner, puis déployer sur le NAS. Le reste de l'audit est noté comme non traité.*

Ce fichier sert de point de reprise. Une nouvelle conversation, même sur un autre PC, commence par le lire. Le fichier `CLAUDE.md` à la racine le demande automatiquement.

## 1. Le projet en bref
- Site **personnel** de suivi des trophées PSN du profil **Zmx969**. Un seul utilisateur, tout le site est derrière une connexion.
- Pourquoi : psnprofiles casse au-delà de 256 trophées par jeu et calcule la rareté sur ses propres membres ; pocketpsn est lent et payant.
- Stack : Next.js 16 (App Router, RSC), PostgreSQL (Drizzle), un worker de synchro PSN (psn-api + token NPSSO), Docker, nginx derrière le reverse proxy DSM d'un Synology DS1522+ (Portainer), CI GitHub Actions → GHCR.
- Documents de référence :

| Document | Rôle |
|---|---|
| `docs/superpowers/specs/2026-11-07-psn-tracker-design.md` | **La spec** : toutes les décisions de design. C'est l'autorité. |
| `docs/superpowers/specs/2026-11-07-psn-tracker-maquette-accueil.html` | Maquette validée de la page Games (v12), référence CSS. |
| `docs/superpowers/plans/2026-11-07-psn-tracker-phase1.md` | Le plan d'implémentation de la phase 1 (21 tâches). Terminé. |
| `docs/superpowers/specs/2026-11-08-psn-tracker-maquette-jeu.html` | Maquette validée de la page d'un jeu (v5). |
| `docs/superpowers/plans/2026-11-08-game-detail.md` | Le plan de la page d'un jeu (tâches 1 à 21, dont 13 à 21 ajoutées en cours de route). Terminé. |
| `docs/superpowers/plans/2026-11-08-phase1-suivis.md` | Points mis de côté et vérifications au premier déploiement. |
| `docs/superpowers/specs/2026-11-09-psn-tracker-maquette-nonobt.html` | Maquette validée des trophées non obtenables (v1). |
| `docs/superpowers/plans/2026-11-09-unobtainable.md` | Le plan des trophées non obtenables (13 tâches, plus une correction de la surbrillance verte). Terminé. |
| `docs/superpowers/specs/2026-11-09-psn-tracker-maquette-platwall.html` | Maquette validée du Plat Wall (v3). |
| `docs/superpowers/plans/2026-11-09-plat-wall.md` | Le plan du Plat Wall (8 tâches). Terminé. |
| `docs/superpowers/specs/2026-11-10-psn-tracker-maquette-trophylog.html` | Maquette validée du Trophy Log (v2), avec ses données intégrées. |
| `docs/superpowers/plans/2026-11-10-trophy-log.md` | Le plan du Trophy Log (tâches 1 à 9, dont 8 et 9 ajoutées après la vérification). Terminé. |
| `docs/superpowers/specs/2026-11-10-psn-tracker-maquette-advisor.html` | Maquette validée du Trophy Advisor (v4), avec ses données intégrées. |
| `docs/superpowers/plans/2026-11-11-trophy-advisor.md` | Le plan du Trophy Advisor (5 tâches). Terminé. |
| `docs/superpowers/specs/2026-11-11-psn-tracker-maquette-stats.html` | Maquette validée de la page Stats (v4), avec ses données intégrées. |
| `docs/superpowers/plans/2026-11-11-stats.md` | Le plan de la page Stats (tâches 1 à 7, dont la 7 ajoutée après la vérification). Terminé. |
| `docs/superpowers/specs/2026-11-11-psn-tracker-maquette-stats-defilement.html` | Maquette validée du graphique des années qui défile (v6). |
| `docs/superpowers/plans/2026-11-11-stats-touch.md` | Le plan des infobulles au doigt et du défilement de côté (3 tâches). Terminé. |
| `docs/superpowers/specs/2026-11-11-psn-tracker-maquette-suivis.html` | Maquette validée des compteurs du bandeau sur téléphone (v2, version B). |
| `docs/superpowers/plans/2026-11-11-followups.md` | Le plan des points de suivi de la phase 1 (14 tâches). Terminé. |
| `a_reprendre.md` | Audit complet du 11 novembre 2026, écrit par une autre session : points à vérifier ou corriger un jour, par priorité. S1 est corrigé (PR #19) ; P1, S2, R1, S3, S4, S5, S6 et R2 sont faits sur `fix/audit` (spec 20) ; chaque autre point est marqué « Non traité ». |
| `docs/superpowers/plans/2026-11-12-audit.md` | Le plan des lots 1 et 2 de l'audit (10 tâches). Terminé sur `fix/audit`. |
| `deploy/README.md` | Guide pas à pas du déploiement sur le NAS. |
| `.superpowers/brainstorm/maquettes/` | Toutes les maquettes intermédiaires : `accueil-v1` à `v12`, `jeu-v1` à `v6` (la v6 compare les images de groupe : carrées ou absentes), `platwall-v1` à `v3`, `trophylog-v1` et `v2`, `advisor-v1` à `v4`, `stats-v1` à `v6` (les v5 et v6 : le graphique des années qui défile), `suivis-v1` et `v2` (compteurs du bandeau sur téléphone, tuile des images à coins arrondis). |

## 2. Ce qui est fait (dans `main`)

### Phase 1 (PR #1)
- **Socle :**
  - connexion unique avec session glissante, limite de tentatives par IP ;
  - token NPSSO chiffré (AES-256-GCM) ;
  - synchro PSN toutes les 6 h et « Sync now », rafraîchissement quotidien des raretés et des DLC ;
  - jeux de plus de 256 trophées gérés ; images stockées en local avec miniatures WebP 192 px.
- **Page Games** :
  - bannière ;
  - bandeau profil (niveau et icône PSN, compteurs) ;
  - 6 cases de stats ;
  - carrousel des derniers trophées ;
  - liste des jeux : filtres (dont 0 %), tris, recherche, défilement infini 50 par 50, toggle « Hide 0% games » enregistré en base ;
  - colonne latérale : Trophy cabinet (éditeur), trophées les plus rares et répartition par rareté, milestones (règles psnprofiles) ;
  - la page se met à jour toute seule après une synchro.
- **Page Settings** : bannière (envoi depuis le PC et position), token NPSSO avec tuto, historique des synchros en direct, déconnexion.
- **Déploiement** : image Docker unique (app + worker), CI (tests, smoke Postgres, build et publication de l'image sur `main`, 3 dernières images gardées), deux stacks Portainer, nginx.
- **Vérifié avec les vraies données** : 266 jeux et 11 624 trophées, chiffres conformes à la console et à psnprofiles.
- **Menu** : les onglets Trophy Log, Trophy Advisor et Stats existent déjà et mènent à une page « Coming soon ».

### Page de détail d'un jeu (PR #4, fusionnée le 9 novembre 2026)
- **Page `/games/[id]`** (spec 8.9), conforme à la maquette v5 :
  - bannière du jeu (image 4K du PSN) avec son logo, ou bannière choisie à la main pour 5 jeux anciens, ou rien sur fond uni ;
  - bandeau, liste des trophées avec groupes DLC, filtre et tri, compteurs des trophées à paliers ;
  - **aucune image rectangulaire** : icônes d'origine en PS5, jaquette du jeu en PS4. Une image non carrée est posée sur une tuile carrée qui prend la couleur de son bord, comme Marvel Heroes Omega ;
  - colonne de 320 px : jaquette, totaux et points, raretés, éditeur, genre, date de sortie, liens PowerPyx et psnprofiles, Timeline.
- **Synchro** :
  - concept du jeu, catalogue PSN (éditeur, genres, date de sortie) ;
  - objectifs et progression des trophées à paliers ;
  - rattrapage unique des listes PS5 (migration 0005).
- **Emprunt** : une info manquante est prise chez une autre version du même jeu, PS5 d'abord.
- **Games** :
  - bannière automatique (dernier jeu joué) sans bannière personnalisée ;
  - tri par défaut « Last trophy », en tête du menu, dans l'ordre de la console (date de mise à jour de la liste au PSN) ;
  - retour au même endroit de la liste avec « précédent » ;
  - répartition par rareté centrée.
- **Vérifié avec les vraies données** :
  - le 8 novembre 2026 : Cyberpunk 2077, Gran Turismo 7, FFXIV Online, Phantom Blade Zero, SAROS, Nioh 3, The Last of Us Part II Remastered, Dauntless, et les 5 jeux à bannière manuelle ;
  - le 9 novembre 2026 : les 168 listes PS4, sans aucune image rognée ni rectangulaire. Seules 4 n'ont pas de jaquette carrée et utilisent la tuile : Game of Thrones, Marvel Heroes Omega, Minecraft: Story Mode et Tales from the Borderlands.
- 57 fichiers de tests, 422 tests.

### Trophées non obtenables (PR #6, fusionnée le 9 novembre 2026, spec section 14)
- **Données** : le worker télécharge la liste une fois par jour, indépendamment du token PSN, et marque chaque trophée concerné en base (`trophies.unobtainable`). Trophy Advisor pourra s'en servir tel quel.
- **Games** : bouton « Show all », filtre « With / Without unobtainable », « ! » avec infobulle (nombre et cause).
- **Page d'un jeu** : bandeau avec le nombre et la cause, « ! » sur chaque trophée concerné, rouge s'il n'est pas obtenu, vert s'il l'est.
- **Settings** : état du téléchargement et adresse de la liste.
- **Correction au passage** : la surbrillance verte des trophées obtenus ne s'affichait pas depuis la PR #4 (couleurs jamais définies sur le site).
- **Vérifié avec les vraies données** le 9 novembre 2026 : Gran Turismo Sport 7, Marvel Heroes Omega 37, Final Fantasy XV 10, Dauntless PS4 45 et PS5 46, aucun autre jeu.
- 64 fichiers de tests, 552 tests.

### Page Plat Wall (PR #9, fusionnée le 9 novembre 2026, spec section 15)
- **Page `/plat-wall`** : la miniature du trophée de chaque platine obtenu, sans limite d'affichage, avec Display (Art, Rarity, Name), année, plateforme et tri. Bulle au survol, clic vers la page du jeu.
- **Export PNG** : le bouton ouvre un aperçu, et « Download PNG » enregistre l'image (2896 px de large, 13 colonnes), avec le bandeau, les 6 cases et le mur filtré.
- **Fabrication** : faite par le serveur avec `sharp`. Le texte est dessiné en Sora avec `fontkit` et la police du dépôt (`public/fonts/`), car l'image Docker n'a aucune police.
- **Stockage** : aucune image n'est écrite sur le disque. Seule la dernière reste en mémoire vive, 10 minutes au maximum.
- **Vérifié avec les vraies données** le 9 novembre 2026 : 230 platines, nombres par année et par plateforme, Never Fade Away pour Cyberpunk 2077, Endfield sans fond, noms à caractères spéciaux, aperçu sur PC et en affichage téléphone, aucun fichier ajouté après plusieurs exports.
- **Build Docker** : il échoue si l'export ne peut pas charger `sharp`, `fontkit` ou la police (`scripts/check-export-deps.cjs`). Job `image` de la CI vert sur la PR #9.
- 78 fichiers de tests, 663 tests.

### Page Trophy Log (PR #11, fusionnée le 10 novembre 2026, spec section 16)
- **Page `/trophy-log`** : tous les trophées obtenus, une ligne par trophée, comme le Trophy Log de psnprofiles.
  - Chaque ligne : image du jeu (lien), icône sans fond, nom, description, jeu (lien), DLC, plateformes, numéro d'obtention, date et heure avec les secondes, rareté PSN, type.
  - Tri : Date earned, Alphabetical, Rarity, avec un bouton de sens.
  - Filtres : plateforme, rareté, type ; Reset remet tout par défaut.
  - Chargement : 50 lignes, puis 50 de plus au défilement. « Show all » affiche le reste par paquets, sans figer la page.
  - Retour depuis une page de jeu : même endroit, même après « Show all ».
- **Numéro d'obtention** : à la même seconde, le platine passe après le dernier trophée de son jeu. Une seule règle sert aux milestones, au tri « Date earned » de la page d'un jeu et au Trophy Log (`src/lib/earned-order.ts`).
- **Ailleurs sur le site** :
  - plus aucun fond derrière les icônes de trophées (test `app/icon-backgrounds.test.ts`) ;
  - les heures d'obtention ont les secondes (page d'un jeu, Timeline, carrousel, milestones) ;
  - le platine passe en dernier dans le tri « Date earned » de la page d'un jeu.
- **Vérifié avec les vraies données** le 10 novembre 2026, sur le build de production :
  - 11 636 trophées, et les 16 milestones « Nth trophy » tombent sur les bons numéros ;
  - Magicka 2 et Hellblade, filtres, tris, Reset, défilement ;
  - « Show all » : premières lignes en 0,6 s, liste complète en 4 s, la page ne se fige jamais plus de 150 ms ;
  - retour après « Show all » sur la même ligne ;
  - affichage téléphone.
- 87 fichiers de tests, 756 tests. Le job `pg-smoke` de la CI exécute aussi la requête du Trophy Log sur un vrai PostgreSQL 16. CI verte sur la PR #11.

### Page Trophy Advisor (PR #13, fusionnée le 11 novembre 2026, spec section 17)
- **Page `/trophy-advisor`** : tous les trophées non obtenus, une ligne par trophée, comme le Trophy Advisor de psnprofiles.
  - Tri : Rarity (par défaut, du plus courant au plus rare) ou Alphabetical, avec un bouton de sens.
  - Filtres : plateforme, rareté, type ; Reset remet tout par défaut.
  - Trois réglages enregistrés en base : « Hide unobtainable », « Hide DLC » et « DLC only » (ces deux derniers s'excluent).
  - Défilement 50 par 50, « Show all » après le nombre, retour au même endroit depuis une page de jeu.
- **Colonne « Incomplete games »** : les jeux qui ne sont pas à 100 %, du plus de trophées manquants au moins. Le compteur suit les trois réglages.
- **Ailleurs** :
  - sur Games, « Show all » est passé après le nombre ;
  - le défilement, le retour et les contrôles du Trophy Log sont devenus des composants partagés (`components/ProgressiveList.tsx`, `components/place-snapshot.ts`, `components/trophy-log/ControlParts.tsx`, `src/lib/trophy-filters.ts`).
- **Vérifié avec les vraies données** le 11 novembre 2026, sur le build de production :
  - 798 trophées et 41 jeux, et les nombres des 6 combinaisons de réglages (spec 17.3) ;
  - le compteur de chaque jeu correspond à ses lignes dans la liste complète ;
  - filtres, tris, Reset, « Show all », retour depuis la liste et depuis la colonne, réglages gardés après un rechargement ;
  - affichage téléphone.
- 96 fichiers de tests, 828 tests. La migration 0007 s'applique au démarrage du worker. Le job `pg-smoke` exécute aussi les requêtes du Trophy Advisor.

### Page Stats (PR #15, fusionnée le 11 novembre 2026, spec section 18)
- **Page `/stats`**, de haut en bas :
  - le calendrier « Last 12 months », qui remplace le « Last 60 days », avec en dessous les trophées, les platines, le meilleur jour et la plus longue série de jours ;
  - 4 camemberts : rareté, complétion, points PSN, plateformes (PS5 et PS4 seulement) ;
  - « Monthly activity » et « Trophy progression » depuis novembre 2016 ;
  - « Trophies by time » et « Trophies by day », à l'heure de Paris ;
  - les jeux par année de sortie, par éditeur et par genre ;
  - le Level history : la courbe du niveau, un point tous les 10 niveaux, puis le trophée qui a fait passer chaque palier.
- **Éditeur, pas développeur** : le PSN ne donne que l'éditeur. Les noms bruts sont raccourcis par une liste dans `src/stats/publisher-names.ts`.
- **Graphiques** : dessinés en SVG par le site, sans bibliothèque (`components/stats/`). Le serveur ne transmet que des totaux.
- **Niveau** : le calcul de `src/stats/level-history.ts` ne sert qu'à cette page. Le bandeau profil garde le niveau du PSN.
- **Ailleurs** : la page « Coming soon » n'a plus d'usage, elle est retirée.
- **Vérifié avec les vraies données** le 11 novembre 2026, sur le build de production :
  - 11 636 trophées, 350 850 points, 53 paliers. Les paliers 490 à 530 tombent sur les mêmes trophées que psnprofiles, à la seconde près ;
  - la somme des mois, des heures et des jours vaut le nombre de trophées, et les années plus les jeux sans date valent 266 ;
  - la page répond en 200 à 250 ms ;
  - affichage téléphone, sans défilement horizontal.
- 110 fichiers de tests, 968 tests. Aucune migration.

### Stats au doigt et défilement de côté (PR #17, fusionnée le 11 novembre 2026, spec section 18.14)
- **Infobulles au doigt** : elles s'affichent tant que le doigt est posé, au-dessus de lui, et disparaissent quand il se lève. Sur les courbes, la ligne verticale suit le doigt qui glisse de côté. Un appui long n'ouvre pas de menu, et les mises en valeur du survol ne valent qu'à la souris.
- **Défilement de côté sans barre** (`components/stats/useSideScroll.ts`) :
  - le graphique des années garde des colonnes d'au moins 18 px. Quand elles ne tiennent plus, l'axe reste fixe et les colonnes défilent, ouvertes sur les années récentes ;
  - le calendrier défile de la même façon sous 860 px ;
  - clic maintenu à la souris, deux doigts sur le pavé tactile, glissement du doigt sur téléphone, avec un fondu du côté des années cachées.
- **Vérifié avec les vraies données** le 11 novembre 2026, sur le build de production :
  - sur PC, le graphique des années ne défile pas et n'a pas changé ;
  - en largeur téléphone, il s'ouvre sur '26, sans barre ni défilement horizontal de la page, et se déplace au clic maintenu. Le calendrier pareil ;
  - le doigt, simulé, sur une colonne, une part d'anneau, un jour, une courbe et une année.
- **À essayer sur un vrai appareil** : l'écran tactile du téléphone et le pavé tactile du Mac, qu'on ne peut pas tester ici.
- 112 fichiers de tests, 1 009 tests. Aucune migration.

### Points de suivi de la phase 1 (PR #19, fusionnée le 12 novembre 2026, spec section 19)
Tous les points mis de côté pendant la phase 1 sont réglés, à la demande de l'utilisateur, avant le déploiement :
- **Robustesse et sécurité** :
  - le site refuse d'être affiché dans une autre page, et les images de `/media` ne peuvent exécuter aucun script ;
  - une page d'attente « Updating… » s'affiche tant que le worker n'a pas mis la base à jour, au lieu d'une erreur ;
  - « Couldn't reach PSN. Try again. » quand le PSN est injoignable, et le champ npsso garde le texte collé après une erreur ;
  - une demande « Sync now » vit jusqu'à la fin de la synchro, abandonnée après 3 échecs ;
  - les définitions sont rechargées si la langue PSN change, les jeux sans liste sont revérifiés chaque jour, une rareté vide du PSN n'efface plus une valeur connue ;
  - la CI vérifie que le worker démarre depuis son paquet final.
- **Performance** : la table des images et les milestones restent en mémoire jusqu'à la fin de la synchro suivante ; après une synchro sans échec, le worker supprime les images que plus rien n'utilise.
- **Interface** :
  - « Sync now » ne réapparaît plus avant la fin de la synchro ;
  - le carrousel n'est en pause que tant que le doigt est posé ;
  - la liste des jeux ne s'arrête plus sur une page de doublons, et « Hide 0% games » garde le focus du clavier ;
  - sur téléphone, le total des trophées prend toute la largeur et les 4 types sont en dessous (maquette v2, version B).
- **Tuile** : la couleur est calculée par le worker et affichée dès le premier rendu. La règle ne change pas : les 3 images à coins arrondis ne sont affichées nulle part sur une tuile.
- **Guide de déploiement** : les vérifications du premier déploiement sont à l'étape 7 de `deploy/README.md`, chacune avec le moment où la faire.
- **Migration 0008** : quatre colonnes, appliquées par le worker à son démarrage.
- **Vérifié avec les vraies données** le 11 novembre 2026, sur le build de production :
  - la page d'attente avant la migration, puis le site normal une fois le worker démarré ;
  - une vraie synchro : couleur de tuile de 13 357 images calculée, aucune image supprimée à tort, aucune image manquante sur les pages ;
  - compteurs à 375 et 320 px, « Sync now », le bouton « Hide 0% games » au clavier, le champ npsso ;
  - temps de réponse : 90 à 150 ms pour Games, environ 200 ms pour Stats ;
  - les en-têtes de protection, lus sur le serveur réel : `sandbox` sur les images de `/media` (un défaut trouvé ici, puis corrigé), anti-cadre partout.
- **CI verte** sur github.com après la fusion. Reste à vérifier sur le NAS ce que décrit le guide, étape 7.
- 122 fichiers de tests, 1 121 tests. Migration 0008.

### Suites de l'audit, lots 1 et 2 (branche `fix/audit`, spec section 20, PR à créer)
L'utilisateur a choisi le 12 novembre 2026 de traiter, avant le déploiement, les lots 1 et 2 de l'audit `a_reprendre.md` :
- **P1, compression** : nginx compresse les réponses JSON (Next ne le fait pas pour `/api` : 6,4 Mo pour « Show all » du Trophy Log), aussi pour les requêtes HTTP/1.0 du proxy DSM.
- **S2, serveurs de test** : `e2e:web` et le nouveau `e2e:prod` n'écoutent que sur `127.0.0.1`.
- **R1, token PSN** : `psn-api` ne signalait jamais un refus, donc un vrai token refusé n'affichait jamais « PSN token expired ». Le site distingue maintenant :
  - le refus (bandeau « PSN token expired ») ;
  - le PSN injoignable (« Couldn't reach PSN » dans l'historique, sans bandeau) ;
  - toute autre erreur (« PSN token refresh failed (…) »).
  Le renouvellement a un délai de 20 s, et une réponse qui arrive après ce délai est quand même enregistrée.
- **S3, en-têtes** : `Referrer-Policy: same-origin` et `nosniff` partout, plus de `X-Powered-By`, `noreferrer` sur les liens PowerPyx et PSNProfiles. HSTS se coche dans la règle du proxy DSM (guide, étape 6).
- **S4, vraie adresse du client** : nginx ne fait plus confiance qu'au pont Docker et à la boucle locale. Un job de la CI, `nginx-smoke`, lance le vrai nginx avec le vrai `default.conf` et vérifie la compression et le refus d'une adresse inventée.
- **S5, sessions** : la base ne garde que l'empreinte SHA-256 de l'identifiant, et une session non vue depuis 400 jours est supprimée. La migration 0009 convertit les sessions existantes : personne n'est déconnecté.
- **S6, connexion** : un identifiant ou un mot de passe de plus de 256 caractères est refusé sans calcul bcrypt, et le compteur de tentatives oublie les adresses qui ne reviennent pas.
- **R2, images** : un téléchargement est abandonné après 30 s et retenté à la synchro suivante.
- **Guide de déploiement** : sous-réseau de `psn-net` (étape 3), HSTS (étape 6), nouveaux en-têtes, compression et vraie adresse dans le journal de nginx (étape 7, points 5, 8 et 11), `default.conf` à remplacer sur le NAS (étape 8).
- **Vérifié avec les vraies données** le 12 novembre 2026, sur le build de production :
  - page d'attente avant la migration 0009, puis les 4 sessions converties, la session d'avant la migration toujours valide, une session vieillie de 401 jours refusée et supprimée, déconnexion et reconnexion ;
  - PSN bloqué pour le seul worker : « Couldn't reach PSN » dans l'historique, sans bandeau, statut inchangé ; puis un vrai renouvellement et une synchro complète ;
  - en-têtes lus sur une page, une réponse `/api` et une image `/media` ;
  - un mot de passe trop long ; l'écoute sur `127.0.0.1` seulement.
- **Non vérifiable ici** : le job `nginx-smoke` et la vérification des sessions dans `pg-smoke`, à regarder sur github.com ; la compression, HSTS et la vraie adresse, sur le NAS (guide, étape 7).
- 123 fichiers de tests, 1 145 tests. Migration 0009.

## 3. Ce qui reste à faire, dans l'ordre
1. **Déployer sur le NAS** en suivant `deploy/README.md` (décidé le 9 novembre 2026). Les points de suivi sont fusionnés (PR #19). Fusionner d'abord `fix/audit` (lots 1 et 2 de l'audit), puis copier son `deploy/nginx/default.conf` sur le NAS.
   - Avant tout, vérifier sur github.com (onglet Actions, le dépôt est privé) que la CI de `main` est verte après la dernière fusion, et que l'image a été publiée.
   - Juste après la première publication, donner une seule fois le rôle **Admin** au dépôt dans « Manage Actions access » du package GHCR (étape 1.5).
   - Faire les vérifications du premier déploiement de l'étape 7 du guide. Chacune dit quand la faire et ce qu'on doit voir.
2. **Points de l'audit** (`a_reprendre.md`) :
   - les lots 1 et 2 sont faits sur la branche `fix/audit` (PR à créer et fusionner, puis vérifier la CI) ;
   - restent, non traités par décision du 12 novembre 2026 : le lot 3 (P2, P3, P4, R3, Q1, Q2, Q4, Q5, Q6), S7 (garder ou non le npsso, choix de l'utilisateur), les retouches de design D1 à D7 (à valider sur maquette avant toute construction), et les points laissés pour après le NAS (Q3, P5, P6, P7, S8, S9, Q7). Chaque point porte sa mention dans le fichier.
3. **Points laissés tels quels** : `docs/superpowers/plans/2026-11-08-phase1-suivis.md` marque chaque point réglé ; ce qui reste est un choix assumé (coins transparents de la tuile, spec 19.6).

## 4. Comment reprendre dans une nouvelle conversation
Pour démarrer une page, il suffit de le dire, par exemple « On attaque Trophy Log ». Avec le plugin superpowers installé (voir 6), Claude lance de lui-même le bon processus. Pour être sûr, on peut aussi le demander explicitement : « utilise le skill brainstorming ».

Avant de créer une branche : `git switch main` puis `git pull`, pour partir de la dernière version.

Le processus suivi pour chaque page :
1. **Brainstorming** (`superpowers:brainstorming`) :
   - questions une par une, en français ;
   - maquettes HTML montrées dans le navigateur de l'app : configuration « maquettes » de `.claude/launch.json`, servie par Python sur le port 8765. Les maquettes vont dans `.superpowers/brainstorm/maquettes/`, qui est versionné ;
   - on itère jusqu'à validation. En cas de doute sur la présentation d'un élément, Claude demande une capture d'écran de psnprofiles ou pocketpsn (pocketpsn est derrière Cloudflare) ;
   - la décision est écrite dans la spec, ou dans une nouvelle spec `docs/superpowers/specs/AAAA-MM-JJ-<sujet>-design.md`, et la maquette validée est copiée dans `docs/superpowers/specs/`.
2. **Plan** (`superpowers:writing-plans`) dans `docs/superpowers/plans/AAAA-MM-JJ-<sujet>.md`.
3. **Exécution « Subagent-driven »** (`superpowers:subagent-driven-development`) :
   - sur une branche `feat/<sujet>` ;
   - un agent implémente chaque tâche, un autre la relit, puis une relecture finale porte sur toute la branche ;
   - le journal de suivi est dans `.superpowers/sdd/`, qui est **local et ignoré par git**. Il vaut donc mieux finir un plan sur le même PC. Sinon, la progression se relit dans `git log` et dans ce fichier.
   - Un retour de l'utilisateur en cours de route devient une nouvelle tâche à la fin du plan, après mise à jour de la spec (c'est ainsi que les tâches 13 à 21 de la page d'un jeu ont été ajoutées).
4. **Vérification avec les vraies données**, en local (voir 5) : tu colles toi-même ton NPSSO dans Settings.
5. **Fin de branche** :
   - Pull Request `feat/<sujet>` → `main` créée depuis ton navigateur (`gh` n'est pas installé) ;
   - tu vérifies que la CI est verte, puis tu fusionnes ;
   - l'image est republiée et Portainer la redéploie.
6. **Toujours** : un commit et un push après chaque étape terminée, pour pouvoir changer de PC à tout moment.

## 5. Tester en local avec les vraies données
Le site et le worker ont besoin d'une même base. On utilise PGlite servi comme un Postgres (`@electric-sql/pglite-socket`, avec un correctif dans `scripts/e2e/db.mjs`). Tout ce qui est généré va dans `.data/`, qui est ignoré par git : base, images téléchargées et identifiant de test restent sur le PC.

```bash
npm run e2e:env      # une fois par PC : crée .data/e2e.env avec un identifiant de test (ligne 2 du fichier)
npm run e2e:db       # base sur 127.0.0.1:5433 (à laisser tourner)
npm run e2e:worker   # worker de synchro (à laisser tourner, applique les migrations)
npm run e2e:web      # site sur http://127.0.0.1:3000 (ou configuration « e2e-web » du navigateur de l'app)
npm run e2e:prod     # site en mode production sur http://127.0.0.1:3000 (lancer « npm run build » avant)
npm run e2e:sql -- "select count(*) from titles"   # requête SQL ponctuelle
```

`e2e:prod` et `e2e:web` utilisent tous deux le port 3000 : un seul des deux tourne à la fois.

Ensuite : se connecter avec l'identifiant de test, coller le NPSSO dans Settings, puis attendre la première synchro (~15 min pour 266 jeux).

- Le worker exécute le code source (tsx) : après une modification de la synchro, il faut le redémarrer.
- Sous Windows, arrêter `npm run e2e:worker` n'arrête que npm : les processus `node.exe` du worker continuent. Avant de le relancer, les arrêter, sinon plusieurs workers synchronisent en même temps.

## 6. Mettre en place un autre PC
1. Cloner `https://github.com/Zedemix-dev/psn-tracker` (dépôt privé), puis `npm ci`.
2. Dans Claude Code, installer les plugins **superpowers** et **frontend-design**, depuis le marketplace officiel `claude-plugins-official`. Sans superpowers, les skills du processus (brainstorming, plans, subagent-driven) n'existent pas.
3. Pour les tests en local : `npm run e2e:env`.
4. `AGENTS.md` (consignes Next.js 16 que `CLAUDE.md` demande de lire) est ignoré par git : il est créé au premier `npm run dev` ou `npm run e2e:web`. Les guides de Next sont dans `node_modules/next/dist/docs/` après `npm ci`.
5. Python n'est utile que pour servir les maquettes. Le chemin de Python dans la configuration « maquettes » de `.claude/launch.json` est propre au PC d'origine : l'adapter si besoin.
6. La mémoire de Claude est propre à chaque PC. Ce qui doit suivre est dans ce fichier et dans `CLAUDE.md`.

## 7. Décisions et préférences à respecter
- **Langues** : la conversation en **français**. Le site est entièrement en **anglais**, y compris les noms des jeux et des trophées (`Accept-Language` en-GB). Le code et les messages de commit sont en anglais.
- **Style** : style « Console » ; couleurs de progression par rang : S #667FB2, A #008000, B #7B9E00, C #A68E00, D #A66A00, E #FF4100, F #EE0000. Les icônes officielles fournies par l'utilisateur sont dans `public/icons/` ; pas de liens vers les images de psnprofiles : toute image est téléchargée et servie par le site.
- **Images** : aucune image rectangulaire, nulle part (spec 8.9). Les cas à la marge (5 bannières choisies à la main) sont une liste écrite dans le code, `src/games/banner-overrides.ts`.
- **Sauvegardes** : **aucune dans l'app**. Le RAID SHR du NAS s'en charge (« ne rien faire »).
- **Validation** : rien n'est construit tant que la maquette ou la description n'a pas été validée.
- **Sécurité** : Claude ne saisit jamais le vrai NPSSO. C'est toujours l'utilisateur qui le colle.
