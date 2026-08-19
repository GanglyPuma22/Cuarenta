# Caída Limpia Precedence Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ensure a capture is either a +2 caída or a +2 limpia, never a stacked +4 bonus.

**Architecture:** Make `analyzeMove` the single source of the precedence rule: a limpia must explicitly be non-caída. All UI feedback remains derived from that analysis, with the obsolete combined kind removed. Keep the existing limpia-at-38 rule intact.

**Tech Stack:** JavaScript, Node test runner, React, Vite.

---

### Task 1: Lock the scoring precedence with failing game-logic tests

**Files:**
- Modify: `tests/gameLogic.test.js:117-139, 505-538, 587-596`
- Test: `tests/gameLogic.test.js`

**Step 1: Write the failing test**

Change the existing one-card immediate-match scenario (team A at 36, previous
card is the only board card) to assert:

```js
assert.equal(next.scores.A, 38);
assert.match(next.round.events[0], /Caída.*\(\+2\)/i);
assert.doesNotMatch(next.round.events[0], /Limpia|\(\+4\)/i);
```

Update the corresponding displayed-move, `analyzeMove`, and committed
transition assertions to expect `CAÍDA +2`, emphasis `caida`,
`isCaida === true`, `isLimpia === false`, and `bonusPoints === 2`.

**Step 2: Run the focused test to verify it fails**

Run: `npm test -- --test-name-pattern="immediately previous card|aligned with applied scoring bonuses|committed round transition"`

Expected: FAIL because the current implementation awards the combined +4 bonus.

**Step 3: Implement the minimal scoring rule**

In `src/lib/gameLogic.js`, change the limpia calculation to require
`!isCaida`, remove the combined display emphasis/label branches, and leave
the independent +2 scoring branches intact.

```js
const isLimpia = !isCaida
  && selected.type !== 'trail'
  && remainingBoardCards === 0
  && scoreBefore < 38;
```

**Step 4: Run the focused test to verify it passes**

Run: `npm test -- --test-name-pattern="immediately previous card|aligned with applied scoring bonuses|committed round transition"`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/lib/gameLogic.js tests/gameLogic.test.js
git commit -m "fix: give caída precedence over limpia"
```

### Task 2: Remove combined-bonus feedback and rules copy

**Files:**
- Modify: `src/lib/moveFeedback.js:3-68`
- Modify: `src/styles/app.css:868-873, 1460-1488`
- Modify: `src/App.jsx:28-33`
- Modify: `tests/gameLogic.test.js:552-635`
- Test: `tests/gameLogic.test.js`

**Step 1: Write the failing presentation tests**

Replace the combined-feedback assertions with a defensive precedence assertion:

```js
const feedback = resolveMoveFeedback(outcome({
  isCaida: true, isLimpia: true, bonusPoints: 2,
}));
assert.equal(feedback.kind, 'caida');
assert.equal(feedback.title, 'CAÍDA');
assert.equal(getFeedbackAudioCue('caida-limpia'), null);
```

**Step 2: Run the focused test to verify it fails**

Run: `npm test -- --test-name-pattern="resolved move feedback maps|audio cues"`

Expected: FAIL because `caida-limpia` is still a feedback/audio kind.

**Step 3: Implement the smallest presentation cleanup**

- Remove the `caida-limpia` title, special kind, feedback branch, and audio
  cue from `src/lib/moveFeedback.js`.
- Remove only CSS selectors that name `kind-caida-limpia` or
  `emphasis-caida-limpia`.
- Rewrite the rules drawer to state that caída is +2 even if it clears the
  board, and limpia is +2 only for a non-caída clear. State that 38 blocks
  limpia, not caída.

**Step 4: Run the focused test to verify it passes**

Run: `npm test -- --test-name-pattern="resolved move feedback maps|audio cues"`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/lib/moveFeedback.js src/styles/app.css src/App.jsx tests/gameLogic.test.js
git commit -m "fix: remove stacked caída limpia feedback"
```

### Task 3: Verify the complete game behavior

**Files:**
- Verify only: `tests/gameLogic.test.js`

**Step 1: Run all tests**

Run: `npm test`

Expected: PASS, including Firebase-pruning and full simulated-match coverage.

**Step 2: Build production assets**

Run: `npm run build`

Expected: Vite build exits 0.

**Step 3: Check patch quality**

Run: `git diff --check main...HEAD && git status --short`

Expected: no whitespace errors and no uncommitted implementation changes.

**Step 4: Report handoff**

Report the commits, test/build output, and explicitly confirm the +4 combined
path is absent. Do not push, create a PR, merge, or deploy; Jeeves handles
those authorized release actions.
