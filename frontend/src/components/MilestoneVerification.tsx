import React, { useState } from 'react';
import { useWeb3 } from '../web3/hooks/useWeb3';
import { useVerification, VerificationStatus } from '../web3/hooks/useVerification';
import { ipfsService } from '../web3/utils/ipfs';
import './MilestoneVerification.css';

interface MilestoneVerificationProps {
    projectId: string;
    milestoneId: string;
    verificationCID: string;
    onVerificationSubmitted?: () => void;
}

const MilestoneVerification: React.FC<MilestoneVerificationProps> = ({
    projectId,
    milestoneId,
    verificationCID,
    onVerificationSubmitted
}) => {
    const { account } = useWeb3();
    const { 
        status,
        requestVerification,
        resetStatus 
    }: { 
        status: VerificationStatus;
        requestVerification: (proofCID: string, verificationCID: string) => Promise<void>;
        resetStatus: () => void;
    } = useVerification({
        projectId,
        milestoneId
    });
    
    const [files, setFiles] = useState<File[]>([]);
    const [description, setDescription] = useState('');
    const [metrics, setMetrics] = useState('');
    const [uploading, setUploading] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFiles(Array.from(e.target.files));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setUploading(true);
        try {
            // Upload proof files to IPFS
            const fileUploads = await Promise.all(
                files.map(file => ipfsService.uploadFile(file))
            );
            // Create proof metadata
            const proofMetadata = {
                description,
                metrics,
                proofDocuments: fileUploads,
                timestamp: new Date().toISOString(),
                submitter: account,
                milestoneId,
                projectId
            };
            // Upload proof metadata to IPFS
            const proofCID = await ipfsService.uploadJSON(proofMetadata);
            // Request verification through oracle
            await requestVerification(proofCID, verificationCID);
            if (onVerificationSubmitted) {
                onVerificationSubmitted();
            }
        } catch (error) {
            console.error('Verification submission failed:', error);
            resetStatus();
        } finally {
            setUploading(false);
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
                    <label>Supporting Documents</label>
                    <input
                        type="file"
                        multiple
                        onChange={handleFileChange}
                        accept=".pdf,.doc,.docx,.txt,.zip,.jpg,.png"
                        required
                    />
                    <small>Upload proof of milestone completion (documents, images, data)</small>
                </div>
                <button 
                    type="submit" 
                    className="submit-button"
                    disabled={uploading || isProcessing}
                >
                    {uploading ? 'Uploading...' : 'Submit for Verification'}
                </button>
            </form>
        </div>
    );
};

export default MilestoneVerification;