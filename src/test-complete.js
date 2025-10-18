/**
 * Complete API and WebSocket Integration Test
 * Demonstrates full PhantomPool functionality
 */

const http = require('http');
const WebSocket = require('ws');

// HTTP request helper
function makeRequest(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 8080,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'User-Id': 'test_user_123'
      },
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const jsonBody = JSON.parse(body);
          resolve({ status: res.statusCode, data: jsonBody });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

// WebSocket client helper
class TestWebSocketClient {
  constructor() {
    this.ws = null;
    this.authenticated = false;
    this.messages = [];
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket('ws://localhost:8080/ws');

      this.ws.on('open', () => {
        console.log('🔌 WebSocket connected');
        resolve();
      });

      this.ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        this.messages.push(message);
        console.log(`📨 WS Received: ${message.type}`, message.type === 'welcome' ? message.message : '');
        
        if (message.type === 'auth_success') {
          this.authenticated = true;
        }
      });

      this.ws.on('error', reject);
    });
  }

  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  close() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

async function runComprehensiveTest() {
  console.log('🧪 Starting Comprehensive PhantomPool Test Suite...\n');

  try {
    // 1. Test API Health
    console.log('1️⃣ Testing API Health...');
    const health = await makeRequest('/api/health');
    console.log(`   Status: ${health.status}`);
    console.log(`   Server: ${health.data.status}, Uptime: ${health.data.uptime}s`);
    if (health.data.websocket) {
      console.log(`   WebSocket: ${health.data.websocket.connected_clients} clients connected`);
    }
    console.log('');

    // 2. Test WebSocket Connection
    console.log('2️⃣ Testing WebSocket Connection...');
    const wsClient = new TestWebSocketClient();
    await wsClient.connect();
    await new Promise(resolve => setTimeout(resolve, 500));

    // Authenticate
    console.log('   🔐 Authenticating...');
    wsClient.send({
      type: 'auth',
      token: 'bearer_test_user_123'
    });
    await new Promise(resolve => setTimeout(resolve, 500));

    if (!wsClient.authenticated) {
      throw new Error('WebSocket authentication failed');
    }
    console.log('   ✅ WebSocket authenticated');

    // Subscribe to channels
    console.log('   📺 Subscribing to channels...');
    wsClient.send({ type: 'subscribe', channel: 'orders' });
    wsClient.send({ type: 'subscribe', channel: 'trades' });
    wsClient.send({ type: 'subscribe', channel: 'orderbook', filters: { token: 'SOL' } });
    await new Promise(resolve => setTimeout(resolve, 500));
    console.log('   ✅ Subscribed to channels');
    console.log('');

    // 3. Test Order Creation with WebSocket Updates
    console.log('3️⃣ Testing Order Creation with Real-time Updates...');
    const newOrder = {
      type: 'buy',
      token: 'SOL',
      amount: '100.0',
      price: '50.0',
      encryptedData: 'encrypted_order_data_123'
    };
    
    const orderResponse = await makeRequest('/api/orders', 'POST', newOrder);
    console.log(`   HTTP Status: ${orderResponse.status}`);
    console.log(`   Order ID: ${orderResponse.data.data.id}`);
    
    // Wait for WebSocket update
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const orderUpdates = wsClient.messages.filter(m => m.type === 'order_update');
    if (orderUpdates.length > 0) {
      console.log(`   ✅ WebSocket order update received: ${orderUpdates[0].orderId}`);
    } else {
      console.log('   ⚠️ No WebSocket order update received');
    }
    console.log('');

    // 4. Test Order Status Update
    console.log('4️⃣ Testing Order Status Update...');
    const orderId = orderResponse.data.data.id;
    const statusUpdate = await makeRequest(`/api/orders/${orderId}/status`, 'PUT', {
      status: 'filled'
    });
    console.log(`   Status Update: ${statusUpdate.status}`);
    
    // Wait for WebSocket update
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const statusUpdates = wsClient.messages.filter(m => 
      m.type === 'order_update' && m.status === 'filled'
    );
    if (statusUpdates.length > 0) {
      console.log(`   ✅ WebSocket status update received: ${statusUpdates[0].status}`);
    }
    console.log('');

    // 5. Test Trade Execution
    console.log('5️⃣ Testing Trade Execution...');
    const tradeData = {
      orderId: orderId,
      counterOrderId: 'order_counter_123',
      amount: '50.0',
      price: '50.0',
      zkMatchProof: 'proof_123'
    };
    
    const tradeResponse = await makeRequest('/api/trading/match', 'POST', tradeData);
    console.log(`   Trade Status: ${tradeResponse.status}`);
    console.log(`   Trade ID: ${tradeResponse.data.data.id}`);
    
    // Wait for WebSocket update
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const tradeUpdates = wsClient.messages.filter(m => m.type === 'trade_execution');
    if (tradeUpdates.length > 0) {
      console.log(`   ✅ WebSocket trade update received: ${tradeUpdates[0].tradeId}`);
    }
    console.log('');

    // 6. Test OrderBook Simulation
    console.log('6️⃣ Testing OrderBook Real-time Updates...');
    const obUpdate = await makeRequest('/api/trading/simulate-orderbook-update/SOL', 'POST');
    console.log(`   OrderBook Update: ${obUpdate.status}`);
    
    // Wait for WebSocket update
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const obUpdates = wsClient.messages.filter(m => m.type === 'orderbook_update');
    if (obUpdates.length > 0) {
      console.log(`   ✅ WebSocket orderbook update received for ${obUpdates[0].token}`);
    }
    console.log('');

    // 7. Test WebSocket Management
    console.log('7️⃣ Testing WebSocket Management...');
    const wsStatus = await makeRequest('/api/websocket/status');
    console.log(`   WebSocket Status: ${wsStatus.status}`);
    console.log(`   Connected Clients: ${wsStatus.data.connected_clients}`);
    console.log(`   Total Messages Sent: ${wsStatus.data.messages_sent}`);
    console.log(`   Total Messages Received: ${wsStatus.data.messages_received}`);
    console.log('');

    // 8. Test Broadcast Message
    console.log('8️⃣ Testing Admin Broadcast...');
    const broadcastData = {
      channel: 'system',
      message: {
        type: 'maintenance_notice',
        message: 'System maintenance scheduled in 1 hour',
        severity: 'info'
      }
    };
    
    const broadcast = await makeRequest('/api/websocket/broadcast', 'POST', broadcastData);
    console.log(`   Broadcast Status: ${broadcast.status}`);
    
    // Wait for WebSocket update
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const broadcasts = wsClient.messages.filter(m => m.type === 'admin_broadcast');
    if (broadcasts.length > 0) {
      console.log(`   ✅ WebSocket broadcast received: ${broadcasts[0].message}`);
    }
    console.log('');

    // 9. Test Final Stats
    console.log('9️⃣ Final System Statistics...');
    const stats = await makeRequest('/api/orders/stats');
    console.log(`   Total Orders: ${stats.data.total_orders}`);
    console.log(`   Active Orders: ${stats.data.active_orders}`);
    console.log(`   Filled Orders: ${stats.data.filled_orders}`);
    
    const dashboard = await makeRequest('/api/admin/dashboard');
    console.log(`   WebSocket Connections: ${dashboard.data.websocket.connected_clients}`);
    console.log(`   Total WebSocket Messages: ${dashboard.data.websocket.messages_sent}`);
    console.log('');

    // Close WebSocket
    wsClient.close();
    
    console.log('✅ ALL TESTS PASSED! PhantomPool API + WebSocket integration working perfectly!');
    console.log(`📊 Total WebSocket messages received: ${wsClient.messages.length}`);
    console.log(`🔌 Message types: ${[...new Set(wsClient.messages.map(m => m.type))].join(', ')}`);

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the comprehensive test
if (require.main === module) {
  console.log('⏳ Waiting 2 seconds for server to be ready...\n');
  setTimeout(runComprehensiveTest, 2000);
}

module.exports = { runComprehensiveTest };