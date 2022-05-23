//SPDX-License-Identifier: Unlicensed

pragma solidity ^0.8.0;

import "./interface/ERC20BurnableMintable.sol";

contract ACDMToken is ERC20BurnableMintable {

    /**
     * @dev The minter (ACDM platform)
     */
    address public minter;

    modifier onlyMinter() {
        require(msg.sender == minter, "Not a minter");
        _;
    }

    constructor(address acdmPlatform) public ERC20("ACADEM Coin", "ACDM") {
        minter = acdmPlatform;
    }

    function mint(uint256 amount, address receiver) public override onlyMinter() {
        require(receiver != address(0), "Address can't be 0");
        _mint(receiver, amount);
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }
}
