import "@nomiclabs/hardhat-web3";
import "@nomiclabs/hardhat-ethers";
import { task } from 'hardhat/config';
import { Contract, ContractFactory, Event } from "ethers";

task("finish", "Finishes the proposal with id `proposalId`")
    .addParam("contractAddress", "The address of the dao contract")
    .addParam("proposalId", "Proposal id")
    .setAction(async function (taskArgs, hre) {
        const DAO: ContractFactory = await hre.ethers.getContractFactory("DAO");
        const dao: Contract = await DAO.attach(taskArgs.contractAddress);

        const finishTx: any = await dao.finishProposal(taskArgs.proposalId);
        const finishTxReceipt: any = await finishTx.wait();
        const event: Event = finishTxReceipt.events[0];

        if (event.event === "ProposalFailed") {
            console.log("Proposal %d failed with reason: %s", taskArgs.proposalId, event.args.reason);
        } else if (event.event === "ProposalFinished") {
            console.log("Proposal %d finished. Approved: %s", taskArgs.proposalId, event.args.approved);
        }
        console.log("Gas used: %d", finishTxReceipt.gasUsed.toNumber() * finishTxReceipt.effectiveGasPrice.toNumber());
    });
