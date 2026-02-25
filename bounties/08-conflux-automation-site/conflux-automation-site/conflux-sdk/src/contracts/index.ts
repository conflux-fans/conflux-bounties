// @cfxdevkit/sdk - Contracts module
// Contract deployment, reading, writing, and standard ABIs

// Standard ABIs
export { ERC20_ABI } from './abis/erc20.js';
export { ERC721_ABI } from './abis/erc721.js';
export { ERC1155_ABI } from './abis/erc1155.js';

// Deployer
export { ContractDeployer } from './deployer/deploy.js';

// Interaction
export { ContractReader } from './interaction/reader.js';
export { ContractWriter } from './interaction/writer.js';

// Types
export type {
  ContractInfo,
  DeploymentOptions,
  DeploymentResult,
  ERC20TokenInfo,
  ERC721TokenInfo,
  EventFilter,
  EventLog,
  MultiChainDeploymentOptions,
  MultiChainDeploymentResult,
  NFTMetadata,
  ReadOptions,
  WriteOptions,
  WriteResult,
} from './types/index.js';

export {
  ContractError,
  DeploymentError,
  InteractionError,
} from './types/index.js';
