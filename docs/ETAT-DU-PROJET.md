# PSN Tracker : état du projet et feuille de route

*Mis à jour le 8 novembre 2026 au soir : la page de détail d'un jeu est terminée sur la branche `feat/game-detail`, en attente de Pull Request.*

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
| `docs/superpowers/plans/2026-11-07-psn-tracker-phase1.md` | Le plan d'implémentation de la phase 1 (21 tâches). |
| `docs/superpowers/specs/2026-11-08-psn-tracker-maquette-jeu.html` | Maquette validée de la page d'un jeu (v5). |
| `docs/superpowers/plans/2026-11-08-game-detail.md` | Le plan de la page d'un jeu (tâches 1 à 17, dont 13 à 17 ajoutées en cours de route). |
| `docs/superpowers/plans/2026-11-08-phase1-suivis.md` | Points mis de côté et vérifications au premier déploiement. |
| `deploy/README.md` | Guide pas à pas du déploiement sur le NAS. |
| `.superpowers/brainstorm/maquettes/` | Toutes les maquettes intermédiaires (`accueil-v1` à `v12`, `jeu-v1` à `v5`). |

## 2. Ce qui est fait (phase 1, dans `main`)
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

### Sur la branche `feat/game-detail` (en attente de fusion)
- **Page de détail d'un jeu** (`/games/[id]`, spec 8.9), conforme à la maquette v5 :
  - bannière du jeu (image 4K du PSN) avec son logo, ou bannière choisie à la main pour 5 jeux anciens, ou rien sur fond uni ;
  - bandeau, liste des trophées avec groupes DLC, filtre et tri, compteurs des trophées à paliers ;
  - colonne de 320 px : jaquette, totaux et points, raretés, éditeur, genre, date de sortie, liens PowerPyx et psnprofiles, Timeline.
- **Synchro** :
  - concept du jeu, catalogue PSN (éditeur, genres, date de sortie) ;
  - objectifs et progression des trophées à paliers ;
  - rattrapage unique des listes PS5 (migration 0005).
- **Emprunt** : une info manquante est prise chez une autre version du même jeu, PS5 d'abord.
- **Games** :
  - bannière automatique (dernier jeu joué) sans bannière personnalisée ;
  - tri par défaut « Last trophy », en tête du menu ;
  - retour au même endroit de la liste avec « précédent » ;
  - répartition par rareté centrée.
- **Vérifié avec les vraies données** le 8 novembre 2026 : Cyberpunk 2077, Gran Turismo 7, FFXIV Online, Phantom Blade Zero, SAROS, Nioh 3, The Last of Us Part II Remastered, Dauntless, et les 5 jeux à bannière manuelle.

## 3. Ce qui reste à faire, dans l'ordre
1. **Déployer sur le NAS** en suivant `deploy/README.md`.
   - Juste après la première publication, donner une seule fois le rôle **Admin** au dépôt dans « Manage Actions access » du package GHCR (étape 1.5).
   - Faire les vérifications du premier déploiement listées dans `docs/superpowers/plans/2026-11-08-phase1-suivis.md`.
2. **Page de détail d'un jeu** : terminée sur la branche `feat/game-detail` (voir 2). Il reste à **créer la Pull Request** vers `main` sur GitHub, vérifier que la CI est verte, puis la fusionner. La phase 1 sera alors terminée.
   - Au premier déploiement de cette version, la synchro recharge une fois toutes les listes PS5 (migration 0005), ce qui la rallonge de quelques minutes.
3. **Jeux aux trophées non obtenables** (demandé le 8 novembre 2026, spec section 14) : à faire **à part**, après la page de détail, sur la branche `feat/unobtainable`, avec son propre cadrage.
   - Un bouton dans l'en-tête de la liste Games pour afficher tous les jeux d'un coup, sans défiler.
   - Un filtre séparé « With unobtainable » / « Without unobtainable », désactivé par défaut, qui s'ajoute aux autres filtres.
   - Un « ! » après le badge PS4/PS5 des jeux concernés dans la liste Games, avec une infobulle qui donne le nombre de trophées non obtenables.
   - Sur la page d'un jeu, un « ! » à côté de chaque trophée non obtenable. Le trophée a une légère surbrillance rouge s'il n'est pas obtenu, et garde sa surbrillance verte s'il l'est.
   - Dans Settings, l'adresse de la liste des jeux concernés, modifiable. Adresse actuelle : `https://psnp-plus.huskycode.dev/list.json`.
   - La liste ne donne pas l'identifiant PSN des jeux : rapprochement par nom et plateforme (5 de tes jeux reconnus le 8 novembre 2026).
4. **Pages suivantes**, chacune avec **son propre brainstorming** (spec, section 3) :
   - **Plat Wall** ;
   - **Trophy Log** ;
   - **Trophy Advisor** : les trophées non obtenus sont déjà stockés avec leur rareté. Le toggle « Hide 0% games » doit aussi en retirer les jeux à 0 % ;
   - **Stats** : elle reçoit le calendrier « Last 60 days », déjà décrit dans la spec, section 3.
5. **Points de suivi** : à piocher dans `docs/superpowers/plans/2026-11-08-phase1-suivis.md` quand une page touche le même code.

## 4. Comment reprendre dans une nouvelle conversation
Pour démarrer une page, il suffit de le dire, par exemple « On attaque la page de détail d'un jeu ». Avec le plugin superpowers installé (voir 6), Claude lance de lui-même le bon processus. Pour être sûr, on peut aussi le demander explicitement : « utilise le skill brainstorming ».

Le processus suivi pour la page Games, à refaire pour chaque page :
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
4. **Vérification avec les vraies données**, en local (voir 5) : tu colles toi-même ton NPSSO dans Settings.
5. **Fin de branche** :
   - Pull Request `feat/<sujet>` → `main` créée depuis ton navigateur (`gh` n'est pas installé) ;
   - tu vérifies que la CI est verte, puis tu fusionnes ;
   - l'image est republiée et Portainer la redéploie.
6. **Toujours** : un commit et un push après chaque étape terminée, pour pouvoir changer de PC à tout moment.

## 5. Tester en local avec les vraies données
Le site et le worker ont besoin d'une même base. On utilise PGlite servi comme un Postgres (`@electric-sql/pglite-socket`, avec un correctif dans `scripts/e2e/db.mjs`). Tout ce qui est généré va dans `.data/`, qui est ignoré par git.

```bash
npm run e2e:env      # une fois par PC : crée .data/e2e.env avec un identifiant de test (ligne 2 du fichier)
npm run e2e:db       # base sur 127.0.0.1:5433 (à laisser tourner)
npm run e2e:worker   # worker de synchro (à laisser tourner, applique les migrations)
npm run e2e:web      # site sur http://localhost:3000 (ou configuration « e2e-web » du navigateur de l'app)
npm run e2e:sql -- "select count(*) from titles"   # requête SQL ponctuelle
```

Ensuite : se connecter avec l'identifiant de test, coller le NPSSO dans Settings, puis attendre la première synchro (~15 min pour 266 jeux).

## 6. Mettre en place un autre PC
1. Cloner `https://github.com/Zedemix-dev/psn-tracker` (dépôt privé), puis `npm ci`.
2. Dans Claude Code, installer les plugins **superpowers** et **frontend-design**, depuis le marketplace officiel `claude-plugins-official`. Sans superpowers, les skills du processus (brainstorming, plans, subagent-driven) n'existent pas.
3. Pour les tests en local : `npm run e2e:env`.
4. Python n'est utile que pour servir les maquettes. Le chemin de Python dans la configuration « maquettes » de `.claude/launch.json` est propre au PC d'origine : l'adapter si besoin.
5. La mémoire de Claude est propre à chaque PC. Ce qui doit suivre est dans ce fichier et dans `CLAUDE.md`.

## 7. Décisions et préférences à respecter
- **Langues** : la conversation en **français**. Le site est entièrement en **anglais**, y compris les noms des jeux et des trophées (`Accept-Language` en-GB). Le code et les messages de commit sont en anglais.
- **Style** : style « Console » ; couleurs de progression par rang : S #667FB2, A #008000, B #7B9E00, C #A68E00, D #A66A00, E #FF4100, F #EE0000. Les icônes officielles fournies par l'utilisateur sont dans `public/icons/` ; pas de liens vers les images de psnprofiles.
- **Sauvegardes** : **aucune dans l'app**. Le RAID SHR du NAS s'en charge (« ne rien faire »).
- **Validation** : rien n'est construit tant que la maquette ou la description n'a pas été validée.
- **Sécurité** : Claude ne saisit jamais le vrai NPSSO. C'est toujours l'utilisateur qui le colle.
