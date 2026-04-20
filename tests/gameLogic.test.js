import test from 'node:test';
import assert from 'node:assert/strict';

import { applyMove, getLegalMoves, rankValue, startMatchFromLobby } from '../src/lib/gameLogic.js';

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
    seen.add(startMatchFromLobby(game).round.dealerIndex);
  }

  assert.ok(seen.size > 1, 'dealer index should not always be fixed');
  assert.ok([...seen].every((value) => value >= 0 && value < 4));
});
