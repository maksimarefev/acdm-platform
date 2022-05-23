//SPDX-License-Identifier: Unlicensed

pragma solidity ^0.8.0;

import "./Mintable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

abstract contract ERC20BurnableMintable is ERC20Burnable, Mintable {
}