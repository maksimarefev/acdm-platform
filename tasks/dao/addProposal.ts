import "@nomiclabs/hardhat-web3";
import "@nomiclabs/hardhat-ethers";
import { task } from 'hardhat/config';
import { Contract, ContractFactory } from "ethers";

task("addProposal", "Creates a new proposal")
    .addParam("contractAddress", "The address of the dao contract")
    .addParam("data", "Calldata for target function")
    .addParam("recipient", "Callee contract address")
    .addParam("description", "Proposal description")
    .setAction(async function (taskArgs, hre) {
        const VotingDao: ContractFactory = await hre.ethers.getContractFactory("DAO");
        const dao: Contract = await VotingDao.attach(taskArgs.contractAddress);

        const addProposalTx: any = await dao.addProposal(taskArgs.data, taskArgs.recipient, taskArgs.description);
        const addProposalTxReceipt: any = await addProposalTx.wait();

        console.log(
            "Successfully created new proposal with id %d", addProposalTxReceipt.events[0].args.proposalId.toNumber()
        );
        console.log("Gas used: %d", addProposalTxReceipt.gasUsed.toNumber() * addProposalTxReceipt.effectiveGasPrice.toNumber());
    });
