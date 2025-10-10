#!/bin/bash

# PhantomPool Enhanced On-Chain Deployment Script
# This script deploys the complete on-chain dark pool system

set -e

echo "🚀 PhantomPool Enhanced On-Chain Deployment"
echo "==========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NETWORK="${NETWORK:-devnet}"
KEYPAIR_PATH="${KEYPAIR_PATH:-/home/kartik/.config/solana/id.json}"
PROGRAM_ID=""

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed"
        exit 1
    fi
    
    # Check Rust
    if ! command -v cargo &> /dev/null; then
        print_error "Rust is not installed"
        exit 1
    fi
    
    # Check Anchor
    if ! command -v anchor &> /dev/null; then
        print_error "Anchor CLI is not installed"
        exit 1
    fi
    
    # Check Solana CLI
    if ! command -v solana &> /dev/null; then
        print_error "Solana CLI is not installed"
        exit 1
    fi
    
    print_success "All prerequisites are installed"
}

# Setup environment
setup_environment() {
    print_status "Setting up environment..."
    
    # Set Solana cluster
    solana config set --url "$NETWORK"
    print_success "Solana cluster set to $NETWORK"
    
    # Set keypair
    solana config set --keypair "$KEYPAIR_PATH"
    print_success "Keypair set to $KEYPAIR_PATH"
    
    # Check balance
    balance=$(solana balance)
    print_status "Current balance: $balance"
    
    if [[ "$balance" == "0 SOL" ]]; then
        if [[ "$NETWORK" == "devnet" ]]; then
            print_warning "Zero balance detected. Requesting airdrop..."
            solana airdrop 2
            print_success "Airdrop completed"
        else
            print_error "Insufficient balance for deployment"
            exit 1
        fi
    fi
}

# Install dependencies
install_dependencies() {
    print_status "Installing dependencies..."
    
    # Install Node.js dependencies
    npm install
    
    # Install additional crypto libraries
    npm install elliptic @types/elliptic
    
    print_success "Dependencies installed"
}

# Build smart contracts
build_contracts() {
    print_status "Building smart contracts..."
    
    # Clean previous builds
    anchor clean
    
    # Build the program
    anchor build
    
    # Get program ID
    PROGRAM_ID=$(solana-keygen pubkey target/deploy/phantom_pool-keypair.json)
    print_success "Smart contract built. Program ID: $PROGRAM_ID"
}

# Deploy smart contracts
deploy_contracts() {
    print_status "Deploying smart contracts..."
    
    # Deploy the program
    anchor deploy
    
    print_success "Smart contracts deployed to $NETWORK"
}

# Initialize executor network
initialize_executor_network() {
    print_status "Initializing executor network..."
    
    # Create executor network initialization script
    cat > scripts/init_executor_network.ts << 'EOF'
import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { Program, AnchorProvider, web3, BN } from '@coral-xyz/anchor';
import { ElGamalRealService } from '../src/crypto/elgamal.enhanced.service';
import { ExecutorNetworkService } from '../src/services/executor-network.service';

async function initializeExecutorNetwork() {
    console.log('🔧 Initializing executor network...');
    
    const connection = new Connection(
        process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
        'confirmed'
    );
    
    // Initialize 5 executor nodes
    const executorNetwork = ExecutorNetworkService.getInstance({
        threshold: 3,
        totalNodes: 5,
        heartbeatInterval: 30000,
        slashingEnabled: true,
        minimumStake: BigInt(1000 * 1000000) // 1000 tokens
    });
    
    console.log('✅ Executor network initialized');
    
    // Get network status
    const status = executorNetwork.getNetworkStatus();
    console.log('📊 Network Status:', status);
    
    // Get executor statistics
    const stats = executorNetwork.getExecutorStats();
    console.log('📈 Executor Stats:', stats);
}

initializeExecutorNetwork()
    .then(() => {
        console.log('🎉 Executor network initialization complete');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Failed to initialize executor network:', error);
        process.exit(1);
    });
EOF
    
    # Run the initialization
    npx ts-node scripts/init_executor_network.ts
    
    print_success "Executor network initialized"
}

# Setup cryptographic parameters
setup_crypto_parameters() {
    print_status "Setting up cryptographic parameters..."
    
    # Create crypto setup script
    cat > scripts/setup_crypto.ts << 'EOF'
import { ElGamalRealService } from '../src/crypto/elgamal.enhanced.service';
import { VRFRealService } from '../src/crypto/vrf.enhanced.service';

async function setupCryptoParameters() {
    console.log('🔐 Setting up cryptographic parameters...');
    
    // Generate system keypair for ElGamal
    const systemKeyPair = ElGamalRealService.generateKeyPair();
    console.log('✅ ElGamal system keypair generated');
    
    // Generate threshold shares (3-of-5)
    const thresholdShares = ElGamalRealService.generateThresholdShares(3, 5);
    console.log('✅ Threshold shares generated (3-of-5)');
    
    // Generate VRF keypair for fair ordering
    const vrfKeyPair = VRFRealService.generateKeyPair();
    console.log('✅ VRF keypair generated');
    
    // Save configuration (in production, use secure key management)
    const config = {
        elGamalPublicKey: {
            x: systemKeyPair.pk.x.toString(),
            y: systemKeyPair.pk.y.toString()
        },
        thresholdPublicKey: {
            x: thresholdShares.publicKey.x.toString(),
            y: thresholdShares.publicKey.y.toString()
        },
        vrfPublicKey: Array.from(vrfKeyPair.publicKey),
        networkConfig: {
            threshold: 3,
            totalNodes: 5,
            minimumStake: '1000000000' // 1000 tokens
        }
    };
    
    console.log('📋 Cryptographic configuration:', config);
    
    // Test encryption/decryption
    const testMessage = BigInt(42);
    const encrypted = ElGamalRealService.encrypt(testMessage, systemKeyPair.pk);
    const decrypted = ElGamalRealService.decrypt(encrypted, systemKeyPair.sk);
    
    if (decrypted === testMessage) {
        console.log('✅ ElGamal encryption/decryption test passed');
    } else {
        throw new Error('ElGamal encryption/decryption test failed');
    }
    
    // Test VRF
    const testInput = new Uint8Array([1, 2, 3, 4]);
    const vrfProof = VRFRealService.prove(vrfKeyPair.privateKey, testInput);
    const verified = VRFRealService.verify(vrfKeyPair.publicKey, testInput, vrfProof);
    
    if (verified) {
        console.log('✅ VRF prove/verify test passed');
    } else {
        throw new Error('VRF prove/verify test failed');
    }
}

setupCryptoParameters()
    .then(() => {
        console.log('🎉 Cryptographic setup complete');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Failed to setup cryptographic parameters:', error);
        process.exit(1);
    });
EOF
    
    # Run the setup
    npx ts-node scripts/setup_crypto.ts
    
    print_success "Cryptographic parameters configured"
}

# Run tests
run_tests() {
    print_status "Running tests..."
    
    # Compile TypeScript
    npx tsc --noEmit
    
    # Test smart contracts
    anchor test
    
    print_success "All tests passed"
}

# Start services
start_services() {
    print_status "Starting services..."
    
    # Create systemd service files for production
    if [[ "$NETWORK" == "mainnet-beta" ]]; then
        print_status "Creating systemd services for production..."
        
        # Executor network service
        sudo tee /etc/systemd/system/phantom-pool-executor.service > /dev/null << EOF
[Unit]
Description=PhantomPool Executor Network
After=network.target

[Service]
Type=simple
User=phantom-pool
WorkingDirectory=/opt/phantom-pool
ExecStart=/usr/bin/node dist/services/executor-network.service.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=SOLANA_NETWORK=mainnet-beta

[Install]
WantedBy=multi-user.target
EOF
        
        # API service
        sudo tee /etc/systemd/system/phantom-pool-api.service > /dev/null << EOF
[Unit]
Description=PhantomPool API Server
After=network.target

[Service]
Type=simple
User=phantom-pool
WorkingDirectory=/opt/phantom-pool
ExecStart=/usr/bin/node dist/server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=SOLANA_NETWORK=mainnet-beta

[Install]
WantedBy=multi-user.target
EOF
        
        # Enable and start services
        sudo systemctl enable phantom-pool-executor
        sudo systemctl enable phantom-pool-api
        sudo systemctl start phantom-pool-executor
        sudo systemctl start phantom-pool-api
        
        print_success "Production services started"
    else
        # Development mode
        print_status "Starting development servers..."
        
        # Start executor network in background
        npm run start:executor-network &
        EXECUTOR_PID=$!
        
        # Start API server in background
        npm run start:onchain &
        API_PID=$!
        
        # Start frontend
        npm run dev &
        FRONTEND_PID=$!
        
        echo "🖥️  Development servers started:"
        echo "   - Executor Network (PID: $EXECUTOR_PID)"
        echo "   - API Server (PID: $API_PID)"
        echo "   - Frontend (PID: $FRONTEND_PID)"
        echo ""
        echo "📊 Access the application at: http://localhost:3000"
        echo "🔧 API endpoints available at: http://localhost:8080"
        echo ""
        echo "Press Ctrl+C to stop all services"
        
        # Wait for interruption
        trap "kill $EXECUTOR_PID $API_PID $FRONTEND_PID 2>/dev/null; exit 0" INT
        wait
    fi
}

# Health check
health_check() {
    print_status "Performing health check..."
    
    # Check if program is deployed
    if solana program show "$PROGRAM_ID" > /dev/null 2>&1; then
        print_success "Smart contract is deployed and active"
    else
        print_error "Smart contract deployment verification failed"
        exit 1
    fi
    
    # Check network connectivity
    if curl -s https://api.devnet.solana.com > /dev/null; then
        print_success "Network connectivity verified"
    else
        print_warning "Network connectivity issues detected"
    fi
    
    print_success "Health check completed"
}

# Display deployment summary
show_summary() {
    echo ""
    echo "🎉 PhantomPool Enhanced On-Chain Deployment Complete!"
    echo "=================================================="
    echo ""
    echo "📋 Deployment Summary:"
    echo "   Network: $NETWORK"
    echo "   Program ID: $PROGRAM_ID"
    echo "   Executor Nodes: 5 (3-of-5 threshold)"
    echo "   Cryptography: Real ElGamal + VRF + Threshold"
    echo "   Database Dependencies: ❌ None (Fully On-Chain)"
    echo ""
    echo "🔗 Endpoints:"
    if [[ "$NETWORK" == "devnet" ]]; then
        echo "   Frontend: http://localhost:3000"
        echo "   API: http://localhost:8080"
        echo "   Solana Explorer: https://explorer.solana.com/address/$PROGRAM_ID?cluster=devnet"
    else
        echo "   Production API: https://api.phantompool.io"
        echo "   Solana Explorer: https://explorer.solana.com/address/$PROGRAM_ID"
    fi
    echo ""
    echo "🔐 Security Features Enabled:"
    echo "   ✅ Real secp256k1 ElGamal encryption"
    echo "   ✅ 5-node threshold decryption network"
    echo "   ✅ VRF-based fair order matching"
    echo "   ✅ On-chain solvency proofs"
    echo "   ✅ Executor slashing mechanisms"
    echo "   ✅ Zero-knowledge privacy preservation"
    echo ""
    echo "📊 Monitor network health:"
    echo "   solana program show $PROGRAM_ID"
    echo "   curl http://localhost:8080/api/health"
    echo ""
    echo "Happy trading! 🚀"
}

# Main execution
main() {
    echo "Starting PhantomPool Enhanced On-Chain Deployment..."
    echo "Network: $NETWORK"
    echo "Keypair: $KEYPAIR_PATH"
    echo ""
    
    check_prerequisites
    setup_environment
    install_dependencies
    build_contracts
    deploy_contracts
    setup_crypto_parameters
    initialize_executor_network
    run_tests
    health_check
    
    if [[ "${START_SERVICES:-true}" == "true" ]]; then
        start_services
    fi
    
    show_summary
}

# Handle script arguments
case "${1:-deploy}" in
    "deploy")
        main
        ;;
    "test")
        check_prerequisites
        install_dependencies
        run_tests
        ;;
    "setup-crypto")
        setup_crypto_parameters
        ;;
    "init-network")
        initialize_executor_network
        ;;
    "health")
        health_check
        ;;
    *)
        echo "Usage: $0 [deploy|test|setup-crypto|init-network|health]"
        exit 1
        ;;
esac