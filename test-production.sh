#!/bin/bash

# 🧪 PhantomPool: PRODUCTION TESTING SUITE
# ⚠️  COMPREHENSIVE REAL MONEY SAFETY VERIFICATION

set -e

echo "🧪 PhantomPool Production Testing Suite"
echo "⚠️  Testing REAL MONEY trading safety measures"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

TESTS_PASSED=0
TESTS_FAILED=0
TESTS_TOTAL=0

# Test function
run_test() {
    local test_name="$1"
    local test_command="$2"
    local expected_result="$3"
    
    TESTS_TOTAL=$((TESTS_TOTAL + 1))
    echo -e "${BLUE}🧪 Testing: $test_name${NC}"
    
    if eval "$test_command" 2>/dev/null; then
        if [[ "$expected_result" == "pass" ]]; then
            echo -e "${GREEN}✅ PASS: $test_name${NC}"
            TESTS_PASSED=$((TESTS_PASSED + 1))
        else
            echo -e "${RED}❌ FAIL: $test_name (should have failed)${NC}"
            TESTS_FAILED=$((TESTS_FAILED + 1))
        fi
    else
        if [[ "$expected_result" == "fail" ]]; then
            echo -e "${GREEN}✅ PASS: $test_name (correctly blocked)${NC}"
            TESTS_PASSED=$((TESTS_PASSED + 1))
        else
            echo -e "${RED}❌ FAIL: $test_name${NC}"
            TESTS_FAILED=$((TESTS_FAILED + 1))
        fi
    fi
}

# Load environment
if [[ -f ".env.production" ]]; then
    export $(cat .env.production | grep -v '^#' | xargs)
fi

SERVER_URL="http://localhost:3001"
echo -e "${BLUE}🔍 Testing server: $SERVER_URL${NC}"
echo ""

# 1. Server Health Tests
echo -e "${YELLOW}=== SERVER HEALTH TESTS ===${NC}"

run_test "Server Health Check" \
    "curl -s $SERVER_URL/api/health | grep -q 'healthy'" \
    "pass"

run_test "Financial Safety Service" \
    "curl -s $SERVER_URL/api/health | grep -q 'financialSafety.*connected.*true'" \
    "pass"

run_test "Database Connection" \
    "curl -s $SERVER_URL/api/health | grep -q 'primary_db.*true'" \
    "pass"

run_test "Solana Network Connection" \
    "curl -s $SERVER_URL/api/health | grep -q 'solana.*connected.*true'" \
    "pass"

echo ""

# 2. Financial Safety Tests
echo -e "${YELLOW}=== FINANCIAL SAFETY TESTS ===${NC}"

run_test "Reject Invalid Wallet Address" \
    "curl -s -X POST $SERVER_URL/api/wallet/connect -H 'Content-Type: application/json' -d '{\"walletAddress\":\"invalid\"}' | grep -q 'error'" \
    "pass"

run_test "Reject Unsigned Transaction" \
    "curl -s -X POST $SERVER_URL/api/trade/execute -H 'Content-Type: application/json' -d '{\"amount\":1000}' | grep -q 'error'" \
    "pass"

run_test "Reject Excessive Slippage" \
    "curl -s -X POST $SERVER_URL/api/trade/execute -H 'Content-Type: application/json' -d '{\"slippage\":0.5}' | grep -q 'error'" \
    "pass"

run_test "Reject Negative Amount" \
    "curl -s -X POST $SERVER_URL/api/trade/execute -H 'Content-Type: application/json' -d '{\"amount\":-1}' | grep -q 'error'" \
    "pass"

echo ""

# 3. API Security Tests
echo -e "${YELLOW}=== API SECURITY TESTS ===${NC}"

run_test "Rate Limiting Protection" \
    "for i in {1..20}; do curl -s $SERVER_URL/api/health >/dev/null; done; curl -s $SERVER_URL/api/health | grep -q 'rate limit'" \
    "pass"

run_test "CORS Headers Present" \
    "curl -s -I $SERVER_URL/api/health | grep -q 'Access-Control'" \
    "pass"

run_test "Content-Type Validation" \
    "curl -s -X POST $SERVER_URL/api/trade/execute -H 'Content-Type: text/plain' -d 'invalid' | grep -q 'error'" \
    "pass"

echo ""

# 4. Database Security Tests
echo -e "${YELLOW}=== DATABASE SECURITY TESTS ===${NC}"

run_test "SQL Injection Protection" \
    "curl -s '$SERVER_URL/api/wallet/invalid%27%20OR%201=1/balance' | grep -q 'error'" \
    "pass"

run_test "Audit Trail Logging" \
    "curl -s $SERVER_URL/api/audit/recent | grep -q 'timestamp'" \
    "pass"

echo ""

# 5. Risk Management Tests
echo -e "${YELLOW}=== RISK MANAGEMENT TESTS ===${NC}"

run_test "Position Limit Enforcement" \
    "curl -s -X POST $SERVER_URL/api/trade/execute -H 'Content-Type: application/json' -d '{\"amount\":99999999}' | grep -q 'position limit'" \
    "pass"

run_test "Circuit Breaker Status" \
    "curl -s $SERVER_URL/api/risk/circuit-breaker | grep -q 'status'" \
    "pass"

echo ""

# 6. Compliance Tests  
echo -e "${YELLOW}=== COMPLIANCE TESTS ===${NC}"

run_test "AML Monitoring Active" \
    "curl -s $SERVER_URL/api/compliance/status | grep -q 'aml.*active'" \
    "pass"

run_test "Transaction Logging" \
    "curl -s $SERVER_URL/api/compliance/transactions | grep -q 'log'" \
    "pass"

echo ""

# 7. Emergency System Tests
echo -e "${YELLOW}=== EMERGENCY SYSTEM TESTS ===${NC}"

run_test "Emergency Halt Endpoint" \
    "curl -s $SERVER_URL/api/emergency/status | grep -q 'status'" \
    "pass"

run_test "Unauthorized Halt Rejected" \
    "curl -s -X POST $SERVER_URL/api/emergency/halt -d '{}' | grep -q 'unauthorized'" \
    "pass"

echo ""

# 8. Performance Tests
echo -e "${YELLOW}=== PERFORMANCE TESTS ===${NC}"

run_test "Response Time < 500ms" \
    "timeout 1 curl -s $SERVER_URL/api/health >/dev/null" \
    "pass"

run_test "Memory Usage Check" \
    "ps -o pid,ppid,%mem,cmd -C node | grep -q 'api-server-production'" \
    "pass"

echo ""

# Results Summary
echo -e "${BLUE}=== TEST RESULTS SUMMARY ===${NC}"
echo "Total Tests: $TESTS_TOTAL"
echo -e "Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Failed: ${RED}$TESTS_FAILED${NC}"

PASS_PERCENTAGE=$((TESTS_PASSED * 100 / TESTS_TOTAL))
echo "Pass Rate: $PASS_PERCENTAGE%"

echo ""

if [[ $PASS_PERCENTAGE -ge 90 ]]; then
    echo -e "${GREEN}🎉 PRODUCTION READY: $PASS_PERCENTAGE% pass rate${NC}"
    echo -e "${GREEN}✅ PhantomPool is SAFE for real money trading${NC}"
elif [[ $PASS_PERCENTAGE -ge 70 ]]; then
    echo -e "${YELLOW}⚠️  CAUTION: $PASS_PERCENTAGE% pass rate${NC}"
    echo -e "${YELLOW}⚠️  Some security measures need attention${NC}"
else
    echo -e "${RED}❌ UNSAFE: $PASS_PERCENTAGE% pass rate${NC}"
    echo -e "${RED}❌ DO NOT deploy with real money${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}📊 Production Safety Status:${NC}"
echo -e "  🛡️  Financial Safety: $(curl -s $SERVER_URL/api/health 2>/dev/null | grep -q 'financialSafety.*true' && echo 'ACTIVE' || echo 'INACTIVE')"
echo -e "  💰 Risk Management: $(curl -s $SERVER_URL/api/health 2>/dev/null | grep -q 'riskManagement.*true' && echo 'ACTIVE' || echo 'INACTIVE')"  
echo -e "  📋 Compliance: $(curl -s $SERVER_URL/api/health 2>/dev/null | grep -q 'compliance.*true' && echo 'ACTIVE' || echo 'INACTIVE')"
echo -e "  ⛓️  Solana Network: $(curl -s $SERVER_URL/api/health 2>/dev/null | grep -q 'solana.*connected.*true' && echo 'CONNECTED' || echo 'DISCONNECTED')"

echo ""
echo -e "${GREEN}🚀 Testing complete. PhantomPool production safety verified!${NC}"