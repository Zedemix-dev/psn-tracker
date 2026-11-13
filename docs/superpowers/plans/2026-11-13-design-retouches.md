# Design retouches D1-D7 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the seven design points of the audit on phones (menu, Games header, cut lines, Settings, touch zones, reduced motion) without changing the desktop look.

**Architecture:** Mostly CSS in `app/globals.css` and the page CSS files, under the existing `@media (max-width:640px)` breakpoint. The menu gets a small pure module (`components/tab-strip.ts`) used by the existing client component `TopMenu`. Settings changes stay in `components/SettingsForms.tsx`; the sync history text moves to a tested pure function.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 7, plain CSS, Vitest (node and jsdom projects) with Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-07-psn-tracker-design.md`, section 22 (validated mockup: `.superpowers/brainstorm/maquettes/retouches-v1.html` + `retouches-v1-frame.html`, variant B for D1, D7 and D2).

## Global Constraints

- UI text in English, exactly: `Settings`, `Choose image`, `No file chosen`, `Upload banner`, `Automatic — last played game (<game>)`, `Default banner`. Code, comments and commit messages in English.
- Phone breakpoint: the existing `@media (max-width:640px)`. Above 640 px nothing changes, except D4 (only when a line wraps) and D6 (only under `prefers-reduced-motion: reduce`).
- Menu fade: 32 px, the same gradients as `.st-side.fl`, `.st-side.fr`, `.st-side.fl.fr` in `app/styles/stats.css`.
- CSS style of the repo: one rule per line, compact declarations, no new global stylesheet. Games list rules live in `app/globals.css`; page rules in `app/styles/<page>.css`.
- Tests: `npx vitest run`, `npx tsc --noEmit`, `npm run lint` (once per PC: `npm ci --prefix tools/eslint`). In Git Bash first `export PATH="/c/Program Files/nodejs:$PATH"`; quote the repo path (it contains `!`).
- Next.js 16: read `AGENTS.md` and the relevant guide in `node_modules/next/dist/docs/` before touching Next APIs (`usePathname` is the only one used here).
- Each commit ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and is pushed right after (`git push`). Never `git stash`. Never commit `.claude/launch.json`.

## Review Focus

- A phone turned sideways or a resized window: the menu fades must follow the new width (Task 1, ResizeObserver test).
- Keyboard users tabbing onto a hidden tab: the browser scrolls it into view, and the fades must follow the scroll (Task 1, scroll-event test).
- Desktop and any width where the tabs fit: no fade class at all, or the pills would be faded (Task 1, no-overflow tests).
- Opening the file dialog then cancelling: the name goes back to `No file chosen` and `Upload banner` is disabled again (Task 4 test).
- A very long file name without spaces must wrap inside 375 px, not widen the page (Task 4, CSS test on `overflow-wrap:anywhere`).

---

### Task 1: D1, the menu on phones

**Files:**
- Create: `components/tab-strip.ts`, `components/tab-strip.test.ts`, `components/TopMenu.test.tsx`
- Modify: `components/TopMenu.tsx`, `app/globals.css:33-38` (top menu rules) and the `@media (max-width:640px)` block (`app/globals.css:84-94`)

**Interfaces:**
- Produces: `TAB_FADE_PX = 32`; `edgeFades(view: StripView): { fl: boolean; fr: boolean }`; `scrollToShow(view: StripView, item: { left: number; width: number }): number | null`, where `type StripView = { scrollLeft: number; clientWidth: number; scrollWidth: number }` and `item.left` is the tab's position in the strip's content (its `offsetLeft`, the nav being its offset parent).

Rules the functions implement (tolerance 1 px, as in `components/stats/useSideScroll.ts`):
- `max = scrollWidth - clientWidth`; overflow only when `scrollWidth > clientWidth + 1`. Without overflow: `{ fl: false, fr: false }` and `scrollToShow` returns `null`.
- `fl = overflow && scrollLeft > 1`; `fr = overflow && scrollLeft < max - 1`.
- A tab counts as visible when it lies inside `[scrollLeft + (fl ? 32 : 0), scrollLeft + clientWidth - (fr ? 32 : 0)]`. Visible → `null`. Otherwise → `Math.round(item.left - (clientWidth - item.width) / 2)` clamped to `[0, max]`.

- [ ] **Step 1: Write the failing tests** in `components/tab-strip.test.ts` (node project), with the tab sizes measured at 375 px once Settings is an icon: lefts/widths Games 0/74, Plat Wall 80/85, Trophy Log 171/102, Trophy Advisor 279/129, Stats 414/63; `scrollWidth 477`, `clientWidth 293`, so `max = 184`.

```ts
const v = (scrollLeft: number, clientWidth = 293) => ({ scrollLeft, clientWidth, scrollWidth: 477 });
it("fades the right edge at the start, the left at the end, both between", () => {
  expect(edgeFades(v(0))).toEqual({ fl: false, fr: true });
  expect(edgeFades(v(184))).toEqual({ fl: true, fr: false });
  expect(edgeFades(v(90))).toEqual({ fl: true, fr: true });
});
it("never fades when the tabs fit", () => expect(edgeFades(v(0, 600))).toEqual({ fl: false, fr: false }));
it("centres a hidden tab, clamped to the end", () => {
  expect(scrollToShow(v(0), { left: 414, width: 63 })).toBe(184); // Stats
  expect(scrollToShow(v(0), { left: 171, width: 102 })).toBe(76); // Trophy Log, under the right fade
});
it("leaves a fully visible tab alone", () => {
  expect(scrollToShow(v(0), { left: 0, width: 74 })).toBeNull();
  expect(scrollToShow(v(0), { left: 80, width: 85 })).toBeNull();
  expect(scrollToShow(v(184), { left: 279, width: 129 })).toBeNull();
  expect(scrollToShow(v(0, 600), { left: 414, width: 63 })).toBeNull();
});
```

`components/TopMenu.test.tsx` (jsdom): mock `next/navigation` (`usePathname: () => path`); spy `scrollWidth`/`clientWidth` getters on `HTMLElement.prototype` (477/293, as in `components/stats/useSideScroll.test.tsx`), and `offsetLeft`/`offsetWidth` returning the sizes above by the element's text; stub `ResizeObserver` and keep its callback.
- `opens on /stats with the Stats tab in view`: nav (`getByRole("navigation", { name: "Pages" })`) has `scrollLeft === 184`, class `fl`, not `fr`.
- `stays at the start on /`: `scrollLeft === 0`, class `fr`, not `fl`.
- `follows a scroll`: on `/`, set `scrollLeft = 90`, `fireEvent.scroll(nav)` → classes `fl` and `fr`.
- `follows a resize`: on `/`, set `clientWidth` to 600, call the stored ResizeObserver callback inside `act` → neither `fl` nor `fr`.
- `names the Settings link`: `getByRole("link", { name: "Settings" })` exists and has `aria-current="page"` on `/settings`.

- [ ] **Step 2: Run them and check they fail**

Run: `npx vitest run components/tab-strip.test.ts components/TopMenu.test.tsx`
Expected: FAIL (module `./tab-strip` not found; no `fl`/`fr` classes).

- [ ] **Step 3: Implement `components/tab-strip.ts`**, then wire `TopMenu`: a ref on the `<nav className="tabs">`; a layout effect keyed on `pathname` that applies `scrollToShow` to the current tab (`[aria-current]`) and then measures `edgeFades`; a scroll listener and a `ResizeObserver` that measure again; the classes `fl`/`fr` added to `tabs`. The Settings link gets `className="pill set-pill"`, `aria-label="Settings"`, and its text wrapped in `<span className="set-pill-label">Settings</span>`. No mouse drag, no smooth scrolling.

- [ ] **Step 4: CSS in `app/globals.css`**
- `.tabs` gets `position:relative` (the nav becomes the tabs' offset parent).
- `.tabs.fl`, `.tabs.fr`, `.tabs.fl.fr`: the three `mask-image` gradients of `app/styles/stats.css:17-19`, with the `-webkit-` prefix, 32 px.
- In the 640 px block: `.set-pill{width:32px;height:32px;padding:0;justify-content:center}`, `.set-pill .set-pill-label{display:none}`, `.set-pill svg.ico{width:16px;height:16px}`.

- [ ] **Step 5: Run the tests, tsc and lint**

Run: `npx vitest run components/tab-strip.test.ts components/TopMenu.test.tsx && npx tsc --noEmit && npm run lint`
Expected: PASS, no type or lint error.

- [ ] **Step 6: Commit and push**

```bash
git add components/tab-strip.ts components/tab-strip.test.ts components/TopMenu.tsx components/TopMenu.test.tsx app/globals.css
git commit -m "feat(menu): fade the cut edges, bring the current tab into view, Settings as an icon on phones (D1)"
git push
```

### Task 2: D4, no separator left alone when a line wraps

**Files:**
- Modify: `components/GameRow.tsx:36-45`, `components/game/GameBand.tsx:16-23`, `app/globals.css:143-144`, `app/styles/game.css:5-6`
- Test: `components/GameRow.test.tsx:46-63` (two existing tests rely on `.sep`), `components/game/GameBand.test.tsx` (create it if it does not exist)

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: meta lines are plain sibling `<span>`s (no `.sep` element, no `display:contents` wrapper); the separator is drawn by CSS.

The separator becomes a `::before` of every part after the first, centred in the 8 px gap, and the line clips what overflows its box: a part that wraps starts at the left edge, so its separator falls outside the box and is hidden.

```css
.game-meta{…existing…;overflow:hidden}
.game-meta>span+span{position:relative}
.game-meta>span+span::before{content:"";position:absolute;left:-4.5px;top:50%;width:1px;height:11px;margin-top:-5.5px;background:rgba(255,255,255,.28)}
```

Same three rules for `.game-page .gmeta` in `app/styles/game.css`; remove `.game-meta .sep` and `.game-page .sep`.

- [ ] **Step 1: Update the tests.** In `components/GameRow.test.tsx`, replace the `.sep` tests: `renders the last played line as sibling parts` (the second `.game-meta` has exactly two child `span`s with the two texts and no `.sep`), `keeps a single part alone` (one child span). Extend `game row CSS`: `.game-meta` matches `/overflow:hidden/`; `.game-meta>span+span::before` exists and matches `/left:-4\.5px/`; no line starts with `.game-meta .sep`. Same pattern for `GameBand` (parts as sibling spans) and for `app/styles/game.css` (`.game-page .gmeta` with `overflow:hidden`, the `::before` rule, no `.game-page .sep`).
- [ ] **Step 2: Run them, expect FAIL**: `npx vitest run components/GameRow.test.tsx components/game/GameBand.test.tsx`
- [ ] **Step 3: Implement** the markup and the CSS above.
- [ ] **Step 4: Run them, then the whole suite, expect PASS**: `npx vitest run && npx tsc --noEmit && npm run lint`
- [ ] **Step 5: Commit and push**: `fix(games): no separator left alone when a meta line wraps (D4)`

### Task 3: D7, D3 and D6, phone header, touch zones, reduced motion

**Files:**
- Modify: `app/(site)/(banner)/page.tsx:73` (class on the Games panel head), `app/globals.css` (640 px block, reduced-motion rule at line 97), `app/styles/plat-wall.css:46`
- Create: `app/phone-and-motion-css.test.ts` (reads the CSS as text, like `app/show-all-order.test.ts`)

**Interfaces:**
- Consumes: nothing from Tasks 1-2.

- [ ] **Step 1: Write the failing test** `app/phone-and-motion-css.test.ts`. Helper: the text of the `@media (max-width:640px)` blocks and of the `@media (prefers-reduced-motion:reduce)` blocks of a file.
  - D7: `page.tsx` source contains `className="panel-head games-head"`; in the 640 px CSS, `.games-head .ph-left,.games-head .head-right{display:contents}` (or the same two selectors in one rule), `.games-head .toggle` with `order:4` and `flex-basis:100%`, and the Show all slot pushed right (`margin-left:auto`).
  - D3: in the 640 px CSS, one rule for `.btn-sync::after`, `.show-all::after` and `.edit-btn::after` containing `height:max(100%,32px)` and `position:absolute`, and `position:relative` on `.btn-sync`, `.show-all`, `.edit-btn`.
  - D6: in `app/globals.css`'s reduced-motion CSS, `*,*::before,*::after{transition:none!important}`; in `app/styles/plat-wall.css`'s reduced-motion CSS, `.spin{animation:none}`.
- [ ] **Step 2: Run it, expect FAIL**: `npx vitest run app/phone-and-motion-css.test.ts`
- [ ] **Step 3: Implement.**
  - D7: below 640 px, the Games head wraps (`flex-wrap:wrap`, `column-gap:10px`, `row-gap:8px`). `.ph-left` and `.head-right` become `display:contents`, so the order is `h2` (1), the count `.aside` (2), the Show all slot (3, `margin-left:auto`) and the toggle (4, `flex-basis:100%`). The existing `.head-right>span:empty{display:none}` keeps hiding an empty slot. Only the Games head carries `games-head`.
  - D3: the zone is `::after{content:"";position:absolute;left:0;right:0;top:50%;height:max(100%,32px);transform:translateY(-50%)}` on the three buttons, under 640 px only.
  - D6: merge the existing `.btn-sync.busy svg{animation:none}` rule into the new reduced-motion block of `app/globals.css`; add the `.spin` rule to `app/styles/plat-wall.css` right after `.spin`.
- [ ] **Step 4: Run, expect PASS**: `npx vitest run && npx tsc --noEmit && npm run lint`
- [ ] **Step 5: Commit and push**: `feat(phone): Games header on two lines, 32 px touch zones, no transitions under reduced motion (D7, D3, D6)`

### Task 4: D2 and D5, Settings

**Files:**
- Create: `src/sync/run-details.ts`, `src/sync/run-details.test.ts`
- Modify: `components/SettingsForms.tsx:37-75` (`BannerForm`), `app/styles/settings.css:7,14`, `app/(site)/(banner)/settings/page.tsx:125`
- Test: `components/SettingsForms.test.tsx`

**Interfaces:**
- Produces: `formatRunDetails(run: { error: string | null; titlesDone: number; titlesTotal: number; trophiesUpdated: number }): string`. It returns the error text when there is one, else `` `${formatInt(titlesDone)}/${formatInt(titlesTotal)} games, ${formatInt(trophiesUpdated)} trophies` `` (`formatInt` from `src/lib/format.ts`).

- [ ] **Step 1: Write the failing tests.**
  - `src/sync/run-details.test.ts`: `formatRunDetails({ error: null, titlesDone: 266, titlesTotal: 266, trophiesUpdated: 12434 })` is `"266/266 games, 12,434 trophies"`; `{ titlesDone: 1200, titlesTotal: 1500, … }` gives `"1,200/1,500 games, …"`; with `error: "PSN token expired"` it is `"PSN token expired"`.
  - `components/SettingsForms.test.tsx`, `BannerForm` (stub `URL.createObjectURL` → `"blob:x"` and `URL.revokeObjectURL`):
    - `shows the automatic caption under the preview`: the text `Automatic — last played game (Cyberpunk 2077)` exists, is not inside the `Banner preview` image, and is the preview's next element sibling.
    - `keeps Default banner inside the empty preview` (no `bannerUrl`, no `auto`).
    - `replaces the file field with Choose image`: `No file chosen` is shown, `Upload banner` is disabled; after `fireEvent.change` on the file input with `new File(["x"], "banner.png", { type: "image/png" })`, `banner.png` is shown and `Upload banner` is enabled. The input is reachable by `getByLabelText(/Choose image/)`.
    - `goes back to No file chosen when the dialog is cancelled`: a change with an empty `files` list after a file → `No file chosen`, `Upload banner` disabled.
  - Add to `app/phone-and-motion-css.test.ts` (or a new `app/settings-css.test.ts`): the file name rule in `app/styles/settings.css` contains `overflow-wrap:anywhere`.
- [ ] **Step 2: Run, expect FAIL**: `npx vitest run src/sync/run-details.test.ts components/SettingsForms.test.tsx`
- [ ] **Step 3: Implement.**
  - The caption moves out of `.set-preview` into `<p className="set-preview-cap">` right after it (12 px, `var(--muted)`, `margin:-6px 0 0`). `Default banner` stays inside the empty preview.
  - The file input, placed first in a `<div className="set-file">`, gets a visually-hidden class (`set-file-input`: 1 px, clipped, still focusable). It is followed by `<label htmlFor="banner-file" className="set-btn ghost set-file-btn">` with an image icon (`svg.ico`, `aria-hidden`) and `Choose image`, then `<span className="set-file-name">` with the file name or `No file chosen`.
  - `set-file-input:focus-visible + .set-file-btn` gets the site's focus outline. The old `.set-row input[type=file]` rule goes.
  - The file name comes from the same change handler that sets the preview. `Upload banner` is `disabled={pending || !fileName}`.
  - Keep the label `Image (JPEG, PNG or WebP, 10 MB max)` and `required`.
  - The Settings page uses `formatRunDetails(r)` in the Details cell.
- [ ] **Step 4: Run, expect PASS**: `npx vitest run && npx tsc --noEmit && npm run lint`
- [ ] **Step 5: Commit and push**: `feat(settings): Choose image button, caption under the banner preview, grouped thousands in the sync history (D2, D5)`

### Task 5: Verification with real data and docs (controller)

- [ ] **Step 1: Production build and local site** as in `docs/ETAT-DU-PROJET.md` section 5 (`npm run e2e:build`, then the running `e2e:prod`); never a second worker.
- [ ] **Step 2: Phone, 375 px**, every point of spec 22.6. The menu on each page, including Stats and Trophy Advisor opened directly. The Games header. Separators in game rows and on a game page. A real image chosen and uploaded, then `Use automatic banner`. The history numbers. Touch zones measured with `document.elementFromPoint` 15 px above and below each button's centre.
- [ ] **Step 3: Desktop, 1,630 px**: computed styles of every element captured before (main) and after (branch) on Games, a game page, Plat Wall, Trophy Log, Trophy Advisor, Stats and Settings. They must be identical except `.tabs` (`position`), the meta lines (`overflow`) and the Settings banner form.
- [ ] **Step 4: Docs**: `a_reprendre.md` (D1-D7 *Fait*), `docs/ETAT-DU-PROJET.md` (branch summary, next step: the NAS deploy), spec 22 (built and verified, date), then commit and push.
- [ ] **Step 5: Final whole-branch review**, then the PR title and text for the user.
