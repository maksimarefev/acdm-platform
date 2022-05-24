import { expect, use } from "chai";
import { ethers, artifacts, network } from "hardhat";
import { FakeContract, smock } from "@defi-wonderland/smock";
import { Staking, Staking__factory } from '../typechain-types';
import IDAO from "../artifacts/contracts/interface/IDAO.sol/IDAO.json";
import { Signer, Contract, ContractFactory, Event, BigNumber } from "ethers";
import ERC20BurnableMintable from "../artifacts/contracts/interface/ERC20BurnableMintable.sol/ERC20BurnableMintable.json";

use(smock.matchers);

describe("Staking", function () {
    const initialSupply: number = 1_000_000_000_000
    const rewardPercentage: number = 20;
    const rewardingPeriod: number = 10;
    const stakeWithdrawalTimeout: number = 10;

    let bob: Signer;
    let alice: Signer;
    let daoMock: FakeContract<Contract>;
    let rewardTokenMock: FakeContract<Contract>;
    let stakingTokenMock: FakeContract<Contract>;
    let staking: Staking;

    beforeEach("Deploying contracts", async function () {
        [alice, bob] = await ethers.getSigners();

        daoMock = await smock.fake(IDAO.abi);
        rewardTokenMock = await smock.fake(ERC20BurnableMintable.abi);
        stakingTokenMock = await smock.fake(ERC20BurnableMintable.abi);

        const daoAddress: string = daoMock.address;
        const rewardTokenAddress: string = rewardTokenMock.address;
        const stakingTokenAddress: string = stakingTokenMock.address;

        const StakingFactory: Staking__factory = (await ethers.getContractFactory("Staking")) as Staking__factory;
        staking = await StakingFactory.deploy(
             stakingTokenAddress, rewardTokenAddress, rewardPercentage, rewardingPeriod, stakeWithdrawalTimeout, daoAddress
         );
    })

    it("Should change total stake after staking", async () => {
        const tokensToStake: number = 100;
        const totalStakeBefore: BigNumber = await staking.totalStake();
        const aliceAddress: string = await alice.getAddress();
        const stakingAddress = staking.address;
        await stakingTokenMock.transferFrom.whenCalledWith(aliceAddress, stakingAddress, tokensToStake).returns(true);

        await staking.stake(tokensToStake);

        const totalStakeAfter: BigNumber = await staking.totalStake();
        expect(tokensToStake).to.equal(totalStakeAfter.toNumber() - totalStakeBefore.toNumber());
    })

    //todo arefev: WHAT THE FUCK?
    it("Should not allow to unstake before the timeout has expired", async () => {
        const tokensToStake: number = 100;
        const stakingAddress = staking.address;
        const aliceAddress: string = await alice.getAddress();
        await stakingTokenMock.transferFrom.whenCalledWith(aliceAddress, stakingAddress, tokensToStake).returns(true);

        await staking.stake(tokensToStake);
        const unstakeTxPromise: Promise<any> = staking.unstake();

        await expect(unstakeTxPromise)
          .to.be.revertedWith("VM Exception while processing transaction: reverted with reason string 'Timeout is not met'");
    })

    it("Should allow to unstake after the timeout has expired", async () => {
        const tokensToStake: number = 100;
        const aliceAddress: string = await alice.getAddress();
        const stakingAddress = staking.address;
        await stakingTokenMock.transfer.whenCalledWith(aliceAddress, tokensToStake).returns(true);
        await stakingTokenMock.transferFrom.whenCalledWith(aliceAddress, stakingAddress, tokensToStake).returns(true);
        await daoMock.isParticipant.whenCalledWith(aliceAddress).returns(false);

        await staking.stake(tokensToStake);
        await network.provider.send("evm_increaseTime", [stakeWithdrawalTimeout])

        const aliceStakeBeforeUnstake: BigNumber = await staking.getStake(aliceAddress);
        await staking.unstake();
        const aliceStakeAfterUnstake: BigNumber = await staking.getStake(aliceAddress);

        expect(tokensToStake).to.equal(aliceStakeBeforeUnstake.toNumber() - aliceStakeAfterUnstake.toNumber());
    })

    it("Should not allow to unstake if nothing at stake", async () => {
        const unstakeTxPromise: Promise<any> = staking.unstake();

        await expect(unstakeTxPromise)
          .to.be.revertedWith("VM Exception while processing transaction: reverted with reason string 'The caller has nothing at stake'");
    })

    it("Should not allow to claim if there is no reward", async () => {
        const claimTxPromise: Promise<any> = staking.claim();

        await expect(claimTxPromise)
          .to.be.revertedWith("VM Exception while processing transaction: reverted with reason string 'No reward for the caller'");
    })

     it("Should not allow for non-owner to change the reward percentage", async () => {
         const aNewRewardPercentage: number = 50;

         const setRewardPercentageTxPromise: Promise<any> =
            staking.connect(bob).setRewardPercentage(aNewRewardPercentage);

         await expect(setRewardPercentageTxPromise)
           .to.be.revertedWith("VM Exception while processing transaction: reverted with reason string 'Ownable: caller is not the owner'");
     })

    it("Should not allow for non-owner to change the reward period", async () => {
        const aNewRewardPeriod: number = 50;

        const setRewardPeriodTxPromise: Promise<any> = staking.connect(bob).setRewardPeriod(aNewRewardPeriod);

        await expect(setRewardPeriodTxPromise)
            .to.be.revertedWith("VM Exception while processing transaction: reverted with reason string 'Ownable: caller is not the owner'");
    })

    it("Should not allow for non-dao to change the stake withdrawal timeout", async () => {
        const aNewstakeWithdrawalTimeout: number = 50;

        const setStakeWithdrawalTimeoutTxPromise: Promise<any> =
          staking.setStakeWithdrawalTimeout(aNewstakeWithdrawalTimeout);

        await expect(setStakeWithdrawalTimeoutTxPromise)
            .to.be.revertedWith("VM Exception while processing transaction: reverted with reason string 'Caller is not the DAO'");
    })

    it("Should allow for the owner to change the reward percentage", async () => {
         const aNewRewardPercentage: number = 50;

         await staking.setRewardPercentage(aNewRewardPercentage);

         const rewardPercentage: number = (await staking.rewardPercentage()).toNumber();
         expect(aNewRewardPercentage).to.equal(rewardPercentage);
     })

    it("Should allow for the owner to change the reward period", async () => {
        const aNewRewardPeriod: number = 50;

        await staking.setRewardPeriod(aNewRewardPeriod);

        const rewardPeriod: BigNumber = await staking.rewardPeriod();
        expect(aNewRewardPeriod).to.equal(rewardPeriod);
    })

    it("Should allow for the dao to change the stake withdrawal timeout", async () => {
        const daoAddress: string = daoMock.address;
        const aNewStakeWithdrawalTimeout: number = 50;
        const daoSigner: Signer = await ethers.getSigner(daoAddress);
        await alice.sendTransaction({ to: daoAddress, value: ethers.utils.parseEther("1.0") });

        await staking.connect(daoSigner).setStakeWithdrawalTimeout(aNewStakeWithdrawalTimeout);
        const stakeWithdrawalTimeout: BigNumber = await staking.stakeWithdrawalTimeout();

        expect(aNewStakeWithdrawalTimeout).to.equal(stakeWithdrawalTimeout);
    })

    it("Should not allow to set the reward percentage to zero", async () => {
        const aNewRewardPercentage = 0;

        const setRewardPercentageTxPromise: Promise<any> = staking.setRewardPercentage(aNewRewardPercentage);

        await expect(setRewardPercentageTxPromise)
            .to.be.revertedWith("VM Exception while processing transaction: reverted with reason string 'Percentage can not be 0'");
    })

     it("Should not allow to set the reward percentage greater than 100", async () => {
        const aNewRewardPercentage = 101;

        const setRewardPercentageTxPromise: Promise<any> =
            staking.setRewardPercentage(aNewRewardPercentage);

        await expect(setRewardPercentageTxPromise)
            .to.be.revertedWith("VM Exception while processing transaction: reverted with reason string 'Percentage can not exceed 100%'");
     })

     it("Should not allow to set the reward period to zero", async () => {
         const aNewRewardPeriod = 0;

         const setRewardPeriodTxPromise: Promise<any> = staking.setRewardPeriod(aNewRewardPeriod);

         await expect(setRewardPeriodTxPromise)
            .to.be.revertedWith("VM Exception while processing transaction: reverted with reason string 'Reward period can not be zero'");
     })

    it("Should calculate the reward properly", async () => {
        const tokensToStake: number = 100;
        const stakingAddress: string = staking.address;
        const aliceAddress: string = await alice.getAddress();
        const expectedReward = tokensToStake * rewardPercentage / 100;
        await rewardTokenMock.transfer.whenCalledWith(aliceAddress, expectedReward).returns(true);
        await stakingTokenMock.transferFrom.whenCalledWith(aliceAddress, stakingAddress, tokensToStake).returns(true);

        await staking.stake(tokensToStake);
        await network.provider.send("evm_increaseTime", [rewardingPeriod])
        await staking.claim();

        expect(rewardTokenMock.transfer).to.be.calledOnceWith(aliceAddress, expectedReward);
    })

    it("Should return the valid owner", async () => {
        const aliceAddress: string = await alice.getAddress();

        const theOwner: string = await staking.owner();

        expect(theOwner).to.equal(aliceAddress);
    })

    it("Should return the valid dao address", async () => {
        const expectedDaoAddress: string = daoMock.address;

        const daoAddress: string = await staking.dao();

        expect(daoAddress).to.equal(daoAddress);
    })

    it("Should return the valid stake volume", async () => {
        const tokensToStake: number = 100;
        const stakingAddress: string = staking.address;
        const aliceAddress: string = await alice.getAddress();
        await stakingTokenMock.transferFrom.whenCalledWith(aliceAddress, stakingAddress, tokensToStake).returns(true);

        const aliceStakeBefore: BigNumber = await staking.getStake(aliceAddress);
        await staking.stake(tokensToStake);
        const aliceStakeAfter: BigNumber = await staking.getStake(aliceAddress);

        expect(tokensToStake).to.equal(aliceStakeAfter.toNumber() - aliceStakeBefore.toNumber());
    })

    it("Should not allow to transfer ownership to the zero address", async () => {
        const transferOwnershipTxPromise: Promise<any> = staking.transferOwnership(ethers.constants.AddressZero);

        await expect(transferOwnershipTxPromise)
            .to.be.revertedWith("VM Exception while processing transaction: reverted with reason string 'Ownable: new owner is the zero address'");
    })

    it("Should allow to transfer ownership to the valid address", async () => {
        const bobAddress: string = await bob.getAddress();

        await staking.transferOwnership(bobAddress);

        const theOwner: string = await staking.owner();
        expect(bobAddress).to.equal(theOwner);
    })
});
