import { ethers } from 'ethers';
import { WEB3_CONFIG } from '../config';
import IPMarketplaceABI from '../contracts/IPMarketplace.json';
import IPTokenABI from '../contracts/IPToken.json';
import NEBLTokenABI from '../contracts/NEBLToken.json';
import ResearchProjectABI from '../contracts/ResearchProject.json';
import GovernanceABI from '../contracts/Governance.json';
import DisputesABI from '../contracts/Disputes.json';
import MilestoneOracleABI from '../contracts/MilestoneOracle.json';
import FundingEscrowABI from '../contracts/FundingEscrow.json';
import NEBLSwapABI from '../contracts/NEBLSwap.json';
import { IPTokenData } from '../../types/ipTokens';
import { ipfsService } from './ipfs';

interface IPCreatedEventArgs {
    tokenId: ethers.BigNumber;
    creator: string;
    title: string;
}

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

interface DisputeDetails {
    id: string;
    disputeType: number;
    complainant: string;
    respondent: string;
    relatedId: string;
    description: string;
    status: number;
    createdAt: number;
    resolvedAt: number;
    resolution: string;
    proposalId: string;
}

interface VerificationReport {
    status: 'PENDING' | 'VERIFIED' | 'FAILED' | 'DISPUTED';
    verificationMethod: string;
    timestamp: number;
    proofHash: string;
    verifierSignature: string;
    confidenceScore: number;
    metricResults: {
        accuracy?: number;
        completeness?: number;
        timeliness?: number;
        methodology?: string;
    };
    auditTrail: {
        checkpoints: string[];
        timestamps: number[];
        verifierNodes: string[];
    };
}

interface VerificationRequest {
    projectId: string;
    milestoneId: string;
    proofCID: string;
    verificationCID: string;
    verificationMethods: string[];
    requiredConfidence: number;
    deadline: number;
    customParams?: Record<string, any>;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface ContractMilestone {
    description: string;
    targetAmount: ethers.BigNumber;
    currentAmount: ethers.BigNumber;
    isCompleted: boolean;
    fundsReleased: boolean;
    verificationCriteria: string;
}

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
        } catch (err: any) {
            if ((err.code === 'NETWORK_ERROR' || err.code === -32603 || err.message?.includes('network')) && this.fallbackProviders.length > 0) {
                // Try each fallback provider
                for (const provider of this.fallbackProviders) {
                    try {
                        const contract = this.contract.connect(provider);
                        return await operation.call(contract);
                    } catch (fallbackErr) {
                        continue;
                    }
                }
            }
            throw err;
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
                
                if (err.code !== -32603 && !err.message?.includes('network')) {
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

    public async processBatch<T, R>(
        items: T[],
        processor: (item: T) => Promise<R>,
        batchSize: number = WEB3_CONFIG.ETHERS_CONFIG.rpcConfig.batchSize
    ): Promise<NonNullable<Awaited<R>>[]> {
        const results: NonNullable<Awaited<R>>[] = [];
        let activeBatches = 0;
        
        while (activeBatches >= WEB3_CONFIG.ETHERS_CONFIG.rpcConfig.maxConcurrentBatches) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        activeBatches++;
        
        try {
            for (let i = 0; i < items.length; i += batchSize) {
                // Add exponential backoff between batches
                if (i > 0) {
                    await new Promise(resolve => 
                        setTimeout(resolve, Math.min(1000 * Math.pow(2, i / batchSize), 10000))
                    );
                }

                const batch = items.slice(i, i + batchSize);
                const batchPromises = batch.map(async (item) => {
                    try {
                        const result = await processor(item);
                        return { status: 'fulfilled' as const, value: result };
                    } catch (error) {
                        return { status: 'rejected' as const, reason: error };
                    }
                });

                const batchResults = await Promise.all(batchPromises);
                
                const validResults = batchResults
                    .filter((result): result is { status: 'fulfilled', value: NonNullable<Awaited<R>> } => 
                        result.status === 'fulfilled' && result.value != null
                    )
                    .map(result => result.value);
                
                results.push(...validResults);
            }
            
            return results;
        } finally {
            activeBatches--;
        }
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

    public async executeWithGas<T extends ethers.ContractReceipt>(
        operation: () => Promise<ethers.ContractTransaction>,
        gasLimitMultiplier: number = WEB3_CONFIG.GAS_LIMIT_MULTIPLIER
    ): Promise<T> {
        const tx = await operation();
        
        const waitForReceipt = async (retriesLeft: number): Promise<T> => {
            try {
                const receipt = await Promise.race([
                    tx.wait(1) as Promise<T>,
                    new Promise<T>((_, reject) => 
                        setTimeout(
                            () => reject(new Error('Transaction confirmation timeout')),
                            WEB3_CONFIG.ETHERS_CONFIG.timeout
                        )
                    )
                ]);
                return receipt;
            } catch (err) {
                console.warn('Waiting for transaction confirmation...', err);
                if (retriesLeft === 0) throw err;
                
                await new Promise(resolve => 
                    setTimeout(
                        resolve, 
                        WEB3_CONFIG.ETHERS_CONFIG.rpcConfig.customBackoff(
                            WEB3_CONFIG.ETHERS_CONFIG.rpcConfig.maxRetries - retriesLeft
                        )
                    )
                );
                return waitForReceipt(retriesLeft - 1);
            }
        };
        
        return waitForReceipt(WEB3_CONFIG.ETHERS_CONFIG.rpcConfig.maxRetries);
    }
}

// Add retry operation helper
const retryOperation = async <T,>(
    operation: () => Promise<T>, 
    maxRetries: number = 3
): Promise<T> => {
    let lastError;
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
        }
    }
    throw lastError;
};

// Add interface for listing type
interface Listing {
    listingId: ethers.BigNumber;
    tokenId: ethers.BigNumber;
    seller: string;
    price: ethers.BigNumber;
    isActive: boolean;
    isLicense: boolean;
    licenseDuration: ethers.BigNumber;
}

// Update ContractInterface to extend BaseContract
// Add block range constants
const MAX_BLOCK_RANGE = 2000; // Slightly under RPC limit of 2048 for safety

export class ContractInterface {
    public readonly provider: ethers.providers.Web3Provider;
    private signer: ethers.Signer;
    private contracts: Map<string, BaseContract> = new Map();
    private fallbackProviders: ethers.providers.JsonRpcProvider[] = [];
    
    constructor(provider: ethers.providers.Web3Provider) {
        // Initialize main provider with permissive configuration
        this.provider = new ethers.providers.Web3Provider(
            provider.provider as ethers.providers.ExternalProvider,
            {
                name: WEB3_CONFIG.NETWORKS.TESTNET.name,
                chainId: WEB3_CONFIG.NETWORKS.TESTNET.chainId,
                ensAddress: undefined
            }
        );
        
        // Initialize fallback RPC providers
        this.initializeFallbackProviders();
        
        this.signer = this.provider.getSigner();
    }

    private initializeFallbackProviders() {
        // Initialize backup RPC providers
        const rpcUrls = Array.isArray(WEB3_CONFIG.NETWORKS.TESTNET.rpcUrl) 
            ? WEB3_CONFIG.NETWORKS.TESTNET.rpcUrl 
            : [WEB3_CONFIG.NETWORKS.TESTNET.rpcUrl];

        this.fallbackProviders = rpcUrls.map(url => 
            new ethers.providers.JsonRpcProvider(url, {
                name: WEB3_CONFIG.NETWORKS.TESTNET.name,
                chainId: WEB3_CONFIG.NETWORKS.TESTNET.chainId,
                ensAddress: undefined
            })
        );
    }

    private async getFallbackProvider(): Promise<ethers.providers.Provider> {
        // Try each fallback provider until we find one that works
        for (const provider of this.fallbackProviders) {
            try {
                await provider.getNetwork();
                return provider;
            } catch (err) {
                console.warn('Fallback provider failed:', err);
                continue;
            }
        }
        throw new Error('All RPC providers failed');
    }

    private async executeWithFallback<T>(
        operation: (provider: ethers.providers.Provider) => Promise<T>
    ): Promise<T> {
        try {
            // Try main provider first
            return await operation(this.provider);
        } catch (err: any) {
            if (err.code === 'NETWORK_ERROR' || err.code === -32603 || err.message?.includes('network')) {
                console.warn('Main provider failed, trying fallbacks');
                const fallbackProvider = await this.getFallbackProvider();
                return await operation(fallbackProvider);
            }
            throw err;
        }
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
            
            // Create contract with fallback support
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

    // Update existing contract getter methods to use the new BaseContract pattern
    async getIPMarketplace() {
        return (await this.getContract('IPMarketplace', IPMarketplaceABI.abi)).contract;
    }

    async getIPToken() {
        return (await this.getContract('IPToken', IPTokenABI.abi)).contract;
    }

    async getNEBLToken() {
        if (!this.signer) throw new Error("No signer available");
        
        try {
            const address = this.getContractAddress('NEBLToken');
            const contract = new ethers.Contract(
                address,
                NEBLTokenABI.abi,
                this.signer
            );

            // Basic contract existence check
            const code = await this.provider.getCode(address);
            if (code === '0x') {
                throw new Error('NEBL token contract not deployed at specified address');
            }

            // Verify correct network
            const network = await this.provider.getNetwork();
            if (network.chainId !== WEB3_CONFIG.NETWORKS.TESTNET.chainId) {
                throw new Error(`Please switch to ${WEB3_CONFIG.NETWORKS.TESTNET.name}`);
            }

            // Test contract responsiveness with a simple view call
            await contract.balanceOf(address);
            
            return contract;
        } catch (error: any) {
            console.error('Error initializing NEBL token:', error);
            if (error.code === 'CALL_EXCEPTION') {
                throw new Error('Failed to interact with NEBL token contract. Please verify contract deployment.');
            }
            throw error;
        }
    }

    async getResearchProject() {
        return (await this.getContract('ResearchProject', ResearchProjectABI.abi)).contract;
    }

    async getGovernance() {
        return (await this.getContract('Governance', GovernanceABI.abi)).contract;
    }

    async getDisputes() {
        return (await this.getContract('Disputes', DisputesABI.abi)).contract;
    }

    async getMilestoneOracle() {
        return (await this.getContract('MilestoneOracle', MilestoneOracleABI.abi)).contract;
    }

    async getFundingEscrow() {
        return (await this.getContract('FundingEscrow', FundingEscrowABI.abi)).contract;
    }

    async getActiveListings(startId: number, pageSize: number): Promise<any[]> {
        try {
            const marketplace = await this.getIPMarketplace();
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const provider = new ethers.providers.JsonRpcProvider(WEB3_CONFIG.NETWORKS.TESTNET.rpcUrl[0]);
            
            const listings = await marketplace.getActiveListings(startId, pageSize);
            
            // Transform BigNumber values to expected types
            return listings
                .filter((listing: Listing) => listing.isActive && listing.price.gt(0))
                .map((listing: Listing) => ({
                    listingId: listing.listingId.toNumber(),
                    tokenId: listing.tokenId.toNumber(),
                    seller: listing.seller,
                    price: ethers.utils.formatEther(listing.price),
                    isActive: listing.isActive,
                    isLicense: listing.isLicense,
                    licenseDuration: listing.licenseDuration.toNumber()
                }));
        } catch (error) {
            console.error('Failed to fetch active listings:', error);
            throw new Error('Failed to load marketplace listings. Please try again.');
        }
    }

    // Add createListing method
    async createListing(tokenId: number, price: string, isLicense: boolean, licenseDuration: number) {
        const marketplace = await this.getIPMarketplace();
            
        // Execute listing creation with higher gas limit for safety
        const gasEstimate = await marketplace.estimateGas.createListing(
            tokenId,
            ethers.utils.parseEther(price),
            isLicense,
            licenseDuration
        );
        
        const tx = await marketplace.createListing(
            tokenId,
            ethers.utils.parseEther(price),
            isLicense,
            licenseDuration,
            {
                gasLimit: gasEstimate.mul(120).div(100) // Add 20% buffer
            }
        );

        return tx.wait();
    }

    async hasValidLicense(tokenId: number, address: string) {
        const marketplace = await this.getIPMarketplace();
        return marketplace.hasValidLicense(tokenId, address);
    }

    async createIP(title: string, description: string, uri: string, licenseTerms: string) {
        const ipToken = await this.getIPToken();
        const tx = await ipToken.createIP(title, description, uri, licenseTerms);
        const receipt = await tx.wait();
        
        // Find the IPCreated event in the receipt
        const event = receipt.events?.find((e: ethers.Event) => e.event === 'IPCreated') as ethers.Event & { args: IPCreatedEventArgs };
        if (event && event.args) {
            return event.args.tokenId.toString();
        }
        throw new Error('Failed to get token ID from transaction');
    }

    // Example of using batch processing for token operations
    async getOwnedTokens(address: string): Promise<IPTokenData[]> {
        try {
            const provider = new ethers.providers.JsonRpcProvider(WEB3_CONFIG.NETWORKS.TESTNET.rpcUrl[0]);
            const ipTokenAddress = this.getContractAddress('IPToken');
            const contract = new ethers.Contract(ipTokenAddress, IPTokenABI.abi, provider);

            // Get the current block number
            const latestBlock = await provider.getBlockNumber();
            const tokenIds = new Set<string>();

            // Fetch transfer events in chunks
            for (let fromBlock = Math.max(0, latestBlock - 50000); fromBlock <= latestBlock; fromBlock += MAX_BLOCK_RANGE) {
                const toBlock = Math.min(fromBlock + MAX_BLOCK_RANGE - 1, latestBlock);
                
                try {
                    const filter = {
                        ...contract.filters.Transfer(null, address, null),
                        fromBlock,
                        toBlock
                    };

                    const events = await contract.queryFilter(filter);
                    events.forEach(e => tokenIds.add(e.args?.tokenId.toString()));
                } catch (err) {
                    console.warn(`Failed to fetch events for blocks ${fromBlock}-${toBlock}:`, err);
                    continue;
                }
            }

            if (tokenIds.size === 0) {
                return [];
            }

            // Process each unique token
            const tokens = await Promise.all(
                Array.from(tokenIds).map(async (tokenId) => {
                    try {
                        const owner = await contract.ownerOf(tokenId);
                        if (owner.toLowerCase() !== address.toLowerCase()) {
                            return null;
                        }

                        const details = await contract.ipDetails(tokenId);
                        const tokenData: IPTokenData = {
                            tokenId,
                            title: details.title,
                            description: details.description,
                            price: ethers.utils.formatEther(details.price),
                            isListed: details.isListed,
                            creator: details.creator,
                            licenseTerms: details.licenseTerms,
                            owner: owner,
                            isLoadingMetadata: false
                        };

                        if (details.uri && details.uri !== '') {
                            try {
                                tokenData.isLoadingMetadata = true;
                                const metadata = await ipfsService.getIPMetadata(details.uri);
                                tokenData.ipfsMetadata = metadata;
                            } catch (err) {
                                console.warn(`Failed to load IPFS metadata for token ${tokenId}:`, err);
                                tokenData.metadataError = 'Failed to load additional metadata';
                            } finally {
                                tokenData.isLoadingMetadata = false;
                            }
                        }

                        return tokenData;
                    } catch (err) {
                        console.warn(`Failed to process token ${tokenId}:`, err);
                        return null;
                    }
                })
            );

            return tokens.filter((token): token is IPTokenData => token !== null);
        } catch (err) {
            console.error('Failed to fetch owned tokens:', err);
            throw new Error('Failed to load owned tokens. Please try again.');
        }
    }

    // NEBL Token methods
    async stakeNEBL(amount: string, lockPeriod: number) {
        const neblToken = await this.getNEBLToken();
        const amountWei = ethers.utils.parseEther(amount);
        const tx = await neblToken.stake(amountWei, lockPeriod);
        return tx.wait();
    }

    async unstakeNEBL() {
        const neblToken = await this.getNEBLToken();
        const tx = await neblToken.unstake();
        return tx.wait();
    }

    async getStakeInfo(address: string) {
        const neblToken = await this.getNEBLToken();
        const info = await neblToken.getStakeInfo(address);
        return {
            amount: ethers.utils.formatEther(info.amount),
            timestamp: info.timestamp.toNumber(),
            lockPeriod: info.lockPeriod.toNumber(),
            currentReward: ethers.utils.formatEther(info.currentReward)
        };
    }

    async getNeblBalance(address: string): Promise<ethers.BigNumber> {
        try {
            // Verify network first to avoid unnecessary contract calls
            const network = await this.provider.getNetwork();
            if (network.chainId !== WEB3_CONFIG.NETWORKS.TESTNET.chainId) {
                throw new Error(`Please switch to ${WEB3_CONFIG.NETWORKS.TESTNET.name}`);
            }

            const neblToken = await this.getNEBLToken();
            
            const balance = await Promise.race([
                neblToken.balanceOf(address),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Balance fetch timeout')), 
                    WEB3_CONFIG.ETHERS_CONFIG.timeout)
                )
            ]);

            return balance || ethers.BigNumber.from(0);
        } catch (error: any) {
            console.error('Failed to get NEBL balance:', error);
            if (error.code === 'NETWORK_ERROR') {
                throw new Error('Network connection error. Please check your connection and try again.');
            }
            throw new Error(error.message || 'Failed to fetch NEBL balance. Please ensure you are connected to the correct network.');
        }
    }

    // Research Project methods
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
        
        // Convert milestone target amounts from ETH to Wei
        const targetsWei = milestoneTargets.map(t => ethers.utils.parseEther(t));
        
        // Return the transaction first for the caller to wait on
        return researchProject.createProject(
            title,
            description,
            category,
            metadataURI,
            milestoneDescriptions,
            targetsWei,
            verificationCriteria,
            deadline
        );
    }

    async fundProjectMilestone(projectId: string, milestoneId: string, amount: string) {
        const researchProject = await this.getResearchProject();
        const tx = await researchProject.fundProject(projectId, milestoneId, {
            value: ethers.utils.parseEther(amount)
        });
        return tx.wait();
    }

    async submitMilestoneVerification(projectId: string, milestoneId: string, proofCID: string) {
        const researchProject = await this.getResearchProject();
        const tx = await researchProject.verifyAndReleaseFunds(projectId, milestoneId, proofCID);
        return tx.wait();
    }

    async cancelProject(projectId: string) {
        const researchProject = await this.getResearchProject();
        const tx = await researchProject.cancelProject(projectId);
        return tx.wait();
    }

    async getProjectContribution(projectId: string, address: string) {
        const researchProject = await this.getResearchProject();
        const contribution = await researchProject.getContribution(projectId, address);
        return ethers.utils.formatEther(contribution);
    }

    async getProjectMilestone(projectId: string, milestoneId: string) {
        const researchProject = await this.getResearchProject();
        const milestone = await researchProject.getMilestone(projectId, milestoneId);
        return {
            description: milestone.description,
            targetAmount: ethers.utils.formatEther(milestone.targetAmount),
            currentAmount: ethers.utils.formatEther(milestone.currentAmount),
            isCompleted: milestone.isCompleted,
            fundsReleased: milestone.fundsReleased,
            verificationCID: milestone.verificationCID
        };
    }

    async getEscrowInfo(projectId: string, milestoneId: string) {
        const fundingEscrow = await this.getFundingEscrow();
        const funds = await fundingEscrow.getMilestoneFunds(projectId, milestoneId);
        const released = await fundingEscrow.isMilestoneReleased(projectId, milestoneId);
        return {
            funds: ethers.utils.formatEther(funds),
            released
        };
    }

    async fundProject(projectId: string, amount: string) {
        const researchProject = await this.getResearchProject();
        const tx = await researchProject.fundProject(projectId, {
            value: ethers.utils.parseEther(amount)
        });
        return tx.wait();
    }

    async getProjectDetails(projectId: string): Promise<ProjectDetails> {
        const researchProject = await this.getResearchProject();
        
        try {
            // Get main project details
            const project = await researchProject.getProject(projectId);
            
            // Better null check for project existence
            if (!project || project.title === '') {
                throw new Error('Project not found');
            }

            // Get milestone details with retry
            const maxMilestones = 20;
            const getMilestoneWithRetry = async (milestoneId: number) => {
                try {
                    const milestone = await researchProject.getMilestone(projectId, milestoneId);
                    if (!milestone || milestone.description === '') return null;
                    
                    return {
                        description: milestone.description,
                        targetAmount: milestone.targetAmount.toString(),
                        currentAmount: milestone.currentAmount.toString(),
                        isCompleted: milestone.isCompleted,
                        fundsReleased: milestone.fundsReleased,
                        verificationCriteria: milestone.verificationCriteria,
                        verificationCID: milestone.verificationCID || '' // Add missing property
                    };
                } catch {
                    return null;
                }
            };

            // Load all milestones in parallel
            const milestonePromises = Array.from(
                { length: maxMilestones },
                (_, index) => getMilestoneWithRetry(index + 1)
            );

            const milestones = (await Promise.all(milestonePromises))
                .filter((m): m is NonNullable<typeof m> => m !== null);

            if (milestones.length === 0) {
                throw new Error('No milestones found for project');
            }

            return {
                projectId,
                title: project.title,
                description: project.description,
                researcher: project.researcher,
                totalFunding: project.totalFunding.toString(),
                currentFunding: project.currentFunding.toString(),
                isActive: project.isActive,
                category: project.category,
                createdAt: project.createdAt.toNumber(),
                deadline: project.deadline.toNumber(),
                metadataURI: project.metadataURI,
                milestones: milestones.map(m => ({
                    description: m.description,
                    targetAmount: ethers.BigNumber.from(m.targetAmount).toString(),
                    currentAmount: ethers.BigNumber.from(m.currentAmount).toString(),
                    isCompleted: m.isCompleted,
                    fundsReleased: m.fundsReleased,
                    verificationCriteria: m.verificationCriteria,
                    verificationCID: m.verificationCID || '' // Add missing property
                }))
            };
        } catch (err) {
            console.error('Error loading project details:', err);
            if (err instanceof Error && 
                (err.message.includes('project not found') || 
                 err.message.includes('Project not found'))) {
                throw new Error('Project not found');
            }
            throw new Error('Failed to load project details. Please try again.');
        }
    }

    async getVerificationDetails(projectId: string, milestoneId: string): Promise<VerificationReport> {
        const oracle = await this.getMilestoneOracle();
        const details = await oracle.getDetailedVerification(projectId, milestoneId);
        
        return {
            status: this.mapVerificationStatus(details.status),
            verificationMethod: details.verificationMethod,
            timestamp: details.timestamp.toNumber(),
            proofHash: details.proofHash,
            verifierSignature: details.verifierSignature,
            confidenceScore: details.confidenceScore.toNumber() / 100,
            metricResults: {
                accuracy: details.metricResults.accuracy.toNumber() / 100,
                completeness: details.metricResults.completeness.toNumber() / 100,
                timeliness: details.metricResults.timeliness.toNumber() / 100,
                methodology: details.metricResults.methodology
            },
            auditTrail: {
                checkpoints: details.auditTrail.checkpoints,
                timestamps: details.auditTrail.timestamps.map((t: ethers.BigNumber) => t.toNumber()),
                verifierNodes: details.auditTrail.verifierNodes
            }
        };
    }

    async requestMilestoneVerification(request: VerificationRequest) {
        const oracle = await this.getMilestoneOracle();
        
        // Prepare verification request with enhanced parameters
        const tx = await oracle.requestDetailedVerification({
            projectId: request.projectId,
            milestoneId: request.milestoneId,
            proofCID: request.proofCID,
            verificationCID: request.verificationCID,
            verificationMethods: request.verificationMethods,
            requiredConfidence: Math.floor(request.requiredConfidence * 100), // Convert to basis points
            deadline: request.deadline,
            customParams: request.customParams || {}
        });

        return tx.wait();
    }

    async getVerificationMethods() {
        const oracle = await this.getMilestoneOracle();
        return oracle.getSupportedVerificationMethods();
    }

    async challengeVerification(
        projectId: string,
        milestoneId: string,
        reason: string,
        evidence: string
    ) {
        const oracle = await this.getMilestoneOracle();
        const tx = await oracle.challengeVerification(
            projectId,
            milestoneId,
            reason,
            evidence,
            { value: ethers.utils.parseEther('0.1') } // Challenge requires stake
        );
        return tx.wait();
    }

    async getVerificationMetrics(projectId: string, milestoneId: string) {
        const oracle = await this.getMilestoneOracle();
        const metrics = await oracle.getVerificationMetrics(projectId, milestoneId);
        
        return {
            totalVerifications: metrics.totalVerifications.toNumber(),
            successRate: metrics.successRate.toNumber() / 100,
            averageConfidence: metrics.averageConfidence.toNumber() / 100,
            challengesResolved: metrics.challengesResolved.toNumber(),
            averageVerificationTime: metrics.averageVerificationTime.toNumber()
        };
    }

    private mapVerificationStatus(status: number): 'PENDING' | 'VERIFIED' | 'FAILED' | 'DISPUTED' {
        const statusMap: Record<number, 'PENDING' | 'VERIFIED' | 'FAILED' | 'DISPUTED'> = {
            0: 'PENDING',
            1: 'VERIFIED',
            2: 'FAILED',
            3: 'DISPUTED'
        };
        return statusMap[status] || 'PENDING';
    }

    // Governance methods
    async createProposal(
        targets: string[],
        values: number[],
        calldatas: string[],
        description: string
    ) {
        const governance = await this.getGovernance();
        return await retryOperation(async () => {
            const tx = await governance.propose(targets, values, calldatas, description);
            return tx.wait();
        });
    }

    async castVote(proposalId: string, support: boolean) {
        const governance = await this.getGovernance();
        const tx = await governance.castVote(proposalId, support);
        return tx.wait();
    }

    // Disputes methods
    async createDispute(
        disputeType: number,
        respondent: string,
        relatedId: string,
        description: string
    ) {
        const disputes = await this.getDisputes();
        const tx = await disputes.createDispute(
            disputeType,
            respondent,
            relatedId,
            description,
            { value: ethers.utils.parseEther('0.1') } // 0.1 AVAX dispute fee
        );
        const receipt = await tx.wait();
        const event = receipt.events?.find((e: ethers.Event) => e.event === 'DisputeCreated');
        return event?.args?.disputeId.toString();
    }

    async submitEvidence(
        disputeId: string,
        description: string,
        ipfsHash: string
    ) {
        const disputes = await this.getDisputes();
        const tx = await disputes.submitEvidence(disputeId, description, ipfsHash);
        return tx.wait();
    }

    async getDisputeDetails(disputeId: string): Promise<DisputeDetails> {
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
    }

    async getNeblSwap() {
        if (!this.signer) throw new Error("No signer available");
        const address = this.getContractAddress('NEBLSwap');
        return new ethers.Contract(
            address,
            NEBLSwapABI.abi,
            this.signer
        );
    }

    async calculateExpectedNEBL(avaxAmount: string): Promise<ethers.BigNumber> {
        const neblSwap = await this.getNeblSwap();
        const avaxAmountWei = ethers.utils.parseEther(avaxAmount);
        return await neblSwap.calculateNEBLAmount(avaxAmountWei);
    }

    async swapAVAXForNEBL(avaxAmount: string) {
        try {
            // Verify network first
            const network = await this.provider.getNetwork();
            if (network.chainId !== WEB3_CONFIG.NETWORKS.TESTNET.chainId) {
                throw new Error(`Please switch to ${WEB3_CONFIG.NETWORKS.TESTNET.name}`);
            }

            const neblSwap = await this.getNeblSwap();
            const avaxAmountWei = ethers.utils.parseEther(avaxAmount);
            
            // Get expected NEBL amount first
            const expectedNebl = await neblSwap.calculateNEBLAmount(avaxAmountWei);
            if (!expectedNebl || expectedNebl.isZero()) {
                throw new Error("Invalid swap amount");
            }

            // Verify contract state and liquidity
            const neblToken = await this.getNEBLToken();
            const swapBalance = await neblToken.balanceOf(neblSwap.address);
            
            // Add 1% buffer to the expected amount to account for any price changes
            const requiredLiquidity = expectedNebl.mul(101).div(100);
            if (swapBalance.lt(requiredLiquidity)) {
                throw new Error("Insufficient liquidity in swap contract");
            }

            // Verify AVAX price feed is working
            const latestPrice = await neblSwap.getLatestAVAXPrice();
            if (!latestPrice || latestPrice.isZero()) {
                throw new Error("Price feed error");
            }

            // Get current network conditions for optimal gas settings
            const [gasPrice, baseFeePerGas] = await Promise.all([
                this.provider.getGasPrice(),
                this.provider.send('eth_maxPriorityFeePerGas', [])
            ]);

            const maxPriorityFeePerGas = ethers.BigNumber.from(baseFeePerGas);
            const maxFeePerGas = gasPrice.mul(110).div(100); // Base fee + 10%

            // Estimate gas with the exact parameters
            const gasEstimate = await neblSwap.estimateGas.swapAVAXForNEBL({
                value: avaxAmountWei
            });

            // Add larger buffer for swap operations
            const gasLimit = gasEstimate.mul(130).div(100); // Add 30% buffer for swaps

            // Execute swap with optimized settings
            const tx = await neblSwap.swapAVAXForNEBL({
                value: avaxAmountWei,
                maxFeePerGas,
                maxPriorityFeePerGas,
                gasLimit
            });

            // Wait for confirmation with timeout and retry logic
            let receipt = null;
            let retries = 3;
            
            while (retries > 0 && !receipt) {
                try {
                    receipt = await Promise.race([
                        tx.wait(1),
                        new Promise((_, reject) => 
                            setTimeout(() => reject(new Error('Transaction confirmation timeout')), 
                            WEB3_CONFIG.ETHERS_CONFIG.timeout)
                        )
                    ]);
                    break;
                } catch (err) {
                    console.warn('Waiting for transaction confirmation...', err);
                    retries--;
                    if (retries === 0) throw err;
                    await new Promise(resolve => setTimeout(resolve, 5000));
                }
            }

            // Verify the swap was successful
            const swapEvent = receipt.events?.find(
                (e: ethers.Event) => e.event === 'SwapAVAXForNEBL'
            );
            
            if (!swapEvent) {
                throw new Error('Swap transaction completed but no event found. Please check your balance.');
            }

            // Get the current address before setting up the timeout
            const address = await this.signer.getAddress();

            // Update token balance after swap (optimistic update)
            setTimeout(() => this.getNeblBalance(address), 1000);

            return receipt;
        } catch (error: any) {
            console.error('Swap failed:', error);
            if (error.code === 4001) {
                throw new Error('Transaction rejected by user');
            } else if (error.code === -32603) {
                throw new Error('Network error. Please verify your connection and try again.');
            } else if (error.message.includes('price feed')) {
                throw new Error('Price feed error. Please try again in a few minutes.');
            }
            throw new Error(error.message || 'Swap failed. Please try again.');
        }
    }

    async watchToken() {
        if (!window.ethereum) throw new Error('MetaMask is not installed');
        
        const neblToken = await this.getNEBLToken();
        const address = await neblToken.address;
        const symbol = await neblToken.symbol();
        const decimals = await neblToken.decimals();
        
        try {
            await window.ethereum.request({
                method: 'wallet_watchAsset',
                params: [{
                    type: 'ERC20',
                    options: {
                        address,
                        symbol,
                        decimals,
                        image: 'https://raw.githubusercontent.com/your-repo/nebula-token-logo.png'
                    }
                }]
            });
        } catch (error) {
            console.error('Error adding token to MetaMask:', error);
            throw error;
        }
    }

    getIPMarketplaceAddress(): string {
        return this.getContractAddress('IPMarketplace');
    }

    async purchaseListing(listingId: number, price: string) {
        const marketplace = await this.getIPMarketplace();
        const tx = await marketplace.purchaseListing(listingId, {
            value: ethers.utils.parseEther(price)
        });
        return tx.wait();
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

    private async processBatch<T, R>(
        items: T[],
        processor: (item: T) => Promise<R>,
        batchSize: number = WEB3_CONFIG.ETHERS_CONFIG.rpcConfig.batchSize
    ): Promise<NonNullable<Awaited<R>>[]> {
        const results: NonNullable<Awaited<R>>[] = [];
        let activeBatches = 0;
        
        while (activeBatches >= WEB3_CONFIG.ETHERS_CONFIG.rpcConfig.maxConcurrentBatches) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        activeBatches++;
        
        try {
            for (let i = 0; i < items.length; i += batchSize) {
                if (i > 0) {
                    await new Promise(resolve => 
                        setTimeout(resolve, Math.min(1000 * Math.pow(2, i / batchSize), 10000))
                    );
                }

                const batch = items.slice(i, i + batchSize);
                const batchPromises = batch.map(async (item) => {
                    try {
                        const result = await processor(item);
                        return { status: 'fulfilled' as const, value: result };
                    } catch (error) {
                        return { status: 'rejected' as const, reason: error };
                    }
                });

                const batchResults = await Promise.all(batchPromises);
                
                const validResults = batchResults
                    .filter((result): result is { status: 'fulfilled', value: NonNullable<Awaited<R>> } => 
                        result.status === 'fulfilled' && result.value != null
                    )
                    .map(result => result.value);
                
                results.push(...validResults);
            }
            
            return results;
        } finally {
            activeBatches--;
        }
    }

    private async retryOperation<T>(
        operation: () => Promise<T>,
        maxRetries: number = WEB3_CONFIG.ETHERS_CONFIG.rpcConfig.maxRetries
    ): Promise<T> {
        let lastError: Error | null = null;
        
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await operation();
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
}