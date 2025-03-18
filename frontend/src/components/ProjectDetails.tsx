import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ethers } from 'ethers';
import { useWeb3 } from '../web3/hooks/useWeb3';
import { ipfsService } from '../web3/utils/ipfs';
import { ProjectDetails as IProjectDetails } from '../web3/utils/contracts';
import MilestoneVerificationStatus from './MilestoneVerificationStatus';
import WalletPrompt from './WalletPrompt';
import './ProjectDetails.css';

interface ProjectMetadata {
    title: string;
    description: string;
    category: string;
    files: string[];
    createdAt: string;
    creator: string;
}

const ProjectDetails: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { contractInterface, account, needsWallet, connectWallet } = useWeb3();
    const [project, setProject] = useState<IProjectDetails | null>(null);
    const [metadata, setMetadata] = useState<ProjectMetadata | null>(null);
    const [fundAmount, setFundAmount] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [txPending, setTxPending] = useState(false);

    useEffect(() => {
        if (id) loadProject();
    }, [id, contractInterface]);

    const loadProject = async () => {
        if (!contractInterface || !id) return;

        try {
            const projectData = await contractInterface.getProjectDetails(id);
            if (!projectData) {
                setError('Project not found');
                return;
            }

            setProject(projectData);

            // Load metadata from IPFS
            try {
                const response = await fetch(ipfsService.getIPFSUrl(projectData.metadataURI));
                const metadata = await response.json();
                setMetadata(metadata);
            } catch (err) {
                console.error('Failed to load project metadata:', err);
            }

        } catch (err) {
            console.error('Failed to load project:', err);
            setError('Failed to load project details');
        } finally {
            setLoading(false);
        }
    };

    const handleFund = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!contractInterface || !account || !id) return;

        setTxPending(true);
        setError('');

        try {
            const tx = await contractInterface.fundProject(
                id,
                fundAmount // Contract interface expects string, will handle parsing internally
            );
            await tx.wait();
            
            await loadProject();
            setFundAmount('');
        } catch (err: any) {
            console.error('Failed to fund project:', err);
            setError(err.message || 'Failed to fund project');
        } finally {
            setTxPending(false);
        }
    };

    if (needsWallet) {
        return (
            <WalletPrompt 
                message="Connect your wallet to view and fund this research project"
                onConnect={connectWallet}
            />
        );
    }

    if (loading) return <div className="loading">Loading project details...</div>;
    if (error) return <div className="error">{error}</div>;
    if (!project || !metadata) return <div className="error">Project not found</div>;

    const totalFunding = ethers.utils.formatEther(project.totalFunding);
    const currentFunding = ethers.utils.formatEther(project.currentFunding);
    const progressPercentage = (parseFloat(currentFunding) / parseFloat(totalFunding)) * 100;
    const isResearcher = account && project && account.toLowerCase() === project.researcher.toLowerCase();

    return (
        <div className="project-details">
            <button onClick={() => navigate('/research')} className="back-button">
                ← Back to Research Hub
            </button>

            <div className="project-header">
                <h1>{metadata.title}</h1>
                <div className="project-meta">
                    <span className="category">{metadata.category}</span>
                    <span className="researcher">
                        By: {project.researcher.slice(0, 6)}...{project.researcher.slice(-4)}
                    </span>
                    <span className="date">
                        Created: {new Date(metadata.createdAt).toLocaleDateString()}
                    </span>
                </div>
            </div>

            <div className="project-description">
                <h2>About this Research</h2>
                <p>{metadata.description}</p>
                
                {metadata.files && metadata.files.length > 0 && (
                    <div className="project-files">
                        <h3>Project Files</h3>
                        <ul>
                            {metadata.files.map((cid, index) => (
                                <li key={index}>
                                    <a 
                                        href={ipfsService.getIPFSUrl(cid)} 
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        View File {index + 1}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            <div className="funding-status">
                <h2>Funding Progress</h2>
                <div className="progress-bar">
                    <div 
                        className="progress" 
                        style={{ width: `${progressPercentage}%` }}
                    />
                </div>
                <div className="funding-info">
                    <span>{currentFunding} AVAX raised</span>
                    <span>Goal: {totalFunding} AVAX</span>
                </div>
                
                {project.isActive && !isResearcher && (
                    <form onSubmit={handleFund} className="funding-form">
                        <h3>Support this Research</h3>
                        <div className="input-group">
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={fundAmount}
                                onChange={e => setFundAmount(e.target.value)}
                                placeholder="Amount in AVAX"
                                required
                            />
                            <button type="submit" disabled={txPending}>
                                {txPending ? 'Processing...' : 'Fund Project'}
                            </button>
                        </div>
                        {error && <div className="error-message">{error}</div>}
                    </form>
                )}
            </div>

            <div className="milestones">
                <h2>Research Milestones</h2>
                {project.milestones.map((milestone, index) => (
                    <div 
                        key={index} 
                        className={`milestone ${milestone.isCompleted ? 'completed' : ''}`}
                    >
                        <div className="milestone-header">
                            <h3>Milestone {index + 1}</h3>
                            {milestone.isCompleted && (
                                <span className="status completed">Completed</span>
                            )}
                        </div>
                        
                        <p className="milestone-description">
                            {milestone.description}
                        </p>
                        
                        <div className="milestone-funding">
                            <div className="milestone-progress-bar">
                                <div 
                                    className="progress" 
                                    style={{ 
                                        width: `${(parseFloat(ethers.utils.formatEther(milestone.currentAmount)) / 
                                            parseFloat(ethers.utils.formatEther(milestone.targetAmount))) * 100}%` 
                                    }}
                                />
                            </div>
                            <div className="funding-info">
                                <span>
                                    {ethers.utils.formatEther(milestone.currentAmount)} / {ethers.utils.formatEther(milestone.targetAmount)} AVAX
                                </span>
                            </div>
                        </div>

                        {milestone.verificationCID && id && (
                            <MilestoneVerificationStatus
                                projectId={id}
                                milestoneId={index.toString()}
                                verificationCID={milestone.verificationCID}
                            />
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ProjectDetails;