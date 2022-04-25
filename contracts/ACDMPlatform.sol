pragma solidity ^0.8.0;

import "./ACDMToken.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

//todo arefev: add register method
//todo arefev: add isClosed flag?
//todo arefev: may there are more than 6 rounds?
contract ACDMPlatform {
    using Counters for Counters.Counter;

    enum Round {
        /*todo arefev: в данном раунде пользователи могут выкупать друг у друга токены ACDM за ETH;
           По окончанию раунда все открытые ордера переходят в следующий TRADE раунд..
         */
        TRADE,
        SALE    //todo arefev: В данном раунде пользователь может купить токены ACDM по фиксируемой цене у платформы за ETH
    }

    struct Order {
        uint256 amount;
        address owner;
        uint256 price; //price per token
    }

    //todo arefev: use an array?
    struct User {
        address firstReferer;
        address secondReferer;
    }

    uint256 public roundDuration;
    uint256 public roundDeadline;
    uint256 public currentRoundNumber; //todo arefev: max == 6
    uint256 public firstReferererFee; //todo arefev: make them configurable
    uint256 public secondRefererFee;
    uint256 public currentRound;

    //for the 'Sale' round
    uint256 public currentTokenPrice;
    uint256 public tokensIssued;
    uint256 public tokensSold;

    /**todo arefev:
        Объем торгов в trade раунде = 0,5 ETH (общая сумма ETH на которую пользователи наторговали в рамках одного trade раунд)
        0,5/0,0000187 = 26737.96. (0,0000187 = цена токена в текущем раунде)
        => в Sale раунде будет доступно к продаже 26737.96 токенов ACDM.
     */
    uint256 private lastRoundTradeVolume;
    mapping(uint256 => Order) orders;
    Counters.Counter private orderIdGenerator; //todo arefev: why use order id?
    ACDMToken private acdmToken;

    function putOrder(uint256 amount, uint256 price) public {
        require(amount > 0, "Amount can't be 0");
        require(price > 0, "Price can't be 0");
        require(acdmToken.balanceOf(msg.sender) >= amount, "Not enough balance");
        require(acdmToken.allowance(msg.sender, address(this)));

        acdmToken.transferFrom(msg.sender, address(this), amount);
        orders[orderIdGenerator.current()] = Order(amount, msg.sender, price);
        orderIdGenerator.increment();
    }

    function cancellOrder(uint256 orderId) {
        require(orders[orderId].amount > 0, "Order does not exist");
        require(orders[orderId].owner == msg.sender, "Not the order owner");

        uint256 amount = orders[orderId].amount; //prevent re-entrancy
        delete orders[orderId];
        acdmToken.transfer(msg.sender, amount);
    }

    //todo arefev: change round if necessary
    /**
     * @notice Buy for the 'Trade' round
     */
    function buy(uint256 orderId, uint256 amount) public {
        require(orders[orderId].amount > 0, "Order does not exist");
        require(orders[orderId].amount >= amount, "Too large amount");
        require(msg.value >= amount * orders[orderId].price, "Not enough ether");

        acdmToken.transfer(msg.sender, amount);
        orders[orderId].amount -= amount;
        //todo arefev: Transfer change ether back
    }

    //todo arefev: pay ether; pay change ether
    /**
     * @notice Buy for the 'Sale' round
     */
    function buy(uint256 amount) public {
        switchRoundIfNecessary();
        require(Round.SALE == currentRound, "Not the 'Sale' round");
        require(acdmToken.balanceOf(address(this)) >= amount, "Not enough balance");
        require(currentTokenPrice * amount <= msg.value, "Not enough ether");

        acdmToken.transfer(msg.sender, amount);

        if (acdmToken.balanceOf(address(this)) == 0) {
            switchRoundIfNecessary();
        }
    }

    //todo arefev: implement
    //todo arefev: ETH is divisible up to 18 decimal places
    function saleRoundTokenPrice() internal returns(uint256) {
        return currentTokenPrice * 3 / 100 + currentTokenPrice +  + 400000000000000;
    }

    function switchRoundIfNecessary() internal {
        /*todo arefev: implement:
            1. If there are no more tokens to sell
            2. If the deadline has met
            3. While switching to the 'Sale' round calculate new price
        */

        if (Round.SALE == currentRound && tokensIssued == tokensSold) {
            //todo arefev: switch
            return;
        }

        if (block.timestamp >= roundDeadline) {
            //todo arefev: switch
            //todo arefev: burn tokens if it was the 'Sale' round
            //todo arefev: mint tokens if it was the 'Trade' round
            return;
        }
    }
}
