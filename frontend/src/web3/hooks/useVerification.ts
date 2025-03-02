import { useState, useCallback } from 'react';
import { useWeb3 } from './useWeb3';

interface UseVerificationOptions {
    projectId: string;
    milestoneId: string;
}

export interface VerificationStatus {
    status: 'pending' | 'processing' | 'verified' | 'failed';
    requestId?: string;
    error?: string;
}

export function useVerification({ projectId, milestoneId }: UseVerificationOptions) {
    const { contractInterface } = useWeb3();
    const [status, setStatus] = useState<VerificationStatus>({ status: 'pending' });

    const requestVerification = useCallback(async (proofCID: string, verificationCID: string) => {
        if (!contractInterface) return;

        try {
            setStatus({ status: 'processing' });
            
            const oracle = await contractInterface.getMilestoneOracle();
            const chainlinkJobId = 'milestone-verification-v1';
            const payment = '100000000000000000'; // 0.1 LINK
            
            // Request verification through the oracle
            const tx = await oracle.requestVerification(
                projectId,
                milestoneId,
                proofCID,
                verificationCID,
                oracle.address,
                chainlinkJobId,
                payment
            );

            const receipt = await tx.wait();
            
            // Find VerificationRequested event
            const event = receipt.events?.find(
                (e: any) => e.event === 'VerificationRequested'
            );

            if (event) {
                setStatus({ 
                    status: 'processing',
                    requestId: event.args.requestId 
                });

                // Start polling for verification status
                startPolling(event.args.requestId);
            }
        } catch (error: any) {
            setStatus({ 
                status: 'failed',
                error: error.message || 'Failed to request verification' 
            });
        }
    }, [contractInterface, projectId, milestoneId]);

    const startPolling = useCallback(async (requestId: string) => {
        if (!contractInterface) return;

        const pollInterval = setInterval(async () => {
            try {
                const oracle = await contractInterface.getMilestoneOracle();
                const request = await oracle.verificationRequests(requestId);

                if (!request.isProcessing) {
                    clearInterval(pollInterval);
                    setStatus({
                        status: request.isVerified ? 'verified' : 'failed',
                        requestId
                    });
                }
            } catch (error) {
                clearInterval(pollInterval);
                setStatus({
                    status: 'failed',
                    requestId,
                    error: 'Failed to check verification status'
                });
            }
        }, 5000); // Poll every 5 seconds

        // Clean up interval after 10 minutes
        setTimeout(() => {
            clearInterval(pollInterval);
            setStatus(current => {
                if (current.status === 'processing') {
                    return {
                        status: 'failed',
                        requestId,
                        error: 'Verification timed out'
                    };
                }
                return current;
            });
        }, 600000);

    }, [contractInterface]);

    const resetStatus = useCallback(() => {
        setStatus({ status: 'pending' });
    }, []);

    return {
        status,
        requestVerification,
        resetStatus
    };
}