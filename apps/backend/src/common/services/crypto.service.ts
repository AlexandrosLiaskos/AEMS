import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

/**
 * @class CryptoService
 * @purpose Cryptographic operations service
 */
@Injectable()
export class CryptoService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32;
  private readonly ivLength = 16;
  private readonly tagLength = 16;

  /**
   * @method generateRandomBytes
   * @purpose Generate cryptographically secure random bytes
   */
  generateRandomBytes(length: number): Buffer {
    return crypto.randomBytes(length);
  }

  /**
   * @method generateRandomString
   * @purpose Generate random string
   */
  generateRandomString(length: number): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * @method hash
   * @purpose Hash data using SHA-256
   */
  hash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * @method hashPassword
   * @purpose Hash password using bcrypt
   */
  async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }

  /**
   * @method verifyPassword
   * @purpose Verify password against hash
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * @method encrypt
   * @purpose Encrypt data using AES-256-GCM
   */
  encrypt(data: string, key: string): { encrypted: string; iv: string; tag: string } {
    const keyBuffer = crypto.scryptSync(key, 'salt', this.keyLength);
    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipher(this.algorithm, keyBuffer);
    cipher.setAAD(Buffer.from('aems'));

    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: cipher.getAuthTag().toString('hex'),
    };
  }

  /**
   * @method decrypt
   * @purpose Decrypt data using AES-256-GCM
   */
  decrypt(encryptedData: { encrypted: string; iv: string; tag: string }, key: string): string {
    const keyBuffer = crypto.scryptSync(key, 'salt', this.keyLength);
    const iv = Buffer.from(encryptedData.iv, 'hex');
    const decipher = crypto.createDecipher(this.algorithm, keyBuffer);
    decipher.setAAD(Buffer.from('aems'));
    decipher.setAuthTag(Buffer.from(encryptedData.tag, 'hex'));

    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}