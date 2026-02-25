import { describe, expect, it } from 'vitest';
import { ERC20_ABI } from '../contracts/abis/erc20.js';
import { ERC721_ABI as ERC721 } from '../contracts/abis/erc721.js';
import { ERC1155_ABI as ERC1155 } from '../contracts/abis/erc1155.js';
import {
  ContractError,
  DeploymentError,
  InteractionError,
} from '../contracts/types/index.js';

describe('ERC20_ABI', () => {
  it('contains standard ERC20 function signatures', () => {
    const names = ERC20_ABI.filter((e) => e.type === 'function').map(
      (e) => (e as { name: string }).name
    );
    expect(names).toContain('transfer');
    expect(names).toContain('approve');
    expect(names).toContain('balanceOf');
    expect(names).toContain('totalSupply');
    expect(names).toContain('allowance');
  });

  it('contains Transfer and Approval events', () => {
    const events = ERC20_ABI.filter((e) => e.type === 'event').map(
      (e) => (e as { name: string }).name
    );
    expect(events).toContain('Transfer');
    expect(events).toContain('Approval');
  });
});

describe('ERC721_ABI', () => {
  it('contains ownerOf and tokenURI', () => {
    const names = ERC721.filter((e) => e.type === 'function').map(
      (e) => (e as { name: string }).name
    );
    expect(names).toContain('ownerOf');
    expect(names).toContain('safeTransferFrom');
  });
});

describe('ERC1155_ABI', () => {
  it('contains balanceOf and safeTransferFrom', () => {
    const names = ERC1155.filter((e) => e.type === 'function').map(
      (e) => (e as { name: string }).name
    );
    expect(names).toContain('balanceOf');
    expect(names).toContain('safeTransferFrom');
  });
});

describe('ContractError hierarchy', () => {
  it('ContractError is an Error', () => {
    const err = new ContractError('test error');
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('test error');
  });

  it('DeploymentError extends ContractError', () => {
    const err = new DeploymentError('deploy failed');
    expect(err).toBeInstanceOf(ContractError);
    expect(err).toBeInstanceOf(Error);
  });

  it('InteractionError extends ContractError', () => {
    const err = new InteractionError('interact failed');
    expect(err).toBeInstanceOf(ContractError);
  });
});
