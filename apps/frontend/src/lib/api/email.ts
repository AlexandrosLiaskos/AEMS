import { apiClient } from './client';

// Types
interface EmailStats {
  total: number;
  unread: number;
  starred: number;
  withAttachments: number;
  byWorkflowState: Record<string, number>;
  byPriority: Record<string, number>;
  todayCount: number;
  thisWeekCount: number;
  thisMonthCount: number;
}

interface Email {
  id: string;
  gmailId: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  body: string;
  date: string;
  isRead: boolean;
  isStarred: boolean;
  priority: string;
  tags: string[];
  workflowState: string;
  classification?: {
    category: string;
    confidence: number;
    reasoning: string;
  };
  extraction?: {
    category: string;
    extractedData: Record<string, any>;
    isComplete: boolean;
  };
}

interface PaginatedEmails {
  data: Email[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

interface EmailFilters {
  workflowState?: string;
  isRead?: boolean;
  priority?: string;
  category?: string;
  tags?: string[];
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

/**
 * @namespace emailApi
 * @purpose API functions for email operations
 */
export const emailApi = {
  /**
   * Get email statistics
   */
  async getStats(): Promise<EmailStats> {
    const response = await apiClient.get('/emails/stats');
    return response.data;
  },

  /**
   * Get paginated list of emails
   */
  async getEmails(
    page: number = 1,
    limit: number = 10,
    filters: EmailFilters = {}
  ): Promise<PaginatedEmails> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      ...Object.fromEntries(
        Object.entries(filters).filter(([_, value]) => value !== undefined)
      ),
    });

    const response = await apiClient.get(`/emails?${params}`);
    return response.data;
  },

  /**
   * Get single email by ID
   */
  async getEmail(emailId: string): Promise<Email> {
    const response = await apiClient.get(`/emails/${emailId}`);
    return response.data;
  },

  /**
   * Update email properties
   */
  async updateEmail(emailId: string, updates: Partial<Email>): Promise<Email> {
    const response = await apiClient.put(`/emails/${emailId}`, updates);
    return response.data;
  },

  /**
   * Mark email as read
   */
  async markAsRead(emailId: string): Promise<{ success: boolean }> {
    const response = await apiClient.post(`/emails/${emailId}/read`);
    return response.data;
  },

  /**
   * Mark email as unread
   */
  async markAsUnread(emailId: string): Promise<{ success: boolean }> {
    const response = await apiClient.post(`/emails/${emailId}/unread`);
    return response.data;
  },

  /**
   * Star email
   */
  async starEmail(emailId: string): Promise<{ success: boolean }> {
    const response = await apiClient.post(`/emails/${emailId}/star`);
    return response.data;
  },

  /**
   * Unstar email
   */
  async unstarEmail(emailId: string): Promise<{ success: boolean }> {
    const response = await apiClient.delete(`/emails/${emailId}/star`);
    return response.data;
  },

  /**
   * Add tags to email
   */
  async addTags(emailId: string, tags: string[]): Promise<{ success: boolean }> {
    const response = await apiClient.post(`/emails/${emailId}/tags`, { tags });
    return response.data;
  },

  /**
   * Remove tags from email
   */
  async removeTags(emailId: string, tags: string[]): Promise<{ success: boolean }> {
    const response = await apiClient.delete(`/emails/${emailId}/tags`, { 
      data: { tags } 
    });
    return response.data;
  },

  /**
   * Get email attachments
   */
  async getAttachments(emailId: string): Promise<any[]> {
    const response = await apiClient.get(`/emails/${emailId}/attachments`);
    return response.data;
  },

  /**
   * Download email attachment
   */
  async downloadAttachment(
    emailId: string, 
    attachmentId: string
  ): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.post(
      `/emails/${emailId}/attachments/${attachmentId}/download`
    );
    return response.data;
  },

  /**
   * Search emails
   */
  async searchEmails(
    query: string,
    page: number = 1,
    limit: number = 10
  ): Promise<PaginatedEmails> {
    const params = new URLSearchParams({
      search: query,
      page: page.toString(),
      limit: limit.toString(),
    });

    const response = await apiClient.get(`/emails?${params}`);
    return response.data;
  },

  /**
   * GraphQL queries
   */
  graphql: {
    /**
     * Get email statistics via GraphQL
     */
    async getStats(): Promise<EmailStats> {
      const query = `
        query GetEmailStats {
          getEmailStats {
            total
            unread
            starred
            withAttachments
            byWorkflowState
            byPriority
            todayCount
            thisWeekCount
            thisMonthCount
          }
        }
      `;

      const response = await apiClient.post('/graphql', { query });
      return response.data.data.getEmailStats;
    },

    /**
     * Get emails via GraphQL
     */
    async getEmails(
      page: number = 1,
      limit: number = 10,
      filters: EmailFilters = {}
    ): Promise<PaginatedEmails> {
      const query = `
        query GetEmails($page: Int!, $limit: Int!, $filters: EmailFiltersDto) {
          getEmails(page: $page, limit: $limit, filters: $filters) {
            data {
              id
              gmailId
              subject
              from
              to
              body
              date
              isRead
              isStarred
              priority
              tags
              workflowState
              classification {
                category
                confidence
                reasoning
              }
              extraction {
                category
                extractedData
                isComplete
              }
            }
            total
            page
            limit
            totalPages
            hasNext
            hasPrevious
          }
        }
      `;

      const response = await apiClient.post('/graphql', {
        query,
        variables: { page, limit, filters },
      });

      return response.data.data.getEmails;
    },
  },
};