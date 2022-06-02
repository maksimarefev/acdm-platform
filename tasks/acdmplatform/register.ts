import "@nomiclabs/hardhat-web3";
import "@nomiclabs/hardhat-ethers";
import { task } from 'hardhat/config';
import { Contract, ContractFactory } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

task("register", "Registers a user on a platform")
    .addParam("contractAddress", "The address of the ACDM platform contract")
    .addParam("referrer", "Address of the referrer")
    .setAction(async function (taskArgs, hre) {
        const ACDMPlatform: ContractFactory = await hre.ethers.getContractFactory("ACDMPlatform");
        const acdmPlatform: Contract = await ACDMPlatform.attach(taskArgs.contractAddress);
        const account: SignerWithAddress = (await hre.ethers.getSigners())[0];

        const tx: any = await acdmPlatform.register(taskArgs.referrer);
        const txReceipt: any = await tx.wait();

        console.log("Successfully registered the user:", await account.getAddress());
        console.log("Transaction hash:", txReceipt.transactionHash);
        console.log("Gas used: %d", txReceipt.gasUsed.toNumber() * txReceipt.effectiveGasPrice.toNumber());
    });
