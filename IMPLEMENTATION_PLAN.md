# Implementation plan

## Done
- Inspect old repo and salvage only the Firebase project config / general intent.
- Replace legacy CRA app with a new Vite + React app.
- Build deterministic game logic in pure JS.
- Wire Firebase Realtime Database for lobby + gameplay sync.
- Add deployment-oriented config for `/cuarenta/` hosting.

## Remaining
- Tighten Firebase Database rules for production.
- Add host moderation controls like kick / rename confirmation if wanted.
- Add better mobile layout and richer card visuals/animations.
- Implement rare special case: remembered ronda captured by caida (+10).
- Smoke test against the real database with two to four browser sessions.
