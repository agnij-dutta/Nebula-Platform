// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract IPMarketplace is ReentrancyGuard {
    using Counters for Counters.Counter;
    Counters.Counter private _listingIds;

    struct Listing {
        uint256 listingId;
        uint256 tokenId;
        address seller;
        uint256 price;
        bool isActive;
        bool isLicense;
        uint256 licenseDuration;
    }

    mapping(uint256 => Listing) public listings;
    mapping(uint256 => mapping(address => uint256)) public licenseExpirations;

    IERC721 public ipToken;
    uint256 public platformFee = 25; // 2.5%
    address public platformWallet;

    event ListingCreated(
        uint256 indexed listingId,
        uint256 indexed tokenId,
        address seller,
        uint256 price,
        bool isLicense
    );
    event ListingPurchased(
        uint256 indexed listingId,
        uint256 indexed tokenId,
        address buyer,
        uint256 price
    );
    event LicenseGranted(
        uint256 indexed tokenId,
        address indexed licensee,
        uint256 expirationTime
    );

    constructor(address _ipTokenAddress, address _platformWallet) {
        ipToken = IERC721(_ipTokenAddress);
        platformWallet = _platformWallet;
    }

    function createListing(
        uint256 tokenId,
        uint256 price,
        bool isLicense,
        uint256 licenseDuration
    ) external nonReentrant {
        require(ipToken.ownerOf(tokenId) == msg.sender, "Not token owner");
        require(price > 0, "Price must be greater than 0");

        _listingIds.increment();
        uint256 listingId = _listingIds.current();

        listings[listingId] = Listing({
            listingId: listingId,
            tokenId: tokenId,
            seller: msg.sender,
            price: price,
            isActive: true,
            isLicense: isLicense,
            licenseDuration: licenseDuration
        });

        if (!isLicense) {
            ipToken.transferFrom(msg.sender, address(this), tokenId);
        }

        emit ListingCreated(listingId, tokenId, msg.sender, price, isLicense);
    }

    function purchaseListing(uint256 listingId) external payable nonReentrant {
        Listing storage listing = listings[listingId];
        require(listing.isActive, "Listing not active");
        require(msg.value >= listing.price, "Insufficient payment");

        listing.isActive = false;
        
        uint256 platformFeeAmount = (msg.value * platformFee) / 1000;
        uint256 sellerAmount = msg.value - platformFeeAmount;
        
        payable(platformWallet).transfer(platformFeeAmount);
        payable(listing.seller).transfer(sellerAmount);

        if (listing.isLicense) {
            licenseExpirations[listing.tokenId][msg.sender] = block.timestamp + listing.licenseDuration;
            emit LicenseGranted(listing.tokenId, msg.sender, licenseExpirations[listing.tokenId][msg.sender]);
        } else {
            ipToken.transferFrom(address(this), msg.sender, listing.tokenId);
        }

        emit ListingPurchased(listingId, listing.tokenId, msg.sender, msg.value);
    }

    function cancelListing(uint256 listingId) external nonReentrant {
        Listing storage listing = listings[listingId];
        require(listing.seller == msg.sender, "Not the seller");
        require(listing.isActive, "Listing not active");

        listing.isActive = false;
        
        if (!listing.isLicense) {
            ipToken.transferFrom(address(this), msg.sender, listing.tokenId);
        }
    }

    function hasValidLicense(uint256 tokenId, address licensee) external view returns (bool) {
        uint256 expiration = licenseExpirations[tokenId][licensee];
        return expiration > block.timestamp;
    }

    function getListing(uint256 listingId) external view returns (Listing memory) {
        return listings[listingId];
    }

    function getActiveListings(uint256 startId, uint256 pageSize) external view returns (Listing[] memory) {
        uint256 currentTotal = _listingIds.current();
        require(startId <= currentTotal, "Start ID too high");
        
        // Calculate actual page size
        uint256 remainingListings = currentTotal - startId + 1;
        uint256 actualPageSize = pageSize < remainingListings ? pageSize : remainingListings;
        
        // Create array to store active listings
        Listing[] memory activeListings = new Listing[](actualPageSize);
        uint256 activeCount = 0;
        
        // Iterate through listings and collect active ones
        for (uint256 i = startId; i <= startId + pageSize - 1 && i <= currentTotal; i++) {
            if (listings[i].isActive) {
                activeListings[activeCount] = listings[i];
                activeCount++;
            }
        }
        
        // Create correctly sized array for result
        Listing[] memory result = new Listing[](activeCount);
        for (uint256 i = 0; i < activeCount; i++) {
            result[i] = activeListings[i];
        }
        
        return result;
    }
}