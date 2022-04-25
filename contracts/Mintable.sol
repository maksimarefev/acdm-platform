pragma solidity ^0.8.0;

interface Mintable {

    function mint(uint256 amount, address receiver) external;
}
