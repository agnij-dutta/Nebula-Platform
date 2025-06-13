// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "./ModuleBase.sol";
import "./interfaces/ILicenseModule.sol";
import "./interfaces/IIPAsset.sol";

/**
 * @title LicenseModule
 * @dev Implementation of the License module
 */
contract LicenseModule is ERC721Enumerable, ModuleBase, ILicenseModule {
    using Counters for Counters.Counter;
    Counters.Counter private _licenseIds;
    Counters.Counter private _templateIds;

    // Mapping from license ID to license terms
    mapping(uint256 => LicenseTerms) private _licenseTerms;

    // Mapping from license ID to IP token ID
    mapping(uint256 => uint256) private _licenseToToken;

    // Mapping from template ID to license terms
    mapping(uint256 => LicenseTerms) private _licenseTemplates;

    // Mapping from IP token ID to list of license IDs
    mapping(uint256 => uint256[]) private _tokenLicenses;

    // Mapping from license ID to expiration timestamp
    mapping(uint256 => uint256) private _licenseExpirations;

    // Module type constant
    bytes32 public constant MODULE_TYPE = keccak256("LICENSE_MODULE");
    bytes32 public constant IP_ASSET_MODULE_TYPE = keccak256("IP_ASSET");

    /**
     * @dev Constructor
     */
    constructor() ERC721("Nebula License", "NLICENSE") {}

    /**
     * @dev Get the module type
     * @return The module type as bytes32
     */
    function getModuleType() external pure override returns (bytes32) {
        return MODULE_TYPE;
    }

    /**
     * @dev Create a license template
     * @param terms The terms for the license template
     * @return The template ID
     */
    function createLicenseTemplate(LicenseTerms calldata terms) external override onlyInitialized returns (uint256) {
        _templateIds.increment();
        uint256 templateId = _templateIds.current();

        _licenseTemplates[templateId] = terms;

        return templateId;
    }

    /**
     * @dev Issue a license for an IP asset
     * @param ipTokenId The token ID of the IP asset
     * @param licensee The address of the licensee
     * @param templateId The template ID to use for the license
     * @return The license ID
     */
    function issueLicense(uint256 ipTokenId, address licensee, uint256 templateId) external override onlyInitialized returns (uint256) {
        // Get IP Asset module from registry
        address ipAssetAddress = getModuleAddress(IP_ASSET_MODULE_TYPE);

        // Check if sender is the IP owner
        IIPAsset ipAsset = IIPAsset(ipAssetAddress);
        require(ipAsset.isIPOwner(ipTokenId, msg.sender), "LicenseModule: Not the IP owner");

        // Check if template exists
        require(templateId <= _templateIds.current(), "LicenseModule: Template does not exist");

        // Create new license
        _licenseIds.increment();
        uint256 licenseId = _licenseIds.current();

        // Set license terms from template
        _licenseTerms[licenseId] = _licenseTemplates[templateId];

        // Set license metadata
        _licenseToToken[licenseId] = ipTokenId;
        _tokenLicenses[ipTokenId].push(licenseId);

        // Set expiration if applicable
        if (_licenseTerms[licenseId].duration > 0) {
            _licenseExpirations[licenseId] = block.timestamp + _licenseTerms[licenseId].duration;
        }

        // Mint license NFT to licensee
        _safeMint(licensee, licenseId);

        return licenseId;
    }

    /**
     * @dev Get the terms for a license
     * @param licenseId The license ID
     * @return The license terms
     */
    function getLicenseTerms(uint256 licenseId) external view override returns (LicenseTerms memory) {
        require(_exists(licenseId), "LicenseModule: License does not exist");
        return _licenseTerms[licenseId];
    }

    /**
     * @dev Check if a license is valid
     * @param licenseId The license ID
     * @return True if the license is valid, false otherwise
     */
    function isLicenseValid(uint256 licenseId) external view override returns (bool) {
        if (!_exists(licenseId)) {
            return false;
        }

        // Check if license has expired
        if (_licenseExpirations[licenseId] > 0 && block.timestamp > _licenseExpirations[licenseId]) {
            return false;
        }

        return true;
    }

    /**
     * @dev Revoke a license
     * @param licenseId The license ID
     */
    function revokeLicense(uint256 licenseId) external override {
        require(_exists(licenseId), "LicenseModule: License does not exist");

        uint256 ipTokenId = _licenseToToken[licenseId];

        // Get IP Asset module from registry
        address ipAssetAddress = getModuleAddress(IP_ASSET_MODULE_TYPE);

        // Check if sender is the IP owner
        IIPAsset ipAsset = IIPAsset(ipAssetAddress);
        require(ipAsset.isIPOwner(ipTokenId, msg.sender), "LicenseModule: Not the IP owner");

        // Burn the license NFT
        _burn(licenseId);
    }

    /**
     * @dev Get all licenses for an IP asset
     * @param ipTokenId The token ID of the IP asset
     * @return An array of license IDs
     */
    function getIPLicenses(uint256 ipTokenId) external view override returns (uint256[] memory) {
        return _tokenLicenses[ipTokenId];
    }

    /**
     * @dev Get all licenses held by an account
     * @param licensee The address of the licensee
     * @return An array of license IDs
     */
    function getLicenseeTokens(address licensee) external view override returns (uint256[] memory) {
        uint256 balance = balanceOf(licensee);
        uint256[] memory tokens = new uint256[](balance);

        for (uint256 i = 0; i < balance; i++) {
            tokens[i] = tokenOfOwnerByIndex(licensee, i);
        }

        return tokens;
    }
}
