//SPDX-License-Identifier: Unlicensed

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

//todo arefev: XXXToken should be listed on uniswap. Initial token price should be 0,00001 ETH.
contract XXXToken is ERC20Burnable {
    /* solhint-disable no-empty-blocks */
    constructor() public ERC20("XXX Coin", "XXX") {}
    /* solhint-disable no-empty-blocks */
}
