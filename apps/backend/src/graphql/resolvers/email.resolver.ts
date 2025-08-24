import { Resolver, Query, Mutation, Args, Subscription, Context } from '@nestjs/graphql';
import { UseGuards, BadRequestException } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions, Like, In } from 'typeorm';

// Guards
import { JwtAuthGuard } from '../../modules/auth/guards/jwt-auth.guard';

// Services
import { GmailService } from '../../modules/gmail/services/gmail.service';
import { AIService } from '../../modules/ai/services/ai.service';

// Entities
import { 
  EmailMessage, 
  WorkflowState, 
  Priority, 
  EmailAddress 
} from '../../database/entities/email-message.entity';
import { User } from '../../database/entities/user.entity';

// Decorators
import { CurrentUser } from '../../modules/auth/decorators/current-user.decorator';

// Types
import { ObjectType, Field, ID, Int, InputType, ArgsType } from '@nestjs/graphql';

/**
 * @class EmailAddressType
 * @purpose GraphQL type for email addresses
 */
@ObjectType()
class EmailAddressType {
  @Field()
  email: string;

  @Field({ nullable: true })
  name?: string;
}

/**
 * @class EmailMetadataType
 * @purpose GraphQL type for email metadata
 */
@ObjectType()
class EmailMetadataType {
  @Field(() => Int)
  size: number;

  @Field()
  hasAttachments: boolean;

  @Field(() => Int)
  attachmentCount: number;

  @Field()
  isEncrypted: boolean;

  @Field()
  isMultipart: boolean;

  @Field()
  contentType: string;

  @Field()
  encoding: string;

  @Field({ nullable: true })
  spamScore?: number;

  @Field({ nullable: true })
  virusStatus?: string;
}

/**
 * @class EmailType
 * @purpose GraphQL type for Email entity
 */
@ObjectType()
class EmailType {
  @Field(() => ID)
  id: string;

  @Field()
  gmailId: string;

  @Field()
  threadId: string;

  @Field()
  subject: string;

  @Field(() => EmailAddressType)
  from: EmailAddressType;

  @Field(() => [EmailAddressType])
  to: EmailAddressType[];

  @Field(() => [EmailAddressType], { nullable: true })
  cc?: EmailAddressType[];

  @Field(() => [EmailAddressType], { nullable: true })
  bcc?: EmailAddressType[];

  @Field({ nullable: true })
  bodyText?: string;

  @Field({ nullable: true })
  bodyHtml?: string;

  @Field()
  snippet: string;

  @Field()
  workflowState: string;

  @Field()
  priority: string;

  @Field()
  isRead: boolean;

  @Field()
  isStarred: boolean;

  @Field()
  isImportant: boolean;

  @Field(() => [String])
  labels: string[];

  @Field(() => [String])
  tags: string[];

  @Field(() => EmailMetadataType, { nullable: true })
  metadata?: EmailMetadataType;

  @Field()
  receivedAt: Date;

  @Field()
  fetchedAt: Date;

  @Field({ nullable: true })
  processedAt?: Date;

  @Field({ nullable: true })
  reviewedAt?: Date;

  @Field({ nullable: true })
  reviewedBy?: string;

  @Field({ nullable: true })
  reviewNotes?: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  // Relations (will be resolved separately)
  @Field({ nullable: true })
  classification?: any;

  @Field({ nullable: true })
  extraction?: any;

  @Field(() => [String])
  attachments: string[];
}

/**
 * @class EmailFiltersInput
 * @purpose GraphQL input for email filtering
 */
@InputType()
class EmailFiltersInput {
  @Field({ nullable: true })
  search?: string;

  @Field({ nullable: true })
  from?: string;

  @Field({ nullable: true })
  to?: string;

  @Field({ nullable: true })
  subject?: string;

  @Field(() => [String], { nullable: true })
  workflowStates?: string[];

  @Field(() => [String], { nullable: true })
  priorities?: string[];

  @Field(() => [String], { nullable: true })
  labels?: string[];

  @Field(() => [String], { nullable: true })
  tags?: string[];

  @Field({ nullable: true })
  hasAttachments?: boolean;

  @Field({ nullable: true })
  isRead?: boolean;

  @Field({ nullable: true })
  isStarred?: boolean;

  @Field({ nullable: true })
  isImportant?: boolean;

  @Field({ nullable: true })
  dateFrom?: Date;

  @Field({ nullable: true })
  dateTo?: Date;
}

/**
 * @class EmailSortInput
 * @purpose GraphQL input for email sorting
 */
@InputType()
class EmailSortInput {
  @Field({ defaultValue: 'receivedAt' })
  field: string;

  @Field({ defaultValue: 'DESC' })
  direction: string;
}

/**
 * @class EmailPaginationInput
 * @purpose GraphQL input for email pagination
 */
@InputType()
class EmailPaginationInput {
  @Field(() => Int, { defaultValue: 0 })
  offset: number;

  @Field(() => Int, { defaultValue: 20 })
  limit: number;
}

/**
 * @class EmailListResponse
 * @purpose GraphQL response for email list
 */
@ObjectType()
class EmailListResponse {
  @Field(() => [EmailType])
  emails: EmailType[];

  @Field(() => Int)
  total: number;

  @Field(() => Int)
  offset: number;

  @Field(() => Int)
  limit: number;

  @Field()
  hasMore: boolean;
}

/**
 * @class EmailStatsType
 * @purpose GraphQL type for email statistics
 */
@ObjectType()
class EmailStatsType {
  @Field(() => Int)
  total: number;

  @Field(() => Int)
  unread: number;

  @Field(() => Int)
  starred: number;

  @Field(() => Int)
  important: number;

  @Field(() => Int)
  withAttachments: number;

  @Field(() => Int)
  needsReview: number;

  @Field(() => Int)
  processed: number;

  @Field(() => Int)
  archived: number;
}

/**
 * @class EmailResolver
 * @purpose GraphQL resolver for Email operations
 */
@Resolver(() => EmailType)
@UseGuards(JwtAuthGuard)
export class EmailResolver {
  private pubSub: PubSub = new PubSub();

  constructor(
    @InjectRepository(EmailMessage)
    private emailRepository: Repository<EmailMessage>,
    private gmailService: GmailService,
    private aiService: AIService
  ) {}

  /**
   * @method emails
   * @purpose Get paginated list of emails with filtering and sorting
   */
  @Query(() => EmailListResponse, { description: 'Get paginated list of emails' })
  async emails(
    @CurrentUser() user: User,
    @Args('filters', { nullable: true }) filters?: EmailFiltersInput,
    @Args('sort', { nullable: true }) sort?: EmailSortInput,
    @Args('pagination', { nullable: true }) pagination?: EmailPaginationInput
  ): Promise<EmailListResponse> {
    const { offset = 0, limit = 20 } = pagination || {};
    const { field = 'receivedAt', direction = 'DESC' } = sort || {};

    // Build query options
    const queryOptions: FindManyOptions<EmailMessage> = {
      where: { userId: user.id },
      order: { [field]: direction as 'ASC' | 'DESC' },
      skip: offset,
      take: Math.min(limit, 100), // Max 100 items per page
      relations: ['classification', 'extraction', 'attachments'],
    };

    // Apply filters
    if (filters) {
      const where: any = { userId: user.id };

      if (filters.search) {
        where.subject = Like(`%${filters.search}%`);
      }

      if (filters.from) {
        // TODO: Implement JSON field search for from.email
      }

      if (filters.workflowStates?.length) {
        where.workflowState = In(filters.workflowStates);
      }

      if (filters.priorities?.length) {
        where.priority = In(filters.priorities);
      }

      if (filters.hasAttachments !== undefined) {
        // TODO: Implement metadata.hasAttachments filter
      }

      if (filters.isRead !== undefined) {
        where.isRead = filters.isRead;
      }

      if (filters.isStarred !== undefined) {
        where.isStarred = filters.isStarred;
      }

      if (filters.isImportant !== undefined) {
        where.isImportant = filters.isImportant;
      }

      if (filters.dateFrom || filters.dateTo) {
        where.receivedAt = {};
        if (filters.dateFrom) {
          where.receivedAt.gte = filters.dateFrom;
        }
        if (filters.dateTo) {
          where.receivedAt.lte = filters.dateTo;
        }
      }

      queryOptions.where = where;
    }

    // Execute query
    const [emails, total] = await this.emailRepository.findAndCount(queryOptions);

    // Transform to GraphQL types
    const emailTypes = emails.map(email => this.transformEmailToType(email));

    return {
      emails: emailTypes,
      total,
      offset,
      limit,
      hasMore: offset + limit < total,
    };
  }

  /**
   * @method email
   * @purpose Get single email by ID
   */
  @Query(() => EmailType, { description: 'Get single email by ID' })
  async email(
    @CurrentUser() user: User,
    @Args('id') id: string
  ): Promise<EmailType> {
    const email = await this.emailRepository.findOne({
      where: { id, userId: user.id },
      relations: ['classification', 'extraction', 'attachments'],
    });

    if (!email) {
      throw new BadRequestException('Email not found');
    }

    return this.transformEmailToType(email);
  }

  /**
   * @method emailStats
   * @purpose Get email statistics
   */
  @Query(() => EmailStatsType, { description: 'Get email statistics' })
  async emailStats(@CurrentUser() user: User): Promise<EmailStatsType> {
    const baseQuery = this.emailRepository
      .createQueryBuilder('email')
      .where('email.userId = :userId', { userId: user.id });

    const [
      total,
      unread,
      starred,
      important,
      withAttachments,
      needsReview,
      processed,
      archived,
    ] = await Promise.all([
      baseQuery.getCount(),
      baseQuery.clone().andWhere('email.isRead = false').getCount(),
      baseQuery.clone().andWhere('email.isStarred = true').getCount(),
      baseQuery.clone().andWhere('email.isImportant = true').getCount(),
      baseQuery.clone().andWhere("JSON_EXTRACT(email.metadata, '$.hasAttachments') = true").getCount(),
      baseQuery.clone().andWhere('email.workflowState = :state', { state: WorkflowState.REVIEW }).getCount(),
      baseQuery.clone().andWhere('email.processedAt IS NOT NULL').getCount(),
      baseQuery.clone().andWhere('email.workflowState = :state', { state: WorkflowState.ARCHIVED }).getCount(),
    ]);

    return {
      total,
      unread,
      starred,
      important,
      withAttachments,
      needsReview,
      processed,
      archived,
    };
  }

  /**
   * @method markAsRead
   * @purpose Mark email as read
   */
  @Mutation(() => EmailType, { description: 'Mark email as read' })
  async markAsRead(
    @CurrentUser() user: User,
    @Args('id') id: string
  ): Promise<EmailType> {
    const email = await this.emailRepository.findOne({
      where: { id, userId: user.id },
    });

    if (!email) {
      throw new BadRequestException('Email not found');
    }

    email.markAsRead();
    await this.emailRepository.save(email);

    // Publish subscription event
    this.pubSub.publish('emailUpdated', {
      emailUpdated: this.transformEmailToType(email),
      userId: user.id,
    });

    return this.transformEmailToType(email);
  }

  /**
   * @method markAsUnread
   * @purpose Mark email as unread
   */
  @Mutation(() => EmailType, { description: 'Mark email as unread' })
  async markAsUnread(
    @CurrentUser() user: User,
    @Args('id') id: string
  ): Promise<EmailType> {
    const email = await this.emailRepository.findOne({
      where: { id, userId: user.id },
    });

    if (!email) {
      throw new BadRequestException('Email not found');
    }

    email.markAsUnread();
    await this.emailRepository.save(email);

    // Publish subscription event
    this.pubSub.publish('emailUpdated', {
      emailUpdated: this.transformEmailToType(email),
      userId: user.id,
    });

    return this.transformEmailToType(email);
  }

  /**
   * @method toggleStar
   * @purpose Toggle email star status
   */
  @Mutation(() => EmailType, { description: 'Toggle email star status' })
  async toggleStar(
    @CurrentUser() user: User,
    @Args('id') id: string
  ): Promise<EmailType> {
    const email = await this.emailRepository.findOne({
      where: { id, userId: user.id },
    });

    if (!email) {
      throw new BadRequestException('Email not found');
    }

    email.toggleStar();
    await this.emailRepository.save(email);

    // Publish subscription event
    this.pubSub.publish('emailUpdated', {
      emailUpdated: this.transformEmailToType(email),
      userId: user.id,
    });

    return this.transformEmailToType(email);
  }

  /**
   * @method setPriority
   * @purpose Set email priority
   */
  @Mutation(() => EmailType, { description: 'Set email priority' })
  async setPriority(
    @CurrentUser() user: User,
    @Args('id') id: string,
    @Args('priority') priority: Priority
  ): Promise<EmailType> {
    const email = await this.emailRepository.findOne({
      where: { id, userId: user.id },
    });

    if (!email) {
      throw new BadRequestException('Email not found');
    }

    email.setPriority(priority);
    await this.emailRepository.save(email);

    // Publish subscription event
    this.pubSub.publish('emailUpdated', {
      emailUpdated: this.transformEmailToType(email),
      userId: user.id,
    });

    return this.transformEmailToType(email);
  }

  /**
   * @method addTag
   * @purpose Add tag to email
   */
  @Mutation(() => EmailType, { description: 'Add tag to email' })
  async addTag(
    @CurrentUser() user: User,
    @Args('id') id: string,
    @Args('tag') tag: string
  ): Promise<EmailType> {
    const email = await this.emailRepository.findOne({
      where: { id, userId: user.id },
    });

    if (!email) {
      throw new BadRequestException('Email not found');
    }

    email.addTag(tag);
    await this.emailRepository.save(email);

    // Publish subscription event
    this.pubSub.publish('emailUpdated', {
      emailUpdated: this.transformEmailToType(email),
      userId: user.id,
    });

    return this.transformEmailToType(email);
  }

  /**
   * @method removeTag
   * @purpose Remove tag from email
   */
  @Mutation(() => EmailType, { description: 'Remove tag from email' })
  async removeTag(
    @CurrentUser() user: User,
    @Args('id') id: string,
    @Args('tag') tag: string
  ): Promise<EmailType> {
    const email = await this.emailRepository.findOne({
      where: { id, userId: user.id },
    });

    if (!email) {
      throw new BadRequestException('Email not found');
    }

    email.removeTag(tag);
    await this.emailRepository.save(email);

    // Publish subscription event
    this.pubSub.publish('emailUpdated', {
      emailUpdated: this.transformEmailToType(email),
      userId: user.id,
    });

    return this.transformEmailToType(email);
  }

  /**
   * @method processEmail
   * @purpose Process email with AI
   */
  @Mutation(() => Boolean, { description: 'Process email with AI' })
  async processEmail(
    @CurrentUser() user: User,
    @Args('id') id: string
  ): Promise<boolean> {
    await this.aiService.processEmail(id, user.id);
    return true;
  }

  /**
   * @method archiveEmail
   * @purpose Archive email
   */
  @Mutation(() => EmailType, { description: 'Archive email' })
  async archiveEmail(
    @CurrentUser() user: User,
    @Args('id') id: string
  ): Promise<EmailType> {
    const email = await this.emailRepository.findOne({
      where: { id, userId: user.id },
    });

    if (!email) {
      throw new BadRequestException('Email not found');
    }

    email.transitionTo(WorkflowState.ARCHIVED, 'Manually archived', user.id);
    await this.emailRepository.save(email);

    // Publish subscription event
    this.pubSub.publish('emailUpdated', {
      emailUpdated: this.transformEmailToType(email),
      userId: user.id,
    });

    return this.transformEmailToType(email);
  }

  /**
   * @method emailUpdated
   * @purpose Subscription for email updates
   */
  @Subscription(() => EmailType, {
    description: 'Subscribe to email updates',
    filter: (payload, variables, context) => {
      return payload.userId === context.req.user.id;
    },
  })
  emailUpdated(@Context() context: any) {
    return (this.pubSub as any).asyncIterator('emailUpdated');
  }

  /**
   * @method parseEmailAddress
   * @purpose Parse email address string to EmailAddressType
   */
  private parseEmailAddress(address: string | EmailAddress): EmailAddressType {
    if (typeof address === 'string') {
      // Parse "Name <email@domain.com>" format
      const match = address.match(/^(.+?)\s*<(.+?)>$/) || address.match(/^(.+)$/);
      if (match) {
        if (match[2]) {
          return { name: match[1].trim(), email: match[2].trim() };
        } else {
          return { email: match[1].trim() };
        }
      }
      return { email: address };
    }
    return { email: address.email, name: address.name };
  }

  /**
   * @method parseEmailAddresses
   * @purpose Parse email addresses string/array to EmailAddressType array
   */
  private parseEmailAddresses(addresses: string | string[] | EmailAddress[]): EmailAddressType[] {
    if (typeof addresses === 'string') {
      // Split by comma and parse each
      return addresses.split(',').map(addr => this.parseEmailAddress(addr.trim()));
    }
    if (Array.isArray(addresses)) {
      return addresses.map(addr => this.parseEmailAddress(addr));
    }
    return [];
  }

  /**
   * @method transformEmailToType
   * @purpose Transform EmailMessage entity to GraphQL type
   */
  private transformEmailToType(email: EmailMessage): EmailType {
    return {
      id: email.id,
      gmailId: email.gmailId,
      threadId: email.threadId,
      subject: email.subject,
      from: this.parseEmailAddress(email.from),
      to: this.parseEmailAddresses(email.to),
      cc: email.cc ? this.parseEmailAddresses(email.cc) : undefined,
      bcc: email.bcc ? this.parseEmailAddresses(email.bcc) : undefined,
      bodyText: email.bodyText,
      bodyHtml: email.bodyHtml,
      snippet: email.snippet,
      workflowState: email.workflowState,
      priority: email.priority,
      isRead: email.isRead,
      isStarred: email.isStarred,
      isImportant: email.isImportant,
      labels: email.labels,
      tags: email.tags,
      metadata: email.metadata as EmailMetadataType,
      receivedAt: email.receivedAt,
      fetchedAt: email.fetchedAt,
      processedAt: email.processedAt,
      reviewedAt: email.reviewedAt,
      reviewedBy: email.reviewedBy,
      reviewNotes: email.reviewNotes,
      createdAt: email.createdAt,
      updatedAt: email.updatedAt,
      classification: email.classification,
      extraction: email.extraction,
      attachments: [], // TODO: Transform attachments
    };
  }
}