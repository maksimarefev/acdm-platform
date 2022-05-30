//SPDX-License-Identifier: Unlicensed

pragma solidity ^0.8.0;

import "./interface/IDAO.sol";
import "./interface/IStaking.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract DAO is IDAO, Ownable {
    using Counters for Counters.Counter;

    /**
     * @dev Represents a proposal
     */
    struct Proposal {
        bytes data;
        address recipient;
        string description;
        uint256 votesFor;
        uint256 votesAgainst;
        uint256 deadline;
        address[] voters;
    }

    address public override chairman;

    uint256 public override minimumQuorum;

    uint256 public override debatingPeriodDuration;

    bool public override isInitialized;

    IStaking public override staking;

    /**
     * @dev Used to generate proposal ids
     */
    Counters.Counter private proposalIdGenerator;

    /**
     * @dev A mapping "proposalId => Proposal"
     */
    mapping(uint256 => Proposal) private proposals;

    /**
     * @dev That counter is used to determine whether a stakeholder is currently participating in proposals
     */
    mapping(address => uint256) private proposalCounters;

    /**
     * @dev Maps proposalId to proposal's voters
     */
    mapping(uint256 => mapping(address => bool)) private proposalsToVoters; //since the compiler does not allow us to assign structs with nested mappings :(

    /**
     * @dev Emitted when a proposal was successfully finished
     */
    event ProposalFinished(uint256 indexed proposalId, string description, bool approved);

    /**
     * @dev Emitted when a proposal was failed
     */
    event ProposalFailed(uint256 indexed proposalId, string description, string reason);

    /**
     * @dev Emitted when a proposal was created
     */
    event ProposalCreated(uint256 proposalId);

    modifier onlyChairman() {
        require(msg.sender == chairman, "Not a chairman");
        _;
    }

    modifier initialized() {
        require(isInitialized, "Not initialized");
        _;
    }

    constructor(address _chairman, uint256 _minimumQuorum, uint256 _debatingPeriodDuration) public {
        require(_minimumQuorum <= 100, "Minimum quorum can not be > 100");
        chairman = _chairman;
        minimumQuorum = _minimumQuorum;
        debatingPeriodDuration = _debatingPeriodDuration;
    }

    function init(address _staking) external onlyOwner {
        require(!isInitialized, "Already initialized");
        require(address(0) != _staking, "Address is zero");
        staking = IStaking(_staking);
    }

    function addProposal(bytes memory data, address recipient, string memory _description) public override onlyChairman initialized {
        uint32 codeSize;
        assembly {
            codeSize := extcodesize(recipient)
        }
        require(codeSize > 0, "Recipient is not a contract");

        uint256 nextProposalId = proposalIdGenerator.current();
        proposalIdGenerator.increment();

        Proposal storage newProposal = proposals[nextProposalId];
        newProposal.data = data;
        newProposal.recipient = recipient;
        newProposal.description = _description;
        newProposal.deadline = block.timestamp + debatingPeriodDuration;
        proposals[nextProposalId] = newProposal;
        proposalCounters[msg.sender] += 1;

        emit ProposalCreated(nextProposalId);
    }

    function vote(uint256 proposalId, bool votesFor) public override initialized {
        Proposal storage proposal = proposals[proposalId];

        require(proposal.deadline != 0, "Proposal not found");
        require(proposal.deadline > block.timestamp, "Proposal is finished");
        require(!proposalsToVoters[proposalId][msg.sender], "Already voted");

        uint256 balance = staking.getStake(msg.sender);
        require(balance > 0, "Not a stakeholder");

        proposalsToVoters[proposalId][msg.sender] = true;
        proposalCounters[msg.sender] += 1;
        proposal.voters.push(msg.sender);

        if (votesFor) {
            proposal.votesFor += balance;
        } else {
            proposal.votesAgainst += balance;
        }
    }

    function finishProposal(uint256 proposalId) public override initialized {
        Proposal storage proposal = proposals[proposalId];

        require(proposal.deadline != 0, "Proposal not found");
        require(block.timestamp >= proposal.deadline, "Proposal is still in progress");

        if (proposal.votesFor == 0 && proposal.votesAgainst == 0) {
            emit ProposalFailed(proposalId, proposal.description, "No votes for proposal");
        } else if ((proposal.votesFor + proposal.votesAgainst) * 100 / staking.totalStake() >= minimumQuorum) {
            if (proposal.votesFor > proposal.votesAgainst) {
                (bool success,) = proposal.recipient.call{value : 0}(proposal.data);

                if (success) {
                    emit ProposalFinished(proposalId, proposal.description, true);
                } else {
                    emit ProposalFailed(proposalId, proposal.description, "Function call failed");
                }
            } else {
                emit ProposalFinished(proposalId, proposal.description, false);
            }
        } else {
            emit ProposalFailed(proposalId, proposal.description, "Minimum quorum is not reached");
        }

        for (uint256 i = 0; i < proposal.voters.length; i++) {
            delete proposalsToVoters[proposalId][proposal.voters[i]];
            proposalCounters[proposal.voters[i]] -= 1;
        }
        delete proposals[proposalId];
    }

    function changeChairman(address _chairman) public override onlyChairman initialized {
        require(_chairman != address(0), "Should not be zero address");
        chairman = _chairman;
    }

    function setMinimumQuorum(uint256 _minimumQuorum) public override onlyOwner initialized {
        require(_minimumQuorum <= 100, "Minimum quorum can not be > 100");
        minimumQuorum = _minimumQuorum;
    }

    function setDebatingPeriodDuration(uint256 _debatingPeriodDuration) public override onlyOwner initialized {
        debatingPeriodDuration = _debatingPeriodDuration;
    }

    function description(uint256 proposalId) public override view initialized returns (string memory) {
        require(proposals[proposalId].recipient != address(0), "Proposal not found");
        return proposals[proposalId].description;
    }

    function isParticipant(address stakeholder) public override view initialized returns (bool) {
        return proposalCounters[stakeholder] > 0;
    }
}
