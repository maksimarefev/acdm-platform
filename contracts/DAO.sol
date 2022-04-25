pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./Staking.sol";

//todo arefev: minimum quorum?
contract DAO is Ownable {

    struct Proposal {
        uint256 votesFor;
        uint256 votesAgainst;
        uint256 deadline;
    }

    /**
     * @dev EOA responsible for proposals creation
     */
    address public chairman;

    /**
     * @dev todo arefev
     */
    Staking public staking;

    /**
     * @dev The minimum amount of votes needed to consider a proposal to be successful. Quorum = (votes / dao total supply) * 100.
     */
    uint256 public minimumQuorum;

    /**
     * @dev EOA responsible for proposals creation
     */
    uint256 public debatingPeriodDuration;

    Proposal private currentProposal;
    mapping(address => bool) private voters;

    /**
     * @dev Emitted when a proposal was successfully finished
     */
    event ProposalFinished(bool approved);

    /**
     * @dev Emitted when a proposal was failed
     */
    event ProposalFailed(string reason);

    /**
     * @dev Emitted when a proposal was created
     */
    event ProposalCreated(uint256 proposalId);

    modifier onlyChairman() {
        require(msg.sender == chairman, "Not a chairman");
        _;
    }

    constructor(address _chairman, address _staking, uint256 _minimumQuorum, uint256 _debatingPeriodDuration) public {
        require(_minimumQuorum <= 100, "Minimum quorum can not be > 100");
        chairman = _chairman;
        staking = Staking(staking);
        minimumQuorum = _minimumQuorum;
        debatingPeriodDuration = _debatingPeriodDuration;
    }

    /*todo arefev:
        1. There should be only one proposal at time
        2. onlyChairman?
    */
    /**
     * @notice creates a new proposal
     */
    function startVoting() public onlyChairman {
        require(currentProposal.deadline == 0, "todo arefev"); //may be I should use a flag?
        newProposal.deadline = block.timestamp + debatingPeriodDuration;
        emit ProposalCreated(nextProposalId); //todo arefev: rename that event
    }

    /**
     * @notice registers `msg.sender` vote
     */
    function vote(uint256 proposalId, bool votesFor) public {
        //todo arefev: check balance
        require(proposal.deadline != 0, "Proposal is not started");
        require(proposal.deadline > block.timestamp, "Proposal is finished");
        require(!voters[msg.sender], "Already voted");

        uint256 balance = staking.getStake(msg.sender);
        require(balance > 0, "Not a stakeholder");

        voters[msg.sender] = true;

        if (votesFor) {
            proposal.votesFor += balance;
        } else {
            proposal.votesAgainst += balance;
        }
    }

    /**
     * @notice finishes the proposal with id `proposalId`
     */
    function finishProposal(uint256 proposalId) public {
        require(proposal.deadline != 0, "Proposal not found");
        require(block.timestamp >= proposal.deadline, "Proposal is still in progress");

        if (proposal.votesFor == 0 && proposal.votesAgainst == 0) {
            emit ProposalFailed("No votes for proposal");
        } else if ((proposal.votesFor + proposal.votesAgainst) * 100 / staking.totalStake() >= minimumQuorum) {
            if (proposal.votesFor > proposal.votesAgainst) {
                staking.setStakeWithdrawalTimeout(); //todo arefev: define timeout
                emit ProposalFinished(true);
            } else {
                emit ProposalFinished(false);
            }
        } else {
            emit ProposalFailed(proposalId, proposal.description, "Minimum quorum is not reached");
        }

        //todo arefev: clean mappings
    }

    /**
     * @notice Transfers chairman grants to a `_chairman`
     */
    function changeChairman(address _chairman) public onlyChairman {
        require(_chairman != address(0), "Should not be zero address");
        chairman = _chairman;
    }

    /**
     * @notice Sets the minimum quorum
     */
    function setMinimumQuorum(uint256 _minimumQuorum) public onlyOwner {
        require(_minimumQuorum <= 100, "Minimum quorum can not be > 100");
        minimumQuorum = _minimumQuorum;
    }

    /**
     * @notice Sets the debating period duration
     */
    function setDebatingPeriodDuration(uint256 _debatingPeriodDuration) public onlyOwner {
        debatingPeriodDuration = _debatingPeriodDuration;
    }

    /**
     * @return A description of a proposal with the id `proposalId`
     */
    function description(uint256 proposalId) public view returns (string memory) {
        require(proposals[proposalId].recipient != address(0), "Proposal not found");
        return proposals[proposalId].description;
    }

    /**
     * @notice An amount of deposited tokens for the `stakeholder`
     */
    function deposited(address stakeholder) public view returns(uint256) {
        return stakeholdersToDeposits[stakeholder];
    }
}
