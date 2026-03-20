// Gating Engine - Check token holdings on Conflux eSpace
import { ethers } from 'ethers'

const RPC_URL = process.env.RPC_URL || 'https://evm.confluxrpc.com'
const provider = new ethers.JsonRpcProvider(RPC_URL)

export interface GatingRule {
  id: string
  name: string
  type: 'erc20' | 'erc721' | 'erc1155'
  contractAddress: string
  threshold: number
  tokenId?: number
  enabled: boolean
}

// ERC20 ABI (minimal)
const ERC20_ABI = ['function balanceOf(address) view returns (uint256)']
// ERC721 ABI
const ERC721_ABI = ['function balanceOf(address) view returns (uint256)']
// ERC1155 ABI
const ERC1155_ABI = ['function balanceOf(address,uint256) view returns (uint256)']

export async function checkGatingRule(rule: GatingRule, userAddress: string): Promise<{ pass: boolean; balance: string }> {
  try {
    if (rule.type === 'erc20') {
      const contract = new ethers.Contract(rule.contractAddress, ERC20_ABI, provider)
      const balance = await contract.balanceOf(userAddress)
      const bal = Number(ethers.formatUnits(balance, 18))
      return { pass: bal >= rule.threshold, balance: bal.toString() }
    } else if (rule.type === 'erc721') {
      const contract = new ethers.Contract(rule.contractAddress, ERC721_ABI, provider)
      const balance = await contract.balanceOf(userAddress)
      const bal = Number(balance)
      return { pass: bal > 0 && bal >= rule.threshold, balance: bal.toString() }
    } else if (rule.type === 'erc1155') {
      const contract = new ethers.Contract(rule.contractAddress, ERC1155_ABI, provider)
      const tokenId = rule.tokenId || 0
      const balance = await contract.balanceOf(userAddress, tokenId)
      const bal = Number(balance)
      return { pass: bal >= rule.threshold, balance: bal.toString() }
    }
    return { pass: false, balance: '0' }
  } catch (e) {
    console.error(`Gating check failed for ${rule.contractAddress}:`, e)
    return { pass: false, balance: 'error' }
  }
}

export async function checkAllRules(rules: GatingRule[], userAddress: string): Promise<{ allPassed: boolean; results: Array<{ rule: GatingRule; pass: boolean; balance: string }> }> {
  const results = await Promise.all(rules.map(async (rule) => ({
    rule,
    ...(await checkGatingRule(rule, userAddress))
  })))
  return { allPassed: results.every(r => r.pass), results }
}
