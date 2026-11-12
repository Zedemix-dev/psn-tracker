# PSN Tracker — Design, phase 1 (socle + page principale + page jeu + Settings)

Date : 2026-11-07
Maquettes validées :
- page Games : [2026-11-07-psn-tracker-maquette-accueil.html](2026-11-07-psn-tracker-maquette-accueil.html) (style « Console », v12) ;
- page d'un jeu : [2026-11-08-psn-tracker-maquette-jeu.html](2026-11-08-psn-tracker-maquette-jeu.html) (v5, validée le 8 novembre 2026, section 8.9).

Légende : **[décidé]** = choix explicite de l'utilisateur. **[mon choix]** = décision prise pendant la conception, que l'utilisateur peut contester. Tout le reste découle directement de ce qu'il a dit.

---

## 1. Intention

Un tableau de bord personnel de chasseur de trophées PlayStation, pour **un seul profil** : `Zmx969` (niveau 536, ~11 600 trophées, 230 platines, 266 jeux, uniquement PS4/PS5).

L'utilisateur s'en sert pour :
- suivre l'avancée de son profil : derniers trophées, taux de complétion, progression ;
- décider quel jeu faire ensuite à partir des stats (trophées restants par jeu, jeux aux trophées les plus rares, etc.).

Pourquoi un site maison plutôt que les sites existants :
- **psnprofiles** ne gère pas les jeux de plus de 256 trophées (limite de sa base) : un tel jeu arrive bientôt sur le profil et fausserait toutes les stats de complétion. Sa rareté est calculée sur ses propres membres et non sur les données PSN, donc des trophées durs y paraissent communs.
- **pocketpsn** n'a pas ces défauts, mais il est lent et bloque des fonctionnalités derrière un abonnement.

Le site doit reprendre **la lisibilité épurée de psnprofiles** et **la présentation de pocketpsn** (bannière, bandeau profil, cases de stats, colonne latérale).

## 2. Objectifs, non-objectifs, anti-objectifs

**Objectifs**
- Des chiffres exacts : le PSN fait foi (rareté mondiale PSN, progression PSN par jeu, aucune limite de trophées par jeu).
- Rapide : toutes les données sont en local dans Postgres, les pages s'affichent quasi instantanément.
- Tout accessible, sans paywall.

**Non-objectifs**
- Rien de multijoueur ni de social : pas de classements, pas de rangs mondiaux ou par pays, pas de percentiles, pas de comparaison avec d'autres joueurs, pas de scan d'autres profils.
- Pas d'inscription ni de gestion multi-utilisateurs.
- Pas de PS3 ni de Vita (l'utilisateur n'a que des jeux PS4/PS5).

**Anti-objectifs** (le projet échoue même s'il « marche »)
- Des chiffres qui ne collent pas avec ce que montre la console.
- Un chiffre estimé ou incomplet affiché comme s'il était exact. Si une donnée n'est pas connue exactement, le site le dit.
- Une limite sur le nombre de trophées par jeu.
- Un site lent.

## 3. Périmètre de la phase 1

**Dans la phase 1**, dans cet ordre :
1. Le socle : conteneurs sur le NAS, connexion, synchro PSN (automatique et manuelle), modèle de données complet.
2. La page principale « Games » (section 8).
3. La page Settings (section 9).
4. **[décidé]** La page de détail d'un jeu, ouverte au clic sur une ligne de la liste (section 8.9).
   - **[décidé]** Son design détaillé a été fait à part, par une maquette validée par l'utilisateur le 8 novembre 2026 (v5), avant toute construction.

**Hors phase 1** (chacune fera l'objet de son propre brainstorming une fois l'accueil terminé) : Plat Wall, Trophy Log, Trophy Advisor, Stats.
- **[décidé]** Leurs onglets apparaissent déjà dans le menu et mènent à une page « Coming soon ».
- **[décidé]** Le calendrier « Last 60 days » est retiré de la page principale, où il prenait trop de place. Il ira sur la page **Stats**. Ce qui a déjà été décidé à son sujet reste valable :
  - une colonne par semaine et une ligne par jour, du lundi au dimanche ;
  - le nom de chaque jour affiché (Mon, Tue … Sun) ;
  - des cases carrées, plus intenses selon le nombre de trophées du jour, avec le nombre exact en infobulle ;
  - un résumé en dessous : nombre de trophées, nombre de platines, meilleur jour.
  - **[décidé, 11 novembre 2026]** Sur la page Stats, il prend toute la largeur et devient « Last 12 months », avec en plus la plus longue série de jours (18.5).
- **Le modèle de données doit toutefois stocker dès maintenant tout ce dont ces pages auront besoin** : dates d'obtention, trophées non obtenus avec leur rareté, groupes DLC, temps de jeu, etc. Ces pages n'auront alors pas besoin de resynchroniser l'historique.

## 4. Contraintes techniques

- **[décidé]** Site React en **Next.js**, avec des **React Server Components** qui lisent la base **PostgreSQL**, rendu côté serveur (SSR).
- **[décidé]** Application livrée en image Docker, construite par **GitHub Actions** à partir du code hébergé sur **GitHub** (offre gratuite).
- **[décidé]** Hébergement sur un **NAS Synology DS1522+** (DSM 7, processeur AMD Ryzen x86-64), avec **Container Manager** et **Portainer** pour gérer les conteneurs.
- **[décidé]** Le site est exposé via **nginx**. Le **HTTPS est géré par le reverse proxy de DSM**.
- **[décidé]** Accès depuis chez soi et depuis internet via un nom de domaine **`*.synology.me`** créé sur le NAS.
- **[décidé]** Synchro avec l'API PSN grâce au **token NPSSO** de l'utilisateur.
- **[mon choix]** Bibliothèque **`psn-api`** (npm), doc sur https://psn-api.achievements.app/. Les noms de fonctions cités plus bas viennent de cette bibliothèque.

## 5. Accès et sécurité

- **[décidé]** **Tout le site** est derrière une authentification, y compris la page principale. Un seul compte.
- **[mon choix]** L'identifiant et le mot de passe (ou son hash) sont définis par variables d'environnement du conteneur. Il n'y a pas de page d'inscription.
- **[décidé] Session sans fin** : l'utilisateur ne veut pas se reconnecter tous les mois.
  - Les navigateurs plafonnent la durée de vie d'un cookie (environ 400 jours pour Chrome). Le cookie de session est donc **prolongé à chaque visite**, ce qui revient en pratique à une session infinie. **[mon choix]**
  - Les sessions sont enregistrées côté serveur. Le bouton « Log out » de Settings les invalide. **[mon choix]** Depuis le 12 novembre 2026, la base ne garde que l'empreinte de l'identifiant, et une session non vue depuis 400 jours est supprimée (20.7).
  - Le cookie est `httpOnly`. Il est `Secure` quand le site est ouvert en HTTPS, ce qui laisse fonctionner un éventuel accès en HTTP par l'IP locale du NAS. **[mon choix]**
- **[mon choix]** Les tentatives de connexion sont limitées, parce que le site est exposé sur internet.
  - On s'appuie pour cela sur la vraie IP du client, transmise par le reverse proxy de DSM puis par nginx (en-têtes `X-Forwarded-For` / `X-Forwarded-Proto`). nginx ne fait confiance qu'au proxy DSM, pas au réseau local (20.6).
- **[mon choix]** Le NPSSO et les tokens PSN dérivés sont stockés **chiffrés** en base, avec une clé fournie par variable d'environnement. Ils ne sont jamais renvoyés au navigateur : la page Settings n'affiche que leur état.

## 6. Synchronisation PSN

### 6.1 Authentification PSN
- NPSSO → `exchangeNpssoForAccessCode` → `exchangeAccessCodeForAuthTokens` → access token (valable quelques heures) et refresh token.
- Le refresh token est conservé, et on stocke toujours le dernier reçu. L'access token est renouvelé via `exchangeRefreshTokenForAuthTokens` quand il expire.
- Le NPSSO expire au bout d'environ 2 mois. **[décidé]** L'utilisateur le renouvelle lui-même chaque mois via la page Settings, grâce à **son propre rappel**, en dehors du site. Le site n'envoie aucune notification : ni email, ni push.
- **[décidé]** En complément, un bandeau discret s'affiche quand le NPSSO a plus de 50 jours : « PSN token is 52 days old — renew it in Settings ».
- **[mon choix]** Si le renouvellement échoue (NPSSO expiré ou révoqué), la synchro s'arrête proprement et le site affiche un bandeau clair : « PSN token expired — update it in Settings ». Les données déjà synchronisées restent affichées.

### 6.2 Déclenchement
- **[décidé]** Synchro **automatique toutes les 6 heures**, même si personne n'a le site ouvert.
- **[décidé]** Un bouton **« Sync now »** sur la page principale lance une synchro à la demande.
- Une seule synchro à la fois. Si une synchro est en cours, qu'elle soit automatique ou manuelle, le bouton n'en relance pas une deuxième et affiche « Syncing… ».
- À la fin, la date « Last synced » du bandeau est mise à jour. En cas d'échec, le bouton et la page Settings l'indiquent.
- **[décidé]** Chaque exécution est historisée (début, fin, statut, nombre de jeux et de trophées mis à jour, erreur éventuelle) et consultable dans Settings.

### 6.3 Ce qui est synchronisé
| Donnée | Source (`psn-api`) |
|---|---|
| Profil : pseudo, avatar | `getProfileFromAccountId` (accountId via `getUserTrophyProfileSummary("me")`) |
| Niveau, % vers le niveau suivant, palier (1–10), compteurs par type | `getUserTrophyProfileSummary` |
| Liste des jeux (listes de trophées), compteurs définis/obtenus, progression PSN | `getUserTitles` (pagination `limit`/`offset`, 800 max par appel) |
| Groupes de trophées (jeu de base + DLC), avec nom et icône | `getTitleTrophyGroups` |
| Définition des trophées : nom, description, icône, type, groupe, caché, **objectif d'un trophée à paliers** (`trophyProgressTargetValue`, listes PS5) | `getTitleTrophies(..., "all")` |
| État utilisateur par trophée : obtenu, date, rareté mondiale (`trophyEarnedRate`), catégorie de rareté, **progression d'un trophée à paliers non obtenu** (`progress`, et sa date `progressedDateTime`) | `getUserTrophiesEarnedForTitle(..., "all")` |
| Progression par groupe | `getUserTrophyGroupEarningsForTitle` (**[mon choix, 8 novembre 2026]** non utilisé : le pourcentage d'un groupe est calculé avec la règle du PSN, 8.9) |
| Temps de jeu, nombre de sessions, dernière partie, **jaquette carrée** | `getUserPlayedGames` (PS4/PS5) |
| Lien entre jeu joué (`titleId`) et liste de trophées (`npCommunicationId`) | `getUserTrophiesForSpecificTitle` (5 `npTitleIds` max par appel) |
| Concept du jeu (page d'un jeu, 8.9) : identifiant, **bannière** (image `GAMEHUB_COVER_ART`) et **logo** (image `LOGO`) | `getUserPlayedGames`, champ `concept` (`id`, `media.images[].type` / `url`), déjà appelé à chaque synchro |
| **Éditeur, date de sortie, genres** (page d'un jeu, 8.9) | catalogue PSN, par `call` : `GET https://m.np.playstation.com/api/catalog/v2/concepts/{conceptId}?country=GB&language=en&age=99` → `publisherName`, `releaseDate.date`, `localizedGenres[].value` |

- **Trophées à paliers**, vérifié en pratique le 8 novembre 2026 sur 14 listes PS5 :
  - l'objectif (`trophyProgressTargetValue`) est dans la **définition** des trophées (`getTitleTrophies`), pas dans l'état utilisateur. La synchro de la phase 1 le cherchait dans l'état utilisateur : la colonne est restée vide pour les 12 434 trophées, et c'est à corriger ;
  - la progression de l'utilisateur (`progress`) n'est renvoyée que pour les trophées **non obtenus** qui ont un objectif. Elle vaut `0` tant que rien n'est fait ;
  - les listes PS4 n'en ont jamais.
- **[décidé, 8 novembre 2026] PSN seul** pour les infos d'un jeu : pas d'IGDB. Le PSN ne fournit pas le **développeur**, qui n'est donc pas affiché.
- Catalogue PSN, vérifié en pratique le 8 novembre 2026 :
  - les paramètres `country`, `language` et `age` doivent être tous présents ou tous absents, sinon l'API répond une erreur ;
  - `country` et `language` découlent de la langue PSN (`en-GB` → `GB` et `en`) ; `age=99` évite tout filtrage par âge ;
  - `localizedGenres` peut contenir des doublons (FFXIV Online : deux fois « Role Playing Games »).
- **[mon choix]** Le concept d'une liste de trophées est celui du jeu joué relié le plus récemment joué, comme pour la jaquette.
- **[mon choix]** Une liste de trophées sans jeu joué relié n'a ni concept, ni bannière, ni logo, ni infos du catalogue : 7 jeux sur 266 au 8 novembre 2026 (Dauntless PS4 et PS5, Game of Thrones, Gran Turismo 7 PS4, Marvel Heroes Omega, Minecraft: Story Mode, Tales from the Borderlands).

- Il faut transmettre le `npServiceName` renvoyé par `getUserTitles` aux appels par jeu (`trophy` pour les jeux PS4, `trophy2` pour les jeux PS5).
- Pour chaque jeu, la définition et l'état utilisateur des trophées viennent de deux appels distincts, à rapprocher par `trophyId`.

### 6.4 Synchro incrémentale
- **[décidé]** On ne recharge que ce qui a changé depuis la dernière synchro. La toute première synchro récupère tout l'historique : elle est longue et affiche sa progression.
- Pour savoir ce qui a changé, on compare les données de `getUserTitles` avec ce qui est stocké : `lastUpdatedDateTime`, compteurs obtenus, compteurs définis, `trophySetVersion`, `hasTrophyGroups`. Un jeu qui a changé est entièrement rechargé (groupes, trophées, état utilisateur).
- **[décidé] DLC :** si un ancien jeu reçoit une nouvelle liste de trophées DLC, elle doit être récupérée **même si aucun de ses trophées n'est obtenu**.
  - La documentation ne dit pas quel champ change dans ce cas : `lastUpdatedDateTime` ne change qu'à l'obtention d'un trophée.
  - Le builder doit le vérifier en pratique (`trophySetVersion` et `definedTrophies` sont les candidats).
  - Par sécurité, il prévoit aussi une revérification des groupes de tous les jeux **une fois par jour [décidé]**.
- **[décidé] Rareté :** le pourcentage mondial d'un trophée évolue même quand l'utilisateur ne joue plus au jeu. Une synchro uniquement incrémentale laisserait donc dériver la rareté moyenne et le classement des trophées les plus rares. Les raretés de tous les jeux sont donc **rafraîchies une fois par jour**.
- **[mon choix] Compteurs des trophées à paliers** (8.9) : une progression peut avancer sans qu'aucun trophée ne soit obtenu, et un tel jeu n'est alors pas vu comme modifié. Les compteurs sont donc rafraîchis :
  - quand le jeu est rechargé ;
  - par le rafraîchissement quotidien, qui lit déjà l'état utilisateur de chaque jeu pour les raretés ;
  - à chaque synchro, pour les jeux dont la date de dernière partie (`getUserPlayedGames`) a changé depuis la synchro précédente. Un « Sync now » après une session de jeu met donc à jour les compteurs du jeu joué.
- **[mon choix]** Infos du catalogue (éditeur, date de sortie, genres) : récupérées pour tout concept qui n'en a pas encore, puis rafraîchies une fois par jour avec les raretés. Un échec sur un concept n'arrête pas la synchro : il est retenté la fois suivante.
- Les jaquettes carrées et le temps de jeu viennent de `getUserPlayedGames`, rechargé à chaque synchro.
  - Le lien `titleId` → `npCommunicationId` n'est calculé qu'une fois par nouveau `titleId`, puis mis en cache.
  - Si un jeu n'a pas de correspondance, on affiche l'icône de sa liste de trophées dans un cadre carré, sans la rogner, sur une **tuile carrée sombre** (`#0B1022`) : la ligne reste carrée. La tuile prend la couleur du bord de l'icône quand ce bord est uni et opaque (8.9).
- **[mon choix]** Aucune limite de débit n'est documentée. Les appels sont faits l'un après l'autre avec une petite pause, et réessayés avec un délai croissant en cas d'erreur 429 ou 5xx.

### 6.5 Images
- **[décidé]** Les images sont **récupérées chez Sony puis stockées en local** : avatar, jaquettes, icônes de listes, de groupes et de trophées. Le site les sert lui-même et ne dépend pas du CDN de Sony à l'affichage.
- **[mon choix]**
  - Les images sont téléchargées pendant la synchro, dans un volume Docker.
  - Une image est retéléchargée si son adresse côté Sony change.
  - Si un téléchargement échoue, on réessaie à la synchro suivante. En attendant, on affiche une vignette neutre.
  - Ordre de grandeur : ~12 400 icônes de trophées, soit quelques centaines de Mo.
- Bannière et logo d'un jeu (8.9), stockés en local comme les autres images :
  - **[décidé, 8 novembre 2026] La bannière est gardée en taille originale**, en 4K (3 840 × 2 160) : l'utilisateur la veut parfaitement nette, et une version en 1 920 px risquait de paraître floue.
    - Elle pèse ~1 Mo, soit ~260 Mo pour les ~260 jeux qui en ont une.
  - **[décidé]** Le logo est réduit à **800 px de large** au plus. L'original va jusqu'à 2 400 px de large (~600 Ko), alors qu'il s'affiche sur 400 px au plus.
    - Le serveur d'images de Sony redimensionne à la demande avec le paramètre `?w=800`, vérifié le 8 novembre 2026 avec `?w=1920`.

## 7. Données

Le schéma exact est laissé au builder. Il doit au minimum permettre :
- **un profil unique** : pseudo, avatar, niveau, progression, palier, compteurs ;
- **les listes de trophées** : identifiant PSN, service, plateforme(s), nom, icône, jaquette carrée, compteurs définis et obtenus par type, progression PSN, caché, dates, `trophySetVersion`, temps de jeu, sessions, dernière partie ;
  - et, pour la page d'un jeu (8.9) : l'identifiant du concept, la bannière et le logo (adresses Sony), l'éditeur, les genres et la date de sortie, avec la date de leur dernière récupération ;
  - Les versions PS4 et PS5 d'un même jeu sont **deux listes distinctes**, comme sur le PSN. **[mon choix]**
- **les groupes** (base et DLC) avec leurs compteurs ;
- **les trophées** : définition, état obtenu ou non, date d'obtention, rareté mondiale (en nombre), catégorie de rareté PSN, objectif de progression éventuel, et la progression de l'utilisateur vers cet objectif avec sa date (8.9) ;
- **les fichiers d'images locaux**, avec l'adresse Sony d'origine ;
- **l'historique des synchros** et **les sessions** ;
- **les réglages** : bannière et sa position verticale, Trophy cabinet ordonné (10 trophées au plus), réglage « Hide 0% games », identifiants PSN chiffrés.

Les trophées non obtenus sont stockés aussi : le Trophy Advisor en aura besoin.

## 8. Page principale « Games »

Référence visuelle : la maquette v11. Elle utilise des images empruntées à psnprofiles pour l'exemple. Le vrai site utilisera les images du PSN, stockées en local.

### 8.1 Règles générales
- **[décidé] Tout est en anglais**, pour rester cohérent avec la console de l'utilisateur, même si son compte PSN est français. Cela vaut aussi pour les **noms et descriptions des jeux et des trophées**.
  - Les appels à l'API PSN demandent donc l'anglais (en-tête `Accept-Language`). **[mon choix : `en-GB`]**
  - La langue est réglable par une variable d'environnement. En changer impose de recharger les définitions de tous les jeux, ce qui revient à une synchro complète.
- **[mon choix]** Format des dates : `5 Nov 2026, 00:16` (24 h, fuseau Europe/Paris). Format des nombres : `11,622` et `93.74%`.
- **[décidé] Icônes officielles PSN.** Les icônes des types de trophée (platine, or, argent, bronze) sont les vraies icônes du PSN, comme sur psnprofiles, et non des pictogrammes dessinés.
  - L'API ne les fournit pas : elles sont embarquées dans le site comme images fixes, au même titre que les 10 icônes de palier de niveau.
  - Exception : les petites pastilles de compteurs (chips) gardent un pictogramme simplifié coloré, plus lisible à 11 px.

### 8.2 Bannière
- **[décidé]** Une image **envoyée depuis le PC de l'utilisateur** via Settings.
- **[décidé]** Elle est grande et **le moins rognée possible**.
  - Sa hauteur suit la largeur de l'écran, avec le format de l'image recommandée de **1920 × 520** : environ 440 px de haut sur un écran de 1 630 px. Elle est bornée entre 240 et 560 px.
  - Elle ne se fond dans la page que sur son dernier quart.
  - La même image, floutée et assombrie, sert de fond à toute la page (style « Console »).
- **[mon choix]** Si l'image envoyée n'a pas ce format, l'utilisateur choisit dans Settings la partie verticale à garder (haut, centre, bas, ou un curseur).
- **[décidé, 8 novembre 2026] Bannière automatique** : sans bannière personnalisée, Games affiche la bannière du **dernier jeu joué**. C'est la même image 4K que sur la page de ce jeu (8.9), avec le même fond flouté.
  - Une bannière envoyée dans Settings a toujours la priorité. Si l'utilisateur la retire, Games revient tout seul à la bannière automatique.
  - **[mon choix]** Le « dernier jeu joué » est le jeu non masqué dont la date de dernière partie est la plus récente et dont la bannière est déjà téléchargée. La bannière change donc d'elle-même après une synchro, quand l'utilisateur joue à un autre jeu.
  - **[mon choix]** Elle est cadrée comme sur la page d'un jeu, à 25 % depuis le haut, et sans le logo du jeu.
  - Les pages qui partagent la bannière de Games (Settings et « Coming soon ») suivent la même règle.
- **[mon choix]** Si aucun jeu n'a encore de bannière, sur une installation neuve par exemple, un dégradé neutre s'affiche avec un lien « Choose a banner in Settings ».

### 8.3 Bandeau profil
Il s'agit d'un panneau translucide qui chevauche le bas de la bannière.
- L'avatar PSN, dans un cercle qui déborde du panneau. **[décidé] Pas de badge PS Plus, pas de pays.**
- Le pseudo.
- « Last synced 7 Nov 2026, 09:27 » et le bouton « Sync now », avec trois états : prêt, « Syncing… » avec une icône qui tourne, et erreur.
- Les compteurs : total des trophées, puis platine, or, argent et bronze, chacun dans sa couleur.
- Le niveau PSN, avec **l'icône officielle du palier** de l'utilisateur, la barre de progression vers le niveau suivant et « 42% to level 537 ».
  - L'API ne fournit que le numéro du palier (1 à 10), pas l'image. Les 10 icônes sont donc embarquées dans le site comme images fixes.

### 8.4 Les 6 cases de stats
Chaque case contient un libellé et une valeur, **sans texte en dessous [décidé]**. Les chiffres sont grands et fins, comme sur psnprofiles.

| Libellé | Exemple | Définition **[décidé]** |
|---|---|---|
| Games completed | `224 / 266` | jeux à 100 % de progression PSN / nombre total de jeux |
| Completion rate | `93.74%` | **trophées obtenus / total des trophées de tous les jeux**, DLC compris. Exemple : 900 obtenus sur 1 000 = 90 % |
| Average rarity | `26.54%` | moyenne de la rareté mondiale de **tous** les trophées **obtenus** |
| Unearned trophies | `776` | trophées définis moins trophées obtenus, DLC compris |
| Trophies per day | `3.19` | trophées obtenus / jours écoulés depuis le premier trophée |
| Hours played | `19,416 h` | somme des temps de jeu PS4/PS5 |

- **[décidé]** Les jeux masqués par l'utilisateur sur le PSN (`hiddenFlag`) sont exclus de tous les chiffres.
- **[décidé]** Quand le réglage « Hide 0% games » est actif (8.7), les jeux à 0 % sont exclus de toutes les stats.
- Les compteurs de trophées obtenus, la rareté et les milestones ne changent pas, puisqu'un jeu à 0 % n'a aucun trophée obtenu. En revanche, le total de jeux, la complétion, les trophées manquants et les heures de jeu changent.

### 8.5 Menu
- **[décidé]** Le menu est **tout en haut de la page**, et non plus au milieu entre les stats et le carrousel.
- **[décidé]** Le menu n'a **aucun bandeau** : il est entièrement transparent, posé sur le haut de la bannière. **Chaque entrée est une pastille dans le style du bouton « Settings »** (fond sombre translucide, fin contour clair, texte blanc).
  - À gauche : **Games** (page par défaut), Plat Wall, Trophy Log, Trophy Advisor, Stats.
  - À droite : « Settings ».
- **[mon choix]** L'entrée de la page affichée garde le même style, avec un contour blanc et un fond un peu plus clair.
- **[mon choix]** Sans bandeau, des pastilles qui resteraient fixées au défilement flotteraient au-dessus de la liste. Le menu défile donc avec la page.

### 8.6 Carrousel des derniers trophées
- **[décidé]** Aucun titre au-dessus du carrousel.
- **[décidé]** Il montre **autant de derniers trophées que la largeur le permet**, par date d'obtention : 16 sur un écran de 1 630 px. Il est **calé sur les deux bords du contenu**, alignement à droite compris, comme le reste de la page, et n'a **pas de barre de défilement**. La page doit donc disposer d'au moins les 20 derniers trophées.
- **[décidé]** Les icônes font **56 px**, comme sur psnprofiles.
- **[décidé]** **Un seul trophée à la fois** affiche ses détails : icône, nom, description, date et jeu, rareté en % et sa catégorie, icône officielle du type.
  - Sa case est **exactement de la même hauteur que les icônes voisines** : pas de contour blanc, pas d'effet de zoom.
  - Elle s'élargit seulement pour faire tenir le texte, sur environ 380 px.
- **[décidé]** Il **passe tout seul** au suivant, comme sur psnprofiles.
- **[mon choix]** Le carrousel :
  - avance toutes les 6 secondes ;
  - se met en pause quand la souris est dessus ou qu'un élément a le focus ;
  - change de trophée affiché au clic sur une icône.
- Le défilement automatique doit fonctionner même quand le système demande de réduire les animations : l'utilisateur est dans ce cas. Seule la petite barre de progression du minuteur est alors masquée.
- Sur un écran étroit, le trophée détaillé passe au-dessus et les autres icônes s'alignent en dessous.

### 8.7 Liste des jeux (colonne principale)
- **En-tête :** le titre « Games », puis **juste à côté le réglage « Hide 0% games » [décidé]**. À droite, le nombre de jeux affichés.
- **[décidé] « Hide 0% games »** (un interrupteur) :
  - **actif** : les jeux à 0 % (aucun trophée obtenu) disparaissent de la liste, leurs trophées disparaissent du Trophy Advisor (quand la page existera), et ils ne comptent plus dans les stats (8.4) ;
  - **inactif** : ces jeux sont affichés, leurs trophées apparaissent dans le Trophy Advisor, et ils comptent dans les stats.
  - **[mon choix]** Le réglage est enregistré côté serveur, pour que les stats calculées au rendu en tiennent compte. Il est inactif par défaut.
- **Filtres [décidé]**, repris de psnprofiles :
  - **état** :
    - All ;
    - 100% (progression PSN à 100 %) ;
    - Not 100% ;
    - Not 100% or Platinum : les jeux **ni à 100 % ni platinés**, c'est-à-dire « pas encore finis » ;
    - Platinum (platine obtenu) ;
    - Platinum, not 100% (platine obtenu mais il manque des trophées, en général des DLC) ;
  - **plateforme** : All / PS4 / PS5 ;
  - **recherche** par nom.
- **Tri [décidé]** : Last trophy (par défaut), Last played, Alphabetical, Percent completion, Time played, Total trophies, Earned trophies, Unearned trophies, Platinum rarity.
  - **[décidé, 8 novembre 2026] Le tri par défaut est « Last trophy »** (auparavant « Last played »), et il passe **en tête du menu**. Sans paramètre `sort` dans l'adresse, la liste est triée par dernier trophée.
  - **[décidé, 9 novembre 2026] « Last trophy » suit l'ordre de la console** : la liste est triée sur la date de dernière mise à jour de la liste de trophées donnée par le PSN (`lastUpdatedDateTime`), la plus récente d'abord, et à défaut sur la date du dernier trophée.
    - Cette date est celle du dernier trophée obtenu ou, sans trophée, celle du premier lancement du jeu. Un jeu commencé sans trophée (Phantom Blade Zero) se place donc au moment où il a été lancé, entre Cyberpunk 2077 et MAGICKA 2, comme sur la console et psnprofiles.
    - Pour les autres jeux, l'ordre ne change pas en pratique : la date est celle du dernier trophée, à quelques minutes près.
  - **[mon choix]** Chaque tri a son sens naturel :
    - les plus récents d'abord pour les deux tris par date ;
    - de A à Z pour Alphabetical ;
    - les plus grandes valeurs d'abord pour Percent completion, Time played et les trois tris par nombre de trophées ;
    - le platine le plus rare d'abord pour Platinum rarity, avec les jeux sans platine à la fin.
  - **[mon choix]** « Last played » utilise la date de dernière partie de `getUserPlayedGames`, ou à défaut la date du dernier trophée.
- Changer un filtre, un tri ou la recherche relance le chargement à partir des 50 premiers jeux.
- **Une ligne par jeu**, sur une hauteur d'environ 80 px, **cliquable [décidé]** : elle ouvre la page du jeu (8.9).
  - **jaquette carrée [décidé]** (60 px), celle du jeu telle qu'on la voit sur l'écran d'accueil de la console, et non l'icône de la liste de trophées (rectangulaire sur PS4) ;
    - **[décidé, 8 novembre 2026]** une liste sans jaquette prend celle d'une autre version du même jeu, ou à défaut l'icône carrée de sa version PS5 (8.9, « Emprunt à l'autre version du même jeu ») ;
  - **[décidé] trois lignes de texte, sans rien de tronqué** :
    1. le nom du jeu, suivi du badge PS4/PS5 **sur la même ligne** ;
    2. « 47 / 47 trophies » (obtenus / total) ;
    3. « Last played 5 Nov 2026 | 33h 27m played » ;
  - **[décidé] progression « empilée »**, dans la partie droite de la ligne (~40 % de sa largeur) :
    - en haut, les pastilles obtenus/définis par type (platine, or, argent, bronze), **centrées par rapport à la barre de progression**. Les types absents du jeu ne sont pas affichés et ne décalent pas le centrage ;
    - en dessous, une longue barre de progression suivie du **pourcentage PSN**, celui que montre la console ;
    - **[décidé] la couleur de la barre dépend de la complétion du jeu**, avec les couleurs des rangs de psnprofiles (valeurs exactes de son CSS) :

      | Complétion | Rang | Couleur |
      |---|---|---|
      | 100 % | S | `#667FB2` |
      | 80 à 99 % | A | `#008000` |
      | 60 à 79 % | B | `#7B9E00` |
      | 40 à 59 % | C | `#A68E00` |
      | 20 à 39 % | D | `#A66A00` |
      | 1 à 19 % | E | `#FF4100` |
      | 0 % | F | `#EE0000` |

      - **[mon choix]** À 0 %, la barre n'a rien à remplir. C'est donc le fond de la barre lui-même qui prend la couleur F, atténuée.
  - **[décidé] icône d'état**, tout à droite :
    - si le jeu a un platine : la **vraie icône du platine PSN**, en couleur quand le platine est obtenu, **grisée** sinon ;
    - si le jeu n'a pas de platine : une **coche en V**, en couleur quand le jeu est à 100 %, grisée sinon.
- **Chargement [décidé]** :
  - les 50 premiers jeux sont rendus côté serveur ;
  - les 50 suivants se chargent quand on approche du bas de la liste, et ainsi de suite jusqu'à ce que tous les jeux soient affichés.
- **[décidé, 8 novembre 2026] Retour depuis la page d'un jeu** : quand on revient sur Games, la liste revient **à l'endroit où on l'avait laissée**, avec les mêmes jeux chargés.
  - Sans cela, après avoir ouvert le 120e jeu puis être revenu en arrière, la liste repartait des 50 premiers jeux.
  - **[mon choix]**
    - Ce retour vaut pour le bouton « précédent » du navigateur, et le geste équivalent sur téléphone.
    - Une nouvelle visite de Games repart du haut de la liste : un clic sur l'entrée « Games » du menu, par exemple.
    - Le nombre de jeux chargés et la position de défilement sont gardés le temps de l'onglet, pour les mêmes filtres, tri et recherche.
    - Si une synchro a eu lieu entre-temps, la liste repart du haut, comme c'est déjà le cas après une synchro.

**[décidé, 9 novembre 2026]** Le bouton « Show all », le filtre « non obtenables » et le repère « ! » de cette liste sont décrits en 14.6.

### 8.8 Colonne latérale (droite, ~450 px)
- **[décidé] Les listes sont propres comme sur psnprofiles** : aucun nom tronqué, et toutes les lignes à la même hauteur.
  - Chaque ligne fait ~66 px, portée par une icône de trophée de **56 px**.
  - À cette largeur de colonne, les noms de trophées tiennent sur une ligne.
  - Un nom de jeu exceptionnellement long (par exemple « Kingdom Hearts 0.2 Birth by Sleep: A Fragmentary Passage ») passe sur deux lignes dans la hauteur de l'icône, sans épaissir la ligne. Rien n'est jamais coupé par des « … ».
1. **Trophy cabinet [décidé]** : le top 10 personnel de l'utilisateur, dans l'ordre qu'il a choisi.
   - Chaque trophée affiche son icône, son nom, son jeu, sa rareté en % et sa catégorie, puis **l'icône officielle de son type** tout à droite, comme sur psnprofiles.
   - **[décidé]** Le lien « Edit » permet de le modifier **directement depuis la page principale**. Il n'y a pas d'éditeur en double dans Settings.
     - **[mon choix]** Il ouvre une fenêtre par-dessus la page, où l'on peut :
       - chercher parmi les trophées obtenus ;
       - ajouter jusqu'à 10 trophées ;
       - les réordonner et les retirer ;
       - enregistrer.
   - S'il est vide, l'encart affiche un message et le même lien pour le remplir.
2. **Rarest trophies [décidé]** : les 5 trophées obtenus les plus rares au niveau mondial, puis **le décompte par catégorie de rareté**, comme sur psnprofiles (barre empilée et 5 chiffres).
   - **[mon choix]** Chaque trophée porte lui aussi l'icône officielle de son type tout à droite, comme dans le Trophy cabinet et sur psnprofiles.
   - **[décidé] Catégories :** les 5 paliers de psnprofiles, appliqués aux pourcentages mondiaux du PSN : Ultra rare < 5 %, Very rare 5–10 %, Rare 10–20 %, Uncommon 20–50 %, Common ≥ 50 %.
   - **[mon choix, 8 novembre 2026]** Le décompte a ses 5 colonnes de même largeur, avec le chiffre et le libellé **centrés** dans chacune, comme sur la page d'un jeu où l'utilisateur l'a demandé (8.9). Les deux pages partagent le même composant.
3. **Milestones [décidé]** : **toutes** les étapes franchies, de la plus récente à la plus ancienne, **sans limite ni lien « View all »**, même si la liste est longue (32 étapes aujourd'hui).
   - Chaque étape montre l'icône du trophée, son nom et le jeu en entier, le libellé (« 225th platinum ») et la date.
   - **[mon choix]** La date s'affiche en temps relatif comme sur psnprofiles (« 9 years ago »), et la date exacte apparaît en infobulle.
   - **[décidé] Mêmes étapes que psnprofiles** (relevées sur le profil de l'utilisateur) :
     - **First trophy**, **First platinum**, **Latest platinum**, **Fastest platinum** (le platine obtenu le plus vite après le premier trophée du jeu) ;
     - platines : 10th, 20th, 30th, 40th, 50th, puis tous les 25 jusqu'au 250th (75th, 100th… 250th), puis **tous les 50** (300th, 350th, 400th…) — **[décidé]** précisé par l'utilisateur le 8 novembre 2026 ;
     - trophées : 500th, puis tous les 500 jusqu'au 5,000th, puis tous les 1 000 jusqu'au 10,000th, puis **tous les 5 000** (15,000th, 20,000th…), plus le clin d'œil **1,337th trophy** — **[décidé]** précisé par l'utilisateur le 8 novembre 2026 (pas de 11,000th).
     - Pour le comptage, les trophées sont numérotés dans l'ordre de leur date d'obtention.

### 8.9 Page de détail d'un jeu
Maquette validée : [2026-11-08-psn-tracker-maquette-jeu.html](2026-11-08-psn-tracker-maquette-jeu.html) (v5, 8 novembre 2026). Les versions intermédiaires sont dans `.superpowers/brainstorm/maquettes/` (`jeu-v1` à `jeu-v5`).
- Elle affiche les vraies données de Cyberpunk 2077 (PS5, avec DLC), Gran Turismo 7 (PS5, platine non obtenu, sans DLC) FINAL FANTASY XIV Online (17 groupes, 247 trophées, compteurs de trophées à paliers) et Phantom Blade Zero (aucun trophée obtenu, compteurs à 0).
- Un sélecteur en bas de page, **propre à la maquette**, passe d'un jeu à l'autre et masque le logo. Il ne fait pas partie du site.
- Elle charge les images depuis le CDN de Sony. Le site, lui, les sert depuis son stockage local (6.5).

**Accès et principe**
- **[décidé]** Elle s'ouvre au clic sur une ligne de la liste des jeux, à l'adresse `/games/[id]`, où `id` est le `npCommunicationId`. Elle s'inspire de la page d'un jeu sur psnprofiles : la liste des trophées, plus une colonne latérale avec les infos du jeu.
- Une page par **liste de trophées** : les versions PS4 et PS5 d'un même jeu ont chacune la leur (7).
- **[mon choix]**
  - Le menu du haut est celui de toutes les pages, avec l'entrée « Games » marquée comme page affichée.
  - La page se met à jour toute seule après une synchro, comme Games.
  - Une adresse inconnue mène à la page 404.

**Bannière et fond**
- **[décidé]** En haut, une bannière du jeu récupérée automatiquement au PSN : l'image `GAMEHUB_COVER_ART` de son concept (6.3), c'est-à-dire l'image de fond du jeu sur l'écran d'accueil de la PS5.
- **[décidé] Elle a exactement la hauteur de la bannière de Games** (8.2), par cohérence entre les pages : format 1 920 × 520, entre 240 et 560 px de haut, fondu sur son dernier quart.
- **[mon choix]**
  - Le cadrage vertical est fixe, à 25 % depuis le haut : sur les images testées, il garde les visages et les personnages.
  - Comme sur Games, la même image, floutée et assombrie, sert de fond à toute la page.
- **[décidé] Le logo du jeu** (image `LOGO` du concept, PNG transparent) est posé sur la bannière.
  - **[mon choix]** Il est placé en bas à gauche, aligné sur le bord gauche du contenu, juste au-dessus du bandeau du jeu, avec une ombre portée. Il fait au plus 400 px de large (38 % de la page) et 42 % de la hauteur de la bannière, et il est masqué sur téléphone.
- **[décidé, 8 novembre 2026] Une page de jeu sans bannière n'en affiche aucune** : la bannière de Games n'y est jamais reprise (elle montrait par exemple Cyberpunk sur la page de Dauntless).
  - **[mon choix]** L'espace de la bannière garde sa hauteur habituelle, mais il est vide, sans lien « Choose a banner in Settings ». Le fond de la page est uni, sans image floutée. Le bandeau du jeu reste ainsi à la même place que sur les autres pages de jeu.
- **[décidé, 8 novembre 2026] Emprunt à l'autre version du même jeu, information par information** : pour toute information qui manque à une liste de trophées, le site la cherche chez les autres listes **du même nom**, en préférant la version PS5. S'il la trouve, il la copie. Il ne laisse le manque (et donc, pour la bannière, l'espace vide sur fond uni) que si **aucune** version ne l'a.
  - Les informations concernées : jaquette, bannière, logo, éditeur, genre(s) et date de sortie.
  - Cela vaut pour toutes les listes, qu'elles soient reliées à un jeu joué ou non. Une liste sans jeu joué relié (6.3) n'a rien de tout cela par elle-même : c'est le cas le plus courant.
  - Exemple : Gran Turismo 7 PS4 prend la jaquette, la bannière, le logo, l'éditeur, le genre et la date de sortie de Gran Turismo 7 PS5.
  - **[mon choix]** Une information propre à la liste n'est jamais remplacée. L'emprunt se fait à l'affichage : rien d'emprunté n'est stocké, et une information empruntée suit donc toujours la version qui la prête.
- **[décidé, 8 novembre 2026] Bannières ajoutées à la main, écrites dans le code** : pour les rares jeux dont aucune version n'a de bannière au PSN, une liste écrite dans le code associe le jeu (par son nom, comme pour l'emprunt) à une bannière choisie par l'utilisateur.
  - L'utilisateur préfère une liste dans le code à un réglage dans l'interface. Ces cas sont des jeux anciens, joués avant que le site existe, et de nouveaux cas sont peu probables.
  - Ces bannières sont téléchargées par la synchro et **servies en local** comme les autres images : le site ne charge jamais d'image depuis psnprofiles à l'affichage.
  - **[mon choix]** Ordre de priorité : la bannière propre de la liste, puis celle d'une autre version du même jeu, puis celle de cette liste, puis l'espace vide sur fond uni. Une bannière qui arriverait plus tard au PSN reprendrait donc la main d'elle-même.
  - Le 8 novembre 2026, la liste contient 5 jeux, avec la bannière de leur page psnprofiles (format 1 920 × 520, exactement celui de la bannière) :

    | Jeu | Page psnprofiles fournie par l'utilisateur | Image |
    |---|---|---|
    | Dauntless (PS4 et PS5) | https://psnprofiles.com/trophies/14795-dauntless/Zmx969 | https://img.psnprofiles.com/hero/l/14795/05bf48f1-d893-41d8-b1f7-1ea0bfcc3bc0.jpg |
    | Game of Thrones | https://psnprofiles.com/trophies/3220-game-of-thrones/Zmx969 | https://img.psnprofiles.com/hero/l/3220/31500c21-cc5e-4d31-bfcc-9c10cbb55249.jpg |
    | Marvel Heroes Omega | https://psnprofiles.com/trophies/6161-marvel-heroes-omega/Zmx969 | https://img.psnprofiles.com/hero/l/6161/6206b90b-f266-4134-9f8c-5ff112d3d403.jpg |
    | Minecraft: Story Mode | https://psnprofiles.com/trophies/3955-minecraft-story-mode/Zmx969 | https://img.psnprofiles.com/hero/l/3955/c7fb42f7-3b15-4f07-99c5-eb92fcdeee57.jpg |
    | Tales from the Borderlands | https://psnprofiles.com/trophies/3188-tales-from-the-borderlands/Zmx969 | https://img.psnprofiles.com/hero/l/3188/a4a61b38-7893-4131-b936-5cb8effce3e1.jpg |
  - Si aucune version n'a de jaquette, une liste PS4 prend l'**icône de la liste PS5** du même jeu, qui est carrée, plutôt que sa propre icône rectangulaire. C'est le cas de Dauntless PS4.
  - Sans autre version (Game of Thrones, Minecraft: Story Mode, Tales from the Borderlands), la liste garde son icône, affichée en entier, et sa page n'a pas de bannière.
  - **[mon choix]** « Du même nom » veut dire même nom en minuscules, sans ™ ® ©, avec les espaces multiples réduits à un.
- La mise en page commune affiche aujourd'hui la bannière de l'utilisateur sur toutes les pages. Elle doit donc laisser la page d'un jeu fournir sa propre bannière et son propre fond.

**Bandeau du jeu** **[mon choix]**
C'est un panneau translucide qui chevauche le bas de la bannière, comme le bandeau profil de Games (8.3). Il contient :
- le nom du jeu (24 px, gras) et le badge de plateforme, le même que dans la liste des jeux ;
- en dessous : « 47 of 58 trophies | Last played 8 Nov 2026 | 71h 24m played ». Une information inconnue est omise, avec son séparateur ;
- à droite, sur environ 40 % de la largeur, la progression « empilée » de la liste des jeux (8.7) :
  - les pastilles obtenus / définis par type, centrées ;
  - en dessous, la barre aux couleurs de rang et le **pourcentage PSN** de la liste ;
- tout à droite, l'icône d'état de la liste des jeux : platine en couleur ou grisé, ou bien coche.

**Liste des trophées** (colonne principale)
- En-tête : le titre « Trophies », et à droite « 47 of 58 earned ».
- **[mon choix] Deux menus**, du même style que les filtres de Games :
  - affichage : All trophies (par défaut), Earned, Unearned ;
  - tri, avec l'étiquette « Sort by » pour les lecteurs d'écran : PSN order (par défaut, ordre des `trophyId`), Date earned, Rarest first.
    - **Date earned** : les obtenus du plus ancien au plus récent, puis les non obtenus dans l'ordre PSN. **[décidé, 10 novembre 2026]** À la même seconde, le platine passe après les autres trophées (16.4).
    - **Rarest first** : rareté PSN croissante, les trophées sans rareté à la fin.
  - **[décidé] Les options du tri ne répètent pas le mot « Order »**, comme sur Games, dont les options n'ont pas de préfixe non plus.
  - Les groupes sont gardés quels que soient l'affichage et le tri : le tri s'applique à l'intérieur de chaque groupe. Un groupe sans trophée visible disparaît. S'il ne reste rien, la liste affiche « No trophy matches this filter. »
  - L'affichage et le tri sont repris dans l'adresse de la page, comme les filtres de Games.
- **Groupes** (jeu de base, puis packs DLC)
  - **[mon choix]** Ils n'apparaissent que si la liste a plus d'un groupe. Sans DLC, les trophées s'enchaînent directement.
  - L'en-tête d'un groupe fait ~110 px (mesuré sur psnprofiles). Il contient :
    - une image carrée de 100 × 100 ;
      - **[décidé, 9 novembre 2026, maquette v6]** pour une liste **PS5**, c'est l'icône d'origine de chaque groupe, qui est carrée ;
      - pour une liste **PS4**, dont les icônes de groupe sont rectangulaires, c'est **la même image que la ligne du jeu dans la liste Games** (sa jaquette carrée, empruntée au besoin à une autre version), répétée sur le jeu de base et sur chaque DLC ;
      - le but est la cohérence : une image carrée partout ;
      - **[décidé, 9 novembre 2026]** une liste PS4 sans aucune jaquette (ni chez elle, ni chez une autre version) met elle aussi, sur le jeu de base et sur **chaque** DLC, l'image de sa ligne dans la liste Games : l'icône de sa liste de trophées, affichée en entier. Les DLC n'affichent donc jamais leur propre icône rectangulaire. Cas concernés au 9 novembre 2026 : Marvel Heroes Omega et Minecraft: Story Mode ;
      - **[décidé, 9 novembre 2026] Aucune image rectangulaire, nulle part** (ni la jaquette, ni les groupes). Une image qui n'est pas carrée est posée, entière, sur **la même tuile carrée sombre que dans la liste Games** (`#0B1022`). Elle se lit donc comme un carré, exactement comme sa ligne dans Games. Cela vaut pour l'en-tête de chaque groupe et pour la grande jaquette de la colonne latérale. Au 9 novembre 2026, quatre listes PS4 n'ont aucune jaquette carrée : Game of Thrones, Marvel Heroes Omega, Minecraft: Story Mode et Tales from the Borderlands. L'utilisateur a demandé de reprendre l'image de la liste Games faute d'autre image carrée ;
        - **[décidé, 9 novembre 2026] La tuile prend la couleur du bord de l'image** quand ce bord est uni et opaque. Retour de l'utilisateur : sur Marvel Heroes Omega, le noir de l'icône se distinguait du bleu nuit des bandes du haut et du bas. Pour une image plus large que haute, on lit sa première et sa dernière ligne de pixels (pour une image plus haute que large, sa première et sa dernière colonne). Si chacune est opaque et d'une seule couleur, la bande correspondante prend cette couleur : l'image et ses bandes ne font plus qu'un seul carré. Sinon (logo transparent, bord dessiné), la tuile reste en `#0B1022`. Même règle dans la liste Games. **[mon choix]** La couleur est lue par le navigateur une fois l'image chargée, sur un canevas : la bibliothèque d'images (sharp) reste réservée au worker, et aucune donnée n'est ajoutée à la base. Marges : une couleur est « unie » si aucun pixel du bord ne s'écarte de plus de 16 de la moyenne sur un canal, et « opaque » si tous ont une opacité d'au moins 250/255 ;
    - un sur-titre en petites capitales : « Base game » pour le groupe `default`, puis « DLC 1 », « DLC 2 »… dans l'ordre des groupes ;
    - le nom : celui du jeu pour le jeu de base, celui du pack pour un DLC ;
    - « 45 of 45 trophies » ;
    - les pastilles, la barre et le pourcentage du groupe, puis l'icône d'état du groupe : le platine s'il contient le platine, sinon la coche.
  - **[mon choix] Pourcentage d'un groupe** : il suit la règle du PSN, vérifiée le 8 novembre 2026 sur les 266 jeux contre le pourcentage PSN de chaque liste.
    - Il vaut les points obtenus hors platine, divisés par les points du groupe hors platine (bronze 15, argent 30, or 90), arrondi **à l'inférieur**.
    - Il vaut **au moins 1 %** dès qu'un trophée est obtenu. Monster Hunter Rise : 0,69 % donne 1 %.
    - Cyberpunk donne 100 % pour le jeu de base et 15 % pour Phantom Liberty, comme psnprofiles.
  - **[décidé]** L'icône de platine d'un en-tête de groupe n'a **aucun fond ni ombre**. Le fond sombre est réservé à l'icône du groupe (défaut de la v3, corrigé).
- **Ligne de trophée** : ~66 px, icône de 56 px (mesuré sur psnprofiles). De gauche à droite :
  - l'icône, **sans fond** (**[décidé, 10 novembre 2026]**, 16.7) ;
  - le nom (15 px, gras) et la description en dessous, **en entier**. Une description longue agrandit la ligne, rien n'est coupé ;
  - si le trophée est obtenu : la date (« 18 Jul 2022 ») et l'heure avec les secondes (« 01:21:07 », **[décidé, 10 novembre 2026]**, 16.7) sur deux lignes, en vert clair ;
  - la rareté PSN (« 2.30% ») et sa catégorie (« Ultra rare »), avec les paliers de 8.8 ;
  - l'icône officielle du type.
- **[décidé, 8 novembre 2026] Compteur des trophées à paliers**, comme sur psnprofiles (capture de l'utilisateur, Phantom Blade Zero) :
  - Certains trophées demandent d'atteindre un nombre, par exemple « Defeat the Four Great Puppets » (4) ou « Synthesize 5,000 collectables ».
  - Tant qu'un tel trophée n'est pas obtenu, sa progression s'affiche **à la place de la date** : « 0/4 », « 3,626/5,000 ».
  - Le compteur est en 15 px, gras, de la couleur du texte, avec les séparateurs de milliers de 8.1.
  - Un trophée obtenu affiche sa date, jamais de compteur.
  - Seules les listes PS5 ont des compteurs. Au 8 novembre 2026, il en restait par exemple 60 dans FFXIV Online, 7 dans Phantom Blade Zero, 8 dans The Last of Us Part II Remastered et 5 dans Nioh 3.
  - **[mon choix]** Si la progression de l'utilisateur est inconnue, rien n'est affiché : pas de « 0 » supposé (2, anti-objectifs).
  - La maquette v5 (`jeu-v5.html`) montre ces compteurs sur FFXIV Online et Phantom Blade Zero.
- **[décidé] Un trophée obtenu se distingue** par un fond vert, comme sur psnprofiles, et par sa date.
  - **[mon choix]** Le fond est le vert `#3DBE6B` à 14 %, avec un liseré de 2 px de ce vert autour de l'icône. La date est en `#93E2AE`.
  - Un trophée non obtenu n'a ni fond, ni liseré, ni date. Son icône reste en couleur.
- **[décidé] Les trophées secrets sont tous affichés en entier**, nom et description compris, qu'ils soient obtenus ou non. Le PSN fournit ces textes. Il n'y a pas de bouton « Hide secret trophies ».

**Colonne latérale** (320 px, 10)
1. **[décidé] La jaquette en grand**, en 320 × 320 : la même jaquette carrée que dans la liste des jeux (8.7), ou à défaut l'icône de la liste de trophées, sans la rogner, sur la même tuile carrée sombre que dans la liste Games (**[décidé, 9 novembre 2026]**, aucune image rectangulaire).
2. **Infos du jeu**, dans un panneau :
   - **[décidé] Deux lignes de totaux** :
     - « Total 58 trophies · 1,485 points », avec les pastilles du nombre de trophées par type ;
     - « Earned 47 trophies · 1,320 points », avec les pastilles du nombre obtenu par type.
     - Points PSN : bronze 15, argent 30, or 90, platine 300. On retrouve les totaux de psnprofiles pour Cyberpunk.
   - **[décidé] Récapitulatif des raretés** : la barre empilée et les 5 chiffres de 8.8, sur **tous** les trophées de la liste, DLC compris.
     - **[décidé]** Les 5 colonnes ont la même largeur, avec le chiffre et le libellé **centrés** dans chacune.
   - **[décidé] Publisher, Genre, Release date**, venus du PSN seul (6.3) :
     - l'éditeur tel que le store le nomme (« CD PROJEKT RED S.A. ») ;
     - les genres en clair, sans doublon, séparés par des virgules (« Role Playing Games ») ;
     - la date de sortie du concept, au format de 8.1 (« 10 Dec 2020 »).
     - **[décidé] Pas de développeur** : le PSN ne le fournit pas, et IGDB a été écarté.
     - **[mon choix]** Une ligne dont la valeur est inconnue est masquée.
   - **[décidé] Avg. rarity** : la moyenne des raretés PSN de tous les trophées de la liste (« 25.81% »).
     - Juste en dessous, **sur une seule ligne**, les valeurs seules : la plus basse, la médiane et la plus haute (« 0.50% · 19.05% · 86.20% »).
     - **[décidé]** Les libellés « Lowest », « Median » et « Highest » n'apparaissent qu'**au survol** de chaque valeur, qu'un fin pointillé signale.
     - Les trophées sans rareté connue sont exclus de ces calculs.
   - **[décidé] Guides** : deux liens, ouverts dans un nouvel onglet.
     - « **PowerPyx roadmap** » ouvre `https://www.powerpyx.com/?s=<nom>+roadmap`, une recherche du nom du jeu suivi du mot « roadmap ». Pour Cyberpunk, le premier résultat est « Cyberpunk 2077 Trophy Guide & Roadmap ».
     - « **PSNProfiles guides** » ouvre `https://psnprofiles.com/search/guides?q=<nom>`, la recherche des guides de psnprofiles, **sans** « roadmap ». C'est l'adresse qu'utilise le champ de recherche de https://psnprofiles.com/guides.
     - `<nom>` est le nom de la liste sans ™, ® ni ©, avec les espaces multiples réduits à un, puis encodé pour l'adresse.
     - **Aucune lettre ni aucun chiffre ne doit disparaître.** La v4 a eu ce défaut : Gran Turismo cherchait « Gran Turi mo ». La règle tient en **une seule fonction**, couverte par des tests sur les « s », ™ / ®, apostrophes droites et typographiques, deux-points et accents. Elle a été vérifiée sur les 266 noms.
3. **Timeline**, dans un panneau du même nom. Chaque ligne a un libellé en gras, une précision en dessous, et à droite la date et l'heure sur deux lignes.
   - **[décidé] First trophy** : sa date, avec le temps écoulé en dessous (« 4 years ago », même règle que les milestones, 8.8).
   - **[décidé] Platinum** : sa date, avec en dessous le temps mis depuis le premier trophée.
     - Ce temps garde ses **3 plus grandes unités**, comme psnprofiles : « 1 week, 4 days, 3 hours ».
     - **[mon choix]** Ces 3 unités sont consécutives : elles partent de la plus grande unité non nulle, puis les unités nulles parmi elles sont omises. Par exemple, 1 an, 0 mois, 2 semaines et 3 jours donnent « 1 year, 2 weeks ». C'est le comportement de la maquette validée.
     - Si le platine n'est pas obtenu, la ligne affiche « Not earned yet ». Si le jeu n'a pas de platine, la ligne n'apparaît pas.
   - **[mon choix] Latest trophy** : la date du dernier trophée obtenu, avec le temps écoulé en dessous. Elle montre d'où part l'écart.
   - **[décidé] Gap** : le temps entre le premier et le dernier trophée obtenus, avec **toutes les unités non nulles jusqu'à la minute**. Cyberpunk donne « 4 years, 4 months, 21 hours, 11 minutes ».
   - Règles communes **[mon choix]** :
     - unités : years, months, weeks, days, hours, minutes ;
     - une unité nulle est omise ;
     - le calcul se fait sur l'heure de Paris, pour qu'un changement d'heure ne décale pas les heures.
   - Sans aucun trophée obtenu, la Timeline n'a qu'une ligne : « No trophy earned yet ».

**Écrans étroits** **[mon choix]**
- Sous 980 px :
  - la page passe sur une colonne ;
  - les infos du jeu et la Timeline passent **au-dessus** de la liste, côte à côte si la place le permet ;
  - la jaquette est masquée : la bannière et le bandeau montrent déjà le jeu.
- Sur téléphone (640 px et moins) :
  - le logo est masqué ;
  - la date et la rareté d'un trophée passent sous son nom, sur une seule ligne.
- La liste adapte ses lignes à sa propre largeur : sous 720 px de liste, les en-têtes de groupe passent sur deux lignes, et la date et la rareté s'empilent à droite.

**Ce que la page n'a pas**, alors que la page d'un jeu sur psnprofiles l'a :
- **[décidé]** Tout ce qui ne sert pas à l'utilisateur, ou que le PSN ne fournit pas :
  - les guides écrits sur psnprofiles même, que remplacent les deux liens de recherche ;
  - les notes, vues et favoris des guides, les boutons de partage et les listes « to-do » ;
  - le développeur, les thèmes, les modes de jeu, les autres noms du jeu et les dates de sortie par plateforme, qui viennent d'IGDB ;
  - les chiffres des autres joueurs (propriétaires, rang, classements, joueurs récents), qui sont des non-objectifs (2).
- **[décidé, 8 novembre 2026] Pas de lien vers l'autre version du jeu.** Un jeu sorti sur PS4 et sur PS5 a deux listes de trophées, donc deux pages (Cyberpunk 2077 : PS4 à 100 %, PS5 à 86 %). psnprofiles relie les deux dans un encart « Other platforms and regions ». Ici, pour passer de l'une à l'autre, on repasse par la liste des jeux.

**[décidé, 9 novembre 2026]** Le bandeau et les repères des trophées non obtenables de cette page sont décrits en 14.7.

## 9. Page Settings
- **Banner [décidé]** :
  - envoi d'une image **depuis le PC** (JPEG, PNG ou WebP, 10 Mo maximum **[mon choix]**), avec aperçu ;
  - choix de la partie verticale à garder (8.2) ;
  - l'image est stockée sur un volume Docker ;
  - un bouton permet de revenir à la bannière par défaut, qui est la bannière automatique du dernier jeu joué (8.2).
  - **[mon choix, 8 novembre 2026]** Sans bannière personnalisée :
    - l'aperçu montre la bannière automatique, avec la mention « Automatic — last played game (<nom du jeu>) » ;
    - le bouton s'appelle « Use automatic banner » ;
    - le curseur de position ne s'applique qu'à une bannière personnalisée.
- **PSN token [décidé]** : un encart pour **renouveler le NPSSO**, accompagné d'un **mini tuto** pour le récupérer :
  1. Se connecter sur https://www.playstation.com dans son navigateur.
  2. Dans le même navigateur, ouvrir https://ca.account.sony.com/api/v1/ssocookie.
  3. Copier la valeur de `npsso` (64 caractères).
  4. La coller ici et enregistrer.
  - **[mon choix]** À l'enregistrement, le token est validé tout de suite en l'échangeant contre des tokens. La page affiche ensuite son état (valide, expiré), la date de saisie et l'âge du token. Le token lui-même n'est jamais réaffiché.
- **Sync history [décidé]** : les dernières exécutions, avec leur statut, leur durée et leurs erreurs.
- **Log out.**
- Le Trophy cabinet **ne se modifie pas ici [décidé]** : son éditeur est sur la page principale (8.8).

**[décidé, 9 novembre 2026]** Le bloc « Unobtainable trophies » de cette page est décrit en 14.9.

## 10. Système visuel « Console »
- Inspiré de l'écran d'accueil de la PS5 : la bannière, floutée, sert de fond à toute la page ; les panneaux sont translucides, avec un flou d'arrière-plan et des coins arrondis.
- Police : **Sora** (300 à 700). Les grands chiffres des stats sont en 300.
- Couleurs :
  - fond `#0F1631` ;
  - texte `#F3F5FB`, texte secondaire `#A9B3CB` ;
  - accent `#5AA9FF` ;
  - métaux : platine `#D3E2FF`, or `#F2C462`, argent `#C9D0DA`, bronze `#DE9563` ;
  - rangs de complétion des barres de progression : S `#667FB2`, A `#008000`, B `#7B9E00`, C `#A68E00`, D `#A66A00`, E `#FF4100`, F `#EE0000` (voir 8.7).
- **[décidé] Proportions**, calquées sur psnprofiles mesuré à la largeur d'écran de l'utilisateur (1 630 px) :
  - **contenu de 1 400 px**, **colonne latérale ~450 px** (environ un tiers) ;
  - bannière au format 1920 × 520 ;
  - lignes de jeux ~80 px, lignes des listes latérales ~66 px, icônes du carrousel et des listes 56 px ;
  - texte de base 14 px, chiffres des stats 28 px fins.
  - La v2 était jugée « trop grosse » partout, la v3 avait une bannière trop petite, et la v4 une bannière trop rognée.
- **[décidé, 8 novembre 2026] Proportions de la page d'un jeu** (8.9), mesurées sur la page Cyberpunk de psnprofiles à 1 630 px :
  - colonne latérale de **320 px**, avec une jaquette en 320 × 320 ; la liste prend le reste, soit ~1 064 px pour un contenu de 1 400 px (1 046 sur psnprofiles) ;
  - lignes de trophées de **66 px**, icônes de **56 px**, nom des trophées en 15 px ;
  - en-têtes de groupe de **110 px**, icônes de groupe de **100 px** ;
  - la bannière a la même hauteur que celle de Games.
  - La v1 (colonne de 450 px, comme Games) donnait une jaquette et une colonne jugées trop grosses. La page Games garde sa colonne de 450 px : sur psnprofiles aussi, la page d'un jeu a une colonne plus étroite que la page de profil.
- Le site s'adapte jusqu'au mobile. Le focus clavier est visible, et la demande de réduction des animations est respectée (sauf pour le défilement du carrousel, voir 8.6).

## 11. Déploiement
- **[décidé] Deux stacks Portainer** : une pour le site, une pour le reste.
  - **Stack « site »** **[mon choix pour sa composition]** : `app` (Next.js en mode `standalone`) et `worker` (la même image, lancée avec une autre commande, qui planifie et exécute les synchros). Les deux viennent du même code et sont mis à jour ensemble à chaque nouvelle version.
  - **Stack « infra »** : `postgres` (avec son volume de données) et `nginx`.
  - **[mon choix]** Les deux stacks communiquent par un réseau Docker externe partagé, créé une fois pour toutes.
- **Chaîne d'accès [décidé]** : internet → **reverse proxy de DSM**, qui gère le HTTPS et le certificat du nom `synology.me` → **nginx** (sur un port du NAS) → `app`.
  - **[mon choix]** Le site est servi à la racine de son adresse (sous-domaine ou port dédié), jamais sous un chemin du type `/psn`. L'adresse exacte est un réglage de DSM, pas du code.
  - nginx transmet `X-Forwarded-For` et `X-Forwarded-Proto` à l'application.
- **Build [décidé]** : le code est sur GitHub, et **GitHub Actions** construit l'image Docker.
  - **[mon choix]** L'image est construite pour `linux/amd64` (le DS1522+ est un x86-64 avec 8 Go de RAM), puis publiée sur le registre de GitHub (GHCR). Portainer la télécharge pour mettre à jour la stack « site ».
  - **[décidé]** La mise en place côté GitHub sera expliquée pas à pas à l'utilisateur au moment voulu : création du dépôt, accès de Portainer au registre, quotas de l'offre gratuite.
- **Volumes :**
  - données Postgres ;
  - images (bannière envoyée et images Sony stockées en local, 6.5).
- **Variables d'environnement :** connexion à la base, identifiant et mot de passe du site, clé de chiffrement, langue PSN, `TZ=Europe/Paris`.
- **Sauvegardes [décidé]** : **rien à faire côté application**. Le NAS est en RAID SHR : si un disque lâche, il suffit de le remplacer et le volume se reconstruit. Le site n'a ni sauvegarde automatique, ni export de base.

## 12. Laissé au builder
Il choisit :
- l'ORM et les migrations, la bibliothèque d'authentification, le mécanisme de planification dans le worker et le verrou « une seule synchro à la fois » ;
- le schéma exact, la stratégie de tests, la structure du code ;
- la façon dont le bouton « Sync now » suit l'avancement (rafraîchissement périodique ou flux).

Il doit aussi vérifier en pratique la détection des nouveaux DLC (6.4).

## 13. Points restants
- **Page de détail d'un jeu :** maquette validée le 8 novembre 2026 (8.9), construite, vérifiée avec les vraies données et fusionnée dans `main` le 9 novembre 2026 (PR #4). La phase 1 est terminée.
- **Jeux aux trophées non obtenables :** fonctionnalité demandée le 8 novembre 2026, cadrée, maquette validée, construite et vérifiée avec les vraies données le 9 novembre 2026, décrite en 14. Fusionnée dans `main` le 9 novembre 2026 (PR #6).
- **Ordre de la suite [décidé, 9 novembre 2026] :** les pages Plat Wall, Trophy Log, Trophy Advisor et Stats sont construites **avant** le déploiement sur le NAS.
- **Page Plat Wall :** cadrée, maquette validée, construite et vérifiée avec les vraies données le 9 novembre 2026, décrite en 15. Fusionnée dans `main` le 9 novembre 2026 (PR #9).
- **Page Trophy Log :** cadrée, maquette validée, construite et vérifiée avec les vraies données le 10 novembre 2026, décrite en 16. Fusionnée dans `main` le 10 novembre 2026 (PR #11).
- **[décidé, 10 novembre 2026] Place du bouton « Show all » :** dans l'en-tête d'une liste, il vient toujours **après** le nombre affiché, comme sur le Trophy Log (16.5). Cela vaut pour la page **Trophy Advisor**, à construire ainsi. La liste **Games** (14.6) a été corrigée en même temps que Trophy Advisor.
- **Page Trophy Advisor :** cadrée, maquette validée, construite et vérifiée avec les vraies données le 11 novembre 2026, décrite en 17. Fusionnée dans `main` le 11 novembre 2026 (PR #13).
- **Page Stats :** cadrée, maquette validée, construite et vérifiée avec les vraies données le 11 novembre 2026, décrite en 18. Fusionnée dans `main` le 11 novembre 2026 (PR #15).
- **Stats au doigt et défilement des années :** demandé le 11 novembre 2026 après la fusion, maquette validée le même jour, décrit en 18.14. Construit et vérifié avec les vraies données le 11 novembre 2026. Fusionné dans `main` le 11 novembre 2026 (PR #17).
- **Points de suivi de la phase 1 :** tous traités avant le déploiement sur le NAS, à la demande de l'utilisateur, cadrés le 11 novembre 2026, décrits en 19. Construits et vérifiés avec les vraies données, fusionnés dans `main` le 12 novembre 2026 (PR #19).
- **[décidé, 12 novembre 2026] Audit du 11 novembre 2026 :** le bilan `a_reprendre.md`, écrit par une autre session, reste dans le dépôt : ses points devront être vérifiés ou corrigés un jour. Son point S1 (`sandbox` de `/media`) est corrigé dans la PR #19. Le reste n'est ni décidé ni commencé : chaque point retenu passera par le processus habituel, et les retouches de design par une validation de l'utilisateur.
- **[décidé, 12 novembre 2026] Suites de l'audit, lots 1 et 2 :** P1, S2, R1, S3, S4, S5, S6 et R2 sont traités avant le déploiement sur le NAS, sur la branche `fix/audit`, décrits en 20. Le lot 3, S7 et les retouches de design D1 à D7 restent pour plus tard.

## 14. Jeux aux trophées non obtenables
**[décidé, cadrage du 9 novembre 2026]** Fonctionnalité construite à part, sur la branche `feat/unobtainable`. Maquette validée le 9 novembre 2026 : `docs/superpowers/specs/2026-11-09-psn-tracker-maquette-nonobt.html`, référence pour l'aspect et le CSS. Les choix que l'utilisateur n'a pas faits lui-même sont marqués **[choix de Claude]**.

### 14.1 Intention
L'utilisateur veut savoir, parmi les jeux de son profil, lesquels ont des trophées qu'on ne peut plus obtenir. Le but : **ne pas prévoir de faire un jeu pour découvrir au dernier moment qu'un trophée est impossible.** Peu de jeux sont concernés (5 sur 266), mais l'information reste utile.

Elle sert aussi à **retirer ces jeux de la liste** : par exemple « Not 100% » avec « Without unobtainable ». Et elle sera réutilisée plus tard par Trophy Advisor, avec son propre filtre, pour ne pas polluer la liste des trophées non obtenus.

### 14.2 Objectifs, non-objectifs, anti-objectifs
**Objectifs**
- Signaler les jeux concernés dans Games, et les trophées concernés sur la page d'un jeu.
- Un filtre « With / Without unobtainable » qui se combine à tous les autres.
- Un bouton pour afficher tous les jeux d'un coup.
- L'adresse de la liste modifiable dans Settings.
- **Chaque trophée concerné est marqué en base**, pas seulement le jeu, pour que Trophy Advisor puisse s'en servir sans nouveau travail sur les données.

**Non-objectifs**
- Trophy Advisor lui-même et son filtre (page à venir).
- Toute modification des stats du profil : le filtre ne change que la liste affichée, contrairement à « Hide 0% games » (8.4) **[choix de Claude]**.
- Une correction manuelle d'un jeu mal reconnu : la vérification du 14.3 ne montre aucun cas qui la justifie **[choix de Claude]**.

**Anti-objectifs** (ce qui serait un échec même si tout fonctionne)
- **Un jeu concerné qui n'est pas signalé** : c'est exactement la situation à éviter. Dans le doute, on préfère signaler (14.4, plusieurs entrées).
- Une panne de la liste qui ferait disparaître les repères existants.
- Une liste de trophées marqués faux : le rouge doit tomber sur les bons trophées.
- Une dépendance au token PSN : la liste doit se télécharger même si le token a expiré.

### 14.3 La source et ce qu'on y a vérifié
- Adresse par défaut : `https://psnp-plus.huskycode.dev/list.json` (liste maintenue pour l'extension PSNP+, 536 Ko).
- Format : `{ "version": 2, "list": { "<id psnprofiles>": { "title", "platforms", "submitter", "note", "trophies": [numéros], "timestamp" } } }`. `timestamp` manque sur 43 entrées, `note` est vide sur 2.
- Elle compte 1 622 entrées, dont 1 150 sur PS4 ou PS5. Elle ne donne **aucun identifiant PSN**.

**Vérifié le 9 novembre 2026 en comparant la liste à la base réelle (266 jeux) :**
- **Le numéro moins 1 donne le `trophyId` PSN.** Sur Final Fantasy XV, `[68…74, 89, 90, 91]` tombe exactement sur les 7 trophées du groupe 004 (Comrades) et les 3 du groupe 007 (sa mise à jour de mars 2018). Sans le « moins 1 », la série déborde sur le groupe suivant. Sur Gran Turismo Sport, `1` est le platine.
- **`[0]` veut dire « tous les trophées du jeu ».** 223 entrées valent exactement `[0]`, le `0` n'est jamais mélangé à d'autres numéros, et la note de MAG le dit en toutes lettres.
- **5 jeux reconnus, aucun manqué** en cherchant large (titres proches, distance d'édition, mots en commun) :

| Jeu | Progression | Non obtenables | Encore manquants |
|---|---|---|---|
| Gran Turismo Sport (PS4) | 67 % | 7 | 4, dont le platine |
| Marvel Heroes Omega (PS4) | 51 % | 37 (tous) | 13 |
| Final Fantasy XV (PS4) | 100 % | 10 | 0 |
| Dauntless (PS4) | 100 % | 45 (tous) | 0 |
| Dauntless (PS5) | 100 % | 46 (tous) | 0 |

- **La plateforme compte** : The First Descendant (PS5) ne doit pas être signalé, l'entrée ne vise que la version PS4. Pareil pour Rayman Legends (PS4), dont les entrées sont PS3 et Vita.

### 14.4 Rapprochement avec les jeux du profil
Tout ce paragraphe est **[choix de Claude]**, vérifié sur les vraies données : il redonne exactement les 5 jeux ci-dessus.
- **Clé de nom**, dans cet ordre : suppression de ™ ® © (sans rien laisser à leur place), décomposition Unicode NFKD, suppression des accents, minuscules, toute suite de caractères qui ne sont ni lettres ni chiffres (au sens Unicode) devient une espace, espaces de bord retirées. Une clé vide ne correspond à rien. L'ordre compte : NFKD transforme ™ en « TM », et 42 des 266 jeux du profil portent l'un de ces signes alors qu'aucun titre de la liste n'en a.
- **Plateforme** : il faut au moins une plateforme commune. `PSVITA` du PSN équivaut à `Vita` de la liste et `PSPC` à `PC` ; `PS3`, `PS4`, `PS5` sont identiques ; `VR` n'équivaut à rien.
- **Plusieurs entrées pour un même jeu** (une par région : Final Fantasy XV en a 4) : on prend **l'union** de leurs numéros, et si l'une vaut `[0]`, tout le jeu est concerné. Elles divergent dans 9 groupes sur 186 de la liste, aucun chez l'utilisateur. La note retenue est, parmi les entrées qui en ont une, celle de l'entrée au `timestamp` le plus récent (sans `timestamp` : après les autres ; à égalité : le plus petit identifiant).
- **Du numéro au trophée** : `trophyId = numéro − 1`. Un numéro qui ne correspond à aucun trophée du jeu est ignoré.
- **Un jeu est « concerné » dès que la liste marque au moins un de ses trophées existants**, même si l'utilisateur les a déjà tous. Le « ! » et le filtre utilisent cette même définition.
- **Nombre affiché** : le nombre de trophées réellement marqués dans le jeu (N). Cela remplace « la taille du tableau » du cadrage du 8 novembre, faux pour `[0]`.
- **Quand** : le rapprochement est refait après chaque téléchargement réussi et à la fin de chaque synchro, pour qu'un nouveau jeu soit signalé sans attendre le prochain téléchargement. Il s'applique d'un seul coup (transaction). Une synchro qui recharge un jeu ne doit pas effacer ses marques, même temporairement.
- La liste brute est gardée en base, pour refaire le rapprochement sans la retélécharger.

### 14.5 Téléchargement de la liste
**[choix de Claude]**, sauf le comportement en cas d'échec, montré dans la maquette validée.
- Fait par le worker, **indépendamment du token PSN et des synchros** : il n'apparaît pas dans « Sync history ».
- À faire si « Save » dans Settings l'a demandé. Sinon, au plus une tentative par heure, si la liste n'a jamais été téléchargée ou si le dernier succès date de 24 h ou plus. Vérifié à chaque itération du worker, avant les travaux PSN. Son échec n'empêche pas ceux-ci.
- Garde-fous, parce que l'adresse et le contenu viennent de l'extérieur : `http` ou `https` seulement, délai maximum de 30 s, taille maximum de 10 Mo.
- La réponse est refusée si ce n'est pas du JSON, si `version` n'est pas `2`, ou s'il ne reste aucune entrée valide. Une entrée mal formée est ignorée individuellement.
- **En cas d'échec, l'ancienne liste et toutes les marques restent en place.** L'échec est affiché dans Settings.

### 14.6 Liste Games (8.7)
- **Bouton « Show all »**, dans l'en-tête, après le nombre de jeux.
  - **[décidé, 10 novembre 2026]** Il était à gauche du nombre. Il est passé **après**, comme sur le Trophy Log (16.5) : l'utilisateur l'a demandé en voyant les deux pages côte à côte. Corrigé avec la page Trophy Advisor (17.8). La règle commune est en 13.
  - Visible tant qu'il reste des jeux à charger. Il n'apparaît donc pas si tout tient en 50 jeux ou moins.
  - Au clic : désactivé, libellé « Loading… », puis tous les jeux restants arrivent en une seule requête. Le bouton et la ligne « The next 50 games load as you scroll down » disparaissent, et la page ne bouge pas.
  - Si le chargement échoue : le bouton redevient « Show all » et le message existant « Couldn't load more games. Retry » s'affiche **[choix de Claude]**.
  - Changer un filtre repart des 50 premiers jeux, comme aujourd'hui.
- **Filtre**, juste après le menu de tri, avant la recherche.
  - Trois valeurs : « Unobtainable » (désactivé, par défaut), « With unobtainable », « Without unobtainable ».
  - Contour de couleur d'accent quand il est actif.
  - Il se combine avec l'état, la plateforme, le tri, la recherche et « Hide 0% games ». Le nombre de jeux de l'en-tête suit.
  - Comme les autres filtres, il vit dans l'adresse de la page (`unobtainable=with|without`) et n'est pas enregistré en base.
- **« ! » après le badge de plateforme** des jeux concernés, avec une infobulle au survol :
  - première ligne : « N unobtainable trophies », « 1 unobtainable trophy », ou « All N trophies are unobtainable » si tous les trophées du jeu sont marqués ;
  - seconde ligne : la note, en texte simple (14.8).

### 14.7 Page d'un jeu (8.9)
- **Bandeau** dans le panneau « Trophies », entre les menus et la liste, seulement sur les jeux concernés. Il reste affiché quels que soient le filtre et le tri des trophées.
  - Première ligne : le même nombre que l'infobulle, puis la situation de l'utilisateur : « 7 unobtainable trophies, 4 you don't have », « 10 unobtainable trophies, you have them all », « All 37 trophies are unobtainable, 13 you don't have ».
  - Seconde ligne : la note, avec ses liens cliquables (14.8).
- **Chaque trophée marqué** porte un « ! » à côté de son nom, avec une infobulle : « No longer obtainable. », ou « No longer obtainable. You already have it. » s'il est obtenu.
- **Non obtenable et non obtenu** : surbrillance rouge sur le même principe que la verte, fond à 14 % et anneau de 2 px autour de l'icône, couleur `--rank-f`.
- **Non obtenable mais obtenu** : surbrillance verte inchangée, seulement le « ! ».

### 14.8 Notes de la liste
Texte venu de l'extérieur, jamais interprété comme du HTML. 591 notes contiennent un lien Markdown. Seuls ces liens sont interprétés : les `**` et accents graves présents dans deux notes ne sont pas de la mise en forme (un nom censuré « b****** », une apostrophe tapée avec un accent grave) et restent tels quels.
- `[libellé](adresse)` : dans l'infobulle, seulement le libellé ; sur la page d'un jeu, un lien qui s'ouvre dans un nouvel onglet, si l'adresse est en `http` ou `https`.
- Note vide : pas de seconde ligne.

### 14.9 Settings (9)
Nouveau bloc « Unobtainable trophies », après « PSN token ».
- **État** :
  - « Up to date » : date du téléchargement · nombre d'entrées de la liste · nombre de jeux du profil concernés (jeux masqués exclus) ;
  - « Download failed » : raison et date de la tentative · date de la liste encore utilisée, ou l'absence de liste **[choix de Claude pour ce dernier cas]** ;
  - « Not downloaded yet » et « Downloading… » **[choix de Claude]**.
- **« List address »** : champ prérempli avec l'adresse par défaut, et bouton « Save ».
- « Save » refuse une adresse qui n'est pas en `http` ou `https`, avec le message d'erreur habituel des formulaires de Settings, et déclenche un téléchargement. Enregistrer la même adresse relance donc le téléchargement **[choix de Claude]**.

### 14.10 Laissé au builder
- Le schéma exact (colonnes, tables, stockage de la liste brute), à condition qu'on puisse interroger en SQL les trophées marqués.
- L'organisation du code, le découpage des composants, le mécanisme de l'infobulle (elle ne doit pas être coupée par le panneau) et son accès au clavier.
- Le format des dates, qui suit ceux déjà utilisés sur le site.
- L'usage éventuel de l'ETag renvoyé par le serveur : ce n'est pas demandé.

### 14.11 Vérification avec les vraies données
- Les 5 jeux du 14.3 sont signalés, avec ces nombres, et aucun autre.
- Gran Turismo Sport : 4 trophées en rouge, 3 en vert avec « ! ». Final Fantasy XV : 10 trophées marqués, dans les groupes 004 et 007.
- « Not 100% » avec « Without unobtainable » donne le nombre de jeux non terminés moins les jeux concernés non terminés (39 le jour de la vérification, Cyberpunk 2077 venant de passer à 100 %), « With unobtainable » 5.
- « Show all » affiche les 266 jeux.
- Une adresse invalide ou inaccessible affiche l'échec et ne change aucun repère.

## 15. Page Plat Wall
**[décidé, brainstorming du 9 novembre 2026]** Page construite à part, sur la branche `feat/plat-wall`. Maquette validée le 9 novembre 2026 (v3) : `docs/superpowers/specs/2026-11-09-psn-tracker-maquette-platwall.html`, référence pour l'aspect et le CSS. Les choix que l'utilisateur n'a pas faits lui-même sont marqués **[choix de Claude]**. Il les a vus sur la maquette ou lus dans la conversation, et ne les a pas contestés.

### 15.1 Intention
L'utilisateur veut **voir tous ses platines d'un seul coup d'œil**, sur le modèle du Plat Wall de pocketpsn, et **fabriquer une image PNG de ce mur, avec ses stats en haut**, pour la garder.

Différence voulue avec pocketpsn : pocketpsn montre les jaquettes des jeux. Ici, chaque case montre **la miniature du trophée platine lui-même**, celle de la liste des trophées du jeu (pour Cyberpunk 2077, l'image de « Never Fade Away »), et non le pictogramme générique du platine.

### 15.2 Objectifs, non-objectifs, anti-objectifs
**Objectifs**
- Tous les platines obtenus sur une seule page, sans limite d'affichage.
- Choisir ce qui s'affiche (image, rareté, nom), filtrer par année et par plateforme, trier.
- Un export PNG qui reprend exactement les réglages en cours, et qui se télécharge **sur n'importe quel appareil**, téléphone compris.

**Non-objectifs**
- Le menu « 160 » de pocketpsn : tout s'affiche, toujours.
- Les platines non obtenus (Trophy Advisor s'en occupera).
- Un partage en ligne depuis le site : l'image est faite pour être gardée.
- Une recherche, un choix de résolution, un historique des exports.

**Anti-objectifs** (ce qui serait un échec même si tout fonctionne)
- **Des images qui s'accumulent sur le serveur** (15.6).
- Un fond, une ombre ou une couleur ajoutés derrière une miniature à fond transparent.
- Une image rectangulaire (8.9).
- Un PNG qui ne correspond pas à ce que montre la page (filtres, tri, Display).
- Un téléchargement qui marche sur PC mais pas sur téléphone.
- Un nombre de platines différent de celui de la console.

### 15.3 Ce qu'on a vérifié sur les vraies données (9 novembre 2026)
- 230 platines obtenus, tous datés, tous avec une rareté PSN, aucun dans un jeu masqué.
- Les 230 miniatures sont déjà téléchargées, avec leur version WebP de 192 px. Toutes sont **carrées** : 138 en 240 × 240, 92 en 512 × 512.
- **134 ont de la transparence**, conservée dans les miniatures WebP.
- Par année (Europe/Paris) : 2026 : 42, 2025 : 4, 2024 : 1, 2022 : 30, 2021 : 56, 2020 : 35, 2018 : 30, 2017 : 31, 2016 : 1.
- Par plateforme : PS4 : 138, PS5 : 92. Les listes PS3+PS4 et Vita+PS4 comptent comme PS4, et PS5+PC comme PS5.

### 15.4 La page `/plat-wall`
Elle remplace la page « Coming soon » de cet onglet.
- **Haut de page [choix de Claude]** : la bannière (8.2), le bandeau profil avec « Sync now » (8.3) et les 6 cases (8.4), comme sur Games. Ni carrousel ni colonne latérale.
- **Panneau du mur**, en pleine largeur :
  - à gauche, « Zmx969's Plat Wall » (avec le pseudo du profil), et dessous « Showing X of Y platinum trophies », Y étant le total sans filtre ;
  - à droite, dans cet ordre : Display, années, plateformes, tri, puis le bouton blanc « Export PNG ».
- **Grille** : 13 cases par ligne en pleine largeur (cases d'environ 93 px), et moins si la fenêtre est plus étroite. En dessous de 640 px : 4 par ligne **[choix de Claude]**.
- **Case** :
  - la miniature, à coins arrondis de 12 px, **sans fond ni ombre** ; un léger agrandissement au survol ;
  - si Rarity est coché, le pourcentage dessous, au format du site (`17.76%`) ;
  - si Name est coché, le **nom du jeu** dessous, en 3 lignes au maximum, tel que le donne le PSN ;
  - si Art est décoché, une carte texte de la même largeur **[choix de Claude]**.
- **Au survol, une bulle** : nom du jeu, date d'obtention, rareté. **Au clic** : la page du jeu (8.9) **[choix de Claude]**.
- Le mur montre les platines obtenus des jeux non masqués, comme le reste du site. Une pile PS4 et PS5 du même jeu donne deux cases, puisque ce sont deux platines.
- Sans résultat : « No platinum trophies match these filters. »
- Un nouveau platine apparaît après une synchro sans recharger la page, comme sur Games **[choix de Claude]**.

### 15.5 Réglages
- **Display** [décidé] : trois cases à cocher, Art, Rarity, Name. Par défaut, seul Art est coché. Au moins une reste cochée **[choix de Claude]**.
- **All years** [décidé] : « All years » par défaut, puis chaque année où l'utilisateur a un platine, de la plus récente à la plus ancienne **[choix de Claude pour n'afficher que celles-là]**. L'année est celle de la date d'obtention, en Europe/Paris.
- **All platforms** [décidé] : « All platforms » par défaut, PS4, PS5. Même règle que le filtre de Games : un jeu est retenu si la plateforme fait partie de sa liste.
- **Tri** [décidé] : Newest par défaut, Rarity, Alphabetical.
  - Rarity va du plus rare au moins rare **[choix de Claude]**.
  - Alphabetical trie sur le nom du jeu, sans tenir compte de la casse **[choix de Claude]**.
  - À égalité, le plus récent passe devant **[choix de Claude]**.
- Année et plateforme prennent le contour d'accent quand ils sont actifs, comme les filtres de Games.
- **[choix de Claude]** Comme sur Games, les réglages vivent dans l'adresse de la page, sans être enregistrés en base. « Précédent » ramène au même affichage, une nouvelle visite repart des valeurs par défaut.

### 15.6 Export PNG
**Parcours [décidé]** : « Export PNG » ouvre un aperçu par-dessus la page, et c'est depuis cet aperçu qu'on télécharge.
- Pendant la fabrication : « Generating your image… » avec une icône qui tourne, et « Download PNG » inactif.
- Image prête : l'image entière à la largeur de l'écran, qu'on fait défiler. Une barre reste visible en haut : « PNG preview », les dimensions, « Download PNG », « Close ».
- « Close » ou Échap ramène à la page, avec les mêmes réglages **[choix de Claude pour Échap]**.
- En cas d'échec : un message et un bouton pour réessayer **[choix de Claude]**.
- **« Download PNG » doit fonctionner sur PC, Android et iPhone** [décidé]. C'est donc un vrai fichier envoyé par le serveur en téléchargement.
- Nom du fichier **[choix de Claude]** : `Zmx969-plat-wall.png`, ou avec les filtres actifs : `Zmx969-plat-wall-2026-PS5.png`. Le tri et Display n'y figurent pas.

**Contenu de l'image**
- **Double résolution, 2896 px de large** [décidé : l'image est faite pour être gardée], la même quelle que soit la fenêtre ou l'appareil. Toujours 13 cases par ligne. La hauteur dépend du nombre de platines et de Display : mesuré sur les vraies données, 2896 × 4560 px et 16 Mo pour les 230 avec Art seul, 2896 × 6789 px et 17 Mo avec Rarity et Name.
- En haut, la bannière du site derrière le bandeau, comme sur la page, et la même image floutée en fond de toute l'image. Sans bannière, le fond uni du site.
- Le bandeau profil : avatar, pseudo, compteurs, niveau PSN. **Sans le bouton Sync** [décidé] et sans « Last synced » **[choix de Claude]**. Les compteurs ont la hauteur de la vraie page : dans la maquette, celui du platine était déformé par un style du mur, défaut corrigé à la construction.
- Les 6 cases, avec les **stats de tout le profil**, jamais filtrées **[choix de Claude]**.
- Le mur, avec les réglages en cours : filtres, tri, Display.
- **Rien d'autre** [décidé, retiré de la maquette v1] : ni menu du site, ni titre, ni « Showing… », ni rappel des filtres.

**Stockage [décidé] : aucune image n'est écrite sur le disque du serveur.**
- Pas de fichier, pas de dossier temporaire, pas de ligne en base. L'image est fabriquée en mémoire à la demande.
- Le serveur garde **uniquement la dernière image en mémoire vive**, pour que « Download PNG » n'ait pas à la refabriquer. Elle est remplacée par l'export suivant et oubliée au bout de 10 minutes ou au redémarrage **[choix de Claude pour la durée]**. Si elle a disparu, le téléchargement la refabrique.

**Fabrication [choix de Claude]**
- Faite par le serveur et non par le navigateur. Safari sur iPhone refuse de dessiner dans une page une image de plus de 16,7 millions de pixels environ, et les 230 platines avec Rarity et Name en font environ 20 millions.
- Avec `sharp`, déjà dans le projet pour le worker. Aujourd'hui l'application Next ne le charge jamais (`src/sync/thumbs.ts`). L'adresse d'export sera le seul endroit de l'application à le charger, et le build Docker doit échouer si elle ne peut pas le faire sur Alpine.
- Elle assemble les miniatures WebP de 192 px, assez grandes pour les cases de 186 px réels.
- Le texte est en **Sora**, la police du site, dont le fichier est ajouté au dépôt : l'image Docker Alpine n'a aucune police.
  - Trois noms de jeux contiennent aujourd'hui un caractère absent des jeux de glyphes publiés de Sora : `Ⅱ`, `Ⅻ` et `～`. Dans l'image, tout caractère absent de la police est remplacé par son équivalent (`II`, `XII`, `~`), ou retiré s'il n'en a pas **[choix de Claude]**. La page, elle, garde le nom exact du PSN.
  - Les écritures non latines ne sont pas traitées : le site demande les noms en anglais (8.1).
- La fabrication doit rester largement sous la limite de 60 s de nginx sur le NAS. PNG sans perte. Mesuré en production sur le PC de développement : environ 9 s pour les 230 platines.
- L'adresse d'export est protégée par la session, comme les autres API, et refuse les paramètres invalides.

### 15.7 Laissé au builder
- L'organisation du code, le découpage des composants, l'adresse de l'API.
- La façon de dessiner le texte, à condition que le rendu soit en Sora sur Alpine.
- Le mécanisme de la bulle (elle ne doit pas être coupée par le panneau) et son accès au clavier.
- Le niveau de compression du PNG.

### 15.8 Vérification avec les vraies données
- « Showing 230 of 230 », et les nombres par année et par plateforme du 15.3. 2026 avec PS5 donne 40.
- Cyberpunk 2077 montre « Never Fade Away ». Arknights: Endfield n'a aucun fond derrière le trophée.
- Export sans filtre : 2896 px de large, 230 cases, en Sora, sans bouton Sync ni titre. Export filtré, trié, avec Rarity et Name : identique à la page, et sans case vide à la place d'un caractère sur Dark Souls II, Final Fantasy XII et Code: Realize (15.6).
- « Download PNG » enregistre le bon fichier avec le bon nom, sur PC et en affichage téléphone.
- Après plusieurs exports, le nombre de fichiers du dossier des images n'a pas changé.
- **À vérifier au premier déploiement**, car impossible ici : le texte en Sora dans l'image Docker, la durée de fabrication sur le NAS, et le téléchargement sur un vrai iPhone.

## 16. Page Trophy Log
**[décidé, brainstorming du 10 novembre 2026]** Page construite à part, sur la branche `feat/trophy-log`. Maquette validée le 10 novembre 2026 (v2) : `docs/superpowers/specs/2026-11-10-psn-tracker-maquette-trophylog.html`, référence pour l'aspect et le CSS. Les choix que l'utilisateur n'a pas faits lui-même sont marqués **[choix de Claude]**. Il les a lus dans la conversation et les a validés avec la description.

### 16.1 Intention
L'utilisateur va sur le Trophy Log de psnprofiles surtout pour **voir ses derniers trophées obtenus, dans une belle liste chronologique**. Celui de psnprofiles lui convient tel qu'il est. Sa capture montre une ligne par trophée : image du jeu, icône, nom, description, numéro d'obtention, date, rareté et type. La page reprend cette forme, avec la rareté PSN et les règles d'images du site.

### 16.2 Objectifs, non-objectifs, anti-objectifs
**Objectifs**
- Tous les trophées obtenus, une ligne chacun, du plus récent au plus ancien par défaut.
- Trier par date, par ordre alphabétique et par rareté, dans un sens ou dans l'autre.
- Filtrer par plateforme, par catégorie de rareté et par type, et tout remettre par défaut d'un clic.
- Chaque trophée porte son numéro d'obtention (« #11,636 »), le même que celui des milestones.
- Rejoindre la page du jeu d'un clic.

**Non-objectifs**
- Les colonnes « Achievers » et « Owners » de psnprofiles : le PSN ne fournit que le pourcentage.
- Une recherche, un filtre par jeu ou par période **[choix de Claude : non demandés]**.
- Les trophées non obtenus : Trophy Advisor s'en occupera.
- Un export.

**Anti-objectifs** (ce qui serait un échec même si tout fonctionne)
- Un platine numéroté ou placé avant le dernier trophée de son jeu (16.4).
- Un numéro d'obtention différent de celui des milestones, ou qui change avec les filtres ou le tri.
- Un fond, une ombre ou un cadre derrière une icône de trophée à fond transparent (16.7).
- Une image rectangulaire (8.9).
- Une page lente, même après « Show all » sur les quelque 11 600 trophées.

### 16.3 Ce qu'on a vérifié sur les vraies données (10 novembre 2026)
- 11 636 trophées obtenus, tous datés à la seconde, tous avec une rareté PSN. Aucun jeu masqué.
- Par type : 230 platines, 990 or, 2 434 argent, 7 982 bronze.
- Par plateforme, avec la règle de Games : PS4 7 075, PS5 4 561.
- 1 363 trophées obtenus appartiennent à un DLC. 128 sont aujourd'hui non obtenables (14).
- **Les 230 platines ont tous été obtenus à la même seconde qu'un autre trophée de leur jeu**, et 539 secondes comptent plusieurs trophées. L'ordre à égalité n'est donc pas un cas rare.
- Le dernier trophée est « The Heart's Journey » (Phantom Blade Zero), n° 11 636, comme sur psnprofiles.
- La rareté PSN diffère beaucoup de celle de psnprofiles : « The APB is Not Enough » vaut 4.60 % ici et 22,94 % chez psnprofiles, qui ne compte que ses membres (1).

### 16.4 Numéro d'obtention et ordre par date
- **[décidé]** Chaque trophée a un numéro : sa place dans l'ordre d'obtention de tous les trophées obtenus, le premier étant le n° 1. Le plus récent porte donc le total.
- **[décidé, retour sur la maquette v1] À la même seconde, le platine passe après les autres trophées.** Il est forcément obtenu en même temps que le dernier trophée de son jeu, et ne peut pas le précéder. Exemple de Magicka 2 : « Archmage » n° 11 621, puis le platine « You Are The Special » n° 11 622, tous deux à 00:16:37.
- La règle complète est celle des milestones (`src/stats/milestones.ts`, 8.8) : la seconde d'obtention, puis le platine en dernier, puis le `trophyId`, puis l'identifiant de la liste. **[choix de Claude] Une seule définition** sert aux deux, pour que le n° 10 000 du Trophy Log soit le « 10,000th trophy » des milestones.
- Le numéro ne change ni avec les filtres ni avec le tri : c'est le rang dans tout le profil.
- Comme dans le reste du site, seuls comptent les trophées des jeux non masqués.
- Le tri par date suit exactement cet ordre. Par défaut, du plus grand numéro au plus petit.

### 16.5 La page `/trophy-log`
Elle remplace la page « Coming soon » de cet onglet.
- **Haut de page [choix de Claude]** : comme le Plat Wall (15.4), la bannière, le bandeau profil avec « Sync now » et les 6 cases. Ni carrousel ni colonne latérale.
- **Panneau**, en pleine largeur :
  - en-tête : à gauche « Zmx969's Trophy Log », avec le pseudo du profil ;
  - à droite de l'en-tête, le nombre : « 11,636 trophies » sans filtre, « 1,234 of 11,636 trophies match » dès qu'un filtre de plateforme, de rareté ou de type est actif ; puis le bouton « Show all » tant que tout n'est pas chargé, le même que sur Games ;
  - en dessous, les contrôles (16.6), puis la liste.
- **Ligne de trophée [décidé, d'après la capture de psnprofiles]**, ~66 px, de gauche à droite :
  1. **l'image du jeu** [décidé : gardée], 56 px, coins de 10 px : la même que sa ligne dans Games (jaquette carrée, ou icône sur sa tuile, 8.9). C'est un lien vers la page du jeu ;
  2. **l'icône du trophée**, 56 px, coins de 10 px, **sans aucun fond** [décidé] ;
  3. le **nom** (15 px, gras), la **description** en dessous, en entier, puis une ligne avec **le nom du jeu**, lien vers sa page [décidé], le nom du DLC pour un trophée de DLC (« · Phantom Liberty ») et les pastilles de plateforme de la liste (8.7) **[choix de Claude]** ;
  4. le **numéro** (« #11,636 », séparateurs de 8.1), en gris ;
  5. la **date** (« 9 Nov 2026 ») et l'**heure avec les secondes** (« 15:46:30 ») [décidé], sur deux lignes, en vert clair `#93E2AE`. Heure de Paris au format 24 h, comme la page d'un jeu **[choix de Claude]** : psnprofiles affiche « 2:46:30 PM », dans un autre fuseau ;
  6. la **rareté PSN** (« 4.60% ») et sa catégorie (« Ultra rare »), avec les paliers de 8.8 ;
  7. l'**icône officielle du type**, 30 px.
- La ligne elle-même n'est pas un lien : seuls l'image et le nom du jeu le sont **[choix de Claude]**. Les lignes n'ont pas de fond vert, puisque tous les trophées sont obtenus **[choix de Claude]**.
- **Trophée devenu non obtenable** : le même « ! » que sur la page d'un jeu pour un trophée obtenu, avec l'infobulle « No longer obtainable. You already have it. » (14.7) **[choix de Claude]**.
- Sans résultat : « No trophies match these filters. »
- **Chargement [décidé]** : 50 lignes, puis 50 de plus quand on approche du bas, comme Games (8.7), avec le texte « The next 50 trophies load as you scroll down » et le même « Retry » en cas d'échec. « Show all » charge tout le reste d'un coup.
  - **[décidé, 10 novembre 2026] Affichage progressif.** Afficher 11 636 lignes d'un seul coup figeait la page environ 3 s. Les lignes reçues s'ajoutent donc à la liste par paquets, un paquet par image affichée, et la page reste utilisable pendant ce temps. « Show all » affiche « Loading… » jusqu'au dernier paquet, et aucune autre page n'est demandée tant qu'il reste des lignes à afficher.
- **Retour [choix de Claude]** : revenir d'une page de jeu par « précédent » remet les lignes déjà chargées et la position, comme sur Games. Les lignes rechargées s'affichent aussi par paquets. La page défile jusqu'à la position gardée dès que les lignes affichées suffisent à l'atteindre **[choix de Claude]**.
- **Synchro [choix de Claude]** : les nouveaux trophées apparaissent après une synchro sans recharger la page, comme sur Games.
- **Écrans étroits [choix de Claude]** :
  - sous 900 px, l'image du jeu est masquée (le nom du jeu reste un lien), et l'icône passe à 48 px ;
  - sur téléphone (640 px et moins), le numéro, la date et la rareté passent sous la description, comme sur la page d'un jeu (8.9). **[choix de Claude, vérification du 10 novembre 2026]** À 375 px, ils ne tiennent pas sur une seule ligne : la rareté passe alors à la ligne suivante, ce qui est accepté ;
  - le numéro reste visible à toutes les largeurs. La maquette v2 le masque entre 640 et 900 px : c'est un défaut, à ne pas reproduire.

### 16.6 Tri et filtres
- **Tri [décidé]** : Date earned (par défaut), Alphabetical, Rarity.
  - Alphabetical trie sur le **nom du trophée**, sans tenir compte de la casse **[choix de Claude]**.
    - **[choix de Claude, vérification du 10 novembre 2026]** Le tri ignore aussi les accents, ainsi que la ponctuation et les espaces en tête du nom. Sur les vraies données, « Z to A » commençait par « …There You Are », « “Endless” » et « À On », et « A to Z » par « Journeyman Librarian », précédé d'une espace. Avec cette règle, « À On » se range dans les A, « “Endless” » dans les E et « …There You Are » dans les T.
  - Rarity trie sur la rareté PSN. Les trophées sans rareté connue passent en dernier, dans les deux sens **[choix de Claude]**. Il n'y en a aucun aujourd'hui.
  - À égalité de nom ou de rareté, le plus récent passe devant, **dans les deux sens** **[choix de Claude]**, comme sur le Plat Wall. La maquette inverse aussi l'égalité avec le sens : c'est la spec qui fait foi.
- **Sens [décidé]** : un bouton, à côté du tri, inverse l'ordre.
  - **[choix de Claude, validé sur la maquette]** Son libellé dit ce qu'il fait, avec une icône de flèches : « Newest first » / « Oldest first », « A to Z » / « Z to A », « Rarest first » / « Most common first ».
  - **[choix de Claude]** Changer de tri remet le sens naturel de ce tri : Newest first, A to Z, Rarest first.
- **Platform [décidé]** : All platforms (par défaut), PS4, PS5. Même règle que Games : un trophée est retenu si la plateforme fait partie de la liste de son jeu.
- **Rarity [décidé]** : All rarities (par défaut), Ultra rare, Very rare, Rare, Uncommon, Common, avec les paliers de 8.8. Un trophée sans rareté n'apparaît que sous All rarities.
- **Type [décidé]** : All types (par défaut), Platinum, Gold, Silver, Bronze.
- **[choix de Claude]** Un seul choix à la fois par filtre, comme sur Games.
- Un contrôle qui n'est pas sur sa valeur par défaut prend le contour d'accent (8.7). Pour le bouton de sens, la valeur par défaut est le sens naturel du tri choisi **[choix de Claude]** : « A to Z » n'est pas souligné, « Z to A » l'est.
- **Reset [décidé]** : un bouton remet d'un coup le tri, le sens et les filtres par défaut. **[choix de Claude]** Il n'apparaît que si au moins un réglage a changé, avec le nombre de contrôles soulignés : Alphabetical seul donne « Reset (1) », Alphabetical en « Z to A » avec PS5 donne « Reset (3) ». La maquette compte 2 pour Alphabetical seul : c'est la spec qui fait foi.
- **[choix de Claude]** Comme sur Games et le Plat Wall, les réglages vivent dans l'adresse de la page, sans être enregistrés en base. Une valeur par défaut n'y figure pas, et une valeur invalide est ignorée. « Précédent » ramène au même affichage, une nouvelle visite repart des valeurs par défaut.

### 16.7 Ailleurs sur le site (même branche)
- **[décidé] Aucun fond derrière une icône de trophée, nulle part.** Une icône à fond transparent s'affiche telle quelle, comme sur le Plat Wall (15.4).
  - Un fond semi-transparent (`var(--surface-2)`) est aujourd'hui posé derrière les icônes de la page d'un jeu (8.9), du carrousel (8.6), des panneaux Trophy cabinet, Rarest trophies et Milestones (8.8), et de la liste de l'éditeur du cabinet. Il est retiré partout.
  - **[choix de Claude]** Le liseré vert (ou rouge, 14.7) autour de l'icône sur la page d'un jeu reste : il marque un trophée obtenu (ou perdu), ce n'est pas un fond.
  - Seul le fond posé sur l'image de l'icône disparaît. Les fonds des conteneurs restent **[choix de Claude]** : la carte vitrée du trophée détaillé dans le carrousel, et le fond vert (ou rouge) des lignes sur la page d'un jeu.
  - Les images de jeu sur leur tuile (8.9) ne sont pas concernées.
- **[décidé] L'heure d'obtention d'un trophée s'affiche avec les secondes** : « 01:21:07 ».
  - Sur la page d'un jeu : la ligne de trophée (8.9) [décidé] et la Timeline **[choix de Claude]**.
  - Dans le carrousel et l'infobulle des milestones **[choix de Claude]**, pour qu'un trophée ait la même heure partout.
  - Les autres heures du site (dernière synchro, historique des synchros) ne changent pas.
- **[décidé] Page d'un jeu, tri « Date earned »** : à la même seconde, le platine passe après les autres trophées, avec la règle de 16.4. Aujourd'hui, il passe devant.

### 16.8 Laissé au builder
- L'organisation du code, l'adresse de l'API de pagination et les noms des paramètres d'adresse.
- La requête. Le numéro est calculé sur tous les trophées obtenus, avant les filtres, et la page doit rester rapide sur les quelque 11 600 trophées.
- La façon de garder la page fluide après « Show all » (images chargées à la demande, etc.). **Mesuré le 10 novembre 2026** sur le build de production, avec les vraies données : 3,1 s pour les 11 636 lignes (1 s pour l'API, 2,1 s de rendu). Objectif fixé à la vérification **[choix de Claude]** : moins de 2 s. Après la tâche 8, l'API répond en 0,4 s, mais le rendu en un seul bloc prenait encore 3,1 s, page figée. N'afficher que les lignes visibles aurait cassé la recherche Ctrl+F dans la page. L'utilisateur a donc choisi l'affichage progressif (16.5). **Nouveaux objectifs [choix de Claude]**, sur le build de production :
  - les premières nouvelles lignes apparaissent moins de 1 s après le clic ;
  - la page ne se fige jamais plus de 250 ms d'affilée ;
  - la liste est complète en moins de 5 s.
- La façon de remettre la liste au retour d'une page de jeu (16.5), qui doit marcher **même après « Show all »**. Garder les quelque 11 600 lignes comme le fait Games dépasserait probablement la place disponible dans le navigateur. On peut par exemple garder seulement le nombre de lignes chargées et la position, puis recharger ces lignes.
- Le tri « Date earned » de la page d'un jeu (`src/games/trophy-view.ts`) doit utiliser la même règle que 16.4, qui sera partagée.
- Le partage des styles avec la page d'un jeu, sans rien changer ailleurs : `app/globals.css` est un seul fichier global.

### 16.9 Vérification avec les vraies données
- « 11,636 trophies ». Première ligne : « The Heart's Journey », n° 11 636, 9 Nov 2026, 15:46:30.
- Magicka 2 : le platine n° 11 622 au-dessus de « Archmage » n° 11 621. Hellblade: Senua's Sacrifice : le platine « Done » n° 11 620 au-dessus de « The Final Battle » n° 11 619, à 21:30:30.
- Chaque milestone « Nth trophy » tombe sur la ligne du Trophy Log qui porte ce numéro.
- Filtres : Platinum 230, Gold 990, Silver 2 434, Bronze 7 982, PS4 7 075, PS5 4 561. Reset remet tout.
- Les tris dans les deux sens, « précédent » depuis une page de jeu, et « Show all » sur les 11 636 lignes sans que la page se fige.
- Aucun fond derrière les icônes à fond transparent (Hellblade, « Technician » de Persona 5 Royal) : Trophy Log, page d'un jeu, carrousel, Trophy cabinet, Rarest trophies, Milestones, éditeur du cabinet.
- Page d'un jeu : Magicka 2 triée par Date earned met le platine en dernier ; les heures ont les secondes, Timeline comprise.
- L'affichage téléphone.

## 17. Page Trophy Advisor
**[décidé, brainstorming des 10 et 11 novembre 2026]** Page construite à part, sur la branche `feat/trophy-advisor`. Maquette validée le 11 novembre 2026 (v4) : `docs/superpowers/specs/2026-11-10-psn-tracker-maquette-advisor.html`, référence pour l'aspect et le CSS, avec ses données intégrées. Les choix que l'utilisateur n'a pas faits lui-même sont marqués **[choix de Claude]**. Il les a lus dans la conversation et a validé la maquette qui les applique.

### 17.1 Intention
L'utilisateur veut **voir tout ce qu'il lui reste à obtenir, pour choisir quoi aller chercher**. Le Trophy Advisor de psnprofiles lui convient tel qu'il est. Sa capture montre une ligne par trophée non obtenu, du plus courant au plus rare : image du jeu, icône, nom, description, rareté et type. La page reprend cette forme, avec la rareté PSN et les règles d'images du site, et ajoute une colonne qui classe les jeux par nombre de trophées manquants.

### 17.2 Objectifs, non-objectifs, anti-objectifs
**Objectifs**
- Tous les trophées non obtenus, une ligne chacun, du plus courant au plus rare par défaut.
- Trier par rareté et par ordre alphabétique, dans un sens ou dans l'autre.
- Filtrer par plateforme, par catégorie de rareté et par type.
- Masquer les trophées non obtenables, masquer ceux des DLC ou ne garder qu'eux, avec trois réglages qui restent d'une visite à l'autre.
- Voir d'un coup d'œil les jeux qui ne sont pas à 100 %, du plus de trophées manquants au moins.

**Non-objectifs**
- Les colonnes « Achievers » et « Owners » de psnprofiles : le PSN ne fournit que le pourcentage.
- Une recherche, un filtre par jeu **[choix de Claude : non demandés]**.
- Un score, une difficulté ou une estimation de temps : la rareté suffit à l'utilisateur **[choix de Claude : non demandés]**.
- Toute modification des stats du profil par les trois réglages : ils ne changent que cette page **[choix de Claude]**, comme le filtre de 14.2.

**Anti-objectifs** (ce qui serait un échec même si tout fonctionne)
- Un compteur de la colonne qui ne correspond pas à ce que la liste contient quand on la filtre sur ce jeu avec les mêmes réglages.
- Un réglage qui revient à sa position d'origine à la visite suivante.
- Un fond, une ombre ou un cadre derrière une icône de trophée à fond transparent (16.7).
- Une image rectangulaire (8.9).
- Un « Show all » placé avant le nombre (13).
- Un compteur de trophée à paliers qui déborde sur la rareté (« 38,200/38,280 », 17.4).

### 17.3 Ce qu'on a vérifié sur les vraies données (10 novembre 2026)
- 798 trophées non obtenus, tous avec une rareté PSN (de 0,10 % à 85,70 %), sur 41 jeux. Aucun jeu masqué, aucun jeu à 0 %.
- Les 41 jeux qui ne sont pas à 100 % sont exactement ceux qui ont au moins un trophée non obtenu.
- Par type : 28 platines, 76 or, 193 argent, 501 bronze.
- 353 appartiennent à un DLC, 17 sont non obtenables.
- Avec les réglages :

| Réglages actifs | Trophées | Jeux dans la colonne |
|---|---|---|
| Aucun | 798 | 41 |
| Hide unobtainable | 781 | 40 |
| Hide DLC | 445 | 30 |
| Hide unobtainable + Hide DLC | 430 | 29 |
| DLC only | 353 | 17 |
| Hide unobtainable + DLC only | 351 | 16 |

- 181 trophées sont cachés sur le PSN, avec leur vrai nom et leur vraie description en base. 83 ont un compteur de progression.
- Un jeu sur deux plateformes a deux listes distinctes (Gran Turismo 7, Stranger of Paradise, Assassin's Creed Valhalla) : il apparaît deux fois, comme dans Games.

### 17.4 La page `/trophy-advisor`
Elle remplace la page « Coming soon » de cet onglet.
- **Haut de page [choix de Claude]** : comme le Trophy Log (16.5), la bannière, le bandeau profil avec « Sync now » et les 6 cases. Pas de carrousel.
- **Deux colonnes** comme Games (8.7, 8.8) : la liste, et à droite une colonne de 450 px (17.7) **[décidé : une colonne à droite ; largeur : choix de Claude]**.
- **Panneau de la liste** :
  - en-tête, à gauche : « Zmx969's Trophy Advisor », avec le pseudo du profil, puis juste à côté les trois réglages (17.6), comme « Hide 0% games » sur Games **[choix de Claude]** ;
  - en-tête, à droite : le nombre, puis le bouton « Show all » **[décidé : après le nombre, 13]** tant que tout n'est pas chargé ;
  - le nombre : « 798 trophies » sans filtre, « 336 of 798 trophies match » dès qu'un filtre de plateforme, de rareté ou de type est actif. Le total tient compte de « Hide 0% games » et des trois réglages : avec « Hide DLC », c'est « 445 trophies » **[choix de Claude]** ;
  - en dessous, les contrôles (17.5), puis la liste.
- **Ligne de trophée [décidé : comme le Trophy Log]**, ~66 px, de gauche à droite :
  1. **l'image du jeu**, 56 px, coins de 10 px, la même que sa ligne dans Games, lien vers la page du jeu ;
  2. **l'icône du trophée**, 56 px, coins de 10 px, **sans aucun fond**, en couleur comme sur la capture de psnprofiles ;
  3. le **nom**, la **description** en entier, puis une ligne avec le **nom du jeu**, lien vers sa page, le nom du DLC pour un trophée de DLC et les pastilles de plateforme ;
  4. le **compteur** d'un trophée à paliers (« 0/4 », « 3,626/5,000 »), au même format que la page d'un jeu (8.9), vide pour les autres **[choix de Claude]**. **[décidé, retour sur la maquette v3]** La colonne fait 120 px, pour que les plus longs (« 38,200/38,280 », 116 px en 15 px) ne débordent pas sur la rareté. Un compteur encore plus long passe à la ligne au lieu de déborder ;
  5. la **rareté PSN** (« 85.70% ») et sa catégorie (« Common ») ;
  6. l'**icône officielle du type**, 30 px.
- Pas de numéro ni de date, puisque le trophée n'est pas obtenu.
- La ligne elle-même n'est pas un lien : seuls l'image et le nom du jeu le sont, comme au Trophy Log.
- **Trophée caché sur le PSN [choix de Claude]** : affiché en entier, nom et description, comme sur la page d'un jeu.
- **Trophée non obtenable** (quand « Hide unobtainable » est inactif) **[choix de Claude]** : la ligne a la teinte rouge de la page d'un jeu (14.7) et le même « ! », avec l'infobulle « No longer obtainable. » suivie de la cause quand elle est connue. Pas de liseré autour de l'icône, comme sur la maquette.
- Sans résultat : « No trophies match these filters. » S'il n'y a plus aucun trophée à obtenir avant filtres : « Nothing left to earn. » **[choix de Claude]**
- **Chargement** : exactement comme le Trophy Log (16.5). 50 lignes, puis 50 de plus quand on approche du bas, avec « The next 50 trophies load as you scroll down » et « Retry » en cas d'échec. « Show all » charge tout le reste, affiché par paquets.
- **Retour [choix de Claude]** : revenir d'une page de jeu par « précédent » remet les lignes chargées et la position, comme au Trophy Log, que le lien cliqué soit dans la liste ou dans la colonne.
- **Synchro [choix de Claude]** : la liste et la colonne se mettent à jour après une synchro sans recharger la page.
- **Écrans étroits [choix de Claude]** :
  - sous 1400 px, la colonne passe à 360 px ;
  - sous 1180 px, une seule colonne : la colonne des jeux passe **au-dessus** de la liste, limitée à 300 px de haut avec son propre défilement. En dessous de la liste, le défilement infini l'éloignerait sans cesse ;
  - sous 900 px, l'image du jeu est masquée (le nom du jeu reste un lien), et l'icône passe à 48 px ;
  - sur téléphone (640 px et moins), le compteur et la rareté passent sous la description.

### 17.5 Tri et filtres
- **Tri [décidé]** : Rarity (par défaut), Alphabetical.
  - Rarity trie sur la rareté PSN. Les trophées sans rareté connue passent en dernier, dans les deux sens **[choix de Claude]**. Il n'y en a aucun aujourd'hui.
  - Alphabetical trie sur le nom du trophée, avec la règle de 16.6 : sans la casse, les accents, la ponctuation et les espaces en tête **[choix de Claude]**.
  - À égalité, **dans les deux sens** : le nom du jeu (même règle), puis l'identifiant de la liste, puis l'ordre du trophée dans son jeu **[choix de Claude]**. Les trophées d'un même jeu restent ainsi groupés, et l'ordre est total, pour que les pages ne se chevauchent pas.
- **Sens [décidé]** : un bouton, à côté du tri, inverse l'ordre.
  - Son libellé dit ce qu'il fait, comme au Trophy Log : « Most common first » / « Rarest first », « A to Z » / « Z to A ».
  - **Par défaut : « Most common first »** [choix de Claude, d'après la capture de psnprofiles, où « Descending » va du plus courant au plus rare, validé sur la maquette]. Pour Alphabetical : « A to Z ». Changer de tri remet ce sens naturel.
- **Platform [décidé]** : All platforms (par défaut), PS4, PS5. Même règle que Games : un trophée est retenu si la plateforme fait partie de la liste de son jeu.
- **Rarity [décidé]** : All rarities (par défaut), Ultra rare, Very rare, Rare, Uncommon, Common, avec les paliers de 8.8.
- **Type [décidé]** : All types (par défaut), Platinum, Gold, Silver, Bronze.
- **[choix de Claude]** Comme au Trophy Log : un seul choix à la fois par filtre, contour d'accent sur un contrôle qui n'est pas sur sa valeur par défaut, réglages dans l'adresse de la page sans enregistrement en base, valeur par défaut absente de l'adresse, valeur invalide ignorée.
- **Reset [choix de Claude, comme au Trophy Log]** : remet le tri, le sens et les filtres par défaut. Il n'apparaît que si au moins un de ces contrôles a changé, avec leur nombre. **Il ne touche pas aux trois réglages de 17.6.**

### 17.6 Les réglages « Hide unobtainable », « Hide DLC » et « DLC only »
- **[décidé]** Trois interrupteurs, du même style que « Hide 0% games », **enregistrés en base**, pour rester sur la position choisie d'une visite à l'autre **[pour « DLC only » : choix de Claude, comme les deux autres]**. Ils ne vont pas dans l'adresse de la page **[choix de Claude]**.
- **[choix de Claude]** Les trois sont inactifs au départ : la première visite montre tous les trophées non obtenus.
- **Hide unobtainable** retire les trophées marqués `trophies.unobtainable` (14.2).
- **Hide DLC** retire les trophées d'un groupe autre que `default`.
- **DLC only** [décidé, 10 novembre 2026] ne garde que les trophées d'un groupe autre que `default`.
- **[choix de Claude, validé sur la maquette]** « Hide DLC » et « DLC only » s'excluent, puisque les deux ensemble ne montreraient rien : activer l'un coupe l'autre, et le changement est enregistré.
- **[décidé]** Chacun agit sur **la liste, son nombre et la colonne de droite** (17.7).
- Effet immédiat, comme « Hide 0% games ». La liste repart du haut.
- **[décidé, 8.7] « Hide 0% games »**, réglé sur la page Games, retire aussi de la liste et de la colonne les trophées des jeux à 0 %. Il n'a pas d'interrupteur sur cette page **[choix de Claude]**.
- Comme partout, les jeux masqués sur le PSN sont exclus.

### 17.7 La colonne « Incomplete games »
- **[décidé]** Un panneau à droite liste **tous les jeux qui ne sont pas à 100 %**, du plus de trophées manquants au moins, **DLC inclus**.
- **[décidé]** Le compteur de chaque jeu tient compte de **« Hide unobtainable »**, de **« Hide DLC »** et de **« DLC only »**. Un jeu dont le compteur tombe à 0 sort de la colonne **[choix de Claude, validé sur la maquette]** : Marvel Heroes Omega avec « Hide unobtainable » (ses 13 trophées manquants sont non obtenables), Nioh 3 ou SAROS avec « Hide DLC », Rayman Legends avec « DLC only ». Gran Turismo Sport passe de 6 à 2 avec « Hide unobtainable », FINAL FANTASY XIV de 171 à 10 avec « Hide DLC » et à 161 avec « DLC only ».
- **[choix de Claude, validé sur la maquette]** Elle ne dépend **ni du tri ni des filtres** de plateforme, de rareté et de type.
- En-tête : « Incomplete games » à gauche, « 41 games » à droite.
- **Ligne [choix de Claude, validé sur la maquette]**, de gauche à droite :
  1. **l'image du jeu**, 48 px, coins de 9 px, la même que dans Games ;
  2. le **nom**, jamais tronqué (8.8), les pastilles de plateforme, et le même « ! » s'il reste des trophées non obtenables comptés, avec l'infobulle « 13 unobtainable trophies » et la cause. **[choix de Claude, relecture finale]** L'infobulle s'ouvre sous la ligne, dans la largeur de la colonne, pour ne jamais sortir de l'écran ;
  3. en dessous, la **barre de progression** à la couleur du rang (8.7) et le **pourcentage PSN**. Ils ne changent pas avec les réglages : c'est la progression du jeu au PSN ;
  4. à droite, le **nombre de trophées manquants** en gras, avec « left » en dessous.
- Toute la ligne est un lien vers la page du jeu **[choix de Claude]**.
- À égalité de compteur : le nom du jeu (règle de 16.6), puis l'identifiant de la liste **[choix de Claude]**.
- Tous les jeux s'affichent, sans pagination : ils sont une quarantaine.
- Sans jeu : « No incomplete games. » **[choix de Claude]**

### 17.8 Ailleurs sur le site (même branche)
- **[décidé, 13 et 14.6] Page Games** : dans l'en-tête de la liste, le bouton « Show all » passe **après** le nombre de jeux. Rien d'autre ne change sur cette page.

### 17.9 Laissé au builder
- L'organisation du code, l'adresse de l'API de pagination, les noms des paramètres d'adresse et des colonnes de `settings`.
- Le partage avec le Trophy Log (`components/trophy-log/TrophyLogList.tsx`, `log-snapshot.ts`, `src/trophy-log/query.ts`, `load.ts`) : réutiliser plutôt que recopier ce qui est identique, sans changer le comportement du Trophy Log.
- Le partage des styles, sans rien changer ailleurs : `app/globals.css` est un seul fichier global.
- La migration des trois réglages. Elle s'applique au démarrage du worker, comme les précédentes.

### 17.10 Vérification avec les vraies données
- « 798 trophies » et « 41 games ». Première ligne : « The Axe's Grudge », Phantom Blade Zero, 85.70 %. Première ligne de la colonne : FINAL FANTASY XIV Online, 171.
- Les nombres du tableau de 17.3 avec les réglages, et les exemples de 17.7 (si une synchro a changé des trophées depuis, les recalculer en SQL).
- Les réglages restent après un rechargement et après une déconnexion. Activer « DLC only » coupe « Hide DLC », et inversement.
- « The Dark Throne » (FFXIV, 38,200/38,280) : le compteur ne touche pas la rareté.
- Filtres : Platinum 28, Gold 76, Silver 193, Bronze 501, PS4 336. Reset remet les contrôles et laisse les réglages.
- Les deux tris dans les deux sens, « précédent » depuis la liste et depuis la colonne, « Show all » sans que la page se fige.
- Le compteur d'un jeu dans la colonne correspond aux lignes de ce jeu dans la liste « Show all », avec les mêmes réglages.
- Un trophée non obtenable : teinte rouge, « ! » et cause (Marvel Heroes Omega, Gran Turismo Sport).
- Aucun fond derrière les icônes à fond transparent, aucune image rectangulaire.
- Page Games : « Show all » après le nombre.
- L'affichage téléphone.

## 18. Page Stats
**[décidé, brainstorming du 11 novembre 2026]** Page construite à part, sur la branche `feat/stats`. Maquette validée le 11 novembre 2026 (v4) : `docs/superpowers/specs/2026-11-11-psn-tracker-maquette-stats.html`, référence pour l'aspect et le CSS, avec ses données intégrées. Les choix que l'utilisateur n'a pas faits lui-même sont marqués **[choix de Claude]**. Il a validé la maquette qui les applique.

### 18.1 Intention
L'utilisateur veut **voir l'histoire de sa chasse aux trophées sur une seule page** : ce qu'il a fait ces derniers mois, comment se répartit son profil, comment il a progressé depuis 2016, et quels trophées l'ont fait passer chaque palier de niveau. Ses captures de psnprofiles servent de modèle : les camemberts, « Monthly Activity », « Trophy Progression », « Trophies by Time », « Trophies by Day » et le « Level History ». La page les reprend dans le style du site, avec la rareté PSN, et y ajoute le calendrier retiré de Games (section 3).

### 18.2 Objectifs, non-objectifs, anti-objectifs
**Objectifs**
- Voir l'activité récente jour par jour, avec le meilleur jour et la plus longue série de jours.
- Voir la répartition de la rareté, de la complétion, des points PSN et des plateformes.
- Voir l'activité par mois et la progression par type de trophée depuis la création du profil.
- Voir à quelles heures et quels jours les trophées tombent.
- Voir ses jeux par année de sortie, par éditeur et par genre.
- Voir la courbe de son niveau et le trophée qui a fait passer chaque palier de 10 niveaux.

**Non-objectifs**
- **[décidé]** Le zoom à la souris des courbes de psnprofiles.
- **[décidé]** Une répartition par développeur : le PSN ne fournit que l'éditeur. L'utilisateur a validé la maquette avec les éditeurs à la place, sans source externe.
- **[décidé]** Une catégorie « Multiplatform » (18.6).
- Les colonnes « Achievers » et « Owners » de psnprofiles : le PSN ne fournit que le pourcentage.
- Des filtres ou des réglages sur cette page **[choix de Claude : non demandés]**.

**Anti-objectifs** (ce qui serait un échec même si tout fonctionne)
- Un palier de niveau attribué à un autre trophée que celui qui a réellement fait franchir le seuil de points.
- Un jour, un mois, une heure comptés en UTC au lieu de l'heure de Paris : les chiffres ne correspondraient plus aux dates affichées ailleurs sur le site.
- Un fond, une ombre ou un cadre derrière une icône de trophée à fond transparent (16.7).
- Une image rectangulaire (8.9).
- Une infobulle coupée par un panneau ou par le bord de l'écran.
- Un défilement horizontal de la page, sur téléphone comme sur PC.

### 18.3 Ce qu'on a vérifié sur les vraies données (11 novembre 2026)
Sur une base synchronisée le 9 novembre 2026 :
- 11 636 trophées obtenus, tous datés et avec une rareté PSN, sur 266 listes. Premier trophée le 10 novembre 2016.
- 350 850 points, soit le niveau 536 à 61 %, exactement ce que donne le PSN (`profile.level` et `profile.level_progress`). La table de 18.10 est donc la bonne.
- Les paliers tombent sur les mêmes trophées que psnprofiles, à la seconde près, une fois l'heure convertie à Paris :

| Niveau | Trophée | Date à Paris |
|---|---|---|
| 530 | Do No Evil | 24 Sep 2026, 17:49:53 |
| 520 | Agile Gladiator | 24 Jul 2026, 20:13:07 |
| 510 | « This is too much power for one person. » | 23 May 2026, 15:38:01 |
| 500 | Numismatist | 22 Jan 2024, 19:26:26 |
| 490 | Getting to Know You | 2 Sep 2022, 21:49:12 |

- 53 paliers, du niveau 10 au niveau 530.
- Complétion : 241 jeux de 80 à 100 %, 10 de 60 à 79, 8 de 40 à 59, 2 de 20 à 39, 5 de 0 à 19, comme sur psnprofiles. Moyenne par jeu : 94,17 %.
- Rareté PSN : 1 742 Ultra rare, 1 445 Very rare, 2 339 Rare, 4 321 Uncommon, 1 789 Common. Moyenne : 26,55 %.
- Points : 69 000 platine, 89 100 or, 73 020 argent, 119 730 bronze.
- Plateformes (18.6) : 98 PS5, 168 PS4.
- Sur les 12 derniers mois : 1 773 trophées, 45 platines, meilleur jour 35 trophées le 31 août 2026, plus longue série 61 jours et 515 trophées, du 13 juillet au 11 septembre 2026.
- Après l'emprunt à une autre version du même jeu (8.9) : 25 jeux sans date de sortie, 6 sans éditeur, 6 sans genre. 63 éditeurs différents. 16 genres, un jeu en ayant jusqu'à 3.

### 18.4 La page `/stats`
Elle remplace la page « Coming soon » de cet onglet.
- **Haut de page [choix de Claude]** : comme le Trophy Log (16.5), la bannière, le bandeau profil avec « Sync now » et les 6 cases. Pas de carrousel.
- **[décidé]** Sous ce haut de page, sur toute la largeur et dans cet ordre :
  1. le calendrier (18.5) ;
  2. les 4 camemberts (18.6), sur une ligne ;
  3. « Monthly activity », puis « Trophy progression » (18.7), chacun sur toute la largeur ;
  4. « Trophies by time » aux deux tiers et « Trophies by day » au tiers restant (18.8) ;
  5. « Games by release year », « Games by publisher » et « Games by genre » (18.9), trois colonnes égales ;
  6. « Level history » (18.10), tout en bas.
- Chaque bloc est un panneau `.glass` avec son titre en haut à gauche.
- **[choix de Claude]** La page se met à jour après une synchro sans recharger, comme les autres.
- **[choix de Claude]** Sans aucun trophée obtenu : un seul panneau « No trophies yet. » sous le haut de page.
- **Jeux pris en compte** : ceux de Games, jeux masqués sur le PSN exclus. Un jeu sur deux plateformes a deux listes distinctes et compte deux fois, comme dans Games. **[choix de Claude]** Les graphiques de jeux (complétion, plateformes, année, éditeur, genre) respectent « Hide 0% games », comme les 6 cases. Les graphiques de trophées n'en dépendent pas : un jeu à 0 % n'a aucun trophée obtenu.
- **Heure** : tout ce qui dépend d'un jour, d'un mois, d'une heure ou d'un jour de la semaine est calculé à l'heure de Paris, comme les dates du site (`src/lib/format.ts`).
- **Écrans étroits [choix de Claude]** :
  - sous 1280 px, les camemberts passent sur 2 colonnes ;
  - sous 1100 px, les trois graphiques de jeux s'empilent ;
  - sous 900 px, « Trophies by time » et « Trophies by day » s'empilent, et les lignes du Level history perdent l'image du jeu et la rareté ;
  - sur téléphone (640 px et moins), les camemberts sont sur une colonne, le résumé du calendrier passe sur 2 colonnes et les lignes du Level history passent sur deux rangées, avec la rareté de retour.

### 18.5 Le calendrier « Last 12 months »
Il remplace le « Last 60 days » de la section 3. **[décidé]** Il prend toute la largeur de la page, et couvre donc plus de 60 jours.
- **[choix de Claude, validé sur la maquette]** **53 semaines**, titrées « Last 12 months » : la dernière colonne est la semaine en cours, les jours à venir n'ont pas de case.
- **[décidé, section 3]** Une colonne par semaine, une ligne par jour du lundi au dimanche, le nom de chaque jour affiché (Mon … Sun), des cases carrées plus intenses selon le nombre de trophées du jour, le nombre exact en infobulle.
- **[choix de Claude]** Le nom du mois au-dessus de la première semaine dont le lundi tombe dans ce mois, sauf dans les deux dernières colonnes où il déborderait.
- **[choix de Claude]** Cinq intensités de la couleur d'accent : 0, 1 à 2, 3 à 6, 7 à 12, 13 et plus. Une légende « Less … More » en haut à droite.
- Infobulle : la date (« Mon 31 Aug 2026 »), le nombre de trophées et, s'il y en a, de platines.
- Sous 860 px, le calendrier défile horizontalement dans son panneau et s'ouvre sur les jours les plus récents. **[décidé, 11 novembre 2026]** Sans barre de défilement, comme le graphique des années (18.14).
- **[décidé]** Résumé en dessous, **quatre valeurs équidistantes**, la première calée à gauche et la dernière à droite, chaque libellé centré sous sa valeur :
  1. le nombre de **trophées** (« Trophies ») ;
  2. le nombre de **platines** (« Platinums ») ;
  3. le **meilleur jour** (« Best day ») : son nombre, sa date à côté. **[choix de Claude]** À égalité, le plus récent ;
  4. **[décidé]** la **plus longue série** de jours consécutifs avec au moins un trophée : « 61 days » et, à côté, « 515 trophies », le nombre de trophées obtenus pendant cette série. Libellé : « Longest streak, 13 Jul 2026 to 11 Sep 2026 ». **[choix de Claude, validé sur la maquette]** Comme les trois autres, elle ne regarde que les jours affichés. À égalité, la plus récente.

### 18.6 Les 4 camemberts
**[décidé]** Des anneaux comme sur la capture de psnprofiles, avec à gauche l'anneau et sa valeur au centre, à droite la légende : pastille de couleur, nom, nombre exact. Au survol d'une part : son nom, son nombre et sa part en pourcentage.
- **Rarity** : les trophées obtenus par catégorie de rareté PSN (8.8), d'Ultra rare à Common. Au centre, la rareté moyenne, le même chiffre que la case « Average rarity », avec « Average ». Les trophées sans rareté connue ne comptent pas.
- **Completion** : les jeux par progression au PSN, en 5 tranches : 80 % – 100 %, 60 % – 79 %, 40 % – 59 %, 20 % – 39 %, 0 % – 19 %. Au centre, la moyenne des progressions des jeux, avec « Average ». **[choix de Claude]** Ce chiffre est la moyenne par jeu, comme sur psnprofiles, et diffère de la case « Completion rate », qui rapporte tous les trophées obtenus à tous les trophées existants.
- **PSN points** : les points par type, à 300, 90, 30 et 15 points. Au centre, le total, avec « Points ».
- **Platforms** : **[décidé]** seulement les plateformes sur lesquelles l'utilisateur joue. Une liste qui inclut PS5 compte en **PS5**, y compris une liste PS5 et PC, toutes les autres comptent en **PS4**, y compris les listes partagées avec la PS3 ou la PS Vita. Au centre, le nombre de jeux, avec « Games ».

### 18.7 « Monthly activity » et « Trophy progression »
Sur l'axe horizontal, **chaque mois** depuis celui du premier trophée jusqu'au mois en cours, y compris les mois sans trophée, avec une étiquette tous les 6 mois, tous les 12 quand le graphique fait moins de 700 px de large et tous les 24 quand il fait moins de 420 px, au format « Nov 16 ».
- **Monthly activity** [décidé] : une courbe du nombre de trophées obtenus chaque mois, dans la couleur d'accent, avec un voile léger dessous. La valeur du mois record est écrite au-dessus de son point.
- **Trophy progression** [décidé] : les trophées cumulés par type, en aires empilées, platine en bas et bronze en haut, comme sur la capture. Légende en haut à droite avec le total de chaque type.
- Au survol, une ligne verticale suit la souris et s'accroche au mois le plus proche. L'infobulle donne le mois et sa valeur, ou le total et chaque type pour la progression.

### 18.8 « Trophies by time » et « Trophies by day »
**[décidé]** Deux graphiques en colonnes, le total de tous les trophées :
- par heure, de 00 à 23, avec « Paris time » en haut à droite ;
- par jour de la semaine, de Mon à Sun.
La valeur de la colonne record est écrite au-dessus d'elle. Au survol d'une colonne : l'heure ou le jour, et son nombre.

### 18.9 « Games by release year », « Games by publisher », « Games by genre »
Date de sortie, éditeur et genres sont lus avec `withSiblings` : une info manquante est prise chez une autre version du même jeu (8.9).
- **Games by release year** [décidé] : une colonne par année, de la plus ancienne à la plus récente. Une année sans jeu entre les deux garde sa colonne, à 0. Étiquettes « '14 », « '15 ». Sous le graphique : « 25 games have no release date on PSN. » **[décidé, 11 novembre 2026]** Quand les années ne tiennent plus dans le panneau, il défile de côté (18.14).
- **Games by publisher** : des barres horizontales triées du plus grand nombre au plus petit, avec le nombre au bout de la barre. Les **15 premiers**, puis une ligne grise « Other (48) » avec le nombre d'éditeurs regroupés. Sous le graphique : « 6 games have no publisher on PSN. »
  - **[choix de Claude, validé sur la maquette]** Les noms bruts du PSN sont raccourcis par une liste écrite dans le code, et deux noms bruts qui donnent le même nom affiché sont additionnés. Un nom absent de la liste s'affiche tel quel :

  | Nom au PSN | Nom affiché |
  |---|---|
  | Square Enix LTD | Square Enix |
  | BANDAI NAMCO ENTERTAINMENT EUROPE | Bandai Namco |
  | Activision Blizzard Int'l BV | Activision Blizzard |
  | SEGA EUROPE LTD | SEGA |
  | EA Swiss Sarl | Electronic Arts |
  | Koei Tecmo Europe Ltd | Koei Tecmo |
  | TMG STUDIOS B.V. | TMG Studios |
  | CE EUROPE LIMITED | Capcom |
  | Team 17 Digital LTD | Team17 |
  | CD PROJEKT RED S.A. | CD Projekt Red |
  | 505 GAMES S.R.L. | 505 Games |
  | Larian Studios Games Ltd | Larian Studios |

- **Games by genre** : mêmes barres, tous les genres. Un jeu compte dans chacun de ses genres. Sous le graphique : « A game can have several genres. 6 have none on PSN. »
- À égalité, l'ordre alphabétique **[choix de Claude]**.
- Une phrase de bas de graphique disparaît quand son nombre est 0 **[choix de Claude]**.

### 18.10 « Level history »
**[décidé]** Tout en bas de la page, un seul panneau, avec la courbe du niveau et, en dessous, les trophées qui ont fait passer chaque palier.
- **Calcul** : les trophées obtenus sont pris dans l'ordre du numéro d'obtention (16.4, `src/lib/earned-order.ts`), leurs points s'additionnent, et le trophée qui atteint ou dépasse le seuil d'un niveau multiple de 10 est celui du palier. Le niveau 1 vaut 0 point. Le passage de chaque niveau coûte :

| Niveaux | Points par niveau |
|---|---|
| 1 à 99 | 60 |
| 100 à 199 | 90 |
| 200 à 299 | 450 |
| 300 à 399 | 900 |
| 400 à 499 | 1 350 |
| 500 à 599 | 1 800 |
| 600 à 699 | 2 250 |
| 700 à 799 | 2 700 |
| 800 à 899 | 3 150 |
| 900 à 998 | 3 600 |

- Le niveau du bandeau profil reste celui du PSN : ce calcul ne sert qu'à cette section.
- **Courbe** [décidé] : un point tous les 10 niveaux, reliés par une ligne dorée, comme sur la capture. L'axe horizontal est le temps, avec une étiquette par année, une année sur deux quand le graphique fait moins de 420 px de large, l'axe vertical le niveau. « A point every 10 levels » en haut à droite. Au survol : la date, le niveau et le nom du trophée du point le plus proche.
- **Liste [décidé]**, sous la courbe, du palier le plus récent au plus ancien, tous affichés sans pagination. Ligne de ~66 px, de gauche à droite :
  1. **l'image du jeu**, 56 px, coins de 10 px, la même que sa ligne dans Games, lien vers la page du jeu ;
  2. **l'icône du trophée**, 56 px, coins de 10 px, **sans aucun fond** ;
  3. le **nom**, la **description** en entier, puis le **nom du jeu**, lien vers sa page ;
  4. l'**icône de niveau** du PSN (`components/levelSprite.ts`, palier `floor(niveau / 100) + 1`, 10 au maximum) et le **niveau** ;
  5. la **date**, et en dessous l'**heure** avec les secondes ;
  6. la **rareté PSN** (« 18.30% ») et sa catégorie (« Rare ») ;
  7. l'**icône officielle du type**, 30 px, avec son nom en dessous (« Gold »).
- La ligne elle-même n'est pas un lien : seuls l'image et le nom du jeu le sont, comme au Trophy Log.

### 18.11 Règles communes aux graphiques
- **[choix de Claude]** Dessinés en SVG par le site, sans bibliothèque de graphiques, comme sur la maquette. Ils s'adaptent à la largeur de leur panneau et réservent leur hauteur, pour que la page ne saute pas à l'affichage.
- **Infobulle** : une seule, du style de `.unob .tip`, qui suit la souris, ou le doigt sur un écran tactile (18.14), reste dans l'écran et n'est jamais coupée par un panneau. `.glass` piégeant les éléments `position:fixed`, elle passe par `createPortal`.
- **Couleurs [choix de Claude, validé sur la maquette]** :
  - graphiques à une seule série : `--accent`, sauf le niveau en `--gold` (#F2C462) ;
  - types de trophées : platine #6C8AD8, or #B48E26, argent #868FA3, bronze #C2703F. Ce sont des teintes plus sourdes que celles du bandeau, faites pour de grandes surfaces, et le platine y est bleu pour ne pas se confondre avec l'argent ;
  - rareté : #B3261E, #D6502A, #E8862A, #F2B233, #F7DC5A, d'Ultra rare à Common ;
  - complétion : #4CCB7A, #3FAE66, #339353, #2A7845, #216038, de la tranche la plus haute à la plus basse ;
  - plateformes : PS5 #4F8FE8, PS4 #2EAD7F ;
  - barre « Other » : `--muted`.
- Grilles en traits pleins très discrets, nombres d'axes en `--muted`.

### 18.12 Laissé au builder
- L'organisation du code, le découpage en composants et les noms de fichiers.
- Faire les calculs en SQL ou sur le serveur en TypeScript : le navigateur ne reçoit que les totaux et les 53 lignes de paliers, pas les 11 636 trophées.
- Le partage des styles, sans rien changer ailleurs : `app/globals.css` est un seul fichier global, les nouvelles classes sont préfixées.
- Le partage de la ligne du Level history avec celle du Trophy Log, si c'est possible sans changer ce dernier.

### 18.13 Vérification avec les vraies données
Si une synchro a changé des trophées depuis 18.3, recalculer les chiffres en SQL.
- Le calendrier : 53 semaines, la dernière colonne est la semaine en cours, et les 4 valeurs de 18.3. Les 4 valeurs sont équidistantes, leurs libellés centrés.
- Les 4 camemberts : les chiffres de 18.3. Le total de chaque anneau est juste : 11 636 trophées, 266 jeux, 350 850 points.
- « Monthly activity » : 121 mois, et la somme des mois vaut le nombre de trophées. « Trophy progression » finit sur les totaux par type.
- La somme des heures et la somme des jours valent le nombre de trophées.
- Année, éditeur et genre : les nombres, et les phrases sur les jeux sans information.
- Level history : 53 paliers, les 5 lignes du tableau de 18.3. L'image et le nom du jeu mènent à sa page.
- Les infobulles dans chaque graphique, y compris au bord droit de la page.
- Aucun fond derrière les icônes à fond transparent, aucune image rectangulaire.
- Temps de réponse de la page sur le build de production.
- L'affichage téléphone : pas de défilement horizontal de la page, et le calendrier s'ouvre sur les jours récents.

### 18.14 Infobulles au doigt et défilement de côté
**[décidé, 11 novembre 2026, après la fusion de la PR #15]** Construit sur la branche `feat/stats-touch`. Maquette validée le 11 novembre 2026 (v6) : `docs/superpowers/specs/2026-11-11-psn-tracker-maquette-stats-defilement.html`, référence pour le graphique des années qui défile. Les infobulles au doigt ont été validées sur description.

**Intention.** L'utilisateur regarde aussi la page sur son téléphone et sur son Mac. Au doigt, les infobulles ne s'affichent pas : elles suivent la souris. Et le graphique des années de sortie gagne une colonne chaque année : sans rien faire, ses colonnes deviendraient de plus en plus fines.

**Infobulles au doigt [décidé]**
- Poser le doigt sur une colonne, une part d'anneau ou un jour du calendrier affiche son infobulle. Elle reste **tant que le doigt est posé** et disparaît dès qu'il se lève.
- Sur les courbes (« Monthly activity », « Trophy progression », Level history), le doigt posé place la ligne verticale sur le point le plus proche. Tant qu'il reste posé, la ligne le suit quand il glisse de côté.
- Un glissement vers le haut ou le bas fait toujours défiler la page, et l'infobulle disparaît.
- **[choix de Claude]** Quand le doigt glisse d'une colonne à l'autre (« Trophies by time », « Trophies by day »), l'infobulle passe à la colonne sous le doigt.
- **[choix de Claude, validé]** Au doigt, l'infobulle se place au-dessus du doigt, centrée sur lui, assez haut pour qu'il ne la cache pas. Elle passe en dessous seulement s'il n'y a pas la place en haut de l'écran, et reste dans l'écran.
- **[choix de Claude, validé]** Un appui long sur un graphique n'ouvre pas de menu et ne sélectionne pas de texte.
- **[choix de Claude]** Les mises en valeur au survol (contour d'un jour du calendrier, part d'anneau élargie) ne valent que pour les appareils à souris : au doigt, elles resteraient affichées après le lever du doigt.
- À la souris, rien ne change.

**« Games by release year » [décidé]**
- Les colonnes ne descendent jamais sous **18 px** de large, soit 24 px avec l'espace entre deux colonnes. Tant que toutes les années tiennent, le graphique reste tel qu'en 18.9.
- Quand elles ne tiennent plus, il défile à gauche et à droite **dans son panneau**, **sans barre de défilement** :
  - à la souris, clic maintenu puis glisser, avec le curseur en forme de main ;
  - sur le pavé tactile du Mac, glissement à deux doigts ;
  - sur téléphone, glissement du doigt.
- Il s'ouvre sur les **années les plus récentes**, la dernière contre le bord droit. **[choix de Claude]** Il y revient quand la largeur change (téléphone tourné, fenêtre redimensionnée), sauf si on l'a fait défiler ailleurs.
- L'axe des nombres reste fixe à gauche, seules les colonnes défilent. L'échelle est celle de toutes les années, même hors de vue.
- **[choix de Claude, validé sur la maquette]** Un fondu sur le bord gauche ou droit signale qu'il reste des années de ce côté.
- **[choix de Claude]** Au bout du graphique, le glissement à deux doigts ne déclenche pas le retour à la page précédente du navigateur.
- **[choix de Claude]** Glisser à la souris cache l'infobulle ouverte. Un clic sans glisser ne fait pas défiler.
- Sur téléphone, les 13 années de 2026 ne tiennent déjà pas : le graphique y défile dès maintenant.

**Calendrier [choix de Claude, validé]** Sous 860 px, il défile de la même façon : sans barre, clic maintenu à la souris, fondu sur les bords, ouverture sur les jours les plus récents et retour à la fin quand la largeur change.

**Vérification**
- Dans le navigateur de l'app, avec les vraies données : sur PC, le graphique des années ne défile pas. En largeur téléphone, il défile, s'ouvre sur '26, se déplace au clic maintenu, sans barre et sans défilement horizontal de la page, avec le fondu du côté des années cachées. Le calendrier pareil.
- Les infobulles au doigt, simulées par des événements tactiles : affichées au doigt posé, cachées au doigt levé, au-dessus du doigt.
- **Non vérifiable ici** : un vrai écran tactile et le pavé tactile d'un Mac. L'utilisateur les essaie sur ses appareils.

## 19. Points de suivi de la phase 1
**[décidé, cadrage du 11 novembre 2026]** L'utilisateur a demandé de traiter tous les points mis de côté dans `docs/superpowers/plans/2026-11-08-phase1-suivis.md`, avant le déploiement sur le NAS : robustesse et sécurité, performance, interface, tuile carrée, et la section « Divers ». Construit sur la branche `fix/followups`, fusionné dans `main` le 12 novembre 2026 (PR #19). Maquette validée le 11 novembre 2026 (v2), pour les compteurs du bandeau : `docs/superpowers/specs/2026-11-11-psn-tracker-maquette-suivis.html`. Les choix que l'utilisateur n'a pas faits lui-même sont marqués **[choix de Claude]** ; il a validé chaque partie sur description.

### 19.1 Intention
Le site va passer sur le NAS. Ces points ne bloquaient rien, mais certains se verraient au premier déploiement (démarrage, en-têtes, images qui s'accumulent), et les autres sont de petits défauts relevés pendant la construction. L'utilisateur veut partir d'une base propre.

**Non-objectifs** : aucune nouvelle page, aucune nouvelle fonction visible en dehors de ce qui est listé ici.

**Anti-objectifs** (ce qui serait un échec même si tout fonctionne)
- Une image supprimée alors qu'elle sert encore, ou la bannière de l'utilisateur supprimée.
- Une page qui affiche des chiffres d'avant la dernière synchro à cause d'un cache.
- Un changement visible à la souris ou sur PC qui n'est pas listé ici.

### 19.2 Guide de déploiement [décidé]
`deploy/README.md` contient déjà le rôle Admin du package GHCR (étape 1.5) et le cookie Secure (étape 6.4). On y ajoute, à l'étape 7 « Premier démarrage », les vérifications qui n'y sont pas encore :
- l'arrêt propre du worker (`docker stop`) : le log montre la fin de la synchro en cours, ou un run marqué « Interrupted » au redémarrage ;
- la première synchro de cette version : toutes les listes PS5 sont rechargées une fois (migration 0005), et Settings montre « Up to date » et « 5 of yours » dans « Unobtainable trophies » (migration 0006) ;
- le Trophy Log sur le NAS : « Show all » face aux objectifs de 16.8, et le retour depuis une page de jeu sur la même ligne ;
- l'export PNG du Plat Wall (15.8) : texte en Sora, durée sous 60 s avec Rarity et Name, enregistrement sur un vrai iPhone avec Art, Rarity et Name ;
- la page Stats sur un téléphone et sur le pavé tactile d'un Mac (18.14) ;
- les nouveautés de cette section qui ne se vérifient que sur le NAS : la page d'attente au démarrage (19.3) et les en-têtes de protection (19.3).
Ces mêmes points sont retirés de la section 3 de `docs/ETAT-DU-PROJET.md` au profit d'un renvoi au guide.

### 19.3 Robustesse et sécurité [choix de Claude, validés sur description]
1. **En-têtes de protection** : toutes les réponses du site interdisent son affichage dans une page d'une autre origine (`X-Frame-Options: DENY` et `Content-Security-Policy: frame-ancestors 'none'`). Les fichiers de `/media` ne peuvent exécuter aucun script, même un SVG venu de Sony (`Content-Security-Policy` avec `sandbox`), et le navigateur ne devine pas leur type (`X-Content-Type-Options: nosniff`). Les en-têtes sont posés par l'app, pas par nginx : rien à changer sur le NAS. **[choix de Claude]** Les en-têtes globaux passent par `headers()` de `next.config.ts`, qui couvre aussi la page de connexion, les fichiers `_next/static` et les redirections, que le proxy ne voit pas. La route `/media` garde les siens (`nosniff`, déjà posé) et ajoute le `sandbox`, qui n'empêche pas l'affichage d'une image dans `<img>`.
2. **Démarrage** : tant que la base n'a pas toutes les migrations que l'app connaît (le worker les applique à son démarrage), le site répond par une page d'attente au lieu d'une erreur 500 : « Updating… », « This page reloads by itself. », rechargée toutes les 5 s, avec le code 503. Les routes `/api` répondent 503 sans page, export PNG du Plat Wall compris. **[choix de Claude]** Le nombre de migrations attendu est figé au build, depuis le journal des migrations. La vérification se fait dans le proxy, avant tout rendu : un layout ne suffirait pas, car la page se rend en même temps que lui et planterait quand même. Elle ne coûte plus rien une fois la base à jour : le résultat est gardé en mémoire. La page de connexion affiche aussi la page d'attente.
3. **Token** : quand le PSN est injoignable à l'enregistrement du npsso (erreur réseau ou délai dépassé), Settings affiche « Couldn't reach PSN. Try again. » au lieu de « PSN didn't accept this npsso ». Ce dernier message reste réservé au refus du PSN.
4. **Demande de synchro** : une demande manuelle (« Sync now ») n'est effacée qu'une fois la synchro terminée. Si `runSync` ou `markRun` lèvent une erreur, elle reste en attente et repart au tour suivant du worker. **[choix de Claude]** Après 3 échecs de suite sur la même demande, elle est abandonnée : un token expiré ne relance pas une synchro vouée à l'échec toutes les minutes, et l'historique des synchros montre les échecs.
5. **Langue** : la langue des noms et descriptions de trophées (`PSN_LANGUAGE`) est enregistrée avec les définitions. Quand elle change, la synchro suivante recharge les définitions de toutes les listes dans la nouvelle langue, une seule fois. **[choix de Claude]** Elle est enregistrée dans `settings`. Au premier démarrage de cette version, aucune langue n'est encore enregistrée : la langue courante est notée sans rien recharger, pour ne pas rallonger encore la première synchro sur le NAS.
6. **Jeu sans liste de trophées** : la correspondance « pas de liste » n'est plus gardée pour toujours. Elle est revérifiée au rafraîchissement quotidien.
7. **CI** : un test vérifie que le worker démarre depuis son paquet final (`node dist/worker.js`), jusqu'à sa connexion à la base. **[choix de Claude]** Il tourne dans le job `pg-smoke`, qui a déjà un vrai PostgreSQL 16.

### 19.4 Performance [choix de Claude, validés sur description]
1. **Calculs en mémoire** : la table des images (`loadImageMap`) et les données des milestones (`getMilestones`) sont gardées en mémoire par le site et relues seulement quand une synchro s'est terminée depuis. La page Stats ne lit plus la table des images qu'une fois par affichage. Une page ne montre jamais un chiffre d'avant la dernière synchro terminée. **[choix de Claude]** Le site et le worker ne partagent que la base : le cache est invalidé par la fin de tout run, réussi, partiel ou en échec, et par le rafraîchissement quotidien, puisqu'ils écrivent tous en base. La vérification coûte une petite requête par affichage.
2. **Images inutilisées** : après une synchro réussie, le worker supprime les fichiers d'images, leurs miniatures et leurs lignes `images` qu'aucune donnée n'utilise plus (profil, listes, groupes, trophées, jeux joués, bannières et logos). La bannière envoyée par l'utilisateur n'est jamais concernée. Une image de Sony supprimée à tort serait retéléchargée à la synchro suivante. Le journal de synchro donne le nombre d'images supprimées. **[choix de Claude]** :
   - « utilisée » veut dire présente quelque part en base : avatar, icône, jaquette, bannière et logo de toutes les listes, **cachées comprises** (une liste cachée peut revenir), icônes de groupes et de trophées, bannières imposées (`BANNER_OVERRIDES`) de toutes les listes ;
   - seules les lignes `images` et leurs fichiers sous `psn/` sont supprimés, jamais rien sous `banner/` ;
   - le nettoyage ne suit qu'un run réussi sans aucun échec : après un run partiel, une liste mal chargée pourrait manquer en base.

### 19.5 Interface
1. **« Sync now » [choix de Claude, validé]** : une fois cliqué, le bouton reste sur « Syncing… » jusqu'à la fin de la synchro, sans réapparaître entre la demande et le démarrage du run. Il affiche « Syncing… » tant qu'une demande attend ou qu'un run tourne.
2. **Carrousel au doigt [décidé]** : il est en pause tant que le doigt est posé dessus et repart dès qu'il se lève, comme les infobulles de Stats (18.14). À la souris, rien ne change : pause au survol et au focus clavier.
3. **Liste des jeux [choix de Claude, validé]** : elle continue de charger la page suivante même si une page ne contient que des doublons.
4. **« Hide 0% games » [choix de Claude, validé]** : le toggle garde le focus du clavier pendant l'enregistrement.
5. **Compteurs du bandeau sur téléphone [décidé, maquette v2, version B]** : à 640 px et moins, le total « Trophies » prend toute la largeur, sur une ligne (nombre puis libellé), et les 4 types sont en dessous, en 4 colonnes égales, avec les mêmes tailles de texte qu'aujourd'hui. Tout tient sur un téléphone de 320 px. Au-dessus de 640 px, rien ne change.
6. **`/api/games` [choix de Claude, validé]** : un `offset` ou une `limit` hors des bornes répondent 400, plus jamais 500.
7. **Bannière** : l'envoi d'une nouvelle bannière supprime l'ancien fichier. C'est déjà le cas dans le code (`uploadBanner`, vérifié le 11 novembre 2026) : le point de la liste était périmé. On ajoute seulement un test s'il manque.
8. **Champ npsso [choix de Claude, validé]** : il garde le texte collé après une erreur.

### 19.6 Tuile carrée (8.9)
1. **Couleur enregistrée [choix de Claude, validé]** : la couleur de la tuile est calculée par le worker quand il télécharge l'image, avec la même règle qu'aujourd'hui, et enregistrée avec l'image. Le site la met dès le premier affichage : plus de bleu nuit d'une image avant la couleur, ni au réaffichage. Les images déjà téléchargées reçoivent leur couleur à la synchro suivante. Le navigateur ne lit plus les pixels. **[choix de Claude]** La valeur enregistrée est le fond CSS, comme aujourd'hui (une couleur, ou un dégradé à deux couleurs). La base distingue « pas encore calculée » de « calculée, pas de bord uni », pour ne pas recalculer à chaque synchro. Une image SVG n'a pas de couleur de tuile.
2. **Coins transparents [décidé]** : la règle ne change pas. Les 3 images à coins arrondis (Dark Souls II et les deux Dragon Quest XI) ne s'affichent de toute façon nulle part sur une tuile : ces jeux ont leur jaquette carrée, celle du tableau de bord de la console, et le site l'utilise déjà. L'utilisateur trouvait que les bandes proposées ne s'accordaient pas avec le bord de ces images.
3. **Tests** : la limite de tolérance (16 accepté, 17 refusé) et l'opacité (250 acceptée, 249 refusée) sont testées.
Au 11 novembre 2026, les jeux affichés sur une tuile sont Game of Thrones, Marvel Heroes Omega, Minecraft: Story Mode et Tales from the Borderlands (PS4, sans jaquette chez eux ni chez une autre version).

### 19.7 Divers [choix de Claude, validés sur description]
1. **Données de test** : `seed:dev` crée aussi des jeux joués, pour que « Hours played » ne vaille plus 0 h en local.
2. **Catégorie de rareté** : la synchro protège `rare_category` comme `earned_rate` : une valeur vide renvoyée par le PSN ne remplace pas une valeur connue.
3. **Miniatures** : le journal de synchro donne le nombre de miniatures créées, et la bibliothèque d'images (sharp) n'est chargée que par le worker, par un import dynamique.

### 19.8 Laissé au builder
- L'endroit exact du cache (19.4) et la façon de savoir qu'une synchro s'est terminée, tant qu'aucune page ne montre de données périmées.
- Le test de démarrage du worker en CI (19.3.7) : sa forme exacte.
- Les textes de journal (nombre d'images supprimées, de miniatures créées). **[choix de Claude]** « Le journal » est celui du conteneur worker (les lignes `[worker] …` lues dans Portainer), pas l'historique des synchros de Settings : aucune colonne en plus.

### 19.9 Vérification avec les vraies données
- Les compteurs du bandeau à 375 et 320 px (version B), et inchangés au-dessus de 640 px.
- Le carrousel et le bouton « Sync now », le toggle au clavier, la liste des jeux, le champ npsso, l'envoi d'une bannière (l'ancien fichier disparaît).
- Les en-têtes de protection sur une page et sur `/media`.
- La page d'attente, en simulant une migration manquante.
- Une synchro complète en local : nombre d'images supprimées et de miniatures créées dans le journal, aucune image manquante ensuite sur Games, une page de jeu, Plat Wall, Trophy Log, Trophy Advisor et Stats, et la couleur des 4 tuiles dès le premier affichage.
- Les temps de réponse des pages avant et après le cache.
- Non vérifiable ici : le test de CI (sur github.com), et tout ce qui est listé pour le NAS (19.2).

## 20. Suites du check-up du 11 novembre 2026
**[décidé, 12 novembre 2026]** L'utilisateur traite les lots 1 et 2 de l'audit `a_reprendre.md` (sa section 9), avant le déploiement sur le NAS : **P1, S2 et R1** (lot 1), puis **S3, S4, S5, S6 et R2** (lot 2, durcissement). Il a validé chaque lot sur description. Construit sur la branche `fix/audit`. Les choix que l'utilisateur n'a pas faits lui-même sont marqués **[choix de Claude]**.

Ne sont **pas** traités ici, et restent notés dans `a_reprendre.md` : le lot 3 (P2, P3, P4, R3, Q1, Q2, Q4, Q5, Q6), S7 (garder ou non le npsso), les retouches de design D1 à D7 (à valider sur maquette), et les points que l'audit laisse pour après le NAS (Q3, P5, P6, P7, S8, S9, Q7). S10 est un risque accepté.

### 20.1 Intention
Le site va passer sur le NAS, exposé sur internet. Ces points le rendent plus rapide hors de la maison (P1), plus juste quand le PSN a un souci (R1) et plus difficile à attaquer (S2 à S6, R2). En temps normal, rien ne change à l'écran.

**Non-objectifs** : aucune nouvelle page, aucun changement visible en dehors des messages listés ici, aucun durcissement des conteneurs (S9) ni de la chaîne de build (S8).

**Anti-objectifs** (ce qui serait un échec même si tout fonctionne)
- Être déconnecté par cette version : les sessions en cours sont gardées.
- Un « PSN token expired » affiché alors que le PSN n'a rien refusé, ou l'inverse : un token vraiment refusé sans aucun bandeau.
- Un utilisateur bloqué par la limite de connexion à cause d'un autre, parce que nginx verrait toutes les connexions sous une même adresse.
- Une page plus lente, ou une réponse en flux (streaming) retenue par nginx.
- Une configuration nginx cassée qui arrive sur le NAS sans avoir jamais été lancée.

### 20.2 P1 : compression des réponses JSON [choix de Claude, validé sur description]
- `deploy/nginx/default.conf` active gzip pour `application/json`, au-delà de 1 Ko, y compris pour les requêtes venues du proxy DSM (`gzip_proxied any`), avec `Vary: Accept-Encoding`. **[choix de Claude]** Niveau de compression 5.
- nginx ne recompresse jamais une réponse déjà compressée : les pages, les réponses RSC et les fichiers statiques, déjà compressés par Next, ne changent pas. **[choix de Claude]** `text/x-component` n'est pas ajouté : Next compresse déjà ces réponses, et nginx pourrait retenir un flux pour le compresser.
- Aucun changement dans l'app.
- Effet attendu : `/api/trophy-log?all=1` (environ 6,4 Mo) passe sous 1 Mo.
- Ce PC n'a ni nginx ni Docker : la configuration est testée dans la CI (20.9) et vérifiée sur le NAS (`deploy/README.md`, étape 7).

### 20.3 S2 : serveurs de test limités au PC [choix de Claude, validé sur description]
- `npm run e2e:web` (`next dev`) écoute sur `127.0.0.1` seulement.
- **[choix de Claude]** Le lanceur du build de production entre dans le dépôt : `scripts/e2e/prod.mjs`, appelé par `npm run e2e:prod`. Il lance `next start` sur `127.0.0.1:3000` avec `.data/e2e.env`, après `npm run build`. Il remplace le script local `.data/e2e-prod.mjs`, qui ne suivait pas d'un PC à l'autre. `docs/ETAT-DU-PROJET.md`, section 5, le décrit.

### 20.4 R1 : token PSN, refus ou panne [choix de Claude, validé sur description]
Constat en plus de l'audit : quand le PSN refuse un token, la bibliothèque `psn-api` ne lève aucune erreur. Elle renvoie un objet sans token, et la synchro plante plus loin (chiffrement d'une valeur vide) avec un message technique, sans jamais afficher « PSN token expired ».
1. **Refus** : quand la réponse du PSN à un renouvellement ou à un échange de npsso ne contient pas de token utilisable (access token et refresh token non vides, durées numériques), le gateway lève une erreur de refus au lieu de renvoyer des valeurs vides.
2. **Renouvellement** (`getValidAuth`, `src/psn/tokens.ts`) :
   - refus du PSN : le statut passe à `expired`, le run échoue avec « PSN token expired » et le bandeau s'affiche (comme aujourd'hui) ;
   - PSN injoignable (`isUnreachable` : réseau, DNS, délai dépassé) : le statut ne change pas, le run échoue avec « Couldn't reach PSN », aucun bandeau ;
   - toute autre erreur pendant le renouvellement (par exemple une page d'erreur HTML de Sony) : le statut ne change pas, le run échoue avec « PSN token refresh failed (<message d'origine>) ».
   - Le renouvellement a le même délai maximal que l'échange du npsso : 20 s. **[choix de Claude]** Ce délai couvre tout le renouvellement, reprises comprises. Les reprises existantes sur erreur réseau (1, 2 puis 4 s) restent.
   - **[choix de Claude]** Un renouvellement qui répond après ces 20 s est quand même enregistré : le run a déjà échoué avec « Couldn't reach PSN », mais le token reçu n'est pas perdu.
   - **[choix de Claude]** Le contrôle du refus se fait dans le gateway, avant tout autre traitement de la réponse : `isUnreachable` prend toute `TypeError` pour une panne réseau, et une réponse mal formée ne doit pas être prise pour une panne.
   - La synchro suivante réessaie normalement. Une demande « Sync now » reste abandonnée après 3 échecs (19.3.4).
3. **Enregistrement d'un npsso** : une réponse sans token donne « PSN didn't accept this npsso » au lieu d'une erreur.
4. **Risque accepté** : `psn-api` ne donne pas le code HTTP. Une réponse JSON sans token, même renvoyée par une panne de Sony, compte comme un refus. Les pannes de Sony renvoient d'habitude une page HTML, qui tombe dans le cas « autre erreur ».

### 20.5 S3 : en-têtes de sécurité [choix de Claude, validé sur description]
- Toutes les réponses du site (`SITE_HEADERS`, `/media` compris) ajoutent `Referrer-Policy: same-origin` et `X-Content-Type-Options: nosniff`.
- `poweredByHeader: false` : plus d'en-tête `X-Powered-By: Next.js`.
- Les liens PowerPyx et PSNProfiles de la page d'un jeu passent en `rel="noopener noreferrer"`, comme les autres liens externes du site.
- `/media` garde sa CSP avec `sandbox` (19.3.1).
- **HSTS** : posé par le proxy inversé DSM, le seul à voir le HTTPS (case HSTS de la règle), ni par l'app ni par nginx. `deploy/README.md` l'ajoute à l'étape 6 et le vérifie à l'étape 7. Une fois l'en-tête vu, le navigateur refuse le HTTP sur ce nom de domaine pendant longtemps ; l'accès par l'adresse IP du NAS n'est pas concerné.

### 20.6 S4 : nginx et la vraie adresse du client [choix de Claude, validé sur description]
- `deploy/nginx/default.conf` ne fait plus confiance qu'à `127.0.0.0/8` et `172.16.0.0/12` (le proxy DSM passe par le pont Docker). `10.0.0.0/8` et `192.168.0.0/16` sont retirés : un appareil du réseau local ne peut plus inventer son adresse avec `X-Forwarded-For`. Le commentaire du fichier dit maintenant ce qui se passe vraiment.
- Le guide ajoute deux vérifications :
  - étape 3 : l'adresse du réseau `psn-net` (Portainer → Networks) doit être dans `172.16.0.0/12`. Sinon, mettre cette adresse à la place de `172.16.0.0/12` dans `default.conf` ;
  - étape 7 : après une visite depuis le téléphone en données mobiles, le journal du conteneur `nginx` montre l'adresse publique du téléphone, et pas `172.x.x.1`.
- Le test de la CI (20.9) vérifie qu'une adresse inventée est ignorée.

### 20.7 S5 : sessions [choix de Claude, validé sur description]
- La base ne garde plus l'identifiant de session, mais son empreinte SHA-256 (64 caractères hexadécimaux). Le cookie ne change pas.
- **Migration 0009** : elle convertit les sessions existantes sur place. Personne n'est déconnecté. **[choix de Claude]** SQL écrit à la main, sans changement de schéma : `encode(sha256(convert_to(id, 'UTF8')), 'hex')`, valable sur PostgreSQL 16 comme sur PGlite. Pendant la mise à jour, la page d'attente (19.3.2) couvre le moment où l'app attend la migration.
- Une session non vue depuis plus de 400 jours (la durée du cookie, `SESSION_MAX_AGE_S`) est refusée et supprimée. Le cookie étant prolongé à chaque visite, la « session sans fin » de la spec 5 ne change pas.
- Chaque nouvelle connexion supprime les sessions périmées. « Log out » supprime toujours toutes les sessions.

### 20.8 S6 et R2 : connexion et images [choix de Claude, validé sur description]
- **Connexion** : un identifiant ou un mot de passe de plus de 256 caractères est refusé sans calcul bcrypt, avec le même message « Wrong username or password. », et compte comme une tentative.
- **Limiteur de tentatives** : à chaque tentative, il oublie les adresses dont toutes les tentatives sont plus vieilles que la fenêtre de 15 minutes.
- **Images (R2)** : un téléchargement d'image a un délai maximal de 30 s, en-têtes et contenu compris (`AbortSignal.timeout`). Passé ce délai, l'image compte comme un échec (`failed` dans le journal du worker) et elle est retentée à la synchro suivante.

### 20.9 Test de la configuration nginx dans la CI [choix de Claude]
- Un nouveau job lance, dans Docker, l'image `nginx:1.27-alpine` de `stack-infra.yml` avec le vrai `deploy/nginx/default.conf`, devant un faux site joignable sous le nom `app` sur le port 3000. Ce faux site renvoie un JSON de plusieurs Ko et l'en-tête `X-Real-IP` qu'il a reçu. **[choix de Claude]** Les conteneurs sont sur un réseau Docker créé pour le test, comme `psn-net` : le résolveur `127.0.0.11` de `default.conf` n'existe que sur ce type de réseau. La requête de test passe par ce réseau, comme le proxy DSM passe par le pont Docker.
- Le job vérifie :
  - que nginx démarre avec cette configuration ;
  - qu'une requête avec `Accept-Encoding: gzip` reçoit le JSON compressé (`Content-Encoding: gzip`) ;
  - qu'une requête avec `X-Forwarded-For: 203.0.113.9, 192.168.1.50` arrive au site avec l'adresse `192.168.1.50` : la première, inventée, est ignorée.
- **[choix de Claude]** Le job ne bloque pas la publication de l'image : `default.conf` n'est pas dans l'image, il est copié à la main sur le NAS.

### 20.10 Documentation
- `deploy/README.md` : étape 3 (adresse de `psn-net`), étape 6 (HSTS), étape 7 (nouveaux en-têtes au point 5, compression au point 8, vraie adresse dans le journal de nginx), et le rappel de remplacer `default.conf` sur le NAS.
- `docs/ETAT-DU-PROJET.md` : `npm run e2e:prod` en section 5, le bilan de cette branche.
- `a_reprendre.md` : chaque point traité est marqué fait, les autres « non traité ».

### 20.11 Vérification avec les vraies données
Sur le build de production local (`npm run build`, puis `npm run e2e:db`, `npm run e2e:worker` et `npm run e2e:prod`), connecté :
- **S2** : le port 3000 n'écoute que sur `127.0.0.1`, pour `e2e:web` comme pour `e2e:prod`.
- **S3** : les en-têtes d'une page, d'une réponse `/api` et d'une image `/media`, lus sur une vraie réponse : `Referrer-Policy`, `nosniff`, plus de `X-Powered-By`, et la CSP inchangée.
- **S5** : toujours connecté après la migration 0009 ; la table `sessions` ne contient que des empreintes ; déconnexion puis reconnexion ; une session vieillie à la main de 401 jours renvoie vers la page de connexion et disparaît de la table.
- **S6** : un mot de passe de 300 caractères donne « Wrong username or password. ».
- **R1** : un vrai renouvellement auprès du PSN (token d'accès vieilli à la main en base) passe, puis la synchro va au bout : la nouvelle vérification du gateway accepte une vraie réponse. Le PSN injoignable, simulé pour le seul worker, donne « Couldn't reach PSN » dans l'historique, sans bandeau.
- **R2** : une synchro complète télécharge toujours les images.
- **Non vérifiable ici** : P1 et S4 (pas de nginx ni de Docker sur ce PC), vérifiés par le job de la CI (20.9) sur github.com, puis sur le NAS (`deploy/README.md`, étape 7) ; HSTS, sur le NAS.

### 20.12 Laissé au builder
- La forme de l'erreur de refus du gateway et l'endroit exact du contrôle.
- La forme du job de la CI (20.9), tant qu'il teste le vrai `default.conf` avec la vraie image nginx.
- La façon de simuler le PSN injoignable pour la vérification (20.11), sans rien ajouter au code de production.
