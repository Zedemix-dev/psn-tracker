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
2. **Stacks → Add stack**, nom `psn-site`. Coller `deploy/stack-site.yml`. Variables d'environnement : `POSTGRES_PASSWORD` (même valeur), `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, `APP_SECRET`. **Deploy the stack.**
3. Le worker applique les migrations au démarrage. Vérifier les logs du conteneur `worker` (`[worker] started`).

## 6. Reverse proxy DSM

1. **Panneau de configuration → Portail de connexion → Avancé → Proxy inversé → Créer** :
   - Source : protocole **HTTPS**, nom d'hôte `psn.<votre-nom>.synology.me`, port **443**.
   - Destination : protocole **HTTP**, nom d'hôte `127.0.0.1`, port **8080** (pas `localhost`, qui peut se résoudre en `::1` alors que le port n'est publié que sur `127.0.0.1`).
2. Certificat : **Panneau de configuration → Sécurité → Certificat → Ajouter** → Let's Encrypt pour `psn.<votre-nom>.synology.me`, puis *Configurer* pour associer ce certificat à la règle de proxy.
3. Le site doit être servi **à la racine** du nom d'hôte (pas de sous-chemin comme `/psn`).
4. Vérification fonctionnelle : après connexion en HTTPS, le cookie `psnt_session` doit porter le drapeau **Secure** (outils du navigateur → Stockage/Application → Cookies, ou en-tête de réponse `Set-Cookie … Secure`). Sinon, ajoutez manuellement l'en-tête `X-Forwarded-Proto` (valeur `$scheme`) dans la règle DSM (onglet *En-têtes personnalisés* → Créer → personnalisé). Sans lui, le cookie n'est pas sécurisé.
5. Redirection du port 443 de votre box vers le NAS si vous voulez y accéder depuis l'extérieur.

## 7. Premier démarrage

1. Ouvrir `https://psn.<votre-nom>.synology.me`, se connecter avec `ADMIN_USERNAME` et le mot de passe choisi.
2. Aller dans **Settings**, coller le `npsso` PSN (cookie obtenu en étant connecté sur playstation.com), enregistrer.
3. Suivre **Sync history** : la première synchronisation importe tous les jeux et peut durer un moment.

### Vérifications au premier déploiement

Ces points ne se vérifient que sur le NAS. Faites-les dans l'ordre, une fois la première synchro terminée.

4. **Page d'attente au démarrage.** Quand vous mettez la stack `psn-site` à jour (étape 8), l'app peut démarrer avant que le worker ait appliqué les nouvelles migrations.
   - Ce qu'on doit voir : tant que le worker migre, le site affiche une page « Updating… » avec le texte « This page reloads by itself. ». Elle se recharge toutes les 5 s (code 503), puis le site normal revient seul.
   - Pas bon : une erreur 500, ou une page d'attente qui ne part jamais. Dans ce cas, lisez les logs du conteneur `worker`.
5. **En-têtes de protection.** Ouvrez le site dans le navigateur, puis les outils de développement (F12) → onglet **Réseau** → rechargez → cliquez sur la requête de la page → **En-têtes de réponse**.
   - Sur une page : `X-Frame-Options: DENY` et `Content-Security-Policy: frame-ancestors 'none'`.
   - Sur une image sous `/media/…` : `Content-Security-Policy` avec `sandbox`, et `X-Content-Type-Options: nosniff`. L'image s'affiche toujours normalement dans les pages.
   - Ces en-têtes sont posés par l'app : il n'y a rien à régler dans nginx ni dans DSM.
6. **Première synchro de cette version.**
   - Ce qu'on doit voir : toutes les listes de trophées PS5 sont rechargées une fois (migration 0005), donc la synchro est plus longue que d'habitude.
   - Dans **Settings**, la carte « Unobtainable trophies » montre « Up to date » et « 5 of yours » (migration 0006).
   - Dans les logs du conteneur `worker` (Portainer → Containers → `worker` → Logs), une synchro propre se termine par des lignes `[worker] images: … removed` (images inutilisées supprimées) et le nombre de miniatures créées. Après une synchro partielle ou en échec, le nettoyage ne tourne pas : c'est voulu.
   - Aucune image ne doit manquer ensuite sur Games, une page de jeu, Plat Wall, Trophy Log, Trophy Advisor et Stats.
7. **Arrêt propre du worker.** Dans Portainer, arrêtez le conteneur `worker` (`docker stop`) pendant une synchro, puis relancez-le.
   - Ce qu'on doit voir : soit le log montre la fin de la synchro en cours, soit le run apparaît comme « Interrupted » dans **Sync history** au redémarrage.
8. **Trophy Log, « Show all ».** Ouvrez Trophy Log et cliquez sur **Show all**.
   - Objectifs : premières lignes en moins de 1 s, page jamais figée plus de 250 ms, liste complète en moins de 5 s (la réponse fait environ 5 Mo de JSON).
   - Si les premières lignes tardent, notez-le : il faudra demander d'abord les 300 premières lignes à part.
   - Ouvrez une page de jeu depuis la liste, puis revenez en arrière : vous devez retrouver la même ligne.
9. **Export PNG du Plat Wall.** Ouvrez Plat Wall, cochez Art, Rarity et Name sur les 230 platines.
   - Le texte de l'image est en police Sora.
   - L'image est prête en moins de 60 s (limite de nginx : au-delà, erreur 504).
   - Sur un vrai iPhone, **Download PNG** enregistre le fichier. Le bouton ne devient actif qu'une fois l'image d'aperçu chargée (environ 20 millions de pixels avec les 230 platines).
10. **Page Stats sur écran tactile.** Ouvrez Stats sur un téléphone et sur un Mac avec pavé tactile.
    - Au doigt : poser le doigt sur une colonne, une part d'anneau ou un jour affiche l'infobulle tant que le doigt reste posé. Un glissement vertical fait défiler la page.
    - « Games by release year » défile de côté (téléphone : glissement du doigt ; Mac : deux doigts), s'ouvre sur les années les plus récentes, et le glissement à deux doigts ne fait pas revenir à la page précédente du navigateur.

## 8. Mises à jour

1. Pousser (ou fusionner) sur `main`.
2. Attendre que l'exécution GitHub Actions soit verte (onglet Actions) : l'image `latest` est alors republiée.
3. Dans Portainer : **Stacks → `psn-site` → Update the stack → Re-pull image and redeploy**. (Si `default.conf` change, remplacez le fichier sur le NAS puis redémarrez le conteneur `nginx`.)

## 9. Dépannage

- **Erreur « Invalid Server Actions request » / origine refusée** : l'en-tête `Host` n'est pas transmis jusqu'à l'app. Vérifier que le proxy DSM conserve le nom d'hôte et que `default.conf` contient `proxy_set_header Host $host;` et `X-Forwarded-Host $host;`.
- **Erreur 413 (Request Entity Too Large)** sur l'envoi d'une bannière : limite `client_max_body_size 12m` dans `default.conf` (mise à jour du fichier sur le NAS + redémarrage de `nginx`). Le reverse proxy DSM n'impose pas de limite par défaut.
- **« Syncing… » bloqué** : regarder les logs du conteneur `worker` (Portainer → Containers → `worker` → Logs). Un `npsso` expiré (Settings) ou une erreur réseau PSN sont les causes habituelles.
- **`http://<ip-du-nas>:8080` ne répond pas** : voulu. Le port 8080 n'est publié que sur `127.0.0.1` du NAS (le proxy DSM y accède en local), afin qu'un appareil du réseau local ne puisse pas contourner le proxy et falsifier `X-Forwarded-For`. Utilisez l'adresse HTTPS. Une connexion qui échoue sur l'adresse HTTPS signale plutôt un `ADMIN_PASSWORD_HASH` mal échappé (voir étape 4).
