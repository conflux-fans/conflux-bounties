import { X402Verifier } from "@x402/sdk";
import { config } from "./config.js";

/** Shared X402Verifier singleton — avoids duplicate RPC connections. */
export const verifier = new X402Verifier({
  contractAddress: config.contractAddress,
  rpcUrl: config.rpcUrl,
  facilitatorKey: config.serviceWalletKey as `0x${string}` | undefined,
});
