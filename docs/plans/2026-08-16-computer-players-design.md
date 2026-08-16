# Computer Players Design

## Goal

Allow a host to start a Cuarenta game with one to four human players. Empty seats become computer players and play automatically.

## Decisions

- Starting a lobby always produces four seats. Existing human seats retain their order; empty seats receive `Computer 1`, `Computer 2`, and so on.
- Computer players are ordinary game players with a stable game-local ID and an `isComputer` marker. They cannot join or reconnect through a browser.
- A computer selects only from `getLegalMoves`. It ranks choices by immediate awarded points, then the number of captured cards, then a canonical move key. This is deterministic and rewards both caida/limpia and card-majority progress.
- The host browser drives computer turns after a short delay. Its transaction rechecks the current turn, so stale timers and repeated snapshots do not apply an extra move.
- Firebase permits the host to write when the active turn belongs to a computer player; human turns remain restricted to that human's authenticated UID.
- The lobby and mobile layout visibly identify computer seats and keep the start action usable on narrow screens.

## Non-goals

- No server-side bot worker or autonomous play while the host is offline.
- No look-ahead, opponent modeling, difficulty options, or random behavior.
- No mid-game human joins or replacing a computer after the game begins.

## Verification

- Unit tests prove lobby completion, move ranking, tie determinism, and applying a selected computer move.
- Full Node test suite and production build pass.
- Browser checks at a phone viewport verify the lobby and active-game layout have no horizontal overflow and expose the computer-player status.
