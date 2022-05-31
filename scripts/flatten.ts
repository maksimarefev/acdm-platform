import fs from 'fs';
import path from 'path';
import { execSync } from "child_process";

function resolveAndNormalize(target: string): string {
    return path.resolve(path.normalize(target));
}

const flattenedDir = resolveAndNormalize('flattened');

if (!fs.existsSync(flattenedDir)){
    fs.mkdirSync(flattenedDir);
}

type ContractPathToFlattenedPath = {
    contractPath: string,
    flattenedPath: string
}

[
    { contractPath: "contracts/DAO.sol", flattenedPath: "DAOFlattened.sol" },
    { contractPath: "contracts/Staking.sol", flattenedPath: "StakingFlattened.sol" },
    { contractPath: "contracts/XXXToken.sol", flattenedPath: "XXXTokenFlattened.sol" },
    { contractPath: "contracts/ACDMToken.sol", flattenedPath: "ACDMTokenFlattened.sol" },
    { contractPath: "contracts/ACDMPlatform.sol", flattenedPath: "ACDMPlatformFlattened.sol" }
]
.map(element => {
    return {
        contractPath: resolveAndNormalize(element.contractPath),
        flattenedPath: path.join(flattenedDir, element.flattenedPath)
    };
})
.forEach(element => execSync("npx hardhat flatten " + element.contractPath + " > " + element.flattenedPath, { encoding: "utf-8" }))

/* execSync("npx hardhat flatten contracts/DAO.sol > DAOFlattened.sol", { encoding: "utf-8" });
execSync("npx hardhat flatten contracts/Staking.sol > StakingFlattened.sol", { encoding: "utf-8" });
execSync("npx hardhat flatten contracts/XXXToken.sol > XXXTokenFlattened.sol", { encoding: "utf-8" });
execSync("npx hardhat flatten contracts/ACDMToken.sol > ACDMTokenFlattened.sol", { encoding: "utf-8" });
execSync("npx hardhat flatten contracts/ACDMPlatform.sol > ACDMPlatformFlattened.sol", { encoding: "utf-8" }); */
