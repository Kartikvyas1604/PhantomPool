'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

interface WebSocketConfig {
  url: string;
  userId?: string;
  autoReconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

interface WebSocketState {
  isConnected: boolean;
  isConnecting: boolean;
  isAuthenticated: boolean;
  error: string | null;
  messages: WebSocketMessage[];
  connectionId: string | null;
}

export function useWebSocket(config: WebSocketConfig) {
  const [state, setState] = useState<WebSocketState>({
    isConnected: false,
    isConnecting: false,
    isAuthenticated: false,
    error: null,
    messages: [],
    connectionId: null
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const messageHandlers = useRef<Map<string, (message: WebSocketMessage) => void>>(new Map());

  const { 
    url, 
    userId = 'default_user', 
    autoReconnect = true, 
    reconnectInterval = 3000,
    maxReconnectAttempts = 5 
  } = config;

  const updateState = useCallback((updates: Partial<WebSocketState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    updateState({ isConnecting: true, error: null });

    try {
      wsRef.current = new WebSocket(url);

      wsRef.current.onopen = () => {
        console.log('🔌 WebSocket connected');
        updateState({ 
          isConnected: true, 
          isConnecting: false, 
          error: null 
        });
        reconnectAttempts.current = 0;

        // Authenticate immediately after connection
        if (wsRef.current) {
          wsRef.current.send(JSON.stringify({
            type: 'auth',
            token: `bearer_${userId}`
          }));
        }
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          
          console.log('📨 WebSocket message:', message.type, message);

          // Handle authentication
          if (message.type === 'auth_success') {
            updateState({ 
              isAuthenticated: true, 
              connectionId: message.clientId 
            });
          }

          // Add message to state
          setState(prev => ({
            ...prev,
            messages: [...prev.messages.slice(-99), message] // Keep last 100 messages
          }));

          // Call specific message handlers
          const handler = messageHandlers.current.get(message.type);
          if (handler) {
            handler(message);
          }

          // Call generic message handler
          const genericHandler = messageHandlers.current.get('*');
          if (genericHandler) {
            genericHandler(message);
          }

        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      wsRef.current.onclose = (event) => {
        console.log('🔌 WebSocket disconnected:', event.code, event.reason);
        updateState({ 
          isConnected: false, 
          isAuthenticated: false, 
          connectionId: null,
          error: event.reason || 'Connection closed' 
        });

        // Auto-reconnect logic
        if (autoReconnect && reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++;
          console.log(`🔄 Reconnecting... Attempt ${reconnectAttempts.current}/${maxReconnectAttempts}`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectInterval);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        updateState({ 
          error: 'WebSocket connection error',
          isConnecting: false 
        });
      };

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      updateState({ 
        error: 'Failed to create WebSocket connection',
        isConnecting: false 
      });
    }
  }, [url, userId, autoReconnect, reconnectInterval, maxReconnectAttempts, updateState]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close(1000, 'Client disconnecting');
      wsRef.current = null;
    }

    updateState({ 
      isConnected: false, 
      isAuthenticated: false, 
      connectionId: null,
      error: null 
    });
  }, [updateState]);

  const sendMessage = useCallback((message: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
      return true;
    } else {
      console.warn('⚠️ Cannot send message: WebSocket not connected');
      updateState({ error: 'Cannot send message: Not connected' });
      return false;
    }
  }, [updateState]);

  const subscribe = useCallback((channel: string, filters?: object) => {
    return sendMessage({
      type: 'subscribe',
      channel,
      filters
    });
  }, [sendMessage]);

  const unsubscribe = useCallback((channel: string) => {
    return sendMessage({
      type: 'unsubscribe',
      channel
    });
  }, [sendMessage]);

  const onMessage = useCallback((messageType: string, handler: (message: WebSocketMessage) => void) => {
    messageHandlers.current.set(messageType, handler);
    
    return () => {
      messageHandlers.current.delete(messageType);
    };
  }, []);

  // Connect on mount
  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  return {
    ...state,
    connect,
    disconnect,
    sendMessage,
    subscribe,
    unsubscribe,
    onMessage,
    
    // Convenience methods
    isReady: state.isConnected && state.isAuthenticated,
    lastMessage: state.messages[state.messages.length - 1] || null,
    reconnectAttempts: reconnectAttempts.current
  };
}