# Déploiement sur le NAS Synology (Portainer)

Guide pas à pas. Architecture : le reverse proxy DSM (HTTPS) → conteneur `nginx` (port 8080) → conteneur `app` (Next.js, port 3000). Le conteneur `worker` synchronise les trophées, `postgres` stocke les données.

Deux stacks Portainer : **infra** (`stack-infra.yml` : postgres + nginx) et **site** (`stack-site.yml` : app + worker).

## 1. GitHub

1. Le dépôt `Zedemix-dev/psn-tracker` est **privé**. GitHub Actions est activé par défaut : rien à configurer.
2. Après le premier push sur `main`, le workflow « CI » construit l'image et la publie. Elle apparaît dans l'onglet **Packages** du dépôt (`ghcr.io/zedemix-dev/psn-tracker`, étiquettes `latest` et `sha-<court>`).
3. Portainer doit pouvoir télécharger l'image. Deux options :
   - **Package privé (recommandé)** : créer un *Personal Access Token (classic)* sur GitHub (Settings → Developer settings → Personal access tokens → Tokens (classic)) avec **uniquement** la permission `read:packages`. Puis dans Portainer : **Registries → Add registry → Custom registry** (ou GitHub/GHCR), URL `ghcr.io`, avec authentification : nom d'utilisateur GitHub + le token.
   - **Package public** : sur la page du package → Package settings → Change visibility → Public. Aucun token n'est alors nécessaire (mais l'image est visible de tous : elle ne contient aucun secret, ceux-ci sont dans les variables d'environnement).
4. Quotas gratuits : pour un dépôt privé, GitHub Actions offre un nombre limité de minutes par mois et GHCR un espace de stockage limité (les plafonds exacts sont sur la page de facturation GitHub). Chaque push lance les tests ; l'image n'est publiée que sur `main`. Pour économiser le stockage, ne gardez que les dernières versions de l'image (page du package → supprimer les anciennes versions, en conservant les 3 à 5 dernières).

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

   Le hash bcrypt contient des `$` (par exemple `$2b$12$...`). Docker Compose interprète `$` comme une variable : si Portainer utilise la valeur dans un fichier compose avec interpolation, **chaque `$` doit être doublé** (`$$2b$$12$$...`). Si la valeur est saisie dans l'éditeur de variables d'environnement de Portainer (« Environment variables » de la stack), la valeur est substituée telle quelle : testez la connexion, et si elle échoue doublez les `$`. Dans un fichier `.env`/`.env.local` en local, il faut les échapper en `\$`.
3. `POSTGRES_PASSWORD` : un mot de passe fort au choix (évitez les caractères `@`, `:`, `/`, `#` qui cassent l'URL de connexion ; préférez des lettres et chiffres).

## 5. Stacks Portainer

1. **Stacks → Add stack**, nom `psn-infra`. Coller le contenu de `deploy/stack-infra.yml` (Web editor), ou utiliser l'option *Repository* (dépôt privé : il faut alors un token avec accès au code). Variable d'environnement : `POSTGRES_PASSWORD`. **Deploy the stack.** Vérifier que `postgres` est « healthy » et `nginx` démarré.
2. **Stacks → Add stack**, nom `psn-site`. Coller `deploy/stack-site.yml`. Variables d'environnement : `POSTGRES_PASSWORD` (même valeur), `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, `APP_SECRET`. **Deploy the stack.**
3. Le worker applique les migrations au démarrage. Vérifier les logs du conteneur `worker` (`[worker] started`).

## 6. Reverse proxy DSM

1. **Panneau de configuration → Portail de connexion → Avancé → Proxy inversé → Créer** :
   - Source : protocole **HTTPS**, nom d'hôte `psn.<votre-nom>.synology.me`, port **443**.
   - Destination : protocole **HTTP**, nom d'hôte `localhost`, port **8080**.
2. Certificat : **Panneau de configuration → Sécurité → Certificat → Ajouter** → Let's Encrypt pour `psn.<votre-nom>.synology.me`, puis *Configurer* pour associer ce certificat à la règle de proxy.
3. Le site doit être servi **à la racine** du nom d'hôte (pas de sous-chemin comme `/psn`).
4. DSM ajoute par défaut les en-têtes `X-Forwarded-Proto` et `X-Forwarded-For` : vérifiez dans la règle → *En-têtes personnalisés*. Sans `X-Forwarded-Proto: https`, le cookie de session n'est pas marqué sécurisé ; sans `X-Forwarded-For`, l'adresse IP du client est fausse.
5. Redirection du port 443 de votre box vers le NAS si vous voulez y accéder depuis l'extérieur.

## 7. Premier démarrage

1. Ouvrir `https://psn.<votre-nom>.synology.me`, se connecter avec `ADMIN_USERNAME` et le mot de passe choisi.
2. Aller dans **Settings**, coller le `npsso` PSN (cookie obtenu en étant connecté sur playstation.com), enregistrer.
3. Suivre **Sync history** : la première synchronisation importe tous les jeux et peut durer un moment.

## 8. Mises à jour

1. Pousser (ou fusionner) sur `main`.
2. Attendre que l'exécution GitHub Actions soit verte (onglet Actions) : l'image `latest` est alors republiée.
3. Dans Portainer : **Stacks → `psn-site` → Update the stack → Re-pull image and redeploy**. (Si `default.conf` change, remplacez le fichier sur le NAS puis redémarrez le conteneur `nginx`.)

## 9. Dépannage

- **Erreur « Invalid Server Actions request » / origine refusée** : l'en-tête `Host` n'est pas transmis jusqu'à l'app. Vérifier que le proxy DSM conserve le nom d'hôte et que `default.conf` contient `proxy_set_header Host $host;` et `X-Forwarded-Host $host;`.
- **Erreur 413 (Request Entity Too Large)** sur l'envoi d'une bannière : limite `client_max_body_size 12m` dans `default.conf` (mise à jour du fichier sur le NAS + redémarrage de `nginx`). Le reverse proxy DSM n'impose pas de limite par défaut.
- **« Syncing… » bloqué** : regarder les logs du conteneur `worker` (Portainer → Containers → `worker` → Logs). Un `npsso` expiré (Settings) ou une erreur réseau PSN sont les causes habituelles.
- **Échec de connexion en visitant `http://<ip-du-nas>:8080`** : normal si le cookie de session est marqué sécurisé (il n'est accepté que via HTTPS). Utilisez l'adresse HTTPS du proxy DSM. Un échec de connexion sur l'adresse HTTPS signale plutôt un `ADMIN_PASSWORD_HASH` mal échappé (voir étape 4).
