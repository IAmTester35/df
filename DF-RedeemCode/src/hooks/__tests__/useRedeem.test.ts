import { vi } from 'vitest';

// 1. MOCK FIRST BEFORE EVERYTHING
vi.mock('../../lib/firebase', () => ({
  auth: { uid: 'test-uid' },
  db: {},
}));

vi.mock('firebase/auth', () => ({
  signInAnonymously: vi.fn(),
  onAuthStateChanged: vi.fn((_auth, cb) => {
    setTimeout(() => cb({ uid: 'test-uid' }), 0);
    return vi.fn();
  }),
  GoogleAuthProvider: vi.fn(),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('firebase/database', () => ({
  ref: vi.fn(),
  onValue: vi.fn(() => vi.fn()),
  get: vi.fn(() => Promise.resolve({ exists: () => true, val: () => ({}) })),
  update: vi.fn(() => Promise.resolve()),
  query: vi.fn(),
  orderByValue: vi.fn(),
  limitToLast: vi.fn(),
  startAfter: vi.fn(),
}));

vi.mock('sweetalert2', () => ({
  default: { fire: vi.fn() },
}));

// 2. NOW IMPORTS
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { useRedeem } from '../useRedeem';
import * as authFuncs from 'firebase/auth';
import * as dbFuncs from 'firebase/database';
import Swal from 'sweetalert2';

describe('useRedeem hook', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    it('displays sync successfully', async () => {
        const { result } = renderHook(() => useRedeem());
        await act(async () => {
            await result.current.handleSync();
        });
        expect(dbFuncs.get).toHaveBeenCalled();
        expect(Swal.fire).toHaveBeenCalled();
    });
});
