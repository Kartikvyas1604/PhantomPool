/**
 * WebSocket Client Test
 * Test utility for PhantomPool WebSocket functionality
 */

const WebSocket = require('ws');

class WebSocketTestClient {
  constructor(url = 'ws://localhost:8080/ws') {
    this.url = url;
    this.ws = null;
    this.authenticated = false;
    this.subscriptions = new Set();
    this.messageHandlers = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  connect() {
    return new Promise((resolve, reject) => {
      console.log(`Connecting to ${this.url}...`);
      
      this.ws = new WebSocket(this.url);

      this.ws.on('open', () => {
        console.log('✅ WebSocket connected');
        this.reconnectAttempts = 0;
        resolve();
      });

      this.ws.on('message', (data) => {
        this.handleMessage(data);
      });

      this.ws.on('close', () => {
        console.log('❌ WebSocket disconnected');
        this.authenticated = false;
        this.attemptReconnect();
      });

      this.ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        reject(error);
      });

      // Connection timeout
      setTimeout(() => {
        if (this.ws.readyState !== WebSocket.OPEN) {
          reject(new Error('Connection timeout'));
        }
      }, 5000);
    });
  }

  handleMessage(data) {
    try {
      const message = JSON.parse(data.toString());
      console.log(`📨 Received:`, message);

      // Handle specific message types
      switch (message.type) {
        case 'welcome':
          console.log(`🎉 Welcome message: ${message.message}`);
          break;
        case 'auth_success':
          this.authenticated = true;
          console.log(`🔐 Authenticated as user: ${message.userId}`);
          break;
        case 'subscribed':
          this.subscriptions.add(message.channel);
          console.log(`📺 Subscribed to channel: ${message.channel}`);
          break;
        case 'unsubscribed':
          this.subscriptions.delete(message.channel);
          console.log(`📺 Unsubscribed from channel: ${message.channel}`);
          break;
        case 'error':
          console.error(`❌ Server error: ${message.message}`);
          break;
        case 'pong':
          console.log('🏓 Pong received');
          break;
      }

      // Call custom handlers
      if (this.messageHandlers.has(message.type)) {
        this.messageHandlers.get(message.type)(message);
      }

    } catch (error) {
      console.error('Message parsing error:', error);
    }
  }

  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log(`📤 Sending:`, message);
      this.ws.send(JSON.stringify(message));
    } else {
      console.error('WebSocket not connected');
    }
  }

  authenticate(token = 'bearer_test_user_123') {
    this.send({
      type: 'auth',
      token
    });
  }

  subscribe(channel, filters = {}) {
    if (!this.authenticated) {
      console.error('Must authenticate before subscribing');
      return;
    }

    this.send({
      type: 'subscribe',
      channel,
      filters
    });
  }

  unsubscribe(channel) {
    this.send({
      type: 'unsubscribe',
      channel
    });
  }

  ping() {
    this.send({
      type: 'ping'
    });
  }

  submitOrder(orderData) {
    if (!this.authenticated) {
      console.error('Must authenticate before submitting orders');
      return;
    }

    this.send({
      type: 'order_submit',
      ...orderData
    });
  }

  submitTrade(tradeData) {
    if (!this.authenticated) {
      console.error('Must authenticate before submitting trades');
      return;
    }

    this.send({
      type: 'trade_request',
      ...tradeData
    });
  }

  onMessage(type, handler) {
    this.messageHandlers.set(type, handler);
  }

  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      
      setTimeout(() => {
        this.connect().catch(error => {
          console.error('Reconnection failed:', error);
        });
      }, 1000 * Math.pow(2, this.reconnectAttempts)); // Exponential backoff
    } else {
      console.error('Max reconnection attempts reached');
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

// Test function
async function testWebSocket() {
  console.log('🧪 Starting WebSocket tests...\n');

  const client = new WebSocketTestClient();

  // Set up message handlers
  client.onMessage('order_update', (message) => {
    console.log(`🔄 Order Update: ${message.orderId} -> ${message.status}`);
  });

  client.onMessage('trade_execution', (message) => {
    console.log(`💰 Trade Execution: ${message.tradeId} -> ${message.status}`);
  });

  client.onMessage('orderbook_update', (message) => {
    console.log(`📊 OrderBook Update for ${message.token}`);
  });

  try {
    // Connect to WebSocket
    await client.connect();

    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Authenticate
    console.log('\n1. Authenticating...');
    client.authenticate();
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Subscribe to channels
    console.log('\n2. Subscribing to channels...');
    client.subscribe('orders');
    await new Promise(resolve => setTimeout(resolve, 500));
    
    client.subscribe('trades');
    await new Promise(resolve => setTimeout(resolve, 500));
    
    client.subscribe('orderbook', { token: 'SOL' });
    await new Promise(resolve => setTimeout(resolve, 500));

    // Test ping
    console.log('\n3. Testing ping...');
    client.ping();
    await new Promise(resolve => setTimeout(resolve, 500));

    // Submit test order
    console.log('\n4. Submitting test order...');
    client.submitOrder({
      type: 'buy',
      token: 'SOL',
      amount: '100.0',
      price: '50.0'
    });
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Submit test trade
    console.log('\n5. Submitting test trade...');
    client.submitTrade({
      orderId: 'order_123',
      counterOrderId: 'order_456',
      amount: '50.0',
      price: '50.0'
    });
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Unsubscribe from one channel
    console.log('\n6. Unsubscribing from orders channel...');
    client.unsubscribe('orders');
    await new Promise(resolve => setTimeout(resolve, 500));

    console.log('\n✅ WebSocket tests completed successfully!');
    console.log(`📊 Active subscriptions: ${Array.from(client.subscriptions).join(', ')}`);

    // Keep connection alive for a bit more
    console.log('\n⏳ Keeping connection alive for 5 more seconds...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Disconnect
    client.disconnect();

  } catch (error) {
    console.error('❌ WebSocket test failed:', error);
  }
}

// Export for use in other modules
module.exports = { WebSocketTestClient, testWebSocket };

// Run tests if this file is executed directly
if (require.main === module) {
  testWebSocket();
}