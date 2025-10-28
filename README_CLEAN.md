# PhantomPool - Advanced Dark Pool Trading Platform

A production-ready decentralized dark pool trading platform built with Next.js, TypeScript, and Solana integration.

## Architecture

### Core Services (`/src/core/`)
- **TradingCore.ts** - Main trading engine with order matching and execution
- **ServiceManager.ts** - Wallet, system monitoring, and price services  
- **PhantomPoolCore.ts** - Unified service integration layer

### Components (`/src/components/`)
- **WalletConnection.tsx** - Phantom wallet integration
- **AdvancedTradingForm.tsx** - Professional trading interface
- **RealTimePriceChart.tsx** - Live price visualization
- **UI Components** - Professional UI component library

### Real-time Data (`/src/hooks/`)
- **useRealTimeData.ts** - Jupiter API integration for live prices
- **useSystemMonitoring.ts** - System health and matching status

### API Endpoints (`/src/app/api/`)
- **GET /health** - System health status
- **GET /api/matching/status** - Matching engine status  
- **GET /api/price** - Jupiter price proxy

## Features

### Privacy & Security
- ElGamal encryption for order privacy
- VRF-based fair shuffling
- Zero-knowledge proofs
- Bulletproof solvency verification

### Trading Engine
- 30-second batched matching rounds
- Real-time order book management
- Encrypted order submission
- Fair price discovery

### Real-time Integration
- Live SOL/USDC/BTC prices via Jupiter API
- WebSocket-ready architecture
- System health monitoring
- Phantom wallet integration

## Development

### Start Development Server
```bash
npm run dev
```

### Build for Production  
```bash
npm run build
npm start
```

### Environment Variables
```bash
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
NEXT_PUBLIC_JUPITER_API_URL=https://price.jup.ag/v4/price
```

## Production Ready Features

- ✅ Real Phantom wallet connection
- ✅ Live Jupiter API price feeds  
- ✅ Professional system monitoring
- ✅ Responsive design with loading states
- ✅ Error handling and fallbacks
- ✅ Clean architecture and code organization
- ✅ TypeScript throughout
- ✅ Production-grade API endpoints

## Tech Stack

- **Frontend**: Next.js 15.5.4, TypeScript, Tailwind CSS
- **Blockchain**: Solana, Phantom Wallet (@solana/web3.js)
- **Data**: Jupiter API, Real-time polling
- **UI**: shadcn/ui components, Lucide icons
- **Architecture**: Clean separation of concerns, service-oriented

Visit http://localhost:3000 to experience the platform.