import "@nomiclabs/hardhat-web3";
import "@nomiclabs/hardhat-ethers";
import { task } from 'hardhat/config';
import { Contract, ContractFactory } from "ethers";

task("voteForProposal", "Registers `msg.sender` vote")
    .addParam("contractAddress", "The address of the dao contract")
    .addParam("proposalId", "Proposal id")
    .addParam("votesFor", "Flag which specifies whether a sender votes `for` or `against`")
    .setAction(async function (taskArgs, hre) {
        const DAO: ContractFactory = await hre.ethers.getContractFactory("DAO");
        const dao: Contract = await DAO.attach(taskArgs.contractAddress);

        const voteTx: any = await dao.vote(taskArgs.proposalId, taskArgs.votesFor);
        const voteTxReceipt: any = await voteTx.wait();

        console.log("Successfully voted `%s` on the proposal with id %d", taskArgs.votesFor ? "for" : "against", taskArgs.proposalId);
        console.log("Gas used: %d", voteTxReceipt.gasUsed.toNumber() * voteTxReceipt.effectiveGasPrice.toNumber());
    });
