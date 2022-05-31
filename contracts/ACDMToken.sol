//SPDX-License-Identifier: Unlicensed

pragma solidity ^0.8.0;

import "./interface/ERC20BurnableMintableOwnable.sol";

contract ACDMToken is ERC20BurnableMintableOwnable {

    constructor(address acdmPlatform) public ERC20("ACADEM Coin", "ACDM") {
        minter = acdmPlatform;
    }

    function mint(uint256 amount, address receiver) public override onlyMinter {
        super.mint(amount, receiver);
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }
}
