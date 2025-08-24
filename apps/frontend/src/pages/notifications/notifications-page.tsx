import React from 'react';
import { useNotifications } from '@/providers/notification-provider';

/**
 * @component NotificationsPage
 * @purpose Full notifications management page
 */
export default function NotificationsPage() {
  const { notifications, markAsRead, markAllAsRead, dismiss } = useNotifications();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Notifications</h1>
          <p className="text-muted-foreground">
            Manage your system notifications and alerts.
          </p>
        </div>
        
        {notifications.length > 0 && (
          <button
            onClick={markAllAsRead}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            Mark All Read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-8 text-center">
          <svg className="w-12 h-12 text-muted-foreground mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM10.07 2.82l3.12 3.12M7.05 5.84l3.12 3.12M3.82 10.07l3.12 3.12M5.84 7.05l3.12 3.12" />
          </svg>
          <h3 className="text-lg font-medium text-foreground mb-2">
            No Notifications
          </h3>
          <p className="text-muted-foreground">
            You're all caught up! New notifications will appear here when they arrive.
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg divide-y divide-border">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`p-6 ${!notification.readAt && !notification.dismissedAt ? 'bg-primary/5' : ''}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-medium text-foreground mb-2">
                    {notification.title}
                  </h3>
                  <p className="text-muted-foreground mb-3">
                    {notification.message}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(notification.createdAt).toLocaleString()}
                  </p>
                  
                  {notification.actionUrl && notification.actionLabel && (
                    <div className="mt-4">
                      <a
                        href={notification.actionUrl}
                        className="inline-flex items-center text-primary hover:text-primary/80 font-medium"
                      >
                        {notification.actionLabel}
                        <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </a>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center space-x-2 ml-4">
                  {!notification.readAt && !notification.dismissedAt && (
                    <button
                      onClick={() => markAsRead(notification.id)}
                      className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                      title="Mark as read"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                  )}
                  
                  <button
                    onClick={() => dismiss(notification.id)}
                    className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                    title="Dismiss"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}