# State Management

## State Architecture Overview

### State Categories & Technologies
| State Type | Technology | Scope | Persistence | Sync Strategy | Examples |
|------------|------------|-------|-------------|---------------|----------|
| **Server State** | React Query | Global | HTTP Cache | Real-time sync | Email data, user profile, notifications |
| **Client State** | Zustand | Global | LocalStorage | Manual sync | UI preferences, auth tokens, app settings |
| **Component State** | useState/useReducer | Local | None | N/A | Form inputs, modal visibility, local UI state |
| **URL State** | React Router | Global | URL | Browser sync | Filters, pagination, current page |
| **Form State** | React Hook Form | Local | None | N/A | Form validation, field values, submission state |

### State Flow Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Server State  │    │   Client State  │    │ Component State │
│  (React Query)  │    │   (Zustand)     │    │   (useState)    │
├─────────────────┤    ├─────────────────┤    ├─────────────────┤
│ • Email data    │    │ • Auth tokens   │    │ • Form inputs   │
│ • User profile   │    │ • UI preferences│    │ • Modal state   │
│ • Notifications  │    │ • Theme         │    │ • Local flags    │
│ • AI results    │    │ • Sidebar state │    │ • Temp data     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │   URL State     │
                        │ (React Router)  │
                        ├─────────────────┤
                        │ • Current route │
                        │ • Query params  │
                        │ • Filters       │
                        │ • Pagination    │
                        └─────────────────┘
```

## Zustand Store Implementation

### Auth Store
```typescript
interface AuthState {
  // State
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
  clearError: () => void;

  // Computed
  hasPermission: (permission: string) => boolean;
}

export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        user: null,
        isAuthenticated: false,
        isLoading: true,
        error: null,

        // Actions
        login: async (credentials) => {
          set({ isLoading: true, error: null });

          try {
            const response = await authService.login(credentials);
            const { user, tokens } = response;

            // Store tokens securely
            tokenStorage.setTokens(tokens);

            set({
              user,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });

            // Initialize other stores
            useUIStore.getState().initialize(user);

          } catch (error) {
            set({
              isLoading: false,
              error: error instanceof Error ? error.message : 'Login failed',
            });
            throw error;
          }
        },

        logout: () => {
          // Clear tokens
          tokenStorage.clearTokens();

          // Reset auth state
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          });

          // Reset other stores
          useUIStore.getState().reset();
          useEmailStore.getState().reset();

          // Clear React Query cache
          queryClient.clear();
        },

        refreshToken: async () => {
          try {
            const tokens = await authService.refreshToken();
            tokenStorage.setTokens(tokens);

            // Update user data if needed
            const user = await authService.getCurrentUser();
            set({ user });

          } catch (error) {
            // Token refresh failed, logout user
            get().logout();
            throw error;
          }
        },

        clearError: () => set({ error: null }),

        // Computed values
        hasPermission: (permission) => {
          const { user } = get();
          return user?.permissions?.includes(permission) ?? false;
        },
      }),
      {
        name: 'auth-store',
        partialize: (state) => ({
          user: state.user,
          isAuthenticated: state.isAuthenticated,
        }),
      }
    ),
    { name: 'auth-store' }
  )
);

// Auth store selectors
export const useAuth = () => useAuthStore((state) => ({
  user: state.user,
  isAuthenticated: state.isAuthenticated,
  isLoading: state.isLoading,
  error: state.error,
}));

export const useAuthActions = () => useAuthStore((state) => ({
  login: state.login,
  logout: state.logout,
  refreshToken: state.refreshToken,
  clearError: state.clearError,
}));
```

### UI Store
```typescript
interface UIState {
  // Theme
  theme: 'light' | 'dark' | 'system';

  // Layout
  sidebarCollapsed: boolean;
  sidebarWidth: number;

  // Notifications
  notifications: Notification[];

  // Modals
  modals: Record<string, boolean>;

  // Loading states
  globalLoading: boolean;
  loadingStates: Record<string, boolean>;

  // Actions
  setTheme: (theme: UIState['theme']) => void;
  toggleSidebar: () => void;
  setSidebarWidth: (width: number) => void;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
  openModal: (modalId: string) => void;
  closeModal: (modalId: string) => void;
  setGlobalLoading: (loading: boolean) => void;
  setLoadingState: (key: string, loading: boolean) => void;
  initialize: (user: User) => void;
  reset: () => void;
}

export const useUIStore = create<UIState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        theme: 'system',
        sidebarCollapsed: false,
        sidebarWidth: 256,
        notifications: [],
        modals: {},
        globalLoading: false,
        loadingStates: {},

        // Actions
        setTheme: (theme) => {
          set({ theme });

          // Apply theme to document
          const root = document.documentElement;
          if (theme === 'system') {
            const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            root.classList.toggle('dark', systemTheme === 'dark');
          } else {
            root.classList.toggle('dark', theme === 'dark');
          }
        },

        toggleSidebar: () => set((state) => ({
          sidebarCollapsed: !state.sidebarCollapsed
        })),

        setSidebarWidth: (width) => set({ sidebarWidth: width }),

        addNotification: (notification) => {
          const id = generateId();
          const timestamp = new Date();

          set((state) => ({
            notifications: [
              ...state.notifications,
              { ...notification, id, timestamp }
            ]
          }));

          // Auto-remove notification after duration
          if (notification.duration) {
            setTimeout(() => {
              get().removeNotification(id);
            }, notification.duration);
          }
        },

        removeNotification: (id) => set((state) => ({
          notifications: state.notifications.filter(n => n.id !== id)
        })),

        clearNotifications: () => set({ notifications: [] }),

        openModal: (modalId) => set((state) => ({
          modals: { ...state.modals, [modalId]: true }
        })),

        closeModal: (modalId) => set((state) => ({
          modals: { ...state.modals, [modalId]: false }
        })),

        setGlobalLoading: (loading) => set({ globalLoading: loading }),

        setLoadingState: (key, loading) => set((state) => ({
          loadingStates: { ...state.loadingStates, [key]: loading }
        })),

        initialize: (user) => {
          // Initialize UI based on user preferences
          const preferences = user.preferences;
          if (preferences?.theme) {
            get().setTheme(preferences.theme);
          }
          if (preferences?.sidebarCollapsed !== undefined) {
            set({ sidebarCollapsed: preferences.sidebarCollapsed });
          }
        },

        reset: () => set({
          notifications: [],
          modals: {},
          globalLoading: false,
          loadingStates: {},
        }),
      }),
      {
        name: 'ui-store',
        partialize: (state) => ({
          theme: state.theme,
          sidebarCollapsed: state.sidebarCollapsed,
          sidebarWidth: state.sidebarWidth,
        }),
      }
    ),
    { name: 'ui-store' }
  )
);

// UI store selectors
export const useTheme = () => useUIStore((state) => state.theme);
export const useSidebar = () => useUIStore((state) => ({
  collapsed: state.sidebarCollapsed,
  width: state.sidebarWidth,
  toggle: state.toggleSidebar,
  setWidth: state.setSidebarWidth,
}));
export const useNotifications = () => useUIStore((state) => ({
  notifications: state.notifications,
  add: state.addNotification,
  remove: state.removeNotification,
  clear: state.clearNotifications,
}));
export const useModals = () => useUIStore((state) => ({
  modals: state.modals,
  open: state.openModal,
  close: state.closeModal,
}));
```

### Email Store (Client State)
```typescript
interface EmailState {
  // Filters
  filters: EmailFilters;

  // Selection
  selectedEmails: string[];

  // View preferences
  viewMode: 'table' | 'cards';
  sortBy: EmailSortField;
  sortDirection: 'asc' | 'desc';

  // Actions
  setFilters: (filters: Partial<EmailFilters>) => void;
  resetFilters: () => void;
  selectEmail: (emailId: string) => void;
  selectMultipleEmails: (emailIds: string[]) => void;
  deselectEmail: (emailId: string) => void;
  clearSelection: () => void;
  setViewMode: (mode: 'table' | 'cards') => void;
  setSorting: (field: EmailSortField, direction: 'asc' | 'desc') => void;
  reset: () => void;
}

export const useEmailStore = create<EmailState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        filters: {
          search: '',
          category: undefined,
          workflowState: undefined,
          priority: undefined,
          isRead: undefined,
          isStarred: undefined,
          hasAttachments: undefined,
          dateRange: undefined,
          tags: [],
        },
        selectedEmails: [],
        viewMode: 'table',
        sortBy: 'receivedAt',
        sortDirection: 'desc',

        // Actions
        setFilters: (newFilters) => set((state) => ({
          filters: { ...state.filters, ...newFilters }
        })),

        resetFilters: () => set({
          filters: {
            search: '',
            category: undefined,
            workflowState: undefined,
            priority: undefined,
            isRead: undefined,
            isStarred: undefined,
            hasAttachments: undefined,
            dateRange: undefined,
            tags: [],
          }
        }),

        selectEmail: (emailId) => set((state) => ({
          selectedEmails: state.selectedEmails.includes(emailId)
            ? state.selectedEmails.filter(id => id !== emailId)
            : [...state.selectedEmails, emailId]
        })),

        selectMultipleEmails: (emailIds) => set((state) => ({
          selectedEmails: [
            ...new Set([...state.selectedEmails, ...emailIds])
          ]
        })),

        deselectEmail: (emailId) => set((state) => ({
          selectedEmails: state.selectedEmails.filter(id => id !== emailId)
        })),

        clearSelection: () => set({ selectedEmails: [] }),

        setViewMode: (mode) => set({ viewMode: mode }),

        setSorting: (field, direction) => set({
          sortBy: field,
          sortDirection: direction
        }),

        reset: () => set({
          selectedEmails: [],
          filters: {
            search: '',
            category: undefined,
            workflowState: undefined,
            priority: undefined,
            isRead: undefined,
            isStarred: undefined,
            hasAttachments: undefined,
            dateRange: undefined,
            tags: [],
          }
        }),
      }),
      {
        name: 'email-store',
        partialize: (state) => ({
          filters: state.filters,
          viewMode: state.viewMode,
          sortBy: state.sortBy,
          sortDirection: state.sortDirection,
        }),
      }
    ),
    { name: 'email-store' }
  )
);

// Email store selectors
export const useEmailFilters = () => useEmailStore((state) => ({
  filters: state.filters,
  setFilters: state.setFilters,
  resetFilters: state.resetFilters,
}));

export const useEmailSelection = () => useEmailStore((state) => ({
  selectedEmails: state.selectedEmails,
  selectEmail: state.selectEmail,
  selectMultiple: state.selectMultipleEmails,
  deselectEmail: state.deselectEmail,
  clearSelection: state.clearSelection,
}));

export const useEmailView = () => useEmailStore((state) => ({
  viewMode: state.viewMode,
  sortBy: state.sortBy,
  sortDirection: state.sortDirection,
  setViewMode: state.setViewMode,
  setSorting: state.setSorting,
}));
```

## React Query Configuration

### Query Client Setup
```typescript
// Query client configuration
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,        // 5 minutes
      cacheTime: 10 * 60 * 1000,       // 10 minutes
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors
        if (error instanceof Error && 'status' in error) {
          const status = (error as any).status;
          if (status >= 400 && status < 500) return false;
        }
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      refetchOnMount: true,
    },
    mutations: {
      retry: 1,
      onError: (error) => {
        console.error('Mutation error:', error);

        // Global error handling
        const { addNotification } = useUIStore.getState();
        addNotification({
          type: 'error',
          title: 'Operation failed',
          message: error instanceof Error ? error.message : 'An error occurred',
          duration: 5000,
        });
      },
    },
  },
});

// Query client provider with error boundary
export function QueryProvider({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary fallback={<QueryErrorFallback />}>
        {children}
      </ErrorBoundary>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

### Query Key Factory
```typescript
// Centralized query key management
export const queryKeys = {
  // User queries
  user: {
    all: ['user'] as const,
    profile: () => [...queryKeys.user.all, 'profile'] as const,
    settings: () => [...queryKeys.user.all, 'settings'] as const,
  },

  // Email queries
  emails: {
    all: ['emails'] as const,
    lists: () => [...queryKeys.emails.all, 'list'] as const,
    list: (filters: EmailFilters, pagination: PaginationParams) =>
      [...queryKeys.emails.lists(), { filters, pagination }] as const,
    details: () => [...queryKeys.emails.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.emails.details(), id] as const,
    search: (query: string, filters: EmailFilters) =>
      [...queryKeys.emails.all, 'search', { query, filters }] as const,
    stats: (filters: EmailFilters) =>
      [...queryKeys.emails.all, 'stats', filters] as const,
  },

  // Workflow queries
  workflow: {
    all: ['workflow'] as const,
    states: () => [...queryKeys.workflow.all, 'states'] as const,
    history: (emailId: string) =>
      [...queryKeys.workflow.all, 'history', emailId] as const,
    approvals: () => [...queryKeys.workflow.all, 'approvals'] as const,
  },

  // Notification queries
  notifications: {
    all: ['notifications'] as const,
    list: (pagination: PaginationParams) =>
      [...queryKeys.notifications.all, 'list', pagination] as const,
    unreadCount: () => [...queryKeys.notifications.all, 'unreadCount'] as const,
  },

  // AI queries
  ai: {
    all: ['ai'] as const,
    models: () => [...queryKeys.ai.all, 'models'] as const,
    stats: (dateRange: DateRange) =>
      [...queryKeys.ai.all, 'stats', dateRange] as const,
  },
} as const;

// Query key invalidation helpers
export const invalidateQueries = {
  emails: () => queryClient.invalidateQueries({ queryKey: queryKeys.emails.all }),
  emailList: () => queryClient.invalidateQueries({ queryKey: queryKeys.emails.lists() }),
  emailDetail: (id: string) => queryClient.invalidateQueries({ queryKey: queryKeys.emails.detail(id) }),
  notifications: () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all }),
  workflow: () => queryClient.invalidateQueries({ queryKey: queryKeys.workflow.all }),
};
```

### Custom Query Hooks
```typescript
// Email queries
export function useEmails(filters: EmailFilters, pagination: PaginationParams) {
  return useQuery({
    queryKey: queryKeys.emails.list(filters, pagination),
    queryFn: () => emailService.getEmails(filters, pagination),
    keepPreviousData: true,
    staleTime: 2 * 60 * 1000, // 2 minutes for list data
  });
}

export function useEmail(id: string) {
  return useQuery({
    queryKey: queryKeys.emails.detail(id),
    queryFn: () => emailService.getEmail(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // 5 minutes for detail data
  });
}

export function useEmailSearch(query: string, filters: EmailFilters) {
  return useQuery({
    queryKey: queryKeys.emails.search(query, filters),
    queryFn: () => emailService.searchEmails(query, filters),
    enabled: query.length > 2,
    staleTime: 1 * 60 * 1000, // 1 minute for search results
  });
}

// Email mutations
export function useUpdateEmail() {
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateEmailInput }) =>
      emailService.updateEmail(id, updates),
    onSuccess: (updatedEmail) => {
      // Update email detail cache
      queryClient.setQueryData(
        queryKeys.emails.detail(updatedEmail.id),
        updatedEmail
      );

      // Invalidate email lists
      invalidateQueries.emailList();
    },
  });
}

export function useBulkUpdateEmails() {
  return useMutation({
    mutationFn: ({ ids, updates }: { ids: string[]; updates: BulkUpdateInput }) =>
      emailService.bulkUpdateEmails(ids, updates),
    onSuccess: () => {
      // Invalidate all email queries
      invalidateQueries.emails();

      // Clear selection
      useEmailStore.getState().clearSelection();

      // Show success notification
      useUIStore.getState().addNotification({
        type: 'success',
        title: 'Emails updated',
        message: 'Selected emails have been updated successfully',
        duration: 3000,
      });
    },
  });
}

// Workflow mutations
export function useTransitionEmailState() {
  return useMutation({
    mutationFn: ({ emailId, newState, reason }: {
      emailId: string;
      newState: WorkflowState;
      reason?: string;
    }) => workflowService.transitionEmailState(emailId, newState, reason),
    onSuccess: (updatedEmail) => {
      // Update email caches
      queryClient.setQueryData(
        queryKeys.emails.detail(updatedEmail.id),
        updatedEmail
      );

      // Invalidate related queries
      invalidateQueries.emailList();
      queryClient.invalidateQueries({
        queryKey: queryKeys.workflow.history(updatedEmail.id)
      });
    },
  });
}
```

## URL State Management

### URL State Synchronization
```typescript
// URL state hook for email filters
export function useEmailFiltersFromURL() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { filters, setFilters } = useEmailFilters();

  // Sync URL params to store on mount and URL change
  useEffect(() => {
    const urlFilters: Partial<EmailFilters> = {};

    const search = searchParams.get('search');
    if (search) urlFilters.search = search;

    const category = searchParams.get('category');
    if (category) urlFilters.category = category as EmailCategory;

    const status = searchParams.get('status');
    if (status) urlFilters.workflowState = status as WorkflowState;

    const priority = searchParams.get('priority');
    if (priority) urlFilters.priority = priority as Priority;

    const isRead = searchParams.get('read');
    if (isRead === 'true') urlFilters.isRead = true;
    if (isRead === 'false') urlFilters.isRead = false;

    const isStarred = searchParams.get('starred');
    if (isStarred === 'true') urlFilters.isStarred = true;

    const hasAttachments = searchParams.get('attachments');
    if (hasAttachments === 'true') urlFilters.hasAttachments = true;

    const tags = searchParams.get('tags');
    if (tags) urlFilters.tags = tags.split(',');

    // Only update if different from current filters
    if (JSON.stringify(urlFilters) !== JSON.stringify(filters)) {
      setFilters(urlFilters);
    }
  }, [searchParams, filters, setFilters]);

  // Sync store to URL params
  const updateURL = useCallback((newFilters: Partial<EmailFilters>) => {
    const params = new URLSearchParams();

    if (newFilters.search) params.set('search', newFilters.search);
    if (newFilters.category) params.set('category', newFilters.category);
    if (newFilters.workflowState) params.set('status', newFilters.workflowState);
    if (newFilters.priority) params.set('priority', newFilters.priority);
    if (newFilters.isRead !== undefined) params.set('read', String(newFilters.isRead));
    if (newFilters.isStarred) params.set('starred', 'true');
    if (newFilters.hasAttachments) params.set('attachments', 'true');
    if (newFilters.tags && newFilters.tags.length > 0) {
      params.set('tags', newFilters.tags.join(','));
    }

    setSearchParams(params, { replace: true });
  }, [setSearchParams]);

  return { updateURL };
}

// Pagination URL state
export function usePaginationFromURL() {
  const [searchParams, setSearchParams] = useSearchParams();

  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '25', 10);

  const setPagination = useCallback((newPage: number, newLimit?: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', String(newPage));
    if (newLimit) params.set('limit', String(newLimit));
    setSearchParams(params, { replace: true });
  }, [searchParams, setSearchParams]);

  return {
    pagination: { page, limit },
    setPagination,
  };
}
```

## State Persistence

### LocalStorage Persistence
```typescript
// Token storage utility
export const tokenStorage = {
  getAccessToken: (): string | null => {
    return localStorage.getItem('access_token');
  },

  getRefreshToken: (): string | null => {
    return localStorage.getItem('refresh_token');
  },

  setTokens: (tokens: { accessToken: string; refreshToken: string }) => {
    localStorage.setItem('access_token', tokens.accessToken);
    localStorage.setItem('refresh_token', tokens.refreshToken);
  },

  clearTokens: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  },
};

// Preferences persistence
export const preferencesStorage = {
  save: (preferences: UserPreferences) => {
    localStorage.setItem('user_preferences', JSON.stringify(preferences));
  },

  load: (): UserPreferences | null => {
    const stored = localStorage.getItem('user_preferences');
    return stored ? JSON.parse(stored) : null;
  },

  clear: () => {
    localStorage.removeItem('user_preferences');
  },
};
```

### State Hydration
```typescript
// Store hydration on app initialization
export function useStoreHydration() {
  const { initialize: initializeAuth } = useAuthStore();
  const { initialize: initializeUI } = useUIStore();

  useEffect(() => {
    // Hydrate auth store
    const accessToken = tokenStorage.getAccessToken();
    if (accessToken) {
      // Validate token and get user data
      authService.getCurrentUser()
        .then(user => {
          initializeAuth(user);
          initializeUI(user);
        })
        .catch(() => {
          // Token invalid, clear storage
          tokenStorage.clearTokens();
        });
    }

    // Hydrate preferences
    const preferences = preferencesStorage.load();
    if (preferences) {
      initializeUI({ preferences } as User);
    }
  }, [initializeAuth, initializeUI]);
}
```
