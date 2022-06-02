import "@nomiclabs/hardhat-web3";
import "@nomiclabs/hardhat-ethers";
import { task } from 'hardhat/config';
import { Contract, ContractFactory, Event } from "ethers";

task("unstake", "Transfers staked tokens if any to the `msg.sender` address")
    .addParam("contractAddress", "An address of a contract")
    .setAction(async function (taskArgs, hre) {
        const StakingContract: ContractFactory = await hre.ethers.getContractFactory("Staking");
        const stakingContract: Contract = await StakingContract.attach(taskArgs.contractAddress);

        const unstakeTx: any = await stakingContract.unstake();
        const unstakeTxReceipt: any = await unstakeTx.wait();

        console.log("Successfully unstaken tokens to %s", unstakeTxReceipt.from);
        console.log("Gas used: %d", unstakeTxReceipt.gasUsed.toNumber() * unstakeTxReceipt.effectiveGasPrice.toNumber());
    });
