// Production WebSocket Service for Real-time Updates
// Simplified implementation using native WebSocket

import { IncomingMessage } from 'http';
import { URL } from 'url';

// Use native WebSocket or simple implementation
interface WebSocketLike {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  readyState: number;
  on(event: string, listener: (...args: any[]) => void): void;
  ping?(): void;
  terminate?(): void;
}

interface WebSocketServerLike {
  on(event: 'connection', listener: (ws: WebSocketLike, request: IncomingMessage) => void): void;
  close(callback?: () => void): void;
}

interface ClientConnection {
  id: string;
  ws: WebSocketLike;
  walletAddress?: string;
  subscriptions: Set<string>;
  lastPing: number;
  authenticated: boolean;
}

interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: number;
  id?: string;
}

interface MatchingUpdate {
  roundNumber: number;
  status: 'starting' | 'encrypting' | 'decrypting' | 'matching' | 'complete';
  progress: number;
  timeRemaining?: number;
  result?: any;
}

interface OrderUpdate {
  orderHash: string;
  status: 'submitted' | 'queued' | 'matched' | 'partially_filled' | 'cancelled';
  matchedAmount?: number;
  remainingAmount?: number;
  avgPrice?: number;
}

export class WebSocketProductionService {
  private server: WebSocketServerLike | null = null;
  private clients = new Map<string, ClientConnection>();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private messageQueue = new Map<string, WebSocketMessage[]>();

  constructor(port: number = 8080) {
    console.log(`🔌 Starting WebSocket service on port ${port}...`);
    this.initializeServer(port);
  }

  /**
   * Initialize WebSocket server (mock for now)
   */
  private initializeServer(port: number) {
    try {
      // Try to import ws module
      const WS = require('ws');
      this.server = new WS.WebSocketServer({ port });
      this.setupEventHandlers();
      this.startHeartbeat();
      console.log(`✅ WebSocket server running on ws://localhost:${port}`);
    } catch (error) {
      console.log(`⚠️  WebSocket module not available, using mock service`);
      this.setupMockServer();
    }
  }

  /**
   * Setup mock server for development
   */
  private setupMockServer() {
    console.log('🔧 Setting up mock WebSocket service...');
    
    // Simulate some connected clients
    setTimeout(() => {
      this.addMockClient('wallet1', ['matching_rounds', 'order_updates']);
      this.addMockClient('wallet2', ['market_data']);
    }, 1000);

    this.startHeartbeat();
  }

  /**
   * Add mock client for testing
   */
  private addMockClient(walletAddress: string, subscriptions: string[]) {
    const clientId = this.generateClientId();
    
    const mockWs: WebSocketLike = {
      send: (data: string) => {
        console.log(`📤 Mock message to ${walletAddress}: ${JSON.parse(data).type}`);
      },
      close: () => console.log(`📱 Mock client ${walletAddress} disconnected`),
      readyState: 1, // OPEN
      on: () => {},
    };

    const client: ClientConnection = {
      id: clientId,
      ws: mockWs,
      walletAddress,
      subscriptions: new Set(subscriptions),
      lastPing: Date.now(),
      authenticated: true,
    };

    this.clients.set(clientId, client);
    console.log(`📱 Mock client connected: ${walletAddress}`);
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupEventHandlers() {
    if (!this.server) return;

    this.server.on('connection', (ws: WebSocketLike, request: IncomingMessage) => {
      const clientId = this.generateClientId();
      const url = new URL(request.url!, `http://${request.headers.host}`);
      const walletAddress = url.searchParams.get('wallet');

      console.log(`📱 Client connected: ${clientId} (wallet: ${walletAddress || 'anonymous'})`);

      // Create client connection
      const client: ClientConnection = {
        id: clientId,
        ws,
        walletAddress: walletAddress || undefined,
        subscriptions: new Set(),
        lastPing: Date.now(),
        authenticated: !!walletAddress,
      };

      this.clients.set(clientId, client);

      // Send welcome message
      this.sendToClient(clientId, {
        type: 'connection',
        data: {
          clientId,
          connected: true,
          serverTime: Date.now(),
        },
        timestamp: Date.now(),
      });

      // Setup message handlers
      ws.on('message', (data: any) => {
        this.handleClientMessage(clientId, data);
      });

      ws.on('close', () => {
        console.log(`📱 Client disconnected: ${clientId}`);
        this.clients.delete(clientId);
        this.messageQueue.delete(clientId);
      });

      ws.on('error', (error: any) => {
        console.error(`❌ WebSocket error for ${clientId}:`, error);
        this.clients.delete(clientId);
      });

      // Flush queued messages
      this.flushQueuedMessages(clientId);
    });
  }

  /**
   * Handle incoming client messages
   */
  private handleClientMessage(clientId: string, data: any) {
    const client = this.clients.get(clientId);
    if (!client) return;

    try {
      const message = JSON.parse(data.toString()) as WebSocketMessage;
      console.log(`📨 Message from ${clientId}: ${message.type}`);

      switch (message.type) {
        case 'subscribe':
          this.handleSubscribe(clientId, message.data);
          break;
        case 'unsubscribe':
          this.handleUnsubscribe(clientId, message.data);
          break;
        case 'authenticate':
          this.handleAuthenticate(clientId, message.data);
          break;
        case 'ping':
          this.sendToClient(clientId, {
            type: 'pong',
            data: { timestamp: Date.now() },
            timestamp: Date.now(),
          });
          break;
      }
    } catch (error) {
      console.error(`❌ Failed to parse message from ${clientId}:`, error);
    }
  }

  private handleSubscribe(clientId: string, data: any) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { channels } = data;
    for (const channel of channels) {
      client.subscriptions.add(channel);
    }

    this.sendToClient(clientId, {
      type: 'subscription_confirmed',
      data: { channels: Array.from(client.subscriptions) },
      timestamp: Date.now(),
    });
  }

  private handleUnsubscribe(clientId: string, data: any) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { channels } = data;
    for (const channel of channels) {
      client.subscriptions.delete(channel);
    }
  }

  private handleAuthenticate(clientId: string, data: any) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { walletAddress } = data;
    if (walletAddress) {
      client.walletAddress = walletAddress;
      client.authenticated = true;

      this.sendToClient(clientId, {
        type: 'authentication_success',
        data: { walletAddress },
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Broadcast matching round updates
   */
  broadcastMatchingUpdate(update: MatchingUpdate) {
    console.log(`📡 Broadcasting matching update: Round ${update.roundNumber} - ${update.status}`);

    const message: WebSocketMessage = {
      type: 'matching_update',
      data: update,
      timestamp: Date.now(),
    };

    this.broadcastToChannel('matching_rounds', message);
  }

  /**
   * Send order update to specific client
   */
  sendOrderUpdate(walletAddress: string, update: OrderUpdate) {
    console.log(`📬 Sending order update to ${walletAddress}: ${update.status}`);

    const message: WebSocketMessage = {
      type: 'order_update',
      data: update,
      timestamp: Date.now(),
    };

    for (const [clientId, client] of this.clients) {
      if (client.walletAddress === walletAddress && client.subscriptions.has('order_updates')) {
        this.sendToClient(clientId, message);
      }
    }
  }

  /**
   * Broadcast market data
   */
  broadcastMarketData(data: {
    volume24h: number;
    totalTrades: number;
    avgMatchingTime: number;
    activeOrders: number;
  }) {
    const message: WebSocketMessage = {
      type: 'market_data',
      data,
      timestamp: Date.now(),
    };

    this.broadcastToChannel('market_data', message);
  }

  /**
   * Send message to specific client
   */
  private sendToClient(clientId: string, message: WebSocketMessage) {
    const client = this.clients.get(clientId);
    if (!client) return;

    try {
      client.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error(`❌ Failed to send message to ${clientId}:`, error);
    }
  }

  /**
   * Broadcast to channel subscribers
   */
  private broadcastToChannel(channel: string, message: WebSocketMessage) {
    let sentCount = 0;

    for (const [clientId, client] of this.clients) {
      if (client.subscriptions.has(channel)) {
        this.sendToClient(clientId, message);
        sentCount++;
      }
    }

    console.log(`📡 Broadcasted to ${sentCount} clients on channel ${channel}`);
  }

  private queueMessage(clientId: string, message: WebSocketMessage) {
    if (!this.messageQueue.has(clientId)) {
      this.messageQueue.set(clientId, []);
    }
    this.messageQueue.get(clientId)!.push(message);
  }

  private flushQueuedMessages(clientId: string) {
    const queue = this.messageQueue.get(clientId);
    if (!queue) return;

    for (const message of queue) {
      this.sendToClient(clientId, message);
    }
    this.messageQueue.delete(clientId);
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      for (const [clientId, client] of this.clients) {
        if (now - client.lastPing > 60000) {
          this.clients.delete(clientId);
        } else {
          client.lastPing = now;
        }
      }
    }, 30000);
  }

  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getServerStats() {
    return {
      totalConnections: this.clients.size,
      activeConnections: this.clients.size,
      authenticatedConnections: Array.from(this.clients.values()).filter(c => c.authenticated).length,
    };
  }

  shutdown() {
    console.log('🛑 Shutting down WebSocket service...');
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    if (this.server) {
      this.server.close(() => {
        console.log('✅ WebSocket server stopped');
      });
    }
  }
}