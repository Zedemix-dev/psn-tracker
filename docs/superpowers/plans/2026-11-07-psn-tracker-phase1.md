# PSN Tracker — Phase 1 (socle, accueil, Settings, déploiement) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** construire le site personnel de trophées PSN de Zmx969 : synchro PSN fiable vers Postgres, page principale « Games » conforme à la maquette v12, page Settings, et déploiement sur le Synology via deux stacks Portainer et une image construite par GitHub Actions.

**Architecture :**
- Une seule application Next.js (App Router, React Server Components qui lisent Postgres via Drizzle) fournit **une seule image Docker**, lancée de deux façons :
  - `app` sert le site ;
  - `worker` exécute **toutes** les synchros, qu'elles viennent du minuteur de 6 h, des tâches quotidiennes ou du bouton « Sync now ».
- L'app ne parle jamais au PSN. Elle dépose une demande en base, et le worker la traite.
- Tout le code qui touche au PSN passe par une interface `PsnGateway`, que les tests remplacent par un faux.

**Tech Stack :** Node.js 22 LTS, TypeScript strict, Next.js (dernière version stable, App Router, `output: "standalone"`), React 19, Drizzle ORM + drizzle-kit, `postgres` (postgres.js) en prod, `@electric-sql/pglite` pour les tests et le dev local, `psn-api`, `bcryptjs`, `zod`, Vitest + @testing-library/react + jsdom, esbuild (bundle du worker), Docker, GitHub Actions, GHCR, nginx, PostgreSQL 16.

**Spec :** [docs/superpowers/specs/2026-11-07-psn-tracker-design.md](../specs/2026-11-07-psn-tracker-design.md). Maquette de référence : [2026-11-07-psn-tracker-maquette-accueil.html](../specs/2026-11-07-psn-tracker-maquette-accueil.html) (v12). **Tout le CSS des composants se porte depuis cette maquette** : mêmes règles, mêmes valeurs.

**Hors de ce plan :** la page de détail d'un jeu (spec 8.9). Sa maquette doit d'abord être faite et validée, puis elle aura son propre plan. Ici, les lignes de jeux mènent déjà à `/games/[id]`, qui affiche pour l'instant une page provisoire.

**Prérequis sur le PC de dev (à faire par l'utilisateur) :**
- installer Node.js 22 LTS : `winget install OpenJS.NodeJS.LTS`, ou l'installeur de nodejs.org ;
- avoir Git.
- Docker n'est pas nécessaire en local : les tests et le dev tournent sur PGlite, et l'image est construite par GitHub Actions.

## Global Constraints

- Interface **100 % en anglais**, noms de jeux et de trophées compris. L'API PSN est appelée avec `Accept-Language` = `PSN_LANGUAGE`, qui vaut `en-GB` par défaut.
- **Dates :**
  - absolues au format `5 Nov 2026, 00:16` (24 h, fuseau `Europe/Paris`), ou `5 Nov 2026` sans l'heure ;
  - noms de mois fixes : `Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec`.
- **Nombres :** `11,622`, `93.74%`, `19,416 h`. Durées de jeu : `33h 27m`, `11h 00m`, `3m`.
- Plateformes : uniquement PS4 et PS5. Ignorer PC et Vita dans les badges et les filtres.
- Tout le site est derrière une connexion, avec un seul compte. Seules `/login` et les fichiers statiques de Next sont publics.
- **Synchros :**
  - automatique toutes les **6 heures** ; manuelle via « Sync now » ;
  - **une seule à la fois** ;
  - rafraîchissement des raretés **et** revérification des groupes DLC de tous les jeux **une fois par jour**.
- **Images PSN stockées en local** (volume `MEDIA_DIR`) et servies par le site.
- **Aucune sauvegarde ni export** dans l'application.
- **Catégories de rareté :** Ultra rare < 5 %, Very rare 5–10 %, Rare 10–20 %, Uncommon 20–50 %, Common ≥ 50 %.
- **Exclusions des chiffres :**
  - les jeux masqués (`hiddenFlag`) sont exclus de la liste et de tous les chiffres ;
  - quand « Hide 0% games » est actif, les jeux à progression 0 sont exclus de la liste et de toutes les stats.
- **Mise en page :**
  - contenu de 1 400 px ; colonne latérale de 450 px ;
  - bannière au format 1920 × 520, bornée entre 240 et 560 px de haut ;
  - police Sora (300–700) ;
  - jetons de couleur de la maquette : `--bg:#0F1631`, `--text:#F3F5FB`, `--muted:#A9B3CB`, `--accent:#5AA9FF`, `--plat:#D3E2FF`, `--gold:#F2C462`, `--silver:#C9D0DA`, `--bronze:#DE9563`.
- **Couleur des barres de progression des jeux, selon la complétion :**
  - 100 % → S `#667FB2` ; 80–99 % → A `#008000` ; 60–79 % → B `#7B9E00` ;
  - 40–59 % → C `#A68E00` ; 20–39 % → D `#A66A00` ; 1–19 % → E `#FF4100` ;
  - 0 % → F `#EE0000`, appliquée au fond de la barre, à 38 %.
- Jamais de « … » sur les noms des listes latérales, ni sur les trois lignes des lignes de jeux.
- **Déploiement :**
  - deux stacks Portainer : « site » (app + worker) et « infra » (postgres + nginx) ;
  - HTTPS assuré par le reverse proxy de DSM ;
  - site servi à la racine de son adresse ;
  - image `linux/amd64` publiée sur GHCR.
- Travailler sur une branche (`feat/phase1`). **Pousser sur GitHub après chaque tâche** : l'utilisateur change de PC.

## Review Focus

1. **Jeu de plus de 256 trophées** : toutes les pages de `getTitleTrophies` et `getUserTrophiesEarnedForTitle` doivent être chargées. C'est la raison d'être du projet. Test dans la tâche 7 (`loads every page of a 300-trophy title`).
2. **Trophées obtenus à la même seconde**, comme le platine de Magicka 2 et son dernier argent : la numérotation des milestones doit rester stable, avec le platine compté en dernier. Test dans la tâche 12 (`numbers same-second trophies with the platinum last`).
3. **NPSSO expiré pendant une synchro** : la synchro passe en `error`, `psnAuthStatus` passe à `expired`, et les données déjà en base restent intactes. Test dans la tâche 10 (`marks auth expired and keeps data when refresh fails`).
4. **Jeu jamais synchronisé côté PSN** : l'appel par utilisateur lève « Resource Not Found ». Ce jeu est ignoré pour cette synchro, sans faire échouer les autres. Test dans la tâche 10 (`skips a title whose user trophies are not found`).
5. **Rareté absente** (`trophyEarnedRate` vide sur un jeu tout neuf) : le trophée n'entre ni dans la rareté moyenne, ni dans les plus rares, ni dans le décompte par catégorie, au lieu d'y compter pour 0 %. Test dans la tâche 12 (`ignores trophies without rarity`).

---

## Structure des fichiers

```
package.json · tsconfig.json · next.config.ts · vitest.config.ts · drizzle.config.ts · .env.example
Dockerfile · .dockerignore · .github/workflows/docker.yml
deploy/stack-site.yml · deploy/stack-infra.yml · deploy/nginx/default.conf · deploy/README.md
public/icons/trophy-{platinum,gold,silver,bronze}.png · public/icons/level-sprite.png
src/lib/      config.ts · format.ts · rarity.ts · crypto.ts
src/db/       schema.ts · client.ts · migrate.ts · migrations/ (générées)
src/settings/ repo.ts
src/auth/     password.ts · sessions.ts · rate-limit.ts · require-session.ts
src/psn/      types.ts · gateway.ts · tokens.ts
src/sync/     diff.ts · title.ts · played.ts · images.ts · run.ts · daily.ts · requests.ts
src/worker/   scheduler.ts · index.ts
src/stats/    profile-stats.ts · milestones.ts · trophies.ts
src/games/    query.ts · row.ts
src/cabinet/  repo.ts
middleware.ts
app/layout.tsx · app/globals.css · app/login/(page.tsx, actions.ts)
app/(site)/layout.tsx · app/(site)/page.tsx · app/(site)/settings/(page.tsx, actions.ts)
app/(site)/[section]/page.tsx (Coming soon) · app/(site)/games/[id]/page.tsx (provisoire)
app/api/games/route.ts · app/api/sync/route.ts · app/api/trophies/search/route.ts · app/media/[...path]/route.ts
components/   TopMenu · Banner · AuthBanner · ProfileBand · StatTiles · SyncButton · TrophyCarousel
              GameList · GameRow · GameFilters · HideZeroToggle · CabinetPanel · CabinetEditor
              RarestPanel · MilestonesPanel · ComingSoon · TrophyTypeIcon   (chacun .tsx + .module.css)
tests/helpers/db.ts · tests/fakes/psn.ts · tests/fixtures/*.ts
scripts/hash-password.ts · scripts/seed-dev.ts
```

---

### Task 1 : Squelette du projet et configuration

**Files :**
- Create : `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `.env.example`, `app/layout.tsx`, `app/globals.css`, `src/lib/config.ts`
- Test : `src/lib/config.test.ts`

**Interfaces :**
- Produces :
  - `getConfig(): AppConfig`, avec `AppConfig = { databaseUrl: string; adminUsername: string; adminPasswordHash: string; appSecret: Buffer /*32 octets*/; psnLanguage: string; mediaDir: string }` ;
  - les scripts npm `dev`, `build`, `test`, `db:generate`, `worker:dev`, `seed:dev`, `hash-password`.

- [ ] **Step 1 : initialiser le projet.**
  - Créer le projet : Next.js App Router, TypeScript strict, sans Tailwind.
  - `next.config.ts` : `output: "standalone"`.
  - Installer les dépendances de la Tech Stack.
  - `app/layout.tsx` charge Sora via `next/font/google` (poids 300 à 700, auto-hébergée au build).
  - `app/globals.css` reprend le bloc `:root` et les règles de base de la maquette (`*`, `body`, `body::before`, `.wrap` à `max-width:1448px`, `.glass`, `:focus-visible`).
  - `.env.example` liste `DATABASE_URL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, `APP_SECRET`, `PSN_LANGUAGE=en-GB`, `MEDIA_DIR=./.data/media`, `TZ=Europe/Paris`.
- [ ] **Step 2 : écrire le test qui échoue.**

```ts
describe("getConfig", () => {
  it("defaults the PSN language to en-GB", () => {
    expect(getConfigFrom({ ...validEnv, PSN_LANGUAGE: undefined }).psnLanguage).toBe("en-GB");
  });
  it("rejects an APP_SECRET that is not 32 bytes of base64", () => {
    expect(() => getConfigFrom({ ...validEnv, APP_SECRET: "short" })).toThrow(/APP_SECRET/);
  });
});
```

- [ ] **Step 3 :** `npx vitest run src/lib/config.test.ts` → FAIL (module absent).
- [ ] **Step 4 : implémenter dans `src/lib/config.ts`.**
  - Implémenter `getConfigFrom(env: Record<string,string|undefined>): AppConfig` et `getConfig()` (mémoïsé, sur `process.env`).
  - Utiliser un schéma zod, et faire en sorte que le message d'erreur nomme la variable fautive.
- [ ] **Step 5 :** `npx vitest run` → PASS. `npm run build` → succès.
- [ ] **Step 6 :** commit `chore: scaffold Next.js app with config` + push.

### Task 2 : Formats et raretés

**Files :** Create `src/lib/format.ts`, `src/lib/rarity.ts` · Test `src/lib/format.test.ts`, `src/lib/rarity.test.ts`

**Interfaces :**
- Produces :
  - `formatDateTime(d: Date): string` ;
  - `formatDate(d: Date): string` ;
  - `formatInt(n: number): string` ;
  - `formatPercent(n: number): string` ;
  - `formatPlayTime(seconds: number): string` ;
  - `formatHoursTotal(seconds: number): string` ;
  - `formatRelative(d: Date, now: Date): string` ;
  - `formatLastPlayedLine(lastPlayedAt: Date|null, playSeconds: number|null): string` ;
  - `rarityTier(rate: number): RarityTier`, avec `RarityTier = "Ultra rare"|"Very rare"|"Rare"|"Uncommon"|"Common"` ;
  - `RARITY_TIERS: RarityTier[]`, dans cet ordre.

- [ ] **Step 1 : écrire les tests qui échouent.**

```ts
it("formats Paris time, winter and summer", () => {
  expect(formatDateTime(new Date("2026-11-04T23:16:37Z"))).toBe("5 Nov 2026, 00:16");
  expect(formatDateTime(new Date("2026-10-11T22:09:43Z"))).toBe("12 Oct 2026, 00:09");
  expect(formatDate(new Date("2026-09-15T10:00:00Z"))).toBe("15 Sep 2026");
});
it("formats numbers", () => {
  expect(formatInt(11622)).toBe("11,622");
  expect(formatPercent(93.7419)).toBe("93.74%");
  expect(formatHoursTotal(19416 * 3600 + 1800)).toBe("19,416 h");
});
it("formats play time", () => {
  expect(formatPlayTime(33 * 3600 + 27 * 60 + 25)).toBe("33h 27m");
  expect(formatPlayTime(11 * 3600)).toBe("11h 00m");
  expect(formatPlayTime(187)).toBe("3m");
});
it("builds the third game line", () => {
  expect(formatLastPlayedLine(new Date("2026-11-05T10:00:00Z"), 120420)).toBe("Last played 5 Nov 2026 | 33h 27m played");
  expect(formatLastPlayedLine(new Date("2026-11-05T10:00:00Z"), null)).toBe("Last played 5 Nov 2026");
  expect(formatLastPlayedLine(null, null)).toBe("");
});
it("formats relative time like psnprofiles", () => {
  const now = new Date("2026-11-07T12:00:00Z");
  expect(formatRelative(new Date("2026-11-04T12:00:00Z"), now)).toBe("3 days ago");
  expect(formatRelative(new Date("2026-10-29T12:00:00Z"), now)).toBe("1 week ago");
  expect(formatRelative(new Date("2026-06-14T12:00:00Z"), now)).toBe("5 months ago");
  expect(formatRelative(new Date("2022-03-04T12:00:00Z"), now)).toBe("5 years ago");
  expect(formatRelative(new Date("2022-08-24T12:00:00Z"), now)).toBe("4 years ago");
});
it("maps rarity boundaries", () => {
  expect(rarityTier(4.99)).toBe("Ultra rare");  expect(rarityTier(5)).toBe("Very rare");
  expect(rarityTier(10)).toBe("Rare");          expect(rarityTier(20)).toBe("Uncommon");
  expect(rarityTier(49.99)).toBe("Uncommon");   expect(rarityTier(50)).toBe("Common");
});
```

- [ ] **Step 2 :** `npx vitest run src/lib` → FAIL.
- [ ] **Step 3 : implémenter.**
  - Les dates passent par `Intl.DateTimeFormat(...).formatToParts` avec `timeZone:"Europe/Paris"` et `hourCycle:"h23"`. Les noms de mois viennent du tableau fixe des Global Constraints : on n'utilise pas le nom de mois rendu par ICU, qui peut donner « Sept ».
  - Temps relatif, arrondi à l'entier le plus proche :
    - moins d'1 h → minutes ;
    - moins de 24 h → heures ;
    - moins de 7 jours → jours ;
    - moins de 30 jours → semaines ;
    - moins de 365 jours → mois (jours / 30,44) ;
    - au-delà → années (jours / 365,25).
  - Singulier pour 1 (« 1 week ago »).
- [ ] **Step 4 :** `npx vitest run src/lib` → PASS.
- [ ] **Step 5 :** commit `feat: add display formats and rarity tiers` + push.

### Task 3 : Schéma de base, client et migrations

**Files :** Create `drizzle.config.ts`, `src/db/schema.ts`, `src/db/client.ts`, `src/db/migrate.ts`, `src/db/migrations/*` (générées), `tests/helpers/db.ts` · Test `src/db/schema.test.ts`

**Interfaces :**
- Produces :
  - `type Db` (type Drizzle Postgres commun aux deux pilotes) ;
  - `createDb(url: string): Db` (`pglite:<chemin>` ou `pglite:memory` → PGlite, sinon postgres.js) ;
  - `getDb(): Db` ;
  - `runMigrations(db: Db): Promise<void>` ;
  - `createTestDb(): Promise<Db>`.
- Tables, en snake_case en base et en camelCase dans Drizzle :
  - `profile` : ligne unique `id=1` ; `accountId`, `onlineId`, `avatarUrl`, `level`, `levelProgress`, `tier`, `earnedPlatinum/Gold/Silver/Bronze`, `updatedAt` ;
  - `titles` :
    - clé primaire `npCommunicationId` ; `npServiceName`, `name`, `iconUrl`, `coverUrl` (nullable), `platforms text[]`, `trophySetVersion`, `hasTrophyGroups` ;
    - compteurs `definedPlatinum..Bronze`, `earnedPlatinum..Bronze` ;
    - `progress` (int 0-100), `hidden`, `lastTrophyAt`, `firstTrophyAt`, `playSeconds`, `playCount`, `lastPlayedAt` (nullables) ;
    - `syncedAt`, `groupsCheckedAt` ;
  - `trophyGroups` : clé primaire (`titleId`, `groupId`) ; `name`, `iconUrl`, compteurs définis ;
  - `trophies` :
    - clé primaire (`titleId`, `trophyId`) ; `groupId`, `type` (`platinum|gold|silver|bronze`), `name`, `detail`, `iconUrl`, `hidden`, `earned`, `earnedAt` ;
    - `earnedRate numeric(6,2)` nullable, `rareCategory` nullable, `progressTarget` nullable ;
    - index sur `earnedAt` ;
  - `playedGames` : clé primaire `npTitleId` ; `npCommunicationIds text[]` (null = pas encore relié), `name`, `imageUrl`, `playSeconds`, `playCount`, `firstPlayedAt`, `lastPlayedAt` ;
  - `images` : clé primaire `url` ; `localPath` nullable, `attempts`, `fetchedAt` ;
  - `syncRuns` : `id` serial, `kind` (`scheduled|manual|daily|first`), `status` (`running|success|error`), `startedAt`, `finishedAt`, `titlesTotal`, `titlesDone`, `trophiesUpdated`, `error` ;
  - `jobState` : clé primaire `key` ; `lastRunAt` ;
  - `settings` : ligne unique `id=1` ;
    - `hideZero` (false), `bannerPath`, `bannerPosY` (50) ;
    - `npssoEnc`, `npssoSetAt`, `refreshTokenEnc`, `refreshExpiresAt`, `accessTokenEnc`, `accessExpiresAt` ;
    - `psnAuthStatus` (`missing|valid|expired`, `missing` par défaut), `syncRequestedAt` ;
  - `cabinet` : clé primaire `position` (1..10, contrainte CHECK) ; `titleId`, `trophyId` ;
  - `sessions` : clé primaire `id` ; `createdAt`, `lastSeenAt`.

- [ ] **Step 1 : test qui échoue** (`it("applies migrations and seeds the singleton rows")`) : après `createTestDb()`, `select` sur `settings` renvoie exactement une ligne avec `hideZero === false` et `psnAuthStatus === "missing"`.
- [ ] **Step 2 :** `npx vitest run src/db` → FAIL.
- [ ] **Step 3 : implémenter.**
  - Écrire le schéma, puis lancer `npm run db:generate`.
  - Ajouter à la main une migration qui insère les lignes uniques de `settings` et de `profile`.
  - `createTestDb` crée une base PGlite en mémoire et y applique les migrations.
- [ ] **Step 4 :** `npx vitest run src/db` → PASS.
- [ ] **Step 5 :** commit `feat: database schema and migrations` + push.

### Task 4 : Chiffrement et dépôt des réglages

**Files :** Create `src/lib/crypto.ts`, `src/settings/repo.ts` · Test `src/lib/crypto.test.ts`, `src/settings/repo.test.ts`

**Interfaces :**
- Consumes : `Db`, `getConfig().appSecret`.
- Produces :
  - `encrypt(plain: string, key: Buffer): string` et `decrypt(token: string, key: Buffer): string` (AES-256-GCM, format `v1.<iv>.<tag>.<data>` en base64url) ;
  - `getSettings(db): Promise<Settings>` ;
  - `setHideZero(db, on: boolean)` ;
  - `setBanner(db, path: string|null, posY: number)` ;
  - `requestSync(db, now: Date)` ;
  - `takeSyncRequest(db): Promise<boolean>` (renvoie la demande en attente et l'efface) ;
  - `savePsnTokens(db, key, t: PsnTokens, npsso?: string, now?: Date)` ;
  - `loadPsnTokens(db, key): Promise<StoredPsnTokens|null>` ;
  - `setPsnAuthStatus(db, s)`.
  - `PsnTokens` vient de la tâche 6. La déclarer dès cette tâche dans `src/psn/types.ts` : `{ accessToken: string; accessExpiresAt: Date; refreshToken: string; refreshExpiresAt: Date }`.

- [ ] **Step 1 : tests qui échouent.**
  - `encrypt` puis `decrypt` redonne le texte d'origine.
  - Un jeton modifié d'un octet → `decrypt` lève une erreur.
  - Une clé différente → `decrypt` lève une erreur.
  - `savePsnTokens` avec un `npsso` → `npssoSetAt === now` et `psnAuthStatus === "valid"`, et la colonne `npsso_enc` ne contient pas le texte du NPSSO en clair.
  - `requestSync` puis deux appels à `takeSyncRequest` → `true`, puis `false`.
- [ ] **Step 2 :** FAIL.
- [ ] **Step 3 :** implémenter avec `node:crypto` (IV de 12 octets aléatoires).
- [ ] **Step 4 :** PASS.
- [ ] **Step 5 :** commit `feat: encrypted settings repository` + push.

### Task 5 : Connexion, sessions sans fin et limitation des tentatives

**Files :**
- Create : `src/auth/password.ts`, `src/auth/sessions.ts`, `src/auth/rate-limit.ts`, `src/auth/require-session.ts`, `middleware.ts`, `app/login/page.tsx`, `app/login/actions.ts`, `scripts/hash-password.ts`
- Test : `src/auth/*.test.ts`

**Interfaces :**
- Produces :
  - `verifyLogin(username, password, cfg): Promise<boolean>` (bcrypt) ;
  - `createSession(db, now): Promise<string>` (id aléatoire de 32 octets en base64url) ;
  - `validateSession(db, id, now): Promise<boolean>` (met à jour `lastSeenAt` si elle date de plus d'1 h) ;
  - `deleteAllSessions(db)` ;
  - `createLoginLimiter({ max: 5, windowMs: 15*60_000 })`, qui renvoie `{ check(ip, now): boolean; fail(ip, now): void; reset(ip): void }` ;
  - `requireSession(): Promise<void>` (redirige vers `/login`) ;
  - le nom du cookie, `SESSION_COOKIE = "psnt_session"`.
- Règles de la spec 5 :
  - cookie `httpOnly`, `sameSite:"lax"`, `maxAge` de 400 jours, **réémis à chaque requête** par `middleware.ts` (renouvellement glissant) ;
  - `secure` seulement si `x-forwarded-proto === "https"` ;
  - IP du client lue dans `x-real-ip`, posé par nginx (tâche 20).
- Textes :
  - titre « Sign in », champs « Username » et « Password », bouton « Sign in » ;
  - erreurs « Wrong username or password. » et « Too many attempts. Try again in 15 minutes. ».

- [ ] **Step 1 : tests qui échouent.**
  - Une session créée est validée.
  - Après `deleteAllSessions`, la même session ne l'est plus.
  - Le limiteur bloque à la 6e tentative dans la fenêtre de 15 minutes, et autorise à nouveau après 15 min et 1 s.
  - `verifyLogin` refuse un mauvais identifiant même avec le bon mot de passe.
- [ ] **Step 2 :** FAIL.
- [ ] **Step 3 : implémenter.**
  - `middleware.ts` : sans cookie → redirection vers `/login` (sauf pour `/login`, `/_next` et `/favicon.ico`) ; avec cookie → on laisse passer et on réémet le cookie.
  - `requireSession()` vérifie la session en base. On l'appelle dans `app/(site)/layout.tsx` et dans chaque route `app/api/*` et `app/media/*`.
  - `scripts/hash-password.ts` affiche le hash bcrypt du mot de passe passé en argument.
- [ ] **Step 4 :** PASS.
- [ ] **Step 5 : vérification manuelle.**
  - `npm run dev` avec `DATABASE_URL=pglite:./.data/dev`.
  - `/` redirige vers `/login`.
  - Un mauvais mot de passe affiche l'erreur.
  - Le bon mot de passe ouvre `/`.
- [ ] **Step 6 :** commit `feat: single-user login with sliding sessions` + push.

### Task 6 : Passerelle PSN et gestion des tokens

**Files :** Create `src/psn/types.ts` (compléter), `src/psn/gateway.ts`, `src/psn/tokens.ts`, `tests/fakes/psn.ts` · Test `src/psn/tokens.test.ts`, `src/psn/gateway.test.ts`

**Interfaces :**
- Produces : les types du domaine dans `types.ts`.
  - `TrophyType = "platinum"|"gold"|"silver"|"bronze"` ; `TrophyCounts = Record<TrophyType, number>` ; `TitleRef = { npCommunicationId: string; npServiceName: "trophy"|"trophy2" }` ;
  - `RemoteTitle = TitleRef & { name; iconUrl; platforms: string[]; trophySetVersion: string; hasTrophyGroups: boolean; defined: TrophyCounts; earned: TrophyCounts; progress: number; hidden: boolean; lastUpdatedAt: Date|null }` ;
  - `RemoteGroup = { groupId; name; iconUrl; defined: TrophyCounts }` ;
  - `RemoteTrophyDef = { trophyId: number; groupId; type: TrophyType; name; detail; iconUrl; hidden: boolean }` ;
  - `RemoteUserTrophy = { trophyId: number; earned: boolean; earnedAt: Date|null; earnedRate: number|null; rareCategory: number|null; progressTarget: string|null }` ;
  - `RemotePlayedGame = { npTitleId; name; imageUrl; playSeconds: number; playCount: number; firstPlayedAt: Date|null; lastPlayedAt: Date|null }` ;
  - `RemoteSummary = { accountId; level: number; levelProgress: number; tier: number; earned: TrophyCounts }` ; `RemoteProfile = { onlineId; avatarUrl }`.
- Produces : l'interface `PsnGateway` et ses deux implémentations, tous les appels étant authentifiés par `auth = { accessToken: string }`.
  - `exchangeNpsso(npsso): Promise<PsnTokens>` ;
  - `refresh(refreshToken): Promise<PsnTokens>` ;
  - `getSummary(auth): Promise<RemoteSummary>` ;
  - `getProfile(auth, accountId): Promise<RemoteProfile>` ;
  - `getTitles(auth): Promise<RemoteTitle[]>` ;
  - `getGroups(auth, t: TitleRef): Promise<RemoteGroup[]>` ;
  - `getTrophyDefs(auth, t): Promise<RemoteTrophyDef[]>` ;
  - `getUserTrophies(auth, t): Promise<RemoteUserTrophy[]>` ;
  - `getPlayedGames(auth): Promise<RemotePlayedGame[]>` ;
  - `mapNpTitleIds(auth, ids: string[]): Promise<Record<string, string[]>>` (renvoie `npTitleId` → liste de `npCommunicationId`) ;
  - `createPsnGateway(language: string): PsnGateway` (sur `psn-api`) ;
  - `createFakePsn(fixture): PsnGateway & { calls: string[] }`.
- Produces : la gestion des tokens.
  - `getValidAuth(db, gw, key, now): Promise<{ accessToken: string } | "expired" | "missing">` ;
  - `connectWithNpsso(db, gw, key, npsso, now): Promise<"ok"|"invalid">` ;
  - `NPSSO_PATTERN = /^[A-Za-z0-9]{64}$/`.

- [ ] **Step 1 : tests qui échouent.**
  - `getValidAuth` renvoie l'access token stocké s'il expire dans plus de 5 minutes.
  - Sinon, il appelle `refresh` et enregistre les nouveaux tokens.
  - Si `refresh` lève une erreur, il renvoie `"expired"` et met `psnAuthStatus` à `expired`.
  - `connectWithNpsso` renvoie `"invalid"` pour une chaîne de 63 caractères, sans appeler la passerelle.
  - Le test de la passerelle vérifie, avec un `fetch` remplacé, que chaque appel envoie `Accept-Language: en-GB` et que les appels par jeu transmettent le `npServiceName` du jeu.
- [ ] **Step 2 :** FAIL.
- [ ] **Step 3 : implémenter la passerelle.**
  - Correspondance avec `psn-api` (noms de la spec 6.3) :
    - `exchangeNpssoForAccessCode` puis `exchangeAccessCodeForAuthTokens` ; `exchangeRefreshTokenForAuthTokens` ;
    - `getUserTrophyProfileSummary("me")`, `getProfileFromAccountId`, `getUserTitles` ;
    - `getTitleTrophyGroups`, `getTitleTrophies(...,"all")`, `getUserTrophiesEarnedForTitle(...,"me",...,"all")` ;
    - `getUserPlayedGames`, `getUserTrophiesForSpecificTitle`.
  - Langue : si une fonction de `psn-api` n'accepte pas `headerOverrides`, l'appeler via la fonction bas niveau de la librairie, ou via `fetch` avec la même URL. Le test de l'en-tête fait foi.
  - Pagination :
    - **chaque** méthode de liste boucle sur `offset`/`nextOffset` jusqu'à `totalItemCount` ;
    - `getTitles` utilise `limit: 800` ;
    - `mapNpTitleIds` découpe les identifiants par paquets de 5.
  - Conversions : `trophyEarnedRate` (chaîne) → nombre, `null` si la valeur est vide ; `playDuration` ISO 8601 → secondes.
- [ ] **Step 4 :** PASS.
- [ ] **Step 5 :** commit `feat: PSN gateway and token handling` + push.

### Task 7 : Synchro d'un jeu (diff, trophées, DLC)

**Files :** Create `src/sync/diff.ts`, `src/sync/title.ts`, `tests/fixtures/titles.ts` · Test `src/sync/diff.test.ts`, `src/sync/title.test.ts`

**Interfaces :**
- Consumes : `PsnGateway`, `Db`.
- Produces :
  - `titleNeedsReload(stored: StoredTitleState|null, remote: RemoteTitle): boolean` ;
  - `syncTitle(db, gw, auth, remote: RemoteTitle, now): Promise<{ trophiesUpdated: number }>`, qui recharge les groupes, les définitions et l'état utilisateur, puis upsert le titre, ses groupes et ses trophées, et pose `syncedAt` et `groupsCheckedAt` ;
  - `upsertTitleRow(db, remote, now)`, utilisé aussi par la tâche 10.
- Règle de la spec 6.4 : `titleNeedsReload` vaut `true` si l'un de ces champs diffère : `lastUpdatedAt`, compteurs `earned`, compteurs `defined`, `trophySetVersion`, `hasTrophyGroups`. Il vaut aussi `true` si le jeu n'a jamais été vu.
- Fusion : définitions et état utilisateur sont rapprochés par `trophyId`.
  - Un trophée présent dans les définitions mais absent de l'état utilisateur est enregistré comme non obtenu, avec une rareté `null`.
  - `firstTrophyAt` et `lastTrophyAt` = la plus petite et la plus grande date d'obtention.

- [ ] **Step 1 : tests qui échouent.**
  - `titleNeedsReload` est `false` à l'identique.
  - Il est `true` quand seul `trophySetVersion` change : nouveau DLC sans aucun trophée obtenu.
  - Il est `true` quand seul `defined.bronze` change.
  - **`loads every page of a 300-trophy title`** : le faux renvoie 300 définitions et 300 états répartis sur 3 pages → 300 lignes dans `trophies` pour ce titre.
  - **`stores a new DLC group with zero earned`** : un titre à deux groupes, dont `001` sans aucun trophée obtenu → les 2 groupes sont en base, et les trophées de `001` ont `earned=false`.
- [ ] **Step 2 :** FAIL.
- [ ] **Step 3 :** implémenter. Les upserts passent par `onConflictDoUpdate`, dans une transaction par jeu.
- [ ] **Step 4 :** PASS.
- [ ] **Step 5 :** commit `feat: per-title sync with DLC detection` + push.

### Task 8 : Jeux joués, jaquettes et temps de jeu

**Files :** Create `src/sync/played.ts` · Test `src/sync/played.test.ts`

**Interfaces :**
- Consumes : `PsnGateway.getPlayedGames`, `mapNpTitleIds`.
- Produces : `syncPlayedGames(db, gw, auth): Promise<void>`.
  - Upsert de `playedGames`.
  - Seuls les `npTitleId` qui n'ont pas encore de correspondance sont reliés à leur liste de trophées : le résultat est mis en cache dans `npCommunicationIds`.
  - Pour chaque titre relié, mise à jour de `titles.coverUrl` (le `imageUrl` du jeu joué le plus récent), de `playSeconds` (somme), de `playCount` (somme) et de `lastPlayedAt` (le maximum).

- [ ] **Step 1 : tests qui échouent.**
  - Deux synchros d'affilée → `mapNpTitleIds` n'est appelé qu'à la première.
  - Deux jeux joués reliés au même titre → `playSeconds` est la somme et `lastPlayedAt` le maximum.
  - Un titre sans correspondance garde `coverUrl = null`.
- [ ] **Step 2 :** FAIL.
- [ ] **Step 3 :** implémenter.
- [ ] **Step 4 :** PASS.
- [ ] **Step 5 :** commit `feat: sync played games, covers and play time` + push.

### Task 9 : Images en local

**Files :** Create `src/sync/images.ts`, `app/media/[...path]/route.ts` · Test `src/sync/images.test.ts`

**Interfaces :**
- Produces :
  - `mediaSrc(url: string|null, cached: Map<string,string>): string` : `/media/psn/<sha256>.<ext>` si l'image est en cache, sinon `/icons/placeholder.svg` ;
  - `loadImageMap(db): Promise<Map<string,string>>` (`url` → chemin local) ;
  - `cacheImages(db, mediaDir, fetchImpl = fetch): Promise<{ downloaded: number; failed: number }>`.
- Règles :
  - toutes les URL d'images connues sont téléchargées : avatar, `iconUrl`/`coverUrl` des titres, icônes des groupes et des trophées ;
  - on ne retélécharge pas une image déjà en cache ;
  - un échec incrémente `attempts`, et on réessaie à la synchro suivante ;
  - si l'URL Sony change, c'est une nouvelle ligne.
  - La route `app/media/[...path]` exige une session, refuse toute tentative de remonter dans les dossiers (`..`), et répond avec `Cache-Control: private, max-age=31536000, immutable`.

- [ ] **Step 1 : tests qui échouent.**
  - Avec un `fetchImpl` simulé, une URL est téléchargée une seule fois sur deux appels.
  - Une réponse 404 donne `failed: 1` et `localPath` null.
  - `mediaSrc` d'une URL absente du cache renvoie `/icons/placeholder.svg`.
- [ ] **Step 2 :** FAIL.
- [ ] **Step 3 :** implémenter, avec 4 téléchargements en parallèle au maximum. Ajouter `public/icons/placeholder.svg` (carré `#2a3147`).
- [ ] **Step 4 :** PASS.
- [ ] **Step 5 :** commit `feat: local image cache and media route` + push.

### Task 10 : Orchestration d'une synchro et rafraîchissement quotidien

**Files :** Create `src/sync/run.ts`, `src/sync/daily.ts` · Test `src/sync/run.test.ts`, `src/sync/daily.test.ts`

**Interfaces :**
- Consumes : les tâches 4, 6, 7, 8 et 9.
- Produces : `runSync(db, gw, cfg, kind: SyncKind, now = new Date()): Promise<SyncRunResult>`.
  - Il prend `pg_try_advisory_lock(42)`. S'il ne l'obtient pas, il renvoie `{ status: "skipped" }`.
  - Il crée la ligne `syncRuns` en `running`.
  - Il récupère l'authentification avec `getValidAuth`. Si elle vaut `"expired"` ou `"missing"`, la synchro finit en `error`, avec le message « PSN token expired » ou « PSN token missing ».
  - Il met à jour le profil (`getSummary` + `getProfile`).
  - Il lit `getTitles`, puis lance `syncTitle` sur chaque titre pour lequel `titleNeedsReload` est vrai. Pour les autres, seule la ligne du titre est mise à jour.
  - Il fait avancer `titlesDone`, puis lance `syncPlayedGames` et `cacheImages`.
  - Il finit en `success`, ou en `error` avec le message de l'erreur.
  - Il libère toujours le verrou.
- Produces : `runDailyRefresh(db, gw, cfg, now)`, de type `daily`.
  - Pour **chaque** titre, il appelle `getUserTrophiesEarnedForTitle` et met à jour `earnedRate` et `rareCategory`.
  - Il appelle aussi `getGroups`. Si l'ensemble des `groupId` diffère de celui en base, il lance `syncTitle`.
  - Il pose `groupsCheckedAt`.
- `SyncKind = "scheduled"|"manual"|"daily"|"first"`. Le type est `first` quand la table `titles` est vide.

- [ ] **Step 1 : tests qui échouent.**
  - Un titre inchangé lors de la deuxième synchro → aucun appel à `getTrophyDefs` pour ce titre.
  - **`marks auth expired and keeps data when refresh fails`** : la base contient déjà 2 titres ; `refresh` lève une erreur → la synchro est en `error`, `psnAuthStatus` vaut `expired`, et les 2 titres sont intacts.
  - **`skips a title whose user trophies are not found`** : `getUserTrophies` lève « Resource Not Found » pour 1 titre sur 3 → la synchro est en `success`, les 2 autres titres sont à jour, et le titre en échec garde ses données précédentes.
  - Deux `runSync` lancés en même temps sur la même base → l'un renvoie `skipped`.
  - `runDailyRefresh` met à jour un `earnedRate` qui est passé de 1.30 à 1.28, sans que le titre ait changé.
- [ ] **Step 2 :** FAIL.
- [ ] **Step 3 :** implémenter, avec une pause de 200 ms entre deux appels PSN, et 3 nouvelles tentatives à délai croissant (1, 2 puis 4 s) en cas d'erreur 429 ou 5xx.
- [ ] **Step 4 :** PASS.
- [ ] **Step 5 :** commit `feat: sync orchestration and daily refresh` + push.

### Task 11 : Worker et planification

**Files :** Create `src/worker/scheduler.ts`, `src/worker/index.ts` · Test `src/worker/scheduler.test.ts`

**Interfaces :**
- Consumes : `runSync`, `runDailyRefresh`, `takeSyncRequest`, `jobState`.
- Produces : `decideNextJob(state: { lastScheduledAt: Date|null; lastDailyAt: Date|null; manualRequested: boolean }, now: Date): "manual"|"scheduled"|"daily"|null`.
  - L'ordre de priorité est : manuel, puis planifié (dernier lancement il y a 6 h ou plus, ou jamais lancé), puis quotidien (dernier lancement il y a 24 h ou plus).
- Produces : `tick(deps, now): Promise<void>` (une itération).
- Produces : `src/worker/index.ts`.
  - Il lance `runMigrations`, puis une boucle `tick` toutes les **5 s**.
  - Il s'arrête proprement sur `SIGTERM` et `SIGINT`.
  - Script `worker:dev`, lancé via `tsx`.

- [ ] **Step 1 : tests qui échouent** (sur `decideNextJob`).
  - Une demande manuelle passe avant le planifié.
  - Dernier lancement planifié il y a 5 h 59 min, sans demande → `null` ; il y a 6 h → `"scheduled"`.
  - `lastDailyAt` à `null`, alors que le planifié est à jour → `"daily"`.
  - **`tick` à 08:00 avec le planifié dû et le quotidien dû** → seul `scheduled` est lancé. Le quotidien part au `tick` suivant.
- [ ] **Step 2 :** FAIL.
- [ ] **Step 3 :** implémenter. `jobState` utilise les clés `scheduled` et `daily`, mises à jour au **début** de chaque exécution.
- [ ] **Step 4 :** PASS.
- [ ] **Step 5 :** commit `feat: worker scheduler` + push.

### Task 12 : Stats, milestones et listes de trophées

**Files :** Create `src/stats/profile-stats.ts`, `src/stats/milestones.ts`, `src/stats/trophies.ts`, `tests/fixtures/profile.ts` · Test `src/stats/*.test.ts`

**Interfaces :**
- Produces : `getProfileStats(db, { hideZero }): Promise<ProfileStats>`, avec `ProfileStats = { gamesCompleted; totalGames; completionRate; averageRarity; unearned; trophiesPerDay; hoursSeconds }`. Définitions de la spec 8.4 :
  - les titres pris en compte sont ceux qui ne sont pas masqués, en excluant aussi ceux à `progress = 0` si `hideZero` est actif ;
  - `completionRate` = Σ obtenus / Σ définis × 100 ;
  - `averageRarity` = moyenne de `earnedRate` sur les trophées obtenus dont la rareté n'est pas `null` ;
  - `trophiesPerDay` = Σ obtenus / (jours depuis le plus ancien `earnedAt`) ;
  - `hoursSeconds` = Σ `playSeconds`.
- Produces : `computeMilestones(earned: EarnedTrophy[], now: Date): Milestone[]`, avec `Milestone = { label: string; trophy: EarnedTrophy }`. Le résultat est trié par date décroissante.
  - Ordre de comptage : `earnedAt` croissant ; à la même seconde, le platine passe en dernier, puis `trophyId` croissant.
  - Étapes :
    - « First trophy », « First platinum », « Latest platinum », « Fastest platinum » (le plus petit écart entre le platine et le premier trophée du même jeu) ;
    - platines n°10, 20, 30, 40, 50, puis tous les 25 (« 75th platinum ») ;
    - trophées n°500, puis tous les 500 jusqu'à 5 000, puis tous les 1 000, plus le n°1 337 (« 1,337th trophy ») ;
    - suffixes ordinaux en anglais : 1st, 2nd, 3rd, 11th, 12th, 13th, 21st…
- Produces :
  - `getLatestTrophies(db, limit = 20)` ;
  - `getRarest(db, limit = 5)` ;
  - `getRarityBreakdown(db): Record<RarityTier, number>` ;
  - `getMilestones(db, now)`.
  - Les trois premières portent sur les trophées obtenus de jeux non masqués, et ignorent ceux dont la rareté est `null`.

- [ ] **Step 1 : tests qui échouent.**
  - Avec 3 titres (définis/obtenus : 10/10 ; 36/0 ; 20/5) → `completionRate` = 15/66 × 100 = 22.73, `unearned` = 51, `totalGames` = 3.
  - Les mêmes avec `hideZero: true` → 15/30 × 100 = 50.00, `unearned` = 15, `totalGames` = 2.
  - Un titre masqué ne compte jamais.
  - **`ignores trophies without rarity`** : raretés 10, 20 et `null` → `averageRarity` = 15, et la rareté `null` n'apparaît pas dans `getRarityBreakdown`.
  - **`numbers same-second trophies with the platinum last`** : 499 trophées, puis un argent et un platine à la même seconde → le « 500th trophy » est l'argent, et le platine est le n°501.
  - La liste d'étapes contient « 1,337th trophy » et « 75th platinum ».
  - Le libellé du 225e platine est « 225th platinum ».
- [ ] **Step 2 :** FAIL.
- [ ] **Step 3 :** implémenter. Les agrégats sont faits en SQL, et `computeMilestones` est une fonction pure.
- [ ] **Step 4 :** PASS.
- [ ] **Step 5 :** commit `feat: profile stats, rarity and milestones` + push.

### Task 13 : Requête de la liste des jeux

**Files :** Create `src/games/query.ts`, `src/games/row.ts`, `app/api/games/route.ts` · Test `src/games/query.test.ts`, `src/games/row.test.ts`

**Interfaces :**
- Produces : `GameQuery = { state: GameState; platform: "all"|"PS4"|"PS5"; sort: GameSort; q: string; offset: number }`.
  - `GameState = "all"|"100"|"not100"|"notFinished"|"platinum"|"platinumNot100"` ;
  - `GameSort = "lastPlayed"|"lastTrophy"|"alphabetical"|"percent"|"timePlayed"|"totalTrophies"|"earnedTrophies"|"unearnedTrophies"|"platinumRarity"`.
- Produces :
  - `parseGameQuery(params: URLSearchParams): GameQuery`, avec repli sur les valeurs par défaut si un paramètre est invalide ;
  - `queryGames(db, q, { hideZero }): Promise<{ items: GameRowData[]; total: number }>` (50 par page) ;
  - `toGameRow(title, imageMap): GameRowData` ;
  - `gameStatus(t): "plat-earned"|"plat-missing"|"complete"|"incomplete"` ;
  - `progressRank(progress: number): "S"|"A"|"B"|"C"|"D"|"E"|"F"`.
- Produces : `GameRowData = { id; name; platforms: ("PS4"|"PS5")[]; coverSrc; earnedTotal; definedTotal; counts: Record<TrophyType, [earned: number, defined: number]>; progress; rank; lastPlayedLine: string; status }`.
- Produces : `GET /api/games?...` → `{ items, total }`.
- Filtres (spec 8.7) :
  - `100` : progress = 100 ; `not100` : progress < 100 ;
  - `notFinished` : progress < 100 **et** pas de platine obtenu ;
  - `platinum` : platine obtenu ; `platinumNot100` : platine obtenu et progress < 100.
  - Plateforme : le titre contient la plateforme demandée.
  - Recherche : `ILIKE '%q%'` sur le nom.
- Tris (spec 8.7), avec en cas d'égalité le nom croissant puis l'id :
  - `lastPlayed` : `coalesce(lastPlayedAt, lastTrophyAt)` décroissant, les valeurs nulles à la fin ;
  - `lastTrophy` : décroissant ; `alphabetical` : croissant ;
  - `percent`, `timePlayed`, `totalTrophies`, `earnedTrophies`, `unearnedTrophies` : décroissants ;
  - `platinumRarity` : `earnedRate` du trophée platine croissant, les jeux sans platine à la fin.
- Les jeux masqués sont toujours exclus. Avec `hideZero`, les jeux à `progress = 0` le sont aussi.

- [ ] **Step 1 : tests qui échouent.**
  - **`gameStatus`** : un platine obtenu → `plat-earned` ; 1 platine défini mais non obtenu → `plat-missing` ; aucun platine et 100 % → `complete` ; aucun platine et 80 % → `incomplete`.
  - **`progressRank` aux bornes** : 0 → F ; 1 → E ; 19 → E ; 20 → D ; 39 → D ; 40 → C ; 59 → C ; 60 → B ; 79 → B ; 80 → A ; 99 → A ; 100 → S.
  - **`notFinished`** exclut un jeu platiné à 93 % et inclut un jeu non platiné à 93 %.
  - **`platinumRarity`** classe 1.30 avant 50.82, et place en dernier un jeu sans platine.
  - **Pagination** : sur 120 titres, l'`offset` 100 renvoie 20 éléments, avec `total` = 120.
  - **`hideZero`** retire le titre à 0 %.
  - **`parseGameQuery`** : `state=bogus` donne `all`.
- [ ] **Step 2 :** FAIL.
- [ ] **Step 3 :** implémenter. La route exige une session et lit `hideZero` dans les réglages.
- [ ] **Step 4 :** PASS.
- [ ] **Step 5 :** commit `feat: games query with filters, sorts and paging` + push.

### Task 14 : Coque du site (menu, bannière, bandeaux d'alerte, pages provisoires)

**Files :**
- Create : `app/(site)/layout.tsx`, `components/TopMenu.tsx`, `components/Banner.tsx`, `components/AuthBanner.tsx`, `components/ComingSoon.tsx`, `components/TrophyTypeIcon.tsx`, `app/(site)/[section]/page.tsx`, `app/(site)/games/[id]/page.tsx`, `public/icons/*`, `scripts/seed-dev.ts`
- Test : `components/AuthBanner.test.tsx`

**Interfaces :**
- Produces :
  - `<TrophyTypeIcon type size />` (affiche `/icons/trophy-<type>.png`) ;
  - `levelSpriteStyle(tier: number): CSSProperties` (ligne `tier-1` du sprite, `background-position: 0 calc((tier-1)/9*100%)`) ;
  - `authBannerText(status, npssoSetAt, now): string|null` ;
  - `seed:dev`, qui insère les données de la maquette dans la base de dev : profil Zmx969, les 13 jeux, les 20 derniers trophées, le cabinet et les trophées qui génèrent les milestones.
- Menu (spec 8.5) :
  - pastilles « Games », « Plat Wall », « Trophy Log », « Trophy Advisor », « Stats » à gauche, et « Settings » à droite ;
  - menu sans bandeau, qui défile avec la page ;
  - CSS `.topbar` et `.pill` de la maquette.
  - Les routes `/plat-wall`, `/trophy-log`, `/trophy-advisor` et `/stats` affichent `<ComingSoon>` (« Plat Wall is coming soon. »).
  - `/games/[id]` affiche le nom du jeu et « The game page is coming soon. ».
- Bannière (spec 8.2) :
  - `aspect-ratio:1920/520`, bornée entre 240 et 560 px ;
  - masque de fondu de 72 % à 100 % ;
  - `background-position-y` réglé par `bannerPosY` ;
  - fond de page flouté (`body::before`).
  - Sans image : un dégradé neutre et le lien « Choose a banner in Settings ».
- Textes des bandeaux d'alerte :
  - « PSN token expired — update it in Settings » si l'état est `expired` ;
  - « PSN token is 52 days old — renew it in Settings » si le token a plus de 50 jours (nombre de jours réel) ;
  - « Connect your PSN account in Settings » si l'état est `missing`.

- [ ] **Step 1 : récupérer les icônes officielles** (à confirmer avec l'utilisateur au moment de l'exécution, puisqu'il s'agit d'un téléchargement).
  - Les 4 icônes de type : `https://psnprofiles.com/lib/img/icons/40-{platinum,gold,silver,bronze}.png` → `public/icons/trophy-*.png`.
  - Le sprite des 10 paliers de niveau : `https://psnprofiles.com/lib/img/icons/level-sprite.png` → `public/icons/level-sprite.png` (98 × 1000 px, palier 1 en haut).
- [ ] **Step 2 : tests qui échouent** (sur `authBannerText`).
  - `expired` → le texte « expired ».
  - `valid` avec un token de 52 jours → « PSN token is 52 days old — renew it in Settings ».
  - `valid` avec un token de 50 jours → `null`.
- [ ] **Step 3 :** FAIL, implémenter, puis PASS.
- [ ] **Step 4 : vérification visuelle.**
  - `npm run seed:dev && npm run dev`.
  - Comparer le menu et la bannière avec la maquette v12 à 1 630 px de large.
  - Les 4 onglets mènent bien à « Coming soon ».
- [ ] **Step 5 :** commit `feat: site shell, menu, banner and placeholders` + push.

### Task 15 : Bandeau profil, cases de stats et bouton « Sync now »

**Files :** Create `src/sync/requests.ts` (contient `getSyncStatus`), `components/ProfileBand.tsx`, `components/StatTiles.tsx`, `components/SyncButton.tsx`, `app/api/sync/route.ts`, `app/(site)/page.tsx` (début) · Test `components/SyncButton.test.tsx`, `src/sync/requests.test.ts`

**Interfaces :**
- Consumes : `getProfileStats` et le profil (tâche 12), `requestSync` (tâche 4).
- Produces :
  - `POST /api/sync` → 202 ; il appelle `requestSync`, sauf si une synchro est déjà `running` ;
  - `GET /api/sync` → `{ status: "idle"|"queued"|"running"|"error"; lastSuccessAt: string|null; error: string|null; titlesDone; titlesTotal }` ;
  - `getSyncStatus(db): Promise<SyncStatus>`.
- Bandeau (spec 8.3) :
  - avatar sans badge PS Plus ni pays, et pseudo ;
  - « Last synced 7 Nov 2026, 09:27 » ;
  - compteurs « Trophies », « Platinum », « Gold », « Silver », « Bronze », issus du résumé PSN, comme sur la console ;
  - niveau : sprite du palier, « PSN level », et « 42% to level 537 ».
- Cases (spec 8.4) :
  - libellés « Games completed », « Completion rate », « Average rarity », « Unearned trophies », « Trophies per day », « Hours played » ;
  - valeurs `224 / 266` (le `/ 266` en petit), `93.74%`, `26.54%`, `776`, `3.19`, `19,416 h` ;
  - aucun texte sous les chiffres.
- Bouton :
  - « Sync now » ; pendant la synchro, « Syncing… » avec l'icône qui tourne ; en cas d'erreur, « Retry sync », et « Last sync failed: <error> » à la place de la date ;
  - il interroge `GET /api/sync` toutes les 2 s tant que l'état est `queued` ou `running`, puis appelle `router.refresh()`.

- [ ] **Step 1 : tests qui échouent.**
  - `getSyncStatus` renvoie `queued` si une demande est en attente sans synchro `running`.
  - Avec des timers simulés, `SyncButton` passe de « Sync now » à « Syncing… » au clic, puis revient à « Sync now » quand le `GET` simulé renvoie `idle`.
- [ ] **Step 2 :** FAIL, implémenter (CSS `.profile`, `.count`, `.level`, `.stats`, `.btn-sync` de la maquette), puis PASS.
- [ ] **Step 3 : vérification.**
  - Avec `seed:dev`, les 6 valeurs affichées sont celles du tableau ci-dessus.
  - Un clic sur « Sync now » avec `worker:dev` en route fait apparaître une ligne `syncRuns`.
- [ ] **Step 4 :** commit `feat: profile band, stat tiles and sync button` + push.

### Task 16 : Carrousel des derniers trophées

**Files :** Create `components/TrophyCarousel.tsx` (+ `.module.css`) · Test `components/TrophyCarousel.test.tsx`

**Interfaces :**
- Consumes : `getLatestTrophies(db, 20)`.
- Produces :
  - `fitCount(width: number, opts: { icon: 56; gap: 8; card: 380; narrow: boolean }, available: number): number` ;
  - `<TrophyCarousel trophies={...} />`.
- Règles (spec 8.6) :
  - aucun titre au-dessus ;
  - large écran : `1 + floor((width - card) / (icon + gap))` ; écran étroit (980 px ou moins) : `1 + floor((width + gap) / (icon + gap))` ;
  - la valeur est bornée entre 1 et `available`, et les éléments sont calés aux deux bords (`justify-content: space-between`) ;
  - le détail montre l'icône, le nom, la description, « 5 Nov 2026, 00:16 in Magicka 2 », la rareté en % et sa catégorie, et l'icône du type ;
  - la case du détail fait 56 px de haut, comme les icônes, sans contour ;
  - le carrousel avance toutes les 6 s **par un minuteur JavaScript** (et non par une fin d'animation CSS), se met en pause au survol et au focus, et change de trophée au clic ;
  - si le système demande de réduire les animations, seule la barre du minuteur est masquée.

- [ ] **Step 1 : tests qui échouent.**
  - `fitCount(1400, desktop, 20)` → 16 ; `fitCount(1232, desktop, 20)` → 14 ; `fitCount(1400, desktop, 3)` → 3.
  - Avec des timers simulés, le détail passe au trophée 2 au bout de 6 s, et n'avance pas tant que la souris est sur le carrousel.
  - **Il avance même quand `prefers-reduced-motion: reduce` est actif.**
- [ ] **Step 2 :** FAIL, implémenter (CSS `.strip` et `.item` de la maquette ; `ResizeObserver` pour recalculer `fitCount`), puis PASS.
- [ ] **Step 3 : vérification à 1 630 px.**
  - 16 éléments visibles.
  - Le bord droit du dernier élément est aligné sur le bord droit de la colonne latérale.
  - Aucune barre de défilement.
- [ ] **Step 4 :** commit `feat: auto-cycling latest trophies carousel` + push.

### Task 17 : Liste des jeux (lignes, filtres, toggle, défilement infini)

**Files :** Create `components/GameList.tsx`, `components/GameRow.tsx`, `components/GameFilters.tsx`, `components/HideZeroToggle.tsx`, `app/(site)/actions.ts` · Test `components/GameRow.test.tsx`, `components/GameList.test.tsx`

**Interfaces :**
- Consumes : `queryGames`, `GameRowData`, `GET /api/games`, `setHideZero`.
- Produces :
  - l'action serveur `toggleHideZero(on: boolean): Promise<void>` (enregistre le réglage, puis `revalidatePath("/")`) ;
  - `<GameList initial={{ items, total }} query={GameQuery} />` ;
  - `<GameRow row={GameRowData} />`, un lien vers `/games/<id>`.
- En-tête :
  - « Games », puis juste à côté l'interrupteur « Hide 0% games » ;
  - à droite, « 266 games » (le `total` de la requête).
- Filtres :
  - état : « All », « 100% », « Not 100% », « Not 100% or Platinum », « Platinum », « Platinum, not 100% » ;
  - plateforme : « All platforms », « PS4 », « PS5 » ;
  - tri : « Last played », « Last trophy », « Alphabetical », « Percent completion », « Time played », « Total trophies », « Earned trophies », « Unearned trophies », « Platinum rarity » ;
  - recherche, avec le texte indicatif « Search games ».
  - Les choix sont stockés dans les paramètres de l'URL, ce qui donne une première page rendue côté serveur avec les bons filtres.
- Ligne (spec 8.7, CSS `.game`, `.stacked`, `.chips`, `.chip`, `.progress` et `.status` de la maquette) :
  - à gauche : la jaquette de 60 px, puis trois lignes de texte, sans rien de tronqué :
    1. le nom et les badges de plateforme ;
    2. « 47 / 47 trophies » ;
    3. `lastPlayedLine`.
  - à droite, le bloc empilé : les pastilles des types présents dans le jeu, centrées sur la barre de progression (`padding-right:44px`), et sous elles la barre et le pourcentage PSN.
  - La barre est remplie avec `var(--rank-<rang>)`. À 0 %, c'est le fond de la barre qui prend `--rank-f` à 38 % (règles `.bar.zero` et jetons `--rank-*` de la maquette v12).
  - Icône d'état :
    - `plat-earned` : icône platine en couleur ; `plat-missing` : icône platine grisée ;
    - `complete` : coche ; `incomplete` : coche grisée.
- Défilement infini : un `IntersectionObserver` sur un élément sentinelle charge `offset + 50`, jusqu'à ce que le nombre affiché atteigne `total`.

- [ ] **Step 1 : tests qui échouent.**
  - Une ligne sans platine défini n'affiche pas de pastille platine, et n'a que 3 pastilles.
  - Une ligne à 27 % a une barre en `var(--rank-d)`. Une ligne à 0 % a la classe `zero` sur sa barre.
  - Les lignes `plat-missing` et `incomplete` ont la classe grisée.
  - La 3e ligne vaut exactement « Last played 5 Nov 2026 | 33h 27m played ».
  - Avec un `fetch` simulé et une intersection déclenchée, `GameList` appelle `/api/games?offset=50&...`, ajoute les éléments, puis n'appelle plus rien une fois `total` atteint.
- [ ] **Step 2 :** FAIL, implémenter, puis PASS.
- [ ] **Step 3 : vérification avec `seed:dev`.**
  - Activer « Hide 0% games » : Phantom Blade Zero disparaît, « 265 games » s'affiche, et les cases passent à `224 / 265` et `740`.
  - Le filtre « Not 100% or Platinum » ne garde que les jeux ni à 100 % ni platinés.
  - Un clic sur une ligne ouvre `/games/<id>`.
  - Aucun texte n'est coupé : vérifier en script que, sur chaque `.game h3` et `.game-meta`, `scrollWidth <= clientWidth`.
- [ ] **Step 4 :** commit `feat: games list with filters, hide-0% toggle and infinite scroll` + push.

### Task 18 : Colonne latérale (cabinet et son éditeur, plus rares, milestones)

**Files :** Create `src/cabinet/repo.ts`, `components/CabinetPanel.tsx`, `components/CabinetEditor.tsx`, `components/RarestPanel.tsx`, `components/MilestonesPanel.tsx`, `app/api/trophies/search/route.ts` · Test `src/cabinet/repo.test.ts`

**Interfaces :**
- Produces :
  - `getCabinet(db)` ;
  - `saveCabinet(db, entries: { titleId: string; trophyId: number }[]): Promise<void>`. Il lève une erreur au-delà de 10 entrées, en cas de doublon, ou si un trophée n'est pas obtenu. Il réécrit les positions de 1 à n ;
  - `searchEarnedTrophies(db, q, limit = 20)` (recherche sur le nom du trophée ou du jeu) ;
  - `GET /api/trophies/search?q=`, et l'action serveur `saveCabinetAction(entries)`.
- Listes (spec 8.8, CSS `.tlist` et `.tlist.typed` de la maquette) :
  - icône de 56 px et ligne d'environ 66 px ;
  - noms jamais coupés ;
  - icône officielle du type tout à droite, dans le cabinet comme dans les plus rares.
- Cabinet :
  - titre « Trophy cabinet » et lien « Edit », qui ouvre `CabinetEditor` : une fenêtre par-dessus la page, avec recherche, ajout jusqu'à 10 trophées, déplacement vers le haut ou le bas, retrait, et boutons « Save » et « Cancel » ;
  - vide : « Pick up to 10 trophies to show here. » et « Edit ».
- Plus rares :
  - titre « Rarest trophies », avec « global PSN rarity » à côté ;
  - 5 lignes, puis la barre empilée et les 5 chiffres, dans l'ordre Ultra rare, Very rare, Rare, Uncommon, Common.
- Milestones :
  - titre « Milestones », avec « 32 milestones » à côté (le nombre réel) ;
  - **toutes** les étapes ;
  - libellé en couleur d'accent, temps relatif, et date exacte (`formatDateTime`) dans l'attribut `title`.

- [ ] **Step 1 : tests qui échouent.**
  - `saveCabinet` avec 11 entrées → erreur.
  - Avec un trophée non obtenu → erreur.
  - Avec 3 entrées, puis 2 → il ne reste que les positions 1 et 2.
- [ ] **Step 2 :** FAIL, implémenter, puis PASS.
- [ ] **Step 3 : vérification à 1 630 px.**
  - Les lignes des 3 listes font toutes la même hauteur (66 px).
  - « The Greatest Expedition in History » tient sur une ligne.
  - L'éditeur enregistre, et la page affiche le nouvel ordre.
- [ ] **Step 4 :** commit `feat: sidebar panels and cabinet editor` + push.

### Task 19 : Page Settings

**Files :** Create `app/(site)/settings/page.tsx`, `app/(site)/settings/actions.ts`, `src/settings/banner.ts` · Test `src/settings/banner.test.ts`

**Interfaces :**
- Consumes : `connectWithNpsso`, `setBanner`, la table `syncRuns`, `deleteAllSessions`.
- Produces :
  - `validateBannerUpload(bytes: Uint8Array, declaredSize: number): { ok: true; ext: "jpg"|"png"|"webp" } | { ok: false; error: string }`, qui vérifie la signature binaire du fichier et une taille de 10 Mo au plus ;
  - les actions serveur `uploadBanner(form)`, `saveBannerPosition(posY: number /*0..100*/)`, `resetBanner()`, `saveNpsso(form)` et `logout()`.
- Sections (spec 9) :
  - **« Banner »** :
    - envoi d'un fichier depuis le PC, avec aperçu ;
    - un curseur « Visible part » pour choisir la partie verticale gardée ;
    - un bouton « Use default banner » ;
    - le fichier est enregistré dans `MEDIA_DIR/banner/<random>.<ext>` et l'ancien est supprimé.
  - **« PSN token »** : un champ (type password), le bouton « Save token », l'état (« Valid », « Expired », « Not connected »), « Saved 7 Nov 2026 » et « 12 days old ». Le tuto, mot pour mot :
    1. Sign in at https://www.playstation.com in your browser.
    2. In the same browser, open https://ca.account.sony.com/api/v1/ssocookie.
    3. Copy the value of "npsso" (64 characters).
    4. Paste it here and save.
    - Un NPSSO valide déclenche une demande de synchro, de type `first` si la base est vide.
  - **« Sync history »** : les 20 dernières exécutions, avec le type, le début, la durée, l'état et l'erreur.
  - **« Log out »** : `deleteAllSessions`, puis retour à `/login`.
- Pas d'éditeur du cabinet dans cette page.

- [ ] **Step 1 : tests qui échouent.**
  - Des octets PNG valides donnent `ok` avec l'extension `png`.
  - Un PDF renommé en `.jpg` est refusé.
  - 10 Mo + 1 octet est refusé (« Images must be 10 MB or smaller. »).
- [ ] **Step 2 :** FAIL, implémenter (`next.config` : `serverActions.bodySizeLimit = "11mb"`), puis PASS.
- [ ] **Step 3 : vérification.**
  - L'envoi d'une image 1920 × 520 met à jour la bannière et le fond de page.
  - Le curseur décale bien l'image.
  - Un NPSSO de 63 caractères affiche « That doesn't look like a 64-character npsso. ».
- [ ] **Step 4 :** commit `feat: settings page` + push.

### Task 20 : Image Docker, GitHub Actions et stacks Portainer

**Files :** Create `Dockerfile`, `.dockerignore`, `.github/workflows/docker.yml`, `deploy/stack-site.yml`, `deploy/stack-infra.yml`, `deploy/nginx/default.conf`, `deploy/README.md`

**Interfaces :**
- Produces :
  - l'image `ghcr.io/zedemix-dev/psn-tracker`, avec les étiquettes `latest` et `sha-<court>` ;
  - par défaut, `node server.js` (l'app) ; pour le worker, `node dist/worker.js`.
- **Dockerfile** multi-étapes sur `node:22-alpine` :
  - `npm ci`, `npm test`, `next build`, puis bundle esbuild de `src/worker/index.ts` vers `dist/worker.js` (`--bundle --platform=node --target=node22`) ;
  - l'étape finale copie `.next/standalone`, `.next/static`, `public`, `dist/worker.js` et `src/db/migrations` ;
  - utilisateur non-root ; `ENV NODE_ENV=production`.
- **Workflow** :
  - déclenché par un push sur `main` ;
  - `docker/setup-buildx-action`, puis connexion à GHCR avec `GITHUB_TOKEN` (permission `packages: write`) ;
  - `docker/build-push-action` avec `platforms: linux/amd64`.
- **stack-infra.yml** :
  - `postgres:16-alpine` (volume `/volume1/docker/psn-tracker/postgres`, utilisateur et base `psn`, mot de passe par variable) ;
  - `nginx:1.27-alpine` (port `8080:80`, avec `default.conf` monté) ;
  - réseau externe `psn-net`.
- **stack-site.yml** :
  - `app` et `worker`, sur la même image ;
  - variables : `DATABASE_URL=postgres://psn:${POSTGRES_PASSWORD}@postgres:5432/psn`, `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH` (écrire les `$` en double `$$` dans le compose), `APP_SECRET`, `PSN_LANGUAGE=en-GB`, `MEDIA_DIR=/data/media`, `TZ=Europe/Paris` ;
  - volume `/volume1/docker/psn-tracker/media:/data/media` sur les deux services ;
  - réseau `psn-net` ; `restart: unless-stopped`.
- **nginx** :
  - `set_real_ip_from` sur `10.0.0.0/8`, `172.16.0.0/12` et `192.168.0.0/16` ; `real_ip_header X-Forwarded-For` ; `real_ip_recursive on` ;
  - `proxy_set_header X-Real-IP $remote_addr` ; `X-Forwarded-Proto $http_x_forwarded_proto` ;
  - `client_max_body_size 12m` ;
  - `proxy_pass http://app:3000`.
- **deploy/README.md** : le guide pas à pas promis à l'utilisateur, pour tout ce qui se fait en dehors du code.
  - Dépôt GitHub : rendre le package GHCR accessible, ou créer un token « read:packages » pour Portainer, et connaître les quotas gratuits.
  - Créer le réseau `psn-net`.
  - Déployer « infra », puis « site », dans Portainer.
  - Générer `APP_SECRET` (`openssl rand -base64 32`) et `ADMIN_PASSWORD_HASH` (`npm run hash-password`).
  - Créer la règle du reverse proxy DSM : HTTPS `psn.<nom>.synology.me:443` → `http://localhost:8080`, avec le certificat Let's Encrypt.
  - Mettre à jour : relancer la stack « site » en téléchargeant de nouveau l'image.

- [ ] **Step 1 :** écrire les fichiers.
- [ ] **Step 2 : vérification CI.**
  - Pousser la branche, puis ouvrir une PR vers `main` (le workflow lance aussi `npm test` sur les PR, sans publier l'image).
  - Le job doit réussir.
  - Si Docker est disponible en local, `docker build .` doit aussi réussir.
- [ ] **Step 3 :** commit `build: docker image, CI and Portainer stacks` + push.

### Task 21 : Vérification de bout en bout avec les vraies données

**Files :** aucun nouveau fichier. Corrections éventuelles dans les fichiers concernés.

- [ ] **Step 1 : lancer en local.** `npm run dev` et `npm run worker:dev`, sur une base PGlite vide.
- [ ] **Step 2 : saisie du token par l'utilisateur.** C'est l'utilisateur, et non l'agent, qui colle son NPSSO dans Settings. La première synchro démarre, et « Sync history » montre sa progression jusqu'à `success`.
- [ ] **Step 3 : comparer avec la console et psnprofiles.**
  - Le niveau et les compteurs par type du bandeau sont identiques à ceux de la console.
  - Le nombre de jeux et le pourcentage d'un jeu partiel (Destiny 2 PS4 : 93 %) sont identiques au PSN.
  - Le jeu de plus de 256 trophées, s'il est présent, a tous ses trophées.
  - Les 32 milestones et plus correspondent à ceux de psnprofiles, plus le 11,000th.
  - Les jaquettes sont carrées et les images sont servies depuis `/media/...`.
- [ ] **Step 4 :** comparer visuellement la page à la maquette v12 à 1 630 px de large, puis à 375 px (pas de défilement horizontal).
- [ ] **Step 5 :** corriger les écarts (un commit par correction), puis `npx vitest run` → PASS, et push.
