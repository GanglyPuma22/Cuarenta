# Hand Continuation and Computer Opening Design

## Goal

Ensure a Cuarenta match continues automatically from one finished hand to the
next until a team has reached 40 points, including when the next hand opens on
a computer player.

## Observed Failure

`finalizeHand` already calculates card-count points and builds a next hand when
no team reaches 40. The host-side computer-turn effect only depends on the
current player identity, however. If the same computer is first in both the
finished and new hand, React can retain the prior effect and never schedule the
new opening move.

## Approved Behaviour

1. Resolve and add the finished hand's card-count score before deciding whether
   the match has ended.
2. If either team has 40 or more points, finish the game immediately; never
   build another hand.
3. Otherwise build the next hand immediately. There is no fixed hand or round
   limit.
4. Treat the new hand/deal identity as part of computer-turn scheduling, so a
   computer assigned to open it always receives a fresh scheduled turn.
5. Surface the state change with the existing turn/event presentation as
   `Hand N begins`; it must not require a host button or block the computer.

## Boundaries

- Keep Firebase authorization and the host-client computer-move model intact.
- Do not introduce a backend worker or manual continuation control.
- Keep the change focused on hand transition and scheduling identity; do not
  rewrite legal-move or scoring rules.

## Verification

- A finished second deal under 40 constructs hand 2 with a playable opening.
- A computer whose identity is unchanged receives a new automation key on the
  next hand.
- Card-count points that bring a team to 40 end the match without a next hand.
- Existing game rules, tests, and production build remain green.
