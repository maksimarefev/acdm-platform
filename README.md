## Overview
Implementation of trading platform

## Configuring a secret
In the root folder create *.env* file and fill it the following properties:<br/>
```
{
    ALCHEMY_API_KEY=[ALCHEMY API KEY]
    PRIVATE_KEY=[YOUR ACCOUNT's PRIVATE KEY]
    ETHERSCAN_API_KEY=[YOUR ETHERSCAN APY KEY]
}
```

## How to deploy
1. From the root folder run ``` npm run deploy ```
2. Save the contract addresses for future interactions

## How to run a task
From the root folder run<br/>``` npx hardhat [task name] --network ropsten --contract-address [contract address] --argument [argument value] ```<br/>Example:<br/>``` npx hardhat redeemOrder --network ropsten --contract-address 0x7C80b8eBE24a29e6c22fd0FD0bf3Aef327f6c6a6 --order-id 0 --value 100000000000 ```

## The list of available tasks
| Task name       | Description                                                                               | Options                                                                                                                                                                        |
|-----------------|-------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| addProposal     | Creates a new proposal                                                                    | --contract-address => An address of a contract</br>--data => Calldata for target function</br>--recipient => Callee contract address</br>--description => Proposal description |
| finishProposal  | Finishes the proposal with id `proposalId`                                                | --contract-address => An address of a contract</br>--proposal-id => Proposal id                                                                                                |
| voteForProposal | Registers `msg.sender` vote                                                               | --contract-address => An address of a contract</br>--proposal-id => Proposal id</br>--votesFor => Flag which specifies whether a sender votes `for` or `against`               |
| claim           | Transfers the reward tokens if any to the `msg.sender` address                            | --contract-address => An address of a contract                                                                                                                                 |
| stake           | Transfers the `amount` of tokens from `msg.sender` address to the StakingContract address | --contract-address => An address of a contract <br/> --amount => The amount of tokens to stake                                                                                 |
| unstake         | Transfers staked tokens if any to the `msg.sender` address                                | --contract-address => An address of a contract                                                                                                                                 |
| buy             | Buy for the 'Sale' round                                                                  | --contract-address => An address of a contract <br/> --value => Value in wei                                                                                                   |
| cancelOrder     | Cancels the order with id `orderId`                                                       | --contract-address => An address of a contract <br/> --order-id => An order id                                                                                                 |
| putOrder        | Creates a new order for selling ACDM tokens                                               | --contract-address => An address of a contract <br/> --amount => The amount of tokens (as decimals) <br/> --price => The price in wei per ONE token                            |
| redeemOrder     | Buy for the 'Trade' round                                                                 | --contract-address => An address of a contract <br/> --order-id => An order id <br/> --value => Value in wei                                                                   |
| register        | Registers a user on a platform                                                            | --contract-address => An address of a contract <br/> --referrer => Address of the referrer                                                                                     |
| startSaleRound  | Starts the SALE round                                                                     | --contract-address => An address of a contract                                                                                                                                 |
| startTradeRound | Starts the TRADE round                                                                    | --contract-address => An address of a contract                                                                                                                                 |

## How to run tests and evaluate the coverage
From the root folder run ``` npx hardhat coverage ```
## Current test and coverage results for *i7-8550U 1.80GHz/16Gb RAM/WIN10 x64*
```
  ACDMPlatform
    putOrder
      √ Should fail if the SALE round is in progress
      √ Should fail if round is over (49ms)
      √ Should fail if amount is 0 (47ms)
      √ Should fail if price is too low (50ms)
      √ Should fail if a sender has not enough acdm tokens (70ms)
      √ Should fail if the platform is not allowed to transfer sufficient amount of acdm tokens (75ms)
      √ Should fail if the transfer of acdm tokens failed (79ms)
      √ Should emit the PutOrder event on success (98ms)
    cancelOrder
      √ Should fail if the SALE round is in progress
      √ Should fail if order does not exists (45ms)
      √ Should fail if round is over (42ms)
      √ Should fail the sender is not the owner (127ms)
      √ Should fail if the transfer of acdm tokens failed (116ms)
      √ Should emit the CancelOrder event on success (127ms)
    redeemOrder
      √ Should fail if the SALE round is in progress
      √ Should fail if order doesn't exists (47ms)
      √ Should fail if round is over (43ms)
      √ Should fail if not enough msg.value was given (103ms)
      √ Should fail if sender is the owner (94ms)
      √ Should fail if transfer of acmd tokens failed (114ms)
      √ Should transfer a leftover back to the sender (160ms)
      √ Should emit TradeOrder event (174ms)
    buy
      √ Should fail if the TRADE round is in progress (85ms)
      √ Should fail if not enough value given (192ms)
      √ Should fail if round is over
      √ Should fail if acdm tokens transfer failed (73ms)
      √ Should transfer a leftover back to the sender (192ms)
      √ Should emit the SaleOrder event (110ms)
      √ Should fail if no more tokens available (100ms)
    register
      √ Should fail if the sender is already registered (38ms)
      √ Should fail if the referrer is not registered
      √ Should fail if the sender is the referrer
      √ Should succeed if the sender is not already registered and is not the referrer (77ms)
    spendFees
      √ Should fail if a caller is not the DAO
      √ Should fail if deadline is in the past (64ms)
      √ Should transfer fees to owner (286ms)
      √ Should swap fees for XXX tokens and burn them (270ms)
    startTradeRound
      √ Should fail if current round is TRADE (52ms)
      √ Should fail if deadline is not met
      √ Should burn excessive amount of acdmTokens (48ms)
      √ Should proceed if all tokens were sold during the SALE round (111ms)
      √ Should emit RoundSwitch event
    startSaleRound
      √ Should fail if current round is SALE
      √ Should fail if deadline is not met (65ms)
      √ Should mint ACDM tokens if trade volumes was not zero (302ms)
      √ Should not mint ACDM tokens if trade volumes was zero (65ms)
      √ Should emit RoundSwitch event (97ms)
    referral program
      √ Should send referral fees in TRADE round (349ms)
      √ Should send referral fees in SALE round (235ms)
      √ Should not send referral fees if there are no referrers (283ms)
    setters
      √ Should allow for the owner to change round duration (61ms)
      √ Should not allow for non-owner to change round duration
      √ Should not allow to set round duration to 0 (93ms)
      √ Should allow for the owner to change first referrer sale fee (84ms)
      √ Should not allow for non-owner to change first referrer sale fee
      √ Should allow for the owner to change second referrer sale fee (95ms)
      √ Should not allow for non-owner to change second referrer sale fee
      √ Should allow for the owner to change referrer trade fee (58ms)
      √ Should not allow for non-owner to change referrer trade fee
    misc
      √ Should return valid order amount (186ms)
      √ Should not allow to interact with the uninitialized contract (210ms)
      √ Should not allow to initialize twice
      √ Should return valid referrer (93ms)

  DAO
    vote
      √ Should not allow to vote if there is no proposal
      √ Should not allow to vote if the proposal has met deadline (87ms)
      √ Should not allow to vote if sender is not a stakeholder (86ms)
      √ Should not allow to vote if sender already voted (116ms)
    addProposal
      √ Should allow for chairman to create proposal (61ms)
      √ Should not allow for non-chairman to create proposal (45ms)
      √ Should not allow to create a proposal if recepient is not a contract (46ms)
      √ Should emit ProposalCreated event (88ms)
    finishProposal
      √ Should not allow to finish non-existing proposal (59ms)
      √ Should not allow to finish in-progress proposal (93ms)
      √ Should emit ProposalFailed if a number of votes does not exceed the minimum quorum (284ms)
      √ Should emit ProposalFinished if a call to a target contract succeeded (395ms)
      √ Should emit ProposalFailed if a call to a target contract did not succeed (174ms)
      √ Should emit ProposalFailed if a proposal has no votes (113ms)
      √ Should emit ProposalFinished if number of `against` votes exceeds a number of `for` votes (196ms)
    misc
      √ Should not allow for non-owner to change debating period duration (38ms)
      √ Should allow for the owner to change debating period duration (95ms)
      √ Should not allow for non-owner to change minimum quorum (56ms)
      √ Should allow for the owner to change minimum quorum (94ms)
      √ Should not allow to set a minimum quorum greater than 100
      √ Should not return a description for a non-existing proposals (45ms)
      √ Should return a valid description for an existing proposals (65ms)
      √ Should not allow to construct dao contract with invalid minimum quorum
      √ Should not allow to interact with the uninitialized contract (100ms)
      √ Should not allow to initialize twice
      √ Should not allow to initialize with zero staking address (102ms)
    isParticipant
      √ Should return true if a stakeholder is participating in voting (129ms)
    changeChairman
      √ Should not allow for non-chairman to change the chairman
      √ Should allow for chairman to change the chairman (43ms)
      √ Should not allow to assign zero address as the chairman

  Staking
    stake
      √ Should change total stake after staking (71ms)
      √ Should not allow to stake is a transfer of staking tokens failed (49ms)
    unstake
      √ Should not allow to unstake before the timeout has expired (66ms)
      √ Should allow to unstake after the timeout has expired (503ms)
      √ Should not allow to unstake if stakeholder is participating in voting (88ms)
      √ Should not allow to unstake if a transfer of staking tokens failed (93ms)
      √ Should not allow to unstake if nothing at stake
    claim
      √ Should not allow to claim if there is no reward
      √ Should not allow to claim if a transfer of staking tokens failed (95ms)
    setters
      √ Should not allow for non-owner to change the reward percentage
      √ Should not allow for non-owner to change the reward period
      √ Should not allow for non-dao to change the stake withdrawal timeout
      √ Should allow for the owner to change the reward percentage (59ms)
      √ Should allow for the owner to change the reward period (66ms)
      √ Should allow for the dao to change the stake withdrawal timeout (90ms)
      √ Should not allow to set the reward percentage to zero
      √ Should not allow to set the reward percentage greater than 100
      √ Should not allow to set the reward period to zero
    ownership
      √ Should not allow to transfer ownership to the zero address
      √ Should allow to transfer ownership to the valid address (48ms)
    misc
      √ Should calculate the reward properly (95ms)
      √ Should return the valid owner
      √ Should return the valid dao address
      √ Should return the valid stake volume (74ms)

  117 passing (33s)
```

| File                | % Stmts    | % Branch   | % Funcs    | % Lines    | Uncovered Lines  |
|---------------------|------------|------------|------------|------------|------------------|
| contracts\          | 100        | 100        | 100        | 100        |                  |
| ACDMPlatform.sol    | 100        | 100        | 100        | 100        |                  |
| DAO.sol             | 100        | 100        | 100        | 100        |                  |
| Staking.sol         | 100        | 100        | 100        | 100        |                  |
| ------------------- | ---------- | ---------- | ---------- | ---------- | ---------------- |
| All files           | 100        | 100        | 100        | 100        |                  |


## Project dependencies
* @defi-wonderland/smock#2.0.7
* @nomiclabs/ethereumjs-vm#4.2.2
* @nomiclabs/hardhat-ethers#2.0.5
* @nomiclabs/hardhat-etherscan#3.0.3
* @nomiclabs/hardhat-waffle#2.0.3
* @nomiclabs/hardhat-web3#2.0.0
* @openzeppelin/contracts#4.5.0
* @typechain/ethers-v5#10.0.0
* @typechain/hardhat#6.0.0
* @types/chai#4.3.1
* @types/mocha#9.1.1
* @types/node#17.0.25
* @typescript-eslint/eslint-plugin#5.20.0
* @typescript-eslint/parser#5.20.0
* @uniswap/sdk#3.0.3
* @uniswap/v2-periphery#1.1.0-beta.0
* chai#4.3.6
* dotenv#16.0.0
* eslint#8.14.0
* ethereum-waffle#3.4.4
* hardhat#2.9.3
* solhint#3.3.7
* solidity-coverage#0.7.20
* ts-node#10.7.0
* typechain#8.0.0
* typescript#4.6.3
