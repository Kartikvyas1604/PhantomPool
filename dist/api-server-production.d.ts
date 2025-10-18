declare class ProductionPhantomPoolServer {
    private app;
    private port;
    private financialSafety;
    private database;
    private solanaService;
    private riskManager;
    private complianceSystem;
    constructor(port?: number);
    private initializeServices;
    private setupMiddleware;
    private setupRoutes;
    private setupErrorHandling;
    start(): Promise<void>;
}
export default ProductionPhantomPoolServer;
