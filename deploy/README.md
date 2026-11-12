# Déploiement sur le NAS Synology (Portainer)

Guide pas à pas. Architecture : le reverse proxy DSM (HTTPS) → conteneur `nginx` (port 8080) → conteneur `app` (Next.js, port 3000). Le conteneur `worker` synchronise les trophées, `postgres` stocke les données.

Deux stacks Portainer : **infra** (`stack-infra.yml` : postgres + nginx) et **site** (`stack-site.yml` : app + worker).

## 1. GitHub

1. Le dépôt `Zedemix-dev/psn-tracker` est **privé**. GitHub Actions est activé par défaut : rien à configurer.
2. Après le premier push sur `main`, le workflow « CI » construit l'image et la publie. Elle apparaît dans l'onglet **Packages** du dépôt (`ghcr.io/zedemix-dev/psn-tracker`, étiquettes `latest` et `sha-<court>`).
3. Portainer doit pouvoir télécharger l'image. Deux options :
   - **Package privé (recommandé)** : créer un *Personal Access Token (classic)* sur GitHub (Settings → Developer settings → Personal access tokens → Tokens (classic)) avec **uniquement** la permission `read:packages`. Puis dans Portainer : **Registries → Add registry → Custom registry** (ou GitHub/GHCR), URL `ghcr.io`, avec authentification : nom d'utilisateur GitHub + le token.
   - **Package public** : sur la page du package → Package settings → Change visibility → Public. Aucun token n'est alors nécessaire (mais l'image est visible de tous : elle ne contient aucun secret, ceux-ci sont dans les variables d'environnement).
4. Quotas gratuits : pour un dépôt privé, GitHub Actions offre un nombre limité de minutes par mois et un espace de stockage limité (les plafonds exacts sont sur la page de facturation GitHub). Le workflow est réglé pour les économiser :
   - il ne tourne qu'une fois par push (pas une deuxième fois pour une pull request), et un nouveau push sur la même branche annule le run en cours (sauf sur `main`) ;
   - il ne crée plus d'artefact par run (le résumé du build reste visible dans le run) ;
   - sur `main`, après la publication, il **supprime les anciennes images** et garde les **3 plus récentes** : celle qui tourne + 2 pour revenir en arrière (étiquettes `sha-<court>`).
5. **Une seule fois, après la première publication**, autoriser ce nettoyage : page du package (onglet **Packages** du dépôt → `psn-tracker`) → **Package settings** → **Manage Actions access** → le dépôt `psn-tracker` doit avoir le rôle **Admin** (l'ajouter avec **Add repository** s'il n'apparaît pas). Sans ce rôle, l'étape « Prune old images in GHCR » échoue sans bloquer le build (elle apparaît en orange dans le run) et rien n'est supprimé.
6. Les artefacts déjà créés par les anciens runs (`*.dockerbuild`, ~60 Ko chacun) expirent seuls (90 jours par défaut). Pour les effacer tout de suite : onglet **Actions** → un run → section **Artifacts** → icône corbeille. Pour raccourcir la durée de conservation de tous les futurs artefacts et journaux : **Settings** du dépôt → **Actions** → **General** → **Artifact and log retention**.

## 2. Dossiers sur le NAS

1. Dans File Station (ou en SSH), créer :
   - `/volume1/docker/psn-tracker/postgres`
   - `/volume1/docker/psn-tracker/media`
   - `/volume1/docker/psn-tracker/nginx`
2. Copier `deploy/nginx/default.conf` du dépôt dans `/volume1/docker/psn-tracker/nginx/default.conf`.
3. Donner les droits d'écriture au dossier `media` pour l'utilisateur du conteneur (`node`, uid 1000). En SSH :

   ```sh
   sudo chown -R 1000:1000 /volume1/docker/psn-tracker/media
   ```

## 3. Réseau Docker

Créer une fois le réseau partagé par les deux stacks :

- Portainer → **Networks → Add network** : nom `psn-net`, driver `bridge` ; ou
- en SSH : `sudo docker network create psn-net`.

Ensuite, vérifier son adresse (le « sous-réseau ») : Portainer → **Networks** → `psn-net`, colonne **IPV4 IPAM Subnet** ; ou en SSH `sudo docker network inspect psn-net`. Elle doit commencer par `172.16.` à `172.31.`.

- Si c'est le cas, il n'y a rien à faire : `default.conf` fait déjà confiance à `172.16.0.0/12`, qui couvre toutes ces adresses.
- Sinon (par exemple `10.x.x.x` ou `192.168.x.x`), ouvrir `/volume1/docker/psn-tracker/nginx/default.conf` sur le NAS et remplacer `172.16.0.0/12` par ce sous-réseau, puis redémarrer le conteneur `nginx` (seulement si la stack `infra` tourne déjà : à cette étape elle n'existe pas encore, elle est créée à l'étape 5, et nginx lira alors le fichier modifié). Sans cela, nginx ne reconnaît pas le proxy DSM : toutes les connexions sembleraient venir de la même adresse, et la limite de tentatives de connexion bloquerait tout le monde.

## 4. Secrets

Préparez trois valeurs :

1. `APP_SECRET` (32 octets aléatoires) :

   ```sh
   openssl rand -base64 32
   ```

2. `ADMIN_PASSWORD_HASH` : sur votre PC, dans le dépôt :

   ```sh
   npm run hash-password -- "<votre mot de passe>"
   ```

   Le hash bcrypt contient des `$` (forme `$2b$12$...`). Docker Compose interprète `$` comme une variable : dans les variables d'environnement de la stack Portainer, **écrivez chaque `$` du hash en `$$`**. Exemple avec un faux hash : `$2b$12$AbCdEf...` devient `$$2b$$12$$AbCdEf...`. Symptôme si c'est faux : « Wrong username or password. » même avec le bon mot de passe. Dans un fichier `.env`/`.env.local` en local, il faut au contraire échapper chaque `$` en `\$`.
3. `POSTGRES_PASSWORD` : un mot de passe fort au choix (évitez les caractères `@`, `:`, `/`, `#` qui cassent l'URL de connexion ; préférez des lettres et chiffres).

## 5. Stacks Portainer

1. **Stacks → Add stack**, nom `psn-infra`. Coller le contenu de `deploy/stack-infra.yml` (Web editor), ou utiliser l'option *Repository* (dépôt privé : il faut alors un token avec accès au code). Variable d'environnement : `POSTGRES_PASSWORD`. **Deploy the stack.** Vérifier que `postgres` est « healthy » et `nginx` démarré.
2. **Stacks → Add stack**, nom `psn-site`. Coller `deploy/stack-site.yml`. Variables d'environnement : `POSTGRES_PASSWORD` (même valeur), `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, `APP_SECRET`. **Deploy the stack.** Au bout d'une trentaine de secondes, `app` doit passer à « healthy » dans Portainer (Containers, colonne *Status*) : « starting » au début, puis « healthy ». Ce voyant demande `/login` à l'app toutes les 30 s ; la page d'attente « Updating… » (étape 7, point 4) compte comme pas bonne, donc `app` reste « unhealthy » tant que le worker n'a pas fini de migrer. Si `app` reste « unhealthy », voir l'étape 9.
3. Les conteneurs `app` et `worker` tournent sans aucun privilège Linux (`cap_drop: ALL`, `no-new-privileges`) : le dossier `media` doit donc bien appartenir à l'uid 1000 (étape 2, point 3). Chaque conteneur a aussi une limite de mémoire et une priorité processeur déjà écrites dans les fichiers des stacks : rien à régler, mais voir le point 12 de l'étape 7 pour les vérifier.
4. Le worker applique les migrations au démarrage. Vérifier les logs du conteneur `worker` (`[worker] started`).

## 6. Reverse proxy DSM

1. **Panneau de configuration → Portail de connexion → Avancé → Proxy inversé → Créer** :
   - Source : protocole **HTTPS**, nom d'hôte `psn.<votre-nom>.synology.me`, port **443**.
   - Destination : protocole **HTTP**, nom d'hôte `127.0.0.1`, port **8080** (pas `localhost`, qui peut se résoudre en `::1` alors que le port n'est publié que sur `127.0.0.1`).
2. Certificat : **Panneau de configuration → Sécurité → Certificat → Ajouter** → Let's Encrypt pour `psn.<votre-nom>.synology.me`, puis *Configurer* pour associer ce certificat à la règle de proxy.
3. Le site doit être servi **à la racine** du nom d'hôte (pas de sous-chemin comme `/psn`).
4. Vérification fonctionnelle : après connexion en HTTPS, le cookie `psnt_session` doit porter le drapeau **Secure** (outils du navigateur → Stockage/Application → Cookies, ou en-tête de réponse `Set-Cookie … Secure`). Sinon, ajoutez manuellement l'en-tête `X-Forwarded-Proto` (valeur `$scheme`) dans la règle DSM (onglet *En-têtes personnalisés* → Créer → personnalisé). Sans lui, le cookie n'est pas sécurisé.
5. Cocher **HSTS** dans la règle du proxy inversé (onglet **Général** de la règle). C'est DSM qui pose cet en-tête : il est le seul à voir le HTTPS, ni l'app ni nginx ne le posent. Conséquence : une fois l'en-tête reçu, le navigateur refuse le HTTP sur ce nom de domaine pendant longtemps. L'accès par l'adresse IP du NAS n'est pas concerné.
6. Redirection du port 443 de votre box vers le NAS si vous voulez y accéder depuis l'extérieur.

## 7. Premier démarrage

1. Ouvrir `https://psn.<votre-nom>.synology.me`, se connecter avec `ADMIN_USERNAME` et le mot de passe choisi.
2. Aller dans **Settings**, coller le `npsso` PSN (cookie obtenu en étant connecté sur playstation.com), enregistrer.
3. Suivre **Sync history** : la première synchronisation importe tous les jeux et peut durer un moment.

### Vérifications au premier déploiement

Ces points ne se vérifient que sur le NAS. Chaque point dit à quel moment le faire : certains tout de suite après la première synchro, d'autres pendant la synchro suivante ou à la prochaine mise à jour de la stack. Il n'y a pas d'ordre à suivre.

4. **Page d'attente au démarrage.** *Quand : à la prochaine mise à jour de la stack `psn-site` qui apporte une migration (étape 8). Au tout premier déploiement, le worker migre une base vide : la page peut ne jamais apparaître, c'est normal.* L'app peut démarrer avant que le worker ait appliqué les nouvelles migrations.
   - Ce qu'on doit voir : tant que le worker migre, le site affiche une page « Updating… » avec le texte « This page reloads by itself. ». Elle se recharge toutes les 5 s (code 503), puis le site normal revient seul.
   - Pas bon : une erreur 500, ou une page d'attente qui ne part jamais. Dans ce cas, lisez les logs du conteneur `worker`.
5. **En-têtes de protection.** *Quand : dès la première connexion.* Ouvrez le site dans le navigateur, puis les outils de développement (F12) → onglet **Réseau** → rechargez → cliquez sur la requête de la page → **En-têtes de réponse**.
   - Sur une page : `X-Frame-Options: DENY`, `Content-Security-Policy: frame-ancestors 'none'`, `Referrer-Policy: same-origin`, `X-Content-Type-Options: nosniff` et `Strict-Transport-Security` (posé par DSM, voir étape 6). Il ne doit y avoir aucun en-tête `X-Powered-By`.
   - Sur une image sous `/media/…` : `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; sandbox; frame-ancestors 'none'`, `X-Content-Type-Options: nosniff` et `Referrer-Policy: same-origin`. L'image s'affiche toujours normalement dans les pages.
   - Tous ces en-têtes sont posés par l'app, sauf `Strict-Transport-Security`, posé par DSM : il n'y a rien à régler dans nginx.
   - Pas bon : pas de `Strict-Transport-Security` (revoir la case HSTS de l'étape 6).
6. **Première synchro de cette version.** *Quand : une fois la première synchro terminée.*
   - Ce qu'on doit voir : toutes les listes de trophées PS5 sont rechargées une fois (migration 0005), donc la synchro est plus longue que d'habitude.
   - Dans **Settings**, la carte « Unobtainable trophies » montre « Up to date » et « 5 of yours » (migration 0006).
   - Dans les logs du conteneur `worker` (Portainer → Containers → `worker` → Logs), une synchro se termine par une ou deux lignes sur les images :
     - `[worker] images: N downloaded, N failed, N thumbnails, N tile colours` (téléchargées, en échec, miniatures créées, couleurs de tuile calculées). Les couleurs de tuile des images déjà téléchargées sont remplies à cette première synchro (migration 0008) ;
     - `[worker] images: N removed` (images inutilisées supprimées). Cette ligne n'apparaît qu'après une synchro sans aucun échec : après une synchro partielle ou en échec, le nettoyage ne tourne pas, c'est voulu, et c'est alors la ligne `[worker] images: cleanup skipped (N failures)` qui la remplace.
   - Aucune image ne doit manquer ensuite sur Games, une page de jeu, Plat Wall, Trophy Log, Trophy Advisor et Stats.
7. **Arrêt propre du worker.** *Quand : pendant la synchro suivante, ou en en déclenchant une avec « Sync now ».* Dès que **Sync history** montre un run en cours, arrêtez le conteneur `worker` dans Portainer (`docker stop`), puis relancez-le.
   - Ce qu'on doit voir : soit le log montre la fin de la synchro en cours, soit le run apparaît comme « Interrupted » dans **Sync history** au redémarrage.
8. **Trophy Log, « Show all ».** *Quand : après la première synchro.* Ouvrez Trophy Log et cliquez sur **Show all**.
   - Objectifs : premières lignes en moins de 1 s, page jamais figée plus de 250 ms, liste complète en moins de 5 s (la réponse fait environ 6 Mo de JSON avant compression).
   - Dans l'onglet **Réseau** (F12), la réponse de `/api/trophy-log?all=1` porte `Content-Encoding: gzip`, et sa taille transférée est bien plus petite que sa taille réelle (environ 6 Mo). Pas bon : pas de `Content-Encoding`, ou une taille transférée de plusieurs Mo (vérifier que `default.conf` du NAS est la dernière version, étape 8).
   - Si les premières lignes tardent, notez-le : il faudra demander d'abord les 300 premières lignes à part.
   - Ouvrez une page de jeu depuis la liste, puis revenez en arrière : vous devez retrouver la même ligne.
9. **Export PNG du Plat Wall.** *Quand : après la première synchro.* Ouvrez Plat Wall, cochez Art, Rarity et Name sur les 230 platines.
   - Le texte de l'image est en police Sora.
   - L'image est prête en moins de 60 s (limite de nginx : au-delà, erreur 504).
   - Sur un vrai iPhone, **Download PNG** enregistre le fichier. Le bouton ne devient actif qu'une fois l'image d'aperçu chargée (environ 20 millions de pixels avec les 230 platines).
10. **Page Stats sur écran tactile.** *Quand : après la première synchro.* Ouvrez Stats sur un téléphone et sur un Mac avec pavé tactile.
    - Au doigt : poser le doigt sur une colonne, une part d'anneau ou un jour affiche l'infobulle tant que le doigt reste posé. Un glissement vertical fait défiler la page.
    - « Games by release year » défile de côté (téléphone : glissement du doigt ; Mac : deux doigts), s'ouvre sur les années les plus récentes, et le glissement à deux doigts ne fait pas revenir à la page précédente du navigateur.
11. **Vraie adresse du client.** *Quand : dès la première connexion.* Ouvrez le site depuis le téléphone en données mobiles (pas en Wi-Fi), puis dans Portainer : **Containers → `nginx` → Logs**.
    - Ce qu'on doit voir : la ligne de votre visite montre l'adresse publique du téléphone.
    - Pas bon : `172.x.x.1` (l'adresse du pont Docker). nginx ne reconnaît alors pas le proxy DSM : revoyez l'étape 3 (sous-réseau de `psn-net`).
12. **Partage du NAS.** *Quand : pendant la première synchro, puis pendant un export PNG du Plat Wall (point 9).* Le NAS fait aussi tourner Plex, qBittorrent, Radarr, Sonarr et Homebridge : le PSN Tracker ne doit pas les ralentir. Ouvrez Portainer → **Containers**, cliquez sur un conteneur → **Stats** (mémoire et processeur en direct).
    - Limites de mémoire, écrites dans les fichiers des stacks (c'est un plafond, pas de la mémoire réservée) :

      | Conteneur | Limite |
      | --- | --- |
      | `app` | 768 Mo (tas de Node plafonné à 576 Mo) |
      | `worker` | 768 Mo (tas de Node plafonné à 576 Mo) |
      | `postgres` | 512 Mo |
      | `nginx` | 64 Mo |

      Au total, le PSN Tracker ne peut pas dépasser environ 2,1 Go. En mesure locale, le pic le plus lourd (export PNG Art, Rarity, Name sur 230 platines, ou miniatures de bannières 4K par le worker) est d'environ 440 Mo.
    - Priorité processeur : `app` et `worker` ont `cpu_shares: 512`. Quand Plex et le PSN Tracker veulent le processeur en même temps, Plex en reçoit deux fois plus. Il n'y a volontairement pas de plafond dur : beaucoup de noyaux Synology ne le gèrent pas et le conteneur refuserait de démarrer.
    - Ce qu'on doit voir : chaque conteneur du PSN Tracker reste sous sa limite dans **Stats**, et une vidéo lue sur Plex pendant la synchro et pendant l'export ne saccade pas.
    - Pas bon : un conteneur redémarre en plein export ou en pleine synchro (tué faute de mémoire : code de sortie 137 ou « OOMKilled » dans Portainer, **Containers** → le conteneur → **Inspect**). Relevez alors ensemble `mem_limit` et `--max-old-space-size` du conteneur concerné, comme décrit à l'étape 8, point 7. Si c'est Plex qui saccade, notez-le : il faudra baisser `cpu_shares` (par exemple 256).

## 8. Mises à jour

1. Pousser (ou fusionner) sur `main`.
2. Attendre que l'exécution GitHub Actions soit verte (onglet Actions) : l'image `latest` est alors republiée. Le travail `image` lance d'abord les conteneurs durcis contre une vraie base PostgreSQL, puis publie. Un travail `image` rouge veut dire que l'image n'a **pas** été publiée : ne mettez pas la stack à jour, lisez le journal du run.
3. Dans Portainer : **Stacks → `psn-site` → Update the stack → Re-pull image and redeploy**.
4. Si `deploy/nginx/default.conf` a changé, remplacez le fichier sur le NAS (`/volume1/docker/psn-tracker/nginx/default.conf`) puis redémarrez le conteneur `nginx` (Portainer → Containers → `nginx` → Restart). Il n'est pas dans l'image : il ne se met pas à jour tout seul. **La version qui apporte la compression gzip et les plages de confiance `127.0.0.0/8` et `172.16.0.0/12` le change : à faire à cette mise à jour**, puis refaire les points 5, 8 et 11 de l'étape 7.
5. **Cette version change aussi les deux fichiers de stacks**, `deploy/stack-site.yml` et `deploy/stack-infra.yml` (conteneurs durcis, limites de mémoire, priorité processeur, voyant de santé de `app`). Il faut mettre à jour **les deux stacks** dans Portainer : **Stacks → `psn-infra` → Editor**, remplacer le contenu par celui de `deploy/stack-infra.yml`, puis **Update the stack** ; même chose pour `psn-site` avec `deploy/stack-site.yml` (cochez **Re-pull image and redeploy**). Les variables d'environnement restent celles de l'étape 5. Ensuite, vérifiez que `app` passe à « healthy » (étape 5) et faites le point 12 de l'étape 7.
6. **Dependabot.** Une fois par semaine, Dependabot ouvre des Pull Requests groupées sur GitHub (dépendances npm, image de base Docker, GitHub Actions, et outils de lint de `tools/eslint`). Pour chacune : attendre que la CI soit verte (point 2), puis la fusionner vous-même sur GitHub. Pas besoin de branche `docs/…` pour elles. Une fois fusionnée, la mise à jour de la stack se fait comme ci-dessus (points 1 à 3).
7. **Relever les limites de mémoire.** Seulement si un conteneur redémarre pendant un export ou une synchro (code de sortie 137 / « OOMKilled », étape 7, point 12). Dans l'éditeur de la stack concernée (`psn-site` pour `app` et `worker`, `psn-infra` pour `postgres` et `nginx`), changez **les deux valeurs ensemble** : `mem_limit` (par exemple `768m` devient `1024m`) et, pour `app` et `worker`, `--max-old-space-size` à environ 75 % de la nouvelle limite (`576` devient `768`). Gardez toujours le tas plus petit que la limite, sinon Node n'a plus de marge et se fait tuer. Puis **Update the stack**. Ce sont des plafonds, pas de la mémoire réservée : les relever ne coûte rien tant que le conteneur n'en a pas besoin.

## 9. Dépannage

- **Erreur « Invalid Server Actions request » / origine refusée** : l'en-tête `Host` n'est pas transmis jusqu'à l'app. Vérifier que le proxy DSM conserve le nom d'hôte et que `default.conf` contient `proxy_set_header Host $host;` et `X-Forwarded-Host $host;`.
- **Erreur 413 (Request Entity Too Large)** sur l'envoi d'une bannière : limite `client_max_body_size 12m` dans `default.conf` (mise à jour du fichier sur le NAS + redémarrage de `nginx`). Le reverse proxy DSM n'impose pas de limite par défaut.
- **Le conteneur `app` reste « unhealthy »** (Portainer → Containers) : le voyant échoue si `/login` ne répond pas 200. Deux causes habituelles. (1) La page d'attente « Updating… » ne part pas : le worker n'a pas fini d'appliquer les migrations ou n'a pas démarré ; lisez les logs du conteneur `worker` (étape 7, point 4). (2) La base est injoignable : vérifier que `postgres` est « healthy » dans la stack `psn-infra`, que `POSTGRES_PASSWORD` est identique dans les deux stacks et que les deux conteneurs sont bien sur `psn-net` ; lisez aussi les logs de `app`. Si le dossier `media` n'appartient pas à l'uid 1000 (étape 2, point 3), `app` et `worker` n'arrivent pas à écrire les images, car ils n'ont aucun privilège.
- **Un conteneur redémarre en boucle ou s'arrête avec le code 137** : il dépasse sa limite de mémoire. Voir l'étape 7, point 12, et l'étape 8, point 7.
- **« Syncing… » bloqué** : regarder les logs du conteneur `worker` (Portainer → Containers → `worker` → Logs). Un `npsso` expiré (Settings) ou une erreur réseau PSN sont les causes habituelles.
- **`http://<ip-du-nas>:8080` ne répond pas** : voulu. Le port 8080 n'est publié que sur `127.0.0.1` du NAS (le proxy DSM y accède en local), afin qu'un appareil du réseau local ne puisse pas contourner le proxy et falsifier `X-Forwarded-For`. Utilisez l'adresse HTTPS. nginx ne fait confiance qu'au proxy DSM (adresses `127.0.0.0/8` et `172.16.0.0/12`) pour `X-Forwarded-For`. Une connexion qui échoue sur l'adresse HTTPS signale plutôt un `ADMIN_PASSWORD_HASH` mal échappé (voir étape 4).
