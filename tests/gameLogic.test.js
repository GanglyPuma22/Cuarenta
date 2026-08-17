import test from 'node:test';
import assert from 'node:assert/strict';

import { analyzeMove, applyMove, getDealerPlayerId, getDisplayedMoves, getLegalMoves, isComputerTurnActive, rankValue, selectComputerMove, startMatchFromLobby } from '../src/lib/gameLogic.js';

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

test('matching the immediately previous card counts as caída and can stack with limpia', () => {
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

  assert.equal(next.scores.A, 40);
  assert.match(next.round.events[0], /\(\+4\)/);
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
  assert.equal(analysis.isCaida, true);
  assert.equal(analysis.isLimpia, true);
});
