// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./ModuleBase.sol";
import "./interfaces/IRoyaltyModule.sol";
import "./interfaces/IIPAsset.sol";

/**
 * @title RoyaltyModule
 * @dev Implementation of the Royalty module
 */
contract RoyaltyModule is ModuleBase, IRoyaltyModule, ReentrancyGuard {
    // Mapping from IP token ID to royalty info
    mapping(uint256 => RoyaltyInfo) private _royaltyInfo;
    
    // Mapping from IP token ID to pending royalties
    mapping(uint256 => uint256) private _pendingRoyalties;
    
    // Module type constant
    bytes32 public constant MODULE_TYPE = keccak256("ROYALTY_MODULE");
    bytes32 public constant IP_ASSET_MODULE_TYPE = keccak256("IP_ASSET");
    
    /**
     * @dev Get the module type
     * @return The module type as bytes32
     */
    function getModuleType() external pure override returns (bytes32) {
        return MODULE_TYPE;
    }
    
    /**
     * @dev Set royalty information for an IP asset
     * @param ipTokenId The token ID of the IP asset
     * @param info The royalty information
     */
    function setRoyaltyInfo(uint256 ipTokenId, RoyaltyInfo calldata info) external override onlyInitialized {
        // Get IP Asset module from registry
        address ipAssetAddress = getModuleAddress(IP_ASSET_MODULE_TYPE);
        
        // Check if sender is the IP owner
        IIPAsset ipAsset = IIPAsset(ipAssetAddress);
        require(ipAsset.isIPOwner(ipTokenId, msg.sender), "RoyaltyModule: Not the IP owner");
        
        // Set royalty info
        _royaltyInfo[ipTokenId] = info;
    }
    
    /**
     * @dev Get royalty information for an IP asset
     * @param ipTokenId The token ID of the IP asset
     * @return The royalty information
     */
    function getRoyaltyInfo(uint256 ipTokenId) external view override returns (RoyaltyInfo memory) {
        return _royaltyInfo[ipTokenId];
    }
    
    /**
     * @dev Pay royalties for an IP asset
     * @param ipTokenId The token ID of the IP asset
     */
    function payRoyalty(uint256 ipTokenId) external payable override onlyInitialized nonReentrant {
        RoyaltyInfo storage info = _royaltyInfo[ipTokenId];
        require(info.recipient != address(0), "RoyaltyModule: Royalty recipient not set");
        
        uint256 amount = msg.value;
        
        // Check if payment exceeds max amount
        if (info.maxAmount > 0) {
            uint256 remaining = info.maxAmount - info.paidAmount;
            if (amount > remaining) {
                amount = remaining;
                // Refund excess
                payable(msg.sender).transfer(msg.value - amount);
            }
        }
        
        // Update paid amount
        info.paidAmount += amount;
        
        // Add to pending royalties
        _pendingRoyalties[ipTokenId] += amount;
    }
    
    /**
     * @dev Withdraw royalties for an IP asset
     * @param ipTokenId The token ID of the IP asset
     */
    function withdrawRoyalties(uint256 ipTokenId) external override onlyInitialized nonReentrant {
        RoyaltyInfo storage info = _royaltyInfo[ipTokenId];
        require(msg.sender == info.recipient, "RoyaltyModule: Not the royalty recipient");
        
        uint256 amount = _pendingRoyalties[ipTokenId];
        require(amount > 0, "RoyaltyModule: No pending royalties");
        
        // Reset pending royalties
        _pendingRoyalties[ipTokenId] = 0;
        
        // Transfer royalties
        payable(info.recipient).transfer(amount);
    }
    
    /**
     * @dev Calculate royalty amount for a specific amount
     * @param ipTokenId The token ID of the IP asset
     * @param amount The amount to calculate royalties for
     * @return The royalty amount
     */
    function calculateRoyalty(uint256 ipTokenId, uint256 amount) external view override returns (uint256) {
        RoyaltyInfo storage info = _royaltyInfo[ipTokenId];
        
        // Calculate royalty amount
        uint256 royaltyAmount = (amount * info.percentage) / 10000;
        
        // Check if royalty exceeds max amount
        if (info.maxAmount > 0) {
            uint256 remaining = info.maxAmount - info.paidAmount;
            if (royaltyAmount > remaining) {
                royaltyAmount = remaining;
            }
        }
        
        return royaltyAmount;
    }
    
    /**
     * @dev Get pending royalties for an IP asset
     * @param ipTokenId The token ID of the IP asset
     * @return The pending royalty amount
     */
    function getPendingRoyalties(uint256 ipTokenId) external view override returns (uint256) {
        return _pendingRoyalties[ipTokenId];
    }
}
