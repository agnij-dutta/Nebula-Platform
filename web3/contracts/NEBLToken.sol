// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract NEBLToken is ERC20, ERC20Votes, ReentrancyGuard, Ownable {
    struct StakeInfo {
        uint256 amount;
        uint256 timestamp;
        uint256 lockPeriod;
    }

    mapping(address => StakeInfo) public stakes;
    uint256 public constant MIN_LOCK_PERIOD = 7 days;
    uint256 public constant MAX_LOCK_PERIOD = 365 days;
    uint256 public constant BASE_APR = 500; // 5%
    uint256 public constant MAX_BONUS_APR = 1500; // 15%

    event Staked(address indexed user, uint256 amount, uint256 lockPeriod);
    event Unstaked(address indexed user, uint256 amount, uint256 reward);

    constructor() 
        ERC20("Nebula Token", "NEBL") 
        ERC20Permit("Nebula Token")
    {
        _mint(msg.sender, 100000000 * 10**decimals()); // 100M initial supply
    }

    function stake(uint256 amount, uint256 lockPeriod) external nonReentrant {
        require(amount > 0, "Cannot stake 0 tokens");
        require(lockPeriod >= MIN_LOCK_PERIOD, "Lock period too short");
        require(lockPeriod <= MAX_LOCK_PERIOD, "Lock period too long");
        require(balanceOf(msg.sender) >= amount, "Insufficient balance");

        if(stakes[msg.sender].amount > 0) {
            require(stakes[msg.sender].timestamp + stakes[msg.sender].lockPeriod < block.timestamp, 
                "Existing stake still locked");
            _unstake();
        }

        _transfer(msg.sender, address(this), amount);
        
        stakes[msg.sender] = StakeInfo({
            amount: amount,
            timestamp: block.timestamp,
            lockPeriod: lockPeriod
        });

        emit Staked(msg.sender, amount, lockPeriod);
    }

    function unstake() external nonReentrant {
        require(stakes[msg.sender].amount > 0, "No stake found");
        require(block.timestamp >= stakes[msg.sender].timestamp + stakes[msg.sender].lockPeriod, 
            "Stake still locked");

        _unstake();
    }

    function _unstake() internal {
        StakeInfo memory userStake = stakes[msg.sender];
        require(userStake.amount > 0, "No stake found");

        uint256 reward = calculateReward(msg.sender);
        delete stakes[msg.sender];

        _mint(msg.sender, reward);
        _transfer(address(this), msg.sender, userStake.amount);

        emit Unstaked(msg.sender, userStake.amount, reward);
    }

    function calculateReward(address user) public view returns (uint256) {
        StakeInfo memory userStake = stakes[user];
        if(userStake.amount == 0) return 0;

        uint256 timeStaked = block.timestamp - userStake.timestamp;
        if(timeStaked > userStake.lockPeriod) {
            timeStaked = userStake.lockPeriod;
        }

        // Calculate bonus APR based on lock period
        uint256 bonusApr = (userStake.lockPeriod * MAX_BONUS_APR) / MAX_LOCK_PERIOD;
        uint256 totalApr = BASE_APR + bonusApr;

        // Calculate reward: amount * APR * timeStaked / (365 days * 10000)
        return (userStake.amount * totalApr * timeStaked) / (365 days * 10000);
    }

    function getStakeInfo(address user) external view returns (
        uint256 amount,
        uint256 timestamp,
        uint256 lockPeriod,
        uint256 currentReward
    ) {
        StakeInfo memory userStake = stakes[user];
        return (
            userStake.amount,
            userStake.timestamp,
            userStake.lockPeriod,
            calculateReward(user)
        );
    }

    // Override functions required by ERC20Votes
    function _afterTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override(ERC20, ERC20Votes) {
        super._afterTokenTransfer(from, to, amount);
        
        // If this is a transfer to a new holder (not minting or burning)
        if (from != address(0) && to != address(0)) {
            // Trigger an event that MetaMask can detect
            emit Transfer(from, to, amount);
        }
    }

    function _mint(address to, uint256 amount) internal override(ERC20, ERC20Votes) {
        super._mint(to, amount);
    }

    function _burn(address account, uint256 amount) internal override(ERC20, ERC20Votes) {
        super._burn(account, amount);
    }
}