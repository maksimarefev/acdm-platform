//SPDX-License-Identifier: Unlicensed

pragma solidity ^0.8.0;

import "./interface/ERC20BurnableMintableOwnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract XXXToken is ERC20BurnableMintableOwnable {
    constructor() public ERC20("XXX Coin", "XXX") {
        minter = owner;
    }

    function mint(uint256 amount, address receiver) public override onlyOwner {
        require(receiver != address(0), "Address can't be 0");
        _mint(receiver, amount);
    }
}
