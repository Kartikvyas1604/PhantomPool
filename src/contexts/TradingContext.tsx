'use client';

import React, { createContext, useContext, useReducer, useEffect, useCallback, ReactNode } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { getAPIService, PhantomPoolAPIService, Order, Trade, OrderBook, ApiResponse } from '../services/api.service';

interface TradingState {
  // Connection State
  isConnected: boolean;
  isAuthenticated: boolean;
  connectionError: string | null;
  
  // Orders
  orders: Order[];
  activeOrders: Order[];
  orderHistory: Order[];
  isSubmittingOrder: boolean;
  orderError: string | null;
  
  // Trades
  trades: Trade[];
  recentTrades: Trade[];
  isExecutingTrade: boolean;
  tradeError: string | null;
  
  // OrderBook
  orderBook: OrderBook | null;
  orderBookUpdates: number;
  
  // System Status
  systemStatus: {
    healthy: boolean;
    uptime: number;
    connectedClients: number;
    totalOrders: number;
    activeTrades: number;
  };
  
  // Real-time Updates
  lastUpdate: number;
  notifications: TradingNotification[];
}

interface TradingNotification {
  id: string;
  type: 'order' | 'trade' | 'system' | 'error';
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  severity: 'info' | 'success' | 'warning' | 'error';
}

type TradingAction = 
  | { type: 'SET_CONNECTION_STATUS'; payload: { isConnected: boolean; isAuthenticated: boolean; error?: string } }
  | { type: 'SET_ORDERS'; payload: Order[] }
  | { type: 'ADD_ORDER'; payload: Order }
  | { type: 'UPDATE_ORDER'; payload: Order }
  | { type: 'REMOVE_ORDER'; payload: string }
  | { type: 'SET_ORDER_SUBMITTING'; payload: boolean }
  | { type: 'SET_ORDER_ERROR'; payload: string | null }
  | { type: 'SET_TRADES'; payload: Trade[] }
  | { type: 'ADD_TRADE'; payload: Trade }
  | { type: 'SET_TRADE_EXECUTING'; payload: boolean }
  | { type: 'SET_TRADE_ERROR'; payload: string | null }
  | { type: 'SET_ORDERBOOK'; payload: OrderBook }
  | { type: 'UPDATE_ORDERBOOK'; payload: Partial<OrderBook> }
  | { type: 'SET_SYSTEM_STATUS'; payload: Partial<TradingState['systemStatus']> }
  | { type: 'ADD_NOTIFICATION'; payload: TradingNotification }
  | { type: 'MARK_NOTIFICATION_READ'; payload: string }
  | { type: 'CLEAR_NOTIFICATIONS' }
  | { type: 'UPDATE_TIMESTAMP' };

const initialState: TradingState = {
  isConnected: false,
  isAuthenticated: false,
  connectionError: null,
  orders: [],
  activeOrders: [],
  orderHistory: [],
  isSubmittingOrder: false,
  orderError: null,
  trades: [],
  recentTrades: [],
  isExecutingTrade: false,
  tradeError: null,
  orderBook: null,
  orderBookUpdates: 0,
  systemStatus: {
    healthy: false,
    uptime: 0,
    connectedClients: 0,
    totalOrders: 0,
    activeTrades: 0
  },
  lastUpdate: Date.now(),
  notifications: []
};

function tradingReducer(state: TradingState, action: TradingAction): TradingState {
  switch (action.type) {
    case 'SET_CONNECTION_STATUS':
      return {
        ...state,
        isConnected: action.payload.isConnected,
        isAuthenticated: action.payload.isAuthenticated,
        connectionError: action.payload.error || null
      };

    case 'SET_ORDERS':
      const activeOrders = action.payload.filter(order => 
        ['pending', 'partial', 'open'].includes(order.status || 'pending')
      );
      const orderHistory = action.payload.filter(order => 
        ['filled', 'cancelled', 'rejected'].includes(order.status || 'pending')
      );
      
      return {
        ...state,
        orders: action.payload,
        activeOrders,
        orderHistory
      };

    case 'ADD_ORDER':
      const newOrder = action.payload;
      const updatedOrders = [newOrder, ...state.orders];
      const newActiveOrders = ['pending', 'partial', 'open'].includes(newOrder.status || 'pending')
        ? [newOrder, ...state.activeOrders]
        : state.activeOrders;
      
      return {
        ...state,
        orders: updatedOrders,
        activeOrders: newActiveOrders,
        lastUpdate: Date.now()
      };

    case 'UPDATE_ORDER':
      const updatedOrder = action.payload;
      const orderIndex = state.orders.findIndex(o => o.id === updatedOrder.id);
      
      if (orderIndex === -1) return state;
      
      const newOrdersList = [...state.orders];
      newOrdersList[orderIndex] = updatedOrder;
      
      const newActiveOrdersList = newOrdersList.filter(order => 
        ['pending', 'partial', 'open'].includes(order.status || 'pending')
      );
      const newOrderHistoryList = newOrdersList.filter(order => 
        ['filled', 'cancelled', 'rejected'].includes(order.status || 'pending')
      );
      
      return {
        ...state,
        orders: newOrdersList,
        activeOrders: newActiveOrdersList,
        orderHistory: newOrderHistoryList,
        lastUpdate: Date.now()
      };

    case 'REMOVE_ORDER':
      const filteredOrders = state.orders.filter(o => o.id !== action.payload);
      const filteredActiveOrders = state.activeOrders.filter(o => o.id !== action.payload);
      
      return {
        ...state,
        orders: filteredOrders,
        activeOrders: filteredActiveOrders
      };

    case 'SET_ORDER_SUBMITTING':
      return { ...state, isSubmittingOrder: action.payload };

    case 'SET_ORDER_ERROR':
      return { ...state, orderError: action.payload };

    case 'SET_TRADES':
      return {
        ...state,
        trades: action.payload,
        recentTrades: action.payload.slice(0, 10)
      };

    case 'ADD_TRADE':
      const newTrade = action.payload;
      const updatedTrades = [newTrade, ...state.trades];
      
      return {
        ...state,
        trades: updatedTrades,
        recentTrades: updatedTrades.slice(0, 10),
        lastUpdate: Date.now()
      };

    case 'SET_TRADE_EXECUTING':
      return { ...state, isExecutingTrade: action.payload };

    case 'SET_TRADE_ERROR':
      return { ...state, tradeError: action.payload };

    case 'SET_ORDERBOOK':
      return {
        ...state,
        orderBook: action.payload,
        orderBookUpdates: state.orderBookUpdates + 1,
        lastUpdate: Date.now()
      };

    case 'UPDATE_ORDERBOOK':
      return {
        ...state,
        orderBook: state.orderBook ? { ...state.orderBook, ...action.payload } : null,
        orderBookUpdates: state.orderBookUpdates + 1,
        lastUpdate: Date.now()
      };

    case 'SET_SYSTEM_STATUS':
      return {
        ...state,
        systemStatus: { ...state.systemStatus, ...action.payload }
      };

    case 'ADD_NOTIFICATION':
      return {
        ...state,
        notifications: [action.payload, ...state.notifications.slice(0, 49)] // Keep last 50
      };

    case 'MARK_NOTIFICATION_READ':
      return {
        ...state,
        notifications: state.notifications.map(n => 
          n.id === action.payload ? { ...n, read: true } : n
        )
      };

    case 'CLEAR_NOTIFICATIONS':
      return {
        ...state,
        notifications: []
      };

    case 'UPDATE_TIMESTAMP':
      return {
        ...state,
        lastUpdate: Date.now()
      };

    default:
      return state;
  }
}

interface TradingContextValue extends TradingState {
  // API Methods
  submitOrder: (order: Omit<Order, 'id' | 'timestamp'>) => Promise<boolean>;
  cancelOrder: (orderId: string) => Promise<boolean>;
  executeOrder: (orderId: string, executionData: { amount: string; price: string }) => Promise<boolean>;
  refreshOrders: () => Promise<void>;
  refreshTrades: () => Promise<void>;
  refreshOrderBook: (token?: string) => Promise<void>;
  refreshSystemStatus: () => Promise<void>;
  
  // WebSocket Methods
  subscribeToChannel: (channel: string, filters?: object) => boolean;
  unsubscribeFromChannel: (channel: string) => boolean;
  
  // Utility Methods
  addNotification: (notification: Omit<TradingNotification, 'id' | 'timestamp' | 'read'>) => void;
  markNotificationRead: (notificationId: string) => void;
  clearNotifications: () => void;
  getUnreadNotifications: () => TradingNotification[];
}

const TradingContext = createContext<TradingContextValue | null>(null);

interface TradingProviderProps {
  children: ReactNode;
  userId?: string;
  apiBaseUrl?: string;
  wsUrl?: string;
}

export function TradingProvider({ 
  children, 
  userId = 'trading_user_' + Date.now(),
  apiBaseUrl = 'http://localhost:8080/api',
  wsUrl = 'ws://localhost:8080/ws'
}: TradingProviderProps) {
  const [state, dispatch] = useReducer(tradingReducer, initialState);
  
  // Initialize API service
  const apiService = getAPIService(apiBaseUrl, userId);
  
  // Initialize WebSocket
  const webSocket = useWebSocket({
    url: wsUrl,
    userId,
    autoReconnect: true,
    maxReconnectAttempts: 10
  });

  // Helper function to add notifications
  const addNotification = useCallback((notification: Omit<TradingNotification, 'id' | 'timestamp' | 'read'>) => {
    const fullNotification: TradingNotification = {
      ...notification,
      id: `notification_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      timestamp: Date.now(),
      read: false
    };
    dispatch({ type: 'ADD_NOTIFICATION', payload: fullNotification });
  }, []);

  // Update connection status
  useEffect(() => {
    dispatch({
      type: 'SET_CONNECTION_STATUS',
      payload: {
        isConnected: webSocket.isConnected,
        isAuthenticated: webSocket.isAuthenticated,
        error: webSocket.error || undefined
      }
    });
  }, [webSocket.isConnected, webSocket.isAuthenticated, webSocket.error]);

  // Set up WebSocket message handlers
  useEffect(() => {
    if (!webSocket.isReady) return;

    const unsubscribeHandlers: (() => void)[] = [];

    // Handle order updates
    unsubscribeHandlers.push(
      webSocket.onMessage('order_update', (message) => {
        if (message.order) {
          dispatch({ type: 'UPDATE_ORDER', payload: message.order });
          addNotification({
            type: 'order',
            title: 'Order Updated',
            message: `Order ${message.order.id} status: ${message.order.status}`,
            severity: message.order.status === 'filled' ? 'success' : 'info'
          });
        }
      })
    );

    // Handle trade executions
    unsubscribeHandlers.push(
      webSocket.onMessage('trade_execution', (message) => {
        if (message.trade) {
          dispatch({ type: 'ADD_TRADE', payload: message.trade });
          addNotification({
            type: 'trade',
            title: 'Trade Executed',
            message: `${message.trade.amount} ${message.trade.token || 'SOL'} @ ${message.trade.price}`,
            severity: 'success'
          });
        }
      })
    );

    // Handle orderbook updates
    unsubscribeHandlers.push(
      webSocket.onMessage('orderbook_update', (message) => {
        if (message.orderbook) {
          dispatch({ type: 'UPDATE_ORDERBOOK', payload: message.orderbook });
        }
      })
    );

    // Handle system updates
    unsubscribeHandlers.push(
      webSocket.onMessage('system_update', (message) => {
        if (message.status) {
          dispatch({ type: 'SET_SYSTEM_STATUS', payload: message.status });
        }
        
        if (message.message) {
          addNotification({
            type: 'system',
            title: 'System Update',
            message: message.message,
            severity: message.severity || 'info'
          });
        }
      })
    );

    // Handle admin broadcasts
    unsubscribeHandlers.push(
      webSocket.onMessage('admin_broadcast', (message) => {
        addNotification({
          type: 'system',
          title: 'System Notice',
          message: message.message || 'System notification',
          severity: message.severity || 'info'
        });
      })
    );

    return () => {
      unsubscribeHandlers.forEach(unsubscribe => unsubscribe());
    };
  }, [webSocket.isReady, webSocket.onMessage, addNotification]);

  // Subscribe to channels when authenticated
  useEffect(() => {
    if (webSocket.isReady) {
      webSocket.subscribe('orders');
      webSocket.subscribe('trades');
      webSocket.subscribe('orderbook', { token: 'SOL' });
      webSocket.subscribe('system');
      webSocket.subscribe('portfolio');
      
      addNotification({
        type: 'system',
        title: 'Connected',
        message: 'Real-time trading interface connected',
        severity: 'success'
      });
    }
  }, [webSocket.isReady, webSocket.subscribe, addNotification]);

  // API Methods
  const submitOrder = useCallback(async (order: Omit<Order, 'id' | 'timestamp'>): Promise<boolean> => {
    dispatch({ type: 'SET_ORDER_SUBMITTING', payload: true });
    dispatch({ type: 'SET_ORDER_ERROR', payload: null });

    try {
      const response = await apiService.createOrder(order);
      
      if (response.success && response.data) {
        dispatch({ type: 'ADD_ORDER', payload: response.data });
        addNotification({
          type: 'order',
          title: 'Order Submitted',
          message: `${order.type.toUpperCase()} order for ${order.amount} ${order.token || 'SOL'}`,
          severity: 'success'
        });
        return true;
      } else {
        const errorMessage = response.error || 'Failed to submit order';
        dispatch({ type: 'SET_ORDER_ERROR', payload: errorMessage });
        addNotification({
          type: 'error',
          title: 'Order Failed',
          message: errorMessage,
          severity: 'error'
        });
        return false;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      dispatch({ type: 'SET_ORDER_ERROR', payload: errorMessage });
      addNotification({
        type: 'error',
        title: 'Order Error',
        message: errorMessage,
        severity: 'error'
      });
      return false;
    } finally {
      dispatch({ type: 'SET_ORDER_SUBMITTING', payload: false });
    }
  }, [apiService, addNotification]);

  const cancelOrder = useCallback(async (orderId: string): Promise<boolean> => {
    try {
      const response = await apiService.cancelOrder(orderId);
      
      if (response.success) {
        dispatch({ type: 'REMOVE_ORDER', payload: orderId });
        addNotification({
          type: 'order',
          title: 'Order Cancelled',
          message: `Order ${orderId} has been cancelled`,
          severity: 'info'
        });
        return true;
      } else {
        addNotification({
          type: 'error',
          title: 'Cancel Failed',
          message: response.error || 'Failed to cancel order',
          severity: 'error'
        });
        return false;
      }
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Cancel Error',
        message: error instanceof Error ? error.message : 'Unknown error',
        severity: 'error'
      });
      return false;
    }
  }, [apiService, addNotification]);

  const executeOrder = useCallback(async (
    orderId: string, 
    executionData: { amount: string; price: string }
  ): Promise<boolean> => {
    dispatch({ type: 'SET_TRADE_EXECUTING', payload: true });
    dispatch({ type: 'SET_TRADE_ERROR', payload: null });

    try {
      const response = await apiService.executeOrder(orderId, executionData);
      
      if (response.success) {
        addNotification({
          type: 'trade',
          title: 'Order Executed',
          message: `Executed ${executionData.amount} @ ${executionData.price}`,
          severity: 'success'
        });
        return true;
      } else {
        const errorMessage = response.error || 'Failed to execute order';
        dispatch({ type: 'SET_TRADE_ERROR', payload: errorMessage });
        addNotification({
          type: 'error',
          title: 'Execution Failed',
          message: errorMessage,
          severity: 'error'
        });
        return false;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      dispatch({ type: 'SET_TRADE_ERROR', payload: errorMessage });
      addNotification({
        type: 'error',
        title: 'Execution Error',
        message: errorMessage,
        severity: 'error'
      });
      return false;
    } finally {
      dispatch({ type: 'SET_TRADE_EXECUTING', payload: false });
    }
  }, [apiService, addNotification]);

  // Data refresh methods
  const refreshOrders = useCallback(async () => {
    try {
      const response = await apiService.getOrders();
      if (response.success && response.data && Array.isArray(response.data)) {
        dispatch({ type: 'SET_ORDERS', payload: response.data });
      }
    } catch (error) {
      console.error('Failed to refresh orders:', error);
    }
  }, [apiService]);

  const refreshTrades = useCallback(async () => {
    try {
      const response = await apiService.getTrades();
      if (response.success && response.data && Array.isArray(response.data)) {
        dispatch({ type: 'SET_TRADES', payload: response.data });
      }
    } catch (error) {
      console.error('Failed to refresh trades:', error);
    }
  }, [apiService]);

  const refreshOrderBook = useCallback(async (token: string = 'SOL') => {
    try {
      const response = await apiService.getOrderBook(token);
      if (response.success && response.data) {
        dispatch({ type: 'SET_ORDERBOOK', payload: response.data });
      }
    } catch (error) {
      console.error('Failed to refresh order book:', error);
    }
  }, [apiService]);

  const refreshSystemStatus = useCallback(async () => {
    try {
      const [healthResponse, dashboardResponse] = await Promise.all([
        apiService.getHealth(),
        apiService.getDashboard()
      ]);

      const status: Partial<TradingState['systemStatus']> = {};

      if (healthResponse.success && healthResponse.data) {
        const healthData = healthResponse.data as any;
        status.healthy = healthData.status === 'healthy';
        status.uptime = healthData.uptime || 0;
      }

      if (dashboardResponse.success && dashboardResponse.data) {
        const dashboardData = dashboardResponse.data as any;
        status.connectedClients = dashboardData.websocket?.connected_clients || 0;
        status.totalOrders = dashboardData.orders?.total || 0;
        status.activeTrades = dashboardData.trades?.active || 0;
      }

      dispatch({ type: 'SET_SYSTEM_STATUS', payload: status });
    } catch (error) {
      console.error('Failed to refresh system status:', error);
    }
  }, [apiService]);

  // Initial data load
  useEffect(() => {
    if (webSocket.isReady) {
      refreshOrders();
      refreshTrades();
      refreshOrderBook();
      refreshSystemStatus();
    }
  }, [webSocket.isReady, refreshOrders, refreshTrades, refreshOrderBook, refreshSystemStatus]);

  // Periodic status updates
  useEffect(() => {
    if (!webSocket.isReady) return;

    const interval = setInterval(() => {
      refreshSystemStatus();
      dispatch({ type: 'UPDATE_TIMESTAMP' });
    }, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, [webSocket.isReady, refreshSystemStatus]);

  const contextValue: TradingContextValue = {
    ...state,
    
    // API Methods
    submitOrder,
    cancelOrder,
    executeOrder,
    refreshOrders,
    refreshTrades,
    refreshOrderBook,
    refreshSystemStatus,
    
    // WebSocket Methods
    subscribeToChannel: webSocket.subscribe,
    unsubscribeFromChannel: webSocket.unsubscribe,
    
    // Utility Methods
    addNotification,
    markNotificationRead: (id: string) => dispatch({ type: 'MARK_NOTIFICATION_READ', payload: id }),
    clearNotifications: () => dispatch({ type: 'CLEAR_NOTIFICATIONS' }),
    getUnreadNotifications: () => state.notifications.filter(n => !n.read)
  };

  return (
    <TradingContext.Provider value={contextValue}>
      {children}
    </TradingContext.Provider>
  );
}

export function useTrading(): TradingContextValue {
  const context = useContext(TradingContext);
  if (!context) {
    throw new Error('useTrading must be used within a TradingProvider');
  }
  return context;
}

export type { TradingState, TradingNotification };