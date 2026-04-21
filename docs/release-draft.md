# Draft GitHub release notes

## Cuarenta v0.2.0 — playable rewrite, reconnectable lobbies, lighter auth

Cuarenta is a pragmatic four-player web implementation of the Ecuadorian card game, built with React, Vite, and Firebase Realtime Database.

![Gameplay screenshot](assets/gameplay-screenshot.png)

### Highlights

- full match flow to 40 with seating-based teams
- reconnectable game links
- drag-first move selection with clearer capture previews
- in-app rules and scoring reference
- emulator-first local setup
- Firebase anonymous auth for lightweight player identity
- tighter Realtime Database rules than the earlier open-write prototype

### Why this release exists

This is the first version that feels honest enough to share as a repo:

- the game is real and playable
- setup is explicit instead of silently pointing at a live backend
- the trust model is better documented
- the remaining rough edges are called out instead of hidden

### Known rough edges

- gameplay is still client-authoritative
- anonymous auth improves the public-demo story, but it is not a full anti-abuse system
- reconnect is same-browser, not general cross-device handoff
- the remembered ronda-caída +10 bonus is still not implemented

### Suggested release blurb

A small but real Cuarenta web app: four-player lobby, reconnectable links, better move previews, and now a lighter anonymous-auth path instead of a wide-open write surface. Still not pretending to be a hardened public game service.
