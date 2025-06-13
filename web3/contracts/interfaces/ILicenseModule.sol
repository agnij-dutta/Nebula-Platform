// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

/**
 * @title ILicenseModule
 * @dev Interface for the License module
 */
interface ILicenseModule {
    /**
     * @dev Enum for license types
     */
    enum LicenseType { STANDARD, COMMERCIAL, DERIVATIVE, EXCLUSIVE }
    
    /**
     * @dev Enum for attribution requirements
     */
    enum AttributionRequirement { NONE, REQUIRED, PROMINENT }
    
    /**
     * @dev Struct for license terms
     */
    struct LicenseTerms {
        LicenseType licenseType;
        bool allowCommercialUse;
        bool allowModifications;
        AttributionRequirement attribution;
        uint256 royaltyPercentage; // In basis points (e.g., 250 = 2.5%)
        uint256 duration; // In seconds, 0 for perpetual
        uint256 maxRevenue; // Maximum revenue before renegotiation, 0 for unlimited
        string additionalTerms; // IPFS hash to additional terms
    }
    
    /**
     * @dev Create a license template
     * @param terms The terms for the license template
     * @return The template ID
     */
    function createLicenseTemplate(LicenseTerms calldata terms) external returns (uint256);
    
    /**
     * @dev Issue a license for an IP asset
     * @param ipTokenId The token ID of the IP asset
     * @param licensee The address of the licensee
     * @param templateId The template ID to use for the license
     * @return The license ID
     */
    function issueLicense(uint256 ipTokenId, address licensee, uint256 templateId) external returns (uint256);
    
    /**
     * @dev Get the terms for a license
     * @param licenseId The license ID
     * @return The license terms
     */
    function getLicenseTerms(uint256 licenseId) external view returns (LicenseTerms memory);
    
    /**
     * @dev Check if a license is valid
     * @param licenseId The license ID
     * @return True if the license is valid, false otherwise
     */
    function isLicenseValid(uint256 licenseId) external view returns (bool);
    
    /**
     * @dev Revoke a license
     * @param licenseId The license ID
     */
    function revokeLicense(uint256 licenseId) external;
    
    /**
     * @dev Get all licenses for an IP asset
     * @param ipTokenId The token ID of the IP asset
     * @return An array of license IDs
     */
    function getIPLicenses(uint256 ipTokenId) external view returns (uint256[] memory);
    
    /**
     * @dev Get all licenses held by an account
     * @param licensee The address of the licensee
     * @return An array of license IDs
     */
    function getLicenseeTokens(address licensee) external view returns (uint256[] memory);
}
