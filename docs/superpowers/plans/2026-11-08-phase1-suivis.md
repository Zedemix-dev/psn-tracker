# Phase 1 : points mis de côté pour plus tard

Relevés pendant la phase 1 (relectures par tâche, relecture finale de la branche, vérification avec les vraies données). Aucun n'est bloquant. À reprendre dans une phase suivante.

## À vérifier au premier déploiement sur le NAS
- **Arrêt propre du worker** (`docker stop`) : jamais testé dans un conteneur. Le log doit montrer la fin de la synchro en cours, ou un run marqué « Interrupted » au redémarrage.
- **Réglage des en-têtes du reverse proxy DSM** : après la première connexion en https, le cookie `psnt_session` doit avoir l'option Secure. La procédure est dans `deploy/README.md`, étape 6.4.
- **Rôle Admin du package GHCR**, à donner une seule fois pour que le nettoyage des anciennes images fonctionne (`deploy/README.md`, étape 1.5).

## Robustesse et sécurité
- **En-têtes de protection** : `X-Frame-Options` / `frame-ancestors`. `/media` sert sans CSP sandbox les SVG venant de Sony.
- **Démarrage de la stack site** : l'app peut répondre 500 si elle démarre avant que le worker ait appliqué une nouvelle migration. Il n'y a ni healthcheck ni `depends_on`.
- **Message d'erreur trompeur** : un échec réseau à l'enregistrement du token affiche « PSN didn't accept this npsso ».
- **Demande de synchro perdue** : une demande manuelle disparaît si `runSync` ou `markRun` lèvent une erreur. Il suffit de recliquer.
- **Changement de `PSN_LANGUAGE`** : rien ne recharge les définitions des trophées dans la nouvelle langue.
- **Jeu sans liste de trophées** : la correspondance « pas de liste » est mémorisée pour toujours, même si la liste est créée plus tard.
- **CI** : aucun test de fumée du bundle du worker (`node dist/worker.js`).

## Performance
- **Calculs refaits à chaque affichage** : `loadImageMap` charge toute la table `images` (~13 000 lignes), et `getMilestones` charge tous les trophées obtenus. C'est rapide aujourd'hui (~60 ms et ~160 ms), mais ça grossira avec les données.
- **Images jamais supprimées** : les anciennes images et les lignes `images` qui ne servent plus ne sont jamais nettoyées.

## Interface
- **Bouton « Sync now »** : il peut réapparaître jusqu'à 60 s alors qu'une synchro démarre (course entre la demande et le run).
- **Carrousel sur écran tactile** : un tap le met en pause jusqu'au tap suivant ailleurs.
- **Liste de jeux** : elle peut s'arrêter de charger si une page entière ne contient que des doublons.
- **Toggle « Hide 0% games »** : il perd le focus clavier pendant l'enregistrement.
- **Compteurs de trophées à 375 px** : le compteur Bronze passe seul à la ligne.
- **Paramètre `offset` énorme** dans `/api/games` : il donne une erreur 500 (seulement une fois connecté).
- **Bannière** : l'ancien fichier n'est pas supprimé quand on en envoie une nouvelle.
- **Champ npsso** : il est vidé après une erreur.

## Divers
- **Données de dev** : `seed:dev` ne crée aucun `played_games`, donc « Hours played » affiche 0 h sur ces données.
- **`rare_category`** n'est pas protégé comme `earned_rate`. Sans effet visible : les paliers de rareté viennent de `earned_rate`.
- **Objectif des trophées à paliers** (relevé le 8 novembre 2026) : `trophies.progress_target` est vide pour les 12 434 trophées, alors que la spec (7) demande de le stocker.
  - La synchro le lit dans l'état utilisateur (`trophyProgressTargetValue` de `getUserTrophiesEarnedForTitle`), alors qu'il est dans la définition des trophées (`getTitleTrophies`), vérifié le 8 novembre 2026.
  - **Pris en charge par la page d'un jeu** (branche `feat/game-detail`) : elle affiche le compteur des trophées à paliers (spec 6.3, 6.4 et 8.9).
- **Miniatures** :
  - `src/sync/images.ts` importe `thumbs.ts` de façon statique, et l'isolation de sharp repose sur la liste d'exclusion par défaut de Next ;
  - le nombre de miniatures créées n'est pas affiché dans le journal de synchro.
- **Tests locaux de bout en bout** : les scripts sont restés dans `.data/` (ignoré par git). Si besoin, les déplacer dans `scripts/e2e/`.
