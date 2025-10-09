# PhantomPool - Zero-Knowledge Dark Pool

<div align="center">
  <img src="public/logo.svg" alt="PhantomPool Logo" width="200"/>
  
  **Professional Zero-Knowledge Dark Pool Trading Platform**
  
  ![Next.js](https://img.shields.io/badge/Next.js-15.1.4-black)
  ![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
  ![Solana](https://img.shields.io/badge/Solana-Devnet-purple)
  ![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4.1.3-blue)
</div>

## 🔐 Overview

PhantomPool is a cutting-edge decentralized exchange (DEX) that provides **zero-knowledge privacy** for cryptocurrency trading. Built on Solana blockchain, it enables traders to execute large orders without revealing sensitive information through advanced cryptographic techniques.

## ✨ Key Features

### 🛡️ Privacy & Security
- **ElGamal Homomorphic Encryption** - Orders encrypted end-to-end
- **Bulletproofs+ Zero-Knowledge** - Prove solvency without revealing balances  
- **VRF Randomization** - Fair order matching with verifiable randomness
- **MEV Protection** - Front-running resistant architecture

### 💼 Professional Trading Interface
- **Terminal-Style UI** - Industry-standard trading experience
- **Real-Time Order Book** - Live bid/ask spreads and market data
- **Portfolio Management** - Positions, orders, and trade history
- **Multi-Order Types** - Limit orders, market orders, advanced options

### ⚡ Performance
- **Solana Integration** - Sub-second transaction finality
- **Jupiter DEX Routing** - Optimal execution paths
- **Professional APIs** - WebSocket feeds and REST endpoints
- **Responsive Design** - Desktop and mobile optimized

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Solana wallet (Phantom, Solflare)

### Installation

```bash
# Clone the repository
git clone https://github.com/Kartikvyas1604/PhantomPool.git
cd PhantomPool

# Install dependencies
npm install

# Start development server
npm run dev
```

Visit `http://localhost:3000` to access the trading terminal.

### Build for Production

```bash
# Create optimized build
npm run build

# Start production server
npm start
```

## 🏗️ Architecture

### Frontend Stack
- **Next.js 15.1.4** - React framework with App Router
- **TypeScript** - Type-safe development
- **TailwindCSS** - Professional styling system
- **Framer Motion** - Smooth animations

### Blockchain Integration
- **Solana Web3.js** - Blockchain interaction
- **Anchor Framework** - Smart contract deployment
- **Jupiter API** - DEX aggregation
- **Phantom Wallet** - User authentication

### Cryptographic Services
- **ElGamal Service** - Homomorphic encryption
- **Bulletproofs Service** - Zero-knowledge range proofs
- **VRF Service** - Verifiable random functions
- **Threshold Decryption** - Distributed key management

## 📁 Project Structure

```
PhantomPool/
├── src/
│   ├── app/                    # Next.js app directory
│   ├── components/             # React components
│   │   ├── ui/                 # Reusable UI components  
│   │   ├── Header.tsx          # Navigation header
│   │   ├── TradingForm.tsx     # Order entry interface
│   │   ├── OrderBookList.tsx   # Live order book
│   │   └── TradeExecution.tsx  # Portfolio management
│   ├── crypto/                 # Cryptographic services
│   ├── services/               # Business logic
│   ├── styles/                 # CSS and themes
│   └── types/                  # TypeScript definitions
├── programs/                   # Solana smart contracts
├── public/                     # Static assets
└── ...config files
```

## 🔧 Configuration

### Environment Variables
Create a `.env.local` file:

```env
# Solana Configuration
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_PROGRAM_ID=Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS

# Jupiter DEX
NEXT_PUBLIC_JUPITER_API=https://quote-api.jup.ag/v6

# Application
NEXT_PUBLIC_APP_NAME=PhantomPool
NEXT_PUBLIC_APP_URL=https://phantompool.app
```

### Solana Program Deployment

```bash
# Build and deploy smart contracts
anchor build
anchor deploy --provider.cluster devnet
```

## 🎨 Customization

### Themes
The application uses a professional dark theme optimized for trading terminals. Customize colors in:
- `src/styles/theme.css` - Professional color palette
- `src/styles/globals.css` - Global styles
- `tailwind.config.js` - TailwindCSS configuration

### Trading Pairs
Add new trading pairs in:
- `src/services/jupiter.service.ts` - Market data integration
- `src/components/TradingForm.tsx` - UI components

## 📊 Features in Detail

### Order Entry
- **Professional Interface** - Industry-standard order entry form
- **Order Types** - Limit, Market, Stop-Loss, Take-Profit
- **Risk Management** - Balance validation, position sizing
- **Encryption** - All orders encrypted before submission

### Order Book
- **Real-Time Updates** - Live bid/ask prices and volumes  
- **Privacy Layer** - Encrypted orders separate from public book
- **Market Depth** - Full order book depth visualization
- **Trade History** - Recent execution data

### Portfolio Management  
- **Position Tracking** - Real-time P&L and exposure
- **Order Management** - Cancel, modify, monitor orders
- **Trade History** - Detailed execution records
- **Risk Metrics** - Margin usage, leverage, liquidation

## 🛡️ Security

### Cryptographic Guarantees
- **Order Privacy** - ElGamal encryption hides order details
- **Solvency Proofs** - Bulletproofs verify sufficient balance
- **Fair Matching** - VRF ensures unbiased order execution
- **MEV Resistance** - Time-delayed decryption prevents front-running

### Smart Contract Security
- **Anchor Framework** - Rust-based secure development
- **On-Chain Verification** - All proofs verified on Solana
- **Decentralized Matching** - No central authority required
- **Audit Ready** - Clean, documented code structure

## 🚀 Deployment

### Vercel (Recommended)
```bash
# Deploy to Vercel
npm i -g vercel
vercel --prod
```

### Docker
```bash
# Build container
docker build -t phantompool .

# Run container  
docker run -p 3000:3000 phantompool
```

## 🤝 Contributing

We welcome contributions! Please see our contributing guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Links

- **Live Demo**: [https://phantompool.app](https://phantompool.app)
- **Documentation**: [https://docs.phantompool.app](https://docs.phantompool.app)  
- **Smart Contracts**: [Solana Explorer](https://explorer.solana.com/address/Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS?cluster=devnet)
- **Discord**: [Community Chat](https://discord.gg/phantompool)

## 📞 Support

- **Email**: support@phantompool.app
- **Twitter**: [@PhantomPoolDEX](https://twitter.com/PhantomPoolDEX)
- **GitHub Issues**: [Report bugs](https://github.com/Kartikvyas1604/PhantomPool/issues)

---

<div align="center">
  <strong>Built with ❤️ for the future of private trading</strong>
</div>