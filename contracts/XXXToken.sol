//SPDX-License-Identifier: Unlicensed

pragma solidity ^0.8.0;

import "./interface/ERC20BurnableMintable.sol";

contract XXXToken is ERC20BurnableMintable {

    constructor() public ERC20("XXX Coin", "XXX") {
        minters[msg.sender] = true;
    }
}
