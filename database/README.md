# PhantomPool Database Setup

This directory contains the complete Supabase database schema and configuration for the PhantomPool dark pool trading system.

## 📁 Files Overview

- `supabase-schema.sql` - Complete database schema with tables, indexes, RLS, and initial data
- `supabase-functions.sql` - Custom database functions for order management and operations
- `../src/types/database.ts` - TypeScript type definitions for all database entities
- `../src/services/database.service.ts` - Database service class with typed methods
- `../.env.example` - Environment configuration template

## 🚀 Quick Setup

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for the project to initialize
3. Note your project URL and API keys

### 2. Run Database Schema

Execute the schema files in your Supabase SQL editor:

```sql
-- 1. Run the main schema
\i supabase-schema.sql

-- 2. Run the custom functions  
\i supabase-functions.sql
```

Or via Supabase CLI:
```bash
# Install Supabase CLI
npm install -g @supabase/cli

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-id

# Push schema to Supabase
supabase db push
```

### 3. Configure Environment

```bash
# Copy environment template
cp .env.example .env.local

# Edit with your Supabase credentials
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Install Dependencies

```bash
npm install @supabase/supabase-js
```

## 📋 Database Schema Overview

### Core Tables

#### Users & Authentication
- `users` - User profiles and KYC information
- `user_balances` - Token balances with cryptographic commitments

#### Trading System  
- `trading_pairs` - Supported token pairs (SOL/USDC, etc.)
- `market_stats` - Real-time market statistics
- `encrypted_orders` - Dark pool orders with ElGamal encryption
- `order_pools` - Aggregated order pools for efficient matching

#### Matching & Execution
- `matching_sessions` - Batch matching results with ZK proofs
- `trades` - Individual trade records
- `threshold_operations` - 3-of-5 threshold decryption operations
- `executor_nodes` - Network of 5 executor nodes

#### Cryptographic Proofs
- `cryptographic_proofs` - Storage for all ZK proofs and verification
- `audit_log` - Complete audit trail for compliance

#### Monitoring
- `system_metrics` - Performance and usage metrics
- `system_health` - Real-time system status

### Key Features

✅ **Row Level Security (RLS)** - Users only see their own data  
✅ **Real-time Subscriptions** - Live updates via Supabase Realtime  
✅ **Audit Trail** - Complete logging for regulatory compliance  
✅ **Performance Optimized** - Strategic indexes for fast queries  
✅ **Cryptographic Storage** - Secure storage of encrypted orders and proofs  

## 🔧 Custom Functions

The database includes custom functions for secure operations:

- `submit_encrypted_order()` - Validates and stores encrypted orders
- `create_matching_session()` - Creates matching batches with proofs
- `update_system_health()` - Updates component health status
- `cleanup_expired_orders()` - Automated cleanup of expired orders

## 📊 Usage Examples

### Submitting an Order

```typescript
import { db } from '../src/services/database.service';

const orderId = await db.submitEncryptedOrder({
  user_id: 'user-uuid',
  trading_pair_id: 'pair-uuid', 
  order_type: 'limit',
  side: 'buy',
  encrypted_amount: 'encrypted-amount-data',
  encrypted_price: 'encrypted-price-data',
  solvency_proof: { /* bulletproof data */ },
  signature_proof: 'signature',
  nonce: 'unique-nonce'
});
```

### Real-time Order Updates

```typescript
// Subscribe to order updates
const subscription = db.subscribeToOrderUpdates(userId, (payload) => {
  console.log('Order updated:', payload.new);
});

// Cleanup subscription
subscription.unsubscribe();
```

### Market Data

```typescript
// Get all trading pairs
const pairs = await db.getTradingPairs();

// Get market statistics  
const stats = await db.getMarketStats();

// Get user's trading history
const trades = await db.getUserTrades(userId);
```

## 🔒 Security Features

### Row Level Security Policies

```sql
-- Users can only see their own orders
CREATE POLICY "Users can view own orders" ON encrypted_orders
    FOR SELECT USING (
        user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
    );
```

### Audit Logging

All operations are automatically logged:

```sql
-- Log order submission
INSERT INTO audit_log (event_type, event_category, user_id, event_data)
VALUES ('order_submitted', 'order', user_id, order_data);
```

### Data Encryption

- **ElGamal Encryption**: Order amounts and prices are encrypted client-side
- **Commitment Schemes**: Balances use Pedersen commitments for privacy
- **Zero-Knowledge Proofs**: Solvency and range proofs stored securely

## 🏗️ Architecture Decisions

### Why Supabase?

1. **Real-time subscriptions** - Essential for live trading updates
2. **Row Level Security** - Built-in user isolation
3. **PostgreSQL** - Advanced JSON support for crypto proofs  
4. **Scalability** - Handles high-frequency trading workloads
5. **Developer Experience** - TypeScript integration and migrations

### Database Design Principles

1. **Normalization** - Proper relational structure for data integrity
2. **Indexing Strategy** - Optimized for trading query patterns
3. **Audit Trail** - Every operation logged for compliance
4. **Soft Deletes** - Data retention for regulatory requirements
5. **Versioning** - Schema changes tracked via migrations

## 📈 Performance Optimization

### Strategic Indexing

```sql
-- Order book queries
CREATE INDEX idx_encrypted_orders_side_status 
ON encrypted_orders(side, status);

-- User order history  
CREATE INDEX idx_encrypted_orders_user_created 
ON encrypted_orders(user_id, created_at DESC);

-- Market statistics
CREATE INDEX idx_trades_created_at 
ON trades(created_at DESC);
```

### Query Optimization

- **Partial indexes** on filtered data (active orders only)
- **Composite indexes** for multi-column queries
- **JSONB indexes** for cryptographic proof searching
- **Connection pooling** for high concurrency

## 🔍 Monitoring & Analytics

### Health Checks

```typescript
// Check database connectivity
const health = await db.healthCheck();
console.log('Database status:', health.healthy);
```

### Metrics Collection

```typescript  
// Record performance metrics
await db.recordMetric({
  metric_name: 'order_processing_time',
  metric_value: 150.5,
  component: 'matching_engine',
  metric_unit: 'milliseconds'
});
```

## 🚨 Error Handling

### Common Issues

1. **Connection timeouts** - Use connection pooling
2. **RLS violations** - Ensure proper user context
3. **Constraint violations** - Validate data before insertion
4. **Migration conflicts** - Use proper migration ordering

### Debugging

```typescript
try {
  await db.submitOrder(orderData);
} catch (error) {
  console.error('Database error:', error.message);
  // Handle specific error types
}
```

## 🔄 Backup & Recovery

### Automated Backups

Supabase provides:
- **Point-in-time recovery** (7 days retention)
- **Daily automated backups**
- **Cross-region replication** (Pro plan)

### Manual Backup

```bash
# Export schema
pg_dump --schema-only --no-owner postgres://... > schema.sql

# Export data  
pg_dump --data-only --no-owner postgres://... > data.sql
```

## 🚀 Production Deployment

### Environment Setup

1. **Enable RLS** on all sensitive tables
2. **Configure auth policies** for user isolation  
3. **Set up monitoring** for performance metrics
4. **Enable audit logging** for compliance
5. **Configure backups** and recovery procedures

### Performance Tuning

```sql
-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM encrypted_orders 
WHERE user_id = 'uuid' AND status = 'active';

-- Update table statistics
ANALYZE encrypted_orders;
```

## 📚 Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [PostgreSQL Performance](https://wiki.postgresql.org/wiki/Performance_Optimization)
- [Database Security Best Practices](https://supabase.com/docs/guides/auth/row-level-security)
- [Real-time Subscriptions](https://supabase.com/docs/guides/realtime)

---

**🎯 Ready to build the future of decentralized trading!**

The database is now configured for high-performance, secure, and compliant dark pool operations with full cryptographic proof storage and real-time capabilities.