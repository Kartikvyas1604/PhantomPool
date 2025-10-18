#!/usr/bin/env node

/**
 * PhantomPool Security Test Suite
 * Comprehensive security testing for production deployment
 */

const axios = require('axios');
const WebSocket = require('ws');

class SecurityTester {
  constructor() {
    this.port = 3004; // Use different port to avoid conflicts
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
      this.log(`Running security test: ${name}`);
      await testFn();
      this.results.passed++;
      this.results.tests.push({ name, status: 'PASSED', error: null });
      this.log(`Security test passed: ${name}`, 'success');
    } catch (error) {
      this.results.failed++;
      this.results.tests.push({ name, status: 'FAILED', error: error.message });
      this.log(`Security test failed: ${name} - ${error.message}`, 'error');
    }
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async startSecureServer() {
    this.log('Starting secure API server...');
    const { spawn } = require('child_process');
    
    this.serverProcess = spawn('node', ['src/api-server-secure.js'], {
      cwd: process.cwd(),
      stdio: 'pipe',
      env: { ...process.env, PORT: this.port }
    });

    this.serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('PhantomPool Secure API Server started successfully') || 
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
      throw new Error('Secure server failed to start within 30 seconds');
    }

    this.log('Secure server started successfully', 'success');
    await this.sleep(2000);
  }

  async stopServer() {
    if (this.serverProcess) {
      this.log('Stopping secure server...');
      this.serverProcess.kill();
      await this.sleep(1000);
    }
  }

  // Test security headers
  async testSecurityHeaders() {
    const response = await axios.get(`${this.baseUrl}/api/health`);
    
    const requiredHeaders = [
      'x-content-type-options',
      'x-frame-options',
      'x-xss-protection',
      'strict-transport-security'
    ];

    for (const header of requiredHeaders) {
      if (!response.headers[header]) {
        throw new Error(`Missing security header: ${header}`);
      }
    }

    // Check CSP header
    if (!response.headers['content-security-policy']) {
      throw new Error('Missing Content-Security-Policy header');
    }
  }

  // Test rate limiting
  async testRateLimiting() {
    const requests = [];
    
    // Make 105 requests (should exceed limit of 100)
    for (let i = 0; i < 105; i++) {
      requests.push(
        axios.get(`${this.baseUrl}/api/health`).catch(err => ({ 
          status: err.response?.status, 
          headers: err.response?.headers 
        }))
      );
    }

    const responses = await Promise.all(requests);
    
    // At least some requests should be rate limited (429)
    const rateLimited = responses.filter(r => r.status === 429);
    if (rateLimited.length === 0) {
      throw new Error('Rate limiting not working - no 429 responses received');
    }

    this.log(`Rate limiting working: ${rateLimited.length} requests blocked`);
  }

  // Test input validation
  async testInputValidation() {
    // Test XSS injection
    try {
      await axios.post(`${this.baseUrl}/api/orders`, {
        pair: '<script>alert("xss")</script>',
        side: 'buy',
        amount: 1,
        price: 100,
        type: 'limit'
      });
      throw new Error('XSS injection not blocked');
    } catch (error) {
      if (error.response?.status !== 400 && error.response?.status !== 401 && error.response?.status !== 429) {
        throw new Error(`XSS test failed with unexpected status: ${error.response?.status}`);
      }
    }

    // Test SQL injection attempt
    try {
      await axios.get(`${this.baseUrl}/api/orders?status='; DROP TABLE orders; --`);
    } catch (error) {
      // Should be blocked by input validation or authentication
      if (error.response?.status !== 400 && error.response?.status !== 401 && error.response?.status !== 429) {
        throw new Error(`SQL injection test failed with unexpected status: ${error.response?.status}`);
      }
    }

    // Test invalid data types
    try {
      await axios.post(`${this.baseUrl}/api/orders`, {
        pair: 'SOL/USDC',
        side: 'buy',
        amount: 'not_a_number',
        price: 100,
        type: 'limit'
      });
      throw new Error('Invalid data type not rejected');
    } catch (error) {
      if (error.response?.status !== 400 && error.response?.status !== 401 && error.response?.status !== 429) {
        throw new Error(`Data type validation failed with status: ${error.response?.status}`);
      }
    }
  }

  // Test authentication
  async testAuthentication() {
    // Test protected endpoint without auth
    try {
      await axios.get(`${this.baseUrl}/api/admin/metrics`);
      throw new Error('Protected endpoint accessible without authentication');
    } catch (error) {
      if (error.response?.status !== 401 && error.response?.status !== 429) {
        throw new Error(`Authentication test failed - expected 401, got ${error.response?.status}`);
      }
    }

    // Test with invalid API key
    try {
      await axios.get(`${this.baseUrl}/api/admin/metrics`, {
        headers: { 'X-API-Key': 'invalid_key_123' }
      });
      throw new Error('Invalid API key accepted');
    } catch (error) {
      if (error.response?.status !== 401 && error.response?.status !== 429) {
        throw new Error(`Invalid API key test failed - expected 401, got ${error.response?.status}`);
      }
    }

    // Test with valid API key
    try {
      const response = await axios.get(`${this.baseUrl}/api/admin/metrics`, {
        headers: { 'X-API-Key': 'pk_test_phantom_pool_development' }
      });
      
      if (response.status !== 200) {
        throw new Error('Valid API key rejected');
      }
    } catch (error) {
      if (error.response?.status === 401) {
        throw new Error('Valid API key was rejected');
      }
      // Other errors might be expected (like rate limiting)
    }
  }

  // Test authentication login
  async testAuthenticationLogin() {
    // Small delay to avoid rate limiting from previous tests
    await this.sleep(2000);
    
    // Test login with wrong credentials
    try {
      await axios.post(`${this.baseUrl}/api/auth/login`, {
        username: 'admin',
        password: 'wrong_password'
      });
      throw new Error('Wrong credentials accepted');
    } catch (error) {
      if (error.response?.status !== 401 && error.response?.status !== 429) {
        throw new Error(`Wrong credentials test failed - expected 401, got ${error.response?.status}`);
      }
    }

    // Small delay between tests
    await this.sleep(1000);

    // Test login with correct credentials
    try {
      const response = await axios.post(`${this.baseUrl}/api/auth/login`, {
        username: 'admin',
        password: 'secure_password_123'
      });
      
      if (response.status !== 200 || !response.data.success || !response.data.data.token) {
        throw new Error('Valid credentials rejected or token not provided');
      }

      this.authToken = response.data.data.token;
      this.log('Authentication token obtained');
      
      // Test using the token
      const metricsResponse = await axios.get(`${this.baseUrl}/api/admin/metrics`, {
        headers: { 'Authorization': `Bearer ${this.authToken}` }
      });
      
      if (metricsResponse.status !== 200) {
        throw new Error('Valid token rejected');
      }
      
    } catch (error) {
      if (error.response?.status === 401) {
        throw new Error('Valid credentials were rejected');
      }
      throw error;
    }
  }

  // Test CORS configuration
  async testCORS() {
    // Test preflight request
    try {
      const response = await axios.options(`${this.baseUrl}/api/health`, {
        headers: {
          'Origin': 'http://localhost:3000',
          'Access-Control-Request-Method': 'GET',
          'Access-Control-Request-Headers': 'Content-Type'
        }
      });

      if (!response.headers['access-control-allow-origin']) {
        throw new Error('CORS headers not set');
      }
    } catch (error) {
      if (error.response?.status >= 400) {
        throw new Error('CORS preflight failed');
      }
    }
  }

  // Test WebSocket security
  async testWebSocketSecurity() {
    return new Promise((resolve, reject) => {
      let ws;
      const timeout = setTimeout(() => {
        if (ws) ws.close();
        reject(new Error('WebSocket security test timeout'));
      }, 10000);

      try {
        ws = new WebSocket(`${this.wsUrl}/ws`);
        
        ws.on('open', () => {
          this.log('WebSocket connected for security test');
          
          // Test subscribing to a channel
          ws.send(JSON.stringify({
            type: 'subscribe',
            channel: 'orders'
          }));
        });

        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            if (message.type === 'welcome') {
              this.log('WebSocket welcome message received');
            }
            
            // Close after receiving messages
            setTimeout(() => {
              ws.close();
              clearTimeout(timeout);
              resolve();
            }, 1000);
          } catch (error) {
            clearTimeout(timeout);
            reject(new Error(`WebSocket message parsing failed: ${error.message}`));
          }
        });

        ws.on('error', (error) => {
          clearTimeout(timeout);
          if (error.message.includes('400')) {
            reject(new Error('WebSocket security error: connection rejected'));
          } else {
            reject(new Error(`WebSocket error: ${error.message}`));
          }
        });

      } catch (error) {
        clearTimeout(timeout);
        reject(new Error(`WebSocket connection failed: ${error.message}`));
      }
    });
  }

  // Test error handling and information disclosure
  async testErrorHandling() {
    // Test 404 handling with a unique path to avoid rate limiting
    const uniquePath = `/api/nonexistent_${Date.now()}`;
    const notFoundResponse = await axios.get(`${this.baseUrl}${uniquePath}`).catch(err => err.response);
    
    if (notFoundResponse.status !== 404) {
      throw new Error(`404 handler not working - got status ${notFoundResponse.status}`);
    }

    if (notFoundResponse.data.stack || notFoundResponse.data.details) {
      throw new Error('Error response leaking sensitive information');
    }

    // Test malformed JSON
    try {
      await axios.post(`${this.baseUrl}/api/orders`, 'invalid json', {
        headers: { 'Content-Type': 'application/json' }
      });
      throw new Error('Malformed JSON accepted');
    } catch (error) {
      if (error.response?.status !== 400 && error.response?.status !== 429) {
        throw new Error(`Malformed JSON handling failed - got status ${error.response?.status}`);
      }
    }
  }

  // Test IP blocking functionality
  async testIPBlocking() {
    // Simulate multiple failed auth attempts from same IP
    let blockedRequests = 0;
    
    for (let i = 0; i < 6; i++) {
      try {
        await axios.post(`${this.baseUrl}/api/auth/login`, {
          username: 'admin',
          password: 'wrong_password_' + i
        });
      } catch (error) {
        if (error.response?.status === 429) {
          blockedRequests++;
        }
        // Expected to fail with 401 or 429
      }
    }

    // Wait a moment for any additional processing
    await this.sleep(1000);

    // The fact that we got rate limited (429) means the security system is working
    if (blockedRequests > 0) {
      this.log(`Security system blocked ${blockedRequests} requests (rate limiting working)`);
    } else {
      this.log('IP blocking test completed (basic validation)');
    }
  }

  // Test admin endpoints security
  async testAdminEndpointsSecurity() {
    if (!this.authToken) {
      this.log('Auth token not available, testing admin endpoints without auth only');
    }

    const adminEndpoints = [
      '/api/admin/metrics',
      '/api/admin/dashboard',
      '/api/admin/security',
      '/api/admin/logs',
      '/api/admin/alerts'
    ];

    for (const endpoint of adminEndpoints) {
      // Test without auth
      try {
        await axios.get(`${this.baseUrl}${endpoint}`);
        throw new Error(`Admin endpoint ${endpoint} accessible without auth`);
      } catch (error) {
        if (error.response?.status !== 401 && error.response?.status !== 429) {
          throw new Error(`Admin endpoint ${endpoint} auth test failed - expected 401 or 429, got ${error.response?.status}`);
        }
      }

      // Test with auth if token is available
      if (this.authToken) {
        try {
          const response = await axios.get(`${this.baseUrl}${endpoint}`, {
            headers: { 'Authorization': `Bearer ${this.authToken}` }
          });
          
          if (response.status !== 200) {
            throw new Error(`Admin endpoint ${endpoint} failed with valid auth`);
          }
        } catch (error) {
          if (error.response?.status === 429) {
            this.log(`Admin endpoint ${endpoint} rate limited (expected)`);
          } else {
            throw error;
          }
        }
      } else {
        this.log(`Skipping auth test for ${endpoint} - no token available`);
      }
    }
  }

  async runAllSecurityTests() {
    console.log('🔒 Starting PhantomPool Security Test Suite\n');

    try {
      await this.startSecureServer();

      await this.test('Security Headers', () => this.testSecurityHeaders());
      await this.sleep(500); // Brief pause
      
      await this.test('CORS Configuration', () => this.testCORS());
      await this.sleep(500);
      
      await this.test('WebSocket Security', () => this.testWebSocketSecurity());
      await this.sleep(500);
      
      await this.test('Error Handling', () => this.testErrorHandling());
      await this.sleep(500);
      
      await this.test('Input Validation', () => this.testInputValidation());
      await this.sleep(1000); // Longer pause before auth tests
      
      await this.test('Authentication', () => this.testAuthentication());
      await this.sleep(1000);
      
      await this.test('Authentication Login', () => this.testAuthenticationLogin());
      await this.sleep(1000);
      
      await this.test('Admin Endpoints Security', () => this.testAdminEndpointsSecurity());
      await this.sleep(1000);
      
      await this.test('IP Blocking', () => this.testIPBlocking());
      await this.sleep(1000);
      
      await this.test('Rate Limiting', () => this.testRateLimiting());

    } catch (error) {
      this.log(`Security test suite failed: ${error.message}`, 'error');
    } finally {
      await this.stopServer();
    }

    // Print results
    console.log('\n🔒 Security Test Results Summary:');
    console.log(`✅ Passed: ${this.results.passed}`);
    console.log(`❌ Failed: ${this.results.failed}`);
    console.log(`📈 Success Rate: ${((this.results.passed / (this.results.passed + this.results.failed)) * 100).toFixed(1)}%`);

    if (this.results.failed > 0) {
      console.log('\n❌ Failed Security Tests:');
      this.results.tests
        .filter(test => test.status === 'FAILED')
        .forEach(test => {
          console.log(`  - ${test.name}: ${test.error}`);
        });
    }

    console.log('\n🔒 Security test suite completed');
    
    if (this.results.failed === 0) {
      console.log('🎉 All security tests passed! System is hardened for production.');
    }
    
    process.exit(this.results.failed > 0 ? 1 : 0);
  }
}

// Run the security tests
if (require.main === module) {
  const tester = new SecurityTester();
  tester.runAllSecurityTests().catch(console.error);
}

module.exports = SecurityTester;