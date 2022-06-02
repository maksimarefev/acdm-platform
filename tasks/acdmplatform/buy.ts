import "@nomiclabs/hardhat-web3";
import "@nomiclabs/hardhat-ethers";
import { task } from 'hardhat/config';
import { Contract, ContractFactory } from "ethers";

task("buy", "Buy for the 'Sale' round")
    .addParam("contractAddress", "The address of the ACDM platform contract")
    .addParam("value", "Value in wei")
    .setAction(async function (taskArgs, hre) {
        const ACDMPlatform: ContractFactory = await hre.ethers.getContractFactory("ACDMPlatform");
        const acdmPlatform: Contract = await ACDMPlatform.attach(taskArgs.contractAddress);

        const tx: any = await acdmPlatform.buy({ value: taskArgs.value });
        const txReceipt: any = await tx.wait();

        txReceipt.events
            .filter(event => event.event != undefined)
            .forEach(event => {
                if (event.event === "SaleOrder") {
                    console.log("Successfully bought; amount:", event.args.amount.toString());
                } else if (event.event === "ReferralPayment") {
                    console.log("Successfully made a trade, order id: %s, amount: %s", event.args.orderId, event.args.amount.toString())
                }
            });
        console.log("Transaction hash:", txReceipt.transactionHash);
        console.log("Gas used: %d", txReceipt.gasUsed.toNumber() * txReceipt.effectiveGasPrice.toNumber());
    });
