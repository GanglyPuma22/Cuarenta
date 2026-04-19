const ACTIVE_SESSION_KEY = 'cuarenta-active-session';

export function normalizeGameCode(value = '') {
  return String(value).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

export function getSavedSession() {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(ACTIVE_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const gameCode = normalizeGameCode(parsed?.gameCode || '');
    if (!gameCode) return null;
    return {
      gameCode,
      lastVisitedAt: Number(parsed?.lastVisitedAt) || null,
    };
  } catch {
    return null;
  }
}

export function saveGameSession(gameCode) {
  if (typeof window === 'undefined') return;
  const code = normalizeGameCode(gameCode);
  if (!code) {
    clearSavedSession();
    return;
  }

  window.localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify({
    gameCode: code,
    lastVisitedAt: Date.now(),
  }));
}

export function clearSavedSession() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(ACTIVE_SESSION_KEY);
}

export function getGameCodeFromUrl() {
  if (typeof window === 'undefined') return '';

  const url = new URL(window.location.href);
  const fromQuery = normalizeGameCode(url.searchParams.get('game') || '');
  if (fromQuery) return fromQuery;

  const parts = url.pathname.split('/').filter(Boolean);
  for (let index = 0; index < parts.length - 1; index += 1) {
    const segment = parts[index].toLowerCase();
    if (segment === 'g' || segment === 'game' || segment === 'join') {
      const fromPath = normalizeGameCode(parts[index + 1]);
      if (fromPath) return fromPath;
    }
  }

  const tail = normalizeGameCode(parts.at(-1) || '');
  if (tail && /^[A-HJ-NP-Z2-9]{6}$/.test(tail)) return tail;

  return '';
}

export function syncGameUrl(gameCode) {
  if (typeof window === 'undefined') return;

  const url = new URL(window.location.href);
  const code = normalizeGameCode(gameCode);

  if (code) {
    url.searchParams.set('game', code);
  } else {
    url.searchParams.delete('game');
  }

  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}

export function buildGameUrl(gameCode) {
  if (typeof window === 'undefined') return '';

  const url = new URL(window.location.href);
  const code = normalizeGameCode(gameCode);

  if (code) {
    url.searchParams.set('game', code);
  } else {
    url.searchParams.delete('game');
  }

  return url.toString();
}
