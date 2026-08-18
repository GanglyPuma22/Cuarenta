# Mobile Play Surface and Caída Feedback Design

## Goal

Make an active Cuarenta turn understandable on a phone without separating the
felt from the actionable choices, while making a live caída unmistakable and
making every played move visible.

## Scope

- On narrow landscape screens, present a compact play surface: felt on the
  left, the selected card and live actions on the right, and the hand as a
  compact strip below.
- On portrait screens, keep the felt, current card, and live actions in a
  turn-first flow. Collapse secondary information behind a Details control.
- Preserve the game engine's legal moves. The presentation layer must promote a
  live caída and prevent an ordinary same-rank Match action from being chosen
  in its place. It must not force the player to take the caída.
- When a caída is available for a selected card, show its full automatic
  sequence as one primary action. Hide the ambiguous generic Match action and
  Trail action for that selected card. Keep distinct addition, limpia, and
  sweep alternatives available as secondary actions.
- Animate every resolved move: played card, capture targets, and capture pile
  transition. Use richer but brief overlays for caída, limpia, and caída y
  limpia. Respect `prefers-reduced-motion` and provide a sound mute control.

## Rules Basis

A caída is the immediate next player's matching capture of the prior player's
card. The matching capture includes every uninterrupted higher card in the
sequence above the played rank. Addition captures remain legal alternatives;
the UI is clarifying choices, not rewriting the rules.

Source: https://www.pagat.com/fishing/cuarenta.html

## Interaction Design

1. Derive display actions from the existing legal-move list and its analysed
   outcomes. Do not alter the core legality or Firebase transaction path.
2. If an analysed action is a caída, render it at the top with a prominent
   `CAÍDA +2` treatment and its complete sweep. Suppress other `match` and
   `trail` display actions for that same selected card; render non-matching
   capture alternatives below it.
3. When a move resolves, retain the previous board briefly in a transient
   presentation state. Animate the played card into the felt/capture path,
   then animate captured cards toward the active team's pile. An event overlay
   names the result and points earned.
4. The standard animation is short and non-blocking. Caída and limpia add a
   short title overlay and sound cue after the player's interaction has enabled
   audio. Caída y limpia uses the combined label and cue. Trail and ordinary
   capture use quiet visual transitions only.

## Accessibility and Failure Handling

- The action list remains keyboard-operable and uses explicit action labels.
- Announce resolved moves through an `aria-live` region.
- `prefers-reduced-motion: reduce` disables movement while retaining outcome
  labels and target highlighting.
- Audio starts muted until a deliberate user interaction enables it, and the
  control can mute it again.
- If animation state cannot be constructed from a remote update, render the
  new authoritative Firebase state immediately rather than delaying gameplay.

## Verification

- Unit tests cover display-action prioritisation and suppression around a live
  caída, including a caída with an upward sequence and non-caída alternatives.
- Existing game-logic tests remain green, proving legality and scoring did not
  change.
- Production build passes.
- Manual browser checks cover portrait and landscape narrow viewports, normal
  motion, reduced motion, and each outcome animation category.
