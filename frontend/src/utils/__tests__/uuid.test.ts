import { generateUUID, generateShortUUID } from '../uuid';

describe('UUID Utils', () => {
  // テスト用にcrypto.randomUUIDモックを無効化
  beforeEach(() => {
    // @ts-ignore
    global.crypto = {
      getRandomValues: (buffer: Uint8Array) => {
        for (let i = 0; i < buffer.length; i++) {
          buffer[i] = Math.floor(Math.random() * 256);
        }
        return buffer;
      }
    };
  });

  describe('generateUUID', () => {
    it('should generate a valid UUID format', () => {
      const uuid = generateUUID();
      
      // UUID v4の形式をチェック
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(uuid).toMatch(uuidRegex);
      expect(uuid).toHaveLength(36);
    });

    it('should generate different UUIDs on multiple calls', () => {
      const uuid1 = generateUUID();
      const uuid2 = generateUUID();

      expect(uuid1).not.toBe(uuid2);
      expect(uuid1).toHaveLength(36);
      expect(uuid2).toHaveLength(36);
    });

    it('should work when crypto.randomUUID is not available', () => {
      // crypto.randomUUIDを一時的に無効化
      const originalCrypto = global.crypto;
      
      // @ts-ignore
      global.crypto = undefined;
      
      const uuid = generateUUID();
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(uuid).toMatch(uuidRegex);
      
      // 元に戻す
      global.crypto = originalCrypto;
    });

    it('should fallback when crypto.randomUUID throws an error', () => {
      // crypto.randomUUIDがエラーを投げる場合をシミュレート
      const originalCrypto = global.crypto;
      
      Object.defineProperty(global, 'crypto', {
        value: {
          randomUUID: jest.fn(() => {
            throw new Error('Not in secure context');
          }),
        },
        writable: true,
      });
      
      const uuid = generateUUID();
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(uuid).toMatch(uuidRegex);
      
      // 元に戻す
      global.crypto = originalCrypto;
    });
  });

  describe('generateShortUUID', () => {
    it('should generate a short UUID (8 characters)', () => {
      const shortUuid = generateShortUUID();
      expect(shortUuid).toHaveLength(8);
      expect(shortUuid).toMatch(/^[0-9a-f]{8}$/i);
    });

    it('should generate different short UUIDs on multiple calls', () => {
      const shortUuid1 = generateShortUUID();
      const shortUuid2 = generateShortUUID();

      expect(shortUuid1).not.toBe(shortUuid2);
      expect(shortUuid1).toHaveLength(8);
      expect(shortUuid2).toHaveLength(8);
    });
  });
});