# PSN Tracker : Stats au doigt et défilement de côté, Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** sur la page Stats, afficher les infobulles au doigt (tant qu'il est posé), et faire défiler de côté, sans barre, le graphique des années de sortie et le calendrier.

**Architecture :**
- **Infobulles** : chaque élément survolable reçoit les mêmes gestionnaires, fournis par `ChartTip.tsx` : le doigt posé affiche, le doigt levé cache (le navigateur envoie `pointerleave` après `pointerup` ou `pointercancel` pour un doigt). Au doigt, l'infobulle se place plus haut, centrée sur le doigt.
- **Défilement** : un hook `useSideScroll` gère un conteneur qui déborde : ouverture à la fin, glisser à la souris, fondus sur les bords. Le pavé tactile et le doigt utilisent le défilement natif du navigateur, la barre est seulement masquée.
- **Graphique des années** : `ColumnChart` reçoit une largeur minimale de colonne. Quand les colonnes ne tiennent plus, l'axe des nombres est dessiné à part et les colonnes défilent.
- Aucun changement côté serveur, aucune migration, aucune dépendance.

**Tech Stack :** Next.js 16 (App Router), React 19, TypeScript strict, Vitest + @testing-library/react + jsdom 31 (qui a `PointerEvent`).

**Spec :** [section 18.14](../specs/2026-11-07-psn-tracker-design.md), et 18.5, 18.9, 18.11. **Maquette validée** : [2026-11-11-psn-tracker-maquette-stats-defilement.html](../specs/2026-11-11-psn-tracker-maquette-stats-defilement.html), v6, référence du CSS du défilement (`.st-yc`, `.st-ys` y deviennent `.st-yc` et `.st-side`). Là où elle diffère de la spec, **la spec fait foi**.

## Global Constraints

- **Git** : branche `feat/stats-touch`. **Après chaque commit, push.** Messages de commit en anglais, terminés par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Langues et dépendances** : code en anglais. Aucun nouveau texte affiché. Aucune nouvelle dépendance.
- **Windows** : en Git Bash, `export PATH="/c/Program Files/nodejs:$PATH"`. Le chemin du dépôt contient `!` : le mettre entre apostrophes.
- **Tests** : `npx vitest run <fichier>`, puis `npx vitest run && npx tsc --noEmit` avant chaque commit. ESLint n'est pas configuré.
- **`app/globals.css` est un seul fichier global** : seules les règles `st-` changent. `.glass` piège `position:fixed`, `.panel` a `overflow:hidden`.
- **À la souris, rien ne change** : les tests existants de survol passent sans modification de leurs assertions.
- **Méthodes de capture du pointeur** (`setPointerCapture`, `hasPointerCapture`, `releasePointerCapture`) : toujours appelées avec `?.`, jsdom peut ne pas les avoir. `ResizeObserver` : vérifier qu'il existe avant de l'utiliser, jsdom ne l'a pas.

## Review Focus

Chaque ligne a son test dans la tâche indiquée.

1. **Doigt posé puis glissement vertical** : la page défile, le navigateur envoie `pointercancel`, l'infobulle disparaît (tâche 1).
2. **Largeur qui change après un défilement à la main** (téléphone tourné) : le graphique reste où on l'a mis. S'il était au bout, il y reste (tâche 2).
3. **Clic souris sans glisser** (moins de 4 px) sur un graphique qui défile : rien ne défile, l'infobulle de la colonne reste (tâches 2 et 3).
4. **Une seule année, ou des années toutes à 0, avec une largeur minimale** : aucun `NaN` ni `Infinity` dans le SVG (tâche 3).
5. **Doigt posé tout en haut de l'écran** : l'infobulle passe sous le doigt et reste dans l'écran (tâche 1).

---

### Task 1: Infobulles au doigt

**Files:**
- Modify: `src/stats/chart-geometry.ts` (`tipPosition`), `components/stats/ChartTip.tsx`, `components/stats/useCrosshair.ts`, `components/stats/ColumnChart.tsx`, `components/stats/DonutCard.tsx`, `components/stats/StatsCalendar.tsx`, `components/stats/TimeCharts.tsx`, `components/stats/LevelHistory.tsx`, `app/globals.css`
- Test: `src/stats/chart-geometry.test.ts`, `components/stats/ChartTip.test.tsx`, `components/stats/ColumnChart.test.tsx`, `components/stats/DonutCard.test.tsx`, `components/stats/StatsCalendar.test.tsx`, `components/stats/TimeCharts.test.tsx`
- Create: `app/stats-hover.test.ts`

**Interfaces:**
- Produces:
  - `tipPosition(pointer, size, viewport, touch = false)` : quatrième paramètre facultatif.
  - `Api.show(e: { clientX: number; clientY: number; pointerType?: string }, content: TipContent)` : une infobulle montrée avec `pointerType === "touch"` est placée au doigt.
  - `tipHandlers(tip: Api, content: () => TipContent): MarkHandlers`, exporté par `ChartTip.tsx`, avec `MarkHandlers = { onPointerDown, onPointerMove, onPointerLeave, onPointerCancel, onContextMenu }` (types d'événements React).
  - `preventTouchMenu(e: React.MouseEvent): void`, exporté par `ChartTip.tsx` : `preventDefault()` quand `(e.nativeEvent as PointerEvent).pointerType === "touch"`.
  - `useCrosshair(xs, tipFor)` renvoie `{ ref, index, handlers }` avec `handlers = { onPointerDown, onPointerMove, onPointerLeave, onPointerCancel, onContextMenu }` à étaler sur le rectangle `.hit`. Remplace `onMove` et `onLeave`.

- [ ] **Step 1: Write the failing tests**

`src/stats/chart-geometry.test.ts` :
```ts
it("puts a touch tooltip above the finger, centred on it", () => {
  expect(tipPosition({ x: 200, y: 300 }, { w: 100, h: 40 }, { w: 400, h: 800 }, true)).toEqual({ left: 150, top: 216 });
});
it("puts a touch tooltip below the finger when there is no room above", () => {
  expect(tipPosition({ x: 200, y: 60 }, { w: 100, h: 40 }, { w: 400, h: 800 }, true)).toEqual({ left: 150, top: 104 });
});
it("keeps a touch tooltip inside the screen", () => {
  expect(tipPosition({ x: 20, y: 300 }, { w: 100, h: 40 }, { w: 400, h: 800 }, true).left).toBe(8);
});
```

`components/stats/ChartTip.test.tsx` : `act(() => api.show({ clientX: 200, clientY: 300, pointerType: "touch" }, content))` donne `left: 200px` et `top: 256px` (jsdom mesure 0 × 0) ; le même appel sans `pointerType` donne `left: 214px` et `top: 290px`.

`components/stats/ColumnChart.test.tsx` :
- « shows the tooltip while a finger is down and hides it when lifted » : `fireEvent.pointerDown(hit[1], { pointerType: "touch", clientX: 200, clientY: 300 })` montre `2021` ; `fireEvent.pointerUp` puis `fireEvent.pointerLeave` sur le même rectangle : plus de `.st-tip`.
- « hides the tooltip when the page takes over the finger » : `pointerDown` au doigt puis `fireEvent.pointerCancel` seul : plus de `.st-tip`.
- « follows the finger from one column to the next » : `pointerDown` au doigt sur `hit[0]`, puis `pointerMove` au doigt sur `hit[1]` : l'infobulle dit `2021`.
- « blocks the long-press menu for a finger only » : `hit[0].dispatchEvent(new PointerEvent("contextmenu", { pointerType: "touch", bubbles: true, cancelable: true }))` renvoie `false` (défaut empêché) ; avec `pointerType: "mouse"`, renvoie `true`.

`components/stats/DonutCard.test.tsx` et `components/stats/StatsCalendar.test.tsx` : un `pointerDown` au doigt sur une part (`circle.seg`) ou un jour (`.st-cell` non `.out`) montre son infobulle, `pointerLeave` la cache.

`components/stats/TimeCharts.test.tsx` : un `pointerDown` au doigt sur `rect.hit` de « Monthly activity » affiche la ligne `line.xh` et l'infobulle du mois le plus proche ; `pointerCancel` les retire toutes les deux.

`app/stats-hover.test.ts` : lire `app/globals.css`, retirer les blocs `@media (hover:hover){…}` (accolades équilibrées), et vérifier que le reste ne contient plus `.st-cell:not(.out):hover` ni `circle.seg:hover`, et que le texte complet les contient toujours. Vérifier aussi que `.st-chart`, `.st-donut-svg` et `.st-cal` ont `user-select:none` et `-webkit-touch-callout:none`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/stats/chart-geometry.test.ts components/stats app/stats-hover.test.ts`
Expected: FAIL sur les nouveaux tests seulement.

- [ ] **Step 3: Implement**

- `tipPosition`, au doigt : `left = x - w / 2`, `top = y - h - 44`, et si `top < 8`, `top = y + 44`. Pas de bascule à gauche du pointeur comme à la souris : seulement les deux bornes finales (`left` entre 8 et `viewport.w - w - 8`, `top` au plus `viewport.h - h - 8`). À la souris, rien ne change.
- `ChartTipProvider` garde `touch` dans son état et le passe à `tipPosition`.
- `tipHandlers` : `onPointerDown` relâche la capture implicite du doigt (`e.currentTarget.hasPointerCapture?.(e.pointerId)` puis `releasePointerCapture?.`), pour que les événements suivants visent l'élément sous le doigt, puis affiche. `onPointerMove` affiche. `onPointerLeave` et `onPointerCancel` cachent. `onContextMenu` vaut `preventTouchMenu`.
- `useCrosshair` : `onPointerDown` fait comme `onPointerMove`, sans relâcher la capture (le doigt qui glisse sur une courbe reste attaché à son rectangle). `onPointerCancel` fait comme `onPointerLeave`.
- Appliquer `tipHandlers` sur `rect.hit` de `ColumnChart`, `circle.seg` de `DonutCard` et la case de `StatsCalendar`, et étaler `handlers` sur les trois `rect.hit` de `TimeCharts` et `LevelHistory`.
- `app/globals.css` : déplacer `.st-donut-svg circle.seg:hover`, `.st-cell:not(.out):hover` et `.st-scale .st-cell:hover` dans un même `@media (hover:hover){…}`, dans le même ordre. Ajouter `.st-chart,.st-donut-svg,.st-cal{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run && npx tsc --noEmit`
Expected: tout passe.

- [ ] **Step 5: Commit and push**

```bash
git add src/stats components/stats app/globals.css app/stats-hover.test.ts
git commit -m "feat: show the Stats tooltips while a finger is down"
git push
```

### Task 2: Défilement de côté, et le calendrier

**Files:**
- Create: `components/stats/useSideScroll.ts`, `components/stats/useSideScroll.test.tsx`
- Modify: `components/stats/StatsCalendar.tsx`, `app/globals.css`
- Test: `components/stats/StatsCalendar.test.tsx`

**Interfaces:**
- Consumes: `useChartTip()` de `ChartTip.tsx`, pour cacher l'infobulle au début d'un glisser.
- Produces: `useSideScroll<T extends HTMLElement>(): { ref: RefObject<T | null>; className: string; handlers: { onPointerDown; onPointerMove; onPointerUp; onPointerCancel; onScroll } }`. `className` vaut `"st-side"`, suivi de ` can` (le contenu déborde), ` drag` (glisser en cours), ` fl` (contenu caché à gauche), ` fr` (contenu caché à droite).

- [ ] **Step 1: Write the failing tests**

`components/stats/useSideScroll.test.tsx`, avec un petit composant qui pose `ref`, `className` et `handlers` sur une `div`, dans un `ChartTipProvider`. `scrollWidth` et `clientWidth` sont simulés par `vi.spyOn(HTMLElement.prototype, …, "get")`, `ResizeObserver` par une classe qui garde son callback :
- « opens at the end » : `scrollWidth` 1500, `clientWidth` 600 : `scrollLeft` vaut 1500, la classe contient `can` et `fl`, pas `fr`.
- « has no grab and no fade when everything fits » : `scrollWidth` = `clientWidth` = 600 : la classe vaut `st-side`.
- « fades both sides in the middle » : `scrollLeft = 300` puis `fireEvent.scroll` : `fl` et `fr`.
- « drags with the mouse » : à `scrollLeft` 300, `pointerDown` souris (`button: 0`, `clientX: 500`), `pointerMove` à `clientX: 560` : `scrollLeft` vaut 240 et la classe contient `drag` ; après `pointerUp`, plus de `drag`.
- « ignores a click that moves less than 4 px » : `pointerMove` à `clientX: 503` : `scrollLeft` reste 300, pas de `drag`.
- « leaves a finger to the browser » : `pointerDown` et `pointerMove` avec `pointerType: "touch"` : `scrollLeft` inchangé.
- « stops dragging on pointercancel » : après `pointerCancel`, un `pointerMove` ne fait plus défiler.
- « hides the open tooltip when a drag starts ».
- « stays at the end when the width changes » : au bout, `scrollWidth` passe à 2000, on appelle le callback du `ResizeObserver` : `scrollLeft` vaut 2000.
- « stays where the user left it when the width changes » : `scrollLeft = 100` puis `fireEvent.scroll`, `scrollWidth` passe à 2500, callback : `scrollLeft` reste 100.

`components/stats/StatsCalendar.test.tsx` : le test existant « scrolls to the most recent days on mount » passe toujours ; `.st-cal-scroll` porte aussi la classe `st-side`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run components/stats/useSideScroll.test.tsx components/stats/StatsCalendar.test.tsx`
Expected: FAIL (module absent, classe absente).

- [ ] **Step 3: Implement**

- `useSideScroll` : un `pinned` (ref, vrai au départ) dit si l'on est au bout. Après chaque rendu (`useLayoutEffect` sans dépendances) et à chaque appel du `ResizeObserver` posé sur le conteneur : si `pinned`, `scrollLeft = scrollWidth`, puis recalculer `can`, `fl`, `fr` (1 px de tolérance) et ne mettre à jour l'état que s'ils changent. `onScroll` : `pinned = scrollLeft >= scrollWidth - clientWidth - 1`, puis recalculer.
- Glisser : seulement pour `pointerType === "mouse"`, `button === 0` et un contenu qui déborde. Le glisser commence après 4 px (`Math.abs(dx) > 3`) : classe `drag`, `setPointerCapture?.(pointerId)`, infobulle cachée. Ensuite `scrollLeft = départ - dx`. `pointerUp` et `pointerCancel` terminent.
- `StatsCalendar` : remplacer sa ref et son `useEffect` de défilement par `useSideScroll`, sur la `div.st-cal-scroll`.
- `app/globals.css`, d'après la maquette v6 : retirer `scrollbar-width:thin` de `.st-cal-scroll` ; ajouter `.st-side{overflow-x:auto;overflow-y:hidden;scrollbar-width:none;overscroll-behavior-x:contain}`, `.st-side::-webkit-scrollbar{display:none}`, `.st-side.can{cursor:grab}`, `.st-side.drag{cursor:grabbing}`, les trois masques de fondu de 32 px (`.fl`, `.fr`, `.fl.fr`, avec `-webkit-mask-image` et `mask-image`), et `.st-side svg{touch-action:pan-x pan-y}` placé après `.st-chart svg`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run && npx tsc --noEmit`
Expected: tout passe.

- [ ] **Step 5: Commit and push**

```bash
git add components/stats app/globals.css
git commit -m "feat: scroll the Stats calendar sideways without a scrollbar"
git push
```

### Task 3: Le graphique des années qui défile

**Files:**
- Modify: `components/stats/ColumnChart.tsx`, `components/stats/StatsPanels.tsx`, `app/globals.css`
- Test: `components/stats/ColumnChart.test.tsx`, `components/stats/StatsPanels.test.tsx`

**Interfaces:**
- Consumes: `useSideScroll` (tâche 2), `tipHandlers` (tâche 1).
- Produces: prop facultative `minSlot?: number` de `ColumnChart`. `StatsPanels` la met à `24` pour « Games by release year » seulement.

- [ ] **Step 1: Write the failing tests**

`components/stats/ColumnChart.test.tsx` :
- « keeps the columns 18 px wide and scrolls when they do not fit » : `stubMeasure(400)`, 30 valeurs, `minSlot: 24` : le SVG de `.st-side` mesure `724` de large (30 × 24 + 4), chaque `rect.hit` `24`, et la largeur dessinée d'une colonne vaut 18. Les nombres de l'axe sont dans un SVG à part, `svg.st-yaxis`, hors de `.st-side`.
- « fills the width when the columns fit » : `stubMeasure(600)`, 3 valeurs, `minSlot: 24` : le SVG de `.st-side` mesure `524` (600 − 32 − 44).
- « opens on the most recent years » : `scrollWidth` simulé à 724 : `.st-side` a `scrollLeft` 724.
- « shows the tooltip of a column in scroll mode » : `pointerMove` sur un `rect.hit` montre son année.
- « keeps the tooltip on a mouse click without a drag » : `scrollWidth` simulé à 724, `pointerDown` souris (`button: 0`) sur un `rect.hit` puis `pointerUp` : l'infobulle de l'année est toujours là et `scrollLeft` n'a pas bougé.
- « has no NaN in scroll mode with one value or only zeros ».
- Sans `minSlot`, les tests existants passent tels quels et il n'y a ni `.st-side` ni `svg.st-yaxis`.

`components/stats/StatsPanels.test.tsx` : le panneau « Games by release year » contient `.st-side`, « Trophies by time » non.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run components/stats/ColumnChart.test.tsx components/stats/StatsPanels.test.tsx`
Expected: FAIL sur les nouveaux tests seulement.

- [ ] **Step 3: Implement**

Avec `minSlot` : `slot = Math.max(minSlot, plot / n)` où `plot = w - M.l - M.r`, largeur de colonne `Math.max(Math.min(24, slot - 6), 1)` comme aujourd'hui, largeur du SVG des colonnes `slot * n + M.r`. Le rendu devient `div.st-yc` (flex) contenant `svg.st-yaxis` (largeur `M.l`, `aria-hidden`, les nombres de l'axe) puis la `div` de `useSideScroll` avec le SVG des colonnes (`role="img"`, `aria-label`), où les lignes de grille vont de 0 à sa largeur et la colonne `i` commence à `slot * i`. Étiquettes, valeur record et rectangles `.hit` y sont comme aujourd'hui. `useSideScroll` est appelé dans tous les cas (règle des hooks), et ne sert que si `minSlot` est donné. Sans `minSlot`, le rendu ne change pas. CSS : `.st-yc{display:flex}`, `.st-yc .st-yaxis{flex:none}`, `.st-yc .st-side{flex:1;min-width:0}`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run && npx tsc --noEmit`
Expected: tout passe.

- [ ] **Step 5: Commit and push**

```bash
git add components/stats app/globals.css
git commit -m "feat: scroll the release-year chart sideways once the years no longer fit"
git push
```

---

## Vérification avec les vraies données (après les tâches)

Sur le build de production local (`npm run e2e:*`, voir `docs/ETAT-DU-PROJET.md`, section 5), page `/stats`, dans le navigateur de l'app :
- Largeur PC : « Games by release year » ne défile pas, et ressemble à avant. Infobulles à la souris inchangées partout.
- Largeur téléphone (375 px) : le graphique des années s'ouvre sur `'26`, se déplace au clic maintenu, sans barre, avec un fondu du côté des années cachées, et la page ne défile pas de côté. Le calendrier pareil.
- Événements tactiles simulés en JavaScript (`PointerEvent` avec `pointerType: "touch"`) : infobulle au doigt posé, au-dessus du doigt, cachée au doigt levé, sur une colonne, une part d'anneau, un jour et une courbe.
- Non vérifiable ici : un vrai écran tactile, le pavé tactile d'un Mac.
