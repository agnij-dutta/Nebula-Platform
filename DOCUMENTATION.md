# Nebula Platform Documentation

## Overview
Nebula is a decentralized platform for research funding and intellectual property management built on the Avalanche blockchain. It enables researchers to secure funding for their projects, protect their intellectual property through NFTs, and monetize their research outputs through a decentralized marketplace.

## Platform Components

### 1. Research Project Funding
- Researchers can create research projects with detailed milestones
- Projects can be funded by any participant using AVAX
- Funds are held in escrow and released upon milestone completion
- Each milestone requires verification through a decentralized oracle system
- Platform takes a small fee from successful funding (2.5%)

### 2. IP Protection System
The IP protection system uses NFTs (Non-Fungible Tokens) to represent intellectual property:

#### IP Token Features
- Unique ERC-721 tokens represent individual pieces of intellectual property
- Each token stores:
  - Title and description
  - Creator information
  - License terms
  - IPFS links to associated documentation
- Supports both full transfer and licensing models

#### IP Marketplace Features
- List IP tokens for sale or licensing
- Set custom pricing and license durations
- Automated license expiration handling
- Platform fee of 2.5% on sales
- Support for both perpetual transfers and time-limited licenses

### 3. Staking Mechanism
Users can stake NEBL tokens (platform's governance token) to:
- Participate in governance
- Earn rewards from platform fees
- Get reduced fees when using the platform
- Validate research milestones

#### Staking Parameters
- Minimum staking period: 30 days
- Reward distribution: Daily
- APR varies based on total staked amount
- Early unstaking penalties apply

### 4. Governance System
The platform uses a DAO (Decentralized Autonomous Organization) model for governance:

#### Governance Features
- Proposal creation requires minimum NEBL stake
- Voting power proportional to staked NEBL tokens
- Proposal types:
  - Platform parameter changes
  - Fee structure updates
  - Protocol upgrades
  - Treasury fund allocation
- Timelock on executed proposals

### 5. Platform Economics

#### Token Utility (NEBL)
- Governance participation
- Staking rewards
- Fee reductions
- Milestone validation rights

#### Fee Structure
- Project funding fee: 2.5%
- IP marketplace fee: 2.5%
- Fee distribution:
  - 60% to stakers
  - 20% to treasury
  - 20% burned

#### Incentive Mechanisms
- Staking rewards from fee distribution
- Reduced fees for NEBL stakers
- Governance voting rights
- Milestone validation rewards

### 6. Technical Implementation

#### Smart Contracts
1. `IPToken.sol`:
   - ERC-721 implementation for IP tokens
   - Handles IP creation and metadata storage
   - Manages licensing and transfers

2. `IPMarketplace.sol`:
   - Manages IP token listings
   - Handles sales and licensing transactions
   - Processes platform fees

3. `ResearchProject.sol`:
   - Manages research project creation
   - Handles funding and milestone tracking
   - Integrates with oracle system

4. `Governance.sol`:
   - Handles proposal creation and voting
   - Manages timelock for executed proposals
   - Controls platform parameters

5. `NEBLToken.sol`:
   - ERC-20 implementation for NEBL token
   - Handles staking and rewards
   - Integrates with governance system

#### Integration Points
- IPFS for decentralized storage
- Chainlink for oracle services
- Avalanche C-Chain for smart contracts
- MetaMask for wallet integration

## How to Use the Platform

### For Researchers
1. Create research projects:
   - Define milestones and funding goals
   - Upload project documentation
   - Set funding deadline

2. Protect IP:
   - Create IP tokens for research outputs
   - Define license terms
   - List on marketplace

3. Receive funding:
   - Track project funding
   - Submit milestone proofs
   - Receive milestone payments

### For Funders
1. Browse research projects:
   - Filter by category
   - Review project details
   - Assess funding progress

2. Fund projects:
   - Contribute AVAX to projects
   - Track milestone completion
   - Verify research outputs

### For IP Buyers/Licensees
1. Browse IP marketplace:
   - Search available IP tokens
   - Review license terms
   - Check pricing

2. Acquire IP rights:
   - Purchase full rights
   - Obtain time-limited licenses
   - Manage acquired licenses

## Security Considerations
- Smart contract audits required
- Multi-signature treasury
- Timelock on governance actions
- Oracle data validation
- Dispute resolution mechanism

## Future Development
- Cross-chain integration
- Enhanced oracle network
- Additional IP protection features
- Mobile application
- Integration with academic institutions