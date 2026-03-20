# Cuarenta

Fresh React + Vite rewrite of the old repo.

## What is implemented
- 4-player lobby using Firebase Realtime Database
- Host creates a 6-character room code
- Players join by code with just a display name (no auth UI)
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
1. Copy `.env.example` to `.env`
2. Install deps:
   ```bash
   npm install
   ```
3. Run dev server:
   ```bash
   npm run dev
   ```
4. Build:
   ```bash
   npm run build
   ```

## Firebase notes
This app expects the Firebase project `cuarenta-dfbf1`.

Because the requested flow is "no auth for now", the current `database.rules.json` is intentionally permissive and should be treated as temporary/dev-only. Before production, tighten rules around game creation and writes.

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

If you deploy behind another web server instead of Firebase Hosting, serve the `dist/` folder at `/cuarenta/` and keep SPA rewrites enabled.

## Current limitations / follow-up
- No auth UI. Identity is just a local browser-generated player id plus chosen name.
- Ronda-caida 10-point remembered bonus is not implemented yet.
- The UI is functional and clean, but not a polished final visual design from Stitch.
- Database rules are intentionally broad for rapid testing and should be hardened before public launch.
