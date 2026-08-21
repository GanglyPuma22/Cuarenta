# Host Team Assignment Design

## Goal

Let the host arrange teammates before a Cuarenta match while preserving the current quick path: people joining a lobby automatically take the next available seat, and any unfilled seat becomes a computer when the host starts.

## Decisions

- The four physical positions remain the source of team membership: seats 1 and 3 are Team A; seats 2 and 4 are Team B. The match engine therefore needs no team-rule change.
- A lobby stores four explicit, Firebase-safe seat records. Each is `open`, `computer`, or a human player ID. Older lobbies without those records derive them from their existing seating order.
- Joining still assigns a human to the first `open` seat. A seat explicitly reserved as `computer` is not joinable until the host opens it again.
- The host may swap a seated human into another position. This swaps the two occupants, so no joined person is silently removed from the lobby.
- The host may reserve an open seat for a computer or release a reserved computer seat. Empty open seats also become computers at Start.
- Only the host can change lobby assignments. Other players see their current position and team.
- Starting materializes computer players in the selected positions, then fills every remaining open seat with a computer. The resulting `seating` order is still exactly the four table positions.

## Non-goals

- No player voting, self-service team selection, or mid-match seat changes.
- No removal/kicking of joined players from an occupied position.
- No changes to turn order, scoring, or the automatic-computer turn mechanism.

## Verification

- Unit tests cover legacy-lobby compatibility, host-only position changes, player swaps, selected computer positions, and automatic computer fill.
- The full test suite and production build pass before the PR is merged and Firebase Hosting is deployed.
