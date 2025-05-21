# Nebula Platform Technical Implementation Plan

## Overview

This document outlines the technical implementation plan for enhancing the Nebula Platform to compete with Story Protocol. The plan is divided into phases, with the initial focus on migrating to Next.js before implementing the advanced IP management features.

## Phase 1: Next.js Migration

### 1.1 Project Structure Analysis

**Current State:**
- React application built with Create React App (CRA)
- Frontend in `/frontend` directory
- Smart contracts in `/web3` directory
- Chainlink integration in `/chainlink` directory

**Implementation Steps:**

1. **Create a backup of the current codebase**
   ```bash
   cp -r ./frontend ./frontend-backup
   ```

2. **Install Next.js dependencies**
   ```bash
   cd frontend
   npm install next@latest react@latest react-dom@latest
   ```

3. **Create Next.js configuration file**
   - Create `next.config.mjs` in the frontend directory:
   ```javascript
   /** @type {import('next').NextConfig} */
   const nextConfig = {
     reactStrictMode: true,
     swcMinify: true,
     // Configure rewrites to handle API proxying
     async rewrites() {
       return [
         {
           source: '/api/:path*',
           destination: 'http://localhost:3001/api/:path*',
         },
       ];
     },
   };

   export default nextConfig;
   ```

4. **Update package.json scripts**
   ```json
   "scripts": {
     "dev": "next dev",
     "build": "next build",
     "start": "next start",
     "lint": "next lint"
   }
   ```

5. **Update .gitignore**
   ```
   # Next.js
   .next/
   out/
   next-env.d.ts
   ```

### 1.2 App Directory Structure

1. **Create basic app directory structure**
   ```
   frontend/
   ├── app/
   │   ├── layout.tsx
   │   ├── page.tsx
   │   ├── marketplace/
   │   │   └── page.tsx
   │   ├── create/
   │   │   └── page.tsx
   │   ├── research/
   │   │   └── page.tsx
   │   ├── governance/
   │   │   └── page.tsx
   │   └── api/
   │       └── route.ts
   ├── components/
   ├── public/
   ├── styles/
   ├── web3/
   └── next.config.mjs
   ```

2. **Create root layout**
   ```tsx
   // app/layout.tsx
   import '../styles/globals.css'
   import { Metadata } from 'next'

   export const metadata: Metadata = {
     title: 'Nebula Platform',
     description: 'Decentralized IP Marketplace on Avalanche',
   }

   export default function RootLayout({
     children,
   }: {
     children: React.ReactNode
   }) {
     return (
       <html lang="en">
         <body>
           <div className="stars-bg"></div>
           {children}
         </body>
       </html>
     )
   }
   ```

3. **Create Web3 Provider wrapper**
   ```tsx
   // app/providers.tsx
   'use client'

   import { ThemeProvider } from 'styled-components'
   import { MetaMaskProvider } from '../web3/providers/MetaMaskProvider'
   import { theme } from '../styles/theme'

   export function Providers({ children }: { children: React.ReactNode }) {
     return (
       <ThemeProvider theme={theme}>
         <MetaMaskProvider>
           {children}
         </MetaMaskProvider>
       </ThemeProvider>
     )
   }
   ```

### 1.3 Component Migration

1. **Convert class components to functional components**
   - Identify and refactor any class components to functional components with hooks

2. **Add 'use client' directive to client components**
   - Add the directive to components that use browser APIs, state, or effects

3. **Migrate routing**
   - Replace React Router with Next.js App Router
   - Update navigation components to use Next.js Link component

4. **Update data fetching patterns**
   - Replace direct API calls with Next.js data fetching methods
   - Implement Server Components for data-heavy pages

### 1.4 Web3 Integration Adaptation

1. **Update Web3 provider integration**
   - Modify the MetaMaskProvider to work with Next.js
   - Create a custom hook for wallet connection

2. **Create API routes for backend functionality**
   - Implement API routes in the `/app/api` directory
   - Move server-side logic to API routes

3. **Test Web3 functionality**
   - Verify wallet connection
   - Test contract interactions

## Phase 2: Modular Smart Contract Architecture

### 2.1 Contract Registry System

**Current State:**
- Monolithic contract structure
- Direct contract-to-contract interactions

**Implementation Steps:**

1. **Create Registry Contract**
   ```solidity
   // Registry.sol
   pragma solidity ^0.8.17;

   import "@openzeppelin/contracts/access/Ownable.sol";

   contract Registry is Ownable {
       mapping(bytes32 => address) private _contracts;

       event ContractRegistered(bytes32 indexed name, address indexed contractAddress);
       event ContractUpdated(bytes32 indexed name, address indexed oldAddress, address indexed newAddress);

       function registerContract(bytes32 name, address contractAddress) external onlyOwner {
           require(contractAddress != address(0), "Invalid contract address");
           require(_contracts[name] == address(0), "Contract already registered");

           _contracts[name] = contractAddress;
           emit ContractRegistered(name, contractAddress);
       }

       function updateContract(bytes32 name, address newAddress) external onlyOwner {
           require(newAddress != address(0), "Invalid contract address");
           require(_contracts[name] != address(0), "Contract not registered");

           address oldAddress = _contracts[name];
           _contracts[name] = newAddress;
           emit ContractUpdated(name, oldAddress, newAddress);
       }

       function getContract(bytes32 name) external view returns (address) {
           return _contracts[name];
       }
   }
   ```

2. **Create Module Interface**
   ```solidity
   // IModule.sol
   pragma solidity ^0.8.17;

   interface IModule {
       function initialize(address registry) external;
       function getModuleType() external pure returns (bytes32);
   }
   ```

3. **Create Module Base Contract**
   ```solidity
   // ModuleBase.sol
   pragma solidity ^0.8.17;

   import "./IModule.sol";
   import "./Registry.sol";

   abstract contract ModuleBase is IModule {
       Registry public registry;
       bool private _initialized;

       modifier onlyInitialized() {
           require(_initialized, "Module not initialized");
           _;
       }

       function initialize(address registryAddress) external override {
           require(!_initialized, "Already initialized");
           require(registryAddress != address(0), "Invalid registry address");

           registry = Registry(registryAddress);
           _initialized = true;
       }

       function getRegistry() internal view returns (Registry) {
           return registry;
       }
   }
   ```

### 2.2 IP Asset Framework

**Current State:**
- Simple NFT representation of IP
- Limited metadata and licensing capabilities

**Implementation Steps:**

1. **Create IPAsset Interface**
   ```solidity
   // IIPAsset.sol
   pragma solidity ^0.8.17;

   interface IIPAsset {
       struct IPMetadata {
           string title;
           string description;
           string contentURI;
           string[] tags;
           string category;
           uint256 createdAt;
       }

       function createIP(IPMetadata calldata metadata) external returns (uint256);
       function getIPMetadata(uint256 tokenId) external view returns (IPMetadata memory);
       function updateIPMetadata(uint256 tokenId, IPMetadata calldata metadata) external;
       function isIPOwner(uint256 tokenId, address account) external view returns (bool);
   }
   ```

2. **Create Enhanced IPToken Contract**
   ```solidity
   // IPAsset.sol
   pragma solidity ^0.8.17;

   import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
   import "@openzeppelin/contracts/utils/Counters.sol";
   import "./ModuleBase.sol";
   import "./IIPAsset.sol";

   contract IPAsset is ERC721URIStorage, ModuleBase, IIPAsset {
       using Counters for Counters.Counter;
       Counters.Counter private _tokenIds;

       // Mapping from token ID to metadata
       mapping(uint256 => IPMetadata) private _metadata;

       // Mapping from token ID to derivative relationships
       mapping(uint256 => uint256[]) private _derivatives;
       mapping(uint256 => uint256) private _parentTokens;

       bytes32 public constant MODULE_TYPE = keccak256("IP_ASSET");

       constructor() ERC721("Nebula IP Asset", "NIPA") {}

       function getModuleType() external pure override returns (bytes32) {
           return MODULE_TYPE;
       }

       function createIP(IPMetadata calldata metadata) external override onlyInitialized returns (uint256) {
           _tokenIds.increment();
           uint256 newTokenId = _tokenIds.current();

           _safeMint(msg.sender, newTokenId);
           _metadata[newTokenId] = metadata;

           return newTokenId;
       }

       function createDerivativeIP(uint256 parentTokenId, IPMetadata calldata metadata) external onlyInitialized returns (uint256) {
           require(_exists(parentTokenId), "Parent token does not exist");

           uint256 newTokenId = createIP(metadata);
           _derivatives[parentTokenId].push(newTokenId);
           _parentTokens[newTokenId] = parentTokenId;

           return newTokenId;
       }

       function getIPMetadata(uint256 tokenId) external view override returns (IPMetadata memory) {
           require(_exists(tokenId), "Token does not exist");
           return _metadata[tokenId];
       }

       function updateIPMetadata(uint256 tokenId, IPMetadata calldata metadata) external override {
           require(ownerOf(tokenId) == msg.sender, "Not the token owner");
           _metadata[tokenId] = metadata;
       }

       function isIPOwner(uint256 tokenId, address account) external view override returns (bool) {
           return ownerOf(tokenId) == account;
       }

       function getDerivatives(uint256 tokenId) external view returns (uint256[] memory) {
           require(_exists(tokenId), "Token does not exist");
           return _derivatives[tokenId];
       }

       function getParentToken(uint256 tokenId) external view returns (uint256) {
           require(_exists(tokenId), "Token does not exist");
           return _parentTokens[tokenId];
       }
   }
   ```

### 2.3 Licensing Module

**Current State:**
- Basic licensing with limited terms
- No formal derivative relationship tracking

**Implementation Steps:**

1. **Create License Interface**
   ```solidity
   // ILicenseModule.sol
   pragma solidity ^0.8.17;

   interface ILicenseModule {
       enum LicenseType { STANDARD, COMMERCIAL, DERIVATIVE, EXCLUSIVE }
       enum AttributionRequirement { NONE, REQUIRED, PROMINENT }

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

       function createLicenseTemplate(LicenseTerms calldata terms) external returns (uint256);
       function issueLicense(uint256 ipTokenId, address licensee, uint256 templateId) external returns (uint256);
       function getLicenseTerms(uint256 licenseId) external view returns (LicenseTerms memory);
       function isLicenseValid(uint256 licenseId) external view returns (bool);
       function revokeLicense(uint256 licenseId) external;
   }
   ```

2. **Create License Module Implementation**
   ```solidity
   // LicenseModule.sol
   pragma solidity ^0.8.17;

   import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
   import "@openzeppelin/contracts/utils/Counters.sol";
   import "./ModuleBase.sol";
   import "./ILicenseModule.sol";
   import "./IIPAsset.sol";

   contract LicenseModule is ERC721, ModuleBase, ILicenseModule {
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

       bytes32 public constant MODULE_TYPE = keccak256("LICENSE_MODULE");

       constructor() ERC721("Nebula License", "NLICENSE") {}

       function getModuleType() external pure override returns (bytes32) {
           return MODULE_TYPE;
       }

       function createLicenseTemplate(LicenseTerms calldata terms) external override onlyInitialized returns (uint256) {
           _templateIds.increment();
           uint256 templateId = _templateIds.current();

           _licenseTemplates[templateId] = terms;

           return templateId;
       }

       function issueLicense(uint256 ipTokenId, address licensee, uint256 templateId) external override onlyInitialized returns (uint256) {
           // Get IP Asset module from registry
           address ipAssetAddress = registry.getContract(keccak256("IP_ASSET"));
           require(ipAssetAddress != address(0), "IP Asset module not registered");

           // Check if sender is the IP owner
           IIPAsset ipAsset = IIPAsset(ipAssetAddress);
           require(ipAsset.isIPOwner(ipTokenId, msg.sender), "Not the IP owner");

           // Check if template exists
           require(templateId <= _templateIds.current(), "Template does not exist");

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

       function getLicenseTerms(uint256 licenseId) external view override returns (LicenseTerms memory) {
           require(_exists(licenseId), "License does not exist");
           return _licenseTerms[licenseId];
       }

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

       function revokeLicense(uint256 licenseId) external override {
           require(_exists(licenseId), "License does not exist");

           uint256 ipTokenId = _licenseToToken[licenseId];

           // Get IP Asset module from registry
           address ipAssetAddress = registry.getContract(keccak256("IP_ASSET"));
           require(ipAssetAddress != address(0), "IP Asset module not registered");

           // Check if sender is the IP owner
           IIPAsset ipAsset = IIPAsset(ipAssetAddress);
           require(ipAsset.isIPOwner(ipTokenId, msg.sender), "Not the IP owner");

           // Burn the license NFT
           _burn(licenseId);
       }
   }
   ```

### 2.4 Royalty Module

**Current State:**
- Basic revenue sharing
- No automated distribution

**Implementation Steps:**

1. **Create Royalty Interface**
   ```solidity
   // IRoyaltyModule.sol
   pragma solidity ^0.8.17;

   interface IRoyaltyModule {
       struct RoyaltyInfo {
           address recipient;
           uint256 percentage; // In basis points (e.g., 250 = 2.5%)
           uint256 maxAmount; // Maximum amount to pay, 0 for unlimited
           uint256 paidAmount; // Amount already paid
       }

       function setRoyaltyInfo(uint256 ipTokenId, RoyaltyInfo calldata info) external;
       function getRoyaltyInfo(uint256 ipTokenId) external view returns (RoyaltyInfo memory);
       function payRoyalty(uint256 ipTokenId) external payable;
       function withdrawRoyalties(uint256 ipTokenId) external;
   }
   ```

2. **Create Royalty Module Implementation**
   ```solidity
   // RoyaltyModule.sol
   pragma solidity ^0.8.17;

   import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
   import "./ModuleBase.sol";
   import "./IRoyaltyModule.sol";
   import "./IIPAsset.sol";

   contract RoyaltyModule is ModuleBase, IRoyaltyModule, ReentrancyGuard {
       // Mapping from IP token ID to royalty info
       mapping(uint256 => RoyaltyInfo) private _royaltyInfo;

       // Mapping from IP token ID to pending royalties
       mapping(uint256 => uint256) private _pendingRoyalties;

       bytes32 public constant MODULE_TYPE = keccak256("ROYALTY_MODULE");

       function getModuleType() external pure override returns (bytes32) {
           return MODULE_TYPE;
       }

       function setRoyaltyInfo(uint256 ipTokenId, RoyaltyInfo calldata info) external override onlyInitialized {
           // Get IP Asset module from registry
           address ipAssetAddress = registry.getContract(keccak256("IP_ASSET"));
           require(ipAssetAddress != address(0), "IP Asset module not registered");

           // Check if sender is the IP owner
           IIPAsset ipAsset = IIPAsset(ipAssetAddress);
           require(ipAsset.isIPOwner(ipTokenId, msg.sender), "Not the IP owner");

           // Set royalty info
           _royaltyInfo[ipTokenId] = info;
       }

       function getRoyaltyInfo(uint256 ipTokenId) external view override returns (RoyaltyInfo memory) {
           return _royaltyInfo[ipTokenId];
       }

       function payRoyalty(uint256 ipTokenId) external payable override onlyInitialized nonReentrant {
           RoyaltyInfo storage info = _royaltyInfo[ipTokenId];
           require(info.recipient != address(0), "Royalty recipient not set");

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

       function withdrawRoyalties(uint256 ipTokenId) external override onlyInitialized nonReentrant {
           RoyaltyInfo storage info = _royaltyInfo[ipTokenId];
           require(msg.sender == info.recipient, "Not the royalty recipient");

           uint256 amount = _pendingRoyalties[ipTokenId];
           require(amount > 0, "No pending royalties");

           // Reset pending royalties
           _pendingRoyalties[ipTokenId] = 0;

           // Transfer royalties
           payable(info.recipient).transfer(amount);
       }

       // Function to calculate royalty for a specific amount
       function calculateRoyalty(uint256 ipTokenId, uint256 amount) external view returns (uint256) {
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
   }
   ```

## Phase 3: Frontend Implementation

### 3.1 IP Management Dashboard

**Current State:**
- Basic marketplace UI
- Limited IP management capabilities

**Implementation Steps:**

1. **Create IP Asset Management Page**
   ```tsx
   // app/ip-management/page.tsx
   'use client'

   import { useState, useEffect } from 'react'
   import { useWeb3 } from '../../web3/hooks/useWeb3'
   import IPAssetCard from '../../components/IPAssetCard'
   import CreateIPModal from '../../components/CreateIPModal'

   export default function IPManagementPage() {
     const { contractInterface, account } = useWeb3()
     const [ownedAssets, setOwnedAssets] = useState([])
     const [licensedAssets, setLicensedAssets] = useState([])
     const [isLoading, setIsLoading] = useState(true)
     const [showCreateModal, setShowCreateModal] = useState(false)

     useEffect(() => {
       if (contractInterface && account) {
         loadAssets()
       }
     }, [contractInterface, account])

     const loadAssets = async () => {
       setIsLoading(true)
       try {
         const owned = await contractInterface.getOwnedIPAssets(account)
         const licensed = await contractInterface.getLicensedIPAssets(account)

         setOwnedAssets(owned)
         setLicensedAssets(licensed)
       } catch (error) {
         console.error('Failed to load assets:', error)
       } finally {
         setIsLoading(false)
       }
     }

     return (
       <div className="ip-management-container">
         <h1>IP Asset Management</h1>

         <div className="action-bar">
           <button
             className="create-button"
             onClick={() => setShowCreateModal(true)}
           >
             Create New IP Asset
           </button>
         </div>

         <div className="assets-section">
           <h2>My IP Assets</h2>
           {isLoading ? (
             <div className="loading">Loading assets...</div>
           ) : ownedAssets.length > 0 ? (
             <div className="assets-grid">
               {ownedAssets.map(asset => (
                 <IPAssetCard
                   key={asset.tokenId}
                   asset={asset}
                   isOwner={true}
                   onUpdate={loadAssets}
                 />
               ))}
             </div>
           ) : (
             <div className="empty-state">
               You don't own any IP assets yet.
             </div>
           )}
         </div>

         <div className="assets-section">
           <h2>Licensed IP Assets</h2>
           {isLoading ? (
             <div className="loading">Loading licenses...</div>
           ) : licensedAssets.length > 0 ? (
             <div className="assets-grid">
               {licensedAssets.map(asset => (
                 <IPAssetCard
                   key={asset.tokenId}
                   asset={asset}
                   isOwner={false}
                   isLicensed={true}
                   onUpdate={loadAssets}
                 />
               ))}
             </div>
           ) : (
             <div className="empty-state">
               You don't have any licensed IP assets yet.
             </div>
           )}
         </div>

         {showCreateModal && (
           <CreateIPModal
             onClose={() => setShowCreateModal(false)}
             onSuccess={loadAssets}
             contractInterface={contractInterface}
           />
         )}
       </div>
     )
   }
   ```

2. **Create IP Asset Card Component**
   ```tsx
   // components/IPAssetCard.tsx
   'use client'

   import { useState } from 'react'
   import Link from 'next/link'
   import Image from 'next/image'
   import { IPAsset } from '../types/ipAsset'

   interface IPAssetCardProps {
     asset: IPAsset
     isOwner: boolean
     isLicensed?: boolean
     onUpdate: () => void
   }

   export default function IPAssetCard({ asset, isOwner, isLicensed, onUpdate }: IPAssetCardProps) {
     const [isExpanded, setIsExpanded] = useState(false)

     return (
       <div className={`ip-asset-card ${isExpanded ? 'expanded' : ''}`}>
         <div className="card-header" onClick={() => setIsExpanded(!isExpanded)}>
           {asset.metadata.images && asset.metadata.images.length > 0 ? (
             <div className="asset-image">
               <Image
                 src={asset.metadata.images[0]}
                 alt={asset.metadata.title}
                 width={120}
                 height={120}
                 objectFit="cover"
               />
             </div>
           ) : (
             <div className="asset-image placeholder">
               <span>No Image</span>
             </div>
           )}

           <div className="asset-info">
             <h3>{asset.metadata.title}</h3>
             <p className="asset-description">{asset.metadata.description}</p>

             <div className="asset-meta">
               <span className="asset-id">ID: {asset.tokenId}</span>
               {isOwner && <span className="owner-badge">Owner</span>}
               {isLicensed && <span className="license-badge">Licensed</span>}
             </div>
           </div>
         </div>

         {isExpanded && (
           <div className="card-details">
             <div className="detail-section">
               <h4>Details</h4>
               <div className="detail-row">
                 <span className="label">Category:</span>
                 <span className="value">{asset.metadata.category}</span>
               </div>
               <div className="detail-row">
                 <span className="label">Created:</span>
                 <span className="value">{new Date(asset.metadata.createdAt).toLocaleDateString()}</span>
               </div>
               {asset.metadata.tags && (
                 <div className="detail-row">
                   <span className="label">Tags:</span>
                   <div className="tags">
                     {asset.metadata.tags.map(tag => (
                       <span key={tag} className="tag">{tag}</span>
                     ))}
                   </div>
                 </div>
               )}
             </div>

             <div className="action-buttons">
               <Link href={`/ip-asset/${asset.tokenId}`} className="view-button">
                 View Details
               </Link>

               {isOwner && (
                 <>
                   <Link href={`/ip-asset/${asset.tokenId}/licenses`} className="licenses-button">
                     Manage Licenses
                   </Link>
                   <Link href={`/ip-asset/${asset.tokenId}/royalties`} className="royalties-button">
                     Manage Royalties
                   </Link>
                 </>
               )}

               {!isOwner && !isLicensed && (
                 <Link href={`/marketplace/license/${asset.tokenId}`} className="license-button">
                   License This IP
                 </Link>
               )}
             </div>
           </div>
         )}
       </div>
     )
   }
   ```

### 3.2 License Management Interface

**Current State:**
- Limited license management capabilities
- No visualization of license relationships

**Implementation Steps:**

1. **Create License Management Page**
   ```tsx
   // app/ip-asset/[id]/licenses/page.tsx
   'use client'

   import { useState, useEffect } from 'react'
   import { useParams } from 'next/navigation'
   import { useWeb3 } from '../../../../web3/hooks/useWeb3'
   import LicenseCard from '../../../../components/LicenseCard'
   import CreateLicenseModal from '../../../../components/CreateLicenseModal'

   export default function LicenseManagementPage() {
     const params = useParams()
     const ipTokenId = params.id
     const { contractInterface, account } = useWeb3()
     const [ipAsset, setIpAsset] = useState(null)
     const [licenses, setLicenses] = useState([])
     const [isLoading, setIsLoading] = useState(true)
     const [showCreateModal, setShowCreateModal] = useState(false)

     useEffect(() => {
       if (contractInterface && ipTokenId) {
         loadData()
       }
     }, [contractInterface, ipTokenId])

     const loadData = async () => {
       setIsLoading(true)
       try {
         const asset = await contractInterface.getIPAsset(ipTokenId)
         const assetLicenses = await contractInterface.getIPLicenses(ipTokenId)

         setIpAsset(asset)
         setLicenses(assetLicenses)
       } catch (error) {
         console.error('Failed to load license data:', error)
       } finally {
         setIsLoading(false)
       }
     }

     if (isLoading) {
       return <div className="loading">Loading license information...</div>
     }

     if (!ipAsset) {
       return <div className="error">IP Asset not found</div>
     }

     const isOwner = ipAsset.owner === account

     return (
       <div className="license-management-container">
         <div className="page-header">
           <h1>License Management</h1>
           <h2>{ipAsset.metadata.title}</h2>
         </div>

         {isOwner && (
           <div className="action-bar">
             <button
               className="create-button"
               onClick={() => setShowCreateModal(true)}
             >
               Create License Template
             </button>
           </div>
         )}

         <div className="licenses-section">
           <h3>Active Licenses</h3>
           {licenses.length > 0 ? (
             <div className="licenses-grid">
               {licenses.map(license => (
                 <LicenseCard
                   key={license.licenseId}
                   license={license}
                   ipAsset={ipAsset}
                   isOwner={isOwner}
                   onUpdate={loadData}
                 />
               ))}
             </div>
           ) : (
             <div className="empty-state">
               No active licenses found for this IP asset.
             </div>
           )}
         </div>

         {showCreateModal && (
           <CreateLicenseModal
             ipTokenId={ipTokenId}
             onClose={() => setShowCreateModal(false)}
             onSuccess={loadData}
             contractInterface={contractInterface}
           />
         )}
       </div>
     )
   }
   ```

## Phase 4: Implementation Roadmap

### 4.1 Migration Phase (1-2 months)

1. **Week 1-2: Next.js Migration Setup**
   - Install Next.js dependencies
   - Create basic app directory structure
   - Set up configuration files

2. **Week 3-4: Component Migration**
   - Convert React components to Next.js
   - Implement client/server component separation
   - Update routing and navigation

3. **Week 5-6: Web3 Integration**
   - Adapt Web3 providers for Next.js
   - Test contract interactions
   - Implement API routes

4. **Week 7-8: Testing and Deployment**
   - Comprehensive testing of migrated application
   - Fix any migration issues
   - Deploy to production

### 4.2 Smart Contract Development Phase (2-3 months)

1. **Week 1-2: Registry System**
   - Develop and test Registry contract
   - Create module interfaces
   - Implement base module functionality

2. **Week 3-4: IP Asset Framework**
   - Develop enhanced IP Asset contract
   - Implement metadata standards
   - Create derivative tracking functionality

3. **Week 5-6: Licensing Module**
   - Develop License module
   - Implement license templates
   - Create license issuance and validation

4. **Week 7-8: Royalty Module**
   - Develop Royalty module
   - Implement royalty distribution
   - Create ceiling mechanisms

5. **Week 9-12: Testing and Auditing**
   - Comprehensive testing of all contracts
   - Security audit
   - Deploy to testnet for extended testing

### 4.3 Frontend Enhancement Phase (2-3 months)

1. **Week 1-3: IP Management Dashboard**
   - Develop IP asset management interface
   - Create asset visualization components
   - Implement IPFS integration for metadata

2. **Week 4-6: License Management**
   - Develop license management interface
   - Create license template builder
   - Implement license relationship visualization

3. **Week 7-9: Royalty Management**
   - Develop royalty management interface
   - Create revenue tracking dashboard
   - Implement payment history visualization

4. **Week 10-12: User Experience Refinement**
   - Usability testing
   - Performance optimization
   - Mobile responsiveness

## Conclusion

This technical implementation plan provides a comprehensive roadmap for enhancing the Nebula Platform to compete with Story Protocol. By following this phased approach, the platform can be systematically upgraded to incorporate advanced IP management features while maintaining a smooth user experience.

The plan prioritizes the migration to Next.js as the foundation for all future enhancements, followed by the development of a modular smart contract architecture that enables sophisticated IP asset management, licensing, and royalty distribution. The final phase focuses on creating intuitive user interfaces that make these complex features accessible to creators and users.

By implementing these enhancements, Nebula Platform will be well-positioned to compete with Story Protocol by offering a comprehensive IP management solution with unique differentiators in user experience, vertical focus, and integration capabilities.