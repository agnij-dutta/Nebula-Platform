import React, { useState, useEffect } from 'react';
import { useWeb3 } from '../web3/hooks/useWeb3';
import { ipfsService } from '../web3/utils/ipfs';
import './MilestoneVerificationStatus.css';

interface Props {
    projectId: string;
    milestoneId: string;
    verificationCID: string;
}

interface VerificationCriteria {
    criteria: string;
    timestamp: string;
}

const MilestoneVerificationStatus: React.FC<Props> = ({ 
    projectId, 
    milestoneId,
    verificationCID 
}) => {
    const { contractInterface } = useWeb3();
    const [criteria, setCriteria] = useState<string>('');
    const [status, setStatus] = useState<'pending' | 'verified' | 'rejected'>('pending');
    const [loading, setLoading] = useState(true);
    const [verifying, setVerifying] = useState(false);
    const [error, setError] = useState('');

    const loadVerificationDetails = async () => {
        if (!contractInterface) return;

        try {
            // Load verification criteria from IPFS
            const response = await fetch(ipfsService.getIPFSUrl(verificationCID));
            const data = await response.json() as VerificationCriteria;
            setCriteria(data.criteria);

            // Get current verification status
            const verificationReport = await contractInterface.getVerificationDetails(projectId, milestoneId);
            setStatus(
                verificationReport.status === 'VERIFIED' ? 'verified' :
                verificationReport.status === 'FAILED' ? 'rejected' :
                'pending'
            );
        } catch (err) {
            console.error('Failed to load verification details:', err);
            setError('Failed to load verification details');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadVerificationDetails();
    }, [loadVerificationDetails]);

    const handleVerification = async (isApproved: boolean) => {
        if (!contractInterface) return;

        setVerifying(true);
        setError('');

        try {
            const tx = await contractInterface.requestMilestoneVerification({
                projectId,
                milestoneId,
                proofCID: verificationCID,
                verificationCID,
                verificationMethods: ['manual'],
                requiredConfidence: 1,
                deadline: Math.floor(Date.now() / 1000) + 86400, // 24 hours
                customParams: {
                    isApproved
                }
            });
            
            await tx.wait();
            
            // Refresh status
            await loadVerificationDetails();
        } catch (err: any) {
            console.error('Verification failed:', err);
            setError(err.message || 'Failed to verify milestone');
        } finally {
            setVerifying(false);
        }
    };

    if (loading) {
        return <div className="verification-status loading">Loading verification details...</div>;
    }

    return (
        <div className="verification-status">
            <h4>Verification Details</h4>
            
            <div className="criteria">
                <h5>Verification Criteria:</h5>
                <p>{criteria}</p>
            </div>

            <div className="status-info">
                <span className={`status ${status}`}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                </span>
            </div>

            {status === 'pending' && (
                <div className="verification-actions">
                    <button
                        onClick={() => handleVerification(true)}
                        className="verify-button"
                        disabled={verifying}
                    >
                        {verifying ? 'Processing...' : 'Verify'}
                    </button>
                    <button
                        onClick={() => handleVerification(false)}
                        className="reject-button"
                        disabled={verifying}
                    >
                        {verifying ? 'Processing...' : 'Reject'}
                    </button>
                </div>
            )}

            {error && <div className="error-message">{error}</div>}
        </div>
    );
};

export default MilestoneVerificationStatus;