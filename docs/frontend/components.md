# Frontend Components

## Component Library Structure

### ShadCN/UI Base Components
| Component | Purpose | Variants | Props | Usage |
|-----------|---------|----------|-------|-------|
| **Button** | User actions | `default`, `destructive`, `outline`, `secondary`, `ghost`, `link` | `variant`, `size`, `disabled`, `loading` | Forms, actions, navigation |
| **Input** | Text input | `default`, `email`, `password`, `search` | `type`, `placeholder`, `disabled`, `error` | Forms, search, filters |
| **Select** | Dropdown selection | `single`, `multiple` | `options`, `value`, `onValueChange`, `placeholder` | Filters, forms |
| **Dialog** | Modal dialogs | `default`, `alert` | `open`, `onOpenChange`, `title`, `description` | Confirmations, forms |
| **Table** | Data display | `default`, `striped`, `bordered` | `data`, `columns`, `sorting`, `pagination` | Email lists, data tables |
| **Card** | Content containers | `default`, `elevated` | `title`, `description`, `footer` | Email cards, dashboards |
| **Badge** | Status indicators | `default`, `secondary`, `destructive`, `outline` | `variant`, `size` | Status, categories, tags |
| **Avatar** | User representation | `default`, `fallback` | `src`, `alt`, `fallback`, `size` | User profiles, comments |

### Custom Component Categories
| Category | Purpose | Examples | Base Components |
|----------|---------|----------|-----------------|
| **Layout** | Page structure | `AppLayout`, `Sidebar`, `Header` | `div`, `nav`, `aside` |
| **Email** | Email-specific UI | `EmailCard`, `EmailTable`, `EmailViewer` | `Card`, `Table`, `Dialog` |
| **Forms** | User input | `EmailFilters`, `SettingsForm`, `LoginForm` | `Input`, `Select`, `Button` |
| **Data Display** | Information presentation | `StatsCard`, `ChartWidget`, `DataTable` | `Card`, `Table`, `Badge` |
| **Navigation** | App navigation | `NavMenu`, `Breadcrumbs`, `Pagination` | `Button`, `Link`, `Select` |
| **Feedback** | User feedback | `Toast`, `LoadingSpinner`, `ErrorMessage` | `Alert`, `Dialog`, `Badge` |

## Email Management Components

### EmailTable Component
```typescript
interface EmailTableProps {
  emails: Email[];
  loading?: boolean;
  error?: string;
  selectedEmails?: string[];
  onEmailSelect?: (emailId: string) => void;
  onBulkSelect?: (emailIds: string[]) => void;
  onEmailClick?: (email: Email) => void;
  sortBy?: EmailSortField;
  sortDirection?: 'asc' | 'desc';
  onSort?: (field: EmailSortField, direction: 'asc' | 'desc') => void;
  pagination?: PaginationProps;
}

export function EmailTable({
  emails,
  loading,
  error,
  selectedEmails = [],
  onEmailSelect,
  onBulkSelect,
  onEmailClick,
  sortBy,
  sortDirection,
  onSort,
  pagination
}: EmailTableProps) {
  const columns: ColumnDef<Email>[] = [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => {
            table.toggleAllPageRowsSelected(!!value);
            if (onBulkSelect) {
              const selectedIds = value 
                ? emails.map(email => email.id)
                : [];
              onBulkSelect(selectedIds);
            }
          }}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => {
            row.toggleSelected(!!value);
            if (onEmailSelect) {
              onEmailSelect(row.original.id);
            }
          }}
        />
      ),
    },
    {
      accessorKey: 'from.name',
      header: ({ column }) => (
        <SortableHeader
          column={column}
          title="From"
          onSort={onSort}
        />
      ),
      cell: ({ row }) => (
        <div className="flex items-center space-x-2">
          <Avatar className="h-8 w-8">
            <AvatarFallback>
              {getInitials(row.original.from.name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="font-medium">{row.original.from.name}</div>
            <div className="text-sm text-muted-foreground">
              {row.original.from.email}
            </div>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'subject',
      header: 'Subject',
      cell: ({ row }) => (
        <div className="max-w-[300px]">
          <div className="font-medium truncate">{row.original.subject}</div>
          <div className="text-sm text-muted-foreground truncate">
            {row.original.snippet}
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'classification.category',
      header: 'Category',
      cell: ({ row }) => {
        const classification = row.original.classification;
        if (!classification) return <Badge variant="outline">Unclassified</Badge>;
        
        return (
          <Badge variant={getCategoryVariant(classification.category)}>
            {classification.category}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'workflowState',
      header: 'Status',
      cell: ({ row }) => (
        <WorkflowStateBadge state={row.original.workflowState} />
      ),
    },
    {
      accessorKey: 'receivedAt',
      header: ({ column }) => (
        <SortableHeader
          column={column}
          title="Received"
          onSort={onSort}
        />
      ),
      cell: ({ row }) => (
        <div className="text-sm">
          {formatRelativeTime(row.original.receivedAt)}
        </div>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <EmailRowActions
          email={row.original}
          onView={() => onEmailClick?.(row.original)}
        />
      ),
    },
  ];

  if (loading) {
    return <EmailTableSkeleton />;
  }

  if (error) {
    return <ErrorMessage message={error} onRetry={() => window.location.reload()} />;
  }

  if (emails.length === 0) {
    return <EmptyState message="No emails found" />;
  }

  return (
    <div className="space-y-4">
      <DataTable
        columns={columns}
        data={emails}
        pagination={pagination}
      />
    </div>
  );
}
```

### EmailCard Component
```typescript
interface EmailCardProps {
  email: Email;
  selected?: boolean;
  onSelect?: (selected: boolean) => void;
  onClick?: () => void;
  showActions?: boolean;
}

export function EmailCard({
  email,
  selected,
  onSelect,
  onClick,
  showActions = true
}: EmailCardProps) {
  return (
    <Card 
      className={cn(
        "cursor-pointer transition-colors hover:bg-muted/50",
        selected && "ring-2 ring-primary"
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            {onSelect && (
              <Checkbox
                checked={selected}
                onCheckedChange={onSelect}
                onClick={(e) => e.stopPropagation()}
              />
            )}
            <Avatar className="h-10 w-10">
              <AvatarFallback>
                {getInitials(email.from.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <p className="font-medium truncate">{email.from.name}</p>
                <Badge variant="outline" className="text-xs">
                  {formatRelativeTime(email.receivedAt)}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground truncate">
                {email.from.email}
              </p>
            </div>
          </div>
          {showActions && (
            <EmailCardActions email={email} />
          )}
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="space-y-2">
          <h3 className="font-medium line-clamp-2">{email.subject}</h3>
          <p className="text-sm text-muted-foreground line-clamp-3">
            {email.snippet}
          </p>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {email.classification && (
                <Badge variant={getCategoryVariant(email.classification.category)}>
                  {email.classification.category}
                </Badge>
              )}
              <WorkflowStateBadge state={email.workflowState} />
              {email.priority !== 'NORMAL' && (
                <PriorityBadge priority={email.priority} />
              )}
            </div>
            
            <div className="flex items-center space-x-1 text-muted-foreground">
              {email.attachments.length > 0 && (
                <div className="flex items-center space-x-1">
                  <Paperclip className="h-4 w-4" />
                  <span className="text-xs">{email.attachments.length}</span>
                </div>
              )}
              {email.isStarred && (
                <Star className="h-4 w-4 fill-current text-yellow-500" />
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

### EmailViewer Component
```typescript
interface EmailViewerProps {
  email: Email;
  onClose?: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  showNavigation?: boolean;
}

export function EmailViewer({
  email,
  onClose,
  onNext,
  onPrevious,
  showNavigation = true
}: EmailViewerProps) {
  const [viewMode, setViewMode] = useState<'html' | 'text'>('html');
  
  return (
    <Dialog open onOpenChange={() => onClose?.()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <DialogTitle className="truncate">{email.subject}</DialogTitle>
              {email.classification && (
                <Badge variant={getCategoryVariant(email.classification.category)}>
                  {email.classification.category}
                </Badge>
              )}
            </div>
            
            <div className="flex items-center space-x-2">
              {showNavigation && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onPrevious}
                    disabled={!onPrevious}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onNext}
                    disabled={!onNext}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </>
              )}
              <EmailViewerActions email={email} />
            </div>
          </div>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Email Header */}
          <div className="border-b pb-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <Avatar className="h-12 w-12">
                  <AvatarFallback>
                    {getInitials(email.from.name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-medium">{email.from.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {email.from.email}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatDateTime(email.receivedAt)}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <WorkflowStateBadge state={email.workflowState} />
                {email.priority !== 'NORMAL' && (
                  <PriorityBadge priority={email.priority} />
                )}
              </div>
            </div>
            
            {/* Recipients */}
            <div className="mt-3 space-y-1 text-sm">
              <div>
                <span className="font-medium">To: </span>
                {email.to.map(addr => addr.email).join(', ')}
              </div>
              {email.cc && email.cc.length > 0 && (
                <div>
                  <span className="font-medium">CC: </span>
                  {email.cc.map(addr => addr.email).join(', ')}
                </div>
              )}
            </div>
          </div>
          
          {/* Content Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Button
                variant={viewMode === 'html' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('html')}
              >
                HTML
              </Button>
              <Button
                variant={viewMode === 'text' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('text')}
              >
                Text
              </Button>
            </div>
            
            {email.attachments.length > 0 && (
              <AttachmentList attachments={email.attachments} />
            )}
          </div>
          
          {/* Email Content */}
          <ScrollArea className="h-[400px] border rounded-md p-4">
            {viewMode === 'html' && email.bodyHtml ? (
              <div
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{
                  __html: sanitizeHtml(email.bodyHtml)
                }}
              />
            ) : (
              <pre className="whitespace-pre-wrap text-sm">
                {email.bodyText || email.snippet}
              </pre>
            )}
          </ScrollArea>
          
          {/* AI Processing Results */}
          {(email.classification || email.extraction) && (
            <div className="border-t pt-4">
              <AIProcessingResults
                classification={email.classification}
                extraction={email.extraction}
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

## Form Components

### EmailFilters Component
```typescript
interface EmailFiltersProps {
  filters: EmailFilters;
  onFiltersChange: (filters: EmailFilters) => void;
  onReset: () => void;
  loading?: boolean;
}

export function EmailFilters({
  filters,
  onFiltersChange,
  onReset,
  loading
}: EmailFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const updateFilter = <K extends keyof EmailFilters>(
    key: K,
    value: EmailFilters[K]
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  };
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Filters</CardTitle>
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onReset}
              disabled={loading}
            >
              Reset
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Basic Filters - Always Visible */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="search">Search</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Search emails..."
                value={filters.search || ''}
                onChange={(e) => updateFilter('search', e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select
              value={filters.category || 'all'}
              onValueChange={(value) => 
                updateFilter('category', value === 'all' ? undefined : value as EmailCategory)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                <SelectItem value="CUSTOMER_INQUIRY">Customer Inquiry</SelectItem>
                <SelectItem value="INVOICE">Invoice</SelectItem>
                <SelectItem value="OTHER">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={filters.workflowState || 'all'}
              onValueChange={(value) => 
                updateFilter('workflowState', value === 'all' ? undefined : value as WorkflowState)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="FETCHED">Fetched</SelectItem>
                <SelectItem value="PROCESSING">Processing</SelectItem>
                <SelectItem value="REVIEW">Review</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
                <SelectItem value="MANAGED">Managed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        {/* Advanced Filters - Collapsible */}
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleContent className="space-y-4">
            <Separator />
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select
                  value={filters.priority || 'all'}
                  onValueChange={(value) => 
                    updateFilter('priority', value === 'all' ? undefined : value as Priority)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All priorities" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All priorities</SelectItem>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="NORMAL">Normal</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="URGENT">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="from">From</Label>
                <Input
                  id="from"
                  placeholder="Sender email or name"
                  value={filters.fromEmail || ''}
                  onChange={(e) => updateFilter('fromEmail', e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Date Range</Label>
                <DateRangePicker
                  value={filters.dateRange}
                  onChange={(dateRange) => updateFilter('dateRange', dateRange)}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Options</Label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="unread"
                      checked={filters.isRead === false}
                      onCheckedChange={(checked) => 
                        updateFilter('isRead', checked ? false : undefined)
                      }
                    />
                    <Label htmlFor="unread" className="text-sm">Unread only</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="starred"
                      checked={filters.isStarred === true}
                      onCheckedChange={(checked) => 
                        updateFilter('isStarred', checked ? true : undefined)
                      }
                    />
                    <Label htmlFor="starred" className="text-sm">Starred only</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="attachments"
                      checked={filters.hasAttachments === true}
                      onCheckedChange={(checked) => 
                        updateFilter('hasAttachments', checked ? true : undefined)
                      }
                    />
                    <Label htmlFor="attachments" className="text-sm">Has attachments</Label>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Tags Filter */}
            <div className="space-y-2">
              <Label>Tags</Label>
              <TagSelector
                selectedTags={filters.tags || []}
                onTagsChange={(tags) => updateFilter('tags', tags)}
              />
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
```

## Layout Components

### AppLayout Component
```typescript
interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const { user } = useAuthStore();
  
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center">
          <div className="mr-4 flex">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleSidebar}
              className="md:hidden"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <Link to="/" className="mr-6 flex items-center space-x-2">
              <Mail className="h-6 w-6" />
              <span className="font-bold">AEMS</span>
            </Link>
          </div>
          
          <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
            <div className="w-full flex-1 md:w-auto md:flex-none">
              <GlobalSearch />
            </div>
            
            <nav className="flex items-center space-x-2">
              <NotificationDropdown />
              <ThemeToggle />
              <UserDropdown user={user} />
            </nav>
          </div>
        </div>
      </header>
      
      <div className="flex">
        {/* Sidebar */}
        <aside className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 transform border-r bg-background transition-transform duration-200 ease-in-out md:relative md:translate-x-0",
          sidebarCollapsed && "-translate-x-full md:w-16"
        )}>
          <Sidebar collapsed={sidebarCollapsed} />
        </aside>
        
        {/* Main Content */}
        <main className="flex-1 overflow-hidden">
          <div className="container mx-auto p-6">
            <Outlet />
          </div>
        </main>
      </div>
      
      {/* Mobile Sidebar Overlay */}
      {!sidebarCollapsed && (
        <div
          className="fixed inset-0 z-30 bg-background/80 backdrop-blur-sm md:hidden"
          onClick={toggleSidebar}
        />
      )}
    </div>
  );
}
```

### Sidebar Component
```typescript
interface SidebarProps {
  collapsed?: boolean;
}

export function Sidebar({ collapsed }: SidebarProps) {
  const location = useLocation();
  const { user } = useAuthStore();
  
  const navigation = [
    {
      name: 'Dashboard',
      href: routes.home,
      icon: LayoutDashboard,
      current: location.pathname === routes.home,
    },
    {
      name: 'Emails',
      href: routes.emails,
      icon: Mail,
      current: location.pathname.startsWith(routes.emails),
      badge: useUnreadEmailCount(),
    },
    {
      name: 'Settings',
      href: routes.settings,
      icon: Settings,
      current: location.pathname.startsWith(routes.settings),
    },
  ];
  
  return (
    <div className="flex h-full flex-col">
      {/* User Info */}
      <div className="p-4 border-b">
        {!collapsed ? (
          <div className="flex items-center space-x-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={user?.picture} />
              <AvatarFallback>
                {getInitials(user?.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{user?.name}</p>
              <p className="text-sm text-muted-foreground truncate">
                {user?.email}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex justify-center">
            <Avatar className="h-8 w-8">
              <AvatarImage src={user?.picture} />
              <AvatarFallback>
                {getInitials(user?.name)}
              </AvatarFallback>
            </Avatar>
          </div>
        )}
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {navigation.map((item) => (
            <li key={item.name}>
              <Link
                to={item.href}
                className={cn(
                  "flex items-center space-x-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  item.current
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                {!collapsed && (
                  <>
                    <span className="flex-1">{item.name}</span>
                    {item.badge && item.badge > 0 && (
                      <Badge variant="secondary" className="ml-auto">
                        {item.badge}
                      </Badge>
                    )}
                  </>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      
      {/* Footer */}
      <div className="p-4 border-t">
        <SyncStatus collapsed={collapsed} />
      </div>
    </div>
  );
}
```

## Utility Components

### LoadingSpinner Component
```typescript
interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LoadingSpinner({ size = 'md', className }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  };
  
  return (
    <div className={cn("animate-spin", sizeClasses[size], className)}>
      <svg
        className="h-full w-full"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    </div>
  );
}
```

### EmptyState Component
```typescript
interface EmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>;
  title?: string;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  message,
  action,
  className
}: EmptyStateProps) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center p-8 text-center",
      className
    )}>
      <Icon className="h-12 w-12 text-muted-foreground mb-4" />
      {title && (
        <h3 className="text-lg font-medium mb-2">{title}</h3>
      )}
      <p className="text-muted-foreground mb-4 max-w-sm">{message}</p>
      {action && (
        <Button onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
```

### ErrorMessage Component
```typescript
interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorMessage({ message, onRetry, className }: ErrorMessageProps) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center p-8 text-center",
      className
    )}>
      <AlertCircle className="h-12 w-12 text-destructive mb-4" />
      <h3 className="text-lg font-medium mb-2">Something went wrong</h3>
      <p className="text-muted-foreground mb-4 max-w-sm">{message}</p>
      {onRetry && (
        <Button onClick={onRetry} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Try again
        </Button>
      )}
    </div>
  );
}
```