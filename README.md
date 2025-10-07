# PhantomPool - Zero-Knowledge Dark Pool Trading Platform

A privacy-first decentralized exchange built on Solana that enables large traders to execute orders without revealing their trading intentions or positions to the market.

## What is PhantomPool?

PhantomPool solves the $2B+ monthly OTC trading problem by providing institutional-grade privacy for on-chain trades. Traditional DEXs expose all order information publicly, allowing MEV bots and front-runners to exploit large trades. Our solution uses advanced cryptographic techniques to keep orders completely private until execution.

## Core Features

### 🔒 Complete Trade Privacy
- Orders encrypted with ElGamal homomorphic encryption
- Zero-knowledge proofs ensure solvency without revealing balances
- VRF-based fair ordering prevents MEV attacks
- Threshold decryption across 5 executor nodes

### ⚡ Optimal Execution
- Jupiter aggregator integration for best prices
- Batch auction mechanism with 30-second intervals
- Fair clearing price for all matched trades
- Atomic settlement prevents partial fills

### 🛡️ Trustless Security
- 3-of-5 threshold signatures for execution
- Bulletproofs+ for solvency verification
- Verifiable randomness for order shuffling
- On-chain settlement with full transparency

## How It Works

1. **Order Submission**: Traders submit encrypted orders with solvency proofs
2. **Private Matching**: Orders are shuffled using VRF and matched at fair clearing prices
3. **Threshold Decryption**: 3 of 5 executors must agree to decrypt matched orders
4. **Jupiter Execution**: Trades execute through optimal DEX routes
5. **Settlement**: All trades settle atomically on Solana

## Technology Stack

### Frontend
- **Next.js 14** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **Framer Motion** - Smooth animations
- **Solana Wallet Adapter** - Wallet integration

### Cryptography
- **ElGamal Encryption** - Homomorphic encryption for private orders
- **Bulletproofs+** - Zero-knowledge range proofs for solvency
- **VRF (Verifiable Random Function)** - Fair order shuffling
- **Threshold Cryptography** - Distributed decryption (3-of-5)

### Blockchain
- **Solana** - High-performance blockchain
- **Anchor Framework** - Smart contract development
- **Jupiter Aggregator** - Optimal swap routing
- **SPL Tokens** - Token standard compliance

### Backend Services
- **Node.js + Fastify** - High-performance API server
- **PostgreSQL** - Order and trade persistence
- **Redis** - In-memory order book
- **WebSocket** - Real-time updates

## Getting Started

### Prerequisites
- Node.js 18+ and npm
- Solana CLI tools
- Phantom wallet or compatible Solana wallet

### Installation

```bash
# Clone the repository
git clone https://github.com/Kartikvyas1604/PhantomPool.git
cd PhantomPool

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your configuration

# Start development server
npm run dev
```

### Environment Configuration

```env
# Solana Configuration
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_SOLANA_NETWORK=devnet

# Jupiter API
NEXT_PUBLIC_JUPITER_API_URL=https://quote-api.jup.ag/v6

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
├── components/             # React components
│   ├── ui/                # Reusable UI components
│   └── figma/             # Design system components
├── crypto/                # Cryptographic services
│   ├── elgamal.real.service.ts      # Homomorphic encryption
│   ├── bulletproofs.real.service.ts # Zero-knowledge proofs
│   ├── vrf.real.service.ts          # Verifiable randomness
│   ├── matching.real.service.ts     # Order matching engine
│   └── threshold.real.service.ts    # Threshold decryption
├── services/              # Business logic services
│   ├── solana.service.ts           # Solana blockchain integration
│   ├── jupiter.service.ts          # DEX aggregation
│   ├── phantompool.real.service.ts # Main trading service
│   └── websocket.real.service.ts   # Real-time updates
└── types/                 # TypeScript type definitions
```

## Key Components

### Trading Interface
- **Order Submission**: Encrypted order entry with solvency verification
- **Order Book**: Live view of encrypted orders (volumes hidden)
- **Trade Execution**: Jupiter-powered optimal routing
- **Portfolio**: Real-time balance and trade history

### Cryptographic Dashboard
- **ElGamal Encryption**: Active order encryption status
- **Bulletproofs Solvency**: Zero-knowledge balance verification
- **VRF Fairness**: Order shuffling entropy metrics
- **Threshold Network**: Executor node health monitoring

## Security Features

### Privacy Guarantees
- Order amounts and prices remain encrypted until execution
- Trader identities protected through nullifier schemes
- No front-running possible due to encrypted order book
- MEV protection through VRF-based fair ordering

### Economic Security
- Solvency proofs ensure all traders can cover their orders
- Atomic execution prevents partial fills and failed trades
- Slippage protection through Jupiter's optimal routing
- No custody risk - trades settle directly to user wallets

## Development Roadmap

### Phase 1: Core Platform ✅
- [x] Frontend trading interface
- [x] Solana wallet integration
- [x] Basic cryptographic services
- [x] Jupiter DEX integration

### Phase 2: Advanced Cryptography (Current)
- [x] ElGamal homomorphic encryption
- [x] Bulletproofs+ solvency verification
- [x] VRF fair ordering system
- [x] Threshold decryption network

### Phase 3: Production Backend (Next)
- [ ] Fastify API server
- [ ] PostgreSQL order persistence
- [ ] Redis in-memory order book
- [ ] WebSocket real-time updates
- [ ] 5-node executor network

### Phase 4: Advanced Features (Future)
- [ ] Cross-chain trading support
- [ ] Institutional API access
- [ ] Advanced order types (TWAP, VWAP)
- [ ] Governance token and DAO

## Contributing

We welcome contributions from the community! Please read our contributing guidelines and code of conduct before submitting pull requests.

### Development Setup
1. Fork the repository
2. Create a feature branch
3. Make your changes with proper tests
4. Submit a pull request with detailed description

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Disclaimer

PhantomPool is experimental software under active development. Use at your own risk. The cryptographic implementations have not been formally audited and should not be used with significant funds until proper security reviews are completed.

## Contact

- **Website**: https://phantompool.network
- **Twitter**: @PhantomPoolDEX
- **Discord**: https://discord.gg/phantompool
- **Email**: team@phantompool.network

---

*Built with ❤️ for the future of private DeFi trading*