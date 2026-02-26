"""ConfluxScan API client for querying blockchain data."""
import httpx
from typing import Optional, Dict, Any, List
from enum import Enum


class NetworkType(str, Enum):
    """Conflux network types."""
    MAINNET_CORE = "mainnet_core"
    MAINNET_ESPACE = "mainnet_espace"
    TESTNET_CORE = "testnet_core"
    TESTNET_ESPACE = "testnet_espace"


class ConfluxScanClient:
    """Client for interacting with ConfluxScan APIs."""
    
    BASE_URLS = {
        NetworkType.MAINNET_CORE: "https://api.confluxscan.org",
        NetworkType.MAINNET_ESPACE: "https://evmapi.confluxscan.org",
        NetworkType.TESTNET_CORE: "https://api-testnet.confluxscan.org",
        NetworkType.TESTNET_ESPACE: "https://evmapi-testnet.confluxscan.org",
    }
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        network: NetworkType = NetworkType.MAINNET_ESPACE,
        timeout: float = 30.0
    ):
        """Initialize ConfluxScan client.
        
        Args:
            api_key: Optional API key for higher rate limits
            network: Network to query (mainnet/testnet, core/eSpace)
            timeout: Request timeout in seconds
        """
        self.api_key = api_key
        self.network = network
        self.base_url = self.BASE_URLS[network]
        self.timeout = timeout
        
    async def _request(
        self,
        params: Dict[str, Any],
        method: str = "GET"
    ) -> Dict[str, Any]:
        """Make API request to ConfluxScan.
        
        Args:
            params: Query parameters
            method: HTTP method
            
        Returns:
            API response as dictionary
        """
        if self.api_key:
            params["apikey"] = self.api_key
            
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.request(
                method,
                f"{self.base_url}/api",
                params=params
            )
            response.raise_for_status()
            return response.json()
    
    # ==================== Account APIs ====================
    
    async def get_balance(self, address: str) -> Dict[str, Any]:
        """Get CFX/ETH balance for an address.
        
        Args:
            address: Wallet address
            
        Returns:
            Balance information
        """
        return await self._request({
            "module": "account",
            "action": "balance",
            "address": address
        })
    
    async def get_balance_multi(self, addresses: List[str]) -> Dict[str, Any]:
        """Get balances for multiple addresses.
        
        Args:
            addresses: List of wallet addresses (max 20)
            
        Returns:
            Balance information for all addresses
        """
        return await self._request({
            "module": "account",
            "action": "balancemulti",
            "address": ",".join(addresses[:20])
        })
    
    async def get_transactions(
        self,
        address: str,
        skip: int = 0,
        limit: int = 20,
        sort: str = "desc"
    ) -> Dict[str, Any]:
        """Get transaction list for an address.
        
        Args:
            address: Wallet address
            skip: Number of records to skip (max 10,000)
            limit: Number of records to return (max 100)
            sort: Sort order (asc/desc)
            
        Returns:
            Transaction list
        """
        return await self._request({
            "module": "account",
            "action": "txlist",
            "address": address,
            "skip": min(skip, 10000),
            "limit": min(limit, 100),
            "sort": sort
        })
    
    async def get_token_transfers(
        self,
        address: str,
        contract_address: Optional[str] = None,
        skip: int = 0,
        limit: int = 20
    ) -> Dict[str, Any]:
        """Get token transfer list for an address.
        
        Args:
            address: Wallet address
            contract_address: Optional token contract address filter
            skip: Number of records to skip
            limit: Number of records to return
            
        Returns:
            Token transfer list
        """
        params = {
            "module": "account",
            "action": "tokentx",
            "address": address,
            "skip": min(skip, 10000),
            "limit": min(limit, 100)
        }
        if contract_address:
            params["contractaddress"] = contract_address
        return await self._request(params)
    
    # ==================== Block APIs ====================
    
    async def get_block_by_number(self, block_number: int) -> Dict[str, Any]:
        """Get block information by block number.
        
        Args:
            block_number: Block number
            
        Returns:
            Block information
        """
        return await self._request({
            "module": "block",
            "action": "getblocknobytime",
            "timestamp": block_number,
            "closest": "before"
        })
    
    # ==================== Contract APIs ====================
    
    async def get_contract_source(self, address: str) -> Dict[str, Any]:
        """Get verified contract source code.
        
        Args:
            address: Contract address
            
        Returns:
            Contract source code and ABI
        """
        return await self._request({
            "module": "contract",
            "action": "getsourcecode",
            "address": address
        })
    
    async def get_contract_abi(self, address: str) -> Dict[str, Any]:
        """Get contract ABI if verified.
        
        Args:
            address: Contract address
            
        Returns:
            Contract ABI
        """
        return await self._request({
            "module": "contract",
            "action": "getabi",
            "address": address
        })
    
    # ==================== Statistics APIs ====================
    
    async def get_cfx_supply(self) -> Dict[str, Any]:
        """Get total CFX supply.
        
        Returns:
            CFX supply information
        """
        return await self._request({
            "module": "stats",
            "action": "cfxsupply"
        })
    
    async def get_gas_price(self) -> Dict[str, Any]:
        """Get current gas price.
        
        Returns:
            Gas price information
        """
        return await self._request({
            "module": "stats",
            "action": "gasprice"
        })
    
    # ==================== Token APIs ====================
    
    async def get_token_info(self, contract_address: str) -> Dict[str, Any]:
        """Get token information.
        
        Args:
            contract_address: Token contract address
            
        Returns:
            Token details (name, symbol, decimals, etc.)
        """
        return await self._request({
            "module": "token",
            "action": "gettoken",
            "contractaddress": contract_address
        })


# Tool descriptions for LangChain integration
CONFLUXSCAN_TOOLS = [
    {
        "name": "get_account_balance",
        "description": "Get the CFX or ETH balance of a Conflux wallet address. Use this when the user asks about account balances.",
        "parameters": {
            "type": "object",
            "properties": {
                "address": {
                    "type": "string",
                    "description": "The Conflux wallet address (Core or eSpace format)"
                }
            },
            "required": ["address"]
        }
    },
    {
        "name": "get_account_transactions",
        "description": "Get recent transactions for a Conflux address. Use this when the user asks about transaction history.",
        "parameters": {
            "type": "object",
            "properties": {
                "address": {
                    "type": "string",
                    "description": "The Conflux wallet address"
                },
                "limit": {
                    "type": "integer",
                    "description": "Number of transactions to return (max 100)",
                    "default": 10
                }
            },
            "required": ["address"]
        }
    },
    {
        "name": "get_gas_price",
        "description": "Get the current gas price on Conflux network. Use this when the user asks about gas fees or transaction costs.",
        "parameters": {
            "type": "object",
            "properties": {}
        }
    },
    {
        "name": "get_token_info",
        "description": "Get information about a token contract (name, symbol, decimals, supply). Use this when the user asks about a specific token.",
        "parameters": {
            "type": "object",
            "properties": {
                "contract_address": {
                    "type": "string",
                    "description": "The token contract address"
                }
            },
            "required": ["contract_address"]
        }
    },
    {
        "name": "get_contract_source",
        "description": "Get the verified source code and ABI of a smart contract. Use this when the user asks about contract code or implementation.",
        "parameters": {
            "type": "object",
            "properties": {
                "address": {
                    "type": "string",
                    "description": "The contract address"
                }
            },
            "required": ["address"]
        }
    }
]
