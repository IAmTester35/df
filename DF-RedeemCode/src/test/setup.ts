import '@testing-library/jest-dom';
import { vi } from 'vitest';

// 1. Browser APIs
window.alert = vi.fn();
(window as any).fetch = vi.fn();

const localStorageMock = (function () {
  let store: Record<string, string> = {};
  return {
    getItem(key: string) { return store[key] || null; },
    setItem(key: string, value: string) { store[key] = value.toString(); },
    clear() { store = {}; },
    removeItem(key: string) { delete store[key]; },
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// 2. Firebase Mocks
vi.mock('firebase/auth', () => ({
  signInAnonymously: vi.fn(),
  onAuthStateChanged: vi.fn((_auth, cb) => {
     setTimeout(() => cb(null), 0); // start with no user
     return vi.fn(); 
  }),
  GoogleAuthProvider: vi.fn(),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('firebase/database', () => ({
  ref: vi.fn(),
  onValue: vi.fn((_query, cb) => {
    setTimeout(() => cb({ 
      forEach: (iter: any) => iter({ key: 'code', val: () => 100 }) 
    }), 0);
    return vi.fn(); 
  }),
  get: vi.fn(() => Promise.resolve({ 
    exists: () => true, 
    val: () => ({ lastSync: 123, masterUrl: 'test' }) 
  })),
  update: vi.fn(() => Promise.resolve()),
  query: vi.fn(),
  orderByValue: vi.fn(),
  limitToLast: vi.fn(),
  startAfter: vi.fn(),
}));

// 3. Swal Mock
vi.mock('sweetalert2', () => ({
  default: { fire: vi.fn() },
}));

// 4. Firebase Lib mock
vi.mock('../lib/firebase', () => ({
  auth: { uid: 'test-uid' },
  db: {},
}));
