import "@nomiclabs/hardhat-web3";
import "@nomiclabs/hardhat-ethers";
import { task } from 'hardhat/config';
import { Contract, ContractFactory, Event } from "ethers";

task("claim", "Transfers the reward tokens if any to the `msg.sender` address")
    .addParam("contractAddress", "An address of a contract")
    .setAction(async function (taskArgs, hre) {
        const StakingContract: ContractFactory = await hre.ethers.getContractFactory("Staking");
        const stakingContract: Contract = await StakingContract.attach(taskArgs.contractAddress);

        const claimTx: any = await stakingContract.claim();
        const claimTxReceipt: any = await claimTx.wait();

        console.log("Successfully claimed tokens to %s", claimTxReceipt.from);
        console.log("Gas used: %d", claimTxReceipt.gasUsed.toNumber() * claimTxReceipt.effectiveGasPrice.toNumber());
    });
