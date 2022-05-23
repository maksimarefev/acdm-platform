//SPDX-License-Identifier: Unlicensed

pragma solidity ^0.8.0;

interface Mintable {

    /**
     * @notice mints `amount` of tokens to the `receiver` address
     */
    function mint(uint256 amount, address receiver) external;
}
