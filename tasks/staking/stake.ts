import "@nomiclabs/hardhat-web3";
import "@nomiclabs/hardhat-ethers";
import { task } from 'hardhat/config';
import { Contract, ContractFactory, Event } from "ethers";

task("stake", "Transfers the `amount` of tokens from `msg.sender` address to the StakingContract address")
    .addParam("contractAddress", "An address of a contract")
    .addParam("amount", "The amount of tokens to stake")
    .setAction(async function (taskArgs, hre) {
        const StakingContract: ContractFactory = await hre.ethers.getContractFactory("Staking");
        const stakingContract: Contract = await StakingContract.attach(taskArgs.contractAddress);

        const stakeTx: any = await stakingContract.stake(taskArgs.amount);
        const stakeTxReceipt: any = await stakeTx.wait();

        console.log("Successfully staked %d tokens from %s", taskArgs.amount, stakeTxReceipt.from);
        console.log("Gas used: %d", stakeTxReceipt.gasUsed.toNumber() * stakeTxReceipt.effectiveGasPrice.toNumber());
    });
