// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "./VestedToken.sol";
import "./TokenVesting.sol";

/**
 * @title TokenVestingFactory
 * @dev Factory contract for deploying ERC20 tokens with vesting schedules
 * Uses minimal proxy pattern for gas-efficient deployment
 */
contract TokenVestingFactory is Ownable, ReentrancyGuard {
    using Clones for address;

    // Implementation contracts for minimal proxy pattern
    VestedToken public tokenImplementation;
    TokenVesting public vestingImplementation;
    
    // Deployment tracking
    mapping(address => bool) public deployedTokens;
    mapping(address => address[]) public tokenVestingContracts;
    mapping(bytes32 => BatchDeployment) public batchDeployments;
    
    // Batch deployment counter
    uint256 public batchCounter;
    
    // Events
    event TokenDeployed(
        address indexed token,
        address indexed owner,
        string name,
        string symbol,
        uint256 totalSupply
    );
    
    event VestingDeployed(
        address indexed token,
        address indexed vestingContract,
        address indexed beneficiary,
        uint256 amount,
        uint256 cliff,
        uint256 duration
    );
    
    event BatchDeploymentCreated(
        bytes32 indexed batchId,
        address indexed creator,
        uint256 tokenCount,
        uint256 totalVestingSchedules
    );
    
    event BatchDeploymentCompleted(
        bytes32 indexed batchId,
        address[] tokens,
        address[][] vestingContracts
    );
    
    event FactoryInitialized();
    event ImplementationUpdated(address indexed implementation, string contractType);

    // Structs
    struct TokenConfig {
        string name;
        string symbol;
        uint256 totalSupply;
        address owner;
    }

    struct VestingConfig {
        address beneficiary;
        uint256 amount;
        uint256 cliff;
        uint256 duration;
        bool revocable;
    }
    
    struct BatchDeployment {
        address creator;
        uint256 tokenCount;
        uint256 totalVestingSchedules;
        bool completed;
        address[] tokens;
        address[][] vestingContracts;
        uint256 createdAt;
    }

    /**
     * @dev Constructor - deploys implementation contracts
     */
    constructor() Ownable(msg.sender){
        // Deploy implementation contracts
        tokenImplementation = new VestedToken();
        vestingImplementation = new TokenVesting();
        
        emit FactoryInitialized();
        emit ImplementationUpdated(address(tokenImplementation), "Token");
        emit ImplementationUpdated(address(vestingImplementation), "Vesting");
    }

    /**
     * @dev Deploy a new ERC20 token with vesting schedules using minimal proxy
     * @param tokenConfig Token configuration parameters
     * @param vestingConfigs Array of vesting configurations
     * @return token Address of the deployed token
     * @return vestingContracts Array of deployed vesting contract addresses
     */
    function deployTokenWithVesting(
        TokenConfig memory tokenConfig,
        VestingConfig[] memory vestingConfigs
    ) public nonReentrant returns (address token, address[] memory vestingContracts) {
        return _deployTokenWithVesting(tokenConfig, vestingConfigs);
    }

    /**
     * @dev Internal function to deploy a new ERC20 token with vesting schedules
     * @param tokenConfig Token configuration parameters
     * @param vestingConfigs Array of vesting configurations
     * @return token Address of the deployed token
     * @return vestingContracts Array of deployed vesting contract addresses
     */
    function _deployTokenWithVesting(
        TokenConfig memory tokenConfig,
        VestingConfig[] memory vestingConfigs
    ) internal returns (address token, address[] memory vestingContracts) {
        require(vestingConfigs.length > 0, "At least one vesting schedule required");
        
        // Deploy token using minimal proxy
        token = address(tokenImplementation).clone();
        VestedToken(token).initialize(
            tokenConfig.name,
            tokenConfig.symbol,
            tokenConfig.totalSupply,
            tokenConfig.owner
        );
        
        deployedTokens[token] = true;
        vestingContracts = new address[](vestingConfigs.length);
        
        // Deploy vesting contracts using minimal proxy
        for (uint256 i = 0; i < vestingConfigs.length; i++) {
            VestingConfig memory config = vestingConfigs[i];
            
            // Validate vesting configuration
            require(config.beneficiary != address(0), "Invalid beneficiary");
            require(config.amount > 0, "Invalid vesting amount");
            require(config.duration > 0, "Invalid vesting duration");
            
            // Deploy vesting contract using minimal proxy
            address vestingContract = address(vestingImplementation).clone();
            TokenVesting(vestingContract).initialize(
                token,
                config.beneficiary,
                config.amount,
                config.cliff,
                config.duration,
                config.revocable,
                tokenConfig.owner
            );
            
            vestingContracts[i] = vestingContract;
            tokenVestingContracts[token].push(vestingContract);
            
            emit VestingDeployed(
                token,
                vestingContract,
                config.beneficiary,
                config.amount,
                config.cliff,
                config.duration
            );
        }
        
        emit TokenDeployed(
            token,
            tokenConfig.owner,
            tokenConfig.name,
            tokenConfig.symbol,
            tokenConfig.totalSupply
        );
    }

    /**
     * @dev Batch deploy multiple tokens with vesting schedules
     * @param tokenConfigs Array of token configurations
     * @param vestingConfigsArray Array of vesting configurations for each token
     * @return batchId Unique batch deployment identifier
     * @return tokens Array of deployed token addresses
     * @return vestingContractsArray Array of vesting contract addresses for each token
     */
    function batchDeployTokens(
        TokenConfig[] memory tokenConfigs,
        VestingConfig[][] memory vestingConfigsArray
    ) external nonReentrant returns (
        bytes32 batchId,
        address[] memory tokens,
        address[][] memory vestingContractsArray
    ) {
        require(tokenConfigs.length > 0, "At least one token required");
        require(tokenConfigs.length == vestingConfigsArray.length, "Config arrays length mismatch");
        
        // Generate batch ID
        batchId = keccak256(abi.encodePacked(
            block.timestamp,
            msg.sender,
            batchCounter++
        ));
        
        uint256 totalVestingSchedules = 0;
        tokens = new address[](tokenConfigs.length);
        vestingContractsArray = new address[][](tokenConfigs.length);
        
        // Deploy each token with its vesting schedules
        for (uint256 i = 0; i < tokenConfigs.length; i++) {
            (address token, address[] memory vestingContracts) = _deployTokenWithVesting(
                tokenConfigs[i],
                vestingConfigsArray[i]
            );
            
            tokens[i] = token;
            vestingContractsArray[i] = vestingContracts;
            totalVestingSchedules += vestingContracts.length;
        }
        
        // Store batch deployment info
        batchDeployments[batchId] = BatchDeployment({
            creator: msg.sender,
            tokenCount: tokenConfigs.length,
            totalVestingSchedules: totalVestingSchedules,
            completed: true,
            tokens: tokens,
            vestingContracts: vestingContractsArray,
            createdAt: block.timestamp
        });
        
        emit BatchDeploymentCreated(batchId, msg.sender, tokenConfigs.length, totalVestingSchedules);
        emit BatchDeploymentCompleted(batchId, tokens, vestingContractsArray);
    }

    /**
     * @dev Get batch deployment information
     * @param batchId Batch deployment identifier
     * @return Batch deployment details
     */
    function getBatchDeployment(bytes32 batchId) external view returns (BatchDeployment memory) {
        return batchDeployments[batchId];
    }

    /**
     * @dev Get all vesting contracts for a specific token
     * @param token Address of the token
     * @return Array of vesting contract addresses
     */
    function getTokenVestingContracts(address token) external view returns (address[] memory) {
        return tokenVestingContracts[token];
    }

    /**
     * @dev Check if a token was deployed by this factory
     * @param token Address of the token to check
     * @return True if deployed by this factory
     */
    function isDeployedToken(address token) external view returns (bool) {
        return deployedTokens[token];
    }

    /**
     * @dev Update implementation contracts (owner only)
     * @param newTokenImpl New token implementation address
     * @param newVestingImpl New vesting implementation address
     */
    function updateImplementations(
        address newTokenImpl,
        address newVestingImpl
    ) external onlyOwner {
        require(newTokenImpl != address(0), "Invalid token implementation");
        require(newVestingImpl != address(0), "Invalid vesting implementation");
        
        tokenImplementation = VestedToken(newTokenImpl);
        vestingImplementation = TokenVesting(newVestingImpl);
        
        emit ImplementationUpdated(newTokenImpl, "Token");
        emit ImplementationUpdated(newVestingImpl, "Vesting");
    }

    /**
     * @dev Get implementation contract addresses
     * @return tokenImpl Token implementation address
     * @return vestingImpl Vesting implementation address
     */
    function getImplementations() external view returns (address tokenImpl, address vestingImpl) {
        return (address(tokenImplementation), address(vestingImplementation));
    }
} 