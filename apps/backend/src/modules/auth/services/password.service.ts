import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { LoggerService } from '../../../common/services/logger.service';

/**
 * @interface PasswordStrength
 * @purpose Password strength analysis result
 */
export interface PasswordStrength {
  score: number; // 0-4 (very weak to very strong)
  feedback: string[];
  isStrong: boolean;
  estimatedCrackTime: string;
}

/**
 * @class PasswordService
 * @purpose Password hashing, verification, and strength analysis service
 */
@Injectable()
export class PasswordService {
  private readonly saltRounds: number;

  constructor(
    private configService: ConfigService,
    private logger: LoggerService
  ) {
    this.saltRounds = this.configService.get<number>('auth.bcryptRounds', 12);
  }

  /**
   * @method hashPassword
   * @purpose Hash password using bcrypt
   */
  async hashPassword(password: string): Promise<string> {
    try {
      const hash = await bcrypt.hash(password, this.saltRounds);
      this.logger.debug('Password hashed successfully', 'PasswordService');
      return hash;
    } catch (error) {
      this.logger.error('Password hashing failed', error.stack, 'PasswordService');
      throw new Error('Password hashing failed');
    }
  }

  /**
   * @method verifyPassword
   * @purpose Verify password against hash
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
      if (!password || !hash) {
        return false;
      }

      const isValid = await bcrypt.compare(password, hash);
      this.logger.debug(`Password verification: ${isValid ? 'success' : 'failed'}`, 'PasswordService');
      return isValid;
    } catch (error) {
      this.logger.error('Password verification failed', error.stack, 'PasswordService');
      return false;
    }
  }

  /**
   * @method analyzePasswordStrength
   * @purpose Analyze password strength and provide feedback
   */
  analyzePasswordStrength(password: string): PasswordStrength {
    const feedback: string[] = [];
    let score = 0;

    // Length check
    if (password.length < 8) {
      feedback.push('Password should be at least 8 characters long');
    } else if (password.length >= 8) {
      score += 1;
    }

    if (password.length >= 12) {
      score += 1;
    }

    // Character variety checks
    const hasLowercase = /[a-z]/.test(password);
    const hasUppercase = /[A-Z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChars = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

    if (!hasLowercase) {
      feedback.push('Add lowercase letters');
    }
    if (!hasUppercase) {
      feedback.push('Add uppercase letters');
    }
    if (!hasNumbers) {
      feedback.push('Add numbers');
    }
    if (!hasSpecialChars) {
      feedback.push('Add special characters');
    }

    // Score based on character variety
    const varietyCount = [hasLowercase, hasUppercase, hasNumbers, hasSpecialChars].filter(Boolean).length;
    score += Math.min(varietyCount - 1, 2); // Max 2 points for variety

    // Common patterns check
    const commonPatterns = [
      /123456/,
      /password/i,
      /qwerty/i,
      /abc123/i,
      /admin/i,
      /letmein/i,
      /welcome/i,
      /monkey/i,
      /dragon/i,
    ];

    const hasCommonPattern = commonPatterns.some(pattern => pattern.test(password));
    if (hasCommonPattern) {
      feedback.push('Avoid common patterns and dictionary words');
      score = Math.max(0, score - 1);
    }

    // Repetitive characters check
    const hasRepetitiveChars = /(.)\1{2,}/.test(password);
    if (hasRepetitiveChars) {
      feedback.push('Avoid repetitive characters');
      score = Math.max(0, score - 1);
    }

    // Sequential characters check
    const hasSequentialChars = this.hasSequentialCharacters(password);
    if (hasSequentialChars) {
      feedback.push('Avoid sequential characters');
      score = Math.max(0, score - 1);
    }

    // Ensure score is within bounds
    score = Math.max(0, Math.min(4, score));

    const strengthLabels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];
    const crackTimes = ['< 1 second', '< 1 minute', '< 1 hour', '< 1 day', '> 1 year'];

    return {
      score,
      feedback: feedback.length > 0 ? feedback : ['Password strength is good'],
      isStrong: score >= 3,
      estimatedCrackTime: crackTimes[score] || 'Unknown',
    };
  }

  /**
   * @method generateSecurePassword
   * @purpose Generate a secure random password
   */
  generateSecurePassword(length = 16): string {
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    
    const allChars = lowercase + uppercase + numbers + specialChars;
    
    let password = '';
    
    // Ensure at least one character from each category
    password += this.getRandomChar(lowercase);
    password += this.getRandomChar(uppercase);
    password += this.getRandomChar(numbers);
    password += this.getRandomChar(specialChars);
    
    // Fill the rest randomly
    for (let i = 4; i < length; i++) {
      password += this.getRandomChar(allChars);
    }
    
    // Shuffle the password to avoid predictable patterns
    return this.shuffleString(password);
  }

  /**
   * @method validatePasswordPolicy
   * @purpose Validate password against organizational policy
   */
  validatePasswordPolicy(password: string): {
    isValid: boolean;
    violations: string[];
  } {
    const violations: string[] = [];

    // Minimum length
    if (password.length < 8) {
      violations.push('Password must be at least 8 characters long');
    }

    // Maximum length (prevent DoS attacks)
    if (password.length > 128) {
      violations.push('Password must not exceed 128 characters');
    }

    // Character requirements
    if (!/[a-z]/.test(password)) {
      violations.push('Password must contain at least one lowercase letter');
    }

    if (!/[A-Z]/.test(password)) {
      violations.push('Password must contain at least one uppercase letter');
    }

    if (!/\d/.test(password)) {
      violations.push('Password must contain at least one number');
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      violations.push('Password must contain at least one special character');
    }

    // Check for common weak passwords
    const commonPasswords = [
      'password', 'password123', '123456', '123456789', 'qwerty',
      'abc123', 'password1', 'admin', 'letmein', 'welcome',
      'monkey', 'dragon', 'master', 'shadow', 'superman'
    ];

    if (commonPasswords.includes(password.toLowerCase())) {
      violations.push('Password is too common and easily guessable');
    }

    return {
      isValid: violations.length === 0,
      violations,
    };
  }

  /**
   * @method isPasswordCompromised
   * @purpose Check if password appears in known breach databases (placeholder)
   */
  async isPasswordCompromised(password: string): Promise<boolean> {
    try {
      // In a real implementation, you would check against services like:
      // - Have I Been Pwned API
      // - Troy Hunt's Pwned Passwords API
      // For now, we'll just check against a small list of known compromised passwords
      
      const knownCompromisedPasswords = [
        'password',
        '123456',
        '123456789',
        'qwerty',
        'password123',
        'abc123',
        'password1',
        'admin',
        'letmein',
        'welcome123',
      ];

      return knownCompromisedPasswords.includes(password.toLowerCase());
    } catch (error) {
      this.logger.error('Password compromise check failed', error.stack, 'PasswordService');
      return false; // Fail open for availability
    }
  }

  /**
   * @method hashPasswordWithCustomSalt
   * @purpose Hash password with custom salt (for migration scenarios)
   */
  async hashPasswordWithCustomSalt(password: string, salt: string): Promise<string> {
    try {
      const hash = await bcrypt.hash(password, salt);
      return hash;
    } catch (error) {
      this.logger.error('Custom salt password hashing failed', error.stack, 'PasswordService');
      throw new Error('Password hashing with custom salt failed');
    }
  }

  /**
   * @method needsRehashing
   * @purpose Check if password hash needs to be updated (due to changed salt rounds)
   */
  needsRehashing(hash: string): boolean {
    try {
      const rounds = bcrypt.getRounds(hash);
      return rounds !== this.saltRounds;
    } catch (error) {
      this.logger.error('Hash rounds check failed', error.stack, 'PasswordService');
      return false;
    }
  }

  /**
   * @method getRandomChar
   * @purpose Get random character from string
   */
  private getRandomChar(chars: string): string {
    return chars.charAt(Math.floor(Math.random() * chars.length));
  }

  /**
   * @method shuffleString
   * @purpose Shuffle string characters randomly
   */
  private shuffleString(str: string): string {
    const arr = str.split('');
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.join('');
  }

  /**
   * @method hasSequentialCharacters
   * @purpose Check for sequential characters in password
   */
  private hasSequentialCharacters(password: string): boolean {
    const sequences = [
      'abcdefghijklmnopqrstuvwxyz',
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      '0123456789',
      'qwertyuiopasdfghjklzxcvbnm', // QWERTY keyboard layout
    ];

    for (const sequence of sequences) {
      for (let i = 0; i <= sequence.length - 3; i++) {
        const subseq = sequence.substring(i, i + 3);
        if (password.includes(subseq) || password.includes(subseq.split('').reverse().join(''))) {
          return true;
        }
      }
    }

    return false;
  }
}