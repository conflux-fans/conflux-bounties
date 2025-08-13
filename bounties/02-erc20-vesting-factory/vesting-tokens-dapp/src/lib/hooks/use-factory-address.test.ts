import { renderHook } from '@testing-library/react'
import { useFactoryAddress, useChainExplorer } from './use-factory-address'
import { getFactoryAddress, getExplorerAddressUrl, getExplorerTxUrl } from '@/lib/web3/config'

// Mock the web3 config functions
jest.mock('@/lib/web3/config', () => ({
  getFactoryAddress: jest.fn(),
  getExplorerAddressUrl: jest.fn(),
  getExplorerTxUrl: jest.fn(),
}))

// Mock wagmi useChainId
jest.mock('wagmi', () => ({
  useChainId: () => 1, // Default to mainnet
}))

describe('useFactoryAddress', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return factory address for valid chain ID', () => {
    const mockFactoryAddress = '0x1234567890123456789012345678901234567890'
    ;(getFactoryAddress as jest.Mock).mockReturnValue(mockFactoryAddress)

    const { result } = renderHook(() => useFactoryAddress())

    expect(result.current).toBe(mockFactoryAddress)
    expect(getFactoryAddress).toHaveBeenCalledWith(1)
  })

  it('should return null for unsupported chain ID', () => {
    ;(getFactoryAddress as jest.Mock).mockImplementation(() => {
      throw new Error('Factory not deployed on this chain')
    })

    const { result } = renderHook(() => useFactoryAddress())

    expect(result.current).toBeNull()
    expect(getFactoryAddress).toHaveBeenCalledWith(1)
  })

  it('should handle errors gracefully', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    ;(getFactoryAddress as jest.Mock).mockImplementation(() => {
      throw new Error('Network error')
    })

    const { result } = renderHook(() => useFactoryAddress())

    expect(result.current).toBeNull()
    expect(consoleSpy).toHaveBeenCalledWith('Factory not deployed on this chain:', 1)
    
    consoleSpy.mockRestore()
  })
})

describe('useChainExplorer', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return explorer URL functions', () => {
    const mockAddressUrl = 'https://etherscan.io/address/0x123...'
    const mockTxUrl = 'https://etherscan.io/tx/0xabc...'
    
    ;(getExplorerAddressUrl as jest.Mock).mockReturnValue(mockAddressUrl)
    ;(getExplorerTxUrl as jest.Mock).mockReturnValue(mockTxUrl)

    const { result } = renderHook(() => useChainExplorer())

    expect(result.current.getAddressUrl).toBeDefined()
    expect(result.current.getTxUrl).toBeDefined()
  })

  it('should call getExplorerAddressUrl with correct parameters', () => {
    const mockAddressUrl = 'https://etherscan.io/address/0x123...'
    ;(getExplorerAddressUrl as jest.Mock).mockReturnValue(mockAddressUrl)

    const { result } = renderHook(() => useChainExplorer())
    const address = '0x1234567890123456789012345678901234567890'
    
    result.current.getAddressUrl(address)

    expect(getExplorerAddressUrl).toHaveBeenCalledWith(1, address)
  })

  it('should call getExplorerTxUrl with correct parameters', () => {
    const mockTxUrl = 'https://etherscan.io/tx/0xabc...'
    ;(getExplorerTxUrl as jest.Mock).mockReturnValue(mockTxUrl)

    const { result } = renderHook(() => useChainExplorer())
    const txHash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
    
    result.current.getTxUrl(txHash)

    expect(getExplorerTxUrl).toHaveBeenCalledWith(1, txHash)
  })
}) 