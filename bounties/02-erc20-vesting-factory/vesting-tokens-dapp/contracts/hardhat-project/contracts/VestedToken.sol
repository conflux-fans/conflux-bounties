// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract VestedToken is ERC20, Ownable, Pausable {
    // Token metadata
    string private _name;
    string private _symbol;
    uint8 private _decimals;

    // Vesting tracking
    mapping(address => uint256) public vestedBalances;
    mapping(address => bool) public vestingContracts;

    // Allocation management
    mapping(string => uint256) public categoryAllocations;
    mapping(address => string) public beneficiaryCategories;

    // Initialization flag for minimal proxy
    bool private _initialized;
    
    // ✅ FACTORY ADDRESS FOR ACCESS CONTROL
    address public immutable factory;

    // Events
    event VestingContractAdded(address indexed vestingContract);
    event VestingContractRemoved(address indexed vestingContract);
    event CategoryAllocationSet(string category, uint256 amount);
    event BeneficiaryCategorySet(address indexed beneficiary, string category);
    event TokenInitialized(string name, string symbol, uint256 totalSupply, address owner);

    /**
     * @dev Constructor for minimal proxy pattern - should not be called directly
     * Sets the factory address to the deployer (TokenVestingFactory)
     */
    constructor() ERC20("", "") Ownable(msg.sender) {
        // ✅ SET FACTORY ADDRESS - only factory can initialize clones
        factory = msg.sender;
        // This constructor is only for the implementation contract
        // Actual initialization happens in initialize() function
    }

    /**
     * @dev Initialize function for minimal proxy pattern
     * @param name_ Token name
     * @param symbol_ Token symbol
     * @param totalSupply_ Total token supply
     * @param owner_ Token owner address
     */
    function initialize(
        string memory name_,
        string memory symbol_,
        uint256 totalSupply_,
        address owner_
    ) external {
        // ✅ CRITICAL: ONLY FACTORY CAN INITIALIZE
        require(msg.sender == factory, "Only factory can initialize");
        require(!_initialized, "Already initialized");
        require(bytes(name_).length > 0, "Name cannot be empty");
        require(bytes(symbol_).length > 0, "Symbol cannot be empty");
        require(totalSupply_ > 0, "Total supply must be greater than 0");
        require(owner_ != address(0), "Invalid owner address");

        _name = name_;
        _symbol = symbol_;
        _decimals = 18;

        _transferOwnership(owner_);
        _mint(owner_, totalSupply_);
        _initialized = true;

        emit TokenInitialized(name_, symbol_, totalSupply_, owner_);
    }

    /**
     * @dev Returns the name of the token
     */
    function name() public view virtual override returns (string memory) {
        return _name;
    }

    /**
     * @dev Returns the symbol of the token
     */
    function symbol() public view virtual override returns (string memory) {
        return _symbol;
    }

    /**
     * @dev Returns the number of decimals used to get its user representation
     */
    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    /**
     * @dev Check if token is initialized
     */
    function isInitialized() external view returns (bool) {
        return _initialized;
    }

    /**
     * @dev Add a vesting contract address
     * @param vestingContract Address of the vesting contract
     */
    function addVestingContract(address vestingContract) external onlyOwner {
        require(vestingContract != address(0), "Invalid vesting contract");
        require(!vestingContracts[vestingContract], "Vesting contract already added");

        vestingContracts[vestingContract] = true;
        emit VestingContractAdded(vestingContract);
    }

    /**
     * @dev Remove a vesting contract address
     * @param vestingContract Address of the vesting contract
     */
    function removeVestingContract(address vestingContract) external onlyOwner {
        require(vestingContracts[vestingContract], "Vesting contract not found");

        vestingContracts[vestingContract] = false;
        emit VestingContractRemoved(vestingContract);
    }

    /**
     * @dev Set allocation for a category
     * @param category Category name
     * @param amount Allocation amount
     */
    function setCategoryAllocation(string memory category, uint256 amount) external onlyOwner {
        require(bytes(category).length > 0, "Category cannot be empty");
        require(amount > 0, "Amount must be greater than 0");

        categoryAllocations[category] = amount;
        emit CategoryAllocationSet(category, amount);
    }

    /**
     * @dev Set beneficiary category
     * @param beneficiary Beneficiary address
     * @param category Category name
     */
    function setBeneficiaryCategory(address beneficiary, string memory category) external onlyOwner {
        require(beneficiary != address(0), "Invalid beneficiary address");
        require(bytes(category).length > 0, "Category cannot be empty");

        beneficiaryCategories[beneficiary] = category;
        emit BeneficiaryCategorySet(beneficiary, category);
    }

    /**
     * @dev Mint tokens with vesting allocation
     * @param to Recipient address
     * @param amount Token amount
     * @param vestingContract Vesting contract address
     */
    function mintWithVesting(
        address to,
        uint256 amount,
        address vestingContract
    ) external onlyOwner {
        require(to != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be greater than 0");
        require(vestingContracts[vestingContract], "Invalid vesting contract");

        vestedBalances[to] += amount;
        _mint(vestingContract, amount);
    }

    /**
     * @dev Get vested balance for an address
     * @param account Address to check
     * @return Vested balance amount
     */
    function getVestedBalance(address account) external view returns (uint256) {
        return vestedBalances[account];
    }

    /**
     * @dev Get category allocation
     * @param category Category name
     * @return Allocation amount
     */
    function getCategoryAllocation(string memory category) external view returns (uint256) {
        return categoryAllocations[category];
    }

    /**
     * @dev Get beneficiary category
     * @param beneficiary Beneficiary address
     * @return Category name
     */
    function getBeneficiaryCategory(address beneficiary) external view returns (string memory) {
        return beneficiaryCategories[beneficiary];
    }

    /**
     * @dev Pause token transfers
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpause token transfers
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Burn tokens (owner only)
     * @param amount Amount to burn
     */
    function burn(uint256 amount) external onlyOwner {
        _burn(msg.sender, amount);
    }

    /**
     * @dev Burn tokens from specific address (owner only)
     * @param from Address to burn from
     * @param amount Amount to burn
     */
    function burnFrom(address from, uint256 amount) external onlyOwner {
        _burn(from, amount);
    }
}