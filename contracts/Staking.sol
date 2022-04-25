pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

//todo arefev: stakeWithdrawalTimeout может быть установлен только через DAO
contract Staking {

    IERC20 public rewardToken;

    IERC20 public stakingToken;

    /**
     * @dev The stakes for each stakeholder.
     */
    mapping(address => uint256) private stakes;

    /**
     * @dev Stores last stake update dates
     */
    mapping(address => uint256) private lastStakeDates;

    /**
     * @dev The reward for each stakeholder.
     */
    mapping(address => uint256) private rewards;

    /**
     * @dev Stores last dates of reward updates
     */
    mapping(address => uint256) private rewardUpdateDates;

    /**
     * @dev The reward percentage
     */
    uint8 public rewardPercentage;

    /**
     * @dev The reward period in seconds
     */
    uint256 public rewardPeriod;

    /**
     * @dev The stake withdrawal timeout in seconds
     */
    uint256 public stakeWithdrawalTimeout;

    uint256 public totalStake;

    //todo arefev: should the owner be == dao?
    address public owner;

    modifier onlyOwner() {
        require(msg.sender == owner, "Caller is not the owner");
        _;
    }

    constructor (
        address _stakingToken,
        address _rewardToken,
        uint8 _rewardPercentage,
        uint256 _rewardPeriod,
        uint256 _stakeWithdrawalTimeout
    ) public {
        owner = msg.sender;
        setRewardPercentage(_rewardPercentage);
        setRewardPeriod(_rewardPeriod);
        setStakeWithdrawalTimeout(_stakeWithdrawalTimeout);
        stakingToken = IERC20(_stakingToken);
        rewardToken = IERC20(_rewardToken);
    }

    /**
     * @notice Transfers the `amount` of tokens from `msg.sender` address to the StakingContract address
     * @param amount the amount of tokens to stake
     */
    function stake(uint256 amount) external {
        _updateReward();

        stakes[msg.sender] += amount;
        totalStake += amount;

        lastStakeDates[msg.sender] = block.timestamp;
        require(stakingToken.transferFrom(msg.sender, address(this), amount), "Reward token transfer failed");
    }

    /**
     * @notice Transfers the reward tokens if any to the `msg.sender` address
     */
    function claim() external {
        _updateReward();

        uint256 reward = rewards[msg.sender];

        require(reward > 0, "No reward for the caller");

        rewards[msg.sender] = 0;
        require(rewardToken.transfer(msg.sender, reward), "Reward token transfer failed");
    }

    //todo arefev: forbid withdraw if there msg.sender is participating in voting
    /**
     * @notice Transfers staked tokens if any to the `msg.sender` address
     */
    function unstake() external {
        require(stakes[msg.sender] > 0, "The caller has nothing at stake");

        uint256 lastStakeDate = lastStakeDates[msg.sender];
        require(block.timestamp - lastStakeDate >= stakeWithdrawalTimeout, "Timeout is not met");

        _updateReward();
        uint256 amount = stakes[msg.sender];
        stakes[msg.sender] = 0;
        totalStake -= amount;
        require(stakingToken.transfer(msg.sender, amount), "Staking token transfer failed");
    }


    /**
     * @notice Sets the reward percentage
     * @param _rewardPercentage is the reward percentage to be set
     */
    function setRewardPercentage(uint8 _rewardPercentage) public onlyOwner {
        require(_rewardPercentage > 0, "Percentage can not be 0");
        require(_rewardPercentage < 100, "Percentage can not exceed 100%");
        rewardPercentage = _rewardPercentage;
    }

    /**
     * @notice Sets the reward period
     * @param _rewardPeriod is the reward period to be set
     */
    function setRewardPeriod(uint256 _rewardPeriod) public onlyOwner {
        require(_rewardPeriod > 0, "Reward period can not be zero");
        rewardPeriod = _rewardPeriod;
    }

    /**
     * @notice Sets the stake withdrawal timeout
     * @param _stakeWithdrawalTimeout is the stake withdrawal timeout to be set
     */
    function setStakeWithdrawalTimeout(uint256 _stakeWithdrawalTimeout) public onlyOwner {
        stakeWithdrawalTimeout = _stakeWithdrawalTimeout;
    }

    /**
     * @notice Returns the total amount of staked tokens for the `stakeholder`
     * @param stakeholder is the address of the stakeholder
     * @return the total amount of staked tokens for the `stakeholder`
     */
    function getStake(address stakeholder) public view returns (uint256) {
        return stakes[stakeholder];
    }

    /**
     * @notice Transfers ownership of the StakingContract to `to` address
     * @param to is the address which should receive an ownership
     */
    function transferOwnership(address to) external onlyOwner {
        require(to != address(0), "The zero address is not allowed");
        owner = to;
    }

    function _updateReward() internal {
        if (stakes[msg.sender] == 0) {
            rewardUpdateDates[msg.sender] = block.timestamp;
            return;
        }

        uint256 rewardPeriods = (block.timestamp - rewardUpdateDates[msg.sender]) / rewardPeriod;
        uint256 reward = stakes[msg.sender] * rewardPeriods * rewardPercentage / 100;
        rewards[msg.sender] += reward;
        rewardUpdateDates[msg.sender] = block.timestamp;
    }
}
