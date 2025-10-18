#!/usr/bin/env node

/**
 * Quick API Test Script for PhantomPool
 */

const http = require('http');
const WebSocket = require('ws');

// Simple HTTP request
function testAPI() {
  return new Promise((resolve, reject) => {
    const req = http.get('http://localhost:8080/api/health', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          console.log('✅ API Health Check:', json.status);
          console.log('📊 Server uptime:', json.uptime + 's');
          if (json.websocket) {
            console.log('🔌 WebSocket clients:', json.websocket.connected_clients);
          }
          resolve(json);
        } catch (e) {
          reject(e);
        }
      });
    });
    
    req.on('error', reject);
    req.setTimeout(5000, () => reject(new Error('Timeout')));
  });
}

// Simple WebSocket test
function testWebSocket() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket('ws://localhost:8080/ws');
    let authenticated = false;
    
    ws.on('open', () => {
      console.log('🔌 WebSocket connected');
      
      // Authenticate
      ws.send(JSON.stringify({
        type: 'auth',
        token: 'bearer_test_user_123'
      }));
    });
    
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      console.log('📨 WebSocket message:', msg.type);
      
      if (msg.type === 'auth_success') {
        authenticated = true;
        
        // Subscribe to orders channel
        ws.send(JSON.stringify({
          type: 'subscribe',
          channel: 'orders'
        }));
        
        setTimeout(() => {
          ws.close();
          resolve({ authenticated, messageType: msg.type });
        }, 1000);
      }
    });
    
    ws.on('error', reject);
    
    setTimeout(() => {
      if (!authenticated) {
        ws.close();
        reject(new Error('Authentication timeout'));
      }
    }, 5000);
  });
}

async function quickTest() {
  console.log('🧪 Quick PhantomPool Test\n');
  
  try {
    console.log('1. Testing API...');
    await testAPI();
    console.log('');
    
    console.log('2. Testing WebSocket...');
    await testWebSocket();
    console.log('✅ WebSocket authentication successful');
    console.log('');
    
    console.log('🎉 PhantomPool API + WebSocket working perfectly!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

quickTest();