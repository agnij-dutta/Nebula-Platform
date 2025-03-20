import React, { useState } from 'react';
import { useWeb3 } from '../web3/hooks/useWeb3';
import { useVerification, VerificationStatus } from '../web3/hooks/useVerification';
import './MilestoneVerification.css';

interface MilestoneVerificationProps {
    projectId: string;
    milestoneId: string;
    verificationCriteria: string;
    onVerificationSubmitted?: () => void;
}

const MilestoneVerification: React.FC<MilestoneVerificationProps> = ({
    projectId,
    milestoneId,
    verificationCriteria,
    onVerificationSubmitted
}) => {
    const { account } = useWeb3();
    const { 
        status,
        requestVerification,
        resetStatus 
    } = useVerification({
        projectId,
        milestoneId
    });
    
    const [description, setDescription] = useState('');
    const [metrics, setMetrics] = useState('');
    const [files, setFiles] = useState<File[]>([]);
    const [submitting, setSubmitting] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFiles(Array.from(e.target.files));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            // Create proof data matching verification criteria format
            const proofData = description + "\n\nMetrics:\n" + metrics;
            
            // Request verification with the proof data
            await requestVerification(proofData, verificationCriteria);
            
            if (onVerificationSubmitted) {
                onVerificationSubmitted();
            }
        } catch (error) {
            console.error('Verification submission failed:', error);
            resetStatus();
        } finally {
            setSubmitting(false);
        }
    };

    const isProcessing = status.status === 'processing';

    if (isProcessing) {
        return (
            <div className="verification-processing">
                <div className="spinner"></div>
                <p>Verification in progress...</p>
                <small>This may take a few minutes</small>
            </div>
        );
    }

    return (
        <div className="milestone-verification-form">
            <h3>Submit Milestone Verification</h3>
            
            {status.error && (
                <div className="error-message">{status.error}</div>
            )}
            
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label>Completion Details</label>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Describe how the milestone requirements were met"
                        required
                        rows={4}
                    />
                </div>
                <div className="form-group">
                    <label>Key Metrics & Results</label>
                    <textarea
                        value={metrics}
                        onChange={(e) => setMetrics(e.target.value)}
                        placeholder="List quantifiable results and achieved metrics"
                        required
                        rows={3}
                    />
                </div>
                <div className="form-group">
                    <label>Supporting Documents (Optional)</label>
                    <input
                        type="file"
                        multiple
                        onChange={handleFileChange}
                        accept=".pdf,.doc,.docx,.txt,.zip,.jpg,.png"
                    />
                    <small>Upload any supporting documentation (optional)</small>
                </div>
                <button 
                    type="submit" 
                    className="submit-button"
                    disabled={submitting || isProcessing}
                >
                    {submitting ? 'Submitting...' : 'Submit for Verification'}
                </button>
            </form>
        </div>
    );
};

export default MilestoneVerification;