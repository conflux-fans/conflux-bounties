// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IPriceAdapter.sol";

/**
 * @title AutomationManager
 * @notice Non-custodial automation contract for limit orders and DCA strategies on Conflux eSpace.
 *         Users retain full custody of their ERC-20 tokens via allowance-based pulls.
 *         A trusted off-chain executor (keeper) triggers execution when conditions are met.
 * @dev Safety controls enforced on-chain:
 *      - Per-job slippage cap
 *      - Per-user max active jobs
 *      - Global circuit-breaker (Pausable)
 *      - Reentrancy guard
 *      - Job expiry
 */
contract AutomationManager is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── Types ─────────────────────────────────────────────────────────────────

    enum JobType { LIMIT_ORDER, DCA }
    enum JobStatus { ACTIVE, EXECUTED, CANCELLED, EXPIRED }

    struct LimitOrderParams {
        address tokenIn;
        address tokenOut;
        uint256 amountIn;        // amount to sell
        uint256 minAmountOut;    // minimum received (slippage control)
        uint256 targetPrice;     // price in tokenOut/tokenIn scaled by 1e18
        bool triggerAbove;       // true = execute when price >= target, false = when price <= target
    }

    struct DCAParams {
        address tokenIn;
        address tokenOut;
        uint256 amountPerSwap;
        uint256 intervalSeconds;
        uint256 totalSwaps;
        uint256 swapsCompleted;
        uint256 nextExecution;   // unix timestamp
    }

    struct Job {
        bytes32 id;
        address owner;
        JobType jobType;
        JobStatus status;
        uint256 createdAt;
        uint256 expiresAt;       // 0 = no expiry
        uint256 maxSlippageBps;  // e.g. 200 = 2%
    }

    // ─── State ──────────────────────────────────────────────────────────────────

    IPriceAdapter public priceAdapter;

    /// @dev jobId => Job metadata
    mapping(bytes32 => Job) public jobs;

    /// @dev jobId => LimitOrderParams (only set for LIMIT_ORDER)
    mapping(bytes32 => LimitOrderParams) public limitOrders;

    /// @dev jobId => DCAParams (only set for DCA)
    mapping(bytes32 => DCAParams) public dcaJobs;

    /// @dev owner address => list of their job IDs (append-only, used for enumeration)
    mapping(address => bytes32[]) public userJobs;

    /// @dev owner address => count of jobs that are currently ACTIVE
    /// Incremented on creation, decremented on any terminal transition.
    mapping(address => uint256) public activeJobCount;

    /// @dev trusted keeper addresses (only they can execute)
    mapping(address => bool) public keepers;

    // ─── Configuration ──────────────────────────────────────────────────────────

    uint256 public maxJobsPerUser = 20;
    uint256 public maxSlippageBps = 500;   // 5% hard cap on-chain
    uint256 public keeperFeeFlat = 0;       // optional flat fee in tokenOut (0 = disabled)

    // ─── Events ─────────────────────────────────────────────────────────────────

    event JobCreated(bytes32 indexed jobId, address indexed owner, JobType jobType);
    event JobExecuted(bytes32 indexed jobId, address indexed keeper, uint256 amountOut);
    event JobCancelled(bytes32 indexed jobId, address indexed canceller);
    event JobExpired(bytes32 indexed jobId);
    event KeeperUpdated(address indexed keeper, bool allowed);
    event PriceAdapterUpdated(address indexed newAdapter);
    event MaxJobsPerUserUpdated(uint256 newMax);

    // ─── Errors ─────────────────────────────────────────────────────────────────

    error Unauthorized();
    error JobNotFound(bytes32 jobId);
    error JobNotActive(bytes32 jobId);
    error JobExpiredError(bytes32 jobId);
    error TooManyJobs(address user);
    error SlippageTooHigh(uint256 requested, uint256 maxAllowed);
    error PriceConditionNotMet(bytes32 jobId);
    error DCAIntervalNotReached(uint256 nextExecution);
    error DCACompleted(bytes32 jobId);
    error ZeroAddress();
    error InvalidParams(string reason);

    // ─── Modifiers ──────────────────────────────────────────────────────────────

    modifier onlyKeeper() {
        if (!keepers[msg.sender]) revert Unauthorized();
        _;
    }

    modifier jobExists(bytes32 jobId) {
        if (jobs[jobId].owner == address(0)) revert JobNotFound(jobId);
        _;
    }

    // ─── Constructor ────────────────────────────────────────────────────────────

    constructor(address _priceAdapter, address initialOwner) Ownable(initialOwner) {
        if (_priceAdapter == address(0)) revert ZeroAddress();
        priceAdapter = IPriceAdapter(_priceAdapter);
        // initial deployer is also a keeper
        keepers[initialOwner] = true;
    }

    // ─── Job Creation ───────────────────────────────────────────────────────────

    /**
     * @notice Create a limit order job.
     * @param params LimitOrderParams describing the swap conditions.
     * @param slippageBps Maximum allowed slippage in basis points.
     * @param expiresAt Unix timestamp after which the job auto-expires (0 = no expiry).
     * @return jobId A deterministic job identifier.
     */
    function createLimitOrder(
        LimitOrderParams calldata params,
        uint256 slippageBps,
        uint256 expiresAt
    ) external whenNotPaused returns (bytes32 jobId) {
        _validateSlippage(slippageBps);
        _validateLimitOrderParams(params);
        if (activeJobCount[msg.sender] >= maxJobsPerUser) revert TooManyJobs(msg.sender);
        if (expiresAt != 0 && expiresAt <= block.timestamp) revert InvalidParams("expiresAt in the past");

        jobId = keccak256(
            abi.encodePacked(msg.sender, JobType.LIMIT_ORDER, block.timestamp, params.tokenIn, params.tokenOut, params.amountIn)
        );

        jobs[jobId] = Job({
            id: jobId,
            owner: msg.sender,
            jobType: JobType.LIMIT_ORDER,
            status: JobStatus.ACTIVE,
            createdAt: block.timestamp,
            expiresAt: expiresAt,
            maxSlippageBps: slippageBps
        });
        limitOrders[jobId] = params;
        userJobs[msg.sender].push(jobId);
        activeJobCount[msg.sender]++;

        emit JobCreated(jobId, msg.sender, JobType.LIMIT_ORDER);
    }

    /**
     * @notice Create a DCA (Dollar Cost Average) job.
     * @param params DCAParams describing the recurring swap configuration.
     * @param slippageBps Maximum allowed slippage in basis points.
     * @param expiresAt Unix timestamp after which the job auto-expires (0 = no expiry).
     * @return jobId A deterministic job identifier.
     */
    function createDCAJob(
        DCAParams calldata params,
        uint256 slippageBps,
        uint256 expiresAt
    ) external whenNotPaused returns (bytes32 jobId) {
        _validateSlippage(slippageBps);
        _validateDCAParams(params);
        if (activeJobCount[msg.sender] >= maxJobsPerUser) revert TooManyJobs(msg.sender);
        if (expiresAt != 0 && expiresAt <= block.timestamp) revert InvalidParams("expiresAt in the past");

        jobId = keccak256(
            abi.encodePacked(msg.sender, JobType.DCA, block.timestamp, params.tokenIn, params.tokenOut, params.amountPerSwap)
        );

        // Copy params and set initial state
        DCAParams memory dcaParams = params;
        dcaParams.swapsCompleted = 0;
        if (dcaParams.nextExecution == 0) {
            dcaParams.nextExecution = block.timestamp; // eligible immediately
        }

        jobs[jobId] = Job({
            id: jobId,
            owner: msg.sender,
            jobType: JobType.DCA,
            status: JobStatus.ACTIVE,
            createdAt: block.timestamp,
            expiresAt: expiresAt,
            maxSlippageBps: slippageBps
        });
        dcaJobs[jobId] = dcaParams;
        userJobs[msg.sender].push(jobId);
        activeJobCount[msg.sender]++;

        emit JobCreated(jobId, msg.sender, JobType.DCA);
    }

    // ─── Job Execution ──────────────────────────────────────────────────────────

    /**
     * @notice Execute a limit order when its price condition is met.
     *         Called by a trusted keeper. The swap is routed off-chain; the
     *         keeper provides the amountOut proof and the actual swap occurs
     *         via a pre-approved DEX router allowance from the user.
     * @param jobId The limit order job to execute.
     * @param router The DEX router address (must be pre-approved by user).
     * @param swapCalldata Encoded swap call to forward to the router.
     */
    function executeLimitOrder(
        bytes32 jobId,
        address router,
        bytes calldata swapCalldata
    ) external nonReentrant whenNotPaused onlyKeeper jobExists(jobId) {
        Job storage job = jobs[jobId];
        LimitOrderParams storage params = limitOrders[jobId];

        _checkJobActive(job);
        _checkExpiry(job);

        // On-chain price check
        uint256 currentPrice = priceAdapter.getPrice(params.tokenIn, params.tokenOut);
        if (params.triggerAbove) {
            if (currentPrice < params.targetPrice) revert PriceConditionNotMet(jobId);
        } else {
            if (currentPrice > params.targetPrice) revert PriceConditionNotMet(jobId);
        }

        // Pull tokens from owner
        IERC20(params.tokenIn).safeTransferFrom(job.owner, address(this), params.amountIn);

        // Approve router
        IERC20(params.tokenIn).forceApprove(router, params.amountIn);

        // Execute swap
        uint256 balanceBefore = IERC20(params.tokenOut).balanceOf(job.owner);
        (bool success, ) = router.call(swapCalldata);
        require(success, "Swap failed");
        uint256 amountOut = IERC20(params.tokenOut).balanceOf(job.owner) - balanceBefore;

        // Slippage check
        if (amountOut < params.minAmountOut) revert InvalidParams("Slippage exceeded");

        // Revoke any leftover approval
        IERC20(params.tokenIn).forceApprove(router, 0);

        job.status = JobStatus.EXECUTED;
        activeJobCount[job.owner]--;
        emit JobExecuted(jobId, msg.sender, amountOut);
    }

    /**
     * @notice Execute one DCA tick for the given job.
     * @param jobId The DCA job to tick.
     * @param router The DEX router address.
     * @param swapCalldata Encoded swap call.
     */
    function executeDCATick(
        bytes32 jobId,
        address router,
        bytes calldata swapCalldata
    ) external nonReentrant whenNotPaused onlyKeeper jobExists(jobId) {
        Job storage job = jobs[jobId];
        DCAParams storage params = dcaJobs[jobId];

        _checkJobActive(job);
        _checkExpiry(job);

        if (params.swapsCompleted >= params.totalSwaps) revert DCACompleted(jobId);
        if (block.timestamp < params.nextExecution) revert DCAIntervalNotReached(params.nextExecution);

        // Calculate minAmountOut from slippage
        uint256 currentPrice = priceAdapter.getPrice(params.tokenIn, params.tokenOut);
        uint256 expectedOut = (params.amountPerSwap * currentPrice) / 1e18;
        uint256 minAmountOut = expectedOut * (10000 - job.maxSlippageBps) / 10000;

        // Pull tokens
        IERC20(params.tokenIn).safeTransferFrom(job.owner, address(this), params.amountPerSwap);
        IERC20(params.tokenIn).forceApprove(router, params.amountPerSwap);

        uint256 balanceBefore = IERC20(params.tokenOut).balanceOf(job.owner);
        (bool success, ) = router.call(swapCalldata);
        require(success, "Swap failed");
        uint256 amountOut = IERC20(params.tokenOut).balanceOf(job.owner) - balanceBefore;

        if (amountOut < minAmountOut) revert InvalidParams("Slippage exceeded");

        IERC20(params.tokenIn).forceApprove(router, 0);

        params.swapsCompleted++;
        params.nextExecution = block.timestamp + params.intervalSeconds;

        if (params.swapsCompleted >= params.totalSwaps) {
            job.status = JobStatus.EXECUTED;
            activeJobCount[job.owner]--;
        }

        emit JobExecuted(jobId, msg.sender, amountOut);
    }

    // ─── Job Cancellation ───────────────────────────────────────────────────────

    /**
     * @notice Cancel a job. Can be called by the job owner or the contract owner.
     */
    function cancelJob(bytes32 jobId) external jobExists(jobId) {
        Job storage job = jobs[jobId];
        if (msg.sender != job.owner && msg.sender != owner()) revert Unauthorized();
        if (job.status != JobStatus.ACTIVE) revert JobNotActive(jobId);
        job.status = JobStatus.CANCELLED;
        activeJobCount[job.owner]--;
        emit JobCancelled(jobId, msg.sender);
    }

    /**
     * @notice Mark a job as expired. Can be called by anyone once expiresAt has passed.
     */
    function expireJob(bytes32 jobId) external jobExists(jobId) {
        Job storage job = jobs[jobId];
        if (job.status != JobStatus.ACTIVE) revert JobNotActive(jobId);
        if (job.expiresAt == 0 || block.timestamp < job.expiresAt) revert InvalidParams("Not yet expired");
        job.status = JobStatus.EXPIRED;
        activeJobCount[job.owner]--;
        emit JobExpired(jobId);
    }

    // ─── Views ──────────────────────────────────────────────────────────────────

    function getUserJobs(address user) external view returns (bytes32[] memory) {
        return userJobs[user];
    }

    function getJob(bytes32 jobId) external view returns (Job memory) {
        return jobs[jobId];
    }

    function getLimitOrder(bytes32 jobId) external view returns (LimitOrderParams memory) {
        return limitOrders[jobId];
    }

    function getDCAJob(bytes32 jobId) external view returns (DCAParams memory) {
        return dcaJobs[jobId];
    }

    // ─── Admin ──────────────────────────────────────────────────────────────────

    function setKeeper(address keeper, bool allowed) external onlyOwner {
        if (keeper == address(0)) revert ZeroAddress();
        keepers[keeper] = allowed;
        emit KeeperUpdated(keeper, allowed);
    }

    function setPriceAdapter(address _priceAdapter) external onlyOwner {
        if (_priceAdapter == address(0)) revert ZeroAddress();
        priceAdapter = IPriceAdapter(_priceAdapter);
        emit PriceAdapterUpdated(_priceAdapter);
    }

    function setMaxJobsPerUser(uint256 _max) external onlyOwner {
        maxJobsPerUser = _max;
        emit MaxJobsPerUserUpdated(_max);
    }

    function setMaxSlippageBps(uint256 _maxBps) external onlyOwner {
        require(_maxBps <= 2000, "Cannot exceed 20%");
        maxSlippageBps = _maxBps;
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    // ─── Internal ───────────────────────────────────────────────────────────────

    function _checkJobActive(Job storage job) internal view {
        if (job.status != JobStatus.ACTIVE) revert JobNotActive(job.id);
    }

    function _checkExpiry(Job storage job) internal {
        if (job.expiresAt != 0 && block.timestamp >= job.expiresAt) {
            job.status = JobStatus.EXPIRED;
            activeJobCount[job.owner]--;
            emit JobExpired(job.id);
            revert JobExpiredError(job.id);
        }
    }

    function _validateSlippage(uint256 bps) internal view {
        if (bps > maxSlippageBps) revert SlippageTooHigh(bps, maxSlippageBps);
    }

    function _validateLimitOrderParams(LimitOrderParams calldata p) internal pure {
        if (p.tokenIn == address(0) || p.tokenOut == address(0)) revert ZeroAddress();
        if (p.amountIn == 0) revert InvalidParams("amountIn is zero");
        if (p.minAmountOut == 0) revert InvalidParams("minAmountOut is zero");
        if (p.targetPrice == 0) revert InvalidParams("targetPrice is zero");
    }

    function _validateDCAParams(DCAParams calldata p) internal pure {
        if (p.tokenIn == address(0) || p.tokenOut == address(0)) revert ZeroAddress();
        if (p.amountPerSwap == 0) revert InvalidParams("amountPerSwap is zero");
        if (p.intervalSeconds < 60) revert InvalidParams("interval too short (min 60s)");
        if (p.totalSwaps == 0) revert InvalidParams("totalSwaps is zero");
    }
}
