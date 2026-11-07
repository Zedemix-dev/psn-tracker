# PSN Tracker — Design, phase 1 (socle + page principale + page jeu + Settings)

Date : 2026-11-07
Maquette validée : [2026-11-07-psn-tracker-maquette-accueil.html](2026-11-07-psn-tracker-maquette-accueil.html) (style « Console », v12)

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
   - **[décidé]** Son design détaillé sera fait plus tard, quand on en sera là. **[mon choix]** Il passera par une maquette validée par l'utilisateur avant d'être construit, comme pour la page principale.

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
| Définition des trophées : nom, description, icône, type, groupe, caché | `getTitleTrophies(..., "all")` |
| État utilisateur par trophée : obtenu, date, rareté mondiale (`trophyEarnedRate`), catégorie de rareté | `getUserTrophiesEarnedForTitle(..., "all")` |
| Progression par groupe | `getUserTrophyGroupEarningsForTitle` |
| Temps de jeu, nombre de sessions, dernière partie, **jaquette carrée** | `getUserPlayedGames` (PS4/PS5) |
| Lien entre jeu joué (`titleId`) et liste de trophées (`npCommunicationId`) | `getUserTrophiesForSpecificTitle` (5 `npTitleIds` max par appel) |

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

## 7. Données

Le schéma exact est laissé au builder. Il doit au minimum permettre :
- **un profil unique** : pseudo, avatar, niveau, progression, palier, compteurs ;
- **les listes de trophées** : identifiant PSN, service, plateforme(s), nom, icône, jaquette carrée, compteurs définis et obtenus par type, progression PSN, caché, dates, `trophySetVersion`, temps de jeu, sessions, dernière partie ;
  - Les versions PS4 et PS5 d'un même jeu sont **deux listes distinctes**, comme sur le PSN. **[mon choix]**
- **les groupes** (base et DLC) avec leurs compteurs ;
- **les trophées** : définition, état obtenu ou non, date d'obtention, rareté mondiale (en nombre), catégorie de rareté PSN, objectif de progression éventuel ;
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
- **[mon choix]** Tant qu'aucune image n'est choisie, un dégradé neutre s'affiche avec un lien « Choose a banner in Settings ».

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
- **Tri [décidé]** : Last played (par défaut), Last trophy, Alphabetical, Percent completion, Time played, Total trophies, Earned trophies, Unearned trophies, Platinum rarity.
  - **[mon choix]** Chaque tri a son sens naturel :
    - les plus récents d'abord pour les deux tris par date ;
    - de A à Z pour Alphabetical ;
    - les plus grandes valeurs d'abord pour Percent completion, Time played et les trois tris par nombre de trophées ;
    - le platine le plus rare d'abord pour Platinum rarity, avec les jeux sans platine à la fin.
  - **[mon choix]** « Last played » utilise la date de dernière partie de `getUserPlayedGames`, ou à défaut la date du dernier trophée.
- Changer un filtre, un tri ou la recherche relance le chargement à partir des 50 premiers jeux.
- **Une ligne par jeu**, sur une hauteur d'environ 80 px, **cliquable [décidé]** : elle ouvre la page du jeu (8.9).
  - **jaquette carrée [décidé]** (60 px), celle du jeu telle qu'on la voit sur l'écran d'accueil de la console, et non l'icône de la liste de trophées (rectangulaire sur PS4) ;
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
3. **Milestones [décidé]** : **toutes** les étapes franchies, de la plus récente à la plus ancienne, **sans limite ni lien « View all »**, même si la liste est longue (32 étapes aujourd'hui).
   - Chaque étape montre l'icône du trophée, son nom et le jeu en entier, le libellé (« 225th platinum ») et la date.
   - **[mon choix]** La date s'affiche en temps relatif comme sur psnprofiles (« 9 years ago »), et la date exacte apparaît en infobulle.
   - **[décidé] Mêmes étapes que psnprofiles** (relevées sur le profil de l'utilisateur) :
     - **First trophy**, **First platinum**, **Latest platinum**, **Fastest platinum** (le platine obtenu le plus vite après le premier trophée du jeu) ;
     - platines : 10th, 20th, 30th, 40th, 50th, puis tous les 25 (75th, 100th, 125th…) ;
     - trophées : 500th, puis tous les 500 jusqu'au 5,000th, puis tous les 1 000 (6,000th, 7,000th…), plus le clin d'œil **1,337th trophy**.
     - Pour le comptage, les trophées sont numérotés dans l'ordre de leur date d'obtention.

### 8.9 Page de détail d'un jeu
- **[décidé]** Elle s'ouvre au clic sur une ligne de la liste. Elle s'inspire de la page d'un jeu sur psnprofiles : **la liste des trophées**, plus **un panneau latéral avec les infos du jeu**.
- **[décidé]** Son design détaillé sera fait plus tard, par une maquette, avant de construire la page. Ce qui suit n'est qu'un **point de départ [mon choix]**, limité aux données que le PSN fournit vraiment.
- **Liste des trophées**, une ligne par trophée :
  - icône, nom, description ;
  - date et heure d'obtention (ou rien si non obtenu) ;
  - rareté mondiale en % et sa catégorie ;
  - icône officielle du type.
  - Les trophées obtenus sont mis en évidence, comme le fond vert de psnprofiles.
  - Les trophées sont regroupés par jeu de base puis par pack DLC, chaque groupe ayant son nom, son icône et sa progression.
- **Panneau latéral :**
  - jaquette carrée, plateforme ;
  - compteurs par type, progression PSN ;
  - temps de jeu et dernière partie ;
  - date du premier trophée, date du platine et temps mis pour l'obtenir (« 3 weeks, 3 days, 5 hours ») ;
  - rareté moyenne du jeu, et répartition par catégorie de rareté.
- **Exclu**, car non fourni par le PSN ou inutile pour l'utilisateur : guides, notes, vues et favoris, éditeur, développeur, genres et dates de sortie, boutons de partage, listes « to-do ».

## 9. Page Settings
- **Banner [décidé]** :
  - envoi d'une image **depuis le PC** (JPEG, PNG ou WebP, 10 Mo maximum **[mon choix]**), avec aperçu ;
  - choix de la partie verticale à garder (8.2) ;
  - l'image est stockée sur un volume Docker ;
  - un bouton permet de revenir à la bannière par défaut.
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
- **Page de détail d'un jeu :** sa maquette est à faire et à valider avant de la construire (8.9). C'est la dernière étape de la phase 1.
