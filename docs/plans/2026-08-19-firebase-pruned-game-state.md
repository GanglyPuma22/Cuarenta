# Firebase-Pruned Game State Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Keep a Cuarenta match playable through 40 points when Firebase Realtime Database omits empty arrays from persisted game state.

**Architecture:** Treat Firebase-loaded round collections as sparse transport data, not as complete in-memory game objects. Normalize the collections consumed by game logic before a move, make hand readers tolerate missing player entries as empty hands, and contain transaction-time exceptions in the UI.

**Tech Stack:** React, Firebase Realtime Database transactions, Node.js built-in test runner, Vite.

---

## Background and reproduction

Firebase Realtime Database can omit empty arrays: `round.hands.p1 = []` becomes absent in the next client snapshot. `visibleHandForPlayer()` calls `.some()` on that absent entry. After one seat finishes deal two, the following move evaluates every seat for deal completion and throws. The apparent computer stall happens while other players still have cards.

This is unrelated to connectivity, bot selection, or the 40-point continuation behavior. Every card has a legal trail. The fix must cover human-only and mixed human/computer matches.

### Task 1: Write direct pruning regressions

**Files:**
- Modify: `tests/gameLogic.test.js`
- Modify: `src/lib/gameLogic.js`

**Step 1: Write the failing test**

Create a state where a turn-order player's `round.hands` and/or `round.perDealHands[activeDeal]` entry is absent. Assert `getVisibleHand` returns `[]`, legal moves remain available for the active player, and applying that legal move does not throw while checking deal completion.

**Step 2: Run the focused test**

Run: `node --test tests/gameLogic.test.js`

Expected before implementation: failure from calling `.some` on an undefined player hand.

**Step 3: Implement minimal sparse-state normalization**

Add one internal normalization path for a cloned round before move processing. Ensure `hands`, `perDealHands`, each active-deal player-hand map, and `rondaClaims` exist with only missing entries defaulted to empty collections. Make `visibleHandForPlayer()` read missing per-deal and ownership entries as empty arrays. Preserve existing cards and do not alter legal-move or scoring rules.

**Step 4: Re-run the focused test**

Run: `node --test tests/gameLogic.test.js`

Expected: PASS.

**Step 5: Commit**

Run: `git add src/lib/gameLogic.js tests/gameLogic.test.js && git commit -m "fix: tolerate Firebase-pruned round arrays"`

### Task 2: Cover pruned `rondaClaims` at the deal boundary

**Files:**
- Modify: `tests/gameLogic.test.js`
- Modify: `src/lib/gameLogic.js`

**Step 1: Write the failing test**

Build a state that reaches deal-one completion after a simulated Firebase round-trip has removed empty `rondaClaims`. Ensure the deal-two announcement path does not throw and records a valid deterministic ronda when the fixture qualifies.

**Step 2: Run the focused suite**

Run: `node --test tests/gameLogic.test.js`

Expected before implementation: failure when `applyDealAnnouncements` appends to missing `rondaClaims`.

**Step 3: Implement the required normalization**

Use the Task 1 normalization boundary so `applyDealAnnouncements()` always appends to an array. Do not add a divergent second guard or change ronda scoring.

**Step 4: Re-run the focused suite**

Run: `node --test tests/gameLogic.test.js`

Expected: PASS.

**Step 5: Commit**

Run: `git add src/lib/gameLogic.js tests/gameLogic.test.js && git commit -m "test: cover pruned ronda claims"`

### Task 3: Add full-match Firebase transport simulations

**Files:**
- Modify: `tests/gameLogic.test.js`

**Step 1: Add a test-only Firebase-pruning simulator**

Create a local test helper that mimics relevant RTDB transport behavior after every move: remove zero-length per-player hand arrays, zero-length per-deal hand arrays, and zero-length `rondaClaims`. Keep this simulator out of production code.

**Step 2: Add complete-match tests**

Drive legal moves from game start until a team reaches 40 points, applying the pruning simulator after every move. Cover a four-human table (a legal move for each player) and a mixed table (`selectComputerMove()` for CPUs and legal human moves for people). Use deterministic fixtures/seeds and a safety bound only to fail non-terminating behavior. Assert finished status, winner score at/over 40, and no game-rule error. Exercise more than one complete match per configuration if fast.

**Step 3: Run the complete simulations**

Run: `node --test tests/gameLogic.test.js`

Expected: PASS, including full games after simulated Firebase pruning.

**Step 4: Commit**

Run: `git add tests/gameLogic.test.js && git commit -m "test: simulate Firebase pruning through full matches"`

### Task 4: Make transaction errors recoverable in the UI

**Files:**
- Modify: `src/App.jsx`

**Step 1: Inspect transaction call sites**

Review the host computer-turn timer and `playChosenMove`. Preserve host authority, existing concurrency guards, and normal UI behavior.

Correction applied during implementation: `startGame` uses the same fragile
`.catch()` chain and its update callback throws synchronously by design (the host
and empty-seating checks), so it has the identical stuck-busy defect. It is
included. `createGame` and `joinGame` already use `try/catch/finally` and are left
alone.

**Step 2: Contain synchronous and asynchronous transaction failures**

Use async `try/catch/finally` paths so exceptions thrown while evaluating an update callback become `setError(...)`, human busy state clears, and a computer timer does not throw out of its callback. Log the original error for diagnosis; do not change game state merely to log it.

**Step 3: Run existing coverage**

Run: `npm test`

Expected: PASS.

**Step 4: Commit**

Run: `git add src/App.jsx && git commit -m "fix: surface transaction callback failures"`

### Task 5: Final verification and implementation report

**Files:**
- Inspect: `src/lib/gameLogic.js`, `src/App.jsx`, `tests/gameLogic.test.js`

**Step 1: Run full verification**

Run: `npm test && npm run build && git diff --check && git status --short`

Expected: tests, full-match simulations, production build, and whitespace check all pass.

**Step 2: Report exact evidence**

Report test count, full-match configurations and run counts, build result, limitations, and commits. Do not push, open or merge a PR, or deploy; the supervising agent performs integration.
