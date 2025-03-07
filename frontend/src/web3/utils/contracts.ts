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

interface IPCreatedEventArgs {
    tokenId: ethers.BigNumber;
    creator: string;
    title: string;
}

interface IPDetails {
    tokenId: string;
    title: string;
    description: string;
    price: string;
    isListed: boolean;
    creator: string;
    licenseTerms: string;
}

export interface ProjectDetails {
    projectId: string;
    title: string;
    description: string;
    researcher: string;
    totalFunding: string;
    currentFunding: string;
    isActive: boolean;
    category: string;
    createdAt: number;
    milestones: MilestoneDetails[];
}

interface MilestoneDetails {
    description: string;
    targetAmount: string;
    currentAmount: string;
    isCompleted: boolean;
    fundsReleased: boolean;
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

interface WatchAssetParams {
    type: 'ERC20';
    options: {
        address: string;
        symbol: string;
        decimals: number;
        image?: string;
    };
}

export class ContractInterface {
    private provider: ethers.providers.Web3Provider;
    private signer: ethers.Signer;
    
    constructor(provider: ethers.providers.Web3Provider) {
        this.provider = provider;
        this.signer = provider.getSigner();
    }

    private getContractAddress(contractName: keyof typeof WEB3_CONFIG.CONTRACTS): string {
        return WEB3_CONFIG.CONTRACTS[contractName].address;
    }

    async getIPMarketplace() {
        return new ethers.Contract(
            WEB3_CONFIG.CONTRACTS.IPMarketplace.address,
            IPMarketplaceABI.abi,
            this.signer
        );
    }

    getIPMarketplaceAddress() {
        return WEB3_CONFIG.CONTRACTS.IPMarketplace.address;
    }

    async getIPToken() {
        return new ethers.Contract(
            WEB3_CONFIG.CONTRACTS.IPToken.address,
            IPTokenABI.abi,
            this.signer
        );
    }

    async getNEBLToken() {
        if (!this.signer) throw new Error("No signer available");
        const address = this.getContractAddress('NEBLToken');
        return new ethers.Contract(
            address,
            NEBLTokenABI.abi,
            this.signer
        );
    }

    async getResearchProject() {
        return new ethers.Contract(
            WEB3_CONFIG.CONTRACTS.ResearchProject.address,
            ResearchProjectABI.abi,
            this.signer
        );
    }

    async getGovernance() {
        return new ethers.Contract(
            WEB3_CONFIG.CONTRACTS.Governance.address,
            GovernanceABI.abi,
            this.signer
        );
    }

    async getDisputes() {
        return new ethers.Contract(
            WEB3_CONFIG.CONTRACTS.Disputes.address,
            DisputesABI.abi,
            this.signer
        );
    }

    async getMilestoneOracle() {
        return new ethers.Contract(
            WEB3_CONFIG.CONTRACTS.MilestoneOracle.address,
            MilestoneOracleABI.abi,
            this.signer
        );
    }

    async getFundingEscrow() {
        return new ethers.Contract(
            WEB3_CONFIG.CONTRACTS.FundingEscrow.address,
            FundingEscrowABI.abi,
            this.signer
        );
    }

    async getActiveListings(startId: number, pageSize: number) {
        const marketplace = await this.getIPMarketplace();
        return marketplace.getActiveListings(startId, pageSize);
    }

    async createListing(tokenId: number, price: string, isLicense: boolean, licenseDuration: number) {
        const marketplace = await this.getIPMarketplace();
        try {
            // Add gas estimation
            const gasLimit = await marketplace.estimateGas.createListing(tokenId, price, isLicense, licenseDuration);
            const tx = await marketplace.createListing(tokenId, price, isLicense, licenseDuration, {
                gasLimit: gasLimit.mul(120).div(100) // Add 20% buffer for safety
            });
            
            // Wait for confirmation with timeout and retry
            let receipt = null;
            let retries = 3;
            
            while (retries > 0 && !receipt) {
                try {
                    receipt = await Promise.race([
                        tx.wait(1),
                        new Promise((_, reject) => 
                            setTimeout(() => reject(new Error('Transaction confirmation timeout')), 30000)
                        )
                    ]);
                    break;
                } catch (err) {
                    console.warn('Waiting for transaction confirmation...', err);
                    retries--;
                    if (retries === 0) throw err;
                    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5s before retry
                }
            }
            
            return receipt;
        } catch (err: any) {
            if (err.code === 'UNPREDICTABLE_GAS_LIMIT') {
                throw new Error('Failed to estimate gas. The transaction may fail.');
            }
            throw err;
        }
    }

    async purchaseListing(listingId: number, price: string) {
        const marketplace = await this.getIPMarketplace();
        const tx = await marketplace.purchaseListing(listingId, {
            value: ethers.utils.parseEther(price)
        });
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

    async getOwnedTokens(address: string): Promise<IPDetails[]> {
        const ipToken = await this.getIPToken();
        try {
            // Use batch request for better performance
            const filter = ipToken.filters.Transfer(null, address, null);
            const events = await ipToken.queryFilter(filter);
            const tokenIds = Array.from(new Set(events.map(e => e.args?.tokenId.toString())));
            
            // Initialize tokens array to store results
            const tokens: IPDetails[] = [];
            
            // Process tokens in batches of 5 to avoid rate limiting
            const batchSize = 5;
            for (let i = 0; i < tokenIds.length; i += batchSize) {
                const batch = tokenIds.slice(i, i + batchSize);
                const batchPromises = batch.map(async tokenId => {
                    try {
                        const owner = await ipToken.ownerOf(tokenId);
                        if (owner.toLowerCase() === address.toLowerCase()) {
                            const details = await ipToken.ipDetails(tokenId);
                            return {
                                tokenId,
                                title: details.title,
                                description: details.description,
                                price: ethers.utils.formatEther(details.price),
                                isListed: details.isListed,
                                creator: details.creator,
                                licenseTerms: details.licenseTerms
                            };
                        }
                    } catch (err) {
                        console.error(`Error fetching token ${tokenId}:`, err);
                        return null;
                    }
                });
                
                const batchResults = await Promise.all(batchPromises);
                tokens.push(...batchResults.filter((t): t is IPDetails => t !== null));
                
                // Add small delay between batches to avoid rate limiting
                if (i + batchSize < tokenIds.length) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }
            
            return tokens;
        } catch (err: any) {
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
        const neblToken = await this.getNEBLToken();
        return await neblToken.balanceOf(address);
    }

    // Research Project methods
    async createResearchProject(
        title: string,
        description: string,
        category: string,
        metadataCID: string,
        milestoneDescriptions: string[],
        milestoneTargets: string[],
        verificationCIDs: string[],
        deadline: number
    ) {
        const researchProject = await this.getResearchProject();
        const targetsWei = milestoneTargets.map(t => ethers.utils.parseEther(t));
        const tx = await researchProject.createProject(
            title,
            description,
            category,
            metadataCID,
            milestoneDescriptions,
            targetsWei,
            verificationCIDs,
            deadline
        );
        const receipt = await tx.wait();
        const event = receipt.events?.find((e: ethers.Event) => e.event === 'ProjectCreated');
        return event?.args?.projectId.toString();
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
        const project = await researchProject.getProject(projectId);
        const milestoneIds = (await researchProject.getProject(projectId)).milestoneIds;
        
        const milestones = await Promise.all(
            milestoneIds.map(async (id: number) => {
                const m = await researchProject.getMilestone(projectId, id);
                return {
                    description: m.description,
                    targetAmount: ethers.utils.formatEther(m.targetAmount),
                    currentAmount: ethers.utils.formatEther(m.currentAmount),
                    isCompleted: m.isCompleted,
                    fundsReleased: m.fundsReleased
                };
            })
        );

        return {
            projectId,
            title: project.title,
            description: project.description,
            researcher: project.researcher,
            totalFunding: ethers.utils.formatEther(project.totalFunding),
            currentFunding: ethers.utils.formatEther(project.currentFunding),
            isActive: project.isActive,
            category: project.category,
            createdAt: project.createdAt.toNumber(),
            milestones
        };
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
        const tx = await governance.propose(targets, values, calldatas, description);
        return tx.wait();
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
        const neblSwap = await this.getNeblSwap();
        const avaxAmountWei = ethers.utils.parseEther(avaxAmount);
        
        // First check NEBL balance of swap contract
        const neblToken = await this.getNEBLToken();
        const swapBalance = await neblToken.balanceOf(neblSwap.address);
        const expectedNebl = await neblSwap.calculateNEBLAmount(avaxAmountWei);
        
        if (swapBalance.lt(expectedNebl)) {
            throw new Error("Insufficient liquidity in swap contract");
        }

        // Estimate gas to ensure transaction will succeed
        try {
            await neblSwap.estimateGas.swapAVAXForNEBL({
                value: avaxAmountWei
            });
        } catch (error) {
            console.error('Gas estimation failed:', error);
            throw new Error("Transaction would fail - please try a different amount");
        }

        // Perform the swap with explicit gas limit for safety
        const tx = await neblSwap.swapAVAXForNEBL({
            value: avaxAmountWei,
            gasLimit: 300000 // Add explicit gas limit
        });

        return tx;
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
}