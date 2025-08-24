# API Integration

## GraphQL Integration

### Apollo Client Configuration
```typescript
// Apollo Client setup with authentication and error handling
const httpLink = createHttpLink({
  uri: process.env.VITE_GRAPHQL_ENDPOINT || 'http://localhost:8080/graphql',
  credentials: 'include', // Include cookies for authentication
});

const authLink = setContext((_, { headers }) => {
  const token = tokenStorage.getAccessToken();
  
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
    },
  };
});

const errorLink = onError(({ graphQLErrors, networkError, operation, forward }) => {
  if (graphQLErrors) {
    graphQLErrors.forEach(({ message, locations, path, extensions }) => {
      console.error(
        `GraphQL error: Message: ${message}, Location: ${locations}, Path: ${path}`
      );
      
      // Handle specific error types
      if (extensions?.code === 'UNAUTHENTICATED') {
        // Token expired, try to refresh
        return handleTokenRefresh(operation, forward);
      }
      
      if (extensions?.code === 'FORBIDDEN') {
        // Insufficient permissions
        useUIStore.getState().addNotification({
          type: 'error',
          title: 'Access Denied',
          message: 'You do not have permission to perform this action',
          duration: 5000,
        });
      }
    });
  }
  
  if (networkError) {
    console.error(`Network error: ${networkError}`);
    
    // Handle network errors
    if ('statusCode' in networkError) {
      const statusCode = networkError.statusCode;
      
      if (statusCode === 401) {
        // Unauthorized, logout user
        useAuthStore.getState().logout();
      } else if (statusCode >= 500) {
        // Server error
        useUIStore.getState().addNotification({
          type: 'error',
          title: 'Server Error',
          message: 'Something went wrong on our end. Please try again later.',
          duration: 5000,
        });
      }
    }
  }
});

// Token refresh handler
async function handleTokenRefresh(operation: Operation, forward: NextLink) {
  try {
    await useAuthStore.getState().refreshToken();
    
    // Retry the operation with new token
    const token = tokenStorage.getAccessToken();
    operation.setContext({
      headers: {
        ...operation.getContext().headers,
        authorization: token ? `Bearer ${token}` : '',
      },
    });
    
    return forward(operation);
  } catch (error) {
    // Refresh failed, logout user
    useAuthStore.getState().logout();
    throw error;
  }
}

// WebSocket link for subscriptions
const wsLink = new GraphQLWsLink(createClient({
  url: process.env.VITE_GRAPHQL_WS_ENDPOINT || 'ws://localhost:8080/graphql',
  connectionParams: () => {
    const token = tokenStorage.getAccessToken();
    return {
      authorization: token ? `Bearer ${token}` : '',
    };
  },
}));

// Split link for HTTP and WebSocket
const splitLink = split(
  ({ query }) => {
    const definition = getMainDefinition(query);
    return (
      definition.kind === 'OperationDefinition' &&
      definition.operation === 'subscription'
    );
  },
  wsLink,
  from([errorLink, authLink, httpLink])
);

// Apollo Client instance
export const apolloClient = new ApolloClient({
  link: splitLink,
  cache: new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          emails: {
            keyArgs: ['filter'],
            merge(existing, incoming, { args }) {
              const { pagination } = args || {};
              
              if (!existing || !pagination?.after) {
                return incoming;
              }
              
              // Merge paginated results
              return {
                ...incoming,
                edges: [...existing.edges, ...incoming.edges],
              };
            },
          },
        },
      },
      Email: {
        fields: {
          classification: {
            merge: true,
          },
          extraction: {
            merge: true,
          },
        },
      },
    },
  }),
  defaultOptions: {
    watchQuery: {
      errorPolicy: 'all',
      notifyOnNetworkStatusChange: true,
    },
    query: {
      errorPolicy: 'all',
    },
    mutate: {
      errorPolicy: 'all',
    },
  },
});
```

### GraphQL Operations

#### Query Operations
```typescript
// Email queries
export const GET_EMAILS = gql`
  query GetEmails($filter: EmailFilter, $pagination: PaginationInput) {
    emails(filter: $filter, pagination: $pagination) {
      edges {
        node {
          id
          gmailId
          subject
          from {
            email
            name
          }
          to {
            email
            name
          }
          snippet
          workflowState
          priority
          isRead
          isStarred
          receivedAt
          classification {
            id
            category
            confidence
            reasoning
          }
          attachments {
            id
            filename
            mimeType
            size
            isInline
          }
          tags
        }
        cursor
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
      totalCount
    }
  }
`;

export const GET_EMAIL = gql`
  query GetEmail($id: ID!) {
    email(id: $id) {
      id
      gmailId
      threadId
      subject
      from {
        email
        name
      }
      to {
        email
        name
      }
      cc {
        email
        name
      }
      bodyText
      bodyHtml
      snippet
      workflowState
      priority
      isRead
      isStarred
      labels
      receivedAt
      fetchedAt
      processedAt
      classification {
        id
        category
        confidence
        reasoning
        modelVersion
        isManualOverride
        overrideReason
        createdAt
      }
      extraction {
        id
        category
        extractedData
        confidence
        schema
        modelVersion
        isValidated
        validationFeedback
        createdAt
      }
      attachments {
        id
        filename
        mimeType
        size
        contentId
        isInline
        downloadUrl
        processedAt
      }
      tags
      notes
      createdAt
      updatedAt
    }
  }
`;

export const SEARCH_EMAILS = gql`
  query SearchEmails($query: String!, $filters: EmailFilter) {
    emailSearch(query: $query, filters: $filters) {
      id
      subject
      snippet
      from {
        email
        name
      }
      receivedAt
      workflowState
      classification {
        category
        confidence
      }
    }
  }
`;

export const GET_EMAIL_STATS = gql`
  query GetEmailStats($filter: EmailFilter) {
    emailStats(filter: $filter) {
      totalCount
      unreadCount
      categoryBreakdown {
        category
        count
      }
      priorityBreakdown {
        priority
        count
      }
      workflowBreakdown {
        state
        count
      }
      recentActivity {
        date
        count
      }
    }
  }
`;
```

#### Mutation Operations
```typescript
// Email mutations
export const UPDATE_EMAIL = gql`
  mutation UpdateEmail($id: ID!, $input: UpdateEmailInput!) {
    updateEmail(id: $id, input: $input) {
      id
      subject
      priority
      tags
      notes
      isStarred
      updatedAt
    }
  }
`;

export const BULK_UPDATE_EMAILS = gql`
  mutation BulkUpdateEmails($ids: [ID!]!, $input: BulkUpdateInput!) {
    bulkUpdateEmails(ids: $ids, input: $input) {
      success
      totalRequested
      totalProcessed
      totalSucceeded
      totalFailed
      errors {
        id
        error
        details
      }
    }
  }
`;

export const TRANSITION_EMAIL_STATE = gql`
  mutation TransitionEmailState($emailId: ID!, $newState: WorkflowState!, $reason: String) {
    transitionEmailState(emailId: $emailId, newState: $newState, reason: $reason) {
      id
      workflowState
      updatedAt
    }
  }
`;

export const SYNC_EMAILS = gql`
  mutation SyncEmails($fullSync: Boolean = false) {
    syncEmails(fullSync: $fullSync) {
      success
      emailsProcessed
      emailsAdded
      emailsUpdated
      emailsSkipped
      errors {
        emailId
        error
        details
      }
      startedAt
      completedAt
      duration
    }
  }
`;

// AI mutations
export const CLASSIFY_EMAIL = gql`
  mutation ClassifyEmail($emailId: ID!) {
    classifyEmail(emailId: $emailId) {
      id
      category
      confidence
      reasoning
      modelVersion
      processingTime
      createdAt
    }
  }
`;

export const OVERRIDE_CLASSIFICATION = gql`
  mutation OverrideClassification($emailId: ID!, $category: EmailCategory!, $reason: String!) {
    overrideClassification(emailId: $emailId, category: $category, reason: $reason) {
      id
      category
      confidence
      reasoning
      isManualOverride
      overrideReason
      updatedAt
    }
  }
`;
```

#### Subscription Operations
```typescript
// Real-time subscriptions
export const EMAIL_UPDATES = gql`
  subscription EmailUpdates($userId: ID) {
    emailUpdated(userId: $userId) {
      id
      subject
      workflowState
      priority
      isRead
      updatedAt
    }
  }
`;

export const SYNC_PROGRESS = gql`
  subscription SyncProgress($userId: ID!) {
    syncProgress(userId: $userId) {
      currentStep
      totalSteps
      completedSteps
      estimatedTimeRemaining
      emailsProcessed
      emailsTotal
    }
  }
`;

export const NOTIFICATION_RECEIVED = gql`
  subscription NotificationReceived($userId: ID!) {
    notificationReceived(userId: $userId) {
      id
      type
      title
      message
      data
      priority
      createdAt
    }
  }
`;
```

### Custom GraphQL Hooks

#### Query Hooks
```typescript
// Email query hooks
export function useEmails(filters: EmailFilters, pagination: PaginationParams) {
  const { data, loading, error, fetchMore, refetch } = useQuery(GET_EMAILS, {
    variables: { filter: filters, pagination },
    notifyOnNetworkStatusChange: true,
    errorPolicy: 'all',
  });
  
  const loadMore = useCallback(() => {
    if (data?.emails.pageInfo.hasNextPage) {
      fetchMore({
        variables: {
          pagination: {
            ...pagination,
            after: data.emails.pageInfo.endCursor,
          },
        },
      });
    }
  }, [data, fetchMore, pagination]);
  
  return {
    emails: data?.emails.edges.map(edge => edge.node) || [],
    pageInfo: data?.emails.pageInfo,
    totalCount: data?.emails.totalCount || 0,
    loading,
    error,
    loadMore,
    refetch,
  };
}

export function useEmail(id: string) {
  const { data, loading, error, refetch } = useQuery(GET_EMAIL, {
    variables: { id },
    skip: !id,
    errorPolicy: 'all',
  });
  
  return {
    email: data?.email,
    loading,
    error,
    refetch,
  };
}

export function useEmailSearch(query: string, filters: EmailFilters) {
  const { data, loading, error } = useQuery(SEARCH_EMAILS, {
    variables: { query, filters },
    skip: query.length < 3,
    errorPolicy: 'all',
  });
  
  return {
    results: data?.emailSearch || [],
    loading,
    error,
  };
}
```

#### Mutation Hooks
```typescript
// Email mutation hooks
export function useUpdateEmail() {
  const [updateEmailMutation, { loading, error }] = useMutation(UPDATE_EMAIL, {
    update: (cache, { data }) => {
      if (data?.updateEmail) {
        // Update cache
        cache.writeFragment({
          id: cache.identify(data.updateEmail),
          fragment: gql`
            fragment UpdatedEmail on Email {
              id
              subject
              priority
              tags
              notes
              isStarred
              updatedAt
            }
          `,
          data: data.updateEmail,
        });
      }
    },
    onCompleted: () => {
      useUIStore.getState().addNotification({
        type: 'success',
        title: 'Email updated',
        message: 'Email has been updated successfully',
        duration: 3000,
      });
    },
  });
  
  const updateEmail = useCallback(
    (id: string, input: UpdateEmailInput) => {
      return updateEmailMutation({ variables: { id, input } });
    },
    [updateEmailMutation]
  );
  
  return { updateEmail, loading, error };
}

export function useBulkUpdateEmails() {
  const [bulkUpdateMutation, { loading, error }] = useMutation(BULK_UPDATE_EMAILS, {
    refetchQueries: [GET_EMAILS],
    onCompleted: (data) => {
      const result = data.bulkUpdateEmails;
      
      useUIStore.getState().addNotification({
        type: result.totalFailed > 0 ? 'warning' : 'success',
        title: 'Bulk update completed',
        message: `${result.totalSucceeded} emails updated successfully${
          result.totalFailed > 0 ? `, ${result.totalFailed} failed` : ''
        }`,
        duration: 5000,
      });
      
      // Clear selection
      useEmailStore.getState().clearSelection();
    },
  });
  
  const bulkUpdate = useCallback(
    (ids: string[], input: BulkUpdateInput) => {
      return bulkUpdateMutation({ variables: { ids, input } });
    },
    [bulkUpdateMutation]
  );
  
  return { bulkUpdate, loading, error };
}

export function useTransitionEmailState() {
  const [transitionMutation, { loading, error }] = useMutation(TRANSITION_EMAIL_STATE, {
    update: (cache, { data }) => {
      if (data?.transitionEmailState) {
        // Update cache
        cache.writeFragment({
          id: cache.identify(data.transitionEmailState),
          fragment: gql`
            fragment TransitionedEmail on Email {
              id
              workflowState
              updatedAt
            }
          `,
          data: data.transitionEmailState,
        });
      }
    },
  });
  
  const transitionState = useCallback(
    (emailId: string, newState: WorkflowState, reason?: string) => {
      return transitionMutation({ variables: { emailId, newState, reason } });
    },
    [transitionMutation]
  );
  
  return { transitionState, loading, error };
}
```

#### Subscription Hooks
```typescript
// Real-time subscription hooks
export function useEmailUpdates() {
  const { user } = useAuthStore();
  
  const { data } = useSubscription(EMAIL_UPDATES, {
    variables: { userId: user?.id },
    skip: !user,
    onData: ({ data }) => {
      if (data.data?.emailUpdated) {
        const updatedEmail = data.data.emailUpdated;
        
        // Update Apollo cache
        apolloClient.cache.writeFragment({
          id: apolloClient.cache.identify(updatedEmail),
          fragment: gql`
            fragment UpdatedEmailSubscription on Email {
              id
              subject
              workflowState
              priority
              isRead
              updatedAt
            }
          `,
          data: updatedEmail,
        });
        
        // Show notification for important updates
        if (updatedEmail.workflowState === 'REVIEW') {
          useUIStore.getState().addNotification({
            type: 'info',
            title: 'Email ready for review',
            message: `"${updatedEmail.subject}" is ready for review`,
            duration: 5000,
          });
        }
      }
    },
  });
  
  return data?.emailUpdated;
}

export function useSyncProgress() {
  const { user } = useAuthStore();
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  
  useSubscription(SYNC_PROGRESS, {
    variables: { userId: user?.id },
    skip: !user,
    onData: ({ data }) => {
      if (data.data?.syncProgress) {
        setProgress(data.data.syncProgress);
      }
    },
    onComplete: () => {
      setProgress(null);
    },
  });
  
  return progress;
}

export function useNotificationSubscription() {
  const { user } = useAuthStore();
  const { addNotification } = useUIStore();
  
  useSubscription(NOTIFICATION_RECEIVED, {
    variables: { userId: user?.id },
    skip: !user,
    onData: ({ data }) => {
      if (data.data?.notificationReceived) {
        const notification = data.data.notificationReceived;
        
        // Add to UI store
        addNotification({
          type: notification.type.toLowerCase() as NotificationType,
          title: notification.title,
          message: notification.message,
          duration: notification.priority === 'HIGH' ? 10000 : 5000,
        });
      }
    },
  });
}
```

## REST API Integration

### REST Client Configuration
```typescript
// Axios instance with interceptors
const restClient = axios.create({
  baseURL: process.env.VITE_API_BASE_URL || 'http://localhost:8080/api',
  timeout: 30000,
  withCredentials: true,
});

// Request interceptor for authentication
restClient.interceptors.request.use(
  (config) => {
    const token = tokenStorage.getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
restClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        await useAuthStore.getState().refreshToken();
        const token = tokenStorage.getAccessToken();
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return restClient(originalRequest);
      } catch (refreshError) {
        useAuthStore.getState().logout();
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);
```

### REST Service Classes
```typescript
// Email service
export class EmailService {
  async uploadAttachment(file: File): Promise<{ attachmentId: string }> {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await restClient.post('/emails/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    return response.data;
  }
  
  async exportEmails(format: 'xlsx' | 'csv', emailIds: string[]): Promise<Blob> {
    const response = await restClient.get('/emails/export', {
      params: { format, ids: emailIds.join(',') },
      responseType: 'blob',
    });
    
    return response.data;
  }
  
  async bulkOperation(action: string, emailIds: string[], parameters?: Record<string, any>): Promise<BulkOperationResult> {
    const response = await restClient.post('/emails/bulk', {
      action,
      emailIds,
      parameters,
    });
    
    return response.data;
  }
}

// Gmail service
export class GmailService {
  async triggerSync(fullSync = false): Promise<SyncResult> {
    const response = await restClient.post('/gmail/sync', { fullSync });
    return response.data;
  }
  
  async getSyncStatus(): Promise<SyncStatus> {
    const response = await restClient.get('/gmail/sync/status');
    return response.data;
  }
}

// Export service
export class ExportService {
  async downloadFile(url: string, filename: string): Promise<void> {
    const response = await restClient.get(url, {
      responseType: 'blob',
    });
    
    const blob = new Blob([response.data]);
    const downloadUrl = window.URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    window.URL.revokeObjectURL(downloadUrl);
  }
}

// Service instances
export const emailService = new EmailService();
export const gmailService = new GmailService();
export const exportService = new ExportService();
```

## WebSocket Integration

### WebSocket Client
```typescript
// WebSocket client for real-time features
class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  
  connect() {
    const token = tokenStorage.getAccessToken();
    const wsUrl = `${process.env.VITE_WS_ENDPOINT || 'ws://localhost:8080/ws'}?token=${token}`;
    
    this.ws = new WebSocket(wsUrl);
    
    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
    };
    
    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };
    
    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      this.attemptReconnect();
    };
    
    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }
  
  private handleMessage(message: any) {
    switch (message.type) {
      case 'EMAIL_UPDATED':
        // Handle email update
        apolloClient.cache.writeFragment({
          id: apolloClient.cache.identify({ __typename: 'Email', id: message.data.id }),
          fragment: gql`
            fragment UpdatedEmailWS on Email {
              id
              workflowState
              priority
              isRead
              updatedAt
            }
          `,
          data: message.data,
        });
        break;
        
      case 'SYNC_PROGRESS':
        // Handle sync progress
        useUIStore.getState().setLoadingState('sync', message.data.isRunning);
        break;
        
      case 'NOTIFICATION':
        // Handle notification
        useUIStore.getState().addNotification(message.data);
        break;
        
      default:
        console.warn('Unknown WebSocket message type:', message.type);
    }
  }
  
  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      
      setTimeout(() => {
        console.log(`Attempting to reconnect WebSocket (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        this.connect();
      }, delay);
    }
  }
  
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
  
  send(message: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }
}

export const wsClient = new WebSocketClient();

// WebSocket hook
export function useWebSocket() {
  const { isAuthenticated } = useAuthStore();
  
  useEffect(() => {
    if (isAuthenticated) {
      wsClient.connect();
    } else {
      wsClient.disconnect();
    }
    
    return () => {
      wsClient.disconnect();
    };
  }, [isAuthenticated]);
  
  return {
    send: wsClient.send.bind(wsClient),
  };
}
```

## Error Handling & Loading States

### API Error Handling
```typescript
// Global error handler for API calls
export function useApiErrorHandler() {
  const { addNotification } = useUIStore();
  
  const handleError = useCallback((error: any, context?: string) => {
    console.error(`API Error${context ? ` in ${context}` : ''}:`, error);
    
    let title = 'Something went wrong';
    let message = 'An unexpected error occurred';
    
    if (error.response) {
      // HTTP error response
      const { status, data } = error.response;
      
      switch (status) {
        case 400:
          title = 'Invalid Request';
          message = data.message || 'Please check your input and try again';
          break;
        case 401:
          title = 'Authentication Required';
          message = 'Please log in to continue';
          break;
        case 403:
          title = 'Access Denied';
          message = 'You do not have permission to perform this action';
          break;
        case 404:
          title = 'Not Found';
          message = 'The requested resource was not found';
          break;
        case 429:
          title = 'Too Many Requests';
          message = 'Please wait a moment before trying again';
          break;
        case 500:
          title = 'Server Error';
          message = 'Something went wrong on our end. Please try again later';
          break;
        default:
          message = data.message || `Request failed with status ${status}`;
      }
    } else if (error.request) {
      // Network error
      title = 'Network Error';
      message = 'Please check your internet connection and try again';
    } else if (error.message) {
      // Other error
      message = error.message;
    }
    
    addNotification({
      type: 'error',
      title,
      message,
      duration: 5000,
    });
  }, [addNotification]);
  
  return { handleError };
}

// Loading state management
export function useLoadingState(key: string) {
  const { loadingStates, setLoadingState } = useUIStore();
  
  const setLoading = useCallback((loading: boolean) => {
    setLoadingState(key, loading);
  }, [key, setLoadingState]);
  
  return {
    loading: loadingStates[key] || false,
    setLoading,
  };
}

// API call wrapper with loading and error handling
export function useApiCall<T extends any[], R>(
  apiFunction: (...args: T) => Promise<R>,
  options: {
    loadingKey?: string;
    onSuccess?: (result: R) => void;
    onError?: (error: any) => void;
    showSuccessNotification?: boolean;
    successMessage?: string;
  } = {}
) {
  const { handleError } = useApiErrorHandler();
  const { setLoading } = useLoadingState(options.loadingKey || 'default');
  const { addNotification } = useUIStore();
  
  const execute = useCallback(async (...args: T): Promise<R | undefined> => {
    try {
      setLoading(true);
      const result = await apiFunction(...args);
      
      if (options.onSuccess) {
        options.onSuccess(result);
      }
      
      if (options.showSuccessNotification) {
        addNotification({
          type: 'success',
          title: 'Success',
          message: options.successMessage || 'Operation completed successfully',
          duration: 3000,
        });
      }
      
      return result;
    } catch (error) {
      if (options.onError) {
        options.onError(error);
      } else {
        handleError(error);
      }
    } finally {
      setLoading(false);
    }
  }, [apiFunction, options, setLoading, handleError, addNotification]);
  
  return { execute };
}
```