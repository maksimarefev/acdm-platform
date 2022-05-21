//SPDX-License-Identifier: Unlicensed

pragma solidity ^0.8.0;

import "./ACDMToken.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

//todo arefev: setters
//todo arefev: add register method
//todo arefev: transfer returns a flag
//todo arefev: если в трейд раунде не было ордеров, то в sale раунде не будет минта
//todo arefev: реферер может быть только 1! второй реферер - это реферер реферера
//todo arefev: мапа для рефереров
//todo arefev: необязательно быть зарегистрированным для взаимодействия с платформой
//todo arefev: коммиссия рефералов капает на отдельный счет; к этому счету доступ будет только у ДАО
contract ACDMPlatform {
    using Counters for Counters.Counter;

    enum Round { TRADE, SALE }

    struct Order {
        uint256 amount;
        address owner;
        uint256 price; //price per token
    }

    struct Referers {
        address firstReferererTrade;
        address secondRefererTrade;
        address firstReferererSale;
        address secondRefererSale;
    }

    uint256 public roundDuration;
    uint256 public roundDeadline;
    uint256 public currentRoundNumber;
    uint256 public currentRound;

    //for the 'Trade' round
    uint256 public tradeVolume;
    uint256 public firstReferererTradeFee;
    uint256 public secondRefererTradeFee;

    //for the 'Sale' round
    uint256 public currentTokenPrice;
    uint256 public tokensIssued;
    uint256 public tokensSold;
    uint256 public firstReferererSaleFee;
    uint256 public secondRefererSaleFee;

    uint256 private lastRoundTradeVolume;
    mapping(uint256 => Order) private orders;
    mapping(address => Referers) private referers;
    mapping(address => bool) private registeredUsers;
    Counters.Counter private orderIdGenerator;
    ACDMToken private acdmToken;

    constructor(address _acdmToken) public {
        acdmToken = ACDMToken(_acdmToken);
        tokensIssued = 100000 * 10 * acdmToken.decimals();
        currentTokenPrice = 10000000000000;
        acdmToken.mint(tokensIssued, address(this));
        currentRound = Round.SALE;
    }

    /**
     * @notice Creates a new order (todo arefev: description)
     */
    function putOrder(uint256 amount, uint256 price) public {
        switchRoundIfRequired();
        require(currentRound == Round.TRADE, "Not a 'Trade' round");
        require(amount > 0, "Amount can't be 0");
        require(price > 0, "Price can't be 0");
        require(acdmToken.balanceOf(msg.sender) >= amount, "Not enough balance");
        require(acdmToken.allowance(msg.sender, address(this)));

        acdmToken.transferFrom(msg.sender, address(this), amount);
        orders[orderIdGenerator.current()] = Order(amount, msg.sender, price);
        orderIdGenerator.increment();
    }

    function cancellOrder(uint256 orderId) public {
        switchRoundIfRequired();
        require(currentRound == Round.TRADE, "Not a 'Trade' round");
        require(orders[orderId].amount > 0, "Order does not exist");
        require(orders[orderId].owner == msg.sender, "Not the order owner");

        uint256 amount = orders[orderId].amount; //prevent re-entrancy
        delete orders[orderId];
        acdmToken.transfer(msg.sender, amount);
    }

    /**
     * @notice Buy for the 'Trade' round
     */
    function buy(uint256 orderId, uint256 amount) public {
        switchRoundIfRequired();
        require(currentRound == Round.TRADE, "Not a 'Trade' round");
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
        switchRoundIfRequired();
        require(currentRound == Round.SALE, "Not a 'Sale' round");
        require(tokensIssued - tokensSold >= amount, "Not enough balance");
        require(currentTokenPrice * amount <= msg.value, "Not enough ether");

        tokensSold += amount;
        acdmToken.transfer(msg.sender, amount);
    }

    //todo arefev: referers should be registered as well
    function register(
        address _firstReferererTrade,
        address _secondRefererTrade,
        address _firstReferererSale,
        address _secondRefererSale
    ) public {
        require(!registeredUsers[msg.sender], "Already registered");
        registeredUsers[msg.sender] = true;
        referers[msg.sender] =
            Referers(_firstReferererTrade, _secondRefererTrade, _firstReferererSale, _secondRefererSale);
    }

    function switchRoundIfRequired() internal {
        if (block.timestamp < roundDeadline && (Round.SALE != currentRound || tokensIssued != tokensSold)) {
            return;
        }

        if (currentRound == Round.SALE) {
            if (tokensIssued != tokensSold) {
                acdmToken.burn(tokensIssued - tokensSold);
            }
            tradeVolume = 0;
            currentRound = Round.TRADE;
        } else {
            tokensIssued = tradeVolume / currentTokenPrice;
            currentTokenPrice = currentTokenPrice * 3 / 100 + currentTokenPrice + 4000000000000;
            acdmToken.mint(tokensIssued, address(this));
            currentRound = Round.SALE;
        }

        roundDeadline = block.timestamp + roundDuration;
    }
}
