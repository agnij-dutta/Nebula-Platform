# Nebula Launchpad

## Overview
Nebula Launchpad is a decentralized platform for intellectual property (IP) trading, research project funding, and community governance built on the Avalanche network. The platform combines IP marketplace functionality with research funding mechanisms and DAO governance.

## Features

### 1. IP Marketplace
- Trade intellectual property rights as NFTs
- Support for both full ownership transfers and time-limited licensing
- Built-in royalty and platform fee mechanisms
- Transparent pricing and ownership history

### 2. Research Project Funding
- Launch research projects with milestone-based funding
- Chainlink oracle integration for milestone verification
- Escrow system for secure fund management
- Dispute resolution mechanism

### 3. NEBL Token & Tokenomics
- Token Symbol: NEBL
- Total Supply: 100,000,000 NEBL
- Token Distribution:
  - 40% - Community & Ecosystem
  - 20% - Initial Liquidity
  - 15% - Team & Advisors (vested)
  - 15% - Research Project Funding Pool
  - 10% - DAO Treasury

### 4. Staking Mechanism
- Flexible staking periods (7-365 days)
- Base APR: 5%
- Maximum Bonus APR: 15% (for 365-day locks)
- Governance rights through ERC20Votes implementation

### 5. Token Swap
- Direct AVAX to NEBL swapping
- Dynamic pricing using Chainlink price feeds
- 0.3% swap fee (adjustable by governance)
- Automated liquidity management

### 6. Governance (NebulaDAO)
- Token-weighted voting
- Proposal creation requires minimum token holding
- Timelock for proposal execution
- Voting periods and thresholds adjustable by governance

## Smart Contracts

1. NEBLToken.sol: ERC20 token with voting and staking capabilities
2. IPMarketplace.sol: NFT marketplace for IP trading
3. ResearchProject.sol: Research project funding and milestone management
4. Governance.sol: DAO governance implementation
5. NEBLSwap.sol: Token swap functionality
6. Disputes.sol: Dispute resolution system

## Technical Architecture

### Frontend
- React-based responsive interface
- Web3 integration for wallet connectivity
- Real-time price feeds and transaction status
- MetaMask integration

### Smart Contract Integration
- Hardhat development framework
- OpenZeppelin contract standards
- Chainlink oracle integration
- Comprehensive testing suite

## Security Features
- Reentrancy protection
- Role-based access control
- Timelock mechanisms
- Oracle price validation
- Emergency pause functionality

## Development Setup

### Prerequisites
- Node.js (v16 or higher)
- Git
- MetaMask wallet
- Yarn (optional but recommended)

### Smart Contracts (web3/)
```bash
cd web3
npm install
# Copy example environment file
cp .env.example .env
# Edit .env with your configuration
# Deploy contracts
npx hardhat run scripts/deploy.js --network fuji
```

### Frontend (frontend/)
```bash
cd frontend
npm install
# Copy example environment file
cp .env.example .env
# Edit .env with your configuration
npm start
```

### Chainlink Adapter (chainlink/milestone-adapter/)
```bash
cd chainlink/milestone-adapter
npm install
# Copy example environment file
cp .env.example .env
# Edit .env with your configuration
npm run build
npm start
```

### Environment Variables

#### Smart Contracts (.env)
- PRIVATE_KEY: Your deployment wallet private key
- FUJI_RPC_URL: Avalanche Fuji RPC URL
- SNOWTRACE_API_KEY: API key for contract verification

#### Frontend (.env)
- REACT_APP_AVALANCHE_TESTNET_RPC: Avalanche Fuji RPC URL
- REACT_APP_AVALANCHE_MAINNET_RPC: Avalanche Mainnet RPC URL

#### Chainlink Adapter (.env)
- EA_PORT: External adapter port
- IPFS_GATEWAY: IPFS gateway URL
- RPC_URL: Avalanche network RPC URL

## Contributing

We welcome contributions to Nebula Launchpad! Here's how you can help:

### Submitting Changes

1. Fork the repository
2. Create a new branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Coding Standards

- Use TypeScript for frontend and Chainlink adapter development
- Follow Solidity style guide for smart contracts
- Write comprehensive tests for new features
- Comment your code appropriately
- Update documentation when needed

### Testing

```bash
# Smart Contracts
cd web3
npx hardhat test

# Frontend
cd frontend
npm test

# Chainlink Adapter
cd chainlink/milestone-adapter
npm test
```

### Pre-commit Checklist

- Run all tests
- Update documentation if needed
- Ensure code is properly formatted
- Check for any hardcoded values that should be configurable

## Networks
- Mainnet: Avalanche C-Chain
- Testnet: Avalanche Fuji

## Auditing
Smart contracts pending audit by [Audit Firm Name]

## License
MIT License

---

## Whitepaper

### 1. Introduction
Nebula Launchpad revolutionizes intellectual property trading and research funding through blockchain technology. The platform creates a decentralized ecosystem where researchers, investors, and IP traders can interact seamlessly.

### 2. Problem Statement
- Traditional IP trading lacks transparency and liquidity
- Research funding is centralized and inefficient
- Limited community involvement in research direction
- High barriers to entry for small investors

### 3. Solution
Nebula Launchpad provides a decentralized platform that:
- Tokenizes intellectual property
- Enables fractional ownership
- Provides transparent funding mechanisms
- Creates community-driven governance

### 4. Technology Stack
- Smart Contracts: Solidity 0.8.17
- Frontend: React
- Blockchain: Avalanche
- Oracles: Chainlink
- Standards: ERC20, ERC721, ERC20Votes

### 5. Token Economics

#### NEBL Token Utility
- Governance participation
- Staking rewards
- Platform fee discounts
- Research project funding
- IP marketplace transactions

#### Staking Mechanism
1. Base Rewards
   - 5% base APR
   - Additional bonus up to 15% based on lock duration
   - Minimum lock: 7 days
   - Maximum lock: 365 days

2. Lock Period Bonuses
   - 7-30 days: Base APR only
   - 31-90 days: Base + 5% bonus
   - 91-180 days: Base + 10% bonus
   - 181-365 days: Base + 15% bonus

#### Token Distribution Timeline
- Initial Release: 40% (Community & Ecosystem)
- Team & Advisors: 15% (1-year cliff, 2-year vesting)
- Research Pool: 15% (Released based on governance)
- Treasury: 10% (Controlled by DAO)
- Liquidity: 20% (Locked for 2 years)

### 6. Governance

#### Proposal Types
1. Platform Parameters
   - Fee adjustments
   - Staking parameters
   - Voting thresholds

2. Treasury Management
   - Fund allocation
   - Research grants
   - Protocol upgrades

3. Protocol Updates
   - Contract upgrades
   - New features
   - Security improvements

#### Voting Mechanism
- Minimum tokens to propose: 100,000 NEBL
- Voting period: 7 days
- Timelock period: 2 days
- Quorum: 4% of total supply
- Execution threshold: 51% approval

### 7. Research Project Framework

#### Funding Structure
1. Initial Proposal
   - Project details
   - Milestone definitions
   - Funding requirements
   - Team qualifications

2. Milestone-based Release
   - Predefined milestones
   - Oracle verification
   - Community validation
   - Automated payments

3. Dispute Resolution
   - Community voting
   - Expert review
   - Automated resolution
   - Appeal process

### 8. Revenue Model

#### Platform Fees
1. IP Marketplace
   - 2.5% listing fee
   - 1% license renewal fee
   - 0.5% transfer fee

2. Token Swap
   - 0.3% swap fee
   - Fee sharing with stakers

3. Research Projects
   - 1% project funding fee
   - 0.5% milestone completion fee

### 9. Security Measures
- Multi-signature requirements
- Timelock delays
- Emergency pause functionality
- Regular audits
- Bug bounty program

### 10. Future Development

#### Phase 1 (Current)
- Basic platform functionality
- Token launch
- Governance implementation

#### Phase 2 (Q2 2025)
- Enhanced IP marketplace features
- Cross-chain integration
- Advanced research tools

#### Phase 3 (Q4 2025)
- Mobile application
- AI integration
- Additional oracle integrations

### 11. Risk Factors
- Smart contract vulnerabilities
- Market volatility
- Regulatory changes
- Oracle reliability
- Network congestion

### 12. Conclusion
Nebula Launchpad aims to create a sustainable ecosystem for IP trading and research funding, powered by decentralized governance and innovative tokenomics.