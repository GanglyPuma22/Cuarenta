const PLAYER_KEY = 'cuarenta-local-player';
const NAME_KEY = 'cuarenta-player-name';

function randomId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function getLocalPlayerId() {
  let id = window.localStorage.getItem(PLAYER_KEY);
  if (!id) {
    id = randomId('player');
    window.localStorage.setItem(PLAYER_KEY, id);
  }
  return id;
}

export function getSavedName() {
  return window.localStorage.getItem(NAME_KEY) || '';
}

export function saveName(name) {
  window.localStorage.setItem(NAME_KEY, name.trim());
}
