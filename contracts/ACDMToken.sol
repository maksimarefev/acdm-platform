//SPDX-License-Identifier: Unlicensed

pragma solidity ^0.8.0;

import "./interface/ERC20BurnableMintable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

//todo arefev: create Initializable contract
contract ACDMToken is ERC20BurnableMintable, Ownable {

    /**
     * @dev The minter (ACDM platform)
     */
    address public minter;

    bool public isInitialized;

    modifier onlyMinter() {
        require(msg.sender == minter, "Not a minter");
        _;
    }

    modifier initialized() {
        require(isInitialized, "Not initialized");
        _;
    }

    constructor() public ERC20("ACADEM Coin", "ACDM") {}

    function init(address acdmPlatform) external onlyOwner {
        require(!isInitialized, "Already initialized");
        minter = acdmPlatform;
    }

    function mint(uint256 amount, address receiver) public override onlyMinter initialized {
        require(receiver != address(0), "Address can't be 0");
        _mint(receiver, amount);
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }
}
