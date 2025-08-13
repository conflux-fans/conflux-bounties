import { renderHook, act } from '@testing-library/react'
import { useDeploymentStore } from './deployment-store'
import type { TokenConfig, VestingSchedule, Beneficiary, DeploymentResult } from './deployment-store'

// Mock Zustand persist middleware
jest.mock('zustand/middleware', () => ({
  persist: (fn: any) => fn,
}))

describe('useDeploymentStore', () => {
  beforeEach(() => {
    // Reset store before each test
    const { result } = renderHook(() => useDeploymentStore())
    act(() => {
      result.current.resetDeployment()
    })
  })

  describe('Token Configuration', () => {
    it('should set token config correctly', () => {
      const { result } = renderHook(() => useDeploymentStore())
      const tokenConfig: TokenConfig = {
        name: 'Test Token',
        symbol: 'TEST',
        totalSupply: '1000000',
        decimals: 18,
        description: 'Test token description',
        website: 'https://test.com',
        logo: 'https://test.com/logo.png'
      }

      act(() => {
        result.current.setTokenConfig(tokenConfig)
      })

      expect(result.current.tokenConfig).toEqual(tokenConfig)
    })

    it('should handle null token config', () => {
      const { result } = renderHook(() => useDeploymentStore())
      
      act(() => {
        result.current.setTokenConfig(null as any)
      })

      expect(result.current.tokenConfig).toBeNull()
    })
  })

  describe('Vesting Schedules', () => {
    it('should add vesting schedule correctly', () => {
      const { result } = renderHook(() => useDeploymentStore())
      const schedule: VestingSchedule = {
        id: '1',
        category: 'Team',
        cliffMonths: 12,
        vestingMonths: 48,
        revocable: true,
        description: 'Team vesting schedule'
      }

      act(() => {
        result.current.addVestingSchedule(schedule)
      })

      expect(result.current.vestingSchedules).toHaveLength(1)
      expect(result.current.vestingSchedules[0]).toEqual(schedule)
    })

    it('should update vesting schedule correctly', () => {
      const { result } = renderHook(() => useDeploymentStore())
      const schedule: VestingSchedule = {
        id: '1',
        category: 'Team',
        cliffMonths: 12,
        vestingMonths: 48,
        revocable: true
      }

      act(() => {
        result.current.addVestingSchedule(schedule)
        result.current.updateVestingSchedule('1', { cliffMonths: 6 })
      })

      expect(result.current.vestingSchedules[0].cliffMonths).toBe(6)
      expect(result.current.vestingSchedules[0].vestingMonths).toBe(48) // unchanged
    })

    it('should remove vesting schedule and related beneficiaries', () => {
      const { result } = renderHook(() => useDeploymentStore())
      const schedule: VestingSchedule = {
        id: 'team',
        category: 'Team',
        cliffMonths: 12,
        vestingMonths: 48,
        revocable: true
      }
      const beneficiary: Beneficiary = {
        id: '1',
        address: '0x123...',
        category: 'team',
        amount: '1000',
        name: 'John Doe'
      }

      act(() => {
        result.current.addVestingSchedule(schedule)
        result.current.addBeneficiary(beneficiary)
        result.current.removeVestingSchedule('team')
      })

      expect(result.current.vestingSchedules).toHaveLength(0)
      expect(result.current.beneficiaries).toHaveLength(0)
    })
  })

  describe('Beneficiaries', () => {
    it('should add beneficiary correctly', () => {
      const { result } = renderHook(() => useDeploymentStore())
      const beneficiary: Beneficiary = {
        id: '1',
        address: '0x1234567890123456789012345678901234567890',
        category: 'Team',
        amount: '1000',
        name: 'John Doe',
        email: 'john@example.com'
      }

      act(() => {
        result.current.addBeneficiary(beneficiary)
      })

      expect(result.current.beneficiaries).toHaveLength(1)
      expect(result.current.beneficiaries[0]).toEqual(beneficiary)
    })

    it('should update beneficiary correctly', () => {
      const { result } = renderHook(() => useDeploymentStore())
      const beneficiary: Beneficiary = {
        id: '1',
        address: '0x123...',
        category: 'Team',
        amount: '1000',
        name: 'John Doe'
      }

      act(() => {
        result.current.addBeneficiary(beneficiary)
        result.current.updateBeneficiary('1', { amount: '2000' })
      })

      expect(result.current.beneficiaries[0].amount).toBe('2000')
      expect(result.current.beneficiaries[0].name).toBe('John Doe') // unchanged
    })

    it('should remove beneficiary correctly', () => {
      const { result } = renderHook(() => useDeploymentStore())
      const beneficiary: Beneficiary = {
        id: '1',
        address: '0x123...',
        category: 'Team',
        amount: '1000'
      }

      act(() => {
        result.current.addBeneficiary(beneficiary)
        result.current.removeBeneficiary('1')
      })

      expect(result.current.beneficiaries).toHaveLength(0)
    })

    it('should set multiple beneficiaries at once', () => {
      const { result } = renderHook(() => useDeploymentStore())
      const beneficiaries: Beneficiary[] = [
        {
          id: '1',
          address: '0x123...',
          category: 'Team',
          amount: '1000'
        },
        {
          id: '2',
          address: '0x456...',
          category: 'Advisors',
          amount: '500'
        }
      ]

      act(() => {
        result.current.setBeneficiaries(beneficiaries)
      })

      expect(result.current.beneficiaries).toHaveLength(2)
      expect(result.current.beneficiaries).toEqual(beneficiaries)
    })
  })

  describe('Deployment State', () => {
    it('should set deploying state correctly', () => {
      const { result } = renderHook(() => useDeploymentStore())

      act(() => {
        result.current.setDeploying(true)
      })

      expect(result.current.isDeploying).toBe(true)
    })

    it('should set deployment result correctly', () => {
      const { result } = renderHook(() => useDeploymentStore())
      const deploymentResult: DeploymentResult = {
        tokenAddress: '0x1234567890123456789012345678901234567890',
        vestingContracts: ['0x0987654321098765432109876543210987654321'],
        transactionHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        deployedAt: new Date('2024-01-01'),
        databaseSaved: true
      }

      act(() => {
        result.current.setDeploymentResult(deploymentResult)
      })

      expect(result.current.deploymentResult).toEqual(deploymentResult)
      expect(result.current.isDeploymentComplete).toBe(true)
      expect(result.current.isDeploying).toBe(false)
      expect(result.current.deploymentError).toBeNull()
    })

    it('should set deployment error correctly', () => {
      const { result } = renderHook(() => useDeploymentStore())
      const errorMessage = 'Deployment failed: insufficient funds'

      act(() => {
        result.current.setDeploymentError(errorMessage)
      })

      expect(result.current.deploymentError).toBe(errorMessage)
      expect(result.current.isDeploying).toBe(false)
    })

    it('should reset deployment state correctly', () => {
      const { result } = renderHook(() => useDeploymentStore())
      const tokenConfig: TokenConfig = {
        name: 'Test Token',
        symbol: 'TEST',
        totalSupply: '1000000',
        decimals: 18
      }

      act(() => {
        result.current.setTokenConfig(tokenConfig)
        result.current.addVestingSchedule({
          id: '1',
          category: 'Team',
          cliffMonths: 12,
          vestingMonths: 48,
          revocable: true
        })
        result.current.setDeploying(true)
        result.current.setDeploymentError('Test error')
        result.current.resetDeployment()
      })

      expect(result.current.tokenConfig).toBeNull()
      expect(result.current.vestingSchedules).toHaveLength(0)
      expect(result.current.beneficiaries).toHaveLength(0)
      expect(result.current.isDeploying).toBe(false)
      expect(result.current.deploymentResult).toBeNull()
      expect(result.current.deploymentError).toBeNull()
      expect(result.current.isDeploymentComplete).toBe(false)
    })
  })

  describe('Store Persistence', () => {
    it('should persist token config, vesting schedules, and beneficiaries', () => {
      const { result } = renderHook(() => useDeploymentStore())
      const tokenConfig: TokenConfig = {
        name: 'Test Token',
        symbol: 'TEST',
        totalSupply: '1000000',
        decimals: 18
      }
      const schedule: VestingSchedule = {
        id: '1',
        category: 'Team',
        cliffMonths: 12,
        vestingMonths: 48,
        revocable: true
      }
      const beneficiary: Beneficiary = {
        id: '1',
        address: '0x123...',
        category: 'Team',
        amount: '1000'
      }

      act(() => {
        result.current.setTokenConfig(tokenConfig)
        result.current.addVestingSchedule(schedule)
        result.current.addBeneficiary(beneficiary)
      })

      // These should be persisted
      expect(result.current.tokenConfig).toEqual(tokenConfig)
      expect(result.current.vestingSchedules).toContainEqual(schedule)
      expect(result.current.beneficiaries).toContainEqual(beneficiary)
    })
  })
}) 