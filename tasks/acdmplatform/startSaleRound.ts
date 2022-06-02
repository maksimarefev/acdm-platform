import "@nomiclabs/hardhat-web3";
import "@nomiclabs/hardhat-ethers";
import { task } from 'hardhat/config';
import { Contract, ContractFactory } from "ethers";

task("startSaleRound", "Starts the SALE round")
    .addParam("contractAddress", "The address of the ACDM platform contract")
    .setAction(async function (taskArgs, hre) {
        const ACDMPlatform: ContractFactory = await hre.ethers.getContractFactory("ACDMPlatform");
        const acdmPlatform: Contract = await ACDMPlatform.attach(taskArgs.contractAddress);

        const tx: any = await acdmPlatform.startSaleRound();
        const txReceipt: any = await tx.wait();

        console.log("Successfully switched to the SALE round");
        console.log("Transaction hash:", txReceipt.transactionHash);
        console.log("Gas used: %d", txReceipt.gasUsed.toNumber() * txReceipt.effectiveGasPrice.toNumber());
    });
