import { get, ref } from 'firebase/database';

export const AUTH_PROBE_GAME_CODE = '__auth_probe__';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isPermissionDenied(error) {
  const code = String(error?.code || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();
  return code.includes('permission') || message.includes('permission_denied') || message.includes('permission denied');
}

export function createRealtimeAuthProbe(db, probeCode = AUTH_PROBE_GAME_CODE) {
  return () => get(ref(db, `games/${probeCode}`));
}

export async function waitForRealtimeAuth({
  user,
  probe,
  maxAttempts = 6,
  delayMs = 250,
} = {}) {
  if (!user || typeof user.getIdToken !== 'function') {
    throw new Error('Anonymous Firebase session is not ready yet.');
  }

  if (typeof probe !== 'function') {
    throw new Error('Realtime Database auth probe is not configured.');
  }

  await user.getIdToken();

  let lastError = null;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      await probe();
      return;
    } catch (error) {
      if (!isPermissionDenied(error)) throw error;
      lastError = error;
      if (attempt >= maxAttempts - 1) break;
      if (attempt === 0) {
        try {
          await user.getIdToken(true);
        } catch {
          // Ignore token-refresh failures here and let the next probe surface the real issue.
        }
      }
      await sleep(delayMs);
    }
  }

  const error = new Error('Firebase auth finished, but the Realtime Database session did not catch up yet. Please retry in a second.');
  error.cause = lastError;
  throw error;
}
