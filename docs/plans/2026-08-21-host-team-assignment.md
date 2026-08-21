# Host Team Assignment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Give a lobby host control over the two teams before starting, without making the default join-and-start flow slower.

**Architecture:** Add a normalized, fixed four-position lobby-seat representation to pure game logic. The app uses it to render Team A and Team B position controls. At start, logic materializes computers in their requested positions and uses the existing seat-order-based team assignment.

**Tech Stack:** React 18, Firebase Realtime Database, Node built-in test runner, Vite.

---

### Task 1: Add normalized lobby-seat logic

**Files:**
- Modify: `src/lib/gameLogic.js`
- Test: `tests/gameLogic.test.js`

1. Write failing tests for legacy seating normalization, host-only player swaps, computer reservations, and final four-seat materialization.
2. Run `node --test tests/gameLogic.test.js` and confirm the new tests fail.
3. Implement pure lobby-seat normalization, join assignment, host mutation, and start materialization helpers.
4. Re-run the focused test suite and commit the logic and tests.

### Task 2: Render host team controls

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/styles/app.css`

1. Use the logic helpers in create/join/start transactions.
2. Render positions in Team A and Team B groups; allow host-only swap and computer/open controls.
3. Keep non-host controls read-only and preserve automatic next-open-seat joining.
4. Build and inspect responsive layout.

### Task 3: Verify, PR, merge, and deploy

1. Run `npm test`, `npm run build`, and `git diff origin/main...HEAD --check`.
2. Push `feature/host-team-assignment`, create a PR into `main`, and merge it.
3. Update local `main`, deploy Firebase Hosting, and verify the live bundle changed.
