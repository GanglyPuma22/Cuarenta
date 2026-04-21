const NAME_KEY = 'cuarenta-player-name';

export function getSavedName() {
  return window.localStorage.getItem(NAME_KEY) || '';
}

export function saveName(name) {
  window.localStorage.setItem(NAME_KEY, name.trim());
}
