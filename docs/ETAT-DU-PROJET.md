# PSN Tracker : état du projet et feuille de route

*Mis à jour le 9 novembre 2026 : les trophées non obtenables sont fusionnés dans `main` (PR #6). La phase 1 est terminée. Prochaine étape : le déploiement sur le NAS.*

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
| `deploy/README.md` | Guide pas à pas du déploiement sur le NAS. |
| `.superpowers/brainstorm/maquettes/` | Toutes les maquettes intermédiaires : `accueil-v1` à `v12`, `jeu-v1` à `v6` (la v6 compare les images de groupe : carrées ou absentes). |

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
- **Menu** : les onglets Plat Wall, Trophy Log, Trophy Advisor et Stats existent déjà et mènent à une page « Coming soon ».

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

## 3. Ce qui reste à faire, dans l'ordre
1. **Déployer sur le NAS** en suivant `deploy/README.md`.
   - Avant tout, vérifier sur github.com (onglet Actions, le dépôt est privé) que la CI de `main` est verte après la fusion de la PR #6, et que l'image a été publiée.
   - Juste après la première publication, donner une seule fois le rôle **Admin** au dépôt dans « Manage Actions access » du package GHCR (étape 1.5).
   - Faire les vérifications du premier déploiement listées dans `docs/superpowers/plans/2026-11-08-phase1-suivis.md`.
   - À la première synchro de cette version, toutes les listes PS5 sont rechargées une fois (migration 0005), ce qui la rallonge de quelques minutes.
   - Au premier démarrage du worker, la migration 0006 s'applique et la liste des trophées non obtenables se télécharge. Vérifier dans Settings que le bloc « Unobtainable trophies » indique « Up to date » et « 5 of yours ».
2. **Pages suivantes**, chacune avec **son propre brainstorming** (spec, section 3) :
   - **Plat Wall** ;
   - **Trophy Log** ;
   - **Trophy Advisor** : les trophées non obtenus sont déjà stockés avec leur rareté. Le toggle « Hide 0% games » doit aussi en retirer les jeux à 0 %. Son filtre des trophées non obtenables s'appuie sur la colonne `trophies.unobtainable`, déjà remplie (spec 14.2) ;
   - **Stats** : elle reçoit le calendrier « Last 60 days », déjà décrit dans la spec, section 3.
3. **Points de suivi** : à piocher dans `docs/superpowers/plans/2026-11-08-phase1-suivis.md` quand une page touche le même code.

## 4. Comment reprendre dans une nouvelle conversation
Pour démarrer une page, il suffit de le dire, par exemple « On attaque le Plat Wall ». Avec le plugin superpowers installé (voir 6), Claude lance de lui-même le bon processus. Pour être sûr, on peut aussi le demander explicitement : « utilise le skill brainstorming ».

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
npm run e2e:web      # site sur http://localhost:3000 (ou configuration « e2e-web » du navigateur de l'app)
npm run e2e:sql -- "select count(*) from titles"   # requête SQL ponctuelle
```

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
