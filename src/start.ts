#!/usr/bin/env node

import { startServer } from './api-server'

console.log('🌟 Starting PhantomPool On-Chain System...')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('')
console.log('🔗 Blockchain Configuration:')
console.log(`   Network: ${process.env.SOLANA_NETWORK || 'devnet'}`)
console.log(`   RPC: ${process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com'}`)
console.log(`   Program ID: ${process.env.PHANTOM_POOL_PROGRAM_ID}`)
console.log('')
console.log('🔐 Cryptographic Features:')
console.log('   ✓ ElGamal Homomorphic Encryption')
console.log('   ✓ Bulletproofs+ Zero-Knowledge Proofs')
console.log('   ✓ VRF Verifiable Random Functions')
console.log('   ✓ 3-of-5 Threshold Decryption Network')
console.log('')
console.log('📊 Trading Features:')
console.log('   ✓ Encrypted Order Book')
console.log('   ✓ Fair Order Matching')
console.log('   ✓ MEV Protection')
console.log('   ✓ Privacy-Preserving Analytics')
console.log('   ✓ Jupiter Integration')
console.log('')

startServer()
  .then(() => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('🎉 PhantomPool is ready for trading!')
    console.log('   Frontend: http://localhost:3000')
    console.log('   API: http://localhost:3001')
    console.log('   WebSocket: ws://localhost:3001/ws')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  })
  .catch(error => {
    console.error('❌ Failed to start PhantomPool:', error)
    process.exit(1)
  })