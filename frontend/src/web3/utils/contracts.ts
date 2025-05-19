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

interface VerificationDetails {
    status: string;
    timestamp: Date;
    verifier: string;
    attempts?: number;
    proofCID?: string;
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
                        WEB3_CONFIG.ETHERS_CONFIG.rpcConfig.customBackoff(
                            WEB3_CONFIG.ETHERS_CONFIG.rpcConfig.maxRetries - attempt
                        )
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
const MAX_BLOCK_RANGE = 2000; // Slightly under Fuji's 2048 limit for safety

export class ContractInterface {
    public readonly provider: ethers.providers.Web3Provider;
    private signer: ethers.Signer | undefined;
    private contracts: Map<string, BaseContract> = new Map();
    private fallbackProviders: ethers.providers.JsonRpcProvider[] = [];

    constructor(provider: ethers.providers.Web3Provider) {
        this.provider = provider;
        this.initializeSigner();
    }

    private async initializeSigner() {
        try {
        this.signer = this.provider.getSigner();
        } catch (error) {
            console.warn('Failed to initialize signer:', error);
            this.signer = undefined;
        }
    }

    getProvider(): ethers.providers.Web3Provider {
        return this.provider;
    }

    getSigner(): ethers.Signer {
        if (!this.signer) {
            throw new Error('No signer available');
        }
        return this.signer;
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

    // Helper method to execute a contract call with retries
    async executeWithRetry<T>(
        operation: () => Promise<T>,
        maxRetries: number = 3
    ): Promise<T> {
        let lastError: Error | null = null;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await operation();
            } catch (err: any) {
                console.warn(`Contract call attempt ${attempt + 1} failed:`, err);
                lastError = err;

                if (attempt === maxRetries) break;

                // Wait with exponential backoff before retrying
                const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        if (lastError) {
            throw lastError;
        }

        throw new Error('Operation failed after multiple retries');
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
        try {
            const oracle = await this.getContract('MilestoneOracle', MilestoneOracleABI.abi);
            if (!oracle || !oracle.contract) {
                throw new Error('Failed to initialize oracle contract');
            }
            return oracle;
        } catch (error: any) {
            console.error('Failed to get milestone oracle:', error);
            throw new Error('Failed to connect to milestone oracle contract');
        }
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
                .map((listing: Listing) => {
                    // Get the price in AVAX
                    let adjustedPrice;

                    try {
                        // Format the price using ethers utils
                        const priceInEther = ethers.utils.formatEther(listing.price);

                        // Remove trailing .0 if present
                        adjustedPrice = priceInEther.replace(/\.0+$/, '');

                        console.log(`Listing ${listing.listingId}: Raw price=${priceInEther}, Adjusted price=${adjustedPrice}`);
                    } catch (err) {
                        console.warn(`Error formatting price for listing ${listing.listingId}:`, err);
                        // Fallback to direct string conversion if formatEther fails
                        adjustedPrice = listing.price.toString();
                    }

                    return {
                        listingId: listing.listingId.toNumber(),
                        tokenId: listing.tokenId.toNumber(),
                        seller: listing.seller,
                        price: adjustedPrice,
                        isActive: listing.isActive,
                        isLicense: listing.isLicense,
                        licenseDuration: listing.licenseDuration.toNumber()
                    };
                });
        } catch (error) {
            console.error('Failed to fetch active listings:', error);
            throw new Error('Failed to load marketplace listings. Please try again.');
        }
    }

    // Add createListing method
    async createListing(tokenId: number, price: string, isLicense: boolean, licenseDuration: number) {
        const marketplace = await this.getIPMarketplace();

        try {
            // Validate the price is a valid number
            const priceFloat = parseFloat(price);
            if (isNaN(priceFloat) || priceFloat <= 0) {
                throw new Error('Please enter a valid price greater than 0');
            }

            // Format the price to ensure it's compatible with parseEther
            // Remove any commas and ensure it's a valid decimal string
            const adjustedPrice = price.replace(/,/g, '');

            console.log("Original price:", price, "AVAX");
            console.log("Adjusted price for contract:", adjustedPrice, "AVAX");

            // Ensure the price is in a format that parseEther can handle
            // If it's a decimal like 0.0001, make sure it's properly formatted
            let formattedPrice = adjustedPrice;
            let priceInWei;

            try {
                // Try to parse the price
                priceInWei = ethers.utils.parseEther(formattedPrice);
                console.log("Price in Wei:", priceInWei.toString());
            } catch (error: any) {
                // If there's an error, try to fix common formatting issues
                if (error.code === "INVALID_ARGUMENT") {
                    console.log("Invalid argument error, attempting to fix price format");

                    // Try to convert scientific notation to decimal string
                    if (/e[+-]/.test(formattedPrice)) {
                        formattedPrice = Number(formattedPrice).toFixed(18);
                    }

                    // Ensure there's no trailing zeros that might cause issues
                    formattedPrice = formattedPrice.replace(/(\.\d*?)0+$/, '$1');

                    console.log("Reformatted price:", formattedPrice);
                    priceInWei = ethers.utils.parseEther(formattedPrice);
                    console.log("Price in Wei after reformatting:", priceInWei.toString());
                } else {
                    throw error;
                }
            }

            // Execute listing creation with higher gas limit for safety
            const gasEstimate = await marketplace.estimateGas.createListing(
                tokenId,
                priceInWei,
                isLicense,
                licenseDuration
            );

            console.log("Estimated gas for createListing:", gasEstimate.toString());

            const tx = await marketplace.createListing(
                tokenId,
                priceInWei,
                isLicense,
                licenseDuration,
                {
                    gasLimit: gasEstimate.mul(120).div(100) // Add 20% buffer
                }
            );

            console.log("Transaction sent:", tx);

            // Check if wait is a function before calling it
            if (tx && typeof tx.wait === 'function') {
                console.log("Waiting for transaction confirmation...");
                const receipt = await tx.wait(1); // Wait for 1 confirmation
                console.log("Transaction confirmed:", receipt);
                return receipt;
            } else {
                // If tx.wait is not a function, we need to handle this case
                console.log("Transaction object doesn't have wait function:", tx);

                // If it's a transaction hash, we can manually wait for it
                if (typeof tx === 'string' || (tx && tx.hash)) {
                    const txHash = typeof tx === 'string' ? tx : tx.hash;
                    console.log("Waiting for transaction by hash:", txHash);

                    // Wait for the transaction to be mined
                    let receipt = null;
                    let retries = 10;

                    while (retries > 0 && !receipt) {
                        try {
                            receipt = await this.provider.getTransactionReceipt(txHash);
                            if (receipt) {
                                console.log("Transaction confirmed manually:", receipt);
                                return receipt;
                            }
                        } catch (err) {
                            console.warn("Error checking receipt, retrying...", err);
                        }

                        // Wait before retrying
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        retries--;
                    }
                }

                // If we can't wait for it, return the transaction as is
                return tx;
            }
        } catch (error) {
            console.error("Error creating listing:", error);
            throw error;
        }
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

            // Start from a reasonable point in the past (last ~2 weeks of blocks)
            const startBlock = Math.max(0, latestBlock - 100800); // ~2 weeks of blocks at 12s/block
            const tokenIds = new Set<string>();

            // Fetch transfer events in chunks
            for (let fromBlock = startBlock; fromBlock <= latestBlock; fromBlock += MAX_BLOCK_RANGE) {
                const toBlock = Math.min(fromBlock + MAX_BLOCK_RANGE - 1, latestBlock);

                try {
                    const transferFilter = contract.filters.Transfer(null, address, null);
                    const events = await contract.queryFilter(transferFilter, fromBlock, toBlock);
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
                            price: '0',
                            isListed: false,
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
        try {
            const researchProject = await this.getResearchProject();
            console.log('Project ID:', projectId);
            console.log('Milestone ID:', milestoneId);
            console.log('Amount (before parsing):', amount);

            const amountWei = ethers.utils.parseEther(amount);
            console.log('Amount in Wei:', amountWei.toString());

            // Check project deadline before attempting transaction
            try {
                const project = await researchProject.getProject(projectId);
                const deadlineTimestamp = project.deadline.toNumber() * 1000; // Convert to milliseconds
                const currentTimestamp = Date.now();

                if (currentTimestamp > deadlineTimestamp) {
                    throw new Error(`Funding deadline passed. Project deadline was ${new Date(deadlineTimestamp).toLocaleString()}`);
                }
            } catch (err: any) {
                if (err.message?.includes('Funding deadline')) {
                    throw err; // Re-throw our custom error
                }
                // If it's another error with project fetching, continue with the transaction
                console.warn('Could not verify project deadline:', err);
            }

            const tx = await researchProject.fundProject(projectId, milestoneId, {
                value: amountWei
            });

            return await tx.wait();
        } catch (error: any) {
            console.error('fundProjectMilestone error:', error);

            // Check for specific error messages from contract
            if (error.data?.message?.includes('Funding deadline passed') ||
                error.message?.includes('Funding deadline passed')) {
                throw new Error('Funding deadline for this project has passed. You cannot fund it anymore.');
            }

            // Check for other common errors
            if (error.code === 'INSUFFICIENT_FUNDS') {
                throw new Error('Insufficient balance to complete this transaction.');
            } else if (error.code === 'ACTION_REJECTED' || error.code === 4001) {
                throw new Error('Transaction was rejected. Please try again.');
            }

            throw error;
        }
    }

    async fundProject(projectId: string, amount: string) {
        try {
            const researchProject = await this.getResearchProject();
            console.log('Project ID:', projectId);
            console.log('Amount (before parsing):', amount);

            const amountWei = ethers.utils.parseEther(amount);
            console.log('Amount in Wei:', amountWei.toString());

            // Check project deadline before attempting transaction
            try {
                const project = await researchProject.getProject(projectId);
                const deadlineTimestamp = project.deadline.toNumber() * 1000; // Convert to milliseconds
                const currentTimestamp = Date.now();

                if (currentTimestamp > deadlineTimestamp) {
                    throw new Error(`Funding deadline passed. Project deadline was ${new Date(deadlineTimestamp).toLocaleString()}`);
                }
            } catch (err: any) {
                if (err.message?.includes('Funding deadline')) {
                    throw err; // Re-throw our custom error
                }
                // If it's another error with project fetching, continue with the transaction
                console.warn('Could not verify project deadline:', err);
            }

            const tx = await researchProject.fundProject(projectId, {
                value: amountWei
            });

            return await tx.wait();
        } catch (error: any) {
            console.error('fundProject error:', error);

            // Check for specific error messages from contract
            if (error.data?.message?.includes('Funding deadline passed') ||
                error.message?.includes('Funding deadline passed')) {
                throw new Error('Funding deadline for this project has passed. You cannot fund it anymore.');
            }

            // Check for other common errors
            if (error.code === 'INSUFFICIENT_FUNDS') {
                throw new Error('Insufficient balance to complete this transaction.');
            } else if (error.code === 'ACTION_REJECTED' || error.code === 4001) {
                throw new Error('Transaction was rejected. Please try again.');
            }

            throw error;
        }
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

    async getProjectDetails(projectId: string): Promise<ProjectDetails> {
        try {
            // Get contract with retry mechanism
            const researchProject = await this.getResearchProject();

            // Log for debugging
            console.log(`Attempting to get project details for ID: ${projectId}`);
            console.log(`Using ResearchProject contract at: ${await researchProject.address}`);

            try {
                // Get main project details with retry
                const project = await this.executeWithRetry(
                    () => researchProject.getProject(projectId),
                    3
                ) as {
                    title: string;
                    description: string;
                    researcher: string;
                    totalFunding: ethers.BigNumber;
                    currentFunding: ethers.BigNumber;
                    isActive: boolean;
                    category: string;
                    createdAt: ethers.BigNumber;
                    deadline: ethers.BigNumber;
                    metadataURI: string;
                };

                // Better null check for project existence
                if (!project || project.title === '') {
                    console.error(`Project with ID ${projectId} not found or has empty title`);
                    throw new Error('Project not found');
                }

                // Get milestone details with retry
                const maxMilestones = 20;
                const getMilestoneWithRetry = async (milestoneId: number) => {
                    try {
                        const milestone = await this.executeWithRetry(
                            () => researchProject.getMilestone(projectId, milestoneId),
                            2
                        ) as {
                            description: string;
                            targetAmount: ethers.BigNumber;
                            currentAmount: ethers.BigNumber;
                            isCompleted: boolean;
                            fundsReleased: boolean;
                            verificationCriteria: string;
                            verificationCID?: string;
                        };

                        if (!milestone || milestone.description === '') return null;

                        return {
                            description: milestone.description,
                            targetAmount: milestone.targetAmount.toString(),
                            currentAmount: milestone.currentAmount.toString(),
                            isCompleted: milestone.isCompleted,
                            fundsReleased: milestone.fundsReleased,
                            verificationCriteria: milestone.verificationCriteria || '',
                            verificationCID: milestone.verificationCID || '' // Add missing property
                        };
                    } catch (err) {
                        console.warn(`Failed to get milestone ${milestoneId} for project ${projectId}:`, err);
                        return null;
                    }
                };

            // Load all milestones in parallel with better error handling
            const milestonePromises = Array.from(
                { length: maxMilestones },
                (_, index) => getMilestoneWithRetry(index + 1)
            );

            const milestones = (await Promise.all(milestonePromises))
                .filter((m): m is NonNullable<typeof m> => m !== null);

            // Allow projects with no milestones (though this should be rare)
            if (milestones.length === 0) {
                console.warn(`No milestones found for project ${projectId}, but continuing with project data`);
            }

            const projectDetails = {
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
                    verificationCriteria: m.verificationCriteria || '',
                    verificationCID: m.verificationCID || ''
                }))
            };

            console.log(`Successfully loaded project details for ID ${projectId}:`, projectDetails);
            return projectDetails;

            } catch (err) {
                console.error(`Error in inner try block for project ${projectId}:`, err);
                throw err; // Re-throw to be caught by outer try-catch
            }
        } catch (err) {
            console.error('Error loading project details:', err);

            // Check for specific error types
            if (err instanceof Error) {
                const errorMessage = err.message.toLowerCase();

                if (errorMessage.includes('project not found') ||
                    errorMessage.includes('invalid project id') ||
                    errorMessage.includes('out of bounds') ||
                    errorMessage.includes('nonexistent token')) {
                    console.error(`Project with ID ${projectId} not found`);
                    throw new Error('Project not found');
                }

                if (errorMessage.includes('network') ||
                    errorMessage.includes('connection') ||
                    err.stack?.includes('timeout')) {
                    throw new Error('Network error while loading project. Please check your connection and try again.');
                }
            }

            // Generic fallback error
            throw new Error('Failed to load project details. Please try again.');
        }
    }

    async requestVerification(projectId: number, milestoneId: number) {
        try {
            const oracle = await this.getMilestoneOracle();
            const tx = await oracle.contract.requestVerification(projectId, milestoneId);
            return tx.wait();
        } catch (error: any) {
            console.error('Verification request failed:', error);
            throw new Error(error.message || 'Failed to request verification');
        }
    }

    async getVerificationDetails(projectId: number, milestoneId: number): Promise<VerificationDetails> {
        try {
            const oracle = await this.getMilestoneOracle();
            if (!oracle || !oracle.contract) {
                throw new Error('Oracle contract not initialized');
            }
            const [isProcessing, isVerified, attempts, proofCID, timestamp] = await oracle.contract.getLatestVerification(projectId, milestoneId);
            return {
                status: isProcessing ? 'PENDING' : (isVerified ? 'VERIFIED' : 'FAILED'),
                timestamp: new Date(timestamp.toNumber() * 1000),
                verifier: '', // This information is not available in the current contract
                attempts: attempts, // attempts is already a number, no need for toNumber()
                proofCID
            };
        } catch (error: any) {
            console.error('Failed to get verification details:', error);
            throw new Error(error.message || 'Failed to get verification details');
        }
    }

    async requestMilestoneVerification(request: VerificationRequest) {
        try {
            const oracle = await this.getMilestoneOracle();
            if (!oracle || !oracle.contract) {
                throw new Error('Oracle contract not initialized');
            }

            // Prepare verification request with all required arguments
            const tx = await oracle.contract.requestVerification(
                request.projectId,
                request.milestoneId,
                request.proofCID,
                request.verificationCID || '', // Required but can be empty if not used
                request.verificationMethods || [], // Required but can be empty if not used
                request.deadline || Math.floor(Date.now() / 1000) + 86400 // Default to 24 hours from now
            );

            return tx.wait();
        } catch (error: any) {
            console.error('Verification request failed:', error);
            throw new Error(error.message || 'Failed to request verification');
        }
    }

    async getVerificationMethods() {
        const oracle = await this.getMilestoneOracle();
        if (!oracle || !oracle.contract) {
            throw new Error('Oracle contract not initialized');
        }
        // The contract doesn't have a getSupportedVerificationMethods function
        // Return a default set of methods
        return ['PROOF_OF_COMPLETION', 'CODE_REVIEW', 'TEST_RESULTS'];
    }

    async challengeVerification(
        projectId: string,
        milestoneId: string,
        reason: string,
        evidence: string
    ) {
        const oracle = await this.getMilestoneOracle();
        if (!oracle || !oracle.contract) {
            throw new Error('Oracle contract not initialized');
        }
        // The contract doesn't have a challengeVerification function
        throw new Error('Verification challenges are not supported in this version');
    }

    async getVerificationMetrics(projectId: string, milestoneId: string) {
        const oracle = await this.getMilestoneOracle();
        if (!oracle || !oracle.contract) {
            throw new Error('Oracle contract not initialized');
        }
        // The contract doesn't have a getVerificationMetrics function
        // Return default metrics
        return {
            totalVerifications: 0,
            successRate: 0,
            averageConfidence: 0,
            challengesResolved: 0,
            averageVerificationTime: 0
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
        try {
            // Use the same pattern as other contract getters
            const contract = await this.getContract('NEBLSwap', NEBLSwapABI.abi);
            return contract.contract;
        } catch (error) {
            console.error('Failed to initialize NEBLSwap contract:', error);
            throw new Error('Failed to connect to swap contract');
        }
    }

    async calculateExpectedNEBL(avaxAmount: string): Promise<ethers.BigNumber> {
        try {
        const neblSwap = await this.getNeblSwap();
            if (!neblSwap) {
                throw new Error('Failed to connect to swap contract');
            }

            // Check if the function exists on the contract
            if (typeof neblSwap.calculateNEBLAmount !== 'function') {
                console.error('calculateNEBLAmount function not found on contract');
                throw new Error('Swap calculation function not available');
            }

        const avaxAmountWei = ethers.utils.parseEther(avaxAmount);
            const expectedAmount = await neblSwap.calculateNEBLAmount(avaxAmountWei);
            return expectedAmount;
        } catch (error: any) {
            console.error('Failed to calculate expected NEBL:', error);
            throw new Error('Failed to calculate expected NEBL amount');
        }
    }

    async calculateExpectedAVAX(neblAmount: string): Promise<ethers.BigNumber> {
        try {
            const neblSwap = await this.getNeblSwap();
            if (!neblSwap) {
                throw new Error('Failed to connect to swap contract');
            }

            // Check if the function exists on the contract
            if (typeof neblSwap.calculateAVAXAmount !== 'function') {
                console.error('calculateAVAXAmount function not found on contract');
                throw new Error('Swap calculation function not available');
            }

            const neblAmountWei = ethers.utils.parseEther(neblAmount);
            const expectedAmount = await neblSwap.calculateAVAXAmount(neblAmountWei);
            return expectedAmount;
        } catch (error: any) {
            console.error('Failed to calculate expected AVAX:', error);
            throw new Error('Failed to calculate expected AVAX amount');
        }
    }

    async swapNEBLForAVAX(neblAmount: string) {
        try {
            // Verify network first
            const network = await this.provider.getNetwork();
            if (network.chainId !== WEB3_CONFIG.NETWORKS.TESTNET.chainId) {
                throw new Error(`Please switch to ${WEB3_CONFIG.NETWORKS.TESTNET.name}`);
            }

            const neblSwap = await this.getNeblSwap();
            if (!neblSwap) {
                throw new Error('Failed to connect to swap contract');
            }

            // Check if required functions exist
            if (typeof neblSwap.calculateAVAXAmount !== 'function' ||
                typeof neblSwap.swapNEBLForAVAX !== 'function') {
                console.error('Required swap functions not found on contract');
                throw new Error('Swap functionality not available');
            }

            const neblToken = await this.getNEBLToken();
            const neblAmountWei = ethers.utils.parseEther(neblAmount);

            // Get expected AVAX amount first
            const expectedAVAX = await neblSwap.calculateAVAXAmount(neblAmountWei);
            if (!expectedAVAX || expectedAVAX.isZero()) {
                throw new Error("Invalid swap amount");
            }

            if (!this.signer) {
                throw new Error('No signer available');
            }

            // Check AVAX liquidity in the contract before attempting swap
            const swapContractBalance = await this.provider.getBalance(neblSwap.address);
            console.log('Swap contract AVAX balance:', ethers.utils.formatEther(swapContractBalance));
            console.log('Expected AVAX amount:', ethers.utils.formatEther(expectedAVAX));

            // Add 1% buffer to account for any price changes
            const requiredLiquidity = expectedAVAX.mul(101).div(100);
            if (swapContractBalance.lt(requiredLiquidity)) {
                throw new Error(`Insufficient AVAX liquidity in the swap contract. Available: ${ethers.utils.formatEther(swapContractBalance)} AVAX, Required: ${ethers.utils.formatEther(requiredLiquidity)} AVAX`);
            }

            // Check NEBL allowance
            const address = await this.signer.getAddress();
            const allowance = await neblToken.allowance(address, neblSwap.address);
            if (allowance.lt(neblAmountWei)) {
                // Approve if needed
                console.log("Approving NEBLSwap to spend NEBL tokens");
                const approveTx = await neblToken.approve(neblSwap.address, ethers.constants.MaxUint256);
                await approveTx.wait();
                console.log("Approval successful");
            }

            console.log("Executing NEBL to AVAX swap");
            // Execute swap
            const tx = await neblSwap.swapNEBLForAVAX(neblAmountWei);
            console.log("Swap transaction submitted, waiting for confirmation");
            const receipt = await tx.wait();
            console.log("Swap confirmed in block:", receipt.blockNumber);

            // Update token balance after swap (optimistic update)
            setTimeout(() => this.getNeblBalance(address), 1000);

            return receipt;
        } catch (error: any) {
            console.error('Swap failed:', error);
            // Check for specific error messages in the error data
            if (error.data?.message?.includes('Insufficient AVAX liquidity') ||
                error.message?.includes('Insufficient AVAX liquidity')) {
                throw new Error('Insufficient AVAX liquidity in the swap contract. Please try a smaller amount or try again later.');
            }
            if (error.code === 4001) {
                throw new Error('Transaction rejected by user');
            } else if (error.code === -32603) {
                throw new Error('Network error. Please verify your connection and try again.');
            } else if (error.message?.includes('price feed')) {
                throw new Error('Price feed error. Please try again in a few minutes.');
            }
            throw new Error(error.message || 'Swap failed. Please try again.');
        }
    }

    async swapAVAXForNEBL(avaxAmount: string) {
        try {
            // Verify network first
            const network = await this.provider.getNetwork();
            if (network.chainId !== WEB3_CONFIG.NETWORKS.TESTNET.chainId) {
                throw new Error(`Please switch to ${WEB3_CONFIG.NETWORKS.TESTNET.name}`);
            }

            const neblSwap = await this.getNeblSwap();
            if (!neblSwap) {
                throw new Error('Failed to connect to swap contract');
            }

            // Check if required functions exist
            if (typeof neblSwap.calculateNEBLAmount !== 'function' ||
                typeof neblSwap.swapAVAXForNEBL !== 'function') {
                console.error('Required swap functions not found on contract');
                throw new Error('Swap functionality not available');
            }

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

            console.log("Executing AVAX to NEBL swap");
            // Execute swap
            const tx = await neblSwap.swapAVAXForNEBL({
                value: avaxAmountWei
            });

            console.log("Swap transaction submitted, waiting for confirmation");
            const receipt = await tx.wait();
            console.log("Swap confirmed in block:", receipt.blockNumber);

            // Get the current address before setting up the timeout
            if (!this.signer) {
                throw new Error('No signer available');
            }
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
            } else if (error.message?.includes('price feed')) {
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
        try {
            if (!this.signer) {
                throw new Error('No signer available');
            }

            const ipMarketplace = await this.getIPMarketplace();

            // First verify the listing exists and get its actual price from the contract
            const listing = await ipMarketplace.getListing(listingId);
            if (!listing || !listing.listingId) {
                throw new Error(`Listing ${listingId} not found`);
            }

            // Use the precise listing price from the contract
            const listingPrice = listing.price;
            const formattedListingPrice = ethers.utils.formatEther(listingPrice);

            console.log('Listing found:', {
                listingId: listing.listingId.toString(),
                tokenId: listing.tokenId.toString(),
                price: formattedListingPrice,
                priceWei: listingPrice.toString(),
                isActive: listing.isActive,
                seller: listing.seller
            });

            console.log(`Attempting to purchase listing ${listingId} for ${formattedListingPrice} AVAX (${listingPrice.toString()} wei)`);

            if (!listing.isActive) {
                throw new Error('Listing is no longer active');
            }

            // We'll use the contract's price directly rather than parsing the provided price
            // This avoids any precision issues with string conversion

            // Use a manual gas limit to bypass estimation errors
            const manualGasLimit = ethers.BigNumber.from('500000'); // Conservative gas limit

            // Check if user has enough balance
            const signerAddress = await this.signer.getAddress();
            const balance = await this.provider.getBalance(signerAddress);
            const gasPrice = await this.provider.getGasPrice();

            // Add a buffer to the gas estimate to ensure we have enough
            const estimatedGasCost = manualGasLimit.mul(gasPrice).mul(120).div(100); // 20% buffer
            const requiredBalance = listingPrice.add(estimatedGasCost);

            // Format values for display
            const formattedBalance = ethers.utils.formatEther(balance);
            const formattedRequired = ethers.utils.formatEther(requiredBalance);
            // We already have formattedListingPrice from earlier in the function
            const formattedGasCost = ethers.utils.formatEther(estimatedGasCost);

            console.log('Balance check:', {
                balance: formattedBalance,
                requiredBalance: formattedRequired,
                listingPrice: formattedListingPrice,
                estimatedGas: formattedGasCost
            });

            if (balance.lt(requiredBalance)) {
                // Format for display with fixed precision
                const displayBalance = parseFloat(formattedBalance).toFixed(6);
                const displayRequired = parseFloat(formattedRequired).toFixed(6);
                throw new Error(`Insufficient balance. Required: ${displayRequired} AVAX, Available: ${displayBalance} AVAX`);
            }

            // Execute purchase with manual gas limit
            console.log('Sending transaction with params:', {
                listingId,
                value: ethers.utils.formatEther(listingPrice),
                valueWei: listingPrice.toString(),
                gasLimit: manualGasLimit.toString(),
                gasPrice: gasPrice.toString()
            });

            // Check if the contract has a purchase or purchaseListing method
            let tx;
            try {
                // Try purchaseListing first (the correct method name)
                tx = await ipMarketplace.purchaseListing(listingId, {
                    value: listingPrice,
                    gasLimit: manualGasLimit,
                    gasPrice: gasPrice
                });

                console.log('Transaction sent:', tx);

                // Return the transaction object so the caller can wait for it
                return tx;
            } catch (err) {
                console.log('purchaseListing failed, trying purchase method instead:', err);
                // Fallback to purchase method
                tx = await ipMarketplace.purchase(listingId, {
                    value: listingPrice,
                    gasLimit: manualGasLimit,
                    gasPrice: gasPrice
                });

                console.log('Transaction sent (using purchase method):', tx);

                // Return the transaction object so the caller can wait for it
                return tx;
            }
        } catch (error: any) {
            console.error('Purchase failed:', error);

            // Extract the detailed error message from RPC error if available
            let errorMessage = error.message || 'Unknown error';
            if (error.error && error.error.message) {
                errorMessage = error.error.message;
            } else if (error.data && error.data.message) {
                errorMessage = error.data.message;
            }

            if (error.code === 4001) {
                throw new Error('Transaction rejected by user');
            } else if (errorMessage.includes('Insufficient payment')) {
                // Check if we can extract the required payment from the contract call
                try {
                    const ipMarketplace = await this.getIPMarketplace();
                    const listing = await ipMarketplace.getListing(listingId);
                    if (listing && listing.price) {
                        throw new Error(`Insufficient payment. Required: ${ethers.utils.formatEther(listing.price)} AVAX, Provided: ${price} AVAX`);
                    }
                } catch (subError) {
                    // Fall back to generic message if we can't get the listing
                }

                throw new Error('Insufficient payment amount. The contract requires a different amount than provided.');
            }

            throw new Error(`Failed to purchase listing: ${errorMessage}`);
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

    async getListing(listingId: number) {
        const signer = this.getSigner();
        const marketplace = await this.getIPMarketplace();
        return await marketplace.connect(signer).getListing(listingId);
    }
}