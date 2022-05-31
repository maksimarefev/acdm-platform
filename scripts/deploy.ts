import { execSync } from "child_process";
import { ethers, network } from "hardhat";
import { Contract, BigNumber } from "ethers";
import { Fetcher, WETH, Token, Pair } from "@uniswap/sdk";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ACDMToken, ACDMToken__factory, XXXToken, XXXToken__factory, DAO, DAO__factory } from '../typechain-types';

//todo arefev: handle every receipt
async function main() {
    const accounts: SignerWithAddress[] = await ethers.getSigners();

    if (accounts.length == 0) {
        throw new Error('No accounts were provided');
    }

    const signer: SignerWithAddress = accounts[0];
    const signerAddress: string = await signer.getAddress();
    console.log("Deploying contracts with the account:", signerAddress);

    console.log("Deploying XXXToken contract");
    const xxxTokenFactory: XXXToken__factory = (await ethers.getContractFactory("XXXToken")) as XXXToken__factory;
    const xxxToken: XXXToken = await xxxTokenFactory.deploy(/* { gasPrice: BigNumber.from(100_000_000_000) } */);
    await xxxToken.deployed();
    console.log("XXXToken contract had been deployed to:", xxxToken.address);

    const minimumQuorum: number = 30; //30%
    const debatingPeriodDuration: number = 3 * 60; //3 min
    console.log("Deploying DAO contract");
    const DAO: DAO__factory = (await ethers.getContractFactory("DAO")) as DAO__factory;
    const dao: DAO = await DAO.deploy(signerAddress, minimumQuorum, debatingPeriodDuration);
    await dao.deployed();
    console.log("DAO contract had been deployed to:", dao.address);

    const routerAddress: string = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
    const lpTokenAddress: string = await createLiquidityPool(signer, xxxTokenContract, routerAddress);
    const rewardPercentage: number = 3; //3%
    const rewardPeriod: number = 3 * 60; //5 min
    const stakeWithdrawalTimeout: number = 3 * 60; //3 min;
    console.log("Deploying Staking contract");
    const stakingFactory: Staking__factory = (await ethers.getContractFactory("Staking")) as Staking__factory;
    const staking: Staking = await stakingFactory.deploy(
        lpTokenAddress, xxxToken.address, rewardPercentage, rewardPeriod, stakeWithdrawalTimeout, dao.address
    );
    await staking.deployed();
    console.log("Staking contract had been deployed to:", staking.address);

    await dao.init(staking.address);

    console.log("Deploying ACDMToken contract");
    const adcmTokenFactory: ACDMToken__factory = (await ethers.getContractFactory("ACDMToken")) as ACDMToken__factory;
    const acdmToken: ACDMToken = await adcmTokenFactory.deploy();
    await acdmToken.deployed();
    console.log("ACDMToken contract had been deployed to:", acdmToken.address);

     const roundDuration: number = 3 * 60; // 3 min
     const firstReferrerSaleFee: number = 5; // 5%
     const secondReferrerSaleFee: number = 3; // 3%
     const referrerTradeFee: number = 2; // 2%
     const initialTokensSupply: number = 100_000; // 100 000 ACDM
     const initialTokenPrice: number = 10**18; // 1 ETH
     console.log("Deploying ACDMPLatform contract");
     const adcmPlatformFactory: ACDMPLatform__factory =
        (await ethers.getContractFactory("ACDMPLatform")) as ACDMPLatform__factory;
     const acdmPlatform: ACDMPlatform = await adcmPlatformFactory.deploy(
        acdmToken.address,
        routerAddress,
        xxxToken.address,
        dao.address,
        roundDuration,
        firstReferrerSaleFee,
        secondReferrerSaleFee,
        referrerTradeFee,
        initialTokensSupply,
        initialTokenPrice
     );
     await acdmPlatform.deployed();
     console.log("ACDMPLatform contract had been deployed to:", acdmToken.address);

     await acdmToken.init(acdmPlatform.address);
}

/**
 * @returns LP token address
 */
async function createLiquidityPool(signer: SignerWithAddress, xxxTokenContract: XXXToken, routerAddress: string): Promise<string> {
    type TxOptions = { value: BigNumber, gasLimit: BigNumber };

    function priceFluctuationPercentage(supply: BigNumber, percent: number): BigNumber {
        const percentage: BigNumber = supply.mul(BigNumber.from(percent)).div(BigNumber.from(100));
        return supply.sub(percentage);
    }

    const xxxTokenInitialSupply: BigNumber = BigNumber.from(100);
    const xxxTokenDecimals: BigNumber = BigNumber.from(await xxxTokenContract.decimals());
    const xxxTokenInitialSupplyDecimals: BigNumber = xxxTokenInitialSupply.mul(BigNumber.from(10).pow(xxxTokenDecimals));
    console.log("Minting %s of XXX tokens to %s", xxxTokenInitialSupply.toString(), signer.address);
    await xxxTokenContract.mint(xxxTokenInitialSupplyDecimals, signer.address);
    console.log("Successfully minted");

    if (!(await xxxTokenContract.approve(routerAddress, xxxTokenInitialSupplyDecimals))) {
        throw new Error("XXXToken transfer approvale failed");
    }

    const xxxToken: Token = await Fetcher.fetchTokenData(network.config.chainId, xxxTokenContract.address);
    const xxxTokenPriceInWei: BigNumber = ethers.utils.parseEther("0.00001");
    const etherSupplyInWei: BigNumber = xxxTokenInitialSupply.mul(xxxTokenPriceInWei);
    const xxxTokensSupplyMin: BigNumber = priceFluctuationPercentage(xxxTokenInitialSupplyDecimals, 2);
    const etherSupplyMin: BigNumber = priceFluctuationPercentage(etherSupplyInWei, 2);
    const deadline: number = (await ethers.provider.getBlock("latest")).timestamp + 100;

    const gasLimit: BigNumber = BigNumber.from(3_000_000);
    const txOptions: TxOptions = { value:  etherSupplyInWei, gasLimit: gasLimit };

    console.log("Adding liquidity XXXToken/WETH");
    console.log("Target XXX tokens amount (with decimals):\t%s", xxxTokenInitialSupplyDecimals);
    console.log("Target WETH amount (in wei)\t\t\t%s", etherSupplyInWei);

    const uniswapV2Router: Contract = getUniswapV2RouterContract(signer, routerAddress);
    const addLiquidityTx: any = await uniswapV2Router.addLiquidityETH(
        xxxToken.address,               // Token address
        xxxTokenInitialSupplyDecimals,  // The amount of token to add as liquidity if the WETH/token price is <= msg.value/amountTokenDesired
        xxxTokensSupplyMin,             // Bounds the extent to which the WETH/token price can go up before the transaction reverts
        etherSupplyMin,                 // Bounds the extent to which the token/WETH price can go up before the transaction reverts. Must be <= msg.value.
        signer.address,                 // Recipient of the liquidity tokens
        deadline,                       // Unix timestamp after which the transaction will revert.
        txOptions                       // msg.value & gas limit
    );
    const addLiquidityTxReceipt: any = await addLiquidityTx.wait();

    console.log(
        "Gas used:%s; cost: ",
        addLiquidityTxReceipt.gasUsed.toString(),
        addLiquidityTxReceipt.gasUsed.mul(addLiquidityTxReceipt.effectiveGasPrice).toString()
    );

    if (!addLiquidityTxReceipt.status) {
        throw new Error("Add liquidity operation has failed");
    }

    const pair: Pair = await Fetcher.fetchPairData(xxxToken, WETH[network.config.chainId]);
    const liquidityToken: Token = pair.liquidityToken;

    console.log("LP token address:", liquidityToken.address);

    return liquidityToken.address;
}

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

//todo arefev: move up
/* function verify(contractAddress: string, ...constructorParameters: any[]) {
    if (!contractAddress) {
        console.error("No contract address was provided");
        return;
    }

    const constructorParametersAsString: string =
        !constructorParameters || constructorParameters.length == 0 ? "" : constructorParameters.join(" ");

    const command: string = "npx hardhat verify --network rinkeby "  + contractAddress + " " + constructorParametersAsString;
    console.log("Running command:", command);

    try {
        execSync(command, { encoding: "utf-8" });
    } catch (error) {
        //do nothing, it always fails but in fact a contract becomes verified
    }
} */

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
