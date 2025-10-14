// app/src/hooks/use-factory-address.ts
import { useChainId } from "wagmi";
import {
  getExplorerAddressUrl,
  getExplorerTxUrl,
  getFactoryAddress,
} from "@/lib/web3/config";

export function useFactoryAddress() {
  const chainId = useChainId();

  try {
    return getFactoryAddress(chainId);
  } catch (error) {
    console.error("Factory not deployed on this chain:", chainId);
    return null;
  }
}

export function useChainExplorer() {
  const chainId = useChainId();

  return {
    getAddressUrl: (address: string) => getExplorerAddressUrl(chainId, address),
    getTxUrl: (txHash: string) => getExplorerTxUrl(chainId, txHash),
  };
}
