// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract TokenVesting is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Vesting parameters
    IERC20 public token;
    address public beneficiary;
    uint256 public cliff;
    uint256 public start;
    uint256 public duration;
    uint256 public totalAmount;
    uint256 public released;
    bool public revocable;
    bool public revoked;

    // Initialization flag for minimal proxy
    bool private _initialized;

    // Events
    event TokensReleased(address indexed beneficiary, uint256 amount);
    event VestingRevoked(address indexed beneficiary, uint256 unreleased);
    event VestingInitialized(
        address indexed token,
        address indexed beneficiary,
        uint256 totalAmount,
        uint256 cliff,
        uint256 duration,
        bool revocable
    );

    /**
     * @dev Constructor for minimal proxy pattern - should not be called directly
     */
    constructor() Ownable(msg.sender) {
        // This constructor is only for the implementation contract
        // Actual initialization happens in initialize() function
    }

    /**
     * @dev Initialize function for minimal proxy pattern
     * @param _token Token contract address
     * @param _beneficiary Beneficiary address
     * @param _totalAmount Total vesting amount
     * @param _cliff Cliff duration in seconds
     * @param _duration Total vesting duration in seconds
     * @param _revocable Whether vesting is revocable
     * @param _owner Owner address
     */
    function initialize(
        address _token,
        address _beneficiary,
        uint256 _totalAmount,
        uint256 _cliff,
        uint256 _duration,
        bool _revocable,
        address _owner
    ) external {
        require(!_initialized, "Already initialized");
        require(_token != address(0), "Invalid token address");
        require(_beneficiary != address(0), "Invalid beneficiary address");
        require(_totalAmount > 0, "Total amount must be greater than 0");
        require(_duration > 0, "Duration must be greater than 0");
        require(_cliff <= _duration, "Cliff cannot exceed duration");
        require(_owner != address(0), "Invalid owner address");

        token = IERC20(_token);
        beneficiary = _beneficiary;
        totalAmount = _totalAmount;
        cliff = _cliff;
        duration = _duration;
        revocable = _revocable;
        start = block.timestamp;
        released = 0;
        revoked = false;
        _initialized = true;

        _transferOwnership(_owner);

        emit VestingInitialized(
            _token,
            _beneficiary,
            _totalAmount,
            _cliff,
            _duration,
            _revocable
        );
    }

    /**
     * @dev Check if vesting contract is initialized
     */
    function isInitialized() external view returns (bool) {
        return _initialized;
    }

    /**
     * @dev Release vested tokens to beneficiary
     */
    function release() external nonReentrant {
        require(!revoked, "Vesting has been revoked");
        require(msg.sender == beneficiary || msg.sender == owner(), "Unauthorized");

        uint256 unreleased = releasableAmount();
        require(unreleased > 0, "No tokens to release");

        released += unreleased;
        token.safeTransfer(beneficiary, unreleased);

        emit TokensReleased(beneficiary, unreleased);
    }

    /**
     * @dev Revoke vesting (owner only, if revocable)
     */
    function revoke() external onlyOwner {
        require(revocable, "Vesting is not revocable");
        require(!revoked, "Vesting already revoked");

        revoked = true;
        
        // Calculate unvested amount (total amount minus vested amount)
        uint256 vested = vestedAmount();
        uint256 unvested = totalAmount - vested;
        
        if (unvested > 0) {
            token.safeTransfer(owner(), unvested);
        }

        emit VestingRevoked(beneficiary, unvested);
    }

    /**
     * @dev Calculate the amount of tokens that can be released
     * @return Amount of tokens that can be released
     */
    function releasableAmount() public view returns (uint256) {
        return vestedAmount() - released;
    }

    /**
     * @dev Calculate the total amount of tokens that have vested
     * @return Total vested amount
     */
    function vestedAmount() public view returns (uint256) {
        if (revoked) {
            return 0;
        }

        uint256 currentTime = block.timestamp;
        
        // Before cliff ends, no tokens are vested
        if (currentTime < start + cliff) {
            return 0;
        }
        
        // After duration, all tokens are vested
        if (currentTime >= start + duration) {
            return totalAmount;
        }
        
        // During linear vesting period (after cliff but before end)
        uint256 timeElapsed = currentTime - start - cliff;
        uint256 vestingDuration = duration - cliff;
        
        // Calculate linear portion: (timeElapsed / vestingDuration) * totalAmount
        uint256 linearAmount = (totalAmount * timeElapsed) / vestingDuration;
        
        return linearAmount;
    }

    /**
     * @dev Get vesting information
     * @return _token Token address
     * @return _beneficiary Beneficiary address
     * @return _totalAmount Total vesting amount
     * @return _released Released amount
     * @return _cliff Cliff duration
     * @return _start Start time
     * @return _duration Total duration
     * @return _revocable Whether revocable
     * @return _revoked Whether revoked
     */
    function getVestingInfo() external view returns (
        address _token,
        address _beneficiary,
        uint256 _totalAmount,
        uint256 _released,
        uint256 _cliff,
        uint256 _start,
        uint256 _duration,
        bool _revocable,
        bool _revoked
    ) {
        return (
            address(token),
            beneficiary,
            totalAmount,
            released,
            cliff,
            start,
            duration,
            revocable,
            revoked
        );
    }

    /**
     * @dev Get current vesting status
     * @return _vestedAmount Total vested amount
     * @return _releasableAmount Releasable amount
     * @return _remainingAmount Remaining amount
     * @return _timeElapsed Time elapsed since start
     * @return _timeRemaining Time remaining until full vesting
     */
    function getVestingStatus() external view returns (
        uint256 _vestedAmount,
        uint256 _releasableAmount,
        uint256 _remainingAmount,
        uint256 _timeElapsed,
        uint256 _timeRemaining
    ) {
        uint256 currentTime = block.timestamp;
        uint256 timeElapsed = currentTime > start ? currentTime - start : 0;
        uint256 timeRemaining = currentTime < start + duration ? start + duration - currentTime : 0;
        
        return (
            vestedAmount(),
            releasableAmount(),
            totalAmount - released,
            timeElapsed,
            timeRemaining
        );
    }

    /**
     * @dev Check if vesting has started
     * @return True if vesting has started
     */
    function hasStarted() external view returns (bool) {
        return block.timestamp >= start;
    }

    /**
     * @dev Check if cliff period has ended
     * @return True if cliff period has ended
     */
    function cliffEnded() external view returns (bool) {
        return block.timestamp >= start + cliff;
    }

    /**
     * @dev Check if vesting has ended
     * @return True if vesting has ended
     */
    function hasEnded() external view returns (bool) {
        return block.timestamp >= start + duration;
    }

    /**
     * @dev Emergency function to recover tokens sent to this contract by mistake
     * @param _token Token address to recover
     * @param _amount Amount to recover
     */
    function emergencyRecover(address _token, uint256 _amount) external onlyOwner {
        require(_token != address(token), "Cannot recover vesting token");
        IERC20(_token).safeTransfer(owner(), _amount);
    }
} 