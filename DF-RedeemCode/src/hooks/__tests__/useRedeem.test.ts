import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

// Minimal Mocks to avoid crashes in some environments
vi.mock('../../lib/firebase', () => ({ auth: {}, db: {} }));
vi.mock('firebase/auth', () => ({ onAuthStateChanged: vi.fn(() => vi.fn()) }));
vi.mock('firebase/database', () => ({ 
    ref: vi.fn(), 
    onValue: vi.fn(() => vi.fn()),
    query: vi.fn(),
    orderByValue: vi.fn(),
    limitToLast: vi.fn(),
}));
vi.mock('sweetalert2', () => ({ default: { fire: vi.fn() } }));
vi.mock('../../lib/storage', () => ({ migrateStorage: vi.fn() }));

import { useRedeem } from '../useRedeem';

describe('useRedeem hook', () => {
    it('should be defined', () => {
        const { result } = renderHook(() => useRedeem());
        expect(result.current).toBeDefined();
    });
});
