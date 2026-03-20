const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', 'J', 'Q', 'K'];
const NUMERIC_RANKS = new Set(['A', '2', '3', '4', '5', '6', '7']);
const RANK_TO_VALUE = { A: 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, J: 8, Q: 9, K: 10 };
const TEAM_IDS = ['A', 'B'];

export function rankValue(rank) {
  return RANK_TO_VALUE[rank];
}

function makeCard(rank, suit, id) {
  return { id, rank, suit, value: rankValue(rank) };
}

export function createDeck() {
  const cards = [];
  let counter = 0;
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      cards.push(makeCard(rank, suit, `c_${counter++}`));
    }
  }
  return cards;
}

export function shuffleDeck(deck) {
  const copy = [...deck];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function generateGameCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i += 1) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

function rotateOrder(playerIds, dealerIndex) {
  const start = (dealerIndex + 1) % playerIds.length;
  return [...playerIds.slice(start), ...playerIds.slice(0, start)];
}

function countRanks(cards) {
  const counts = {};
  for (const card of cards) counts[card.rank] = (counts[card.rank] || 0) + 1;
  return counts;
}

function findRondaRanks(cards) {
  return Object.entries(countRanks(cards)).filter(([, count]) => count >= 3).map(([rank]) => rank);
}

function hasFourOfAKind(cards) {
  return Object.values(countRanks(cards)).some((count) => count >= 4);
}

function subsetCaptures(boardCards, targetValue) {
  const numeric = boardCards.filter((card) => NUMERIC_RANKS.has(card.rank));
  const results = [];
  function walk(index, current, total) {
    if (total === targetValue && current.length) {
      results.push([...current]);
      return;
    }
    if (total >= targetValue) return;
    for (let i = index; i < numeric.length; i += 1) {
      current.push(numeric[i]);
      walk(i + 1, current, total + numeric[i].value);
      current.pop();
    }
  }
  walk(0, [], 0);
  return results;
}

function applySequence(boardCards, baseCaptured, playedCard) {
  const capturedIds = new Set(baseCaptured.map((card) => card.id));
  const leftover = boardCards.filter((card) => !capturedIds.has(card.id));
  const extra = [];
  let nextValue = playedCard.value + 1;
  while (true) {
    const nextCard = leftover.find((card) => card.value === nextValue);
    if (!nextCard) break;
    extra.push(nextCard);
    leftover.splice(leftover.findIndex((card) => card.id === nextCard.id), 1);
    nextValue += 1;
  }
  return [...baseCaptured, ...extra];
}

export function getTeamIdForSeat(seat) {
  return seat % 2 === 1 ? 'A' : 'B';
}

export function assignTeams(players) {
  return players.reduce((acc, player, index) => {
    const seat = index + 1;
    acc[player.id] = { teamId: getTeamIdForSeat(seat), seat };
    return acc;
  }, {});
}

export function createInitialGameState(hostName, hostId) {
  return {
    code: '',
    status: 'lobby',
    hostId,
    createdAt: Date.now(),
    startedAt: null,
    players: {
      [hostId]: {
        id: hostId,
        name: hostName.trim(),
        joinedAt: Date.now(),
        isHost: true,
      },
    },
    seating: [hostId],
    scores: { A: 0, B: 0 },
    lobbyMessage: 'Waiting for players',
  };
}

function buildRound(players, dealerIndex, scores, handNumber = 1) {
  const seating = players.map((player) => player.id);
  const deck = shuffleDeck(createDeck());
  const teamsByPlayer = assignTeams(players);
  const hands = {};
  const capturePiles = { A: [], B: [] };
  const roundOrder = rotateOrder(seating, dealerIndex);

  for (const playerId of seating) hands[playerId] = [];
  for (let deal = 0; deal < 2; deal += 1) {
    for (const playerId of roundOrder) {
      for (let cardIndex = 0; cardIndex < 5; cardIndex += 1) {
        hands[playerId].push(deck.shift());
      }
    }
  }

  const round = {
    handNumber,
    dealerIndex,
    turnOrder: roundOrder,
    turnPlayerId: roundOrder[0],
    activeDeal: 1,
    playsInCurrentDeal: 0,
    hands,
    board: [],
    deckRemaining: 0,
    capturePiles,
    capturedCardCount: { A: 0, B: 0 },
    perDealHands: {
      1: Object.fromEntries(seating.map((id) => [id, hands[id].slice(0, 5)])),
      2: Object.fromEntries(seating.map((id) => [id, hands[id].slice(5, 10)])),
    },
    rondaClaims: [],
    lastPlayedCard: null,
    lastCapture: null,
    events: [`Hand ${handNumber} started. Dealer: ${players[dealerIndex].name}.`],
    teamsByPlayer,
    scores,
  };

  applyDealAnnouncements(round, 1, players);
  return round;
}

function applyDealAnnouncements(round, dealNumber, players) {
  const dealHands = round.perDealHands[dealNumber];
  for (const player of players) {
    const cards = dealHands[player.id] || [];
    if (hasFourOfAKind(cards)) {
      const teamId = round.teamsByPlayer[player.id].teamId;
      round.scores[teamId] = 40;
      round.status = 'finished';
      round.winner = teamId;
      round.events.unshift(`${player.name} was dealt four of a kind. Team ${teamId} wins immediately.`);
      return;
    }
    const rondaRanks = findRondaRanks(cards);
    if (rondaRanks.length) {
      const teamId = round.teamsByPlayer[player.id].teamId;
      if (round.scores[teamId] < 30) {
        round.scores[teamId] += 4;
        round.rondaClaims.push({ playerId: player.id, teamId, dealNumber, ranks: rondaRanks });
        round.events.unshift(`${player.name} announced ronda for +4 points.`);
      }
    }
  }
}

export function startMatchFromLobby(game) {
  const players = game.seating.map((playerId) => game.players[playerId]);
  const round = buildRound(players, 0, { A: 0, B: 0 }, 1);
  return {
    ...game,
    status: round.status === 'finished' ? 'finished' : 'playing',
    startedAt: Date.now(),
    seating: players.map((player) => player.id),
    scores: round.scores,
    round,
    lobbyMessage: 'Game started',
    winner: round.winner || null,
  };
}

function visibleHandForPlayer(round, playerId) {
  const source = round.perDealHands[round.activeDeal]?.[playerId] || [];
  return source.filter((card) => round.hands[playerId].some((owned) => owned.id === card.id));
}

export function getVisibleHand(round, playerId) {
  return visibleHandForPlayer(round, playerId);
}

export function getLegalMoves(round, playerId) {
  if (!round || round.turnPlayerId !== playerId || round.status === 'finished') return [];
  const hand = visibleHandForPlayer(round, playerId);
  const moves = [];

  for (const card of hand) {
    moves.push({ type: 'trail', playedCardId: card.id, label: `${card.rank}${card.suit} to table` });

    for (const target of round.board.filter((boardCard) => boardCard.rank === card.rank)) {
      const captured = applySequence(round.board, [target], card);
      moves.push({
        type: 'match',
        playedCardId: card.id,
        targetIds: [target.id],
        captureIds: captured.map((capturedCard) => capturedCard.id),
        label: `${card.rank}${card.suit} match ${target.rank}${target.suit}${captured.length > 1 ? ` + sequence (${captured.length})` : ''}`,
      });
    }

    if (NUMERIC_RANKS.has(card.rank)) {
      const additions = subsetCaptures(round.board, card.value);
      for (const set of additions) {
        const captured = applySequence(round.board, set, card);
        const text = set.map((c) => `${c.rank}${c.suit}`).join(' + ');
        moves.push({
          type: 'add',
          playedCardId: card.id,
          targetIds: set.map((c) => c.id),
          captureIds: captured.map((capturedCard) => capturedCard.id),
          label: `${card.rank}${card.suit} capture ${text}${captured.length > set.length ? ` + sequence (${captured.length})` : ''}`,
        });
      }
    }
  }

  const seen = new Set();
  return moves.filter((move) => {
    const key = `${move.type}:${move.playedCardId}:${(move.captureIds || []).join(',')}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function nextTurnPlayer(round) {
  const currentIndex = round.turnOrder.indexOf(round.turnPlayerId);
  return round.turnOrder[(currentIndex + 1) % round.turnOrder.length];
}

function summarizeCard(card) {
  return `${card.rank}${card.suit}`;
}

function finalizeHand(game) {
  const round = game.round;
  const pointsByCards = { A: 0, B: 0 };
  const a = round.capturedCardCount.A;
  const b = round.capturedCardCount.B;
  const dealerTeam = round.teamsByPlayer[round.turnOrder[round.dealerIndex]]?.teamId || 'A';
  const nonDealerTeam = dealerTeam === 'A' ? 'B' : 'A';

  if (a >= 20 || b >= 20) {
    if (a === 20 && b === 20) {
      pointsByCards[nonDealerTeam] = 6;
    } else {
      for (const teamId of TEAM_IDS) {
        const count = round.capturedCardCount[teamId];
        if (count >= 20) pointsByCards[teamId] = 6 + Math.ceil((count - 20) / 2) * 2;
      }
    }
  } else if (a === b) {
    pointsByCards[nonDealerTeam] = 2;
  } else {
    pointsByCards[a > b ? 'A' : 'B'] = 2;
  }

  const nextScores = { A: game.scores.A + pointsByCards.A, B: game.scores.B + pointsByCards.B };
  round.events.unshift(`Hand ${round.handNumber} scored: Team A +${pointsByCards.A}, Team B +${pointsByCards.B}.`);

  if (nextScores.A >= 40 || nextScores.B >= 40) {
    return {
      ...game,
      status: 'finished',
      scores: nextScores,
      winner: nextScores.A >= 40 ? 'A' : 'B',
      round: { ...round, status: 'finished', scores: nextScores },
    };
  }

  const players = game.seating.map((playerId) => game.players[playerId]);
  const nextDealerIndex = (round.dealerIndex + 1) % players.length;
  const nextRound = buildRound(players, nextDealerIndex, nextScores, round.handNumber + 1);

  return {
    ...game,
    status: nextRound.status === 'finished' ? 'finished' : 'playing',
    scores: nextRound.scores,
    winner: nextRound.winner || null,
    round: nextRound,
  };
}

export function applyMove(game, playerId, move) {
  if (!game?.round || game.status !== 'playing') throw new Error('Game is not active.');
  const round = structuredClone(game.round);
  round.board = Array.isArray(round.board) ? round.board : [];
  if (round.turnPlayerId !== playerId) throw new Error('Not your turn.');

  const legalMoves = getLegalMoves(round, playerId);
  const selected = legalMoves.find((candidate) =>
    candidate.type === move.type && candidate.playedCardId === move.playedCardId && JSON.stringify(candidate.captureIds || []) === JSON.stringify(move.captureIds || [])
  );
  if (!selected) throw new Error('Illegal move.');

  const hand = round.hands[playerId];
  const playedIndex = hand.findIndex((card) => card.id === selected.playedCardId);
  const playedCard = hand[playedIndex];
  hand.splice(playedIndex, 1);

  const teamId = round.teamsByPlayer[playerId].teamId;
  let pointsEarned = 0;

  if (selected.type === 'trail') {
    round.board.push(playedCard);
    round.lastPlayedCard = { cardId: playedCard.id, rank: playedCard.rank, playerId, turnNumber: round.playsInCurrentDeal + 1, dealNumber: round.activeDeal };
    round.events.unshift(`${game.players[playerId].name} trailed ${summarizeCard(playedCard)}.`);
  } else {
    const captureIds = new Set(selected.captureIds);
    const capturedCards = round.board.filter((card) => captureIds.has(card.id));
    round.board = round.board.filter((card) => !captureIds.has(card.id));
    round.capturePiles[teamId].push(playedCard, ...capturedCards);
    round.capturedCardCount[teamId] += capturedCards.length + 1;

    const isCaida = selected.type === 'match'
      && round.lastPlayedCard
      && selected.targetIds?.[0] === round.lastPlayedCard.cardId
      && round.lastPlayedCard.dealNumber === round.activeDeal
      && round.lastPlayedCard.turnNumber === round.playsInCurrentDeal;
    if (isCaida) pointsEarned += 2;

    const wouldBeLimpia = round.board.length === 0;
    if (wouldBeLimpia && game.scores[teamId] < 38) pointsEarned += 2;

    round.scores[teamId] += pointsEarned;
    round.lastPlayedCard = null;
    round.lastCapture = { playerId, playedCardId: playedCard.id, capturedIds: [...captureIds] };
    round.events.unshift(`${game.players[playerId].name} played ${summarizeCard(playedCard)} for ${selected.type}${pointsEarned ? ` (+${pointsEarned})` : ''}.`);
  }

  round.playsInCurrentDeal += 1;
  const dealFinished = round.turnOrder.every((id) => visibleHandForPlayer(round, id).length === 0);

  if (dealFinished && round.activeDeal === 1) {
    round.activeDeal = 2;
    round.playsInCurrentDeal = 0;
    round.turnPlayerId = round.turnOrder[0];
    round.lastPlayedCard = null;
    const players = game.seating.map((id) => game.players[id]);
    applyDealAnnouncements(round, 2, players);
    if (round.status === 'finished') {
      return { ...game, status: 'finished', scores: round.scores, winner: round.winner, round };
    }
    round.events.unshift('Deal 2 has started.');
    return { ...game, scores: round.scores, round };
  }

  if (dealFinished && round.activeDeal === 2) {
    return finalizeHand({ ...game, scores: round.scores, round });
  }

  round.turnPlayerId = nextTurnPlayer(round);
  return { ...game, scores: round.scores, round };
}

export function teamSummary(game) {
  if (!game?.round) return [];
  const seats = game.seating.map((playerId, index) => ({ playerId, seat: index + 1, player: game.players[playerId] }));
  return TEAM_IDS.map((teamId) => ({
    teamId,
    players: seats.filter((seat) => getTeamIdForSeat(seat.seat) === teamId).map((seat) => seat.player),
    score: game.scores[teamId],
    captured: game.round.capturedCardCount[teamId],
  }));
}
