//SPDX-License-Identifier: Unlicensed

pragma solidity ^0.8.0;

import "./IStaking.sol";

interface IDAO {

    /**
     * @notice creates a new proposal
     */
    function addProposal(bytes memory data, address recipient, string memory _description) external;

    /**
     * @notice registers `msg.sender` vote
     */
    function vote(uint256 proposalId, bool votesFor) external;

    /**
     * @notice finishes the proposal with id `proposalId`
     */
    function finishProposal(uint256 proposalId) external;

    /**
     * @notice Transfers chairman grants to a `_chairman`
     */
    function changeChairman(address _chairman) external;

    /**
     * @notice Sets the minimum quorum
     */
    function setMinimumQuorum(uint256 _minimumQuorum) external;

    /**
     * @notice Sets the debating period duration
     */
    function setDebatingPeriodDuration(uint256 _debatingPeriodDuration) external;

    /**
     * @return A description of a proposal with the id `proposalId`
     */
    function description(uint256 proposalId) external view returns (string memory);

    /**
     * @return Whether a given EOA is participating in proposals
     */
    function isParticipant(address stakeholder) external view returns (bool);

    /**
     * @notice EOA responsible for proposals creation
     */
    function chairman() external view returns (address);

    /**
     * @notice The minimum amount of votes needed to consider a proposal to be successful. Quorum = (votes / staking total supply) * 100.
     */
    function minimumQuorum() external view returns (uint256);

    /**
     * @notice EOA responsible for proposals creation
     */
    function debatingPeriodDuration() external view returns (uint256);

    /**
     * @notice Staking contract
     */
    function staking() external view returns (IStaking);
}