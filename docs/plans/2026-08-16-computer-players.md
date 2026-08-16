# Computer Players Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let hosts start any non-empty lobby by filling open seats with score-seeking deterministic computer players.

**Architecture:** Game logic creates game-local computer records at start and exposes a pure selector over existing legal moves and analyses. The host UI observes an active computer turn, waits briefly, and atomically applies that selector's move. Realtime Database rules extend active-turn write permission only to the host acting for a marked computer player.

**Tech Stack:** React 18, Firebase Realtime Database, Node built-in test runner, Vite.

---

### Task 1: Add computer-player game logic

**Files:**
- Modify: `src/lib/gameLogic.js`
- Test: `tests/gameLogic.test.js`

**Step 1: Write failing tests**

Add tests showing `startMatchFromLobby` fills vacant seats with marked computers, and `selectComputerMove` prefers bonus points, then card captures, then a stable canonical tie-break.

**Step 2: Run focused test to verify it fails**

Run: `node --test tests/gameLogic.test.js`
Expected: FAIL because the computer selector/seat completion does not exist.

**Step 3: Write minimal implementation**

Add pure helpers that create computer player records, complete the four-seat lobby, and choose one legal move based on `analyzeMove` without modifying human-move behavior.

**Step 4: Run focused test to verify it passes**

Run: `node --test tests/gameLogic.test.js`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/lib/gameLogic.js tests/gameLogic.test.js
git commit -m "feat: add deterministic computer players"
```

### Task 2: Drive bot turns and improve responsive status UI

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/styles/app.css`

**Step 1: Add a focused browser-observable behavior target**

Use the running app at a phone viewport to establish the lobby/start layout and active computer-turn status to preserve.

**Step 2: Implement the minimal UI behavior**

Relax the host start gate to require at least one human. Add a host-only effect that schedules and transactionally applies a computer move. Label computer seats/turns and adjust narrow-screen CSS for legible controls and no overflow.

**Step 3: Build and inspect**

Run: `npm run build`, then inspect the local app at a phone viewport.

**Step 4: Commit**

```bash
git add src/App.jsx src/styles/app.css
git commit -m "feat: play computer turns from the host"
```

### Task 3: Authorize host-driven computer turns

**Files:**
- Modify: `database.rules.json`
- Test: manual Firebase rules review

**Step 1: Make the smallest rules change**

Permit an authenticated host to update a playing game only when the server's active turn points at a player marked `isComputer`; retain the current active-human UID path.

**Step 2: Validate rules syntax and run regression suite**

Run: `node -e "JSON.parse(require('node:fs').readFileSync('database.rules.json')); console.log('valid JSON')" && npm test && npm run build`

**Step 3: Commit**

```bash
git add database.rules.json
git commit -m "fix: authorize host-driven computer turns"
```

### Task 4: Final verification and PR

**Files:**
- Review: all modified files

**Step 1: Check the final diff**

Run: `git diff origin/main...HEAD --check && git status --short`

**Step 2: Re-run all checks**

Run: `npm test && npm run build`

**Step 3: Validate mobile UI**

At a phone viewport, verify the lobby action, computer seat status, and game layout remain visible with no horizontal scrolling.

**Step 4: Push and create a PR**

Push `feature/computer-players` and open a PR against `main` describing the bot policy, host-tab dependency, rules update, test results, and mobile check.
