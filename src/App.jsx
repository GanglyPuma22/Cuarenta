import { useEffect, useMemo, useRef, useState } from 'react';
import { get, onValue, ref, runTransaction } from 'firebase/database';
import { databaseUrl, db } from './lib/firebase';
import { getLocalPlayerId, getSavedName, saveName } from './lib/localPlayer';
import { analyzeMove, applyMove, createInitialGameState, generateGameCode, getDealerPlayerId, getLegalMoves, getVisibleHand, startMatchFromLobby, teamSummary } from './lib/gameLogic';
import { buildGameUrl, clearSavedSession, getGameCodeFromUrl, getSavedSession, isValidGameCode, normalizeGameCode, saveGameSession, syncGameUrl } from './lib/session';

const REFERENCE_PANELS = {
  rules: {
    eyebrow: 'Table law',
    title: 'How captures work in this build',
    lead: 'This version follows the Pagat rules source the repo cites, but it makes the sequence part explicit so the UI stays honest under pressure.',
    bullets: [
      'A play can capture by matching the same rank or by addition with A-7 only. If several captures are possible, you choose exactly one set.',
      'Sequence only happens after a successful match or addition capture, and it runs upward through A-2-3-4-5-6-7-J-Q-K.',
      'The app previews the full sequence automatically. That means you do not need to remember extra sequence cards yourself mid-move.',
      'Caída only comes from the next player immediately matching the card just played. Addition and sequence do not count as caída.',
    ],
  },
  scoring: {
    eyebrow: 'Scorekeeping',
    title: 'High-value scoring quirks worth remembering',
    lead: 'Cuarenta gets swingy fast, so the drawer keeps the annoying edge cases close instead of hiding them in README land.',
    bullets: [
      'Limpia is +2 for clearing the table. Caída y limpia stack for +4 when both happen together.',
      'A team on 38 cannot collect limpia. A team on 36 can still win with caída y limpia.',
      'Ronda is +4 only while your team is under 30. The special remembered ronda-caída +10 bonus is still not implemented here.',
      'At the end of the hand, loose cards left on the table do not belong to either team unless the final play was a limpia.',
    ],
  },
};

function moveKey(move) {
  return `${move.type}:${move.playedCardId}:${(move.captureIds || []).join(',')}`;
}

function cardText(card) {
  return `${card.rank}${card.suit}`;
}

function cardSuitClass(card) {
  return card?.suit === '♥' || card?.suit === '♦' ? 'is-red' : 'is-dark';
}

function playerLabel(index, currentPlayerId, seatPlayer, round, game) {
  if (!seatPlayer) return `Player ${index + 1}`;
  if (seatPlayer.id === currentPlayerId) return `You (P${index + 1})`;
  if (!round || !game) return `Player ${index + 1}`;
  const yourSeat = game.seating.indexOf(currentPlayerId) + 1;
  const seat = index + 1;
  if (yourSeat && ((yourSeat % 2) === (seat % 2))) return `Partner (P${seat})`;
  return `Rival (P${seat})`;
}

function scoreForPlayer(game, playerId) {
  if (!game?.round?.teamsByPlayer?.[playerId]) return 0;
  const teamId = game.round.teamsByPlayer[playerId].teamId;
  return game.scores?.[teamId] || 0;
}

function cardTilt(index, count = 1) {
  if (count <= 1) return '0deg';
  const midpoint = (count - 1) / 2;
  return `${(index - midpoint) * 2.2}deg`;
}

function boardCardTilt(index) {
  return `${((index % 5) - 2) * 1.6}deg`;
}

function buildDirectDropMoves(moves) {
  const candidateByTarget = new Map();
  const ambiguous = new Set();

  for (const move of moves) {
    for (const targetId of move.targetIds || []) {
      if (candidateByTarget.has(targetId) && moveKey(candidateByTarget.get(targetId)) !== moveKey(move)) {
        ambiguous.add(targetId);
        continue;
      }
      candidateByTarget.set(targetId, move);
    }
  }

  return Object.fromEntries(
    [...candidateByTarget.entries()].filter(([targetId]) => !ambiguous.has(targetId))
  );
}

function buildPreviewTargetMeta(moves) {
  const firstMoveByTarget = new Map();
  const countsByTarget = new Map();

  for (const move of moves) {
    for (const targetId of move.targetIds || []) {
      countsByTarget.set(targetId, (countsByTarget.get(targetId) || 0) + 1);
      if (!firstMoveByTarget.has(targetId)) firstMoveByTarget.set(targetId, move);
    }
  }

  return Object.fromEntries(
    [...firstMoveByTarget.entries()].map(([targetId, move]) => [targetId, {
      move,
      previewKey: moveKey(move),
      candidateCount: countsByTarget.get(targetId) || 1,
    }])
  );
}

function moveTone(move) {
  if (!move) return 'idle';
  if (move.type === 'trail') return 'trail';
  return move.type === 'match' ? 'match' : 'addition';
}

function moveKindLabel(move) {
  if (!move) return 'Preview';
  if (move.type === 'trail') return 'Trail';
  return move.type === 'match' ? 'Match' : 'Addition';
}

function describePreviewGroups(move, boardCardsById) {
  if (!move || move.type === 'trail') return [];
  const targets = (move.targetIds || []).map((id) => boardCardsById[id]).filter(Boolean);
  const targetIds = new Set(move.targetIds || []);
  const extras = (move.captureIds || []).filter((id) => !targetIds.has(id)).map((id) => boardCardsById[id]).filter(Boolean);
  const groups = [];

  if (targets.length) {
    groups.push({
      label: move.type === 'match' ? 'Match target' : 'Add set',
      cards: targets.map(cardText).join(' · '),
    });
  }

  if (extras.length) {
    groups.push({
      label: 'Sequence run',
      cards: extras.map(cardText).join(' · '),
    });
  }

  return groups;
}

function describeMove(move, boardCardsById, outcome) {
  if (!move) return '';
  if (move.type === 'trail') return 'Leave the card on the felt and keep the table live.';

  const targets = (move.targetIds || []).map((id) => boardCardsById[id]).filter(Boolean).map(cardText);
  const captured = (move.captureIds || []).map((id) => boardCardsById[id]).filter(Boolean);
  const highest = captured.at(-1);

  if (move.type === 'match') {
    if (outcome.sequenceCount > 0 && highest) {
      return `Match clean, then run the sequence through ${cardText(highest)}.`;
    }
    return `Snap the matching rank and take it clean.`;
  }

  const setText = targets.join(' + ');
  if (outcome.sequenceCount > 0 && highest) {
    return `Add ${setText}, then keep collecting upward through ${cardText(highest)}.`;
  }
  return `Add ${setText} exactly and take the set.`;
}

function stampSessionMetadata(target, { now = Date.now(), action, actorId }) {
  target.updatedAt = now;
  target.lastActivityAt = now;
  target.session = {
    version: 2,
    reconnectable: true,
    createdAt: target.session?.createdAt || target.createdAt || now,
    startedAt: target.session?.startedAt || target.startedAt || null,
    finishedAt: target.session?.finishedAt || target.finishedAt || null,
    updatedAt: now,
    lastMoveAt: target.session?.lastMoveAt || null,
    lastAction: action,
    lastActorId: actorId,
  };
}

function GameCode({ code }) {
  return <div className="share-pill">Game <strong>{code}</strong></div>;
}

function ReferenceDrawer({ tab, onRequestClose, onTabChange }) {
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);

  useEffect(() => {
    if (!tab) return undefined;

    const previousFocus = document.activeElement;
    closeButtonRef.current?.focus();

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onRequestClose();
        return;
      }

      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusables = [...dialogRef.current.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
        .filter((element) => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true');
      if (!focusables.length) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, [onRequestClose, tab]);

  if (!tab) return null;
  const panel = REFERENCE_PANELS[tab] || REFERENCE_PANELS.rules;
  const titleId = `reference-title-${tab}`;
  const descriptionId = `reference-description-${tab}`;

  return (
    <div className="reference-overlay" onClick={onRequestClose} role="presentation">
      <section
        ref={dialogRef}
        className="reference-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="reference-head">
          <div>
            <div className="eyebrow">{panel.eyebrow}</div>
            <h2 id={titleId}>{panel.title}</h2>
          </div>
          <button ref={closeButtonRef} type="button" className="text-button" onClick={onRequestClose}>Close</button>
        </div>
        <div className="reference-tabs" role="tablist" aria-label="Reference panels">
          {Object.entries(REFERENCE_PANELS).map(([key, value]) => (
            <button
              key={key}
              id={`reference-tab-${key}`}
              type="button"
              role="tab"
              aria-selected={tab === key}
              aria-controls={`reference-panel-${key}`}
              className={`reference-tab ${tab === key ? 'active' : ''}`}
              onClick={() => onTabChange(key)}
            >
              {value.eyebrow}
            </button>
          ))}
        </div>
        <div id={`reference-panel-${tab}`} role="tabpanel" aria-labelledby={`reference-tab-${tab}`}>
          <p id={descriptionId} className="reference-lead">{panel.lead}</p>
          <ul className="reference-list">
            {panel.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
          </ul>
          <div className="reference-footer">
            Source of truth: Pagat’s Cuarenta rules page. This UI also assumes full sequence capture whenever the sequence is visible.
          </div>
        </div>
      </section>
    </div>
  );
}

function LobbySeat({ player, isCurrent, slot }) {
  return (
    <div className={`lobby-seat ${player ? 'filled' : 'empty'} ${isCurrent ? 'current' : ''}`}>
      <div className="avatar-orb">{player ? (player.name || '?').slice(0, 1).toUpperCase() : '+'}</div>
      <div className="seat-copy">
        <div className="seat-name">{player?.name || `Player ${slot}`}</div>
        <div className="seat-status">{player ? (isCurrent ? 'Ready to play' : 'Waiting in lobby') : 'Waiting for players...'}</div>
      </div>
      {player?.isHost ? <div className="host-badge">Host</div> : null}
    </div>
  );
}

function TurnOrder({ game, currentPlayerId }) {
  const seating = game?.seating?.map((id) => game.players[id]) || [];
  const currentTurn = game?.round?.turnPlayerId;
  const dealerPlayerId = getDealerPlayerId(game?.round, game?.seating);

  return (
    <aside className="sidebar-panel">
      <div className="section-kicker">Table order</div>
      <h2 className="sidebar-title">Who acts next</h2>
      <div className="timeline">
        {seating.map((player, index) => (
          <div key={player.id} className={`timeline-item ${currentTurn === player.id ? 'active' : ''}`}>
            <div className="timeline-dot" />
            <div className="timeline-copy">
              <div className="timeline-kicker">{playerLabel(index, currentPlayerId, player, game.round, game)}</div>
              <div className="timeline-row">
                <span className="timeline-name">{player.name}</span>
                <span className="timeline-score">{scoreForPlayer(game, player.id)}<small>/40</small></span>
              </div>
              <div className="timeline-flags">
                {player.id === dealerPlayerId ? <span className="timeline-flag">Dealer</span> : null}
                {currentTurn === player.id ? <span className="timeline-flag current">On move</span> : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}

function TeamCard({ team, isCurrentTeam }) {
  const progress = Math.min(100, Math.round((team.score / 40) * 100));

  return (
    <div className={`team-stat ${isCurrentTeam ? 'current-team' : ''}`}>
      <div className="team-stat-head">
        <div>
          <div className="team-stat-title">Team {team.teamId}</div>
          <div className="team-stat-players">{team.players.map((player) => player?.name).join(' & ')}</div>
        </div>
        <div className="team-score-stack">
          <strong>{team.score}</strong>
          <span>/40</span>
        </div>
      </div>
      <div className="team-progress" aria-hidden="true">
        <div className="team-progress-fill" style={{ width: `${progress}%` }} />
      </div>
      <div className="team-stat-line">Captured this hand <strong>{team.captured}</strong></div>
    </div>
  );
}

function TurnBanner({ game, round, currentPlayerId, activeCard, movesForActiveCard, moveOutcomes, lastPlayedCardId, boardCardsById }) {
  if (!game || !round) return null;

  const isYourTurn = round.turnPlayerId === currentPlayerId;
  const captureMoves = movesForActiveCard.filter((move) => move.type !== 'trail');
  const liveCaida = captureMoves.some((move) => moveOutcomes[moveKey(move)]?.isCaida);
  const liveLimpia = captureMoves.some((move) => moveOutcomes[moveKey(move)]?.isLimpia);
  const lastPlayedCard = lastPlayedCardId ? boardCardsById[lastPlayedCardId] : null;
  const currentTurnName = game.players?.[round.turnPlayerId]?.name || 'the table';

  let headline = `Waiting for ${currentTurnName}.`;
  let body = 'Watch the felt, count what is gone, and stay ready for the swing card.';

  if (isYourTurn) {
    headline = activeCard ? `Your turn — ${cardText(activeCard)} is live.` : 'Your turn — choose a card.';
    if (captureMoves.length === 0) {
      body = 'No clean capture is showing. Trail something that keeps your left side uncomfortable.';
    } else if (captureMoves.length === 1) {
      body = 'One clear capture line is available. Drag onto the glowing target or use the lane below.';
    } else {
      body = `${captureMoves.length} different capture lines are live. Preview one, then commit the cleanest hit.`;
    }
  }

  return (
    <section className={`turn-banner ${isYourTurn ? 'is-live' : 'is-waiting'}`}>
      <div>
        <div className="section-kicker">Round control</div>
        <h2>{headline}</h2>
        <p>{body}</p>
      </div>
      <div className="turn-banner-chips">
        <span className="turn-chip">Hand {round.handNumber}</span>
        <span className="turn-chip">Deal {round.activeDeal}</span>
        {activeCard ? <span className="turn-chip emphasis">Selected {cardText(activeCard)}</span> : null}
        {lastPlayedCard ? <span className="turn-chip warning">Caída target: {cardText(lastPlayedCard)}</span> : null}
        {liveCaida ? <span className="turn-chip bonus">Caída live</span> : null}
        {liveLimpia ? <span className="turn-chip bonus">Limpia live</span> : null}
      </div>
    </section>
  );
}

function Board({ cards, deckRemaining, canLimpia, highlightedCaptureIds, highlightedTargetIds, captureOrderMap, directDropMoves, previewTargetMeta, trailMove, dragCardId, onPlay, onPreview, lastPlayedCardId, previewedMove, previewOutcome, previewCopy, boardCardsById }) {
  const safeCards = Array.isArray(cards) ? cards : [];
  const highlighted = new Set(highlightedCaptureIds || []);
  const targets = new Set(highlightedTargetIds || []);
  const trailArmed = Boolean(trailMove) && dragCardId === trailMove.playedCardId;
  const previewToneClass = moveTone(previewedMove);
  const previewGroups = describePreviewGroups(previewedMove, boardCardsById);
  const sequenceIds = new Set((previewedMove?.captureIds || []).filter((id) => !targets.has(id)));

  return (
    <section className={`board-shell ${trailArmed ? 'board-shell-armed' : ''} preview-tone-${previewToneClass}`}>
      <div className="board-hud">
        <div className="hud-chip">Deck {deckRemaining}</div>
        <div className="hud-chip accent">{canLimpia ? 'Limpia available' : 'No limpia at 38+'}</div>
        <div className="hud-chip subdued">Drag to the felt or a live target</div>
      </div>

      <div
        className={`table-grid ${trailArmed ? 'is-drop-target' : ''}`}
        onMouseEnter={() => trailArmed && trailMove && onPreview(moveKey(trailMove))}
        onMouseLeave={() => onPreview('')}
        onDragOver={(event) => {
          if (!trailArmed) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = 'move';
          if (trailMove) onPreview(moveKey(trailMove));
        }}
        onDrop={(event) => {
          if (!trailArmed || !trailMove) return;
          event.preventDefault();
          onPlay(trailMove);
        }}
      >
        {safeCards.length ? safeCards.map((card, index) => {
          const directMove = directDropMoves?.[card.id];
          const canDirectDrop = Boolean(directMove) && dragCardId === directMove.playedCardId;
          const previewMeta = previewTargetMeta?.[card.id];
          const captureStep = captureOrderMap?.[card.id];
          const isLastPlayed = lastPlayedCardId === card.id;
          const isSequenceCard = sequenceIds.has(card.id);
          const toneClass = previewMeta ? `tone-${moveTone(previewMeta.move)}` : '';
          const targetLabel = previewMeta
            ? (previewMeta.candidateCount > 1 ? `${previewMeta.candidateCount} lines` : moveKindLabel(previewMeta.move))
            : '';
          const CardTag = directMove ? 'button' : 'div';

          return (
            <CardTag
              key={card.id}
              type={directMove ? 'button' : undefined}
              className={[
                'stitch-card',
                'board-card',
                cardSuitClass(card),
                highlighted.has(card.id) ? 'is-highlighted' : '',
                targets.has(card.id) ? 'is-target-card' : '',
                isSequenceCard ? 'is-sequence-card' : '',
                previewMeta ? 'has-preview-target' : '',
                toneClass,
                directMove ? 'is-click-target' : '',
                canDirectDrop ? 'is-direct-target' : '',
                isLastPlayed ? 'is-last-played' : '',
              ].filter(Boolean).join(' ')}
              style={{ '--card-tilt': boardCardTilt(index) }}
              onClick={() => directMove && onPlay(directMove)}
              onMouseEnter={() => previewMeta && onPreview(previewMeta.previewKey)}
              onMouseLeave={() => previewMeta && onPreview('')}
              onFocus={() => previewMeta && onPreview(previewMeta.previewKey)}
              onBlur={() => previewMeta && onPreview('')}
              onDragOver={(event) => {
                if (previewMeta) onPreview(previewMeta.previewKey);
                if (!canDirectDrop) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
              }}
              onDrop={(event) => {
                if (!canDirectDrop) return;
                event.preventDefault();
                event.stopPropagation();
                onPlay(directMove);
              }}
            >
              {previewMeta ? <div className={`card-target-tag ${toneClass}`}>{targetLabel}</div> : null}
              {isLastPlayed ? <div className="card-status-tag">Last card</div> : null}
              {captureStep ? <div className="capture-step-tag">{captureStep}</div> : null}
              <div className="card-corner">{card.rank}</div>
              <div className="card-center">{card.suit}</div>
              <div className="card-corner bottom">{card.rank}</div>
            </CardTag>
          );
        }) : <div className="empty-table">No cards on the felt yet.</div>}
      </div>

      {previewedMove ? (
        <div className={`board-preview ${previewToneClass}`}>
          <div className="board-preview-head">
            <div>
              <div className="board-preview-kicker">{moveKindLabel(previewedMove)} preview</div>
              <div className="board-preview-copy">{previewCopy}</div>
            </div>
            <div className="board-preview-badges">
              <span className={`preview-pill tone-${previewToneClass}`}>{moveKindLabel(previewedMove)}</span>
              {previewOutcome?.sequenceCount > 0 ? <span className="preview-pill">Run +{previewOutcome.sequenceCount}</span> : null}
              {previewOutcome?.isCaida ? <span className="preview-pill bonus">Caída +2</span> : null}
              {previewOutcome?.isLimpia ? <span className="preview-pill bonus">Limpia +2</span> : null}
              {previewedMove.type === 'trail' ? <span className="preview-pill subtle">No capture</span> : null}
            </div>
          </div>
          {previewGroups.length ? (
            <div className="board-preview-groups">
              {previewGroups.map((group) => (
                <div key={`${group.label}-${group.cards}`} className="preview-group-row">
                  <span className="preview-group-label">{group.label}</span>
                  <span className="preview-group-cards">{group.cards}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function MoveOptionCard({ move, playedCard, boardCardsById, moveOutcome, isPreviewed, dragCardId, onPreview, onPlay }) {
  const captureCards = (move.captureIds || []).map((id) => boardCardsById[id]).filter(Boolean);
  const canDrop = dragCardId === move.playedCardId;
  const kindLabel = moveKindLabel(move);
  const toneClass = moveTone(move);
  const chips = [];

  if (move.type !== 'trail') chips.push(`${moveOutcome.captureCount} table card${moveOutcome.captureCount === 1 ? '' : 's'}`);
  if (moveOutcome.sequenceCount > 0) chips.push(`Sequence +${moveOutcome.sequenceCount}`);
  if (moveOutcome.isCaida) chips.push('Caída +2');
  if (moveOutcome.isLimpia) chips.push('Limpia +2');
  if (move.type === 'trail') chips.push('No capture');

  return (
    <button
      type="button"
      className={`move-option tone-${toneClass} ${isPreviewed ? 'previewed' : ''} ${canDrop ? 'drop-ready' : ''}`}
      onClick={() => onPlay(move)}
      onMouseEnter={() => onPreview(moveKey(move))}
      onMouseLeave={() => onPreview('')}
      onFocus={() => onPreview(moveKey(move))}
      onBlur={() => onPreview('')}
      onDragOver={(event) => {
        if (!canDrop) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
      }}
      onDrop={(event) => {
        if (!canDrop) return;
        event.preventDefault();
        onPlay(move);
      }}
    >
      <div className="move-option-head">
        <span className={`move-kind tone-${toneClass}`}>{kindLabel}</span>
        <span className="move-kicker">{moveOutcome.bonusPoints ? `+${moveOutcome.bonusPoints} swing` : canDrop ? 'Drop to play' : 'Click to play'}</span>
      </div>
      {move.type === 'trail' ? (
        <div className="move-empty-target">Leave {cardText(playedCard)} on the table.</div>
      ) : (
        <div className="move-lineup">
          <span className={`mini-card played ${cardSuitClass(playedCard)}`}>{cardText(playedCard)}</span>
          <span className="move-arrow">→</span>
          <div className="move-capture-row">
            {captureCards.map((card) => <span key={card.id} className={`mini-card ${cardSuitClass(card)}`}>{cardText(card)}</span>)}
          </div>
        </div>
      )}
      <div className="move-badges">
        {chips.map((chip) => <span key={chip} className={`move-badge tone-${toneClass}`}>{chip}</span>)}
      </div>
      <div className="move-label">{describeMove(move, boardCardsById, moveOutcome)}</div>
    </button>
  );
}

function MovePicker({ hand, legalMoves, boardCardsById, onPlay, isYourTurn, activeCardId, setSelectedCardId, dragCardId, setDragCardId, previewMoveKey, setPreviewMoveKey, moveOutcomes }) {
  const handCardsById = useMemo(() => Object.fromEntries(hand.map((card) => [card.id, card])), [hand]);
  const activeCard = handCardsById[activeCardId] || hand[0] || null;
  const movesForCard = legalMoves.filter((move) => move.playedCardId === activeCard?.id);
  const orderedMoves = [...movesForCard.filter((move) => move.type !== 'trail'), ...movesForCard.filter((move) => move.type === 'trail')];

  return (
    <section className="hand-shell">
      <div className="hand-head">
        <span>Your hand</span>
        <span className="hand-kicker">Pick the swing card, then aim with intent</span>
      </div>
      <div className="hand-row stitch-hand-row">
        {hand.map((card, index) => (
          <button
            key={card.id}
            type="button"
            draggable={isYourTurn}
            className={`stitch-card hand-card ${cardSuitClass(card)} ${activeCardId === card.id ? 'selected' : ''} ${dragCardId === card.id ? 'dragging' : ''}`}
            style={{ '--card-tilt': cardTilt(index, hand.length) }}
            onClick={() => setSelectedCardId(card.id)}
            onDragStart={(event) => {
              setSelectedCardId(card.id);
              setDragCardId(card.id);
              event.dataTransfer.effectAllowed = 'move';
              event.dataTransfer.setData('text/plain', card.id);
            }}
            onDragEnd={() => {
              setDragCardId('');
              setPreviewMoveKey('');
            }}
          >
            <div className="card-corner">{card.rank}</div>
            <div className="card-center">{card.suit}</div>
            <div className="card-corner bottom">{card.rank}</div>
          </button>
        ))}
      </div>
      {isYourTurn ? (
        <div className="play-controls">
          <div className="ghost-note">
            {activeCard ? `Capture lanes for ${cardText(activeCard)}. Drag to a live target for speed, or click a lane if you want the exact call spelled out first.` : 'Choose a card to see its capture lines.'}
          </div>
          <div className="move-options-grid">
            {orderedMoves.map((move) => (
              <MoveOptionCard
                key={moveKey(move)}
                move={move}
                playedCard={handCardsById[move.playedCardId]}
                boardCardsById={boardCardsById}
                moveOutcome={moveOutcomes[moveKey(move)]}
                isPreviewed={previewMoveKey === moveKey(move)}
                dragCardId={dragCardId}
                onPreview={setPreviewMoveKey}
                onPlay={onPlay}
              />
            ))}
          </div>
        </div>
      ) : <div className="muted-note">Waiting for your turn. Count what is gone and keep your partner’s lane in mind.</div>}
    </section>
  );
}

function ActivityPanel({ round, game, currentPlayerId }) {
  const me = game?.players?.[currentPlayerId];
  const teamId = round?.teamsByPlayer?.[currentPlayerId]?.teamId;
  const seat = round?.teamsByPlayer?.[currentPlayerId]?.seat;
  const recent = (round?.events || []).slice(0, 5);
  const dealerPlayerId = getDealerPlayerId(round, game?.seating);
  const dealerName = dealerPlayerId ? game?.players?.[dealerPlayerId]?.name : '';

  return (
    <aside className="activity-column">
      <div className="profile-card">
        <div className="profile-avatar">{(me?.name || '?').slice(0, 1).toUpperCase()}</div>
        <div className="profile-name">{me?.name || 'Player'}</div>
        <div className="profile-sub">Seat {seat || '?'} · Team {teamId || '?'}</div>
        <div className="profile-stats">
          <div><span>Team score</span><strong>{teamId ? (game.scores?.[teamId] || 0) : 0}</strong></div>
          <div><span>Cards won</span><strong>{teamId ? (round.capturedCardCount?.[teamId] || 0) : 0}</strong></div>
        </div>
        <div className="profile-tags">
          {dealerName ? <span className="profile-tag">Dealer: {dealerName}</span> : null}
          <span className="profile-tag">Goal: first to 40</span>
        </div>
      </div>
      <div className="activity-card">
        <div className="activity-title">Recent table calls</div>
        <ul>
          {recent.map((event, index) => <li key={`${event}-${index}`}>{event}</li>)}
        </ul>
      </div>
    </aside>
  );
}

export default function App() {
  const [{ initialUrlCode, initialSavedSession }] = useState(() => {
    const urlCode = getGameCodeFromUrl();
    const savedSession = getSavedSession();

    return {
      initialUrlCode: urlCode,
      initialSavedSession: savedSession,
    };
  });

  const [name, setName] = useState(getSavedName());
  const [joinCode, setJoinCode] = useState(initialUrlCode || '');
  const [gameCode, setGameCode] = useState(initialUrlCode || initialSavedSession?.gameCode || '');
  const [savedSession, setSavedSession] = useState(initialSavedSession);
  const [game, setGame] = useState(null);
  const [gameLoadState, setGameLoadState] = useState(gameCode ? 'loading' : 'idle');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [dbStatus, setDbStatus] = useState('checking');
  const [linkCopied, setLinkCopied] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState('');
  const [dragCardId, setDragCardId] = useState('');
  const [previewMoveKey, setPreviewMoveKey] = useState('');
  const [referenceTab, setReferenceTab] = useState('');

  const playerId = useMemo(() => getLocalPlayerId(), []);
  const gameRef = useMemo(() => (gameCode ? ref(db, `games/${gameCode}`) : null), [gameCode]);

  function rememberSession(code) {
    saveGameSession(code);
    setSavedSession({ gameCode: code, lastVisitedAt: Date.now() });
  }

  function forgetSavedGame() {
    clearSavedSession();
    setSavedSession(null);
    if (savedSession?.gameCode === gameCode) {
      setGameCode('');
      setGame(null);
      setGameLoadState('idle');
    }
  }

  function returnHome() {
    setGameCode('');
    setGame(null);
    setGameLoadState('idle');
    setError('');
  }

  async function copyShareLink() {
    const shareUrl = buildGameUrl(gameCode);
    if (!shareUrl) return;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setLinkCopied(true);
    } catch {
      window.prompt('Copy this rejoin link:', shareUrl);
    }
  }

  useEffect(() => {
    if (!linkCopied) return undefined;
    const timer = window.setTimeout(() => setLinkCopied(false), 1800);
    return () => window.clearTimeout(timer);
  }, [linkCopied]);

  useEffect(() => {
    syncGameUrl(gameCode);
  }, [gameCode]);

  useEffect(() => {
    let cancelled = false;
    async function checkDbAccess() {
      try {
        const response = await fetch(`${databaseUrl}/games.json?shallow=true`);
        if (!cancelled) setDbStatus(response.ok ? 'ok' : response.status === 401 ? 'read-denied' : 'error');
      } catch {
        if (!cancelled) setDbStatus('error');
      }
    }
    checkDbAccess();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!gameRef) {
      setGame(null);
      setGameLoadState('idle');
      return undefined;
    }

    setGame(null);
    setGameLoadState('loading');

    return onValue(
      gameRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setGame(null);
          setGameLoadState('missing');
          return;
        }

        setGame(snapshot.val());
        setGameLoadState('loaded');
      },
      (firebaseError) => {
        setError(firebaseError.message || 'Realtime sync failed.');
        setGameLoadState('missing');
      }
    );
  }, [gameRef]);

  useEffect(() => {
    if (game?.players?.[playerId] && game.code && savedSession?.gameCode !== game.code) {
      rememberSession(game.code);
    }
  }, [game?.code, game?.players?.[playerId], playerId, savedSession?.gameCode]);

  const seating = game?.seating?.map((id) => game.players[id]);
  const isParticipant = Boolean(game?.players?.[playerId]);
  const teams = teamSummary(game);
  const round = game?.round;
  const boardCards = Array.isArray(round?.board) ? round.board : [];
  const boardCardsById = useMemo(
    () => Object.fromEntries(boardCards.map((card) => [card.id, card])),
    [boardCards]
  );
  const visibleHand = round ? (getVisibleHand(round, playerId) || []) : [];
  const legalMoves = round ? (getLegalMoves(round, playerId) || []) : [];
  const moveOutcomes = useMemo(
    () => Object.fromEntries(legalMoves.map((move) => [moveKey(move), analyzeMove(game, playerId, move)])),
    [game, legalMoves, playerId]
  );
  const isHost = game?.hostId === playerId;
  const isYourTurn = round?.turnPlayerId === playerId;
  const currentTeamId = round?.teamsByPlayer?.[playerId]?.teamId;
  const canLimpia = round ? ((game?.scores?.[currentTeamId] || 0) < 38) : false;
  const activeCardId = dragCardId || selectedCardId || visibleHand[0]?.id || '';
  const activeCard = visibleHand.find((card) => card.id === activeCardId) || visibleHand[0] || null;
  const movesForActiveCard = legalMoves.filter((move) => move.playedCardId === activeCard?.id);
  const captureMovesForActiveCard = movesForActiveCard.filter((move) => move.type !== 'trail');
  const previewedMove = movesForActiveCard.find((move) => moveKey(move) === previewMoveKey)
    || captureMovesForActiveCard[0]
    || movesForActiveCard[0]
    || null;
  const trailMove = movesForActiveCard.find((move) => move.type === 'trail') || null;
  const previewOutcome = previewedMove ? moveOutcomes[moveKey(previewedMove)] : null;
  const previewCopy = previewedMove ? describeMove(previewedMove, boardCardsById, previewOutcome || {}) : '';
  const directDropMoves = useMemo(
    () => buildDirectDropMoves(captureMovesForActiveCard),
    [captureMovesForActiveCard]
  );
  const previewTargetMeta = useMemo(
    () => buildPreviewTargetMeta(captureMovesForActiveCard),
    [captureMovesForActiveCard]
  );
  const highlightedCaptureIds = previewedMove?.captureIds || [];
  const highlightedTargetIds = previewedMove?.targetIds || [];
  const captureOrderMap = useMemo(
    () => Object.fromEntries((previewedMove?.captureIds || []).map((id, index) => [id, index + 1])),
    [previewedMove]
  );
  const lastPlayedCardId = round?.lastPlayedCard
    && round.lastPlayedCard.dealNumber === round.activeDeal
    && round.lastPlayedCard.turnNumber === round.playsInCurrentDeal
    ? round.lastPlayedCard.cardId
    : null;

  useEffect(() => {
    if (!visibleHand.some((card) => card.id === selectedCardId)) {
      setSelectedCardId(visibleHand[0]?.id || '');
    }
  }, [visibleHand, selectedCardId]);

  useEffect(() => {
    const validKeys = movesForActiveCard.map((move) => moveKey(move));
    if (!validKeys.length) {
      if (previewMoveKey) setPreviewMoveKey('');
      return;
    }
    if (!validKeys.includes(previewMoveKey)) {
      const preferred = captureMovesForActiveCard[0] || movesForActiveCard[0];
      setPreviewMoveKey(preferred ? moveKey(preferred) : '');
    }
  }, [captureMovesForActiveCard, movesForActiveCard, previewMoveKey]);

  async function createGame() {
    const trimmed = name.trim();
    if (!trimmed) return setError('Enter your name first.');
    if (dbStatus === 'read-denied') return setError('RTDB public reads are currently blocked, so lobby creation cannot work yet. Update the live database rules first.');
    saveName(trimmed);
    setBusy(true);
    setError('');

    try {
      let code = generateGameCode();
      let created = false;
      while (!created) {
        const nextRef = ref(db, `games/${code}`);
        const result = await runTransaction(nextRef, (current) => {
          if (current) return current;
          const next = createInitialGameState(trimmed, playerId);
          next.code = code;
          return next;
        });
        created = result.committed;
        if (!created) code = generateGameCode();
      }
      rememberSession(code);
      setJoinCode(code);
      setGameCode(code);
    } catch (transactionError) {
      setError(transactionError.message || 'Unable to create game. Check Firebase database rules and config.');
    } finally {
      setBusy(false);
    }
  }

  async function joinGame() {
    const trimmed = name.trim();
    const code = normalizeGameCode(gameCode || joinCode);
    if (!trimmed || !isValidGameCode(code)) return setError('Enter your name and a valid 6-character game code.');
    if (dbStatus === 'read-denied') return setError('RTDB public reads are currently blocked, so joining cannot work yet. Update the live database rules first.');
    saveName(trimmed);
    setBusy(true);
    setError('');

    const joinRef = ref(db, `games/${code}`);
    try {
      const existingSnapshot = await get(joinRef);
      const existing = existingSnapshot.val();
      if (!existing) throw new Error('Game not found.');

      if (existing.players?.[playerId]) {
        const result = await runTransaction(joinRef, (current) => {
          if (!current?.players?.[playerId]) return current;
          const now = Date.now();
          current.players[playerId] = {
            ...current.players[playerId],
            name: trimmed,
            lastSeenAt: now,
            rejoinedAt: now,
            reconnectCount: (current.players[playerId].reconnectCount || 0) + 1,
          };
          stampSessionMetadata(current, { now, action: 'player_rejoined', actorId: playerId });
          return current;
        }, { applyLocally: false });

        if (!result?.snapshot?.exists()) throw new Error('Game not found.');
        rememberSession(code);
        setJoinCode(code);
        setGameCode(code);
        return;
      }

      if (existing.status !== 'lobby') throw new Error('Game already started. Reopen the original game link on the same browser to reconnect.');
      if ((existing.seating || []).length >= 4) throw new Error('Game is full.');

      const result = await runTransaction(joinRef, (current) => {
        if (!current) return current;
        current.players ||= {};
        current.seating ||= [];
        const now = Date.now();
        current.players[playerId] = {
          id: playerId,
          name: trimmed,
          joinedAt: now,
          lastSeenAt: now,
          reconnectCount: 0,
          isHost: current.hostId === playerId,
        };
        if (!current.seating.includes(playerId)) current.seating.push(playerId);
        current.lobbyMessage = current.seating.length === 4 ? 'Ready for host review' : 'Waiting for players';
        stampSessionMetadata(current, { now, action: 'player_joined', actorId: playerId });
        return current;
      }, { applyLocally: false });

      if (!result?.snapshot?.exists()) throw new Error('Game not found.');
      rememberSession(code);
      setJoinCode(code);
      setGameCode(code);
    } catch (transactionError) {
      setError(transactionError.message || 'Unable to join game.');
    } finally {
      setBusy(false);
    }
  }

  async function startGame() {
    if (!game || game.hostId !== playerId) return;
    if ((game.seating || []).length !== 4) return setError('Need exactly 4 players.');
    setBusy(true);
    setError('');
    await runTransaction(gameRef, (current) => {
      if (!current) return current;
      if (current.hostId !== playerId) throw new Error('Only host can start.');
      if ((current.seating || []).length !== 4) throw new Error('Need exactly 4 players.');
      return startMatchFromLobby(current);
    }, { applyLocally: false }).catch((transactionError) => setError(transactionError.message || 'Could not start game.'));
    setBusy(false);
  }

  async function playChosenMove(move) {
    if (!move) return;
    setDragCardId('');
    setPreviewMoveKey('');
    setBusy(true);
    setError('');
    await runTransaction(gameRef, (current) => {
      if (!current) return current;
      return applyMove(current, playerId, move);
    }, { applyLocally: false }).catch((transactionError) => setError(transactionError.message || 'Could not play move.'));
    setBusy(false);
  }

  const showHome = !gameCode || gameLoadState === 'missing';
  const showGameChrome = Boolean(gameCode) && gameLoadState !== 'missing';
  const shareUrl = showGameChrome ? buildGameUrl(gameCode) : '';

  return (
    <main className="cuarenta-app">
      <header className="topbar">
        <div className="brand-block">
          <div className="brand">Cuarenta</div>
          <nav className="topnav">
            <button
              type="button"
              aria-haspopup="dialog"
              aria-expanded={referenceTab === 'rules'}
              className={referenceTab === 'rules' ? 'active' : ''}
              onClick={() => setReferenceTab(referenceTab === 'rules' ? '' : 'rules')}
            >
              Rules
            </button>
            <button
              type="button"
              aria-haspopup="dialog"
              aria-expanded={referenceTab === 'scoring'}
              className={referenceTab === 'scoring' ? 'active' : ''}
              onClick={() => setReferenceTab(referenceTab === 'scoring' ? '' : 'scoring')}
            >
              Scoring
            </button>
          </nav>
        </div>
        <div className="topbar-actions">
          {showGameChrome ? <button type="button" className="secondary-chip" onClick={returnHome}>Home</button> : null}
          {showGameChrome ? <GameCode code={gameCode} /> : null}
          {showGameChrome ? <button type="button" className="header-button" onClick={copyShareLink}>{linkCopied ? 'Link copied' : 'Share link'}</button> : null}
        </div>
      </header>

      <ReferenceDrawer tab={referenceTab} onRequestClose={() => setReferenceTab('')} onTabChange={setReferenceTab} />

      {showHome ? (
        <section className="lobby-shell invite-mode">
          <div className="invite-copy">
            <div className="eyebrow">Lobby invitation</div>
            <h1>Host or Join a Match</h1>
            <p>Classic four-player Cuarenta with reconnectable links, better move previews, and a felt-first drag flow that explains what will happen before you commit.</p>
          </div>
          {gameLoadState === 'missing' && gameCode ? (
            <section className="notice-card">
              Game <strong>{gameCode}</strong> is not in the database anymore. If this was your last session, you can forget it below and start fresh.
            </section>
          ) : null}
          <section className="auth-card">
            <label>
              Your name
              <input value={name} onChange={(event) => setName(event.target.value)} maxLength={24} placeholder="Mateo V." />
            </label>
            <div className="button-stack">
              <button className="primary-button" disabled={busy || dbStatus === 'checking'} onClick={createGame}>Host game</button>
            </div>
            <div className="join-inline">
              <input value={joinCode} onChange={(event) => setJoinCode(normalizeGameCode(event.target.value))} placeholder="Enter code" maxLength={6} />
              <button className="secondary-button" disabled={busy || dbStatus === 'checking'} onClick={joinGame}>Join</button>
            </div>
            <div className="ghost-note">This browser remembers the current seat, so a refresh does not quietly murder the match.</div>
          </section>
          {savedSession ? (
            <section className="resume-card">
              <div>
                <div className="resume-title">Resume saved session</div>
                <div className="resume-copy">{savedSession.gameCode} is still pinned to this browser.</div>
              </div>
              <div className="resume-actions">
                <button type="button" className="secondary-button" onClick={() => setGameCode(savedSession.gameCode)}>Resume</button>
                <button type="button" className="text-button" onClick={forgetSavedGame}>Forget</button>
              </div>
            </section>
          ) : null}
        </section>
      ) : null}

      {dbStatus === 'read-denied' ? (
        <section className="notice-card">
          The live Firebase Realtime Database still rejects public reads for the game path. With the current no-auth design, host and join will not work until those live rules are deployed.
        </section>
      ) : null}

      {gameCode && gameLoadState === 'loading' ? <section className="notice-card">Loading game…</section> : null}

      {game && game.status === 'lobby' ? (
        <section className="lobby-shell">
          <div className="invite-copy centered">
            <div className="eyebrow">Lobby invitation</div>
            <h1>{game.code.split('').join('-')}</h1>
            <p>{game.lobbyMessage || 'Share this code with three friends and let the table talk begin.'}</p>
          </div>
          <section className="notice-card slim-note">
            Rejoin URL: <strong>{shareUrl}</strong>
          </section>
          <div className="lobby-grid">
            {[0, 1, 2, 3].map((index) => <LobbySeat key={index} slot={index + 1} player={seating?.[index]} isCurrent={seating?.[index]?.id === playerId} />)}
          </div>
          {!isParticipant ? (
            <section className="auth-card join-lobby-card">
              <label>
                Your name
                <input value={name} onChange={(event) => setName(event.target.value)} maxLength={24} placeholder="Mateo V." />
              </label>
              <button className="primary-button" disabled={busy || dbStatus === 'checking'} onClick={joinGame}>Take a seat</button>
              <div className="ghost-note">Open this same link later on this browser and you will land back in the game instead of getting bounced to the lobby.</div>
            </section>
          ) : (
            <div className="lobby-actions">
              {isHost ? <button className="primary-button wide" disabled={busy || (game.seating || []).length !== 4} onClick={startGame}>Start game</button> : null}
              <div className="lobby-footnote">Requires 4 players to begin</div>
            </div>
          )}
        </section>
      ) : null}

      {game && round && isParticipant ? (
        <>
          <section className="notice-card slim-note">
            Refresh-safe session is active for <strong>{game.code}</strong>. Reopen the same link on this browser to reconnect mid-match.
          </section>
          <section className="game-layout">
            <TurnOrder game={game} currentPlayerId={playerId} />
            <section className="center-column">
              <div className="team-stats-row">
                {teams.map((team) => <TeamCard key={team.teamId} team={team} isCurrentTeam={team.teamId === currentTeamId} />)}
                <div className="phase-card">
                  <div className="team-stat-title">Round state</div>
                  <div className="phase-name">Hand {round.handNumber} · Deal {round.activeDeal}</div>
                  <div className="phase-turn">Turn: {game.players[round.turnPlayerId]?.name}</div>
                </div>
              </div>
              <TurnBanner
                game={game}
                round={round}
                currentPlayerId={playerId}
                activeCard={activeCard}
                movesForActiveCard={movesForActiveCard}
                moveOutcomes={moveOutcomes}
                lastPlayedCardId={lastPlayedCardId}
                boardCardsById={boardCardsById}
              />
              <Board
                cards={round.board}
                deckRemaining={round.deckRemaining}
                canLimpia={canLimpia}
                highlightedCaptureIds={highlightedCaptureIds}
                highlightedTargetIds={highlightedTargetIds}
                captureOrderMap={captureOrderMap}
                directDropMoves={directDropMoves}
                previewTargetMeta={previewTargetMeta}
                trailMove={trailMove}
                dragCardId={dragCardId}
                onPlay={playChosenMove}
                onPreview={setPreviewMoveKey}
                lastPlayedCardId={lastPlayedCardId}
                previewedMove={previewedMove}
                previewOutcome={previewOutcome}
                previewCopy={previewCopy}
                boardCardsById={boardCardsById}
              />
              <MovePicker
                hand={visibleHand}
                legalMoves={legalMoves}
                boardCardsById={boardCardsById}
                onPlay={playChosenMove}
                isYourTurn={isYourTurn}
                activeCardId={activeCardId}
                setSelectedCardId={setSelectedCardId}
                dragCardId={dragCardId}
                setDragCardId={setDragCardId}
                previewMoveKey={previewMoveKey}
                setPreviewMoveKey={setPreviewMoveKey}
                moveOutcomes={moveOutcomes}
              />
              {game.status === 'finished' ? <section className="notice-card">Game over — Team {game.winner} wins.</section> : null}
            </section>
            <ActivityPanel round={round} game={game} currentPlayerId={playerId} />
          </section>
        </>
      ) : null}

      {game && round && !isParticipant ? (
        <section className="notice-card">
          This game is already in progress. Mid-game entry is intentionally limited to the original browser session for that seat, so use the original rejoin link from the player who was already in the game.
        </section>
      ) : null}

      {error ? <div className="error-banner">{error}</div> : null}
    </main>
  );
}
