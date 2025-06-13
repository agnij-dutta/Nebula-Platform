// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

/**
 * @title IIPAsset
 * @dev Interface for the IP Asset module
 */
interface IIPAsset {
    /**
     * @dev Struct for IP metadata
     */
    struct IPMetadata {
        string title;
        string description;
        string contentURI;
        string[] tags;
        string category;
        uint256 createdAt;
    }
    
    /**
     * @dev Create a new IP asset
     * @param metadata The metadata for the IP asset
     * @return The token ID of the new IP asset
     */
    function createIP(IPMetadata calldata metadata) external returns (uint256);
    
    /**
     * @dev Create a derivative IP asset
     * @param parentTokenId The token ID of the parent IP asset
     * @param metadata The metadata for the derivative IP asset
     * @return The token ID of the new derivative IP asset
     */
    function createDerivativeIP(uint256 parentTokenId, IPMetadata calldata metadata) external returns (uint256);
    
    /**
     * @dev Get the metadata for an IP asset
     * @param tokenId The token ID of the IP asset
     * @return The metadata for the IP asset
     */
    function getIPMetadata(uint256 tokenId) external view returns (IPMetadata memory);
    
    /**
     * @dev Update the metadata for an IP asset
     * @param tokenId The token ID of the IP asset
     * @param metadata The new metadata for the IP asset
     */
    function updateIPMetadata(uint256 tokenId, IPMetadata calldata metadata) external;
    
    /**
     * @dev Check if an account is the owner of an IP asset
     * @param tokenId The token ID of the IP asset
     * @param account The account to check
     * @return True if the account is the owner, false otherwise
     */
    function isIPOwner(uint256 tokenId, address account) external view returns (bool);
    
    /**
     * @dev Get the derivative IP assets of an IP asset
     * @param tokenId The token ID of the IP asset
     * @return An array of token IDs for the derivative IP assets
     */
    function getDerivatives(uint256 tokenId) external view returns (uint256[] memory);
    
    /**
     * @dev Get the parent IP asset of a derivative IP asset
     * @param tokenId The token ID of the derivative IP asset
     * @return The token ID of the parent IP asset (0 if not a derivative)
     */
    function getParentToken(uint256 tokenId) external view returns (uint256);
}
