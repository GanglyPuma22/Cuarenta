# Mobile Play Surface Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make Cuarenta's active turn playable on a phone, highlight caída correctly, and animate every resolved move.

**Architecture:** Keep `getLegalMoves` and `applyMove` authoritative. Add a presentation-only display-action selector, derive feedback from the resolved round transition, and use CSS transitions/keyframes plus short-lived React state. Responsive CSS reorders the active play surface without changing desktop behavior.

**Tech Stack:** React 19, Vite, native Node test runner, CSS media queries/keyframes, Firebase Realtime Database.

---

### Task 1: Cover caída display-action priority

**Files:**
- Modify: `tests/gameLogic.test.js`
- Modify: `src/lib/gameLogic.js`

1. Write a failing test showing that, for one selected card with a live caída and a sequence above it, the display list contains the caída action and legitimate alternative captures but excludes ambiguous ordinary matching and trail actions.
2. Run: `npm test -- --test-name-pattern="caída display"`. Expected: FAIL because the display-action selector is absent.
3. Add pure `getDisplayedMoves` beside `getLegalMoves`. It accepts current game/player/actions, uses `analyzeMove`, and filters only the presentation list when a live caída exists for the selected card. Do not change legal-move or apply-move behavior.
4. Re-run the focused test. Expected: PASS.
5. Commit: `feat: prioritize caída display actions`.

### Task 2: Render explicit active-move hierarchy

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/styles/app.css`
- Test: `tests/gameLogic.test.js`

1. Add a pure test for selector ordering and the caída label/sequence count; do not add a component-test framework.
2. Run it first and verify failure.
3. Use the selector in `MovePicker`. Render the caída first with dedicated styling, a `CAÍDA +2` label, and full sweep badges. Keep legitimate non-matching captures available.
4. Re-run focused tests and commit: `feat: highlight live caída choices`.

### Task 3: Add resolved-move presentation state

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/styles/app.css`
- Test: `tests/gameLogic.test.js`

1. Write a failing pure transition-helper test mapping a resolved outcome to `trail`, `capture`, `sequence`, `caida`, `limpia`, or `caida-limpia`.
2. Run: `npm test -- --test-name-pattern="resolved move feedback"`; verify failure.
3. Keep a short-lived feedback state when a local play transaction commits. Animate the played card, capture targets, and capture-pile transition; add a large outcome overlay and `aria-live` announcement for special moves. Remote state changes must render immediately if no local transition is available.
4. Re-run focused tests and commit: `feat: animate resolved table moves`.

### Task 4: Add sound and reduced-motion behavior

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/styles/app.css`
- Test: `tests/gameLogic.test.js`

1. Write a failing pure test for feedback-to-audio-cue mapping.
2. Add a visible mute control and short generated/Web Audio cues after a player interaction has enabled audio. Add a `prefers-reduced-motion` block that removes movement but preserves outcome text and highlights.
3. Re-run focused tests and commit: `feat: add accessible move feedback cues`.

### Task 5: Reflow the mobile play surface

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/styles/app.css`

1. Define manual acceptance checks: in narrow portrait and landscape, the felt, selected card, and live action list are reachable together; side panels are collapsed or behind Details; desktop is unchanged.
2. Use width and landscape media queries to put felt and choices side by side on mobile landscape, retain a sticky action tray on portrait, and collapse secondary panels.
3. Run: `npm test && npm run build && git diff --check`.
4. Manually inspect ordinary capture, sequence, caída, limpia, and reduced-motion states in narrow portrait and landscape.
5. Commit: `feat: optimize the mobile play surface`.
