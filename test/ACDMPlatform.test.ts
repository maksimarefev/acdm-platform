import { expect, use } from "chai";
import { ethers, network } from "hardhat";
import { Signer, Contract, BigNumber } from "ethers";
import { FakeContract, smock } from "@defi-wonderland/smock";
import IDAO from "../artifacts/contracts/interface/IDAO.sol/IDAO.json";
import { ACDMPlatform, ACDMPlatform__factory } from "../typechain-types";
import ERC20BurnableMintable from "../artifacts/contracts/interface/ERC20BurnableMintable.sol/ERC20BurnableMintable.json";
import ERC20Burnable from "../artifacts/@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol/ERC20Burnable.json";
import IUniswapV2Router02 from "../artifacts/@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol/IUniswapV2Router02.json";

use(smock.matchers);

//todo arefev: remove 'only'
//todo arefev: test referral payments
//todo arefev: squash commits after all tests are ready
describe.only("ACDMPlatform", function() {

    const roundDuration: number = 30;
    const referrerTradeFee: number = 5;
    const acdmTokenDecimals: number = 6;
    const tokensIssued: number = 100;
    const firstReferrerSaleFee: number = 3;
    const secondReferrerSaleFee: number = 3;
    const currentTokenPrice: number = 10_000_000;

    let alice: Signer;
    let bob: Signer;
    let malory: Signer;
    let acdmPlatform: ACDMPlatform;
    let daoMock: FakeContract<Contract>;
    let xxxTokenMock: FakeContract<Contract>;
    let acdmTokenMock: FakeContract<Contract>;
    let uniswapRouterMock: FakeContract<Contract>;

    async function weiPerDecimalInSaleRound(): Promise<BigNumber> {
        const tokenPrice: BigNumber = await acdmPlatform.currentTokenPrice();
        const tokenDecimals: BigNumber = BigNumber.from(acdmTokenDecimals);
        return tokenPrice.div(BigNumber.from(10).pow(tokenDecimals));
    }

    async function putOrder(amount: number | BigNumber, price: number | BigNumber, signer: Signer) {
        const signerAddress: string = await signer.getAddress();
        const platformAddress: string = acdmPlatform.address;
        await acdmTokenMock.balanceOf.whenCalledWith(signerAddress).returns(amount);
        await acdmTokenMock.allowance.whenCalledWith(signerAddress, platformAddress).returns(amount);
        await acdmTokenMock.transferFrom.whenCalledWith(signerAddress, platformAddress, amount).returns(true);
        await acdmPlatform.connect(signer).putOrder(amount, price);
        await acdmTokenMock.balanceOf.reset();
        await acdmTokenMock.allowance.reset();
        await acdmTokenMock.transferFrom.reset();
    }

    beforeEach("Deploying contract", async function () {
        [alice, bob, malory] = await ethers.getSigners();

        const ACDMPlatformFactory: ACDMPlatform__factory =
            (await ethers.getContractFactory("ACDMPlatform")) as ACDMPlatform__factory;

         daoMock = await smock.fake(IDAO.abi);
         xxxTokenMock = await smock.fake(ERC20Burnable.abi);
         acdmTokenMock = await smock.fake(ERC20BurnableMintable.abi);
         uniswapRouterMock = await smock.fake(IUniswapV2Router02.abi);

         await acdmTokenMock.decimals.returns(acdmTokenDecimals);
         await uniswapRouterMock.WETH.returns(ethers.constants.AddressZero);

         const daoAddress = daoMock.address;
         const xxxTokenAddress = xxxTokenMock.address;
         const acdmTokenAddress = acdmTokenMock.address;
         const uniswapRouterAddress = uniswapRouterMock.address;

        acdmPlatform = await ACDMPlatformFactory.deploy(
            acdmTokenAddress,
            uniswapRouterAddress,
            xxxTokenAddress,
            daoAddress,
            roundDuration,
            firstReferrerSaleFee,
            secondReferrerSaleFee,
            referrerTradeFee,
            tokensIssued,
            currentTokenPrice
        );
   });

   describe("putOrder", async function() {
        it("Should fail if the SALE round is in progress", async function() {
            const amount: number = 1;
            const price: number = 1;

            const putOrderTxPromise: Promise<any> = acdmPlatform.putOrder(amount, price);

            await expect(putOrderTxPromise).to.be.revertedWith("Not a 'Trade' round");
        });

        it("Should fail if round is over", async function() {
            const amount: number = 0;
            const price: number = 1;

            await network.provider.send("evm_increaseTime", [roundDuration]);
            await acdmPlatform.startTradeRound();
            await network.provider.send("evm_increaseTime", [roundDuration]);
            const putOrderTxPromise: Promise<any> = acdmPlatform.putOrder(amount, price);

            await expect(putOrderTxPromise).to.be.revertedWith("Round is over");
        });

        it("Should fail if amount is 0", async function() {
            const amount: number = 0;
            const price: number = 1;

            await network.provider.send("evm_increaseTime", [roundDuration]);
            await acdmPlatform.startTradeRound();
            const putOrderTxPromise: Promise<any> = acdmPlatform.putOrder(amount, price);

            await expect(putOrderTxPromise).to.be.revertedWith("Amount can't be 0");
        });

        it("Should fail if price is too low", async function() {
            const amount: number = 1;
            const price: number = 0;

            await network.provider.send("evm_increaseTime", [roundDuration]);
            await acdmPlatform.startTradeRound();
            const putOrderTxPromise: Promise<any> = acdmPlatform.putOrder(amount, price);

            await expect(putOrderTxPromise).to.be.revertedWith("Price is too low");
        });

        it("Should fail if a sender has not enough acdm tokens", async function() {
            const amount: number = 1;
            const price: BigNumber = await acdmPlatform.currentTokenPrice();
            const aliceBalance: number = 0;
            const aliceAddress: string = await alice.getAddress();
            await acdmTokenMock.balanceOf.whenCalledWith(aliceAddress).returns(aliceBalance);

            await network.provider.send("evm_increaseTime", [roundDuration]);
            await acdmPlatform.startTradeRound();
            const putOrderTxPromise: Promise<any> = acdmPlatform.putOrder(amount, price);

            await expect(putOrderTxPromise).to.be.revertedWith("Not enough balance");
        });

        it("Should fail if the platform is not allowed to transfer sufficient amount of acdm tokens", async function() {
            const amount: number = 1;
            const price: BigNumber = await acdmPlatform.currentTokenPrice();
            const aliceBalance: number = 1;
            const aliceAddress: string = await alice.getAddress();
            const platformAddress: string = acdmPlatform.address;
            await acdmTokenMock.balanceOf.whenCalledWith(aliceAddress).returns(aliceBalance);
            await acdmTokenMock.allowance.whenCalledWith(aliceAddress, platformAddress).returns(0);

            await network.provider.send("evm_increaseTime", [roundDuration]);
            await acdmPlatform.startTradeRound();
            const putOrderTxPromise: Promise<any> = acdmPlatform.putOrder(amount, price);

            await expect(putOrderTxPromise).to.be.revertedWith("Not enough allowance");
        });

        it("Should fail if the transfer of acdm tokens failed", async function() {
            const amount: number = 1;
            const price: BigNumber = await acdmPlatform.currentTokenPrice();
            const aliceBalance: number = 1;
            const aliceAddress: string = await alice.getAddress();
            const platformAddress: string = acdmPlatform.address;
            await acdmTokenMock.balanceOf.whenCalledWith(aliceAddress).returns(aliceBalance);
            await acdmTokenMock.allowance.whenCalledWith(aliceAddress, platformAddress).returns(aliceBalance);
            await acdmTokenMock.transferFrom.whenCalledWith(aliceAddress, platformAddress, amount).returns(false);

            await network.provider.send("evm_increaseTime", [roundDuration]);
            await acdmPlatform.startTradeRound();
            const putOrderTxPromise: Promise<any> = acdmPlatform.putOrder(amount, price);

            await expect(putOrderTxPromise).to.be.revertedWith("SafeERC20: ERC20 operation did not succeed");
        });

        it("Should emit the PutOrder event on success", async function() {
            const amount: number = 1;
            const price: BigNumber = await acdmPlatform.currentTokenPrice();
            const aliceBalance: number = 1;
            const orderId: number = 0;
            const aliceAddress: string = await alice.getAddress();
            const platformAddress: string = acdmPlatform.address;
            await acdmTokenMock.balanceOf.whenCalledWith(aliceAddress).returns(aliceBalance);
            await acdmTokenMock.allowance.whenCalledWith(aliceAddress, platformAddress).returns(aliceBalance);
            await acdmTokenMock.transferFrom.whenCalledWith(aliceAddress, platformAddress, amount).returns(true);

            await network.provider.send("evm_increaseTime", [roundDuration]);
            await acdmPlatform.startTradeRound();
            const putOrderTxPromise: Promise<any> = acdmPlatform.putOrder(amount, price);

            await expect(putOrderTxPromise).to.emit(acdmPlatform, "PutOrder").withArgs(orderId, aliceAddress, amount, price);
        });
   });

   describe("cancelOrder", async function() {
        it("Should fail if the SALE round is in progress", async function() {
            const orderId: number = 0;

            const cancelOrderTxPromise: Promise<any> = acdmPlatform.cancelOrder(orderId);

            await expect(cancelOrderTxPromise).to.be.revertedWith("Not a 'Trade' round");
        });

        it("Should fail if order does not exists", async function() {
            const orderId: number = 0;

            await network.provider.send("evm_increaseTime", [roundDuration]);
            await acdmPlatform.startTradeRound();
            const cancelOrderTxPromise: Promise<any> = acdmPlatform.cancelOrder(orderId);

            await expect(cancelOrderTxPromise).to.be.revertedWith("Order does not exist");
        });

        it("Should fail if order does not exists", async function() {
            const orderId: number = 0;

            await network.provider.send("evm_increaseTime", [roundDuration]);
            await acdmPlatform.startTradeRound();
            await network.provider.send("evm_increaseTime", [roundDuration]);
            const cancelOrderTxPromise: Promise<any> = acdmPlatform.cancelOrder(orderId);

            await expect(cancelOrderTxPromise).to.be.revertedWith("Round is over");
        });

        it("Should fail the sender is not the owner", async function() {
            const orderId: number = 0;
            const amount: number = 1;
            const price: BigNumber = await acdmPlatform.currentTokenPrice();

            await network.provider.send("evm_increaseTime", [roundDuration]);
            await acdmPlatform.startTradeRound();
            await putOrder(amount, price, alice);
            const cancelOrderTxPromise: Promise<any> = acdmPlatform.connect(bob).cancelOrder(orderId);

            await expect(cancelOrderTxPromise).to.be.revertedWith("Not the order owner");
        });

        it("Should fail if the transfer of acdm tokens failed", async function() {
            const orderId: number = 0;
            const amount: number = 1;
            const price: BigNumber = await acdmPlatform.currentTokenPrice();
            const aliceAddress: string = await alice.getAddress();
            await acdmTokenMock.transfer.whenCalledWith(aliceAddress, amount).returns(false);

            await network.provider.send("evm_increaseTime", [roundDuration]);
            await acdmPlatform.startTradeRound();
            await putOrder(amount, price, alice);
            const cancelOrderTxPromise: Promise<any> = acdmPlatform.cancelOrder(orderId);

            await expect(cancelOrderTxPromise).to.be.revertedWith("SafeERC20: ERC20 operation did not succeed");
        });

        it("Should emit the CancelOrder event on success", async function() {
            const orderId: number = 0;
            const amount: number = 1;
            const price: BigNumber = await acdmPlatform.currentTokenPrice();
            const aliceAddress: string = await alice.getAddress();
            await acdmTokenMock.transfer.whenCalledWith(aliceAddress, amount).returns(true);

            await network.provider.send("evm_increaseTime", [roundDuration]);
            await acdmPlatform.startTradeRound();
            await putOrder(amount, price, alice);
            const cancelOrderTxPromise: Promise<any> = acdmPlatform.cancelOrder(orderId);

            await expect(cancelOrderTxPromise).to.emit(acdmPlatform, "CancelOrder").withArgs(orderId);
        });
   });

   describe("redeemOrder", async function() {
        it("Should fail if the SALE round is in progress", async function() {
            const orderId: number = 0;

            const redeemOrderTxPromise: Promise<any> = acdmPlatform.redeemOrder(orderId);

            await expect(redeemOrderTxPromise).to.be.revertedWith("Not a 'Trade' round");
        });

        it("Should fail if order doesn't exists", async function() {
            const orderId: number = 0;

            await network.provider.send("evm_increaseTime", [roundDuration]);
            await acdmPlatform.startTradeRound();
            const redeemOrderTxPromise: Promise<any> = acdmPlatform.redeemOrder(orderId);

            await expect(redeemOrderTxPromise).to.be.revertedWith("Order does not exist");
        });

        it("Should fail if order doesn't exists", async function() {
            const orderId: number = 0;

            await network.provider.send("evm_increaseTime", [roundDuration]);
            await acdmPlatform.startTradeRound();
            await network.provider.send("evm_increaseTime", [roundDuration]);
            const redeemOrderTxPromise: Promise<any> = acdmPlatform.redeemOrder(orderId);

            await expect(redeemOrderTxPromise).to.be.revertedWith("Round is over");
        });

        it("Should fail if not enough msg.value was given", async function() {
            const orderId: number = 0;
            const amount: number = 1;
            const price: number = (ethers.utils.parseEther("0.001")).toNumber();

            await network.provider.send("evm_increaseTime", [roundDuration]);
            await acdmPlatform.startTradeRound();
            await putOrder(amount, price, alice);
            const redeemOrderTxPromise: Promise<any> = acdmPlatform.redeemOrder(orderId);

            await expect(redeemOrderTxPromise).to.be.revertedWith("Too low msg.value");
        });

        it("Should fail if transfer of acmd tokens failed", async function() {
            const orderId: number = 0;
            const amount: number = 1;
            const price: number = (ethers.utils.parseEther("0.0000001")).toNumber();
            const value: number = (ethers.utils.parseEther("0.000001")).toNumber();
            const aliceAddress: string = await alice.getAddress();
            await acdmTokenMock.transfer.whenCalledWith(aliceAddress, amount).returns(false);

            await network.provider.send("evm_increaseTime", [roundDuration]);
            await acdmPlatform.startTradeRound();
            await putOrder(amount, price, alice);
            const redeemOrderTxPromise: Promise<any> = acdmPlatform.redeemOrder(orderId, {value: value});

            await expect(redeemOrderTxPromise).to.be.revertedWith("SafeERC20: ERC20 operation did not succeed");
        });

        it("Should transfer a leftover back to the sender", async function() {
            const aliceAddress: string = await alice.getAddress();
            const bobAddress: string = await bob.getAddress();
            const orderId: number = 0;
            const tokenDecimals: BigNumber = await acdmTokenMock.decimals();
            const tokenPrice: BigNumber = BigNumber.from(ethers.utils.parseEther("0.0001"));
            const putAmount: BigNumber = BigNumber.from(2).mul(BigNumber.from(10).pow(tokenDecimals)); //2 tokens
            const weiPerDecimal: BigNumber = tokenPrice.div(BigNumber.from(10).pow(tokenDecimals));
            const expectedLeftover: BigNumber = weiPerDecimal;
            const value: BigNumber = putAmount.mul(weiPerDecimal).add(expectedLeftover);
            await acdmTokenMock.balanceOf.whenCalledWith(bobAddress).returns(putAmount);
            await acdmTokenMock.allowance.whenCalledWith(bobAddress, acdmPlatform.address).returns(putAmount);
            await acdmTokenMock.transferFrom.whenCalledWith(bobAddress, acdmPlatform.address, putAmount).returns(true);
            await acdmTokenMock.transfer.whenCalledWith(aliceAddress, putAmount).returns(true);

            await network.provider.send("evm_increaseTime", [roundDuration]);
            await acdmPlatform.startTradeRound();
            await putOrder(putAmount, tokenPrice, bob);
            const aliceBalanceBefore: BigNumber = await alice.getBalance();
            const redeemOrderTx: any = await acdmPlatform.redeemOrder(orderId, {value: value});
            const redeemOrderTxReceipt: any = await redeemOrderTx.wait();
            const gasUsed: BigNumber = redeemOrderTxReceipt.gasUsed.mul(redeemOrderTxReceipt.effectiveGasPrice);
            const expectedAliceBalanceAfter: BigNumber = aliceBalanceBefore.sub(value).add(expectedLeftover).sub(gasUsed);
            const actualAliceBalanceAfter: BigNumber = await alice.getBalance();

            await expect(expectedAliceBalanceAfter).to.equal(actualAliceBalanceAfter);
        });

        it("Should emit TradeOrder event", async function() {
            const orderId: number = 0;
            const amount: number = 1;
            const price: number = (ethers.utils.parseEther("0.000001")).toNumber();
            const value: number = price;
            const aliceAddress: string = await alice.getAddress();
            await acdmTokenMock.transfer.whenCalledWith(aliceAddress, amount).returns(true);

            await network.provider.send("evm_increaseTime", [roundDuration]);
            await acdmPlatform.startTradeRound();
            await putOrder(amount, price, alice);
            const redeemOrderTxPromise: Promise<any> = acdmPlatform.redeemOrder(orderId, {value: value});

            await expect(redeemOrderTxPromise).to.emit(acdmPlatform, "TradeOrder").withArgs(orderId, aliceAddress, amount);
        });
   });

   describe("buy", async function() {
        it("Should fail if the TRADE round is in progress", async function() {
            await network.provider.send("evm_increaseTime", [roundDuration]);
            await acdmPlatform.startTradeRound();
            const buyTxPromise: Promise<any> = acdmPlatform.buy();

            await expect(buyTxPromise).to.be.revertedWith("Not a 'Sale' round");
        });

        it("Should fail if not enough value given", async function() {
            const value: number = 0;

            const buyTxPromise: Promise<any> = acdmPlatform.buy({value: value});

            await expect(buyTxPromise).to.be.revertedWith("Too low msg.value");
        });

        it("Should fail if not enough value given", async function() {
            const value: number = 0;

            await network.provider.send("evm_increaseTime", [roundDuration]);
            const buyTxPromise: Promise<any> = acdmPlatform.buy({value: value});

            await expect(buyTxPromise).to.be.revertedWith("Round is over");
        });

        it("Should fail if acdm tokens transfer failed", async function() {
            const amount: number = 1;
            const aliceAddress: string = await alice.getAddress();
            const value: BigNumber = await acdmPlatform.currentTokenPrice();
            await acdmTokenMock.transfer.whenCalledWith(aliceAddress, amount).returns(false);

            const buyTxPromise: Promise<any> = acdmPlatform.buy({value: value});

            await expect(buyTxPromise).to.be.revertedWith("SafeERC20: ERC20 operation did not succeed");
        });

        it("Should transfer a leftover back to the sender", async function() {
            const aliceAddress: string = await alice.getAddress();
            const weiPerDecimal: BigNumber = await weiPerDecimalInSaleRound();
            const tokensTotal: BigNumber = await acdmPlatform.tokensIssued();
            const expectedLeftover: BigNumber = weiPerDecimal;
            const value: BigNumber = tokensTotal.mul(weiPerDecimal).add(expectedLeftover);
            await acdmTokenMock.transfer.whenCalledWith(aliceAddress, tokensTotal).returns(true);

            const aliceBalanceBefore: BigNumber = await alice.getBalance();
            const buyTx: any = await acdmPlatform.buy({value: value});
            const buyTxReceipt: any = await buyTx.wait();
            const gasUsed: BigNumber = buyTxReceipt.gasUsed.mul(buyTxReceipt.effectiveGasPrice);
            const expectedAliceBalanceAfter: BigNumber = aliceBalanceBefore.sub(value).add(expectedLeftover).sub(gasUsed);
            const actualAliceBalanceAfter: BigNumber = await alice.getBalance();

            await expect(expectedAliceBalanceAfter).to.equal(actualAliceBalanceAfter);
        });

        it("Should emit the SaleOrder event", async function() {
            const acdmTokenDecimals: BigNumber = await acdmTokenMock.decimals();
            const amount: BigNumber = BigNumber.from(1).mul(BigNumber.from(10).pow(acdmTokenDecimals));
            const aliceAddress: string = await alice.getAddress();
            const value: BigNumber = await acdmPlatform.currentTokenPrice();
            await acdmTokenMock.transfer.whenCalledWith(aliceAddress, amount).returns(true);

            const buyTxPromise: Promise<any> = acdmPlatform.buy({value: value});

            await expect(buyTxPromise).to.emit(acdmPlatform, "SaleOrder").withArgs(aliceAddress, amount);
        });

        it("Should fail if no more tokens available", async function() {
            const acdmTokenDecimals: BigNumber = await acdmTokenMock.decimals();
            const amount: BigNumber = BigNumber.from(tokensIssued).mul(BigNumber.from(10).pow(acdmTokenDecimals));
            const aliceAddress: string = await alice.getAddress();
            const value: BigNumber = amount.mul(await acdmPlatform.currentTokenPrice());
            await acdmTokenMock.transfer.whenCalledWith(aliceAddress, amount).returns(true);

            await acdmPlatform.buy({value: value});
            const buyTxPromise: Promise<any> = acdmPlatform.buy({value: value});

            await expect(buyTxPromise).to.be.revertedWith("No more tokens");
        });
   });

   describe("register", async function() {
        it("Should fail if the sender is already registered", async function() {
            await acdmPlatform.register(ethers.constants.AddressZero);
            const registerTxPromise: Promise<any> = acdmPlatform.register(ethers.constants.AddressZero);

            await expect(registerTxPromise).to.be.revertedWith("Already registered");
        });

        it("Should fail if the referrer is not registered", async function() {
            const referrerAddress: string = await bob.getAddress();

            const registerTxPromise: Promise<any> = acdmPlatform.register(referrerAddress);

            await expect(registerTxPromise).to.be.revertedWith("Referrer is not registered");
        });

        it("Should fail if the sender is the referrer", async function() {
            const referrerAddress: string = await alice.getAddress();

            const registerTxPromise: Promise<any> = acdmPlatform.register(referrerAddress);

            await expect(registerTxPromise).to.be.revertedWith("Sender can't be a referrer");
        });

        it("Should succeed if the sender is not already registered and is not the referrer", async function() {
            const referrerAddress: string = await bob.getAddress();

            await acdmPlatform.connect(bob).register(ethers.constants.AddressZero);
            await acdmPlatform.register(referrerAddress);
        });
   });

    describe("spendFees", async function() {
        it("Should fail if a caller is not the DAO", async function() {
            const sendToOwner: boolean = true;

            const spendFeesTxPromise: Promise<any> = acdmPlatform.spendFees(sendToOwner);

            await expect(spendFeesTxPromise).to.be.revertedWith("Caller is not the DAO");
        });

        it("Should transfer fees to owner", async function() {
            const orderId: number = 0;
            const amount: number = 1;
            const price: number = (ethers.utils.parseEther("0.000001")).toNumber();
            const weiPerDecimal: number =
                BigNumber.from(price).div(BigNumber.from(10).pow(await acdmTokenMock.decimals())).toNumber();
            const value: number = (ethers.utils.parseEther("0.000001")).toNumber();
            const aliceAddress: string = await alice.getAddress();
            const expectedFee: number = amount * weiPerDecimal * referrerTradeFee * 2 / 100;
            await acdmTokenMock.transfer.whenCalledWith(aliceAddress, amount).returns(true);

            await alice.sendTransaction({ to: daoMock.address, value: ethers.utils.parseEther("0.5") });
            await network.provider.send("evm_increaseTime", [roundDuration]);
            await acdmPlatform.startTradeRound();
            await putOrder(amount, price, alice);
            await acdmPlatform.redeemOrder(orderId, {value: value});
            const ownerBalanceBefore: BigNumber = await alice.getBalance();
            await acdmPlatform.connect(daoMock.wallet).spendFees(true);
            const ownerBalanceAfter: BigNumber = await alice.getBalance();

            await expect(expectedFee).to.equal(ownerBalanceAfter.sub(ownerBalanceBefore).toNumber());
        });

        it("Should swap fees for XXX tokens and burn them", async function() {
            async function getBlockTS(): Promise<number> {
                const blockNumBefore = await ethers.provider.getBlockNumber();
                const blockBefore = await ethers.provider.getBlock(blockNumBefore);
                return blockBefore.timestamp;
            }

            const orderId: number = 0;
            const amount: number = 1;
            const price: number = (ethers.utils.parseEther("0.000001")).toNumber();
            const value: number = (ethers.utils.parseEther("0.000001")).toNumber();
            const aliceAddress: string = await alice.getAddress();
            await acdmTokenMock.transfer.whenCalledWith(aliceAddress, amount).returns(true);
            const amountOutMin: number = 0;
            const path: string[] = [await uniswapRouterMock.WETH(), xxxTokenMock.address];
            const amounts: number[] = [0, 0, 20];

            //todo arefev: refactoring
            await alice.sendTransaction({ to: daoMock.address, value: ethers.utils.parseEther("0.5") });
            await network.provider.send("evm_increaseTime", [roundDuration]);
            await acdmPlatform.startTradeRound();
            await putOrder(amount, price, alice);
            await acdmPlatform.redeemOrder(orderId, {value: value});
            const nextBlockTimestamp: number = (await getBlockTS()) + 1; //in order to make a deadline predictable
            const deadline: number = nextBlockTimestamp + 15;
            await network.provider.send("evm_setNextBlockTimestamp", [nextBlockTimestamp])
            await uniswapRouterMock.swapExactETHForTokens
                .whenCalledWith(amountOutMin, path, acdmPlatform.address, deadline).returns(amounts);
            await acdmPlatform.connect(daoMock.wallet).spendFees(false);

            expect(uniswapRouterMock.swapExactETHForTokens).to.be.calledOnceWith(amountOutMin, path, acdmPlatform.address, deadline);
            expect(xxxTokenMock.burn).to.be.calledOnceWith(amounts[2]);
        });
   });

    describe("startTradeRound", async function() {
        it("Should fail if current round is TRADE", async function() {
            await network.provider.send("evm_increaseTime", [roundDuration]);
            await acdmPlatform.startTradeRound();
            const startTradeRoundTxPromise: Promise<any> = acdmPlatform.startTradeRound();

            await expect(startTradeRoundTxPromise).to.be.revertedWith("Current round is TRADE");
        });

        it("Should fail if deadline is not met", async function() {
            const startTradeRoundTxPromise: Promise<any> = acdmPlatform.startTradeRound();

            await expect(startTradeRoundTxPromise).to.be.revertedWith("Not ready yet");
        });

        it("Should burn excessive amount of acdmTokens", async function() {
            const tokensIssuedDecimals: BigNumber =
                BigNumber.from(tokensIssued).mul(BigNumber.from(10).pow(await acdmTokenMock.decimals()));

            await network.provider.send("evm_increaseTime", [roundDuration]);
            await acdmPlatform.startTradeRound();

            expect(acdmTokenMock.burn).to.be.calledOnceWith(tokensIssuedDecimals);
        });

        it("Should proceed if all tokens were sold during the SALE round", async function() {
            const tokensIssuedDecimals: BigNumber = await acdmPlatform.tokensIssued();
            const value: BigNumber = tokensIssuedDecimals.mul(tokensIssuedDecimals);
            const aliceAddress: string = await alice.getAddress();
            network.config.gasPrice = 0;
            await acdmTokenMock.transfer.whenCalledWith(aliceAddress, tokensIssuedDecimals).returns(true);

            await acdmPlatform.buy({value: value});
            await acdmPlatform.startTradeRound();
         });

        it("Should emit RoundSwitch event", async function() {
            await network.provider.send("evm_increaseTime", [roundDuration]);
            const startTradeRoundTxPromise: Promise<any> = acdmPlatform.startTradeRound();

            await expect(startTradeRoundTxPromise).to.emit(acdmPlatform, "RoundSwitch").withArgs(0);
        });
    });

    describe("startSaleRound", async function() {
         it("Should fail if current round is SALE", async function() {
            const startSaleRoundTxPromise: Promise<any> = acdmPlatform.startSaleRound();

            await expect(startSaleRoundTxPromise).to.be.revertedWith("Current round is SALE");
         });

         it("Should fail if deadline is not met", async function() {
            await network.provider.send("evm_increaseTime", [roundDuration]);
            await acdmPlatform.startTradeRound();
            const startSaleRoundTxPromise: Promise<any> = acdmPlatform.startSaleRound();

            await expect(startSaleRoundTxPromise).to.be.revertedWith("Round deadline is not met");
         });

         it("Should mint ACDM tokens if trade volumes was not zero", async function() {
            const orderId: number = 0;
            const amount: number = 10_000_000;
            const tradePrice: number = (ethers.utils.parseEther("0.000001")).toNumber();
            const decimals: BigNumber = BigNumber.from(10).pow(await acdmTokenMock.decimals());
            const weiPerDecimal: number = BigNumber.from(tradePrice).div(decimals).toNumber();
            const value: number = amount * weiPerDecimal;
            const aliceAddress: string = await alice.getAddress();
            const salePrice: BigNumber = await acdmPlatform.currentTokenPrice();
            const expectedTokenIssuance: BigNumber = BigNumber.from(value).div(salePrice).mul(decimals);
            await acdmTokenMock.transfer.whenCalledWith(aliceAddress, amount).returns(true);
            await acdmTokenMock.mint.reset();

            await network.provider.send("evm_increaseTime", [roundDuration]);
            await acdmPlatform.startTradeRound();
            await putOrder(amount, tradePrice, alice);
            await acdmPlatform.redeemOrder(orderId, {value: value});
            await network.provider.send("evm_increaseTime", [roundDuration]);
            await acdmPlatform.startSaleRound();

            expect(acdmTokenMock.mint).to.be.calledOnceWith(expectedTokenIssuance, acdmPlatform.address);
         });

         it("Should not mint ACDM tokens if trade volumes was zero", async function() {
            await acdmTokenMock.mint.reset();

            await network.provider.send("evm_increaseTime", [roundDuration]);
            await acdmPlatform.startTradeRound();
            await network.provider.send("evm_increaseTime", [roundDuration]);
            await acdmPlatform.startSaleRound();

            expect(acdmTokenMock.mint).to.have.callCount(0);
         });

         it("Should emit RoundSwitch event", async function() {
            await network.provider.send("evm_increaseTime", [roundDuration]);
            await acdmPlatform.startTradeRound();
            await network.provider.send("evm_increaseTime", [roundDuration]);
            const startSaleRoundTxPromise: Promise<any> = acdmPlatform.startSaleRound();

            await expect(startSaleRoundTxPromise).to.emit(acdmPlatform, "RoundSwitch").withArgs(1);
         });
    });

    describe("referral program", async function() {
        it("Should send referral fees in TRADE round", async function() {
            const orderId: number = 0;
            const tokenDecimals: BigNumber = await acdmTokenMock.decimals();
            const putAmount: number =
                BigNumber.from(2).mul(BigNumber.from(10).pow(tokenDecimals)).toNumber(); //todo arefev: cre utility function
            const buyAmount: number = BigNumber.from(10).pow(tokenDecimals).toNumber();
            const price: number = (ethers.utils.parseEther("0.000001")).toNumber();
            const value: number = price;
            const weiPerDecimal: number = BigNumber.from(price).div(BigNumber.from(10).pow(tokenDecimals)).toNumber();
            const aliceAddress: string = await alice.getAddress();
            const bobAddress: string = await bob.getAddress();
            const maloryAddress: string = await malory.getAddress();
            const feeAmount: number = buyAmount * weiPerDecimal * referrerTradeFee / 100;
            await acdmTokenMock.transfer.whenCalledWith(aliceAddress, buyAmount).returns(true);

            await acdmPlatform.connect(malory).register(ethers.constants.AddressZero);
            await acdmPlatform.connect(bob).register(maloryAddress);
            await acdmPlatform.register(bobAddress);
            await network.provider.send("evm_increaseTime", [roundDuration]);
            await acdmPlatform.startTradeRound();
            await putOrder(putAmount, price, alice);
            const redeemOrderTxPromise: Promise<any> = acdmPlatform.redeemOrder(orderId, {value: value});

            await expect(redeemOrderTxPromise).to.emit(acdmPlatform, "ReferralPayment").withArgs(bobAddress, feeAmount);
            await expect(redeemOrderTxPromise).to.emit(acdmPlatform, "ReferralPayment").withArgs(maloryAddress, feeAmount);
        });

        it("Should send referral fees in SALE round", async function() {
            const amount: number = BigNumber.from(1).mul(BigNumber.from(10).pow(acdmTokenDecimals)).toNumber();
            const weiPerDecimal: number = (await weiPerDecimalInSaleRound()).toNumber();
            const aliceAddress: string = await alice.getAddress();
            const bobAddress: string = await bob.getAddress();
            const maloryAddress: string = await malory.getAddress();
            const value: BigNumber = await acdmPlatform.currentTokenPrice();
            const fristReferrerFeeAmount: number = amount * weiPerDecimal * firstReferrerSaleFee / 100;
            const secondReferrerFeeAmount: number = amount * weiPerDecimal * secondReferrerSaleFee / 100;
            await acdmTokenMock.transfer.whenCalledWith(aliceAddress, amount).returns(true);

            await acdmPlatform.connect(malory).register(ethers.constants.AddressZero);
            await acdmPlatform.connect(bob).register(maloryAddress);
            await acdmPlatform.register(bobAddress);
            const buyTxPromise: Promise<any> = acdmPlatform.buy({ value: value });

            await expect(buyTxPromise).to.emit(acdmPlatform, "ReferralPayment").withArgs(bobAddress, fristReferrerFeeAmount);
            await expect(buyTxPromise).to.emit(acdmPlatform, "ReferralPayment").withArgs(maloryAddress, secondReferrerFeeAmount);
        });

        it("Should not send referral fees if there are no referrers", async function() {
            const orderId: number = 0;
            const amount: number = 1;
            const price: number = (ethers.utils.parseEther("0.000001")).toNumber();
            const value: number = price;
            const aliceAddress: string = await alice.getAddress();
            await acdmTokenMock.transfer.whenCalledWith(aliceAddress, amount).returns(true);

            await acdmPlatform.register(ethers.constants.AddressZero);
            await network.provider.send("evm_increaseTime", [roundDuration]);
            await acdmPlatform.startTradeRound();
            await putOrder(amount, price, alice);
            const redeemOrderTxPromise: Promise<any> = acdmPlatform.redeemOrder(orderId, {value: value});

            await expect(redeemOrderTxPromise).not.to.emit(acdmPlatform, "ReferralPayment");
        });
    });

   describe("setters", async function() {
        it("Should allow for the owner to change round duration", async function() {
            const expectedRoundDuration: number = (await acdmPlatform.roundDuration()).toNumber() + 1;

            await acdmPlatform.setRoundDuration(expectedRoundDuration);
            const actualRoundDuration: number = (await acdmPlatform.roundDuration()).toNumber();

            await expect(expectedRoundDuration).to.equal(actualRoundDuration);
        });

        it("Should not allow for non-owner to change round duration", async function() {
            const newRoundDuration: number = 10;

            const setRoundDurationTxPromise: Promise<any> =
                acdmPlatform.connect(bob).setRoundDuration(newRoundDuration);

            await expect(setRoundDurationTxPromise).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("Should not allow to set round duration to 0", async function() {
            const newRoundDuration: number = 0;

            const setRoundDurationTxPromise: Promise<any> = acdmPlatform.setRoundDuration(newRoundDuration);

            await expect(setRoundDurationTxPromise).to.be.revertedWith("Can't be zero");
        });

        it("Should allow for the owner to change first referrer sale fee", async function() {
            const expectedFirstReferrerSaleFee: number = (await acdmPlatform.firstReferrerSaleFee()).toNumber() + 1;

            await acdmPlatform.setFirstReferrerSaleFee(expectedFirstReferrerSaleFee);
            const actualFirstReferrerSaleFee: number = (await acdmPlatform.firstReferrerSaleFee()).toNumber();

            await expect(expectedFirstReferrerSaleFee).to.equal(actualFirstReferrerSaleFee);
        });

        it("Should not allow for non-owner to change first referrer sale fee", async function() {
            const newFirstReferrerSaleFee: number = 10;

            const setFirstReferrerSaleFeeTxPromise: Promise<any> =
                acdmPlatform.connect(bob).setFirstReferrerSaleFee(newFirstReferrerSaleFee);

            await expect(setFirstReferrerSaleFeeTxPromise).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("Should allow for the owner to change second referrer sale fee", async function() {
            const expectedSecondReferrerSaleFee: number = (await acdmPlatform.secondReferrerSaleFee()).toNumber() + 1;

            await acdmPlatform.setSecondReferrerSaleFee(expectedSecondReferrerSaleFee);
            const actualSecondReferrerSaleFee: number = (await acdmPlatform.secondReferrerSaleFee()).toNumber();

            await expect(expectedSecondReferrerSaleFee).to.equal(actualSecondReferrerSaleFee);
        });

        it("Should not allow for non-owner to change second referrer sale fee", async function() {
            const newSecondReferrerSaleFee: number = 10;

            const setSecondReferrerSaleFeeTxPromise: Promise<any> =
                acdmPlatform.connect(bob).setSecondReferrerSaleFee(newSecondReferrerSaleFee);

            await expect(setSecondReferrerSaleFeeTxPromise).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("Should allow for the owner to change referrer trade fee", async function() {
            const expectedReferrerTradeFee: number = (await acdmPlatform.referrerTradeFee()).toNumber() + 1;

            await acdmPlatform.setReferrerTradeFee(expectedReferrerTradeFee);
            const actualReferrerTradeFee: number = (await acdmPlatform.referrerTradeFee()).toNumber();

            await expect(expectedReferrerTradeFee).to.equal(actualReferrerTradeFee);
        });

        it("Should not allow for non-owner to change referrer trade fee", async function() {
            const newReferrerTradeFee: number = 10;

            const setReferrerTradeFeeTxPromise: Promise<any> =
                acdmPlatform.connect(bob).setReferrerTradeFee(newReferrerTradeFee);

            await expect(setReferrerTradeFeeTxPromise).to.be.revertedWith("Ownable: caller is not the owner");
        });
   });

   describe("misc", async function() {
        it("Should return valid order amount", async function() {
            const orderId: number = 0;
            const amount: number = 1;
            const price: number = (ethers.utils.parseEther("0.000001")).toNumber();

            await network.provider.send("evm_increaseTime", [roundDuration]);
            await acdmPlatform.startTradeRound();
            await putOrder(amount, price, alice);
            const actualOrderAmount: number = (await acdmPlatform.orderAmount(orderId)).toNumber();

            await expect(amount).to.equal(actualOrderAmount);
        });
   });
});