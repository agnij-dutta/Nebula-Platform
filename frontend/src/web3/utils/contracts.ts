import { ethers } from 'ethers';
import { WEB3_CONFIG } from '../config';

// Import new modular contract ABIs
import RegistryABI from '../contracts/Registry.json';
import IPAssetABI from '../contracts/IPAsset.json';
import LicenseModuleABI from '../contracts/LicenseModule.json';
import RoyaltyModuleABI from '../contracts/RoyaltyModule.json';

// Import legacy contracts that are still needed
import IPMarketplaceABI from '../contracts/IPMarketplace.json';
import NEBLTokenABI from '../contracts/NEBLToken.json';
import ResearchProjectABI from '../contracts/ResearchProject.json';
import GovernanceABI from '../contracts/Governance.json';
import DisputesABI from '../contracts/Disputes.json';
import MilestoneOracleABI from '../contracts/MilestoneOracle.json';
import FundingEscrowABI from '../contracts/FundingEscrow.json';
import NEBLSwapABI from '../contracts/NEBLSwap.json';

// Import types
import { IPTokenData } from '../../types/ipTokens';

// IP Asset Metadata structure (from the modular contract)
export interface IPAssetMetadata {
    title: string;
    description: string;
    contentURI: string;
    tags: string[];
    category: string;
    createdAt: number;
}

// IP Asset data structure for frontend
export interface IPAsset {
    tokenId: string;
    metadata: IPAssetMetadata;
    owner: string;
    derivatives?: string[];
    parentToken?: string;
}

// License data structure
export interface LicenseData {
    licenseId: string;
    ipTokenId: string;
    licensee: string;
    licenseType: number;
    allowCommercialUse: boolean;
    allowModifications: boolean;
    attribution: number;
    royaltyPercentage: number;
    duration: number;
    maxRevenue: number;
    additionalTerms: string;
    isActive: boolean;
    expirationTime: number;
}

// Royalty data structure
export interface RoyaltyData {
    recipient: string;
    percentage: number;
    maxAmount: string;
    paidAmount: string;
}

// Project details (keeping for research project functionality)
export interface ProjectDetails {
    title: string;
    description: string;
    category: string;
    researcher: string;
    currentFunding: string;
    totalFunding: string;
    isActive: boolean;
    createdAt: number;
    deadline: number;
    metadataURI: string;
    milestones: Milestone[];
    projectId?: string;
}

export interface Milestone {
    description: string;
    targetAmount: string;
    currentAmount: string;
    isCompleted: boolean;
    verificationCID: string;
}

/**
 * Base contract class for handling common contract operations
 */
export class BaseContract {
    public readonly contract: ethers.Contract;
    private provider: ethers.providers.Web3Provider;
    private signer: ethers.Signer;
    private fallbackProviders: ethers.providers.JsonRpcProvider[];
    private activeBatches: number = 0;

    constructor(
        provider: ethers.providers.Web3Provider,
        address: string,
        abi: any,
        signer?: ethers.Signer,
        fallbackProviders?: ethers.providers.JsonRpcProvider[]
    ) {
        this.provider = provider;
        this.signer = signer || provider.getSigner();
        this.fallbackProviders = fallbackProviders || [];
        this.contract = new ethers.Contract(address, abi, this.signer);
    }

    private async executeWithFallback<T>(operation: () => Promise<T>): Promise<T> {
        try {
            return await operation();
        } catch (error: any) {
            if (this.isNetworkError(error) && this.fallbackProviders.length > 0) {
                for (const fallbackProvider of this.fallbackProviders) {
                    try {
                        const fallbackContract = new ethers.Contract(
                            this.contract.address,
                            this.contract.interface,
                            fallbackProvider
                        );
                        // Note: This will only work for read operations
                        return await operation();
                    } catch (fallbackError) {
                        continue;
                    }
                }
            }
            throw error;
        }
    }

    public async retryOperation<T>(
        operation: () => Promise<T>,
        maxRetries: number = WEB3_CONFIG.ETHERS_CONFIG.rpcConfig.maxRetries
    ): Promise<T> {
        let lastError: Error | null = null;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await this.executeWithFallback(operation);
            } catch (err: any) {
                lastError = err;
                if (attempt === maxRetries) break;

                if (!this.isNetworkError(err)) {
                    throw err;
                }

                await new Promise(resolve =>
                    setTimeout(resolve,
                        WEB3_CONFIG.ETHERS_CONFIG.rpcConfig.customBackoff(attempt)
                    )
                );
            }
        }

        throw lastError;
    }

    private isNetworkError(error: any): boolean {
        return (
            error.code === -32603 || // Internal JSON-RPC error
            error.code === 'NETWORK_ERROR' ||
            error.message?.includes('network') ||
            error.message?.includes('timeout') ||
            error.message?.toLowerCase().includes('rate limit') ||
            error.message?.toLowerCase().includes('disconnected')
        );
    }


}

/**
 * Main contract interface for the modular Nebula Platform
 */
export class ContractInterface {
    public readonly provider: ethers.providers.Web3Provider;
    private signer: ethers.Signer | undefined;
    private contracts: Map<string, BaseContract> = new Map();
    private fallbackProviders: ethers.providers.JsonRpcProvider[] = [];

    constructor(provider: ethers.providers.Web3Provider) {
        this.provider = provider;
        this.initializeFallbackProviders();
        this.initializeSigner();
    }

    private async initializeSigner() {
        try {
            this.signer = this.provider.getSigner();
        } catch (error) {
            console.warn('Failed to get signer:', error);
        }
    }

    getProvider(): ethers.providers.Web3Provider {
        return this.provider;
    }

    getSigner(): ethers.Signer {
        if (!this.signer) {
            throw new Error('No signer available. Please connect your wallet.');
        }
        return this.signer;
    }

    private initializeFallbackProviders() {
        const fallbackRpcs: string[] = [];
        this.fallbackProviders = fallbackRpcs.map((url: string) => 
            new ethers.providers.JsonRpcProvider(url)
        );
    }

    private getContractAddress(contractName: keyof typeof WEB3_CONFIG.CONTRACTS): string {
        return WEB3_CONFIG.CONTRACTS[contractName].address;
    }

    private async getContract(
        name: keyof typeof WEB3_CONFIG.CONTRACTS,
        abi: any
    ): Promise<BaseContract> {
        if (!this.contracts.has(name)) {
            const address = this.getContractAddress(name);
            const contract = new BaseContract(
                this.provider,
                address,
                abi,
                this.signer,
                this.fallbackProviders
            );
            this.contracts.set(name, contract);
        }
        return this.contracts.get(name)!;
    }

    // ===========================================
    // UTILITY METHODS
    // ===========================================

    /**
     * Helper method to query events with automatic chunking to avoid RPC limits
     */
    private async queryEventsInChunks(contract: ethers.Contract, filter: any, fromBlock: number, toBlock: number | string = 'latest'): Promise<any[]> {
        const maxRange = WEB3_CONFIG.ETHERS_CONFIG.maxBlockRange;
        const latestBlock = typeof toBlock === 'string' ? await this.provider.getBlockNumber() : toBlock;
        const actualFromBlock = Math.max(0, fromBlock);
        const actualToBlock = Math.min(latestBlock, typeof toBlock === 'number' ? toBlock : latestBlock);
        
        // If range is within limits, query directly
        if (actualToBlock - actualFromBlock <= maxRange) {
            try {
                return await contract.queryFilter(filter, actualFromBlock, actualToBlock);
            } catch (error: any) {
                if (error.data?.message?.includes('too many blocks') || error.message?.includes('too many blocks')) {
                    // Fall back to chunking even for small ranges
                    return await this.queryEventsInChunksRecursive(contract, filter, actualFromBlock, actualToBlock, maxRange / 2);
                }
                throw error;
            }
        }
        
        // Query in chunks
        return await this.queryEventsInChunksRecursive(contract, filter, actualFromBlock, actualToBlock, maxRange);
    }

    private async queryEventsInChunksRecursive(contract: ethers.Contract, filter: any, fromBlock: number, toBlock: number, chunkSize: number): Promise<any[]> {
        const allEvents: any[] = [];
        let currentFrom = fromBlock;
        
        while (currentFrom <= toBlock) {
            const currentTo = Math.min(currentFrom + chunkSize - 1, toBlock);
            
            try {
                const events = await contract.queryFilter(filter, currentFrom, currentTo);
                allEvents.push(...events);
            } catch (error: any) {
                console.warn(`Failed to query events from block ${currentFrom} to ${currentTo}:`, error);
                // If chunk is still too large, try smaller chunks
                if (chunkSize > 100 && (error.data?.message?.includes('too many blocks') || error.message?.includes('too many blocks'))) {
                    const subEvents = await this.queryEventsInChunksRecursive(contract, filter, currentFrom, currentTo, Math.floor(chunkSize / 2));
                    allEvents.push(...subEvents);
                } else {
                    // Skip this chunk if it's already small enough but still failing
                    console.error(`Skipping block range ${currentFrom}-${currentTo} due to persistent error:`, error);
                }
            }
            
            currentFrom = currentTo + 1;
        }
        
        return allEvents;
    }

    // ===========================================
    // MODULAR CONTRACT GETTERS
    // ===========================================

    async getRegistry() {
        if (!this.contracts.has('Registry')) {
            const address = WEB3_CONFIG.CONTRACTS.Registry.address;
            const contract = new BaseContract(
                this.provider,
                address,
                RegistryABI.abi,
                this.signer,
                this.fallbackProviders
            );
            this.contracts.set('Registry', contract);
        }
        return this.contracts.get('Registry')!.contract;
    }

    async getIPAsset() {
        if (!this.contracts.has('IPAsset')) {
            const address = WEB3_CONFIG.CONTRACTS.IPAsset.address;
            const contract = new BaseContract(
                this.provider,
                address,
                IPAssetABI.abi,
                this.signer,
                this.fallbackProviders
            );
            this.contracts.set('IPAsset', contract);
        }
        return this.contracts.get('IPAsset')!.contract;
    }

    async getLicenseModule() {
        if (!this.contracts.has('LicenseModule')) {
            const address = WEB3_CONFIG.CONTRACTS.LicenseModule.address;
            const contract = new BaseContract(
                this.provider,
                address,
                LicenseModuleABI.abi,
                this.signer,
                this.fallbackProviders
            );
            this.contracts.set('LicenseModule', contract);
        }
        return this.contracts.get('LicenseModule')!.contract;
    }

    async getRoyaltyModule() {
        if (!this.contracts.has('RoyaltyModule')) {
            const address = WEB3_CONFIG.CONTRACTS.RoyaltyModule.address;
            const contract = new BaseContract(
                this.provider,
                address,
                RoyaltyModuleABI.abi,
                this.signer,
                this.fallbackProviders
            );
            this.contracts.set('RoyaltyModule', contract);
        }
        return this.contracts.get('RoyaltyModule')!.contract;
    }

    // ===========================================
    // IP ASSET METHODS (NEW MODULAR IMPLEMENTATION)
    // ===========================================

    /**
     * Create a new IP asset using the modular IPAsset contract
     */
    async createIP(title: string, description: string, uri: string, licenseTerms: string) {
        try {
            const ipAsset = await this.getIPAsset();
            
            const metadata: IPAssetMetadata = {
                title,
                description,
                contentURI: uri,
                tags: [],
                category: 'General',
                createdAt: Math.floor(Date.now() / 1000)
            };

            const tx = await ipAsset.createIP(metadata);
            const receipt = await tx.wait();
            
            // Find the token ID from the Transfer event (minting event)
            const transferEvent = receipt.events?.find(
                (event: any) => event.event === 'Transfer' && event.args.from === ethers.constants.AddressZero
            );
            
            const tokenId = transferEvent?.args?.tokenId?.toString();
            
            return {
                tokenId,
                receipt
            };
        } catch (error: any) {
            console.error('Error creating IP asset:', error);
            throw new Error(`Failed to create IP asset: ${error.message}`);
        }
    }

    /**
     * Get owned IP assets for an address
     */
    async getOwnedIPAssets(address: string): Promise<IPAsset[]> {
        try {
            const ipAsset = await this.getIPAsset();
            const assets: IPAsset[] = [];

            // Get balance of the address
            const balance = await ipAsset.balanceOf(address);
            console.log(`IP Asset balance for ${address}:`, balance.toString());
            
            // Since IPAsset doesn't inherit from ERC721Enumerable, we need to query events
            const currentBlock = await this.provider.getBlockNumber();
            const fromBlock = Math.max(0, currentBlock - WEB3_CONFIG.ETHERS_CONFIG.maxBlockRange);
            
            console.log(`Querying IP asset events from block ${fromBlock} to ${currentBlock}`);
            
            try {
                // Query Transfer events to this address
                const filter = ipAsset.filters.Transfer(null, address);
                const events = await this.queryEventsInChunks(ipAsset, filter, fromBlock, 'latest');
                
                console.log(`Found ${events.length} transfer events to address ${address}`);
                
                // Get unique token IDs that are still owned by the address
                const tokenIds = new Set<string>();
                
                for (const event of events) {
                    const tokenId = event.args?.tokenId?.toString();
                    if (tokenId) {
                        // Check if the address still owns this token
                        try {
                            const currentOwner = await ipAsset.ownerOf(tokenId);
                            console.log(`Token ${tokenId} current owner: ${currentOwner}, target address: ${address}`);
                            if (currentOwner.toLowerCase() === address.toLowerCase()) {
                                tokenIds.add(tokenId);
                                console.log(`Added token ${tokenId} to owned tokens`);
                            }
                        } catch (error) {
                            // Token might not exist or have been burned
                            console.warn(`Token ${tokenId} ownership check failed:`, error);
                            continue;
                        }
                    }
                }

                // Fallback: If no events found and balance > 0, try checking recent token IDs manually
                if (tokenIds.size === 0 && balance.gt(0)) {
                    console.log('No events found but balance > 0, trying manual token ID checks...');
                    
                    // Try checking token IDs 1-100 (recently created tokens)
                    for (let i = 1; i <= 100; i++) {
                        try {
                            const owner = await ipAsset.ownerOf(i);
                            if (owner.toLowerCase() === address.toLowerCase()) {
                                tokenIds.add(i.toString());
                                console.log(`Manually found owned token: ${i}`);
                            }
                        } catch (error) {
                            // Token doesn't exist, continue
                        }
                    }
                }

                // Get metadata for each owned token
                for (const tokenId of Array.from(tokenIds)) {
                    try {
                        const metadata = await ipAsset.getIPMetadata(tokenId);
                        const derivatives = await ipAsset.getDerivatives(tokenId);
                        const parentToken = await ipAsset.getParentToken(tokenId);
                        
                        assets.push({
                            tokenId,
                            metadata: {
                                title: metadata.title,
                                description: metadata.description,
                                contentURI: metadata.contentURI,
                                tags: metadata.tags,
                                category: metadata.category,
                                createdAt: metadata.createdAt.toNumber()
                            },
                            owner: address,
                            derivatives: derivatives.map((d: any) => d.toString()),
                            parentToken: parentToken.toString() === '0' ? undefined : parentToken.toString()
                        });
                    } catch (error) {
                        console.error(`Error loading metadata for token ${tokenId}:`, error);
                    }
                }
            } catch (error) {
                console.error('Error querying IP asset events:', error);
                
                // If event querying fails, try manual check for small range
                if (balance.gt(0)) {
                    console.log('Event querying failed, trying manual ownership checks...');
                    
                    for (let i = 1; i <= 50; i++) {
                        try {
                            const owner = await ipAsset.ownerOf(i);
                            if (owner.toLowerCase() === address.toLowerCase()) {
                                try {
                                    const metadata = await ipAsset.getIPMetadata(i.toString());
                                    assets.push({
                                        tokenId: i.toString(),
                                        metadata: {
                                            title: metadata.title,
                                            description: metadata.description,
                                            contentURI: metadata.contentURI,
                                            tags: metadata.tags,
                                            category: metadata.category,
                                            createdAt: metadata.createdAt.toNumber()
                                        },
                                        owner: address,
                                        derivatives: [],
                                        parentToken: undefined
                                    });
                                } catch (metadataError) {
                                    console.error(`Error loading metadata for token ${i}:`, metadataError);
                                }
                            }
                        } catch (error) {
                            // Token doesn't exist, continue
                        }
                    }
                }
            }

            console.log(`Returning ${assets.length} owned IP assets for ${address}`);
            return assets;
        } catch (error) {
            console.error('Error in getOwnedIPAssets:', error);
            return [];
        }
    }

    /**
     * Get licensed IP assets for an address
     */
    async getLicensedIPAssets(address: string): Promise<IPAsset[]> {
        try {
            const licenseModule = await this.getLicenseModule();
            const ipAsset = await this.getIPAsset();
            const assets: IPAsset[] = [];

            // Get licenses owned by the address
            const balance = await licenseModule.balanceOf(address);
            
            // Query license creation events
            const currentBlock = await this.provider.getBlockNumber();
            const fromBlock = Math.max(0, currentBlock - WEB3_CONFIG.ETHERS_CONFIG.maxBlockRange);
            
            try {
                // Query Transfer events for licenses to this address
                const filter = licenseModule.filters.Transfer(null, address);
                const events = await this.queryEventsInChunks(licenseModule, filter, fromBlock, 'latest');
                
                for (const event of events) {
                    const licenseId = event.args?.tokenId?.toString();
                    if (licenseId) {
                        try {
                            // Check if the address still owns this license
                            const currentOwner = await licenseModule.ownerOf(licenseId);
                            if (currentOwner.toLowerCase() === address.toLowerCase()) {
                                // Get the license details
                                const license = await licenseModule.getLicense(licenseId);
                                const ipTokenId = license.ipTokenId.toString();
                                
                                // Get the IP asset metadata
                                const metadata = await ipAsset.getIPMetadata(ipTokenId);
                                const ipOwner = await ipAsset.ownerOf(ipTokenId);
                                
                                assets.push({
                                    tokenId: ipTokenId,
                                    metadata: {
                                        title: metadata.title,
                                        description: metadata.description,
                                        contentURI: metadata.contentURI,
                                        tags: metadata.tags,
                                        category: metadata.category,
                                        createdAt: metadata.createdAt.toNumber()
                                    },
                                    owner: ipOwner
                                });
                            }
                        } catch (error) {
                            console.error(`Error loading license ${licenseId}:`, error);
                        }
                    }
                }
            } catch (error) {
                console.error('Error querying license events:', error);
            }

            return assets;
        } catch (error) {
            console.error('Error in getLicensedIPAssets:', error);
            return [];
        }
    }

    /**
     * Create a derivative IP asset
     */
    async createDerivativeIP(parentTokenId: string, title: string, description: string, uri: string) {
        try {
            const ipAsset = await this.getIPAsset();
            
            const metadata: IPAssetMetadata = {
                title,
                description,
                contentURI: uri,
                tags: [],
                category: 'Derivative',
                createdAt: Math.floor(Date.now() / 1000)
            };

            const tx = await ipAsset.createDerivativeIP(parentTokenId, metadata);
            const receipt = await tx.wait();
            
            // Find the token ID from the Transfer event
            const transferEvent = receipt.events?.find(
                (event: any) => event.event === 'Transfer' && event.args.from === ethers.constants.AddressZero
            );
            
            const tokenId = transferEvent?.args?.tokenId?.toString();
            
            return {
                tokenId,
                receipt
            };
        } catch (error: any) {
            console.error('Error creating derivative IP:', error);
            throw new Error(`Failed to create derivative IP: ${error.message}`);
        }
    }

    // ===========================================
    // LICENSE METHODS
    // ===========================================

    /**
     * Create a license template
     */
    async createLicenseTemplate(terms: any) {
        try {
            const licenseModule = await this.getLicenseModule();
            const tx = await licenseModule.createLicenseTemplate(terms);
            const receipt = await tx.wait();
            return receipt;
        } catch (error: any) {
            console.error('Error creating license template:', error);
            throw new Error(`Failed to create license template: ${error.message}`);
        }
    }

    /**
     * Issue a license for an IP asset
     */
    async issueLicense(ipTokenId: string, licensee: string, templateId: string) {
        try {
            const licenseModule = await this.getLicenseModule();
            const tx = await licenseModule.issueLicense(ipTokenId, licensee, templateId);
            const receipt = await tx.wait();
            return receipt;
        } catch (error: any) {
            console.error('Error issuing license:', error);
            throw new Error(`Failed to issue license: ${error.message}`);
        }
    }

    // ===========================================
    // ROYALTY METHODS
    // ===========================================

    /**
     * Set royalty information for an IP asset
     */
    async setRoyaltyInfo(ipTokenId: string, recipient: string, royaltyPercentage: number) {
        try {
            const royaltyModule = await this.getRoyaltyModule();
            
            const royaltyInfo = {
                recipient,
                percentage: royaltyPercentage * 100, // Convert to basis points
                maxAmount: 0, // Unlimited
                paidAmount: 0
            };
            
            const tx = await royaltyModule.setRoyaltyInfo(ipTokenId, royaltyInfo);
            const receipt = await tx.wait();
            return receipt;
        } catch (error: any) {
            console.error('Error setting royalty info:', error);
            throw new Error(`Failed to set royalty info: ${error.message}`);
        }
    }

    /**
     * Pay royalties for an IP asset
     */
    async payRoyalty(ipTokenId: string, amount: string) {
        try {
            const royaltyModule = await this.getRoyaltyModule();
            const amountWei = ethers.utils.parseEther(amount);
            const tx = await royaltyModule.payRoyalty(ipTokenId, { value: amountWei });
            const receipt = await tx.wait();
            return receipt;
        } catch (error: any) {
            console.error('Error paying royalty:', error);
            throw new Error(`Failed to pay royalty: ${error.message}`);
        }
    }

    // ===========================================
    // LEGACY CONTRACT METHODS (FOR EXISTING FUNCTIONALITY)
    // ===========================================

    // Keep some legacy methods for existing marketplace functionality
    async getIPMarketplace() {
        return (await this.getContract('IPMarketplace', IPMarketplaceABI.abi)).contract;
    }

    async getNEBLToken() {
        return (await this.getContract('NEBLToken', NEBLTokenABI.abi)).contract;
    }

    async getResearchProject() {
        return (await this.getContract('ResearchProject', ResearchProjectABI.abi)).contract;
    }

    // Research project methods (keep for existing functionality)
    async createResearchProject(
        title: string,
        description: string,
        category: string,
        metadataURI: string,
        milestoneDescriptions: string[],
        milestoneTargets: string[],
        verificationCriteria: string[],
        deadline: number
    ) {
        const researchProject = await this.getResearchProject();
        const signer = this.getSigner();
        
        // Convert milestone targets to wei
        const targetAmounts = milestoneTargets.map(target => 
            ethers.utils.parseEther(target)
        );

        const tx = await researchProject.connect(signer).createProject(
            title,
            description,
            category,
            metadataURI,
            milestoneDescriptions,
            targetAmounts,
            verificationCriteria,
            deadline
        );
        
        const receipt = await tx.wait();
        
        // Extract project ID from events
        const event = receipt.events?.find((e: any) => e.event === 'ProjectCreated');
        return event?.args?.projectId?.toString();
    }

    async getProjectDetails(projectId: string): Promise<ProjectDetails> {
        const researchProject = await this.getResearchProject();
        const project = await researchProject.getProject(projectId);
        
        return {
            projectId,
            title: project.title,
            description: project.description,
            category: project.category,
            researcher: project.researcher,
            currentFunding: ethers.utils.formatEther(project.currentFunding),
            totalFunding: ethers.utils.formatEther(project.totalFunding),
            isActive: project.isActive,
            createdAt: project.createdAt.toNumber(),
            deadline: project.deadline.toNumber(),
            metadataURI: project.metadataURI,
            milestones: [] // Would need to fetch separately
        };
    }

    // Add other legacy methods as needed for existing functionality
    // but focus on using the new modular contracts for IP asset management

    // ===========================================
    // UTILITY METHODS
    // ===========================================

    /**
     * Get the current network
     */
    async getNetwork() {
        return await this.provider.getNetwork();
    }

    /**
     * Get account balance
     */
    async getBalance(address: string) {
        return await this.provider.getBalance(address);
    }

    /**
     * Format ether amount
     */
    formatEther(amount: ethers.BigNumberish) {
        return ethers.utils.formatEther(amount);
    }

    /**
     * Parse ether amount
     */
    parseEther(amount: string) {
        return ethers.utils.parseEther(amount);
    }

    // ===========================================
    // MISSING LEGACY METHODS FOR BACKWARD COMPATIBILITY
    // ===========================================

    /**
     * Get owned tokens (redirects to getOwnedIPAssets for new modular architecture)
     */
    async getOwnedTokens(address: string): Promise<IPTokenData[]> {
        const ipAssets = await this.getOwnedIPAssets(address);
        // Convert IPAsset format to legacy IPTokenData format
        return ipAssets.map(asset => ({
            tokenId: asset.tokenId,
            title: asset.metadata.title,
            description: asset.metadata.description,
            creator: asset.owner,
            owner: asset.owner,
            price: '0', // Not applicable for owned assets
            isListed: false,
            listingId: null,
            images: asset.metadata.contentURI ? [asset.metadata.contentURI] : [],
            documents: [],
            category: asset.metadata.category,
            tags: asset.metadata.tags.join(','),
            version: '1.0',
            licenseTerms: '',
            createdAt: asset.metadata.createdAt,
            ipfsHash: asset.metadata.contentURI
        }));
    }

    /**
     * Get IP Token contract (for legacy compatibility)
     */
    async getIPToken() {
        // Return the new IPAsset contract for backward compatibility
        return await this.getIPAsset();
    }

    /**
     * Get IP Marketplace address
     */
    getIPMarketplaceAddress(): string {
        return WEB3_CONFIG.CONTRACTS.IPMarketplace.address;
    }

    /**
     * Check what IP token contract the marketplace is using
     */
    async getMarketplaceIPTokenAddress(): Promise<string> {
        try {
            const marketplace = await this.getIPMarketplace();
            const ipTokenAddress = await marketplace.ipToken();
            return ipTokenAddress;
        } catch (error: any) {
            console.error('Error getting marketplace IP token address:', error);
            throw new Error(`Failed to get marketplace IP token address: ${error.message}`);
        }
    }

    /**
     * Debug marketplace configuration
     */
    async debugMarketplaceConfiguration() {
        try {
            const marketplaceIPToken = await this.getMarketplaceIPTokenAddress();
            const currentIPAsset = this.getContractAddress('IPAsset');
            const legacyIPToken = this.getContractAddress('IPToken');
            
            console.log('Marketplace Configuration Debug:', {
                marketplaceAddress: this.getIPMarketplaceAddress(),
                marketplaceConfiguredIPToken: marketplaceIPToken,
                frontendIPAssetAddress: currentIPAsset,
                frontendLegacyIPTokenAddress: legacyIPToken,
                addressesMatch: marketplaceIPToken.toLowerCase() === currentIPAsset.toLowerCase(),
                usesLegacyContract: marketplaceIPToken.toLowerCase() === legacyIPToken.toLowerCase()
            });
            
            return {
                marketplaceIPToken,
                frontendIPAsset: currentIPAsset,
                frontendLegacyIPToken: legacyIPToken,
                isConfigurationMismatch: marketplaceIPToken.toLowerCase() !== currentIPAsset.toLowerCase()
            };
        } catch (error: any) {
            console.error('Error debugging marketplace configuration:', error);
            throw error;
        }
    }

    /**
     * Create listing
     */
    async createListing(tokenId: number, price: string, isLicense: boolean, licenseDuration: number) {
        try {
            const marketplace = await this.getIPMarketplace();
            const priceWei = ethers.utils.parseEther(price);
            
            const tx = await marketplace.createListing(
                tokenId,
                priceWei,
                isLicense,
                licenseDuration
            );
            
            return await tx.wait();
        } catch (error: any) {
            console.error('Error creating listing:', error);
            throw new Error(`Failed to create listing: ${error.message}`);
        }
    }

    /**
     * Get active listings
     */
    async getActiveListings(startId: number, pageSize: number): Promise<any[]> {
        try {
            const marketplace = await this.getIPMarketplace();
            const ipAsset = await this.getIPAsset();
            const listings = [];
            
            // Get the next listing ID to understand the range
            let nextListingId;
            try {
                nextListingId = await marketplace.nextListingId();
                console.log('Next listing ID from marketplace:', nextListingId.toString());
            } catch (error) {
                console.warn('Could not get nextListingId, using fallback method');
                nextListingId = null;
            }
            
            // If we have nextListingId, we can optimize by only checking valid range
            let maxListingId = nextListingId ? nextListingId.toNumber() - 1 : startId + pageSize;
            let actualStartId = Math.max(1, startId + 1); // Marketplace listing IDs start from 1, not 0
            
            console.log(`Checking listings from ID ${actualStartId} to ${Math.min(actualStartId + pageSize - 1, maxListingId)}`);
            
            for (let i = actualStartId; i <= Math.min(actualStartId + pageSize - 1, maxListingId); i++) {
                try {
                    const listing = await marketplace.getListing(i);
                    console.log(`Listing ${i}:`, {
                        tokenId: listing.tokenId.toString(),
                        seller: listing.seller,
                        isActive: listing.isActive,
                        price: ethers.utils.formatEther(listing.price)
                    });
                    
                    if (listing.isActive) {
                        // Validate that the token actually exists before including it
                        try {
                            await ipAsset.ownerOf(listing.tokenId);
                            // Token exists, include the listing
                            listings.push({
                                listingId: i,
                                tokenId: listing.tokenId.toString(),
                                seller: listing.seller,
                                price: listing.price,
                                isActive: listing.isActive,
                                isLicense: listing.isLicense,
                                licenseDuration: listing.licenseDuration
                            });
                        } catch (tokenError) {
                            // Token doesn't exist, skip this listing
                            console.warn(`Skipping listing ${i} for non-existent token ${listing.tokenId}`);
                            continue;
                        }
                    }
                } catch (error) {
                    // Listing might not exist, continue to next
                    console.warn(`Listing ${i} does not exist or error occurred:`, error);
                    continue;
                }
            }
            
            console.log(`Found ${listings.length} active listings`);
            return listings;
        } catch (error: any) {
            console.error('Error getting active listings:', error);
            return [];
        }
    }

    /**
     * Purchase listing
     */
    async purchaseListing(listingId: number, price: string) {
        try {
            const marketplace = await this.getIPMarketplace();
            const priceWei = ethers.utils.parseEther(price);
            
            const tx = await marketplace.purchaseListing(listingId, {
                value: priceWei
            });
            
            return await tx.wait();
        } catch (error: any) {
            console.error('Error purchasing listing:', error);
            throw new Error(`Failed to purchase listing: ${error.message}`);
        }
    }

    /**
     * Get governance contract
     */
    async getGovernance() {
        return (await this.getContract('Governance', GovernanceABI.abi)).contract;
    }

    /**
     * Create proposal
     */
    async createProposal(
        targets: string[],
        values: number[],
        calldatas: string[],
        description: string
    ) {
        try {
            const governance = await this.getGovernance();
            const tx = await governance.propose(targets, values, calldatas, description);
            return await tx.wait();
        } catch (error: any) {
            console.error('Error creating proposal:', error);
            throw new Error(`Failed to create proposal: ${error.message}`);
        }
    }

    /**
     * Cast vote
     */
    async castVote(proposalId: string, support: boolean) {
        try {
            const governance = await this.getGovernance();
            const tx = await governance.castVote(proposalId, support);
            return await tx.wait();
        } catch (error: any) {
            console.error('Error casting vote:', error);
            throw new Error(`Failed to cast vote: ${error.message}`);
        }
    }

    /**
     * Create IP Asset (for legacy CreateIPModal compatibility)
     */
    async createIPAsset(metadata: any) {
        return await this.createIP(
            metadata.title,
            metadata.description,
            metadata.contentURI || '',
            ''
        );
    }

    /**
     * Create license (legacy method)
     */
    async createLicense(ipTokenId: string, licenseData: any) {
        try {
            // First create a license template
            const templateId = await this.createLicenseTemplate(licenseData);
            
            // Then issue the license
            return await this.issueLicense(ipTokenId, licenseData.licensee, templateId.toString());
        } catch (error: any) {
            console.error('Error creating license:', error);
            throw new Error(`Failed to create license: ${error.message}`);
        }
    }

    /**
     * Get IP Asset metadata
     */
    async getIPAssetMetadata(tokenId: string) {
        try {
            const ipAsset = await this.getIPAsset();
            
            // First check if the token exists by trying to get its owner
            let owner;
            try {
                owner = await ipAsset.ownerOf(tokenId);
            } catch (ownerError: any) {
                // If getting owner fails, the token likely doesn't exist
                if (ownerError.reason === 'ERC721: invalid token ID' || 
                    ownerError.reason === 'ERC721: owner query for nonexistent token' ||
                    ownerError.message?.includes('Token does not exist') ||
                    ownerError.message?.includes('invalid token ID') ||
                    ownerError.message?.includes('nonexistent token')) {
                    return {
                        success: false,
                        error: 'IPAsset: Token does not exist',
                        errorType: 'TOKEN_NOT_EXISTS'
                    };
                }
                throw ownerError; // Re-throw if it's a different error
            }
            
            const metadata = await ipAsset.getIPMetadata(tokenId);
            
            return {
                success: true,
                asset: {
                    tokenId,
                    metadata: {
                        title: metadata.title,
                        description: metadata.description,
                        contentURI: metadata.contentURI,
                        tags: metadata.tags,
                        category: metadata.category,
                        createdAt: metadata.createdAt.toNumber()
                    },
                    owner
                }
            };
        } catch (error: any) {
            console.error('Error getting IP asset metadata:', error);
            
            // Classify the error type for better handling
            let errorType = 'UNKNOWN_ERROR';
            if (error.reason === 'IPAsset: Token does not exist' || 
                error.message?.includes('Token does not exist') ||
                error.message?.includes('invalid token ID') ||
                error.message?.includes('nonexistent token')) {
                errorType = 'TOKEN_NOT_EXISTS';
            } else if (error.code === -32603 || error.message?.includes('Internal JSON-RPC error')) {
                errorType = 'RPC_ERROR';
            }
            
            return {
                success: false,
                error: error.message || error.reason || 'Unknown error occurred',
                errorType
            };
        }
    }

    /**
     * Get royalty info
     */
    async getRoyaltyInfo(ipTokenId: string, salePrice: string) {
        try {
            const royaltyModule = await this.getRoyaltyModule();
            const royaltyInfo = await royaltyModule.getRoyaltyInfo(ipTokenId);
            
            // Calculate royalty amount for the given sale price
            const salePriceWei = ethers.utils.parseEther(salePrice);
            const royaltyAmount = await royaltyModule.calculateRoyalty(ipTokenId, salePriceWei);
            
            return {
                success: true,
                royaltyInfo: {
                    recipient: royaltyInfo.recipient,
                    percentage: royaltyInfo.percentage,
                    royaltyAmount: ethers.utils.formatEther(royaltyAmount)
                }
            };
        } catch (error: any) {
            console.error('Error getting royalty info:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get verification details
     */
    async getVerificationDetails(projectId: number, milestoneId: number) {
        try {
            const oracle = await this.getMilestoneOracle();
            // This is a placeholder - implement based on your oracle contract
            return {
                status: 'PENDING',
                timestamp: new Date(),
                verifier: '',
                attempts: 0,
                proofCID: ''
            };
        } catch (error: any) {
            console.error('Error getting verification details:', error);
            throw new Error(`Failed to get verification details: ${error.message}`);
        }
    }

    /**
     * Get milestone oracle
     */
    async getMilestoneOracle() {
        return (await this.getContract('MilestoneOracle', MilestoneOracleABI.abi)).contract;
    }

    /**
     * Request milestone verification
     */
    async requestMilestoneVerification(request: any) {
        try {
            const oracle = await this.getMilestoneOracle();
            const tx = await oracle.requestVerification(
                request.projectId,
                request.milestoneId,
                request.proofCID
            );
            return await tx.wait();
        } catch (error: any) {
            console.error('Error requesting milestone verification:', error);
            throw new Error(`Failed to request verification: ${error.message}`);
        }
    }

    /**
     * Fund project milestone
     */
    async fundProjectMilestone(projectId: string, milestoneId: string, amount: string) {
        try {
            const fundingEscrow = await this.getFundingEscrow();
            const amountWei = ethers.utils.parseEther(amount);
            
            const tx = await fundingEscrow.fundMilestone(projectId, milestoneId, {
                value: amountWei
            });
            
            return await tx.wait();
        } catch (error: any) {
            console.error('Error funding milestone:', error);
            throw new Error(`Failed to fund milestone: ${error.message}`);
        }
    }

    /**
     * Get funding escrow
     */
    async getFundingEscrow() {
        return (await this.getContract('FundingEscrow', FundingEscrowABI.abi)).contract;
    }

    /**
     * Get stake info
     */
    async getStakeInfo(address: string) {
        try {
            const neblToken = await this.getNEBLToken();
            // Implement based on your staking mechanism
            return {
                amount: '0',
                timestamp: Math.floor(Date.now() / 1000),
                lockPeriod: 0,
                currentReward: '0'
            };
        } catch (error: any) {
            console.error('Error getting stake info:', error);
            return {
                amount: '0',
                timestamp: Math.floor(Date.now() / 1000),
                lockPeriod: 0,
                currentReward: '0'
            };
        }
    }

    /**
     * Get NEBL balance
     */
    async getNeblBalance(address: string): Promise<ethers.BigNumber> {
        try {
            const neblToken = await this.getNEBLToken();
            return await neblToken.balanceOf(address);
        } catch (error: any) {
            console.error('Error getting NEBL balance:', error);
            return ethers.BigNumber.from(0);
        }
    }

    /**
     * Stake NEBL
     */
    async stakeNEBL(amount: string, lockPeriod: number) {
        try {
            const neblToken = await this.getNEBLToken();
            const amountWei = ethers.utils.parseEther(amount);
            
            const tx = await neblToken.stake(amountWei, lockPeriod);
            return await tx.wait();
        } catch (error: any) {
            console.error('Error staking NEBL:', error);
            throw new Error(`Failed to stake NEBL: ${error.message}`);
        }
    }

    /**
     * Unstake NEBL
     */
    async unstakeNEBL() {
        try {
            const neblToken = await this.getNEBLToken();
            const tx = await neblToken.unstake();
            return await tx.wait();
        } catch (error: any) {
            console.error('Error unstaking NEBL:', error);
            throw new Error(`Failed to unstake NEBL: ${error.message}`);
        }
    }

    /**
     * Calculate expected NEBL
     */
    async calculateExpectedNEBL(avaxAmount: string): Promise<ethers.BigNumber> {
        try {
            const neblSwap = await this.getNeblSwap();
            const avaxAmountWei = ethers.utils.parseEther(avaxAmount);
            return await neblSwap.calculateNEBLAmount(avaxAmountWei);
        } catch (error: any) {
            console.error('Error calculating expected NEBL:', error);
            return ethers.BigNumber.from(0);
        }
    }

    /**
     * Calculate expected AVAX
     */
    async calculateExpectedAVAX(neblAmount: string): Promise<ethers.BigNumber> {
        try {
            const neblSwap = await this.getNeblSwap();
            const neblAmountWei = ethers.utils.parseEther(neblAmount);
            return await neblSwap.calculateAVAXAmount(neblAmountWei);
        } catch (error: any) {
            console.error('Error calculating expected AVAX:', error);
            return ethers.BigNumber.from(0);
        }
    }

    /**
     * Swap AVAX for NEBL
     */
    async swapAVAXForNEBL(avaxAmount: string) {
        try {
            const neblSwap = await this.getNeblSwap();
            const avaxAmountWei = ethers.utils.parseEther(avaxAmount);
            
            const tx = await neblSwap.swapAVAXForNEBL({
                value: avaxAmountWei
            });
            
            return await tx.wait();
        } catch (error: any) {
            console.error('Error swapping AVAX for NEBL:', error);
            throw new Error(`Failed to swap: ${error.message}`);
        }
    }

    /**
     * Swap NEBL for AVAX
     */
    async swapNEBLForAVAX(neblAmount: string) {
        try {
            const neblSwap = await this.getNeblSwap();
            const neblAmountWei = ethers.utils.parseEther(neblAmount);
            
            const tx = await neblSwap.swapNEBLForAVAX(neblAmountWei);
            return await tx.wait();
        } catch (error: any) {
            console.error('Error swapping NEBL for AVAX:', error);
            throw new Error(`Failed to swap: ${error.message}`);
        }
    }

    /**
     * Get NEBL Swap contract
     */
    async getNeblSwap() {
        return (await this.getContract('NEBLSwap', NEBLSwapABI.abi)).contract;
    }

    /**
     * Get disputes contract
     */
    async getDisputes() {
        return (await this.getContract('Disputes', DisputesABI.abi)).contract;
    }

    /**
     * Get dispute details
     */
    async getDisputeDetails(disputeId: string) {
        try {
            const disputes = await this.getDisputes();
            const dispute = await disputes.getDispute(disputeId);
            
            return {
                id: disputeId,
                disputeType: dispute.disputeType,
                complainant: dispute.complainant,
                respondent: dispute.respondent,
                relatedId: dispute.relatedId.toString(),
                description: dispute.description,
                status: dispute.status,
                createdAt: dispute.createdAt.toNumber(),
                resolvedAt: dispute.resolvedAt.toNumber(),
                resolution: dispute.resolution,
                proposalId: dispute.proposalId.toString()
            };
        } catch (error: any) {
            console.error('Error getting dispute details:', error);
            throw new Error(`Failed to get dispute details: ${error.message}`);
        }
    }

    /**
     * Create dispute
     */
    async createDispute(
        disputeType: number,
        respondent: string,
        relatedId: string,
        description: string
    ) {
        try {
            const disputes = await this.getDisputes();
            const tx = await disputes.createDispute(
                disputeType,
                respondent,
                relatedId,
                description,
                { value: ethers.utils.parseEther('0.1') }
            );
            
            const receipt = await tx.wait();
            const event = receipt.events?.find((e: any) => e.event === 'DisputeCreated');
            return event?.args?.disputeId.toString();
        } catch (error: any) {
            console.error('Error creating dispute:', error);
            throw new Error(`Failed to create dispute: ${error.message}`);
        }
    }

    /**
     * Submit evidence
     */
    async submitEvidence(disputeId: string, description: string, ipfsHash: string) {
        try {
            const disputes = await this.getDisputes();
            const tx = await disputes.submitEvidence(disputeId, description, ipfsHash);
            return await tx.wait();
        } catch (error: any) {
            console.error('Error submitting evidence:', error);
            throw new Error(`Failed to submit evidence: ${error.message}`);
        }
    }
}