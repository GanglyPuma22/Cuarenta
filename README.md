# Cuarenta

A pragmatic four-player Cuarenta web app built with React, Vite, and Firebase Realtime Database.

![Cuarenta gameplay screenshot](docs/assets/gameplay-screenshot.png)

## What this is

This repo is a modern rewrite of an older Cuarenta project. The current build focuses on the part that actually matters for real play:

- create a room fast
- seat four players
- share a reconnectable link
- play a full match to 40
- preview captures clearly before committing

It is not trying to be a full commercial card-game platform. It is a playable, opinionated web implementation of Cuarenta with better move clarity than a barebones lobby-and-cards prototype.

Rules source used for this build: <https://www.pagat.com/fishing/cuarenta.html>

## Who this is for

- people who already know Cuarenta and want a browser-based table
- friends/family groups who want quick private games
- developers curious about a small Firebase-backed multiplayer card game

If you want polished matchmaking, accounts, cosmetics, or anti-cheat hardening, this is not that repo.

## Current status

This project is **playable today** and still intentionally **light on infrastructure hardening**.

The UX and game flow are real. The backend trust model is materially safer than the original wide-open prototype, but it is not hardened for hostile internet traffic. The current posture is a good fit for personal use, small-group sharing, and modest public demo use with honest caveats.

## Play online

Live app: <https://cuarenta-dfbf1.web.app/>

Use the hosted version if you just want to play. Use the local setup below if you want to inspect or modify the project.

## What already works

- 4-player lobby using Firebase Realtime Database
- host creates a 6-character room code
- players join by code with a display name
- silent Firebase **anonymous auth** on load; no account UI required
- shareable rejoin URL (`?game=ABC123`)
- same-browser reconnect using the saved anonymous Firebase session
- drag-first card play: trail, match, or addition capture directly from the hand
- move previews that show target cards, sequence capture, caída, limpia, and scoring swing before commit
- in-app rules + scoring drawer for common edge cases
- full match flow with two deals of five cards, hand scoring, and repeated hands until a team reaches 40

## Auth / trust model

Anonymous Firebase auth is the intended 90/10 fit here.

Why it fits this project:

- the app needs **ephemeral per-player identity**, not durable user accounts
- same-browser reconnect matters more than email/password login
- the extra friction of real accounts is not justified for a casual four-player card game

Current safeguards:

- the app signs each browser into Firebase anonymously before touching the database
- local emulator setup expects **Auth + Realtime Database** together
- Realtime Database rules require authenticated access instead of allowing open writes
- lobby creation and joining are tied to the caller's anonymous Firebase uid
- only the **current turn player** is allowed to submit gameplay writes once a match is live

What this still does **not** solve:

- gameplay is still client-authoritative
- a malicious current-turn player could still try to submit a forged but valid-looking game state
- there is no server-side move validation, rate limiting, abuse review, or cleanup worker yet

Anonymous auth is the right tradeoff for this project today: lightweight participation, same-browser reconnect, and a meaningfully safer demo surface than open writes. It is **not** the final answer if the goal becomes a truly hardened public game service.

## Safe local setup

### 1. Install dependencies

```bash
npm install
```

### 2. Copy env

```bash
cp .env.example .env.local
```

### 3. Start Firebase emulators

```bash
npx firebase-tools@latest emulators:start --only auth,database
```

### 4. Run the app

```bash
npm run dev
```

Then open the local Vite URL, usually <http://localhost:5173/>.

## Using a real Firebase project on purpose

If you want a real shared backend instead of the emulator:

1. set `VITE_USE_FIREBASE_EMULATOR=false` in `.env.local`
2. fill every `VITE_FIREBASE_*` value
3. enable **Anonymous** auth in Firebase Authentication
4. deploy the included Realtime Database rules before sharing the app

The app no longer bakes a live Firebase web config into source code. If config is missing, it fails loudly instead of quietly talking to a real backend.

## Tests / build

```bash
npm test
npm run build
```

## Deployment notes

### Build for a hosted subpath

For a path like `itsyasha.com/cuarenta`:

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

### Firebase Hosting + RTDB deploy

```bash
set -a
source .env.local
set +a
npm run build
npx firebase-tools@latest deploy --only hosting,database --project <your-project-id>
```

If you deploy somewhere other than Firebase Hosting, serve `dist/` at the base path you built for and keep SPA rewrites enabled.

## Limitations / non-goals

- no durable account system
- reconnect is intentionally same-browser, not cross-device handoff
- still no server-authoritative move validation
- the remembered ronda-caída +10 bonus is still not implemented
- the UI chooses clarity over theatrical animation
- the app auto-previews and auto-takes the visible sequence instead of forcing players to remember it manually

## License

[MIT](LICENSE)
