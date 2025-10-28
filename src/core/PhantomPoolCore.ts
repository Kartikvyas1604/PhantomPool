import { TradingCore } from './TradingCore';
import { WalletManager, SystemMonitor, PriceService } from './ServiceManager';

export class PhantomPoolCore {
  public tradingCore: TradingCore;
  public walletManager: WalletManager;
  public systemMonitor: SystemMonitor;
  public priceService: PriceService;

  constructor() {
    this.tradingCore = new TradingCore();
    this.walletManager = new WalletManager();
    this.systemMonitor = new SystemMonitor();
    this.priceService = new PriceService();
  }

  async initialize() {
    await this.systemMonitor.checkHealth();
    await this.priceService.fetchPrices();
  }

  async submitTrade(order: {
    type: 'buy' | 'sell';
    amount: number;
    price: number;
    walletAddress: string;
  }) {
    if (!this.walletManager.getState().isConnected) {
      throw new Error('Wallet not connected');
    }

    return await this.tradingCore.submitOrder(order);
  }

  getSystemStatus() {
    return {
      wallet: this.walletManager.getState(),
      health: this.systemMonitor.getHealthData(),
      matching: this.tradingCore.getMatchingStatus(),
      prices: this.tradingCore.getCurrentMarketData()
    };
  }
}

export default PhantomPoolCore;