/*
 * Copyright 2025 Conflux DevKit Team
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContractDeployer } from './deploy.js';

describe('ContractDeployer', () => {
  let deployer: ContractDeployer;
  let mockClientManager: any;

  beforeEach(() => {
    mockClientManager = {
      getCoreClient: vi.fn(),
      getEvmClient: vi.fn(),
    };
    deployer = new ContractDeployer(mockClientManager);
  });

  describe('deploy', () => {
    it('should deploy to eSpace', async () => {
      const result = await deployer.deploy({
        bytecode: '0x6080604052...',
        abi: [],
        chain: 'evm',
      });

      expect(result.address).toMatch(/^0x[a-f0-9]{40}$/i);
      expect(result.transactionHash).toMatch(/^0x[a-f0-9]{64}$/);
      expect(result.chain).toBe('evm');
      expect(result.blockNumber).toBeGreaterThan(0n);
      expect(result.deployedAt).toBeInstanceOf(Date);
    });

    it('should deploy to Core Space', async () => {
      const result = await deployer.deploy({
        bytecode: '0x6080604052...',
        abi: [],
        chain: 'core',
      });

      expect(result.address).toMatch(/^cfx:[a-z0-9]{40}$/);
      expect(result.transactionHash).toMatch(/^0x[a-f0-9]{64}$/);
      expect(result.chain).toBe('core');
    });

    it('should include deployer address', async () => {
      const result = await deployer.deploy({
        bytecode: '0x6080604052...',
        abi: [],
        chain: 'evm',
      });

      expect(result.deployer).toBeDefined();
    });

    it('should handle deployment with constructor args', async () => {
      const result = await deployer.deploy({
        bytecode: '0x6080604052...',
        abi: [],
        args: ['arg1', 'arg2'],
        chain: 'evm',
      });

      expect(result.address).toBeDefined();
    });

    it('should handle deployment with value', async () => {
      const result = await deployer.deploy({
        bytecode: '0x6080604052...',
        abi: [],
        value: 1000000000000000000n,
        chain: 'evm',
      });

      expect(result.address).toBeDefined();
    });
  });

  describe('deployToMultipleChains', () => {
    it('should deploy to both chains', async () => {
      const result = await deployer.deployToMultipleChains({
        bytecode: '0x6080604052...',
        abi: [],
        chains: ['core', 'evm'],
      });

      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(0);
      expect(result.core).toBeDefined();
      expect(result.evm).toBeDefined();
    });

    it('should handle partial failures', async () => {
      // Mock to simulate failure
      vi.spyOn(deployer as any, 'deploy').mockRejectedValueOnce(
        new Error('Deployment failed')
      );

      const result = await deployer.deployToMultipleChains({
        bytecode: '0x6080604052...',
        abi: [],
        chains: ['core', 'evm'],
      });

      expect(result.successCount).toBeLessThan(2);
      expect(result.failureCount).toBeGreaterThan(0);
    });

    it('should deploy to single chain', async () => {
      const result = await deployer.deployToMultipleChains({
        bytecode: '0x6080604052...',
        abi: [],
        chains: ['evm'],
      });

      expect(result.successCount).toBe(1);
      expect(result.evm).toBeDefined();
      expect(result.core).toBeUndefined();
    });
  });

  describe('estimateDeploymentGas', () => {
    it('should estimate gas for deployment', async () => {
      const gas = await deployer.estimateDeploymentGas({
        bytecode: `0x${'60'.repeat(1000)}`, // 1000 bytes
        abi: [],
        chain: 'evm',
      });

      expect(gas).toBeGreaterThan(0n);
    });

    it('should include bytecode gas cost', async () => {
      const smallGas = await deployer.estimateDeploymentGas({
        bytecode: '0x6080',
        abi: [],
        chain: 'evm',
      });

      const largeGas = await deployer.estimateDeploymentGas({
        bytecode: `0x${'60'.repeat(1000)}`,
        abi: [],
        chain: 'evm',
      });

      expect(largeGas).toBeGreaterThan(smallGas);
    });

    it('should include args gas cost', async () => {
      const noArgsGas = await deployer.estimateDeploymentGas({
        bytecode: '0x6080',
        abi: [],
        chain: 'evm',
      });

      const withArgsGas = await deployer.estimateDeploymentGas({
        bytecode: '0x6080',
        abi: [],
        args: ['arg1', 'arg2', 'arg3'],
        chain: 'evm',
      });

      expect(withArgsGas).toBeGreaterThan(noArgsGas);
    });
  });

  describe('verifyBytecode', () => {
    it('should verify matching bytecode', async () => {
      const bytecode = '0x6080604052...';
      const isVerified = await deployer.verifyBytecode(
        '0xContractAddress',
        bytecode,
        'evm'
      );

      // Current implementation always returns true
      expect(isVerified).toBe(true);
    });
  });
});
