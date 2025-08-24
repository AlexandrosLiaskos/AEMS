import React from 'react';
import { useNotifications } from '@/providers/notification-provider';
import { cn } from '@/utils/cn';

interface NotificationPanelProps {
  open: boolean;
  onClose: () => void;
}

/**
 * @component NotificationPanel
 * @purpose Slide-out panel for notifications
 */
export function NotificationPanel({ open, onClose }: NotificationPanelProps) {
  const { notifications, markAsRead, markAllAsRead, dismiss } = useNotifications();

  const handleMarkAsRead = (id: string) => {
    markAsRead(id);
  };

  const handleDismiss = (id: string) => {
    dismiss(id);
  };

  return (
    <>
      {/* Overlay */}
      {open && (
        <div 
          className="fixed inset-0 z-40 bg-black/50"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div className={cn(
        'fixed inset-y-0 right-0 z-50 w-96 bg-background border-l border-border transform transition-transform duration-200 ease-in-out',
        open ? 'translate-x-0' : 'translate-x-full'
      )}>
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h2 className="text-lg font-semibold text-foreground">
              Notifications
            </h2>
            <div className="flex items-center space-x-2">
              {notifications.length > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-sm text-primary hover:text-primary/80"
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={onClose}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Notifications list */}
          <div className="flex-1 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-6">
                <svg className="w-12 h-12 text-muted-foreground mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM10.07 2.82l3.12 3.12M7.05 5.84l3.12 3.12M3.82 10.07l3.12 3.12M5.84 7.05l3.12 3.12" />
                </svg>
                <h3 className="text-lg font-medium text-foreground mb-2">
                  No notifications
                </h3>
                <p className="text-muted-foreground">
                  You're all caught up! New notifications will appear here.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={cn(
                      'p-4 hover:bg-muted/50 transition-colors',
                      !notification.readAt && !notification.dismissedAt && 'bg-primary/5 border-l-4 border-l-primary'
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-foreground mb-1">
                          {notification.title}
                        </h4>
                        <p className="text-sm text-muted-foreground mb-2">
                          {notification.message}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(notification.createdAt).toLocaleString()}
                        </p>
                      </div>
                      
                      <div className="flex items-center space-x-1 ml-2">
                        {!notification.readAt && !notification.dismissedAt && (
                          <button
                            onClick={() => handleMarkAsRead(notification.id)}
                            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                            title="Mark as read"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                        )}
                        
                        <button
                          onClick={() => handleDismiss(notification.id)}
                          className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                          title="Dismiss"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    
                    {notification.actionUrl && notification.actionLabel && (
                      <div className="mt-3">
                        <a
                          href={notification.actionUrl}
                          className="text-sm font-medium text-primary hover:text-primary/80"
                        >
                          {notification.actionLabel} →
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}