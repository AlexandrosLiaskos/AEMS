import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';
import { useAuth } from './useAuth';

// Types
interface WebSocketOptions {
  autoConnect?: boolean;
  reconnectAttempts?: number;
  reconnectDelay?: number;
}

interface ConnectionState {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  reconnectAttempts: number;
}

interface NotificationData {
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  duration?: number;
}

interface ProgressData {
  id: string;
  title: string;
  progress: number;
  status: 'running' | 'completed' | 'error' | 'cancelled';
  message?: string;
}

/**
 * @hook useWebSocket
 * @purpose Hook for managing WebSocket connection and real-time updates
 */
export const useWebSocket = (options: WebSocketOptions = {}) => {
  const { user, token } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    isConnected: false,
    isConnecting: false,
    error: null,
    reconnectAttempts: 0,
  });

  const [lastMessage, setLastMessage] = useState<any>(null);
  const [pipelineStatus, setPipelineStatus] = useState<any>(null);
  const [progressUpdates, setProgressUpdates] = useState<Map<string, ProgressData>>(new Map());

  const {
    autoConnect = true,
    reconnectAttempts = 5,
    reconnectDelay = 1000,
  } = options;

  /**
   * Connect to WebSocket server
   */
  const connect = useCallback(() => {
    if (!user || !token || socketRef.current?.connected) {
      return;
    }

    setConnectionState(prev => ({ ...prev, isConnecting: true, error: null }));

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3000/ws';
    
    const socket = io(wsUrl, {
      auth: {
        token: token,
      },
      transports: ['websocket', 'polling'],
      timeout: 10000,
      reconnection: true,
      reconnectionAttempts: reconnectAttempts,
      reconnectionDelay: reconnectDelay,
    });

    // Connection events
    socket.on('connect', () => {
      console.log('WebSocket connected');
      setConnectionState({
        isConnected: true,
        isConnecting: false,
        error: null,
        reconnectAttempts: 0,
      });
      toast.success('Connected to real-time updates');
    });

    socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      setConnectionState(prev => ({
        ...prev,
        isConnected: false,
        isConnecting: false,
        error: reason,
      }));
      
      if (reason !== 'io client disconnect') {
        toast.warning('Lost connection to real-time updates');
      }
    });

    socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      setConnectionState(prev => ({
        ...prev,
        isConnected: false,
        isConnecting: false,
        error: error.message,
        reconnectAttempts: prev.reconnectAttempts + 1,
      }));
      
      if (connectionState.reconnectAttempts === 0) {
        toast.error('Failed to connect to real-time updates');
      }
    });

    socket.on('reconnect', (attemptNumber) => {
      console.log('WebSocket reconnected after', attemptNumber, 'attempts');
      toast.success('Reconnected to real-time updates');
    });

    socket.on('reconnect_failed', () => {
      console.error('WebSocket reconnection failed');
      toast.error('Failed to reconnect to real-time updates');
    });

    // Application events
    socket.on('connected', (data) => {
      console.log('WebSocket welcome:', data);
      setLastMessage({ type: 'connected', data });
    });

    // Notification events
    socket.on('notification', (data: NotificationData) => {
      setLastMessage({ type: 'notification', data });
      
      switch (data.type) {
        case 'success':
          toast.success(data.title, { description: data.message });
          break;
        case 'error':
          toast.error(data.title, { description: data.message });
          break;
        case 'warning':
          toast.warning(data.title, { description: data.message });
          break;
        default:
          toast.info(data.title, { description: data.message });
      }
    });

    // Progress events
    socket.on('progress:update', (data: ProgressData) => {
      setProgressUpdates(prev => new Map(prev.set(data.id, data)));
      setLastMessage({ type: 'progress', data });
    });

    // Pipeline events
    socket.on('pipeline:started', (data) => {
      setPipelineStatus({ ...data, status: 'running' });
      setLastMessage({ type: 'pipeline:started', data });
      toast.info('Pipeline started', { description: 'Email processing has begun' });
    });

    socket.on('pipeline:progress', (data) => {
      setPipelineStatus(prev => ({ ...prev, ...data }));
      setLastMessage({ type: 'pipeline:progress', data });
    });

    socket.on('pipeline:completed', (data) => {
      setPipelineStatus({ ...data, status: 'completed' });
      setLastMessage({ type: 'pipeline:completed', data });
      
      if (data.result?.success) {
        toast.success('Pipeline completed', { 
          description: `Processed ${data.result.processed} emails` 
        });
      } else {
        toast.error('Pipeline completed with errors', {
          description: `${data.result?.errors || 0} errors occurred`
        });
      }
    });

    socket.on('pipeline:error', (data) => {
      setPipelineStatus({ ...data, status: 'error' });
      setLastMessage({ type: 'pipeline:error', data });
      toast.error('Pipeline error', { description: data.error });
    });

    // Gmail events
    socket.on('gmail:sync:started', (data) => {
      setLastMessage({ type: 'gmail:sync:started', data });
      toast.info('Gmail sync started');
    });

    socket.on('gmail:sync:progress', (data) => {
      setLastMessage({ type: 'gmail:sync:progress', data });
    });

    socket.on('gmail:sync:completed', (data) => {
      setLastMessage({ type: 'gmail:sync:completed', data });
      toast.success('Gmail sync completed', {
        description: `Synced ${data.emailsAdded || 0} new emails`
      });
    });

    // Email events
    socket.on('email:classified', (data) => {
      setLastMessage({ type: 'email:classified', data });
    });

    socket.on('email:extracted', (data) => {
      setLastMessage({ type: 'email:extracted', data });
    });

    // Workflow events
    socket.on('workflow:state:changed', (data) => {
      setLastMessage({ type: 'workflow:state:changed', data });
    });

    // System events
    socket.on('system:notification', (data) => {
      setLastMessage({ type: 'system:notification', data });
      toast.info('System notification', { description: data.message });
    });

    socket.on('system:alert', (data) => {
      setLastMessage({ type: 'system:alert', data });
      
      switch (data.level) {
        case 'critical':
        case 'error':
          toast.error(data.title, { description: data.message });
          break;
        case 'warning':
          toast.warning(data.title, { description: data.message });
          break;
        default:
          toast.info(data.title, { description: data.message });
      }
    });

    // Data update events
    socket.on('data:update', (data) => {
      setLastMessage({ type: 'data:update', data });
    });

    // Stats update events
    socket.on('stats:update', (data) => {
      setLastMessage({ type: 'stats:update', data });
    });

    socketRef.current = socket;
  }, [user, token, reconnectAttempts, reconnectDelay, connectionState.reconnectAttempts]);

  /**
   * Disconnect from WebSocket server
   */
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setConnectionState({
        isConnected: false,
        isConnecting: false,
        error: null,
        reconnectAttempts: 0,
      });
    }
  }, []);

  /**
   * Send message to server
   */
  const sendMessage = useCallback((event: string, data?: any) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data);
    }
  }, []);

  /**
   * Join a room
   */
  const joinRoom = useCallback((room: string) => {
    sendMessage('join:room', { room });
  }, [sendMessage]);

  /**
   * Leave a room
   */
  const leaveRoom = useCallback((room: string) => {
    sendMessage('leave:room', { room });
  }, [sendMessage]);

  /**
   * Send ping to server
   */
  const ping = useCallback(() => {
    sendMessage('ping');
  }, [sendMessage]);

  /**
   * Subscribe to custom event
   */
  const subscribe = useCallback((event: string, handler: (data: any) => void) => {
    if (socketRef.current) {
      socketRef.current.on(event, handler);
      
      return () => {
        if (socketRef.current) {
          socketRef.current.off(event, handler);
        }
      };
    }
  }, []);

  // Auto-connect when user is available
  useEffect(() => {
    if (autoConnect && user && token && !socketRef.current) {
      connect();
    }

    return () => {
      if (socketRef.current) {
        disconnect();
      }
    };
  }, [user, token, autoConnect, connect, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    // Connection state
    ...connectionState,
    
    // Data
    lastMessage,
    pipelineStatus,
    progressUpdates: Array.from(progressUpdates.values()),
    
    // Actions
    connect,
    disconnect,
    sendMessage,
    joinRoom,
    leaveRoom,
    ping,
    subscribe,
    
    // Socket instance (for advanced usage)
    socket: socketRef.current,
  };
};