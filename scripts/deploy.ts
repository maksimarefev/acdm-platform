import { execSync } from "child_process";
import { ethers, network } from "hardhat";
import { Contract, BigNumber } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"; //todo arefev: can't address be extracted from a simple Signer?
import { ChainId, Fetcher, WETH, Token } from "@uniswap/sdk";
import { ACDMToken, ACDMToken__factory, XXXToken, XXXToken__factory, DAO, DAO__factory } from '../typechain-types';

/*
todo arefev:
    * XXXToken
    * DAO(Staking)
    * Staking (DAO, LPToken, XXXToken)
    * init DAO
    * ACDMToken
    * attach Router contract to 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D
    * ACDMPlatform(ACDMToken, UniswapRouter, XXXToken, DAO)
    * init ACDMToken
*/
/*
    todo arefev: If a pool for the passed tokens does not exists, one is created automatically,
                 and exactly amountADesired/amountBDesired tokens are added.

    function addLiquidity(
      address tokenA,
      address tokenB,
      uint amountADesired,
      uint amountBDesired,
      uint amountAMin,
      uint amountBMin,
      address to,
      uint deadline
    ) external returns (uint amountA, uint amountB, uint liquidity);
*/

async function currentBlockTimestamp(): Promise<number> {
    const blockNumber: number = await ethers.provider.getBlockNumber(); //todo arefev: "latest"
    return (await ethers.provider.getBlock(blockNumber)).timestamp;
}

async function main() {
    const accounts: SignerWithAddress[] = await ethers.getSigners();

    if (accounts.length == 0) {
        throw new Error('No accounts were provided');
    }

    const signerAddress: string = await accounts[0].getAddress();
    console.log("Deploying contracts with the account:", signerAddress);

    console.log("Deploying XXXToken contract");
    const XXXToken: XXXToken__factory = (await ethers.getContractFactory("XXXToken")) as XXXToken__factory;
    const xxxTokenContract: XXXToken = await XXXToken.deploy();
    await xxxTokenContract.deployed();
    console.log("XXXToken contract had been deployed to:", xxxTokenContract.address);

    console.log("Deploying XXXToken contract");
    const ACDMToken: ACDMToken__factory = (await ethers.getContractFactory("ACDMToken")) as ACDMToken__factory;
    const acdmTokenContract: ACDMToken = await ACDMToken.deploy();
    await acdmTokenContract.deployed();
    console.log("ACDMToken contract had been deployed to:", acdmTokenContract.address);

    const minimumQuorum: number = 30; //30%
    const debatingPeriodDuration: number = 180; //3 min
    console.log("Deploying DAO contract");
    const DAO: DAO__factory = (await ethers.getContractFactory("DAO")) as DAO__factory;
    const dao: DAO = await DAO.deploy(signerAddress, minimumQuorum, debatingPeriodDuration);
    await dao.deployed();
    console.log("DAO contract had been deployed to:", dao.address);

    //todo arefev: in order to deploy a Staking contract I need to add liquidity to XXXToken/ETH pair
    const xxxToken: Token = await Fetcher.fetchTokenData(network.config.chainId, xxxTokenContract.address);

    throw new Error("Not implemented");
}

//todo arefev: remove
async function test() {
    const accounts: SignerWithAddress[] = await ethers.getSigners();

    if (accounts.length == 0) {
        throw new Error('No accounts were provided');
    }

    const signerAddress: string = await accounts[0].getAddress();
    console.log("Deploying contracts with the account:", signerAddress);

    console.log("Deploying XXXToken contract");
    const XXXToken: XXXToken__factory = (await ethers.getContractFactory("XXXToken")) as XXXToken__factory;
    const xxxTokenContract: XXXToken = await XXXToken.deploy();
    await xxxTokenContract.deployed();
    console.log("XXXToken contract had been deployed to:", xxxTokenContract.address);

    const xxxTokenInitialSupply: BigNumber = BigNumber.from(100);
    const xxxTokenDecimals: BigNumber = BigNumber.from(await xxxTokenContract.decimals());
    const xxxTokenInitialSupplyDecimals: BigNumber = xxxTokenInitialSupply.mul(BigNumber.from(10).pow(xxxTokenDecimals));
    await xxxTokenContract.mint(xxxTokenInitialSupplyDecimals, signerAddress);

    const xxxToken: Token = await Fetcher.fetchTokenData(network.config.chainId, xxxTokenContract.address);
    const xxxTokenPriceInWei: BigNumber = ethers.utils.parseEther("0.00001");
    const etherSupply: BigNumber = xxxTokenInitialSupplyDecimals.div(xxxTokenPriceInWei);
    const priceFluctuationPercentage: Function =
        (supply: BigNumber) => supply.mul(BigNumber.from(2)).div(BigNumber.from(100)); //2%; randomly chosen
    const xxxTokensSupplyMin: BigNumber = priceFluctuationPercentage(xxxTokenInitialSupply);
    const etherSupplyMin: BigNumber = priceFluctuationPercentage(etherSupply);
    const deadline: number = (await currentBlockTimestamp()) + 15;
    const routerAddress: string = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";

    if (!(await xxxTokenContract.approve(routerAddress, xxxTokenInitialSupply))) {
        throw new Error("XXXToken transfer approvale failed");
    }

    const gasPrice: BigNumber = await ethers.provider.getGasPrice();
    const gasLimit: BigNumber = BigNumber.from(9).mul(BigNumber.from(10).pow(13)).div(gasPrice); //gas 90_000_000_000_000 WEI
    console.log("Specified gas limit:", gasLimit.toString());
    const options: Object = { value:  etherSupply, gasLimit: gasLimit, gasPrice: gasPrice };
    let xxxTokensTransferred: BigNumber, etherTransferred: BigNumber, liquidityTokensMinted: BigNumber;

    const uniswapV2Router: Contract = getUniswapV2RouterContract(await accounts[0], routerAddress);
    [xxxTokensTransferred, etherTransferred, liquidityTokensMinted] = await uniswapV2Router.addLiquidityETH(
        xxxToken.address,               // Token address
        xxxTokenInitialSupply,          // The amount of token to add as liquidity if the WETH/token price is <= msg.value/amountTokenDesired
        xxxTokensSupplyMin,             // Bounds the extent to which the WETH/token price can go up before the transaction reverts
        etherSupplyMin,                 // Bounds the extent to which the token/WETH price can go up before the transaction reverts. Must be <= msg.value.
        signerAddress,                  // Recipient of the liquidity tokens
        deadline,                       // Unix timestamp after which the transaction will revert.
        options                         // msg.value
    );
}

//todo arefev: implement
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

test()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

/*

(async () => {
    const gasPrice: BigNumber = ethers.utils.parseEther("0.000000001");
    const gasLimit: BigNumber = BigNumber.from(9).mul(BigNumber.from(10).pow(13)).div(gasPrice);
    console.log("Gas limit:\t\t", gasLimit);
    console.log("Block gas limit:\t", (await ethers.provider.getBlock("latest")).gasLimit);

    console.log("Proposed gas price:\t", gasPrice);
    console.log("Suggested gas price:\t", await ethers.provider.getGasPrice());
})().then(() => process.exit(0));

 */
