import { ethers } from "ethers";
import { env } from "../config/env";

export const provider = new ethers.JsonRpcProvider(env.CONFLUX_RPC_URL);
