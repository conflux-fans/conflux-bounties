import pytest
from unittest.mock import Mock, AsyncMock, patch
from tools.confluxscan_client import ConfluxScanClient, NetworkType


@pytest.mark.asyncio
async def test_client_initialization():
    client = ConfluxScanClient(
        api_key="test_key",
        network=NetworkType.MAINNET_ESPACE
    )
    
    assert client.api_key == "test_key"
    assert client.network == NetworkType.MAINNET_ESPACE
    assert client.base_url == "https://evmapi.confluxscan.org"


@pytest.mark.asyncio
async def test_get_balance():
    client = ConfluxScanClient(network=NetworkType.MAINNET_ESPACE)
    
    with patch.object(client, '_request', new_callable=AsyncMock) as mock_request:
        mock_request.return_value = {
            "status": "1",
            "message": "OK",
            "result": "1000000000000000000"  # 1 CFX in wei
        }
        
        result = await client.get_balance("0x1234567890123456789012345678901234567890")
        
        assert result["status"] == "1"
        assert result["result"] == "1000000000000000000"
        mock_request.assert_called_once()


@pytest.mark.asyncio
async def test_network_url_mapping():
    test_cases = [
        (NetworkType.MAINNET_CORE, "https://api.confluxscan.org"),
        (NetworkType.MAINNET_ESPACE, "https://evmapi.confluxscan.org"),
        (NetworkType.TESTNET_CORE, "https://api-testnet.confluxscan.org"),
        (NetworkType.TESTNET_ESPACE, "https://evmapi-testnet.confluxscan.org"),
    ]
    
    for network, expected_url in test_cases:
        client = ConfluxScanClient(network=network)
        assert client.base_url == expected_url


@pytest.mark.asyncio
async def test_api_key_in_request():
    client = ConfluxScanClient(api_key="my_secret_key")
    
    with patch('httpx.AsyncClient') as mock_client:
        mock_response = Mock()
        mock_response.json.return_value = {"status": "1"}
        mock_response.raise_for_status = Mock()
        
        mock_client.return_value.__aenter__.return_value.request = AsyncMock(return_value=mock_response)
        
        await client._request({"module": "account", "action": "balance"})
        
        # Verify API key was added to params
        call_args = mock_client.return_value.__aenter__.return_value.request.call_args
        params = call_args[1]["params"]
        assert params["apikey"] == "my_secret_key"
