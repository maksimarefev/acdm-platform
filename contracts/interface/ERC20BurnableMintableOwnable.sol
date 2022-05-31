//SPDX-License-Identifier: Unlicensed

pragma solidity ^0.8.0;

import "./ERC20BurnableMintable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

abstract contract ERC20BurnableMintableOwnable is ERC20BurnableMintable, Ownable {

}
