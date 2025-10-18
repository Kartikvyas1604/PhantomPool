/**
 * WebSocket Service Manager
 * Handles real-time communication for PhantomPool trading
 */

const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');

class PhantomPoolWebSocketService {
  constructor(server, options = {}) {
    this.server = server;
    this.options = {
      path: '/ws',
      maxConnections: 1000,
      heartbeatInterval: 30000,
      authTimeout: 10000,
      ...options
    };
    
    this.clients = new Map(); // clientId -> client info
    this.userConnections = new Map(); // userId -> Set of clientIds
    this.channels = new Map(); // channel -> Set of clientIds
    this.metrics = {
      totalConnections: 0,
      activeConnections: 0,
      messagesReceived: 0,
      messagesSent: 0,
      authFailures: 0
    };

    this.setupWebSocketServer();
    this.startHeartbeat();
  }

  setupWebSocketServer() {
    this.wss = new WebSocketServer({
      server: this.server,
      path: this.options.path,
      maxPayload: 64 * 1024, // 64KB max message size
    });

    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });

    console.log(`WebSocket server initialized on ${this.options.path}`);
  }

  handleConnection(ws, req) {
    const clientId = this.generateClientId();
    const clientInfo = {
      id: clientId,
      ws,
      userId: null,
      authenticated: false,
      channels: new Set(),
      lastPing: Date.now(),
      connectedAt: new Date(),
      ip: req.socket.remoteAddress,
      userAgent: req.headers['user-agent']
    };

    this.clients.set(clientId, clientInfo);
    this.metrics.totalConnections++;
    this.metrics.activeConnections++;

    console.log(`[${new Date().toISOString()}] WebSocket client connected: ${clientId}`);

    // Send welcome message
    this.sendToClient(clientId, {
      type: 'welcome',
      clientId,
      message: 'Connected to PhantomPool WebSocket',
      requiresAuth: true,
      timestamp: new Date().toISOString()
    });

    // Set authentication timeout
    const authTimeout = setTimeout(() => {
      if (!clientInfo.authenticated) {
        console.log(`Authentication timeout for client ${clientId}`);
        this.disconnectClient(clientId, 'Authentication timeout');
      }
    }, this.options.authTimeout);

    // Handle messages
    ws.on('message', (data) => {
      this.handleMessage(clientId, data, authTimeout);
    });

    // Handle disconnection
    ws.on('close', () => {
      this.handleDisconnection(clientId);
      clearTimeout(authTimeout);
    });

    // Handle errors
    ws.on('error', (error) => {
      console.error(`WebSocket error for client ${clientId}:`, error);
      this.handleDisconnection(clientId);
      clearTimeout(authTimeout);
    });
  }

  handleMessage(clientId, data, authTimeout) {
    try {
      const message = JSON.parse(data.toString());
      this.metrics.messagesReceived++;

      const client = this.clients.get(clientId);
      if (!client) return;

      client.lastPing = Date.now();

      console.log(`Message from ${clientId}:`, message.type);

      switch (message.type) {
        case 'auth':
          this.handleAuthentication(clientId, message, authTimeout);
          break;
        case 'subscribe':
          this.handleSubscribe(clientId, message);
          break;
        case 'unsubscribe':
          this.handleUnsubscribe(clientId, message);
          break;
        case 'ping':
          this.handlePing(clientId);
          break;
        case 'order_submit':
          this.handleOrderSubmit(clientId, message);
          break;
        case 'trade_request':
          this.handleTradeRequest(clientId, message);
          break;
        default:
          this.sendError(clientId, 'Unknown message type', message.type);
      }
    } catch (error) {
      console.error(`Message parsing error for client ${clientId}:`, error);
      this.sendError(clientId, 'Invalid message format');
    }
  }

  handleAuthentication(clientId, message, authTimeout) {
    const client = this.clients.get(clientId);
    if (!client) return;

    try {
      const { token } = message;
      if (!token) {
        this.sendError(clientId, 'Authentication token required');
        return;
      }

      // In production, verify JWT token
      // For now, mock authentication
      const userId = this.mockVerifyToken(token);
      
      if (userId) {
        client.authenticated = true;
        client.userId = userId;
        
        // Add to user connections
        if (!this.userConnections.has(userId)) {
          this.userConnections.set(userId, new Set());
        }
        this.userConnections.get(userId).add(clientId);

        clearTimeout(authTimeout);

        this.sendToClient(clientId, {
          type: 'auth_success',
          userId,
          availableChannels: [
            'orders',
            'trades',
            'orderbook',
            'system',
            'portfolio'
          ],
          timestamp: new Date().toISOString()
        });

        console.log(`Client ${clientId} authenticated as user ${userId}`);
      } else {
        this.metrics.authFailures++;
        this.sendError(clientId, 'Invalid authentication token');
      }
    } catch (error) {
      this.metrics.authFailures++;
      console.error(`Authentication error for client ${clientId}:`, error);
      this.sendError(clientId, 'Authentication failed');
    }
  }

  handleSubscribe(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client || !client.authenticated) {
      this.sendError(clientId, 'Authentication required');
      return;
    }

    const { channel, filters = {} } = message;
    if (!channel) {
      this.sendError(clientId, 'Channel name required');
      return;
    }

    // Add client to channel
    if (!this.channels.has(channel)) {
      this.channels.set(channel, new Set());
    }
    this.channels.get(channel).add(clientId);
    client.channels.add(channel);

    this.sendToClient(clientId, {
      type: 'subscribed',
      channel,
      filters,
      timestamp: new Date().toISOString()
    });

    console.log(`Client ${clientId} subscribed to channel ${channel}`);

    // Send initial data for the channel
    this.sendChannelInitialData(clientId, channel, filters);
  }

  handleUnsubscribe(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { channel } = message;
    if (!channel) {
      this.sendError(clientId, 'Channel name required');
      return;
    }

    // Remove client from channel
    if (this.channels.has(channel)) {
      this.channels.get(channel).delete(clientId);
      if (this.channels.get(channel).size === 0) {
        this.channels.delete(channel);
      }
    }
    client.channels.delete(channel);

    this.sendToClient(clientId, {
      type: 'unsubscribed',
      channel,
      timestamp: new Date().toISOString()
    });

    console.log(`Client ${clientId} unsubscribed from channel ${channel}`);
  }

  handlePing(clientId) {
    this.sendToClient(clientId, {
      type: 'pong',
      timestamp: new Date().toISOString()
    });
  }

  handleOrderSubmit(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client || !client.authenticated) {
      this.sendError(clientId, 'Authentication required');
      return;
    }

    // Mock order processing
    const orderId = `order_${Date.now()}`;
    
    this.sendToClient(clientId, {
      type: 'order_submitted',
      orderId,
      status: 'pending',
      timestamp: new Date().toISOString()
    });

    // Broadcast to orders channel
    this.broadcastToChannel('orders', {
      type: 'order_update',
      orderId,
      userId: client.userId,
      status: 'pending',
      timestamp: new Date().toISOString()
    });
  }

  handleTradeRequest(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client || !client.authenticated) {
      this.sendError(clientId, 'Authentication required');
      return;
    }

    // Mock trade processing
    const tradeId = `trade_${Date.now()}`;
    
    this.sendToClient(clientId, {
      type: 'trade_submitted',
      tradeId,
      status: 'pending',
      timestamp: new Date().toISOString()
    });

    // Broadcast to trades channel
    this.broadcastToChannel('trades', {
      type: 'trade_execution',
      tradeId,
      status: 'pending',
      timestamp: new Date().toISOString()
    });
  }

  handleDisconnection(clientId) {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Remove from user connections
    if (client.userId && this.userConnections.has(client.userId)) {
      this.userConnections.get(client.userId).delete(clientId);
      if (this.userConnections.get(client.userId).size === 0) {
        this.userConnections.delete(client.userId);
      }
    }

    // Remove from all channels
    client.channels.forEach(channel => {
      if (this.channels.has(channel)) {
        this.channels.get(channel).delete(clientId);
        if (this.channels.get(channel).size === 0) {
          this.channels.delete(channel);
        }
      }
    });

    this.clients.delete(clientId);
    this.metrics.activeConnections--;

    console.log(`[${new Date().toISOString()}] WebSocket client disconnected: ${clientId}`);
  }

  sendChannelInitialData(clientId, channel, filters) {
    const client = this.clients.get(clientId);
    if (!client) return;

    switch (channel) {
      case 'orders':
        this.sendToClient(clientId, {
          type: 'orders_snapshot',
          data: [],
          timestamp: new Date().toISOString()
        });
        break;
      case 'trades':
        this.sendToClient(clientId, {
          type: 'trades_snapshot',
          data: [],
          timestamp: new Date().toISOString()
        });
        break;
      case 'orderbook':
        this.sendToClient(clientId, {
          type: 'orderbook_snapshot',
          token: filters.token || 'SOL',
          bids: [],
          asks: [],
          timestamp: new Date().toISOString()
        });
        break;
      case 'system':
        this.sendToClient(clientId, {
          type: 'system_status',
          status: 'operational',
          timestamp: new Date().toISOString()
        });
        break;
    }
  }

  // Public methods for broadcasting updates
  broadcastOrderUpdate(orderId, status, data = {}) {
    this.broadcastToChannel('orders', {
      type: 'order_update',
      orderId,
      status,
      ...data,
      timestamp: new Date().toISOString()
    });
  }

  broadcastTradeExecution(tradeId, data) {
    this.broadcastToChannel('trades', {
      type: 'trade_execution',
      tradeId,
      ...data,
      timestamp: new Date().toISOString()
    });
  }

  broadcastOrderBookUpdate(token, orderbook) {
    this.broadcastToChannel('orderbook', {
      type: 'orderbook_update',
      token,
      ...orderbook,
      timestamp: new Date().toISOString()
    });
  }

  broadcastSystemStatus(status, message) {
    this.broadcastToChannel('system', {
      type: 'system_status',
      status,
      message,
      timestamp: new Date().toISOString()
    });
  }

  // Utility methods
  sendToClient(clientId, message) {
    const client = this.clients.get(clientId);
    if (client && client.ws.readyState === 1) { // WebSocket.OPEN
      try {
        client.ws.send(JSON.stringify(message));
        this.metrics.messagesSent++;
      } catch (error) {
        console.error(`Error sending to client ${clientId}:`, error);
        this.handleDisconnection(clientId);
      }
    }
  }

  sendToUser(userId, message) {
    const userClients = this.userConnections.get(userId);
    if (userClients) {
      userClients.forEach(clientId => {
        this.sendToClient(clientId, message);
      });
    }
  }

  broadcastToChannel(channel, message) {
    const channelClients = this.channels.get(channel);
    if (channelClients) {
      channelClients.forEach(clientId => {
        this.sendToClient(clientId, message);
      });
    }
  }

  sendError(clientId, message, code = 'ERROR') {
    this.sendToClient(clientId, {
      type: 'error',
      code,
      message,
      timestamp: new Date().toISOString()
    });
  }

  disconnectClient(clientId, reason = 'Disconnected by server') {
    const client = this.clients.get(clientId);
    if (client) {
      this.sendToClient(clientId, {
        type: 'disconnect',
        reason,
        timestamp: new Date().toISOString()
      });
      client.ws.close();
    }
  }

  generateClientId() {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  mockVerifyToken(token) {
    // Mock token verification - in production, verify JWT
    if (token && token.startsWith('bearer_')) {
      return token.replace('bearer_', 'user_');
    }
    return null;
  }

  startHeartbeat() {
    setInterval(() => {
      const now = Date.now();
      this.clients.forEach((client, clientId) => {
        if (now - client.lastPing > this.options.heartbeatInterval * 2) {
          console.log(`Client ${clientId} timed out`);
          this.disconnectClient(clientId, 'Heartbeat timeout');
        }
      });
    }, this.options.heartbeatInterval);
  }

  getMetrics() {
    return {
      ...this.metrics,
      channels: Array.from(this.channels.keys()),
      channelCounts: Object.fromEntries(
        Array.from(this.channels.entries()).map(([channel, clients]) => [channel, clients.size])
      )
    };
  }

  getStatus() {
    return {
      connected_clients: this.metrics.activeConnections,
      total_connections: this.metrics.totalConnections,
      active_channels: this.channels.size,
      messages_received: this.metrics.messagesReceived,
      messages_sent: this.metrics.messagesSent,
      auth_failures: this.metrics.authFailures
    };
  }
}

module.exports = { PhantomPoolWebSocketService };