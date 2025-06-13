// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

/**
 * @title IRoyaltyModule
 * @dev Interface for the Royalty module
 */
interface IRoyaltyModule {
    /**
     * @dev Struct for royalty information
     */
    struct RoyaltyInfo {
        address recipient;
        uint256 percentage; // In basis points (e.g., 250 = 2.5%)
        uint256 maxAmount; // Maximum amount to pay, 0 for unlimited
        uint256 paidAmount; // Amount already paid
    }
    
    /**
     * @dev Set royalty information for an IP asset
     * @param ipTokenId The token ID of the IP asset
     * @param info The royalty information
     */
    function setRoyaltyInfo(uint256 ipTokenId, RoyaltyInfo calldata info) external;
    
    /**
     * @dev Get royalty information for an IP asset
     * @param ipTokenId The token ID of the IP asset
     * @return The royalty information
     */
    function getRoyaltyInfo(uint256 ipTokenId) external view returns (RoyaltyInfo memory);
    
    /**
     * @dev Pay royalties for an IP asset
     * @param ipTokenId The token ID of the IP asset
     */
    function payRoyalty(uint256 ipTokenId) external payable;
    
    /**
     * @dev Withdraw royalties for an IP asset
     * @param ipTokenId The token ID of the IP asset
     */
    function withdrawRoyalties(uint256 ipTokenId) external;
    
    /**
     * @dev Calculate royalty amount for a specific amount
     * @param ipTokenId The token ID of the IP asset
     * @param amount The amount to calculate royalties for
     * @return The royalty amount
     */
    function calculateRoyalty(uint256 ipTokenId, uint256 amount) external view returns (uint256);
    
    /**
     * @dev Get pending royalties for an IP asset
     * @param ipTokenId The token ID of the IP asset
     * @return The pending royalty amount
     */
    function getPendingRoyalties(uint256 ipTokenId) external view returns (uint256);
}
