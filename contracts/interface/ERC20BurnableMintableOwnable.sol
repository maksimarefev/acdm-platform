//SPDX-License-Identifier: Unlicensed

pragma solidity ^0.8.0;

import "./Mintable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

abstract contract ERC20BurnableMintableOwnable is ERC20Burnable, Mintable, Ownable {

    address public minter;

    modifier onlyMinter() {
        require(msg.sender == minter, "Not a minter");
        _;
    }

    function mint(uint256 amount, address receiver) public override onlyMinter initialized {
        require(receiver != address(0), "Address can't be 0");
        _mint(receiver, amount);
    }
}