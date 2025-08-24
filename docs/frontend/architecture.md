# Frontend Architecture

## Application Architecture Overview

### Architecture Pattern
| Pattern | Implementation | Benefits | Trade-offs |
|---------|----------------|----------|------------|
| **Component-Based** | React functional components | Reusability, testability | Learning curve |
| **Unidirectional Data Flow** | Props down, events up | Predictable state | More boilerplate |
| **Composition over Inheritance** | Component composition | Flexibility | Complex prop drilling |
| **Container/Presentational** | Smart/dumb components | Separation of concerns | More files |

### Technology Stack Integration
| Layer | Technology | Purpose | Integration Points |
|-------|------------|---------|-------------------|
| **UI Framework** | React 18 | Component rendering | Hooks, Suspense, Concurrent features |
| **Type System** | TypeScript | Type safety | Shared types with backend |
| **State Management** | Zustand + React Query | Client/server state | GraphQL integration |
| **UI Components** | ShadCN/UI + RadixUI | Design system | Tailwind CSS styling |
| **Routing** | React Router v6 | Navigation | Nested routes, lazy loading |
| **Build Tool** | Vite | Development/build | Fast HMR, optimized builds |

## Project Structure

### Directory Organization
```
apps/frontend/
├── public/
│   ├── icons/                    # App icons and favicons
│   ├── images/                   # Static images
│   └── manifest.json             # PWA manifest
├── src/
│   ├── components/               # Reusable UI components
│   │   ├── ui/                   # ShadCN/UI components
│   │   ├── forms/                # Form components
│   │   ├── layout/               # Layout components
│   │   └── common/               # Common components
│   ├── pages/                    # Page components
│   │   ├── auth/                 # Authentication pages
│   │   ├── emails/               # Email management pages
│   │   ├── dashboard/            # Dashboard page
│   │   └── settings/             # Settings pages
│   ├── hooks/                    # Custom React hooks
│   │   ├── api/                  # API-related hooks
│   │   ├── ui/                   # UI-related hooks
│   │   └── utils/                # Utility hooks
│   ├── services/                 # API services
│   │   ├── graphql/              # GraphQL operations
│   │   ├── rest/                 # REST API calls
│   │   └── websocket/            # WebSocket connections
│   ├── stores/                   # Zustand stores
│   │   ├── auth.store.ts         # Authentication state
│   │   ├── ui.store.ts           # UI state
│   │   └── settings.store.ts     # Settings state
│   ├── types/                    # Frontend-specific types
│   │   ├── api.types.ts          # API response types
│   │   ├── ui.types.ts           # UI component types
│   │   └── form.types.ts         # Form types
│   ├── utils/                    # Utility functions
│   │   ├── formatters.ts         # Data formatters
│   │   ├── validators.ts         # Validation functions
│   │   └── helpers.ts            # Helper functions
│   ├── styles/                   # Global styles
│   │   ├── globals.css           # Global CSS
│   │   ├── components.css        # Component styles
│   │   └── utilities.css         # Utility classes
│   ├── config/                   # Configuration
│   │   ├── constants.ts          # App constants
│   │   ├── routes.ts             # Route definitions
│   │   └── api.config.ts         # API configuration
│   ├── App.tsx                   # Root component
│   ├── main.tsx                  # Application entry point
│   └── vite-env.d.ts            # Vite type definitions
├── tests/                        # Test files
│   ├── components/               # Component tests
│   ├── hooks/                    # Hook tests
│   ├── utils/                    # Utility tests
│   └── e2e/                      # End-to-end tests
├── .storybook/                   # Storybook configuration
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
└── README.md
```

### Component Hierarchy
| Level | Purpose | Examples | Naming Convention |
|-------|---------|----------|-------------------|
| **Pages** | Route-level components | `EmailsPage`, `DashboardPage` | `{Feature}Page` |
| **Layouts** | Page structure | `AppLayout`, `AuthLayout` | `{Purpose}Layout` |
| **Features** | Business logic components | `EmailTable`, `WorkflowPanel` | `{Feature}{Component}` |
| **UI Components** | Reusable UI elements | `Button`, `Modal`, `DataTable` | `{Element}` |
| **Forms** | Form-specific components | `EmailForm`, `SettingsForm` | `{Purpose}Form` |

## Component Design Patterns

### Component Types
| Type | Purpose | Props | State | Examples |
|------|---------|-------|-------|----------|
| **Presentational** | UI rendering | Data + callbacks | None | `EmailCard`, `StatusBadge` |
| **Container** | Data fetching + logic | Minimal | Local state | `EmailTableContainer` |
| **Layout** | Page structure | Children + config | UI state | `AppLayout`, `Sidebar` |
| **Form** | User input | Initial values + handlers | Form state | `EmailFilters`, `UserSettings` |
| **Provider** | Context/state | Children + config | Global state | `AuthProvider`, `ThemeProvider` |

### Component Composition Patterns
```typescript
// Compound Component Pattern
interface EmailTableProps {
  data: Email[];
  loading?: boolean;
  error?: string;
}

export function EmailTable({ data, loading, error }: EmailTableProps) {
  if (loading) return <EmailTable.Loading />;
  if (error) return <EmailTable.Error message={error} />;
  if (data.length === 0) return <EmailTable.Empty />;
  
  return (
    <EmailTable.Root>
      <EmailTable.Header />
      <EmailTable.Body data={data} />
      <EmailTable.Footer />
    </EmailTable.Root>
  );
}

EmailTable.Root = EmailTableRoot;
EmailTable.Header = EmailTableHeader;
EmailTable.Body = EmailTableBody;
EmailTable.Footer = EmailTableFooter;
EmailTable.Loading = EmailTableLoading;
EmailTable.Error = EmailTableError;
EmailTable.Empty = EmailTableEmpty;

// Render Props Pattern
interface DataFetcherProps<T> {
  query: string;
  variables?: Record<string, any>;
  children: (data: {
    data?: T;
    loading: boolean;
    error?: string;
    refetch: () => void;
  }) => React.ReactNode;
}

export function DataFetcher<T>({ query, variables, children }: DataFetcherProps<T>) {
  const { data, loading, error, refetch } = useQuery(query, variables);
  return <>{children({ data, loading, error, refetch })}</>;
}

// Higher-Order Component Pattern
function withAuth<P extends object>(Component: React.ComponentType<P>) {
  return function AuthenticatedComponent(props: P) {
    const { user, loading } = useAuth();
    
    if (loading) return <LoadingSpinner />;
    if (!user) return <Navigate to="/login" />;
    
    return <Component {...props} />;
  };
}
```

### Props Interface Design
```typescript
// Base component props
interface BaseComponentProps {
  className?: string;
  children?: React.ReactNode;
  testId?: string;
}

// Data component props
interface DataComponentProps<T> extends BaseComponentProps {
  data: T[];
  loading?: boolean;
  error?: string;
  onRefresh?: () => void;
}

// Form component props
interface FormComponentProps<T> extends BaseComponentProps {
  initialValues?: Partial<T>;
  onSubmit: (values: T) => void | Promise<void>;
  onCancel?: () => void;
  disabled?: boolean;
  validationSchema?: ValidationSchema<T>;
}

// Action component props
interface ActionComponentProps extends BaseComponentProps {
  variant?: 'primary' | 'secondary' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  onClick?: () => void | Promise<void>;
}
```

## State Management Architecture

### State Categories
| Category | Technology | Scope | Persistence | Examples |
|----------|------------|-------|-------------|----------|
| **Server State** | React Query | Global | Cache | Email data, user profile |
| **Client State** | Zustand | Global | LocalStorage | UI preferences, auth tokens |
| **Component State** | useState | Local | None | Form inputs, modal state |
| **URL State** | React Router | Global | URL | Filters, pagination, routes |
| **Form State** | React Hook Form | Local | None | Form validation, submission |

### Zustand Store Structure
```typescript
// Auth Store
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  
  login: async (credentials) => {
    set({ isLoading: true });
    try {
      const user = await authService.login(credentials);
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },
  
  logout: () => {
    authService.logout();
    set({ user: null, isAuthenticated: false });
  },
  
  refreshToken: async () => {
    try {
      const user = await authService.refreshToken();
      set({ user, isAuthenticated: true });
    } catch (error) {
      set({ user: null, isAuthenticated: false });
      throw error;
    }
  }
}));

// UI Store
interface UIState {
  theme: 'light' | 'dark' | 'system';
  sidebarCollapsed: boolean;
  notifications: Notification[];
  modals: Record<string, boolean>;
  setTheme: (theme: UIState['theme']) => void;
  toggleSidebar: () => void;
  addNotification: (notification: Omit<Notification, 'id'>) => void;
  removeNotification: (id: string) => void;
  openModal: (modalId: string) => void;
  closeModal: (modalId: string) => void;
}
```

### React Query Configuration
```typescript
// Query Client Setup
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,      // 5 minutes
      cacheTime: 10 * 60 * 1000,     // 10 minutes
      retry: (failureCount, error) => {
        if (error.status === 404) return false;
        return failureCount < 3;
      },
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 1,
      onError: (error) => {
        console.error('Mutation error:', error);
        // Global error handling
      },
    },
  },
});

// Query Keys Factory
export const queryKeys = {
  all: ['emails'] as const,
  lists: () => [...queryKeys.all, 'list'] as const,
  list: (filters: EmailFilters) => [...queryKeys.lists(), filters] as const,
  details: () => [...queryKeys.all, 'detail'] as const,
  detail: (id: string) => [...queryKeys.details(), id] as const,
  search: (query: string) => [...queryKeys.all, 'search', query] as const,
};
```

## Routing Architecture

### Route Structure
| Route | Component | Access Level | Data Requirements |
|-------|-----------|--------------|-------------------|
| `/` | `DashboardPage` | Authenticated | User data, email stats |
| `/login` | `LoginPage` | Public | None |
| `/emails` | `EmailsPage` | Authenticated | Email list, filters |
| `/emails/:id` | `EmailDetailPage` | Authenticated | Email details |
| `/settings` | `SettingsPage` | Authenticated | User settings |
| `/settings/profile` | `ProfileSettingsPage` | Authenticated | User profile |
| `/settings/notifications` | `NotificationSettingsPage` | Authenticated | Notification preferences |

### Route Configuration
```typescript
// Route definitions
export const routes = {
  home: '/',
  login: '/login',
  emails: '/emails',
  emailDetail: (id: string) => `/emails/${id}`,
  settings: '/settings',
  settingsProfile: '/settings/profile',
  settingsNotifications: '/settings/notifications',
} as const;

// Router setup
function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path={routes.login} element={<LoginPage />} />
        
        {/* Protected routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path={routes.home} element={<DashboardPage />} />
            <Route path={routes.emails} element={<EmailsPage />} />
            <Route path="/emails/:id" element={<EmailDetailPage />} />
            
            {/* Settings routes */}
            <Route path={routes.settings} element={<SettingsLayout />}>
              <Route index element={<Navigate to={routes.settingsProfile} />} />
              <Route path="profile" element={<ProfileSettingsPage />} />
              <Route path="notifications" element={<NotificationSettingsPage />} />
            </Route>
          </Route>
        </Route>
        
        {/* Catch all */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}

// Protected route component
function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuthStore();
  
  if (isLoading) {
    return <LoadingPage />;
  }
  
  if (!isAuthenticated) {
    return <Navigate to={routes.login} replace />;
  }
  
  return <Outlet />;
}
```

### Route Guards & Data Loading
```typescript
// Route guard hook
function useRouteGuard(requiredPermissions?: string[]) {
  const { user, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  
  useEffect(() => {
    if (!isAuthenticated) {
      navigate(routes.login);
      return;
    }
    
    if (requiredPermissions && !hasPermissions(user, requiredPermissions)) {
      navigate(routes.home);
      return;
    }
  }, [isAuthenticated, user, requiredPermissions, navigate]);
  
  return { canAccess: isAuthenticated && (!requiredPermissions || hasPermissions(user, requiredPermissions)) };
}

// Route data loader
function useRouteData<T>(
  queryKey: QueryKey,
  queryFn: QueryFunction<T>,
  options?: UseQueryOptions<T>
) {
  const query = useQuery(queryKey, queryFn, {
    suspense: true,
    ...options,
  });
  
  return query;
}
```

## Performance Optimization

### Code Splitting Strategy
| Split Point | Method | Benefits | Loading Strategy |
|-------------|--------|----------|------------------|
| **Route Level** | `React.lazy()` | Smaller initial bundle | Route-based chunks |
| **Feature Level** | Dynamic imports | Feature isolation | On-demand loading |
| **Component Level** | Conditional imports | Reduced bundle size | Lazy component loading |
| **Library Level** | Vendor splitting | Better caching | Separate vendor chunks |

### Lazy Loading Implementation
```typescript
// Route-level lazy loading
const EmailsPage = lazy(() => import('../pages/emails/EmailsPage'));
const SettingsPage = lazy(() => import('../pages/settings/SettingsPage'));

// Component-level lazy loading
const EmailEditor = lazy(() => import('../components/emails/EmailEditor'));

// Feature-level lazy loading
const AdvancedFilters = lazy(() => 
  import('../components/filters/AdvancedFilters').then(module => ({
    default: module.AdvancedFilters
  }))
);

// Lazy loading with error boundary
function LazyComponent({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary fallback={<ErrorFallback />}>
      <Suspense fallback={<ComponentSkeleton />}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}
```

### Memoization Strategy
| Technique | Use Case | Performance Impact | Memory Impact |
|-----------|----------|-------------------|---------------|
| **React.memo** | Expensive renders | High | Low |
| **useMemo** | Expensive calculations | Medium | Medium |
| **useCallback** | Stable function references | Low | Low |
| **Query caching** | API responses | High | Medium |

### Virtual Scrolling
```typescript
// Virtual list implementation for large datasets
interface VirtualListProps<T> {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  overscan?: number;
}

function VirtualList<T>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  overscan = 5
}: VirtualListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  
  const visibleStart = Math.floor(scrollTop / itemHeight);
  const visibleEnd = Math.min(
    visibleStart + Math.ceil(containerHeight / itemHeight),
    items.length - 1
  );
  
  const startIndex = Math.max(0, visibleStart - overscan);
  const endIndex = Math.min(items.length - 1, visibleEnd + overscan);
  
  const visibleItems = items.slice(startIndex, endIndex + 1);
  
  return (
    <div
      style={{ height: containerHeight, overflow: 'auto' }}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
    >
      <div style={{ height: items.length * itemHeight, position: 'relative' }}>
        {visibleItems.map((item, index) => (
          <div
            key={startIndex + index}
            style={{
              position: 'absolute',
              top: (startIndex + index) * itemHeight,
              height: itemHeight,
              width: '100%'
            }}
          >
            {renderItem(item, startIndex + index)}
          </div>
        ))}
      </div>
    </div>
  );
}
```

## Error Handling & Boundaries

### Error Boundary Implementation
```typescript
interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

class ErrorBoundary extends Component<
  { children: ReactNode; fallback?: ComponentType<ErrorBoundaryState> },
  ErrorBoundaryState
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }
  
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    
    // Log error to monitoring service
    errorReportingService.captureException(error, {
      extra: errorInfo,
      tags: { component: 'ErrorBoundary' }
    });
  }
  
  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback || DefaultErrorFallback;
      return <FallbackComponent {...this.state} />;
    }
    
    return this.props.children;
  }
}

// Error fallback components
function DefaultErrorFallback({ error }: ErrorBoundaryState) {
  return (
    <div className="error-boundary">
      <h2>Something went wrong</h2>
      <p>{error?.message}</p>
      <button onClick={() => window.location.reload()}>
        Reload page
      </button>
    </div>
  );
}
```

### Global Error Handling
```typescript
// Global error handler
function useGlobalErrorHandler() {
  const { addNotification } = useUIStore();
  
  const handleError = useCallback((error: Error, context?: string) => {
    console.error(`Error in ${context}:`, error);
    
    // Report to monitoring service
    errorReportingService.captureException(error, {
      tags: { context },
      user: useAuthStore.getState().user
    });
    
    // Show user notification
    addNotification({
      type: 'error',
      title: 'Something went wrong',
      message: error.message,
      duration: 5000
    });
  }, [addNotification]);
  
  return { handleError };
}

// Query error handling
function useQueryErrorHandler() {
  const { handleError } = useGlobalErrorHandler();
  
  return {
    onError: (error: Error) => {
      handleError(error, 'GraphQL Query');
    }
  };
}
```