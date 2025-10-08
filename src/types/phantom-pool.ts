export type PhantomPool = {
  "version": "0.1.0",
  "name": "phantom_pool",
  "instructions": [
    {
      "name": "initializePool",
      "accounts": [
        {
          "name": "pool",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "authority",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "tokenPair",
          "type": "string"
        },
        {
          "name": "elgamalPublicKey",
          "type": {
            "array": ["u8", 64]
          }
        },
        {
          "name": "vrfPublicKey",
          "type": {
            "array": ["u8", 32]
          }
        }
      ]
    },
    {
      "name": "submitEncryptedOrder",
      "accounts": [
        {
          "name": "order",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "pool",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "user",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "encryptedAmount",
          "type": {
            "array": ["u8", 64]
          }
        },
        {
          "name": "encryptedPrice",
          "type": {
            "array": ["u8", 64]
          }
        },
        {
          "name": "side",
          "type": {
            "defined": "OrderSide"
          }
        },
        {
          "name": "solvencyProof",
          "type": "bytes"
        },
        {
          "name": "orderHash",
          "type": {
            "array": ["u8", 32]
          }
        }
      ]
    },
    {
      "name": "startMatchingRound",
      "accounts": [
        {
          "name": "matchingRound",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "pool",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "authority",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "roundId",
          "type": "u64"
        },
        {
          "name": "vrfProof",
          "type": "bytes"
        },
        {
          "name": "orderHashes",
          "type": {
            "vec": {
              "array": ["u8", 32]
            }
          }
        }
      ]
    },
    {
      "name": "executeMatches",
      "accounts": [
        {
          "name": "matchingRound",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "pool",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "authority",
          "isMut": false,
          "isSigner": true
        }
      ],
      "args": [
        {
          "name": "matches",
          "type": {
            "vec": {
              "defined": "TradeMatch"
            }
          }
        },
        {
          "name": "clearingPrice",
          "type": "u64"
        },
        {
          "name": "matchingProof",
          "type": "bytes"
        }
      ]
    },
    {
      "name": "cancelOrder",
      "accounts": [
        {
          "name": "order",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "user",
          "isMut": false,
          "isSigner": true
        }
      ],
      "args": [
        {
          "name": "orderHash",
          "type": {
            "array": ["u8", 32]
          }
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "pool",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "publicKey"
          },
          {
            "name": "tokenPair",
            "type": "string"
          },
          {
            "name": "elgamalPublicKey",
            "type": {
              "array": ["u8", 64]
            }
          },
          {
            "name": "vrfPublicKey",
            "type": {
              "array": ["u8", 32]
            }
          },
          {
            "name": "totalOrders",
            "type": "u64"
          },
          {
            "name": "matchingRound",
            "type": "u64"
          },
          {
            "name": "isMatchingActive",
            "type": "bool"
          },
          {
            "name": "createdAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "order",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "publicKey"
          },
          {
            "name": "pool",
            "type": "publicKey"
          },
          {
            "name": "orderHash",
            "type": {
              "array": ["u8", 32]
            }
          },
          {
            "name": "side",
            "type": {
              "defined": "OrderSide"
            }
          },
          {
            "name": "encryptedAmount",
            "type": {
              "array": ["u8", 64]
            }
          },
          {
            "name": "encryptedPrice",
            "type": {
              "array": ["u8", 64]
            }
          },
          {
            "name": "solvencyProof",
            "type": "bytes"
          },
          {
            "name": "status",
            "type": {
              "defined": "OrderStatus"
            }
          },
          {
            "name": "submittedAt",
            "type": "i64"
          },
          {
            "name": "matchedAt",
            "type": {
              "option": "i64"
            }
          },
          {
            "name": "cancelledAt",
            "type": {
              "option": "i64"
            }
          },
          {
            "name": "nonce",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "matchingRound",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "pool",
            "type": "publicKey"
          },
          {
            "name": "roundId",
            "type": "u64"
          },
          {
            "name": "vrfProof",
            "type": "bytes"
          },
          {
            "name": "orderHashes",
            "type": {
              "vec": {
                "array": ["u8", 32]
              }
            }
          },
          {
            "name": "matches",
            "type": {
              "vec": {
                "defined": "TradeMatch"
              }
            }
          },
          {
            "name": "clearingPrice",
            "type": "u64"
          },
          {
            "name": "matchingProof",
            "type": "bytes"
          },
          {
            "name": "startedAt",
            "type": "i64"
          },
          {
            "name": "completedAt",
            "type": {
              "option": "i64"
            }
          },
          {
            "name": "status",
            "type": {
              "defined": "MatchingStatus"
            }
          }
        ]
      }
    }
  ],
  "types": [
    {
      "name": "TradeMatch",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "buyOrderHash",
            "type": {
              "array": ["u8", 32]
            }
          },
          {
            "name": "sellOrderHash",
            "type": {
              "array": ["u8", 32]
            }
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "OrderSide",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "Buy"
          },
          {
            "name": "Sell"
          }
        ]
      }
    },
    {
      "name": "OrderStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "Pending"
          },
          {
            "name": "Matched"
          },
          {
            "name": "Executed"
          },
          {
            "name": "Cancelled"
          }
        ]
      }
    },
    {
      "name": "MatchingStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "InProgress"
          },
          {
            "name": "DecryptionComplete"
          },
          {
            "name": "Completed"
          },
          {
            "name": "Failed"
          }
        ]
      }
    }
  ],
  "events": [
    {
      "name": "OrderSubmitted",
      "fields": [
        {
          "name": "orderHash",
          "type": {
            "array": ["u8", 32]
          },
          "index": false
        },
        {
          "name": "owner",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "pool",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "side",
          "type": {
            "defined": "OrderSide"
          },
          "index": false
        },
        {
          "name": "nonce",
          "type": "u64",
          "index": false
        }
      ]
    },
    {
      "name": "TradeExecuted",
      "fields": [
        {
          "name": "buyOrderHash",
          "type": {
            "array": ["u8", 32]
          },
          "index": false
        },
        {
          "name": "sellOrderHash",
          "type": {
            "array": ["u8", 32]
          },
          "index": false
        },
        {
          "name": "amount",
          "type": "u64",
          "index": false
        },
        {
          "name": "price",
          "type": "u64",
          "index": false
        },
        {
          "name": "roundId",
          "type": "u64",
          "index": false
        }
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "MatchingInProgress",
      "msg": "Matching round is currently in progress"
    },
    {
      "code": 6001,
      "name": "InactiveExecutor",
      "msg": "Executor is not active"
    },
    {
      "code": 6002,
      "name": "InvalidRoundStatus",
      "msg": "Invalid matching round status"
    },
    {
      "code": 6003,
      "name": "OrderNotCancellable",
      "msg": "Order cannot be cancelled in current state"
    },
    {
      "code": 6004,
      "name": "Unauthorized",
      "msg": "Unauthorized access"
    }
  ]
}