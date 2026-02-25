//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// AutomationManager
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * - [__View Contract on Conflux E Space Testnet Conflux Scan__](https://evmtestnet.confluxscan.org/address/0x33e5e5b262e5d8ebc443e1c6c9f14215b020554d)
 * - [__View Contract on Conflux E Space Conflux Scan__](https://evm.confluxscan.org/address/0x9D5B131e5bA37A238cd1C485E2D9d7c2A68E1d0F)
 */
export const automationManagerAbi = [
  {
    type: 'constructor',
    inputs: [
      { name: '_priceAdapter', internalType: 'address', type: 'address' },
      { name: 'initialOwner', internalType: 'address', type: 'address' },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'error',
    inputs: [{ name: 'jobId', internalType: 'bytes32', type: 'bytes32' }],
    name: 'DCACompleted',
  },
  {
    type: 'error',
    inputs: [
      { name: 'nextExecution', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'DCAIntervalNotReached',
  },
  { type: 'error', inputs: [], name: 'EnforcedPause' },
  { type: 'error', inputs: [], name: 'ExpectedPause' },
  {
    type: 'error',
    inputs: [{ name: 'reason', internalType: 'string', type: 'string' }],
    name: 'InvalidParams',
  },
  {
    type: 'error',
    inputs: [{ name: 'jobId', internalType: 'bytes32', type: 'bytes32' }],
    name: 'JobExpiredError',
  },
  {
    type: 'error',
    inputs: [{ name: 'jobId', internalType: 'bytes32', type: 'bytes32' }],
    name: 'JobNotActive',
  },
  {
    type: 'error',
    inputs: [{ name: 'jobId', internalType: 'bytes32', type: 'bytes32' }],
    name: 'JobNotFound',
  },
  {
    type: 'error',
    inputs: [{ name: 'owner', internalType: 'address', type: 'address' }],
    name: 'OwnableInvalidOwner',
  },
  {
    type: 'error',
    inputs: [{ name: 'account', internalType: 'address', type: 'address' }],
    name: 'OwnableUnauthorizedAccount',
  },
  {
    type: 'error',
    inputs: [{ name: 'jobId', internalType: 'bytes32', type: 'bytes32' }],
    name: 'PriceConditionNotMet',
  },
  { type: 'error', inputs: [], name: 'ReentrancyGuardReentrantCall' },
  {
    type: 'error',
    inputs: [{ name: 'token', internalType: 'address', type: 'address' }],
    name: 'SafeERC20FailedOperation',
  },
  {
    type: 'error',
    inputs: [
      { name: 'requested', internalType: 'uint256', type: 'uint256' },
      { name: 'maxAllowed', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'SlippageTooHigh',
  },
  {
    type: 'error',
    inputs: [{ name: 'user', internalType: 'address', type: 'address' }],
    name: 'TooManyJobs',
  },
  { type: 'error', inputs: [], name: 'Unauthorized' },
  { type: 'error', inputs: [], name: 'ZeroAddress' },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'jobId',
        internalType: 'bytes32',
        type: 'bytes32',
        indexed: true,
      },
      {
        name: 'canceller',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'JobCancelled',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'jobId',
        internalType: 'bytes32',
        type: 'bytes32',
        indexed: true,
      },
      {
        name: 'owner',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'jobType',
        internalType: 'enum AutomationManager.JobType',
        type: 'uint8',
        indexed: false,
      },
    ],
    name: 'JobCreated',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'jobId',
        internalType: 'bytes32',
        type: 'bytes32',
        indexed: true,
      },
      {
        name: 'keeper',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'amountOut',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'JobExecuted',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'jobId',
        internalType: 'bytes32',
        type: 'bytes32',
        indexed: true,
      },
    ],
    name: 'JobExpired',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'keeper',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      { name: 'allowed', internalType: 'bool', type: 'bool', indexed: false },
    ],
    name: 'KeeperUpdated',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'newMax',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'MaxJobsPerUserUpdated',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'previousOwner',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'newOwner',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'OwnershipTransferred',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'account',
        internalType: 'address',
        type: 'address',
        indexed: false,
      },
    ],
    name: 'Paused',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'newAdapter',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'PriceAdapterUpdated',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'account',
        internalType: 'address',
        type: 'address',
        indexed: false,
      },
    ],
    name: 'Unpaused',
  },
  {
    type: 'function',
    inputs: [{ name: '', internalType: 'address', type: 'address' }],
    name: 'activeJobCount',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'jobId', internalType: 'bytes32', type: 'bytes32' }],
    name: 'cancelJob',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'params',
        internalType: 'struct AutomationManager.DCAParams',
        type: 'tuple',
        components: [
          { name: 'tokenIn', internalType: 'address', type: 'address' },
          { name: 'tokenOut', internalType: 'address', type: 'address' },
          { name: 'amountPerSwap', internalType: 'uint256', type: 'uint256' },
          { name: 'intervalSeconds', internalType: 'uint256', type: 'uint256' },
          { name: 'totalSwaps', internalType: 'uint256', type: 'uint256' },
          { name: 'swapsCompleted', internalType: 'uint256', type: 'uint256' },
          { name: 'nextExecution', internalType: 'uint256', type: 'uint256' },
        ],
      },
      { name: 'slippageBps', internalType: 'uint256', type: 'uint256' },
      { name: 'expiresAt', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'createDCAJob',
    outputs: [{ name: 'jobId', internalType: 'bytes32', type: 'bytes32' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'params',
        internalType: 'struct AutomationManager.LimitOrderParams',
        type: 'tuple',
        components: [
          { name: 'tokenIn', internalType: 'address', type: 'address' },
          { name: 'tokenOut', internalType: 'address', type: 'address' },
          { name: 'amountIn', internalType: 'uint256', type: 'uint256' },
          { name: 'minAmountOut', internalType: 'uint256', type: 'uint256' },
          { name: 'targetPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'triggerAbove', internalType: 'bool', type: 'bool' },
        ],
      },
      { name: 'slippageBps', internalType: 'uint256', type: 'uint256' },
      { name: 'expiresAt', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'createLimitOrder',
    outputs: [{ name: 'jobId', internalType: 'bytes32', type: 'bytes32' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: '', internalType: 'bytes32', type: 'bytes32' }],
    name: 'dcaJobs',
    outputs: [
      { name: 'tokenIn', internalType: 'address', type: 'address' },
      { name: 'tokenOut', internalType: 'address', type: 'address' },
      { name: 'amountPerSwap', internalType: 'uint256', type: 'uint256' },
      { name: 'intervalSeconds', internalType: 'uint256', type: 'uint256' },
      { name: 'totalSwaps', internalType: 'uint256', type: 'uint256' },
      { name: 'swapsCompleted', internalType: 'uint256', type: 'uint256' },
      { name: 'nextExecution', internalType: 'uint256', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'jobId', internalType: 'bytes32', type: 'bytes32' },
      { name: 'router', internalType: 'address', type: 'address' },
      { name: 'swapCalldata', internalType: 'bytes', type: 'bytes' },
    ],
    name: 'executeDCATick',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'jobId', internalType: 'bytes32', type: 'bytes32' },
      { name: 'router', internalType: 'address', type: 'address' },
      { name: 'swapCalldata', internalType: 'bytes', type: 'bytes' },
    ],
    name: 'executeLimitOrder',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'jobId', internalType: 'bytes32', type: 'bytes32' }],
    name: 'expireJob',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'jobId', internalType: 'bytes32', type: 'bytes32' }],
    name: 'getDCAJob',
    outputs: [
      {
        name: '',
        internalType: 'struct AutomationManager.DCAParams',
        type: 'tuple',
        components: [
          { name: 'tokenIn', internalType: 'address', type: 'address' },
          { name: 'tokenOut', internalType: 'address', type: 'address' },
          { name: 'amountPerSwap', internalType: 'uint256', type: 'uint256' },
          { name: 'intervalSeconds', internalType: 'uint256', type: 'uint256' },
          { name: 'totalSwaps', internalType: 'uint256', type: 'uint256' },
          { name: 'swapsCompleted', internalType: 'uint256', type: 'uint256' },
          { name: 'nextExecution', internalType: 'uint256', type: 'uint256' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'jobId', internalType: 'bytes32', type: 'bytes32' }],
    name: 'getJob',
    outputs: [
      {
        name: '',
        internalType: 'struct AutomationManager.Job',
        type: 'tuple',
        components: [
          { name: 'id', internalType: 'bytes32', type: 'bytes32' },
          { name: 'owner', internalType: 'address', type: 'address' },
          {
            name: 'jobType',
            internalType: 'enum AutomationManager.JobType',
            type: 'uint8',
          },
          {
            name: 'status',
            internalType: 'enum AutomationManager.JobStatus',
            type: 'uint8',
          },
          { name: 'createdAt', internalType: 'uint256', type: 'uint256' },
          { name: 'expiresAt', internalType: 'uint256', type: 'uint256' },
          { name: 'maxSlippageBps', internalType: 'uint256', type: 'uint256' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'jobId', internalType: 'bytes32', type: 'bytes32' }],
    name: 'getLimitOrder',
    outputs: [
      {
        name: '',
        internalType: 'struct AutomationManager.LimitOrderParams',
        type: 'tuple',
        components: [
          { name: 'tokenIn', internalType: 'address', type: 'address' },
          { name: 'tokenOut', internalType: 'address', type: 'address' },
          { name: 'amountIn', internalType: 'uint256', type: 'uint256' },
          { name: 'minAmountOut', internalType: 'uint256', type: 'uint256' },
          { name: 'targetPrice', internalType: 'uint256', type: 'uint256' },
          { name: 'triggerAbove', internalType: 'bool', type: 'bool' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'user', internalType: 'address', type: 'address' }],
    name: 'getUserJobs',
    outputs: [{ name: '', internalType: 'bytes32[]', type: 'bytes32[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: '', internalType: 'bytes32', type: 'bytes32' }],
    name: 'jobs',
    outputs: [
      { name: 'id', internalType: 'bytes32', type: 'bytes32' },
      { name: 'owner', internalType: 'address', type: 'address' },
      {
        name: 'jobType',
        internalType: 'enum AutomationManager.JobType',
        type: 'uint8',
      },
      {
        name: 'status',
        internalType: 'enum AutomationManager.JobStatus',
        type: 'uint8',
      },
      { name: 'createdAt', internalType: 'uint256', type: 'uint256' },
      { name: 'expiresAt', internalType: 'uint256', type: 'uint256' },
      { name: 'maxSlippageBps', internalType: 'uint256', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'keeperFeeFlat',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: '', internalType: 'address', type: 'address' }],
    name: 'keepers',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: '', internalType: 'bytes32', type: 'bytes32' }],
    name: 'limitOrders',
    outputs: [
      { name: 'tokenIn', internalType: 'address', type: 'address' },
      { name: 'tokenOut', internalType: 'address', type: 'address' },
      { name: 'amountIn', internalType: 'uint256', type: 'uint256' },
      { name: 'minAmountOut', internalType: 'uint256', type: 'uint256' },
      { name: 'targetPrice', internalType: 'uint256', type: 'uint256' },
      { name: 'triggerAbove', internalType: 'bool', type: 'bool' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'maxJobsPerUser',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'maxSlippageBps',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'owner',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'pause',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'paused',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'priceAdapter',
    outputs: [
      { name: '', internalType: 'contract IPriceAdapter', type: 'address' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'renounceOwnership',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'keeper', internalType: 'address', type: 'address' },
      { name: 'allowed', internalType: 'bool', type: 'bool' },
    ],
    name: 'setKeeper',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: '_max', internalType: 'uint256', type: 'uint256' }],
    name: 'setMaxJobsPerUser',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: '_maxBps', internalType: 'uint256', type: 'uint256' }],
    name: 'setMaxSlippageBps',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: '_priceAdapter', internalType: 'address', type: 'address' },
    ],
    name: 'setPriceAdapter',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'newOwner', internalType: 'address', type: 'address' }],
    name: 'transferOwnership',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'unpause',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: '', internalType: 'address', type: 'address' },
      { name: '', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'userJobs',
    outputs: [{ name: '', internalType: 'bytes32', type: 'bytes32' }],
    stateMutability: 'view',
  },
] as const

/**
 * - [__View Contract on Conflux E Space Testnet Conflux Scan__](https://evmtestnet.confluxscan.org/address/0x33e5e5b262e5d8ebc443e1c6c9f14215b020554d)
 * - [__View Contract on Conflux E Space Conflux Scan__](https://evm.confluxscan.org/address/0x9D5B131e5bA37A238cd1C485E2D9d7c2A68E1d0F)
 */
export const automationManagerAddress = {
  71: '0x33e5E5B262e5d8eBC443E1c6c9F14215b020554d',
  1030: '0x9D5B131e5bA37A238cd1C485E2D9d7c2A68E1d0F',
} as const

/**
 * - [__View Contract on Conflux E Space Testnet Conflux Scan__](https://evmtestnet.confluxscan.org/address/0x33e5e5b262e5d8ebc443e1c6c9f14215b020554d)
 * - [__View Contract on Conflux E Space Conflux Scan__](https://evm.confluxscan.org/address/0x9D5B131e5bA37A238cd1C485E2D9d7c2A68E1d0F)
 */
export const automationManagerConfig = {
  address: automationManagerAddress,
  abi: automationManagerAbi,
} as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// PermitHandler
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * - [__View Contract on Conflux E Space Testnet Conflux Scan__](https://evmtestnet.confluxscan.org/address/0x4240882f2d9d70cdb9fbcc859cdd4d3e59f5d137)
 * - [__View Contract on Conflux E Space Conflux Scan__](https://evm.confluxscan.org/address/0x0D566aC9Dd1e20Fc63990bEEf6e8abBA876c896B)
 */
export const permitHandlerAbi = [
  {
    type: 'error',
    inputs: [
      { name: 'token', internalType: 'address', type: 'address' },
      { name: 'reason', internalType: 'string', type: 'string' },
    ],
    name: 'PermitFailed',
  },
  { type: 'error', inputs: [], name: 'ReentrancyGuardReentrantCall' },
  { type: 'error', inputs: [], name: 'ZeroAddress' },
  { type: 'error', inputs: [], name: 'ZeroAmount' },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'token',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'owner',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'spender',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'value',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
      {
        name: 'deadline',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'PermitApplied',
  },
  {
    type: 'function',
    inputs: [
      { name: 'token', internalType: 'address', type: 'address' },
      { name: 'owner', internalType: 'address', type: 'address' },
      { name: 'spender', internalType: 'address', type: 'address' },
      { name: 'value', internalType: 'uint256', type: 'uint256' },
      { name: 'deadline', internalType: 'uint256', type: 'uint256' },
      { name: 'v', internalType: 'uint8', type: 'uint8' },
      { name: 'r', internalType: 'bytes32', type: 'bytes32' },
      { name: 's', internalType: 'bytes32', type: 'bytes32' },
    ],
    name: 'permitAndApprove',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'token', internalType: 'address', type: 'address' },
      { name: 'owner', internalType: 'address', type: 'address' },
      { name: 'spender', internalType: 'address', type: 'address' },
      { name: 'value', internalType: 'uint256', type: 'uint256' },
      { name: 'deadline', internalType: 'uint256', type: 'uint256' },
      { name: 'v', internalType: 'uint8', type: 'uint8' },
      { name: 'r', internalType: 'bytes32', type: 'bytes32' },
      { name: 's', internalType: 'bytes32', type: 'bytes32' },
      { name: 'createJobCalldata', internalType: 'bytes', type: 'bytes' },
    ],
    name: 'permitApproveAndCall',
    outputs: [{ name: 'result', internalType: 'bytes', type: 'bytes' }],
    stateMutability: 'nonpayable',
  },
] as const

/**
 * - [__View Contract on Conflux E Space Testnet Conflux Scan__](https://evmtestnet.confluxscan.org/address/0x4240882f2d9d70cdb9fbcc859cdd4d3e59f5d137)
 * - [__View Contract on Conflux E Space Conflux Scan__](https://evm.confluxscan.org/address/0x0D566aC9Dd1e20Fc63990bEEf6e8abBA876c896B)
 */
export const permitHandlerAddress = {
  71: '0x4240882f2D9D70Cdb9fBCC859cdD4d3e59f5d137',
  1030: '0x0D566aC9Dd1e20Fc63990bEEf6e8abBA876c896B',
} as const

/**
 * - [__View Contract on Conflux E Space Testnet Conflux Scan__](https://evmtestnet.confluxscan.org/address/0x4240882f2d9d70cdb9fbcc859cdd4d3e59f5d137)
 * - [__View Contract on Conflux E Space Conflux Scan__](https://evm.confluxscan.org/address/0x0D566aC9Dd1e20Fc63990bEEf6e8abBA876c896B)
 */
export const permitHandlerConfig = {
  address: permitHandlerAddress,
  abi: permitHandlerAbi,
} as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// SwappiPriceAdapter
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * - [__View Contract on Conflux E Space Testnet Conflux Scan__](https://evmtestnet.confluxscan.org/address/0x88c48e0e8f76493bb926131a2be779cc17ecbedf)
 * - [__View Contract on Conflux E Space Conflux Scan__](https://evm.confluxscan.org/address/0xD2Cc2a7Eb4A5792cE6383CcD0f789C1A9c48ECf9)
 */
export const swappiPriceAdapterAbi = [
  {
    type: 'constructor',
    inputs: [
      { name: '_router', internalType: 'address', type: 'address' },
      { name: '_factory', internalType: 'address', type: 'address' },
      { name: 'initialOwner', internalType: 'address', type: 'address' },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'error',
    inputs: [{ name: 'owner', internalType: 'address', type: 'address' }],
    name: 'OwnableInvalidOwner',
  },
  {
    type: 'error',
    inputs: [{ name: 'account', internalType: 'address', type: 'address' }],
    name: 'OwnableUnauthorizedAccount',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'newFactory',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'FactoryUpdated',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'previousOwner',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'newOwner',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'OwnershipTransferred',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'newAmount',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'QuoteAmountUpdated',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'newRouter',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'RouterUpdated',
  },
  {
    type: 'function',
    inputs: [],
    name: 'factory',
    outputs: [
      { name: '', internalType: 'contract ISwappiFactory', type: 'address' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'tokenIn', internalType: 'address', type: 'address' },
      { name: 'tokenOut', internalType: 'address', type: 'address' },
    ],
    name: 'getPrice',
    outputs: [{ name: 'price', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'owner',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'quoteAmount',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'renounceOwnership',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'router',
    outputs: [
      { name: '', internalType: 'contract ISwappiRouter', type: 'address' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: '_factory', internalType: 'address', type: 'address' }],
    name: 'setFactory',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: '_quoteAmount', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'setQuoteAmount',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: '_router', internalType: 'address', type: 'address' }],
    name: 'setRouter',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'newOwner', internalType: 'address', type: 'address' }],
    name: 'transferOwnership',
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const

/**
 * - [__View Contract on Conflux E Space Testnet Conflux Scan__](https://evmtestnet.confluxscan.org/address/0x88c48e0e8f76493bb926131a2be779cc17ecbedf)
 * - [__View Contract on Conflux E Space Conflux Scan__](https://evm.confluxscan.org/address/0xD2Cc2a7Eb4A5792cE6383CcD0f789C1A9c48ECf9)
 */
export const swappiPriceAdapterAddress = {
  71: '0x88C48e0E8F76493Bb926131a2BE779cc17ecBEdF',
  1030: '0xD2Cc2a7Eb4A5792cE6383CcD0f789C1A9c48ECf9',
} as const

/**
 * - [__View Contract on Conflux E Space Testnet Conflux Scan__](https://evmtestnet.confluxscan.org/address/0x88c48e0e8f76493bb926131a2be779cc17ecbedf)
 * - [__View Contract on Conflux E Space Conflux Scan__](https://evm.confluxscan.org/address/0xD2Cc2a7Eb4A5792cE6383CcD0f789C1A9c48ECf9)
 */
export const swappiPriceAdapterConfig = {
  address: swappiPriceAdapterAddress,
  abi: swappiPriceAdapterAbi,
} as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// hardhat-bytecode
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// ─── Deployment bytecode ─────────────────────────────────────────────────────
// Used by conflux-cas/scripts/deploy.ts via viem deployContract.
// Regenerate with: pnpm contracts:codegen
export const automationManagerBytecode =
  '0x608034620001255762002420601f38829003908101601f19168301906001600160401b038211848310176200012a57808491604094859485528339810103126200012557816200005160209362000140565b6001600160a01b0393909184916200006a910162000140565b1680156200010d57600080546001600160a01b0319808216841783558551969294909291849083167f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e08780a36001805560146009556101f4600a5584600b5516908115620000fe5784955060025416176002558152600860205220600160ff19825416179055516122ca9081620001568239f35b63d92e233d60e01b8652600486fd5b8251631e4fbdf760e01b815260006004820152602490fd5b600080fd5b634e487b7160e01b600052604160045260246000fd5b51906001600160a01b0382168203620001255756fe6080604052600436101561001257600080fd5b60e0600035811c806317f5f04914611845578063225f079d146114b157806325fc1b3d1461144e5780632b7aabee146114305780633651588e1461131057806338ed5b34146112f257806338ed7cfc1461126c5780633bbd64bc1461122d5780633f0b1d741461116c5780633f4ba83a146110fa5780633fa7276c1461104657806340fba24314610fdd57806359c9bbeb14610f915780635c975abb14610f6b5780635fae145014610e665780636683e21514610a89578063715018a614610a305780638456cb59146109ce5780638da5cb5b146109a55780638faa8b6c1461096b5780639309838214610942578063c17ff9d2146108ea578063c4aa7395146108cc578063ca697db414610859578063d033f1501461077e578063d1b9e853146106dd578063dc4c46ab1461036c578063dd7f9305146102f5578063f2fde38b1461026c5763f729cf0d1461016757600080fd5b3461026757602036600319011261026757610180611e27565b50600435600052600360205260406000206040519061019e82611d05565b8054825260018101546001600160a01b03808216602085019081529291604085019060a081901c60ff169060028210156102515760ff91835260a81c16606086019060048110156102515761023d9261023291835260028601549460808901958652600460038801549760a08b0198895201549760c08a0198895260405199518a5251166020890152516040880190611c19565b516060860190611c26565b5160808401525160a08301525160c0820152f35b634e487b7160e01b600052602160045260246000fd5b600080fd5b3461026757602036600319011261026757610285611c33565b61028d611f46565b6001600160a01b039081169081156102dc57600054826001600160601b0360a01b821617600055167f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0600080a3005b604051631e4fbdf760e01b815260006004820152602490fd5b5034610267576020366003190112610267576004356000526005602052604060002060018060a01b0390818154169160018201541690600281015460038201546004830154916006600585015494015494604051968752602087015260408601526060850152608084015260a083015260c0820152f35b346102675761037a36611c49565b929190610385611f72565b61038d611ef9565b336000526020906008825260ff60406000205416156106cc5760008481526003835260409020600101546001600160a01b0391908216156106b3578460005260038352604060002090600484526040600020966103e983611f95565b6103f283611fc9565b600254885460018a018054604051635620c32d60e11b81526001600160a01b0393891684811660048301529189169093166024840152959094929091908890829060449082908b165afa90811561060b57600091610686575b5060058b015460ff161561066d5760048b01541161065457906104946001602494935b01956104878c60028a8a54169101928354913091612067565b89888d5416915491612180565b8584541693878787541695604051958680926370a0823160e01b998a835260048301525afa93841561060b57889388938b92600097610617575b506104fa9282600080949381946040519384928337810182815203925af16104f4611e7f565b50611ebf565b5485546040519586528716600486015284916024918391165afa801561060b576000906105dc575b61052c9250611e72565b95600381015487106105a2577e89088bf76a5e8c7f0949b234e1b713c4d71b6c75b4578745a6c711ac70189594836105659254166120c2565b805460ff60a81b198116600160a81b179091551660009081526007825260409020805461059190611e1a565b90556040519384523393a360018055005b60405163a8c278dd60e01b815260206004820152601160248201527014db1a5c1c1859d948195e18d959591959607a1b6044820152606490fd5b508482813d8311610604575b6105f28183611d8b565b810103126102675761052c9151610522565b503d6105e8565b6040513d6000823e3d90fd5b9450955093905082813d831161064d575b6106328183611d8b565b810103126102675790519287928792918a91906104fa6104ce565b503d610628565b604051630771e7a760e31b8152600481018a9052602490fd5b60048b015410610654579061049460016024949361046e565b90508781813d83116106ac575b61069d8183611d8b565b8101031261026757518b61044b565b503d610693565b60405163c182b72d60e01b815260048101869052602490fd5b6040516282b42960e81b8152600490fd5b34610267576040366003190112610267576106f6611c33565b60243590811515908183036102675761070d611f46565b6001600160a01b031691821561076c577f786c9db967bf0c6b16c7c91adae8a8c554b15a57d373fa2059607300f4616c0091610763602092856000526008845260406000209060ff801983541691151516179055565b604051908152a2005b60405163d92e233d60e01b8152600490fd5b3461026757602036600319011261026757600060a060405161079f81611d37565b8281528260208201528260408201528260608201528260808201520152600435600052600460205260c060406000206040516107da81611d37565b60018060a01b03918281541692838352806001830154169060208401918252600283015490604085019182526003840154926060860193845260a060ff600560048801549760808a01988952015416960195151586526040519687525116602086015251604085015251606084015251608083015251151560a0820152f35b3461026757602036600319011261026757600435600052600460205260c0604060002060018060a01b0390818154169160018201541690600281015460038201549060ff6005600485015494015416936040519586526020860152604085015260608401526080830152151560a0820152f35b34610267576000366003190112610267576020600a54604051908152f35b3461026757604036600319011261026757610903611c33565b6001600160a01b03166000908152600660205260409020805460243591908210156102675760209161093491611cab565b90546040519160031b1c8152f35b34610267576000366003190112610267576002546040516001600160a01b039091168152602090f35b34610267576020366003190112610267576001600160a01b0361098c611c33565b1660005260076020526020604060002054604051908152f35b34610267576000366003190112610267576000546040516001600160a01b039091168152602090f35b34610267576000366003190112610267576109e7611f46565b6109ef611ef9565b6000805460ff60a01b1916600160a01b1790556040513381527f62e78cea01bee320cd4e420270b5ea74000d11b0c9f74754ebdbfc544b05a25890602090a1005b3461026757600036600319011261026757610a49611f46565b600080546001600160a01b0319811682556001600160a01b03167f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e08280a3005b3461026757610a9736611c49565b929190610aa2611f72565b610aaa611ef9565b33600052600860205260ff60406000205416156106cc576000838152600360205260409020600101546001600160a01b031615610e4d578260005260036020526040600020916005602052604060002091610b0484611f95565b610b0d84611fc9565b600583015460048401541115610e34576006830154804210610e1c575060025483546001850154604051635620c32d60e11b81526001600160a01b03928316600482018190529183166024820152909892909160209183916044918391165afa90811561060b57600091610dea575b50670de0b6b3a7640000610b9560028701549283611e5f565b049060048701549161271083810311610d6b57610bbb61271091610bd594830390611e5f565b60018901549190049930916001600160a01b031690612067565b83546002850154610bf09185906001600160a01b0316612180565b600184810154908601546040516370a0823160e01b81526001600160a01b039182166004820152929160209184916024918391165afa91821561060b57600092610db5575b50600081610c5b9394829360405192839283378101838152039082875af16104f4611e7f565b600183810154908501546040516370a0823160e01b81526001600160a01b039182166004820152929160209184916024918391165afa801561060b57600090610d81575b610ca99250611e72565b9485106105a2578154610cc591906001600160a01b03166120c2565b610cd26005820154611e0b565b908160058201556003810154420190814211610d6b57600491600682015501541115610d2b575b506040519182527e89088bf76a5e8c7f0949b234e1b713c4d71b6c75b4578745a6c711ac70189560203393a360018055005b600101805460ff60a81b198116600160a81b179091556001600160a01b031660009081526007602052604090208054610d6390611e1a565b905582610cf9565b634e487b7160e01b600052601160045260246000fd5b506020823d602011610dad575b81610d9b60209383611d8b565b8101031261026757610ca99151610c9f565b3d9150610d8e565b91506020823d602011610de2575b81610dd060209383611d8b565b81010312610267579051906000610c35565b3d9150610dc3565b90506020813d602011610e14575b81610e0560209383611d8b565b81010312610267575188610b7c565b3d9150610df8565b6024906040519063a9155b0960e01b82526004820152fd5b604051637c2dd0fd60e01b815260048101869052602490fd5b60405163c182b72d60e01b815260048101849052602490fd5b34610267576020366003190112610267576004356000818152600360205260409020600101546001600160a01b0390811615610f52578160005260036020526001604060002001805482811692833314159081610f43575b506106cc5760ff8160a81c16600481101561025157610f2a5760ff60a81b1916600160a91b17905560009081526007602052604090208054610eff90611e1a565b905533907f97729287f7ba8b32555258e73e27488f492c99bf34e2869740c56843a2ffb23b600080a3005b604051631e9c917d60e21b815260048101859052602490fd5b90506000541633141585610ebe565b60405163c182b72d60e01b815260048101839052602490fd5b3461026757600036600319011261026757602060ff60005460a01c166040519015158152f35b34610267576020366003190112610267577f2c514bdb606b8075ec8a6022ddd1f50d6a8a2e9d242c88ddd3cbe3764c2256696020600435610fd0611f46565b80600955604051908152a1005b3461026757602036600319011261026757610ff6611c33565b610ffe611f46565b6001600160a01b0316801561076c57600280546001600160a01b031916821790557f5407ae21524903b1268620a61ddba526c26493c2d0df65cea711edd9b018bca9600080a2005b3461026757602080600319360112610267576001600160a01b03611068611c33565b1660005260068152604060002060405190818382549182815201908192600052846000209060005b868282106110e65786866110a682880383611d8b565b604051928392818401908285525180915260408401929160005b8281106110cf57505050500390f35b8351855286955093810193928101926001016110c0565b835485529093019260019283019201611090565b3461026757600036600319011261026757611113611f46565b60005460ff8160a01c161561115a5760ff60a01b19166000556040513381527f5db9ee0a495bf2e6ff9c91a7834c1ba4fdd244a5e8aa4e537bd38aeae4b073aa90602090a1005b604051638dfc202b60e01b8152600490fd5b503461026757602036600319011261026757611186611e27565b50600435600052600560205260406000206040516111a381611d05565b60018060a01b03918281541692838352806001830154169060208401918252600283015460408501908152600384015491606086019283526004850154936080870194855260c0600660058801549760a08a0198895201549701968752604051978852511660208701525160408601525160608501525160808401525160a08301525160c0820152f35b34610267576020366003190112610267576001600160a01b0361124e611c33565b166000526008602052602060ff604060002054166040519015158152f35b5034610267576020366003190112610267576004356000526003602052604060002080549060018101549060028101546112e1600460038401549301549360405195865260018060a01b03811660208701526112d16040870160ff8360a01c16611c19565b60ff606087019160a81c16611c26565b608084015260a083015260c0820152f35b34610267576000366003190112610267576020600b54604051908152f35b34610267576020366003190112610267576004356000818152600360205260409020600101546001600160a01b0390811615610f525781600052600360205260406000206001810180549160ff8360a81c166004811015610251576114175760030154801590811561140d575b506113d55760ff60a81b198216600360a81b17905516600090815260076020526040902080546113ac90611e1a565b90557fc4b18028cd4e987c6f51b76fe353bf20701009babc05208e39e32044646b0557600080a2005b60405163a8c278dd60e01b815260206004820152600f60248201526e139bdd081e595d08195e1c1a5c9959608a1b6044820152606490fd5b905042108561137d565b604051631e9c917d60e21b815260048101869052602490fd5b34610267576000366003190112610267576020600954604051908152f35b346102675760203660031901126102675760043561146a611f46565b6107d0811161147857600a55005b60405162461bcd60e51b815260206004820152601160248201527043616e6e6f74206578636565642032302560781b6044820152606490fd5b3461026757366003190161010081126102675760c0136102675760c43560e4356114d9611ef9565b6114e282611f1a565b6001600160a01b03806114f3611cd9565b16158015611834575b61076c5760443580156117fb5760643580156117be57608435918215611782573360005260209560078752604060002054600954111561176a5785151580611760575b6117225761154b611cd9565b611553611cef565b9060405190898201926001600160601b03198092813360601b1686526000603486015242603586015260601b16605584015260601b16606982015283607d820152607d81526115a181611d6f565b51902095604051916115b283611d05565b8783528883019133835260408401600081526060850160008152608086019142835260a0870193845260c087019485528b60005260038d526040600020965187558a60018801965116865491516002811015610251576001600160a81b03199092161760a09190911b60ff60a01b16178555519360048510156102515760049461163b91611dad565b51600285015551600384015551910155846000526004865260406000209380611662611cd9565b166001600160601b0360a01b90818754161786556001860191611683611cef565b169082541617905560028401556003830155600482015560a43580151581036102675760056116be92019060ff801983541691151516179055565b33600052600682526116d4816040600020611dd1565b336000526007825260406000206116eb8154611e0b565b905560405160008152817f7370673d457fb4191e82186e03f9dc23b87e7116cd4e67a291ed3b6596dfd697843393a3604051908152f35b60405163a8c278dd60e01b8152602060048201526015602482015274195e1c1a5c995cd05d081a5b881d1a19481c185cdd605a1b6044820152606490fd5b504286111561153f565b604051636d8d999b60e01b8152336004820152602490fd5b60405163a8c278dd60e01b81526020600482015260136024820152727461726765745072696365206973207a65726f60681b6044820152606490fd5b60405163a8c278dd60e01b81526020600482015260146024820152736d696e416d6f756e744f7574206973207a65726f60601b6044820152606490fd5b60405163a8c278dd60e01b815260206004820152601060248201526f616d6f756e74496e206973207a65726f60801b6044820152606490fd5b508061183e611cef565b16156114fc565b50346102675736600319016101208112610267571261026757611866611ef9565b61187160e435611f1a565b6001600160a01b03611881611cd9565b16158015611c01575b61076c576044358015611bc357606435603c8110611b7d576084358015611b4257336000526007602052604060002054600954111561176a5761010435151580611b35575b611722576118db611cd9565b6118e3611cef565b906040519060208201926001600160601b03198092813360601b168652600160f81b603486015242603586015260601b16605584015260601b16606982015284607d820152607d815261193581611d6f565b519020916040519361194685611d05565b61194e611c33565b85526024356001600160a01b038116810361026757602086015260408501526060840152608083015260c43560c0830152600060a083015260c43515611b2a575b6040519161199c83611d05565b8183526020830133815260408401600181526060850190600082524260808701526101043560a087015260e43560c08701528460005260036020526040600020928651845560018060a01b03905116600184015491516002811015610251576001600160a81b03199092161760a09190911b60ff60a01b16176001830155519360048510156102515760c0600491611a3960209760018601611dad565b6080810151600285015560a0810151600385015501519101558160005260058352600660c060406000209260018060a01b038151166001600160601b0360a01b9081865416178555600185019060018060a01b0388840151169082541617905560408101516002850155606081015160038501556080810151600485015560a0810151600585015501519101553360005260068252611adc816040600020611dd1565b33600052600782526040600020611af38154611e0b565b905560405160018152817f7370673d457fb4191e82186e03f9dc23b87e7116cd4e67a291ed3b6596dfd697843393a3604051908152f35b4260c083015261198f565b50426101043511156118cf565b60405163a8c278dd60e01b8152602060048201526012602482015271746f74616c5377617073206973207a65726f60701b6044820152606490fd5b60405163a8c278dd60e01b815260206004820152601c60248201527f696e74657276616c20746f6f2073686f727420286d696e2036307329000000006044820152606490fd5b60405163a8c278dd60e01b8152602060048201526015602482015274616d6f756e7450657253776170206973207a65726f60581b6044820152606490fd5b506001600160a01b03611c12611cef565b161561188a565b9060028210156102515752565b9060048210156102515752565b600435906001600160a01b038216820361026757565b90606060031983011261026757600435916024356001600160a01b0381168103610267579160443567ffffffffffffffff9283821161026757806023830112156102675781600401359384116102675760248483010111610267576024019190565b8054821015611cc35760005260206000200190600090565b634e487b7160e01b600052603260045260246000fd5b6004356001600160a01b03811681036102675790565b6024356001600160a01b03811681036102675790565b60e0810190811067ffffffffffffffff821117611d2157604052565b634e487b7160e01b600052604160045260246000fd5b60c0810190811067ffffffffffffffff821117611d2157604052565b6080810190811067ffffffffffffffff821117611d2157604052565b60a0810190811067ffffffffffffffff821117611d2157604052565b90601f8019910116810190811067ffffffffffffffff821117611d2157604052565b90600481101561025157815460ff60a81b191660a89190911b60ff60a81b16179055565b805468010000000000000000811015611d2157611df391600182018155611cab565b819291549060031b91821b91600019901b1916179055565b6000198114610d6b5760010190565b8015610d6b576000190190565b60405190611e3482611d05565b8160c06000918281528260208201528260408201528260608201528260808201528260a08201520152565b81810292918115918404141715610d6b57565b91908203918211610d6b57565b3d15611eba573d9067ffffffffffffffff8211611d215760405191611eae601f8201601f191660200184611d8b565b82523d6000602084013e565b606090565b15611ec657565b60405162461bcd60e51b815260206004820152600b60248201526a14ddd85c0819985a5b195960aa1b6044820152606490fd5b60ff60005460a01c16611f0857565b60405163d93c066560e01b8152600490fd5b600a54808211611f28575050565b6044925060405191633b5d56ed60e11b835260048301526024820152fd5b6000546001600160a01b03163303611f5a57565b60405163118cdaa760e01b8152336004820152602490fd5b600260015414611f83576002600155565b604051633ee5aeb560e01b8152600490fd5b60ff600182015460a81c16600481101561025157611fb05750565b6024905460405190631e9c917d60e21b82526004820152fd5b6003810154801515908161205c575b50611fe05750565b60018101805460ff60a81b198116600360a81b179091556001600160a01b031660009081526007602052604090208054602492919061201e90611e1a565b90555460405190807fc4b18028cd4e987c6f51b76fe353bf20701009babc05208e39e32044646b0557600080a26335053fa960e21b82526004820152fd5b905042101538611fd8565b6040516323b872dd60e01b60208201526001600160a01b03928316602482015292909116604483015260648083019390935291815260a081019181831067ffffffffffffffff841117611d21576120c092604052612238565b565b60405190602082019263095ea7b360e01b80855260018060a01b03809216918260248601526020600080978160448901526044885261210088611d53565b87519082885af1903d8751908361215f575b50505015612122575b5050505050565b6121559461215092604051926020840152602483015260448201526044815261214a81611d53565b82612238565b612238565b388080808061211b565b91925090612176575083163b15155b388080612112565b600191501461216e565b60405163095ea7b360e01b60208083018281526001600160a01b039586166024850181905260448086019890985296845291959294916000906121c287611d53565b86519082875af1903d6000519083612217575b505050156121e4575b50505050565b61220e93612150916040519160208301526024820152600060448201526044815261214a81611d53565b388080806121de565b9192509061222e575082163b15155b3880806121d5565b6001915014612226565b906000602091828151910182855af11561060b576000513d61228b57506001600160a01b0381163b155b6122695750565b604051635274afe760e01b81526001600160a01b039091166004820152602490fd5b6001141561226256fea26469706673582212209245c9d5b6a9e297da6e8ca78f132e346c2948ac1521e373793357ed65b9cf5964736f6c63430008180033' as const
export const swappiPriceAdapterBytecode =
  '0x60803461014957601f61086b38819003918201601f19168301916001600160401b0383118484101761014e5780849260609460405283398101031261014957604061004982610164565b9161005660208201610164565b6001600160a01b03929091839161006d9101610164565b1692831561013057826000549160018060a01b03199580878516176000558260405194167f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0600080a3670de0b6b3a7640000600355169081151580610125575b156100f55750836001541617600155169060025416176002556040516106f290816101798239f35b62461bcd60e51b815260206004820152600b60248201526a5a65726f4164647265737360a81b6044820152606490fd5b5083831615156100cd565b604051631e4fbdf760e01b815260006004820152602490fd5b600080fd5b634e487b7160e01b600052604160045260246000fd5b51906001600160a01b03821682036101495756fe60806040818152600436101561001457600080fd5b600091823560e01c9081630d40886d146103a3575080634e15d2831461030b5780635bb478081461029c578063715018a6146102425780638da5cb5b1461021b578063ac41865a146101da578063c0d7865514610168578063c45a015514610140578063f2fde38b146100bb5763f887ea401461009057600080fd5b346100b757816003193601126100b75760015490516001600160a01b039091168152602090f35b5080fd5b50346100b75760203660031901126100b7576100d56103bf565b6100dd610690565b6001600160a01b03908116918215610129575082546001600160a01b0319811683178455167f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e08380a380f35b51631e4fbdf760e01b815260048101849052602490fd5b50346100b757816003193601126100b75760025490516001600160a01b039091168152602090f35b82346101d75760203660031901126101d7576101826103bf565b61018a610690565b6001600160a01b031661019e8115156103da565b600180546001600160a01b031916821790557f7aed1d3e8155a07ccf395e44ea3109a0e2d6c9b29bbbe9f142d9790596f4dc808280a280f35b80fd5b50346100b757806003193601126100b7576101f36103bf565b602435926001600160a01b03841684036101d7575060209261021491610472565b9051908152f35b50346100b757816003193601126100b757905490516001600160a01b039091168152602090f35b82346101d757806003193601126101d75761025b610690565b80546001600160a01b03198116825581906001600160a01b03167f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e08280a380f35b82346101d75760203660031901126101d7576102b66103bf565b6102be610690565b6001600160a01b03166102d28115156103da565b600280546001600160a01b031916821790557f24cd1310c8883cbeaf5b805ab13586ce018b79c022827158ff3e8df14d3449368280a280f35b50346100b75760203660031901126100b75760043590610329610690565b811561036057816020917f1c9c437472a65d9d30272a49ca8c4f80f30703f7691e605dd789f56645b2ddb99360035551908152a180f35b5162461bcd60e51b815260206004820152601760248201527f51756f7465416d6f756e74206d757374206265203e20300000000000000000006044820152606490fd5b8390346100b757816003193601126100b7576020906003548152f35b600435906001600160a01b03821682036103d557565b600080fd5b156103e157565b60405162461bcd60e51b815260206004820152600b60248201526a5a65726f4164647265737360a81b6044820152606490fd5b90601f8019910116810190811067ffffffffffffffff82111761043657604052565b634e487b7160e01b600052604160045260246000fd5b80516001101561045c5760400190565b634e487b7160e01b600052603260045260246000fd5b60018060a01b038060025416908060409381855193849263e6a4390560e01b84521696876004840152169384602483015281604460209586935afa9081156106855790829160009161064a575b5016156106405783519467ffffffffffffffff93606087018581118882101761043657865260028752838701918636843787511561045c57829792526105048261044c565b5260019582600154169260035497875198899463d06ca61f60e01b865260448601916004870152896024870152518091526064850193926000905b888383106106265750505050505091818060009403915afa938493600095610581575b50505050156000146105745750600090565b61057d9061044c565b5190565b90919293943d8082853e6105958185610414565b83019284818503126100b75780519086821161062257019083601f830112156101d757815195861161060e578560051b9251956105d486850188610414565b865284808701938301019384116101d757508301905b8282106105ff57505050509038808080610562565b815181529083019083016105ea565b634e487b7160e01b81526041600452602490fd5b8280fd5b8551821687528c975095860195909401939083019061053f565b5050505050600090565b9091508381813d831161067e575b6106628183610414565b810103126100b757519082821682036101d757508190386104bf565b503d610658565b85513d6000823e3d90fd5b6000546001600160a01b031633036106a457565b60405163118cdaa760e01b8152336004820152602490fdfea2646970667358221220c10b223e834089e9444951c7ad37f3dafbfee5eca308265a397febeda5206ecc64736f6c63430008180033' as const
export const permitHandlerBytecode =
  '0x6080806040523461001b5760016000556106de90816100218239f35b600080fdfe6040608081526004908136101561001557600080fd5b6000803560e01c80635854e9bf146102e05763686f13fa1461003657600080fd5b346102dd576101203660031901126102dd576100506104f1565b9061005961050c565b93610062610522565b60843590606435610071610538565b610104359167ffffffffffffffff978884116102d957366023850112156102d95783870135928984116102d55736602485870101116102d5576100b2610685565b6001600160a01b039682881691821580156102cb575b6102bb57888e169333850361029c5750823b15610298579b818b829f819e9f61014a8e9f9d9e928a938e938851978896879663d505accf60e01b885260e4359560c4359589019360ff929897969360c0969260e087019a60018060a01b0380921688521660208701526040860152606085015216608083015260a08201520152565b038183885af1908161026f575b50916024979593918a9b8b989694610234575b509250505082915051948593018337810182815203925af13d1561022b573d938411610218578451936101a7601f8201601f1916602001866105f1565b84523d83602086013e5b156101d557509160016101d1935551918291602083526020830190610548565b0390f35b606490602085519162461bcd60e51b8352820152601d60248201527f4175746f6d6174696f6e4d616e616765722063616c6c206661696c65640000006044820152fd5b634e487b7160e01b835260418252602483fd5b606093506101b1565b7ff1888f4efa1fe5ad83325dd9d700a5cfee681bc32eb7ab040e1727368faf96ba92825196875260208701528a1694a4388080808e8161016a565b61028391939597999b9496989a92506105c7565b61029857918c8b989694929997959338610157565b8a80fd5b8d516308f14ec160e11b81529081906102b790828e01610588565b0390fd5b8c5163d92e233d60e01b81528a90fd5b50888816156100c8565b8880fd5b8780fd5b80fd5b509190346104ed576101003660031901126104ed576102fd6104f1565b9261030661050c565b9361030f610522565b906064359160843590610320610538565b91610329610685565b6001600160a01b03848116999093908a1580156104e3575b6104d357848116953387036104b8575086156104a8578a3b156102d957885163d505accf60e01b81526001600160a01b039182168b82019081529185166020830152604082018890526060820184905260ff92909216608082015260c43560a082015260e43560c08201528790829081900360e00181838e5af19081610495575b5061045b5750505050508060033d1161044b575b506308c379a014610413575b6084928151926308f14ec160e11b8452830152602482015260076044820152663ab735b737bbb760c91b6064820152fd5b61041b610613565b8061042657506103e2565b816102b792519485946308f14ec160e11b865285015260248401526044830190610548565b90508281803e5160e01c386103d6565b88927ff1888f4efa1fe5ad83325dd9d700a5cfee681bc32eb7ab040e1727368faf96ba928892835197885260208801521694a46001815580f35b6104a1909791976105c7565b95386103c2565b8851631f2a200560e01b81528a90fd5b89516308f14ec160e11b81529081906102b790828e01610588565b885163d92e233d60e01b81528a90fd5b5084841615610341565b8280fd5b600435906001600160a01b038216820361050757565b600080fd5b602435906001600160a01b038216820361050757565b604435906001600160a01b038216820361050757565b60a4359060ff8216820361050757565b919082519283825260005b848110610574575050826000602080949584010152601f8019910116010190565b602081830181015184830182015201610553565b6001600160a01b0390911681526040602082018190526014908201527337bbb732b91036bab9ba1031329031b0b63632b960611b606082015260800190565b67ffffffffffffffff81116105db57604052565b634e487b7160e01b600052604160045260246000fd5b90601f8019910116810190811067ffffffffffffffff8211176105db57604052565b600060443d1061067157604051600319913d83016004833e815167ffffffffffffffff918282113d6024840111176106745781840194855193841161067c573d850101602084870101116106745750610671929101602001906105f1565b90565b949350505050565b50949350505050565b600260005414610696576002600055565b604051633ee5aeb560e01b8152600490fdfea264697066735822122048df7123008527f31c193ab0b904724dd3c10843f6afd019948c9ebbc518411964736f6c63430008180033' as const
