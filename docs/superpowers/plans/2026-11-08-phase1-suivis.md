# Phase 1 : points mis de côté pour plus tard

Relevés pendant la phase 1 (relectures par tâche, relecture finale de la branche, vérification avec les vraies données). Aucun n'est bloquant.

**État au 12 novembre 2026** : tous les points ci-dessous sont traités par la spec 19, sur la branche `fix/followups`, fusionnée dans `main` le 12 novembre 2026 (PR #19). Chacun est marqué « Réglé » ci-dessous. Restent seulement les vérifications qui ne se font que sur le NAS : elles sont décrites dans `deploy/README.md`, étape 7.

## À vérifier au premier déploiement sur le NAS
Toutes ces vérifications sont maintenant décrites, avec ce qu'on doit voir, dans `deploy/README.md`, étape 7 « Premier démarrage » (spec 19.2). Le texte d'origine est gardé ci-dessous.
- **Arrêt propre du worker** (`docker stop`) : jamais testé dans un conteneur. Le log doit montrer la fin de la synchro en cours, ou un run marqué « Interrupted » au redémarrage. À vérifier sur le NAS : voir le guide, étape 7.
- **Réglage des en-têtes du reverse proxy DSM** : après la première connexion en https, le cookie `psnt_session` doit avoir l'option Secure. La procédure est dans `deploy/README.md`, étape 6.4.
- **Rôle Admin du package GHCR**, à donner une seule fois pour que le nettoyage des anciennes images fonctionne (`deploy/README.md`, étape 1.5).
- **Trophy Log sur le NAS** (spec 16.8, voir le guide, étape 7) :
  - mesurer « Show all » contre les objectifs fixés en local : premières lignes en moins de 1 s, la page jamais figée plus de 250 ms, la liste complète en moins de 5 s. La réponse complète (environ 5 Mo de JSON) arrive avant le premier paquet. Si les premières lignes tardent, demander d'abord les 300 premières lignes à part ;
  - refaire le retour depuis une page de jeu après « Show all » : on doit retrouver la même ligne.
- **Export PNG du Plat Wall** (spec 15.8, voir le guide, étape 7), impossible à vérifier sans Docker ni NAS : le texte s'affiche bien en Sora dans l'image Docker ; la fabrication reste largement sous la limite de 60 s de nginx, avec Rarity et Name cochés sur les 230 platines ; « Download PNG » enregistre le fichier sur un vrai iPhone (vérifier avec Art + Rarity + Name sur les 230 platines, soit environ 20 millions de pixels, car « Download PNG » ne devient actif qu'une fois l'image d'aperçu chargée).

## Robustesse et sécurité
- **En-têtes de protection** : `X-Frame-Options` / `frame-ancestors`. `/media` sert sans CSP sandbox les SVG venant de Sony. **Réglé** (spec 19, branche `fix/followups`).
- **Démarrage de la stack site** : l'app peut répondre 500 si elle démarre avant que le worker ait appliqué une nouvelle migration. Il n'y a ni healthcheck ni `depends_on`. **Réglé** (spec 19, branche `fix/followups`).
- **Message d'erreur trompeur** : un échec réseau à l'enregistrement du token affiche « PSN didn't accept this npsso ». **Réglé** (spec 19, branche `fix/followups`).
- **Demande de synchro perdue** : une demande manuelle disparaît si `runSync` ou `markRun` lèvent une erreur. Il suffit de recliquer. **Réglé** (spec 19, branche `fix/followups`).
- **Changement de `PSN_LANGUAGE`** : rien ne recharge les définitions des trophées dans la nouvelle langue. **Réglé** (spec 19, branche `fix/followups`).
- **Jeu sans liste de trophées** : la correspondance « pas de liste » est mémorisée pour toujours, même si la liste est créée plus tard. **Réglé** (spec 19, branche `fix/followups`).
- **CI** : aucun test de fumée du bundle du worker (`node dist/worker.js`). **Réglé** (spec 19, branche `fix/followups`).

## Performance
- **Calculs refaits à chaque affichage** : `loadImageMap` charge toute la table `images` (~13 000 lignes), et `getMilestones` charge tous les trophées obtenus. C'est rapide aujourd'hui (~60 ms et ~160 ms), mais ça grossira avec les données. **Réglé** (spec 19, branche `fix/followups`).
- **Images jamais supprimées** : les anciennes images et les lignes `images` qui ne servent plus ne sont jamais nettoyées. **Réglé** (spec 19, branche `fix/followups`).

## Interface
- **Bouton « Sync now »** : il peut réapparaître jusqu'à 60 s alors qu'une synchro démarre (course entre la demande et le run). **Réglé** (spec 19, branche `fix/followups`).
- **Carrousel sur écran tactile** : un tap le met en pause jusqu'au tap suivant ailleurs. **Réglé** (spec 19, branche `fix/followups`).
- **Liste de jeux** : elle peut s'arrêter de charger si une page entière ne contient que des doublons. **Réglé** (spec 19, branche `fix/followups`).
- **Toggle « Hide 0% games »** : il perd le focus clavier pendant l'enregistrement. **Réglé** (spec 19, branche `fix/followups`).
- **Compteurs de trophées à 375 px** : le compteur Bronze passe seul à la ligne. **Réglé** (spec 19, branche `fix/followups`).
- **Paramètre `offset` énorme** dans `/api/games` : il donne une erreur 500 (seulement une fois connecté). **Réglé** (spec 19, branche `fix/followups`).
- **Bannière** : l'ancien fichier n'est pas supprimé quand on en envoie une nouvelle. Déjà réglé dans le code (`uploadBanner`, vérifié le 11 novembre 2026) : le point était périmé. **Déjà réglé dans le code** (spec 19.5.7).
- **Champ npsso** : il est vidé après une erreur. **Réglé** (spec 19, branche `fix/followups`).

## Divers
- **Données de dev** : `seed:dev` ne crée aucun `played_games`, donc « Hours played » affiche 0 h sur ces données. **Réglé** (spec 19, branche `fix/followups`).
- **`rare_category`** n'est pas protégé comme `earned_rate`. Sans effet visible : les paliers de rareté viennent de `earned_rate`. **Réglé** (spec 19, branche `fix/followups`).
- **Objectif des trophées à paliers** (relevé le 8 novembre 2026) : `trophies.progress_target` est vide pour les 12 434 trophées, alors que la spec (7) demande de le stocker.
  - La synchro le lit dans l'état utilisateur (`trophyProgressTargetValue` de `getUserTrophiesEarnedForTitle`), alors qu'il est dans la définition des trophées (`getTitleTrophies`), vérifié le 8 novembre 2026.
  - **Réglé** par la page d'un jeu (PR #4, fusionnée le 9 novembre 2026) : la synchro lit l'objectif dans `getTitleTrophies`, et la page affiche le compteur des trophées à paliers (spec 6.3, 6.4 et 8.9).
- **Miniatures** :
  - `src/sync/images.ts` importe `thumbs.ts` de façon statique, et l'isolation de sharp repose sur la liste d'exclusion par défaut de Next ;
  - le nombre de miniatures créées n'est pas affiché dans le journal de synchro.
  - **Réglé** (spec 19, branche `fix/followups`) (spec 19.7.3).
- **Tests locaux de bout en bout** : **réglé**, les scripts sont dans `scripts/e2e/` (PR #2) et décrits dans `docs/ETAT-DU-PROJET.md`, section 5.

## Page d'un jeu (relevés de la relecture du 9 novembre 2026)
Aucun n'est bloquant. Ils concernent la tuile carrée derrière une image non carrée (`components/TileImage.tsx`, `src/lib/tile-bg.ts`, spec 8.9).
- **Couleur de la tuile perdue au remontage** : elle est lue par chaque image une fois chargée. Un groupe masqué puis réaffiché par le filtre, ou la première apparition dans Games, montre le bleu nuit pendant une image avant la couleur du bord. Mettre la couleur en cache par adresse casserait l'hydratation. La seule vraie solution serait de la calculer dans le worker et de la stocker. **Réglé** (spec 19, branche `fix/followups`) (spec 19.6.1).
- **Coins transparents** : une icône dont le bord est uni mais dont les coins sont transparents (coins arrondis) garde la tuile bleu nuit, car tout le bord doit être opaque. Assouplissement possible : ignorer les 1 ou 2 pixels de chaque extrémité. Laissé tel quel, décidé (spec 19.6.2).
- **Lecture de toute l'image** : le canevas lit toute l'image pour deux lignes de pixels. C'est sans effet pour des icônes de 320 × 176, mais à revoir si de grandes images passaient un jour par la tuile. **Réglé** (spec 19, branche `fix/followups`) (spec 19.6.1), le navigateur ne lit plus les pixels.
- **Tests à compléter** : le cas d'une image déjà chargée avant l'hydratation n'est pas testé (jsdom), ni la limite de tolérance (16 accepté, 17 refusé). **Réglé** (spec 19, branche `fix/followups`) (spec 19.6.3).
