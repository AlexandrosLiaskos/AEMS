import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ApolloProvider } from '@apollo/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

// App and providers
import App from './App';
import { apolloClient } from './services/apollo-client';
import { AuthProvider } from './providers/auth-provider';
import { ThemeProvider } from './providers/theme-provider';
import { NotificationProvider } from './providers/notification-provider';
import { ToastProvider } from './providers/toast-provider';

// Styles
import './styles/globals.css';

// Error boundary
import { ErrorBoundary } from './components/error-boundary';

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      retry: (failureCount, error: any) => {
        // Don't retry on 4xx errors
        if (error?.status >= 400 && error?.status < 500) {
          return false;
        }
        return failureCount < 3;
      },
    },
    mutations: {
      retry: 1,
    },
  },
});

// Development tools
const isDevelopment = import.meta.env.DEV;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <ApolloProvider client={apolloClient}>
          <QueryClientProvider client={queryClient}>
            <ThemeProvider defaultTheme="system" storageKey="aems-ui-theme">
              <AuthProvider>
                <NotificationProvider>
                  <ToastProvider>
                    <App />
                  </ToastProvider>
                </NotificationProvider>
              </AuthProvider>
            </ThemeProvider>
            {isDevelopment && <ReactQueryDevtools initialIsOpen={false} />}
          </QueryClientProvider>
        </ApolloProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);