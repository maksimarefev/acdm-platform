import { execSync } from "child_process";
import { ethers, network } from "hardhat";
import { Contract, BigNumber } from "ethers";
import { Fetcher, WETH, Token, Pair } from "@uniswap/sdk";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ACDMToken, ACDMToken__factory, XXXToken, XXXToken__factory, DAO, DAO__factory, Staking, Staking__factory, ACDMPlatform, ACDMPlatform__factory } from '../typechain-types';

type TransactionReceipt = {
    status?: number,
    gasUsed?: BigNumber,
    transactionHash?: string,
    effectiveGasPrice?: BigNumber
}

type Transaction = {
    hash: string,
    wait(): Promise<TransactionReceipt>
}

type TxOptions = {
    value?: BigNumber,
    gasLimit?: BigNumber
};

function getUniswapV2RouterContract(signer: SignerWithAddress, routerAddress: string): Contract {
    return new ethers.Contract(
        routerAddress, //the same for every network
        [
            "function addLiquidityETH("
                + " address token,"
                + " uint amountTokenDesired,"
                + " uint amountTokenMin,"
                + " uint amountETHMin,"
                + " address to,"
                + " uint deadline"
         + ") external payable returns (uint amountToken, uint amountETH, uint liquidity)"
        ],
        signer
    );
}

async function executeTx(callback: () => Promise<Transaction>): Promise<void> {
    const receipt: TransactionReceipt = await (await callback()).wait();
    console.table({
        gasUsed: receipt.gasUsed.toString(),
        totalCost: receipt.gasUsed.mul(receipt.effectiveGasPrice).toString()
    });

    if (!receipt.status) {
        throw new Error("Transaction failed: " + receipt.transactionHash);
    }
}

function verify(contractAddress: string, ...constructorParameters: any[]) {
    if (!contractAddress) {
        console.error("No contract address was provided");
        return;
    }

    const constructorParametersAsString: string =
        !constructorParameters || constructorParameters.length == 0 ? "" : constructorParameters.join(" ");
    const command: string =
        "npx hardhat verify --network " + network.name + " " + contractAddress + " " + constructorParametersAsString;
    console.log("Running command:", command);

    try {
        execSync(command, { encoding: "utf-8" });
    } catch (error) {
        //do nothing, it always fails but in fact a contract becomes verified
    }
}

async function main() {
    const blockExplorerUrl: string = "https://" + network.name + ".etherscan.io/address/";
    const contractAddresses: Record<string, string> = {};

    const accounts: SignerWithAddress[] = await ethers.getSigners();

    if (accounts.length == 0) {
        throw new Error('No accounts were provided');
    }

    const signer: SignerWithAddress = accounts[0];
    const signerAddress: string = await signer.getAddress();
    console.log("Deploying contracts with the account:", signerAddress);

    console.log("Deploying XXXToken contract");
    const xxxTokenFactory: XXXToken__factory = (await ethers.getContractFactory("XXXToken")) as XXXToken__factory;
    const xxxToken: XXXToken = await xxxTokenFactory.deploy();
    await xxxToken.deployed();
    contractAddresses["XXXToken"] = blockExplorerUrl + xxxToken.address;
    console.log("XXXToken contract had been deployed to:", xxxToken.address);

    const minimumQuorum: number = 30; //30%
    const debatingPeriodDuration: number = 3 * 60; //3 min
    console.log("Deploying DAO contract");
    const DAO: DAO__factory = (await ethers.getContractFactory("DAO")) as DAO__factory;
    const dao: DAO = await DAO.deploy(signerAddress, minimumQuorum, debatingPeriodDuration);
    await dao.deployed();
    contractAddresses["DAO"] = blockExplorerUrl + dao.address;
    console.log("DAO contract had been deployed to:", dao.address);

    const routerAddress: string = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
    const lpTokenAddress: string = await createLiquidityPool(signer, xxxToken, routerAddress);
    contractAddresses["lpTokenAddress"] = blockExplorerUrl + lpTokenAddress;
    const rewardPercentage: number = 3; //3%
    const rewardPeriod: number = 3 * 60; //5 min
    const stakeWithdrawalTimeout: number = 3 * 60; //3 min;
    console.log("Deploying Staking contract");
    const stakingFactory: Staking__factory = (await ethers.getContractFactory("Staking")) as Staking__factory;
    const staking: Staking = await stakingFactory.deploy(
        lpTokenAddress, xxxToken.address, rewardPercentage, rewardPeriod, stakeWithdrawalTimeout, dao.address
    );
    await staking.deployed();
    contractAddresses["Staking"] = blockExplorerUrl + staking.address;
    console.log("Staking contract had been deployed to:", staking.address);

    console.log("Initializing DAO");
    await executeTx(() => dao.init(staking.address));
    console.log("DAO was initialized");

    const roundDuration: number = 5 * 60; // 5 min
    const firstReferrerSaleFee: number = 5; // 5%
    const secondReferrerSaleFee: number = 3; // 3%
    const referrerTradeFee: number = 2; // 2%
    console.log("Deploying ACDMPlatform contract");
    const adcmPlatformFactory: ACDMPlatform__factory =
        (await ethers.getContractFactory("ACDMPlatform")) as ACDMPlatform__factory;
    const acdmPlatform: ACDMPlatform = await adcmPlatformFactory.deploy(
        routerAddress, xxxToken.address, dao.address, roundDuration, firstReferrerSaleFee, secondReferrerSaleFee, referrerTradeFee
    );
    await acdmPlatform.deployed();
    contractAddresses["ACDMPlatform"] = blockExplorerUrl + acdmPlatform.address;
    console.log("ACDMPlatform contract had been deployed to:", acdmPlatform.address);

    console.log("Deploying ACDMToken contract");
    const adcmTokenFactory: ACDMToken__factory = (await ethers.getContractFactory("ACDMToken")) as ACDMToken__factory;
    const acdmToken: ACDMToken = await adcmTokenFactory.deploy(acdmPlatform.address);
    await acdmToken.deployed();
    contractAddresses["ACDMToken"] = blockExplorerUrl + acdmToken.address;
    console.log("ACDMToken contract had been deployed to:", acdmToken.address);

    const initialTokensSupply: number = 100_000; // 100 000 ACDM
    const initialTokenPrice: BigNumber = BigNumber.from(10).pow(13); //0.00001 ETH
    console.log("Initializing ACDM platform");
    await executeTx(() => acdmPlatform.init(acdmToken.address, initialTokensSupply, initialTokenPrice));
    console.log("ACDM platform was initialized");

    console.log("Verifying XXXToken contract");
    verify(xxxToken.address);
    console.log("XXXToken contract was verfied");

    console.log("Verifying DAO contract");
    verify(dao.address, signerAddress, minimumQuorum, debatingPeriodDuration);
    console.log("DAO contract was verfied");

    console.log("Verifying Staking contract");
    verify(
        staking.address, lpTokenAddress, xxxToken.address, rewardPercentage, rewardPeriod, stakeWithdrawalTimeout, dao.address
    );
    console.log("Staking contract was verfied");

    console.log("Verifying ACDMPlatform contract"); //todo: why isn't it verified
    verify(
        acdmPlatform.address,
        routerAddress,
        xxxToken.address,
        dao.address,
        roundDuration,
        firstReferrerSaleFee,
        secondReferrerSaleFee,
        referrerTradeFee
    );
    console.log("ACDMPlatform contract was verfied");

    console.log("Verifying ACDMToken contract");
    verify(acdmToken.address, acdmPlatform.address);
    console.log("ACDMToken contract was verfied");

    console.table(contractAddresses)
}

/**
 * @returns LP token address
 */
async function createLiquidityPool(signer: SignerWithAddress, xxxTokenContract: XXXToken, routerAddress: string): Promise<string> {
    function priceFluctuationPercentage(supply: BigNumber, percent: number): BigNumber {
        const percentage: BigNumber = supply.mul(BigNumber.from(percent)).div(BigNumber.from(100));
        return supply.sub(percentage);
    }

    const xxxTokenInitialSupply: BigNumber = BigNumber.from(100);
    const xxxTokenDecimals: BigNumber = BigNumber.from(await xxxTokenContract.decimals());
    const xxxTokenInitialSupplyDecimals: BigNumber = xxxTokenInitialSupply.mul(BigNumber.from(10).pow(xxxTokenDecimals));
    console.log("Minting %s of XXX tokens to %s", xxxTokenInitialSupply.toString(), signer.address);
    await executeTx(() => xxxTokenContract.mint(xxxTokenInitialSupplyDecimals, signer.address));
    console.log("Successfully minted");

    console.log("Approving for the uniswap router to transfer XXX tokens");
    await executeTx(() => xxxTokenContract.approve(routerAddress, xxxTokenInitialSupplyDecimals));
    console.log("Successfully approved");

    const xxxToken: Token = await Fetcher.fetchTokenData(network.config.chainId, xxxTokenContract.address);
    const xxxTokenPriceInWei: BigNumber = ethers.utils.parseEther("0.00001");
    const etherSupplyInWei: BigNumber = xxxTokenInitialSupply.mul(xxxTokenPriceInWei);
    const xxxTokensSupplyMin: BigNumber = priceFluctuationPercentage(xxxTokenInitialSupplyDecimals, 2);
    const etherSupplyMin: BigNumber = priceFluctuationPercentage(etherSupplyInWei, 2);
    const deadline: number = (await ethers.provider.getBlock("latest")).timestamp + 100;
    const txOptions: TxOptions = { value: etherSupplyInWei, gasLimit: BigNumber.from(3_000_000) };
    const uniswapV2Router: Contract = getUniswapV2RouterContract(signer, routerAddress);

    console.log("Adding liquidity XXXToken/WETH");
    console.table({
        token: xxxToken.address,
        amountTokenDesired: xxxTokenInitialSupplyDecimals.toString(),
        amountTokenMin: xxxTokensSupplyMin.toString(),
        amountETHMin: etherSupplyMin.toString(),
        to: signer.address,
        deadline: deadline,
        ethersSupply: etherSupplyInWei.toString()
    });
    await executeTx(() => uniswapV2Router.addLiquidityETH(
        xxxToken.address,               // Token address
        xxxTokenInitialSupplyDecimals,  // The amount of token to add as liquidity if the WETH/token price is <= msg.value/amountTokenDesired
        xxxTokensSupplyMin,             // Bounds the extent to which the WETH/token price can go up before the transaction reverts
        etherSupplyMin,                 // Bounds the extent to which the token/WETH price can go up before the transaction reverts. Must be <= msg.value.
        signer.address,                 // Recipient of the liquidity tokens
        deadline,                       // Unix timestamp after which the transaction will revert.
        txOptions                       // msg.value & gas limit
    ));

    const pair: Pair = await Fetcher.fetchPairData(xxxToken, WETH[network.config.chainId]);
    return pair?.liquidityToken?.address;
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
