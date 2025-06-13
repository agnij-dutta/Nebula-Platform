import { BigNumber } from 'ethers';

export interface IPMetadata {
  title: string;
  description: string;
  contentURI: string;
  tags: string[];
  category: string;
  createdAt: number;
  images?: string[];
  documents?: string[];
}

export interface IPAsset {
  tokenId: string;
  owner: string;
  metadata: IPMetadata;
  parentTokenId?: string;
  derivatives?: string[];
}

export enum LicenseType {
  STANDARD = 0,
  COMMERCIAL = 1,
  DERIVATIVE = 2,
  EXCLUSIVE = 3
}

export enum AttributionRequirement {
  NONE = 0,
  REQUIRED = 1,
  PROMINENT = 2
}

export interface LicenseTerms {
  licenseType: LicenseType;
  allowCommercialUse: boolean;
  allowModifications: boolean;
  attribution: AttributionRequirement;
  royaltyPercentage: BigNumber;
  duration: BigNumber;
  maxRevenue: BigNumber;
  additionalTerms: string;
}

export interface License {
  licenseId: string;
  ipTokenId: string;
  owner: string;
  terms: LicenseTerms;
  isValid: boolean;
  expirationDate?: number;
}

export interface RoyaltyInfo {
  recipient: string;
  percentage: BigNumber;
  maxAmount: BigNumber;
  paidAmount: BigNumber;
}

export interface RoyaltyPayment {
  paymentId: string;
  ipTokenId: string;
  payer: string;
  amount: BigNumber;
  timestamp: number;
}
