// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract IPToken is ERC721, ERC721URIStorage, ReentrancyGuard {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;

    struct IP {
        string title;
        string description;
        uint256 price;
        bool isListed;
        address creator;
        string licenseTerms;
    }

    mapping(uint256 => IP) public ipDetails;
    mapping(uint256 => mapping(address => bool)) public licensees;

    event IPCreated(uint256 indexed tokenId, address indexed creator, string title);
    event IPListed(uint256 indexed tokenId, uint256 price);
    event IPSold(uint256 indexed tokenId, address from, address to, uint256 price);
    event LicenseGranted(uint256 indexed tokenId, address indexed licensee);

    constructor() ERC721("Nebula IP Token", "NIP") {}

    function createIP(
        string memory title,
        string memory description,
        string memory uri,
        string memory licenseTerms
    ) external nonReentrant returns (uint256) {
        _tokenIds.increment();
        uint256 newTokenId = _tokenIds.current();

        _safeMint(msg.sender, newTokenId);
        _setTokenURI(newTokenId, uri);

        ipDetails[newTokenId] = IP({
            title: title,
            description: description,
            price: 0,
            isListed: false,
            creator: msg.sender,
            licenseTerms: licenseTerms
        });

        emit IPCreated(newTokenId, msg.sender, title);
        return newTokenId;
    }

    function listIP(uint256 tokenId, uint256 price) external {
        require(ownerOf(tokenId) == msg.sender, "Not the owner");
        require(price > 0, "Price must be greater than 0");
        
        ipDetails[tokenId].price = price;
        ipDetails[tokenId].isListed = true;
        
        emit IPListed(tokenId, price);
    }

    function buyIP(uint256 tokenId) external payable nonReentrant {
        IP memory ip = ipDetails[tokenId];
        require(ip.isListed, "IP not listed for sale");
        require(msg.value >= ip.price, "Insufficient payment");
        
        address seller = ownerOf(tokenId);
        
        _transfer(seller, msg.sender, tokenId);
        payable(seller).transfer(msg.value);
        
        ipDetails[tokenId].isListed = false;
        
        emit IPSold(tokenId, seller, msg.sender, msg.value);
    }

    function grantLicense(uint256 tokenId, address licensee) external {
        require(ownerOf(tokenId) == msg.sender, "Not the owner");
        licensees[tokenId][licensee] = true;
        emit LicenseGranted(tokenId, licensee);
    }

    function hasLicense(uint256 tokenId, address licensee) external view returns (bool) {
        return licensees[tokenId][licensee];
    }

    // Override required functions
    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
    }

    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}