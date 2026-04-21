# Cuarenta

Fresh React + Vite rewrite of the old repo.

## What this build already does
- 4-player lobby using Firebase Realtime Database
- Host creates a 6-character room code
- Players join by code with just a display name (no auth UI yet)
- Every game gets a shareable rejoin URL (`?game=ABC123`) and the current browser remembers the last active session
- Existing seated players can reopen the saved URL on the same browser and resume mid-game instead of getting locked out by the lobby-only join flow
- Drag-first card play: drag onto the table to trail, onto highlighted board cards to match, or onto capture lanes / live targets for addition captures
- Stronger move previews: hoverable board targets carry match/addition semantics, the table groups exact target vs sequence cards, and the UI shows capture order, caída targets, and scoring swing badges before you commit
- In-app rules + scoring reference drawer for the high-value Cuarenta edge cases
- Host vets joined names and starts when 4 seats are filled
- Opening dealer is chosen randomly among the seated players for a fairer start
- Teams are seat-based: seats 1 & 3 vs seats 2 & 4
- Actual turn-based Cuarenta game flow with matching captures, A-7 addition captures, automatic upward sequence capture, caída, limpia, ronda handling, two deals of five cards, end-of-hand card-count scoring, and repeated hands until a team reaches 40

Rules source used: https://www.pagat.com/fishing/cuarenta.html

## Tech
- React 19
- Vite
- Firebase Realtime Database

## Local setup
```bash
npm install
cp .env.example .env.local
npm run dev
```

Open the local URL Vite prints (usually `http://localhost:5173/`).

### Safe default: use the RTDB emulator
The committed `.env.example` now defaults to the Firebase Realtime Database emulator instead of a real shared project.

Typical flow:
```bash
cp .env.example .env.local
# leave VITE_USE_FIREBASE_EMULATOR=true
firebase emulators:start --only database
npm run dev
```

### If you intentionally want a real Firebase project
Set `VITE_USE_FIREBASE_EMULATOR=false` and fill every `VITE_FIREBASE_*` variable in `.env.local`.

The app no longer bakes the current live Firebase web config into source code. If you do not provide config, the UI renders a clear setup notice instead of silently talking to a real backend.

## Tests / build
```bash
npm test
npm run build
```

## Firebase / public-surface notes
This repo is **closer** to OSS-safe than before, but it is **not fully public-safe yet**.

What changed in this pass:
- the app no longer defaults local dev builds to the real live Firebase project
- `.env.example` points contributors toward the emulator first
- `database.rules.json` now enforces a tighter public shape: valid room code, 1-4 players, 1-4 seats, bounded player names, bounded scores, and bounded session metadata instead of allowing nearly-arbitrary payloads
- README setup/deploy guidance now makes the backend choice explicit

What is still intentionally rough:
- there is still no auth UI, so the game path still relies on public reads/writes to function
- shape validation is better, but it is not a substitute for anonymous/custom auth
- a determined attacker can still write valid-looking game traffic and churn rooms
- there is no quota / abuse-control story in-repo yet (alerts, App Check, rate limiting via server-side mediation, cleanup jobs, etc.)

### Realtime Database path
- `games/<CODE>`

## Hosting / deployment
Production builds should be explicit about which backend they target.

### Build for a hosted path
For `itsyasha.com/cuarenta`, build with:
```bash
VITE_BASE_PATH=/cuarenta/ npm run build
```

### Build against a real Firebase project
Do this only on purpose, with env vars present in the same shell:
```bash
set -a
source .env.local
set +a
npm run build
```

### Firebase Hosting / RTDB deploy
Once Firebase CLI is installed and authenticated:
```bash
set -a
source .env.local
set +a
npm run build
firebase deploy --only hosting,database
```

If you deploy behind another web server instead of Firebase Hosting, serve `dist/` at the same base path you built for and keep SPA rewrites enabled.

## Current limitations / follow-up
- No auth UI. Identity is still a local browser-generated player id plus chosen name, so true seat ownership still wants anonymous/custom auth.
- Rejoin is intentionally same-browser and same-local-player-id. It is robust for refresh/disconnect/reopen, not for arbitrary device handoff.
- Ronda-caida 10-point remembered bonus is not implemented yet.
- The app auto-previews and auto-takes the full visible sequence for any chosen capture, so the real-world “missed sequence can be stolen by opponents” memory test is intentionally removed from the UI flow.
- The UI is more intentional and compact than before, but it is still a pragmatic drag-first web implementation, not a fully animated premium card-game presentation.

## Honest OSS-readiness status
Current status: **not public-ready yet, but no longer casually dangerous by default**.

The repo moved from “clone it and silently hit the live backend” toward “clone it and either use the emulator or opt into a real project on purpose.” The remaining real blocker before public visibility is the backend trust model, not the frontend build setup.
