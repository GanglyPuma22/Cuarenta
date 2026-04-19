# Cuarenta

Fresh React + Vite rewrite of the old repo.

## What is implemented
- 4-player lobby using Firebase Realtime Database
- Host creates a 6-character room code
- Players join by code with just a display name (no auth UI)
- Every game now gets a shareable rejoin URL (`?game=ABC123`) and the current browser remembers the last active session
- Existing seated players can reopen the saved URL on the same browser and resume mid-game instead of getting locked out by the lobby-only join flow
- Drag-first card play: drag onto the table to trail, onto highlighted board cards to match, or onto capture lanes for addition captures
- Host vets joined names and starts when 4 seats are filled
- Teams are seat-based: seats 1 & 3 vs seats 2 & 4
- Actual turn-based Cuarenta game flow with:
  - matching captures
  - addition captures for A-7
  - automatic upward sequence capture
  - caida scoring (+2)
  - limpia scoring (+2, except at 38+)
  - ronda handling (+4 if team under 30)
  - four-of-a-kind instant win on a deal
  - 2 deals of 5 cards per player per hand
  - end-of-hand card-count scoring
  - repeated hands until a team reaches 40

Rules source used: https://www.pagat.com/fishing/cuarenta.html

## Tech
- React 19
- Vite
- Firebase Realtime Database

## Local setup
1. Install deps:
   ```bash
   npm install
   ```
2. Run dev server:
   ```bash
   npm run dev
   ```
3. Open the local URL Vite prints (usually `http://localhost:5173/`).
4. Build:
   ```bash
   npm run build
   ```

`.env` is optional here because the Firebase web config already falls back to the known project values. If you want overrides, copy `.env.example` to `.env`.

## Firebase notes
This app expects the Firebase project `cuarenta-dfbf1`.

Because the requested flow is still "no auth UI for now", the database rules hardening here is structural rather than identity-perfect. The rules now validate room-code shape, required metadata, player counts, name lengths, score bounds, and session metadata so the database is less of a free-for-all, but a determined attacker could still impersonate writes without anonymous/custom auth.

Expected RTDB path:
- `games/<CODE>`

## Hosting / deployment
The Vite base path defaults to `/cuarenta/`, matching the intended deployment under `itsyasha.com/cuarenta`.

Files included for Firebase Hosting:
- `firebase.json`
- `database.rules.json`

Typical deploy flow once Firebase CLI is installed and authenticated:
```bash
npm install
npm run build
firebase deploy --only hosting,database
```

If you deploy behind another web server instead of Firebase Hosting, serve the `dist/` folder at the path you built for. For `itsyasha.com/cuarenta`, build with `VITE_BASE_PATH=/cuarenta/` and keep SPA rewrites enabled.

## Current limitations / follow-up
- No auth UI. Identity is still a local browser-generated player id plus chosen name, so true seat ownership still wants anonymous/custom auth later.
- Rejoin is intentionally same-browser and same-local-player-id. It is robust for refresh/disconnect/reopen, not for arbitrary device handoff.
- Ronda-caida 10-point remembered bonus is not implemented yet.
- The UI is much more tactile now, but it is still a pragmatic drag-first web implementation, not full Hearthstone-grade animation/polish.
