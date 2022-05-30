//SPDX-License-Identifier: Unlicensed

pragma solidity ^0.8.0;

import "./interface/ERC20BurnableMintable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

//todo arefev: generalize ACDMToken & XXXToken
contract XXXToken is ERC20BurnableMintable, Ownable {
    constructor() public ERC20("XXX Coin", "XXX") {}

    function mint(uint256 amount, address receiver) public override onlyOwner {
        require(receiver != address(0), "Address can't be 0");
        _mint(receiver, amount);
    }
}
