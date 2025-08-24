import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { EmailMessage } from './email-message.entity';
import { AuditLog } from './audit-log.entity';

/**
 * @enum UserRole
 * @purpose User role enumeration
 */
export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
  MODERATOR = 'MODERATOR',
}

/**
 * @enum UserStatus
 * @purpose User status enumeration
 */
export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
  PENDING = 'PENDING',
}

/**
 * @class User
 * @purpose User entity
 */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  avatar?: string;

  @Column({ nullable: true })
  picture?: string;

  @Column({ nullable: true })
  passwordHash?: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.USER,
  })
  role: UserRole;

  @Column({
    type: 'enum',
    enum: UserStatus,
    default: UserStatus.ACTIVE,
  })
  status: UserStatus;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  refreshToken?: string;

  @Column({ nullable: true })
  lastLoginAt?: Date;

  @Column({ type: 'json', nullable: true })
  preferences?: Record<string, any>;

  @Column({ type: 'json', nullable: true })
  googleTokens?: {
    accessToken: string;
    refreshToken: string;
    expiryDate: number;
    scope?: string[];
  };

  @Column({ nullable: true })
  gmailAccessToken?: string;

  @Column({ nullable: true })
  gmailRefreshToken?: string;

  @Column({ nullable: true })
  gmailTokenExpiry?: Date;

  @Column({ nullable: true })
  googleId?: string;

  @Column({ type: 'json', nullable: true })
  settings?: Record<string, any>;

  @Column({ default: 0 })
  totalEmailsProcessed: number;

  @Column({ type: 'decimal', precision: 10, scale: 4, default: 0 })
  totalAiCost: number;

  @Column({ nullable: true })
  lastSyncAt?: Date;

  @Column({ default: 0 })
  loginAttempts: number;

  @Column({ nullable: true })
  lockedUntil?: Date;

  @OneToMany(() => EmailMessage, email => email.user)
  emails: EmailMessage[];

  @OneToMany(() => AuditLog, auditLog => auditLog.user)
  auditLogs: AuditLog[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  /**
   * @method canLogin
   * @purpose Check if user can login
   */
  canLogin(): boolean {
    if (!this.isActive || this.status !== UserStatus.ACTIVE) {
      return false;
    }

    if (this.lockedUntil && this.lockedUntil > new Date()) {
      return false;
    }

    return true;
  }

  /**
   * @method isLocked
   * @purpose Check if user account is locked
   */
  isLocked(): boolean {
    return this.lockedUntil ? this.lockedUntil > new Date() : false;
  }

  /**
   * @method incrementLoginAttempts
   * @purpose Increment failed login attempts
   */
  incrementLoginAttempts(): void {
    this.loginAttempts += 1;
    
    // Lock account after 5 failed attempts for 30 minutes
    if (this.loginAttempts >= 5) {
      this.lockedUntil = new Date(Date.now() + 30 * 60 * 1000);
    }
  }

  /**
   * @method resetLoginAttempts
   * @purpose Reset failed login attempts
   */
  resetLoginAttempts(): void {
    this.loginAttempts = 0;
    this.lockedUntil = null;
  }

  /**
   * @method updateLastLogin
   * @purpose Update last login timestamp
   */
  updateLastLogin(ipAddress?: string): void {
    this.lastLoginAt = new Date();
    this.resetLoginAttempts();
    // Note: ipAddress parameter is accepted but not stored in this entity
    // It could be logged separately if needed
  }

  /**
   * @method addAiCost
   * @purpose Add AI processing cost
   */
  addAiCost(cost: number): void {
    this.totalAiCost += cost;
  }

  /**
   * @method toSafeObject
   * @purpose Return safe user object without sensitive data
   */
  toSafeObject(): Partial<User> {
    const { passwordHash, refreshToken, googleTokens, ...safeUser } = this;
    return safeUser;
  }

  /**
   * @method getDefaultPreferences
   * @purpose Get default user preferences
   */
  static getDefaultPreferences(): Record<string, any> {
    return {
      notifications: {
        email: true,
        push: true,
        digest: true,
        frequency: 'daily',
      },
      ui: {
        theme: 'light',
        language: 'en',
        timezone: 'UTC',
      },
      processing: {
        autoClassify: true,
        autoExtract: true,
        confidenceThreshold: 0.8,
      },
      privacy: {
        shareAnalytics: false,
        shareUsageData: false,
      },
    };
  }

  /**
   * @method getDefaultSettings
   * @purpose Get default user settings
   */
  static getDefaultSettings(): Record<string, any> {
    return {
      gmail: {
        syncEnabled: true,
        syncFrequency: 15, // minutes
        maxEmailsPerSync: 100,
        syncLabels: ['INBOX', 'SENT'],
      },
      ai: {
        classificationEnabled: true,
        extractionEnabled: true,
        modelPreference: 'gpt-3.5-turbo',
        maxTokens: 1000,
      },
      workflow: {
        autoApprove: false,
        requireReview: true,
        defaultPriority: 'NORMAL',
      },
      security: {
        sessionTimeout: 24, // hours
        requireMfa: false,
        allowedIpRanges: [],
      },
    };
  }
}