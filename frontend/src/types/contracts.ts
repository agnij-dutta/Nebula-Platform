import { BigNumber } from 'ethers';

export interface Milestone {
    description: string;
    targetAmount: BigNumber;
    currentAmount: BigNumber;
    isCompleted: boolean;
    fundsReleased: boolean;
    verificationCriteria: string;
}

export interface Project {
    projectId: string;
    title: string;
    description: string;
    researcher: string;
    totalFunding: BigNumber;
    currentFunding: BigNumber;
    isActive: boolean;
    milestones: Milestone[];
    category: string;
    createdAt: BigNumber;
    metadataURI: string;
    isCancelled: boolean;
    deadline: BigNumber;
}

export interface VerificationRequest {
    proofCID: string;
    verificationCID: string;
    projectId: string;
    milestoneId: string;
    verificationMethods: string[];
    requiredConfidence: number;
    deadline: number;
}