//SPDX-License-Identifier: Unlicensed

pragma solidity ^0.8.0;

import "./Mintable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

abstract contract ERC20BurnableMintable is ERC20Burnable, Mintable {

    mapping(address => bool) public minters;

    modifier onlyMinter() {
        require(minters[msg.sender], "Not a minter");
        _;
    }

    function mint(uint256 amount, address receiver) public override virtual onlyMinter {
        require(receiver != address(0), "Address can't be 0");
        _mint(receiver, amount);
    }
}
