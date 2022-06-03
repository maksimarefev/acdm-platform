//SPDX-License-Identifier: Unlicensed

pragma solidity ^0.8.0;

interface IStaking {

    /**
     * @notice Transfers the `amount` of tokens from `msg.sender` address to the Staking contract address
     * @param amount the amount of tokens to stake
     */
    function stake(uint256 amount) external;

    /**
     * @notice Transfers the reward tokens if any to the `msg.sender` address
     */
    function claim() external;

    /**
     * @notice Transfers staked tokens if any to the `msg.sender` address
     */
    function unstake() external;

    /**
     * @notice Sets the reward percentage
     * @param _rewardPercentage is the reward percentage to be set
     */
    function setRewardPercentage(uint256 _rewardPercentage) external;

    /**
     * @notice Sets the reward period
     * @param _rewardPeriod is the reward period to be set
     */
    function setRewardPeriod(uint256 _rewardPeriod) external;

    /**
     * @notice Sets the stake withdrawal timeout
     * @param _stakeWithdrawalTimeout is the stake withdrawal timeout to be set
     */
    function setStakeWithdrawalTimeout(uint256 _stakeWithdrawalTimeout) external;

    /**
     * @notice The reward percentage
     */
    function rewardPercentage() external view returns (uint256);

    /**
     * @notice The reward period in seconds
     */
    function rewardPeriod() external view returns (uint256);

    /**
     * @notice The stake withdrawal timeout in seconds
     */
    function stakeWithdrawalTimeout() external view returns (uint256);

    /**
     * @notice Total value locked
     */
    function totalStake() external view returns (uint256);

    /**
     * @notice Returns the total amount of staked tokens for the `stakeholder`
     * @param stakeholder is the address of the stakeholder
     * @return the total amount of staked tokens for the `stakeholder`
     */
    function getStake(address stakeholder) external view returns (uint256);

    /**
     * @dev The reward token which is used to pay stakeholders
     */
    function rewardToken() external view returns (address);

    /**
     * @dev The staking token which is used by stakeholders to participate
     */
    function stakingToken() external view returns (address);

    /**
     * @dev The DAO which uses this contract to perform voting
     */
    function dao() external view returns (address);
}