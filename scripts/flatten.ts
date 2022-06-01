import fs from 'fs';
import path from 'path';
import { execSync } from "child_process";

function resolveAndNormalize(target: string): string {
    return path.resolve(path.normalize(target));
}

class ContractPath {
    contractPath: string;
    flattenedPath: string;

    constructor(contractPath: string, flattenedPath: string) {
        this.contractPath = contractPath;
        this.flattenedPath = flattenedPath;
    }
}

const flattenedDir = resolveAndNormalize('flattened');

if (fs.existsSync(flattenedDir)){
    fs.rmSync(flattenedDir, { recursive: true });
}

fs.mkdirSync(flattenedDir);

[
    new ContractPath("contracts/DAO.sol", "DAOFlattened.sol"),
    new ContractPath("contracts/Staking.sol", "StakingFlattened.sol"),
    new ContractPath("contracts/XXXToken.sol", "XXXTokenFlattened.sol"),
    new ContractPath("contracts/ACDMToken.sol", "ACDMTokenFlattened.sol"),
    new ContractPath("contracts/ACDMPlatform.sol", "ACDMPlatformFlattened.sol")
].map(element => {
    return {
        contractPath: resolveAndNormalize(element.contractPath),
        flattenedPath: path.join(flattenedDir, element.flattenedPath)
    };
}).forEach(element =>
    execSync("npx hardhat flatten " + element.contractPath + " > " + element.flattenedPath, { encoding: "utf-8" })
)
