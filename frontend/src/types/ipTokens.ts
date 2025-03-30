import { BigNumber } from 'ethers';

export interface IPTokenMetadata {
    title: string;
    description: string;
    images?: string[];
    documents?: string[];
    additionalDetails?: {
        category?: string;
        tags?: string[];
        version?: string;
        createdAt: string;
        lastModified?: string;
    };
}

export interface IPTokenData {
    // On-chain data
    tokenId: string;
    title: string;
    description: string;
    price: string;
    isListed: boolean;
    creator: string;
    licenseTerms: string;
    owner: string;
    // Optional IPFS metadata
    ipfsMetadata?: IPTokenMetadata;
    // UI states
    isLoadingMetadata?: boolean;
    metadataError?: string;
}