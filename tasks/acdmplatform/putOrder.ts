import "@nomiclabs/hardhat-web3";
import "@nomiclabs/hardhat-ethers";
import { task } from 'hardhat/config';
import { Contract, ContractFactory } from "ethers";

task("putOrder", "Creates a new order for selling ACDM tokens")
    .addParam("contractAddress", "The address of the ACDM platform contract")
    .addParam("amount", "The amount of tokens (as decimals)")
    .addParam("price", "The price in wei per ONE token")
    .setAction(async function (taskArgs, hre) {
        const ACDMPlatform: ContractFactory = await hre.ethers.getContractFactory("ACDMPlatform");
        const acdmPlatform: Contract = await ACDMPlatform.attach(taskArgs.contractAddress);

        const tx: any = await acdmPlatform.putOrder(taskArgs.amount, taskArgs.price);
        const txReceipt: any = await tx.wait();

        txReceipt.events
            .filter(event => event.event === "PutOrder")
            .forEach(event => console.log("Successfully created the order:", event.args.orderId));

        console.log("Successfully put the order %s", );
        console.log("Gas used: %d", txReceipt.gasUsed.toNumber() * txReceipt.effectiveGasPrice.toNumber());
    });
