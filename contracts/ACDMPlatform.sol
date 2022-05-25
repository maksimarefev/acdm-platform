//SPDX-License-Identifier: Unlicensed

pragma solidity ^0.8.0;

import "./interface/ERC20BurnableMintable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";

//todo arefev: replace `_switchRoundIfRequired` with `startTradeRound` & `startSaleRound`
contract ACDMPlatform is Ownable, ReentrancyGuard {
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
     * @dev Uniswap router
     */
    IUniswapV2Router02 public uniswapRouter;

    /**
     * @dev ACDM token
     */
    ERC20BurnableMintable public acdmToken;

    /**
     * @dev XXX token
     */
    ERC20Burnable public xxxToken;

    /**
     * @dev the percentage received by the buyer's referrer's referrer when making a sale
     */
    uint256 public secondReferrerSaleFee;
    /*=========for the 'Sale' round=========*/

    mapping(uint256 => Order) private orders;

    mapping(address => address) private referrers;

    mapping(address => bool) private registeredUsers;

    Counters.Counter private orderIdGenerator;

    address[] private path;

    event RoundSwitch(Round round);

    event PutOrder(uint256 indexed orderId, address indexed owner, uint256 amount, uint256 price);

    event CancelOrder(uint256 indexed orderId);

    event TradeOrder(uint256 indexed orderId, address indexed buyer, uint256 amount);

    event SaleOrder(address indexed buyer, uint256 amount);

    event ReferralPayment(address indexed referrer, uint256 amount);

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
        uint256 _referrerTradeFee,
        uint256 _tokensIssued,
        uint256 _currentTokenPrice
    ) public Ownable() {
        dao = _dao;
        roundDuration = _roundDuration;
        firstReferrerSaleFee = _firstReferrerSaleFee;
        secondReferrerSaleFee = _secondReferrerSaleFee;
        referrerTradeFee = _referrerTradeFee;
        acdmToken = ERC20BurnableMintable(_acdmToken);
        uniswapRouter = IUniswapV2Router02(_uniswapRouter);
        xxxToken = ERC20Burnable(_xxxToken);

        //`**` has priority over `*`
        tokensIssued = _tokensIssued * 10 ** acdmToken.decimals();

        currentTokenPrice = _currentTokenPrice;
        acdmToken.mint(tokensIssued, address(this));
        currentRound = Round.SALE;
        roundDeadline = block.timestamp + roundDuration;

        //In Uniswap v2 there are no more direct ETH pairs, all ETH must be converted to WETH first.
        path = new address[](2);
        path[0] = uniswapRouter.WETH();
        path[1] = _xxxToken;
    }

    /**
     * @dev this is required because uniswap router can return leftover ethers after the swap
     */
    receive() external payable {}

    /**
     * @notice creates a new order for selling ACDM tokens
     * @param amount is the amount of tokens (as decimals)
     * @param price is the price in wei per ONE token
     */
    function putOrder(uint256 amount, uint256 price) public {
        _switchRoundIfRequired();
        require(currentRound == Round.TRADE, "Not a 'Trade' round");
        require(amount > 0, "Amount can't be 0");
        require(price > 0, "Price can't be 0");
        require(price / (10 ** acdmToken.decimals()) > 0, "Price is too low");
        require(acdmToken.balanceOf(msg.sender) >= amount, "Not enough balance");
        require(acdmToken.allowance(msg.sender, address(this)) >= amount, "Not enough allowance");

        SafeERC20.safeTransferFrom(acdmToken, msg.sender, address(this), amount);
        uint256 orderId = orderIdGenerator.current();
        orders[orderId] = Order(amount, msg.sender, price);
        orderIdGenerator.increment();

        emit PutOrder(orderId, msg.sender, amount, price);
    }

    function cancelOrder(uint256 orderId) public {
        _switchRoundIfRequired();
        require(currentRound == Round.TRADE, "Not a 'Trade' round");
        require(orders[orderId].amount > 0, "Order does not exist");
        require(orders[orderId].owner == msg.sender, "Not the order owner");

        uint256 amount = orders[orderId].amount;
        delete orders[orderId];
        SafeERC20.safeTransfer(acdmToken, msg.sender, amount);

        emit CancelOrder(orderId);
    }

    /**
     * @notice Buy for the 'Trade' round
     */
    function redeemOrder(uint256 orderId) public payable nonReentrant {
        _switchRoundIfRequired();
        require(currentRound == Round.TRADE, "Not a 'Trade' round");

        Order storage order = orders[orderId];
        require(order.amount > 0, "Order does not exist");

        uint256 weiPerDecimal = order.price / (10 ** acdmToken.decimals());
        require(msg.value >= weiPerDecimal, "Too low msg.value");
        uint256 amount = msg.value / weiPerDecimal;

        if (order.amount < amount) {
            amount = order.amount;
        }

        uint256 leftover = msg.value - (amount * weiPerDecimal);
        if (leftover != 0) {
            payable(msg.sender).transfer(leftover);
        }

        SafeERC20.safeTransfer(acdmToken, msg.sender, amount);
        order.amount -= amount;
        tradeVolume += amount;
        _payReferrals(amount, weiPerDecimal);
        uint256 referrersPayment = amount * weiPerDecimal * referrerTradeFee * 2 / 100;
        payable(order.owner).transfer(msg.value - leftover - referrersPayment);

        if (order.amount == 0) {
            delete orders[orderId];
        }

        emit TradeOrder(orderId, msg.sender, amount);
    }

    /**
     * @notice Buy for the 'Sale' round
     */
    function buy() public payable nonReentrant {
        _switchRoundIfRequired();
        require(currentRound == Round.SALE, "Not a 'Sale' round");

        uint256 weiPerDecimal = currentTokenPrice / (10 ** acdmToken.decimals());
        require(msg.value >= weiPerDecimal, "Too low msg.value");
        uint256 amount = msg.value / weiPerDecimal;

        uint256 remainingTokens = tokensIssued - tokensSold;
        if (remainingTokens < amount) {
            amount = remainingTokens;
        }

        uint256 leftover = msg.value - (amount * weiPerDecimal);
        if (leftover != 0) {
            payable(msg.sender).transfer(leftover);
        }

        tokensSold += amount;
        SafeERC20.safeTransfer(acdmToken, msg.sender, amount);
        _payReferrals(amount, weiPerDecimal);

        emit SaleOrder(msg.sender, amount);
    }

    /**
     * @notice registers a new user
     * @param referrer should be either already registerd user or the zero address
     */
    function register(address referrer) public {
        require(!registeredUsers[msg.sender], "Already registered");

        if (referrer != address(0)) {
            require(msg.sender != referrer, "Sender can't be a referrer");
            require(registeredUsers[referrer], "Referrer is not registered");
            referrers[msg.sender] = referrer;
        }

        registeredUsers[msg.sender] = true;
    }

    /**
     * @param sendToOwner: if `true` then send accrued fees to the contract's owner; if `false` then buy XXXTokens and burn them
     */
    function spendFees(bool sendToOwner) public onlyDAO nonReentrant {
        uint256 value = address(this).balance;

        if (sendToOwner) {
            payable(owner()).transfer(value);
        } else {
            uint256[] memory amounts = uniswapRouter.swapExactETHForTokens{value : value}(
                0, path, address(this), block.timestamp + 15
            );
            xxxToken.burn(amounts[2]);
        }
    }

    function setRoundDuration(uint256 _roundDuration) public onlyOwner {
        require(roundDuration > 0, "Can't be zero");
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

    function _switchRoundIfRequired() internal {
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
            //0.000004 eth == 4_000_000_000_000 wei
            currentTokenPrice = currentTokenPrice * 103 / 100 + 4_000_000_000_000;

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
        if (!registeredUsers[msg.sender]) {
            return;
        }

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
