// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "./ModuleBase.sol";
import "./interfaces/IIPAsset.sol";

/**
 * @title IPAsset
 * @dev Implementation of the IP Asset module
 */
contract IPAsset is ERC721URIStorage, ModuleBase, IIPAsset {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;

    // Mapping from token ID to metadata
    mapping(uint256 => IPMetadata) private _metadata;

    // Mapping from token ID to derivative relationships
    mapping(uint256 => uint256[]) private _derivatives;
    mapping(uint256 => uint256) private _parentTokens;

    // Module type constant
    bytes32 public constant MODULE_TYPE = keccak256("IP_ASSET");

    /**
     * @dev Constructor
     */
    constructor() ERC721("Nebula IP Asset", "NIPA") {}

    /**
     * @dev Get the module type
     * @return The module type as bytes32
     */
    function getModuleType() external pure override returns (bytes32) {
        return MODULE_TYPE;
    }

    /**
     * @dev Create a new IP asset
     * @param metadata The metadata for the IP asset
     * @return The token ID of the new IP asset
     */
    function createIP(IPMetadata calldata metadata) external override onlyInitialized returns (uint256) {
        _tokenIds.increment();
        uint256 newTokenId = _tokenIds.current();

        _safeMint(msg.sender, newTokenId);
        _metadata[newTokenId] = metadata;

        return newTokenId;
    }

    /**
     * @dev Create a derivative IP asset
     * @param parentTokenId The token ID of the parent IP asset
     * @param metadata The metadata for the derivative IP asset
     * @return The token ID of the new derivative IP asset
     */
    function createDerivativeIP(uint256 parentTokenId, IPMetadata calldata metadata) external override onlyInitialized returns (uint256) {
        require(_exists(parentTokenId), "IPAsset: Parent token does not exist");

        // Create new token
        _tokenIds.increment();
        uint256 newTokenId = _tokenIds.current();

        _safeMint(msg.sender, newTokenId);
        _metadata[newTokenId] = metadata;

        // Set derivative relationships
        _derivatives[parentTokenId].push(newTokenId);
        _parentTokens[newTokenId] = parentTokenId;

        return newTokenId;
    }

    /**
     * @dev Get the metadata for an IP asset
     * @param tokenId The token ID of the IP asset
     * @return The metadata for the IP asset
     */
    function getIPMetadata(uint256 tokenId) external view override returns (IPMetadata memory) {
        require(_exists(tokenId), "IPAsset: Token does not exist");
        return _metadata[tokenId];
    }

    /**
     * @dev Update the metadata for an IP asset
     * @param tokenId The token ID of the IP asset
     * @param metadata The new metadata for the IP asset
     */
    function updateIPMetadata(uint256 tokenId, IPMetadata calldata metadata) external override {
        require(ownerOf(tokenId) == msg.sender, "IPAsset: Not the token owner");
        _metadata[tokenId] = metadata;
    }

    /**
     * @dev Check if an account is the owner of an IP asset
     * @param tokenId The token ID of the IP asset
     * @param account The account to check
     * @return True if the account is the owner, false otherwise
     */
    function isIPOwner(uint256 tokenId, address account) external view override returns (bool) {
        return ownerOf(tokenId) == account;
    }

    /**
     * @dev Get the derivative IP assets of an IP asset
     * @param tokenId The token ID of the IP asset
     * @return An array of token IDs for the derivative IP assets
     */
    function getDerivatives(uint256 tokenId) external view override returns (uint256[] memory) {
        require(_exists(tokenId), "IPAsset: Token does not exist");
        return _derivatives[tokenId];
    }

    /**
     * @dev Get the parent IP asset of a derivative IP asset
     * @param tokenId The token ID of the derivative IP asset
     * @return The token ID of the parent IP asset (0 if not a derivative)
     */
    function getParentToken(uint256 tokenId) external view override returns (uint256) {
        require(_exists(tokenId), "IPAsset: Token does not exist");
        return _parentTokens[tokenId];
    }

    /**
     * @dev Override _beforeTokenTransfer to handle derivative relationships
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal override {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);

        // Additional logic for derivative relationships could be added here
    }
}
