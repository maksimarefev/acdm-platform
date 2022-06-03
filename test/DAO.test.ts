import { expect, use } from "chai";
import { ethers, network } from "hardhat";
import { Signer, Contract } from "ethers";
import { FakeContract, smock } from "@defi-wonderland/smock";
import { DAO, DAO__factory } from "../typechain-types";
import Staking from "../artifacts/contracts/Staking.sol/Staking.json";

use(smock.matchers);

describe("DAO", function() {

    const minimumQuorum = 30; //30%
    const debatingPeriodDuration = 3 * 60; //3 minutes

    let bob: Signer;
    let alice: Signer;
    let dao: DAO;
    let stakingMock: FakeContract<Contract>;

    beforeEach("Deploying contract", async function () {
        [alice, bob] = await ethers.getSigners();

        stakingMock = await smock.fake(Staking.abi);

        const DAOFactory: DAO__factory = (await ethers.getContractFactory("DAO")) as DAO__factory;

        dao = await DAOFactory.deploy(await alice.getAddress(), minimumQuorum, debatingPeriodDuration);
        await dao.init(stakingMock.address);
   });

   describe("vote", async function() {
        it("Should not allow to vote if there is no proposal", async function() {
            const proposalId: number = 0;
            const votesFor: boolean = true;

            const voteTxPromise: Promise<any> = dao.vote(proposalId, votesFor);

            await expect(voteTxPromise).to.be.revertedWith("Proposal not found");
        });

        it("Should not allow to vote if the proposal has met deadline", async function() {
            const proposalId: number = 0;
            const votesFor: boolean = true;
            const description: string = "";
            const data: Uint8Array = new Uint8Array();
            const targetContractAddress: string = stakingMock.address;

            await dao.addProposal(data, targetContractAddress, description);
            await network.provider.send("evm_increaseTime", [debatingPeriodDuration]);
            const voteTxPromise: Promise<any> = dao.vote(proposalId, votesFor);

            await expect(voteTxPromise).to.be.revertedWith("Proposal is finished");
        });

        it("Should not allow to vote if sender is not a stakeholder", async function() {
            const proposalId: number = 0;
            const votesFor: boolean = true;
            const description: string = "";
            const aliceBalance: number = 0;
            const data: Uint8Array = new Uint8Array();
            const aliceAddress: string = await alice.getAddress();
            const targetContractAddress: string = stakingMock.address;
            await stakingMock.getStake.whenCalledWith(aliceAddress).returns(aliceBalance);

            await dao.addProposal(data, targetContractAddress, description);
            const voteTxPromise: Promise<any> = dao.vote(proposalId, votesFor);

            await expect(voteTxPromise).to.be.revertedWith("Not a stakeholder");
        });

        it("Should not allow to vote if sender already voted", async function() {
            const proposalId: number = 0;
            const votesFor: boolean = true;
            const description: string = "";
            const aliceBalance: number = 1;
            const data: Uint8Array = new Uint8Array();
            const aliceAddress: string = await alice.getAddress();
            const targetContractAddress: string = stakingMock.address;
            await stakingMock.getStake.whenCalledWith(aliceAddress).returns(aliceBalance);

            await dao.addProposal(data, targetContractAddress, description);
            await dao.vote(proposalId, votesFor);
            const voteTxPromise: Promise<any> = dao.vote(proposalId, votesFor);

            await expect(voteTxPromise).to.be.revertedWith("Already voted");
        });
   });

   describe("addProposal", async function() {
        it("Should allow for chairman to create proposal", async function() {
            const proposalId: number = 0;
            const description: string = "description";
            const data: Uint8Array = new Uint8Array();
            const targetContractAddress: string = stakingMock.address;

            await dao.addProposal(data, targetContractAddress, description);
            const fetchDescription: string = await dao.description(proposalId);

            expect(fetchDescription).to.not.be.null;
        });

        it("Should not allow for non-chairman to create proposal", async function() {
            const description: string = "description";
            const data: Uint8Array = new Uint8Array();
            const targetContractAddress: string = stakingMock.address;

            const addProposalTxPromise: Promise<any> =
                dao.connect(bob).addProposal(data, targetContractAddress, description);

            await expect(addProposalTxPromise).to.be.revertedWith("Not a chairman");
        });

        it("Should not allow to create a proposal if recepient is not a contract", async function() {
            const description: string = "description";
            const data: Uint8Array = new Uint8Array();
            const aliceAddress: string = await alice.getAddress();

            const addProposalTxPromise: Promise<any> = dao.addProposal(data, aliceAddress, description);

            await expect(addProposalTxPromise).to.be.revertedWith("Recipient is not a contract");
        });

        it("Should emit ProposalCreated event", async function() {
            const proposalId: number = 0;
            const description: string = "description";
            const data: Uint8Array = new Uint8Array();
            const targetContractAddress: string = stakingMock.address;

            const addProposaltxPromise: Promise<any> = dao.addProposal(data, targetContractAddress, description);

            await expect(addProposaltxPromise).to.emit(dao, "ProposalCreated").withArgs(proposalId);
        });
   });

   describe("finishProposal", async function() {
        const changeFeeAbi = [{
            "inputs": [
              {
                "internalType": "uint256",
                "name": "_stakeWithdrawalTimeout",
                "type": "uint256"
              }
            ],
            "name": "setStakeWithdrawalTimeout",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
        }];
        const iface = new ethers.utils.Interface(changeFeeAbi);

        it("Should not allow to finish non-existing proposal", async function() {
            const proposalId: number = 0;

            const finishProposalTxPromise: Promise<any> = dao.finishProposal(proposalId);

            await expect(finishProposalTxPromise).to.be.revertedWith("Proposal not found");
        });

        it("Should not allow to finish in-progress proposal", async function() {
            const proposalId: number = 0;
            const description: string = "";
            const data: Uint8Array = new Uint8Array();
            const targetContractAddress: string = stakingMock.address;

            await dao.addProposal(data, targetContractAddress, description);
            const finishProposalTxPromise: Promise<any> = dao.finishProposal(proposalId);

            await expect(finishProposalTxPromise).to.be.revertedWith("Proposal is still in progress");
        });

        it("Should emit ProposalFailed if a number of votes does not exceed the minimum quorum", async function() {
            const proposalId: number = 0;
            const description: string = "";
            const data: Uint8Array = new Uint8Array();
            const targetContractAddress: string = stakingMock.address;
            const votesFor: boolean = true;
            const aliceStake: number = 1;
            const totalStake: number = 10;
            const aliceAddress: string = await alice.getAddress();
            await stakingMock.getStake.whenCalledWith(aliceAddress).returns(aliceStake);
            await stakingMock.totalStake.returns(totalStake);

            await dao.addProposal(data, targetContractAddress, description);
            await dao.vote(proposalId, votesFor);
            await network.provider.send("evm_increaseTime", [debatingPeriodDuration]);
            const finishProposalTxPromise: Promise<any> = dao.finishProposal(proposalId);

            await expect(finishProposalTxPromise).to.emit(dao, "ProposalFailed")
                .withArgs(proposalId, description, "Minimum quorum is not reached");
        });

        it("Should emit ProposalFinished if a call to a target contract succeeded", async function() {
            const proposalId: number = 0;
            const description: string = "";
            const newStakeWithdrawalTimeout: number = 10;
            const data: string = iface.encodeFunctionData("setStakeWithdrawalTimeout", [newStakeWithdrawalTimeout]);
            const targetContractAddress: string = stakingMock.address;
            const votesFor: boolean = true;
            const aliceStake: number = 1;
            const totalStake: number = 1;
            const aliceAddress: string = await alice.getAddress();
            await stakingMock.getStake.whenCalledWith(aliceAddress).returns(aliceStake);
            await stakingMock.totalStake.returns(totalStake);

            await dao.addProposal(data, targetContractAddress, description);
            await dao.vote(proposalId, votesFor);
            await network.provider.send("evm_increaseTime", [debatingPeriodDuration]);
            const finishProposalTxPromise: Promise<any> = dao.finishProposal(proposalId);

            await expect(finishProposalTxPromise).to.emit(dao, "ProposalFinished").withArgs(proposalId, description, votesFor);
            expect(stakingMock.setStakeWithdrawalTimeout).to.be.calledOnceWith(newStakeWithdrawalTimeout);
        });

        it("Should emit ProposalFailed if a call to a target contract did not succeed", async function() {
            const proposalId: number = 0;
            const description: string = "";
            const newStakeWithdrawalTimeout: number = 10;
            const data: string = iface.encodeFunctionData("setStakeWithdrawalTimeout", [newStakeWithdrawalTimeout]);
            const targetContractAddress: string = stakingMock.address;
            const aliceStake: number = 1;
            const totalStake: number = 1;
            const votesFor: boolean = true;
            const aliceAddress: string = await alice.getAddress();
            await stakingMock.getStake.whenCalledWith(aliceAddress).returns(aliceStake);
            await stakingMock.totalStake.returns(totalStake);
            await stakingMock.setStakeWithdrawalTimeout.reverts();

            await dao.addProposal(data, targetContractAddress, description);
            await dao.vote(proposalId, votesFor);
            await network.provider.send("evm_increaseTime", [debatingPeriodDuration]);
            const finishProposalTxPromise: Promise<any> = dao.finishProposal(proposalId);

            await expect(finishProposalTxPromise).to.emit(dao, "ProposalFailed")
                .withArgs(proposalId, description, "Function call failed");
            expect(stakingMock.setStakeWithdrawalTimeout).to.be.calledOnceWith(newStakeWithdrawalTimeout);
        });

        it("Should emit ProposalFailed if a proposal has no votes", async function() {
            const proposalId: number = 0;
            const description: string = "";
            const data: Uint8Array = new Uint8Array();
            const targetContractAddress: string = stakingMock.address;

            await dao.addProposal(data, targetContractAddress, description);
            await network.provider.send("evm_increaseTime", [debatingPeriodDuration]);
            const finishProposalTxPromise: Promise<any> = dao.finishProposal(proposalId);

            await expect(finishProposalTxPromise).to.emit(dao, "ProposalFailed")
                .withArgs(proposalId, description, "No votes for proposal");
        });

        it("Should emit ProposalFinished if number of `against` votes exceeds a number of `for` votes", async function() {
            const proposalId: number = 0;
            const description: string = "";
            const data: Uint8Array = new Uint8Array();
            const targetContractAddress: string = stakingMock.address;
            const aliceStake: number = 1;
            const bobStake: number = 2;
            const totalStake: number = aliceStake + bobStake;
            const votesFor: boolean = true;
            const aliceAddress: string = await alice.getAddress();
            const bobAddress: string = await bob.getAddress();
            await stakingMock.getStake.whenCalledWith(aliceAddress).returns(aliceStake);
            await stakingMock.getStake.whenCalledWith(bobAddress).returns(bobStake);
            await stakingMock.totalStake.returns(totalStake);

            await dao.addProposal(data, targetContractAddress, description);
            await dao.vote(proposalId, votesFor);
            await dao.connect(bob).vote(proposalId, !votesFor);
            await network.provider.send("evm_increaseTime", [debatingPeriodDuration]);
            const finishProposalTxPromise: Promise<any> = dao.finishProposal(proposalId);

            await expect(finishProposalTxPromise).to.emit(dao, "ProposalFinished")
                .withArgs(proposalId, description, !votesFor);
        });
   });

   describe("misc", async function() {
        it("Should not allow for non-owner to change debating period duration", async function() {
            const debatingPeriodDuration: number = 10;

            const setDebatingPeriodDurationTxPromise: Promise<any> =
                dao.connect(bob).setDebatingPeriodDuration(debatingPeriodDuration);

            await expect(setDebatingPeriodDurationTxPromise).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("Should allow for the owner to change debating period duration", async function() {
            const previousDebatingPeriodDuration: number = (await dao.debatingPeriodDuration()).toNumber();
            const toBeSetDebatingPeriodDuration: number = previousDebatingPeriodDuration + 1;

            await dao.setDebatingPeriodDuration(toBeSetDebatingPeriodDuration);
            const newDebatingPeriodDuration: number = (await dao.debatingPeriodDuration()).toNumber();

            expect(toBeSetDebatingPeriodDuration).to.equal(newDebatingPeriodDuration);
        });

        it("Should not allow for non-owner to change minimum quorum", async function() {
            const minimumQuorum: number = 10;

            const setMinimumQuorumTxPromise: Promise<any> = dao.connect(bob).setMinimumQuorum(minimumQuorum);

            await expect(setMinimumQuorumTxPromise).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("Should allow for the owner to change minimum quorum", async function() {
            const previousMinimumQuorum: number = (await dao.minimumQuorum()).toNumber();
            const toBeSetMinimumQuorum: number = previousMinimumQuorum + 1;

            await dao.setMinimumQuorum(toBeSetMinimumQuorum);
            const newMinimumQuorum: number = (await dao.minimumQuorum()).toNumber();

            expect(toBeSetMinimumQuorum).to.equal(newMinimumQuorum);
        });

        it("Should not allow to set a minimum quorum greater than 100", async function() {
            const minimumQuorum: number = 101;

            const setMinimumQuorumTxPromise: Promise<any> = dao.setMinimumQuorum(minimumQuorum);

            await expect(setMinimumQuorumTxPromise).to.be.revertedWith("Minimum quorum can not be > 100");
        });

        it("Should not return a description for a non-existing proposals", async function() {
            const proposalId: number = 0;

            const descriptionPromise: Promise<any>= dao.description(proposalId);

            await expect(descriptionPromise).to.be.revertedWith("Proposal not found");
        });

        it("Should return a valid description for an existing proposals", async function() {
            const data: Uint8Array = new Uint8Array();
            const proposalId: number = 0;
            const description: string = "This is it";
            const targetContractAddress: string = stakingMock.address;

            await dao.addProposal(data, targetContractAddress, description);
            const setDescription: string = await dao.description(proposalId);

            expect(description).to.be.equal(setDescription);
        });

        it("Should not allow to construct dao contract with invalid minimum quorum", async function() {
            const minimumQuorum: number = 101;
            const DAOFactory: DAO__factory = (await ethers.getContractFactory("DAO")) as DAO__factory;
            const aliceAddress: string = await alice.getAddress();

            const deployTxPromise: Promise<any> = DAOFactory.deploy(aliceAddress, minimumQuorum, debatingPeriodDuration);

            await expect(deployTxPromise).to.be.revertedWith("Minimum quorum can not be > 100");
        });

        it("Should not allow to interact with the uninitialized contract", async function() {
            const DAOFactory: DAO__factory = (await ethers.getContractFactory("DAO")) as DAO__factory;
            const dao: DAO = await DAOFactory.deploy(await alice.getAddress(), minimumQuorum, debatingPeriodDuration);

            const txPromise: Promise<any> = dao.setDebatingPeriodDuration(debatingPeriodDuration);

            await expect(txPromise).to.be.revertedWith("Not initialized");
        });

        it("Should not allow to initialize twice", async function() {
            const initTxPromise: Promise<any> = dao.init(stakingMock.address);

            await expect(initTxPromise).to.be.revertedWith("Already initialized");
        });

        it("Should not allow to initialize with zero staking address", async function() {
            const DAOFactory: DAO__factory = (await ethers.getContractFactory("DAO")) as DAO__factory;
            const dao: DAO = await DAOFactory.deploy(await alice.getAddress(), minimumQuorum, debatingPeriodDuration);

            const initTxPromise: Promise<any> = dao.init(ethers.constants.AddressZero);

            await expect(initTxPromise).to.be.revertedWith("Address is zero");
        });
   });

   describe("isParticipant", async function() {
       it("Should return true if a stakeholder is participating in voting", async function() {
            const proposalId: number = 0;
            const description: string = "";
            const data: Uint8Array = new Uint8Array();
            const targetContractAddress: string = stakingMock.address;
            const votesFor: boolean = true;
            const aliceStake: number = 1;
            const totalStake: number = 1;
            const aliceAddress: string = await alice.getAddress();
            await stakingMock.getStake.whenCalledWith(aliceAddress).returns(aliceStake);
            await stakingMock.totalStake.returns(totalStake);

            await dao.addProposal(data, targetContractAddress, description);
            await dao.vote(proposalId, votesFor);
            const isParticipant: boolean = await dao.isParticipant(aliceAddress);

            await expect(true).to.equal(isParticipant);
       });
   });

   describe("changeChairman", async function() {
        it("Should not allow for non-chairman to change the chairman", async function() {
            const aliceAddress: string = await alice.getAddress();

            const changeChairmanTxPromise: Promise<any> = dao.connect(bob).changeChairman(aliceAddress);

            await expect(changeChairmanTxPromise).to.be.revertedWith("Not a chairman");
        });

        it("Should allow for chairman to change the chairman", async function() {
            const bobAddress: string = await bob.getAddress();

            await dao.changeChairman(bobAddress);
            const theChairman: string = await dao.chairman();

            expect(bobAddress).to.equal(theChairman);
        });

        it("Should not allow to assign zero address as the chairman", async function() {
            const changeChairmanTxPromise: Promise<any> = dao.changeChairman(ethers.constants.AddressZero);

            await expect(changeChairmanTxPromise).to.be.revertedWith("Should not be zero address");
        });
   });
});
