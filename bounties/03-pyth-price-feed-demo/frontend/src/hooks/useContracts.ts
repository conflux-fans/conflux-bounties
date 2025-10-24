import { useReadContract, useAccount } from 'wagmi';

const CONTRACT_ADDRESSES = {
  priceConsumer: '0x540182717b8A2D723f9Fc0218558a7De224e8b17',
  betting: '0x6a5D4C136B20C3946f38B2b76eddd56452eA4156',
  lending: '0x0FC5A8c24b13E4178911a739866A0E7c27d90345',
};

export function useContracts() {
  const { address } = useAccount();

  const { data: btcPrice } = useReadContract({
    address: CONTRACT_ADDRESSES.priceConsumer as `0x${string}`,
    abi: [
      {
        inputs: [{ name: 'priceId', type: 'bytes32' }],
        name: 'getLatestPrice',
        outputs: [{ name: '', type: 'int64' }],
        stateMutability: 'view',
        type: 'function',
      },
    ],
    functionName: 'getLatestPrice',
    args: ['0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43'],
    query: {
      enabled: !!address,
      refetchInterval: 5000,
    },
  });

  const { data: userBet } = useReadContract({
    address: CONTRACT_ADDRESSES.betting as `0x${string}`,
    abi: [
      {
        inputs: [{ name: 'user', type: 'address' }],
        name: 'getUserBet',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
      },
    ],
    functionName: 'getUserBet',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
      refetchInterval: 5000,
    },
  });

  const { data: position } = useReadContract({
    address: CONTRACT_ADDRESSES.lending as `0x${string}`,
    abi: [
      {
        inputs: [{ name: 'user', type: 'address' }],
        name: 'getPosition',
        outputs: [
          { name: 'collateral', type: 'uint256' },
          { name: 'debt', type: 'uint256' },
        ],
        stateMutability: 'view',
        type: 'function',
      },
    ],
    functionName: 'getPosition',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
      refetchInterval: 5000,
    },
  });

  return {
    btcPrice,
    userBet,
    position,
  };
}