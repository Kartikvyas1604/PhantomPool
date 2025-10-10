interface EnvConfig {
  PORT: number;
  NODE_ENV: 'development' | 'production' | 'test';
  LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error';
  DATABASE_URL: string;
  REDIS_URL: string;
  SOLANA_RPC_URL: string;
  SOLANA_NETWORK: string;
  ELGAMAL_PRIVATE_KEY: string;
  VRF_PRIVATE_KEY: string;
  JWT_SECRET?: string;
  RATE_LIMIT_MAX: number;
  SENTRY_DSN?: string;
  GRAFANA_PASSWORD?: string;
  FRONTEND_URL?: string;
}

export const Config: EnvConfig = {
  PORT: parseInt(process.env.PORT || '3000'),
  NODE_ENV: (process.env.NODE_ENV || 'development') as EnvConfig['NODE_ENV'],
  LOG_LEVEL: (process.env.LOG_LEVEL || 'info') as EnvConfig['LOG_LEVEL'],
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://phantompool:password@localhost:5432/phantompool',
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  SOLANA_RPC_URL: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
  SOLANA_NETWORK: process.env.SOLANA_NETWORK || 'devnet',
  ELGAMAL_PRIVATE_KEY: process.env.ELGAMAL_PRIVATE_KEY || 'd47f8a9c2b1e5f7a3c8e6d4b9a2f5c7e1d8b4a6c3e9f2b5d8a1c4e7f9b2d5a8c',
  VRF_PRIVATE_KEY: process.env.VRF_PRIVATE_KEY || 'c1f3d2e5a8b7c4f9e2d6a3b8c5e9f1d4a7b2c6e8f3d5a9c2b1e4f7d8a5c9e2',
  JWT_SECRET: process.env.JWT_SECRET,
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX || '100'),
  SENTRY_DSN: process.env.SENTRY_DSN,
  GRAFANA_PASSWORD: process.env.GRAFANA_PASSWORD,
  FRONTEND_URL: process.env.FRONTEND_URL,
};

export function validateConfig() {
  const required = ['ELGAMAL_PRIVATE_KEY', 'VRF_PRIVATE_KEY'];
  
  for (const key of required) {
    if (!process.env[key]) {
      console.error(`Missing required environment variable: ${key}`);
      process.exit(1);
    }
  }
  
  console.log('Configuration validated successfully');
}