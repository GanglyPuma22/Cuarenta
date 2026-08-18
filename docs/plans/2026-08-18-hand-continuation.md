# Hand Continuation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Continue Cuarenta hands automatically until a team reaches 40 points, reliably scheduling a computer that opens the next hand.

**Architecture:** Preserve `applyMove` and `finalizeHand` as the authoritative state transition. Add a small pure automation-turn identity derived from the active hand/deal/turn, and make the host bot effect depend on it. The terminal 40-point decision stays before new-hand construction; the UI consumes the new hand's existing event/round data as a brief transition.

**Tech Stack:** React 19, Firebase Realtime Database transactions, Vite, native Node test runner.

---

### Task 1: Lock down the hand-finalization contract

**Files:**
- Modify: `tests/gameLogic.test.js`
- Modify: `src/lib/gameLogic.js`

**Step 1: Write the failing continuation test**

Create a deterministic active deal 2 fixture where the final legal move empties every visible hand and neither side reaches 40 after card-count scoring. Assert that the returned game remains `playing`, advances `round.handNumber` from 1 to 2, has a new active deal 1, and has a valid opening `turnPlayerId`.

**Step 2: Run the focused test to verify it fails**

Run: `npm test -- --test-name-pattern="continues with a new hand"`

Expected: FAIL until the fixture and transition contract are represented by the test.

**Step 3: Implement the smallest authoritative change needed**

Keep card-count scoring before terminal detection. Ensure the non-terminal path always returns the newly constructed hand as a playing game, with no artificial hand cap and a `Hand N started`/begin event. Do not change capture rules.

**Step 4: Write the failing terminal-score test**

Add a deterministic finishing fixture where card-count points bring one team to 40. Assert `status === 'finished'`, the winner and final score are recorded, and no new hand is constructed.

**Step 5: Run focused tests and commit**

Run: `npm test -- --test-name-pattern="hand.*(continues|40)"`

Expected: PASS.

Commit: `git add tests/gameLogic.test.js src/lib/gameLogic.js && git commit -m "fix: continue hands until forty points"`

### Task 2: Make computer scheduling identity hand-aware

**Files:**
- Modify: `tests/gameLogic.test.js`
- Modify: `src/lib/gameLogic.js`
- Modify: `src/App.jsx`

**Step 1: Write the failing automation-key test**

Add a pure exported helper test proving that two states with the same computer turn player but different hand number produce different computer-turn keys. Include `handNumber`, `activeDeal`, and the active player in the key. Return `null` when no computer turn is active.

**Step 2: Run the focused test to verify it fails**

Run: `npm test -- --test-name-pattern="computer turn key"`

Expected: FAIL because the helper does not exist.

**Step 3: Implement the minimal scheduler trigger**

Add the pure helper next to `isComputerTurnActive`, then derive it in `App`. Make the host computer-move effect depend on that derived value, while retaining the transaction's current-state/host authorization checks. Do not schedule a move after a terminal game.

**Step 4: Run the focused test to verify it passes**

Run: `npm test -- --test-name-pattern="computer turn key"`

Expected: PASS.

**Step 5: Commit**

Commit: `git add tests/gameLogic.test.js src/lib/gameLogic.js src/App.jsx && git commit -m "fix: reschedule computers for new hands"`

### Task 3: Make the transition visible and verify the complete change

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/styles/app.css`
- Test: `tests/gameLogic.test.js`

**Step 1: Inspect existing hand/round event presentation**

Reuse it where possible. If the new hand transition is not otherwise clear, render a short non-blocking `Hand N begins` banner/event tied to the hand-number change. It must work for human and computer openings and must respect existing reduced-motion behavior.

**Step 2: Run all tests**

Run: `npm test`

Expected: all tests PASS.

**Step 3: Run release checks**

Run: `npm run build` and `git diff --check`

Expected: production build succeeds and `git diff --check` produces no output.

**Step 4: Exercise the regression scenario**

Use the existing browser/test harness or a focused state walkthrough to confirm: second-deal final move → card score → `Hand 2 begins` → same computer opening turn schedules and commits a legal move; repeat under 40 and confirm the 40-point case stops instead.

**Step 5: Commit**

Commit: `git add src/App.jsx src/styles/app.css tests/gameLogic.test.js src/lib/gameLogic.js && git commit -m "feat: show hand continuation"`
