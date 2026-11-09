# PSN Tracker : trophées non obtenables, Implementation Plan

> **Statut :** terminé et fusionné dans `main` le 9 novembre 2026 (PR #6), tâches 1 à 13. Les cases ne sont pas cochées : la progression se lit dans `git log` et dans `docs/ETAT-DU-PROJET.md`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** signaler dans Games et sur la page d'un jeu les trophées qu'on ne peut plus obtenir, avec un filtre, un bouton « Show all » et l'adresse de la liste réglable dans Settings.

**Architecture :** le worker télécharge la liste PSNP+, la garde en base, puis marque les trophées et résume le résultat sur chaque jeu (nombre et note). Les pages lisent seulement ces colonnes : aucune jointure avec la liste à l'affichage. Le code de la fonctionnalité vit dans `src/unobtainable/`, en fonctions pures testées à part de l'accès à la base.

**Tech Stack :** Next.js 16 (App Router, RSC), React 19, TypeScript strict, Drizzle + drizzle-kit, PGlite (tests), Vitest + @testing-library/react + jsdom.

**Spec :** [section 14](../specs/2026-11-07-psn-tracker-design.md). **Maquette validée** (référence du CSS) : [2026-11-09-psn-tracker-maquette-nonobt.html](../specs/2026-11-09-psn-tracker-maquette-nonobt.html).

## Global Constraints

- Branche `feat/unobtainable`. **Après chaque commit, push.** Message de commit en anglais, terminé par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Interface du site et code en anglais. Aucune nouvelle dépendance.
- Next.js 16 : lire `AGENTS.md` et les guides de `node_modules/next/dist/docs/` avant d'écrire du code Next.
- Windows : `export PATH="/c/Program Files/nodejs:$PATH"` en Git Bash ; le chemin du dépôt contient `!`, le mettre entre apostrophes.
- Tests : `npx vitest run <fichier>`, puis `npx tsc --noEmit`.
- Adresse par défaut, exacte : `https://psnp-plus.huskycode.dev/list.json`.
- Valeurs de la spec : délai 30 s, taille 10 Mo, rafraîchissement 24 h, une tentative par heure au plus.
- Surbrillance rouge : fond à 14 %, anneau de 2 px, couleur `--rank-f`.
- Les stats du profil ne changent pas (14.2).
- Un export d'un module `"use client"` n'est pas utilisable côté serveur, sauf comme composant.
- Le vrai NPSSO n'est jamais saisi par Claude.

## Review Focus

Chaque ligne a son test dans la tâche indiquée.

1. **Une liste trop grosse sans `Content-Length`** (le serveur actuel n'en envoie pas) : refusée, sans charger toute la réponse en mémoire (tâche 5).
2. **Une synchro qui recharge un jeu déjà marqué** : les marques et le nombre restent, y compris pendant la synchro (tâche 4).
3. **« Save » pendant un téléchargement** : la nouvelle demande n'est pas perdue quand le téléchargement en cours se termine (tâche 5).
4. **« Show all » pendant qu'un chargement au défilement est en cours** : une seule requête, aucun jeu en double (tâche 10).
5. **Une note piégée** (`javascript:`, HTML) : reste du texte inerte, sans lien ni balise (tâches 7 et 11).

## Fichiers

| Fichier | Rôle |
|---|---|
| `src/db/schema.ts`, migration `0006_unobtainable` | Colonnes et table de la liste |
| `src/unobtainable/list.ts` | Validation de la réponse et de l'adresse |
| `src/unobtainable/match.ts` | Clé de nom, rapprochement (pur) |
| `src/unobtainable/apply.ts` | Écrit les marques en base |
| `src/unobtainable/refresh.ts` | Échéance, téléchargement, enregistrement |
| `src/unobtainable/labels.ts`, `note.ts` | Textes affichés (purs) |
| `src/unobtainable/status.ts` | État affiché dans Settings |
| `components/UnobtainableMark.tsx` | Le « ! » et son infobulle |

---

### Task 1: Schéma et migration

**Files:** Modify `src/db/schema.ts`. Create `src/db/migrations/0006_unobtainable.sql` (généré, avec `meta/`). Test `src/db/schema.test.ts`.

**Interfaces — Produces** (dans `src/db/schema.ts`) :
- `export const DEFAULT_UNOBTAINABLE_LIST_URL = "https://psnp-plus.huskycode.dev/list.json"`
- `export type UnobtainableEntry = { id: string; title: string; platforms: string[]; trophies: number[]; note: string | null; timestamp: number | null }`
- `trophies.unobtainable` : `boolean("unobtainable").notNull().default(false)`
- `titles.unobtainableCount` : `integer("unobtainable_count").notNull().default(0)` ; `titles.unobtainableNote` : `text("unobtainable_note")`
- `settings.unobtainableListUrl` : `text("unobtainable_list_url").notNull().default(DEFAULT_UNOBTAINABLE_LIST_URL)` ; `settings.unobtainableRequestedAt` : `ts("unobtainable_requested_at")`
- table `unobtainableList` (`"unobtainable_list"`) : `id` integer PK default 1 ; `entries` `jsonb().$type<UnobtainableEntry[]>().notNull().default([])` ; `downloadedAt`, `attemptedAt` en `ts` ; `error` text. Aucune ligne au départ.

- [ ] **Step 1: Write the failing test** `"defaults the unobtainable columns"` dans `schema.test.ts`, avec le titre et le trophée déjà insérés par le test voisin :

```ts
expect(s.unobtainableListUrl).toBe("https://psnp-plus.huskycode.dev/list.json");
expect(s.unobtainableRequestedAt).toBeNull();
expect(title.unobtainableCount).toBe(0);
expect(title.unobtainableNote).toBeNull();
expect(trophy.unobtainable).toBe(false);
expect(await db.select().from(unobtainableList)).toEqual([]);
```

- [ ] **Step 2:** `npx vitest run src/db/schema.test.ts`. Expected : FAIL.
- [ ] **Step 3:** Ajouter le schéma, puis `npx drizzle-kit generate --name unobtainable`. Le SQL ne doit contenir que des `ADD COLUMN` et le `CREATE TABLE`.
- [ ] **Step 4:** `npx vitest run src/db/schema.test.ts`. Expected : PASS.
- [ ] **Step 5:** Commit `feat(db): columns and table for unobtainable trophies`.

### Task 2: Validation de la liste et de l'adresse

**Files:** Create `src/unobtainable/list.ts`, `src/unobtainable/list.test.ts`.

**Interfaces — Produces :**
- `export const LIST_UNREACHABLE = "Couldn't reach this address"` ; `export const LIST_INVALID = "This address didn't return a valid list"`
- `export type ParsedList = { ok: true; entries: UnobtainableEntry[] } | { ok: false; error: string }`
- `export function parseList(raw: unknown): ParsedList`
- `export function isListUrl(input: string): boolean`

- [ ] **Step 1: Write the failing tests**

```ts
const entry = { title: "Dauntless", platforms: ["PS4"], submitter: "x", note: "Closed.", trophies: [0], timestamp: 5 };
it("reads a valid list", () => expect(parseList({ version: 2, list: { "9120": entry } })).toEqual(
  { ok: true, entries: [{ id: "9120", title: "Dauntless", platforms: ["PS4"], trophies: [0], note: "Closed.", timestamp: 5 }] }));
it("turns a missing or empty note and a missing timestamp into null", ...); // { ...entry, note: "", timestamp: undefined } -> note null, timestamp null
it.each([[{ version: 1, list: { a: entry } }], [{ version: 2, list: {} }], [{ version: 2, list: [] }], ["text"], [null]])(
  "refuses %j", (raw) => expect(parseList(raw)).toEqual({ ok: false, error: LIST_INVALID }));
it("skips malformed entries", ...); // title absent, trophies ["1"], trophies [], trophies [-1] à côté d'une entrée valide -> 1 entrée
it("refuses a list with no valid entry", ...); // { a: { title: 3 } } -> LIST_INVALID
it.each([["https://a.dev/l.json", true], ["http://a.dev/l.json", true], ["ftp://a.dev/l", false],
  ["javascript:alert(1)", false], ["", false], ["not a url", false]])("isListUrl(%s)", (u, ok) => expect(isListUrl(u)).toBe(ok));
```

- [ ] **Step 2:** Run. Expected : FAIL.
- [ ] **Step 3:** Implémenter dans `list.ts`. `isListUrl` utilise `new URL()`.
- [ ] **Step 4:** Run. Expected : PASS.
- [ ] **Step 5:** Commit `feat(unobtainable): validate the list and its address`.

### Task 3: Rapprochement avec les jeux

**Files:** Create `src/unobtainable/match.ts`, `src/unobtainable/match.test.ts`.

**Interfaces — Produces :**
- `export function nameKey(name: string): string`
- `export type MatchIndex = Map<string, UnobtainableEntry[]>` ; `export function buildIndex(entries: UnobtainableEntry[]): MatchIndex`
- `export type TitleMatch = { all: boolean; numbers: number[]; note: string | null }`
- `export function matchTitle(index: MatchIndex, title: { name: string; platforms: string[] }): TitleMatch | null`
- `export function toTrophyIds(match: TitleMatch, existingIds: number[]): number[]`

- [ ] **Step 1: Write the failing tests**

```ts
it.each([
  ["Need for Speed™ Heat", "need for speed heat"], ["Foo™Bar", "foobar"], ["Rayman® Legends", "rayman legends"],
  ["Ghost of Yōtei", "ghost of yotei"], ["FINAL FANTASY Ⅻ THE ZODIAC AGE", "final fantasy xii the zodiac age"],
  ["A KING'S TALE: FF XV", "a king s tale ff xv"], ["™", ""],
])("nameKey(%s)", (a, b) => expect(nameKey(a)).toBe(b));
it("keeps non-Latin names", () => expect(nameKey("まいにちいっしょ")).not.toBe(""));

const e = (id: string, title: string, platforms: string[], trophies: number[], note: string | null = null, timestamp: number | null = null) =>
  ({ id, title, platforms, trophies, note, timestamp });
const m = (entries: UnobtainableEntry[], name: string, platforms: string[]) => matchTitle(buildIndex(entries), { name, platforms });

it("matches a PSN name with ™ to a plain list title", () => expect(m([e("1", "Need for Speed Heat", ["PS4"], [3])], "Need for Speed™ Heat", ["PS4"])).toEqual({ all: false, numbers: [3], note: null }));
it("needs a shared platform", () => expect(m([e("1", "The First Descendant", ["PS4"], [0])], "The First Descendant", ["PS5"])).toBeNull());
it("maps PSVITA and PSPC", ...); // ["PSVITA","PS4"] <-> ["Vita"] ; ["PS5","PSPC"] <-> ["PC"] -> match
it("never matches on VR alone", ...); // title ["PS4"] <-> ["VR"] -> null ; <-> ["PS4","VR"] -> match
it("never matches an empty key", ...); // title "™" contre entrée "®" -> null
it("merges several entries", () => expect(m([e("1","G",["PS4"],[1,5]), e("2","G",["PS4"],[5,9])],"G",["PS4"])).toEqual({ all:false, numbers:[1,5,9], note:null }));
it("treats any 0 as the whole game", () => expect(m([e("1","G",["PS4"],[7]), e("2","G",["PS4"],[0])],"G",["PS4"])?.all).toBe(true));
it("takes the note of the newest entry that has one", ...); // ts 5 "old", ts 9 null, ts 7 "new" -> "new" ; sans ts passe après ; égalité -> plus petit id numérique
it("converts numbers to trophy ids and drops unknown ones", () => expect(toTrophyIds({ all:false, numbers:[1,2,99], note:null }, [0,1,5])).toEqual([0,1]));
it("returns every id for the whole game", () => expect(toTrophyIds({ all:true, numbers:[], note:null }, [0,1,5])).toEqual([0,1,5]));
```

- [ ] **Step 2:** Run. Expected : FAIL.
- [ ] **Step 3:** Implémenter. `nameKey`, dans cet ordre (l'ordre est un piège, NFKD changeant ™ en « TM ») :

```ts
name.replace(/[™®©]/g, "").normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
```

Équivalences de plateforme : `PSVITA` → `Vita`, `PSPC` → `PC`.
- [ ] **Step 4:** Run. Expected : PASS.
- [ ] **Step 5:** Commit `feat(unobtainable): match list entries to the profile's games`.

### Task 4: Écriture des marques

**Files:** Create `src/unobtainable/apply.ts`, `src/unobtainable/apply.test.ts`. Test `src/sync/title.test.ts`.

**Interfaces — Consumes :** tâches 1 et 3. **Produces :** `export async function applyUnobtainable(db: Db): Promise<void>`

- [ ] **Step 1: Write the failing tests**. Dans `apply.test.ts`, avec une ligne insérée dans `unobtainableList`, un jeu `NPWR1` « Gran Turismo Sport » PS4 et les trophées 0 à 4 :

```ts
it("marks number minus one and summarises the title", ...); // trophies [1,3], note "Closed."
// -> trophyId 0 et 2 marqués, 1/3/4 non ; title.unobtainableCount 2 ; title.unobtainableNote "Closed."
it("marks every trophy for [0]", ...);                       // count 5
it("leaves a game whose numbers match nothing unmarked", ...); // [99] -> count 0, note null, aucune marque
it("clears a game the list no longer names", ...);           // 2e appel avec entries [] -> count 0, note null, aucune marque
it("does nothing without a list", ...);                      // pas de ligne : pas d'exception, count 0
```

Dans `src/sync/title.test.ts`, avec le faux gateway existant, `"keeps the unobtainable marks when a title is reloaded"` : après `update` d'un trophée (`unobtainable: true`) et du titre (`unobtainableCount: 1`, `unobtainableNote: "x"`), `syncTitle` laisse ces trois valeurs intactes.

- [ ] **Step 2:** Run. Expected : FAIL sur `apply.test.ts` (le test de `title.test.ts` doit déjà passer : `titleColumns` et le `set` de l'upsert n'écrivent pas ces colonnes).
- [ ] **Step 3:** Implémenter dans une seule transaction : remise à zéro de ce qui est marqué, puis écriture par jeu reconnu. Les lectures (liste, titres, identifiants des trophées) précèdent la transaction. Un jeu sans trophée marqué garde 0 et `null`.
- [ ] **Step 4:** Run. Expected : PASS.
- [ ] **Step 5:** Commit `feat(unobtainable): write the marks on games and trophies`.

### Task 5: Téléchargement

**Files:** Create `src/unobtainable/refresh.ts`, `src/unobtainable/refresh.test.ts`. Modify `src/settings/repo.ts`. Test `src/settings/repo.test.ts`.

**Interfaces — Consumes :** tâches 1, 2, 4. **Produces :**
- `export function isListDue(s: { requestedAt: Date | null; downloadedAt: Date | null; attemptedAt: Date | null }, now: Date): boolean`
- `export async function downloadList(url: string, fetchImpl?: typeof fetch): Promise<ParsedList>`
- `export async function refreshUnobtainableListIfDue(db: Db, now: Date, fetchImpl?: typeof fetch): Promise<void>`
- dans `repo.ts` : `Settings` gagne `unobtainableListUrl: string` et `unobtainableRequestedAt: Date | null` ; `export async function saveUnobtainableUrl(db: Db, url: string, now: Date): Promise<void>` (écrit l'adresse et la demande) ; `export async function clearUnobtainableRequest(db: Db, seen: Date): Promise<void>` (remet à `null` seulement si la valeur vaut encore `seen`).

- [ ] **Step 1: Write the failing tests**

```ts
// isListDue, H = 1 heure
it.each([
  ["requested, even just attempted", { requestedAt: now, downloadedAt: ago(H), attemptedAt: now }, true],
  ["never attempted", { requestedAt: null, downloadedAt: null, attemptedAt: null }, true],
  ["never downloaded, tried 59 min ago", { requestedAt: null, downloadedAt: null, attemptedAt: ago(59 * MIN) }, false],
  ["never downloaded, tried 1 h ago", { requestedAt: null, downloadedAt: null, attemptedAt: ago(H) }, true],
  ["fresh", { requestedAt: null, downloadedAt: ago(24 * H - MIN), attemptedAt: ago(24 * H - MIN) }, false],
  ["24 h old", { requestedAt: null, downloadedAt: ago(24 * H), attemptedAt: ago(24 * H) }, true],
  ["old but tried 30 min ago", { requestedAt: null, downloadedAt: ago(25 * H), attemptedAt: ago(30 * MIN) }, false],
])("%s", (_n, s, want) => expect(isListDue(s, now)).toBe(want));

// downloadList
it("reports a network failure", ...);      // fetchImpl rejette -> { ok:false, error: LIST_UNREACHABLE }
it("reports an HTTP error", ...);          // new Response("x",{status:404}) -> LIST_UNREACHABLE
it("reports non-JSON", ...);               // new Response("<html>") -> LIST_INVALID
it("never fetches a non-http address", ...); // "ftp://x" -> LIST_UNREACHABLE, fetchImpl non appelé
it("passes a timeout signal", ...);        // fetchImpl.mock.calls[0][1].signal instanceof AbortSignal
it("refuses a body over 10 MB without Content-Length", ...);
// new Response(new ReadableStream(...)) qui pousse des morceaux de 1 Mo sans fin -> LIST_INVALID, et le flux a été annulé

// refreshUnobtainableListIfDue (PGlite, un jeu « Dauntless » PS4 avec 2 trophées)
it("stores the list and marks the games", ...); // entries.length 1, downloadedAt & attemptedAt = now, error null, count 2
it("keeps the old list and marks on failure", ...); // 2e appel forcé, fetch KO : entries & count inchangés, downloadedAt inchangé, attemptedAt = now2, error LIST_UNREACHABLE
it("records a failure when there was no list", ...); // entries [], error posé, downloadedAt null
it("does nothing when not due", ...);       // fetchImpl non appelé
it("clears the request when done", ...);    // succès et échec -> unobtainableRequestedAt null
it("keeps a request made during the download", ...);
// fetchImpl appelle saveUnobtainableUrl(db, url2, later) avant de répondre -> unobtainableRequestedAt reste `later`
```

Dans `repo.test.ts` : `saveUnobtainableUrl` écrit les deux colonnes ; `clearUnobtainableRequest` ne change rien si la valeur a bougé.

- [ ] **Step 2:** Run. Expected : FAIL.
- [ ] **Step 3:** Implémenter.
  - `isListDue` : demandé → vrai ; tentative il y a moins d'1 h → faux ; jamais téléchargée → vrai ; sinon 24 h écoulées.
  - `downloadList` : `AbortSignal.timeout(30_000)`, lecture par `res.body.getReader()` avec un compteur d'octets, `reader.cancel()` au-delà de 10 Mo.
  - Écriture en `onConflictDoUpdate` sur `unobtainableList.id`. Après un succès, appeler `applyUnobtainable`.
  - La demande est effacée **à la fin** du téléchargement, avec la valeur lue au début.
- [ ] **Step 4:** Run. Expected : PASS.
- [ ] **Step 5:** Commit `feat(unobtainable): download the list on schedule and on request`.

### Task 6: Branchement dans le worker

**Files:** Modify `src/worker/scheduler.ts`. Test `src/worker/scheduler.test.ts`.

**Interfaces — Consumes :** `refreshUnobtainableListIfDue`, `applyUnobtainable`. **Produces :** `TickDeps` gagne `refreshUnobtainableList: typeof refreshUnobtainableListIfDue` et `applyUnobtainable: typeof applyUnobtainable`, renseignés par `defaultTickDeps`.

- [ ] **Step 1: Write the failing tests** (ajouter deux `vi.fn` aux `deps` du `beforeEach`)

```ts
it("refreshes the list before the PSN job", ...);        // invocationCallOrder de refresh < runSync
it("runs the PSN job when the list refresh throws", ...); // refresh rejette -> runSync appelé une fois
it("applies the marks after a job", ...);                // apply appelé 1 fois, après runSync ; idem pour un job daily
it("applies the marks after a failed job", ...);         // runSync -> { status: "error", error: "x" } -> apply appelé
it("does not apply after a skipped job", ...);           // { status: "skipped" } -> apply non appelé
it("still refreshes the list when no job is due", ...);  // jobState à jour -> refresh appelé, apply non appelé
```

- [ ] **Step 2:** Run. Expected : FAIL.
- [ ] **Step 3:** Dans `tick`, avant `takeSyncRequest` : appel de `refreshUnobtainableList(db, now)` dans un `try/catch` qui journalise. Après le job, si `result.status !== "skipped"` : `applyUnobtainable(db)`, dans un `try/catch` qui journalise.
- [ ] **Step 4:** Run. Expected : PASS.
- [ ] **Step 5:** Commit `feat(worker): refresh the unobtainable list and re-apply it after syncs`.

### Task 7: Textes et notes

**Files:** Create `src/unobtainable/labels.ts`, `src/unobtainable/note.ts`, et leurs `.test.ts`.

**Interfaces — Produces :**
- `export function unobtainableLabel(count: number, total: number): string`
- `export function unobtainableSituation(count: number, missing: number): string`
- `export type NoteSegment = { text: string; href?: string }`
- `export function parseNote(note: string | null): NoteSegment[]`
- `export function notePlainText(note: string | null): string | null`

- [ ] **Step 1: Write the failing tests**

```ts
it.each([[7,41,"7 unobtainable trophies"],[1,41,"1 unobtainable trophy"],[37,37,"All 37 trophies are unobtainable"],[1,1,"1 unobtainable trophy"]])(
  "label %i/%i", (c,t,s) => expect(unobtainableLabel(c,t)).toBe(s));
it.each([[7,4,", 4 you don't have"],[10,0,", you have them all"],[1,0,", you have it"],[1,1,", 1 you don't have"]])(
  "situation %i/%i", (c,m,s) => expect(unobtainableSituation(c,m)).toBe(s));

const closed = "The servers closed on January 31st, 2024: [more info.](https://forum.psnprofiles.com/topic/1)";
it("splits a link", () => expect(parseNote(closed)).toEqual([
  { text: "The servers closed on January 31st, 2024: " }, { text: "more info.", href: "https://forum.psnprofiles.com/topic/1" }]));
it("keeps text after a link", ...); // "A [b](https://x.dev) C" -> 3 segments
it("flattens to plain text", () => expect(notePlainText(closed)).toBe("The servers closed on January 31st, 2024: more info."));
it("never links a non-http address", () => expect(parseNote("[x](javascript:alert(1))").some((s) => s.href)).toBe(false));
it("leaves asterisks and backticks alone", () => expect(notePlainText('"Selfish b******" and Queen`s')).toBe('"Selfish b******" and Queen`s'));
it("leaves HTML as text", () => expect(parseNote("<b>x</b>")).toEqual([{ text: "<b>x</b>" }]));
it("handles no note", () => { expect(parseNote(null)).toEqual([]); expect(parseNote("")).toEqual([]); expect(notePlainText("")).toBeNull(); });
```

- [ ] **Step 2:** Run. Expected : FAIL.
- [ ] **Step 3:** Implémenter. Lien : `/\[([^\]]+)\]\(([^)\s]+)\)/g`, conservé en `href` seulement si `http:` ou `https:`, sinon le libellé en texte.
- [ ] **Step 4:** Run. Expected : PASS.
- [ ] **Step 5:** Commit `feat(unobtainable): labels and note parsing`.

### Task 8: Requête des jeux

**Files:** Modify `src/games/query.ts`, `src/games/row.ts`, `components/game-query-string.ts`, `app/api/games/route.ts`, `components/GameList.tsx` (paramètres de requête seulement), `app/(site)/(banner)/page.tsx` (`listKey`). Tests `src/games/query.test.ts`, `src/games/row.test.ts`, `components/game-query-string.test.ts`, et les objets `GameQuery` / `GameRowData` des tests existants.

**Interfaces — Consumes :** `unobtainableLabel`, `notePlainText` (tâche 7). **Produces :**
- `export const GAME_UNOBTAINABLE = ["off", "with", "without"] as const` ; `export type GameUnobtainable`
- `GameQuery` gagne `unobtainable: GameUnobtainable`
- `queryGames(db, query, opts: { hideZero: boolean; all?: boolean })`
- `GameRowData` gagne `unobtainable: { label: string; note: string | null } | null`

- [ ] **Step 1: Write the failing tests**

```ts
// query.test.ts : ajouter unobtainable: "off" à base. Seed : a (progress 50, unobtainableCount 2), b (50), c (100, count 3), z (0, count 1)
it("defaults to off and reads valid values", ...); // "" -> off ; "unobtainable=with" -> with ; "unobtainable=bogus" -> off
it("filters with and without", async () => { expect(await ids({ unobtainable: "with" })).toEqual(["a","c","z"]); expect(await ids({ unobtainable: "without" })).toEqual(["b"]); });
it("combines with the state filter", async () => expect(await ids({ state: "not100", unobtainable: "without" })).toEqual(["b"]));
it("combines with Hide 0%", async () => expect(await ids({ unobtainable: "with" }, true)).toEqual(["a","c"]));
it("counts the filtered total", ...); // queryGames(...with...).total === 3
it("returns every remaining game with all", ...); // 60 jeux : offset 50 + all -> 10 ; offset 0 sans all -> 50 ; offset 0 + all -> 60

// row.test.ts : titre avec unobtainableCount 7, definedPlatinum..Bronze = 41 au total, unobtainableNote "Closed: [more](https://x.dev)"
//   -> unobtainable toEqual { label: "7 unobtainable trophies", note: "Closed: more" } ; count 0 -> null

// game-query-string.test.ts
//   unobtainable "with" -> "unobtainable=with" ; "off" -> ""
```

- [ ] **Step 2:** Run. Expected : FAIL.
- [ ] **Step 3:** Implémenter.
  - Filtre : `gt(titles.unobtainableCount, 0)` ou `eq(titles.unobtainableCount, 0)`.
  - `all` : `.limit(10_000)` à la place de `PAGE_SIZE`.
  - Route : `all: searchParams.get("all") === "1"`.
  - `GameList.loadMore` transmet `unobtainable` ; `listKey` l'inclut.
- [ ] **Step 4:** `npx vitest run src/games components/game-query-string.test.ts components/GameList.test.tsx components/GameFilters.test.tsx components/GameRow.test.tsx && npx tsc --noEmit`. Expected : PASS.
- [ ] **Step 5:** Commit `feat(games): filter on unobtainable trophies and load all games`.

### Task 9: « ! » et filtre dans Games

**Files:** Create `components/UnobtainableMark.tsx`. Modify `components/GameRow.tsx`, `components/GameFilters.tsx`, `app/globals.css`. Tests `components/GameRow.test.tsx`, `components/GameFilters.test.tsx`.

**Interfaces — Produces :** `export function UnobtainableMark({ label, detail }: { label: string; detail?: string | null })`, qui rend `<i className="unob" role="img" aria-label=…>!<span className="tip"><b>{label}</b>{detail && <span>{detail}</span>}</span></i>`.

- [ ] **Step 1: Write the failing tests**

```ts
// GameRow
it("shows the mark after the platform badge", ...);
// unobtainable { label:"7 unobtainable trophies", note:"Closed." }
// -> .unob présent, contient les deux textes ; platform.compareDocumentPosition(mark) & DOCUMENT_POSITION_FOLLOWING
it("shows no mark otherwise", ...);        // unobtainable null -> .unob absent

// GameFilters
it("lists the three values", ...);         // getByLabelText("Filter by unobtainable trophies") : ["Unobtainable","With unobtainable","Without unobtainable"]
it("sits between the sort menu and the search", ...); // ordre dans le DOM
it("puts the value in the address", ...);  // fireEvent.change "with" -> replace("/?unobtainable=with", { scroll: false })
it("outlines the select only when active", ...); // classe "on" avec "with", absente avec "off"
```

- [ ] **Step 2:** Run. Expected : FAIL.
- [ ] **Step 3:** Implémenter. Copier de la maquette les règles `.unob`, `.unob .tip`, `.unob:hover .tip` et `select.select.on`, avec `width:min(270px,70vw)` pour l'infobulle. Dans `GameRow`, le « ! » suit les badges de plateforme.
- [ ] **Step 4:** Run. Expected : PASS.
- [ ] **Step 5:** Commit `feat(games): unobtainable mark and filter`.

### Task 10: Bouton « Show all »

**Files:** Modify `components/GameList.tsx`, `components/game-query-string.ts`, `app/(site)/(banner)/page.tsx`, `app/globals.css`. Test `components/GameList.test.tsx`.

**Interfaces — Produces :** `export const SHOW_ALL_SLOT_ID = "games-show-all"` dans `components/game-query-string.ts` (module sans `"use client"`, lisible par la page serveur).

- [ ] **Step 1: Write the failing tests** (un `<span id="games-show-all">` ajouté à `document.body` avant chaque rendu et retiré après)

```ts
it("offers Show all while games remain", ...);   // initial 50 / total 60 -> bouton "Show all" dans le slot
it("offers nothing when everything is loaded", ...); // 50 / 50 -> pas de bouton
it("loads the rest in one request", ...);
// clic : URL fetch contient "offset=50" et "all=1" ; bouton désactivé "Loading…" ; après : 60 lignes,
// plus de bouton, plus de "The next 50 games load as you scroll down"
it("gives the button back when it fails", ...);  // fetch KO -> "Show all" actif et "Couldn't load more games."
it("makes one request when scrolling races with Show all", ...);
// clic sans résoudre le fetch, puis trigger() de l'observer -> fetch appelé 1 fois ; après résolution, aucun id en double
```

- [ ] **Step 2:** Run. Expected : FAIL.
- [ ] **Step 3:** Implémenter.
  - `loadMore` et « Show all » partagent le même garde `busy` et une même fonction de chargement avec un paramètre `all`.
  - Le bouton est rendu par `createPortal` dans le slot, repéré après le montage, et seulement si `more`.
  - Dans `page.tsx` : `<div className="head-right"><span id={SHOW_ALL_SLOT_ID} /><span className="aside">…</span></div>`.
  - Copier `.head-right` et `.show-all` de la maquette.
- [ ] **Step 4:** Run. Expected : PASS.
- [ ] **Step 5:** Commit `feat(games): Show all button`.

### Task 11: Page d'un jeu

**Files:** Modify `src/games/detail.ts`, `components/game/TrophyList.tsx`, `app/(site)/games/[id]/page.tsx`, `app/globals.css`. Tests `src/games/detail.test.ts`, `components/game/TrophyList.test.tsx`.

**Interfaces — Consumes :** `UnobtainableMark`, `unobtainableLabel`, `unobtainableSituation`, `parseNote`. **Produces :**
- `TrophyRowData.unobtainable: boolean`
- `GameDetail.unobtainable: { label: string; situation: string; note: NoteSegment[] } | null`
- prop `unobtainable` de `TrophyList`, du même type

- [ ] **Step 1: Write the failing tests**

```ts
// detail.test.ts : unobtainableCount 3, 3 trophées marqués dont 1 obtenu, 4 trophées au total (defined*)
// -> detail.unobtainable toEqual { label:"3 unobtainable trophies", situation:", 2 you don't have", note:[{ text:"Closed." }] }
// -> detail.trophies[0].unobtainable === true ; jeu non marqué -> detail.unobtainable null

// TrophyList : ajouter unobtainable: false à trophy(), et la prop unobtainable={null} aux rendus existants
const band = { label:"7 unobtainable trophies", situation:", 4 you don't have", note:[{ text:"Closed: " },{ text:"more info.", href:"https://x.dev" }] };
it("shows the band with its link", ...);     // textes présents ; lien target "_blank", rel contient "noopener"
it("shows no band for other games", ...);    // null -> .unob-note absent
it("keeps the band when the filter hides every row", ...); // show "earned" sans trophée obtenu -> .unob-note présent
it("reddens an unearned unobtainable trophy", ...); // .trophy a "lost" ; tooltip "No longer obtainable."
it("keeps green for an earned one", ...);    // "earned", pas "lost", "!" présent ; tooltip "No longer obtainable. You already have it."
it("marks nothing else", ...);               // non marqué -> pas de .unob
it("renders HTML from a note as text", ...); // note [{ text:"<img src=x>" }] -> texte présent, container.querySelector("img[src='x']") null
```

- [ ] **Step 2:** Run. Expected : FAIL.
- [ ] **Step 3:** Implémenter. Le bandeau `.unob-note` vient entre `.tools` et la liste : `<b>{label}</b>{situation}`, puis les segments de note. `missing` compte les lignes marquées non obtenues. Copier de la maquette `.unob-note` et ajouter sous `.game-page` : `.trophy.lost` (`--rank-f`, fond à 14 %, anneau de 2 px) et `.trophy .n{display:flex;align-items:center;gap:8px}`.
- [ ] **Step 4:** Run. Expected : PASS.
- [ ] **Step 5:** Commit `feat(game): unobtainable band and trophy marks`.

### Task 12: Settings

**Files:** Create `src/unobtainable/status.ts`, `src/unobtainable/status.test.ts`. Modify `app/(site)/(banner)/settings/actions.ts`, `app/(site)/(banner)/settings/page.tsx`, `components/SettingsForms.tsx`. Test `components/SettingsForms.test.tsx`.

**Interfaces — Consumes :** `isListUrl`, `saveUnobtainableUrl`. **Produces :**
- `export type UnobtainableStatus = { url: string; badge: string; badgeClass: "valid" | "expired" | ""; detail: string | null; busy: boolean }`
- `export async function getUnobtainableStatus(db: Db): Promise<UnobtainableStatus>`
- `export async function saveUnobtainableListUrl(_prev: FormResult | null, form: FormData): Promise<FormResult>` (action)
- `export function UnobtainableForm({ url }: { url: string })`

- [ ] **Step 1: Write the failing tests**

```ts
// status.test.ts ; dates comparées via formatDateTime / formatDate
it("not downloaded yet", ...); // aucune ligne -> badge "Not downloaded yet", badgeClass "", detail null, busy false
it("downloading", ...);        // unobtainableRequestedAt posé -> badge "Downloading…", busy true
it("up to date", ...);         // 2 entrées, 1 jeu marqué et 1 jeu marqué masqué
// -> badge "Up to date", "valid", detail `Downloaded ${formatDateTime(d)} · 2 games in the list · 1 of yours`
it("failed with a previous list", ...);
// -> "Download failed", "expired", detail `Couldn't reach this address (${formatDateTime(t)}) · still using the list from ${formatDate(d)}`
it("failed with no list", ...); // -> detail `… · no list available yet`

// SettingsForms.test.tsx : ajouter saveUnobtainableListUrl: vi.fn() au vi.mock
it("shows the address and Save", ...); // getByLabelText("List address") a la valeur url ; bouton "Save"
```

- [ ] **Step 2:** Run. Expected : FAIL.
- [ ] **Step 3:** Implémenter.
  - Action : `requireSession`, `zod` (`string().trim().max(2048)`), refus par `isListUrl` avec le message `"Enter an http or https address."`, puis `saveUnobtainableUrl`, `revalidatePath("/", "layout")` comme les autres actions, et `{ ok: true, message: "Saved. Downloading the list…" }`.
  - Le nombre d'entrées se lit en SQL avec `jsonb_array_length`, sans charger la liste.
  - Page : section « Unobtainable trophies » après « PSN token », et `AutoRefresh active` vrai aussi si `status.busy`.
- [ ] **Step 4:** Run. Expected : PASS.
- [ ] **Step 5:** Commit `feat(settings): unobtainable list address and status`.

### Task 13: Vérification avec les vraies données

**Files:** Modify `docs/ETAT-DU-PROJET.md`.

- [ ] **Step 1:** `npx vitest run && npx tsc --noEmit && npm run build`. Expected : tout passe.
- [ ] **Step 2:** Lancer `npm run e2e:db` (s'il ne tourne pas déjà sur le port 5433), `npm run e2e:worker` et `npm run e2e:web` (arrêter d'abord les anciens `node.exe` du worker). La migration s'applique et la liste se télécharge au premier passage, même si le token PSN a expiré.
- [ ] **Step 3:** Vérifier en SQL (`npm run e2e:sql`) que les seuls jeux à `unobtainable_count > 0` sont : Gran Turismo Sport 7, Marvel Heroes Omega 37, Final Fantasy XV 10, Dauntless PS4 45, Dauntless PS5 46.
- [ ] **Step 4:** Parcourir la liste 14.11 de la spec dans le navigateur de l'app, avec une capture de chaque écran : infobulle, « With » = 5, « Not 100% » + « Without » = 40, « Show all » = 266, Gran Turismo Sport (4 rouges, 3 verts avec « ! »), Final Fantasy XV (groupes 004 et 007), Settings, adresse invalide puis inaccessible sans perte des repères, retour à l'adresse par défaut.
- [ ] **Step 5:** Mettre à jour `docs/ETAT-DU-PROJET.md` (fonctionnalité faite, PR à créer depuis github.com, nombre de tests). Commit `docs: project status after the unobtainable trophies`.
