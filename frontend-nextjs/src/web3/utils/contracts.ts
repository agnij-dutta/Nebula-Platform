import { WEB3_CONFIG } from '../config';
import { ethers } from 'ethers';
import { 
  useAccount,
  useContractRead,
  useContractReads,
  useContractWrite,
  useWaitForTransaction,
  usePublicClient,
  useChainId
} from 'wagmi';
import { decodeEventLog, getAbiItem, parseAbiItem, type Address, type TransactionReceipt } from 'viem';
import IPMarketplaceABI from '../abis/IPMarketplace.json';
import IPTokenABI from '../abis/IPToken.json';
import NEBLTokenABI from '../abis/NEBLToken.json';
import ResearchProjectABI from '../abis/ResearchProject.json';
import GovernanceABI from '../abis/Governance.json';
import DisputesABI from '../abis/Disputes.json';
import MilestoneOracleABI from '../abis/MilestoneOracle.json';
import FundingEscrowABI from '../abis/FundingEscrow.json';
import NEBLSwapABI from '../abis/NEBLSwap.json';
import { ipfsService } from './ipfs';

// Type assertions for ABIs
const IPMarketplaceContract = IPMarketplaceABI as any;
const IPTokenContract = IPTokenABI as any;
const NEBLTokenContract = NEBLTokenABI as any;
const ResearchProjectContract = ResearchProjectABI as any;
const GovernanceContract = GovernanceABI as any;
const DisputesContract = DisputesABI as any;
const MilestoneOracleContract = MilestoneOracleABI as any;
const FundingEscrowContract = FundingEscrowABI as any;
const NEBLSwapContract = NEBLSwapABI as any;

// Type definitions
export interface IPTokenData {
  tokenId: string;
  title: string;
  description: string;
  licenseTerms: string;
  owner: string;
  creator: string;
  metadataURI: string;
  hasActiveListing?: boolean;
  price?: string;
  listingId?: string;
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

interface Listing {
  listingId: string;
  tokenId: string;
  seller: string;
  price: string;
  isActive: boolean;
  isLicense: boolean;
  licenseDuration: string;
}

// Contract service class for React components
class NebulaContracts {
  // Helper functions for contract operations
  private async executeWithRetry<T>(operation: () => Promise<T>, maxRetries = 3): Promise<T> {
    let lastError: Error | null = null;
    let delay = 500;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (err: any) {
        console.warn(`Attempt ${attempt + 1} failed:`, err);
        lastError = err;
        if (attempt === maxRetries) break;
        
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
      }
    }
    
    throw lastError;
  }

  // Convert address string to wagmi-compatible Address
  private toAddress(address: string): Address {
    return address as Address;
  }

  // Get contract addresses from config
  getContractAddress(contractName: keyof typeof WEB3_CONFIG.CONTRACTS): Address {
    return this.toAddress(WEB3_CONFIG.CONTRACTS[contractName].address);
  }

  // Hook to get active marketplace listings
  useActiveListings(startId: number = 0, pageSize: number = 10) {
    const chainId = useChainId();
    const ipMarketplaceAddress = this.getContractAddress('IPMarketplace');
    
    // First get the total number of listings
    const { data: totalListings } = useContractRead({
      address: ipMarketplaceAddress,
      abi: IPMarketplaceContract,
      functionName: 'getTotalListings',
    });
    
    const range = totalListings ? Math.min(Number(totalListings), startId + pageSize) : 0;
    
    // Prepare multicall requests
    const calls = Array.from({ length: range - startId }, (_, i) => ({
      address: ipMarketplaceAddress,
      abi: IPMarketplaceContract,
      functionName: 'listings',
      args: [BigInt(startId + i)]
    }));
    
    const { data: results, isLoading, error } = useContractReads({
      contracts: calls.length > 0 ? calls : undefined,
    });
    
    // Process results when available
    let listings: Listing[] = [];
    
    if (results) {
      results.forEach((result) => {
        if (result.status !== 'success' || !result.result) return;
        
        const data = result.result;
        
        if (!Array.isArray(data)) return;
        
        const [listingId, tokenId, seller, price, isActive, isLicense, licenseDuration] = data;
        
        // Only include active listings
        if (isActive) {
          listings.push({
            listingId: listingId.toString(),
            tokenId: tokenId.toString(),
            seller: seller.toString(),
            price: ethers.utils.formatEther(price.toString()),
            isActive,
            isLicense,
            licenseDuration: licenseDuration.toString()
          });
        }
      });
    }
    
    return {
      listings,
      isLoading,
      error
    };
  }

  // Hook to get owned tokens
  useOwnedTokens(address?: Address) {
    const { address: connectedAddress } = useAccount();
    const userAddress = address || connectedAddress;
    
    const ipTokenAddress = this.getContractAddress('IPToken');
    const ipMarketplaceAddress = this.getContractAddress('IPMarketplace');
    
    // Get token balance
    const { data: balance } = useContractRead({
      address: ipTokenAddress,
      abi: IPTokenContract,
      functionName: 'balanceOf',
      args: [userAddress!],
      enabled: !!userAddress,
    });
    
    // Get token IDs
    const tokenIdCalls = Array.from({ length: balance ? Number(balance) : 0 }, (_, i) => ({
      address: ipTokenAddress,
      abi: IPTokenContract,
      functionName: 'tokenOfOwnerByIndex',
      args: [userAddress!, BigInt(i)]
    }));
    
    const { data: tokenIdResults, isLoading: isLoadingTokenIds } = useContractReads({
      contracts: tokenIdCalls.length > 0 ? tokenIdCalls : undefined,
    });
    
    // Get token data
    const tokenDataCalls = tokenIdResults
      ? tokenIdResults
          .filter((result): result is { status: 'success'; result: any[] } => result.status === 'success')
          .map((result) => ({
            address: ipTokenAddress,
            abi: IPTokenContract,
            functionName: 'getTokenData',
            args: [result.result]
          }))
      : [];
    
    const { data: tokenDataResults, isLoading: isLoadingTokenData } = useContractReads({
      contracts: tokenDataCalls.length > 0 ? tokenDataCalls : undefined,
    });
    
    // Process results
    const tokens: IPTokenData[] = [];
    const tokenIds: bigint[] = [];
    
    if (tokenIdResults && tokenDataResults) {
      for (let i = 0; i < tokenDataResults.length; i++) {
        if (tokenDataResults[i].status !== 'success' || !tokenDataResults[i].result) continue;
        
        const data = tokenDataResults[i].result as any;
        const tokenIdResult = tokenIdResults[i];
        
        if (tokenIdResult.status !== 'success') continue;
        
        const tokenId = tokenIdResult.result?.toString() || '';
        tokenIds.push(BigInt(tokenId));
        
        tokens.push({
          tokenId,
          title: data.title || 'Untitled IP',
          description: data.description || '',
          licenseTerms: data.licenseTerms || '',
          owner: data.owner?.toString() || '',
          creator: data.creator?.toString() || '',
          metadataURI: data.metadataURI || ''
        });
      }
    }
    
    // Check if tokens have active listings
    const listingCalls = tokens.map(token => ({
      address: ipMarketplaceAddress,
      abi: IPMarketplaceContract,
      functionName: 'getActiveListingByToken',
      args: [BigInt(token.tokenId)]
    }));
    
    const { data: listingResults, isLoading: isLoadingListings } = useContractReads({
      contracts: listingCalls.length > 0 ? listingCalls : undefined,
    });
    
    // Update tokens with listing info
    if (listingResults) {
      for (let i = 0; i < tokens.length; i++) {
        const result = listingResults[i];
        if (result.status !== 'success' || !result.result) continue;
        
        const listingData = result.result as any;
        
        if (listingData.isActive) {
          tokens[i].hasActiveListing = true;
          tokens[i].price = ethers.utils.formatEther(listingData.price.toString());
          tokens[i].listingId = listingData.listingId?.toString();
        }
      }
    }
    
    return {
      tokens,
      isLoading: isLoadingTokenIds || isLoadingTokenData || isLoadingListings
    };
  }

  // Hook for creating IP token
  useCreateIP() {
    const ipTokenAddress = this.getContractAddress('IPToken');
    const { write, isLoading, error } = useContractWrite({
      address: ipTokenAddress,
      abi: IPTokenContract,
      functionName: 'createToken'
    });
    const publicClient = usePublicClient();
    
    const createIP = async (title: string, description: string, uri: string, licenseTerms: string): Promise<string> => {
      try {
        const tx = await write({
          args: [title, uri, licenseTerms]
        });
        
        const receipt = await publicClient.waitForTransactionReceipt({ hash: tx as unknown as `0x${string}` });
        
        // Parse logs to find the token ID
        const tokenCreatedEvent = getAbiItem({ abi: IPTokenContract, name: 'TokenCreated' });
        for (const log of receipt.logs) {
          try {
            if (log.address.toLowerCase() === ipTokenAddress.toLowerCase()) {
              const { args } = decodeEventLog({
                abi: IPTokenContract,
                data: log.data,
                topics: log.topics,
              });
              const decodedArgs = args as { tokenId: bigint };
              if (decodedArgs?.tokenId) {
                return decodedArgs.tokenId.toString();
              }
            }
          } catch (e) {
            // Skip logs that don't match our event
            continue;
          }
        }
        
        throw new Error("Token creation succeeded but couldn't find token ID");
      } catch (error) {
        console.error("Error creating IP token:", error);
        throw error;
      }
    };
    
    return {
      createIP,
      isLoading,
      error
    };
  }

  // Hook for creating a marketplace listing
  useCreateListing() {
    const ipMarketplaceAddress = this.getContractAddress('IPMarketplace');
    const ipTokenAddress = this.getContractAddress('IPToken');
    const { write, isLoading, error } = useContractWrite({
      address: ipMarketplaceAddress,
      abi: IPMarketplaceContract,
      functionName: 'createListing'
    });
    const publicClient = usePublicClient();
    const { address } = useAccount();
    
    const checkApproval = async () => {
      if (!address) return false;
      
      try {
        const isApproved = await publicClient.readContract({
          address: ipTokenAddress,
          abi: IPTokenContract,
          functionName: 'isApprovedForAll',
          args: [address, ipMarketplaceAddress]
        });
        
        return isApproved;
      } catch (error) {
        console.error("Error checking approval:", error);
        return false;
      }
    };
    
    const approveMarketplace = async (): Promise<boolean> => {
      try {
        const isApproved = await checkApproval();
        
        if (!isApproved) {
          const tx = await write({
            args: [ipMarketplaceAddress, true]
          });
          
          await publicClient.waitForTransactionReceipt({ hash: tx as unknown as `0x${string}` });
          return true;
        }
        
        return true;
      } catch (error) {
        console.error("Error approving marketplace:", error);
        return false;
      }
    };
    
    const createListing = async (tokenId: string, price: string, isLicense: boolean, licenseDuration: number = 0): Promise<string> => {
      try {
        // Ensure marketplace is approved
        const approved = await approveMarketplace();
        if (!approved) throw new Error("Failed to approve marketplace");
        
        // Create the listing
        const priceInWei = ethers.utils.parseEther(price);
        
        const tx = await write({
          args: [BigInt(tokenId), priceInWei, isLicense, BigInt(licenseDuration)]
        });
        
        const receipt = await publicClient.waitForTransactionReceipt({ hash: tx as unknown as `0x${string}` });
        
        // Find the ListingCreated event
        const listingCreatedEvent = getAbiItem({ abi: IPMarketplaceContract, name: 'ListingCreated' });
        
        for (const log of receipt.logs) {
          try {
            if (log.address.toLowerCase() === ipMarketplaceAddress.toLowerCase()) {
              const { args } = decodeEventLog({
                abi: IPMarketplaceContract,
                data: log.data,
                topics: log.topics,
              });
              
              const listingId = args as { listingId: bigint };
              if (listingId?.listingId) {
                return listingId.listingId.toString();
              }
            }
          } catch (e) {
            // Skip logs that don't match our event
            continue;
          }
        }
        
        throw new Error("Listing creation succeeded but couldn't find listing ID");
      } catch (error) {
        console.error("Error creating listing:", error);
        throw error;
      }
    };
    
    return {
      createListing,
      approveMarketplace,
      checkApproval,
      isLoading,
      error
    };
  }
  
  // Hook for purchasing a marketplace listing
  usePurchaseListing() {
    const ipMarketplaceAddress = this.getContractAddress('IPMarketplace');
    const { write, isLoading, error } = useContractWrite({
      address: ipMarketplaceAddress,
      abi: IPMarketplaceContract,
      functionName: 'purchaseListing'
    });
    const publicClient = usePublicClient();
    
    const purchaseListing = async (listingId: string, price: string): Promise<boolean> => {
      try {
        const tx = write({
            args: [BigInt(listingId)],
            value: ethers.utils.parseEther(price) as unknown as bigint
        });
        
        return true;
      } catch (error) {
        console.error("Error purchasing listing:", error);
        throw error;
      }
    };
    
    return {
      purchaseListing,
      isLoading,
      error
    };
  }

  // Hook for fetching research projects
  useResearchProjects(active: boolean = true) {
    const researchProjectAddress = this.getContractAddress('ResearchProject');
    
    // Get total projects
    const { data: totalProjects } = useContractRead({
      address: researchProjectAddress,
      abi: ResearchProjectContract,
      functionName: 'totalProjects'
    });
    
    // Prepare calls for each project
    const projectCalls = Array.from({ length: totalProjects ? Number(totalProjects) : 0 }, (_, i) => ({
      address: researchProjectAddress,
      abi: ResearchProjectContract,
      functionName: 'projects',
      args: [BigInt(i)]
    }));
    
    const { data: projectResults, isLoading: isLoadingProjects } = useContractReads({
      contracts: projectCalls.length > 0 ? projectCalls : undefined,
    });
    
    // Process results
    const projects: ProjectDetails[] = [];
    
    if (projectResults) {
      for (let i = 0; i < projectResults.length; i++) {
        const result = projectResults[i];
        if (result.status !== 'success' || !result.result) continue;
        
        const projectData = result.result as any;
        
        // Skip inactive projects if requested
        if (active && !projectData.isActive) continue;
        
        projects.push({
          title: projectData.title || `Project ${i}`,
          description: projectData.description || '',
          category: projectData.category || '',
          researcher: projectData.researcher || '',
          currentFunding: ethers.utils.formatEther(projectData.currentFunding?.toString() || '0'),
          totalFunding: ethers.utils.formatEther(projectData.totalFunding?.toString() || '0'),
          isActive: projectData.isActive || false,
          createdAt: Number(projectData.createdAt?.toString() || '0') * 1000, // Convert to milliseconds
          deadline: Number(projectData.deadline?.toString() || '0') * 1000, // Convert to milliseconds
          metadataURI: projectData.metadataURI || '',
          milestones: [],
          projectId: i.toString()
        });
      }
    }
    
    return {
      projects,
      isLoading: isLoadingProjects
    };
  }
}

export const nebulaContracts = new NebulaContracts(); 