//SPDX-License-Identifier: Unlicensed

pragma solidity ^0.8.0;

import "./interface/IDAO.sol";
import "./interface/IStaking.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Staking is IStaking, Ownable {

    /**
     * @dev Represents a stakeholder
     */
    struct Stakeholder {
        uint256 stake;
        uint256 lastStakeDate;
        uint256 reward;
        uint256 rewardUpdateDate;
    }

    address public override rewardToken;

    address public override stakingToken;

    uint256 public override rewardPercentage;

    uint256 public override rewardPeriod;

    uint256 public override stakeWithdrawalTimeout;

    uint256 public override totalStake;

    address public override dao;

    /**
     * @dev A mapping "stakholder address => Stakeholder"
     */
    mapping(address => Stakeholder) private stakeholders;

    modifier onlyDAO() {
        require(msg.sender == address(dao), "Caller is not the DAO");
        _;
    }

    constructor (
        address _stakingToken,
        address _rewardToken,
        uint256 _rewardPercentage,
        uint256 _rewardPeriod,
        uint256 _stakeWithdrawalTimeout,
        address _dao
    ) public Ownable() {
        setRewardPercentage(_rewardPercentage);
        setRewardPeriod(_rewardPeriod);
        stakeWithdrawalTimeout = _stakeWithdrawalTimeout;
        dao = _dao;
        stakingToken = _stakingToken;
        rewardToken = _rewardToken;
    }

    function stake(uint256 amount) external override {
        Stakeholder storage stakeholder = stakeholders[msg.sender];

        _updateReward();

        stakeholder.stake += amount;
        totalStake += amount;

        stakeholder.lastStakeDate = block.timestamp;
        require(IERC20(stakingToken).transferFrom(msg.sender, address(this), amount), "Staking token transfer failed");
    }

    function claim() external override {
        Stakeholder storage stakeholder = stakeholders[msg.sender];

        _updateReward();

        uint256 reward = stakeholder.reward;

        require(reward > 0, "No reward for the caller");

        stakeholder.reward = 0;
        require(IERC20(rewardToken).transfer(msg.sender, reward), "Reward token transfer failed");
    }

    function unstake() external override {
        Stakeholder storage stakeholder = stakeholders[msg.sender];
        uint256 stake = stakeholder.stake;

        require(stake > 0, "The caller has nothing at stake");

        uint256 lastStakeDate = stakeholder.lastStakeDate;
        require(block.timestamp - lastStakeDate >= stakeWithdrawalTimeout, "Timeout is not met");
        require(!IDAO(dao).isParticipant(msg.sender), "A proposal participant");

        _updateReward();
        stakeholder.stake = 0;
        totalStake -= stake;
        require(IERC20(stakingToken).transfer(msg.sender, stake), "Staking token transfer failed");
    }

    function setRewardPercentage(uint256 _rewardPercentage) public override onlyOwner {
        require(_rewardPercentage > 0, "Percentage can not be 0");
        require(_rewardPercentage < 100, "Percentage can not exceed 100%");
        rewardPercentage = _rewardPercentage;
    }

    function setRewardPeriod(uint256 _rewardPeriod) public override onlyOwner {
        require(_rewardPeriod > 0, "Reward period can not be zero");
        rewardPeriod = _rewardPeriod;
    }

    function setStakeWithdrawalTimeout(uint256 _stakeWithdrawalTimeout) public override onlyDAO {
        stakeWithdrawalTimeout = _stakeWithdrawalTimeout;
    }

    function getStake(address stakeholder) public override view returns (uint256) {
        return stakeholders[stakeholder].stake;
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
