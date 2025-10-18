/**
 * API Test Script
 * Simple script to test PhantomPool API endpoints
 */

const http = require('http');

function makeRequest(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 8080,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
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

async function testAPI() {
  console.log('🧪 Testing PhantomPool API...\n');

  try {
    // Test health endpoint
    console.log('1. Testing health endpoint...');
    const health = await makeRequest('/api/health');
    console.log(`   Status: ${health.status}`);
    console.log(`   Response:`, health.data);
    console.log('');

    // Test API docs
    console.log('2. Testing API documentation...');
    const docs = await makeRequest('/api/docs');
    console.log(`   Status: ${docs.status}`);
    console.log(`   Response:`, docs.data);
    console.log('');

    // Test order creation
    console.log('3. Testing order creation...');
    const newOrder = {
      type: 'buy',
      token: 'SOL',
      amount: '100.0',
      limitPrice: '50.0',
      encryptedData: 'encrypted_order_data_123'
    };
    const orderResponse = await makeRequest('/api/orders', 'POST', newOrder);
    console.log(`   Status: ${orderResponse.status}`);
    console.log(`   Response:`, orderResponse.data);
    console.log('');

    // Test order retrieval
    console.log('4. Testing order retrieval...');
    const orders = await makeRequest('/api/orders');
    console.log(`   Status: ${orders.status}`);
    console.log(`   Response:`, orders.data);
    console.log('');

    // Test order stats
    console.log('5. Testing order statistics...');
    const stats = await makeRequest('/api/orders/stats');
    console.log(`   Status: ${stats.status}`);
    console.log(`   Response:`, stats.data);
    console.log('');

    // Test trading orderbook
    console.log('6. Testing trading orderbook...');
    const orderbook = await makeRequest('/api/trading/orderbook/SOL');
    console.log(`   Status: ${orderbook.status}`);
    console.log(`   Response:`, orderbook.data);
    console.log('');

    // Test bulletproof generation
    console.log('7. Testing bulletproof generation...');
    const proofData = {
      amount: '100.0',
      minRange: '0',
      maxRange: '1000'
    };
    const proof = await makeRequest('/api/proofs/bulletproof/generate', 'POST', proofData);
    console.log(`   Status: ${proof.status}`);
    console.log(`   Response:`, proof.data);
    console.log('');

    console.log('✅ All API tests completed successfully!');

  } catch (error) {
    console.error('❌ API test failed:', error.message);
  }
}

// Run tests
testAPI();