# Caída Takes Precedence Over Limpia

## Decision

A capture can earn exactly one special bonus. A valid **caída** always takes
precedence over **limpia**, including when it removes every card from the
table. Both bonuses are worth two points; they never stack to four.

## Rules

- A move is a **caída** when it matches the immediately previous play under
  the existing deal/turn rules. It earns +2 and is labeled/animated as caída.
- A **limpia** is a non-caída capture that clears the table. It earns +2,
  subject to the existing no-limpia-at-38 restriction.
- A card that matches the previous player's card while those are the final two
  cards on the table is a caída +2, not a combined bonus.

## Scope

The scoring decision stays in `src/lib/gameLogic.js`, with presentation derived
from that authoritative analysis. Remove the obsolete `caida-limpia` label,
audio, styling, and rules copy. Preserve all other capture, sequence, ronda,
and score-limit behavior.

## Verification

Regression tests will cover a last-card caída (+2 only), a non-caída clear
(limpia +2), the 38-point limpia restriction, presentation precedence, and no
combined audio/UI path. The full suite and production build must pass before
merge and Firebase deployment.
