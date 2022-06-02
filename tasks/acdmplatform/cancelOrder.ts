import "@nomiclabs/hardhat-web3";
import "@nomiclabs/hardhat-ethers";
import { task } from 'hardhat/config';
import { Contract, ContractFactory } from "ethers";

task("cancelOrder", "Cancels the order with id `orderId`")
    .addParam("contractAddress", "The address of the ACDM platform contract")
    .addParam("orderId", "An order id")
    .setAction(async function (taskArgs, hre) {
        const ACDMPlatform: ContractFactory = await hre.ethers.getContractFactory("ACDMPlatform");
        const acdmPlatform: Contract = await ACDMPlatform.attach(taskArgs.contractAddress);

        const tx: any = await acdmPlatform.cancelOrder(taskArgs.orderId);
        const txReceipt: any = await tx.wait();

        console.log("Successfully cancelled order:", taskArgs.orderId);
        console.log("Gas used: %d", txReceipt.gasUsed.toNumber() * txReceipt.effectiveGasPrice.toNumber());
    });
