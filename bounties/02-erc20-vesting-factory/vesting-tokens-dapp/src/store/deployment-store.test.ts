import { renderHook, act } from '@testing-library/react';
import { useDeploymentStore } from './deployment-store';

describe('Deployment Store', () => {
  beforeEach(() => {
    useDeploymentStore.getState().resetDeployment();
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useDeploymentStore());
      
      expect(result.current.tokenConfig).toBeNull();
      expect(result.current.vestingSchedules).toEqual([]);
      expect(result.current.beneficiaries).toEqual([]);
      expect(result.current.isDeploying).toBe(false);
      expect(result.current.deploymentResult).toBeNull();
      expect(result.current.deploymentError).toBeNull();
      expect(result.current.isDeploymentComplete).toBe(false);
    });
  });

  describe('Token Configuration', () => {
    it('should set token config', () => {
      const { result } = renderHook(() => useDeploymentStore());
      const tokenConfig = {
        name: 'Test Token',
        symbol: 'TEST',
        totalSupply: '1000000',
        decimals: 18,
        description: 'Test description',
        website: 'https://test.com',
        logo: 'test-logo.png'
      };

      act(() => {
        result.current.setTokenConfig(tokenConfig);
      });

      expect(result.current.tokenConfig).toEqual(tokenConfig);
    });

    it('should update existing token config', () => {
      const { result } = renderHook(() => useDeploymentStore());
      const initialConfig = {
        name: 'Test Token',
        symbol: 'TEST',
        totalSupply: '1000000',
        decimals: 18
      };
      const updatedConfig = {
        name: 'Updated Token',
        symbol: 'UPD',
        totalSupply: '2000000',
        decimals: 6
      };

      act(() => {
        result.current.setTokenConfig(initialConfig);
        result.current.setTokenConfig(updatedConfig);
      });

      expect(result.current.tokenConfig).toEqual(updatedConfig);
    });
  });

  describe('Vesting Schedules', () => {
    it('should add vesting schedule', () => {
      const { result } = renderHook(() => useDeploymentStore());
      const schedule = {
        id: '1',
        category: 'Team',
        cliffMonths: 12,
        vestingMonths: 48,
        revocable: true,
        description: 'Team vesting'
      };

      act(() => {
        result.current.addVestingSchedule(schedule);
      });

      expect(result.current.vestingSchedules).toHaveLength(1);
      expect(result.current.vestingSchedules[0]).toEqual(schedule);
    });

    it('should add multiple vesting schedules', () => {
      const { result } = renderHook(() => useDeploymentStore());
      const schedules = [
        {
          id: '1',
          category: 'Team',
          cliffMonths: 12,
          vestingMonths: 48,
          revocable: true
        },
        {
          id: '2',
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
      const { result } = renderHook(() => useDeploymentStore());
      const schedule = {
        id: '1',
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
      const { result } = renderHook(() => useDeploymentStore());
      const schedule = {
        id: '1',
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

    it('should remove beneficiaries when removing vesting schedule', () => {
      const { result } = renderHook(() => useDeploymentStore());
      const schedule = {
        id: '1',
        category: 'Team',
        cliffMonths: 12,
        vestingMonths: 48,
        revocable: true
      };
      const beneficiary = {
        id: '1',
        address: '0x123',
        category: '1',
        amount: '1000'
      };

      act(() => {
        result.current.addVestingSchedule(schedule);
        result.current.addBeneficiary(beneficiary);
        result.current.removeVestingSchedule('1');
      });

      expect(result.current.vestingSchedules).toHaveLength(0);
      expect(result.current.beneficiaries).toHaveLength(0);
    });
  });

  describe('Beneficiaries', () => {
    it('should add beneficiary', () => {
      const { result } = renderHook(() => useDeploymentStore());
      const beneficiary = {
        id: '1',
        address: '0x1234567890123456789012345678901234567890',
        category: 'Team',
        amount: '1000',
        name: 'John Doe',
        email: 'john@example.com'
      };

      act(() => {
        result.current.addBeneficiary(beneficiary);
      });

      expect(result.current.beneficiaries).toHaveLength(1);
      expect(result.current.beneficiaries[0]).toEqual(beneficiary);
    });

    it('should add multiple beneficiaries', () => {
      const { result } = renderHook(() => useDeploymentStore());
      const beneficiaries = [
        {
          id: '1',
          address: '0x1234567890123456789012345678901234567890',
          category: 'Team',
          amount: '1000'
        },
        {
          id: '2',
          address: '0x2345678901234567890123456789012345678901',
          category: 'Advisors',
          amount: '500'
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
      const { result } = renderHook(() => useDeploymentStore());
      const beneficiary = {
        id: '1',
        address: '0x1234567890123456789012345678901234567890',
        category: 'Team',
        amount: '1000'
      };

      act(() => {
        result.current.addBeneficiary(beneficiary);
        result.current.updateBeneficiary('1', { amount: '2000' });
      });

      expect(result.current.beneficiaries[0].amount).toBe('2000');
      expect(result.current.beneficiaries[0].address).toBe('0x1234567890123456789012345678901234567890');
    });

    it('should remove beneficiary', () => {
      const { result } = renderHook(() => useDeploymentStore());
      const beneficiary = {
        id: '1',
        address: '0x1234567890123456789012345678901234567890',
        category: 'Team',
        amount: '1000'
      };

      act(() => {
        result.current.addBeneficiary(beneficiary);
        result.current.removeBeneficiary('1');
      });

      expect(result.current.beneficiaries).toHaveLength(0);
    });

    it('should set beneficiaries', () => {
      const { result } = renderHook(() => useDeploymentStore());
      const beneficiaries = [
        {
          id: '1',
          address: '0x1234567890123456789012345678901234567890',
          category: 'Team',
          amount: '1000'
        }
      ];

      act(() => {
        result.current.setBeneficiaries(beneficiaries);
      });

      expect(result.current.beneficiaries).toEqual(beneficiaries);
    });
  });

  describe('Deployment State', () => {
    it('should set deploying state', () => {
      const { result } = renderHook(() => useDeploymentStore());

      act(() => {
        result.current.setDeploying(true);
      });

      expect(result.current.isDeploying).toBe(true);
    });

    it('should set deployment result', () => {
      const { result } = renderHook(() => useDeploymentStore());
      const deploymentResult = {
        tokenAddress: '0x1234567890123456789012345678901234567890',
        vestingContracts: ['0x2345678901234567890123456789012345678901'],
        transactionHash: '0x3456789012345678901234567890123456789012345678901234567890123456',
        deployedAt: new Date(),
        databaseSaved: true
      };

      act(() => {
        result.current.setDeploymentResult(deploymentResult);
      });

      expect(result.current.deploymentResult).toEqual(deploymentResult);
      expect(result.current.isDeploymentComplete).toBe(true);
      expect(result.current.isDeploying).toBe(false);
      expect(result.current.deploymentError).toBeNull();
    });

    it('should set deployment error', () => {
      const { result } = renderHook(() => useDeploymentStore());
      const error = 'Deployment failed';

      act(() => {
        result.current.setDeploymentError(error);
      });

      expect(result.current.deploymentError).toBe(error);
      expect(result.current.isDeploying).toBe(false);
    });

    it('should clear deployment error when setting to null', () => {
      const { result } = renderHook(() => useDeploymentStore());

      act(() => {
        result.current.setDeploymentError('Some error');
        result.current.setDeploymentError(null);
      });

      expect(result.current.deploymentError).toBeNull();
    });
  });

  describe('Reset Deployment', () => {
    it('should reset all state to initial values', () => {
      const { result } = renderHook(() => useDeploymentStore());
      const tokenConfig = {
        name: 'Test Token',
        symbol: 'TEST',
        totalSupply: '1000000',
        decimals: 18
      };
      const schedule = {
        id: '1',
        category: 'Team',
        cliffMonths: 12,
        vestingMonths: 48,
        revocable: true
      };
      const beneficiary = {
        id: '1',
        address: '0x1234567890123456789012345678901234567890',
        category: 'Team',
        amount: '1000'
      };

      act(() => {
        result.current.setTokenConfig(tokenConfig);
        result.current.addVestingSchedule(schedule);
        result.current.addBeneficiary(beneficiary);
        result.current.setDeploying(true);
        result.current.setDeploymentError('Error');
        result.current.resetDeployment();
      });

      expect(result.current.tokenConfig).toBeNull();
      expect(result.current.vestingSchedules).toEqual([]);
      expect(result.current.beneficiaries).toEqual([]);
      expect(result.current.isDeploying).toBe(false);
      expect(result.current.deploymentResult).toBeNull();
      expect(result.current.deploymentError).toBeNull();
      expect(result.current.isDeploymentComplete).toBe(false);
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete deployment workflow', () => {
      const { result } = renderHook(() => useDeploymentStore());
      
      // Setup
      const tokenConfig = {
        name: 'Test Token',
        symbol: 'TEST',
        totalSupply: '1000000',
        decimals: 18
      };
      const schedule = {
        id: '1',
        category: 'Team',
        cliffMonths: 12,
        vestingMonths: 48,
        revocable: true
      };
      const beneficiary = {
        id: '1',
        address: '0x1234567890123456789012345678901234567890',
        category: '1',
        amount: '1000'
      };

      // Configure deployment
      act(() => {
        result.current.setTokenConfig(tokenConfig);
        result.current.addVestingSchedule(schedule);
        result.current.addBeneficiary(beneficiary);
      });

      expect(result.current.tokenConfig).toEqual(tokenConfig);
      expect(result.current.vestingSchedules).toHaveLength(1);
      expect(result.current.beneficiaries).toHaveLength(1);

      // Start deployment
      act(() => {
        result.current.setDeploying(true);
      });

      expect(result.current.isDeploying).toBe(true);

      // Complete deployment
      const deploymentResult = {
        tokenAddress: '0x1234567890123456789012345678901234567890',
        vestingContracts: ['0x2345678901234567890123456789012345678901'],
        transactionHash: '0x3456789012345678901234567890123456789012345678901234567890123456',
        deployedAt: new Date(),
        databaseSaved: true
      };

      act(() => {
        result.current.setDeploymentResult(deploymentResult);
      });

      expect(result.current.deploymentResult).toEqual(deploymentResult);
      expect(result.current.isDeploymentComplete).toBe(true);
      expect(result.current.isDeploying).toBe(false);
      expect(result.current.deploymentError).toBeNull();
    });

    it('should handle deployment failure', () => {
      const { result } = renderHook(() => useDeploymentStore());

      act(() => {
        result.current.setDeploying(true);
        result.current.setDeploymentError('Deployment failed');
      });

      expect(result.current.isDeploying).toBe(false);
      expect(result.current.deploymentError).toBe('Deployment failed');
      expect(result.current.isDeploymentComplete).toBe(false);
    });
  });
}); 