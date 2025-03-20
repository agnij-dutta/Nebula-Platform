import { useState, useCallback } from 'react';
import { useWeb3 } from './useWeb3';
import { VerificationRequest } from '../../types/contracts';

export interface VerificationStatus {
    status: 'idle' | 'processing' | 'success' | 'error';
    error?: string;
}

export const useVerification = ({ projectId, milestoneId }: { projectId: string; milestoneId: string }) => {
    const { contractInterface } = useWeb3();
    const [status, setStatus] = useState<VerificationStatus>({ status: 'idle' });

    const requestVerification = useCallback(async (proof: string, verificationCriteria: string) => {
        if (!contractInterface) {
            throw new Error('Web3 not initialized');
        }

        setStatus({ status: 'processing' });

        try {
            const request: VerificationRequest = {
                projectId,
                milestoneId,
                proofCID: proof,
                verificationCID: verificationCriteria,
                verificationMethods: ['manual'],
                requiredConfidence: 1,
                deadline: Math.floor(Date.now() / 1000) + 86400 // 24 hours
            };

            const tx = await contractInterface.requestMilestoneVerification(request);
            await tx.wait();
            setStatus({ status: 'success' });
        } catch (error: any) {
            setStatus({ 
                status: 'error',
                error: error.message || 'Verification request failed'
            });
            throw error;
        }
    }, [contractInterface, projectId, milestoneId]);

    const resetStatus = useCallback(() => {
        setStatus({ status: 'idle' });
    }, []);

    return {
        status,
        requestVerification,
        resetStatus
    };
};