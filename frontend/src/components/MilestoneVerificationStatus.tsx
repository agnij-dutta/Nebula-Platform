import React, { useState, useEffect } from 'react';
import { useWeb3 } from '../web3/hooks/useWeb3';
import { ipfsService } from '../web3/utils/ipfs';
import './MilestoneVerificationStatus.css';

interface MilestoneVerificationStatusProps {
    projectId: string;
    milestoneId: string;
    verificationCID: string;
}

const MilestoneVerificationStatus: React.FC<MilestoneVerificationStatusProps> = ({
    projectId,
    milestoneId,
    verificationCID
}) => {
    const { contractInterface } = useWeb3();
    const [status, setStatus] = useState<'pending' | 'processing' | 'verified' | 'failed'>('pending');
    const [verificationDetails, setVerificationDetails] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const loadVerificationStatus = async () => {
            if (!contractInterface) return;

            try {
                const oracle = await contractInterface.getMilestoneOracle();
                
                // Check if there's an active verification request
                const requestDetails = await oracle.getVerificationDetails(projectId, milestoneId);
                
                if (requestDetails.isProcessing) {
                    setStatus('processing');
                } else if (requestDetails.isVerified) {
                    setStatus('verified');
                } else if (requestDetails.attempts > 0) {
                    setStatus('failed');
                }

                // Load verification criteria from IPFS
                const details = await ipfsService.fetchJSON(verificationCID);
                setVerificationDetails(details);
            } catch (err) {
                console.error('Failed to load verification status:', err);
                setError('Failed to load verification status');
            } finally {
                setIsLoading(false);
            }
        };

        loadVerificationStatus();
    }, [contractInterface, projectId, milestoneId, verificationCID]);

    if (isLoading) {
        return <div className="verification-status loading">Loading verification status...</div>;
    }

    if (error) {
        return <div className="verification-status error">{error}</div>;
    }

    return (
        <div className="verification-status">
            <div className={`status-indicator ${status}`}>
                {status === 'pending' && 'Awaiting Verification'}
                {status === 'processing' && 'Verification in Progress'}
                {status === 'verified' && 'Milestone Verified'}
                {status === 'failed' && 'Verification Failed'}
            </div>

            {verificationDetails && (
                <div className="verification-details">
                    <h3>Verification Requirements</h3>
                    <ul>
                        {verificationDetails.requirements?.map((req: any, index: number) => (
                            <li key={index} className={status === 'verified' ? 'met' : ''}>
                                {req.description}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {status === 'failed' && (
                <div className="retry-section">
                    <p>Verification attempt failed. Please review the requirements and try again.</p>
                    <button 
                        onClick={() => window.location.href = `/project/${projectId}/milestone/${milestoneId}/verify`}
                        className="retry-button"
                    >
                        Submit New Verification
                    </button>
                </div>
            )}
        </div>
    );
};

export default MilestoneVerificationStatus;