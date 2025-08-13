import { renderHook, act } from '@testing-library/react'
import { useBatchDeploymentStore } from './batch-deployment-store'
import type { 
  BatchTokenConfig, 
  BatchVestingSchedule, 
  BatchBeneficiary, 
  BatchDeploymentResult
} from './batch-deployment-store'

// Mock Zustand persist middleware
jest.mock('zustand/middleware', () => ({
  persist: (fn: any) => fn,
  devtools: (fn: any) => fn,
}))

describe('useBatchDeploymentStore', () => {
  beforeEach(() => {
    // Reset store before each test
    const { result } = renderHook(() => useBatchDeploymentStore())
    act(() => {
      result.current.resetBatchDeployment()
    })
  })

  describe('Batch Token Configuration', () => {
    it('should set batch token config correctly', () => {
      const { result } = renderHook(() => useBatchDeploymentStore())
      const batchTokenConfig: BatchTokenConfig = {
        id: 'token1',
        name: 'Batch Test Token',
        symbol: 'BTEST',
        totalSupply: '10000000',
        decimals: 18,
        description: 'Batch test token description',
        website: 'https://batchtest.com',
        logo: 'https://batchtest.com/logo.png'
      }

      act(() => {
        result.current.setTokenConfigs([batchTokenConfig])
      })

      expect(result.current.tokenConfigs).toHaveLength(1)
      expect(result.current.tokenConfigs[0]).toEqual(batchTokenConfig)
    })

    it('should add token config correctly', () => {
      const { result } = renderHook(() => useBatchDeploymentStore())
      const tokenConfig: BatchTokenConfig = {
        id: 'token1',
        name: 'Test Token',
        symbol: 'TEST',
        totalSupply: '1000000',
        decimals: 18
      }

      act(() => {
        result.current.addTokenConfig(tokenConfig)
      })

      expect(result.current.tokenConfigs).toHaveLength(1)
      expect(result.current.tokenConfigs[0]).toEqual(tokenConfig)
    })
  })

  describe('Batch Vesting Schedules', () => {
    it('should add batch vesting schedule correctly', () => {
      const { result } = renderHook(() => useBatchDeploymentStore())
      const schedule: BatchVestingSchedule = {
        id: 'team-schedule',
        tokenId: 'token1',
        category: 'Team',
        cliffMonths: 12,
        vestingMonths: 48,
        revocable: true
      }

      act(() => {
        result.current.addVestingSchedule(schedule)
      })

      expect(result.current.vestingSchedules).toHaveLength(1)
      expect(result.current.vestingSchedules[0]).toEqual(schedule)
    })

    it('should update batch vesting schedule correctly', () => {
      const { result } = renderHook(() => useBatchDeploymentStore())
      const schedule: BatchVestingSchedule = {
        id: 'team-schedule',
        tokenId: 'token1',
        category: 'Team',
        cliffMonths: 12,
        vestingMonths: 48,
        revocable: true
      }

      act(() => {
        result.current.addVestingSchedule(schedule)
        result.current.updateVestingSchedule('team-schedule', { 
          cliffMonths: 6
        })
      })

      expect(result.current.vestingSchedules[0].cliffMonths).toBe(6)
      expect(result.current.vestingSchedules[0].vestingMonths).toBe(48) // unchanged
    })

    it('should remove batch vesting schedule', () => {
      const { result } = renderHook(() => useBatchDeploymentStore())
      const schedule: BatchVestingSchedule = {
        id: 'team-schedule',
        tokenId: 'token1',
        category: 'Team',
        cliffMonths: 12,
        vestingMonths: 48,
        revocable: true
      }

      act(() => {
        result.current.addVestingSchedule(schedule)
        result.current.removeVestingSchedule('team-schedule')
      })

      expect(result.current.vestingSchedules).toHaveLength(0)
    })
  })

  describe('Batch Beneficiaries', () => {
    it('should add batch beneficiary correctly', () => {
      const { result } = renderHook(() => useBatchDeploymentStore())
      const beneficiary: BatchBeneficiary = {
        id: '1',
        tokenId: 'token1',
        address: '0x1234567890123456789012345678901234567890',
        amount: '1000',
        category: 'team-schedule'
      }

      act(() => {
        result.current.addBeneficiary(beneficiary)
      })

      expect(result.current.beneficiaries).toHaveLength(1)
      expect(result.current.beneficiaries[0]).toEqual(beneficiary)
    })

    it('should update batch beneficiary correctly', () => {
      const { result } = renderHook(() => useBatchDeploymentStore())
      const beneficiary: BatchBeneficiary = {
        id: '1',
        tokenId: 'token1',
        address: '0x123...',
        amount: '1000',
        category: 'team-schedule'
      }

      act(() => {
        result.current.addBeneficiary(beneficiary)
        result.current.updateBeneficiary('1', { amount: '2000' })
      })

      expect(result.current.beneficiaries[0].amount).toBe('2000')
      expect(result.current.beneficiaries[0].address).toBe('0x123...') // unchanged
    })

    it('should remove batch beneficiary correctly', () => {
      const { result } = renderHook(() => useBatchDeploymentStore())
      const beneficiary: BatchBeneficiary = {
        id: '1',
        tokenId: 'token1',
        address: '0x123...',
        amount: '1000',
        category: 'team-schedule'
      }

      act(() => {
        result.current.addBeneficiary(beneficiary)
        result.current.removeBeneficiary('1')
      })

      expect(result.current.beneficiaries).toHaveLength(0)
    })

    it('should set multiple batch beneficiaries at once', () => {
      const { result } = renderHook(() => useBatchDeploymentStore())
      const beneficiaries: BatchBeneficiary[] = [
        {
          id: '1',
          tokenId: 'token1',
          address: '0x123...',
          amount: '1000',
          category: 'team-schedule'
        },
        {
          id: '2',
          tokenId: 'token1',
          address: '0x456...',
          amount: '500',
          category: 'advisor-schedule'
        }
      ]

      act(() => {
        result.current.setBeneficiaries(beneficiaries)
      })

      expect(result.current.beneficiaries).toHaveLength(2)
      expect(result.current.beneficiaries).toEqual(beneficiaries)
    })
  })

  describe('Deployment Results', () => {
    it('should set batch deployment result correctly', () => {
      const { result } = renderHook(() => useBatchDeploymentStore())
      const deploymentResult: BatchDeploymentResult = {
        batchId: 'batch1',
        tokens: [{
          address: '0x1234567890123456789012345678901234567890',
          name: 'Test Token',
          symbol: 'TEST'
        }],
        vestingContracts: [['0x0987654321098765432109876543210987654321']],
        transactionHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        deployedAt: new Date('2024-01-01'),
        databaseSaved: true
      }

      act(() => {
        result.current.setBatchDeploymentResult(deploymentResult)
      })

      expect(result.current.batchDeploymentResult).toEqual(deploymentResult)
    })
  })

  describe('Store Reset', () => {
    it('should reset batch deployment state correctly', () => {
      const { result } = renderHook(() => useBatchDeploymentStore())
      const tokenConfig: BatchTokenConfig = {
        id: 'token1',
        name: 'Batch Test Token',
        symbol: 'BTEST',
        totalSupply: '10000000',
        decimals: 18
      }

      act(() => {
        result.current.addTokenConfig(tokenConfig)
        result.current.addVestingSchedule({
          id: 'team-schedule',
          tokenId: 'token1',
          category: 'Team',
          cliffMonths: 12,
          vestingMonths: 48,
          revocable: true
        })
        result.current.setBatchDeploymentResult({
          batchId: 'batch1',
          tokens: [],
          vestingContracts: [],
          transactionHash: '0x123...',
          deployedAt: new Date(),
          databaseSaved: false
        })
        result.current.resetBatchDeployment()
      })

      expect(result.current.tokenConfigs).toHaveLength(0)
      expect(result.current.vestingSchedules).toHaveLength(0)
      expect(result.current.beneficiaries).toHaveLength(0)
      expect(result.current.batchDeploymentResult).toBeNull()
    })
  })

  describe('Validation', () => {
    it('should validate batch configuration correctly', () => {
      const { result } = renderHook(() => useBatchDeploymentStore())
      
      // Initially should be invalid
      const initialValidation = result.current.validateBatchConfiguration()
      expect(initialValidation.isValid).toBe(false)

      // Add required configuration
      act(() => {
        result.current.addTokenConfig({
          id: 'token1',
          name: 'Test Token',
          symbol: 'TEST',
          totalSupply: '1000000',
          decimals: 18
        })
        result.current.addVestingSchedule({
          id: 'team-schedule',
          tokenId: 'token1',
          category: 'Team',
          cliffMonths: 12,
          vestingMonths: 48,
          revocable: true
        })
        result.current.addBeneficiary({
          id: '1',
          tokenId: 'token1',
          address: '0x123...',
          amount: '1000',
          category: 'team-schedule'
        })
      })

      // Should now be valid
      const finalValidation = result.current.validateBatchConfiguration()
      expect(finalValidation.isValid).toBe(true)
    })
  })
}) 