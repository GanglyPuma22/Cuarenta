import test from 'node:test';
import assert from 'node:assert/strict';

import { analyzeMove, applyMove, configureLobbySeat, getComputerTurnKey, getDealerPlayerId, getDisplayedMoves, getLegalMoves, getLobbySeats, getVisibleHand, isComputerTurnActive, joinLobby, rankValue, selectComputerMove, startMatchFromLobby } from '../src/lib/gameLogic.js';
import { describeRoundTransition, getFeedbackAudioCue, resolveMoveFeedback } from '../src/lib/moveFeedback.js';

function card(rank, suit, id) {
  return { id, rank, suit, value: rankValue(rank) };
}

function buildGame({
  scoreA = 0,
  scoreB = 0,
  activeDeal = 1,
  playsInCurrentDeal = 1,
  board = [],
  hostHand = [],
  lastPlayedCard = null,
} = {}) {
  const seating = ['p1', 'p2', 'p3', 'p4'];
  const players = {
    p1: { id: 'p1', name: 'Ana', isHost: true },
    p2: { id: 'p2', name: 'Beto' },
    p3: { id: 'p3', name: 'Caro' },
    p4: { id: 'p4', name: 'Diego' },
  };

  const filler = {
    p2: [card('Q', '♣', 'f_q')],
    p3: [card('K', '♠', 'f_k')],
    p4: [card('J', '♥', 'f_j')],
  };

  return {
    status: 'playing',
    hostId: 'p1',
    seating,
    players,
    scores: { A: scoreA, B: scoreB },
    round: {
      handNumber: 1,
      dealerIndex: 0,
      turnOrder: seating,
      turnPlayerId: 'p1',
      activeDeal,
      playsInCurrentDeal,
      hands: {
        p1: hostHand,
        p2: filler.p2,
        p3: filler.p3,
        p4: filler.p4,
      },
      board,
      deckRemaining: 10,
      capturePiles: { A: [], B: [] },
      capturedCardCount: { A: 0, B: 0 },
      perDealHands: {
        [activeDeal]: {
          p1: hostHand,
          p2: filler.p2,
          p3: filler.p3,
          p4: filler.p4,
        },
      },
      rondaClaims: [],
      lastPlayedCard,
      lastCapture: null,
      events: [],
      teamsByPlayer: {
        p1: { teamId: 'A', seat: 1 },
        p2: { teamId: 'B', seat: 2 },
        p3: { teamId: 'A', seat: 3 },
        p4: { teamId: 'B', seat: 4 },
      },
      scores: { A: scoreA, B: scoreB },
    },
  };
}

test('getLegalMoves exposes separate match and addition choices and includes full sequence capture', () => {
  const five = card('5', '♠', 'h5');
  const board = [
    card('2', '♣', 'b2'),
    card('3', '♦', 'b3'),
    card('5', '♥', 'b5'),
    card('6', '♠', 'b6'),
    card('7', '♦', 'b7'),
  ];
  const game = buildGame({ board, hostHand: [five] });

  const moves = getLegalMoves(game.round, 'p1');
  const matchMove = moves.find((move) => move.type === 'match');
  const addMove = moves.find((move) => move.type === 'add');

  assert.ok(matchMove, 'expected a match capture');
  assert.ok(addMove, 'expected an addition capture');
  assert.deepEqual(matchMove.captureIds, ['b5', 'b6', 'b7']);
  assert.deepEqual(addMove.captureIds, ['b2', 'b3', 'b6', 'b7']);
});


test('same-rank single-card addition is suppressed so hover targets stay unambiguous', () => {
  const five = card('5', '♠', 'h5');
  const board = [
    card('4', '♣', 'b4'),
    card('5', '♥', 'b5'),
    card('6', '♦', 'b6'),
  ];
  const game = buildGame({ board, hostHand: [five] });

  const moves = getLegalMoves(game.round, 'p1');

  assert.equal(moves.filter((move) => move.type === 'match').length, 1);
  assert.equal(moves.filter((move) => move.type === 'add').length, 0);
});

test('matching the immediately previous card scores caída and never stacks limpia', () => {
  const five = card('5', '♠', 'h5');
  const boardCard = card('5', '♥', 'b5');
  const game = buildGame({
    scoreA: 36,
    board: [boardCard],
    hostHand: [five],
    lastPlayedCard: {
      cardId: 'b5',
      rank: '5',
      playerId: 'p4',
      turnNumber: 1,
      dealNumber: 1,
    },
  });

  const move = getLegalMoves(game.round, 'p1').find((candidate) => candidate.type === 'match');
  const next = applyMove(game, 'p1', move);

  assert.equal(next.scores.A, 38);
  assert.match(next.round.events[0], /Caída.*\(\+2\)/i);
  assert.doesNotMatch(next.round.events[0], /Limpia|\(\+4\)/i);
});

test('first play after a new deal does not count as caída even if the dealer card is matched', () => {
  const five = card('5', '♠', 'h5');
  const boardCard = card('5', '♥', 'b5');
  const game = buildGame({
    scoreA: 20,
    activeDeal: 2,
    playsInCurrentDeal: 0,
    board: [boardCard],
    hostHand: [five],
    lastPlayedCard: {
      cardId: 'b5',
      rank: '5',
      playerId: 'p4',
      turnNumber: 5,
      dealNumber: 1,
    },
  });

  const move = getLegalMoves(game.round, 'p1').find((candidate) => candidate.type === 'match');
  const next = applyMove(game, 'p1', move);

  assert.equal(next.scores.A, 22, 'only limpia should score here');
  assert.doesNotMatch(next.round.events[0], /\(\+4\)|ca[ií]da/i);
});

test('team at 38 does not collect limpia', () => {
  const queen = card('Q', '♠', 'hq');
  const boardCard = card('Q', '♦', 'bq');
  const game = buildGame({
    scoreA: 38,
    board: [boardCard],
    hostHand: [queen],
    lastPlayedCard: null,
  });

  const move = getLegalMoves(game.round, 'p1').find((candidate) => candidate.type === 'match');
  const next = applyMove(game, 'p1', move);

  assert.equal(next.scores.A, 38);
  assert.doesNotMatch(next.round.events[0], /\(\+2\)|limpia/i);
});

test('opening dealer is randomized among seated players', () => {
  const seen = new Set();
  const game = {
    seating: ['p1', 'p2', 'p3', 'p4'],
    players: {
      p1: { id: 'p1', name: 'Ana', isHost: true },
      p2: { id: 'p2', name: 'Beto' },
      p3: { id: 'p3', name: 'Caro' },
      p4: { id: 'p4', name: 'Diego' },
    },
    hostId: 'p1',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    lastActivityAt: Date.now(),
    status: 'lobby',
    scores: { A: 0, B: 0 },
    lobbyMessage: 'Waiting for players',
  };

  for (let index = 0; index < 40; index += 1) {
    const started = startMatchFromLobby(game);
    seen.add(started.round.dealerIndex);
    assert.equal(started.round.dealerPlayerId, game.seating[started.round.dealerIndex]);
    assert.equal(getDealerPlayerId(started.round, game.seating), started.round.dealerPlayerId);
  }

  assert.ok(seen.size > 1, 'dealer index should not always be fixed');
  assert.ok([...seen].every((value) => value >= 0 && value < 4));
});

test('starting a partial lobby fills the remaining seats with computer players', () => {
  const game = {
    seating: ['p1', 'p2'],
    players: {
      p1: { id: 'p1', name: 'Ana', isHost: true },
      p2: { id: 'p2', name: 'Beto', isHost: false },
    },
    hostId: 'p1',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    lastActivityAt: Date.now(),
    status: 'lobby',
    scores: { A: 0, B: 0 },
    lobbyMessage: 'Waiting for players',
  };

  const started = startMatchFromLobby(game);
  const computerIds = started.seating.filter((id) => started.players[id].isComputer);

  assert.equal(started.seating.length, 4);
  assert.deepEqual(computerIds, ['computer_1', 'computer_2']);
  assert.deepEqual(computerIds.map((id) => started.players[id].name), ['Computer 1', 'Computer 2']);
});

test('legacy lobbies derive fixed positions and newcomers take the next open position', () => {
  const lobby = lobbyOf(['p1', 'p2']);
  const seats = getLobbySeats(lobby);

  assert.deepEqual(seats, {
    1: { kind: 'player', playerId: 'p1' },
    2: { kind: 'player', playerId: 'p2' },
    3: { kind: 'open' },
    4: { kind: 'open' },
  });

  const joined = joinLobby(lobby, { id: 'p3', name: 'Caro' });
  assert.deepEqual(joined.seating, ['p1', 'p2', 'p3']);
  assert.equal(joined.lobbySeats[3].playerId, 'p3');
});

test('only the host can swap lobby players between team positions', () => {
  const lobby = lobbyOf(['p1', 'p2', 'p3']);

  assert.throws(
    () => configureLobbySeat(lobby, 'p2', 2, { kind: 'player', playerId: 'p3' }),
    /Only host/i
  );

  const moved = configureLobbySeat(lobby, 'p1', 2, { kind: 'player', playerId: 'p3' });
  assert.deepEqual(moved.seating, ['p1', 'p3', 'p2']);
  assert.equal(moved.lobbySeats[2].playerId, 'p3');
  assert.equal(moved.lobbySeats[3].playerId, 'p2');
});

test('host can reserve an open position for a computer and start keeps that team position', () => {
  const lobby = lobbyOf(['p1', 'p2']);
  const configured = configureLobbySeat(lobby, 'p1', 3, { kind: 'computer' });
  const started = startMatchFromLobby(configured);

  assert.equal(started.players[started.seating[2]].isComputer, true);
  assert.equal(started.round.teamsByPlayer[started.seating[2]].teamId, 'A');
  assert.equal(started.players[started.seating[3]].isComputer, true, 'unreserved open seats still auto-fill');
});

test('computer move selection prefers points, then captures, then a stable move key', () => {
  const scoreGame = buildGame({
    scoreA: 36,
    board: [card('5', '♥', 'b5')],
    hostHand: [card('5', '♠', 'h5'), card('Q', '♠', 'hq')],
    lastPlayedCard: { cardId: 'b5', rank: '5', playerId: 'p4', turnNumber: 1, dealNumber: 1 },
  });
  assert.equal(selectComputerMove(scoreGame, 'p1').playedCardId, 'h5');

  const captureGame = buildGame({
    board: [card('2', '♣', 'b2'), card('3', '♦', 'b3'), card('5', '♥', 'b5'), card('6', '♠', 'b6'), card('7', '♦', 'b7')],
    hostHand: [card('5', '♠', 'h5')],
  });
  assert.equal(selectComputerMove(captureGame, 'p1').type, 'add');

  const tieGame = buildGame({
    board: [],
    hostHand: [card('7', '♠', 'h7'), card('5', '♠', 'h5')],
  });
  assert.equal(selectComputerMove(tieGame, 'p1').playedCardId, 'h5');
});

test('computer turns are inactive after a game finishes', () => {
  const activeGame = buildGame({ hostHand: [card('5', '♠', 'h5')] });
  activeGame.players.p1.isComputer = true;

  assert.equal(isComputerTurnActive(activeGame), true);
  assert.equal(isComputerTurnActive({
    ...activeGame,
    status: 'finished',
    round: { ...activeGame.round, status: 'finished' },
  }), false);
});


function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

// The next hand is shuffled, and a freak four-of-a-kind deal would end the match
// on its own. Seeding keeps these assertions about the transition itself.
function withSeededRandom(seed, run) {
  const original = Math.random;
  Math.random = seededRandom(seed);
  try {
    return run();
  } finally {
    Math.random = original;
  }
}

// Deal 2 with only the host still holding a card, so the next play closes the hand.
function buildFinalPlayOfHand({ scoreA = 0, scoreB = 0, capturedA = 0, capturedB = 0, handNumber = 1 } = {}) {
  const game = buildGame({
    scoreA,
    scoreB,
    activeDeal: 2,
    playsInCurrentDeal: 19,
    board: [],
    hostHand: [card('K', '♠', 'hk')],
  });

  for (const playerId of ['p2', 'p3', 'p4']) {
    game.round.hands[playerId] = [];
    game.round.perDealHands[2][playerId] = [];
  }

  game.round.handNumber = handNumber;
  game.round.capturedCardCount = { A: capturedA, B: capturedB };
  return game;
}

function closeHand(game, seed = 7) {
  const move = getLegalMoves(game.round, 'p1').find((candidate) => candidate.type === 'trail');
  assert.ok(move, 'the fixture must leave the host one playable card');
  return withSeededRandom(seed, () => applyMove(game, 'p1', move));
}

test('a hand scored under forty continues straight into the next hand', () => {
  const next = closeHand(buildFinalPlayOfHand({ capturedA: 22, capturedB: 18 }));

  assert.equal(next.status, 'playing');
  assert.equal(next.winner, null);
  assert.ok(next.scores.A >= 8, 'the card majority is scored before the continuation decision');
  assert.equal(next.round.handNumber, 2);
  assert.equal(next.round.activeDeal, 1);
  assert.equal(next.round.playsInCurrentDeal, 0);
  assert.equal(next.round.dealerIndex, 1, 'the deal passes to the next seat');
  assert.ok(next.seating.includes(next.round.turnPlayerId));
  assert.ok(
    getLegalMoves(next.round, next.round.turnPlayerId).length > 0,
    'the new hand opens on a playable turn'
  );
  assert.ok(
    next.round.events.some((event) => event.startsWith('Hand 2 started')),
    'the new hand announces itself'
  );
  assert.ok(
    next.round.events.includes('Hand 1 scored: Team A +8, Team B +0.'),
    'the finished hand carries its scoring line into the new hand'
  );
});

test('hands keep continuing because there is no hand limit', () => {
  const next = closeHand(
    buildFinalPlayOfHand({ handNumber: 12, scoreA: 10, scoreB: 12, capturedA: 21, capturedB: 19 }),
    23
  );

  assert.equal(next.status, 'playing');
  assert.equal(next.round.handNumber, 13);
  assert.ok(next.scores.A >= 18);
});

test('the computer turn key is scoped to the hand, the deal, and the active player', () => {
  const game = buildGame({ hostHand: [card('5', '♠', 'h5')] });
  game.players.p1.isComputer = true;
  game.players.p2.isComputer = true;

  const key = getComputerTurnKey(game);
  assert.ok(key, 'an active computer turn has a scheduling key');
  assert.equal(getComputerTurnKey(game), key, 'the same state keeps the same key');

  assert.notEqual(
    getComputerTurnKey({ ...game, round: { ...game.round, handNumber: 2 } }),
    key,
    'a new hand is a new scheduling identity'
  );
  assert.notEqual(
    getComputerTurnKey({ ...game, round: { ...game.round, activeDeal: 2 } }),
    key,
    'a new deal is a new scheduling identity'
  );
  assert.notEqual(
    getComputerTurnKey({ ...game, round: { ...game.round, turnPlayerId: 'p2' } }),
    key,
    'a different computer is a new scheduling identity'
  );

  assert.equal(getComputerTurnKey(null), null);
  assert.equal(
    getComputerTurnKey({ ...game, round: { ...game.round, turnPlayerId: 'p3' } }),
    null,
    'a human turn schedules nothing'
  );
  assert.equal(
    getComputerTurnKey({ ...game, status: 'finished', round: { ...game.round, status: 'finished' } }),
    null,
    'a finished game schedules nothing'
  );
});

test('a computer that played the last card of a hand is rescheduled for the new one', () => {
  const game = buildFinalPlayOfHand({ capturedA: 22, capturedB: 18 });
  game.players.p1.isComputer = true;

  const finishedHandKey = getComputerTurnKey(game);
  const next = closeHand(game);
  // The same computer draws the opening turn of the new hand.
  const opensNextHand = { ...next, round: { ...next.round, turnPlayerId: 'p1' } };

  assert.ok(finishedHandKey);
  assert.equal(next.round.handNumber, 2);
  assert.notEqual(
    getComputerTurnKey(opensNextHand),
    finishedHandKey,
    'an unchanged player id must not reuse the finished hand key'
  );
});

// Deal 2 with only the host still holding a card and the caída target face up,
// so the closing play scores a caída and then finalizes the hand.
function buildFinalCaidaOfHand({ scoreA = 0, scoreB = 0, capturedA = 0, capturedB = 0 } = {}) {
  const game = buildGame({
    scoreA,
    scoreB,
    activeDeal: 2,
    playsInCurrentDeal: 19,
    board: [card('K', '♦', 'bk_last')],
    hostHand: [card('K', '♠', 'hk')],
    lastPlayedCard: {
      cardId: 'bk_last',
      rank: 'K',
      playerId: 'p4',
      turnNumber: 19,
      dealNumber: 2,
    },
  });

  for (const playerId of ['p2', 'p3', 'p4']) {
    game.round.hands[playerId] = [];
    game.round.perDealHands[2][playerId] = [];
  }

  game.round.capturedCardCount = { A: capturedA, B: capturedB };
  return game;
}

function closeHandWithCaida(game, seed = 7) {
  const move = getLegalMoves(game.round, 'p1').find((candidate) => candidate.type === 'match');
  assert.ok(move, 'the fixture must leave the host the caída answer card');
  return withSeededRandom(seed, () => applyMove(game, 'p1', move));
}

test('a team already on thirty collects nothing from the card count', () => {
  const next = closeHand(buildFinalPlayOfHand({ scoreA: 32, capturedA: 30, capturedB: 10 }));

  assert.equal(next.scores.A, 32, 'a capped team keeps the score it walked in with');
  assert.equal(next.status, 'playing', 'the card count cannot carry a capped team to forty');
  assert.equal(next.winner, null);
  assert.equal(next.round.handNumber, 2, 'the match continues into the next hand');
  assert.ok(
    next.round.events.includes('Hand 1 scored: Team A +0, Team B +0.'),
    'the score line reports what was actually awarded'
  );
});

test('a team under thirty still collects the card count in full', () => {
  const next = closeHand(buildFinalPlayOfHand({ scoreA: 14, capturedA: 22, capturedB: 18 }));

  assert.equal(next.scores.A, 22, '6 for the count plus 2 for the pair over nineteen');
  assert.equal(next.scores.B, 0);
  assert.ok(next.round.events.includes('Hand 1 scored: Team A +8, Team B +0.'));
});

test('the card count pays only up to thirty', () => {
  const next = closeHand(buildFinalPlayOfHand({ scoreA: 28, capturedA: 26, capturedB: 14 }));

  assert.equal(next.scores.A, 30, 'twelve card points are trimmed to the two that fit under the cap');
  assert.equal(next.status, 'playing');
  assert.ok(next.round.events.includes('Hand 1 scored: Team A +2, Team B +0.'));
});

test('the thirty cap applies per team', () => {
  const next = closeHand(buildFinalPlayOfHand({ scoreA: 31, scoreB: 20, capturedA: 10, capturedB: 30 }));

  assert.equal(next.scores.A, 31, 'the capped team is untouched');
  assert.equal(next.scores.B, 30, 'the other team still collects, up to its own cap');
  assert.ok(next.round.events.includes('Hand 1 scored: Team A +0, Team B +10.'));
});

test('limpia still pays after thirty', () => {
  const queen = card('Q', '♠', 'hq');
  const game = buildGame({
    scoreA: 30,
    board: [card('Q', '♦', 'bq')],
    hostHand: [queen],
    lastPlayedCard: null,
  });

  const move = getLegalMoves(game.round, 'p1').find((candidate) => candidate.type === 'match');
  const next = applyMove(game, 'p1', move);

  assert.equal(next.scores.A, 32, 'clearing the felt is worth +2 regardless of the card-count cap');
  assert.match(next.round.events[0], /limpia.*\(\+2\)/i);
});

test('a caída that reaches forty ends the match without dealing another hand', () => {
  const next = closeHandWithCaida(buildFinalCaidaOfHand({ scoreA: 38, capturedA: 22, capturedB: 16 }));

  assert.equal(next.status, 'finished');
  assert.equal(next.winner, 'A');
  assert.equal(next.scores.A, 40, 'the last two points come from the caída, not from the count');
  assert.equal(next.round.status, 'finished');
  assert.equal(next.round.handNumber, 1, 'the winning hand stays the last one dealt');
  assert.ok(next.finishedAt);
  assert.equal(next.round.events[0], 'Hand 1 scored: Team A +0, Team B +0.');
});

test('a caída crosses thirty without the card count topping it up', () => {
  const next = closeHandWithCaida(buildFinalCaidaOfHand({ scoreA: 30, capturedA: 22, capturedB: 16 }));

  assert.equal(next.scores.A, 32, 'the bonus lands even though the count is capped out');
  assert.equal(next.status, 'playing', 'thirty-two is still short of forty');
  assert.ok(next.round.events.includes('Hand 1 scored: Team A +0, Team B +0.'));
});


function buildCaidaBoardGame() {
  const five = card('5', '♠', 'h5');
  const board = [
    card('2', '♣', 'b2'),
    card('3', '♦', 'b3'),
    card('5', '♥', 'b5_last'),
    card('5', '♦', 'b5_other'),
    card('6', '♠', 'b6'),
    card('7', '♦', 'b7'),
  ];

  return buildGame({
    board,
    hostHand: [five],
    lastPlayedCard: {
      cardId: 'b5_last',
      rank: '5',
      playerId: 'p4',
      turnNumber: 1,
      dealNumber: 1,
    },
  });
}

test('caída display actions drop the ambiguous match and the trail for that card', () => {
  const game = buildCaidaBoardGame();

  const legalMoves = getLegalMoves(game.round, 'p1');
  const displayed = getDisplayedMoves(game, 'p1', legalMoves);

  assert.equal(legalMoves.filter((move) => move.type === 'match').length, 2, 'engine still offers both same-rank matches');
  assert.ok(legalMoves.some((move) => move.type === 'trail'), 'engine still offers the trail');

  const caida = displayed.filter((action) => action.analysis.isCaida);
  assert.equal(caida.length, 1, 'exactly one caída action is displayed');
  assert.deepEqual(caida[0].move.captureIds, ['b5_last', 'b6', 'b7'], 'the caída keeps its full upward sequence');

  assert.equal(
    displayed.filter((action) => action.move.type === 'match' && !action.analysis.isCaida).length,
    0,
    'the ambiguous same-rank match is hidden while a caída is live'
  );
  assert.equal(
    displayed.filter((action) => action.move.type === 'trail' && action.move.playedCardId === 'h5').length,
    0,
    'the trail for that card is hidden while a caída is live'
  );

  const additions = displayed.filter((action) => action.move.type === 'add');
  assert.equal(additions.length, 1, 'the non-matching addition capture stays available');
  assert.deepEqual(additions[0].move.captureIds, ['b2', 'b3', 'b6', 'b7']);
});

test('caída display ordering leads with the labelled sweep and keeps the trail last', () => {
  const displayed = getDisplayedMoves(buildCaidaBoardGame(), 'p1');

  assert.equal(displayed[0].label, 'CAÍDA +2', 'the caída is announced with its bonus');
  assert.equal(displayed[0].emphasis, 'caida');
  assert.equal(displayed[0].captureCount, 3, 'the caída takes the target plus its run');
  assert.equal(displayed[0].sequenceCount, 2, 'two sequence cards ride along');
  assert.equal(displayed[0].key, 'match:h5:b5_last,b6,b7');
  assert.equal(displayed[1].label, null, 'ordinary alternatives stay unlabelled');

  const plain = buildGame({
    board: [
      card('2', '♣', 'b2'),
      card('3', '♦', 'b3'),
      card('5', '♥', 'b5'),
      card('6', '♠', 'b6'),
      card('7', '♦', 'b7'),
    ],
    hostHand: [card('5', '♠', 'h5')],
  });
  const plainDisplayed = getDisplayedMoves(plain, 'p1');

  assert.deepEqual(
    plainDisplayed.map((action) => action.move.type),
    ['add', 'match', 'trail'],
    'without a caída the widest capture leads and the trail is last'
  );
  assert.deepEqual(plainDisplayed.map((action) => action.captureCount), [4, 3, 0]);

  const clearing = buildGame({
    scoreA: 36,
    board: [card('5', '♥', 'b5')],
    hostHand: [card('5', '♠', 'h5')],
    lastPlayedCard: { cardId: 'b5', rank: '5', playerId: 'p4', turnNumber: 1, dealNumber: 1 },
  });

  assert.equal(
    getDisplayedMoves(clearing, 'p1')[0].label,
    'CAÍDA +2',
    'a caída that also clears the board is still announced as a plain +2 caída'
  );
  assert.equal(getDisplayedMoves(clearing, 'p1')[0].emphasis, 'caida');
});

test('analyzeMove stays aligned with applied scoring bonuses', () => {
  const five = card('5', '♠', 'h5');
  const boardCard = card('5', '♥', 'b5');
  const game = buildGame({
    scoreA: 36,
    board: [boardCard],
    hostHand: [five],
    lastPlayedCard: {
      cardId: 'b5',
      rank: '5',
      playerId: 'p4',
      turnNumber: 1,
      dealNumber: 1,
    },
  });

  const move = getLegalMoves(game.round, 'p1').find((candidate) => candidate.type === 'match');
  const analysis = analyzeMove(game, 'p1', move);
  const next = applyMove(game, 'p1', move);

  assert.equal(analysis.bonusPoints, next.scores.A - game.scores.A);
  assert.equal(analysis.bonusPoints, 2);
  assert.equal(analysis.isCaida, true);
  assert.equal(analysis.isLimpia, false, 'caída takes precedence, so the clear does not also score limpia');
});

function outcome(overrides = {}) {
  return {
    move: { type: 'match' },
    captureCount: 1,
    sequenceCount: 0,
    isCaida: false,
    isLimpia: false,
    bonusPoints: 0,
    ...overrides,
  };
}

test('resolved move feedback maps an analysed outcome to an animation kind', () => {
  assert.equal(resolveMoveFeedback(null), null);
  assert.equal(resolveMoveFeedback(outcome({ move: null })), null);

  assert.equal(resolveMoveFeedback(outcome({ move: { type: 'trail' }, captureCount: 0 })).kind, 'trail');
  assert.equal(resolveMoveFeedback(outcome()).kind, 'capture');
  assert.equal(resolveMoveFeedback(outcome({ captureCount: 3, sequenceCount: 2 })).kind, 'sequence');
  assert.equal(resolveMoveFeedback(outcome({ isCaida: true, bonusPoints: 2 })).kind, 'caida');
  assert.equal(resolveMoveFeedback(outcome({ isLimpia: true, bonusPoints: 2 })).kind, 'limpia');

  // analyzeMove can no longer report both, but the presentation layer stays
  // defensive: if a stale payload ever claims both, caída wins outright.
  const feedback = resolveMoveFeedback(outcome({
    isCaida: true, isLimpia: true, bonusPoints: 2,
  }));
  assert.equal(feedback.kind, 'caida');
  assert.equal(feedback.title, 'CAÍDA');
  assert.equal(feedback.points, 2);
  assert.equal(feedback.isSpecial, true);
  assert.equal(resolveMoveFeedback(outcome({ captureCount: 3, sequenceCount: 2 })).isSpecial, false);
});

test('resolved move feedback reads a committed round transition', () => {
  const previous = buildCaidaBoardGame();
  const caidaMove = getDisplayedMoves(previous, 'p1')[0].move;
  const next = applyMove(previous, 'p1', caidaMove);
  const transition = describeRoundTransition(previous, next);

  assert.equal(transition.playerId, 'p1');
  assert.equal(transition.teamId, 'A');
  assert.equal(transition.playedCard.id, 'h5');
  assert.deepEqual(transition.capturedCards.map((entry) => entry.id), ['b5_last', 'b6', 'b7']);
  assert.equal(transition.outcome.isCaida, true);
  assert.equal(transition.outcome.isLimpia, false);
  assert.equal(transition.outcome.captureCount, 3);
  assert.equal(transition.outcome.sequenceCount, 2);
  assert.equal(resolveMoveFeedback(transition.outcome).kind, 'caida');

  const clearingPrevious = buildGame({
    scoreA: 36,
    board: [card('5', '♥', 'b5')],
    hostHand: [card('5', '♠', 'h5')],
    lastPlayedCard: { cardId: 'b5', rank: '5', playerId: 'p4', turnNumber: 1, dealNumber: 1 },
  });
  const clearingMove = getDisplayedMoves(clearingPrevious, 'p1')[0].move;
  const clearing = describeRoundTransition(clearingPrevious, applyMove(clearingPrevious, 'p1', clearingMove));
  assert.equal(resolveMoveFeedback(clearing.outcome).kind, 'caida');
  assert.equal(clearing.outcome.isCaida, true);
  assert.equal(clearing.outcome.isLimpia, false);
  assert.equal(clearing.outcome.bonusPoints, 2);
});

test('resolved move feedback covers trails and gives up on unusable transitions', () => {
  const previous = buildGame({ board: [], hostHand: [card('K', '♠', 'hk')] });
  const trailMove = getLegalMoves(previous.round, 'p1').find((move) => move.type === 'trail');
  const transition = describeRoundTransition(previous, applyMove(previous, 'p1', trailMove));

  assert.equal(transition.playedCard.id, 'hk');
  assert.deepEqual(transition.capturedCards, []);
  assert.equal(resolveMoveFeedback(transition.outcome).kind, 'trail');

  assert.equal(describeRoundTransition(previous, previous), null, 'an unchanged state animates nothing');
  assert.equal(describeRoundTransition(null, previous), null);
  assert.equal(
    describeRoundTransition(previous, { ...previous, round: { ...previous.round, handNumber: 2 } }),
    null,
    'a freshly dealt hand renders immediately instead of animating'
  );
});

test('resolved move feedback audio cues only fire for caída and limpia', () => {
  assert.equal(getFeedbackAudioCue(null), null);
  assert.equal(getFeedbackAudioCue('trail'), null, 'trails stay visual only');
  assert.equal(getFeedbackAudioCue('capture'), null, 'ordinary captures stay visual only');
  assert.equal(getFeedbackAudioCue('sequence'), null, 'sequence runs stay visual only');

  const caida = getFeedbackAudioCue('caida');
  assert.equal(caida.id, 'caida');
  assert.ok(caida.tones.length >= 2, 'the caída cue is a short motif, not a single beep');
  assert.ok(caida.tones.every((tone) => tone.frequency > 0 && tone.duration > 0));
  assert.ok(caida.gain > 0 && caida.gain <= 1);

  const limpia = getFeedbackAudioCue('limpia');
  assert.equal(limpia.id, 'limpia');
  assert.ok(limpia.tones.length >= 2, 'the limpia cue is a short motif too');
  assert.equal(
    getFeedbackAudioCue('caida-limpia'),
    null,
    'there is no stacked caída-limpia cue to fire'
  );
});


// Firebase Realtime Database stores no empty arrays. A round read back from a
// snapshot is therefore missing every collection that was empty when it was
// written, which is what deletes a player's hand entry the moment they run out
// of cards. The engine has to read those gaps as empty hands.
test('a hand entry pruned by Firebase reads as an empty hand instead of throwing', () => {
  const game = buildGame({
    activeDeal: 2,
    playsInCurrentDeal: 17,
    board: [card('3', '\u2666', 'b3')],
    hostHand: [card('K', '\u2660', 'hk')],
  });

  // Beto emptied his deal-two hand, so the snapshot carries no `hands.p2` key.
  delete game.round.hands.p2;
  // Caro is the mirror case: the per-deal entry is the one that went missing.
  delete game.round.perDealHands[2].p3;

  assert.deepEqual(getVisibleHand(game.round, 'p2'), [], 'a missing ownership list is an empty hand');
  assert.deepEqual(getVisibleHand(game.round, 'p3'), [], 'a missing per-deal list is an empty hand');

  const moves = getLegalMoves(game.round, 'p1');
  assert.ok(moves.length > 0, 'the active player still has legal moves');

  const next = applyMove(game, 'p1', moves.find((move) => move.type === 'trail'));

  assert.equal(next.round.turnPlayerId, 'p2', 'the deal-completion check clears the pruned seats');
  assert.deepEqual(next.round.hands.p2, [], 'the pruned ownership entry is restored as an empty hand');
  assert.deepEqual(next.round.perDealHands[2].p3, [], 'the pruned per-deal entry is restored as an empty hand');
  assert.deepEqual(next.round.hands.p1.map((held) => held.id), [], 'the played card leaves the active hand');
  assert.deepEqual(next.round.board.map((held) => held.id), ['b3', 'hk'], 'the trail still lands on the board');
});


// A round that has not scored a ronda yet is written with `rondaClaims: []`, so
// the snapshot comes back with no `rondaClaims` key. The deal-two announcement
// runs on exactly that state, right after the last deal-one card is played.
function buildPrunedRondaClaimsGame() {
  const game = buildGame({
    activeDeal: 1,
    playsInCurrentDeal: 19,
    board: [],
    hostHand: [card('K', '\u2660', 'hk')],
  });

  const dealTwo = {
    p1: [card('2', '\u2660', 'd2_p1a'), card('3', '\u2660', 'd2_p1b'), card('4', '\u2660', 'd2_p1c'), card('5', '\u2660', 'd2_p1d'), card('6', '\u2660', 'd2_p1e')],
    // Beto is dealt three sevens: a ronda for team B, not four of a kind.
    p2: [card('7', '\u2660', 'd2_p2a'), card('7', '\u2665', 'd2_p2b'), card('7', '\u2666', 'd2_p2c'), card('2', '\u2665', 'd2_p2d'), card('3', '\u2665', 'd2_p2e')],
    p3: [card('A', '\u2663', 'd2_p3a'), card('2', '\u2663', 'd2_p3b'), card('3', '\u2663', 'd2_p3c'), card('4', '\u2663', 'd2_p3d'), card('5', '\u2663', 'd2_p3e')],
    p4: [card('6', '\u2665', 'd2_p4a'), card('J', '\u2660', 'd2_p4b'), card('Q', '\u2665', 'd2_p4c'), card('K', '\u2666', 'd2_p4d'), card('A', '\u2666', 'd2_p4e')],
  };

  // Everyone but the host has played out deal one; their deal-one cards are gone
  // from `hands` but the deal-two cards they still hold are not.
  game.round.hands = {
    p1: [card('K', '\u2660', 'hk'), ...dealTwo.p1],
    p2: [...dealTwo.p2],
    p3: [...dealTwo.p3],
    p4: [...dealTwo.p4],
  };
  game.round.perDealHands = {
    1: game.round.perDealHands[1],
    2: dealTwo,
  };
  return game;
}

test('the deal-two announcement records a ronda even when Firebase pruned the empty claims list', () => {
  const game = buildPrunedRondaClaimsGame();
  delete game.round.rondaClaims;

  assert.deepEqual(getVisibleHand(game.round, 'p2'), [], 'deal one is played out for the other seats');

  const trail = getLegalMoves(game.round, 'p1').find((move) => move.type === 'trail');
  const next = applyMove(game, 'p1', trail);

  assert.equal(next.round.activeDeal, 2, 'the last deal-one card opens deal two');
  assert.equal(next.status, 'playing', 'a ronda is not a four-of-a-kind win');
  assert.deepEqual(next.round.rondaClaims, [
    { playerId: 'p2', teamId: 'B', dealNumber: 2, ranks: ['7'] },
  ], 'the claim is appended to a rebuilt list');
  assert.equal(next.scores.B, 4, 'the ronda still scores its four points');
  assert.equal(next.scores.A, 0);
  assert.ok(next.round.events.some((event) => /announced ronda/.test(event)));
});

test('a pruned claims list does not invent a ronda that the deal did not contain', () => {
  const game = buildPrunedRondaClaimsGame();
  // Break up Beto's three sevens so no seat qualifies.
  game.round.hands.p2[2] = card('J', '\u2666', 'd2_p2c');
  game.round.perDealHands[2].p2 = game.round.hands.p2;
  delete game.round.rondaClaims;

  const trail = getLegalMoves(game.round, 'p1').find((move) => move.type === 'trail');
  const next = applyMove(game, 'p1', trail);

  assert.equal(next.round.activeDeal, 2);
  assert.deepEqual(next.round.rondaClaims, [], 'the rebuilt list stays empty');
  assert.equal(next.scores.A, 0);
  assert.equal(next.scores.B, 0);
});


// Test-only stand-in for the Realtime Database transport. Firebase drops nulls
// and stores nothing for an empty array or object, and a parent whose children
// all vanish disappears with them. Running committed state through this after
// every move reproduces what a client actually reads back mid-match.
function pruneLikeFirebase(value) {
  if (Array.isArray(value)) {
    const items = value.map(pruneLikeFirebase).filter((item) => item !== undefined);
    return items.length ? items : undefined;
  }
  if (value && typeof value === 'object') {
    const kept = {};
    for (const [key, entry] of Object.entries(value)) {
      const pruned = pruneLikeFirebase(entry);
      if (pruned !== undefined) kept[key] = pruned;
    }
    return Object.keys(kept).length ? kept : undefined;
  }
  return value === null || value === undefined ? undefined : value;
}

function roundTripThroughFirebase(game) {
  const stored = pruneLikeFirebase(game);
  assert.ok(stored, 'a committed game is never pruned away entirely');
  return stored;
}

function lobbyOf(playerIds) {
  const names = { p1: 'Ana', p2: 'Beto', p3: 'Caro', p4: 'Diego' };
  const now = 1755561600000;
  return {
    code: 'TESTNG',
    status: 'lobby',
    hostId: playerIds[0],
    createdAt: now,
    updatedAt: now,
    lastActivityAt: now,
    startedAt: null,
    finishedAt: null,
    players: Object.fromEntries(playerIds.map((id, index) => [id, {
      id,
      name: names[id],
      joinedAt: now,
      lastSeenAt: now,
      reconnectCount: 0,
      isHost: index === 0,
    }])),
    seating: [...playerIds],
    scores: { A: 0, B: 0 },
    lobbyMessage: 'Waiting for players',
  };
}

// Deterministic human: rotate through the moves the UI would actually offer, so
// the simulation drives `getDisplayedMoves` over pruned state as well.
function chooseHumanMove(game, playerId, moveNumber) {
  const displayed = getDisplayedMoves(game, playerId).map((action) => action.move);
  const options = displayed.length ? displayed : getLegalMoves(game.round, playerId);
  return options[moveNumber % options.length] || null;
}

// A deal is 20 cards and every move plays exactly one, so a hand is 40 moves.
// Scores never fall, and once both teams are capped out of the card count the
// last ten points still arrive through the caída and limpia that ordinary play
// keeps producing. The bound is 60 hands, far past what the seeded matches below
// actually take: tripping it is a real non-termination failure, not a silently
// truncated match.
const MAX_MOVES_PER_MATCH = 2400;

function playPrunedMatch({ humanIds, seed }) {
  return withSeededRandom(seed, () => {
    let game = roundTripThroughFirebase(startMatchFromLobby(lobbyOf(humanIds)));
    const humans = new Set(humanIds);
    let moveNumber = 0;
    let computerMoves = 0;
    let hands = game.round.handNumber;

    while (game.status === 'playing') {
      assert.ok(
        moveNumber < MAX_MOVES_PER_MATCH,
        `match did not terminate within ${MAX_MOVES_PER_MATCH} moves (seed ${seed})`
      );

      const playerId = game.round.turnPlayerId;
      assert.ok(playerId, 'a playing game always has a seat on turn');

      let move;
      if (humans.has(playerId)) {
        move = chooseHumanMove(game, playerId, moveNumber);
      } else {
        move = selectComputerMove(game, playerId);
        computerMoves += 1;
      }
      assert.ok(move, `no legal move for ${playerId} at move ${moveNumber} (seed ${seed})`);

      game = roundTripThroughFirebase(applyMove(game, playerId, move));
      moveNumber += 1;
      hands = Math.max(hands, game.round.handNumber);
    }

    return { game, moveNumber, computerMoves, hands };
  });
}

function assertCompletedMatch(result, seed) {
  const { game } = result;
  assert.equal(game.status, 'finished', `match should finish (seed ${seed})`);
  assert.ok(['A', 'B'].includes(game.winner), `a finished match names a winner (seed ${seed})`);
  assert.ok(
    game.scores[game.winner] >= 40,
    `the winner reaches forty (seed ${seed}, scores ${JSON.stringify(game.scores)})`
  );
  assert.ok(game.finishedAt, 'a finished match is stamped');
  assert.ok(result.moveNumber > 0, 'the match actually played moves');
}

const FOUR_HUMAN_SEEDS = [11, 2027, 90210];

test('four human players complete a match to forty while Firebase prunes empty collections', () => {
  const played = FOUR_HUMAN_SEEDS.map((seed) => {
    const result = playPrunedMatch({ humanIds: ['p1', 'p2', 'p3', 'p4'], seed });
    assertCompletedMatch(result, seed);
    assert.equal(result.computerMoves, 0, 'an all-human table never consults the bot');
    return result;
  });

  assert.equal(played.length, FOUR_HUMAN_SEEDS.length, 'every seeded match ran');
  assert.ok(
    played.some((result) => result.hands > 1),
    'at least one match ran past the opening hand, so the deal boundary was crossed under pruning'
  );
  assert.ok(
    played.every((result) => result.moveNumber < MAX_MOVES_PER_MATCH),
    'termination is proven by the run, not by the bound'
  );
});

const MIXED_SEEDS = [5, 1312, 777];

test('a mixed human and computer table completes a match to forty under the same pruning', () => {
  const played = MIXED_SEEDS.map((seed) => {
    // Two humans in the lobby; `startMatchFromLobby` seats computer_1 and
    // computer_2, which puts one bot on each team.
    const result = playPrunedMatch({ humanIds: ['p1', 'p2'], seed });
    assertCompletedMatch(result, seed);

    const computerIds = result.game.seating.filter((id) => result.game.players[id].isComputer);
    assert.deepEqual(computerIds, ['computer_1', 'computer_2'], 'the empty seats were filled by bots');
    assert.ok(result.computerMoves > 0, `selectComputerMove drove real turns (seed ${seed})`);
    return result;
  });

  assert.equal(played.length, MIXED_SEEDS.length, 'every seeded mixed match ran');
  assert.ok(
    played.reduce((total, result) => total + result.computerMoves, 0) > 100,
    'the bot decision path carried a substantial share of the play'
  );
  assert.ok(
    played.every((result) => result.moveNumber < MAX_MOVES_PER_MATCH),
    'termination is proven by the run, not by the bound'
  );
});

test('the transport simulator really does delete the collections the engine reads', () => {
  // Seed 29 deals no opening ronda, so `rondaClaims` is genuinely empty here.
  const seeded = withSeededRandom(29, () => startMatchFromLobby(lobbyOf(['p1', 'p2', 'p3', 'p4'])));
  const stored = roundTripThroughFirebase(seeded);

  assert.equal(stored.round.board, undefined, 'an empty board is not stored');
  assert.equal(stored.round.capturePiles, undefined, 'two empty capture piles remove their parent');
  assert.equal(stored.round.lastPlayedCard, undefined, 'nulls are dropped');
  assert.equal(stored.round.rondaClaims, undefined, 'an empty claims list is not stored');
  assert.deepEqual(stored.scores, { A: 0, B: 0 }, 'zeroes survive; only empties are pruned');
  assert.equal(Object.keys(stored.round.hands).length, 4, 'full hands are still stored');

  const emptied = roundTripThroughFirebase({
    ...stored,
    round: { ...stored.round, hands: { ...stored.round.hands, p2: [] } },
  });
  assert.equal(emptied.round.hands.p2, undefined, 'an emptied hand entry disappears');
  assert.deepEqual(getVisibleHand(emptied.round, 'p2'), [], 'and the engine reads it as an empty hand');
});
