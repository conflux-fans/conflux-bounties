// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title JobManager
 * @notice Non-custodial automation contract for limit orders and DCA strategies on Conflux eSpace
 * @dev Never holds custody of user funds - uses allowances and permits
 */
contract JobManager is Pausable, Ownable, ReentrancyGuard {
    
    enum JobType { LIMIT_BUY, LIMIT_SELL, DCA_BUY, DCA_SELL }
    enum JobStatus { ACTIVE, PAUSED, CANCELLED, COMPLETED }
    
    struct Job {
        address owner;
        JobType jobType;
        address tokenIn;
        address tokenOut;
        uint256 amount;
        uint256 targetPrice;      // Target price in USD (18 decimals)
        uint256 maxSlippage;      // Basis points (e.g., 100 = 1%)
        uint256 interval;         // Time interval for DCA in seconds
        uint256 nextExecution;    // Next execution timestamp
        uint256 executions;       // Number of times executed
        uint256 maxExecutions;    // Max executions for DCA (0 = unlimited)
        JobStatus status;
        uint256 createdAt;
    }
    
    // Mapping from job ID to Job struct
    mapping(uint256 => Job) public jobs;
    
    // Mapping from user to their job IDs
    mapping(address => uint256[]) public userJobs;
    
    // Mapping to track authorized executors
    mapping(address => bool) public executors;
    
    // Counter for job IDs
    uint256 private _jobCounter;
    
    // Events
    event JobCreated(
        uint256 indexed jobId,
        address indexed owner,
        JobType jobType,
        address tokenIn,
        address tokenOut,
        uint256 amount,
        uint256 targetPrice
    );
    
    event JobExecuted(
        uint256 indexed jobId,
        address indexed owner,
        uint256 amountIn,
        uint256 amountOut,
        uint256 executionTime
    );
    
    event JobCancelled(uint256 indexed jobId, address indexed owner);
    event JobPaused(uint256 indexed jobId, address indexed owner);
    event JobResumed(uint256 indexed jobId, address indexed owner);
    event ExecutorAdded(address indexed executor);
    event ExecutorRemoved(address indexed executor);
    
    modifier onlyExecutor() {
        require(executors[msg.sender] || msg.sender == owner(), "Not authorized executor");
        _;
    }
    
    constructor() Ownable(msg.sender) {}
    
    /**
     * @notice Create a new automation job
     * @param jobType Type of job (limit buy/sell, DCA)
     * @param tokenIn Input token address
     * @param tokenOut Output token address
     * @param amount Amount to trade per execution
     * @param targetPrice Target price for limit orders (0 for DCA)
     * @param maxSlippage Maximum slippage in basis points
     * @param interval Time interval for DCA in seconds (0 for limit orders)
     * @param maxExecutions Maximum number of executions for DCA (0 = unlimited)
     */
    function createJob(
        JobType jobType,
        address tokenIn,
        address tokenOut,
        uint256 amount,
        uint256 targetPrice,
        uint256 maxSlippage,
        uint256 interval,
        uint256 maxExecutions
    ) external whenNotPaused returns (uint256 jobId) {
        require(tokenIn != address(0) && tokenOut != address(0), "Invalid token addresses");
        require(amount > 0, "Amount must be greater than 0");
        require(maxSlippage <= 5000, "Slippage too high"); // Max 50%
        
        jobId = ++_jobCounter;
        
        Job storage newJob = jobs[jobId];
        newJob.owner = msg.sender;
        newJob.jobType = jobType;
        newJob.tokenIn = tokenIn;
        newJob.tokenOut = tokenOut;
        newJob.amount = amount;
        newJob.targetPrice = targetPrice;
        newJob.maxSlippage = maxSlippage;
        newJob.interval = interval;
        newJob.nextExecution = block.timestamp + interval;
        newJob.executions = 0;
        newJob.maxExecutions = maxExecutions;
        newJob.status = JobStatus.ACTIVE;
        newJob.createdAt = block.timestamp;
        
        userJobs[msg.sender].push(jobId);
        
        emit JobCreated(jobId, msg.sender, jobType, tokenIn, tokenOut, amount, targetPrice);
    }
    
    /**
     * @notice Execute a job (called by authorized executor)
     * @param jobId The job ID to execute
     * @param amountOut The amount of output tokens received
     * @param currentPrice The current price at execution time
     */
    function executeJob(
        uint256 jobId,
        uint256 amountOut,
        uint256 currentPrice
    ) external onlyExecutor whenNotPaused nonReentrant {
        Job storage job = jobs[jobId];
        
        require(job.status == JobStatus.ACTIVE, "Job not active");
        require(job.owner != address(0), "Job does not exist");
        
        // For limit orders, check if price target is met
        if (job.jobType == JobType.LIMIT_BUY || job.jobType == JobType.LIMIT_SELL) {
            require(currentPrice <= job.targetPrice + (job.targetPrice * job.maxSlippage / 10000), 
                "Price target not met");
        }
        
        // For DCA, check if interval has passed
        if (job.jobType == JobType.DCA_BUY || job.jobType == JobType.DCA_SELL) {
            require(block.timestamp >= job.nextExecution, "Too early for execution");
        }
        
        // Check max executions
        if (job.maxExecutions > 0) {
            require(job.executions < job.maxExecutions, "Max executions reached");
        }
        
        // Transfer tokens from user to executor (uses pre-approved allowance)
        IERC20(job.tokenIn).transferFrom(job.owner, msg.sender, job.amount);
        
        // Update job state
        job.executions++;
        job.nextExecution = block.timestamp + job.interval;
        
        // Mark as completed if max executions reached
        if (job.maxExecutions > 0 && job.executions >= job.maxExecutions) {
            job.status = JobStatus.COMPLETED;
        }
        
        emit JobExecuted(jobId, job.owner, job.amount, amountOut, block.timestamp);
    }
    
    /**
     * @notice Execute job with permit signature (EIP-2612)
     * @param jobId The job ID to execute
     * @param amountOut The amount of output tokens received
     * @param currentPrice The current price at execution time
     * @param deadline Permit deadline
     * @param v,r,s Permit signature components
     */
    function executeJobWithPermit(
        uint256 jobId,
        uint256 amountOut,
        uint256 currentPrice,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external onlyExecutor whenNotPaused nonReentrant {
        Job storage job = jobs[jobId];
        
        require(job.status == JobStatus.ACTIVE, "Job not active");
        require(job.owner != address(0), "Job does not exist");
        
        // Validate price and timing (same as executeJob)
        if (job.jobType == JobType.LIMIT_BUY || job.jobType == JobType.LIMIT_SELL) {
            require(currentPrice <= job.targetPrice + (job.targetPrice * job.maxSlippage / 10000), 
                "Price target not met");
        }
        
        if (job.jobType == JobType.DCA_BUY || job.jobType == JobType.DCA_SELL) {
            require(block.timestamp >= job.nextExecution, "Too early for execution");
        }
        
        if (job.maxExecutions > 0) {
            require(job.executions < job.maxExecutions, "Max executions reached");
        }
        
        // Use permit to get approval
        IERC20Permit(job.tokenIn).permit(
            job.owner,
            address(this),
            job.amount,
            deadline,
            v, r, s
        );
        
        // Transfer tokens
        IERC20(job.tokenIn).transferFrom(job.owner, msg.sender, job.amount);
        
        // Update job state
        job.executions++;
        job.nextExecution = block.timestamp + job.interval;
        
        if (job.maxExecutions > 0 && job.executions >= job.maxExecutions) {
            job.status = JobStatus.COMPLETED;
        }
        
        emit JobExecuted(jobId, job.owner, job.amount, amountOut, block.timestamp);
    }
    
    /**
     * @notice Cancel a job
     * @param jobId The job ID to cancel
     */
    function cancelJob(uint256 jobId) external {
        Job storage job = jobs[jobId];
        
        require(job.owner == msg.sender, "Not job owner");
        require(job.status == JobStatus.ACTIVE || job.status == JobStatus.PAUSED, "Job not cancellable");
        
        job.status = JobStatus.CANCELLED;
        
        emit JobCancelled(jobId, msg.sender);
    }
    
    /**
     * @notice Pause a job
     * @param jobId The job ID to pause
     */
    function pauseJob(uint256 jobId) external {
        Job storage job = jobs[jobId];
        
        require(job.owner == msg.sender, "Not job owner");
        require(job.status == JobStatus.ACTIVE, "Job not active");
        
        job.status = JobStatus.PAUSED;
        
        emit JobPaused(jobId, msg.sender);
    }
    
    /**
     * @notice Resume a paused job
     * @param jobId The job ID to resume
     */
    function resumeJob(uint256 jobId) external {
        Job storage job = jobs[jobId];
        
        require(job.owner == msg.sender, "Not job owner");
        require(job.status == JobStatus.PAUSED, "Job not paused");
        
        job.status = JobStatus.ACTIVE;
        
        emit JobResumed(jobId, msg.sender);
    }
    
    /**
     * @notice Get all jobs for a user
     * @param user User address
     * @return Array of job IDs
     */
    function getUserJobs(address user) external view returns (uint256[] memory) {
        return userJobs[user];
    }
    
    /**
     * @notice Get job details
     * @param jobId Job ID
     */
    function getJob(uint256 jobId) external view returns (Job memory) {
        return jobs[jobId];
    }
    
    // Admin functions
    
    /**
     * @notice Add an authorized executor
     * @param executor Executor address
     */
    function addExecutor(address executor) external onlyOwner {
        executors[executor] = true;
        emit ExecutorAdded(executor);
    }
    
    /**
     * @notice Remove an authorized executor
     * @param executor Executor address
     */
    function removeExecutor(address executor) external onlyOwner {
        executors[executor] = false;
        emit ExecutorRemoved(executor);
    }
    
    /**
     * @notice Pause all jobs (emergency)
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @notice Unpause all jobs
     */
    function unpause() external onlyOwner {
        _unpause();
    }
}
