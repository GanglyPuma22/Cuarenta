import { analyzeMove } from './gameLogic.js';

const FEEDBACK_TITLES = {
  trail: 'Trail',
  capture: 'Capture',
  sequence: 'Sequence',
  caida: 'CAÍDA',
  limpia: 'LIMPIA',
  'caida-limpia': 'CAÍDA Y LIMPIA',
};

const SPECIAL_KINDS = new Set(['caida', 'limpia', 'caida-limpia']);

function feedbackKind(outcome) {
  if (outcome.move.type === 'trail') return 'trail';
  if (outcome.isCaida && outcome.isLimpia) return 'caida-limpia';
  if (outcome.isCaida) return 'caida';
  if (outcome.isLimpia) return 'limpia';
  return outcome.sequenceCount > 0 ? 'sequence' : 'capture';
}

// Presentation-only: turns an analysed outcome into the animation vocabulary the
// felt uses. Scoring itself stays in gameLogic.
export function resolveMoveFeedback(outcome) {
  if (!outcome?.move) return null;
  const kind = feedbackKind(outcome);

  return {
    kind,
    title: FEEDBACK_TITLES[kind],
    points: outcome.bonusPoints || 0,
    captureCount: outcome.captureCount || 0,
    sequenceCount: outcome.sequenceCount || 0,
    isSpecial: SPECIAL_KINDS.has(kind),
  };
}

// Short synthesized motifs. Trails, ordinary captures, and sequence runs stay
// visual so the felt does not chirp on every turn.
const AUDIO_CUES = {
  caida: {
    id: 'caida',
    gain: 0.14,
    tones: [
      { frequency: 587.33, duration: 0.1 },
      { frequency: 880, duration: 0.18 },
    ],
  },
  limpia: {
    id: 'limpia',
    gain: 0.12,
    tones: [
      { frequency: 523.25, duration: 0.1 },
      { frequency: 783.99, duration: 0.2 },
    ],
  },
  'caida-limpia': {
    id: 'caida-limpia',
    gain: 0.16,
    tones: [
      { frequency: 587.33, duration: 0.09 },
      { frequency: 880, duration: 0.09 },
      { frequency: 1046.5, duration: 0.26 },
    ],
  },
};

export function getFeedbackAudioCue(kind) {
  return AUDIO_CUES[kind] || null;
}

function captureSignature(lastCapture) {
  if (!lastCapture) return '';
  return `${lastCapture.playerId}:${lastCapture.playedCardId}:${(lastCapture.capturedIds || []).join(',')}`;
}

function analyzeResolvedMove(previousGame, playerId, playedCardId, captureIds) {
  const types = captureIds ? ['match', 'add'] : ['trail'];

  for (const type of types) {
    const analysis = analyzeMove(previousGame, playerId, { type, playedCardId, captureIds });
    if (analysis.move) return analysis;
  }

  return null;
}

function buildTransition(previousGame, playerId, playedCardId, captureIds) {
  const round = previousGame.round;
  const outcome = analyzeResolvedMove(previousGame, playerId, playedCardId, captureIds);
  if (!outcome) return null;

  const playedCard = (round.hands?.[playerId] || []).find((entry) => entry.id === playedCardId);
  if (!playedCard) return null;

  const board = Array.isArray(round.board) ? round.board : [];
  const capturedCards = (captureIds || [])
    .map((id) => board.find((entry) => entry.id === id))
    .filter(Boolean);
  if (capturedCards.length !== (captureIds || []).length) return null;

  return {
    playerId,
    playerName: previousGame.players?.[playerId]?.name || '',
    teamId: round.teamsByPlayer?.[playerId]?.teamId || null,
    playedCard,
    capturedCards,
    targetIds: outcome.move.targetIds || [],
    outcome,
  };
}

// Derives what just happened by diffing two authoritative game states, so remote
// and computer moves animate the same way a local play does. Returns null when
// the transition cannot be reconstructed; the caller then renders the new state
// immediately instead of waiting on an animation.
export function describeRoundTransition(previousGame, nextGame) {
  const previousRound = previousGame?.round;
  const nextRound = nextGame?.round;
  if (!previousRound || !nextRound) return null;
  if (previousRound.handNumber !== nextRound.handNumber) return null;

  const capture = nextRound.lastCapture;
  if (capture && captureSignature(capture) !== captureSignature(previousRound.lastCapture)) {
    return buildTransition(previousGame, capture.playerId, capture.playedCardId, capture.capturedIds || []);
  }

  const played = nextRound.lastPlayedCard;
  if (played && played.cardId !== previousRound.lastPlayedCard?.cardId) {
    return buildTransition(previousGame, played.playerId, played.cardId, null);
  }

  return null;
}
