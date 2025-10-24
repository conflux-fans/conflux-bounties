export const PYTH_CONTRACT_ADDRESS = '0xe9d69CdD6Fe41e7B621B4A688C5D1a68cB5c8ADc';

export const PYTH_ABI = [
  {
    "inputs": [{"internalType": "bytes[]", "name": "updateData", "type": "bytes[]"}],
    "name": "updatePriceFeeds",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "bytes32", "name": "id", "type": "bytes32"}],
    "name": "getPrice",
    "outputs": [
      {
        "components": [
          {"internalType": "int64", "name": "price", "type": "int64"},
          {"internalType": "uint64", "name": "conf", "type": "uint64"},
          {"internalType": "int32", "name": "expo", "type": "int32"},
          {"internalType": "uint256", "name": "publishTime", "type": "uint256"}
        ],
        "internalType": "struct PythStructs.Price",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "bytes32", "name": "id", "type": "bytes32"}],
    "name": "getPriceUnsafe",
    "outputs": [
      {
        "components": [
          {"internalType": "int64", "name": "price", "type": "int64"},
          {"internalType": "uint64", "name": "conf", "type": "uint64"},
          {"internalType": "int32", "name": "expo", "type": "int32"},
          {"internalType": "uint256", "name": "publishTime", "type": "uint256"}
        ],
        "internalType": "struct PythStructs.Price",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

export const PRICE_CONSUMER_ADDRESS = '0x540182717b8A2D723f9Fc0218558a7De224e8b17';

export const PRICE_CONSUMER_ABI = [
  {
    "inputs": [{"internalType": "address", "name": "_pyth", "type": "address"}],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [{"internalType": "bytes32", "name": "priceId", "type": "bytes32"}],
    "name": "getLatestPrice",
    "outputs": [{"internalType": "int64", "name": "", "type": "int64"}],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

export const BETTING_CONTRACT_ADDRESS = '0x6a5D4C136B20C3946f38B2b76eddd56452eA4156';

export const BETTING_ABI = [
  {
    "inputs": [{"internalType": "address", "name": "_pythContract", "type": "address"}],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [],
    "name": "pyth",
    "outputs": [{"internalType": "address", "name": "", "type": "address"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "owner",
    "outputs": [{"internalType": "address", "name": "", "type": "address"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "nextBetId",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "name": "bets",
    "outputs": [
      {"internalType": "address", "name": "bettor", "type": "address"},
      {"internalType": "bytes32", "name": "priceId", "type": "bytes32"},
      {"internalType": "uint256", "name": "amount", "type": "uint256"},
      {"internalType": "int64", "name": "targetPrice", "type": "int64"},
      {"internalType": "uint256", "name": "deadline", "type": "uint256"},
      {"internalType": "bool", "name": "predictAbove", "type": "bool"},
      {"internalType": "bool", "name": "settled", "type": "bool"},
      {"internalType": "bool", "name": "won", "type": "bool"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "bytes32", "name": "priceId", "type": "bytes32"},
      {"internalType": "int64", "name": "targetPrice", "type": "int64"},
      {"internalType": "bool", "name": "predictAbove", "type": "bool"},
      {"internalType": "uint256", "name": "duration", "type": "uint256"}
    ],
    "name": "placeBet",
    "outputs": [{"internalType": "uint256", "name": "betId", "type": "uint256"}],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "uint256", "name": "betId", "type": "uint256"}
    ],
    "name": "settleBet",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "address", "name": "user", "type": "address"}],
    "name": "getUserBets",
    "outputs": [{"internalType": "uint256[]", "name": "", "type": "uint256[]"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256", "name": "betId", "type": "uint256"}],
    "name": "getBet",
    "outputs": [
      {
        "components": [
          {"internalType": "address", "name": "bettor", "type": "address"},
          {"internalType": "bytes32", "name": "priceId", "type": "bytes32"},
          {"internalType": "uint256", "name": "amount", "type": "uint256"},
          {"internalType": "int64", "name": "targetPrice", "type": "int64"},
          {"internalType": "uint256", "name": "deadline", "type": "uint256"},
          {"internalType": "bool", "name": "predictAbove", "type": "bool"},
          {"internalType": "bool", "name": "settled", "type": "bool"},
          {"internalType": "bool", "name": "won", "type": "bool"}
        ],
        "internalType": "struct PriceFeedBetting.Bet",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "withdrawFees",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "uint256", "name": "betId", "type": "uint256"},
      {"indexed": true, "internalType": "address", "name": "user", "type": "address"},
      {"indexed": false, "internalType": "bytes32", "name": "priceId", "type": "bytes32"},
      {"indexed": false, "internalType": "int64", "name": "targetPrice", "type": "int64"},
      {"indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256"}
    ],
    "name": "BetPlaced",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "uint256", "name": "betId", "type": "uint256"},
      {"indexed": false, "internalType": "bool", "name": "won", "type": "bool"},
      {"indexed": false, "internalType": "int64", "name": "finalPrice", "type": "int64"}
    ],
    "name": "BetSettled",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256"}
    ],
    "name": "FeesWithdrawn",
    "type": "event"
  }
] as const;

export const LENDING_CONTRACT_ADDRESS = '0x0FC5A8c24b13E4178911a739866A0E7c27d90345';

export const LENDING_ABI = [
  {
    "inputs": [{"internalType": "address", "name": "_pythContract", "type": "address"}],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [],
    "name": "pyth",
    "outputs": [{"internalType": "contract IPyth", "name": "", "type": "address"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "nextPositionId",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "LIQUIDATION_THRESHOLD",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "LIQUIDATION_BONUS",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "name": "positions",
    "outputs": [
      {"internalType": "address", "name": "borrower", "type": "address"},
      {"internalType": "bytes32", "name": "collateralAsset", "type": "bytes32"},
      {"internalType": "bytes32", "name": "borrowAsset", "type": "bytes32"},
      {"internalType": "uint256", "name": "collateralAmount", "type": "uint256"},
      {"internalType": "uint256", "name": "borrowAmount", "type": "uint256"},
      {"internalType": "uint256", "name": "openTime", "type": "uint256"},
      {"internalType": "bool", "name": "active", "type": "bool"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "bytes32", "name": "collateralAsset", "type": "bytes32"},
      {"internalType": "bytes32", "name": "borrowAsset", "type": "bytes32"},
      {"internalType": "uint256", "name": "borrowAmount", "type": "uint256"}
    ],
    "name": "openPosition",
    "outputs": [{"internalType": "uint256", "name": "positionId", "type": "uint256"}],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256", "name": "positionId", "type": "uint256"}],
    "name": "getHealthRatio",
    "outputs": [{"internalType": "uint256", "name": "healthRatio", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256", "name": "positionId", "type": "uint256"}],
    "name": "liquidate",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256", "name": "positionId", "type": "uint256"}],
    "name": "repayPosition",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "address", "name": "user", "type": "address"}],
    "name": "getUserPositions",
    "outputs": [{"internalType": "uint256[]", "name": "", "type": "uint256[]"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256", "name": "positionId", "type": "uint256"}],
    "name": "getPositionDetails",
    "outputs": [
      {
        "components": [
          {"internalType": "address", "name": "borrower", "type": "address"},
          {"internalType": "bytes32", "name": "collateralAsset", "type": "bytes32"},
          {"internalType": "bytes32", "name": "borrowAsset", "type": "bytes32"},
          {"internalType": "uint256", "name": "collateralAmount", "type": "uint256"},
          {"internalType": "uint256", "name": "borrowAmount", "type": "uint256"},
          {"internalType": "uint256", "name": "openTime", "type": "uint256"},
          {"internalType": "bool", "name": "active", "type": "bool"}
        ],
        "internalType": "struct MockLendingProtocol.Position",
        "name": "position",
        "type": "tuple"
      },
      {"internalType": "uint256", "name": "collateralValue", "type": "uint256"},
      {"internalType": "uint256", "name": "borrowValue", "type": "uint256"},
      {"internalType": "uint256", "name": "healthRatio", "type": "uint256"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getAllActivePositions",
    "outputs": [{"internalType": "uint256[]", "name": "", "type": "uint256[]"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "uint256", "name": "positionId", "type": "uint256"},
      {"indexed": true, "internalType": "address", "name": "borrower", "type": "address"},
      {"indexed": false, "internalType": "uint256", "name": "collateralAmount", "type": "uint256"},
      {"indexed": false, "internalType": "uint256", "name": "borrowAmount", "type": "uint256"}
    ],
    "name": "PositionOpened",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "uint256", "name": "positionId", "type": "uint256"},
      {"indexed": true, "internalType": "address", "name": "borrower", "type": "address"}
    ],
    "name": "PositionRepaid",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "uint256", "name": "positionId", "type": "uint256"},
      {"indexed": true, "internalType": "address", "name": "liquidator", "type": "address"},
      {"indexed": true, "internalType": "address", "name": "borrower", "type": "address"}
    ],
    "name": "PositionLiquidated",
    "type": "event"
  },
  {
    "stateMutability": "payable",
    "type": "receive"
  }
] as const;

export const FEE_MANAGER_ADDRESS = '0x1A45Bd20Db43f9E47e07D8529e0831F3883223e3';

export const FEE_MANAGER_ABI = [
  {
    "inputs": [{"internalType": "uint256", "name": "_platformFee", "type": "uint256"}],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [],
    "name": "platformFee",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256", "name": "amount", "type": "uint256"}],
    "name": "calculateFee",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256", "name": "newFee", "type": "uint256"}],
    "name": "updateFee",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "withdrawFees",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;

export const FALLBACK_ORACLE_ADDRESS = '0x6B1D3d3c054bd0F12d75752e83EfD1210BDac24E';

export const FALLBACK_ORACLE_ABI = [
  {
    "inputs": [
      {"internalType": "address", "name": "_primaryOracle", "type": "address"},
      {"internalType": "address", "name": "_backupOracle", "type": "address"}
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [{"internalType": "bytes32", "name": "priceId", "type": "bytes32"}],
    "name": "getPrice",
    "outputs": [
      {"internalType": "int64", "name": "price", "type": "int64"},
      {"internalType": "uint256", "name": "timestamp", "type": "uint256"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "isPrimaryActive",
    "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "switchToBackup",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;