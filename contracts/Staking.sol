//SPDX-License-Identifier: Unlicensed

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./DAO.sol";

contract Staking {

    /**
     * @dev Represents a stakeholder
     */
    struct Stakeholder {
        uint256 stake;
        uint256 lastStakeDate;
        uint256 reward;
        uint256 rewardUpdateDate;
    }

    IERC20 public rewardToken; //todo arefev: public?

    IERC20 public stakingToken;

    /**
     * @dev A mapping "stakholder address => Stakeholder"
     */
    mapping(address => Stakeholder) stakeholders;

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

    /**
     * @dev Total value locked
     */
    uint256 public totalStake;

    /**
     * @dev Contract owner address
     */
    address public owner;

    /**
     * @dev The DAO which uses this contract to perform voting
     */
    DAO private dao; //todo arefev: interface;

    modifier onlyOwner() {
        require(msg.sender == owner, "Caller is not the owner");
        _;
    }

    modifier onlyDAO() {
        require(msg.sender == address(dao), "Caller is not the DAO");
        _;
    }

    constructor (
        address _stakingToken,
        address _rewardToken,
        uint8 _rewardPercentage,
        uint256 _rewardPeriod,
        uint256 _stakeWithdrawalTimeout,
        address _dao
    ) public {
        owner = msg.sender;
        setRewardPercentage(_rewardPercentage);
        setRewardPeriod(_rewardPeriod);
        setStakeWithdrawalTimeout(_stakeWithdrawalTimeout);
        dao = DAO(_dao);
        stakingToken = IERC20(_stakingToken);
        rewardToken = IERC20(_rewardToken);
    }

    /**
     * @notice Transfers the `amount` of tokens from `msg.sender` address to the StakingContract address
     * @param amount the amount of tokens to stake
     */
    function stake(uint256 amount) external {
        Stakeholder storage stakeholder = stakeholders[msg.sender];

        _updateReward();

        stakeholder.stake += amount;
        totalStake += amount;

        stakeholder.lastStakeDate = block.timestamp;
        require(stakingToken.transferFrom(msg.sender, address(this), amount), "Reward token transfer failed");
    }

    /**
     * @notice Transfers the reward tokens if any to the `msg.sender` address
     */
    function claim() external {
        Stakeholder storage stakeholder = stakeholders[msg.sender];

        _updateReward();

        uint256 reward = stakeholder.reward;

        require(reward > 0, "No reward for the caller");

        stakeholder.reward = 0;
        require(rewardToken.transfer(msg.sender, reward), "Reward token transfer failed");
    }

    /**
     * @notice Transfers staked tokens if any to the `msg.sender` address
     */
    function unstake() external {
        Stakeholder storage stakeholder = stakeholders[msg.sender];

        require(stakeholder.stake > 0, "The caller has nothing at stake");

        uint256 lastStakeDate = stakeholder.lastStakeDate;
        require(block.timestamp - lastStakeDate >= stakeWithdrawalTimeout, "Timeout is not met");
        require(!dao.isParticipant(msg.sender), "A proposal participant");

        _updateReward();
        uint256 amount = stakeholder.stake;
        stakeholder.stake = 0;
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
    function setStakeWithdrawalTimeout(uint256 _stakeWithdrawalTimeout) public onlyDAO {
        stakeWithdrawalTimeout = _stakeWithdrawalTimeout;
    }

    /**
     * @notice Returns the total amount of staked tokens for the `stakeholder`
     * @param stakeholder is the address of the stakeholder
     * @return the total amount of staked tokens for the `stakeholder`
     */
    function getStake(address stakeholder) public view returns (uint256) {
        return stakeholders[stakeholder].stake;
    }

    /**
     * @return todo arefev: description
     */
    function daoAddress() public view returns (address) {
        return address(dao);
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
        Stakeholder storage stakeholder = stakeholders[msg.sender];

        if (stakeholder.stake == 0) {
            stakeholder.rewardUpdateDate = block.timestamp;
            return;
        }

        uint256 rewardPeriods = (block.timestamp - stakeholder.rewardUpdateDate) / rewardPeriod;
        uint256 reward = stakeholder.stake * rewardPeriods * rewardPercentage / 100;
        stakeholder.reward += reward;
        stakeholder.rewardUpdateDate = block.timestamp;
    }
}
