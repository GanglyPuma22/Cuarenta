const ACTIVE_SESSION_KEY = 'cuarenta-active-session';
const GAME_CODE_REGEX = /^[A-HJ-NP-Z2-9]{6}$/;

export function normalizeGameCode(value = '') {
  return (String(value).toUpperCase().match(/[A-HJ-NP-Z2-9]/g) || []).join('').slice(0, 6);
}

export function isValidGameCode(value = '') {
  return GAME_CODE_REGEX.test(String(value));
}

export function getSavedSession() {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(ACTIVE_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const gameCode = normalizeGameCode(parsed?.gameCode || '');
    if (!isValidGameCode(gameCode)) return null;
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
  if (!isValidGameCode(code)) {
    clearSavedSession();
    return;
  }

  try {
    window.localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify({
      gameCode: code,
      lastVisitedAt: Date.now(),
    }));
  } catch {
    // Ignore storage write failures so session persistence does not crash the app.
  }
}

export function clearSavedSession() {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.removeItem(ACTIVE_SESSION_KEY);
  } catch {
    // Ignore storage removal failures so session clearing does not crash the app.
  }
}

export function getGameCodeFromUrl() {
  if (typeof window === 'undefined') return '';

  const url = new URL(window.location.href);
  const fromQuery = normalizeGameCode(url.searchParams.get('game') || '');
  if (isValidGameCode(fromQuery)) return fromQuery;

  const parts = url.pathname.split('/').filter(Boolean);
  for (let index = 0; index < parts.length - 1; index += 1) {
    const segment = parts[index].toLowerCase();
    if (segment === 'g' || segment === 'game' || segment === 'join') {
      const fromPath = normalizeGameCode(parts[index + 1]);
      if (isValidGameCode(fromPath)) return fromPath;
    }
  }

  const tail = normalizeGameCode(parts.at(-1) || '');
  if (isValidGameCode(tail)) return tail;

  return '';
}

export function syncGameUrl(gameCode) {
  if (typeof window === 'undefined') return;

  const url = new URL(window.location.href);
  const code = normalizeGameCode(gameCode);

  if (isValidGameCode(code)) {
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

  if (isValidGameCode(code)) {
    url.searchParams.set('game', code);
  } else {
    url.searchParams.delete('game');
  }

  return url.toString();
}
