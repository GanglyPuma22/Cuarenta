import test from 'node:test';
import assert from 'node:assert/strict';

import { isPermissionDenied, waitForRealtimeAuth } from '../src/lib/firebaseReady.js';

test('isPermissionDenied catches Firebase permission-denied variants', () => {
  assert.equal(isPermissionDenied({ code: 'PERMISSION_DENIED' }), true);
  assert.equal(isPermissionDenied({ message: 'transaction failed: permission_denied' }), true);
  assert.equal(isPermissionDenied({ code: 'auth/network-request-failed' }), false);
});

test('waitForRealtimeAuth resolves once the probe succeeds after a transient permission denial', async () => {
  const tokenCalls = [];
  const user = {
    async getIdToken(forceRefresh = false) {
      tokenCalls.push(forceRefresh);
      return 'token';
    },
  };

  let attempts = 0;
  await waitForRealtimeAuth({
    user,
    delayMs: 0,
    probe: async () => {
      attempts += 1;
      if (attempts === 1) {
        const error = new Error('permission_denied');
        error.code = 'PERMISSION_DENIED';
        throw error;
      }
    },
  });

  assert.equal(attempts, 2);
  assert.deepEqual(tokenCalls, [false, true]);
});

test('waitForRealtimeAuth rethrows non-permission failures immediately', async () => {
  const user = {
    async getIdToken() {
      return 'token';
    },
  };

  const boom = new Error('backend offline');
  await assert.rejects(
    waitForRealtimeAuth({
      user,
      delayMs: 0,
      probe: async () => {
        throw boom;
      },
    }),
    boom
  );
});

test('waitForRealtimeAuth surfaces a friendly error after repeated permission denials', async () => {
  const user = {
    async getIdToken() {
      return 'token';
    },
  };

  await assert.rejects(
    waitForRealtimeAuth({
      user,
      maxAttempts: 2,
      delayMs: 0,
      probe: async () => {
        const error = new Error('transaction failed: permission_denied');
        error.code = 'PERMISSION_DENIED';
        throw error;
      },
    }),
    /Realtime Database session did not catch up yet/
  );
});
