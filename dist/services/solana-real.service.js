/**
 * PhantomPool REAL Solana Integration Service
 * PRODUCTION READY: No mocks, no demos - Real blockchain transactions only
 * 
 * This service handles all real Solana blockchain interactions:
 * 1. Real wallet connections and authentication
 * 2. Real token transfers and swaps
 * 3. Real on-chain program interactions
 * 4. Real transaction signing and submission
 * 5. Real balance queries and account management
 */

const { 
    Connection, 
    PublicKey, 
    Transaction, 
    sendAndConfirmTransaction,
    LAMPORTS_PER_SOL,
    SystemProgram,
    Keypair
} = require('@solana/web3.js');

const {
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    getOrCreateAssociatedTokenAccount,
    transfer,
    getAccount,
    createTransferInstruction,
    getAssociatedTokenAddress
} = require('@solana/spl-token');

// Wallet adapter not needed for server-side operations
const PhantomPoolFinancialSafety = require('./financial-safety.service');

class RealSolanaIntegrationService {
    constructor() {
        // PRODUCTION RPC endpoints
        this.mainnetConnection = new Connection(
            process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
            {
                commitment: 'finalized',
                confirmTransactionInitialTimeout: 60000,
                wsEndpoint: process.env.SOLANA_WS_URL || 'wss://api.mainnet-beta.solana.com'
            }
        );

        // Initialize financial safety service
        this.financialSafety = new PhantomPoolFinancialSafety();
        
        // Real program IDs
        try {
            this.JUPITER_PROGRAM_ID = new PublicKey('JUP6LkbZbjS1jKKwapdHNy74zetqYg4C6sPKqK6BBWqT');
            this.SERUM_PROGRAM_ID = new PublicKey('srmqPvymJeFKQ4UGQqgXyAYGZcQkf3vXrPrQg5WKY4C');
        } catch (error) {
            console.warn('Failed to initialize program IDs:', error.message);
        }
        
        // Transaction confirmation settings
        this.confirmationSettings = {
            skipPreflight: false,
            preflightCommitment: 'finalized',
            maxRetries: 3,
            commitment: 'finalized'
        };

        this.isProduction = process.env.NODE_ENV === 'production';
        
        // For development/testing, we'll allow the service to run but log warnings
        if (!this.isProduction) {
            console.warn('⚠️  WARNING: Running in development mode - use with caution');
        }
    }

    /**
     * REAL wallet connection - No simulation
     */
    async connectWallet(walletAddress, signTransaction) {
        try {
            const publicKey = new PublicKey(walletAddress);
            
            // Verify wallet exists on-chain
            const accountInfo = await this.mainnetConnection.getAccountInfo(publicKey);
            if (!accountInfo) {
                throw new Error('WALLET_NOT_FOUND: Wallet does not exist on Solana mainnet');
            }

            // Verify wallet can sign transactions
            if (!signTransaction || typeof signTransaction !== 'function') {
                throw new Error('INVALID_SIGNER: Wallet must provide transaction signing capability');
            }

            // Test signing capability with a dummy transaction
            await this.testWalletSigning(publicKey, signTransaction);

            const walletInfo = {
                publicKey: publicKey,
                signTransaction: signTransaction,
                connected: true,
                balance: await this.getRealBalance(publicKey),
                network: 'mainnet-beta',
                connectedAt: Date.now()
            };

            this.financialSafety.logAuditEvent('WALLET_CONNECTED', {
                wallet: walletAddress,
                balance: walletInfo.balance
            }, 'SUCCESS');

            return walletInfo;

        } catch (error) {
            this.financialSafety.logAuditEvent('WALLET_CONNECTION_FAILED', {
                wallet: walletAddress,
                error: error.message
            }, 'ERROR');
            
            throw new Error(`Real wallet connection failed: ${error.message}`);
        }
    }

    /**
     * REAL balance query from blockchain
     */
    async getRealBalance(publicKey, tokenMint = null) {
        try {
            if (!tokenMint) {
                // SOL balance
                const balance = await this.mainnetConnection.getBalance(publicKey, 'finalized');
                return {
                    amount: balance,
                    decimals: 9,
                    uiAmount: balance / LAMPORTS_PER_SOL,
                    token: 'SOL'
                };
            } else {
                // SPL Token balance
                const tokenMintPubkey = new PublicKey(tokenMint);
                const associatedTokenAddress = await getAssociatedTokenAddress(
                    tokenMintPubkey,
                    publicKey
                );

                const tokenAccount = await getAccount(
                    this.mainnetConnection,
                    associatedTokenAddress
                );

                return {
                    amount: tokenAccount.amount,
                    decimals: tokenAccount.decimals,
                    uiAmount: Number(tokenAccount.amount) / Math.pow(10, tokenAccount.decimals),
                    token: tokenMint,
                    associatedTokenAddress: associatedTokenAddress.toString()
                };
            }

        } catch (error) {
            if (error.name === 'TokenAccountNotFoundError') {
                return {
                    amount: 0,
                    decimals: 0,
                    uiAmount: 0,
                    token: tokenMint || 'SOL'
                };
            }
            throw new Error(`Failed to get real balance: ${error.message}`);
        }
    }

    /**
     * REAL SOL transfer - Actual blockchain transaction
     */
    async transferSOL(fromWallet, toAddress, amount, memo = null) {
        try {
            // CRITICAL: Validate transaction through financial safety service
            const validationResult = await this.financialSafety.validateTransaction({
                type: 'SOL_TRANSFER',
                userWallet: fromWallet.publicKey.toString(),
                toAddress: toAddress,
                amount: amount * LAMPORTS_PER_SOL,
                tokenMint: 'SOL',
                timestamp: Date.now()
            });

            // Create real transfer transaction
            const transaction = new Transaction();
            const fromPubkey = fromWallet.publicKey;
            const toPubkey = new PublicKey(toAddress);
            const lamports = amount * LAMPORTS_PER_SOL;

            // Add transfer instruction
            transaction.add(
                SystemProgram.transfer({
                    fromPubkey: fromPubkey,
                    toPubkey: toPubkey,
                    lamports: lamports
                })
            );

            // Add memo if provided
            if (memo) {
                const memoInstruction = new TransactionInstruction({
                    keys: [{ pubkey: fromPubkey, isSigner: true, isWritable: false }],
                    data: Buffer.from(memo, 'utf-8'),
                    programId: new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr')
                });
                transaction.add(memoInstruction);
            }

            // Get recent blockhash
            const { blockhash } = await this.mainnetConnection.getLatestBlockhash('finalized');
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = fromPubkey;

            // Sign transaction with real wallet
            const signedTransaction = await fromWallet.signTransaction(transaction);

            // Submit to blockchain
            const signature = await this.mainnetConnection.sendRawTransaction(
                signedTransaction.serialize(),
                this.confirmationSettings
            );

            // Wait for confirmation
            const confirmation = await this.mainnetConnection.confirmTransaction({
                signature: signature,
                blockhash: blockhash,
                lastValidBlockHeight: (await this.mainnetConnection.getLatestBlockhash()).lastValidBlockHeight
            }, 'finalized');

            if (confirmation.value.err) {
                throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
            }

            // Verify transaction success
            const transactionResult = await this.mainnetConnection.getTransaction(signature, {
                commitment: 'finalized'
            });

            const result = {
                signature: signature,
                success: true,
                blockHeight: transactionResult.slot,
                fee: transactionResult.meta.fee,
                amount: amount,
                from: fromPubkey.toString(),
                to: toPubkey.toString(),
                timestamp: Date.now(),
                confirmations: 1
            };

            this.financialSafety.logAuditEvent('SOL_TRANSFER_SUCCESS', result, 'SUCCESS');
            return result;

        } catch (error) {
            this.financialSafety.logAuditEvent('SOL_TRANSFER_FAILED', {
                from: fromWallet.publicKey.toString(),
                to: toAddress,
                amount: amount,
                error: error.message
            }, 'ERROR');

            throw new Error(`Real SOL transfer failed: ${error.message}`);
        }
    }

    /**
     * REAL SPL Token transfer - Actual on-chain token transfer
     */
    async transferSPLToken(fromWallet, toAddress, tokenMint, amount) {
        try {
            // Validate through financial safety service
            await this.financialSafety.validateTransaction({
                type: 'TOKEN_TRANSFER',
                userWallet: fromWallet.publicKey.toString(),
                toAddress: toAddress,
                amount: amount,
                tokenMint: tokenMint,
                timestamp: Date.now()
            });

            const fromPubkey = fromWallet.publicKey;
            const toPubkey = new PublicKey(toAddress);
            const mintPubkey = new PublicKey(tokenMint);

            // Get or create associated token accounts
            const fromTokenAccount = await getOrCreateAssociatedTokenAccount(
                this.mainnetConnection,
                fromWallet,
                mintPubkey,
                fromPubkey
            );

            const toTokenAccount = await getOrCreateAssociatedTokenAccount(
                this.mainnetConnection,
                fromWallet,
                mintPubkey,
                toPubkey
            );

            // Get token decimals
            const mintInfo = await this.mainnetConnection.getParsedAccountInfo(mintPubkey);
            const decimals = mintInfo.value.data.parsed.info.decimals;
            const adjustedAmount = amount * Math.pow(10, decimals);

            // Create transfer transaction
            const transaction = new Transaction();
            transaction.add(
                createTransferInstruction(
                    fromTokenAccount.address,
                    toTokenAccount.address,
                    fromPubkey,
                    adjustedAmount,
                    [],
                    TOKEN_PROGRAM_ID
                )
            );

            // Get recent blockhash and set fee payer
            const { blockhash } = await this.mainnetConnection.getLatestBlockhash('finalized');
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = fromPubkey;

            // Sign and send transaction
            const signedTransaction = await fromWallet.signTransaction(transaction);
            const signature = await this.mainnetConnection.sendRawTransaction(
                signedTransaction.serialize(),
                this.confirmationSettings
            );

            // Confirm transaction
            const confirmation = await this.mainnetConnection.confirmTransaction({
                signature: signature,
                blockhash: blockhash,
                lastValidBlockHeight: (await this.mainnetConnection.getLatestBlockhash()).lastValidBlockHeight
            }, 'finalized');

            if (confirmation.value.err) {
                throw new Error(`Token transfer failed: ${JSON.stringify(confirmation.value.err)}`);
            }

            const result = {
                signature: signature,
                success: true,
                amount: amount,
                tokenMint: tokenMint,
                from: fromPubkey.toString(),
                to: toPubkey.toString(),
                timestamp: Date.now()
            };

            this.financialSafety.logAuditEvent('TOKEN_TRANSFER_SUCCESS', result, 'SUCCESS');
            return result;

        } catch (error) {
            this.financialSafety.logAuditEvent('TOKEN_TRANSFER_FAILED', {
                from: fromWallet.publicKey.toString(),
                to: toAddress,
                tokenMint: tokenMint,
                amount: amount,
                error: error.message
            }, 'ERROR');

            throw new Error(`Real token transfer failed: ${error.message}`);
        }
    }

    /**
     * REAL Jupiter swap integration - Actual DEX trading
     */
    async executeJupiterSwap(wallet, inputMint, outputMint, amount, slippageBps) {
        try {
            // Get real Jupiter quote
            const quote = await this.getJupiterQuote(inputMint, outputMint, amount, slippageBps);
            
            // Validate swap through financial safety
            await this.financialSafety.validateTransaction({
                type: 'JUPITER_SWAP',
                userWallet: wallet.publicKey.toString(),
                inputMint: inputMint,
                outputMint: outputMint,
                amount: amount,
                expectedPrice: quote.outAmount / quote.inAmount,
                slippageTolerance: slippageBps / 10000,
                priceImpact: quote.priceImpactPct / 100,
                timestamp: Date.now()
            });

            // Get swap transaction from Jupiter API
            const swapResponse = await fetch('https://quote-api.jup.ag/v6/swap', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    quoteResponse: quote,
                    userPublicKey: wallet.publicKey.toString(),
                    wrapAndUnwrapSol: true,
                    useSharedAccounts: true,
                    feeAccount: process.env.JUPITER_FEE_ACCOUNT,
                    computeUnitPriceMicroLamports: 'auto'
                })
            });

            const swapData = await swapResponse.json();
            if (swapData.error) {
                throw new Error(`Jupiter swap preparation failed: ${swapData.error}`);
            }

            // Deserialize and sign transaction
            const swapTransactionBuf = Buffer.from(swapData.swapTransaction, 'base64');
            const transaction = Transaction.from(swapTransactionBuf);
            
            const signedTransaction = await wallet.signTransaction(transaction);

            // Submit transaction
            const signature = await this.mainnetConnection.sendRawTransaction(
                signedTransaction.serialize(),
                {
                    skipPreflight: false,
                    maxRetries: 3
                }
            );

            // Wait for confirmation
            const latestBlockHash = await this.mainnetConnection.getLatestBlockhash();
            const confirmation = await this.mainnetConnection.confirmTransaction({
                signature: signature,
                blockhash: latestBlockHash.blockhash,
                lastValidBlockHeight: latestBlockHash.lastValidBlockHeight
            }, 'finalized');

            if (confirmation.value.err) {
                throw new Error(`Jupiter swap failed: ${JSON.stringify(confirmation.value.err)}`);
            }

            const result = {
                signature: signature,
                success: true,
                inputMint: inputMint,
                outputMint: outputMint,
                inAmount: quote.inAmount,
                outAmount: quote.outAmount,
                priceImpact: quote.priceImpactPct,
                fee: quote.platformFee,
                timestamp: Date.now()
            };

            this.financialSafety.logAuditEvent('JUPITER_SWAP_SUCCESS', result, 'SUCCESS');
            return result;

        } catch (error) {
            this.financialSafety.logAuditEvent('JUPITER_SWAP_FAILED', {
                wallet: wallet.publicKey.toString(),
                inputMint: inputMint,
                outputMint: outputMint,
                amount: amount,
                error: error.message
            }, 'ERROR');

            throw new Error(`Real Jupiter swap failed: ${error.message}`);
        }
    }

    /**
     * Get real Jupiter quote
     */
    async getJupiterQuote(inputMint, outputMint, amount, slippageBps) {
        try {
            const response = await fetch(
                `https://quote-api.jup.ag/v6/quote?` +
                `inputMint=${inputMint}&` +
                `outputMint=${outputMint}&` +
                `amount=${amount}&` +
                `slippageBps=${slippageBps}&` +
                `onlyDirectRoutes=false&` +
                `asLegacyTransaction=false`
            );

            const quote = await response.json();
            
            if (quote.error) {
                throw new Error(`Jupiter quote error: ${quote.error}`);
            }

            return quote;

        } catch (error) {
            throw new Error(`Failed to get Jupiter quote: ${error.message}`);
        }
    }

    /**
     * Real transaction monitoring and status checking
     */
    async monitorTransaction(signature, maxWaitTime = 60000) {
        const startTime = Date.now();
        
        while (Date.now() - startTime < maxWaitTime) {
            try {
                const status = await this.mainnetConnection.getSignatureStatus(signature);
                
                if (status.value) {
                    if (status.value.err) {
                        return {
                            signature: signature,
                            status: 'failed',
                            error: status.value.err,
                            confirmations: status.value.confirmations
                        };
                    }
                    
                    if (status.value.confirmationStatus === 'finalized') {
                        return {
                            signature: signature,
                            status: 'confirmed',
                            confirmations: status.value.confirmations,
                            slot: status.value.slot
                        };
                    }
                }
                
                // Wait 2 seconds before checking again
                await new Promise(resolve => setTimeout(resolve, 2000));
                
            } catch (error) {
                console.error(`Error monitoring transaction ${signature}:`, error);
            }
        }
        
        return {
            signature: signature,
            status: 'timeout',
            message: 'Transaction monitoring timed out'
        };
    }

    /**
     * Real-time price feed integration
     */
    async getRealTimePrice(tokenMint) {
        try {
            // Integration with real price oracles
            const response = await fetch(`https://api.coingecko.com/api/v3/coins/${tokenMint}/market_chart?vs_currency=usd&days=1`);
            const data = await response.json();
            
            if (data.prices && data.prices.length > 0) {
                return {
                    price: data.prices[data.prices.length - 1][1],
                    timestamp: data.prices[data.prices.length - 1][0],
                    source: 'coingecko'
                };
            }
            
            throw new Error('No price data available');
            
        } catch (error) {
            throw new Error(`Failed to get real-time price: ${error.message}`);
        }
    }

    /**
     * Network health and connection monitoring
     */
    async getNetworkHealth() {
        try {
            const [
                blockHeight,
                epochInfo,
                health,
                version
            ] = await Promise.all([
                this.mainnetConnection.getBlockHeight('finalized'),
                this.mainnetConnection.getEpochInfo('finalized'),
                this.mainnetConnection.getHealth(),
                this.mainnetConnection.getVersion()
            ]);

            return {
                connected: true,
                blockHeight: blockHeight,
                epoch: epochInfo.epoch,
                health: health,
                version: version,
                network: 'mainnet-beta',
                timestamp: Date.now()
            };

        } catch (error) {
            return {
                connected: false,
                error: error.message,
                timestamp: Date.now()
            };
        }
    }

    /**
     * Helper method to test wallet signing capability
     */
    async testWalletSigning(publicKey, signTransaction) {
        try {
            // Create a minimal test transaction (just recent blockhash, no instructions)
            const testTransaction = new Transaction();
            const { blockhash } = await this.mainnetConnection.getLatestBlockhash();
            testTransaction.recentBlockhash = blockhash;
            testTransaction.feePayer = publicKey;

            // Test signing (don't submit)
            await signTransaction(testTransaction);
            return true;

        } catch (error) {
            throw new Error(`Wallet signing test failed: ${error.message}`);
        }
    }
}

module.exports = RealSolanaIntegrationService;