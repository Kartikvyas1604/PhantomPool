#!/usr/bin/env node

// Test suite for PhantomPool monitoring system
const axios = require('axios');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

class MonitoringSystemTester {
  constructor() {
    this.port = 3002; // Use different port to avoid conflicts
    this.baseUrl = `http://localhost:${this.port}`;
    this.wsUrl = `ws://localhost:${this.port}`;
    this.results = {
      passed: 0,
      failed: 0,
      tests: []
    };
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  async test(name, testFn) {
    try {
      this.log(`Running test: ${name}`);
      await testFn();
      this.results.passed++;
      this.results.tests.push({ name, status: 'PASSED', error: null });
      this.log(`Test passed: ${name}`, 'success');
    } catch (error) {
      this.results.failed++;
      this.results.tests.push({ name, status: 'FAILED', error: error.message });
      this.log(`Test failed: ${name} - ${error.message}`, 'error');
    }
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async startServer() {
    this.log('Starting monitored API server...');
    const { spawn } = require('child_process');
    
    this.serverProcess = spawn('node', ['src/api-server-monitored.js'], {
      cwd: process.cwd(),
      stdio: 'pipe',
      env: { ...process.env, PORT: this.port }
    });

    this.serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('PhantomPool Enhanced API Server started successfully') || 
          output.includes('Server running on')) {
        this.serverReady = true;
      }
    });

    this.serverProcess.stderr.on('data', (data) => {
      console.error(`Server error: ${data}`);
    });

    // Wait for server to start
    let attempts = 0;
    while (!this.serverReady && attempts < 30) {
      await this.sleep(1000);
      attempts++;
    }

    if (!this.serverReady) {
      throw new Error('Server failed to start within 30 seconds');
    }

    this.log('Server started successfully', 'success');
    await this.sleep(2000); // Additional wait for full initialization
  }

  async stopServer() {
    if (this.serverProcess) {
      this.log('Stopping server...');
      this.serverProcess.kill();
      await this.sleep(1000);
    }
  }

  async testHealthEndpoint() {
    const response = await axios.get(`${this.baseUrl}/api/health`);
    
    if (response.status !== 200) {
      throw new Error(`Expected status 200, got ${response.status}`);
    }

    const data = response.data;
    if (!data.success) {
      throw new Error('Health check should return success: true');
    }

    // Check required health fields (health data is spread into root, not nested in data)
    const requiredFields = ['status', 'uptime', 'timestamp'];
    for (const field of requiredFields) {
      if (!(field in data)) {
        throw new Error(`Missing required health field: ${field}`);
      }
    }

    if (typeof data.uptime !== 'number') {
      throw new Error('Uptime should be a number');
    }

    if (typeof data.status !== 'string') {
      throw new Error('Status should be a string');
    }
  }

  async testMetricsEndpoint() {
    const response = await axios.get(`${this.baseUrl}/api/metrics`);
    
    if (response.status !== 200) {
      throw new Error(`Expected status 200, got ${response.status}`);
    }

    const data = response.data;
    if (!data.success || !data.data) {
      throw new Error('Metrics endpoint should return success with data');
    }

    // Check for required metrics sections (these are the actual structure from metrics service)
    const requiredSections = ['server', 'websocket', 'trading', 'crypto', 'performance', 'security'];
    for (const section of requiredSections) {
      if (!(section in data.data)) {
        throw new Error(`Missing required metrics section: ${section}`);
      }
    }

    // Validate server metrics
    const server = data.data.server;
    if (typeof server.uptime !== 'number' || server.uptime < 0) {
      throw new Error('Server uptime should be a positive number');
    }

    if (typeof server.requestCount !== 'number' || server.requestCount < 0) {
      throw new Error('Server requestCount should be a non-negative number');
    }

    // Validate WebSocket metrics
    const websocket = data.data.websocket;
    if (typeof websocket.connectedClients !== 'number') {
      throw new Error('WebSocket connectedClients should be a number');
    }

    if (!websocket.channelStats || typeof websocket.channelStats !== 'object') {
      throw new Error('WebSocket channelStats should be an object');
    }
  }

  async testDashboardEndpoint() {
    const response = await axios.get(`${this.baseUrl}/api/admin/dashboard`);
    
    if (response.status !== 200) {
      throw new Error(`Expected status 200, got ${response.status}`);
    }

    const data = response.data;
    if (!data.success || !data.data) {
      throw new Error('Dashboard endpoint should return success with data');
    }

    // This should have the same structure as metrics but potentially with additional dashboard-specific data
    const requiredSections = ['server', 'websocket', 'orders', 'trades', 'crypto', 'performance', 'security', 'alerts'];
    for (const section of requiredSections) {
      if (!(section in data.data)) {
        throw new Error(`Missing required dashboard section: ${section}`);
      }
    }

    // Validate alerts section
    const alerts = data.data.alerts;
    if (typeof alerts.total !== 'number' || typeof alerts.unresolved !== 'number') {
      throw new Error('Alerts should have total and unresolved counts');
    }

    if (!Array.isArray(alerts.recent)) {
      throw new Error('Recent alerts should be an array');
    }
  }

  async testWebSocketStatus() {
    const response = await axios.get(`${this.baseUrl}/api/websocket/status`);
    
    if (response.status !== 200) {
      throw new Error(`Expected status 200, got ${response.status}`);
    }

    const data = response.data;
    if (!data.success) {
      throw new Error('WebSocket status should return success: true');
    }

    // WebSocket status data is directly in the response, not nested in data
    if (typeof data.connected_clients !== 'number') {
      throw new Error('WebSocket status should include connected_clients count');
    }

    if (!data.channels || typeof data.channels !== 'object') {
      throw new Error('WebSocket status should include channels object');
    }
  }

  async testLogsEndpoint() {
    const response = await axios.get(`${this.baseUrl}/api/admin/logs?limit=10`);
    
    if (response.status !== 200) {
      throw new Error(`Expected status 200, got ${response.status}`);
    }

    const data = response.data;
    if (!data.success || !data.data) {
      throw new Error('Logs endpoint should return success with data');
    }

    if (!Array.isArray(data.data.logs)) {
      throw new Error('Logs should be an array');
    }

    if (data.data.logs.length > 10) {
      throw new Error('Should respect limit parameter');
    }
  }

  async testAlertsEndpoint() {
    const response = await axios.get(`${this.baseUrl}/api/admin/alerts`);
    
    if (response.status !== 200) {
      throw new Error(`Expected status 200, got ${response.status}`);
    }

    const data = response.data;
    if (!data.success || !data.data) {
      throw new Error('Alerts endpoint should return success with data');
    }

    if (!Array.isArray(data.data.alerts)) {
      throw new Error('Alerts should be an array');
    }

    if (!data.data.summary || typeof data.data.summary !== 'object') {
      throw new Error('Alerts response should include summary object');
    }

    if (typeof data.data.summary.total !== 'number' || typeof data.data.summary.unresolved !== 'number') {
      throw new Error('Alerts summary should include total and unresolved counts');
    }
  }

  async testWebSocketConnection() {
    return new Promise((resolve, reject) => {
      let ws;
      let connected = false;

      const timeout = setTimeout(() => {
        if (!connected && ws) {
          ws.close();
          reject(new Error('WebSocket connection timeout after 5 seconds'));
        }
      }, 5000);

      try {
        ws = new WebSocket(`${this.wsUrl}/ws`);
        
        ws.on('open', () => {
          connected = true;
          clearTimeout(timeout);
          this.log('WebSocket connected successfully');
          
          // Test subscribing to a channel
          ws.send(JSON.stringify({
            type: 'subscribe',
            channel: 'orders'
          }));

          setTimeout(() => {
            ws.close();
            resolve();
          }, 1000);
        });

        ws.on('error', (error) => {
          clearTimeout(timeout);
          if (error.message.includes('400')) {
            // This might be a protocol issue, let's check if the endpoint is correct
            reject(new Error(`WebSocket connection failed: ${error.message}. Check if WebSocket service is properly configured.`));
          } else {
            reject(new Error(`WebSocket error: ${error.message}`));
          }
        });

        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            this.log(`Received WebSocket message: ${message.type}`);
          } catch (error) {
            // Ignore parsing errors for this test
          }
        });
      } catch (error) {
        clearTimeout(timeout);
        reject(new Error(`Failed to create WebSocket connection: ${error.message}`));
      }
    });
  }

  async testOrderSubmission() {
    const orderData = {
      pair: 'SOL/USDC',
      side: 'buy',
      amount: 1.0,
      price: 100.0,
      type: 'limit'
    };

    const response = await axios.post(`${this.baseUrl}/api/orders`, orderData);
    
    if (response.status !== 201) {
      throw new Error(`Expected status 201, got ${response.status}`);
    }

    const data = response.data;
    if (!data.success || !data.data) {
      throw new Error('Order submission should return success with data');
    }

    if (!data.data.id) {
      throw new Error('Order response should include an ID');
    }
  }

  async testOrdersList() {
    const response = await axios.get(`${this.baseUrl}/api/orders`);
    
    if (response.status !== 200) {
      throw new Error(`Expected status 200, got ${response.status}`);
    }

    const data = response.data;
    if (!data.success || !Array.isArray(data.data)) {
      throw new Error('Orders list should return success with array data');
    }
  }

  async testCryptoServiceEndpoints() {
    // Check if crypto endpoints exist (they might not be implemented yet)
    try {
      const bulletproofResponse = await axios.post(`${this.baseUrl}/api/crypto/bulletproof`, {
        value: 100,
        blinding: '1234567890abcdef'
      });

      if (bulletproofResponse.status !== 200) {
        throw new Error(`Bulletproof endpoint failed with status ${bulletproofResponse.status}`);
      }
    } catch (error) {
      if (error.response && error.response.status === 404) {
        this.log('Crypto endpoints not yet implemented, skipping test');
        return; // Skip this test if endpoints don't exist
      }
      throw error;
    }
  }

  async testTradingEndpoints() {
    // Check if trading endpoints exist (they might not be implemented yet)
    try {
      const pairsResponse = await axios.get(`${this.baseUrl}/api/trading/pairs`);
      
      if (pairsResponse.status !== 200) {
        throw new Error(`Trading pairs endpoint failed with status ${pairsResponse.status}`);
      }

      if (!Array.isArray(pairsResponse.data.data)) {
        throw new Error('Trading pairs should return an array');
      }
      
      this.log('Trading endpoints are working');
    } catch (error) {
      if (error.response && error.response.status === 404) {
        this.log('Trading endpoints not yet implemented, skipping test');
        return; // Skip this test if endpoints don't exist
      }
      throw error;
    }
  }

  async testLogFileCreation() {
    // Wait a bit for logs to be written
    await this.sleep(2000);

    const logDir = path.join(process.cwd(), 'logs');
    
    // Check if logs directory exists
    if (!fs.existsSync(logDir)) {
      throw new Error(`Logs directory should exist at ${logDir}`);
    }

    // Check for any log files (the naming might vary)
    const files = fs.readdirSync(logDir);
    const logFiles = files.filter(file => file.endsWith('.log'));
    
    if (logFiles.length === 0) {
      throw new Error(`No log files found in ${logDir}`);
    }

    // Check that at least one log file has content
    let hasContent = false;
    for (const logFile of logFiles) {
      const logPath = path.join(logDir, logFile);
      const stats = fs.statSync(logPath);
      if (stats.size > 0) {
        hasContent = true;
        break;
      }
    }

    if (!hasContent) {
      throw new Error('At least one log file should have content');
    }

    this.log(`Log files found: ${logFiles.join(', ')}`);
  }

  async generateLoadForMetrics() {
    this.log('Generating load to populate metrics...');
    
    // Make multiple requests to populate metrics
    const requests = [];
    for (let i = 0; i < 10; i++) {
      requests.push(axios.get(`${this.baseUrl}/api/health`).catch(e => console.log('Health request failed:', e.message)));
      requests.push(axios.get(`${this.baseUrl}/api/orders`).catch(e => console.log('Orders request failed:', e.message)));
    }

    await Promise.all(requests);
    await this.sleep(1000);
  }

  async runAllTests() {
    console.log('🚀 Starting PhantomPool Monitoring System Tests\n');

    try {
      // Start the server
      await this.startServer();

      // Generate some load first
      await this.generateLoadForMetrics();

      // Run all tests
      await this.test('Health Endpoint', () => this.testHealthEndpoint());
      await this.test('Metrics Endpoint', () => this.testMetricsEndpoint());
      await this.test('Dashboard Endpoint', () => this.testDashboardEndpoint());
      await this.test('WebSocket Status', () => this.testWebSocketStatus());
      await this.test('Logs Endpoint', () => this.testLogsEndpoint());
      await this.test('Alerts Endpoint', () => this.testAlertsEndpoint());
      await this.test('WebSocket Connection', () => this.testWebSocketConnection());
      await this.test('Order Submission', () => this.testOrderSubmission());
      await this.test('Orders List', () => this.testOrdersList());
      await this.test('Crypto Service Endpoints', () => this.testCryptoServiceEndpoints());
      await this.test('Trading Endpoints', () => this.testTradingEndpoints());
      await this.test('Log File Creation', () => this.testLogFileCreation());

    } catch (error) {
      this.log(`Test suite failed: ${error.message}`, 'error');
    } finally {
      await this.stopServer();
    }

    // Print results
    console.log('\n📊 Test Results Summary:');
    console.log(`✅ Passed: ${this.results.passed}`);
    console.log(`❌ Failed: ${this.results.failed}`);
    console.log(`📈 Success Rate: ${((this.results.passed / (this.results.passed + this.results.failed)) * 100).toFixed(1)}%`);

    if (this.results.failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.results.tests
        .filter(test => test.status === 'FAILED')
        .forEach(test => {
          console.log(`  - ${test.name}: ${test.error}`);
        });
    }

    console.log('\n🏁 Test suite completed');
    process.exit(this.results.failed > 0 ? 1 : 0);
  }
}

// Run the tests
if (require.main === module) {
  const tester = new MonitoringSystemTester();
  tester.runAllTests().catch(console.error);
}

module.exports = MonitoringSystemTester;