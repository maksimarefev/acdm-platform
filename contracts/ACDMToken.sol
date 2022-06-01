//SPDX-License-Identifier: Unlicensed

pragma solidity ^0.8.0;

import "./interface/ERC20BurnableMintable.sol";

contract ACDMToken is ERC20BurnableMintable {

    constructor(address acdmPlatform) public ERC20("ACADEM Coin", "ACDM") {
        minters[msg.sender] = true;
        minters[acdmPlatform] = true;
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }
}
