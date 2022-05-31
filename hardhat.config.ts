import "dotenv/config";
import "solidity-coverage";
import "@typechain/hardhat";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-etherscan";
import { HardhatUserConfig } from "hardhat/config";

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
        },
        rinkeby: {
          url: "https://eth-rinkeby.alchemyapi.io/v2/" + ALCHEMY_API_KEY,
          chainId: 4,
          accounts: [`0x${PRIVATE_KEY}`]
        },
        goerli: {
          url: "https://eth-goerli.alchemyapi.io/v2/" + ALCHEMY_API_KEY,
          chainId: 5,
          accounts: [`0x${PRIVATE_KEY}`]
        }
    },
    etherscan: {
        apiKey: {
          rinkeby: ETHERSCAN_API_KEY,
          ropsten: ETHERSCAN_API_KEY,
          goerli: ETHERSCAN_API_KEY
        }
    }
};

export default config;