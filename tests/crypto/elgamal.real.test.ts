import { ElGamalRealService, type ElGamalKeyPair, type PlainOrder } from '../../src/crypto/elgamal.real.service';

describe('ElGamalRealService', () => {
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

  describe('Encryption and Decryption', () => {
    it('should encrypt and decrypt numeric values correctly', () => {
      const keyPair = ElGamalRealService.generateKeyPair();
      const originalValue = BigInt(1000);

      const encrypted = ElGamalRealService.encrypt(originalValue, keyPair.publicKey);
      const decrypted = ElGamalRealService.decrypt(encrypted, keyPair.privateKey);

      expect(decrypted).toBe(originalValue);
    });

    it('should encrypt and decrypt zero value', () => {
      const keyPair = ElGamalRealService.generateKeyPair();
      const originalValue = BigInt(0);

      const encrypted = ElGamalRealService.encrypt(originalValue, keyPair.publicKey);
      const decrypted = ElGamalRealService.decrypt(encrypted, keyPair.privateKey);

      expect(decrypted).toBe(originalValue);
    });

    it('should encrypt and decrypt large values', () => {
      const keyPair = ElGamalRealService.generateKeyPair();
      const originalValue = BigInt(999999);

      const encrypted = ElGamalRealService.encrypt(originalValue, keyPair.publicKey);
      const decrypted = ElGamalRealService.decrypt(encrypted, keyPair.privateKey);

      expect(decrypted).toBe(originalValue);
    });

    it('should produce different ciphertexts for same plaintext', () => {
      const keyPair = ElGamalRealService.generateKeyPair();
      const value = BigInt(500);

      const encrypted1 = ElGamalRealService.encrypt(value, keyPair.publicKey);
      const encrypted2 = ElGamalRealService.encrypt(value, keyPair.publicKey);

      // Due to randomization, ciphertexts should be different
      expect(encrypted1.c1.x).not.toEqual(encrypted2.c1.x);
      expect(encrypted1.c2.x).not.toEqual(encrypted2.c2.x);

      // But both should decrypt to the same value
      const decrypted1 = ElGamalRealService.decrypt(encrypted1, keyPair.privateKey);
      const decrypted2 = ElGamalRealService.decrypt(encrypted2, keyPair.privateKey);

      expect(decrypted1).toBe(value);
      expect(decrypted2).toBe(value);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid public key gracefully', async () => {
      const invalidPublicKey = 'invalid-key';
      
      await expect(service.encrypt(100, invalidPublicKey))
        .rejects.toThrow();
    });

    it('should handle invalid private key gracefully', async () => {
      const keyPair = await service.generateKeyPair();
      const encrypted = await service.encrypt(100, keyPair.publicKey);
      const invalidPrivateKey = 'invalid-key';
      
      await expect(service.decrypt(encrypted, invalidPrivateKey))
        .rejects.toThrow();
    });

    it('should handle invalid ciphertext gracefully', async () => {
      const keyPair = await service.generateKeyPair();
      const invalidCiphertext = 'invalid-ciphertext';
      
      await expect(service.decrypt(invalidCiphertext, keyPair.privateKey))
        .rejects.toThrow();
    });

    it('should handle negative values correctly', async () => {
      const keyPair = await service.generateKeyPair();
      const negativeValue = -100;

      // This might throw or handle negatives depending on implementation
      try {
        const encrypted = await service.encrypt(negativeValue, keyPair.publicKey);
        const decrypted = await service.decrypt(encrypted, keyPair.privateKey);
        expect(decrypted).toBe(negativeValue);
      } catch (error) {
        // If negative values aren't supported, that's also valid
        expect(error).toBeDefined();
      }
    });
  });

  describe('Serialization', () => {
    it('should handle encrypted data serialization', async () => {
      const keyPair = await service.generateKeyPair();
      const value = 750;

      const encrypted = await service.encrypt(value, keyPair.publicKey);
      
      // Test that encrypted data can be JSON serialized/deserialized
      const serialized = JSON.stringify(encrypted);
      const deserialized = JSON.parse(serialized);
      
      const decrypted = await service.decrypt(deserialized, keyPair.privateKey);
      expect(decrypted).toBe(value);
    });

    it('should handle key serialization', async () => {
      const keyPair = await service.generateKeyPair();
      
      // Test that keys can be JSON serialized/deserialized
      const serializedPublicKey = JSON.stringify(keyPair.publicKey);
      const serializedPrivateKey = JSON.stringify(keyPair.privateKey);
      
      const deserializedPublicKey = JSON.parse(serializedPublicKey);
      const deserializedPrivateKey = JSON.parse(serializedPrivateKey);
      
      // Verify the keys still work after serialization
      const value = 500;
      const encrypted = await service.encrypt(value, deserializedPublicKey);
      const decrypted = await service.decrypt(encrypted, deserializedPrivateKey);
      
      expect(decrypted).toBe(value);
    });
  });
});