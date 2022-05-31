//SPDX-License-Identifier: Unlicensed

pragma solidity ^0.8.0;

import "./interface/ERC20BurnableMintableOwnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ACDMToken is ERC20BurnableMintableOwnable {

    bool public isInitialized;

    modifier initialized() {
        require(isInitialized, "Not initialized");
        _;
    }

    constructor() public ERC20("ACADEM Coin", "ACDM") {}

    function init(address acdmPlatform) external onlyOwner {
        require(!isInitialized, "Already initialized");
        minter = acdmPlatform;
        isInitialized = true;
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }
}
