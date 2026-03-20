import { useEffect, useMemo, useState } from 'react';
import { get, onValue, ref, runTransaction } from 'firebase/database';
import { databaseUrl, db } from './lib/firebase';
import { getLocalPlayerId, getSavedName, saveName } from './lib/localPlayer';
import { applyMove, createInitialGameState, generateGameCode, getLegalMoves, getVisibleHand, startMatchFromLobby, teamSummary } from './lib/gameLogic';

function cardText(card) {
  return `${card.rank}${card.suit}`;
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

function cardSuitClass(card) {
  return card?.suit === '♥' || card?.suit === '♦' ? 'is-red' : 'is-dark';
}

function GameCode({ code }) {
  return <div className="share-pill">Share code: <strong>{code}</strong></div>;
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

  return (
    <aside className="sidebar-panel">
      <h2 className="sidebar-title">Turn Order</h2>
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
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}

function Board({ cards, deckRemaining, canLimpia }) {
  return (
    <section className="board-shell">
      <div className="board-hud">
        <div className="hud-chip">Deck: {deckRemaining}</div>
        <div className="hud-chip accent">{canLimpia ? 'Limpia live' : 'No limpia bonus'}</div>
      </div>
      <div className="table-grid">
        {cards.length ? cards.map((card) => (
          <div key={card.id} className={`stitch-card board-card ${cardSuitClass(card)}`}>
            <div className="card-corner">{card.rank}</div>
            <div className="card-center">{card.suit}</div>
            <div className="card-corner bottom">{card.rank}</div>
          </div>
        )) : <div className="empty-table">No cards on the table yet</div>}
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
  }, [selectedCardId, legalMoves]);

  return (
    <section className="hand-shell">
      <div className="hand-head">
        <span>Your hand</span>
        <span className="hand-kicker">Cuarenta</span>
      </div>
      <div className="hand-row stitch-hand-row">
        {hand.map((card) => (
          <button key={card.id} className={`stitch-card hand-card ${cardSuitClass(card)} ${selectedCardId === card.id ? 'selected' : ''}`} onClick={() => setSelectedCardId(card.id)}>
            <div className="card-corner">{card.rank}</div>
            <div className="card-center">{card.suit}</div>
            <div className="card-corner bottom">{card.rank}</div>
          </button>
        ))}
      </div>
      {isYourTurn ? (
        <div className="play-controls">
          <label>
            Available plays
            <select value={selectedMoveKey} onChange={(event) => setSelectedMoveKey(event.target.value)}>
              {movesForCard.map((move) => {
                const key = `${move.type}:${(move.captureIds || []).join(',')}`;
                return <option key={key} value={key}>{move.label}</option>;
              })}
            </select>
          </label>
          <button className="primary-button" disabled={!selectedMove} onClick={() => selectedMove && onPlay(selectedMove)}>
            Play selected move
          </button>
        </div>
      ) : <div className="muted-note">Waiting for your turn.</div>}
    </section>
  );
}

function TeamCard({ team }) {
  return (
    <div className="team-stat">
      <div className="team-stat-title">Team {team.teamId}</div>
      <div className="team-stat-players">{team.players.map((player) => player?.name).join(' & ')}</div>
      <div className="team-stat-line">Score <strong>{team.score}</strong></div>
      <div className="team-stat-line">Captured this hand {team.captured}</div>
    </div>
  );
}

function ActivityPanel({ round, game, currentPlayerId }) {
  const me = game?.players?.[currentPlayerId];
  const caidaEvents = (round?.events || []).filter((event) => /\(\+2\)|ca[ií]da/i.test(event)).slice(0, 1);
  const limpiaEvents = (round?.events || []).filter((event) => /limpia/i.test(event)).slice(0, 1);
  const remaining = (round?.events || []).slice(0, 4);

  return (
    <aside className="activity-column">
      <div className="profile-card">
        <div className="profile-avatar">{(me?.name || '?').slice(0, 1).toUpperCase()}</div>
        <div className="profile-name">{me?.name || 'Player'}</div>
        <div className="profile-sub">Maestro de Cuarenta</div>
        <div className="profile-stats">
          <div><span>Caídas</span><strong>{caidaEvents.length}</strong></div>
          <div><span>Limpias</span><strong>{limpiaEvents.length}</strong></div>
        </div>
      </div>
      <div className="activity-card">
        <div className="activity-title">Activity</div>
        <ul>
          {remaining.map((event, index) => <li key={`${event}-${index}`}>{event}</li>)}
        </ul>
      </div>
    </aside>
  );
}

export default function App() {
  const [name, setName] = useState(getSavedName());
  const [joinCode, setJoinCode] = useState('');
  const [gameCode, setGameCode] = useState('');
  const [game, setGame] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [dbStatus, setDbStatus] = useState('checking');

  const playerId = useMemo(() => getLocalPlayerId(), []);
  const gameRef = useMemo(() => (gameCode ? ref(db, `games/${gameCode}`) : null), [gameCode]);

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
    if (!gameRef) return undefined;
    return onValue(
      gameRef,
      (snapshot) => {
        setGame(snapshot.val());
      },
      (firebaseError) => {
        setError(firebaseError.message || 'Realtime sync failed.');
      }
    );
  }, [gameRef]);

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
      setGameCode(code);
    } catch (transactionError) {
      setError(transactionError.message || 'Unable to create game. Check Firebase database rules and config.');
    } finally {
      setBusy(false);
    }
  }

  async function joinGame() {
    const trimmed = name.trim();
    const code = joinCode.trim().toUpperCase();
    if (!trimmed || !code) return setError('Enter your name and a game code.');
    if (dbStatus === 'read-denied') return setError('RTDB public reads are currently blocked, so joining cannot work yet. Update the live database rules first.');
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
  const canLimpia = round ? (game.scores[round.teamsByPlayer[playerId]?.teamId] || 0) < 38 : false;

  return (
    <main className="cuarenta-app">
      <header className="topbar">
        <div className="brand-block">
          <div className="brand">Cuarenta</div>
          <nav className="topnav">
            <span>Rules</span>
            <span>History</span>
          </nav>
        </div>
        <div className="topbar-actions">
          {game?.code ? <GameCode code={game.code} /> : null}
          <button className="header-button">Share Code</button>
        </div>
      </header>

      {!gameCode ? (
        <section className="lobby-shell invite-mode">
          <div className="invite-copy">
            <div className="eyebrow">Lobby Invitation</div>
            <h1>Host or Join a Match</h1>
            <p>Classic four-player Cuarenta with a private code and a host-controlled lobby.</p>
          </div>
          <section className="auth-card">
            <label>
              Your name
              <input value={name} onChange={(event) => setName(event.target.value)} maxLength={24} placeholder="Mateo V." />
            </label>
            <div className="button-stack">
              <button className="primary-button" disabled={busy || dbStatus === 'checking'} onClick={createGame}>Host game</button>
            </div>
            <div className="join-inline">
              <input value={joinCode} onChange={(event) => setJoinCode(event.target.value)} placeholder="Enter code" maxLength={6} />
              <button className="secondary-button" disabled={busy || dbStatus === 'checking'} onClick={joinGame}>Join</button>
            </div>
          </section>
        </section>
      ) : null}

      {dbStatus === 'read-denied' ? (
        <section className="notice-card">
          The live Firebase Realtime Database still rejects public reads for the game path. With the current no-auth design, host and join will not work until those live rules are deployed.
        </section>
      ) : null}

      {gameCode && !game ? <section className="notice-card">Loading game…</section> : null}

      {game && game.status === 'lobby' ? (
        <section className="lobby-shell">
          <div className="invite-copy centered">
            <div className="eyebrow">Lobby Invitation</div>
            <h1>{game.code.split('').join('-')}</h1>
            <p>{game.lobbyMessage || 'Share this code with three friends to start a classic match of Cuarenta.'}</p>
          </div>
          <div className="lobby-grid">
            {[0, 1, 2, 3].map((index) => <LobbySeat key={index} slot={index + 1} player={seating?.[index]} isCurrent={seating?.[index]?.id === playerId} />)}
          </div>
          <div className="lobby-actions">
            {isHost ? <button className="primary-button wide" disabled={busy || (game.seating || []).length !== 4} onClick={startGame}>Start Game</button> : null}
            <div className="lobby-footnote">Requires 4 players to begin</div>
          </div>
        </section>
      ) : null}

      {game && round ? (
        <section className="game-layout">
          <TurnOrder game={game} currentPlayerId={playerId} />
          <section className="center-column">
            <div className="team-stats-row">
              {teams.map((team) => <TeamCard key={team.teamId} team={team} />)}
              <div className="phase-card">
                <div className="team-stat-title">Current round</div>
                <div className="phase-name">Hand {round.handNumber} · Deal {round.activeDeal}</div>
                <div className="phase-turn">Turn: {game.players[round.turnPlayerId]?.name}</div>
              </div>
            </div>
            <Board cards={round.board} deckRemaining={round.deckRemaining} canLimpia={canLimpia} />
            <MovePicker hand={visibleHand} legalMoves={legalMoves} onPlay={playMove} isYourTurn={isYourTurn} />
            {game.status === 'finished' ? <section className="notice-card">Game over — Team {game.winner} wins.</section> : null}
          </section>
          <ActivityPanel round={round} game={game} currentPlayerId={playerId} />
        </section>
      ) : null}

      {error ? <div className="error-banner">{error}</div> : null}
    </main>
  );
}
