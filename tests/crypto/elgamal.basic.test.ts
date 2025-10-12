import { ElGamalRealService } from '../../src/crypto/elgamal.real.service';

describe('ElGamalRealService - Basic Tests', () => {
  describe('Key Generation', () => {
    it('should generate valid key pairs', () => {
      const keyPair = ElGamalRealService.generateKeyPair();
      
      expect(keyPair).toBeDefined();
      expect(keyPair.publicKey).toBeDefined();
      expect(keyPair.privateKey).toBeDefined();
      expect(keyPair.publicKey.x).toBeDefined();
      expect(keyPair.publicKey.y).toBeDefined();
      expect(keyPair.privateKey.length).toBe(64); // 32 bytes as hex string
    });

    it('should generate different key pairs on each call', () => {
      const keyPair1 = ElGamalRealService.generateKeyPair();
      const keyPair2 = ElGamalRealService.generateKeyPair();
      
      expect(keyPair1.privateKey).not.toEqual(keyPair2.privateKey);
      expect(keyPair1.publicKey.x).not.toEqual(keyPair2.publicKey.x);
      expect(keyPair1.publicKey.y).not.toEqual(keyPair2.publicKey.y);
    });
  });

  describe('Basic Encryption Structure', () => {
    it('should create valid encryption structure', () => {
      const keyPair = ElGamalRealService.generateKeyPair();
      const originalValue = BigInt(0);

      const encrypted = ElGamalRealService.encrypt(originalValue, keyPair.publicKey);
      expect(encrypted).toBeDefined();
      expect(encrypted.c1).toBeDefined();
      expect(encrypted.c2).toBeDefined();
      expect(encrypted.c1.x).toBeDefined();
      expect(encrypted.c1.y).toBeDefined();
      expect(encrypted.c2.x).toBeDefined();
      expect(encrypted.c2.y).toBeDefined();
    });

    it('should produce different encryptions for same plaintext', () => {
      const keyPair = ElGamalRealService.generateKeyPair();
      const value = BigInt(0);

      const encrypted1 = ElGamalRealService.encrypt(value, keyPair.publicKey);
      const encrypted2 = ElGamalRealService.encrypt(value, keyPair.publicKey);

      // Due to randomization, ciphertexts should be different
      expect(encrypted1.c1.x).not.toEqual(encrypted2.c1.x);
    });

    it('should successfully encrypt and decrypt zero', () => {
      const keyPair = ElGamalRealService.generateKeyPair();
      const originalValue = BigInt(0);

      const encrypted = ElGamalRealService.encrypt(originalValue, keyPair.publicKey);
      const decrypted = ElGamalRealService.decrypt(encrypted, keyPair.privateKey);

      expect(decrypted).toBe(originalValue);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid public key gracefully', () => {
      const invalidPublicKey = { x: 'invalid', y: 'invalid' } as const;
      
      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ElGamalRealService.encrypt(BigInt(1), invalidPublicKey as any);
      }).toThrow();
    });

    it('should handle invalid private key gracefully', () => {
      const keyPair = ElGamalRealService.generateKeyPair();
      const encrypted = ElGamalRealService.encrypt(BigInt(1), keyPair.publicKey);
      const invalidPrivateKey = 'invalid-key';
      
      expect(() => {
        ElGamalRealService.decrypt(encrypted, invalidPrivateKey);
      }).toThrow();
    });
  });

  describe('Serialization', () => {
    it('should handle key serialization', () => {
      const keyPair = ElGamalRealService.generateKeyPair();
      
      // Test that keys can be JSON serialized/deserialized
      const serializedPublicKey = JSON.stringify(keyPair.publicKey);
      const serializedPrivateKey = JSON.stringify(keyPair.privateKey);
      
      const deserializedPublicKey = JSON.parse(serializedPublicKey);
      const deserializedPrivateKey = JSON.parse(serializedPrivateKey);
      
      // Basic structure check
      expect(deserializedPublicKey.x).toBeDefined();
      expect(deserializedPublicKey.y).toBeDefined();
      expect(deserializedPrivateKey).toBeDefined();
    });
  });
});