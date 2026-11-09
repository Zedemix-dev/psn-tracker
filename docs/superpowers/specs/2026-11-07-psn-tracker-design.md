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
  - Les sessions sont enregistrées côté serveur. Le bouton « Log out » de Settings les invalide. **[mon choix]**
  - Le cookie est `httpOnly`. Il est `Secure` quand le site est ouvert en HTTPS, ce qui laisse fonctionner un éventuel accès en HTTP par l'IP locale du NAS. **[mon choix]**
- **[mon choix]** Les tentatives de connexion sont limitées, parce que le site est exposé sur internet.
  - On s'appuie pour cela sur la vraie IP du client, transmise par le reverse proxy de DSM puis par nginx (en-têtes `X-Forwarded-For` / `X-Forwarded-Proto`).
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
  - Si un jeu n'a pas de correspondance, on affiche l'icône de sa liste de trophées dans un cadre carré, sans la rogner.
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
    - **Date earned** : les obtenus du plus ancien au plus récent, puis les non obtenus dans l'ordre PSN.
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
      - le but est la cohérence : une image carrée partout. Une liste PS4 sans aucune jaquette garde son icône, affichée en entier, comme dans la liste Games ;
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
  - l'icône ;
  - le nom (15 px, gras) et la description en dessous, **en entier**. Une description longue agrandit la ligne, rien n'est coupé ;
  - si le trophée est obtenu : la date (« 18 Jul 2022 ») et l'heure (« 01:21 ») sur deux lignes, en vert clair ;
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
1. **[décidé] La jaquette en grand**, en 320 × 320 : la même jaquette carrée que dans la liste des jeux (8.7), ou à défaut l'icône de la liste de trophées, sans la rogner.
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
- **Page de détail d'un jeu :** maquette validée le 8 novembre 2026 (8.9), construite et vérifiée avec les vraies données sur la branche `feat/game-detail`. Il reste à fusionner la Pull Request ; c'est la dernière étape de la phase 1.
- **Jeux aux trophées non obtenables :** fonctionnalité demandée le 8 novembre 2026, décrite en 14. Elle sera faite à part, après la page de détail d'un jeu.

## 14. Jeux aux trophées non obtenables (à venir)
**[décidé, 8 novembre 2026]** Cette fonctionnalité est faite **à part**, après la page de détail d'un jeu, sur sa propre branche (`feat/unobtainable`). Elle suivra le processus habituel : cadrage, maquette validée, spec, plan, construction. Ce qui suit est ce que l'utilisateur a déjà décidé, plus les constats faits le jour même.

**Intention** : repérer les jeux dont certains trophées ne peuvent plus être obtenus (serveurs fermés, jeu plus supporté, jeu retiré du PSN…), pour les mettre de côté ou les cibler.

**Ce que l'utilisateur a décidé** :
1. **Bouton « tout afficher » dans la liste des jeux** (8.7). Il est placé dans l'en-tête de la liste, à côté du nombre de jeux (« 266 games »). En un clic, il affiche la liste complète des jeux de Games, sans avoir à faire défiler la page pour charger les jeux 50 par 50.
2. **Filtre « non obtenables »**, dans la barre de filtres de Games, juste après le menu de tri.
   - C'est un **filtre séparé**, une surcouche qui s'ajoute aux autres : il fonctionne en même temps que l'état, la plateforme, le tri, la recherche et « Hide 0% games ».
   - Il a deux valeurs : **« With unobtainable »** (seulement les jeux qui ont des trophées non obtenables) et **« Without unobtainable »** (seulement les jeux qui n'en ont pas).
   - Il est **désactivé par défaut** : la liste n'est filtrée que lorsque l'utilisateur choisit l'une des deux valeurs.
3. **Repère « ! » dans la liste des jeux** (8.7) : un jeu qui a des trophées non obtenables porte un « ! » sur sa ligne, juste après le badge de plateforme (PS4/PS5).
   - Au survol du « ! », une infobulle indique que le jeu a des trophées non obtenables, et combien. Ce nombre vient de la liste.
4. **Sur la page d'un jeu** (8.9), chaque trophée non obtenable porte un « ! » à côté de son nom.
   - Un trophée non obtenable **et non obtenu** a en plus une **légère surbrillance rouge**, sur le même principe que la surbrillance verte d'un trophée obtenu.
   - Un trophée non obtenable **mais déjà obtenu** garde sa **surbrillance verte**, avec seulement le « ! » à côté de son nom, sans rouge.
5. **Source de la liste réglable dans Settings** : un champ permet de saisir l'adresse de la liste des jeux aux trophées non obtenables.
   - Adresse actuelle, à mettre par défaut : `https://psnp-plus.huskycode.dev/list.json` (liste maintenue pour l'extension PSNP+).
   - Si l'adresse change un jour, l'utilisateur la met à jour depuis l'interface, sans toucher au code.

**Constats du 8 novembre 2026** (à confirmer au cadrage) :
- **Format de la liste** : `{ "version": 2, "list": { "<id psnprofiles>": { "title", "platforms", "submitter", "note", "trophies": [numéros], "timestamp" } } }`.
  - Elle compte 1 622 jeux, dont 1 150 sur PS4 ou PS5.
  - `note` explique la cause, par exemple « The servers closed on May 29/30, 2025. ».
  - `trophies` donne les numéros des trophées non obtenables dans la liste psnprofiles du jeu.
- **Aucun identifiant PSN** (`npCommunicationId`) dans la liste : un jeu doit être rapproché **par son nom et sa plateforme**.
  - Avec un nom normalisé (minuscules, sans ™ ® ©, ponctuation réduite) et une plateforme commune, 5 des 266 jeux de l'utilisateur sont reconnus : Dauntless (PS4 et PS5), Final Fantasy XV (PS4), Gran Turismo Sport et Marvel Heroes Omega. Aucun faux positif n'a été vu.
  - Un même jeu peut avoir plusieurs entrées, une par région (Final Fantasy XV en a 4). Pour savoir si un jeu « a des trophées non obtenables », il suffit que l'une d'elles corresponde.
- **Numéros des trophées** : leur correspondance avec les `trophyId` du PSN est **à vérifier** au cadrage, en comparant avec les pages psnprofiles.
  - Pour Gran Turismo Sport (`[1, 2, 3, 4, 35, 36, 38]`), la lecture « numéro − 1 = `trophyId` » donne des trophées en ligne plausibles : le platine, les records du Sport Mode, la livrée partagée, le Daily Workout.
  - Mais l'entrée de Dauntless vaut `[0]`, ce qui ne colle pas avec une numérotation qui part de 1.
  - Le nombre de trophées non obtenables affiché dans l'infobulle de la liste des jeux est la taille de ce tableau.

**Points à trancher au cadrage** :
- le libellé du filtre quand il est désactivé, et l'aspect du bouton « tout afficher » une fois tous les jeux chargés ;
- la fréquence de téléchargement de la liste (par exemple avec le rafraîchissement quotidien, et à l'enregistrement d'une nouvelle adresse), et ce qui s'affiche si elle est inaccessible ;
- l'effet du filtre sur les stats, comme « Hide 0% games » le fait (8.4), ou non ;
- l'affichage de la note de la liste (la cause : « Servers closed on… »), dans l'infobulle du « ! » ou sur la page d'un jeu ;
- une correction manuelle pour un jeu mal reconnu par son nom.
