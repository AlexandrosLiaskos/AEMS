import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './auth-provider';

// Types
interface Notification {
  id: string;
  type: string;
  priority: string;
  title: string;
  message: string;
  actionUrl?: string;
  actionLabel?: string;
  createdAt: string;
  readAt?: string;
  dismissedAt?: string;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  isConnected: boolean;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
  dismiss: (notificationId: string) => void;
  clearAll: () => void;
}

// Create context
const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// Provider props
interface NotificationProviderProps {
  children: ReactNode;
}

/**
 * @component NotificationProvider
 * @purpose Provides real-time notification context via WebSocket
 */
export function NotificationProvider({ children }: NotificationProviderProps) {
  const { isAuthenticated, token } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  // WebSocket connection management
  useEffect(() => {
    if (!isAuthenticated || !token) {
      // Disconnect if not authenticated
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setIsConnected(false);
        setNotifications([]);
      }
      return;
    }

    // Create WebSocket connection
    const newSocket = io('/notifications', {
      auth: {
        token,
      },
      transports: ['websocket', 'polling'],
      timeout: 20000,
      retries: 3,
    });

    // Connection event handlers
    newSocket.on('connect', () => {
      console.log('Connected to notification service');
      setIsConnected(true);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('Disconnected from notification service:', reason);
      setIsConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('Notification connection error:', error);
      setIsConnected(false);
    });

    // Notification event handlers
    newSocket.on('notification', (notification: Notification) => {
      console.log('New notification received:', notification);
      
      setNotifications(prev => {
        // Check if notification already exists
        const exists = prev.some(n => n.id === notification.id);
        if (exists) return prev;
        
        // Add new notification to the beginning
        return [notification, ...prev];
      });

      // Show browser notification if permission granted
      if (Notification.permission === 'granted') {
        new Notification(notification.title, {
          body: notification.message,
          icon: '/favicon.ico',
          tag: notification.id,
        });
      }
    });

    newSocket.on('notification-read', ({ notificationId, readAt }) => {
      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId
            ? { ...n, readAt }
            : n
        )
      );
    });

    newSocket.on('notification-dismissed', ({ notificationId, dismissedAt }) => {
      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId
            ? { ...n, dismissedAt }
            : n
        )
      );
    });

    newSocket.on('sync-notifications', () => {
      // Trigger notification sync from server
      fetchNotifications();
    });

    setSocket(newSocket);

    // Cleanup on unmount
    return () => {
      newSocket.disconnect();
    };
  }, [isAuthenticated, token]);

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        console.log('Notification permission:', permission);
      });
    }
  }, []);

  // Fetch initial notifications
  const fetchNotifications = async () => {
    if (!isAuthenticated || !token) return;

    try {
      const response = await fetch('/api/notifications?limit=50', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  };

  // Load initial notifications when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchNotifications();
    }
  }, [isAuthenticated]);

  // Mark notification as read
  const markAsRead = async (notificationId: string) => {
    if (!isAuthenticated || !token) return;

    try {
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const readAt = new Date().toISOString();
        setNotifications(prev =>
          prev.map(n =>
            n.id === notificationId
              ? { ...n, readAt }
              : n
          )
        );

        // Emit to WebSocket for real-time sync
        if (socket) {
          socket.emit('mark-as-read', { notificationId });
        }
      }
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  // Mark all notifications as read
  const markAllAsRead = async () => {
    if (!isAuthenticated || !token) return;

    try {
      const response = await fetch('/api/notifications/read-all', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const readAt = new Date().toISOString();
        setNotifications(prev =>
          prev.map(n => ({ ...n, readAt }))
        );
      }
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  // Dismiss notification
  const dismiss = async (notificationId: string) => {
    if (!isAuthenticated || !token) return;

    try {
      const response = await fetch(`/api/notifications/${notificationId}/dismiss`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const dismissedAt = new Date().toISOString();
        setNotifications(prev =>
          prev.map(n =>
            n.id === notificationId
              ? { ...n, dismissedAt }
              : n
          )
        );
      }
    } catch (error) {
      console.error('Failed to dismiss notification:', error);
    }
  };

  // Clear all notifications from UI
  const clearAll = () => {
    setNotifications([]);
  };

  // Calculate unread count
  const unreadCount = notifications.filter(n => !n.readAt && !n.dismissedAt).length;

  const contextValue: NotificationContextType = {
    notifications,
    unreadCount,
    isConnected,
    markAsRead,
    markAllAsRead,
    dismiss,
    clearAll,
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  );
}

/**
 * @hook useNotifications
 * @purpose Hook to access notification context
 */
export function useNotifications(): NotificationContextType {
  const context = useContext(NotificationContext);
  
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  
  return context;
}