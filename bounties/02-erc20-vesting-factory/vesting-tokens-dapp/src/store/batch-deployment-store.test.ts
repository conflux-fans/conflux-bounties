import { renderHook, act } from '@testing-library/react';
import { useBatchDeploymentStore } from './batch-deployment-store';

describe('Batch Deployment Store', () => {
  beforeEach(() => {
    useBatchDeploymentStore.getState().resetBatchDeployment();
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useBatchDeploymentStore());
      
      expect(result.current.inputMethod).toBe('manual');
      expect(result.current.csvData).toEqual([]);
      expect(result.current.tokenConfigs).toEqual([]);
      expect(result.current.vestingSchedules).toEqual([]);
      expect(result.current.beneficiaries).toEqual([]);
      expect(result.current.batchDeploymentResult).toBeNull();
      expect(result.current.isBatchDeploymentComplete).toBe(false);
    });
  });

  describe('Input Method', () => {
    it('should set input method', () => {
      const { result } = renderHook(() => useBatchDeploymentStore());

      act(() => {
        result.current.setInputMethod('csv');
      });

      expect(result.current.inputMethod).toBe('csv');
    });

    it('should toggle between manual and csv', () => {
      const { result } = renderHook(() => useBatchDeploymentStore());

      act(() => {
        result.current.setInputMethod('csv');
        result.current.setInputMethod('manual');
      });

      expect(result.current.inputMethod).toBe('manual');
    });
  });

  describe('CSV Data', () => {
    it('should set CSV data', () => {
      const { result } = renderHook(() => useBatchDeploymentStore());
      const csvData = [
        { name: 'Token1', symbol: 'T1', totalSupply: '1000000' },
        { name: 'Token2', symbol: 'T2', totalSupply: '2000000' }
      ];

      act(() => {
        result.current.setCsvData(csvData);
      });

      expect(result.current.csvData).toEqual(csvData);
    });

    it('should handle empty CSV data', () => {
      const { result } = renderHook(() => useBatchDeploymentStore());

      act(() => {
        result.current.setCsvData([]);
      });

      expect(result.current.csvData).toEqual([]);
    });
  });

  describe('Token Configurations', () => {
    it('should add token config', () => {
      const { result } = renderHook(() => useBatchDeploymentStore());
      const tokenConfig = {
        id: '1',
        name: 'Test Token',
        symbol: 'TEST',
        totalSupply: '1000000',
        decimals: 18,
        description: 'Test description',
        website: 'https://test.com',
        logo: 'test-logo.png'
      };

      act(() => {
        result.current.addTokenConfig(tokenConfig);
      });

      expect(result.current.tokenConfigs).toHaveLength(1);
      expect(result.current.tokenConfigs[0]).toEqual(tokenConfig);
    });

    it('should add multiple token configs', () => {
      const { result } = renderHook(() => useBatchDeploymentStore());
      const tokenConfigs = [
        {
          id: '1',
          name: 'Token 1',
          symbol: 'T1',
          totalSupply: '1000000',
          decimals: 18
        },
        {
          id: '2',
          name: 'Token 2',
          symbol: 'T2',
          totalSupply: '2000000',
          decimals: 6
        }
      ];

      act(() => {
        tokenConfigs.forEach(config => {
          result.current.addTokenConfig(config);
        });
      });

      expect(result.current.tokenConfigs).toHaveLength(2);
      expect(result.current.tokenConfigs).toEqual(tokenConfigs);
    });

    it('should update token config', () => {
      const { result } = renderHook(() => useBatchDeploymentStore());
      const tokenConfig = {
        id: '1',
        name: 'Test Token',
        symbol: 'TEST',
        totalSupply: '1000000',
        decimals: 18
      };

      act(() => {
        result.current.addTokenConfig(tokenConfig);
        result.current.updateTokenConfig('1', { name: 'Updated Token' });
      });

      expect(result.current.tokenConfigs[0].name).toBe('Updated Token');
      expect(result.current.tokenConfigs[0].symbol).toBe('TEST');
    });

    it('should remove token config and related data', () => {
      const { result } = renderHook(() => useBatchDeploymentStore());
      const tokenConfig = {
        id: '1',
        name: 'Test Token',
        symbol: 'TEST',
        totalSupply: '1000000',
        decimals: 18
      };
      const vestingSchedule = {
        id: '1',
        tokenId: '1',
        category: 'Team',
        cliffMonths: 12,
        vestingMonths: 48,
        revocable: true
      };
      const beneficiary = {
        id: '1',
        tokenId: '1',
        address: '0x1234567890123456789012345678901234567890',
        amount: '1000',
        category: 'Team'
      };

      act(() => {
        result.current.addTokenConfig(tokenConfig);
        result.current.addVestingSchedule(vestingSchedule);
        result.current.addBeneficiary(beneficiary);
        result.current.removeTokenConfig('1');
      });

      expect(result.current.tokenConfigs).toHaveLength(0);
      expect(result.current.vestingSchedules).toHaveLength(0);
      expect(result.current.beneficiaries).toHaveLength(0);
    });

    it('should set token configs', () => {
      const { result } = renderHook(() => useBatchDeploymentStore());
      const tokenConfigs = [
        {
          id: '1',
          name: 'Token 1',
          symbol: 'T1',
          totalSupply: '1000000',
          decimals: 18
        }
      ];

      act(() => {
        result.current.setTokenConfigs(tokenConfigs);
      });

      expect(result.current.tokenConfigs).toEqual(tokenConfigs);
    });
  });

  describe('Vesting Schedules', () => {
    it('should add vesting schedule', () => {
      const { result } = renderHook(() => useBatchDeploymentStore());
      const schedule = {
        id: '1',
        tokenId: '1',
        category: 'Team',
        cliffMonths: 12,
        vestingMonths: 48,
        revocable: true
      };

      act(() => {
        result.current.addVestingSchedule(schedule);
      });

      expect(result.current.vestingSchedules).toHaveLength(1);
      expect(result.current.vestingSchedules[0]).toEqual(schedule);
    });

    it('should add multiple vesting schedules', () => {
      const { result } = renderHook(() => useBatchDeploymentStore());
      const schedules = [
        {
          id: '1',
          tokenId: '1',
          category: 'Team',
          cliffMonths: 12,
          vestingMonths: 48,
          revocable: true
        },
        {
          id: '2',
          tokenId: '1',
          category: 'Advisors',
          cliffMonths: 6,
          vestingMonths: 24,
          revocable: false
        }
      ];

      act(() => {
        schedules.forEach(schedule => {
          result.current.addVestingSchedule(schedule);
        });
      });

      expect(result.current.vestingSchedules).toHaveLength(2);
      expect(result.current.vestingSchedules).toEqual(schedules);
    });

    it('should update vesting schedule', () => {
      const { result } = renderHook(() => useBatchDeploymentStore());
      const schedule = {
        id: '1',
        tokenId: '1',
        category: 'Team',
        cliffMonths: 12,
        vestingMonths: 48,
        revocable: true
      };

      act(() => {
        result.current.addVestingSchedule(schedule);
        result.current.updateVestingSchedule('1', { cliffMonths: 6 });
      });

      expect(result.current.vestingSchedules[0].cliffMonths).toBe(6);
      expect(result.current.vestingSchedules[0].vestingMonths).toBe(48);
    });

    it('should remove vesting schedule', () => {
      const { result } = renderHook(() => useBatchDeploymentStore());
      const schedule = {
        id: '1',
        tokenId: '1',
        category: 'Team',
        cliffMonths: 12,
        vestingMonths: 48,
        revocable: true
      };

      act(() => {
        result.current.addVestingSchedule(schedule);
        result.current.removeVestingSchedule('1');
      });

      expect(result.current.vestingSchedules).toHaveLength(0);
    });

    it('should set vesting schedules', () => {
      const { result } = renderHook(() => useBatchDeploymentStore());
      const schedules = [
        {
          id: '1',
          tokenId: '1',
          category: 'Team',
          cliffMonths: 12,
          vestingMonths: 48,
          revocable: true
        }
      ];

      act(() => {
        result.current.setVestingSchedules(schedules);
      });

      expect(result.current.vestingSchedules).toEqual(schedules);
    });
  });

  describe('Beneficiaries', () => {
    it('should add beneficiary', () => {
      const { result } = renderHook(() => useBatchDeploymentStore());
      const beneficiary = {
        id: '1',
        tokenId: '1',
        address: '0x1234567890123456789012345678901234567890',
        amount: '1000',
        category: 'Team'
      };

      act(() => {
        result.current.addBeneficiary(beneficiary);
      });

      expect(result.current.beneficiaries).toHaveLength(1);
      expect(result.current.beneficiaries[0]).toEqual(beneficiary);
    });

    it('should add multiple beneficiaries', () => {
      const { result } = renderHook(() => useBatchDeploymentStore());
      const beneficiaries = [
        {
          id: '1',
          tokenId: '1',
          address: '0x1234567890123456789012345678901234567890',
          amount: '1000',
          category: 'Team'
        },
        {
          id: '2',
          tokenId: '1',
          address: '0x2345678901234567890123456789012345678901',
          amount: '500',
          category: 'Advisors'
        }
      ];

      act(() => {
        beneficiaries.forEach(beneficiary => {
          result.current.addBeneficiary(beneficiary);
        });
      });

      expect(result.current.beneficiaries).toHaveLength(2);
      expect(result.current.beneficiaries).toEqual(beneficiaries);
    });

    it('should update beneficiary', () => {
      const { result } = renderHook(() => useBatchDeploymentStore());
      const beneficiary = {
        id: '1',
        tokenId: '1',
        address: '0x1234567890123456789012345678901234567890',
        amount: '1000',
        category: 'Team'
      };

      act(() => {
        result.current.addBeneficiary(beneficiary);
        result.current.updateBeneficiary('1', { amount: '2000' });
      });

      expect(result.current.beneficiaries[0].amount).toBe('2000');
      expect(result.current.beneficiaries[0].address).toBe('0x1234567890123456789012345678901234567890');
    });

    it('should remove beneficiary', () => {
      const { result } = renderHook(() => useBatchDeploymentStore());
      const beneficiary = {
        id: '1',
        tokenId: '1',
        address: '0x1234567890123456789012345678901234567890',
        amount: '1000',
        category: 'Team'
      };

      act(() => {
        result.current.addBeneficiary(beneficiary);
        result.current.removeBeneficiary('1');
      });

      expect(result.current.beneficiaries).toHaveLength(0);
    });

    it('should set beneficiaries', () => {
      const { result } = renderHook(() => useBatchDeploymentStore());
      const beneficiaries = [
        {
          id: '1',
          tokenId: '1',
          address: '0x1234567890123456789012345678901234567890',
          amount: '1000',
          category: 'Team'
        }
      ];

      act(() => {
        result.current.setBeneficiaries(beneficiaries);
      });

      expect(result.current.beneficiaries).toEqual(beneficiaries);
    });
  });

  describe('Deployment Result', () => {
    it('should set batch deployment result', () => {
      const { result } = renderHook(() => useBatchDeploymentStore());
      const deploymentResult = {
        batchId: 'batch-123',
        tokens: [
          {
            address: '0x1234567890123456789012345678901234567890',
            name: 'Token 1',
            symbol: 'T1'
          }
        ],
        vestingContracts: [['0x2345678901234567890123456789012345678901']],
        transactionHash: '0x3456789012345678901234567890123456789012345678901234567890123456',
        deployedAt: new Date(),
        databaseSaved: true
      };

      act(() => {
        result.current.setBatchDeploymentResult(deploymentResult);
      });

      expect(result.current.batchDeploymentResult).toEqual(deploymentResult);
    });

    it('should clear batch deployment result', () => {
      const { result } = renderHook(() => useBatchDeploymentStore());
      const deploymentResult = {
        batchId: 'batch-123',
        tokens: [],
        vestingContracts: [],
        transactionHash: '0x123',
        deployedAt: new Date(),
        databaseSaved: false
      };

      act(() => {
        result.current.setBatchDeploymentResult(deploymentResult);
        result.current.setBatchDeploymentResult(null);
      });

      expect(result.current.batchDeploymentResult).toBeNull();
    });

    it('should set batch deployment complete status', () => {
      const { result } = renderHook(() => useBatchDeploymentStore());

      act(() => {
        result.current.setIsBatchDeploymentComplete(true);
      });

      expect(result.current.isBatchDeploymentComplete).toBe(true);
    });
  });

  describe('Helper Functions', () => {
    it('should get tokens by category', () => {
      const { result } = renderHook(() => useBatchDeploymentStore());
      const tokenConfig = {
        id: '1',
        name: 'Test Token',
        symbol: 'TEST',
        totalSupply: '1000000',
        decimals: 18
      };
      const schedule = {
        id: '1',
        tokenId: '1',
        category: 'Team',
        cliffMonths: 12,
        vestingMonths: 48,
        revocable: true
      };

      act(() => {
        result.current.addTokenConfig(tokenConfig);
        result.current.addVestingSchedule(schedule);
      });

      const tokensByCategory = result.current.getTokensByCategory('Team');
      expect(tokensByCategory).toHaveLength(1);
      expect(tokensByCategory[0]).toEqual(tokenConfig);
    });

    it('should get vesting schedules by token', () => {
      const { result } = renderHook(() => useBatchDeploymentStore());
      const schedule = {
        id: '1',
        tokenId: '1',
        category: 'Team',
        cliffMonths: 12,
        vestingMonths: 48,
        revocable: true
      };

      act(() => {
        result.current.addVestingSchedule(schedule);
      });

      const schedulesByToken = result.current.getVestingSchedulesByToken('1');
      expect(schedulesByToken).toHaveLength(1);
      expect(schedulesByToken[0]).toEqual(schedule);
    });

    it('should get beneficiaries by token', () => {
      const { result } = renderHook(() => useBatchDeploymentStore());
      const beneficiary = {
        id: '1',
        tokenId: '1',
        address: '0x1234567890123456789012345678901234567890',
        amount: '1000',
        category: 'Team'
      };

      act(() => {
        result.current.addBeneficiary(beneficiary);
      });

      const beneficiariesByToken = result.current.getBeneficiariesByToken('1');
      expect(beneficiariesByToken).toHaveLength(1);
      expect(beneficiariesByToken[0]).toEqual(beneficiary);
    });
  });

  describe('Validation', () => {
    it('should validate empty configuration', () => {
      const { result } = renderHook(() => useBatchDeploymentStore());
      
      const validation = result.current.validateBatchConfiguration();
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('At least one token configuration is required');
    });

    it('should validate token configuration', () => {
      const { result } = renderHook(() => useBatchDeploymentStore());
      const invalidToken = {
        id: '1',
        name: '',
        symbol: '',
        totalSupply: '0',
        decimals: 18
      };

      act(() => {
        result.current.addTokenConfig(invalidToken);
      });

      const validation = result.current.validateBatchConfiguration();
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Token 1: Name is required');
      expect(validation.errors).toContain('Token 1: Symbol is required');
      expect(validation.errors).toContain('Token 1: Valid total supply is required');
    });

    it('should validate complete configuration', () => {
      const { result } = renderHook(() => useBatchDeploymentStore());
      const tokenConfig = {
        id: '1',
        name: 'Test Token',
        symbol: 'TEST',
        totalSupply: '1000000',
        decimals: 18
      };
      const schedule = {
        id: '1',
        tokenId: '1',
        category: 'Team',
        cliffMonths: 12,
        vestingMonths: 48,
        revocable: true
      };
      const beneficiary = {
        id: '1',
        tokenId: '1',
        address: '0x1234567890123456789012345678901234567890',
        amount: '1000',
        category: 'Team'
      };

      act(() => {
        result.current.addTokenConfig(tokenConfig);
        result.current.addVestingSchedule(schedule);
        result.current.addBeneficiary(beneficiary);
      });

      const validation = result.current.validateBatchConfiguration();
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should validate beneficiary addresses', () => {
      const { result } = renderHook(() => useBatchDeploymentStore());
      const tokenConfig = {
        id: '1',
        name: 'Test Token',
        symbol: 'TEST',
        totalSupply: '1000000',
        decimals: 18
      };
      const schedule = {
        id: '1',
        tokenId: '1',
        category: 'Team',
        cliffMonths: 12,
        vestingMonths: 48,
        revocable: true
      };
      const invalidBeneficiary = {
        id: '1',
        tokenId: '1',
        address: 'invalid-address',
        amount: '1000',
        category: 'Team'
      };

      act(() => {
        result.current.addTokenConfig(tokenConfig);
        result.current.addVestingSchedule(schedule);
        result.current.addBeneficiary(invalidBeneficiary);
      });

      const validation = result.current.validateBatchConfiguration();
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Token Test Token, Beneficiary 1: Valid address is required');
    });

    it('should validate beneficiary amounts', () => {
      const { result } = renderHook(() => useBatchDeploymentStore());
      const tokenConfig = {
        id: '1',
        name: 'Test Token',
        symbol: 'TEST',
        totalSupply: '1000000',
        decimals: 18
      };
      const schedule = {
        id: '1',
        tokenId: '1',
        category: 'Team',
        cliffMonths: 12,
        vestingMonths: 48,
        revocable: true
      };
      const invalidBeneficiary = {
        id: '1',
        tokenId: '1',
        address: '0x1234567890123456789012345678901234567890',
        amount: '0',
        category: 'Team'
      };

      act(() => {
        result.current.addTokenConfig(tokenConfig);
        result.current.addVestingSchedule(schedule);
        result.current.addBeneficiary(invalidBeneficiary);
      });

      const validation = result.current.validateBatchConfiguration();
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Token Test Token, Beneficiary 1: Valid amount is required');
    });
  });

  describe('Reset Function', () => {
    it('should reset all state to initial values', () => {
      const { result } = renderHook(() => useBatchDeploymentStore());
      const tokenConfig = {
        id: '1',
        name: 'Test Token',
        symbol: 'TEST',
        totalSupply: '1000000',
        decimals: 18
      };
      const schedule = {
        id: '1',
        tokenId: '1',
        category: 'Team',
        cliffMonths: 12,
        vestingMonths: 48,
        revocable: true
      };
      const beneficiary = {
        id: '1',
        tokenId: '1',
        address: '0x1234567890123456789012345678901234567890',
        amount: '1000',
        category: 'Team'
      };

      act(() => {
        result.current.setInputMethod('csv');
        result.current.setCsvData([{ test: 'data' }]);
        result.current.addTokenConfig(tokenConfig);
        result.current.addVestingSchedule(schedule);
        result.current.addBeneficiary(beneficiary);
        result.current.setBatchDeploymentResult({
          batchId: 'test',
          tokens: [],
          vestingContracts: [],
          transactionHash: '0x123',
          deployedAt: new Date(),
          databaseSaved: false
        });
        result.current.setIsBatchDeploymentComplete(true);
        result.current.resetBatchDeployment();
      });

      expect(result.current.inputMethod).toBe('manual');
      expect(result.current.csvData).toEqual([]);
      expect(result.current.tokenConfigs).toEqual([]);
      expect(result.current.vestingSchedules).toEqual([]);
      expect(result.current.beneficiaries).toEqual([]);
      expect(result.current.batchDeploymentResult).toBeNull();
      expect(result.current.isBatchDeploymentComplete).toBe(false);
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete batch deployment workflow', () => {
      const { result } = renderHook(() => useBatchDeploymentStore());
      
      // Setup
      const tokenConfig = {
        id: '1',
        name: 'Test Token',
        symbol: 'TEST',
        totalSupply: '1000000',
        decimals: 18
      };
      const schedule = {
        id: '1',
        tokenId: '1',
        category: 'Team',
        cliffMonths: 12,
        vestingMonths: 48,
        revocable: true
      };
      const beneficiary = {
        id: '1',
        tokenId: '1',
        address: '0x1234567890123456789012345678901234567890',
        amount: '1000',
        category: 'Team'
      };

      // Configure batch deployment
      act(() => {
        result.current.setInputMethod('manual');
        result.current.addTokenConfig(tokenConfig);
        result.current.addVestingSchedule(schedule);
        result.current.addBeneficiary(beneficiary);
      });

      expect(result.current.inputMethod).toBe('manual');
      expect(result.current.tokenConfigs).toHaveLength(1);
      expect(result.current.vestingSchedules).toHaveLength(1);
      expect(result.current.beneficiaries).toHaveLength(1);

      // Validate configuration
      const validation = result.current.validateBatchConfiguration();
      expect(validation.isValid).toBe(true);

      // Complete deployment
      const deploymentResult = {
        batchId: 'batch-123',
        tokens: [
          {
            address: '0x1234567890123456789012345678901234567890',
            name: 'Test Token',
            symbol: 'TEST'
          }
        ],
        vestingContracts: [['0x2345678901234567890123456789012345678901']],
        transactionHash: '0x3456789012345678901234567890123456789012345678901234567890123456',
        deployedAt: new Date(),
        databaseSaved: true
      };

      act(() => {
        result.current.setBatchDeploymentResult(deploymentResult);
        result.current.setIsBatchDeploymentComplete(true);
      });

      expect(result.current.batchDeploymentResult).toEqual(deploymentResult);
      expect(result.current.isBatchDeploymentComplete).toBe(true);
    });
  });
}); 