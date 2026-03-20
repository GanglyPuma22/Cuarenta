import { useEffect, useMemo, useState } from 'react';
import { get, onValue, ref, runTransaction } from 'firebase/database';
import { db } from './lib/firebase';
import { getLocalPlayerId, getSavedName, saveName } from './lib/localPlayer';
import { applyMove, createInitialGameState, generateGameCode, getLegalMoves, getVisibleHand, startMatchFromLobby, teamSummary } from './lib/gameLogic';

function cardText(card) {
  return `${card.rank}${card.suit}`;
}

function GameCode({ code }) {
  return <div className="game-code">Game code: <strong>{code}</strong></div>;
}

function PlayerChip({ player, isCurrent }) {
  return <div className={`player-chip ${isCurrent ? 'current' : ''}`}>{player?.name || 'Open seat'}</div>;
}

function Board({ cards }) {
  return (
    <section className="panel board-panel">
      <div className="panel-title">Table</div>
      <div className="board-grid">
        {cards.length ? cards.map((card) => <div key={card.id} className="card-face board-card">{cardText(card)}</div>) : <div className="empty">No cards on the table</div>}
      </div>
    </section>
  );
}

function MovePicker({ hand, legalMoves, onPlay, isYourTurn }) {
  const [selectedCardId, setSelectedCardId] = useState('');
  const [selectedMoveKey, setSelectedMoveKey] = useState('');

  useEffect(() => {
    if (!hand.some((card) => card.id === selectedCardId)) {
      setSelectedCardId(hand[0]?.id || '');
      setSelectedMoveKey('');
    }
  }, [hand, selectedCardId]);

  const movesForCard = legalMoves.filter((move) => move.playedCardId === selectedCardId);
  const selectedMove = movesForCard.find((move) => `${move.type}:${(move.captureIds || []).join(',')}` === selectedMoveKey) || movesForCard[0];

  useEffect(() => {
    if (movesForCard.length) {
      setSelectedMoveKey(`${movesForCard[0].type}:${(movesForCard[0].captureIds || []).join(',')}`);
    } else {
      setSelectedMoveKey('');
    }
  }, [selectedCardId]);

  return (
    <section className="panel">
      <div className="panel-title">Your hand</div>
      <div className="hand-row">
        {hand.map((card) => (
          <button key={card.id} className={`card-face hand-card ${selectedCardId === card.id ? 'selected' : ''}`} onClick={() => setSelectedCardId(card.id)}>
            {cardText(card)}
          </button>
        ))}
      </div>
      {isYourTurn ? (
        <div className="move-box">
          <label>
            Available plays
            <select value={selectedMoveKey} onChange={(event) => setSelectedMoveKey(event.target.value)}>
              {movesForCard.map((move) => {
                const key = `${move.type}:${(move.captureIds || []).join(',')}`;
                return <option key={key} value={key}>{move.label}</option>;
              })}
            </select>
          </label>
          <button className="primary" disabled={!selectedMove} onClick={() => selectedMove && onPlay(selectedMove)}>Play selected move</button>
        </div>
      ) : <div className="muted">Waiting for your turn.</div>}
    </section>
  );
}

export default function App() {
  const [name, setName] = useState(getSavedName());
  const [joinCode, setJoinCode] = useState('');
  const [gameCode, setGameCode] = useState('');
  const [game, setGame] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const playerId = useMemo(() => getLocalPlayerId(), []);
  const gameRef = useMemo(() => (gameCode ? ref(db, `games/${gameCode}`) : null), [gameCode]);

  useEffect(() => {
    if (!gameRef) return undefined;
    return onValue(gameRef, (snapshot) => {
      setGame(snapshot.val());
    });
  }, [gameRef]);

  async function createGame() {
    const trimmed = name.trim();
    if (!trimmed) return setError('Enter your name first.');
    saveName(trimmed);
    setBusy(true);
    setError('');

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

    setGameCode(code);
    setBusy(false);
  }

  async function joinGame() {
    const trimmed = name.trim();
    const code = joinCode.trim().toUpperCase();
    if (!trimmed || !code) return setError('Enter your name and a game code.');
    saveName(trimmed);
    setBusy(true);
    setError('');

    const joinRef = ref(db, `games/${code}`);
    try {
      const existingSnapshot = await get(joinRef);
      const existing = existingSnapshot.val();
      if (!existing) throw new Error('Game not found.');
      if (existing.status !== 'lobby') throw new Error('Game already started.');
      if (!existing.players?.[playerId] && (existing.seating || []).length >= 4) throw new Error('Game is full.');

      const result = await runTransaction(joinRef, (current) => {
        if (!current) return current;
        current.players ||= {};
        current.seating ||= [];
        current.players[playerId] = {
          id: playerId,
          name: trimmed,
          joinedAt: Date.now(),
          isHost: current.hostId === playerId,
        };
        if (!current.seating.includes(playerId)) current.seating.push(playerId);
        current.lobbyMessage = current.seating.length === 4 ? 'Ready for host review' : 'Waiting for players';
        return current;
      }, { applyLocally: false });

      if (!result?.snapshot?.exists()) throw new Error('Game not found.');
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

  async function playMove(move) {
    setBusy(true);
    setError('');
    await runTransaction(gameRef, (current) => {
      if (!current) return current;
      return applyMove(current, playerId, move);
    }, { applyLocally: false }).catch((transactionError) => setError(transactionError.message || 'Could not play move.'));
    setBusy(false);
  }

  const seating = game?.seating?.map((id) => game.players[id]);
  const teams = teamSummary(game);
  const round = game?.round;
  const visibleHand = round ? getVisibleHand(round, playerId) : [];
  const legalMoves = round ? getLegalMoves(round, playerId) : [];
  const isHost = game?.hostId === playerId;
  const isYourTurn = round?.turnPlayerId === playerId;

  return (
    <main className="shell">
      <header className="hero">
        <div>
          <h1>Cuarenta</h1>
          <p>4-player team game with Firebase-synced lobby and turn logic.</p>
        </div>
        {game?.code ? <GameCode code={game.code} /> : null}
      </header>

      {!gameCode ? (
        <section className="panel auth-panel">
          <div className="panel-title">Join or host</div>
          <label>
            Your name
            <input value={name} onChange={(event) => setName(event.target.value)} maxLength={24} placeholder="Max 24 chars" />
          </label>
          <div className="action-row">
            <button className="primary" disabled={busy} onClick={createGame}>Host new game</button>
          </div>
          <div className="join-row">
            <input value={joinCode} onChange={(event) => setJoinCode(event.target.value)} placeholder="Enter 6-char code" maxLength={6} />
            <button disabled={busy} onClick={joinGame}>Join by code</button>
          </div>
        </section>
      ) : null}

      {gameCode && !game ? <section className="panel">Loading game…</section> : null}

      {game && game.status === 'lobby' ? (
        <section className="panel lobby-panel">
          <div className="panel-title">Lobby</div>
          <p className="muted">Host reviews joined names, then starts when ready. Seats define teams: 1 & 3 vs 2 & 4.</p>
          <div className="seat-grid">
            {[0, 1, 2, 3].map((index) => <PlayerChip key={index} player={seating?.[index]} isCurrent={seating?.[index]?.id === playerId} />)}
          </div>
          <div className="muted">{game.lobbyMessage}</div>
          {isHost ? <button className="primary" disabled={busy || (game.seating || []).length !== 4} onClick={startGame}>Start game</button> : null}
        </section>
      ) : null}

      {game && round ? (
        <>
          <section className="stats-grid">
            {teams.map((team) => (
              <div key={team.teamId} className="panel stat-card">
                <div className="panel-title">Team {team.teamId}</div>
                <div>{team.players.map((player) => player?.name).join(' & ')}</div>
                <div>Score: <strong>{team.score}</strong></div>
                <div>Captured this hand: {team.captured}</div>
              </div>
            ))}
            <div className="panel stat-card">
              <div className="panel-title">Round</div>
              <div>Hand {round.handNumber}</div>
              <div>Deal {round.activeDeal}</div>
              <div>Turn: <strong>{game.players[round.turnPlayerId]?.name}</strong></div>
            </div>
          </section>

          <Board cards={round.board} />
          <MovePicker hand={visibleHand} legalMoves={legalMoves} onPlay={playMove} isYourTurn={isYourTurn} />

          <section className="panel events-panel">
            <div className="panel-title">Recent events</div>
            <ul>
              {(round.events || []).slice(0, 10).map((event, index) => <li key={`${event}-${index}`}>{event}</li>)}
            </ul>
          </section>

          {game.status === 'finished' ? (
            <section className="panel winner-panel">
              <div className="panel-title">Game over</div>
              <p>Team {game.winner} wins.</p>
            </section>
          ) : null}
        </>
      ) : null}

      {error ? <div className="error-banner">{error}</div> : null}
    </main>
  );
}
