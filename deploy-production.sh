#!/bin/bash

# Production Build and Deployment Script for PhantomPool
# ⚠️ FOR REAL MONEY TRADING - USE WITH EXTREME CAUTION ⚠️

set -e

echo "🚀 PhantomPool Production Deployment Script"
echo "========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="PhantomPool"
NETWORK="mainnet-beta"
MIN_SOL_BALANCE=5

echo -e "${YELLOW}⚠️  WARNING: This will deploy to Solana MAINNET with REAL MONEY!${NC}"
echo -e "${YELLOW}Make sure you have tested everything on devnet first!${NC}"
echo ""

# Confirmation prompt
read -p "Are you absolutely sure you want to proceed? (yes/no): " -r
if [[ ! $REPLY =~ ^yes$ ]]; then
    echo "❌ Deployment cancelled."
    exit 1
fi

echo ""
echo "📋 Pre-deployment Checklist"
echo "=============================="

# Check if we're in the right directory
if [[ ! -f "Anchor.toml" ]]; then
    echo -e "${RED}❌ Anchor.toml not found. Run this script from the project root.${NC}"
    exit 1
fi

# Check Solana CLI
echo -n "🔧 Checking Solana CLI... "
if ! command -v solana &> /dev/null; then
    echo -e "${RED}❌ Solana CLI not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✅${NC}"

# Check Anchor
echo -n "🔧 Checking Anchor CLI... "
if ! command -v anchor &> /dev/null; then
    echo -e "${RED}❌ Anchor CLI not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✅${NC}"

# Check Node.js
echo -n "🔧 Checking Node.js... "
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✅${NC}"

# Set Solana cluster to mainnet
echo -n "🌐 Setting Solana cluster to mainnet... "
solana config set --url https://api.mainnet-beta.solana.com > /dev/null
echo -e "${GREEN}✅${NC}"

# Check wallet balance
echo -n "💰 Checking wallet balance... "
BALANCE=$(solana balance | grep -oE '[0-9]+\.[0-9]+' | head -1)
if (( $(echo "$BALANCE < $MIN_SOL_BALANCE" | bc -l) )); then
    echo -e "${RED}❌ Insufficient SOL balance. Need at least $MIN_SOL_BALANCE SOL, have $BALANCE SOL${NC}"
    exit 1
fi
echo -e "${GREEN}✅ $BALANCE SOL${NC}"

# Check environment file
echo -n "📄 Checking production environment... "
if [[ ! -f ".env.production" ]]; then
    echo -e "${RED}❌ .env.production file not found${NC}"
    echo "Copy .env.production.example and configure it first:"
    echo "cp .env.production.example .env.production"
    exit 1
fi
echo -e "${GREEN}✅${NC}"

echo ""
echo "🔨 Building Smart Contract"
echo "=========================="

# Build Anchor program
echo "📦 Building Anchor program..."
cd programs/phantom-pool
anchor build

# Check build success
if [[ ! -f "target/deploy/phantom_pool.so" ]]; then
    echo -e "${RED}❌ Smart contract build failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Smart contract built successfully${NC}"
cd ../..

echo ""
echo "📤 Deploying Smart Contract"
echo "============================"

# Deploy to mainnet
echo "🚀 Deploying to Solana mainnet..."
echo -e "${YELLOW}⚠️  This will cost real SOL!${NC}"

DEPLOY_OUTPUT=$(anchor deploy --provider.cluster mainnet 2>&1)
if [[ $? -ne 0 ]]; then
    echo -e "${RED}❌ Deployment failed:${NC}"
    echo "$DEPLOY_OUTPUT"
    exit 1
fi

echo -e "${GREEN}✅ Smart contract deployed successfully${NC}"

# Extract program ID
PROGRAM_ID=$(echo "$DEPLOY_OUTPUT" | grep -oE '[A-Za-z0-9]{43,44}' | tail -1)
echo "📋 Program ID: $PROGRAM_ID"

echo ""
echo "🏗️  Building Frontend"
echo "===================="

# Install dependencies
echo "📦 Installing dependencies..."
npm ci --production

# Build frontend
echo "🔨 Building frontend..."
npm run build

if [[ $? -ne 0 ]]; then
    echo -e "${RED}❌ Frontend build failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Frontend built successfully${NC}"

echo ""
echo "🗄️  Database Setup"
echo "=================="

# Check if PostgreSQL is running
echo -n "🔧 Checking PostgreSQL... "
if ! pg_isready &> /dev/null; then
    echo -e "${YELLOW}⚠️  PostgreSQL not running locally${NC}"
    echo "Make sure your production database is configured in .env.production"
else
    echo -e "${GREEN}✅${NC}"
fi

# Run migrations (if using a migration tool)
if [[ -f "package.json" ]] && grep -q "migrate" package.json; then
    echo "📊 Running database migrations..."
    npm run migrate:prod
fi

echo ""
echo "🔐 Security Verification"
echo "========================"

# Check for common security issues
echo "🛡️  Running security checks..."

# Check for hardcoded keys
if grep -r "PRIVATE_KEY.*=" --include="*.ts" --include="*.js" src/; then
    echo -e "${RED}❌ Found potential hardcoded private keys in source code${NC}"
    exit 1
fi

# Check environment variables
REQUIRED_VARS=(
    "ELGAMAL_PRIVATE_KEY"
    "VRF_PRIVATE_KEY" 
    "WALLET_PRIVATE_KEY"
    "JWT_SECRET"
    "DATABASE_URL"
)

for var in "${REQUIRED_VARS[@]}"; do
    if ! grep -q "^$var=" .env.production; then
        echo -e "${RED}❌ Missing required environment variable: $var${NC}"
        exit 1
    fi
done

echo -e "${GREEN}✅ Security checks passed${NC}"

echo ""
echo "🧪 Final Testing"
echo "================"

# Health check
echo "🏥 Running health check..."
npm run test:health

echo ""
echo "✅ Deployment Complete!"
echo "======================="
echo ""
echo -e "${GREEN}🎉 PhantomPool has been successfully deployed to mainnet!${NC}"
echo ""
echo "📋 Deployment Summary:"
echo "----------------------"
echo "🔗 Network: Solana Mainnet"
echo "📍 Program ID: $PROGRAM_ID"
echo "💰 Wallet Balance: $BALANCE SOL"
echo "⏰ Deployed at: $(date)"
echo ""
echo "🚨 Next Steps:"
echo "--------------"
echo "1. 🔍 Verify the deployment on Solana Explorer"
echo "2. 🧪 Test with small amounts first"
echo "3. 📊 Monitor the application logs"
echo "4. 🚨 Set up alerting and monitoring"
echo "5. 📢 Announce the launch (when ready)"
echo ""
echo "🔗 Useful Links:"
echo "----------------"
echo "• Solana Explorer: https://explorer.solana.com/address/$PROGRAM_ID"
echo "• Application: https://your-domain.com"
echo "• Documentation: ./PRODUCTION_DEPLOYMENT.md"
echo ""
echo -e "${YELLOW}⚠️  Remember: This system handles REAL MONEY!${NC}"
echo -e "${YELLOW}Monitor closely and have emergency procedures ready.${NC}"
echo ""
echo -e "${GREEN}🚀 Happy Trading!${NC}"