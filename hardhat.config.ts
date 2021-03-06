import "dotenv/config";
import "solidity-coverage";
import "@typechain/hardhat";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-etherscan";
import { HardhatUserConfig } from "hardhat/config";

import "./tasks/acdmplatform/buy.ts";
import "./tasks/acdmplatform/cancelOrder.ts";
import "./tasks/acdmplatform/putOrder.ts";
import "./tasks/acdmplatform/redeemOrder.ts";
import "./tasks/acdmplatform/register.ts";
import "./tasks/acdmplatform/startSaleRound.ts";
import "./tasks/acdmplatform/startTradeRound.ts";

import "./tasks/dao/addProposal.ts";
import "./tasks/dao/finishProposal.ts";
import "./tasks/dao/voteForProposal.ts";

import "./tasks/staking/claim.ts";
import "./tasks/staking/stake.ts";
import "./tasks/staking/unstake.ts";

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;

const config: HardhatUserConfig = {
    solidity: "0.8.1",
    networks: {
        ropsten: {
          url: "https://eth-ropsten.alchemyapi.io/v2/" + ALCHEMY_API_KEY,
          chainId: 3,
          accounts: [`0x${PRIVATE_KEY}`]
        }
    },
    etherscan: {
        apiKey: {
          ropsten: ETHERSCAN_API_KEY
        }
    }
};

export default config;