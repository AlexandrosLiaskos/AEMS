import { ApolloClient, InMemoryCache, createHttpLink, from, split } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';
import { getMainDefinition } from '@apollo/client/utilities';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { createClient } from 'graphql-ws';

// Auth service
import { authService } from './auth-service';

// Environment configuration
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';

// HTTP Link
const httpLink = createHttpLink({
  uri: `${API_URL}/graphql`,
  credentials: 'include',
});

// WebSocket Link for subscriptions
const wsLink = new GraphQLWsLink(
  createClient({
    url: `${WS_URL}/graphql`,
    connectionParams: () => {
      const token = authService.getToken();
      return {
        authorization: token ? `Bearer ${token}` : '',
      };
    },
    retryAttempts: 5,
    shouldRetry: () => true,
  })
);

// Auth Link - Add authorization header
const authLink = setContext((_, { headers }) => {
  const token = authService.getToken();
  
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json',
    },
  };
});

// Error Link - Handle GraphQL and network errors
const errorLink = onError(({ graphQLErrors, networkError, operation, forward }) => {
  if (graphQLErrors) {
    graphQLErrors.forEach(({ message, locations, path, extensions }) => {
      console.error(
        `GraphQL error: Message: ${message}, Location: ${locations}, Path: ${path}`
      );

      // Handle authentication errors
      if (extensions?.code === 'UNAUTHENTICATED') {
        authService.logout();
        window.location.href = '/login';
      }

      // Handle authorization errors
      if (extensions?.code === 'FORBIDDEN') {
        console.error('Access denied:', message);
        // Could show a toast notification here
      }
    });
  }

  if (networkError) {
    console.error(`Network error: ${networkError}`);
    
    // Handle network errors
    if ('statusCode' in networkError) {
      switch (networkError.statusCode) {
        case 401:
          authService.logout();
          window.location.href = '/login';
          break;
        case 403:
          console.error('Access forbidden');
          break;
        case 500:
          console.error('Server error');
          break;
        default:
          console.error('Unknown network error');
      }
    }
  }
});

// Split link - Use WebSocket for subscriptions, HTTP for queries/mutations
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

// Apollo Client configuration
export const apolloClient = new ApolloClient({
  link: splitLink,
  cache: new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          // Pagination for emails
          emails: {
            keyArgs: ['filters', 'sort'],
            merge(existing = { emails: [], total: 0 }, incoming) {
              return {
                ...incoming,
                emails: [...(existing.emails || []), ...incoming.emails],
              };
            },
          },
          // Pagination for notifications
          notifications: {
            keyArgs: ['filters'],
            merge(existing = { notifications: [], total: 0 }, incoming) {
              return {
                ...incoming,
                notifications: [...(existing.notifications || []), ...incoming.notifications],
              };
            },
          },
        },
      },
      User: {
        fields: {
          // Cache user preferences
          preferences: {
            merge: true,
          },
          settings: {
            merge: true,
          },
        },
      },
      EmailMessage: {
        fields: {
          // Cache email metadata
          metadata: {
            merge: true,
          },
        },
      },
      Notification: {
        fields: {
          // Cache notification data
          data: {
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
  connectToDevTools: import.meta.env.DEV,
});

// Helper functions for cache management
export const cacheHelpers = {
  /**
   * Clear all cached data
   */
  clearCache: () => {
    apolloClient.clearStore();
  },

  /**
   * Refetch all active queries
   */
  refetchQueries: () => {
    apolloClient.refetchQueries({
      include: 'active',
    });
  },

  /**
   * Update user in cache
   */
  updateUser: (user: any) => {
    apolloClient.cache.writeQuery({
      query: require('../graphql/queries/user.graphql').GET_CURRENT_USER,
      data: { me: user },
    });
  },

  /**
   * Add email to cache
   */
  addEmail: (email: any) => {
    apolloClient.cache.modify({
      fields: {
        emails(existingEmails = { emails: [], total: 0 }) {
          return {
            ...existingEmails,
            emails: [email, ...existingEmails.emails],
            total: existingEmails.total + 1,
          };
        },
      },
    });
  },

  /**
   * Update email in cache
   */
  updateEmail: (emailId: string, updates: any) => {
    apolloClient.cache.modify({
      id: apolloClient.cache.identify({ __typename: 'EmailType', id: emailId }),
      fields: {
        ...updates,
      },
    });
  },

  /**
   * Add notification to cache
   */
  addNotification: (notification: any) => {
    apolloClient.cache.modify({
      fields: {
        notifications(existingNotifications = { notifications: [], total: 0 }) {
          return {
            ...existingNotifications,
            notifications: [notification, ...existingNotifications.notifications],
            total: existingNotifications.total + 1,
          };
        },
      },
    });
  },

  /**
   * Update notification in cache
   */
  updateNotification: (notificationId: string, updates: any) => {
    apolloClient.cache.modify({
      id: apolloClient.cache.identify({ __typename: 'NotificationType', id: notificationId }),
      fields: {
        ...updates,
      },
    });
  },
};