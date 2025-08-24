import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { gmail_v1 } from 'googleapis';
import * as he from 'he';

// Entities
import { 
  EmailMessage, 
  WorkflowState, 
  Priority, 
  EmailAddress, 
  EmailHeaders, 
  EmailMetadata 
} from '../../../database/entities/email-message.entity';

// Services
import { LoggerService } from '../../../common/services/logger.service';

// Types
import { GmailMessage } from './gmail.service';

/**
 * @interface ParsedAttachment
 * @purpose Parsed attachment information
 */
export interface ParsedAttachment {
  gmailAttachmentId: string;
  filename: string;
  mimeType: string;
  size: number;
  contentId?: string;
  isInline: boolean;
}

/**
 * @class EmailParserService
 * @purpose Service for parsing Gmail messages into EmailMessage entities
 */
@Injectable()
export class EmailParserService {
  constructor(
    private configService: ConfigService,
    private logger: LoggerService
  ) {}

  /**
   * @method parseGmailMessage
   * @purpose Parse Gmail message into EmailMessage entity
   */
  async parseGmailMessage(gmailMessage: GmailMessage, userId: string): Promise<EmailMessage> {
    try {
      const email = new EmailMessage();

      // Basic message info
      email.gmailId = gmailMessage.id;
      email.threadId = gmailMessage.threadId;
      email.snippet = this.cleanSnippet(gmailMessage.snippet);
      email.userId = userId;
      email.workflowState = WorkflowState.FETCHED;
      email.priority = Priority.NORMAL;
      email.labels = gmailMessage.labelIds || [];
      email.receivedAt = new Date(parseInt(gmailMessage.internalDate));
      email.fetchedAt = new Date();

      // Parse headers and payload
      const headers = this.parseHeaders(gmailMessage.payload.headers || []);
      const { subject, from, to, cc, bcc } = this.parseAddresses(headers);
      const { bodyText, bodyHtml } = this.parseBody(gmailMessage.payload);
      const attachments = this.parseAttachments(gmailMessage.payload);

      // Set parsed data
      email.subject = subject || '(No Subject)';
      email.from = from;
      email.to = to;
      email.cc = cc;
      email.bcc = bcc;
      email.bodyText = bodyText;
      email.bodyHtml = bodyHtml;
      email.headers = headers;

      // Set metadata
      email.metadata = this.buildMetadata(gmailMessage, attachments);

      // Determine priority from headers and content
      email.priority = this.determinePriority(headers, email.subject, bodyText);

      // Set read status based on labels
      email.isRead = !gmailMessage.labelIds?.includes('UNREAD');
      email.isStarred = gmailMessage.labelIds?.includes('STARRED') || false;
      email.isImportant = gmailMessage.labelIds?.includes('IMPORTANT') || false;

      // Parse custom fields from headers
      email.customFields = this.parseCustomFields(headers);

      this.logger.debug(
        `Parsed Gmail message ${gmailMessage.id}`,
        'EmailParserService',
        {
          gmailId: gmailMessage.id,
          subject: email.subject,
          from: email.from.email,
          attachmentCount: attachments.length,
        }
      );

      return email;
    } catch (error) {
      this.logger.error(
        `Failed to parse Gmail message ${gmailMessage.id}`,
        error.stack,
        'EmailParserService'
      );
      throw error;
    }
  }

  /**
   * @method parseHeaders
   * @purpose Parse Gmail headers into structured format
   */
  private parseHeaders(headers: gmail_v1.Schema$MessagePartHeader[]): EmailHeaders {
    const headerMap: Record<string, string> = {};
    
    headers.forEach(header => {
      if (header.name && header.value) {
        headerMap[header.name.toLowerCase()] = header.value;
      }
    });

    return {
      messageId: headerMap['message-id'] || '',
      references: headerMap['references']?.split(/\s+/).filter(Boolean) || [],
      inReplyTo: headerMap['in-reply-to'] || undefined,
      date: headerMap['date'] || '',
      deliveredTo: headerMap['delivered-to'] || undefined,
      returnPath: headerMap['return-path'] || undefined,
      ...headerMap,
    };
  }

  /**
   * @method parseAddresses
   * @purpose Parse email addresses from headers
   */
  private parseAddresses(headers: EmailHeaders): {
    subject: string;
    from: EmailAddress;
    to: EmailAddress[];
    cc: EmailAddress[];
    bcc: EmailAddress[];
  } {
    return {
      subject: headers['subject'] || '',
      from: this.parseEmailAddress(headers['from'] || ''),
      to: this.parseEmailAddressList(headers['to'] || ''),
      cc: this.parseEmailAddressList(headers['cc'] || ''),
      bcc: this.parseEmailAddressList(headers['bcc'] || ''),
    };
  }

  /**
   * @method parseEmailAddress
   * @purpose Parse single email address
   */
  public parseEmailAddress(addressString: string): EmailAddress {
    if (!addressString) {
      return { email: '', name: '' };
    }

    // Handle formats like "Name <email@domain.com>" or just "email@domain.com"
    const match = addressString.match(/^(.+?)\s*<(.+?)>$/) || 
                  addressString.match(/^(.+)$/);

    if (!match) {
      return { email: addressString.trim(), name: '' };
    }

    if (match.length === 3) {
      // "Name <email>" format
      return {
        name: this.cleanDisplayName(match[1]),
        email: match[2].trim(),
      };
    } else {
      // Just email format
      const email = match[1].trim();
      return {
        email,
        name: this.extractNameFromEmail(email),
      };
    }
  }

  /**
   * @method parseEmailAddressList
   * @purpose Parse comma-separated email address list
   */
  public parseEmailAddressList(addressString: string): EmailAddress[] {
    if (!addressString) {
      return [];
    }

    // Split by comma, but be careful with commas inside quoted names
    const addresses: string[] = [];
    let current = '';
    let inQuotes = false;
    let inBrackets = false;

    for (let i = 0; i < addressString.length; i++) {
      const char = addressString[i];
      
      if (char === '"' && !inBrackets) {
        inQuotes = !inQuotes;
      } else if (char === '<' && !inQuotes) {
        inBrackets = true;
      } else if (char === '>' && !inQuotes) {
        inBrackets = false;
      } else if (char === ',' && !inQuotes && !inBrackets) {
        addresses.push(current.trim());
        current = '';
        continue;
      }
      
      current += char;
    }
    
    if (current.trim()) {
      addresses.push(current.trim());
    }

    return addresses.map(addr => this.parseEmailAddress(addr)).filter(addr => addr.email);
  }

  /**
   * @method parseBody
   * @purpose Parse email body content
   */
  private parseBody(payload: gmail_v1.Schema$MessagePart): {
    bodyText: string;
    bodyHtml: string;
  } {
    let bodyText = '';
    let bodyHtml = '';

    const extractBody = (part: gmail_v1.Schema$MessagePart) => {
      if (part.body?.data) {
        const content = Buffer.from(part.body.data, 'base64').toString('utf-8');
        
        if (part.mimeType === 'text/plain') {
          bodyText = content;
        } else if (part.mimeType === 'text/html') {
          bodyHtml = content;
        }
      }

      if (part.parts) {
        part.parts.forEach(subPart => extractBody(subPart));
      }
    };

    extractBody(payload);

    // Clean up HTML content
    if (bodyHtml) {
      bodyHtml = this.cleanHtmlContent(bodyHtml);
    }

    // If no plain text but we have HTML, convert HTML to text
    if (!bodyText && bodyHtml) {
      bodyText = this.htmlToText(bodyHtml);
    }

    return { bodyText, bodyHtml };
  }

  /**
   * @method parseAttachments
   * @purpose Parse email attachments
   */
  private parseAttachments(payload: gmail_v1.Schema$MessagePart): ParsedAttachment[] {
    const attachments: ParsedAttachment[] = [];

    const extractAttachments = (part: gmail_v1.Schema$MessagePart) => {
      if (part.filename && part.body?.attachmentId) {
        attachments.push({
          gmailAttachmentId: part.body.attachmentId,
          filename: part.filename,
          mimeType: part.mimeType || 'application/octet-stream',
          size: part.body.size || 0,
          contentId: part.headers?.find(h => h.name?.toLowerCase() === 'content-id')?.value,
          isInline: part.headers?.some(h => 
            h.name?.toLowerCase() === 'content-disposition' && 
            h.value?.toLowerCase().includes('inline')
          ) || false,
        });
      }

      if (part.parts) {
        part.parts.forEach(subPart => extractAttachments(subPart));
      }
    };

    extractAttachments(payload);
    return attachments;
  }

  /**
   * @method buildMetadata
   * @purpose Build email metadata
   */
  private buildMetadata(
    gmailMessage: GmailMessage, 
    attachments: ParsedAttachment[]
  ): EmailMetadata {
    return {
      size: gmailMessage.sizeEstimate || 0,
      hasAttachments: attachments.length > 0,
      attachmentCount: attachments.length,
      isEncrypted: false, // TODO: Detect encryption
      isMultipart: true, // Gmail messages are typically multipart
      contentType: 'multipart/mixed',
      encoding: 'utf-8',
    };
  }

  /**
   * @method determinePriority
   * @purpose Determine email priority from headers and content
   */
  private determinePriority(
    headers: EmailHeaders,
    subject: string,
    bodyText: string
  ): Priority {
    // Check priority headers
    const priority = headers['x-priority'] || headers['priority'] || headers['importance'];
    
    if (priority) {
      const priorityLower = priority.toLowerCase();
      if (priorityLower.includes('high') || priorityLower.includes('urgent') || priorityLower === '1') {
        return Priority.URGENT;
      }
      if (priorityLower.includes('low') || priorityLower === '5') {
        return Priority.LOW;
      }
    }

    // Check subject for urgency indicators
    const urgentKeywords = [
      'urgent', 'asap', 'emergency', 'critical', 'immediate',
      'rush', 'priority', 'important', '!!!', 'action required'
    ];

    const subjectLower = subject.toLowerCase();
    if (urgentKeywords.some(keyword => subjectLower.includes(keyword))) {
      return Priority.HIGH;
    }

    // Check for automated/newsletter indicators (lower priority)
    const automatedKeywords = [
      'newsletter', 'unsubscribe', 'no-reply', 'noreply',
      'automated', 'notification', 'alert', 'digest'
    ];

    if (automatedKeywords.some(keyword => subjectLower.includes(keyword))) {
      return Priority.LOW;
    }

    return Priority.NORMAL;
  }

  /**
   * @method parseCustomFields
   * @purpose Parse custom fields from headers
   */
  private parseCustomFields(headers: EmailHeaders): Record<string, any> {
    const customFields: Record<string, any> = {};

    // Extract useful custom headers
    const customHeaderPrefixes = ['x-', 'list-'];
    
    Object.entries(headers).forEach(([key, value]) => {
      if (customHeaderPrefixes.some(prefix => key.startsWith(prefix))) {
        customFields[key] = value;
      }
    });

    return customFields;
  }

  /**
   * @method cleanSnippet
   * @purpose Clean email snippet
   */
  private cleanSnippet(snippet: string): string {
    if (!snippet) return '';
    
    return he.decode(snippet)
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 200);
  }

  /**
   * @method cleanDisplayName
   * @purpose Clean display name from email address
   */
  private cleanDisplayName(name: string): string {
    return he.decode(name)
      .replace(/^["']|["']$/g, '')
      .trim();
  }

  /**
   * @method extractNameFromEmail
   * @purpose Extract name from email address
   */
  private extractNameFromEmail(email: string): string {
    const localPart = email.split('@')[0];
    return localPart
      .replace(/[._-]/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase())
      .trim();
  }

  /**
   * @method cleanHtmlContent
   * @purpose Clean HTML content
   */
  private cleanHtmlContent(html: string): string {
    // Basic HTML cleaning - in production, use a proper HTML sanitizer
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .trim();
  }

  /**
   * @method htmlToText
   * @purpose Convert HTML to plain text
   */
  private htmlToText(html: string): string {
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }
}