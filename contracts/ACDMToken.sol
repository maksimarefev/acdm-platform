//SPDX-License-Identifier: Unlicensed

pragma solidity ^0.8.0;

import "./Mintable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

contract ACDMToken is ERC20Burnable, Mintable {

    address public minter;

    modifier onlyMinter() {
        require(msg.sender == minter, "Not a minter");
        _;
    }

    constructor() public ERC20("ACADEM Coin", "ACDM") {
        minter = msg.sender;
    }

    //todo arefev: check style - an order of functions by their visibility, to be more specific
    function decimals() public view override returns (uint8) {
        return 6;
    }

    //todo arefev: seems like the platform should be the minter
    function mint(uint256 amount, address receiver) public override onlyMinter() {
        require(receiver != address(0), "Address can't be 0");
        _mint(receiver, amount);
    }
}
