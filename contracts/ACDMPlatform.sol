//SPDX-License-Identifier: Unlicensed

pragma solidity ^0.8.0;

import "./ACDMToken.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router01.sol";

//todo arefev: add comments
//todo arefev: use safeTransfer
//todo arefev: use fuzzing to test this
//todo arefev: Uniswap router address = 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D
//todo arefev: необязательно быть зарегистрированным для взаимодействия с платформой => кто сказал?
//todo arefev: https://docs.uniswap.org/protocol/V2/guides/smart-contract-integration/quick-start#writing-tests
//todo arefev: I can create uniswap pair via the Factory contract (in a Staking contract we should create XXXToken/ETH pair)
contract ACDMPlatform is Ownable {
    using Counters for Counters.Counter;

    enum Round {TRADE, SALE}

    struct Order {
        uint256 amount;
        address owner;
        uint256 price; //price per token
    }

    /**
     * @dev round duration in seconds
     */
    uint256 public roundDuration;

    /**
     * @dev current round deadline timestamp
     */
    uint256 public roundDeadline;

    /**
     * @dev round counter
     */
    uint256 public currentRoundNumber;

    /**
     * @dev current round
     */
    Round public currentRound;

    /*=========for the 'Trade' round=========*/
    /**
     * @dev amount of wei accrued during the 'Trade' round
     */
    uint256 public tradeVolume;

    /**
     * @dev the percentage received by the buyer's referrer and by the buyer's referrer's referrer when making a trade
     */
    uint256 public referrerTradeFee;
    /*=========for the 'Trade' round=========*/

    /*=========for the 'Sale' round=========*/
    /**
     * @dev amount of wei per token
     */
    uint256 public currentTokenPrice;

    /**
     * @dev amount of tokens issued before `Sale` round started (with decimals)
     */
    uint256 public tokensIssued;

    /**
     * @dev amount of tokens sold during the `Sale` round (with decimals)
     */
    uint256 public tokensSold;

    /**
     * @dev the percentage received by the buyer's referrer when making a sale
     */
    uint256 public firstReferrerSaleFee;

    /**
     * @dev the DAO contract address
     */
    address public dao;

    /**
     * @dev the percentage received by the buyer's referrer's referrer when making a sale
     */
    uint256 public secondReferrerSaleFee;
    /*=========for the 'Sale' round=========*/

    mapping(uint256 => Order) private orders;

    mapping(address => address) private referrers;

    mapping(address => bool) private registeredUsers;

    Counters.Counter private orderIdGenerator;

    IUniswapV2Router01 private uniswapRouter;

    ACDMToken private acdmToken;

    address[] private path;

    event RoundSwitch(Round round);

    event PutOrder(uint256 indexed orderId, address indexed owner, uint256 amount, uint256 price);

    event CancelOrder(uint256 indexed orderId);

    event TradeOrder(uint256 indexed orderId, address indexed buyer, uint256 amount);

    event SaleOrder(address indexed buyer, uint256 amount);

    event ReferralPayment(address indexed referrer, uint256 amount);

    modifier onlyRegistered() {
        require(registeredUsers[msg.sender], "Caller is not registered");
        _;
    }

    modifier onlyDAO() {
        require(msg.sender == dao, "Caller is not the DAO");
        _;
    }

    constructor(
        address _acdmToken,
        address _uniswapRouter,
        address _xxxToken,
        address _dao,
        uint256 _roundDuration,
        uint256 _firstReferrerSaleFee,
        uint256 _secondReferrerSaleFee,
        uint256 _referrerTradeFee
    ) public Ownable() {
        roundDuration = _roundDuration;
        firstReferrerSaleFee = _firstReferrerSaleFee;
        secondReferrerSaleFee = _secondReferrerSaleFee;
        referrerTradeFee = _referrerTradeFee;
        dao = _dao;
        acdmToken = ACDMToken(_acdmToken);
        uniswapRouter = IUniswapV2Router01(_uniswapRouter);
        tokensIssued = 100_000 * 10 ** acdmToken.decimals();
        //`**` has priority over `*`
        currentTokenPrice = 10_000_000_000_000;
        //0.00001 ETH
        acdmToken.mint(tokensIssued, address(this));
        currentRound = Round.SALE;

        //In Uniswap v2 there are no more direct ETH pairs, all ETH must be converted to WETH first.
        path = new address[](2);
        path[0] = uniswapRouter.WETH();
        path[1] = _xxxToken;
    }

    /**
     * @dev this is required because uniswap router can return leftover ethers after the swap
     */
    receive() external payable {
        //do nothing
    }

    /**
     * @notice creates a new order for selling ACDM tokens
     * @param amount is the amount of tokens (as decimals)
     * @param price is the price in wei per ONE token
     */
    function putOrder(uint256 amount, uint256 price) public onlyRegistered {
        switchRoundIfRequired();
        require(currentRound == Round.TRADE, "Not a 'Trade' round");
        require(amount > 0, "Amount can't be 0");
        require(price > 0, "Price can't be 0");
        require(acdmToken.balanceOf(msg.sender) >= amount, "Not enough balance");
        require(acdmToken.allowance(msg.sender, address(this)) >= amount, "Not enough allowance");

        acdmToken.transferFrom(msg.sender, address(this), amount);
        uint256 orderId = orderIdGenerator.current();
        orders[orderId] = Order(amount, msg.sender, price);
        orderIdGenerator.increment();

        emit PutOrder(orderId, msg.sender, amount, price);
    }

    function cancelOrder(uint256 orderId) public onlyRegistered {
        switchRoundIfRequired();
        require(currentRound == Round.TRADE, "Not a 'Trade' round");
        require(orders[orderId].amount > 0, "Order does not exist");
        require(orders[orderId].owner == msg.sender, "Not the order owner");

        uint256 amount = orders[orderId].amount;
        //prevent re-entrancy
        delete orders[orderId];
        acdmToken.transfer(msg.sender, amount);

        emit CancelOrder(orderId);
    }

    /**
     * @notice Buy for the 'Trade' round
     */
    function buy(uint256 orderId) public onlyRegistered {
        switchRoundIfRequired();
        require(currentRound == Round.TRADE, "Not a 'Trade' round");

        Order storage order = orders[orderId];
        require(order.amount > 0, "Order does not exist");

        uint256 weiPerDecimal = order.price / (10 ** acdmToken.decimals());
        uint256 amount = msg.value / weiPerDecimal;
        //todo arefev: can it reach zero?
        require(amount > 0, "Too low msg.value");

        if (order.amount < amount) {
            uint256 leftover = (amount - order.amount) * weiPerDecimal;
            payable(msg.sender).transfer(leftover);
            amount = order.amount;
        }

        acdmToken.transfer(msg.sender, amount);
        order.amount -= amount;
        tradeVolume += amount;
        _payReferrals(amount, weiPerDecimal);
        uint256 referrersPayment = amount * weiPerDecimal * referrerTradeFee * 2 / 100;
        payable(order.owner).transfer(amount - referrersPayment);

        if (order.amount == 0) {
            delete orders[orderId];
        }

        emit TradeOrder(orderId, msg.sender, amount);
    }

    /**
     * @notice Buy for the 'Sale' round
     */
    function buy() public onlyRegistered {
        switchRoundIfRequired();
        require(currentRound == Round.SALE, "Not a 'Sale' round");

        uint256 weiPerDecimal = currentTokenPrice / (10 ** acdmToken.decimals());
        uint256 amount = msg.value / weiPerDecimal;
        require(amount > 0, "Too low msg.value");

        uint256 remainingTokens = tokensIssued - tokensSold;
        if (remainingTokens < amount) {
            uint256 leftover = msg.value - ((amount - remainingTokens) * weiPerDecimal);
            amount = remainingTokens;
            payable(msg.sender).transfer(leftover);
        }

        tokensSold += amount;
        acdmToken.transfer(msg.sender, amount);
        _payReferrals(amount, weiPerDecimal);

        emit SaleOrder(msg.sender, amount);
    }

    function register(address referrer) public {
        require(!registeredUsers[msg.sender], "Already registered");
        registeredUsers[msg.sender] = true;
        referrers[msg.sender] = referrer;
    }

    /**
     * @param sendToOwner: if `true` then send accrued fees to the contract's owner; if `false` then buy XXXTokens and burn them
     */
    function spendFees(bool sendToOwner) public onlyDAO {
        if (sendToOwner) {
            payable(owner()).transfer(address(this).balance);
        } else {
            uniswapRouter.swapExactETHForTokens{value : address(this).balance}(0, path, address(this), block.timestamp + 15);
        }
    }

    function setRoundDuration(uint256 _roundDuration) public onlyOwner {
        roundDuration = _roundDuration;
    }

    function setFirstReferrerSaleFee(uint256 _firstReferrerSaleFee) public onlyOwner {
        firstReferrerSaleFee = _firstReferrerSaleFee;
    }

    function setSecondReferrerSaleFee(uint256 _secondReferrerSaleFee) public onlyOwner {
        secondReferrerSaleFee = _secondReferrerSaleFee;
    }

    function setReferrerTradeFee(uint256 _referrerTradeFee) public onlyOwner {
        referrerTradeFee = _referrerTradeFee;
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
            tokensSold = 0;
            currentTokenPrice = currentTokenPrice * 103 / 100 + 4_000_000_000_000;
            //0.000004 eth == 4_000_000_000_000 wei

            if (tradeVolume != 0) {
                tokensIssued = tradeVolume / currentTokenPrice;
                acdmToken.mint(tokensIssued, address(this));
            } else {
                tokensIssued = 0;
            }

            currentRound = Round.SALE;
        }

        roundDeadline = block.timestamp + roundDuration;

        emit RoundSwitch(currentRound);
    }

    /**
     * @param tokensAmount is amount of ACDM tokens (in decimals)
     * @param weiPerDecimal is amount of wei per decimal
     */
    function _payReferrals(uint256 tokensAmount, uint256 weiPerDecimal) internal {
        address firstReferrer = referrers[msg.sender];
        address secondReferrer = referrers[firstReferrer];

        if (currentRound == Round.SALE) {
            _payReferrals(firstReferrer, firstReferrerSaleFee, tokensAmount, weiPerDecimal);
            _payReferrals(secondReferrer, secondReferrerSaleFee, tokensAmount, weiPerDecimal);
        } else {
            _payReferrals(firstReferrer, referrerTradeFee, tokensAmount, weiPerDecimal);
            _payReferrals(secondReferrer, referrerTradeFee, tokensAmount, weiPerDecimal);
        }
    }

    /**
     * @param referrer is the referrer's address
     * @param fee is a fee precentage
     * @param tokensAmount is amount of ACDM tokens (in decimals)
     * @param weiPerDecimal is amount of wei per decimal
     */
    function _payReferrals(address referrer, uint256 fee, uint256 tokensAmount, uint256 weiPerDecimal) internal {
        if (referrer != address(0)) {
            uint256 feeAmount = tokensAmount * weiPerDecimal * fee / 100;
            payable(referrer).transfer(feeAmount);
            emit ReferralPayment(referrer, feeAmount);
        }
    }
}
