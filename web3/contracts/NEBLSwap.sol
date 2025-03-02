// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "./NEBLToken.sol";

contract NEBLSwap is ReentrancyGuard, Ownable {
    NEBLToken public neblToken;
    AggregatorV3Interface public priceFeed;
    uint256 public constant PRICE_DECIMALS = 8;
    uint256 public swapFee = 30; // 0.3%
    uint256 public constant FEE_DENOMINATOR = 10000;

    event SwapAVAXForNEBL(address indexed user, uint256 avaxAmount, uint256 neblAmount);
    event SwapFeeUpdated(uint256 newFee);

    constructor(address _neblToken, address _priceFeed) {
        require(_neblToken != address(0), "Invalid NEBL token address");
        require(_priceFeed != address(0), "Invalid price feed address");
        neblToken = NEBLToken(_neblToken);
        priceFeed = AggregatorV3Interface(_priceFeed);
    }

    function getLatestAVAXPrice() public view returns (uint256) {
        (,int price,,,) = priceFeed.latestRoundData();
        require(price > 0, "Invalid price feed data");
        return uint256(price);
    }

    function calculateNEBLAmount(uint256 avaxAmount) public view returns (uint256) {
        require(avaxAmount > 0, "Amount must be greater than 0");
        
        uint256 avaxPrice = getLatestAVAXPrice();
        uint256 avaxValue = (avaxAmount * avaxPrice) / 1e18;
        uint256 neblAmount = avaxValue * 1e18 / (10 ** PRICE_DECIMALS);
        
        // Calculate fee with proper precision handling
        uint256 fee = (neblAmount * swapFee) / FEE_DENOMINATOR;
        uint256 finalAmount = neblAmount - fee;
        
        require(finalAmount > 0, "Calculated amount too small");
        return finalAmount;
    }

    function swapAVAXForNEBL() public payable nonReentrant {
        require(msg.value > 0, "Must send AVAX");
        
        uint256 neblAmount = calculateNEBLAmount(msg.value);
        require(neblAmount > 0, "Invalid NEBL amount calculated");
        require(neblToken.balanceOf(address(this)) >= neblAmount, "Insufficient NEBL liquidity");
        
        // Transfer tokens first
        bool success = neblToken.transfer(msg.sender, neblAmount);
        require(success, "Token transfer failed");
        
        // Emit event after successful transfer
        emit SwapAVAXForNEBL(msg.sender, msg.value, neblAmount);
    }

    function setSwapFee(uint256 _newFee) external onlyOwner {
        require(_newFee <= 1000, "Fee too high"); // Max 10%
        swapFee = _newFee;
        emit SwapFeeUpdated(_newFee);
    }

    function withdrawAVAX() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No AVAX to withdraw");
        payable(owner()).transfer(balance);
    }

    function withdrawNEBL(uint256 amount) external onlyOwner {
        require(amount > 0, "Amount must be greater than 0");
        require(amount <= neblToken.balanceOf(address(this)), "Insufficient balance");
        require(neblToken.transfer(owner(), amount), "Transfer failed");
    }

    receive() external payable {
        swapAVAXForNEBL();
    }
}