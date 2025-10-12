import '@testing-library/jest-dom';
import 'jest-environment-jsdom';
import * as crypto from 'crypto';

// Mock WebSocket globally
const mockWebSocket = {
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  send: jest.fn(),
  close: jest.fn(),
  readyState: 1,
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3
};

(global as typeof global & { WebSocket: typeof WebSocket }).WebSocket = jest.fn(() => mockWebSocket) as unknown as typeof WebSocket;

// Mock crypto for Node.js environment
Object.defineProperty(global, 'crypto', {
  value: {
    getRandomValues: (arr: Uint8Array) => {
      const buffer = crypto.randomBytes(arr.length);
      arr.set(buffer);
      return arr;
    },
    subtle: crypto.webcrypto?.subtle
  }
});

// Mock Solana connection
jest.mock('@solana/web3.js', () => ({
  Connection: jest.fn(),
  PublicKey: jest.fn(),
  Transaction: jest.fn(),
  SystemProgram: jest.fn(),
  Keypair: {
    generate: jest.fn(() => ({
      publicKey: 'mock-public-key',
      secretKey: new Uint8Array(64)
    }))
  }
}));

// Silence console warnings in tests
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning:')
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});