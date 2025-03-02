import { useState, useEffect } from 'react';
import { useWeb3 } from './useWeb3';
import { Contract } from 'ethers';

export enum DisputeStatus {
  Active,
  Resolved,
  Rejected
}

export enum DisputeType {
  IPOwnership,
  MilestoneCompletion,
  LicenseViolation
}

export interface DisputeDetails {
  id: string;
  disputeType: DisputeType;
  complainant: string;
  respondent: string;
  relatedId: string;
  description: string;
  status: DisputeStatus;
  createdAt: number;
  resolvedAt: number;
  resolution: string;
  proposalId: string;
}

export interface Evidence {
  description: string;
  ipfsHash: string;
  timestamp: number;
}

export const useDisputes = (disputeId?: string) => {
  const { contractInterface, account } = useWeb3();
  const [dispute, setDispute] = useState<DisputeDetails | null>(null);
  const [complainantEvidence, setComplainantEvidence] = useState<Evidence[]>([]);
  const [respondentEvidence, setRespondentEvidence] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDispute = async () => {
    if (!contractInterface || !disputeId) return;
    setLoading(true);
    setError('');
    
    try {
      const disputesContract = await contractInterface.getDisputes() as Contract;
      const disputeDetails = await contractInterface.getDisputeDetails(disputeId);
      setDispute(disputeDetails);

      // Load evidence for both parties
      const [complainantEv, respondentEv] = await Promise.all([
        disputesContract.getEvidence(disputeId, disputeDetails.complainant),
        disputesContract.getEvidence(disputeId, disputeDetails.respondent)
      ]);

      setComplainantEvidence(
        complainantEv.descriptions.map((desc: string, i: number) => ({
          description: desc,
          ipfsHash: complainantEv.ipfsHashes[i],
          timestamp: complainantEv.timestamps[i].toNumber()
        }))
      );

      setRespondentEvidence(
        respondentEv.descriptions.map((desc: string, i: number) => ({
          description: desc,
          ipfsHash: respondentEv.ipfsHashes[i],
          timestamp: respondentEv.timestamps[i].toNumber()
        }))
      );
    } catch (err) {
      console.error('Failed to load dispute:', err);
      setError('Failed to load dispute details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (contractInterface && disputeId) {
      loadDispute();
    }
  }, [contractInterface, disputeId]);

  const createDispute = async (
    disputeType: DisputeType,
    respondent: string,
    relatedId: string,
    description: string
  ) => {
    if (!contractInterface) throw new Error('Web3 not initialized');
    
    try {
      const disputeId = await contractInterface.createDispute(
        disputeType,
        respondent,
        relatedId,
        description
      );
      return disputeId;
    } catch (err) {
      console.error('Failed to create dispute:', err);
      throw err;
    }
  };

  const submitEvidence = async (
    disputeId: string,
    description: string,
    ipfsHash: string
  ) => {
    if (!contractInterface) throw new Error('Web3 not initialized');
    
    try {
      const tx = await contractInterface.submitEvidence(disputeId, description, ipfsHash);
      await tx.wait();
      await loadDispute(); // Reload dispute data after successful submission
    } catch (err) {
      console.error('Failed to submit evidence:', err);
      throw err;
    }
  };

  const getDisputeTypeString = (type: DisputeType): string => {
    switch (type) {
      case DisputeType.IPOwnership:
        return 'IP Ownership';
      case DisputeType.MilestoneCompletion:
        return 'Milestone Completion';
      case DisputeType.LicenseViolation:
        return 'License Violation';
      default:
        return 'Unknown';
    }
  };

  const getDisputeStatusString = (status: DisputeStatus): string => {
    switch (status) {
      case DisputeStatus.Active:
        return 'Active';
      case DisputeStatus.Resolved:
        return 'Resolved';
      case DisputeStatus.Rejected:
        return 'Rejected';
      default:
        return 'Unknown';
    }
  };

  return {
    dispute,
    complainantEvidence,
    respondentEvidence,
    loading,
    error,
    createDispute,
    submitEvidence,
    getDisputeTypeString,
    getDisputeStatusString,
    refreshDispute: loadDispute
  };
};